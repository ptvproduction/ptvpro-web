import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseCookies } from './auth/_utils/cookies';
import { verifySessionToken } from './auth/_utils/crypto';
import { verifyAccountStatusLive, refreshLiveSession } from './auth/_utils/identity';
import type { PtvDocument, DocStatusHistory } from '../src/products/hub/dokumen-saya/mock/docsMockData';
import { filterUserDocuments } from '../src/products/hub/dokumen-saya/utils/documentOwnership';
export { filterUserDocuments } from '../src/products/hub/dokumen-saya/utils/documentOwnership';
import { INITIAL_DOCS_FIXTURES } from '../src/products/hub/dokumen-saya/mock/docsMockData';

import { calculateNextLetterNumber } from '../src/products/hub/dokumen-saya/utils/letterNumbering';

export function calculateNextNomorSurat(
  allDocs: PtvDocument[],
  typeParam: 'SI' | 'ST' | 'SBB',
  dateParam?: string
): { nomor_surat: string; sequence: number; is_vacant: boolean; year: string; roman_month: string } {
  return calculateNextLetterNumber(allDocs, typeParam, dateParam);
}

export function parseJsonRequestBody(req: IncomingMessage): Promise<any> {
  if ((req as any).body !== undefined && typeof (req as any).body === 'object') {
    return Promise.resolve((req as any).body);
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Ukuran payload request melebihi batas 2MB.'));
      }
    });
    req.on('end', () => {
      if (!raw || !raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e: any) {
        reject(new Error(`Format JSON body tidak valid: ${e.message}`));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

export interface RawSuratIzinDbRow {
  id: string;
  nomor_surat: string | null;
  nama_pemohon?: string | null;
  nama_santri?: string | null;
  alasan?: string | null;
  jenis_kegiatan?: string | null;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  disetujui_oleh: string | null;
  status: string | null;
  created_at: string;
  diajukan_oleh: string | null;
  santri_list?: any;
  metadata?: Record<string, unknown>;
  qr_token?: string;
  penanggung_jawab?: string;
}

export interface RawSuratTugasDbRow {
  id: string;
  nomor_surat: string | null;
  perihal: string | null;
  tanggal_tugas: string | null;
  kru_terlibat: any;
  disetujui_oleh: string | null;
  status: string | null;
  created_at: string;
  diajukan_oleh: string | null;
}

export interface RawSuratBarangDbRow {
  id: string;
  nomor_surat: string | null;
  nama_pembawa: string | null;
  tujuan_lokasi: string | null;
  daftar_barang: any;
  disetujui_oleh: string | null;
  status: string | null;
  created_at: string;
  diajukan_oleh: string | null;
}

export function mapDbStatusToDocStatus(statusRaw?: string | null): import('../src/products/hub/dokumen-saya/mock/docsMockData').DocStatus {
  const s = (statusRaw || '').toLowerCase().trim();
  if (['diarsipkan', 'archived'].includes(s)) return 'Diarsipkan';
  if (['disetujui', 'aktif', 'valid', 'approved', 'acc'].includes(s)) return 'Disetujui';
  if (['revisi', 'revision'].includes(s)) return 'Revisi';
  if (['ditolak', 'rejected', 'dibatalkan', 'batal'].includes(s)) return 'Ditolak';
  return 'Menunggu';
}

export function parseJsonOrArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map((item) => (typeof item === 'object' && item !== null ? item.nama || item.name || JSON.stringify(item) : String(item))).filter(Boolean);
  }
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => (typeof item === 'object' && item !== null ? item.nama || item.name || JSON.stringify(item) : String(item))).filter(Boolean);
      }
    } catch {
      // split comma
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [val.trim()].filter(Boolean);
  }
  return [];
}

