import { readdirSync, readFileSync, writeFileSync, mkdirSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const root = resolve('.');
const output = resolve('.gemini/scratch/inventory170-preview');
assert(output.startsWith(root + '\\'));
const selected = [];
function collect(path) {
  const stat = lstatSync(path);
  assert(!stat.isSymbolicLink(), 'No links in deployment snapshot');
  if (stat.isDirectory()) {
    for (const name of readdirSync(path).sort()) collect(join(path, name));
  } else {
    assert(!/(^|[\\/])\.|backup|\.env|\.log$/i.test(path), 'Private or generated source rejected');
    selected.push(path.replaceAll('\\', '/'));
  }
}
for (const path of ['src', 'public', 'package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'tsconfig.node.json', 'vite.config.ts']) collect(path);
const files = selected.map(file => {
  const data = readFileSync(file);
  assert(!data.includes(Buffer.from('-----BEGIN PRIVATE KEY-----')), 'Private key excluded');
  return { file, data: data.toString('base64'), encoding: 'base64', sha256: createHash('sha256').update(data).digest('hex'), bytes: data.length };
});
const bundle = await build({ entryPoints: ['scripts/lib/inventory170-preview-gateway.ts'], bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external', write: false });
const config = JSON.stringify({ framework: 'vite', rewrites: [{ source: '/api/:path*', destination: '/api/gateway?__ptv_path=:path*' }, { source: '/((?!api/).*)', destination: '/index.html' }] });
for (const [file, data] of [['api/gateway.mjs', bundle.outputFiles[0].contents], ['vercel.json', Buffer.from(config)]]) {
  const bytes = Buffer.from(data);
  files.push({ file, data: bytes.toString('base64'), encoding: 'base64', sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });
}
mkdirSync(output, { recursive: true });
const transfer = JSON.stringify(files.map(({ file, data, encoding }) => ({ file, data, encoding })));
writeFileSync(join(output, 'files.json'), transfer);
const manifest = { session: 'PTV-DEV-170', target: 'preview', project: 'prj_U1Rtauj8BlOwusamXhsEKATqCYdM', supabaseProject: 'swadgljnyelsjstqqxbm',
  bytes: transfer.length, digest: createHash('sha256').update(transfer).digest('hex'),
  excluded: ['.env*', '.git', 'config', 'docs', 'scripts', 'tests', 'backups', 'reports', 'scratch', 'node_modules', 'dist'],
  files: files.map(({ data: _data, ...entry }) => entry) };
writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
process.stdout.write(JSON.stringify({ fileCount: files.length, bytes: transfer.length, digest: manifest.digest }) + '\n');
