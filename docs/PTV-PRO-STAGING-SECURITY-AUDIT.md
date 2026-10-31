# PTV PRO — STAGING SECURITY AUDIT REPORT (READ-ONLY)

**Subsystem:** PTV PRO Database, Supabase Staging & Authorization Layer  
**Phase:** Phase 5C.1 — Post-Validation Security & Least Privilege Audit  
**Target Environment:** Supabase Staging (`swadgljnyelsjstqqxbm`)  
**Audit Scope:** Read-Only Verification of Validator Access, RLS Enforcement, RPC Guards, and Permissions  
**Date:** 09 Oktober 2026  
**Status:** **AUDITED — NO CHANGES APPLIED (AWAITING OPERATOR REVIEW)**

---

## 1. Ringkasan Hasil Validator dan Metode Aksesnya

### 1.1 Hasil Pengujian Cloud Terakhir
Pemeriksaan menggunakan skrip verifikasi otomatis `node scripts/validate-staging-cloud.mjs` menghasilkan status kelulusan penuh:
* **Connectivity:** PASS (`GoTrue Auth Health OK`)
* **Canonical Tables & Views:** 37 / 37 Accessible (HTTP 200 OK)
* **Contracted RPC Procedures:** 7 / 7 Terverifikasi & Aktif
* **Reference Seed Data:**
  * `organization`: 2 baris (Sesuai ekspektasi)
  * `organization_division`: 5 baris (Sesuai ekspektasi)
  * `access_profile`: 5 baris (Sesuai ekspektasi)
  * `capability_registry`: 53 baris (Sesuai ekspektasi)
  * `profile_capabilities`: 177 pemetaan (Sesuai ekspektasi)
* **Pembina Quarantine Check:** VERIFIED (Tepat 10 kapabilitas; modul `finance.*` dan `inventory.valuation.*` terisolasi)
* **Status Akhir Validator:** `CLOUD VALIDATION PASS (FULL SCHEMA + SEED COMPLETE)`

### 1.2 Metode Akses & Jalur Komunikasi Validator
* **Konfigurasi Environment yang Digunakan:**
  * Sumber file: `.env.staging` (lokal).
  * Variabel endpoint: `VITE_SUPABASE_URL` (mengarah ke host Supabase Staging `swadgljnyelsjstqqxbm`).
  * Variabel kredensial: `VITE_SUPABASE_ANON_KEY`.
  * Variabel lingkungan: `VITE_APP_ENV` / `EXPECTED_ENVIRONMENT`.
  *(Catatan Keamanan: Nilai token, kunci, dan rahasia tidak disalin atau dicantumkan ke dalam dokumen ini).*
* **Klasifikasi Kredensial:**
  * Validator **hanya menggunakan Client Publishable Key / Anonymous Key (`VITE_SUPABASE_ANON_KEY`)**.
  * Validator **TIDAK** memiliki atau menggunakan Secret Admin Key (`service_role`).
  * Peran basis data (*database role*) yang aktif saat validator menjalankan permintaan adalah peran publik **`anon`**.
* **Protokol & Jalur Akses:**
  * Seluruh pembacaan data dan pengujian fungsi berlangsung **100% melalui Supabase PostgREST HTTP REST API** (`/rest/v1/...`) via protokol HTTPS.
  * Validator **tidak menggunakan koneksi TCP langsung ke engine PostgreSQL** (Direct Port 5432 / Transaction Pooler Port 6543 / psql).
  * Seluruh data yang dilaporkan lolos (*PASS*) dibaca dari representasi JSON yang disajikan oleh endpoint REST PostgREST.

---

## 2. Status RLS, Policy, dan Grants yang Terverifikasi

