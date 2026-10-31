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

async function checkDatabaseContext() {
  console.log('--- CHECKING DATABASE FUNCTION & RLS CONTEXT ---');
  // Check disetujui_oleh on existing ptv_surat_izin 001 and 007
  const { data: rows, error } = await client.from('ptv_surat_izin').select('id, nomor_surat, status, disetujui_oleh, diajukan_oleh');
  console.log('ptv_surat_izin records in Staging:');
  for (const r of (rows || [])) {
    console.log(` - ${r.nomor_surat}: id=${r.id}, status=${r.status}, disetujui_oleh=${r.disetujui_oleh}, diajukan_oleh=${r.diajukan_oleh}`);
  }

  // Check ptv_notifications table RLS status
  const { data: notifSample, error: notifErr } = await client.from('ptv_notifications').select('*').limit(1);
  console.log('ptv_notifications read status with service_role key:', notifErr ? notifErr.message : 'OK');
}

checkDatabaseContext().catch(console.error);
