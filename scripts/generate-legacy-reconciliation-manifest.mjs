import fs from 'node:fs';
import crypto from 'node:crypto';

const dump = JSON.parse(fs.readFileSync('scripts/legacy-finance-audit-dump.json', 'utf8'));

// Helper UUID deterministik dari string menggunakan sha256 (format UUID v4/v5 compliant)
function deterministicUuid(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '5' + hash.substring(13, 16), // version 5
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash.substring(18, 20), // variant 1
    hash.substring(20, 32)
  ].join('-');
}

const catMapExpense = {
  'Konsumsi & Logistik': '064b9558-8d37-48ad-b179-19bc23f67b0b',
  'Operasional Studio': '275a7d0b-cdcd-4b53-b995-e005e2324898',
  'Peralatan & Perlengkapan': 'e43a15cf-c9d5-4d61-950b-b7e75b568ec1',
  'Lain-lain (Pengeluaran)': '6ee68494-ee0c-4c59-992c-6ca2ebf7d5a2',
  'Transportasi': '0ac02e80-ff5d-4b6a-b78a-87004148ea21',
  'Pemeliharaan Alat': '8cb3edc3-0708-4850-89a6-f5074da942c1',
};

const catMapIncome = {
  'Iuran Kru': 'e6852c70-5f57-436b-84e1-fc85752ad4dc',
  'Kas Masuk / Operasional': 'eeb57bb5-0d84-4b71-a6ea-76f74d8ec256',
  'Lain-lain (Pemasukan)': 'dcfccdab-a32d-4b6f-8e52-c1a503678ae1',
  'Jasa Produksi / Liputan': 'ccd95217-e011-474d-82b6-a2d92935e00f',
  'Donasi & Sponsor': '49d58ddf-9bb4-4143-8e99-624406d6e568',
};

// 1. Petakan Pemasukan (43)
const mappedIncome = dump.pemasukan.map((item, idx) => {
  let catName = 'Lain-lain (Pemasukan)';
  if (item.sumber === 'Kas Kru') {
    catName = 'Iuran Kru';
  } else if (item.sumber === 'SISA UANG KAS') {
    catName = 'Kas Masuk / Operasional';
  } else if (item.sumber === 'Uang Receh Ghaib') {
    catName = 'Kas Masuk / Operasional';
  }

  const isBatal = !!(item.keterangan && item.keterangan.includes('[BATAL/UNDO]'));
  const description = item.keterangan
    ? `[LEGACY] ${item.sumber}: ${item.keterangan}`
    : `[LEGACY] ${item.sumber}`;

  const idempotencyKey = deterministicUuid(`ptv_pemasukan:${item.id}`);

  return {
    index: idx + 1,
    sourceTable: 'ptv_pemasukan',
    sourceId: item.id,
    operation: 'income',
    amountMinor: String(BigInt(item.nominal) * 100n),
    nominalRupiah: item.nominal,
    occurredOn: item.tanggal,
    description,
    categoryName: catName,
    categoryId: catMapIncome[catName],
    recommendedPocket: 'Kas Utama Studio',
    pocketMappingStatus: 'NEEDS_OPERATOR_POCKET_PROVISION',
    idempotencyKey,
    auditReference: `MIGRATION-LEGACY-ptv_pemasukan-${item.id}`,
    isBatalFlagged: isBatal,
    reconciliationStatus: isBatal ? 'NEEDS_OPERATOR_DECISION_BATAL' : 'READY',
    rawLegacy: {
      sumber: item.sumber,
      keterangan: item.keterangan,
      createdAt: item.created_at
    }
  };
});

// 2. Petakan Pengeluaran (10)
const mappedExpense = dump.pengeluaran.map((item, idx) => {
  let catName = 'Lain-lain (Pengeluaran)';
  const t = (item.keperluan + ' ' + (item.keterangan || '')).toLowerCase();
  if (t.includes('galon') || t.includes('konsumsi') || t.includes('teh')) {
    catName = 'Konsumsi & Logistik';
  } else if (t.includes('kresek') || t.includes('roller blind') || t.includes('domain') || t.includes('mpj')) {
    catName = 'Operasional Studio';
  } else if (t.includes('gabus') || t.includes('magic tape') || t.includes('tinta')) {
    catName = 'Peralatan & Perlengkapan';
  }

  const isDigital = !!(item.keterangan && item.keterangan.includes('KAS UANG DIGITAL'));
  const description = item.keterangan
    ? `[LEGACY] ${item.keperluan}: ${item.keterangan}`
    : `[LEGACY] ${item.keperluan}`;

  const idempotencyKey = deterministicUuid(`ptv_pengeluaran:${item.id}`);

  return {
    index: idx + 1,
    sourceTable: 'ptv_pengeluaran',
    sourceId: item.id,
    operation: 'expense',
    amountMinor: String(BigInt(item.nominal) * 100n),
    nominalRupiah: item.nominal,
    occurredOn: item.tanggal,
    description,
    categoryName: catName,
    categoryId: catMapExpense[catName],
    recommendedPocket: isDigital ? 'Kas Uang Digital / Kas Utama Studio' : 'Kas Utama Studio',
    pocketMappingStatus: isDigital ? 'NEEDS_OPERATOR_DECISION_DIGITAL' : 'NEEDS_OPERATOR_POCKET_PROVISION',
    idempotencyKey,
    auditReference: `MIGRATION-LEGACY-ptv_pengeluaran-${item.id}`,
    isDigitalFlagged: isDigital,
    reconciliationStatus: isDigital ? 'NEEDS_OPERATOR_DECISION_DIGITAL' : 'READY',
    rawLegacy: {
      keperluan: item.keperluan,
      keterangan: item.keterangan,
      createdAt: item.created_at
    }
  };
});

