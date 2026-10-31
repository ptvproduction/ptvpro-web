import { assertFinanceFixtureRuntime } from './financeRuntimeSafety';
import type { CanonicalCategory, FinancePocket, MultiPocketCommand } from './financeCanonical';
import { submitFinanceOperation } from './financeCanonicalService';
import { assertCanPostOperationalLedger } from './financeOperationalCloudService';
import type {
  CreatePiutangCommand,
  PiutangPayment,
  PiutangRecord,
  PiutangStats,
  RepayPiutangCommand,
} from './piutangTypes';

const STORAGE_PIUTANG_KEY = 'ptv_finance_piutang_v2_records';

export function getStoredLoans(): PiutangRecord[] {
  assertFinanceFixtureRuntime();
  if (typeof window === 'undefined' && typeof localStorage === 'undefined') return [];
  try {
    const storage = typeof localStorage !== 'undefined' ? localStorage : window.localStorage;
    const raw = storage.getItem(STORAGE_PIUTANG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLoans(loans: PiutangRecord[]): void {
  assertFinanceFixtureRuntime();
  if (typeof window === 'undefined' && typeof localStorage === 'undefined') return;
  try {
    const storage = typeof localStorage !== 'undefined' ? localStorage : window.localStorage;
    storage.setItem(STORAGE_PIUTANG_KEY, JSON.stringify(loans));
  } catch {
    // Ignore storage quota errors in test/sandbox
  }
}

export function calculateLoanStatus(loan: {
  dueDate: string | null;
  remainingMinor: string;
  status: PiutangRecord['status'];
}): PiutangRecord['status'] {
  if (loan.status === 'dibatalkan') return 'dibatalkan';
  const remBig = BigInt(loan.remainingMinor || '0');
  if (remBig <= 0n) return 'lunas';

  if (loan.dueDate) {
    const today = new Date().toISOString().split('T')[0];
    if (loan.dueDate < today) {
      return 'overdue';
    }
  }

  return 'aktif';
}

/**
 * Menghitung statistik global modul Piutang
 */
export function calculatePiutangStats(loans: PiutangRecord[] = getStoredLoans()): PiutangStats {
  let totalPrincipalBig = 0n;
  let totalInterestBig = 0n;
  let totalDueBig = 0n;
  let totalCollectedBig = 0n;
  let totalRemainingBig = 0n;
  let activeLoans = 0;
  let overdueLoans = 0;
  let fullyPaidLoans = 0;

  for (const loan of loans) {
    if (loan.status === 'dibatalkan') continue;

    const principal = BigInt(loan.principalMinor || '0');
    const interest = BigInt(loan.interestMinor || '0');
    const due = BigInt(loan.totalDueMinor || (principal + interest).toString());
    const paid = BigInt(loan.totalPaidMinor || '0');
    const remaining = BigInt(loan.remainingMinor || (due - paid).toString());

    totalPrincipalBig += principal;
    totalInterestBig += interest;
    totalDueBig += due;
    totalCollectedBig += paid;
    totalRemainingBig += remaining;

    const currentStatus = calculateLoanStatus(loan);
    if (currentStatus === 'lunas') {
      fullyPaidLoans++;
    } else if (currentStatus === 'overdue') {
      overdueLoans++;
      activeLoans++;
    } else {
      activeLoans++;
    }
  }

  return {
    totalPrincipalMinor: totalPrincipalBig.toString(),
    totalInterestMinor: totalInterestBig.toString(),
    totalDueMinor: totalDueBig.toString(),
    totalCollectedMinor: totalCollectedBig.toString(),
    totalRemainingMinor: totalRemainingBig.toString(),
    activeLoansCount: activeLoans,
    overdueLoansCount: overdueLoans,
    fullyPaidLoansCount: fullyPaidLoans,
  };
}

/**
 * Pencatatan piutang baru: dana keluar dari Kantong sumber via canonical expense
 */
export async function createPiutang(
  command: CreatePiutangCommand,
  options: {
    pockets: FinancePocket[];
    categories: CanonicalCategory[];
    canManage: boolean;
    existingLoans?: PiutangRecord[];
  }
): Promise<{ success: boolean; loan: PiutangRecord; transactionId?: string }> {
  const { pockets, categories, canManage } = options;
  const existingLoans = options.existingLoans || getStoredLoans();

  const name = command.borrowerName.trim();
  if (!name) throw new Error('Nama pihak peminjam wajib diisi.');
  const purpose = command.purpose.trim();
  if (!purpose) throw new Error('Keperluan / keterangan piutang wajib diisi.');

  const principalBig = BigInt(command.principalMinor || '0');
  if (principalBig <= 0n) throw new Error('Nominal pokok piutang harus lebih dari nol.');

  const interestType: 'none' | 'flat' = command.interestType || 'none';
  const interestRatePercent: number = command.interestRatePercent || 0;
  let calculatedInterestBig = 0n;

  if (interestType === 'flat' && interestRatePercent > 0) {
    // Flat one-time interest on principal: (principal * rate%)
    // Deterministic integer rounding: (principal * round(rate * 100)) / 10000
    const basisPoints = BigInt(Math.round(interestRatePercent * 100));
    calculatedInterestBig = (principalBig * basisPoints) / 10000n;
  } else if (command.interestMinor) {
    calculatedInterestBig = BigInt(command.interestMinor);
  }

  if (calculatedInterestBig < 0n) throw new Error('Nominal bunga tidak boleh negatif.');
  const totalDueBig = principalBig + calculatedInterestBig;

  // Verifikasi kantong sumber pencairan & saldo (anti-overdraft)
  const sourcePocket = pockets.find(p => p.id === command.disbursedFromPocketId && !p.archived);
  if (!sourcePocket) throw new Error('Kantong sumber pencairan tidak valid atau telah diarsipkan.');

  if (sourcePocket.balanceMinor !== null && BigInt(sourcePocket.balanceMinor) < principalBig) {
    throw new Error(
      `Saldo Kantong '${sourcePocket.name}' tidak mencukupi untuk pencairan piutang ini. Saldo negatif tidak diizinkan.`
    );
  }

  // Cari kategori pengeluaran yang sesuai
  const expenseCat =
    categories.find(c => c.name.toLowerCase().includes('piutang') && c.kind === 'expense' && c.isActive) ||
    categories.find(c => c.kind === 'expense' && c.isActive);

  if (!expenseCat) {
    throw new Error('Kategori pengeluaran canonical belum tersedia.');
  }

  const idempotencyKey = crypto.randomUUID();
  const description = `Pencairan Piutang - ${name} - ${purpose}`;

  // Buat canonical command pengeluaran (hanya mencairkan pokok pinjaman dari kas studio)
  const canonicalCommand: MultiPocketCommand = {
    version: 2,
    idempotencyKey,
    operation: 'expense',
    currency: 'IDR',
    occurredOn: command.disbursedOn || new Date().toISOString().split('T')[0],
    description,
    amountMinor: command.principalMinor,
    categoryId: expenseCat.id,
    incoming: [],
    outgoing: [{ pocketId: sourcePocket.id, amountMinor: command.principalMinor }],
  };

  let transactionId: string | undefined = undefined;

  if (canManage) {
    try {
      assertCanPostOperationalLedger('piutang');
      const res = await submitFinanceOperation(canonicalCommand, pockets);
      transactionId = res.transaction?.id || idempotencyKey;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[piutangService] Ledger disbursement posting diisolasi demi integritas data:', msg);
    }
  }

  const nowIso = new Date().toISOString();
  const newLoan: PiutangRecord = {
    id: `loan-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    borrowerType: command.borrowerType,
    borrowerId: command.borrowerId || null,
    borrowerName: name,
    borrowerContact: command.borrowerContact.trim(),
    borrowerInstitution: command.borrowerInstitution?.trim() || undefined,
    principalMinor: command.principalMinor,
    interestType,
    interestRatePercent,
    interestMinor: calculatedInterestBig.toString(),
    totalDueMinor: totalDueBig.toString(),
    totalPaidMinor: '0',
    remainingMinor: totalDueBig.toString(),
    disbursedOn: command.disbursedOn,
    dueDate: command.dueDate || null,
    disbursedFromPocketId: sourcePocket.id,
    disbursementTxId: transactionId || null,
    status: calculateLoanStatus({
      dueDate: command.dueDate || null,
      remainingMinor: totalDueBig.toString(),
      status: 'aktif',
    }),
    purpose,
    payments: [],
    notes: command.notes,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const updatedLoans = [newLoan, ...existingLoans];
  saveLoans(updatedLoans);

  return { success: true, loan: newLoan, transactionId };
}

/**
 * Pembayaran cicilan / pelunasan piutang: dana masuk ke Kantong tujuan via canonical income
 */
export async function recordLoanRepayment(
  command: RepayPiutangCommand,
  options: {
    pockets: FinancePocket[];
    categories: CanonicalCategory[];
    canManage: boolean;
    existingLoans?: PiutangRecord[];
  }
): Promise<{ success: boolean; loan: PiutangRecord; transactionId?: string }> {
  const { pockets, categories, canManage } = options;
  const existingLoans = options.existingLoans || getStoredLoans();

  const loanIndex = existingLoans.findIndex(l => l.id === command.loanId);
  if (loanIndex < 0) throw new Error('Data piutang tidak ditemukan.');

  const loan = existingLoans[loanIndex];
  if (loan.status === 'lunas') throw new Error('Piutang ini sudah lunas.');
  if (loan.status === 'dibatalkan') throw new Error('Piutang ini telah dibatalkan.');

  const payAmountBig = BigInt(command.amountMinor || '0');
  if (payAmountBig <= 0n) throw new Error('Nominal pembayaran cicilan harus lebih dari nol.');

  const remainingBig = BigInt(loan.remainingMinor || '0');
  if (payAmountBig > remainingBig) {
    throw new Error(
      `Nominal pembayaran melebihi sisa tagihan. Sisa tagihan saat ini adalah ${loan.remainingMinor}. Kelebihan bayar tidak diizinkan.`
    );
  }

  // Verifikasi kantong tujuan masuk
  const targetPocket = pockets.find(p => p.id === command.toPocketId && !p.archived);
  if (!targetPocket) throw new Error('Kantong penerima cicilan tidak valid atau telah diarsipkan.');

  // Cari kategori pemasukan
  const incomeCat =
    categories.find(c => c.name.toLowerCase().includes('piutang') && c.kind === 'income' && c.isActive) ||
    categories.find(c => c.kind === 'income' && c.isActive);

  if (!incomeCat) {
    throw new Error('Kategori pemasukan canonical belum tersedia.');
  }

  const idempotencyKey = crypto.randomUUID();
  const description = `Pengembalian Piutang - ${loan.borrowerName} - Cicilan/Pelunasan`;

  const canonicalCommand: MultiPocketCommand = {
    version: 2,
    idempotencyKey,
    operation: 'income',
    currency: 'IDR',
    occurredOn: command.paidOn || new Date().toISOString().split('T')[0],
    description,
    amountMinor: command.amountMinor,
    categoryId: incomeCat.id,
    incoming: [{ pocketId: targetPocket.id, amountMinor: command.amountMinor }],
    outgoing: [],
  };

  let transactionId: string | undefined = undefined;

  if (canManage) {
    try {
      assertCanPostOperationalLedger('piutang');
      const res = await submitFinanceOperation(canonicalCommand, pockets);
      transactionId = res.transaction?.id || idempotencyKey;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[piutangService] Ledger repayment posting diisolasi demi integritas data:', msg);
    }
  }

  const nowIso = new Date().toISOString();
  const newPayment: PiutangPayment = {
    id: `pay-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    loanId: loan.id,
    paidOn: command.paidOn,
    amountMinor: command.amountMinor,
    toPocketId: targetPocket.id,
    receiptTxId: transactionId || null,
    method: command.method,
    notes: command.notes,
    createdAt: nowIso,
  };

  const newTotalPaidBig = BigInt(loan.totalPaidMinor || '0') + payAmountBig;
  const newRemainingBig = remainingBig - payAmountBig;
  const newRemainingStr = newRemainingBig.toString();

  const updatedLoan: PiutangRecord = {
    ...loan,
    totalPaidMinor: newTotalPaidBig.toString(),
    remainingMinor: newRemainingStr,
    status: calculateLoanStatus({
      dueDate: loan.dueDate,
      remainingMinor: newRemainingStr,
      status: loan.status,
    }),
    payments: [...loan.payments, newPayment],
    updatedAt: nowIso,
  };

  const updatedLoans = [...existingLoans];
  updatedLoans[loanIndex] = updatedLoan;
  saveLoans(updatedLoans);

  return { success: true, loan: updatedLoan, transactionId };
}

/**
 * Pembatalan piutang yang sah (hanya jika belum ada pembayaran)
 */
export function cancelPiutang(
  loanId: string,
  reason: string,
  existingLoans: PiutangRecord[] = getStoredLoans()
): { success: boolean; loan: PiutangRecord; updatedList: PiutangRecord[] } {
  const index = existingLoans.findIndex(l => l.id === loanId);
  if (index < 0) throw new Error('Data piutang tidak ditemukan.');

  const loan = existingLoans[index];
  if (loan.payments.length > 0) {
    throw new Error('Piutang yang sudah memiliki riwayat pembayaran tidak dapat dibatalkan secara langsung.');
  }

  const nowIso = new Date().toISOString();
  const updated: PiutangRecord = {
    ...loan,
    status: 'dibatalkan',
    notes: [loan.notes, `Dibatalkan: ${reason.trim() || 'Pembatalan resmi'}`].filter(Boolean).join(' | '),
    updatedAt: nowIso,
  };

  const updatedList = [...existingLoans];
  updatedList[index] = updated;
  saveLoans(updatedList);

  return { success: true, loan: updated, updatedList };
}
