# PTV PRO — PHASE 5D MEDIA METADATA SCHEMA PROPOSAL
## KONSEPTUAL METADATA MEDIA & ARSITEKTUR RELASI (CLOUDFLARE R2)

**Subsystem:** Database Architecture & Media Storage  
**Phase:** Phase 5D — Media Metadata Schema Proposal  
**Target Environment:** Cloudflare R2 & Supabase Database Staging/Production  
**Authoritative Contracts:**  
- [docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md)  
- [docs/PTV-PRO-IDENTITY-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-IDENTITY-AUTH-CONTRACT.md)  
- [docs/PTV-PRO-PHASE-5D-MEDIA-MIGRATION-PLAN.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PHASE-5D-MEDIA-MIGRATION-PLAN.md)  
- [docs/PTV-PRO-PHASE-5D-MEDIA-IMPLEMENTATION-DESIGN.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PHASE-5D-MEDIA-IMPLEMENTATION-DESIGN.md)  
**Status Proposal:** **`READY FOR DBA SCHEMA REVIEW`**  
*(Catatan Mutlak: Dokumen ini adalah PROPOSAL KONSEPTUAL untuk ditinjau oleh DBA dan Pemilik Proyek. Dilarang mengeksekusi DDL/DML, dilarang mengubah baseline SQL, dan dilarang membuat bucket R2 pada tahap ini).*

---

## 1. Latar Belakang & Rasional Desain `app_media_object`

Pada audit Phase 5D sebelumnya, teridentifikasi bahwa:
1. Kolom URL flat yang tersedia saat ini (`canonical_identity.avatar_url`, `ptv_inventaris.foto_url`, `ptv_lost_found.foto_url`) hanya menyimpan string teks mentah tanpa metadata biner (ukuran bytes, MIME header asli, checksum SHA-256 integritas, status upload, maupun waktu verifikasi).
2. Modul persuratan resmi (`ptv_surat_tugas`, `ptv_surat_izin`, `ptv_surat_barang`) dan modul keuangan (`ptv_keuangan`) saat ini **belum memiliki kolom fisik** untuk menyimpan berkas lampiran PDF atau kuitansi.
3. Menambahkan kolom flat satu per satu (misal: `lampiran_url TEXT`) memiliki kelemahan mendasar: membatasi transaksi hanya pada 1 file (tidak mendukung multi-lampiran), tidak memiliki audit log, dan rentan terhadap file yatim (*orphaned objects*) di storage saat baris di-update.

Oleh karena itu, **tabel metadata terpusat `public.app_media_object`** direkomendasikan sebagai arah desain utama untuk mengelola seluruh metadata siklus hidup objek Cloudflare R2 secara transaksional dan teratur.

---

## 2. Rancangan Skema Konseptual `app_media_object`

### 2.1 Analisis Kebutuhan Kolom & Evaluasi Tipe Data

