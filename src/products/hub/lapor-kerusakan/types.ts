export type DamageStatus = 'Baru' | 'Sedang Dicek' | 'Dalam Perbaikan' | 'Selesai' | 'Rusak Total';

export type DamageSeverity = 'Ringan' | 'Sedang' | 'Berat';

export interface DamageReportItem {
  id: string;
  assetId: string;
  assetName: string;
  assetCategory: string;
  unitNumber: number;
  unitCode: string;
  unitId?: string;
  title: string;
  description: string;
  severity: DamageSeverity;
  photoUrl?: string;
  reporterName: string;
  reporterContact?: string;
  reportedAt: string;
  status: DamageStatus;
  qcBy?: string;
  qcDate?: string;
  qcNotes?: string;
  qcLocked?: boolean;
  isCurrentUser?: boolean;
  is_historical?: boolean;
}

export type DamageFilterTab =
  | 'Semua'
  | 'Baru'
  | 'Sedang Dicek'
  | 'Selesai'
  | 'Rusak Total'
  | 'Perlu Tindakan'
  | 'Dalam Proses';

export interface DamageUnitSimulation {
  assetId: string;
  unitNumber: number;
  unitCode: string;
  condition: 'Baik' | 'Rusak';
  statusText: string;
}
