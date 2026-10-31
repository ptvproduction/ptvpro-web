# PTV PRO / PTV HUB — LEGACY DATA MIGRATION MAP

> Koreksi PTV-DEV-149, 24 Oktober 2026: spesifikasi historis di bawah bukan acuan eksekusi identitas. Schema aktual ptv_kru.id adalah UUID, canonical_identity.legacy_id adalah BIGINT; status akun WordPress berbeda dari status personel; Google tidak boleh auto-link berdasarkan email. Lihat [rekonsiliasi berbasis SELECT aktual](PTVPRO-ACCESS-149-LEGACY-RECONCILIATION.md) sebelum menyusun migrasi. Tidak ada perubahan data dijalankan.
## Authoritative Field-by-Field MySQL (PHP) to PostgreSQL Mapping Specification

**Target Database:** Supabase PostgreSQL (`swadgljnyelsjstqqxbm`)  
**Legacy Sources:** WordPress Theme FIXPTV (`page-dasbor.php`, `ptv-dashboard-data-bridge.php`) & Legacy MySQL DB (`ptv_db`)  
**Scope:** Complete Data Translation Blueprint Across All 12 Functional Domains  
**Status:** Canonical Blueprint — READ-ONLY MAPPING (No artificial/fake production data)  
**Date:** 2026-10-17  

---

## 1. STRUKTUR & PRINSIP DASAR MIGRASI DATA

1. **Zero Fake Data Policy:** Dokumen ini mendefinisikan pemetaan struktural murni. Tidak ada data dummy, credential palsu, atau transaksi fiktif yang digenerate ke database staging maupun produksi.
2. **Preservasi Nilai Institusional (PTV ID):** Nilai `ptv_id` (misal: `PTV-001` s/d `PTV-065`) bersifat permanen dan tidak boleh diubah atau digantikan dengan UUID acak pada tampilan pengguna.
3. **Pemisahan Entitas Monolitik:** Tabel monolitik lama seperti `ptv_kru` dipecah menjadi 5 tabel ternormalisasi: Identitas Kanonikal, Akun Pengguna, Kontak Pribadi, Membership Organisasi, dan Profil Kru.
4. **Isolasi Valuasi Aset:** Nominal `harga_beli` pada `ptv_inventaris` dialihkan sepenuhnya ke tabel terproteksi `ptv_nilai_inventaris`.
5. **Urutan Impor Berbasis Ketergantungan Foreign Key:** Data master dan tabel referensi diimpor terlebih dahulu sebelum tabel transaksi anak.

---

## 2. PEMETAAN DOMAIN DATA (FIELD-BY-FIELD MAPPING)

### DOMAIN 1: KRU, IDENTITAS & USER ACCOUNTS

* **Sumber Data Legacy:** Tabel MySQL `ptv_kru` (42 baris data kru institusional).
* **Tabel Tujuan PostgreSQL:**
  1. `public.canonical_identity` (Identitas hukum/permanen)
  2. `public.user_account` (Kredensial & status akun)
  3. `public.identity_contact` (Nomor kontak terlindungi)
  4. `public.ptv_organization_membership` (Status divisi, jabatan, keanggotaan)
  5. `public.ptv_crew_profile` (Avatar, bio, angkatan)
  6. `public.ptv_kru_legacy_compat` (View kompatibilitas backward)