| Nama Kolom | Tipe Data yang Diusulkan | Constraint & Default | Kebutuhan & Rasional Desain |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Identifier unik global untuk setiap objek media di sistem PTV PRO. |
| `r2_bucket` | `VARCHAR(64)` | `NOT NULL` | Nama bucket Cloudflare R2 fisik (contoh: `ptvpro-media-public` atau `ptvpro-media-private`). |
| `r2_key` | `VARCHAR(512)` | `NOT NULL UNIQUE` | Kunci objek R2 lengkap yang unik dan stabil (contoh: `private/surat/tugas/2026/012-st_a8f9.pdf`). |
| `category` | `VARCHAR(32)` | `NOT NULL CHECK (category IN ('avatar', 'inventaris', 'lost_found', 'surat', 'finance', 'operational'))` | Kategori media untuk pengelompokan kebijakan dan folder. |
| `access_tier` | `VARCHAR(16)` | `NOT NULL DEFAULT 'private' CHECK (access_tier IN ('public', 'private'))` | **Default 'private'**. Klasifikasi akses. Foto kru default privat (DEC-5D resmi). |
| `file_name_original` | `VARCHAR(255)` | `NOT NULL` | Nama file asli saat diunggah klien (untuk header download `Content-Disposition`). |
| `mime_type` | `VARCHAR(128)` | `NOT NULL` | MIME type biner terverifikasi (whitelist: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`). |
| `file_size_bytes` | `BIGINT` | `NOT NULL CHECK (file_size_bytes > 0)` | Ukuran biner file dalam satuan bytes untuk audit kuota dan verifikasi ukuran. |
| `checksum_sha256` | `VARCHAR(64)` | `NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$')` | Hash SHA-256 integritas biner (64 karakter heksadesimal). Wajib diisi setelah status `READY`. |
| `lifecycle_status` | `VARCHAR(32)` | `NOT NULL DEFAULT 'UPLOAD_PENDING' CHECK (lifecycle_status IN ('UPLOAD_PENDING', 'VERIFIED_READY', 'REPLACED_ARCHIVED', 'FAILED_CORRUPT', 'TOMBSTONE_DELETED'))` | Status siklus hidup objek (lihat Seksi 4). |
| `owner_identity_id` | `UUID` | `NULL REFERENCES public.canonical_identity(id) ON DELETE SET NULL` | Pemilik identitas yang memiliki file (misal pemilik foto avatar atau pelapor masalah). |
| `uploaded_by` | `UUID` | `NOT NULL REFERENCES public.canonical_identity(id) ON DELETE RESTRICT` | Aktor kru yang melakukan inisiasi pengunggahan file (audit trail mutlak). |
| `target_entity_type` | `VARCHAR(64)` | `NOT NULL` | Nama tabel entitas yang ditautkan (misal `'ptv_inventaris'`, `'ptv_surat_tugas'`). |
| `target_entity_id` | `UUID` | `NULL` | ID baris pada tabel target (bukan foreign key polimorfik mentah, lihat mitigasi Seksi 3). |
| `legacy_source_path` | `TEXT` | `NULL` | Jalur relatif file lama di WordPress jika objek merupakan hasil migrasi legacy. |
| `reconciliation_status`| `VARCHAR(32)` | `NOT NULL DEFAULT 'NOT_APPLICABLE' CHECK (reconciliation_status IN ('NOT_APPLICABLE', 'PENDING_MIGRATION', 'MIGRATED_MATCH', 'ORPHAN_QUARANTINE'))` | Pelacakan status rekonsiliasi data dari WordPress legacy. |
| `metadata` | `JSONB` | `NOT NULL DEFAULT '{}'::jsonb` | Metadata tambahan (dimensi gambar, EXIF yang dibersihkan, page count PDF, dll.). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Waktu pembuatan / request upload URL. |
| `verified_at` | `TIMESTAMPTZ` | `NULL` | Waktu saat objek biner berhasil diverifikasi di Cloudflare R2 (`HeadObject`). |
| `deleted_at` | `TIMESTAMPTZ` | `NULL` | Timestamp soft-delete untuk audit trail (tombstone). |

---

## 3. Strategi Relasi & Pencegahan Bahaya Foreign Key Polimorfik

Dalam arsitektur basis data relasional, penggunaan relasi polimorfik mentah (`target_entity_type` + `target_entity_id UUID` tanpa foreign key constraint database) memiliki risiko serius:
- **Risiko Data Yatim (Orphan Records):** Jika sebuah transaksi di `ptv_surat_tugas` dihapus, baris media di `app_media_object` dapat tertinggal tanpa pemilik.
- **Ketiadaan Validasi Integritas Referential:** PostgreSQL tidak dapat memvalidasi apakah `target_entity_id` benar-benar ada di tabel tujuan jika tidak terikat constraint `REFERENCES`.

### Solusi Desain yang Diusulkan untuk DBA:
Untuk menjaga integritas referensial tanpa menciptakan 10 tabel media terpisah, DBA memiliki 2 opsi arsitektur:

#### Opsi 1 (Tabel Junction Terikat Kuat / Strong Typed Junctions — Sangat Direkomendasikan):
`app_media_object` menjadi master metadata file, dan tabel junction eksplisit mengaitkan entitas:
- `ptv_surat_tugas_attachments (surat_id UUID REFERENCES ptv_surat_tugas(id) ON DELETE CASCADE, media_id UUID REFERENCES app_media_object(id) ON DELETE RESTRICT)`
- `ptv_keuangan_receipts (keuangan_id UUID REFERENCES ptv_keuangan(id) ON DELETE RESTRICT, media_id UUID REFERENCES app_media_object(id) ON DELETE RESTRICT)`
*Keuntungan:* Foreign key 100% ditegakkan di level engine PostgreSQL; integritas referensial terjamin sempurna.

#### Opsi 2 (Denormalized Soft Link + Kolom URL Caching):
`app_media_object` mencatat `target_entity_type` dan `target_entity_id`, sementara tabel bisnis menyimpan kolom penunjuk `media_id UUID REFERENCES app_media_object(id)`:
- `ptv_inventaris.media_foto_id UUID REFERENCES app_media_object(id) ON DELETE SET NULL`
- `canonical_identity.media_avatar_id UUID REFERENCES app_media_object(id) ON DELETE SET NULL`

---

---

## 3. Strategi Relasi & Pencegahan Bahaya Foreign Key Polimorfik

Dalam arsitektur basis data relasional, pencatatan `target_entity_type VARCHAR(64)` dan `target_entity_id UUID` tanpa foreign key constraint database merupakan **relasi polimorfik semu** (*pseudo-polymorphic soft reference*).

### 3.1 Audit Kategori Media Terhadap Tabel Eksisting
Berdasarkan pengecekan aktual terhadap [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql):

| Kategori Media | Entitas Pemilik Eksisting | Primary Key Target | Status Foreign Key Native Database |
| :--- | :--- | :---: | :---: |
| `avatar` | `public.canonical_identity` | `id UUID` | **Dapat Ditegakkan:** `owner_identity_id REFERENCES canonical_identity(id)` |
| `inventaris` | `public.ptv_inventaris` | `id UUID` | **Belum Ada FK:** Tabel inventaris tidak memiliki kolom FK ke media; `app_media_object` tidak bisa FK langsung jika target dinamis. |
| `lost_found` | `public.ptv_lost_found` | `id UUID` | **Belum Ada FK:** Kolom di tabel adalah `foto_url TEXT NULL`. |
| `surat` | `ptv_surat_tugas`, `ptv_surat_izin`, `ptv_surat_barang` | `id UUID` | **Belum Ada FK:** Ketiga tabel tidak memiliki kolom lampiran. |
| `finance` | `ptv_keuangan` | `id UUID` | **Belum Ada FK:** Tabel tidak memiliki kolom lampiran nota. |
| `operational` | `ptv_lapor_masalah` | `id UUID` | **Belum Ada FK:** Tabel tidak memiliki kolom foto kerusakan alat. |

### 3.2 Solusi Desain yang Diusulkan untuk DBA:
Untuk menjaga integritas referensial tanpa membiarkan data yatim (*orphan records*) menumpuk saat baris bisnis dihapus:

#### Opsi 1 (Tabel Junction Terikat Kuat / Strong Typed Junctions — Sangat Direkomendasikan untuk Surat & Keuangan):
`app_media_object` menjadi master metadata file fisik, dan tabel junction eksplisit mengaitkan entitas secara formal:
```sql
-- Junction Persuratan:
CREATE TABLE IF NOT EXISTS public.ptv_surat_tugas_lampiran (
    surat_id UUID NOT NULL REFERENCES public.ptv_surat_tugas(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES public.app_media_object(id) ON DELETE RESTRICT,
    urutan INT NOT NULL DEFAULT 1,
    PRIMARY KEY (surat_id, media_id)
);

-- Junction Keuangan:
CREATE TABLE IF NOT EXISTS public.ptv_keuangan_bukti (
    keuangan_id UUID NOT NULL REFERENCES public.ptv_keuangan(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES public.app_media_object(id) ON DELETE RESTRICT,
    keterangan_bukti VARCHAR(128) NULL,
    PRIMARY KEY (keuangan_id, media_id)
);
```
*Keuntungan:* Foreign key 100% ditegakkan di level engine PostgreSQL; integritas referensial terjamin mutlak tanpa risiko salah rujuk ID.

#### Opsi 2 (Denormalized Dedicated Columns pada Tabel Master):
Untuk entitas yang hanya membutuhkan 1 media primer (avatar dan inventaris):
- `canonical_identity.media_avatar_id UUID NULL REFERENCES public.app_media_object(id) ON DELETE SET NULL`
- `ptv_inventaris.media_foto_id UUID NULL REFERENCES public.app_media_object(id) ON DELETE SET NULL`
- `ptv_lost_found.media_foto_id UUID NULL REFERENCES public.app_media_object(id) ON DELETE SET NULL`

---

## 4. Lifecycle Media & State Transition Matrix

Objek media tidak boleh langsung dianggap aktif begitu request dibuat. State machine dirancang **fail-closed** dan **non-destructive terhadap objek aktif**:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          MEDIA LIFECYCLE STATE MACHINE                          │
└─────────────────────────────────────────────────────────────────────────────────┘

                [POST /upload-request]
                          │
                          ▼
                 ┌──────────────────┐
                 │  UPLOAD_PENDING  │  (TTL: 15 Menit. Klien menerima Pre-signed PUT)
                 └────────┬─────────┘
                          │
            ┌─────────────┴─────────────┐
   [Upload & Check OK]         [Timeout / Corrupt / Size Mismatch]
            │                                   │
            ▼                                   ▼
  ┌──────────────────┐                ┌──────────────────┐
  │  VERIFIED_READY  │                │  FAILED_CORRUPT  │
  └────────┬─────────┘                └──────────────────┘
           │                                    │
    [Ganti Objek Baru]                 [Auto Purge R2 Orphan]
           │                                    │
           ▼                                    ▼
  ┌──────────────────┐                ┌──────────────────┐
  │REPLACED_ARCHIVED │                │TOMBSTONE_DELETED │
  └────────┬─────────┘                └──────────────────┘
           │                                    ▲
           └───────────[Soft-Delete]────────────┘
```

### Transisi Status & Proteksi Objek Aktif:
1. **`UPLOAD_PENDING` $\rightarrow$ `VERIFIED_READY`:**  
   Setelah klien selesai mengunggah file biner via HTTP PUT ke R2, klien memanggil `/upload-confirm`. Backend mengeksekusi `HeadObject` ke R2, memvalidasi `Content-Length`, memeriksa MIME header biner, menghitung SHA-256, dan mencatat `verified_at = now()`.
2. **`UPLOAD_PENDING` $\rightarrow$ `FAILED_CORRUPT`:**  
   Jika dalam 30 menit tidak ada konfirmasi upload atau ukuran file di R2 tidak cocok, status otomatis menjadi `FAILED_CORRUPT`. Objek yatim di R2 dibersihkan tanpa mengganggu database.
3. **PENGGANTIAN FILE AMAN (Non-Destructive Replacement Guard):**  
   Ketika pengguna mengganti avatar atau foto inventaris:
   - File baru **WAJIB diunggah sebagai entri baru** dengan status `UPLOAD_PENDING`.
   - Objek lama yang sedang aktif (`VERIFIED_READY`) **TETAP AKTIF DAN UTUH** selama proses pengunggahan file baru berlangsung.
   - **Jika upload file baru GAGAL / TIMEOUT:** File baru masuk ke `FAILED_CORRUPT`, dan **file aktif lama sama sekali tidak terpengaruh atau terhapus**.
   - **Hanya setelah file baru sukses berstatus `VERIFIED_READY`:** Entri database lama ditransisikan ke `REPLACED_ARCHIVED`, dan foreign key diarahkan ke media baru.
4. **`VERIFIED_READY` $\rightarrow$ `TOMBSTONE_DELETED`:**  
   Penghapusan logis (soft-delete). Baris database dipertahankan untuk kebutuhan audit, kolom `deleted_at` diisi, dan file biner R2 dijadwalkan untuk dihapus/diasipkan.
5. **REKONSILIASI FILE LEGACY (`PENDING_MIGRATION` $\rightarrow$ `MIGRATED_MATCH` / `ORPHAN_QUARANTINE`):**  
   File hasil pemindaian WordPress legacy dicatat status rekonsiliasinya. File yang memiliki pasangan data operasional sah berubah menjadi `MIGRATED_MATCH`. File yang tidak memiliki rujukan sah masuk ke `ORPHAN_QUARANTINE` (hanya tercatat di manifest read-only, **tidak diunggah ke R2**).

---

## 5. Batas Keamanan Upload, Download, & RLS Policies

> [!IMPORTANT]
> **Pemisahan Lapisan Keamanan:** Keamanan database (RLS PostgreSQL) dan keamanan objek Cloudflare R2 adalah **DUA LAPISAN YANG BERBEDA**:
> 1. **Lapisan Database (PostgreSQL RLS):** Melindungi baris metadata di `app_media_object` agar hanya akun terotorisasi yang dapat membaca rujukan file atau menyisipkan entri baru.
> 2. **Lapisan Objek Storage (Cloudflare R2):** Melindungi file biner fisik dari pembacaan liar melalui penutupan origin publik pada bucket privat dan penegakan pre-signed URL berbatas waktu.

### 5.1 Otorisasi Berbasis Sesi JWT & Resolusi Identitas
- **Resolusi Identitas:** Di Supabase, `auth.uid()` mengembalikan UUID pengguna auth (`auth_user_id`). Untuk mencocokkan kepemilikan di tabel kanonikal, resolver menggunakan mapping:
  `user_account.identity_id WHERE user_account.auth_user_id = auth.uid()`.
- **Evaluasi Kapabilitas:** Seluruh izin hak istimewa dievaluasi menggunakan resolver fungsi kanonikal:
  `public.has_capability(p_capability TEXT)` yang telah diamankan dengan perlindungan anti stale-JWT token di Phase 5C.3.
- **Penerbitan Signed URL:** Backend API memvalidasi kepemilikan atau kapabilitas sebelum membuat pre-signed GET URL (masa berlaku dibatasi **maksimal 15 menit**, header `Cache-Control: private, no-store`).

---

## 6. Konsistensi Empat Pilar: Penghapusan, Tombstone, Arsip, & Pembersihan Yatim

Penting untuk membedakan secara tegas bahwa operasi siklus hidup media **TIDAK TERJADI DALAM SATU TRANSAKSI TUNGGAL**, melainkan terbagi ke dalam 4 pilar terpisah:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    EMPAT PILAR PENGELOLAAN SIKLUS HIDUP MEDIA                   │
└─────────────────────────────────────────────────────────────────────────────────┘

 [PILAR 1: TOMBSTONE DATABASE]
 ├── Mengisi kolom `deleted_at = now()`, status `TOMBSTONE_DELETED`.
 ├── Mempertahankan jejak audit referensial (siapa pengunggah, kapan dibuat).
 └── Dilakukan seketika saat penghapusan logis diminta.

 [PILAR 2: PENGHAPUSAN OBJEK CLOUDFLARE R2]
 ├── Penghapusan fisik biner (`DeleteObject` R2 S3 API).
 ├── Dilarang dieksekusi secara instan pada dokumen surat resmi & keuangan.
 └── Dijalankan via asynchronous cleanup worker setelah masa retensi aman.

 [PILAR 3: RETENSI ARSIP HISTORIS]
 ├── Surat resmi dan nota kuitansi adalah DOKUMEN HUKUM INSTITUSIONAL ABADI.
 ├── Diberikan bendera proteksi mutlak: status tidak boleh menjadi `TOMBSTONE_DELETED`.
 └── Objek biner dipindahkan ke tier arsip dingin (cold storage), bukan dimusnahkan.

 [PILAR 4: PENANGANAN OBJEK YATIM (ORPHAN CLEANUP WORKER)]
 ├── Kasus A: Klien minta upload URL tetapi tidak pernah mengunggah (upload drop-out).
 ├── Kasus B: Biner berhasil masuk ke R2 tetapi backend crash sebelum database mencatat `READY`.
 └── Solusi: Background cron Edge Worker memeriksa entri `UPLOAD_PENDING` > 60 menit,
     membandingkan manifest database vs `ListObjectsV2` R2, dan mem-purge file liar.
```

---

## 7. Naskah SQL Proposal Konseptual (Untuk Tinjauan DBA)

> [!IMPORTANT]
> Blok SQL di bawah ini disimpan secara murni sebagai **DOKUMEN PROPOSAL TEKNIS**. Naskah ini **TIDAK BOLEH DIEKSEKUSI** pada database Supabase staging maupun production pada Phase 5D.

```sql
-- ============================================================================
-- PROPOSAL KONSEPTUAL: DDL METADATA MEDIA CLOUDFLARE R2
-- STATUS: DRAFT PROPOSAL UNTUK REVIEW DBA (DO NOT EXECUTE IN PHASE 5D)
-- ============================================================================

-- 1. Master Tabel Metadata Objek Media
CREATE TABLE IF NOT EXISTS public.app_media_object (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    r2_bucket VARCHAR(64) NOT NULL,
    r2_key VARCHAR(512) NOT NULL UNIQUE,
    category VARCHAR(32) NOT NULL CHECK (category IN (
        'avatar', 'inventaris', 'lost_found', 'surat', 'finance', 'operational'
    )),
    access_tier VARCHAR(16) NOT NULL DEFAULT 'private' CHECK (access_tier IN ('public', 'private')),
    file_name_original VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    checksum_sha256 VARCHAR(64) NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
    lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'UPLOAD_PENDING' CHECK (lifecycle_status IN (
        'UPLOAD_PENDING', 'VERIFIED_READY', 'REPLACED_ARCHIVED', 'FAILED_CORRUPT', 'TOMBSTONE_DELETED'
    )),
    owner_identity_id UUID NULL REFERENCES public.canonical_identity(id) ON DELETE SET NULL,
    uploaded_by UUID NOT NULL REFERENCES public.canonical_identity(id) ON DELETE RESTRICT,
    target_entity_type VARCHAR(64) NOT NULL,
    target_entity_id UUID NULL,
    legacy_source_path TEXT NULL,
    reconciliation_status VARCHAR(32) NOT NULL DEFAULT 'NOT_APPLICABLE' CHECK (reconciliation_status IN (
        'NOT_APPLICABLE', 'PENDING_MIGRATION', 'MIGRATED_MATCH', 'ORPHAN_QUARANTINE'
    )),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at TIMESTAMPTZ NULL,
    deleted_at TIMESTAMPTZ NULL
);

-- 2. Indeks Performa & Pencarian Cepat
CREATE INDEX IF NOT EXISTS idx_app_media_category ON public.app_media_object (category);
CREATE INDEX IF NOT EXISTS idx_app_media_lifecycle ON public.app_media_object (lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_app_media_target ON public.app_media_object (target_entity_type, target_entity_id);
CREATE INDEX IF NOT EXISTS idx_app_media_uploaded_by ON public.app_media_object (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_app_media_owner ON public.app_media_object (owner_identity_id);

-- 3. Proposal RLS Policies (Row Level Security)
ALTER TABLE public.app_media_object ENABLE ROW LEVEL SECURITY;

-- Policy A: Objek Publik dapat dibaca oleh seluruh akun terotentikasi
CREATE POLICY app_media_public_read ON public.app_media_object
    FOR SELECT TO authenticated
    USING (access_tier = 'public' AND lifecycle_status = 'VERIFIED_READY' AND deleted_at IS NULL);

-- Policy B: Objek Dokumen Surat hanya dapat dibaca oleh pemilik (via canonical identity) atau pengurus surat
CREATE POLICY app_media_surat_read ON public.app_media_object
    FOR SELECT TO authenticated
    USING (
        category = 'surat' 
        AND lifecycle_status = 'VERIFIED_READY'
        AND deleted_at IS NULL
        AND (
            owner_identity_id IN (SELECT ua.identity_id FROM public.user_account ua WHERE ua.auth_user_id = auth.uid())
            OR public.has_capability('documents.view')
            OR public.has_capability('documents.archive.view')
        )
    );

-- Policy C: Objek Keuangan hanya dapat dibaca oleh pengelola keuangan atau audit
CREATE POLICY app_media_finance_read ON public.app_media_object
    FOR SELECT TO authenticated
    USING (
        category = 'finance'
        AND lifecycle_status = 'VERIFIED_READY'
        AND deleted_at IS NULL
        AND (
            public.has_capability('finance.view')
            OR public.has_capability('finance.manage')
        )
    );

-- Policy D: Insert Metadata Media hanya diizinkan via sesi terotentikasi sah
CREATE POLICY app_media_insert_auth ON public.app_media_object
    FOR INSERT TO authenticated
    WITH CHECK (
        uploaded_by IN (SELECT ua.identity_id FROM public.user_account ua WHERE ua.auth_user_id = auth.uid())
        AND lifecycle_status = 'UPLOAD_PENDING'
    );
```

---

## 8. Pertanyaan Terbuka yang Membutuhkan Persetujuan Resmi DBA & Pemilik Proyek

Sebelum proposal ini dinaikkan ke tingkat DDL staging, DBA dan Pemilik Proyek wajib meninjau 3 pertanyaan inti berikut:

| No | Topik Tinjauan | Pertanyaan untuk DBA / Pemilik Proyek | Implikasi Arsitektural |
| :-: | :--- | :--- | :--- |
| **1** | **Penegakan Relasi Database** | Apakah DBA memilih **Opsi 1 (Tabel Junction Terikat Kuat)** untuk lampiran surat & keuangan, atau **Opsi 2 (Denormalized Dedicated Columns)**? | Opsi 1 menjamin foreign key PostgreSQL 100% cascade/restrict tanpa risiko orphan; Opsi 2 membatasi 1 file per baris. |
| **2** | **Mekanisme Cron Cleanup Objek Yatim** | Apakah pembersihan objek `UPLOAD_PENDING` yang kedaluwarsa (> 60 menit) dijalankan via cron Cloudflare Worker atau pg_cron di Supabase? | Edge Worker Cloudflare lebih hemat resource database dan dapat langsung memanggil S3 `DeleteObject`. |
| **3** | **Tingkat Enforcement SHA-256 Checksum** | Apakah verifikasi SHA-256 biner diwajibkan saat konfirmasi upload untuk seluruh kategori, atau hanya untuk dokumen surat dan keuangan? | Menjamin anti-tampering dan integritas hukum arsip digital institusi. |

---

## 8. Status Akhir Proposal

```
================================================================================
STATUS AKHIR: READY FOR DBA SCHEMA REVIEW
================================================================================
```

Dokumen ini merupakan proposal teknis arsitektur basis data. Dilarang melakukan provisioning Cloudflare R2, dilarang menjalankan DDL di Supabase, dan dilarang memigrasikan file sebelum proposal ini disetujui secara tertulis oleh DBA dan Pemilik Proyek.
