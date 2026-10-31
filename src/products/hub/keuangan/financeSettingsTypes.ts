export interface FinanceOperationalSettings {
  defaultMonthlyFeeMinor: string; // e.g. '2500000' = Rp 25.000
  feeDueDay: number; // e.g. 10 (tanggal 10 setiap bulan)
  defaultLoanDueDays: number; // e.g. 30 hari
  treasurerName: string; // e.g. "Farsya"
  treasurerPtvId: string; // e.g. "PTV-023"
  treasurerPhone: string; // e.g. "08123456789"
  officialBankPocketId: string | null;
  officialQrisPocketId: string | null;
}

export interface QrisUploadPayload {
  pocketId: string;
  merchantName: string;
  nmid: string;
  assetPath: string;
  verifiedAt: string;
}
