import { createServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { inventoryHostedFetch, inventoryHostedOrigin } from './lib/inventory-hosted-transport.mjs';

assert(process.env.PTV_RUN_INVENTORY171 === 'true', 'Explicit opt-in required');
const runId = randomUUID(); const marker = `PTV-DEV-171-FIXTURE-${runId}`; const transaction = `TRX-${runId}`;
const checks = []; let phase = 'environment'; let server; let db; let rootCookie; let testerCookie; let rootProof; let tester; let asset; let units = []; let reportId; let loanId; let provisionAttempted = false;
let completed = false; let retired = false; let cleaned = false;
const check = (label, value) => { assert(value, label); checks.push(label); process.stdout.write(JSON.stringify({ check: label, pass: true }) + '\n'); };
const good = r => { assert(!r.error, 'DATABASE_OPERATION_REJECTED'); return r.data; };
async function request(path, body, cookie) {
  const result = await inventoryHostedFetch(path, { method: body === undefined ? 'GET' : 'POST', headers: {
    ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { Origin: inventoryHostedOrigin, 'Content-Type': 'application/json' } : {}),
  }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: result.status, body: await result.json(), response: result };
}
const inv = (action, payload = {}, cookie = testerCookie, read = false) => read
  ? request(`/api/inventaris?action=${action}&payload=${encodeURIComponent(JSON.stringify(payload))}`, undefined, cookie)
  : request('/api/inventaris', { action, payload }, cookie);
const manage = async action => good(await db.rpc('rpc_inventory_test171', { p_root: rootProof, p_run: runId, p_action: action }));
function cookieOf(result) { return result.response.headers.getSetCookie().find(v => v.startsWith('ptv_hub_session=')).split(';')[0]; }
async function digest() {
  const queries = [db.from('ptv_inventaris').select('*').eq('id', asset), db.from('ptv_inventaris_unit').select('*').eq('inventaris_id', asset).order('id'),
    db.from('ptv_nilai_inventaris').select('*').eq('inventaris_id', asset), db.from('ptv_peminjaman').select('*').eq('transaction_id', transaction).order('id'), db.from('ptv_lapor_masalah').select('*').eq('id', reportId)];
  const rows = await Promise.all(queries); return createHash('sha256').update(JSON.stringify(rows.map(good))).digest('hex');
}
try {
  server = await createServer({ mode: 'staging', logLevel: 'silent' });
  assert(process.env.VITE_SUPABASE_URL === 'https://swadgljnyelsjstqqxbm.supabase.co');
  db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { verifySessionToken } = await server.ssrLoadModule('/api/auth/_utils/crypto.ts');
  const { sessionArguments } = await server.ssrLoadModule('/api/auth/_utils/portalLifecycle.ts');
  phase = 'root_authorization';
  const rootAccount = good(await db.from('user_account').select('id').eq('username', 'jid').single());
  const readerEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toLowerCase() !== 'psmodulepath')), PSModulePath: join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules') };
  const privateResult = spawnSync(join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-File', fileURLToPath(new URL('./read-phase1-portal-private.ps1', import.meta.url)), '-AccountId', rootAccount.id], { encoding: 'utf8', windowsHide: true, env: readerEnv });
  assert(privateResult.status === 0 && privateResult.stdout);
  const rootLogin = await request('/api/auth/login', { identifier: 'jid', password: privateResult.stdout }); privateResult.stdout = '';
  assert(rootLogin.status === 200); rootCookie = cookieOf(rootLogin);
  const rootSession = verifySessionToken(decodeURIComponent(rootCookie.slice(rootCookie.indexOf('=') + 1)), process.env.AUTH_SECRET);
  assert(rootSession?.account_id === rootAccount.id && rootSession.assigned_profiles.includes('root_executive'));
  rootProof = sessionArguments(rootSession);
  phase = 'root_fixture';
  const code = (await inv('next-code', {}, rootCookie, true)).body.data;
  const created = await inv('create', { p_master: { id: randomUUID(), kode: code, nama_alat: marker, kategori: 'Kamera' }, p_units: [1, 2, 3].map(i => ({ kode_unit: `${code}-U0${i}`, kondisi: 'bagus', status_peminjaman: 'tersedia' })) }, rootCookie);
  assert(created.status === 200); asset = created.body.data.id;
  units = good(await db.from('ptv_inventaris_unit').select('id,kode_unit').eq('inventaris_id', asset).order('kode_unit'));
  assert(units.length === 3); reportId = randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  assert((await request('/api/peminjaman', { operation: 'rpc_checkout_loan', args: { p_transaction_id: transaction, p_borrower_name: marker, p_purpose: 'Fixture171', p_out_date: today, p_due_date: today, p_unit_ids: [units[1].id] } }, rootCookie)).status === 200);
  loanId = good(await db.from('ptv_peminjaman').select('id').eq('transaction_id', transaction).single()).id;
  assert((await request('/api/lapor-kerusakan', { action: 'create', id: reportId, payload: { assetId: asset, unitId: units[2].id, unitCode: units[2].kode_unit, unitNumber: 3, title: marker, severity: 'Ringan', description: 'Fixture171' } }, rootCookie)).status === 200);
  const initial = await digest();
  phase = 'provision'; provisionAttempted = true; tester = await manage('provision');
  assert(tester.password && tester.account_id !== rootAccount.id);
  const login = await request('/api/auth/login', { identifier: tester.username, password: tester.password }); tester.password = undefined;
  assert(login.status === 200); testerCookie = cookieOf(login);
  const testerSession = verifySessionToken(decodeURIComponent(testerCookie.slice(testerCookie.indexOf('=') + 1)), process.env.AUTH_SECRET);
  assert(testerSession?.account_id === tester.account_id);
  const unauthorized = await db.rpc('rpc_inventory_test171', { p_root: sessionArguments(testerSession), p_run: runId, p_action: 'read-phase' });
  check('valid limited session cannot administer tester', unauthorized.error?.code === '42501');
  phase = 'phase_A';
  for (const [label, path] of [['inventory.view', '/api/inventaris'], ['valuation.view', '/api/inventaris?action=valuations'], ['loans.view', '/api/peminjaman'], ['damage.view', '/api/lapor-kerusakan']]) check(`phase A ${label} denied403`, (await request(path, undefined, testerCookie)).status === 403);
  phase = 'phase_B'; await manage('read-phase');
  for (const path of ['/api/inventaris', '/api/inventaris?action=valuations', '/api/peminjaman', '/api/lapor-kerusakan']) check(`phase B read ${path}200`, (await request(path, undefined, testerCookie)).status === 200);
  const cases = [
    ['next-code', () => inv('next-code', {}, testerCookie, true)],
    ['create', () => inv('create', { p_master: { id: randomUUID(), kode: 'INV-999999', nama_alat: marker, kategori: 'Kamera' }, p_units: [] })],
    ['edit', () => inv('update', { p_master: { id: asset, nama_alat: marker, kategori: 'Kamera' }, p_units: [] })],
    ['unit-status', () => inv('unit-status', { unitId: units[0].id, status: 'dipinjam' })],
    ['valuation-save', () => inv('valuation-save', { assetId: asset, data: { nilai_perolehan: 100 } })],
    ['valuation-delete', () => inv('valuation-delete', { assetId: asset })],
    ['checkout', () => request('/api/peminjaman', { operation: 'rpc_checkout_loan', args: { p_transaction_id: `DENIED-${runId}`, p_borrower_name: marker, p_purpose: 'Denied fixture', p_out_date: today, p_due_date: today, p_unit_ids: [units[0].id] } }, testerCookie)],
    ['return', () => request('/api/peminjaman', { operation: 'rpc_return_loan', args: { p_transaction_id: transaction, p_back_date: today, p_condition_status: 'bagus' } }, testerCookie)],
    ['single-return', () => request('/api/peminjaman', { operation: 'rpc_return_single_unit', args: { p_loan_row_id: loanId, p_unit_id: units[1].id, p_condition_status: 'bagus' } }, testerCookie)],
    ['damage', () => request('/api/lapor-kerusakan', { action: 'create', id: randomUUID(), payload: { assetId: asset, unitId: units[0].id, unitCode: units[0].kode_unit, unitNumber: 1, title: marker, severity: 'Ringan' } }, testerCookie)],
    ['QC', () => request('/api/lapor-kerusakan', { action: 'update', id: reportId, payload: { status: 'Selesai', qcNotes: 'Must not persist' } }, testerCookie)],
  ];
  for (const [label, action] of cases) check(`phase B ${label} denied403`, (await action()).status === 403);
  const upload = await inventoryHostedFetch('/api/inventaris?action=upload', { method: 'POST', headers: { Cookie: testerCookie, Origin: inventoryHostedOrigin, 'Content-Type': 'image/png' }, body: Buffer.from([137,80,78,71,13,10,26,10]) });
  check('phase B upload denied403', upload.status === 403);
  check('denied operations preserve fixture rows', await digest() === initial);
  check('denied upload creates no object', (await manage('status')).uploaded_objects === 0);
  completed = true;
} catch { process.stdout.write(JSON.stringify({ phase, pass: false }) + '\n'); process.exitCode = 1; }
finally {
  try {
    if (testerCookie) await request('/api/auth/logout', {}, testerCookie);
    if (provisionAttempted) {
      const state = await manage('retire'); retired = state.status === 'inactive' && state.active_sessions === 0 && state.credential_present === false;
      check('tester disabled; credential removed; no active sessions', retired);
      if (testerCookie) check('retired cookie cannot access data', [401,403].includes((await request('/api/inventaris', undefined, testerCookie)).status));
    } else retired = true;
  } catch { process.stdout.write(JSON.stringify({ phase: 'retirement', pass: false }) + '\n'); process.exitCode = 1; }
  try {
    if (asset) {
      assert(good(await db.from('ptv_inventaris').select('nama_alat').eq('id', asset).single()).nama_alat === marker);
      if (reportId) good(await db.from('ptv_lapor_masalah').delete().eq('id', reportId).in('unit_id', units.map(u => u.id)));
      good(await db.from('ptv_peminjaman').delete().eq('transaction_id', transaction).in('unit_id', units.map(u => u.id)));
      good(await db.from('ptv_nilai_inventaris').delete().eq('inventaris_id', asset));
      good(await db.from('ptv_inventaris_unit').delete().eq('inventaris_id', asset));
      good(await db.from('ptv_inventaris').delete().eq('id', asset).eq('nama_alat', marker));
    }
    cleaned = true;
  } catch { process.stdout.write(JSON.stringify({ phase: 'fixture_cleanup', pass: false }) + '\n'); process.exitCode = 1; }
  try { if (rootCookie) await request('/api/auth/logout', {}, rootCookie); }
  catch { process.stdout.write(JSON.stringify({ phase: 'root_logout', pass: false }) + '\n'); process.exitCode = 1; }
  if (server) await server.close();
  const result = { session: 'PTV-DEV-171', runId, hostedOrigin: inventoryHostedOrigin, status: completed && retired && cleaned ? 'PASS' : 'FAIL', checks, checksPassed: checks.length, testerAccountId: tester?.account_id, retired, cleaned, secretsPrinted: false };
  writeFileSync('docs/PTVPRO-INVENTORY-171-NEGATIVE-RESULTS.json', JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ status: result.status, checksPassed: checks.length, retired, cleaned }) + '\n');
}
