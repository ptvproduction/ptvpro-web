/* eslint-disable no-undef */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const envPath = path.join(rootDir, '.env.staging');
if (!fs.existsSync(envPath)) {
  console.error('.env.staging not found');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const [k, ...v] = trimmed.split('=');
    envVars[k.trim()] = v.join('=').trim();
  }
}

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const anonKey = envVars.VITE_SUPABASE_ANON_KEY;

if (supabaseUrl.includes('progresiftv.id')) {
  console.error('PROD GUARD TRIGGERED');
  process.exit(1);
}

const baseHeaders = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  'Content-Type': 'application/json',
  Prefer: 'count=exact'
};

const tables = [
  'organization',
  'organization_division',
  'access_profile',
  'capability_registry',
  'profile_capabilities'
];

async function runDiagnostics() {
  console.log('=== REST DIAGNOSTIC PROBE (READ-ONLY) ===');
  console.log('Target URL:', supabaseUrl);

  for (const table of tables) {
    console.log(`\n--- Probing table: ${table} ---`);
    try {
      const url = `${supabaseUrl}/rest/v1/${table}?select=*`;
      const res = await fetch(url, { headers: baseHeaders });
      
      console.log(`Status        : ${res.status} ${res.statusText}`);
      console.log(`Content-Type  : ${res.headers.get('content-type')}`);
      console.log(`Content-Range : ${res.headers.get('content-range')}`);
      console.log(`Pref-Applied  : ${res.headers.get('preference-applied')}`);
      
      const rawText = await res.text();
      console.log(`Raw Body Len  : ${rawText.length} bytes`);
      
      let parsed = null;
      try {
        parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) {
          console.log(`Parsed Array  : Array with ${parsed.length} items`);
          if (parsed.length > 0) {
            console.log(`Sample item 0 :`, JSON.stringify(parsed[0]));
          } else {
            console.log(`Array content : [] (Empty array)`);
          }
        } else {
          console.log(`Parsed Object :`, JSON.stringify(parsed).slice(0, 150));
        }
      } catch (jsonErr) {
        console.log(`JSON Parse Err: ${jsonErr.message}`);
        console.log(`Raw snippet   :`, rawText.slice(0, 150));
      }
    } catch (err) {
      console.error(`Fetch error   : ${err.message}`);
    }
  }
}

runDiagnostics().catch(console.error);
