import { ptvCache } from '@core/cache/ptvCache';
import { PtvDocument } from './mock/docsMockData';
import { docsStore } from './docsStore';
import { getSupabaseClient, isSupabaseConfigured } from '@core/supabase/client';
import { calculateNextLetterNumber } from './utils/letterNumbering';

export interface DokumenStats {
  total: number;
  izin: number;
  tugas: number;
  barang: number;
  disetujui: number;
  menunggu: number;
  revisi: number;
  ditolak: number;
}

export interface DokumenResponse {
  success: boolean;
  mode: 'my' | 'archive';
  count: number;
  total_live_documents: number;
  stats: DokumenStats;
  documents: PtvDocument[];
}

export interface CreateDocumentPayload {
  type: string;
  subject: string;
  date?: string;
  start_date?: string;
  end_date?: string;
  pembawa?: string;
  penanggung_jawab?: string;
  recipients?: string[];
  santri_list?: Array<Record<string, unknown> | string>;
  metadata?: Record<string, unknown>;
  request_id?: string;
  status?: string;
  items?: string[];
  unit_ids?: string[];
  event?: string;
  event_id?: string;
  source?: string;
  notes?: string;
}

export interface IDokumenService {
  getDocuments(mode?: 'my' | 'archive', forceRefresh?: boolean, options?: { signal?: AbortSignal; apiOnly?: boolean }): Promise<{ documents: PtvDocument[]; stats: DokumenStats }>;
  getDocumentById(id: string): Promise<PtvDocument | null>;
  getNextVacantNomorSurat(type?: 'SI' | 'ST' | 'SBB', dateStr?: string): Promise<{ nomor_surat: string; sequence: number; is_vacant: boolean }>;
  createDocument(payload: CreateDocumentPayload): Promise<PtvDocument>;
  updateDocStatus(id: string, status: 'disetujui' | 'revisi' | 'ditolak' | 'menunggu' | 'diarsipkan' | 'berlaku' | 'dibatalkan', note?: string, updates?: Partial<PtvDocument>): Promise<PtvDocument>;
  deleteDocument(id: string): Promise<boolean>;
}

export class StagingDokumenService implements IDokumenService {
  private scope = '';

  private invalidate() {
    this.cache = {};
    ptvCache.invalidate('dokumen_my_list');
    ptvCache.invalidate('dokumen_arsip_list');
    ptvCache.invalidate('beranda_aggregated_data');
  }

  private requiresBackend() {
    return import.meta.env.MODE !== 'test' && import.meta.env.VITE_AUTH_BACKEND !== 'mock';
  }

  private cache: Record<string, { docs: PtvDocument[]; stats: DokumenStats; timestamp: number }> = {};

