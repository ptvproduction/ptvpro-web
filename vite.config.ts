/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.?(c|m)[jt]s?(x)', 'src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/scratch/**', '**/.system_generated/**', '**/legacy/**'],
  },
});
