# PTV PRO — STAGING CLOUD VALIDATION REPORT

**Subsystem:** PTV PRO Database & Supabase Integration  
**Phase:** Phase 5C — Cloud Staging Validation  
**Date:** 09 Oktober 2026  
**Staging Project Reference:** `swadgljnyelsjstqqxbm`  
**Target URL:** `https://swadgljnyelsjstqqxbm.supabase.co`  
**Status:** **BLOCKED (DDL PENDING USER EXECUTION IN SUPABASE DASHBOARD)**  

---

## 1. Executive Summary

Laporan ini mencatat hasil pengujian *live read-only cloud validation* terhadap proyek Supabase Staging (`swadgljnyelsjstqqxbm`). Proyek Supabase staging telah berhasil dikonfirmasi aktif dan dapat diakses melalui koneksi jaringan lokal. Namun, verifikasi skema membuktikan bahwa DDL skema kanonikal belum dieksekusi di database cloud tersebut.

---

## 2. Validation Results Matrix

| Evaluasi | Komponen | Target Status | Hasil Pengujian Cloud | Status Gate |
| :--- | :--- | :--- | :--- | :--- |
| **A. Connectivity** | Network & GoTrue Health | Reachable | **HTTP 200 OK** (`GoTrue v2.197.0`) | **PASS** |
| **B. Project Ref** | Identifier Binding | `swadgljnyelsjstqqxbm` | Cocok antara URL dan payload JWT | **PASS** |
| **C. Environment Guard**| Isolation Policy | `staging` | Terkonfirmasi `VITE_APP_ENV=staging` | **PASS** |
| **D. DDL Deployment** | SQL Schema Execution | Deployed | **NOT DEPLOYED (0 / 27 tables)** | **FAIL / PENDING** |
| **E. Canonical Tables** | 22+ Tables + Views | 27 Relasi | **0 Terdeteksi (27 Missing: 404 PGRST205)** | **BLOCKED** |
| **F. Capability Registry**| Granular Capabilities | Tepat 53 | **Belum ada tabel `capability_registry`** | **BLOCKED** |
| **G. Access Profiles** | Canonical Profiles | Tepat 5 | **Belum ada tabel `access_profile`** | **BLOCKED** |
| **H. Stored Procedures**| Contracted RPC (5) | 5 RPC | **0 Terdeteksi (5 Missing: 404 PGRST202)** | **BLOCKED** |
| **I. RLS & Security** | Data Boundary Isolation | Fail-Closed | **PostgREST mengembalikan 404 (Aman/Kosong)**| **PASS (SAFE)** |
| **J. Stale JWT Defense** | `tokens_valid_after` | Active | **DDL belum dieksekusi** | **BLOCKED** |
| **K. Legacy Compat** | `ptv_kru_legacy_compat` | Updatable View | **Belum ada view kompatibilitas** | **BLOCKED** |
| **L. Production Safety**| Zero Prod Mutation | Untouched | **100% UNTOUCHED (Zero prod touch)** | **PASS** |

---

## 3. Detail Hasil Pengujian Empiris Cloud

### A. Connectivity & Handshake
- Probe: `GET https://swadgljnyelsjstqqxbm.supabase.co/auth/v1/health`
- Respon: `HTTP 200`
- Body: `{"version":"v2.197.0","name":"GoTrue","description":"GoTrue is a user registration and authentication API"}`
- Status: **PASS**. Proyek staging Supabase berjalan normal.

### B. Schema Table & View Audit (27 Relasi)
Pemeriksaan menyeluruh dilakukan terhadap seluruh relasi kanonikal:
1. `canonical_identity` $\rightarrow$ `404 PGRST205` (Table missing)
2. `identity_contact` $\rightarrow$ `404 PGRST205` (Table missing)
3. `user_account` $\rightarrow$ `404 PGRST205` (Table missing)
4. `auth_credentials` $\rightarrow$ `404 PGRST205` (Table missing)
5. `organization` $\rightarrow$ `404 PGRST205` (Table missing)
6. `organization_division` $\rightarrow$ `404 PGRST205` (Table missing)
7. `organization_membership` $\rightarrow$ `404 PGRST205` (Table missing)
8. `capability_registry` $\rightarrow$ `404 PGRST205` (Table missing)
9. `access_profile` $\rightarrow$ `404 PGRST205` (Table missing)
10. `profile_capabilities` $\rightarrow$ `404 PGRST205` (Table missing)
11. `account_profiles` $\rightarrow$ `404 PGRST205` (Table missing)
12. `account_capability_overrides` $\rightarrow$ `404 PGRST205` (Table missing)
13. `ptv_keuangan` $\rightarrow$ `404 PGRST205` (Table missing)
14. `ptv_pemasukan` $\rightarrow$ `404 PGRST205` (Table missing)
15. `ptv_inventaris` $\rightarrow$ `404 PGRST205` (Table missing)
16. `ptv_inventaris_unit` $\rightarrow$ `404 PGRST205` (Table missing)
17. `ptv_peminjaman` $\rightarrow$ `404 PGRST205` (Table missing)
18. `ptv_peminjaman_item` $\rightarrow$ `404 PGRST205` (Table missing)
19. `ptv_surat` $\rightarrow$ `404 PGRST205` (Table missing)
20. `ptv_presensi` $\rightarrow$ `404 PGRST205` (Table missing)
21. `ptv_notulen` $\rightarrow$ `404 PGRST205` (Table missing)
22. `ptv_biodata_publik` $\rightarrow$ `404 PGRST205` (Table missing)
23. `ptv_shortlink` $\rightarrow$ `404 PGRST205` (Table missing)
24. `ptv_login_history` $\rightarrow$ `404 PGRST205` (Table missing)
25. `ptv_push_subscriptions` $\rightarrow$ `404 PGRST205` (Table missing)
26. `auth_audit_log` $\rightarrow$ `404 PGRST205` (Table missing)
27. `ptv_kru_legacy_compat` $\rightarrow$ `404 PGRST205` (View missing)

