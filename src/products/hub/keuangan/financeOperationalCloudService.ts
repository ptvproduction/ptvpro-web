import { fetchSemestersCloudWithClient, fetchKasRecordsCloudWithClient, fetchLoansCloudWithClient, fetchFinanceSettingsCloudWithClient } from './financeOperationalReader';
/**
 * PTVPRO Finance 2.0 — Operational Cloud Service & Schema Guard
 * Adapters for operational persistence; direct writers are restricted to tests
 * while the database atomicity/privacy/history blockers remain unresolved.
 * Table availability alone does not establish operational readiness.
 */

import { getSupabaseClient, isSupabaseConfigured } from '@core/supabase/client';
import type { FinanceSemester, KasKruRecord } from './kasKruTypes';
import type { PiutangRecord, PiutangPayment } from './piutangTypes';
import type { FinanceOperationalSettings } from './financeSettingsTypes';
import type { MultiPocketCommand } from './financeCanonical';
import { assertFinanceFixtureRuntime, isFinanceFixtureRuntime, operationalFinanceHold } from './financeRuntimeSafety';

export interface OperationalCloudStatus {
  isCloudReady: boolean;
  status: 'active' | 'pending_migration' | 'offline' | 'security_hold';
  statusLabel: string;
  checkedAt: string;
  details: {
    semestersTable: boolean;
    kasRecordsTable: boolean;
    kasPaymentsTable: boolean;
    loansTable: boolean;
    loanPaymentsTable: boolean;
    settingsTable: boolean;
    proofsBucket: boolean;
  };
}

let cachedStatus: OperationalCloudStatus | null = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 30000; // 30 detik

/**
 * Memeriksa status ketersediaan tabel operasional Finance 2.0 di database cloud (Staging).
 * Mengembalikan status jujur 'Menunggu Aktivasi Database' jika migrasi belum dijalankan.
 */
export async function checkOperationalCloudStatus(forceRefresh = false): Promise<OperationalCloudStatus> {
  const now = Date.now();
  if (!forceRefresh && cachedStatus && now - lastCheckTime < CACHE_TTL_MS) {
    return cachedStatus;
  }

  const result: OperationalCloudStatus = {
    isCloudReady: false,
    status: 'pending_migration',
    statusLabel: 'Menunggu Aktivasi Database Cloud (swadgljnyelsjstqqxbm)',
    checkedAt: new Date().toISOString(),
    details: {
      semestersTable: false,
      kasRecordsTable: false,
      kasPaymentsTable: false,
      loansTable: false,
      loanPaymentsTable: false,
      settingsTable: false,
      proofsBucket: false,
    },
  };

  if (!isSupabaseConfigured()) {
    result.status = 'offline';
    result.statusLabel = 'Database Cloud Tidak Dikonfigurasi (Mode Lokal)';
    cachedStatus = result;
    lastCheckTime = now;
    return result;
  }

  const supabase = getSupabaseClient();

  try {
    const [semRes, kasRes, kasPayRes, loansRes, payRes, setRes] = await Promise.all([
      supabase.from('ptv_finance_semesters').select('id').limit(1),
      supabase.from('ptv_finance_kas_records').select('id').limit(1),
      supabase.from('ptv_finance_kas_payments').select('id').limit(1),
      supabase.from('ptv_finance_loans').select('id').limit(1),
      supabase.from('ptv_finance_loan_payments').select('id').limit(1),
      supabase.from('ptv_finance_settings').select('id').limit(1),
    ]);

    result.details.semestersTable = !semRes.error;
    result.details.kasRecordsTable = !kasRes.error;
    result.details.kasPaymentsTable = !kasPayRes.error;
    result.details.loansTable = !loansRes.error;
    result.details.loanPaymentsTable = !payRes.error;
    result.details.settingsTable = !setRes.error;

    // Probe storage bucket privat finance-proofs
    try {
      const { data: bucketData, error: bucketError } = await supabase.storage.getBucket('finance-proofs');
      result.details.proofsBucket = !bucketError && !!bucketData;
    } catch {
      result.details.proofsBucket = false;
    }

    const allReady =
      result.details.semestersTable &&
      result.details.kasRecordsTable &&
      result.details.kasPaymentsTable &&
      result.details.loansTable &&
      result.details.loanPaymentsTable &&
      result.details.settingsTable;

    if (allReady && !isFinanceFixtureRuntime()) {
      result.status = 'security_hold';
      result.statusLabel = operationalFinanceHold;
    } else if (allReady) {
      result.isCloudReady = true;
      result.status = 'active';
      result.statusLabel = 'Tersambung Aktif ke Staging PostgreSQL 17 (swadgljnyelsjstqqxbm)';
    } else {
      result.isCloudReady = false;
      result.status = 'pending_migration';
      result.statusLabel = 'Menunggu Aktivasi Database Cloud (Migrasi SQL Belum Diterapkan)';
    }
  } catch {
    result.isCloudReady = false;
    result.status = 'pending_migration';
    result.statusLabel = 'Menunggu Aktivasi Database Cloud (swadgljnyelsjstqqxbm)';
  }

  cachedStatus = result;
  lastCheckTime = now;
  return result;
}