| Field Sumber (`ptv_kru`) | Tabel Target | Field Target | Transformasi & Aturan Konversi |
| :--- | :--- | :--- | :--- |
| `id` (INT) | `canonical_identity` | `legacy_id` | Dikonversi ke `VARCHAR(64)`, dipertahankan sebagai indeks unik migrasi. Primary key PostgreSQL menggunakan `UUID DEFAULT gen_random_uuid()`. |
| `crew_id` (VARCHAR) | `canonical_identity` | `ptv_id` | Dibersihkan dengan `UPPER(TRIM(crew_id))` (contoh: `PTV-001`). Wajib unik kanonikal. |
| `nama` (VARCHAR) | `canonical_identity` | `full_name` | `TRIM(nama)`. Sanitasi karakter khusus. |
| `username` (VARCHAR) | `user_account` | `username` | `LOWER(TRIM(username))`. Diisi dari username legacy atau fallback format `kru_<ptv_id>`. |
| *Google OAuth sub* | `user_account` | `google_sub` | Diisi `NULL` saat initial migration, ditautkan otomatis saat pertama kali kru login via Google OAuth di Vercel. |
| `status` (VARCHAR) | `user_account` | `status_akun` | Jika status = `'aktif'` -> `'active'`; jika status = `'nonaktif'` -> `'inactive'`. |
| `telepon` / `no_wa` | `identity_contact` | `telepon`, `no_wa` | Sanitasi prefix E.164 (`+62...`). Terlindungi RLS kontak pribadi. |
| `email` | `identity_contact` | `email_pribadi` | `LOWER(TRIM(email))`. |
| `divisi` (VARCHAR) | `ptv_organization_membership` | `division_id` | Lookup foreign key ke `ptv_division.id` berdasarkan kode divisi legacy. |
| `jabatan` (VARCHAR) | `ptv_organization_membership` | `position_title` | Disalin utuh (contoh: `'Ketua'`, `'Staf Teknik'`). |
| `angkatan` (VARCHAR/INT) | `ptv_crew_profile` | `angkatan` | Konversi string/integer representasi angkatan. |
| `foto_url` (VARCHAR) | `ptv_crew_profile` | `avatar_url` | Resolusi URL path dari media library lama. |

- **Risiko Kehilangan Data:** Hash password PHP legacy (`MD5` atau `wp_hash_password`) tidak kompatibel dengan standar keamanan modern.
- **Mitigasi:** Hash password legacy **tidak dimigrasikan** untuk otentikasi aktif. Otentikasi dialihkan 100% menggunakan Google OAuth terverifikasi pada backend Vercel.

---

### DOMAIN 2: DIVISI & STRUKTUR ORGANISASI

* **Sumber Data Legacy:** Field `divisi` pada `ptv_kru` dan konvensi tema FIXPTV.
* **Tabel Tujuan PostgreSQL:** `public.ptv_organization` dan `public.ptv_division`.

| Kode Divisi Legacy | Kode Target (`ptv_division.code`) | Nama Divisi Resmi (`name`) | Hierarchy Level |
| :--- | :--- | :--- | :--- |
| `Manajemen` | `MGMT` | Manajemen & Pimpinan Studio | 1 (Eksekutif) |
| `Teknik` | `TECH` | Divisi Teknik & Penyiaran | 2 (Operasional) |
| `Produksi` | `PROD` | Divisi Produksi Program | 2 (Operasional) |
| `Kreatif` | `CRTV` | Divisi Kreatif & Pasca Produksi | 2 (Operasional) |
| `Pemberitaan` | `NEWS` | Divisi Pemberitaan & Jurnalistik | 2 (Operasional) |
| `Humas` | `PR` | Hubungan Masyarakat & Publikasi | 2 (Operasional) |
| `Advisory` | `ADVS` | Dewan Penasihat & Pembina | 0 (Penasihat) |

- **Foreign Key:** `organization_id` terikat ke organisasi tunggal kanonikal: `PTV Studio` (ID: `a0000000-0000-0000-0000-000000000001`).

---

### DOMAIN 3: ROLE & CAPABILITY REGISTRY

* **Sumber Data Legacy:** Field `role` pada `ptv_kru` (`eksekutif`, `administrasi`, `crew`, `pembina`, `pengarah`).
* **Tabel Tujuan PostgreSQL:** `public.ptv_access_profile`, `public.ptv_capability_registry`, `public.ptv_profile_capability`, `public.ptv_account_profile_assignment`.

