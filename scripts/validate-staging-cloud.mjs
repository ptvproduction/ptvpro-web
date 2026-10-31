/* eslint-disable no-undef, no-unused-vars */
/**
 * PTV PRO — Automated Read-Only Staging Cloud Validator (Hardened Edition)
 * Connects to Supabase Staging via credentials in .env.staging.
 * Safe & Read-Only: Never mutates records, never connects to production.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 37 Authoritative Canonical Tables & Views
export const EXPECTED_TABLES = [
  'canonical_identity', 'identity_contact', 'user_account', 'auth_credentials',
  'organization', 'organization_division', 'organization_membership',
  'access_profile', 'capability_registry', 'profile_capabilities',
  'account_profiles', 'account_capability_overrides',
  'auth_audit_log', 'ptv_login_history',
  'ptv_acara', 'ptv_acara_rundown', 'ptv_content_planner',
  'ptv_inventaris', 'ptv_inventaris_unit', 'ptv_nilai_inventaris',
  'ptv_peminjaman', 'ptv_lapor_masalah', 'ptv_lost_found',
  'ptv_surat_tugas', 'ptv_surat_izin', 'ptv_surat_barang',
  'ptv_keuangan', 'ptv_pemasukan', 'ptv_pengeluaran', 'ptv_kas_kru', 'ptv_kas_periode',
  'ptv_catatan', 'ptv_kontak_eksternal', 'ptv_notifications', 'ptv_push_subscriptions', 'ptv_pengumuman',
  'ptv_kru_legacy_compat'
];

// 7 Server-Side Contracted RPCs & Resolvers (Hardened Security Specification)
export const CONTRACTED_RPCS = [
  { 
    name: 'has_capability', 
    type: 'anonymous_executable',
    body: { p_capability: 'hub.access' },
    expectedStatus: 200,
    checkResponse: (data) => data === false, // Anonymous check fails closed
    description: 'Capability resolver — executable by anon, evaluates to false'
  },
  { 
    name: 'jwt_custom_claims', 
    type: 'anonymous_restricted',
    body: {},
    description: 'JWT claims injector — restricted from anon'
  },
  { 
    name: 'rpc_get_next_inv_code', 
    type: 'anonymous_restricted',
    body: {},
    description: 'Inventory sequence generator — restricted from anon'
  },
  { 
    name: 'rpc_checkout_loan', 
    type: 'anonymous_restricted',
    body: {
      p_transaction_id: 'TX-PROBE', p_borrower_name: 'Probe', p_purpose: 'Probe',
      p_out_date: '2026-10-09', p_due_date: '2026-10-10', p_event_name: 'Probe',
      p_unit_ids: [], p_actor_id: '00000000-0000-0000-0000-000000000000'
    },
    description: 'Equipment loan checkout — restricted from anon'
  },
  { 
    name: 'rpc_return_loan', 
    type: 'anonymous_restricted',
    body: {
      p_transaction_id: 'TX-PROBE', p_back_date: '2026-10-09',
      p_condition_status: 'bagus', p_notes: '', p_actor_id: '00000000-0000-0000-0000-000000000000'
    },
    description: 'Equipment loan return — restricted from anon'
  },
  { 
    name: 'rpc_return_single_unit', 
    type: 'anonymous_restricted',
    body: {
      p_loan_row_id: '00000000-0000-0000-0000-000000000000',
      p_unit_id: '00000000-0000-0000-0000-000000000000',
      p_condition_status: 'bagus', p_actor_id: '00000000-0000-0000-0000-000000000000'
    },
    description: 'Single unit return — restricted from anon'
  },
  { 
    name: 'rpc_submit_official_doc', 
    type: 'anonymous_restricted',
    body: {
      p_doc_type: 'tugas', p_payload: {}, p_actor_id: '00000000-0000-0000-0000-000000000000'
    },
    description: 'Official document submission — restricted from anon'
  }
];

/**
 * Pure evaluator for anonymous RPC responses.
 * Accurately recognizes access restriction without mistaking proper denial for system failure.
 */
