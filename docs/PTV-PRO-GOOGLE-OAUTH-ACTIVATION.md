# PTV PRO — GOOGLE OAUTH ACTIVATION & ACCOUNT LINKING GUIDE
## Supabase Auth Integration, Clean Login URL, & Fail-Closed RBAC Architecture

**Dokumen Resmi Integrasi & Serah Terima Konfigurasi**  
**Repository:** `ptvpro`  
**Modul:** PTV Hub Authentication & Identity Boundary  
**Rute Login Canonical:** `/hub/login`  
**Rute Callback OAuth:** `/hub/auth/callback`  
**Staging Project Ref:** `swadgljnyelsjstqqxbm` (Region: `ap-southeast-1`)  
**Status Implementasi:** `GOOGLE OAUTH LOCAL INTEGRATION READY — WAITING FOR STAGING CONFIGURATION & OPERATOR VALIDATION`

---

## 1. Existing Auth Architecture & Principles

Repositori `ptvpro` menggunakan arsitektur autentikasi ganda yang terisolasi dengan batas tegas:
1. **Mode Development / Mock (`VITE_AUTH_BACKEND=mock`):**
   - Menggunakan `LocalMockAuthService` berbasis `localStorage` browser dan fixture akun terisolasi (`LOCAL_DEV_MOCK_USERS`).
   - Tidak melakukan panggilan jaringan eksternal.
   - Menolak simulasi Google OAuth palsu secara fail-closed (tidak memberikan akses Hub hanya dengan klik tombol tanpa backend riil).
2. **Mode Staging Cloud (`VITE_AUTH_BACKEND=supabase`):**
   - Menggunakan `SupabaseAuthService` yang berkomunikasi langsung dengan proyek Supabase staging `swadgljnyelsjstqqxbm`.
   - **Resolusi Identitas Murni Database:** Sesi tidak memperoleh role/profile dari client-side claims atau UID whitelist, melainkan dievaluasi secara dinamis di PostgreSQL melalui fungsi RPC `public.jwt_custom_claims()` (`SECURITY DEFINER`) pada tabel `public.user_account` (`WHERE ua.auth_user_id = auth.uid()`).
   - **Prinsip Fail-Closed:** Jika akun Google berhasil diautentikasi oleh GoTrue tetapi belum ditautkan ke baris `public.user_account`, status akun bukan `active`, atau tidak memiliki capability `hub.access`, sesi langsung dibatalkan (`signOut`) dan ditolak masuk.

---

## 2. Implemented Code Changes

Berikut adalah berkas-berkas yang dimodifikasi dan ditambahkan pada implementasi ini:

