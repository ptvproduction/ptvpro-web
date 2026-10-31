# PTV PRO / PTV HUB — RENCANA REKONSILIASI & PATCH MIGRASI PRODUCTION → STAGING
## Dokumen Perencanaan Teknis, Verifikasi Empiris, dan Safety Blueprint — Revisi 4

- **Kode Sesi:** `PTV-DEV-096` (Kelanjutan dari `PTV-DEV-091`, `PTV-DEV-089`, dan `PTV-DEV-086`)
- **Status Sesi:** **PERSIAPAN & DRAFT BLUEPRINT REVISI 4 (STRICT READ-ONLY & BLOCKED)**
- **Larangan Mutlak:** Tidak ada mutasi DDL/DML, tidak ada eksekusi migrasi, tidak ada modifikasi database selama sesi ini.
- **Target Database:**
  - Supabase Production (`jthzuhkblxcaohiuypqq`) — **STRICT READ-ONLY (SELECT ONLY)**
  - Supabase Staging (`swadgljnyelsjstqqxbm`) — **BLOCKED / READ-ONLY SELAMA PERSIAPAN**
- **Referensi Bukti:** Safety Corrections Review 4, Final Audit Independen GPT, `production-bundle-original.json` (1.02 MB), OpenAPI PostgREST Staging, Skrip Importer & Verifikator Repositori
- **Tanggal Penyusunan:** 19 Oktober 2026
- **Operator / Developer:** Zidna / Antigravity

---

## 1. RINGKASAN EKSEKUTIF & STATUS TEMUAN TERVERIFIKASI

Dokumen ini adalah cetak biru (*blueprint*) rekonsiliasi data menyeluruh antara Supabase Production (`jthzuhkblxcaohiuypqq`) dan Supabase Staging (`swadgljnyelsjstqqxbm`), yang telah disempurnakan menjadi **REVISI 4** berdasarkan hasil tinjauan keselamatan targeted dan review mendalam.

### Parameter Kunci Hasil Verifikasi Empiris:
1. **Total Tabel Sumber Production:** 35 tabel fisik (2.593 record).
2. **Total Tabel/View Staging:** 53 tabel/view aktif (22 tabel relasional nama sama, 13 tabel arsip terisolasi `legacy_archive_*`, 1 tabel karantina `legacy_archive_unresolved`, 15 tabel RBAC/identitas kanonikal, 3 tabel relasi/log).
3. **Status Data Hilang vs Terkarantina:**
   - **Missing Rows (Belum Masuk Staging):** Ditemukan tepat **2 baris** data operasional yang belum masuk ke tabel Staging:
     1. `ptv_catatan`: 1 baris ID `3cc0338b-30a4-4bb5-aa83-c3e3451c8702` (*Notulensi Rapat:haha*).
     2. `ptv_pengeluaran`: 1 transaksi live pasca-ekspor ID `ac23e115-708b-4d12-9eb5-bec20264bbfb` (19 Okt 2026, *KONSUMSI CREW*, Rp28.000). Total pengeluaran Production adalah Rp633.924, dan saldo kas riil adalah Rp610.276. Pemasukan cocok 100% (43 record, Rp1.244.200).
   - **Missing Fields (Kolom Sumber Belum Memiliki Wadah di Staging):**
     1. `ptv_inventaris`: 4 kolom historis:
        - `brand`: **100 record terisi** (max 16 karakter).
        - `model`: **31 record terisi** (max 16 karakter).
        - `keterangan`: **143 record terisi** (107 teks catatan operasional studio + 36 string newline legacy textarea).
        - `aset_id_lama`: **150 record terisi** (**Tipe: VARCHAR(64)** berisi string UUID 36 karakter, **BUKAN INTEGER**!).
     2. `ptv_inventaris_unit`: 2 kolom terpisah:
        - `catatan`: **2 record terisi** (*"putul krn jatuh"* dan *"Rusak Ketika Haflah Takrim"*).
        - `keterangan`: **2 record terisi** (keterangan operasional fisik).
     3. `ptv_surat_izin`: 1 kolom terstruktur:
        - `santri_list`: **2 record terisi** (array JSON berisi daftar lengkap santri rombongan).
   - **Quarantined Records (Tersimpan Aman di Karantina):** 49 baris (41 peminjaman tanpa barcode unit, 1 laporan kerusakan tanpa barcode unit, 5 tarif kas periode, 2 momentum content planner tanpa platform publikasi).
