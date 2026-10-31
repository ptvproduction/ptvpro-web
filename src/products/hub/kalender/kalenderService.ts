import { ContentPlannerItem, CreatePlannerDTO, UpdatePlannerDTO } from './types';

export type { CreatePlannerDTO, UpdatePlannerDTO };

export interface RawPlannerDbRow {
  id: string;
  judul: string;
  platform: string;
  status: string;
  target_tayang?: string | null;
  pic_id?: string | null;
  catatan?: string | null;
  created_at?: string;
  updated_at?: string;
}

const MASEHI_MONTHS: Record<string, number> = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
};

const HIJRI_MONTH_LIST = [
  'muharram',
  'shafar',
  'rabiul awal',
  'rabiul akhir',
  'jumadil awal',
  'jumadil akhir',
  'rajab',
  "sya'ban",
  'ramadhan',
  'syawal',
  "dzulqo'dah",
  'dzulhijjah',
];

export function parsePlannerDbRow(row: RawPlannerDbRow): ContentPlannerItem {
  let deskripsi = String(row.catatan || '');
  let metaRecurrence: any = null;

  // Extract <!-- PTV_RECURRENCE: {...} -->
  const match = deskripsi.match(/<!--\s*PTV_RECURRENCE:\s*(\{[\s\S]*?\})\s*-->/);
  if (match && match[1]) {
    try {
      metaRecurrence = JSON.parse(match[1]);
      deskripsi = deskripsi.replace(match[0], '').trim();
    } catch {
      // Abaikan error parsing comment, pertahankan deskripsi mentah
    }
  }

  const platformLower = String(row.platform || '').toLowerCase().trim();
  let recurrence_type = 'sekali_tayang';
  let bulan_hijriah: string | undefined = undefined;
  let tanggal_hijriah: number | null | undefined = undefined;
  let bulan_masehi: number | undefined = undefined;
  let tanggal_masehi: number | undefined = undefined;
  let hari_pasaran: string | undefined = undefined;
  let hari_mingguan: string | undefined = undefined;
  let kategori = 'Event Pondok';
  let subkategori = row.platform || '';
  let daftar_konten: string[] = [];
  let referensi_url = '';
  let recurrence_rule: Record<string, any> | undefined = undefined;

  if (metaRecurrence) {
    if (metaRecurrence.type) {
      recurrence_type = metaRecurrence.type;
      if (metaRecurrence.rule) {
        recurrence_rule = metaRecurrence.rule;
        if (metaRecurrence.rule.day) {
          if (recurrence_type === 'tanggal_hijriah') {
            tanggal_hijriah = Number(metaRecurrence.rule.day);
          } else {
            tanggal_masehi = Number(metaRecurrence.rule.day);
          }
        }
        if (metaRecurrence.rule.month) {
          if (typeof metaRecurrence.rule.month === 'number') {
            bulan_masehi = metaRecurrence.rule.month;
          } else {
            bulan_hijriah = String(metaRecurrence.rule.month);
          }
        }
        if (metaRecurrence.rule.pasaran) hari_pasaran = String(metaRecurrence.rule.pasaran);
        if (metaRecurrence.rule.dayOfWeek) hari_mingguan = String(metaRecurrence.rule.dayOfWeek);
      }
    } else {
      if (metaRecurrence.day && metaRecurrence.month) {
        recurrence_type = 'tanggal_hijriah';
        tanggal_hijriah = Number(metaRecurrence.day);
        bulan_hijriah = String(metaRecurrence.month);
      } else if (metaRecurrence.month) {
        recurrence_type = 'bulan_hijriah';
        bulan_hijriah = String(metaRecurrence.month);
      }
    }

    if (metaRecurrence.kategori) kategori = String(metaRecurrence.kategori);
    if (metaRecurrence.subkategori) subkategori = String(metaRecurrence.subkategori);
    if (Array.isArray(metaRecurrence.daftar_konten)) daftar_konten = metaRecurrence.daftar_konten;
    if (metaRecurrence.referensi_url) referensi_url = String(metaRecurrence.referensi_url);
    if (metaRecurrence.bulan_hijriah) bulan_hijriah = String(metaRecurrence.bulan_hijriah);
    if (metaRecurrence.tanggal_hijriah !== undefined && metaRecurrence.tanggal_hijriah !== null) {
      tanggal_hijriah = Number(metaRecurrence.tanggal_hijriah);
    }
  }

  // Jika target_tayang tersedia (misal '2026-10-22')
  if (row.target_tayang) {
    const parts = row.target_tayang.split('-');
    if (parts.length === 3) {
      bulan_masehi = parseInt(parts[1], 10);
      tanggal_masehi = parseInt(parts[2], 10);
      if (!metaRecurrence || !metaRecurrence.type) {
        recurrence_type = 'tanggal_masehi_tahunan';
        kategori = 'Event Masehi';
      }
    }
  } else if (!metaRecurrence) {
    // Periksa apakah platform adalah nama bulan Masehi atau Hijriah
    if (MASEHI_MONTHS[platformLower]) {
      bulan_masehi = MASEHI_MONTHS[platformLower];
      recurrence_type = 'bulan_masehi';
      kategori = 'Event Masehi';
    } else if (HIJRI_MONTH_LIST.some((hm) => platformLower.includes(hm))) {
      bulan_hijriah = row.platform;
      recurrence_type = 'bulan_hijriah';
      kategori = 'Event Hijriah';
    } else {
      kategori = 'Event Pondok';
      recurrence_type = 'fleksibel';
    }
  }

  if (bulan_hijriah && (!metaRecurrence || !metaRecurrence.kategori)) {
    kategori = 'Event Hijriah';
  }

  // Khusus bulan_hijriah dan bagian_bulan_hijriah: tanggal_hijriah diset null agar tidak terkunci di tanggal 1
  if (recurrence_type === 'bulan_hijriah' || recurrence_type === 'bagian_bulan_hijriah') {
    tanggal_hijriah = null;
  }

  return {
    id: String(row.id || ''),
    judul_momentum: String(row.judul || ''),
    kategori,
    subkategori,
    deskripsi,
    daftar_konten,
    referensi_url,
    recurrence_type,
    recurrence_rule,
    bulan_hijriah,
    tanggal_hijriah,
    bulan_masehi,
    tanggal_masehi,
    hari_pasaran,
    hari_mingguan,
    tanggal_mulai: row.target_tayang || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class KalenderService {
  /**
   * Mengambil data momentum & content planner nyata dari Supabase Staging via serverless endpoint.
   * Kebijakan: Fail-closed — dilarang fallback diam-diam ke mock data jika terjadi error.
   */
  async getPlanners(): Promise<ContentPlannerItem[]> {
    try {
      const res = await fetch('/api/planner', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        let errorMsg = `HTTP Error ${res.status}: Gagal memuat data momentum kalender.`;
        try {
          const errData = await res.json();
          if (errData?.error) {
            errorMsg = errData.error;
          }
        } catch {
          // Abaikan json parse error pada response non-200
        }
        throw new Error(errorMsg);
      }

      const contentType = res.headers?.get?.('content-type');
      if (contentType && !contentType.includes('application/json')) {
        throw new Error('Respon server bukan format JSON yang valid.');
      }

      const body = await res.json();
      if (!body.success || !Array.isArray(body.planners)) {
        throw new Error('Format respon API momentum tidak valid.');
      }

      return body.planners;
    } catch (err: any) {
      console.error('[KalenderService Error]:', err.message);
      throw err;
    }
  }

  /**
   * Menyimpan data momentum baru ke Supabase Staging.
   */
  async createPlanner(payload: CreatePlannerDTO): Promise<ContentPlannerItem> {
    const res = await fetch('/api/planner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let errorMsg = 'Gagal menyimpan momentum ide konten. Silakan coba lagi.';
      try {
        const errData = await res.json();
        if (errData?.error) errorMsg = errData.error;
      } catch (_err) {
        void _err;
      }
      throw new Error(errorMsg);
    }

    const data = await res.json();
    if (!data.success || !data.planner) {
      throw new Error(data?.error || 'Gagal menyimpan momentum ide konten. Silakan coba lagi.');
    }
    return data.planner;
  }

  /**
   * Memperbarui data momentum di Supabase Staging.
   */
  async updatePlanner(id: string, payload: Partial<CreatePlannerDTO>): Promise<ContentPlannerItem> {
    const res = await fetch('/api/planner', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ id, ...payload }),
    });

    if (!res.ok) {
      let errorMsg = 'Gagal memperbarui momentum ide konten. Silakan coba lagi.';
      try {
        const errData = await res.json();
        if (errData?.error) errorMsg = errData.error;
      } catch (_err) {
        void _err;
      }
      throw new Error(errorMsg);
    }

    const data = await res.json();
    if (!data.success || !data.planner) {
      throw new Error(data?.error || 'Gagal memperbarui momentum ide konten. Silakan coba lagi.');
    }
    return data.planner;
  }

  /**
   * Menghapus data momentum dari Supabase Staging.
   */
  async deletePlanner(id: string): Promise<void> {
    const res = await fetch('/api/planner', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ id }),
    });

    if (!res.ok) {
      let errorMsg = 'Gagal menghapus momentum ide konten. Silakan coba lagi.';
      try {
        const errData = await res.json();
        if (errData?.error) errorMsg = errData.error;
      } catch (_err) {
        void _err;
      }
      throw new Error(errorMsg);
    }

    const data = await res.json();
    if (!data.success) {
      throw new Error(data?.error || 'Gagal menghapus momentum ide konten. Silakan coba lagi.');
    }
  }

  /**
   * Helper normalisasi row DB mentah ke interface ContentPlannerItem
   */
  mapDbRowToPlannerItem(row: RawPlannerDbRow): ContentPlannerItem {
    return parsePlannerDbRow(row);
  }
}

export const kalenderService = new KalenderService();
