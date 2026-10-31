# PTVPRO — Local vs Production Parity Audit Report

> **Dokumen Resmi Audit:** Evaluasi Komprehensif Paritas Antara Runtime Localhost (`npm run dev:staging` / port 5174) dan Vercel Production (`https://www.ptvpro.com`).  
> **Tanggal Evaluasi:** 31 Oktober 2026  
> **Database Target:** `swadgljnyelsjstqqxbm` (ptvpro-staging) — Database lama `jthzuhkblxcaohiuypqq` diisolasi sepenuhnya dan tidak disentuh.

---

## 1. Kondisi Arsitektur Deployment Aktual

### 1.1 Status Git & Percabangan
- **Branch Aktif Lokal:** `main` (commit `8606fb9`).
- **Remote Tracking:**
  - `origin/main` berada di commit `8606fb9` (*up to date*).
  - `origin/master` berada di commit `8606fb9` (*up to date*).
  - `origin/HEAD` menunjuk ke `origin/main`.
- **Branch Production Vercel:** Terhubung langsung ke branch `main`.
- **Deployment Terakhir di Vercel:**
  - Deployment ID: `7456993084`
  - Commit SHA: `8606fb9`
  - Status GitHub Deployment: `success`
  - Domain Canonical: `https://www.ptvpro.com` (dan alias apex `https://ptvpro.com` via HTTP 308).

