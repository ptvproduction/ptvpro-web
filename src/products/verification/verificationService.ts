import { docsStore } from '@products/hub/dokumen-saya/docsStore';
import { INITIAL_DOCS_FIXTURES, PtvDocument } from '@products/hub/dokumen-saya/mock/docsMockData';
import { crewStore } from '@products/hub/kru/kruStore';
import { CrewMember } from '@products/hub/kru/types';
import {
  PublicDocumentVerificationResult,
  PublicCrewVerificationResult,
  PublicActiveAssignment,
} from './types';

/**
 * Normalisasi canonical PTV-ID sesuai aturan PHP Legacy
 * 1 -> PTV-001
 * 25 -> PTV-025
 * ptv-25 -> PTV-025
 * PTV-PTV-025 -> PTV-025
 * 881 -> PTV-881
 */
export function ptvNormalizeCrewId(raw: string): string {
  const clean = raw.trim().toUpperCase().replace(/\s+/g, '').replace(/\/+$/, '');
  if (!clean) return '';

  // Buang awalan berulang PTV atau PTV-
  const part = clean.replace(/^(PTV-?)+/i, '');
  if (!part) return '';

  // Jika angka murni, pad menjadi 3 digit (misal 1 -> 001, 25 -> 025, 881 -> 881)
  if (/^\d+$/.test(part)) {
    return `PTV-${part.padStart(3, '0')}`;
  }

  return `PTV-${part}`;
}

/**
 * Normalisasi string query nomor surat
 */
export function cleanDocNumber(raw: string): string {
  try {
    const decoded = decodeURIComponent(raw);
    return decoded.trim().replace(/\/+$/, '').replace(/\s+/g, ' ');
  } catch {
    return raw.trim().replace(/\/+$/, '').replace(/\s+/g, ' ');
  }
}

/**
 * Format tanggal Indonesia ramah kalender lokal tanpa pergeseran timezone UTC
 */
export function formatIdDate(dateStr?: string): string {
  if (!dateStr || dateStr === '—' || dateStr === '-') return '-';

  if (dateStr.includes('s.d.') || dateStr.includes('–')) {
    return dateStr;
  }

  // Ambil hanya bagian YYYY-MM-DD
  const cleanYmd = dateStr.slice(0, 10);
  const parts = cleanYmd.split('-');
  if (parts.length !== 3) return dateStr;

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  if (!y || !m || !d || m < 1 || m > 12) return dateStr;

  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // Buat objek tanggal dengan parameter lokal (bukan string parsing UTC)
  const dt = new Date(y, m - 1, d);
  const dayName = dayNames[dt.getDay()];
  const monthName = monthNames[m - 1];

  return `${dayName}, ${d} ${monthName} ${y}`;
}

/**
 * Normalisasi nama untuk pencocokan toleran
 */