| File | Tindakan | Rincian Perubahan |
| :--- | :--- | :--- |
| [`src/core/auth/types.ts`](file:///c:/Users/zidna/ptvpro/src/core/auth/types.ts) | Modified | Menambahkan antarmuka `OAuthSignInOptions` (`provider: 'google'`, `redirectTo?: string`). |
| [`src/core/auth/destination.ts`](file:///c:/Users/zidna/ptvpro/src/core/auth/destination.ts) | Created | Utilitas sanitasi redirect dan penyimpanan tujuan sementara (`storeIntendedDestination`, `getAndClearIntendedDestination`, `getSafeInternalDestination`) dengan pencegahan open-redirect dan anti-redirect loop. |
| [`src/core/auth/index.ts`](file:///c:/Users/zidna/ptvpro/src/core/auth/index.ts) | Modified | Mengekspor modul utilitas `destination.ts`. |
| [`src/core/auth/authService.ts`](file:///c:/Users/zidna/ptvpro/src/core/auth/authService.ts) | Modified | (1) Menambahkan metode `loginWithOAuth` pada `IAuthService`; (2) Implementasi `LocalMockAuthService.loginWithOAuth` (penolakan jujur tanpa simulasi palsu); (3) Implementasi `SupabaseAuthService.loginWithOAuth` via `supabase.auth.signInWithOAuth`; (4) Menjadikan `resolveDatabaseSession` sebagai metode publik dengan error reporting terstandarisasi. |
| [`src/core/session/sessionStore.ts`](file:///c:/Users/zidna/ptvpro/src/core/session/sessionStore.ts) | Modified | Menambahkan aksi reaktif `loginWithOAuth` pada Zustand `useSessionStore` lengkap dengan error state dan loading state. |
| [`src/app/router/ProtectedRoute.tsx`](file:///c:/Users/zidna/ptvpro/src/app/router/ProtectedRoute.tsx) | Modified | **Clean Login URL:** Menghapus parameter `?redirect=...` pada saat unauthenticated redirect; menyimpan return target ke session storage dan me-redirect bersih ke `/hub/login` dengan `state: { from: location }`. |
| [`src/app/router/LoginPage.tsx`](file:///c:/Users/zidna/ptvpro/src/app/router/LoginPage.tsx) | Modified | (1) Menghubungkan tombol "Lanjutkan dengan Google" ke `loginWithOAuth`; (2) Menambahkan loading state (`isGoogleLoading`) dan disabled protection (mencegah double submit); (3) Menampilkan error konfigurasi yang jujur jika Supabase belum aktif; (4) Menjaga URL tetap bersih `/hub/login`. |
| [`src/styles/login.css`](file:///c:/Users/zidna/ptvpro/src/styles/login.css) | Modified | Menambahkan styling `.lk-btn-google:disabled`, animasi keyframes `lk-spin`, dan spinner mikro `.lk-spinner`. |
| [`src/app/router/AuthCallbackPage.tsx`](file:///c:/Users/zidna/ptvpro/src/app/router/AuthCallbackPage.tsx) | Created | Halaman pemroses callback `/hub/auth/callback`: mengekstrak parameter error/code, menukarkan PKCE token, memverifikasi akun di database via RPC, memastikan capability `hub.access`, dan me-redirect ke tujuan internal aman. |
| [`src/app/router/index.tsx`](file:///c:/Users/zidna/ptvpro/src/app/router/index.tsx) | Modified | Mendaftarkan rute publik `/hub/auth/callback` di luar auth guard. |
| [`tests/auth/googleOAuthIntegration.test.ts`](file:///c:/Users/zidna/ptvpro/tests/auth/googleOAuthIntegration.test.ts) | Created | Suite pengujian komprehensif mencakup sanitasi destination, anti-loop, inisiasi OAuth, fail-closed unlinked account, penolakan akun inactive, dan pemeriksaan capability. |
| [`tests/hub/hubLoginRouting.test.tsx`](file:///c:/Users/zidna/ptvpro/tests/hub/hubLoginRouting.test.tsx) | Modified | Menyelaraskan pengujian terhadap spesifikasi Clean Login URL (tanpa `?redirect=...`) dan keberadaan rute `/hub/auth/callback`. |

---

## 3. Google Cloud Console Configuration Steps

Langkah-langkah yang wajib dijalankan oleh Operator pada [Google Cloud Console](https://console.cloud.google.com/):

### Langkah 1: OAuth Consent Screen (Layar Persetujuan OAuth)
1. Buka **APIs & Services → OAuth consent screen**.
2. Pilih User Type:
   - **Internal:** Jika organisasi menggunakan Google Workspace institusional.
   - **External:** Jika menggunakan akun Gmail biasa untuk pengujian staging (pilih status *Testing*).
3. Isi informasi aplikasi:
   - **App name:** `PTV PRO` atau `Progresif TV Super App (Staging)`
   - **User support email:** Email admin/developer penanggung jawab.
   - **Developer contact information:** Email developer.
4. Pada tab **Scopes**, pastikan minimal scope berikut terpilih:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
5. Jika memilih status *Testing*, masuk ke tab **Test users** dan tambahkan alamat email Google yang akan digunakan untuk pengujian login kru staging.
6. Simpan konfigurasi (*Save and Continue*).

### Langkah 2: Membuat Kredensial OAuth Client ID
1. Buka **APIs & Services → Credentials**.
2. Klik **+ CREATE CREDENTIALS** → pilih **OAuth client ID**.
3. Pilih **Application type:** `Web application`.
4. Isi **Name:** `PTV PRO Staging Web Client`.
5. **Authorized JavaScript origins:**
   - Tambahkan: `http://localhost:5174` (port staging runtime lokal)
   - Tambahkan: `http://localhost:5173` (port dev lokal, jika relevan)
   - *(Catatan: Domain staging cloud publik ditambahkan saat deployment server rilis).*
6. **Authorized redirect URIs (SANGAT KRUSIAL):**
   - Masukkan callback Supabase staging:  
     `https://swadgljnyelsjstqqxbm.supabase.co/auth/v1/callback`  
     *(Perhatian: URI ini HARUS mengarah ke Supabase, BUKAN ke localhost!).*
7. Klik **CREATE**.
8. Salin **Client ID** dan **Client Secret** yang dihasilkan.  
   *(PERINGATAN: Client Secret HANYA dimasukkan ke Supabase Dashboard, DILARANG KERAS menyimpannya di file `.env` frontend atau meng-commit ke git!).*

---

## 4. Supabase Dashboard Configuration Steps

Langkah-langkah yang wajib dijalankan oleh Operator pada [Supabase Dashboard](https://supabase.com/dashboard/project/swadgljnyelsjstqqxbm):

### Langkah 1: Mengaktifkan Google Provider
1. Buka proyek staging: `swadgljnyelsjstqqxbm`.
2. Buka menu **Authentication → Providers**.
3. Cari dan klik provider **Google**.
4. Aktifkan toggle **Enable Google provider**.
5. Masukkan kredensial dari Google Cloud Console:
   - **Client ID (for OAuth):** Tempel Client ID Google.
   - **Client Secret (for OAuth):** Tempel Client Secret Google.
6. Klik **Save**.

### Langkah 2: Mengonfigurasi URL Allowlist (Authentication URL Configuration)
1. Buka menu **Authentication → URL Configuration**.
2. **Site URL:**
   - Atur ke `http://localhost:5174` (atau domain staging resmi).
3. **Redirect URLs (Allowlist):**
   - Tambahkan: `http://localhost:5174/hub/auth/callback`
   - Tambahkan wildcard: `http://localhost:5174/**`
   - Tambahkan: `http://localhost:5173/hub/auth/callback` (cadangan dev)
4. Klik **Save**.

---

## 5. Exact Staging Callback URLs Architecture

Alur autentikasi Google OAuth melibatkan 2 callback terpisah yang tidak boleh tertukar:

```
+---------------------------------------------------------------------------------------+
|                                ALUR GOOGLE OAUTH PTV PRO                              |
+---------------------------------------------------------------------------------------+

  [ Pengguna ] 
       │
       ▼ (1) Klik "Lanjutkan dengan Google" pada /hub/login
  [ PTV Hub Frontend (localhost:5174) ]
       │
       ▼ (2) supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: ... })
  [ Google Cloud OAuth 2.0 ]
       │
       ▼ (3) Pengguna menyetujui consent screen di Google
       │
       ▼ (4) Callback 1: Google -> Supabase GoTrue Auth
  [ Supabase Cloud (https://swadgljnyelsjstqqxbm.supabase.co/auth/v1/callback) ]
       │
       ▼ (5) Callback 2: Supabase -> PTV Hub Application Callback (PKCE Code)
  [ PTV Hub Frontend (/hub/auth/callback?code=...) ]
       │
       ▼ (6) Pertukaran kode PKCE & Eksekusi RPC Database public.jwt_custom_claims()
  [ PostgreSQL Database (user_account.auth_user_id & hub.access check) ]
       │
       ├─── Valid & Tertaut ───────────────► Set Session Store & Redirect ke /hub
       │
       └─── Tidak Tertaut / Inactive ──────► Sign Out Supabase & Redirect ke /hub/login
                                             (dengan pesan error edukatif)
```

| Tingkat Callback | Asal | Tujuan | Konfigurasi Lokasi |
| :--- | :--- | :--- | :--- |
| **Callback 1 (OAuth)** | Google Auth Server | `https://swadgljnyelsjstqqxbm.supabase.co/auth/v1/callback` | Google Cloud Console → Authorized redirect URIs |
| **Callback 2 (App)** | Supabase GoTrue | `http://localhost:5174/hub/auth/callback` | Supabase Dashboard → Redirect URLs Allowlist |

---

## 6. Environment Variable Requirements

Frontend PTV PRO beroperasi murni dengan kredensial anonim publik:

```dotenv
# .env.staging
VITE_APP_ENV=staging
EXPECTED_ENVIRONMENT=staging
VITE_APP_TITLE=PTV PRO Super App (Staging)

# Supabase Staging Project (swadgljnyelsjstqqxbm)
VITE_SUPABASE_URL=https://swadgljnyelsjstqqxbm.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# Backend Mode
VITE_AUTH_BACKEND=supabase
VITE_INVENTARIS_BACKEND=supabase
```

> [!IMPORTANT]
> **Aturan Keamanan Secrets:**
> Google Client Secret dan Supabase Service Role Key **TIDAK BOLEH** dituliskan ke dalam berkas `.env` atau `.env.staging` frontend. Kredensial rahasia Google disimpan aman di dalam vault internal Supabase Cloud Auth.

---

## 7. Account Linking Policy & Proposed Admin Workflow

### Aturan Keamanan Account Linking:
1. **Dilarang Self-Service Linking Tanpa Verifikasi:** Sistem tidak boleh secara otomatis menautkan akun Google baru hanya berdasarkan kecocokan string email tanpa otorisasi admin.
2. **Dilarang Auto-Provisioning Kru:** Akun Google pihak luar yang belum terdaftar tidak boleh otomatis dibuatkan record identitas kru (`canonical_identity`) atau diberi akses default.
3. **Fail-Closed Default:** Akun yang tidak memiliki relasi `public.user_account.auth_user_id` akan ditolak dengan pesan:
   `"Akun Supabase ({email}) belum tertaut ke entitas user_account resmi di database. Hubungi Administrator PTV untuk menautkan akun ke identitas kanonikal."`

### Usulan Workflow Admin-Only untuk Penautan Akun Kru (Proposed RPC):
Ketika kru baru pertama kali login dengan Google, Supabase Auth mencatat UID pada tabel `auth.users`. Administrator PTV (dengan capability `crew.permissions.manage`) kemudian menautkan UID tersebut ke entitas akun kru resmi di database melalui SQL atau RPC khusus:

```sql
-- Usulan Fungsi RPC Penautan Akun Google Resmi (Hanya dapat dieksekusi oleh Eksekutif / Admin)
CREATE OR REPLACE FUNCTION public.rpc_link_crew_google_account(
    p_ptv_id TEXT,
    p_google_auth_uid UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
    v_identity_id UUID;
    v_account_id UUID;
BEGIN
    -- 1. Verifikasi bahwa eksekutor memiliki capability pengelolaan kru
    IF NOT public.has_capability('crew.permissions.manage') AND NOT public.has_capability('root.manage') THEN
        RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki wewenang menautkan akun Google kru.';
    END IF;

    -- 2. Cari canonical identity berdasarkan ptv_id
    SELECT id INTO v_identity_id
    FROM public.canonical_identity
    WHERE ptv_id = p_ptv_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Identitas kru dengan PTV-ID % tidak ditemukan.', p_ptv_id;
    END IF;

    -- 3. Update auth_user_id pada user_account
    UPDATE public.user_account
    SET auth_user_id = p_google_auth_uid,
        updated_at = now()
    WHERE identity_id = v_identity_id
    RETURNING id INTO v_account_id;

    RETURN jsonb_build_object(
        'success', true,
        'ptv_id', p_ptv_id,
        'account_id', v_account_id,
        'linked_auth_user_id', p_google_auth_uid
    );
END;
$$;
```

---

## 8. Verification & Quality Gates Results

Seluruh rangkaian validasi kualitas telah dijalankan secara lokal:

| Tahap Verifikasi | Perintah | Status | Hasil |
| :--- | :--- | :--- | :--- |
| **Pengecekan Tipe** | `npm run typecheck` | **PASSED** | 0 error (`tsc --noEmit` bersih). |
| **Linting Kode** | `npm run lint` | **PASSED** | 0 warning, 0 error (`eslint . --max-warnings 0`). |
| **Pengujian Unit** | `npm test` | **PASSED** | **36 test suites lolos, 409/409 unit tests lulus (100%)**. |
| **Kompilasi Build** | `npm run build` | **PASSED** | Berhasil dikompilasi dalam 16.36 detik tanpa kegagalan bundler. |

---

## 9. Pending Manual Operator Actions

Agar Google OAuth dapat diuji secara nyata (end-to-end) pada staging runtime:
1. **Operator Google Cloud:** Daftarkan OAuth Client ID di Google Cloud Console dengan Authorized Redirect URI:  
   `https://swadgljnyelsjstqqxbm.supabase.co/auth/v1/callback`.
2. **Operator Supabase:** Masukkan Client ID dan Secret ke Supabase Dashboard project `swadgljnyelsjstqqxbm` (Authentication → Providers → Google) dan simpan.
3. **Operator Database Staging:** Tautkan akun Google penguji ke akun kru staging (misal `PTV-025`) dengan memperbarui field `auth_user_id` pada tabel `public.user_account`.
4. **Verifikasi Browser:** Buka `http://localhost:5174/hub/login`, klik tombol "Lanjutkan dengan Google", lakukan login akun Google, dan verifikasi bahwa pengguna berhasil dialihkan langsung ke `/hub`.

---

## 10. Known Blockers and Rollback Plan

### Known Blockers:
- Pengujian end-to-end di browser membutuhkan kredensial Google Cloud Client ID dan Secret yang aktif di Supabase Dashboard project `swadgljnyelsjstqqxbm`. Sebelum operator mengisi kredensial tersebut, tombol Google akan menampilkan pesan penolakan konfigurasi jujur.

### Rollback Plan:
Jika perlu membatalkan integrasi lokal tanpa merusak modul lain:
1. Ubah tombol Google di [`src/app/router/LoginPage.tsx`](file:///c:/Users/zidna/ptvpro/src/app/router/LoginPage.tsx) kembali ke alert statis atau disable.
2. Hapus rute `/hub/auth/callback` dari [`src/app/router/index.tsx`](file:///c:/Users/zidna/ptvpro/src/app/router/index.tsx).
3. Hapus berkas [`src/app/router/AuthCallbackPage.tsx`](file:///c:/Users/zidna/ptvpro/src/app/router/AuthCallbackPage.tsx).
4. Seluruh fungsionalitas login password Supabase dan mock lokal tetap berfungsi normal tanpa dependensi pada OAuth.
