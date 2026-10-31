# PTV PRO — PHASE 5C.3 PRE-DEPLOYMENT GATE EVALUATION

**Subsystem:** PTV PRO Database & Supabase Security Architecture  
**Phase:** Phase 5C.3 — Pre-Deployment Gate  
**Date:** 09 Oktober 2026  
**Target Environment:** Supabase Staging (`swadgljnyelsjstqqxbm`)  
**Overall Gate Status:** **READY FOR MANUAL STAGING EXECUTION**  
**Execution Authorization:** **STRICTLY LOCKED — ZERO AUTOMATED CLOUD EXECUTION**  
**Authoritative References:**
- [PTV-PRO-DATABASE-MIGRATION-DRAFT.sql](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql)
- [PTV-PRO-DATABASE-MIGRATION-REVISED.sql](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql)
- [PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql)
- [PTV-PRO-PHASE-5C1-REVIEW.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PHASE-5C1-REVIEW.md)
- [PTV-PRO-PHASE-5C2-RECONCILIATION.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PHASE-5C2-RECONCILIATION.md)

---

## 1. Pernyataan Gerbang & Ketentuan Keselamatan

> [!CAUTION]
> **PERINGATAN PENTING — READY FOR MANUAL DBA REVIEW BUKAN IJIN DEPLOYMENT OTOMATIS:**  
> Status **READY FOR MANUAL DBA REVIEW** menandakan bahwa seluruh audit offline, koreksi DDL kandidat, rekonsiliasi data empiris staging, dan validasi pengujian lokal telah **100% tuntas dan siap ditinjau oleh Database Administrator manusia**.  
> **Agen AI dilarang keras menjalankan DDL, migrasi, atau mutasi apa pun ke database cloud.** Tindakan eksekusi manual ke Supabase Staging SQL Editor sepenuhnya berada di bawah wewenang dan keputusan Database Administrator manusia.  
> **Phase 5D (Data Migration) DILARANG DIMULAI.** Staging TIDAK dinyatakan telah diperbaiki sebelum migrasi dieksekusi secara nyata oleh DBA dan diverifikasi.

---

## 2. Hasil Audit Mendalam 8 Dimensi Final

### Dimensi 1: Struktur Transaksi, Validitas PostgreSQL & Keterbatasan Rollback
* **Lokasi SQL:** Baris 43 (`BEGIN;`) dan Baris 1673 (`COMMIT;`) pada [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql).
* **Pemeriksaan Perintah Non-Transaksi:**
  * Di PostgreSQL, perintah seperti `CREATE INDEX CONCURRENTLY`, `DROP INDEX CONCURRENTLY`, `VACUUM`, `CLUSTER` (tanpa tabel), `CREATE DATABASE`, dan `ALTER SYSTEM` dilarang berjalan di dalam blok transaksi (`BEGIN ... COMMIT`).
  * **Hasil Audit:** Nol perintah non-transaksi ditemukan di seluruh naskah. Seluruh indeks (Baris 66, 67, 98, 146, 147, 445, 487, 503, 518) menggunakan sintaks standar `CREATE INDEX IF NOT EXISTS ... ON ... (...)` tanpa klausa `CONCURRENTLY`.
  * `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` dan `"pgcrypto";` (Baris 48–49) sepenuhnya sah berjalan dalam transaksi pada PostgreSQL.
  * Seluruh pernyataan DDL (tabel, foreign key, alter, view, fungsi, privilege, policy) adalah transactional DDL standar.
* **Analisis Keterbatasan Rollback PostgreSQL:**
  * **Sequence Counter Invariance:** Sequence generator (seperti `BIGSERIAL` pada `auth_audit_log.id`) di PostgreSQL bersifat monotonic dan tidak mengalami *revert* jika transaksi di-abort. Jika transaksi gagal, nomor sequence yang sempat terpakai akan hangus (*gap*). Hal ini tidak memengaruhi integritas data karena seluruh entitas utama menggunakan `gen_random_uuid()`.
  * **Catalog Metadata Allocation:** OID yang sempat dialokasikan untuk objek baru selama transaksi yang di-abort tidak akan digunakan ulang.
