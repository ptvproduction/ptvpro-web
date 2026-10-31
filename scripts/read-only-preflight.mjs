import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Read .env.staging and .env
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

console.log('Target URL:', url);
console.log('Using Key:', key ? `${key.slice(0, 15)}... (len ${key.length})` : 'none');

const client = createClient(url, key, { auth: { persistSession: false } });

async function runReadOnlyPreflight() {
  console.log('\n--- 1. INSPEKSI DOKUMEN PERSURATAN (STAGING) ---');
  
  // 1.1 ptv_surat_izin
  const { data: izin, error: errIzin } = await client.from('ptv_surat_izin').select('*');
  console.log('ptv_surat_izin count:', izin ? izin.length : 0, 'error:', errIzin?.message || 'none');
  if (izin && izin.length > 0) {
    console.log('ptv_surat_izin all records:');
    for (const r of izin) {
      console.log(` - ID: ${r.id} | Nomor: ${r.nomor_surat} | Status: ${r.status} | Pemohon/Santri: ${r.nama_santri || r.nama_pemohon} | Tanggal: ${r.tanggal_mulai} | DiajukanOleh: ${r.diajukan_oleh}`);
    }
  }

  // 1.2 ptv_surat_tugas
  const { data: tugas, error: errTugas } = await client.from('ptv_surat_tugas').select('*');
  console.log('ptv_surat_tugas count:', tugas ? tugas.length : 0, 'error:', errTugas?.message || 'none');
  if (tugas && tugas.length > 0) {
    console.log('ptv_surat_tugas all records:');
    for (const r of tugas) {
      console.log(` - ID: ${r.id} | Nomor: ${r.nomor_surat || r.no} | Status: ${r.status} | Perihal: ${r.perihal} | Tanggal: ${r.tanggal_tugas} | DiajukanOleh: ${r.diajukan_oleh}`);
    }
  }

  // 1.3 ptv_surat_barang
  const { data: barang, error: errBarang } = await client.from('ptv_surat_barang').select('*');
  console.log('ptv_surat_barang count:', barang ? barang.length : 0, 'error:', errBarang?.message || 'none');
  if (barang && barang.length > 0) {
    console.log('ptv_surat_barang all records:');
    for (const r of barang) {
      console.log(` - ID: ${r.id} | Nomor: ${r.nomor_surat || r.no} | Status: ${r.status} | Pembawa: ${r.nama_pembawa} | DiajukanOleh: ${r.diajukan_oleh}`);
    }
  }

  console.log('\n--- 2. INSPEKSI NOTIFIKASI (STAGING) ---');
  // 2.1 ptv_notifications
  const { data: notifs, error: errNotifs } = await client.from('ptv_notifications').select('*').limit(20);
  console.log('ptv_notifications count:', notifs ? notifs.length : 0, 'error:', errNotifs?.message || 'none');
  if (notifs && notifs.length > 0) {
    console.log('ptv_notifications sample records:');
    for (const n of notifs) {
      console.log(` - ID: ${n.id} | Tipe: ${n.tipe} | Judul: ${n.judul} | TargetRole: ${n.target_role} | IsRead: ${n.is_read}`);
    }
  }

  // Check columns via error or probe
  const { data: notifCols, error: errCols } = await client.from('ptv_notifications').select('recipient_identity_id, recipient_ptv_id, idempotency_key, action_url, entity_type, entity_id, is_protected').limit(1);
  if (errCols) {
    console.log('Probe draft columns in ptv_notifications -> STATUS: NOT YET ADDED (Expected - DDL belum jalan):', errCols.message);
  } else {
    console.log('Draft columns already exist in ptv_notifications!');
  }

  console.log('\n--- 3. INSPEKSI IDENTITAS KANONIKAL & AKUN ---');
  const { data: identities, error: errIdent } = await client.from('canonical_identity').select('id, ptv_id, full_name, status_organisasi').limit(5);
  console.log('canonical_identity sample count:', identities ? identities.length : 0, 'error:', errIdent?.message || 'none');
  if (identities) {
    for (const idn of identities) {
      console.log(` - ${idn.ptv_id}: ${idn.full_name} (${idn.status_organisasi}) [UUID: ${idn.id}]`);
    }
  }

  console.log('\n--- 4. CEK DUPLIKASI & BASELINE SEQUENCE ---');
  const allNumbers = [
    ...(izin || []).map(r => ({ table: 'ptv_surat_izin', no: r.nomor_surat, id: r.id })),
    ...(tugas || []).map(r => ({ table: 'ptv_surat_tugas', no: r.no || r.nomor_surat, id: r.id })),
    ...(barang || []).map(r => ({ table: 'ptv_surat_barang', no: r.no || r.nomor_surat, id: r.id })),
  ];
  console.log('Total surat tersimpan di database Staging:', allNumbers.length);
  const seen = {};
  const duplicates = [];
  for (const item of allNumbers) {
    if (item.no) {
      if (seen[item.no]) {
        duplicates.push({ no: item.no, tables: [seen[item.no], item.table] });
      } else {
        seen[item.no] = item.table;
      }
    }
  }
  console.log('Duplikasi nomor surat di Staging:', duplicates.length > 0 ? duplicates : '0 DUPLIKAT (Aman)');
}

runReadOnlyPreflight().catch(console.error);
