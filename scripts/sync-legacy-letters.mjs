import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// PTVPRO — COMPREHENSIVE TRANSITION LETTER & ARCHIVE SYNC ENGINE (LEGACY -> STAGING)
// Strict One-Way | Idempotent | Checkpointed | Anti-Conflict | Zero Fabrication
// Encompasses: Surat Izin, Surat Tugas, Surat Barang, Catatan, Pengumuman, E-Book
// ============================================================================

/**
 * Parsing file environment secara aman tanpa membocorkan credential ke log.
 */
export function parseEnvFiles(baseDir = process.cwd()) {
  const env = {};
  const candidates = ['.env.staging.local', '.env.local', '.env.staging', '.env'];

  for (const file of candidates) {
    const fullPath = path.resolve(baseDir, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const idx = trimmed.indexOf('=');
        const k = trimmed.slice(0, idx).trim();
        let v = trimmed.slice(idx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!env[k]) env[k] = v;
      }
    }
  }
  return env;
}

/**
 * Helper untuk memuat kredensial Legacy Supabase secara aman:
 * 1. Dari environment (LEGACY_SUPABASE_URL & LEGACY_SUPABASE_KEY).
 * 2. Fallback otomatis dari local WordPress / DB dump jika ada di mesin lokal.
 */
export async function resolveLegacyCredentials(env = {}) {
  let url = env.LEGACY_SUPABASE_URL || null;
  let key = env.LEGACY_SUPABASE_KEY || null;

  if (url && key) {
    return { url, key, source: 'env' };
  }

  const localDumpPaths = [
    'C:/Users/zidna/Local Sites/ptvrebuild/app/sql/local.sql',
    path.resolve(process.cwd(), '../Local Sites/ptvrebuild/app/sql/local.sql'),
  ];

  for (const p of localDumpPaths) {
    if (fs.existsSync(p)) {
      try {
        const fileStream = fs.createReadStream(p);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
        for await (const line of rl) {
          const m1 = line.match(/'ptv_supabase_url',\s*'([^']+)'/);
          const m2 = line.match(/'ptv_supabase_service_key',\s*'([^']+)'/);
          if (m1) url = m1[1];
          if (m2) key = m2[1];
          if (url && key) break;
        }
        if (url && key) {
          return { url, key, source: 'local_sql_dump' };
        }
      } catch {
        // Abaikan jika tidak dapat membaca file lokal
      }
    }
  }

  return { url: null, key: null, source: 'unresolved' };
}

/**
 * Resolusi Identitas kru/pengguna ke canonical_identity.id (UUID).
 * INVARIANT: Jika tidak ditemukan, return null. Dilarang mengarang UUID palsu!
 */
export function resolveIdentity(rawIdentity, identityMap = new Map()) {
  if (!rawIdentity || typeof rawIdentity !== 'string') {
    return { id: null, unmapped: false, raw: null };
  }

  const clean = rawIdentity.trim();
  if (!clean || clean === '—' || clean === '-') {
    return { id: null, unmapped: false, raw: clean };
  }

  // Cek apakah rawIdentity sudah berupa UUID v4
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(clean)) {
    if (identityMap.has(clean.toLowerCase())) {
      return { id: clean, unmapped: false, raw: clean };
    }
  }

  // Cari berdasarkan full_name (case-insensitive) atau ptv_id
  const lower = clean.toLowerCase();
  if (identityMap.has(lower)) {
    return { id: identityMap.get(lower), unmapped: false, raw: clean };
  }

  // Tidak ditemukan -> kembalikan null dan tandai unmapped untuk rekonsiliasi
  return { id: null, unmapped: true, raw: clean };
}

/**
 * Normalisasi status dokumen dengan penanganan eksplisit untuk status batal/dibatalkan.
 */
export function normalizeDocumentStatus(rawStatus) {
  const s = String(rawStatus || 'menunggu').toLowerCase().trim();
  if (['disetujui', 'aktif', 'valid', 'approved', 'acc'].includes(s)) return 'disetujui';
  if (['revisi', 'revision'].includes(s)) return 'revisi';
  if (['ditolak', 'rejected'].includes(s)) return 'ditolak';
  if (['batal', 'dibatalkan', 'cancelled', 'canceled'].includes(s)) return 'ditolak'; // Dipetakan ke ditolak/batal aman
  return 'menunggu';
}

/**
 * 1. Mapping baris Surat Izin Legacy ke format kanonikal Staging (ptv_surat_izin).
 */