| Role Legacy | Profil Kanonikal Target | Total Capabilities | Isolasi Kunci |
| :--- | :--- | :--- | :--- |
| `eksekutif` | `Eksekutif` | 53 (Full Access) | Wewenang approval surat, akses kas utama, valuasi aset |
| `administrasi` | `Administrasi` | 46 | Manajemen kru, surat menyurat, inventaris; tanpa approval tingkat tinggi |
| `crew` | `Kru Operasional` | 28 | Sirkulasi peminjaman, pelaporan kerusakan, pembacaan jadwal & katalog |
| `pembina` | `Pembina` | 18 | Pengawasan jadwal & operasional; **TERISOLASI DARI VALUASI ASET & BUKU KAS** |
| `pengarah` | `Pengarah` | 18 | Pendampingan teknis; **TERISOLASI DARI VALUASI ASET & BUKU KAS** |

- **Hardcoded Legacy Exception Handling:** Pengecualian kru `PTV-023` (*Farsya*) yang pada legacy PHP memiliki akses khusus ke modul keuangan dimigrasikan menggunakan penugasan profil tambahan: `ptv_account_profile_assignment` dengan profile `Operator Keuangan`.

---

### DOMAIN 4: INVENTARIS, UNIT FISIK & VALUASI ASET

* **Sumber Data Legacy:** Tabel MySQL `ptv_inventaris` (148 baris alat).
* **Tabel Tujuan PostgreSQL:**
  1. `public.ptv_inventaris` (Katalog alat publik & operasional)
  2. `public.ptv_inventaris_unit` (Pelacakan barcode & unit fisik)
  3. `public.ptv_nilai_inventaris` (Buku besar valuasi perolehan aset terlindungi)

| Field Sumber (`ptv_inventaris`) | Tabel Target | Field Target | Transformasi & Penanganan Keamanan |
| :--- | :--- | :--- | :--- |
| `id` (INT) | `ptv_inventaris` | `id` (UUID) | Generate `gen_random_uuid()`, catat mapping `legacy_id` -> `new_uuid`. |
| `kode` (VARCHAR) | `ptv_inventaris` | `kode` | `UPPER(TRIM(kode))` (contoh: `CAM-01`). Wajib unik kanonikal. |
| `nama` (VARCHAR) | `ptv_inventaris` | `nama_alat` | `TRIM(nama)`. |
| `kategori` (VARCHAR) | `ptv_inventaris` | `kategori` | Divalidasi terhadap kategori resmi: `Kamera`, `Lensa`, `Audio`, `Lighting`, `Grip`, `Drone`, `Aksesoris`. |
| `spesifikasi` (TEXT) | `ptv_inventaris` | `spesifikasi` | Disalin utuh. |
| `foto` (VARCHAR) | `ptv_inventaris` | `foto_url` | URL dipetakan ke bucket Supabase Storage `inventory`. |
| `harga` (NUMERIC/INT) | `ptv_nilai_inventaris` | `nilai_perolehan`, `nilai_buku_saat_ini` | **ISOLASI TOTAL:** Nilai harga dialihkan ke `ptv_nilai_inventaris`. Kolom `ptv_inventaris.harga_beli` **SELALU DIISI NULL**. |
| `sumber` (VARCHAR) | `ptv_inventaris` | `sumber_perolehan` | Default: `'Yayasan'` atau nilai legacy. |
| `jumlah` (INT) | `ptv_inventaris_unit` | *Generated Rows* | Dibuatkan unit fisik sejumlah `jumlah`. Contoh jika `CAM-01` memiliki 2 unit, dibuatkan unit `CAM-01-U01` dan `CAM-01-U02`. |
| `kondisi` (VARCHAR) | `ptv_inventaris_unit` | `kondisi` | Normalisasi: `'bagus'`, `'rusak_ringan'`, `'rusak_berat'`. |
| `lokasi` (VARCHAR) | `ptv_inventaris_unit` | `lokasi_penyimpanan` | Default: `'Studio PTV'` atau lokasi spesifik legacy. |

---

### DOMAIN 5: PEMINJAMAN ALAT (LOANS)

* **Sumber Data Legacy:** Tabel MySQL `ptv_peminjaman` (215 baris riwayat transaksi).
* **Tabel Tujuan PostgreSQL:** `public.ptv_peminjaman`.