**Hasil: 0/27 relasi terdeploy.**

### C. Contracted Stored Procedures (RPC)
Pemeriksaan POST terhadap 5 RPC kontrak:
1. `rpc_checkout_loan` $\rightarrow$ `404 PGRST202` (Function missing in schema cache)
2. `rpc_return_loan` $\rightarrow$ `404 PGRST202` (Function missing in schema cache)
3. `rpc_return_single_unit` $\rightarrow$ `404 PGRST202` (Function missing in schema cache)
4. `rpc_get_next_inv_code` $\rightarrow$ `404 PGRST202` (Function missing in schema cache)
5. `rpc_submit_official_doc` $\rightarrow$ `404 PGRST202` (Function missing in schema cache)

**Hasil: 0/5 RPC terdeploy.**

---

## 4. Analisis Penyebab & Mengapa DDL Tidak Dapat Dieksekusi Otomatis oleh AI

Kredensial yang tersedia di `.env.staging` adalah:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Secara arsitektur Supabase:
1. **Anon Key** memiliki role PostgreSQL `anon` yang dibatasi oleh PostgREST hanya untuk membaca/menulis tabel aplikasi sesuai aturan RLS. Anon key **secara sengaja tidak memiliki hak istimewa (privilege) untuk menjalankan DDL** (`CREATE TABLE`, `CREATE FUNCTION`, `CREATE TRIGGER`, `CREATE VIEW`, dsb).
2. Menjalankan DDL di Supabase Cloud membutuhkan salah satu dari:
   - **Metode Standar:** Menjalankan skrip di **Supabase Dashboard $\rightarrow$ SQL Editor** (akses web pengguna).
   - **Metode CLI / Direct DB:** Connection string PostgreSQL dengan hak superuser (`postgresql://postgres:[PASSWORD]@db.swadgljnyelsjstqqxbm.supabase.co:5432/postgres`) atau Personal Access Token (`SUPABASE_ACCESS_TOKEN`).
3. Kredensial administratif tersebut tidak ada di workspace, sehingga agen AI tidak memiliki wewenang atau saluran untuk menyuntikkan DDL ke server cloud tanpa tindakan manual pengguna.

---

## 5. Audit Keselamatan DDL Sebelum Eksekusi

File skrip DDL lokal [`docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql) telah diaudit ulang secara menyeluruh:
- ✅ **Zero Production URLs:** Tidak memuat `progresiftv.id` atau URL produksi lainnya.
- ✅ **Zero Production Secrets:** Tidak memuat API keys, password plaintext, atau service role keys produksi.
- ✅ **Zero Destructive Commands:** Tidak ada `DROP DATABASE`, tidak ada `TRUNCATE`, dan tidak ada `DROP TABLE` tanpa kondisi aman.
- ✅ **Zero Production Seed Data:** Tidak ada data user personal atau live record produksi yang di-seed; hanya skema, referensi kapabilitas (53), profil akses (5), divisi (5), dan organisasi.
- ✅ **SECURITY DEFINER Hardened:** Seluruh fungsi PostgreSQL mendeklarasikan `SET search_path = public, auth`.
- ✅ **Target Staging Only:** Skrip dirancang secara eksklusif untuk proyek staging terisolasi.

---

## 6. Tindakan Pengguna yang Dibutuhkan untuk Membuka Gerbang (Unblock)

Pengguna perlu mengeksekusi langkah berikut di dashboard Supabase:
1. Buka [Supabase Dashboard](https://supabase.com/dashboard/project/swadgljnyelsjstqqxbm).
2. Masuk ke menu **SQL Editor** di bilah kiri.
3. Klik **New query**.
4. Salin seluruh isi file lokal:  
   [`docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql)
5. Klik **Run** (atau tombol panah hijau).
6. Setelah selesai dengan pesan `Success. No rows returned`:
   Jalankan validator otomatis di terminal:
   ```bash
   node scripts/validate-staging-cloud.mjs
   ```

---

## 7. Status Next Gate

$$\mathbf{NEXT\ GATE:\ BLOCKED\ (WAITING\ FOR\ DDL\ EXECUTION\ IN\ SUPABASE\ DASHBOARD)}$$

**Phase 5D (Data Migration & Reconciliation) DILARANG DIMULAI** sampai seluruh 27 tabel/view dan 5 RPC terbukti terdeploy di Supabase Staging.
