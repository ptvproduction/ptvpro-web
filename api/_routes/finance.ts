import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseCookies } from './auth/_utils/cookies';
import { verifySessionToken } from './auth/_utils/crypto';
import { parseBody } from './auth/_utils/bodyParser';
import type { SessionPayload } from './auth/_utils/types';
import { resolveFinanceAccess, clearFinanceAccessCache, type FinanceAccess } from './financeAccess';
import type { FinanceSnapshot, FinanceEntry } from '../../src/products/hub/keuangan/financeFoundation';
import { multiPocketCommandSchema } from '../../src/products/hub/keuangan/financeCanonical';
import { financeBackendUrl } from './auth/_utils/financeLocalHarness';
import { financeMaintenanceActive, financeMaintenanceResponse } from './financeMaintenance';
import { readFinanceOperational } from './financeOperationalRead';
import {
  KAS_KRU_TARIFF_CONFIG_ROW_ID,
  fetchKasKruTariffConfigWithClient,
  fetchSemestersCloudWithClient,
} from '../../src/products/hub/keuangan/financeOperationalReader';
import type { KasKruFeeHistoryEntry } from '../../src/products/hub/keuangan/kasKruTypes';

export class FinanceScopeUnavailableError extends Error {
  readonly code = 'FINANCE_SCOPE_NOT_INSTALLED';
  constructor() { super('read_failed'); }
}

