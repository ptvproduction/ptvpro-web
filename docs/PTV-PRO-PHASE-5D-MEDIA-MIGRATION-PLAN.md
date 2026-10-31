# PTV PRO — PHASE 5D MEDIA MIGRATION PLAN (CLOUDFLARE R2)

**Subsystem:** Media Storage & Asset Management  
**Phase:** Phase 5D — Data & Media Migration Readiness  
**Target Storage:** Cloudflare R2 (Object Storage S3-Compatible)  
**Database Integration:** Supabase (`canonical_identity`, `ptv_inventaris`, `ptv_surat_*`)  
**Status Dokumen:** **`READY FOR MEDIA IMPLEMENTATION DESIGN REVIEW`**  

---

## 1. Keputusan Resmi Pemilik Proyek (Official Project Owner Decisions)

Empat keputusan arsitektur resmi telah ditetapkan oleh Pemilik Proyek untuk memandu desain dan implementasi media storage PTV PRO:

### 1.1 DEC-5D-05 — Pemisahan Bucket Publik dan Privat (RESMI DITETAPKAN)
- **Keputusan:** Menggunakan **dua bucket Cloudflare R2 yang terpisah secara fisik**.
  1. **Bucket Publik:** Khusus media operasional yang telah diverifikasi dan disetujui untuk dapat diakses publik (contoh usulan nama: `ptvpro-media-public`).
  2. **Bucket Privat:** Khusus surat internal, dokumen keuangan/nota, berkas investigasi kerusakan, dan file operasional sensitif (contoh usulan nama: `ptvpro-media-private`).
  *(Catatan: Nama bucket di atas adalah usulan desain; ketersediaan dan penetapan nama final akan diverifikasi saat implementasi tanpa membuat bucket pada tahap ini).*
- **Persyaratan & Batasan Ketat:**
  - Bucket privat **TIDAK BOLEH** dipublikasikan melalui custom domain publik atau Cloudflare Public Access.
  - **Larangan Asumsi Publik Otomatis:** Foto kru dan foto inventaris **TIDAK otomatis** dianggap boleh dipublikasikan; klasifikasi akses dan persetujuan harus divalidasi per entitas.
  - Akses dokumen privat **WAJIB** melalui backend API PTV PRO yang memeriksa autentikasi sesi dan evaluasi kapabilitas pengguna (`documents.read`, `finance.read`).
  - Untuk pembacaan dokumen privat via *pre-signed GET URLs*, masa berlaku dibatasi ketat (maksimal 15 menit) dan hak aksesnya terkunci.
  - Frontend **DILARANG KERAS** menyimpan atau menerima Cloudflare R2 Access Key / Secret Key.
  - **Zero Cloud Mutation:** Dilarang membuat bucket R2 pada tahap perencanaan ini.

### 1.2 DEC-5D-06 — Perencanaan Custom Domain Media (RESMI DITETAPKAN)
- **Keputusan:** Merencanakan domain media khusus sejak awal arsitektur.
- **Rencana Teknis Domain:**
  - Mengalokasikan rencana subdomain khusus seperti `media.ptvpro.com` untuk melayani aset dari bucket publik melalui Cloudflare Edge CDN.
  - *(Catatan Penting: Subdomain `media.ptvpro.com` adalah contoh perencanaan arsitektural yang **belum disahkan, belum dimiliki, dan belum dikonfigurasi secara operasional**).*
- **Persyaratan & Batasan Isolasi:**
  - **Zero DNS Mutation:** Dilarang mengubah rekaman DNS, konfigurasi zona, atau routing domain saat ini.
  - **Isolasi Mutlak:** Domain publik **HANYA** boleh melayani konten publik dari bucket publik. Bucket privat secara teknis **TIDAK DAPAT** diakses melalui domain publik.
  - Wajib menerapkan HTTPS enforced, cache control terisolasi (misal `Cache-Control: public, max-age=86400`), dan konfigurasi CORS ketat untuk mencegah kebocoran data.
  - Persyaratan teknis, dukungan sertifikat SSL/TLS, batas request, dan kalkulasi harga aktual wajib diverifikasi berdasarkan dokumentasi resmi Cloudflare saat implementasi.

