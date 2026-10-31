import fs from 'node:fs';

const dump = JSON.parse(fs.readFileSync('scripts/legacy-finance-audit-dump.json', 'utf8'));

const namesToCheck = [
  'Aqil Afzal Al Farisi',
  'Muhammad Izzur Fauzil Adhim',
  'Iyyaka Fahabil Farhan',
  'Nasshar Rasikh Arsyadiano'
];

console.log('='.repeat(80));
console.log('INVESTIGASI RECORD PEMBATALAN [BATAL/UNDO]');
console.log('='.repeat(80));

for (const name of namesToCheck) {
  console.log(`\n--- Riwayat untuk ${name} ---`);
  const matches = dump.pemasukan.filter(p => p.keterangan && p.keterangan.includes(name));
  for (const m of matches) {
    console.log(`ID: ${m.id} | Tanggal: ${m.tanggal} | Nominal: Rp ${m.nominal.toLocaleString('id-ID')} | Created: ${m.created_at}`);
    console.log(`Keterangan: ${m.keterangan}`);
  }
}
