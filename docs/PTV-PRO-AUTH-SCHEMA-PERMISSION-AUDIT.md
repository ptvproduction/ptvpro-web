# AUTH SCHEMA PERMISSION AUDIT

**Subsystem:** PTV PRO Database & Supabase Integration  
**Target File:** `docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql`  
**Date:** 09 Oktober 2026  
**Status:** AUDITED (READ-ONLY)  

---

## 1. Error Description
```text
ERROR: 42501: permission denied for schema auth
```
PostgreSQL error code `42501` merepresentasikan `insufficient_privilege`.

---

## 2. Problematic Statements (Exact Root Cause)

Ada **2 statement spesifik** di dalam [`docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql) yang secara langsung menyebabkan Supabase menolak eksekusi DDL:

### Problematic Statement 1:
- **File:** `docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql`
- **Line:** 627
- **SQL:**
```sql
CREATE OR REPLACE FUNCTION auth.jwt_custom_claims()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
...
$$;
```

### Problematic Statement 2:
- **File:** `docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql`
- **Line:** 684
- **SQL:**
```sql
CREATE OR REPLACE FUNCTION auth.has_capability(p_capability TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
...
$$;
```

---

## 3. Why Supabase Rejects It

1. **Managed Schema Boundary:**  
   Di Supabase, skema `auth` adalah *managed internal schema* yang digunakan dan dikontrol secara eksklusif oleh layanan GoTrue (Supabase Auth service).
2. **Ownership & Role Privileges:**  
   Pemilik (*owner*) skema `auth` adalah role internal `supabase_admin` / `supabase_auth_admin`. Saat pengguna atau script menjalankan query di **SQL Editor** Supabase Dashboard, sesi koneksi berjalan di bawah role `postgres`.
3. **Pencabutan Hak Akses `CREATE`:**  
   Supabase secara eksplisit mencabut (*revokes*) hak `CREATE` pada skema `auth` dari role `postgres`, `anon`, `authenticated`, dan `service_role`.
4. **Trigger Pelanggaran:**  
   Ketika PostgreSQL mengeksekusi instruksi `CREATE OR REPLACE FUNCTION auth.<nama_fungsi>`, engine memeriksa apakah role aktif (`postgres`) memiliki privilege `CREATE` di skema target `auth`. Karena hak tersebut tidak ada, PostgreSQL langsung menghentikan transaksi dengan pesan:
   $$\mathbf{ERROR:\ 42501:\ permission\ denied\ for\ schema\ auth}$$

---

## 4. Audit & Klasifikasi Seluruh Statement Terkait `auth`

| Lokasi (Line) | Statement / Potongan SQL | Klasifikasi | Keterangan |
| :--- | :--- | :--- | :--- |
| **Line 59** | `auth_user_id UUID UNIQUE NULL` | **A. SAFE** | Kolom lokal di `public.user_account` yang memetakan UUID dari `auth.users(id)`. Tidak memodifikasi skema `auth`. |
| **Line 73** | `CREATE TABLE IF NOT EXISTS auth_credentials` | **A. SAFE** | Nama tabel lokal di skema `public` (`public.auth_credentials`). |
| **Line 307** | `CREATE TABLE IF NOT EXISTS auth_audit_log` | **A. SAFE** | Nama tabel lokal di skema `public` (`public.auth_audit_log`). |
| **Line 627** | `CREATE OR REPLACE FUNCTION auth.jwt_custom_claims()` | **D. INVALID** | **PENYEBAB ERROR.** Mencoba membuat fungsi baru di dalam skema terkelola `auth`. Role `postgres` tidak memiliki hak `CREATE` pada skema `auth`. |
| **Line 644** | `WHERE ua.auth_user_id = auth.uid()` | **B. SAFE** | Membaca fungsi bawaan Supabase `auth.uid()`. Role `postgres` dan `authenticated` memiliki hak `EXECUTE` pada fungsi ini. |
| **Line 684** | `CREATE OR REPLACE FUNCTION auth.has_capability(p_capability TEXT)` | **D. INVALID** | **PENYEBAB ERROR.** Mencoba membuat fungsi baru di dalam skema terkelola `auth`. |
| **Line 692** | `v_claims JSONB := auth.jwt()` | **B. SAFE** | Membaca klaim JWT via fungsi bawaan Supabase `auth.jwt()`. Aman untuk dipanggil. |
| **Line 704** | `IF auth.uid() IS NULL THEN` | **B. SAFE** | Membaca konteks identitas via fungsi bawaan `auth.uid()`. Aman. |
| **Line 632, 689, 817, 872, 920, 952, 976** | `SET search_path = public, auth` | **B. SAFE** | Konfigurasi *search path* saat fungsi dieksekusi. Hanya mengatur urutan pencarian nama objek, tidak mengubah skema. |
| **Line 823, 877, 923, 987** | `IF NOT auth.has_capability(...) THEN` | **B. SAFE (Pemanggilan)** | Pemanggilan fungsi di dalam RPC stored procedures. Secara sintaksis aman, namun akan gagal jika fungsi belum terdefinisi. |
| **Line 1038, 1050** | `ALTER TABLE auth_credentials...` / `ALTER TABLE auth_audit_log...` | **A. SAFE** | Mengaktifkan RLS pada tabel skema `public`. |
| **Line 1055, 1058, 1061, 1064, 1068, 1071** | `USING (auth.has_capability(...))` | **B. SAFE (Pemanggilan)** | Kebijakan RLS memanggil evaluator kapabilitas. |
| **Line 1075** | `USING (identity_id = (auth.jwt() ->> 'identity_id')::uuid ...)` | **B. SAFE** | Membaca nilai dari fungsi bawaan `auth.jwt()`. Aman. |
| **Line 1083** | `WITH CHECK (auth.uid() IS NOT NULL)` | **B. SAFE** | Mengecek konteks otentikasi via `auth.uid()`. Aman. |

---

## 5. Ringkasan Kategori

- **A. SAFE (References / Tabel Public):**
  - Kolom mapping `auth_user_id` di `public.user_account`
  - Tabel `public.auth_credentials`
  - Tabel `public.auth_audit_log`
- **B. SAFE (Membaca auth context / Search Path):**
  - Pemanggilan fungsi bawaan Supabase: `auth.uid()`, `auth.jwt()`
  - Deklarasi keamanan `SET search_path = public, auth`
  - Evaluasi kebijakan RLS menggunakan konteks user
- **C. POTENTIALLY UNSAFE:**
  - Tidak ada (tidak ada `GRANT` atau `ALTER` terhadap objek skema `auth`).
- **D. INVALID (Membutuhkan privilege yang Supabase managed schema tidak berikan):**
  - **Line 627:** `CREATE OR REPLACE FUNCTION auth.jwt_custom_claims()`
  - **Line 684:** `CREATE OR REPLACE FUNCTION auth.has_capability(p_capability TEXT)`

---

## 6. Recommended Fix (Untuk Diimplementasikan Setelah Persetujuan)

1. **Pindahkan Fungsi Kustom ke Skema `public`:**
   - Ubah deklarasi:
     - `auth.jwt_custom_claims()` $\longrightarrow$ `public.jwt_custom_claims()` (atau jika diformat sebagai Supabase Auth Hook: `public.custom_access_token_hook(event jsonb)`)
     - `auth.has_capability(p_capability TEXT)` $\longrightarrow$ `public.has_capability(p_capability TEXT)`
2. **Perbarui Pemanggilan Fungsi:**
   - Pada RPC stored procedures (line 823, 877, 923, 987): ganti `auth.has_capability(...)` menjadi `public.has_capability(...)` (atau `has_capability(...)` karena `public` ada di *search path*).
   - Pada kebijakan RLS (line 1055, 1058, 1061, 1064, 1068, 1071, 1075): ganti `auth.has_capability(...)` menjadi `public.has_capability(...)` (atau `has_capability(...)`).
3. **Tetap Pertahankan Pemanggilan Fungsi Bawaan:**
   - `auth.uid()` dan `auth.jwt()` **TIDAK PERLU DIUBAH** karena fungsi-fungsi tersebut adalah modul resmi bawaan Supabase di skema `auth`.
4. **Pembaruan Test Harness:**
   - Perbarui regex pada `tests/database/schemaHarness.test.ts` agar memeriksa `public.has_capability` atau `has_capability`.

---

## 7. Production Safety Confirmation
- **100% UNTOUCHED**: Tidak ada koneksi, modifikasi, DDL, maupun query yang dilakukan ke sistem produksi (`progresiftv.id`, MySQL WordPress, `ptv_kru`, GitHub, Vercel).
