# PTV PRO / PTV HUB — PHASE 0C
## LEGACY DATA IMPORT PLAN & DRY-RUN PROTOCOL

**Project:** PTV Pro / PTV Hub  
**Repository:** `C:\Users\zidna\ptvpro`  
**Target Database:** Supabase PostgreSQL (`swadgljnyelsjstqqxbm`)  
**Source Legacy:** WordPress Theme FIXPTV (`page-dasbor.php`, `ptv-dashboard-data-bridge.php`) & Legacy DB `ptv_db`  
**Status:** PHASE 0C IMPORT PLAN READY — DRY-RUN ONLY  
**Execution Boundary:** FAIL-CLOSED DRY-RUN VALIDATOR — ZERO DATABASE WRITE  

---

## 1. TUJUAN & PRINSIP UTAMA MIGRASI DATA

1. **Zero Production Mutation:** Dokumen dan skrip importer ini beroperasi dalam mode **DRY-RUN DEFAULT**. Tidak ada penulisan data ke cloud staging sebelum lulus seluruh pemeriksaan dan disetujui Operator.
2. **Zero Fake Data:** Tidak ada data dummy, credential palsu, transaksi rekayasa, atau surat fiktif. Seluruh data berasal dari catatan riil sistem legacy.
3. **Pemisahan Identitas dan Hak Akses:** Data kru legacy (`ptv_kru`) dipetakan ke identitas kanonikal dengan `ptv_id` permanen. Kredensial password lama tidak dimigrasikan untuk otentikasi aktif karena dialihkan penuh ke Google OAuth.
4. **Isolasi Finansial & Valuasi:** Harga pembelian alat (`harga_beli`) dipisahkan ke tabel buku besar valuasi (`ptv_nilai_inventaris`), dan buku kas (`ptv_keuangan`) diproteksi penuh dari role Pembina/Pengarah.

---

## 2. RANCANGAN IMPORTER UNTUK 12 DOMAIN OPERASIONAL

Importer dirancang dengan arsitektur modular yang memproses 12 domain secara berurutan sesuai grafik dependensi foreign key:

```
+-----------------------------------------------------------------------------------+
| TAHAP 1: DATA REFERENSI MASTER (FONDASI)                                          |
| Domain 1: Divisi & Organisasi (ptv_organization, ptv_division)                    |
| Domain 2: Capability & Access Profiles (ptv_capability_registry, ptv_access_profile)|
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
| TAHAP 2: IDENTITAS KANONIKAL & AKUN PENGGUNA                                      |
| Domain 3: Identitas Kru (canonical_identity, user_account, identity_contact)       |
| Domain 4: Keanggotaan & Profil Kru (ptv_organization_membership, ptv_crew_profile) |
| Domain 5: Penugasan Profil Akses (ptv_account_profile_assignment)                 |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
| TAHAP 3: INVENTARIS ALAT & VALUASI ASET                                           |
| Domain 6: Master Alat (ptv_inventaris, spesifikasi, foto, harga_beli = NULL)      |
| Domain 7: Unit Fisik (ptv_inventaris_unit, nomor seri, barcode, kondisi)          |
| Domain 8: Valuasi Aset Terisolasi (ptv_nilai_inventaris, nilai perolehan)         |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
| TAHAP 4: TRANSAKSI OPERASIONAL & RIWAYAT HISTORIS                                 |
| Domain 9: Peminjaman Alat (ptv_peminjaman, relasi unit & peminjam)                |
| Domain 10: Acara & Agenda Studio (ptv_acara, jadwal, PIC)                         |
| Domain 11: Surat Resmi & Perizinan (ptv_surat_*, Submitter & Approver)             |
| Domain 12: Keuangan, Catatan, Lost & Found, Kerusakan (ptv_keuangan, dll.)        |
+-----------------------------------------------------------------------------------+
```

---

## 3. ATURAN VALIDASI DATA & DETEKSI DUPLIKASI (FAIL-CLOSED)

Setiap entri data legacy wajib melewati filter validasi ketat sebelum dimasukkan ke antrean migrasi:

