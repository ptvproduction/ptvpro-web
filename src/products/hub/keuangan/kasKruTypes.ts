import type { CrewMember } from '@products/hub/kru/types';

export interface KasKruFeeHistoryEntry {
  id: string;
  semesterId: string;
  semesterName: string;
  period: string; // YYYY-MM
  previousFeeMinor: string;
  newFeeMinor: string;
  changedAt: string; // ISO 8601 timestamp
  changedByIdentityId?: string;
  changedByPtvId: string;
  changedByName: string;
}

export interface FinanceSemester {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  monthlyFeeMinor: string; // Default base fee (e.g. '2500000' = Rp 25.000)
  monthlyFees?: Record<string, string>; // Pemetaan tarif independen per periode: 'YYYY-MM' -> fee in minor units
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
}

export type KasKruStatus = 'lunas' | 'sebagian' | 'belum' | 'dikecualikan';

export interface KasKruPaymentItem {
  id: string;
  amountMinor: string;
  paymentDate: string;
  paidAt?: string;
  method: 'cash' | 'transfer' | 'qris';
  pocketId: string;
  transactionId: string | null;
  recordedBy?: string;
  notes?: string;
  auditReference?: string;
  isReversed?: boolean;
  status?: 'posted' | 'reversed';
  reversalReason?: string;
  createdAt: string;
}

export interface KasKruRecord {
  id: string;
  semesterId: string;
  identityId?: string | null; // UUID canonical_identity.id
  identityUnlinked?: boolean; // True jika identitas personel belum terhubung di canonical_identity
  ptvId: string;
  crewName: string;
  period: string; // YYYY-MM
  amountMinor: string; // Nominal tagihan berlaku (e.g. '2500000')
  paidAmountMinor: string; // Total nominal terbayar sah (e.g. '2500000')
  status: KasKruStatus;
  paymentDate: string | null;
  method: 'cash' | 'transfer' | 'qris';
  pocketId: string;
  transactionId: string | null; // Canonical transaction id (atau payment terakhir)
  notes?: string;
  auditReference?: string;
  reversalReason?: string;
  payments?: KasKruPaymentItem[]; // Detail multi-cicilan per periode
  createdAt: string;
  updatedAt: string;
}

export interface KasKruMatrixCell {
  period: string;
  record: KasKruRecord | null;
  status: KasKruStatus;
  amountMinor: string;
  paidAmountMinor: string;
  shortageMinor?: string;
  overpaidMinor?: string;
  unbilled?: boolean;
}

export interface KasKruMatrixRow {
  crew: CrewMember;
  periods: Record<string, KasKruMatrixCell>;
  totalDueMinor: string;
  totalPaidMinor: string;
  arrearsMinor: string;
  isAllPaid: boolean;
}

export interface KasKruPaymentCommand {
  ptvId: string;
  crewName: string;
  semesterId: string;
  selectedPeriods: string[];
  amountMinor: string;
  pocketId: string;
  paymentDate: string;
  method: 'cash' | 'transfer' | 'qris';
  notes?: string;
}

export interface KasKruStats {
  totalCollectedMinor: string;
  totalArrearsMinor: string;
  activePeriodsCount: number;
  totalCrewCount: number;
  fullyPaidCrewCount: number;
  partiallyPaidCrewCount: number;
  unpaidCrewCount: number;
}
