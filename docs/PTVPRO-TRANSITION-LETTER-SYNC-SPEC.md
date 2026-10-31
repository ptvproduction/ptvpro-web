# PTVPRO — SPESIFIKASI SINKRONISASI TRANSISI PERSURATAN & SELURUH ARSIP (LEGACY → PTVPRO) & DESAIN CUTOVER
## Rencana Arsitektur Menyeluruh, Idempotensi, Preservasi File Lampiran, & Background Scheduler

**Target Repositori:** `c:\Users\zidna\ptvpro`  
**Sumber Resmi (Source of Truth):** Supabase Production Legacy `jthzuhkblxcaohiuypqq` (Aktif digunakan pada PHP Legacy `progresiftv.id/dasbor`)  
**Target Pengembangan & Uji:** Supabase PTVPRO Staging `swadgljnyelsjstqqxbm`  
**Status Batasan:** STRICT ONE-WAY SYNC (Legacy → Staging). ZERO MUTATION pada Legacy (Strict Read-Only).  
**Tanggal Evaluasi & Pembaruan:** 22 Oktober 2026  
**Sesi Piket:** `PTV-DEV-147` (Zidnal / Antigravity)  

---

## 1. EKSEKUTIF & PRINSIP UTAMA SINKRONISASI MENYELURUH

Pekerjaan `PTV-DEV-147` memperluas mesin sinkronisasi transisi dari yang sebelumnya hanya mencakup tiga tabel persuratan dasar menjadi **seluruh Surat & Arsip** yang ada di PHP Legacy. Hal ini menjamin bahwa seluruh dokumen persuratan, notulensi rapat, catatan bersama, pengumuman resmi, dan dokumen publikasi/e-book dapat berpindah dan terus tersinkron ke PTVPRO secara aman, otomatis, dan satu arah (*one-way*) tanpa input manual.

### Prinsip Mutlak Arsitektur:
1. **Satu Arah Mutlak (Legacy → Staging):**
   Tidak ada penulisan balik (*no reverse sync*) dari PTVPRO Staging ke Legacy. Legacy `jthzuhkblxcaohiuypqq` adalah sumber kebenaran tertinggi (*Single Source of Truth*) dan berstatus **STRICT READ-ONLY** bagi seluruh mesin sinkronisasi.
2. **Kesesuaian Presisi (100% Fidelity & Zero Fabrication):**
   Nomor surat resmi, tanggal penerbitan, isi santri/barang/kru, catatan notulensi, dan riwayat persetujuan dipertahankan persis seperti aslinya. Kolom relasi identitas (`diajukan_oleh`, `disetujui_oleh`) yang berupa teks string nama legacy (seperti `"Progresif TV"`) dan tidak memiliki UUID padanan di `canonical_identity` **wajib disimpan sebagai NULL** pada kolom foreign key dan dicatat ke dalam laporan rekonsiliasi. Dilarang keras mengarang UUID acak atau mengisi identitas palsu!
3. **Idempotensi Penuh (Zero Duplicate Invariant):**
   Menjalankan skrip sinkronisasi berkali-kali menghasilkan keadaan database yang identik tanpa pernah menduplikasi baris surat atau mengubah nomor urut yang sudah terbit.
4. **Isolasi Data Uji Staging vs Data Resmi Legacy:**
   Dokumen pengujian yang dibuat secara lokal di Staging (tanpa provenance legacy) tidak boleh ditimpa atau dihapus oleh sinkronisasi. Jika terdapat benturan nomor surat antara data legacy resmi dan data uji Staging, sistem menerapkan aturan *fail-closed* dengan mengarantina record dan membunyikan alarm rekonsiliasi.
5. **Penomoran Dinamis (Dynamic Gap-Filling R06 Rev 11):**
   Sistem penomoran surat kanonikal PTVPRO R06 (Rev 11) memperhitungkan seluruh nomor terbit (`001`, `007`, `009`, `011`). Penentuan nomor urut berikutnya dihitung secara dinamis mengisi celah terkecil (*smallest available positive sequence*), yaitu urutan ke-2 (`002/SI-PTV/X/2026`).
