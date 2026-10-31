const esbuild = require('esbuild');
const path = require('path');

async function bundleApi() {
  console.log('[bundle-api] Bundling universal serverless router into api/index.js...');
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, '../api/_router.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outfile: path.resolve(__dirname, '../api/index.js'),
    external: [
      '@supabase/supabase-js',
      'bcryptjs',
      'pdf-lib',
      '@pdf-lib/fontkit',
      'xlsx',
      'zod',
      'qrcode',
      'html-to-image',
    ],
  });
  console.log('[bundle-api] Successfully bundled api/index.js');
}

bundleApi().catch((err) => {
  console.error('[bundle-api] Build failed:', err);
  process.exit(1);
});