4. **Prinsip Keselamatan Utama Revisi 4:**
   - **Verifikasi Koneksi Luar SQL:** `app.target_project_ref` adalah parameter konfirmasi manual, bukan bukti identitas database. Host target (`db.swadgljnyelsjstqqxbm.supabase.co`) wajib divalidasi dari konfigurasi koneksi tepercaya sebelum script dijalankan.
   - **Eliminasi Rollback Destruktif Tanpa WHERE:** Menghapus `UPDATE ptv_inventaris SET ... = NULL;`. Seluruh pemulihan berbasis snapshot per-ID dan per-kolom dengan deteksi konflik.
   - **Tata Kelola Rollback Skema:** Dilarang melakukan `DROP COLUMN` otomatis. Wajib memeriksa dependensi, data post-migrasi, dan persetujuan tertulis operator.
   - **Perbandingan Aman Terhadap NULL (`IS DISTINCT FROM`):** Mengganti semua operator `<>` dengan `IS DISTINCT FROM`.
   - **Full Payload Verification:** Membandingkan seluruh payload yang dimigrasikan untuk catatan (termasuk HTML lengkap 100%, tags JSONB, timestamp) dan pengeluaran (`keuangan_id`, `created_at`, dll).
   - **Array Type Check:** Memvalidasi bahwa `santri_list` bertipe JSON array sebelum operasi array.
   - **Dataset Sumber Bersama & Preflight Conflict Detection:** 161 inventaris diverifikasi terhadap data Staging saat ini; jika ada nilai terisi yang berbeda, transaksi langsung abort.
   - **Validasi Komprehensif Seluruh 161 Inventaris:** Readback verification memeriksa seluruh 161 record dari sumber.
   - **Dry-Run Lokal Terisolasi:** Uji coba transaksi wajib dilakukan pada instance PostgreSQL lokal/Docker, bukan database cloud.

---

## 2. MATRIKS PENYEMPURNAAN REVISI 3 KE REVISI 4 (TARGETED SAFETY CORRECTIONS)

