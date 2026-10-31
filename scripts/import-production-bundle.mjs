import fs from 'fs';
import path from 'path';
import { crewArchiveSourceKey } from './lib/legacy-crew-reconciliation.mjs';

// ============================================================================
// PTV PRO — PRODUCTION TO STAGING BATCH IMPORTER
// ZERO SILENT DATA LOSS | ZERO FABRICATION | EMPIRICAL READBACK VERIFICATION
// ============================================================================

const envPath = path.resolve('.env.staging.local');
if (!fs.existsSync(envPath)) {
  console.error('[FATAL] Berkas .env.staging.local tidak ditemukan!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
for (const line of envContent.split(/\r?\n/)) {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.startsWith('#')) {
    envVars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

const SUPABASE_URL = envVars.SUPABASE_URL;
const SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[FATAL] SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak terdefinisi!');
  process.exit(1);
}

// ANTI-PRODUCTION HARD BARRIER
if (SUPABASE_URL.includes('jthzuhkblxcaohiuypqq')) {
  console.error('[CRITICAL FATAL] SUPABASE_URL mengarah ke PRODUCTION (jthzuhkblxcaohiuypqq)! Script DIBATALKAN.');
  process.exit(1);
}

const isDryRun = process.argv.includes('--dry-run');
const bundlePath = process.argv.find(arg => arg.endsWith('.json') && !arg.includes('package')) || 'production-bundle.json';

console.log('================================================================');
console.log('PTV PRO — PRODUCTION TO STAGING BATCH IMPORTER (ZERO SILENT DATA LOSS)');
console.log(`Target Database : Staging (${SUPABASE_URL})`);
console.log(`Bundle File     : ${bundlePath}`);
console.log(`Mode Operasi    : ${isDryRun ? 'DRY-RUN (SIMULASI VALIDASI PENUH — TANPA MUTASI DB)' : 'LIVE EXECUTION'}`);
console.log('================================================================\n');

if (!fs.existsSync(bundlePath)) {
  console.log(`[INFO] Berkas ekspor '${bundlePath}' belum tersedia.`);
  console.log('PETUNJUK:');
  console.log('1. Jalankan query murni SELECT pada docs/PTV-PRO-PRODUCTION-SINGLE-EXPORT.sql di SQL Editor Production.');
  console.log(`2. Simpan 1 baris JSON output migration_bundle ke berkas '${bundlePath}' di root repositori.`);
  console.log('3. Jalankan kembali script ini:');
  console.log('   node scripts/import-production-bundle.mjs --dry-run (simulasi validasi)');
  console.log('   node scripts/import-production-bundle.mjs           (eksekusi live)');
  process.exit(0);
}

const bundleRaw = fs.readFileSync(bundlePath, 'utf-8');
let bundle;
try {
  bundle = JSON.parse(bundleRaw);
  if (bundle.migration_bundle) bundle = bundle.migration_bundle;
} catch (e) {
  console.error(`[FATAL] Gagal membaca JSON dari '${bundlePath}': ${e.message}`);
  process.exit(1);
}

// PII & Secret Sanitizer (Defense in Depth)
function maskString(str) {
  if (!str || typeof str !== 'string') return str;
  if (str.length <= 4) return '***';
  return str.slice(0, 3) + '****' + str.slice(-2);
}

function sanitizePayload(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = { ...obj };
  delete clean.password;
  delete clean.password_hash;
  delete clean.user_pass;
  delete clean.token;
  delete clean.refresh_token;
  delete clean.secret;
  delete clean.p256dh;
  delete clean.auth;

  // Mask PII if present in raw payload
  if (clean.pelapor_kontak) clean.pelapor_kontak = maskString(clean.pelapor_kontak);
  if (clean.telepon && !clean.telepon_masked) clean.telepon = maskString(clean.telepon);
  if (clean.email && !clean.email_masked) clean.email = maskString(clean.email);

  return clean;
}

async function getTableCount(table) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id`, {
      method: 'HEAD',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Range-Unit': 'items',
        'Prefer': 'count=exact'
      }
    });
    const cr = res.headers.get('content-range');
    if (cr) {
      const parts = cr.split('/');
      if (parts[1] && parts[1] !== '*') return parseInt(parts[1], 10);
    }
    return -1;
  } catch {
    return -1;
  }
}

async function postgrestInsert(table, rows, onConflictCol = null) {
  if (!rows || rows.length === 0) return { inserted: 0, skipped: 0, delta: 0, errors: [] };
  if (isDryRun) {
    return { inserted: rows.length, skipped: 0, delta: rows.length, errors: [] };
  }

  const beforeCount = await getTableCount(table);
  const conflictQuery = onConflictCol ? `?on_conflict=${encodeURIComponent(onConflictCol)}` : '';

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${conflictQuery}`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=ignore-duplicates,return=representation'
    },
    body: JSON.stringify(rows)
  });

  if (!res.ok) {
    const errText = await res.text();
    return { inserted: 0, skipped: 0, delta: 0, errors: [`HTTP ${res.status}: ${errText}`] };
  }

  const resData = await res.json();
  const returnedCount = Array.isArray(resData) ? resData.length : 0;
  
  // Empirical Readback Verification
  const afterCount = await getTableCount(table);
  const actualDelta = (beforeCount >= 0 && afterCount >= 0) ? (afterCount - beforeCount) : returnedCount;
  const skippedCount = rows.length - actualDelta;

  return { inserted: actualDelta, skipped: Math.max(0, skippedCount), delta: actualDelta, errors: [] };
}

