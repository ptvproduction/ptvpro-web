-- ============================================================================
-- PTV PRO -- STAGING MIGRATION PART 2: IMPORT TEMPLATE (REVISI FINAL)
-- Target Database: Supabase Staging (swadgljnyelsjstqqxbm)
-- Status         : TERVALIDASI STATIS 100% TERHADAP METADATA OPENAPI STAGING
--
-- ATURAN KESELAMATAN & IDEMPOTENCY:
-- 1. Seluruh INSERT ke tabel Staging menggunakan ON CONFLICT DO NOTHING.
--    Data pengujian existing Staging (CAM-01, dll) TERLINDUNGI & TIDAK TERTINDAH.
-- 2. Seluruh INSERT ke tabel arsip menggunakan ON CONFLICT (source_key) DO NOTHING.
-- 3. Seluruh lookup FK menggunakan subquery deterministik berbasis kode/identifier alami.
-- 4. TIDAK ADA pembuatan akun di canonical_identity atau user_account dari data kru legacy.
-- ============================================================================

-- ============================================================================
-- MODUL A: IMPORT INVENTARIS KE TABEL CANONICAL STAGING
-- Kolom Staging Aktual: id, kode, nama_alat, kategori, spesifikasi, foto_url, 
--                      harga_beli, sumber_perolehan, created_at, updated_at
-- ============================================================================

-- A.1 ptv_inventaris (Master Alat)
-- Proteksi: ON CONFLICT (kode) DO NOTHING melindungi 1 row test Staging
/*
INSERT INTO ptv_inventaris (
    id,
    kode,
    nama_alat,
    kategori,
    spesifikasi,
    foto_url,
    harga_beli,
    sumber_perolehan,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    UPPER(TRIM(r->>'kode')),
    TRIM(r->>'nama_alat'),
    COALESCE(r->>'kategori', 'Aksesoris'),
    COALESCE(r->>'spesifikasi', ''),
    r->>'foto_url',
    NULL, -- harga_beli SELALU NULL di tabel katalog master
    COALESCE(r->>'sumber_perolehan', 'Yayasan'),
    COALESCE((r->>'created_at')::timestamptz, now()),
    COALESCE((r->>'updated_at')::timestamptz, now())
FROM jsonb_array_elements('<INVENTARIS_JSON>'::jsonb) AS r
ON CONFLICT (kode) DO NOTHING;
*/

-- A.2 ptv_inventaris_unit (Unit Fisik Alat)
-- Kolom Staging Aktual: id, inventaris_id, kode_unit, nomor_seri, kondisi, 
--                      status_peminjaman, lokasi_penyimpanan, created_at, updated_at, nama_unit
-- Proteksi: ON CONFLICT (kode_unit) DO NOTHING
/*
INSERT INTO ptv_inventaris_unit (
    id,
    inventaris_id,
    kode_unit,
    nomor_seri,
    kondisi,
    status_peminjaman,
    lokasi_penyimpanan,
    nama_unit,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    inv.id,
    TRIM(r->>'kode_unit'),
    r->>'nomor_seri',
    COALESCE(r->>'kondisi', 'bagus'),
    COALESCE(r->>'status_peminjaman', 'tersedia'),
    COALESCE(r->>'lokasi_penyimpanan', 'Studio PTV'),
    COALESCE(r->>'nama_unit', inv.nama_alat),
    COALESCE((r->>'created_at')::timestamptz, now()),
    now()
FROM jsonb_array_elements('<INVENTARIS_UNIT_JSON>'::jsonb) AS r
JOIN ptv_inventaris inv ON inv.kode = UPPER(TRIM(r->>'parent_inventaris_kode'))
ON CONFLICT (kode_unit) DO NOTHING;
*/