// 3. Ringkasan Rekonsiliasi & Keputusan Operator
const manifest = {
  manifestVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  targetEnvironment: 'swadgljnyelsjstqqxbm (Staging)',
  auditStats: {
    totalRecords: 53,
    pemasukanCount: 43,
    pengeluaranCount: 10,
    totalPemasukanGross: 1244200,
    totalPengeluaranGross: 633924,
    selisihAritmetisGross: 610276,
    batalRecordsCount: 4,
    batalRecordsNominal: 90000,
    totalPemasukanNetIfBatalExcluded: 1154200,
    selisihAritmetisNetIfBatalExcluded: 520276,
    digitalRecordsCount: 1,
    digitalRecordsNominal: 35424,
    readyCount: 48,
    needsDecisionCount: 5 // 4 BATAL + 1 DIGITAL
  },
  operatorDecisionsRequired: [
    {
      decisionCode: 'DEC-01-POCKET-PROVISION',
      title: 'Pembuatan / Pemilihan Kantong Operasional Sah Staging',
      context: 'Di Supabase Staging saat ini hanya terdapat 2 kantong dummy PTV-DEV-117 yang sudah diarsipkan (saldo 0). Belum ada kantong operasional sah yang aktif untuk menampung transaksi riil.',
      options: [
        'A (Recommended): Buat kantong resmi baru "Kas Utama Studio" (tipe: cash) dan migrasikan seluruh 53 transaksi ke kantong tersebut.',
        'B: Buat 2 kantong baru ("Kas Utama Studio" dan "Kas Digital"), namun opsi ini wajib disertai transaksi saldo awal atau transfer penyeimbang untuk mencegah saldo defisit pada Kas Digital (-Rp 35.424).'
      ]
    },
    {
      decisionCode: 'DEC-02-BATAL-RECORDS-HANDLING',
      title: 'Penanganan 4 Record Pemasukan [BATAL/UNDO] (Total Rp 90.000)',
      context: '4 record pemasukan bertag [BATAL/UNDO] di ptv_pemasukan (Aqil Rp 25.000, Izzur Rp 25.000, Iyyaka Rp 20.000, Nasshar Rp 20.000). Total: Rp 90.000. Di sistem legacy lama, pembatalan hanya berupa teks dan tidak membalik nominal di database.',
      options: [
        'A (Recommended - Audit Trail Sempurna): Migrasikan ke-4 record sebagai transaksi posted, lalu buat 4 transaksi pembalik (reversal) canonical dengan status reversed / expense penyeimbang, sehingga mutasi historis tercatat transparan dan saldo akhir kas riil adalah Rp 520.276.',
        'B (Strict Net): Migrasikan ke-4 record langsung dengan status reversed (jika schema RPC mengizinkan), atau jangan memigrasikan 4 record batal ini sehingga hanya 49 record aktif yang masuk canonical.',
        'C (As-Is Gross): Migrasikan ke-4 record sebagai pemasukan normal tanpa pembalik, mempertahankan saldo buku gross Rp 610.276.'
      ]
    },
    {
      decisionCode: 'DEC-03-DIGITAL-EXPENSE-HANDLING',
      title: 'Penanganan 1 Pengeluaran "KAS UANG DIGITAL" (Rp 35.424)',
      context: 'Transaksi pengeluaran ID 0b27dc31-d694-419c-a6d3-f649b183ae7f (BIAYA REGISTRASI AKUN MPJ) mencatat keterangan "KAS UANG DIGITAL", namun tidak ada record pemasukan digital di database sumber.',
      options: [
        'A (Recommended): Anggap seluruh pengeluaran historis bersumber dari kas umum terpadu "Kas Utama Studio" dengan metadata keterangan asli dipertahankan.',
        'B: Buat alokasi ke kantong "Kas Digital" dengan mendahuluinya menggunakan transaksi transfer internal dari Kas Utama ke Kas Digital.'
      ]
    }
  ],
  records: {
    pemasukan: mappedIncome,
    pengeluaran: mappedExpense
  }
};

fs.writeFileSync('docs/PTV-DEV-118-RECONCILIATION-MANIFEST.json', JSON.stringify(manifest, null, 2), 'utf8');
console.log('Manifest pemetaan rekonsiliasi berhasil dibuat di docs/PTV-DEV-118-RECONCILIATION-MANIFEST.json');
console.log('Total records mapped:', mappedIncome.length + mappedExpense.length);
console.log('Ready count:', manifest.auditStats.readyCount);
console.log('Needs decision count:', manifest.auditStats.needsDecisionCount);
