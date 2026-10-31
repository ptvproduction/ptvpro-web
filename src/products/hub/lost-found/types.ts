export type LostFoundType = 'hilang' | 'temuan';

export type LostFoundStatus = 'Dicari' | 'Ditemukan' | 'Dikembalikan';

export interface LostFoundItem {
  id: string;
  type: LostFoundType;
  title: string;
  category: string;
  location: string;
  date: string;
  description: string;
  photoUrl?: string;
  reporterName: string;
  reporterContact: string;
  status: LostFoundStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  isCurrentUser?: boolean;
}

export type LostFoundFilterTab = 'Semua' | 'Dicari' | 'Ditemukan' | 'Dikembalikan';