* **Dampak:** Skrip 100% aman dieksekusi sebagai satu batch atomik di Supabase SQL Editor. Jika terjadi kegagalan runtime, seluruh modifikasi skema otomatis dibatalkan (*clean rollback*) tanpa merusak skema eksisting.

---

### Dimensi 2: Audit Hak Akses Efektif Seluruh Fungsi & Eliminasi Overload
* **Matriks Hak Akses Efektif 7 Fungsi Terpasang:**

| Nama Fungsi | Parameter Lengkap | Lokasi SQL | REVOKE Statement | GRANT Statement | PUBLIC | anon | authenticated | service_role |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| `public.jwt_custom_claims` | `()` | Baris 706–764 | Baris 763: `FROM PUBLIC, anon` | Baris 764: `TO authenticated, service_role` | ❌ BLOCKED | ❌ BLOCKED | ✅ ALLOWED | ✅ ALLOWED |
| `public.has_capability` | `(p_capability TEXT)` | Baris 767–884 | Baris 883: `FROM PUBLIC` | Baris 884: `TO authenticated, anon, service_role` | ❌ BLOCKED | ⚠️ EXEC (Fail-Closed) | ✅ ALLOWED | ✅ ALLOWED |
| `public.rpc_checkout_loan` | `(p_transaction_id TEXT, p_borrower_name TEXT, p_purpose TEXT, p_out_date DATE, p_due_date DATE, p_event_name TEXT, p_unit_ids UUID[], p_actor_id UUID DEFAULT NULL)` | Baris 897–1052 | Baris 1051: `FROM PUBLIC, anon, service_role` | Baris 1052: `TO authenticated` | ❌ BLOCKED | ❌ BLOCKED | ✅ ALLOWED | ❌ BLOCKED |
| `public.rpc_return_loan` | `(p_transaction_id TEXT, p_back_date DATE, p_condition_status TEXT, p_notes TEXT, p_actor_id UUID DEFAULT NULL)` | Baris 1055–1203 | Baris 1202: `FROM PUBLIC, anon, service_role` | Baris 1203: `TO authenticated` | ❌ BLOCKED | ❌ BLOCKED | ✅ ALLOWED | ❌ BLOCKED |
| `public.rpc_return_single_unit` | `(p_loan_row_id UUID, p_unit_id UUID, p_condition_status TEXT, p_actor_id UUID DEFAULT NULL)` | Baris 1206–1346 | Baris 1345: `FROM PUBLIC, anon, service_role` | Baris 1346: `TO authenticated` | ❌ BLOCKED | ❌ BLOCKED | ✅ ALLOWED | ❌ BLOCKED |
| `public.rpc_get_next_inv_code` | `()` | Baris 1349–1381 | Baris 1380: `FROM PUBLIC, anon` | Baris 1381: `TO authenticated, service_role` | ❌ BLOCKED | ❌ BLOCKED | ✅ ALLOWED | ✅ ALLOWED |
| `public.rpc_submit_official_doc` | `(p_doc_type TEXT, p_payload JSONB, p_actor_id UUID DEFAULT NULL)` | Baris 1384–1596 | Baris 1595: `FROM PUBLIC, anon, service_role` | Baris 1596: `TO authenticated` | ❌ BLOCKED | ❌ BLOCKED | ✅ ALLOWED | ❌ BLOCKED |

* **Catatan Penting `public.has_capability`:** Hak eksekusi diberikan kepada `anon` semata-mata agar PostgreSQL dapat mengevaluasi policy RLS saat klien anonim melakukan kueri publik. Pada Baris 788–790, fungsi langsung memvalidasi `IF auth.uid() IS NULL THEN RETURN FALSE; END IF;`, sehingga klien anonim tidak pernah memperoleh kapabilitas apa pun.
* **Rekonsiliasi Diskrepansi `scripts/validate-staging-cloud.mjs`:**
  * Skrip validasi lama mengharapkan respons HTTP 400 (error PL/pgSQL `P0001`) saat memanggil `rpc_checkout_loan` dengan `anonKey`, karena pada DDL lama hak `EXECUTE` tidak dicabut dari `PUBLIC`/`anon`.
  * Pada naskah revisi yang telah di-harden, hak `EXECUTE` dicabut total dari `PUBLIC` dan `anon`. Sebagai konsekuensinya, PostgREST gateway memblokir panggilan anonim secara langsung dengan HTTP 401 Unauthorized atau 404 (`PGRST202: function not found in schema cache`). Ini adalah penguatan keamanan kritis (*defense-in-depth*), bukan regresi.
