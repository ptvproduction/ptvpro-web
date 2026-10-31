# PTV PRO / PTV HUB — PHASE 0A: SQL SAFETY & PRE-DEPLOYMENT VALIDATION REPORT
**Project:** PTV Pro / PTV Hub  
**Target Environment:** Supabase Cloud Staging (`swadgljnyelsjstqqxbm`)  
**Scope:** Pre-Deployment SQL Hardening, Security Audit, Foreign Key Correction, and Local Validation  
**Date:** 2026-10-17  
**Status:** PHASE 0A FINAL CORRECTION — WAITING FOR OPERATOR REVIEW  
**Execution Boundary:** STRICT LOCAL PATCHING — ZERO DATABASE/CLOUD MUTATION EXECUTED  

---

## A. EXECUTIVE SUMMARY

Sesi pre-deployment hardening Fase 0A bertujuan memastikan seluruh artefak SQL untuk migrasi database Supabase staging aman, memenuhi standar arsitektur dan kapabilitas, bebas dari kebocoran data sensitif (*harga beli / valuasi aset*), serta tidak memiliki risiko *runtime blocker* (seperti pelanggaran *foreign key* atau *double-write*).

| Parameter | Metrik / Status |
| :--- | :--- |
| **Jumlah File Diaudit** | **3 File Utama** (`PTV-PRO-DATABASE-MIGRATION-REVISED.sql`, `PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql`, `PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql`) |
| **Total Temuan Keamanan & Kompatibilitas** | **10 Temuan** (`SEC-001` s/d `SEC-010`) |
| **Severity Temuan** | 5 Critical, 3 High, 2 Medium — **Seluruhnya Telah Ditambal (Patched)** |
| **Status Kelayakan Deploy** | **READY FOR OPERATOR DEPLOYMENT** (Menunggu review & eksekusi manual oleh Operator) |
| **Verifikasi Otomatis Lokal** | **71/71 Tests PASS** (Vitest test harness, drift remediation, RPC, dan inventaris integration) |
| **Verifikasi Fisik Runtime Database** | **BELUM TERVERIFIKASI RUNTIME (UNVERIFIED RUNTIME)** karena *isolated PostgreSQL/Docker* tidak tersedia pada host lokal. Verifikasi saat ini berupa *AST static parse*, *contract validation*, dan *mock integration*. |

---

## B. SECURITY & ARCHITECTURAL FINDINGS

### 1. SEC-001 (CRITICAL): Overly Permissive Inventory RLS Policy
- **File:** `docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql`
- **Masalah:** Policy `SELECT` pada `ptv_inventaris` dan `ptv_inventaris_unit` menggunakan `TO authenticated, anon` dengan klausul `USING (true)`. Kondisi ini membuka katalog inventaris internal ke publik anonim secara bebas. Selain itu, tidak ditemukan policy `DELETE`.
- **Status:** **PATCHED**. Policy `SELECT` dikunci ke role `authenticated` dengan verifikasi kapabilitas `public.has_capability('inventory.view') IS TRUE`. Policy `DELETE` eksplisit ditambahkan khusus bagi pemegang kapabilitas `inventory.delete`.

### 2. SEC-002 (CRITICAL): Hash Password Bocor pada Legacy Compatibility View
- **File:** `docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`
- **Masalah:** View `ptv_kru_legacy_compat` mengekspos hash kredensial (`ci.raw_app_meta_data ->> 'legacy_password_hash'`), tidak menyertakan `security_invoker = true`, dan dapat diakses oleh role `anon`.
- **Status:** **PATCHED**. Kolom diganti `NULL::text AS password_hash`, ditambahkan `WITH (security_invoker = true)`, serta hak akses dicabut: `REVOKE ALL ON public.ptv_kru_legacy_compat FROM anon;`.

### 3. SEC-003 (CRITICAL): rpc_create_inventaris Session Gate Null-Bypass
- **File:** `docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql`
- **Masalah:** Validasi `auth.uid()` hanya mengandalkan fallback klaim client-side, tanpa validasi tegas di baris awal fungsi PL/pgSQL.
- **Status:** **PATCHED**. Ditambahkan fail-closed gate di awal fungsi:
  ```sql
  IF v_auth_uid IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: Active user session required' USING ERRCODE = '28000';
  END IF;
  ```

