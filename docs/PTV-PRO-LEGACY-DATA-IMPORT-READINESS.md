# PTV PRO / PTV HUB — PHASE 0D
## LEGACY DATA MIGRATION READINESS & DEPENDENCY REPORT

**Project:** PTV Pro / PTV Hub  
**Repository:** `C:\Users\zidna\ptvpro`  
**Target Database:** Supabase PostgreSQL (`swadgljnyelsjstqqxbm`)  
**Source Legacy:** WordPress Theme FIXPTV & Legacy MySQL Database (`ptv_db`)  
**Status:** PHASE 0D IMPORT READINESS COMPLETED — UNFULFILLED RAW DATA DEPENDENCY DETECTED  
**Execution Boundary:** FAIL-CLOSED DRY-RUN ENGINE — ZERO SOURCE DATA MUTATION  

---

## 1. EXECUTIVE AUDIT & STATUS KESIAPAN IMPORTER

Audit komprehensif terhadap mesin importer `scripts/legacy-data-importer.mjs` dan kesiapan data migrasi legacy menghasilkan temuan berikut:

### 1.1 Status Kesiapan Mesin Importer (scripts/legacy-data-importer.mjs)
- **Arsitektur:** Mengimplementasikan kelas `LegacyDataValidator` berarsitektur *Fail-Closed*.
- **Mode Eksekusi:** **DRY-RUN DEFAULT**. Tanpa flag eksplisit `--apply` dan konfirmasi operator, skrip menolak melakukan penulisan database.
- **Pemisahan Valuasi Aset:** Memvalidasi bahwa `harga_beli` dialihkan ke tabel `ptv_nilai_inventaris` sebagai `nilai_perolehan`, dan **BUKAN DIBUANG**. Kolom master `ptv_inventaris.harga_beli` dijamin bernilai `NULL`.
- **Tabel Pemetaan ID (ID Mapping Table):** Menyimpan relasi `legacy_id` -> `canonical_uuid` dalam memory buffer (`idMappingTable`) untuk menjaga konsistensi foreign key antar-domain (kru, inventaris, unit fisik, surat resmi).
- **Deteksi Duplikasi & Rekonsiliasi:** Memeriksa keunikan PTV ID, nomor surat, kode alat, dan unit pinjaman, serta menampilkan tabel ringkasan rekonsiliasi record.

---

## 2. LAPORAN DEPENDENCY YANG BELUM TERPENUHI (BLOCKER)

> [!WARNING]
> **UNFULFILLED DEPENDENCY: RAW MYSQL DUMP FILE BELUM TERSEDIA**  
> Pemeriksaan menyeluruh terhadap repositori `C:\Users\zidna\ptvpro` membuktikan bahwa:
> 1. File dump fisik basis data MySQL legacy (`ptv_db.sql`, `ptv_db.dump`, atau file ekspor JSON/CSV) **BELUM TERSEDIA** di dalam repositori.
> 2. Sumber data yang ada saat ini adalah kode template PHP legacy di path eksternal:  
>    `C:\Users\zidna\Local Sites\ptvrebuild\app\public\wp-content\themes\FIXPTV\page-dasbor.php`  
>    `C:\Users\zidna\ptvpro-web\legacy-reference\page-dasbor.php`  
> 3. Sesuai arahan instruksi: *"Jika file atau akses database Legacy belum tersedia, laporkan sebagai dependency yang belum terpenuhi. Jangan mengklaim migrasi siap dijalankan tanpa sumber data."*

### Tindakan yang Dibutuhkan dari Operator:
Sebelum migrasi data riil dapat dieksekusi:
1. Operator perlu melakukan ekspor (*mysqldump*) dari database MySQL legacy (`ptv_db`).
2. Menempatkan file dump tersebut di lokasi terstandarisasi, misalnya: `legacy/ptv_db.sql` atau format JSON di `data/legacy_ptv_db.json`.
3. Menjalankan importer dengan flag sumber:
   ```powershell
   node scripts/legacy-data-importer.mjs --source legacy/ptv_db.sql --dry-run
   ```

---

## 3. AUDIT 12 DOMAIN OPERASIONAL & ATURAN TRANSFORMASI

Importer telah siap memproses 12 domain operasional begitu file sumber data disediakan:

