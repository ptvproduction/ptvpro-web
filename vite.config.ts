/// <reference types="vitest" />
import { defineConfig, loadEnv, Plugin } from 'vite';
import type { InlineConfig } from 'vitest/node';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

declare module 'vite' {
  interface UserConfig {
    test?: InlineConfig;
  }
}

/**
 * Local Vercel Serverless Function Emulation for Vite Dev Server
 * Intercepts /api/auth/* requests in development and executes the TypeScript
 * handlers in api/auth/* natively via Vite SSR module loader.
 */
function vercelApiDevPlugin(mode: string): Plugin {
  return {
    name: 'vercel-api-dev-middleware',
    apply: 'serve', // Strictly active in development server only, never in build
    configureServer(server) {
      process.env.PTV_AUTH_DEV_LAN_ENABLED = mode === 'staging' ? 'true' : 'false';
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        const freshEnv = loadEnv(mode, path.resolve(__dirname), '');
        for (const [k, v] of Object.entries(freshEnv)) {
          process.env[k] = v;
        }

        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:5174'}`);
        const pathname = urlObj.pathname;

        try {
          const subpath = pathname.replace(/^\/api\//, '');
          const targetTsFile = path.resolve(__dirname, `api/_routes/${subpath}.ts`);

          let handlerModule;
          if (fs.existsSync(targetTsFile)) {
            handlerModule = await server.ssrLoadModule(`/api/_routes/${subpath}.ts`);
          } else {
            handlerModule = await server.ssrLoadModule('/api/_router.ts');
          }

          if (handlerModule && typeof handlerModule.default === 'function') {
            await handlerModule.default(req, res);
            return;
          }
          next();
        } catch (err: any) {
          console.error('[VercelApiDevMiddleware Error]:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Terjadi kesalahan internal server saat memproses autentikasi.' }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables for the current mode (e.g. .env.staging)
  const env = loadEnv(mode, path.resolve(__dirname), '');
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }

  return {
    plugins: [react(), vercelApiDevPlugin(mode)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@core': path.resolve(__dirname, './src/core'),
        '@shared': path.resolve(__dirname, './src/shared'),
        '@products': path.resolve(__dirname, './src/products'),
        '@app': path.resolve(__dirname, './src/app'),
      },
    },
    server: {
      watch: {
        ignored: ['**/scratch/**', '**/.system_generated/**', '**/legacy/**'],
      },
    },
    test: {
      env: { AUTH_SECRET: 'ptvpro-secret-key-at-least-32-chars-long-123456' },
      globals: true,
      environment: 'node',
      include: ['tests/**/*.{test,spec}.?(c|m)[jt]s?(x)', 'src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/scratch/**', '**/.system_generated/**', '**/legacy/**'],
    },
  };
});