  public async getDocuments(
    mode: 'my' | 'archive' = 'my',
    forceRefresh = false,
    options?: { signal?: AbortSignal; apiOnly?: boolean }
  ): Promise<{ documents: PtvDocument[]; stats: DokumenStats }> {
    const scope = ptvCache.getScopeToken();
    if (this.scope !== scope) { this.cache = {}; this.scope = scope; }
    const cached = this.cache[mode];
    if (!forceRefresh && cached && Date.now() - cached.timestamp < 10000) {
      return { documents: cached.docs, stats: cached.stats };
    }

    // 1. First attempt: Authenticated Serverless API (/api/dokumen)
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch(`/api/dokumen?mode=${mode}`, {
          credentials: 'same-origin',
          signal: options?.signal,
        });

        if (res.ok) {
          const contentType = res.headers?.get?.('content-type');
          if (contentType && contentType.includes('application/json')) {
            const body: DokumenResponse = await res.json();
            if (body.success && Array.isArray(body.documents)) {
              if (options?.signal?.aborted) throw new DOMException('Request dibatalkan', 'AbortError');
              if (scope !== ptvCache.getScopeToken()) throw new Error('Sesi berubah saat memuat dokumen.');
              this.cache[mode] = {
                docs: body.documents,
                stats: body.stats,
                timestamp: Date.now(),
              };
              return { documents: body.documents, stats: body.stats };
            }
          }
        }

        if (res.status === 401) {
          throw new Error('Sesi login diperlukan untuk melihat dokumen atau arsip. Silakan login terlebih dahulu.');
        }
        if (res.status === 403) {
          throw new Error('Akses ditolak: Anda tidak memiliki izin untuk melihat arsip dokumen.');
        }
        if (options?.apiOnly) throw new Error('Respons daftar perizinan tidak valid atau server gagal merespons.');
      } catch (err: any) {
        if (this.requiresBackend() || options?.apiOnly || options?.signal?.aborted) throw err;
        if (err.message && (err.message.includes('Sesi login') || err.message.includes('Akses ditolak'))) {
          throw err;
        }
        // Fallback for direct client access if network / dev routing
      }
    }

    // 2. Direct Supabase Client fallback (for client-side or tests)
    if (this.requiresBackend() || options?.apiOnly) throw new Error('Layanan dokumen belum tersedia.');
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const [resIzin, resTugas, resBarang] = await Promise.all([
          supabase.from('ptv_surat_izin').select('*').order('created_at', { ascending: false }),
          supabase.from('ptv_surat_tugas').select('*').order('created_at', { ascending: false }),
          supabase.from('ptv_surat_barang').select('*').order('created_at', { ascending: false }),
        ]);

        const rawIzin = (resIzin.data || []) as any[];
        const rawTugas = (resTugas.data || []) as any[];
        const rawBarang = (resBarang.data || []) as any[];

        const izinDocs: PtvDocument[] = rawIzin.map((r) => {
          const status = (r.status || '').toLowerCase().trim() === 'disetujui' ? 'Disetujui' : 'Menunggu';
          const recipientName = (r.nama_santri || r.nama_pemohon || '').trim();
          let recipients: string[] = [];
          if (Array.isArray(r.santri_list)) {
            recipients = r.santri_list.map((s: any) => (typeof s === 'object' && s !== null ? s.nama || s.name || JSON.stringify(s) : String(s))).filter(Boolean);
          } else if (typeof r.santri_list === 'string') {
            try {
              const p = JSON.parse(r.santri_list);
              if (Array.isArray(p)) recipients = p.map((s: any) => (typeof s === 'object' && s !== null ? s.nama || s.name || JSON.stringify(s) : String(s))).filter(Boolean);
            } catch {
              recipients = r.santri_list.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
          }
          if (recipients.length === 0 && recipientName) recipients = [recipientName];

          const subject = r.jenis_kegiatan || r.alasan || 'Permohonan Izin Santri';
          return {
            id: `si_${r.id}`,
            no: r.nomor_surat || '—',
            subject,
            type: 'Surat Izin Santri',
            date: r.tanggal_mulai || r.tanggal_surat || (r.created_at ? r.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
            start_date: r.tanggal_mulai || r.tanggal_kegiatan || undefined,
            end_date: r.tanggal_selesai || undefined,
            owner: recipientName || 'Pemohon',
            pembawa: recipientName || undefined,
            penanggung_jawab: r.penanggung_jawab || r.disetujui_oleh || undefined,
            diajukan_oleh: r.diajukan_oleh || undefined,
            recipients,
            santri_list: Array.isArray(r.santri_list) ? r.santri_list : undefined,
            metadata: r.metadata,
            qr_token: r.qr_token,
            items: [],
            status,
            created_at: r.created_at,
            approved_at: status === 'Disetujui' ? r.created_at : undefined,
            status_history: [
              {
                status: 'Menunggu',
                timestamp: r.created_at,
                actor: recipientName || 'Pemohon',
                note: `Pengajuan surat izin santri: ${subject}`,
              },
              ...(status === 'Disetujui'
                ? [
                    {
                      status: 'Disetujui' as const,
                      timestamp: r.created_at,
                      actor: r.disetujui_oleh || 'Pimpinan Eksekutif PTV',
                      note: `Surat izin disetujui dengan nomor resmi: ${r.nomor_surat || 'Telah diterbitkan'}`,
                    },
                  ]
                : []),
            ],
          };
        });

        const tugasDocs: PtvDocument[] = rawTugas.map((r) => {
          const status = (r.status || '').toLowerCase().trim() === 'disetujui' ? 'Disetujui' : 'Menunggu';
          let recipients: string[] = [];
          if (Array.isArray(r.kru_terlibat)) {
            recipients = r.kru_terlibat.map((s: any) => String(s)).filter(Boolean);
          }
          return {
            id: `st_${r.id}`,
            no: r.nomor_surat || '—',
            subject: r.perihal || 'Surat Tugas Operasional Liputan',
            type: 'Surat Tugas',
            date: r.tanggal_tugas || (r.created_at ? r.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
            owner: r.disetujui_oleh || r.diajukan_oleh || 'Pimpinan Studio',
            penanggung_jawab: r.disetujui_oleh || undefined,
            diajukan_oleh: r.diajukan_oleh || undefined,
            recipients,
            items: [],
            status,
            created_at: r.created_at,
            approved_at: status === 'Disetujui' ? r.created_at : undefined,
          };
        });

        const barangDocs: PtvDocument[] = rawBarang.map((r) => {
          const status = (r.status || '').toLowerCase().trim() === 'disetujui' ? 'Disetujui' : 'Menunggu';
          return {
            id: `sbb_${r.id}`,
            no: r.nomor_surat || '—',
            subject: r.tujuan_lokasi ? `Surat Bawa Barang: ${r.tujuan_lokasi}` : 'Surat Izin Membawa Peralatan Studio',
            type: 'Izin Membawa Barang',
            date: r.created_at ? r.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
            owner: r.nama_pembawa || 'Pembawa Barang',
            pembawa: r.nama_pembawa || undefined,
            penanggung_jawab: r.disetujui_oleh || undefined,
            diajukan_oleh: r.diajukan_oleh || undefined,
            recipients: r.nama_pembawa ? [r.nama_pembawa] : [],
            items: Array.isArray(r.daftar_barang) ? r.daftar_barang : [],
            status,
            created_at: r.created_at,
            approved_at: status === 'Disetujui' ? r.created_at : undefined,
          };
        });

        const allDocs = [...izinDocs, ...tugasDocs, ...barangDocs].sort((a, b) =>
          (b.created_at || '').localeCompare(a.created_at || '')
        );

        let resolvedDocs = allDocs;
        if (resolvedDocs.length === 0) {
          resolvedDocs = [...docsStore.getAll()];
        }

        const stats: DokumenStats = {
          total: resolvedDocs.length,
          izin: resolvedDocs.filter((d) => d.type.includes('Izin')).length,
          tugas: resolvedDocs.filter((d) => d.type === 'Surat Tugas').length,
          barang: resolvedDocs.filter((d) => d.type.includes('Barang')).length,
          disetujui: resolvedDocs.filter((d) => d.status === 'Disetujui').length,
          menunggu: resolvedDocs.filter((d) => d.status === 'Menunggu').length,
          revisi: resolvedDocs.filter((d) => d.status === 'Revisi').length,
          ditolak: resolvedDocs.filter((d) => d.status === 'Ditolak').length,
        };

        this.cache[mode] = { docs: resolvedDocs, stats, timestamp: Date.now() };
        return { documents: resolvedDocs, stats };
      } catch (dbErr: any) {
        console.error('[StagingDokumenService Direct Client Error]:', dbErr);
      }
    }

    // 3. Fallback to local shared documents store if offline or direct database unseeded
    const fallbackDocs = docsStore.getAll();
    const stats: DokumenStats = {
      total: fallbackDocs.length,
      izin: fallbackDocs.filter((d) => d.type.includes('Izin')).length,
      tugas: fallbackDocs.filter((d) => d.type === 'Surat Tugas').length,
      barang: fallbackDocs.filter((d) => d.type.includes('Barang')).length,
      disetujui: fallbackDocs.filter((d) => d.status === 'Disetujui').length,
      menunggu: fallbackDocs.filter((d) => d.status === 'Menunggu').length,
      revisi: fallbackDocs.filter((d) => d.status === 'Revisi').length,
      ditolak: fallbackDocs.filter((d) => d.status === 'Ditolak').length,
    };
    return { documents: fallbackDocs, stats };
  }

  public async getDocumentById(id: string): Promise<PtvDocument | null> {
    const { documents } = await this.getDocuments('archive');
    return documents.find((d) => d.id === id) || null;
  }

  public async getNextVacantNomorSurat(
    type: 'SI' | 'ST' | 'SBB' = 'SI',
    dateStr?: string
  ): Promise<{ nomor_surat: string; sequence: number; is_vacant: boolean }> {
    const effectiveDate = dateStr || new Date().toISOString().slice(0, 10);

    // Attempt backend vacant_check endpoint
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch(`/api/dokumen?mode=vacant_check&type=${type}&date=${encodeURIComponent(effectiveDate)}`, {
          credentials: 'same-origin',
        });
        if (res.ok) {
          const body = await res.json();
          if (body.success && body.data?.nomor_surat) {
            return {
              nomor_surat: body.data.nomor_surat,
              sequence: body.data.next_sequence,
              is_vacant: Boolean(body.data.is_vacant),
            };
          }
        }
      } catch {
        // Fallback to client-side document inspection
      }
    }

    if (this.requiresBackend()) throw new Error('Nomor resmi server belum tersedia.');

    // Cache hanya dipakai dalam runtime mock/test.
    const { documents } = await this.getDocuments('archive');
    const storeDocs = docsStore.getAll();
    const combinedDocs = [...documents, ...storeDocs];

    const allocated = calculateNextLetterNumber(combinedDocs, type, effectiveDate);
    return {
      nomor_surat: allocated.nomor_surat,
      sequence: allocated.sequence,
      is_vacant: false,
    };
  }

  public async createDocument(payload: CreateDocumentPayload): Promise<PtvDocument> {
    // 1. Try Authenticated Serverless API (/api/dokumen?action=create)
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/dokumen?action=create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const body = await res.json();
          if (body.success && body.document) {
            this.invalidate();
            docsStore.addLiveDoc(body.document);
            return body.document;
          }
        } else if (res.status === 401) {
          throw new Error('Sesi login diperlukan untuk menerbitkan dokumen. Silakan login kembali.');
        } else {
          const errorBody = await res.json().catch(() => null);
          if (errorBody && errorBody.error) {
            throw new Error(errorBody.error);
          }
        }
      } catch (err: any) {
        if (this.requiresBackend() || payload.type === 'SI' || payload.type.includes('Izin Santri')) throw err;
        if (err.message && (err.message.includes('Sesi login') || err.message.includes('Akses ditolak'))) {
          throw err;
        }
        console.warn('[StagingDokumenService createDocument Fetch Error]:', err.message);
      }
    }

    if (this.requiresBackend() || payload.type === 'SI' || payload.type.includes('Izin Santri')) throw new Error('Backend belum mengonfirmasi penerbitan dokumen.');

    // 2. Client-side fallback via docsStore
    const isSbb = payload.type.includes('Barang') || payload.type === 'SBB';
    const isFromAcara = payload.source === 'acara' && Boolean(payload.event_id);
    const dateStr = payload.start_date || payload.date || new Date().toISOString().slice(0, 10);

    let docStatus: PtvDocument['status'] = 'Menunggu';
    let officialNo = '—';

    // Auto-approval in client fallback if from acara or official tugas
    if (isFromAcara && isSbb) {
      docStatus = 'Disetujui';
      const vacant = await this.getNextVacantNomorSurat('SBB', dateStr);
      officialNo = vacant.nomor_surat;
    } else if (payload.type.includes('Tugas')) {
      docStatus = 'Disetujui';
      const vacant = await this.getNextVacantNomorSurat('ST', dateStr);
      officialNo = vacant.nomor_surat;
    }

    const nowIso = new Date().toISOString();
    const newDoc = docsStore.requestDoc({
      type: isSbb ? 'Izin Membawa Barang' : 'Surat Tugas',
      subject: payload.subject,
      date: dateStr,
      start_date: payload.start_date || dateStr,
      end_date: payload.end_date || dateStr,
      owner: payload.pembawa || payload.penanggung_jawab || 'Pemohon',
      pembawa: payload.pembawa,
      penanggung_jawab: payload.penanggung_jawab,
      recipients: payload.recipients || (payload.pembawa ? [payload.pembawa] : []),
      items: payload.items || [],
      unit_ids: payload.unit_ids || [],
      event: payload.event,
      event_id: payload.event_id,
      status: docStatus,
      no: officialNo,
    });

    if (docStatus === 'Disetujui') {
      newDoc.approved_at = nowIso;
      docsStore.updateDoc(newDoc.id, { approved_at: nowIso, no: officialNo, status: 'Disetujui' });
    }

    this.cache = {};
    return newDoc;
  }

  public async updateDocStatus(
    id: string,
    status: 'disetujui' | 'revisi' | 'ditolak' | 'menunggu',
    note?: string,
    updates?: Partial<PtvDocument>
  ): Promise<PtvDocument> {
    this.cache = {};

    // 1. Try Authenticated Serverless API (/api/dokumen?action=update_status)
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/dokumen?action=update_status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ id, status, note, updates }),
        });

        if (res.ok) {
          const body = await res.json();
          if (body.success && body.document) {
            this.invalidate();
            docsStore.updateDoc(id, body.document);
            return body.document;
          }
        } else if (res.status === 401) {
          throw new Error('Sesi login diperlukan untuk memperbarui dokumen. Silakan login kembali.');
        } else if (res.status === 403) {
          throw new Error('Akses ditolak: Anda tidak memiliki wewenang untuk tindakan persetujuan ini.');
        } else {
          const errBody = await res.json().catch(() => null);
          if (errBody && errBody.error) {
            throw new Error(errBody.error);
          }
        }
      } catch (err: any) {
        if (this.requiresBackend()) throw err;
        if (err.message && (err.message.includes('Sesi login') || err.message.includes('Akses ditolak'))) {
          throw err;
        }
        console.warn('[StagingDokumenService updateDocStatus Fetch Warning]:', err.message);
      }
    }

    if (this.requiresBackend()) throw new Error('Backend belum mengonfirmasi perubahan dokumen.');

    // 2. Client fallback via docsStore
    if (status === 'disetujui') {
      const doc = docsStore.approveDoc(id, note);
      if (doc) return doc;
    } else if (status === 'revisi') {
      const doc = docsStore.requestRevision(id, note || 'Perlu perbaikan');
      if (doc) return doc;
    } else if (status === 'ditolak') {
      const doc = docsStore.rejectDoc(id, note || 'Pengajuan ditolak');
      if (doc) return doc;
    } else if (status === 'menunggu') {
      const doc = docsStore.resubmitDoc(id, updates || {});
      if (doc) return doc;
    }

    const fallbackDoc = docsStore.getById(id);
    if (fallbackDoc) return fallbackDoc;
    throw new Error(`Dokumen dengan ID ${id} tidak ditemukan.`);
  }

    public async archiveDocument(id: string, note?: string): Promise<PtvDocument> {
    this.cache = {};

    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/dokumen?action=archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ id, note }),
        });

        if (res.ok) {
          const body = await res.json();
          if (body.success && body.document) {
            this.invalidate();
            docsStore.updateDoc(id, body.document);
            return body.document;
          }
        } else {
          const errBody = await res.json().catch(() => null);
          if (errBody && errBody.error) {
            throw new Error(errBody.error);
          }
        }
      } catch (err: any) {
        if (this.requiresBackend()) throw err;
        console.warn('[StagingDokumenService archiveDocument Fetch Warning]:', err.message);
      }
    }

    const fallback = docsStore.updateDoc(id, { status: 'Diarsipkan' });
    if (fallback) return fallback;
    throw new Error(`Dokumen dengan ID ${id} tidak ditemukan.`);
  }

  public async deleteDocument(id: string, reason?: string): Promise<boolean> {
    this.cache = {};

    // 1. Try Authenticated Serverless API (/api/dokumen?action=delete)
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch('/api/dokumen?action=delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ id, reason }),
        });

        if (res.ok) {
          const body = await res.json();
          if (body.success !== true) throw new Error('Penghapusan dokumen belum dikonfirmasi.');
          this.invalidate();
          docsStore.deleteDoc(id);
          return true;
        } else if (res.status === 401) {
          throw new Error('Sesi login diperlukan untuk menghapus dokumen.');
        } else if (res.status === 403) {
          throw new Error('Akses ditolak: Dokumen yang telah disetujui resmi tidak dapat dihapus.');
        }
      } catch (err: any) {
        if (this.requiresBackend()) throw err;
        if (err.message && (err.message.includes('Sesi login') || err.message.includes('Akses ditolak'))) {
          throw err;
        }
        console.warn('[StagingDokumenService deleteDocument Fetch Warning]:', err.message);
      }
    }

    if (this.requiresBackend()) throw new Error('Backend belum mengonfirmasi perubahan dokumen.');

    // 2. Client fallback via docsStore
    docsStore.deleteDoc(id);
    return true;
  }
}

export const dokumenService = new StagingDokumenService();