| Field Sumber (`ptv_peminjaman`) | Tabel Target | Field Target | Transformasi & Relasi Foreign Key |
| :--- | :--- | :--- | :--- |
| `id` (INT) | `ptv_peminjaman` | `id` (UUID) | Generate UUID baru. |
| `kode_transaksi` | `ptv_peminjaman` | `transaction_id` | `TRIM(kode_transaksi)`. Multi-unit per transaksi dikelompokkan berdasarkan ID ini. |
| `alat_id` + `unit_idx` | `ptv_peminjaman` | `unit_id` | **Foreign Key:** Di-resolve ke `ptv_inventaris_unit.id` melalui lookup `alat_id` + nomor unit. |
| `peminjam` (VARCHAR) | `ptv_peminjaman` | `peminjam_nama` | Nama peminjam disalin utuh. |
| `keperluan` (TEXT) | `ptv_peminjaman` | `keperluan` | Disalin utuh. |
| `tgl_pinjam` (DATE) | `ptv_peminjaman` | `tanggal_pinjam` | Format `YYYY-MM-DD`. |
| `tgl_kembali_rencana` | `ptv_peminjaman` | `tenggat_kembali` | Format `YYYY-MM-DD`. |
| `tgl_kembali_aktual` | `ptv_peminjaman` | `tanggal_kembali` | Format `YYYY-MM-DD` (NULL jika masih dipinjam). |
| `status` (VARCHAR) | `ptv_peminjaman` | `status` | Normalisasi status: `'dipinjam'`, `'kembali'`, `'terlambat'`. |
| `petugas` (VARCHAR) | `ptv_peminjaman` | `petugas_pinjam_id` | Lookup foreign key ke `canonical_identity.id` berdasarkan nama atau PTV ID petugas. |

---

### DOMAIN 6: ACARA & AGENDA STUDIO

* **Sumber Data Legacy:** Objek `DB.events` dan tabel MySQL `ptv_agenda`.
* **Tabel Tujuan PostgreSQL:** `public.ptv_acara`.

| Field Sumber | Field Target (`ptv_acara`) | Transformasi & Tipe Data |
| :--- | :--- | :--- |
| `id` | `id` (UUID) | UUID baru. |
| `judul` / `nama_acara` | `judul` (VARCHAR 255) | `TRIM(judul)`. |
| `deskripsi` | `deskripsi` (TEXT) | Disalin utuh. |
| `tgl_mulai` | `tanggal_mulai` (TIMESTAMPTZ) | Konversi ke ISO 8601 UTC. |
| `tgl_selesai` | `tanggal_selesai` (TIMESTAMPTZ) | Konversi ke ISO 8601 UTC. |
| `lokasi` | `lokasi` (VARCHAR 255) | Disalin utuh. |
| `kategori` | `kategori` (VARCHAR 64) | Normalisasi: `'Broadcast'`, `'Liputan'`, `'Shooting'`, `'Rapat'`, `'Pelatihan'`. |
| `status` | `status` (VARCHAR 32) | `'rencana'`, `'berlangsung'`, `'selesai'`, `'batal'`. |
| `pj` (Penanggung Jawab) | `penanggung_jawab_id` | Foreign key ke `canonical_identity.id`. |

---

### DOMAIN 7: SURAT RESMI, PERIZINAN & ARSIP

* **Sumber Data Legacy:** Tabel MySQL `ptv_surat`, `ptv_arsip` dan subhalaman `pgSurat()`.
* **Tabel Tujuan PostgreSQL:**
  - `public.ptv_surat_izin` (Pengajuan izin kru / peliputan)
  - `public.ptv_surat_tugas` (Surat tugas resmi pimpinan)
  - `public.ptv_surat_barang` (Surat jalan pengeluaran alat)
  - `public.ptv_arsip_dokumen` (Penyimpanan file arsip digital)