### 1.3 DEC-5D-07 — Audit Struktur Metadata Sebelum Keputusan Tabel Baru (RESMI DITETAPKAN)
- **Keputusan:** **Audit menyeluruh struktur yang sudah ada terlebih dahulu** sebelum memutuskan apakah tabel metadata baru diperlukan.
- **Kebijakan Skema:** **TIDAK langsung membuat atau menyetujui tabel `public.app_media_object`**.
- **Hasil Audit Struktur Database Eksisting:**
  - *Kolom Media Eksisting yang Terbukti Ada:*
    1. `canonical_identity.avatar_url` (`TEXT NULL`) — foto profil kru.
    2. `ptv_inventaris.foto_url` (`TEXT NULL`) — foto katalog alat/barang.
    3. `ptv_lost_found.foto_url` (`TEXT NULL`) — foto dokumentasi barang temuan.
  - *Kolom Lampiran pada Transaksi Operasional & Surat:*
    1. `ptv_surat_tugas`: saat ini memiliki kolom `kru_terlibat JSONB`, belum memiliki kolom berkas fisik PDF.
    2. `ptv_surat_izin`: saat ini belum memiliki kolom lampiran berkas PDF.
    3. `ptv_surat_barang`: memiliki `daftar_barang JSONB`, belum memiliki kolom lampiran PDF.
    4. `ptv_lapor_masalah`: belum memiliki kolom foto kerusakan eksplisit.
    5. `ptv_keuangan`: belum memiliki kolom berkas bukti nota/kuitansi eksplisit.
- **Evaluasi Kebutuhan & Implikasi Arsitektural:**
  - *Opsi A (Kolom URL Denormalized pada Tabel Eksisting):* Cukup untuk avatar dan foto inventaris, namun tidak memadai untuk mencatat metadata file biner (MIME type, byte size, checksum SHA-256, original file name, dan status verifikasi migrasi).
  - *Opsi B (Tabel Metadata Terpusat `app_media_object`):* Menyediakan pelacakan komprehensif, multi-attachment per surat/nota, integritas relasional, audit kepemilikan file, dan isolasi RLS.
  - *Status:* Opsi B didokumentasikan sebagai **proposal arsitektur teknis** yang memerlukan peninjauan lanjutan pemilik proyek sebelum DDL dirumuskan. **Dilarang menjalankan DDL/DML atau memodifikasi baseline SQL.**

### 1.4 DEC-5D-08 — Karantina File Orphan WordPress (RESMI DITETAPKAN)
- **Keputusan:** File fisik di direktori upload WordPress yang tidak memiliki relasi data yang jelas **harus dicatat dan dikarantina dalam manifest audit**. File orphan **DILARANG dimigrasikan secara otomatis**.
- **Format Manifest Audit Read-Only (Usulan Desain Manifest):**
  Manifest berbasis JSON/CSV terstruktur mencatat:
  1. `source_path`: Jalur file relatif di WordPress (misal `wp-content/uploads/2024/05/foto.jpg`).
  2. `file_size_bytes`: Ukuran file dalam bytes.
  3. `detected_mime`: MIME type hasil pembacaan magic header.
  4. `checksum_sha256`: Hash integritas SHA-256.
  5. `legacy_db_ref`: Kueri rujukan database WordPress jika ditemukan kaitan parsial.
  6. `relation_status`: `VERIFIED` | `NOT_FOUND` | `AMBIGUOUS` | `BROKEN`.
  7. `quarantine_reason`: Alasan masuk daftar karantina (misal: *Unreferenced post image*, *Duplicate checksum*, *Legacy orphaned thumbnail*).
  8. `pending_action`: Status tindak lanjut menunggu tinjauan operator (`RETAIN_ON_LEGACY`, `INVESTIGATE`, `DISCARD`).