6. **Perlindungan Terhadap Dokumen Batal / Hilang (Safe Retention Policy):**
   - Dokumen legacy berstatus `batal` / `dibatalkan` dipetakan secara aman ke status `ditolak` dengan penanda riwayat khusus.
   - Dokumen yang ada di Staging tapi tidak ditemukan lagi di Legacy **TIDAK PERNAH DIHAPUS OTOMATIS**; record tersebut dicatat ke dalam log audit retensi agar data historis institusi tidak hilang.
7. **Preservasi URL File & Lampiran (Zero Storage Buckets in Legacy):**
   Audit empiris membuktikan bahwa Supabase Legacy tidak memiliki Storage Bucket (0 bucket). Seluruh dokumen arsip seperti e-book dan lampiran menggunakan URL absolut WordPress uploads (`https://progresiftv.id/wp-content/uploads/...`) dan Google Drive preview (`https://drive.google.com/file/d/.../preview`). Mesin sinkronisasi mempreservasi seluruh URL file ini ke dalam manifest arsip digital PTVPRO tanpa perubahan.

---

## 2. AUDIT FAKTUAL REKOD SELURUH SURAT & ARSIP

Berdasarkan audit langsung secara read-only terhadap database Supabase Legacy `jthzuhkblxcaohiuypqq` pada 22 Oktober 2026:

| Modul / Tabel Legacy | Jumlah Baris Live | Status Target di Staging Supabase | Detail Rekod & Rujukan File |
| :--- | :--- | :--- | :--- |
| **`ptv_surat_izin`** | **4 baris live** | Tabel ada (`public.ptv_surat_izin`) | `001/SI-PTV/X/2026` (Farras, Oct 3), `007/SI-PTV/X/2026` (Farras, Oct 15), `009/SI-PTV/X/2026` (Fauzil Adhim, Oct 21), `011/SI-PTV/X/2026` (Fauzil Adhim, Oct 22). |
| **`ptv_surat_tugas`** | **0 baris** | Tabel ada (`public.ptv_surat_tugas`) | Belum ada penerbitan surat tugas di legacy; skema dan mapper siap. |
| **`ptv_surat_barang`**| **0 baris** | Tabel ada (`public.ptv_surat_barang`) | Belum ada penerbitan surat barang di legacy; skema dan mapper siap. |
| **`ptv_catatan`** | **4 baris live** | Tabel ada (`public.ptv_catatan`) | Catatan keluarga ndalem, ukuran banner pondok, notulensi rapat acara relasi santri. Lengkap dengan warna, pinned, tags. |
| **`ptv_pengumuman`** | **3 baris live** | Tabel ada (`public.ptv_pengumuman`) | Pengumuman dasbor aktif, pengumuman bug system, pengumuman kas santri. |
| **`ptv_ebook`** | **15 baris (5 unik)** | Manifest Arsip Digital Kanonikal | Buku Pintar Qurban (PDF), Shalawat & Zikir (PDF), Tuhan Maha Ada (PDF), Awas Hadis Palsu (GDrive), Anfasul Mahasin (GDrive). |
| **Storage Buckets** | **0 bucket** | Bucket Staging (`inventory`, dsb) | Tidak ada bucket di legacy; seluruh link file berupa HTTP URL WordPress/GDrive yang dipreservasi utuh. |

---

## 3. MATRIKS TRANSFORMASI SKEMA MENYELURUH

