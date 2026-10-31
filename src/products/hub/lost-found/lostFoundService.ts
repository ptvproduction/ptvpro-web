import { LostFoundItem } from './types';
import { writeReport } from '../reportPersistence';

export class LostFoundService {
  create(item: Omit<LostFoundItem, 'id' | 'createdAt' | 'status'>) {
    return writeReport('lostfound', 'create', item);
  }
  updateStatus(id: string, status: LostFoundItem['status']) {
    return writeReport('lostfound', 'update', { status }, id);
  }
  delete(id: string) { return writeReport('lostfound', 'delete', {}, id); }
  async getItems(): Promise<LostFoundItem[]> {
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/lost-found', {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!res.ok) {
          let errorMsg = `HTTP Error ${res.status}: Gagal memuat data lost & found.`;
          const errData = await res.json().catch(() => null);
          if (errData?.error) errorMsg = errData.error;
          throw new Error(errorMsg);
        }

        const contentType = res.headers?.get?.('content-type');
        if (contentType && !contentType.includes('application/json')) {
          throw new Error('Respon server bukan format JSON yang valid.');
        }

        const body = await res.json();
        if (!body.success || !Array.isArray(body.items)) {
          throw new Error('Format respon API lost & found tidak valid.');
        }

        return body.items as LostFoundItem[];
      } catch (err: any) {
        console.error('[LostFoundService Error]:', err.message);
        throw err;
      }
    }
    return [];
  }
}

export const lostFoundService = new LostFoundService();