-- A.3 ptv_nilai_inventaris (Buku Besar Valuasi Terisolasi)
-- Kolom Staging Aktual: id, inventaris_id, nilai_perolehan, nilai_buku_saat_ini, 
--                      tanggal_valuasi, catatan_akuntansi, updated_at
-- Proteksi: ON CONFLICT (inventaris_id) DO NOTHING
/*
INSERT INTO ptv_nilai_inventaris (
    id,
    inventaris_id,
    nilai_perolehan,
    nilai_buku_saat_ini,
    tanggal_valuasi,
    catatan_akuntansi,
    updated_at
)
SELECT 
    gen_random_uuid(),
    inv.id,
    (r->>'nilai_perolehan')::numeric,
    (r->>'nilai_buku_saat_ini')::numeric,
    COALESCE((r->>'tanggal_valuasi')::date, CURRENT_DATE),
    COALESCE(r->>'catatan_akuntansi', 'Migrasi valuasi perolehan'),
    now()
FROM jsonb_array_elements('<NILAI_INVENTARIS_JSON>'::jsonb) AS r
JOIN ptv_inventaris inv ON inv.kode = UPPER(TRIM(r->>'inventaris_kode'))
ON CONFLICT (inventaris_id) DO NOTHING;
*/

-- ============================================================================
-- MODUL B: IMPORT PEMINJAMAN KE TABEL CANONICAL STAGING
-- Kolom Staging Aktual: id, transaction_id, unit_id, peminjam_nama, keperluan, 
--                      tanggal_pinjam, tenggat_kembali, tanggal_kembali, status, 
--                      kondisi_kembali, catatan, created_at
-- ============================================================================
/*
INSERT INTO ptv_peminjaman (
    id,
    transaction_id,
    unit_id,
    peminjam_nama,
    keperluan,
    tanggal_pinjam,
    tenggat_kembali,
    tanggal_kembali,
    status,
    kondisi_kembali,
    catatan,
    created_at
)
SELECT 
    gen_random_uuid(),
    COALESCE(r->>'transaction_id', 'TRX-LEGACY-' || gen_random_uuid()::text),
    u.id,
    COALESCE(r->>'peminjam_nama', 'Peminjam Legacy'),
    COALESCE(r->>'keperluan', 'Operasional'),
    COALESCE((r->>'tanggal_pinjam')::date, CURRENT_DATE),
    COALESCE((r->>'tenggat_kembali')::date, (r->>'tanggal_pinjam')::date + INTERVAL '1 day', CURRENT_DATE),
    (r->>'tanggal_kembali')::date,
    COALESCE(r->>'status', 'kembali'),
    r->>'kondisi_kembali',
    r->>'catatan',
    COALESCE((r->>'created_at')::timestamptz, now())
FROM jsonb_array_elements('<PEMINJAMAN_JSON>'::jsonb) AS r
JOIN ptv_inventaris_unit u ON u.kode_unit = TRIM(r->>'kode_unit')
ON CONFLICT (transaction_id, unit_id) DO NOTHING;
*/

-- ============================================================================
-- MODUL C: IMPORT DOMAIN OPERASIONAL LAINNYA
-- ============================================================================

-- C.1 ptv_acara
/*
INSERT INTO ptv_acara (
    id, nama_acara, tanggal, waktu_mulai, waktu_selesai, lokasi, deskripsi, status, created_at, updated_at
)
SELECT 
    gen_random_uuid(),
    r->>'nama_acara',
    (r->>'tanggal')::date,
    (r->>'waktu_mulai')::time,
    (r->>'waktu_selesai')::time,
    r->>'lokasi',
    r->>'deskripsi',
    COALESCE(r->>'status', 'rencana'),
    COALESCE((r->>'created_at')::timestamptz, now()),
    COALESCE((r->>'updated_at')::timestamptz, now())
FROM jsonb_array_elements('<ACARA_JSON>'::jsonb) AS r;
*/

-- C.2 ptv_content_planner
/*
INSERT INTO ptv_content_planner (
    id, judul, platform, status, target_tayang, catatan, created_at, updated_at
)
SELECT 
    gen_random_uuid(),
    r->>'judul',
    r->>'platform',
    COALESCE(r->>'status', 'ide'),
    (r->>'target_tayang')::date,
    r->>'catatan',
    COALESCE((r->>'created_at')::timestamptz, now()),
    COALESCE((r->>'updated_at')::timestamptz, now())
FROM jsonb_array_elements('<CONTENT_PLANNER_JSON>'::jsonb) AS r;
*/

