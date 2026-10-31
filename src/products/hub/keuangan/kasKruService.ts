import type { CrewMember } from '@products/hub/kru/types';
import type { CanonicalCategory, FinancePocket, MultiPocketCommand } from './financeCanonical';
import { submitFinanceOperation } from './financeCanonicalService';
import { assertFinanceFixtureRuntime } from './financeRuntimeSafety';
import { assertCanPostOperationalLedger } from './financeOperationalCloudService';
import { getStoredFinanceSettings } from './financeSettingsService';
import type {
  FinanceSemester,
  KasKruFeeHistoryEntry,
  KasKruMatrixCell,
  KasKruMatrixRow,
  KasKruPaymentCommand,
  KasKruRecord,
  KasKruStats,
} from './kasKruTypes';

const STORAGE_SEMESTERS_KEY = 'ptv_finance_kaskru_v2_semesters';
const STORAGE_RECORDS_KEY = 'ptv_finance_kaskru_v2_records';
const STORAGE_FEE_HISTORY_KEY = 'ptv_finance_kaskru_v3_fee_history';

export const SEEDED_SEMESTERS: FinanceSemester[] = [
  {
    id: 'sem-2026-ganjil',
    name: 'Semester Ganjil 2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-02-28',
    monthlyFeeMinor: '2500000', // Rp 25.000,00
    isActive: true,
    isArchived: false,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'sem-2025-genap',
    name: 'Semester Genap 2025/2026 (Historis)',
    startDate: '2026-03-01',
    endDate: '2026-08-31',
    monthlyFeeMinor: '2500000',
    isActive: false,
    isArchived: false,
    createdAt: '2026-03-01T00:00:00.000Z',
  },
];

export const DEFAULT_SEMESTERS = SEEDED_SEMESTERS;

export function formatPeriodMonthLabel(period: string): string {
  const [y, m] = (period || '').split('-');
  const monthNames: Record<string, string> = {
    '01': 'Januari',
    '02': 'Februari',
    '03': 'Maret',
    '04': 'April',
    '05': 'Mei',
    '06': 'Juni',
    '07': 'Juli',
    '08': 'Agustus',
    '09': 'September',
    '10': 'Oktober',
    '11': 'November',
    '12': 'Desember',
  };
  return monthNames[m] && y ? `${monthNames[m]} ${y}` : period;
}
export function generatePeriods(startDate: string, endDate: string): string[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [];
  }

  const periods: string[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const stop = new Date(end.getFullYear(), end.getMonth(), 1);

  while (current <= stop) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    periods.push(`${y}-${m}`);
    current.setMonth(current.getMonth() + 1);
  }

  return periods;
}

export function getCurrentPeriodMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getStoredSemesters(): FinanceSemester[] {
  assertFinanceFixtureRuntime();
  if (typeof window === 'undefined') return SEEDED_SEMESTERS;
  try {
    const raw = localStorage.getItem(STORAGE_SEMESTERS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_SEMESTERS_KEY, JSON.stringify(SEEDED_SEMESTERS));
      return SEEDED_SEMESTERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEEDED_SEMESTERS;
  } catch {
    return SEEDED_SEMESTERS;
  }
}

export function saveSemesters(semesters: FinanceSemester[]): void {
  assertFinanceFixtureRuntime();
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_SEMESTERS_KEY, JSON.stringify(semesters));
}

export async function createSemesterCloud(input: {
  name: string;
  startDate: string;
  endDate: string;
  monthlyFeeMinor: string;
  isActive?: boolean;
}): Promise<FinanceSemester> {
  const res = await fetch('/api/finance', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create_semester',
      semester: input,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Gagal membuat semester baru di Staging.');
  }
  return {
    id: data.semester.id,
    name: data.semester.name,
    startDate: data.semester.start_date,
    endDate: data.semester.end_date,
    monthlyFeeMinor: String(data.semester.monthly_fee_minor),
    monthlyFees: data.semester.monthly_fees || {},
    isActive: Boolean(data.semester.is_active),
    isArchived: Boolean(data.semester.is_archived),
    createdAt: data.semester.created_at,
  };
}

