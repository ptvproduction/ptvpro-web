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

async function probe() {
  console.log('--- PROBING EXACT COLUMNS ---');
  // Probe canonical_identity columns
  const { data: ci, error: ciErr } = await client.from('canonical_identity').select('*').limit(1);
  console.log('canonical_identity cols:', ci && ci[0] ? Object.keys(ci[0]) : 'empty table, probing via dummy insert check or rpc', ciErr?.message);

  // Probe user_account columns
  const { data: ua, error: uaErr } = await client.from('user_account').select('*').limit(1);
  console.log('user_account cols:', ua && ua[0] ? Object.keys(ua[0]) : 'empty table', uaErr?.message);

  // Probe ptv_surat_izin columns
  const { data: si, error: siErr } = await client.from('ptv_surat_izin').select('*').limit(1);
  console.log('ptv_surat_izin cols:', si && si[0] ? Object.keys(si[0]) : 'empty', siErr?.message);

  // Probe ptv_surat_tugas columns (even if 0 rows, select specific columns)
  const testSTCols = ['id', 'nomor_surat', 'no', 'perihal', 'nama_tugas', 'tanggal_tugas', 'kru_terlibat', 'status', 'diajukan_oleh', 'disetujui_oleh', 'created_at'];
  for (const col of testSTCols) {
    const { error } = await client.from('ptv_surat_tugas').select(col).limit(1);
    console.log(`ptv_surat_tugas.${col}:`, error ? `NOT EXISTS (${error.message})` : 'EXISTS');
  }

  // Probe ptv_surat_barang columns
  const testSBBCols = ['id', 'nomor_surat', 'no', 'nama_pembawa', 'tujuan_lokasi', 'tujuan_penggunaan', 'daftar_barang', 'status', 'diajukan_oleh', 'disetujui_oleh', 'created_at'];
  for (const col of testSBBCols) {
    const { error } = await client.from('ptv_surat_barang').select(col).limit(1);
    console.log(`ptv_surat_barang.${col}:`, error ? `NOT EXISTS (${error.message})` : 'EXISTS');
  }

  // Probe ptv_notifications columns
  const testNotifCols = ['id', 'tipe', 'judul', 'pesan', 'target_role', 'is_read', 'created_at', 'recipient_identity_id', 'recipient_ptv_id', 'actor_identity_id', 'entity_type', 'entity_id', 'action_url', 'idempotency_key', 'is_protected'];
  for (const col of testNotifCols) {
    const { error } = await client.from('ptv_notifications').select(col).limit(1);
    console.log(`ptv_notifications.${col}:`, error ? `NOT EXISTS (${error.message})` : 'EXISTS');
  }

  // Probe RPC approve_ptv_document_atomic & dispatch_smart_notification
  const { error: rpcApproveErr } = await client.rpc('approve_ptv_document_atomic', { p_doc_type: 'SI', p_doc_id: '00000000-0000-0000-0000-000000000000' });
  console.log('RPC approve_ptv_document_atomic probe:', rpcApproveErr?.message || 'EXISTS');

  const { error: rpcNotifErr } = await client.rpc('dispatch_smart_notification', { p_tipe: 'test', p_judul: 'test' });
  console.log('RPC dispatch_smart_notification probe:', rpcNotifErr?.message || 'EXISTS');
}

probe().catch(console.error);
