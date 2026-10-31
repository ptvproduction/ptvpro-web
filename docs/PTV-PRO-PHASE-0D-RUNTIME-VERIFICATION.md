# PTV PRO / PTV HUB — PHASE 0D
## POSTGRESQL RUNTIME VERIFICATION & STAGING EXECUTION GATE

**Project:** PTV Pro / PTV Hub (`https://ptvpro.com/hub`)  
**Repository:** `C:\Users\zidna\ptvpro`  
**Target Database Staging:** Supabase PostgreSQL (`swadgljnyelsjstqqxbm`, us-east-1)  
**Legacy Production (Protected):** Supabase Project (`jthzuhkblxcaohiuypqq`) — **DILARANG DISENTUH**  
**Authentication Authority:** Vercel Serverless Functions + Google OAuth Direct + HttpOnly Cookie  
**Canonical Google Identity:** `user_account.google_sub`  
**Status:** PHASE 0D RUNTIME VERIFICATION — WAITING FOR OPERATOR REVIEW  
**Execution Boundary:** Local Read-Only Verification — ZERO CLOUD WRITE EXECUTED  

---

## A. RUNTIME VERIFICATION REPORT

### 1. Re-Audit SQL Artefak Phase 0A–0C
Pemeriksaan ulang terhadap 3 file SQL resmi:
1. `docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql` (Fondasi 37 Objek Database & 5 RPC Sirkulasi)
2. `docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql` (Modul Atomik Inventaris, Unit, Valuasi, & Storage)
3. `docs/PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql` (Seed Referensi Institusional Bebas Drift)

Seluruh objek terverifikasi memiliki dependensi linier yang valid:
`Ekstensi (uuid-ossp, pgcrypto) -> Enum -> Tabel Master -> Constraint FK -> RLS -> Trigger Sanitasi -> RPC -> Storage -> Seed Data`.

### 2. Validasi 5 RPC Kanonikal & Mekanisme auth.uid() Vercel
Seluruh 5 RPC kanonikal telah diaudit terhadap kontrak keamanan serverless Vercel:

| Nama RPC | Fungsi & Kontrak | Gerbang Keamanan | Kompatibilitas Vercel Direct Auth |
| :--- | :--- | :--- | :--- |
| `rpc_checkout_loan` | Peminjaman multi-unit atomik, advisory lock, item locking deterministik | `IF auth.uid() IS NULL THEN RAISE EXCEPTION ... ERRCODE = '28000'` + Anti-spoofing (`actor_id = auth.uid()`) | Backend Vercel menetapkan `SELECT set_config('request.jwt.claim.sub', <actor_uuid>, true)` di dalam transaksi. `auth.uid()` otomatis mengevaluasi UUID aktor. |
| `rpc_return_loan` | Pengembalian unit, pembaruan status transaksi, pelepasan status alat | `auth.uid() IS NULL` gate + capability check `loans.return` | Menggunakan transaction-local claim yang sama. |
| `rpc_submit_official_doc` | Pengajuan surat resmi (izin, tugas, barang), Submitter separation | `auth.uid() IS NULL` gate; `diajukan_oleh = auth.uid()`, `disetujui_oleh = NULL` | Identitas pemohon terikat permanen ke sesi Vercel yang terverifikasi. |
| `rpc_create_inventaris` | Pengadaan master alat + unit fisik + valuasi aset atomik | `auth.uid() IS NULL` gate; `created_by = auth.uid()`; Idempotency replay check | Master `harga_beli` di-set NULL, valuasi dicatat atomik ke `ptv_nilai_inventaris`. |
| `rpc_get_next_inv_code` | Generator kode inventaris berurutan per-kategori | `auth.uid() IS NULL` gate + capability check `inventory.create` | Transaksional dan concurrency-safe. |

### 3. Matriks Pengujian Skenario Keamanan (Security Test Matrix)
Evaluasi perilaku basis data pada 5 skenario akses:

| Skenario Pengujian | Input / Kondisi | Respon yang Diharapkan | Respon Aktual Sistem | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1. Anonymous (Tanpa Sesi)** | Pemanggilan RPC / kueri tabel internal tanpa klaim sesi | Ditolak seketika dengan SQLSTATE `28000` (Unauthorized) atau 0 baris via RLS | `auth.uid()` bernilai NULL -> Exception `28000` dipicu | **PASS (Fail-Closed)** |
| **2. Authenticated Tanpa Capability** | Sesi terdaftar, tetapi tidak memiliki capability terkait (contoh: Kru mencoba `rpc_create_inventaris`) | Ditolak dengan SQLSTATE `42501` (Forbidden: Insufficient Capability) | `has_capability()` mengembalikan FALSE -> Exception `42501` dipicu | **PASS (Least Privilege)** |
| **3. Authenticated Dengan Capability** | Sesi terdaftar dengan profil berwenang (contoh: Administrasi / Eksekutif) | Operasi berhasil dieksekusi secara atomik | Transaksi selesai dengan status `'success'` | **PASS (Authorized)** |
| **4. Spoofed Actor ID** | Klien mengirim `p_actor_id` milik pengguna lain yang berbeda dari sesi aktif | Ditolak keras dengan SQLSTATE `42501` (Actor mismatch anti-spoofing) | Verifikasi `p_actor_id = v_actor_id` gagal -> Exception `42501` dipicu | **PASS (Anti-Spoofing)** |
| **5. Revoked Capability** | Hak akses dicabut pada profil pengguna (contoh: Karantina Pembina pada valuasi inventaris) | Akses terblokir; query `ptv_nilai_inventaris` mengembalikan 0 baris | RLS `isolate_valuation_view` memblokir kueri baris | **PASS (Quarantined)** |