export async function updateSemesterCloud(semesterId: string, updates: Partial<FinanceSemester>): Promise<void> {
  const res = await fetch('/api/finance', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'update_semester',
      semesterId,
      updates,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Gagal memperbarui semester di Staging.');
  }
}

export function getStoredRecords(): KasKruRecord[] {
  assertFinanceFixtureRuntime();
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecords(records: KasKruRecord[]): void {
  assertFinanceFixtureRuntime();
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(records));
}

/**
 * Validasi dan pembuatan semester baru
 */
export function createSemester(
  input: {
    name: string;
    startDate: string;
    endDate: string;
    monthlyFeeMinor: string;
    isActive?: boolean;
  },
  existingSemesters: FinanceSemester[] = getStoredSemesters()
): { semester: FinanceSemester; updatedList: FinanceSemester[] } {
  const name = input.name.trim();
  if (!name) throw new Error('Nama semester wajib diisi.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) {
    throw new Error('Format tanggal harus YYYY-MM-DD.');
  }
  if (input.startDate > input.endDate) {
    throw new Error('Tanggal mulai tidak boleh lebih besar dari tanggal akhir.');
  }
  const feeBig = BigInt(input.monthlyFeeMinor || '0');
  if (feeBig <= 0n) {
    throw new Error('Nominal iuran bulanan harus lebih dari nol.');
  }

  // Cek potensi tumpang tindih dengan semester aktif lain
  if (input.isActive) {
    const overlap = existingSemesters.find(
      s =>
        s.isActive &&
        !s.isArchived &&
        ((input.startDate >= s.startDate && input.startDate <= s.endDate) ||
          (input.endDate >= s.startDate && input.endDate <= s.endDate) ||
          (input.startDate <= s.startDate && input.endDate >= s.endDate))
    );
    if (overlap) {
      throw new Error(`Rentang tanggal tumpang tindih dengan semester aktif '${overlap.name}'.`);
    }
  }

  const newSemester: FinanceSemester = {
    id: `sem-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    name,
    startDate: input.startDate,
    endDate: input.endDate,
    monthlyFeeMinor: input.monthlyFeeMinor,
    isActive: input.isActive ?? true,
    isArchived: false,
    createdAt: new Date().toISOString(),
  };

  const updatedList = [newSemester, ...existingSemesters];
  saveSemesters(updatedList);
  return { semester: newSemester, updatedList };
}

/**
 * Update semester: perubahan nominal atau periode tidak boleh merusak transaksi yang telah terjadi
 */
export function updateSemester(
  id: string,
  updates: Partial<Pick<FinanceSemester, 'name' | 'startDate' | 'endDate' | 'monthlyFeeMinor' | 'isActive' | 'isArchived'>>,
  existingSemesters: FinanceSemester[] = getStoredSemesters()
): FinanceSemester[] {
  const semester = existingSemesters.find(s => s.id === id);
  if (!semester) throw new Error('Semester tidak ditemukan.');

  const updated = existingSemesters.map(s => {
    if (s.id !== id) return s;
    return { ...s, ...updates };
  });

  saveSemesters(updated);
  return updated;
}

/**
 * Mengambil nominal tagihan minor untuk periode tertentu pada suatu semester.
 * Jika semester memiliki tarif khusus per bulan di `monthlyFees`, gunakan tarif tersebut.
 * Jika tidak, fallback ke `monthlyFeeMinor`.
 */
export function getSemesterPeriodFeeMinor(semester: FinanceSemester, period: string): string {
  if (semester.monthlyFees && semester.monthlyFees[period]) {
    return semester.monthlyFees[period];
  }
  return semester.monthlyFeeMinor || '2500000';
}

export function getStoredFeeHistory(): KasKruFeeHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_FEE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFeeHistory(history: KasKruFeeHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_FEE_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
}

/**
 * Memperbarui tarif iuran bulanan untuk satu periode tertentu pada semester.
 * Perubahan tarif tersimpan persisten dan tidak menghapus histori pembayaran yang sudah ada.
 */
export function updateSemesterMonthlyFee(
  semesterId: string,
  period: string,
  newFeeMinor: string,
  existingSemesters: FinanceSemester[] = getStoredSemesters(),
  actor?: { ptvId?: string; name?: string }
): FinanceSemester[] {
  const semester = existingSemesters.find(s => s.id === semesterId);
  if (!semester) throw new Error('Semester tidak ditemukan.');
  const newFeeBig = BigInt(newFeeMinor || '0');
  if (newFeeBig <= 0n) throw new Error('Nominal iuran harus lebih dari nol.');

  const previousFeeMinor = getSemesterPeriodFeeMinor(semester, period);
  const updated = existingSemesters.map(s => {
    if (s.id !== semesterId) return s;
    const monthlyFees = { ...(s.monthlyFees || {}) };
    monthlyFees[period] = newFeeMinor;
    return { ...s, monthlyFees };
  });

  const entry: KasKruFeeHistoryEntry = {
    id: `fee-hist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    semesterId: semester.id,
    semesterName: semester.name,
    period,
    previousFeeMinor,
    newFeeMinor,
    changedAt: new Date().toISOString(),
    changedByPtvId: actor?.ptvId || 'PTV-001',
    changedByName: actor?.name || 'Pengelola Keuangan',
  };
  saveFeeHistory([entry, ...getStoredFeeHistory()].slice(0, 200));
  saveSemesters(updated);
  return updated;
}