### A. Tabel Surat Izin (`ptv_surat_izin`)
| Kolom Legacy | Kolom Kanonikal Staging | Aturan Transformasi & Proteksi |
| :--- | :--- | :--- |
| `id` (UUID) | `id` (UUID PRIMARY KEY) | Dipertahankan 100% sama (Stable Identifier). |
| `nomor_surat` | `nomor_surat` (VARCHAR UNIQUE) | Dipertahankan persis aslinya (`001`, `007`, `009`, `011`). |
| `nama_santri` / `nama_pemohon` | `nama_pemohon` (VARCHAR NOT NULL) | Sanitasi string `trim()`. Fallback: nama santri pertama pada `santri_list`. |
| `alasan` / `jenis_kegiatan` | `alasan` (TEXT NOT NULL) | Teks alasan permohonan izin asli. |
| `tanggal_mulai` | `tanggal_mulai` (DATE NOT NULL) | Format ISO `YYYY-MM-DD`. |
| `tanggal_selesai` | `tanggal_selesai` (DATE NOT NULL) | Format ISO `YYYY-MM-DD`. |
| `diajukan_oleh` (Text) | `diajukan_oleh` (UUID NULL REFERENCES `canonical_identity`) | Cari exact match di `canonical_identity`. Jika tidak ada -> simpan `NULL`, rekam teks asli di log rekonsiliasi. |
| `disetujui_oleh` (Text) | `disetujui_oleh` (UUID NULL REFERENCES `canonical_identity`) | Cari exact match di `canonical_identity`. Jika tidak ada -> simpan `NULL`, rekam teks asli di log rekonsiliasi. |
| `status` (Text) | `status` (VARCHAR NOT NULL) | Normalisasi: `'disetujui'` / `'menunggu'` / `'revisi'` / `'ditolak'`. Status batal dipetakan ke `'ditolak'`. |
| `santri_list` (JSONB) | `santri_list` (JSONB NOT NULL) | Validasi array `jsonb_typeof = 'array'`. Format utuh tanpa pemotongan atribut. |
| `created_at` | `created_at` (TIMESTAMPTZ) | Timestamp asli pembuatan surat di legacy. |

### B. Tabel Catatan Bersama & Notulensi (`ptv_catatan`)
| Kolom Legacy | Kolom Kanonikal Staging | Aturan Transformasi & Proteksi |
| :--- | :--- | :--- |
| `id` (UUID) | `id` (UUID PRIMARY KEY) | Dipertahankan 100% sama. |
| `judul` | `judul` (TEXT NOT NULL) | Judul catatan / notulensi. |
| `isi` | `isi` (TEXT NOT NULL) | Isi catatan (HTML / Rich Text / Metadata Rapat `<!-- PTV_META: ... -->`). |
| `warna` | `warna` (VARCHAR NOT NULL) | Normalisasi ke `orange`, `green`, `yellow`, `purple`, `rose`. |
| `is_pinned` | `is_pinned` (BOOLEAN) | Status pin catatan di dasbor. |
| `tags` | `tags` (JSONB / Array) | Array tag identifikasi (misal `notulensi`, `acara_...`, `ndalem`). |
| `created_by_id` | `created_by_id` (VARCHAR) | ID Kru legacy pembuat catatan (misal `PTV-001`, `PTV-002`). |
| `created_by_name` | `created_by_name` (VARCHAR) | Nama kru pembuat catatan. |
| `created_at` | `created_at` (TIMESTAMPTZ) | Timestamp pembuatan asli. |
| `updated_at` | `updated_at` (TIMESTAMPTZ) | Timestamp modifikasi terakhir. |

### C. Tabel Pengumuman & Broadcast (`ptv_pengumuman`)
| Kolom Legacy | Kolom Kanonikal Staging | Aturan Transformasi & Proteksi |
| :--- | :--- | :--- |
| `id` (UUID) | `id` (UUID PRIMARY KEY) | Dipertahankan 100% sama. |
| `judul` | `judul` (VARCHAR NOT NULL) | Judul pengumuman resmi. |
| `konten` | `konten` (TEXT NOT NULL) | Isi pesan pengumuman. |
| `target_divisi` | `target_divisi` (VARCHAR) | Divisi sasaran (default: `Semua`). |
| `prioritas` | `prioritas` (VARCHAR) | Tingkat prioritas (`Penting`, `Biasa`). |
| `status` | `status` (VARCHAR) | Status tayang (`aktif`, `arsip`). |
| `thumbnail_url` | `thumbnail_url` (TEXT NULL) | URL thumbnail gambar jika ada. |
| `created_by` | `created_by` (VARCHAR) | Akun pembuat pengumuman. |
| `created_at` | `created_at` (TIMESTAMPTZ) | Timestamp asli. |

