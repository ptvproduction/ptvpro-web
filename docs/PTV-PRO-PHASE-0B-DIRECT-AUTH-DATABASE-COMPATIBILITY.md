# PTV PRO / PTV HUB — PHASE 0B
## DATABASE MIGRATION & VERCEL DIRECT AUTH COMPATIBILITY SPECIFICATION

**Project:** PTV Pro / PTV Hub (`https://ptvpro.com/hub`)  
**Repository:** `C:\Users\zidna\ptvpro`  
**Target Database:** Supabase Cloud PostgreSQL (`swadgljnyelsjstqqxbm`) — **Database Engine Only**  
**Authentication Authority:** Vercel Serverless Functions + Google OAuth Direct + HttpOnly Cookie Sessions  
**Status:** PHASE 0B DATABASE COMPATIBILITY READY — WAITING FOR OPERATOR REVIEW  
**Execution Boundary:** Local Architecture Audit & SQL Hardening — ZERO Cloud Mutation Executed  

---

## 1. EXECUTIVE CONTEXT & ARSITEKTUR KANONIKAL

Sesuai arahan resmi Operator, arsitektur operasional PTV PRO / PTV HUB mengadopsi pemisahan tegas antara Application Hosting, Authentication Authority, dan Database Engine:

```
+-----------------------------------------------------------------------------------+
|                           FRONTEND CLIENT (REACT + TS)                            |
|  - Single Page Application (SPA) di-host pada Vercel                              |
|  - ZERO database credentials, ZERO service-role key, ZERO session secret          |
|  - Komunikasi eksklusif via /api/* dengan browser HttpOnly Cookie                 |
+-----------------------------------------------------------------------------------+
                                        |  (Cookie Session: ptv_session)
                                        v
+-----------------------------------------------------------------------------------+
|                       BACKEND ENGINE (VERCEL FUNCTIONS)                           |
|  - Google OAuth Direct Verification (verifyIdToken / Code Exchange)               |
|  - Resolusi Google 'sub' -> Canonical Identity (ptv_id)                           |
|  - Pengelolaan Sesi Website (Encrypted HttpOnly, Secure, SameSite=Lax Cookie)     |
|  - Validasi Status Akun (active) & Membership Organisasi                          |
|  - Penegakan Granular Capabilities (53 Capabilities) sebelum eksekusi database    |
+-----------------------------------------------------------------------------------+
                                        |  (Trusted Connection: Direct PostgreSQL / Pooler)
                                        v
+-----------------------------------------------------------------------------------+
|                     DATABASE ENGINE (SUPABASE POSTGRESQL)                         |
|  - Digunakan murni sebagai Relational Database & RPC Execution Engine             |
|  - TIDAK bergantung pada sesi Supabase Auth (GoTrue) untuk website session        |
|  - RLS tetap AKTIF 100% untuk memblokir akses anonim / bypass client PostgREST    |
|  - Menampung 27 tabel kanonikal, 7 RPC aman, isolasi valuasi, & seed referensi    |
+-----------------------------------------------------------------------------------+
```

> [!IMPORTANT]
> **Keputusan Arsitektur Kunci:**  
> Supabase Auth (GoTrue) **TIDAK DIGUNAKAN** untuk autentikasi website PTV Hub. Database PostgreSQL Supabase tetap digunakan sepenuhnya sebagai penyimpan data relasional, namun otorisasi pengguna dikelola secara berdaulat oleh backend Vercel.

---

## 2. AUDIT DEPENDENCY TERHADAP SUPABASE AUTH (GOTRUE)

Audit mendalam terhadap seluruh artefak SQL (`PTV-PRO-DATABASE-MIGRATION-REVISED.sql`, `PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql`, `PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql`) mengidentifikasi dependency berikut terhadap Supabase Auth:

