import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';

// In-memory rate limiting map: hash -> timestamp array
const rateLimitMap = new Map<string, number[]>();
function checkRateLimit(clientId: string, maxRequests = 30, windowMs = 60000): boolean {
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

/**
 * Normalisasi canonical PTV-ID
 */
function normalizeCrewId(raw: string): string {
  const clean = raw.trim().toUpperCase().replace(/\s+/g, '').replace(/\/+$/, '');
  if (!clean) return '';
  const part = clean.replace(/^(PTV-?)+/i, '');
  if (!part) return '';
  if (/^\d+$/.test(part)) {
    return `PTV-${part.padStart(3, '0')}`;
  }
  return `PTV-${part}`;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.end(JSON.stringify({ error: 'Metode tidak didukung. Gunakan GET.', code: 'method_not_allowed' }));
    return;
  }

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
    res.end(JSON.stringify({ error: 'Layanan verifikasi kru belum tersedia. Hubungi pengelola.', code: 'service_unavailable' }));
    return;
  }

  const searchParams = new URL(req.url || '/', 'http://localhost').searchParams;
  const queryId = searchParams.get('id') || searchParams.get('crew_id') || searchParams.get('kru') || searchParams.get('q') || '';
  const rawClean = queryId.trim();

  if (!rawClean) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Parameter identitas (id / q) wajib diisi.', code: 'missing_parameter' }));
    return;
  }

  if (rawClean.length > 80) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Panjang query identitas melebihi batas yang diizinkan.', code: 'query_too_long' }));
    return;
  }

  const normalizedId = normalizeCrewId(rawClean);
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    // 1. Cari personil di legacy_archive_kru berdasarkan PTV-ID atau nama
    let query = supabase.from('legacy_archive_kru').select(`
      archive_id,
      ptv_id,
      full_name,
      divisi,
      jabatan,
      angkatan,
      status,
      photo_url,
      canonical_identity_id,
      metadata_json
    `);

    if (normalizedId.startsWith('PTV-') && normalizedId.length <= 16) {
      query = query.eq('ptv_id', normalizedId);
    } else {
      query = query.ilike('full_name', `%${rawClean}%`);
    }

    const { data: rows, error: queryErr } = await query.limit(2);
    if (queryErr) {
      throw queryErr;
    }

    if (!rows || rows.length === 0) {
      res.statusCode = 200;
      res.end(JSON.stringify({
        is_found: false,
        crew_id: normalizedId || rawClean,
        full_name: 'Identitas Kru Tidak Terdaftar',
        position: '-',
        division: '-',
        angkatan: '-',
        status_kru: 'Nonaktif',
        active_assignment: null,
      }));
      return;
    }

    const crewRow = rows[0];

    // Cek canonical identity untuk avatar resmi terbaru jika ada
    let avatarUrl = crewRow.photo_url || crewRow.metadata_json?.avatar_url || '';
    if (crewRow.canonical_identity_id) {
      const { data: canon } = await supabase
        .from('canonical_identity')
        .select('avatar_url')
        .eq('id', crewRow.canonical_identity_id)
        .maybeSingle();
      if (canon?.avatar_url) {
        avatarUrl = canon.avatar_url;
      }
    }

    // Normalisasi status kru (Aktif / Nonaktif / Purna Kru)
    const rawStatus = (crewRow.status || '').trim();
    let statusKru: 'Aktif' | 'Nonaktif' | 'Purna Kru' = 'Aktif';
    if (rawStatus.toLowerCase() === 'nonaktif' || rawStatus.toLowerCase() === 'inactive') {
      statusKru = 'Nonaktif';
    } else if (rawStatus.toLowerCase().includes('purna') || rawStatus.toLowerCase().includes('alumni')) {
      statusKru = 'Purna Kru';
    }

    // Cek penugasan surat tugas aktif hari ini secara aman
    const today = new Date().toISOString().split('T')[0];
    let activeAssignment: {
      nomor_surat: string;
      jenis_kegiatan: string;
      tanggal_mulai: string;
      tanggal_selesai: string;
      penanggung_jawab: string;
      is_today_active: boolean;
      verification_url: string;
    } | null = null;

    try {
      const { data: assignments } = await supabase
        .from('ptv_surat_tugas')
        .select('nomor_surat, subject, jenis_kegiatan, tanggal_mulai, tanggal_selesai, penanggung_jawab, pembawa, recipients, status')
        .lte('tanggal_mulai', today)
        .gte('tanggal_selesai', today)
        .in('status', ['disetujui', 'aktif', 'Disetujui', 'Aktif'])
        .limit(10);

      if (assignments && Array.isArray(assignments)) {
        const foundAss = assignments.find((a) => {
          const recip = Array.isArray(a.recipients) ? a.recipients : [];
          return (
            (a.pembawa && (a.pembawa.includes(crewRow.full_name) || a.pembawa.includes(crewRow.ptv_id))) ||
            recip.some((r: string) => r.includes(crewRow.full_name) || r.includes(crewRow.ptv_id))
          );
        });

        if (foundAss) {
          activeAssignment = {
            nomor_surat: foundAss.nomor_surat,
            jenis_kegiatan: foundAss.jenis_kegiatan || foundAss.subject || 'Liputan Acara',
            tanggal_mulai: foundAss.tanggal_mulai,
            tanggal_selesai: foundAss.tanggal_selesai,
            penanggung_jawab: foundAss.penanggung_jawab || 'Ketua Umum PTV',
            is_today_active: true,
            verification_url: `/verifikasi-surat?nomor=${encodeURIComponent(foundAss.nomor_surat)}`,
          };
        }
      }
    } catch {
      // Penugasan opsional, tidak menggagalkan verifikasi identitas
    }

    // Respons publik murni — HANYA data publik yang disetujui
    res.statusCode = 200;
    res.end(JSON.stringify({
      is_found: true,
      crew_id: crewRow.ptv_id,
      full_name: crewRow.full_name,
      position: crewRow.jabatan || 'Kru Operasional',
      division: crewRow.divisi || 'Umum',
      angkatan: crewRow.angkatan || '-',
      status_kru: statusKru,
      foto_url: avatarUrl,
      active_assignment: activeAssignment,
    }));
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Gagal memproses verifikasi identitas.', code: 'server_error' }));
  }
}