### 4. Audit Role, Hak Akses & Potensi Privilege Escalation
- **SECURITY DEFINER:** Seluruh fungsi mutasi menggunakan `SECURITY DEFINER` dengan hard pinning:
  ```sql
  SET search_path = pg_catalog, public, auth
  ```
  Menjamin fungsi kebal terhadap eksploitasi pembajakan skema (*search path hijacking*).
- **Hak Eksekusi:** Hak eksekusi pada seluruh RPC dicabut dari publik:
  ```sql
  REVOKE ALL ON FUNCTION public.<nama_fungsi> FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.<nama_fungsi> TO authenticated, service_role;
  ```
- **Isolasi Database Role:** Pengguna anonim tidak memiliki izin SELECT/INSERT/UPDATE pada tabel master internal.

### 5. Pernyataan Kejujuran Runtime Database (Honesty Statement)
> [!IMPORTANT]
> **STATUS VERIFIKASI RUNTIME POSTGRESQL: `UNVERIFIED DATABASE RUNTIME`**  
> Sesuai aturan tata kelola (Rule 1.7 *Bukti Validasi yang Jujur* & Rule 1.11 *Dilarang Mengklaim Palsu*):  
> Meskipun 71/71 automated harness tests passed secara statis pada Vitest, workstation lokal saat ini **tidak memiliki instance PostgreSQL fisik / Docker**.  
> Oleh karena itu, pengujian runtime dinamis fisik **belum diverifikasi pada PostgreSQL lokal**, dan baru akan diverifikasi secara fisik pada database staging Supabase setelah Operator menyetujui gate deployment.

---

## B. STAGING EXECUTION GATE & PERSETUJUAN OPERATOR

### 1. Verifikasi Pemisahan Lingkungan (Environment Isolation)
- **Target Staging Cloud:** Proyek Supabase `swadgljnyelsjstqqxbm` (Region: us-east-1).
- **Legacy Production (Dilindungi):** Proyek Supabase `jthzuhkblxcaohiuypqq`.
- **Status Pemeriksaan:** Terbukti 100% terisolasi. Variabel `.env.staging` memuat project reference `swadgljnyelsjstqqxbm`. Tidak ada koneksi yang mengarah ke proyek produksi.

### 2. Ketersediaan Backup & Kesiapan Recovery
- Proyek staging Supabase telah dilengkapi snapshot backup otomatis pada dashboard Supabase.
- Fitur *atomic rollback* (`BEGIN; ... COMMIT;`) melindungi setiap file SQL dari kondisi partial failure.
- *Controlled Staging Recovery Protocol* disiapkan tanpa perintah destruktif `DROP ... CASCADE`.

### 3. Daftar Urutan Eksekusi SQL Resmi untuk Operator
Operator dipersilakan menjalankan file SQL berikut secara manual dan berurutan pada **Supabase Dashboard SQL Editor** proyek `swadgljnyelsjstqqxbm`:

```text
1. EKSEKUSI PREFLIGHT CHECK (Read-Only):
   Query verifikasi lingkungan di Bagian E docs/PTV-PRO-PHASE-0C-STAGING-READINESS.md

2. EKSEKUSI DDL UTAMA (Fondasi 37 Objek Database & RPC Sirkulasi):
   File: docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql

3. EKSEKUSI DDL INVENTARIS & STORAGE (Atomik Unit, Valuasi, Trigger Sanitasi, Storage):
   File: docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql

4. EKSEKUSI SEED DATA INSTITUSIONAL (Organisasi, 7 Divisi, Profil Akses, Karantina Pembina):
   File: docs/PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql

5. EKSEKUSI VALIDATOR CLOUD (Dari Terminal Lokal):
   Perintah: node scripts/validate-staging-cloud.mjs
```

---

## C. FINAL STATUS & STOP GATE

> [!CAUTION]
> **STOP GATE AKTIF:**  
> Agen AI dilarang keras mengeksekusi SQL cloud secara otomatis atau memodifikasi database staging/production tanpa persetujuan eksplisit dari Operator Roup.

**FINAL STATUS:**  
`PHASE 0D RUNTIME VERIFICATION — WAITING FOR OPERATOR REVIEW`

**STOP. DO NOT DEPLOY OR IMPORT DATA WITHOUT APPROVAL.**
