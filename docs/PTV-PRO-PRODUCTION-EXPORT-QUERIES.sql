-- ============================================================================
-- PTV PRO -- PRODUCTION READ-ONLY EXPORT QUERIES (REVISI FINAL TERVALIDASI)
-- Target Database: Supabase Production (jthzuhkblxcaohiuypqq)
-- Status         : STRICTLY READ-ONLY (SELECT ONLY - ZERO MUTATION)
-- 
-- PANDUAN EKSEKUTIF UNTUK OPERATOR:
-- Jalankan query di bawah ini di SQL Editor Supabase Production (jthzuhkblxcaohiuypqq).
-- Semua query hanya membaca data (SELECT), tanpa UPDATE/DELETE/ALTER.
-- Data sensitif (email, telepon) otomatis dimasking langsung oleh query ini.
-- Password hash, token, kredensial auth, dan push subscription SENGAJA DIKECUALIKAN.
-- ============================================================================

-- ============================================================================
-- BAGIAN 1: DATA OPERASIONAL UNTUK TABEL CANONICAL STAGING
-- ============================================================================

-- 1.1 INVENTARIS (ptv_inventaris) -> Masuk ke ptv_inventaris Staging
-- Mapping ke kolom Staging: id (UUID), kode, nama_alat, kategori, spesifikasi, foto_url, sumber_perolehan
-- Catatan: harga_beli sengaja diisi NULL (dipindah ke ptv_nilai_inventaris)
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        UPPER(TRIM(kode)) AS kode,
        TRIM(nama) AS nama_alat,
        COALESCE(kategori, 'Aksesoris') AS kategori,
        COALESCE(spesifikasi, '') AS spesifikasi,
        foto_url,
        COALESCE(sumber, 'Yayasan') AS sumber_perolehan,
        COALESCE(created_at, now()) AS created_at,
        COALESCE(updated_at, now()) AS updated_at
    FROM ptv_inventaris
    ORDER BY kode
) t;

-- 1.2 INVENTARIS UNIT (ptv_inventaris_unit) -> Masuk ke ptv_inventaris_unit Staging
-- Mapping ke kolom Staging: kode_unit, nomor_seri, kondisi, status_peminjaman, lokasi_penyimpanan, nama_unit
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(u.id::text, gen_random_uuid()::text) AS production_id,
        UPPER(TRIM(i.kode)) AS parent_inventaris_kode,
        COALESCE(u.kode_unit, i.kode || '-U01') AS kode_unit,
        COALESCE(u.nama_unit, i.nama) AS nama_unit,
        u.nomor_seri,
        COALESCE(u.kondisi, 'bagus') AS kondisi,
        COALESCE(u.status, 'tersedia') AS status_peminjaman,
        COALESCE(u.lokasi, 'Studio PTV') AS lokasi_penyimpanan,
        COALESCE(u.created_at, now()) AS created_at
    FROM ptv_inventaris i
    LEFT JOIN ptv_inventaris_unit u ON u.inventaris_id = i.id
    ORDER BY i.kode, u.kode_unit
) t;

-- 1.3 VALUASI INVENTARIS (ptv_nilai_inventaris) -> Masuk ke ptv_nilai_inventaris Staging
-- Mapping: nilai_perolehan, nilai_buku_saat_ini, tanggal_valuasi, catatan_akuntansi
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        UPPER(TRIM(kode)) AS inventaris_kode,
        COALESCE(harga_beli, 0)::numeric AS nilai_perolehan,
        COALESCE(harga_beli, 0)::numeric AS nilai_buku_saat_ini,
        COALESCE(tanggal_pengadaan, CURRENT_DATE) AS tanggal_valuasi,
        'Migrasi dari data inventaris production' AS catatan_akuntansi
    FROM ptv_inventaris
    WHERE harga_beli IS NOT NULL AND harga_beli > 0
    ORDER BY kode
) t;