- **Ketentuan Keamanan Data Legacy:**
  - **Dilarang menghapus file fisik** di server WordPress.
  - **Dilarang memindahkan file secara fisik** ke direktori lain pada tahap ini.
  - **Dilarang mengunggah file orphan ke Cloudflare R2**.
  - **Larangan Asumsi Tergesa-gesa:** Dilarang menyimpulkan file tidak dibutuhkan hanya karena satu kolom URL kosong; lakukan penelusuran referensi relasional lain terlebih dahulu.
  - Seluruh keputusan dapat ditinjau ulang (*reversible*) sebelum cutover resmi.

---

## 2. Cakupan dan Pengecualian Migrasi Media

Cakupan media ditetapkan secara ketat untuk operasional PTV PRO:

### 2.1 Media Dalam Cakupan Migrasi (In-Scope)
| Kategori Media | Sumber Rujukan Legacy | Deskripsi & Tujuan | Target Penyimpanan | Kebijakan Akses |
| :--- | :--- | :--- | :---: | :---: |
| **Foto Kru (Avatars)** | Dirujuk oleh `wp_ptv_kru.foto_url` | Foto profil identitas kru PTV Studio untuk administrasi dan direktori internal. | Bucket Publik (Terverifikasi) | Publik Terkontrol / Internal |
| **Foto Inventaris** | Dirujuk oleh `wp_ptv_inventaris.foto_url` | Foto alat studio (kamera, tripod, mixer, lighting) untuk katalog inventaris. | Bucket Publik | Publik Terkontrol |
| **Foto Barang Temuan** | Dirujuk oleh `wp_ptv_lost_found.foto_url` | Foto fisik barang hilang/ditemukan di studio. | Bucket Publik | Publik Terkontrol |
| **Lampiran & Dokumen Surat** | Berkas PDF persuratan resmi studio | Surat tugas, izin keluar, dan surat jalan barang bertanda tangan. | **Bucket Privat** | **PRIVAT (Ketat)** |
| **Bukti Operasional & Nota** | Bukti transaksi keuangan studio / reparasi | Kuitansi pengeluaran, nota servis alat, bukti transfer. | **Bucket Privat** | **PRIVAT (Ketat)** |

### 2.2 Media di Luar Cakupan Migrasi (Out-of-Scope)
- ❌ **Media Postingan Berita & Artikel WordPress:** Seluruh gambar featured image, gambar artikel berita, dan galeri majalah di `progresiftv.id`.
- ❌ **Galeri Publik & Portofolio Non-Studio:** Foto event publik yang tidak terikat dengan transaksi inventaris atau persuratan resmi PTV PRO.
- ❌ **Aset Tema, Plugin & Core WordPress:** File CSS, ikon tema, banner plugin WordPress, cache media.
- ❌ **Thumbnail Otomatis WordPress:** Ukuran turunan seperti `-150x150.jpg`, `-300x200.jpg`, `-768x...jpg`, `-1024x...jpg`. Hanya file resolusi asli (*master original*) yang diproses.
- ❌ **File Orphan yang Belum Terverifikasi:** Seluruh file tanpa relasi data jelas otomatis dikarantina dalam manifest audit.

---

## 3. Arsitektur Media & Alur Akses (Upload & Download Flow)

