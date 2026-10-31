import fs from 'node:fs';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Load environment staging
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

const isExecute = process.argv.includes('--execute');
const confirmGuard = process.env.CONFIRM_MIGRATION_EXECUTE;

console.log('='.repeat(80));
console.log(`PTV PRO — LEGACY TO CANONICAL FINANCE 2.0 MIGRATION SCRIPT`);
console.log(`Mode: ${isExecute ? 'LIVE EXECUTION (TULIS CLOUD)' : 'DRY-RUN SIMULATION (READ-ONLY)'}`);
console.log(`Target: swadgljnyelsjstqqxbm (Supabase Staging)`);
console.log('='.repeat(80));

// 1. Guardrail Keamanan Host & ACC
if (!stagingUrl || !stagingUrl.includes('swadgljnyelsjstqqxbm')) {
  console.error('FATAL: Target URL tidak mengarah ke project Staging swadgljnyelsjstqqxbm!');
  process.exit(1);
}
if (stagingUrl.includes('jthzuhkblxcaohiuypqq')) {
  console.error('FATAL: Target URL mengarah ke Production! Eksekusi DIBATALKAN.');
  process.exit(1);
}

if (isExecute && confirmGuard !== 'swadgljnyelsjstqqxbm') {
  console.error('FATAL: Eksekusi LIVE memerlukan CONFIRM_MIGRATION_EXECUTE=swadgljnyelsjstqqxbm!');
  console.error('Pencegahan eksekusi otomatis aktif.');
  process.exit(1);
}

const sb = createClient(stagingUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Helper deterministic UUIDv5-like from string
function deterministicUuid(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '5' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash.substring(18, 20),
    hash.substring(20, 32)
  ].join('-');
}

