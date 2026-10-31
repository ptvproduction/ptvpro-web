import fs from 'node:fs';

const dump = JSON.parse(fs.readFileSync('scripts/legacy-finance-audit-dump.json', 'utf8'));

console.log('='.repeat(80));
console.log('PTV-DEV-118: DEEP ANALYSIS OF 53 LEGACY FINANCE RECORDS');
console.log('='.repeat(80));

// 1. Analisis Sumber Pemasukan
const incomeBySource = {};
let totalPemasukan = 0;
const canceledRecords = [];
const paymentMethodHints = [];

for (const inc of dump.pemasukan) {
  totalPemasukan += inc.nominal;
  const src = inc.sumber || 'TANPA_SUMBER';
  if (!incomeBySource[src]) {
    incomeBySource[src] = { count: 0, total: 0, items: [] };
  }
  incomeBySource[src].count++;
  incomeBySource[src].total += inc.nominal;
  incomeBySource[src].items.push(inc);

  if (inc.keterangan && inc.keterangan.includes('[BATAL/UNDO]')) {
    canceledRecords.push(inc);
  }

  // Cari indikasi metode pembayaran / rekening / kantong
  const text = `${inc.sumber} ${inc.keterangan || ''}`.toLowerCase();
  if (text.includes('transfer') || text.includes('bca') || text.includes('mandiri') || text.includes('digital') || text.includes('qris') || text.includes('gopay') || text.includes('ovo') || text.includes('dana') || text.includes('tunai') || text.includes('cash')) {
    paymentMethodHints.push({ type: 'pemasukan', id: inc.id, text: inc.keterangan || inc.sumber, nominal: inc.nominal });
  }
}

console.log('\n1. KELOMPOK PEMASUKAN BERDASARKAN SUMBER:');
for (const [sumber, data] of Object.entries(incomeBySource)) {
  console.log(`- Sumber: "${sumber}" -> ${data.count} transaksi, Total: Rp ${data.total.toLocaleString('id-ID')}`);
}

console.log(`\n2. RECORD DENGAN TAG [BATAL/UNDO]: (${canceledRecords.length} record)`);
for (const r of canceledRecords) {
  console.log(`- ID: ${r.id}, Tanggal: ${r.tanggal}, Nominal: Rp ${r.nominal.toLocaleString('id-ID')}`);
  console.log(`  Keterangan: ${r.keterangan}`);
}

// 2. Analisis Keperluan Pengeluaran
const expenseByKeperluan = {};
let totalPengeluaran = 0;
for (const exp of dump.pengeluaran) {
  totalPengeluaran += exp.nominal;
  const kep = exp.keperluan || 'TANPA_KEPERLUAN';
  expenseByKeperluan[kep] = {
    id: exp.id,
    tanggal: exp.tanggal,
    nominal: exp.nominal,
    keterangan: exp.keterangan
  };

  const text = `${exp.keperluan} ${exp.keterangan || ''}`.toLowerCase();
  if (text.includes('transfer') || text.includes('bca') || text.includes('mandiri') || text.includes('digital') || text.includes('qris') || text.includes('gopay') || text.includes('ovo') || text.includes('dana') || text.includes('tunai') || text.includes('cash')) {
    paymentMethodHints.push({ type: 'pengeluaran', id: exp.id, text: `${exp.keperluan} | ${exp.keterangan || ''}`, nominal: exp.nominal });
  }
}

console.log(`\n3. INDIKASI METODE PEMBAYARAN / REKENING DARI TEKS (${paymentMethodHints.length} temuan):`);
for (const h of paymentMethodHints) {
  console.log(`- [${h.type.toUpperCase()}] Rp ${h.nominal.toLocaleString('id-ID')} | ${h.text}`);
}

console.log('\n4. DETAIL LENGKAP 10 PENGELUARAN & REKOMENDASI KATEGORI CANONICAL:');
// Canonical expense categories:
// - Operasional Studio (id: 275a7d0b-cdcd-4b53-b995-e005e2324898)
// - Konsumsi & Logistik (id: 064b9558-8d37-48ad-b179-19bc23f67b0b)
// - Transportasi (id: 0ac02e80-ff5d-4b6a-b78a-87004148ea21)
// - Peralatan & Perlengkapan (id: e43a15cf-c9d5-4d61-950b-b7e75b568ec1)
// - Pemeliharaan Alat (id: 8cb3edc3-0708-4850-89a6-f5074da942c1)
// - Lain-lain (Pengeluaran) (id: 6ee68494-ee0c-4c59-992c-6ca2ebf7d5a2)