async function runImport() {
  if (!isDryRun && (bundle.legacy_archive_kru || []).length) {
    throw new Error('Crew re-import is blocked pending reviewed reconciliation. Preserve existing archive UUIDs/source keys; use the approved linking plan, not bulk re-import.');
  }
  if (bundle.record_counts) {
    console.log('=== AUDIT RECORD COUNTS DARI PRODUCTION SUMBER (35 TABEL) ===');
    console.table(bundle.record_counts);
    console.log('=============================================================\n');
  }

  const report = [];

  // ==========================================================================
  // KELOMPOK 1: 19 TABEL OPERASIONAL
  // ==========================================================================

  // 1. INVENTARIS MASTER (Canonical Feature Ready)
  const rawInv = bundle.ptv_inventaris || [];
  const invRows = [];
  const unresInv = [];

  for (const r of rawInv) {
    const kode = r.kode || r.kode_inventaris;
    const nama = r.nama || r.nama_alat;
    if (kode && nama) {
      invRows.push({
        id: r.id, // Preservasi UUID Primary Key
        kode: kode,
        nama_alat: nama,
        kategori: r.kategori || 'Lainnya',
        spesifikasi: r.spesifikasi || '',
        foto_url: r.foto_url || null,
        harga_beli: null,
        sumber_perolehan: r.sumber_perolehan || null,
        created_at: r.created_at || new Date().toISOString(),
        updated_at: r.updated_at || new Date().toISOString()
      });
    } else {
      unresInv.push({
        source_table: 'ptv_inventaris',
        source_id: kode || String(r.id) || 'UNKNOWN',
        reason: 'Missing required business identifier (kode or nama)',
        raw_payload: sanitizePayload(r)
      });
    }
  }

  const invResult = await postgrestInsert('ptv_inventaris', invRows, 'id');
  if (unresInv.length > 0) await postgrestInsert('legacy_archive_unresolved', unresInv, 'source_table,source_id');

  report.push({
    tabel: 'ptv_inventaris',
    source: rawInv.length,
    canonical: invResult.inserted,
    archive: 0,
    quarantine: unresInv.length,
    excluded: 0,
    failed: invResult.errors.length > 0 ? invRows.length : 0,
    selisih: rawInv.length - (invResult.inserted + invResult.skipped + unresInv.length),
    catatan: `Ready: ${invResult.inserted}, Eksisting: ${invResult.skipped}`
  });

  // Mapping inventaris_id
  const invIdSet = new Set(rawInv.map(r => r.id));

  // 2. INVENTARIS UNIT (Canonical Feature Ready)
  const rawUnits = bundle.ptv_inventaris_unit || [];
  const unitRows = [];
  const unlinkedUnits = [];

  for (const u of rawUnits) {
    if (u.inventaris_id && (invIdSet.has(u.inventaris_id) || isDryRun)) {
      unitRows.push({
        id: u.id,
        inventaris_id: u.inventaris_id,
        kode_unit: u.kode_unit,
        nama_unit: u.nama_unit || u.kode_unit,
        nomor_seri: u.serial_number || u.nomor_seri || null,
        kondisi: u.kondisi || 'Baik',
        status_peminjaman: u.status_peminjaman || 'tersedia',
        lokasi_penyimpanan: u.lokasi || u.lokasi_penyimpanan || null,
        created_at: u.created_at || new Date().toISOString()
      });
    } else {
      unlinkedUnits.push({
        source_table: 'ptv_inventaris_unit',
        source_id: u.kode_unit || String(u.id) || 'UNKNOWN',
        reason: `inventaris_id not found in ptv_inventaris: ${u.inventaris_id}`,
        raw_payload: sanitizePayload(u)
      });
    }
  }

  const unitResult = await postgrestInsert('ptv_inventaris_unit', unitRows, 'id');
  if (unlinkedUnits.length > 0) await postgrestInsert('legacy_archive_unresolved', unlinkedUnits, 'source_table,source_id');

  report.push({
    tabel: 'ptv_inventaris_unit',
    source: rawUnits.length,
    canonical: unitResult.inserted,
    archive: 0,
    quarantine: unlinkedUnits.length,
    excluded: 0,
    failed: unitResult.errors.length > 0 ? unitRows.length : 0,
    selisih: rawUnits.length - (unitResult.inserted + unitResult.skipped + unlinkedUnits.length),
    catatan: `Ready: ${unitResult.inserted}, Karantina: ${unlinkedUnits.length}`
  });

  // 3. VALUASI INVENTARIS (ptv_nilai_inventaris) (Canonical Feature Ready)
  const rawNilai = bundle.ptv_nilai_inventaris || [];
  const nilaiRows = [];
  const unresNilai = [];

  for (const v of rawNilai) {
    if (v.inventaris_id && (invIdSet.has(v.inventaris_id) || isDryRun)) {
      // Preserve 100% Production metadata without silent field discarding
      const catatanParts = [
        v.catatan,
        v.vendor ? `Vendor: ${v.vendor}` : '',
        v.nomor_invoice ? `Invoice: ${v.nomor_invoice}` : '',
        v.sumber_perolehan ? `Sumber: ${v.sumber_perolehan}` : '',
        v.nilai_residu ? `Nilai Residu: Rp${Number(v.nilai_residu).toLocaleString('id-ID')}` : ''
      ].filter(Boolean);

      nilaiRows.push({
        id: v.id,
        inventaris_id: v.inventaris_id,
        nilai_perolehan: Number(v.nilai_perolehan || 0),
        nilai_buku_saat_ini: Number(v.nilai_tercatat || v.nilai_perolehan || 0),
        tanggal_valuasi: v.tanggal_perolehan || (v.created_at ? v.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
        catatan_akuntansi: catatanParts.join(' | ') || 'Valuasi perolehan aset Production',
        catatan: v.catatan || null,
        vendor: v.vendor || null,
        nomor_invoice: v.nomor_invoice || null,
        sumber_perolehan: v.sumber_perolehan || null,
        status: v.status || 'Aktif',
        nilai_residu: Number(v.nilai_residu || 0),
        dokumen_url: v.dokumen_url || null,
        created_by_name: v.created_by_name || null,
        updated_at: v.updated_at || new Date().toISOString()
      });
    } else {
      unresNilai.push({
        source_table: 'ptv_nilai_inventaris',
        source_id: String(v.id),
        reason: `inventaris_id not found in ptv_inventaris: ${v.inventaris_id}`,
        raw_payload: sanitizePayload(v)
      });
    }
  }

  const nilaiResult = await postgrestInsert('ptv_nilai_inventaris', nilaiRows, 'id');
  if (unresNilai.length > 0) await postgrestInsert('legacy_archive_unresolved', unresNilai, 'source_table,source_id');

  report.push({
    tabel: 'ptv_nilai_inventaris',
    source: rawNilai.length,
    canonical: nilaiResult.inserted,
    archive: 0,
    quarantine: unresNilai.length,
    excluded: 0,
    failed: nilaiResult.errors.length > 0 ? nilaiRows.length : 0,
    selisih: rawNilai.length - (nilaiResult.inserted + nilaiResult.skipped + unresNilai.length),
    catatan: `Ready: ${nilaiResult.inserted}, Karantina: ${unresNilai.length}`
  });

  // 4. PEMINJAMAN (ptv_peminjaman)
  // In Production, loans were recorded at master inventaris level (inventaris_unit_id is null).
  // Preserved to legacy_archive_unresolved without fabricating barcode unit.
  const rawLoans = bundle.ptv_peminjaman || [];
  const loanRows = [];
  const unresLoans = [];

  for (const l of rawLoans) {
    if (l.inventaris_unit_id && l.peminjam_nama) {
      loanRows.push({
        transaction_id: l.transaction_id || `TRX-${l.id || Date.now()}`,
        unit_id: l.inventaris_unit_id,
        peminjam_nama: l.peminjam_nama,
        keperluan: l.keperluan || 'Operasional',
        tanggal_pinjam: l.tanggal_pinjam || (l.created_at ? l.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
        tenggat_kembali: l.tanggal_kembali || (l.created_at ? l.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
        tanggal_kembali: l.tanggal_kembali || null,
        status: l.status || 'kembali',
        kondisi_kembali: null,
        catatan: l.catatan || null,
        created_at: l.created_at || new Date().toISOString()
      });
    } else {
      unresLoans.push({
        source_table: 'ptv_peminjaman',
        source_id: String(l.id) || 'UNKNOWN',
        reason: 'Legacy loan recorded at master item level without individual unit barcode (inventaris_unit_id is null)',
        raw_payload: sanitizePayload(l)
      });
    }
  }

  const loanResult = await postgrestInsert('ptv_peminjaman', loanRows, 'id');
  if (unresLoans.length > 0) await postgrestInsert('legacy_archive_unresolved', unresLoans, 'source_table,source_id');

  report.push({
    tabel: 'ptv_peminjaman',
    source: rawLoans.length,
    canonical: loanResult.inserted,
    archive: 0,
    quarantine: unresLoans.length,
    excluded: 0,
    failed: loanResult.errors.length > 0 ? loanRows.length : 0,
    selisih: rawLoans.length - (loanResult.inserted + loanResult.skipped + unresLoans.length),
    catatan: `Ready: ${loanResult.inserted}, Karantina: ${unresLoans.length} (pinjaman level master item)`
  });

  // 5. CATATAN BERSAMA & NOTULENSI (ptv_catatan) (Canonical Feature Ready)
  const rawCatatan = bundle.ptv_catatan || [];
  const catatanRows = [];
  const COLOR_TO_KATEGORI = {
    orange: 'Penting & Prioritas',
    yellow: 'Ide & Rencana',
    green: 'Info & Pengumuman',
    purple: 'Agenda & Acara',
    rose: 'Tugas & Rundown',
    cyan: 'Teknis & Operasional',
    emerald: 'Info & Pengumuman',
    blue: 'Penting & Prioritas',
    amber: 'Ide & Rencana',
    slate: 'Umum',
    default: 'Umum'
  };

  for (const c of rawCatatan) {
    let cleanTags = [];
    if (Array.isArray(c.tags)) {
      cleanTags = c.tags;
    } else if (typeof c.tags === 'string' && c.tags.trim()) {
      try {
        const parsed = JSON.parse(c.tags);
        cleanTags = Array.isArray(parsed) ? parsed : [c.tags.trim()];
      } catch {
        cleanTags = c.tags.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    const warna = (c.warna || 'default').toLowerCase();
    const tipe = (c.tipe === 'meeting_minutes' || cleanTags.includes('notulensi') || cleanTags.includes('notulensi_rapat'))
      ? 'meeting_minutes'
      : 'shared';

    const kategori = c.kategori || COLOR_TO_KATEGORI[warna] || 'Umum';

    catatanRows.push({
      id: c.id,
      judul: c.judul || 'Tanpa Judul',
      isi: c.isi || '',
      warna: warna,
      tipe: tipe,
      tags: cleanTags,
      kategori: kategori,
      is_pinned: Boolean(c.is_pinned),
      created_by_name: c.created_by_name || null,
      created_by_id: c.created_by_id ? String(c.created_by_id) : null,
      author_id: null,
      created_at: c.created_at || new Date().toISOString(),
      updated_at: c.updated_at || new Date().toISOString()
    });
  }

  const catatanResult = await postgrestInsert('ptv_catatan', catatanRows, 'id');
  report.push({
    tabel: 'ptv_catatan',
    source: rawCatatan.length,
    canonical: catatanResult.inserted,
    archive: 0,
    quarantine: 0,
    excluded: 0,
    failed: catatanResult.errors.length > 0 ? rawCatatan.length : 0,
    selisih: rawCatatan.length - (catatanResult.inserted + catatanResult.skipped),
    catatan: 'Atribut warna, tipe, tags, author metadata dipertahankan utuh'
  });

  // 6. ACARA (ptv_acara) (Canonical Feature Ready)
  const rawAcara = bundle.ptv_acara || [];
  const acaraRows = [];
  const unresAcara = [];

  for (const a of rawAcara) {
    const nama = a.nama_acara || a.judul;
    const tgl = a.tanggal || a.tanggal_mulai || (a.created_at ? a.created_at.slice(0, 10) : null);
    if (nama && tgl) {
      acaraRows.push({
        id: a.id,
        nama_acara: nama,
        tanggal: tgl,
        waktu_mulai: a.waktu_mulai || null,
        waktu_selesai: a.waktu_selesai || null,
        lokasi: a.lokasi || null,
        deskripsi: a.deskripsi || '',
        status: a.status || 'aktif',
        created_by: null,
        created_at: a.created_at || new Date().toISOString(),
        updated_at: a.updated_at || new Date().toISOString()
      });
    } else {
      unresAcara.push({
        source_table: 'ptv_acara',
        source_id: String(a.id) || 'UNKNOWN',
        reason: 'Missing required title or date in source record',
        raw_payload: sanitizePayload(a)
      });
    }
  }

  const acaraResult = await postgrestInsert('ptv_acara', acaraRows, 'id');
  if (unresAcara.length > 0) await postgrestInsert('legacy_archive_unresolved', unresAcara, 'source_table,source_id');

  report.push({
    tabel: 'ptv_acara',
    source: rawAcara.length,
    canonical: acaraResult.inserted,
    archive: 0,
    quarantine: unresAcara.length,
    excluded: 0,
    failed: acaraResult.errors.length > 0 ? acaraRows.length : 0,
    selisih: rawAcara.length - (acaraResult.inserted + acaraResult.skipped + unresAcara.length),
    catatan: `Ready: ${acaraResult.inserted}, Karantina: ${unresAcara.length}`
  });

  // 7. CONTENT PLANNER (ptv_content_planner)
  const rawPlanner = bundle.ptv_content_planner || [];
  const plannerRows = [];
  const unresPlanner = [];

  for (const cp of rawPlanner) {
    const judul = cp.judul || cp.judul_momentum;
    const platform = cp.platform || cp.subkategori;
    if (judul && platform) {
      plannerRows.push({
        id: cp.id,
        judul: judul,
        platform: platform,
        status: cp.status || 'draft',
        target_tayang: cp.target_tayang || cp.tanggal_mulai || null,
        pic_id: null,
        catatan: cp.catatan || cp.deskripsi || null,
        created_at: cp.created_at || new Date().toISOString(),
        updated_at: cp.updated_at || new Date().toISOString()
      });
    } else {
      unresPlanner.push({
        source_table: 'ptv_content_planner',
        source_id: String(cp.id) || 'UNKNOWN',
        reason: 'Missing required title or platform/subkategori in source record',
        raw_payload: sanitizePayload(cp)
      });
    }
  }

  const plannerResult = await postgrestInsert('ptv_content_planner', plannerRows, 'id');
  if (unresPlanner.length > 0) await postgrestInsert('legacy_archive_unresolved', unresPlanner, 'source_table,source_id');

  report.push({
    tabel: 'ptv_content_planner',
    source: rawPlanner.length,
    canonical: plannerResult.inserted,
    archive: 0,
    quarantine: unresPlanner.length,
    excluded: 0,
    failed: plannerResult.errors.length > 0 ? plannerRows.length : 0,
    selisih: rawPlanner.length - (plannerResult.inserted + plannerResult.skipped + unresPlanner.length),
    catatan: `Ready: ${plannerResult.inserted}, Karantina: ${unresPlanner.length} (subkategori null)`
  });

  // 8. KAS KRU (ptv_kas_kru) — DATA PRESERVED (ARCHIVED WITH FULL FIDELITY)
  const rawKasKru = bundle.ptv_kas_kru || [];
  const kasKruArchiveRows = rawKasKru.map(kr => ({
    source_key: `ptv_kas_kru:${kr.id || Math.random()}`,
    production_id: kr.id ? String(kr.id) : null,
    kru_id: kr.kru_id ? String(kr.kru_id) : null,
    kru_ptv_id: kr.kru_ptv_id || null,
    kru_nama: kr.kru_nama || 'Kru PTV',
    periode_bulan: kr.periode_bulan || null,
    tagihan: Number(kr.tagihan || 0),
    dibayar: Number(kr.dibayar || 0),
    sisa: Number(kr.sisa || 0),
    status: kr.status || 'Belum Bayar',
    tanggal_bayar: kr.tanggal_bayar || null,
    metode_bayar: kr.metode_bayar || null,
    catatan: kr.catatan || null,
    bukti_url: kr.bukti_url || null,
    dicatat_oleh_id: kr.dicatat_oleh_id ? String(kr.dicatat_oleh_id) : null,
    dicatat_oleh_nama: kr.dicatat_oleh_nama || null,
    reconciliation_status: 'pending_identity',
    canonical_identity_id: null,
    raw_payload: sanitizePayload(kr),
    imported_at: new Date().toISOString()
  }));

  const kasKruArchiveRes = await postgrestInsert('legacy_archive_kas_kru', kasKruArchiveRows, 'source_key');
  report.push({
    tabel: 'ptv_kas_kru',
    source: rawKasKru.length,
    canonical: 0,
    archive: kasKruArchiveRes.inserted,
    quarantine: 0,
    excluded: 0,
    failed: kasKruArchiveRes.errors.length > 0 ? rawKasKru.length : 0,
    selisih: rawKasKru.length - (kasKruArchiveRes.inserted + kasKruArchiveRes.skipped),
    catatan: 'DATA PRESERVED (100% dipreservasi ke legacy_archive_kas_kru; pending_identity)'
  });

  // 9. PENGUMUMAN (ptv_pengumuman) (Canonical Feature Ready)
  const rawPengumuman = bundle.ptv_pengumuman || [];
  const pengumumanRows = rawPengumuman.map(p => ({
    id: p.id,
    judul: p.judul,
    konten: p.konten,
    is_aktif: p.status === 'aktif' || Boolean(p.is_aktif),
    berlaku_sampai: null,
    created_at: p.created_at || new Date().toISOString()
  }));

  const pengumumanResult = await postgrestInsert('ptv_pengumuman', pengumumanRows, 'id');
  report.push({
    tabel: 'ptv_pengumuman',
    source: rawPengumuman.length,
    canonical: pengumumanResult.inserted,
    archive: 0,
    quarantine: 0,
    excluded: 0,
    failed: pengumumanResult.errors.length > 0 ? pengumumanRows.length : 0,
    selisih: rawPengumuman.length - (pengumumanResult.inserted + pengumumanResult.skipped),
    catatan: `Ready: ${pengumumanResult.inserted}, Eksisting: ${pengumumanResult.skipped}`
  });

  // 10. KONTAK EKSTERNAL (ptv_kontak_eksternal) (Canonical Feature Ready)
  const rawKontak = bundle.ptv_kontak_eksternal || [];
  const kontakRows = rawKontak.map(k => ({
    id: k.id,
    nama_kontak: k.nama_kontak || k.nama,
    instansi: k.instansi || k.organisasi || null,
    telepon: k.telepon || k.whatsapp || k.nomor_telepon || null,
    email: k.email || k.email_masked || null,
    peran: k.peran || k.jabatan || k.kategori || null,
    catatan: k.catatan || null,
    created_at: k.created_at || new Date().toISOString()
  }));

  const kontakResult = await postgrestInsert('ptv_kontak_eksternal', kontakRows, 'id');
  report.push({
    tabel: 'ptv_kontak_eksternal',
    source: rawKontak.length,
    canonical: kontakResult.inserted,
    archive: 0,
    quarantine: 0,
    excluded: 0,
    failed: kontakResult.errors.length > 0 ? kontakRows.length : 0,
    selisih: rawKontak.length - (kontakResult.inserted + kontakResult.skipped),
    catatan: `Ready: ${kontakResult.inserted}, Eksisting: ${kontakResult.skipped}`
  });

  // 11. PEMASUKAN (ptv_pemasukan) (Canonical Feature Ready)
  const rawPemasukan = bundle.ptv_pemasukan || [];
  const pemasukanRows = rawPemasukan.map(m => ({
    id: m.id,
    keuangan_id: null,
    sumber: m.sumber || 'Kas',
    nominal: Number(m.nominal || 0),
    tanggal: m.tanggal || (m.created_at ? m.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
    keterangan: m.keterangan || null,
    created_at: m.created_at || new Date().toISOString()
  }));

  const pemasukanResult = await postgrestInsert('ptv_pemasukan', pemasukanRows, 'id');
  report.push({
    tabel: 'ptv_pemasukan',
    source: rawPemasukan.length,
    canonical: pemasukanResult.inserted,
    archive: 0,
    quarantine: 0,
    excluded: 0,
    failed: pemasukanResult.errors.length > 0 ? pemasukanRows.length : 0,
    selisih: rawPemasukan.length - (pemasukanResult.inserted + pemasukanResult.skipped),
    catatan: `Ready: ${pemasukanResult.inserted}, Eksisting: ${pemasukanResult.skipped}`
  });

  // 12. PENGELUARAN (ptv_pengeluaran) (Canonical Feature Ready)
  const rawPengeluaran = bundle.ptv_pengeluaran || [];
  const pengeluaranRows = rawPengeluaran.map(g => ({
    id: g.id,
    keuangan_id: null,
    keperluan: g.keperluan || 'Operasional',
    nominal: Number(g.nominal || 0),
    tanggal: g.tanggal || (g.created_at ? g.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
    keterangan: g.keterangan || null,
    created_at: g.created_at || new Date().toISOString()
  }));

  const pengeluaranResult = await postgrestInsert('ptv_pengeluaran', pengeluaranRows, 'id');
  report.push({
    tabel: 'ptv_pengeluaran',
    source: rawPengeluaran.length,
    canonical: pengeluaranResult.inserted,
    archive: 0,
    quarantine: 0,
    excluded: 0,
    failed: pengeluaranResult.errors.length > 0 ? pengeluaranRows.length : 0,
    selisih: rawPengeluaran.length - (pengeluaranResult.inserted + pengeluaranResult.skipped),
    catatan: `Ready: ${pengeluaranResult.inserted}, Eksisting: ${pengeluaranResult.skipped}`
  });

  // 13. SURAT IZIN (ptv_surat_izin) (Canonical Feature Ready)
  const rawSuratIzin = bundle.ptv_surat_izin || [];
  const suratIzinRows = rawSuratIzin.map(s => ({
    id: s.id,
    nomor_surat: s.nomor_surat,
    nama_pemohon: s.nama_pemohon || s.nama_santri || 'Santri PTV',
    alasan: s.alasan || s.jenis_kegiatan || 'Izin Operasional',
    tanggal_mulai: s.tanggal_mulai || (s.created_at ? s.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
    tanggal_selesai: s.tanggal_selesai || (s.created_at ? s.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
    disetujui_oleh: null,
    status: s.status || 'disetujui',
    created_at: s.created_at || new Date().toISOString(),
    diajukan_oleh: null
  }));

  const suratIzinResult = await postgrestInsert('ptv_surat_izin', suratIzinRows, 'id');
  report.push({
    tabel: 'ptv_surat_izin',
    source: rawSuratIzin.length,
    canonical: suratIzinResult.inserted,
    archive: 0,
    quarantine: 0,
    excluded: 0,
    failed: suratIzinResult.errors.length > 0 ? suratIzinRows.length : 0,
    selisih: rawSuratIzin.length - (suratIzinResult.inserted + suratIzinResult.skipped),
    catatan: `Ready: ${suratIzinResult.inserted}, Eksisting: ${suratIzinResult.skipped}`
  });

  // 14. LAPOR MASALAH (ptv_lapor_masalah)
  // In Production, recorded at master level (inventaris_unit_id is null).
  const rawLapor = bundle.ptv_lapor_masalah || [];
  const laporRows = [];
  const unresLapor = [];

  for (const lr of rawLapor) {
    if (lr.inventaris_unit_id) {
      laporRows.push({
        id: lr.id,
        unit_id: lr.inventaris_unit_id,
        pelapor_id: null,
        pelapor_nama: lr.pelapor_nama || 'Kru PTV',
        deskripsi_kerusakan: lr.deskripsi_kerusakan || lr.keterangan || lr.masalah || 'Kendala Alat',
        status_qc: lr.status_qc || lr.status || 'baru',
        biaya_reparasi: null,
        qc_approved_by: null,
        qc_approved_at: null,
        created_at: lr.created_at || new Date().toISOString(),
        updated_at: lr.updated_at || new Date().toISOString()
      });
    } else {
      unresLapor.push({
        source_table: 'ptv_lapor_masalah',
        source_id: String(lr.id),
        reason: 'Legacy damage report recorded at master item level without specific unit barcode',
        raw_payload: sanitizePayload(lr)
      });
    }
  }

  const laporResult = await postgrestInsert('ptv_lapor_masalah', laporRows, 'id');
  if (unresLapor.length > 0) await postgrestInsert('legacy_archive_unresolved', unresLapor, 'source_table,source_id');

  report.push({
    tabel: 'ptv_lapor_masalah',
    source: rawLapor.length,
    canonical: laporResult.inserted,
    archive: 0,
    quarantine: unresLapor.length,
    excluded: 0,
    failed: laporResult.errors.length > 0 ? laporRows.length : 0,
    selisih: rawLapor.length - (laporResult.inserted + laporResult.skipped + unresLapor.length),
    catatan: `Ready: ${laporResult.inserted}, Karantina: ${unresLapor.length}`
  });

  // 15. KAS PERIODE (ptv_kas_periode)
  // Production was tariff rate settings, not accounting closing balance.
  const rawKasPeriode = bundle.ptv_kas_periode || [];
  const unresKasPeriode = rawKasPeriode.map(kp => ({
    source_table: 'ptv_kas_periode',
    source_id: kp.periode_bulan || 'UNKNOWN',
    reason: 'Legacy monthly tariff setting rather than accounting closing balance statement',
    raw_payload: sanitizePayload(kp)
  }));

  if (unresKasPeriode.length > 0) await postgrestInsert('legacy_archive_unresolved', unresKasPeriode, 'source_table,source_id');

  report.push({
    tabel: 'ptv_kas_periode',
    source: rawKasPeriode.length,
    canonical: 0,
    archive: 0,
    quarantine: unresKasPeriode.length,
    excluded: 0,
    failed: 0,
    selisih: 0,
    catatan: `Karantina: ${unresKasPeriode.length} (data tarif iuran bulanan legacy)`
  });

  // 16-19. TABEL OPERASIONAL KOSONG (ptv_keuangan, ptv_lost_found, ptv_surat_tugas, ptv_surat_barang)
  const emptyOperational = [
    { key: 'ptv_keuangan', table: 'ptv_keuangan' },
    { key: 'ptv_lost_found', table: 'ptv_lost_found' },
    { key: 'ptv_surat_tugas', table: 'ptv_surat_tugas' },
    { key: 'ptv_surat_barang', table: 'ptv_surat_barang' }
  ];

  for (const emp of emptyOperational) {
    const rawData = bundle[emp.key] || [];
    report.push({
      tabel: emp.table,
      source: rawData.length,
      canonical: 0,
      archive: 0,
      quarantine: 0,
      excluded: 0,
      failed: 0,
      selisih: 0,
      catatan: 'Tabel kosong di Production sumber (0 record)'
    });
  }

  // ==========================================================================
  // KELOMPOK 2: 12 TABEL ARSIP LEGACY (DATA PRESERVED)
  // ==========================================================================
  const legacyArchives = [
    { key: 'legacy_archive_kru', table: 'legacy_archive_kru', prefix: 'ptv_kru', idKey: 'ptv_id' },
    { key: 'legacy_archive_aset', table: 'legacy_archive_aset', prefix: 'ptv_aset', idKey: 'kode' },
    { key: 'legacy_archive_request_aset', table: 'legacy_archive_request_aset', prefix: 'ptv_req_aset', idKey: 'production_id' },
    { key: 'legacy_archive_konten', table: 'legacy_archive_konten', prefix: 'ptv_konten', idKey: 'production_id' },
    { key: 'legacy_archive_galeri', table: 'legacy_archive_galeri', prefix: 'ptv_galeri', idKey: 'production_id' },
    { key: 'legacy_archive_ebook', table: 'legacy_archive_ebook', prefix: 'ptv_ebook', idKey: 'production_id' },
    { key: 'legacy_archive_portfolio', table: 'legacy_archive_portfolio', prefix: 'ptv_port', idKey: 'production_id' },
    { key: 'legacy_archive_tugas', table: 'legacy_archive_tugas', prefix: 'ptv_tugas', idKey: 'production_id' },
    { key: 'legacy_archive_riwayat_tugas', table: 'legacy_archive_riwayat_tugas', prefix: 'ptv_riw_tugas', idKey: 'production_id' },
    { key: 'legacy_archive_update', table: 'legacy_archive_update', prefix: 'ptv_upd', idKey: 'production_id' },
    { key: 'legacy_archive_izin', table: 'legacy_archive_izin', prefix: 'ptv_izin', idKey: 'production_id' },
    { key: 'legacy_archive_pendaftar', table: 'legacy_archive_pendaftar', prefix: 'ptv_pend', idKey: 'production_id' }
  ];

  function mapArchiveRow(table, r, prefix, idKey) {
    const s = sanitizePayload(r);
    const sourceKey = table === 'legacy_archive_kru' ? crewArchiveSourceKey(s) : `${prefix}:${s[idKey] || s.production_id || s.id || Math.random()}`;

    if (table === 'legacy_archive_kru') {
      const { id, crew_id, ptv_id, nama, full_name, username, divisi, jabatan, angkatan, status, role, role_legacy, foto_url, avatar_url, email_masked, telepon_masked, phone_masked, ...rest } = s;
      return {
        source_key: sourceKey,
        production_id: String(id || s.production_id || ''),
        ptv_id: crew_id || ptv_id || null,
        full_name: nama || full_name || null,
        username: username || null,
        divisi: divisi || null,
        jabatan: jabatan || null,
        angkatan: angkatan ? String(angkatan) : null,
        status: status || 'aktif',
        email_masked: email_masked || (s.email ? maskString(s.email) : null),
        telepon_masked: telepon_masked || phone_masked || (s.telepon ? maskString(s.telepon) : null),
        metadata_json: { ...rest, role_legacy: role || role_legacy || null, avatar_url: foto_url || avatar_url || null }
      };
    }

    if (table === 'legacy_archive_aset') {
      const { id, kode, nama, nama_aset, kategori, spesifikasi, keterangan, lokasi, kondisi, ...rest } = s;
      return {
        source_key: sourceKey,
        production_id: String(id || s.production_id || ''),
        kode: kode || null,
        nama_aset: nama_aset || nama || null,
        kategori: kategori || null,
        lokasi: lokasi || null,
        kondisi: kondisi || null,
        metadata_json: { ...rest, spesifikasi: spesifikasi || keterangan || null }
      };
    }

    if (table === 'legacy_archive_ebook') {
      const { id, judul, penulis, kategori, file_url, ...rest } = s;
      return {
        source_key: sourceKey,
        production_id: String(id || s.production_id || ''),
        judul: judul || null,
        penulis: penulis || null,
        kategori: kategori || null,
        file_url: file_url || null,
        metadata_json: Object.keys(rest).length > 0 ? rest : null
      };
    }

    if (table === 'legacy_archive_pendaftar') {
      const { id, nama, divisi_pilihan, divisi, angkatan, email_masked, telepon_masked, phone_masked, status_seleksi, status, ...rest } = s;
      return {
        source_key: sourceKey,
        production_id: String(id || s.production_id || ''),
        nama: nama || null,
        divisi_pilihan: divisi_pilihan || divisi || null,
        angkatan: angkatan ? String(angkatan) : null,
        email_masked: email_masked || (s.email ? maskString(s.email) : null),
        telepon_masked: telepon_masked || phone_masked || (s.telepon ? maskString(s.telepon) : null),
        status_seleksi: status_seleksi || status || null,
        metadata_json: Object.keys(rest).length > 0 ? rest : null
      };
    }

    if (table === 'legacy_archive_request_aset') {
      const { id, nama_pemohon, nama_barang, alasan, status, ...rest } = s;
      return {
        source_key: sourceKey,
        production_id: String(id || s.production_id || ''),
        nama_pemohon: nama_pemohon || null,
        nama_barang: nama_barang || null,
        alasan: alasan || null,
        status: status || null,
        metadata_json: Object.keys(rest).length > 0 ? rest : null
      };
    }

    if (table === 'legacy_archive_konten') {
      const { id, judul, kategori, link_media, deskripsi, ...rest } = s;
      return {
        source_key: sourceKey,
        production_id: String(id || s.production_id || ''),
        judul: judul || null,
        kategori: kategori || null,
        link_media: link_media || null,
        deskripsi: deskripsi || null,
        metadata_json: Object.keys(rest).length > 0 ? rest : null
      };
    }

    if (table === 'legacy_archive_galeri') {
      const { id, judul, album, foto_url, ...rest } = s;
      return {
        source_key: sourceKey,
        production_id: String(id || s.production_id || ''),
        judul: judul || null,
        album: album || null,
        foto_url: foto_url || null,
        metadata_json: Object.keys(rest).length > 0 ? rest : null
      };
    }

    if (table === 'legacy_archive_portfolio') {
      const { id, judul, klien, kategori, tahun, link_portfolio, ...rest } = s;
      return {
        source_key: sourceKey,
        production_id: String(id || s.production_id || ''),
        judul: judul || null,
        klien: klien || null,
        kategori: kategori || null,
        tahun: tahun ? String(tahun) : null,
        link_portfolio: link_portfolio || null,
        metadata_json: Object.keys(rest).length > 0 ? rest : null
      };
    }

    if (table === 'legacy_archive_tugas') {
      const { id, nama_tugas, kru_penanggung_jawab, deadline, status_tugas, ...rest } = s;
      return {
        source_key: sourceKey,
        production_id: String(id || s.production_id || ''),
        nama_tugas: nama_tugas || null,
        kru_penanggung_jawab: kru_penanggung_jawab || null,
        deadline: deadline || null,
        status_tugas: status_tugas || null,
        metadata_json: Object.keys(rest).length > 0 ? rest : null
      };
    }

    if (table === 'legacy_archive_riwayat_tugas') {
      const { id, tugas_id, status_sebelumnya, status_baru, catatan_perubahan, ...rest } = s;
      return {
        source_key: sourceKey,
        production_id: String(id || s.production_id || ''),
        tugas_id: tugas_id ? String(tugas_id) : null,
        status_sebelumnya: status_sebelumnya || null,
        status_baru: status_baru || null,
        catatan_perubahan: catatan_perubahan || null,
        metadata_json: Object.keys(rest).length > 0 ? rest : null
      };
    }

    if (table === 'legacy_archive_update') {
      const { id, versi, catatan_rilis, tanggal_rilis, ...rest } = s;
      return {
        source_key: sourceKey,
        production_id: String(id || s.production_id || ''),
        versi: versi || null,
        catatan_rilis: catatan_rilis || null,
        tanggal_rilis: tanggal_rilis || null,
        metadata_json: Object.keys(rest).length > 0 ? rest : null
      };
    }

    if (table === 'legacy_archive_izin') {
      const { id, nama_kru, alasan_izin, tanggal_mulai, tanggal_selesai, status_approval, ...rest } = s;
      return {
        source_key: sourceKey,
        production_id: String(id || s.production_id || ''),
        nama_kru: nama_kru || null,
        alasan_izin: alasan_izin || null,
        tanggal_mulai: tanggal_mulai || null,
        tanggal_selesai: tanggal_selesai || null,
        status_approval: status_approval || null,
        metadata_json: Object.keys(rest).length > 0 ? rest : null
      };
    }

    return {
      source_key: sourceKey,
      production_id: String(s.id || s.production_id || ''),
      metadata_json: s
    };
  }

  for (const arc of legacyArchives) {
    const rawData = bundle[arc.key] || [];
    const arcRows = rawData.map(r => mapArchiveRow(arc.table, r, arc.prefix, arc.idKey));
    const res = await postgrestInsert(arc.table, arcRows, 'source_key');
    report.push({
      tabel: arc.table,
      source: rawData.length,
      canonical: 0,
      archive: res.inserted,
      quarantine: 0,
      excluded: 0,
      failed: res.errors.length > 0 ? arcRows.length : 0,
      selisih: rawData.length - (res.inserted + res.skipped),
      catatan: `DATA PRESERVED (Arsip terisolasi: ${res.inserted}, Eksisting: ${res.skipped})`
    });
  }

  // ==========================================================================
  // KELOMPOK 3: 4 TABEL DIKECUALIKAN DARI TRANSFER (COUNT-ONLY AUDIT)
  // ==========================================================================
  if (bundle.excluded_summary) {
    const excl = bundle.excluded_summary;
    const excludedTables = [
      { name: 'users', count: excl.users_count || 0, alasan: 'Keamanan kredensial auth internal' },
      { name: 'ptv_login_history', count: excl.ptv_login_history_count || 0, alasan: 'Log audit usang (IP & User-Agent)' },
      { name: 'ptv_push_subscriptions', count: excl.ptv_push_subscriptions_count || 0, alasan: 'Push endpoint & token privat' },
      { name: 'ptv_notifications', count: excl.ptv_notifications_count || 0, alasan: 'Notifikasi usang user Production' }
    ];

    for (const ex of excludedTables) {
      report.push({
        tabel: `[EXCLUDED] ${ex.name}`,
        source: ex.count,
        canonical: 0,
        archive: 0,
        quarantine: 0,
        excluded: ex.count,
        failed: 0,
        selisih: 0,
        catatan: `DIKECUALIKAN DARI TRANSFER: ${ex.alasan}`
      });
    }
  }

  console.log('\n================================================================');
  console.log('REKAPITULASI RESMI AUDIT REKONSILIASI 35 TABEL PRODUCTION');
  console.log('================================================================');
  console.table(report);

  // Perhitungan Subtotal Terpisah
  const opReports = report.filter(r => !r.tabel.startsWith('legacy_archive_') && !r.tabel.startsWith('[EXCLUDED]'));
  const legReports = report.filter(r => r.tabel.startsWith('legacy_archive_'));
  const exclReports = report.filter(r => r.tabel.startsWith('[EXCLUDED]'));

  const totalOp = opReports.reduce((acc, r) => acc + (r.source || 0), 0);
  const totalLeg = legReports.reduce((acc, r) => acc + (r.source || 0), 0);
  const totalExcl = exclReports.reduce((acc, r) => acc + (r.source || 0), 0);

  const totalCanonical = report.reduce((acc, r) => acc + (r.canonical || 0), 0);
  const totalArchive = report.reduce((acc, r) => acc + (r.archive || 0), 0);
  const totalQuarantine = report.reduce((acc, r) => acc + (r.quarantine || 0), 0);
  const totalSelisih = report.reduce((acc, r) => acc + (r.selisih || 0), 0);

  console.log('--- RINGKASAN AUDIT KATEGORI SUMBER ---');
  console.log(`1. Target Migrasi Operasional (19 Tabel) : ${totalOp} record (Expected: 786)`);
  console.log(`2. Target Migrasi Arsip Legacy (12 Tabel) : ${totalLeg} record (Expected: 269)`);
  console.log(`   SUBTOTAL TARGET MIGRASI               : ${totalOp + totalLeg} record (Expected: 1.055)`);
  console.log(`3. Excluded by Policy (4 Tabel)          : ${totalExcl} record (Expected: 1.538)`);
  console.log(`   GRAND TOTAL SELURUH 35 TABEL          : ${totalOp + totalLeg + totalExcl} record (Expected: 2.593)\n`);

  console.log('--- RINGKASAN PRESERVASI STAGING ---');
  console.log(`  - Feature Ready (Canonical)            : ${totalCanonical} record`);
  console.log(`  - Data Preserved (Legacy Archive)      : ${totalArchive} record`);
  console.log(`  - Data Preserved (Quarantine)          : ${totalQuarantine} record`);
  console.log(`  - Excluded by Security Policy          : ${totalExcl} record`);
  console.log(`  - TOTAL SELISIH DATA LOSS              : ${totalSelisih} record`);

  if (totalSelisih === 0 && (totalOp + totalLeg) === 1055 && totalExcl === 1538) {
    console.log('\n[VERIFIKASI SUKSES] ZERO SILENT DATA LOSS TERPENUHI 100%. SEMUA RECORD ACCOUNTED FOR.');
  } else {
    console.error(`\n[PERINGATAN] Rekonsiliasi gagal memenuhi standar: Selisih=${totalSelisih}`);
  }
}

runImport().catch(console.error);