### 4. SEC-004 (CRITICAL): Kebocoran Valuasi Aset / Harga Beli ke Role Non-Valuasi
- **File:** `docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql`
- **Masalah:** RLS PostgreSQL bekerja pada level baris (*row-level*), bukan menyembunyikan kolom (*column-level*). Jika kolom `harga_beli` diisi pada tabel induk `ptv_inventaris`, maka role seperti *Pembina* yang berhak melihat katalog (`inventory.view`) akan tetap dapat membaca nominal `harga_beli` melalui query PostgREST (`GET /rest/v1/ptv_inventaris`).
- **Status:** **PATCHED**. Diterapkan isolasi data:
  1. Pada `rpc_create_inventaris`, nilai kolom `harga_beli` pada tabel induk `ptv_inventaris` selalu di-set `NULL`.
  2. Nominal harga beli dicatat secara eksklusif ke tabel terpisah `ptv_nilai_inventaris`.
  3. Tabel `ptv_nilai_inventaris` dipagari oleh RLS `ptv_nilai_inventaris_select_policy` yang mewajibkan kapabilitas `inventory.valuation.view`.

### 5. SEC-005 (HIGH): Foreign Key Blocker pada trg_isolate_inventaris_valuation
- **File:** `docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql`
- **Masalah:** Trigger `BEFORE INSERT` pada `ptv_inventaris` mencoba melakukan `INSERT INTO ptv_nilai_inventaris` sebelum baris induk `NEW.id` tersimpan di database. Hal ini menyebabkan PostgreSQL memicu error pelanggaran *foreign key*: `Key (inventaris_id)=(...) is not present in table "ptv_inventaris"`.
- **Status:** **PATCHED**. 
  - Trigger diubah menjadi `AFTER INSERT OR UPDATE OF harga_beli ON public.ptv_inventaris`.
  - Pada fase `AFTER`, baris induk `ptv_inventaris` sudah terdaftar secara valid sehingga foreign key tidak pernah gagal.
  - Ditambahkan klausa filter presisi: `FOR EACH ROW WHEN (NEW.harga_beli IS NOT NULL)`.
  - Di dalam fungsi trigger, setelah valuasi di-upsert ke `ptv_nilai_inventaris`, dilakukan `UPDATE public.ptv_inventaris SET harga_beli = NULL WHERE id = NEW.id;`.
  - Pembaruan `harga_beli = NULL` tersebut otomatis diabaikan oleh klausa `WHEN`, sehingga mengeliminasi rekursi trigger tanpa loop.

### 6. SEC-006 (HIGH): Risiko Double-Write antara Trigger Valuasi dan rpc_create_inventaris
- **File:** `docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql`
- **Masalah:** Jika `rpc_create_inventaris` memasukkan `harga_beli` ke `ptv_inventaris` lalu trigger memprosesnya, dan setelah itu `rpc_create_inventaris` kembali menulis ke `ptv_nilai_inventaris`, maka terjadi *double-write* berlebihan.
- **Status:** **PATCHED**.
  - `rpc_create_inventaris` memasukkan `NULL` secara langsung ke kolom `ptv_inventaris.harga_beli`.
  - Karena nilai `harga_beli` adalah `NULL`, trigger `trg_isolate_inventaris_valuation` langsung dilewati (*zero execution cost*).
  - `rpc_create_inventaris` kemudian secara tunggal dan atomik menulis ke `ptv_nilai_inventaris`.
  - Trigger `AFTER` difungsikan sebagai proteksi pertahanan lapis kedua (*defense-in-depth*) jika terdapat operasi `INSERT` atau `UPDATE` langsung ke tabel `ptv_inventaris` di luar RPC.