| Field Sumber | Field Target | Aturan Transformasi & Pemisahan Wewenang |
| :--- | :--- | :--- |
| `nomor_surat` | `nomor_surat` | Disalin utuh. Format kanonikal: `.../PTV/EXT/.../2026`. Wajib unik. |
| `perihal` / `keperluan` | `perihal` | Disalin utuh. |
| `pembuat` / `kru_id` | `diajukan_oleh` | **Submitter Separation:** FK ke `canonical_identity.id` pemohon surat. |
| `penyetuju` / `pejabat` | `disetujui_oleh` | **Approver Separation:** FK ke `canonical_identity.id` pimpinan yang mengesahkan (hanya boleh terisi jika status = `'disetujui'`). |
| `file_pdf` / `lampiran` | `file_url` | Path storage file PDF resmi di Supabase Storage bucket `documents`. |
| `status` | `status` | Normalisasi: `'draft'`, `'diajukan'`, `'disetujui'`, `'ditolak'`. |

---

### DOMAIN 8: KEUANGAN, KAS & BUKU KAS KRU

* **Sumber Data Legacy:** Tabel MySQL `ptv_kas` dan `ptv_keuangan`.
* **Tabel Tujuan PostgreSQL:** `public.ptv_keuangan`, `public.ptv_pemasukan`, `public.ptv_pengeluaran`, `public.ptv_kas_kru`.

| Field Sumber | Field Target | Transformasi Keamanan Finansial |
| :--- | :--- | :--- |
| `id` | `id` (UUID) | UUID baru. |
| `tanggal` | `tanggal_transaksi` | `DATE` (format `YYYY-MM-DD`). |
| `kategori` | `kategori` | `'Operasional'`, `'Pengadaan'`, `'Honor'`, `'Kas Kru'`, `'Donasi'`. |
| `jenis` (`masuk`/`keluar`) | `jenis_transaksi` | Dipisahkan ke tabel spesifik `ptv_pemasukan` / `ptv_pengeluaran`. |
| `jumlah` (NUMERIC) | `nominal` | `NUMERIC(15, 2)`. Wajib > 0. |
| `keterangan` | `uraian` | Sanitasi teks keterangan transaksi. |
| `dicatat_oleh` | `dicatat_oleh` | FK ke `canonical_identity.id` operator keuangan pemegang `finance.operator`. |

> [!CAUTION]
> **Financial RLS Barrier:** Seluruh baris pada domain keuangan secara ketat dilindungi RLS `isolate_finance_view`. Role *Pembina*, *Pengarah*, dan kru umum tanpa capability `finance.view` otomatis menerima 0 baris (dilarang melihat buku kas).

---

### DOMAIN 9: CATATAN BERSAMA (COLLABORATIVE NOTES)

* **Sumber Data Legacy:** Tabel MySQL `ptv_catatan` dan state `DB.notes`.
* **Tabel Tujuan PostgreSQL:** `public.ptv_catatan`.

| Field Sumber | Field Target (`ptv_catatan`) | Transformasi |
| :--- | :--- | :--- |
| `id` | `id` (UUID) | UUID baru. |
| `judul` | `judul` (VARCHAR 255) | `TRIM(judul)`. |
| `isi` / `konten` | `isi_catatan` (TEXT) | Disalin utuh (HTML/Markdown sanitized). |
| `penulis` / `kru_id` | `penulis_id` (UUID) | FK ke `canonical_identity.id`. |
| `urutan` (INT) | `posisi_indeks` (INT) | Urutan tampilan kartu catatan pada UI dashboard. |
| `warna` | `warna_kartu` (VARCHAR 32) | Hex color code atau CSS variable token. |
| `updated_at` | `updated_at` (TIMESTAMPTZ) | Timestamp terakhir disunting. |

---

### DOMAIN 10: LOST & FOUND

* **Sumber Data Legacy:** Tabel MySQL `ptv_lost_found` dan state `DB.lost`.
* **Tabel Tujuan PostgreSQL:** `public.ptv_lost_found`.

| Field Sumber | Field Target (`ptv_lost_found`) | Transformasi |
| :--- | :--- | :--- |
| `id` | `id` (UUID) | UUID baru. |
| `nama_barang` | `nama_barang` (VARCHAR 255) | `TRIM(nama_barang)`. |
| `deskripsi` | `deskripsi` (TEXT) | Detail ciri-ciri fisik barang. |
| `lokasi` | `lokasi` (VARCHAR 255) | Lokasi barang ditemukan/hilang. |
| `tanggal` | `tanggal_kejadian` (DATE) | Format `YYYY-MM-DD`. |
| `status` | `status` (VARCHAR 32) | Normalisasi: `'hilang'`, `'ditemukan'`, `'dikembalikan'`. |
| `foto` | `foto_url` (TEXT) | URL foto barang pada Supabase Storage. |
| `pelapor` | `pelapor_id` (UUID) | FK ke `canonical_identity.id` kru pelapor. |

