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

async function probePolicies() {
  // Try querying pg_policies via rpc or check if there is an rpc
  // Otherwise we can test permissions via direct client operations
  console.log('--- TESTING PERMISSIONS ON ptv_notifications ---');
  // Check if anon / authenticated can read
  const anonClient = createClient(url, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: anonRead, error: anonReadErr } = await anonClient.from('ptv_notifications').select('*').limit(1);
  console.log('Anon select ptv_notifications:', anonRead ? `READ OK (${anonRead.length} rows)` : `BLOCKED (${anonReadErr?.message})`);

  // Check if anon can insert
  const { error: anonInsErr } = await anonClient.from('ptv_notifications').insert({ tipe: 'test', judul: 'anon test', pesan: 'test' });
  console.log('Anon insert ptv_notifications:', anonInsErr ? `BLOCKED (${anonInsErr.message})` : 'UNEXPECTED ALLOWED');
}

probePolicies().catch(console.error);
