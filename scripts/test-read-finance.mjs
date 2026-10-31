import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { readFinance } from '../api/finance.ts';
import { resolveFinanceAccess } from '../api/financeAccess.ts';

const envStaging = fs.readFileSync('.env.staging', 'utf8');
const envLocal = fs.existsSync('.env.staging.local') ? fs.readFileSync('.env.staging.local', 'utf8') : '';

function parseEnv(src) {
  return Object.fromEntries(
    src.split('\n')
      .filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => {
        const idx = l.indexOf('=');
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
      })
  );
}

const env = { ...parseEnv(envStaging), ...parseEnv(envLocal) };
const stagingUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(stagingUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  console.log('Testing readFinance for Manager Account...');
  const managerAccountId = 'bcd64337-3511-459b-a2b1-4d027b926fb7';
  const managerIdentityId = 'd00893ac-3d6b-4da8-b12f-2353cea729aa';
  const now = Math.floor(Date.now() / 1000);

  const session = {
    account_id: managerAccountId,
    identity_id: managerIdentityId,
    ptv_id: 'PTV-ADM-001',
    full_name: 'Super Executive Staging',
    username: 'root_exec',
    status_akun: 'active',
    status_organisasi: 'active',
    assigned_profiles: ['root_executive'],
    capabilities: ['hub.access', 'finance.manage', 'finance.view'],
    iat: now,
    exp: now + 3600
  };

  const access = await resolveFinanceAccess(sb, session);
  console.log('Resolved Finance Access:', access);

  const snapshot = await readFinance(sb, access);
  console.log('\n--- SNAPSHOT HASIL readFinance ---');
  console.log('Source:', snapshot.source);
  console.log('CanManage:', snapshot.canManage);
  console.log('Scope:', snapshot.scope);
  console.log('Canonical State:', snapshot.canonical.state);
  console.log('Canonical Pockets Count:', snapshot.canonical.pockets?.length);
  if (snapshot.canonical.pockets) {
    console.log('Pockets:', snapshot.canonical.pockets.map(p => ({ name: p.name, balance: p.balanceMinor, archived: p.archived })));
  }
  console.log('Canonical Transactions Count:', snapshot.canonical.transactions?.length);
  if (snapshot.canonical.transactions) {
    console.log('Sample Transaksi [0]:', snapshot.canonical.transactions[0]);
  }
}

main().catch(err => {
  console.error('Error during test-read-finance:', err);
  process.exit(1);
});
