import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { parseJsonBody } from './auth/_utils/bodyParser';

export const VALID_INSTANSI_LIST = [
  'PTV',
  'SD',
  'SMP',
  'IIS SMP',
  'SMA',
  'MADIN',
  'ASRAMA',
  'SPI',
  'MI',
  'MTs',
  'MA',
  'RIBATH',
  'YAYASAN',
  'NDALEM',
] as const;

export type ValidInstansi = typeof VALID_INSTANSI_LIST[number];

export function publicDocumentStatus(value: unknown): string {
  return determineDocumentStatus(value);
}

export function determineDocumentStatus(statusVal: unknown, tanggalSelesai?: string | null): 'valid' | 'tidak_valid' | 'kedaluwarsa' | 'menunggu' {
  const status = String(statusVal || '').trim().toLowerCase();
  
  if (['ditolak', 'rejected', 'dibatalkan', 'batal', 'dicabut', 'tidak_valid', 'diarsipkan', 'archived'].includes(status)) {
    return 'tidak_valid';
  }
  if (['menunggu', 'draft', 'pending'].includes(status)) {
    return 'menunggu';
  }
  if (['disetujui', 'aktif', 'valid', 'approved', 'acc', 'berlaku'].includes(status)) {
    if (tanggalSelesai) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const end = tanggalSelesai.split('T')[0];
        if (end < today) {
          return 'kedaluwarsa';
        }
      } catch {
        // Abaikan parse error, tetap valid
      }
    }
    return 'valid';
  }
  return 'menunggu';
}