| No | Area Koreksi | Kondisi pada Revisi 3 | Penyempurnaan Konkret pada Revisi 4 | Status |
| :---: | :--- | :--- | :--- | :---: |
| **1** | **Rollback DML Destruktif** | Memuat baris berbahaya `UPDATE ptv_inventaris SET brand=NULL, model=NULL...;` tanpa WHERE clause yang berisiko menghapus data global. | Dihapus sepenuhnya. Prosedur pemulihan dialihkan ke restore snapshot JSON pre-reconciliation dan selective undo berbasis per-ID dengan conflict check. | **Selesai** |
| **2** | **Rollback DDL Skema** | Menyediakan blok komentar `DROP COLUMN IF EXISTS` yang berisiko dieksekusi tanpa audit dependensi. | Dilarang melakukan DROP COLUMN otomatis. Dicatat daftar kolom yang dibuat, prasyarat audit dependensi skema/aplikasi, audit data post-migrasi, dan izin tertulis operator. | **Selesai** |
| **3** | **Klaim Identitas Database** | Mengklaim setting `app.target_project_ref` memverifikasi project ID target. | Ditegaskan bahwa `app.target_project_ref` hanya konfirmasi manual. Verifikasi endpoint project ref sesungguhnya wajib dilakukan pada konfigurasi koneksi di luar SQL. | **Selesai** |
| **4** | **Operator Perbandingan NULL** | Menggunakan operator `<>` yang menghasilkan NULL (falsy) jika operand bernilai NULL, berisiko meloloskan konflik secara diam-diam. | Seluruh perbandingan diubah menjadi `IS DISTINCT FROM` yang aman dan deterministik terhadap nilai NULL. | **Selesai** |
| **5** | **Preflight Catatan Bersama** | Hanya membandingkan judul dan substring isi menggunakan fungsi `position()`. | Diubah menjadi perbandingan full payload: judul, tipe, kategori, created_by_id, created_by_name, warna, is_pinned, tags JSONB, dan seluruh teks HTML lengkap (`IS DISTINCT FROM`). | **Selesai** |
| **6** | **Preflight Transaksi Pengeluaran** | Hanya membandingkan ID, nominal, tanggal, keperluan, dan keterangan. | Menambahkan pengecekan seluruh field sumber termasuk `keuangan_id` (NULL) dan `created_at` timestamp lengkap. | **Selesai** |
| **7** | **Preflight & Tipe Surat Izin** | Langsung memanggil `jsonb_array_length()` dan hanya mengecek elemen pertama. | Memvalidasi tipe JSON (`jsonb_typeof = 'array'`) sebelum menghitung panjang, dan membandingkan seluruh payload JSONB santri rombongan secara komprehensif. | **Selesai** |
| **8** | **Conflict Detection 161 Inventaris** | Update inventaris menggunakan `CASE WHEN` tanpa mendeteksi apakah ada nilai Staging terisi yang berbeda dari Production (silent divergence). | Menggunakan `temp_source_inventaris` bersama untuk mengecek seluruh 161 record di preflight. Jika ada nilai terisi di Staging yang berbeda dari Production, transaksi abort seketika. | **Selesai** |
| **9** | **Post-Patch Verification Inventaris** | Hanya memeriksa 3 sampel inventaris (Sony, Yamaha, Godox). | Dilakukan looping verifikasi untuk SELURUH 161 record dari `temp_source_inventaris`. Transaksi gagal jika ada field sumber yang tidak cocok di target Staging. | **Selesai** |
| **10** | **Preservasi Karantina & Content Planner** | 49 record karantina dan constraint content planner tetap dilindungi. | Ditegaskan bahwa 49 record karantina tidak disentuh, dan DDL relaksasi content planner tetap dinonaktifkan/memerlukan keputusan terpisah. | **Selesai** |
| **11** | **Integritas Validasi Sintaksis Offline** | Menghitung keseimbangan blok kendali leksikal. | Dilaporkan secara transparan: parser PostgreSQL offline tidak tersedia di environment lokal, sehingga validasi sintaks formal dinyatakan belum terverifikasi oleh PostgreSQL engine. | **Selesai** |
| **12** | **Rencana Dry-Run Terisolasi** | Langkah dry-run sebelumnya menyebutkan pengujian di SQL Editor cloud dengan ROLLBACK. | Prosedur dry-run dialihkan sepenuhnya ke database PostgreSQL lokal/Docker terisolasi dengan data snapshot, mencegah risiko eksekusi tidak disengaja di cloud. | **Selesai** |

---

## 3. PROTOKOL OPERASIONAL STEP-BY-STEP (JIKA DISETUJUI OPERATOR)

### Prasyarat Mutlak:
1. **Persetujuan Tertulis:** Operator Zidna menyetujui eksekusi patch rekonsiliasi.
2. **Koneksi Eksternal Terverifikasi:** Koneksi terhubung ke `db.swadgljnyelsjstqqxbm.supabase.co`.
3. **Snapshot Backup Tersimpan:** File snapshot JSON target tabel Staging tersimpan aman di direktori `backups/`.

### Langkah 1: Snapshot Backup Staging
```bash
node scripts/backup-staging-target-tables.mjs
```
Simpan snapshot di `backups/staging-pre-reconciliation-patch-<timestamp>.json`.

