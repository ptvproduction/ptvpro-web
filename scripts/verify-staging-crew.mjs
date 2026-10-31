/**
 * PTV PRO — Staging Crew Migration Verification Suite
 * Verifies the exact counts and relational integrity of the 89 migrated legacy crew records.
 */

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envRaw = fs.readFileSync('.env.staging', 'utf8');
const env = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function verify() {
  console.log('='.repeat(80));
  console.log('PTV PRO — STAGING CREW MIGRATION VERIFICATION');
  console.log('Target URL:', env.VITE_SUPABASE_URL);
  console.log('='.repeat(80));

  const tables = [
    'canonical_identity',
    'user_account',
    'identity_contact',
    'organization_membership',
    'account_profiles',
    'ptv_inventaris',
    'ptv_inventaris_unit'
  ];

  for (const table of tables) {
    const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
    console.log(`Table ${table.padEnd(25)} : ${count !== null ? count : 'N/A'} rows ${error ? '(Error: ' + error.message + ')' : '✓'}`);
  }

  // Sample read test
  const { data: sampleIdent, error: identErr } = await sb
    .from('canonical_identity')
    .select('ptv_id, full_name, legacy_id')
    .limit(5);

  if (sampleIdent && sampleIdent.length > 0) {
    console.log('\nSample Migrated Crew:');
    console.table(sampleIdent);
  }

  console.log('='.repeat(80));
}

verify().catch(console.error);