### 7. SEC-007 (HIGH): Missing Unique Constraint pada ptv_nilai_inventaris(inventaris_id)
- **File:** `docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql` & `docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`
- **Masalah:** Operasi `ON CONFLICT (inventaris_id) DO UPDATE` pada `ptv_nilai_inventaris` gagal jika tidak terdapat unique constraint pada kolom `inventaris_id`.
- **Status:** **PATCHED**. Ditambahkan `CONSTRAINT uq_ptv_nilai_inventaris_id UNIQUE (inventaris_id)`.

### 8. SEC-008 (MEDIUM): Missing Column nama_unit pada DDL ptv_inventaris_unit
- **File:** `docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql` & `docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`
- **Masalah:** Model frontend dan payload RPC menyertakan `nama_unit`, namun skema DDL belum memuat kolom tersebut.
- **Status:** **PATCHED**. Kolom `nama_unit VARCHAR(128) NULL` ditambahkan pada DDL dan penanganan payload unit loop.

### 9. SEC-009 (HIGH): Missing UPDATE Policy pada Storage Bucket inventory
- **File:** `docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql`
- **Masalah:** Hanya terdapat policy `SELECT` dan `INSERT` pada bucket `inventory`. Operasi pembaruan foto alat oleh kru terblokir oleh RLS Supabase Storage.
- **Status:** **PATCHED**. Ditambahkan policy `inventory_authenticated_update` pada `storage.objects` yang memverifikasi kepemilikan sesi dan kapabilitas `inventory.edit` / `inventory.manage`.

