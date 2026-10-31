# PTV PRO — PHASE 5C.1 SAFE DDL CORRECTION & RPC HARDENING REVIEW

**Subsystem:** PTV PRO Database & Supabase Security Architecture  
**Phase:** Phase 5C.1 — Safe DDL Correction, RPC Identity Hardening & Security Audit  
**Date:** 09 Oktober 2026  
**Target Environment:** Supabase Staging (`swadgljnyelsjstqqxbm`)  
**Status:** **AUDIT LOKAL SELESAI — KANDIDAT DDL TERUJI (READY FOR USER REVIEW)**  
**Authoritative References:**
- [PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md)
- [PTV-PRO-PROJECT-ARCHITECTURE.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PROJECT-ARCHITECTURE.md)
- [PTV-PRO-IDENTITY-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-IDENTITY-AUTH-CONTRACT.md)
- [PTV-PRO-AUTH-SCHEMA-PERMISSION-AUDIT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-AUTH-SCHEMA-PERMISSION-AUDIT.md)
- [PTV-PRO-RPC-IDENTITY-HARDENING-DECISIONS.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-DECISIONS.md)
- [PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md)

---

## 1. Ringkasan Eksekutif & Batasan Keselamatan

Dokumen ini menyajikan hasil audit teknis mendalam terhadap skema database PTV PRO, membandingkan naskah DDL asli ([`docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql)) dengan naskah kandidat revisi ([`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql)).