---

### DOMAIN 11: LAPOR KERUSAKAN ALAT (DAMAGE REPORTS)

* **Sumber Data Legacy:** Tabel MySQL `ptv_lapor_masalah` dan state `DB.damages`.
* **Tabel Tujuan PostgreSQL:** `public.ptv_lapor_masalah`.

| Field Sumber | Field Target (`ptv_lapor_masalah`) | Transformasi |
| :--- | :--- | :--- |
| `id` | `id` (UUID) | UUID baru. |
| `unit_id` | `unit_id` (UUID) | **Foreign Key:** Wajib valid ke `ptv_inventaris_unit.id`. |
| `deskripsi` | `deskripsi_kerusakan` (TEXT) | Penjelasan kerusakan fisik atau elektronik. |
| `urgensi` / `tingkat` | `tingkat_keparahan` (VARCHAR 32) | Normalisasi: `'ringan'`, `'sedang'`, `'berat'`, `'kritis'`. |
| `tanggal` | `tanggal_lapor` (TIMESTAMPTZ) | Timestamp saat kerusakan dilaporkan. |
| `status` | `status_perbaikan` (VARCHAR 32) | Normalisasi: `'menunggu_tindakan'`, `'dalam_perbaikan'`, `'selesai'`, `'afkir'`. |
| `pelapor` | `pelapor_id` (UUID) | FK ke `canonical_identity.id`. |

---

### DOMAIN 12: MODUL PENDUKUNG (BROADCAST & PENGATURAN)

* **Sumber Data Legacy:** `ptv_broadcast`, `ptv_settings`, `DB.planners`.
* **Tabel Tujuan PostgreSQL:** `public.ptv_broadcast`, `public.ptv_pengaturan_sistem`.
  - `ptv_broadcast`: Menyimpan notifikasi siaran internal studio (judul, pesan, prioritas, target divisi, waktu kedaluwarsa).
  - `ptv_pengaturan_sistem`: Menyimpan konfigurasi key-value institusional (nama yayasan, kontak call center, jam operasional studio).

---

## 3. URUTAN EKSEKUSI IMPOR DATA BERTAHAP (IMPORT SEQUENCE)

Untuk menjamin integritas relasional dan mencegah kegagalan *foreign key*, data legacy wajib diimpor mengikuti tahapan bertingkat berikut:

```
+-----------------------------------------------------------------------------------+
| TAHAP 1: DATA MASTER INSTITUSIONAL (FONDASI)                                      |
| 1. ptv_organization (PTV Studio)                                                  |
| 2. ptv_division (MGMT, TECH, PROD, CRTV, NEWS, PR, ADVS)                          |
| 3. ptv_capability_registry (53 Capabilities Kanonikal)                           |
| 4. ptv_access_profile & ptv_profile_capability (5 Profil Kanonikal)               |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
| TAHAP 2: ENTITAS IDENTITAS & ANGGOTA (PEOPLE)                                     |
| 5. canonical_identity (Mapping ptv_id & legacy_id dari ptv_kru)                   |
| 6. user_account (Status aktif, username, google_sub placeholder)                  |
| 7. identity_contact (Telepon, No WA, Email Pribadi)                               |
| 8. ptv_organization_membership (Relasi identity_id ke division_id)                |
| 9. ptv_crew_profile (Angkatan, avatar_url, bio)                                   |
| 10. ptv_account_profile_assignment (Penugasan profil Eksekutif, Kru, Pembina, dll)|
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
| TAHAP 3: INVENTARIS FISIK & VALUASI (ASSETS)                                      |
| 11. ptv_inventaris (Master alat, spesifikasi, foto, harga_beli = NULL)            |
| 12. ptv_inventaris_unit (Generate unit fisik berdasarkan kuantitas)               |
| 13. ptv_nilai_inventaris (Alokasi nilai perolehan aset terisolasi)                |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
| TAHAP 4: TRANSAKSI OPERASIONAL & RIWAYAT (TRANSACTIONS)                           |
| 14. ptv_peminjaman (Relasi unit_id & peminjam)                                    |
| 15. ptv_acara (Jadwal broadcast & kegiatan)                                      |
| 16. ptv_surat_* (Surat izin, tugas, barang; Submitter & Approver)                 |
| 17. ptv_keuangan & ptv_kas_kru (Buku kas terisolasi)                              |
| 18. ptv_catatan, ptv_lost_found, ptv_lapor_masalah                                |
| 19. ptv_broadcast & ptv_pengaturan_sistem                                         |
+-----------------------------------------------------------------------------------+
```