export function normalizePersonName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['`’.,\-_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pencocokan nama personil/santri
 */
export function isPersonMatch(name1: string, name2: string): boolean {
  const n1 = normalizePersonName(name1);
  const n2 = normalizePersonName(name2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;

  if (n1.length >= 5 && n2.length >= 5) {
    if (n1.includes(n2) || n2.includes(n1)) return true;
  }
  return false;
}

/**
 * Ambil seluruh dokumen dari shared store atau fallback ke fixtures
 */
function getAllDocuments(): PtvDocument[] {
  try {
    const list = docsStore.getAll();
    if (list && list.length > 0) return list;
  } catch {
    // Fallback jika store belum siap
  }
  return [...INITIAL_DOCS_FIXTURES];
}

/**
 * Verifikasi Keabsahan Dokumen secara publik
 */
export function verifyDocument(nomorOrId: string): PublicDocumentVerificationResult {
  const cleanQuery = cleanDocNumber(nomorOrId);

  if (!cleanQuery) {
    return {
      nomor_surat: '',
      jenis_surat: '',
      perihal: '',
      tanggal_terbit: '',
      tanggal_mulai: '',
      tanggal_selesai: '',
      penanggung_jawab: '',
      penerbit: '',
      pemohon: '',
      recipients: [],
      items: [],
      status: 'tidak_ditemukan',
      status_title: 'TIDAK DITEMUKAN',
      status_label: 'SILAKAN MASUKKAN NOMOR SURAT',
      status_desc:
        'Masukkan nomor surat resmi Progresif TV (contoh: 042/ST-PTV/X/2026 atau 001/SI-PTV/X/2026) untuk memeriksa keabsahannya.',
      is_valid: false,
      is_simulated: true,
    };
  }

  const allDocs = getAllDocuments();
  const cleanUpper = cleanQuery.toUpperCase();

  // Cari berdasarkan nomor surat (case-insensitive) atau id
  const doc = allDocs.find((d) => {
    if (!d) return false;
    const no = (d.no || '').toUpperCase().trim();
    const id = (d.id || '').toUpperCase().trim();

    if (no && no !== '—' && (no === cleanUpper || no.includes(cleanUpper) || cleanUpper.includes(no))) {
      return true;
    }
    if (id && id === cleanUpper) {
      return true;
    }
    return false;
  });

  if (!doc) {
    return {
      nomor_surat: cleanQuery,
      jenis_surat: 'Dokumen Tidak Dikenal',
      perihal: 'Nomor surat tidak terdaftar dalam arsip digital',
      tanggal_terbit: '-',
      tanggal_mulai: '-',
      tanggal_selesai: '-',
      penanggung_jawab: '-',
      penerbit: 'Arsip Digital Progresif TV',
      pemohon: '-',
      recipients: [],
      items: [],
      status: 'tidak_ditemukan',
      status_title: 'DOKUMEN TIDAK DITEMUKAN',
      status_label: 'TIDAK TERDAFTAR DALAM ARSIP RESMI',
      status_desc: `Nomor surat "${cleanQuery}" tidak ditemukan dalam basis data arsip resmi Progresif TV. Pastikan nomor surat diketik lengkap dan sesuai format.`,
      is_valid: false,
      is_simulated: true,
    };
  }

  const rawStatus = (doc.status || 'Menunggu').toLowerCase();
  const isValid = rawStatus === 'disetujui';

  let statusTitle = 'MENUNGGU PENGESAHAN';
  let statusLabel = 'SURAT DALAM PROSES (BELUM DISAHKAN)';
  let statusDesc =
    'Dokumen ini tercatat dalam sistem namun belum disahkan oleh Pimpinan/Eksekutif sehingga belum dapat digunakan sebagai izin resmi.';

  if (isValid) {
    statusTitle = 'DOKUMEN VALID';
    statusLabel = 'DOKUMEN RESMI TERDAFTAR & VALID';
    statusDesc =
      'Surat resmi ini terdaftar secara sah dan otentik dalam sistem basis data arsip Progresif TV.';
  } else if (rawStatus === 'revisi') {
    statusTitle = 'PERLU REVISI';
    statusLabel = 'SURAT MEMERLUKAN REVISI';
    statusDesc =
      doc.review_note
        ? `Surat ini memerlukan perbaikan sebelum dapat disahkan: "${doc.review_note}"`
        : 'Dokumen tercatat dalam sistem namun memerlukan perbaikan administratif sebelum dapat disahkan.';
  } else if (rawStatus === 'ditolak') {
    statusTitle = 'DITOLAK / TIDAK BERLAKU';
    statusLabel = 'SURAT RESMI DITOLAK ATAU SUDAH TIDAK BERLAKU';
    statusDesc =
      'Dokumen ini tidak sah atau telah dibatalkan oleh Eksekutif Progresif TV sehingga tidak memiliki kekuatan izin operasional.';
  }

  // Tentukan jenis surat yang ramah publik
  let jenisSuratLabel = doc.type || 'Surat Resmi';
  if (doc.type === 'Surat Tugas' || (doc.no && doc.no.includes('ST-PTV'))) {
    jenisSuratLabel = 'Surat Tugas Resmi Kru';
  } else if (doc.type === 'Surat Izin Santri' || (doc.no && doc.no.includes('SI-PTV'))) {
    jenisSuratLabel = 'Surat Izin Resmi Santri';
  } else if (doc.type === 'Izin Membawa Barang' || (doc.no && doc.no.includes('SBB-PTV'))) {
    jenisSuratLabel = 'Surat Izin Membawa Barang';
  }

  const tanggalMulai = doc.start_date || doc.date || '';
  const tanggalSelesai = doc.end_date || tanggalMulai;
  const tanggalTerbit = doc.approved_at || doc.created_at || doc.date || '';

  return {
    nomor_surat: doc.no && doc.no !== '—' ? doc.no : `[Draft ${doc.id}]`,
    jenis_surat: jenisSuratLabel,
    perihal: doc.subject || 'Surat Operasional',
    tanggal_terbit: formatIdDate(tanggalTerbit),
    tanggal_mulai: formatIdDate(tanggalMulai),
    tanggal_selesai: formatIdDate(tanggalSelesai),
    penanggung_jawab: doc.penanggung_jawab || 'Pimpinan Eksekutif Progresif TV',
    penerbit: doc.penanggung_jawab || 'Pimpinan Eksekutif Progresif TV',
    pemohon: doc.owner || doc.pembawa || 'Kru Progresif TV',
    recipients: Array.isArray(doc.recipients) ? doc.recipients : [],
    items: Array.isArray(doc.items) ? doc.items : [],
    status: (isValid
      ? 'valid'
      : rawStatus === 'revisi'
        ? 'revisi'
        : rawStatus === 'ditolak'
          ? 'ditolak'
          : 'menunggu'),
    status_title: statusTitle,
    status_label: statusLabel,
    status_desc: statusDesc,
    is_valid: isValid,
    is_simulated: false,
    raw_id: doc.id,
    created_at: doc.created_at,
  };
}

/**
 * Mencari surat tugas yang sedang aktif hari ini untuk personil kru
 */
export function getActiveAssignmentForCrew(
  crew: CrewMember,
  targetDateYmd?: string
): PublicActiveAssignment | null {
  const today =
    targetDateYmd ||
    new Date().toLocaleDateString('en-CA'); // Format YYYY-MM-DD lokal

  const allDocs = getAllDocuments();

  // Cari surat tugas yang:
  // 1. Status 'Disetujui' (resmi)
  // 2. Berisi kru ini di recipients atau pembawa atau penanggung_jawab
  // 3. Rentang tanggal mencakup hari ini (targetDateYmd)
  const activeDoc = allDocs.find((doc) => {
    if (doc.status !== 'Disetujui') return false;

    // Cek keterkaitan kru
    const crewId = crew.ptv_id || crew.id;
    const crewName = crew.full_name;

    const isRecipient =
      Array.isArray(doc.recipients) &&
      doc.recipients.some(
        (r) => isPersonMatch(r, crewName) || r.includes(crewId)
      );

    const isPembawa =
      !!doc.pembawa &&
      (isPersonMatch(doc.pembawa, crewName) || doc.pembawa.includes(crewId));

    const isPj =
      !!doc.penanggung_jawab && isPersonMatch(doc.penanggung_jawab, crewName);

    const isOwner = !!doc.owner && isPersonMatch(doc.owner, crewName);

    if (!isRecipient && !isPembawa && !isPj && !isOwner) {
      return false;
    }

    // Cek tanggal aktif
    const startYmd = (doc.start_date || doc.date || '').slice(0, 10);
    const endYmd = (doc.end_date || doc.start_date || doc.date || '').slice(0, 10);

    if (!startYmd) return false;

    if (startYmd <= today && today <= endYmd) {
      return true;
    }

    return false;
  });

  if (!activeDoc) return null;

  return {
    nomor_surat: activeDoc.no,
    perihal: activeDoc.subject,
    jenis_surat: activeDoc.type || 'Surat Tugas Resmi Kru',
    tanggal_mulai: formatIdDate(activeDoc.start_date || activeDoc.date),
    tanggal_selesai: formatIdDate(activeDoc.end_date || activeDoc.start_date || activeDoc.date),
    penanggung_jawab: activeDoc.penanggung_jawab || 'Pimpinan Eksekutif Progresif TV',
    is_today_active: true,
    verification_url: `/verifikasi-surat?nomor=${encodeURIComponent(activeDoc.no)}`,
  };
}

/**
 * Verifikasi Identitas Anggota/Kru Progresif TV secara publik
 * TIDAK MENAMPILKAN DATA PRIVAT (Email, password, OAuth, permission)
 */
export function verifyCrew(
  crewIdOrQuery: string,
  targetDateYmd?: string
): PublicCrewVerificationResult {
  const rawClean = crewIdOrQuery.trim();
  const normalizedId = ptvNormalizeCrewId(rawClean);

  if (!rawClean) {
    return {
      crew_id: '',
      full_name: '',
      position: '',
      division: '',
      angkatan: '',
      status_kru: 'Nonaktif',
      is_found: false,
      is_simulated: false,
      active_assignment: null,
    };
  }

  const allCrews = crewStore.getAll();

  // Cari berdasarkan normalized PTV-ID atau nama kru
  const crew = allCrews.find((c) => {
    const cId = ptvNormalizeCrewId(c.ptv_id || c.id || '');
    if (cId && (cId === normalizedId || c.ptv_id === rawClean)) {
      return true;
    }
    // Jika input berupa nama
    if (rawClean.length >= 3 && isPersonMatch(c.full_name, rawClean)) {
      return true;
    }
    return false;
  });

  if (!crew) {
    return {
      crew_id: normalizedId || rawClean,
      full_name: 'Identitas Kru Tidak Terdaftar',
      position: '-',
      division: '-',
      angkatan: '-',
      status_kru: 'Nonaktif',
      is_found: false,
      is_simulated: false,
      active_assignment: null,
    };
  }

  // Cari surat tugas aktif (jika ada)
  const activeAssignment = getActiveAssignmentForCrew(crew, targetDateYmd);

  return {
    crew_id: crew.ptv_id || normalizedId,
    full_name: crew.full_name,
    position: crew.position || 'Kru Operasional',
    division: crew.division || 'Umum',
    angkatan: crew.angkatan || '-',
    status_kru: crew.status_kru || 'Aktif',
    foto_url: crew.foto_url,
    is_found: true,
    is_simulated: false,
    active_assignment: activeAssignment,
  };
}


export function resolveOfficialDomain(configured?: string): string {
  try {
    const url = new URL(configured || 'https://ptvpro.com');
    if (url.protocol !== 'https:' || url.username || url.password ||
      !['ptvpro.com', 'www.ptvpro.com'].includes(url.hostname)) return 'https://ptvpro.com';
    return url.origin;
  } catch {
    return 'https://ptvpro.com';
  }
}

export const OFFICIAL_DOMAIN = resolveOfficialDomain(import.meta.env.VITE_PUBLIC_SITE_URL);

/**
 * Membentuk URL verifikasi resmi dokumen untuk distribusi publik / cetak QR fisik
 * Format: https://ptvpro.com/verifikasi-surat/{NOMOR_SURAT}
 */
export function buildOfficialDocVerificationUrl(nomorSurat: string): string {
  const clean = cleanDocNumber(nomorSurat);
  if (!clean) return `${OFFICIAL_DOMAIN}/verifikasi-surat`;
  return `${OFFICIAL_DOMAIN}/verifikasi-surat/${encodeURIComponent(clean)}`;
}

/**
 * Membentuk URL verifikasi resmi kru untuk distribusi publik / kartu ID resmi
 * Format: https://ptvpro.com/verifikasi-identitas/{CREW_ID}
 */
export function buildOfficialCrewVerificationUrl(crewId: string): string {
  const normalized = ptvNormalizeCrewId(crewId);
  if (!normalized) return `${OFFICIAL_DOMAIN}/verifikasi-identitas`;
  return `${OFFICIAL_DOMAIN}/verifikasi-identitas/${encodeURIComponent(normalized)}`;
}

/**
 * Membentuk URL navigasi lokal dokumen atau preview development
 */
export function buildLocalDocVerificationUrl(nomorSurat: string, absolute = false): string {
  const clean = cleanDocNumber(nomorSurat);
  const relativePath = clean ? `/verifikasi-surat/${encodeURIComponent(clean)}` : '/verifikasi-surat';
  if (!absolute || typeof window === 'undefined') return relativePath;
  return `${window.location.origin}${relativePath}`;
}

/**
 * Membentuk URL navigasi lokal kru atau preview development
 */
export function buildLocalCrewVerificationUrl(crewId: string, absolute = false): string {
  const normalized = ptvNormalizeCrewId(crewId);
  const relativePath = normalized ? `/verifikasi-identitas/${encodeURIComponent(normalized)}` : '/verifikasi-identitas';
  if (!absolute || typeof window === 'undefined') return relativePath;
  return `${window.location.origin}${relativePath}`;
}

/**
 * Membentuk URL verifikasi publik untuk QR code identitas kru.
 * - Pada localhost / staging preview, menghasilkan URL origin lokal agar scan QR di lingkungan development
 *   langsung mengarah ke instance lokal (tidak melempar ke production luar).
 * - Pada production, menghasilkan canonical official verification URL (https://ptvpro.com/verifikasi-identitas/{CREW_ID}).
 */
export function resolveCrewVerificationQrUrl(crewId: string): string {
  const normalized = ptvNormalizeCrewId(crewId) || (crewId ? crewId.trim() : '');
  if (!normalized) {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return `${window.location.origin}/verifikasi-identitas`;
    }
    return `${OFFICIAL_DOMAIN}/verifikasi-identitas`;
  }

  if (typeof window !== 'undefined') {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local');
    if (isLocalhost) {
      return `${window.location.origin}/verifikasi-identitas/${encodeURIComponent(normalized)}`;
    }
  }

  return buildOfficialCrewVerificationUrl(normalized);
}