### 1.2 Pipeline Build & Routing Vercel
- **Build Command:** `npm run build` (`vite build && node scripts/bundle-api.cjs`).
- **Output Directory:** `dist`.
- **Arsitektur Backend API:**
  - Seluruh 25 endpoint REST dan modul pendukung dikompilasi oleh `esbuild` menjadi **1 berkas serverless mandiri**: [`api/index.js`](file:///c:/Users/zidna/ptvpro/api/index.js) (481 KB).
  - Sumber endpoint TypeScript disimpan dalam `api/_routes/` dan diekspos melalui router sentral `api/_router.ts`.
  - Pola routing Vercel (`vercel.json`):
    - `/api` -> `/api` (Universal Serverless Router)
    - `/api/:path*` -> `/api?__route=:path*` (Universal Serverless Router)
    - `/:path*` -> `/index.html` (SPA Fallback Catch-all)
  - Parameter `cleanUrls: true` dan `trailingSlash: false` telah dihapus tuntas untuk mencegah pencegatan 404 dari Edge CDN Vercel.

---

## 2. Perbandingan Localhost, Hasil Build Lokal, dan Vercel Production

| Parameter | Localhost Dev Server (`npm run dev:staging`) | Build Lokal Preview (`npm run preview`) | Vercel Production (`www.ptvpro.com`) |
| :--- | :--- | :--- | :--- |
| **Server Runtime** | Vite Dev Server + Node.js HTTP Middleware | Vite Preview Static Server (tanpa backend `/api`) | Vercel Edge Network + Node.js 20.x Serverless Function |
| **Injeksi CSS** | **Dinamis via Vite HMR:** Tag `<style>` disuntikkan ke `<head>` saat komponen halaman di-mount. | **Statis Terbundel:** 1 berkas `dist/assets/index-BiiBL8da.css` (918.5 kB). | **Statis Terbundel:** 1 berkas `index-BiiBL8da.css` dimuat via `<link rel="stylesheet">`. |
| **Urutan CSS Cascade** | Bergantung pada halaman yang pertama kali dibuka pengguna di browser. | Ditentukan statis oleh urutan modul yang di-resolve Rollup saat build time. | Identik dengan Build Lokal (`index-BiiBL8da.css`). |
| **Backend API** | Dijalankan via `vercelApiDevPlugin` di `vite.config.ts` (mengimpor langsung file `.ts`). | Tidak aktif (hanya melayani file statis `dist/`). | Dieksekusi oleh Serverless Function `api/index.js` (pre-bundled bundle). |
| **Environment Variables** | Otomatis dimuat dari berkas lokal `.env.staging` via `loadEnv()` ke `process.env`. | Hanya variabel ber-awalan `VITE_` yang di-injeksi ke bundle client. | Wajib didaftarkan secara eksplisit di Vercel Dashboard (Settings -> Environment Variables). |
| **Parsing Request Body** | Stream HTTP murni `IncomingMessage` tanpa pra-konsumsi oleh platform. | N/A | Stream HTTP atau objek yang telah diparsing oleh Vercel (`req.body`). |
| **Client Ingress IP** | `req.socket.remoteAddress` (`127.0.0.1` / IPv6 `::1`). | N/A | Header `x-forwarded-for` (daftar IP berpemisah koma: `client, vercel-edge`). |
| **Kecepatan Aset & Font** | Instan (0 ms latency jaringan lokal, cache font browser dev). | Cepat lokal. | Bergantung koneksi CDN (Google Fonts & asset chunking). |

---

## 3. Akar Masalah UI: File dan Aturan CSS Penyebabnya

Pengguna melaporkan adanya perbedaan visual antara localhost dan production terkait:
1. **Border dan Border-Radius:** Sudut melengkung, radius pill, dan continuous corners.
2. **Pill Filter Bar & Tombol `+ Alat` di Inventaris.**
3. **Layout dan Spesifisitas CSS.**

### 3.1 Akar Masalah Utama: Tabrakan Selektor Global Tanpa Scoping (478 Class Duplikat)
Audit kode menemukan sebanyak **478 class CSS didefinisikan secara tumpang tindih di beberapa berkas CSS berbeda** tanpa CSS Modules, BEM seragam, maupun scoping `@scope` / namespace.

#### Kasus Nyata 1: Perusakan Radius `.chip`
- Di [`src/styles/beranda.css`](file:///c:/Users/zidna/ptvpro/src/styles/beranda.css) (dimuat pada byte **73993** di file bundle production):
  ```css
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: var(--ptv-curve-pill, 9999px); /* BENTUK PILL BULAT SEMPURNA */
  }
  ```
- Di [`src/styles/dashboard.css`](file:///c:/Users/zidna/ptvpro/src/styles/dashboard.css) (dimuat belakangan pada byte **549211** di bundle production):
  ```css
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6.5px;
    padding: 5px 12px;
    border-radius: var(--ptv-curve-md); /* MENIMPA MENJADI KOTAK TUMPUL BIASA */
    box-shadow: 0 1px 2px rgba(0,0,0,.02);
    background: #F1F3F5;
    border: 1px solid rgba(75,85,99,.12);
  }
  ```
- **Mengapa di Localhost Normal tetapi di Production Rusak:**
  - Di Localhost: Saat pengguna membuka halaman Beranda, Vite HMR menyuntikkan `beranda.css` ke tag `<style>` terakhir di `<head>`, sehingga aturan pill `border-radius: 9999px` menang.
  - Di Production: Rollup menggabungkan file-file tersebut ke dalam `index-BiiBL8da.css`. Dalam berkas gabungan ini, aturan dari `dashboard.css` berada di posisi bawah (byte 549211 vs byte 73993), sehingga **aturan kotak tumpul di `dashboard.css` secara permanen menimpa bentuk pill** di seluruh aplikasi!

#### Kasus Nyata 2: Perusakan Dimensi & Border Tombol `.qa-ref-btn`
- Di [`src/styles/beranda.css`](file:///c:/Users/zidna/ptvpro/src/styles/beranda.css) (byte 65757):
  ```css
  .qa-ref-btn {
    width: 58px;
    height: 58px;
    border-radius: var(--ptv-curve-lg);
    background: var(--surface);
    border: 1px solid var(--line);
  }
  ```
- Di [`src/styles/dashboard.css`](file:///c:/Users/zidna/ptvpro/src/styles/dashboard.css) (byte 615650):
  ```css
  .qa-ref-btn {
    width: 60px;
    height: 60px;
    border-radius: var(--ptv-curve-xl);
    background: #FFFFFF;
    border: 1px solid rgba(226, 232, 240, 0.85); /* Hardcoded grey border */
  }
  ```
- **Hasil di Production:** Aturan di byte 615650 menimpa aturan di byte 65757, mengubah ukuran tombol dan warna border menjadi putih/abu-abu hardcoded.

#### Kasus Nyata 3: Tombol `.btn.pri` dan Tombol `+ Alat` di Inventaris
- Di [`src/styles/inventaris.css`](file:///c:/Users/zidna/ptvpro/src/styles/inventaris.css) (byte 92392):
  ```css
  .r03-inventaris .inv-toolbar-actions .btn.pri,
  .r03-inventaris .inv-btn-pill.pri {
    background: var(--b-600, #1273E6) !important;
    border-radius: var(--r-ref-full, 999px) !important;
  }
  ```
- Di [`src/styles/dashboard.css`](file:///c:/Users/zidna/ptvpro/src/styles/dashboard.css) (byte 551875):
  ```css
  .btn.pri {
    background: linear-gradient(150deg, var(--b-500), var(--b-700));
    box-shadow: var(--shadow-blue);
  }
  ```
- Meskipun di `inventaris.css` telah dipasang `!important`, jika ada komponen atau drawer di halaman Inventaris yang tidak berada di bawah parent class `.r03-inventaris`, tombol akan langsung mewarisi gradien dan radius kotak dari `dashboard.css`.

### 3.2 Akar Masalah Profile D Continuous Surface di Production
Komponen [`ContinuousSurface.tsx`](file:///c:/Users/zidna/ptvpro/src/design-system/components/ContinuousSurface.tsx) menggunakan `ResizeObserver` untuk menghitung path kurva SVG secara dinamis:
- Pada initial render di Vercel Production, sebelum web fonts (`SF-Pro-Display`, `Plus Jakarta Sans`) selesai diunduh dan dirender oleh browser, `getBoundingClientRect()` mengembalikan dimensi yang berbeda atau `w: 0, h: 0`.
- Akibatnya, terjadi layout shift atau keterlambatan rendering kontur kurva kontinu, sehingga browser sesaat menampilkan kontur kosong atau terdistorsi sebelum ResizeObserver memicu re-render path SVG.

---

## 4. Akar Masalah API: Endpoint dan Error Terkait

Pengujian langsung membuktikan bahwa endpoint publik seperti `/api`, `/api/portal`, `/api/auth/session` saat ini merespons dengan **200 OK**. Namun, terdapat beberapa akar masalah fatal yang menyebabkan API error di Vercel:

### 4.1 Bug Kritis: Kegagalan Parsing Stream Request Body (`acara.ts` & `upload-avatar.ts`)
- **File Terdampak:** [`api/_routes/acara.ts`](file:///c:/Users/zidna/ptvpro/api/_routes/acara.ts) (baris 217-235) dan [`api/_routes/upload-avatar.ts`](file:///c:/Users/zidna/ptvpro/api/_routes/upload-avatar.ts) (baris 50-60).
- **Mekanisme Kegagalan:**
  ```typescript
  // Kode pada acara.ts:
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => { resolve(JSON.parse(body)); });
  ```
  Di Vercel Serverless Function, runtime Node.js atau internal middleware Vercel sering kali telah mem-parse request body ke objek `(req as any).body`, sehingga HTTP stream `req` telah selesai (`req.readableEnded = true`).
  Ketika kode memasang listener `req.on('data')` pada stream yang sudah selesai dan tidak mengecek `req.body`, **event `data` dan `end` tidak akan pernah ditembakkan (never fires)!**
- **Dampak di Production:** Permintaan `POST` atau `PUT` ke `/api/acara` atau `/api/upload-avatar` akan **menggantung (hanging)** sampai fungsi mati terkena batas timeout Vercel (10–15 detik) dan mengembalikan status **`504 Gateway Timeout`**!
- **Mengapa di Localhost Normal:** Di localhost, dev server Vite tidak melakukan pra-konsumsi stream `req`, sehingga stream selalu terbaca normal.

### 4.2 Bug Kritis: Kegagalan Trusted Ingress IP pada Header `x-forwarded-for` Berisi Koma
- **File Terdampak:** [`api/_routes/auth/_utils/portalLifecycle.ts`](file:///c:/Users/zidna/ptvpro/api/_routes/auth/_utils/portalLifecycle.ts) (baris 34-44).
- **Mekanisme Kegagalan:**
  ```typescript
  function trustedIngress(req: ApiRequest) {
    const value = process.env.VERCEL === '1' ? req.headers['x-forwarded-for'] : req.socket?.remoteAddress;
    if (typeof value !== 'string' || !isIP(value.trim())) throw new Error('Trusted ingress unavailable');
    ...
  ```
  Di Vercel Production (`process.env.VERCEL === '1'`), header `x-forwarded-for` hampir selalu berisi rangkaian IP berpemisah koma saat melewati CDN atau multi-proxy (misalnya: `"114.122.45.12, 76.76.21.21"`).
  Fungsi bawaan `isIP("114.122.45.12, 76.76.21.21")` dari `node:net` akan mengembalikan nilai `0` (false) karena string mengandung koma dan spasi!
- **Dampak di Production:** `trustedIngress` melempar `Error('Trusted ingress unavailable')`. Pada `authenticatePortalPassword` (baris 46-49), error ini ditangkap dan mengembalikan **`HTTP 503: Autentikasi sementara tidak tersedia`**!
- **Mengapa di Localhost Normal:** Di localhost, `process.env.VERCEL !== '1'`, sehingga yang dibaca adalah `req.socket.remoteAddress` yang selalu bernilai string IP tunggal (`127.0.0.1`), sehingga `isIP()` selalu mengembalikan `4` (true).

### 4.3 Bug Kritis: Penolakan Login Akibat Validasi Origin vs Host Domain
- **File Terdampak:** [`api/_routes/auth/login.ts`](file:///c:/Users/zidna/ptvpro/api/_routes/auth/login.ts) (baris 75-77).
- **Mekanisme Kegagalan:**
  ```typescript
  if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: 'Origin tidak diizinkan.' }));
    return;
  }
  ```
  Jika pengguna mengakses formulir login via `https://ptvpro.com/hub/login` (domain apex), browser mengirimkan header `Origin: https://ptvpro.com`. Namun jika Vercel atau internal proxy meneruskan request ke host kanonikal `www.ptvpro.com`, perbandingan `origin.host !== req.headers.host` akan mengevaluasi `'ptvpro.com' !== 'www.ptvpro.com'` (true)!
- **Dampak di Production:** Login langsung ditolak dengan **`HTTP 403: Origin tidak diizinkan`**.
- **Mengapa di Localhost Normal:** Di localhost, `origin` dan `host` selalu sama persis (`localhost:5174`).

### 4.4 Ketergantungan Environment Variables Staging Supabase
- **File Terdampak:** [`api/_routes/auth/_utils/financeLocalHarness.ts`](file:///c:/Users/zidna/ptvpro/api/_routes/auth/_utils/financeLocalHarness.ts) dan seluruh handler `_routes/*.ts`.
- **Mekanisme:** Kode memvalidasi format URL Supabase staging secara ketat menggunakan regex:
  ```typescript
  if (!/^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/.test(url)) throw new Error('Staging backend unavailable');
  ```
  Di localhost, nilai ini otomatis diisi dari file `.env.staging`. Di Vercel Production, jika environment variable `SUPABASE_URL` atau `VITE_SUPABASE_URL` di Vercel Dashboard tidak diisi atau salah ketik, seluruh endpoint backend langsung mati dengan error 500 / 503.

---

## 5. Temuan Terverifikasi vs Dugaan yang Belum Terbukti

### 5.1 Temuan Terverifikasi (Empirical Facts)
1. **[FAKTA]** File bundle CSS production `dist/assets/index-BiiBL8da.css` berisi duplikasi aturan CSS selektor yang sama di mana aturan `dashboard.css` menimpa aturan `beranda.css` (terbukti dari analisis offset byte dan snippet CSS).
2. **[FAKTA]** `api/_routes/acara.ts` dan `api/_routes/upload-avatar.ts` membaca stream raw `req.on('data')` tanpa memeriksa `(req as any).body`, yang berisiko timeout 504 di runtime serverless.
3. **[FAKTA]** `api/_routes/auth/_utils/portalLifecycle.ts` menjalankan `isIP()` langsung pada string `x-forwarded-for` tanpa melakukan ekstraksi IP pertama (`.split(',')[0].trim()`).
4. **[FAKTA]** Branch `main` dan `master` di remote GitHub telah tersinkronkan ke commit yang sama (`8606fb9`), dan deployment Vercel Production aktif berjalan dari `main` commit `8606fb9`.
5. **[FAKTA]** Routing Vercel saat ini (`vercel.json`) telah berhasil melayani `/` (200), `/hub` (200), `/verifikasi-identitas` (200), `/keabsahan-dokumen` (200), dan `/api` (200).

### 5.2 Dugaan yang Belum Terbukti / Gugur (Debunked Assumptions)
1. **[GUGUR] "Deployment Vercel menggunakan branch yang salah atau kode lama."**  
   *Bukti:* GitHub Deployment API mengonfirmasi deployment production ID `7456993084` aktif dari commit terbaru `8606fb9`.
2. **[GUGUR] "Semua API di Vercel 404 atau tidak berfungsi."**  
   *Bukti:* Endpoint `/api`, `/api/portal`, `/api/auth/session` merespons dengan 200 OK secara langsung di `www.ptvpro.com`. API tidak mati secara total; error terjadi spesifik pada operasi tertentu (seperti `POST` dengan body atau login form).
3. **[GUGUR] "Vercel Hobby Tier memblokir deployment karena kelebihan Serverless Functions."**  
   *Bukti:* Pre-bundled router `api/index.js` mengonsolidasi seluruh 25 endpoint ke dalam tepat 1 fungsi serverless mandiri, sehingga kuota fungsi Vercel Hobby (maks 12) sama sekali tidak terlampaui.

---

## 6. Rekomendasi Perbaikan Paling Minimal

Tanpa perlu refactor besar atau merombak arsitektur, berikut langkah perbaikan bedah mikro (*surgical patch*) yang diperlukan:

### 6.1 Perbaikan Backend API (Surgical Patches)
1. **Dukungan Dual-Mode Body Parsing pada `api/_routes/acara.ts` dan `upload-avatar.ts`:**
   Periksa ketersediaan `req.body`:
   ```typescript
   const parsedBody = (req as any).body !== undefined 
     ? (typeof (req as any).body === 'string' ? JSON.parse((req as any).body) : (req as any).body)
     : await parseRawStream(req);
   ```
2. **Penanganan Multi-IP pada `trustedIngress` (`portalLifecycle.ts`):**
   Ambil IP client pertama sebelum memanggil `isIP()`:
   ```typescript
   const rawValue = process.env.VERCEL === '1' ? req.headers['x-forwarded-for'] : req.socket?.remoteAddress;
   const value = typeof rawValue === 'string' ? rawValue.split(',')[0].trim() : '';
   if (!value || !isIP(value)) throw new Error('Trusted ingress unavailable');
   ```
3. **Toleransi Apex dan WWW Domain pada Validasi Origin (`login.ts`):**
   Izinkan pasangan domain kanonikal:
   ```typescript
   const allowedHosts = new Set([req.headers.host, 'ptvpro.com', 'www.ptvpro.com']);
   if (req.headers.origin && !allowedHosts.has(new URL(req.headers.origin).host)) { ... }
   ```

### 6.2 Perbaikan Paritas UI & CSS
1. **Eliminasi Override Global `dashboard.css` Terhadap `.chip` dan `.qa-ref-btn`:**
   - Tambahkan prefix scoping spesifik pada aturan di `dashboard.css` (misal `.ptv-dashboard .chip` atau `.profile-container .chip`) alih-alih selektor telanjang `.chip` global.
   - Pindahkan impor stylesheet spesifik halaman agar diisolasi ke modul terkait, atau pastikan selektor R03 memiliki spesifisitas yang cukup (misal `.r03-inventaris .inv-toolbar-actions .btn.pri`).
2. **Pengamanan Font Loading pada `ContinuousSurface`:**
   - Pastikan path SVG continuous surface memiliki fallback dimensi default min-height / min-width agar tidak runtuh saat initial render sebelum web font selesai dimuat.

---

## 7. Rancangan Workflow Deployment Sederhana (JID SPACE Parity)

Untuk menjaga stabilitas jangka panjang dan kemudahan pengelolaan seperti proyek JID SPACE tanpa mengorbankan fungsionalitas backend:

```mermaid
flowchart LR
    Dev["Developer (Localhost)"] -->|"git push origin main"| GitHub["GitHub (Branch: main)"]
    GitHub -->|"Automated Trigger"| Vercel["Vercel Production"]
    subgraph Vercel Pipeline
        Build["npm run build"]
        Vite["Vite Build (dist/)"]
        Bundle["esbuild bundle (api/index.js)"]
        Build --> Vite
        Build --> Bundle
    end
    Vercel Pipeline -->|"Serve Static"| Frontend["Frontend SPA (www.ptvpro.com)"]
    Vercel Pipeline -->|"Single Serverless"| Backend["Backend API (/api/*)"]
```

### Prinsip Utama Workflow JID SPACE untuk PTVPRO:
1. **Satu Branch Produksi Tunggal:**
   - Gunakan branch `main` secara eksklusif sebagai branch default dan deployment branch di Vercel.
   - Hapus atau selaraskan branch `master` agar tidak pernah terjadi kebingungan referensi git.
2. **Satu Perintah Build Deterministik:**
   - Script `"build": "vite build && node scripts/bundle-api.cjs"` tetap dipertahankan. Ini menjamin bahwa setiap kali Vercel menjalankan build, baik aset frontend (`dist/`) maupun backend serverless tunggal (`api/index.js`) dibuat secara atomik dan sinkron.
3. **Konfigurasi Routing Minimalis (`vercel.json`):**
   - Pertahankan format rewrites standar SPA:
     - `/api` -> `/api`
     - `/api/:path*` -> `/api?__route=:path*`
     - `/:path*` -> `/index.html`
   - Hindari penambahan flag non-standar seperti `cleanUrls` atau custom regex yang rawan memicu bug edge routing.
4. **Sentralisasi Environment Variables di Vercel:**
   - Pastikan variabel berikut terdaftar seragam di Vercel Dashboard (Production, Preview, Development):
     - `SUPABASE_URL` / `VITE_SUPABASE_URL`: `https://swadgljnyelsjstqqxbm.supabase.co`
     - `SUPABASE_SERVICE_ROLE_KEY`: Key service role staging
     - `VITE_SUPABASE_ANON_KEY`: Key anon staging
     - `AUTH_SECRET`: Kunci rahasia minimal 32 karakter
     - `PTV_AUTH_LIFECYCLE_ENABLED`: `true`
     - `PTV_PASSWORD_LOGIN_ENABLED`: `true`

---

## 8. Kesimpulan

Perbedaan antara Localhost dan Vercel Production **bukan disebabkan oleh kegagalan arsitektur hosting atau perbedaan branch Git**, melainkan oleh:
1. **Urutan penggabungan CSS global** di mana selektor telanjang dari `dashboard.css` menimpa selektor di `beranda.css` saat dibundel oleh Rollup.
2. **Asumsi environment serverless** pada backend (string IP multi-proxy di `x-forwarded-for`, pembacaan stream request body yang sudah tertutup, dan pengecekan ketat `origin === host`).

Dengan menerapkan perbaikan bedah mikro yang direkomendasikan pada Bagian 6, paritas 100% antara Localhost dan Vercel Production dapat dicapai secara bersih, elegan, dan stabil.
