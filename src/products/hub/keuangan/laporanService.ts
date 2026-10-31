import type {
  CanonicalCategory,
  CanonicalTransaction,
  FinancePocket,
} from './financeCanonical';
import type { FinanceOperationalData } from './financeOperationalData';
import type { CrewMember } from '@products/hub/kru/types';
import { isTestTransaction } from './financeCanonical';
import { calculateKasKruMatrix } from './kasKruService';
import { calculatePiutangStats } from './piutangService';

export type LaporanDatePreset =
  | 'semua'
  | 'bulan_ini'
  | 'bulan_lalu'
  | 'triwulan'
  | 'tahun_ini'
  | 'custom';

export interface LaporanFilter {
  datePreset: LaporanDatePreset;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  pocketId: string; // 'semua' or pocket.id
  categoryId: string; // 'semua' or category.id
  kind: 'semua' | 'income' | 'expense' | 'transfer';
  status: 'posted_only' | 'all';
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  kind: 'income' | 'expense';
  amountMinor: string;
  count: number;
  percentage: number; // 0 to 100
}

export interface LaporanResult {
  filter: LaporanFilter;
  // Metrics
  totalInflowMinor: string; // Total pemasukan operasional
  totalOutflowMinor: string; // Total pengeluaran operasional
  netCashFlowMinor: string; // Arus kas bersih (Inflow - Outflow)
  totalTransferMinor: string; // Volume transfer internal (net zero)
  totalReversedMinor: string; // Total mutasi reversed
  reversedCount: number;
  // Balances
  totalBalanceMinor: string; // Total saldo seluruh kantong aktif
  openingBalanceMinor: string;
  closingBalanceMinor: string;
  pocketBalances: {
    pocket: FinancePocket;
    balanceMinor: string;
    isReconstructed: boolean;
  }[];
  // Breakdowns
  categoryDistribution: CategorySummary[];
  filteredTransactions: CanonicalTransaction[];
  // Kas Kru & Piutang Summary
  kasKruSummary: {
    totalCollectedMinor: string;
    totalArrearsMinor: string;
    unpaidCount: number;
    fullyPaidCount: number;
  };
  piutangSummary: {
    totalPrincipalMinor: string;
    totalCollectedMinor: string;
    totalRemainingMinor: string;
    activeCount: number;
    overdueCount: number;
  };
  // Reconstruction disclaimer
  hasReconstructedCash: boolean;
  reconstructedAmountMinor: string;
}

export function getDateRangeFromPreset(preset: LaporanDatePreset): { startDate: string; endDate: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  switch (preset) {
    case 'bulan_ini': {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      return { startDate: toIso(start), endDate: toIso(end) };
    }
    case 'bulan_lalu': {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { startDate: toIso(start), endDate: toIso(end) };
    }
    case 'triwulan': {
      const qStartMonth = Math.floor(m / 3) * 3;
      const start = new Date(y, qStartMonth, 1);
      const end = new Date(y, qStartMonth + 3, 0);
      return { startDate: toIso(start), endDate: toIso(end) };
    }
    case 'tahun_ini': {
      const start = new Date(y, 0, 1);
      const end = new Date(y, 11, 31);
      return { startDate: toIso(start), endDate: toIso(end) };
    }
    case 'semua':
    case 'custom':
    default:
      return { startDate: '2020-01-01', endDate: '2030-12-31' };
  }
}

export function reportTransactionAmountMinor(tx: CanonicalTransaction, pocketId: string): string {
  if (pocketId === 'semua') return tx.amountMinor;
  return tx.allocations.filter(a => a.pocketId === pocketId)
    .reduce((total, a) => total + BigInt(a.amountMinor), 0n).toString();
}