> [!IMPORTANT]
> **ATURAN KESELAMATAN MUTLAK:**
> 1. File DDL asli [`docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql) **100% dipertahankan tanpa perubahan**.
> 2. Seluruh koreksi keamanan diimplementasikan pada file kandidat terpisah: [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql).
> 3. Semua pekerjaan dilakukan secara lokal dan offline; tidak ada perintah DDL, DML, migrasi, atau mutasi apa pun yang dieksekusi terhadap Supabase Cloud atau database produksi.

---

## 2. Audit Mendalam Berdasarkan Dimensi Evaluasi

### A. Struktur Database & Konsistensi Kontrak
- **Cakupan Entitas:** Skema mendefinisikan tepat 36 tabel kanonikal skema `public`, 1 view kompatibilitas warisan (`public.ptv_kru_legacy_compat`), ekstensi `uuid-ossp` dan `pgcrypto`.
- **Primary & Foreign Keys:** Seluruh tabel menggunakan primary key berbasis UUID (`gen_random_uuid()`) atau kode teks kanonikal (`organization.id`, `organization_division.id`, `access_profile.id`, `capability_registry.key`). Relasi antar-tabel menerapkan foreign key dengan klausul integritas referensial eksplisit (`ON DELETE CASCADE` atau `ON DELETE RESTRICT`).
- **Pemisahan Pengaju dan Penyetuju Surat Resmi (Keputusan 1):**
  - **Temuan Celah:** Pada DDL asli, ketiga tabel surat (`ptv_surat_tugas`, `ptv_surat_izin`, `ptv_surat_barang`) hanya memiliki kolom `disetujui_oleh`. Saat fungsi `rpc_submit_official_doc` dijalankan, identitas pengaju (`p_actor_id`) langsung ditulis ke kolom `disetujui_oleh`, sehingga pemohon biasa tercatat seolah-olah telah menyetujui suratnya sendiri.
  - **Koreksi Kandidat:** Ditambahkan kolom terstruktur `diajukan_oleh UUID NULL REFERENCES public.canonical_identity(id) ON DELETE RESTRICT` beserta indeks `idx_ptv_surat_*_diajukan_oleh` pada ketiga tabel surat.
  - **Idempotensi Skema Eksisting:** Ditambahkan pernyataan kompensasi:
    ```sql
    ALTER TABLE public.ptv_surat_tugas ADD COLUMN IF NOT EXISTS diajukan_oleh UUID NULL REFERENCES public.canonical_identity(id) ON DELETE RESTRICT;
    ALTER TABLE public.ptv_surat_izin ADD COLUMN IF NOT EXISTS diajukan_oleh UUID NULL REFERENCES public.canonical_identity(id) ON DELETE RESTRICT;
    ALTER TABLE public.ptv_surat_barang ADD COLUMN IF NOT EXISTS diajukan_oleh UUID NULL REFERENCES public.canonical_identity(id) ON DELETE RESTRICT;
    ```
- **Penanganan Kolom `nama_acara` pada Checkout Peminjaman (Keputusan 2):**
  - Sesuai Keputusan Arsitektur 2: Usulan penambahan kolom `nama_acara VARCHAR(255) NULL` ke `ptv_peminjaman` telah disetujui secara konseptual (Opsi 2), namun implementasi DDL dan mutasinya **ditangguhkan (deferred)** ke jendela rilis berikutnya guna menghindari instabilitas kontrak tanpa pengujian staging live. Parameter `p_event_name TEXT` pada antarmuka RPC dipertahankan agar tidak memicu error PostgREST `PGRST202`.

### B. Autentikasi dan Kapabilitas
- **Akar Masalah Supabase Managed Schema Boundary (`ERROR: 42501`):**
  - Pada DDL asli (baris 627 dan 684), fungsi `jwt_custom_claims()` dan `has_capability(TEXT)` dideklarasikan di skema terkelola `auth`. Supabase secara default mencabut hak `CREATE` pada skema `auth` dari role `postgres`, memicu penolakan transaksi PostgreSQL `ERROR: 42501: permission denied for schema auth`.
  - **Koreksi:** Kedua fungsi dipindahkan ke skema aplikasi: `public.jwt_custom_claims()` dan `public.has_capability(TEXT)`.
  - **Bukan Supabase Auth Hook:** Fungsi `public.jwt_custom_claims()` memiliki signature `()` tanpa parameter dan mengembalikan representasi profil JSONB flat. Fungsi ini **bukan** custom access token hook GoTrue (yang membutuhkan signature `custom_access_token_hook(event jsonb)`). Mengonfigurasikan fungsi ini sebagai hook auth Supabase secara keliru akan memicu runtime argument mismatch.
- **Fail-Closed Evaluasi Tiga Nilai Logika (Three-Valued Logic / 3VL):**
  - Pada implementasi awal `has_capability`, evaluasi `IF v_status_akun != 'active'` mengalami celah karena jika `v_status_akun` bernilai `NULL`, ekspresi `NULL != 'active'` menghasilkan `NULL` (unknown), sehingga blok IF dilewati tanpa menolak akses.
  - **Koreksi:** Logika diperketat menjadi strictly fail-closed:
    ```sql
    IF v_status_akun IS NULL OR v_status_akun != 'active' THEN
        RETURN FALSE;
    END IF;
    IF (v_status_organisasi IS NULL OR v_status_organisasi = 'inactive') AND v_is_mutation IS TRUE THEN
        RETURN FALSE;
    END IF;
    ```
- **Pertahanan Stale JWT 72 Jam:**
  - Evaluasi kapabilitas sensitif dan mutasi memvalidasi langsung ke baris database live (`user_account` dan `organization_membership`) serta memverifikasi epoch `tokens_valid_after` terhadap timestamp penerbitan klaim JWT (`iat`).

### C. Keamanan RPC Stored Procedures
Audit dilakukan terhadap kelima RPC:
1. `public.rpc_checkout_loan`:
   - **Verifikasi Sesi:** Mengabaikan klaim identitas mentah dari klien dan menolak transaksi jika `auth.uid() IS NULL`.
   - **Anti-Spoofing Strict Rejection:** Jika parameter `p_actor_id` dikirim oleh klien dan nilainya tidak identik dengan `v_verified_identity_id` sesi terverifikasi, transaksi ditolak:
     `RAISE EXCEPTION 'FORBIDDEN: Actor spoofing detected...' USING ERRCODE = '42501';`
   - **Pencegahan Deadlock Concurrency:** Mengunci baris inventaris menggunakan `ORDER BY id FOR UPDATE` untuk mencegah deadlock saat beberapa klien meminjam unit yang sama secara bersamaan.
   - **Serialisasi Transaksi:** Menambahkan `PERFORM pg_advisory_xact_lock(hashtext(p_transaction_id));` untuk mencegah double-checkout basket.
2. `public.rpc_submit_official_doc`:
   - **Pemisahan Pengaju/Penyetuju:** Kolom `diajukan_oleh` diisi dengan `v_verified_identity_id`. Kolom `disetujui_oleh` diinisialisasi `NULL`. Status surat diinisialisasi `'diajukan'`.
   - **Penomoran Bebas Lubang & Aman >999:** Menggunakan advisory lock transaksi (1002 untuk tugas, 1003 untuk izin, 1004 untuk barang) dan formatting nomor yang mencegah pemotongan rightwards jika nomor melebihi 999.
   - **Validasi Format Tanggal:** Memvalidasi parameter JSONB tanggal tugas dan rentang izin (`tanggal_selesai >= tanggal_mulai`).
3. `public.rpc_return_loan` & `public.rpc_return_single_unit`:
   - **Verifikasi Sesi:** Memvalidasi sesi pemroses dan hak kapabilitas `loans.return`.
   - **Jejak Audit Forensik:** Mencatat mutasi pengembalian ke dalam `public.auth_audit_log` (`loan.return.full` dan `loan.return.single`).
4. `public.rpc_get_next_inv_code`:
   - **Guard Akses:** Menambahkan pengecekan kapabilitas internal (`inventory.create` atau `inventory.units.manage`, atau role `service_role`).
   - **Pencegahan Overflow:** Ekstraksi angka menggunakan regex format murni `^INV-([0-9]+)$` dengan casting `BIGINT` dan formatting aman saat melampaui 999.

### D. SECURITY DEFINER, Search Path, dan Grants
- **Mitigasi Search Path Hijacking:**
  - Semua fungsi `SECURITY DEFINER` diubah dari `SET search_path = public, auth` menjadi:
    ```sql
    SET search_path = pg_catalog, public, auth
    ```
  - Penempatan `pg_catalog` pada urutan pertama mencegah penyerang membajak resolusi operator/tipe/fungsi bawaan PostgreSQL melalui skema `public`.
- **Penerapan Prinsip Least Privilege:**
  - Fungsi-fungsi RPC dan helper dicabut hak eksekusinya dari `PUBLIC` dan `anon`:
    ```sql
    REVOKE ALL ON FUNCTION public.rpc_checkout_loan(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID[], UUID) FROM PUBLIC, anon, service_role;
    GRANT EXECUTE ON FUNCTION public.rpc_checkout_loan(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID[], UUID) TO authenticated;
    ```
  - Hak `service_role` hanya dipertahankan pada `rpc_get_next_inv_code` untuk kebutuhan seeding backend otomatis.
  - Klien PostgREST dicabut hak direct `INSERT` pada tabel persuratan (`ptv_surat_*`), mewajibkan pembuatan dokumen melalui `rpc_submit_official_doc`.

### E. Matriks Row Level Security (RLS) & Kebijakan Akses

| Tabel | Status RLS | Kebijakan Aktif | Target Roles | Klausul USING / WITH CHECK | Tujuan Keamanan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `auth_credentials` | **ENABLED** | `block_client_credentials` | ALL | `USING (false)` | Blokir total pembacaan hash password oleh klien PostgREST. |
| `ptv_keuangan` | **ENABLED** | `isolate_finance_view`<br>`isolate_finance_manage` | authenticated | `has_capability('finance.view')`<br>`has_capability('finance.manage')` | Karantina catatan kas studio dari kru umum dan Pembina. |
| `ptv_pemasukan` | **ENABLED** | `isolate_pemasukan` | authenticated | `has_capability('finance.view') OR ...` | Karantina buku kas masuk. |
| `ptv_pengeluaran` | **ENABLED** | `isolate_pengeluaran` | authenticated | `has_capability('finance.view') OR ...` | Karantina buku kas keluar. |
| `ptv_nilai_inventaris` | **ENABLED** | `isolate_valuation_view`<br>`isolate_valuation_manage` | authenticated | `has_capability('inventory.valuation.view')`<br>`has_capability('inventory.valuation.manage')` | Karantina nilai perolehan alat dari Pembina. |
| `identity_contact` | **ENABLED** | `isolate_contacts` | authenticated | `identity_id = (auth.jwt() ->> 'identity_id')::uuid OR has_capability('crew.permissions.manage')` | Perlindungan privasi nomor kontak santri. |
| `ptv_push_subscriptions`| **ENABLED** | `allow_client_insert_sub`<br>`block_client_read_sub` | authenticated | `WITH CHECK (auth.uid() IS NOT NULL)`<br>`USING (false)` | Klien hanya dapat mendaftarkan endpoint push miliknya; rahasia crypto tidak dapat dibaca. |
| `ptv_surat_*` (3 tabel) | **ENABLED** | Default Deny (0 policies direct INSERT dicabut) | anon / authenticated | Direct INSERT dicabut via DDL | Pembuatan surat wajib melalui RPC; penolakan pemalsuan pengaju. |
| `ptv_peminjaman` | **ENABLED** | Default Deny (Direct write diisolasi) | anon / authenticated | Dikontrol via RPC checkout/return | Integritas pencatatan inventaris terpusat. |
| `canonical_identity` | **ENABLED** | Direct read terkontrol | authenticated | Default deny bagi anon | Perlindungan master biodata. |
| 19 Tabel Operasional | **Unrestricted / Read-friendly** | Diatur per domain aplikasi | anon / authenticated | Sesuai peran publik/internal | Menjamin navigasi aplikasi dan referensi data tetap berjalan. |

### F. Idempotensi dan Batas Pemulihan (Recovery Limits)
- **Mitigasi Schema Drift:** Penggunaan `CREATE TABLE IF NOT EXISTS` tidak memodifikasi tabel yang sudah ada jika strukturnya tertinggal. Karena itu, file kandidat revisi menambahkan klausul eksplisit `ALTER TABLE ... ADD COLUMN IF NOT EXISTS diajukan_oleh ...` dan `CREATE INDEX IF NOT EXISTS`.
- **Idempotensi Fungsi & View:** Seluruh fungsi didefinisikan dengan `CREATE OR REPLACE FUNCTION` dan `CREATE OR REPLACE VIEW`.
- **Pembersihan Overload:** Diberikan perintah eksplisit `DROP FUNCTION IF EXISTS` untuk menghapus overload lama tanpa parameter `p_actor_id`, mencegah error PostgREST `PGRST203 (Function overloaded)`.
- **Seed Idempotensi:** Seluruh data master (53 kapabilitas, 5 profil, organisasi, divisi) menggunakan klausul `ON CONFLICT (...) DO UPDATE`.
- **Batas Pemulihan:** Naskah dibungkus dalam transaksi atomik (`BEGIN ... COMMIT`). Jika terjadi kesalahan di tengah eksekusi di SQL Editor, PostgreSQL akan melakukan *automatic transaction rollback*, mengembalikan skema ke kondisi persis sebelum eksekusi dimulai. Namun, transaksi baru ini tidak membatalkan objek yang telah di-commit pada migrasi terdahulu (sebelum blok transaksi ini).

---

## 3. Hasil Validasi Statis & Harness Lokal

Pengujian komprehensif dijalankan pada repositori lokal:
1. **Unit & Contract Tests:** `npm test` menghasilkan **52 passed dari 52 tests** pada 9 file pengujian.
   - Termasuk suite baru: [`tests/database/revisedCandidateHarness.test.ts`](file:///c:/Users/zidna/ptvpro/tests/database/revisedCandidateHarness.test.ts) (12 test case kelulusan kandidat DDL).
2. **Typecheck:** `npm run typecheck` (`tsc --noEmit`) lulus **0 error**.
3. **Linter:** `npm run lint` (`eslint . --max-warnings 0`) lulus **0 error, 0 warning**.
4. **Production Build:** `npm run build` berhasil mengompilasi bundle produksi tanpa kendala.

---

## 4. Daftar Blocker & Batas Audit

1. **Blocker 1 (Verifikasi Katalog DBA Diperlukan):**
   - Kredensial lokal anon key tidak memiliki hak membaca katalog PostgreSQL (`pg_proc`, `pg_roles`, `pg_policies`). Verifikasi live preflight memerlukan DBA manusia menjalankan [`docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql) di SQL Editor Supabase.
2. **Blocker 2 (Persetujuan Deployment Operator):**
   - Sesuai aturan mutlak, agen AI dilarang mengeksekusi DDL ke Supabase Staging tanpa persetujuan eksplisit pengguna.
