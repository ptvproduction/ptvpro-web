import fs from 'node:fs';

const dump = JSON.parse(fs.readFileSync('scripts/legacy-finance-audit-dump.json', 'utf8'));

console.log('='.repeat(80));
console.log('SIMULASI MULTI-SKENARIO KANTONG UNTUK 53 TRANSAKSI LEGACY');
console.log('='.repeat(80));

// Skenario A: Seluruh transaksi ke 1 Kantong Kas Operasional
function simulateSinglePocket(excludeCanceled = false) {
  let balance = 0;
  let minBalance = 0;
  let negative = false;
  const history = [];

  const records = dump.unifiedChronological.filter(r => {
    if (excludeCanceled && r.kind === 'pemasukan' && r.keterangan && r.keterangan.includes('[BATAL/UNDO]')) {
      return false;
    }
    return true;
  });

  for (const r of records) {
    if (r.kind === 'pemasukan') {
      balance += r.amount;
    } else {
      balance -= r.amount;
    }
    if (balance < minBalance) {
      minBalance = balance;
    }
    if (balance < 0) {
      negative = true;
    }
    history.push({
      date: r.date,
      kind: r.kind,
      amount: r.amount,
      title: r.title,
      balanceAfter: balance
    });
  }

  return { balance, minBalance, negative, count: records.length, history };
}

// Skenario B: Kas Digital dipisah khusus untuk transaksi "KAS UANG DIGITAL"
function simulateSplitDigitalPocket() {
  let cashBalance = 0;
  let digitalBalance = 0;
  let digitalNegative = false;
  let minDigital = 0;

  for (const r of dump.unifiedChronological) {
    const isDigital = (r.keterangan || '').includes('KAS UANG DIGITAL');
    if (isDigital) {
      if (r.kind === 'pemasukan') {
        digitalBalance += r.amount;
      } else {
        digitalBalance -= r.amount;
      }
      if (digitalBalance < minDigital) minDigital = digitalBalance;
      if (digitalBalance < 0) digitalNegative = true;
    } else {
      if (r.kind === 'pemasukan') {
        cashBalance += r.amount;
      } else {
        cashBalance -= r.amount;
      }
    }
  }

  return {
    cashBalance,
    digitalBalance,
    minDigital,
    digitalNegative
  };
}

const resA1 = simulateSinglePocket(false);
console.log('\n--- SKENARIO A1: Satu Kantong Kas Terpadu (Termasuk 4 record [BATAL/UNDO]) ---');
console.log(`Jumlah Transaksi: ${resA1.count}`);
console.log(`Saldo Akhir: Rp ${resA1.balance.toLocaleString('id-ID')}`);
console.log(`Saldo Terendah: Rp ${resA1.minBalance.toLocaleString('id-ID')}`);
console.log(`Pernah Negatif: ${resA1.negative ? 'YA (BLOCKER)' : 'TIDAK (AMAN)'}`);

const resA2 = simulateSinglePocket(true);
console.log('\n--- SKENARIO A2: Satu Kantong Kas Terpadu (4 record [BATAL/UNDO] DIKELUARKAN) ---');
console.log(`Jumlah Transaksi: ${resA2.count}`);
console.log(`Saldo Akhir: Rp ${resA2.balance.toLocaleString('id-ID')}`);
console.log(`Saldo Terendah: Rp ${resA2.minBalance.toLocaleString('id-ID')}`);
console.log(`Pernah Negatif: ${resA2.negative ? 'YA (BLOCKER)' : 'TIDAK (AMAN)'}`);

const resB = simulateSplitDigitalPocket();
console.log('\n--- SKENARIO B: Kantong Kas Digital Dipisah Otomatis Berdasarkan Teks ---');
console.log(`Saldo Kas Fisik: Rp ${resB.cashBalance.toLocaleString('id-ID')}`);
console.log(`Saldo Kas Digital: Rp ${resB.digitalBalance.toLocaleString('id-ID')}`);
console.log(`Saldo Terendah Kas Digital: Rp ${resB.minDigital.toLocaleString('id-ID')}`);
console.log(`Apakah Kas Digital Defisit?: ${resB.digitalNegative ? 'YA (BLOCKER KERAS: -Rp 35.424)' : 'TIDAK'}`);

