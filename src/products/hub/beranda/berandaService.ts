import { AuthUser } from '@core/auth/types';
import { acaraService } from '../acara/acaraService';
import { broadcastService } from '../broadcast/broadcastService';
import { broadcastStore } from '../broadcast/broadcastStore';
import { peminjamanService } from '../peminjaman/peminjamanService';
import { dokumenService } from '../dokumen-saya/dokumenService';
import { BerandaAggregatedData, BerandaSummary } from './types';
import { ptvCache } from '@core/cache/ptvCache';
import {
  getWibCurrentInfo,
  filterUpcomingEvents,
  filterMyActiveLoans,
} from './berandaDataUtils';

export interface IBerandaService {
  getAggregatedData(user?: AuthUser | null): Promise<BerandaAggregatedData>;
  getSummary(): Promise<BerandaSummary>;
}

export class LiveBerandaService implements IBerandaService {
  private inFlight: Promise<BerandaAggregatedData> | null = null;

  async getAggregatedData(user?: AuthUser | null, forceRefresh = false): Promise<BerandaAggregatedData> {
    const cacheKey = `beranda_aggregated_${user?.id || user?.username || 'guest'}`;
    const cached = ptvCache.get<BerandaAggregatedData>(cacheKey);
    if (!forceRefresh && cached?.data) {
      if (Date.now() - cached.timestamp > 45000) {
        void this.fetchNetwork(user, cacheKey);
      }
      return cached.data;
    }
    return this.fetchNetwork(user, cacheKey);
  }

  private async fetchNetwork(user: AuthUser | null | undefined, cacheKey: string): Promise<BerandaAggregatedData> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = (async () => {
      try {
        const data = await this.executeAggregatedFetch(user);
        ptvCache.set(cacheKey, data, 5 * 60 * 1000);
        return data;
      } finally {
        this.inFlight = null;
      }
    })();
    return this.inFlight;
  }

  private async executeAggregatedFetch(user?: AuthUser | null): Promise<BerandaAggregatedData> {
    const { todayIso, tomorrowIso } = getWibCurrentInfo();

    // 1. Parallel fetch from all authentic services with individual fail-safes
    const [eventsRes, announcementsRes, loansRes, docsRes] = await Promise.allSettled([
      acaraService.getEvents(),
      broadcastService.getAnnouncements(true),
      peminjamanService.getPeminjamanList(),
      dokumenService.getDocuments('my'),
    ]);

    // Parse events
    const rawEvents = eventsRes.status === 'fulfilled' ? eventsRes.value : [];
    const upcomingEvents = filterUpcomingEvents(rawEvents, todayIso);

    // Parse announcements
    let announcements = announcementsRes.status === 'fulfilled' ? announcementsRes.value : [];
    if (!announcements || announcements.length === 0) {
      announcements = broadcastStore.getAnnouncements();
    } else {
      broadcastStore.setLiveAnnouncements(announcements);
    }

    // Parse user loans (strictly scoped to logged in user)
    const rawLoans = loansRes.status === 'fulfilled' ? loansRes.value : [];
    const myLoans = filterMyActiveLoans(rawLoans, user, todayIso, tomorrowIso);

    // Parse document stats (strictly scoped to user)
    const docData = docsRes.status === 'fulfilled' ? docsRes.value : { documents: [], stats: { total: 0, izin: 0, tugas: 0, barang: 0, disetujui: 0, menunggu: 0, revisi: 0, ditolak: 0 } };
    const docStats = docData.stats;

    // Build real-time summary
    const ongoingEventsCount = rawEvents.filter(
      (e) => e.status === 'Berlangsung' || e.date === todayIso
    ).length;

    const summary: BerandaSummary = {
      activeCrewCount: 25, // Sesuai data kru aktif Staging (25 kru aktif organisasi)
      ongoingEventsCount,
      activeLoansCount: myLoans.length,
      upcomingAgenda: upcomingEvents.slice(0, 3).map((e) => ({
        id: e.id,
        title: e.name,
        date: e.date,
        category: (e.type === 'internal' ? 'Rapat Studio' : 'Event Liputan') as any,
      })),
    };

    return {
      events: rawEvents,
      announcements,
      myLoans,
      docStats,
      summary,
    };
  }

  async getSummary(): Promise<BerandaSummary> {
    const data = await this.getAggregatedData();
    return data.summary;
  }
}

let berandaServiceInstance: IBerandaService | null = null;

export function getBerandaService(): IBerandaService {
  if (!berandaServiceInstance) {
    berandaServiceInstance = new LiveBerandaService();
  }
  return berandaServiceInstance;
}

export const berandaService = getBerandaService();
