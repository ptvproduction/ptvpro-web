import { getSupabaseClient, isSupabaseConfigured } from '@core/supabase/client';
import { InternalContact } from './types';
import { ExternalContact } from '../kontak-eksternal/mock/kontakEksternalMockData';
import { safeRandomUuid } from '@/shared/utils/uuid';
import {
  categorizeExternalContact,
  classifyInternalContact,
  RawKontakEksternalDbRow,
  KNOWN_BROKEN_PHOTO_PTV_IDS,
} from './kontakMapper';

export interface IKontakService {
  getInternalContacts(forceRefresh?: boolean): Promise<InternalContact[]>;
  getExternalContacts(forceRefresh?: boolean): Promise<ExternalContact[]>;
  createExternalContact(data: Omit<ExternalContact, 'id'>): Promise<ExternalContact>;
  updateExternalContact(id: string, updates: Partial<ExternalContact>): Promise<ExternalContact>;
  deleteExternalContact(id: string): Promise<boolean>;
}

export class StagingKontakService implements IKontakService {
  private internalCache: InternalContact[] = [];
  private externalCache: ExternalContact[] = [];
  private lastFetchInternal = 0;
  private lastFetchExternal = 0;

  /**
   * Fetch Kontak Eksternal dari endpoint /api/kontak?type=eksternal
   * dengan graceful direct Supabase client query untuk test runner
   */
  async getExternalContacts(forceRefresh = false): Promise<ExternalContact[]> {
    if (!forceRefresh && this.externalCache.length > 0 && Date.now() - this.lastFetchExternal < 15000) {
      return this.externalCache;
    }

    // 1. Authenticated Serverless Endpoint
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/kontak?type=eksternal', {
          credentials: 'same-origin',
        });

        if (res.ok) {
          const contentType = res.headers?.get?.('content-type');
          if (contentType && contentType.includes('application/json')) {
            const body = await res.json();
            if (body.success && Array.isArray(body.contacts)) {
              this.externalCache = body.contacts;
              this.lastFetchExternal = Date.now();
              return body.contacts;
            }
          }
        }

        if (res.status === 401) {
          throw new Error('Sesi login diperlukan untuk melihat Kontak Eksternal. Silakan masuk ke Hub terlebih dahulu.');
        }
        if (res.status === 403) {
          throw new Error('Akses ditolak: Akun Anda tidak memiliki izin untuk melihat modul Kontak Eksternal.');
        }
      } catch (err: any) {
        if (err.message && (err.message.includes('Sesi login') || err.message.includes('Akses ditolak'))) {
          throw err;
        }
        // Fallback to direct client query in non-browser or test runner environment
      }
    }

    // 2. Direct Supabase Client Query
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('ptv_kontak_eksternal')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Gagal memuat kontak eksternal dari Supabase Staging: ${error.message}`);
      }

      if (data && Array.isArray(data)) {
        const enriched: ExternalContact[] = (data as RawKontakEksternalDbRow[]).map((r) => {
          const cat = categorizeExternalContact(r);
          return {
            id: r.id,
            nama: r.nama_kontak || 'Tanpa Nama',
            kategori: cat.peran,
            jabatan: r.peran || '-',
            organisasi: r.instansi || 'Lembaga',
            lembaga: cat.lembaga,
            nomor_telepon: r.telepon || undefined,
            whatsapp: r.telepon || undefined,
            email: r.email || undefined,
            catatan: r.catatan || undefined,
            status: 'Aktif',
          };
        });

        this.externalCache = enriched;
        this.lastFetchExternal = Date.now();
        return enriched;
      }
    }

    throw new Error('Gagal memuat data kontak eksternal. Silakan coba lagi.');
  }

  /**
   * Fetch Kontak Internal dari endpoint /api/kontak?type=internal
   * dengan graceful direct Supabase client query untuk test runner
   */
  async getInternalContacts(forceRefresh = false): Promise<InternalContact[]> {
    if (!forceRefresh && this.internalCache.length > 0 && Date.now() - this.lastFetchInternal < 15000) {
      return this.internalCache;
    }

    // 1. Authenticated Serverless Endpoint
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/kontak?type=internal', {
          credentials: 'same-origin',
        });

        if (res.ok) {
          const contentType = res.headers?.get?.('content-type');
          if (contentType && contentType.includes('application/json')) {
            const body = await res.json();
            if (body.success && Array.isArray(body.contacts)) {
              this.internalCache = body.contacts;
              this.lastFetchInternal = Date.now();
              return body.contacts;
            }
          }
        }

        if (res.status === 401) {
          throw new Error('Sesi login diperlukan untuk melihat Kontak Internal. Silakan masuk ke Hub terlebih dahulu.');
        }
        if (res.status === 403) {
          throw new Error('Akses ditolak: Akun Anda tidak memiliki izin untuk melihat modul Kontak Internal.');
        }
      } catch (err: any) {
        if (err.message && (err.message.includes('Sesi login') || err.message.includes('Akses ditolak'))) {
          throw err;
        }
      }
    }

    // 2. Direct Supabase Client Query
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { data: crewRows, error: cErr } = await supabase
        .from('legacy_archive_kru')
        .select('*')
        .order('ptv_id', { ascending: true });

      if (cErr) {
        throw new Error(`Gagal memuat kontak internal dari Supabase Staging: ${cErr.message}`);
      }

      const seenPtv = new Set<string>();
      const seenCanonId = new Set<string>();
      const crewContacts: InternalContact[] = [];

      for (const raw of (crewRows || []) as any[]) {
        if (!raw.ptv_id || seenPtv.has(raw.ptv_id)) continue;
        if (raw.metadata_json?.is_duplicate_archive === true) continue;
        if (raw.canonical_identity_id) {
          if (seenCanonId.has(raw.canonical_identity_id)) continue;
          seenCanonId.add(raw.canonical_identity_id);
        }
        seenPtv.add(raw.ptv_id);

        // 1. Exclude synthetic test records (e.g. PTV-UJI-2712)
        if (raw.ptv_id === 'PTV-UJI-2712' || (raw.full_name && /uji|testing/i.test(raw.full_name) && raw.ptv_id !== 'PTV-017')) {
          continue;
        }

        let fullName = raw.full_name || 'Kru PTV';
        let position = raw.jabatan || 'Kru Operasional';
        let angkatan = raw.angkatan || undefined;
        let divisi = raw.divisi || undefined;
        let fotoUrl = raw.photo_url || (raw.metadata_json && raw.metadata_json.avatar_url) || undefined;

        // 2. Reconcile PTV-017 to authentic historical identity (Muhammad Hamdan Yuwafi Sulaim)
        if (raw.ptv_id === 'PTV-017' && (fullName.includes('Testing') || fullName.includes('Uji'))) {
          fullName = 'Muhammad Hamdan Yuwafi Sulaim';
          position = 'Kru';
          angkatan = '12';
          divisi = 'Technical';
          fotoUrl = 'https://progresiftv.id/wp-content/uploads/unnamed-e1763791452420.webp';
        }

        // 3. Exclude known broken 404 photo URLs
        if (KNOWN_BROKEN_PHOTO_PTV_IDS.has(raw.ptv_id)) {
          fotoUrl = undefined;
        }

        const rawStatus = (raw.status || 'aktif').toLowerCase().trim();
        const isAktif =
          rawStatus === 'aktif' ||
          (!['nonaktif', 'non-aktif', 'non aktif', 'pasif', 'alumni', 'inactive'].includes(rawStatus) && rawStatus !== '');

        const adapter = {
          div: divisi || null,
          pos: position || null,
          status: isAktif ? 'Aktif' : 'Nonaktif',
          role: raw.role || (raw.metadata_json && raw.metadata_json.role_legacy) || 'kru',
          name: fullName,
          ptvId: raw.ptv_id,
        };

        const category = classifyInternalContact(adapter);
        if (!category) continue; // 43 uncategorized nonaktif crew excluded

        let title_prefix: string | undefined;
        if (/^KH\./i.test(fullName)) title_prefix = 'KH.';
        else if (/^Dr\./i.test(fullName)) title_prefix = 'Dr.';
        else if (/^Agus/i.test(fullName) || /^Gus/i.test(fullName)) title_prefix = 'Gus';
        else if (/^Ust\./i.test(fullName) || /^Ustadz/i.test(fullName)) title_prefix = 'Ust.';
        else if (/^Habib/i.test(fullName) || /^Alm\. Habib/i.test(fullName)) title_prefix = 'Habib';

        let unit = divisi ? `Divisi ${divisi}` : 'Progresif TV Studio';
        if (category === 'Pembina') {
          unit = 'Dewan Pembina PTV';
        } else if (category === 'Pengarah') {
          unit = 'Pimpinan & Pengarah Lembaga';
        }

        // 4. Resolve authentic phone/WhatsApp number
        let phone: string | undefined =
          (raw.metadata_json && (raw.metadata_json.telepon || raw.metadata_json.wa || raw.metadata_json.phone)) ||
          raw.telepon ||
          raw.telepon_masked ||
          undefined;

        if (raw.ptv_id === 'PTV-017') {
          phone = undefined;
        }

        crewContacts.push({
          id: `int-${raw.ptv_id}`,
          full_name: fullName,
          title_prefix,
          position,
          unit,
          category,
          phone: phone || undefined,
          email: raw.email || raw.email_masked || undefined,
          foto_url: fotoUrl,
          notes: angkatan ? `Kru Angkatan ${angkatan} PTV` : (category === 'Pembina' || category === 'Pengarah' ? 'Figur Kehormatan / Pengarah PTV' : undefined),
          crew_id: raw.archive_id || raw.ptv_id,
          ptv_id: raw.ptv_id,
          status: isAktif ? 'Aktif' : 'Nonaktif',
          angkatan,
          divisi,
        });
      }

      this.internalCache = crewContacts;
      this.lastFetchInternal = Date.now();
      return crewContacts;
    }

    throw new Error('Gagal menghubungi backend Staging untuk modul Kontak Internal.');
  }

  async createExternalContact(data: Omit<ExternalContact, 'id'>): Promise<ExternalContact> {
    if (typeof fetch !== 'undefined') {
      const res = await fetch('/api/kontak?type=eksternal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(data),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        throw new Error(body.error || `Gagal menyimpan kontak eksternal ke Staging (Status: ${res.status}).`);
      }

      await this.getExternalContacts(true);
      return body.contact;
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const newId = safeRandomUuid();
      const insertRow: RawKontakEksternalDbRow = {
        id: newId,
        nama_kontak: data.nama,
        instansi: data.organisasi || data.lembaga || 'Lembaga',
        peran: data.jabatan || 'Staf / Relasi',
        telepon: data.nomor_telepon || data.whatsapp || null,
        email: data.email || null,
        catatan: data.catatan || null,
        created_at: new Date().toISOString(),
      };

      const { data: createdRow, error } = await supabase
        .from('ptv_kontak_eksternal')
        .insert([insertRow])
        .select('*')
        .single();

      if (error || !createdRow) {
        throw new Error(`Gagal menyimpan kontak eksternal ke Staging: ${error?.message || 'Database error'}`);
      }

      await this.getExternalContacts(true);
      const cat = categorizeExternalContact(createdRow);
      return {
        id: createdRow.id,
        nama: createdRow.nama_kontak,
        kategori: cat.peran,
        jabatan: createdRow.peran || '-',
        organisasi: createdRow.instansi || 'Lembaga',
        lembaga: cat.lembaga,
        nomor_telepon: createdRow.telepon || undefined,
        whatsapp: createdRow.telepon || undefined,
        email: createdRow.email || undefined,
        catatan: createdRow.catatan || undefined,
        status: 'Aktif',
      };
    }

    throw new Error('Koneksi ke backend Supabase Staging tidak tersedia.');
  }

  async updateExternalContact(id: string, updates: Partial<ExternalContact>): Promise<ExternalContact> {
    if (typeof fetch !== 'undefined') {
      const res = await fetch(`/api/kontak?type=eksternal&id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(updates),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        throw new Error(body.error || `Gagal memperbarui kontak eksternal di Staging (Status: ${res.status}).`);
      }

      await this.getExternalContacts(true);
      return body.contact;
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const dbUpdates: Partial<RawKontakEksternalDbRow> = {};
      if (updates.nama) dbUpdates.nama_kontak = updates.nama;
      if (updates.organisasi) dbUpdates.instansi = updates.organisasi;
      if (updates.jabatan) dbUpdates.peran = updates.jabatan;
      if (updates.nomor_telepon !== undefined) dbUpdates.telepon = updates.nomor_telepon || null;
      if (updates.email !== undefined) dbUpdates.email = updates.email || null;
      if (updates.catatan !== undefined) dbUpdates.catatan = updates.catatan || null;

      const { data: updatedRow, error } = await supabase
        .from('ptv_kontak_eksternal')
        .update(dbUpdates)
        .eq('id', id)
        .select('*')
        .single();

      if (error || !updatedRow) {
        throw new Error(`Gagal memperbarui kontak eksternal di Staging: ${error?.message || 'Database error'}`);
      }

      await this.getExternalContacts(true);
      const cat = categorizeExternalContact(updatedRow);
      return {
        id: updatedRow.id,
        nama: updatedRow.nama_kontak,
        kategori: cat.peran,
        jabatan: updatedRow.peran || '-',
        organisasi: updatedRow.instansi || 'Lembaga',
        lembaga: cat.lembaga,
        nomor_telepon: updatedRow.telepon || undefined,
        whatsapp: updatedRow.telepon || undefined,
        email: updatedRow.email || undefined,
        catatan: updatedRow.catatan || undefined,
        status: 'Aktif',
      };
    }

    throw new Error('Koneksi ke backend Supabase Staging tidak tersedia.');
  }

  async deleteExternalContact(id: string): Promise<boolean> {
    if (typeof fetch !== 'undefined') {
      const res = await fetch(`/api/kontak?type=eksternal&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        throw new Error(body.error || `Gagal menghapus kontak eksternal di Staging (Status: ${res.status}).`);
      }

      await this.getExternalContacts(true);
      return true;
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('ptv_kontak_eksternal')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Gagal menghapus kontak eksternal dari Staging: ${error.message}`);
      }

      await this.getExternalContacts(true);
      return true;
    }

    throw new Error('Koneksi ke backend Supabase Staging tidak tersedia.');
  }
}

export const kontakService = new StagingKontakService();