export function mapSuratIzinToDoc(row: RawSuratIzinDbRow): PtvDocument {
  const status = mapDbStatusToDocStatus(row.status);
  const officialNo = status === 'Disetujui' && row.nomor_surat ? row.nomor_surat : (row.nomor_surat || '—');
  const recipientName = (row.nama_santri || row.nama_pemohon || '').trim();
  const subject = row.jenis_kegiatan || row.alasan || 'Permohonan Izin Santri';
  const santriList = parseJsonOrArray(row.santri_list);
  const recipients = santriList.length > 0 ? santriList : (recipientName ? [recipientName] : []);

  return {
    id: `si_${row.id}`,
    no: officialNo,
    subject,
    type: 'Surat Izin Santri',
    date: row.tanggal_mulai || (row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
    start_date: row.tanggal_mulai || undefined,
    end_date: row.tanggal_selesai || undefined,
    owner: recipientName || 'Pemohon',
    pembawa: recipientName || undefined,
    penanggung_jawab: row.penanggung_jawab || row.disetujui_oleh || undefined,
    diajukan_oleh: row.diajukan_oleh || undefined,
    recipients,
    santri_list: Array.isArray(row.santri_list) ? row.santri_list : undefined,
    metadata: row.metadata,
    qr_token: row.qr_token,
    items: [],
    status,
    created_at: row.created_at,
    approved_at: status === 'Disetujui' ? row.created_at : undefined,
    status_history: [
      {
        status: 'Menunggu',
        timestamp: row.created_at,
        actor: recipientName || 'Pemohon',
        note: `Pengajuan surat izin santri: ${subject}`,
      },
      ...(status === 'Disetujui'
        ? [
            {
              status: 'Disetujui' as const,
              timestamp: row.created_at,
              actor: row.disetujui_oleh || 'Pimpinan Eksekutif PTV',
              note: `Surat izin disetujui dengan nomor resmi: ${row.nomor_surat || 'Telah diterbitkan'}`,
            },
          ]
        : []),
    ],
  };
}

export function mapSuratTugasToDoc(row: RawSuratTugasDbRow): PtvDocument {
  const status = mapDbStatusToDocStatus(row.status);
  const officialNo = status === 'Disetujui' && row.nomor_surat ? row.nomor_surat : (row.nomor_surat || '—');
  const recipients = parseJsonOrArray(row.kru_terlibat);

  return {
    id: `st_${row.id}`,
    no: officialNo,
    subject: row.perihal || 'Surat Tugas Operasional Liputan',
    type: 'Surat Tugas',
    date: row.tanggal_tugas || (row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
    start_date: row.tanggal_tugas || undefined,
    end_date: row.tanggal_tugas || undefined,
    owner: row.disetujui_oleh || row.diajukan_oleh || 'Pimpinan Studio',
    penanggung_jawab: row.disetujui_oleh || undefined,
    diajukan_oleh: row.diajukan_oleh || undefined,
    recipients,
    items: [],
    status,
    created_at: row.created_at,
    approved_at: status === 'Disetujui' ? row.created_at : undefined,
    status_history: [
      {
        status: 'Menunggu',
        timestamp: row.created_at,
        actor: row.diajukan_oleh || 'Pemohon',
        note: `Pengajuan surat tugas: ${row.perihal || 'Penugasan kru'}`,
      },
      ...(status === 'Disetujui'
        ? [
            {
              status: 'Disetujui' as const,
              timestamp: row.created_at,
              actor: row.disetujui_oleh || 'Pimpinan Eksekutif PTV',
              note: `Surat tugas disahkan dengan nomor resmi: ${row.nomor_surat || 'Telah diterbitkan'}`,
            },
          ]
        : []),
    ],
  };
}

export function mapSuratBarangToDoc(row: RawSuratBarangDbRow): PtvDocument {
  const status = mapDbStatusToDocStatus(row.status);
  const officialNo = status === 'Disetujui' && row.nomor_surat ? row.nomor_surat : (row.nomor_surat || '—');
  const items = parseJsonOrArray(row.daftar_barang);
  const pembawa = (row.nama_pembawa || '').trim();

  return {
    id: `sbb_${row.id}`,
    no: officialNo,
    subject: row.tujuan_lokasi ? `Surat Bawa Barang: ${row.tujuan_lokasi}` : 'Surat Izin Membawa Peralatan Studio',
    type: 'Izin Membawa Barang',
    date: row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
    owner: pembawa || 'Pembawa Barang',
    pembawa: pembawa || undefined,
    penanggung_jawab: row.disetujui_oleh || undefined,
    diajukan_oleh: row.diajukan_oleh || undefined,
    recipients: pembawa ? [pembawa] : [],
    items,
    status,
    created_at: row.created_at,
    approved_at: status === 'Disetujui' ? row.created_at : undefined,
    status_history: [
      {
        status: 'Menunggu',
        timestamp: row.created_at,
        actor: pembawa || 'Pembawa Barang',
        note: `Pengajuan izin bawa barang lokasi: ${row.tujuan_lokasi || 'Operasional luar'}`,
      },
      ...(status === 'Disetujui'
        ? [
            {
              status: 'Disetujui' as const,
              timestamp: row.created_at,
              actor: row.disetujui_oleh || 'Pimpinan Eksekutif PTV',
              note: `Surat jalan peralatan disetujui nomor: ${row.nomor_surat || 'Telah diterbitkan'}`,
            },
          ]
        : []),
    ],
  };
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json');

  const method = (req.method || 'GET').toUpperCase();
  const urlObj = new URL(req.url || '', 'http://localhost');
  const mode = urlObj.searchParams.get('mode') || 'my';

  if (!['my', 'archive', 'vacant_check'].includes(mode)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Mode dokumen tidak valid.', code: 'invalid_mode' }));
    return;
  }

  // Buffer body immediately if POST/PUT/PATCH to prevent stream starvation
  let requestBody: any = {};
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      requestBody = await parseJsonRequestBody(req);
    } catch (parseErr: any) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: parseErr.message || 'Payload JSON tidak valid.', code: 'invalid_json_body' }));
      return;
    }
  }

  const action = urlObj.searchParams.get('action') || (requestBody && typeof requestBody === 'object' ? requestBody.action : null);

  // Strict Read-Only boundary: reject write mutations unless explicit supported actions
  if (method !== 'GET') {
    if (method !== 'POST' || (action !== 'create' && action !== 'update_status' && action !== 'delete' && action !== 'archive')) {
      res.statusCode = 405;
      res.end(
        JSON.stringify({
          error: `Metode HTTP ${method} tidak didukung. Modul Dokumen dan Arsip saat ini beroperasi dalam mode Strict Read-Only.`,
          code: 'method_not_allowed',
        })
      );
      return;
    }
  }

  // 1. Session Authentication Gate (Vercel Direct Auth HttpOnly Cookie)
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['ptv_hub_session'];
  const authSecret = process.env.AUTH_SECRET || '';

  if (!sessionToken) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses dokumen dan arsip.',
        code: 'unauthorized',
      })
    );
    return;
  }

  const session = verifySessionToken(sessionToken, authSecret);
  if (!session) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: 'Akses ditolak: Sesi login Anda tidak valid atau telah kedaluwarsa. Silakan masuk kembali.',
        code: 'session_expired',
      })
    );
    return;
  }

  // 2. Capabilities and Role evaluation
  const userCaps = await refreshLiveSession(session);
  if (!userCaps.includes('hub.access')) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Sesi atau izin telah dicabut.' })); return; }
  const isExecOrAdmin =
    userCaps.includes('documents.archive.manage') ||
    userCaps.includes('documents.approve');

  const canApprove =
    userCaps.includes('documents.approve') ||
    userCaps.includes('documents.archive.manage');

  if (method === 'POST' && !userCaps.some(cap => ['documents.request', 'documents.generate', 'documents.approve', 'documents.archive.manage'].includes(cap))) {
    res.statusCode = 403; res.end(JSON.stringify({ error: 'Izin menulis dokumen diperlukan.', code: 'forbidden' })); return;
  }
  if (method === 'GET' && !userCaps.some(cap => ['documents.view', 'documents.generate', 'documents.archive.view', 'documents.archive.manage', 'documents.approve'].includes(cap))) {
    res.statusCode = 403; res.end(JSON.stringify({ error: 'Izin membaca dokumen diperlukan.', code: 'forbidden' })); return;
  }

  // Archive permission check: Unified Surat & Arsip hub
  if (mode === 'archive') {
    const canViewAny =
      isExecOrAdmin ||
      userCaps.includes('documents.archive.view');

    if (!canViewAny) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: 'Akses ditolak: Anda tidak memiliki izin untuk mengakses Surat & Arsip.',
          code: 'forbidden_archive_access',
        })
      );
      return;
    }
  }

  try {
    // 3. Database connection & account status verification
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    let allDocs: PtvDocument[] = [];
    let supabase: any = null;

  if (supabaseUrl && serviceRoleKey) {
    // Verify live account status
    const accountActive = await verifyAccountStatusLive(session.account_id, session.iat, session);
    if (!accountActive) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: 'Akses ditolak: Akun Anda telah dinonaktifkan dari sistem.',
          code: 'account_inactive',
        })
      );
      return;
    }

    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    try {
      const [resIzin, resTugas, resBarang, resReg, resLogs] = await Promise.all([
        supabase.from('ptv_surat_izin').select('*').order('created_at', { ascending: false }),
        supabase.from('ptv_surat_tugas').select('*').order('created_at', { ascending: false }),
        supabase.from('ptv_surat_barang').select('*').order('created_at', { ascending: false }),
        supabase.from('ptv_issued_letter_registry').select('nomor_surat'),
        supabase
          .from('ptv_surat_verifikasi_logs')
          .select('id, nomor_surat, nama_pemeriksa, instansi, metadata, accessed_at')
          .order('accessed_at', { ascending: false })
          .catch(() => ({ data: [] })),
      ]);

      if (resIzin.error || resTugas.error || resBarang.error) throw new Error('Gagal membaca arsip dokumen.');

      const izinDocs: PtvDocument[] = (resIzin.data || []).map((r: any) => mapSuratIzinToDoc(r as RawSuratIzinDbRow));
      const tugasDocs: PtvDocument[] = (resTugas.data || []).map((r: any) => mapSuratTugasToDoc(r as RawSuratTugasDbRow));
      const barangDocs: PtvDocument[] = (resBarang.data || []).map((r: any) => mapSuratBarangToDoc(r as RawSuratBarangDbRow));
      const regDocs: PtvDocument[] = (resReg.data || []).map((r: any) => ({
        id: `reg_${r.nomor_surat}`,
        no: r.nomor_surat,
        subject: '',
        type: 'Surat Tugas',
        date: '',
        owner: '',
        recipients: [],
        items: [],
        status: 'Disetujui',
      }));

      // Index log pemeriksaan resmi dari tabel audit ptv_surat_verifikasi_logs
      const logsByNomor = new Map<string, any[]>();
      if (Array.isArray((resLogs as any)?.data)) {
        for (const log of (resLogs as any).data) {
          if (!log.nomor_surat) continue;
          const list = logsByNomor.get(log.nomor_surat) || [];
          const meta = log.metadata || {};
          list.push({
            id: log.id,
            nomor_surat: log.nomor_surat,
            nama_pemeriksa: log.nama_pemeriksa,
            instansi: log.instansi,
            waktu: log.accessed_at || meta.recorded_at,
            hasil: meta.hasil || 'Berhasil',
            status_dokumen: meta.status_dokumen,
            catatan: meta.catatan || 'Pemeriksaan Tercatat',
            accessed_at: log.accessed_at,
            metadata: meta,
          });
          logsByNomor.set(log.nomor_surat, list);
        }
      }

      allDocs = [...izinDocs, ...tugasDocs, ...barangDocs, ...regDocs].sort((a, b) =>
        (b.created_at || '').localeCompare(a.created_at || '')
      );

      // Sinkronkan metadata.verifikasi_logs dengan riwayat dari database audit cloud
      for (const d of allDocs) {
        if (!d.no || d.no === '—') continue;
        const dbLogs = logsByNomor.get(d.no) || [];
        const currentMeta = (d.metadata || {}) as any;
        const currentMetaLogs = Array.isArray(currentMeta.verifikasi_logs) ? currentMeta.verifikasi_logs : [];

        if (dbLogs.length > 0 || currentMetaLogs.length > 0) {
          const existingIds = new Set(currentMetaLogs.map((x: any) => x.id));
          const merged = [...currentMetaLogs];
          for (const dbl of dbLogs) {
            if (!existingIds.has(dbl.id)) {
              existingIds.add(dbl.id);
              merged.push(dbl);
            }
          }
          merged.sort(
            (a, b) =>
              new Date(b.accessed_at || b.waktu || (b.metadata && b.metadata.recorded_at) || 0).getTime() -
              new Date(a.accessed_at || a.waktu || (a.metadata && a.metadata.recorded_at) || 0).getTime()
          );
          d.metadata = { ...currentMeta, verifikasi_logs: merged };
        }
      }

    } catch {
      throw new Error('Data dokumen backend tidak dapat dimuat.');
    }
  } else {
    if (process.env.NODE_ENV !== 'test') throw new Error('Backend dokumen belum terkonfigurasi.');
    allDocs = [...INITIAL_DOCS_FIXTURES];
  }

    // =========================================================================
    // POST METHOD: CREATION, STATUS UPDATE, AND DELETION PIPELINE
    // =========================================================================
    if (method === 'POST') {
      const body = requestBody;

      // ───────────────────────────────────────────────────────────────────────
      // ACTION: UPDATE STATUS DOKUMEN (APPROVE / REVISION / REJECT / RESUBMIT)
      // ───────────────────────────────────────────────────────────────────────
      // ───────────────────────────────────────────────────────────────────────
      // ACTION: CREATE DOKUMEN (SURAT IZIN / SURAT TUGAS / SURAT BARANG)
      // ───────────────────────────────────────────────────────────────────────
      if (action === 'create') {
        const canGenerateOrRequest =
          userCaps.includes('documents.generate') ||
          userCaps.includes('documents.request') ||
          userCaps.includes('documents.approve') ||
          userCaps.includes('documents.archive.manage') ||
          userCaps.includes('role:eksekutif') ||
          userCaps.includes('role:administrasi');

        if (!canGenerateOrRequest) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Akses ditolak: Izin penerbitan atau pengajuan dokumen diperlukan.', code: 'forbidden' }));
          return;
        }

        const typeRaw = (body.type || body.jenis_surat || body.tipo || 'izin').toString();
        const isBarang = typeRaw.toLowerCase().includes('barang') || typeRaw === 'SBB' || typeRaw === 'SB';
        const isTugas = typeRaw.toLowerCase().includes('tugas') || typeRaw === 'ST';
        const isIzin = (typeRaw.toLowerCase().includes('izin') && !isBarang) || typeRaw === 'SI';

        const nowIso = new Date().toISOString();
        const dateStr = body.start_date || body.tanggal_mulai || body.date || nowIso.slice(0, 10);
        const endDateStr = body.end_date || body.tanggal_selesai || dateStr;

        const shouldApprove = canApprove || body.status === 'Disetujui' || isExecOrAdmin;
        const initialStatus = shouldApprove ? 'Disetujui' : 'Menunggu';
        const identityId = /^[0-9a-f-]{36}$/i.test(session.identity_id || '') ? session.identity_id : null;

        if (isIzin) {
          const mayIssue = canApprove || userCaps.includes('documents.generate');
          const approved = mayIssue && (body.status === 'Disetujui' || canApprove);
          const santriList = Array.isArray(body.santri_list) ? body.santri_list : (body.recipients || []).map((nama: string) => ({ nama }));
          const documentInput = {
            id: body.request_id || randomUUID(),
            nama_pemohon: session.full_name || 'Pemohon',
            alasan: (body.subject || body.alasan || body.kegiatan || 'Surat Izin Santri').trim(),
            tanggal_mulai: dateStr,
            tanggal_selesai: endDateStr,
            diajukan_oleh: identityId,
            disetujui_oleh: approved ? identityId : null,
            penanggung_jawab: approved ? (body.penanggung_jawab || session.full_name || 'Pimpinan Eksekutif PTV') : null,
            santri_list: santriList,
            metadata: { ...(body.metadata || {}), notes: body.notes || '', santriCount: santriList.length },
          };
          if (!supabase) throw new Error('Backend penerbitan surat wajib tersedia.');
          if (approved) {
            const { data: saved, error } = await supabase.rpc('issue_ptv_surat_izin_atomic', { p_document: documentInput });
            if (error || !saved?.nomor_surat || saved.id !== documentInput.id) {
              res.statusCode = 503;
              res.end(JSON.stringify({ error: 'Penerbitan atomik belum dikonfirmasi server. Pastikan migrasi penomoran sudah diterapkan; ulangi permintaan yang sama.', code: 'atomic_issuance_unavailable' }));
              return;
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, document: mapSuratIzinToDoc(saved) }));
            return;
          }
          const { data: draft, error } = await supabase.from('ptv_surat_izin').insert({
            ...documentInput, nomor_surat: '—', status: 'menunggu', jenis_surat: 'Surat Izin Santri',
          }).select('*').single();
          if (error || !draft) throw new Error('Pengajuan surat belum tersimpan.');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, document: mapSuratIzinToDoc(draft) }));
          return;
        }

        // 2. SURAT TUGAS
        if (isTugas) {
          const typeTag = 'ST';
          let officialNo = (body.no || body.nomor_surat || '').trim();
          if (!officialNo || officialNo === '—' || officialNo === '-') {
            if (shouldApprove) {
              const allocated = calculateNextLetterNumber(allDocs, typeTag, dateStr);
              officialNo = allocated.nomor_surat;
            } else {
              officialNo = '—';
            }
          }

          const rawId = body.id || randomUUID();
          const cleanUuid = /^[0-9a-f-]{36}$/i.test(rawId.replace(/^st_/, '')) ? rawId.replace(/^st_/, '') : randomUUID();
          const perihal = (body.subject || body.perihal || 'Penugasan Liputan').trim();
          const diajukanOleh = session.full_name || session.username || 'Pemohon';
          const disetujuiOleh = shouldApprove ? (body.penanggung_jawab || session.full_name || 'Pimpinan Eksekutif PTV') : null;
          const kruTerlibat = Array.isArray(body.recipients) ? body.recipients : [];

          if (supabase) {
            try {
              const { error: insErr } = await supabase.from('ptv_surat_tugas').insert({
                id: cleanUuid,
                nomor_surat: officialNo,
                perihal,
                tanggal_tugas: dateStr,
                kru_terlibat: kruTerlibat,
                disetujui_oleh: shouldApprove ? identityId : null,
                status: initialStatus,
                diajukan_oleh: identityId,
                created_at: nowIso,
              });
              if (insErr) throw insErr;
            } catch (dbErr: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: dbErr.message || 'Gagal menyimpan surat tugas ke cloud.', code: 'database_insert_error' }));
              return;
            }
          }

          const createdDoc: PtvDocument = {
            id: `st_${cleanUuid}`,
            no: officialNo,
            subject: perihal,
            type: 'Surat Tugas',
            date: dateStr,
            start_date: dateStr,
            end_date: endDateStr,
            owner: diajukanOleh,
            penanggung_jawab: disetujuiOleh || undefined,
            recipients: kruTerlibat,
            items: [],
            status: initialStatus,
            created_at: nowIso,
            approved_at: shouldApprove ? nowIso : undefined,
          };

          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, document: createdDoc }));
          return;
        }

        // 3. SURAT BARANG
        if (isBarang) {
          const typeTag = 'SBB';
          let officialNo = (body.no || body.nomor_surat || '').trim();
          if (!officialNo || officialNo === '—' || officialNo === '-') {
            if (shouldApprove) {
              const allocated = calculateNextLetterNumber(allDocs, typeTag, dateStr);
              officialNo = allocated.nomor_surat;
            } else {
              officialNo = '—';
            }
          }

          const rawId = body.id || randomUUID();
          const cleanUuid = /^[0-9a-f-]{36}$/i.test(rawId.replace(/^sbb_/, '')) ? rawId.replace(/^sbb_/, '') : randomUUID();
          const pembawa = (body.pembawa || body.owner || session.full_name || 'Pembawa').trim();
          const tujuanLokasi = (body.subject || body.tujuan || 'Lokasi Kegiatan').trim();
          const daftarBarang = Array.isArray(body.items) ? body.items : [];
          const disetujuiOleh = shouldApprove ? (body.penanggung_jawab || session.full_name || 'Pimpinan Eksekutif PTV') : null;

          if (supabase) {
            try {
              const { error: insErr } = await supabase.from('ptv_surat_barang').insert({
                id: cleanUuid,
                nomor_surat: officialNo,
                nama_pembawa: pembawa,
                tujuan_lokasi: tujuanLokasi,
                daftar_barang: daftarBarang,
                disetujui_oleh: shouldApprove ? identityId : null,
                status: initialStatus,
                diajukan_oleh: identityId,
                created_at: nowIso,
              });
              if (insErr) throw insErr;
            } catch (dbErr: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: dbErr.message || 'Gagal menyimpan surat barang ke cloud.', code: 'database_insert_error' }));
              return;
            }
          }

          const createdDoc: PtvDocument = {
            id: `sbb_${cleanUuid}`,
            no: officialNo,
            subject: tujuanLokasi,
            type: 'Izin Membawa Barang',
            date: dateStr,
            start_date: dateStr,
            end_date: endDateStr,
            owner: pembawa,
            penanggung_jawab: disetujuiOleh || undefined,
            recipients: [pembawa],
            items: daftarBarang,
            status: initialStatus,
            created_at: nowIso,
            approved_at: shouldApprove ? nowIso : undefined,
          };

          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, document: createdDoc }));
          return;
        }

        res.statusCode = 400;
        res.end(JSON.stringify({ error: `Tipe dokumen "${typeRaw}" tidak didukung.`, code: 'unsupported_type' }));
        return;
      }

      if (action === 'update_status') {
        if (!canApprove) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Perubahan dokumen ditahan sampai otorisasi kepemilikan terverifikasi.', code: 'forbidden' })); return; }
        const { id, status: newStatusRaw, note, updates } = body;
        if (!id || typeof id !== 'string') {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'ID dokumen wajib diisi.', code: 'missing_id' }));
          return;
        }

        const newStatus = (newStatusRaw || '').toLowerCase().trim();
        const validStatuses = ['disetujui', 'revisi', 'ditolak', 'menunggu', 'diarsipkan', 'berlaku', 'dibatalkan'];
        if (!validStatuses.includes(newStatus)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: `Status "${newStatusRaw}" tidak valid. Pilihan: ${validStatuses.join(', ')}.`, code: 'invalid_status' }));
          return;
        }

        // Authorization check: Approval, revision, and rejection require canApprove
        if (['disetujui', 'revisi', 'ditolak'].includes(newStatus) && !canApprove) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Akses ditolak: Anda tidak memiliki wewenang untuk mengubah status atau mengesahkan dokumen.', code: 'forbidden' }));
          return;
        }

        // Find existing doc in allDocs
        const existingDoc = allDocs.find((d) => d.id === id);
        if (!existingDoc) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Dokumen tidak ditemukan.' })); return; }
        const docTypeTag: 'SI' | 'ST' | 'SBB' = id.startsWith('st_') ? 'ST' : id.startsWith('sbb_') ? 'SBB' : 'SI';
        const cleanUuid = id.replace(/^(st_|sbb_|si_)/, '');

        const targetTable = id.startsWith('st_')
          ? 'ptv_surat_tugas'
          : id.startsWith('sbb_')
          ? 'ptv_surat_barang'
          : 'ptv_surat_izin';

        const nowIso = new Date().toISOString();
        let officialNo = existingDoc?.no || '—';
        let approverName: string | undefined = undefined;

        if (newStatus === 'disetujui' && docTypeTag === 'SI' && supabase) {
          const { data: saved, error } = await supabase.rpc('approve_ptv_surat_izin_atomic', {
            p_doc_id: cleanUuid, p_identity_id: session.identity_id || null,
            p_issuer: session.full_name || 'Pimpinan Eksekutif PTV', p_note: note || null,
          });
          if (error || !saved?.nomor_surat) throw new Error('Persetujuan atomik belum tersedia. Terapkan migrasi penomoran terlebih dahulu.');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, document: mapSuratIzinToDoc(saved) }));
          return;
        }

        if (newStatus === 'disetujui') {
          approverName = session.full_name || session.username || 'Pimpinan Eksekutif PTV';
          // 1. Try atomic PostgreSQL RPC approval (Single-Transaction Lock & Allocate)
          if (supabase && cleanUuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            try {
              const { data: atomicRes, error: rpcErr } = await supabase.rpc('approve_ptv_document_atomic', {
                p_doc_type: docTypeTag,
                p_doc_id: cleanUuid,
                p_approver_identity_id: session.identity_id || null,
                p_note: note || null,
              });
              if (rpcErr || !atomicRes?.success || !atomicRes.nomor_surat) throw new Error('Persetujuan atomik belum tersedia. Tidak ada nomor surat yang dialokasikan.');
              officialNo = atomicRes.nomor_surat;
            } catch {
              throw new Error('Persetujuan atomik belum tersedia. Tidak ada nomor surat yang dialokasikan.');
            }
          }

          // 2. Fallback allocation if RPC not yet deployed or in offline mode
          if (!officialNo || officialNo === '—' || officialNo.startsWith('DRAFT')) {
            const effectiveDate = existingDoc?.date || existingDoc?.start_date || nowIso.slice(0, 10);
            const vacant = calculateNextNomorSurat(allDocs, docTypeTag, effectiveDate);
            officialNo = vacant.nomor_surat;
          }
        }

        // Update database in Supabase Staging
        if (supabase) {
          try {
            const dbPayload: any = {
              status: newStatus,
            };
            if (newStatus === 'disetujui') {
              if (officialNo && officialNo !== '—') dbPayload.nomor_surat = officialNo;
              const identityId = /^[0-9a-f-]{36}$/i.test(session.identity_id || '') ? session.identity_id : null;
              if (identityId) dbPayload.disetujui_oleh = identityId;
            }
            if (updates && typeof updates === 'object') {
              if (targetTable === 'ptv_surat_tugas') {
                if (updates.subject) dbPayload.perihal = updates.subject;
                if (updates.recipients) dbPayload.kru_terlibat = updates.recipients;
              } else if (targetTable === 'ptv_surat_barang') {
                if (updates.items) dbPayload.daftar_barang = updates.items;
                if (updates.pembawa) dbPayload.nama_pembawa = updates.pembawa;
              }
            }

            const { error: updErr } = await supabase.from(targetTable).update(dbPayload).eq('id', cleanUuid);
            if (updErr) {
              throw new Error('Pembaruan dokumen gagal disimpan.');
            }
          } catch {
            throw new Error('Pembaruan dokumen gagal disimpan.');
          }
        }

        const mappedStatus = mapDbStatusToDocStatus(newStatus);
        const historyActionLabel =
          mappedStatus === 'Disetujui'
            ? `Disetujui resmi oleh ${approverName} dengan nomor ${officialNo}.`
            : mappedStatus === 'Revisi'
            ? `Permintaan perbaikan/revisi: ${note || 'Perbaiki detail pengajuan'}`
            : mappedStatus === 'Ditolak'
            ? `Pengajuan ditolak: ${note || 'Tidak memenuhi kualifikasi'}`
            : `Pengajuan diperbarui dan diajukan ulang oleh ${session.full_name || 'Pemohon'}.`;

        const newHistoryEntry: DocStatusHistory = {
          status: mappedStatus,
          timestamp: nowIso,
          actor: session.full_name || session.username || 'Pimpinan Eksekutif PTV',
          note: note ? `${historyActionLabel} — Catatan: ${note}` : historyActionLabel,
        };

        const updatedDoc: PtvDocument = {
          ...(existingDoc || {
            id,
            no: officialNo,
            subject: updates?.subject || 'Dokumen Persuratan',
            type: docTypeTag === 'ST' ? 'Surat Tugas' : docTypeTag === 'SBB' ? 'Izin Membawa Barang' : 'Surat Izin Santri',
            date: nowIso.slice(0, 10),
            owner: session.full_name || 'Pemohon',
            recipients: [],
            items: [],
            status: mappedStatus,
            created_at: nowIso,
          }),
          ...(updates || {}),
          status: mappedStatus,
          no: officialNo,
          approved_at: mappedStatus === 'Disetujui' ? nowIso : existingDoc?.approved_at,
          penanggung_jawab: mappedStatus === 'Disetujui' ? (approverName || existingDoc?.penanggung_jawab) : existingDoc?.penanggung_jawab,
          review_note: note || existingDoc?.review_note,
          status_history: [
            ...(existingDoc?.status_history || []),
            newHistoryEntry,
          ],
        };

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            message: `Status dokumen ${id} berhasil diperbarui menjadi ${mappedStatus}.`,
            document: updatedDoc,
          })
        );
        return;
      }

      // ───────────────────────────────────────────────────────────────────────
      // ACTION: DELETE DOKUMEN
      // ───────────────────────────────────────────────────────────────────────
            // ───────────────────────────────────────────────────────────────────────
      // ACTION: ARCHIVE DOKUMEN (SURAT & ARSIP LIFECYCLE)
      // ───────────────────────────────────────────────────────────────────────
      if (action === 'archive') {
        if (!canApprove && !userCaps.includes('documents.archive.manage')) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Akses ditolak: Izin mengarsipkan dokumen diperlukan.', code: 'forbidden' }));
          return;
        }
        const docId = (body.id || urlObj.searchParams.get('id') || '').trim();
        if (!docId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'ID dokumen wajib diisi untuk mengarsipkan.', code: 'missing_id' }));
          return;
        }
        const existingDoc = allDocs.find((d) => d.id === docId);
        if (!existingDoc) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Dokumen tidak ditemukan.', code: 'not_found' }));
          return;
        }
        const cleanUuid = docId.replace(/^(st_|sbb_|si_)/, '');
        const targetTable = docId.startsWith('st_')
          ? 'ptv_surat_tugas'
          : docId.startsWith('sbb_')
          ? 'ptv_surat_barang'
          : 'ptv_surat_izin';

        const nowIso = new Date().toISOString();
        const updatedHistory = [
          ...(existingDoc.status_history || []),
          {
            status: 'Diarsipkan' as const,
            timestamp: nowIso,
            actor: session.full_name || session.username || 'Pimpinan Eksekutif PTV',
            note: body.note || 'Surat telah diarsipkan dan ditandai tidak berlaku.',
          },
        ];

        if (supabase) {
          try {
            await supabase.from(targetTable).update({
              status: 'diarsipkan',
              updated_at: nowIso,
              metadata: {
                ...(existingDoc.metadata || {}),
                status_history: updatedHistory,
                archived_at: nowIso,
                archived_by: session.full_name || session.username,
              },
            }).eq('id', cleanUuid);
          } catch (err: any) {
            console.warn('[API Dokumen] Archive update warning:', err.message);
          }
        }

        const updatedDoc = {
          ...existingDoc,
          status: 'Diarsipkan' as const,
          status_history: updatedHistory,
          updated_at: nowIso,
        };

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            message: `Surat ${existingDoc.no || docId} berhasil diarsipkan.`,
            document: updatedDoc,
          })
        );
        return;
      }

      if (action === 'delete') {
        if (!userCaps.includes('documents.archive.manage')) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Izin mengelola arsip diperlukan.', code: 'forbidden' })); return; }
        const docId = (body.id || urlObj.searchParams.get('id') || '').trim();
        if (!docId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'ID dokumen wajib diisi untuk menghapus.', code: 'missing_id' }));
          return;
        }

        const existingDoc = allDocs.find((d) => d.id === docId);
        if (!existingDoc) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Dokumen tidak ditemukan.' })); return; }
        // Deletion rule: must be approver or owner of non-approved document
        if (existingDoc && existingDoc.status === 'Disetujui' && !canApprove) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Akses ditolak: Dokumen yang telah disetujui resmi hanya dapat dihapus oleh Pimpinan/Eksekutif.', code: 'forbidden' }));
          return;
        }

        const cleanUuid = docId.replace(/^(st_|sbb_|si_)/, '');
        const targetTable = docId.startsWith('st_')
          ? 'ptv_surat_tugas'
          : docId.startsWith('sbb_')
          ? 'ptv_surat_barang'
          : 'ptv_surat_izin';

        const docTypeTag: 'SI' | 'ST' | 'SBB' = docId.startsWith('st_') ? 'ST' : docId.startsWith('sbb_') ? 'SBB' : 'SI';
        if (supabase) {
          try {
            // 1. Coba RPC atomik penghapusan & pelepasan nomor jika tersedia di database
            const { data: rpcRes } = await supabase.rpc('rpc_delete_letter_and_release', {
              p_doc_id: cleanUuid,
              p_doc_type: docTypeTag,
              p_actor_id: session.identity_id || null,
              p_actor_name: session.full_name || session.username || 'Pengelola Surat PTV',
              p_reason: body.reason || 'Dihapus dari Surat & Arsip',
            });

            if (!rpcRes?.success) {
              // 2. Fallback operasi penghapusan langsung jika RPC belum dieksekusi di database
              // A. Catat audit internal penghapusan
              try {
                await supabase.from('ptv_letter_deletion_audit').insert({
                  doc_id: cleanUuid,
                  doc_type: docTypeTag,
                  nomor_surat: existingDoc.no || 'DRAFT',
                  deleted_by: session.full_name || session.username || 'Pengelola Surat PTV',
                  actor_id: session.identity_id || null,
                  reason: body.reason || 'Dihapus dari Surat & Arsip',
                });
              } catch {}

              // B. Lepaskan nomor dari registry penomoran agar dapat digunakan kembali
              if (existingDoc.no && !existingDoc.no.startsWith('DRAFT') && existingDoc.no !== '—') {
                try {
                  await supabase.from('ptv_issued_letter_registry').delete()
                    .eq('doc_type', docTypeTag)
                    .or(`doc_id.eq.${cleanUuid},nomor_surat.eq.${existingDoc.no}`);
                } catch {}
              }

              // C. Hapus dokumen fisik dari tabel operasional
              const { error: delErr } = await supabase.from(targetTable).delete().eq('id', cleanUuid);
              if (delErr) {
                console.warn('[API Dokumen] Delete table error:', delErr.message);
              }
            }
          } catch (err: any) {
            console.warn('[API Dokumen] Deletion process error:', err.message);
          }
        }

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            message: `Dokumen ${docId} berhasil dihapus.`,
            id: docId,
          })
        );
        return;
      }

      // ───────────────────────────────────────────────────────────────────────
      // ACTION: CREATE DOKUMEN (EXISTING)
      // ───────────────────────────────────────────────────────────────────────
      const {
        type,
        subject,
        date,
        start_date,
        end_date,
        pembawa,
        penanggung_jawab,
        recipients,
        items,
        unit_ids,
        event,
        event_id,
        source,
        notes,
      } = body;

      if (!subject || typeof subject !== 'string' || !subject.trim()) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: 'Perihal / subjek dokumen wajib diisi.',
            code: 'missing_subject',
          })
        );
        return;
      }

      const docType = type === 'SBB' ? 'Izin Membawa Barang' : type === 'ST' || !type ? 'Surat Tugas' : type;
      if (!['Izin Membawa Barang', 'Surat Tugas'].includes(docType)) {
        res.statusCode = 400; res.end(JSON.stringify({ error: 'Jenis dokumen tidak didukung.' })); return;
      }
      const effectiveDate = start_date || date || new Date().toISOString().slice(0, 10);
      const nowIso = new Date().toISOString();
      const isFromAcara = source === 'acara' && Boolean(event_id);

      let docStatus: 'Menunggu' | 'Disetujui' = 'Menunggu';
      let officialNo = '—';
      let approverName: string | undefined = undefined;
      let approvedAt: string | undefined = undefined;

      // Type-specific approval & numbering determination
      if (docType.includes('Barang') || docType === 'SBB') {
        // Auto-approval rule for Surat Izin Pengeluaran Barang from Detail Acara:
        // Must be sourced from Detail Acara (source === 'acara' && event_id) AND issuer must possess canApprove authority.
        // Plain crew members creating from Detail Acara do NOT get auto-approval.
        if (isFromAcara && canApprove && !supabase) {
          docStatus = 'Disetujui';
          const vacant = calculateNextNomorSurat(allDocs, 'SBB', effectiveDate);
          officialNo = vacant.nomor_surat;
          approverName = session.full_name || session.username || 'Pimpinan Eksekutif PTV';
          approvedAt = nowIso;
        } else {
          docStatus = 'Menunggu';
          officialNo = '—';
        }
      } else if (docType.includes('Tugas') || docType === 'ST') {
        // Official Surat Tugas issued by executive/admin is directly approved with official number
        if (canApprove && !supabase) {
          docStatus = 'Disetujui';
          const vacant = calculateNextNomorSurat(allDocs, 'ST', effectiveDate);
          officialNo = vacant.nomor_surat;
          approverName = session.full_name || session.username || 'Pimpinan Eksekutif PTV';
          approvedAt = nowIso;
        } else {
          docStatus = 'Menunggu';
          officialNo = '—';
        }
      }

      // Generate persistent row ID
      const rawUuid = randomUUID();
      const prefix = docType.includes('Barang') ? 'sbb_' : 'st_';
      const finalDocId = `${prefix}${rawUuid}`;

      // Assemble audit status history
      const statusHistory: DocStatusHistory[] = [
        {
          status: 'Menunggu',
          timestamp: nowIso,
          actor: session.full_name || session.username || 'Pemohon',
          note: isFromAcara
            ? `Pengajuan ${docType} dari Detail Acara: ${event || subject}`
            : `Pengajuan ${docType}: ${subject}`,
        },
      ];

      if (docStatus === 'Disetujui') {
        statusHistory.push({
          status: 'Disetujui' as const,
          timestamp: nowIso,
          actor: approverName || 'Pimpinan Eksekutif PTV',
          note: isFromAcara
            ? `Disetujui otomatis dari Detail Acara oleh ${approverName} (otoritas resmi). Nomor resmi diterbitkan: ${officialNo}`
            : `Surat disahkan resmi dengan nomor: ${officialNo}`,
        });
      }

      // Insert into PostgreSQL database in Supabase Staging
      if (supabase) {
        try {
          if (docType.includes('Barang') || docType === 'SBB') {
            const dbNomor = docStatus === 'Disetujui' ? officialNo : `DRAFT-SBB-${Date.now().toString().slice(-6)}`;
            const payloadDb: any = {
              id: rawUuid,
              nomor_surat: dbNomor,
              nama_pembawa: pembawa || session.full_name || 'Pembawa Barang',
              tujuan_lokasi: event || subject,
              daftar_barang: items || [],
              status: docStatus === 'Disetujui' ? 'disetujui' : 'diajukan',
              created_at: nowIso,
            };
            const identityId = /^[0-9a-f-]{36}$/i.test(session.identity_id || '') ? session.identity_id : null;
            if (identityId) payloadDb.diajukan_oleh = identityId;
            if (docStatus === 'Disetujui' && identityId) payloadDb.disetujui_oleh = identityId;

            const { error: insErr } = await supabase.from('ptv_surat_barang').insert(payloadDb);
            if (insErr) {
              throw new Error('Penerbitan dokumen gagal disimpan.');
            }
          } else {
            const dbNomor = docStatus === 'Disetujui' ? officialNo : `DRAFT-ST-${Date.now().toString().slice(-6)}`;
            const payloadDb: any = {
              id: rawUuid,
              nomor_surat: dbNomor,
              perihal: subject,
              tanggal_tugas: effectiveDate,
              kru_terlibat: recipients || [],
              status: docStatus === 'Disetujui' ? 'disetujui' : 'diajukan',
              created_at: nowIso,
            };
            const identityId = /^[0-9a-f-]{36}$/i.test(session.identity_id || '') ? session.identity_id : null;
            if (identityId) payloadDb.diajukan_oleh = identityId;
            if (docStatus === 'Disetujui' && identityId) payloadDb.disetujui_oleh = identityId;

            const { error: insErr } = await supabase.from('ptv_surat_tugas').insert(payloadDb);
            if (insErr) {
              throw new Error('Penerbitan dokumen gagal disimpan.');
            }
          }
        } catch {
          throw new Error('Penerbitan dokumen gagal disimpan.');
        }
      }

      const finalDocument: PtvDocument = {
        id: finalDocId,
        no: officialNo,
        subject: subject.trim(),
        type: docType.includes('Barang') ? 'Izin Membawa Barang' : 'Surat Tugas',
        date: effectiveDate,
        start_date: start_date || effectiveDate,
        end_date: end_date || effectiveDate,
        owner: session.full_name || 'Pemohon',
        pembawa: pembawa || (docType.includes('Barang') ? session.full_name : undefined),
        penanggung_jawab: penanggung_jawab || (docStatus === 'Disetujui' ? approverName : undefined),
        diajukan_oleh: session.username || session.full_name,
        recipients: recipients || (pembawa ? [pembawa] : [session.full_name]),
        items: items || [],
        unit_ids: unit_ids || [],
        event: event || undefined,
        event_id: event_id || undefined,
        status: docStatus,
        created_at: nowIso,
        approved_at: approvedAt,
        review_note: notes || undefined,
        status_history: statusHistory,
      };

      res.statusCode = 201;
      res.end(
        JSON.stringify({
          success: true,
          message:
            docStatus === 'Disetujui'
              ? `Dokumen ${docType} berhasil diterbitkan dan disetujui resmi dengan nomor ${officialNo}.`
              : `Pengajuan ${docType} berhasil dibuat dan menunggu persetujuan pejabat berwenang.`,
          document: finalDocument,
          auto_approved: docStatus === 'Disetujui',
        })
      );
      return;
    }

    // =========================================================================
    // GET METHOD: RETRIEVAL & VACANT CHECK
    // =========================================================================

    // 4.1 Mode Vacancy Check (Paritas Legacy ptv_verify_nomor_surat_vacant)
    if (mode === 'vacant_check') {
      const typeParam = (urlObj.searchParams.get('type') || 'SI').toUpperCase() as 'SI' | 'ST' | 'SBB';
      const dateParam = urlObj.searchParams.get('date') || new Date().toISOString().slice(0, 10);
      let vacantResult = calculateNextNomorSurat(allDocs, typeParam, dateParam);
      if (supabase) {
        const { data, error } = await supabase.rpc('ptv_letter_preview', { p_type: typeParam, p_date: dateParam });
        if (error || !data?.nomor_surat) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'Nomor resmi server belum tersedia.' }));
          return;
        }
        vacantResult = data;
      }

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          mode: 'vacant_check',
          data: {
            type: typeParam,
            date: dateParam,
            year: vacantResult.year,
            roman_month: vacantResult.roman_month,
            highest_sequence: vacantResult.sequence - 1,
            next_sequence: vacantResult.sequence,
            nomor_surat: vacantResult.nomor_surat,
            is_vacant: true,
            is_official: true,
          },
        })
      );
      return;
    }

    // Apply ownership filter for Dokumen Saya (mode === 'my')
    let outputDocs = allDocs;
    if (mode === 'my') {
      outputDocs = filterUserDocuments(allDocs, {
        name: session.full_name,
        username: session.username,
        ptv_id: session.ptv_id,
        account_id: session.account_id,
        identity_id: session.identity_id,
        isExecOrAdmin,
      });
    }

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        mode,
        count: outputDocs.length,
        total_live_documents: allDocs.length,
        stats: {
          total: outputDocs.length,
          izin: outputDocs.filter((d) => d.type.includes('Izin')).length,
          tugas: outputDocs.filter((d) => d.type === 'Surat Tugas').length,
          barang: outputDocs.filter((d) => d.type.includes('Barang')).length,
          disetujui: outputDocs.filter((d) => d.status === 'Disetujui').length,
          menunggu: outputDocs.filter((d) => d.status === 'Menunggu').length,
          revisi: outputDocs.filter((d) => d.status === 'Revisi').length,
          ditolak: outputDocs.filter((d) => d.status === 'Ditolak').length,
        },
        documents: outputDocs,
      })
    );
  } catch (err: any) {
    console.error('[API Dokumen] Operasi gagal.');
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: `Terjadi kesalahan internal server saat memproses data dokumen: ${err.message}`,
        code: 'internal_server_error',
      })
    );
  }
}

/**
 * Programmatic request runner for regression testing and direct controller invocation
 */
export async function handleDokumenApiRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
}): Promise<{ status: number; body: any }> {
  let statusCode = 200;
  let responseData: any = null;

  const bodyBuffer = options.body ? Buffer.from(typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : Buffer.alloc(0);

  const mockReq = {
    method: options.method || 'GET',
    url: options.url || '/api/dokumen',
    headers: options.headers || {},
    on: (event: string, callback: any) => {
      if (event === 'data' && bodyBuffer.length > 0) {
        callback(bodyBuffer);
      }
      if (event === 'end') {
        callback();
      }
      return mockReq;
    },
  } as unknown as IncomingMessage;

  const mockRes = {
    setHeader: () => {},
    set statusCode(code: number) {
      statusCode = code;
    },
    get statusCode() {
      return statusCode;
    },
    end: (chunk: string) => {
      try {
        responseData = JSON.parse(chunk);
      } catch {
        responseData = chunk;
      }
    },
  } as unknown as ServerResponse;

  await handler(mockReq, mockRes);
  return { status: statusCode, body: responseData };
}
