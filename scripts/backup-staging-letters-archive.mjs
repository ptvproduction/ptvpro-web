import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { parseEnvFiles, resolveLegacyCredentials } from './sync-legacy-letters.mjs';

async function performPreSyncBackup() {
  console.log('='.repeat(75));
  console.log('PTVPRO — PRE-SYNC SNAPSHOT & BACKUP (TARGET: STAGING)');
  console.log('='.repeat(75));

  const env = parseEnvFiles();
  const stagingUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://swadgljnyelsjstqqxbm.supabase.co';
  const stagingKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

  if (!stagingUrl || !stagingKey) {
    throw new Error('Kredensial Supabase Staging tidak ditemukan di file env.');
  }

  // Hard safety check
  if (stagingUrl.includes('jthzuhkblxcaohiuypqq')) {
    throw new Error('FATAL SAFETY VIOLATION: Target staging menunjuk ke legacy!');
  }

  const legacyCreds = await resolveLegacyCredentials(env);
  if (!legacyCreds.url || !legacyCreds.key) {
    throw new Error('Kredensial Supabase Legacy tidak ditemukan.');
  }

  // Tes koneksi Legacy (Read-only)
  const legacySb = createClient(legacyCreds.url, legacyCreds.key, { auth: { persistSession: false } });
  const { data: legIzin, error: legErr } = await legacySb.from('ptv_surat_izin').select('id, nomor_surat').limit(1);
  if (legErr) {
    throw new Error(`Koneksi ke Supabase Legacy GAGAL: ${legErr.message}`);
  }
  console.log('[OK] Koneksi Supabase Legacy (jthzuhkblxcaohiuypqq) terverifikasi aktif (Strict Read-Only).');

  // Tes koneksi Staging & Ambil data snapshot
  const stgSb = createClient(stagingUrl, stagingKey, { auth: { persistSession: false } });
  const targetTables = ['ptv_surat_izin', 'ptv_surat_tugas', 'ptv_surat_barang', 'ptv_catatan', 'ptv_pengumuman'];

  const snapshot = {
    timestamp: new Date().toISOString(),
    staging_url: stagingUrl,
    tables: {},
  };

  for (const tbl of targetTables) {
    const { data, error } = await stgSb.from(tbl).select('*');
    if (error) {
      throw new Error(`Gagal membaca tabel target '${tbl}' dari Staging: ${error.message}`);
    }
    snapshot.tables[tbl] = data || [];
    console.log(`[SNAPSHOT] Tabel '${tbl}': ${snapshot.tables[tbl].length} baris eksisting di Staging.`);
  }

  const backupDir = path.resolve(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.resolve(backupDir, `staging-pre-sync-snapshot-${timestampStr}.json`);

  fs.writeFileSync(backupFilePath, JSON.stringify(snapshot, null, 2), 'utf8');

  // Verifikasi restorabilitas file backup
  const readBack = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
  for (const tbl of targetTables) {
    if (!Array.isArray(readBack.tables[tbl])) {
      throw new Error(`Verifikasi backup gagal: tabel '${tbl}' rusak pada file backup.`);
    }
  }

  console.log(`\n[SUCCESS] Backup Staging tersimpan dan terverifikasi di:`);
  console.log(` -> ${backupFilePath}`);
  console.log('='.repeat(75));

  return backupFilePath;
}

if (process.argv[1] && process.argv[1].endsWith('backup-staging-letters-archive.mjs')) {
  performPreSyncBackup().catch((err) => {
    console.error('[FATAL BACKUP ERROR]', err.message);
    process.exit(1);
  });
}