| No | Domain Operasional | Tabel Sumber Legacy | Tabel Target PostgreSQL | Validasi & Penanganan Kritis |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Organisasi & Divisi** | Field divisi legacy | `ptv_organization`, `ptv_division` | 7 divisi resmi (MGMT, TECH, PROD, CRTV, NEWS, PR, ADVS). |
| **2** | **Capability Registry & Roles** | Field role legacy | `ptv_access_profile`, `ptv_capability_registry` | 5 profil kanonikal & 53 capabilities; pemetaan khusus exception Farsya (`PTV-023`). |
| **3** | **Kru & Identitas Kanonikal** | `ptv_kru` | `canonical_identity` | Format PTV ID wajib `PTV-\d{3}`; `legacy_id` disimpan sebagai mapping foreign key. |
| **4** | **Akun Pengguna & Google Sub** | `ptv_kru` | `user_account` | Akun disinkronkan ke `google_sub`; password lama dinonaktifkan (dialihkan ke Google OAuth). |
| **5** | **Membership & Profil Kru** | `ptv_kru` | `ptv_organization_membership`, `ptv_crew_profile` | Resolusi divisi, jabatan, angkatan, dan URL avatar. |
| **6** | **Inventaris Master** | `ptv_inventaris` | `ptv_inventaris` | Kode alat unik; `harga_beli` dipaksa `NULL` (terisolasi). |
| **7** | **Unit Fisik Inventaris** | `ptv_inventaris.jumlah` | `ptv_inventaris_unit` | Generate unit fisik (`[KODE]-U01`, `[KODE]-U02`, dst.) dengan nomor seri & barcode. |
| **8** | **Buku Besar Valuasi Aset** | `ptv_inventaris.harga` | `ptv_nilai_inventaris` | **HARGA TIDAK DIBUANG:** Nominal harga beli dipindahkan ke `nilai_perolehan` terproteksi RLS. |
| **9** | **Peminjaman Alat** | `ptv_peminjaman` | `ptv_peminjaman` | Foreign key relasi unit terverifikasi; deteksi orphan pinjaman. |
| **10** | **Acara & Agenda Studio** | `ptv_agenda`, `DB.events` | `ptv_acara` | Normalisasi timestamp ke UTC ISO 8601; resolusi PIC acara. |
| **11** | **Surat Resmi & Perizinan** | `ptv_surat`, `ptv_arsip` | `ptv_surat_izin`, `ptv_surat_tugas`, `ptv_surat_barang` | **Submitter & Approver Separation:** Status draft dilarang memiliki approver. |
| **12** | **Keuangan, Catatan, Lost, Masalah** | `ptv_kas`, `ptv_catatan`, dll. | `ptv_keuangan`, `ptv_catatan`, `ptv_lost_found`, `ptv_lapor_masalah` | Jurnal kas terisolasi penuh dari Pembina; catatan dan pelaporan terhubung ke identitas pelapor. |

---

## 4. INTEGRASI DIRECT GOOGLE OAUTH & KOORDINASI ANTAR-AGEN

1. **Identitas Kanonikal Google:** Kolom `user_account.google_sub` adalah kunci stabil penautan pengguna Google OAuth langsung dari Vercel Functions.
2. **Koordinasi dengan Auth Agent:**
   - Auth Agent mengelola rute API `api/auth/*` dan dokumen `docs/PTV-PRO-DIRECT-GOOGLE-OAUTH-PLAN.md`.
   - Migration Agent menyediakan skema relasional, trigger, constraint, dan dokumen impor data.
   - **Zero Interference:** File milik Auth Agent tidak dimodifikasi sama sekali.
3. **Koordinasi dengan Homepage Agent:**
   - Homepage Agent mengelola portal publik di `src/products/portal/`.
   - **Zero Interference:** File milik Homepage Agent tidak dimodifikasi sama sekali.

---

## 5. REKOMENDASI TAHAPAN EKSEKUSI OPERATOR

1. **Langkah 1:** Operator meninjau dokumen Phase 0D dan menyetujui gate preflight staging.
2. **Langkah 2:** Operator mengeksekusi DDL fondasi & seed pada database staging Supabase (`swadgljnyelsjstqqxbm`).
3. **Langkah 3:** Operator mengekspor database legacy MySQL (`ptv_db`) ke file SQL/JSON dan meletakkannya di repositori.
4. **Langkah 4:** Menjalankan importer dalam mode dry-run:
   ```powershell
   node scripts/legacy-data-importer.mjs --source <path-to-dump> --dry-run
   ```
5. **Langkah 5:** Setelah hasil rekonsiliasi 100% valid dan disetujui, impor batch staging dieksekusi secara terawasi.

**FINAL STATUS:**  
`PHASE 0D RUNTIME VERIFICATION — WAITING FOR OPERATOR REVIEW`

**STOP. DO NOT DEPLOY OR IMPORT DATA WITHOUT APPROVAL.**
