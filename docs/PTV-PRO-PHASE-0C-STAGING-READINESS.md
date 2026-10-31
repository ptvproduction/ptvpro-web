# PTV PRO / PTV HUB — PHASE 0C
## POSTGRESQL STAGING READINESS & MIGRATION PREFLIGHT SPECIFICATION

**Project:** PTV Pro / PTV Hub (`https://ptvpro.com/hub`)  
**Repository:** `C:\Users\zidna\ptvpro`  
**Target Database:** Supabase Cloud PostgreSQL (`swadgljnyelsjstqqxbm`, us-east-1)  
**Database Role:** Dedicated Relational Storage & Stored Procedures (No Supabase Auth dependency)  
**Authentication & Hosting Authority:** Vercel Serverless Functions + Google OAuth Direct + HttpOnly Cookie  
**Identity Anchor:** `user_account.google_sub`  
**Status:** PHASE 0C STAGING PREFLIGHT READY — WAITING FOR OPERATOR APPROVAL  
**Execution Boundary:** Local Read-Only Audit & Dry-Run Importer — ZERO Cloud Mutation Executed  

---

## 1. EXECUTIVE CONTEXT & ARSITEKTUR KANONIKAL

Memasuki Fase 0C, seluruh arsitektur backend, skema relasional, dan model keamanan telah diselaraskan penuh dengan keputusan operasional resmi:

1. **Frontend:** React + TypeScript (SPA) di-host pada infrastruktur Vercel.
2. **Backend API:** Vercel Serverless Functions (`/api/*`) menangani seluruh operasi sensitif dan bisnis logika.
3. **Autentikasi Sesi:** Direct Google OAuth dikelola oleh Vercel. Sesi website menggunakan **HttpOnly, Secure, SameSite=Lax Cookie**. Supabase GoTrue Auth **tidak digunakan** untuk otentikasi website.
4. **Database Engine:** Supabase PostgreSQL digunakan murni sebagai database relasional berkemampuan tinggi.
5. **Penegakan Hak Akses (Dual-Layer Authorization):**
   - **Layer 1 (Application Level):** Vercel Functions memvalidasi sesi dan kapabilitas pengguna (dari 53 capabilities kanonikal) sebelum mengirim perintah ke database.
   - **Layer 2 (Database Level):** Row Level Security (RLS) tetap **100% AKTIF** pada seluruh 36 tabel kanonikal untuk memblokir akses scraping atau manipulasi langsung dari publik via PostgREST endpoint.

---

## 2. AUDIT KONSISTENSI DATABASE & INTEGRASI VERCEL

Audit komprehensif terhadap 3 artefak SQL final:
- `docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql` (Fondasi 37 Objek Database & 5 RPC Sirkulasi)
- `docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql` (Modul Atomik Inventaris, Unit, Valuasi, & Storage)
- `docs/PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql` (Seed Referensi Institusional Bebas Drift)

### 2.1 Verifikasi Struktur Tabel & Foreign Key
- **Total Objek Database:** 36 Tabel Relasional Kanonikal + 1 Compatibility View (`ptv_kru_legacy_compat`) = **37 Objek**.
- **Integritas Relasional:** Seluruh foreign key terikat secara konsisten. Relasi antara `ptv_inventaris_unit` dan `ptv_inventaris` menggunakan `ON DELETE RESTRICT` untuk melindungi riwayat alat. Relasi `ptv_nilai_inventaris` terikat unik (`UNIQUE (inventaris_id)`) dengan `ON DELETE CASCADE`.
- **Kolom google_sub:** Telah terpasang secara kanonikal pada `public.user_account` (`google_sub VARCHAR(255) UNIQUE NULL`) dengan indeks unik untuk resolusi instan subjek Google OAuth oleh Vercel Functions.

### 2.2 Kompatibilitas RPC Tanpa Sesi GoTrue
Seluruh RPC mutasi (`rpc_checkout_loan`, `rpc_return_loan`, `rpc_submit_official_doc`, `rpc_create_inventaris`, `rpc_get_next_inv_code`) mengimplementasikan validasi keamanan anti-spoofing berbasis `auth.uid()`.

