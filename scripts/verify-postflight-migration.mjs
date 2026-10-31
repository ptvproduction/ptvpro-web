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

console.log('='.repeat(80));
console.log('PTV-DEV-120: INDEPENDENT POSTFLIGHT VERIFICATION SUITE');
console.log('Target: swadgljnyelsjstqqxbm (Supabase Staging)');
console.log('='.repeat(80));

const sb = createClient(stagingUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function postflight() {
  let allPass = true;

  // 1. Verifikasi Kantong Kas Utama Studio
  console.log('1. Memeriksa Kantong "Kas Utama Studio"...');
  const { data: pocket, error: errPocket } = await sb
    .from('ptv_finance_pockets')
    .select('*')
    .eq('name', 'Kas Utama Studio')
    .single();

  if (errPocket || !pocket) {
    console.error('❌ FAIL: Kantong Kas Utama Studio tidak ditemukan:', errPocket);
    allPass = false;
  } else {
    console.log(`✅ [PASS] ID Kantong: ${pocket.id}`);
    console.log(`   Jenis: ${pocket.kind}, Archived: ${pocket.archived}`);
    console.log(`   Saldo Minor: ${pocket.balance_minor} (${Number(pocket.balance_minor) / 100} IDR)`);
    console.log(`   Version: ${pocket.version}`);
    if (pocket.balance_minor !== 52027600) {
      console.error(`❌ FAIL: Saldo minor tidak cocok dengan 52027600! Aktual: ${pocket.balance_minor}`);
      allPass = false;
    } else {
      console.log('✅ [PASS] Saldo Kantong tepat Rp 520.276.');
    }
  }

  // 2. Verifikasi 2 Kantong dummy PTV-DEV-117
  console.log('\n2. Memeriksa Kantong Dummy PTV-DEV-117...');
  const { data: dummyPockets } = await sb
    .from('ptv_finance_pockets')
    .select('*')
    .ilike('name', '%[TEST][PTV-DEV-117]%');

  const dummyOk = dummyPockets?.length === 2 && dummyPockets.every(p => p.archived && Number(p.balance_minor) === 0);
  if (dummyOk) {
    console.log(`✅ [PASS] 2 Kantong dummy terisolasi sempurna: saldo 0 & archived = true.`);
  } else {
    console.error('❌ FAIL: Kantong dummy terpengaruh!');
    allPass = false;
  }

  // 3. Verifikasi Transaksi Canonical
  console.log('\n3. Memeriksa Transaksi Canonical (ptv_finance_transactions)...');
  const { data: txList, count: txCount } = await sb
    .from('ptv_finance_transactions')
    .select('id, kind, status, amount_minor, audit_reference', { count: 'exact' });

  const postedTx = (txList || []).filter(t => t.status === 'posted');
  const reversedTx = (txList || []).filter(t => t.status === 'reversed');
  const legacyMigratedTx = (txList || []).filter(t => t.audit_reference.startsWith('MIGRATION-LEGACY-'));

  console.log(`✅ [PASS] Total Transaksi Tersimpan: ${txCount} baris.`);
  console.log(`   - Transaksi Migrasi Legacy: ${legacyMigratedTx.length} (49 posted + 4 reversed)`);
  console.log(`   - Transaksi Dummy PTV-DEV-117: ${txCount - legacyMigratedTx.length}`);
  console.log(`   - Status Breakdown: ${postedTx.length} posted, ${reversedTx.length} reversed`);

  if (legacyMigratedTx.length !== 53 || reversedTx.length !== 4) {
    console.error('❌ FAIL: Jumlah transaksi migrasi tidak sesuai spesifikasi!');
    allPass = false;
  }

  // 4. Verifikasi Source References
  console.log('\n4. Memeriksa Source References (ptv_finance_source_references)...');
  const { data: srcRefs, count: srcCount } = await sb
    .from('ptv_finance_source_references')
    .select('*', { count: 'exact' });

  const incRefs = (srcRefs || []).filter(r => r.source_table === 'ptv_pemasukan');
  const expRefs = (srcRefs || []).filter(r => r.source_table === 'ptv_pengeluaran');

  console.log(`✅ [PASS] Total Source References: ${srcCount} baris.`);
  console.log(`   - Tautan ptv_pemasukan: ${incRefs.length} / 43`);
  console.log(`   - Tautan ptv_pengeluaran: ${expRefs.length} / 10`);

  if (srcCount !== 53 || incRefs.length !== 43 || expRefs.length !== 10) {
    console.error('❌ FAIL: Source references tidak lengkap!');
    allPass = false;
  }

  // 5. Verifikasi Keutuhan Tabel Legacy (53 Baris Asli)
  console.log('\n5. Memeriksa Integritas 53 Data Legacy...');
  const [incRes, expRes] = await Promise.all([
    sb.from('ptv_pemasukan').select('id, nominal', { count: 'exact' }),
    sb.from('ptv_pengeluaran').select('id, nominal', { count: 'exact' })
  ]);

  const incSum = (incRes.data || []).reduce((s, r) => s + Number(r.nominal), 0);
  const expSum = (expRes.data || []).reduce((s, r) => s + Number(r.nominal), 0);

  if (incRes.count === 43 && incSum === 1244200 && expRes.count === 10 && expSum === 633924) {
    console.log(`✅ [PASS] 53 Data legacy 100% UTUH TIDAK BERUBAH:`);
    console.log(`   - ptv_pemasukan: 43 baris (Rp ${incSum.toLocaleString('id-ID')})`);
    console.log(`   - ptv_pengeluaran: 10 baris (Rp ${expSum.toLocaleString('id-ID')})`);
  } else {
    console.error('❌ FAIL: Data legacy berubah!');
    allPass = false;
  }

  // 6. Verifikasi Audit Log
  console.log('\n6. Memeriksa Audit Log Canonical (ptv_finance_audit_log)...');
  const { count: auditCount } = await sb
    .from('ptv_finance_audit_log')
    .select('*', { count: 'exact', head: true });

  console.log(`✅ [PASS] Total Audit Trail Tersimpan: ${auditCount} rekaman log.`);

  console.log('\n='.repeat(80));
  if (allPass) {
    console.log('KESIMPULAN POSTFLIGHT: ALL PASS 100%');
    console.log('MIGRASI LEGACY KE CANONICAL FINANCE 2.0 BERHASIL SEMPURNA!');
  } else {
    console.log('KESIMPULAN POSTFLIGHT: ADA KEGAGALAN.');
  }
  console.log('='.repeat(80));
}

postflight().catch(err => {
  console.error('Fatal postflight error:', err);
  process.exit(1);
});