// In-memory rate limiting map: hash -> timestamp array
const rateLimitMap = new Map<string, number[]>();
function checkRateLimit(clientId: string, maxRequests = 15, windowMs = 60000): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(clientId) || [];
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);
  if (validTimestamps.length >= maxRequests) {
    return false;
  }
  validTimestamps.push(now);
  rateLimitMap.set(clientId, validTimestamps);
  return true;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const clientFingerprint = (
    (req.headers && (req.headers['x-forwarded-for'] as string)) ||
    (req.headers && (req.headers['user-agent'] as string)) ||
    'client'
  ).slice(0, 32);

  if (!checkRateLimit(clientFingerprint)) {
    res.statusCode = 429;
    res.end(JSON.stringify({ error: 'Terlalu banyak permintaan. Silakan tunggu beberapa saat.', code: 'rate_limited' }));
    return;
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: 'Verifikasi server belum tersedia. Hubungi pengelola.', code: 'service_unavailable' }));
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1. GET: Ambil metadata surat publik (TANPA daftar santri pribadi)
  if (req.method === 'GET') {
    const searchParams = new URL(req.url || '/', 'http://localhost').searchParams;
    const rawNomor = searchParams.get('nomor')?.trim() || '';
    const queryDocId = searchParams.get('id')?.trim() || '';
    const queryToken = searchParams.get('token')?.trim() || '';
    const match = rawNomor.match(/^\d{1,6}\/(SI|ST|SBB|SB)-PTV\/[IVXLCDM]+\/\d{4}$/);
    if (!match || rawNomor.length > 80) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Format nomor surat tidak sesuai.', code: 'invalid_doc_number' }));
      return;
    }

    const typeCode = match[1];
    const table = typeCode === 'SI' ? 'ptv_surat_izin' : typeCode === 'ST' ? 'ptv_surat_tugas' : 'ptv_surat_barang';

    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('nomor_surat', rawNomor)
        .limit(2);

      if (error) throw error;
      if (!data || data.length === 0) {
        res.statusCode = 200;
        res.end(JSON.stringify({ found: false, nomor_surat: rawNomor }));
        return;
      }

      const row = data[0];

      // Proteksi QR Unik: Jika QR lama discan (memiliki ID atau token yang berbeda dari dokumen aktif)
      if (queryDocId && row.id !== queryDocId) {
        res.statusCode = 200;
        res.end(JSON.stringify({
          found: false,
          nomor_surat: rawNomor,
          error: 'Dokumen dengan identitas QR ini sudah tidak berlaku atau telah dihapus.',
          code: 'document_id_mismatch'
        }));
        return;
      }
      if (queryToken && row.qr_token && row.qr_token !== queryToken) {
        res.statusCode = 200;
        res.end(JSON.stringify({
          found: false,
          nomor_surat: rawNomor,
          error: 'Token pengenal QR tidak valid atau dokumen fisik lama telah ditarik.',
          code: 'qr_token_mismatch'
        }));
        return;
      }
      const endDate = row.tanggal_selesai || row.tanggal_tugas || row.tanggal_kembali || null;
      const computedStatus = determineDocumentStatus(row.status, endDate);
      const santriArr = Array.isArray(row.santri_list) ? row.santri_list : [];

      // Ambil riwayat log pemeriksaan resmi (disanitasi tanpa bocor data internal/IP/token)
      let riwayatList: any[] = [];
      try {
        const { data: logsData } = await supabase
          .from('ptv_surat_verifikasi_logs')
          .select('id, nomor_surat, nama_pemeriksa, instansi, metadata, accessed_at')
          .eq('nomor_surat', rawNomor)
          .order('accessed_at', { ascending: false })
          .limit(50);

        if (Array.isArray(logsData) && logsData.length > 0) {
          riwayatList = logsData.map((l: any) => {
            const meta = l.metadata || {};
            const itemHasil = meta.hasil || (computedStatus === 'tidak_valid' ? 'Gagal' : 'Berhasil');
            return {
              id: l.id,
              nama_pemeriksa: l.nama_pemeriksa,
              instansi: l.instansi,
              waktu: l.accessed_at || meta.recorded_at || new Date().toISOString(),
              hasil: itemHasil,
              status_dokumen: meta.status_dokumen || computedStatus,
              catatan: meta.catatan || (itemHasil === 'Berhasil' ? 'Pemeriksaan Sah & Terverifikasi' : 'Pemeriksaan Tercatat'),
            };
          });
        }
      } catch {
        // Abaikan error tabel log jika ada kendala jaringan, lanjut ke metadata
      }

      // Fallback atau merge dengan metadata surat jika ada riwayat tercatat di dokumen
      const metaLogs = Array.isArray(row.metadata?.verifikasi_logs) ? row.metadata.verifikasi_logs : [];
      if (metaLogs.length > 0) {
        const existingIds = new Set(riwayatList.map((r) => r.id));
        for (const ml of metaLogs) {
          const mlId = ml.id || `${ml.nama_pemeriksa}-${ml.accessed_at || ml.metadata?.recorded_at}`;
          if (!existingIds.has(mlId)) {
            existingIds.add(mlId);
            const mlHasil = ml.hasil || (computedStatus === 'tidak_valid' ? 'Gagal' : 'Berhasil');
            riwayatList.push({
              id: mlId,
              nama_pemeriksa: ml.nama_pemeriksa || 'Pemeriksa Terdaftar',
              instansi: ml.instansi || '—',
              waktu: ml.accessed_at || ml.metadata?.recorded_at || new Date().toISOString(),
              hasil: mlHasil,
              status_dokumen: ml.status_dokumen || computedStatus,
              catatan: ml.catatan || (mlHasil === 'Berhasil' ? 'Pemeriksaan Sah' : 'Pemeriksaan Tercatat'),
            });
          }
        }
      }

      // Pastikan urutan terbaru di atas
      riwayatList.sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          found: true,
          nomor_surat: row.nomor_surat,
          status: computedStatus,
          raw_status: row.status,
          jenis_surat: row.jenis_surat || (typeCode === 'SI' ? 'Surat Izin Santri' : typeCode === 'ST' ? 'Surat Tugas Kru' : 'Surat Peminjaman Aset'),
          perihal: row.keperluan || row.alasan || row.perihal || 'Kegiatan Operasional Progresif TV',
          tanggal_terbit: row.created_at,
          tanggal_mulai: row.tanggal_mulai || row.tanggal_tugas || row.tanggal_pinjam || null,
          tanggal_selesai: endDate,
          penanggung_jawab: row.penanggung_jawab || row.disetujui_oleh || 'Pimpinan Eksekutif PTV',
          diajukan_oleh: row.nama_pemohon || row.diajukan_oleh || null,
          has_santri_list: typeCode === 'SI' && santriArr.length > 0,
          santri_count: santriArr.length,
          id: row.id,
          riwayat_pemeriksaan: riwayatList,
        })
      );
      return;
    } catch (err: any) {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'Verifikasi server tidak dapat dilakukan. Coba lagi nanti.', code: 'db_error' }));
      return;
    }
  }

  // 2. POST: Catat identitas pemeriksa lalu kembalikan daftar santri
  if (req.method === 'POST') {
    let body: any;
    try {
      body = await parseJsonBody(req, { maxBytes: 32768 });
    } catch (err: any) {
      res.statusCode = err.statusCode || 400;
      res.end(JSON.stringify({ error: err.message || 'Body JSON tidak valid.', code: err.code || 'invalid_json' }));
      return;
    }

    const nomorSurat = String(body.nomor_surat || '').trim();
    const namaPemeriksa = String(body.nama_pemeriksa || '').trim();
    const instansi = String(body.instansi || '').trim();

    const postMatch = nomorSurat.match(/^\d{1,6}\/(SI|ST|SBB|SB)-PTV\/[IVXLCDM]+\/\d{4}$/);
    if (!nomorSurat || !postMatch) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Nomor surat wajib diisi dan sesuai format resmi.', code: 'invalid_nomor' }));
      return;
    }

    if (!namaPemeriksa || namaPemeriksa.length < 2 || namaPemeriksa.length > 80) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Nama pemeriksa wajib diisi (minimal 2 karakter).', code: 'invalid_nama' }));
      return;
    }

    if (!VALID_INSTANSI_LIST.includes(instansi as ValidInstansi)) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Pilihan instansi tidak valid.', code: 'invalid_instansi' }));
      return;
    }

    const postTypeCode = postMatch[1];
    const postTable = postTypeCode === 'SI' ? 'ptv_surat_izin' : postTypeCode === 'ST' ? 'ptv_surat_tugas' : 'ptv_surat_barang';

    try {
      // 1. Ambil dokumen dari tabel terkait
      const { data: rows, error: docErr } = await supabase
        .from(postTable)
        .select('*')
        .eq('nomor_surat', nomorSurat)
        .limit(1);

      if (docErr || !rows || rows.length === 0) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Dokumen surat tidak ditemukan dalam pangkalan data resmi.', code: 'doc_not_found' }));
        return;
      }

      const doc = rows[0];
      const endDate = doc.tanggal_selesai || doc.tanggal_tugas || doc.tanggal_kembali || null;
      const computedStatus = determineDocumentStatus(doc.status, endDate);
      const isDocValid = computedStatus === 'valid';
      const hasil = isDocValid ? 'Berhasil' : 'Gagal';
      const catatan = isDocValid
        ? 'Verifikasi Keabsahan & Buka Rincian Santri Berhasil'
        : `Pemeriksaan Tercatat: Status Dokumen ${computedStatus.toUpperCase()}`;

      const nowIso = new Date().toISOString();
      const logEntry = {
        nomor_surat: nomorSurat,
        nama_pemeriksa: namaPemeriksa,
        instansi,
        metadata: {
          hasil,
          status_dokumen: computedStatus,
          raw_status: doc.status,
          catatan,
          recorded_at: nowIso,
          userAgent: String(req.headers?.['user-agent'] || '').slice(0, 150),
        },
        accessed_at: nowIso,
      };

      // 2. Catat log ke tabel ptv_surat_verifikasi_logs
      let insertedLogId: string | undefined;
      const { data: insData, error: logErr } = await supabase
        .from('ptv_surat_verifikasi_logs')
        .insert(logEntry)
        .select();

      if (insData && insData[0]?.id) {
        insertedLogId = insData[0].id;
      }

      // 3. Sinkronkan riwayat ke metadata dokumen agar selalu terintegrasi dengan Hub & laci arsip
      let metaUpdateErr: any = null;
      try {
        const existingMeta = doc.metadata || {};
        const verifLogs = Array.isArray(existingMeta.verifikasi_logs) ? existingMeta.verifikasi_logs : [];
        const newMetaItem = {
          id: insertedLogId || `${nomorSurat}-${Date.now()}`,
          nomor_surat: nomorSurat,
          nama_pemeriksa: namaPemeriksa,
          instansi,
          hasil,
          status_dokumen: computedStatus,
          catatan,
          accessed_at: nowIso,
          metadata: { recorded_at: nowIso },
        };
        const updatedMetaLogs = [newMetaItem, ...verifLogs.filter((x: any) => x.id !== newMetaItem.id)].slice(0, 50);

        const { error: updErr } = await supabase
          .from(postTable)
          .update({
            metadata: { ...existingMeta, verifikasi_logs: updatedMetaLogs },
          })
          .eq('id', doc.id);
        metaUpdateErr = updErr;
      } catch (err: any) {
        metaUpdateErr = err;
      }

      // Jika kedua penyimpanan gagal (tabel logs dan metadata), jangan beri kesan data tersimpan
      if (logErr && metaUpdateErr) {
        res.statusCode = 500;
        res.end(JSON.stringify({
          error: 'Gagal mencatat log verifikasi ke database server. Silakan coba kembali.',
          code: 'storage_failure',
        }));
        return;
      }

      // 4. Kembalikan daftar santri dan entri riwayat terbaru
      const santriList = Array.isArray(doc.santri_list) ? doc.santri_list : [];
      const newHistoryItem = {
        id: insertedLogId || `${nomorSurat}-${Date.now()}`,
        nama_pemeriksa: namaPemeriksa,
        instansi,
        waktu: nowIso,
        hasil,
        status_dokumen: computedStatus,
        catatan,
      };

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: 'Pencatatan pemeriksa berhasil disimpan.',
          pemeriksa: {
            id: newHistoryItem.id,
            nama: namaPemeriksa,
            instansi,
            waktu: nowIso,
            hasil,
            status_dokumen: computedStatus,
          },
          santri_list: santriList,
          riwayat_pemeriksaan_item: newHistoryItem,
        })
      );
      return;
    } catch (err: any) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message || 'Gagal memproses pencatatan verifikasi.', code: 'server_error' }));
      return;
    }
  }

  res.setHeader('Allow', 'GET, POST');
  res.statusCode = 405;
  res.end(JSON.stringify({ error: `Metode ${req.method} tidak diizinkan.`, code: 'method_not_allowed' }));
}
