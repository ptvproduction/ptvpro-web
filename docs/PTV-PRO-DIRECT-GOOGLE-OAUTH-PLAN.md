# PTV PRO — DIRECT GOOGLE OAUTH ARCHITECTURE & IMPLEMENTATION PLAN
## Website-Native Authentication via Vercel Serverless Functions (`/api/auth/*`)

**Dokumen Resmi Arsitektur & Rencana Implementasi**  
**Repository:** `c:\Users\zidna\ptvpro`  
**Production Domain:** `https://ptvpro.com`  
**Login Route:** `/hub/login` (Kebijakan Clean Login URL tanpa query string)  
**Target Backend:** Vercel Serverless Functions (`/api/auth/*`)  
**Status Gate:** `DIRECT GOOGLE OAUTH ARCHITECTURE REVIEW — WAITING FOR OPERATOR APPROVAL IF BACKEND CHANGES REQUIRED`  
**Tanggal:** 17 Oktober 2026  
**Operator:** Roup  
**AI Agent:** Antigravity (Gemini 3.8 Flash)

---

## 1. Executive Summary & Operator Directive

Sesuai arahan eksplisit Operator PTVPRO:
1. **Peniadaan Supabase Auth:** PTV Hub tidak menggunakan Supabase Auth (GoTrue), `supabase.auth.signInWithOAuth`, callback Supabase (`/auth/v1/callback`), session provider Supabase, maupun Supabase JWT sebagai bukti login website.
2. **Autentikasi Native Milik Website:** Tombol "Lanjutkan dengan Google" pada `/hub/login` menggunakan Google OAuth Authorization Code Flow secara langsung melalui backend website PTVPRO.
3. **Backend Target Vercel Serverless:** Mengingat PTVPRO adalah aplikasi React yang di-deploy via **Vercel**, backend autentikasi diprioritaskan menggunakan **Vercel Serverless Functions** pada rute `/api/auth/*`.
4. **Isolasi Rahasia Keras:** `GOOGLE_CLIENT_SECRET` dan kredensial database tingkat tinggi dilarang keras berada di browser/React client. Seluruh code exchange dan token validation wajib terjadi server-side.
5. **Keamanan Sesi Berbasis Cookie:** Sesi pengguna menggunakan cookie `HttpOnly`, `Secure` (HTTPS), `SameSite=Lax`, dan `Path=/`. Dilarang menyimpan session token sensitif di `localStorage`.
6. **Integritas Identitas & RBAC:** Akun tidak boleh dibuat otomatis (no auto-register) atau ditautkan otomatis hanya karena alamat email sama. Autentikasi Google wajib divalidasi terhadap Google subject (`sub`) resmi yang sudah ditautkan oleh admin, status akun `active`, dan capability `hub.access`.
7. **Clean Login URL:** URL login tetap bersih di `/hub/login` tanpa query parameter (`?redirect=...`).

---

## 2. Audit Arsitektur Existing (Baseline Repository)

Berdasarkan audit menyeluruh terhadap kode aktual:

### 2.1 Frontend & Bundler
- **Stack:** React 18.3.1 + TypeScript 5.7.2 + Vite 6.0.3 SPA.
- **Routing:** `react-router-dom` v6.28.0.
  - `/hub/login`: [`LoginPage.tsx`](file:///c:/Users/zidna/ptvpro/src/app/router/LoginPage.tsx) dengan Clean URL guard (otomatis membersihkan `location.search` dan memindahkan state ke memory `location.state` / `sessionStorage`).
  - `/hub/auth/callback`: [`AuthCallbackPage.tsx`](file:///c:/Users/zidna/ptvpro/src/app/router/AuthCallbackPage.tsx) (saat ini menangani PKCE exchange Supabase).
  - Protected Routes: [`ProtectedRoute.tsx`](file:///c:/Users/zidna/ptvpro/src/app/router/ProtectedRoute.tsx) memeriksa `session`, `user.status_akun === 'active'`, dan `hasCapability(user, requiredCapability)`.
- **State Management:** Zustand (`useSessionStore` di [`src/core/session/sessionStore.ts`](file:///c:/Users/zidna/ptvpro/src/core/session/sessionStore.ts)).

### 2.2 Backend & Hosting Reality
- **Kondisi Direktori:** Belum ada direktori `/api` maupun file `vercel.json` di root repository.
- **Deployment Model:** PTVPRO saat ini di-deploy sebagai static SPA di Vercel, yang secara default menyajikan bundle `dist/`.
- **Legacy Reference:** Direktori `legacy/` berisi WordPress PHP monolitik (`ptv-dashboard-data-bridge.php`, `page-dasbor.php`, dll.) yang beroperasi pada domain lama `progresiftv.id` dan bukan backend aktif di Vercel.

### 2.3 Database & Supabase Adapter State
- **Staging Database:** Supabase Cloud PostgreSQL project `swadgljnyelsjstqqxbm`.
- **Akses Klien:** [`src/core/supabase/client.ts`](file:///c:/Users/zidna/ptvpro/src/core/supabase/client.ts) menginisialisasi `@supabase/supabase-js` menggunakan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
- **Layanan Data Aktif:** Modul Inventaris (`inventarisService.ts`) mengeksekusi kueri tabel `item_inventaris` dan RPC langsung melalui `getSupabaseClient()`. Modul-modul lain (Kru, Acara, Kalender, Keuangan, Surat, Haul, Broadcast) saat ini menggunakan state in-memory/store reaktif terisolasi yang siap disambungkan ke database.

---

## 3. Backend yang Tersedia vs Kebutuhan Baru

| Komponen | Status Saat Ini | Kebutuhan Direct Google OAuth | Kesenjangan (Gap) |
| :--- | :--- | :--- | :--- |
| **Backend Runtime** | Client SPA (Vite) | Vercel Serverless Functions (Node.js runtime) | Perlu membuat folder `/api/auth/` di root proyek |
| **Google Client Secret** | Tidak ada di repo (Aman) | Tersimpan secara aman di Vercel Environment Variables (`GOOGLE_CLIENT_SECRET`) | Dilarang masuk ke `import.meta.env` / Vite |
| **OAuth Flow** | Supabase GoTrue Auth | Direct Google Authorization Code Flow (Backend callback) | Endpoint `/api/auth/google/login` & `/api/auth/google/callback` |
| **Session Mechanism** | Memory / LocalStorage | `HttpOnly`, `Secure`, `SameSite=Lax` Cookie | Endpoint `/api/auth/session` & `/api/auth/logout` |
| **Account Linking** | `user_account.auth_user_id` (Supabase UID) | `auth_credentials.oauth_subject_id` (Google `sub`) | Penautan Google `sub` permanen ke `user_account` |
| **Database Gateway** | Client-side `@supabase/supabase-js` via Anon Key | Serverless Backend via PostgreSQL pool / Supabase Service Role | Serverless handler memvalidasi kredensial dan hak akses |

---

## 4. Rekomendasi Arsitektur Final: Vercel Serverless Native Auth

Arsitektur yang direkomendasikan adalah **Native Backend-for-Frontend (BFF) Auth Endpoints** yang berjalan pada infrastruktur serverless Vercel:

```
[ Browser / User ]
       │
       │  1. Klik "Lanjutkan dengan Google" di /hub/login
       ▼
[ GET /api/auth/google/login ] (Vercel Function)
       │  - Generate CSRF 'state' token (HMAC-signed) & PKCE code_verifier
       │  - Simpan transient state di HttpOnly cookie (ptv_oauth_state)
       │  - 302 Redirect ke Google Accounts OAuth Consent
       ▼
[ Google Accounts Consent Screen ]
       │
       │  2. Pengguna menyetujui login Google
       ▼
[ GET /api/auth/google/callback ] (Vercel Function)
       │  - Verifikasi CSRF 'state' vs cookie
       │  - Exchange 'code' + 'code_verifier' -> Google Token Endpoint
       │  - Validasi ID Token (iss, aud, exp, signature Google certs)
       │  - Ekstrak Google Subject ID ('sub')
       │
       │  3. Query Database (Supabase PostgreSQL via Service Role / Direct)
       ▼
[ PostgreSQL: public.auth_credentials & public.user_account ]
       │  - SELECT ua.*, ac.* FROM user_account ua
       │    JOIN auth_credentials ac ON ac.account_id = ua.id
       │    WHERE ac.oauth_provider = 'google' AND ac.oauth_subject_id = $google_sub;
       │  - Verifikasi: status_akun == 'active'
       │  - Verifikasi: capability 'hub.access' granted
       │
       │  4. Jika Valid:
       │  - Minting Website Session Token (Signed JWT / Encrypted Session)
       │  - Set Cookie: ptv_hub_session (HttpOnly, Secure, SameSite=Lax, Path=/)
       │  - 302 Redirect ke /hub (atau intended internal destination)
       │
       │  5. Jika Gagal (Unlinked / Inactive / No Access):
       │  - Set transient error flash cookie
       │  - 302 Redirect ke /hub/login (Clean URL)
       ▼
[ Browser / SPA ]
       │  6. SPA Bootstrapping: GET /api/auth/session
       │  - Serverless function membaca cookie ptv_hub_session
       │  - Mengembalikan AuthUser & Effective Capabilities ke Zustand Store
```

---

## 5. Spesifikasi Alur OAuth & Endpoint Vercel

### 5.1 Endpoint Specification

#### 1. `GET /api/auth/google/login`
- **Tujuan:** Menginisiasi Authorization Code Flow.
- **Logika:**
  - Menerima parameter opsional `returnTo` (wajib divalidasi via `getSafeInternalDestination` agar anti-open-redirect).
  - Membuat string acak kriptografis `state` (32 bytes hex) yang di-HMAC menggunakan `AUTH_SECRET`.
  - Membuat PKCE `code_verifier` dan `code_challenge` (SHA-256).
  - Menyimpan `state`, `code_verifier`, dan `returnTo` dalam cookie terenkripsi sementara:  
    `Set-Cookie: ptv_oauth_state=...; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=300`.
  - Mengarahkan browser (302) ke URL resmi Google:
    ```text
    https://accounts.google.com/o/oauth2/v2/auth?
      client_id=${GOOGLE_CLIENT_ID}&
      redirect_uri=https%3A%2F%2Fptvpro.com%2Fapi%2Fauth%2Fgoogle%2Fcallback&
      response_type=code&
      scope=openid%20email%20profile&
      state=${state}&
      code_challenge=${codeChallenge}&
      code_challenge_method=S256&
      prompt=select_account&
      access_type=offline
    ```

#### 2. `GET /api/auth/google/callback`
- **Tujuan:** Menerima authorization code dari Google dan menyelesaikan autentikasi.
- **Logika:**
  - Membaca `code`, `state`, dan `error` dari URL query.
  - Membaca dan memvalidasi cookie `ptv_oauth_state`. Jika `state` mismatch atau cookie kadaluarsa $\rightarrow$ tolak dengan error CSRF (`403 Forbidden`).
  - Menghapus cookie `ptv_oauth_state`.
  - Jika ada `error=access_denied` dari Google $\rightarrow$ redirect ke `/hub/login` dengan status pesan pembatalan.
  - Melakukan `POST` ke `https://oauth2.googleapis.com/token`:
    - `client_id`, `client_secret` (hanya ada di server).
    - `code`, `code_verifier`.
    - `grant_type=authorization_code`.
    - `redirect_uri=https://ptvpro.com/api/auth/google/callback`.
  - Memvalidasi ID Token yang diterima:
    - Verifikasi signature terhadap Google Public Keys (`https://www.googleapis.com/oauth2/v3/certs`).
    - Verifikasi `aud === GOOGLE_CLIENT_ID`.
    - Verifikasi `iss === 'accounts.google.com'` atau `'https://accounts.google.com'`.
    - Verifikasi `exp > current_timestamp`.
  - Mengekstrak identitas Google: `sub` (Google User ID permanen), `email`, `name`, `picture`.

#### 3. `GET /api/auth/session`
- **Tujuan:** Memberikan data sesi aktif ke SPA saat bootstrap / refresh browser.
- **Logika:**
  - Membaca cookie `ptv_hub_session`.
  - Memverifikasi tanda tangan JWT sesi menggunakan `AUTH_SECRET`.
  - Memeriksa epoch `tokens_valid_after` dari database untuk mendeteksi pembatalan sesi (revocation).
  - Mengembalikan payload JSON:
    ```json
    {
      "authenticated": true,
      "user": {
        "id": "uuid",
        "ptv_id": "PTV-025",
        "full_name": "Zidna Santri",
        "username": "crew",
        "avatar_url": "https://...",
        "organization": "PTV Studio",
        "division": "Technical",
        "position": "Crew Operator",
        "status_akun": "active",
        "status_organisasi": "active",
        "assigned_profiles": ["crew"],
        "capabilities": ["hub.access", "inventory.view", "loans.checkout", ...]
      }
    }
    ```
  - Jika tidak ada cookie atau sesi tidak valid, mengembalikan: `{"authenticated": false, "user": null}` dengan status HTTP 200.

#### 4. `POST /api/auth/logout`
- **Tujuan:** Mengakhiri sesi secara aman.
- **Logika:**
  - Menghapus cookie `ptv_hub_session`:  
    `Set-Cookie: ptv_hub_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`.
  - Mencatat audit log aktivitas keluar sesi jika sesi valid.
  - Mengembalikan JSON: `{"success": true}`.

---

## 6. Strategi Sesi (Session Strategy)

### 6.1 Karakteristik Cookie Sesi
Cookie sesi website PTV Hub dikonfigurasi dengan standar keamanan ketat:
- **Nama Cookie:** `ptv_hub_session`
- **Flag `HttpOnly`:** `true` (Mencegah serangan XSS mencuri session token; JavaScript browser tidak dapat mengakses cookie ini).
- **Flag `Secure`:** `true` pada production (`https://ptvpro.com`). Pada development lokal (`localhost`), otomatis disesuaikan agar cookie dapat diterima pada HTTP.
- **Flag `SameSite`:** `Lax` (Melindungi dari serangan CSRF cross-origin sambil tetap mengizinkan cookie dikirimkan saat navigasi top-level kembali dari Google OAuth).
- **Path:** `/` (Berlaku untuk seluruh aplikasi).
- **Masa Berlaku:** 7 hari (`Max-Age=604800`) dengan mekanisme sliding expiration saat request sesi aktif.

### 6.2 Token Payload & Signing
Sesi menggunakan compact JSON Web Token (JWT) yang dienkripsi/ditandatangani menggunakan algoritma HMAC-SHA256 (`HS256`) dengan kunci rahasia berkekuatan tinggi (`AUTH_SECRET` minimal 32 karakter acak):
- `sub`: Canonical Identity ID (`canonical_identity.id` / `user_account.id`).
- `ptv_id`: ID Institusional permanen (`PTV-xxx`).
- `iat`: Timestamp penerbitan.
- `exp`: Timestamp kedaluwarsa.
- `ver`: Versi token revocation epoch.

---

## 7. Kompatibilitas Database & Row Level Security (RLS)

Ini adalah aspek paling krusial dalam migrasi dari Supabase Auth ke Website-Native Authentication:

### 7.1 Realitas Dependency RLS Saat Ini
Pada skema migrasi database PostgreSQL staging ([`PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql)):
- Fungsi `public.jwt_custom_claims()` dan `public.has_capability()` memeriksa:
  ```sql
  WHERE ua.auth_user_id = auth.uid()
  ```
- Di Supabase, `auth.uid()` adalah fungsi internal yang membaca klaim `sub` dari JWT yang didekode oleh PostgREST.

### 7.2 Dampak Jika Supabase Auth Ditiadakan
Jika React frontend memanggil Supabase PostgREST langsung menggunakan `VITE_SUPABASE_ANON_KEY` tanpa header `Authorization: Bearer <Supabase-JWT>`, maka PostgREST menganggap request tersebut sebagai role `anon`. Seluruh policy RLS yang membutuhkan `auth.uid()` atau capability akan **menolak akses**.

### 7.3 Tiga Opsi Solusi Jembatan Database

#### OPSI A: Supabase-Compatible Custom JWT Minting (DIREKOMENDASIKAN)
* **Mekanisme:**
  1. Backend Vercel Serverless Function memverifikasi Google OAuth dan mencocokkan akun di `user_account`.
  2. Backend Vercel memiliki akses ke environment variable `SUPABASE_JWT_SECRET` (rahasia penandatanganan JWT proyek Supabase yang tersedia di Supabase Project Settings -> API -> JWT Secret).
  3. Backend Vercel menandatangani token JWT yang valid untuk Supabase PostgREST dengan klaim:
     ```json
     {
       "aud": "authenticated",
       "role": "authenticated",
       "sub": "user_account.auth_user_id_atau_account_id",
       "exp": 1729200000,
       "app_metadata": { "provider": "google" }
     }
     ```
  4. Token ini dapat dikembalikan ke client via endpoint `/api/auth/session` untuk digunakan oleh `@supabase/supabase-js` (`supabase.auth.setSession` atau injection token), ATAU dikelola via cookie terpisah.
* **Keuntungan:**
  - **Zero Database Migration:** 100% kebijakan RLS dan fungsi RPC PostgreSQL (`has_capability`, `rpc_create_inventaris`, dll.) tetap bekerja tanpa perubahan skema maupun downtime.
  - Supabase GoTrue tetap sepenuhnya dilewati untuk alur login Google.
  - Integritas data dan izin berbasis baris tetap ditegakkan di level database engine.

#### OPSI B: Full Backend-For-Frontend (BFF Proxy)
* **Mekanisme:** Frontend tidak lagi memanggil Supabase client secara langsung sama sekali. Semua kueri dialihkan ke `/api/inventaris/*`, `/api/kru/*`, dst. Backend Vercel mengeksekusi kueri ke Supabase menggunakan `SUPABASE_SERVICE_ROLE_KEY` atau direct connection pool.
* **Kelemahan:** Membutuhkan refactoring besar pada seluruh modul frontend yang sudah selesai dibangun dan diuji, memakan waktu lama, serta meningkatkan latency request.

#### OPSI C: Penggantian `auth.uid()` dengan Header Kustom / App Session Context
* **Mekanisme:** Mengubah seluruh fungsi DDL di database untuk membaca context session kustom.
* **Kelemahan:** Mengubah skema database secara masif dan berisiko merusak kompatibilitas modul lain.

> [!IMPORTANT]
> **Rekomendasi Arsitektur:** Gunakan **Opsi A**. Backend Vercel Serverless Function bertindak sebagai otoritas autentikasi independen, menangani alur Google OAuth, memvalidasi identitas kru di database, mengelola HttpOnly session cookie untuk website, dan menyediakan signed database-access token yang kompatibel dengan RLS PostgreSQL Supabase.

---

## 8. Canonical Identity & RBAC Enforcement

Untuk mematuhi prinsip **Fail-Closed** dan mencegah eskalasi hak akses:

```
                      [ Google OAuth Callback ]
                                 │
                     ( sub, email, name, picture )
                                 │
                                 ▼
         [ Cari di auth_credentials berdasarkan oauth_subject_id ]
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
        [ DITEMUKAN ]                        [ TIDAK DITEMUKAN ]
              │                                     │
              ▼                                     ▼
     [ Periksa status_akun ]              [ REJECT FAIL-CLOSED ]
              │                          "Akun Google belum tertaut.
       ┌──────┴──────┐                    Hubungi Administrator PTV."
       ▼             ▼
   ['active']   ['inactive']
       │             │
       │             ▼
       │     [ REJECT FAIL-CLOSED ]
       │     "Akun nonaktif. Hubungi
       │      Eksekutif PTV."
       ▼
 [ Evaluasi Capabilities ]
       │
       ├─ Hub.access? ────► TIDAK ──► [ REJECT FAIL-CLOSED ]
       │                              "Akun tidak memiliki izin hub.access."
       │
       └─ YA ─────────────► [ BUAT SESI WEBSITE & SET COOKIE ]
                            Redirect ke /hub
```

### Aturan Ketat Keamanan:
1. **Dilarang Auto-Register:** Pengguna baru yang login dengan akun Google tidak boleh otomatis dibuatkan akun kru di database.
2. **Dilarang Menautkan Berdasarkan Email Saja:** Penautan akun (`linking`) antara akun Google dan `user_account` wajib dilakukan melalui prosedur administratif resmi dengan menyimpan Google `sub` di tabel `auth_credentials`.
3. **Pencabutan Akses Real-Time:** Jika akun dinonaktifkan oleh Administrator (`status_akun = 'inactive'`), endpoint `/api/auth/session` akan langsung menolak sesi pada panggilan berikutnya meskipun cookie belum kadaluarsa.

---

## 9. Perubahan Kode yang Dibutuhkan (Required Code Changes)

Jika disetujui operator, perubahan terkonsentrasi pada modul berikut:

### 9.1 Backend Vercel Serverless Functions (File Baru)
- `api/auth/google/login.ts`: Inisiasi OAuth code flow & CSRF cookie.
- `api/auth/google/callback.ts`: Code exchange, ID token validation, database identity lookup, HttpOnly session cookie issuing.
- `api/auth/session.ts`: Verifikasi cookie sesi dan penyajian data profil pengguna ke SPA.
- `api/auth/logout.ts`: Penghapusan cookie sesi dan audit log logout.
- `api/_lib/db.ts`: Koneksi database server-side aman menggunakan Supabase admin client / pg connection pool (hanya di server, tidak terekspos ke bundle client).
- `api/_lib/jwt.ts`: Utilitas signing dan verification session JWT.

### 9.2 Frontend Client Adapter
- [`src/core/auth/authService.ts`](file:///c:/Users/zidna/ptvpro/src/core/auth/authService.ts):
  - Mengganti `SupabaseAuthService` dengan `NativeWebsiteAuthService`.
  - Metode `loginWithOAuth`: Mengarahkan browser langsung ke `/api/auth/google/login`.
  - Metode `getCurrentSession`: Memanggil `fetch('/api/auth/session', { credentials: 'include' })`.
  - Metode `logout`: Memanggil `fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })`.
- [`src/app/router/LoginPage.tsx`](file:///c:/Users/zidna/ptvpro/src/app/router/LoginPage.tsx):
  - Tombol "Lanjutkan dengan Google" memanggil `loginWithOAuth({ provider: 'google' })` tanpa memanggil SDK Supabase Auth di client.
  - Menjaga URL tetap bersih `/hub/login` tanpa query parameter.
- [`src/app/router/AuthCallbackPage.tsx`](file:///c:/Users/zidna/ptvpro/src/app/router/AuthCallbackPage.tsx):
  - Di-deprecate atau dialihkan karena proses callback OAuth ditangani 100% oleh backend Vercel (`/api/auth/google/callback`) sebelum redirect ke `/hub`.
- [`src/app/router/ProtectedRoute.tsx`](file:///c:/Users/zidna/ptvpro/src/app/router/ProtectedRoute.tsx):
  - Memverifikasi sesi dari `useSessionStore` yang diisi oleh `NativeWebsiteAuthService`.
- `vercel.json` (File Baru):
  - Menambahkan routing dan rewrites jika diperlukan, memastikan `/api/*` diarahkan ke Serverless Functions dan rute lainnya diarahkan ke `index.html`.

---

## 10. Konfigurasi Google Cloud Console

Operator perlu mengonfigurasi Google Cloud Console project:

1. **OAuth Consent Screen:**
   - **App Name:** `PTV PRO / PTV HUB`
   - **User Support Email:** `admin@ptvpro.com` / email pengembang
   - **Scopes:** `openid`, `email`, `profile`
   - **Publishing Status:** In Production (atau Testing dengan menambahkan email kru uji coba)
2. **OAuth 2.0 Web Client Credentials:**
   - **Application Type:** Web application
   - **Name:** `PTVPRO Web Production`
   - **Authorized JavaScript Origins:**
     - `https://ptvpro.com`
     - `http://localhost:5174` (Staging local runtime)
     - `http://localhost:5173` (Dev local runtime)
   - **Authorized Redirect URIs (Milik Backend PTVPRO):**
     - `https://ptvpro.com/api/auth/google/callback`
     - `http://localhost:5174/api/auth/google/callback`
     - `http://localhost:3000/api/auth/google/callback` (jika menggunakan `vercel dev`)
3. **Environment Variables di Vercel Dashboard:**
   - `GOOGLE_CLIENT_ID`: `xxxx.apps.googleusercontent.com`
   - `GOOGLE_CLIENT_SECRET`: `GOCSPX-xxxx` (Server-Only, hindari prefix `VITE_`)
   - `AUTH_SECRET`: String acak 64 karakter (untuk menandatangani cookie sesi dan state CSRF)
   - `SUPABASE_SERVICE_ROLE_KEY`: Kunci service role Supabase (Server-Only)
   - `SUPABASE_JWT_SECRET`: Kunci rahasia JWT Supabase (Server-Only)

---

## 11. Manajemen Risiko Keamanan (Security Risks & Mitigations)

| Risiko Keamanan | Dampak | Mitigasi yang Diterapkan |
| :--- | :--- | :--- |
| **Pencurian Token via XSS** | Pembajakan Sesi | Sesi disimpan dalam cookie `HttpOnly`. JavaScript di browser tidak memiliki akses baca ke cookie sesi. |
| **CSRF Attack pada OAuth Callback** | Penautan Akun Palsu | Parameter `state` acak kriptografis diikat dengan HMAC dan dicocokkan terhadap cookie `ptv_oauth_state` (SameSite=Lax). |
| **Open Redirect Vulnerability** | Phishing via URL Login | Preservasi URL tujuan internal disanitasi ketat menggunakan `getSafeInternalDestination()` (hanya rute berawalan `/hub` tanpa `//` atau skema URL luar). |
| **Kebocoran Client Secret** | Peniruan Identitas Aplikasi | `GOOGLE_CLIENT_SECRET` disimpan eksklusif pada environment Vercel server-side dan tidak pernah di-bundle ke file JavaScript client. |
| **Email Spoofing / Akun Google Liar** | Akses Tidak Sah | Identifikasi pengguna mengacu pada Google subject ID (`sub`) permanen yang telah ditautkan oleh admin, bukan sekadar kesamaan string alamat email. |
| **Stale JWT / Akun Disuspend** | Mantan Kru Masih Bisa Mengakses | Endpoint `/api/auth/session` memvalidasi status akun secara berkala ke database. Akun `inactive` langsung ditolak seketika. |

---

## 12. Tahapan Implementasi (Implementation Phases)

| Fase | Deskripsi | Status Gate |
| :--- | :--- | :--- |
| **Fase 1: Architecture Review & Plan** | Audit menyeluruh, perumusan spesifikasi Vercel functions, analisis dampak RLS database, dan penyusunan dokumen `PTV-PRO-DIRECT-GOOGLE-OAUTH-PLAN.md`. | **SELESAI (Menunggu Persetujuan Operator)** |
| **Fase 2: Scaffold Vercel Backend Functions** | Pembuatan direktori `/api/auth/*`, endpoint `login`, `callback`, `session`, `logout`, utilitas database server-side, dan verifikasi `vercel.json`. | *Menunggu Keputusan Fase 1* |
| **Fase 3: Account Linking Schema Alignment** | Pembuatan migration SQL untuk memastikan kolom `oauth_subject_id` dan penautan Google ID kru uji coba tersedia di tabel database staging. | *Menunggu Keputusan Fase 1* |
| **Fase 4: Client Auth Adapter Switch** | Mengganti `SupabaseAuthService` dengan `NativeWebsiteAuthService` di frontend, memperbarui `LoginPage.tsx`, dan penyesuaian rute callback. | *Menunggu Keputusan Fase 1* |
| **Fase 5: Full Quality Verification** | Eksekusi lengkap test suite (`npm test`), static typecheck (`npm run typecheck`), linting (`npm run lint`), dan kompilasi production build (`npm run build`). | *Menunggu Keputusan Fase 1* |

---

## 13. Keputusan & Gate Eksekusi (Execution Gate)

Sesuai aturan kerja pada Section 11 petunjuk tugas:
> *"Jika backend belum tersedia atau perubahan membutuhkan keputusan arsitektur, berhenti pada tahap rencana dan minta persetujuan operator. Jangan membuat backend baru, mengganti skema autentikasi database, atau mengubah production secara sepihak."*

### Pertanyaan Keputusan untuk Operator Roup:
1. **Persetujuan Pembentukan Folder `/api/auth/*`:** Apakah Operator menyetujui penambahan Vercel Serverless Functions pada direktori `/api/auth/` di repository ini?
2. **Pilihan Strategi Kompatibilitas Database RLS:** Apakah Operator menyetujui **Opsi A** (Vercel Serverless Function mencetak scoped Supabase-compatible JWT menggunakan `SUPABASE_JWT_SECRET` agar seluruh modul inventaris/layanan database klien tetap bekerja 100% tanpa mengubah RLS)?
3. **Ketersediaan Kredensial Google Cloud:** Apakah Operator telah memiliki Google OAuth Client ID & Secret untuk didaftarkan pada environment server Vercel?

**STATUS SAAT INI:**  
`DIRECT GOOGLE OAUTH ARCHITECTURE REVIEW — WAITING FOR OPERATOR APPROVAL IF BACKEND CHANGES REQUIRED`