-- 1.4 PEMINJAMAN (ptv_peminjaman) -> Masuk ke ptv_peminjaman Staging
-- Mapping: transaction_id, peminjam_nama, keperluan, tanggal_pinjam, tenggat_kembali, tanggal_kembali, status, catatan
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(p.id::text, gen_random_uuid()::text) AS production_id,
        COALESCE(p.kode_transaksi, 'TRX-' || p.id::text) AS transaction_id,
        u.kode_unit,
        COALESCE(p.peminjam, 'Anonim') AS peminjam_nama,
        COALESCE(p.keperluan, 'Operasional') AS keperluan,
        COALESCE(p.tanggal_pinjam, CURRENT_DATE) AS tanggal_pinjam,
        COALESCE(p.tenggat_kembali, p.tanggal_pinjam + INTERVAL '1 day', CURRENT_DATE) AS tenggat_kembali,
        p.tanggal_kembali,
        COALESCE(p.status, 'kembali') AS status,
        p.kondisi_kembali,
        p.catatan,
        COALESCE(p.created_at, now()) AS created_at
    FROM ptv_peminjaman p
    LEFT JOIN ptv_inventaris_unit u ON u.id = p.unit_id
    ORDER BY p.tanggal_pinjam DESC
) t;

-- 1.5 LAPOR MASALAH / KERUSAKAN (ptv_lapor_masalah)
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        deskripsi,
        tingkat_urgensi,
        status,
        catatan_perbaikan,
        created_at
    FROM ptv_lapor_masalah
    ORDER BY created_at DESC
) t;

-- 1.6 LOST & FOUND (ptv_lost_found)
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        nama_barang,
        kategori,
        lokasi_ditemukan,
        tanggal_ditemukan,
        deskripsi,
        foto_url,
        status,
        created_at
    FROM ptv_lost_found
    ORDER BY created_at DESC
) t;

-- 1.7 ACARA / AGENDA (ptv_acara)
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        nama_acara,
        tanggal,
        waktu_mulai,
        waktu_selesai,
        lokasi,
        deskripsi,
        COALESCE(status, 'rencana') AS status,
        COALESCE(created_at, now()) AS created_at,
        COALESCE(updated_at, now()) AS updated_at
    FROM ptv_acara
    ORDER BY tanggal DESC
) t;

-- 1.8 CONTENT PLANNER (ptv_content_planner)
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        judul,
        platform,
        COALESCE(status, 'ide') AS status,
        target_tayang,
        catatan,
        COALESCE(created_at, now()) AS created_at,
        COALESCE(updated_at, now()) AS updated_at
    FROM ptv_content_planner
    ORDER BY created_at DESC
) t;

-- 1.9 PENGUMUMAN (ptv_pengumuman)
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        judul,
        konten,
        COALESCE(is_aktif, true) AS is_aktif,
        berlaku_sampai,
        COALESCE(created_at, now()) AS created_at
    FROM ptv_pengumuman
    ORDER BY created_at DESC
) t;

-- 1.10 KONTAK EKSTERNAL (ptv_kontak_eksternal) -- PII MASKED
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        nama_kontak,
        instansi,
        CASE 
            WHEN telepon IS NOT NULL AND length(telepon) >= 4 
            THEN '****' || right(regexp_replace(telepon, '[^0-9]', '', 'g'), 4)
            ELSE NULL 
        END AS telepon_masked,
        CASE 
            WHEN email IS NOT NULL AND email LIKE '%@%'
            THEN left(email, 3) || '***@' || split_part(email, '@', 2)
            ELSE NULL 
        END AS email_masked,
        peran,
        catatan,
        COALESCE(created_at, now()) AS created_at
    FROM ptv_kontak_eksternal
    ORDER BY nama_kontak
) t;

-- 1.11 KEUANGAN & VOUCHER (ptv_keuangan)
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        COALESCE(kode_voucher, 'VCR-' || id::text) AS kode_voucher,
        COALESCE(kategori, 'Operasional') AS kategori,
        COALESCE(keterangan, 'Transaksi migrasi') AS keterangan,
        COALESCE(nominal, 0)::numeric AS nominal,
        COALESCE(jenis, 'pengeluaran') AS jenis,
        COALESCE(tanggal_transaksi, CURRENT_DATE) AS tanggal_transaksi,
        COALESCE(created_at, now()) AS created_at
    FROM ptv_keuangan
    ORDER BY tanggal_transaksi DESC
) t;

