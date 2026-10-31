export type BorrowerType = 'kru' | 'eksternal';

export type PiutangStatus = 'aktif' | 'lunas' | 'overdue' | 'dibatalkan';

export interface PiutangPayment {
  id: string;
  loanId: string;
  paidOn: string; // YYYY-MM-DD
  amountMinor: string; // Minor units (e.g. '5000000' = Rp 50.000)
  toPocketId: string;
  receiptTxId: string | null; // Canonical transaction id (income)
  method: 'cash' | 'transfer' | 'qris';
  notes?: string;
  createdAt: string;
  status?: 'posted' | 'reversed';
  reversalReason?: string;
}

export interface PiutangRecord {
  id: string;
  borrowerType: BorrowerType;
  borrowerId: string | null; // ptv_id jika kru internal
  borrowerName: string;
  borrowerContact: string;
  borrowerInstitution?: string;
  principalMinor: string; // Pokok pinjaman
  interestType: 'none' | 'flat'; // Jenis bunga (none atau flat satu kali)
  interestRatePercent: number; // Persentase bunga (misal 5 untuk 5%)
  interestMinor: string; // Nominal bunga (minor units)
  totalDueMinor: string; // Pokok + Bunga
  totalPaidMinor: string; // Total yang sudah terbayar
  remainingMinor: string; // Sisa tagihan
  disbursedOn: string; // Tanggal pencairan YYYY-MM-DD
  dueDate: string | null; // Tanggal jatuh tempo opsional
  disbursedFromPocketId: string;
  disbursementTxId: string | null; // Canonical transaction id (expense)
  status: PiutangStatus;
  purpose: string;
  payments: PiutangPayment[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePiutangCommand {
  borrowerType: BorrowerType;
  borrowerId?: string;
  borrowerName: string;
  borrowerContact: string;
  borrowerInstitution?: string;
  principalMinor: string;
  interestType?: 'none' | 'flat';
  interestRatePercent?: number;
  interestMinor?: string;
  disbursedOn: string;
  dueDate?: string;
  disbursedFromPocketId: string;
  purpose: string;
  notes?: string;
}

export interface RepayPiutangCommand {
  loanId: string;
  amountMinor: string;
  paidOn: string;
  toPocketId: string;
  method: 'cash' | 'transfer' | 'qris';
  notes?: string;
}

export interface PiutangStats {
  totalPrincipalMinor: string;
  totalInterestMinor: string;
  totalDueMinor: string;
  totalCollectedMinor: string;
  totalRemainingMinor: string;
  activeLoansCount: number;
  overdueLoansCount: number;
  fullyPaidLoansCount: number;
}
