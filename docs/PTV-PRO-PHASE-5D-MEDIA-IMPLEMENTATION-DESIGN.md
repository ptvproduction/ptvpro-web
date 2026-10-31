# PTV PRO — PHASE 5D MEDIA IMPLEMENTATION DESIGN
## EXISTING SCHEMA & CODE MAPPING (CLOUDFLARE R2)

**Subsystem:** Media Storage & Asset Management  
**Phase:** Phase 5D — Media Implementation Design  
**Target Environment:** Cloudflare R2 (Public & Private Buckets) & Supabase Database  
**Authoritative Contracts:**  
- [docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md)  
- [docs/PTV-PRO-IDENTITY-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-IDENTITY-AUTH-CONTRACT.md)  
- [docs/PTV-PRO-PHASE-5D-MEDIA-MIGRATION-PLAN.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PHASE-5D-MEDIA-MIGRATION-PLAN.md)  
- [docs/PTV-PRO-PHASE-5D-DATA-MIGRATION-AUDIT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PHASE-5D-DATA-MIGRATION-AUDIT.md)  
**Status Dokumen:** **`DESIGN PHASE CLOSED`**  

---

## 1. Temuan Aktual Repository & Database (Fakta vs Asumsi)

Berdasarkan audit komprehensif terhadap source code (`src/`), modul UI (`src/products/hub/`), implementasi kontrak kebijakan (`src/core/policy/`), serta DDL Supabase revisi Phase 5C.3 ([`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql)), diperoleh fakta-fakta lapangan berikut:

### 1.1 Fakta Struktur Database Eksisting
1. **Kolom URL Gambar yang Benar-Benar Ada di Database:**
   - `public.canonical_identity.avatar_url` (`TEXT NULL`) — Kolom avatar kru studio.
   - `public.ptv_inventaris.foto_url` (`TEXT NULL`) — Kolom foto master alat/inventaris.
   - `public.ptv_lost_found.foto_url` (`TEXT NULL`) — Kolom foto barang temuan/hilang di studio.
   - *Catatan View Kompatibilitas:* View `public.ptv_kru_legacy_compat` mengekspos `ci.avatar_url AS foto_url`.
2. **Ketiadaan Kolom Lampiran/Media pada Tabel Operasional Lain:**
   - Tabel persuratan resmi (`ptv_surat_tugas`, `ptv_surat_izin`, `ptv_surat_barang`) **TIDAK memiliki** kolom file attachment, berkas PDF, atau scan tanda tangan. Yang ada saat ini hanya payload metadata dan JSONB (`kru_terlibat`, `daftar_barang`).
   - Tabel kerusakan alat (`ptv_lapor_masalah`) **TIDAK memiliki** kolom foto bukti kerusakan fisik.
   - Tabel keuangan studio (`ptv_keuangan`, `ptv_pemasukan`, `ptv_pengeluaran`, `ptv_kas_kru`) **TIDAK memiliki** kolom berkas kuitansi, nota, atau bukti transfer PDF/JPG.
3. **Ketiadaan Tabel Media Khusus:**
   - **TIDAK ADA** tabel `ptv_media`, `storage_objects`, atau `app_media_object` di skema saat ini. Skema saat ini 100% murni relasional tabular.

### 1.2 Fakta Kode Aplikasi Frontend & API Layer
1. **Status Komponen UI:**
   - Modul Kru ([`src/products/hub/kru/KruPage.tsx`](file:///c:/Users/zidna/ptvpro/src/products/hub/kru/KruPage.tsx)) menampilkan daftar tabular (`PTV ID`, `Nama`, `Divisi`, `Jabatan`, `Angkatan`, `Status`). **Belum merender elemen `<img>` avatar**.
   - Shell Navigasi ([`src/products/hub/shell/HubShell.tsx`](file:///c:/Users/zidna/ptvpro/src/products/hub/shell/HubShell.tsx)) merender placeholder inisial teks lingkaran (`user?.ptv_id.slice(-3)`), **belum memuat `avatar_url`**.
   - Type definition TypeScript ([`src/core/auth/types.ts`](file:///c:/Users/zidna/ptvpro/src/core/auth/types.ts)) **sudah memiliki properti** `avatar_url?: string`.
2. **Ketiadaan Endpoint / Pipeline Upload:**
   - **Nol kode upload di repository:** Tidak ditemukan `input type="file"`, modul `@aws-sdk/client-s3`, Axios upload handler, Multer, maupun Supabase Storage SDK.
   - Seluruh service layer frontend saat ini membaca mock repository lokal (seperti `LocalKruService` di `kruService.ts`) untuk melindungi staging selama tahap scaffold.

---

## 2. Matriks Kebutuhan Media dan Hak Akses Operasional

Berikut adalah pemetaan setiap entitas media operasional studio terhadap struktur data, kontrol kapabilitas sistem, dan klasifikasi keamanannya:

| Jenis Media | Tabel & Kolom Eksisting | Target Bucket R2 | Klasifikasi Akses | Siapa yang Boleh Melihat (Read) | Siapa yang Boleh Mengunggah / Mengganti (Write) | Siapa yang Boleh Menghapus (Delete) | Kekurangan / Celah yang Ditemukan |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- | :--- |
| **Foto Avatar Kru** | `canonical_identity.avatar_url` | **Publik Terkontrol** (`ptvpro-media-public`) | **Publik Terkontrol** (Direktori Internal & Publikasi Terverifikasi) | Seluruh kru aktif/alumni (`crew.view`), publik jika disetujui institusi. | Pemilik akun sendiri (self-service) atau Pengurus (`crew.edit`). | Admin/Eksekutif (`crew.edit`) atau self-service (kembali ke default). | Belum ada validasi apakah seluruh kru setuju fotonya diakses publik via CDN; belum ada UI avatar upload. |
| **Foto Inventaris Alat** | `ptv_inventaris.foto_url` | **Publik Terkontrol** (`ptvpro-media-public`) | **Publik Terkontrol** (Katalog Alat Studio) | Seluruh kru studio (`inventory.view`). | Divisi Technical / Operator (`inventory.edit`). | Pengurus Technical (`inventory.delete`). | Belum ada riwayat multi-foto (hanya 1 URL per alat); belum ada foto per unit serial number (`ptv_inventaris_unit`). |
| **Foto Barang Temuan** | `ptv_lost_found.foto_url` | **Publik Terkontrol** (`ptvpro-media-public`) | **Publik Terkontrol** (Papan Pengumuman) | Seluruh penghuni studio / santri. | Kru penemu / operator piket studio. | Operator saat barang diklaim / dihapus. | Belum ada endpoint unggah di UI. |
| **Berkas Scan Surat Resmi** | *Belum ada kolom fisik di tabel surat* | **PRIVAT KETAT** (`ptvpro-media-private`) | **PRIVAT** (Rahasia Institusi) | Pemohon (`diajukan_oleh = auth.uid()`), Sekretaris, Eksekutif (`documents.view`, `documents.archive.view`). | Sekretaris Studio, Eksekutif (`documents.generate`, `documents.approve`). | **DILARANG HAPUS** (Arsip abadi institusi; hanya pembatalan status). | Kolom lampiran PDF belum tersedia di skema database `ptv_surat_*`. |
| **Bukti Kuitansi & Nota Keuangan** | *Belum ada kolom fisik di `ptv_keuangan`* | **PRIVAT KETAT** (`ptvpro-media-private`) | **PRIVAT** (Kerahasiaan Finansial) | Bendahara, Ketua Umum, Pembina (`finance.view`, `finance.audit`). Dikecualikan dari kru biasa. | Bendahara Studio, Kasir Khusus (`finance.manage`, `finance.operator`). | Eksekutif/Bendahara (`finance.manage`). | Kolom lampiran bukti nota belum tersedia di `ptv_keuangan` / `ptv_pengeluaran`. |
| **Foto Bukti Kerusakan QC Alat** | *Belum ada kolom fisik di `ptv_lapor_masalah`* | **PRIVAT KETAT** (`ptvpro-media-private`) | **PRIVAT** (Internal Studio) | Kru pelapor, Divisi Technical, Eksekutif. | Kru pelapor saat insiden, QC Officer saat approval (`qc_approved_by`). | Tidak dihapus (bukti audit riwayat pemeliharaan). | Kolom foto bukti kerusakan belum ada di `ptv_lapor_masalah`. |

---

## 3. Evaluasi Alternatif Metadata Media

Apakah kolom URL yang tersedia saat ini cukup untuk kebutuhan Cloudflare R2? Dilakukan evaluasi perbandingan mendalam antara 3 pendekatan:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    PERBANDINGAN 3 PENDEKATAN METADATA MEDIA                     │
└─────────────────────────────────────────────────────────────────────────────────┘

 [OPSI A: HANYA MEMAKAI KOLOM EKSISTING]
 canonical_identity.avatar_url ──> [ String URL R2 ]
 ptv_inventaris.foto_url       ──> [ String URL R2 ]
 (Surat & Keuangan: Tidak didukung)

 [OPSI B: MENAMBAH KOLOM LAMPIRAN DENORMALIZED PER TABEL]
 ptv_surat_tugas   ──> + berkas_pdf_url TEXT
 ptv_keuangan      ──> + bukti_nota_url TEXT
 ptv_lapor_masalah ──> + foto_bukti_url TEXT

 [OPSI C: TABEL METADATA TERPUSAT (app_media_object)]
 app_media_object ───(FK)───> [ canonical_identity, ptv_inventaris, ptv_surat_*, ... ]
  ├── r2_bucket, r2_key
  ├── mime_type, file_size_bytes, checksum_sha256
  └── access_tier ('public' / 'private'), migration_status
```

### Matriks Perbandingan Komprehensif

| Kriteria Evaluasi | Opsi A: Memakai Kolom Eksisting Saja | Opsi B: Tambah Kolom URL per Tabel Terkait | Opsi C: Tabel Metadata Terpusat (`app_media_object`) |
| :--- | :--- | :--- | :--- |
| **Perubahan Skema Database** | **Nol DDL (Paling Rendah)** | Butuh ALTER TABLE di 5 tabel operasional | Butuh CREATE TABLE baru + RLS + Indeks |
| **Dukungan Surat & Keuangan** | **Gagal Total (Tidak Didukung)** | Didukung (Masing-masing 1 file per baris) | Didukung Penuh (Bisa multi-file attachment) |
| **Integritas & Audit File Biner** | Lemah (Tidak ada checksum, MIME, ukuran) | Lemah (Hanya teks URL mentah) | **Sangat Kuat (SHA-256, bytes, MIME, ETag)** |
| **Pelacakan Status Migrasi** | Tidak ada pelacakan | Tidak ada pelacakan | **Ada (`DISCOVERED`, `READY`, `VERIFIED`)** |
| **Isolasi Keamanan RLS** | Mengikuti RLS tabel masing-masing | Mengikuti RLS tabel masing-masing | RLS terpusat dengan gatekeeper kapabilitas |
| **Dampak Migrasi & Risiko Regresi** | Nol risiko DDL, tapi fungsionalitas pincang | Risiko perubahan skema moderat | Perlu sinkronisasi relasi tambahan |

### Rekomendasi Arsitektural untuk Pemilik Proyek
- **Fase Awal (Transisi Paritas):** Gunakan **Opsi A** untuk Avatar kru dan Foto inventaris yang memang sudah memiliki kolom di database.
- **Fase Dokumen Resmi & Keuangan:** Karena surat dan keuangan **wajib memiliki bukti fisik** namun belum memiliki kolom, Pemilik Proyek disarankan menyetujui **Opsi C (`app_media_object`)** secara terkontrol sebelum modul persuratan dan keuangan digital diaktifkan.  
*(Catatan: Sesuai batasan Phase 5D, **dilarang mengeksekusi DDL saat ini**).*

---

## 4. Desain Keamanan & Alur Kerja (Security & Workflow Design)

> **Prinsip Utama:** Nama file atau URL rahasia bukanlah mekanisme keamanan (*Never rely on security through obscurity*). Seluruh berkas privat harus diproteksi dengan otorisasi berbasis sesi JWT dan kapabilitas.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    ALUR KEAMANAN & PENGELOLAAN MEDIA R2                         │
└─────────────────────────────────────────────────────────────────────────────────┘

 1. UNGGAH (SECURE DIRECT UPLOAD FLOW)
    Browser Klien                     PTV PRO Edge Worker / API Backend                Cloudflare R2
          │                                           │                                     │
          │─── 1. POST /api/media/upload-request ────>│ (Periksa JWT Sesi & Kapabilitas)    │
          │    { category, mime, size, entity_id }    │ (Validasi Whitelist MIME & Size)    │
          │                                           │ (Generate Object Key Acak / UUID)   │
          │                                           │ (Pilih Bucket: Public atau Private) │
          │<── 2. Return Pre-signed PUT URL ──────────│                                     │
          │    (URL Expire: 15 menit)                 │                                     │
          │                                           │                                     │
          │─── 3. HTTP PUT (Binary Payload) ───────────────────────────────────────────────>│
          │                                                                                 │
          │─── 4. POST /api/media/upload-confirm ────>│                                     │
          │    { r2_key, entity_id }                  │── 5. HeadObject (Verifikasi Size) ─>│
          │                                           │<─ 6. Metadata OK ───────────────────│
          │                                           │ (Update Kolom URL / Metadata DB)    │
          │<── 7. Sukses (200 OK) ────────────────────│

 2. PENGAMBILAN MEDIA PRIVAT (GATED DOWNLOAD FLOW)
    Browser Klien                     PTV PRO Edge Worker / API Backend                Cloudflare R2 Private
          │                                           │                                     │
          │─── 1. GET /api/media/document/{id} ──────>│ (Periksa Sesi & Evaluasi RLS Policy)│
          │                                           │ (Cek Kapabilitas: documents.read)   │
          │<── 2. Return Pre-signed GET URL ──────────│                                     │
          │    (Valid maks 15 menit, Cache-Control:   │                                     │
          │     private, no-store)                    │                                     │
          │                                           │                                     │
          │─── 3. HTTP GET (Signed URL) ───────────────────────────────────────────────────>│
          │<── 4. File Stream (PDF/Nota) ───────────────────────────────────────────────────│

 3. PENGGANTIAN OBJEK (NON-DESTRUCTIVE REPLACEMENT GUARD)
    - File baru WAJIB diunggah sebagai entri baru dengan ID baru berstatus UPLOAD_PENDING.
    - File aktif lama (VERIFIED_READY) TETAP AKTIF dan melayani pengguna selama file baru diunggah.
    - JIKA upload file baru gagal atau timeout, file lama SAMA SEKALI TIDAK TERPENGARUH.
    - Hanya setelah file baru sukses divalidasi VERIFIED_READY, baris lama ditandai REPLACED_ARCHIVED dan referensi diarahkan ke file baru.

 4. KONSISTENSI EMPAT PILAR PENGHAPUSAN & ARSIP
    - Pilar 1 (Tombstone Database): Mengisi deleted_at = now() tanpa memutus jejak audit.
    - Pilar 2 (Penghapusan Fisik R2): Dilakukan asinkron via cleanup worker, BUKAN dihapus seketika.
    - Pilar 3 (Retensi Arsip Abadi): Dokumen surat dan kuitansi kas DILARANG DIHAPUS FISIK (Immutable Archive).
    - Pilar 4 (Cleanup Objek Yatim): Pembersihan berkas gagal upload (UPLOAD_PENDING > 60 menit) via Edge Worker.
```

### Parameter Keamanan & Validasi File:
1. **Validasi File Size:**
   - Avatar Kru: Maksimal 2 MB.
   - Foto Inventaris / QC Alat: Maksimal 5 MB.
   - Dokumen Scan PDF Surat / Nota: Maksimal 10 MB.
2. **Whitelist MIME Type (Magic Bytes Checked):**
   - Gambar: `image/jpeg` (`FF D8 FF`), `image/png` (`89 50 4E 47`), `image/webp` (`52 49 46 46`).
   - Dokumen: `application/pdf` (`25 50 44 46`).
3. **Pencegahan Kebocoran Dokumen Privat ke Domain Publik:**
   - Bucket privat **TIDAK TERHUBUNG** ke subdomain custom CDN.
   - Header respons Cloudflare R2 untuk bucket privat: `Cache-Control: private, no-cache, no-store, must-revalidate`.
   - **Pemisahan Lapisan Keamanan:** PostgreSQL RLS melindungi baris metadata dan query; S3 Presigned URLs + Private Bucket ACL melindungi akses biner fisik.

---

## 5. Rencana Manifest Karantina File Orphan Legacy

Sesuai ketetapan **DEC-5D-08**, tidak ada file dari WordPress yang dimigrasikan secara membabi buta. Disediakan skema manifest audit read-only untuk proses karantina:

### 5.1 Skema Manifest Karantina (`docs/manifests/orphan-media-manifest.schema.json`)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "OrphanMediaManifest",
  "type": "object",
  "properties": {
    "scan_timestamp": { "type": "string", "format": "date-time" },
    "source_directory": { "type": "string" },
    "total_scanned_files": { "type": "integer" },
    "total_orphans_quarantined": { "type": "integer" },
    "quarantined_items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "relative_path": { "type": "string" },
          "file_size_bytes": { "type": "integer" },
          "checksum_sha256": { "type": "string" },
          "detected_mime": { "type": "string" },
          "legacy_db_candidate_match": { "type": ["string", "null"] },
          "verification_status": { 
            "type": "string", 
            "enum": ["UNREFERENCED", "AMBIGUOUS", "BROKEN_LINK", "DUPLICATE_CONTENT"] 
          },
          "quarantine_reason": { "type": "string" },
          "recommended_action": { 
            "type": "string", 
            "enum": ["RETAIN_ON_LEGACY_ONLY", "MANUAL_INSPECTION_REQUIRED", "PERMANENT_EXCLUDE"] 
          }
        },
        "required": ["relative_path", "file_size_bytes", "verification_status", "quarantine_reason"]
      }
    }
  }
}
```

### 5.2 Langkah Eksekusi Pemindaian (Read-Only)
1. **Langkah 1 (Audit Filesystem):** Jalankan skrip read-only pada direktori `wp-content/uploads/` untuk mendata seluruh file gambar dan dokumen asli (mengabaikan pola resolusi thumbnail `-NxN.jpg`).
2. **Langkah 2 (Audit Database WordPress):** Kueri seluruh kolom URL pada tabel `wp_ptv_kru`, `wp_ptv_inventaris`, `wp_ptv_lost_found`, serta tabel relasi surat.
3. **Langkah 3 (Pencocokan / Diffing):**
   - File yang cocok 1:1 dimasukkan ke dalam `in-scope-media-manifest.json`.
   - File yang tidak memiliki pasangan referensi dimasukkan ke dalam `orphan-media-manifest.json`.
4. **Langkah 4 (Zero Modification):** File fisik di server lama **TIDAK dipindahkan, TIDAK diubah, dan TIDAK dihapus**.

---

## 6. Tahapan Implementasi & Gerbang Persetujuan (Implementation Roadmap & Gates)

Implementasi media storage dibagi menjadi 6 tahap bertingkat dengan gerbang kontrol ketat:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│               TAHAPAN IMPLEMENTASI MEDIA STORAGE & GERBANG KONTROL              │
└─────────────────────────────────────────────────────────────────────────────────┘

 [TAHAP 1: VALIDASI DESAIN & KEPUTUSAN SKEMA]
    └── Review dokumen implementasi media ini bersama Pemilik Proyek.
    ▼
 [GERBANG 1: PERSETUJUAN DESAIN IMPLEMENTASI] ──(Wajib tanda tangan persetujuan)
    ▼
 [TAHAP 2: PROVISIONING CLOUDFLARE R2 TERISOLASI]
    ├── Buat bucket publik & privat di akun Cloudflare resmi.
    ├── Konfigurasi CORS, lifecycle rules, dan blokir akses publik pada bucket privat.
    ▼
 [GERBANG 2: VERIFIKASI KEAMANAN BUCKET] ──(Uji coba isolasi & zero public leak)
    ▼
 [TAHAP 3: PENGEMBANGAN BACKEND UPLOAD SERVICE]
    ├── Implementasi endpoint presigned URL (upload/download).
    ├── Implementasi validasi MIME biner & size limits.
    ├── Evaluasi kapabilitas RBAC/RLS pada level gateway.
    ▼
 [GERBANG 3: INTEGRATION & SECURITY TEST SUITE PASS] ──(Zero token/secret leak test)
    ▼
 [TAHAP 4: EKSTRAKSI & VALIDASI MEDIA LEGACY (DRY-RUN)]
    ├── Generate in-scope manifest & orphan quarantine manifest.
    ├── Verifikasi SHA-256 seluruh file biner.
    ▼
 [GERBANG 4: PERSETUJUAN CUTOVER MEDIA] ──(Review manifest karantina orphan)
    ▼
 [TAHAP 5: BATCH MIGRATION & RECONCILIATION]
    ├── Batch upload file in-scope ke R2 Staging.
    ├── Update referensi database staging.
    ▼
 [TAHAP 6: PRODUCTION DUAL-RUN & MONITORING]
    └── Fallback ke WordPress lama aktif selama grace period 30 hari.
```

---

## 7. Penetapan Keputusan Resmi Pemilik Proyek (Adopted Decisions)

Berdasarkan tinjauan arsitektur, tiga keputusan desain resmi telah ditetapkan oleh Pemilik Proyek:

| No | Topik Keputusan | Ketetapan Resmi Pemilik Proyek | Batasan Arsitektural & Langkah Lanjutan |
| :-: | :--- | :--- | :--- |
| **1** | **Metadata Media Terpusat** | **Direkomendasikan tabel metadata terpusat `app_media_object` sebagai arah desain utama.** | **Arah Desain Utama, Bukan DDL.** Mendukung multi-attachment per entitas dan metadata biner lengkap. Rancangan disimpan sebagai proposal konseptual terpisah untuk tinjauan DBA tanpa mengeksekusi DDL saat ini. |
| **2** | **Privasi Foto Avatar Kru** | **Foto kru bersifat PRIVAT secara default.** | **Pengecualian Terpisah.** Akses publik untuk kartu identitas fisik, website profil santri, atau direktori publik harus dirancang sebagai pengecualian terpisah dengan persetujuan eksplisit pemilik proyek. Default bucket avatar diarahkan ke perlindungan privat atau domain terotentikasi. |
| **3** | **Retensi File Orphan Legacy** | **TIDAK menetapkan batas waktu 30 hari sebagai aturan final.** | **Retensi Berbasis Milestone.** Seluruh file di direktori WordPress legacy tetap dipertahankan utuh selama masa transisi sampai proses rekonsiliasi data, verifikasi migrasi, dan persetujuan formal cutover selesai 100%. |

---

## 8. Status Akhir & Penutupan Desain Media

```
================================================================================
STATUS AKHIR: DESIGN PHASE CLOSED
================================================================================
```

Dokumen desain implementasi media ini telah merangkum seluruh pemetaan aktual kode dan database, arsitektur isolasi dua bucket Cloudflare R2, pola junction terikat kuat untuk persuratan dan keuangan, proteksi penggantian non-destruktif, serta empat pilar penghapusan. Tahap desain media resmi **DITUTUP (DESIGN PHASE CLOSED)** dan siap melangkah ke fase UI Implementation (Phase 5E).