Prinsip dasar arsitektur:
> **"Browser/Frontend TIDAK PERNAH memegang kredensial Cloudflare R2 (Access Key / Secret Key). Supabase TIDAK PERNAH menyimpan file biner. Seluruh upload dan akses media privat wajib terotentikasi dan terotorisasi."**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ARSITEKTUR MEDIA PTV PRO                              │
└─────────────────────────────────────────────────────────────────────────────────┘

 [A] ALUR UNGGAH AMAN (SECURE DIRECT UPLOAD)
  Klien (Frontend)            PTV PRO Upload Service / Edge Worker         Cloudflare R2 Bucket
        │                                     │                                     │
   1.   │─── Request Pre-signed Upload URL ──>│ (Validasi Autentikasi,              │
        │    (MIME, size, kategori, relasi)   │  Otorisasi Kapabilitas,             │
        │                                     │  Generate Object Key Unik)          │
   2.   │<── Return Pre-signed PUT URL ───────│                                     │
        │    (Valid maks 15 menit)            │                                     │
   3.   │────────────────────────────── Direct HTTP PUT ───────────────────────────>│
        │                                                                           │
   4.   │─── Confirm Upload Completed ───────>│ (Verifikasi R2 HeadObject,          │
        │    (Media Key / ID)                 │  Validasi MIME, Size, Simpan DB)    │
        │<── Confirmation OK ─────────────────│                                     │

 [B] ALUR AKSES MEDIA PUBLIK (AVATAR & INVENTARIS)
  Klien (Browser) ────────────────── HTTP GET ─────────────────────> Cloudflare Edge CDN / Cache
                                                                           │ (Cache Miss)
                                                                           ▼
                                                                  R2 Public Bucket

 [C] ALUR AKSES MEDIA PRIVAT (SURAT, NOTA, DOKUMEN INTERNAL)
  Klien (Browser)            PTV PRO Media Gatekeeper Service              Cloudflare R2 Private Bucket
        │                                     │                                     │
   1.   │─── Request View Document ──────────>│ (Verifikasi Sesi & Kapabilitas:     │
        │                                     │  documents.read / finance.read)     │
   2.   │<── Return Short-Lived Pre-signed ───│ (Signed GET URL berlaku maks 15 mnt)│
        │    URL (Valid 15 Mins)              │                                     │
   3.   │───────────────────────── Fetch Signed GET URL ───────────────────────────>│