### D. Koleksi Arsip E-Book / Publikasi (`ptv_ebook` → Manifest Arsip)
| Kolom Legacy | Nilai & Format Kanonikal | Penanganan Preservasi Link File |
| :--- | :--- | :--- |
| `id` (UUID) | ID stabil di manifest | `reports/legacy-archive-manifest.json` |
| `judul` | Judul buku / panduan | Nama resmi karya/panduan. |
| `penulis` | Nama penulis / asatidz | Preservasi gelar dan nama asatidz. |
| `file_url` | URL file PDF asli | Link langsung ke WordPress upload atau preview Google Drive. |
| `cover_url` | URL cover gambar asli | Link cover buku. |
| `deskripsi` | Ringkasan isi buku | Deskripsi dan sinopsis buku. |

---

## 4. DYNAMIC GAP-FILLING SEQUENCE (R06 REV 11)

Berdasarkan rekonsiliasi empiris 4 surat izin yang ada di database Legacy:
- `001/SI-PTV/X/2026` (Terbit & Aktif)
- `007/SI-PTV/X/2026` (Terbit & Aktif)
- `009/SI-PTV/X/2026` (Terbit & Aktif, diterbitkan 21 Oktober 2026 oleh Muhammad Izzur Fauzil Adhim)
- `011/SI-PTV/X/2026` (Terbit & Aktif, diterbitkan 22 Oktober 2026 oleh Muhammad Izzur Fauzil Adhim)

### Perhitungan Sequence:
1. Daftar urutan angka yang sudah terpakai: `[1, 7, 9, 11]`.
2. Sequence terkecil yang kosong (*Smallest Available Positive Sequence*): **`002`** (`002/SI-PTV/X/2026`).
3. Celah berikutnya secara berurutan: `003`, `004`, `005`, `006`, `008`, `010`, `012...`.
4. Mekanisme ini menjamin tidak ada nomor surat yang bentrok atau melompati celah kosong yang sah, sekaligus mematuhi Proposal Atomik R06 Rev 11.

---

## 5. SCHEDULER & BACKGROUND AUTOMATION BLUEPRINT

Agar sinkronisasi dapat berjalan secara kontinu tanpa bergantung pada browser yang terbuka:

1. **Worker Mandiri Server-Side (`scripts/cron-sync-worker.mjs`):**
   - Dijalankan via Node.js di server/container lokal atau background task.
   - Mendukung argumen:
     - `--once`: Eksekusi satu kali (cocok untuk GitHub Actions / Vercel Cron).
     - `--interval=N`: Eksekusi berulang setiap N menit (default 15 menit).
     - `--live --confirm-staging`: Eksekusi mutasi aktif ke Staging (membutuhkan ACC operator).
2. **Kerahasiaan Kredensial:**
   - Kredensial dibaca langsung di sisi server dari environment variables (`LEGACY_SUPABASE_URL`, `LEGACY_SUPABASE_KEY`) atau dump lokal tanpa pernah diekspos ke client bundle browser.
3. **Fail-Safe & Alerting:**
   - Kegagalan jaringan ditangani oleh retry exponential backoff (`withExponentialBackoff`).
   - Jika terjadi tabrakan nomor atau unmapped data, record langsung dialihkan ke karantina tanpa membatalkan sinkronisasi rekod lainnya.

---

## 6. LANGKAH AKTIVASI STAGING (MEMBUTUHKAN ACC OPERATOR)

Saat ini seluruh kode dan pengujian berada dalam status **DRY-RUN (STRICT READ-ONLY)**.
Untuk mengaktifkan penulisan aktif ke Supabase Staging (`swadgljnyelsjstqqxbm`), langkah yang diperlukan adalah:

1. **Konfirmasi Operator (ACC):**
   Operator meninjau laporan rekonsiliasi di `reports/legacy-sync-reconciliation.json` dan manifest arsip di `reports/legacy-archive-manifest.json`.
2. **Eksekusi Backfill Perdana:**
   ```bash
   node scripts/sync-legacy-letters.mjs --mode=backfill --live --confirm-staging
   ```
3. **Eksekusi Background Worker Terjadwal:**
   ```bash
   node scripts/cron-sync-worker.mjs --interval=15 --live --confirm-staging
   ```
4. **Verifikasi Pasca-Aktivasi:**
   Buka UI Surat & Arsip (`/hub/arsip`), Notulensi & Catatan (`/hub/catatan`), dan Broadcast (`/hub/broadcast`) di browser untuk memastikan seluruh dokumen tampil sempurna sesuai design guide R03.
