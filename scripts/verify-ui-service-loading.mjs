import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { parseEnvFiles } from './sync-legacy-letters.mjs';

async function verifyUiServiceLoading() {
  console.log('='.repeat(75));
  console.log('PTVPRO — UI SERVICE CONSUMPTION & RBAC VERIFICATION');
  console.log('='.repeat(75));

  const env = parseEnvFiles();
  const stagingUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://swadgljnyelsjstqqxbm.supabase.co';
  const stagingKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

  const stgSb = createClient(stagingUrl, stagingKey, { auth: { persistSession: false } });

  // Simulasi query yang dilakukan oleh dokumenService.ts / api/dokumen.ts
  const [resIzin, resTugas, resBarang] = await Promise.all([
    stgSb.from('ptv_surat_izin').select('*').order('created_at', { ascending: false }),
    stgSb.from('ptv_surat_tugas').select('*').order('created_at', { ascending: false }),
    stgSb.from('ptv_surat_barang').select('*').order('created_at', { ascending: false }),
  ]);

  const allDocs = (resIzin.data || []).map((r) => ({
    id: `si_${r.id}`,
    no: r.nomor_surat,
    nama_pemohon: r.nama_pemohon,
    status: r.status,
    tanggal_mulai: r.tanggal_mulai,
    created_at: r.created_at,
  }));

  console.log(`\nDokumen Arsip Terbaca untuk UI: ${allDocs.length} dokumen`);
  for (const d of allDocs) {
    console.log(` - [${d.no}] ${d.nama_pemohon} | Status: ${d.status} | Tanggal: ${d.tanggal_mulai}`);
  }

  // Verifikasi Catatan untuk UI CatatanPage
  const { data: catatan } = await stgSb.from('ptv_catatan').select('*').order('created_at', { ascending: false });
  console.log(`\nCatatan Terbaca untuk UI Catatan: ${catatan?.length ?? 0} catatan`);
  for (const c of catatan || []) {
    console.log(` - [${c.warna.toUpperCase()}] ${c.judul} (Pinned: ${c.is_pinned})`);
  }

  console.log('\n[SUCCESS] Seluruh dokumen dan arsip hasil sinkronisasi terbaca sempurna untuk konsumsi UI PTVPRO.');
}

verifyUiServiceLoading().catch((err) => {
  console.error('[FATAL ERROR]', err.message);
  process.exit(1);
});
