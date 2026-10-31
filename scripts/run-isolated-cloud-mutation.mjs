import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import handler from '../api/finance.ts';
import { signSessionToken } from '../api/auth/_utils/crypto.ts';
import { createClient } from '@supabase/supabase-js';

// Baca konfigurasi environment Staging
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
process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
process.env.AUTH_SECRET = env.AUTH_SECRET || env.VITE_AUTH_SECRET;

const targetUrl = process.env.VITE_SUPABASE_URL;
if (!targetUrl || !targetUrl.startsWith('https://swadgljnyelsjstqqxbm.supabase.co')) {
  console.error('FATAL: Target URL bukan project Staging swadgljnyelsjstqqxbm!');
  process.exit(1);
}

const sb = createClient(targetUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Helper request wrapper untuk memanggil handler API resmi
function invokeApi(method, cookie, body) {
  return new Promise((resolve, reject) => {
    const req = Object.assign(new EventEmitter(), {
      method,
      headers: {
        cookie: cookie || '',
        'content-type': 'application/json'
      },
      [Symbol.asyncIterator]: async function* () {
        if (body) {
          yield Buffer.from(JSON.stringify(body));
        }
      }
    });

    let statusCode = 200;
    let responseData = '';
    const headers = {};

    const res = {
      get statusCode() { return statusCode; },
      set statusCode(val) { statusCode = val; },
      setHeader(k, v) { headers[k.toLowerCase()] = v; },
      getHeader(k) { return headers[k.toLowerCase()]; },
      end(data) {
        if (data) responseData = data;
        let parsed = null;
        try { parsed = JSON.parse(responseData); } catch { parsed = responseData; }
        resolve({ statusCode, data: parsed });
      }
    };

    handler(req, res).catch(reject);
  });
}

async function run() {
  const timestamp = Math.floor(Date.now() / 1000);
  const runId = `PTV-DEV-117-TEST-${timestamp}`;
  const prefix = `[TEST][PTV-DEV-117]`;

  console.log('='.repeat(70));
  console.log(`PTV-DEV-117: LIVE ISOLATED CLOUD MUTATION TEST`);
  console.log(`Run ID: ${runId}`);
  console.log(`Target: swadgljnyelsjstqqxbm.supabase.co`);
  console.log('='.repeat(70));

  const manifest = {
    runId,
    timestamp: new Date().toISOString(),
    targetProjectRef: 'swadgljnyelsjstqqxbm',
    pockets: {},
    transactions: [],
    reconciliation: {},
    steps: []
  };

  // 1. Akun Pengelola Sah Staging
  const managerAccountId = 'bcd64337-3511-459b-a2b1-4d027b926fb7';
  const managerIdentityId = 'd00893ac-3d6b-4da8-b12f-2353cea729aa';
  
  // Buat session token sah untuk pengelola
  const now = Math.floor(Date.now() / 1000);
  const validManagerSession = {
    account_id: managerAccountId,
    identity_id: managerIdentityId,
    ptv_id: 'PTV-ADM-001',
    full_name: 'Super Executive Staging',
    username: 'root_exec',
    status_akun: 'active',
    status_organisasi: 'active',
    assigned_profiles: ['root_executive'],
    capabilities: ['hub.access', 'finance.manage', 'finance.view'],
    iat: now,
    exp: now + 3600
  };
  const managerCookie = `ptv_hub_session=${signSessionToken(validManagerSession, process.env.AUTH_SECRET)}`;

  // Ambil kategori income dan expense yang tersedia di Staging
  const { data: cats } = await sb.from('ptv_finance_categories').select('id, name, kind').eq('is_active', true);
  const incomeCat = cats.find(c => c.kind === 'income');
  const expenseCat = cats.find(c => c.kind === 'expense');

  console.log(`\nKategori rujukan:`);
  console.log(`- Income: ${incomeCat.name} (${incomeCat.id})`);
  console.log(`- Expense: ${expenseCat.name} (${expenseCat.id})`);

  // ========================================================================
  // LANGKAH 1: CREATE 2 POCKETS DUMMY DENGAN SALDO AWAL NOL
  // ========================================================================
  console.log(`\n--- LANGKAH 1: Create 2 Pockets Dummy ---`);
  
  // 1a. Kantong Kas A
  const resPocketA = await invokeApi('POST', managerCookie, {
    action: 'create_pocket',
    pocket: {
      name: `${prefix} Kas Uji Alpha`,
      kind: 'cash',
      provider: '',
      accountNumber: '',
      accountHolder: ''
    }
  });

  if (resPocketA.statusCode !== 200 || !resPocketA.data.pocket?.id) {
    throw new Error(`Gagal membuat Kantong A: ${JSON.stringify(resPocketA.data)}`);
  }
  const pocketA = resPocketA.data.pocket;
  console.log(`✅ Kantong Alpha dibuat: ${pocketA.name} (ID: ${pocketA.id}, balance: ${pocketA.balance_minor})`);

  // 1b. Kantong Bank B
  const resPocketB = await invokeApi('POST', managerCookie, {
    action: 'create_pocket',
    pocket: {
      name: `${prefix} Bank Uji Beta`,
      kind: 'bank',
      provider: 'BCA Uji',
      accountNumber: '999900001111',
      accountHolder: 'Studio Uji PTV'
    }
  });

  if (resPocketB.statusCode !== 200 || !resPocketB.data.pocket?.id) {
    throw new Error(`Gagal membuat Kantong B: ${JSON.stringify(resPocketB.data)}`);
  }
  const pocketB = resPocketB.data.pocket;
  console.log(`✅ Kantong Beta dibuat: ${pocketB.name} (ID: ${pocketB.id}, balance: ${pocketB.balance_minor})`);

  manifest.pockets.alpha = { id: pocketA.id, name: pocketA.name };
  manifest.pockets.beta = { id: pocketB.id, name: pocketB.name };
  manifest.steps.push({ step: 'create_pockets', success: true });

  // Verifikasi database nyata
  const { data: dbPockets } = await sb.from('ptv_finance_pockets').select('*').in('id', [pocketA.id, pocketB.id]);
  if (dbPockets.length !== 2 || dbPockets.some(p => p.balance_minor !== 0)) {
    throw new Error('Verifikasi DB Kantong awal gagal!');
  }
  console.log(`✅ Verifikasi DB: 2 kantong aktif di cloud dengan balance_minor = 0.`);

  // ========================================================================
  // LANGKAH 2: INCOME Rp 100.000 KE KANTONG ALPHA
  // ========================================================================
  console.log(`\n--- LANGKAH 2: Pemasukan Rp 100.000 ke Kantong Alpha ---`);
  const incomeKey = crypto.randomUUID();
  const incomeCmd = {
    version: 2,
    idempotencyKey: incomeKey,
    operation: 'income',
    currency: 'IDR',
    occurredOn: new Date().toISOString().slice(0, 10),
    description: `${prefix} Pemasukan Uji Alpha`,
    amountMinor: '10000000', // Rp 100.000
    categoryId: incomeCat.id,
    incoming: [{ pocketId: pocketA.id, amountMinor: '10000000' }],
    outgoing: []
  };

  const resIncome = await invokeApi('POST', managerCookie, {
    action: 'post_transaction',
    command: incomeCmd
  });

  if (resIncome.statusCode !== 200 || !resIncome.data.transaction_id) {
    throw new Error(`Gagal pemasukan: ${JSON.stringify(resIncome.data)}`);
  }
  console.log(`✅ Pemasukan berhasil dicatat: TX ID = ${resIncome.data.transaction_id}`);
  manifest.transactions.push({ action: 'income', id: resIncome.data.transaction_id, amountMinor: '10000000', key: incomeKey });

  // Verifikasi saldo cloud Kantong Alpha
  const { data: pAlphaAfterInc } = await sb.from('ptv_finance_pockets').select('balance_minor, version').eq('id', pocketA.id).single();
  console.log(`✅ Verifikasi DB Saldo Alpha: ${pAlphaAfterInc.balance_minor} (Ekspektasi: 10000000, version: ${pAlphaAfterInc.version})`);
  if (pAlphaAfterInc.balance_minor !== 10000000) throw new Error('Saldo Alpha tidak cocok setelah income!');

  // ========================================================================
  // LANGKAH 3: TRANSFER Rp 40.000 DARI ALPHA KE BETA
  // ========================================================================
  console.log(`\n--- LANGKAH 3: Transfer Rp 40.000 dari Alpha ke Beta ---`);
  const transferKey = crypto.randomUUID();
  const transferCmd = {
    version: 2,
    idempotencyKey: transferKey,
    operation: 'transfer',
    currency: 'IDR',
    occurredOn: new Date().toISOString().slice(0, 10),
    description: `${prefix} Transfer Uji Alpha ke Beta`,
    amountMinor: '4000000', // Rp 40.000
    incoming: [{ pocketId: pocketB.id, amountMinor: '4000000' }],
    outgoing: [{ pocketId: pocketA.id, amountMinor: '4000000' }]
  };

  const resTransfer = await invokeApi('POST', managerCookie, {
    action: 'post_transaction',
    command: transferCmd
  });

  if (resTransfer.statusCode !== 200 || !resTransfer.data.transaction_id) {
    throw new Error(`Gagal transfer: ${JSON.stringify(resTransfer.data)}`);
  }
  console.log(`✅ Transfer berhasil dicatat: TX ID = ${resTransfer.data.transaction_id}`);
  manifest.transactions.push({ action: 'transfer', id: resTransfer.data.transaction_id, amountMinor: '4000000', key: transferKey });

  // Verifikasi saldo kedua kantong di cloud
  const { data: pAfterTrans } = await sb.from('ptv_finance_pockets').select('id, balance_minor').in('id', [pocketA.id, pocketB.id]);
  const balA = pAfterTrans.find(p => p.id === pocketA.id).balance_minor;
  const balB = pAfterTrans.find(p => p.id === pocketB.id).balance_minor;
  console.log(`✅ Verifikasi DB: Saldo Alpha = ${balA} (Ekspektasi: 6000000), Saldo Beta = ${balB} (Ekspektasi: 4000000)`);
  if (balA !== 6000000 || balB !== 4000000) throw new Error('Saldo tidak seimbang setelah transfer!');

  // ========================================================================
  // LANGKAH 4: EXPENSE Rp 15.000 DARI KANTONG BETA
  // ========================================================================
  console.log(`\n--- LANGKAH 4: Pengeluaran Rp 15.000 dari Kantong Beta ---`);
  const expenseKey = crypto.randomUUID();
  const expenseCmd = {
    version: 2,
    idempotencyKey: expenseKey,
    operation: 'expense',
    currency: 'IDR',
    occurredOn: new Date().toISOString().slice(0, 10),
    description: `${prefix} Pengeluaran Uji Operasional Beta`,
    amountMinor: '1500000', // Rp 15.000
    categoryId: expenseCat.id,
    incoming: [],
    outgoing: [{ pocketId: pocketB.id, amountMinor: '1500000' }]
  };

  const resExpense = await invokeApi('POST', managerCookie, {
    action: 'post_transaction',
    command: expenseCmd
  });

  if (resExpense.statusCode !== 200 || !resExpense.data.transaction_id) {
    throw new Error(`Gagal pengeluaran: ${JSON.stringify(resExpense.data)}`);
  }
  console.log(`✅ Pengeluaran berhasil dicatat: TX ID = ${resExpense.data.transaction_id}`);
  manifest.transactions.push({ action: 'expense', id: resExpense.data.transaction_id, amountMinor: '1500000', key: expenseKey });

  // Verifikasi saldo Beta di cloud
  const { data: pBetaAfterExp } = await sb.from('ptv_finance_pockets').select('balance_minor').eq('id', pocketB.id).single();
  console.log(`✅ Verifikasi DB Saldo Beta: ${pBetaAfterExp.balance_minor} (Ekspektasi: 2500000 / Rp 25.000)`);
  if (pBetaAfterExp.balance_minor !== 2500000) throw new Error('Saldo Beta tidak cocok setelah expense!');

  // ========================================================================
  // LANGKAH 5: NEGATIVE BALANCE REJECTION (UJI PENOLAKAN SALDO NEGATIF)
  // ========================================================================
  console.log(`\n--- LANGKAH 5: Uji Penolakan Saldo Negatif (Overdraft) ---`);
  const overdraftKey = crypto.randomUUID();
  const overdraftCmd = {
    version: 2,
    idempotencyKey: overdraftKey,
    operation: 'expense',
    currency: 'IDR',
    occurredOn: new Date().toISOString().slice(0, 10),
    description: `${prefix} Tarik Melebihi Saldo`,
    amountMinor: '10000000', // Coba tarik Rp 100.000 dari Beta (saldo hanya Rp 25.000)
    categoryId: expenseCat.id,
    incoming: [],
    outgoing: [{ pocketId: pocketB.id, amountMinor: '10000000' }]
  };

  const resOverdraft = await invokeApi('POST', managerCookie, {
    action: 'post_transaction',
    command: overdraftCmd
  });

  console.log(`Respon overdraft: Status ${resOverdraft.statusCode}, Error: ${resOverdraft.data?.error}`);
  if (resOverdraft.statusCode === 200) {
    throw new Error('FATAL: Penarikan melebihi saldo tidak ditolak!');
  }
  console.log(`✅ Penolakan saldo negatif berhasil: RPC mengembalikan status ${resOverdraft.statusCode}.`);

  // Pastikan saldo Beta di cloud sama sekali tidak berubah
  const { data: pBetaCheck } = await sb.from('ptv_finance_pockets').select('balance_minor').eq('id', pocketB.id).single();
  if (pBetaCheck.balance_minor !== 2500000) throw new Error('Saldo Beta berubah setelah percobaan overdraft!');
  console.log(`✅ Verifikasi DB: Saldo Beta tetap stabil di 2500000.`);

  // ========================================================================
  // LANGKAH 6: IDEMPOTENCY REPLAY & CONFLICT REJECTION
  // ========================================================================
  console.log(`\n--- LANGKAH 6: Uji Idempotency Replay & Key Conflict ---`);
  // 6a. Replay Identik (mengulangi incomeCmd dengan incomeKey yang sama)
  const resReplay = await invokeApi('POST', managerCookie, {
    action: 'post_transaction',
    command: incomeCmd
  });

  if (resReplay.statusCode !== 200 || !resReplay.data.idempotent_replay) {
    throw new Error(`Gagal idempotent replay: ${JSON.stringify(resReplay.data)}`);
  }
  console.log(`✅ Idempotent replay berhasil: ${resReplay.data.message} (Replay: ${resReplay.data.idempotent_replay})`);

  // 6b. Key Conflict (menggunakan incomeKey yang sama tapi amountMinor berbeda)
  const conflictCmd = {
    ...incomeCmd,
    amountMinor: '99000000',
    incoming: [{ pocketId: pocketA.id, amountMinor: '99000000' }]
  };
  const resConflict = await invokeApi('POST', managerCookie, {
    action: 'post_transaction',
    command: conflictCmd
  });

  console.log(`Respon key conflict: Status ${resConflict.statusCode}, Error: ${resConflict.data?.error}`);
  if (resConflict.statusCode === 200) {
    throw new Error('FATAL: Key conflict dengan payload berbeda tidak ditolak!');
  }
  console.log(`✅ Idempotency conflict berhasil ditolak dengan kode ${resConflict.data?.code || resConflict.statusCode}.`);

  // ========================================================================
  // LANGKAH 7: SECURITY & AUTHORIZATION TESTS
  // ========================================================================
  console.log(`\n--- LANGKAH 7: Uji Akses Tidak Sah & Actor Spoofing ---`);
  // 7a. Tanpa Cookie
  const resNoAuth = await invokeApi('POST', '', {
    action: 'create_pocket',
    pocket: { name: 'Kas Ilegal', kind: 'cash', provider: '', accountNumber: '', accountHolder: '' }
  });
  console.log(`✅ Request tanpa sesi ditolak: Status ${resNoAuth.statusCode} (401)`);
  if (resNoAuth.statusCode !== 401) throw new Error('Tanpa sesi tidak ditolak 401!');

  // 7b. Role Read-only (tanpa finance.manage)
  const viewerSession = {
    ...validManagerSession,
    account_id: '33333333-3333-3333-3333-333333333333',
    assigned_profiles: ['guest'],
    capabilities: ['hub.access', 'finance.view'] // hanya view
  };
  const viewerCookie = `ptv_hub_session=${signSessionToken(viewerSession, process.env.AUTH_SECRET)}`;
  const resViewer = await invokeApi('POST', viewerCookie, {
    action: 'create_pocket',
    pocket: { name: 'Kas Viewer Ilegal', kind: 'cash', provider: '', accountNumber: '', accountHolder: '' }
  });
  console.log(`✅ Role read-only ditolak mutasi: Status ${resViewer.statusCode} (403)`);
  if (resViewer.statusCode !== 403) throw new Error('Role read-only tidak ditolak 403!');

  // ========================================================================
  // LANGKAH 8: ARCHIVE GUARD (KIRIM PENOLAKAN KANTONG BERSALDO > 0)
  // ========================================================================
  console.log(`\n--- LANGKAH 8: Uji Guard Pengarsipan Kantong Bersaldo ---`);
  // Coba arsipkan Kantong A yang memiliki saldo Rp 60.000
  const resArchiveFail = await invokeApi('POST', managerCookie, {
    action: 'archive_pocket',
    pocketId: pocketA.id
  });
  console.log(`Respon arsip kantong bersaldo: Status ${resArchiveFail.statusCode}, Error: ${resArchiveFail.data?.error}`);
  if (resArchiveFail.statusCode === 200) {
    throw new Error('FATAL: Kantong bersaldo berhasil diarsipkan!');
  }
  console.log(`✅ Guard arsip berhasil: Kantong bersaldo ditolak diarsipkan.`);

  // ========================================================================
  // LANGKAH 9: TRANSAKSI PENYEIMBANG RESMI DUMMY (DRAINING SALDO KE NOL)
  // ========================================================================
  console.log(`\n--- LANGKAH 9: Transaksi Penyeimbang Resmi Dummy ke Rp 0 ---`);
  // Saldo saat ini: Alpha = Rp 60.000, Beta = Rp 25.000
  // Buat expense penyeimbang Alpha Rp 60.000
  const drainKeyA = crypto.randomUUID();
  const drainCmdA = {
    version: 2,
    idempotencyKey: drainKeyA,
    operation: 'expense',
    currency: 'IDR',
    occurredOn: new Date().toISOString().slice(0, 10),
    description: `${prefix} Penyeimbang Uji Draining Alpha ke Nol`,
    amountMinor: '6000000',
    categoryId: expenseCat.id,
    incoming: [],
    outgoing: [{ pocketId: pocketA.id, amountMinor: '6000000' }]
  };
  const resDrainA = await invokeApi('POST', managerCookie, { action: 'post_transaction', command: drainCmdA });
  if (resDrainA.statusCode !== 200) throw new Error('Gagal penyeimbang Alpha!');
  console.log(`✅ Penyeimbang Alpha tercatat: TX ID = ${resDrainA.data.transaction_id}`);
  manifest.transactions.push({ action: 'expense_drain_alpha', id: resDrainA.data.transaction_id, amountMinor: '6000000', key: drainKeyA });

  // Buat expense penyeimbang Beta Rp 25.000
  const drainKeyB = crypto.randomUUID();
  const drainCmdB = {
    version: 2,
    idempotencyKey: drainKeyB,
    operation: 'expense',
    currency: 'IDR',
    occurredOn: new Date().toISOString().slice(0, 10),
    description: `${prefix} Penyeimbang Uji Draining Beta ke Nol`,
    amountMinor: '2500000',
    categoryId: expenseCat.id,
    incoming: [],
    outgoing: [{ pocketId: pocketB.id, amountMinor: '2500000' }]
  };
  const resDrainB = await invokeApi('POST', managerCookie, { action: 'post_transaction', command: drainCmdB });
  if (resDrainB.statusCode !== 200) throw new Error('Gagal penyeimbang Beta!');
  console.log(`✅ Penyeimbang Beta tercatat: TX ID = ${resDrainB.data.transaction_id}`);
  manifest.transactions.push({ action: 'expense_drain_beta', id: resDrainB.data.transaction_id, amountMinor: '2500000', key: drainKeyB });

  // ========================================================================
  // LANGKAH 10: ARSIP KANTONG DUMMY BERSALDO NOL SECARA RESMI
  // ========================================================================
  console.log(`\n--- LANGKAH 10: Pengarsipan Resmi Kantong Dummy Bersaldo Nol ---`);
  // Verifikasi saldo nol di database cloud sebelum arsip
  const { data: finalPockets } = await sb.from('ptv_finance_pockets').select('id, balance_minor, version').in('id', [pocketA.id, pocketB.id]);
  for (const p of finalPockets) {
    console.log(`- Pocket ${p.id}: balance_minor = ${p.balance_minor}, version = ${p.version}`);
    if (p.balance_minor !== 0) throw new Error(`Pocket ${p.id} saldo belum nol!`);
  }

  // Arsipkan Alpha
  const resArcA = await invokeApi('POST', managerCookie, { action: 'archive_pocket', pocketId: pocketA.id });
  if (resArcA.statusCode !== 200) throw new Error('Gagal arsipkan Alpha!');
  console.log(`✅ Kantong Alpha berhasil diarsipkan.`);

  // Arsipkan Beta
  const resArcB = await invokeApi('POST', managerCookie, { action: 'archive_pocket', pocketId: pocketB.id });
  if (resArcB.statusCode !== 200) throw new Error('Gagal arsipkan Beta!');
  console.log(`✅ Kantong Beta berhasil diarsipkan.`);

  manifest.steps.push({ step: 'archive_pockets', success: true });

  // ========================================================================
  // LANGKAH 11: REKONSILIASI PENUH & AUDIT TRAIL
  // ========================================================================
  console.log(`\n--- LANGKAH 11: Rekonsiliasi & Pemeriksaan Audit Trail Cloud ---`);
  // Cek alokasi untuk transaksi dummy
  const dummyTxIds = manifest.transactions.map(t => t.id);
  const { data: dummyAllocations } = await sb.from('ptv_finance_allocations').select('*').in('transaction_id', dummyTxIds);
  console.log(`✅ Terverifikasi ${dummyAllocations.length} baris alokasi terbentuk di ptv_finance_allocations.`);

  // Cek audit log dummy
  const { data: dummyAudit } = await sb.from('ptv_finance_audit_log').select('*').order('occurred_at', { ascending: true });
  console.log(`✅ Terverifikasi ${dummyAudit.length} rekaman audit trail tercatat di ptv_finance_audit_log.`);

  // Cek keutuhan data legacy 53 baris
  const [chkInc, chkExp] = await Promise.all([
    sb.from('ptv_pemasukan').select('nominal'),
    sb.from('ptv_pengeluaran').select('nominal')
  ]);
  const incCount = chkInc.data.length;
  const expCount = chkExp.data.length;
  const incSum = chkInc.data.reduce((s, r) => s + Number(r.nominal || 0), 0);
  const expSum = chkExp.data.reduce((s, r) => s + Number(r.nominal || 0), 0);

  if (incCount !== 43 || incSum !== 1244200 || expCount !== 10 || expSum !== 633924) {
    throw new Error('FATAL REGRESI: Data baseline legacy berubah selama pengujian!');
  }
  console.log(`✅ Data legacy 53 record (Rp 1.244.200 & Rp 633.924) 100% UTUH.`);

  manifest.reconciliation = {
    dummyTransactionsCount: dummyTxIds.length,
    dummyAllocationsCount: dummyAllocations.length,
    totalAuditLogsCount: dummyAudit.length,
    finalPocketBalances: { alpha: 0, beta: 0 },
    legacyIntegrity: '100% UTUH (53 baris Rp 1.244.200 & Rp 633.924)'
  };

  // Simpan manifest lokal tanpa kredensial
  fs.writeFileSync('docs/PTV-DEV-117-MUTATION-MANIFEST.json', JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\nManifest uji mutasi cloud disimpan di docs/PTV-DEV-117-MUTATION-MANIFEST.json`);

  console.log('\n' + '='.repeat(70));
  console.log('HASIL AKHIR: PTV-DEV-117 LIVE CLOUD MUTATION TEST ALL PASS!');
  console.log('='.repeat(70));
}

run().catch(err => {
  console.error('FATAL ERROR DALAM PENGUJIAN MUTASI CLOUD:', err);
  process.exit(1);
});