export async function readFinance(db: SupabaseClient, access: FinanceAccess, session?: Pick<SessionPayload, 'account_id' | 'iat'>): Promise<FinanceSnapshot> {
  if (!session) throw new Error('read_failed');
  const initialScope = await db.rpc('rpc_finance_visible_transactions_server', {
    p_account_id: session.account_id, p_session_iat: session.iat, p_transaction_ids: [],
  });
  if (initialScope.error?.code === '42501') {
    throw new Error('forbidden');
  }
  if (initialScope.error?.code === 'PGRST202' || initialScope.error?.code === '42883') {
    throw new FinanceScopeUnavailableError();
  }
  const verified = initialScope.data;
  if (initialScope.error || !verified || verified.identityId !== access.identityId
    || typeof verified.canManage !== 'boolean' || typeof verified.global !== 'boolean') throw new Error('read_failed');
  access = { identityId: verified.identityId, canManage: verified.canManage, global: verified.global };
  // ptv_kas_kru is superseded by ptv_finance_kas_records in staging
  const kasRows: any[] = [];





  const snapshot: FinanceSnapshot = {
    source: 'staging',
    canManage: access.canManage,
    scope: access.global ? 'global' : 'own',
    counts: null,
    entries: [],
    kas: kasRows.map(row => ({ id: row.id, period: row.bulan_tahun, amount: Number(row.nominal), status: row.status_bayar })),
    limited: kasRows.length === 100,
    writesEnabled: access.canManage && !financeMaintenanceActive(),
    canonical: { state: 'awaiting_schema', pockets: null, transactions: null }
  };

  if (!access.global) return snapshot;

  let incomeCount = 0;
  let expenseCount = 0;
  let ledgerCount = 0;
  let legacyEntries: FinanceEntry[] = [];

  try {
    const [income, expense, ledger] = await Promise.all([
      db.from('ptv_pemasukan').select('id,sumber,nominal,tanggal,keterangan', { count: 'exact' }).order('tanggal', { ascending: false }).limit(100),
      db.from('ptv_pengeluaran').select('id,keperluan,nominal,tanggal,keterangan', { count: 'exact' }).order('tanggal', { ascending: false }).limit(100),
      db.from('ptv_keuangan').select('id', { count: 'exact', head: true }),
    ]);
    if (!income.error && !expense.error && !ledger.error) {
      incomeCount = income.count ?? 0;
      expenseCount = expense.count ?? 0;
      ledgerCount = ledger.count ?? 0;
      legacyEntries = [
        ...(income.data || []).map(row => ({ id: row.id, label: row.sumber, description: row.keterangan, amount: Number(row.nominal), date: row.tanggal, kind: 'pemasukan' as const })),
        ...(expense.data || []).map(row => ({ id: row.id, label: row.keperluan, description: row.keterangan, amount: Number(row.nominal), date: row.tanggal, kind: 'pengeluaran' as const })),
      ];
    }
  } catch {
    // Non-fatal if legacy tables are empty or consolidated
  }

  snapshot.counts = { income: incomeCount, expense: expenseCount, ledger: ledgerCount };
  snapshot.entries = legacyEntries.sort((a: FinanceEntry, b: FinanceEntry) => (b.date || '').localeCompare(a.date || ''));
  snapshot.limited ||= incomeCount > 100 || expenseCount > 100;

  // Query canonical Finance 2.0 tables if available
  try {
    const [pocketsRes, txRes, catRes] = await Promise.all([
      db.from('ptv_finance_pockets').select('*').order('name', { ascending: true }),
      db.from('ptv_finance_transactions').select('*', { count: 'exact' }).order('occurred_on', { ascending: false }).order('id', { ascending: false }).limit(100),
      db.from('ptv_finance_categories').select('*').order('name', { ascending: true }),
    ]);

    if (pocketsRes.error || txRes.error || catRes.error || !pocketsRes.data || !txRes.data || !catRes.data) throw new Error('read_failed');
    snapshot.limited ||= txRes.count == null ? txRes.data.length >= 100 : txRes.count > 100;
    {
      // The service-role client bypasses RLS. Resolve loan privacy using the live database actor.
      if (!session) throw new Error('read_failed');
      const scope = await db.rpc('rpc_finance_visible_transactions_server', {
        p_account_id: session.account_id,
        p_session_iat: session.iat,
        p_transaction_ids: txRes.data.map((t: { id: string }) => t.id),
      });
      if (scope.error || !scope.data || scope.data.identityId !== access.identityId
        || typeof scope.data.canManage !== 'boolean' || typeof scope.data.global !== 'boolean'
        || !Array.isArray(scope.data.visibleTransactionIds) || !scope.data.global) throw new Error('read_failed');
      const visible = new Set(scope.data.visibleTransactionIds);
      snapshot.canManage = scope.data.canManage;
      snapshot.writesEnabled = scope.data.canManage && !financeMaintenanceActive();
      snapshot.limited ||= txRes.data.some((t: { id: string }) => !visible.has(t.id));
      txRes.data = txRes.data.filter((t: { id: string }) => visible.has(t.id));
      // Legacy free-text entries cannot reliably identify private loan descriptions.
      if (!scope.data.canManage) snapshot.entries = [];
    }
    if (pocketsRes.data && txRes.data) {
      const txIds = txRes.data.map((t: { id: string }) => t.id);
      let allocations: any[] = [];
      let sourceRefs: any[] = [];
      if (txIds.length > 0) {
        const [allocRes, srcRes] = await Promise.all([
          db.from('ptv_finance_allocations').select('*').in('transaction_id', txIds),
          db.from('ptv_finance_source_references').select('*').in('transaction_id', txIds),
        ]);
        if (allocRes.error || srcRes.error || !allocRes.data || !srcRes.data) throw new Error('read_failed');
        allocations = allocRes.data;
        sourceRefs = srcRes.data;
      }

      const allocMap = new Map<string, any[]>();
      for (const a of allocations) {
        if (!allocMap.has(a.transaction_id)) allocMap.set(a.transaction_id, []);
        allocMap.get(a.transaction_id)!.push({
          pocketId: a.pocket_id,
          amountMinor: String(a.amount_minor),
          direction: a.direction,
        });
      }

      const srcMap = new Map<string, any[]>();
      for (const s of sourceRefs) {
        if (!srcMap.has(s.transaction_id)) srcMap.set(s.transaction_id, []);
        srcMap.get(s.transaction_id)!.push({
          id: s.source_id,
          kind: s.source_table.replace(/^ptv_/, ''),
        });
      }

      const categories = (catRes.data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        isActive: c.is_active,
      }));

      snapshot.canonical = {
        state: 'available',
        pockets: pocketsRes.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          provider: p.provider || '',
          accountNumber: p.account_number || '',
          accountHolder: p.account_holder || '',
          archived: p.archived,
          version: p.version,
          balanceMinor: String(p.balance_minor),
          qris: p.qris_asset_path ? {
            assetPath: p.qris_asset_path,
            merchantName: p.qris_merchant_name,
            nmid: p.qris_nmid,
            verifiedAt: p.qris_verified_at,
          } : null,
        })),
        transactions: txRes.data.map((t: any) => ({
          id: t.id,
          occurredOn: t.occurred_on,
          description: t.description,
          kind: t.kind,
          amountMinor: String(t.amount_minor),
          status: t.status,
          auditReference: t.audit_reference,
          allocations: allocMap.get(t.id) || [],
          sourceReferences: srcMap.get(t.id) || [],
          categoryId: t.category_id || undefined,
          proofUrl: t.proof_url || undefined,
          notes: t.notes || undefined,
          recordedBy: t.recorded_by || undefined,
        })),
        categories,
      };
    }
  } catch {
    throw new Error('read_failed');
  }

  return snapshot;
}


