import { AcaraItem } from '../acara/types';
import { Announcement } from '../broadcast/types';
import { MyLoanItem } from './berandaDataUtils';
import { DokumenStats } from '../dokumen-saya/dokumenService';

export interface AgendaItem {
  id: string;
  title: string;
  date: string;
  category: 'Live Broadcast' | 'Event Liputan' | 'Rapat Studio' | 'Umum';
}

export interface BerandaSummary {
  activeCrewCount: number;
  ongoingEventsCount: number;
  activeLoansCount: number;
  systemNotice?: string;
  upcomingAgenda: AgendaItem[];
}

export interface BerandaAggregatedData {
  events: AcaraItem[];
  announcements: Announcement[];
  myLoans: MyLoanItem[];
  docStats: DokumenStats;
  summary: BerandaSummary;
}
