import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.staging.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
for (const line of envContent.split(/\r?\n/)) {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.startsWith('#')) {
    envVars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

const SUPABASE_URL = envVars.SUPABASE_URL;
const SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

const backupPath = process.argv[2] || 'C:/Users/zidna/.gemini/antigravity-ide/brain/4b156355-2f85-4c83-8286-bae8e1350b55/scratch/staging-pre-migration-backup.json';

if (!fs.existsSync(backupPath)) {
  console.error(`[FATAL] File backup tidak ditemukan di: ${backupPath}`);
  process.exit(1);
}

const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
console.log('================================================================');
console.log('PTV PRO — STAGING DATABASE ROLLBACK / RESTORE PROCEDURE');
console.log(`Target Database : ${SUPABASE_URL}`);
console.log(`Backup Snapshot : ${backupData.timestamp}`);
console.log('================================================================\n');

async function restore() {
  const tables = Object.keys(backupData.tables);
  for (const table of tables) {
    const rows = backupData.tables[table];
    if (rows && rows.length > 0) {
      console.log(`[RESTORE] Memulihkan ${rows.length} baris ke ${table}...`);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(rows)
      });
      if (res.ok) {
        console.log(`[RESTORE OK] ${table} berhasil dipulihkan.`);
      } else {
        console.error(`[RESTORE ERR] Gagal memulihkan ${table}: HTTP ${res.status}`);
      }
    }
  }
  console.log('\nProsedur restore selesai.');
}

restore().catch(console.error);
