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
  console.error('Error: Kredensial Staging tidak valid atau bukan project swadgljnyelsjstqqxbm.');
  process.exit(1);
}

const sb = createClient(stagingUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  console.log('='.repeat(70));
  console.log('PTV-DEV-118: AUDIT READ-ONLY DATA LEGACY FINANCE & SIMULASI REKONSILIASI');
  console.log('Target Project: swadgljnyelsjstqqxbm (Staging Exclusive)');
  console.log('='.repeat(70));

  // 1. Fetch legacy pemasukan
  const { data: pemasukanList, error: errInc } = await sb
    .from('ptv_pemasukan')
    .select('*')
    .order('tanggal', { ascending: true })
    .order('id', { ascending: true });

  if (errInc) {
    console.error('Gagal mengambil ptv_pemasukan:', errInc);
    process.exit(1);
  }

  // 2. Fetch legacy pengeluaran
  const { data: pengeluaranList, error: errExp } = await sb
    .from('ptv_pengeluaran')
    .select('*')
    .order('tanggal', { ascending: true })
    .order('id', { ascending: true });

  if (errExp) {
    console.error('Gagal mengambil ptv_pengeluaran:', errExp);
    process.exit(1);
  }

  // 3. Fetch canonical categories
  const { data: categories, error: errCat } = await sb
    .from('ptv_finance_categories')
    .select('*')
    .order('kind', { ascending: true })
    .order('name', { ascending: true });

  if (errCat) {
    console.error('Gagal mengambil ptv_finance_categories:', errCat);
    process.exit(1);
  }

  // 4. Fetch canonical pockets
  const { data: pockets, error: errPockets } = await sb
    .from('ptv_finance_pockets')
    .select('*')
    .order('created_at', { ascending: true });

  if (errPockets) {
    console.error('Gagal mengambil ptv_finance_pockets:', errPockets);
    process.exit(1);
  }

  // 5. Fetch canonical transactions & source references
  const { data: canonicalTx, error: errTx } = await sb
    .from('ptv_finance_transactions')
    .select('*');

  const { data: sourceRefs, error: errRefs } = await sb
    .from('ptv_finance_source_references')
    .select('*');

  console.log('\n--- RINGKASAN DATABASE TERKINI ---');
  console.log(`Legacy ptv_pemasukan: ${pemasukanList.length} baris`);
  console.log(`Legacy ptv_pengeluaran: ${pengeluaranList.length} baris`);
  console.log(`Canonical Categories: ${categories.length} baris`);
  console.log(`Canonical Pockets: ${pockets.length} baris`);
  console.log(`Canonical Transactions (Dummy PTV-DEV-117): ${canonicalTx?.length || 0} baris`);
  console.log(`Canonical Source References: ${sourceRefs?.length || 0} baris`);

  // Detail struktur kolom
  console.log('\n--- STRUKTUR KOLOM RECORD PERTAMA ---');
  if (pemasukanList.length > 0) {
    console.log('Sample ptv_pemasukan keys:', Object.keys(pemasukanList[0]));
    console.log('Sample ptv_pemasukan [0]:', JSON.stringify(pemasukanList[0], null, 2));
  }
  if (pengeluaranList.length > 0) {
    console.log('Sample ptv_pengeluaran keys:', Object.keys(pengeluaranList[0]));
    console.log('Sample ptv_pengeluaran [0]:', JSON.stringify(pengeluaranList[0], null, 2));
  }

  // Hitung total nominal
  let totalPemasukan = 0;
  for (const item of pemasukanList) {
    totalPemasukan += Number(item.nominal) || 0;
  }

  let totalPengeluaran = 0;
  for (const item of pengeluaranList) {
    totalPengeluaran += Number(item.nominal) || 0;
  }

  const selisihAritmetis = totalPemasukan - totalPengeluaran;

  console.log('\n--- AUDIT ARITMETIKA HISTORIS ---');
  console.log(`Total Pemasukan (43 records): Rp ${totalPemasukan.toLocaleString('id-ID')}`);
  console.log(`Total Pengeluaran (10 records): Rp ${totalPengeluaran.toLocaleString('id-ID')}`);
  console.log(`Selisih Aritmetis Historis: Rp ${selisihAritmetis.toLocaleString('id-ID')}`);

  // Analisis tanggal dan kronologi
  const unifiedRecords = [
    ...pemasukanList.map(r => ({
      ...r,
      kind: 'pemasukan',
      amount: Number(r.nominal),
      title: r.sumber || r.keterangan || 'Pemasukan Legacy',
      date: r.tanggal
    })),
    ...pengeluaranList.map(r => ({
      ...r,
      kind: 'pengeluaran',
      amount: Number(r.nominal),
      title: r.keperluan || r.keterangan || 'Pengeluaran Legacy',
      date: r.tanggal
    }))
  ];

  // Urutkan kronologis: tanggal ASC.
  // Jika tanggal sama: pemasukan diproses sebelum pengeluaran agar saldo tidak defisit semu pada hari yang sama.
  // Jika tipe sama: urut id ASC.
  unifiedRecords.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    if (a.kind !== b.kind) {
      return a.kind === 'pemasukan' ? -1 : 1;
    }
    return a.id - b.id;
  });

  console.log(`\nRentang Waktu Transaksi Historis: ${unifiedRecords[0].date} s.d. ${unifiedRecords[unifiedRecords.length - 1].date}`);

  // Simulasi Running Balance jika semua masuk ke satu kantong tunggal
  let runningBalance = 0;
  let minRunningBalance = 0;
  let negativeBalanceOccurred = false;
  const negativeSteps = [];

  for (let i = 0; i < unifiedRecords.length; i++) {
    const rec = unifiedRecords[i];
    if (rec.kind === 'pemasukan') {
      runningBalance += rec.amount;
    } else {
      runningBalance -= rec.amount;
    }
    if (runningBalance < minRunningBalance) {
      minRunningBalance = runningBalance;
    }
    if (runningBalance < 0) {
      negativeBalanceOccurred = true;
      negativeSteps.push({
        index: i + 1,
        id: rec.id,
        kind: rec.kind,
        date: rec.date,
        amount: rec.amount,
        runningBalanceAfter: runningBalance,
        title: rec.title
      });
    }
  }

  console.log('\n--- SIMULASI RUNNING BALANCE (KAS TUNGGAL) ---');
  console.log(`Saldo Terendah Selama Simulasi: Rp ${minRunningBalance.toLocaleString('id-ID')}`);
  console.log(`Saldo Akhir Simulasi: Rp ${runningBalance.toLocaleString('id-ID')}`);
  console.log(`Apakah Pernah Mengalami Saldo Negatif (< 0)?: ${negativeBalanceOccurred ? 'YA (BLOCKER)' : 'TIDAK (AMAN)'}`);
  if (negativeBalanceOccurred) {
    console.log('Detail Transaksi yang Membawa Saldo Negatif:');
    console.table(negativeSteps);
  }

  // Tampilkan daftar lengkap 53 record untuk audit pemetaan
  console.log('\n--- DATA MENTAH LENGKAP: 43 PEMASUKAN ---');
  console.table(
    pemasukanList.map(r => ({
      id: r.id,
      tanggal: r.tanggal,
      nominal: r.nominal,
      sumber: r.sumber,
      keterangan: r.keterangan
    }))
  );

  console.log('\n--- DATA MENTAH LENGKAP: 10 PENGELUARAN ---');
  console.table(
    pengeluaranList.map(r => ({
      id: r.id,
      tanggal: r.tanggal,
      nominal: r.nominal,
      keperluan: r.keperluan,
      keterangan: r.keterangan
    }))
  );

  // Kategori yang tersedia
  console.log('\n--- KATEGORI CANONICAL TERSEDIA ---');
  console.table(
    categories.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      code: c.code,
      system: c.is_system
    }))
  );

  // Simpan data dump mentah ke scratch untuk dianalisis detail
  const dump = {
    pemasukan: pemasukanList,
    pengeluaran: pengeluaranList,
    categories,
    pockets,
    unifiedChronological: unifiedRecords,
    summary: {
      totalPemasukan,
      totalPengeluaran,
      selisihAritmetis,
      minRunningBalance,
      negativeBalanceOccurred
    }
  };

  fs.writeFileSync('scripts/legacy-finance-audit-dump.json', JSON.stringify(dump, null, 2), 'utf8');
  console.log('\nDump audit tersimpan di scripts/legacy-finance-audit-dump.json');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