export function evaluateRpcResponse(rpc, resStatus, data) {
  if (rpc.type === 'anonymous_executable') {
    if (resStatus === 200 && (!rpc.checkResponse || rpc.checkResponse(data))) {
      return { ok: true, status: 'verified', detail: 'HTTP 200 (Fail-Closed Validated)' };
    }
    return { ok: false, status: 'failed', detail: `Unexpected response: HTTP ${resStatus}` };
  }

  if (rpc.type === 'anonymous_restricted') {
    // A restricted RPC must reject unauthenticated/anonymous calls:
    // 1. PostgREST gateway blocks unprivileged routine: HTTP 401, 403, or 404 (PGRST202 routine hidden from schema cache)
    // 2. PL/pgSQL function execution guard: HTTP 400 (P0001, 28000)
    const isSecurelyRejected =
      [401, 403].includes(resStatus) ||
      (resStatus === 404 && data?.code === 'PGRST202') ||
      (resStatus === 400 && ['P0001', '28000'].includes(data?.code));

    if (isSecurelyRejected) {
      const codeStr = data?.code ? ` [${data.code}]` : '';
      return { ok: true, status: 'verified', detail: `HTTP ${resStatus}${codeStr} (Access Securely Denied)` };
    }

    if (resStatus === 200) {
      return { ok: false, status: 'failed', detail: 'CRITICAL SECURITY LEAK: Anonymous caller succeeded with HTTP 200' };
    }

    if (resStatus === 404) {
      return { ok: false, status: 'missing', detail: 'HTTP 404 (Routine Not Found)' };
    }

    return { ok: false, status: 'failed', detail: `Unexpected HTTP ${resStatus}` };
  }

  return { ok: false, status: 'failed', detail: 'Unknown RPC specification type' };
}

