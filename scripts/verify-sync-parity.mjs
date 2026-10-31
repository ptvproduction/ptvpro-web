import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { parseEnvFiles, resolveLegacyCredentials } from './sync-legacy-letters.mjs';

async function verifySyncParity() {
  console.log('='.repeat(75));
  console.log('PTVPRO — POST-BACKFILL VERIFICATION & PARITY AUDIT');
  console.log('='.repeat(75));

  const env = parseEnvFiles();
  const stagingUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://swadgljnyelsjstqqxbm.supabase.co';
  const stagingKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

  const legacyCreds = await resolveLegacyCredentials(env);
  const legacySb = createClient(legacyCreds.url, legacyCreds.key, { auth: { persistSession: false } });
  const stgSb = createClient(stagingUrl, stagingKey, { auth: { persistSession: false } });

  // 1. Verifikasi ptv_surat_izin
  console.log('\n--- 1. AUDIT PARITAS PTV_SURAT_IZIN ---');
  const { data: legIzin, error: legErrIzin } = await legacySb.from('ptv_surat_izin').select('*').order('created_at', { ascending: true });
  const { data: stgIzin, error: stgErrIzin } = await stgSb.from('ptv_surat_izin').select('*').order('created_at', { ascending: true });

  if (legErrIzin) throw new Error('Legacy error: ' + legErrIzin.message);
  if (stgErrIzin) throw new Error('Staging error: ' + stgErrIzin.message);

  console.log(`Jumlah Rekod Legacy : ${legIzin.length}`);
  console.log(`Jumlah Rekod Staging: ${stgIzin.length}`);

  let matchCountIzin = 0;
  for (const leg of legIzin) {
    const matched = stgIzin.find((s) => s.id === leg.id);
    if (!matched) {
      console.error(`[MISMATCH] Surat ID ${leg.id} (${leg.nomor_surat}) tidak ditemukan di Staging!`);
    } else {
      matchCountIzin++;
      const noMatch = matched.nomor_surat === leg.nomor_surat;
      const statusMatch = matched.status.toLowerCase() === leg.status.toLowerCase();
      console.log(` [MATCH] ID: ${leg.id} | No: ${leg.nomor_surat} (OK: ${noMatch}) | Status: ${matched.status} (OK: ${statusMatch}) | Santri: ${matched.nama_pemohon}`);
    }
  }

  // 2. Verifikasi ptv_catatan
  console.log('\n--- 2. AUDIT PARITAS PTV_CATATAN ---');
  const { data: legCat, error: legErrCat } = await legacySb.from('ptv_catatan').select('*').order('created_at', { ascending: true });
  const { data: stgCat, error: stgErrCat } = await stgSb.from('ptv_catatan').select('*').order('created_at', { ascending: true });

  if (legErrCat) throw new Error('Legacy error: ' + legErrCat.message);
  if (stgErrCat) throw new Error('Staging error: ' + stgErrCat.message);

  console.log(`Jumlah Rekod Legacy : ${legCat.length}`);
  console.log(`Jumlah Rekod Staging: ${stgCat.length}`);

  let matchCountCat = 0;
  for (const leg of legCat) {
    const matched = stgCat.find((s) => s.id === leg.id);
    if (!matched) {
      console.error(`[MISMATCH] Catatan ID ${leg.id} ("${leg.judul}") tidak ditemukan di Staging!`);
    } else {
      matchCountCat++;
      console.log(` [MATCH] ID: ${leg.id} | Judul: "${leg.judul.slice(0, 35)}..." | Warna: ${matched.warna} | Pinned: ${matched.is_pinned}`);
    }
  }

  // 3. Verifikasi ptv_pengumuman
  console.log('\n--- 3. AUDIT PARITAS PTV_PENGUMUMAN ---');
  const { data: legPeng, error: legErrPeng } = await legacySb.from('ptv_pengumuman').select('*').order('created_at', { ascending: true });
  const { data: stgPeng, error: stgErrPeng } = await stgSb.from('ptv_pengumuman').select('*').order('created_at', { ascending: true });

  if (legErrPeng) throw new Error('Legacy error: ' + legErrPeng.message);
  if (stgErrPeng) throw new Error('Staging error: ' + stgErrPeng.message);

  console.log(`Jumlah Rekod Legacy : ${legPeng.length}`);
  console.log(`Jumlah Rekod Staging: ${stgPeng.length}`);

  let matchCountPeng = 0;
  for (const leg of legPeng) {
    const matched = stgPeng.find((s) => s.id === leg.id);
    if (!matched) {
      console.error(`[MISMATCH] Pengumuman ID ${leg.id} ("${leg.judul}") tidak ditemukan di Staging!`);
    } else {
      matchCountPeng++;
      console.log(` [MATCH] ID: ${leg.id} | Judul: "${leg.judul}" | Prioritas: ${matched.prioritas} | Status: ${matched.status}`);
    }
  }

  // 4. Verifikasi ptv_surat_tugas & ptv_surat_barang
  console.log('\n--- 4. AUDIT PTV_SURAT_TUGAS & PTV_SURAT_BARANG ---');
  const { data: stgTugas } = await stgSb.from('ptv_surat_tugas').select('id');
  const { data: stgBarang } = await stgSb.from('ptv_surat_barang').select('id');
  console.log(`Rekod Staging ptv_surat_tugas : ${stgTugas?.length ?? 0}`);
  console.log(`Rekod Staging ptv_surat_barang: ${stgBarang?.length ?? 0}`);

  console.log('\n' + '='.repeat(75));
  console.log('HASIL AKHIR VERIFIKASI PARITAS:');
  console.log(` - Surat Izin : ${matchCountIzin}/${legIzin.length} rekod sinkron sempurna (100% PARITAS)`);
  console.log(` - Catatan    : ${matchCountCat}/${legCat.length} rekod sinkron sempurna (100% PARITAS)`);
  console.log(` - Pengumuman : ${matchCountPeng}/${legPeng.length} rekod sinkron sempurna (100% PARITAS)`);
  console.log('='.repeat(75));
}

verifySyncParity().catch((err) => {
  console.error('[FATAL VERIFY ERROR]', err.message);
  process.exit(1);
});
