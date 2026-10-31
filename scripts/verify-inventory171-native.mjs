import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

assert(process.env.PTV_RUN_INVENTORY171_NATIVE === 'true');
const env = loadEnv('staging', process.cwd(), '');
assert(env.VITE_SUPABASE_URL === 'https://swadgljnyelsjstqqxbm.supabase.co');
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const checks = [];
for (const table of ['ptv_inventaris', 'ptv_inventaris_unit', 'ptv_nilai_inventaris', 'ptv_peminjaman', 'ptv_lapor_masalah']) {
  const r = await client.from(table).select('id').limit(1);
  checks.push({ table, status: r.status, pass: !!r.error && r.error.code === '42501' });
}
const list = await client.storage.from('inventory').list('', { limit: 1 });
checks.push({ operation: 'storage metadata', pass: !!list.error || Array.isArray(list.data) && list.data.length === 0 });
const path = `security171-native-denied/${randomUUID()}.png`;
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9ZkAAAAASUVORK5CYII=', 'base64');
const uploaded = await client.storage.from('inventory').upload(path, image, { contentType: 'image/png', upsert: false });
checks.push({ operation: 'storage native upload', pass: !!uploaded.error });
if (!uploaded.error) {
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  assert(!(await admin.storage.from('inventory').remove([path])).error, 'Own unexpected fixture cleanup failed');
}
const result = { session: 'PTV-DEV-171', scope: 'CLOUD_STAGING_NATIVE_ANONYMOUS_POST_CUTOVER', status: checks.every(c => c.pass) ? 'PASS' : 'FAIL', checks, credentialOrDataPrinted: false };
writeFileSync('docs/PTVPRO-INVENTORY-171-NATIVE-RESULTS.json', JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify(result) + '\n');
if (result.status !== 'PASS') process.exitCode = 1;
