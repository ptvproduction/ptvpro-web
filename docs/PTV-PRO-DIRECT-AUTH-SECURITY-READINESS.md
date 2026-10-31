# PTVPRO — DIRECT GOOGLE OAUTH SECURITY & DATABASE INTEGRATION AUDIT
## Laporan Kesiapan Keamanan, Penegakan Kriptografis, & Verifikasi Integrasi Database

**Tanggal Evaluasi:** 17 Oktober 2026  
**Status Audit Keseluruhan:** **BLOCKED (PENDING STAGING PHASE 0B SQL DEPLOYMENT)**  
**Modul Target:** PTV Hub Authentication (`/hub/login`) via Vercel Serverless Functions (`/api/auth/*`)  
**Penilai:** AI Agent Piket Dev (`PTV-DEV-028`)  
**Operator Sistem:** Roup / PTVPRO Core Lead  
**Final Status Tag:** `DIRECT AUTH SECURITY REVIEW — WAITING FOR OPERATOR VALIDATION`

---

## 1. RINGKASAN EKSEKUTIF & STATUS KESIAPAN SISTEM

Audit forensik keamanan telah dilakukan secara menyeluruh terhadap implementasi **Direct Google OAuth** berbasis Vercel Serverless Functions (`api/auth/*`) di repositori `ptvpro`. Evaluasi ini memeriksa kode aktual, dependensi kriptografis, arsitektur sesi, routing Vercel, serta kontrak basis data PostgreSQL.

### Tabel Ringkasan 10 Titik Audit

| # | Parameter Audit | Hasil Evaluasi Aktual | Status |
| :--- | :--- | :--- | :--- |
| **1** | **Koneksi Database PostgreSQL vs Mock/Fail-Open** | `api/auth/_utils/identity.ts` telah dihubungkan langsung ke PostgreSQL via `@supabase/supabase-js` menggunakan `SUPABASE_SERVICE_ROLE_KEY`. Jika kunci tidak terkonfigurasi pada production/staging, sistem mengeksekusi penolakan **Strict Fail-Closed** (HTTP 500/Reject). Mock fixtures diisolasi ketat hanya untuk runtime `NODE_ENV === 'test'`. | **VERIFIED (HARDENED)** |
| **2** | **Mapping `google_sub` & SQL Phase 0B** | Query `user_account.google_sub`, `status_akun = 'active'`, dan penegakan capability `hub.access` telah diimplementasikan sesuai skema kanonikal SQL Phase 0B. Namun, DDL Phase 0B **belum dieksekusi di database staging cloud** (`swadgljnyelsjstqqxbm`), sehingga login cloud riil saat ini **BLOCKED**. | **BLOCKED (DEPENDENCY)** |
| **3** | **Verifikasi Kriptografis ID Token Google** | `api/auth/_utils/crypto.ts` mengimplementasikan fungsi `verifyGoogleIdToken` yang memvalidasi ID token Google secara kriptografis menggunakan algoritma **RS256** dan public key dari Google JWKS (`https://www.googleapis.com/oauth2/v3/certs`) via Node.js native `crypto.createPublicKey` dan `crypto.createVerify`. Bukan sekadar membaca payload JSON yang belum diverifikasi. | **VERIFIED (SECURE)** |
| **4** | **Audit State, PKCE, Nonce, Redirect URI, Cookie, & CSRF** | Menggunakan PKCE SHA-256 (`code_challenge`), HMAC-SHA256 signed state, binding kriptografis `nonce` antara login request dan Google ID token, isolasi cookie HttpOnly/Secure/SameSite=Lax, serta pembersihan state cookie setelah callback. | **VERIFIED (COMPLIANT)** |
| **5** | **Sesi Website: Expiry, Revokasi, Logout, Penonaktifan Kru** | Cookie sesi `ptv_hub_session` memiliki masa kedaluwarsa 7 hari (payload `iat`/`exp`), logout membersihkan cookie dengan `Max-Age=0`, dan endpoint `/api/auth/session` secara aktif mengeksekusi `verifyAccountStatusLive(session.account_id)` ke database sehingga kru yang dinonaktifkan (`inactive`) langsung kehilangan sesi. | **VERIFIED (ENFORCED)** |
| **6** | **Server-side Authorization pada Internal API** | Seluruh endpoint autentikasi (`/api/auth/*`) menegakkan otorisasi server-side. Namun, modul bisnis Hub (seperti Inventaris) saat ini memanggil Supabase PostgREST langsung dari browser client. PostgREST client tanpa GoTrue JWT beroperasi di bawah role `anon`. Ini dicatat sebagai dependensi fase gateway berikutnya. | **IDENTIFIED & SCOPED** |
| **7** | **Integritas Routing `vercel.json`** | File `vercel.json` secara eksplisit mendefinisikan routing rewrite `/api/(.*)` ke `/api/$1` mendahului SPA fallback `/((?!api/).*)` ke `/index.html`. Tidak ada risiko Vercel menyajikan `index.html` untuk panggilan API. | **VERIFIED (PASS)** |
| **8** | **Kompatibilitas Vercel Functions & TypeScript Build** | `api/auth/*` menggunakan modul standar Node.js (`node:crypto`, `node:http`) dan sepenuhnya kompatibel dengan Node.js runtime Vercel serta lolos kompilasi `tsc --noEmit`. | **VERIFIED (PASS)** |
| **9** | **Isolasi Modul (Homepage Agent & Migration Agent)** | Zero file collision. Tidak menyentuh modul Public Portal (`src/products/portal/*`), skrip migrasi database (`scripts/legacy-data-importer.mjs`), atau baseline desain R03. | **VERIFIED (CLEAN)** |
| **10** | **Eksekusi Quality Gates Resmi** | Typecheck (0 error), ESLint (0 warning), Unit Tests (38 suites, 448 tests passed 100%), Production Vite Build (berhasil). | **VERIFIED (100% PASS)** |