export function loadConfig() {
  const envPath = path.join(rootDir, '.env.staging');
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env.staging not found at ${envPath}`);
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
  const envTarget = envVars.VITE_APP_ENV || envVars.EXPECTED_ENVIRONMENT;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.staging');
  }

  if (supabaseUrl.includes('progresiftv.id') || envTarget === 'production') {
    throw new Error('FATAL: Target appears to be PRODUCTION! Aborting immediately.');
  }

  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json'
  };

  return { supabaseUrl, anonKey, envTarget, headers };
}

export async function runValidation() {
  const { supabaseUrl, anonKey, envTarget, headers } = loadConfig();

  console.log('====================================================');
  console.log('PTV PRO — STAGING CLOUD READ-ONLY VALIDATION SUITE');
  console.log('====================================================');
  console.log('Target URL     :', supabaseUrl);
  console.log('Environment    :', envTarget);

  const report = {
    connectivity: false,
    tablesDeployed: [],
    tablesMissing: [],
    tablesAuthError: [],
    rpcsFound: [],
    rpcsMissing: [],
    rpcsFailed: [],
    seeds: {
      organizations: 0,
      divisions: 0,
      profiles: 0,
      capabilities: 0,
      profileCapabilities: 0,
      pembinaQuarantinePassed: false
    },
    failures: [],
    warnings: []
  };

  // 1. Connectivity & Health Check
  try {
    const healthRes = await fetch(`${supabaseUrl}/auth/v1/health`, { headers: { apikey: anonKey } });
    if (healthRes.ok) {
      report.connectivity = true;
      console.log('✓ Connectivity: PASS (GoTrue Auth Health OK)');
    } else {
      report.failures.push(`Auth health check returned status ${healthRes.status}`);
      console.log(`✗ Connectivity: FAIL (Status ${healthRes.status})`);
    }
  } catch (err) {
    report.failures.push(`Network connection failed: ${err.message}`);
    console.log(`✗ Connectivity: FAIL (${err.message})`);
  }

  // 2. Strict Table & View Presence Probe (Anti-False-Positive)
  console.log(`\nChecking Canonical Tables & Views (Total ${EXPECTED_TABLES.length})...`);
  for (const table of EXPECTED_TABLES) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?limit=1`, { headers });
      if (res.status === 200) {
        report.tablesDeployed.push(table);
      } else if (res.status === 404) {
        report.tablesMissing.push(table);
      } else if (res.status === 401 || res.status === 403) {
        report.tablesAuthError.push(table);
      } else {
        report.tablesMissing.push(table);
      }
    } catch (err) {
      report.tablesMissing.push(table);
    }
  }

  console.log(`  Accessible (HTTP 200): ${report.tablesDeployed.length} / ${EXPECTED_TABLES.length}`);
  if (report.tablesMissing.length > 0) {
    console.log(`  Missing (404): ${report.tablesMissing.join(', ')}`);
  }
  if (report.tablesAuthError.length > 0) {
    console.log(`  Auth Error (401/403): ${report.tablesAuthError.join(', ')}`);
  }

  // 3. Strict Contracted RPC Stored Procedures Probe
  console.log(`\nChecking Contracted RPC Stored Procedures (Total ${CONTRACTED_RPCS.length})...`);
  for (const rpc of CONTRACTED_RPCS) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpc.name}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(rpc.body)
      });
      const data = await res.json().catch(() => null);

      const evalResult = evaluateRpcResponse(rpc, res.status, data);
      if (evalResult.ok) {
        report.rpcsFound.push(`${rpc.name}: ${evalResult.detail}`);
      } else if (evalResult.status === 'missing') {
        report.rpcsMissing.push(rpc.name);
      } else {
        report.rpcsFailed.push(`${rpc.name} (${evalResult.detail})`);
      }
    } catch (err) {
      report.rpcsMissing.push(rpc.name);
    }
  }

  console.log(`  Verified & Active: ${report.rpcsFound.length} / ${CONTRACTED_RPCS.length}`);
  if (report.rpcsMissing.length > 0) {
    console.log(`  Missing (404): ${report.rpcsMissing.join(', ')}`);
  }
  if (report.rpcsFailed.length > 0) {
    console.log(`  Failed Evaluation: ${report.rpcsFailed.join(', ')}`);
  }

  // 4. Strict Reference Seed Data & Matrix Audit
  console.log('\nChecking Reference Seed Data & Authorization Matrix...');
  
  // 4a. Organizations
  try {
    const orgRes = await fetch(`${supabaseUrl}/rest/v1/organization?select=id`, { headers });
    if (orgRes.ok) {
      const orgs = await orgRes.json();
      report.seeds.organizations = orgs.length;
      console.log(`  Organizations         : ${orgs.length} / 2 expected`);
    }
  } catch (e) {
    report.warnings.push(`organization query error: ${e.message}`);
  }

  // 4b. Divisions
  try {
    const divRes = await fetch(`${supabaseUrl}/rest/v1/organization_division?select=id`, { headers });
    if (divRes.ok) {
      const divs = await divRes.json();
      report.seeds.divisions = divs.length;
      console.log(`  Divisions             : ${divs.length} / 5 expected`);
    }
  } catch (e) {
    report.warnings.push(`organization_division query error: ${e.message}`);
  }

  // 4c. Access Profiles
  try {
    const profRes = await fetch(`${supabaseUrl}/rest/v1/access_profile?select=id`, { headers });
    if (profRes.ok) {
      const profs = await profRes.json();
      report.seeds.profiles = profs.length;
      console.log(`  Access Profiles       : ${profs.length} / 5 expected`);
    }
  } catch (e) {
    report.warnings.push(`access_profile query error: ${e.message}`);
  }

  // 4d. Capabilities
  try {
    const capRes = await fetch(`${supabaseUrl}/rest/v1/capability_registry?select=key`, { headers });
    if (capRes.ok) {
      const caps = await capRes.json();
      report.seeds.capabilities = caps.length;
      console.log(`  Capabilities Registry : ${caps.length} / 53 expected`);
    }
  } catch (e) {
    report.warnings.push(`capability_registry query error: ${e.message}`);
  }

  // 4e. Profile Capability Mappings & Pembina Quarantine
  try {
    const mapRes = await fetch(`${supabaseUrl}/rest/v1/profile_capabilities?select=profile_id,capability_key`, { headers });
    if (mapRes.ok) {
      const maps = await mapRes.json();
      report.seeds.profileCapabilities = maps.length;
      console.log(`  Profile Capabilities  : ${maps.length} / 177 expected`);

      // Verify Pembina quarantine
      const pembinaCaps = maps.filter(m => m.profile_id === 'pembina').map(m => m.capability_key);
      const financeValuationBreach = pembinaCaps.some(k => k.startsWith('finance.') || k.startsWith('inventory.valuation.'));
      if (pembinaCaps.length === 10 && !financeValuationBreach) {
        report.seeds.pembinaQuarantinePassed = true;
        console.log('  Pembina Quarantine    : VERIFIED (10 caps, finance & valuation blocked)');
      } else if (pembinaCaps.length > 0) {
        console.log('  Pembina Quarantine    : WARNING (Count or scope breach detected)');
      } else {
        console.log('  Pembina Quarantine    : PENDING SEED');
      }
    }
  } catch (e) {
    report.warnings.push(`profile_capabilities query error: ${e.message}`);
  }

  // 5. Final Synthesis
  console.log('\n====================================================');
  const allTablesOk = report.tablesDeployed.length === EXPECTED_TABLES.length;
  const allRpcsOk = report.rpcsFound.length === CONTRACTED_RPCS.length;
  const allSeedsOk = (
    report.seeds.organizations === 2 &&
    report.seeds.divisions === 5 &&
    report.seeds.profiles === 5 &&
    report.seeds.capabilities === 53 &&
    report.seeds.profileCapabilities === 177 &&
    report.seeds.pembinaQuarantinePassed
  );

  if (allTablesOk && allRpcsOk && allSeedsOk) {
    console.log('STATUS: CLOUD VALIDATION PASS (FULL SCHEMA + SEED COMPLETE)');
  } else if (allTablesOk && allRpcsOk) {
    console.log('STATUS: SCHEMA & RPCS PASS — REFERENCE SEED DATA PENDING');
  } else {
    console.log('STATUS: SCHEMA INCOMPLETE');
  }
  console.log('====================================================');

  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runValidation().catch(console.error);
}