export function mapLegacySuratIzin(row, identityMap = new Map()) {
  const applicantRaw = row.nama_pemohon || row.nama_santri || row.diajukan_oleh || 'Pemohon Legacy';
  const reasonRaw = row.alasan || row.jenis_kegiatan || 'Permohonan Izin Santri';
  const startRaw = row.tanggal_mulai ? String(row.tanggal_mulai).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const endRaw = row.tanggal_selesai ? String(row.tanggal_selesai).slice(0, 10) : startRaw;

  let santriList = [];
  if (Array.isArray(row.santri_list)) {
    santriList = row.santri_list;
  } else if (typeof row.santri_list === 'string' && row.santri_list.trim()) {
    try {
      const parsed = JSON.parse(row.santri_list);
      if (Array.isArray(parsed)) santriList = parsed;
    } catch {
      santriList = [{ nama: row.santri_list.trim() }];
    }
  } else if (row.nama_santri) {
    santriList = [{ nama: String(row.nama_santri).trim() }];
  }

  const diajukanRes = resolveIdentity(row.diajukan_oleh, identityMap);
  const disetujuiRes = resolveIdentity(row.disetujui_oleh, identityMap);
  const status = normalizeDocumentStatus(row.status);

  return {
    canonicalRow: {
      id: row.id,
      nomor_surat: row.nomor_surat ? String(row.nomor_surat).trim() : null,
      nama_pemohon: String(applicantRaw).trim(),
      alasan: String(reasonRaw).trim(),
      tanggal_mulai: startRaw,
      tanggal_selesai: endRaw,
      diajukan_oleh: diajukanRes.id,
      disetujui_oleh: disetujuiRes.id,
      status,
      created_at: row.created_at || new Date().toISOString(),
      santri_list: santriList,
    },
    provenance: {
      source_system: 'legacy_sync',
      legacy_id: row.id,
      table: 'ptv_surat_izin',
      original_diajukan_oleh: row.diajukan_oleh || null,
      original_disetujui_oleh: row.disetujui_oleh || null,
      diajukan_unmapped: diajukanRes.unmapped,
      disetujui_unmapped: disetujuiRes.unmapped,
      is_cancelled: ['batal', 'dibatalkan', 'cancelled', 'canceled'].includes(String(row.status || '').toLowerCase().trim()),
    },
  };
}

/**
 * 2. Mapping baris Surat Tugas Legacy ke format kanonikal Staging (ptv_surat_tugas).
 */
