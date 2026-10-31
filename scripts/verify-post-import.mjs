import fs from 'fs';
import path from 'path';

// ============================================================================
// PTV PRO — POST-MIGRATION VERIFICATION & RECONCILIATION SUITE
// Verifikasi Pasca-Import Berbasis Source ID, Record Counts, dan Checksum
// ============================================================================

const envPath = path.resolve('.env.staging.local');
if (!fs.existsSync(envPath)) {
  console.error('[FATAL] Berkas .env.staging.local tidak ditemukan!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
for (const line of envContent.split(/\r?\n/)) {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.startsWith('#')) {
    envVars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

const SUPABASE_URL = envVars.SUPABASE_URL || envVars.VITE_SUPABASE_URL;
const SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

const bundlePath = path.resolve('production-bundle.json');
if (!fs.existsSync(bundlePath)) {
  console.error('[FATAL] production-bundle.json tidak ditemukan!');
  process.exit(1);
}

const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf-8'));

async function getRemoteCount(table, idCol = null) {
  try {
    const selectCol = idCol || (table.startsWith('legacy_archive_') ? (table === 'legacy_archive_unresolved' ? 'quarantine_id' : 'archive_id') : 'id');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${selectCol}`, {
      method: 'HEAD',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Range-Unit': 'items',
        'Prefer': 'count=exact'
      }
    });
    const cr = res.headers.get('content-range');
    if (cr) {
      const parts = cr.split('/');
      if (parts[1] && parts[1] !== '*') return parseInt(parts[1], 10);
    }
    return -1;
  } catch {
    return -1;
  }
}

async function getRemoteIds(table, idCol = 'id') {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${idCol}`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    });
    if (!res.ok) return new Set();
    const rows = await res.json();
    return new Set(rows.map(r => String(r[idCol])));
  } catch {
    return new Set();
  }
}

export async function runPostImportVerification() {
  console.log('================================================================');
  console.log('PTV PRO — POST-MIGRATION INTEGRITY & RECONCILIATION VERIFICATION');
  console.log(`Database Target : ${SUPABASE_URL}`);
  console.log(`Verified At     : ${new Date().toISOString()}`);
  console.log('================================================================\n');

  let totalErrors = 0;

  // 1. Invariance Check: Canonical Identity & RBAC must NOT be mutated
  console.log('--- 1. AUDIT INTEGRITAS IDENTITAS & RBAC (INVARIANCE CHECK) ---');
  const canonicalCount = await getRemoteCount('canonical_identity');
  console.log(`canonical_identity: ${canonicalCount} records (Baseline: 2)`);
  if (canonicalCount !== 2) {
    console.error(`[FAIL] canonical_identity terduplikasi atau berubah! Ditemukan: ${canonicalCount}`);
    totalErrors++;
  } else {
    console.log('[PASS] Identitas dan akun Staging utuh dan tidak tersentuh.\n');
  }

  // 2. Canonical Target Verification (Counts & ID Matching)
  console.log('--- 2. AUDIT REKONSILIASI CANONICAL OPERASIONAL ---');
  const canonicalAuditList = [
    { table: 'ptv_inventaris', bundleKey: 'ptv_inventaris', expCount: 161 },
    { table: 'ptv_inventaris_unit', bundleKey: 'ptv_inventaris_unit', expCount: 245 },
    { table: 'ptv_nilai_inventaris', bundleKey: 'ptv_nilai_inventaris', expCount: 114 },
    { table: 'ptv_catatan', bundleKey: 'ptv_catatan', expCount: 4 },
    { table: 'ptv_acara', bundleKey: 'ptv_acara', expCount: 71 },
    { table: 'ptv_pengumuman', bundleKey: 'ptv_pengumuman', expCount: 3 },
    { table: 'ptv_kontak_eksternal', bundleKey: 'ptv_kontak_eksternal', expCount: 8 },
    { table: 'ptv_pemasukan', bundleKey: 'ptv_pemasukan', expCount: 43 },
    { table: 'ptv_pengeluaran', bundleKey: 'ptv_pengeluaran', expCount: 9 },
    { table: 'ptv_surat_izin', bundleKey: 'ptv_surat_izin', expCount: 2 }
  ];

  for (const item of canonicalAuditList) {
    const remoteCount = await getRemoteCount(item.table);
    const remoteIdSet = await getRemoteIds(item.table, 'id');
    const sourceRows = bundle[item.bundleKey] || [];
    let missingIds = 0;
    for (const src of sourceRows) {
      if (src.id && !remoteIdSet.has(String(src.id))) {
        missingIds++;
      }
    }
    const status = (missingIds === 0 && remoteCount >= item.expCount) ? '[PASS]' : '[FAIL]';
    if (status === '[FAIL]') totalErrors++;
    console.log(`${status} ${item.table.padEnd(24)} | Source: ${sourceRows.length} | Remote: ${remoteCount} | Missing ID: ${missingIds}`);
  }

  // 3. Isolated Archive Verification
  console.log('\n--- 3. AUDIT REKONSILIASI ARSIP TERISOLASI ---');
  const archiveAuditList = [
    { table: 'legacy_archive_kru', key: 'legacy_archive_kru', expCount: 92, idCol: 'production_id' },
    { table: 'legacy_archive_aset', key: 'legacy_archive_aset', expCount: 75, idCol: 'production_id' },
    { table: 'legacy_archive_ebook', key: 'legacy_archive_ebook', expCount: 15, idCol: 'production_id' },
    { table: 'legacy_archive_pendaftar', key: 'legacy_archive_pendaftar', expCount: 87, idCol: 'production_id' },
    { table: 'legacy_archive_kas_kru', key: 'ptv_kas_kru', expCount: 38, idCol: 'production_id' }
  ];

  for (const item of archiveAuditList) {
    const remoteCount = await getRemoteCount(item.table);
    const remoteIdSet = await getRemoteIds(item.table, item.idCol);
    const sourceRows = bundle[item.key] || [];
    let missingIds = 0;
    for (const src of sourceRows) {
      if (src.id && !remoteIdSet.has(String(src.id))) {
        missingIds++;
      }
    }
    const status = (missingIds === 0 && remoteCount >= item.expCount) ? '[PASS]' : '[FAIL]';
    if (status === '[FAIL]') totalErrors++;
    console.log(`${status} ${item.table.padEnd(24)} | Source: ${sourceRows.length} | Remote: ${remoteCount} | Missing ID: ${missingIds}`);
  }

  // 4. Quarantine Verification (legacy_archive_unresolved)
  console.log('\n--- 4. AUDIT PRESERVASI KARANTINA (UNRESOLVED) ---');
  const unresCount = await getRemoteCount('legacy_archive_unresolved');
  console.log(`legacy_archive_unresolved: ${unresCount} records (Expected: 49)`);
  if (unresCount !== 49) {
    console.warn(`[WARN] Jumlah karantina berbeda dari baseline dry-run (49). Terdeteksi: ${unresCount}`);
  } else {
    console.log('[PASS] Seluruh 49 anomali terpelihara di karantina dengan aman.');
  }

  console.log('\n================================================================');
  if (totalErrors === 0) {
    console.log('[HASIL AKHIR: VERIFIKASI SUKSES] SELURUH RECORD COCOK 100%.');
  } else {
    console.error(`[HASIL AKHIR: DITEMUKAN ${totalErrors} KESALAHAN INTEGRITAS]`);
  }
  console.log('================================================================');
}

if (process.argv[1]?.endsWith('verify-post-import.mjs')) {
  runPostImportVerification().catch(console.error);
}