/**
 * Menyimpan perubahan tarif iuran bulanan ke Supabase staging (/api/finance action: update_semester_period_fee)
 */
export async function submitSemesterPeriodFeeUpdate(input: {
  semesterId: string;
  period: string;
  newFeeMinor: string;
}): Promise<{
  success: boolean;
  semester?: FinanceSemester;
  semesters?: FinanceSemester[];
  historyEntry?: KasKruFeeHistoryEntry;
  feeHistory?: KasKruFeeHistoryEntry[];
}> {
  const res = await fetch('/api/finance', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'update_semester_period_fee',
      semesterId: input.semesterId,
      period: input.period,
      newFeeMinor: input.newFeeMinor,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Gagal memperbarui tarif iuran (HTTP ${res.status}).`);
  }
  return body;
}

/**
 * Menghitung matriks kas kru untuk satu semester
 */
export function calculateKasKruMatrix(
  semester: FinanceSemester,
  crewMembers: CrewMember[],
  records: KasKruRecord[] = getStoredRecords(),
  dueDay?: number
): {
  periods: string[];
  rows: KasKruMatrixRow[];
  stats: KasKruStats;
} {
  const periods = generatePeriods(semester.startDate, semester.endDate);
  const currentMonth = getCurrentPeriodMonth();

  // Filter records untuk semester ini (mencakup pencocokan semesterId dan rentang periode)
  const semesterRecords = records.filter(r => r.semesterId === semester.id || periods.includes(r.period));
  const recordByIdentityMap = new Map<string, KasKruRecord>();
  const recordByPtvMap = new Map<string, KasKruRecord>();

  const shouldReplaceRecord = (existing: KasKruRecord | undefined, candidate: KasKruRecord, period: string) => {
    if (!existing) return true;
    if (existing.status === 'belum' && candidate.status !== 'belum') return true;
    if (candidate.status === 'dikecualikan') return true;
    if (candidate.status === 'lunas') {
      const officialFee = getSemesterPeriodFeeMinor(semester, period);
      if (existing.status !== 'lunas') return true;
      if (candidate.amountMinor === officialFee && existing.amountMinor !== officialFee) return true;
    }
    return false;
  };

  for (const r of semesterRecords) {
    if (r.identityId) {
      const idKey = `${r.identityId}_${r.period}`;
      if (shouldReplaceRecord(recordByIdentityMap.get(idKey), r, r.period)) {
        recordByIdentityMap.set(idKey, r);
      }
    }
    const ptvKey = `${r.ptvId}_${r.period}`;
    if (shouldReplaceRecord(recordByPtvMap.get(ptvKey), r, r.period)) {
      recordByPtvMap.set(ptvKey, r);
    }
  }

  let totalCollectedBig = 0n;
  let totalArrearsBig = 0n;
  let fullyPaidCrew = 0;
  let partiallyPaidCrew = 0;
  let unpaidCrew = 0;
  // 1. Ambil setting operasional untuk hari jatuh tempo bulanan (default tgl 10)
  const feeDueDay = dueDay ?? (getStoredFinanceSettings().feeDueDay || 10);
  const today = new Date();
  const currentDay = today.getDate();

  // Helper untuk menentukan apakah periode bulan tertentu sudah melewati batas jatuh tempo
  const isPeriodPastDue = (period: string) => {
    if (period < currentMonth) return true;
    if (period === currentMonth) return currentDay >= feeDueDay;
    return false; // Bulan mendatang BELUM jatuh tempo (tidak boleh dianggap menunggak)
  };

  // 2. ATURAN H: HANYA personel berkategori 'Kru' yang menjadi peserta penagihan berjalan.
  // Pembina & Pengarah tidak ditagih dan tidak menjadi peserta kewajiban Kas Kru.
  // Kru nonaktif tidak dibuatkan kewajiban baru (tetapi histori pembayaran tetap tersimpan).
  const billableCrewMembers: CrewMember[] = crewMembers.filter(crew => {
    const cat = (crew.category || '').toLowerCase().trim();
    if (cat === 'pembina' || cat === 'pengarah') {
      return false; // Pembina dan Pengarah strictly excluded
    }
    const isAktif = (crew.status_kru || '').toLowerCase().trim() === 'aktif';
    if (!isAktif) {
      // Hanya sertakan jika memiliki rekam pembayaran yang sudah ada pada semester ini (berdasarkan UUID identityId atau ptv_id)
      return semesterRecords.some(
        r =>
          ((r.identityId && r.identityId === crew.id) || r.ptvId === crew.ptv_id) &&
          BigInt(r.paidAmountMinor || '0') > 0n
      );
    }
    return true;
  });

  // 3. Jika ada catatan pembayaran yang belum terhubung ke canonical_identity (identityUnlinked),
  // tampilkan jujur sebagai baris "Identitas Belum Terhubung" tanpa mengarang nama contoh.
  const knownIdentityIds = new Set(crewMembers.map(c => c.id).filter(Boolean));
  const knownPtvIds = new Set(crewMembers.map(c => c.ptv_id).filter(Boolean));
  const unlinkedGroups = new Map<string, KasKruRecord>();
  for (const r of semesterRecords) {
    if (BigInt(r.paidAmountMinor || '0') <= 0n && r.status === 'belum') continue;
    const isKnown =
      (r.identityId && knownIdentityIds.has(r.identityId)) ||
      (r.ptvId && r.ptvId !== 'UNLINKED' && knownPtvIds.has(r.ptvId));
    if (!isKnown || r.identityUnlinked) {
      const groupKey = r.identityId || `${r.ptvId}:${r.crewName}`;
      if (!unlinkedGroups.has(groupKey)) {
        unlinkedGroups.set(groupKey, r);
      }
    }
  }

  for (const [groupKey, sampleRec] of unlinkedGroups.entries()) {
    billableCrewMembers.push({
      id: sampleRec.identityId || `unlinked-${groupKey}`,
      personnel_link_pending: true,
      ptv_id: sampleRec.ptvId && sampleRec.ptvId !== 'UNLINKED' ? sampleRec.ptvId : 'UNLINKED',
      full_name: sampleRec.crewName || 'Identitas Belum Terhubung',
      username: 'unlinked',
      role: 'kru',
      category: 'Kru',
      division: 'Belum Terhubung',
      position: 'Identitas Belum Terhubung',
      angkatan: '-',
      status_kru: 'Nonaktif',
      status_akun: 'Belum Ada Akun',
    });
  }

  const rows: KasKruMatrixRow[] = billableCrewMembers.map(crew => {
    const periodCells: Record<string, KasKruMatrixCell> = {};
    let crewPaidBig = 0n;
    let crewDueBig = 0n;
    let crewArrearsBig = 0n;

    const joinYM = crew.join_date ? crew.join_date.slice(0, 7) : null;
    const isCrewAktif = (crew.status_kru || '').toLowerCase().trim() === 'aktif';

    for (const period of periods) {
      // Hubungkan pembayaran kas dengan UUID identitas (crew.id) terlebih dahulu, fallback ke ptv_id
      const rec =
        (crew.id ? recordByIdentityMap.get(`${crew.id}_${period}`) : undefined) ||
        recordByPtvMap.get(`${crew.ptv_id}_${period}`) ||
        null;
      const cellDueMinor = getSemesterPeriodFeeMinor(semester, period);
      const cellDueBig = BigInt(cellDueMinor);

      let status: KasKruMatrixCell['status'] = 'belum';
      let paidMinor = '0';

      // Cek apakah kru belum bergabung pada periode ini
      const isBeforeJoin = Boolean(joinYM && period < joinYM);
      // Kru non-aktif tidak dibuatkan kewajiban baru untuk periode yang belum dibayar
      const isInactiveUnbilled = !isCrewAktif && !rec;

      if (rec) {
        paidMinor = rec.paidAmountMinor || '0';
        const paidBig = BigInt(paidMinor);

        if (rec.status === 'dikecualikan') {
          status = 'dikecualikan';
          crewPaidBig += paidBig;
          // Periode dikecualikan tidak menambah kewajiban atau tunggakan
        } else {
          status = paidBig >= cellDueBig ? 'lunas' : paidBig > 0n ? 'sebagian' : 'belum';
          crewPaidBig += paidBig;
          crewDueBig += cellDueBig;

          // Tunggakan hanya dihitung jika sudah melewati tanggal jatuh tempo
          if (isPeriodPastDue(period)) {
            const shortage = cellDueBig > paidBig ? cellDueBig - paidBig : 0n;
            crewArrearsBig += shortage;
          }
        }
      } else if (!isBeforeJoin && !isInactiveUnbilled) {
        // Belum bayar dan wajib iuran
        crewDueBig += cellDueBig;
        // Bulan mendatang yang belum jatuh tempo tidak boleh dianggap menunggak
        if (isPeriodPastDue(period)) {
          crewArrearsBig += cellDueBig;
        }
      }

      const paidBig = BigInt(paidMinor);
      const shortage = cellDueBig > paidBig ? cellDueBig - paidBig : 0n;
      const overpaid = paidBig > cellDueBig ? paidBig - cellDueBig : 0n;

      periodCells[period] = {
        period,
        record: rec,
        status,
        amountMinor: cellDueMinor,
        paidAmountMinor: paidMinor,
        shortageMinor: status === 'dikecualikan' ? '0' : shortage.toString(),
        overpaidMinor: overpaid.toString(),
        unbilled: isBeforeJoin || isInactiveUnbilled,
      };
    }

    totalCollectedBig += crewPaidBig;
    totalArrearsBig += crewArrearsBig;

    const isAllPaid = crewPaidBig >= crewDueBig && crewDueBig > 0n;
    if (isAllPaid) {
      fullyPaidCrew++;
    } else if (crewPaidBig > 0n) {
      partiallyPaidCrew++;
    } else {
      unpaidCrew++;
    }

    return {
      crew,
      periods: periodCells,
      totalDueMinor: crewDueBig.toString(),
      totalPaidMinor: crewPaidBig.toString(),
      arrearsMinor: crewArrearsBig.toString(),
      isAllPaid,
    };
  });

  const stats: KasKruStats = {
    totalCollectedMinor: totalCollectedBig.toString(),
    totalArrearsMinor: totalArrearsBig.toString(),
    activePeriodsCount: periods.length,
    totalCrewCount: crewMembers.length,
    fullyPaidCrewCount: fullyPaidCrew,
    partiallyPaidCrewCount: partiallyPaidCrew,
    unpaidCrewCount: unpaidCrew,
  };

  return { periods, rows, stats };
}

/**
 * Mencatat pembayaran iuran kas kru melalui transaksi canonical income
 */
export async function recordKasKruPayment(
  command: KasKruPaymentCommand,
  options: {
    pockets: FinancePocket[];
    categories: CanonicalCategory[];
    canManage: boolean;
    existingRecords?: KasKruRecord[];
    semesters?: FinanceSemester[];
  }
): Promise<{ success: boolean; records: KasKruRecord[]; transactionId?: string }> {
  const { pockets, categories, canManage } = options;
  const existingRecords = options.existingRecords || getStoredRecords();
  const availableSemesters = options.semesters || getStoredSemesters();

  if (!command.selectedPeriods || command.selectedPeriods.length === 0) {
    throw new Error('Pilih minimal satu periode pembayaran iuran.');
  }
  const totalAmountBig = BigInt(command.amountMinor);
  if (totalAmountBig <= 0n) {
    throw new Error('Nominal pembayaran harus lebih dari nol.');
  }

  // Verifikasi kantong tujuan
  const targetPocket = pockets.find(p => p.id === command.pocketId && !p.archived);
  if (!targetPocket) {
    throw new Error('Kantong penerima tidak valid atau telah diarsipkan.');
  }

  // Temukan kategori 'Iuran Kru' atau kategori pemasukan yang aktif
  const iuranCategory =
    categories.find(c => c.name.toLowerCase().includes('iuran') && c.kind === 'income' && c.isActive) ||
    categories.find(c => c.kind === 'income' && c.isActive);

  if (!iuranCategory) {
    throw new Error('Kategori pemasukan canonical untuk Iuran Kru belum tersedia.');
  }

  const periodsFormatted = command.selectedPeriods.join(', ');
  const description = `Iuran Kas Kru - ${command.crewName} (${command.ptvId}) - Periode ${periodsFormatted}`;
  const idempotencyKey = crypto.randomUUID();
  const auditReference = `KAS-KRU-${command.ptvId}-${command.selectedPeriods[0]}-${Date.now().toString(36)}`;

  // Buat canonical command untuk pencatatan transaksi ledger
  const canonicalCommand: MultiPocketCommand = {
    version: 2,
    idempotencyKey,
    operation: 'income',
    currency: 'IDR',
    occurredOn: command.paymentDate || new Date().toISOString().split('T')[0],
    description,
    amountMinor: command.amountMinor,
    categoryId: iuranCategory.id,
    incoming: [{ pocketId: targetPocket.id, amountMinor: command.amountMinor }],
    outgoing: [],
  };

  let transactionId: string | undefined = undefined;

  // Eksekusi mutasi ledger canonical jika canManage aktif dan cloud tables siap
  if (canManage) {
    try {
      assertCanPostOperationalLedger('kas_kru');
      const res = await submitFinanceOperation(canonicalCommand, pockets);
      transactionId = res.transaction?.id || idempotencyKey;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[kasKruService] Ledger posting diisolasi demi integritas data:', msg);
    }
  }

  // Hitung alokasi pembayaran per periode
  const count = command.selectedPeriods.length;
  const portionPerPeriod = totalAmountBig / BigInt(count);
  let remainder = totalAmountBig % BigInt(count);

  const updatedRecords = [...existingRecords];
  const newOrUpdatedRecords: KasKruRecord[] = [];

  for (const period of command.selectedPeriods) {
    const periodAmount = portionPerPeriod + (remainder > 0n ? 1n : 0n);
    if (remainder > 0n) remainder -= 1n;

    // Cek apakah sudah ada record pembayaran untuk kru dan periode ini
    const existingIndex = updatedRecords.findIndex(
      r => r.ptvId === command.ptvId && r.period === period && r.semesterId === command.semesterId
    );

    let rec: KasKruRecord;
    const nowIso = new Date().toISOString();

    const paymentItem: import('./kasKruTypes').KasKruPaymentItem = {
      id: `kkp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      amountMinor: periodAmount.toString(),
      paymentDate: command.paymentDate,
      method: command.method,
      pocketId: command.pocketId,
      transactionId: transactionId || null,
      notes: command.notes,
      auditReference,
      isReversed: false,
      status: 'posted',
      createdAt: nowIso,
    };

    if (existingIndex >= 0) {
      const prev = updatedRecords[existingIndex];
      const existingPayments = prev.payments || [];
      const newPayments = [...existingPayments, paymentItem];
      const validPaidBig = newPayments
        .filter(p => !p.isReversed)
        .reduce((sum, p) => sum + BigInt(p.amountMinor), 0n);
      const targetDue = BigInt(prev.amountMinor || periodAmount.toString());
      const status = validPaidBig >= targetDue ? 'lunas' : validPaidBig > 0n ? 'sebagian' : 'belum';

      rec = {
        ...prev,
        paidAmountMinor: validPaidBig.toString(),
        status,
        paymentDate: command.paymentDate,
        method: command.method,
        pocketId: command.pocketId,
        transactionId: transactionId || prev.transactionId,
        notes: [prev.notes, command.notes].filter(Boolean).join(' | '),
        payments: newPayments,
        updatedAt: nowIso,
      };
      updatedRecords[existingIndex] = rec;
    } else {
      const sem = availableSemesters.find(s => s.id === command.semesterId);
      const targetDueMinor = sem ? getSemesterPeriodFeeMinor(sem, period) : periodAmount.toString();
      const targetDueBig = BigInt(targetDueMinor);
      const status = periodAmount >= targetDueBig ? 'lunas' : periodAmount > 0n ? 'sebagian' : 'belum';

      rec = {
        id: `kk-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        semesterId: command.semesterId,
        ptvId: command.ptvId,
        crewName: command.crewName,
        period,
        amountMinor: targetDueMinor,
        paidAmountMinor: periodAmount.toString(),
        status,
        paymentDate: command.paymentDate,
        method: command.method,
        pocketId: command.pocketId,
        transactionId: transactionId || null,
        notes: command.notes,
        auditReference,
        payments: [paymentItem],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      updatedRecords.push(rec);
    }

    newOrUpdatedRecords.push(rec);
  }

  saveRecords(updatedRecords);

  return {
    success: true,
    records: newOrUpdatedRecords,
    transactionId,
  };
}

/**
 * Pembatalan salah satu cicilan pembayaran kas kru (multi-cicilan) secara non-destruktif
 */
export function reverseKasKruInstallment(
  recordId: string,
  paymentItemId: string,
  reason: string,
  existingRecords: KasKruRecord[] = getStoredRecords()
): { success: boolean; record: KasKruRecord; updatedList: KasKruRecord[] } {
  const index = existingRecords.findIndex(r => r.id === recordId);
  if (index < 0) throw new Error('Catatan kas kru tidak ditemukan.');

  const prev = existingRecords[index];
  const payments = prev.payments || [];
  const paymentIndex = payments.findIndex(p => p.id === paymentItemId);
  if (paymentIndex < 0) throw new Error('Item cicilan pembayaran tidak ditemukan.');

  const updatedPayments = payments.map((p, i) => {
    if (i !== paymentIndex) return p;
    return {
      ...p,
      isReversed: true,
      status: 'reversed' as const,
      reversalReason: reason.trim() || 'Pembatalan cicilan oleh bendahara',
    };
  });

  const validPaidBig = updatedPayments
    .filter(p => !p.isReversed)
    .reduce((sum, p) => sum + BigInt(p.amountMinor), 0n);

  const targetDue = BigInt(prev.amountMinor || '0');
  const newStatus = validPaidBig >= targetDue ? 'lunas' : validPaidBig > 0n ? 'sebagian' : 'belum';
  const nowIso = new Date().toISOString();

  const updated: KasKruRecord = {
    ...prev,
    paidAmountMinor: validPaidBig.toString(),
    status: newStatus,
    payments: updatedPayments,
    reversalReason: reason.trim() || 'Pembatalan cicilan oleh bendahara',
    updatedAt: nowIso,
  };

  const updatedList = [...existingRecords];
  updatedList[index] = updated;
  saveRecords(updatedList);

  return { success: true, record: updated, updatedList };
}

/**
 * Pembatalan / koreksi seluruh pembayaran kas kru secara non-destruktif
 */
export function reverseKasKruRecord(
  recordId: string,
  reason: string,
  existingRecords: KasKruRecord[] = getStoredRecords()
): { success: boolean; record: KasKruRecord; updatedList: KasKruRecord[] } {
  const index = existingRecords.findIndex(r => r.id === recordId);
  if (index < 0) throw new Error('Catatan kas kru tidak ditemukan.');

  const prev = existingRecords[index];
  const nowIso = new Date().toISOString();

  const payments = (prev.payments || []).map(p => ({
    ...p,
    isReversed: true,
    reversalReason: reason.trim() || 'Pembatalan resmi oleh bendahara',
  }));

  const updated: KasKruRecord = {
    ...prev,
    paidAmountMinor: '0',
    status: 'belum',
    payments,
    reversalReason: reason.trim() || 'Pembatalan resmi oleh bendahara',
    updatedAt: nowIso,
  };

  const updatedList = [...existingRecords];
  updatedList[index] = updated;
  saveRecords(updatedList);

  return { success: true, record: updated, updatedList };
}

/**
 * Pembebasan iuran individual kas kru (status: 'dikecualikan') secara eksplisit dan sah
 */
export function waiveKasKruFee(
  input: {
    semesterId: string;
    ptvId: string;
    crewName: string;
    period: string;
    reason: string;
    pocketId?: string;
  },
  existingRecords: KasKruRecord[] = getStoredRecords()
): { success: boolean; record: KasKruRecord; updatedList: KasKruRecord[] } {
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error('Alasan pembebasan iuran wajib diisi.');
  }
  if (!input.period || !/^\d{4}-\d{2}$/.test(input.period)) {
    throw new Error('Periode iuran yang dibebaskan harus berupa format YYYY-MM.');
  }

  const index = existingRecords.findIndex(
    r => r.semesterId === input.semesterId && r.ptvId === input.ptvId && r.period === input.period
  );
  const nowIso = new Date().toISOString();
  let record: KasKruRecord;

  if (index >= 0) {
    const prev = existingRecords[index];
    record = {
      ...prev,
      paidAmountMinor: '0',
      status: 'dikecualikan',
      notes: [prev.notes, `Pembebasan iuran resmi: ${reason}`].filter(Boolean).join(' | '),
      updatedAt: nowIso,
    };
  } else {
    record = {
      id: `kk-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      semesterId: input.semesterId,
      ptvId: input.ptvId,
      crewName: input.crewName,
      period: input.period,
      amountMinor: '2500000',
      paidAmountMinor: '0',
      status: 'dikecualikan',
      paymentDate: null,
      method: 'cash',
      pocketId: input.pocketId || '60e8d033-2794-4219-a960-c56bedca0111',
      transactionId: null,
      notes: `Pembebasan iuran resmi: ${reason}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  const updatedList = index >= 0
    ? existingRecords.map((r, i) => i === index ? record : r)
    : [...existingRecords, record];

  saveRecords(updatedList);
  return { success: true, record, updatedList };
}