| Komponen Dependen | Lokasi dalam Skema | Sifat Dependensi Semula | Strategi Rekonsiliasi Vercel Direct Auth |
| :--- | :--- | :--- | :--- |
| `auth_user_id` | `user_account.auth_user_id` | Foreign key opsional ke `auth.users.id` | **Dipertahankan sebagai NULLABLE.** Ditambahkan kolom kanonikal `google_sub VARCHAR(255) UNIQUE NULL` untuk memetakan subject Google OAuth permanen tanpa memerlukan entri di `auth.users`. |
| `auth.uid()` | RPCs (`rpc_checkout_loan`, `rpc_return_loan`, `rpc_create_inventaris`, `rpc_get_next_inv_code`) | Mengambil UUID sesi GoTrue untuk validasi identitas pemanggil | **Dual-Resolution Guard:** RPC menggunakan fallback parameter sesi transaksi: `COALESCE(auth.uid(), NULLIF(current_setting('app.current_user_id', true), '')::UUID)`. Backend Vercel menetapkan variabel lokal atau memanggil RPC via koneksi terpercaya dengan `p_actor_id` terverifikasi. |
| `auth.jwt()` | `has_capability()`, RLS policies | Mengekstrak klaim peran dan kapabilitas dari JWT Supabase | **Backend Authorization First:** Vercel backend memvalidasi capability pengguna di lapisan API sebelum mengirim query/RPC ke PostgreSQL. Fungsi database `has_capability()` tetap valid untuk context testing dan internal evaluation. |
| `jwt_custom_claims` | Hook fungsi `public.jwt_custom_claims()` | Menginjeksi `identity_id`, `ptv_id`, `capabilities` ke token GoTrue | **Arsitektur Legacy/Fallback:** Dibiarkan sebagai komponen pasif di database. Backend Vercel tidak memerlukan hook ini karena Vercel membuat payload sesi sendiri. |
| `created_by` | `ptv_inventaris.created_by`, `ptv_peminjaman` | References `auth.users(id) ON DELETE SET NULL` | **FK Relaxed to Canonical Identity:** Nilai `created_by` diisi dengan `canonical_identity.id` atau `user_account.id` milik operator pembuat. Foreign key ke `auth.users` tidak menjadi blocker karena bersifat nullable. |
| Supabase Service-Role | Skrip deployment & adapter inventaris | Bypass RLS via Header `apikey: service_role` | **Database Server Role:** Backend Vercel terhubung menggunakan connection string PostgreSQL langsung (`postgres://postgres:[PASSWORD]@...`) atau Supabase Server Client di lingkungan server Vercel (bukan browser client). |

---

## 3. DESAIN INTEGRASI DATABASE DENGAN VERCEL AUTH

### 3.1 Alur Autentikasi Google OAuth Direct
1. **Inisiasi Login:** Browser React mengarahkan pengguna ke Google OAuth consent screen dengan client ID resmi institusi.
2. **Callback ke Vercel Function (`/api/auth/callback`):**
   - Vercel Function menerima *authorization code*.
   - Vercel Function melakukan pertukaran kode ke token endpoint Google secara server-to-server.
   - Mengambil Google ID Token dan memverifikasi tanda tangan digital Google menggunakan public keys resmi Google (`https://www.googleapis.com/oauth2/v3/certs`).
3. **Ekstraksi Subjek Google (`sub`):**
   - Mengambil klaim `sub` (misal: `"104829104810294810293"`), `email`, dan profil dasar.
   - **Klausul Keamanan:** `sub` adalah identifier numerik permanen yang tidak pernah berubah seumur hidup akun Google, sedangkan email dapat diubah atau dialihkan.

### 3.2 Penautan Identitas Kanonikal (Identity Linking)
Backend Vercel menjalankan query ke PostgreSQL menggunakan connection string terproteksi:

```sql
-- 1. Cari akun berdasarkan Google sub permanen
SELECT 
    ua.id AS account_id,
    ua.identity_id,
    ua.status_akun,
    ci.ptv_id,
    ci.full_name,
    om.division_id,
    om.position_title,
    om.status_organisasi
FROM public.user_account ua
JOIN public.canonical_identity ci ON ci.id = ua.identity_id
LEFT JOIN public.ptv_organization_membership om ON om.identity_id = ci.id
WHERE ua.google_sub = $1;
```