-- 1.12 KAS PERIODE (ptv_kas_periode)
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        id,
        COALESCE(saldo_awal, 0)::numeric AS saldo_awal,
        COALESCE(total_pemasukan, 0)::numeric AS total_pemasukan,
        COALESCE(total_pengeluaran, 0)::numeric AS total_pengeluaran,
        COALESCE(saldo_akhir, 0)::numeric AS saldo_akhir,
        COALESCE(status_closing, 'open') AS status_closing,
        closed_at
    FROM ptv_kas_periode
    ORDER BY id DESC
) t;

-- 1.13 SURAT TUGAS (ptv_surat_tugas)
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        nomor_surat,
        perihal,
        tanggal_tugas,
        COALESCE(kru_terlibat, '[]'::jsonb) AS kru_terlibat,
        COALESCE(status, 'draft') AS status,
        COALESCE(created_at, now()) AS created_at
    FROM ptv_surat_tugas
    ORDER BY created_at DESC
) t;

-- 1.14 SURAT IZIN (ptv_surat_izin)
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        nomor_surat,
        nama_pemohon,
        alasan,
        tanggal_mulai,
        tanggal_selesai,
        COALESCE(status, 'draft') AS status,
        COALESCE(created_at, now()) AS created_at
    FROM ptv_surat_izin
    ORDER BY created_at DESC
) t;

-- 1.15 SURAT BARANG (ptv_surat_barang)
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        nomor_surat,
        nama_pembawa,
        tujuan_lokasi,
        COALESCE(daftar_barang, '[]'::jsonb) AS daftar_barang,
        COALESCE(status, 'draft') AS status,
        COALESCE(created_at, now()) AS created_at
    FROM ptv_surat_barang
    ORDER BY created_at DESC
) t;

-- ============================================================================
-- BAGIAN 2: DATA TABEL LEGACY UNTUK ARSIP TERISOLASI (legacy_archive_*)
-- ============================================================================

-- 2.1 KRU LEGACY (ptv_kru) -> Masuk ke legacy_archive_kru (PII MASKED)
-- PENTING: Password hash, session token, google token TIDAK DIEKSPOR
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, crew_id, 'KRU-' || gen_random_uuid()::text) AS production_id,
        crew_id AS ptv_id,
        nama AS full_name,
        username,
        divisi,
        jabatan,
        angkatan,
        status,
        role,
        photo_url,
        CASE 
            WHEN email IS NOT NULL AND email LIKE '%@%'
            THEN left(email, 3) || '***@' || split_part(email, '@', 2)
            ELSE NULL 
        END AS email_masked,
        CASE 
            WHEN telepon IS NOT NULL AND length(telepon) >= 4 
            THEN '****' || right(regexp_replace(telepon, '[^0-9]', '', 'g'), 4)
            ELSE NULL 
        END AS telepon_masked,
        created_at
    FROM ptv_kru
    ORDER BY crew_id
) t;

-- 2.2 ASET LEGACY (ptv_aset) -> legacy_archive_aset
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        kode, nama_aset, kategori, kondisi, nilai_perolehan, tanggal_pengadaan, lokasi
    FROM ptv_aset
    ORDER BY kode
) t;

-- 2.3 REQUEST ASET (ptv_request_aset) -> legacy_archive_request_aset
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        kru_id::text AS kru_legacy_id,
        nama_alat, keperluan, status, created_at AS tanggal_request
    FROM ptv_request_aset
    ORDER BY created_at DESC
) t;

-- 2.4 KONTEN LEGACY (ptv_konten) -> legacy_archive_konten
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        judul, platform, status, url_tayang, tanggal_tayang
    FROM ptv_konten
    ORDER BY id DESC
) t;

-- 2.5 GALERI (ptv_galeri) -> legacy_archive_galeri
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        judul, deskripsi, foto_url, kategori
    FROM ptv_galeri
    ORDER BY id DESC
) t;

