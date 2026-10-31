import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function getEnv() {
  const env = {};
  for (const f of ['.env.staging.local', '.env.local', '.env.staging', '.env']) {
    if (fs.existsSync(f)) {
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      for (const line of lines) {
        const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (m) {
          let v = (m[2] || '').trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          if (!env[m[1]]) env[m[1]] = v;
        }
      }
    }
  }
  return env;
}

const env = getEnv();
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const client = createClient(url, key, { auth: { persistSession: false } });

async function snapshotPreflight() {
  console.log('=== AUDIT INVENTARISASI STAGING LENGKAP ===');
  
  // 1. Audit semua nomor surat di semua tabel
  console.log('\n--- 1. AUDIT SEMUA TABEL PERSURATAN ---');
  const { data: siAll } = await client.from('ptv_surat_izin').select('id, nomor_surat, status, created_at, diajukan_oleh, disetujui_oleh');
  console.log('ptv_surat_izin rows:', siAll?.length);
  for (const r of (siAll || [])) {
    console.log(`  SI: id=${r.id}, no=${r.nomor_surat}, status=${r.status}`);
  }

  const { data: stAll } = await client.from('ptv_surat_tugas').select('id, nomor_surat, status, created_at, diajukan_oleh, disetujui_oleh');
  console.log('ptv_surat_tugas rows:', stAll?.length);
  for (const r of (stAll || [])) {
    console.log(`  ST: id=${r.id}, no=${r.nomor_surat}, status=${r.status}`);
  }

  const { data: sbbAll } = await client.from('ptv_surat_barang').select('id, nomor_surat, status, created_at, diajukan_oleh, disetujui_oleh');
  console.log('ptv_surat_barang rows:', sbbAll?.length);
  for (const r of (sbbAll || [])) {
    console.log(`  SBB: id=${r.id}, no=${r.nomor_surat}, status=${r.status}`);
  }

  // 2. Audit ptv_notifications
  console.log('\n--- 2. AUDIT NOTIFIKASI EXISTING ---');
  const { data: notifAll, error: notifErr } = await client.from('ptv_notifications').select('*');
  console.log('ptv_notifications existing count:', notifAll?.length, 'error:', notifErr?.message || 'none');
  for (const n of (notifAll || [])) {
    console.log(`  Notif ID=${n.id}, tipe=${n.tipe}, judul=${n.judul}`);
  }
}

snapshotPreflight().catch(console.error);