| Domain | Validasi Format & Integritas | Kriteria Duplikasi | Penanganan Konflik |
| :--- | :--- | :--- | :--- |
| **Kru / Identitas** | `ptv_id` wajib berformat `PTV-\d{3}` (contoh: `PTV-001`). Nama minimal 3 karakter. | Duplikasi pada `ptv_id` atau `legacy_id` | Rekonsiliasi manual; ID kanonikal dipertahankan |
| **Akun Pengguna** | Username wajib alphanumeric lowercase (`[a-z0-9_]+`). Status: `active`/`inactive`. | Duplikasi pada `username` | Prefix `kru_<ptv_id>` jika terjadi konflik |
| **Inventaris** | Kode alat wajib berformat `[A-Z0-9-]+` (contoh: `CAM-01`). Kategori terdaftar resmi. | Duplikasi pada `kode` alat | Reject & fail-closed; laporkan nomor baris |
| **Unit Fisik** | Kode unit unik `[KODE_ALAT]-U\d{2}` (contoh: `CAM-01-U01`). Kondisi terstandarisasi. | Duplikasi pada `kode_unit` | Reject & fail-closed |
| **Peminjaman** | `unit_id` wajib terdaftar di `ptv_inventaris_unit`. Tanggal kembali >= tanggal pinjam. | Duplikasi `transaction_id` + `unit_id` | Lewati entri identik (*idempotent skip*) |
| **Surat Resmi** | Format `nomor_surat` resmi institusi. Submitter (`diajukan_oleh`) wajib valid. | Duplikasi pada `nomor_surat` | Reject; nomor surat resmi harus unik |
| **Keuangan** | Nominal transaksi wajib `> 0`. Kategori valid. Operator pencatat wajib valid. | Duplikasi `tanggal` + `nominal` + `uraian` | Tandai untuk konfirmasi Operator |

---

## 4. SKRIP IMPORTER DRY-RUN: scripts/legacy-data-importer.mjs

Skrip importer resmi disediakan di `scripts/legacy-data-importer.mjs`.

### Karakteristik Teknis:
1. **Mode Default: `--dry-run`:** Skrip tidak akan pernah mengirim query `INSERT` atau `UPDATE` kecuali flag `--apply` dan konfirmasi eksplisit operator diaktifkan.
2. **Simulasi Transformasi Lengkap:** Membaca data sumber legacy, menjalankan parsing, memetakan foreign key, memeriksa duplikasi, dan menghasilkan laporan audit rekonsiliasi.
3. **Laporan Audit Otomatis:** Menghitung jumlah baris valid, baris dilewati, baris ditolak, dan potensi orphan foreign key.

### Cara Menjalankan Importer Dry-Run:
```powershell
node scripts/legacy-data-importer.mjs --dry-run
```

---

## 5. TABEL REKONSILIASI TARGET DATA (EXPECTED RECONCILIATION)

| Domain | Tabel Target PostgreSQL | Estimasi Record Legacy | Target Validasi Pasca-Impor |
| :--- | :--- | :--- | :--- |
| **Organisasi & Divisi** | `ptv_organization`, `ptv_division` | 1 org, 7 divisi | 100% cocok dengan seed referensi |
| **Hak Akses & Roles** | `ptv_access_profile`, `ptv_capability_registry` | 5 profil, 53 capabilities | 100% cocok dengan seed referensi |
| **Kru & Identitas** | `canonical_identity`, `user_account` | ~42 kru aktif & alumni | 42 identitas dengan `ptv_id` unik |
| **Kontak Pribadi** | `identity_contact` | ~42 nomor kontak | Terlindungi RLS kontak pribadi |
| **Inventaris Master** | `ptv_inventaris` | ~148 master alat | 148 alat dengan `harga_beli = NULL` |
| **Unit Fisik Alat** | `ptv_inventaris_unit` | ~230 unit fisik | Seluruh unit memiliki foreign key valid ke alat |
| **Valuasi Aset** | `ptv_nilai_inventaris` | ~148 buku besar valuasi | 100% alat memiliki rekam nilai perolehan |
| **Peminjaman Alat** | `ptv_peminjaman` | ~215 riwayat transaksi | Seluruh transaksi memiliki `unit_id` valid |
| **Acara & Agenda** | `ptv_acara` | ~35 agenda studio | Tanggal tersinkronisasi UTC ISO 8601 |
| **Surat Resmi** | `ptv_surat_*` | ~85 surat tugas & izin | Submitter & Approver terpisah |
| **Buku Kas Keuangan** | `ptv_keuangan` | ~340 jurnal kas | Terkarantina penuh dari Pembina |
| **Catatan, Lost, Masalah** | `ptv_catatan`, `ptv_lost_found`, dll. | ~120 catatan & laporan | Relasi pelapor terverifikasi |

---

## 6. PROSEDUR EKSEKUSI TAHAP BERIKUTNYA

Setelah Operator menyetujui dokumen Phase 0C:
1. Operator menjalankan Tahap 2 s/d 4 deployment skema di Supabase Dashboard staging.
2. Menjalankan validasi cloud: `node scripts/validate-staging-cloud.mjs`.
3. Menjalankan simulasi dry-run importer: `node scripts/legacy-data-importer.mjs --dry-run`.
4. Setelah hasil dry-run 100% bersih, impor data staging dieksekusi secara terawasi (*supervised batch migration*).

**STATUS:**  
`PHASE 0C IMPORT PLAN READY — WAITING FOR OPERATOR APPROVAL`

**STOP. DO NOT DEPLOY.**