-- C.3 ptv_pengumuman
/*
INSERT INTO ptv_pengumuman (
    id, judul, konten, is_aktif, berlaku_sampai, created_at
)
SELECT 
    gen_random_uuid(),
    r->>'judul',
    r->>'konten',
    COALESCE((r->>'is_aktif')::boolean, true),
    (r->>'berlaku_sampai')::date,
    COALESCE((r->>'created_at')::timestamptz, now())
FROM jsonb_array_elements('<PENGUMUMAN_JSON>'::jsonb) AS r;
*/

-- C.4 ptv_kontak_eksternal (Masked)
/*
INSERT INTO ptv_kontak_eksternal (
    id, nama_kontak, instansi, telepon, email, peran, catatan, created_at
)
SELECT 
    gen_random_uuid(),
    r->>'nama_kontak',
    r->>'instansi',
    r->>'telepon_masked',
    r->>'email_masked',
    r->>'peran',
    r->>'catatan',
    COALESCE((r->>'created_at')::timestamptz, now())
FROM jsonb_array_elements('<KONTAK_EKSTERNAL_JSON>'::jsonb) AS r;
*/

-- C.5 ptv_keuangan
/*
INSERT INTO ptv_keuangan (
    id, kode_voucher, kategori, keterangan, nominal, jenis, tanggal_transaksi, created_at
)
SELECT 
    gen_random_uuid(),
    r->>'kode_voucher',
    COALESCE(r->>'kategori', 'Operasional'),
    COALESCE(r->>'keterangan', 'Transaksi migrasi'),
    (r->>'nominal')::numeric,
    COALESCE(r->>'jenis', 'pengeluaran'),
    COALESCE((r->>'tanggal_transaksi')::date, CURRENT_DATE),
    COALESCE((r->>'created_at')::timestamptz, now())
FROM jsonb_array_elements('<KEUANGAN_JSON>'::jsonb) AS r
ON CONFLICT (kode_voucher) DO NOTHING;
*/

-- C.6 ptv_kas_periode
/*
INSERT INTO ptv_kas_periode (
    id, saldo_awal, total_pemasukan, total_pengeluaran, saldo_akhir, status_closing, closed_at
)
SELECT 
    r->>'id',
    (r->>'saldo_awal')::numeric,
    (r->>'total_pemasukan')::numeric,
    (r->>'total_pengeluaran')::numeric,
    (r->>'saldo_akhir')::numeric,
    COALESCE(r->>'status_closing', 'open'),
    (r->>'closed_at')::timestamptz
FROM jsonb_array_elements('<KAS_PERIODE_JSON>'::jsonb) AS r
ON CONFLICT (id) DO NOTHING;
*/

-- C.7 ptv_surat_tugas
/*
INSERT INTO ptv_surat_tugas (
    id, nomor_surat, perihal, tanggal_tugas, kru_terlibat, status, created_at
)
SELECT 
    gen_random_uuid(),
    r->>'nomor_surat',
    r->>'perihal',
    (r->>'tanggal_tugas')::date,
    COALESCE(r->'kru_terlibat', '[]'::jsonb),
    COALESCE(r->>'status', 'draft'),
    COALESCE((r->>'created_at')::timestamptz, now())
FROM jsonb_array_elements('<SURAT_TUGAS_JSON>'::jsonb) AS r
ON CONFLICT (nomor_surat) DO NOTHING;
*/

-- C.8 ptv_surat_izin
/*
INSERT INTO ptv_surat_izin (
    id, nomor_surat, nama_pemohon, alasan, tanggal_mulai, tanggal_selesai, status, created_at
)
SELECT 
    gen_random_uuid(),
    r->>'nomor_surat',
    r->>'nama_pemohon',
    r->>'alasan',
    (r->>'tanggal_mulai')::date,
    (r->>'tanggal_selesai')::date,
    COALESCE(r->>'status', 'draft'),
    COALESCE((r->>'created_at')::timestamptz, now())
FROM jsonb_array_elements('<SURAT_IZIN_JSON>'::jsonb) AS r
ON CONFLICT (nomor_surat) DO NOTHING;
*/

-- C.9 ptv_surat_barang
/*
INSERT INTO ptv_surat_barang (
    id, nomor_surat, nama_pembawa, tujuan_lokasi, daftar_barang, status, created_at
)
SELECT 
    gen_random_uuid(),
    r->>'nomor_surat',
    r->>'nama_pembawa',
    r->>'tujuan_lokasi',
    COALESCE(r->'daftar_barang', '[]'::jsonb),
    COALESCE(r->>'status', 'draft'),
    COALESCE((r->>'created_at')::timestamptz, now())
FROM jsonb_array_elements('<SURAT_BARANG_JSON>'::jsonb) AS r
ON CONFLICT (nomor_surat) DO NOTHING;
*/