-- 2.6 EBOOK (ptv_ebook) -> legacy_archive_ebook
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        judul, penulis, kategori, file_url, deskripsi
    FROM ptv_ebook
    ORDER BY id DESC
) t;

-- 2.7 PORTFOLIO (ptv_portfolio) -> legacy_archive_portfolio
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        judul, divisi, kategori, media_url, deskripsi
    FROM ptv_portfolio
    ORDER BY id DESC
) t;

-- 2.8 TUGAS (ptv_tugas) -> legacy_archive_tugas
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        judul, deskripsi, assigned_to::text AS assigned_to_legacy_id, status, prioritas, deadline
    FROM ptv_tugas
    ORDER BY id DESC
) t;

-- 2.9 RIWAYAT TUGAS (ptv_riwayat_tugas) -> legacy_archive_riwayat_tugas
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        tugas_id::text AS tugas_legacy_id,
        kru_id::text AS kru_legacy_id,
        kegiatan, tanggal_kegiatan
    FROM ptv_riwayat_tugas
    ORDER BY id DESC
) t;

-- 2.10 UPDATE SISTEM (ptv_update) -> legacy_archive_update
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        versi, catatan_rilis, tanggal_rilis
    FROM ptv_update
    ORDER BY id DESC
) t;

-- 2.11 IZIN LEGACY (ptv_izin) -> legacy_archive_izin
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        kru_id::text AS kru_legacy_id,
        nama_pemohon, jenis_izin, alasan, tanggal_mulai, tanggal_selesai, status
    FROM ptv_izin
    ORDER BY id DESC
) t;

-- 2.12 PENDAFTAR (ptv_pendaftar) -> legacy_archive_pendaftar (PII MASKED)
SELECT json_agg(row_to_json(t)) FROM (
    SELECT 
        COALESCE(id::text, gen_random_uuid()::text) AS production_id,
        nama, divisi_pilihan, angkatan,
        CASE 
            WHEN email IS NOT NULL AND email LIKE '%@%'
            THEN left(email, 3) || '***@' || split_part(email, '@', 2)
            ELSE NULL 
        END AS email_masked,
        CASE 
            WHEN telepon IS NOT NULL AND length(telepon) >= 4 
            THEN '****' || right(regexp_replace(telepon, '[^0-9]', '', 'g'), 4)
            ELSE NULL 
        END AS telepon_masked,
        status_seleksi
    FROM ptv_pendaftar
    ORDER BY id DESC
) t;

-- 2.13 CATATAN BERSAMA (ptv_catatan) -> Dimigrasikan ke tabel canonical ptv_catatan via SINGLE EXPORT
-- (Tabel ptv_catatan_bersama tidak ada; gunakan ptv_catatan)

-- ============================================================================
-- BAGIAN 3: TABEL DIKECUALIKAN DARI TRANSFER (HANYA RECORD COUNT)
-- ============================================================================
-- Sesuai kebijakan keamanan, 4 tabel berikut TIDAK DIMIGRASIKAN:
-- 1. users                  : Auth internal Production (password hash, refresh tokens)
-- 2. ptv_login_history      : Log audit login lawas (IP address, user agent lama)
-- 3. ptv_push_subscriptions : Kredensial push notification klien aktif Production
-- 4. ptv_notifications      : Pesan alert/notifikasi transient yang sudah kadaluarsa

SELECT 'users' AS table_name, COUNT(*) AS total_rows, 'EXCLUDED (Auth Secrets)' AS policy FROM users
UNION ALL SELECT 'ptv_login_history', COUNT(*), 'EXCLUDED (Stale Audit Log)' FROM ptv_login_history
UNION ALL SELECT 'ptv_push_subscriptions', COUNT(*), 'EXCLUDED (Active Client Tokens)' FROM ptv_push_subscriptions
UNION ALL SELECT 'ptv_notifications', COUNT(*), 'EXCLUDED (Transient Alerts)' FROM ptv_notifications;
