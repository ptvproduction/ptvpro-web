import { DamageReportItem } from './types';
import { writeReport } from '../reportPersistence';

export class DamageReportService {
  create(report: Omit<DamageReportItem, 'id' | 'reportedAt' | 'status' | 'qcLocked'>) {
    return writeReport('damage', 'create', report);
  }
  updateQC(id: string, status: DamageReportItem['status'], qcNotes: string) {
    return writeReport('damage', 'update', { status, qcNotes }, id);
  }
  delete(id: string) { return writeReport('damage', 'delete', {}, id); }
  async getReports(): Promise<DamageReportItem[]> {
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/lapor-kerusakan', {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!res.ok) {
          let errorMsg = `HTTP Error ${res.status}: Gagal memuat data laporan kerusakan.`;
          const errData = await res.json().catch(() => null);
          if (errData?.error) errorMsg = errData.error;
          throw new Error(errorMsg);
        }

        const contentType = res.headers?.get?.('content-type');
        if (contentType && !contentType.includes('application/json')) {
          throw new Error('Respon server bukan format JSON yang valid.');
        }

        const body = await res.json();
        if (!body.success || !Array.isArray(body.reports)) {
          throw new Error('Format respon API laporan kerusakan tidak valid.');
        }

        return body.reports as DamageReportItem[];
      } catch (err: any) {
        console.error('[DamageReportService Error]:', err.message);
        throw err;
      }
    }
    return [];
  }
}

export const damageReportService = new DamageReportService();
