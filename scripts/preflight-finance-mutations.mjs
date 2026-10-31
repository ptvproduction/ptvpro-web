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
const authSecret = env.AUTH_SECRET || env.VITE_AUTH_SECRET;

console.log('='.repeat(70));
console.log('PTV-DEV-117: READ-ONLY PREFLIGHT CHECK FOR FINANCE 2.0 CLOUD MUTATIONS');
console.log('='.repeat(70));

// 1. Host Validation
if (!stagingUrl || !stagingUrl.startsWith('https://swadgljnyelsjstqqxbm.supabase.co')) {
  console.error('FATAL: Target URL bukan project Staging swadgljnyelsjstqqxbm yang sah!');
  console.error('URL terdeteksi:', stagingUrl ? stagingUrl.replace(/:.*@/, '://***@') : 'NONE');
  process.exit(1);
}
console.log('✅ 1. Target URL terverifikasi eksklusif: swadgljnyelsjstqqxbm.supabase.co');

if (!serviceKey || !authSecret) {
  console.error('FATAL: Service role key atau Auth secret tidak ditemukan.');
  process.exit(1);
}
console.log('✅ 2. Kredensial server-only tersedia (service_role key & auth secret)');

const sb = createClient(stagingUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runPreflight() {
  // 2. Cek 6 tabel canonical
  console.log('\n3. Memeriksa status dan baris 6 tabel canonical...');
  const tables = [
    'ptv_finance_pockets',
    'ptv_finance_categories',
    'ptv_finance_transactions',
    'ptv_finance_allocations',
    'ptv_finance_source_references',
    'ptv_finance_audit_log'
  ];

  const counts = {};
  for (const t of tables) {
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`❌ GAGAL membaca tabel ${t}: ${error.message} (${error.code})`);
      process.exit(1);
    }
    counts[t] = count ?? 0;
    console.log(`   - ${t}: ${count} baris`);
  }

  // 3. Cek Kategori Canonical
  console.log('\n4. Memeriksa kategori canonical...');
  const { data: cats, error: catErr } = await sb.from('ptv_finance_categories').select('id, name, kind, is_active').order('kind').order('name');
  if (catErr || !cats || cats.length !== 11) {
    console.error('❌ GAGAL: Kategori canonical tidak berjumlah 11 atau error:', catErr?.message);
    process.exit(1);
  }
  console.log(`✅ Kategori canonical tersedia: ${cats.length} kategori aktif.`);

  // 4. Cek Baseline Legacy 53 Record
  console.log('\n5. Memeriksa keutuhan baseline legacy 53 record...');
  const [inc, exp] = await Promise.all([
    sb.from('ptv_pemasukan').select('nominal'),
    sb.from('ptv_pengeluaran').select('nominal'),
  ]);

  const incCount = inc.data?.length ?? 0;
  const expCount = exp.data?.length ?? 0;
  const incSum = (inc.data || []).reduce((s, r) => s + Number(r.nominal || 0), 0);
  const expSum = (exp.data || []).reduce((s, r) => s + Number(r.nominal || 0), 0);

  if (incCount !== 43 || incSum !== 1244200 || expCount !== 10 || expSum !== 633924) {
    console.error(`❌ FATAL: Baseline legacy mismatch! Inc: ${incCount} (Rp ${incSum}), Exp: ${expCount} (Rp ${expSum})`);
    process.exit(1);
  }
  console.log(`✅ Baseline legacy 100% utuh: 43 pemasukan (Rp 1.244.200) & 10 pengeluaran (Rp 633.924).`);

  // 5. Cek Akun Pengelola Staging yang Memiliki Capability finance.manage
  console.log('\n6. Mencari akun aktif Staging yang memiliki capability finance.manage...');
  
  // Ambil profil yang memiliki finance.manage
  const { data: profCaps, error: capErr } = await sb
    .from('profile_capabilities')
    .select('profile_id')
    .eq('capability_key', 'finance.manage');

  if (capErr || !profCaps || profCaps.length === 0) {
    console.error('❌ GAGAL: Tidak ditemukan profil dengan capability finance.manage:', capErr?.message);
    process.exit(1);
  }
  const managerProfileIds = profCaps.map(p => p.profile_id);
  console.log(`   - Profil dengan finance.manage: ${managerProfileIds.join(', ')}`);

  // Cari akun yang memiliki profil tersebut
  const { data: accProfiles, error: apErr } = await sb
    .from('account_profiles')
    .select('account_id, profile_id')
    .in('profile_id', managerProfileIds);

  if (apErr || !accProfiles || accProfiles.length === 0) {
    console.error('❌ GAGAL: Tidak ditemukan akun dengan profil pengelola keuangan:', apErr?.message);
    process.exit(1);
  }

  const managerAccountIds = [...new Set(accProfiles.map(a => a.account_id))];
  
  // Ambil detail akun
  const { data: accounts, error: accErr } = await sb
    .from('user_account')
    .select('id, identity_id, status_akun, tokens_valid_after')
    .in('id', managerAccountIds)
    .eq('status_akun', 'active');

  if (accErr || !accounts || accounts.length === 0) {
    console.error('❌ GAGAL: Tidak ditemukan akun aktif dengan hak finance.manage:', accErr?.message);
    process.exit(1);
  }

  // Periksa keanggotaan ptv_studio untuk akun-akun ini
  let selectedManager = null;
  for (const acc of accounts) {
    const { data: mem, error: memErr } = await sb
      .from('organization_membership')
      .select('status_organisasi')
      .eq('identity_id', acc.identity_id)
      .eq('organization_id', 'ptv_studio')
      .eq('is_current', true)
      .eq('status_organisasi', 'active');

    if (!memErr && mem && mem.length === 1) {
      selectedManager = acc;
      break;
    }
  }

  if (!selectedManager) {
    console.error('❌ GAGAL: Tidak ditemukan akun pengelola dengan keanggotaan aktif di ptv_studio.');
    process.exit(1);
  }

  console.log(`✅ Ditemukan akun pengelola sah Staging:`);
  console.log(`   - Account ID: ${selectedManager.id}`);
  console.log(`   - Identity ID: ${selectedManager.identity_id}`);
  console.log(`   - Status Akun: ${selectedManager.status_akun}`);
  console.log(`   - Tokens Valid After: ${selectedManager.tokens_valid_after || 'null'}`);

  console.log('\n' + '='.repeat(70));
  console.log('HASIL PREFLIGHT: LULUS (READY FOR ISOLATED CLOUD MUTATION TEST)');
  console.log('='.repeat(70));
}

runPreflight().catch(err => {
  console.error('Preflight error:', err);
  process.exit(1);
});
