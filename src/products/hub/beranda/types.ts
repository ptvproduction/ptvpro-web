export interface AgendaItem {
  id: string;
  title: string;
  date: string;
  category: 'Live Broadcast' | 'Event Liputan' | 'Rapat Studio';
}

export interface BerandaSummary {
  activeCrewCount: number;
  ongoingEventsCount: number;
  activeLoansCount: number;
  systemNotice: string;
  upcomingAgenda: AgendaItem[];
}