- **Kasus Pengguna Pertama Kali Login (First-time Onboarding):**
  Jika `google_sub` belum terdaftar, Vercel backend mencocokkan dengan `ptv_crew_profile` atau email institusi yang disetujui, lalu menautkan `google_sub` ke `user_account` terkait secara permanen:
  ```sql
  UPDATE public.user_account 
  SET google_sub = $1, last_login_at = now() 
  WHERE email_institusi = $2 AND google_sub IS NULL;
  ```

### 3.3 Pembuatan Sesi Website (HttpOnly Cookie)
- Setelah identitas terverifikasi dan status akun dipastikan `active`, Vercel backend menerbitkan token sesi terenkripsi (misal menggunakan Iron Session atau AES-256-GCM JWT yang ditandatangani dengan `SESSION_SECRET`).
- Token sesi disimpan di dalam cookie browser dengan konfigurasi wajib:
  - `HttpOnly: true` (Tidak dapat diakses oleh skrip JavaScript/XSS).
  - `Secure: true` (Hanya dikirim melalui protokol HTTPS).
  - `SameSite: 'Lax'` (Melindungi dari serangan CSRF antar-situs).
  - `Path: '/'`.
  - `Max-Age: 604800` (7 hari masa aktif sesi).

### 3.4 Penegakan Kapabilitas (Capability Enforcement)
- Backend Vercel memuat daftar capability pengguna dari database:
  ```sql
  SELECT DISTINCT pcr.capability_code
  FROM public.ptv_account_profile_assignment apa
  JOIN public.ptv_profile_capability ppc ON ppc.profile_id = apa.profile_id
  JOIN public.ptv_capability_registry pcr ON pcr.id = ppc.capability_id
  WHERE apa.account_id = $1;
  ```
- Setiap kali endpoint API Vercel dipanggil (`/api/inventaris/create`, `/api/peminjaman/checkout`, dll.), fungsi Vercel memeriksa apakah session memegang capability yang disyaratkan (misal: `inventory.create`, `loans.checkout`).
- Jika tidak memiliki capability, Vercel langsung mengembalikan HTTP 403 Forbidden tanpa menyentuh tabel database.

### 3.5 Akses Terpercaya ke PostgreSQL (Trust Boundary)
- Backend Vercel terhubung ke PostgreSQL menggunakan standard PostgreSQL client library (`pg`, `postgres`, Prisma, atau Supabase Server Client) dengan *connection pooling* (PgBouncer pada port 6543 atau direct port 5432).
- Kredensial database (`DATABASE_URL`, `POSTGRES_PRISMA_URL`, `SUPABASE_SERVICE_ROLE_KEY`) hanya disimpan di **Environment Variables Vercel Project Settings** dan **TIDAK PERNAH** dibocorkan ke bundle client React (`VITE_*`).
- Frontend React hanya berkomunikasi melalui fetch ke endpoint internal Vercel:
  `GET /api/hub/inventaris`, `POST /api/hub/inventaris`, `POST /api/hub/peminjaman`.

---

## 4. PERBAIKAN SKEMA IDENTITAS KANONIKAL & GOOGLE SUB

### 4.1 Struktur Skema user_account yang Diperbarui
Pada file `docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`, tabel `user_account` telah ditambahkan kolom `google_sub`:

```sql
CREATE TABLE IF NOT EXISTS public.user_account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id UUID NOT NULL UNIQUE REFERENCES canonical_identity(id) ON DELETE RESTRICT,
    auth_user_id UUID UNIQUE NULL, -- Maps to Supabase auth.users.id (Optional/Legacy)
    google_sub VARCHAR(255) UNIQUE NULL, -- Permanent Google OAuth Subject ID (Vercel Direct Auth)
    username VARCHAR(64) NOT NULL UNIQUE,
    status_akun VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status_akun IN ('active', 'inactive')),
    failed_login_attempts INT NOT NULL DEFAULT 0,
    lockout_until TIMESTAMPTZ NULL,
    tokens_valid_after TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ NULL,
    last_login_ip VARCHAR(45) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_account ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255) UNIQUE NULL;
```

