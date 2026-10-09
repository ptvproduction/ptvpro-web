import { BerandaSummary } from './types';

export interface IBerandaService {
  getSummary(): Promise<BerandaSummary>;
}

/**
 * Local development repository for Beranda module.
 * Protects production databases from scaffold testing.
 */
export class LocalBerandaService implements IBerandaService {
  async getSummary(): Promise<BerandaSummary> {
    // Simulate brief network delay
    await new Promise((resolve) => setTimeout(resolve, 150));

    return {
      activeCrewCount: 24,
      ongoingEventsCount: 3,
      activeLoansCount: 7,
      systemNotice: 'Selamat datang di PTV PRO Super App. Sistem berjalan dalam mode Local Scaffold.',
      upcomingAgenda: [
        {
          id: 'evt-1',
          title: 'Siaran Langsung Kajian Ahad Pagi',
          date: '12 Okt 2026, 08:00 WIB',
          category: 'Live Broadcast',
        },
        {
          id: 'evt-2',
          title: 'Dokumentasi Wisuda Tahfidz Pesantren',
          date: '15 Okt 2026, 13:00 WIB',
          category: 'Event Liputan',
        },
        {
          id: 'evt-3',
          title: 'Briefing Koordinasi Haul Akbar 2026',
          date: '18 Okt 2026, 19:30 WIB',
          category: 'Rapat Studio',
        },
      ],
    };
  }
}

let berandaServiceInstance: IBerandaService | null = null;

export function getBerandaService(): IBerandaService {
  if (!berandaServiceInstance) {
    berandaServiceInstance = new LocalBerandaService();
  }
  return berandaServiceInstance;
}