const catMap = {
  'Operasional Studio': '275a7d0b-cdcd-4b53-b995-e005e2324898',
  'Konsumsi & Logistik': '064b9558-8d37-48ad-b179-19bc23f67b0b',
  'Transportasi': '0ac02e80-ff5d-4b6a-b78a-87004148ea21',
  'Peralatan & Perlengkapan': 'e43a15cf-c9d5-4d61-950b-b7e75b568ec1',
  'Pemeliharaan Alat': '8cb3edc3-0708-4850-89a6-f5074da942c1',
  'Lain-lain (Pengeluaran)': '6ee68494-ee0c-4c59-992c-6ca2ebf7d5a2'
};

const incomeCatMap = {
  'Kas Masuk / Operasional': 'eeb57bb5-0d84-4b71-a6ea-76f74d8ec256',
  'Iuran Kru': 'e6852c70-5f57-436b-84e1-fc85752ad4dc',
  'Jasa Produksi / Liputan': 'ccd95217-e011-474d-82b6-a2d92935e00f',
  'Donasi & Sponsor': '49d58ddf-9bb4-4143-8e99-624406d6e568',
  'Lain-lain (Pemasukan)': 'dcfccdab-a32d-4b6f-8e52-c1a503678ae1'
};

const expenseMapping = dump.pengeluaran.map(e => {
  let recommendedCategory = 'Lain-lain (Pengeluaran)';
  const t = (e.keperluan + ' ' + (e.keterangan || '')).toLowerCase();
  if (t.includes('galon') || t.includes('konsumsi') || t.includes('teh')) {
    recommendedCategory = 'Konsumsi & Logistik';
  } else if (t.includes('kresek') || t.includes('roller blind') || t.includes('domain') || t.includes('mpj')) {
    recommendedCategory = 'Operasional Studio';
  } else if (t.includes('gabus') || t.includes('magic tape') || t.includes('tinta')) {
    recommendedCategory = 'Peralatan & Perlengkapan';
  }

  return {
    id: e.id,
    tanggal: e.tanggal,
    nominal: e.nominal,
    keperluan: e.keperluan,
    keterangan: e.keterangan,
    rekomendasiKategori: recommendedCategory,
    categoryId: catMap[recommendedCategory]
  };
});

console.table(expenseMapping.map(e => ({
  tanggal: e.tanggal,
  nominal: e.nominal,
  keperluan: e.keperluan,
  kategori: e.rekomendasiKategori
})));

// 3. Rekomendasi Pemasukan
console.log('\n5. ANALISIS PEMETAAN KATEGORI PEMASUKAN:');
const incomeMapping = dump.pemasukan.map(inc => {
  let recommendedCategory = 'Lain-lain (Pemasukan)';
  if (inc.sumber === 'Kas Kru') {
    recommendedCategory = 'Iuran Kru';
  } else if (inc.sumber === 'Kas Masuk' || inc.sumber === 'Kas Operasional') {
    recommendedCategory = 'Kas Masuk / Operasional';
  } else if (inc.sumber === 'Uang Receh Ghaib') {
    recommendedCategory = 'Kas Masuk / Operasional'; // atau Lain-lain (Pemasukan)
  }

  return {
    id: inc.id,
    tanggal: inc.tanggal,
    nominal: inc.nominal,
    sumber: inc.sumber,
    keterangan: inc.keterangan,
    rekomendasiKategori: recommendedCategory,
    categoryId: incomeCatMap[recommendedCategory]
  };
});

const incCatCounts = {};
for (const m of incomeMapping) {
  incCatCounts[m.rekomendasiKategori] = (incCatCounts[m.rekomendasiKategori] || 0) + 1;
}
console.log('Distribusi Kategori Pemasukan:', incCatCounts);

// 4. Analisis Multi-Kantong vs Single-Kantong
console.log('\n6. ANALISIS INDIKASI KANTONG / KAS:');
console.log('Perhatikan pengeluaran ID 0b27dc31-d694-419c-a6d3-f649b183ae7f:');
console.log('- Keperluan: "BIAYA REGISTRASI AKUN MPJ", Nominal: Rp 35.424');
console.log('- Keterangan: "KAS UANG DIGITAL"');
console.log('-> Ini mengindikasikan adanya kas terpisah ("Uang Digital" / Bank / E-Wallet) dibanding kas fisik/tunai studio!');
console.log('Namun di tabel ptv_pemasukan: TIDAK ADA satu pun record yang menyebut "KAS UANG DIGITAL" secara eksplisit!');
console.log('Jika Kas Uang Digital dipisah menjadi kantong tersendiri tanpa ada pemasukan yang dialokasikan ke sana, maka pengeluaran Rp 35.424 akan DEFISIT (saldo negatif) jika tidak ada saldo awal!');