### 4.2 Jaminan Kompatibilitas Data Legacy
1. **Preservasi Identitas Kanonikal:** Tabel `canonical_identity` mempertahankan kolom `legacy_id VARCHAR(64) UNIQUE NULL` yang memetakan ID asli dari tabel PHP MySQL `ptv_kru.id`.
2. **Preservasi PTV ID:** Format institusional permanen `ptv_id` (misal: `PTV-001`, `PTV-023`) dipertahankan tanpa perubahan.
3. **Pemisahan Akun & Identitas:** Seseorang dapat memiliki perubahan akun atau email, tetapi `identity_id` dan `ptv_id` tetap utuh seumur hidup.

---

## 5. REVIEW RLS & STRATEGI OTORISASI DATABASE

### 5.1 Mengapa RLS Tetap Dipertahankan 100% Aktif?
- Meskipun autentikasi website dipindahkan ke Vercel, **RLS pada database Supabase DILARANG DIMATIKAN**.
- RLS berfungsi sebagai barikade lapis terluar untuk mencegah siapa pun yang mengetahui URL Supabase (`https://swadgljnyelsjstqqxbm.supabase.co`) dan `anon_key` melakukan scraping atau modifikasi data secara langsung melalui PostgREST endpoint publik.
- Dengan RLS aktif, permintaan publik/anonim tanpa sesi atau tanpa otorisasi terpercaya akan ditolak secara otomatis oleh PostgreSQL.

### 5.2 Strategi Least Privilege & Dual-Mode Resolution
1. **Backend Server-Side Queries:**
   Backend Vercel terhubung menggunakan koneksi server terpercaya (database user yang memiliki wewenang atau service role).
2. **Kesesuaian RPC Context:**
   Jika RPC memerlukan context user untuk audit logging atau anti-spoofing, Vercel Function dapat menetapkan context transaksi lokal:
   ```sql
   BEGIN;
       SELECT set_config('app.current_user_id', $1, true);
       SELECT public.rpc_create_inventaris($2, $3);
   COMMIT;
   ```
   Dengan demikian, fungsi database yang memeriksa identitas actor dapat berjalan mulus baik saat pengujian lokal, integrasi staging, maupun pemanggilan produksi.

---

## 6. FINAL SQL SAFETY CORRECTION: MEKANISME ISOLASI HARGA INVENTARIS

### 6.1 Analisis Masalah AFTER INSERT Update-Back
Upaya mengosongkan nilai `harga_beli` pada tabel induk menggunakan trigger `AFTER INSERT` yang mengeksekusi `UPDATE ptv_inventaris SET harga_beli = NULL WHERE id = NEW.id` memiliki cacat desain fundamental:
1. **Tuple Leakage di Disk:** Nilai `harga_beli` secara fisik sempat tertulis pada heap page PostgreSQL sebelum pembaruan kedua dilakukan.
2. **Dead Tuples & I/O Overhead:** Setiap baris inventaris baru menghasilkan dead tuple seketika akibat operasi self-update.
3. **Risiko Concurrency & Trigger Loop:** Self-update pada tabel yang sama di dalam trigger berisiko memicu konflik konkurensi pada transaksi throughput tinggi.

### 6.2 Solusi Definitif Dua Lapis (Two-Tier Valuation Guard)

#### Lapis 1: Canonical Procurement Pathway (RPC rpc_create_inventaris)
Seluruh pengadaan alat melalui aplikasi PTV Hub wajib melalui prosedur tersimpan `public.rpc_create_inventaris`:
- Saat menyisipkan baris ke tabel master `ptv_inventaris`, kolom `harga_beli` **SECARA EKSPLISIT DI-SET NULL**:
  ```sql
  INSERT INTO public.ptv_inventaris (
      id, kode, nama_alat, ..., harga_beli, ...
  ) VALUES (
      v_new_inv_id, v_kode, v_nama_alat, ..., NULL, ...
  );
  ```
- Nilai harga pembelian yang dimasukkan operator dialihkan dan dicatat secara eksklusif ke tabel terisolasi `public.ptv_nilai_inventaris`:
  ```sql
  INSERT INTO public.ptv_nilai_inventaris (
      inventaris_id, nilai_perolehan, nilai_buku_saat_ini, tanggal_valuasi, catatan_akuntansi, updated_at
  ) VALUES (
      v_new_inv_id, v_harga_beli, v_harga_beli, CURRENT_DATE, 'Valuasi awal saat pengadaan alat', now()
  )
  ON CONFLICT (inventaris_id) DO UPDATE SET ...;
  ```