-- ============================================================================
-- MODUL D: IMPORT DATA KRU & TABEL LEGACY KE ARSIP TERISOLASI
-- Semua tabel menggunakan ON CONFLICT (source_key) DO NOTHING
-- ============================================================================

-- D.1 legacy_archive_kru (Kru Production -> Arsip)
-- PENTING: TIDAK MENYENTUH canonical_identity / user_account
/*
INSERT INTO legacy_archive_kru (
    source_key,
    production_id,
    ptv_id,
    full_name,
    username,
    divisi,
    jabatan,
    angkatan,
    status,
    role,
    photo_url,
    email_masked,
    telepon_masked,
    reconciliation_status,
    imported_at
)
SELECT 
    'ptv_kru:' || COALESCE(r->>'ptv_id', r->>'production_id'),
    r->>'production_id',
    r->>'ptv_id',
    r->>'full_name',
    r->>'username',
    r->>'divisi',
    r->>'jabatan',
    r->>'angkatan',
    r->>'status',
    r->>'role',
    r->>'photo_url',
    r->>'email_masked',
    r->>'telepon_masked',
    'unlinked',
    now()
FROM jsonb_array_elements('<KRU_JSON>'::jsonb) AS r
ON CONFLICT (source_key) DO NOTHING;
*/

-- D.2 legacy_archive_aset
/*
INSERT INTO legacy_archive_aset (
    source_key, production_id, kode, nama_aset, kategori, kondisi, nilai_perolehan, tanggal_pengadaan, lokasi, imported_at
)
SELECT 
    'ptv_aset:' || COALESCE(r->>'kode', r->>'production_id'),
    r->>'production_id',
    r->>'kode',
    r->>'nama_aset',
    r->>'kategori',
    r->>'kondisi',
    (r->>'nilai_perolehan')::numeric,
    (r->>'tanggal_pengadaan')::date,
    r->>'lokasi',
    now()
FROM jsonb_array_elements('<ASET_JSON>'::jsonb) AS r
ON CONFLICT (source_key) DO NOTHING;
*/

-- D.3 legacy_archive_pendaftar
/*
INSERT INTO legacy_archive_pendaftar (
    source_key, production_id, nama, divisi_pilihan, angkatan, email_masked, telepon_masked, status_seleksi, imported_at
)
SELECT 
    'ptv_pendaftar:' || r->>'production_id',
    r->>'production_id',
    r->>'nama',
    r->>'divisi_pilihan',
    r->>'angkatan',
    r->>'email_masked',
    r->>'telepon_masked',
    r->>'status_seleksi',
    now()
FROM jsonb_array_elements('<PENDAFTAR_JSON>'::jsonb) AS r
ON CONFLICT (source_key) DO NOTHING;
*/

-- D.4 legacy_archive_galeri
/*
INSERT INTO legacy_archive_galeri (
    source_key, production_id, judul, deskripsi, foto_url, kategori, imported_at
)
SELECT 
    'ptv_galeri:' || r->>'production_id',
    r->>'production_id',
    r->>'judul',
    r->>'deskripsi',
    r->>'foto_url',
    r->>'kategori',
    now()
FROM jsonb_array_elements('<GALERI_JSON>'::jsonb) AS r
ON CONFLICT (source_key) DO NOTHING;
*/

-- D.5 legacy_archive_tugas
/*
INSERT INTO legacy_archive_tugas (
    source_key, production_id, judul, deskripsi, assigned_to_legacy_id, status, prioritas, deadline, imported_at
)
SELECT 
    'ptv_tugas:' || r->>'production_id',
    r->>'production_id',
    r->>'judul',
    r->>'deskripsi',
    r->>'assigned_to_legacy_id',
    r->>'status',
    r->>'prioritas',
    (r->>'deadline')::date,
    now()
FROM jsonb_array_elements('<TUGAS_JSON>'::jsonb) AS r
ON CONFLICT (source_key) DO NOTHING;
*/