### 10. SEC-010 (HIGH): Privilege Drift Rekonsiliasi Seed Reference Data
- **File:** `docs/PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql`
- **Masalah:** Perintah `ON CONFLICT DO NOTHING` tidak membersihkan kapabilitas lama jika profil yang sudah ada mengalami perubahan wewenang di masa lalu (*privilege drift*).
- **Status:** **PATCHED**. Ditambahkan query karantina eksplisit untuk mencabut `inventory.valuation.view` dan `inventory.valuation.manage` dari profil *Pembina*. Hak DML (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`) pada seluruh tabel referensi juga dicabut secara eksplisit dari role publik dan authenticated.

---

## C. CHANGES MADE (BEFORE / AFTER COMPARISON)

### 1. docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql

#### A. rpc_create_inventaris: Eliminasi Kebocoran & Double-Write
```sql
-- BEFORE (Berisiko double-write & membocorkan harga pada katalog publik)
    INSERT INTO public.ptv_inventaris (
        id, kode, nama_alat, kategori, spesifikasi, foto_url, harga_beli, ...
    ) VALUES (
        v_new_inv_id, v_kode, v_nama_alat, v_kategori, ...,
        NULLIF(p_master ->> 'harga_beli', '')::NUMERIC, ...
    );

-- AFTER (Katalog publik selalu NULL, double-write tereliminasi)
    INSERT INTO public.ptv_inventaris (
        id, kode, nama_alat, kategori, spesifikasi, foto_url, harga_beli, ...
    ) VALUES (
        v_new_inv_id, v_kode, v_nama_alat, v_kategori, ...,
        NULL, -- harga_beli SELALU NULL di ptv_inventaris untuk mencegah kebocoran data dan double-write
        ...
    );
```

#### B. Trigger Isolasi Valuasi (Foreign Key Safe & Non-Recursive)
```sql
-- BEFORE (Gagal foreign key karena BEFORE INSERT dan baris induk belum ada)
CREATE OR REPLACE FUNCTION public.fn_isolate_inventaris_valuation()
...
    IF NEW.harga_beli IS NOT NULL AND NEW.harga_beli > 0 THEN
        INSERT INTO public.ptv_nilai_inventaris (inventaris_id, ...) VALUES (NEW.id, ...);
    END IF;
    NEW.harga_beli := NULL;
    RETURN NEW;
END;
CREATE TRIGGER trg_isolate_inventaris_valuation
    BEFORE INSERT OR UPDATE OF harga_beli ON public.ptv_inventaris ...

-- AFTER (AFTER INSERT/UPDATE menjamin foreign key valid + WHEN clause cegah rekursi)
CREATE OR REPLACE FUNCTION public.fn_isolate_inventaris_valuation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, auth AS $$
BEGIN
    IF NEW.harga_beli IS NOT NULL THEN
        INSERT INTO public.ptv_nilai_inventaris (
            inventaris_id, nilai_perolehan, nilai_buku_saat_ini, tanggal_valuasi, catatan_akuntansi, updated_at
        ) VALUES (
            NEW.id, NEW.harga_beli, NEW.harga_beli, CURRENT_DATE, 'Sinkronisasi otomatis valuasi aset', now()
        )
        ON CONFLICT (inventaris_id) DO UPDATE SET
            nilai_perolehan = EXCLUDED.nilai_perolehan,
            nilai_buku_saat_ini = EXCLUDED.nilai_buku_saat_ini,
            updated_at = now();

        UPDATE public.ptv_inventaris
        SET harga_beli = NULL
        WHERE id = NEW.id;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_isolate_inventaris_valuation ON public.ptv_inventaris;
CREATE TRIGGER trg_isolate_inventaris_valuation
    AFTER INSERT OR UPDATE OF harga_beli ON public.ptv_inventaris
    FOR EACH ROW
    WHEN (NEW.harga_beli IS NOT NULL)
    EXECUTE FUNCTION public.fn_isolate_inventaris_valuation();
```

---

## D. FINAL EXECUTION ORDER (URUTAN DEPLOYMENT RESMI)

Operator wajib mengeksekusi script secara manual pada **Supabase Dashboard SQL Editor** proyek `swadgljnyelsjstqqxbm` sesuai urutan berikut:

```text
1. PREFLIGHT CHECK (Read-Only)
   Jalankan query verifikasi status pada Bagian E untuk memastikan database bersih dari konflik objek.

2. FONDASI SKEMA UTAMA (DDL Utama)
   Eksekusi: docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql
   - Membangun 27 tabel kanonikal institusional.
   - Mengaktifkan ekstensi uuid-ossp dan pgcrypto.
   - Mengonfigurasi enum, RLS pada 10 tabel inti, dan view legacy aman.
   - Mendaftarkan RPC autentikasi dan sirkulasi peminjaman.

3. DDL ATOMIK INVENTARIS & STORAGE
   Eksekusi: docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql
   - Menambahkan kolom pendukung (nama_unit, request_payload_hash, created_by).
   - Menetapkan unique constraint pada ptv_nilai_inventaris(inventaris_id).
   - Mengonfigurasi RLS inventaris dan unit (hanya authenticated dengan capability).
   - Mengonfigurasi bucket 'inventory' beserta policy SELECT, INSERT, UPDATE, dan DELETE.
   - Mengaktifkan trigger isolasi valuasi aset (AFTER INSERT OR UPDATE OF harga_beli).
   - Mendaftarkan rpc_create_inventaris yang ter-hardening.

4. SEED DATA REFERENSI INSTITUSIONAL
   Eksekusi: docs/PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql
   - Mengisi organisasi PTV, divisi, profil akses (5 profil kanonikal), dan 53 capability.
   - Menjalankan karantina privilege drift untuk profil Pembina.
   - Mengunci izin DML pada tabel referensi institusional.
```

---

## E. PREFLIGHT CHECKLIST (READ-ONLY)

Salin dan jalankan script SQL berikut di SQL Editor Supabase sebelum deployment untuk memverifikasi lingkungan target:

```sql
-- 1. Verifikasi Koneksi & User
SELECT current_database() AS db_name, current_user AS executing_user;

-- 2. Verifikasi Ekstensi Kriptografi & UUID
SELECT name, default_version, installed_version 
FROM pg_available_extensions 
WHERE name IN ('uuid-ossp', 'pgcrypto');

-- 3. Deteksi Objek ptv_* Eksisting
SELECT table_schema, table_name, table_type 
FROM information_schema.tables 
WHERE table_name LIKE 'ptv_%' 
ORDER BY table_name;

-- 4. Periksa Keberadaan Bucket 'inventory'
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'inventory';
```

---

## F. POST-DEPLOYMENT VALIDATION

Setelah Operator menyelesaikan langkah eksekusi DDL dan Seed di Supabase Dashboard, jalankan validator dari terminal lokal:

```powershell
node scripts/validate-staging-cloud.mjs
```

### Kriteria Kelulusan (Expected Results):
- **Tables Deployed:** 27/27 (PASS)
- **RPCs Deployed:** 7/7 (PASS)
- **RLS Status:** ENABLED pada seluruh tabel `ptv_*`
- **Valuation Isolation:** Kolom `harga_beli` pada `ptv_inventaris` selalu `NULL`
- **Storage Bucket:** `inventory` terdaftar dengan RLS storage policies aktif

---

## G. CONTROLLED STAGING RECOVERY PROTOCOL (PENGGANTI DROP CASCADE)

> [!CAUTION]
> **DILARANG MENJALANKAN `DROP ... CASCADE` SECARA DESTRUKTIF!**  
> Seluruh skrip SQL telah dibungkus blok transaksi `BEGIN; ... COMMIT;`. Jika terjadi kesalahan sintaks di tengah eksekusi, PostgreSQL secara otomatis membatalkan seluruh perubahan (*atomic rollback*).

Jika deployment mengalami kegagalan struktural atau perlu dilakukan pemulihan skema staging, gunakan prosedur terkontrol berikut:

1. **Evaluasi Diagnostik:**
   Periksa log pesan error spesifik pada Supabase SQL Editor. Catat nama constraint, tipe, atau tabel yang bermasalah.
2. **Karantina & Approval Operator:**
   Dilarang menghapus tabel atau data tanpa persetujuan tertulis dari Operator Roup.
3. **Surgical Object Reversion (Jika Disetujui):**
   Hanya hapus objek yang secara spesifik gagal dibuat dalam transaksi terpisah tanpa menyentuh tabel data lain:
   ```sql
   -- CONTOH SURGICAL REVERSION TERKONTROL (HANYA DENGAN APPROVAL OPERATOR)
   BEGIN;
       -- Hanya lepaskan trigger / fungsi yang gagal diperbarui
       DROP TRIGGER IF EXISTS trg_isolate_inventaris_valuation ON public.ptv_inventaris;
       DROP FUNCTION IF EXISTS public.fn_isolate_inventaris_valuation();
   COMMIT;
   ```
4. **Point-in-Time Recovery (PITR) / Backup Snapshot:**
   Untuk pemulihan menyeluruh, gunakan fitur cadangan resmi Supabase Dashboard (*Settings -> Database -> Backups*) untuk memulihkan state sebelum migrasi dijalankan.

---

## H. REMAINING RISKS & VERIFICATION STATUS

1. **Status Verifikasi Runtime Dinamis:**
   - **Status:** **BELUM TERVERIFIKASI FISIK RUNTIME DATABASE (UNVERIFIED RUNTIME)**.
   - **Fakta Teknis:** Lingkungan PostgreSQL lokal terisolasi (*psql* / *Docker*) tidak tersedia pada workstation pengembangan. Pengujian lokal yang telah dijalankan mencakup *AST static analysis*, *regex safety parser*, serta *Vitest unit & contract harnesses* (71/71 tests PASS).
   - **Rekomendasi:** Pengujian skenario fisik (*INSERT dengan harga, tanpa harga, UPDATE harga, dan idempotent replay*) wajib divalidasi langsung di database Supabase staging oleh Operator segera setelah migrasi DDL selesai dieksekusi.
2. **PostgREST Schema Cache Reload:**
   Setelah mengeksekusi DDL baru, PostgREST membutuhkan waktu 2–5 detik untuk memperbarui metadata cache internal sebelum RPC dan endpoint baru dapat diakses via HTTP.

---

## I. FINAL STATUS

**`PHASE 0A FINAL CORRECTION — WAITING FOR OPERATOR REVIEW`**

**STOP. DO NOT DEPLOY.**  
*(Silakan operator memeriksa laporan ini dan artefak SQL yang telah ditambal sebelum mengeksekusi di Supabase Dashboard).*