---

## 2. AUDIT MENDALAM TIAP TITIK PEMERIKSAAN

### 2.1 Titik 1: Verifikasi Koneksi PostgreSQL & Kebijakan Fail-Closed (`api/auth/_utils/identity.ts`)
- **Implementasi Nyata:**
  Pada file [identity.ts](file:///c:/Users/zidna/ptvpro/api/auth/_utils/identity.ts), alur resolusi identitas `resolveIdentityByGoogleSub` memeriksa ketersediaan variabel lingkungan `SUPABASE_SERVICE_ROLE_KEY` dan `SUPABASE_URL`.
  ```typescript
  if (supabaseUrl && serviceRoleKey) {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Kueri langsung ke PostgreSQL: tabel user_account join canonical_identity
  }
  ```
- **Ketahanan Fail-Closed:**
  Jika environment backend Vercel belum dikonfigurasi dengan kredensial database (atau jika database tidak dapat dihubungi), sistem **secara tegas menolak akses** dan tidak melakukan fallback ke data mock:
  ```typescript
  return {
    success: false,
    error: 'Konfigurasi Server Error: Kredensial database backend (SUPABASE_SERVICE_ROLE_KEY) belum dikonfigurasi pada server Vercel. Akses ditolak fail-closed.',
  };
  ```
- **Isolasi Fixture Test:**
  Data mock `LOCAL_GOOGLE_MOCK_USERS` diproteksi secara absolut di balik klausa `process.env.NODE_ENV === 'test'`. Di lingkungan `staging` maupun `production`, blok ini mustahil tereksekusi.

---

### 2.2 Titik 2: Mapping `user_account.google_sub` & SQL Phase 0B
- **Query Basis Data:**
  Pencarian akun kru menggunakan kolom `user_account.google_sub` yang ditautkan ke tabel `canonical_identity`:
  ```typescript
  const { data: userAccount, error: userError } = await supabase
    .from('user_account')
    .select(`
      id,
      identity_id,
      username,
      status_akun,
      google_sub,
      canonical_identity:canonical_identity!identity_id (
        id,
        ptv_id,
        full_name
      )
    `)
    .eq('google_sub', googleSub)
    .maybeSingle();
  ```
- **Pemeriksaan Status Akun & Capability `hub.access`:**
  1. Akun wajib memiliki `status_akun = 'active'`. Jika berstatus `inactive` atau `suspended`, callback langsung membatalkan login dengan pesan deskriptif.
  2. Sistem mengambil data dari `account_profiles` dan `account_capability_overrides`.
  3. Memastikan pengguna memiliki izin `hub.access`. Jika izin ini dicabut atau tidak dimiliki, login ditolak secara fail-closed.
- **Penyebab Status BLOCKED:**
  Berdasarkan validasi cloud staging sebelumnya (`docs/PTV-PRO-STAGING-CLOUD-VALIDATION.md`), proyek Supabase cloud staging (`swadgljnyelsjstqqxbm`) belum menjalankan script DDL Phase 0A/Phase 0B (`public.user_account` belum dibuat atau belum memiliki kolom `google_sub`). Oleh karena itu, pengujian langsung terhadap database cloud staging saat ini masih berstatus **BLOCKED**.

---

### 2.3 Titik 3: Verifikasi Kriptografis Google ID Token (RS256 JWKS)
- **Celah Lama (Identified & Resolved):**
  Sebelumnya, callback berpotensi sekadar membaca claim JSON atau bergantung pada panggilan userinfo HTTP tanpa verifikasi signature JWT.
- **Implementasi Hardening Kriptografis:**
  Pada [crypto.ts](file:///c:/Users/zidna/ptvpro/api/auth/_utils/crypto.ts), diimplementasikan fungsi `verifyGoogleIdToken`:
  1. **JWKS Fetching & Caching:** Mengambil sertifikat publik Google dari `https://www.googleapis.com/oauth2/v3/certs` dan menyimpannya di memori serverless selama 1 jam (`GOOGLE_JWKS_CACHE_TTL = 3600000`).
  2. **Header & Key Match:** Membaca header ID token, memverifikasi `alg === 'RS256'`, dan mencocokkan `kid` (Key ID) dengan JWK Google.
  3. **RS256 Signature Verification:** Mengonversi JWK publik menjadi Node `KeyObject` melalui `crypto.createPublicKey({ key: matchingKey, format: 'jwk' })` dan memvalidasi payload menggunakan `crypto.createVerify('RSA-SHA256')`.
  4. **Claim Validation:**
     - `iss` wajib sama dengan `'https://accounts.google.com'` atau `'accounts.google.com'`.
     - `aud` wajib persis sama dengan Google Client ID PTVPRO.
     - `exp` wajib di masa depan (`payload.exp >= nowSec`).
     - `nonce` wajib cocok dengan nilai acak yang disematkan saat request login awal.
  5. Jika verifikasi tanda tangan kriptografis gagal, token langsung ditolak.

---

### 2.4 Titik 4: Audit OAuth State, PKCE, Nonce, Redirect URI, & CSRF
- **PKCE (Proof Key for Code Exchange):**
  - Menggunakan RFC 7636 compliant `code_verifier` (43-128 karakter kriptografis base64url acak).
  - Menghasilkan `code_challenge` dengan format `base64url(SHA256(verifier))` menggunakan `code_challenge_method: 'S256'`.
  - Disimpan dalam cookie HttpOnly sementara `ptv_auth_verifier` yang dihapus segera setelah pertukaran token selesai.
- **HMAC State & Nonce CSRF Protection:**
  - Parameter `state` ditandatangani dengan rahasia server (`AUTH_SECRET`) menggunakan HMAC-SHA256: `base64url(payload).base64url(HMAC)`.
  - Parameter `nonce` kriptografis (32 byte acak) dibuat saat inisialisasi dan dimasukkan ke dalam URL otorisasi Google (`&nonce=...`) sekaligus diikat ke dalam payload signed `state`.
  - Callback memvalidasi kecocokan `state` antara query string dan cookie sementara `ptv_auth_state`, memverifikasi signature HMAC-nya, lalu memverifikasi bahwa `claims.nonce === verifiedState.nonce`.
- **Redirect URI Handling:**
  - Menggunakan redirect URI kanonikal yang ditentukan di sisi server (`${baseUrl}/api/auth/google/callback`).
  - Mendukung penentuan host dinamis yang aman (`x-forwarded-host` / `host`) dengan fallback ke production URL `https://ptvpro.com`.
  - Parameter `returnTo` divalidasi ketat (wajib diawali tanda slash `/`, dilarang protokol eksternal `//` atau `http://` untuk mencegah Open Redirect Vulnerability).

---

### 2.5 Titik 5: Sesi Website (Expiry, Revokasi, Logout, Penonaktifan Kru)
- **Cookie Sesi Website:**
  - Nama: `ptv_hub_session`.
  - Atribut: `Path=/; HttpOnly; SameSite=Lax; Secure` (pada production/staging) dengan masa berlaku 7 hari (`Max-Age=604800`).
  - Enkripsi/Signing: Ditandatangani dengan HMAC-SHA256 menggunakan `AUTH_SECRET`.
- **Penanganan Penonaktifan Kru / Revokasi Langsung (`verifyAccountStatusLive`):**
  - Meskipun JWT cookie memiliki expiry 7 hari, endpoint [session.ts](file:///c:/Users/zidna/ptvpro/api/auth/session.ts) memanggil `verifyAccountStatusLive(session.account_id)` setiap kali browser meminta status sesi.
  - Jika seorang admin mengubah `status_akun` kru menjadi `'inactive'` di basis data PostgreSQL, endpoint `/api/auth/session` secara otomatis mendeteksi perubahan ini, mengirim header `Set-Cookie` untuk memusnahkan cookie (`Max-Age=0`), dan mengembalikan `{ authenticated: false, user: null }`.
- **Logout:**
  - Endpoint [logout.ts](file:///c:/Users/zidna/ptvpro/api/auth/logout.ts) memusnahkan cookie sesi dengan `Max-Age=0` dan `Expires=Thu, 01 Jan 1970 00:00:00 GMT`.

---

### 2.6 Titik 6: Otorisasi Server-Side pada Endpoint Internal API
- **Endpoint Autentikasi (`/api/auth/*`):**
  - Seluruh endpoint API internal autentikasi memvalidasi hak akses dan status akun di sisi server (Node.js backend Vercel).
  - Client-side `ProtectedRoute` di React hanya bertindak sebagai pelindung UX visual navigasi; otentisitas pengguna ditentukan oleh hasil endpoint server `/api/auth/session`.
- **Catatan Arsitektur Modul Bisnis (Inventaris, Keuangan, dll.):**
  - Saat ini, data inventaris diakses melalui `inventarisService.ts` yang memanggil PostgREST Supabase langsung dari browser.
  - Karena login website tidak lagi menerbitkan JWT GoTrue Supabase Auth, pemanggilan PostgREST langsung dari browser akan berjalan dengan role PostgreSQL `anon`.
  - **Rekomendasi Arsitektur:** Setelah DDL PostgreSQL Phase 0B diterapkan, endpoint data mutasi/transaksional wajib diarahkan melalui Vercel API Gateway (`/api/*`) atau Supabase RPC yang menggunakan service gateway agar keamanan RLS tidak terekspos ke publik anonim.

---

### 2.7 Titik 7: Integritas Routing `vercel.json`
- **Konfigurasi `vercel.json` Aktual:**
  ```json
  {
    "framework": "vite",
    "rewrites": [
      {
        "source": "/api/(.*)",
        "destination": "/api/$1"
      },
      {
        "source": "/((?!api/).*)",
        "destination": "/index.html"
      }
    ]
  }
  ```
- **Analisis:**
  Aturan rewrite pertama secara eksplisit menangkap semua rute `/api/(.*)` dan mengarahkannya ke fungsi Vercel Serverless. Aturan kedua menggunakan pola *negative lookahead* `/((?!api/).*)` sehingga rute SPA fallback ke `index.html` hanya berlaku untuk halaman browser non-API. Tidak ada potensi terjadinya *API rewrite collision*.

---

### 2.8 Titik 8: Kompatibilitas Vercel Functions & TypeScript
- File serverless berada pada direktori standar Vercel:
  - `api/auth/google/login.ts`
  - `api/auth/google/callback.ts`
  - `api/auth/session.ts`
  - `api/auth/logout.ts`
- Menggunakan standar ES Module dan TypeScript yang kompatibel dengan konfigurasi `tsconfig.json` repositori.
- Kompilasi `npm run typecheck` (`tsc --noEmit`) berhasil dengan **0 error**.

---

### 2.9 Titik 9: Isolasi Modul & Tidak Bertabrakan dengan Agent Lain
- **Homepage Agent:** Tidak ada modifikasi pada halaman portal publik (`src/products/portal/*`), router publik, maupun styling portal.
- **Migration Agent:** Tidak ada modifikasi atau penghapusan skrip migrasi data (`scripts/legacy-data-importer.mjs`) maupun berkas skema legacy.
- **Design System R03:** Halaman login (`LoginPage.tsx`) tetap mempertahankan desain visual R03 dan Clean Login URL (`/hub/login`) tanpa query string berlebih.

---

### 2.10 Titik 10: Hasil Eksekusi Quality Gates

Seluruh quality gates resmi repositori telah dijalankan dan diverifikasi:

1. **Pengecekan Tipe (`npm run typecheck`):**
   ```bash
   > ptvpro@0.1.0 typecheck
   > tsc --noEmit
   # Exit Code: 0 (Clean, 0 errors)
   ```
2. **Linting (`npm run lint`):**
   ```bash
   > ptvpro@0.1.0 lint
   > eslint . --max-warnings 0
   # Exit Code: 0 (Clean, 0 errors, 0 warnings)
   ```
3. **Pengujian Unit (`npm test`):**
   ```bash
   # Test Files: 38 passed (38 total suites)
   # Tests:      448 passed (448 total tests)
   # Duration:   6.54s
   ```
4. **Kompilasi Build Produksi (`npm run build`):**
   ```bash
   > ptvpro@0.1.0 build
   > tsc && vite build
   # built in 16.89s
   # Output: dist/index.html, dist/assets/* (Valid & Ready)
   ```

---

## 3. CHECKLIST PRA-DEPLOYMENT & RUNBOOK OPERATOR

Sebelum fitur login Direct Google OAuth ini dapat diuji secara langsung (live end-to-end) pada domain staging atau production, Operator Roup perlu menyelesaikan dua prasyarat lingkungan berikut:

### Prasyarat 1: Eksekusi SQL Phase 0B pada Database Supabase Staging
Jalankan skrip DDL Phase 0B di SQL Editor Supabase Staging (`swadgljnyelsjstqqxbm`):
```sql
-- Tambahkan kolom google_sub pada user_account
ALTER TABLE public.user_account
ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255) UNIQUE NULL;

CREATE INDEX IF NOT EXISTS idx_user_account_google_sub 
ON public.user_account (google_sub);

-- Contoh penautan akun kru awal untuk pengujian Operator:
-- UPDATE public.user_account 
-- SET google_sub = '<GOOGLE_SUB_MILIK_OPERATOR>' 
-- WHERE username = 'eksekutif';
```

### Prasyarat 2: Konfigurasi Environment Variables di Vercel Dashboard
Pastikan variabel lingkungan berikut disetel pada Vercel Project Settings (Environment: Staging & Production):
1. `GOOGLE_CLIENT_ID`: OAuth 2.0 Web Application Client ID dari Google Cloud Console.
2. `GOOGLE_CLIENT_SECRET`: OAuth 2.0 Client Secret dari Google Cloud Console.
3. `AUTH_SECRET`: Kunci acak minimal 32 karakter untuk penandatanganan HMAC-SHA256 state & session.
4. `SUPABASE_URL`: `https://swadgljnyelsjstqqxbm.supabase.co`
5. `SUPABASE_SERVICE_ROLE_KEY`: Service role secret key Supabase (tersimpan aman di Vercel, dilarang dipublikasikan ke repo).

### Prasyarat 3: Konfigurasi Google Cloud Console
Tambahkan URL Callback resmi pada **Authorized redirect URIs** di Google Cloud Console:
- Staging: `https://<staging-domain>.vercel.app/api/auth/google/callback`
- Production: `https://ptvpro.com/api/auth/google/callback`
- Local dev: `http://localhost:5173/api/auth/google/callback`

---

## 4. KESIMPULAN & REKOMENDASI

Kode implementasi Direct Google OAuth Vercel telah memenuhi seluruh standar keamanan tinggi:
- **Kriptografi:** RS256 JWKS signature verification, SHA-256 PKCE, HMAC-SHA256 signed state, dan cryptographic nonce.
- **Isolasi Database:** Strict Fail-Closed (tidak ada kebocoran mock ke staging/prod).
- **Integritas Sesi:** HttpOnly Secure cookie dengan verifikasi keaktifan akun secara langsung (`verifyAccountStatusLive`).
- **Routing:** Rewrite Vercel melindungi `/api/*` dari SPA routing `index.html`.

Status saat ini adalah **BLOCKED (PENDING STAGING PHASE 0B SQL DEPLOYMENT)** karena database staging PostgreSQL belum menjalankan migrasi kolom `google_sub`. Sistem siap dialihkan ke pengujian live segera setelah Operator Roup mengeksekusi DDL Phase 0B di database Supabase staging.

---
**FINAL STATUS:**  
`DIRECT AUTH SECURITY REVIEW — WAITING FOR OPERATOR VALIDATION`