### Langkah 2: Dry-Run pada Database Lokal Terisolasi
Jalankan pengujian skrip pada instance PostgreSQL lokal (Docker):
```bash
# 1. Start local PostgreSQL container terisolasi
docker run --name ptv-dryrun -e POSTGRES_PASSWORD=postgres -p 54321:5432 -d postgres:15

# 2. Restore schema dan data snapshot staging ke database lokal
psql -h localhost -p 54321 -U postgres -d postgres -f staging-schema-dump.sql

# 3. Jalankan schema patch dan data patch pada database lokal
psql -h localhost -p 54321 -U postgres -d postgres -f docs/PTV-PRO-RECONCILIATION-SCHEMA-PATCH-DRAFT.sql
psql -h localhost -p 54321 -U postgres -d postgres -f docs/PTV-PRO-RECONCILIATION-DATA-PATCH-DRAFT.sql

# 4. Verifikasi bahwa seluruh assertion lolos tanpa exception
```

### Langkah 3: Eksekusi Schema Patch (DDL) pada Staging
1. Buka Supabase SQL Editor pada target proyek Staging `swadgljnyelsjstqqxbm`.
2. Setel parameter sesi:
   ```sql
   SET LOCAL app.target_project_ref = 'swadgljnyelsjstqqxbm';
   SET LOCAL app.confirm_staging_reconciliation = 'STAGING_CONFIRMED';
   ```
3. Jalankan isi berkas [`docs/PTV-PRO-RECONCILIATION-SCHEMA-PATCH-DRAFT.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RECONCILIATION-SCHEMA-PATCH-DRAFT.sql).
4. Verifikasi penambahan 7 kolom aditif.

### Langkah 4: Eksekusi Data Patch (DML) pada Staging
1. Setel parameter sesi:
   ```sql
   SET LOCAL app.target_project_ref = 'swadgljnyelsjstqqxbm';
   SET LOCAL app.confirm_staging_reconciliation = 'STAGING_CONFIRMED';
   ```
2. Jalankan isi berkas [`docs/PTV-PRO-RECONCILIATION-DATA-PATCH-DRAFT.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RECONCILIATION-DATA-PATCH-DRAFT.sql).
3. Verifikasi pesan `POST-PATCH VERIFICATION BERHASIL` dan status `COMMIT`.

---

## 4. TATA KELOLA PEMULIHAN ROLLBACK (REVISION 4)

1. **Rollback Data (DML):**
   - **Metode Utama:** Restorasi dari file snapshot JSON pre-reconciliation:
     ```bash
     node scripts/restore-staging-backup.mjs backups/staging-pre-reconciliation-patch-<timestamp>.json
     ```
   - **Metode Manual:** Menggunakan `WHERE id = ...` spesifik dan verifikasi bahwa data belum diubah post-patch. DILARANG KERAS menggunakan `UPDATE` atau `DELETE` tanpa klausa WHERE.

2. **Rollback Skema (DDL):**
   - Dilarang menjalankan `DROP COLUMN` secara otomatis.
   - Wajib melakukan audit dependensi (views, trigger, fungsi, kode frontend/backend) dan memastikan tidak ada data baru yang ditulis setelah migrasi.
   - Wajib memperoleh persetujuan tertulis dari Operator Zidna.

---

## 5. STATUS AKHIR & RISIKO TERSISA

- **Status:** **STRICTLY BLOCKED / AWAITING OPERATOR APPROVAL**.
- **Risiko Tersisa:**
  1. *Perbedaan Data Runtime:* Jika ada kru yang sedang mengedit inventaris di Staging bersamaan dengan eksekusi patch, preflight conflict detection akan membatalkan transaksi untuk mencegah overwrite.
  2. *Validasi Sintaksis Engine:* Karena parser PostgreSQL engine offline tidak tersedia secara lokal, uji coba sintaks final bergantung pada tahap dry-run pada database PostgreSQL lokal (Docker).
- **Komitmen Keamanan:** Tidak ada mutasi yang dieksekusi ke Supabase Cloud Staging (`swadgljnyelsjstqqxbm`) maupun Production (`jthzuhkblxcaohiuypqq`).
