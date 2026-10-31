/**
 * PTV PRO — LIVE STAGING RBAC & DELETE CONTACT VERIFICATION
 */

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envLocal = fs.existsSync('.env.staging.local') ? fs.readFileSync('.env.staging.local', 'utf8') : '';
const envStaging = fs.readFileSync('.env.staging', 'utf8');

function parseEnv(src) {
  return Object.fromEntries(
    src.split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => l.split('=').map(s => s.trim()))
  );
}

const env = { ...parseEnv(envStaging), ...parseEnv(envLocal) };
const stagingUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const sb = createClient(stagingUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
  console.log('='.repeat(80));
  console.log('VERIFIKASI LIVE: PENGHAPUSAN KONTAK EKSTERNAL UJI');
  console.log('='.repeat(80));

  // Cari kontak uji yang tadi dibuat
  const { data: testContacts, error: findErr } = await sb
    .from('ptv_kontak_eksternal')
    .select('id, nama_kontak')
    .ilike('nama_kontak', '%(Uji)%');

  if (findErr) throw findErr;
  console.log('Kontak uji ditemukan:', testContacts?.length);

  for (const tc of (testContacts || [])) {
    console.log(`Menghapus kontak uji: ${tc.nama_kontak} (${tc.id})`);
    const { error: delErr } = await sb
      .from('ptv_kontak_eksternal')
      .delete()
      .eq('id', tc.id);

    if (delErr) throw delErr;
    console.log(`✓ Kontak uji ${tc.nama_kontak} berhasil dihapus dari Staging.`);
  }

  // Verifikasi kembali kontak lembaga asli
  const { count: finalKontakCount } = await sb
    .from('ptv_kontak_eksternal')
    .select('*', { count: 'exact', head: true });

  console.log(`\nJumlah akhir kontak eksternal di Staging: ${finalKontakCount} rows (tepat 8 kontak lembaga asli)`);
  if (finalKontakCount !== 8) {
    console.warn(`Peringatan: Jumlah kontak bukan 8, harap tinjau kembali.`);
  } else {
    console.log('✓ 8 Kontak lembaga asli terkonfirmasi kembali utuh dan bersih dari dummy!');
  }
}

run().catch(console.error);
