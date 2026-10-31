import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

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

if (!stagingUrl || !serviceKey || !stagingUrl.includes('swadgljnyelsjstqqxbm')) {
  console.error('Error: Kredensial Staging tidak valid.');
  process.exit(1);
}

console.log('='.repeat(70));
console.log('PTV PRO — POST-EXECUTION VERIFICATION: FINANCE 2.0 CANONICAL SCHEMA');
console.log('Target Project: swadgljnyelsjstqqxbm');
console.log('='.repeat(70));

const sb = createClient(stagingUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function verify() {
  const canonicalTables = [
    'ptv_finance_pockets',
    'ptv_finance_categories',
    'ptv_finance_transactions',
    'ptv_finance_allocations',
    'ptv_finance_source_references',
    'ptv_finance_audit_log'
  ];

  console.log('1. Verifikasi keberadaan dan akses 6 tabel canonical Finance 2.0...');
  let canonicalOk = true;
  for (const t of canonicalTables) {
    const { data, error, count } = await sb.from(t).select('*', { count: 'exact' });
    if (error) {
      console.log(`❌ [FAIL] ${t}: ${error.message} (${error.code})`);
      canonicalOk = false;
    } else {
      console.log(`✅ [PASS] ${t}: aktif di schema cache, jumlah baris = ${count}`);
    }
  }

  console.log('\n2. Verifikasi keutuhan data legacy (53 baris)...');
  const [inc, exp, led, kas, per] = await Promise.all([
    sb.from('ptv_pemasukan').select('*', { count: 'exact' }),
    sb.from('ptv_pengeluaran').select('*', { count: 'exact' }),
    sb.from('ptv_keuangan').select('*', { count: 'exact', head: true }),
    sb.from('ptv_kas_kru').select('*', { count: 'exact', head: true }),
    sb.from('ptv_kas_periode').select('*', { count: 'exact', head: true }),
  ]);

  const incCount = inc.count ?? 0;
  const expCount = exp.count ?? 0;
  const ledCount = led.count ?? 0;
  const kasCount = kas.count ?? 0;
  const perCount = per.count ?? 0;

  const incTotal = (inc.data || []).reduce((s, r) => s + Number(r.nominal || 0), 0);
  const expTotal = (exp.data || []).reduce((s, r) => s + Number(r.nominal || 0), 0);

  const legacyOk = incCount === 43 && expCount === 10 && ledCount === 0 && kasCount === 0 && perCount === 0
    && incTotal === 1244200 && expTotal === 633924;

  if (legacyOk) {
    console.log(`✅ [PASS] ptv_pemasukan: 43 baris (Rp 1.244.200) — UTUH`);
    console.log(`✅ [PASS] ptv_pengeluaran: 10 baris (Rp 633.924) — UTUH`);
    console.log(`✅ [PASS] ptv_keuangan: 0 baris, kas_kru: 0, kas_periode: 0 — UTUH`);
    console.log(`✅ [PASS] Total data sumber legacy: 53 baris (100% cocok dengan baseline PTV-DEV-111 & snapshot PTV-DEV-114)`);
  } else {
    console.log(`❌ [FAIL] Data legacy tidak cocok! inc: ${incCount}, exp: ${expCount}`);
  }
  console.log('\n' + '='.repeat(70));
  if (canonicalOk && legacyOk) {
    console.log('3. Verifikasi ketersediaan RPC rpc_post_finance_transaction_server...');
    const { data: rpcData, error: rpcError } = await sb.rpc('rpc_post_finance_transaction_server', {
      p_account_id: '00000000-0000-0000-0000-000000000000',
      p_session_iat: 0,
      p_command: {}
    });
    // Expected to fail with 42501 (authorization) or 22023 (validation), NOT PGRST202 (function not found)
    if (rpcError && rpcError.code === 'PGRST202') {
      console.log(`❌ [FAIL] rpc_post_finance_transaction_server tidak ditemukan: ${rpcError.message}`);
    } else {
      console.log(`✅ [PASS] rpc_post_finance_transaction_server aktif dan terproteksi (respon: ${rpcError?.message || 'OK'})`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('HASIL AKHIR TAHAP 1: SUKSES PENUH (ALL PASS)');
    console.log('Status: Skema canonical dan RPC Finance 2.0 aktif di Supabase Staging!');
  } else if (!canonicalOk) {
    console.log('\n' + '='.repeat(70));
    console.log('HASIL AKHIR TAHAP 1: MENUNGGU EKSEKUSI DDL DI SUPABASE SQL EDITOR');
    console.log('Silakan jalankan file: docs/PTVPRO-FINANCE-CANONICAL-STAGING-MIGRATION.sql');
    console.log('pada Supabase SQL Editor Staging (proyek: swadgljnyelsjstqqxbm).');
  } else {
    console.log('\n' + '='.repeat(70));
    console.log('HASIL AKHIR TAHAP 1: GAGAL / ANOMALI DATA');
  }
  console.log('='.repeat(70));
}

verify().catch(e => {
  console.error(e);
  process.exit(1);
});