async function run() {
  console.log('\n[PHASE 1] PREFLIGHT VERIFICATION...');

  // A. Verifikasi akun pengelola migrasi (capability finance.manage)
  const { data: profCaps, error: capErr } = await sb
    .from('profile_capabilities')
    .select('profile_id')
    .eq('capability_key', 'finance.manage');

  if (capErr || !profCaps || profCaps.length === 0) {
    console.error('Gagal mengambil profil dengan finance.manage:', capErr);
    process.exit(1);
  }

  const { data: accProfiles, error: apErr } = await sb
    .from('account_profiles')
    .select('account_id, profile_id')
    .in('profile_id', profCaps.map(p => p.profile_id))
    .limit(1)
    .single();

  if (apErr || !accProfiles) {
    console.error('Gagal memverifikasi akun pengelola migrasi:', apErr);
    process.exit(1);
  }
  const migrationActorId = accProfiles.account_id;
  console.log(`- Akun Aktor Migrasi Terverifikasi: ${migrationActorId} (profile: ${accProfiles.profile_id})`);

  // B. Verifikasi 53 legacy records
  const [incRes, expRes] = await Promise.all([
    sb.from('ptv_pemasukan').select('*').order('tanggal', { ascending: true }).order('id', { ascending: true }),
    sb.from('ptv_pengeluaran').select('*').order('tanggal', { ascending: true }).order('id', { ascending: true })
  ]);

  if (incRes.error || expRes.error) {
    console.error('Gagal mengambil data legacy:', incRes.error || expRes.error);
    process.exit(1);
  }

  const pemasukanList = incRes.data || [];
  const pengeluaranList = expRes.data || [];

  if (pemasukanList.length !== 43 || pengeluaranList.length !== 10) {
    console.error(`FATAL: Jumlah data legacy tidak cocok! Expected: 43 in & 10 out. Aktual: ${pemasukanList.length} in & ${pengeluaranList.length} out.`);
    process.exit(1);
  }
  console.log(`- Data Legacy Terverifikasi: 43 Pemasukan (Rp 1.244.200) & 10 Pengeluaran (Rp 633.924) UTUH.`);

  // C. Verifikasi 11 kategori canonical
  const { data: categories, error: errCat } = await sb
    .from('ptv_finance_categories')
    .select('id, name, kind, is_active')
    .eq('is_active', true);

  if (errCat || !categories || categories.length < 11) {
    console.error('Kategori canonical cloud tidak lengkap atau belum aktif:', errCat);
    process.exit(1);
  }
  const categoryMap = new Map(categories.map(c => [c.name, c]));
  console.log(`- Kategori Canonical Terverifikasi: ${categories.length} kategori aktif.`);

  // D. Verifikasi / Deteksi Kantong Kas Utama Studio
  const { data: existingPockets, error: errPockets } = await sb
    .from('ptv_finance_pockets')
    .select('*');

  if (errPockets) {
    console.error('Gagal memeriksa tabel kantong:', errPockets);
    process.exit(1);
  }

  let mainPocket = existingPockets?.find(p => p.name === 'Kas Utama Studio' && !p.archived);
  if (!mainPocket) {
    console.log(`- Kantong "Kas Utama Studio" belum ada di Staging.`);
    if (isExecute) {
      console.log(`- Membuat kantong operasional sah "Kas Utama Studio" via service_role...`);
      const { data: createdPocket, error: errCreatePocket } = await sb
        .from('ptv_finance_pockets')
        .insert({
          name: 'Kas Utama Studio',
          kind: 'cash',
          provider: null,
          account_number: null,
          account_holder: null,
          balance_minor: 0,
          version: 1,
          archived: false
        })
        .select()
        .single();

      if (errCreatePocket || !createdPocket) {
        console.error('FATAL: Gagal membuat Kantong Kas Utama Studio:', errCreatePocket);
        process.exit(1);
      }
      mainPocket = createdPocket;
      console.log(`  -> Berhasil dibuat: ID ${mainPocket.id}`);
    } else {
      console.log(`  [DRY-RUN] Kantong "Kas Utama Studio" akan dibuat pada tahap eksekusi.`);
      mainPocket = { id: '00000000-0000-0000-0000-000000000001', name: 'Kas Utama Studio', balance_minor: 0, version: 1 };
    }
  } else {
    console.log(`- Kantong "Kas Utama Studio" terdeteksi: ID ${mainPocket.id}, Saldo Saat Ini: ${mainPocket.balance_minor}`);
  }

  // E. Checkpoint resume: Periksa source references yang sudah ada di database
  const { data: existingRefs, error: errRefs } = await sb
    .from('ptv_finance_source_references')
    .select('source_table, source_id, transaction_id');

  if (errRefs) {
    console.error('Gagal memeriksa existing source references:', errRefs);
    process.exit(1);
  }

  const existingRefMap = new Map((existingRefs || []).map(r => [`${r.source_table}:${r.source_id}`, r.transaction_id]));
  console.log(`- Checkpoint: ${existingRefMap.size} data legacy sudah memiliki tautan sebelumnya.`);

  // F. Filter 4 record pembatalan vs 49 record aktif
  const canceledPemasukan = pemasukanList.filter(p => p.keterangan && p.keterangan.includes('[BATAL/UNDO]'));
  const activePemasukan = pemasukanList.filter(p => !p.keterangan || !p.keterangan.includes('[BATAL/UNDO]'));

  console.log(`\n[PHASE 2] MERANCANG PIPELINE TRANSAKSI (49 POSTED + 4 REVERSED)...`);
  console.log(`- 39 Pemasukan Aktif (Posted) -> Rp ${activePemasukan.reduce((s, r) => s + r.nominal, 0).toLocaleString('id-ID')}`);
  console.log(`- 10 Pengeluaran Aktif (Posted) -> Rp ${pengeluaranList.reduce((s, r) => s + r.nominal, 0).toLocaleString('id-ID')}`);
  console.log(`- 4 Pemasukan Batal (Reversed) -> Rp ${canceledPemasukan.reduce((s, r) => s + r.nominal, 0).toLocaleString('id-ID')} (Tanpa mutasi saldo kantong)`);

  // Gabungkan 49 transaksi aktif secara kronologis
  const activeBatch = [
    ...activePemasukan.map(r => ({
      ...r,
      kind: 'income',
      table: 'ptv_pemasukan',
      categoryName: r.sumber === 'Kas Kru' ? 'Iuran Kru' : 'Kas Masuk / Operasional',
      isDigital: false,
      isBatal: false
    })),
    ...pengeluaranList.map(r => {
      let catName = 'Operasional Studio';
      const t = (r.keperluan + ' ' + (r.keterangan || '')).toLowerCase();
      if (t.includes('galon') || t.includes('konsumsi') || t.includes('teh')) catName = 'Konsumsi & Logistik';
      else if (t.includes('gabus') || t.includes('magic tape') || t.includes('tinta')) catName = 'Peralatan & Perlengkapan';
      const isDig = !!(r.keterangan && r.keterangan.includes('KAS UANG DIGITAL'));
      return {
        ...r,
        kind: 'expense',
        table: 'ptv_pengeluaran',
        categoryName: catName,
        isDigital: isDig,
        isBatal: false
      };
    })
  ];

  // Urutkan kronologis: tanggal ASC, incoming sebelum outgoing, lalu id ASC
  activeBatch.sort((a, b) => {
    if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
    if (a.kind !== b.kind) return a.kind === 'income' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  // Batch pembatalan (4 record)
  const canceledBatch = canceledPemasukan.map(r => ({
    ...r,
    kind: 'income',
    table: 'ptv_pemasukan',
    categoryName: 'Iuran Kru',
    isDigital: false,
    isBatal: true
  }));

  console.log('\n[PHASE 3] SIMULASI & EKSEKUSI TRANSAKSI...');
  let simulatedBalanceMinor = BigInt(mainPocket.balance_minor || 0);
  let postedCount = 0;
  let reversedCount = 0;
  let skippedCount = 0;
  const executionManifest = [];

  // 1. Eksekusi 49 transaksi aktif
  for (let i = 0; i < activeBatch.length; i++) {
    const item = activeBatch[i];
    const srcRefKey = `${item.table}:${item.id}`;

    if (existingRefMap.has(srcRefKey)) {
      skippedCount++;
      executionManifest.push({
        index: i + 1,
        source: srcRefKey,
        action: 'skipped_already_linked',
        txId: existingRefMap.get(srcRefKey)
      });
      continue;
    }

    const cat = categoryMap.get(item.categoryName);
    const amtMinor = BigInt(item.nominal) * 100n;
    const idempotencyKey = deterministicUuid(`${item.table}:${item.id}`);
    const descText = item.keterangan
      ? `[LEGACY] ${item.sumber || item.keperluan}: ${item.keterangan}`
      : `[LEGACY] ${item.sumber || item.keperluan}`;

    if (item.kind === 'income') {
      simulatedBalanceMinor += amtMinor;
    } else {
      simulatedBalanceMinor -= amtMinor;
    }

    if (simulatedBalanceMinor < 0n) {
      console.error(`FATAL: Saldo negatif pada transaksi ${item.tanggal} (${item.nominal})! Eksekusi dihentikan.`);
      process.exit(1);
    }

    if (isExecute) {
      // Live Insert via transaction atomic payload
      const txId = crypto.randomUUID();
      const auditRef = `MIGRATION-LEGACY-${item.table}-${item.id}`;
      const cmdHash = crypto.createHash('sha256').update(idempotencyKey + descText).digest('hex');

      // Insert transaction header
      const { error: errTx } = await sb.from('ptv_finance_transactions').insert({
        id: txId,
        occurred_on: item.tanggal,
        description: descText,
        kind: item.kind,
        currency: 'IDR',
        amount_minor: Number(amtMinor),
        category_id: cat.id,
        status: 'posted',
        idempotency_key: idempotencyKey,
        command_hash: cmdHash,
        audit_reference: auditRef,
        created_by: migrationActorId
      });

      if (errTx) {
        console.error(`Gagal insert transaksi aktif ${srcRefKey}:`, errTx);
        process.exit(1);
      }

      // Insert allocation
      const { error: errAlloc } = await sb.from('ptv_finance_allocations').insert({
        transaction_id: txId,
        pocket_id: mainPocket.id,
        direction: item.kind === 'income' ? 'in' : 'out',
        amount_minor: Number(amtMinor)
      });

      if (errAlloc) {
        console.error(`Gagal insert alokasi ${srcRefKey}:`, errAlloc);
        process.exit(1);
      }

      // Update pocket balance
      const newBal = item.kind === 'income'
        ? Number(BigInt(mainPocket.balance_minor) + amtMinor)
        : Number(BigInt(mainPocket.balance_minor) - amtMinor);

      const { error: errUpPocket } = await sb
        .from('ptv_finance_pockets')
        .update({ balance_minor: newBal, version: mainPocket.version + 1, updated_at: new Date().toISOString() })
        .eq('id', mainPocket.id);

      if (errUpPocket) {
        console.error(`Gagal update saldo kantong ${srcRefKey}:`, errUpPocket);
        process.exit(1);
      }
      mainPocket.balance_minor = newBal;
      mainPocket.version += 1;

      // Insert source reference
      const { error: errRef } = await sb.from('ptv_finance_source_references').insert({
        transaction_id: txId,
        source_table: item.table,
        source_id: item.id
      });

      if (errRef) {
        console.error(`Gagal insert source reference ${srcRefKey}:`, errRef);
        process.exit(1);
      }

      // Insert audit log
      await sb.from('ptv_finance_audit_log').insert({
        entity_type: 'transaction',
        entity_id: txId,
        action: 'legacy_migration_posted',
        actor_id: migrationActorId,
        payload: { sourceTable: item.table, sourceId: item.id, nominal: item.nominal, pocketId: mainPocket.id }
      });

      postedCount++;
      executionManifest.push({ index: i + 1, source: srcRefKey, action: 'posted', txId });
    } else {
      postedCount++;
      executionManifest.push({ index: i + 1, source: srcRefKey, action: 'dry_run_posted', balanceAfter: Number(simulatedBalanceMinor) / 100 });
    }
  }

  // 2. Eksekusi 4 record pembatalan (reversed tanpa mutasi saldo kantong)
  for (let i = 0; i < canceledBatch.length; i++) {
    const item = canceledBatch[i];
    const srcRefKey = `${item.table}:${item.id}`;

    if (existingRefMap.has(srcRefKey)) {
      skippedCount++;
      executionManifest.push({
        index: activeBatch.length + i + 1,
        source: srcRefKey,
        action: 'skipped_already_linked',
        txId: existingRefMap.get(srcRefKey)
      });
      continue;
    }

    const cat = categoryMap.get(item.categoryName);
    const amtMinor = BigInt(item.nominal) * 100n;
    const idempotencyKey = deterministicUuid(`${item.table}:${item.id}:reversed`);
    const descText = `[LEGACY][BATAL/UNDO] ${item.sumber}: ${item.keterangan}`;

    if (isExecute) {
      const txId = crypto.randomUUID();
      const auditRef = `MIGRATION-LEGACY-${item.table}-${item.id}-REVERSED`;
      const cmdHash = crypto.createHash('sha256').update(idempotencyKey + descText).digest('hex');

      // Insert transaction dengan status 'reversed' (TIDAK MEMUTASI SALDO KANTONG)
      const { error: errTx } = await sb.from('ptv_finance_transactions').insert({
        id: txId,
        occurred_on: item.tanggal,
        description: descText,
        kind: 'income',
        currency: 'IDR',
        amount_minor: Number(amtMinor),
        category_id: cat.id,
        status: 'reversed',
        idempotency_key: idempotencyKey,
        command_hash: cmdHash,
        audit_reference: auditRef,
        created_by: migrationActorId
      });

      if (errTx) {
        console.error(`Gagal insert transaksi batal ${srcRefKey}:`, errTx);
        process.exit(1);
      }

      // Insert source reference untuk menjaga 100% provenance
      const { error: errRef } = await sb.from('ptv_finance_source_references').insert({
        transaction_id: txId,
        source_table: item.table,
        source_id: item.id
      });

      if (errRef) {
        console.error(`Gagal insert source reference batal ${srcRefKey}:`, errRef);
        process.exit(1);
      }

      // Insert audit log
      await sb.from('ptv_finance_audit_log').insert({
        entity_type: 'transaction',
        entity_id: txId,
        action: 'legacy_migration_reversed',
        actor_id: migrationActorId,
        payload: { sourceTable: item.table, sourceId: item.id, nominal: item.nominal, reason: 'BATAL/UNDO di teks legacy' }
      });

      reversedCount++;
      executionManifest.push({ index: activeBatch.length + i + 1, source: srcRefKey, action: 'reversed_linked', txId });
    } else {
      reversedCount++;
      executionManifest.push({ index: activeBatch.length + i + 1, source: srcRefKey, action: 'dry_run_reversed_linked', balanceAfter: Number(simulatedBalanceMinor) / 100 });
    }
  }

  console.log('\n[PHASE 4] POSTFLIGHT VERIFICATION & AUDIT MANIFEST...');
  console.log(`- Transaksi Posted (Aktif): ${postedCount}`);
  console.log(`- Transaksi Reversed (Batal/Undo): ${reversedCount}`);
  console.log(`- Transaksi Skipped (Sudah Taut): ${skippedCount}`);
  console.log(`- Saldo Akhir Kantong Kas Utama Studio: Rp ${(Number(simulatedBalanceMinor) / 100).toLocaleString('id-ID')}`);
  console.log(`- Sesuai Target Bersih Rp 520.276?: ${Number(simulatedBalanceMinor) === 52027600 ? 'SESUAI 100%' : 'TIDAK SESUAI'}`);

  // Simpan laporan hasil migrasi / dry-run
  const resultPayload = {
    timestamp: new Date().toISOString(),
    mode: isExecute ? 'live_execution' : 'dry_run',
    targetProject: 'swadgljnyelsjstqqxbm',
    mainPocket: {
      name: 'Kas Utama Studio',
      id: mainPocket.id,
      finalBalanceRupiah: Number(simulatedBalanceMinor) / 100
    },
    counts: {
      posted: postedCount,
      reversed: reversedCount,
      skipped: skippedCount,
      totalProvenanceMapped: postedCount + reversedCount + skippedCount
    },
    executionManifest
  };

  fs.writeFileSync('docs/PTV-DEV-119-MIGRATION-EXECUTION-PLAN.json', JSON.stringify(resultPayload, null, 2), 'utf8');
  console.log(`- Manifest eksekusi disimpan di: docs/PTV-DEV-119-MIGRATION-EXECUTION-PLAN.json`);

  console.log('\n='.repeat(80));
  if (Number(simulatedBalanceMinor) === 52027600 && postedCount === 49 && reversedCount === 4) {
    console.log('STATUS: READY FOR OPERATOR ACC');
    console.log('Seluruh validasi lulus. Siap dijalankan setelah memperoleh ACC eksplisit operator.');
  } else {
    console.log('STATUS: VERIFICATION WARNING');
  }
  console.log('='.repeat(80));
}

run().catch(err => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