export function generateLaporan(
  transactions: CanonicalTransaction[],
  pockets: FinancePocket[],
  categories: CanonicalCategory[],
  filter: LaporanFilter,
  operational?: FinanceOperationalData,
  crewMembers?: CrewMember[]
): LaporanResult {
  // 1. Filter transaksi operasional
  const operationalTxs = transactions.filter(t => !isTestTransaction(t));

  const filtered = operationalTxs.filter(tx => {
    // Tanggal
    if (filter.startDate && tx.occurredOn < filter.startDate) return false;
    if (filter.endDate && tx.occurredOn > filter.endDate) return false;

    // Status
    if (filter.status === 'posted_only' && tx.status !== 'posted') return false;

    // Jenis
    if (filter.kind !== 'semua' && tx.kind !== filter.kind) return false;

    // Kategori
    if (filter.categoryId !== 'semua' && tx.categoryId !== filter.categoryId) return false;

    // Kantong
    if (filter.pocketId !== 'semua') {
      const hasPocket = tx.allocations && tx.allocations.some(a => a.pocketId === filter.pocketId);
      if (!hasPocket) return false;
    }

    return true;
  });

  // 2. Perhitungan agregat keuangan
  let inflowBig = 0n;
  let outflowBig = 0n;
  let transferBig = 0n;
  let reversedBig = 0n;
  let reversedCount = 0;

  for (const tx of filtered) {
    const amountBig = BigInt(reportTransactionAmountMinor(tx, filter.pocketId));

    if (tx.status === 'reversed') {
      reversedBig += amountBig;
      reversedCount++;
      continue;
    }

    if (tx.kind === 'income') {
      inflowBig += amountBig;
    } else if (tx.kind === 'expense') {
      outflowBig += amountBig;
    } else if (tx.kind === 'transfer') {
      transferBig += amountBig;
    }
  }

  const netCashFlowBig = inflowBig - outflowBig;

  // 3. Saldo per Kantong aktif
  const activePockets = pockets.filter(p => !p.archived && (filter.pocketId === 'semua' || p.id === filter.pocketId));
  let totalBalanceBig = 0n;
  const pocketBalances = activePockets.map(p => {
    const bal = p.balanceMinor ? BigInt(p.balanceMinor) : 0n;
    totalBalanceBig += bal;
    const isReconstructed = p.id === '60e8d033-2794-4219-a960-c56bedca0111';
    return {
      pocket: p,
      balanceMinor: bal.toString(),
      isReconstructed,
    };
  });

  const selectedIds = new Set(activePockets.map(p => p.id));
  const netAfter = (date: string, inclusive: boolean) => operationalTxs
    .filter(tx => tx.status === 'posted' && (inclusive ? tx.occurredOn >= date : tx.occurredOn > date))
    .reduce((sum, tx) => sum + tx.allocations.filter(a => selectedIds.has(a.pocketId))
      .reduce((net, a) => net + (a.direction === 'in' ? 1n : -1n) * BigInt(a.amountMinor), 0n), 0n);
  const openingBalanceMinor = (totalBalanceBig - netAfter(filter.startDate, true)).toString();
  const closingBalanceMinor = (totalBalanceBig - netAfter(filter.endDate, false)).toString();

  // 4. Distribusi Kategori
  const catMap = new Map<string, { sum: bigint; count: number; kind: 'income' | 'expense' }>();
  for (const tx of filtered) {
    if (tx.status === 'reversed' || tx.kind === 'transfer' || !tx.categoryId) continue;
    const catId = tx.categoryId;
    const prev = catMap.get(catId) || { sum: 0n, count: 0, kind: tx.kind };
    catMap.set(catId, {
      sum: prev.sum + BigInt(reportTransactionAmountMinor(tx, filter.pocketId)),
      count: prev.count + 1,
      kind: tx.kind,
    });
  }

  const categoryDistribution: CategorySummary[] = Array.from(catMap.entries()).map(([catId, data]) => {
    const cat = categories.find(c => c.id === catId);
    const totalRef = data.kind === 'income' ? inflowBig : outflowBig;
    const percentage = totalRef > 0n ? Number((data.sum * 10000n) / totalRef) / 100 : 0;
    return {
      categoryId: catId,
      categoryName: cat ? cat.name : 'Kategori Tidak Dikenal',
      kind: data.kind,
      amountMinor: data.sum.toString(),
      count: data.count,
      percentage,
    };
  }).sort((a, b) => Number(BigInt(b.amountMinor) - BigInt(a.amountMinor)));

  // 5. Kas Kru Summary
  const semesters = (operational?.semesters ?? []).filter(s => s.startDate <= filter.endDate && s.endDate >= filter.startDate);
  const activeSemester = semesters.find(s => s.isActive && !s.isArchived) || semesters[0];
  let kasKruSummary = {
    totalCollectedMinor: '0',
    totalArrearsMinor: '0',
    unpaidCount: 0,
    fullyPaidCount: 0,
  };

  if (activeSemester) {
    const matrix = calculateKasKruMatrix(
      { ...activeSemester, startDate: activeSemester.startDate < filter.startDate ? filter.startDate : activeSemester.startDate,
        endDate: activeSemester.endDate > filter.endDate ? filter.endDate : activeSemester.endDate },
      crewMembers ?? operational?.crewRoster ?? [],
      (operational?.records ?? []).filter(r => filter.pocketId === 'semua' || r.pocketId === filter.pocketId),
      operational?.feeDueDay
    );
    kasKruSummary = {
      totalCollectedMinor: matrix.stats.totalCollectedMinor,
      totalArrearsMinor: matrix.stats.totalArrearsMinor,
      unpaidCount: matrix.stats.unpaidCrewCount,
      fullyPaidCount: matrix.stats.fullyPaidCrewCount,
    };
  }

  // 6. Piutang Summary
  const pStats = calculatePiutangStats(operational?.loans ?? []);
  const piutangSummary = {
    totalPrincipalMinor: pStats.totalPrincipalMinor,
    totalCollectedMinor: pStats.totalCollectedMinor,
    totalRemainingMinor: pStats.totalRemainingMinor,
    activeCount: pStats.activeLoansCount,
    overdueCount: pStats.overdueLoansCount,
  };

  return {
    filter,
    totalInflowMinor: inflowBig.toString(),
    totalOutflowMinor: outflowBig.toString(),
    netCashFlowMinor: netCashFlowBig.toString(),
    totalTransferMinor: transferBig.toString(),
    totalReversedMinor: reversedBig.toString(),
    reversedCount,
    totalBalanceMinor: totalBalanceBig.toString(),
    openingBalanceMinor,
    closingBalanceMinor,
    pocketBalances,
    categoryDistribution,
    filteredTransactions: filtered,
    kasKruSummary,
    piutangSummary,
    hasReconstructedCash: true,
    reconstructedAmountMinor: '52027600', // Rp 520.276
  };
}