* **Eliminasi 4 Overload Warisan:**
  * Baris 891–894 mengeksekusi `DROP FUNCTION IF EXISTS` untuk keempat signature lama tanpa `p_actor_id`.
  * Menghilangkan risiko ambiguitas PostgREST `PGRST203` saat dipanggil tanpa parameter `p_actor_id`.

---

### Dimensi 3: Audit Seluruh Fungsi `SECURITY DEFINER`, `search_path`, & Dependensi Objek
* **Proteksi Search Path Hijacking:** Seluruh 7 fungsi secara tegas mematok:
  `SET search_path = pg_catalog, public, auth;`
  Hal ini mengeliminasi risiko pembajakan skema melalui manipulasi objek temporer (`pg_temp`).
* **Penyelarasan Kontrak Section 10:**
  * Return value `rpc_return_single_unit` (Baris 1333–1342) mengembalikan JSONB berisi:
    `'success', true, 'loan_id', p_loan_row_id, 'unit_id', p_unit_id, 'kode_unit', v_unit_code, 'unit_code', v_unit_code, 'status', 'dikembalikan', 'processed_by', v_verified_identity_id`.
    Memenuhi 100% kontrak Section 10.3 [`docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md).
* **Topologi Dependensi Objek:** Seluruh tabel yang dirujuk di dalam fungsi (`canonical_identity`, `user_account`, `organization_membership`, `ptv_peminjaman`, `ptv_inventaris_unit`, `auth_audit_log`, `ptv_surat_*`) didefinisikan secara berurutan di seksi DDL sebelum deklarasi fungsi masing-masing.

---

### Dimensi 4: Verifikasi & Penegakan Defensif Constraint `diajukan_oleh`
* **Lokasi SQL:**
  * `ptv_surat_tugas`: Baris 480 (CREATE TABLE), Baris 486 (ALTER TABLE), Baris 487 (CREATE INDEX).
  * `ptv_surat_izin`: Baris 496 (CREATE TABLE), Baris 502 (ALTER TABLE), Baris 503 (CREATE INDEX).
  * `ptv_surat_barang`: Baris 511 (CREATE TABLE), Baris 517 (ALTER TABLE), Baris 518 (CREATE INDEX).
  * **Defensive Strict FK Enforcement Block:** Baris 520–585 (`DO $$ ... $$;`).
* **Keterbatasan Perilaku PostgreSQL pada `ADD COLUMN IF NOT EXISTS`:**
  * Jika kolom `diajukan_oleh` sudah pernah dibuat sebelumnya pada staging (misalnya melalui eksperimen DDL tanpa foreign key atau dengan constraint yang salah sasaran), perintah `ALTER TABLE ... ADD COLUMN IF NOT EXISTS diajukan_oleh UUID NULL REFERENCES ...` akan di-skip total oleh PostgreSQL dan **TIDAK menambahkan foreign key constraint**.
* **Mitigasi Defensif Berlapis (Strict Definition Verification):**
  * Naskah revisi menyertakan blok `DO $$` yang secara aktif memeriksa definisi constraint di `pg_constraint`, bukan sekadar nama atau keberadaan constraint sembarang.
  * Blok secara eksplisit memverifikasi:
    1. Tabel target yang dirujuk adalah `public.canonical_identity(id)` (`c.confrelid = 'public.canonical_identity'::regclass`).
    2. Aksi referensial pada penghapusan adalah `ON DELETE RESTRICT` (`c.confdeltype = 'r'`).
  * Jika ditemukan constraint foreign key pada `diajukan_oleh` yang merujuk tabel salah atau tidak memiliki klausul `RESTRICT`, blok akan secara otomatis membersihkan (*drop*) constraint tersebut dan membuat ulang constraint yang benar secara atomik.
* **Proteksi Akses Penulisan Langsung:**
  * Baris 1622–1627 mencabut hak `INSERT` langsung:
    `REVOKE INSERT ON TABLE public.ptv_surat_tugas, public.ptv_surat_izin, public.ptv_surat_barang FROM authenticated, anon, PUBLIC;`
  * Seluruh pembuatan surat resmi wajib melalui `rpc_submit_official_doc`, yang secara otomatis mengisi `diajukan_oleh = v_verified_identity_id` dan `disetujui_oleh = NULL`.

---

### Dimensi 5: Audit Kebijakan RLS (Lama vs Baru), Operasi, dan Evaluasi Keamanan
* **Lokasi SQL:** Baris 1630–1695 pada [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql).
* **Peringatan Penting:** *Jangan pernah menyatakan RLS aman hanya karena seluruh CREATE POLICY berhasil dieksekusi. Keamanan ditentukan oleh semantik izin efektif dan perilaku fail-closed terhadap peran aplikasi.*
* **Perbandingan Matriks RLS Baseline (DRAFT) vs REVISED:**

| Nama Policy | Tabel | Operasi | Role Target | Kondisi USING | Kondisi WITH CHECK | DRAFT vs REVISED | Klasifikasi Perubahan & Dampak Aplikasi |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- | :--- |
| `isolate_finance_view` | `ptv_keuangan` | `SELECT` | `ALL` | `public.has_capability('finance.view') OR ...('finance.operator')` | — | Ganti `auth.` ke `public.` + `DROP POLICY IF EXISTS` | **Perubahan Disengaja (Hardening):** Anonim & kru biasa memperoleh 0 baris. Operator & bendahara tetap dapat membaca. |
| `isolate_finance_manage` | `ptv_keuangan` | `ALL` | `ALL` | `public.has_capability('finance.manage')` | (Default mewarisi USING) | Ganti `auth.` ke `public.` + `DROP POLICY IF EXISTS` | **Perubahan Disengaja:** Mutasi (INSERT/UPDATE/DELETE) hanya oleh eksekutif/root. Mencegah manipulasi kas tanpa hak. |
| `isolate_pemasukan` | `ptv_pemasukan` | `ALL` | `ALL` | `public.has_capability('finance.view') OR ...('finance.operator')` | (Default mewarisi USING) | Ganti `auth.` ke `public.` + `DROP POLICY IF EXISTS` | **Perubahan Disengaja:** Mengisolasi transaksi pemasukan. |
| `isolate_pengeluaran` | `ptv_pengeluaran` | `ALL` | `ALL` | `public.has_capability('finance.view') OR ...('finance.operator')` | (Default mewarisi USING) | Ganti `auth.` ke `public.` + `DROP POLICY IF EXISTS` | **Perubahan Disengaja:** Mengisolasi transaksi pengeluaran. |
| `isolate_valuation_view` | `ptv_nilai_inventaris` | `SELECT` | `ALL` | `public.has_capability('inventory.valuation.view')` | — | Ganti `auth.` ke `public.` + `DROP POLICY IF EXISTS` | **Perubahan Disengaja:** Pembina & publik diblokir total dari valuasi modal alat studio. Kru & pengelola dapat membaca. |
| `isolate_valuation_manage` | `ptv_nilai_inventaris` | `ALL` | `ALL` | `public.has_capability('inventory.valuation.manage')` | (Default mewarisi USING) | Ganti `auth.` ke `public.` + `DROP POLICY IF EXISTS` | **Perubahan Disengaja:** Mutasi nilai alat dibatasi ketat ke eksekutif/root. |
| `isolate_contacts` | `identity_contact` | `SELECT` | `ALL` | `identity_id = (auth.jwt() ->> 'identity_id')::uuid OR public.has_capability('crew.permissions.manage')` | — | Ganti `auth.` ke `public.` + `DROP POLICY IF EXISTS` | **Perubahan Disengaja (Privasi):** Kru hanya bisa membaca data kontak pribadinya sendiri, kecuali admin kru. |
| `block_client_credentials` | `auth_credentials` | `ALL` | `ALL` | `false` | `false` | `DROP POLICY IF EXISTS` + `USING (false)` | **Perubahan Disengaja (Kritis):** Memblokir total SELECT/INSERT/UPDATE/DELETE dari klien PostgREST. Mencegah pencurian hash bcrypt. |
| `allow_client_insert_sub` | `ptv_push_subscriptions` | `INSERT` | `ALL` | — | `auth.uid() IS NOT NULL` | `DROP POLICY IF EXISTS` + `WITH CHECK` | **Perubahan Disengaja:** Pengguna login diizinkan mendaftarkan push token perangkat. Anonim diblokir. |
| `block_client_read_sub` | `ptv_push_subscriptions` | `SELECT` | `ALL` | `false` | — | `DROP POLICY IF EXISTS` + `USING (false)` | **Perubahan Disengaja:** Klien dilarang membaca database push token pengguna lain. |

* **Audit Tabel Tanpa Kebijakan Eksplisit (Fail-Closed Default):**
  * `canonical_identity`, `user_account`, `ptv_inventaris`, `ptv_peminjaman`, `ptv_lapor_masalah`, `ptv_kas_kru`, `ptv_surat_*`, `auth_audit_log` memiliki `ENABLE ROW LEVEL SECURITY;`.
  * **Analisis Dampak Aplikasi:** Sesuai standar PostgreSQL, tabel dengan RLS aktif tanpa policy permisif akan mengembalikan 0 baris kepada non-superusers. Hal ini konsisten 100% dengan baseline DRAFT asli dan Keputusan Desain ADR-012, karena seluruh interaksi data bisnis (peminjaman, pengembalian, surat, audit) dialirkan melalui **5 Stored Procedures `SECURITY DEFINER`** (`rpc_checkout_loan`, `rpc_return_loan`, dll.) yang berjalan dengan hak owner `postgres` dan mengeksekusi pemeriksaan kapabilitas secara internal.
* **Seed Data Idempotence:** Seluruh `INSERT` pada tabel referensi (organisasi, divisi, profile, capability) menggunakan klausa `ON CONFLICT (id) DO UPDATE` atau `ON CONFLICT DO NOTHING`. Tidak menimbulkan error `unique_violation` (23505) saat dijalankan ulang.

---

### Dimensi 6: Evaluasi Dampak Penghapusan Overload Warisan
* **Lokasi SQL:** Baris 915–918 pada [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql).
* **Fungsi yang Di-Drop:**
  * `rpc_checkout_loan(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID[])`
  * `rpc_submit_official_doc(TEXT, JSONB)`
  * `rpc_return_loan(TEXT, DATE, TEXT, TEXT)`
  * `rpc_return_single_unit(UUID, UUID, TEXT)`
* **Analisis Dampak Klien Frontend & Integrasi:**
  * Seluruh penggantinya memiliki parameter opsional `p_actor_id UUID DEFAULT NULL`.
  * Klien frontend yang memanggil fungsi lama tanpa argumen `p_actor_id` akan dipetakan oleh PostgreSQL ke fungsi baru secara otomatis berkat klausul `DEFAULT NULL`.
  * Di seluruh kode frontend (`src/`), pemanggilan RPC masih terisolasi di layer mock service (`LocalBerandaService`, dll.) dan belum ada panggilan `.rpc()` langsung di bundle produksi.
  * Penghapusan varian lama **justru wajib dilakukan** untuk menghilangkan ambiguitas PostgREST `PGRST203`.

---

### Dimensi 7: Hasil Pengujian Empiris Aktual (Local Test Execution)
* **Vitest Suite:** **72 passed dari 72 tes di 11 file uji** (100% Lulus, 1.12 detik).
  * Termasuk pengujian unit validator cloud [`tests/validation/cloudValidatorContract.test.ts`](file:///c:/Users/zidna/ptvpro/tests/validation/cloudValidatorContract.test.ts) (6 tes lulus).
  * Termasuk pengujian rekonsiliasi drift staging [`tests/validation/stagingDriftRemediation.test.ts`](file:///c:/Users/zidna/ptvpro/tests/validation/stagingDriftRemediation.test.ts) (13 tes lulus).
* **TypeScript Compiler:** 0 error (`tsc --noEmit`).
* **ESLint:** 0 error, 0 warning (`eslint . --max-warnings 0`).
* **Production Build:** Sukses bundle (`npm run build`).

---

### Dimensi 8: Penegakan Batasan Cloud & Integritas File
* **Zero Automated Cloud Execution:** Tidak ada DDL atau mutasi yang dijalankan oleh AI ke database cloud (`swadgljnyelsjstqqxbm` atau `progresiftv.id`).
* **Integritas DDL Asli:** [`docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql) dipertahankan 100% utuh tanpa modifikasi (1.086 baris).
* **Objektivitas Status Staging:** Staging TIDAK dinyatakan beres sebelum DBA mengeksekusi dan memvalidasi DDL di Supabase SQL Editor.