**Bagaimana Vercel Backend Mengeksekusi RPC Ini Tanpa GoTrue?**
Pada PostgreSQL Supabase, fungsi bawaan `auth.uid()` didefinisikan secara standar sebagai:
```sql
nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
```
Ketika backend Vercel terhubung ke PostgreSQL menggunakan standard PostgreSQL client (`pg` / connection pooler), Vercel Function menetapkan identitas aktor yang telah diverifikasi di dalam transaksi:
```sql
BEGIN;
    -- Tetapkan ID aktor yang terautentikasi oleh sesi Vercel
    SELECT set_config('request.jwt.claim.sub', $1, true);
    SELECT set_config('request.jwt.claim.role', 'authenticated', true);
    
    -- Eksekusi RPC kanonikal
    SELECT public.rpc_create_inventaris($2, $3);
COMMIT;
```
- `auth.uid()` otomatis mengevaluasi ke ID pengguna yang valid.
- Gerbang anti-spoofing `IF auth.uid() IS NULL THEN RAISE EXCEPTION ...` terpenuhi dengan aman.
- Tidak ada perubahan kode pada DDL database, dan 71/71 test harness tetap PASS 100%.

### 2.3 Solusi Definitif Isolasi Valuasi Inventaris
- Kolom `ptv_inventaris.harga_beli` dijamin **SELALU NULL** di database master.
- Seluruh penulisan harga beli baru melalui `rpc_create_inventaris` dialihkan secara atomik ke `ptv_nilai_inventaris`.
- Trigger pertahanan lapis kedua `trg_sanitize_inventaris_harga_beli` pada `BEFORE INSERT OR UPDATE OF harga_beli` menetralkan input langsung menjadi `NULL` sebelum menyentuh heap disk.
- Tidak ada rekursi trigger, tidak ada dead tuples, dan tidak ada pelanggaran foreign key.

---

## 3. STATUS VERIFIKASI RUNTIME POSTGRESQL

Sesuai aturan tata kelola (Rule 1.7 *Bukti Validasi yang Jujur* dan Rule 1.11 *Dilarang Mengklaim Palsu*):
- **Hasil Uji Statis & Test Harness:** **71/71 Tests PASSED** (`vitest run` pada seluruh test database, drift remediation, contract consistency, dan integrasi inventaris).
- **Hasil AST DDL Parser:** Bebas dari syntax error, ekstensi valid (`uuid-ossp`, `pgcrypto`), search_path terisolasi (`pg_catalog, public, auth`).
- **Status Runtime Fisik:** **UNVERIFIED DATABASE RUNTIME**.
  Workstation pengembang tidak memiliki instance PostgreSQL / Docker lokal. Oleh karena itu, pengujian runtime dinamis fisik belum dapat dinyatakan lulus lokal.
- **Rencana Mitigasi:** Pengujian runtime fisik pertama akan dijalankan secara aman pada cloud staging (`swadgljnyelsjstqqxbm`) oleh Operator menggunakan checklist preflight di Bagian 4.

---

## 4. CHECKLIST PREFLIGHT & PANDUAN DEPLOYMENT OPERATOR

Operator dipersilakan menjalankan tahapan deployment berikut secara manual di **Supabase Dashboard SQL Editor** proyek `swadgljnyelsjstqqxbm`:

### TAHAP 1: PREFLIGHT INSPECTION (READ-ONLY)
Jalankan query diagnostik berikut untuk memverifikasi lingkungan staging bersih:
```sql
-- 1. Verifikasi Database & User Eksekusi
SELECT current_database() AS db_name, current_user AS executing_user;

-- 2. Pastikan Ekstensi Tersedia
SELECT name, default_version, installed_version 
FROM pg_available_extensions 
WHERE name IN ('uuid-ossp', 'pgcrypto');

-- 3. Deteksi Objek Eksisting (Pastikan belum ada tabrakan)
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'ptv_%' 
ORDER BY table_name;

-- 4. Periksa Storage Bucket
SELECT id, name, public FROM storage.buckets WHERE id = 'inventory';
```

