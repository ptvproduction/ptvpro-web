import { NoteItem, NoteCategoryKey, NoteType, MeetingMeta } from './types';
import { getSupabaseClient, isSupabaseConfigured } from '@core/supabase';

function mapDbRowToNoteItem(row: any): NoteItem {
  // Normalize color key to valid NoteCategoryKey ('orange' | 'yellow' | 'green' | 'purple' | 'rose')
  let warna: NoteCategoryKey = 'orange';
  const rawWarna = (row.warna || '').toLowerCase().trim();
  if (rawWarna === 'emerald' || rawWarna === 'green' || rawWarna === 'teal') {
    warna = 'green';
  } else if (rawWarna === 'yellow' || rawWarna === 'amber') {
    warna = 'yellow';
  } else if (rawWarna === 'purple' || rawWarna === 'indigo' || rawWarna === 'violet') {
    warna = 'purple';
  } else if (rawWarna === 'rose' || rawWarna === 'red' || rawWarna === 'pink') {
    warna = 'rose';
  } else if (rawWarna === 'orange') {
    warna = 'orange';
  } else {
    // Map based on kategori if available
    const kat = (row.kategori || '').toLowerCase();
    if (kat.includes('ide') || kat.includes('rencana')) warna = 'yellow';
    else if (kat.includes('info') || kat.includes('pengumuman')) warna = 'green';
    else if (kat.includes('acara') || kat.includes('agenda')) warna = 'purple';
    else if (kat.includes('tugas') || kat.includes('rundown')) warna = 'rose';
    else warna = 'orange';
  }

  // Normalize tipe ('shared' | 'meeting_minutes')
  let tipe: NoteType = 'shared';
  const rawTipe = (row.tipe || '').toLowerCase().trim();
  if (rawTipe === 'meeting_minutes' || rawTipe === 'meeting' || rawTipe === 'notulensi') {
    tipe = 'meeting_minutes';
  } else if ((row.judul || '').toLowerCase().includes('notulensi') || (row.judul || '').toLowerCase().includes('rapat')) {
    tipe = 'meeting_minutes';
  }

  // Parse tags
  let tags: string[] = [];
  if (Array.isArray(row.tags)) {
    tags = row.tags.map((t: any) => String(t));
  } else if (typeof row.tags === 'string' && row.tags.trim()) {
    try {
      const parsed = JSON.parse(row.tags);
      if (Array.isArray(parsed)) tags = parsed.map((t: any) => String(t));
    } catch {
      tags = row.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    }
  }

  // Extract Meeting Metadata if embedded in isi or metadata
  let meeting_meta: MeetingMeta | undefined = undefined;
  if (row.isi && row.isi.includes('<!-- PTV_META:')) {
    try {
      const match = row.isi.match(/<!-- PTV_META:(.*?)-->/s);
      if (match && match[1]) {
        const metaObj = JSON.parse(match[1].trim());
        meeting_meta = {
          date: metaObj.date,
          time: metaObj.time,
          loc: metaObj.loc,
          att: metaObj.att,
          event_id: metaObj.event_id,
          event_name: metaObj.event_name,
        };
      }
    } catch {
      // ignore metadata parse error
    }
  }

  return {
    id: String(row.id),
    tipe,
    judul: row.judul || 'Tanpa Judul',
    isi: row.isi || '',
    warna,
    tags,
    is_pinned: Boolean(row.is_pinned),
    created_by_id: row.created_by_id || 'PTV-001',
    created_by_name: row.created_by_name || 'Kru Studio',
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || row.created_at || new Date().toISOString(),
    meeting_meta,
  };
}

export const catatanService = {
  async getNotes(): Promise<NoteItem[]> {
    // 1. Fetch via authenticated serverless endpoint /api/catatan
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch('/api/catatan', {
          credentials: 'same-origin',
        });
        if (res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.notes)) {
            return json.notes.map(mapDbRowToNoteItem);
          }
        }
        if (res.status === 401) {
          throw new Error('Sesi login diperlukan untuk melihat catatan bersama. Silakan masuk ke Hub terlebih dahulu.');
        }
        if (res.status === 403) {
          throw new Error('Akses ditolak: Akun Anda tidak memiliki izin untuk melihat Catatan Bersama.');
        }
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Sesi login') || err.message.includes('Akses ditolak'))) {
        throw err;
      }
    }

    // 2. Direct Supabase fallback (if client session exists)
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('ptv_catatan')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map(mapDbRowToNoteItem);
      }
    }

    return [];
  },

  async createNote(payload: {
    judul: string;
    isi: string;
    warna?: NoteCategoryKey;
    tipe?: NoteType;
    tags?: string[];
    is_pinned?: boolean;
    meeting_meta?: MeetingMeta;
  }): Promise<NoteItem> {
    const res = await fetch('/api/catatan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // JSON parse error
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Sesi login telah berakhir. Silakan login kembali.');
      }
      if (res.status === 403) {
        throw new Error(json?.error || 'Akses ditolak: Akun Anda tidak memiliki izin untuk membuat catatan.');
      }
      throw new Error(json?.error || 'Gagal menyimpan catatan. Silakan coba lagi.');
    }

    if (json?.note) {
      return mapDbRowToNoteItem(json.note);
    }

    throw new Error('Gagal memproses data catatan.');
  },

  async updateNote(id: string, payload: {
    judul?: string;
    isi?: string;
    warna?: NoteCategoryKey;
    tipe?: NoteType;
    tags?: string[];
    is_pinned?: boolean;
    meeting_meta?: MeetingMeta;
  }): Promise<NoteItem> {
    const res = await fetch('/api/catatan', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id, ...payload }),
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // JSON parse error
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Sesi login telah berakhir. Silakan login kembali.');
      }
      if (res.status === 403) {
        throw new Error(json?.error || 'Akses ditolak: Akun Anda tidak memiliki izin untuk mengedit catatan.');
      }
      throw new Error(json?.error || 'Gagal memperbarui catatan. Silakan coba lagi.');
    }

    if (json?.note) {
      return mapDbRowToNoteItem(json.note);
    }

    throw new Error('Gagal memproses data catatan.');
  },

  async deleteNote(id: string): Promise<boolean> {
    const res = await fetch('/api/catatan', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id }),
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // JSON parse error
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Sesi login telah berakhir. Silakan login kembali.');
      }
      if (res.status === 403) {
        throw new Error(json?.error || 'Akses ditolak: Akun Anda tidak memiliki izin untuk menghapus catatan.');
      }
      throw new Error(json?.error || 'Gagal menghapus catatan. Silakan coba lagi.');
    }

    return true;
  },

  async togglePin(id: string, is_pinned: boolean): Promise<NoteItem> {
    return this.updateNote(id, { is_pinned });
  },
};