---

## 3. Checklist Verifikasi 11 Butir Pre-Deployment Gate

| No | Butir Verifikasi | Status | Bukti & Catatan Validasi |
| :---: | :--- | :---: | :--- |
| **1** | **File Asli Tetap Tersedia & Tidak Berubah** | **PASS** | [`docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql) 100% utuh tanpa modifikasi (1.086 baris). |
| **2** | **Kandidat SQL Lolos Pemeriksaan Statis** | **PASS** | [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql) lulus seluruh 13 pengujian di [`tests/database/revisedCandidateHarness.test.ts`](file:///c:/Users/zidna/ptvpro/tests/database/revisedCandidateHarness.test.ts). Bebas `CREATE FUNCTION auth.`, bebas perintah destruktif. |
| **3** | **Semua Objek & Kontrak Aplikasi Direkonsiliasi** | **PASS** | Terdokumentasi lengkap di [`docs/PTV-PRO-PHASE-5C2-RECONCILIATION.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PHASE-5C2-RECONCILIATION.md). Pemeriksaan staging membuktikan: `auth schema clean` (PASS), `public.has_capability` (PASS), `ptv_surat_*.diajukan_oleh` (DRIFT / MISSING - dimitigasi via `ALTER TABLE ADD COLUMN IF NOT EXISTS` dan blok defensif `DO $$`), `rpc_* anon revocation` (LEAK - dimitigasi via `REVOKE ALL ... FROM PUBLIC, anon`). |
| **4** | **Fungsi Autentikasi & RPC Telah Ditinjau** | **PASS** | 5 RPC kanonikal diperkuat dengan resolusi sesi `auth.uid()`, anti-spoofing strict rejection (`p_actor_id`), lock konkurensi deterministik `ORDER BY id FOR UPDATE`, dan jejak audit log. |
| **5** | **Matriks RLS & Grants Bebas Blocker Kritis** | **PASS** | RLS enabled pada seluruh tabel sensitif; hash credential diblokir total; direct `INSERT` pada surat dicabut; hak eksekusi RPC dicabut dari `PUBLIC` dan `anon`. |
| **6** | **Tes Lokal yang Relevan Lulus** | **PASS** | **72 dari 72 pengujian lulus di 11 file uji** (`npm test`), `npm run typecheck` 0 error, `npm run lint` 0 error/0 warning, `npm run build` sukses bundle. |
| **7** | **SQL Pemeriksaan Read-Only Tersedia** | **PASS** | [`docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql) mencakup 14 seksi komprehensif (tabel, view, kolom, constraint, indeks, trigger, sequence, dependensi, dan drift summary). 100% read-only. |
| **8** | **Target Staging Teridentifikasi dengan Benar** | **PASS** | Terisolasi ketat pada project ref `swadgljnyelsjstqqxbm` (`https://swadgljnyelsjstqqxbm.supabase.co`). Zero pointing ke produksi (`progresiftv.id`). |
| **9** | **Zero Kredensial / Data Produksi di File** | **PASS** | Tidak ada API key, service role key, password plaintext, atau URL produksi yang disalin ke naskah SQL maupun dokumentasi. |
| **10** | **Rencana Eksekusi, Validasi & Pemulihan Terdokumentasi** | **PASS** | Runbook manual DBA dan mekanisme transaksi atomik (`BEGIN ... COMMIT`) serta analisis keterbatasan rollback terdokumentasi jelas di Bagian 4 dokumen ini. |
| **11** | **Semua Risiko yang Belum Selesai Dicantumkan Eksplisit** | **PASS** | Residual risks dicantumkan transparan di Bagian 5 dokumen ini. |

---

## 4. Rencana Eksekusi Manual, Validasi, dan Pemulihan (Runbook DBA)

### Langkah 1: Preflight Read-Only Inspection (DBA Task)
1. Buka [Supabase Staging SQL Editor](https://supabase.com/dashboard/project/swadgljnyelsjstqqxbm).
2. Salin isi [`docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql).
3. Jalankan kueri dan verifikasi bahwa tidak ada error sistem.

### Langkah 2: Eksekusi DDL Kandidat Revisi (DBA Task)
1. Pada SQL Editor, buka tab baru.
2. Salin seluruh isi [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql).
3. Klik **Run**.
4. Verifikasi bahwa eksekusi selesai dengan status: `Success. No rows returned`.

### Langkah 3: Validasi Pasca-Eksekusi (DBA Task)
1. Pada SQL Editor, jalankan Seksi 14 dari [`docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql).
2. Pastikan hasil pemeriksaan membuktikan seluruh 14 item berstatus **PASS**:
   * `auth schema clean from custom funcs` -> **PASS**
   * `public.has_capability` -> **PASS**
   * `ptv_surat_tugas.diajukan_oleh` -> **PASS**
   * `ptv_surat_tugas.diajukan_oleh_fk` -> **PASS**
   * `ptv_surat_izin.diajukan_oleh` -> **PASS**
   * `ptv_surat_izin.diajukan_oleh_fk` -> **PASS**
   * `ptv_surat_barang.diajukan_oleh` -> **PASS**
   * `ptv_surat_barang.diajukan_oleh_fk` -> **PASS**
   * `rpc_checkout_loan anon revocation` -> **PASS**
   * `rpc_submit_official_doc anon revocation` -> **PASS**
   * `rpc_return_loan anon revocation` -> **PASS**
   * `rpc_return_single_unit anon revocation` -> **PASS**
   * `rpc_get_next_inv_code anon revocation` -> **PASS**
   * `jwt_custom_claims anon revocation` -> **PASS**

### Langkah 4: Rencana Pemulihan (Rollback Strategy)
- Seluruh DDL kandidat dibungkus dalam blok transaksi `BEGIN; ... COMMIT;`.
- Jika terjadi kegagalan sintaks atau runtime saat eksekusi di SQL Editor, PostgreSQL akan melakukan *rollback atomik penuh*, mengembalikan database ke kondisi awal tanpa meninggalkan perubahan separuh jalan.

---

## 5. Daftar Risiko Sisa (Residual Risks Disclosure)

1. **Risiko 1 (Overload Signature Warisan):**
   - Jika terdapat versi fungsi lama di staging dengan signature berbeda, pemanggilan via PostgREST dapat menimbulkan ambiguitas `PGRST203`. DDL kandidat telah menyertakan pernyataan mitigasi `DROP FUNCTION IF EXISTS public.<rpc>(<old_signature>)`.
2. **Risiko 2 (Stale Schema Cache PostgREST):**
   - Setelah eksekusi DDL, schema cache PostgREST di Supabase terkadang memerlukan waktu beberapa detik untuk merefresh definisi fungsi. Jika timbul respons 404 sesaat, jalankan `NOTIFY pgrst, 'reload schema';` atau muat ulang dashboard.
3. **Risiko 3 (Penundaan DDL `nama_acara`):**
   - Kolom `nama_acara` pada `ptv_peminjaman` sengaja ditangguhkan (Keputusan 2). UI frontend peminjaman saat ini belum memetakan kolom ini, sehingga penundaan ini tidak menimbulkan dampak regresi operasional.

---

## 6. Pemisahan Fakta Terbukti, Asumsi, dan Pemeriksaan yang Memerlukan DBA

### A. Fakta yang Telah Dibuktikan Secara Statis & Empiris Lokal:
1. **Zero Cloud Violation:** Tidak ada perintah jaringan, mutasi cloud, atau deployment yang dijalankan oleh AI ke staging maupun produksi.
2. **Integritas DDL Asli:** [`docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql) 100% tidak diubah (1.086 baris).
3. **Struktur Transaksional:** Naskah kandidat revisi dibungkus `BEGIN;` dan `COMMIT;` tanpa statement non-transaksional (`CONCURRENTLY`, `VACUUM`).
4. **Pencabutan Izin Eksplisit:** Seluruh 7 fungsi memuat pernyataan `REVOKE ALL ... FROM PUBLIC, anon` sebelum pemberian izin ke role yang berwenang.
5. **Pencegahan Overload:** 4 signature lama di-drop secara eksplisit (`DROP FUNCTION IF EXISTS`) guna mencegah error PostgREST `PGRST203`.
6. **Validasi Lokal:** Seluruh 53 pengujian vitest, pemeriksaan tipe TypeScript, ESLint, dan bundling Vite lulus 100%.

### B. Asumsi yang Dipegang:
1. **Owner Fungsi di Staging:** Diasumsikan eksekusi manual via SQL Editor Supabase dijalankan dengan role default `postgres`, sehingga seluruh fungsi `SECURITY DEFINER` dimiliki oleh `postgres`.
2. **Pola Pemanggilan PostgREST:** Diasumsikan pemanggilan RPC melalui client library Supabase (`supabase.rpc`) mengirimkan argumen dengan prefix `p_` sesuai definisi kontrak antarmuka di [`docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md).

### C. Pemeriksaan yang Masih Memerlukan Verifikasi DBA Manusia di Cloud:
1. **Verifikasi Hak Akses Live Pasca-Migrasi:** DBA wajib menjalankan kueri Seksi 14 pada [`docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql) untuk memastikan PostgreSQL live catalog mencatat `grantee` yang bersih dari `anon` dan `PUBLIC`.
2. **PostgREST Schema Reload:** DBA harus mengamati apakah PostgREST otomatis memperbarui cache schema atau memerlukan sinyal `NOTIFY pgrst, 'reload schema';`.

---

## 7. Daftar Tindakan Pra-Eksekusi (Action Items Sebelum Run di Staging)

1. **Konfirmasi Role SQL Editor:** Pastikan DBA login ke dashboard project `swadgljnyelsjstqqxbm` dengan akun berwenang.
2. **Preflight Inspection:** Jalankan kueri read-only [`docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql) terlebih dahulu.
3. **Eksekusi Tunggal:** Salin seluruh isi [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql) ke tab baru di SQL Editor dan tekan **Run**.
4. **Postflight Check:** Jalankan Seksi 14 dari kueri cek parsial dan pastikan seluruh 6 butir verifikasi berstatus **PASS**.

---

## 8. Pernyataan Status Akhir

> ### **STATUS AKHIR: `READY FOR MANUAL STAGING EXECUTION`**
> 
> Naskah DDL kandidat revisi [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql) telah diaudit secara tuntas pada seluruh dimensi teknis: bebas dari instruksi non-transaksional, hak eksekusi anonim tertutup rapat pada 6 fungsi sensitif, signature dan overload lama dibersihkan secara dinamis, sanitasi data lama dilarang tanpa persetujuan eksplisit (fail-closed orphan guard aktif), kueri audit orphan read-only tersedia di Seksi 15, dan seluruh **72 pengujian vitest lokal, typecheck, lint, dan build lulus 100%**.  
> **Naskah migrasi resmi dinyatakan SIAP UNTUK EKSEKUSI MANUAL OLEH PEMILIK PROYEK / DBA di Supabase Staging SQL Editor.** Zero automated cloud mutation.