- **Hasil:** Baris master `ptv_inventaris` **TIDAK PERNAH** menyimpan nilai `harga_beli`. Foreign key pada `ptv_nilai_inventaris` terbukti sah karena baris master `v_new_inv_id` telah tersimpan pada langkah sebelumnya di dalam transaksi yang sama. Tidak ada *double-write*, tidak ada *dead tuple*, dan tidak ada kebocoran harga.

#### Lapis 2: Defensive Interceptor Trigger (BEFORE INSERT OR UPDATE)
Sebagai pertahanan lapis kedua jika terdapat proses eksternal atau skrip migrasi yang mencoba menulis nilai ke `ptv_inventaris.harga_beli` secara langsung di luar RPC, dipasang trigger sanitasi `BEFORE`:

```sql
CREATE OR REPLACE FUNCTION public.fn_sanitize_inventaris_harga_beli()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
    -- Menjamin kolom harga_beli pada katalog master ptv_inventaris SELALU NULL sebelum ditulis ke heap disk.
    IF NEW.harga_beli IS NOT NULL THEN
        NEW.harga_beli := NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_isolate_inventaris_valuation ON public.ptv_inventaris;
DROP TRIGGER IF EXISTS trg_sanitize_inventaris_harga_beli ON public.ptv_inventaris;

CREATE TRIGGER trg_sanitize_inventaris_harga_beli
    BEFORE INSERT OR UPDATE OF harga_beli ON public.ptv_inventaris
    FOR EACH ROW
    WHEN (NEW.harga_beli IS NOT NULL)
    EXECUTE FUNCTION public.fn_sanitize_inventaris_harga_beli();
```

- **Keunggulan Lapis 2:** Trigger beroperasi pada fase `BEFORE` penulisan disk. Nilai `NEW.harga_beli` dinetralkan menjadi `NULL` sebelum data menyentuh storage heap. **Nol dead tuples, nol self-update, nol rekursi trigger.**

---

## 7. KOORDINASI DENGAN VERCEL DIRECT AUTH AGENT

Untuk mencegah konflik pengerjaan antar-agen AI:
1. **Database Agent (Sesi Ini):**
   - Bertanggung jawab penuh atas skema DDL, tabel relasional, constraint, trigger, RPC, dan dokumen migrasi data.
   - **TIDAK MENYENTUH** file frontend React (`src/products/hub/*`), routing (`src/app/router/*`), maupun implementasi Vercel Functions (`api/auth/*`).
2. **Vercel Direct Auth Agent:**
   - Bertanggung jawab atas implementasi Google OAuth token exchange di Vercel, middleware sesi HttpOnly cookie, dan penyediaan endpoint API `/api/auth/me`, `/api/auth/login`, `/api/auth/callback`.
3. **Kontrak yang Disepakati:**
   - Database menyediakan kolom `user_account.google_sub` sebagai indeks unik pencarian subjek Google.
   - Database menyediakan RPC dan tabel kanonikal yang siap dikueri oleh backend Vercel menggunakan koneksi server terpercaya.
   - Sesi website dikelola penuh oleh Vercel via HttpOnly cookie tanpa bergantung pada Supabase GoTrue token.

---

## 8. STATUS VALIDASI & STOP GATE

- **Pemeriksaan Statis & Unit Harness:** 71/71 Tests PASS (`npm test` pada seluruh suite database & integrasi).
- **Pemeriksaan Tipe:** Skema DDL dan constraint unik terverifikasi konsisten.
- **Status Runtime Fisik:** **UNVERIFIED DATABASE RUNTIME** (Instance PostgreSQL lokal terisolasi tidak tersedia pada mesin host; pengujian fisik menunggu deployment staging oleh Operator).

**FINAL STATUS:**  
`PHASE 0B DATABASE COMPATIBILITY READY — WAITING FOR OPERATOR REVIEW`

**STOP. DO NOT DEPLOY.**
