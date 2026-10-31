/**
 * PTV PRO — Modul Acara Service
 * Service layer untuk pengambilan data acara liputan & agenda studio dari Supabase Staging
 * Mendukung autentikasi Vercel Serverless `/api/acara` dengan fallback Supabase client langsung.
 */

import { AcaraItem, AcaraCrewMember, AcaraGearAllocation, AcaraRundownItem, CreateAcaraDTO, UpdateAcaraPayloadDTO } from './types';
import { getSupabaseClient, isSupabaseConfigured } from '@core/supabase/client';
import { getKruService } from '@products/hub/kru/kruService';
import { normalizeAcaraColor } from './utils/acaraColors';

export interface RawAcaraDbRow {
  id: string;
  nama_acara: string;
  tanggal: string;
  waktu_mulai?: string | null;
  waktu_selesai?: string | null;
  lokasi?: string | null;
  deskripsi?: string | null;
  status: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  poster_url?: string | null;
  tipe?: string | null;
}

export function mapDbRowToAcaraItem(row: RawAcaraDbRow, todayStr = new Date().toISOString().slice(0, 10)): AcaraItem {
  const ev_id = String(row.id || '');
  let desc = String(row.deskripsi || '');
  let meta: any = {};

  if (desc.includes('<!-- PTV_META:')) {
    const match = desc.match(/<!--\s*PTV_META:\s*({[\s\S]*?})\s*-->/);
    if (match && match[1]) {
      try {
        meta = JSON.parse(match[1]);
        desc = desc.replace(match[0], '').trim();
      } catch {
        // Abaikan parse error, pertahankan deskripsi mentah
      }
    }
  }

  // Resolusi status sesuai arsitektur legacy
  const sb_st = String(row.status || 'aktif').trim().toLowerCase();
  let status: AcaraItem['status'] = 'Mendatang';
  if (sb_st === 'selesai') {
    status = 'Selesai';
  } else if (sb_st === 'batal' || sb_st === 'dibatalkan') {
    status = 'Dibatalkan';
  } else if (meta.status_detail && (meta.status_detail.toLowerCase() === 'berjalan' || meta.status_detail.toLowerCase() === 'ongoing')) {
    status = 'Berlangsung';
  } else {
    const evDate = String(row.tanggal || '');
    if (evDate) {
      if (evDate < todayStr) {
        status = 'Selesai';
      } else if (evDate === todayStr) {
        status = 'Berlangsung';
      } else {
        status = 'Mendatang';
      }
    }
  }

  // Normalisasi penugasan kru
  const rawCrew = Array.isArray(meta.crew) ? meta.crew : [];
  const cleanCrew: AcaraCrewMember[] = rawCrew.map((c: any) => {
    if (typeof c === 'object' && c !== null) {
      return {
        id: String(c.id || c.crew_id || c.kru_id || ''),
        name: String(c.name || c.nama || c.full_name || ''),
        photo: c.photo || '',
        division: c.division || c.divisi || '',
        role: c.role || '',
        job: String(c.job || c.tugas || c.jabatan_acara || ''),
        tugas: String(c.job || c.tugas || c.jabatan_acara || '')
      };
    } else if (typeof c === 'string' && c.trim()) {
      return {
        id: '',
        name: c.trim(),
        job: '',
        tugas: ''
      };
    }
    return null;
  }).filter((c: any): c is AcaraCrewMember => c !== null);

  // Normalisasi alokasi peralatan
  const rawGear = Array.isArray(meta.gear) ? meta.gear : [];
  const cleanGear: AcaraGearAllocation[] = rawGear.map((g: any) => {
    if (typeof g === 'object' && g !== null) {
      return {
        id: String(g.id || g.item_id || ''),
        item_id: String(g.id || g.item_id || ''),
        name: String(g.name || ''),
        code: String(g.code || ''),
        photo: g.photo || g.foto_url || '',
        cat: String(g.cat || ''),
        qty: Math.max(1, parseInt(g.qty, 10) || 1),
        units: Array.isArray(g.units) ? g.units : []
      };
    }
    return null;
  }).filter((g: any): g is AcaraGearAllocation => g !== null);

  // Normalisasi susunan rundown
  const rawRundown = Array.isArray(meta.rundown) ? meta.rundown : [];
  const cleanRundown: AcaraRundownItem[] = rawRundown.map((r: any, idx: number) => ({
    id: String(r.id || `rd-${ev_id}-${idx}`),
    acara_id: ev_id,
    jam_mulai: String(r.jam_mulai || r.start_time || r.waktu_mulai || '08:00'),
    kegiatan: String(r.kegiatan || r.agenda || r.pekerjaan || ''),
    sort_key: String(r.sort_key || r.urutan || idx + 1)
  }));

  // Format string waktu
  let timeStr = meta.time || '';
  if (!timeStr && (row.waktu_mulai || row.waktu_selesai)) {
    timeStr = `${row.waktu_mulai || '08:00'}${row.waktu_selesai ? ` – ${row.waktu_selesai}` : ' – Selesai'}`;
  }
  if (!timeStr) {
    timeStr = '08:00 – Selesai';
  }

  const name = String(row.nama_acara || 'Acara PTV');
  const date = String(row.tanggal || '');
  const loc = String(row.lokasi || meta.loc || 'Studio PTV');
  const notes = desc || meta.notes || '—';
  const type = String(meta.type || row.tipe || 'internal');
  const dresscode = String(meta.dresscode || '');

  return {
    id: ev_id,
    name,
    date,
    time: timeStr,
    loc,
    status,
    notes,
    crew: cleanCrew,
    gear: cleanGear,
    rundown: cleanRundown,
    display_color: normalizeAcaraColor(meta.display_color),
    sessions: Array.isArray(meta.sessions) ? meta.sessions : [],
    notulensi_ids: Array.isArray(meta.notulensi_ids) ? meta.notulensi_ids : [],
    type,
    dresscode,
    doc: row.poster_url || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export const acaraService = {
  async getEvents(): Promise<AcaraItem[]> {
    // 1. Fetch via authenticated serverless endpoint /api/acara
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch('/api/acara', {
          credentials: 'same-origin',
        });
        if (res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.events)) {
            return json.events;
          }
        }
        if (res.status === 401) {
          throw new Error('Sesi login diperlukan untuk melihat agenda acara. Silakan masuk ke Hub terlebih dahulu.');
        }
        if (res.status === 403) {
          throw new Error('Akses ditolak: Akun Anda tidak memiliki izin untuk melihat modul Acara.');
        }
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Sesi login') || err.message.includes('Akses ditolak'))) {
        throw err;
      }
      // Jika fetch gagal koneksi (network error), coba fallback langsung ke Supabase client
    }

    // 2. Direct Supabase client query
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('ptv_acara')
          .select('id, nama_acara, tanggal, waktu_mulai, waktu_selesai, lokasi, deskripsi, status, created_by, created_at, updated_at')
          .order('tanggal', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((row: any) => mapDbRowToAcaraItem(row));
        }
        if (error) {
          throw new Error('Gagal memuat data agenda kegiatan.');
        }
      } catch (err: any) {
        throw new Error(err.message || 'Gagal memuat data agenda kegiatan.');
      }
    }

    return [];
  },

  async getActiveCrewCandidates(): Promise<AcaraCrewMember[]> {
    return getKruService().getActiveCrewCandidates();
  },

  async updateEvent(payload: UpdateAcaraPayloadDTO): Promise<AcaraItem> {
    if (!payload.id) {
      throw new Error('ID Acara (UUID) wajib disertakan untuk melakukan pembaruan.');
    }

    const endpoint = typeof window !== 'undefined' ? '/api/acara' : (process.env.TEST_API_URL || '/api/acara');

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
    }

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // JSON parse error
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Sesi login telah berakhir atau tidak valid. Silakan login kembali.');
      }
      if (res.status === 403) {
        throw new Error(json?.error || 'Akses ditolak: Akun Anda tidak memiliki izin untuk mengubah data Acara.');
      }
      if (res.status === 409) {
        throw new Error(json?.error || 'Konflik pembaruan: Data acara telah diubah oleh pengguna lain. Muat ulang halaman terlebih dahulu.');
      }
      throw new Error(json?.error || 'Gagal memperbarui data agenda kegiatan.');
    }

    if (json?.event) {
      return json.event;
    }

    throw new Error('Gagal memproses data agenda kegiatan.');
  },

  async createEvent(dto: CreateAcaraDTO): Promise<AcaraItem> {
    if (!dto.name || !dto.name.trim()) {
      throw new Error('Nama kegiatan / acara wajib diisi.');
    }
    if (!dto.date) {
      throw new Error('Tanggal acara wajib diisi.');
    }

    const endpoint = typeof window !== 'undefined' ? '/api/acara' : (process.env.TEST_API_URL || '/api/acara');

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(dto),
      });
    } catch {
      throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
    }

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // JSON parse error
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Sesi login telah berakhir atau tidak valid. Silakan login kembali.');
      }
      if (res.status === 403) {
        throw new Error(json?.error || 'Akses ditolak: Akun Anda tidak memiliki izin untuk menambah data Acara.');
      }
      throw new Error(json?.error || 'Gagal menyimpan agenda kegiatan baru.');
    }

    if (json?.event) {
      return json.event;
    }

    throw new Error('Gagal memproses data agenda kegiatan.');
  },

  async deleteEvent(id: string): Promise<boolean> {
    if (!id) {
      throw new Error('ID Acara (UUID) wajib disertakan untuk penghapusan.');
    }

    const endpoint = typeof window !== 'undefined' ? '/api/acara' : (process.env.TEST_API_URL || '/api/acara');

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ id }),
      });
    } catch {
      throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
    }

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // JSON parse error
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Sesi login telah berakhir atau tidak valid. Silakan login kembali.');
      }
      if (res.status === 403) {
        throw new Error(json?.error || 'Akses ditolak: Akun Anda tidak memiliki izin untuk menghapus data Acara.');
      }
      throw new Error(json?.error || 'Gagal menghapus agenda kegiatan.');
    }

    return true;
  },
};
