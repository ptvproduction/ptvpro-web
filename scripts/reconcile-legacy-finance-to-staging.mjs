import fs from 'node:fs';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseEnvFiles, resolveLegacyCredentials } from './sync-legacy-letters.mjs';

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

async function main() {
  const isExecute = process.argv.includes('--execute');
  console.log('='.repeat(80));
  console.log('PTVPRO — FINANCE 3.0 DATA RECONCILIATION & SYNC');
  console.log(`Mode   : ${isExecute ? 'LIVE CLOUD EXECUTION' : 'DRY-RUN (STRICT READ-ONLY)'}`);
  console.log(`Target : Supabase Staging swadgljnyelsjstqqxbm`);
  console.log('='.repeat(80));

  const env = parseEnvFiles();
  const stagingUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://swadgljnyelsjstqqxbm.supabase.co';
  const stagingKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stagingUrl || !stagingKey) {
    throw new Error('Kredensial Supabase Staging tidak ditemukan di env.');
  }

  // Safety checks
  if (stagingUrl.includes('jthzuhkblxcaohiuypqq')) {
    throw new Error('FATAL SAFETY VIOLATION: Target database mengarah ke legacy production!');
  }
  if (!stagingUrl.includes('swadgljnyelsjstqqxbm')) {
    throw new Error('FATAL: Target database bukan staging swadgljnyelsjstqqxbm!');
  }

  const legacyCreds = await resolveLegacyCredentials(env);
  if (!legacyCreds.url || !legacyCreds.key) {
    throw new Error('Kredensial Legacy tidak ditemukan.');
  }

  const legSb = createClient(legacyCreds.url, legacyCreds.key, { auth: { persistSession: false } });
  const stgSb = createClient(stagingUrl, stagingKey, { auth: { persistSession: false } });

  console.log('\n[1/5] FETCHING LEGACY OPERATIONAL DATA (READ-ONLY)...');
  const [legPemRes, legPengRes, legKasKruRes, legPeriodeRes] = await Promise.all([
    legSb.from('ptv_pemasukan').select('*').order('tanggal', { ascending: true }),
    legSb.from('ptv_pengeluaran').select('*').order('tanggal', { ascending: true }),
    legSb.from('ptv_kas_kru').select('*').order('periode_bulan', { ascending: true }),
    legSb.from('ptv_kas_periode').select('*').order('periode_bulan', { ascending: true })
  ]);

  if (legPemRes.error || legPengRes.error) {
    throw new Error(`Gagal membaca data legacy: ${legPemRes.error?.message || legPengRes.error?.message}`);
  }

  const legacyPemasukan = legPemRes.data || [];
  const legacyPengeluaran = legPengRes.data || [];
  const legacyKasKru = legKasKruRes.data || [];
  const legacyKasPeriode = legPeriodeRes.data || [];

  console.log(`✓ Legacy Pemasukan: ${legacyPemasukan.length} records`);
  console.log(`✓ Legacy Pengeluaran: ${legacyPengeluaran.length} records`);
  console.log(`✓ Legacy Kas Kru: ${legacyKasKru.length} records`);
  console.log(`✓ Legacy Kas Periode: ${legacyKasPeriode.length} records`);

  console.log('\n[2/5] FETCHING STAGING TARGET DATA...');
  const [stgPemRes, stgPengRes, stgTxRes, stgRefsRes, stgPocketsRes, stgCatsRes] = await Promise.all([
    stgSb.from('ptv_pemasukan').select('*'),
    stgSb.from('ptv_pengeluaran').select('*'),
    stgSb.from('ptv_finance_transactions').select('*'),
    stgSb.from('ptv_finance_source_references').select('*'),
    stgSb.from('ptv_finance_pockets').select('*'),
    stgSb.from('ptv_finance_categories').select('*')
  ]);

  const stgPem = stgPemRes.data || [];
  const stgPeng = stgPengRes.data || [];
  const stgTx = stgTxRes.data || [];
  const stgRefs = stgRefsRes.data || [];
  const stgPockets = stgPocketsRes.data || [];
  const stgCats = stgCatsRes.data || [];

  const mainPocket = stgPockets.find(p => p.name === 'Kas Utama Studio' && !p.archived);
  if (!mainPocket) {
    throw new Error('Kantong "Kas Utama Studio" tidak ditemukan di staging!');
  }

  console.log(`✓ Staging Pemasukan Mirror: ${stgPem.length} records`);
  console.log(`✓ Staging Pengeluaran Mirror: ${stgPeng.length} records`);
  console.log(`✓ Staging Transactions: ${stgTx.length} records`);
  console.log(`✓ Staging Source References: ${stgRefs.length} records`);
  console.log(`✓ Staging Pocket "${mainPocket.name}": Saldo saat ini Rp ${(mainPocket.balance_minor / 100).toLocaleString('id-ID')}`);

  console.log('\n[3/5] RECONCILIATION & DIFF DETECTION...');
  const existingRefsMap = new Set(stgRefs.map(r => `${r.source_table}:${r.source_id}`));
  const stgPemIds = new Set(stgPem.map(p => p.id));
  const stgPengIds = new Set(stgPeng.map(p => p.id));

  // Items to sync to staging mirror tables
  const missingPemMirror = legacyPemasukan.filter(p => !stgPemIds.has(p.id));
  const missingPengMirror = legacyPengeluaran.filter(p => !stgPengIds.has(p.id));

  // Items to sync to canonical ptv_finance_transactions
  const unlinkedLegacyPem = legacyPemasukan.filter(p => !existingRefsMap.has(`ptv_pemasukan:${p.id}`));
  const unlinkedLegacyPeng = legacyPengeluaran.filter(p => !existingRefsMap.has(`ptv_pengeluaran:${p.id}`));

  console.log(`- Pemasukan belum di mirror staging: ${missingPemMirror.length}`);
  console.log(`- Pengeluaran belum di mirror staging: ${missingPengMirror.length}`);
  console.log(`- Pemasukan belum di ledger kanonikal: ${unlinkedLegacyPem.length}`);
  console.log(`- Pengeluaran belum di ledger kanonikal: ${unlinkedLegacyPeng.length}`);

  // Resolve actor id for audit & RPC execution (Muhammad Zidnal Falah / root_executive)
  const zidnalAccountId = 'c08952de-a8ff-48e0-8182-ac0bb7ac6767';
  const actorId = zidnalAccountId;

  const catIuranKru = stgCats.find(c => c.name === 'Iuran Kru')?.id || 'e6852c70-5f57-436b-84e1-fc85752ad4dc';
  const catKonsumsi = stgCats.find(c => c.name === 'Konsumsi & Logistik')?.id || '064b9558-8d37-48ad-b179-19bc23f67b0b';

  let runningBalanceMinor = BigInt(mainPocket.balance_minor);
  const actionsToExecute = [];

  // Pemasukan sync queue
  for (const item of unlinkedLegacyPem) {
    const isBatal = item.keterangan && item.keterangan.includes('[BATAL/UNDO]');
    const amtMinor = BigInt(item.nominal) * 100n;
    const txId = deterministicUuid(`reconcile:v1:tx:${item.table}:${item.id}`);
    const idempotencyKey = deterministicUuid(`reconcile:v1:idem:${item.table}:${item.id}:${isBatal ? 'reversed' : 'posted'}`);
    const descText = isBatal
      ? `[LEGACY][BATAL/UNDO] ${item.sumber || 'Kas Kru'}: ${item.keterangan}`
      : `[LEGACY] ${item.sumber || 'Kas Kru'}: ${item.keterangan || ''}`;

    if (!isBatal) {
      runningBalanceMinor += amtMinor;
    }

    actionsToExecute.push({
      type: 'income',
      isBatal,
      sourceTable: 'ptv_pemasukan',
      sourceId: item.id,
      legacyItem: item,
      txId,
      idempotencyKey,
      descText,
      amountMinor: Number(amtMinor),
      categoryId: catIuranKru,
      status: isBatal ? 'reversed' : 'posted',
      occurredOn: item.tanggal,
      affectsPocket: !isBatal
    });
  }

  // Pengeluaran sync queue
  for (const item of unlinkedLegacyPeng) {
    const amtMinor = BigInt(item.nominal) * 100n;
    const txId = deterministicUuid(`reconcile:v1:tx:${item.table}:${item.id}`);
    const idempotencyKey = deterministicUuid(`reconcile:v1:idem:${item.table}:${item.id}:posted`);
    const descText = item.keterangan
      ? `[LEGACY] ${item.keperluan}: ${item.keterangan}`
      : `[LEGACY] ${item.keperluan}`;

    runningBalanceMinor -= amtMinor;

    actionsToExecute.push({
      type: 'expense',
      isBatal: false,
      sourceTable: 'ptv_pengeluaran',
      sourceId: item.id,
      legacyItem: item,
      txId,
      idempotencyKey,
      descText,
      amountMinor: Number(amtMinor),
      categoryId: catKonsumsi,
      status: 'posted',
      occurredOn: item.tanggal,
      affectsPocket: true
    });
  }

  console.log('\n[4/5] EXECUTION PLAN / SUMMARY:');
  console.log(`- Transaksi baru yang akan disinkronkan: ${actionsToExecute.length}`);
  actionsToExecute.forEach((a, i) => {
    console.log(`  ${i + 1}. [${a.status.toUpperCase()}] ${a.occurredOn} | Rp ${(a.amountMinor / 100).toLocaleString('id-ID')} | ${a.descText.slice(0, 70)}...`);
  });
  console.log(`- Saldo Kantong Sebelum: Rp ${(mainPocket.balance_minor / 100).toLocaleString('id-ID')}`);
  console.log(`- Saldo Kantong Sesudah: Rp ${(Number(runningBalanceMinor) / 100).toLocaleString('id-ID')}`);
  console.log(`- Target Saldo Dasbor Legacy: Rp 593.276`);
  console.log(`- Sesuai Target 100%: ${Number(runningBalanceMinor) === 59327600 ? 'YA (MATCH 100%)' : 'TIDAK'}`);

  if (isExecute) {
    console.log('\n[5/5] EXECUTING LIVE MIGRATION ON STAGING CLOUD...');

    // A. Sync mirror tables first
    if (missingPemMirror.length > 0) {
      console.log(`- Inserting ${missingPemMirror.length} rows to staging ptv_pemasukan...`);
      for (const m of missingPemMirror) {
        const { error } = await stgSb.from('ptv_pemasukan').upsert({
          id: m.id,
          tanggal: m.tanggal,
          sumber: m.sumber,
          nominal: m.nominal,
          keterangan: m.keterangan,
          created_at: m.created_at
        }, { onConflict: 'id' });
        if (error) throw new Error(`Failed to insert staging ptv_pemasukan ${m.id}: ${error.message}`);
      }
      console.log('  ✓ Staging ptv_pemasukan mirror synced.');
    }

    if (missingPengMirror.length > 0) {
      console.log(`- Inserting ${missingPengMirror.length} rows to staging ptv_pengeluaran...`);
      for (const m of missingPengMirror) {
        const { error } = await stgSb.from('ptv_pengeluaran').upsert({
          id: m.id,
          tanggal: m.tanggal,
          keperluan: m.keperluan,
          nominal: m.nominal,
          keterangan: m.keterangan,
          created_at: m.created_at
        }, { onConflict: 'id' });
        if (error) throw new Error(`Failed to insert staging ptv_pengeluaran ${m.id}: ${error.message}`);
      }
      console.log('  ✓ Staging ptv_pengeluaran mirror synced.');
    }

    // B. Insert transactions via canonical atomic RPCs
    console.log(`- Posting ${actionsToExecute.length} transactions via rpc_post_finance_transaction_server...`);
    for (const act of actionsToExecute) {
      const pocketAlloc = {
        pocketId: mainPocket.id,
        amountMinor: String(act.amountMinor)
      };

      const cmd = {
        version: 2,
        idempotencyKey: act.idempotencyKey,
        operation: act.type,
        occurredOn: act.occurredOn,
        description: act.descText,
        currency: 'IDR',
        amountMinor: String(act.amountMinor),
        categoryId: act.categoryId,
        incoming: act.type === 'income' ? [pocketAlloc] : [],
        outgoing: act.type === 'expense' ? [pocketAlloc] : [],
        sourceReferences: [
          {
            kind: act.sourceTable,
            id: act.sourceId
          }
        ]
      };

      const { data: txResult, error: errTx } = await stgSb.rpc('rpc_post_finance_transaction_server', {
        p_account_id: actorId,
        p_session_iat: Math.floor(Date.now() / 1000) - 10,
        p_command: cmd
      });

      if (errTx || !txResult?.success) {
        throw new Error(`Gagal rpc_post_finance_transaction_server for ${act.sourceTable}:${act.sourceId}: ${errTx?.message || 'Unknown error'}`);
      }

      const canonicalTxId = txResult.transaction_id;
      console.log(`  ✓ Posted ${act.type} tx ${canonicalTxId} for ${act.sourceTable}:${act.sourceId}`);

      // If it was cancelled [BATAL/UNDO], void it immediately
      if (act.isBatal) {
        const { error: errVoid } = await stgSb.rpc('rpc_void_finance_transaction_atomic', {
          p_account_id: actorId,
          p_session_iat: Math.floor(Date.now() / 1000) - 10,
          p_tx_id: canonicalTxId,
          p_reason: 'Legacy [BATAL/UNDO] synchronization'
        });
        if (errVoid) throw new Error(`Gagal void transaction ${canonicalTxId}: ${errVoid.message}`);
        console.log(`  ✓ Voided cancelled transaction ${canonicalTxId}`);
      }
    }

    // Verify final pocket balance from cloud
    const { data: updatedPocket } = await stgSb.from('ptv_finance_pockets').select('*').eq('id', mainPocket.id).single();
    console.log(`\n✓ Saldo Kas Utama Studio Terverifikasi di Cloud: Rp ${(updatedPocket.balance_minor / 100).toLocaleString('id-ID')}`);
  } else {
    console.log('\n[5/5] DRY-RUN SELESAI. Gunakan flag --execute untuk menjalankan migrasi ke cloud Staging.');
  }

  // Generate Report
  const report = {
    generated_at: new Date().toISOString(),
    session_id: 'PTV-DEV-236',
    operator: 'zidnal',
    mode: isExecute ? 'live_execution' : 'dry_run',
    legacy_source: {
      project: 'jthzuhkblxcaohiuypqq',
      pemasukan_total: legacyPemasukan.length,
      pemasukan_active: legacyPemasukan.filter(p => !p.keterangan?.includes('[BATAL/UNDO]')).length,
      pemasukan_batal: legacyPemasukan.filter(p => p.keterangan?.includes('[BATAL/UNDO]')).length,
      pemasukan_nominal_aktif: legacyPemasukan.filter(p => !p.keterangan?.includes('[BATAL/UNDO]')).reduce((s, p) => s + Number(p.nominal), 0),
      pengeluaran_total: legacyPengeluaran.length,
      pengeluaran_nominal: legacyPengeluaran.reduce((s, p) => s + Number(p.nominal), 0),
      kas_sebenarnya: legacyPemasukan.filter(p => !p.keterangan?.includes('[BATAL/UNDO]')).reduce((s, p) => s + Number(p.nominal), 0) - legacyPengeluaran.reduce((s, p) => s + Number(p.nominal), 0)
    },
    staging_target: {
      project: 'swadgljnyelsjstqqxbm',
      saldo_sebelum: mainPocket.balance_minor / 100,
      saldo_sesudah: Number(runningBalanceMinor) / 100,
      selisih_terselesaikan: (Number(runningBalanceMinor) - mainPocket.balance_minor) / 100,
      match_with_legacy: Number(runningBalanceMinor) === 59327600
    },
    synced_records: actionsToExecute.map(a => ({
      source_table: a.sourceTable,
      source_id: a.sourceId,
      occurred_on: a.occurredOn,
      nominal: a.amountMinor / 100,
      status: a.status,
      description: a.descText
    }))
  };

  fs.writeFileSync('docs/PTV-DEV-236-FINANCE-RECONCILIATION-REPORT.json', JSON.stringify(report, null, 2), 'utf8');
  console.log(`✓ Laporan rekonsiliasi tersimpan di docs/PTV-DEV-236-FINANCE-RECONCILIATION-REPORT.json`);
}

main().catch(err => {
  console.error('\n[FATAL ERROR]', err);
  process.exit(1);
});