export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status: number, body: unknown) => { res.statusCode = status; res.end(JSON.stringify(body)); };

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '') && financeMaintenanceActive()) {
    res.setHeader('Retry-After', '60');
    send(503, financeMaintenanceResponse);
    return;
  }
  if (req.method === 'GET' && new URL(req.url || '/', 'http://localhost').searchParams.get('maintenance') === '1') {
    if (financeMaintenanceActive()) {
      res.setHeader('Retry-After', '60');
      send(503, financeMaintenanceResponse);
    } else {
      send(200, { maintenance: false });
    }
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    send(405, { error: 'Metode HTTP tidak didukung. Gunakan GET atau POST.' });
    return;
  }

  const secret = process.env.AUTH_SECRET;
  const token = parseCookies(req.headers.cookie)['ptv_hub_session'];
  const session = secret && token ? verifySessionToken(token, secret) : null;
  if (!session) {
    send(401, { error: 'Sesi tidak valid. Silakan masuk kembali.' });
    return;
  }

  let url: string;
  try { url = financeBackendUrl(); } catch {
    send(503, { error: 'Finance hanya tersedia pada backend Staging yang terverifikasi.' });
    return;
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    send(503, { error: 'Finance hanya tersedia pada backend Staging yang terverifikasi.' });
    return;
  }

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) }
  });

  try {
    const access = await resolveFinanceAccess(db, session);

    if (req.method === 'GET') {
      if (new URL(req.url || '/', 'http://localhost').searchParams.get('operational') === '1') {
        send(200, await readFinanceOperational(db, access, session));
        return;
      }
      send(200, await readFinance(db, access, session));
      return;
    }

    clearFinanceAccessCache(session.account_id);
    if (!access.canManage) {
      send(403, { error: 'Akses ditolak: Operasi penulisan keuangan memerlukan hak Bendahara, Eksekutif, atau Root.' });
      return;
    }

    if (req.headers['sec-fetch-site'] === 'cross-site' ||
        (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)) throw new Error('forbidden');
    if (req.headers['content-type'] && !req.headers['content-type'].toLowerCase().startsWith('application/json')) {
      send(415, { error: 'Permintaan keuangan harus berupa JSON.' });
      return;
    }
    const payload = await parseBody(req);
    const action = payload?.action;

    if (action === 'post_kas_payment_atomic') {
      const command = multiPocketCommandSchema.parse(payload.command);
      const kasPayload = payload?.kasPayload;
      if (!kasPayload || typeof kasPayload !== 'object') {
        send(400, { error: 'Payload kas kru tidak valid.' });
        return;
      }

      const { data, error } = await db.rpc('rpc_record_kas_kru_payment_atomic', {
        p_account_id: session.account_id,
        p_session_iat: session.iat,
        p_command: command,
        p_kas_payload: kasPayload,
      });

      if (error) {
        const isFreeze = error.code === '55000' || error.message?.includes('freeze');
        const status = isFreeze ? 503 : error.code === '42501' ? 403 : error.code === '23505' ? 409 : 400;
        send(status, {
          code: isFreeze ? 'FINANCE_FREEZE_ACTIVE' : error.code,
          error: isFreeze
            ? 'Pencatatan kas ditahan oleh perlindungan freeze Finance151. Data staging tetap utuh.'
            : `Pencatatan kas kru gagal: ${error.message}`,
        });
        return;
      }
      send(200, data);
      return;
    }

    if (action === 'disburse_loan_atomic') {
      const command = multiPocketCommandSchema.parse(payload.command);
      const loanPayload = payload?.loanPayload;
      if (!loanPayload || typeof loanPayload !== 'object') {
        send(400, { error: 'Payload piutang tidak valid.' });
        return;
      }

      const { data, error } = await db.rpc('rpc_disburse_loan_atomic', {
        p_account_id: session.account_id,
        p_session_iat: session.iat,
        p_command: command,
        p_loan_payload: loanPayload,
      });

      if (error) {
        const isFreeze = error.code === '55000' || error.message?.includes('freeze');
        const status = isFreeze ? 503 : error.code === '42501' ? 403 : error.code === '23505' ? 409 : 400;
        send(status, {
          code: isFreeze ? 'FINANCE_FREEZE_ACTIVE' : error.code,
          error: isFreeze
            ? 'Pencairan piutang ditahan oleh perlindungan freeze Finance151. Data staging tetap utuh.'
            : `Pencairan piutang gagal: ${error.message}`,
        });
        return;
      }
      send(200, data);
      return;
    }

    if (action === 'post_loan_payment_atomic') {
      const command = multiPocketCommandSchema.parse(payload.command);
      const paymentPayload = payload?.paymentPayload;
      if (!paymentPayload || typeof paymentPayload !== 'object') {
        send(400, { error: 'Payload cicilan piutang tidak valid.' });
        return;
      }

      const { data, error } = await db.rpc('rpc_record_loan_payment_atomic', {
        p_account_id: session.account_id,
        p_session_iat: session.iat,
        p_command: command,
        p_payment_payload: paymentPayload,
      });

      if (error) {
        const isFreeze = error.code === '55000' || error.message?.includes('freeze');
        const status = isFreeze ? 503 : error.code === '42501' ? 403 : error.code === '23505' ? 409 : 400;
        send(status, {
          code: isFreeze ? 'FINANCE_FREEZE_ACTIVE' : error.code,
          error: isFreeze
            ? 'Pembayaran cicilan ditahan oleh perlindungan freeze Finance151. Data staging tetap utuh.'
            : `Pembayaran cicilan gagal: ${error.message}`,
        });
        return;
      }
      send(200, data);
      return;
    }

    if (action === 'reverse_operational_atomic') {
      const { recordType, recordId, reason } = payload;
      if (!recordType || !['kas_kru', 'loan_disbursement', 'loan_payment'].includes(recordType)) {
        send(400, { error: 'Tipe record operasional wajib valid (kas_kru, loan_disbursement, loan_payment).' });
        return;
      }
      if (!recordId || typeof recordId !== 'string') {
        send(400, { error: 'ID record wajib diisi.' });
        return;
      }
      if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
        send(400, { error: 'Alasan pembatalan/reversal wajib diisi minimal 3 karakter.' });
        return;
      }

      const { data, error } = await db.rpc('rpc_reverse_operational_record_atomic', {
        p_account_id: session.account_id,
        p_session_iat: session.iat,
        p_record_type: recordType,
        p_record_id: recordId,
        p_reason: reason.trim(),
      });

      if (error) {
        const isFreeze = error.code === '55000' || error.message?.includes('freeze');
        const status = isFreeze ? 503 : error.code === '42501' ? 403 : error.code === '22023' ? 400 : 500;
        send(status, {
          code: isFreeze ? 'FINANCE_FREEZE_ACTIVE' : error.code,
          error: isFreeze
            ? 'Pembatalan ditahan oleh perlindungan freeze Finance151. Data staging tetap utuh.'
            : `Pembatalan operasional gagal: ${error.message}`,
        });
        return;
      }
      send(200, data);
      return;
    }

    if (action === 'update_finance_settings') {
      const s = payload?.settings;
      if (!s || typeof s !== 'object') {
        send(400, { error: 'Payload pengaturan keuangan tidak valid.' });
        return;
      }

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (s.feeDueDay !== undefined) updateData.fee_due_day = Number(s.feeDueDay);
      if (s.defaultMonthlyFeeMinor !== undefined) updateData.default_monthly_fee_minor = Number(s.defaultMonthlyFeeMinor);
      if (s.defaultLoanDueDays !== undefined) updateData.default_loan_due_days = Number(s.defaultLoanDueDays);
      if (s.treasurerName !== undefined) updateData.treasurer_name = String(s.treasurerName).trim();
      if (s.treasurerPtvId !== undefined) updateData.treasurer_ptv_id = String(s.treasurerPtvId).trim();
      if (s.treasurerPhone !== undefined) updateData.treasurer_phone = String(s.treasurerPhone).trim();
      if (s.officialBankPocketId !== undefined) updateData.official_bank_pocket_id = s.officialBankPocketId || null;
      if (s.officialQrisPocketId !== undefined) updateData.official_qris_pocket_id = s.officialQrisPocketId || null;

      const { data, error } = await db
        .from('ptv_finance_settings')
        .update(updateData)
        .eq('id', 'studio_default')
        .select()
        .single();

      if (error) {
        const isFreeze = error.code === '55000' || error.message?.includes('freeze');
        const status = isFreeze ? 503 : 400;
        send(status, {
          code: isFreeze ? 'FINANCE_FREEZE_ACTIVE' : error.code,
          error: isFreeze
            ? 'Pembaruan pengaturan ditahan oleh perlindungan freeze Finance151. Data staging tetap utuh.'
            : `Gagal memperbarui pengaturan: ${error.message}`,
        });
        return;
      }
      send(200, { success: true, settings: data });
      return;
    }

    if (action === 'create_semester') {
      const sem = payload?.semester;
      if (!sem || !sem.name || !sem.startDate || !sem.endDate) {
        send(400, { error: 'Nama, tanggal mulai, dan tanggal selesai semester wajib diisi.' });
        return;
      }

      const { data, error } = await db
        .from('ptv_finance_semesters')
        .insert({
          id: sem.id || undefined,
          name: String(sem.name).trim(),
          start_date: sem.startDate,
          end_date: sem.endDate,
          monthly_fee_minor: Number(sem.monthlyFeeMinor || 2500000),
          monthly_fees: sem.monthlyFees || {},
          is_active: Boolean(sem.isActive),
          is_archived: false,
        })
        .select()
        .single();

      if (error) {
        const isFreeze = error.code === '55000' || error.message?.includes('freeze');
        const status = isFreeze ? 503 : 400;
        send(status, {
          code: isFreeze ? 'FINANCE_FREEZE_ACTIVE' : error.code,
          error: isFreeze
            ? 'Penambahan semester ditahan oleh perlindungan freeze Finance151. Data staging tetap utuh.'
            : `Gagal membuat semester: ${error.message}`,
        });
        return;
      }
      send(200, { success: true, semester: data });
      return;
    }

    if (action === 'update_semester_period_fee') {
      const semesterId = typeof payload.semesterId === 'string' ? payload.semesterId.trim() : '';
      const period = typeof payload.period === 'string' ? payload.period.trim() : '';
      const newFeeMinor = String(payload.newFeeMinor ?? '').trim();

      if (!semesterId || !/^\d{4}-\d{2}$/.test(period)) {
        send(400, { error: 'ID semester dan periode bulan (YYYY-MM) wajib valid.' });
        return;
      }
      if (!/^\d+$/.test(newFeeMinor) || BigInt(newFeeMinor) <= 0n) {
        send(400, { error: 'Nominal iuran bulanan harus berupa angka positif lebih dari 0.' });
        return;
      }

      const [semesters, currentConfig, identityRes] = await Promise.all([
        fetchSemestersCloudWithClient(db),
        fetchKasKruTariffConfigWithClient(db),
        db.from('canonical_identity').select('id, ptv_id, full_name').eq('id', access.identityId).single(),
      ]);

      const targetSemester = semesters.find(s => s.id === semesterId);
      if (!targetSemester) {
        send(404, { error: 'Semester tidak ditemukan di database staging.' });
        return;
      }

      const previousFeeMinor =
        targetSemester.monthlyFees?.[period] || targetSemester.monthlyFeeMinor || '2500000';

      const nowIso = new Date().toISOString();
      const changerPtvId = identityRes.data?.ptv_id || 'PTV-001';
      const changerName = identityRes.data?.full_name || 'Pengelola Keuangan';

      const historyEntry: KasKruFeeHistoryEntry = {
        id: `fee-hist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        semesterId: targetSemester.id,
        semesterName: targetSemester.name,
        period,
        previousFeeMinor: String(previousFeeMinor),
        newFeeMinor: String(newFeeMinor),
        changedAt: nowIso,
        changedByIdentityId: access.identityId,
        changedByPtvId: changerPtvId,
        changedByName: changerName,
      };

      const nextSemesterFees: Record<string, string> = {
        ...(targetSemester.monthlyFees || {}),
        ...(currentConfig.monthlyFeesBySemester[semesterId] || {}),
        [period]: String(newFeeMinor),
      };

      const nextConfig = {
        monthlyFeesBySemester: {
          ...currentConfig.monthlyFeesBySemester,
          [semesterId]: nextSemesterFees,
        },
        feeHistory: [historyEntry, ...(currentConfig.feeHistory || [])].slice(0, 200),
        updatedAt: nowIso,
      };

      // 1. Coba perbarui tabel ptv_finance_semesters bila diizinkan oleh policy database
      await db
        .from('ptv_finance_semesters')
        .update({
          monthly_fees: nextSemesterFees,
          updated_at: nowIso,
        })
        .eq('id', semesterId);

      // 2. Simpan permanen ke tabel konfigurasi staging ptv_portal_settings (selalu persisten di swadgljnyelsjstqqxbm)
      const { error: persistErr } = await db.from('ptv_portal_settings').upsert({
        id: KAS_KRU_TARIFF_CONFIG_ROW_ID,
        draft_payload: nextConfig,
        updated_at: nowIso,
        updated_by: `${changerName} (${changerPtvId})`,
      });

      if (persistErr) {
        send(500, { error: `Gagal menyimpan perubahan tarif ke Supabase staging: ${persistErr.message}` });
        return;
      }

      const updatedSemesters = semesters.map(s =>
        s.id === semesterId ? { ...s, monthlyFees: nextSemesterFees } : s
      );

      send(200, {
        success: true,
        semester: updatedSemesters.find(s => s.id === semesterId),
        semesters: updatedSemesters,
        historyEntry,
        feeHistory: nextConfig.feeHistory,
      });
      return;
    }

    if (action === 'update_semester') {
      const { semesterId, updates } = payload;
      if (!semesterId || !updates) {
        send(400, { error: 'ID semester dan data update wajib diisi.' });
        return;
      }

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.name !== undefined) updateData.name = String(updates.name).trim();
      if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
      if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
      if (updates.monthlyFeeMinor !== undefined) updateData.monthly_fee_minor = Number(updates.monthlyFeeMinor);
      if (updates.monthlyFees !== undefined) updateData.monthly_fees = updates.monthlyFees;
      if (updates.isActive !== undefined) updateData.is_active = Boolean(updates.isActive);
      if (updates.isArchived !== undefined) updateData.is_archived = Boolean(updates.isArchived);

      const { data, error } = await db
        .from('ptv_finance_semesters')
        .update(updateData)
        .eq('id', semesterId)
        .select()
        .single();

      if (error) {
        const isFreeze = error.code === '55000' || error.message?.includes('freeze');
        const status = isFreeze ? 503 : 400;
        send(status, {
          code: isFreeze ? 'FINANCE_FREEZE_ACTIVE' : error.code,
          error: isFreeze
            ? 'Pembaruan semester ditahan oleh perlindungan freeze Finance151. Data staging tetap utuh.'
            : `Gagal memperbarui semester: ${error.message}`,
        });
        return;
      }
      send(200, { success: true, semester: data });
      return;
    }

    if (action === 'post_transaction') {
      const command = multiPocketCommandSchema.parse(payload.command);
      const { data, error } = await db.rpc('rpc_post_finance_transaction_server', {
        p_account_id: session.account_id,
        p_session_iat: session.iat,
        p_command: command,
      });

      if (error) {
        const status = error.code === '42501' ? 403 : error.code === '23505' ? 409 : 400;
        send(status, { error: `Transaksi gagal: ${error.message}`, code: error.code });
        return;
      }
      send(200, data);
      return;
    }

    if (action === 'get_proof_signed_url') {
      const filePath = typeof payload.filePath === 'string' ? payload.filePath.trim() : '';
      if (!filePath) {
        send(400, { error: 'Path berkas bukti wajib diisi.' });
        return;
      }
      const cleanPath = filePath.replace(/^finance-proofs\//, '');
      const { data: signData, error: signError } = await db.storage
        .from('finance-proofs')
        .createSignedUrl(cleanPath, 3600);

      if (signError || !signData?.signedUrl) {
        send(400, { error: `Gagal membuat URL akses privat: ${signError?.message || 'Bucket tidak ditemukan'}` });
        return;
      }

      send(200, { success: true, signedUrl: signData.signedUrl });
      return;
    }

    if (['create_pocket', 'update_pocket', 'archive_pocket', 'create_category', 'update_category', 'archive_category', 'restore_category', 'update_transaction'].includes(action)) {
      if (action === 'update_transaction') {
        const updates = payload?.updates || {};
        if (updates.amount !== undefined || updates.amountMinor !== undefined || updates.allocations !== undefined) {
          send(400, { error: 'Nominal, alokasi, dan jenis transaksi tidak dapat diedit langsung. Lakukan pembatalan (VOID) dan catat transaksi baru.' });
          return;
        }
      }
      const { data, error } = await db.rpc('rpc_finance_admin_mutation_server', {
        p_account_id: session.account_id, p_session_iat: session.iat,
        p_action: action, p_payload: payload,
      });
      if (error) {
        const status = error.code === '42501' ? 403 : error.code === '40001' ? 409 : ['PGRST202', '42883'].includes(error.code) ? 503 : 400;
        send(status, { error: status === 503 ? 'Kontrak penyimpanan Keuangan belum diaktifkan di staging.' : error.message, code: error.code });
        return;
      }
      if (!data || data.success !== true) throw new Error('Backend belum mengonfirmasi penyimpanan keuangan.');
      send(200, data);
      return;
    }

    if (action === 'void_transaction') {
      const { txId, reason } = payload;
      if (!txId || typeof txId !== 'string') throw new Error('ID transaksi wajib diisi.');
      if (!reason || typeof reason !== 'string' || !reason.trim()) throw new Error('Alasan pembatalan transaksi wajib diisi.');

      // Pembatalan transaksi canonical HANYA menggunakan satu operasi PostgreSQL atomik (rpc_void_finance_transaction_atomic).
      // DILARANG keras menggunakan fallback beberapa query terpisah di client/API demi jaminan ACID & anti drift saldo.
      const { data: rpcData, error: rpcErr } = await db.rpc('rpc_void_finance_transaction_atomic', {
        p_account_id: session.account_id,
        p_session_iat: session.iat,
        p_tx_id: txId,
        p_reason: reason.trim(),
      });

      if (rpcErr) {
        const status = rpcErr.code === '42501' ? 403 : rpcErr.code === '22023' ? 400 : 500;
        send(status, { error: `Pembatalan transaksi gagal: ${rpcErr.message}`, code: rpcErr.code });
        return;
      }

      send(200, rpcData);
      return;
    }

    send(400, { error: `Aksi ${action || 'tidak dikenal'} tidak didukung.` });
  } catch (error: any) {
    if (error instanceof FinanceScopeUnavailableError) {
      send(503, { code: error.code, error: 'Konfigurasi akses Keuangan di staging belum lengkap. Hubungi pengelola untuk menyelesaikan aktivasi database.' });
    } else if (error?.message === 'forbidden') {
      send(403, { error: 'Akses keuangan ditolak. Periksa izin akun Anda.' });
    } else if (error?.message === 'read_failed') {
      send(503, { error: 'Data keuangan belum dapat dibaca lengkap. Coba lagi; jangan memakai laporan parsial.' });
    } else {
      send(400, { error: error?.message || 'Gagal memproses permintaan keuangan.' });
    }
  }
}