### TAHAP 2: EKSEKUSI SKEMA UTAMA
Eksekusi file: `docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`
- Membangun 27 tabel kanonikal, enum institusional, view legacy `ptv_kru_legacy_compat`, 10 policy RLS inti, dan 5 RPC sirkulasi.
- Seluruh statement dibungkus dalam blok `BEGIN; ... COMMIT;`.

### TAHAP 3: EKSEKUSI DDL ATOMIK INVENTARIS & STORAGE
Eksekusi file: `docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql`
- Membangun tabel unit fisik (`ptv_inventaris_unit`) dan buku besar valuasi (`ptv_nilai_inventaris`).
- Mengonfigurasi RLS inventaris, bucket storage `inventory`, dan 4 storage policies.
- Mengaktifkan trigger `trg_sanitize_inventaris_harga_beli` dan RPC `rpc_create_inventaris`.

### TAHAP 4: EKSEKUSI SEED REFERENSI INSTITUSIONAL
Eksekusi file: `docs/PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql`
- Mengisi data organisasi (PTV Studio), 7 divisi resmi, 5 access profiles, dan 53 capabilities kanonikal.
- Menjalankan karantina privilege drift untuk profil Pembina.

### TAHAP 5: VERIFIKASI CLOUD OTOMATIS
Setelah Tahap 2–4 selesai, jalankan validator dari terminal lokal:
```powershell
node scripts/validate-staging-cloud.mjs
```
**Target Hasil:**
- `TABLES DEPLOYED: 27/27 (PASS)`
- `RPCS DEPLOYED: 7/7 (PASS)`
- `DATABASE POLICIES: PASS`
- `STORAGE BUCKETS: PASS`

---

## 5. CONTROLLED STAGING RECOVERY PROTOCOL (PENGGANTI DROP CASCADE)

> [!CAUTION]
> **DILARANG KERAS MENJALANKAN `DROP TABLE ... CASCADE`!**

Jika terjadi kendala saat deployment:
1. Setiap file SQL telah dibungkus blok transaksi `BEGIN; ... COMMIT;`. Kesalahan sintaks di tengah file otomatis memicu pembatalan total (*atomic transaction rollback*).
2. Jika perlu membatalkan objek tertentu yang bermasalah, lakukan *surgical rollback* hanya pada fungsi atau trigger terkait dengan persetujuan Operator:
   ```sql
   BEGIN;
       DROP FUNCTION IF EXISTS public.fn_sanitize_inventaris_harga_beli() CASCADE;
       DROP FUNCTION IF EXISTS public.rpc_create_inventaris(JSONB, JSONB);
   COMMIT;
   ```
3. Untuk pemulihan penuh lingkungan staging, gunakan fitur **Point-in-Time Recovery (PITR)** atau pemulihan snapshot cadangan resmi pada menu *Supabase Dashboard -> Settings -> Database -> Backups*.

---

## 6. KOORDINASI ANTAR-AGEN (CONTRACT BOUNDARIES)

1. **Batas Kerja Migration Agent (Sesi Ini):**
   - Mengelola integritas skema PostgreSQL, RPC, DDL, preflight checks, dan importer data legacy.
   - **TIDAK MENGUBAH** file frontend React (`src/products/*`), router (`src/app/router/*`), maupun implementasi Vercel Functions (`api/*`).
2. **Kontrak untuk Auth Agent (Vercel Functions):**
   - Kolom penautan: `user_account.google_sub`.
   - Query verifikasi identitas: `SELECT * FROM user_account WHERE google_sub = $1`.
   - Penugasan parameter sesi RPC: `SELECT set_config('request.jwt.claim.sub', <actor_uuid>, true)`.
3. **Kontrak untuk Homepage Agent (Portal PTVPRO):**
   - Mengonsumsi endpoint publik atau authenticated via Vercel Functions tanpa koneksi langsung ke database.

---

## 7. STOP GATE & PERSETUJUAN OPERATOR

Seluruh artefak SQL dan cetak biru preflight telah diverifikasi secara konsisten, aman, dan siap untuk dieksekusi.

**STATUS:**  
`PHASE 0C STAGING PREFLIGHT READY — WAITING FOR OPERATOR APPROVAL`

**STOP. DO NOT DEPLOY.**
