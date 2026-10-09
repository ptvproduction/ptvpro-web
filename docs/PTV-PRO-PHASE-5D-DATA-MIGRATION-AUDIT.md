# PTV PRO — PHASE 5D DATA MIGRATION READINESS AUDIT

**Subsystem:** PTV PRO Database & Supabase Data Integration  
**Phase:** Phase 5D — Data Migration Readiness Audit  
**Date:** 10 Oktober 2026  
**Target Environment:** Supabase Staging (`swadgljnyelsjstqqxbm`)  
**Authoritative Backend Contract:** [PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md)  
**Identity Contract:** [PTV-PRO-IDENTITY-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-IDENTITY-AUTH-CONTRACT.md)  
**Status Gerbang:** **`DESIGN PHASE CLOSED`**  

---

## 1. Ringkasan Kondisi Aktual (Executive Summary)

Phase 5C.3 telah dituntaskan dengan sukses melalui eksekusi manual terkontrol pada Supabase Staging (`swadgljnyelsjstqqxbm`). Verifikasi postflight Seksi 14 pada [`docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql) membuktikan bahwa seluruh **14 butir pemeriksaan berstatus PASS**:
- Skema terkelola `auth` bersih dari fungsi kustom (`PASS`).
- Resolver kapabilitas `public.has_capability` aktif dan fail-closed (`PASS`).
- Hak akses anonim pada seluruh 6 fungsi sensitif (`jwt_custom_claims`, `rpc_checkout_loan`, `rpc_return_loan`, `rpc_return_single_unit`, `rpc_get_next_inv_code`, `rpc_submit_official_doc`) telah tertutup rapat (`PASS`).
- Ketiga tabel surat resmi (`ptv_surat_tugas`, `ptv_surat_izin`, `ptv_surat_barang`) telah memiliki kolom `diajukan_oleh` bertipe `UUID NULL` dengan foreign key `REFERENCES public.canonical_identity(id) ON DELETE RESTRICT` (`PASS`).

Tujuan Phase 5D adalah melakukan **Audit Kesiapan Migrasi Data (Data Migration Readiness Audit)** sebelum migrasi data riil dijalankan, memastikan pemetaan data lama (WordPress MySQL `$wpdb`) ke skema kanonikal Supabase terdefinisi dengan presisi tinggi, bebas dari data yatim (*orphan*), duplikasi identifier, atau konflik identitas.

---

## 2. Inventaris Tabel dan Sumber Data

### A. Tabel Skema Kanonikal di Supabase Staging (Total 37 Objek)
Skema kanonikal terdiri dari **36 tabel** dan **1 view kompatibilitas**:

```
1. Kelompok Identitas & Autentikasi (4 Tabel):
   - canonical_identity
   - identity_contact
   - user_account
   - auth_credentials

2. Kelompok Organisasi & Hierarki (3 Tabel):
   - organization
   - organization_division
   - organization_membership

3. Kelompok Otorisasi & Kapabilitas (5 Tabel):
   - access_profile
   - capability_registry
   - profile_capabilities
   - account_profiles
   - account_capability_overrides

4. Kelompok Operasional Studio (16 Tabel):
   - ptv_acara
   - ptv_acara_rundown
   - ptv_content_planner
   - ptv_inventaris
   - ptv_inventaris_unit
   - ptv_nilai_inventaris
   - ptv_peminjaman
   - ptv_lapor_masalah
   - ptv_lost_found
   - ptv_surat_tugas
   - ptv_surat_izin
   - ptv_surat_barang
   - ptv_keuangan
   - ptv_pemasukan
   - ptv_pengeluaran
   - ptv_kas_kru
   - ptv_kas_periode

5. Kelompok Komunikasi, Notifikasi & Catatan (5 Tabel):
   - ptv_catatan
   - ptv_kontak_eksternal
   - ptv_notifications
   - ptv_push_subscriptions
   - ptv_pengumuman

6. Kelompok Audit & Forensik (2 Tabel):
   - auth_audit_log
   - ptv_login_history

7. View Kompatibilitas Warisan (1 View):
   - ptv_kru_legacy_compat (SELECT dari 5 tabel identitas terpecah)
```

### B. Sumber Data Acuan (Ground Truth Hierarchy)

| Kategori Data | Lokasi Sumber Data Aktual | Status Otoritatif | Catatan Validasi |
| :--- | :--- | :---: | :--- |
| **Master Reference Data** | [`docs/PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql) | **TERPASANG DI STAGING** | 2 Organisasi, 5 Divisi, 5 Profil, 53 Kapabilitas, 177 Relasi Profil. |
| **Data Kru & Akun Operasional** | WordPress MySQL (`$wpdb->ptv_kru`) di `progresiftv.id` | **SUMBER UTAMA (LEGACY PRODUCTION)** | Belum dimigrasikan. Di staging saat ini 0 baris. |
| **Data Peralatan & Unit** | WordPress MySQL (`$wpdb->ptv_inventaris`) di `progresiftv.id` | **SUMBER UTAMA (LEGACY PRODUCTION)** | Di staging saat ini 0 baris. |
| **Data Transaksi Pinjam/Kembali**| WordPress MySQL (`$wpdb->ptv_peminjaman`) di `progresiftv.id` | **SUMBER UTAMA (LEGACY PRODUCTION)** | Di staging saat ini 0 baris. |
| **Data Surat Resmi Studio** | WordPress MySQL (`$wpdb->ptv_surat_*`) di `progresiftv.id` | **SUMBER UTAMA (LEGACY PRODUCTION)** | Di staging saat ini 0 baris. |
| **Data Keuangan & Kas** | WordPress MySQL (`$wpdb->ptv_keuangan`, `ptv_kas_kru`) | **SUMBER UTAMA (LEGACY PRODUCTION)** | Di staging saat ini 0 baris. |
| **Mock Development Fixtures** | [`src/core/auth/authService.ts`](file:///c:/Users/zidna/ptvpro/src/core/auth/authService.ts) & [`src/products/hub/kru/kruService.ts`](file:///c:/Users/zidna/ptvpro/src/products/hub/kru/kruService.ts) | **MOCK LOKAL (NON-PRODUKSI)** | 8 akun mock (PTV-ROOT, PTV-001, dll.) hanya untuk scaffold frontend offline. Dilarang diimpor ke staging sebagai data riil. |

---

## 3. Hasil Audit Read-Only Staging (Bukti Empiris Lapangan)

Pemeriksaan read-only dilakukan langsung terhadap Supabase Staging (`swadgljnyelsjstqqxbm`) menggunakan PostgREST HTTP GET API dengan parameter `select=count`, `Prefer: count=exact`, dan `Range: 0-0`:

```text
================================================================================
HASIL PROBE READ-ONLY SUPABASE STAGING (swadgljnyelsjstqqxbm)
================================================================================
capability_registry            : status 206 | baris: 53   (Ekspektasi: 53)  -> PASS
profile_capabilities           : status 206 | baris: 177  (Ekspektasi: 177) -> PASS
access_profile                 : status 206 | baris: 5    (Ekspektasi: 5)   -> PASS
organization                   : status 206 | baris: 2    (Ekspektasi: 2)   -> PASS
organization_division          : status 206 | baris: 5    (Ekspektasi: 5)   -> PASS
canonical_identity             : status 200 | baris: 0    (Bersih)          -> READY
identity_contact               : status 200 | baris: 0    (Bersih)          -> READY
user_account                   : status 200 | baris: 0    (Bersih)          -> READY
auth_credentials               : status 200 | baris: 0    (Bersih)          -> READY
organization_membership        : status 200 | baris: 0    (Bersih)          -> READY
account_profiles               : status 200 | baris: 0    (Bersih)          -> READY
account_capability_overrides   : status 200 | baris: 0    (Bersih)          -> READY
ptv_inventaris                 : status 200 | baris: 0    (Bersih)          -> READY
ptv_inventaris_unit            : status 200 | baris: 0    (Bersih)          -> READY
ptv_nilai_inventaris           : status 200 | baris: 0    (Bersih)          -> READY
ptv_peminjaman                 : status 200 | baris: 0    (Bersih)          -> READY
ptv_lapor_masalah              : status 200 | baris: 0    (Bersih)          -> READY
ptv_lost_found                 : status 200 | baris: 0    (Bersih)          -> READY
ptv_surat_tugas                : status 200 | baris: 0    (Bersih)          -> READY
ptv_surat_izin                 : status 200 | baris: 0    (Bersih)          -> READY
ptv_surat_barang               : status 200 | baris: 0    (Bersih)          -> READY
ptv_keuangan                   : status 200 | baris: 0    (Bersih)          -> READY
ptv_pemasukan                  : status 200 | baris: 0    (Bersih)          -> READY
ptv_pengeluaran                : status 200 | baris: 0    (Bersih)          -> READY
ptv_kas_kru                    : status 200 | baris: 0    (Bersih)          -> READY
ptv_kas_periode                : status 200 | baris: 0    (Bersih)          -> READY
ptv_catatan                    : status 200 | baris: 0    (Bersih)          -> READY
ptv_kontak_eksternal           : status 200 | baris: 0    (Bersih)          -> READY
ptv_notifications              : status 200 | baris: 0    (Bersih)          -> READY
ptv_push_subscriptions         : status 200 | baris: 0    (Bersih)          -> READY
ptv_pengumuman                 : status 200 | baris: 0    (Bersih)          -> READY
ptv_acara                      : status 200 | baris: 0    (Bersih)          -> READY
ptv_acara_rundown              : status 200 | baris: 0    (Bersih)          -> READY
ptv_content_planner            : status 200 | baris: 0    (Bersih)          -> READY
auth_audit_log                 : status 200 | baris: 0    (Bersih)          -> READY
ptv_login_history              : status 200 | baris: 0    (Bersih)          -> READY
ptv_kru_legacy_compat          : status 200 | baris: 0    (Tabel induk 0)   -> READY
================================================================================
```

### Kesimpulan Audit Staging:
1. **Metadata Otorisasi 100% Siap:** Seluruh tabel kamus otorisasi (organisasi, divisi, profil, kapabilitas, pemetaan) telah terisi penuh dan valid.
2. **Kondisi Bersih (Clean Slate):** Seluruh 31 tabel operasional dan identitas saat ini berstatus **0 baris**. Tidak ada residu data dummy atau data uji acak di database staging. Ini memberikan lingkungan migrasi yang paling aman dan deterministik.

---

## 4. Matriks Pemetaan Data (Data Mapping Matrix)

### Matriks 1: Pemetaan Identitas Kru (`ptv_kru` $\longrightarrow$ Skema Kanonikal 5 Tabel)
Pada sistem lama, `ptv_kru` menggabungkan identitas pribadi, kredensial, keanggotaan divisi, dan peran sistem dalam 1 baris. Skema kanonikal memecahnya secara ternormalisasi:

```
                  ┌───────────────────────────────┐
                  │    LEGACY: wp_ptv_kru         │
                  └───────────────┬───────────────┘
                                  │
      ┌──────────────┬────────────┼────────────┬──────────────┐
      ▼              ▼            ▼            ▼              ▼
┌───────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│ canonical │ │  identity  │ │   user   │ │   auth   │ │ organization │
│ _identity │ │  _contact  │ │ _account │ │_credentials│ membership   │
└───────────┘ └────────────┘ └──────────┘ └──────────┘ └──────────────┘
```

| Kolom Sumber (`wp_ptv_kru`) | Tipe Sumber | Tabel & Kolom Tujuan | Aturan Transformasi & Pembersihan | Kunci Pencocokan & Pencegahan Duplikasi |
| :--- | :--- | :--- | :--- | :--- |
| `crew_id` | `VARCHAR(16)` | `canonical_identity.ptv_id` | Uppercase, trim whitespace (misal: `PTV-001`, `PTV-025`). Format wajib `PTV-xxx`. | **UNIQUE KEY**: Tidak boleh ada 2 kru dengan `ptv_id` yang sama. |
| `nama` | `VARCHAR(255)` | `canonical_identity.full_name` | Trim whitespace, standard title casing. | — |
| `foto_url` | `TEXT` | `canonical_identity.avatar_url` | Diarahkan ke URL Cloudflare R2 CDN (lihat `docs/PTV-PRO-PHASE-5D-MEDIA-MIGRATION-PLAN.md`). Jika tidak ada diisi `NULL`. | — |
| `created_at` | `DATETIME` | `canonical_identity.created_at` | Konversi ke `TIMESTAMPTZ`. | — |
| `telepon` / `no_wa` | `VARCHAR(32)` | `identity_contact.phone_wa` | Normalisasi nomor telepon standar internasional/lokal (`08...` atau `+62...`). | Foreign key `identity_id -> canonical_identity.id`. |
| `email` | `VARCHAR(128)` | `identity_contact.email_personal` | Lowercase, trim whitespace. Validasi format email. | Duplikat email personal diperingatkan tapi tidak memblokir identitas institusi. |
| `username` | `VARCHAR(64)` | `user_account.username` | Lowercase, trim whitespace. | **UNIQUE KEY**: Username unik global pada `user_account`. |
| `status` (split 1) | `VARCHAR(32)` | `user_account.status_akun` | `aktif` $\rightarrow$ `'active'`<br>`alumni` $\rightarrow$ `'active'`<br>`nonaktif` $\rightarrow$ `'inactive'`. | Akun alumni tetap dapat login read-only; akun nonaktif diblokir dari login. |
| `password_hash` | `VARCHAR(255)` | `auth_credentials.password_hash` | Disalin verbatim (Bcrypt `$2y$` / `$2b$`). **Zero password reset requirement.** | Jika hash bukan Bcrypt, tandai bendera `needs_rehash = true`. |
| `oauth_email` | `VARCHAR(128)` | `auth_credentials.oauth_email` | Lowercase. Disimpan untuk login Google OAuth. | **UNIQUE KEY** jika tidak null. |
| `divisi` | `VARCHAR(64)` | `organization_membership.division` | Normalisasi ke ID divisi kanonikal: `div-technical`, `div-editor`, `div-layouter`, `div-creative`, `div-engagements`. | FK ke `organization_division.id`. |
| `jabatan` | `VARCHAR(64)` | `organization_membership.position` | Normalisasi gelar: `Ketua Umum`, `Ketua Divisi`, `Anggota`, `Sekretaris & Bendahara`, dll. | — |
| `angkatan` | `INT` | `organization_membership.angkatan` | Disimpan sebagai integer tahun angkatan/periode. | — |
| `status` (split 2) | `VARCHAR(32)` | `organization_membership.status_organisasi` | `aktif` $\rightarrow$ `'active'`<br>`alumni` $\rightarrow$ `'inactive'`<br>`nonaktif` $\rightarrow$ `'inactive'`. | Menentukan izin mutasi operasional (alumni kehilangan izin mutasi). |
| `role` | `VARCHAR(32)` | `account_profiles.profile_id` | `admin` / `eksekutif` $\rightarrow$ `'eksekutif'`<br>`kepolo` $\rightarrow$ `'kepolo_kepali'`<br>`crew` $\rightarrow$ `'crew'`<br>`pembina` $\rightarrow$ `'pembina'`. | FK ke `access_profile.id`. |
| `crew_id == 'PTV-023'` | Khusus | `account_capability_overrides` | Khusus Farsya (`PTV-023`): Menambahkan override `allow` untuk kapabilitas `finance.operator`. | Mengeliminasi hardcode legacy `if (ptvId === 'PTV-023')`. |

---

### Matriks 2: Pemetaan Inventaris Peralatan Studio (`ptv_inventaris`)
Pada sistem lama, peralatan dicatat secara agregat. Skema kanonikal memisahkan master barang, unit individual ber-barcode, dan valuasi aset:

| Kolom Sumber (`wp_ptv_inventaris`) | Tabel & Kolom Tujuan | Aturan Transformasi | Ketergantungan Foreign Key |
| :--- | :--- | :--- | :--- |
| `kode` (misal `INV-001`) | `ptv_inventaris.kode` | Disalin verbatim. Format kanonikal `INV-xxx`. | **UNIQUE KEY**. |
| `nama` | `ptv_inventaris.nama` | Disalin verbatim. | — |
| `kategori` | `ptv_inventaris.kategori` | Normalisasi kategori alat (Kamera, Audio, Lighting, Streaming, dll.). | — |
| `merk` & `tipe` | `ptv_inventaris.merk`, `tipe` | Disalin verbatim. | — |
| `foto_url` | `ptv_inventaris.foto_url` | Diarahkan ke URL Cloudflare R2 CDN (lihat `docs/PTV-PRO-PHASE-5D-MEDIA-MIGRATION-PLAN.md`). Jika kosong diisi `NULL`. | — |
| `total_unit` (misal 3) | `ptv_inventaris.total_unit` | Disimpan sebagai total kuantitas master. | Menjadi acuan generate baris di `ptv_inventaris_unit`. |
| — (Dihasilkan saat migrasi) | `ptv_inventaris_unit` | **Generate N baris** untuk setiap unit fisik (`1` s.d. `total_unit`). Kode unit: `INV-001-U01`, `INV-001-U02`, dst. Barcode otomatis terisi. Status default: `'tersedia'`. | `inventaris_id -> ptv_inventaris.id`. |
| `harga_beli` | `ptv_inventaris.harga_beli` | Disalin verbatim. | RLS terisolasi dari Pembina. |
| `harga_beli * total_unit` | `ptv_nilai_inventaris.total_nilai_perolehan` | Dihitung otomatis sebagai nilai buku perolehan aset. | RLS terisolasi dari Pembina. |

---

### Matriks 3: Pemetaan Transaksi Peminjaman (`ptv_peminjaman`)

| Kolom Sumber (`wp_ptv_peminjaman`) | Tabel & Kolom Tujuan | Aturan Transformasi & Rekonsiliasi FK | Ketergantungan Foreign Key |
| :--- | :--- | :--- | :--- |
| `transaction_id` | `ptv_peminjaman.transaction_id` | Disalin verbatim (misal `TRX-202610-001`). | Kunci grup transaksi pinjam multi-unit. |
| `unit_kode` / `barang_id` | `ptv_peminjaman.unit_id` | **Resolusi Relasional:** Dicocokkan ke unit fisik kanonikal di `ptv_inventaris_unit.id`. | FK ke `ptv_inventaris_unit.id`. Wajib ada. |
| `peminjam_ptv_id` / `nama` | `ptv_peminjaman.peminjam_id` | **Resolusi Relasional:** Dicocokkan via `ptv_id` ke `canonical_identity.id`. Jika peminjam eksternal, `peminjam_id = NULL`. | FK ke `canonical_identity.id`. |
| `peminjam_nama` | `ptv_peminjaman.peminjam_nama` | Disalin verbatim. | Menjamin nama peminjam eksternal tetap tercatat. |
| `tujuan` & `event_name` | `ptv_peminjaman.tujuan`, `nama_acara` | Disalin verbatim. | — |
| `tanggal_pinjam` | `ptv_peminjaman.tanggal_pinjam` | Date. | — |
| `batas_kembali` | `ptv_peminjaman.batas_kembali` | Date. | — |
| `tanggal_kembali` | `ptv_peminjaman.tanggal_kembali` | Date NULL jika belum kembali. | — |
| `status` | `ptv_peminjaman.status` | `'dipinjam'` atau `'dikembalikan'`. | Jika `'dipinjam'`, unit terkait diset `'dipinjam'`. |
| `petugas_ptv_id` | `ptv_peminjaman.actor_id` | Dicocokkan ke `canonical_identity.id` kru operator yang melayani checkout. | FK ke `canonical_identity.id`. |

---

### Matriks 4: Pemetaan Surat Resmi Studio (`ptv_surat_tugas`, `ptv_surat_izin`, `ptv_surat_barang`)

| Kolom Sumber | Tabel & Kolom Tujuan | Aturan Transformasi & Rekonsiliasi FK | Ketergantungan Foreign Key |
| :--- | :--- | :--- | :--- |
| `nomor_surat` | `nomor_surat` | Disalin verbatim (misal `012/ST/PTV/X/2026`). | **UNIQUE KEY**. |
| `perihal` / `alasan` / `nama_pembawa` | Sesuai tabel target | Disalin verbatim. | — |
| `diajukan_oleh_ptv_id` | `diajukan_oleh` (UUID) | **Resolusi Relasional:** Dicocokkan via `ptv_id` ke `canonical_identity.id`. Jika tidak ditemukan, **DI-SET NULL** (fail-closed guard aktif). | FK ke `canonical_identity.id ON DELETE RESTRICT`. |
| `disetujui_oleh_ptv_id` | `disetujui_oleh` (UUID) | **Resolusi Relasional:** Dicocokkan via `ptv_id` ke `canonical_identity.id`. | FK ke `canonical_identity.id`. |
| `status` | `status` | `'diajukan'`, `'disetujui'`, `'ditolak'`. | — |

---

### Matriks 5: Pemetaan Keuangan Kas Studio (`ptv_keuangan`, `ptv_kas_kru`)

| Kolom Sumber | Tabel & Kolom Tujuan | Aturan Transformasi | Ketergantungan Foreign Key |
| :--- | :--- | :--- | :--- |
| `kode_voucher` | `ptv_keuangan.kode_voucher` | Disalin verbatim (misal `VCH-2026-001`). | **UNIQUE KEY**. |
| `nominal`, `jenis`, `kategori`, `keterangan` | Sesuai tabel target | Disalin verbatim. `jenis IN ('pemasukan', 'pengeluaran')`. | — |
| `pic_ptv_id` | `ptv_keuangan.pic_id` | Dicocokkan via `ptv_id` ke `canonical_identity.id`. | FK ke `canonical_identity.id`. |

---

## 5. Daftar Konflik Potensial dan Mitigasi Risiko

Berdasarkan analisis aturan validasi pada [`tests/migration/migrationDryRun.test.ts`](file:///c:/Users/zidna/ptvpro/tests/migration/migrationDryRun.test.ts), diidentifikasi 8 potensi konflik data legacy:

| No | Potensi Konflik / Anomali Data | Dampak Jika Tidak Dimigrasikan dengan Benar | Strategi Deteksi & Mitigasi | Klasifikasi Risiko |
| :-: | :--- | :--- | :--- | :---: |
| **1** | **Duplikasi `crew_id` (PTV ID)** | Pelanggaran constraint UNIQUE pada `canonical_identity.ptv_id`. Transaksi migrasi gagal. | Skrip migrasi memfilter duplikat via `ROW_NUMBER() OVER (PARTITION BY crew_id ORDER BY id DESC)`. Duplikat lama dimasukkan ke tabel penampung anomali (`_migration_exceptions`). | **TINGGI** |
| **2** | **Duplikasi `username` (Case-Insensitive)** | Pelanggaran constraint UNIQUE pada `user_account.username`. | Skrip mendeteksi via `LOWER(username)`. Jika ada duplikat, akun kedua diberi suffix numerik (`username_2`) dan dicatat di log migrasi untuk verifikasi admin. | **SEDANG** |
| **3** | **Hash Password Bukan Bcrypt (Legacy MD5 / SHA1)** | Pengguna gagal login di Supabase Auth karena format hash tidak kompatibel. | Skrip memeriksa prefix `$2y$` / `$2b$`. Jika format lawas ditemukan, akun ditandai `needs_password_reset = true` dan kru diinstruksikan reset via verifikasi WhatsApp/admin. | **SEDANG** |
| **4** | **Duplikasi `oauth_email`** | Pelanggaran constraint UNIQUE pada `auth_credentials.oauth_email`. | Akun dengan email OAuth ganda dinullkan email OAuth-nya dan diminta re-link saat login pertama. | **RENDAH** |
| **5** | **Nilai `diajukan_oleh` / `peminjam_id` Yatim (Orphan Reference)** | Pelanggaran foreign key constraint `REFERENCES canonical_identity(id)` yang memicu rollback. | **Aturan Ketat:** Kolom yang tidak menemukan pasangan id diubah menjadi `NULL`. Dokumen surat atau transaksi peminjaman tetap utuh dengan nama string peminjam/pengaju di kolom teks. | **TINGGI** |
| **6** | **Nilai Kolom Wajib NULL pada Data Legacy** | Gagal INSERT karena constraint `NOT NULL` (misal perihal surat, nama pemohon, kategori alat). | Skrip menyediakan nilai default standar institusional yang aman (misal: `[Tanpa Perihal]`, `[Kategori Umum]`). | **SEDANG** |
| **7** | **Divisi atau Jabatan Tidak Dikenal** | Pelanggaran relasi ke tabel master divisi. | Pemetaan dialihkan ke divisi fallback `div-engagements` atau `div-technical` dan dicatat di log pengecualian. | **RENDAH** |
| **8** | **Ambiguitas Unit Fisik pada Peminjaman Lama** | Peminjaman lama mencatat kode master `INV-001`, bukan kode unit fisik `INV-001-U01`. | Skrip memetakan secara cerdas ke unit fisik pertama (`U01`) dari master inventaris terkait. | **SEDANG** |

---

## 6. Urutan Migrasi Data yang Direkomendasikan (Dependency Topology)

Urutan migrasi disusun secara matematis mengikuti pohon ketergantungan Foreign Key:

```
Tingkat 0: Master Reference Data (SUDAH AKTIF: Organisasi, Divisi, Profil, Kapabilitas)
   │
   ▼
Tingkat 1: Fondasi Identitas Manusia
   ├── 1.1 canonical_identity (id, ptv_id, full_name, avatar_url)
   ├── 1.2 identity_contact (phone_wa, email_personal)
   ├── 1.3 user_account (username, status_akun)
   ├── 1.4 auth_credentials (password_hash, oauth_email)
   ├── 1.5 organization_membership (divisi, jabatan, angkatan, status_organisasi)
   └── 1.6 account_profiles & account_capability_overrides (profil role & exception PTV-023)
   │
   ▼ [Gate Check 1: Verifikasi view ptv_kru_legacy_compat cocok 100%]
   │
Tingkat 2: Master Inventaris & Unit Fisik
   ├── 2.1 ptv_inventaris (master alat & kode INV-xxx)
   ├── 2.2 ptv_inventaris_unit (generate unit fisik ber-barcode)
   └── 2.3 ptv_nilai_inventaris (nilai aset modal)
   │
   ▼ [Gate Check 2: Verifikasi setiap unit fisik terhubung ke master inventaris]
   │
Tingkat 3: Transaksi Peminjaman & Surat Resmi
   ├── 3.1 ptv_peminjaman (relasi ke ptv_inventaris_unit & canonical_identity)
   ├── 3.2 ptv_lapor_masalah & ptv_lost_found (relasi ke unit & pelapor)
   └── 3.3 ptv_surat_tugas, ptv_surat_izin, ptv_surat_barang (relasi ke diajukan_oleh & disetujui_oleh)
   │
   ▼ [Gate Check 3: Zero orphan references pada peminjaman dan surat]
   │
Tingkat 4: Keuangan, Kas, Kontak & Agenda
   ├── 4.1 ptv_keuangan, ptv_pemasukan, ptv_pengeluaran
   ├── 4.2 ptv_kas_kru & ptv_kas_periode
   └── 4.3 ptv_catatan, ptv_kontak_eksternal, ptv_pengumuman, ptv_acara, ptv_acara_rundown
   │
   ▼ [Gate Check 4: Verifikasi saldo kas dan rekonsiliasi total transaksi]
   │
Tingkat 5: Verifikasi Final & Pengujian Integrasi
   └── Uji autentikasi hash Bcrypt, uji RLS quarantine pembina, uji 5 RPC stored procedures.
```

---

## 7. Rencana Validasi dan Pemulihan (Validation & Recovery Strategy)

### A. Protokol Validasi Otomatis (Per-Stage Gate Checks)
Setiap tingkat migrasi wajib diverifikasi sebelum melangkah ke tingkat berikutnya:

1. **Gate Check 1 (Identitas & Kru):**
   - Jalankan kueri: `SELECT count(*) FROM public.canonical_identity;`
   - Bandingkan dengan jumlah kru di view: `SELECT count(*) FROM public.ptv_kru_legacy_compat;`
   - Pastikan selisih = 0.
2. **Gate Check 2 (Inventaris & Unit):**
   - Pastikan: `SELECT count(*) FROM public.ptv_inventaris_unit WHERE inventaris_id NOT IN (SELECT id FROM public.ptv_inventaris);` bernilai **0**.
3. **Gate Check 3 (Peminjaman & Surat):**
   - Jalankan Seksi 15 dari [`docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql).
   - Pastikan baris orphan pada `ptv_surat_tugas`, `ptv_surat_izin`, dan `ptv_surat_barang` bernilai **0**.
4. **Gate Check 4 (Keuangan):**
   - Pastikan total saldo di `ptv_keuangan` konsisten dengan agregat pemasukan dikurangi pengeluaran.

### B. Strategi Pemulihan (Rollback & Safe Reset)
Jika terjadi kegagalan atau anomali data di tengah jalan:
1. **Transaksional Per-Tingkat:** Setiap naskah migrasi dibungkus dalam blok `BEGIN; ... COMMIT;`. Jika terjadi error, transaksi otomatis me-rollback tingkat tersebut tanpa memengaruhi tingkat sebelumnya.
2. **Snapshot Pre-Migration:** Sebelum migrasi dimulai, snapshot harian Supabase Staging diverifikasi di dashboard.
3. **Isolated Staging Testing:** Seluruh pengujian migrasi dijalankan di staging (`swadgljnyelsjstqqxbm`). Database produksi (`progresiftv.id`) sama sekali tidak disentuh.

---

## 8. Keputusan Resmi Pemilik Proyek (Data & Media Decisions)

### A. Keputusan Data Relasional (Phase 5D Core)
| ID Keputusan | Topik | Pertanyaan untuk Pemilik Proyek | Keputusan Resmi / Status |
| :---: | :--- | :--- | :--- |
| **DEC-5D-01** | **Eksportir Data Legacy WordPress** | Format apa yang akan digunakan untuk mengekstrak data dari WordPress MySQL: dump SQL mentah (`.sql`), ekspor JSON via skrip bridge PHP, atau koneksi langsung staging-to-MySQL? | **Ekspor JSON terstruktur via bridge PHP terotentikasi.** Format JSON memungkinkan validasi skema, pembersihan karakter aneh, dan dry-run lokal sebelum di-INSERT ke Supabase. |
| **DEC-5D-02** | **Penanganan Hash Non-Bcrypt** | Jika ditemukan kru lama yang akunnya masih menggunakan hash selain Bcrypt, apakah akun diizinkan reset via WhatsApp/Admin atau diblokir sementara? | **Tandai `needs_password_reset = true`.** Kru dapat login menggunakan kode verifikasi sementara atau bantuan Ketua Umum. |
| **DEC-5D-03** | **Aturan Penomoran Unit Fisik** | Jika master inventaris lama mencatat `total_unit = 5` tanpa rincian nomor seri, apakah format penomoran unit otomatis `[KODE]-U[01..N]` disetujui? | **Setujui format `INV-xxx-U01`.** Format ini memudahkan pencetakan stiker barcode baru di studio. |
| **DEC-5D-04** | **Peminjam Eksternal Tanpa PTV ID** | Untuk transaksi peminjaman masa lalu yang dilakukan oleh pihak luar pesantren (bukan kru PTV), apakah disetujui `peminjam_id = NULL` dengan nama tercatat di kolom `peminjam_nama`? | **Setujui `peminjam_id = NULL`.** Integritas foreign key terjaga tanpa memaksa pembuatan identitas fiktif untuk pihak luar. |

### B. Keputusan Resmi Arsitektur Media Cloudflare R2 (DEC-5D-05 s.d. DEC-5D-08)
Empat keputusan media telah resmi ditetapkan oleh Pemilik Proyek (lihat rincian lengkap pada [docs/PTV-PRO-PHASE-5D-MEDIA-MIGRATION-PLAN.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PHASE-5D-MEDIA-MIGRATION-PLAN.md)):
1. **DEC-5D-05 (Pemisahan Bucket): RESMI DITETAPKAN** menggunakan **dua bucket Cloudflare R2 terpisah secara fisik** (`ptvpro-media-public` & `ptvpro-media-private`). Bucket privat tidak boleh memiliki custom domain publik. Akses privat wajib melalui API backend dengan presigned GET URL (maksimal 15 menit).
2. **DEC-5D-06 (Custom Domain Media): RESMI DITETAPKAN** merencanakan custom domain publik seperti `media.ptvpro.com` sejak awal untuk bucket publik. *Catatan: Subdomain ini baru berupa perencanaan arsitektur, belum dikonfigurasi pada DNS, dan dilarang mengubah DNS saat ini.*
3. **DEC-5D-07 (Audit Struktur Metadata): RESMI DITETAPKAN** melakukan audit kolom eksisting (`canonical_identity.avatar_url`, `ptv_inventaris.foto_url`, `ptv_lost_found.foto_url`) sebelum memutuskan skema baru. **Tidak langsung membuat tabel `public.app_media_object`**. Opsi tabel terpusat didokumentasikan sebagai proposal teknis tanpa mutasi DDL.
4. **DEC-5D-08 (Karantina File Orphan WordPress): RESMI DITETAPKAN** seluruh file upload lama yang tidak memiliki rujukan relasi operasional PTV PRO yang jelas **wajib dicatat dan dikarantina dalam manifest audit**. File orphan dilarang dihapus, dilarang dipindahkan, dan dilarang dimigrasikan ke R2.

---

## 9. Status Akhir & Kriteria Penutupan Phase 5D (Phase Closure Decision)

### A. Rekapitulasi Status Kesiapan (Design vs Execution Boundary)
Untuk mencegah kesalahpahaman antara kesiapan desain dan kesiapan eksekusi fisik, batas-batas fase dinyatakan secara eksplisit:

| Dimensi | Status Aktual | Keterangan & Batas Mutlak |
| :--- | :---: | :--- |
| **Pekerjaan Desain Data & Media** | **SELESAI (CLOSED)** | Seluruh matriks pemetaan 37 tabel, mitigasi anomali, lifecycle media, 4 pilar penghapusan, dan arsitektur R2 telah selesai dirancang dan konsisten. |
| **Keputusan Pengguna & Desain** | **DEFINITIF** | 10 keputusan arsitektur resmi (`DEC-5D-01` s.d. `DEC-5D-08` + 3 rekomendasi arsitektur final) telah tercatat dengan rekomendasi jelas. |
| **Integritas DDL SQL Baseline** | **INTACT (100% UTUH)** | `PTV-PRO-DATABASE-MIGRATION-DRAFT.sql` dan `PTV-PRO-DATABASE-MIGRATION-REVISED.sql` tidak mengalami perubahan skema baru. |
| **Implementasi Cloud & Bucket R2** | **BELUM DIIMPLEMENTASIKAN** | Zero provisioning Cloudflare R2, zero mutasi DNS, zero deployment. Bucket belum dibuat. |
| **Migrasi Data Riil & File Biner** | **BELUM DIJALANKAN** | Zero data migration. Database staging tetap berstatus clean slate operasional (0 baris). Server WordPress tetap menjadi sumber produksi aktif. |

### B. Prasyarat Mutlak Sebelum Cutover Produksi (Mandatory Cutover Gates)
Sebelum cutover dari WordPress ke PTV PRO dapat dilaksanakan di masa depan:
1. **Verifikasi Backup & Pemulihan:** Snapshot utuh WordPress `$wpdb`, direktori uploads, dan staging Supabase diverifikasi dapat di-restore.
2. **Persetujuan Tertulis DBA:** DDL tabel metadata media / junction disetujui formal oleh DBA.
3. **Validasi Manifest Media:** Manifest file in-scope dan karantina orphan terverifikasi 100% SHA-256.
4. **Verifikasi Otorisasi & Anti-Leak:** Pengujian hak akses membuktikan dokumen privat dan surat internal tidak dapat diakses tanpa token sah.
5. **Persetujuan Pemilik Sistem:** Konfirmasi formal tertulis dari Ketua Umum / Pembina PTV.

### C. Keputusan Penutupan Fase 5D

```
================================================================================
STATUS AKHIR PHASE 5D: DESIGN PHASE CLOSED
================================================================================
```

Pekerjaan fase desain migrasi data dan media telah **SELESAI DITUTUP (DESIGN PHASE CLOSED)**. Tidak ada blocker desain yang tersisa. Pekerjaan proyek dapat melangkah ke fase berikutnya (UI Implementation / Phase 5E) tanpa melakukan mutasi data sebelum gerbang implementasi dibuka.