### 2.1 Status Row Level Security (RLS) pada Tabel Operasional & Sensitif
Berdasarkan DDL migrasi resmi [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql#L1065-L1127), sebanyak 17 tabel operasional secara tegas diaktifkan RLS-nya (`ENABLE ROW LEVEL SECURITY`) dan dilengkapi kebijakan granular:
1. `auth_credentials`: Dilindungi policy mutlak `USING (false)`. Klien eksternal (baik `anon` maupun `authenticated`) dilarang melakukan `SELECT`, `INSERT`, `UPDATE`, atau `DELETE`.
2. `ptv_keuangan`, `ptv_pemasukan`, `ptv_pengeluaran`: Dilindungi policy berbasis resolver kapabilitas:
   * `SELECT`: Memerlukan `has_capability('finance.view')` atau `has_capability('finance.operator')`.
   * `ALL`: Memerlukan `has_capability('finance.manage')`.
   * Pembina dan Crew secara efektif terblokir dari modul ini.
3. `ptv_nilai_inventaris`: Dilindungi policy terpisah:
   * `SELECT`: Memerlukan `has_capability('inventory.valuation.view')`.
   * `ALL`: Memerlukan `has_capability('inventory.valuation.manage')`.
   * Profil Pembina terisolasi dari valuasi modal aset.
4. `identity_contact`: Dilindungi policy berbasis identitas (`identity_id = (auth.jwt() ->> 'identity_id')::uuid` atau pemegang kapabilitas `crew.permissions.manage`).

### 2.2 Status RLS pada Lima Tabel Referensi Sistem
Kelima tabel referensi adalah:
1. `organization` (2 entitas)
2. `organization_division` (5 divisi)
3. `access_profile` (5 profil)
4. `capability_registry` (53 kapabilitas)
5. `profile_capabilities` (177 pemetaan)

**Analisis Perilaku:**
* Pada pengujian sebelum pembaruan database staging, kelima tabel ini mengembalikan respons `HTTP 200 OK` dengan header `Content-Range: */0` dan payload `[]` (0 baris terbaca oleh role `anon`).
* Pada pengujian terkini, kelima tabel ini mengembalikan seluruh baris data aktual (`Content-Range: 0-1/2`, `0-4/5`, `0-4/5`, `0-52/53`, `0-176/177`).
* Fakta ini mengonfirmasi bahwa role `anon` saat ini memiliki hak akses baca (`SELECT`) terhadap kelima tabel referensi tersebut.

### 2.3 Status Grants pada Fungsi Stored Procedure (RPC)
Seluruh 7 RPC yang diuji dideklarasikan sebagai `SECURITY DEFINER` dengan parameter isolasi `SET search_path = public, auth`:
1. `public.has_capability(TEXT)`: Diberikan hak `EXECUTE` kepada `authenticated, anon, service_role`. Memiliki guard internal `IF auth.uid() IS NULL THEN RETURN FALSE;` (aman, fail-closed saat anonim).
2. `public.jwt_custom_claims()`: Diberikan hak `EXECUTE` kepada `authenticated, service_role`.
3. `public.rpc_get_next_inv_code()`: Mengembalikan kode inventaris berikutnya. Meskipun dalam DDL tercantum `GRANT EXECUTE TO authenticated, service_role`, pengujian membuktikan fungsi ini **dapat dieksekusi secara sukses oleh role `anon` via REST**.
4. `public.rpc_checkout_loan(...)`: Memeriksa kapabilitas `loans.checkout`. Panggilan anonim ditolak dengan kode `P0001` (UNAUTHORIZED).
5. `public.rpc_return_loan(...)`: Memeriksa kapabilitas `loans.return`. Panggilan anonim ditolak dengan kode `P0001` (UNAUTHORIZED).
6. `public.rpc_return_single_unit(...)`: Memeriksa kapabilitas `loans.return`. Panggilan anonim ditolak dengan kode `P0001` (UNAUTHORIZED).
7. `public.rpc_submit_official_doc(...)`: Memeriksa kapabilitas `documents.request` / `documents.generate`. Panggilan anonim ditolak dengan kode `P0001` (UNAUTHORIZED).

---

## 3. Risiko Konkret dan Dampaknya

Meskipun status validator menunjukkan `PASS`, evaluasi keamanan berbasis kode dan runtime mengungkap risiko-risiko berikut:

### Risiko 1: Potensi Kerentanan Mutasi jika RLS Dinonaktifkan (*High Risk if Unprotected*)
* **Mekanisme Risiko:** Jika akses baca pada kelima tabel referensi dibuka dengan cara menonaktifkan RLS (`DISABLE ROW LEVEL SECURITY`) dan bukan dengan membuat kebijakan baca eksplisit (`CREATE POLICY ... FOR SELECT`), maka aturan default Supabase pada skema `public` berlaku. Dalam konfigurasi default tersebut, role `anon` mungkin mewarisi izin `ALL` atau `INSERT/UPDATE/DELETE`.
* **Dampak:** Pengguna publik tanpa autentikasi yang memiliki anon key berpotensi dapat menyisipkan (*inject*), mengubah, atau menghapus definisi organisasi, divisi, profil, dan pemetaan kapabilitas.
* **Mitigasi yang Diperlukan:** Memastikan RLS tetap aktif (`rowsecurity = true`) dan hanya mengizinkan operasi `SELECT` secara ketat.

### Risiko 2: Kerentanan Identity/Actor Spoofing pada Prosedur `SECURITY DEFINER` (*Medium-High Risk*)
* **Mekanisme Risiko:** Pada prosedur mutasi pinjaman dan persuratan:
  * `rpc_checkout_loan(..., p_actor_id UUID)`
  * `rpc_submit_official_doc(..., p_actor_id UUID)`
  Nilai `p_actor_id` diterima sebagai parameter input langsung dari payload client dan langsung ditulis ke kolom audit (`actor_id` di `ptv_peminjaman` dan `disetujui_oleh` di tabel persuratan) tanpa divalidasi silang terhadap identitas sesi autentikasi (`auth.uid()` atau klaim `identity_id`).
* **Dampak:** Pengguna terotentikasi yang sah (misal santri kru pemegang kapabilitas `loans.checkout`) dapat mengirimkan request dengan memasukkan UUID identitas anggota lain pada parameter `p_actor_id`, sehingga memalsukan jejak audit (*audit trail spoofing*).
* **Mitigasi yang Diperlukan:** Abaikan parameter `p_actor_id` dari client atau validasi paksa di dalam PL/pgSQL:
  ```sql
  v_caller_identity := (SELECT identity_id FROM user_account WHERE auth_user_id = auth.uid());
  ```

### Risiko 3: Eksekusi Anonim Terhadap `rpc_get_next_inv_code` (*Low-Medium Risk*)
* **Mekanisme Risiko:** Klien anonim (`anon`) terbukti dapat memanggil fungsi ini dan memperoleh nomor urut inventaris berikutnya (`INV-001`). Fungsi ini memicu advisory transaction lock: `PERFORM pg_advisory_xact_lock(1001);`.
* **Dampak:** Pengguna luar dapat mengeksploitasi fungsi ini untuk enumerasi jumlah inventaris institusi, atau membanjiri panggilan (*lock contention attack*) yang berpotensi memperlambat transaksi checkout inventaris riil.
* **Mitigasi yang Diperlukan:** Cabut hak eksekusi `anon` secara tegas: `REVOKE EXECUTE ON FUNCTION rpc_get_next_inv_code FROM anon;`.

### Risiko 4: Keterbukaan Penuh Matriks Otorisasi ke Publik (*Information Disclosure / Low Risk*)
* **Mekanisme Risiko:** Tabel `profile_capabilities` (177 baris) dan `capability_registry` (53 baris) saat ini dapat dibaca oleh publik tanpa login.
* **Dampak:** Penyerang dapat memetakan seluruh model hak akses internal, hierarki profil, dan kapabilitas sensitif sistem sebelum melakukan upaya penetrasi.
* **Mitigasi yang Diperlukan:** Batasi hak baca matriks otorisasi internal hanya untuk pengguna terotentikasi (`TO authenticated`), bukan publik umum (`anon`).

---

## 4. Matriks Hak Akses Minimum (*Least Privilege Matrix*)

Berdasarkan analisis alur aplikasi PTV PRO, berikut adalah batasan hak akses minimum yang seharusnya diterapkan:

| Objek Database | Pengguna Anonim (`anon`) | Pengguna Terotentikasi (`authenticated`) | Layanan Sistem (`service_role` / Root) | Rasional Desain |
| :--- | :--- | :--- | :--- | :--- |
| **`organization`** | **SELECT Only** | **SELECT Only** | ALL (CRUD) | Diperlukan oleh form login / registrasi untuk menampilkan pilihan lembaga. |
| **`organization_division`** | **SELECT Only** | **SELECT Only** | ALL (CRUD) | Diperlukan untuk formulir onboarding dan profil divisi publik. |
| **`access_profile`** | **DENY** | **SELECT Only** | ALL (CRUD) | Klien unauthenticated tidak perlu mengetahui struktur peran sistem. |
| **`capability_registry`** | **DENY** | **SELECT Only** | ALL (CRUD) | Kamus hak akses internal hanya relevan bagi sesi yang telah login. |
| **`profile_capabilities`** | **DENY** | **SELECT Only** | ALL (CRUD) | Matriks hak akses sistem hanya dibutuhkan oleh sesi terotentikasi. |
| **`ptv_keuangan` & Keuangan** | **DENY** | Terikat RLS (`finance.view`/`manage`) | ALL | Isolasi penuh dari publik, Crew biasa, dan Majelis Pembina. |
| **`ptv_nilai_inventaris`** | **DENY** | Terikat RLS (`inventory.valuation.*`) | ALL | Karantina ketat dari publik dan Majelis Pembina. |
| **`auth_credentials`** | **DENY** | **DENY** (`USING false`) | Service-Role Only | Kredensial dan hash kata sandi tidak boleh diakses oleh klien apa pun. |
| **`rpc_get_next_inv_code`** | **DENY** | **EXECUTE** | **EXECUTE** | Pembuatan nomor inventaris hanya boleh dilakukan oleh kru yang telah login. |
| **RPC Mutasi Transaksional** | **DENY** | **EXECUTE** (dengan guard kapabilitas) | **EXECUTE** | Hanya anggota berizin yang boleh mengeksekusi mutasi. |

---

## 5. Rekomendasi Terpisah (Untuk Ditinjau & Disetujui Nanti)

> [!IMPORTANT]
> **REKOMENDASI DI BAWAH INI HANYA UNTUK DITINJAU.**  
> Sesuai instruksi batasan, tidak ada satu pun dari rekomendasi berikut yang telah atau akan dijalankan tanpa persetujuan eksplisit dari operator.

### Paket Rekomendasi 1: Penegasan RLS Ketat pada Tabel Referensi
Pastikan RLS aktif dan hanya memberikan izin `SELECT` eksplisit:
```sql
-- 1. Pastikan RLS aktif
ALTER TABLE public.organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_division ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_capabilities ENABLE ROW LEVEL SECURITY;

-- 2. Kebijakan publik (hanya organization & division)
DROP POLICY IF EXISTS allow_read_organization ON public.organization;
CREATE POLICY allow_read_organization ON public.organization 
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS allow_read_division ON public.organization_division;
CREATE POLICY allow_read_division ON public.organization_division 
    FOR SELECT TO anon, authenticated USING (true);

-- 3. Kebijakan profil & kapabilitas (hanya authenticated)
DROP POLICY IF EXISTS allow_read_access_profile ON public.access_profile;
CREATE POLICY allow_read_access_profile ON public.access_profile 
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS allow_read_capability_registry ON public.capability_registry;
CREATE POLICY allow_read_capability_registry ON public.capability_registry 
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS allow_read_profile_capabilities ON public.profile_capabilities;
CREATE POLICY allow_read_profile_capabilities ON public.profile_capabilities 
    FOR SELECT TO authenticated USING (true);
```

### Paket Rekomendasi 2: Pencegahan Identity Spoofing pada RPC Mutasi
Perbarui fungsi `rpc_checkout_loan` dan `rpc_submit_official_doc` agar mengambil identitas aktor langsung dari sesi terotentikasi, bukan mempercayai parameter input:
```sql
-- Contoh hardening pada rpc_checkout_loan:
-- Gantikan penggunaan parameter p_actor_id langsung dengan resolusi sesi:
SELECT ua.identity_id INTO v_verified_actor_id
FROM public.user_account ua
WHERE ua.auth_user_id = auth.uid();

IF v_verified_actor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Valid authenticated user account required';
END IF;
```

### Paket Rekomendasi 3: Pencabutan Hak Eksekusi Anonim pada RPC Utilitas
```sql
REVOKE EXECUTE ON FUNCTION public.rpc_get_next_inv_code() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_next_inv_code() TO authenticated, service_role;
```

---

## 6. Daftar Hal yang Belum Dapat Diverifikasi (*Unverified Items*)

Karena audit ini dilakukan secara eksternal melalui protokol REST client tanpa privilege superuser langsung ke katalog sistem, aspek-aspek berikut **belum dapat dipastikan 100%**:

1. **Status Riil `rowsecurity` dan Daftar Kebijakan di `pg_policies`:**
   Apakah keberhasilan pembacaan data saat ini disebabkan oleh penambahan `CREATE POLICY ... FOR SELECT` atau eksekusi `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` di Supabase SQL Editor tidak dapat dibedakan semata-mata dari respons HTTP GET PostgREST. Hal ini memerlukan verifikasi kueri internal di SQL Editor.
2. **Konfigurasi `ALTER DEFAULT PRIVILEGES` di Supabase Instance:**
   Apakah Supabase Staging memiliki aturan bawaan yang secara otomatis memberikan hak `EXECUTE` pada fungsi baru di skema `public` kepada peran `anon`.
3. **Konfigurasi Auth Hook dan Custom JWT Secret:**
   Implementasi aktual hook kustom Supabase GoTrue untuk memanggil `public.jwt_custom_claims()` saat penerbitan token sesi belum dapat diuji tanpa alur login pengguna riil.
4. **Trigger Otomatis di Supabase Dashboard:**
   Apakah ada extension atau trigger dashboard tambahan (seperti Supabase Realtime atau Supabase Vault) yang aktif di luar skrip DDL resmi.
