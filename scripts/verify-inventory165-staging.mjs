import { createServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { createHmac, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { inventoryHostedFetch, inventoryHostedOrigin } from './lib/inventory-hosted-transport.mjs';

let phase = 'runtime';
let server; let db; let cookie = ''; let target; let reportId; let lostFoundId; let unitIds = []; let photoPath;
const marker = `PTV-DEV-165-FIXTURE-${randomUUID()}`;
const transactionId = `TRX-${randomUUID()}`;
const requestId = randomUUID();
const hostedOrigin = process.env.PTV_INVENTORY_HOSTED_ORIGIN;
const allowedHosted = [inventoryHostedOrigin];
if (hostedOrigin && !allowedHosted.includes(hostedOrigin)) throw new Error('Unreviewed hosted deployment rejected');
const origin = hostedOrigin || 'http://127.0.0.1:5174';
async function portalFetch(path, options = {}) {
  if (!hostedOrigin) return fetch(origin + path, options);
  return inventoryHostedFetch(path, options);
}
const report = (name, pass) => process.stdout.write(`${JSON.stringify({ check: name, pass })}\n`);
const assert = (condition) => { if (!condition) throw new Error('CHECK_FAILED'); };
const checkDb = (result) => { if (result.error) throw new Error('DATABASE_CHECK_FAILED'); return result.data; };
async function request(path, body, authenticated = true) {
  const result = await portalFetch(path, {
    method: body === undefined ? 'GET' : 'POST', headers: {
      ...(authenticated && cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { Origin: origin, 'Content-Type': 'application/json' } : {}),
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
  });
  return { status: result.status, body: await result.json(), result };
}
const inventory = (action, payload, read = false) => read
  ? request(`/api/inventaris?action=${action}&payload=${encodeURIComponent(JSON.stringify(payload || {}))}`)
  : request('/api/inventaris', { action, payload });

try {
  phase = 'explicit_test_opt_in';
  assert(process.env.PTV_RUN_INVENTORY_STAGING_TESTS === 'true');
  const identifier = process.env.PTV_TEST_LOGIN_IDENTIFIER;
  assert(typeof identifier === 'string' && identifier.trim());
  phase = 'runtime';
  server = await createServer({ mode: 'staging', server: { host: '127.0.0.1', port: 5174, strictPort: true }, logLevel: 'silent' });
  assert(server.config.mode === 'staging' && /^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/.test(process.env.VITE_SUPABASE_URL || ''));
  db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const account = checkDb(await db.from('user_account').select('id').eq('username', identifier).single());
  const digest = createHmac('sha256', process.env.AUTH_SECRET).update(`inventory:${account.id}:${requestId}`).digest('hex');
  target = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  assert(!checkDb(await db.from('ptv_inventaris').select('id').eq('id', target).maybeSingle()));
  if (!hostedOrigin) await server.listen();
  report(hostedOrigin ? 'hosted_preview_target_and_local_staging_assertions_verified' : 'runtime_staging_5174_project_verified', true);
  phase = 'anonymous'; assert((await request('/api/inventaris', undefined, false)).status === 401); report(phase, true);
  phase = 'private_credential_available';
  assert(process.env.SystemRoot);
  const readerEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([name]) => name.toLowerCase() !== 'psmodulepath')),
    PSModulePath: join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules') };
  const readerExecutable = join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const ps = spawnSync(readerExecutable, ['-NoProfile', '-File', fileURLToPath(new URL('./read-phase1-portal-private.ps1', import.meta.url)), '-AccountId', account.id], { encoding: 'utf8', windowsHide: true, env: readerEnv });
  if (ps.status !== 0 || !ps.stdout) {
    report('private_reader_launched', !ps.error);
    report('private_reader_exit_zero', ps.status === 0);
    report('private_reader_output_present', !!ps.stdout);
  }
  assert(ps.status === 0 && ps.stdout);
  phase = 'private_login';
  const login = await request('/api/auth/login', { identifier, password: ps.stdout }, false);
  ps.stdout = '';
  report(`private_login_http_${login.status}`, login.status === 200);
  assert(login.status === 200);
  cookie = login.result.headers.getSetCookie().map(value => value.split(';')[0]).filter(value => value.startsWith('ptv_hub_session=')).join('; ');
  assert(cookie); report('private_portal_login', true);
  if (hostedOrigin) {
    const portalCookie = login.result.headers.getSetCookie().find(value => value.startsWith('ptv_hub_session='));
    assert(/;\s*HttpOnly/i.test(portalCookie) && /;\s*Secure/i.test(portalCookie) && /;\s*SameSite=Lax/i.test(portalCookie) && /;\s*Path=\//i.test(portalCookie));
    const liveSession = await request('/api/auth/session');
    assert(liveSession.status === 200 && liveSession.body.authenticated === true);
    report('hosted_secure_httponly_cookie_and_live_session', true);
  }
  phase = 'catalog'; assert((await inventory('list', {}, true)).status === 200); report(phase, true);
  phase = 'foreign_photo_authorization';
  const denied = await inventory('create', {
    p_master: { id: randomUUID(), kode: 'INV-999999999', nama_alat: marker, kategori: 'Kamera',
      foto_url: `https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/inventory/catalog/portal/${randomUUID()}/${randomUUID()}.png` },
    p_units: [{ kode_unit: 'INV-999999999-U01', kondisi: 'bagus', status_peminjaman: 'tersedia' }],
  });
  assert(denied.status === 403); report('real_session_foreign_photo_denied_403', true);
  if (process.env.PTV_INVENTORY_REPORT_ONLY === 'true') {
    phase = 'report_fixture';
    const nextCode = (await inventory('next-code', {}, true)).body.data;
    const created = await inventory('create', { p_master: { id: requestId, request_id: requestId, kode: nextCode, nama_alat: marker, kategori: 'Kamera' },
      p_units: [{ kode_unit: `${nextCode}-U01`, kondisi: 'bagus', status_peminjaman: 'tersedia' }] });
    assert(created.status === 200 && created.body.data.id === target);
    const units = checkDb(await db.from('ptv_inventaris_unit').select('id,kode_unit').eq('inventaris_id', target));
    assert(units.length === 1); unitIds = units.map(unit => unit.id); reportId = randomUUID();
    phase = 'guarded_server_damage';
    assert((await request('/api/lapor-kerusakan', { action: 'create', id: reportId, payload: { assetId: target, unitId: unitIds[0],
      unitCode: units[0].kode_unit, unitNumber: 1, title: marker, description: 'Fixture170 guard', severity: 'Ringan' } })).status === 200);
    assert(checkDb(await db.from('ptv_lapor_masalah').select('unit_id').eq('id', reportId).single()).unit_id === unitIds[0]);
    assert((await request('/api/lapor-kerusakan', { action: 'update', id: reportId, payload: { status: 'Selesai', qcNotes: 'Fixture170' } })).status === 200);
    report('guarded_hosted_damage_qc', true);
    phase = 'shared_lostfound_compatibility'; lostFoundId = randomUUID();
    assert((await request('/api/lost-found', { action: 'create', id: lostFoundId, payload: { title: marker, type: 'temuan', location: 'Fixture170', description: 'Synthetic fixture', date: new Date().toISOString().slice(0, 10) } })).status === 200);
    assert(checkDb(await db.from('ptv_lost_found').select('nama_barang').eq('id', lostFoundId).single()).nama_barang === marker);
    assert((await request('/api/lost-found', { action: 'update', id: lostFoundId, payload: { status: 'Dikembalikan' } })).status === 200);
    assert((await request('/api/lost-found', { action: 'delete', id: lostFoundId, payload: {} })).status === 200);
    assert(!checkDb(await db.from('ptv_lost_found').select('id').eq('id', lostFoundId).maybeSingle()));
    lostFoundId = undefined;
    report('guarded_hosted_lostfound_create_update_delete', true);
  } else if (process.env.PTV_INVENTORY_VALUATION_ONLY === 'true') {
    phase = 'valuation_fixture';
    const nextCode = (await inventory('next-code', {}, true)).body.data;
    const created = await inventory('create', { p_master: { id: requestId, request_id: requestId, kode: nextCode, nama_alat: marker, kategori: 'Kamera' },
      p_units: [{ kode_unit: `${nextCode}-U01`, kondisi: 'bagus', status_peminjaman: 'tersedia' }] });
    assert(created.status === 200 && created.body.data.id === target);
    unitIds = checkDb(await db.from('ptv_inventaris_unit').select('id').eq('inventaris_id', target)).map(unit => unit.id);
    assert(unitIds.length === 1);
    phase = 'valuation_create';
    const firstPayload = { assetId: target, data: { nilai_perolehan: 100, nilai_tercatat: 0, nilai_residu: 0,
      vendor: 'SYNTHETIC_VENDOR_167', nomor_invoice: 'SYN-167-CREATE', sumber_perolehan: 'Fixture167', status: 'Aktif', catatan: 'Fixture167 create' } };
    const first = await inventory('valuation-save', firstPayload);
    assert(first.status === 200 && first.body.data.id); const valuationId = first.body.data.id;
    report('valuation_create_cloud', true);
    phase = 'valuation_update';
    const updatePayload = { assetId: target, data: { ...firstPayload.data, nilai_perolehan: 200,
      nomor_invoice: 'SYN-167-UPDATE', status: 'Dihapuskan', catatan: 'Fixture167 update' } };
    const update = await inventory('valuation-save', updatePayload);
    assert(update.status === 200 && update.body.data.id === valuationId); report('valuation_update_same_identity', true);
    phase = 'valuation_retry';
    const retry = await inventory('valuation-save', updatePayload);
    assert(retry.status === 200 && retry.body.data.id === valuationId);
    const values = checkDb(await db.from('ptv_nilai_inventaris').select('id,nilai_perolehan,nilai_buku_saat_ini,nilai_residu,vendor,nomor_invoice,sumber_perolehan,status,catatan_akuntansi').eq('inventaris_id', target));
    assert(values.length === 1 && values[0].id === valuationId && Number(values[0].nilai_perolehan) === 200
      && Number(values[0].nilai_buku_saat_ini) === 0 && Number(values[0].nilai_residu) === 0
      && values[0].vendor === updatePayload.data.vendor && values[0].nomor_invoice === updatePayload.data.nomor_invoice
      && values[0].sumber_perolehan === updatePayload.data.sumber_perolehan && values[0].status === updatePayload.data.status
      && values[0].catatan_akuntansi === updatePayload.data.catatan);
    report('valuation_retry_one_row_metadata_zero_preserved', true);
    const events = checkDb(await db.from('auth_audit_log').select('id').eq('event_type', 'inventory_valuation_save_confirmed')
      .contains('metadata', { account_id: account.id, entity_id: target }));
    assert(events.length === 3); report('valuation_three_requests_audit_append_preserved', true);
  } else if (process.env.PTV_INVENTORY_AUTHZ_ONLY !== 'true') {
  phase = 'upload';
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9ZkAAAAASUVORK5CYII=', 'base64');
  const upload = await portalFetch('/api/inventaris?action=upload', { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'image/png' }, body: image });
  const uploaded = await upload.json(); assert(upload.status === 200 && typeof uploaded.data === 'string');
  photoPath = uploaded.data.split('/storage/v1/object/public/inventory/')[1];
  assert(new RegExp(`^catalog/portal/${account.id}/[a-f0-9-]+[.]png$`).test(photoPath));
  report('storage_upload_persisted', true);
  if (hostedOrigin) {
    const media = await fetch(uploaded.data, { signal: AbortSignal.timeout(20000) });
    assert(media.status === 200 && Buffer.from(await media.arrayBuffer()).equals(image));
    report('public_media_bytes_preserved', true);
  }
  phase = 'create';
  const code = (await inventory('next-code', {}, true)).body.data; assert(typeof code === 'string');
  const args = { p_master: { id: requestId, request_id: requestId, kode: code, nama_alat: marker, kategori: 'Kamera', foto_url: uploaded.data },
    p_units: [1, 2].map(n => ({ kode_unit: `${code}-U0${n}`, kondisi: 'bagus', status_peminjaman: 'tersedia', lokasi_penyimpanan: 'Fixture165' })) };
  const created = await inventory('create', args); assert(created.status === 200 && created.body.data.id === target);
  const repeat = await inventory('create', args); assert(repeat.status === 200 && repeat.body.data.id === target);
  let detail = (await inventory('detail', { id: target }, true)).body.data;
  assert(detail?.units?.length === 2); unitIds = detail.units.map(unit => unit.id);
  assert(checkDb(await db.from('ptv_inventaris_unit').select('id').eq('inventaris_id', target)).length === 2);
  report('atomic_create_replay_two_units', true);
  phase = 'edit';
  const edited = await inventory('update', { p_master: { id: target, nama_alat: marker, kategori: 'Kamera', expected_updated_at: detail.updated_at },
    p_units: detail.units.map(unit => ({ id: unit.id, kode_unit: unit.kode_unit, nama_unit: 'Fixture165', kondisi: 'bagus', lokasi_penyimpanan: 'Fixture165' })) });
  assert(edited.status === 200); report('atomic_edit_units', true);
  phase = 'valuation';
  const valuation = await inventory('valuation-save', { assetId: target, data: { nilai_perolehan: 100, nilai_tercatat: 0 } });
  report(`valuation_http_${valuation.status}`, valuation.status === 200);
  if (valuation.body.code) report(`valuation_code_${String(valuation.body.code).replace(/[^A-Z0-9]/g, '').slice(0, 12)}`, false);
  if (valuation.status === 200) {
    const value = checkDb(await db.from('ptv_nilai_inventaris').select('nilai_buku_saat_ini').eq('inventaris_id', target).single());
    assert(Number(value.nilai_buku_saat_ini) === 0); report('valuation_persisted_zero', true);
  } else {
    // Valuation is independent of circulation; collect remaining evidence and still fail the run.
    process.exitCode = 1;
  }
  phase = 'checkout';
  const today = new Date().toISOString().slice(0, 10);
  const checkout = await request('/api/peminjaman', { operation: 'rpc_checkout_loan', args: { p_transaction_id: transactionId, p_borrower_name: marker,
    p_purpose: 'Fixture165', p_out_date: today, p_due_date: today, p_event_name: null, p_unit_ids: unitIds } });
  assert(checkout.status === 200 && checkout.body.success === true);
  const rows = checkDb(await db.from('ptv_peminjaman').select('id,unit_id').eq('transaction_id', transactionId));
  assert(rows.length === 2 && rows.every(row => unitIds.includes(row.unit_id)));
  detail = (await inventory('detail', { id: target }, true)).body.data;
  assert(detail.units.every(unit => unit.status_peminjaman === 'dipinjam')); report('checkout_unit_identity_persisted', true);
  phase = 'return_single';
  const returned = await request('/api/peminjaman', { operation: 'rpc_return_single_unit', args: { p_loan_row_id: rows[0].id, p_unit_id: rows[0].unit_id, p_condition_status: 'bagus', p_notes: 'Fixture165' } });
  assert(returned.status === 200);
  phase = 'return_rest';
  assert((await request('/api/peminjaman', { operation: 'rpc_return_loan', args: { p_transaction_id: transactionId, p_back_date: today, p_condition_status: 'bagus', p_notes: 'Fixture165' } })).status === 200);
  const history = (await request('/api/peminjaman')).body.loans.filter(row => row.transaction_id === transactionId);
  assert(history.length === 2 && history.every(row => row.status === 'dikembalikan' && unitIds.includes(row.unit_id)));
  report('single_and_remaining_return_history', true);
  phase = 'damage'; reportId = randomUUID();
  const damageUnit = detail.units.find(unit => unit.id === unitIds[0]); assert(damageUnit);
  const damage = await request('/api/lapor-kerusakan', { action: 'create', id: reportId, payload: { assetId: target, unitId: unitIds[0],
    unitCode: damageUnit.kode_unit, unitNumber: Number(damageUnit.kode_unit.match(/-U(\d+)$/)?.[1]) || 1, title: marker, description: 'Fixture165', severity: 'Ringan', photoUrl: uploaded.data } });
  report(`damage_http_${damage.status}`, damage.status === 200);
  assert(damage.status === 200);
  const unit = checkDb(await db.from('ptv_inventaris_unit').select('inventaris_id,kondisi,status_peminjaman').eq('id', unitIds[0]).single());
  assert(unit.inventaris_id === target && unit.kondisi === 'rusak' && unit.status_peminjaman === 'rusak');
  report('damage_unit_link_and_state', true);
  phase = 'qc';
  assert((await request('/api/lapor-kerusakan', { action: 'update', id: reportId, payload: { status: 'Selesai', qcNotes: 'Fixture165' } })).status === 200);
  report('damage_qc_confirmed', true);
  }
  phase = 'logout'; assert((await request('/api/auth/logout', {})).status === 200); cookie = ''; report(phase, true);
} catch {
  report(phase, false); process.exitCode = 1;
} finally {
  phase = 'cleanup';
  try {
    if (lostFoundId && cookie) {
      assert((await request('/api/lost-found', { action: 'delete', id: lostFoundId, payload: {} })).status === 200);
      lostFoundId = undefined;
    }
    if (cookie) { await request('/api/auth/logout', {}); cookie = ''; }
    if (db && target) {
      const item = checkDb(await db.from('ptv_inventaris').select('nama_alat').eq('id', target).maybeSingle());
      if (item) {
        assert(item.nama_alat === marker);
        if (reportId) checkDb(await db.from('ptv_lapor_masalah').delete().eq('id', reportId).in('unit_id', unitIds));
        checkDb(await db.from('ptv_peminjaman').delete().eq('transaction_id', transactionId).in('unit_id', unitIds));
        checkDb(await db.from('ptv_nilai_inventaris').delete().eq('inventaris_id', target));
        checkDb(await db.from('ptv_inventaris_unit').delete().eq('inventaris_id', target));
        checkDb(await db.from('ptv_inventaris').delete().eq('id', target).eq('nama_alat', marker));
        assert(!checkDb(await db.from('ptv_inventaris').select('id').eq('id', target).maybeSingle()));
      }
      if (photoPath) checkDb(await db.storage.from('inventory').remove([photoPath]));
    }
    report('fixture_cleanup', true);
  } catch { report('fixture_cleanup', false); process.exitCode = 1; }
  if (server) await server.close();
}