/**
 * Guard Integritas Ledger: Memastikan mutasi buku besar tidak diposting jika metadata
 * kewajiban (Kas Kru / Piutang) tidak dapat dipersistenkan secara atomik di Cloud.
 */
export function assertCanPostOperationalLedger(context: 'kas_kru' | 'piutang'): void {
  assertFinanceFixtureRuntime();
  if (cachedStatus && !cachedStatus.isCloudReady) {
    throw new Error(
      `Pencatatan mutasi transaksi canonical ${context === 'kas_kru' ? 'Iuran Kas Kru' : 'Piutang'} ke Buku Besar Cloud diblokir: ` +
      `Skema tabel operasional berstatus '${cachedStatus.statusLabel}'. ` +
      `Mutasi saldo kas dicegah demi integritas akuntansi sampai skema dimigrasi dengan ACC operator.`
    );
  }
}

// ============================================================================
// CLOUD ADAPTERS (penulis langsung hanya fixture test; aktivasi menunggu hardening)
// ============================================================================

export async function fetchSemestersCloud() {
  return fetchSemestersCloudWithClient(getSupabaseClient());
}

export async function saveSemesterCloud(semester: FinanceSemester): Promise<void> {
  assertFinanceFixtureRuntime();
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('ptv_finance_semesters').upsert({
    id: semester.id,
    name: semester.name,
    start_date: semester.startDate,
    end_date: semester.endDate,
    monthly_fee_minor: semester.monthlyFeeMinor,
    monthly_fees: semester.monthlyFees || {},
    is_active: semester.isActive,
    is_archived: semester.isArchived,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function fetchKasRecordsCloud(semesterId?: string) {
  return fetchKasRecordsCloudWithClient(getSupabaseClient(), semesterId);
}

export async function saveKasRecordCloud(record: KasKruRecord): Promise<void> {
  assertFinanceFixtureRuntime();
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('ptv_finance_kas_records').upsert({
    id: record.id,
    semester_id: record.semesterId,
    ptv_id: record.ptvId,
    crew_name: record.crewName,
    period: record.period,
    amount_minor: record.amountMinor,
    paid_amount_minor: record.paidAmountMinor,
    status: record.status,
    payment_date: record.paymentDate,
    method: record.method,
    pocket_id: record.pocketId,
    transaction_id: record.transactionId || null,
    notes: record.notes,
    audit_reference: record.auditReference,
    reversal_reason: record.reversalReason,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function fetchLoansCloud() {
  return fetchLoansCloudWithClient(getSupabaseClient());
}

export async function saveLoanCloud(loan: PiutangRecord): Promise<void> {
  assertFinanceFixtureRuntime();
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('ptv_finance_loans').upsert({
    id: loan.id,
    borrower_type: loan.borrowerType,
    borrower_id: loan.borrowerId || null,
    borrower_name: loan.borrowerName,
    borrower_contact: loan.borrowerContact,
    borrower_institution: loan.borrowerInstitution || null,
    principal_minor: loan.principalMinor,
    interest_type: loan.interestType,
    interest_rate_percent: loan.interestRatePercent,
    interest_minor: loan.interestMinor,
    total_due_minor: loan.totalDueMinor,
    total_paid_minor: loan.totalPaidMinor,
    remaining_minor: loan.remainingMinor,
    disbursed_on: loan.disbursedOn,
    due_date: loan.dueDate || null,
    disbursed_from_pocket_id: loan.disbursedFromPocketId,
    disbursement_tx_id: loan.disbursementTxId || null,
    status: loan.status,
    purpose: loan.purpose,
    notes: loan.notes,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function recordLoanPaymentCloud(payment: PiutangPayment, loanId: string): Promise<void> {
  assertFinanceFixtureRuntime();
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('ptv_finance_loan_payments').insert({
    id: payment.id,
    loan_id: loanId,
    paid_on: payment.paidOn,
    amount_minor: payment.amountMinor,
    to_pocket_id: payment.toPocketId,
    receipt_tx_id: payment.receiptTxId || null,
    method: payment.method,
    notes: payment.notes,
  });
  if (error) throw error;
}

export async function fetchFinanceSettingsCloud() {
  return fetchFinanceSettingsCloudWithClient(getSupabaseClient());
}

export async function saveFinanceSettingsCloud(settings: FinanceOperationalSettings): Promise<void> {
  assertFinanceFixtureRuntime();
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('ptv_finance_settings').upsert({
    id: 'studio_default',
    default_monthly_fee_minor: settings.defaultMonthlyFeeMinor,
    fee_due_day: settings.feeDueDay,
    default_loan_due_days: settings.defaultLoanDueDays,
    treasurer_name: settings.treasurerName,
    treasurer_ptv_id: settings.treasurerPtvId,
    treasurer_phone: settings.treasurerPhone,
    official_bank_pocket_id: settings.officialBankPocketId,
    official_qris_pocket_id: settings.officialQrisPocketId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// ============================================================================
// ATOMIC TRANSACTION SUBMISSIONS VIA BACKEND RPC
// ============================================================================

export async function submitKasKruPaymentAtomic(
  command: MultiPocketCommand,
  kasPayload: {
    semesterId: string;
    ptvId: string;
    crewName: string;
    periods: string[];
    method: string;
    pocketId: string;
    notes?: string;
  }
): Promise<{ success: boolean; transactionId?: string; kasRecords?: any[] }> {
  assertCanPostOperationalLedger('kas_kru');
  const res = await fetch('/api/finance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'post_kas_payment_atomic', command, kasPayload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Gagal mencatat kas kru via RPC atomik (HTTP ${res.status}).`);
  }
  return res.json();
}

export async function submitLoanDisbursementAtomic(
  command: MultiPocketCommand,
  loanPayload: any
): Promise<{ success: boolean; transactionId?: string; loan?: any }> {
  assertCanPostOperationalLedger('piutang');
  const res = await fetch('/api/finance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'disburse_loan_atomic', command, loanPayload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Gagal mencairkan piutang via RPC atomik (HTTP ${res.status}).`);
  }
  return res.json();
}

export async function submitLoanRepaymentAtomic(
  command: MultiPocketCommand,
  paymentPayload: any
): Promise<{ success: boolean; transactionId?: string; loan?: any; payment?: any }> {
  assertCanPostOperationalLedger('piutang');
  const res = await fetch('/api/finance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'post_loan_payment_atomic', command, paymentPayload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Gagal mencatat cicilan piutang via RPC atomik (HTTP ${res.status}).`);
  }
  return res.json();
}

export async function submitOperationalReversalAtomic(
  entityType: 'kas_kru' | 'loan_disbursement' | 'loan_payment',
  recordId: string,
  reason: string
): Promise<{ success: boolean; message?: string }> {
  const res = await fetch('/api/finance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reverse_operational_atomic', entityType, recordId, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Gagal membatalkan catatan via RPC atomik (HTTP ${res.status}).`);
  }
  return res.json();
}

export const PROOF_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
];
export const PROOF_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateProofFile(file: { size: number; type: string }): { valid: boolean; error?: string } {
  if (file.size > PROOF_MAX_SIZE_BYTES) {
    return { valid: false, error: 'Ukuran berkas melebihi batas maksimal 5 MB.' };
  }
  if (!PROOF_ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return { valid: false, error: 'Format berkas tidak didukung. Gunakan JPG, PNG, WebP, HEIC, atau PDF.' };
  }
  return { valid: true };
}

export async function uploadFinanceProof(
  file: File | Blob,
  customFileName?: string
): Promise<{ storagePath: string; signedUrl: string }> {
  if (import.meta.env.MODE === 'staging' || import.meta.env.VITE_APP_ENV === 'staging') {
    const response = await fetch('/api/finance?maintenance=1', { cache: 'no-store', credentials: 'same-origin' });
    const status = await response.json();
    if (!response.ok || status.maintenance !== false) {
      throw new Error(status.error || 'Status pemeliharaan Keuangan belum dapat dikonfirmasi. Upload dihentikan.');
    }
  }
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client tidak dikonfigurasi untuk upload berkas bukti.');
  }

  const validation = validateProofFile({
    size: file.size,
    type: file.type,
  });
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const supabase = getSupabaseClient();
  const ext = file.type === 'application/pdf' ? 'pdf' : (file.type.split('/')[1] || 'jpg');
  const safeName = customFileName || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const storagePath = `proofs/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('finance-proofs')
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    throw new Error(`Gagal mengunggah bukti ke Supabase Storage (finance-proofs): ${uploadError.message}`);
  }

  const { data: signedData, error: signError } = await supabase.storage
    .from('finance-proofs')
    .createSignedUrl(storagePath, 3600);

  if (signError || !signedData?.signedUrl) {
    throw new Error(`Berkas terunggah namun gagal membuat URL akses privat: ${signError?.message || 'Unknown error'}`);
  }

  return {
    storagePath,
    signedUrl: signedData.signedUrl,
  };
}

export async function getFinanceProofSignedUrl(pathOrUrl: string, expiresIn = 3600): Promise<string> {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    if (pathOrUrl.includes('/storage/v1/object/')) {
      const match = pathOrUrl.match(/finance-proofs\/(.+?)(\?|$)/);
      if (match && match[1]) {
        pathOrUrl = decodeURIComponent(match[1]);
      } else {
        return pathOrUrl;
      }
    } else {
      return pathOrUrl;
    }
  }

  if (!isSupabaseConfigured()) {
    return pathOrUrl;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from('finance-proofs')
    .createSignedUrl(pathOrUrl.replace(/^finance-proofs\//, ''), expiresIn);

  if (error || !data?.signedUrl) {
    return pathOrUrl;
  }
  return data.signedUrl;
}