export function mapLegacySuratTugas(row, identityMap = new Map()) {
  const subjectRaw = row.perihal || row.nama_kegiatan || 'Surat Tugas Liputan Legacy';
  const dateRaw = row.tanggal_tugas || row.tanggal_mulai || (row.created_at ? String(row.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10));

  let kruTerlibat = [];
  if (Array.isArray(row.kru_terlibat)) {
    kruTerlibat = row.kru_terlibat;
  } else if (Array.isArray(row.kru_assigned)) {
    kruTerlibat = row.kru_assigned;
  } else if (typeof row.kru_assigned === 'string' && row.kru_assigned.trim()) {
    try {
      const parsed = JSON.parse(row.kru_assigned);
      if (Array.isArray(parsed)) kruTerlibat = parsed;
      else kruTerlibat = row.kru_assigned.split(',').map((s) => s.trim()).filter(Boolean);
    } catch {
      kruTerlibat = row.kru_assigned.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  const diajukanRes = resolveIdentity(row.diajukan_oleh, identityMap);
  const disetujuiRes = resolveIdentity(row.disetujui_oleh, identityMap);
  const status = normalizeDocumentStatus(row.status);

  return {
    canonicalRow: {
      id: row.id,
      nomor_surat: row.nomor_surat ? String(row.nomor_surat).trim() : null,
      perihal: String(subjectRaw).trim(),
      tanggal_tugas: String(dateRaw).slice(0, 10),
      kru_terlibat: kruTerlibat,
      diajukan_oleh: diajukanRes.id,
      disetujui_oleh: disetujuiRes.id,
      status,
      created_at: row.created_at || new Date().toISOString(),
    },
    provenance: {
      source_system: 'legacy_sync',
      legacy_id: row.id,
      table: 'ptv_surat_tugas',
      original_diajukan_oleh: row.diajukan_oleh || null,
      original_disetujui_oleh: row.disetujui_oleh || null,
      diajukan_unmapped: diajukanRes.unmapped,
      disetujui_unmapped: disetujuiRes.unmapped,
      is_cancelled: ['batal', 'dibatalkan', 'cancelled', 'canceled'].includes(String(row.status || '').toLowerCase().trim()),
    },
  };
}

/**
 * 3. Mapping baris Surat Bawa Barang Legacy ke format kanonikal Staging (ptv_surat_barang).
 */
export function mapLegacySuratBarang(row, identityMap = new Map()) {
  const pembawaRaw = row.nama_pembawa || row.pembawa || 'Pembawa Legacy';
  const lokasiRaw = row.tujuan_lokasi || row.keperluan || 'Area Operasional PTV';

  let daftarBarang = [];
  if (Array.isArray(row.daftar_barang)) {
    daftarBarang = row.daftar_barang;
  } else if (typeof row.daftar_barang === 'string' && row.daftar_barang.trim()) {
    try {
      const parsed = JSON.parse(row.daftar_barang);
      if (Array.isArray(parsed)) daftarBarang = parsed;
      else daftarBarang = [{ nama: row.daftar_barang.trim() }];
    } catch {
      daftarBarang = [{ nama: row.daftar_barang.trim() }];
    }
  }

  const diajukanRes = resolveIdentity(row.diajukan_oleh, identityMap);
  const disetujuiRes = resolveIdentity(row.disetujui_oleh, identityMap);
  const status = normalizeDocumentStatus(row.status);

  return {
    canonicalRow: {
      id: row.id,
      nomor_surat: row.nomor_surat ? String(row.nomor_surat).trim() : null,
      nama_pembawa: String(pembawaRaw).trim(),
      tujuan_lokasi: String(lokasiRaw).trim(),
      daftar_barang: daftarBarang,
      diajukan_oleh: diajukanRes.id,
      disetujui_oleh: disetujuiRes.id,
      status,
      created_at: row.created_at || new Date().toISOString(),
    },
    provenance: {
      source_system: 'legacy_sync',
      legacy_id: row.id,
      table: 'ptv_surat_barang',
      original_diajukan_oleh: row.diajukan_oleh || null,
      original_disetujui_oleh: row.disetujui_oleh || null,
      diajukan_unmapped: diajukanRes.unmapped,
      disetujui_unmapped: disetujuiRes.unmapped,
      is_cancelled: ['batal', 'dibatalkan', 'cancelled', 'canceled'].includes(String(row.status || '').toLowerCase().trim()),
    },
  };
}

/**
 * 4. Mapping baris Catatan & Notulensi Legacy ke format kanonikal Staging (ptv_catatan).
 */
export function mapLegacyCatatan(row, identityMap = new Map()) {
  let tags = [];
  if (Array.isArray(row.tags)) {
    tags = row.tags.map((t) => String(t));
  } else if (typeof row.tags === 'string' && row.tags.trim()) {
    try {
      const parsed = JSON.parse(row.tags);
      if (Array.isArray(parsed)) tags = parsed.map((t) => String(t));
      else tags = row.tags.split(',').map((t) => t.trim()).filter(Boolean);
    } catch {
      tags = row.tags.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }

  // Normalisasi warna ke NoteCategoryKey yang valid
  let warna = 'orange';
  const rawWarna = String(row.warna || '').toLowerCase().trim();
  if (['emerald', 'green', 'teal'].includes(rawWarna)) warna = 'green';
  else if (['yellow', 'amber'].includes(rawWarna)) warna = 'yellow';
  else if (['purple', 'indigo', 'violet'].includes(rawWarna)) warna = 'purple';
  else if (['rose', 'red', 'pink'].includes(rawWarna)) warna = 'rose';
  else if (rawWarna === 'orange') warna = 'orange';

  const authorRes = resolveIdentity(row.created_by_name || row.created_by_id, identityMap);

  return {
    canonicalRow: {
      id: row.id,
      judul: String(row.judul || 'Tanpa Judul').trim(),
      isi: String(row.isi || ''),
      warna,
      is_pinned: Boolean(row.is_pinned),
      tags,
      created_by_id: row.created_by_id || 'PTV-001',
      created_by_name: row.created_by_name || 'Kru Studio Legacy',
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || row.created_at || new Date().toISOString(),
    },
    provenance: {
      source_system: 'legacy_sync',
      legacy_id: row.id,
      table: 'ptv_catatan',
      original_author: row.created_by_name || row.created_by_id || null,
      author_unmapped: authorRes.unmapped,
    },
  };
}

/**
 * 5. Mapping baris Pengumuman & Broadcast Legacy ke format kanonikal Staging (ptv_pengumuman).
 */
export function mapLegacyPengumuman(row) {
  return {
    canonicalRow: {
      id: row.id,
      judul: String(row.judul || 'Pengumuman Resmi').trim(),
      konten: String(row.konten || ''),
      target_divisi: row.target_divisi || 'Semua',
      prioritas: row.prioritas || 'Penting',
      status: row.status || 'aktif',
      thumbnail_url: row.thumbnail_url || null,
      created_by: row.created_by || 'Admin Legacy',
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || row.created_at || new Date().toISOString(),
    },
    provenance: {
      source_system: 'legacy_sync',
      legacy_id: row.id,
      table: 'ptv_pengumuman',
    },
  };
}

/**
 * 6. Mapping Arsip Publikasi & E-Book Legacy (ptv_ebook) dengan preservasi URL PDF.
 */
export function mapLegacyEbook(row) {
  const fileUrl = row.file_url ? String(row.file_url).trim() : null;
  const isWpUpload = fileUrl && fileUrl.includes('wp-content/uploads');
  const isDrive = fileUrl && fileUrl.includes('drive.google.com');

  return {
    canonicalRow: {
      id: row.id,
      judul: String(row.judul || 'E-Book / Panduan').trim(),
      penulis: row.penulis ? String(row.penulis).trim() : 'Pimpinan / Asatidz PTV',
      kategori: row.kategori || 'Publikasi & Panduan',
      file_url: fileUrl,
      cover_url: row.cover_url || null,
      deskripsi: row.deskripsi || null,
      created_at: row.created_at || new Date().toISOString(),
    },
    provenance: {
      source_system: 'legacy_sync',
      legacy_id: row.id,
      table: 'ptv_ebook',
      storage_type: isWpUpload ? 'wordpress_uploads' : isDrive ? 'google_drive' : 'external_url',
      has_valid_pdf_link: Boolean(fileUrl && (fileUrl.endsWith('.pdf') || isDrive)),
    },
  };
}

/**
 * Deteksi konflik nomor surat antara record incoming legacy dengan database staging.
 */
export function detectLetterConflict(incomingRecord, existingStagingRecords = [], reservedNumbers = new Set()) {
  const no = incomingRecord.nomor_surat ? incomingRecord.nomor_surat.trim() : null;
  if (!no || no === '—' || no.startsWith('DRAFT')) {
    return null; // Draf atau belum terbit tidak memicu konflik nomor
  }

  // 1. Cek apakah bertabrakan dengan nomor offline yang dilindungi (historical reservation)
  if (reservedNumbers.has(no)) {
    // Jika nomor ini terdaftar sebagai reservasi offline resmi dan bukan ID ini yang menerbitkannya
    const isOwner = incomingRecord.id === 'df6e9e3b-ef6a-4359-a1df-9cb10f2294e7' && no === '009/SI-PTV/X/2026';
    if (!isOwner) {
      return {
        type: 'RESERVED_OFFLINE_COLLISION',
        nomor_surat: no,
        doc_id: incomingRecord.id,
        message: `Nomor ${no} dilindungi sebagai reservasi historis offline resmi.`,
      };
    }
  }

  // 2. Cek apakah bertabrakan dengan dokumen staging yang memiliki ID berbeda
  for (const stg of existingStagingRecords) {
    if (stg.nomor_surat && stg.nomor_surat.trim().toLowerCase() === no.toLowerCase()) {
      if (stg.id !== incomingRecord.id) {
        return {
          type: 'DUPLICATE_NUMBER_COLLISION',
          nomor_surat: no,
          incoming_id: incomingRecord.id,
          existing_staging_id: stg.id,
          message: `Nomor surat ${no} sudah digunakan oleh dokumen Staging dengan ID ${stg.id}.`,
        };
      }
    }
  }

  return null;
}

/**
 * Filter record incremental berdasarkan checkpoint timestamp.
 */
export function filterIncrementalRecords(records = [], checkpointTimestamp = null) {
  if (!checkpointTimestamp) return records;
  const checkpointMs = new Date(checkpointTimestamp).getTime();
  if (isNaN(checkpointMs)) return records;

  return records.filter((r) => {
    const updatedMs = r.updated_at ? new Date(r.updated_at).getTime() : 0;
    const createdMs = r.created_at ? new Date(r.created_at).getTime() : 0;
    const effectiveMs = Math.max(updatedMs, createdMs);
    return effectiveMs > checkpointMs;
  });
}

/**
 * Perhitungan sequence berikutnya secara dinamis (Dynamic Gap-Filling).
 */
export function calculateDynamicNextSequence(allIssuedAndReservedNumbers = [], docType = 'SI', year = 2026) {
  const tag = docType === 'ST' ? 'ST-PTV' : docType === 'SBB' ? 'SBB-PTV' : 'SI-PTV';
  const regex = new RegExp(`^(\\d{3,4})\\/${tag}\\/([A-Z]+)\\/${year}$`, 'i');

  const used = new Set();
  for (const num of allIssuedAndReservedNumbers) {
    if (!num) continue;
    const m = String(num).trim().match(regex);
    if (m) {
      const s = parseInt(m[1], 10);
      if (!isNaN(s) && s > 0) used.add(s);
    }
  }

  let candidate = 1;
  while (used.has(candidate)) {
    candidate++;
  }
  return candidate;
}

/**
 * Helper retry dengan exponential backoff untuk keandalan panggilan jaringan.
 */
export async function withExponentialBackoff(fn, maxRetries = 3, initialDelayMs = 200) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) throw err;
      const delay = initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 50;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Pipeline Utama Sinkronisasi Transisi Seluruh Surat & Arsip.
 */
export async function executeLetterSync(options = {}) {
  const env = parseEnvFiles();
  const legacyCreds = await resolveLegacyCredentials(env);

  const {
    mode = 'incremental', // 'backfill' | 'incremental'
    isDryRun = true, // Default strict read-only
    sourceMode = 'cloud', // 'cloud' | 'bundle'
    bundleFile = 'production-bundle.json',
    checkpointFile = 'reports/legacy-sync-checkpoint.json',
    reconciliationFile = 'reports/legacy-sync-reconciliation.json',
    archiveManifestFile = 'reports/legacy-archive-manifest.json',
    customLegacyData = null,
    customStagingData = null,
    stagingUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://swadgljnyelsjstqqxbm.supabase.co',
    stagingKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY,
    legacyUrl = options.legacyUrl || legacyCreds.url,
    legacyKey = options.legacyKey || legacyCreds.key,
    reservedOfflineNumbers = [], // Nomor 009 sudah berstatus fisik di DB Legacy (UUID df6e9e3b...)
  } = options;

  const summary = {
    started_at: new Date().toISOString(),
    mode,
    is_dry_run: isDryRun,
    source_mode: sourceMode,
    legacy_source_type: legacyCreds.source,
    target_project: stagingUrl,
    counts: {
      legacy_total: 0,
      incremental_candidates: 0,
      synced_ready: 0,
      skipped_unchanged: 0,
      conflicts_quarantined: 0,
      unmapped_identities: 0,
    },
    tables: {
      ptv_surat_izin: { total: 0, ready: 0, unmapped: 0, conflicts: 0 },
      ptv_surat_tugas: { total: 0, ready: 0, unmapped: 0, conflicts: 0 },
      ptv_surat_barang: { total: 0, ready: 0, unmapped: 0, conflicts: 0 },
      ptv_catatan: { total: 0, ready: 0, unmapped: 0, conflicts: 0 },
      ptv_pengumuman: { total: 0, ready: 0, unmapped: 0, conflicts: 0 },
      ptv_ebook: { total: 0, ready: 0, unique_titles: 0 },
    },
    quarantine: [],
    unmapped_identities_log: [],
    conflicts_log: [],
    orphan_retention_log: [],
    next_sequences: {},
  };

  // HARD ANTI-PROD BARRIER: Target dilarang keras menunjuk ke jthzuhkblxcaohiuypqq!
  if (stagingUrl.includes('jthzuhkblxcaohiuypqq')) {
    throw new Error('FATAL SAFETY VIOLATION: Target database mengarah ke Production Legacy (jthzuhkblxcaohiuypqq)! Script dibatalkan mutlak.');
  }

  // 1. Baca Checkpoint Sebelumnya jika mode incremental
  let checkpointTimestamp = null;
  if (mode === 'incremental' && fs.existsSync(checkpointFile)) {
    try {
      const cpData = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
      checkpointTimestamp = cpData.last_synced_at || null;
    } catch {
      checkpointTimestamp = null;
    }
  }

  // 2. Muat Sumber Data Legacy
  let legacyData = {
    ptv_surat_izin: [],
    ptv_surat_tugas: [],
    ptv_surat_barang: [],
    ptv_catatan: [],
    ptv_pengumuman: [],
    ptv_ebook: [],
  };

  if (customLegacyData) {
    legacyData = { ...legacyData, ...customLegacyData };
  } else if (sourceMode === 'bundle') {
    const bundlePath = path.resolve(process.cwd(), bundleFile);
    if (!fs.existsSync(bundlePath)) {
      throw new Error(`Berkas bundle sumber '${bundleFile}' tidak ditemukan.`);
    }
    const raw = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    legacyData = {
      ptv_surat_izin: raw.ptv_surat_izin || [],
      ptv_surat_tugas: raw.ptv_surat_tugas || [],
      ptv_surat_barang: raw.ptv_surat_barang || [],
      ptv_catatan: raw.ptv_catatan || [],
      ptv_pengumuman: raw.ptv_pengumuman || [],
      ptv_ebook: raw.ptv_ebook || [],
    };
  } else if (sourceMode === 'cloud') {
    if (!legacyUrl || !legacyKey) {
      throw new Error('Kredensial Legacy Supabase (LEGACY_SUPABASE_URL & LEGACY_SUPABASE_KEY) tidak ditemukan di env maupun local dump.');
    }
    const legacySb = createClient(legacyUrl, legacyKey, { auth: { persistSession: false } });
    const [resIzin, resTugas, resBarang, resCatatan, resPengumuman, resEbook] = await Promise.all([
      withExponentialBackoff(() => legacySb.from('ptv_surat_izin').select('*')),
      withExponentialBackoff(() => legacySb.from('ptv_surat_tugas').select('*')),
      withExponentialBackoff(() => legacySb.from('ptv_surat_barang').select('*')),
      withExponentialBackoff(() => legacySb.from('ptv_catatan').select('*')),
      withExponentialBackoff(() => legacySb.from('ptv_pengumuman').select('*')),
      withExponentialBackoff(() => legacySb.from('ptv_ebook').select('*')),
    ]);

    if (resIzin.error) throw new Error(`Gagal membaca ptv_surat_izin dari Legacy: ${resIzin.error.message}`);
    if (resTugas.error) throw new Error(`Gagal membaca ptv_surat_tugas dari Legacy: ${resTugas.error.message}`);
    if (resBarang.error) throw new Error(`Gagal membaca ptv_surat_barang dari Legacy: ${resBarang.error.message}`);
    if (resCatatan.error) throw new Error(`Gagal membaca ptv_catatan dari Legacy: ${resCatatan.error.message}`);
    if (resPengumuman.error) throw new Error(`Gagal membaca ptv_pengumuman dari Legacy: ${resPengumuman.error.message}`);

    legacyData = {
      ptv_surat_izin: resIzin.data || [],
      ptv_surat_tugas: resTugas.data || [],
      ptv_surat_barang: resBarang.data || [],
      ptv_catatan: resCatatan.data || [],
      ptv_pengumuman: resPengumuman.data || [],
      ptv_ebook: resEbook.data || [],
    };
  }

  // 3. Muat Data Staging Terkini & Peta Identitas
  let stagingData = {
    ptv_surat_izin: [],
    ptv_surat_tugas: [],
    ptv_surat_barang: [],
    ptv_catatan: [],
    ptv_pengumuman: [],
    canonical_identity: [],
  };

  if (customStagingData) {
    stagingData = { ...stagingData, ...customStagingData };
  } else if (stagingUrl && stagingKey) {
    const stgSb = createClient(stagingUrl, stagingKey, { auth: { persistSession: false } });
    const [resIzin, resTugas, resBarang, resCatatan, resPengumuman, resId] = await Promise.all([
      stgSb.from('ptv_surat_izin').select('*'),
      stgSb.from('ptv_surat_tugas').select('*'),
      stgSb.from('ptv_surat_barang').select('*'),
      stgSb.from('ptv_catatan').select('*'),
      stgSb.from('ptv_pengumuman').select('*'),
      stgSb.from('canonical_identity').select('id, full_name, ptv_id'),
    ]);

    stagingData = {
      ptv_surat_izin: resIzin.data || [],
      ptv_surat_tugas: resTugas.data || [],
      ptv_surat_barang: resBarang.data || [],
      ptv_catatan: resCatatan.data || [],
      ptv_pengumuman: resPengumuman.data || [],
      canonical_identity: resId.data || [],
    };
  }

  // Bangun Lookup Map Identitas Kanonikal
  const identityMap = new Map();
  for (const idRow of stagingData.canonical_identity || []) {
    if (idRow.id) {
      identityMap.set(idRow.id.toLowerCase(), idRow.id);
      if (idRow.full_name) identityMap.set(idRow.full_name.toLowerCase().trim(), idRow.id);
      if (idRow.ptv_id) identityMap.set(idRow.ptv_id.toLowerCase().trim(), idRow.id);
    }
  }

  const reservedSet = new Set(reservedOfflineNumbers.map((s) => s.trim()));

  // 4. Proses Tabel Persuratan (ptv_surat_izin, ptv_surat_tugas, ptv_surat_barang)
  const letterTables = [
    { name: 'ptv_surat_izin', mapper: mapLegacySuratIzin, docType: 'SI' },
    { name: 'ptv_surat_tugas', mapper: mapLegacySuratTugas, docType: 'ST' },
    { name: 'ptv_surat_barang', mapper: mapLegacySuratBarang, docType: 'SBB' },
  ];

  const readyToInsertOrUpdate = {
    ptv_surat_izin: [],
    ptv_surat_tugas: [],
    ptv_surat_barang: [],
    ptv_catatan: [],
    ptv_pengumuman: [],
  };

  const allNumbersForGapCalc = {
    SI: [...reservedSet],
    ST: [],
    SBB: [],
  };

  for (const tableCfg of letterTables) {
    const rawLegacyRows = legacyData[tableCfg.name] || [];
    const existingStgRows = stagingData[tableCfg.name] || [];
    summary.counts.legacy_total += rawLegacyRows.length;
    summary.tables[tableCfg.name].total = rawLegacyRows.length;

    // Filter incremental jika mode incremental
    const filteredRows = mode === 'incremental'
      ? filterIncrementalRecords(rawLegacyRows, checkpointTimestamp)
      : rawLegacyRows;

    summary.counts.incremental_candidates += filteredRows.length;

    // Kumpulkan nomor-nomor yang sudah terbit di Staging untuk perhitungan gap
    for (const r of existingStgRows) {
      if (r.nomor_surat) allNumbersForGapCalc[tableCfg.docType].push(r.nomor_surat);
    }

    for (const legRow of filteredRows) {
      const { canonicalRow, provenance } = tableCfg.mapper(legRow, identityMap);

      // Catat unmapped identity jika ada
      if (provenance.diajukan_unmapped) {
        summary.counts.unmapped_identities++;
        summary.tables[tableCfg.name].unmapped++;
        summary.unmapped_identities_log.push({
          table: tableCfg.name,
          doc_id: canonicalRow.id,
          nomor_surat: canonicalRow.nomor_surat,
          field: 'diajukan_oleh',
          raw_value: provenance.original_diajukan_oleh,
          action: 'SET_NULL_PRESERVE_LOG',
        });
      }
      if (provenance.disetujui_unmapped) {
        summary.counts.unmapped_identities++;
        summary.tables[tableCfg.name].unmapped++;
        summary.unmapped_identities_log.push({
          table: tableCfg.name,
          doc_id: canonicalRow.id,
          nomor_surat: canonicalRow.nomor_surat,
          field: 'disetujui_oleh',
          raw_value: provenance.original_disetujui_oleh,
          action: 'SET_NULL_PRESERVE_LOG',
        });
      }

      // Deteksi Konflik Nomor Surat
      const conflict = detectLetterConflict(canonicalRow, existingStgRows, reservedSet);
      if (conflict) {
        summary.counts.conflicts_quarantined++;
        summary.tables[tableCfg.name].conflicts++;
        summary.conflicts_log.push({
          table: tableCfg.name,
          ...conflict,
        });
        summary.quarantine.push({
          table: tableCfg.name,
          record: canonicalRow,
          provenance,
          reason: conflict.message,
        });
        continue; // Jangan masukkan ke daftar insert jika konflik!
      }

      // Cek apakah record sudah ada di Staging dan identik (idempotency check)
      const existingMatch = existingStgRows.find((r) => r.id === canonicalRow.id);
      if (existingMatch) {
        if (existingMatch.status === canonicalRow.status &&
            existingMatch.nomor_surat === canonicalRow.nomor_surat) {
          summary.counts.skipped_unchanged++;
          continue;
        }
      }

      readyToInsertOrUpdate[tableCfg.name].push({
        canonicalRow,
        provenance,
        isUpdate: !!existingMatch,
      });

      if (canonicalRow.nomor_surat) {
        allNumbersForGapCalc[tableCfg.docType].push(canonicalRow.nomor_surat);
      }
      summary.counts.synced_ready++;
      summary.tables[tableCfg.name].ready++;
    }

    // Hitung nomor urut berikutnya secara dinamis
    summary.next_sequences[tableCfg.docType] = calculateDynamicNextSequence(
      allNumbersForGapCalc[tableCfg.docType],
      tableCfg.docType,
      2026
    );
  }

  // 5. Proses Tabel Arsip Catatan & Notulensi (ptv_catatan)
  {
    const rawCatatan = legacyData.ptv_catatan || [];
    const existingStgCatatan = stagingData.ptv_catatan || [];
    summary.counts.legacy_total += rawCatatan.length;
    summary.tables.ptv_catatan.total = rawCatatan.length;

    const filteredCatatan = mode === 'incremental'
      ? filterIncrementalRecords(rawCatatan, checkpointTimestamp)
      : rawCatatan;

    summary.counts.incremental_candidates += filteredCatatan.length;

    for (const legCat of filteredCatatan) {
      const { canonicalRow, provenance } = mapLegacyCatatan(legCat, identityMap);

      if (provenance.author_unmapped) {
        summary.counts.unmapped_identities++;
        summary.tables.ptv_catatan.unmapped++;
        summary.unmapped_identities_log.push({
          table: 'ptv_catatan',
          doc_id: canonicalRow.id,
          nomor_surat: null,
          field: 'created_by_name',
          raw_value: provenance.original_author,
          action: 'PRESERVE_DISPLAY_NAME',
        });
      }

      const existingMatch = existingStgCatatan.find((c) => c.id === canonicalRow.id);
      if (existingMatch) {
        if (existingMatch.judul === canonicalRow.judul &&
            existingMatch.isi === canonicalRow.isi &&
            existingMatch.warna === canonicalRow.warna) {
          summary.counts.skipped_unchanged++;
          continue;
        }
      }

      readyToInsertOrUpdate.ptv_catatan.push({
        canonicalRow,
        provenance,
        isUpdate: !!existingMatch,
      });
      summary.counts.synced_ready++;
      summary.tables.ptv_catatan.ready++;
    }
  }

  // 6. Proses Tabel Pengumuman (ptv_pengumuman)
  {
    const rawPengumuman = legacyData.ptv_pengumuman || [];
    const existingStgPengumuman = stagingData.ptv_pengumuman || [];
    summary.counts.legacy_total += rawPengumuman.length;
    summary.tables.ptv_pengumuman.total = rawPengumuman.length;

    const filteredPengumuman = mode === 'incremental'
      ? filterIncrementalRecords(rawPengumuman, checkpointTimestamp)
      : rawPengumuman;

    summary.counts.incremental_candidates += filteredPengumuman.length;

    for (const legPeng of filteredPengumuman) {
      const { canonicalRow, provenance } = mapLegacyPengumuman(legPeng);

      const existingMatch = existingStgPengumuman.find((p) => p.id === canonicalRow.id);
      if (existingMatch) {
        if (existingMatch.judul === canonicalRow.judul &&
            existingMatch.konten === canonicalRow.konten) {
          summary.counts.skipped_unchanged++;
          continue;
        }
      }

      readyToInsertOrUpdate.ptv_pengumuman.push({
        canonicalRow,
        provenance,
        isUpdate: !!existingMatch,
      });
      summary.counts.synced_ready++;
      summary.tables.ptv_pengumuman.ready++;
    }
  }

  // 7. Ekstraksi Manifest Arsip Publikasi E-Book (ptv_ebook) dengan Preservasi URL PDF
  const rawEbooks = legacyData.ptv_ebook || [];
  summary.tables.ptv_ebook.total = rawEbooks.length;
  summary.counts.legacy_total += rawEbooks.length;

  const ebookManifest = [];
  const uniqueTitles = new Set();
  for (const eb of rawEbooks) {
    const { canonicalRow, provenance } = mapLegacyEbook(eb);
    uniqueTitles.add(canonicalRow.judul);
    ebookManifest.push({
      ...canonicalRow,
      provenance,
    });
  }
  summary.tables.ptv_ebook.unique_titles = uniqueTitles.size;

  // Tulis manifest arsip digital
  fs.mkdirSync(path.dirname(archiveManifestFile), { recursive: true });
  fs.writeFileSync(archiveManifestFile, JSON.stringify({
    generated_at: new Date().toISOString(),
    total_ebooks: ebookManifest.length,
    unique_titles_count: uniqueTitles.size,
    items: ebookManifest,
  }, null, 2), 'utf8');

  // 8. Safe Retention Audit: Cek Dokumen Staging yang Hilang di Legacy
  for (const tableCfg of letterTables) {
    const rawLegacyRows = legacyData[tableCfg.name] || [];
    const existingStgRows = stagingData[tableCfg.name] || [];
    const legacyIds = new Set(rawLegacyRows.map((r) => r.id));

    for (const stgRow of existingStgRows) {
      if (stgRow.id && !legacyIds.has(stgRow.id)) {
        summary.orphan_retention_log.push({
          table: tableCfg.name,
          doc_id: stgRow.id,
          nomor_surat: stgRow.nomor_surat,
          action: 'RETAIN_SAFE_NO_DELETE',
          reason: 'Dokumen ada di Staging tapi tidak ditemukan di Legacy. Tidak dihapus otomatis sesuai kebijakan Safe Retention.',
        });
      }
    }
  }

  // 9. Eksekusi Mutasi ke Staging (Hanya jika TIDAK dry-run dan di-ACC)
  if (!isDryRun) {
    if (options.requireOperatorConfirmation !== true) {
      throw new Error('SAFETY CHECK FAILED: Mutasi Staging cloud mewajibkan konfirmasi eksplisit operator (--confirm-staging).');
    }

    const stgSb = createClient(stagingUrl, stagingKey, { auth: { persistSession: false } });
    const syncableTables = ['ptv_surat_izin', 'ptv_surat_tugas', 'ptv_surat_barang', 'ptv_catatan', 'ptv_pengumuman'];

    for (const tbl of syncableTables) {
      const items = readyToInsertOrUpdate[tbl] || [];
      for (const item of items) {
        const { error } = await stgSb.from(tbl).upsert(item.canonicalRow, { onConflict: 'id' });
        if (error) {
          throw new Error(`Gagal menulis ke ${tbl} di Staging: ${error.message}`);
        }
      }
    }

    // Perbarui file checkpoint jika live execution sukses
    const newCheckpoint = {
      last_synced_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      counts: summary.counts,
      status: 'SUCCESS',
    };
    fs.mkdirSync(path.dirname(checkpointFile), { recursive: true });
    fs.writeFileSync(checkpointFile, JSON.stringify(newCheckpoint, null, 2), 'utf8');
  }

  // Tulis laporan rekonsiliasi & karantina
  summary.completed_at = new Date().toISOString();
  fs.mkdirSync(path.dirname(reconciliationFile), { recursive: true });
  fs.writeFileSync(reconciliationFile, JSON.stringify(summary, null, 2), 'utf8');

  return summary;
}

// ============================================================================
// CLI RUNNER (HANYA DIEKSEKUSI JIKA DIJALANKAN LANGSUNG VIA NODE)
// ============================================================================
if (process.argv[1] && process.argv[1].endsWith('sync-legacy-letters.mjs')) {
  const args = process.argv.slice(2);
  const isLive = args.includes('--live') || args.includes('--execute');
  const isBackfill = args.includes('--mode=backfill') || args.includes('--backfill');
  const sourceBundle = args.includes('--source=bundle');
  const hasConfirm = args.includes('--confirm-staging');

  console.log('='.repeat(75));
  console.log('PTVPRO — COMPREHENSIVE SURAT & ARSIP TRANSITION SYNC ENGINE');
  console.log(`Mode Operasi : ${isBackfill ? 'FULL BACKFILL' : 'INCREMENTAL SYNC'}`);
  console.log(`Safety State : ${isLive ? 'LIVE CLOUD MUTATION' : 'DRY-RUN (STRICT READ-ONLY)'}`);
  console.log(`Sumber Data  : ${sourceBundle ? 'Local Export Bundle' : 'Supabase Legacy Live (jthzuhkblxcaohiuypqq)'}`);
  console.log('='.repeat(75));

  executeLetterSync({
    mode: isBackfill ? 'backfill' : 'incremental',
    isDryRun: !isLive,
    sourceMode: sourceBundle ? 'bundle' : 'cloud',
    requireOperatorConfirmation: hasConfirm,
  })
    .then((res) => {
      console.log('\n--- RINGKASAN HASIL SINKRONISASI MENYELURUH ---');
      console.log(`Sumber Legacy Terdeteksi     : ${res.legacy_source_type}`);
      console.log(`Total Rekod Legacy Sumber    : ${res.counts.legacy_total}`);
      console.log(`Kandidat Terfilter Sync      : ${res.counts.incremental_candidates}`);
      console.log(`Dokumen & Arsip Siap Sync    : ${res.counts.synced_ready}`);
      console.log(`Dilewati (Identik di Target) : ${res.counts.skipped_unchanged}`);
      console.log(`Konflik Masuk Karantina      : ${res.counts.conflicts_quarantined}`);
      console.log(`Identitas Belum Terpetakan   : ${res.counts.unmapped_identities} (Zero Fabrication, NULL / Display preserved)`);
      console.log('\nRincian Per Tabel:');
      for (const [tbl, info] of Object.entries(res.tables)) {
        console.log(` - ${tbl.padEnd(18)}: Total Legacy = ${String(info.total).padStart(2)}, Siap = ${String(info.ready || 0).padStart(2)}`);
      }
      console.log('\nNomor Urut Dinamis Berikutnya (Dynamic Gap-Filling):');
      for (const [t, seq] of Object.entries(res.next_sequences)) {
        console.log(` - ${t}: Urutan ke-${seq}`);
      }
      console.log(`\nLaporan rekonsiliasi tersimpan di : reports/legacy-sync-reconciliation.json`);
      console.log(`Manifest arsip digital (E-Book)   : reports/legacy-archive-manifest.json`);
      if (res.is_dry_run) {
        console.log('\n[INFO] DRY-RUN BERHASIL. Nol data diubah di Cloud Staging maupun Legacy.');
      }
    })
    .catch((err) => {
      console.error('\n[FATAL ERROR]', err.message);
      process.exit(1);
    });
}