```

---

## 4. Analisis Skema Metadata Media (Hasil Audit DEC-5D-07)

### 4.1 Inventaris Struktur Kolom Media Eksisting
Berdasarkan pemeriksaan aktual [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql), kolom penyimpan rujukan URL yang saat ini aktif adalah:

| Tabel Kanonikal | Kolom URL | Tipe Data | Status Rujukan | Klasifikasi Akses |
| :--- | :--- | :---: | :---: | :---: |
| `public.canonical_identity` | `avatar_url` | `TEXT NULL` | Profil kru studio | Publik Terkontrol |
| `public.ptv_inventaris` | `foto_url` | `TEXT NULL` | Katalog barang/alat studio | Publik Terkontrol |
| `public.ptv_lost_found` | `foto_url` | `TEXT NULL` | Bukti fisik barang temuan | Publik Terkontrol |

### 4.2 Kesenjangan Data untuk Dokumen Privat
Tabel operasional persuratan dan keuangan saat ini belum memiliki struktur untuk menyimpan metadata file dokumen:
- `ptv_surat_tugas`, `ptv_surat_izin`, `ptv_surat_barang`: belum memiliki kolom lampiran PDF berkas fisik.
- `ptv_keuangan`: belum memiliki kolom berkas nota/kuitansi fisik.
- `ptv_lapor_masalah`: belum memiliki kolom foto kerusakan alat fisik.

### 4.3 Proposal Arsitektur Terpisah: Tabel Terpusat `app_media_object`
Untuk mendukung kebutuhan di atas tanpa mengotori tabel bisnis utama, diusulkan struktur metadata terpusat (proposal desain, **belum dieksekusi DDL**):

```sql
-- PROPOSAL DESAIN TEKNIS (STATUS: PROPOSAL — BELUM DIEKSEKUSI DDL)
CREATE TABLE IF NOT EXISTS public.app_media_object (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    r2_bucket VARCHAR(64) NOT NULL,
    r2_key VARCHAR(512) NOT NULL UNIQUE,
    category VARCHAR(32) NOT NULL CHECK (category IN ('avatar', 'inventaris', 'lost_found', 'surat', 'finance', 'operational')),
    access_tier VARCHAR(16) NOT NULL DEFAULT 'private' CHECK (access_tier IN ('public', 'private')),
    file_name_original VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    checksum_sha256 VARCHAR(64) NULL,
    owner_identity_id UUID NULL REFERENCES public.canonical_identity(id) ON DELETE SET NULL,
    related_entity_type VARCHAR(64) NOT NULL, -- 'canonical_identity', 'ptv_inventaris', 'ptv_surat_tugas', dll.
    related_entity_id UUID NULL,
    migration_status VARCHAR(32) NOT NULL DEFAULT 'READY' CHECK (migration_status IN ('DISCOVERED', 'READY', 'UPLOADED', 'VERIFIED', 'FAILED')),
    legacy_source_url TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_media_category ON public.app_media_object (category);
CREATE INDEX IF NOT EXISTS idx_app_media_related ON public.app_media_object (related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_app_media_migration ON public.app_media_object (migration_status);
```

---

## 5. Konvensi Kunci Objek R2 (Object Key Convention) & Struktur Folder

Object key dirancang **deterministik, acak/UUID-based, dan bebas dari data pribadi sensitif (No PII)**:

```
[r2-root]/
├── public-bucket/
│   ├── avatars/
│   │   └── {canonical_ptv_id}/{random_uuid}.{ext}      (Contoh: avatars/PTV-001/a9f8e321.jpg)
│   ├── inventaris/
│   │   └── {kode_alat}/{random_uuid}.{ext}            (Contoh: inventaris/INV-001/f81c9b20.png)
│   └── lost-found/
│       └── {random_uuid}.{ext}
│
└── private-bucket/
    ├── surat/
    │   ├── tugas/{tahun}/{nomor_slug}_{uuid}.pdf
    │   ├── izin/{tahun}/{nomor_slug}_{uuid}.pdf
    │   └── barang/{tahun}/{nomor_slug}_{uuid}.pdf
    ├── keuangan/
    │   └── {tahun}/{bulan}/nota_{voucher_code}_{uuid}.{ext}
    └── lapor-masalah/
        └── {tahun}/qc_{lapor_id}_{uuid}.{ext}
```

---

## 6. Inventaris Sumber File WordPress & Rencana Manifest Karantina (DEC-5D-08)

Proses audit inventarisasi file legacy dilakukan secara **Strictly Read-Only**:

```
[WordPress File System: wp-content/uploads/]       [WordPress MySQL Database: $wpdb]
           │                                                       │
           ▼                                                       ▼
 [Scan Direktori File (Read-Only)]                   [Scan Kolom URL Referensi (Read-Only)]
 - Jalur fisik file                                  - wp_ptv_kru.foto_url
 - Ukuran file (bytes)                               - wp_ptv_inventaris.foto_url
 - Checksum SHA-256                                  - wp_ptv_lost_found.foto_url
 - Deteksi MIME type                                 - Rujukan surat / lampiran
           │                                                       │
           └───────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
                   [Klasifikasi & Pembuatan Manifest]
                   ├── KATEGORI 1: VERIFIED IN-SCOPE (Siap Proses R2)
                   ├── KATEGORI 2: REFERENCED BUT MISSING (Catat di Log Anomali)
                   ├── KATEGORI 3: AMBIGUOUS (Karantina untuk Review)
                   └── KATEGORI 4: UNREFERENCED / ORPHAN (Karantina Manifest)
```

### Format Manifest Karantina File Orphan (`orphan-media-manifest.json`):
```json
{
  "manifest_version": "1.0",
  "generated_at": "2026-10-10T00:00:00Z",
  "quarantined_files": [
    {
      "source_path": "wp-content/uploads/2023/11/IMG_9912.jpg",
      "file_size_bytes": 2451092,
      "detected_mime": "image/jpeg",
      "checksum_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "legacy_db_ref": null,
      "relation_status": "NOT_FOUND",
      "quarantine_reason": "No reference in operational tables ($wpdb->ptv_*)",
      "pending_action": "RETAIN_ON_LEGACY"
    }
  ]
}
```

---

## 7. Pengamanan Dokumen Privat (Zero Trust Access Control)

1. **Pemisahan Bucket Fisik:** Mengeliminasi risiko salah routing CDN pada file rahasia. Bucket privat sama sekali tidak memiliki origin URL publik.
2. **Pre-signed URL Terbatas:** Masa berlaku maksimal **15 menit** (900 detik). URL dibuat on-demand melalui API backend PTV PRO setelah mengevaluasi kapabilitas token JWT pengguna.
3. **Validasi Unggahan (Upload Guards):**
   - Batas ukuran: Avatar (2 MB), Inventaris (5 MB), Dokumen PDF (10 MB).
   - Whitelist MIME: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.

---

## 8. Strategi Migrasi Bertahap, Verifikasi, Cutover, & Rollback

### Tahap 1: Ekstraksi & Manifestasi Media (Read-Only)
- Menghasilkan manifest file in-scope dan manifest file karantina orphan.
- Menghitung checksum SHA-256 dari sumber legacy tanpa memindahkan file fisik.

### Tahap 2: Staging Upload ke Cloudflare R2
- Mengunggah file in-scope ke bucket Cloudflare R2 staging via script batch idempotence.

### Tahap 3: Verifikasi Integritas Biner
- Membandingkan `HeadObject` R2 (ukuran dan ETag/checksum) dengan manifest lokal.
- Pengujian acak keterbacaan file (*sampling read test*).

### Tahap 4: Penautan Database Staging
- Memperbarui kolom `avatar_url` dan `foto_url` untuk merujuk ke Cloudflare R2.

### Tahap 5: Cutover & Kontinjensi Rollback
- **WordPress Tetap Beroperasi:** Server WordPress legacy tetap menjadi sumber data dan media selama masa pengujian dan migrasi berlangsung.
- **Rollback Aman:** Jika terjadi masalah pada akses R2 atau CDN saat evaluasi, kolom database Supabase dapat dikembalikan ke URL legacy via database snapshot dalam hitungan menit.

---

## 9. Estimasi Kebutuhan Penyimpanan & Biaya Cloudflare R2

*Catatan: Kalkulasi ini merupakan estimasi perencanaan teknis berdasarkan volume studio internal, bukan jaminan biaya pasti.*

| Parameter | Estimasi Volume PTV PRO | Kuota Gratis Cloudflare R2 (Free Tier) | Estimasi Biaya Bulanan |
| :--- | :---: | :---: | :---: |
| **Kapasitas Penyimpanan** | ± 5 GB s.d. 15 GB | **10 GB / bulan gratis** | $0.00 – $0.08 / bulan ($0.015/GB untuk kelebihan) |
| **Operasi Kelas A (Upload, List)** | ± 2.000 req/bulan | **1.000.000 req / bulan gratis** | **$0.00 (Gratis)** |
| **Operasi Kelas B (Download, Head)** | ± 50.000 req/bulan | **10.000.000 req / bulan gratis** | **$0.00 (Gratis)** |
| **Bandwidth Keluar (Egress)** | ± 20 GB s.d. 50 GB | **UNLIMITED / $0 per GB** | **$0.00 (Gratis)** |

---

## 10. Status Akhir Dokumen Rencana Media

```
================================================================================
STATUS AKHIR: READY FOR MEDIA IMPLEMENTATION DESIGN REVIEW
================================================================================
```
Dokumen ini merangkum keputusan resmi arsitektur media storage Cloudflare R2 dan batasan pelaksanaannya. Dokumen ini **tidak menyatakan** bahwa bucket telah dibuat, domain telah aktif, atau migrasi data telah selesai.
