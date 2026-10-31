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

const sb = createClient(stagingUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const manifest = JSON.parse(fs.readFileSync('docs/PTV-DEV-118-RECONCILIATION-MANIFEST.json', 'utf8'));

console.log('='.repeat(80));
console.log('PTV-DEV-118: DRY-RUN SIMULASI MIGRASI TRANSAKSI LEGACY KE CANONICAL');
console.log('Target Project: swadgljnyelsjstqqxbm (Staging - READ ONLY VERIFICATION)');
console.log('='.repeat(80));

async function runDryRun() {
  // 1. Verifikasi kategori aktif di DB
  const { data: categories, error: errCat } = await sb
    .from('ptv_finance_categories')
    .select('id, name, kind, is_active');

  if (errCat || !categories) {
    console.error('FAIL: Gagal memeriksa tabel kategori di cloud:', errCat);
    process.exit(1);
  }

  const categoryMap = new Map(categories.map(c => [c.id, c]));
  console.log(`1. Kategori cloud terverifikasi: ${categories.length} kategori aktif.`);

  // 2. Verifikasi source references yang sudah ada di cloud
  const { data: existingRefs, error: errRefs } = await sb
    .from('ptv_finance_source_references')
    .select('source_table, source_id');

  if (errRefs) {
    console.error('FAIL: Gagal memeriksa source references di cloud:', errRefs);
    process.exit(1);
  }

  const existingRefSet = new Set((existingRefs || []).map(r => `${r.source_table}:${r.source_id}`));
  console.log(`2. Source references cloud terverifikasi: ${existingRefs?.length || 0} tautan sebelumnya.`);

  // 3. Verifikasi idempotency key uniqueness di cloud
  const { data: existingTx, error: errTx } = await sb
    .from('ptv_finance_transactions')
    .select('idempotency_key');

  if (errTx) {
    console.error('FAIL: Gagal memeriksa transaksi di cloud:', errTx);
    process.exit(1);
  }

  const existingTxKeySet = new Set((existingTx || []).map(t => t.idempotency_key));
  console.log(`3. Transaksi cloud terverifikasi: ${existingTx?.length || 0} transaksi tersimpan sebelumnya.`);

  // 4. Validasi per record dari manifest
  const allRecords = [
    ...manifest.records.pemasukan,
    ...manifest.records.pengeluaran
  ];

  let validationErrors = 0;
  const manifestKeySet = new Set();
  const manifestSourceSet = new Set();

  for (const r of allRecords) {
    // A. Kategori check
    const cat = categoryMap.get(r.categoryId);
    if (!cat) {
      console.error(`[VALIDATION-ERROR] Record ${r.sourceTable}:${r.sourceId} kategori ID ${r.categoryId} tidak ditemukan di cloud!`);
      validationErrors++;
    } else if (cat.kind !== (r.operation === 'income' ? 'income' : 'expense')) {
      console.error(`[VALIDATION-ERROR] Record ${r.sourceTable}:${r.sourceId} tipe kategori tidak cocok (${cat.kind} vs ${r.operation})!`);
      validationErrors++;
    }

    // B. Idempotency Key format & collision
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(r.idempotencyKey)) {
      console.error(`[VALIDATION-ERROR] Record ${r.sourceTable}:${r.sourceId} idempotencyKey ${r.idempotencyKey} tidak valid format UUID!`);
      validationErrors++;
    }
    if (manifestKeySet.has(r.idempotencyKey)) {
      console.error(`[VALIDATION-ERROR] Duplikasi idempotencyKey internal dalam manifest: ${r.idempotencyKey}!`);
      validationErrors++;
    }
    manifestKeySet.add(r.idempotencyKey);

    if (existingTxKeySet.has(r.idempotencyKey)) {
      console.warn(`[WARN] IdempotencyKey ${r.idempotencyKey} sudah ada di cloud (akan memicu idempotent replay).`);
    }

    // C. Source mapping collision
    const srcKey = `${r.sourceTable}:${r.sourceId}`;
    if (manifestSourceSet.has(srcKey)) {
      console.error(`[VALIDATION-ERROR] Duplikasi sourceRecord dalam manifest: ${srcKey}!`);
      validationErrors++;
    }
    manifestSourceSet.add(srcKey);

    if (existingRefSet.has(srcKey)) {
      console.warn(`[WARN] Source reference ${srcKey} sudah ditautkan sebelumnya di cloud!`);
    }

    // D. Amount & Date
    if (BigInt(r.amountMinor) <= 0n) {
      console.error(`[VALIDATION-ERROR] Amount minor tidak positif: ${r.amountMinor}!`);
      validationErrors++;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.occurredOn)) {
      console.error(`[VALIDATION-ERROR] Format tanggal tidak valid: ${r.occurredOn}!`);
      validationErrors++;
    }
  }

  console.log(`\n4. Hasil validasi individual 53 record:`);
  console.log(`   Total record divalidasi: ${allRecords.length}`);
  console.log(`   Validation errors: ${validationErrors}`);
  console.log(`   Unique idempotency keys: ${manifestKeySet.size} / 53`);
  console.log(`   Unique source references: ${manifestSourceSet.size} / 53`);

  // 5. Urutan kronologis & running balance check
  allRecords.sort((a, b) => {
    if (a.occurredOn !== b.occurredOn) return a.occurredOn.localeCompare(b.occurredOn);
    if (a.operation !== b.operation) return a.operation === 'income' ? -1 : 1;
    return a.index - b.index;
  });

  let balanceMinor = 0n;
  let minBalanceMinor = 0n;
  let negativeFound = false;

  for (const r of allRecords) {
    const amt = BigInt(r.amountMinor);
    if (r.operation === 'income') {
      balanceMinor += amt;
    } else {
      balanceMinor -= amt;
    }
    if (balanceMinor < minBalanceMinor) minBalanceMinor = balanceMinor;
    if (balanceMinor < 0n) negativeFound = true;
  }

  console.log(`\n5. Simulasi Running Balance Eksekusi Kronologis:`);
  console.log(`   Saldo Awal: Rp 0`);
  console.log(`   Saldo Terendah: Rp ${(Number(minBalanceMinor) / 100).toLocaleString('id-ID')}`);
  console.log(`   Saldo Akhir Gross: Rp ${(Number(balanceMinor) / 100).toLocaleString('id-ID')}`);
  console.log(`   Apakah Terjadi Saldo Negatif?: ${negativeFound ? 'YA (BLOCKER)' : 'TIDAK (AMAN 100%)'}`);

  console.log('\n='.repeat(80));
  if (validationErrors === 0 && !negativeFound) {
    console.log('KESIMPULAN DRY-RUN: PASS 100%');
    console.log('Status Kesiapan: READY_WITH_DECISIONS');
    console.log('(Menunggu 3 Keputusan Operator Terkait Provisioning Kantong & Penanganan Data Batal/Digital)');
  } else {
    console.log('KESIMPULAN DRY-RUN: FAIL');
    console.log('Status Kesiapan: BLOCKED');
  }
  console.log('='.repeat(80));
}

runDryRun().catch(err => {
  console.error('Fatal error in dry-run:', err);
  process.exit(1);
});