---

## 4. STRATEGI ROLLBACK & VERIFIKASI INTEGRITAS DATA

### 4.1 Prosedur Verifikasi Integritas Data Pasca-Impor
Jalankan query audit berikut untuk memverifikasi kelengkapan relasi data:

```sql
-- 1. Verifikasi Jumlah Identitas Sesuai Data Legacy (Harus tepat 42 kru)
SELECT count(*) AS total_canonical_crew FROM public.canonical_identity WHERE ptv_id LIKE 'PTV-%';

-- 2. Pastikan Tidak Ada Kru yang Kehilangan Membership Organisasi
SELECT ci.ptv_id, ci.full_name 
FROM public.canonical_identity ci
LEFT JOIN public.ptv_organization_membership om ON om.identity_id = ci.id
WHERE om.id IS NULL;

-- 3. Pastikan Kolom harga_beli pada ptv_inventaris Bersih (Harus 0 baris bernilai non-null)
SELECT count(*) AS leaked_prices FROM public.ptv_inventaris WHERE harga_beli IS NOT NULL;

-- 4. Pastikan Seluruh Alat Memiliki Rekam Valuasi Terisolasi
SELECT inv.kode, inv.nama_alat 
FROM public.ptv_inventaris inv
LEFT JOIN public.ptv_nilai_inventaris val ON val.inventaris_id = inv.id
WHERE val.id IS NULL;

-- 5. Pastikan Seluruh Peminjaman Memiliki Unit Fisik Valid
SELECT p.id, p.transaction_id 
FROM public.ptv_peminjaman p
LEFT JOIN public.ptv_inventaris_unit u ON u.id = p.unit_id
WHERE u.id IS NULL;
```

### 4.2 Prosedur Rollback Terkontrol (Safe Rollback Protocol)
- **TIDAK MENGGUNAKAN `DROP ... CASCADE`**.
- Jika satu tahapan migrasi data gagal, pembatalan dilakukan secara terbalik (`DELETE FROM` tabel transaksi anak terlebih dahulu) di dalam blok transaksi terkontrol dengan persetujuan Operator:
  ```sql
  BEGIN;
      -- Contoh rollback terkontrol tahap transaksi anak
      DELETE FROM public.ptv_peminjaman WHERE created_at >= '2026-10-17 00:00:00+00';
      DELETE FROM public.ptv_nilai_inventaris WHERE updated_at >= '2026-10-17 00:00:00+00';
      DELETE FROM public.ptv_inventaris_unit WHERE created_at >= '2026-10-17 00:00:00+00';
      DELETE FROM public.ptv_inventaris WHERE created_at >= '2026-10-17 00:00:00+00';
  COMMIT;
  ```

---

## 5. KESIMPULAN & KESIAPAN DATA MIGRATION

Peta migrasi ini telah memetakan 100% domain operasional dashboard PHP legacy ke arsitektur PostgreSQL kanonikal secara backward-compatible. Hubungan relasional, penegakan isolasi finansial, pemisahan valuasi alat, dan integrasi identitas Google sub telah siap untuk dieksekusi oleh Operator pada tahap migrasi staging selanjutnya.

**STATUS:**  
`PHASE 0B DATA MIGRATION BLUEPRINT READY — WAITING FOR OPERATOR REVIEW`
