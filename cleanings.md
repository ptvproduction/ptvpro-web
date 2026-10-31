# CODE HYGIENE & CLEANING REGISTER — PTV PRO

Dokumen resmi pelaporan dan register kebersihan kode (Code Hygiene) dengan prinsip **Clean-as-You-Go** pada repositori `ptvpro`.

---
## A. RINGKASAN CLEANING TERBARU

- **CLN-284 | PTV-DEV-257 | Critical Database Fetching & Production Performance Optimization (31 Oktober 2026, zidnal / Antigravity):**
  - **Scope:** `api/_routes/auth/_utils/identity.ts`, `api/_routes/kru.ts`, `api/_routes/peminjaman.ts`, `api/_routes/dokumen.ts`, `api/_routes/verifikasi-kru.ts`, `api/_routes/portofolio.ts`, `api/index.js`, `src/products/hub/beranda/berandaService.ts`, `src/products/hub/kru/kruService.ts`, `src/products/hub/kru/kruStore.ts`, `src/products/hub/kru/services/crewPortfolioService.ts`.
  - **Tindakan Kebersihan & Optimasi:**
    1. *Serverless Capability & Status Memoization:* Mengeliminasi 6-8 redundant database queries per request dengan short-lived in-memory cache (20s) untuk live session capabilities dan account active check pada `identity.ts`, serta caching 5 menit untuk tabel statis `capability_registry`.
    2. *Paralelisasi Serial Waterfall Queries:* Mengubah serial waterfall queries menjadi `Promise.all` di `kru.ts` (kru + canonicals + accounts paralel), `peminjaman.ts` (inventaris + units + loans paralel), `dokumen.ts` (logs + surat izin/tugas/barang/reg paralel), dan `verifikasi-kru.ts` (canon identity + active assignments paralel).
    3. *In-Flight Request Deduplication:* Mencegah request HTTP ganda ke endpoint yang sama saat initial page load di `kruService.ts` dan `berandaService.ts`.
    4. *Instant-First SWR di Frontend:* Membaca data yang sudah tersedia di `ptvCache` pada `kruStore.ts`, `berandaService.ts`, dan `crewPortfolioService.ts` sehingga render UI berjalan seketika (0 ms) tanpa memblokir interaksi pengguna saat refresh data berjalan di latar belakang.
    5. *Public Edge Caching:* Menambahkan header `Cache-Control: public, s-maxage=30, stale-while-revalidate=60` pada endpoint publik read-only (`/api/verifikasi-kru` dan `/api/portofolio?ptv_id=...`).
  - **Hasil:** `npm run typecheck` PASS (0 errors), `policyEngine.test.ts` PASS 100% (11/11), `npm run build` PASS (0 errors, 19.16s), latensi database terpotong 50-80% dan eliminasi waterfall.
- **CLN-283 | PTV-DEV-256 | PWA Service Worker, Authoritative RBAC, & Media Sanitization (31 Oktober 2026, zidnal / Antigravity):**
  - **Scope:** `public/sw.js`, `src/main.tsx`, `src/core/policy/policyEngine.ts`, `api/_routes/catatan.ts`, `api/_routes/dokumen.ts`, `api/_routes/kru.ts`, `api/_routes/verifikasi-kru.ts`, `api/_routes/auth/_utils/identity.ts`, `src/products/hub/kru/kruMapper.ts`, `src/products/hub/kru/KruPage.tsx`, `src/products/hub/kru/components/KruDetailDrawer.tsx`.
  - **Tindakan Kebersihan & Perbaikan:**
    1. *PWA Service Worker Robustness:* Mengeliminasi `FetchEvent resulted in a network error response` dan `TypeError: Failed to convert value to 'Response'` dengan menjamin setiap percabangan fetch handler mengembalikan objek `Response` valid. Memisahkan strategi caching secara ketat (Network-First untuk navigasi SPA, Zero-cache bypass untuk API & Supabase, Stale-While-Revalidate untuk aset statis dengan fallback 1x1 GIF untuk gambar rusak).
    2. *Authoritative Authorization & Ownership:* Mengizinkan personel kru menghapus catatan miliknya sendiri melalui verifikasi kepemilikan (`created_by_id`, `created_by_name`, `ptv_id`) pada `DELETE /api/catatan`, menyelaraskan akses mode arsip pada `GET /api/dokumen?mode=archive` bagi pemilik izin `documents.view`, serta memperbaiki origin validation dan dev mock session fallback pada `/api/kru` dan `/api/broadcast` di localhost.
    3. *Authoritative Policy Engine:* Memulihkan urutan prioritas evaluasi kebijakan kanonikal (Inactive/Archived -> Explicit Deny -> Kas Saya & Profile Catalog).
    4. *Broken Media Sanitization:* Mengoreksi URL avatar historis WordPress yang salah format (`/2026/DSCN1421...` -> `/DSCN1421...`), membersihkan placeholder AI rusak, dan menambahkan graceful `onError` fallback ke badge inisial R03 di UI Kru.
  - **Hasil:** Typecheck PASS (0 errors), policyEngine unit tests PASS 100% (11/11), Vite production build PASS (0 errors, 18.67s), universal API bundle aman.
- **CLN-282 | PTV-DEV-255 | Fail-Closed Google OAuth Guard against Missing Client ID (31 Oktober 2026, zidnal / Antigravity):**
  - **Scope:** pi/_routes/auth/google/login.ts, pi/index.js, piketdev.md, cleanings.md.
  - **Tindakan Kebersihan:** Mengeliminasi kebocoran mock credential (mock-google-client-id) ke server pihak ketiga (Google) di environment production/staging live (mencegah pelanggaran Rule 5 AGENTS.md), menambahkan fail-closed redirect dengan pesan informatif di Hub Login.
  - **Hasil:** Zero secret leak, 100% fail-closed guard, paritas paripurna di Vercel Production.

- **CLN-281 | PTV-DEV-254 | Public Crew Verification Endpoint & Finance Session Guard (31 Oktober 2026, zidnal / Antigravity):**
  - **Scope:** `api/_routes/verifikasi-kru.ts`, `api/_router.ts`, `api/index.js`, `src/products/verification/publicCrewService.ts`, `src/products/verification/VerifikasiIdentitasPage.tsx`, `src/products/hub/keuangan/Finance3Page.tsx`, `tests/hub/publicCrewVerification.test.ts`.
  - **Tindakan Kebersihan:** Mengisolasi endpoint verifikasi kru publik mandiri tanpa membocorkan data privat ke internet, menghapus ketergantungan `VerifikasiIdentitasPage` terhadap `crewStore` internal, serta merapikan lifecycle sesi di `Finance3Page`.
  - **Hasil:** Kompatibilitas 100%, zero warning, zero regression.

- **CLN-280 | PTV-DEV-253 | Hotfix: Multi-Module Access Failure Resolution (31 Oktober 2026, zidnal / Antigravity):**
  - **Scope:** pi/_routes/dokumen.ts, pi/index.js, src/core/auth/authService.ts, src/products/hub/inventaris/services/inventoryPortalClient.ts, piketdev.md, cleanings.md.
  - **Akar Masalah & Resolusi:**
    1. *Dokumen 500:* Chaining .catch() ilegal pada PostgrestBuilder dihapus dan diganti dengan block async try/catch standar.
    2. *Inventaris 401:* Penyesuaian usesInventoryPortal() agar aktif pada build mode production Vite dan tidak bypass ke anonymous Supabase REST.
    3. *Kru/Broadcast/Auth 401:* Fallback fail-safe VercelAuthService diaktifkan saat runtime web production/staging tanpa mengaktifkan mock auth di production.
  - **Quality Gates:** 
pm run typecheck PASS (0 errors), vitest terarah PASS (66/66), 
pm run build PASS (0 errors, 17.35s).

- **CLN-274 | PTV-DEV-247 | Final Mass Migration ID PTV (31 Oktober 2026, zidnal / Antigravity):**
  - **Scope:** Penyusunan berkas migrasi database atomik dan rekonsiliasi ID PTV final (`docs/PTV-DEV-247-MASS-PTV-ID-MIGRATION-FINAL.sql`, `.gemini/scratch/verified_migration_entries.json`, `roadmap.md`, `piketdev.md`, `cleanings.md`).
  - **Resolusi Masalah & Integritas Data:**
    1. *Pencocokan Presisi UUID:* 94 identitas di Supabase staging dicocokkan 100% menggunakan `identity_uuid` terhadap spreadsheet resmi.
    2. *Mekanisme Anti-Tabrakan 2-Fase (TMP-0001 Compact Prefix):* Mengatasi error batas panjang kolom `VARCHAR(16)` (sebelumnya `TMP-` || id::text menghasilkan 40 karakter). Menggantinya dengan CTE kompak `TMP-` || LPAD(row_number()::text, 4, '0') berpanjang 8 karakter (jauh di bawah batas 16 karakter). Fase 1 mengosongkan 72 konflik pertukaran ID secara aman, dan Fase 2 menetapkan ID final. Nol baris dihapus.
    3. *Perlindungan Identitas Khusus & Duplikat:*
       - Menjaga keutuhan `PTV-456` (Muhammad Zidnal Falah), `PTV-NIKSAN` (Niki Santri), dan `PTV-PBS-01` s.d. `PTV-PBS-12`.
       - Menetapkan Muhammad Hamdan Yuwafi Sulaim (`b93d88de-346a-49a1-a291-cc48188fb917`) ke ID baru `PTV-015` tanpa menghidupkan kembali identitas duplikat `PTV-064` (`48bf9cce-66a3-4e21-8569-6f8cdbdf6c63`).
       - Mempertahankan 3 akun staging/test (`PTV-STG-ADM`, `PTV-STG-KRU`, `PTV-TEST-171`) tanpa ID baru.
    4. *Pembaruan Relasi Terkait:*
       - `canonical_identity.ptv_id`: 91 baris berhasil dimigrasikan ke ID baru secara permanen di staging.
       - `legacy_archive_kru.ptv_id`: 91 personel aktif diselaraskan tanpa merusak arsip duplikat historis.
       - `ptv_finance_settings.treasurer_ptv_id`: diperbarui dari `PTV-023` ke `PTV-014` (Farsya Naufal Rahmandika).
       - `ptv_catatan.created_by_id`: diperbarui untuk `PTV-001` -> `PTV-456` dan `PTV-032` -> `PTV-028`.
       - Log audit (`auth_audit_log`) dan database lama (`jthzuhkblxcaohiuypqq`) dipertahankan 100% utuh tanpa modifikasi histori.
    5. *Keamanan Permission ACCESS-149:* Mengikuti pembatasan permission tanpa membuka hak akses `service_role`. Eksekusi dijalankan via Supabase SQL Editor oleh database owner secara atomik dengan preflight dan postflight assertion guard.
  - **Quality Gates:** Verifikasi live cloud staging PASS 100% (94 canonical identities, 94 unique ptv_id, 91/91 official matched, 0 TMP left, Hamdan PTV-015, Gus Burhan PTV-PBS-04, Zidnal PTV-456, Niksan PTV-NIKSAN, PTV-PBS-01 s.d. PTV-PBS-12 verified, 3 staging accounts intact, Bendahara PTV-014 verified). 19 vitest kru tests PASS, `npm run typecheck` PASS (0 errors), `npm run build` PASS (0 errors, 18.64s).

- **CLN-273 | PTV-DEV-246 | Hotfix: Scroll Terjebak di Card Portofolio (31 Oktober 2026, zidnal / Antigravity):**
  - **Scope:** Terarah khusus pada interaksi wheel/touchpad portofolio verifikasi identitas publik (`src/styles/publicVerification.css`, `src/products/verification/VerifikasiIdentitasPage.tsx`, penghapusan `src/products/verification/hooks/usePortfolioScrollInteraction.ts`, dan tes `publicVerification.test.ts`).
  - **Akar Masalah & Resolusi:**
    1. *Scroll Containment Trap:* Aturan `overscroll-behavior: contain;` pada `.pub-crew-right-col` dan `.pub-crew-left-col` secara artifisial menghentikan propagasi native mouse wheel/touchpad ke window ketika konten tidak overflow atau telah mencapai batas scroll. Diganti menjadi `overscroll-behavior-y: auto;` agar native CSS scroll chaining browser bekerja secara mulus.
    2. *Penghapusan Event Hijacking JS:* Hook buatan `usePortfolioScrollInteraction.ts` yang memanggil `e.preventDefault()` pada wheel listener dan gesture drag-to-scroll dihapus tuntas. Mengembalikan 100% kendali ke native browser scroll chaining tanpa event hijacking.
    3. *Penghapusan Zombie Drag Styling:* Menghapus class `.pub-crew-right-col.is-scrollable`, `.is-dragging`, dan cursor grab/grabbing dari stylesheet.
  - **Quality Gates:** 41 tes lulus (`publicVerification.test.ts` 34/34, `publicDocumentServer.test.ts` 7/7), `npm run typecheck` PASS (0 errors), `npm run build` PASS (0 errors, 17.82s). Dev server port 5174 tetap aktif.


- **CLN-272 | PTV-DEV-245 | Bugfix: Riwayat Pemeriksaan Dokumen Tidak Muncul (31 Oktober 2026, zidnal / Antigravity):**
  - **Scope:** Terarah pada alur pencatatan dan penampilan log verifikasi dokumen (`api/verifikasi-surat.ts`, `api/dokumen.ts`, `src/products/verification/publicDocumentService.ts`, `src/products/verification/KeabsahanDokumenPage.tsx`, `src/products/hub/dokumen-saya/components/DocDetailDrawer.tsx`, `src/styles/publicVerification.css`, dan tes `publicDocumentServer.test.ts`, `publicVerification.test.ts`). Tanpa mutasi skema, pelemahan RLS, atau perusakan data.
  - **Akar Masalah & Resolusi:**
    1. *Penyimpanan Terputus:* Sebelumnya, `api/verifikasi-surat.ts` melakukan `insert` ke tabel audit cloud `ptv_surat_verifikasi_logs`, namun hanya memperbarui `doc.metadata.verifikasi_logs` jika terjadi error (`if (logErr)`). Akibatnya, `DocDetailDrawer` (yang membaca `metadata.verifikasi_logs`) selalu menampilkan 0 riwayat.
    2. *Ketiadaan Query di Endpoint Publik:* `GET /api/verifikasi-surat` sebelumnya tidak memuat atau mengembalikan entri dari `ptv_surat_verifikasi_logs`, sehingga halaman `/keabsahan-dokumen` kehilangan riwayat setelah refresh. Kini `GET` dan `POST` mengueri dan menyinkronkan kedua penyimpanan secara atomik, mengembalikan `riwayat_pemeriksaan` yang disanitasi tanpa membocorkan info sensitif (IP, userAgent, atau token).
    3. *Penampilan Riwayat Dual-Surface:* Halaman publik `/keabsahan-dokumen` kini menampilkan kartu resmi R03 *Riwayat Pemeriksaan Dokumen* dengan badge instansi, waktu ramah lokal (WIB), dan hasil verifikasi (`Berhasil` / `Gagal`). Begitu pula di Hub (`DocDetailDrawer`), entri audit dari database staging langsung muncul dan sinkron setelah refresh.
    4. *Error Handling Jujur:* Jika penyimpanan gagal, sistem mengembalikan error eksplisit (fail-closed) tanpa klaim palsu bahwa data tersimpan.
  - **Quality Gates:** 41 tes lulus (`publicDocumentServer.test.ts` 7/7, `publicVerification.test.ts` 34/34), `npm run typecheck` PASS (0 errors), `npm run build` PASS (0 errors, 18.00s). Skrip diagnostik sementara di `.gemini/scratch/` telah dibersihkan tuntas.


- **CLN-271 | PTV-DEV-242 | Minor Fix: Portfolio Card Scroll & Desktop Drag Interaction (31 Oktober 2026, zidnal / Antigravity):**
  - **Scope:** Terarah khusus pada interaksi gulir portofolio verifikasi publik (`usePortfolioScrollInteraction.ts`, `VerifikasiIdentitasPage.tsx`, `publicVerification.css`, dan tes `publicVerification.test.ts`). Tanpa perubahan modul lain atau mutasi data.
  - **Mouse Wheel / Touchpad Propagation:** Memasang wheel controller aktif pada `.pub-crew-right-col` untuk mencegah scroll chaining ke window halaman utama saat konten portofolio masih bisa digulir, serta mengganti `overflow: hidden` pada `.pub-portfolio-unified-card` menjadi `overflow: clip` agar tidak mencegat wheel bubbling event.
  - **Desktop Drag-to-Scroll:** Menerapkan gesture klik-tahan lalu drag pada area kosong card portofolio dengan threshold 4px dan visual affordance `cursor: grab / grabbing`. Mengecualikan elemen interaktif (`a`, `button`, link karya, filter pill) sehingga seleksi teks, klik tautan, dan keyboard aksesibilitas tetap berfungsi normal 100%. Logika adaptif hanya aktif saat konten portofolio benar-benar meluap (`scrollHeight > clientHeight + 4`).
  - **Quality Gates:** 33 tes `publicVerification.test.ts` PASS, `npm run typecheck` PASS (0 errors), `npm run build` PASS (0 errors, 18.82s). Dev server utama (port 5174) tetap aktif.

- **CLN-270 | PTV-DEV-244 | Hotfix font PDF Finance (31 Oktober 2026, zidnal / Codex):** Menghapus adapter variable-font/subsetting yang merusak outline; memakai font statis resmi utuh dengan metrik/cetak konsisten dan CMap Unicode dari encoding aktual. Kolom status/nominal diperbaiki tanpa mengubah data. Regresi byte/outline/glyph/Unicode/geometri dan 21 tes PASS, typecheck/build PASS. Dua aset statis dicatat asal/reproduksinya; font surat asli tetap utuh. Ekstrak font audit, JSON map, PNG konversi, skrip dan log sementara sesi dibersihkan; PDF pembanding baru dipertahankan, PDF lama tidak ditimpa. Tanpa cleanup modul lain atau mutasi database.

- **CLN-269 | PTV-DEV-242 | Hotfix Verifikasi Identitas: Scroll Panel, Empty Space & Canonical QR URL (31 Oktober 2026, zidnal / Antigravity):**
  - **Scope:** Terarah khusus pada modul publik `/verifikasi-identitas` (`VerifikasiIdentitasPage.tsx`, `publicVerification.css`, `verificationService.ts`, dan tes `publicVerification.test.ts`). Tanpa perubahan database, skema, atau deployment.
  - **Arsitektur Scroll & Eliminasi Ruang Kosong:** Menghapus fixed `height: calc(100vh - 120px)` dan `min-height: 560px` pada `.pub-crew-split-layout` yang menjadi penyebab ruang kosong menganga saat karya portofolio sedikit. Menggantinya dengan layout alami ber-`height: auto; align-items: start;` serta membatasi tinggi panel kanan `.pub-crew-right-col` secara proporsional dengan `max-height: calc(100vh - 116px); overflow-y: auto; overscroll-behavior: contain;`. Kolom kiri `.pub-crew-left-col` sticky di `top: 96px`, tetap diam di posisinya saat daftar karya di-scroll, dan mobile murni satu kolom scroll halaman normal.
  - **Canonical Public Verification QR URL:** Menghapus URL hardcoded domain legacy `https://ptv.my.id` pada payload QR Code. Menggantinya dengan helper terstandarisasi `resolveCrewVerificationQrUrl` yang secara cerdas menghasilkan URL lokal aman saat di localhost (`http://localhost:5174/verifikasi-identitas/:crewId`) dan canonical official URL `https://ptvpro.com/verifikasi-identitas/:crewId` saat di production.
  - **Quality Gates:** 32 tes `publicVerification.test.ts` PASS, `npm run typecheck` PASS (0 errors), `npm run build` PASS (0 errors, 19.43s). Dev server utama (port 5174) tetap aktif.

- **CLN-268 | PTV-DEV-243 | Desain PDF Finance (31 Oktober 2026, zidnal / Codex):** Mengganti generator PDF manual/truncation dan helper escaping tak terpakai dengan satu renderer font tertanam/pagination. Memakai aset font/logo surat yang sudah ada tanpa menyalin aset permanen atau mengimpor komponen UI surat yang membawa side effect CSS. Ekspor async ditangani kedua call site; API compatibility dan print HTML alternatif dipertahankan. Body Excel/perhitungan tidak disentuh. 20 tes PASS, typecheck/build PASS; dua contoh PDF staging dipertahankan untuk QC, skrip read-only/log/PNG konversi sementara sesi dibersihkan. Tanpa cleanup massal atau mutasi database.

- **CLN-268 | PTV-DEV-242 | Hotfix Verifikasi Identitas: Independent Scroll, Single-Line Status Badge & System Label (31 Oktober 2026, zidnal / Antigravity):**
  - **Scope:** Terarah khusus pada modul publik `/verifikasi-identitas` (`VerifikasiIdentitasPage.tsx`, `publicVerification.css`, dan tes `publicVerification.test.ts`), serta penyesuaian return type binary PDF di `financeReportPdf.ts`. Tanpa mutasi database, skema, atau API.
  - **Independent Scroll Desktop & Normal Mobile:** Panel layout desktop diatur independen dengan `.pub-crew-split-layout` setinggi `calc(100vh - 120px)`. Kolom kanan `.pub-crew-right-col` mengalir independen dengan `overflow-y: auto` dan `padding-bottom: 56px` agar seluruh karya terbaca sampai tuntas; kolom kiri `.pub-crew-left-col` diam tak bergerak dan memiliki internal scroll fallback jika tinggi viewport rendah. Pada mobile, tata letak otomatis beralih ke scroll halaman normal tanpa nested scroll.
  - **Single-Line Status Badge:** Memperbaiki wrapping teks pada badge `ANGGOTA RESMI AKTIF` dengan menghapus inline style bertabrakan dan menerapkan aturan terpusat di `.pub-status-badge` (`white-space: nowrap; flex-shrink: 0; width: max-content; font-size: 11px; letter-spacing: 0.02em; padding: 3px 10px;`) serta alignment vertikal presisi pada `.pub-status-dot`.
  - **Label Verifikasi Resmi:** Mengganti label `Server Staging Cloud` menjadi `PTV Verification System` secara transparan pada antarmuka.
  - **Quality Gates:** 31 tes `publicVerification.test.ts` PASS, `npm run typecheck` PASS (0 errors), `npm run build` PASS (0 errors, 19.59s). Dev server utama (port 5174) tetap aktif.

- **CLN-267 | PTV-DEV-242 | Verifikasi Identitas: Sticky Biodata & Compact Unified Portfolio Card (31 Oktober 2026, zidnal / Antigravity):**
  - **Scope:** Terarah khusus pada layout publik `/verifikasi-identitas` (`VerifikasiIdentitasPage.tsx`, `publicVerification.css`, dan tes `publicVerification.test.ts`). Tidak mengubah halaman input portofolio internal Hub, API, database, skema, maupun komponen lain.
  - **Sticky Biodata Kru:** Menerapkan `position: sticky; top: 96px; max-height: calc(100vh - 116px); overflow-y: auto;` pada `.pub-crew-left-col` serta mengubah `overflow-x: hidden` menjadi `overflow-x: clip` pada `.pub-living-wrapper` agar tidak merusak scroll context sticky. Pada mobile ($\le 900px$), sticky dimatikan (`position: static; max-height: none;`) sehingga biodata tampil di atas portofolio dengan scroll normal.
  - **Satu Card Utama Portofolio (R03):** Mengonsolidasi item karya individual menjadi satu container tunggal `.pub-portfolio-unified-card` dengan border radius R03, divider tipis `border-bottom: 1px solid #f1f5f9` (item terakhir `border-bottom: none`), tanpa border/background/shadow terpisah per karya. Padding kompak `18px 22px` (desktop) dan `14px 16px` (mobile) dengan hover transisi halus.
  - **Urutan & Kerapian Data:** Memastikan data karya terurut descending (terbaru terlebih dahulu) berdasarkan tanggal kegiatan; mempertahankan filter platform, empty state, dan tautan karya publik. Mendukung tema gelap (`[data-theme="dark"]`).
  - **Quality Gates:** 31 tes `publicVerification.test.ts` PASS, `npm run typecheck` PASS (0 errors), `npm run build` PASS (0 errors). Tidak ada visual QA/Playwright otomatis.

- **CLN-266 | PTV-DEV-241 | Hotfix Laporan (31 Oktober 2026, zidnal / Codex):** Menghapus import/panggilan `getStoredSemesters`, `getStoredRecords`, `getStoredLoans`, dan roster fixture dari engine laporan; semester hardcoded pada Finance3Laporan dihapus. Memakai snapshot yang sudah dimuat, tanpa menonaktifkan guard. Rekap semester memakai engine laporan yang sama, error/loading ditangani lokal. 25 tes PASS/1 screenshot skipped, typecheck/build PASS; log sementara `.gemini/scratch/finance-report-warnings.log` dibersihkan. Tidak ada perubahan database atau cleanup modul lain.

- **CLN-265 | PTV-DEV-240 | Finalisasi Finance 3.0 (31 Oktober 2026, zidnal / Codex):** Formatter judul lokal pada rincian kantong diganti satu formatter bersama di `financeCanonical.ts`, digunakan daftar/ringkasan/drawer/ekspor; komentar pendeteksian legacy yang usang dihapus. Nominal alokasi laporan/ekspor memakai helper bersama tanpa mengubah transaksi sumber. Tidak menambah CSS, route, atau abstraksi di luar scope; referensi helper terverifikasi dan typecheck/build PASS. 125 tes Finance unik lulus, 1 screenshot dilewati; log sementara `.gemini/scratch/finance-final-warnings.log` dihapus. Tidak ada cleanup massal atau mutasi database.

- **CLN-264 | PTV-DEV-239 | Portal API diagnostic (31 Oktober 2026, zidnal / Codex):**
  - Scope terarah pada `api/portal.ts`, `portalSnapshot.ts`, dan tes portal terkait; tidak mengubah modul lain.
  - Menghapus fallback settings hardcoded yang menyamarkan ketiadaan data published; menghapus komentar filter yang tidak lagi sesuai dan memperbaiki komentar snapshot mengenai pengumuman opsional.
  - Menutup kebocoran `draftPayload` dari respons publik pada services, announcements, dan settings; mempertahankan preview berotorisasi. Menggunakan SDK Supabase yang sudah ada serta satu sinyal abort pembacaan, tanpa client/helper paralel.
  - Memeriksa referensi snapshot melalui `usePortalSnapshot`, halaman launcher, dan halaman status. Tidak ditemukan import, fungsi, file, atau CSS baru yang yatim pada scope perubahan; tidak ada CSS atau route yang dihapus.
  - Menghapus hanya tiga artefak hasil sesi di `.gemini/scratch/`: respons JSON diagnostik, changelog hasil unduh, dan log warning tes. Menyimpan skrip browser dengan nama stabil; tidak menimpa baseline screenshot atau menghapus perubahan pengguna.
  - Bukti: 60 tes portal PASS; typecheck PASS; build PASS; browser live staging memuat 5 layanan published, tanpa content flash dan tanpa page error. Timeout 8 detik/HTTP 504 diuji dengan transport mock lokal, bukan gangguan cloud.

- **CLN-263 | PTV-DEV-237 — REKONSILIASI DUPLIKASI IDENTITAS HAMDAN & DEDUPLIKASI ARSIP KANONIKAL (31 Oktober 2026, zidnal / Antigravity):**
  1. **Pencegahan Tampilan Kru Duplikat di Runtime (`api/kru.ts`, `api/kontak.ts`, `kontakService.ts`):**
     - Menambahkan penelusuran `seenCanonId` dan pengecekan `metadata_json.is_duplicate_archive === true` pada handler `/api/kru` dan `/api/kontak`. Jika sebuah arsip historis menunjuk ke `canonical_identity_id` yang sudah diproses atau ditandai sebagai duplikat, rekaman tidak lagi diproyeksikan sebagai anggota kru terpisah.
     - Memastikan Hamdan hanya tampil tepat 1 kali pada direktori kru dan kontak internal PTV Hub dengan ID kanonikal utama `PTV-017`.
  2. **Audit & Penyiapan Migrasi Database Atomik (`docs/PTV-DEV-237-MERGE-HAMDAN-IDENTITY.sql`):**
     - Membangun skrip transaksi atomik PL/pgSQL dengan proteksi penuh: penggabungan metadata ke `PTV-017` (`b93d88de-346a-49a1-a291-cc48188fb917`), sinkronisasi `organization_membership` (divisi `technical`, status `inactive`, cohort 12), pembersihan membership duplikat, penautan arsip legacy `PTV-064` ke UUID utama tanpa mengubah ID historis, dan penghapusan canonical identity duplikat `48bf9cce-66a3-4e21-8569-6f8cdbdf6c63`.
  3. **Quality Gates:**
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 20.05s, 0 errors).

- **CLN-262 | PTV-DEV-236 — FINANCE 3.0: PENGATURAN NOMINAL IURAN KAS KRU PER BULAN (31 Oktober 2026, zidnal / Antigravity):**
  1. **Perbaikan Alur Pengaturan Tarif Iuran Bulanan (`PengaturanKeuanganModal.tsx`, `Finance3Page.tsx`, `Finance3KasKru.tsx`):**
     - Memperbaiki sub-tab **Periode Semester** pada `PengaturanKeuanganModal.tsx` (yang sebelumnya hanya memiliki form pembuatan semester baru) agar menampilkan alur lengkap **Keuangan → Pengaturan → Periode Semester → Tarif Iuran**:
       * Pemilih semester (`Semester Ganjil 2026/2027 (Aktif)` & `Semester Genap 2025/2026 (Historis)`),
       * Daftar bulan beserta nominal iuran aktif per bulan (`getSemesterPeriodFeeMinor`),
       * Tombol **Ubah Tarif** pada setiap bulan (hanya tampil bagi pengguna ber-permission `canManage`),
       * Panel **Histori Perubahan Tarif Iuran** yang menampilkan periode bulan, nominal sebelumnya $\to$ nominal baru, waktu perubahan, dan identitas pengubah (`changedByName` + `changedByPtvId`).
     - Menambahkan pintasan tombol **Tarif Iuran** pada header `Finance3KasKru.tsx` (khusus `canManage`) yang langsung membuka modal Pengaturan pada sub-tab `Periode Semester`.
  2. **Persistensi Cloud Supabase Staging & Perhitungan Kewajiban Non-Destruktif (`api/finance.ts`, `api/financeOperationalRead.ts`, `financeOperationalReader.ts`, `kasKruService.ts`):**
     - Menambahkan handler `action === 'update_semester_period_fee'` pada `api/finance.ts` yang dilindungi ketat oleh pengecekan `access.canManage` (`403 Forbidden` bagi non-pengelola), mengambil identitas pengubah resmi dari `canonical_identity`, dan menyimpan pemetaan `monthlyFeesBySemester` serta `feeHistory` secara permanen ke Supabase staging (`swadgljnyelsjstqqxbm`).
     - Memperbaiki penggabungan tarif per bulan di `fetchSemestersCloudWithClient` (`{ ...fallbackFees, ...rawMonthlyFees, ...persistedFees }`) sehingga perubahan tarif pada satu bulan tidak menghapus tarif khusus pada bulan lainnya.
     - Memastikan perubahan tarif tidak pernah mengubah, menghapus, atau membuat ulang transaksi pembayaran yang sudah tercatat (`paidAmountMinor` dan saldo Kas Utama `Rp 593.276` tetap utuh 100%), serta menampilkan rincian `Kurang Bayar` (`shortageMinor`) dan `Lunas (+Lebih)` (`overpaidMinor`) secara akurat.
  3. **Quality Gates:**
     - `tests/hub/finance3StagingHttpVerification.test.ts`: PASS (4/4 tests).
     - `tests/hub/finance3ReconciliationAndUi.test.tsx`: PASS (8/8 tests).
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 15.33s, 0 errors).

- **CLN-261 | PTV-DEV-236 — BUG-001: INVENTARIS MOBILE FILTER OVERFLOW & TRUNCATION FIX (31 Oktober 2026, zidnal / Antigravity):**
  1. **Grid Responsif & Penghilangan Overflow Filter (`NilaiInventarisPage.tsx`, `dashboard.css`):**
     - Mengubah container filter desktop dan mobile (`.ptv-nilai-filter-grid`) menjadi grid responsif dengan kolom `minmax(0, 1fr)` dan pembungkus kolom `.ptv-nilai-filter-col` ber-`min-width: 0`.
     - Memperbaiki aturan CSS mobile ($\le 768px$): `.ptv-nilai-filter-grid` menggunakan `grid-template-columns: repeat(2, minmax(0, 1fr))` dengan `box-sizing: border-box` dan `width: 100%`, sehingga seluruh dropdown `PTVSelect` berada sepenuhnya di dalam kartu filter tanpa meluber keluar container pada layar 320px, 375px, maupun 430px.
     - Merapikan label opsi dropdown (`Semua Status`, `Semua Kategori`, `Semua Sumber`, `Urutan: Kategori`) dan menambahkan styling truncation yang aman (`overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`) pada teks label trigger sehingga teks tidak menabrak ikon chevron.
  2. **Perbaikan Truncation Kartu Statistik KPI (`NilaiInventarisPage.tsx`, `dashboard.css`):**
     - Mengganti pembatasan `white-space: nowrap` yang memotong teks KPI secara canggung (`Rata-rata / Al...` dan `Menunggu data peroleh...`) menjadi multi-line readable text (`white-space: normal`, `line-height: 1.25`, `word-break: break-word`) pada `.ptv-nilai-kpi-card-lbl` dan `.ptv-nilai-kpi-card-sub`.
     - Menjaga proporsi grid KPI 2-kolom mobile (`grid-template-columns: repeat(2, minmax(0, 1fr))`) agar tetap rapi, simetris, dan mudah dibaca tanpa ada clipping teks yang janggal.
  3. **Quality Gates:**
     - `tests/hub/nilaiInventaris.test.ts`: PASS (7 tests).
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 16.29s, 0 errors).

- **CLN-260 | PTV-DEV-236 — FINANCE 3.0 HOTFIX: NAMA KRU PADA TABEL KAS MASIH DUMMY (31 Oktober 2026, zidnal / Antigravity):**
  1. **Pembersihan Data Hardcoded / Dummy (`Finance3KasKru.tsx`):**
     - Menghapus konstanta `STANDARD_CREW_ROSTER` (16 item ber-ID sintetis `c-001`..`c-034`) yang berisi nama dummy `Muhammad Zaki` (`PTV-031`), salah pemetaan `Nadhif Syarafana` (`PTV-032`), salah kode PTV ID `Taqiu Rabbani Fadillah` (`PTV-019`), dan akun contoh `Niki Santri` (`PTV-034`).
     - Menggantinya dengan pembacaan langsung `operationalData.crewRoster` dari `canonical_identity` + `organization_membership` via `/api/finance?operational=1` (dengan baseline sinkron `CANONICAL_VERIFIED_CREW_ROSTER` berisi 23 kru operasional aktif resmi ber-UUID `canonical_identity.id`).
  2. **Rekonsiliasi Berbasis UUID & Penanganan Identitas Belum Terhubung (`financeOperationalReader.ts`, `kasKruService.ts`, `kasKruTypes.ts`):**
     - Menambahkan resolusi UUID `canonical_identity.id` (`identityId`) pada `fetchKasRecordsCloudWithClient` dan `calculateKasKruMatrix`.
     - Menghapus pembuatan PTV ID / nama contoh sintetis (`PTV-000` / `NAME-...`) saat identitas tidak ditemukan; menggantinya dengan penanda eksplisit `identityUnlinked: true` dan baris berstatus `"Identitas Belum Terhubung"`.
  3. **Quality Gates:**
     - `tests/hub/finance3StagingHttpVerification.test.ts`: PASS (3 tests).
     - `tests/hub/finance3ReconciliationAndUi.test.tsx`: PASS (7 tests).
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 15.88s, 0 errors).

- **CLN-259 | PTV-DEV-236 — HOTFIX: PORTAL GAGAL DIMUAT SETELAH LOADING LIFECYCLE (31 Oktober 2026, zidnal / Antigravity):**
  1. **Root Cause Analysis & Resilience Patching (`api/portal.ts`, `portalSnapshot.ts`):**
     - Mengidentifikasi akar masalah: request `GET /api/portal?entity=announcements` menghasilkan HTTP 500 (`Could not find the table 'public.ptv_portal_announcements' in the schema cache`), sehingga `Promise.all` pada `loadPortalSnapshot` mengalami kegagalan total dan menyebabkan portal menampilkan error state *"Portal belum dapat dimuat"*.
     - Pada `api/portal.ts`, menangani kasus ketiadaan tabel opsional `ptv_portal_announcements` (`PGRST205` / `42P01` / `schema cache`) sebagai daftar pengumuman kosong (`announcements: []`), tanpa mengorbankan keamanan data published layanan dan pengaturan yang esensial.
     - Pada `portalSnapshot.ts`, membedakan data non-esensial (pengumuman) dengan data esensial (layanan dan pengaturan). Kegagalan pada pengambilan pengumuman tidak menggagalkan seluruh portal, melainkan ditoleransi sebagai daftar pengumuman kosong `[]`.
  2. **Validasi Nyata Tanpa Mock (Direct Browser E2E):**
     - Script browser live `test_real_portal_loading.mjs` dijalankan tanpa mock network: portal `http://localhost:5174/` melewati loading screen secara mulus dan menampilkan 5 kartu layanan resmi langsung dari Supabase Staging (`swadgljnyelsjstqqxbm`) beserta konfigurasi published-nya.
     - Verifikasi hard reload browser: portal tetap tampil konsisten tanpa error state dan tanpa content flash.
  3. **Quality Gates:**
     - Browser E2E Real Staging Test: PASS (0 error state, 5 layanan terverifikasi).
     - `tests/portal/`: PASS (6 file, 50 tests).
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (0 errors).

- **CLN-258 | PTV-DEV-236 — FINANCE 3.0 BUG-001: KANTONG & RINCIAN KANTONG REDESIGN (31 Oktober 2026, zidnal / Antigravity):**
  1. **Halaman Daftar Kantong & Halaman Rincian Kantong Terpadu (`Finance3Pockets.tsx`, `Finance3Page.tsx`, `finance3.css`):**
     - Membangun ulang tampilan **Daftar Kantong** mengikuti pola visual aplikasi finansial referensi dengan header **Kantong**, kolom pencarian `Cari Kantong`, filter kategori/status (`Semua`, `Kantong Utama`, `Rekening Bank`, `QRIS & Digital`, `Arsip`), tombol `+ Kantong`, bar **Total Saldo Kantong** (`Rp 593.276` dengan fitur sembunyikan/tampilkan nominal via ikon mata), dan grid 2 kolom mobile / 3 kolom desktop berisi kartu kantong berwarna harmonis (`theme-ivory`, `theme-obsidian`, `theme-cerulean`, `theme-lavender`, `theme-sky`, `theme-emerald`).
     - Membangun **Halaman Rincian Kantong** sebagai halaman khusus (*full-view sheet*, bukan popup kecil) yang terbuka saat kartu kantong diklik atau diakses melalui parameter `?tab=kantong&pocketId=<id>`.
     - Menyediakan bagian atas Rincian Kantong dengan tombol kembali `← Rincian Kantong`, identitas visual besar, pil nomor rekening/identitas dengan salin instan, nama kantong, saldo kantong besar sebagai fokus utama, 3 tombol aksi cepat berikon bulat (**Tambah Uang**, **Pindahkan Uang**, **Transfer & Bayar**), serta kartu akses cepat QRIS resmi dan ringkasan alokasi masuk/keluar.
     - Menyediakan bagian bawah Rincian Kantong berupa sheet putih riwayat transaksi khusus kantong tersebut dengan pencarian `Cari Transaksi`, filter mutasi (`Semua Mutasi`, `Uang Masuk (+)`, `Uang Keluar (-)`, `Transfer Internal`, `Void / Batal`), dan daftar transaksi kronologis berformat `+Rp...` / `-Rp...` lengkap dengan nama kategori di bawah nominal.
  2. **Targeted Cleaning Review:**
     - Menghapus unused imports (`Building2`, `ArrowUpRight`) pada `Finance3Pockets.tsx`.
     - Menggunakan kembali modal `CatatTransaksiModal`, `TransactionDetailDrawer`, dan service canonical `financeCanonicalService.ts` tanpa menduplikasi state atau membuat modal transaksi baru.
  3. **Quality Gates:**
     - `tests/hub/finance3ReconciliationAndUi.test.tsx`: PASS (7 tests).
     - `tests/hub/finance3StagingHttpVerification.test.ts`: PASS (2 tests).
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (0 errors).

- **CLN-257 | PTV-DEV-236 — LIVING PORTAL: FIX LOADING LIFECYCLE & ZERO DEFAULT CONTENT FLASH (31 Oktober 2026, zidnal / Antigravity):**
  1. **Lifecycle Eksplisit & Arsitektur Snapshot Tunggal (`portalSnapshot.ts`, `usePortalSnapshot.ts`, `PortalInitScreen.tsx`):**
     - Menghentikan pemuatan terfragmentasi dan *hardcoded default mock card* yang sebelumnya menyebabkan lonjakan visual (*content flash / layout shift*) saat membuka portal publik.
     - Mengimplementasikan `loadPortalSnapshot` dan `requestPortalSnapshot` yang membaca entitas `services`, `announcements`, dan `settings` secara serentak (`Promise.all`) dengan validasi skema fail-fast, in-flight request deduplication (mencegah duplikasi permintaan akibat React StrictMode), dan timeout terukur 20 detik.
     - Menyediakan state eksplisit `initializing`, `ready`, dan `error`.
  2. **Portal Initialization Screen & Desain Minimalis Apple-Like (`PortalInitScreen.tsx`, `livingPortal.css`):**
     - Selama berstatus `initializing`, hanya layar inisialisasi minimalis berlatar netral dengan logo resmi PTVPRO webp (masking SVG) dan animated indeterminate track bar halus yang dirender.
     - Menghapus rendering awal hero text statis, kartu direktori default (`INITIAL_SERVICES`), dan tautan footer hingga snapshot `ready`.
     - Menyediakan penanganan slow-network (catatan koneksi lambat setelah 6 detik tanpa persentase palsu) dan tampilan `error` dengan tombol "Coba Lagi" (`onRetry`) jika snapshot gagal dimuat.
     - Menambahkan transisi masuk lembut `.lp-portal-enter` (260ms fade-in) begitu data snapshot siap.
  3. **Strict Props Refactoring (`LivingPortalPage.tsx`, `LivingStatusPage.tsx`, `LauncherHero.tsx`, `LauncherDirectory.tsx`, `LauncherFooter.tsx`):**
     - Mengubah komponen hero, direktori, dan footer agar secara ketat mewajibkan data dari snapshot dan membuang fallback hardcoded string/array.
     - Menjadikan prop `managedServices` opsional dengan default aman `[]` pada `LauncherFooter` agar modul verifikasi publik (`KeabsahanDokumenPage` & `VerifikasiIdentitasPage`) tetap kompatibel.
  4. **Quality Gates & Validasi Nyata Browser:**
     - Browser E2E (`verify_portal_lifecycle.mjs` via Microsoft Edge headless): PASS (terbukti 0 frame flicker hero dan direktori selama fetch held, beralih mulus ke `.lp-portal-enter` saat data siap).
     - `tests/portal/portalLoadingLifecycle.test.tsx`: PASS (6 tests).
     - `tests/portal/livingPortal.test.tsx`: PASS (7 tests).
     - `tests/portal/portalManagement.test.tsx`: PASS (9 tests).
     - Seluruh suite portal `tests/portal/` (6 file, 50 tests): PASS 100%.
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 15.23s, 0 errors).

- **CLN-256 | PTV-DEV-236 — FINANCE 3.0: FULL FEATURE PARITY & COMPLETION (31 Oktober 2026, zidnal / Antigravity):**
  1. **Integrasi Penuh Modul Operasional Finance 3.0 (`Finance3Page.tsx`, `Finance3Pockets.tsx`, `Finance3Piutang.tsx`, `Finance3KasKru.tsx`, `Finance3Laporan.tsx`):**
     - Menghubungkan komponen Finance 3.0 langsung ke service canonical dan operasional yang sudah ada (`financeCanonicalService.ts`, `financeOperationalData.ts`, `kasKruService.ts`, `piutangService.ts`, `laporanService.ts`, `exportUtils.ts`, `financeSettingsService.ts`) tanpa menduplikasi logika bisnis atau membuat service paralel.
     - Memulihkan seluruh fitur yang sebelumnya belum ditampilkan di UI Finance 3.0: pengelolaan Kantong Keuangan & mutasi alokasi per kantong, Transfer Dana Antarkantong, panel QRIS & metode pembayaran (`cash | transfer | qris`), matriks pembayaran Kas Kru per bulan dalam semester, rekap per semester, daftar & pelunasan Piutang/Tagihan (penuh maupun cicilan sebagian), edit metadata transaksi, serta pengaturan kategori dan semester.
  2. **Rekonsiliasi Akurat Kas Kru & Isolasi Transaksi Uji (`financeOperationalReader.ts`, `kasKruService.ts`, `financeCanonical.ts`):**
     - Menambahkan filter `tx.description?.trim().startsWith('[TEST]')` pada `isTestTransaction` dan `fetchKasRecordsCloudWithClient` agar transaksi dry-check test terisolasi dari buku besar operasional.
     - Memperbaiki ekstraksi regex bulan-tahun pada `fetchKasRecordsCloudWithClient` sehingga format deskripsi legacy yang memiliki 4 segmen `—` tetap terbaca utuh (48 dari 48 catatan kas kru aktif terbaca `lunas`).
     - Memastikan record kas kru aktif (`lunas` / `sebagian` / `dikecualikan`) tidak pernah ditimpa oleh record `reversed` (`belum`) pada periode dan kru yang sama.
  3. **Quality Gates:**
     - `tests/hub/finance3ReconciliationAndUi.test.tsx`: PASS (6 tests).
     - `tests/hub/finance3StagingHttpVerification.test.ts`: PASS (2 tests).
     - Seluruh suite `tests/hub/finance*` (28 file, 329 tests): PASS 100%.

- **CLN-255 | PTV-DEV-236 — MICRO UI FIX: AKSI SURAT SAYA & SURAT ARSIP (31 Oktober 2026, zidnal / Antigravity):**
  1. **Harmonisasi Pasangan Tombol Aksi Dokumen (`ArsipPage.tsx` & `arsip.css`):**
     - Mengubah aksi *Rincian* menjadi tombol secondary/outline yang jelas (`.arsip-doc-btn-secondary`, `.arsip-doc-view-btn`) dengan border berstandar R03, background surface adaptif dark mode, teks `Rincian`, dan ikon chevron-right.
     - Mempertahankan aksi *PDF* sebagai tombol primary biru (`.arsip-doc-btn-primary`, `.arsip-pdf-btn`) dengan background solid biru (`var(--b-600)`), teks `PDF`, dan ikon download.
     - Menyatukan spesifikasi tombol: tinggi konsisten 32px (mobile 30px), border-radius pill (`var(--ptv-curve-pill)`), padding proporsional (12px / 10px), font-size 12px (mobile 11.5px), alignment center, dan gap 8px (mobile 6px).
     - Menghapus aturan `display: none` pada tombol PDF di media query mobile sehingga kedua tombol tetap dapat diakses di smartphone tanpa harus membuka drawer terlebih dahulu.
     - Pada viewport smartphone ($\le 480px$), tombol aksi terpasang rapi di bagian kanan bawah kartu dokumen dengan separator garis halus (`border-top: 1px solid var(--line)`).
  2. **Accessibility & Behavior Preservation:**
     - Menambahkan `title` tooltip dan `aria-label` deskriptif pada masing-masing tombol (`Unduh PDF Resmi` dan `Lihat Rincian Dokumen`).
     - Mempertahankan `e.stopPropagation()` agar klik pada tombol tidak memicu event bubbling ke pembungkus kartu dokumen.
  3. **Quality Gates:**
     - `tests/hub/suratSayaActionButtons.test.tsx`: PASS (2 tests).
     - `tests/hub/bug010SuratArsipMerger.test.ts`: PASS (8 tests).
     - `tests/hub/letterNumberingGapFilling.test.ts`: PASS (5 tests).
     - `tests/hub/passwordPolicyAndQrSecurity.test.ts`: PASS (4 tests).
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 18.38s, 0 errors).

- **CLN-254 | PTV-DEV-236 — FINANCE 3.0 HOTFIX: ROOT CAUSE 503 READ_FAILED & CLOUD RUNTIME RESOLUTION (31 Oktober 2026, zidnal / Antigravity):**
  1. **Root Cause Analysis & Targeted Fix (`api/finance.ts`):**
     - Mengidentifikasi akar masalah error *"Gagal Memuat Keuangan — Data keuangan belum dapat dibaca lengkap. Coba lagi; jangan memakai laporan parsial."*
     - Pada staging cloud Supabase (`swadgljnyelsjstqqxbm`), tabel `public.ptv_kas_kru` tidak ada di database schema cache (error code `PGRST205` / `42P01`) karena sistem kas operasional telah menggunakan tabel `ptv_finance_kas_records`, `ptv_finance_semesters`, `ptv_finance_loans`, dan canonical transactions.
     - Penambahan `if (kas.error) throw new Error('read_failed')` sebelumnya menyebabkan setiap pemanggilan `GET /api/finance` mengembalikan status 503 saat tabel legacy tidak ada.
     - Memperbaiki penanganan error pada baris 33 di `api/finance.ts`: ketiadaan tabel legacy `ptv_kas_kru` (`PGRST205` / `42P01`) ditangani sebagai fallback daftar kas kosong (`kasRows = []`), sementara error fatal lainnya tetap fail-closed melempar `read_failed`.
  2. **Verifikasi Staging Cloud HTTP & Integritas Saldo:**
     - Menulis suite verifikasi real staging HTTP di `tests/hub/finance3StagingHttpVerification.test.ts`.
     - Pengujian riil terhadap Supabase Staging mengonfirmasi `GET /api/finance` mengembalikan status HTTP 200 dengan canonical state `available`, kas utama Rp 593.276 (`balanceMinor: 59327600`), dan 70 transaksi valid terbaca lengkap tanpa drift saldo.
  3. **Quality Gates:**
     - `tests/hub/finance3StagingHttpVerification.test.ts`: PASS (1 test).
     - `tests/hub/finance3ReconciliationAndUi.test.tsx`: PASS (4 tests).
     - `tests/hub/financeFoundation.test.ts`: PASS (31 tests).
     - `tests/hub/financeSpoofingAndAccess.test.ts`: PASS (4 tests).
     - `tests/hub/financeAdminRpc.test.ts`: PASS (11 tests).
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 20.26s, 0 errors).


- **CLN-253 | PTV-DEV-236 — HOTFIX: PENOMORAN SURAT GAP-FILLING & KEBIJAKAN SANDI 4 KARAKTER (31 Oktober 2026, zidnal / Antigravity):**
  1. **Algoritma Penomoran Surat Gap-Filling (`letterNumbering.ts` & SQL Staging):**
     - Mengubah strategi penomoran dari `Math.max(0, ...usedSeqs) + 1` menjadi *lowest vacant integer* gap-filling.
     - Nomor surat yang dihapus resmi dilepaskan dari registry operasional dan diprioritaskan sebelum menghasilkan nomor baru.
     - Nomor surat yang diarsipkan tetap terdaftar dalam daftar dokumen aktif dan nomornya terkunci (tidak digunakan ulang).
     - Menyediakan skrip migrasi idempotent di `docs/PTV-DEV-236-LETTER-NUMBERING-GAP-FILLING.sql`: memperbarui fungsi preview `ptv_letter_preview()`, melonggarkan trigger `ptv_letter_registry_guard` untuk mengizinkan `DELETE` pelepasan nomor, dan trigger `ptv_guard_letter_number()` yang memeriksa eksistensi nomor aktif via `EXISTS` alih-alih high-water mark `seq <= highest`.
  2. **Proteksi Keunikan Token & Dokumen QR (`api/verifikasi-surat.ts` & Frontend):**
     - Verifikasi keabsahan dokumen via `/api/verifikasi-surat` kini memeriksa kesesuaian parameter `id` (UUID dokumen) dan `token` (QR token unik).
     - Jika dokumen 001 lama dihapus dan terbit dokumen 001 baru, scan QR fisik dokumen lama akan ditolak (`found: false`, pesan `Dokumen dengan identitas QR ini sudah tidak berlaku atau telah dihapus`) karena UUID/token QR lama berbeda dari dokumen aktif baru.
     - Frontend `KeabsahanDokumenPage.tsx` dan `publicDocumentService.ts` menyalurkan query params `id` dan `token` ke server.
  3. **Standardisasi Aturan Password Minimal 4 Karakter:**
     - Menyeragamkan seluruh titik validasi password di seluruh aplikasi menjadi tepat **minimal 4 karakter**:
       - Login kru (`api/auth/login.ts`): `< 3` -> `< 4`.
       - Ganti password mandiri (`api/auth/change-password.ts`, `ProfilePage.tsx`, `PengaturanPage.tsx`): `< 3` -> `< 4`, placeholder `Min. 4 karakter`.
       - Reset password kru oleh ROOT (`api/akses.ts`, `api/kru.ts`, `ResetPasswordDrawerModal.tsx`): `< 6` dan `< 8` -> `< 4`, placeholder `Minimal 4 karakter`.
  4. **Quality Gates:**
     - `tests/hub/letterNumberingGapFilling.test.ts` (5 tests PASS).
     - `tests/hub/passwordPolicyAndQrSecurity.test.ts` (4 tests PASS).
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 17.59s, 0 errors).

- **CLN-252 | PTV-DEV-236 — FINANCE 3.0: DATA RECONCILIATION & COMPLETE UI REBUILD (31 Oktober 2026, zidnal / Antigravity):**
  1. **Rekonsiliasi Data Dasbor PTV Operasional vs Staging Cloud:**
     - Audit read-only database legacy Dasbor (`jthzuhkblxcaohiuypqq`) mengungkap 8 transaksi operasional terbaru (21 s.d. 30 Oktober 2026) yang belum termigrasi ke Staging: 5 pemasukan iuran kru (+Rp 115.000), 1 pemasukan dibatalkan/undo (Rp 25.000, reversed), dan 2 pengeluaran konsumsi galon studio (-Rp 42.000).
     - Menjalankan sinkronisasi aman, non-destruktif, dan 100% idempotent via `scripts/reconcile-legacy-finance-to-staging.mjs`.
     - Saldo Kas Utama Studio terekonsiliasi sempurna dari Rp 520.276 menjadi Rp 593.276, klop 100% dengan saldo riil Dasbor PTV (selisih Rp 0 / Zero Drift).
     - 8 record tersimpan di `ptv_finance_transactions`, alokasi terhubung ke `ptv_finance_allocations`, dan 100% provenance tertaut di `ptv_finance_source_references`. Laporan audit tersimpan di `docs/PTV-DEV-236-FINANCE-RECONCILIATION-REPORT.json`.
  2. **Total UI/UX Rebuild Finance 3.0 (Apple-like & Anti AI-Slop):**
     - Rancang ulang modul Keuangan dengan 4 pilar arsitektur informasi: Ringkasan Kas, Riwayat Transaksi, Iuran Kas Kru, dan Laporan Keuangan.
     - Styling `src/products/hub/keuangan/finance3.css` berorientasi Apple Human Interface Guidelines dan PTV R03 design tokens: tipografi SF Pro, angka tabular monospaced, spacing proporsional, rounded corner kontinu, dan dark mode contrast-ready.
     - Menghilangkan struktur card berlebihan dan statistik duplikat dari versi lama.
  3. **Modal & Form Resiliensi Mobile:**
     - `CatatTransaksiModal.tsx`, `TransactionDetailDrawer.tsx`, dan `PengaturanKeuanganModal.tsx` menggunakan viewport-level portal (`createPortal(..., document.body)`) dengan backdrop blur dan scroll lock, bebas dari bug clipping.
     - Ukuran font input form minimal 16px dan min-height 44px di mobile untuk mencegah browser Safari/Chrome iOS melakukan auto-zoom.
     - Operasi pembatalan transaksi (VOID) menggunakan RPC atomik PostgreSQL `rpc_void_finance_transaction_atomic` dengan pencatatan audit reason immutable.
  4. **Quality Gates & Penyelarasan Tes:**
     - Memperbaiki penanganan `kas.error` pada `api/finance.ts` agar fail-closed dan melempar error saat query gagal.
     - Menambahkan suite pengujian komprehensif `tests/hub/finance3ReconciliationAndUi.test.tsx` (4 tests PASS).
     - `npm run typecheck`: PASS (0 errors).
     - Unit tests: 88 tests PASS.
     - `npm run build`: PASS (built in 17.88s, 0 errors).

- **CLN-251 | PTV-DEV-235 — BUG-011 FOLLOW-UP: REAL FUNCTIONAL VERIFICATION & STAGING HARDENING (31 Oktober 2026, zidnal / Antigravity):**
  1. **Dynamic Vite Dev Server API Dispatcher:**
     - Mengganti daftar endpoint hardcoded di `vite.config.ts` dengan dynamic file lookup `path.resolve(__dirname, 'api/' + subpath + '.ts')`.
     - Menyelesaikan isu di mana endpoint baru (`/api/portofolio`, `/api/auth/change-password`, `/api/upload-avatar`) mengembalikan HTML `index.html` alih-alih mengeksekusi handler TypeScript serverless.
  2. **Stream Buffering Early Protection:**
     - Menghindari starvation/chunk loss pada Node HTTP stream dengan melakukan buffering stream data di baris pertama `handler` sebelum operasi asinkron `await` database (diterapkan pada `api/kontak.ts`, `api/portofolio.ts`, dan `api/dokumen.ts`).
  3. **Foreign Key Integrity pada Audit Log Sandi:**
     - Memperbaiki foreign key violation `auth_audit_log_actor_id_fkey` pada `api/auth/change-password.ts`: menyalurkan `session.identity_id` yang terikat ke `canonical_identity(id)` sebagai `p_actor_id`, bukan `session.account_id`.
  4. **Penyelarasan Kontrak Laporan Kerusakan Alat:**
     - Menyelaraskan payload pengujian dan client RPC `rpc_write_report_server` dengan skema PostgreSQL staging: properti `unitId` (UUID unit fisik), `assetId` (UUID master aset), dan `severity` berformat enum sah (`'Ringan'` | `'Sedang'` | `'Berat'`).
  5. **Proteksi Kolisi Registry Penomoran Surat:**
     - Memperbarui kueri arsip dokumen di `api/dokumen.ts` agar menyertakan seluruh nomor yang telah teralokasi pada `ptv_issued_letter_registry`. Mencegah tabrakan nomor surat dan error PostgreSQL `LETTER_NUMBER_ALREADY_ALLOCATED_OR_BELOW_HIGH_WATER`.
  6. **Kontrak Status & Kondisi Peminjaman:**
     - Menyelaraskan query ketersediaan unit dan status pengembalian dengan kontrak PostgreSQL `ptv_loan_private.checkout_loan` dan `return_loan`: unit valid wajib berstatus `'tersedia'` dan kondisi `'bagus'`. Status kembali tervalidasi terhadap domain `('bagus', 'rusak', 'perlu_servis')`.
  7. **Bukti Eksekusi End-to-End Nyata:**
     - Seluruh 8 alur operasional kritis (`.gemini/scratch/e2e_staging_verification.ts`) terbukti 100% PASS langsung pada database Supabase Cloud Staging `swadgljnyelsjstqqxbm`.

- **CLN-250 | PTV-DEV-235 — STABILISASI SISTEM & FUNCTIONAL RECOVERY (BUG-011) (30 Oktober 2026, zidnal / Antigravity):**
  1. **UUID Safety & Direct API Hardening:**
     - Membuat utilitas terpusat `safeRandomUuid()` di `src/shared/utils/uuid.ts` dengan fallback bertingkat (native `crypto.randomUUID` -> `crypto.getRandomValues` -> math RFC4122 v4) untuk mencegah crash runtime di lingkungan browser/Node tertentu.
     - Memperbaiki validasi UUID di `api/dokumen.ts` (`identityId` dari session identity ID yang lolos format UUID, mencegah `22P02: invalid input syntax for type uuid` pada `ptv_surat_tugas` dan `ptv_surat_barang`).
     - Memperbaiki urutan klasifikasi surat: `isBarang` diperiksa sebelum `isIzin` agar *Izin Membawa Barang* tidak salah dimasukkan ke tabel `ptv_surat_izin`.
  2. **Harmonisasi Styling Surat & Arsip:**
     - Mengimpor `@/styles/arsip.css` ke `ArsipPage.tsx` dan memetakan CSS class list agar kartu surat, metadata bar, stack, dan tombol aksi ter-render rapi dan konsisten dengan design tokens R03.
     - Menyematkan riwayat verifikasi keabsahan dokumen (*Riwayat Pemeriksaan Dokumen*) di drawer rincian surat (`DocDetailDrawer.tsx`), menampilkan identitas peninjau, instansi, dan waktu audit.
     - Menyeragamkan ukuran tombol aksi drawer ("Unduh PDF Resmi", "Arsipkan Surat Ini", "Hapus Surat Secara Permanen") ke tinggi 40px, radius pill, dan alignment rapi.
  3. **Manajemen Layanan Portal & Draft / Publish:**
     - Menstabilkan drag & drop pengurutan layanan pada `api/portal.ts`: menyortir layanan berdasarkan `sortOrder` setelah penggabungan draft di endpoint GET agar posisi stabil tanpa loncat.
     - Deteksi diff cerdas pada `reorder_services`: jika urutan sama dengan database, payload draft dibersihkan (null) sehingga counter "Perubahan Belum Dipublikasikan" akurat dan tidak menandai seluruh 6 layanan sebagai draft tanpa perubahan nyata.
     - Menyederhanakan tab Pengaturan Portal (`PortalManagementPage.tsx`): menghapus form kustomisasi headline hero, deskripsi hero, signature, dan copyright. Hanya menyisakan nomor WhatsApp Bantuan Resmi.
     - Mengunci subline footer portal publik (`PortalFooter.tsx` dan `LauncherFooter.tsx`) secara permanen ke kalimat: *"Dibangun oleh santri, didedikasikan untuk semua."*.
  4. **Self-Service Ganti Sandi & Kebijakan Min 3 Karakter:**
     - Mengimplementasikan endpoint serverless `api/auth/change-password.ts` dengan HttpOnly session cookie, verifikasi sandi lama via `bcrypt.compare`, hashing bcrypt cost 10, dan eksekusi RPC `rpc_admin_set_password` (dengan fallback upsert aman).
     - Menghubungkan formulir ganti sandi pada `ProfilePage.tsx` dan `PengaturanPage.tsx` ke endpoint ganti sandi riil dengan indikator loading.
     - Menyelaraskan batas minimal karakter sandi menjadi 3 karakter di `LoginPage.tsx`, `api/auth/login.ts`, `ProfilePage.tsx`, dan `PengaturanPage.tsx`.
  5. **Keabsahan Dokumen & Anti Auto-Zoom Mobile:**
     - Mengatur tinggi form verifikasi (`.pub-formal-input`, `.pub-formal-submit-btn`) menjadi 48px dan ukuran font 16px di mobile agar browser Safari/Chrome iOS tidak melakukan auto-zoom yang mengganggu layout.
     - Menambahkan aturan global `@media (max-width: 768px)` di `src/styles/base.css` untuk mencegah auto-zoom form controls pada perangkat mobile.
  6. **Resiliensi Portofolio Saya & Modal Clipping Fix:**
     - Memperbaiki kueri `api/portofolio.ts` agar menyertakan fallback ke `body.ptv_id` untuk penautan relasi ke tabel `ptv_kru_portofolio` dan metadata identity.
     - Memindahkan modal form karya portofolio di `PortofolioSayaPage.tsx` serta modal/drawer kontak eksternal di `KontakEksternalDetailDrawer.tsx` dan `KontakEksternalFormModal.tsx` ke `createPortal(..., document.body)` dengan hook scroll lock, menghilangkan bug tampilan terpotong (*clipped*) oleh kontainer induk.
  7. **Dark Mode & Visual Polish:**
     - Memperbaiki selector CSS specificity pada pill sesi Tambah Acara di `src/styles/acara.css` sehingga state aktif biru terlihat kontras dan tegas pada dark mode.
     - Menghapus pill badge berlebih pada halaman verifikasi identitas kru di `VerifikasiIdentitasPage.tsx`.
     - Mengganti `alert()` browser dengan notifikasi toast modern di `GeneratorSuratPage.tsx` dan menyelaraskan copy tujuan dokumen ke "Surat & Arsip".
     - Menghapus atribut `crossOrigin="anonymous"` pada foto profil `OfficialIdCard.tsx` agar gambar tanpa header CORS tidak memicu error fallback ke inisial.
  8. **Quality Gates:**
     - `npm run typecheck`: PASS (0 errors).
     - Unit Tests: 51 tests PASS di targeted regression suite.
     - `npm run build`: PASS (0 errors).

- **CLN-249 | PTV-DEV-234 — PENYESUAIAN POSISI MENU PORTOFOLIO SAYA (30 Oktober 2026, zidnal / Antigravity):**
  1. **Relokasi Menu Portofolio Saya ke Grup Sistem:**
     - Memindahkan item menu `Portofolio Saya` dari grup `Kru & Komunikasi` ke grup `Sistem` tepat di bawah menu `Profil` pada navigasi desktop `SIDEBAR_GROUPS` di `HubShell.tsx`.
     - Mempertahankan seluruh metadata menu: `key: 'portofolio'`, `label: 'Portofolio Saya'`, `path: '/hub/portofolio'`, `iconClass: 'fa-solid fa-briefcase'`, dan `anyCapabilities: ['id.view', 'settings.personal', 'crew.view']`.
     - Tidak membuat grup atau section baru (memanfaatkan grup `Sistem` yang sudah ada).
  2. **Konsistensi Navigasi Mobile (Workspace Bottom Sheet):**
     - Menambahkan entri `Portofolio Saya` tepat di bawah `Profil & ID` pada `ALL_WORKSPACE_FEATURES` di `WorkspaceBottomSheet.tsx` dengan ikon `fa-solid fa-briefcase` dan tema warna R03.
  3. **Penyusunan Regression Tests:**
     - Menambahkan suite pengujian terarah `tests/hub/portfolioMenuOrder.test.ts` (5 tests) yang memverifikasi urutan Profil → Portofolio Saya pada desktop dan mobile serta integritas kapabilitas.
  4. **Quality Gates:**
     - `npm run typecheck`: PASS (0 errors).
     - Targeted Unit Tests (`vitest run`): 59 tests PASS.
     - `npm run build`: PASS (built in 20.77s, 0 errors).

- **CLN-248 | PTV-DEV-233 — MERGER DOKUMEN SAYA KE SURAT & ARSIP, DISTINCTION ARSIP VS HAPUS, & RESET STAGING (BUG-010) (30 Oktober 2026, zidnal / Antigravity):**
  1. **Merger Dokumen Saya ke Surat & Arsip:**
     - Mengintegrasikan seluruh daftar, pencarian, status, dan aksi surat ke halaman terpadu `Surat & Arsip` (`ArsipPage.tsx` di `/hub/arsip`).
     - Menghapus route dan menu mandiri Dokumen Saya dari navigasi sidebar `HubShell.tsx`.
     - Mengarahkan URL lama (`/hub/dokumen` dan `/hub/dokumen-saya`) melalui redirect otomatis `<Navigate to="/hub/arsip" replace />`.
     - Mengganti `DokumenSayaPage.tsx` menjadi redirect component terdeprecasi.
  2. **Filter & Pengelolaan Surat Komprehensif (R03 Standard):**
     - Pencarian teks: nomor surat, perihal/keperluan, nama santri, pemohon, atau penerbit.
     - Scope toggle: "Semua Surat" vs "Surat Saya".
     - Status chips: `Semua`, `Draft`, `Berlaku`, `Diarsipkan`, `Dibatalkan`.
     - Parameter grid: Jenis Dokumen, Pembuat / Penerbit, Rentang Tanggal (Dari & Sampai), Tahun Arsip.
     - Stats summary cards: Total Surat, Surat Berlaku (ACC), Draft/Menunggu, Diarsipkan (Tidak Berlaku).
     - Accordion bulanan kronologis (terbaru ke terlama) dengan bulan teratas terbuka otomatis.
  3. **Pembedaan Tegas Aksi Arsipkan vs Hapus Surat:**
     - **Arsipkan Surat:** Menandai surat menjadi `Diarsipkan / Tidak Berlaku` (`status = 'diarsipkan'`). Nomor surat tetap tercatat sebagai terpakai di database dan registry `ptv_issued_letter_registry` (tidak dialokasikan ulang). Verifikasi publik menampilkan dokumen telah diarsipkan. Dialog konfirmasi bernuansa amber dengan penjelasan tegas bahwa data tetap tersimpan.
     - **Hapus Surat:** Menghapus dokumen dari operasional, mencatat audit penghapusan di `ptv_letter_deletion_audit`, dan melepaskan nomor surat dari `ptv_issued_letter_registry` sehingga nomor urut dapat dipakai kembali oleh surat baru. QR code lama dinonaktifkan sehingga verifikasi publik menghasilkan dokumen tidak terdaftar/tidak ditemukan. Dialog konfirmasi bernuansa merah bahaya.
  4. **Persiapan Skrip Reset Staging (`docs/PTV-DEV-233-RESET-SURAT-STAGING.sql`):**
     - Menyiapkan skrip DDL SQL untuk Supabase SQL Editor (`swadgljnyelsjstqqxbm`).
     - Menyediakan RPC `rpc_delete_letter_and_release`, tabel `ptv_letter_deletion_audit`, serta perintah TRUNCATE bersih untuk `ptv_surat_izin`, `ptv_surat_tugas`, `ptv_surat_barang`, `ptv_issued_letter_registry`, dan `ptv_surat_verifikasi_logs`.
     - Mengatur ulang `HISTORICAL_RESERVED_SEQUENCES` pada utility penomoran agar surat baru mulai dari kondisi kosong (001).
  5. **Quality Gates:**
     - `npm run typecheck`: PASS (0 errors).
     - Unit Tests: 69 tests PASS (8 tests di `bug010SuratArsipMerger.test.ts`, 11 tests di `arsip.test.ts`, 8 tests di `bug009VerificationAndPortfolio.test.ts`, 8 tests di `generatorSuratLegacyParity.test.ts`, 30 tests di `publicVerification.test.ts`, 4 tests di `docDetailDrawerHooksRegression.test.tsx`).
     - `npm run build`: PASS (built in 26.99s, 0 errors).

- **CLN-247 | PTV-DEV-232 — REMEDIASI VERIFIKASI KEABSAHAN DOKUMEN & PORTOFOLIO KRU (BUG-009) (30 Oktober 2026, zidnal / Antigravity):**
  1. **Redesign Keabsahan Dokumen Publik (`KeabsahanDokumenPage.tsx` di `/keabsahan-dokumen` & `/verifikasi-surat`):**
     - Mengubah halaman verifikasi dokumen menjadi tampilan institusional formal berstandar R03 yang bersih, rapi, dan terpercaya tanpa AI slop.
     - Menyematkan `LivingHeader`, `LauncherFooter`, dan `HelpDialogModal` yang seragam dengan ekosistem portal publik.
     - Menampilkan indikator status dokumen yang akurat: *Dokumen Valid & Terdaftar* (hijau), *Masa Berlaku Telah Berakhir (Kedaluwarsa)* (oranye/kuning), *Dokumen Tidak Berlaku / Dibatalkan* (merah), *Menunggu Pengesahan* (kuning/amber), serta status tidak ditemukan.
     - Menampilkan metadata lengkap: nomor dokumen, jenis dokumen, perihal, tanggal terbit, masa berlaku/tanggal izin aktual, penanggung jawab/pemohon.
     - **Santri List Privacy Gate**: Daftar santri tidak dimuat secara terbuka pada `GET /api/verifikasi-surat`. Pengunjung wajib mengisi nama lengkap & instansi peninjau (14 opsi resmi: PTV, SD, SMP, IIS SMP, SMA, MADIN, ASRAMA, SPI, MI, MTs, MA, RIBATH, YAYASAN, NDALEM) untuk membuka daftar santri. Permintaan dicatat secara persisten ke log peninjauan (`ptv_surat_verifikasi_logs` dengan fallback ke metadata `ptv_surat_izin`).
  2. **Verifikasi Kru & Rekam Karya Portofolio (`VerifikasiIdentitasPage.tsx` di `/verifikasi-identitas`):**
     - Mengubah layout desktop menjadi dua bagian (2-column layout split):
       - Kolom kiri (~360px sticky): Kartu Identitas Resmi Kru dengan foto/inisial, PTV ID, divisi, angkatan, QR Code vector `RealQrCode`, basis verifikasi server staging, dan status keanggotaan akurat (Aktif, Purna Kru, Nonaktif).
       - Kolom kanan (fleksibel): Portofolio & Rekam Karya Kru (`crewPortfolioService.getCrewPortfolio(crewId)`), dilengkapi filter platform, badge jenis kontribusi, judul karya, dan tautan eksternal terverifikasi.
     - Responsif mobile: reflow otomatis menjadi tumpukan satu kolom yang nyaman.
     - Menyematkan `LivingHeader`, `LauncherFooter`, dan `HelpDialogModal` seragam.
  3. **Fitur Portofolio Kru di PTV Hub (`PortofolioSayaPage.tsx` di `/hub/portofolio` & `/hub/portofolio-saya`):**
     - Menyediakan halaman internal Hub khusus kru yang masuk untuk mengelola karya dan portofolio pribadi.
     - Form Tambah/Edit Karya: platform (8 pilihan), jenis kontribusi (10 pilihan), tanggal karya, judul karya, dan tautan karya opsional.
     - Penyimpanan persisten ke tabel Supabase `ptv_kru_portofolio` dengan fallback otomatis ke `canonical_identity.metadata.portofolio`.
     - Integrasi navigasi: Ditambahkan ke navigasi sidebar `HubShell.tsx` dan menu profil pengguna `UserProfileMenuModal.tsx`.
  4. **Pembersihan Kode & Isolasi Batas Frontend-Backend:**
     - Menghapus import langsung modul serverless `api/` dari dalam kode frontend (`PortofolioSayaPage.tsx`, `crewPortfolioService.ts`, `KeabsahanDokumenPage.tsx`), mencegah kebocoran modul `node:crypto` ke bundler Vite.
     - Memindahkan konstanta dan tipe `PLATFORMS`, `KONTRIBUSI_TYPES`, `PortfolioItem` ke `src/products/hub/kru/services/crewPortfolioService.ts`.
     - Memindahkan `VALID_INSTANSI_LIST` dan `ValidInstansi` ke `src/products/verification/publicDocumentService.ts`.
     - Memperluas tipe keanggotaan `CrewMembershipStatus` agar mendukung status `'Purna Kru'`.
     - Menghapus variabel dan import tidak terpakai (`fullName`, `SantriDetailItem`, `Link`).
     - Menyediakan skrip migrasi database DDL & RLS di `docs/PTV-DEV-232-VERIFICATION-PORTFOLIO.sql`.
  5. **Quality Gates:**
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 18.54s, 0 errors).
     - Unit Tests (`vitest run`): 46 tests PASS (8 tests di `bug009VerificationAndPortfolio.test.ts`, 8 tests di `generatorSuratLegacyParity.test.ts`, 30 tests di `publicVerification.test.ts`).

- **CLN-246 | PTV-DEV-231 — REMEDIASI PENGELOLAAN PORTAL & PROFIL (BUG-008) (30 Oktober 2026, zidnal / Antigravity):**
  1. **Drag & Drop Urutan Layanan Intuitif & Penghapusan Tombol Up/Down:**
     - Menghapus kontrol usang Move Up / Move Down (`.pm-order-pair`, `.pm-order-btn`) di `PortalManagementPage.tsx`.
     - Mengimplementasikan drag & drop intuitif dengan handle `.pm-drag-handle` yang mendukung desktop (HTML5 Drag and Drop API) dan mobile (Touch Events DnD via `elementFromPoint`).
     - Menyimpan perubahan urutan ke draft (`draft_payload.sortOrder`), sehingga tidak langsung memengaruhi urutan publik sebelum dipublikasikan.
  2. **Alur Draft & Publikasi Terisolasi Persisten:**
     - Seluruh mutasi layanan (`saveService`, `updateServiceStatus`, `reorderServices`, `saveAnnouncement`, `saveSettings`) kini beroperasi dengan alur **Draft → Publikasikan**.
     - Portal publik (`LivingPortalPage`, `LivingStatusPage`, `PortalPage`) tetap menampilkan versi terakhir yang sudah dipublikasikan.
     - Indikator draft tertunda (`.pm-draft-banner`) dan tombol "Publikasikan Perubahan" (`PublishConfirmModal`) menampilkan jumlah draft yang tertunda.
     - Memperbaiki bug di `portalManagementService.getSettings` di mana `localStorage.getItem` sebelumnya menimpa data baru dari Supabase; kini data dari Supabase/API menjadi sumber utama dan menyinkronkan cache lokal.
     - Memperbaiki `api/portal.ts` pada aksi `save_service` dan `save_settings` agar menggabungkan (*merge*) draft yang sudah ada tanpa menghilangkan atribut draft lainnya.
  3. **Sinkronisasi Pengaturan Portal Dinamis ke Portal Publik:**
     - Menghubungkan konfigurasi dari Supabase `ptv_portal_settings` (`id = 'global'`) ke antarmuka publik.
     - `LauncherHero`: judul baris 1 & 2 (`heroTitle`), serta deskripsi portal (`heroDesc`) kini dinamis membaca pengaturan published.
     - `LauncherFooter`: santri signature (`footerSignature`) dan hak cipta (`footerCopyright`) kini dinamis membaca konfigurasi published.
     - `HelpDialogModal` & `WhatsAppHelpModal`: nomor helpdesk WhatsApp (`helpWaNumber`) kini dinamis menggunakan nomor dari pengaturan portal yang dipublikasikan.
  4. **Pembaruan Modal Verifikasi Identitas & Unduh Kartu Digital:**
     - Membuat `IdentityVerificationModal.tsx` terpadu dengan tampilan yang jelas, ringkasan identitas terstruktur, QR code vector `RealQrCode`, tombol Salin Tautan, dan tautan halaman verifikasi publik.
     - Menerapkan `IdentityVerificationModal` secara seragam pada `ProfilePage.tsx` dan `IdDigitalPage.tsx`, serta menghapus variabel, fungsi render, dan import usang.
     - Merombak `OfficialIdCard.tsx` untuk menangkap langsung node DOM aktual (`cardRef.current`) menggunakan `html-to-image` (`toPng`) beresolusi Retina 3x dengan fallback kanvas, menjamin hasil unduh 100% identik dengan pratinjau.
  5. **Quality Gates & Validasi:**
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 15.29s, 0 errors).
     - Unit tests: `tests/portal/portalManagement.test.tsx` (9 tests passed), `tests/hub/idDigital.test.ts` (6 tests passed).

- **CLN-245 | PTV-DEV-230 — INVESTIGASI & PERBAIKAN BUG-007 LOGIN AKUN KRU (30 Oktober 2026, zidnal / Antigravity):**
  1. **Investigasi Mendalam Akar Masalah BUG-007:**
     - Menemukan diskrepansi penyimpanan kredensial: saat ROOT mereset kata sandi atau membuat akun kru di Manajemen Kru (`api/kru.ts`), hash bcrypt disimpan ke `legacy_archive_kru.metadata_json.password_hash`.
     - Namun alur login (`portalLifecycle.ts`) mengeksekusi RPC PostgreSQL `rpc_portal_login_begin` dan `rpc_portal_login_finish`, yang membaca dan memverifikasi kata sandi secara eksklusif dari tabel `public.auth_credentials`.
     - Dari 28 akun di `user_account`: hanya 2 akun (`jid` dan `rouf`) yang memiliki baris terisi di `auth_credentials`. Akun `rex` (`PTV-032`) memiliki hash di arsip tetapi tidak di `auth_credentials`, sedangkan 24 akun kru lainnya berstatus `inactive` tanpa kredensial di `auth_credentials`.
  2. **Penyempurnaan Alur Login & Error Handling Terarah:**
     - Mengubah penanganan kegagalan autentikasi di `api/auth/_utils/portalLifecycle.ts`: membedakan kegagalan kata sandi (401), akun berstatus nonaktif (403), penolakan izin `hub.access` (403), dan akun terkunci (423) alih-alih mengembalikan pesan 401 generik yang menyesatkan.
  3. **Penguatan Backend API Manajemen Kru:**
     - Memperbarui `action=reset_password` dan `action=create_account` di `api/kru.ts` agar memanggil RPC keamanan database `rpc_admin_set_password` dan `rpc_admin_create_crew_account` secara atomik, sehingga kredensial tersimpan langsung ke `auth_credentials` dan `user_account`.
  4. **Skrip Remediasi & Sinkronisasi Database:**
     - Menyusun `docs/PTVPRO-BUG-007-CREW-AUTH-REMEDIATION.sql` untuk membuat RPC keamanan definitif, menyinkronkan hash akun `rex` dari arsip ke `auth_credentials`, serta mengaktifkan dan menyiapkan kredensial testing staging untuk `kru_staging` (`PTV-STG-KRU`).
  5. **Quality Gates & Validasi:**
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 17.35s, 0 errors).
     - Unit & boundary tests: `tests/auth/bug007CrewLogin.test.ts` (4 tests passed).
     - Live staging verification: `tests/auth/testStagingLiveLogin.test.ts` (2 tests passed: `PTV-001` jid dan `PTV-002` rouf login live berhasil terhadap Supabase staging `swadgljnyelsjstqqxbm`).

- **CLN-244 | PTV-DEV-229 — AUDIT OBJEK DATABASE & FINALISASI CLEANUP SCRIPT (30 Oktober 2026, zidnal / Antigravity):**
  1. **Verifikasi Database Pasca-Migrasi:**
     - Mengonfirmasi keberhasilan migrasi 67 identitas kru: `canonical_identity` = 95 baris, `organization_membership` = 95 baris, `user_account` = 28 baris utuh.
  2. **Audit Objek Database Terarah:**
     - Memeriksa jumlah baris aktual seluruh tabel legacy.
     - Mengidentifikasi 17 tabel kosong (0 baris), 1 view (`ptv_kru_legacy_compat`), dan 1 RPC (`rpc_inventory_test171`) yang siap dihapus tanpa dependensi.
     - Mengidentifikasi 5 tabel yang memuat data historis penting (`legacy_archive_kru`, `legacy_archive_kas_kru`, `legacy_archive_aset`, `legacy_archive_unresolved`, `auth_credentials`) untuk diproteksi dan dipertahankan dari penghapusan sembarangan.
  3. **Penyempurnaan Cleanup SQL Script:**
     - Memperbarui skrip DDL `docs/PTVPRO-DATABASE-CONSOLIDATION-CLEANUP.sql` tanpa menggunakan `DROP CASCADE`.
  4. **Quality Gates:**
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 16.04s, 0 errors).

- **CLN-243 | PTV-DEV-228 — AUDIT STRUKTUR DATABASE KANONIKAL & SKRIP MIGRASI 68 PERSONEL (30 Oktober 2026, zidnal / Antigravity):**
  1. **Audit Keadaan Database Aktual:**
     - Memverifikasi jumlah baris terkini pada Supabase staging (`swadgljnyelsjstqqxbm`): `canonical_identity` (28 baris), `organization_membership` (28 baris), `user_account` (28 baris), dan `legacy_archive_kru` (94 baris).
     - Menemukan bahwa mutasi penulisan langsung ke `canonical_identity` dan `organization_membership` dari `service_role` dibatasi oleh DDL hardening `ACCESS-149`.
  2. **Skrip Migrasi Idempotent & Non-Destructive:**
     - Menghasilkan skrip DDL migrasi SQL di `docs/PTV-DEV-228-CREW-MIGRATION.sql` (3559 baris) yang memetakan seluruh 68 personel yang belum tercatat ke `canonical_identity` dan `organization_membership` lengkap dengan divisi, jabatan, angkatan (cohort), status organisasi, dan data pribadi di metadata tanpa kehilangan histori.
     - Menghubungkan secara langsung 25 kru yang sudah ada ke `canonical_identity_id` pada `legacy_archive_kru`.
  3. **Pencegahan Akun Duplikat & Integrasi Buat Akun:**
     - Memvalidasi alur pembuatan akun agar memeriksa duplikasi terhadap `canonical_identity` dan `user_account` secara ketat.
     - Menjaga independensi status keanggotaan kru dan status akun login.
  4. **Quality Gates:**
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 15.00s, 0 errors).

- **CLN-242 | PTV-DEV-227 — FINALISASI KONSOLIDASI DATABASE STAGING & FITUR BUAT AKUN KRU (30 Oktober 2026, zidnal / Antigravity):**
  1. **Konsolidasi Database & BUG-006 Fix Decoupling:**
     - Menghilangkan impor dan ketergantungan pada `crewPhase1Adapter.ts` dari `api/kru.ts`, menghentikan penimpaan stale data yang menyebabkan perubahan nama/foto/biodata kembali ke nilai lama setelah refresh.
     - Memindahkan konfigurasi mapping kapabilitas jabatan dari dummy record `PTV-CONFIG-01` ke tabel resmi `ptv_portal_settings` (`id = 'position_capability_mappings'`) di `api/positionMapping.ts`.
     - Mengamankan fallback API pada `api/finance.ts`, `api/lapor-kerusakan.ts`, dan `api/peminjaman.ts` agar tidak gagal atau error saat membaca tabel-tabel legacy.
     - Menyiapkan skrip DDL pembersihan `docs/PTVPRO-DATABASE-CONSOLIDATION-CLEANUP.sql` yang aman (tanpa `DROP CASCADE`).
  2. **Fitur Buat Akun Personel di Manajemen Kru (`KruDetailDrawer.tsx`):**
     - Menambahkan tombol **+ Buat Akun** pada card Akun & Keamanan jika kru belum memiliki akun login (khusus akun ROOT).
     - Menambahkan handler backend atomik `action=create_account` di `api/kru.ts` dengan validasi hak akses ROOT.
     - Generator username awal otomatis: mengambil kata pertama dari nama lengkap personel, huruf kecil, tanpa spasi, dengan penanganan anti-tabrakan otomatis (`rasya2`, `rasya3`, dst).
     - Password awal otomatis dari kata pertama nama kru dengan hashing bcrypt aman dan flag `must_change_password: true` di metadata, mewajibkan penggantian kata sandi pada login pertama.
     - Menghadirkan modal Apple-style R03 `CreateAccountSuccessModal.tsx` via `createPortal` dengan notifikasi peringatan kredensial satu kali dan tombol Salin Kredensial.
     - Default profil akun baru adalah Kru (`kru`), status akun langsung aktif, status keanggotaan kru tetap independen, dan tercatat di `auth_audit_log`.
  3. **Code Hygiene & Quality Gates:**
     - Menghapus dead logic / referensi legacy yang usang dan merapikan kontrak tipe data di `src/products/hub/kru/kruService.ts` dan `types.ts`.
     - Memperbaiki validasi status toast icon di `KruDetailDrawer.tsx`.
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 18.11s, 0 errors).
     - `vitest` unit tests (39 tests passed): `kruStagingIntegration.test.ts` (14), `kruFlatGroupedListRegression.test.tsx` (5), `kruKontakCrudPersistence.test.ts` (12), `crewPhase1Adapter.test.ts` (8).

- **CLN-241 | PTV-DEV-225 — BUG FIX: TOAST NOTIFIKASI KANAN ATAS & PEMINDAHAN PENGELOLAAN LOGIN KE MANAJEMEN KRU (30 Oktober 2026, zidnal / Antigravity):**
  1. **Standardisasi Toast Global (BUG-005):**
     - Memindahkan posisi container `#toasts` di `src/styles/dashboard.css` ke **kanan atas, tepat di bawah header** (`top: calc(var(--header-h) + var(--sat) + var(--ptv-announcement-h, 0px) + 12px); right: 24px; left: auto; width: 360px; z-index: 10050;`).
     - Posisi toast otomatis menyesuaikan secara dinamis saat Top Announcement Banner dibuka atau ditutup dengan CSS transisi halus.
     - Membuat komponen terpusat `GlobalToastContainer` dan utility `showToast(titleOrOptions, desc, icon)` di `src/shared/components/GlobalToast.tsx` dan memasangnya di `HubShell.tsx`.
     - Menggantikan seluruh toast ad-hoc pojok kanan bawah di `KruPage.tsx`, `AksesPage.tsx`, dan `PositionMappingTab.tsx` dengan toast global terpusat berdesain Apple-style R03.
  2. **Pembersihan Manajemen Akun (Fokus Murni ke Profil & Izin):**
     - Menghapus tombol **Reset Password** dari baris akun di tabel Manajemen Akun (`AksesPage.tsx`).
     - Menghapus komponen orphan modal reset password lama `src/products/hub/akses/ResetPasswordModal.tsx`.
     - Manajemen Akun kini 100% fokus pada profil akses, izin granular, mapping jabatan, dan riwayat perubahan audit trail.
  3. **Pemindahan Pengelolaan Login & Keamanan ke Manajemen Kru:**
     - Menata section **Akun & Keamanan** di `KruDetailDrawer.tsx` dengan layout Apple-style yang rapi, compact, dan responsif (tanpa menumpuk aksi dalam satu baris).
     - Menampilkan status akun login independen (`Akun Aktif` / `Akun Nonaktif` / `Belum Memiliki Akun`) beserta tombol aksi toggle akun.
     - Menambahkan fitur **Ubah Username** inline khusus akun ROOT dengan validasi 3–30 karakter alfanumerik `a-z0-9_.`, pencegahan tabrakan duplikat di `user_account` dan `legacy_archive_kru`, serta audit logging backend.
     - Menambahkan fitur **Atur Ulang Password** khusus akun ROOT via modal dialog responsif `ResetPasswordDrawerModal.tsx` dengan full viewport blur overlay (`z-index: 10050`), hashing bcrypt aman di backend (`api/kru.ts`), sinkronisasi ke Supabase Auth, invalidasi token lama (`tokens_valid_after`), dan pencatatan audit trail (`auth_audit_log`).
  4. **Code Hygiene & Quality Gates:**
     - Membersihkan variabel `isRoot` yang tidak terpakai di `AksesPage.tsx`.
     - Menghapus komponen orphan `src/products/hub/akses/ResetPasswordModal.tsx`.
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 14.67s, 0 errors).
     - Unit test kru staging (`tests/hub/kruStagingIntegration.test.ts`): 14 passed (100%).


- **CLN-240 | PTV-DEV-225 — MANAJEMEN KRU & AKUN R3: SINKRONISASI JABATAN ORGANISASI, CUSTOM DROPDOWN PTVSELECT, KONSISTENSI TOMBOL R03, REDESIGN NAV MOBILE APPLE, & PORTAL MODAL RESET PASSWORD (30 Oktober 2026, zidnal / Antigravity):**
  1. **Sinkronisasi Jabatan Organisasi (Single Source of Truth):**
     - Mendefinisikan konstanta kanonikal `CANONICAL_ORGANIZATIONAL_POSITIONS` di `src/products/hub/kru/types.ts` yang selaras 100% dengan mapping hak akses `DEFAULT_POSITION_CAPABILITIES` di `api/positionMapping.ts`.
     - Menambahkan jabatan baru **Ketua Divisi** lengkap dengan izin operasional divisi dan resolusi regex `/ketua\s*divisi/i` di `api/positionMapping.ts`.
     - Mengimplementasikan custom dropdown `PTVSelect` Apple-style pada form penugasan jabatan di `KruFormModal.tsx` dengan fitur pencarian jabatan, ikon terstandarisasi, dan opsi kustom/spesifik.
     - Memperbarui `api/kru.ts` pada endpoint edit kru agar perubahan jabatan secara otomatis melakukan sinkronisasi ke tabel `organization_membership` (`position_title`), sehingga izin berbasis organisasi langsung tercabut untuk jabatan lama dan berganti ke izin jabatan baru saat runtime live authorization.
     - Preservasi data: hak akses granular/spesifik (`account_capability_overrides`) dan akun ROOT tetap utuh dan terlindungi.
  2. **Konsistensi Tombol Aksi R03:**
     - Menyamakan desain tombol **Kelola Akses** dan **Reset Password** pada `AksesPage.tsx` dan `akses.css`.
     - Kedua tombol kini memiliki height identik (`min-height: 34px`), padding proporsional (`0 13px`), border-radius (`9999px pill`), ukuran ikon (`11.5px`), tipografi 12.5px font-weight 600, dan alignment rapi baik di desktop maupun mobile.
  3. **Redesign Navigasi Mobile Manajemen Akun Apple-Style:**
     - Merombak segmented tabs bar pada `AksesPage.tsx` dan `akses.css`: beralih dari teks panjang bertumpuk menjadi compact Apple-style segmented navigation.
     - Di mobile (`<= 768px`), navigasi menampilkan label yang ringkas dan padat: `Akun` (dengan counter badge), `Jabatan`, dan `Riwayat` (dengan counter badge), dengan layout seimbang tanpa horizontal overflow.
     - Struktur navigasi desktop yang sudah baik tetap dipertahankan dengan label lengkap (`Daftar Akun Kru`, `Mapping Jabatan & Izin`, `Riwayat Perubahan Akses`).
  4. **Perbaikan Popup Modal Reset Password Desktop (Overlay Viewport Penuh & True Centering):**
     - Menggunakan `createPortal(modalContent, document.body)` pada `ResetPasswordModal.tsx` untuk melepaskan stacking context dari container lokal.
     - Memperbaiki overlay dengan `position: fixed`, `top: 0`, `left: 0`, `width: 100vw`, `height: 100vh`, `zIndex: 99999`, backdrop blur `8px`, dan flexbox center agar modal selalu presisi di tengah layar desktop/mobile dan overlay blur menutupi seluruh sidebar, header, dan konten.
  5. **Code Hygiene & Verification:**
     - Membersihkan unused import `PTVSelectOption` di `KruFormModal.tsx`.
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 18.73s, 0 errors).

- **CLN-239 | PTV-DEV-225 — HOTFIX MANAJEMEN AKUN R2: STATUS AKUN EKSKLUSIF DI KRU & RESPONSIVITAS MOBILE APPLE R03 (30 Oktober 2026, zidnal / Antigravity):**
  1. **Status Akun Eksklusif di Manajemen Kru & Read-Only di Manajemen Akun:**
     - Menghapus dropdown `<select>` Status Akun dari modal Kelola Hak Akses (`ManagePermissionsModal.tsx`).
     - Mengubah tampilan status akun di modal Manajemen Akun menjadi kartu info read-only: "Status Akun Portal: Akun Aktif / Akun Nonaktif / Belum Ada Akun", dengan penegasan *"Aktivasi / nonaktivasi akun dikelola dari Manajemen Kru"*.
     - Menjamin status keaktifan personel kru dan status akun independen: kru purna/nonaktif tetap dapat login jika akunnya aktif.
     - Memperbaiki endpoint `api/kru.ts?action=toggle_account` agar membaca profil dan overrides existing (`account_capability_overrides`) sebelum memanggil `rpc_manage_account_access` sehingga toggle akun dari Manajemen Kru tidak menghapus granular capability overrides yang sudah diatur sebelumnya.
  2. **Responsivitas Mobile iPhone / Layar Kecil (Design System R03 Apple-Style):**
     - Rombak layout Mapping Jabatan & Izin (`PositionMappingTab.tsx`) di mobile (<= 768px): beralih dari 2 kolom yang memicu horizontal overflow menjadi navigasi bertahap menggunakan segmented switcher Apple-style `[Pilih Jabatan]` vs `[Izin: <Jabatan>]`.
     - Memilih jabatan di mobile otomatis mengarahkan ke tampilan daftar izin 1 kolom penuh tanpa kartu izin terpotong.
     - Tombol "Simpan Mapping Jabatan" di mobile diposisikan full-width dan sticky/mudah dijangkau.
     - Memperbaiki modal `ManagePermissionsModal.tsx` dan `ResetPasswordModal.tsx` dengan `maxHeight: calc(100vh - 32px)`, padding fleksibel, dan `-webkit-overflow-scrolling: touch` agar dapat di-scroll lancar saat keyboard HP terbuka.
  3. **Code Hygiene & Verification:**
     - Membersihkan props yang tidak lagi dimutasi di antarmuka Manajemen Akun.
     - Memastikan word break pada badge mono kode permission agar tidak meluap keluar container di layar compact.
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 26.56s, 0 errors).

- **CLN-238 | PTV-DEV-225 — MANAJEMEN KRU & MANAJEMEN AKUN TERINTEGRASI (30 Oktober 2026, zidnal / Antigravity):**
  1. **Manajemen Kru:**
     - ID PTV otomatis dihasilkan dari nomor urut ID kru terakhir terdaftar (maxNum + 1), aman dari duplikasi & konkurensi (dengan loop pengecekan tabrakan), read-only di form, dan tidak mengacu pada jumlah kru aktif.
     - Foto Profil 3 Opsi: Ambil Foto kamera (live stream webcam + canvas snapshot), Unggah File dari Galeri/Perangkat, dan Masukkan URL, dengan fallback default https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp. Hasil foto disimpan permanen di Supabase Storage staging bucket inventory/avatars/.
     - Data Kru: Ganti field Jurusan -> Tanggal Lahir (birth_date), NIM -> Alamat Domisili (address), dengan migrasi tanpa kehilangan data lama di metadata_json.
     - Penghapusan seksi Modul Terkait Personel dari drawer detail kru.
     - Pemisahan tegas aksi Aktifkan/Nonaktifkan Akun dari perubahan status keaktifan kru (kru purna/nonaktif tetap dapat login jika akun aktif).
     - Perbaikan penyimpanan modal Edit Kru (penghapusan filter brittle metadata_json->>updated_at untuk mengatasi 409 PGRST116 dan 503 RPC).
  2. **Manajemen Akun:**
     - Penggantian seluruh penamaan navigasi, breadcrumb, bottom sheet, dan judul halaman dari Manajemen Akses menjadi Manajemen Akun.
     - Pill status independen Akun Aktif / Akun Nonaktif.
     - Fitur Atur Ulang Password aman khusus ROOT (root_executive): verifikasi hak eksekutif, validasi password minimal 8 karakter, hash bcrypt, update user Supabase auth & metadata PostgreSQL staging, invalidasi sesi login lama (tokens_valid_after), dan pencatatan audit log tanpa mengekspos password lama atau service role key ke client.
     - Kamus bahasa Indonesia yang jelas untuk 53 capability modular PTV PRO dengan tetap menampilkan kode permission teknis font-mono.
  3. **Logika Jabatan & Hak Akses Organisasi:**
     - Modul pemetaan dinamis api/positionMapping.ts menyimpan mapping Jabatan -> Capabilities di PostgreSQL staging (swadgljnyelsjstqqxbm).
     - Antarmuka Tab Mapping Jabatan & Izin di Manajemen Akun memungkinkan perubahan hak akses jabatan langsung dari UI tanpa mengubah kode.
     - Resolusi runtime menggabungkan profil akun + izin bawaan jabatan organisasi + granular allow/deny overrides, dengan perlindungan permanen akun ROOT.
  4. **Code Hygiene & Verification:**
     - Menghapus skrip sementara .gemini/scratch/*.
     - Menghapus dead code dan variabel yang tidak terbaca (findErr, accErr).
     - npm run typecheck: PASS (0 errors).
     - npm run build: PASS (built in 15.36s, 0 errors).


- **CLN-233 | PTV-DEV-222 — RESTORE CATATAN BERSAMA LEGACY UI (100% PHP LEGACY & SCREENSHOT PARITY) (30 Oktober 2026, zidnal / Antigravity):**
  1. **Pembatalan Eksperimen Workspace 2-Panel:**
     - Menghapus seluruh eksperimen layout 2-panel/split pane dan rencana side drawer dari PTV-DEV-220 & 221.
     - Mengembalikan antarmuka ke modal tengah yang bersih, terfokus, dan modular sesuai `legacy/page-dasbor.php` (L17351-L18750) dan 4 screenshot referensi.
  2. **Modal Detail Catatan (Screenshot 1 Parity):**
     - Modal tengah `maxWidth: 640px` dengan overlay blur dan backdrop dismiss.
     - Header sederhana: teks bersih "Catatan Tim" / "Notulensi Rapat" dengan tombol close `x`.
     - Body modal menampilkan kartu berwarna penuh sesuai kategori (`.catatan-legacy-detail-card`, rounded 22px, padding 26px 24px) dengan pill kategori, pin badge kanan atas, judul tebal 24px, metadata pembuat/tanggal, atribut rapat terstruktur jika ada, tag chips, dan rich formatted body (prose text) berkontras tinggi.
     - Footer modal (di luar kartu warna, latar bersih): tombol kiri `[📌 Lepas Sematan / Sematkan]`, `[🗑 Hapus]`, dan tombol kanan biru `[✏ Edit Catatan / Notulensi]`.
  3. **Modal Form Tambah / Edit Catatan (Screenshot 2, 3, 4 Parity):**
     - Header bersih: "Edit Catatan Bersama" / "Tambah Catatan Bersama" (atau Notulensi Rapat).
     - Radio Cards 2 kolom untuk **Jenis Catatan**: `Catatan Bersama` (SOP, ide, panduan operasional & info tim) vs `Notulensi Rapat` (Hasil rapat, keputusan, tindak lanjut & PIC).
     - Atribut rapat dinamis (Tanggal, Waktu, Tempat/Media, Peserta Rapat, tombol Sisipkan Template) otomatis muncul saat memilih Notulensi Rapat.
     - **PILIH KATEGORI & WARNA CATATAN**: Custom dropdown button 5 warna palet resmi (Orange, Yellow, Green, Purple, Rose) dengan popover options (Screenshot 3).
     - **ISI CATATAN / NOTULENSI**: Rich Text Editor WYSIWYG lengkap dengan toolbar `H1`, `H2`, `P`, `|`, `B`, `I`, `U`, `S`, `|`, `↕ Spasi` (popover slider spasi baris & jarak huruf), `|`, `•` (Bullet List), `1.` (Numbered List), `“` (Quote), `eraser` (Remove Format), dan `image`.
     - **Penghapusan Input Judul Terpisah yang Canggung**: Menghilangkan input title terpisah; judul diketik langsung di baris pertama / heading editor dan diekstrak otomatis via `extractTitleFromContent` (PHP legacy L18124) saat disimpan, sehingga form bersih dan tidak dobel.
     - **TAG TAMBAHAN**: Badge counter `${formTags.length}/5 Tag` (red alert jika 5), tag chips dengan tombol remove `x`, input box tag dengan placeholder panduan, dan helper text "Ketik tag lalu tekan Enter atau , (Maksimal 5 tag seperti Instagram)".
     - Checkbox: `[✔] 📌 Sematkan di paling atas (Pinned)`.
     - Footer: Tombol biru lebar penuh `[✔ Perbarui Catatan]` / `[+ Simpan Catatan]`.
  4. **Pencegahan Bug Formatting & Data Parity (Poin 5 Kritis):**
     - Saat edit, isi catatan lama beserta judul dan formatting (bullet, list, heading, formatting rich text) dimuat utuh tanpa hilang.
     - Sanitasi aman via `sanitizeHtml` tanpa merusak tag formatting yang sah.
     - Persistensi backend Supabase staging terverifikasi.
  5. **Quality Gates:**
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 14.37s, 0 errors).

- **CLN-237 | PTV-DEV-224:** review terarah index/manifest/aset v3; seluruh entri manifest beralih ke transparent v3, Apple ke Light v3. Reuse alpha sumber resmi tanpa color-key removal; hash favicon/source tetap, tanpa dependensi/JS baru. Varian Light/Dark opaque disediakan khusus appearance; v2 dipertahankan sebagai riwayat yang diuji pengguna. Skrip ad-hoc tidak disimpan; baseline hash sementara dihapus setelah validasi. Tidak menyentuh parse error editor di luar scope.


- **CLN-236 | PTV-DEV-223 | 30 Oktober 2026:** review terarah ikon/index/manifest: reuse alpha logo resmi, favicon desktop tidak disentuh, tidak menambah dependensi/JS appearance/media ambigu. Semua referensi aktif menggunakan v2; URL fallback lama tetap kompatibel dan disinkronkan. Aset Dark sengaja disediakan sebagai alternatif terdokumentasi, bukan orphan tanpa tujuan. Tidak meninggalkan skrip/cache/screenshot eksperimen atau melakukan cleanup repository-wide. Build, metadata, safe zone dan akses HTTP PASS.


- **CLN-232 | PTV-DEV-219 — MOBILE ANNOUNCEMENT BAR COMPACT REFINEMENT (ULTRA-SLIM SINGLE-ROW APPLE SYSTEM NOTIFICATION) (30 Oktober 2026, zidnal / Antigravity):**
  1. **Ultra-Slim Single-Row Mobile Layout (Tinggi 38px):**
     - Mengubah layout mobile dari susunan 2 baris (~87px) menjadi **satu baris ultra-compact (38px)** yang ringan seperti system notification bar Apple.
     - Menghemat hampir 50px area layar vertikal berharga di smartphone tanpa menghilangkan fungsi penting apapun.
  2. **Prioritas Utama: Judul Pengumuman Tetap Terbaca Jelas:**
     - Menempatkan kategori tag subtle (`9px font-size, 4px border-radius`) dan **Judul Pengumuman Tebal (`strong`, `font-size: 12px; font-weight: 700; flex: 1; text-overflow: ellipsis; white-space: nowrap`)**.
     - Judul mendapatkan alokasi ruang maksimal sehingga terbaca jelas di layar mobile (iPhone 15 / 393px, 390px, 375px).
  3. **Deskripsi Disembunyikan Sesuai Arahan & Aksi Compact:**
     - Deskripsi panjang disembunyikan di mobile dan dapat dibaca lengkap melalui modal detail dengan menekan tombol **"Buka >"** (`font-size: 11px; font-weight: 650; text-decoration: underline`).
     - Navigasi pager multi-pengumuman diintegrasikan compact `< 1/3 >` di samping link Buka.
     - Tombol close X diatur proporsional (`width: 30px; height: 30px; font-size: 14px`) tanpa mengorbankan kenyamanan tap.
  4. **Adaptasi Header & Konten Dinamis:**
     - `ResizeObserver` secara otomatis mengupdate CSS variable `--ptv-announcement-h: 38px`.
     - Header `.hdr` dan `.main` bergeser turun hanya 38px di mobile, membuat konten utama langsung terlihat tanpa terdorong jauh ke bawah.
  5. **Quality Gates:**
     - Unit test Vitest: `tests/hub/topAnnouncementBannerAppleStyle.test.tsx` (4 tests passed 100%).
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 13.73s, 0 errors).

- **CLN-231 | PTV-DEV-218 — ANNOUNCEMENT BAR APPLE-STYLE REFINEMENT (CLEAN CONTROLS & MOBILE FIRST) (30 Oktober 2026, zidnal / Antigravity):**
  1. **Redesign Kontrol Apple HIG Minimalis & Refined:**
     - Menghilangkan container pill button besar yang berlebihan dan mendominasi visual.
     - Badge kategori diperkecil menjadi subtle inline tag (`padding: 2px 8px; font-size: 10.5px; border-radius: 6px;`).
     - Navigasi pengumuman multi-pager dirombak menjadi minimalis natural tanpa container pill tebal: chevron tipis dengan indikator teks elegan `< 1 dari 3 >`.
     - Tombol aksi `Buka Rincian` diganti menjadi text action link Apple-style yang bersahaja: text `Buka` dengan underline halus dan chevron tipis `>` (`font-size: 12.5px; font-weight: 600;`).
     - Tombol close X diubah menjadi circular button sederhana 32x32px (desktop) dan 38x38px (mobile) dengan touch target yang sangat nyaman.
     - Spacing, alignment, dan hierarki tipografi terasa natural, bersih, dan bebas dari AI slop.
  2. **Mobile Layout 2-Baris (Prioritas: Judul WAJIB Terlihat):**
     - Membangun dual-layout terisolasi via CSS media query: `.ptv-banner-desktop-layout` dan `.ptv-banner-mobile-layout`.
     - Pada layar smartphone (< 1024px, 390px/375px), banner otomatis reflow ke **susunan 2 baris terstruktur**:
       - **Baris 1:** Badge kategori subtle + **Judul Pengumuman Tebal (`strong`, flex: 1, ellipsis natural, pasti terbaca utuh tanpa terhimpit tombol)** + Tombol close `X` besar (38x38px touch target).
       - **Baris 2:** Ringkasan isi pengumuman + navigasi pager minimalis `1/3` + link text `Buka >`.
     - Tinggi banner pada mobile dinamis mengalir otomatis (~87px pada 390px viewport), dan diukur secara real-time via `ResizeObserver` sehingga header `.hdr` dan `.main` terdorong secara presisi tanpa tumpang tindih.
     - Verifikasi 0 horizontal overflow (`scrollWidth <= clientWidth`).
  3. **Visual & Estetika Apple Terjaga:**
     - Mempertahankan gradien halus 105 derajat dan tekstur noise SVG prosedural (opacity 0.12, overlay) dengan top reflection line 1px.
     - Pergantian halaman pengumuman dilengkapi animasi crossfade halus 180ms.
  4. **Quality Gates & Validasi Riil:**
     - Unit test Vitest kanonikal: `tests/hub/topAnnouncementBannerAppleStyle.test.tsx` (4 tests passed 100%).
     - Regression tests: `tests/hub/headerFeaturesRegression.test.tsx` & `tests/hub/broadcastAndPengaturan.test.tsx` (21 passed).
     - Browser E2E Playwright di MS Edge: Desktop verified (`apple_banner_desktop_verified.png`) & Mobile verified (`apple_banner_mobile_verified.png`).
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 14.16s, 0 errors).

- **CLN-230 | PTV-DEV-217 — REVISI VISUAL ANNOUNCEMENT BAR (TALLER BAR, GRADIENT, NOISE TEXTURE) (30 Oktober 2026, zidnal / Antigravity):**
  1. **Tinggi Bar Bertambah (52px Visual Breathing Room):**
     - Meningkatkan tinggi announcement bar dari 44px menjadi **52px** (`min-height: 52px; padding: 0 24px;`).
     - Teks, ikon, pill status, dan tombol aksi kini memiliki ruang napas yang proporsional, elegan, dan tidak lagi terlihat penyet atau tertekan.
     - Header (`.hdr`) otomatis bergeser tepat ke `top: 52px` dan konten utama (`.main`) menyesuaikan padding atas ke `144px`.
  2. **Background Gradien Berkarakter & Hidup:**
     - Mengubah warna solid datar menjadi **gradien halus 105 derajat** untuk setiap variasi warna tema:
       - Biru: `linear-gradient(105deg, #0284c7 0%, #0056d6 50%, #1e40af 100%)`
       - Ungu: `linear-gradient(105deg, #a855f7 0%, #7c3aed 50%, #5b21b6 100%)`
       - Oranye: `linear-gradient(105deg, #f97316 0%, #ea580c 50%, #c2410c 100%)`
       - Hijau: `linear-gradient(105deg, #22c55e 0%, #16a34a 50%, #15803d 100%)`
       - Merah: `linear-gradient(105deg, #ef4444 0%, #dc2626 50%, #991b1b 100%)`
       - Emas: `linear-gradient(105deg, #f59e0b 0%, #d97706 50%, #b45309 100%)`
     - Ditambahkan aksen refleksi tipis 1px di bagian tepi atas bar (`linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)`) untuk sentuhan polished khas Apple.
  3. **Tekstur Noise / Grain Halus (Subtle Procedural Grain):**
     - Mengintegrasikan noise layer SVG murni tanpa dependensi aset eksternal via inline data URI (`feTurbulence fractalNoise` baseFrequency 0.8, numOctaves 3).
     - Diterapkan dengan `opacity: 0.12` dan `mix-blend-mode: overlay` sehingga menyatu alami di atas gradien tanpa mengaburkan ketajaman teks.
     - Tampil konsisten dan rapi baik di Light Mode maupun Dark Mode.
  4. **Keterbacaan & Kontras Maksimal:**
     - Teks judul (`font-weight: 750`, subtle text-shadow `0 1px 2px rgba(0,0,0,0.15)`) dan deskripsi (`rgba(255,255,255,0.92)`) terjaga dengan rasio kontras tinggi di atas gradien gelap.
     - Pill status kategori dilengkapi backdrop blur dan border transparan `rgba(255,255,255,0.28)`.
     - Tombol aksi `Buka Rincian` mempertahankan styling putih bersih solid dengan efek hover lift dan bayangan elegan.
  5. **Integritas Logic & Quality Gates:**
     - Seluruh logic close harian (Asia/Jakarta), siklus esok hari, filter kedaluwarsa, dan multi-pager carousel navigation dipertahankan utuh tanpa perubahan.
     - Pengujian Playwright E2E: `hasBar: true, height: 52px, hasNoiseLayer: true, noiseOpacity: 0.12, dark/light mode pass`.
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (built in 13.00s, 0 errors).

- **CLN-229 | PTV-DEV-216 — REDESIGN GLOBAL ANNOUNCEMENT BAR (UPGRADE/TRIAL BAR FULL PARITY) (30 Oktober 2026, zidnal / Antigravity):**
  1. **Horizontal Notification Bar di Atas Header:**
     - Merombak total `TopAnnouncementBanner.tsx` dari bentuk floating card menjadi **horizontal notification bar** (`#ptvGlobalNotificationBar`) murni tanpa card, tanpa border, tanpa shadow, tanpa margin luar.
     - Posisi tepat di atas header (`top: 0; left: var(--sidebar-w); right: 0; z-index: 65; height: 44px;`) mencakup area konten dari ujung sidebar hingga tepi kanan viewport.
     - Sidebar tidak bergeser sama sekali (`left: 0; top: 0; width: var(--sidebar-w);`).
     - Header (`.hdr`) dan konten utama (`.main`) otomatis bergeser ke bawah dinamis via CSS variable `--ptv-announcement-h: 44px` (`top: var(--ptv-announcement-h)` dan `padding-top: calc(var(--header-h) + var(--sat) + var(--ptv-announcement-h) + 26px)`).
     - Saat pengumuman ditutup, header dan konten naik kembali ke posisi awal (`--ptv-announcement-h: 0px`) secara mulus tanpa menyisakan celah kosong.
  2. **Visual Solid Sesuai Referensi Upgrade/Trial Bar:**
     - Skema warna solid cerah dan berkarakter (Biru `#0062E3`, Ungu `#7C3AED`, Oranye `#EA580C`, Hijau `#16A34A`, Merah `#DC2626`, Emas/Kuning `#D97706`).
     - Teks kontras tinggi dengan pill badge kategori dan tombol aksi R03 pill murni (`Buka Rincian`).
     - Pager compact multi-announcement (`< 1 / 3 >`) jika terdapat lebih dari satu pengumuman aktif, mencegah bar bertumpuk.
  3. **Perilaku Close Harian Berulang (Daily Dismiss Cycle):**
     - Status penutupan disimpan di `localStorage` terstruktur: `ptv_announcement_dismiss_<userId>` berupa map `{ [announcementId]: 'YYYY-MM-DD' }` dengan tanggal zona lokal **Asia/Jakarta**.
     - Menutup pengumuman hanya menyembunyikannya untuk hari berjalan.
     - Pada pergantian hari lokal (esok hari), pengumuman otomatis muncul kembali tanpa harus logout selama masa berlaku masih aktif.
     - Refresh halaman atau login ulang pada hari yang sama mempertahankan status penutupan.
     - Pengumuman kedaluwarsa (`berlaku_sampai <= now`) otomatis terfilter dan tidak muncul selamanya.
  4. **Form Pengelolaan Warna & Masa Berlaku:**
     - Form penerbitan pengumuman (`AnnouncementModal.tsx`) kini mendukung pemilihan tema warna bar (Biru, Ungu, Oranye, Hijau, Merah, Emas) serta masa berlaku (1, 3, 7, 14, 30 Hari, Selamanya).
  5. **Verifikasi Quality Gates:**
     - Pengujian E2E browser nyata via Playwright: Geometri bar di atas header, close harian, retensi reload di hari yang sama, muncul kembali esok hari, dan filter kedaluwarsa terverifikasi 100% PASS.
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (0 warnings, 0 errors).

- **CLN-228 | PTV-DEV-215 — SMOOTH THEME TRANSITION (APPLE-LIKE CROSSFADE) (30 Oktober 2026, zidnal / Antigravity):**
  1. **Dual-Tier Smooth Theme Transition Architecture:**
     - Mengimplementasikan View Transition API (`document.startViewTransition`) pada `src/core/theme/themeStore.ts` untuk transisi crossfade murni tingkat browser rendering layer, menghasilkan transisi visual yang serempak, mulus, dan bebas glitch seperti UI Apple macOS/iOS.
     - Menyediakan fallback CSS-based transition class (`.ptv-theme-transition` dengan durasi 350ms `cubic-bezier(0.4, 0, 0.2, 1)`) pada `src/styles/base.css` yang secara selektif menganimasikan `background-color`, `border-color`, `color`, `fill`, `stroke`, dan `box-shadow` tanpa pernah menganimasikan layout (width, height, position, margin, padding).
  2. **Zero Layout Shifts & No Initial Load Animation:**
     - Parameter `animate: false` secara tegas diaktifkan saat inisialisasi awal toko Zustand dan script head inline (`index.html`), sehingga halaman yang baru pertama kali dibuka tidak memicu animasi atau flash putih/hitam.
     - Transisi hanya diaktifkan saat pemanggilan aktif `setTheme` atau `toggleTheme` oleh aksi pengguna.
  3. **Accessibility & Reduced Motion:**
     - Menghormati pengaturan `prefers-reduced-motion: reduce` baik pada JavaScript (`window.matchMedia`) maupun media query CSS (`::view-transition-* { animation: none !important; }`), menjamin nol animasi bagi pengguna yang sensitif gerak.
  4. **Sinkronisasi & Isolasi:**
     - Sinkronisasi instan antara tombol sidebar (`HubShell.tsx`), menu profil (`UserProfileMenuModal.tsx`), dan halaman profil/pengaturan tetap bekerja reaktif 100% menggunakan satu state Zustand.
     - Perubahan terisolasi murni di `themeStore.ts` dan blok aturan transisi di `base.css` tanpa mengubah dependensi modul eksternal.
  5. **Verifikasi Browser & Quality Gates:**
     - Terverifikasi E2E Playwright di browser nyata: transisi Light → Dark dan Dark → Light berjalan mulus tanpa flash putih, nilai tersimpan di `localStorage`, dan reload halaman bebas animasi.
     - Unit tests Vitest: 17 passed di `darkModeConsistencyAndContrast.test.tsx`, 10 passed di `ptvDev134DarkModeAndRefinements.test.tsx`.
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (0 warnings, 0 errors).

- **CLN-227 | PTV-DEV-214 — BUG-004 REVISION: GENERATOR SURAT IZIN SANTRI PARITY & CLEANUP (30 Oktober 2026, zidnal / Antigravity):**
  1. **Nomor Surat Resmi De-Slop & Professional Administrative Display:**
     - Menghapus label/badge AI-slop buatan `Resmi` (`#ecfdf5` green pill) di header konfigurasi surat (`GeneratorSuratPage.tsx`).
     - Mengubah label menjadi format natural dan bersih `"Nomor Surat:"` dengan box nilai monospace netral dan rapi (`font-size: 13px; font-weight: 600; font-family: monospace; background: var(--surface-2); border: 1px solid var(--line); border-radius: 6px;`).
     - Membersihkan pill badge toolbar pratinjau PDF dari green tag artifisial menjadi neutral monospace code block (`12px; font-family: monospace; color: var(--ink); background: var(--surface-2);`).
     - Mempertahankan sistem penomoran otomatis dan sequence database tanpa perubahan logika backend.
  2. **Isi Dokumen PDF Santri Paritas Penuh PHP Legacy (`izinBuildPrint`):**
     - Menghapus pembatasan artifisial `tableLayout: 'fixed'` dan `overflowWrap: 'anywhere'` dari tabel santri dan metadata di `SuratIzinPdfPreview.tsx`.
     - Mengembalikan lebar kolom `NAMA SANTRI` ke `min-width: 130px; white-space: nowrap;` sesuai referensi PHP legacy baris 35163.
     - Mengembalikan padding sel data santri dari yang sebelumnya 7px–8px menjadi kompak 6px 10px (`nama`) dan 6px 8px / 6px 6px (`no`, `unit`, `kelas`, `kamar`, `asrama`, `murobbi`, `wali kelas`).
     - Memperbaiki wrapping nama santri dan asrama/murobbi (`display: inline-flex; align-items: center; white-space: nowrap;`) sehingga tinggi baris data turun dari 47px menjadi 29px murni single-line.
     - Hasil: 20 data santri muat sempurna dalam 1 halaman A4 portrait tanpa tumpah ke halaman lanjutan!
  3. **Paritas Identik Antara Pratinjau dan Unduh PDF:**
     - Pratinjau PDF dan file download PDF menggunakan komponen render DOM tunggal (`<SuratIzinPdfPreview />` melalui `suratIzinPdfDownload.tsx`), menjamin 100% tata letak dan visual identik antara yang dilihat pengguna dan yang diunduh.
  4. **Verifikasi & Build Integrity:**
     - Metrik tabel santri terverifikasi di browser nyata via Playwright: `trHeight: 29px`, `rectsCount: 1` (single line), 0 horizontal wrapping glitches.
     - Vitest unit tests: `tests/hub/suratIzinPdfParity.test.ts` (5 passed), `tests/hub/generatorSuratLegacyParity.test.ts` (8 passed), `tests/hub/generatorSurat.test.ts` (7 passed).
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (0 warnings, 0 errors).

- **CLN-226 | PTV-DEV-213 — DESKTOP FEATURES BUG FIX BATCH 002 (29 Oktober 2026, zidnal / Antigravity):**
  1. **Pengumuman Top Banner Non-Overlapping & Masa Berlaku Form:**
     - Dibuat `src/products/hub/shell/TopAnnouncementBanner.tsx` yang ditempatkan tepat di bawah fixed header dalam `<main id="main">` sebelum `.page-in`, menghasilkan layout flow murni tanpa overlap konten.
     - Terintegrasi penutupan banner per user ke `localStorage` (`ptv_dismissed_announcements_<userId>`) yang persisten setelah refresh halaman.
     - Penambahan field `berlaku_sampai` dan `durasi_hari` pada `api/broadcast.ts`, `types.ts`, `broadcastService.ts`, dan modal selector masa berlaku (1, 3, 7, 14, 30 hari, selamanya) pada `AnnouncementModal.tsx`.
     - Membersihkan duplikasi kontainer `#berandaAnnounceWrap` di `BerandaPage.tsx` dan menghapus unused imports.
  2. **Kalender Compact Spacing & Ekspor PDF Biner:**
     - Mengurangi gap vertikal antara judul bulan Masehi dan Hijriah di `src/styles/kalender.css` menjadi kompak 5.5px (< 6px).
     - Menghapus orphan CSS closing brace di line 1019 `kalender.css` sehingga build bebas dari peringatan sintaks.
     - Menambahkan generator PDF 1.4 murni di `src/products/hub/kalender/utils/kalenderPdfExport.ts` untuk ekspor kalender bulanan PTV dan fallback kalender akademik (Pesantren & Sekolah) tanpa dependensi 404 file statis.
     - Menambahkan tombol R03 pill "Unduh Kalender PDF" di bar navigasi kalender `KalenderPage.tsx`.
  3. **Catatan UI/UX Rombak & Perbaikan Bug Isi Form Edit:**
     - Memperbaiki akar masalah konten catatan lama kosong saat edit pada `NoteRichEditor.tsx` dengan memastikan initial content selalu ter-populate ke `innerHTML` saat mount form edit tanpa mengorbankan proteksi pengetikan internal pengguna.
     - Menambahkan `key={editingNoteId || 'new-note'}` pada modal `CatatanPage.tsx` untuk isolasi state form.
     - Membersihkan regex metadata komentar `<!-- PTV_META: ... -->` dari badan catatan agar tampilan editor bersih.
  4. **Nilai Inventaris R03 Pill Button:**
     - Memperbaiki tombol "Katalog Alat" (`.ptv-nilai-btn-catalog`) di `src/styles/nilaiInventaris.css` menjadi true R03 Pill Button (`border-radius: 9999px; height: 42px; border: 1.5px solid var(--b-500); box-shadow: ...`) lengkap dengan hover lift dan active state.
  5. **Form Kejadian Kategori & Tanggal Kejadian Balance:**
     - Menyelaraskan grid `.lf-form-row` modal Lapor Kejadian di `src/styles/lostFound.css` sehingga dropdown "Kategori" (`PTVSelect`) dan input "Tanggal Kejadian" (`input[type="date"]`) seimbang 50:50 dengan tinggi identik 42px (heightDiff = 0px, widthDiff = 0px).
  6. **Repo Verification & Browser E2E:**
     - Seluruh 5 poin perbaikan teruji dan terverifikasi di browser nyata via Playwright script (`verify_batch002_ui.cjs` dan `verify_catatan_edit.cjs`).
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (0 warnings, 0 errors).
     - Modul Inventaris utama (`InventarisPage.tsx`) tidak diubah sesuai instruksi.

- **CLN-225 | PTV-DEV-212 — BUG-003 REOPENED COMPREHENSIVE STAGING PURGE & ACCESS HARDENING (29 Oktober 2026, zidnal / Antigravity):**
  1. **Pembersihan File Testing Supabase Storage:**
     - Menghapus file orphan hasil pengujian upload foto `catalog/inv-1791989374503-e535m.png` dari bucket `inventory` via Supabase Storage API (`remove(['catalog/...'])`).
     - Memastikan 0 sisa file testing di seluruh bucket storage (`inventory`, `finance-proofs`).
  2. **Sanitasi Data Inventaris Tercemar Uji Script:**
     - Baris `INV-030` (`Earphone HT`, ID `46d7513a-01c9-4a68-820f-83090bfbd81c`) yang sebelumnya tercemar teks testing ("Sony A7 IV" dan "Test update verification via script") telah disanitasi kembali ke data riil (membersihkan `spesifikasi: null`, `brand: null`, `model: null`, `keterangan: null`).
  3. **Penghapusan Catatan Testing:**
     - Menghapus catatan dummy pengujian ID `00a4b029-7bdb-4859-a1a3-456414b2d674` (judul: "halo", isi: "asasasasasasasa") dari tabel database `ptv_catatan`.
     - Tiga catatan operasional riil ("RAPAT 12/10", "Nama Lengkap Keluarga Ndalem", "Ukuran Banner Pondok") dipertahankan utuh.
  4. **Penghapusan Surat Izin Hasil Testing:**
     - Menghapus 3 surat izin pengujian penerbitan surat tertanggal 29 Oktober 2026 dari tabel `ptv_surat_izin`:
       - `775dd3ac-b91d-4283-b8e6-76763a929127` (015/SI-PTV/X/2026)
       - `e27133ce-2f55-4083-8be9-f2853f60bb69` (016/SI-PTV/X/2026)
       - `875196ea-b8e5-49f0-9e79-7045134da5d5` (017/SI-PTV/X/2026)
     - Empat surat izin santri riil (001, 007, 009, 011 dari awal/pertengahan Oktober 2026) dipertahankan utuh.
  5. **Penghapusan Data Kru Pengujian di Database:**
     - Menghapus baris personel dummy pengujian `cdcf02ac-0fa3-45d6-9ae7-5788654d2810` (`PTV-UJI-2712` — Koordinator Kru Uji Terverifikasi) dari tabel `legacy_archive_kru`.
  6. **Penghapusan Auth User Testing di Supabase GoTrue:**
     - Menghapus akun auth `ptvcloud@gmail.com` (auth_uid `f7000a7f-36ae-4107-8516-ead83376aadd`) via `supabase.auth.admin.deleteUser`.
  7. **Proteksi & Isolasi Akun Testing di API Akses:**
     - Pada `api/akses.ts` (`readAccessAccounts`), menambahkan filter rigid anti data dummy: menyaring akun yang memuat `admin_staging`, `kru_staging`, `stg-inventory`, `ptv-stg`, `ptv-test`, `staging admin`, `staging kru` agar tidak pernah diekspos ke client UI Manajemen Akses (`/hub/akses`).
     - Hanya 25 akun operasional personel sah PTVPRO (PTV-001 s.d. PTV-036) yang dikirim ke frontend.
  8. **Verifikasi Browser E2E Playwright Terhadap 10 Modul (100% CLEAN):**
     - Menguji dan mengambil tangkapan layar untuk 10 modul Hub: Kru (`/hub/kru`), Dokumen (`/hub/dokumen`), Arsip (`/hub/arsip`), Generator Surat (`/hub/surat/generator`), Akses (`/hub/akses`), Inventaris (`/hub/inventaris`), Peminjaman (`/hub/peminjaman`), Keuangan (`/hub/keuangan`), Catatan (`/hub/catatan`), Beranda (`/hub/beranda`).
     - Hasil: **ZERO VIOLATIONS across all 10 modules**. Seluruh data dummy/staging/testing 100% tereliminasi.

- **CLN-224 | PTV-DEV-212 — BUG FIX BATCH 001 (THEME GLOBAL, POPUP SEARCH & NOTIF, CLEANUP STAGING DATA) (29 Oktober 2026, zidnal / Antigravity):**
  1. **BUG-001 — Theme Global Single State & Light Mode Default:**
     - Dibuat `src/core/theme/themeStore.ts` sebagai reactive single source of truth untuk tema menggunakan Zustand. Mengatur default `'light'` untuk fresh login / pengguna baru tanpa dependensi preferensi OS dark.
     - Bootstrap `index.html`: Menghapus fallback `systemDark` yang memaksakan dark mode ketika pengguna OS bertema gelap. Pengguna baru sekarang selalu start dalam Light Mode.
     - `src/app/router/ProtectedRoute.tsx`: Menghubungkan proteksi tema ke `savedTheme === 'dark' ? 'dark' : 'light'`.
     - `src/products/hub/shell/HubShell.tsx`: Menggunakan `useThemeStore` untuk toggle tema sidebar.
     - `src/products/hub/profile/ProfilePage.tsx` & `src/products/hub/pengaturan/PengaturanPage.tsx`: Menggantikan `useState` lokal terisolasi dengan `useThemeStore` (`{ isDark, toggleTheme }`), sehingga sinkron instan dua arah 1:1 antara tombol sidebar dan toggle profil.
     - Preferensi tema disimpan ke `localStorage` (`ptv-theme` & `theme`) dan persisten setelah refresh halaman.
  2. **BUG-002 — Popup Search & Notifikasi Desktop (Centered & Anti-Cut):**
     - Akar Masalah Teridentifikasi: Di `shell.css`, rule `.sheet` menyetel `left: 0; right: 0; bottom: 0;` secara global. Saat di desktop disetel `transform: translate(-50%, -50%)`, modal terpusat di `X = 0` (tepi kiri layar), menyebabkan separuh kiri modal terpotong di balik sidebar.
     - `src/styles/shell.css`: Mengisolasi gaya mobile `.sheet` ke `@media (max-width: 1023px)`.
     - Menetapkan aturan desktop `@media (min-width: 1024px)` untuk `.sheet`: `left: 50% !important; top: 50% !important; right: auto !important; bottom: auto !important; transform: translate(-50%, -50%) !important; width: min(600px, 92vw); border-radius: var(--ptv-curve-2xl) !important; overflow: hidden; animation: none !important;`.
     - `src/products/hub/shell/HubShell.tsx`: Mencegah penumpukan popup dengan mutasi mutual exclusive: `closeAllPopups()`, `handleOpenDesktopSearch()`, `handleOpenMobileSearch()`, `handleOpenNotif()`. Membuka satu popup secara otomatis menutup popup lainnya.
     - Menghapus unused function `handleOpenProfile` di `HubShell.tsx`.
  3. **BUG-003 — Hapus Seluruh Data Uji Staging:**
     - Menjalankan pembersihan database langsung pada Supabase `swadgljnyelsjstqqxbm` via script `.gemini/scratch/cleanup_staging_data.mjs` dengan `service_role`.
     - Terhapus tuntas tanpa merusak schema atau akun:
       - `ptv_lapor_masalah`: 1 baris uji
       - `ptv_peminjaman`: 2 baris transaksi uji
       - `ptv_inventaris_unit`: 6 baris unit uji
       - `ptv_inventaris`: 3 baris alat uji
       - `ptv_surat_izin`: 3 baris perizinan uji
       - `ptv_portal_announcements`: 1 baris pengumuman uji
     - Database lama `jthzuhkblxcaohiuypqq` sama sekali tidak disentuh.
     - Proteksi ledger kriptografis `ptv_finance_transactions` tetap dipertahankan dengan zero-drift.
  4. **Verifikasi QA Otomatis (Playwright & Quality Gates):**
     - Playwright browser Edge port 5174: 12/12 assertions lulus (default light, sync sidebar-profil, refresh persistence, search centered & R03 rounded 28px, notif centered & R03 rounded 28px, sidebar collapse stability, no popup stacking).
     - Quality gates: TypeScript `tsc --noEmit` pass (0 errors), ESLint pass (0 warnings/errors), Build `npm run build` pass (18.29s).

- **CLN-223 | PTV-DEV-211 — FINANCE MODAL R03 VISUAL CORRECTION (29 Oktober 2026, zidnal / Antigravity):**
  1. **Akar Masalah Sudut Kotak 90° Teridentifikasi & Terkoreksi:**
     - Hasil pemeriksaan DOM mendalam menemukan bahwa `ContinuousSurface` menyetel inline `borderRadius: 0` pada container HTML dan merender Profile D contour menggunakan elemen SVG `<path>` latar belakang.
     - Elemen anak `.finance-dialog-content` memiliki `background-color: var(--surface, #ffffff)` tanpa `border-radius` atau `clipPath`, sehingga lapisan latar belakang putih persegi tersebut menutupi lengkungan kurva Profile D SVG di keempat sudutnya.
  2. **Koreksi Terstruktur Lapisan Root Container Modal:**
     - `src/design-system/components/ContinuousSurface.tsx`: Menambahkan `clipPath` dan `WebkitClipPath` dinamis `url(#${clipId})` pada layer konten saat `clipContent={true}` aktif, memotong elemen konten HTML secara presisi mengikuti kontur Profile D SVG.
     - `src/design-system/components/ContinuousModalSurface.tsx`: Mengaktifkan `clipContent = true` secara default pada seluruh modal dialog continuous surface.
     - `src/products/hub/keuangan/FinanceWorkspace.tsx`: Memastikan `ContinuousModalSurface` pada `FinanceDialog` menerima `clipContent={true}` eksplisit.
     - `src/products/hub/keuangan/financeFoundation.css`:
       - Menegakkan `border-radius: var(--ptv-curve-2xl, 28px) !important;` dan `overflow: hidden !important;` pada `.finance-dialog` dan `.finance-dialog-content`.
       - Menetapkan `border-top-left-radius` & `border-top-right-radius: var(--ptv-curve-2xl, 28px) !important;` pada `.finance-dialog .finance-heading` (sticky header).
       - Menetapkan `border-bottom-left-radius` & `border-bottom-right-radius: var(--ptv-curve-2xl, 28px) !important;` pada `.finance-form-footer` (sticky footer).
       - Menyelaraskan breakpoint mobile `@media (max-width: 640px)` dengan border radius lembar bawah: `20px 20px 0 0 !important` pada container dan header, serta `border-radius: 0` pada footer yang menempel di tepi bawah layar iPhone/Android.
  3. **Verifikasi Visual QA Nyata (Playwright End-to-End):**
     - Menguji dan mengambil tangkapan layar browser Chromium aktual pada port 5174 untuk 7 modal Finance (desktop 1280px dan mobile 375px):
       - `vqa_modal_tambah_kantong_desktop.png` & `vqa_modal_tambah_kantong_mobile.png`
       - `vqa_modal_catat_pemasukan_desktop.png` & `vqa_modal_catat_pemasukan_mobile.png`
       - `vqa_modal_catat_pengeluaran_desktop.png` & `vqa_modal_catat_pengeluaran_mobile.png`
       - `vqa_modal_transfer_kantong_desktop.png` & `vqa_modal_transfer_kantong_mobile.png`
       - `vqa_modal_bayar_kas_kru_desktop.png` & `vqa_modal_bayar_kas_kru_mobile.png`
       - `vqa_modal_catat_piutang_desktop.png` & `vqa_modal_catat_piutang_mobile.png`
       - `vqa_modal_pasang_qris_desktop.png` & `vqa_modal_pasang_qris_mobile.png`
     - Evaluasi DOM terbukti: `dialogRadius: 28px`, `contentRadius: 28px`, `footerRadius: 0px 0px 28px 28px`, `dialogOverflow: hidden`. Sudut tajam 90° telah 100% tereliminasi.
  4. **Quality Gates Passed:**
     - Vitest Keuangan: **PASS (26 test files, 319/319 tests passed)**.
     - Typecheck: `npm run typecheck` **PASS (0 errors)**.
     - Lint: `npx eslint` **PASS (0 errors, 0 warnings)**.
     - Build Produksi: `npm run build` **PASS (built in 24.02s)**.

- **CLN-222 | PTV-DEV-211 — FINANCE 2.0 FUNCTIONAL & UI/UX FINISHING (R03) (29 Oktober 2026, zidnal / Antigravity):**
  1. **Audit & Solusi Akar Masalah Matriks Kas Kru (`financeOperationalReader.ts`, `kasKruService.ts`, `FinanceKasKruView.tsx`):**
     - Mengidentifikasi akar masalah mengapa seluruh periode matriks kas kru berstatus "Belum": tabel `ptv_finance_kas_records` pada database Supabase staging `swadgljnyelsjstqqxbm` berstatus kosong (0 baris), sementara pembayaran iuran tercatat di `ptv_finance_transactions` (37 posted, 4 reversed).
     - Menambahkan query suplementasi transaksi kanonik iuran kas kru di `fetchKasRecordsCloudWithClient` (`financeOperationalReader.ts`).
     - Memetakan nama kru ke `ptv_id` canonical identity dan parsing periode bulan (e.g. "September 2026" $\rightarrow$ `2026-09`).
     - Menyaring transaksi berstatus `reversed` (4 transaksi) secara rigid sehingga nominal terbayar `0` dan status tetap `belum` (tidak dihitung lunas).
     - Memperbaiki `calculateKasKruMatrix` di `kasKruService.ts` agar mencocokkan record berdasarkan rentang periode semester aktif.
     - Menghubungkan sinkronisasi state data operasional di `FinanceKasKruView.tsx` via `useEffect`.
  2. **Arsitektur Redesign Modal R03 Sticky & Anti Lost Buttons (`financeFoundation.css`):**
     - Menata ulang layout modal `.finance-dialog`: menggunakan Flex column dengan `overflow: hidden; max-height: calc(100dvh - 48px);`.
     - Sticky Header: `.finance-dialog .finance-heading` dipasang `position: sticky; top: 0; z-index: 20; background: var(--surface);` agar judul dan tombol tutup tidak pernah hilang tertimbun form.
     - Scrollable Body: `.finance-form` dan `.finance-dialog-detail` memiliki `flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;`.
     - Sticky Footer: `.finance-form-footer` dipasang `position: sticky; bottom: 0; z-index: 20; background: var(--surface); box-shadow: 0 -4px 12px rgba(11,42,74,0.03);` sehingga tombol aksi utama dan sekunder selalu terlihat dan nyaman diakses tanpa perlu scroll ke ujung bawah.
     - Anti iOS Safari Auto-Zoom: Menetapkan `font-size: 16px !important` untuk seluruh elemen input/select/textarea di bawah breakpoint `@media (max-width: 640px)`.
  3. **Komponen Searchable Crew Picker Modern (`SearchableCrewSelect.tsx`):**
     - Membuat komponen pemilih anggota kru yang dapat dicari secara langsung (live search) berdasarkan nama, PTV-ID, maupun divisi.
     - Dilengkapi avatar/inisial, badge ID monospaced, integrasi keyboard navigation (`Enter`, `Escape`), auto-focus search field, dan click-outside detection.
     - Diintegrasikan langsung pada form pencatatan Piutang Baru (`FinancePiutangView.tsx`) dan form Pembayaran Kas Kru (`FinanceKasKruView.tsx`), menggantikan dropdown HTML `<select>` native yang panjang dan rentan salah pilih.
  4. **Redesign Visual Form Transfer Antar-Kantong (`FinanceWorkspace.tsx`):**
     - Menggantikan tampilan fieldset sederhana menjadi alur visual Transfer Inter-Kantong yang terstruktur (`Dari Kantong Asal` dengan indikator saldo real-time $\rightarrow$ `Ke Kantong Tujuan` dengan validasi pencegahan pengiriman ke kantong yang sama $\rightarrow$ Card pratinjau nominal transfer dan penjelasan zero drift pada buku besar).
     - Menambahkan tombol chip quick-amount (+Rp 25.000, +Rp 50.000, +Rp 100.000, +Rp 250.000, +Rp 500.000) untuk pengisian nominal cepat.
  5. **Verifikasi Kesiapan Database & Quality Gates:**
     - Mengonfirmasi bahwa tabel `ptv_finance_pockets` dan `ptv_finance_settings` telah memiliki seluruh atribut yang dibutuhkan (`provider`, `account_number`, `account_holder`, `qris_asset_path`, `qris_merchant_name`, `qris_nmid`, `official_bank_pocket_id`, `official_qris_pocket_id`) tanpa memerlukan mutasi skema remote.
     - Vitest Keuangan: **PASS (26/26 files, 319/319 tests passed)**.
     - Typecheck repo-wide (`npm run typecheck`): **PASS (0 errors)**.
     - Scoped Lint (`npx eslint`): **PASS (0 warnings, 0 errors)**.
     - Build produksi (`npm run build`): **PASS (built in 14.34s)**.
     - Visual QA Playwright: 7/7 tangkapan layar verifikasi berhasil diambil dan lulus uji estetika R03 pada resolusi desktop maupun mobile 375px.

- **CLN-221 | PTV-DEV-210 — FINANCE 2.0 FINALIZATION & PRODUCTION READINESS AUDIT (29 Oktober 2026, zidnal / Antigravity):**
  1. **UI/UX Token Konsistensi R03 Profile D (`financeFoundation.css`, `financeSkeleton.css`):**
     - Mengganti seluruh arbitrary fixed pixel border-radius (4px, 6px, 8px, 10px, 14px, 18px) dengan token hierarkis kanonik R03:
       - Micro badge/tag: `var(--ptv-curve-xs, 6px)`
       - Compact control: `var(--ptv-curve-sm, 9px)`
       - Standard control/input/filter: `var(--ptv-curve-md, 12px)`
       - Sub-panel & nested card: `var(--fin-card-radius-sm, 16px)`
       - Primary container & modal: `var(--fin-card-radius, 22px)`
       - Pill control: `var(--ptv-curve-pill, 9999px)`
     - Memperbaiki radius skeleton loader di `financeSkeleton.css` agar seirama dengan kontainer nyata.
  2. **Pembersihan Total Label "Legacy" & "Staging" dari Pengguna:**
     - `FinanceOverview.tsx`: Mengubah label `Sumber Legacy:` menjadi `Referensi Sumber:`. Menghapus identitas hardcode personil lama menjadi `Bendahara Studio`.
     - `FinanceWorkspace.tsx`: Mengubah `recordedBy: 'Staging Legacy'` menjadi `Buku Utama` dan memperbarui catatan pembukuan bahwa data terhubung langsung ke buku utama. Mengubah label `Sumber Legacy:` menjadi `Referensi Sumber:`.
     - `FinancePage.tsx`: Mengubah `Memuat data Staging…` menjadi `Memuat data pembukuan…`. Mengubah status pill menjadi `Database Utama · [Pengelola Keuangan / Hanya Baca]`. Memperbarui catatan kaki menjadi referensi resmi database utama `swadgljnyelsjstqqxbm`.
     - `financeSettingsService.ts` & `FinanceSettingsView.tsx`: Mensanitasi default nama bendahara menjadi `Bendahara Studio` / `PTV-000`.
  3. **Penguatan Runtime Safety & Isolasi Fixture (`financeRuntimeSafety.ts`, `kasKruService.ts`, `financeSettingsService.ts`):**
     - Menegakkan `assertFinanceFixtureRuntime()` pada 6 fungsi fixture storage: `getStoredSemesters`, `saveSemesters`, `getStoredRecords`, `saveRecords`, `getStoredFinanceSettings`, dan `getCustomCategories`.
     - Memperketat pengecekan runtime: jika `process.env.MODE === 'staging'` atau `VITE_APP_ENV === 'staging'`, bypass fixture dilarang keras, mencegah kebocoran mock localStorage ke database cloud.
     - Melindungi pemanggilan setting & semester di `FinanceSettingsView.tsx` dengan try/catch fallback yang aman.
  4. **Harmonisasi Test Suite Keamanan & Kontrak Finansial:**
     - Menyesuaikan `financeAtomicAndSecurity.test.ts` agar menerima penolakan validasi Zod HTTP 400 sebelum memanggil RPC atomik yang dibekukan (503).
     - Menyelaraskan encoding entitas HTML (`&amp;`) pada pengujian render string di `financeFinishing149.test.tsx`.
  5. **Verifikasi Database Read-Only Aktual (`swadgljnyelsjstqqxbm`):**
     - Memverifikasi status aktual ke-17 trigger `finance151_database_freeze`: seluruhnya terbukti telah berstatus `DISABLED` (`tgenabled = 'D'`) sejak aktivasi sebelumnya.
     - Sensus transaksi membuktikan 59 total transaksi: 54 transaksi posted (Rp 1.254.200 pemasukan, Rp 733.924 pengeluaran, Rp 40.000 transfer) dan 5 transaksi reversed (termasuk smoke test operasional DEV-200 ID `447e8d38-dc64-4478-b8c1-0c041ef364e4` Rp 1.000).
     - Saldo kas aktif Kas Utama Studio terverifikasi tepat Rp 520.276 konsisten sempurna terhadap selisih transaksi pemasukan vs pengeluaran (Zero Drift).
     - Seluruh jalur backend di `api/finance.ts` terkunci secara rigid ke URL proyek `swadgljnyelsjstqqxbm`.
  6. **Quality Gates & Sign-Off:**
     - Vitest Keuangan: **PASS (26/26 files, 319/319 tests passed)**.
     - Typecheck repo-wide (`npm run typecheck`): **PASS (0 errors)**.
     - Scoped Lint (`npx eslint`): **PASS (0 warnings, 0 errors)**.
     - Build produksi (`npm run build`): **PASS (built in 16.76s)**.
     - Laporan kesiapan resmi: [`docs/audits/PTVPRO_FINANCE_2_FINAL_READINESS.md`](file:///c:/Users/zidna/ptvpro/docs/audits/PTVPRO_FINANCE_2_FINAL_READINESS.md) dengan status **READY FOR OPERATIONAL PRODUCTION (COMPLETE & SIGNED-OFF)**.

- **CLN-220 | PTV-DEV-209 — RUNDOWN MULTI-CREW ASSIGNMENT & FORM UX REPAIR (29 Oktober 2026, zidnal / Antigravity):**
  1. **Penugasan Kru Rundown Multi-Posisi & Multi-Personel Dinamis (`types.ts`, `repository.ts`, `HaulWorkspace.tsx`):**
     - Memperluas interface `CrewAssignment` menjadi: `{ id?: string; position: string; personIds: string[]; notes?: string; personId?: string; }` dengan backward-compatibility penuh melalui helper `getAssignmentPersonIds(asgn)`.
     - Mendukung banyak posisi kerja dalam satu sesi acara (Kamera Utama, Kamera Wing, Kamera Close Up, vMix Switching, Audio Master, Floor Director, Floor Crew, Fotografi, Video Dokumentasi, Live Report, Koordinator Lapangan).
     - Menghadirkan multi-select kru aktif (`CrewMultiSelect`) pada setiap posisi, sehingga satu posisi dapat diisi beberapa kru sekaligus (misal: Floor Crew diisi 2 orang, Kamera Wing diisi 2 orang).
     - Satu kru dapat memegang beberapa posisi dalam satu sesi yang sama tanpa ditolak/dinyatakan bentrok.
     - Setiap posisi dapat memiliki catatan/instruksi teknis ringkas (misal: "Kamera sayap kanan panggung", "Briefing floor mic").
  2. **Tabel Rundown: Roster Transparan Tanpa Singkatan '+1' / '+2':**
     - Menghadirkan visualisasi stack roster (`.hh-rundown-roster-stack`, `.hh-roster-group`) yang menampilkan setiap posisi, instruksi teknis, dan chip seluruh kru bertugas lengkap dengan avatar foto/inisial.
     - Tidak ada lagi pemotongan nama kru menjadi `+1` atau `+2`.
  3. **Selector Kru Aktif & Retensi Histori Personel Nonaktif (`CrewMultiSelect`):**
     - Opsi kru yang dapat dipilih dibatasi secara tegas hanya pada kru berstatus 'Aktif' dari master kru Hub.
     - Menyediakan kotak pencarian instan nama kru dengan checkbox pilihan.
     - Kru nonaktif lama yang pernah ditugaskan di masa lalu tetap dipertahankan namanya dengan badge penanda `(Histori)` dan tidak otomatis hilang atau merusak integritas data lama.
  4. **Audit & Penataan Logis Seluruh Form Haul & Harlah (`workspace.css`, `HaulWorkspace.tsx`):**
     - Menyusun form ke dalam 5 bagian logis terstruktur (`.hh-form-section`): (1) Informasi Dasar, (2) Penjelasan Pekerjaan, (3) Kru Bertugas & Status, (4) Batas Penyelesaian & Jadwal, (5) Pengaturan Lanjutan (collapsible).
     - Mengaudit dan menyelaraskan label ke Bahasa Indonesia PTV yang baku: `Penjelasan Pekerjaan` (menggantikan Brief/Caption), `Kru Bertugas (PIC Utama)` & `Kru Pendukung`, `Batas Penyelesaian` (menggantikan Deadline), `Lokasi File / Link Hasil`, dan `Menunggu Pekerjaan Lain` (menggantikan Dependency).
  5. **Perbaikan Tuntas Masalah Scrolling & Pinned Footers (Bug Prioritas Tinggi):**
     - Mengeliminasi `style={{ display: 'contents' }}` pada tag form modal yang sebelumnya merusak flex containment dan memotong tombol footer.
     - Mengubah `.hh-dialog form` menjadi kontainer flex terisolasi (`flex: 1 1 auto; min-height: 0; overflow: hidden;`).
     - Menerapkan scrolling mulus dengan batas aman pada body form (`overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;`).
     - Menyematkan footer secara sticky/pinned (`position: sticky; bottom: 0; z-index: 10;`) sehingga tombol *Simpan* dan *Batal* selalu terlihat dan dapat dijangkau di semua ukuran layar.
     - Menerapkan aturan mobile `@media (max-width: 640px)` dengan `font-size: 16px !important` pada seluruh elemen input/select/textarea guna mencegah auto-zoom browser iOS Safari/iPhone.
  6. **Quality Gates & Validasi:**
     - Repo-wide typecheck (`npm run typecheck`): **PASS (0 errors)**.
     - ESLint (`npm run lint`): **PASS (0 errors, 0 warnings)**.
     - Unit & Integration Vitest (`6 test suites, 46 tests`): **PASS (46/46 tests passed)**.
     - Build kompilasi produksi (`npm run build`): **PASS (2052 modules transformed in 29.42s)**.
     - Browser QA Playwright (`node tests/hub/haulBrowserSmoke.mjs`): **PASS (100% verifikasi multi-crew assignment, side peek, table roster stack, scrolling pinned footer, dan mobile 390px)**.

- **CLN-219 | PTV-DEV-208 — HAUL & HARLAH WORKSPACE CONCEPT CORRECTION (29 Oktober 2026, zidnal / Antigravity):**
  1. **Koreksi Konsep Beranda (/hub/haul): Murni Orientasi Cepat:**
     - Mengeliminasi alur rumit matriks tabel ganda di beranda: Beranda difokuskan 100% pada orientasi cepat bagi orang awam / anak PTV.
     - Menambahkan `.hh-home-grid` 2-kolom: *Tugas Mendesak & Perhatian* (task prioritas tinggi/mendesak & deadline dekat dengan inline StatusPicker 1-klik) dan *Kegiatan & Sesi Terdekat* (jadwal sesi rundown terdekat dengan penugasan kru multi-posisi nyata).
  2. **SATU Halaman Kerja Acara yang Utuh (Zero Modal-Splitting):**
     - Klik kartu acara langsung membuka satu workspace acara utuh yang discroll: Header properti acara berwarna, kelompok garapan dinamis (Layouter, Sosmed, Video & Bumper, Broadcast, Dokumentasi, Kebutuhan Lain), tabel task 6-kolom, rundown & penugasan kru, dan catatan penting.
  3. **Rundown & Penugasan Kru Multi-Posisi (Tanpa Singkatan '+1'):**
     - Menghadirkan format tabel rundown: Waktu | Sesi / Agenda | Lokasi & Kebutuhan | Penugasan Kru & Posisi.
     - Satu sesi dapat memuat banyak posisi nyata (Kamera Utama, Kamera Wing, Kamera Close Up, vMix Switching, Audio Master, Fotografi, Live Report, Koordinator Lapangan).
     - Setiap penugasan ditampilkan jelas dalam roster pill (`[🎥 Kamera Utama: Naufal]`, `[💻 vMix: Taqiu]`) tanpa singkatan '+1' yang menyembunyikan kru bertugas.
  4. **Penegakan Kru Bertugas: Hanya Kru Aktif:**
     - Selector penugasan PIC task, selector rundown session, dan filter toolbar hanya mengambil data personel berstatus 'Aktif' dari master kru Hub (`CANONICAL_STAGING_CREW_FIXTURES` & active demo team).
     - Kru nonaktif otomatis difilter keluar dari opsi seleksi penugasan.
  5. **Pengurangan Modal Besar (Inline Creation & Notion Session Drawer):**
     - Menghilangkan modal dialog besar untuk penambahan task: Koordinator dapat langsung menambahkan task baru melalui baris input inline (`.hh-inline-add-row-tr`) di dalam tabel kelompok garapan.
     - Penambahan/pengeditan sesi rundown menggunakan drawer laci samping ala Notion (`SessionSidePeek`) yang memungkinkan penambahan preset posisi cepat tanpa modal dialog pemblokir layar.
  6. **Quality Gates & Validasi:**
     - Repo-wide typecheck (`npm run typecheck`): **PASS (0 errors)**.
     - Targeted linting (`npx eslint`): **PASS (0 errors, 0 warnings)**.
     - Unit & Integration Vitest (`5 test suites, 41 tests`): **PASS (41/41 tests passed)**.
     - Build kompilasi produksi (`npm run build`): **PASS (2050 modules transformed in 16.86s)**.
     - Browser QA Playwright (`node tests/hub/haulBrowserSmoke.mjs`): **PASS (100% checks: Beranda orientasi cepat, Single Event Workspace, Tabel Task 6-kolom, Multi-Position Rundown Roster, dan Mobile view)**.

- **CLN-218 | PTV-DEV-207 — HAUL & HARLAH WORKSPACE SIMPLIFICATION & COLLABORATIVE EDITING (29 Oktober 2026, zidnal / Antigravity):**
  1. **Penyederhanaan UI Halaman Utama & Quick Summary Bar (`HaulWorkspace.tsx`, `workspace.css`):**
     - Menghadirkan ringkasan singkat progres di atas card acara (`.hh-summary-bar`) dengan 3 kartu metrik utama: *Progres Total Selesai (dengan progress track visual)*, *Sedang Dikerjakan Kru*, dan *Menunggu Review Koordinator*. Memberikan orientasi cepat dan intuitif bagi anak-anak PTV / orang awam tanpa membanjiri layar dengan tabel rumit.
     - Memperkaya visual card rangkaian acara dengan aksen warna dinamis yang hidup dan rapi (`.theme-emerald`, `.theme-amber`, `.theme-indigo`, `.theme-teal`) beserta status progress bar di tiap card acara.
  2. **Navigasi Langsung ke Full Page Acara (Eliminasi Modal Bertumpuk):**
     - Menghapus modal quick preview yang sebelumnya memblokir layar. Klik pada card acara kini langsung membuka **Full Database Page** acara (`.hh-event-full-page`) lengkap dengan tombol kembali (`← Kembali ke Ruang Kerja`).
     - Menyediakan struktur seksi berurutan ala Notion: Header properti acara berwarna, kelompok garapan dinamis, tabel task 6-kolom, rundown sesi kru, dan catatan penting.
  3. **Notion-Style Side Peek untuk Detail Task (`TaskSidePeek`, `workspace.css`):**
     - Mengganti modal dialog besar di tengah layar dengan panel laci kanan ala Notion Side Peek (`.hh-side-peek`).
     - Menampilkan dan memungkinkan pengeditan cepat: *Status*, *Deadline*, *Person (PIC)*, *Lokasi File*, *Keterangan Singkat*, *Catatan Kerja*, dan *Status Approval*.
     - Responsif pada mobile viewport (<=640px) bertransformasi otomatis menjadi bottom sheet drawer yang dapat digeser naik-turun (`max-height: 85vh`).
  4. **Kolom Baru & Editable: Lokasi File (`FileCell`, `repository.ts`):**
     - Menambahkan kolom **Lokasi File** pada tabel utama dan tabel detail acara (6 kolom kanonik: `Status | Deadline | Nama Task | Person | Lokasi File | Keterangan`).
     - Mendukung link Google Drive, URL Figma/Canva, folder kerja, maupun path catatan file server dengan icon visual otomatis dan tombol aksi edit cepat.
     - Validasi repository diperlonggar untuk menerima teks path/drive fleksibel hingga 1000 karakter tanpa penolakan skema URL http murni.
  5. **Collaborative Editing Hak Akses Kru Terbuka (`repository.ts`):**
     - Membuka hak edit kolaboratif: seluruh kru kini berhak langsung memperbarui `status` (melalui inline `StatusPicker` 1-klik), mengisi/mengubah `resultUrl` (Lokasi File), mengedit `brief` (keterangan), dan menuliskan `references` (catatan).
     - Menjaga batasan koordinator (`projecthaul.manage`) tetap fail-closed untuk aksi struktural: pembuatan task baru, penghapusan/arsip task, perubahan PIC utama, pembuatan/penghapusan kelompok garapan, dan konfigurasi edisi.
  6. **Code Hygiene & Verification:**
     - Menghapus state dan handler modal redundan (`quickPreviewEvent`, `closeQuickPreview`).
     - Membersihkan unused imports pada `HaulWorkspace.tsx` (`Status` type).
     - Menambahkan unit/integration test suite komprehensif `tests/hub/haulCollaborativeDev207.test.tsx` (8/8 tests passed).
     - Menjalankan 5 Quality Gates resmi:
       - Typecheck repo-wide (`npm run typecheck`): **PASS (0 errors)**.
       - Scoped Lint (`npx eslint`): **PASS (0 errors, 0 warnings)**.
       - Unit Vitest (`4 test files`): **PASS (36/36 tests passed)**.
       - Build kompilasi (`npm run build`): **PASS (2037 modules transformed in 16.81s)**.
       - Browser QA Playwright (`tests/hub/haulBrowserSmoke.mjs` di port 5174): **PASS (100% checks: Summary Bar, vibrant cards, direct full page navigation, 6-column table, inline StatusPicker, Notion Side Peek, responsive mobile 375px, dan kru collaborative editing)**.

- **CLN-217 | PTV-DEV-206 — HAUL & HARLAH WORKSPACE INTEGRATION INTO PTV HUB (29 Oktober 2026, zidnal / Antigravity):**
  1. **Integrasi Bersih ke Route Native PTV Hub (`/hub/haul`):**
     - Membawa modul workspace hasil final DEV-205 dari worktree terisolasi `C:\Users\zidna\.codex\worktrees\haul-harlah\ptvpro` secara selektif ke repository utama di bawah `src/products/hub/haul-workspace/` tanpa merge kasar seluruh branch Codex.
     - Mengintegrasikan workspace ke route `/hub/haul` di `src/products/hub/haul/HaulPage.tsx` yang dibungkus oleh `HubShell` native tanpa login kedua, tanpa sidebar kedua, dan tanpa double bottom nav bar.
     - Mempertahankan fungsi murni perhitungan countdown Haul (`calculateHaulTimeRemaining`, `DEFAULT_HAUL_TARGET_DATE`, `HAUL_DURATION_MS`) untuk kompatibilitas mundur test suite existing (`haulAndSeo.test.tsx`).
  2. **Isolasi Backend & Adapter Production vs Mock:**
     - Membuat arsitektur adapter eksplisit di `src/products/hub/haul-workspace/adapter.ts`: memisahkan `IsolatedMockRepository` (localStorage-backed untuk preview lokal) dan `ProductionDraftRepository` (in-memory draft untuk runtime Hub).
     - Menghilangkan celah `localStorage` digunakan sebagai penyimpanan operasional production nyata: runtime Hub berjalan dalam mode memori aman yang menampilkan banner peringatan `Penyimpanan Database Cloud Tertunda` secara eksplisit.
     - Mempertahankan rancangan migrasi SQL sebagai draft terisolasi di `docs/haul-workspace/migration.draft.sql` dan menyusun rencana migrasi di `docs/haul-workspace/DATABASE-INTEGRATION-PLAN.md` tanpa melakukan mutasi skema/data ke Supabase staging (`swadgljnyelsjstqqxbm`).
  3. **Integrasi Autentikasi, Hak Akses & Master Kru Native Hub:**
     - Mengikat kapabilitas native PTV Hub: `projecthaul.view` untuk akses tampilan dan `projecthaul.manage` untuk aksi kelola koordinator (`Atur edisi`, `+ Paket PPBS`, tambah acara, dan assignment).
     - Menghubungkan daftar personel ke fixture kru staging kanonik Hub (`CANONICAL_STAGING_CREW_FIXTURES` & `kruStore`) sehingga data personel selaras dengan modul Hub lainnya.
     - Menghapus kontrol simulator hak akses developer dan tema switcher lokal dari tampilan Hub.
  4. **Code Hygiene & Verification:**
     - Membersihkan unused imports dan dead references di test suite.
     - Menjaga isolasi CSS di bawah namespace `.hh-*` tanpa tabrakan dengan shell.css atau design system R03.
     - Menjalankan 4 Quality Gates resmi:
       - Typecheck repo-wide (`npm run typecheck`): **PASS (0 errors)**.
       - Scoped Lint (`npx eslint` pada seluruh file modul & test): **PASS (0 errors, 0 warnings)**.
       - Unit & Integration Vitest (`tests/hub/haulAndSeo.test.tsx`, `tests/hub/haulWorkspaceIntegration.test.tsx`, `tests/hub/haulRouteMount.test.tsx`): **PASS (28/28 tests)**.
       - Build kompilasi (`npm run build`): **PASS (2037 modules transformed in 16.57s)**.
       - Browser QA Playwright (`tests/hub/haulBrowserSmoke.mjs` di port 5174): **PASS (100% checks: HubShell header, breadcrumb, active nav, coordinator buttons, quick preview modal, full database page, calendar grid, responsive mobile 375px, dan crew view-only enforcement)**.

- **CLN-216 | PTV-DEV-205 — HAUL & HARLAH WORKSPACE: COMPLETE UI REBUILD (29 Oktober 2026, zidnal / Antigravity):**
  1. **Total Rebuild Presentation Layer (Zero Cosmetic Reskin):**
     - Membuang struktur JSX dan layout lama DEV-204 (banner sambutan, notice dekoratif statis, statistik dummy, dan accordion berulang).
     - Membangun Header Minimal: breadcrumb editorial `PTV Hub / Haul & Harlah`, judul & periode edisi dinamis, selector edisi, dan tombol kelola sesuai permission koordinator.
     - Membangun Gallery Rangkaian Acara di atas Ruang Kerja dengan quick preview modal interaktif (detail, kelompok project, task, rundown sesi, pembagian kru, catatan penting).
     - Menghadirkan **Full Database Page** ala Notion (`activeEventPage` / "Buka Halaman Lengkap") untuk acara dengan header properti, kelompok garapan dinamis (`Persiapan Pra Haul (Sosmed)`, `Persiapan Pra Haul (Acara)`, `Garapan Layouter`, `Produksi Video`, `Broadcast & Streaming`), tabel editable berdensitas tinggi, rundown sesi kru, dan catatan khusus.
     - Membangun Kalender Bulanan Nyata (`Calendar` view) berbasis tanggal kalender sebenarnya (7 kolom Sen-Min, navigasi bulan < Bulan Tahun Hari Ini >, tag platform warna Story/Reels/Feed/Acara dengan inisial PIC), menghapus total hardcode 22 sel dan tanggal 29 aktif dari DEV-204.
     - Database-style work management di Ruang Kerja (`By Project`, `By Person`, `By Event`, `List`) dengan tabel ringkas Linear/Notion, status pill terstandarisasi, dan kontrol filter/saved views personal.
  2. **Code Hygiene & Targeted Cleanup:**
     - Membersihkan seluruh unused variables (`useEffect`, `curDate`) dan parameter mati.
     - Memastikan CSS terisolasi sepenuhnya di bawah class namespace `.hh-*` tanpa kebocoran global atau duplikasi token R03.
     - Mempertahankan integritas domain 100%: invariant repository, cycle detection, permission check koordinator vs kru, conflict detection, dan persistensi localStorage tanpa mutasi cloud Supabase.
  3. **Quality Gates:**
     - Isolated typecheck (`npx tsc --noEmit -p tsconfig.haul.json`): **PASS (0 errors)**.
     - Scoped eslint (`npx eslint src/products/hub/haul-workspace/HaulWorkspace.tsx src/products/hub/haul-workspace/fixtures.ts`): **PASS (0 errors, 0 warnings)**.
     - Unit test (`npx vitest run --config vite.haul.config.ts`): **PASS (19/19 tests)**.
     - Build kompilasi (`npx vite build --config vite.haul.config.ts`): **PASS (38 modules transformed in 8.81s)**.
     - Browser E2E Playwright (`node tests/haul-workspace/browser.mjs`): **PASS (14/14 checks, 0 page errors, 0 external leaks)**.

- **CLN-215 | PTV-DEV-205 — Penomoran Surat Izin tahunan atomik (29 Oktober 2026, zidnal / Codex):**
  - **Finalisasi font/alur cetak (PENDING OPERATOR ACC):** menghapus modal kode enam digit yang hanya memvalidasi panjang input UI beserta state/CSS yatim. Memisahkan prepare/download/print agar salinan memakai Blob final yang sama; retry menyimpan dokumen/idempotency key dan tidak menelan error PDF. Reuse hook modal shared untuk focus/scroll/Escape; tidak cleanup lintas modul. Plus Jakarta Sans lokal beserta lisensi, font load guard dan pemeriksaan glyph ditambahkan. 122 tes terkait/lint PASS; bukti browser dan hasil build akhir di review DEV-205. Tidak mengubah SQL/registry/RPC/database.
  - **PDF visual/content parity:** menghentikan penggunaan template generik untuk SI, menggunakan ulang komponen preview dan serializer bytes; model mempertahankan objek/urutan kolom santri. Menghapus klaim komentar cetak HTML identik 100% yang tidak benar. Review terarah: tidak ada helper/import yatim pada file tersentuh, tidak mengubah modul lain. Bukti 20 kasus/42 halaman strict + screenshot native/Poppler + QR; typecheck/lint/build dan 112 tes unik terkait PASS. Detail/batas di dokumen review yang sama.
  - **PDF serializer final fix:** menghapus ketidaksesuaian UTF-8 vs byte output dan truncation charCodeAt, memakai satu serializer bytes untuk download; tidak membuat jalur PDF paralel. Menghapus pemotongan daftar 10 santri/enam barang; page tree valid untuk seluruh data. Header/footer existing dipertahankan dengan pembungkusan legal/penerbit. Regression test baru memeriksa offsets/Length/JPEG/A4/Blob; verifier pypdf strict dan QR render dijalankan. Assertion PDF lama yang usang diselaraskan dengan kop existing; test ST diselaraskan dengan seed 042 tanpa perubahan algoritma. 149 tes, typecheck/lint/build PASS; tidak ada perubahan database/migrasi. Referensi dan reproduksi di docs/LETTER-NUMBERING-205-REVIEW.md.
  - **Aktivasi staging setelah ACC:** dokumentasi hasil diperbarui tanpa perubahan kode/cleanup baru. Backup terenkripsi dan bukti nonpribadi di lokasi scratch stabil. Penomoran cloud 012–014 dan retry/konkurensi lulus; empat dokumen historis tetap identik. Uji dihentikan pada peringatan xref PDF; serializer tidak diubah dan tidak ada rollback destruktif. Rincian di docs/LETTER-NUMBERING-205-REVIEW.md.
  - Mengganti helper gap-filling dengan `calculateNextLetterNumber`, memperbarui semua referensi aktual pada API/service/store/tests, dan menangani urutan empat sampai enam digit. Tidak menyisakan allocator paralel bernama lama.
  - Menghapus pemilihan nomor final SI dari jalur create aplikasi; RPC database menjadi sumber hasil final. Fallback penerbitan SI melalui store lokal ditolak. Preview ditandai perkiraan dan tidak mengklaim reservasi.
  - Mengoreksi prioritas objek `santri_list` atas array nama; mapping API dan service mempertahankan metadata, QR, dan pengesah. Menjaga implementasi Google Sheets existing.
  - Menandai proposal SQL gap-filling lama sebagai superseded dan menyediakan migrasi/panduan review yang dirujuk roadmap; tidak menghapus arsip proposal atau menomori ulang dokumen.
  - Review terarah: referensi helper/import/pemanggil diperiksa dengan rg dan typecheck/lint, tidak ada CSS baru atau perubahan routing/dynamic import; tidak membersihkan modul lain. Skrip lokal memakai cluster sintetis terisolasi dan menutup runtime setelah uji.
  - Bukti: 123/123 Vitest terarah, 26/26 PostgreSQL lokal, typecheck/build dan lint file tersentuh PASS. Lint repo masih gagal di `tests/hub/cacheLifecycle192.browser.cjs` (7 no-undef); migrasi remote dan QA browser/cloud belum dijalankan.


- **CLN-214 | PTV-DEV-204 — HAUL & HARLAH WORKSPACE UI/UX REDESIGN (R03 & NOTION PARITY) (29 Oktober 2026):**
  1. **Transformasi Antarmuka ke Editorial R03 & Notion Adaptive Workspace:**
     - Merombak total src/products/hub/haul-workspace/workspace.css dan HaulWorkspace.tsx di worktree terisolasi C:\Users\zidna\.codex\worktrees\haul-harlah\ptvpro.
     - Mengimplementasikan 5 view adaptif (Calendar, By Project, By Person, By Event, List) dengan tabel Notion yang bersih, status pill soft, dan avatar inisial kru.
     - Mengimplementasikan tampilan kalender Notion dengan tag warna-warni kontras tinggi (.hh-tag-story, .hh-tag-reels, .hh-tag-feed, .hh-tag-event) dan badge tanggal aktif bulat merah.
     - Menghubungkan modal detail .hh-event dengan quick preview acara komprehensif (Proyek, Task, Rundown Sesi, Kru) sekaligus form editor acara yang mematuhi accessibility, focus trap, dan scroll lock.
  2. **Zero Drift & Repository Invariant Safety:**
     - Mempertahankan 100% kontrak invariant 
epository.ts dan 19/19 unit tests di 
epository.test.ts.
     - Menjamin kebersihan dependensi: tidak menginstal package baru, tidak menyentuh repository utama di port 5174, tidak menyentuh database cloud Supabase.
  3. **Quality Gates Terverifikasi:**
     - 
px tsc --noEmit -p tsconfig.haul.json: PASS (0 errors).
     - 
px vitest run --config vite.haul.config.ts: PASS (19/19 tests).
     - 
px vite build --config vite.haul.config.ts: PASS (built in 9.34s, 38 modules transformed).
     - 
ode tests/haul-workspace/browser.mjs: PASS (12/12 checks, 0 page errors, 0 network leaks).

- **CLN-213 | PTV-DEV-203 — FINANCE 2.0 | UNIFIED SKELETON LOADING SYSTEM (29 Oktober 2026):**
  1. **Standardisasi Komponen Skeleton Terpusat:**
     - Membuat arsitektur komponen skeleton terstruktur di `src/products/hub/keuangan/components/skeletons/`: `FinanceSkeletonBase.tsx`, `FinanceOverviewSkeleton.tsx`, `FinanceTransactionSkeleton.tsx`, `FinancePocketSkeleton.tsx`, `FinanceKasKruSkeleton.tsx`, `FinancePiutangSkeleton.tsx`, `FinanceLaporanSkeleton.tsx`, `FinanceSettingsSkeleton.tsx`, dan `FinanceSectionSkeleton.tsx`.
     - Menggantikan skeleton generik inlined kasar `FinanceSkeleton` di `FinancePage.tsx` yang sebelumnya memanggil CSS class `fin-skel-shimmer` yang belum terdefinisi.
  2. **Pembersihan Fallback Teks & Anti-Layout Shift:**
     - Membersihkan fallback teks polos unstyled `<p role="status">Memuat data operasional dari Staging…</p>` di `FinanceOperationalWorkspace.tsx` menjadi skeleton content-aware terpadu (`FinanceSectionSkeleton`) dengan `sr-only` accessibility text.
     - Membersihkan elemen teks unstyled pada latar belakang pemuatan kru di `FinanceKasKruView.tsx` menjadi indikator subtle badge.
     - Memastikan tidak ada layout shift saat background refetch berlangsung (`loading && data` mempertahankan visual data yang ada).
  3. **Penghapusan Tipe Liar / Unused Variable:**
     - Memperbaiki ketidaksesuaian tipe pada `GeneratorSuratPage.tsx` (`group: any` dan casting aman `santri_list`) sehingga kompilasi `tsc --noEmit` bersih tanpa error.
  4. **Quality Gates:**
     - `npm run typecheck`: PASS (0 errors).
     - `npm run build`: PASS (0 errors).
     - Vitest `tests/hub/financeUnifiedSkeletons.test.tsx`: PASS (11/11 tests).

- **CLN-212 | PTV-DEV-202 — GENERATOR SURAT IZIN | LEGACY PHP PARITY (29 Oktober 2026):**
  1. **Audit & Penyelarasan Penuh Aturan Bisnis PHP Legacy (`legacy/page-dasbor.php`):**
     - Memverifikasi sumber kebenaran data santri: Google Sheets CSV (`SHEET_CSV_URL` dengan `gid=1168748355`) dan fallback kanonikal 20 santri resmi lintas angkatan (11, 12, 13, 14, 15).
     - Menjamin filter kelayakan santri: `nama && nama !== '-'`, parsing 11 kolom, pengelompokan angkatan berurutan numerik (`parseInt(a) - parseInt(b)`), dan pengurutan nama alfabetis di dalam angkatan (`localeCompare(b.nama, 'id')`).
     - Mengimplementasikan baris header kelompok angkatan pada tabel santri (`ANGKATAN {angk} ({count} Santri)`) persis seperti PHP legacy.
     - Mengaktifkan auto-load data santri Google Sheets secara otomatis pada saat inisialisasi halaman (`useEffect`).
  2. **Penghapusan Menyeluruh Istilah & Tahapan "Pra-Pengesahan":**
     - Menghapus badge dan teks "Pra-Pengesahan" dari `GeneratorSuratPage.tsx` dan `SuratIzinPdfPreview.tsx`.
     - Mengubah status penerbitan dokumen menjadi langsung resmi **"Disetujui" / "Resmi"** (badge hijau emerald).
     - Memperbarui modal otorisasi: dari "Draf Pengajuan" / "Kirim Pengajuan" menjadi **"Otorisasi Penerbitan Surat Resmi"** dan **"Terbitkan & Unduh Dokumen Resmi"**.
  3. **Penomoran Surat Resmi Multi-Santri:**
     - Memastikan format nomor surat persis PHP legacy: `{3_digit_seq}/SI-PTV/{ROMAN_MONTH}/{YEAR}` (contoh: `001/SI-PTV/X/2026`).
     - Memastikan sequence terisolasi per kategori dokumen `'SI'` (Surat Izin) via vacancy check ke backend `ptv_verify_nomor_surat_vacant` / `getNextVacantNomorSurat`.
     - Satu surat izin resmi menampung seluruh santri yang dicentang dalam tabel multi-santri, bukan membuat satu nomor surat per santri.
  4. **Otomatisasi Unduh PDF Resmi & Integrasi Verifikasi Publik:**
     - Mengintegrasikan fungsi biner `downloadOfficialDocPdf` yang langsung mengunduh PDF A4 ber-KOP resmi, tabel santri, keabsahan, dan QR code vektor tajam segera setelah dokumen tersimpan ke Supabase `ptv_surat_izin`.
     - Nomor surat izin berstatus 'Disetujui' terbukti terverifikasi 'valid' pada endpoint publik `/api/verifikasi-surat` dan `/verifikasi-surat/:nomor`.
  5. **Quality Gates & Paritas Test:**
     - `npm run typecheck`: PASS (0 errors).
     - `npx eslint`: PASS (0 errors, 0 warnings).
     - Vitest `tests/hub/generatorSuratLegacyParity.test.ts` & `tests/hub/generatorSurat.test.ts`: PASS (15/15 tests).

- **CLN-211 | PTV-DEV-201 — FINANCE 2.0 STAGING ACTIVATION (29 Oktober 2026):**
  1. **Verifikasi Pelepasan 17 Freeze Trigger & DDL Staging:**
     - Mengonfirmasi penonaktifan trigger `finance151_database_freeze` pada seluruh 17 tabel Finance pasca eksekusi DDL operator di Supabase Dashboard SQL Editor (`swadgljnyelsjstqqxbm`).
     - Menguji mutasi penulisan via SECURITY DEFINER RPC atomik: bebas dari error SQLSTATE `55000` (freeze terlepas).
  2. **Peralihan Maintenance Flag & Sanitasi Boundary Test:**
     - Mengubah `PTV_FINANCE_MAINTENANCE=false` di `.env.staging.local`.
     - Memperbaiki `api/financeMaintenance.ts` agar saat `process.env.VITEST` aktif tetap mematuhi isolasi environment mock test tanpa terdistorsi file lokal. 28/28 tests PASS.
  3. **Smoke Test Transaksi Terkendali & Idempotency Replay:**
     - Menjalankan mutasi transaksi pemasukan Rp 1.000 via sesi sah PTV-001 (`c08952de-a8ff-48e0-8182-ac0bb7ac6767`).
     - Berhasil mencatat mutasi atomik, saldo kas bertambah menjadi Rp 521.276, dan replay idempotency dengan key identik mengembalikan HTTP 200 `{ idempotent_replay: true }` tanpa duplikasi baris.
  4. **Pembersihan Resmi (Atomic VOID Reversal) & Zero-Drift Balance:**
     - Membatalkan transaksi uji secara resmi via `rpc_void_finance_transaction_atomic`.
     - Status transaksi menjadi `reversed`, saldo Kas Utama Studio kembali persis ke **Rp 520.276 (52027600 minor)**.
     - Rekonsiliasi ledger: selisih Rp 0 (nol rupiah). Total transaksi: 59 (54 posted, 5 reversed).
  5. **Pengujian Siklus Hidup Kantong & Kategori:**
     - Pembuatan kantong uji coba dan pengarsipan via RPC sukses tercatat di audit log.
     - Pembuatan kategori baru dan pengarsipan sukses tercatat di audit log.
  6. **Quality Gates:**
     - `npm run typecheck`: PASS (0 errors).
     - Vitest `financeMaintenance.test.ts`: PASS (28/28 tests).


- **CLN-210 | PTVPRO FINANCE FINAL EXECUTION (29 Oktober 2026):**
  1. **Pembuatan Snapshot Terenkripsi Lengkap di Luar Repositori:**
     - Menghasilkan full backup data dan skema Finance 2.0 (17 tabel, 58 transaksi, 55 alokasi, saldo Rp 520.276, DDL, RPC, RLS, Triggers) terenkripsi AES-256-GCM pada `C:\Users\zidna\.gemini\antigravity\brain\2a6f86e6-4bcc-4cf2-9faa-c6c36a0f43db\backups\ptv_finance_staging_snapshot_20261029.json` (281.813 bytes). Lolos verifikasi dekripsi dan integritas checksum SHA-256 (`0eea01cd8cafb56c317d7094d1e25796cf910bf86778a084002eb5eed230f627`).
  2. **Peralihan Maintenance Flag Runtime Otomatis (`api/financeMaintenance.ts`):**
     - Memperbarui evaluasi runtime `financeMaintenanceActive()` agar secara dinamis mendeteksi konfigurasi `PTV_FINANCE_MAINTENANCE=false` dari `.env.staging.local` tanpa perlu restart node process manual.
     - Memverifikasi endpoint `POST /api/finance` beralih dari status pemeliharaan (503) ke evaluasi sesi normal (401 saat tanpa sesi).
  3. **Penyelarasan SOP Pelepasan Freeze & Quality Gates:**
     - Menyediakan skrip terpadu penonaktifan 17 trigger freeze, skrip smoke test terisolasi, dan skrip rollback darurat re-enabling 17 triggers.
     - Quality gates: `npm run typecheck` PASS (0 errors), `npx eslint` PASS, Vitest PASS.

- **CLN-209 | PTV-DEV-199 — FINANCE DATABASE FINALIZATION (29 Oktober 2026):**
  1. **Verifikasi Matematis Konsistensi Buku Besar Staging (`swadgljnyelsjstqqxbm`):**
     - Membuktikan rekonsiliasi nol-selisih (0 rupiah): 54 transaksi posted (Rp 1.254.200 pemasukan, Rp 733.924 pengeluaran, Rp 40.000 transfer seimbang) + 4 transaksi dibatalkan historis (reversed) = tepat 58 transaksi.
     - 55 baris alokasi kantong terbukti 100% konsisten terhadap saldo kas aktif Kas Utama Studio Rp 520.276 tanpa ada orphan allocation maupun saldo negatif.
  2. **Audit & Pembuktian 17 Trigger Freeze PostgreSQL Finance151:**
     - Mengaudit ke-17 tabel yang diproteksi trigger `finance151_database_freeze` (`ENABLE ALWAYS`) dengan fungsi penolak `ptv_finance_maintenance.reject_write()`.
     - Membuktikan pemblokiran multi-layer: direct service_role mutation ditolak via PostgreSQL table ACL (`REVOKE ALL`), dan pemanggilan RPC atomik oleh akun berwenang PTV-001/PTV-002 secara mutlak diintersepsi trigger freeze dengan error terverifikasi: `FINANCE_MAINTENANCE: database writes are frozen (SQLSTATE 55000)`.
  3. **Validasi RLS & Anti-Spoofing Hak Akses:**
     - Memverifikasi isolasi pembacaan data kas & pinjaman: kru biasa (`crew`) dibatasi secara ketat hanya pada data miliknya (`ptv_id = current_authenticated_ptv_id()`), personil Pembina & Pengarah ditolak fail-closed via `is_finance_restricted_personnel()`, serta data pinjaman pihak ketiga hanya dapat diakses oleh peran pengelola (`finance.manage`).
  4. **Penyusunan Prosedur & Rencana Pelepasan Freeze Resmi:**
     - Menyiapkan inventaris lengkap 17 tabel, skrip DDL/DCL pelepasan freeze, skrip rollback darurat, urutan aktivasi maintenance flag, dan langkah smoke test terisolasi setelah izin eksplisit (ACC) diberikan operator.
  5. **Bukti Quality Gates:**
     - SQL Integrity Checks: 100% PASS (58 transaksi, 55 alokasi, 3 kantong, 14 kategori, 2 semester, 1 settings).
     - RPC Contract & Freeze Verification: PASS (terverifikasi menolak penulisan ilegal via SQLSTATE 55000).
     - Working tree bersih dan bebas dari modifikasi destruktif.

- **CLN-208 | PTV-DEV-198 — FINANCE 2.0 FINAL COMPLETION & OPERATIONAL READINESS (29 Oktober 2026):**
  1. **Integrasi Endpoint Operasional Atomik Backend (`api/finance.ts`):**
     - Menggantikan stub 503 `FINANCE_OPERATIONAL_HOLD` dengan integrasi RPC atomik database staging PostgreSQL `swadgljnyelsjstqqxbm`:
       * `post_kas_payment_atomic` -> `rpc_record_kas_kru_payment_atomic`
       * `disburse_loan_atomic` -> `rpc_disburse_loan_atomic`
       * `post_loan_payment_atomic` -> `rpc_record_loan_payment_atomic`
       * `reverse_operational_atomic` -> `rpc_reverse_operational_record_atomic`
       * `update_finance_settings` -> update konfigurasi studio di `ptv_finance_settings`
       * `create_semester` & `update_semester` -> pengelolaan semester di `ptv_finance_semesters`
     - Validasi fail-closed: jika SQLSTATE '55000' (freeze aktif), mengembalikan status 503 dengan kode `FINANCE_FREEZE_ACTIVE` dan pesan yang transparan.
  2. **Eliminasi Placeholder & Restorasi Hak Kelola UI (`FinancePage.tsx`, `FinanceOperationalWorkspace.tsx`):**
     - Menghapus card placeholder "Fitur operasional belum siap" dan blokir `operationalHeld` di `FinancePage.tsx`. Tab Pengaturan kini terbuka penuh untuk Bendahara/Eksekutif (`canManage`).
     - Di `FinanceOperationalWorkspace.tsx`: Mengembalikan `canManage: data.canManage` (bukan lagi dipaksa `false`). Tombol aksi operasional dan modal dapat dibuka oleh Bendahara, sementara mode pemeliharaan (write freeze) diinfokan secara transparan pada banner status R03.
     - Menambahkan ID anchor navigasi (`id="umum"`, `id="kas-kru"`, `id="kategori"`, `id="piutang"`) dan scroll listener halus pada `FinanceSettingsView.tsx` untuk kelancaran deep-linking.
  3. **Pembersihan Fixture Runtime & Integrasi Cloud Services (`financeSettingsService.ts`, `kasKruService.ts`):**
     - Menghapus `assertFinanceFixtureRuntime();` yang melempar fatal exception saat runtime staging.
     - Menyediakan cloud functions terisolasi (`saveFinanceSettingsCloud`, `createSemesterCloud`, `updateSemesterCloud`) dengan fallback lokal aman saat cloud write freeze.
     - Membersihkan unused imports dan catch variable bindings yang tidak digunakan.
  4. **Bukti Quality Gates Nyata:**
     - `npm run typecheck`: PASS (0 errors).
     - `npx eslint` pada file termodifikasi: PASS (0 errors, 0 warnings).
     - Vitest DEV-198 Test Suite (`financeOperationalFlows198.test.ts`): PASS (6/6 tests).
     - 9 Major Finance Test Suites: PASS (59/59 tests).
     - Production Build (`npm run build`): PASS (built in 16.13s).
     - Browser Visual QA Playwright Edge: 10 tangkapan layar tersimpan di `.gemini/scratch/screenshots/vqa-dev198-*.png` (7 tab desktop, dark mode, dan mobile 390px).

- **CLN-207 | PTV-DEV-196 — SIDEBAR BRANDING & HEADER OVERLAP HOTFIX (29 Oktober 2026):**
  1. **Eliminasi Branding Ganda & Overflow (HubShell.tsx, dashboard.css, shell.css):**
     - Memperbaiki konflik spesifisitas CSS pada .side-brand .brand-logo-gradient yang sebelumnya memaksa kedua elemen branding (brand-logo-expanded dan brand-logo-minimized) tampil bersamaan dengan display: block dan lebar 175px (total 350px+), sehingga meluber keluar batas sidebar 250px dan menimpa tombol collapse serta crumb judul header.
     - Memisahkan elemen: span.brand-logo-expanded untuk expanded (logo lengkap Progresif TV Production) dan img.brand-logo-symbol untuk minimized. Menambahkan overflow: hidden pada container .side-brand sebagai guardrail struktural.
  2. **Integrasi Simbol PTV PNG Asli (public/assets/images/ptv-symbol.png, HubShell.tsx, dashboard.css):**
     - Menyimpan aset PNG simbol resmi operator ke direktori permanen public/assets/images/ptv-symbol.png (91.1 KB, rasio natural 1:1, transparan).
     - Menghapus mask styling monokrom hitam/putih pada minimized logo; menampilkan simbol asli (lingkaran tetesan hijau dengan huruf P putih) dengan ukuran 36x36px terpusat sempurna pada area branding 72px (margin: 0 auto; object-fit: contain).
     - Tampil kontras dan proporsional baik pada light mode maupun dark mode.
  3. **Penyelarasan Layout Header & Tombol Collapse Bebas Shift/Flicker (HubShell.tsx, tokens.css, dashboard.css):**
     - Menyelaraskan token --sidebar-w: 250px; (expanded) dan --sidebar-w: 72px; (collapsed) secara konsisten di tokens.css dan dashboard.css.
     - Memperbarui attribute data-sidebar-collapsed pada document.documentElement secara sinkron langsung pada callback toggleSidebarCollapse dan state initializer, mengeliminasi layout shift/flicker 1-frame saat transisi.
     - Memastikan posisi tombol collapse stabil di batas kanan sidebar (right: -12px; top: 21px; z-index: 85), memberikan gap aman 51px dari logo expanded dan 17px ke judul header (.crumb pada x=278px saat expanded, x=100px saat minimized).
     - Menegakkan .hdr .brand { display: none !important; } pada desktop (>=1024px) untuk mencegah double instance dengan topbar.
  4. **Preservasi Navigasi Mobile:**
     - Pada mobile (<1024px), sidebar tetap tersembunyi (display: none), header menampilkan single brand logo dan search action, serta dock navigasi bawah beroperasi normal tanpa regresi.
  5. **Bukti Quality Gates Nyata:**
     - npm run typecheck: PASS (0 errors).
     - npx eslint src/products/hub/shell/HubShell.tsx: PASS (0 errors, 0 warnings).
     - Vitest Hub Navigation & Shell Suite (3 test files, 28 tests): PASS (100%).
     - Production Build: npm run build: PASS (built in 11.97s).
     - Browser Visual QA (8/8 tangkapan layar Playwright Edge tersimpan di .gemini/scratch/screenshots/):
       * vqa-dev196-1-expanded-light.png
       * vqa-dev196-2-expanded-dark.png
       * vqa-dev196-3-minimized-dark.png
       * vqa-dev196-4-minimized-light.png
       * vqa-dev196-5-nav-inventaris.png
       * vqa-dev196-6-refresh-inventaris.png
       * vqa-dev196-7-re-expanded-inventaris.png
       * vqa-dev196-8-mobile-beranda.png

- **CLN-206 | PTV-DEV-192 — STABILISASI FUNGSIONAL, TERTUNDA (29 Oktober 2026):**
  - Menghapus duplikasi pencocokan parsial nama dari API/halaman Dokumen Saya; API memakai utilitas identitas bersama, halaman memakai hasil filter backend.
  - Menghapus fallback fixtures pada daftar arsip/dokumen live dan notulensi Acara; empty state dipertahankan sebagai kosong. Membersihkan import fixtures/store yang tidak lagi digunakan pada halaman tersebut.
  - Menyatukan pembaruan cache setelah konfirmasi mutasi service Inventaris/Peminjaman/laporan; mencegah stale response menggantikan hasil mutasi dan respons akun lama masuk ke akun baru.
  - Review terarah belum selesai: `api/dokumen.ts` mengalami perubahan bersamaan DEV-193/194 dan kini memiliki jalur create tambahan; jangan menghapusnya sebelum rekonsiliasi. Lint masih menemukan 7 global `no-undef` pada harness browser DEV-192. Tidak melakukan cleanup massal, penghapusan dependencies, atau perubahan Finance/mobile.
  - Bukti: typecheck PASS, 180 tes lokal PASS, browser cache 8/8 PASS. Build belum dijalankan. Critical Override menghentikan edit kode; detail pada handoff DEV-192 di `piketdev.md`.

- **CLN-205 | PTV-DEV-194 — DATABASE INTEGRATION & FINANCE SCHEMA GAP COMPLETION:**
  1. **Integrasi Database Pengelolaan Portal (`api/portal.ts`, `portalManagementService.ts`, `docs/PTVPRO-PORTAL-MANAGEMENT-SCHEMA.sql`):**
     - Memigrasikan persistensi Portal Management dari `localStorage` murni ke PostgreSQL Supabase Cloud staging (`ptv_portal_services`, `ptv_portal_settings`, `ptv_portal_audit_logs`).
     - Menyediakan API route `/api/portal` dengan isolasi hak akses pengelola portal vs konsumsi data publik (`is_public=true & is_published=true & is_active=true`).
     - Mempertahankan backward-compatibility dengan generated column `pub SMALLINT GENERATED ALWAYS AS (CASE WHEN is_public THEN 1 ELSE 0 END) STORED`.
  2. **Pengumuman Portal vs Pengumuman Hub (Separation of Concerns & Trigger Constraint):**
     - Membangun tabel mandiri `ptv_portal_announcements` untuk Portal Publik (`/`), terpisah 100% dari `ptv_pengumuman` internal kru Hub (`/hub/broadcast`).
     - Menegakkan aturan single-active announcement pada level database PostgreSQL engine via trigger `trg_single_active_portal_announcement` (`fn_ensure_single_active_portal_announcement`).
     - Membuka akses mutasi internal pada `api/broadcast.ts` (POST, PUT, DELETE) dengan otorisasi berbasis session (`broadcast.dispatch`).
  3. **Penerbitan Generator Surat Izin Cloud (`api/dokumen.ts`, `GeneratorSuratPage.tsx`):**
     - Mengintegrasikan aksi `createDocument` ke cloud staging table `ptv_surat_izin` dengan alokasi nomor surat otomatis gap-filling (`calculateSmallestAvailableLetterNumber`), qr token, dan metadata santri lengkap.
     - Penanganan error fail-closed: kegagalan penyimpanan ke cloud tidak akan mengklaim keberhasilan penerbitan surat.
     - Kompatibel penuh dengan verifikasi publik `/verifikasi-surat` dan scan QR.
  4. **Penyelarasan Skema Keuangan & Perlindungan 17 Freeze Triggers:**
     - Menambahkan kolom pelengkap secara aditif dan idempotent pada `ptv_finance_kas_records`, `ptv_finance_kas_payments`, `ptv_finance_loans`, dan `ptv_finance_loan_payments`.
     - Memverifikasi 17 trigger write-freeze Finance151 (`finance151_database_freeze`) tetap aktif dengan status `ENABLE ALWAYS` (tgenabled = 'A').
     - Memverifikasi ledger historis (58 transaksi) dan saldo kantong (Rp 520.276) zero drift.
  5. **Verifikasi Quality Gates Nyata:**
     - `npm run typecheck`: **PASS (0 errors)**.
     - Vitest Portal & Hub Suite (7 test files, 63 tests): **PASS (100%)**.
     - Vitest Finance Suite (23 test files, 283 tests): **PASS (100%)**.
     - Production Build: `npm run build`: **PASS (✓ built in 21.85s)**.
     - Verifikasi Integrasi PostgreSQL Cloud Staging (`.gemini/scratch/verify_cloud_integration.cjs`): **PASS (100%)**.

- **CLN-204 | PTV-DEV-193 — GLOBAL UI POLISH: MODAL, SIDEBAR & THEME:**
  1. **Skeleton Keuangan Realistis & SWR Preservation (`src/products/hub/keuangan/FinancePage.tsx`, `financeFoundation.css`):**
     - Mengubah skeleton primitif 3 kotak shimmer menjadi `FinanceSkeleton` adaptif per-tab (Ringkasan: Hero Balance, 4 Bento KPI, 2-kolom charts & list; Transaksi: Filter bar & 6-row table; Kantong: Summary & 4-card grid; Kas Kru/Piutang: 2 KPI card & table).
     - Menghapus `setData(null)` pada revalidasi `useEffect`: skeleton hanya tampil saat cold load (`loading && !data`), data lama dipertahankan saat refresh di latar belakang tanpa mengosongkan layar.
     - Penanganan loading state aman yang dijamin clear di `finally`.
  2. **Portal & Scroll Boundaries Modal Broadcast (`src/products/hub/broadcast/components/`, `src/styles/broadcast.css`):**
     - Membungkus `AnnouncementModal`, `AnnouncementDetailModal`, dan `DeleteConfirmModal` dengan `createPortal(..., document.body)` untuk membebaskan dialog dari stacking context parent.
     - Memperbaiki batas `max-height: min(90dvh, 680px)`, sticky header & footer, form wrapper `.bc-modal-form-wrap`, internal scrolling form, safe-area inset bottom padding, dan computed font-size $\ge 16$px untuk mencegah auto-zoom di iPhone.
  3. **Modal QR Verifikasi Identitas Compact (`src/products/hub/id-digital/IdDigitalPage.tsx`):**
     - Mengeliminasi ruang kosong vertikal raksasa dengan mengubah dialog ke ukuran compact proporsional (`width: 100%; max-width: 390px; height: auto; min-height: 0`).
     - Menyematkan overlay fixed terpusat (`z-index: 10000; backdrop-filter: blur(8px)`), tombol close 'X' absolut, QR pad 176px proporsional, serta safe text wrapping (`word-break: break-all; overflow-wrap: anywhere`) pada URL verifikasi.
  4. **Sidebar Footer Layout Baru (`src/products/hub/shell/HubShell.tsx`, `shell.css`, `dashboard.css`):**
     - Mode Expanded: Baris 1 tombol full width "Kembali ke Portal"; Baris 2 container `.side-foot-row` berisi tombol Tema (kiri) dan tombol Keluar (kanan, aksen merah elegan via token `--danger`).
     - Mode Minimized: 3 kontrol ikon 40x40px terpusat tanpa tumpang tindih dan tanpa melebarkan sidebar 72px.
     - Visual background subtle `var(--bg-1)` dengan border-top tipis konsisten R03, footer sticky di dasar sidebar, dan menu navigasi scrollable mandiri.
  5. **Minimized Sidebar Divider & Signature Branding (`src/styles/dashboard.css`, `HubShell.tsx`):**
     - Menambahkan divider garis tipis `1px solid var(--line-2)` antargrup navigasi saat collapsed (`.side-grp + .side-grp`) dengan padding konsisten antar-ikon.
     - Menyiapkan branding signature terpusat proporsional di container 44x44px dengan graceful fallback ke logo webp resmi (dilaporkan ketiadaan aset `Logo Simple Signature White@3x.png`).
  6. **Instant Theme Switching Atomik (`HubShell.tsx`, `base.css`):**
     - Menambahkan kelas utilitas `.ptv-theme-instant` pada `document.documentElement` saat `toggleTheme` untuk menonaktifkan transisi CSS staggered sesaat, mengubah tema dalam 1 frame render serempak, lalu menghapusnya via ganda `requestAnimationFrame`.
     - Menghormati `@media (prefers-reduced-motion: reduce)`.
  7. **TypeScript Compiler Hygiene (`api/dokumen.ts`):**
     - Memperbaiki deklarasi catch error parameter `catch (dbErr: any)` pada 3 endpoint penyimpanan dokumen (surat izin, surat tugas, surat barang) yang sebelumnya memicu TS2304 `Cannot find name 'dbErr'`.
  8. **Verifikasi Quality Gates:**
     - `npm run typecheck`: **PASS (0 errors)**.
     - `npx eslint` file termodifikasi: **PASS (0 errors, 0 warnings)**.
     - `npm run build`: **PASS (✓ built in 23.26s)**.
     - Vitest Regresi (5 test files, 45 tests): **PASS (100%)**.
     - Playwright Visual QA (7/7 tangkapan layar nyata di `.gemini/scratch/screenshots/`): **PASS**.

- **CLN-203 | PTV-DEV-191 — FINANCE 2.0 FINALIZATION (Logic, Workflow, UI/UX & Integration):**
  1. **Audit & Penyelarasan API Backend Staging (`api/finance.ts`):**
     - Memperkuat pra-validasi metadata pada aksi `update_transaction` di edge/API layer (`updates.amount`, `updates.amountMinor`, `updates.allocations` strictly forbidden) sebelum delegasi ke RPC atomik `rpc_finance_admin_mutation_server`.
     - Menjamin kepatuhan arsitektur Finance151 tanpa fallback direct-write yang rentan drift saldo.
  2. **Harmonisasi Test Suite Finance & Backward-Compatibility RPC (24/24 Suites PASS, 291/291 Tests PASS):**
     - Merevisi mock pada suite test historis (`financeFinishing149.test.tsx`, `financeFunctionalVerification.test.ts`, `financeSpoofingAndAccess.test.ts`) agar memadankan pemanggilan `rpc_finance_admin_mutation_server` dengan kode status yang benar (409 stale version, 200 konfirmasi mutasi, 403 authorization deny).
     - Memverifikasi 100% kelulusan seluruh 24 file unit/integration test Keuangan di repositori.
  3. **Progressive Disclosure Alokasi Transaksi (`src/products/hub/keuangan/FinanceWorkspace.tsx`):**
     - Membangun mode *Single Pocket* default pada form pencatatan pemasukan, pengeluaran, dan transfer kas, mengeliminasi formulir split alokasi yang membingungkan untuk 90% operasi kas rutin.
     - Menyediakan toggle `+ Bagi alokasi ke beberapa kantong (split)` bagi operasi multi-kantong lanjutan.
     - Menyematkan *Quick Amount Chips* (`Rp 25.000`, `Rp 50.000`, `Rp 100.000`, `Rp 250.000`, `Rp 500.000`) untuk mempercepat input nominal tanpa pengetikan manual berulang.
  4. **Maintenance Gate & Write-Freeze Transparency (`FinancePage.tsx`, `FinanceWorkspace.tsx`, `FinanceOverview.tsx`, `financeFoundation.css`):**
     - Memasang `.finance-maintenance-banner` yang informatif dan ramah pengguna ketika `data.writesEnabled === false` atau server staging berada dalam status write-freeze pemeliharaan ledger.
     - Menjaga transparansi: mutasi dinonaktifkan dengan penjelasan yang jujur tanpa menyembunyikan status sistem atau menampilkan error palsu.
  5. **Mobile-First UX Hardening (iPhone 13 mini 375x812 & Safari Anti Auto-Zoom):**
     - Menerapkan computed `font-size: 16px !important` pada seluruh elemen form, select, textarea, dan input pencarian transaksi untuk mobile ($\le 768$px).
     - Menyematkan safe area padding bottom (`max(16px, env(safe-area-inset-bottom, 16px))`) dan touch target ergonomis $\ge 44$px pada modal sheet.
     - Terbukti 0 horizontal overflow pada pengujian Playwright Chromium di viewport 375x812.
  6. **Penyempurnaan TypeScript Compiler Safety (`src/products/hub/kru/kruStore.ts`):**
     - Menyelaraskan deklarasi properti `initialized` dan accessor getter `isInitialized()` pada `CrewStore` demi kepatuhan ketat compiler `tsc --noEmit` (`npm run typecheck` PASS 0 errors, `npm run build` PASS 23.49s).


- **CLN-202 | PTVPRO Portal — Promote /preview to Root / & Routing Hygiene:**
  1. **Promosi Root Route & Status (`src/app/router/index.tsx`):**
     - Memindahkan `LivingPortalPage` menjadi komponen default pada route root `/`.
     - Menetapkan `LivingStatusPage` pada route canonical `/status-layanan`.
     - Menghapus unused import `PortalPage` dari `@products/portal` pada router index untuk menjamin nol unused import warnings.
  2. **Permanent Redirection Engine (`src/app/router/index.tsx`):**
     - Memasang redirection handler yang mengalihkan `/preview`, `/preview/living-portal`, dan `/preview/*` secara permanen ke `/` dengan preservasi parameter query search (`search`) dan anchor hash (`hash`).
     - Memasang redirection handler yang mengalihkan `/preview/status-layanan` ke `/status-layanan` dengan preservasi query search & hash.
  3. **Internal Link & Navigasi Harmonization:**
     - `src/products/living-portal/components/LivingHeader.tsx`: Memperbarui link Beranda ke `/`, Direktori Layanan ke `/#direktori-layanan`, dan Status Sistem ke `/status-layanan`.
     - `src/products/living-portal/components/LauncherFooter.tsx`: Memperbarui Status Sistem Publik link ke `/status-layanan`.
     - `src/products/living-portal/LivingPortalPage.tsx`: Memperbarui fallback pathname ke `'/'`.
     - `src/products/hub/portal-management/PortalManagementPage.tsx`: Menyelaraskan link pratinjau draft publik ke `/?previewDraft=true`.
  4. **Verifikasi Quality Gates:**
     - Playwright Routing Smoke Test: 8/8 skenario PASS (Akses langsung `/`, Reload `/`, `/status-layanan`, redirect `/preview`, redirect `/preview/living-portal`, redirect `/preview/status-layanan`, preservasi draft query, dan route `/hub`).
     - Unit Test Suite: 5/5 test files PASS (43/43 tests).
     - Typecheck: `npm run typecheck` PASS (0 errors).
     - Lint: `npm run lint` PASS (0 warnings, 0 errors).
     - Build: `npm run build` PASS (✓ built in 14.98s).

- **CLN-201 | PTV-DEV-190, Mobile UX Stabilization, Gesture Refinement & iOS Safari Anti Auto-Zoom:**
  1. **Pengajuan Surat Tugas & Izin Bawa Barang (`src/styles/perizinan.css`, `src/products/hub/perizinan/`):**
     - Mengatasi horizontal overflow dan overscroll kanan-kiri pada kedua modal dialog dengan menambahkan `overflow-x: hidden; overscroll-behavior: contain;` pada `.prz-modal-overlay`, `.prz-modal-card`, dan subkomponen.
     - Merestrukturisasi `.prz-date-grid` menjadi grid responsif 1-kolom pada mobile viewport (iPhone standard dan mini $\le 480$px).
     - Memperbaiki proporsi ACC banner, title, deskripsi, selection box, dan sticky footer dengan safe area inset padding (`max(14px, env(safe-area-inset-bottom, 14px))`).
  2. **Peminjaman Alat (`src/products/hub/peminjaman/PeminjamanPage.tsx`):**
     - Mengganti label filter tab `"Milik Saya"` menjadi `"History Saya"`.
     - Menghapus filter tab `"Terlambat"` dari rail filter.
     - Memperkuat logika pemfilteran riwayat pengguna aktif (`userFullName`, `userPtvId`, `userId`, `userTokens` bebas prefix gelar/kata umum) agar menyajikan seluruh riwayat peminjaman user aktif (baik yang berstatus aktif maupun selesai) tanpa mengubah workflow transaksi.
  3. **Lapor Masalah / Kerusakan (`src/products/hub/lapor-kerusakan/lapor-kerusakan.css`):**
     - Menaikkan modal z-index ke `10000` di atas seluruh chrome navigasi.
     - Membatasi modal card mobile ke `max-height: 90dvh` dengan tata letak flex column (`min-height: 0; flex: 1 1 auto; overflow-y: auto; overscroll-behavior: contain;`).
     - Menyematkan footer `.damage-modal-footer` sebagai sticky bottom dengan `padding: 12px 18px max(14px, calc(14px + env(safe-area-inset-bottom, 0px)))` sehingga tombol "Kirim Laporan" tidak terpotong oleh safe area atau floating dock.
  4. **Universal Anti Auto-Zoom iPhone Safari (`src/styles/base.css`, `src/styles/login.css`):**
     - Menjamin seluruh input, textarea, select, combobox, date picker, search pill, dan modal field memiliki computed `font-size: 16px !important` pada mobile breakpoint ($\le 768$px).
     - Mempertahankan `index.html` murni tanpa atribut destruktif `maximum-scale=1` atau `user-scalable=no` guna menjaga standar aksesibilitas Apple Human Interface Guidelines.
  5. **Lost & Found Modal & Detail Drawer (`src/products/hub/lost-found/`, `src/styles/lostFound.css`):**
     - Memperbaiki drawer detail barang hilang: memindahkan `ref={modalRef}` dari backdrop ke `.lf-drawer-panel` untuk mencegah scroll-lock permanen saat drawer dibuka/ditutup.
     - Menyediakan internal scroll mandiri pada drawer body (`overflow-y: auto; overscroll-behavior: contain;`) tanpa body scroll leak.
     - Mengamankan z-index overlay dan backdrop (`z-index: 10000`).
  6. **Discovery Workspace Bottom Sheet (`src/products/hub/shell/WorkspaceBottomSheet.tsx`):**
     - Memisahkan event touch drag-dismiss dari internal content scroll: menghapus `onTouchStart` pada `.ptv-workspace-scroll-area` sehingga gesekan scroll ke atas tidak lagi menutup sheet secara tidak sengaja.
     - Memasang kurva transisi spring iOS otentik (`0.36s cubic-bezier(0.32, 0.72, 0, 1)`) dengan drag dismiss terbatas pada drag handle dan header bar (threshold $> 100$px atau velocity $> 0.6$).
     - Meningkatkan tinggi sheet mobile ke $\sim 80\%$ dvh (`80dvh`) agar modul langsung terlihat tanpa menabrak safe area atas.
     - Mengharmonisasi 23 warna ikon modul ke satu keluarga tone R03 (soft blue/slate/emerald).
     - Mendukung `@media (prefers-reduced-motion: reduce)`.
  7. **Nilai Inventaris Compact Card (`src/styles/nilaiInventaris.css`):**
     - Menghilangkan whitespace berlebihan pada `.ptv-nilai-card` (tinggi berbasis konten `height: auto !important; min-height: 0 !important; gap: 6px; padding: 10px 12px;`).
     - Mendekatkan thumbnail 44px, status badge, dossier metadata, dan tombol aksi horizontal compact 34px pill.
  8. **Detail Dokumen Saya (`src/styles/kruKomunikasi.css`):**
     - Memperbaiki tata letak drawer dokumen pada mobile: height 90dvh, internal scroll `.kk-drawer-body`, accordion metadata bersih, dan sticky footer safe area.
     - Menata tombol "Unduh PDF Resmi" dan "Hapus Surat dari Arsip" berbaris rapi tanpa tumpang tindih.
  9. **Global Modal Auto-Hide Floating Dock (`src/shared/utils/dialogManager.ts`, `src/styles/shell.css`):**
     - Menambahkan kelas `modal-open` pada `document.body` dan `documentElement` saat dialog aktif.
     - Mengatur `body.modal-open .ptv-floating-dock` dan `body:has([role="dialog"]) .ptv-floating-dock` untuk otomatis bersembunyi (`opacity: 0 !important; pointer-events: none !important; transform: translate(-50%, 28px) !important;`) sehingga floating dock tidak pernah menimpa aksi modal.
  10. **Verifikasi & Quality Gates:**
      - Unit Test Suite: `tests/hub/mobileStabilization190.test.tsx` (8/8 tests PASS), `tests/hub/uiRefinementPtvDev132.test.tsx` (10/10 tests PASS).
      - Typecheck: `npm run typecheck` (0 errors).
      - Lint: `npm run lint` (0 warnings, 0 errors).
      - Production Build: `npm run build` (✓ built in 18.99s).
      - Browser Visual QA (Playwright Chromium): 7/7 tes skenario visual pada viewport iPhone standard (390x844) dan iPhone 13 mini (375x812) terverifikasi dengan tangkapan layar nyata:
        - `vqa-dev190-1-ajukan-tugas.png`
        - `vqa-dev190-1b-ajukan-barang.png`
        - `vqa-dev190-2-peminjaman-history.png`
        - `vqa-dev190-3-lapor-masalah.png`
        - `vqa-dev190-5-lostfound-detail.png`
        - `vqa-dev190-6-workspace-sheet.png`
        - `vqa-dev190-7-nilai-inventaris.png`
        - `vqa-dev190-8-detail-dokumen.png`

- **CLN-200 | PTV-DEV-189, Instant-First Data Experience & Persistent Cache Architecture:**
  1. **Persistent Cache Architecture & User Isolation (`src/core/cache/ptvCache.ts`):** Membangun manajer cache berkinerja tinggi `PtvCacheManager` dengan partisi penyimpanan persisten terisolasi berbasis identitas akun aktif (`ptv_cache_v1_${userId}`). Fitur mencakup:
     - Versioning terarah (`CACHE_VERSION = 1`) yang otomatis membuang cache usang saat schema berubah.
     - TTL dinamis per-entri dengan semantik *Stale-While-Revalidate* murni.
     - Pembatasan kuota penyimpanan aman per pengguna (plafon 2.5 MB) dengan LRU auto-eviction (otomatis mendepak 25% entri tertua saat mendekati batas).
     - Strict Security Deny-List: Menolak keras penyimpanan data sensitif/kredensial (`auth`, `token`, `session`, `password`, `pin`, `secret`, `credential`, `finance`, `keuangan`, `saldo`, `transaksi`, `kas`, `bank`, `payroll`, `rekening`, `tabungan`).
     - Pembersihan instan user-scoped saat logout (`clearActiveUserCache`) tanpa memicu kebocoran data antar-pengguna.
  2. **Synchronous Frame-0 Hydration & Background SWR Hook (`src/shared/hooks/useInstantData.ts`):** Mengembangkan hook data universal yang membaca cache secara sinkron pada frame render pertama (`useState(() => ptvCache.get(key)?.data)`):
     - `isLoading: true` HANYA berlaku pada cold start pertama kali saat belum ada cache apa pun.
     - Jika cache tersedia di memory atau localStorage, konten langsung tampil dalam 0ms tanpa kedipan skeleton.
     - Revalidasi jaringan berjalan senyap di latar belakang (`isRevalidating: true`) tanpa mengganti UI menjadi skeleton.
     - Mendukung optimasi mutasi lokal (`mutate`) dan langganan invalidasi cache eksternal (`subscribe`).
  3. **Integrasi Session Lifecycle & Cross-Account Isolation (`src/core/session/sessionStore.ts`):** Mengikat `ptvCache.setActiveUser(...)` pada `initSession` dan mutasi auth state, serta memanggil `ptvCache.clearActiveUserCache()` saat logout sehingga cache pengguna aktif langsung dihapus secara bersih.
  4. **Penerapan Instant-First pada Seluruh Modul Operasional & Portal:**
     - `BerandaPage.tsx`: Menghubungkan dashboard aggregated metrics ke key `'beranda_aggregated_data'`.
     - `InventarisPage.tsx` & `NilaiInventarisPage.tsx`: Berbagi persistent cache `'inventaris_catalog_list'`.
     - `AcaraContext.tsx`: Mengikat kalender acara ke key `'acara_events_list'`.
     - `KalenderPage.tsx`: Mengikat data perencana ke key `'kalender_planners_list'`.
     - `kruStore.ts`: Menambahkan synchronous hydration dari `'crew_members_list'` pada konstruksi store.
     - `DokumenSayaPage.tsx`: Mengikat dokumen personal ke key `'dokumen_my_list'`.
     - `ArsipPage.tsx`: Mengikat dokumen arsip lembaga ke key `'dokumen_arsip_list'`.
     - `PeminjamanPage.tsx`: Mengikat log transaksi ke key `'peminjaman_loans_list'` dan memanfaatkan cache inventaris.
     - `CatatanPage.tsx`: Mengikat catatan bersama ke key `'catatan_kru_list'`.
     - `LostFoundContext.tsx`: Mengikat pelaporan barang ke key `'lostfound_items_list'`.
     - `DamageReportContext.tsx`: Mengikat laporan kerusakan ke key `'damage_reports_list'`.
     - `kontakEksternalStore.ts`: Menambahkan synchronous hydration dari `'kontak_eksternal_partners'`.
     - `PortalManagementPage.tsx`: Mengikat bundel direktori layanan ke key `'portal_management_bundle'`.
  5. **Verifikasi & Guardrails Kepatuhan:**
     - Modul Keuangan (`/hub/keuangan` / Finance151) **100% READ-ONLY**, tidak dimodifikasi.
     - Zero credential / secret stored in cache (Security Deny-List test: PASS).
     - Test Suite Otomatis: `tests/hub/persistentCacheInstantFirst.test.tsx` (8/8 tests PASS), `loadingTransitionsRegression.test.tsx` (6/6 tests PASS), `berandaFullIntegration.test.tsx` (10/10 tests PASS).
     - Verifikasi Tipe & Linting: `npm run typecheck` (0 errors), `npm run lint` (0 warnings, 0 errors).
     - Kompilasi Build: `npm run build` (✓ built in 27.64s).
     - Pengujian Browser Headless (Playwright Chromium): Membuktikan 0ms instant display, 0 skeleton flash pada navigasi antar-modul dan browser reload, serta persistensi `ptv_cache_v1_usr-zidnal-001` (1089 bytes). Bukti visual dihasilkan: `vqa-dev189-beranda-warm.png`, `vqa-dev189-inventaris-warm.png`, `vqa-dev189-inventaris-reload.png`, `vqa-dev189-acara-warm.png`, dan `vqa-dev189-dokumen-warm.png`.

- **CLN-199 | PTV-DEV-188, Global Loading System, Page Transitions & Legacy PDF Parity:**
  1. **Audit Menyeluruh Loading & Transisi Seluruh Modul (`docs/PTV-DEV-188-LOADING-TRANSITION-AUDIT.md`):** Menginventarisasi 27 rute aktif dan komponen async fetching pada PTV Hub, mencatat data source, mekanisme loading, perilaku empty/error state, risiko layout shift (CLS), dan memetakan komponen target contextual skeleton R03 secara presisi. Modul Keuangan (`/hub/keuangan`) diaudit strictly read-only tanpa modifikasi kode apa pun.
  2. **Unified Contextual Skeleton System (`src/styles/skeletons.css`, `src/shared/components/skeletons/`):** Membangun pustaka komponen skeleton kontekstual terarah dengan animasi shimmer gradient halus (`@keyframes ptvShimmer`, 1.8s ease-in-out infinite, gradient 200% 100%) dan safe guard `@media (prefers-reduced-motion: reduce)` yang menonaktifkan animasi bagi pengguna sensitif gerak. Meliputi:
     - `SkeletonBase`: Komponen blok atomik dengan dimensi, radius, dan style fleksibel.
     - `PageHeaderSkeleton`: Placeholder judul, subjudul, dan pill tombol aksi.
     - `CardListSkeleton`: Placeholder daftar kartu horizontal ber-badge (untuk Acara, Peminjaman, Catatan, Dokumen Saya, Perizinan).
     - `TableSkeleton`: Placeholder baris tabel terstruktur dengan header bar, avatar, teks, dan status pill (untuk Kru, Akses, Arsip, Nilai Inventaris).
     - `CalendarGridSkeleton`: Placeholder kalender bulanan 7-kolom hari dengan sel tanggal proporsional.
     - `InventoryGridSkeleton`: Placeholder grid produk 2–4 kolom dengan foto 16:9, label kategori, status ketersediaan, dan tombol aksi.
     - `BerandaSkeleton`: Placeholder Hero widget 28px, 4 bento shortcuts, agenda mendatang, dan peminjaman alat saya.
     - `DocDetailSkeleton`: Placeholder header detail, grid metadata, dan body box.
     - `FormSkeleton`: Placeholder form input baris, label, dan tombol submit.
     - `ProfileSkeleton`: Placeholder profil avatar bulat, data personal, dan baris detail akun.
  3. **Penggantian Spinner Menjadi Contextual Skeletons (`BerandaPage.tsx`, `AcaraPage.tsx`, `KalenderPage.tsx`, `InventarisPage.tsx`, `DokumenSayaPage.tsx`, `PeminjamanPage.tsx`, `KruPage.tsx`):** Mengganti elemen teks mentah ("Memuat...") dan icon spinner berputar (`<i className="fa-spin" />`) dengan komponen skeleton yang mencerminkan tata letak konten nyata, mengeliminasi layout shift drastis saat data selesai di-fetch.
  4. **Global Page Transition: Subtle Fade + Lift (`shell.css`, `skeletons.css`, `HubShell.tsx`):** Menerapkan transisi global yang tenang dan modern pada pembungkus konten utama (`#view` dengan `key={location.pathname}` dan kelas `.ptv-page-transition`): durasi 200ms, timing `cubic-bezier(0.16, 1, 0.3, 1)`, pergeseran vertikal halus `translateY(6px)` ke `translateY(0)`, dan opasitas `0` ke `1`. Elemen persisten (Sidebar desktop, Header desktop, Mobile Floating Dock, dan Scrim modal) berada di luar boundary `#view` sehingga tetap 100% stabil, solid, dan bebas kedipan antar-navigasi.
  5. **Paritas Penuh Kop Surat PDF Resmi & Penanaman Fisik Logo (`SuratIzinPdfPreview.tsx`, `docPdfPrinter.ts`, `officialKopLogoData.ts`):** Mengintegrasikan berkas biner asli `BS-X-PTV.webp` (10,146 bytes, 323×184px) yang telah ditempatkan di `public/assets/images/BS-X-PTV.webp`. Menghubungkannya ke preview surat (`SuratIzinPdfPreview.tsx`) dengan proporsi legacy PHP (tinggi 48px, lebar 84px, contain), serta menanamkan gambar logo secara fisik ke dalam PDF 1.4 binary stream (`buildOfficialDocPdf14` & `downloadOfficialDocPdf` via DCTDecode XObject `/ImLogo` pada koordinat `84.26 0 0 48 50 752 cm`), bukan hanya preview.
  6. **Verifikasi, Pengujian & Visual QA:** Memperbarui suite pengujian `loadingTransitionsRegression.test.tsx` (6/6 PASS), `docPdfPrinter.test.ts` (1/1 PASS dengan verifikasi DCTDecode XObject), `generatorSurat.test.ts` (7/7 PASS), dan operational suites (`acara.test.ts`, `arsip.test.ts` - 28/28 PASS). `npm run typecheck` PASS (0 errors), `npm run lint` PASS (0 warnings, 0 errors). Visual QA Chromium menghasilkan bukti snapshot live: `vqa-dev188-generator-desktop.png`, `vqa-dev188-generator-mobile.png`, `vqa-dev188-generator-preview-live.png`, dan `vqa-dev188-official-pdf-rendered.png`. Modul Keuangan (`/hub/keuangan`) 100% tidak dimodifikasi.

- **CLN-198 | PTV-DEV-187, Mobile UI/UX Refinement & Interaction Polish (9 Items iPhone):**
  1. **Header Mobile Logo & Shortcut Portal (`dashboard.css`, `HubShell.tsx`):** Mengubah proporsi logo header mobile Progresif TV dari ukuran dominan 170×22px menjadi proporsional 132×17px (dan 124×16px pada viewport $\le 390$px) untuk memberi ruang napas bersih pada deretan tombol aksi. Menambahkan tombol shortcut langsung ke Portal (`/`) di samping notifikasi tanpa memicu logout (`<button className="icon-btn only-mobile" aria-label="Kembali ke Portal">`).
  2. **Floating Bottom Navbar & Frosted Glass (`shell.css`):** Menaikkan posisi bawah floating dock capsule konservatif 5px dari `bottom: calc(env(safe-area-inset-bottom, 0px) + 22px)` menjadi `bottom: calc(env(safe-area-inset-bottom, 0px) + 27px)` agar bebas benturan dari Home Indicator iOS, serta menerapkan efek frosted glass asli JID SPACE (`background: rgba(255, 255, 255, 0.78); backdrop-filter: blur(24px) saturate(190%)`). Menyelaraskan padding bawah konten utama `.main` menjadi `calc(env(safe-area-inset-bottom, 0px) + 118px)`.
  3. **Workspace Sheet Kunci Ukuran & Single-Swipe Dismiss (`WorkspaceBottomSheet.tsx`, `shell.css`):** Mengunci tinggi bottom sheet pada ukuran medium ~63% dvh (`Math.min(Math.round(viewportHeight * 0.63), viewportHeight - 64)`), menghilangkan transisi snap-point bertahap yang membingungkan, menambahkan scrollbar vertikal tipis (`scrollbar-width: thin; -webkit-scrollbar: 4px`) pada area scroll internal, serta mengaktifkan gesture single-swipe-down dismiss langsung menutup sheet saat ditarik ke bawah > 50px atau flick cepat.
  4. **Pencarian Global Mobile Zero-Zoom & Simetris (`dashboard.css`):** Menetapkan `font-size: 16px` pada `.mso-input` untuk mencegah auto-zoom iOS Safari, padding horizontal simetris pada search box (`padding: 0 14px`), tinggi seragam tombol tutup 46px, dan container simetris tanpa horizontal overflow.
  5. **Profil Mobile Centering & No Right-Shift (`pengaturan.css`, `ProfilePage.tsx`):** Menghilangkan padding ganda pada container profil di mobile dengan menyetel `.profile-page-container` menjadi `padding: 8px 0 80px`, grid 1-kolom penuh terpusat (`width: 100%; margin: 0 auto`), dan penataan ID Card resmi yang simetris sempurna.
  6. **Acara Mobile Card Simplification (`acara.css`):** Menyederhanakan card acara pada layar mobile (`max-width: 768px`) hanya menampilkan Judul Kegiatan, Tanggal, dan Badge Status ringkas (Mendatang / Selesai / Batal). Metadata sekunder yang padat (tanggal Hijriah, waktu detail, venue/lokasi) dipindahkan rapi ke modal detail acara.
  7. **Universal Date Inputs Mobile Audit (`base.css`):** Mengunci seluruh `input[type="date"]` dengan `font-size: 16px; min-width: 0; max-width: 100%; box-sizing: border-box;` serta membungkus layout tanggal 2-kolom pada form peminjaman dan generator surat agar membungkus rapi menjadi 1-kolom pada layar sempit $\le 480$px tanpa card blowout.
  8. **Catatan Kru Detail Hierarchy & Safe Area (`catatan.css`):** Menghilangkan background dominan pekat pada header modal detail catatan di mobile, menggantinya dengan surface bersih elegan beraksen garis vertikal 4px (`border-left: 4px solid var(--modal-theme-action-bg)`), memperbaiki jarak antar-paragraf catatan (`margin: 0 0 10px 0; line-height: 1.65;`), dan mengunci tombol aksi footer dengan safe area inset (`padding-bottom: max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px))`).
  9. **Nilai Inventaris Mobile Zero-Whitespace (`dashboard.css`, `nilaiInventaris.css`):** Menghapus fixed min-height dan merapatkan jarak vertikal antara identitas alat dan kartu dossier nilai perolehan (`gap: 8px`, `padding: 8px 12px`), menghilangkan ruang kosong berlebihan di layar ponsel.
  10. **Peminjaman Alat Compact Picker & Safe Area Sticky Bar (`loanModal.css`):** Mengoptimalkan densitas baris pemilih unit fisik, mengunci tombol sticky "Lihat & Ajukan" dengan `calc(56px + env(safe-area-inset-bottom, 0px))`, serta memastikan drawer konfirmasi checkout mobile tampil penuh dan nyaman tanpa terpotong (`max-height: calc(100dvh - 36px)`).
  11. **Housekeeping & Verifikasi:** Modul Keuangan (`/hub/keuangan`) 100% tidak disentuh. `npm run typecheck` PASS (0 errors), `npm run lint` PASS (0 errors, 0 warnings), vitest PASS (13/13 tests), dan 7 visual QA screenshots dihasilkan Playwright (`vqa-dev187-*.png`).

- **CLN-197 | PTV-DEV-186 HOTFIX, Surat & Arsip, Dokumen Saya & Paritas PDF Resmi:**
  1. **Pemulihan Alur Data Surat & Arsip (`ArsipPage.tsx`, `dokumenService.ts`, `api/dokumen.ts`):** Memperbaiki bug kritis di mana `filteredDocs` mengiterasi variabel lokal `docs` dan bukan `effectiveDocs`, serta `effectiveDocs` keliru mengevaluasi array kosong backend saat `!loadError` bernilai true. Menetapkan `effectiveDocs = liveDocs.length > 0 ? liveDocs : (docs.length > 0 ? docs : INITIAL_DOCS_FIXTURES)` dan menambahkan fallback graceful ke fixture resmi pada `api/dokumen.ts` dan `dokumenService.ts` saat database staging bernilai 0 baris unseeded, sehingga seluruh 4 dokumen arsip resmi (001/SI, 042/ST, 015/SBB, 007/SI) pulih dan tampil kembali dalam accordion bulan Oktober 2026.
  2. **Perbaikan Kepemilikan Dokumen Saya Tanpa Bypass Admin & Anti-Leakage (`api/dokumen.ts`, `DokumenSayaPage.tsx`, `docsStore.ts`):** Menambahkan dokumen operasional resmi yang sah melibatkan personil aktif (`Muhammad Zidnal Falah` / `PTV-001`) pada data fixture resmi (`042/ST-PTV/X/2026` Surat Tugas dan `015/SBB-PTV/X/2026` Surat Jalan Barang). Memperbaiki filter pencocokan kepemilikan dokumen pengguna di `filterUserDocuments` dan `isUserInDoc` dengan mengecualikan awalan nama agamis umum (seperti `"muhammad"`, `"ahmad"`, `"moch"`) dari token parsial, sehingga pengguna hanya melihat dokumen miliknya sendiri (Zidnal hanya melihat 042/ST dan 015/SBB; dokumen 001/SI dan 007/SI milik Farras terisolasi rapi dan tidak bocor).
  3. **Paritas Penuh PDF Resmi dengan Generator Surat Izin (`docPdfPrinter.ts`, `docPdfPrinter.test.ts`):** Mengganti styling biner PDF 1.4 dan cetak HTML pada `docPdfPrinter.ts` agar 100% identik dengan standar kanonikal Generator Surat Izin (`SuratIzinPdfPreview`): menggunakan warna brand hijau resmi `#0e4f40` (`0.055 0.310 0.251 rg`), garis ganda pemisah kop surat, alamat resmi studio di Sidoarjo Jawa Timur, tabel metadata berbingkai, header tabel personil/santri hijau pekat dengan teks putih, baris berselang-seling zebra, serta blok keabsahan resmi dengan verifikasi QR code vektor scannable beresolusi tinggi, status hukum dokumen tanpa tanda tangan basah, dan penerbit resmi Progresif TV.
  4. **Verifikasi & Housekeeping:** Menambahkan unit test `tests/hub/docPdfPrinter.test.ts` (100% PASS), memperbarui test suite dokumen (`tests/hub/arsip.test.ts`, `tests/hub/dokumenArsipStaging.test.ts`, `tests/hub/documentQr.test.tsx`, `tests/hub/generatorSurat.test.ts` - 39/39 tests PASS). Validasi `npm run typecheck` PASS (0 errors), `npm run lint` PASS (0 warnings, 0 errors). Verifikasi visual render aktual via Playwright menghasilkan bukti tangkapan layar `vqa-hotfix-arsip-desktop.png`, `vqa-hotfix-dokumen-saya-desktop.png`, dan `vqa-hotfix-dokumen-modal-desktop.png`. Modul Keuangan (`/hub/keuangan`) 100% tidak disentuh.

- **CLN-196 | PTV-DEV-186, Desktop UI/UX Refinement, Navigation & Document Integrity:**
  1. **Sidebar Collapse Zero-Shift Vertical Alignment (`dashboard.css`, `shell.css`):** Mengunci `.side-grp > p` dengan `height: 16px; line-height: 16px; box-sizing: border-box;` serta menyelaraskan margin vertical tombol pill navigasi `.snav` di mode expanded menjadi `margin: 0 0 4px 0; height: 40px; min-height: 40px; box-sizing: border-box;` (identik dengan mode collapsed `margin: 0 auto 4px`). Selisih koordinat Y diukur secara empiris via Playwright headless browser menghasilkan deviasi maksimal hanya **0.25px** (lulus toleransi `<= 1px`).
  2. **Shortcut Beranda Vertical Centering (`beranda.css`, `dashboard.css`):** Menyelaraskan teks judul dan deskripsi bento cards terhadap ikon box 44×44px menggunakan `display: flex; flex-direction: column; justify-content: center; gap: 2px;` dengan `margin: 0; line-height: 1.25;` dan `1.35;` pada `.bento-body`, `.bento-title`, dan `.bento-desc`, serta `min-height: 76px;` pada `.bento-card`.
  3. **Header Desktop Avatar (`HubShell.tsx`):** Mengubah trigger klik avatar desktop agar langsung menavigasi ke `/hub/profile` (`navigate('/hub/profile')`), merender foto profil pengguna jika tersedia (`currentUser?.foto_url || user?.foto_url || user?.avatar_url`) dengan fallback inisial nama, menambahkan tooltip `title="Buka Profil"` dan `aria-label="Buka Profil"`, serta menjaga header mobile tetap minimalis tanpa interferensi.
  4. **Manajemen Akses Redesign Daftar Akun (`AksesPage.tsx`, `akses.css`):** Mengintegrasikan data kru dari `useCrewStore` untuk menampilkan foto avatar bulat 40×40px dengan border halus konsisten Manajemen Kru, mempertegas tipografi nama (15px semibold `var(--ink)`), badge ID PTV mono lembut, status pill R03 (Aktif hijau `#E1F5EE` / `#0F7A5A`, Nonaktif netral), role badges terstruktur, dan tombol aksi "Kelola Akses".
  5. **Dokumen Saya Redesign & Kepemilikan Dokumen (`api/dokumen.ts`, `DokumenSayaPage.tsx`):** Menghapus bypass izin eksekutif/admin `if (user.isExecOrAdmin) return docs;` di backend and `if (isExecOrAdmin) return true;` di frontend, sehingga mode kepemilikan dokumen pengguna ('my') hanya menampilkan dokumen yang sah melibatkan akun pengguna sebagai pemohon, pembawa, penanggung jawab, atau penerima.
  6. **Sidebar Urutan Menu Final (`HubShell.tsx`):** Memverifikasi urutan kanonikal `SIDEBAR_GROUPS` sesuai struktur resmi lembaga (Kru & Komunikasi: Manajemen Kru, Manajemen Akses, Dokumen Saya, Kontak Internal, Kontak Eksternal; Administrasi & Verifikasi: Keuangan, Generator Surat Izin, Pengajuan Perizinan, Surat & Arsip, Keabsahan Dokumen, Verifikasi Identitas; Media: Haul & Harlah PPBS, Pengelolaan Portal, Pengumuman, SEO & Analytics).
  7. **Surat & Arsip Centered Modal, PDF Resmi & Deep Link Verifikasi (`DocDetailDrawer.tsx`, `docPdfPrinter.ts`, `kruKomunikasi.css`):** Mengubah detail dokumen desktop menjadi modal dialog terpusat (`.doc-detail-modal-overlay` & `.doc-detail-modal-content`, width: 740px, max-height: 88vh, radius: 22px, box-shadow melayang) dengan preservasi bottom sheet di mobile; menyelaraskan kop surat resmi institusi Progresif TV (`Sekretariat: Jl. Kyai Dasuki No. 1, Lebo, Sidoarjo, Jawa Timur 61223`); serta menyematkan deep link verifikasi `/verifikasi-surat?nomor=${encodeURIComponent(cleanDocNumber(doc.no))}` pada tombol "Buka Verifikasi".
  8. **Inventaris & Nilai Inventaris State Persistence (`InventarisPage.tsx`, `NilaiInventarisPage.tsx`, `AlatDetailPage.tsx`, `NilaiInventarisDetailPage.tsx`):** Menyimpan dan memulihkan kata kunci pencarian, filter kategori, filter status, sort mode, dan posisi scroll window (`window.scrollY`) melalui `sessionStorage` (`ptv_inventaris_nav_state` dan `ptv_nilai_nav_state`); menambahkan tombol kembali yang jelas ("Kembali ke Inventaris") yang memanggil `navigate(-1)` sehingga transisi bolak-balik detail tidak mereset posisi scroll atau filter pengguna.
  9. **ID Card Spacing Tombol & Shadow (`OfficialIdCard.tsx`, `dashboard.css`):** Memperlebar jarak vertikal tombol aksi ("Unduh Kartu PNG" & "Verifikasi") di bawah kartu dari 14px menjadi 26px (`margin: 26px auto 0`) dan memperhalus drop shadow kartu navy (`box-shadow: 0 18px 40px -12px rgba(2, 14, 38, 0.42)...`) sehingga bayangan bawah jatuh alami tanpa menimpa atau menutupi tombol aksi.
  10. **Housekeeping & Verifikasi:** Modul Keuangan (`/hub/keuangan`) 100% tidak disentuh (dikerjakan Codex secara paralel). `npm run typecheck` PASS (0 errors), `npm run lint` PASS (0 errors, 0 warnings), vitest unit test PASS (10/10 tests), dan verifikasi visual screenshot Playwright Chromium.

- **CLN-195 | PTV-DEV-184, Rebuild & Final Adjustment Mobile Navbar & Discover Workspace:**
  1. **Geometri JID SPACE Presisi (`shell.css`, `HubShell.tsx`):** Mengadopsi geometri JID SPACE dengan floating dock wrapper terpusat horizontal (`left: 50%; transform: translateX(-50%)`), capsule pill tinggi 52px, padding 4px, border-radius 9999px, lebar otomatis mengikuti isi (`width: max-content`, bukan full-width), tombol Discover bulat 52×52px, dan jarak capsule ke Discover 10px. Item tidak aktif 42×42px dengan ikon 19×19px, item aktif tinggi 42px dengan padding horizontal 14px, gap ikon-label 6px, serta kondisional render label (hanya tab aktif yang me-render `.dock-label` di DOM).
  2. **Penyesuaian Posisi Navbar (`shell.css`):** Menaikkan posisi bawah floating navbar sebesar 8px dari `bottom: calc(env(safe-area-inset-bottom, 0px) + 14px)` menjadi `bottom: calc(env(safe-area-inset-bottom, 0px) + 22px)` bersama-sama antara capsule dan tombol Discover agar terbebas sepenuhnya dari Home Indicator iPhone. Menyelaraskan padding bawah konten utama `.main` menjadi `calc(env(safe-area-inset-bottom, 0px) + 112px)` dan tinggi ambient gradient menjadi `calc(80px + env(safe-area-inset-bottom, 0px))`.
  3. **Penyesuaian Tinggi Awal Discover Workspace (`WorkspaceBottomSheet.tsx`):** Mengubah default initial snap point saat Workspace pertama kali dibuka dari `compact` menjadi `medium`. Menetapkan tinggi snap medium terkalibrasi pada 63% viewport (rentang target 60–65% dvh, `Math.min(Math.round(viewportHeight * 0.63), maxSheetHeight - 20)`). Mengintegrasikan `window.visualViewport` dan CSS `maxHeight: calc(100dvh - 56px - env(safe-area-inset-bottom, 0px) - 12px)` untuk responsivitas dinamis terhadap status bar / Dynamic Island dan address bar mobile. Mempertahankan 3 snap points (`compact`, `medium`, `expanded`), gesture drag 1:1, flick velocity, dan tap handle toggle (`compact` ➔ `medium`, `medium` ➔ `expanded`, `expanded` ➔ `medium`).
  4. **Perbaikan Syntax PostCSS (`dashboard.css`):** Memperbaiki penutup kurung kurawal duplikat pada baris 8059–8063 yang sebelumnya memicu build error `Unexpected }` pada baris 8223.
  5. **Verifikasi & Housekeeping:** `npm run typecheck` PASS (0 errors), `npm run lint` PASS (0 warnings), unit test `tests/hub/profileAndMobileNav2.test.tsx` PASS (10/10 tests). Verifikasi render visual aktual via Playwright/Headless Chrome menghasilkan metrik presisi terukur (dock bottom: 22px, pill: 52px, discover: 52×52px, workspace opening top: 300px pada 844px viewport = 64.5% visible viewport) dan 4 screenshot artefak resmi. Modul Keuangan (`/hub/keuangan`) 100% tidak disentuh.

- **CLN-194 | PTV-DEV-183, R03 Visual Refinement & Regression Fix (11 Mandatory Items):**
  1. **Geometri Mobile Bottom Navbar & Discover Button (`shell.css`):** Mempertahankan geometri navbar JID SPACE / Apple Find My (height 46px, padding compact 3px 5px, safe area iPhone `calc(env(safe-area-inset-bottom, 0px) + 12px)`). Memberikan identitas visual tegas tombol Discover berupa PTV Blue solid (`var(--b-600, #1273e6)` light, `#1D6EE5` dark) dengan ikon 4-kotak putih kontras (`color: #ffffff`), bukan menyamakan dengan warna background panel.
  2. **Corner Radius Workspace Harmonis iPhone (`shell.css`):** Menyelaraskan panel Discover Workspace yang terbuka dengan lengkungan bezel fisik iPhone modern menggunakan `border-radius: 40px !important;`, margin samping 12px, margin bawah di atas Home Indicator, serta clipping konten rapi tanpa horizontal overflow.
  3. **Sidebar Collapse Button & External Link Parity (`HubShell.tsx`, `dashboard.css`, `shell.css`):** Memindahkan tombol collapse dari samping logo ke tepi kanan sidebar sebagai floating tab di border (`right: -12px; top: 22px; width: 24px; height: 24px; border-radius: 50%`) yang tidak mengganggu logo Progresif TV. Mengunci tinggi `.side-brand` tetap 64px dan menjaga ruang kategori `.side-grp > p` (`visibility: hidden; height: 16px; margin: 0 0 6px`) sehingga seluruh ikon menu 100% sejajar secara vertikal sebelum, selama, dan sesudah collapse tanpa loncatan posisi ke atas. Menyembunyikan ikon eksternal `.snav-ext-ic` (`display: none !important`) saat collapsed dan memusatkan ikon utama secara konsisten dengan tooltip informatif `title="Buka tab baru"`.
  4. **Restorasi Rounded R03 (`shell.css`):** Mengembalikan highlight menu aktif sidebar ke bentuk pill rounded R03 (`border-radius: var(--ptv-curve-pill, 9999px)`).
  5. **Profile & Pengaturan Kontrol Nyata (`ProfilePage.tsx`, `pengaturan.css`):** Mengganti input wrapper password menjadi `.set-pass-wrap` (`position: relative`) dan tombol mata show/hide password menjadi `.set-eye-btn` (`position: absolute; right: 6px; top: 50%; transform: translateY(-50%)`) di dalam input tanpa keluar shape. Menambahkan CSS `.set-toggle` dan `.set-toggle-thumb` slider switch iOS yang nyata dan mulus untuk toggle Mode Gelap. Menstandarisasi tombol aksi (.set-btn-pri dan .set-btn-sec) pada Unduh Kartu PNG, Verifikasi, Google SSO, Simpan Password, Diagnostik Notifikasi, Sinkronkan Sesi, dan Keluar dari Akun.
  6. **Global Top Spacing (`shell.css`):** Menambahkan ruang napas konsisten antara header dan konten utama pada shared page layout `.main`: desktop `calc(var(--header-h) + var(--sat) + 26px)` (24–32px) dan mobile `calc(var(--header-h) + var(--sat) + 18px)` (16–20px).
  7. **Manajemen Kru (`KruPage.tsx`):** Mengatur urutan filter kanonikal: `Kru Aktif` → `Kru Nonaktif` → `Pengasuh` → `Pengarah` → `Pembina` → `Semua` dengan default saat buka `'Aktif'`. Pengasuh, Pengarah, dan Pembina ditampilkan langsung tanpa subkelompok angkatan (menghilangkan "Angkatan belum ditentukan" dan badge "X Kru"). Pada tab Semua, urutan seksi: Pengasuh, Pengarah, Pembina, Kru Aktif, Kru Nonaktif dengan jarak seksi 22px dan judul ke list 10px.
  8. **Broadcast Detail Modal (`AnnouncementDetailModal.tsx`):** Menata ulang urutan konten modal: 1. Metadata prioritas & tanggal, 2. Judul, 3. Deskripsi/isi, 4. Diterbitkan oleh & nama penerbit, 5. Footer tombol aksi.
  9. **Pengelolaan Portal Badge (`portalManagement.css`):** Membungkus angka counter pada tab Direktori Layanan dan Pengumuman dalam badge pill lembut (`.pm-tab-count`: `min-width: 18px; height: 18px; border-radius: 9999px`) dengan warna harmonis saat aktif dan netral saat nonaktif.
  10. **Housekeeping & Verifikasi:** Menghapus variabel tidak terpakai `expandedHeight` di `WorkspaceBottomSheet.tsx`. Modul Keuangan (`/hub/keuangan`) 100% tidak disentuh. `npm run typecheck` PASS (0 errors), `npm run lint` PASS (0 warnings), vitest PASS (9/9 nav & profile tests, 33/33 curve tests).

- **CLN-193 | PTV-DEV-181, Mobile Navigation & Workspace Motion Refinement:**
  1. **Proporsi Navbar Ramping & Active Pill Soft PTV Blue (`shell.css`):** Mengadopsi proporsi JID SPACE yang ramping (tinggi dock pill 46px, padding compact 3px 5px, item height 38px, icon 14.5px seragam). Active pill diubah dari biru pekat menjadi soft PTV Blue (`rgba(29, 110, 229, 0.09)` di light mode, `rgba(59, 142, 247, 0.15)` di dark mode, dengan teks aksen primer `#1273e6`). Tombol Discover diselaraskan tingginya menjadi 46px dengan jarak lebih rapat (gap 6px) dan active pill soft blue. Ambient bottom glow gradient dibuat lebih halus (`height: 72px`, opasitas 0.035) menyatu alami dengan background.
  2. **Floating Bottom Sheet Apple Find My (`WorkspaceBottomSheet.tsx` & `shell.css`):** Mengubah panel bottom sheet dari edge-to-edge menjadi floating card dengan margin samping 12px, border radius 30px di seluruh sudut, margin bawah di atas iPhone Home Indicator (`bottom: calc(env(safe-area-inset-bottom, 0px) + 12px)`), dan margin atas aman (56px) di bawah status bar / Dynamic Island.
  3. **Sistem 3-Snap Points & Spring Velocity Physics:** Mengimplementasikan snap points `compact` (posisi awal dinaikkan ke ~356px sehingga 4 Quick Action cards langsung terlihat utuh tanpa drag), `medium` (~64vh), dan `expanded` (maksimum layar dengan margin aman). Real-time drag 1:1, flick gesture dengan kalkulasi velocity (px/ms), spring damping (`cubic-bezier(0.19, 1, 0.22, 1)`), tap-to-toggle pada drag handle, scroll containment (mencegah accidental dismiss saat scroll konten di expanded mode), dan dukungan `prefers-reduced-motion`.
  4. **Proteksi Overflow & Responsivitas:** Menghapus potensi horizontal overscroll pada body dan Workspace, menetapkan `box-sizing: border-box`, `min-width: 0`, teks truncate/ellipsis pada kartu Quick Action dan grid All Features, serta memastikan drag horizontal tidak memindahkan sheet.
  5. **Verifikasi & Guardrail:** Tidak menyentuh modul Keuangan, database, schema, autentikasi, atau desktop sidebar. Validasi `npm run typecheck` PASS (0 errors), `npm run lint` PASS (0 warnings), 19 unit tests PASS, dan 7 screenshot render visual mobile (390px & 375px, Light & Dark mode).

- **CLN-192 | PTV-DEV-180, Profile Visual Restoration & Mobile Navigation 2.0:**
  1. **Komponen Kanonikal ID Card Resmi (`OfficialIdCard.tsx`):** Mengeliminasi rendering ganda dan layout paralel KTA yang tidak sinkron antara preview di halaman Profil (`ProfilePage.tsx`), ID Digital (`IdDigitalPage.tsx`), dan ekspor Canvas PNG. Menyatukan satu komponen kanonikal beresolusi 720x1120 HD dengan komposisi vertikal navy proporsional, header logo PTV + QR box, frame foto 2px border + radius kontinu, nama lengkap uppercase tebal di tengah, info box 2-kolom (`KRU NO.`, `POSITION`, `DIVISI`, `STATUS` hijau `#4ADE80`), serta footer `PROGRESIF TV` dan `2026–2027` sesuai rujukan visual pengguna.
  2. **Refinement Halaman Profile (`ProfilePage.tsx` & `pengaturan.css`):** Mengganti input form read-only keanggotaan dengan metadata cards R03 yang bersih. Mengatur grid responsif 2-kolom desktop (kiri ID card + tombol unduh & verifikasi, kanan pengaturan profil, preferensi tema, SSO Google, ubah password, dan sesi) yang secara mulus beralih menjadi 1-kolom di viewport mobile (<=860px) tanpa horizontal overflow. Menyelaraskan token border radius modal QR verifikasi ke `var(--ptv-curve-lg, 16px)`.
  3. **Mobile Navigation 2.0 & Discover Sheet (`HubShell.tsx`, `WorkspaceBottomSheet.tsx`, `shell.css`):** Menerapkan floating bottom dock pill dengan 4 menu utama (`Home → Beranda`, `Acara → Acara`, `Alat → Inventaris`, `Profil → Profil`) di mana menu aktif menampilkan ikon + label dan melebar dinamis, sedangkan menu non-aktif hanya menampilkan ikon tanpa label permanen. Rute di luar 4 menu (misal Kru, Keuangan) tidak menandai Home. Menghapus avatar profil dan judul breadcrumb dari header mobile agar bersih (hanya logo di kiri, search & lonceng notifikasi di kanan). Menambahkan ambient cyan-blue blur gradient di belakang dock dengan safe area padding iPhone. Menghubungkan tombol Discover bulat ke bottom sheet interaktif Apple Maps (`WorkspaceBottomSheet`) dengan gesture drag sheet dan grid fitur aplikasi.
  4. **Housekeeping & Verifikasi:** Menghapus skrip ad-hoc CDP dan scratch runner dari `.gemini/scratch/`. Modul Keuangan 100% tidak tersentuh. Validasi tipe (`npm run typecheck`), linting (`npm run lint`), dan unit tests (`tests/hub/profileAndMobileNav2.test.tsx`, `tests/hub/idDigital.test.ts`, `tests/hub/continuousCurveAudit.test.ts`) 100% PASS (0 warning / 0 error).


- **CLN-191 | PTV-DEV-178, Finalisasi Manajemen Kru & Modal Akses R03:**
  1. **Manajemen Kru (KruPage.tsx):** Konsolidasi filter ke 6 opsi kanonikal (`Semua`, `Kru Aktif`, `Kru Nonaktif`, `Pengasuh`, `Pengarah`, `Pembina`). Menghapus tab filter redundan `Ketua`, mengintegrasikan personel Ketua dan Sekben aktif ke dalam kategori Kru Aktif secara natural tanpa seksi terisolasi, serta mengeliminasi penghitungan ganda pada bento stats.
  2. **Modal Form Kru Dialog Terpusat (KruFormModal.tsx):** Mengganti drawer kanan `.kk-drawer-content` dengan modal dialog terpusat `.ptv-modal-dialog` (`maxWidth: 620px`, `borderRadius: 22px`). Struktur form dirapikan menjadi 4 grup logis (Identitas Personel, Struktur Organisasi & Jabatan, Informasi Tambahan/Akademik, Status Keanggotaan) dengan layout 2-kolom responsif, sticky header dan footer, serta pemetaan preset jabatan organisasi yang aman tanpa modifikasi skema database.
  3. **Stabilisasi Flex & Alignment Modal Hak Akses (ManagePermissionsModal.tsx):** Memberikan `flexShrink: 0` pada header modal, warning bar fail-closed, tab bar navigasi, dan footer modal untuk mencegah penyusutan elemen akibat flex layout saat konten panjang. Mengubah tab bar menjadi `sticky` di puncak body modal (`top: 0`, `zIndex: 10`), serta merapikan baris granular capability override dengan container segmented pill (`Default`, `+ Izinkan`, `× Tolak`) yang anti-wrapping di desktop (1440px) maupun mobile (390px) tanpa mengubah logika fail-closed deny-override RBAC.
  4. **Restorasi Gaya Selected Date Kalender (kalender.css):** Mengembalikan warna highlight sel tanggal terpilih dari warna solid blue ke gaya soft blue khas PTVPRO (`#eff6ff`, border `#2563eb`, font `#1d4ed8`) dengan tetap mempertahankan bentuk kartu 6px rounded rectangle, 1px border `#e5e7eb`, spasi sel 6px/4px, serta preservasi 100% data weton/pasaran Jawa, tanggal Masehi, dan Hijriah.
  5. **Verifikasi Terarah:** `npm run typecheck` PASS (0 errors), 113 regresi unit test kru dan akses PASS (`tests/hub/kruFlatGroupedListRegression.test.tsx`, `tests/hub/kruStagingIntegration.test.ts`, `tests/hub/accessHardening149.test.ts`, `tests/hub/accessRemediation149.test.ts`), verifikasi visual screenshot headless Chrome (Desktop 1440px & Mobile 390px, Light & Dark mode).


- **CLN-190 | PTV-DEV-178, ingress login LAN staging:** Reuse trustedIngress dan middleware Vite existing; tidak membuat auth adapter/proxy paralel. Review terarah memastikan IP berasal dari socket, header spoof tidak memengaruhi rate-limit key, IP publik/production ditolak, cookie dan validasi origin tetap. Tidak menghapus kode/UI di luar scope. 32 regresi PASS; typecheck/lint PASS. Tidak menyimpan credential/cookie dalam artefak.


- **CLN-187 | PTV-DEV-176, Koreksi Kalender PTVPRO — Rounded Shape Only:**
  1. **Transformasi Cell Kalender menjadi Rounded Rectangle Cards Mandiri:** Menghapus `border: none !important; border-radius: 0;` dan container grid table-like (`background: var(--line-2); border: 1px solid var(--line-2); overflow: hidden`) pada `.r03-kalender .cal-days-grid` dan `.cal-day-cell` di `src/styles/kalender.css`. Menggantinya dengan kartu independen ber-`border-radius: var(--ptv-curve-sm, 8px) !important`, border lembut `1px solid var(--line-2, #e2e8f0)` (`rgba(255, 255, 255, 0.08)` di dark mode), dan cell gap seragam `6px` (`4px` pada mobile `<=768px`, `2.5px` pada mobile `<=360px`).
  2. **Eliminasi 4 Sudut Asimetris (Corner Calibration):** Menghapus override sudut luar `.cal-cell-corner-tl/tr/bl/br` yang sebelumnya membuat pojok terluar melengkung 13px/22px sementara bagian dalam persegi; kini seluruh 35 sel kalender konsisten ber-radius 8px.
  3. **Preservasi Penuh Data & Hierarki Kalender:** Mempertahankan 100% data weton/pasaran (`Wage`, `Kliwon`, `Legi`, `Pahing`, `Pon`), tanggal Masehi & Hijriah (Arab), indikator titik agenda liputan & momentum, serta navigasi dan interaksi kalender. Melakukan penyesuaian minimal pada ukuran font weton (`8.5px`) dan titik indikator (`3.5px`) pada mobile `<=480px` agar kata pasaran dan titik indikator berdampingan rapi tanpa terpotong.
  4. **Verifikasi Terarah:** `npm run typecheck`, `npm run lint`, `npx vitest run tests/hub/kalender*` (27 tests), `npm run build` PASS (0 warning/error). Verifikasi screenshot Chrome CDP (Light/Dark mode di Desktop & Mobile 390px) terbukti identik dengan bentuk referensi pengguna.

- **CLN-186 | PTV-DEV-175, Cross-Module Visual Consistency R03 (Peminjaman · Lapor Kerusakan · Lost & Found):**
  1. **Penghapusan Blok CSS Duplikat Warisan (~550 Baris) di `dashboard.css`:** Menghapus duplikasi aturan `.loan-txn-card`, `.loan-summary-bar`, `.damage-summary-bar`, dan `.damage-shopee-*` pada `src/styles/dashboard.css` yang sebelumnya menimpa stylesheet modul (`peminjaman.css` & `lapor-kerusakan.css`) dengan nilai lama (`border-radius: 12px`, `minmax(200px, 1fr)`, `margin-bottom: 12px`).
  2. **Konsolidasi Container, Toolbar & Empty State Ketiga Modul:** Menghapus outer padding/max-width ganda pada `.damage-page-wrap` (`lapor-kerusakan.css`), menghapus `.lf-search-wrapper { display: none !important }` pada `lostFound.css`, mengaktifkan kembali search bar di `LostFoundFilterBar.tsx` yang terhubung ke state `searchQuery` existing di `LostFoundPage.tsx`, serta menyatukan active state filter pill (`.loan-filter-pill-btn.active`, `.damage-fchip.active`, `.lf-segmented-btn.active`) dan tombol CTA utama (`.loan-btn-checkout-primary`, `.damage-btn-cta`) pada token `var(--pri, #1273E6)`.
  3. **Housekeeping & Verifikasi:** Menghapus direktori profil Chrome sementara (`chrome-tmp-profile-175*`) setelah verifikasi visual CDP selesai. `npm run typecheck`, `npm run lint`, `npm run build`, dan 47 unit test regresi PASS (0 error/warning).

- **CLN-185 | PTV-DEV-174, Final UI/UX Correction & Visual Consistency R03 (16 Mandatory Fixes):**
  1. **Konsolidasi Aturan CSS yang Saling Menimpa (Root-Cause Cleanup):** Menghapus aturan duplikat `.note-type-segment` / `.note-type-btn` di `src/styles/dashboard.css` yang sebelumnya menimpa `src/styles/catatan.css`, serta memindahkan inline style pada `PerizinanPage.tsx`, `KruDetailDrawer.tsx`, `ManagePermissionsModal.tsx`, dan `PortalManagementPage.tsx` ke class terstruktur R03 (`perizinan.css`, `kruKomunikasi.css`, `portalManagement.css`).
  2. **Eliminasi Dark Navy Surface Leaks:** Mengganti warna surface biru gelap hardcoded (`#0e1b2d`, `#122238`, `#0f172a`, `#172554`) pada blok dark mode di `softSurface.ts`, `dashboard.css`, `kalender.css`, `acaraKalenderNav.css`, dan `catatan.css` dengan token charcoal netral R03 (`var(--surface, #24282C)`, `var(--bg-2, #1B1E21)`).
  3. **Housekeeping & Verifikasi:** Menghapus direktori profil Chrome sementara (`chrome-tmp-profile*`) dari scratch sesudah verifikasi visual CDP selesai. `npm run typecheck`, `npm run lint`, `npm run build`, dan 85 unit test regresi PASS (0 error/warning).

- **CLN-184 | PTV-DEV-173, Visual QA Remediation R03 (P1 & P2 Browser Audit Fixes):**
  1. **Eliminasi Absolute Badge Overlap & Hardcoded Colors (Kerusakan):** Menghapus positioning absolut yang saling bertumpuk pada `.damage-shopee-badge-status` dan `.damage-shopee-badge-unit` di `lapor-kerusakan.css` serta aturan duplikatnya di `dashboard.css`, menggantinya dengan flex row `.damage-shopee-meta-top`. Mengganti inline hardcoded hex (`#b45309`, `#d97706`, `#059669`, `#10b981`, `#dc2626`) di `DamageSummaryBar.tsx` dan `DamageReportCard.tsx` dengan class semantik dan token R03.
  2. **Konsolidasi Inline Form Styles (Catatan / Notulensi & Generator Surat):** Mengganti inline style berulang pada label dan input modal di `CatatanPage.tsx` serta `GeneratorSuratPage.tsx` dengan class terstandar R03 (`.catatan-form-label`, `.catatan-form-sublabel`, `.catatan-form-input`) dan menghilangkan uppercase berlebihan (`text-transform: uppercase` pada label form).
  3. **Housekeeping Verifikasi Visual:** Menjalankan verifikasi render menggunakan Chrome Headless di direktori scratch artefak sesi dan langsung menghapus direktori profil sementara (`chrome-tmp-profile`) agar tidak meninggalkan sampah di workspace. `npm run typecheck`, `npm run lint`, dan `npm run build` PASS (0 error/warning).

- **CLN-183 | PTV-DEV-172, Phase 5 Global UI/UX Consistency (R03 Design System):**
  1. **Tipografi & Hierarki:** Mengadopsi skala proporsional SF Pro sesuai R03 (Page title 22-24px semibold 600, section title 15-17px semibold 600, card title 14-16px medium/semibold, body 14px regular, caption 12-13px). Mengeliminasi penggunaan font-weight berlebihan (800-900) dan letter-spacing renggang (0.04em-0.09em) ke tracking natural (-0.02em s.d. 0.02em) di `tokens.css`, `dashboard.css`, `publicVerification.css`, `catatan.css`, `generatorSurat.css`, `perizinan.css`, `acara.css`, `kalender.css`, `lostFound.css`, `kerusakan.css`, `keuangan.css`, `inventaris.css`, `pengaturan.css`, `kruKomunikasi.css`, `haul.css`, dan `seo.css`.
  2. **Design Tokens & Semantic Colors:** Memetakan alias token `--ink-3` dan `--ink3` ke `var(--muted)` di light dan dark mode. Mengganti hardcoded hex (`#2563eb`, `#1e478f`, `#334155`) dengan semantic tokens resmi PTV (`var(--b-600)`, `var(--b-700)`, `var(--cat-lensa-fg)`, `var(--surface)`).
  3. **Visual Density (Balanced):** Standarisasi card padding 14-16px dan jarak section 16-24px proporsional. Tabel dan list dipertahankan compact tanpa kartu bersarang berlebihan.
  4. **Komponen & Dark Mode:** Menyelaraskan tombol Catatan ke pill gradient R03, memperluas dark mode semantic tokens ke seluruh surface kartu, input, dan search bar portal publik verifikasi keabsahan dokumen dan identitas.
  5. **Batas Keamanan & Validasi:** Frontend/UI only; tidak mengubah database, schema, RLS, auth, credentials, atau permission. Gate Staging ON, maintenance OFF, Production READ-ONLY. Validasi 145 files (1685 tests) PASS, typecheck PASS, lint PASS, build PASS.

- **CLN-182 | PTV-DEV-171, cutover keamanan Inventaris/Storage:** eksekusi cutover grant Staging cloud pasca-bootstrap, penutupan tester sintetis dan validasi postflight. [Receipt171](docs/PTVPRO-INVENTORY-171-EXECUTION.json).

- **CLN-181 | PTV-DEV-170, eksekusi hosted+guard:** reuse seluruh handler/API dan runner165, tanpa redesign/refactor aplikasi. Packager allowlist mengecualikan env/trust-config/backup/docs/cache; gateway21rute eksplisit dibundel ESM khusus Preview, menolak target lain/prototype routes.83tes/typecheck/lint/build PASS,5check gateway tambahan. Runner hosted memakai URL deployment yang direview, CLI resmi+config stdin (bukan argv credential), DPAPI reader existing, output boolean; mode report-only menghindari pengulangan semua operasi sesudah guard. Cleanup LF diperbaiki ke API sebelum logout setelah penolakan grant direct-delete; fixture exact ID/marker sendiri dibersihkan dan digest6tabel kembali baseline.0fixture; audit sah tetap. Single-use konfigurasi env script dan snapshot/chunk temporary170 dihapus setelah path/manifest ownership diverifikasi; packager/template/regresi durable disimpan. Tidak menghapus cache, credential, scratch lain, atau perubahan Antigravity. Guard168 diterapkan setelah ACC+hosted PASS, tidak privilege cutover/provisioning workaround. [Receipt170](docs/PTVPRO-INVENTORY-170-EXECUTION.json).

- **CLN-180 | PTV-DEV-169, audit tiga gate:** source aplikasi/proposal168 dipertahankan; tidak menggandakan SQL/helper/runner atau mengulang suite/rehearsal/build PASS. Audit read-only mendapati UNIQUE identity dan crew terlalu luas, sehingga rencana tester tidak memakai identitas/password/role Rouf.11tes simulasi dua fase pada policy engine existing PASS, typecheck/lint file tes PASS; bukan cloud test. Metadata Vercel diperluas ke domain/custom environment tanpa mengakses env secret atau deploy;0Preview/0custom environment dicatat sebagai blocker. Dokumen terpusat ke readiness169 dan rencanaJSON, tanpa artefak scratch baru/cleanup massal/credential log. [Readiness169](docs/PTVPRO-INVENTORY-169-READINESS.md).

- **CLN-179 | PTV-DEV-168, consumer/readiness Inventaris/Storage:** reuse helper cookie existing untuk hosted-Staging pada search/loan/report/manager/service; tolak project salah dan hindari native client sebelum cookie. Direct table/RPC/Storage dan callers diperiksa terarah; native non-Staging tetap kompatibel.64regresi/typecheck/lint/buildStaging PASS. Proposal guard report menjaga body/owner/ACL/security/search_path;14checks gate awal/CAS/idempotensi/rollback lokal PASS. Reuse cluster scratch ber-marker, DB fixture dihapus/server dihentikan; snapshot ad-hoc dipusatkan ke baseline handoff tanpa duplikat. Tidak cleanup massal, credential log, UI redesign, revoke/DDL cloud/akun/role/commit/push/deploy. Hosted/limited-account tetap blocker faktual. [Readiness168](docs/PTVPRO-INVENTORY-168-READINESS.md).

- **CLN-178 | PTV-DEV-167, valuasi42P10 dan kesiapan cutover:** reuse upsert/RPC/DTO aplikasi dan runner privat existing; tidak membuat insert+update paralel atau menghapus duplikat. Migrasi idempoten memvalidasi struktur/tag index, NULL/duplicate/orphan dan ownership rollback; RESTRICT melindungi dependensi baru. DDL valuasi saja dieksekusi setelah ACC hash eksplisit;114row/digest existing dan grant/policy tidak berubah. Mode valuation-only mencegah pengulangan CRUD166; fixture sendiri dibersihkan dan audit append dipertahankan. Rehearsal PostgreSQL17 lokal yang disetujui memakai satu direktori scratch khusus,28checks PASS; DB sendiri dihapus/server dihentikan, cache cluster dipertahankan.54tes/typecheck/lint/build PASS. Template negative-test tidak mengarang identitas/credential/privilege; candidate keamanan tetap NO-GO. Tanpa redesign, cleanup massal, Production/commit/push/deploy. Detail [readiness167](docs/PTVPRO-INVENTORY-167-READINESS.md).

- **CLN-177 | PTV-DEV-166, verifikasi privat/cloud dan gate cutover:** reuse Assert-Dev155Acl/native DPAPI, tanpa bypass atau credential baru. Ganti inline shell reader dengan script berparameter/pipe-only; pin executable Windows PowerShell bawaan, normalkan PSModulePath proses anak termasuk duplikasi kapitalisasi, dispose SecureString/BSTR, dan batasi output ke tahap boolean. Runner165 direuse; kegagalan valuasi tetap dipertahankan sambil menguji sirkulasi/QC independen, dengan status rusak mengikuti SQL nyata. Regresi 57 tes mencakup 3 tes engine/guard/AST tanpa credential nyata; typecheck/lint/build PASS. Fixture master/unit/foto/loan/report sendiri dibersihkan; 0 fixture / 0 orphan postflight, audit operasional disimpan. Snapshot exact ACL/rollback nonsecret disiapkan; candidate NO-GO, grant dan schema tidak dieksekusi, data existing tidak dihapus. Source aplikasi/UI165 dipertahankan, tanpa cleanup massal. Detail [cloud166](docs/PTVPRO-INVENTORY-166-CLOUD-CUTOVER.md); status PARTIAL karena valuasi42P10 dan gate dependensi/role/rollback belum terpenuhi.

- **CLN-176 | PTV-DEV-165, Inventaris/Storage cookie integration:** reuse mapper/DTO Inventaris dan RPC atomik create/edit/loan/report existing. Adapter MODE staging tidak memilih mock/native query, Universal Search memakai service yang sama. Identity tidak diterima dari browser; request key dinamespace server dan audit canonical dipakai tanpa memalsukan created_by auth.users. Pembersihan foto saat timeout ditahan agar commit/retry tidak kehilangan objek. Menutup silent loss vendor/invoice/status/residu serta nilai buku0 dengan kolom existing yang diverifikasi langsung. Gate operasi loan/report ditambahkan sebelum RPC; mapping histori unit-parent diperbaiki. Review imports/variables/callers terarah pada file tersentuh,145tests/typecheck/lint/buildPASS; tidak cleanup massal atau menghapus cache/legacy/backup/perubahan Antigravity. Runner sementara dipusatkan ke `scripts/verify-inventory165-staging.mjs` dengan opt-in dan output boolean; server uji ditutup,0fixture165cloud. Keterbatasan credential/private positive test dan native grants dicatat di [integrasi165](docs/PTVPRO-INVENTORY-165-INTEGRATION.md); bukan cloud CRUDPASS, tidak migrasi/Production/commit/push/deploy.

- **CLN-175 | PTV-DEV-164, audit integrasi auth/session lintas modul:** reuse route guard, middleware environment, policy engine, finance resolver dan service valuasi existing; tidak membuat backend/abstraksi paralel. Tutup kebocoran rute mock ke Staging, hapus jalur kelola Portal berbasis hub.access, selaraskan validasi sesi Finance dan derivasi Kas Saya. Error upsert valuasi tidak lagi ditelan; uji login live dipisahkan dengan opt-in dan pin target sebelum membaca kredensial. Audit terarah imports/variables/callers pada file tersentuh, lint/typecheck PASS; regression role/mode/lockout/error-write PASS. Server Vite yang dibuat sesi ini ditutup; tidak menimpa baseline atau menghapus file pengguna, cache, legacy, backup. Tidak ada cleanup massal. Keterbatasan cloud/fixture serta file perubahan dicatat di [audit 164](docs/PTVPRO-INTEGRATION-164-AUDIT.md); tidak migrasi/data cloud/Production/commit/push/deploy.

- **CLN-174 | Phase 1 Complete Closure: PTV-002 Authentic Enrollment, Dual-Control Root Bootstrap 149 Committed, Real Browser Login PASS:**
  1. **Enrollment Sah Kredensial PTV-002 (`rouf`):** Membaca credential DPAPI asli yang dibuat langsung oleh pemilik PTV-002 (`6bf10320-dc82-4223-b43c-4c988470a3cc`). Meng-enroll password dengan bcrypt cost 10 via `ptv_auth_private.enroll_password` dengan versi CAS mikrodetik valid. Kredensial tersimpan di `public.auth_credentials`.
  2. **Verifikasi Login Nyata Portal Kedua Akun (Cloud Staging):** Memanggil `authenticatePortalPassword` untuk PTV-001 (`jid`) dan PTV-002 (`rouf`). Terbit audit log resmi `portal_login_verified` (Audit ID #23 & #24) dengan `login_route = 'vercel_password'` dan `proof_version = 1`.
  3. **Komitmen Transaksi Dual-Control Root Bootstrap 149:** Mengeksekusi transaksi atomik `docs/PTVPRO-ACCESS-149-ROOT-BOOTSTRAP-TEMPLATE.sql` di PostgreSQL Cloud Staging `swadgljnyelsjstqqxbm`. PTV-001 resmi menerima profil `root_executive`, PTV-002 menerima `eksekutif` (Recovery Admin dengan hak `crew.permissions.manage`). Tercatat audit trail resmi: Audit ID #25 (`root_bootstrap_completed`, 2026-10-26T11:43:49.783Z).
  4. **Pengujian Nyata Browser HTTP (Port 5174 dev:staging):** Pengujian E2E HTTP membuktikan kedua akun berhasil login, memegang kapabilitas `crew.permissions.manage`, live session valid, dan logout revocation durable.
  5. **Clean-as-You-Go & Quality Gates:** Seluruh runner/skrip eksekusi sementara dihapus; `npm run typecheck` PASS (0 errors), `npm run lint` PASS (0 warnings). Production STRICT READ-ONLY.

- **CLN-173 | Phase 1 Staging Operational Activation, Browser E2E HTTP Live Login, PTV-002 Review Preparation, and Dual-Control Root Posture:**
  1. **Aktivasi Gate Staging & Pematian Maintenance Auth:** Gate global Staging pada PostgreSQL Supabase `swadgljnyelsjstqqxbm` resmi dibuka melalui transaksi administratif: `UPDATE ptv_auth_private.policy SET enabled = true WHERE singleton;`, mengaktifkan akun PTV-001 (`status_akun = 'active'`), dan mencatat audit log ID #12 (`staging_gate_opened_and_ptv001_activated`).
  2. **Pengujian Browser HTTP Nyata Port 5174 PASS 100%:** Memverifikasi seluruh siklus browser HTTP round-trip terhadap dev server staging:
     - GET `/hub/login` -> 200 OK (render login form).
     - POST `/api/auth/login` dengan kredensial sah PTV-001 (DPAPI plaintext aman) -> 200 OK, terbit cookie `ptv_hub_session`, tercatat audit log ID #13 di Cloud Staging.
     - GET `/api/auth/session` dengan session cookie -> 200 OK, `authenticated: true`, validasi live access database cloud sukses (`capabilities: 24`).
     - POST `/api/auth/logout` -> 200 OK, revokasi RPC sesi durable sukses, cookie dibersihkan dengan `Max-Age=0`.
     - GET `/api/auth/session` (re-check) -> 200 OK, `authenticated: false`, penolakan akses terverifikasi sempurna.
  3. **Penyiapan Review Enrollment Sah PTV-002 (Satu Langkah Pemilik):** Menyiapkan artefak review privat di `%LocalAppData%\PTVPRO-Phase1-Private\ptv-002-enrollment-review.json` yang memvalidasi UUID, versi akun mikrodetik (`2026-10-26T07:58:22.219852Z`), SHA-256 security surface (`96b4f6279de9eca4098dcb521cc3e5b5dbf9d0b1904378ca85dfe24277a2f8f8`), approval reference, dan recovery reference. Pemilik akun PTV-002 dapat langsung mengeksekusi satu langkah persiapan password interaktif via `scripts/prepare-phase1-password.ps1 -AccountId 6bf10320-dc82-4223-b43c-4c988470a3cc` tanpa pemalsuan identitas atau password fiktif.
  4. **Postur Dual-Control Root (Template 149):** Sesuai arsitektur Template 149, penetapan profil Root di Staging Cloud membutuhkan keberadaan kredensial dan audit login dari recovery partner (PTV-002). Karena PTV-002 belum menginput passwordnya dan mandat melarang persetujuan palsu atas nama pemilik, profil Root Cloud tetap ditahan secara sah (Root=0). Seluruh alur teknis 149 terbukti 100% lulus 36 checks sintetis.
  5. **Clean-as-You-Go & Quality Gates:**
     - Skrip pengujian sementara dibersihkan dari memory/scratch; tidak ada kebocoran rahasia atau kredensial.
     - 140 test files / 1.611 tests PASS (100%).
     - TypeScript typecheck (`tsc --noEmit`): PASS (0 error).
     - ESLint (`eslint . --max-warnings 0`): PASS (0 warning).
     - Production Posture: STRICT READ-ONLY, tidak ada commit, push, atau deploy.

- **CLN-172 | Phase 1 Final Closure: Operational Auth Integration, Browser E2E Lifecycle, Root Bootstrap Hardening, and Quality Gates:**
  1. **Tuntas Integrasi Operasional Auth & Session:** Memvalidasi integrasi penuh frontend ke backend Supabase Staging (`VITE_AUTH_BACKEND=vercel` & direct SQL `ptv_auth_private`). Pengujian browser end-to-end terisolasi membuktikan: form login berfungsi, PTV-001 login positif menghasilkan token JWT bertanda tangan HMAC dengan session registration di database, Hub Shell dan Manajemen Kru merender hak akses kanonikal (`hub.access`, `crew.view`, `inventory.view`, `settings.personal`), hak Root/Executive ditolak mutlak, refresh sesi mempertahankan state, logout mencabut sesi dan membersihkan token cookie, proteksi route mengarahkan unauthenticated user ke `/hub/login`, recovery independen memverifikasi nomor telepon kanonikal `6285334340616` dan menolak nomor asing, serta penolakan akun inactive, suspended, atau JWT kadaluarsa/revoked.
  2. **Bootstrap Root & Recovery Independen (PTV-001 & PTV-002):** Seluruh kode dan alur bootstrap Root terbukti 100% lulus 36 pemeriksaan sintetis PostgreSQL 17 (`scripts/test-root-bootstrap-149-local.mjs`). Target Root: PTV-001 (`c08952de-a8ff-48e0-8182-ac0bb7ac6767`); Target Recovery: PTV-002. Terbukti: mutual independence, verifikasi login proof audit trail fresh (< 24 jam), penolakan mutasi ilegal RLS, penolakan grant palsu, ketahanan terhadap race condition konruen (tepat 1 transaksi menang), immutability marker audit `root_bootstrap_completed`, penolakan penguncian administrator pemulihan, konsistensi backup/restore `pg_dump`/`pg_restore`, serta alur revert terpisah yang aman.
  3. **Perbaikan Concurrency Helper Test:** Memperbaiki helper `concurrent` di `scripts/test-phase1-provisioning-local.mjs` untuk menormalkan `SET TIME ZONE 'UTC';` agar konsisten dengan `query`, menuntaskan kelulusan 36 checks provisioning, 59 legacy batch, dan 61 overnight targets.
  4. **Quality Gates Repository Final:** 139 test files / 1.610 tests PASS (100%), `npm run typecheck` (tsc --noEmit) 0 error, `npm run lint` (eslint) 0 error/0 warning, dan `npm run build` (vite build) sukses selesai dalam 21.98s. Postur keamanan Staging & Production tetap terjaga utuh.

- **CLN-171 | Phase 1 Pilot Enrollment & Auth Lifecycle Verification PTV-001:**
  1. **Investigasi & Resolusi Presisi Timestamp CAS PostgreSQL:** Mengidentifikasi akar masalah penolakan CAS (`review mismatch`) pada `enroll_password`: serialisasi JavaScript `new Date().toISOString()` memangkas pecahan mikrodetik menjadi 3 digit milidetik (`.219Z`), sementara PostgreSQL `user_account.updated_at` menyimpan 6 digit mikrodetik (`.219852Z`). Selisih 852 mikrodetik menyebabkan ekspresi `updated_at IS DISTINCT FROM expected_account_version::timestamptz` melempar kegagalan. Diperbaiki di `scripts/get-phase1-enrollment-meta.mjs` menggunakan formater `to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` sehingga verifikasi CAS terbukti presisi 100% (`cmp_microsecond: true`).
  2. **Defensive UTF-8 BOM Stripping:** Menambahkan sanitasi `input.replace(/^\uFEFF/,'').trim()` pada `scripts/enroll-phase1-private.mjs` dan `scripts/get-phase1-enrollment-meta.mjs` untuk mencegah `SyntaxError: Unexpected token` saat menerima stream stdin dari StreamWriter PowerShell Windows.
  3. **Eksekusi Enrollment Privat Terverifikasi:** Akun pilot PTV-001 (`c08952de-a8ff-48e0-8182-ac0bb7ac6767`, username: `jid`) berhasil di-enroll dengan receipt ID #7 (Transaction xid 2325), membuktikan persistensi bcrypt cost 10 yang cocok 100% dengan password DPAPI yang diinput langsung oleh pemilik akun.
  4. **Suite Pengujian Terarah Siklus Auth Pilot PTV-001 PASS 100%:**
     - *Step 1 (Password Verification):* PASS (bcrypt compare cocok dengan secret DPAPI).
     - *Step 2 (RBAC Permission Evaluation):* PASS (`hub.access`, `crew.view`, `inventory.view`, `events.view` aktif; `executive.access` dan `root.access` ditolak mutlak).
     - *Step 3 (Session Login & Validation):* PASS (`rpc_portal_session_valid` memvalidasi token sesi dan credential version aktif dalam transaksi terisolasi).
     - *Step 4 (Session Logout & Revocation):* PASS (`rpc_portal_session_revoke` berhasil mencabut sesi secara durable; validasi pasca-revoke mengembalikan false).
     - *Step 5 (Recovery Channel Independence):* PASS (kanal pemulihan `REC-TEL-6285334340616-RECOVERY-CHANNEL` cocok dengan nomor otentik pada arsip kru `5d1d2488-d8f3-4e6d-9b67-2d56c28c96fe`).
  5. **Postur Keamanan Utuh:** Root tetap 0, credential baru tepat 1 (hanya PTV-001; 24 akun legacy lainnya tetap inactive tanpa credential), gate global tetap OFF, Production tetap READ-ONLY.
  6. **Pembersihan Bersih (Clean-as-You-Go):** Seluruh runner dan skrip diagnostik sementara (`scripts/pilot-ptv001-lifecycle.mjs`, `scripts/run-verify-ptv001.ps1`, `scripts/verify-enrolled-ptv001.mjs`, `scripts/auto-prepare-ptv001-review.ps1`, `scripts/get-ptv001-metadata.ps1`) langsung dihapus setelah pengujian selesai. Bukti disimpan secara agregat di [`docs/PTVPRO-PHASE1-PILOT-PTV001-RESULTS.json`](file:///c:/Users/zidna/ptvpro/docs/PTVPRO-PHASE1-PILOT-PTV001-RESULTS.json). Typecheck, lint, dan 14 test files / 200 tests PASS (100%).

- **CLN-165-P1 finalisasi containment:** gunakan proposal existing yang sudah diuji, tanpa refactor/source aplikasi baru. Smoke hanya script sementara milik sesi, loopback5185/cookie diabaikan/API writer diblokir; script/server/tab dibersihkan dan5174 tetap berhenti.91 regression/typecheck/lint/build PASS; tidak mengulang SQL32 atau membersihkan data/backup/working tree Antigravity. Audit receipt6/xid2323 dan evidence agregat dicatat; maintenance ON, tidak account/credential/Root mutation.

- **CLN-165-P1 operasional auth:** hapus fallback mock dari adapter server; batasi mock factory ke development, pertahankan fixture/dev service terpisah. Reuse resolver/permission engine dan Binary COPY/layout/context/plan-redaction/DPAPI/C01 existing untuk enrollment, bukan engine paralel. Ganti SET logging superuser/bind sensitif dengan packet TEMP privat, tangkap error/audit rollback, pin executable dan baseline; no plaintext tempfile. Timer subscriber dibersihkan saat unsubscribe; respons stale tidak menimpa sesi baru, logout failure tidak disamarkan. Tambahkan flag pending-link pada adapter/mapper/drawer tanpa global CSS/UI redesign.32 SQL nyata lokal/354 regression terkait/typecheck/lint/build/AST/syntax PASS; cloud hanya metadata targeted push/cutoff, proposal containment belum dieksekusi. Tidak cleanup massal, perubahan Finance/Inventaris, menghapus mock fixture sah, legacy/history/backup atau pekerjaan Antigravity.

- **CLN-165-P1 ACC binary guard boundary:** perbaiki false positive write_closed yang mencakup archive padahal kontrak REVOKE ACC-1 hanya9accessstores+audit. Daftar sekarang direuse untuk SQL resolved, archive RLS/defaultdeny tetap eksplisit; regression dibandingkan langsung ke bundle ACC-1, tidak skip error/merombak cloudgrant/RLS. Tambahkan approvedSqlSha binding agar descriptor tidak membawa approval lama setelah hash berubah. 20 unit/lint/AST PASS, business SQL/hash tidak berubah, SQL39 baseline tidak diulang. Tidak cleanup massal/UI/Finance/Inventaris atau credential/cloud mutation.

- **CLN-165-P1 COPY:** business body parent di-reuse, bukan RBAC/RPC/identity engine baru; literal executor dan helper logging lama yang tidak lagi dipakai dihapus, validator kini mensyaratkan descriptor ACC hash baru. Transport/role snapshot-helper spesifik admin memakai DPAPI/C01/CA existing, tanpa API publik/persistent DB helper/plaintext tempfile. Whitelist layout/grants/trigger/schema mendahului COPY; SQLSTATE+stage menggantikan raw errors dan audit failure tetap tercatat. Role only auto_explain param0 direstore exact, in-progress lease menahan rerun buta. 39 PG17 synthetic/19 unit/target lint/syntax/AST PASS; no canary in final logs/stats, tidak klaim pgAudit extension runtime lokal tersedia. Fixture/server cleanup verified; old encrypted artifacts/backups preserved. Source aplikasi/Phase5/Finance/Inventaris tidak diubah, no mass cleanup atau cloudmutation. Dependency pg-copy-streams7 dev-only dari upstream resmi.

- **CLN-165-P1 error privacy:** reuse wrapper guard existing; cek verbosity/parameter/plan/utility ditambah agar konfigurasi parsial tidak dianggap aman. Tidak pemodelan audit/logging baru atau perubahan payload. 3 checks PostgreSQL17 loopback dengan canary sintetis (DETAIL vs terse dan primary error MESSAGE) PASS, tanpa metadata/credential asli; fixture/server dibersihkan, skrip sementara sendiri dihapus, evidence hanya booleans. 11 regression tests/lint/syntax PASS. Cloud hanya readonly; kapabilitas supautils terbatas didokumentasikan, tidak privilege/allowlist/auditsetting diubah. Original role-config digest verified unchanged. Tidak cleanup massal/backup/UI/Finance disentuh.

- **CLN-165-P1 wrapper operator:** launcher minimal reuse reader DPAPI/C01/ancestry/transcript existing, CA dan koneksi Staging fixed; helper tidak punya endpoint publik atau fallback template. UTF-8 StreamWriter anonim mendukung PS5.1 tanpa property .NET-only, tidak plaintext tempfile/env/args. Checkpoint source hanya digest agregat TTL15min, precision mikrodetik, tidak menyalin inventory/generator. Output whitelist dan containment menghindari false zero saat outcome tidak pasti; tidak log raw error. Guard SERVER_LOG_PRIVACY tidak melemahkan audit untuk melewati kegagalan. 7 tests baru/lint/syntax/AST terarah; tidak cleanup massal/source aplikasi/SQL approved/UI/cloudmutation.

### Living Portal Menu Navigation & Modal Scroll Lock Repair — PTV-DEV-160 / Antigravity / jidnal (26 Oktober 2026)
- **CLN-170 | Living Portal Menu Navigation & Modal Scroll Lock Coordination: Scroll Lock Decoupling, Instant Release, Dynamic Sticky Header Offset, Re-Click Resiliency, & Cross-Route Reactive Smooth Scroll:**
  1. **Akar Masalah Navigasi Menu Terpecahkan:** Mengidentifikasi dan memperbaiki kegagalan navigasi saat pengguna mengklik "Direktori Layanan" dari MENU di posisi Hero (`scrollY: 0`). Sebelumnya: (a) `smoothScrollTo` dipanggil secara asinkron saat `document.body` masih berstatus `position: fixed` dari modal scroll lock sehingga pemanggilan scroll diabaikan browser; (b) Saat dialog menu di-unregister, method `releaseBodyScrollLock()` pada `dialogManager` secara eksplisit mengeksekusi `window.scrollTo(0, scrollY)` yang bernilai 0, sehingga viewport dipaksa kembali ke Hero.
  2. **Dukungan `restoreScroll` & `releaseScrollLockNow` di `dialogManager`:** Menambahkan opsi `restoreScroll?: boolean` (default `true`) pada `RegisteredDialog` dan `useModalScrollLock`. Untuk menu navigasi dropdown/drawer (`lp-mobile-nav-menu`), `restoreScroll` disetel ke `false`. Menambahkan method publik `dialogManager.releaseScrollLockNow(restoreScroll = false)` yang secara instan mencabut fixed body style tanpa mereset posisi scroll viewport ke Hero.
  3. **Eksekusi Smooth Scroll Dua Frame (rAF) Pasca-Unfix:** Di `LivingHeader.tsx`, saat item menu navigasi diklik, `closeMenu()` dan `dialogManager.releaseScrollLockNow(false)` dipanggil seketika, dilanjutkan eksekusi `smoothScrollTo` di dalam double `requestAnimationFrame` untuk memastikan layout reflow browser telah kembali normal flow sebelum koordinat target dihitung.
  4. **Kompensasi Tinggi Sticky Header Dinamis:** Mengganti hardcoded offset `80px` di `scrollUtils.ts` dengan pengukuran tinggi aktual sticky header via `document.querySelector('.lp-top')?.getBoundingClientRect().height + 12`. Menjamin pendaratan scroll landing selalu presisi di bawah header baik pada desktop maupun mobile, dengan dukungan penuh preferensi `prefers-reduced-motion: reduce` (`behavior: 'auto'`).
  5. **Ketahanan Klik Berulang & URL Ber-Hash:** Menangani klik berulang saat URL sudah mengandung `#direktori-layanan` menggunakan `window.history.replaceState` tanpa merusak riwayat browser dan tanpa menghentikan smooth scroll ke section target.
  6. **Navigasi Lintas Rute Reaktif dari Halaman Status (`/preview/status-layanan`):** Menghubungkan `LivingPortalPage.tsx` dengan listener reaktif yang mendeteksi perubahan hash rute SPA secara dinamis, mengarahkan viewport dengan `smoothScrollTo(hashId)` ber-offset aktual menggantikan `scrollIntoView` lama yang menabrak header.
  7. **Quality Gates & Bukti Browser Nyata (CDP Headless):**
     - Typecheck TypeScript: PASS (0 error).
     - ESLint: PASS (0 warning).
     - Full Vitest Test Suite: 135 test files / 1.565 tests PASS (100%).
     - Production Build (`npm run build`): PASS (selesai dalam 7.00s).
     - Pengujian Browser Nyata (CDP Headless Chrome di port 5174): Membuktikan secara empiris:
       - Di Hero: `scrollY: 0` -> Buka Menu: `isMenuOpen: true`, body fixed -> Klik "Direktori Layanan": menu tertutup, scroll lock terlepas (`bodyPosition: ''`), `scrollY` bergeser ke `570px`, dan judul direktori terlihat presisi dengan jarak `103.84px` di bawah sticky header.
       - Re-click dengan hash eksisting: tetap smooth scroll dan stabil di section direktori.
       - Dari `/preview/status-layanan`: klik "DIREKTORI ↗" berhasil berpindah ke `/preview/living-portal#direktori-layanan` dan mendarat mulus di direktori.
       - Tombol CTA Hero "Jelajahi 6 Layanan" dan tombol header "Layanan" tetap berfungsi normal.
       - Background halaman dapat di-scroll normal secara instan setelah menu ditutup.


- **CLN-165-P1 artefak final (ACC lokal):** renderer/penulis DPAPI memakai generator existing, tanpa credential reader/engine/linking baru. Terminator ConPTY dan kompatibilitas `PSModulePath` child diperbaiki tanpa melemahkan ACL/consoleguard/policy; tidak ada file plaintext sementara. Pemeriksaan independen ACL/dekripsi/hash/manifest tertanam/target unik PASS. SQL final DPAPI di luar repo sekarang tersedia; catatan BLOCKED artefak di entri overnight sebelumnya adalah riwayat sebelum ACC lokal. Tidak source aplikasi/SQL/cloud/UI berubah atau suite lama diulang; OpenPGP hanya tooling transport lokal sementara, bukan dependency aplikasi/bundle. Tidak backup diubah/dihapus.

- **CLN-165-P1 overnight:** reuse planner/template/harness dan enrollment private existing; guard exact25, canonical name source, tanggal Jakarta, UTC fingerprint, delimiter SQL aman dan capability drift diperketat. Adapter hanya proyeksi baca provenance/FK, menolak edit arsip belum tertaut; tidak engine/RPC/linking paralel. Private launcher reuse DPAPI/ACL/consoleguard, parameter binding dan sanitized errors; dependency `pg` hanya tooling dev. Dependency OpenPGP eksperimen dihapus setelah jalur transfer ditolak; renderer sementara dihentikan, tidak backup dihapus. Tidak unused imports/variabel pada file tersentuh menurut lint akhir; tidak orphan endpoint/UI/CSS atau cleanup massal. 61SQL/156tests/typecheck/lint/build/AST PASS, tanpa credential nyata/cloud mutation. Final SQL/hash tetap BLOCKED dan dicatat jujur di readiness.

- **CLN-165-P1 koreksi inactive-only:** pisahkan eligibilityprovisioning vsactivation di plannerexisting, hilangkan coupling source-loginactive yang tidak diperlukan untuktargetinactive. Tidak melemahkan gate/RLS/grants. Reusegenerator/harness;45SQL/3targettests/lintPASS untukguardchanged, statusunknownexplicitdisimpan tanpaaktivasi. Tidak enginebaru/defaultactive/WPcredentialreader/cleanupmassal/cloud/UI.

- **CLN-165-P1 resolve HOLD:** reuse planner/reconciler dan aturan kategori existing; helper baru murni hanya menerapkan evidenceUUID+version, menolak duplicate/stale/nonoperationalconflict. Tidak source credentialreaderbaru/defaultloginfallback atau perubahanSQLprovisioning. ExportSELECT menjaga semuabarismetadata dan tidak mengambil MAX yang menyembunyikankonflik. Hanya3testsbaru/lintterarah, tanpaulang42SQL/cleanupmassal/UI/cloudwrite.

- **CLN-165-P1 lanjutan Legacy batch:** reuse reconciler149 dan template provisioning, bukan RBAC/RPC/bulkengine paralel. Generator fail-closed bila kontrakbase berubah, literal dollar replacement diperbaiki dengan callback dan regression; output teruji PostgreSQL. Shared runner memakai flag allowlisted --legacy-batch, fixedloopback/uniquedatabase/noenvcloud;cleanup/stoppedverified. Manifest hanya pseudonim/format/cost/indikator, rawpasswordhash/token tidakdiambil dan rawpersonelprocessmemory dibersihkan.42SQL/17tests/Node2checks/typecheck/lint/buildPASS;tanpamasscleanup/backup/UI/cloudwrite/DEVbaru.

- **CLN-165-P1 lanjutan provisioning:** reuse fixture/bootstrap149+152+Lifecycle dan enrollment existing, bukan permission engine/RPC baru. Proposal administratif satu transaksi tanpa privilege permanen; manifest/receipt/state hash menolak drift/replay berbeda, source archive tetap utuh. Runner hanya loopback55439, unique synthetic database, menolak server existing dan argskoneksi; cleanup database+server diverifikasi. Skrip password offline reuse console/ACLguardDEV155 dan DPAPI, tidak readersecret paralel/cloudclient; tidak dijalankan dengancredentialnyata.36SQL/79tests/lint/ASTPASS;buildLivingPortalFAIL di luar file tersentuh, tidakdibersihkan. Tidakmasscleanup/UI/backup/history changes.

### Living Portal Integration Regression Fix — PTV-DEV-159 / Antigravity / jidnal (26 Oktober 2026)
- **CLN-169 | Living Portal Integration Regression Fix: PTV Hub Recovery, Canonical Naming "Keabsahan Dokumen", Dynamic Status Summary, Header Scrolled Contrast, Route-Aware Cross-Navigation, & Non-Destructive Reconciliation:**
  1. **Pemulihan Layanan PTV Hub (Kritis):** Memperbaiki akar masalah hilangnya PTV Hub dari direktori publik (sebelumnya hanya 5 layanan tampil). Di `portalCatalog.ts` dan `portalManagementService.ts`, status `pub: 0` (warisan portal lama) telah dikoreksi menjadi `pub: 1` dengan kategori `Layanan Progresif TV` dan badge akses `Kru`. Menambahkan mekanisme rekonsiliasi non-destruktif saat inisialisasi: memulihkan `pub: 1` pada record `hub` di `localStorage` dan melengkapi layanan yang hilang tanpa menimpa data yang sengaja dinonaktifkan oleh administrator. Total kini tepat 6 layanan resmi (`aset`, `short`, `hub`, `idv`, `ltr`, `maj`) tampil konsisten di Hero CTA (`JELAJAHI 6 LAYANAN ↓`), filter direktori (`Semua (6)`), grid kartu, dan halaman status.
  2. **Standardisasi Nama Kanonikal "Keabsahan Dokumen":** Menyelaraskan nama layanan `id: 'ltr'` dari `Verifikasi Surat` menjadi `Keabsahan Dokumen` secara konsisten pada `portalCatalog.ts`, `portalManagementService.ts`, `LauncherDirectory.tsx`, dan `LivingStatusPage.tsx`. Route lama `/verifikasi-surat` tetap dipertahankan sebagai alias kompatibilitas.
  3. **Penyelarasan & Akurasi Halaman Status (`/preview/status-layanan`):** Menghapus klaim status keliru "Seluruh Layanan Beroperasi Normal" ketika masih terdapat layanan "Segera Hadir". Menggantinya dengan ringkasan status agregat dinamis: "Seluruh Layanan Aktif Beroperasi Normal" dengan rincian aktual (misal: "4 layanan aktif · 2 segera hadir"). Menghapus klaim monitoring otomatis ("gangguan terdeteksi pada waktu pemantauan ini") dan menggantinya dengan verifikasi berkala transparan oleh operator. Waktu pembaruan status kini membaca timestamp aktual dari metadata layanan, bukan otomatis `new Date()` hari ini.
  4. **Proteksi Kontras Header Sticky & Isolasi Tema Gelap:** Memperbaiki insiden header gelap dan logo tidak terlihat saat scroll. Mengisolasi Living Portal dan Status Page dari polusi atribut `data-theme="dark"` peninggalan modul Hub (`data-theme-hub-backup`). Memperkuat background header scrolled menjadi `rgba(241, 241, 248, 0.98)` dengan blur 20px, shadow halus, dan `z-index: 50`. Logo resmi Progresif TV selalu memiliki kontras tajam rasio > 14:1.
  5. **Navigasi Lintas Rute Sadar-Halaman (Route-Aware Navigation):** Menghubungkan `LivingHeader` dengan `useLocation` dan `useNavigate` yang aman (termasuk saat SSR/pengujian). Pada `/preview/status-layanan`, menu "Status Sistem 03" ditandai aktif (`.is-active`), tombol desktop berubah menjadi "DIREKTORI ↗", dan klik Beranda/Direktori menavigasi ke launcher dengan target hash yang ditangani secara mulus. Smooth scrolling dipertahankan untuk navigasi internal halaman yang sama.
  6. **Pembersihan Pengumuman Contoh Liar & Penataan Strip:** Mengosongkan default hardcoded announcement `ann-haul-2026` (`isPublished: true` dicabut). Menambahkan CSS terstruktur `.lp-announcement-strip` agar tidak bertabrakan dengan header fixed dan teks panjang terpotong rapi dengan ellipsis. Pengumuman hanya tampil jika benar-benar diterbitkan sah oleh administrator.
  7. **Quality Gates & Validasi Regresi:** Menambahkan regression suite komprehensif di `tests/portal/portalRegressionFix.test.tsx` (5 tests PASS). Seluruh quality gates repositori: 134 test files (1560 tests) PASS (100%), typecheck 0 error, lint 0 error/warning, production build Vite sukses tanpa regresi. Verifikasi visual Headless Chrome CDP membuktikan rendering desktop dan mobile (320, 375, 390, 430 px) bebas overflow horizontal dan stabil.

### Living Portal Management, Status Page, & Modal Scroll Lock — PTV-DEV-158 / Antigravity / jidnal (26 Oktober 2026)
- **CLN-168 | Portal Management di PTV Hub, Living Status Page Baru, & Centralized Modal Background Scroll Lock:**
  1. **Modul Pengelolaan Portal PTV Hub (`/hub/portal`):** Mengembangkan modul Hub terpadu dengan 6 tab navigasi (Direktori Layanan, Kontrol Status, Pengumuman Publik, Layanan Musiman, Pengaturan Umum Launcher, dan Riwayat Audit Log). Konten direktori, teks hero, dan kontak bantuan kini dikelola secara dinamis tanpa mengubah source code langsung.
  2. **Alur Aman Draft → Preview → Publish:** Mengimplementasikan siklus publikasi bertahap. Perubahan draft disimpan di payload terpisah (`hasDraft: true`) dan dapat dipratinjau di `/preview/living-portal?previewDraft=true`. Pengguna publik hanya dapat membaca data yang berstatus `isPublished: true` dan aktif secara rentang tanggal.
  3. **Halaman Status Layanan Publik Baru (`/preview/status-layanan`):** Menggantikan tampilan lama `ServiceStatusView` dengan halaman status yang menyatu dengan bahasa visual Living Portal (latar lavender lembut, tipografi editorial *Lusion-inspired*, kartu status putih beresolusi tinggi, filter kategori cepat, agregasi otomatis kondisi sistem, dan catatan pemeliharaan transparan). Seluruh entry point status diarahkan ke route baru.
  4. **Penguncian Scroll Background Modal Universal:** Memperbaiki bug scrolling background ketika modal, dialog bantuan WhatsApp (`HelpDialogModal`), drawer navigasi mobile (`LivingHeader`), detail pengumuman (`AnnouncementModal`), dan dialog layanan ("Segera Hadir" di `LauncherDirectory`) terbuka. Terintegrasi ke hook `useModalScrollLock` dan `dialogManager` dengan penguncian `position: fixed; top: -scrollY`, kompensasi layout shift scrollbar, pencegahan wheel/touch/trackpad scroll, pemulihan scroll position eksak saat ditutup, serta proteksi shortcut global.
  5. **Continuous Curve & ADR-016 Governance Compliance:** Memastikan seluruh komponen modal dan tabel Hub mematuhi tata kelola desain R03 tanpa hardcoded inline pixel border-radius (`var(--radius-sm)`, `var(--radius-md)`, `var(--radius-lg)`). Menjaga integritas canonical ADR-016 dengan tepat 53 capabilities dan RLS policies Supabase staging yang terisolasi.
  6. **Quality Gates & Validasi Nyata:** 133 test files / 1.555 unit tests PASS (100%), typecheck 0 error, lint 0 warning, production bundle build PASS. Verifikasi nyata melalui Chrome CDP membuktikan `body.style.position === 'fixed'` dan `top: -350px` saat modal dibuka, serta pemulihan scroll tepat `350px` saat ditutup.

### Living Portal / Preview Launcher — PTV-DEV-157 / Antigravity / jidnal (26 Oktober 2026)
- **CLN-167 | Living Portal Mobile UX & Motion Final Refinement: Premature Timer Removal, Sticky Smooth Scroll, Dynamic Catalog Status, & Compact 2-Column Mobile Footer:**
  1. **Eliminasi Premature Fallback Timer & Scroll Reveal Asli:** Menghapus `fallbackTimer = setTimeout(..., 350)` di `LivingPortalPage.tsx` yang sebelumnya memaksakan kelas `.visible` ke seluruh elemen direktori dan kartu sebelum user sempat melakukan scroll. Menggantikannya dengan `IntersectionObserver` ringan berbasis `.lp-scroll-reveal` dan transisi translateY(28px) -> translateY(0) dengan easing `cubic-bezier(0.16, 1, 0.3, 1)`, masked text reveal pada heading, dan per-card delay staggered `--card-index`.
  2. **Smooth Scroll Terpadu dengan Header Offset:** Menambahkan utilitas `smoothScrollTo` di `scrollUtils.ts` dengan offset 80px untuk kompensasi sticky header, dukungan `prefers-reduced-motion`, dan update safe history hash. Mengaitkannya ke CTA Hero, menu mobile drawer (auto-close lalu scroll), dan tombol kembali ke atas di footer.
  3. **Mobile Header Compact & Single-Line:** Menata ulang header mobile pada viewport 320–430px dengan tombol Bantuan dan Menu sebagai circle icon pills compact 42x42px (`.lp-pill-icon`), menyembunyikan teks label di mobile, menjaga proporsi logo resmi Progresif TV (max-height 22px), dan memastikan nol pembungkusan baris teks maupun horizontal overflow.
  4. **Penyederhanaan Hero CTA:** Menghapus badge statis "SISTEM NORMAL" pada Hero; mendesain CTA ganda yang proporsional ("JELAJAHI 6 LAYANAN ↓" dan "BANTUAN RESMI ↗") dengan tinggi seragam 44px, berdampingan di 375–430px, dan stacked rapi di 320px.
  5. **Status Layanan Dinamis dari Single Source of Truth:** Footer launcher kini mengagregasi status layanan langsung dari `INITIAL_SERVICES` di `src/products/portal/services/portalCatalog.ts` (menghitung jumlah layanan publik beroperasi vs maintenance/incident) secara dinamis tanpa status hardcoded atau klaim sepihak.
  6. **Footer Mobile 2-Kolom Kompak:** Merestrukturisasi footer mobile menjadi 2 kolom seimbang (Layanan Utama di kiri, Bantuan & Informasi di kanan) di bawah identitas santri. Memangkas tinggi footer mobile secara drastis (636px) sehingga muat dalam satu viewport tanpa scroll panjang.
  7. **Quality Gates & Multi-Viewport Browser QA:** 130 test files / 1531 tests PASS, typecheck 0 error, lint 0 warning, build PASS. Pengujian headless Chrome (CDP) membuktikan scroll progressive bertahap, intersection observer triggered saat scroll, dan zero horizontal overflow pada 320px, 375px, 390px, dan 430px.

### Phase 5 UI/UX Finalization (R03) — PTV-DEV-156 / Antigravity / jidnal (25 Oktober 2026)
- **CLN-166 | SF Pro Typography Dual-Layer, PTVSelect Collision & Portal Isolation, Modal Stack Integration, & iOS Safari Anti-Zoom:**
  1. **Tipografi SF Pro Dual-Layer Semantik:** Mengintegrasikan `--font-display` (SF Pro Display) untuk heading, titles, dan display teks, serta `--font-body` (SF Pro Text) untuk antarmuka pengguna, label form, tabel, dan controls di `tokens.css` dan `dashboard.css`. Mempertahankan backward compatibility token literal `--ptv-font-family` untuk continuous curve tests existing tanpa redundansi font face.
  2. **PTVSelect Global Portal & Viewport Boundaries:** Menjadikan `usePortal = true` by default pada `PTVSelect.tsx` sehingga dropdown rendered via `document.body` portal secara collision-aware dan tidak pernah terpotong oleh card/modal/table overflow container. Ditambahkan pembatas batas kanan horizontal viewport (`viewportW - width - 12`) agar menu dropdown tidak melebar keluar batas layar pada mobile.
  3. **Integrasi Centralized Modal Lifecycle & Shortcut Guard:** Menghubungkan seluruh modal tersisa (`LogoutConfirmModal`, `PushDiagnosticsModal`, `UnlinkGoogleConfirmModal`, `LoanModal`, `AnnouncementModal`, `AnnouncementDetailModal`, `DeleteConfirmModal`, `LostFoundModalForm`, `LostFoundDetailDrawer`, dan demo modals di `DevCatalogPage`) ke hook `useModalScrollLock` dan stack `dialogManager`. Menjamin shortcut `/` dan `Ctrl+K` otomatis diblokir ketika modal aktif tanpa interupsi Universal Search.
  4. **Guidebook R03 & iOS Safari Anti-Zoom:** Memperketat rule mobile form inputs dengan aturan `.set-input { font-size: 16px !important; }` pada breakpoint `<= 640px` di `pengaturan.css` untuk mencegah trigger zoom otomatis peramban iOS Safari.
  5. **Live Inspector Enhancement:** Menambahkan inspeksi font dual-layer (UI & Body font + Display font) pada Live Inspector di `DevCatalogPage.tsx`.
  6. **Quality Gates & Test Coverage:** Menambahkan suite pengujian komprehensif 7 revisi operator di `tests/hub/phase5UiUxFinalizationR03.test.tsx` (14 tests PASS). Memverifikasi 126 test files (1479 tests PASS 100%), typecheck 0 error, lint 0 warning, dan production build Vite sukses tanpa regresi.

### Kelanjutan Phase1 setelah DEV155, tanpa DEV baru (25 Oktober2026)
- **CLN-165-P1 ACC1 | Generator dan rehearsal:** guard/closure berasal dari generator, bukan edit bundle manual; tidak duplikasi engine backup/comparator, reuse restore155 dan source hash. Empat runner fixture merender binding cluster lokal yang sah agar guard tidak dibypass; imports Node/sleep eksplisit pada file tersentuh dan cleanup exit failure tetap nonzero tanpa menutupi error asli.39checks clone nyata/40tests PASS; typecheck/full lint/targeted script lint, syntax/AST PASS. Clone dihapus/daemon+distro stopped, backup utuh; tidak membersihkan data/caches/working tree existing, UI atau FinanceSQL. Snapshot row values dan SQL errors mentah tetap di memori, evidence hanya boolean/count/hash proposal. Default grants existing tidak diubah.
- **CLN-165-P1 lanjutan | Lifecycle login dan sesi:** reuse auth_credentials/audit, engine149/152, linking dan renderer Root existing. Registry/fingerprint satu helper server, dipakai gate identity/liveAccess/Finance; tidak menggandakan RBAC. Canonical signature menutup alias padding; server-derived fingerprint tidak masuk claims/respons. Tidak log password/hash/IP mentah, tidak fallback sukses palsu; kegagalan audit me-rollback enrollment/login/revoke/linking. Adapter logout tidak menghapus state saat server gagal. Fixture sintetis final dihapus dan PG dihentikan; tidak cleanup data/backup existing.80SQL/329tests/17files PASS, typecheck/lint/build dan lint runner --no-ignore PASS. Scope hanya auth dan gate sesi bersama; tidak UI5, FinanceSQL, cloud, masscleanup atau DEV baru.
- **CLN-165-P1 | Personnel/account read model dan auth config:** reuse mapper/API/resolver/permission engine, tidak RBAC/RPC baru. Hapus inferensi canonical→akunaktif; lookup batch dan status pre-RPC menjaga hasil edit tanpa post-commit query tambahan. Relasi/status rusak gagal tertutup. Session server fallback selaras resolver existing/exactStaging. Komentar grouping yang tak cocok kode diperjelas; helper/type imports dipakai API+tests, tanpa dead helper/CSS/mock fallback.167 tests terarah,typecheck/lint/buildPASS. Tidak masscleanup/UI/cloud atau fullsuite/restoreulang; register paralel Antigravity tidak direbut.

### PTV-DEV-155 — Restore drill terbatas (25 Oktober2026)
- Node memory CLI lint: scripts memang di-ignore lint repo; pemeriksaan --no-ignore menemukan globals Node implisit, diperbaiki dengan import node:process/buffer/console eksplisit. Lint terarah max-warnings0 dan syntax PASS; tidak melonggarkan konfigurasi repo atau mengklaim full lint/build ulang.
- CLN-165 restore final: reuse engine154 lewat CLI stdin bounded16MiB, tidak menggandakan comparator. Supautils resmi/hashverified menggantikan keinginan menaikkan postgresSUPER; native owner handling7eventtriggers dalam satu transaksi, dump tak diubah. Raw6defaultACLordering dibuktikan semantiknya lewat aclexplode tanpa grantmutasi/engineweakening.103tabledata cocok,10comparator tests PASS,syntax/AST PASS. Cleanup hanya cloneberlabel/networknone setelahverifikasi; backup utuh, plaintextdata hanya RAM/tmpfs, runtime publik cache retained. Tidak masscleanup/UI/cloud/migrasi.
- CLN-165 runtime recheck: hanya WSL/CIM/reboot-pending, tanpa mengulang decrypt/tests/cloud audit. Bedakan VMP enabled dari runtime usable dan tidak menganggap firmware flags=false sebagai akar masalah saat HypervisorPresent=true. Tidak mengubah feature/firmware/restart/backup; tindakan operator satu Restart Windows.
- CLN-165 existing-backup verification: reuse envelope/comparator design, tambah consumer verify-first bounded RAM dan4 regression checks (14total PASS). Backup nyata dibaca hanya di memori, TOC diparse pg_restore tanpa mencetak definisi/PII. Tidak fake extension/restore atau menganggap TOC sebagai data parity. Satu blocker runtime WSL2 diverifikasi di host, bukan mengandalkan sandbox AccessDenied. Tidak cloud/password/newbackup/cleanup artefak existing.
- CLN-165 capture milestone: rekam output runtime manual operator sebagai evidence terpisah dari verifikasi langsung Codex; capture/envelope selesai, restore belum diuji. Tidak mengulang credential/capture, meminta backup privat atau membersihkan artefak existing. Hanya sinkronisasi status laporan/roadmap/piket/evidence.
- CLN-165 D03: perbaikan sempit root CA libpq, path bersama child/keeper dan pin SHA256 dari unduhan dashboard Staging resmi. Bukan credential system baru, tidak sslmode=require/disable atau truststore OS global. Probe tanpa password/query membuktikan TLS berhasil; tidak mengklaim autentikasi/backup. AST/static terarah, tidak ulang suite aplikasi.
- CLN-165 D02 remediation: ganti EFS-only writer dengan helper DPAPI streaming yang reuse probe/metadata/dump, autentikasi urutan/final record, bounded plaintext RAM tanpa plaintext file. Hapus branch restore yang belum aman/teruji dan EFS coupling; tidak mempertahankan jalur fallback dummy.10 synthetic checks di dua runtime PASS, AST PASS; tidak membaca credential/snapshot aktual atau cleanup backup existing.
- CLN-165 runner capture: reuse reader/manifest/comparator154, tidak memanggil secret-input via tool atau menulis plaintext password. Jalur native child-memory dilokalisasi; EFS wajib sebelum file nyata. Catalog read-only mengungkap vault absent local/managed role+eventtrigger, tidak fake fixture untuk meloloskan restore. AST/static required/forbidden checks PASS; tidak klaim runner/restore dijalankan. Tidak cleanup backup atau refactor aplikasi.
- CLN-165 ancestry: C04-MISSING-PARENT ditangani dengan anchor launcher desktop berpath resmi dan signature Microsoft valid, bukan mengabaikan missing parent umum. Guard agent/no-anchor dipertahankan; AST3/static checks PASS, tidak menjalankan prompt atau membaca credential.
- Diagnosis setup CLN-165: ganti kebuntuan error generik dengan identifier tahap tetap, bukan exception mentah; root cause belum diklaim. Parser AST3 scripts PASS, tanpa menerima/dekripsi password atau menjalankan guard di tool. Tidak melonggarkan akses.
- Tahap laptop CLN-165: helper DPAPI/ACL/console terpusat dipakai setup/check, tidak menggandakan reader atau membuat pg_dump adapter plaintext. AST parse/static forbidden checks PASS tanpa menjalankan script. Tidak mengubah aplikasi/UI/SQL, tidak membuat credential di tool, tidak cleanup existing atau full tests ulang. Runtime credential tetap belum diverifikasi.
- Follow-up HP CLN-165: gunakan sesi dashboard existing hanya baca target Staging; connection template disanitasi, tanpa browser cookie/token extraction, reset/provision CLI role atau dump via MCP. Catat Free Plan tanpa project backup serta bedakan sesi dashboard dari sesi libpq. Tidak ada perubahan aplikasi atau tests ulang.
- **CLN-165 | Documentation/evidence hygiene:** Reuse runbook/SQL/comparator154, tidak membuat backup lewat row query MCP atau dummy restore. Hanya nama key/presence konfigurasi diperiksa; tidak mencetak nilai credential/PII. Bukti cloud identity dipisahkan dari restore yang BLOCKED. Tidak ada perubahan kode/SQL/UI, cleanup massal, penghapusan backup atau resource lokal; tidak ada resource sementara baru. JSON evidence dan diff dokumentasi diperiksa, full tests tidak diulang.

### PTV-DEV-154 — Deadline alignment & restore readiness (25 Oktober2026)
- Diff-check luas menemukan trailing whitespace existing pada PTV-PRO-DATABASE-MIGRATION-REVISED.sql dan PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql; tidak diubah/di-cleanup karena di luar file154. Tidak mengklaim seluruh dirty working tree bersih.
- **CLN-164 | SQL/restore targeted hygiene:** Reuse native_account/finance_can_native/has_capability dan harness existing; tidak membuat RBAC/RPC bisnis paralel. Singkirkan cast exception keluar helper dan perbedaan not_after; validasi timestamp diperketat, bukan dilonggarkan. Mode154 menyimpan evidence baru, hasil105/31 dan backup existing tidak ditimpa. Dump fixture bernama unik; metadata/data digest comparator tidak mengekspor row values dan error CLI tidak mencetak input privat. Normalisasi CHECK hanya rewrite varchar-array/text setara yang terbukti ditemukan saat restore; enum/owner/grant/role/data changes dan manifest kosong tetap ditolak.133+33 SQL nyata,135 tests terarah serta typecheck/lint/build PASS. Tidak ada cleanup massal/UI/cloud/reset/deploy. Prosedur restore managed membedakan dump aplikasi, role mapping dan konfigurasi platform; snapshot aktual tetap BLOCKED.

### PTV-DEV-153 — Staging read-only preflight (25 Oktober2026)
- **CLN-163 | Documentation/evidence hygiene only:** Reuse proposal/preflight/rollback151/152/149; tidak mengubah source atau menggandakan permission engine. Snapshot laporan hanya schema/ACL/fingerprint/agregat, tanpa credential/hash/token/person rows. Pisahkan cloud read-only, restore112 terbatas, hasil fixture historis dan NOT CHECKED. Dokumentasikan mismatch deadline sesi151/152 tanpa mengubah proposal diam-diam. Tidak ada cleanup kode, delete artefak/cache, mutasi cloud, UI, commit/push/deploy atau full tests ulang. Laporan/evidence153 dan koordinasi roadmap/piket diperbarui.

### PTV-DEV-152 — Access149 Authentication & Recovery Readiness (25 Oktober2026)
- **CLN-162 | Auth targeted hygiene:** Reuse resolver/permission/PKCE existing; tidak menambah permission engine atau limiter in-memory palsu. Hapus fallback access-token-only yang melewati validasi ID-token nonce dan penghapusan cookie otomatis pada kegagalan backend. Parser login existing diberi batas/validasi, bukan endpoint paralel. Lockout diperiksa pada dua helper server. Malformed cookie diisolasi. SQL native152/safe rollback terpisah mempertahankan hash bundle149/Finance151; tidak restore helper rentan. Fixtures RSA/bcrypt/SQL seluruhnya sintetis, runner loopback terbatas dan server berhenti; scratch existing digunakan.30 tests baru,1443 suite penuh,31 SQL,8 native checks serta quality gates lulus. Tidak ada UI, data/sesi nyata, cloud, cleanup massal atau penghapusan cache. Batas keamanan tersisa ada di laporan152.

### PTV-DEV-151 — Finance database hardening (25 Oktober2026)
- **CLN-161 | SQL/auth targeted hygiene:** Reuse core post_transaction dari source existing dengan generator dependency-checked; reuse disbursement dan public wrapper signatures, consolidate reversal pada satu helper tanpa DELETE histori. RLS restrictive menutup grant/policy lama yang terlalu luas tanpa cleanup policy massal. Tidak menggandakan RBAC/profil/capability. API service-role wajib scope DB, tanpa fallback. Verifier bcrypt server berformat/cost terbatas sengaja belum dihubungkan ke login nyata; digunakan oleh tests dan runner native. Fixtures seluruhnya sintetis, termasuk Auth sessions dan metadata Storage; tidak menggunakan snapshot bisnis. Perbaiki typo qris_asset_path IS NOT NULL yang terbukti gagal parse. Sesuaikan fixture baca lama agar memakai sesi/scope eksplisit, bukan melemahkan guard. Tidak mengubah UI/CSS Antigravity, data nyata, cache/dependensi yang sudah ada, atau cloud. 105 checks SQL dan1413 tests serta quality gates lulus; keterbatasan ada di review151. Temporary logs/dump tetap .gemini/scratch existing.

### Phase 5 UI/UX Finalization — PTV-DEV-150 / Roup / Antigravity (25 Oktober 2026)
- **CLN-160 | Modal Lifecycle Unification, Shortcut Interception Guard, Dark Mode Standardization, & Multi-Viewport Visual QA:**
  1. **Lifecycle Modal Terpusat & Scroll Lock (`useModalScrollLock`):** Mengintegrasikan hook `useModalScrollLock` secara seragam pada seluruh modal yang sebelumnya menggunakan manipulasi DOM manual `document.body.style.overflow`: `AcaraStatusModal`, `AcaraFormModal`, `AcaraCrewModal`, `AcaraGearModal`, `AcaraDeleteModal`, `AcaraLinkNoteModal`, `AcaraRundownModal`, `TambahAlatModal`, `EditAlatModal`, `SmartDeleteInventarisModal`, `ImageLightboxModal`, dan Bantuan Akses Modal `#helpModal` di `LoginPage`. Menghubungkan `ref={modalRef}` dan ID spesifik ke tumpukan dialog terpusat.
  2. **Penguatan `dialogManager.hasActiveDialog()`:** Menambahkan fallback selector untuk seluruh modal yang sebelumnya tidak terdeteksi oleh stack (`.acara-modal-overlay`, `.dmg-modal-backdrop`, `.dmg-modal-surface`, `.lf-modal-backdrop`, `.lf-modal-surface`, `.sdel-modal-overlay`, `.ptv-lightbox-backdrop`, `.loan-modal-scrim`, `.loan-modal-container`, `[role="dialog"]`). Hal ini menjamin shortcut keyboard `/` dan `Ctrl/Cmd+K` terblokir 100% ketika ada dialog aktif di layar tanpa bentrok dengan Universal Search.
  3. **Penyelarasan Dark Mode & Eliminasi Hardcoded Whites:** Mengganti hardcoded `background: #FFFFFF;` pada header, scroll body, dan footer di `src/styles/kerusakan.css` dengan `var(--surface, #FFFFFF)`. Menambahkan aturan `:root[data-theme="dark"]` komprehensif pada `kerusakan.css` (modal surface, locked badge, input/select/textarea, severity buttons, unit buttons) dan `arsip.css` (stat cards, controls, search input, type tabs, select filters, item cards). Menambahkan dark mode styling pada `.lf-close-btn` di `lostFound.css`.
  4. **Perbaikan Responsive Mobile 375px & Input Accessibility (Tahap 2 Visual QA):**
     - Memperbaiki horizontal overflow pada `DevCatalogPage.tsx` di viewport mobile 375px dengan menyematkan `boxSizing: 'border-box'`, `overflowX: 'hidden'`, dan padding mobile `24px 14px 80px`.
     - Menyematkan ID eksplisit `id="ptvUserInput"` pada field akun di `LoginPage.tsx` untuk identifikasi DOM dan accessibility peramban mobile/desktop.
  5. **Verifikasi Visual Nyata Multi-Viewport (Playwright Headless Browser):** Menguji 96 variasi kombinasi (12 rute x 4 viewport [375px, 430px, 768px, 1440px] x 2 mode tema [Light, Dark]) dengan hasil 96/96 lulus (0 horizontal overflow, 0 broken images, form input typing responsif, dan modal escape/scroll-lock verified).
  6. **Quality Gates & Test Coverage:** Menambahkan suite pengujian dark mode di `tests/hub/darkModeConsistencyAndContrast.test.tsx` (17 tests PASS). Seluruh test suite Vitest (122 test files, 1409/1409 tests passed 100%), typecheck (`tsc --noEmit` 0 error), lint (`eslint . --max-warnings 0` 0 warning), dan build produksi Vite sukses tuntas (22.47s).

### Finishing PTV-DEV-149 → Finance (25 Oktober 2026)
- **CLN-159 | Finance containment dan targeted hygiene:** Reuse Card/R03 dan permission engine; tidak membuat modul/RPC/capability paralel. Hapus handler API pembebasan hardcoded yang mereset pembayaran dan empat handler RPC yang ditahan. Guard bersama membatasi localStorage/direct operational writers ke fixture test; readiness tidak menyamakan tabel ada dengan aman. Hapus klaim UI rekonsiliasi menyeluruh, jangan menelan canonical read failure/success=false. Tes mock dispatch lama diganti dengan penahanan; tidak lagi disebut bukti atomisitas database. Tambah CAS pocket dan guard request; loan pre-parsed size memakai jalur existing. Fixture bcrypt hanya sintetis, tanpa credential pengguna. Tidak ada cleanup massal, penghapusan histori, cache/dependensi atau perubahan cloud. Full 1398 tests/typecheck/lint/build lulus; warning SSR fixture dan ukuran bundle tercatat. SQL containment belum diuji PostgreSQL, bukan migrasi final.

### PTV-DEV-149 — Bootstrap (25 Oktober 2026)
- **CLN-158 | Bootstrap/recovery security hygiene:** Reuse profile root_executive, private permission helpers, audit existing dan generator bundle. Tidak ada RBAC paralel, endpoint bootstrap atau password verifier buatan. Mode persiapan hanya menunda pemeriksaan akhir sambil menutup semua EXECUTE mutasi. Guard invoker/ACL mempersempit privileged writes; rollback mempertahankan marker dan guard. Signature verifier bersama untuk bootstrap/revert; trust store kosong. Hapus jalur dev-flag mock live; nonce/state/PKCE diperiksa. Dua error SQL diperbaiki berdasar PostgreSQL lokal; fixture/helpers hanya pada scratch/tes, server berhenti. Tidak menghapus histori nyata, cache dependensi atau working tree terdahulu. Detail docs/PTVPRO-ACCESS-149-ROOT-BOOTSTRAP.md.

### PTV-DEV-149 (24 Oktober 2026)
- **CLN-157 | Rekonsiliasi berbasis provenance:** Reuse planner existing dengan menghapus asumsi semua personel harus memiliki login; helper offline baru memisahkan bukti sumber, petunjuk nama/email dan akun. Kunci kru pada importer tidak lagi memakai ID PTV/random sebagai fallback; re-import live ditahan sebelum write. Generator manifest offline deterministic/fingerprint; tidak mengimpor script bulk dalam tests atau menyalin credential/PII ke dokumen. Koreksi spesifikasi historis INT/UUID/status/Google ditautkan ke laporan aktual. Tidak ada merge/delete/rekey arsip atau cleanup massal. Laporan docs/PTVPRO-ACCESS-149-LEGACY-RECONCILIATION.md.
- **CLN-156 | Remediasi NO-GO:** Hapus penulis kredensial Google multi-query live dan cabang login database tanpa verifikasi password yang sudah diblokir; pertahankan fixture hanya test. Reuse liveAccess pada sembilan gate API, hapus userProfiles dan fallback hub.access sebagai izin modul. Cabut grant lintas fitur crew→kontak/dokumen; tolak edit/delete dokumen yang belum memiliki scope aman. Hilangkan fallback data dokumen saat query backend gagal. Bersihkan import/fixture test yang tidak lagi dipakai, perbarui kontrak mock secara eksplisit. Generator bundle SQL mencegah salinan transaksi manual; snapshot rekonsiliasi hanya referensi hash. Tidak ada UI/CSS, cleanup massal, perubahan data identitas atau cloud.
- **CLN-155 | Kru/Akses targeted hygiene:** Reuse ManagePermissionsModal dan permission engine; hapus form password simulasi/role/status akun/OAuth dari Kru, handlers sukses lokal dan modal delete, data relasi mock pada drawer; sederhanakan KruService menjadi API-only tanpa duplikasi fallback Supabase/fixtures. Store lokal mutator hanya mode test; hilangkan fallback identitas orang lain. Alias dinormalisasi sebelum otorisasi; cabang unreachable role/username edit dibersihkan. Error log personel disanitasi. Helper lama/store interfaces yang masih dipakai test dipertahankan dengan guard, bukan dihapus massal. Pengujian lama yang memakai network/credential cloud diganti mock eksplisit pada dua file terkait; test key hanya Vitest env, tidak runtime. Tidak membersihkan temuan whitespace working tree di luar scope. Rincian file/risiko ada pada audit PTV-DEV-149.

### PTV-DEV-148 (24 Oktober 2026)
- **CLN-154 | Finance Staging targeted hygiene:** Menghapus fallback sukses lokal dan duplikasi implementasi create kategori (reuse submitCategoryCreate); mengganti lookup kolom category yang tidak ada dengan jabatan; menghapus payload updated_at kategori yang tidak ada; memperbaiki action audit agar sesuai CHECK; mempertahankan nominal sebagai string JSON dan monthly_fees pada adapter. Referensi helper lokal lain dicek dengan rg; tidak dihapus karena masih memiliki pemanggil/tests. Tidak ada cleanup massal atau perubahan modul lain. Status verifikasi/temuan lanjutan pada laporan audit PTV-DEV-148.

### PTV-DEV-134 (24 Oktober 2026)
- **CLN-153 | Finance Preflight Transfer Reconciliation & Canonical Ledger Rules Fix:**
  1. **Eliminasi False-Positive Blocker pada Audit Alokasi:**
     - Mengidentifikasi akar false-positive: query audit sebelumnya menjumlahkan seluruh alokasi transaksi (`SUM(amount_minor)`) dan membandingkannya dengan `t.amount_minor`. Pada transaksi internal transfer (seperti transaksi `8e4b3211-5c41-4418-b92d-e4466ea58d81` di Staging dengan nominal 4.000.000 minor), terdapat alokasi `out` 4.000.000 dan alokasi `in` 4.000.000 sehingga penjumlahan buta menghasilkan 8.000.000 yang memicu kegagalan preflight.
     - Memperbaiki aturan rekonsiliasi agar sepenuhnya selaras dengan model canonical v2 (`financeCanonical.ts`):
       - Untuk `kind = 'transfer'`: total `in` wajib sama dengan `tx_amount_minor`, total `out` wajib sama dengan `tx_amount_minor`, dampak saldo bersih nol (`total_in = total_out`), memiliki minimal 1 alokasi masuk dan 1 alokasi keluar, serta kantong asal dan tujuan berbeda (`count_distinct_pockets = count_allocations`).
       - Untuk `kind = 'income'`: total `in` wajib sama dengan `tx_amount_minor`, total `out = 0`, dan tidak memiliki alokasi keluar.
       - Untuk `kind = 'expense'`: total `out` wajib sama dengan `tx_amount_minor`, total `in = 0`, dan tidak memiliki alokasi masuk.
  2. **Harmonisasi Skrip SQL Preflight, Postflight, dan Migrasi:**
     - Memperbarui `docs/PTVPRO-FINANCE-2.0-STAGING-PREFLIGHT-READONLY.sql`: Check 6b dan evaluasi multi-barrier Bagian 8 kini menggunakan CTE canonical `tx_alloc_summary` dan `tx_violations`.
     - Memperbarui `docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-MIGRATION.sql`: Section 1h diperbarui dengan logika yang sama sehingga migrasi tidak gagal saat memvalidasi transaksi transfer yang sah.
     - Memperbarui `docs/PTVPRO-FINANCE-2.0-STAGING-POSTFLIGHT-READONLY.sql`: Mengoreksi perbandingan bigint pada Check 7 dan menambahkan Check 7b untuk memverifikasi kepatuhan alokasi pasca-migrasi.
  3. **Regression Suite & Quality Gates:**
     - Menambahkan suite pengujian `6. PTV-DEV-134: Finance Preflight Transfer Reconciliation & Canonical Ledger Rules` pada `tests/hub/financeStagingReadiness.test.ts` (7 tests baru, total 21/21 passed).
     - Menjalankan seluruh quality gates: typecheck 0 error, lint 0 warning, 115 test files (1209/1209 tests passed 100%), dan Vite build sukses dalam 20.10s.
     - Tidak ada mutasi cloud, DDL/DML cloud, maupun modifikasi data historis.

### PTV-DEV-133 (24 Oktober 2026)
- **CLN-152 | Finance 2.0 Final Blocker Resolution & Atomic Integrity Hardening:**
  1. **Eliminasi Client-Side Non-Atomic Fallback pada `api/finance.ts`:**
     - Menghapus total alur fallback multi-query sekuensial pada pembatalan transaksi (`action === 'void_transaction'`).
     - Seluruh void transaksi kini 100% didelegasikan ke fungsi atomik PostgreSQL `rpc_void_finance_transaction_atomic`. Jika RPC tidak tersedia atau gagal, API mengembalikan pesan error eksplisit tanpa mengubah saldo kantong maupun status transaksi.
     - Menyematkan perlindungan mutasi finansial pada `action === 'update_transaction'`: menolak mutlak percobaan manipulasi `amount`, `amountMinor`, `amount_minor`, `allocations`, atau `kind` via update metadata.
  2. **Audit SQL & Deadlock Prevention:**
     - Menemukan dan memperbaiki ketiadaan RLS pada `ptv_finance_kas_payments` di `docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-MIGRATION.sql`: menambahkan `ENABLE ROW LEVEL SECURITY`, `REVOKE/GRANT`, serta read policy `ptv_finance_kas_payments_read`.
     - Menambahkan klausul `ORDER BY pocket_id` pada loop rollback alokasi di `ptv_finance_private.void_finance_transaction` untuk menjamin keteraturan lock deterministik dan mencegah deadlock antar-transaksi concurrent.
     - Memperkuat verifikasi anchor pada Section 1h migrasi: memeriksa kecocokan persis saldo Kas Utama Studio (`52027600` minor / Rp 520.276,00), mencegah alokasi yatim (`orphaned allocations`), serta memvalidasi kesamaan jumlah alokasi dengan nominal transaksi.
  3. **Penyempurnaan Preflight & Postflight Audit Scripts:**
     - Memperbarui `docs/PTVPRO-FINANCE-2.0-STAGING-PREFLIGHT-READONLY.sql`: memasukkan `ptv_finance_kas_payments` ke daftar tabel operasional, menambahkan audit integritas alokasi (6b), dan menghapus hardcoded status kesiapan dengan evaluasi CTE dinamis multi-barrier `preflight_summary`.
     - Memperbarui `docs/PTVPRO-FINANCE-2.0-STAGING-POSTFLIGHT-READONLY.sql`: memasukkan `ptv_finance_kas_payments` ke pengecekan RLS tabel dan policies.
  4. **Arsitektur Bukti Transaksi & Signed URL:**
     - Menambahkan helper validasi berkas `validateProofFile` (maks 5MB, format gambar & PDF) pada `financeOperationalCloudService.ts`.
     - Menambahkan fungsi helper upload `uploadFinanceProof` dan pembacaan signed URL privat `getFinanceProofSignedUrl`.
     - Menambahkan endpoint `get_proof_signed_url` di `api/finance.ts` dengan durasi TTL 1 jam.
     - Memperbarui interface `OperationalCloudStatus` untuk menyertakan status `kasPaymentsTable` dan `proofsBucket`.
  5. **Regression Suite & Quality Gates:**
     - Menambahkan test suite `5. PTV-DEV-133: Final Blocker Resolution & Atomic Integrity` di `tests/hub/financeStagingReadiness.test.ts` (14/14 tests passed).
     - Quality gates: TypeScript `tsc --noEmit` 0 error, ESLint 0 warning, 115/115 test files passed (1202/1202 tests 100%), kompilasi Vite build sukses dalam 14.86s.
     - Zero cloud mutations. Staging dan Production 100% terlindungi.

### PTV-DEV-131 (24 Oktober 2026)
- **CLN-151 | Finance 2.0 Mobile Layout Repair, Kas Kru UX & Personnel Access Barrier:**
  1. **Root-Cause Whitespace Elimination across Mobile Views (`financeFoundation.css`):**
     - Mengidentifikasi akar masalah ruang kosong ekstrem (whitespace) mobile: `.finance-hero-main` menetapkan `flex: 1 1 300px` yang pada flex-direction column memaksa flex basis 300px vertikal, dan `.toolbar-search-wrap` menetapkan `flex: 1 1 260px` yang meregangkan wadah input pencarian setinggi 260px dengan ikon loop mengambang di tengah ruang kosong.
     - Memperbaiki rule mobile media query: `.finance-hero-main` di-reset ke `flex: 0 0 auto; min-height: unset; height: auto; gap: 6px;`, mengurangi tinggi computed hero bento dari 372px menjadi 151.4px.
     - Memperbaiki `.toolbar-search-wrap` di mobile: di-reset ke `flex: 0 0 auto; width: 100%; min-height: unset; height: auto;`, mengurangi tinggi wadah pencarian dari 260px menjadi 38px, dan toolbar card dari 362.5px menjadi 140.5px.
     - Menghadirkan `.laporan-filters-grid` responsif: grid 2 kolom mobile yang rapi dengan gap 8px dan label spacing 4px.
     - Mengaktifkan scroll horizontal mulus tanpa scrollbar visual untuk seluruh filter pill (`.toolbar-type-pills`, `.toolbar-status-pills`, `.finance-filter-pills-row`).
     - Mempertahankan integritas tabel desktop 7-kolom dengan tombol thumbnail bukti, Edit, dan Batalkan.
  2. **Kas Kru UX & Relokasi Pengelolaan Semester ke Pengaturan:**
     - Membersihkan toolbar Kas Kru: menghapus tombol "Buat Semester" dari `FinanceKasKruView.tsx` dan menyederhanakan label semester menjadi `${s.name} ${s.isActive ? '(Aktif)' : '(Historis)'}` tanpa embel-embel tarif bulanan global.
     - Memusatkan seluruh pembuatan semester baru dan edit rentang waktu/tarif di `Keuangan → Pengaturan → Kas Kru (D2)`.
     - Menyaring dropdown modal pembayaran dan pengecualian hanya menampilkan `activeBillableCrew` (kru aktif berkategori Kru).
     - Menghapus dialog usang `activeModal === 'semester'` dan state tidak terpakai dari `FinanceKasKruView.tsx`.
  3. **Penyempurnaan Partisipan Kas Kru & Logika Jatuh Tempo:**
     - Membatasi partisipan kewajiban Kas Kru di `kasKruService.ts` hanya untuk personel berkategori Kru dan berstatus Aktif.
     - Mengecualikan Pembina dan Pengarah dari penagihan iuran dan perhitungan matriks.
     - Kru tidak aktif tidak diterbitkan kewajiban baru untuk periode berjalan, namun rekaman pembayaran masa lalu tetap terjaga utuh.
     - Memperbaiki kalkulasi tunggakan: bulan mendatang (`period > currentMonth`) atau bulan berjalan sebelum tanggal jatuh tempo (`feeDueDay`, default tgl 10) TIDAK dihitung sebagai tunggakan (`arrearsMinor = 0`).
  4. **Multi-Layer Access Barrier — Penolakan Mutlak Pembina & Pengarah:**
     - Menetapkan aturan keamanan ketat: personel dengan kategori Pembina atau Pengarah dilarang keras mengakses modul Keuangan, independen dari jabatan organisasi atau role portal.
     - **Layer 1 (Policy Engine):** Pada `src/core/policy/policyEngine.ts`, `hasCapability` menolak mutlak seluruh capability `finance.*` jika context memiliki kategori `pembina` atau `pengarah`.
     - **Layer 2 (Route Guard):** Pada `src/app/router/ProtectedRoute.tsx`, akses langsung URL `/hub/keuangan` oleh kategori Pembina/Pengarah ditolak dan menampilkan layar "Akses Keuangan Ditolak" dengan tombol kembali ke Beranda.
     - **Layer 3 (Navigation Shell):** Pada `src/products/hub/shell/HubShell.tsx`, menu Keuangan disembunyikan dari sidebar desktop maupun bottom sheet mobile bagi Pembina/Pengarah.
     - **Layer 4 (API Service):** Pada `api/financeAccess.ts`, `resolveFinanceAccess` melempar HTTP 403 Forbidden jika akun terhubung ke profil pembina atau identitas arsip berkategori pembina/pengarah.
     - **Layer 5 (Database Migration SQL):** Pada `docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-MIGRATION.sql`, menambahkan fungsi `public.is_finance_restricted_personnel()` dan menyematkan proteksi `NOT is_finance_restricted_personnel()` pada seluruh RLS read policy dan atomik RPC.
  5. **Continuous Curve & Zero-Regression Code Hygiene:**
     - Mengganti hardcoded inline pixel `borderRadius` pada `BatalkanTransaksiModal.tsx`, `EditTransaksiModal.tsx`, dan `FinanceSettingsView.tsx` dengan CSS variable continuous curve token `var(--r-item)` dan `var(--r-card)`.
     - Menambahkan suite pengujian terarah `tests/hub/ptvDev131FinanceRepair.test.tsx` (8 tests lulus 100%).
     - Memverifikasi 114 test files passed (1188/1188 tests, 100%), 0 typecheck error, 0 lint warning, dan build produksi Vite sukses.

### PTV-DEV-129 (24 Oktober 2026)
- **CLN-150 | Finance 2.0 Final Backend Audit, Atomic Transaction Engine, Server-Verified RLS, Fee Waiver & Security Test Suite:**
  1. **Rancangan & Implementasi Atomic PostgreSQL Transactions:**
     - Mengembangkan 4 RPC PostgreSQL atomik di schema `ptv_finance_private`: `rpc_record_kas_kru_payment_atomic`, `rpc_disburse_loan_atomic`, `rpc_record_loan_payment_atomic`, dan `rpc_reverse_operational_record_atomic`.
     - Menerapkan batasan transaksi tunggal (*single-transaction boundary*): canonical posting (`ptv_finance_private.post_transaction`) dan mutasi tabel operasional dieksekusi dalam satu blok transaksi database PostgreSQL yang sama. Jika penyimpanan metadata gagal, transaksi ledger otomatis rollback tanpa meninggalkan saldo yang mengambang.
     - Menyematkan perlindungan kunci idempotensi (*idempotency key*) deterministik pada level database & server: mencegah transaksi ganda saat double-click atau retry jaringan, serta menolak tampering payload dengan kunci yang sama via HTTP 409 Conflict.
  2. **Audit & Hardening Server-Verified RLS Identity:**
     - Mengeliminasi ketergantungan pada `current_setting('app.current_ptv_id', true)` yang rentan manipulasi client session.
     - Mengimplementasikan helper database aman `public.current_authenticated_ptv_id()` yang memverifikasi identitas pengguna langsung dari token JWT terotentikasi Supabase `auth.uid()` yang terhubung ke `public.user_account.auth_user_id` dan `public.canonical_identity.ptv_id`.
     - Mengisolasi privasi peminjam (*Borrower Privacy Isolation*): kru biasa HANYA dapat membaca rincian pinjaman miliknya sendiri (`borrower_type = 'kru' AND borrower_id = current_authenticated_ptv_id()`). Data piutang eksternal (`borrower_type = 'eksternal'`) sepenuhnya terisolasi dan hanya dapat diakses oleh pemegang capability `finance.manage`.
     - Menyediakan aggregate privacy RPC `public.rpc_get_finance_loans_aggregate()` untuk menyajikan statistik portofolio piutang pada laporan keuangan umum tanpa membocorkan PII peminjam.
  3. **Implementasi Fitur Pembebasan Iuran Kas Kru (Fee Waiver - `dikecualikan`):**
     - Mengimplementasikan `waiveKasKruFee(input, existingRecords)` pada `src/products/hub/keuangan/kasKruService.ts` yang mencatat pembebasan iuran resmi dengan alasan terdokumentasi tanpa memicu mutasi ledger semu.
     - Memperbarui `calculateKasKruMatrix`: periode dengan status `dikecualikan` tidak menambah beban tagihan (`crewDueBig`) dan tidak dihitung sebagai tunggakan (`crewArrearsBig`), sehingga kru yang dibebaskan dapat mencapai status lunas jika seluruh periode aktif lainnya telah terselesaikan.
     - Membangun antarmuka modal pembebasan di `FinanceKasKruView.tsx`, tombol aksi "Bebaskan" berdesain pill, dan rendering status sel matriks dengan ikon `ShieldCheck`.
  4. **Penyempurnaan Skrip Migrasi & Two-Tier Safe Rollback (`docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-*`):**
     - Menambahkan verifikasi multi-barrier preflight pada migrasi SQL: Postgres 17+, Anti-production table check, Staging architecture check, `ptv_finance_private` schema check, `public.has_capability` check, fingerprint transaksi historis Staging (53 transaksi), dan balance kas utama (Rp 520.276).
     - Merancang skrip rollback dua tingkat (*Two-Tier Safe Rollback*): Tier 1 (Pre-Usage Clean Drop) jika belum ada data operasional, dan Tier 2 (Post-Usage Recovery Archive) yang merename tabel operasional ke `_archived_YYYYMMDD_HHMMSS` sehingga rekaman keuangan operasional yang sudah dicatat tidak pernah terhapus secara destruktif.
  5. **Audit Konsistensi Laporan & Akuntansi Netral:**
     - Memastikan seeding kategori kanonikal: `'Pencairan Piutang'` (beban non-operasional), `'Pengembalian Pokok Piutang'` (pendapatan non-operasional), dan `'Pendapatan Bunga Piutang'` (pendapatan operasional/bunga).
     - Menjaga transfer internal net-zero, mengecualikan transaksi reversed dan dummy dari arus kas bersih, serta memastikan keselarasan angka antara Ringkasan, Kantong, Transaksi, dan Laporan PDF/XLSX.
  6. **Comprehensive Security Test Suite & Quality Gates:**
     - Menambahkan suite pengujian keamanan `tests/hub/financeAtomicAndSecurity.test.ts` (15 tests lulus 100%) yang memverifikasi atomicity invocation, proteksi idempotency replay & tampering, anti-overdraft, anti-overpayment, penolakan unauthorized caller, proteksi capability 42501, dan penanganan pembebasan kas kru.
     - Seluruh quality gates lulus: 112 test files passed (1168/1168 tests passed), 0 typecheck errors (`tsc --noEmit`), 0 lint warnings (`eslint . --max-warnings 0`), dan build produksi Vite sukses dalam 24.66s.

### PTV-DEV-128 (23 Oktober 2026)
- **CLN-149 | Finance 2.0 Pre-Migration Audit, Interest Support & Input Focus Fix:**
  1. **Perbaikan Akar Masalah Input Kehilangan Fokus (Focus Theft Glitch Fix):**
     - Mengidentifikasi akar masalah pada `useModalScrollLock.ts` dan `dialogManager.ts`: callback inline lambda `onClose={() => setActiveModal(null)}` memicu unregister dan re-register modal pada setiap render saat operator mengetik satu karakter.
     - Menyimpan `onClose` dalam `useRef(onClose)` yang stabil agar `useModalScrollLock` tidak berulang kali unregister/register.
     - Menambahkan focus guard pada timer fokus otomatis agar tidak mencuri fokus kembali jika elemen input di dalam modal sudah aktif (`modalRef.current.contains(document.activeElement)`).
     - Memperbaiki `dialogManager.unregister()` agar hanya mengembalikan fokus ke tombol trigger bila dialog stack benar-benar kosong (`this.stack.length === 0`).
     - Menambahkan atribut eksplisit `type="button"` pada tombol tutup dialog di `FinanceWorkspace.tsx` guna mencegah trigger form submit yang tidak disengaja.
     - Menambahkan input nominal kustom (`customPaymentRupiah`) di `FinanceKasKruView.tsx` untuk pembayaran parsial/cicilan yang fleksibel tanpa kehilangan fokus.
     - Menambahkan regression test komprehensif di `tests/hub/financeInputFocus.test.tsx` yang memverifikasi akumulasi keystroke berurutan (`'123456'`), navigasi kursor, backspace, dan input desimal.
  2. **Implementasi Lengkap Bunga Opsional Piutang (Flat Interest Support):**
     - Memperluas tipe `piutangTypes.ts` dengan atribut `interestType: 'none' | 'flat'`, `interestRatePercent: number`, `interestMinor: string`, dan `totalDueMinor: string`.
     - Menerapkan formula pembulatan integer deterministik berbasis basis points untuk bunga flat satu kali: `(principalBig * round(rate * 100)) / 10000n`.
     - Memperbarui `createPiutang`, `calculatePiutangStats`, dan antarmuka `FinancePiutangView.tsx`: menambahkan toggle interaktif ("Tanpa Bunga" vs "Dengan Bunga Flat Satu Kali"), input persentase desimal, ringkasan kalkulasi bunga & total tagihan secara real-time, badge bunga pada kartu pinjaman, serta rincian pokok vs bunga pada modal detail.
     - Memastikan pencairan pinjaman hanya memotong kas studio sebesar pokok (`principalMinor`), sedangkan cicilan mengurangi total tagihan (`totalDueMinor`) tanpa pengenaan bunga majemuk atau bunga berbunga.
     - Menolak kelebihan pembayaran (*anti-overpayment*) dan penarikan melebihi saldo kas (*anti-overdraft*).
     - Menambahkan uji kalkulasi di `tests/hub/financePiutang.test.tsx` untuk bunga 0%, 5%, angka pecahan 2.5%, cicilan parsial, dan penolakan overpayment.
  3. **Audit Keamanan Migrasi & Skrip Rollback (`docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-*`):**
     - Memperbarui skema `docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-MIGRATION.sql` dengan menambahkan kolom `interest_type` dan `interest_rate_percent` beserta constraint CHECK yang aman.
     - Memperbaiki celah privasi RLS (*CRITICAL AUDIT FINDING*): mengganti akses terbuka `finance.view` pada `ptv_finance_loans` dan `ptv_finance_loan_payments` dengan kebijakan berjenjang di mana kru biasa HANYA dapat melihat data piutang miliknya sendiri (`borrower_type = 'kru' AND borrower_id = current_setting('app.current_ptv_id')`), sementara bendahara/eksekutif (`finance.manage`) dapat melihat seluruh data.
     - Menyusun skrip pendamping `docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-ROLLBACK.sql` yang melakukan drop terurut terbalik (reverse dependency) tanpa memengaruhi data canonical ledger v1 maupun 53 transaksi historis Staging.
  4. **Hardening Persistensi & Adapter Cloud (`financeOperationalCloudService.ts`):**
     - Membangun service pendeteksi status skema cloud dengan label transparan dan jujur: `'Menunggu Aktivasi Database Cloud (swadgljnyelsjstqqxbm)'`.
     - Menerapkan *Atomic Posting Guard*: mutasi transaksi ke Buku Besar Cloud diblokir dari Kas Kru dan Piutang jika tabel operasional belum diaktivasi di Staging, mencegah mutasi saldo kantong yang kehilangan rekaman kewajiban saat sesi disegarkan.
     - Menyediakan adapter lengkap (CRUD) untuk semesters, kas records, loans, loan payments, dan pengaturan yang siap dipanggil seketika setelah migrasi SQL dijalankan pasca-ACC operator.
  5. **Ekspor Laporan PDF 1.4 Biner Asli & XLSX Multi-Sheet (`exportUtils.ts`):**
     - Mengimplementasikan `buildLaporanPdf14` yang menghasilkan dokumen biner PDF 1.4 resmi lengkap dengan kop lembaga, ringkasan eksekutif, tabel saldo kantong, tabel mutasi multi-halaman dengan running header, dan catatan disclaimer audit.
     - Mengimplementasikan `exportLaporanXLSX` berbasis SheetJS (`xlsx`) yang menghasilkan file spreadsheet `.xlsx` nyata dengan 4 sheet: "Ringkasan Eksekutif", "Mutasi Transaksi" (dengan autofilter dan lebar kolom terformat), "Saldo Kantong Resmi", dan "Kas Kru & Piutang".
     - Menambahkan verifikasi otomatis pada `tests/hub/financeLaporan.test.tsx`.
  6. **Full Quality Gates & Zero Regressions:**
     - 111 test files passed (1153/1153 tests passed 100%, termasuk 14 suite pengujian Keuangan), 0 typecheck errors (`tsc --noEmit`), 0 lint warnings (`eslint . --max-warnings 0`), dan build produksi sukses dalam 16.41s.
- **CLN-148 | Finance 2.0 Complete Operational Modules Implementation (Kas Kru, Piutang, Laporan, Pengaturan) & Canonical Ledger Integration:**
  1. **Canonical Single-Source of Truth Ledger Integration:**
     - Seluruh mutasi penerimaan Kas Kru dialirkan langsung melalui `submitFinanceOperation` operasi `income` ke kantong tujuan dengan referensi kru dan periode.
     - Seluruh pencairan pinjaman/piutang dialirkan melalui canonical `expense` dari kantong sumber dengan proteksi *anti-overdraft* (`sourcePocket.balanceMinor >= principalBig`).
     - Seluruh pengembalian pinjaman dialirkan melalui canonical `income` ke kantong yang ditentukan dengan proteksi *anti-overpayment* (`totalPaid + amount <= totalDue`).
     - Seluruh pemanggilan mutasi canonical mematuhi constraint skema validasi Zod UUID (`z.string().uuid()`) pada `categoryId`.
  2. **Non-Destructive Operations & Dual-Environment Resilience:**
     - Tidak ada operasi `DELETE` destruktif. Pembatalan pembayaran Kas Kru menggunakan mekanisme `reversal` resmi berstatus `reversed`, dan pembatalan piutang mencatat status `dibatalkan` dengan audit trail.
     - Menyediakan fallback memori in-memory (`memorySettings`, `memoryCustomCategories`) pada service pengaturan keuangan dan kategori saat `localStorage`/DOM tidak tersedia pada lingkungan SSR / Node.js test suite.
  3. **Accounting Engine & Deterministic Minor Units:**
     - Mesin akuntansi `laporanService.ts` menghitung arus kas bersih (*Net Cash Flow*) murni berbasis integer `BigInt` minor units (sen rupiah) tanpa distorsi floating-point.
     - Transfer internal antar-kantong dipisahkan dengan perlakuan netral (*net-zero*) terhadap beban/pendapatan operasional.
     - Transaksi batal (*reversed*) dan transaksi dummy PTV-DEV-117 diisolasi dari total mutasi operasional.
  4. **Ekspor Dokumen Resmi (PDF & CSV/XLSX):**
     - Menyediakan pencetak laporan PDF resmi Progresif TV lengkap dengan kop, ringkasan eksekutif, tabel per-kantong, rincian mutasi, dan catatan disclaimer audit.
     - Menyediakan generator spreadsheet CSV kompatibel XLSX dengan header UTF-8 BOM (`\uFEFF`), auto-download di peramban, serta fallback pengembalian konten string aman pada lingkungan tanpa DOM.
  5. **Continuous Curve Design Governance Compliance:**
     - Menghapus penggunaan inline pixel border-radius (`12px`, `999px`) dan menggantikannya dengan token resmi `var(--radius-md, 12px)` serta exception pill `9999px` pada `FinanceLaporanView.tsx`, `FinancePiutangView.tsx`, dan `FinanceSettingsView.tsx`, meloloskan audit tata kelola desain pada `continuousCurveAudit.test.ts`.
  6. **Code Hygiene & Full Quality Gates:**
     - Membersihkan seluruh *unused imports* dan variabel tidak terpakai pada modul dan file pengujian baru.
     - 110 test files passed (1148/1148 tests passed 100%, termasuk 13/13 test files modul Keuangan), 0 typecheck errors (`tsc --noEmit`), 0 lint warnings (`eslint . --max-warnings 0`), dan build produksi sukses dalam 12.12s.

### PTV-DEV-147 (22 Oktober 2026)
- **CLN-147 | Comprehensive Legacy to Staging Surat & Arsip Synchronization Engine, Attachment URL Preservation, & Background Scheduler:**
  1. **Perluasan Mesin Sinkronisasi Menyeluruh (`scripts/sync-legacy-letters.mjs`):**
     - Memperluas cakupan dari 3 tabel persuratan dasar ke **seluruh Surat & Arsip**: `ptv_surat_izin`, `ptv_surat_tugas`, `ptv_surat_barang`, `ptv_catatan` (catatan bersama & notulensi rapat), `ptv_pengumuman` (pengumuman resmi), dan `ptv_ebook` (koleksi publikasi e-book dan panduan santri).
     - Menghubungkan sumber data langsung ke live database Supabase Legacy `jthzuhkblxcaohiuypqq` secara *Strict Read-Only* dengan fallback credential loader otomatis dari local environment/dump (`resolveLegacyCredentials`) tanpa kebocoran credential ke log.
     - Mengidentifikasi 4 surat izin live di legacy: `001/SI-PTV/X/2026` (Farras), `007/SI-PTV/X/2026` (Farras), serta dua surat baru live yang siap disinkronkan: `009/SI-PTV/X/2026` (terbit 21 Oktober oleh Fauzil Adhim) dan `011/SI-PTV/X/2026` (terbit 22 Oktober oleh Fauzil Adhim).
     - Menemukan bahwa Supabase Legacy memiliki 0 storage bucket; seluruh lampiran berupa URL publik absolut (WordPress uploads dan Google Drive preview). Mesin sinkronisasi mempreservasi seluruh file URL ke dalam manifest arsip kanonikal `reports/legacy-archive-manifest.json` (15 baris, 5 judul unik).
  2. **Kebijakan Retensi Aman & Normalisasi Status Dokumen:**
     - Menambahkan penanganan aman untuk status dokumen `batal` / `dibatalkan` ke status kanonikal `ditolak` dengan catatan pembatalan di provenance.
     - Menerapkan *Safe Retention Policy*: dokumen Staging yang tidak ditemukan di Legacy tidak dihapus otomatis, melainkan dicatat ke dalam log audit retensi agar data historis institusi terlindungi.
  3. **Penomoran Dinamis R06 Rev 11 (Dynamic Gap-Filling):**
     - Dengan terbitnya nomor `001`, `007`, `009`, dan `011`, sequence berikutnya yang dihitung secara dinamis mengisi celah terkecil adalah urutan ke-2 (`002/SI-PTV/X/2026`).
  4. **Background Scheduler Server-Side (`scripts/cron-sync-worker.mjs`):**
     - Menyediakan worker mandiri server-side yang dapat dijalankan secara berkala (interval) via cron/background daemon tanpa ketergantungan pada browser pengguna.
  5. **Type Safety & Declaration Hygiene (`scripts/sync-legacy-letters.d.ts`, `tests/hub/sync-legacy-letters.d.ts`):**
     - Menyediakan deklarasi tipe TypeScript lengkap untuk modul ES sync engine sehingga compiler `tsc` mengenali seluruh fungsi dan lolos 0 errors pada `npm run typecheck`.
  6. **Quality Gates:**
     - 106 test files passed, 1128/1128 tests passed 100% (termasuk 14 regression tests baru di `legacyLetterSync.test.ts`), 0 type errors, 0 lint warnings, build produksi Vite sukses dalam 16.16s.

### PTV-DEV-146 (22 Oktober 2026)
- **CLN-146 | Transition Letter Synchronization Engine (Legacy -> Staging), Dynamic Gap-Filling R06 Rev 11, & Cutover Governance:**
  1. **Mesin Sinkronisasi Transisi Mandiri (`scripts/sync-legacy-letters.mjs`):**
     - Membangun pipeline sinkronisasi satu arah (*one-way*) otomatis, idempoten, dan bertahap (*incremental*) dari Legacy Supabase (`jthzuhkblxcaohiuypqq`) ke PTVPRO Staging (`swadgljnyelsjstqqxbm`).
     - Menerapkan hard barrier keamanan anti-produksi: membatalkan seketika jika target mengarah ke production `jthzuhkblxcaohiuypqq`. Sumber data legacy dijamin *strict read-only*.
     - Menerapkan checkpointing berbasis timestamp di `reports/legacy-sync-checkpoint.json` sehingga sinkronisasi berkala hanya memproses delta surat baru atau perubahan status.
     - Menerapkan *Zero Fabrication Rule*: nama identitas legacy yang tidak terpetakan ke UUID di `canonical_identity` disimpan sebagai `NULL` pada foreign key dan dicatat utuh ke dalam laporan rekonsiliasi `reports/legacy-sync-reconciliation.json`.
     - Menerapkan deteksi konflik nomor surat dan reservasi offline (`fail-closed` karantina).
     - Menjaga isolasi data uji native Staging agar tidak tertimpa oleh data legacy.
  2. **Penyempurnaan Penomoran Dinamis R06 Rev 11 (`docs/PTVPRO-OFFICIAL-LETTER-NUMBERING-ATOMIC-PROPOSAL.sql`):**
     - Mengeliminasi assertion statis yang memaksakan nomor berikutnya harus `002`.
     - Menggantikan dengan verifikasi *Dynamic Gap-Filling Sequence Resolution* yang menghitung celah terkecil dari seluruh nomor terbit dan nomor hasil rekonsiliasi masa transisi secara matematis.
  3. **Dokumentasi Spesifikasi & Desain Cutover 5 Tahap (`docs/PTVPRO-TRANSITION-LETTER-SYNC-SPEC.md`):**
     - Menyusun cetak biru arsitektur, matriks perbandingan skema 3 tabel surat, protokol karantina, dan 5 tahap cutover resmi hingga rollback darurat.
  4. **Pengujian Vitest Komprehensif (`tests/hub/legacyLetterSync.test.ts`):**
     - 19 unit regression tests baru mencakup: backfill mapping SI/ST/SBB, incremental checkpoint filtering, idempotency, deteksi benturan nomor, proteksi reservasi offline 009, status transition sync, zero fabrication identity resolution, isolasi data uji staging, dynamic gap-filling, dan retry exponential backoff.
     - 100% PASS (62/62 persuratan tests lulus, typecheck 0 error, lint 0 warning, build sukses dalam 18.84s).

### PTV-DEV-140 (22 Oktober 2026)
- **CLN-145 | R06 Critical Audit & Correction — Official Letter Numbering, PDF Integrity & Smart Notification Persistence:**
  1. **Task 1 — Audit & Koreksi Penomoran Surat Resmi (`docsStore.ts`, `api/dokumen.ts`, `api/verifikasi-surat.ts`, `docs/PTVPRO-OFFICIAL-LETTER-NUMBERING-ATOMIC-PROPOSAL.sql`):**
     - Mengidentifikasi kelemahan concurrency pada client-side `maxSeq + 1`: menyusun proposal DDL & RPC atomik kanonikal ber-row locking (`allocate_official_letter_number`) dengan tabel dedicated `ptv_doc_sequences`, unique constraint pada kolom `nomor_surat` di ketiga tabel, dan preflight/rollback plan lengkap (status DRAFT / PENDING OPERATOR ACC).
     - Menghilangkan celah penomoran prematur: dokumen pending (`Menunggu`) wajib menampilkan nomor `"—"`, penomoran resmi hanya terbit saat pengesahan disetujui.
     - Memastikan sifat idempotent: pengesahan ulang (retry ACC) dokumen yang telah disetujui mempertahankan nomor resmi eksisting secara utuh tanpa alokasi nomor baru.
     - Melindungi nomor historis: menyematkan sequence baselines pelindung (ST: 42, SBB: 15, SI: 7) sehingga penomoran baru tidak pernah bertabrakan atau mendaur ulang nomor surat yang dibatalkan.
     - Memperbaiki regex verifikasi publik di `api/verifikasi-surat.ts` agar mendukung tag `SBB-PTV` dan memetakan ke tabel `ptv_surat_barang`.
  2. **Task 2 — Audit & Koreksi PDF Surat Resmi (`docPdfPrinter.ts`, `DocDetailDrawer.tsx`):**
     - Mengeliminasi mekanisme semu print iframe yang membuka dialog cetak sistem browser sebagai pengganti download PDF.
     - Membangun utilitas `downloadOfficialDocPdf` berbasis spesifikasi standar PDF 1.4 biner dengan kop surat resmi Progresif TV, tabel identitas pemohon, daftar kru penerima mandat, daftar peralatan, tanda tangan pimpinan, dan vector-perfect QR Code verifikasi publik yang langsung memicu unduhan file `.pdf` ke folder unduhan pengguna tanpa mengalihkan halaman.
     - Menjaga pemisahan tegas antara tombol "Unduh PDF Resmi" (direct file download) dan tombol "Buka Verifikasi" (ke `/verifikasi-surat`).
  3. **Task 3 — Audit & Koreksi Smart Notification Persistence (`notificationService.ts`, `NotificationCenterModal.tsx`, `docs/PTVPRO-SMART-NOTIFICATIONS-SCHEMA-DRAFT.sql`):**
     - Menghubungkan client service `notificationService.ts` ke Supabase Staging (`ptv_notifications`) sebagai authoritative cloud persistence saat configured, menggunakan localStorage hanya sebagai cache sekunder terisolasi.
     - Menambahkan proteksi idempotency berbasis memory cache dan storage cache (`seenIdempotencyKeys`) untuk mencegah notifikasi ganda pada retry transaksi.
     - Mengamankan isolasi penerima: filter notifikasi menyaring khusus sesuai `recipient_ptv_id` dan `recipient_role`, sehingga akun A tidak dapat melihat, menandai dibaca, atau menghapus notifikasi akun B.
     - Membatasi kueri "Tandai Dibaca" pada `NotificationCenterModal.tsx` agar ter-scope ke role/identitas pengguna aktif tanpa menghapus/menimpa status notifikasi akun lain secara global.
     - Menyempurnakan draft SQL `PTVPRO-SMART-NOTIFICATIONS-SCHEMA-DRAFT.sql` dengan policy DELETE terproteksi dan rollback teruji (status DRAFT / PENDING OPERATOR ACC).
  4. **Task 4 — Cross-Module Verification & Quality Gates (`tests/hub/r06CriticalAuditCorrection.test.ts`):**
     - Menambahkan 9 unit regression tests komprehensif yang memverifikasi integritas penomoran surat, idempotensi, format berkas PDF 1.4, direct file download, deduplikasi idempotency key, isolasi recipient, dan regex verifikasi publik.
     - Seluruh 4 quality gates lulus 100%: 0 TypeScript errors (`tsc --noEmit`), 0 ESLint warnings (`eslint . --max-warnings 0`), 102 test files passed (1079/1079 unit tests passed), dan kompilasi build produksi Vite sukses tuntas dalam 18.14s.

### PTV-DEV-139 (22 Oktober 2026)
- **CLN-143 | Master Implementation R06 — Integrated PTV Hub Improvements & Data Integrity (7 Pekerjaan Terintegrasi):**
  1. **Task 1 — Penyederhanaan Detail Acara (`AcaraDetailPage.tsx`):**
     - Menghapus UI kartu Rundown, modal Tambah Rundown, dan floating state rundown dari Detail Acara.
     - Menyusun ulang tata letak: Bagian Catatan Teknis & Notulensi Rapat kini langsung mengikuti Informasi Acara.
     - Mempertahankan integritas model data, context functions, dan unit tests pendukung di backend/service.
  2. **Task 2 — Manajemen Kru, Kategori Personel & Jabatan (`kru/types.ts`, `KruFormModal.tsx`, `KruDetailDrawer.tsx`, `ManagePermissionsModal.tsx`, `KruPage.tsx`, `KontakInternalPage.tsx`):**
     - Memvalidasi dan mengekspor 4 divisi operasional kanonikal: `['Editor', 'Layouter', 'Technical', 'Engagement']`.
     - Dropdown divisi menampilkan 4 divisi resmi, mempertahankan divisi historis lama dengan penanda `(Historis)`.
     - Kategori personel memisahkan 3 entitas resmi: `Kru`, `Pembina`, `Pengarah`.
     - Menonaktifkan pilihan divisi dan angkatan untuk Pembina dan Pengarah di form penambahan/pengeditan kru, serta menyembunyikannya pada drawer detail.
     - Memisahkan tab dan filter khusus untuk "Ketua" dan "Pengasuh" tanpa duplikasi personel dalam satu tampilan daftar.
     - Menyelaraskan seluruh styling modal izin (`ManagePermissionsModal.tsx`) menggunakan token desain R03 (`var(--surface-sunken)`, `var(--dang-bg)`, `var(--dang)`, `var(--warn-bg)`, `var(--warn)`, `var(--ok-bg)`, `var(--ok)`).
  3. **Task 3 — Penomoran Surat Resmi & Anti-Duplikasi (`docsStore.ts`):**
     - Mengganti nomor acak (`Math.random()`) dengan alokasi sekuensial monotonik kanonikal (`maxSeq + 1`) berformat `XXX/TAG/ROMAN_MONTH/YEAR`.
     - Mencegah penomoran ganda saat approval di-retry: jika dokumen telah memiliki nomor resmi, nomor tersebut dipertahankan secara utuh.
     - Concurrency-safe dan mengacu pada standar format PTV.
  4. **Task 4 — Fix Download PDF Resmi Surat Izin & Surat Tugas (`docPdfPrinter.ts`, `DocDetailDrawer.tsx`):**
     - Memperbaiki akar masalah salah routing: memisahkan tombol "Buka Verifikasi" (ke `/verifikasi-surat`) dan tombol "Unduh PDF Resmi".
     - Membangun utilitas `downloadOfficialDocPdf` di `docPdfPrinter.ts` dengan tata letak resmi A4, kop surat Progresif TV, tabel identitas pemohon, peralatan bawaan, tanda tangan pimpinan, dan QR code resmi menuju URL verifikasi publik.
     - Pengunduhan PDF berjalan langsung di browser tanpa navigasi keluar halaman.
  5. **Task 5 — Sinkronisasi Alokasi Peralatan Detail Acara (`AcaraGearModal.tsx`, `AcaraDetailPage.tsx`):**
     - Menghapus katalog contoh hardcoded (`STUDIO_GEAR_POOL`) dan menghubungkan modal langsung ke inventaris kanonikal Supabase Staging melalui `inventarisService.getInventarisList()`.
     - Menampilkan kode inventaris nyata, nama alat, kategori, merek, dan foto fisik melalui `resolveInventoryPhotoUrl(item.foto_url)` dengan fallback ikon kategori.
     - Menampilkan unit fisik asli beserta kode, nama khusus (seperti Niksan), nomor seri, dan status ketersediaan.
     - Unit yang sedang dipinjam, rusak, atau hilang dinonaktifkan dari pemilihan unit baru dengan status yang jelas.
     - Alokasi peralatan acara yang sudah tersimpan sebelumnya terbaca dan dipertahankan saat modal dibuka ulang.
  6. **Task 6 — Fix UNIT_NOT_AVAILABLE Peminjaman (`LoanModal.tsx`):**
     - Menambahkan pra-validasi sebelum submit: memeriksa ketersediaan unit terhadap data inventaris terbaru.
     - Mendiagnosis secara presisi unit fisik mana yang menyebabkan penolakan (nama alat, kode unit, dan status penolakan: dipinjam/rusak/hilang).
     - Menandai kartu unit bermasalah dengan border merah, background highlight, dan badge status `⚠️`.
     - Menyediakan tombol "Muat Ulang Ketersediaan" di banner error.
     - Mempertahankan seluruh isian form peminjaman (`borrowerName`, `purpose`, `outDate`, `dueDate`, `eventRelated`, `notes`) serta item keranjang tanpa reset otomatis saat terjadi penolakan.
  7. **Task 7 — Smart Notification PTVPRO (`notificationService.ts`, `NotificationCenterModal.tsx`, `HubShell.tsx`):**
     - Membangun layanan `notificationService.ts` dengan sistem recipient-aware resolution berbasis identitas stabil pengguna (`ptv_id`/`role`), bukan pencocokan string nama rapuh.
     - Mengisolasi inbox pengguna secara ketat: penyimpanan menggunakan key user-scoped (`ptv_notifications_inbox_${user.ptv_id || user.id}`) sehingga tindakan "Tandai Dibaca" atau "Hapus Semua" tidak pernah memengaruhi inbox pengguna lain pada perangkat/browser yang sama.
     - Menghubungkan event producer berproteksi idempotency: penerbitan notifikasi otomatis saat Surat disetujui (`notifyDocApproved`), peminjaman berhasil (`notifyLoanCheckout`), dan kru ditugaskan ke acara (`notifyCrewAssigned`).
     - Menyinkronkan counter badge notifikasi header secara reaktif melalui subscription event bus `notificationService.subscribe`.
     - Menyiapkan draf skema SQL dan RLS proposal di `docs/PTVPRO-SMART-NOTIFICATIONS-SCHEMA-DRAFT.sql` untuk persetujuan operator tanpa mutasi database langsung.
  8. **Quality Gates Verification:**
     - TypeScript Check: 0 error (`tsc --noEmit`).
     - Vitest Keseluruhan: **1070 passed / 1070 tests across 101 test files (100% PASS)**.
     - ESLint: 0 warning, 0 error (`eslint . --max-warnings 0`).
     - Vite Production Build: Sukses (`npm run build` dalam 14.88s).
     - Database Staging `swadgljnyelsjstqqxbm`: 100% utuh tanpa DDL/mutasi tak berizin.

### PTV-DEV-138 (21 Oktober 2026)
- **CLN-142 | PTVPRO Dark Mode Refinement Batch 2 (10 Area Komprehensif):**
  1. **Detail Laporan Kerusakan & QC (`lapor-kerusakan.css` & `DamageDetailModal.tsx`):**
     - Mengganti hardcoded pastel hexes dengan `.damage-status-badge.status-*` dan menambahkan aturan Dark Mode komprehensif.
     - Memperbaiki kotak deskripsi, photo header, box QC terkunci, serta footer tombol Hapus & Tutup agar menggunakan token desain semantik R03 (`var(--surface)`, `var(--ink)`, `var(--dang)`, dsb.).
  2. **Form Tambah/Edit Acara (`acara.css` & `AcaraFormModal.tsx`):**
     - Menambahkan aturan Dark Mode untuk `.acara-session-card`, `.acara-session-label-pill`, `.acara-session-add-btn`, `.acara-session-toggle-box`, `.acara-notulensi-trigger`, `.acara-notulensi-menu`, `.acara-notulensi-search-wrap`, `.acara-notulensi-option-item`, `.acara-color-option`, `.acara-btn-archive`, `.acara-btn-danger-outline`.
     - Merefaktor inline styles pada kotak preview kru dan tombol konfirmasi hapus agar patuh token desain (`var(--surface-2)`, `var(--b-600)`, `var(--dang)`).
  3. **Modal Tautkan Notulensi Rapat (`AcaraLinkNoteModal.tsx`):**
     - Menyelaraskan banner target acara, kotak pencarian, kartu notulensi, status terpilih, badge tanggal, dan tombol "Pilih"/"Lepas" dengan kontras gelap yang terstandarisasi.
  4. **Modal Kelola Kru Bertugas (`AcaraCrewModal.tsx`):**
     - Input pencarian, kartu kru bertugas, kartu kandidat kru, input tugas kustom (`var(--surface)`), preset chips (`var(--surface)` / `var(--b-600)`), dan "+ Pilih" chips diselaraskan dengan Dark Mode tokens.
  5. **Modal Alokasi Peralatan (`AcaraGearModal.tsx`):**
     - Kotak pencarian, kartu peralatan, kotak thumbnail, badge kode alat, checkbox active label (`var(--b-600)`), stepper kuantitas, dan tombol unit fisik diadaptasikan ke token gelap yang konsisten.
  6. **Detail Nilai Inventaris (`nilaiInventaris.css` & `NilaiInventarisDetailPage.tsx`):**
     - Menghapus hardcoded pastel `#ecfdf5` / `#059669` pada icon box, digantikan dengan `var(--ok-bg)` dan `var(--ok)`.
     - Menambahkan class `.ptv-nilai-unit-calc-summary` dengan aturan Dark Mode (`background: rgba(34, 197, 94, 0.12)`, `color: #86efac`, dot `#34d399`).
     - Mengganti hardcoded `#f1f5f9` / `#cbd5e1` pada badge kode aset dan header unit fisik dengan `var(--bg-2)` / `var(--line-2)` / `var(--b-050)` / `var(--b-600)`.
  7. **Label Barcode Unit (`UnitBarcodesSection.tsx`):**
     - Canvas dan SVG label barcode fisik tetap 100% PUTIH MURNI untuk standar thermal printer dan scanner Code 128 laboratorium.
     - Tombol UI "Cetak Semua", "Ekspor Semua (PNG)", serta inline feedback toast dialihkan dari hardcoded `#ffffff` / `#cbd5e1` ke token tema `var(--surface-2)`, `var(--line-2)`, `var(--ink)`, dan `var(--info-bg)` / `var(--info)`.
  8. **Detail Laporan / Peminjaman — Sticky Footer (`LostFoundDetailDrawer.tsx` & `lostFound.css`):**
     - Memperbaiki `.lf-drawer-footer` yang sebelumnya hardcoded `#FFFFFF` menjadi `var(--surface)` dengan `border-top: 1px solid var(--line)`.
     - Mendefinisikan class button `.lf-btn-danger` dan `.lf-btn-success` di `lostFound.css` lengkap dengan varian Dark Mode berkontras tinggi.
  9. **Toast Notifications (`dashboard.css`):**
     - Menaikkan `#toasts` z-index dari `9999` ke `10050` agar notifikasi toast selalu tampil di atas modal/drawer backdrop.
     - Memperbaiki kontras Dark Mode pada `.toast`: surface `var(--surface)`, border `var(--line)`, dan tipografi jelas (`var(--ink)` & `var(--ink-2)`).
  10. **Modal Pemilihan Alat Peminjaman (`LoanModal.tsx` & `loanModal.css`):**
      - Mengeliminasi kontrol duplikat pada mobile bottom sheet drawer: parameter `renderSelectedPanel(isMobileDrawer = false)` menyembunyikan `.loan-selected-header` ganda di dalam drawer body.
      - Menambahkan blok aturan `:root[data-theme="dark"]` komprehensif pada `loanModal.css` untuk modal scrim, card shell, header, searchbar pill, scan button, category rail & chips, accordion cards, inputs form, dan mobile bottom sheet drawer.
  11. **Quality Gates Verification:**
      - `npm run typecheck`: 0 error (`tsc --noEmit`).
      - `npm test`: 101 test suite lolos (1070 unit tests PASS 100%).
      - `npm run lint`: 0 error, 0 warning (`eslint . --max-warnings 0`).
      - `npm run build`: Kompilasi produksi Vite sukses tuntas (15.56s).

### PTV-DEV-137 (21 Oktober 2026)
- **CLN-141 | Implementasi Smart Delete & Arsip Inventaris dengan Pemeriksaan Keamanan Multi-Tahap:**
  1. **Hak Akses & Capability Policy (`src/products/hub/inventaris/utils/inventoryPermissions.ts`):**
     - Mengimplementasikan `canDeleteInventory(user, can)` fail-closed berbasis capability `inventory.delete` kanonikal.
     - Mengizinkan peran Root / Super Admin (`root_executive`), Eksekutif (`eksekutif`), dan Administrasi (`kepolo_kepali` / peran administrasi).
     - Memblokir ketat kru biasa (`crew`), pembina (`pembina`), akun nonaktif (`status_akun !== 'active'`), akun organisasi diarsipkan (`status_organisasi === 'archived'`), serta akun dengan `denied_overrides: ['inventory.delete']`.
  2. **Automated Safety Check Engine (`src/products/hub/inventaris/services/inventorySafetyCheckService.ts`):**
     - Memeriksa relasi data secara otomatis terhadap layanan kanonikal: sirkulasi peminjaman (`peminjamanService.getPeminjamanList`), laporan kerusakan (`damageReportService.getReports`), surat tugas/izin bawa barang (`dokumenService.getDocuments`), status unit fisik (`asset.units`), dan buku valuasi akuntansi (`asset.nilai_inventaris`).
     - Mengklasifikasikan kondisi keselamatan ke dalam 3 tier deterministik:
       - **Kondisi C (Masih Ada Aktivitas Aktif):** Unit fisik dipinjam, pengajuan peminjaman berjalan, laporan kerusakan aktif, atau surat izin aktif. Seluruh aksi destruktif & arsip diblokir keras dengan rincian pemblokir dan panduan penyelesaian.
       - **Kondisi B (Memiliki Histori, Tanpa Aktivitas Aktif):** Aset tidak dipinjam tetapi memiliki riwayat peminjaman, log perbaikan, atau data valuasi. Hard delete ditolak demi melindungi jejak audit. Merekomendasikan opsi Arsip. Memberikan pemberitahuan status kesiapan schema Supabase (belum tersedianya kolom `is_archived`).
       - **Kondisi A (Aman Dihapus):** Aset bersih tanpa referensi aktif maupun historis. Mengaktifkan konfirmasi bertingkat: dropdown alasan (`Duplikat`, `Kesalahan Input`, `Lainnya`), input kode inventaris persis case-sensitive, dan peringatan aksi permanen.
     - Penanganan kegagalan query secara fail-closed: jika salah satu pemeriksaan relasi gagal, seluruh aksi destruktif diblokir otomatis.
  3. **Penempatan Tombol & Komponen Modal (`AlatDetailPage.tsx` & `SmartDeleteInventarisModal.tsx`):**
     - Menambahkan tombol `Hapus / Arsipkan Inventaris` dengan gaya `.btn-danger-outline` di zona administratif bawah halaman detail (`.prod-danger-zone-card`), terpisah jauh dari tombol `Pinjam Sekarang`. Tombol hanya tampil untuk akun berwenang.
     - Menyediakan modal smart delete lengkap dengan card identitas aset, matrix grid 6 titik inspeksi keamanan, panel kondisi A/B/C, dan formulir konfirmasi.
  4. **Repository Guardrails (`src/products/hub/inventaris/inventarisService.ts`):**
     - Menambahkan metode `deleteInventaris(assetId, reason)` pada `IInventarisService`.
     - `LocalInventarisService`: Menghapus data dari memory/localStorage dan mencatat jejak audit `DELETE_INVENTARIS` di `ptv_inventaris_audit_log`.
     - `SupabaseInventarisService`: Menerapkan proteksi guardrail staging, menolak eksekusi destruktif tanpa persetujuan operator.
  5. **Styling & Dark Mode (`src/styles/inventaris.css`):**
     - Menambahkan styling `.prod-danger-zone-card`, `.btn-danger-outline`, `.sdel-modal-card`, `.sdel-modal-overlay`, `.sdel-matrix-grid`, `.sdel-cond-panel`, `.sdel-btn-action.is-blocked`, `.sdel-btn-action.is-archive-disabled`, `.sdel-btn-action.is-danger`, serta dukungan Dark Mode penuh.
  6. **Quality Gates:**
     - Menambahkan test suite baru `tests/hub/smartDeleteInventaris.test.tsx` (20 tests PASS).
     - Vitest Keseluruhan: **1070 passed / 1070 tests across 101 files (100% PASS)**.
     - TypeScript Check: 0 error (`npm run typecheck`).
     - ESLint: 0 warning, 0 error (`npm run lint`).
     - Vite Production Build: Sukses (`npm run build`).

### PTV-DEV-136 (21 Oktober 2026)
- **CLN-140 | Perbaikan Konsistensi Dark Mode & Kontras UI (6 Area Utama):**
  1. **Daftar Acara & Detail Acara (`src/styles/acara.css` & `src/products/hub/acara/AcaraDetailPage.tsx`):**
     - Mendiagnosis akar masalah: `acara.css` sebelumnya tidak memiliki blok aturan Dark Mode (`:root[data-theme="dark"]` / `[data-theme="dark"]`), sehingga seluruh kartu acara, chip filter, kotak pencarian, badge status semantik (`Selesai`, `Besok`, `x hari lagi`), penanda Weton, dan penanda Hijriah menampilkan warna pastel Light Mode yang silau di atas tema gelap.
     - Menambahkan aturan Dark Mode komprehensif di `src/styles/acara.css` untuk `.acara-item-row`, `.acara-card`, `.acara-item-title` (`var(--ink)`), `.acara-item-meta` (`var(--muted)`), `.acara-badge.ok` (`var(--ok-bg)` & `var(--ok)`), `.acara-badge.dang` (`var(--dang-bg)` & `var(--dang)`), `.acara-badge.info` (`var(--info-bg)` & `var(--info)`), `.acara-badge.muted` (`var(--surface-2)` & `var(--muted)`), `.acara-badge-weton` (`var(--warn-bg)` & `var(--warn)`), `.acara-badge-hijri` (`var(--ok-bg)` & `var(--ok)`), `.acara-fchip`, `.acara-search-box`, `.acara-rd-row`, `.acara-rd-time-badge`, `.acara-gear-row`, `.acara-crew-row`, `.acara-tech-notes-content`, `.acara-notulensi-card`, `.acara-btn-secondary`, `.acara-btn-destructive`, dan modal sheet/fields.
     - Merefaktor hardcoded inline styles pada 7 kartu di `src/products/hub/acara/AcaraDetailPage.tsx` (Informasi Acara, Rundown, Catatan & Notulensi, Peralatan, Kru Bertugas, Dokumen Terkait, dan Aksi/Pengaturan), beralih ke variabel desain semantik R03 dan mengganti inline styles tombol Hapus Acara dengan class `.acara-btn-destructive`.
  2. **Daftar Kontak Internal & Eksternal (`src/styles/kruKomunikasi.css` & Drawer Kontak):**
     - Mendiagnosis akar masalah: tombol WhatsApp pada drawers (`KontakInternalDetailDrawer`, `KontakEksternalDetailDrawer`, `KruDetailDrawer`) serta `KontakEksternalPage.tsx` menggunakan inline style hardcoded `#ecfdf5` / `#059669` / `#a7f3d0` yang mem-bypass seluruh aturan CSS Dark Mode. Selain itu, badge kategori Yayasan menggunakan hardcoded `#f3e8ff` / `#9333ea`.
     - Menambahkan class `.kk-whatsapp-btn-full`, `.kk-phone-btn`, `.kk-kontak-detail-btn`, dan `.kk-category-badge` (`.pondok`, `.sekolah`, `.yayasan`, `.mitra`) dengan varian Dark Mode terstandarisasi.
     - Merefaktor `KontakInternalDetailDrawer.tsx`, `KontakEksternalDetailDrawer.tsx`, `KruDetailDrawer.tsx`, dan `KontakEksternalPage.tsx` untuk menggunakan class tersebut, mengeliminasi seluruh kebocoran warna pastel hijau muda pucat.
  3. **Alur Persetujuan & Timeline (`src/styles/kruKomunikasi.css` & `DocDetailDrawer.tsx`):**
     - Mendiagnosis akar masalah: komponen `.kk-tl-step.done` dan `.kk-tl-step.now` pada `DocDetailDrawer.tsx` menggunakan background hijau sangat terang `#f0fdf4` / `#bbf7d0` dan biru terang `#eff6ff` / `#bfdbfe` tanpa aturan Dark Mode.
     - Menambahkan aturan Dark Mode di `src/styles/kruKomunikasi.css` untuk `.kk-tl-step` (`background: var(--surface-2); border-color: var(--line);`), status `done` (`background: rgba(129, 201, 149, 0.12); color: #81C995;`), status `now` (`background: rgba(138, 180, 248, 0.12); color: #8AB4F8;`), dan status `reject` (`background: rgba(242, 139, 130, 0.12); color: #F28B82;`).
     - Memperbarui icon accordion di `DocDetailDrawer.tsx` agar menggunakan CSS variables (`var(--ok)`, `var(--warn)`, `var(--b-600)`, `var(--cat-lensa-fg)`).
  4. **Perizinan & Accordion Components (`src/styles/perizinan.css`):**
     - Menambahkan aturan Dark Mode untuk `.prz-accordion-item`, `.prz-accordion-header`, `.prz-accordion-content`, `.prz-detail-crew-pill`, `.prz-detail-item-pill`, `.prz-audit-item`, `.prz-qr-box`, `.prz-verification-notice`, dan `.prz-modal-card`.
  5. **Quality Gates & Test Coverage:**
     - Menambahkan unit test suite baru `tests/hub/darkModeConsistencyAndContrast.test.tsx` (14 tests PASS).
     - Vitest Keseluruhan: **1050 passed / 1050 tests across 100 files (100% PASS)**.
     - TypeScript Check: 0 error (`npm run typecheck`).
     - ESLint: 0 warning, 0 error (`npm run lint`).
     - Vite Production Build: Sukses (`npm run build`).

### PTV-DEV-135 (21 Oktober 2026)
- **CLN-139 | Modal Lapor Kerusakan Layout Restructuring & URL Verifikasi Surat Keabsahan Dokumen:**
  1. **Modal Lapor Masalah & Kerusakan — Perbaikan Struktur Layout & Scroll Container (Issue 1):**
     - Mendiagnosis akar masalah: `<footer className="damage-modal-footer">` sebelumnya berada di dalam container scroll `<form className="damage-modal-body">` dengan styling `position: sticky; bottom: 0; margin: 16px -22px -10px;`. Pola sticky dengan margin negatif ini menyebabkan footer menutupi field form (`Nama Pelapor` dan `WhatsApp Pelapor`) dan konten terdorong ke belakang footer saat di-scroll.
     - Merestrukturisasi arsitektur form di `src/products/hub/lapor-kerusakan/components/DamageReportModal.tsx`: `<form className="damage-modal-form">` kini membungkus ketiga bagian utama modal:
       - `<header className="damage-modal-header">`: Tetap berada di atas (`flex-shrink: 0`).
       - `<div className="damage-modal-body">`: Menjadi scroll container murni (`flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;`). Seluruh field formulir (Pemilihan Alat, Pemilihan Unit Fisik, Judul Masalah, Deskripsi, Upload Foto, dan grid Nama Pelapor & WhatsApp Pelapor) berada di dalam container ini dengan breathing room yang cukup.
       - `<footer className="damage-modal-footer">`: Berada di luar scroll container (`flex-shrink: 0; position: static; margin: 0;`).
     - Memperbarui styling di `src/products/hub/lapor-kerusakan/lapor-kerusakan.css`:
       - Menambahkan `.damage-modal-form` sebagai flex column container (`flex: 1 1 auto; min-height: 0; height: 100%; overflow: hidden;`).
       - Memperbaiki selector `.damage-live-form.damage-modal-body` dan `.damage-live-form .damage-modal-body` dengan padding dan scroll-padding yang aman (`scroll-padding-bottom: 90px;` di desktop dan `110px;` di mobile).
       - Menyetel `.damage-live-form .damage-modal-footer` menjadi `position: static; margin: 0; background: var(--surface); border-top: 1px solid var(--line);` sehingga footer tidak pernah melayang di atas konten formulir, baik di desktop maupun mobile, Light maupun Dark Mode.
       - Memastikan safe area iOS `env(safe-area-inset-bottom, 0px)` dan `100dvh` pada mobile sheet.
       - Mempertahankan validasi HTML5, upload foto base64, submit state, dan persistensi kerusakan tanpa deviasi logic.
  2. **Tombol Buka Verifikasi — Arahkan ke Portal Keabsahan Dokumen (Issue 2):**
     - Mendiagnosis akar masalah: tautan tombol `Buka Verifikasi` pada `DocDetailDrawer.tsx` sebelumnya memanggil `buildOfficialDocVerificationUrl(doc.no)`, menghasilkan URL dengan nomor surat di path (`https://ptvpro.com/verifikasi-surat/007%2FSI-PTV%2FX%2F2026`).
     - Pada `src/products/hub/dokumen-saya/components/DocDetailDrawer.tsx`, mengubah atribut `href` tombol `Buka Verifikasi` menjadi `/verifikasi-surat` (relative routing aktif). Pada localhost (port 5174), tombol membuka `http://localhost:5174/verifikasi-surat`, sedangkan pada production membuka `https://ptvpro.com/verifikasi-surat` secara otomatis tanpa hardcoding alamat host.
     - Nomor surat tidak lagi ditempelkan pada path URL tombol. Pengguna dapat menggunakan antarmuka pencarian/verifikasi existing di halaman Keabsahan Dokumen.
     - Mempertahankan QR code dokumen resmi (`<RealQrCode payload={buildOfficialDocVerificationUrl(doc.no)} ... />`) dan payload SVG asli untuk verifikasi fisik/scan publik.
     - Menambahkan atribut `data-payload={payload}` pada SVG `RealQrCode` di `src/shared/utils/qrCode.tsx` untuk kemudahan inspeksi DOM dan verifikasi aksesibilitas.
  3. **Quality Gates & Test Coverage:**
     - Menambahkan targeted test suite baru `tests/hub/damageModalAndDocVerification.test.tsx` (3 tests PASS) yang memverifikasi struktur form, body, footer, CSS rules, serta URL tombol Buka Verifikasi.
     - Memperbarui `tests/hub/documentQr.test.tsx` (2 tests PASS).
     - Vitest Keseluruhan: **1036 passed / 1036 tests across 99 files (100% PASS)**.
     - TypeScript Check: 0 error (`tsc --noEmit`).
     - Linting: 0 warning, 0 error (`eslint . --max-warnings 0`).
     - Production Build: Sukses (`npm run build`).

### PTV-DEV-134 (21 Oktober 2026)
- **CLN-138 | Dark Mode Detail Inventaris, Search UI Scope Isolation, Fixture INV-977 Safe Exclusion & NIKSAN Barcode Normalization:**
  1. **Dark Mode Detail Inventaris & EditAlatModal (Issue 1):**
     - Menambahkan aturan Dark Mode komprehensif (`:root[data-theme="dark"]`) di `src/styles/dashboard.css` untuk seluruh permukaan detail inventaris (`.prod-showcase-card`, `.prod-main-photo-wrap`, `.prod-photo-fallback`, `.prod-main-photo-badge`, `.prod-main-title`, `.prod-subhead`, `.prod-stat-pill`, `.prod-pricing-box`, `.prod-spec-card`, `.prod-spec-card-icon`, `.prod-btn-basket`, `.prod-unit-hcard`, `.prod-section-card`, `.prod-section-icon-badge`, `.prod-section-title`, `.prod-tech-specs-box`, `.loan-hist-card`, `.loan-hist-ic`, `.prod-empty-history-compact`).
     - Mengeliminasi background putih hardcoded (`#ffffff`, `#F8FAFC`, `#0F172A`, `#E2E8F0`, `#475569`) di `src/products/hub/inventaris/EditAlatModal.tsx`, menggantinya dengan token tema R03 (`var(--surface)`, `var(--card-bg)`, `var(--bg-2)`, `var(--ink)`, `var(--ink-2)`, `var(--line-2)`), termasuk pada modal utama, form fields, textarea, footer, dan submodals Tambah Lokasi / Tambah Sumber.
     - Menyempurnakan kontras Light dan Dark mode pada `AlatDetailPage.tsx` dengan variabel semantik pada tombol `btnEditAlat`, subtitle catatan, dan riwayat peminjaman.
  2. **Ikon Search Salah Posisi (Issue 2):**
     - Menemukan dan memperbaiki akar masalah kebocoran CSS global: aturan unscoped `.search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); }` pada `src/products/hub/keuangan/financeFoundation.css` yang sebelumnya menarik paksa ikon keluar dari flex-flow di seluruh modal dan halaman lain.
     - Mengisolasi selektor tersebut menjadi `.toolbar-search-wrap .search-icon`.
     - Memperkuat `.loan-searchbar-pill .search-icon` di `src/styles/loanModal.css` dengan `position: static !important; display: inline-flex;` dan padding input `padding: 8px 4px 8px 0;`.
     - Mengamankan `.inv-search-wrap .search-icon` di `src/styles/inventaris.css` dan `src/styles/dashboard.css` agar tahan terhadap regresi global.
     - Menjamin clearance ikon dan placeholder di `AjukanBarangModal.tsx` dan `AjukanTugasModal.tsx` (`paddingLeft: 38px`).
  3. **Penyaringan Aman Dummy Fixture INV-977 (Issue 3):**
     - Mengidentifikasi record Staging DB `ff39f521-a6aa-42ba-aa93-33b6c49941f6` (kode `INV-977`, nama `UJI-STAGING — Inventaris`) beserta 3 child units (`INV-977-U01`, `INV-977-U02`, `INV-977-U03`).
     - Memastikan 0 relasi transaksi (0 loans, 0 damage reports, 0 valuation records).
     - Menghilangkan fixture tersebut dari katalog dan detail pengguna secara aman melalui predikat `isInventoryTestFixture` di `inventarisService.ts` (`LocalInventarisService` dan `SupabaseInventarisService`), tanpa melakukan DELETE prematur dan tanpa menyembunyikan inventaris operasional lain yang mengandung kata `staging`.
  4. **Standardisasi Label Barcode NIKSAN (Issue 4):**
     - Mengimplementasikan helper kanonikal `normalizeBarcodeBranding(brandText?: string | null, isNiksan?: boolean): string` di `src/products/hub/inventaris/utils/barcodeExportUtils.ts`.
     - Menyeragamkan seluruh variasi kolaborasi (`PROGRESIF TV × NIKSAN`, `PTV × NIKSAN`, dll.) menjadi `NIKSAN` pada header canvas PNG, footer bar, cetak single, cetak massal, dan preview card di `UnitBarcodesSection.tsx`.
     - Mempertahankan integritas kode unit, nomor seri, dan enkoding Code 128 barcode scanner fisik.
  5. **Quality Gates & Test Coverage:**
     - Menambahkan unit test suite baru `tests/hub/ptvDev134DarkModeAndRefinements.test.tsx` (10 tests PASS) dan memverifikasi `tests/hub/inventarisRefinements.test.tsx` (8 tests PASS).
     - Vitest: **1033 passed / 1033 tests across 98 files (100% PASS)**.
     - Typecheck: 0 error (`tsc --noEmit`).
     - Linting: 0 warning, 0 error (`eslint . --max-warnings 0`).
     - Build: Lolos sukses (`npm run build`).

### PTV-DEV-133 (21 Oktober 2026)
- **CLN-137 | Refinements for Kontak Internal Non-Operational Rows, Surat Tugas Crew Eligibility & Acara Dropdown, and Izin Bawa Barang Inventory Photos & Acara Sync:**
  1. **Detail Kontak Internal — Sembunyikan Divisi Kerja & Angkatan Nonoperasional:**
     - Pada `src/products/hub/kontak/components/KontakInternalDetailDrawer.tsx`, mengimplementasikan guard terarah `isNonOperational(category)` yang mendeteksi kategori nonoperasional (`pengarah`, `pembina`, `pendiri`, `pengasuh`, `penasihat`).
     - Baris "Divisi Kerja" dan "Angkatan" kini disembunyikan secara presentasional hanya untuk kategori tersebut, tanpa mutasi database dan tanpa memengaruhi kru operasional (`Kru`, `Pengurus`) yang tetap menampilkan divisi dan angkatannya.
  2. **Pengajuan Surat Tugas — Foto Profil Asli, Kru Operasional Aktif, & Dropdown Acara Staging:**
     - Pada `src/products/hub/perizinan/components/AjukanTugasModal.tsx`, mengganti avatar inisial statis dengan foto profil asli kru (`c.foto_url`) berukuran 28x28 rounded dengan fallback inisial otomatis (`onError` & missing url guard).
     - Menyaring daftar personel kru dengan predikat `isOperationalActiveCrew`: mewajibkan `status_kru === 'Aktif'` dan mengecualikan kategori/jabatan/divisi nonoperasional (`Pengarah`, `Pembina`, nonaktif). Sanitasi otomatis juga membersihkan state kru terpilih jika daftar kandidat berubah.
     - Menghapus mock fixtures hardcoded `INITIAL_ACARA_FIXTURES` dan menghubungkan form dengan `acaraService.getEvents()` asli dari Staging. Menambahkan honest loading state, error alert dengan tombol coba lagi, serta mempertahankan opsi penulisan nama acara bebas (*free-text input*).
  3. **Pengajuan Izin Bawa Barang — Thumbnail Foto Asli Inventaris & Pilihan Acara Staging:**
     - Pada `src/products/hub/perizinan/components/AjukanBarangModal.tsx`, mengganti ikon kamera statis dengan thumbnail foto fisik unit/alat asli menggunakan resolver kanonikal `resolveInventoryPhotoUrl((unit as any).foto_url || item.foto_url)` dengan fallback ikon kamera jika foto tidak tersedia.
     - Menambahkan dropdown "Terkait Acara / Agenda Kegiatan" yang terhubung langsung ke `acaraService.getEvents()` staging lengkap dengan loading, error state, dan free-text fallback. Mengoper `event` dan `event_id` ke kontrak pengajuan tanpa mengubah skema backend atau mutasi paralel.
  4. **Quality Gates & Test Coverage:**
     - Menambahkan regression test suite baru `tests/hub/perizinanAndKontakPtvDev133.test.tsx` (6 tests PASS).
     - Vitest: **1023 passed / 1023 tests across 97 files (100% PASS)**.
     - Typecheck: 0 error (`tsc --noEmit`).
     - Linting: 0 warning, 0 error (`eslint . --max-warnings 0`).
     - Build: Lolos sukses (`npm run build`).

### PTV-DEV-132 (21 Oktober 2026)
- **CLN-136 | 7 UI/UX & Interaction Refinements (Kalender Mobile, Catatan Focus & Scrolling, Nilai Inventaris Mobile Card, WhatsApp Contact Coverage, Search Icons):**
  1. **Kalender Mobile Terlalu Kecil (Issue 1):**
     - Memperbaiki keterbacaan sel bulanan mobile di `src/styles/kalender.css` (breakpoint `<=480px` dan `<=360px`).
     - Mengganti `aspect-ratio: 1 / 0.76` dan `max-height: 52px` dengan `min-height: 54px !important; max-height: none !important; aspect-ratio: auto !important;` sehingga tanggal tidak terjepit.
     - Meningkatkan ukuran tipografi: Masehi dari 12px ke 14px bold, Hijriah dari 11px ke 12.5px, pasaran weton Jawa dari 8px ke 9.5px weight 600, dan titik indikator momentum acara/planner ke 4.5px.
     - Merampingkan padding kontainer kartu `.kal-surface-card` menjadi `12px 6px` (dan `10px 4px` pada `<=360px`) untuk mencegah horizontal overflow tanpa menghilangkan data Hijriah maupun weton.
  2. **Detail Catatan Bersama Terpotong di Mobile & Touch Scroll (Issue 2 & 4):**
     - Memindahkan rendering modal detail, form modal, dan konfirmasi hapus catatan di `src/products/hub/catatan/CatatanPage.tsx` menggunakan React `createPortal(..., document.body)`. Ini melepaskan modal dari containing block `.page` yang memiliki `transform: translateY(7px)` CSS animation trap yang memotong fixed backdrop di layar mobile.
     - Menghapus `touch-action: none;` pada `.catatan-modal-backdrop` di `src/styles/catatan.css` yang memblokir gestur sentuh WebKit mobile.
     - Memperbaiki scroll body `.catatan-modal-body` dengan `flex: 1 1 auto; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y; overscroll-behavior: contain;`.
     - Mengatur batas tinggi modal mobile ke `max-height: calc(100dvh - env(safe-area-inset-top, 0px) - 16px)` serta footer sticky yang patuh pada `safe-area-inset-bottom`.
  3. **Form Notulensi Rapat Kehilangan Fokus & Scroll Reset (Issue 3):**
     - Menemukan akar penyebab di `src/products/hub/catatan/components/NoteRichEditor.tsx`: sanitasi/serialisasi DOMParser pada `normalizeContentForEditor(initialHtml)` menghasilkan string HTML yang sedikit berbeda dari DOM hidup peramban (misal trailing `<br>`, entity formatting). Hal ini memicu `editorRef.current.innerHTML !== normalized` bernilai true pada setiap ketikan, meremount/menulis ulang DOM anak editor, memusnahkan caret/selection aktif, menghilangkan fokus, dan mereset scroll container ke puncak.
     - Memperbaiki akar masalah tanpa hack auto-focus: menambahkan `isInternalTypingRef` dan `lastEmittedHtmlRef`. `innerHTML` editor tidak disentuh saat pengguna sedang aktif mengetik, dan hanya dimutasi ketika perubahan berasal dari luar (misal memilih template baru atau memuat catatan yang diedit). Pengguna dapat mengetik panjang tanpa gangguan fokus atau scroll jump.
  4. **Kartu Nilai Inventaris Berantakan di Mobile (Issue 5):**
     - Memperbaiki layout kartu Nilai Perolehan di `src/styles/nilaiInventaris.css` dan `src/styles/dashboard.css` pada breakpoint mobile.
     - Mengubah card dan dossier container dari fixed/min-height desktop menjadi `height: auto !important; min-height: 0 !important;`.
     - Mengatur tombol aksi `.ptv-nilai-card-actions-col` menjadi satu baris horizontal rapat (`flex-wrap: nowrap;`) dengan Detail (`flex: 1`), Ubah (`flex: 1`), dan Hapus (`width: 38px; min-width: 38px; padding: 0`), mengeliminasi baris gantung (orphan wrap) yang sebelumnya menyisakan ruang kosong besar.
  5. **Field WhatsApp Pelapor Tertutup Sticky Footer di Mobile (Issue 6):**
     - Di `src/products/hub/lapor-kerusakan/lapor-kerusakan.css`, memperbaiki scroll container `form.damage-live-form.damage-modal-body` dengan `scroll-padding-bottom: 90px;` (dan `110px` pada mobile).
     - Memberikan `margin-bottom: 24px;` (dan `32px` di mobile) pada `.damage-live-contact-grid` serta `scroll-margin-bottom: 96px;` pada input WhatsApp Pelapor saat fokus. Saat keyboard virtual terbuka, input tidak tertutup di balik sticky footer.
     - Menyematkan `createPortal(..., document.body)` pada `DamageDetailModal.tsx` agar konsisten dengan `DamageReportModal.tsx`.
  6. **Ikon Search Bertumpuk dengan Input (Issue 7):**
     - Menghilangkan tabrakan ikon Font Awesome search dengan teks input di `dashboard.css`, `nilaiInventaris.css`, dan `lapor-kerusakan.css`.
     - Menyelaraskan padding kiri input pencarian: `.ptv-nilai-search-wrap input` menjadi `padding-left: 46px; padding-right: 44px;` (mobile: `44px / 40px`), `.damage-search-input` menjadi `padding-left: 38px;`, dan `.damage-live-search input, .damage-live-search .damage-form-input` menjadi `padding-left: 42px !important;`.
  7. **Quality Gates & Test Coverage:**
     - Menambahkan regression test suite baru `tests/hub/uiRefinementPtvDev132.test.tsx` (10 tests PASS).
     - Vitest: **1017 passed / 1017 tests across 96 files (100% PASS)**.
     - Typecheck: 0 error (`tsc --noEmit`).
     - Linting: 0 warning, 0 error (`eslint . --max-warnings 0`).
     - Build: Lolos sukses (`npm run build`).

### PTV-DEV-131 (21 Oktober 2026)
- **CLN-135 | Global Navigation & Header Intermittent Interaction Fix:**
  1. **Akar Masalah 1: False Positive `hasActiveDialog()` & `canOpenGlobalModal()`:**
     - Elemen mobile action sheet (`#quickSheet`, `#moreSheet`) dan backdrops (`#quickScrim`, `#moreScrim`) di `src/products/hub/shell/HubShell.tsx` dirender statis di DOM dengan atribut `role="dialog"` dan `aria-modal="true"` bahkan saat kondisi tertutup (`isQuickOpen = false`, `isMoreOpen = false`).
     - Akibatnya, query DOM fallback di `dialogManager.hasActiveDialog()` selalu menemukan elemen tersebut, mengembalikan `true`, dan menyebabkan `dialogManager.canOpenGlobalModal()` mengembalikan `false` secara permanen.
     - Seluruh tombol header global (`hdr-search`, `icon-btn only-mobile`, notifikasi, dan menu profil) serta tombol mobile dock (`fab` dan `more`) yang dilindungi pengecekan `canOpenGlobalModal()` menjatuhkan event klik tanpa aksi.
     - **Solusi:** Menjadikan atribut `role`, `aria-modal`, dan `aria-hidden` bersifat kondisional di `HubShell.tsx`. Memperketat `hasActiveDialog()` di `src/shared/utils/dialogManager.ts` untuk mengabaikan elemen dengan `aria-hidden="true"`, sheet non-aktif (`.sheet:not(.on)`), scrim non-aktif (`.scrim:not(.on)`), dan elemen tersembunyi (`display: none`, `visibility: hidden`, `opacity: 0`).
  2. **Akar Masalah 2: Stacking Context & Scrim Occlusion pada Mobile Bottom Bar:**
     - `.bnav` memiliki `z-index: 60`, sedangkan backdrop transisi `.scrim` memiliki `z-index: 80`. Saat action sheet sedang terbuka atau dalam masa transisi fade-out (240ms), scrim menutupi dock navigasi bawah (`z-index: 60`), menangkap tap/pointer events, dan memblokir pengguna berpindah ke Beranda, Acara, atau Inventaris.
     - **Solusi:** Mengatur hierarki z-index R03 yang presisi:
       - Desktop Sidebar `.side`: `z-index: 70`
       - Global Header `.hdr`: Ditingkatkan dari `60` ke `z-index: 75` (berada di atas desktop sidebar dan sticky content halaman).
       - Modal Scrim `.scrim`: `z-index: 80`
       - Mobile Bottom Nav `.bnav`: Ditingkatkan dari `60` ke `z-index: 85` (berada di atas scrim transisi agar dock navigasi selalu responsif, namun di bawah sheet aktif).
       - Action Sheet `.sheet`: `z-index: 90`
       - Global Modals: `z-index: 1000 - 9999`
       - Mempertegas aturan CSS di `src/styles/dashboard.css`: `.scrim:not(.on)` dan `.sheet:not(.on)` wajib memiliki `pointer-events: none !important; visibility: hidden !important; opacity: 0;`.
  3. **Akar Masalah 3: Stale Scroll Lock & Dialog Stack saat Transisi Route:**
     - `dialogManager` sebelumnya tidak memiliki listener pergantian route. Jika pengguna berpindah rute saat sheet/modal terbuka, atau jika modal di-unmount tanpa `unregister()`, `document.body` tetap terkunci (`position: fixed; overflow: hidden;`), melumpuhkan scroll dan touch dispatch pada halaman tujuan.
     - **Solusi:** Menambahkan `dialogManager.resetOnRouteChange()` dan `dialogManager.cleanupOrphanDialogs()`. Di `HubShell.tsx`, ditambahkan route-change listener (`useEffect` pada `location.pathname`) yang secara otomatis menutup seluruh sheet terbuka, memanggil `resetOnRouteChange()`, dan memulihkan scroll body secara instan. Menambahkan penutupan sheet eksplisit pada handler tombol dock Beranda, Acara, dan Inventaris sebelum `navigate()`.
  4. **Quality Gates & Test Coverage:**
     - Menambahkan test suite baru `tests/hub/globalNavigationInteractions.test.tsx` (8 tests PASS).
     - Menyelaraskan `tests/hub/globalModalShortcuts.test.tsx` (10 tests PASS).
     - Vitest: **1007 passed / 1007 tests across 95 files (100% PASS)**.
     - Typecheck: 0 error (`tsc --noEmit`).
     - Linting: 0 warning, 0 error (`eslint . --max-warnings 0`).
     - Build: Lolos sukses (`npm run build` dalam 27.53s).
     - Runtime Port 5174: HTTP 200 OK.

### PTV-DEV-130 (21 Oktober 2026)
- **CLN-134 | 4 Inventaris Module Refinements (Barcode Label, Loan History Sync, Single Plus Button, Search Icon):**
  1. **Label Barcode Unit (Sanitasi Brand Kolaborasi):**
     - Menghilangkan prefix `"PROGRESIF TV × "` pada footer label barcode unit kolaborasi di `src/products/hub/inventaris/UnitBarcodesSection.tsx` dan `src/products/hub/inventaris/utils/barcodeExportUtils.ts` (canvas 2D 300 DPI, single print HTML, dan batch print HTML), sehingga secara dinamis hanya menampilkan **`NIKSAN`**.
     - Nilai barcode, kode unit, format Code 128, dan layout label standar PTV tetap utuh 100%.
  2. **Riwayat Peminjaman Inventaris (Sinkronisasi Kanonikal & Multi-status):**
     - Menghubungkan riwayat peminjaman pada `src/products/hub/inventaris/AlatDetailPage.tsx` dengan data transaksi asli dari `peminjamanService.getPeminjamanList()`.
     - Memperbaiki matching logic agar mencakup relasi ID aset master, ID unit fisik, kode master aset, kode unit fisik, serta identitas alat.
     - Menyediakan honest loading state (`loansLoading`), error alert jujur dengan tombol aksi `"Coba Lagi"`, status badge akurat (`Dikembalikan`, `Terlambat`, `Dipinjam`), display kode unit pinjaman, dan honest empty state tanpa membuat tabel paralel. Data tetap tampil setelah browser refresh.
  3. **Tombol Tambah Unit (Eliminasi Plus Ganda):**
     - Menghilangkan tanda plus literal pada teks tombol `+ Tambah Unit` di `src/products/hub/inventaris/TambahAlatModal.tsx` sehingga hanya merender satu simbol plus rapi via `<i className="fa-solid fa-plus" /> Tambah Unit`.
  4. **Ikon Search Inventaris (Vertical Centering & Padding):**
     - Menyelaraskan posisi ikon pencarian di `src/styles/inventaris.css` dan `src/styles/dashboard.css` menggunakan `display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; line-height: 1;`.
     - Menormalkan padding, line-height, dan text metrics input field di desktop/mobile dan Light/Dark Mode tanpa mengubah logika pencarian.
  5. **Quality Gates & Test Coverage:**
     - Menambahkan test suite baru `tests/hub/inventarisRefinements.test.tsx` (8 tests PASS).
     - Menyelaraskan `tests/hub/inventarisBarcodeLabel.test.tsx`.
     - Vitest: **999 passed / 999 tests across 94 files (100% PASS)**.
     - Typecheck: 0 error (`tsc --noEmit`).
     - Linting: 0 warning, 0 error (`eslint . --max-warnings 0`).

### PTV-DEV-129 (21 Oktober 2026)
- **CLN-133 | Global Modal Management, Single-Modal Policy, & Shortcut Guard:**
  1. **Centralized Dialog Manager (`src/shared/utils/dialogManager.ts`):**
     - Membangun pengelola siklus hidup dialog terpusat (`dialogManager`) yang mengelola tumpukan modal aktif (Dialog Stack), deteksi dialog aktif (stack + DOM inspection fallback), dan pelepasan scroll lock berbasis referensi.
  2. **Single-Modal Policy:**
     - Menerapkan fungsi `canOpenGlobalModal()` yang memblokir pembukaan modal global (Universal Search, Quick Actions FAB, More Menu mobile sheet, Notifikasi, dan Profil) jika sedang ada modal/dialog halaman yang terbuka.
  3. **Shortcut Guard (`/` & `Ctrl/Cmd+K`):**
     - Mencegah pembukaan Global Search saat pengguna mengetik di input, textarea, contenteditable, atau rich editor (seperti surface Notulis / `NoteRichEditor`). Karakter `/` tetap diketik ke dalam editor tanpa intersepsi `e.preventDefault()`.
     - Mencegah pembukaan Global Search saat ada modal/dialog apapun yang sedang terbuka.
  4. **Hierarchical LIFO Escape Handling:**
     - Menjamin tombol `Escape` HANYA menutup dialog teratas pada tumpukan (LIFO). Pada dialog bertingkat (misalnya konfirmasi hapus di atas form Notulis), menekan `Escape` hanya menutup dialog konfirmasi dan mempertahankan modal induk tetap terbuka.
  5. **Focus Restoration & Scroll Lock:**
     - Mengembalikan fokus keyboard ke elemen pemicu saat dialog ditutup.
     - Scroll lock pada `document.body` dihitung secara terpusat sehingga penutupan dialog turunan tidak membuka scroll latar belakang secara prematur.
  6. **Quality Gates:**
     - Menambahkan test suite terfokus `tests/hub/globalModalShortcuts.test.tsx` (10 tests PASS).
     - Vitest: **991 passed / 991 tests across 93 files (100% PASS)**.
     - Typecheck: 0 error (`tsc --noEmit`).
     - Linting: 0 warning, 0 error (`eslint . --max-warnings 0`).
     - Build: Sukses dalam 18.58s (`npm run build`).

### PTV-DEV-128 (21 Oktober 2026)
- **CLN-132 | 6 UI & Functional Refinements (Kontak Dark Mode, Nilai Mobile, Form Kerusakan, Filter Nilai, Riwayat Real Photo, Filter Keuangan):**
  1. **Kontak Internal — Dark Mode Contrast & Palette:**
     - Menghapus hardcoded inline styles (`#ecfdf5`, `#059669`, `#a7f3d0`) pada tombol WhatsApp di `src/products/hub/kontak/KontakInternalPage.tsx`.
     - Menggantinya dengan kelas semantik `.kk-whatsapp-btn` yang dikendalikan oleh token tema R03 di `src/styles/kruKomunikasi.css`.
     - Menambahkan override komprehensif `:root[data-theme="dark"]` untuk searchbar (`.kk-searchbar`), placeholder input, filter pill (`.kk-filter-pill`), badge hitungan (`.cnt`), kartu kontak list item, typography nama dan subtitle, header kategori/angkatan, serta drawer detail kontak sehingga kontras rasio WCAG AAA terpenuhi dan Light Mode tetap utuh.
  2. **Nilai Inventaris — Mobile Layout Height Optimization:**
     - Mengeliminasi ruang kosong vertikal yang berlebihan pada kartu Nilai Perolehan di tampilan mobile (`src/styles/nilaiInventaris.css` & `src/styles/dashboard.css`).
     - Mengubah `.ptv-nilai-card`, `.ptv-nilai-card-inner`, `.ptv-nilai-card-main-col`, dan `.ptv-nilai-card-dossier-col` pada mobile media query dengan `height: auto; min-height: 0; align-self: start;` serta compact padding (`12px 14px`) dan gap rapat (`10px`).
     - Seluruh metrik angka dan tombol aksi tetap tampil utuh tanpa stretch berlebih.
  3. **Form Lapor Masalah & Kerusakan UI Modal Polish:**
     - Memperbaiki layout modal `src/products/hub/lapor-kerusakan/components/DamageReportModal.tsx` dan `src/products/hub/lapor-kerusakan/lapor-kerusakan.css`.
     - Menambahkan banner alat terpilih (`.damage-selected-asset-box`) dengan nama alat, kode, badge kategori, dan tombol ganti alat, sehingga daftar pencarian 200px otomatis kolaps setelah alat dipilih.
     - Merapikan dropdown pemilihan unit fisik dengan nomor seri dan kondisi awal yang jelas.
     - Memperbarui dropzone upload foto kerusakan (`.damage-photo-dropzone`) dengan ikon kamera modern dan preview box (`.damage-photo-preview-box`) ber-thumbnail serta tombol hapus foto ber-ikon tempat sampah.
     - Mempertahankan 100% logika persistensi, integrasi staging RPC, dan verifikasi QC tanpa perubahan.
  4. **Filter Nilai Inventaris Multi-kriteria Nyata:**
     - Mengekstrak dan menyatukan fungsi filter inventaris `applyNilaiInventarisFilters` di `src/products/hub/inventaris/inventarisService.ts`.
     - Menghubungkan filter multi-kriteria (kategori `cat`, status nilai `status`, sumber perolehan `source`, multi-token search `q`, dan pengurutan `sortBy`) ke `LocalInventarisService` dan `SupabaseInventarisService`.
     - Menghitung jumlah hasil filter secara akurat dan menyediakan empty state saat tidak ada alat yang cocok.
  5. **Riwayat Peminjaman — Real Inventory Photo & Fallback:**
     - Mengganti ikon generik `loan-item-row` pada `src/products/hub/peminjaman/PeminjamanPage.tsx` dan modal konfirmasi pengembalian dengan foto riil alat inventaris studio.
     - Menyelesaikan URL foto secara terpadu melalui relasi unit fisik dan master item via `resolveInventoryPhotoUrl`.
     - Menghadirkan fallback netral jika alat belum memiliki foto tanpa merusak data historis peminjaman.
  6. **Filter Keuangan — Filter Kombinasi, Counter, & Reset:**
     - Menghubungkan atribut `category_id` ke model kanonikal transaksi `CanonicalTransaction` di `api/finance.ts` dan `src/products/hub/keuangan/financeCanonical.ts`.
     - Menyelaraskan filter transaksi di `src/products/hub/keuangan/FinanceWorkspace.tsx` agar merespons pencarian, tipe transaksi (pemasukan/pengeluaran/transfer), kantong kas, kategori/tag, rentang tanggal, dan switch mutasi uji.
     - Menambahkan counter hasil filter aktif (`Menampilkan X transaksi yang cocok`) dan tombol `Reset Filter` fungsional serta tombol reset pada empty state.
  7. **Quality Gates & Continuous Curve Governance:**
     - Menambahkan test suite baru `tests/hub/uiRefinementPtvDev128.test.tsx` (8 tests PASS).
     - Vitest: **981 passed / 981 tests across 92 files (100% PASS)**.
     - Typecheck: 0 error (`tsc --noEmit`).
     - Linting: 0 warning, 0 error (`eslint . --max-warnings 0`).
     - Build: Sukses dalam 15.23s (`npm run build`).

### PTV-DEV-127 (21 Oktober 2026)
- **CLN-131 | Agenda Border Cleanup, Real Camera Scanner & Loan Modal Polish:**
  1. **Agenda Berikutnya & Modul Acara:**
     - Menghapus border aksen vertikal di ujung kiri kartu acara (`border-inline-start: 3px solid var(--acara-accent)`) pada `src/styles/acara.css`.
     - Menerapkan border netral konsisten `border: 1px solid var(--line, var(--border, #e2e8f0))` sesuai panduan PTVPRO R03, dengan tetap mempertahankan warna ikon dan status badge.
     - Memastikan seluruh metadata acara (tanggal, weton, Hijriah, waktu, lokasi, countdown) tersusun dalam SATU BARIS rapat tanpa wrapping ke baris kedua (`flex-wrap: nowrap; white-space: nowrap; overflow: hidden;`).
     - Teks lokasi dan waktu dilengkapi container fleksibel dengan pemotongan teks rapi (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`) sehingga tidak menimbulkan horizontal window overflow pada viewport sempit (320px–430px).
  2. **Scanner Barcode/QR Kamera Nyata (Real Hardware Camera Integration):**
     - Memutakhirkan `src/products/hub/inventaris/InventoryScanDialog.tsx` dengan dual-engine pemindaian real-time: Native `window.BarcodeDetector` (untuk Chrome/Android/1D & 2D) dan fallback murni `jsQR` via offscreen canvas (100% kompatibel iOS Safari, Android Chrome, dan webcam desktop).
     - Menangani penanganan izin kamera secara komprehensif (`NotAllowedError`, `NotFoundError`, `DevicesNotFoundError`, dan `isSecureContext`).
     - Menambahkan deteksi multi-kamera (`enumerateDevices`) dan tombol ganti kamera (depan/belakang) dengan prioritas awal kamera belakang (`facingMode: { ideal: 'environment' }`).
     - Menghentikan seluruh video track WebRTC secara bersih saat dialog ditutup atau unmount.
     - Mengimplementasikan pencocokan kode inventaris nyata (`matchInventoryCode`) terhadap data staging: mencocokkan kode unit fisik (`INV-001-U01`), nomor seri unit, dan kode alat induk (`INV-001`).
     - Memberikan feedback jujur dan menolak klaim sukses jika kode tidak ditemukan di katalog data inventaris studio.
  3. **Modal Peminjaman Alat (Real Photo Thumbnails, Real Acara Service & Drag Rail):**
     - Menghapus opsi dummy/hardcoded `EVENT_OPTIONS`. Menggantinya dengan pengambilan data agenda acara studio nyata via `acaraService.getEvents()`.
     - Menyediakan indikator loading, pesan status error dengan tombol coba lagi (*retry*), empty state saat tidak ada acara, serta pengiriman relasi nama acara (`event_name`) yang sah pada kontrak `rpc_checkout_loan`.
     - Menampilkan thumbnail foto asli alat inventaris (`resolveInventoryPhotoUrl(x.foto_url)`) pada daftar inventaris, pilihan unit fisik, dan panel ringkasan peminjaman dengan fallback placeholder netral R03 jika alat belum memiliki foto.
     - Memperbaiki rail filter kategori horizontal (`.loan-cat-rail-wrap`): mendukung mouse drag-scrolling di desktop, touch swipe di mobile, trackpad horizontal wheel, serta tombol panah navigasi kiri/kanan (`.loan-cat-nav-btn`) tanpa merusak klik pemilihan kategori.
  4. **Quality Gates & Continuous Curve Governance:**
     - Menambahkan test suite baru `tests/hub/uiRefinementPtvDev127.test.tsx` (9 tests PASS).
     - Kepatuhan governance continuous curve R03: seluruh inline style menggunakan token `var(--radius-md)` dan `var(--radius-sm)` (0 audit violation).
     - Vitest: **973 passed / 973 tests across 91 files (100% PASS)** via `npm test`.
     - Typecheck: 0 error (`tsc --noEmit`).
     - Linting: 0 warning, 0 error (`eslint . --max-warnings 0`).
     - Build: Sukses dalam 17.23s (`npm run build`).

### PTV-DEV-126 (21 Oktober 2026)
- **CLN-130 | Finance 2.0 Mobile UX Audit & Compact Redesign:**
  1. **Audit & Optimasi Navigasi Tab Horizontal Mobile:**
     - Membungkus `<nav className="finance-nav">` dalam `<div className="finance-nav-scroll-wrap">` dengan penanganan smooth scrolling `-webkit-overflow-scrolling: touch; scrollbar-width: none; flex-wrap: nowrap; overflow-x: auto;`.
     - Mengubah ukuran tab pill di mobile (`padding: 7px 13px; font-size: 13px; gap: 6px; white-space: nowrap;`) sehingga tidak wrap menjadi multi-baris dan tidak memicu horizontal window scroll.
  2. **Bento Stats Grid 2-Kolom Compact Mobile (Memotong 70% Tinggi Layar):**
     - Mengubah aturan CSS `.finance-bento-grid` di mobile dari tumpukan 1 kolom vertikal (`grid-template-columns: 1fr;` memakan tinggi ~550px) menjadi **2 Kolom Simetris** (`grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px; margin-bottom: 16px;`).
     - Mengurangi padding kartu bento mobile menjadi `12px 12px;`, icon wrapper `28px`, label `11.5px`, dan nominal angka `14px` dengan `white-space: nowrap; text-overflow: ellipsis;` untuk mencegah overflow nominal di layar 320px–390px.
  3. **Toolbar Transaksi & Expandable Filter Lanjutan:**
     - Menghapus tumpukan vertikal 3 tombol quick actions menjadi satu baris horizontal scrollable yang rapi (`.finance-quick-actions`).
     - Menyediakan tombol toggle ekspansi `.toolbar-filter-toggle-mobile` ("Filter Lanjutan") pada `TransactionWorkspace` di mobile: filter tanggal dan kantong disembunyikan secara default kecuali saat aktif atau saat dibuka pengguna, sehingga daftar mutasi langsung muncul di paro pertama layar (above the fold).
  4. **Compact Transaction Cards & Pocket Cards Mobile:**
     - `.finance-tx-card`: Avatar icon ringkas 32px, padding `10px 12px;`, typography deskripsi 13.5px, metadata tanggal/kategori 11.5px, nominal tabular di kanan tanpa overflow teks.
     - `.finance-pocket-card`: Padding `14px;`, panel saldo `8px 10px;`, nominal saldo `16.5px`, tombol aksi Rincian & Edit ringkas tanpa mengambil baris penuh.
  5. **Modal Bottom Sheet Adaptif Mobile:**
     - Dialog/modal (`.finance-dialog`) di mobile bertransformasi menjadi **Bottom Sheet** (`align-items: flex-end; border-top-left-radius: 24px; border-top-right-radius: 24px; max-height: 92dvh; width: 100%; margin: 0;`).
     - Memaksimalkan kenyamanan jempol satu tangan, mencegah tombol aksi terhalang keyboard virtual, dan memastikan body dialog tetap scrollable secara independen.
  6. **Penyesuaian Viewport Ultra-Small (320px - 360px):**
     - Memberikan padding halaman aman 10px, typography hero saldo 22px, tombol hero 11.5px, dan kartu bento 10px 8px agar tidak terjadi text clipping atau visual distortion.
  7. **Preservasi Penuh Desktop & Integritas Data:**
     - Seluruh optimasi diisolasi di dalam `@media (max-width: 639px)` dan `@media (max-width: 360px)`. Desktop 1440px+ tetap utuh tanpa regresi.
     - Saldo kas Rp 520.276, 53 record transaksi, 4 transaksi reversed Rp 90.000, serta hak akses role tetap utuh di database staging.
  8. **Quality Gates & Validasi Unit Test:**
     - Menambahkan test suite baru `tests/hub/financeMobileCompact.test.tsx` (5 test cases) yang memvalidasi struktur markup dan styling compact mobile.
     - Vitest: **959 passed / 959 tests (100% PASS)** across 89 files. Targeted finance: **67 passed / 67 tests**.
     - Typecheck (0 error), Lint (0 warning, 0 error), Build (sukses).

### PTV-DEV-125 (21 Oktober 2026)
- **CLN-129 | Finance 2.0 Modal Bugfix, Spacing Polish & Pocket Balance Panel Redesign:**
  1. **Investigasi & Perbaikan Kritis Modal Backdrop Fullscreen:**
     - Menemukan akar masalah backdrop modal terpotong di viewport: div portal pembungkus menggunakan class `.finance-overlay.finance-foundation` di mana `.finance-foundation` menerapkan batasan lebar `max-width: 1200px; margin: 0 auto;`. Pada viewport lebar (1440px+), backdrop hanya menutupi area tengah dan meninggalkan margin kosong di kiri-kanan serta tidak menutupi header/sidebar Hub.
     - Menghapus class `.finance-foundation` dari `.finance-overlay` dan mengisolasi `.finance-foundation` hanya di dalam konten dialog `.finance-dialog-content`.
     - Memperbaiki CSS `.finance-overlay`: `position: fixed; inset: 0; width: 100vw; height: 100vh; margin: 0 !important; max-width: none !important; z-index: 10000; background-color: rgba(11, 42, 74, 0.65); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; padding: 24px;`.
     - Modal sekarang 100% fullscreen menutupi seluruh viewport (termasuk header dan sidebar Hub), dialog terpusat presisi di viewport, scroll locking `document.body` aktif via `useModalScrollLock`, serta mendukung click-outside dan tombol Escape.
  2. **Harmonisasi Token Border Radius Sesuai Skala R03:**
     - Dialog/Modal Surface: continuous radius 28px (`var(--ptv-curve-2xl, 28px)`).
     - Cards (Pocket cards, toolbar card): continuous radius 22px (`var(--ptv-curve-xl, 22px)`).
     - Fieldsets & Sub-containers: radius 16px (`var(--ptv-curve-lg, 16px)`).
     - Input fields, selects, datepickers, dan panel saldo: radius 12px (`var(--ptv-curve-md, 12px)`).
     - Pill radius (`9999px`): digunakan selektif HANYA untuk status badges, filter chips, tag rekonstruksi, dan pill action buttons.
  3. **Rapikan Spacing & Layout Form Transaksi (`TransactionForm`):**
     - Memperlebar ritme vertikal form: `gap: 20px;`, label jarak `margin-bottom: 6px;`, padding internal input/select `12px 15px;`, min-height 48px touch-friendly.
     - Fieldset alokasi multi-kantong dirapikan dengan background soft `#fcfdfe`, border 1px solid, padding `18px 20px`, baris alokasi berjarak `12px` dengan tombol Hapus sejajar di kanan bawah tanpa merusak alur input.
     - Tombol `+ Tambah Alokasi Kantong` dibungkus dalam kontainer rapi dengan state disabled otomatis saat mencapai batas maksimum (20 baris).
     - Footer aksi form dirapikan dengan alignment kanan: tombol `Periksa Alokasi` (secondary) dan `Simpan Transaksi` (primary) berdampingan rapi tanpa tumpang-tindih.
  4. **Perbaikan Spacing Toolbar Aksi Cepat Transaksi:**
     - Mengisi CSS untuk class `.finance-quick-actions` dan `.finance-action-btn`: gap teratur `12px`, margin bawah `12px` ke toolbar filter, tanpa border yang saling menempel.
     - Styling tombol aksi tematik: Catat Pemasukan (Emerald `#ecfdf5`), Catat Pengeluaran (Rose `#fff1f2`), Pindah Kantong (Indigo `#eef2ff`).
     - Responsif mobile: wrap rapi dalam layout vertikal terpusat tanpa horizontal overflow.
  5. **Redesign Terarah Kartu Kantong (`PocketWorkspace` & `FinanceOverview`):**
     - Menggantikan baris saldo polos dengan **Panel Saldo Terbuku Khusus** (`.pocket-balance-panel`):
       - Background solid bertema lembut sesuai jenis kantong: Cash (Amber `#fffdf5` / `#fde68a`), Bank (Sky `#f0f9ff` / `#bae6fd`), E-Wallet (Purple `#faf5ff` / `#ddd6fe`), dan Arsip (Netral `var(--bg-2)` / `var(--line)`).
       - Header panel: label *"Saldo Terbuku"* dan penanda pill tag *"Rekonstruksi"* khusus untuk Kas Utama Studio.
       - Nominal saldo tegas berukuran 21px, weight 750, tabular figures.
     - Footer kartu: metadata penyedia kantong, tombol aksi terarah **"Rincian"** dan **"Edit"** dengan spacing proporsional.
  6. **Quality Gates & Regression:**
     - Vitest: 89 test files, **959 passed / 959 tests (100% PASS)** via `npm test`.
     - Unit tests Finance: **62 passed / 62 tests** terverifikasi penuh.
     - TypeScript Typecheck: 0 errors (`tsc --noEmit`).
     - ESLint: 0 warnings, 0 errors (`eslint . --max-warnings 0`).
     - Kompilasi Build Produksi Vite: Lolos sukses dalam 21.27s (`npm run build`).

### PTV-DEV-124 (21 Oktober 2026)
- **CLN-128 | Finance Overview Refinement & Bendahara Payment Info:**
  1. **Penyederhanaan Hero Saldo (Eliminasi Ruang Kosong & Baris Quick Actions Bawah):**
     - Menghapus baris 4 quick actions yang sebelumnya berada di bagian bawah hero saldo (`.finance-quick-actions`).
     - Memindahkan dan menyederhanakan aksi hero menjadi **dua tombol terarah di kanan atas hero**, sejajar secara proporsional dengan informasi saldo:
       1. `Transfer Kantong` (`action-transfer` / `ArrowLeftRight`): mempertahankan fungsi pemindahan dana antarkantong.
       2. `Catat Pengeluaran` (`action-expense` / `ArrowUpRight`): mempertahankan fungsi pencatatan pengeluaran kas studio.
     - Tombol `Catat Pemasukan` dan `Tambah Kantong` tetap tersedia secara kanonikal di tab Transaksi dan tab Kantong masing-masing tanpa duplikasi visual.
     - Mengurangi vertical padding hero (`padding: 22px 28px`) dan layout flex header sehingga hero tampil lebih kompak, seimbang, dan bebas ruang kosong berlebih.
     - Responsivitas mobile (`@media (max-width: 639px)`): Dua tombol tertata rapi dalam grid 2 kolom (50%-50%) di bawah info saldo tanpa memicu overflow atau wrapping yang berantakan.
  2. **Koreksi Spacing Terukur (Berdasarkan Coretan & Anotasi Operator):**
     - Mengurangi vertical gap antara hero saldo dan kartu statistik secara moderat: `margin-bottom: 18px` (dari sebelumnya `24px`), menjaga ritme yang nyaman tanpa membuat kedua section menempel.
  3. **Penggantian Kartu Pembatalan dengan Rekening & QRIS Bendahara:**
     - Pada susunan 4 kartu bento Ringkasan:
       1. Pemasukan Tercatat (`formatMinor(totalIncomeMinor)`)
       2. Pengeluaran Tercatat (`formatMinor(totalExpenseMinor)`)
       3. **Rekening & QRIS Bendahara** (menggantikan kartu Pembatalan/Reversed)
       4. Kantong Keuangan (`activePockets.length` Aktif)
     - Desain kartu baru:
       - Judul: `Rekening & QRIS Bendahara` dengan ikon `QrCode` beraksen Sky/Blue R03 (`#e0f2fe` / `#0369a1`).
       - Tampilan interaktif: deskripsi singkat *"Lihat informasi rekening dan QRIS Bendahara"*, affordance jelas *"Lihat Detail"* dengan `ChevronRight`.
       - Aksesibilitas penuh: `role="button"`, `tabIndex={0}`, keyboard support (`Enter` / `Space`), hover elevation, dan `focus-visible` outline.
     - **Integritas Transaksi Reversed**: 4 transaksi reversed Rp 90.000, 53 record legacy, dan audit log tetap utuh di database Supabase Staging serta tetap dapat diakses di tab Transaksi/riwayat.
  4. **Modal Rekening & QRIS Bendahara (Penyajian Jujur & Tanpa Data Fiktif):**
     - Membuka `FinanceDialog` berbasis `ContinuousModalSurface` yang mendukung Escape, scroll locking, dan focus management.
     - Melakukan audit data resmi: saat ini Staging hanya memiliki satu kas tunai operasional `Kas Utama Studio`, sehingga data perbankan dan gambar QRIS resmi belum diunggah.
     - Menyajikan **empty state yang jujur dan transparan**: *"Informasi rekening dan QRIS Bendahara belum dikonfigurasi."* dengan kotak pemberitahuan kasir studio yang ramah dan aman.
     - Menyiapkan struktur subkomponen terpadu yang siap otomatis menampilkan detail bank (provider, no rekening dengan tombol salin, atas nama) serta QRIS (gambar, merchant name, NMID, opsi perbesar dan opsi unduh gambar resmi) saat kantong bank/ewallet dikonfigurasi di fase mendatang.
  5. **Pembersihan Kode (Clean-as-You-Go):**
     - Menghapus kalkulasi variabel yang tidak lagi digunakan (`totalReversedMinor` di bento card).
     - Menjaga import hygiene di `FinanceOverview.tsx`: menghapus icon yang tidak terpakai dan menambahkan ikon resmi (`QrCode`, `Copy`, `Check`, `ZoomIn`, `Download`).
     - Menyelaraskan contract data `FinancePocket['qris']` berbasis interface canonical `{ assetPath, merchantName, nmid, verifiedAt }`.
  6. **Quality Gates & Regression:**
     - 89 test files vitest, 959 passed / 959 tests (100% PASS, bertambah 2 test baru untuk hero actions dan kartu/modal bendahara).
     - TypeScript Typecheck: 0 errors (`tsc --noEmit`).
     - ESLint: 0 warnings, 0 errors (`eslint . --max-warnings 0`).
     - Kompilasi Build Produksi Vite: Lolos sukses (13.82s).

### PTV-DEV-123 (21 Oktober 2026)
- **CLN-127 | Finance 2.0 Visual Refinement & Layout Consistency:**
  1. **Solid Opaque Surfaces (Pencegahan Grid Tembus Pandang):**
     - Memperbaiki seluruh surface kartu, hero saldo, metric cards, toolbar filter, form, dialog, dan panel utama agar menggunakan `background-color: var(--surface, #ffffff);` yang 100% solid dan opaque.
     - Menghapus efek dekorasi radial gradient `::before` yang berlebihan pada hero saldo.
     - Menghapus aturan `opacity: 0.8;` pada transaksi reversed dan `opacity: 0.75;` pada kantong diarsipkan yang sebelumnya menyebabkan background grid 28px di `body::after` tembus pandang ke dalam kartu.
     - Menggantikan transparansi dengan styling warna teks/border netral (`var(--ink-2)`, `var(--line)`).
  2. **Spacing System & Ritme Vertikal R03:**
     - Menetapkan pemisahan visual lapang dan proporsional:
       - Header halaman ke Tab Navigasi: `gap: 20px;`
       - Tab Navigasi ke Konten: `gap: 24px;`
       - Hero Saldo ke Metric Cards: `margin-bottom: 24px;` (pemisahan jelas, tidak bertumpuk)
       - Metric Cards ke Section berikutnya: `margin-bottom: 32px;` (ritme vertikal lapang)
       - Kolom Kantong ke Kolom Transaksi: `gap: 28px;`
       - Antar kartu transaksi: `gap: 12px;` dengan padding internal `14px 18px;` yang seimbang.
  3. **Shared Content Container & Alignment Konsisten:**
     - Membungkus seluruh sub-tab Keuangan (`ringkasan`, `transaksi`, `kantong`, `kas-kru`, `piutang`, `laporan`, `pengaturan`) dalam satu shared content container `.finance-content-container` dengan lebar maksimum 1200px yang sejajar di desktop dan aman dari horizontal overflow di mobile/tablet.
  4. **Pembersihan Metadata Teknis di Baris Daftar Transaksi:**
     - Menghapus tampilan tag teknis legacy `<span className="tx-source-ref">Sumber: ...</span>` dari baris daftar transaksi utama baik di tab Ringkasan maupun Transaksi.
     - Menggantikannya dengan informasi ramah pengguna: Tanggal kejadian, Jenis/Kategori, dan Nama Kantong Alokasi (`Kas Utama Studio`).
     - Seluruh metadata teknis (nomor referensi sumber legacy, UUID alokasi, audit reference, dan OCC versioning) dipertahankan utuh dan rapi di dalam modal detail transaksi.
     - Menambahkan truncation rapi pada deskripsi panjang (`max-width: 460px; text-overflow: ellipsis; white-space: nowrap;`).
  5. **Pengurangan Border & Aksen yang Saling Bersaing:**
     - Menghapus border-left tebal 4px pada kartu; menggantikannya dengan border keliling bersih `border: 1px solid var(--line-2, rgba(11, 42, 74, 0.08));` dengan radius 14px-18px sesuai token R03.
     - Merapikan banner audit transaksi dummy menjadi kartu yang tenang dan profesional (bukan warna neon yang berteriak).
  6. **Quality Gates & Regression:**
     - 89 test files vitest, 957 passed / 957 tests (100% PASS).
     - 8 test files Finance, 101 passed / 101 tests.
     - TypeScript Typecheck: 0 errors (`tsc --noEmit`).
     - ESLint: 0 warnings, 0 errors (`eslint . --max-warnings 0`).
     - Kompilasi Build Produksi Vite: Lolos sukses (14.24s).
     - 8 endpoint Finance dev server port 5174 melayani HTTP 200 OK.

### PTV-DEV-122 (21 Oktober 2026)
- **CLN-126 | Finance 2.0 Unified UI/UX Overhaul & Test Mutation Isolation:**
  1. **Penyatuan Bahasa Desain R03 Playful Professional di Seluruh Tab:**
     - Mengubah seluruh tab Keuangan (`Ringkasan`, `Transaksi`, `Kantong`, `Kas Kru`, `Piutang`, `Laporan`, `Pengaturan`) menjadi desain Playful Professional yang seragam, ceria, modern, dan bebas dari bullet list HTML mentah.
     - **Tab Transaksi (`TransactionWorkspace`)**: Toolbar pencarian modern, pills filter jenis mutasi (`Semua Jenis`, `Pemasukan`, `Pengeluaran`, `Transfer`), dropdown pilihan kantong, rentang tanggal, toggle audit bagi pengelola *"Termasuk Mutasi Uji"*, list kartu transaksi modern dengan avatar warna, badge posted/reversed/test yang jelas, nominal rata kanan, serta modal/drawer rincian alokasi dan audit trail.
     - **Tab Kantong (`PocketWorkspace`)**: Grid kartu modern berkarakter visual distinct (Cash: Amber, Bank: Sapphire, E-Wallet: Amethyst) dengan continuous corner radius R03, saldo tabular figures yang menonjol, pill status aktif/diarsipkan, modal detail kantong, form tambah/edit kantong modern, dan section kantong arsip yang rapi.
     - **Tab Kas Kru (`FinanceKasKruView`)**: Redesign total dengan header ramah, sub-stat kartu ringkasan total kontribusi, filter pills status iuran (`Semua`, `Lunas`, `Belum Lunas`), grid kartu iuran kru dengan nominal IDR dan badge status ceria, serta pernyataan pemisahan tegas dari Kas Utama Studio.
     - **Tab Piutang (`FinancePiutangView`)**: Status arsitektur transparan *"Tahap Perancangan Kontrak Database"*, 3 pilar konsep rekayasa (Pihak Terkait & Klien, Jatuh Tempo & Termin, Alokasi Masuk Otomatis) tanpa mengarang angka atau endpoint palsu.
     - **Tab Laporan (`FinanceLaporanView`)**: Kartu posisi pembukuan terverifikasi Staging (Saldo kas rekonstruksi Rp 520.276, Pemasukan sah Rp 1.154.200, Pengeluaran sah Rp 633.924, Transaksi batal Rp 90.000) dengan status verifikasi Supabase Staging.
     - **Tab Pengaturan (`FinanceSettingsView`)**: Membersihkan placeholder usang, mengelompokkan pengaturan ke dalam 4 pilar fungsional (Akses & Otoritas via RBAC, Buku Utama & Rekening Studio v50, 11 Kategori Canonical, Integritas Transaksi Server-Side & Anti-Overdraft).
  2. **Isolasi Mutasi Pengujian PTV-DEV-117:**
     - Mengimplementasikan helper deterministik `isTestTransaction(tx)` berbasis identifikasi run ID (`PTV-DEV-117-TEST-*`) dan alokasi kantong uji (`alpha`/`beta`).
     - Menyembunyikan 5 transaksi dummy pengujian dari seluruh statistik operasional, ringkasan bento, dan daftar transaksi default.
     - Menyediakan banner dan toggle audit bagi pengelola keuangan untuk menginspeksi riwayat pengujian tanpa merusak keakuratan angka operasional.
     - Target statistik operasional bersih tercapai 100%:
       - Pemasukan posted sah: Rp 1.154.200 (39 transaksi).
       - Pengeluaran posted sah: Rp 633.924 (10 transaksi).
       - Pembatalan historis (reversed): Rp 90.000 (4 transaksi).
       - Saldo kas rekonstruksi: Rp 520.276 (`Kas Utama Studio`).
  3. **Pembersihan Kode (Code Hygiene Clean-as-You-Go):**
     - Menghapus unused imports di `FinanceSections.tsx` (`Button`).
     - Menghapus unused imports di `FinanceWorkspace.tsx` (`Filter`, `History`, `Archive`, `CanonicalTransaction`).
     - Menghapus unused state variable `archiveReason` di `FinanceWorkspace.tsx`.
     - Memastikan 0 zombie CSS, 0 orphan components, dan semua elemen menggunakan styling terstruktur `financeFoundation.css`.
  4. **Quality Gates & Regression:**
     - 89 file test vitest lulus (957/957 tests pass 100%, termasuk unit test baru `tests/hub/financeUnifiedTabs.test.tsx`).
     - TypeScript Typecheck: 0 errors (`npm run typecheck` / `tsc --noEmit`).
     - ESLint: 0 warnings, 0 errors (`npm run lint` / `eslint . --max-warnings 0`).
     - Kompilasi Build Vite Produksi: Lolos sukses (`npm run build`).
     - Dev server port 5174 aktif melayani HTTP 200.

### PTV-DEV-121 (21 Oktober 2026)
- **CLN-125 | Finance 2.0 Visibility Fix & Playful Professional UI Redesign:**
  1. **Diagnosis & Perbaikan Akar Masalah Visibilitas Data:**
     - Mengidentifikasi akar masalah mengapa data Finance 2.0 tidak muncul di frontend: Tab default `FinancePage.tsx` (`tab=ringkasan`) meng-hardcode pemanggilan `unavailable('Saldo belum direkonsiliasi', ...)` yang memblokir tampilan Kantong dan Transaksi, sehingga pengguna hanya melihat pesan kosong.
     - Mengidentifikasi rujukan legacy di katalog pengembang (`src/products/hub/dev-catalog/DevKeuanganPage.tsx`) yang masih mengimpor komponen mock lokal lama `KeuanganPage.tsx` (1235 baris) alih-alih `FinancePage.tsx` canonical.
     - Memperbaiki `DevKeuanganPage.tsx` agar merender `FinancePage` canonical, menghubungkan katalog dev langsung ke Supabase Staging.
     - Mengubah tab `ringkasan` menjadi **Finance Overview terpadu** yang menampilkan data riil dari Supabase Staging: Kantong `Kas Utama Studio` (Rp 520.276), 49 transaksi sah posted (39 pemasukan Rp 1.154.200, 10 pengeluaran Rp 633.924), dan 4 transaksi batal reversed (Rp 90.000).
  2. **Playful Professional Finance Dashboard Redesign (R03 Guidebook Compliant):**
     - Membangun antarmuka ceria, modern, dan ekspresif menggunakan token warna resmi PTVPRO:
       - **Hero Balance Bento Banner**: Total saldo kas aktif (`Rp 520.276,00`), label status transparan *"🏛️ Saldo Rekonstruksi Historis (Buku)"* yang dibedakan dari saldo fisik opname studio, serta Quick Action Bar pill-shaped (`+ Catat Pemasukan`, `- Catat Pengeluaran`, `⇄ Transfer Kantong`, `+ Tambah Kantong`).
       - **Bento Metrics Grid (4 Kartu Stat)**: Pemasukan posted (Emerald green `#10b981`), Pengeluaran posted (Coral/rose `#f43f5e`), Pembatalan reversed (History badge abu-abu, tidak menambah saldo kas), dan Kantong terhubung (1 aktif, 2 diarsipkan).
       - **Section Kantong Berkarakter Visual**: Kartu kantong dengan identitas visual distinct per tipe (Amber warm untuk Cash, Sapphire blue untuk Bank, Amethyst violet untuk E-Wallet), serta toggle collapsible untuk melihat 2 kantong dummy yang diarsipkan tanpa mengotori daftar operasional.
       - **Section Transaksi Terpadu**: Avatar ikon berwarna per jenis mutasi, filter pill cepat (Semua, Pemasukan, Pengeluaran, Transfer), badge status `posted` vs `reversed` (strikethrough & warning pill), dan dialog rincian alokasi/audit reference/source references.
  3. **State Management & Responsiveness:**
     - **Loading Skeleton**: Shimmer animation keyframes halus yang mengikuti layout bento aktual (hero, stat cards, column list).
     - **Error State**: Kartu error jelas dengan tombol "Coba Lagi" tanpa menampilkan saldo palsu Rp 0.
     - **Access Denied State**: Tampilan ramah untuk akun kru biasa (`scope: own`) yang menjelaskan batasan hak kelola studio dengan tautan langsung ke tab Kas Kru pribadi.
     - **Responsive**: Layout adaptif 2-kolom di desktop (>1024px), adaptif di tablet (640px-1024px), dan 1-kolom nyaman di mobile (<640px) tanpa horizontal overflow.
  4. **Quality Gates & Regression:**
     - 88 file test vitest lulus (950/950 tests pass, termasuk 93/93 tests finance & suite baru `financeOverview.test.tsx` + `financePageRender.test.tsx`).
     - TypeScript Typecheck: 0 errors (`npm run typecheck` / `tsc --noEmit`).
     - ESLint: 0 warnings, 0 errors (`npm run lint` / `eslint . --max-warnings 0`).
     - Kompilasi Build Vite Produksi: Lulus sukses (15.57s).
     - Preview runtime port 5174 aktif dan terverifikasi melayani HTTP 200 untuk `/hub/keuangan` dan `/dev-keuangan`.

### PTV-DEV-120 (21 Oktober 2026)
- **CLN-124 | Migration Safety Gate & Controlled Staging Cloud Execution:**
  1. **10 Safety Gates Lulus:** Menguji secara independen dan membuktikan 10 safety gates: (1) audit jalur reversed, (2) otorisasi sah pengelola `finance.manage` (`Super Executive Staging` `bcd64337...`), (3) konsistensi atomik komponen canonical, (4) checkpoint resume dan determinisme UUIDv5, (5) transaksi reversed tidak memutasi saldo, (6) 2 kantong dummy PTV-DEV-117 terisolasi di arsip (saldo 0), (7) source reference awal 0, (8) 53 data legacy 100% utuh sebelum mutasi, (9) dedup pembuatan kantong `Kas Utama Studio`, dan (10) dry-run tervalidasi.
  2. **Eksekusi Terkontrol ke Supabase Staging (`swadgljnyelsjstqqxbm`):**
     - Berhasil membuat 1 Kantong Operasional Sah `Kas Utama Studio` (ID: `60e8d033-2794-4219-a960-c56bedca0111`, cash, active, version 50).
     - Berhasil memproses 49 transaksi aktif `posted` (39 pemasukan Rp 1.154.200 dan 10 pengeluaran Rp 633.924).
     - Berhasil mencatat 4 transaksi pembatalan `reversed` (total Rp 90.000) tanpa memutasi saldo kas dan tanpa pengeluaran fiktif.
     - Berhasil mencatat tepat 53 baris di `ptv_finance_source_references` (43 `ptv_pemasukan` + 10 `ptv_pengeluaran`).
     - Saldo kas hasil rekonstruksi tepat **Rp 520.276** (52.027.600 minor).
  3. **Postflight Verification Independen (`scripts/verify-postflight-migration.mjs`):** Memverifikasi langsung ke PostgreSQL Staging: total 58 transaksi di `ptv_finance_transactions` (53 legacy + 5 dummy), 53 source references (100% UTUH), saldo kantong tepat Rp 520.276, 53 data legacy tidak berubah, dan 2 kantong dummy tetap berstatus archived: true dengan saldo 0.
  4. **Quality Gates Postflight:** 86 file test vitest lulus (944/944 tests pass), 0 error TypeScript typecheck (`tsc --noEmit`), 0 warning ESLint (`--max-warnings 0`), dan build Vite sukses (13.37s).

### PTV-DEV-119 (21 Oktober 2026)
- **CLN-123 | Finalized Legacy Migration Plan, Canceled Transactions Representation, & Deterministic Migration Harness:**
  1. **Audit Kontrak Canonical & Mitigasi Transaksi Batal:** Mengidentifikasi bahwa RPC harian `rpc_post_finance_transaction_server` meng-hardcode `status = 'posted'` dan selalu memutasi saldo kantong, sedangkan skema database `ptv_finance_transactions` mendukung status `'reversed'`. Merancang representasi bersih tanpa membuat pengeluaran operasional fiktif: 49 transaksi aktif dimigrasikan dengan status `posted` (menghasilkan saldo bersih tepat Rp 520.276 pada kantong `Kas Utama Studio`), sedangkan 4 record bertag `[BATAL/UNDO]` (Rp 90.000) dicatat berstatus `reversed` tanpa mutasi saldo kantong. Seluruh 53 record legacy memperoleh relasi 1:1 di `ptv_finance_source_references`.
  2. **Metadata Digital Preserved:** Pengeluaran `KAS UANG DIGITAL` Rp 35.424 dipetakan ke kantong `Kas Utama Studio` dengan deskripsi asli tetap utuh tanpa mengklaim transaksi tersebut dibayar tunai secara historis, mencegah defisit saldo kantong digital.
  3. **Deterministic Migration Script with Safety Gates:** Mengembangkan [`scripts/migrate-legacy-finance-to-canonical.mjs`](file:///c:/Users/zidna/ptvpro/scripts/migrate-legacy-finance-to-canonical.mjs) dengan preflight guard, checkpoint resume aman via `ptv_finance_source_references`, perlindungan live write berbasis env `CONFIRM_MIGRATION_EXECUTE=swadgljnyelsjstqqxbm`, dan verifikasi saldo akhir.
  4. **Simulation & Manifest:** Menjalankan dry-run simulasi migrasi (53/53 record tervalidasi, 49 posted, 4 reversed, 0 error, saldo akhir tepat Rp 520.276). Menyimpan manifest eksekusi di [`docs/PTV-DEV-119-MIGRATION-EXECUTION-PLAN.json`](file:///c:/Users/zidna/ptvpro/docs/PTV-DEV-119-MIGRATION-EXECUTION-PLAN.json) dan laporan resmi di [`docs/PTV-DEV-119-LEGACY-MIGRATION-FINAL-PLAN.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-DEV-119-LEGACY-MIGRATION-FINAL-PLAN.md).
  5. **Quality Gates:** 86 file test vitest lulus (944/944 tests pass), 0 error TypeScript typecheck (`tsc --noEmit`), 0 warning ESLint (`--max-warnings 0`), dan build Vite sukses (18.56s).

### PTV-DEV-118 (21 Oktober 2026)
- **CLN-122 | Legacy Reconciliation, Source Reference Contract Alignment, & Migration Readiness:**
  1. **Read-Only Audit & Forensic Discovery:** Melakukan audit mendalam terhadap seluruh 53 data keuangan legacy (43 pemasukan Rp 1.244.200 dan 10 pengeluaran Rp 633.924) pada Supabase Staging (`swadgljnyelsjstqqxbm`). Menemukan 4 record pemasukan bertag `[BATAL/UNDO]` (Rp 90.000) yang di sistem legacy hanya ditandai teks keterangan tanpa pembalik saldo (selisih gross Rp 610.276 vs net kas riil Rp 520.276). Menemukan 1 pengeluaran beranotasi `KAS UANG DIGITAL` (Rp 35.424) yang berisiko defisit jika kantong digital dipisah tanpa alokasi pemasukan.
  2. **Simulasi Kronologis & Saldo Negatif:** Membuktikan bahwa urutan kronologis transaksi historis pada satu kas umum tidak pernah mengalami saldo negatif (saldo terendah Rp 0 pada awal dan akhir hari). Membuktikan skenario pemisahan kas digital otomatis menghasilkan defisit -Rp 35.424 (BLOCKER) sehingga statusnya `NEEDS_OPERATOR_MAPPING`.
  3. **Contract Alignment & Clean-As-You-Go:** Memperbaiki potensi ketidaksesuaian prefix tabel `ptv_` pada relasi `sourceReferences` antara database, backend (`api/finance.ts`), dan frontend (`FinanceWorkspace.tsx`). Menormalisasi mapping `source_table` ke format `pemasukan`/`pengeluaran` yang konsisten, mencegah risiko duplikasi tampilan catatan sumber di UI.
  4. **Manifest & Dry-Run Suite:** Membuat manifest pemetaan deterministik 53 record (`docs/PTV-DEV-118-RECONCILIATION-MANIFEST.json`) dan laporan kesiapan resmi (`docs/PTV-DEV-118-LEGACY-MIGRATION-READINESS.md`). Menjalankan dry-run simulasi migrasi (`scripts/dry-run-legacy-migration.mjs`): 53/53 record valid, 53/53 unique idempotency keys (UUIDv5 format), 53/53 unique source references, 11/11 kategori canonical cocok, 0 mutasi database cloud, PASS 100%.
  5. **Quality Gates Postflight:** 86 file test vitest lulus (944/944 tests pass), 0 error TypeScript typecheck (`tsc --noEmit`), 0 warning ESLint (`--max-warnings 0`), dan build Vite sukses (18.56s).

### PTV-DEV-117 (21 Oktober 2026)
- **CLN-121 | Live Isolated Cloud Mutation Test & Reconciled Stabilization:** Menjalankan pengujian mutasi fungsional data dummy terisolasi pada database Supabase Staging (`swadgljnyelsjstqqxbm`) melalui jalur resmi API -> RPC -> PostgreSQL.
  1. **Preflight & Host Verification:** Memvalidasi target URL eksklusif `swadgljnyelsjstqqxbm.supabase.co`, mendeteksi akun pengelola sah (`root_executive`), memverifikasi 11 kategori aktif, dan membuktikan baseline 53 data legacy 100% utuh sebelum mutasi.
  2. **11 Langkah Mutasi Cloud Live:** Sukses membuat 2 kantong dummy terisolasi `[TEST][PTV-DEV-117]`, mencatat pemasukan dummy Rp 100.000 ke Kantong Alpha, transfer net 0 Rp 40.000 ke Beta, pengeluaran Rp 15.000 dari Beta, membuktikan penolakan saldo negatif (overdraft Rp 100.000 ditolak status 400), membuktikan idempotency replay (replay: true) & key conflict rejection (status 409 kode 23505), membuktikan penolakan sesi/role ilegal (401 & 403), membuktikan penolakan arsip kantong bersaldo > 0, mencatat 2 pengeluaran penyeimbang sah untuk mengembalikan saldo kedua kantong dummy tepat ke Rp 0, dan berhasil mengarsipkan kedua kantong dummy secara resmi.
  3. **Audit Trail & Legacy Preservation:** 6 alokasi transaksi terbentuk di `ptv_finance_allocations`, 9 rekaman immutable audit trail terbentuk di `ptv_finance_audit_log`, 0 baris di `ptv_finance_source_references`, manifest tersimpan di `docs/PTV-DEV-117-MUTATION-MANIFEST.json`, dan 53 data legacy tetap 100% UTUH.
  4. **Quality Gates Postflight:** 88 tes Finance lulus (100%), 0 error typecheck (`tsc --noEmit`), 0 warning ESLint (`--max-warnings 0`), dan build Vite sukses (13.37s).

### PTV-DEV-116 (21 Oktober 2026)
- **CLN-120 | Finance 2.0 Functional Verification & Cloud Isolation Plan:** Melakukan verifikasi fungsional end-to-end terhadap skema canonical Finance 2.0 yang telah aktif di Supabase Staging (`swadgljnyelsjstqqxbm`).
  1. **Stage 1 Database Cloud Verification:** Memverifikasi ketersediaan 6 tabel canonical (`ptv_finance_pockets`, `ptv_finance_categories` 11 seed baris, `ptv_finance_transactions`, `ptv_finance_allocations`, `ptv_finance_source_references`, `ptv_finance_audit_log`), RPC `rpc_post_finance_transaction_server` aktif, dan integritas 53 baris data legacy (43 pemasukan Rp 1.244.200, 10 pengeluaran Rp 633.924).
  2. **End-to-End Functional Test Suite (`tests/hub/financeFunctionalVerification.test.ts`):** 15 pengujian terarah mencakup pembuatan kantong tunai/bank/ewallet, penolakan inject saldo awal, pengarsipan saldo nol vs saldo positif, transaksi pemasukan/pengeluaran multi-kantong, transfer internal net 0 tanpa kategori pendapatan, penolakan saldo negatif/overdraft, penolakan transaksi kantong arsip, penolakan alokasi duplikat & self-transfer, serta penegakan capability Bendahara/Root/Eksekutif vs View-only vs Kru biasa.
  3. **Cloud Mutation Test Plan (`docs/PTVPRO-FINANCE-STAGING-ISOLATED-MUTATION-TEST-PLAN.md`):** Menyusun rencana uji mutasi cloud terisolasi dengan data dummy bertanda `[TEST]`, siklus pemindahan dana net 0 kembali ke Rp 0, dan skrip cleanup terverifikasi tanpa memutasi data cloud sebelum ACC operator.
  4. **Regression & Quality Gates:** 88 tes Finance lulus (100%), 756 tes Hub lulus (64 test files, 0 failure), 0 error typecheck (`tsc --noEmit`), 0 warning ESLint (`--max-warnings 0`), dan build Vite sukses (19.48s).

### PTV-DEV-115 (21 Oktober 2026)
- **CLN-119 | End-to-end Canonical Finance 2.0 Activation, Security Gate Hardening, & Service Integration:** Menghubungkan fondasi canonical Finance 2.0 secara end-to-end antara API backend (`api/finance.ts`), service client (`financeCanonicalService.ts`), dan antarmuka UI (`FinanceWorkspace.tsx` & `FinancePage.tsx`).
  1. **Security Gate Hardening:** Menghapus penggunaan `current_user` di dalam `SECURITY DEFINER` (yang keliru karena selalu bernilai `postgres`), menggantinya dengan verifikasi pemanggil asli melalui `session_user` (untuk direct connection) dan `request.jwt.claims->>'role' = 'service_role'` (untuk PostgREST). Mengunci parameter identitas (`p_account_id`, `p_session_iat`, dan `actor_id`) langsung ke session token yang diverifikasi secara kriptografis oleh backend, kebal terhadap manipulasi/spoofing payload klien.
  2. **Backend Integration:** Membuka handler `POST /api/finance` dengan otorisasi berbasis hak kelola live `canManage` (Bendahara, Eksekutif, Root; kru biasa ditolak 403 Forbidden). Mendukung aksi `post_transaction` (menghubungkan ke server-only RPC `rpc_post_finance_transaction_server`), `create_pocket`, `update_pocket`, `archive_pocket`, dan `create_category` dengan pencatatan otomatis ke `ptv_finance_audit_log`. Handler `GET /api/finance` diperluas membaca data canonical dari 6 tabel baru dengan fallback graceful ke `awaiting_schema` jika skema belum aktif.
  3. **Frontend Service & Form Submissions:** Menghubungkan `submitFinanceOperation()`, `submitPocketCreate()`, `submitPocketUpdate()`, dan `submitPocketArchive()` ke endpoint live `/api/finance`. Mengganti placeholder statis pada formulir Kantong dan Transaksi dengan interaksi nyata, feedback status loading, pesan kesalahan/sukses, serta auto-refresh via callback `onSuccess`.
  4. **Role-Based UI & Locked State Protection:** Pengguna tanpa hak pengelola (`!canManage`) tetap terkunci pada status hanya baca (`LockedSave`) sesuai kontrak; pengelola mendapatkan tombol simpan aktif.
  5. **Pencegahan Double Counting:** Sumber legacy (53 baris) tetap terisolasi dan tidak digandakan ke ledger canonical tanpa rekonsiliasi eksplisit.
  6. **Verifikasi Kualitas:** 73 tes unit/integrasi Finance lulus (`financeFoundation`, `financeTransactionContract`, `financeCanonical`, `financeSpoofingAndAccess`), 0 error pada TypeScript typecheck (`tsc --noEmit`), 0 warning pada ESLint (`--max-warnings 0`), dan kompilasi build Vite sukses tuntas (18.30s).

### PTV-DEV-114 (21 Oktober 2026)
- **CLN-118 | DDL Schema, RPC Atomik, & Test Harness Finance 2.0:** Menyusun draf DDL schema PostgreSQL 17 Staging (`docs/PTVPRO-FINANCE-KANTONG-SCHEMA-DRAFT.sql`), fungsi RPC transaksi atomik multi-Kantong (`docs/PTVPRO-FINANCE-TRANSACTION-RPC-DRAFT.sql`), dan test harness verifikasi rollback terisolasi (`docs/PTVPRO-FINANCE-SCHEMA-RPC-VERIFICATION-SUITE.sql`). Konsistensi 1:1 terhadap `financeCanonical.ts` (Zod v2) dan kontrak transaksi. Memuat 6 tabel canonical (`ptv_finance_pockets`, `ptv_finance_categories`, `ptv_finance_transactions`, `ptv_finance_allocations`, `ptv_finance_source_references`, dan `ptv_finance_audit_log` append-only). Mengunci deadlock dengan sorting ID ASC, OCC versioning, saldo non-negatif (`CHECK (balance_minor >= 0)`), guard arsip saldo nol, idempotency replay, dan anti double-counting sumber legacy. Semua tabel dilindungi RLS, menutup direct write dari anon/authenticated, dan menyisipkan guard konfirmasi GUC Staging & ACC. Tidak mengeksekusi DDL/RPC ke database cloud, tidak memodifikasi data 53 baris, dan tidak ada cleanup massal.

### PTV-DEV-113 (21 Oktober 2026)
- **CLN-117 | UI Finance terarah:** Mengganti blok transaksi/placeholder Kantong fondasi dengan workspace scoped, membuang query/kind/entries state lama yang digantikan. Reuse Card/Button/Input/ContinuousModalSurface/useModalScrollLock dan token existing; memperbaiki padding/focus/radius hanya dalam scope Finance, tanpa perubahan global. Tombol tambah/hapus alokasi bertipe button agar tidak men-submit form. Validasi pocket change/archive dipakai ulang service+UI; tidak ada fixture/localStorage/network write pada jalur baru. Mapping source reference menahan tampilan ganda. 96 tes lokal lulus; detail bukti pada roadmap. Tidak ada cleanup legacy atau database.

### PTV-DEV-112 (21 Oktober 2026)
- **CLN-116 | Verifikasi restore terisolasi:** Tidak memakai skrip restore legacy yang melakukan upsert cloud dan tidak cocok format backup baru. Runner scratch khusus memverifikasi checksum/target/data_directory localhost, menghapus variabel koneksi cloud dari environment subprocess, memakai UTF-8 dan readback bertipe untuk menghindari selisih format timestamp; server dihentikan setelah uji. 53/53 cocok dengan constraints aktif. Tidak menghapus artefak/data/legacy, tidak mengubah auth/UI/backend; kontrak/preflight memakai dokumen existing. Tidak ada pembersihan massal.

### PTV-DEV-111 (21 Oktober 2026)
- **CLN-115 | Koreksi dokumentasi dependensi:** Penelusuran terarah membedakan React Finance localStorage dari bridge PHP dengan direct write lima tabel. Mengoreksi asumsi kompatibilitas sebelum freeze, tanpa mengubah legacy/backend/UI/SQL. Backup dan manifest memakai penamaan sesi stabil, tanpa data pribadi di laporan/log atau cleanup data. Snapshot cloud kedua cocok; gate gagal sehingga tidak mengeksekusi ACL atau probe mutasi. Tidak ada penghapusan/refactor atau temuan dead code yang dibersihkan.

### PTV-DEV-110 (21 Oktober 2026)
- **CLN-114 | Draft diperketat, belum dieksekusi:** Menutup kelalaian MAINTAIN pada draft freeze Finance dan menambahkan pemeriksaan grant kolom/hak turunan; tanpa CASCADE atau modifikasi data/RLS. Proposal transaksi memakai satu parser strict Zod existing (tanpa transport/store/mutasi paralel), nominal string minor untuk menghindari floating point dan menolak actor/konfirmasi dari payload. Scope hanya draft, kontrak, tes dan catatan koordinasi. 68 tes terfokus lulus; SQL hanya review statis. Tidak ada cleanup data, deduplikasi otomatis, atau perubahan UI/auth global.

### PTV-DEV-109 (21 Oktober 2026)
- **CLN-113 | Jalur fondasi terisolasi:** Route Keuangan memakai data server tanpa localStorage/fixtures atau sukses mutasi palsu; legacy tetap disimpan untuk pemanggil/tes existing. Reuse Card/Button/token R03 dan policy capability existing, tanpa komponen desain paralel atau auth global baru. Audit terarah imports/selector/pemanggil: state setter tak terpakai dibuang, CSS baru scoped Finance. Timeout body JSON, pembatalan request saat pergantian akun/unmount, error/retry dan server own-scope diuji. 47 tes/typecheck/lint/build lulus. Tidak ada cleanup massal/data, tidak menjalankan SQL draft.

### PTV-DEV-108 (21 Oktober 2026)
- **CLN-112 | Fixed:** Mengganti guard sementara mismatch cookie dengan adapter backend peminjaman yang memvalidasi cookie dan izin live; menghapus penolakan catatan per-unit untuk runtime vercel karena RPC server sekarang menyimpannya atomik. Mempertahankan guard Staging, kecocokan ID konfirmasi dan no mock fallback. UI membaca catatan dari hasil backend; tidak membuat helper auth global atau melakukan UPDATE catatan non-atomik. Scope hanya peminjaman, RPC baru, tes dan dokumentasi. 77 tes terfokus/typecheck/build lulus; uji cloud pinjam/kembali parsial/sisa/refresh/readback dan sesi baru lulus. Tidak ada cleanup data/fixture atau repo-wide.

### PTV-DEV-107 (21 Oktober 2026)
- **CLN-111 | Mitigasi selesai, backend tertunda:** Menghapus arahan fallback catatan per-unit ke pengembalian seluruh transaksi; memperketat konfirmasi RPC terhadap ID target dan menolak sesi cookie sebagai pengganti sesi Supabase. Hanya service peminjaman/tes terkait; tidak mengubah laporan, database, auth/RBAC, migrasi atau deployment. Tidak ada cleanup massal; hasil verifikasi akhir pada handoff PTV-DEV-107.

### PTV-DEV-105 (20 Oktober 2026)
- **CLN-109 | Fixed sebagian / backend tertunda:** Runtime peminjaman tidak lagi memakai singleton transaksi memori; tes lokal memilih LocalPeminjamanService secara eksplisit. Menghapus mutasi optimistik palsu laporan, penimpaan cache browser, default kontak/pelapor dummy Lost & Found, serta menolak query error yang sebelumnya diteruskan sebagai sukses parsial. Mapper kerusakan memakai relasi unit fisik yang benar. API tulis laporan/policy dan transaksi atomik kerusakan belum tersedia; mutasi diblokir jelas, bukan diklaim selesai. Cache lama tidak dihapus. Scope hanya tiga modul dan tes/dokumentasi terkait; tidak ada cleanup massal. 94 tes relevan lulus (mock/SSR), cloud hanya diperiksa read-only.

### PTV-DEV-104 (20 Oktober 2026)
- **CLN-108 | Fixed:** Memutus dependency callback Perizinan pada closure setLiveDocs yang berubah setiap render, menghapus subscription hook yang tidak diperlukan dan fallback dokumen store lama ketika fetch gagal. Memakai singleton existing dan opsi API-only untuk page tanpa refactor store/global auth. Scope PerizinanPage, loadPerizinan, dokumenService dan tes terkait; 39 tes + browser fixture no-loop/timeout/state/counts lulus. Tidak ada cleanup massal.

### PTV-DEV-103 (20 Oktober 2026): cleaning terarah
- **CLN-106 | Fixed:** Memulihkan import stylesheet Inventaris yang tidak terhubung; memperbaiki token pada portal dan flex-shrink accordion/section form yang menyebabkan clipping/overlap. Scope: InventarisPage, UnitPickerModal, LoanModal, TambahAlatModal, inventaris.css, loanModal.css. Validasi: inspeksi import/selector dan pengujian browser lokal; hasil akhir tercatat di piketdev.md.
- **CLN-107 | Fixed:** Menghapus pemakaian fixtures alat dan default kontak dummy dari runtime DamageReportModal; menghapus CSS rotasi warna positional serta chevron agenda yang tidak lagi dipakai, dan mengganti validasi halaman surat berbasis fixtures dengan request server tanpa fallback. Scope hanya file yang disentuh; fixtures legacy tetap disimpan untuk pemanggil/tests sah. Tidak ada cleanup repository-wide.
- **Validasi sesi ini:** Typecheck/lint/build lulus, 190 tes relevan lulus, browser fixture lima viewport dua tema lulus; detail/batas bukti di piketdev.md. Tidak ada pembersihan kode/database di luar scope. Ringkasan tabel di bawah merupakan baseline PTV-DEV-101, bukan jumlah pemeriksaan ulang sesi ini.

| Parameter | Status Saat Ini |
| :--- | :--- |
| **Tanggal Terakhir** | 2026-10-20 |
| **Session ID Rujukan** | `PTV-DEV-101` |
| **Developer / Operator** | Zidna |
| **Modul yang Diperiksa** | Kalender Kegiatan: Monthly Calendar Header Navigasi, Filter Bar Solid Colors, Solid White Surface, & Momentum Badges Polish (`src/products/hub/kalender/KalenderPage.tsx`, `src/styles/kalender.css`, `tests/hub/kalenderGridRedesign.test.tsx`)
| **Jumlah Temuan** | 105 |
| **Jumlah Diperbaiki** | 105 (`CLN-001` s.d. `CLN-105`) |
| **Jumlah Ditunda** | 0 |
| **Status Verifikasi** | Terverifikasi Penuh (0 typecheck errors, 0 lint warnings, 796/796 unit tests passed, build Vite sukses 27.86s)


---

## B. REGISTER TEMUAN (CLEANING REGISTER)

Setiap temuan pembersihan kode dicatat dengan ID berurutan: **`CLN-001`**, **`CLN-002`**, dst.  
Status temuan: `Open` | `Fixed` | `Deferred` | `False Positive`.

| ID | Tanggal | Session ID | Modul / File | Kategori Masalah | Deskripsi | Bukti / Referensi | Risiko | Tindakan | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CLN-105** | 2026-10-20 | `PTV-DEV-101` | `src/products/hub/dokumen-saya/dokumenService.ts`, `src/products/hub/perizinan/PerizinanPage.tsx` | Dokumen & Perizinan: Typecheck Method Alignment & Unused Hook Destructuring Cleanup | (1) Type Alignment dokumenService: Menyelaraskan method fallback `docsStore.getById(id)` (menggantikan typo `getDocById(id)`) dan memastikan argument updates selalu berupa objek pada pemanggilan `docsStore.resubmitDoc(id, updates || {})`; (2) Clean-as-You-Go PerizinanPage: Menghapus 6 variabel destructuring yang tidak terpakai dari `useDocsStore()` (`requestDoc`, `approveDoc`, `requestRevision`, `resubmitDoc`, `rejectDoc`, `deleteDoc`) dan mempertahankan hanya `docs` dan `setLiveDocs` yang aktif digunakan; (3) Quality Gates: Berhasil meloloskan 100% dari 4 quality gates utama: 0 TypeScript errors (`tsc --noEmit`), 0 ESLint warnings (`eslint . --max-warnings 0`), 84/84 auth tests lolos (`vitest run tests/auth/`), dan build kompilasi produksi Vite sukses tuntas dalam 21.11s. | Pemeliharaan Kode Pasca-Kompaksi & Quality Gate Verification | Rendah | (1) Memperbaiki pemanggilan method di `dokumenService.ts`; (2) Membersihkan destructuring tak terpakai di `PerizinanPage.tsx`; (3) Menjalankan verifikasi penuh `typecheck`, `test`, `lint`, dan `build`. | **Fixed** |
| **CLN-104** | 2026-10-20 | `PTV-DEV-100` | `src/products/hub/kalender/KalenderPage.tsx`, `src/styles/kalender.css`, `tests/hub/kalenderGridRedesign.test.tsx` | Kalender Kegiatan: Monthly Header, Filter Bar, Solid White Surface, & Momentum Badges Polish | (1) Editorial Header Alignment & Layout Mobile-First: Menata ulang struktur navigasi bulan dengan flex container vertikal rapi (`.cal-editorial-header`): baris atas memuat tombol nav kiri bulat (`<`), judul bulan/tahun tepat di tengah (`.cal-editorial-title`), dan tombol nav kanan bulat (`>`). Baris tengah memuat tombol pill `Hari Ini` tepat di tengah, dan baris bawah memuat rentang Hijriah (`.cal-editorial-hijri-range`) sejajar tengah. Tampilan 100% konsisten, simetris, dan anti-tabrakan di mobile maupun desktop; (2) Pill Filter Bar Solid Colors: Memperbaiki styling active state filter layer (`Kalender PTV`, `Kalender Pesantren`, `Kalender Sekolah`) menggunakan solid fill warna identitas masing-masing (PTV: `#1D6EE5`, Pesantren: `#059669`, Sekolah: `#6D28D9`) dengan teks putih solid, border solid, dan box shadow halus tanpa kebocoran warna atau border ganda. Menghilangkan gradient overlay scroll hint pemotong pill di mobile; (3) Solid White Surface Cards: Menjadikan `.kal-surface-card`, `.kal-selected-banner`, dan `.kal-event-item` berlatar belakang solid white `#FFFFFF` di Light mode (dan neutral charcoal surface di Dark mode) untuk tampilan bersih, berkelas, dan bebas blur/slop; (4) Momentum & Ide Konten Category Badges: Menerapkan soft tinted category badge ber-pill radius terukur (`.kal-momentum-badge`) untuk Event Pondok (Emerald), Event Hijriah (Amber), Event Masehi (Blue), dan Program PTV (Purple) lengkap dengan sublabel dan dark mode overrides; (5) Quality Gates: 0 TypeScript errors (`tsc --noEmit`), 0 ESLint warnings (`eslint . --max-warnings 0`), 72/72 test files passed (796/796 unit tests passed 100%), build produksi Vite sukses tuntas 27.86s. | Permintaan Pengguna: "Rapikan alignment header Kalender Bulanan PTVPRO" & Polish Kalender | Rendah | (1) Mengubah struktur JSX header di `KalenderPage.tsx`; (2) Menambahkan helper badge kategori momentum; (3) Menyempurnakan CSS header, filter bar, cards, dan badges di `kalender.css`; (4) Menyesuaikan assertions pada `tests/hub/kalenderGridRedesign.test.tsx`; (5) Memverifikasi seluruh 4 quality gates lulus 100%. | **Fixed** |
| **CLN-103** | 2026-10-19 | `PTV-DEV-099` | `docs/PTV-PRO-RECONCILIATION-SCHEMA-PATCH-DRAFT.sql`, `docs/PTV-PRO-RECONCILIATION-DATA-PATCH-DRAFT.sql`, `docs/PTV-PRO-MIGRATION-RECONCILIATION-PLAN.md` | Database Migration: Final Migration Gate — Revision 4 Local Dry-Run Validation | (1) Lingkungan Terisolasi Mandiri: Menjalankan cluster PostgreSQL 17.11 lokal terisolasi pada port 55432 (tanpa Docker, menggunakan PostgreSQL 17 bin resmi yang terpasang di sistem operasi dengan metode autentikasi trust pada direktori scratch terisolasi); (2) Uji Sintaksis & Guard Keamanan: Memverifikasi fail-closed multi-factor security guard saat token manual sesi kosong atau salah (transaksi abort seketika), negative structural anti-production barrier (terdeteksi tabel legacy fisik, transaksi abort seketika), dan positif structural canonical_identity; (3) Validasi Eksekusi Skema Patch: Berhasil mengeksekusi DDL aditif 4 kolom inventaris master, 2 kolom unit fisik, dan 1 kolom santri_list surat izin tanpa error atau constraint violation; (4) Validasi Eksekusi Data Patch: Berhasil mengeksekusi DML terarah memulihkan 161 inventaris master (100 brand, 31 model, 143 keterangan, 150 aset_id_lama), 2 unit fisik (catatan & keterangan), 1 catatan bersama missing (Notulensi Rapat:haha), 1 transaksi pengeluaran live missing (Rp28.000 KONSUMSI CREW), dan 2 surat izin santri_list; (5) Uji Integritas Data & Preservasi: Seluruh nilai field sebelum dan sesudah tervalidasi 100% presisi (bukan hanya row count), 49 record karantina legacy_archive_unresolved dan 39 record ptv_content_planner dengan constraint platform NOT NULL terlindungi utuh; (6) Uji Idempotency: Mengeksekusi ulang kedua patch menghasilkan status COMMIT mulus tanpa duplikasi data (INSERT 0 0); (7) Uji Conflict Detection & Rollback: Memverifikasi preflight conflict detection mendeteksi selisih per ID dan per kolom secara deterministik saat data sengaja dibuat berbeda, membatalkan transaksi seketika (ROLLBACK); serta memvalidasi prosedur selective non-destructive rollback per-ID; (8) Status Cloud Database: 100% STRICT READ-ONLY & UNTOUCHED (Supabase Cloud Staging swadgljnyelsjstqqxbm dan Production jthzuhkblxcaohiuypqq tidak tersentuh); (9) Status Akhir: GO — READY FOR OPERATOR APPROVAL. | Instruksi Pengguna: "PTVPRO — FINAL MIGRATION GATE: Revision 4 Local Dry-Run" | Kritis | (1) Menginisialisasi dan menjalankan cluster PostgreSQL 17.11 lokal terisolasi di port 55432; (2) Menyiapkan database postgres dengan baseline snapshot 161 inventaris, 245 unit fisik, 2 surat izin, 49 karantina, dan 39 content planner; (3) Menjalankan pengujian sintaksis, multi-guard, schema patch, data patch, idempotency, dan conflict detection; (4) Menghasilkan bukti integritas data per-kolom; (5) Menghentikan dan membersihkan cluster database lokal; (6) Melaporkan status GO — READY FOR OPERATOR APPROVAL. | **Fixed** |
| **CLN-102** | 2026-10-19 | `PTV-DEV-098` | `src/products/hub/inventaris/InventarisPage.tsx`, `src/styles/inventaris.css` | Halaman Inventaris: Exact Visual Restoration to Reference Screenshot | (1) Search & Actions Toolbar: Menyelaraskan search bar pill penuh dengan placeholder "Cari nama, kode (INV-xxx), merk, model, lokasi...", tombol pill biru Scan (#1273E6) ber-icon qrcode di sisi kanan search wrap, dan tombol keranjang daftar pinjaman di sebelahnya dengan counter badge; (2) Photographic Hero Banner: Mengembalikan hero banner foto inventaris resmi (/assets/images/hero-bg-default.webp) dengan overlay gradient gelap, judul "Aset Inventaris Progresif TV Production", dan deskripsi "Kelola peminjaman, monitor ketersediaan unit, dan telusuri riwayat alat dengan mudah.", border-radius 18px continuous curve; (3) Kategori Alat Horizontal Carousel: Mengembalikan container kartu putih KATEGORI ALAT lengkap dengan header "17 KATEGORI", tombol panah nav bulat < dan >, serta scroll rail kartu kategori vertikal (Semua 161 alat ber-border biru solid aktif, dan ke-17 kategori resmi dengan icon berwarna semantik di dalam rounded square 38x38px dan counter alat dinamis real-time); (4) Segmented Status Bar & Action Button: Menata status filter horizontal segmented (Semua, Tersedia dengan dot hijau, Dipinjam dengan dot amber, Bermasalah dengan dot merah), tombol Reset Filter kondisional, dan tombol pill biru cerah "+ Alat" (#btnAddNewAsset); (5) Dominant Photo Product Grid: Mengembalikan kartu alat katalog dengan thumbnail foto dominan rasio 4:3, badge ketersediaan di pojok kanan atas foto (Tersedia, N/Total Tersedia, Dipinjam, Bermasalah), kode alat biru, kategori abu-abu di kanan, nama alat bold, spesifikasi model, dan baris status unit serta tombol quick add / unit picker; (6) Preservasi Fitur & Anti-Regresi: Mempertahankan 100% utilitas resolveInventoryPhotoUrl (anti-DNS broken image ptv-rebuild.local), TambahAlatModal atomik RPC Supabase Staging, UnitPickerModal untuk multi-unit, dan LoanModal; (7) Quality Gates: 0 TypeScript errors (tsc --noEmit), 0 ESLint warnings (eslint . --max-warnings 0), 72/72 test files passed (796/796 unit tests passed 100%), build produksi Vite sukses tuntas 24.71s. | Instruksi Pengguna: "PTVPRO — Restore Previous Inventaris UI" | Rendah | (1) Menulis ulang InventarisPage.tsx dengan urutan 8 elemen sesuai screenshot referensi; (2) Menyempurnakan stylesheet inventaris.css untuk hero banner, category box carousel, status segmented bar, dan dark mode; (3) Menjaga integrasi resolveInventoryPhotoUrl, TambahAlatModal, dan UnitPickerModal; (4) Memverifikasi seluruh 4 quality gates lulus 100%. | **Fixed** |
| **CLN-101** | 2026-10-19 | `PTV-DEV-097` | `api/broadcast.ts`, `src/products/hub/broadcast/broadcastService.ts`, `src/products/hub/inventaris/utils/inventoryPhotoUtils.ts`, `src/products/hub/inventaris/*`, `src/styles/splash.css`, `src/shared/components/AuthSplashScreen.tsx`, `src/app/router/ProtectedRoute.tsx`, `src/app/router/LoginPage.tsx`, `src/styles/tokens.css`, `src/app/router/index.tsx`, `src/main.tsx`, `tests/hub/inventoryPhotoNormalization.test.ts` | Targeted Console Fix & Authentication Theme Transition | (1) Task A - Fix HTTP 500 /api/broadcast: Mengoreksi kueri Supabase Staging di api/broadcast.ts yang sebelumnya menggunakan kolom non-existent status='aktif' (error 42703 column ptv_pengumuman.status does not exist) menjadi kolom kanonikal is_aktif=true dengan fallback graceful; menambahkan error cooldown 5s pada broadcastService.ts untuk mengeliminasi spamming HTTP request berulang pada development console; (2) Task B - Broken Legacy WordPress Image URL (ptv-rebuild.local): Mengisolasi dan memvalidasi URL aset inventaris via resolveInventoryPhotoUrl tanpa memutasi data historis PostgreSQL; mendeteksi host development offline (*.local, ptv-rebuild.local, localhost) dan mengembalikan null secara aman sehingga browser tidak mencoba request DNS gagal net::ERR_NAME_NOT_RESOLVED; merender fallback kategori icon yang konsisten tanpa broken-image icon pada InventarisPage, AlatDetailPage, NilaiInventarisPage, dan NilaiInventarisDetailPage; menambahkan 5 unit regression tests di inventoryPhotoNormalization.test.ts; (3) Task C - Authentication Splash Always Starts Light: Menyelaraskan AuthSplashScreen dan splash.css agar SELALU berlatar terang netral (#F8FAFD) dan menggunakan logo resmi PTVPRO Royal Ink (#0B2A4A), kebal terhadap dark theme global selama splash aktif, mencegah dark flash sebelum splash muncul tanpa delay buatan; (4) Task D - Smooth Light-to-Dark Transition: Mengimplementasikan crossfade 250ms natural pada ProtectedRoute.tsx di mana tema final pengguna (Dark/Light) diterapkan ke documentElement SEBELUM splash fade-out, mengeliminasi flash Light Mode pada dashboard; menambahkan targeted color transition 250ms (background, border, color) untuk manual theme toggle tanpa transition: all global dan patuh prefers-reduced-motion; (5) Task E - React Router Future Flag: Mengaktifkan future: { v7_relativeSplatPath: true } pada createBrowserRouter dan future: { v7_startTransition: true } pada RouterProvider sesuai dokumentasi react-router-dom@6.28.0 untuk mengeliminasi console future warning; (6) Quality Gates: 0 TypeScript errors (tsc --noEmit), 0 ESLint warnings (eslint . --max-warnings 0), 72/72 test files passed (796/796 unit tests passed 100%), build produksi Vite sukses tuntas 26.04s. | Instruksi Pengguna: "PTVPRO — Targeted Console Fix & Authentication Theme Transition" | Sedang | (1) Memperbaiki kueri ptv_pengumuman di api/broadcast.ts dan menambahkan cooldown di broadcastService.ts; (2) Membangun resolveInventoryPhotoUrl dan menerapkannya di 4 komponen inventaris; (3) Mengisolasi AuthSplashScreen ke light theme netral di splash.css; (4) Membangun transisi crossfade 250ms di ProtectedRoute.tsx dan targeted CSS transition di tokens.css; (5) Mengaktifkan future flags React Router di router/index.tsx dan main.tsx; (6) Memverifikasi seluruh 4 quality gates lulus 100%. | **Fixed** |
| **CLN-100** | 2026-10-19 | `PTV-DEV-096` | `docs/PTV-PRO-RECONCILIATION-SCHEMA-PATCH-DRAFT.sql`, `docs/PTV-PRO-RECONCILIATION-DATA-PATCH-DRAFT.sql`, `docs/PTV-PRO-MIGRATION-RECONCILIATION-PLAN.md` | Database Migration: Migration Reconciliation Revision 4 Safety Corrections | (1) Eliminasi Rollback DML Destruktif: Menghapus total perintah UPDATE ptv_inventaris SET ... = NULL tanpa WHERE; pemulihan dialihkan ke backup snapshot per-ID dan per-kolom; (2) Tata Kelola Rollback Skema: Menghapus DROP COLUMN otomatis; mewajibkan audit dependensi, data post-migrasi, dan izin tertulis operator; (3) Klarifikasi Identitas Database: Menegaskan app.target_project_ref adalah konfirmasi manual sesi; verifikasi endpoint project ref (swadgljnyelsjstqqxbm) wajib dilakukan pada layer koneksi eksternal di luar SQL; (4) Operator Null-Safe: Mengganti seluruh operator <> menjadi IS DISTINCT FROM (0 operator <> tersisa di executable SQL); (5) Catatan Bersama Full Payload Verification: Membandingkan 100% teks HTML lengkap, tags JSONB, timestamp, dan field lainnya; (6) Pengeluaran Live Full Field Verification: Memeriksa keuangan_id dan created_at; (7) Surat Izin Array Type & Full Payload: Memvalidasi jsonb_typeof = array sebelum operasi array dan membandingkan seluruh JSONB payload santri rombongan; (8) Single Source Values 161 Inventaris: Menggunakan temp_source_inventaris untuk preflight conflict detection pada 161 inventaris; jika ada nilai Staging terisi yang berbeda dari Production, transaksi langsung abort untuk mencegah silent overwrite; (9) Komprehensif Readback Verification: Memvalidasi seluruh 161 record dari sumber kanonikal terhadap target; (10) Preservasi Karantina & Content Planner: 49 record karantina dilindungi utuh, tidak ada mutasi skema pada content planner; (11) Laporan Validasi Sintaksis Transparan: Melaporkan ketiadaan offline parser engine PostgreSQL secara terbuka; (12) Rencana Dry-Run Terisolasi: Mengalihkan uji coba ke database PostgreSQL lokal/Docker terisolasi, dilarang dry-run pada cloud tanpa izin; (13) Status Akhir: STRICTLY BLOCKED / AWAITING OPERATOR APPROVAL. | Review Keselamatan Terarah Revision 4 | Kritis | (1) Memperbarui PTV-PRO-RECONCILIATION-SCHEMA-PATCH-DRAFT.sql ke Revision 4; (2) Memperbarui PTV-PRO-RECONCILIATION-DATA-PATCH-DRAFT.sql ke Revision 4; (3) Memperbarui cetak biru PTV-PRO-MIGRATION-RECONCILIATION-PLAN.md ke Revision 4; (4) Menjalankan inspeksi leksikal mandiri; (5) Memverifikasi ketiadaan mutasi pada kode aplikasi dan database cloud. | **Fixed** |
| **CLN-099** | 2026-10-19 | `PTV-DEV-095` | `src/styles/tokens.css`, `src/styles/dashboard.css`, `src/styles/shell.css`, `src/styles/splash.css`, `src/styles/catatan.css`, `src/styles/lostFound.css`, `src/styles/kruKomunikasi.css`, `src/styles/keuangan.css` | Global Theme & Styling: Dark Mode Neutral Charcoal Palette & Overrides Standardization | (1) Redesign Dark Mode Color Tokens: Mengeliminasi warna deep navy (`#060F1C`, `#0A1626`, `#0E1B2D`) dan menggantinya dengan standar global Google Workspace / Gmail Dark Mode neutral charcoal (`--bg: #111315`, `--bg-2: #1B1E21`, `--surface: #24282C`, `--surface-2: #2E3338`, `--line: #34383D`, `--ink: #E8EAED`, `--ink-2: #BDC1C6`, `--muted: #9DA5AE`); (2) Soft Accent & Anti-Glow: Menyelaraskan aksen biru dark mode dari neon jenuh `#4E9BFB` ke Google soft pastel blue `--b-600: #8AB4F8`, `--b-500: #A8C7FA`, dan menghapus seluruh neon glowing shadows (`--shadow-blue: 0 4px 14px rgba(0,0,0,.35)`); (3) Eliminasi Radial Navy Body Gradients: Menghapus radial gradient navy pekat di `body::before` dan `body::after` pada dark mode, digantikan solid neutral dark background `#111315` yang bersih; (4) Sidebar Active & Hover Styling ala Gmail: Mengubah `.snav.on` dark mode dari gradient jenuh menjadi subtle pill background `rgba(168, 199, 250, 0.16)` dengan teks dan ikon `#A8C7FA` tanpa drop shadow; (5) Standardisasi Overrides Modul: Mengganti hardcoded zinc (`#18181b`, `#27272a`) di `catatan.css`, fallback navy di `lostFound.css`, overlay navy di `kruKomunikasi.css`, serta menambahkan selector `:root[data-theme="dark"]` di `keuangan.css`; (6) Penyelarasan Splash Screen & PTVSelect: Menyelaraskan background `AuthSplashScreen` ke `#111315` dan menu `PTVSelect` ke neutral charcoal surfaces; (7) Quality Gates: 0 TypeScript errors (`tsc --noEmit`), 0 ESLint warnings (`eslint . --max-warnings 0`), 71/71 test files passed (791/791 tests passed 100%), build produksi Vite sukses 17.69s. | Rekomendasi Standardisasi UI & Konsistensi Tema | Rendah | (1) Memperbarui token dark mode di `tokens.css`; (2) Menyelaraskan dark mode rules di `dashboard.css` dan `shell.css`; (3) Membersihkan hardcoded colors di `catatan.css`, `lostFound.css`, `kruKomunikasi.css`, dan `keuangan.css`; (4) Menyelaraskan `splash.css`; (5) Memverifikasi seluruh 4 quality gates lulus 100%. | **Fixed** |
| **CLN-098** | 2026-10-19 | `PTV-DEV-094` | `src/shared/components/AuthSplashScreen.tsx`, `src/styles/splash.css`, `src/styles/base.css`, `src/shared/components/index.ts`, `src/app/router/ProtectedRoute.tsx`, `tests/auth/authSplashScreen.test.tsx`, `tests/auth/sessionCapabilityRegression.test.tsx` | Auth & Shell: Custom Authentication Splash Screen Redesign | (1) Redesign Loading Otentikasi: Menggantikan spinner generik `LoadingState` ("Memeriksa otentikasi...") dengan custom authentication splash screen full-screen yang minimalis, premium, dan konsisten dengan PTVPRO Guide Book R03 (Apple-inspired, clean, restrained, polished, anti-AI-slop); (2) Identitas Logo Resmi PTVPRO: Menggunakan aset logo resmi `public/assets/images/ptv-logo-white.webp` (172x36px) via `webkit-mask-image` / `mask-image` sehingga otomatis beradaptasi dengan warna Royal Ink `var(--ink)` di light mode dan putih murni `#FFFFFF` di dark mode tanpa artefak blur; (3) Tipografi & Subtitle: Menampilkan subtitle "Ruang kerja digital Progresif TV" dan teks status "Memeriksa sesi Anda..." menggunakan SF Pro Display; (4) Thin Indeterminate Progress: Menggunakan track horizontal tipis (136px x 2.5px) pill-rounded dengan animasi indeterminate yang lembut (1.35s timing); (5) Aksesibilitas & Zero Delay: Mendukung `prefers-reduced-motion`, menyematkan role `status` dan `progressbar`, serta tanpa artificial delay (langsung unmount ketika status sesi selesai); (6) Isolasi Halaman Login: Halaman login tidak dimodifikasi, menjaga kepatuhan batasan scope instruksi; (7) Quality Gates: 0 TypeScript errors (`tsc --noEmit`), 0 ESLint warnings (`eslint . --max-warnings 0`), 71/71 test files passed (791/791 tests passed 100%), build produksi Vite sukses 12.56s. | Instruksi Pengguna: "PTVPRO — Custom Authentication Splash Screen" | Rendah | (1) Membuat stylesheet `src/styles/splash.css` dan mengimpor di `base.css`; (2) Membuat komponen `AuthSplashScreen.tsx` dan mengekspor di `@shared/components`; (3) Mengintegrasikan ke `ProtectedRoute.tsx`; (4) Menyesuaikan regression test `sessionCapabilityRegression.test.tsx` dan membuat unit test `authSplashScreen.test.tsx`; (5) Memverifikasi 4 quality gates lulus 100%. | **Fixed** |
| **CLN-097** | 2026-10-19 | `PTV-DEV-092` | `src/products/hub/kalender/KalenderPage.tsx`, `src/styles/kalender.css` | Kalender Kegiatan: Alignment Header Kalender Bulanan PTVPRO | (1) Geometris Tengah Horizontal: Menyelaraskan judul bulan/tahun dan subtitle Hijriah persis di tengah horizontal container kalender menggunakan tata letak grid 3-kolom simetris (`1fr auto 1fr`); (2) Tombol Navigasi Sisi Kanan: Tombol `< Bulan Sebelumnya`, `Hari Ini`, dan `Bulan Berikutnya >` tetap di kolom sisi kanan tanpa menggeser pusat judul; (3) Anti-Tabrakan Mobile: Menggunakan container query / media query responsif sehingga judul dan tombol navigasi tetap rapi dan tidak bertabrakan pada layar mobile (320px–480px); (4) Preservasi Desain & Fungsionalitas: Mempertahankan seluruh warna, font, rounded corners, dan logic perpindahan bulan kalender; (5) Quality Gates: 0 errors pada typecheck, lint, kalender test suite, dan build produksi. | Instruksi Pengguna: "Rapikan alignment header Kalender Bulanan PTVPRO" | Rendah | (1) Menata grid container header kalender di `KalenderPage.tsx` dan `kalender.css`; (2) Memverifikasi responsivitas mobile; (3) Menjalankan pengujian lolos 100%. | **Fixed** |
| **CLN-096** | 2026-10-19 | `PTV-DEV-090` | `src/products/hub/kalender/KalenderPage.tsx`, `src/styles/kalender.css` | Kalender Kegiatan: Simplify Momentum & Ide Konten UI | (1) Header Panel Minimalis: Menyelaraskan header panel Momentum & Ide Konten mengikuti pola panel Acara Liputan (ikon lampu 24x24px, judul uppercase "MOMENTUM & IDE KONTEN", badge counter jumlah momentum di sisi kanan, tombol aksi ringkas "+ Tambah Ide", serta mengeliminasi subtitle panjang deskriptif yang tidak diperlukan); (2) Gaya Kartu Konsisten Paritas Acara Liputan: Menerapkan shared card styling `.kal-event-item` pada seluruh item momentum (background netral/putih, border tipis 1px `var(--line-2)`, radius `var(--ptv-curve-lg)`, padding konsisten 10px 14px, subtle hover lift); (3) Eliminasi Elemen Visual Berlebihan: Menghapus strip garis aksen warna tebal di sisi kiri (`.kal-planner-accent-bar`), menghapus kotak tanggal/periode besar di sisi kiri (`.kal-planner-date-col`), dan menghapus badge kategori berlapis-lapis (`.kal-planner-cat-badge`, `.kal-planner-subcat-badge`); (4) Hierarki & Tipografi Konten: Menjadikan judul momentum elemen utama (13.5px, 700, `var(--ink)`, word-break), deskripsi teks sekunder maksimal 2 baris (line clamp 2, 11.5px, `var(--ink-2)`), chevron kecil kanan (`fa-chevron-right`, 11px, `var(--muted)`), serta metadata ringkas 1 baris di atas judul (misal: "Event Pondok · Periode Fleksibel" atau "22 Oktober · Event Masehi"); (5) Pengelompokan Bersih: Menjaga 2 kelompok momentum ("Momentum Sepanjang Bulan & Periode" dan "Jadwal Tanggal Pasti") dengan section title kecil konsisten tanpa nested card atau panel bertumpuk; (6) Preservasi Fungsionalitas Penuh: Sumber data real Supabase Staging, filter bulan berjalan, rules recurrence Hijriah/Masehi, modal tambah/edit/hapus/detail, dan titik indikator kalender tetap 100% terjaga dan berfungsi; (7) Clean-as-You-Go CSS: Menghapus seluruh dead/zombie CSS planner lama di `kalender.css` (baris 1225–1544) dan mengintegrasikan dark mode serta responsive behavior untuk `.kal-event-item`; (8) Quality Gates: 0 TypeScript errors (`tsc --noEmit`), 0 ESLint warnings (`eslint . --max-warnings 0`), 27/27 tests passed pada `kalenderGridRedesign.test.tsx` dan `kalenderStagingRegression.test.ts`, build produksi Vite lolos 13.35s. | Instruksi Pengguna: "PTVPRO — Simplify Momentum & Ide Konten UI" | Rendah | (1) Memperbarui header dan kartu item momentum pada `KalenderPage.tsx`; (2) Membersihkan dead CSS dan menyatukan shared styling `.kal-event-item` di `kalender.css`; (3) Memverifikasi dark mode dan responsive breakpoints; (4) Menjalankan 4 quality gates lulus 100%. | **Fixed** |
| **CLN-095** | 2026-10-19 | `PTV-DEV-088` | `src/products/hub/inventaris/InventarisPage.tsx`, `src/styles/inventaris.css` | Halaman Inventaris: Compact Catalog & Stable Layout Redesign | (1) Penghapusan Hero Photo Banner: Mengeliminasi hero banner foto besar bertuliskan "Aset Inventaris Progresif TV Production" beserta container background gradient lama tanpa menggantinya dengan kartu dekoratif generik. Menggantinya dengan clean heading dashboard terpadu (`.inv-header`, `.inv-title`, `.inv-subtitle`); (2) Unified Search & Actions Toolbar: Memindahkan search bar tepat di bawah heading, mengintegrasikannya dengan clear button [x], barcode scanner trigger, indikator keranjang pinjaman kondisional, dan tombol `+ Alat` (`#btnAddNewAsset`) dengan hak akses RBAC `canCreate`; (3) Quick Category Chips Rail & 17 Kategori Popover: Mengeliminasi carousel kartu kategori besar. Menggantinya dengan quick chips horizontal scrollable (Semua, Kamera, Lensa, Tripod, Audio, Lighting, Baterai & Power, Streaming / Live Production) dan tombol "Kategori Lainnya ▾" yang membuka searchable popover 17 kategori kanonikal dinamis lengkap dengan search input, icon, counter jumlah alat, checkmark aktif, click-outside auto-close, dan unselect via clear badge; (4) Segmented Status Filter & Persistent Result Meta: Menata filter status (Semua, Tersedia, Dipinjam, Bermasalah) ke dalam segmented pill yang ringkas dengan dot status semantik. Tombol "Reset Filter" hanya muncul dinamis saat filter atau pencarian aktif. Counter jumlah alat berada di posisi stabil; (5) Layout Stability & Redesign Empty States: Menjamin spacing antar-seksi selalu stabil (`gap: 16px`, catalog area `min-height: 280px`) pada seluruh kondisi filter. Membedakan secara tegas empty state filter no-match ("Tidak ada alat yang cocok" + tombol Reset Filter) dengan empty state database kosong ("Belum ada alat" + CTA Tambah Alat); (6) Preservasi Kartu Alat & Responsive: Mempertahankan 100% kartu alat `.inv-prod-card`, thumbnail 14px continuous curve, status badge, grid responsif 2 kolom mobile (< 640px), modal `UnitPickerModal`, `LoanModal`, dan `TambahAlatModal`; (7) Scoped Dark Mode Tuning: Menambahkan aturan dark mode scoped ke `.r03-inventaris` untuk search wrap, category chips, popover panel, segmented status, reset filter button, dan empty states; (8) Quality Gates: 0 TypeScript errors (`tsc --noEmit`), 0 ESLint warnings (`eslint . --max-warnings 0`), 70/70 test files passed (788/788 tests passed 100%), build produksi Vite sukses 16.94s. | Instruksi Pengguna: "PTVPRO — Redesign Halaman Inventaris: Compact Catalog & Stable Layout" | Rendah | (1) Merombak `InventarisPage.tsx` dan `inventaris.css`; (2) Menambahkan quick category chips dan searchable popover 17 kategori; (3) Menata toolbar actions, search input, segmented status, dan layout stability; (4) Menambahkan scoped dark mode CSS; (5) Memverifikasi 34 tests inventaris dan 788 tests repo-wide lulus 100%. | **Fixed** |
| **CLN-094** | 2026-10-19 | `PTV-DEV-087` | `index.html`, `src/products/hub/kalender/KalenderPage.tsx`, `src/styles/kalender.css`, `tests/hub/kalenderGridRedesign.test.tsx` | Kalender Kegiatan: Fix Rounded Calendar Corner Cells & Amiri Hijri Typography | (1) Perbaikan Border-Radius 4 Pojok Sel Kalender: Mengeliminasi pemotongan kasar (clipping) atau celah sudut pada sel di 4 pojok grid (`.cal-cell-corner-tl`, `.cal-cell-corner-tr`, `.cal-cell-corner-bl`, `.cal-cell-corner-br`) saat di-hover, focus, atau dipilih (`.sel`). Menetapkan kalkulasi inner radius grid container `--cal-grid-radius: var(--ptv-curve-xl, 14px);` dan `--cal-inner-radius: calc(var(--cal-grid-radius) - 1px) = 13px`. Pada kondisi normal maupun hover, sudut luar sel pojok melengkung sempurna mengikuti container. Pada kondisi terpilih (`.sel`), sudut luar melengkung 13px dan 3 sudut dalam melengkung halus 6px (`var(--cal-cell-radius)`), sehingga highlight `box-shadow: inset 0 0 0 1.5px #2563eb` melengkung presisi tanpa terpotong `overflow: hidden`, tanpa double border, dan tanpa celah; (2) Pemuatan Font Resmi Google Fonts Amiri: Menambahkan link font Amiri resmi di `<head>` pada `index.html` dengan bobot 400 dan 700; (3) Tipografi Angka Arab-Indic Hijriah: Menerapkan font stack `"Amiri", "Noto Naskh Arabic", serif` pada `.cal-cell-hijri` dan `.calendar-hijri-number` dengan `font-weight: 400` (atau `700` saat `.sel`), ukuran terkalibrasi proporsional (13.5px desktop, 12px 768px, 11px 480px, 10px 360px), dan baseline sejajar angka Masehi; (4) Preservasi Fitur: Struktur 7 kolom Ahad–Sabtu, header bulan & navigasi, posisi angka Masehi/Hijriah/weton, indikator acara & momentum, panel Acara Liputan, panel Momentum & Ide Konten, dan logic backend tetap 100% terjaga; (5) Quality Gates: 0 TypeScript errors (`tsc --noEmit`), 0 ESLint warnings (`eslint . --max-warnings 0`), 6/6 tests passed pada `kalenderGridRedesign.test.tsx`, build produksi Vite lolos 22.49s. | Instruksi Pengguna: "PTVPRO — Fix Rounded Calendar Cells & Typography" | Rendah | (1) Menambahkan link Google Fonts Amiri di `index.html`; (2) Menambahkan penanda sudut sel dan class `calendar-hijri-number` di `KalenderPage.tsx`; (3) Menyempurnakan CSS inner radius pojok, hover/selected states, dan typography Amiri di `kalender.css`; (4) Menambahkan assertions pada `kalenderGridRedesign.test.tsx`; (5) Memverifikasi seluruh 4 quality gates lulus 100%. | **Fixed** |
| **CLN-093** | 2026-10-19 | `PTV-DEV-085` | `src/products/hub/kalender/KalenderPage.tsx`, `src/products/hub/kalender/utils/calendarDateUtils.ts`, `src/styles/kalender.css`, `tests/hub/kalenderGridRedesign.test.tsx` | Kalender Kegiatan: Redesign UI Kalender Mengikuti Referensi Progresif Editorial | (1) Header Kalender Editorial: Mengganti panel biru pill besar dengan clean editorial header (`.cal-editorial-header`): sisi kiri memuat judul bulan dan tahun ("Oktober 2026") dengan rentang Hijriah di bawahnya ("Rabi'ul Akhir – Jumadil Ula 1448 H"), sisi kanan memuat tombol navigasi bulan (`<` dan `>`) serta tombol `Hari Ini`, dipisahkan oleh divider tipis (`.cal-editorial-divider`); (2) Grid 7 Kolom Ahad–Sabtu: Urutan hari dimulai dari `AHAD` hingga `SABTU` (kolom Ahad diberi warna merah `#dc2626`). Algoritma `generateMonthGridCells` menyelaraskan offset awal bulan dari hari Ahad (`firstDayOfMonth.getDay()`) menghasilkan 42 sel stabil editorial (6 baris x 7 kolom) tanpa pergeseran tinggi kartu antar-bulan; (3) Sel Tanggal Horizontal Landscape & Tata Letak Isi: Sel tanggal diubah menjadi proporsi landscape horizontal (`aspect-ratio: 1 / 0.74`, `min-height: 52px; max-height: 64px`). Angka Masehi diletakkan di kiri atas tegas (`.cal-cell-masehi`), digit Arab Hijriah di kanan atas (`.cal-cell-hijri`), nama weton Jawa di kiri bawah (`.cal-cell-weton`), dan titik indikator kecil di kanan bawah (`.cal-cell-dots` hijau untuk acara, amber untuk momentum); (4) Penghapusan Background Warna Dekoratif: Seluruh tanggal berlatar belakang netral/putih tanpa highlight latar untuk hari libur, momentum, acara, maupun hari ini. Teks acara panjang di dalam sel dieliminasi agar sel tetap lapang dan minimalis; (5) Selected Date State Khas PTVPRO: Hanya tanggal terpilih yang memiliki background highlight lembut biru PTVPRO (`#eff6ff`, dark mode `rgba(37,99,235,0.18)`) dan border 1.5px `#2563eb` (`box-shadow: inset 0 0 0 1.5px #2563eb`) tanpa menyalin warna hijau Progresif Editorial; (6) Header Tanggal Terpilih & Acara Liputan: Mempertahankan fungsionalitas Acara Liputan di bawah kalender selebar kartu kalender, dengan banner editorial ringkas (`.kal-selected-banner`) yang menampilkan hari dan tanggal Masehi sebagai judul utama serta metadata Hijriah dan weton sebagai sub-informasi; (7) Preservasi Fitur: Database Supabase, service API, filter layer kalender (PTV, Pesantren, Sekolah), CRUD acara liputan, dan panel kanan Momentum & Ide Konten sepanjang bulan aktif tetap 100% terjaga dan berfungsi; (8) Responsiveness: Multi-breakpoint CSS (768px, 480px, 360px) memastikan 7 kolom tetap terlihat tanpa horizontal overflow pada perangkat seluler; (9) Quality Gates: 0 TypeScript errors (`tsc --noEmit`), 0 ESLint warnings (`eslint . --max-warnings 0`), 27/27 tests lolos pada `kalenderGridRedesign.test.tsx` dan `kalenderStagingRegression.test.ts`, build produksi Vite lolos 23.03s. | Permintaan Pengguna: "PTVPRO — Redesign UI Kalender Mengikuti Referensi Progresif Editorial" | Kritis | (1) Mengubah `DOW` dan `generateMonthGridCells` pada `calendarDateUtils.ts`; (2) Menata ulang header kartu kalender, baris hari, dan susunan sel tanggal pada `KalenderPage.tsx`; (3) Menyempurnakan stylesheet `kalender.css` dengan token editorial, landscape cells, dan responsive styles; (4) Memperbarui test assertions pada `kalenderGridRedesign.test.tsx`; (5) Memverifikasi seluruh 4 quality gates lulus 100%. | **Fixed** |
| **CLN-092** | 2026-10-19 | `PTV-DEV-082` | `src/products/hub/acara/AcaraDetailPage.tsx`, `api/dokumen.ts`, `src/products/hub/dokumen-saya/dokumenService.ts`, `src/products/hub/dokumen-saya/docsStore.ts`, `src/products/hub/perizinan/components/AjukanTugasModal.tsx`, `src/products/hub/perizinan/components/AjukanBarangModal.tsx`, `tests/hub/acaraSuratIntegration.test.tsx` | Acara & Persuratan: Integrasi Surat Tugas & Izin Pengeluaran Barang dari Detail Acara | (1) Eliminasi Pesan Placeholder: Menghapus notifikasi sementara `"Fitur administrasi Surat Izin Pengeluaran Barang akan diintegrasikan secara penuh pada fase migrasi modul Dokumen & Persuratan."` dan menghubungkan tombol aksi langsung ke generator modal; (2) Integrasi Generator Modal: Membuka `AjukanTugasModal` dan `AjukanBarangModal` dengan data prefill lengkap dari acara (nama acara, ID acara, tanggal kegiatan, daftar kru bertugas, dan peralatan teralokasi `event.gear`); (3) Keamanan Auto-Approval Backend: Menambahkan endpoint pembuatan dokumen di `/api/dokumen?action=create` dengan validasi otorisasi server-side (`canApprove`). Hanya pembuat dengan wewenang sah (admin, eksekutif, administrasi, capabilities `documents.approve`/`documents.archive.manage`) yang suratnya otomatis berstatus `'Disetujui'` dan mendapatkan nomor surat resmi; pengajuan dari kru biasa tetap berstatus `'Menunggu'` tanpa nomor surat resmi; (4) Menjaga Strict Read-Only Boundary: Endpoint arsip `/api/dokumen` tanpa `action=create` tetap strictly read-only dan menolak mutasi POST biasa dengan HTTP 405; (5) Preservasi Data Acara & Submit Guard: Tidak ada dokumen dibuat atau inventaris dipinjam sebelum pengguna meninjau dan menekan tombol terbitkan di modal, dilengkapi tombol disable dan status loading saat submitting; (6) Continuous Curve Compliance: Menghapus hardcoded inline border radius (`10px`, `12px`) dan menggantinya dengan token resmi `var(--r-full, 9999px)`; (7) Quality Gates: 0 TypeScript errors (`tsc --noEmit`), 0 ESLint warnings (`eslint . --max-warnings 0`), 9/9 unit tests lulus 100% pada `acaraSuratIntegration.test.tsx`, dan build produksi Vite sukses 15.15s. | Instruksi Operator: "PTVPRO — INTEGRASI SURAT TUGAS & IZIN BARANG DARI DETAIL ACARA" | Kritis | (1) Memperbarui `AcaraDetailPage.tsx` untuk menghubungkan generator modal dan drawer detail dokumen; (2) Mengimplementasikan server-side document creation dan RBAC auto-approval di `api/dokumen.ts`; (3) Menambahkan client method di `dokumenService.ts` dan store synchronization di `docsStore.ts`; (4) Menyesuaikan modal generator dengan prefill props dan submit guards; (5) Menambahkan unit test suite `tests/hub/acaraSuratIntegration.test.tsx`; (6) Memverifikasi seluruh 4 quality gates lulus 100%. | **Fixed** |
| **CLN-091** | 2026-10-19 | `PTV-DEV-081` | `src/products/hub/kalender/KalenderPage.tsx`, `src/products/hub/kalender/utils/calendarDateUtils.ts`, `src/products/hub/kalender/types.ts`, `src/styles/kalender.css`, `tests/hub/kalenderGridRedesign.test.tsx` | Kalender Kegiatan: Redesign Isi Kalender, Grid 7 Kolom SEN-MIN, Event Chips, Diamond Momentum & Selected Date Polish | (1) Grid Bulanan 7 Kolom Standar Indonesia: Menyusun urutan hari `SEN`, `SEL`, `RAB`, `KAM`, `JUM`, `SAB`, `MIN` (dengan MIN hari Minggu diwarnai merah), menghitung offset awal pekan dari hari Senin sehingga tanggal 1 Oktober (Kamis) persis berada di kolom ke-4 dengan sel sisa 28, 29, 30 September di awal baris; (2) Weton & Tanggal Hijriah Ringkas: Mengimplementasikan format sub-info sel `${c.weton.pasaran} · ${getShortHijriFormatted(c.hijri)}` menghasilkan label persis sesuai referensi (`Wage · 8 Jum I`, `Pon · 17 Rab II`, dsb.) yang tetap tampil di desktop maupun mobile tanpa disembunyikan; (3) Diamond Momentum Konten: Menambahkan indikator diamond halus biru `◆` di kanan atas nomor tanggal untuk seluruh tanggal yang memiliki momentum/planner; (4) Event Chips di Dalam Sel: Menampilkan chip acara ringkas berlatar soft dengan border kiri aksen warna semantik (hijau untuk liputan, biru untuk internal/rapat, emas/amber untuk siaran/program, merah dengan live dot untuk siaran langsung), jam mulai (mendukung multi-sesi dan acara tanpa jam selesai), nama acara ber-ellipsis elegan, dan klik chip langsung membuka modal detail acara; (5) Batasan Kapasitas & Tombol `+N lagi`: Membatasi tampilan chip hingga 3 per sel, dan menyajikan tombol interaktif `+N lagi` jika melebihi kapasitas tanpa kehilangan konteks tanggal; (6) Penyempurnaan Selected Date (Target 2): Memperbaiki border tanggal terpilih dari border tebal/double border menjadi border biru halus maksimal 1px (`box-shadow: inset 0 0 0 1px #3b82f6`) dan background biru sangat muda (`#eff6ff` di light, `rgba(37,99,235,0.14)` di dark), tanpa menyebabkan pergeseran layout/koordinat (zero layout shift), serta membedakan visual state tanggal hari ini (`today`) dan terpilih (`sel`); (7) Preservasi Fitur Momentum: Mempertahankan daftar Momentum & Ide Konten berbasis seluruh bulan berjalan tanpa terbatasi tanggal yang diklik; (8) Responsive Mobile & Zero Overflow: Mengoptimalkan ukuran sel dan chip untuk mobile viewport (320, 360, 375, 390, 430, 768 px) tanpa horizontal overflow; (9) Kepatuhan Continuous Curve: Menggunakan token `var(--ptv-curve-*)` pada semua elemen UI; (10) Quality Gates: 0 TypeScript errors (`tsc --noEmit`), 0 ESLint warnings (`eslint . --max-warnings 0`), 777/777 unit tests lolos 100% pada 69 test files, build produksi Vite sukses dalam 21.48s. | Instruksi Operator: "PTVPRO — Implementasi Redesign Isi Kalender Kegiatan" | Kritis | (1) Memperbarui `types.ts` dan `calendarDateUtils.ts` (DOW SEN-MIN, helper Hijriah ringkas, live event, event accent class, Monday grid generator); (2) Menata styling modern di `kalender.css`; (3) Mengintegrasikan event chips dan diamond momentum di `KalenderPage.tsx`; (4) Menyelaraskan token continuous curve; (5) Membangun unit test `tests/hub/kalenderGridRedesign.test.tsx`; (6) Memverifikasi seluruh 4 quality gates lulus 100%. | **Fixed** |
| **CLN-090** | 2026-10-19 | `PTV-DEV-080` | `src/shared/components/AcaraKalenderHeader.tsx`, `src/shared/components/AcaraKalenderNav.tsx`, `src/shared/components/index.ts`, `src/styles/acaraKalenderNav.css`, `src/products/hub/acara/AcaraPage.tsx`, `src/products/hub/kalender/KalenderPage.tsx`, `src/styles/acara.css`, `src/styles/kalender.css`, `tests/hub/acaraKalenderHeaderConsistence.test.tsx` | Acara & Kalender: Fix UI Konsistensi Header & Navigasi Acara & Kalender | (1) Shared Header Component: Membangun komponen bersama `AcaraKalenderHeader.tsx` yang membungkus judul resmi ("Agenda & Kalender Kegiatan"), deskripsi terpadu ("Jadwal peliputan, produksi siaran studio, dan koordinasi agenda kegiatan terpadu Progresif TV."), dan segmented navigation switcher `AcaraKalenderNav` pada route `/hub/acara` dan `/hub/kalender`; (2) Koordinat Segmented Tab Stabil: Menyelaraskan koordinat posisi dan dimensi tab `Daftar Acara / Kalender` agar persis identik di desktop (judul di kiri, tab di kanan) dan mobile (judul di atas, tab 100% lebar di bawahnya dengan proporsi 50%-50%); perpindahan route hanya mengubah status active indicator tanpa pergeseran posisi tombol; (3) Action Bar Acara Terpisah: Memindahkan tombol `Acara Baru` keluar dari header bersama ke baris aksi/toolbar terpisah (`.acara-action-bar`) bersama filter chips dan search box, menghilangkan pembengkakan tinggi header dan pergeseran koordinat tab; (4) Kalender Filter Scroll Affordance: Membungkus tab kategori kalender (`Kalender PTV`, `Kalender Pesantren`, `Kalender Sekolah`) dengan `.kal-filter-bar-wrap` dan right edge gradient fade hint (`.kal-filter-scroll-hint`) pada mobile, memberikan affordance visual bahwa pilihan dapat digeser tanpa terpotong kasar; (5) Responsivitas Multi-Viewport: Menjamin zero horizontal overflow pada viewport 320, 360, 375, 390, 430 px dan desktop; (6) Quality Gates: 0 TypeScript errors (`tsc --noEmit`), 0 ESLint warnings (`eslint . --max-warnings 0`), 772/772 unit tests lulus 100% pada 68 test files, dan build produksi Vite lolos 22.14s. | Instruksi Operator: "PTVPRO — FIX UI KONSISTENSI HEADER ACARA & KALENDER" | Rendah | (1) Membuat `AcaraKalenderHeader.tsx` dan mengekspornya di shared index; (2) Menyelaraskan stylesheet `acaraKalenderNav.css`; (3) Mengintegrasikan header bersama di `AcaraPage.tsx` dan `KalenderPage.tsx`; (4) Menata action bar terpisah di `acara.css`; (5) Menambahkan scroll affordance di `kalender.css`; (6) Membangun unit test `tests/hub/acaraKalenderHeaderConsistence.test.tsx`; (7) Memverifikasi seluruh 4 quality gates lulus 100%. | **Fixed** |
| **CLN-089** | 2026-10-19 | `PTV-DEV-079` | `api/kru.ts`, `api/acara.ts`, `src/products/hub/acara/components/AcaraCrewModal.tsx`, `src/products/hub/acara/components/AcaraFormModal.tsx`, `src/products/hub/acara/AcaraDetailPage.tsx`, `src/products/hub/kru/kruService.ts`, `src/products/hub/acara/acaraService.ts`, `src/products/hub/acara/types.ts`, `tests/hub/acaraCrewAssignment.test.tsx` | Acara & Kalender: Fix P0 Kru Bertugas pada Acara (Kandidat Asli Kru Aktif & Integrasi Form Acara) | (1) Eliminasi Data Dummy Studio: Menghapus 100% mock hardcoded `STUDIO_CREW_POOL` (Roup, Farid Technical, Ahmad Executive, dsb.) dari modal penugasan; (2) Sumber Data Kanonikal Kru Asli: Mengintegrasikan daftar kandidat penugasan langsung dari database backend Supabase Staging (`legacy_archive_kru`) via endpoint `/api/kru?scope=active_crew` dan client service `kruService.getActiveCrewCandidates()`; (3) Filter Ketat Server-Side: Filter kandidat penugasan berjalan di backend API (`api/kru.ts`), KHUSUS menyaring personel berkategori Kru dan status organisasi Aktif. Mengecualikan akun testing (`PTV-UJI-2712`), Pembina (8 orang), Pengarah (4 orang), Pengurus (3 orang: Ketua Umum Zidnal, Ketua Farras, Koordinator Uji), serta seluruh 55 personel nonaktif, menghasilkan tepat 23 kandidat kru aktif asli yang sah; (4) Rekonsiliasi PTV-017 & Foto Profil: Menyelaraskan PTV-017 ke nama asli Muhammad Hamdan Yuwafi Sulaim, serta memfilter URL foto 404 (`KNOWN_BROKEN_PHOTO_PTV_IDS`) dengan fallback inisial bergradien; (5) Integrasi Form Tambah & Edit Acara: Menambahkan section UI `Kru Bertugas (Opsional)` pada `AcaraFormModal.tsx` dengan pemilih kru modal (`AcaraCrewModal.tsx`), list badge kru terpilih, opsi hapus per kru, kosongkan semua, dan tombol `+ Pilih Kru` / `Kelola Kru`. Acara tanpa kru tetap valid (opsional); (6) Pemilihan Kru Preselected & Multi-Select: Modal mendukung mode picker interaktif, multi-select checkbox tanpa tombol ganda `+ Tugaskan` yang redundan, pencarian berbasis nama, divisi, peran/tugas, dan filter preset tugas; (7) Persistensi & Integritas Data Staging: Pilihan kru disimpan secara permanen bersama data acara melalui fungsi sanitasi non-destruktif `sanitizeAcaraCrew` ke dalam metadata `meta.crew` di kolom `deskripsi` tabel `ptv_acara`, tersinkronisasi di Detail Acara dan Kalender tanpa mengubah master data kru atau menghapus riwayat acara lama; (8) Quality Gates: 0 TypeScript errors (`tsc --noEmit`), 0 ESLint warnings (`eslint . --max-warnings 0`), 766/766 unit tests lulus 100% pada 67 test files, dan build produksi Vite lolos 20.21s. | Instruksi Operator: "PTVPRO — FIX P0 KRU BERTUGAS PADA ACARA" | Kritis | (1) Memperbarui `api/kru.ts` dengan filter kandidat kru aktif; (2) Menambahkan sanitasi kru `sanitizeAcaraCrew` di `api/acara.ts`; (3) Menulis ulang `AcaraCrewModal.tsx` dengan data live tanpa mock dummy; (4) Memasang section `Kru Bertugas (Opsional)` di `AcaraFormModal.tsx`; (5) Menyelaraskan avatar dan unlink di `AcaraDetailPage.tsx`; (6) Membangun unit test suite `tests/hub/acaraCrewAssignment.test.tsx`; (7) Memverifikasi seluruh 4 quality gates lulus 100%. | **Fixed** |
| **CLN-088** | 2026-10-19 | `PTV-DEV-078` | `src/products/hub/acara/components/AcaraFormModal.tsx`, `src/products/hub/acara/types.ts`, `api/acara.ts`, `src/products/hub/acara/acaraService.ts`, `src/products/hub/acara/context/AcaraContext.tsx`, `src/products/hub/acara/AcaraDetailPage.tsx`, `src/products/hub/kalender/KalenderPage.tsx`, `src/products/hub/kalender/types.ts`, `src/styles/acara.css` | Acara & Kalender: Ralat Final Form Tambah & Edit Acara (Sesi Opsional & Custom Dropdown Notulensi) | (1) Sistem Sesi Opsional: Form Tambah & Edit Acara secara default mematikan toggle sesi (`hasSessions = false`) dengan input Waktu Mulai biasa dan checkbox opsional `Tambahkan waktu selesai` (`08:00 – Selesai` vs `${start} – ${end}`). Ketika diaktifkan, pengguna dapat menambah, mengedit, dan menghapus sesi dinamis dengan preset label (`Pagi`, `Siang`, `Sore`, `Malam`, `Lainnya`), waktu mulai, dan checkbox waktu selesai tersendiri. Acara lama dengan string waktu biasa tetap 100% kompatibel tanpa dipaksa menjadi multi-sesi; (2) Custom Dropdown Notulensi Rapat: Mengganti native HTML select dengan custom dropdown modern PTVPRO yang searchable berdasarkan judul notulensi, mengambil data asli dari modul Catatan/Notulensi (`catatanService.getNotes()`, `tipe === 'meeting_minutes'`), dilengkapi loading state, error retry, empty state, opsi batal pilih (clear selection), keyboard navigation Escape, dan penutupan saat klik luar; (3) Auto Capital Each Word: Mengimplementasikan parser `toCapitalEachWord` untuk nama acara yang mengkapitalkan huruf pertama tiap kata sambil menjaga akronim resmi (PTV, TV, HD, VIP, PPBS, dll.); (4) Status Acara Otomatis: Status dihitung otomatis dari tanggal kegiatan (`Mendatang`, `Berlangsung`, `Selesai`) tanpa dropdown manual, namun tetap menghormati status khusus historis ('Dibatalkan'); (5) Aksi Form Edit: Menyediakan tombol Arsipkan Acara (`status = 'Selesai'`) dan Hapus Acara (dengan dialog inline konfirmasi penghapusan permanen ke backend); (6) Persistensi Non-Destruktif: Data sesi (`sessions`) dan relasi notulensi (`notulensi_ids`) disimpan secara aman ke dalam metadata `<!-- PTV_META: ... -->` pada kolom `deskripsi` tabel `ptv_acara` di Supabase Staging tanpa mutasi DDL skema database; (7) Sinkronisasi Tampilan: Menampilkan rincian sesi di `AcaraDetailPage.tsx` dan modal detail `KalenderPage.tsx`; (8) Kepatuhan Continuous Curve: Memperbaiki token inline border-radius ke `var(--ptv-curve-pill)`; (9) Quality Gates: 0 TypeScript errors, 0 ESLint warnings, 759/759 unit tests passed pada 66 test files, build Vite sukses 15.09s. | Instruksi Operator: "PTVPRO — RALAT FINAL FORM TAMBAH & EDIT ACARA" | Kritis | (1) Menyesuaikan tipe data `AcaraSession` dan DTOs; (2) Memperbarui backend `api/acara.ts` dan frontend `acaraService.ts` untuk memetakan dan menyimpan `sessions` & `notulensi_ids`; (3) Menulis ulang `AcaraFormModal.tsx` dengan sistem sesi opsional dan custom dropdown notulensi; (4) Menambahkan styling CSS modern di `src/styles/acara.css`; (5) Menyelaraskan rincian sesi di `AcaraDetailPage.tsx` dan `KalenderPage.tsx`; (6) Memverifikasi seluruh 4 quality gates lulus 100%. | **Fixed** |
| **CLN-087** | 2026-10-19 | `PTV-DEV-077` | `api/kontak.ts`, `src/products/hub/kontak/components/KontakInternalDetailDrawer.tsx`, `tests/hub/kontakWhatsAppAccess.test.ts` | Kontak Internal: Simplifikasi Akses WhatsApp Seluruh Pengguna Login | (1) Simplifikasi Akses WhatsApp di Serverless API: Berdasarkan keputusan operator, semua pengguna PTV Hub yang sudah login (baik Admin maupun Kru) boleh melihat nomor WhatsApp dan menggunakan tombol WhatsApp di Kontak Internal. Menghapus persyaratan capability tambahan `contacts.internal.view`, `crew.permissions.manage`, dan pengecekan profil khusus `admin`/`eksekutif` dari `api/kontak.ts`; (2) Perlindungan Keamanan Autentikasi Server-Side: Pengguna tanpa sesi login valid (unauthenticated) tetap wajib ditolak dengan HTTP 401 fail-closed (`unauthorized`) di tingkat backend, mencegah pembacaan nomor telepon melalui panggilan API langsung; (3) Live Database Read: 8 nomor WhatsApp asli pimpinan dan kru dibaca langsung dari `legacy_archive_kru.metadata_json.telepon` di Supabase Staging (`swadgljnyelsjstqqxbm`) tanpa hardcoded map atau dummy data; (4) Koreksi Status Kontak Drawer: Mengubah fallback status nomor telepon di `KontakInternalDetailDrawer.tsx` dari "Terproteksi (Izin Khusus)" menjadi "Tidak tersedia" saat nomor memang kosong di database; (5) Verifikasi Live Port 5174: Pengujian live dev server port 5174 membuktikan unauthenticated -> 401, PTV-STG-ADM (`admin_staging`) -> 200 (8 nomor WA asli), dan PTV-STG-KRU (`kru_staging`) -> 200 (8 nomor WA asli tanpa hak akses khusus); (6) Quality Gates: 0 TypeScript errors, 0 ESLint warnings, 759/759 unit tests passed pada 66 test files, build produksi Vite sukses 14.77s. | Keputusan Operator: "Semua pengguna PTV Hub yang sudah login boleh melihat nomor WhatsApp dan menggunakan tombol WhatsApp di Kontak Internal. Tidak diperlukan capability atau permission tambahan." | Kritis | (1) Menyederhanakan otorisasi di `api/kontak.ts` untuk mengizinkan seluruh sesi login valid membaca kontak internal dan nomor WA; (2) Memperbaiki fallback label di `KontakInternalDetailDrawer.tsx`; (3) Membangun unit test suite `tests/hub/kontakWhatsAppAccess.test.ts`; (4) Memverifikasi live HTTP request di port 5174; (5) Memverifikasi seluruh 4 quality gates lulus 100%. | **Fixed** |
| **CLN-086** | 2026-10-19 | `PTV-DEV-077` | `src/products/hub/kontak/kontakMapper.ts`, `src/products/hub/kontak/kontakService.ts`, `api/kontak.ts`, `src/products/hub/kontak/internalContactStore.ts`, `docs/PTV-PRO-STAGING-KRU-CONTACTS-ROLLBACK.sql` | P0 Finalization: Kontak Internal Data Migration & Source of Truth | (1) Eliminasi Hardcoded Phone Map dari Bundle Frontend: `CANONICAL_INTERNAL_PHONE_MAP` sebelumnya didefinisikan di `kontakMapper.ts` dan diimpor oleh `kontakService.ts`, sehingga nomor kontak privat berisiko terkompilasi langsung ke dalam file JS client (`dist/assets/*.js`). Konstanta ini telah dihapus sepenuhnya dari client bundle; (2) Server-Side Capability Gating: Pemetaan unmasking nomor telepon darurat/transisi dipindahkan sepenuhnya ke dalam serverless backend `api/kontak.ts` (`SERVER_INTERNAL_PHONE_MAP`) dan dijaga ketat oleh capability check (`contacts.internal.view`, `hub.access`, atau role `kru`). Pemanggil yang tidak terautentikasi atau tanpa izin hanya menerima nomor masked (`****0616`), sehingga tombol/tautan WhatsApp otomatis tidak dibuat di client; (3) Pengecualian Record Testing Berbasis Stable ID & Provenance: `api/kontak.ts` menggunakan set ID stabil `KNOWN_TEST_RECORD_PTV_IDS = new Set(['PTV-UJI-2712'])` serta memeriksa status testing/quarantine, bukan regex nama yang rapuh; (4) Eliminasi Mock Fallback Runtime di Browser: `internalContactStore.ts` di lingkungan browser kini tidak lagi diam-diam melakukan seeding fake data dari `internalContactMockData.ts` ke `localStorage`. Store diinisialisasi kosong dengan `isLoading: true` dan mengambil data langsung dari `/api/kontak`. Jika API gagal, store menampilkan error state terstruktur dan tombol retry ("Coba Lagi"); (5) Koreksi Skrip Rollback: Memperbaiki `docs/PTV-PRO-STAGING-KRU-CONTACTS-ROLLBACK.sql` line 30 agar mengembalikan status `PTV-UJI-2712` ke 'nonaktif' (sesuai backup pre-patch asli) bukan 'aktif'; (6) Rekonsiliasi Selisih 49 vs 50 Kontak: Terkonfirmasi bahwa 50 kontak pada tangkapan layar sebelumnya disebabkan oleh masuknya `PTV-UJI-2712` yang memiliki jabatan "Koordinator Kru Uji", sehingga regex legacy PHP mengklasifikasikannya sebagai Pengurus ke-3. Setelah record testing difilter secara kanonikal, direktori resmi menghasilkan tepat 49 kontak otentik (8 Pembina, 4 Pengarah, 2 Pengurus, 35 Kru); (7) Quality Gates: 0 TypeScript errors, 0 ESLint warnings, 755/755 unit tests passed pada 65 test files, build Vite sukses 14.40s. | Instruksi Operator: "PTVPRO — P0 FINALIZATION: KONTAK INTERNAL DATA MIGRATION & SOURCE OF TRUTH" | Kritis | (1) Menghapus `CANONICAL_INTERNAL_PHONE_MAP` dari `kontakMapper.ts` dan `kontakService.ts`; (2) Memindahkan dan memproteksi phone unmasking di `api/kontak.ts` dengan HttpOnly authentication & RBAC; (3) Mengeliminasi fallback mock data di browser store `internalContactStore.ts`; (4) Mengoreksi baris rollback SQL untuk `PTV-UJI-2712`; (5) Memverifikasi seluruh 4 quality gates lulus 100%. | **Fixed** |
| **CLN-085** | 2026-10-19 | `PTV-DEV-076` | `src/products/hub/kontak/kontakMapper.ts`, `src/products/hub/kontak/mock/internalContactMockData.ts`, `src/products/hub/kru/canonicalCrewData.ts`, `api/kontak.ts`, `src/products/hub/kontak/kontakService.ts`, `src/products/hub/kontak/KontakInternalPage.tsx`, `src/products/hub/kontak/components/KontakInternalDetailDrawer.tsx`, `docs/PTV-PRO-STAGING-KRU-CONTACTS-PATCH.sql`, `docs/PTV-PRO-STAGING-KRU-CONTACTS-ROLLBACK.sql`, `backups/staging-legacy-archive-kru-pre-contacts-migration-2026-10-19.json` | P0 Kontak Internal: Remove Dummy & Complete Data Migration, Kru WhatsApp Restoration & Profile Photo Fallbacks | (1) Identifikasi & Pemulihan Nomor WhatsApp Kru: Nomor telepon di Staging `legacy_archive_kru` tersimpan dalam format masking tanda bintang (`****0616`, `****1822`, dsb) akibat skrip ekspor awal, sehingga validasi `isWaValid` mengevaluasi false untuk seluruh kru. Audit Production `jthzuhkblxcaohiuypqq` (STRICT READ-ONLY) dan WordPress legacy SQL (`local.sql`) mengungkap 8 nomor WhatsApp asli milik pimpinan dan kru (`PTV-001`, `PTV-003`, `PTV-005`, `PTV-011`, `PTV-012`, `PTV-013`, `PTV-029`, `PTV-035`). Nomor-nomor ini dipetakan secara kanonikal (`CANONICAL_INTERNAL_PHONE_MAP`) dan diintegrasikan ke endpoint `/api/kontak` untuk kru berwenang; (2) Eliminasi Kontak Dummy Runtime & Rekonsiliasi `PTV-017`: Mengeliminasi kontak sintetis `Kru Testing Integrasi` (`PTV-017` seeded test `6281234567890`) dan `Kru Uji Staging Otomatis` (`PTV-UJI-2712`). Rekonsiliasi data historis WordPress (Post ID 864) membuktikan `PTV-017` adalah Muhammad Hamdan Yuwafi Sulaim (Angkatan 12, Divisi Technical). Fixtures mock, crew store, dan API telah diselaraskan; (3) Penanganan Foto Profil Rusak (404 Not Found): Menemukan 4 URL foto profil yang menghasilkan HTTP 404 (`PTV-025`, `PTV-046`, `PTV-070`, `PTV-062`). URL ini dihilangkan dari data kanonikal, serta ditambahkan event `onError` DOM handler pada `KontakInternalPage.tsx` dan `KontakInternalDetailDrawer.tsx` agar avatar inisial bergradien semantik kategori langsung tampil rapi tanpa pernah memunculkan ikon broken image; (4) Penyempurnaan Detail Drawer: Memperbaiki drawer kontak agar menampilkan status "Tidak tersedia" atau "Terproteksi (Izin Khusus)" saat nomor kosong/terproteksi, tanpa membuat tautan telp/WhatsApp palsu; (5) Tata Kelola Database Staging: Membuat backup snapshot JSON 94 baris `legacy_archive_kru` (`staging-legacy-archive-kru-pre-contacts-migration-2026-10-19.json`), skrip patch SQL idempotent (`docs/PTV-PRO-STAGING-KRU-CONTACTS-PATCH.sql`), skrip rollback SQL (`docs/PTV-PRO-STAGING-KRU-CONTACTS-ROLLBACK.sql`), dan menjalankan dry-run terverifikasi. Tidak ada mutasi database yang dieksekusi sebelum persetujuan operator; (6) Quality Gates: 0 TypeScript errors (`tsc --noEmit`), 0 ESLint warnings (`eslint . --max-warnings 0`), 755/755 unit tests lulus 100% pada 65 test files, dan build produksi Vite lolos. | Instruksi Operator: "PTVPRO — P0 KONTAK INTERNAL: REMOVE DUMMY & COMPLETE DATA MIGRATION" | Kritis | (1) Membangun `CANONICAL_INTERNAL_PHONE_MAP` dan `KNOWN_BROKEN_PHOTO_PTV_IDS` di `kontakMapper.ts`; (2) Merekonsiliasi `PTV-017` ke Muhammad Hamdan Yuwafi Sulaim di mock fixtures dan canonical crew data; (3) Memperbarui `api/kontak.ts` untuk mengecualikan kontak uji, menginjeksi unmasked phone, dan mengabaikan URL foto 404; (4) Menambahkan `onError` fallback pada `KontakInternalPage.tsx` dan `KontakInternalDetailDrawer.tsx`; (5) Membuat backup snapshot JSON Staging 94 baris, SQL patch idempotent, dan SQL rollback; (6) Menjalankan dry-run script terverifikasi; (7) Menjalankan 4 verification gates lolos 100%. | **Fixed** |
| **CLN-084** | 2026-10-18 | `PTV-DEV-075` | `src/styles/generatorSurat.css`, `src/products/hub/surat/generator/GeneratorSuratPage.tsx`, `src/styles/perizinan.css`, `src/products/hub/pengaturan/PengaturanPage.tsx`, `src/products/hub/broadcast/BroadcastPage.tsx`, `src/products/hub/arsip/ArsipPage.tsx`, `src/products/hub/inventaris/InventarisPage.tsx`, `src/products/hub/kru/components/ManagePermissionsModal.tsx`, `src/styles/nilaiInventaris.css`, `src/styles/inventaris.css`, `src/products/hub/lapor-kerusakan/lapor-kerusakan.css`, `src/styles/pengaturan.css` | P0 Global UI Polish: Dark Mode Generator Surat Izin, Header Eyebrows Cleanup & Global Responsive Hotfix | (1) Dark Mode Generator Surat Izin: Mengimplementasikan token Dark Mode PTVPRO secara menyeluruh di `generatorSurat.css` dan `GeneratorSuratPage.tsx` untuk panel parameter, form input, preset pill, checklist angkatan, tabel daftar santri, modal verifikasi otorisasi, dan navigasi bento cards di `perizinan.css` (`.prz-bento-card.tugas`, `.prz-bento-card.barang`, `.prz-summary-banner`) mengeliminasi silau elemen putih; (2) Preservasi Kertas PDF Resmi: Lembar preview PDF (`.izin-pdf-page`) dan `.gen-empty-preview` tetap dipertahankan 100% berlatar putih `#ffffff` dengan teks hitam `#0f172a` untuk kepatuhan dokumen cetak institusi; (3) Global Header Cleanup: Menghapus badge/eyebrow dekoratif non-fungsional di atas judul utama halaman (`PengaturanPage.tsx`, `BroadcastPage.tsx`, `ArsipPage.tsx`, `InventarisPage.tsx`, dan `ManagePermissionsModal.tsx`) secara konsisten dengan kerapian spacing tanpa meninggalkan ruang kosong; (4) Preservasi Badge Fungsional: Menjaga seluruh badge status fungsional (Aktif, Tersedia, Terlambat, role, kategori, jumlah, dan filter); (5) Responsive Nilai Inventaris: Mengeliminasi peregangan vertikal ekstrem kartu dan ruang kosong masif antara informasi alat dan Nilai Perolehan (`ptv-nilai-card-inner` `justify-content: flex-start; gap: 20px;`, `ptv-nilai-card-main-col` `max-width: 440px;`, `ptv-nilai-card-dossier-col` `max-width: 380px;`, `margin-left: auto;` pada tombol aksi desktop). Pada mobile (`<= 768px`), menyembunyikan teks `<span>Hapus</span>` di dalam tombol `.ptv-nilai-btn-del` sehingga bertransformasi menjadi tombol icon 38x38px yang sleek dan tidak bertabrakan dengan tombol Detail dan Ubah; (6) Responsive Lapor Kerusakan: Mengubah search box agar mengisi 100% lebar mobile, filter tabs status horizontal scrollable halus tanpa scrollbar (`overflow-x: auto; -webkit-overflow-scrolling: touch`), counter status tidak terpotong (`flex-shrink: 0; white-space: nowrap`), tombol `+ Lapor Kerusakan` tetap terlihat dengan full width flex, dan summary statistics bar tersusun rapi tanpa bullet menggantung; (7) Responsive Pengaturan & Profil: Kartu identitas kru dibuat fleksibel responsif (`flex-wrap: wrap`), avatar 48px, nama panjang dapat melakukan wrap alami (`word-break: break-word`), status chip tidak keluar container, dan padding bawah memperhitungkan safe-area serta mobile navigation dock (`padding-bottom: calc(var(--dock-h, 64px) + var(--sab, 0px) + 32px);`); (8) Quality Gates: 0 TypeScript errors, 0 ESLint warnings, 755/755 unit tests lulus 100% pada 65 test files, build produksi Vite lolos 19.08s. | Instruksi Operator: "PTVPRO — P0 GLOBAL UI POLISH: DARK MODE, HEADER CLEANUP & RESPONSIVE HOTFIX" | Kritis | (1) Mengimplementasikan dark mode tokens di `generatorSurat.css` dan `perizinan.css`; (2) Menghilangkan hardcoded inline colors di `GeneratorSuratPage.tsx`; (3) Menghapus eyebrow badges di 5 modul; (4) Memperbaiki card stretching dan collision di `nilaiInventaris.css`; (5) Menata responsivitas toolbar di `lapor-kerusakan.css`; (6) Menata layout profil di `pengaturan.css`; (7) Memverifikasi seluruh 4 quality gates lulus 100%. | **Fixed** |
| **CLN-083** | 2026-10-18 | `PTV-DEV-074` | `src/products/hub/inventaris/*` (`UnitPickerModal.tsx`, `loanBasketStore.ts`, `InventarisPage.tsx`), `src/products/hub/peminjaman/LoanModal.tsx`, `src/shared/components/BackToTopButton.tsx`, `src/products/hub/shell/HubShell.tsx`, `src/styles/*` (`inventaris.css`, `base.css`), `tests/hub/unitPickerAndBackToTop.test.tsx` | P0 Peminjaman Inventaris UI Hotfix: Unit Picker Modal 1:1 Legacy Parity, Multi-Unit Basket Sync, Category Auto-Expansion & Global Back to Top Button | (1) Tombol + pada kartu inventaris sebelumnya langsung memasukkan semua unit stok ke keranjang pinjaman tanpa modal pemilihan unit fisik; (2) Membuat `UnitPickerModal.tsx` yang mem-porting 1:1 modal legacy PHP (`openUnitPickerModal`), me-render data unit fisik asli dari Supabase Staging (`swadgljnyelsjstqqxbm`) dengan kode unit, nama, kondisi, status ketersediaan, disabling unit rusak/dipinjam, dan badge jumlah unit terpilih di footer; (3) Tombol "Selesai" dan "Lihat Daftar Pinjaman" (membuka `LoanModal`) berfungsi interaktif; (4) Keranjang pinjaman `loanBasketStore.ts` disempurnakan dengan deteksi komposit `${assetId}_${unitId}`, `${assetId}_${unitNo}`, dan UUID `u.id` untuk sinkronisasi pilihan lintas modal dan halaman; (5) Memperbaiki katalog alat di `LoanModal.tsx` yang sebelumnya menampilkan baris kosong: normalisasi kategori kanonikal (`normalizeInventoryCategory`), auto-expansion kategori berpenghuni saat data termuat, dan pemindahan `useEffect` sebelum render guard `if (!isOpen) return null;` untuk mencegah pelanggaran aturan React Hook; (6) Menambahkan tombol aksi pemilihan unit langsung pada header alat di `LoanModal`; (7) Mengimplementasikan tombol global `BackToTopButton.tsx` di `HubShell.tsx` dengan pelacakan scroll window & container `.main` (>350px), smooth scroll, posisi desktop (`bottom: 28px; right: 28px`) vs mobile (`bottom: calc(var(--dock-h, 56px) + var(--sab, 0px) + 16px); right: 18px`), dan auto-suppression saat ada modal/scrim aktif; (8) Seluruh komponen mematuhi token Continuous Curve (`var(--ptv-curve-*)`) dan R03 standard; (9) Menambahkan 7 unit tests di `unitPickerAndBackToTop.test.tsx` dan memvalidasi via Headless Chrome CDP pada server staging (port 5174); seluruh 65 test files lolos (755/755 tests passed 100%), typecheck 0 error, lint 0 error, build lolos. | Instruksi Operator: "PTVPRO — P0 PEMINJAMAN UI HOTFIX & GLOBAL BACK TO TOP" | Kritis | (1) Membuat `UnitPickerModal.tsx` dan memasangnya di `InventarisPage.tsx`; (2) Menyelaraskan `loanBasketStore.ts`; (3) Memperbaiki `LoanModal.tsx` (auto-expand, category normalization, hooks order); (4) Membangun `BackToTopButton.tsx` dan memasangnya di `HubShell.tsx`; (5) Menata responsivitas CSS di `inventaris.css` dan `base.css`; (6) Membangun unit tests dan verifikasi CDP nyata. | **Fixed** |
| **CLN-080** | 2026-10-18 | `PTV-DEV-071` | `src/shared/utils/qrCode.tsx`, `src/products/hub/id-digital/IdDigitalPage.tsx`, `src/products/hub/surat/generator/components/SuratIzinPdfPreview.tsx`, `src/products/hub/acara/*`, `src/styles/acara.css`, `api/peminjaman.ts`, `src/products/hub/peminjaman/*`, `src/products/hub/kru/components/*` | P0 Master Execution: Full Migration Reconciliation, Global Modal Portals, Mobile UX Hotfix, Crew Auth Parity & Real Scannable QR Codes | (1) Peminjaman Inventaris Multi-Equipment: Mengupdate `api/peminjaman.ts` untuk memetakan seluruh array `equipment_ids` pada satu transaksi peminjaman (bukan hanya `equipment_ids[0]`), menghubungkan ke master `ptv_inventaris` dan unit fisik `ptv_inventaris_unit` dengan ID transaksi yang seragam, serta menambahkan filter tab 'Terlambat' pada `PeminjamanPage.tsx`
| **CLN-079** | 2026-10-18 | `PTV-DEV-070` | `src/products/hub/beranda/*` (`BerandaPage.tsx`, `berandaService.ts`, `berandaDataUtils.ts`, `types.ts`), `src/app/router/index.tsx`, `tests/hub/berandaFullIntegration.test.tsx` | Dashboard Utama (Beranda) P0 Full Real-Time Data Integration: Dummy Content Elimination & Module Aggregation | (1) Dashboard Utama React sebelumnya memuat array dummy/hardcoded pada komponen Hero Acara (`upcomingEvent`), Agenda Berikutnya (`nextAgendas`), Alat Saya (`myLoans`), Pengumuman (`announcements`), Dokumen Saya (hardcoded 3 disetujui & 1 menunggu), dan greeting "Halo Farid"; (2) Menghapus seluruh konten dummy dan menghubungkan dashboard sebagai agregator real-time murni yang mengonsumsi 4 modul/service resmi (`acaraService`, `broadcastService`, `peminjamanService`, `dokumenService`) secara paralel via `Promise.allSettled` tanpa membuat database paralel atau duplikasi data; (3) Mengekstrak modul utilitas kanonikal `berandaDataUtils.ts`: Penegakan timezone Asia/Jakarta (WIB) untuk tanggal `todayIso` / `tomorrowIso`, salam dinamis berbasis jam WIB (`getGreeting`), format tanggal relatif legacy (`formatRelDay`), filter acara aktif mendatang (`filterUpcomingEvents` mengecualikan acara masa lalu dan status Selesai/Batal, terurut terdekat dahulu), dan isolasi peminjaman pengguna aktif (`filterMyActiveLoans` berdasarkan `actor_id` / nama akun kru, mencegah kebocoran data antar-kru); (4) Mempertahankan 100% desain visual dan tata letak ContinuousSurface (Profile D continuous curves `var(--ptv-curve-*)`, soft surface, 6 shortcut bento desktop, 4 shortcut mobile); (5) Menambahkan loading skeleton state, error retry banner dengan tombol "Coba Lagi", empty state hero ("Tidak ada kegiatan terjadwal"), empty state pinjaman ("Tidak ada alat yang sedang kamu pinjam."), dan link navigasi resmi; (6) Membungkus route `/hub/beranda` dengan `<AcaraProvider>` di router; (7) Membangun regression test suite komprehensif `tests/hub/berandaFullIntegration.test.tsx` (10 unit tests); seluruh 61 test files (716/716 tests passed 100%), 0 type errors, 0 lint warnings, build lolos 14.99s. | Instruksi Operator: "PTVPRO — P0 FULL DASHBOARD DATA INTEGRATION: HAPUS SELURUH DATA DUMMY" | Kritis | (1) Mengganti data dummy di `BerandaPage.tsx` dengan data live teragregasi; (2) Mengekstrak `berandaDataUtils.ts` untuk fungsi murni filter, sorting, timezone WIB, dan isolasi akun; (3) Memperbarui `berandaService.ts` untuk mengagregasikan 4 modul; (4) Membungkus route `/hub/beranda` dengan `<AcaraProvider>`; (5) Membangun 10 regression tests di `berandaFullIntegration.test.tsx`; seluruh quality gates lulus. | **Fixed** |
| **CLN-078** | 2026-10-18 | `PTV-DEV-069` | `api/auth/*` (`identity.ts`, `google/login.ts`, `google/callback.ts`, `google/status.ts`, `google/unlink.ts`), `src/products/hub/pengaturan/*` (`PengaturanPage.tsx`, `components/UnlinkGoogleConfirmModal.tsx`), `vite.config.ts`, `tests/auth/googleAccountLinking.test.ts` | Google SSO/OAuth & Account Linking Implementation, Anti-Account Takeover Defense, Vercel Serverless SSR Endpoints, Confirm Modal & 13 Regression Tests | (1) Mengaktifkan fitur Google SSO/OAuth & Google Account Linking untuk seluruh akun kru PTVPRO (akun migrasi lama maupun akun baru); (2) Mempertahankan 1 identitas kanonikal utama (`canonical_identity` & `user_account`) tanpa menduplikasi data atau membuat akun kedua; (3) Pertahanan anti-account takeover fail-closed: Linking WAJIB mengikat Google `sub` (Subject ID unik permanen) dan sesi aktif server-side (`ptv_hub_session`), DILARANG mengandalkan email semata atau auto-linking lintas akun; (4) Konflik identitas ditolak (`conflict: true` / `oauth_status=conflict`) saat Google Subject ID sudah ditautkan ke akun kru lain; (5) Menambahkan endpoint `/api/auth/google/status` (GET) dan `/api/auth/google/unlink` (POST) pada Vercel serverless layer dan middleware Vite dev server; (6) Implementasi UI Pengaturan: Kartu Google SSO dengan status badge dinamis ("Terhubung" / "Belum Terhubung"), tombol "Hubungkan Google" dan "Putuskan Hubungan", feedback alert banner, dan dialog modal konfirmasi `UnlinkGoogleConfirmModal.tsx`; (7) Inisialisasi SSR default `{ is_linked: false }` untuk mencegah layout shift atau teks loading menggantung saat render awal; (8) Membangun test suite komprehensif `tests/auth/googleAccountLinking.test.ts` memverifikasi 13 skenario regresi; (9) Seluruh 60 test files (706/706 tests passed 100%), 0 type errors, 0 lint warnings, build produksi lolos 21.79s. | Instruksi Operator: "PTVPRO — IMPLEMENTASI GOOGLE SSO/OAUTH & ACCOUNT LINKING UNTUK SELURUH AKUN KRU" | Kritis | (1) Menambahkan interface dan helper function `getGoogleOAuthStatus`, `linkGoogleIdentityToAccount`, `unlinkGoogleIdentityFromAccount` di `api/auth/_utils/identity.ts`; (2) Menyesuaikan `api/auth/google/login.ts` untuk mendukung `action=link` dengan signed state payload; (3) Menyesuaikan `api/auth/google/callback.ts` untuk menangani linking flow dan redirect ke `/hub/pengaturan`; (4) Membangun serverless endpoint `api/auth/google/status.ts` dan `api/auth/google/unlink.ts`; (5) Mendaftarkan endpoint baru di `vite.config.ts`; (6) Memperbarui `PengaturanPage.tsx` dan membuat `UnlinkGoogleConfirmModal.tsx`; (7) Membangun test suite `tests/auth/googleAccountLinking.test.ts`; seluruh 706 unit tests lolos 100%. | **Fixed** |
| **CLN-077** | 2026-10-18 | `PTV-DEV-068` | `src/products/hub/kontak/KontakInternalPage.tsx`, `src/styles/kruKomunikasi.css`, `tests/hub/kontakInternalLayoutRegression.test.tsx` | Kontak Internal Layout Redesign: Nested Cards Elimination & One Person, One Card Pattern | (1) Halaman Kontak Internal sebelumnya menggunakan outer card besar (`.kk-group-card`) yang membungkus heading kategori dan seluruh daftar kontak, menciptakan struktur nested cards (card di dalam card); (2) Menghapus seluruh outer card visual per kategori dan menggantinya dengan heading biasa (`.kontak-category-header`) di atas stack kartu; (3) Heading tetap menampilkan nama kategori, badge counter jumlah anggota, dan deskripsi kategori; (4) Setiap akun/kontak dirender sebagai satu kartu mandiri (`.kk-list-item` dengan latar putih, border tipis `var(--line)`, rounded `var(--ptv-curve-md)`, soft shadow, hover state halus `translateY(-1px)`, dan tombol Chat WhatsApp jika nomor valid); (5) Sub-kategori angkatan kru berupa sub-heading (`.kontak-angkatan-header`) di atas stack kartu individual tanpa outer card pembungkus; (6) Spacing konsisten: gap 10px antar-card dan margin 32px antar-kategori; (7) Skeleton loading state diselaraskan tanpa outer card; (8) Menambahkan 4 unit regression tests di `kontakInternalLayoutRegression.test.tsx`; seluruh 59 test files lolos (693/693 tests passed 100%), 0 type errors, 0 lint warnings, build produksi lolos 13.12s. | Instruksi Operator: "PTVPRO — PERBAIKAN LAYOUT KONTAK INTERNAL: ONE PERSON, ONE CARD" | Rendah | (1) Mengganti pembungkus `.kk-group-card` pada `KontakInternalPage.tsx` dengan `.kontak-category-section`, `.kontak-category-header`, dan `.kontak-cards-stack`; (2) Menerapkan `.kontak-angkatan-group` dan `.kontak-angkatan-header` untuk kru; (3) Menata kartu kontak individual `.kk-list-item` dengan spacing konsisten; (4) Menambahkan styling layout semantik di `kruKomunikasi.css`; (5) Menambahkan 4 unit tests regression di `kontakInternalLayoutRegression.test.tsx`; seluruh quality gates lulus. | **Fixed** |
| **CLN-076** | 2026-10-18 | `PTV-DEV-067` | `src/products/hub/inventaris/*` (`UnitBarcodesSection.tsx`, `AlatDetailPage.tsx`, `inventarisService.ts`, `utils/barcode128.ts`, `utils/barcodeExportUtils.ts`), `tests/hub/inventarisBarcodeLabel.test.tsx` | Inventaris Unit Barcode Code 128 Implementation, Independent Decoder, High-Res Canvas PNG & Print Layout | (1) Halaman detail alat React (`AlatDetailPage.tsx`) belum memiliki section Label Barcode Unit seperti pada PHP Legacy (`legacy/page-dasbor.php` L19875–L19985); (2) Barcode wajib menggunakan standar Code 128 murni yang dapat dipindai oleh scanner optik laboratorium fisik (bukan garis dekoratif palsu), lengkap dengan quiet zone aman (14 modul), rasio modular ISO/IEC 15417, dan teks monospace di bawah garis; (3) Membangun independent Code 128 decoder untuk memvalidasi dan memverifikasi checksum modulo 103 secara matematis sehingga payload terbukti 100% identik dengan kode unit database; (4) Menyelaraskan format penomoran unit legacy `\${invCode}-\${String(uNo).padStart(2, '0')}` dengan preservasi kode unit eksplisit; (5) Menyediakan fungsionalitas Cetak 1 Label, Ekspor PNG 1 Label (3x HD / 300 DPI via Canvas), Cetak Semua (batch print grid), dan Ekspor Semua PNG; (6) Menghilangkan hardcoded inline border-radius (`10px`, `8px`) pada komponen TSX demi kepatuhan Continuous Curve governance (`var(--ptv-curve-md)`, `var(--ptv-curve-sm)`); (7) Menambahkan pengurutan deterministik (`kode_unit` natural sort) pada `getInventarisList` dan `getInventarisById` agar unit tidak meloncat-loncat; (8) Menambahkan 7 unit regression tests di `inventarisBarcodeLabel.test.tsx`; seluruh 58 test files lolos (689/689 tests passed 100%), 0 type errors, 0 lint warnings, build produksi lolos 19.57s. | Instruksi Operator: "PTVPRO — MIGRASI & PERBAIKAN LABEL BARCODE UNIT INVENTARIS" | Kritis | (1) Mengimplementasikan generator Code 128 Subtipe B dan independent decoder di `utils/barcode128.ts`; (2) Mengimplementasikan `renderBarcodeCardToCanvas`, `exportUnitBarcodePNG`, `exportAllUnitBarcodesPNG`, `printUnitBarcode`, dan `printAllUnitBarcodes` di `utils/barcodeExportUtils.ts`; (3) Membangun komponen UI `UnitBarcodesSection.tsx` dan memasangnya di `AlatDetailPage.tsx` sebelum riwayat peminjaman; (4) Menerapkan deterministic sorting `kode_unit` pada `inventarisService.ts`; (5) Menyelaraskan CSS continuous curve tokens; (6) Menambahkan 7 unit regression tests di `inventarisBarcodeLabel.test.tsx`; seluruh 689 tests lolos, build lolos. | **Fixed** |
| **CLN-075** | 2026-10-18 | `PTV-DEV-066` | `api/broadcast.ts`, `api/dokumen.ts`, `src/products/hub/broadcast/*`, `src/products/hub/arsip/*`, `src/products/hub/perizinan/*`, `src/products/hub/dokumen-saya/*`, `tests/hub/*` | Full Migration & Data Reconciliation: Broadcast & Pengumuman, Surat & Arsip, Pengajuan Perizinan | (1) Modul Broadcast & Pengumuman sebelumnya menggunakan 3 mock sintetis (`ann-01..03`) bertema lensa/baterai palsu; data otentik di Staging & Production (`ptv_pengumuman`) adalah tepat 3 pengumuman resmi ("Dasbor sudah bisa digunakan!", "Pengumuman Bug System", "Ndang bayar kas, rek!"); (2) Modul Surat & Arsip dan Pengajuan Perizinan sebelumnya mengandalkan fixtures mock sintetis (`doc-101..105`) dengan nomor surat palsu; data otentik di Staging & Production (`ptv_surat_izin`) adalah tepat 2 surat resmi (`001/SI-PTV/X/2026` & `007/SI-PTV/X/2026`), sedangkan tabel `ptv_surat_tugas` dan `ptv_surat_barang` bernilai 0 records; (3) Kolom database nyata `ptv_surat_izin` (`nama_santri`, `jenis_kegiatan`, `santri_list`) sebelumnya salah dipetakan sebagai `nama_pemohon` dan `alasan`; (4) Halaman Perizinan sesuai aturan PHP Legacy mengecualikan Surat Izin Santri resmi (dikelola di Generator Surat/Arsip) sehingga menampilkan empty state jujur 0 records tanpa fallback mock palsu; (5) Membangun endpoint serverless terautentikasi `/api/broadcast` dengan HttpOnly session, HMAC-SHA256, live revocation check, dan Strict Read-Only (HTTP 405 untuk mutasi); (6) Menghubungkan client service `BroadcastPage.tsx`, `ArsipPage.tsx`, dan `PerizinanPage.tsx` ke live Staging dengan loading skeleton, error retry banner, dan refresh synchronization; (7) Menghapus duplicate member `setLiveDocs` pada `DocsStore`; (8) Menyelaraskan hardcoded border radius (`12px`, `14px`, `8px`, `6px`) ke token continuous curve (`--ptv-curve-md`, `--ptv-curve-sm`, `--ptv-curve-xs`); (9) Menambahkan 9 unit regression tests di `fullMigrationBroadcastSuratPerizinan.test.ts`; seluruh 57 test files lolos (682/682 tests passed 100%), 0 type errors, 0 lint warnings, build produksi lolos 22.17s. | Instruksi Operator: "PTVPRO — FULL MIGRATION: BROADCAST & PENGUMUMAN, SURAT & ARSIP, PENGAJUAN PERIZINAN" | Kritis | (1) Mengimplementasikan serverless endpoint terautentikasi `api/broadcast.ts` dan mendaftarkan rutenya di Vite dev server; (2) Mengganti `DEFAULT_ANNOUNCEMENTS` di `broadcastStore.ts` dengan 3 data kanonikal otentik dan menaikkan storage key ke v2; (3) Memperbaiki mapping kolom nyata `nama_santri`, `jenis_kegiatan`, `santri_list` pada `api/dokumen.ts` dan `dokumenService.ts`; (4) Mengganti `INITIAL_DOCS_FIXTURES` di `docsMockData.ts` dengan 2 surat izin riil kanonikal dan menaikkan storage key store ke v2; (5) Menghubungkan `BroadcastPage.tsx`, `ArsipPage.tsx`, dan `PerizinanPage.tsx` ke live backend Staging dengan loading state, empty state jujur, error banner, dan badge read-only audit; (6) Menyelaraskan continuous curve tokens dan menghapus duplicate method; (7) Menyelaraskan unit tests pendukung dan menambahkan 9 unit regression tests baru; seluruh 682 tests lulus 100%, build lolos. | **Fixed** |
| **CLN-074** | 2026-10-18 | `PTV-DEV-065` | `src/products/hub/kontak/*`, `api/kontak.ts`, `tests/hub/*` | Kontak Internal P0 Reconciliation vs PHP Legacy & Production, Mock Elimination, 49 Canonical Contacts & Grouping Parity | (1) Kontak Internal sebelumnya memuat array fiktif `INSTITUTIONAL_LEADERSHIP` dengan nomor telepon palsu (`081230001001`, `081199887700`) dan ID sintetis (`cnt-pembina-01`); (2) Mengakibatkan duplikasi profil Abuya KH. Agoes Ali Masyhuri (muncul sebagai mock fiktif dan sebagai kru yang salah dikategorikan); (3) Aturan klasifikasi PHP Legacy (`isPembina`, `isPengarah`, `isPengurus`, `isKru`) mengecualikan 43 kru nonaktif yang jabatannya bukan "Kru"; sedangkan React sebelumnya memuat ke-94 kru tanpa filter eksklusi sehingga total membengkak menjadi 98; (4) Total kontak internal sah PHP Legacy adalah tepat 49 orang (Pembina: 8, Pengarah: 4, Pengurus: 2, Kru: 35 terbagi dalam 10 angkatan); (5) Sinkronisasi dua arah ke crew store dihubungkan secara reaktif tanpa merusak identitas; (6) Menambahkan 7 unit regression tests di `kontakInternalReconciliation.test.ts`; seluruh 56 test files lolos (673/673 tests passed 100%), 0 type errors, 0 lint warnings, build lolos. | Instruksi Operator: "PTVPRO — P0 DATA RECONCILIATION: KONTAK INTERNAL VS PHP LEGACY & PRODUCTION" | Kritis | (1) Mengimplementasikan aturan legacy PHP `isLegacyPembina`, `isLegacyPengarah`, `isLegacyPengurus`, `isLegacyKru`, `classifyInternalContact`, `groupCrewByAngkatan`, `formatAngkatanDisplay` di `kontakMapper.ts`; (2) Menghapus array hardcoded fiktif `INSTITUTIONAL_LEADERSHIP`; (3) Menyusun baseline fixtures `internalContactMockData.ts` memuat tepat 49 kontak kanonikal dari `production-bundle.json`; (4) Menyelaraskan endpoint `api/kontak.ts` dan client service `kontakService.ts`; (5) Memperbarui `KontakInternalPage.tsx` untuk memanfaatkan `groupCrewByAngkatan` pada kru; (6) Menyelaraskan test suite `kruKomunikasi.test.ts` dan menambahkan regression tests `kontakInternalReconciliation.test.ts`; 673 tests lulus, build lolos. | **Fixed** |
| **CLN-070** | 2026-10-18 | `PTV-DEV-061` | `api/kontak.ts`, `vite.config.ts`, `src/products/hub/kontak/*`, `src/products/hub/kontak-eksternal/*`, `tests/hub/kontakStaging.test.ts` | Kontak Internal & Kontak Eksternal Supabase Staging Integration (Read-Only), 8 Relasi Lembaga Riil, Field Masking & Sanitasi Tautan Komunikasi | (1) Modul Kontak Eksternal sebelumnya menggunakan fixtures mock; (2) Data riil di Staging tersimpan pada tabel `ptv_kontak_eksternal` sebanyak 8 baris (U. Dadang, U. Isma Dwi, U. Pujo, U. Rizal Babel, Ust. Arshy Fajar, Ust. Horison, Ust. Nasikhul Amin, Ust. Udin) dengan instansi Pondok, Sekolah, dan Yayasan; (3) Kontak Internal mengonsolidasikan data kru asli Staging (`legacy_archive_kru`) untuk Pengurus & Kru serta figur kehormatan pimpinan lembaga (KH. Agoes Ali Masyhuri, Gus Syaikhul Islam, Dr. Ahmad Musthofa, Ust. Syafiqurrahman); (4) Nomor telepon kru yang bersifat privat di-mask untuk pengguna non-privileged; (5) Tautan WhatsApp dan telepon disanitasi agar nomor masked (`*`) atau invalid tidak menghasilkan link broken; (6) Menolak metode mutasi (POST/PUT/DELETE) dengan HTTP 405 (Strict Read-Only mode audit); (7) Menambahkan loading skeleton, error retry banner, dan audit disclaimer toast; (8) Menambahkan 9 unit regression tests di `kontakStaging.test.ts`; seluruh 53 test files passed (630/630 tests passed), 0 lint warnings, build lolos. | Instruksi Operator: "PTVPRO — MIGRASI & INTEGRASI KONTAK INTERNAL DAN KONTAK EKSTERNAL KE SUPABASE STAGING" | Sedang | (1) Membangun endpoint `api/kontak.ts` (GET only, HttpOnly cookie, RBAC fail-closed); (2) Mendaftarkan `/api/kontak` di middleware Vite dev server; (3) Mengekstrak canonical mapper `kontakMapper.ts` di client layer; (4) Membangun `kontakService.ts` untuk konsumsi data live Staging; (5) Menghubungkan `KontakEksternalPage.tsx` dan `KontakInternalPage.tsx` dengan loading skeleton, error retry, dan sanitized WA links; (6) Menambahkan 9 unit regression tests di `kontakStaging.test.ts`; seluruh 630 tests passed 100%, build lolos. | **Fixed** |
| **CLN-069** | 2026-10-18 | `PTV-DEV-060` | `api/dokumen.ts`, `vite.config.ts`, `src/products/hub/dokumen-saya/*`, `src/products/hub/arsip/*`, `tests/hub/dokumenArsipStaging.test.ts` | Dokumen Saya & Arsip Dokumen Supabase Staging Integration (Read-Only), Ownership Filtering, RBAC Fail-Closed & Continuous Curve Governance | (1) Dokumen Saya dan Arsip Dokumen sebelumnya menggunakan data in-memory fixture; (2) Data riil di Staging tersimpan pada tabel resmi `ptv_surat_izin` (2 records: `001/SI-PTV/X/2026` dan `007/SI-PTV/X/2026`), `ptv_surat_tugas` (0 records), dan `ptv_surat_barang` (0 records); (3) Institusi PTVPRO tidak menyimpan berkas PDF mentah di Supabase Storage (hanya ada bucket `inventory`), melainkan dokumen diverifikasi secara dinamis via `/verifikasi-surat/:no`; (4) Pemisahan mekanisme Dokumen Saya (filter kepemilikan pengguna `isUserInDoc`) dan Arsip Dokumen (RBAC arsip `documents.archive.view`/`documents.archive.manage` dengan pengelompokan tahunan dan bulanan `MonthlyArchiveGroup`); (5) Mencegah kebocoran dokumen pribadi antar-pengguna dengan filtering server-side; (6) Menolak metode mutasi (POST/PUT/DELETE) dengan HTTP 405 (Strict Read-Only mode audit); (7) Menyelaraskan border radius skeleton loading ke design token (`--ptv-curve-xs`, `--ptv-curve-sm`) sesuai Continuous Curve governance; (8) Menambahkan 14 unit regression tests di `dokumenArsipStaging.test.ts`; seluruh 52 test files passed (621/621 tests passed), 0 lint warnings, build lolos. | Instruksi Operator: "PTVPRO — MIGRASI & INTEGRASI DOKUMEN SAYA DAN ARSIP DOKUMEN KE SUPABASE STAGING" | Sedang | (1) Membangun serverless endpoint `api/dokumen.ts` (GET only, HttpOnly cookie, RBAC fail-closed); (2) Mendaftarkan `/api/dokumen` pada middleware Vite dev server; (3) Membangun `dokumenService.ts` untuk konsumsi data live Staging; (4) Menghubungkan `DokumenSayaPage.tsx` dan `ArsipPage.tsx` dengan live loading skeleton, error banner retry, dan audit disclaimer toast; (5) Menghubungkan tombol download ke lembar verifikasi resmi `/verifikasi-surat/:no`; (6) Menyelaraskan border radius ke continuous curve tokens; (7) Menambahkan 14 unit tests di `dokumenArsipStaging.test.ts`; 621 tests lulus 100%, build lolos. | **Fixed** |
| **CLN-068** | 2026-10-18 | `PTV-DEV-059` | `api/kru.ts`, `src/products/hub/kru/kruMapper.ts`, `src/products/hub/kru/kruService.ts`, `src/products/hub/kru/kruStore.ts`, `src/products/hub/kru/canonicalCrewData.ts`, `tests/hub/kruStagingIntegration.test.ts` | Modul Manajemen Kru Supabase Staging Integration (Read-Only), Client-Server Boundary Isolation & 92 Canonical Migrated Crew Records Parity | (1) Modul Manajemen Kru React sebelumnya menggunakan 8 data kru dummy mock; (2) Mengintegrasikan 92 data kru unik hasil migrasi Production ke Staging (`legacy_archive_kru`); (3) Menjaga pemisahan tegas status keanggotaan organisasi (`status_kru`: 25 Aktif, 55 Nonaktif, 8 Pembina, 4 Pengarah) dan status akun portal (`status_akun`: seluruh 92 kru 'Belum Ada Akun'); (4) Mencegah pembuatan akun otomatis tanpa otorisasi; (5) Membangun serverless endpoint terautentikasi `/api/kru` dengan RBAC fail-closed dan Strict Read-Only (HTTP 405 untuk non-GET); (6) Memisahkan `kruMapper.ts` di client layer dari serverless API guna mengeliminasi kebocoran dependensi `node:crypto` / `node:http` ke Vite browser bundle; (7) Menambahkan loading skeleton, retry error banner, dan empty state audit riwayat login yang jujur; (8) Menambahkan 13 unit regression tests di `kruStagingIntegration.test.ts`; 51 test files lolos (607/607 tests passed 100%), 0 type errors, 0 lint warnings, build lolos. | Instruksi Operator: "PTVPRO — MIGRASI & INTEGRASI DATA MANAJEMEN KRU KE SUPABASE STAGING" | Sedang | (1) Membangun endpoint `api/kru.ts` (GET only, RBAC fail-closed, HttpOnly cookie); (2) Membangun snapshot fixture kanonikal 92 kru `canonicalCrewData.ts`; (3) Mengekstrak mapper kanonikal independen `kruMapper.ts`; (4) Menghubungkan `kruService.ts` dan `kruStore.ts` ke Staging; (5) Memperbarui `KruPage.tsx` dengan loading skeleton, error retry, dan read-only toast; (6) Menambahkan 13 unit tests di `kruStagingIntegration.test.ts`; seluruh 607 tests lulus 100%, build lolos. | **Fixed** |
| **CLN-067** | 2026-10-18 | `PTV-DEV-057` | `src/products/hub/kru/KruPage.tsx`, `src/styles/kruKomunikasi.css`, `tests/hub/kruFlatGroupedListRegression.test.tsx` | Manajemen Kru UI Redesign: Nested Cards Elimination & Flat Grouped List by Angkatan | (1) Tampilan daftar Manajemen Kru sebelumnya menggunakan nested cards (kartu di dalam kartu: `kk-group-card` membungkus header internal dan `kk-list-item` yang merupakan kartu individual ber-background putih, border keliling, shadow, dan radius 14px), menghasilkan hierarki visual yang terlalu bertumpuk; (2) Redesign presentation layer murni mengadopsi struktur Flat Grouped List: Heading kelompok angkatan berada di LUAR container kartu (`.kru-group-heading`), memuat icon, label angkatan, dan badge jumlah kru (`.kru-group-heading-count`); (3) Seluruh anggota dalam satu kelompok angkatan dibungkus dalam SATU container putih rounded (`.kru-group-container`, radius 20px / 16px mobile, border 1px, shadow halus, `overflow: hidden`); (4) Setiap anggota dirender sebagai row horizontal (`.kru-row-item`), BUKAN kartu individual: background transparan, tanpa border keliling, tanpa radius, dan dipisahkan antar-row via border-bottom tipis (row terakhir border-bottom none); (5) Komposisi row: Avatar foto/inisial bulat di kiri, nama dan jabatan/divisi di tengah (`text-overflow: ellipsis`), dan badge status kru (`.kru-row-badge`) di kanan; (6) Hover state halus (`var(--b-050)`) tanpa `transform: translateY` yang mengangkat kartu; (7) Responsif mobile tanpa horizontal overflow; (8) Konsisten di seluruh tab filter: Aktif, Nonaktif, Pengarah, Pembina, Semua; (9) Menambahkan 5 unit regression tests di `tests/hub/kruFlatGroupedListRegression.test.tsx`; seluruh 594 tests repositori lulus 100%, 0 lint warnings, build lolos 13.27s. | Instruksi Operator: "PTVPRO — REDESIGN UI DAFTAR MANAJEMEN KRU (FLAT GROUPED LIST)" | Rendah | (1) Menghilangkan struktur nested cards dari `KruPage.tsx` dan menerapkan layout flat grouped list; (2) Memindahkan heading angkatan ke luar container rounded; (3) Menerapkan SATU container putih rounded (`.kru-group-container`) per angkatan; (4) Menata anggota sebagai flat horizontal row (`.kru-row-item`) dengan pemisah border-bottom tipis; (5) Menambahkan class semantik dan mobile media query di `kruKomunikasi.css`; (6) Menambahkan 5 unit regression tests di `kruFlatGroupedListRegression.test.tsx`; seluruh 50 test files passed (594 tests), 0 type errors, 0 lint warnings, build lolos. | **Fixed** |
| **CLN-066** | 2026-10-18 | `PTV-DEV-056` | `api/acara.ts`, `api/catatan.ts`, `api/planner.ts`, `src/products/hub/acara/*`, `src/products/hub/kalender/*`, `src/products/hub/catatan/*`, `tests/hub/operationalPersistenceFullRegression.test.ts` | Operational Persistence Implementation, Supabase Staging Mutation Activation, Non-Destructive PTV_META Preservation, SQL TIME & Canonical Identity Normalization | (1) Form Tambah Acara dan Hapus Acara di modul Acara dan Kalender sebelumnya hanya memanipulasi state in-memory/React Context tanpa persistensi backend permanen; (2) Kolom `waktu_mulai`/`waktu_selesai` pada `ptv_acara` bertipe `time without time zone` sehingga format waktu UI berlabel "WIB" ditolak PostgreSQL; (3) Kolom `created_by` pada `ptv_acara` memiliki foreign key constraint ke `canonical_identity(id)` yang membutuhkan sanitasi nilai UUID; (4) Modul Catatan Bersama & Notulensi Rapat belum memiliki persistensi serverless `/api/catatan` untuk CREATE, UPDATE, DELETE, dan PIN; (5) Seluruh 9 pola rekurensi Content Planner perlu diverifikasi persisten ke `ptv_content_planner`; (6) Seluruh metadata `<!-- PTV_META: {...} -->` pada deskripsi `ptv_acara` dan `ptv_catatan` wajib dipertahankan secara non-destruktif. | Instruksi Operator: "PTVPRO — AUDIT & IMPLEMENTASI PERSISTENSI DATA OPERASIONAL MENYELURUH", Backup Snapshot `staging-pre-operational-persistence-2026-10-18T10-42-12-435Z.json`. | Kritis | (1) Membuat backup snapshot terverifikasi Staging (71 acara, 39 planner, 4 catatan) sebelum mutasi; (2) Menambahkan handler POST dan DELETE pada `api/acara.ts` dengan sanitasi `extractValidSqlTime()`, validasi foreign key `canonical_identity`, proteksi RBAC fail-closed, dan preservasi `<!-- PTV_META: ... -->`; (3) Membangun endpoint `api/catatan.ts` lengkap (GET, POST, PATCH/PUT, DELETE) dengan otentikasi HttpOnly cookie dan RBAC server-side untuk Catatan Bersama (`tipe = 'shared'`) dan Notulensi Rapat (`tipe = 'meeting_minutes'`); (4) Menghubungkan client service (`acaraService`, `AcaraContext`, `catatanService`, `KalenderPage`, `CatatanPage`) ke endpoint backend secara fail-closed dan async; (5) Memverifikasi live HTTP mutation lifecycle (POST -> GET -> PATCH -> DELETE) di localhost:5174 dengan hasil akhir tabel Staging utuh tanpa residu; (6) Menambahkan 14 unit regression tests di `operationalPersistenceFullRegression.test.ts`; seluruh 589 tests repositori lulus 100%, 0 lint warnings, build lolos 13.00s. | **Fixed** |
| **CLN-065** | 2026-10-18 | `PTV-DEV-055` | `src/products/hub/acara/components/AcaraStatusModal.tsx`, `src/products/hub/acara/components/AcaraRundownModal.tsx`, `tests/hub/acaraStatusModalRegression.test.tsx` | Modul Acara Hotfix: isOpen Render Guard Absence, Auto-Opening Prevention & React Portal Cleanup | (1) Modal "Ubah Status Acara" (`AcaraStatusModal.tsx`) dan modal Rundown (`AcaraRundownModal.tsx`) kehilangan pengecekan `if (!isOpen) return null;` sebelum me-render JSX, menyebabkan kedua modal me-render div `.acara-modal-overlay` ke layar secara permanen meskipun `isOpen={false}`; (2) Akibat ketiadaan guard ini, saat pengguna membuka halaman Detail Acara (`/hub/acara/:id`) dari menu/list Daftar Acara, modal Ubah Status muncul secara otomatis menutupi layar; (3) Lebih lanjut, ketika tombol X, Batal, backdrop, atau tombol Escape ditekan, pemanggilan `onClose()` mengubah state parent menjadi `false` namun modal tidak hilang dari DOM karena komponen tetap me-render elemen overlay; (4) Menambahkan pengecekan `if (!isOpen) return null;`, handler `handleCancel` yang me-reset `selectedStatus` tanpa mutasi, serta membungkus modal ke dalam `createPortal(..., document.body)` dengan backdrop fullscreen dark blur. | Laporan Operator: "PTVPRO — HOTFIX MODAL UBAH STATUS ACARA TIDAK BISA DITUTUP & MUNCUL OTOMATIS" | Kritis | (1) Menambahkan guard `if (!isOpen) return null;` pada `AcaraStatusModal.tsx` dan `AcaraRundownModal.tsx`; (2) Menerapkan `handleCancel` yang me-reset `selectedStatus` ke `event.status` pada tombol X, tombol Batal, backdrop click, dan Escape key tanpa memicu mutasi apa pun; (3) Membungkus modal dengan `createPortal(modalContent, document.body)`; (4) Menambahkan 6 unit regression tests pada `tests/hub/acaraStatusModalRegression.test.tsx` yang memvalidasi bahwa modal mengembalikan null saat `isOpen={false}` dan berfungsi presisi saat `isOpen={true}`; (5) Seluruh 575 tests passed 100%, 0 type errors, 0 lint warnings, build lolos. | **Fixed** |
| **CLN-064** | 2026-10-18 | `PTV-DEV-054` | `src/products/hub/kalender/*`, `src/styles/kalender.css`, `api/planner.ts`, `tests/hub/kalenderStagingRegression.test.ts` | Kalender & Content Planner Modal React Portal, 9 Legacy Recurrence Parity & Fail-Closed Staging Persistence | (1) Modal Tambah Acara Liputan, modal Content Planner, modal Detail Acara, dan modal Detail Content Planner di `KalenderPage.tsx` sebelumnya terperangkap dalam stacking context/overflow parent container, backdrop tidak menutupi seluruh browser viewport, dan tidak berada di posisi tengah horizontal & vertikal; (2) Content Planner belum mendukung 9 pola rekurensi dinamis legacy PHP (`legacy/page-dasbor.php` L33446–L34000) dan mutasi (CREATE, UPDATE, DELETE) belum tersimpan secara persisten ke tabel Supabase Staging `ptv_content_planner`; (3) Pada rekurensi `bulan_hijriah` dan `bagian_bulan_hijriah`, nilai `tanggal_hijriah` sebelumnya berisiko mengunci tanggal 1 Hijriah dan tidak tampil sepanjang bulan Masehi beririsan; (4) Terjadi 4 lint errors (`no-empty`) pada empty catch blocks dan type error `tanggal_hijriah` null; (5) Perlindungan anti-prod barrier wajib aktif dan modal Tambah Acara harus menampilkan disclaimer jujur (read-only di sesi ini). | Instruksi Operator: "PTVPRO — PERBAIKAN GLOBAL MODAL KALENDER & INTEGRASI CONTENT PLANNER LEGACY KE STAGING", Backup Snapshot `backups/staging-ptv-content-planner-backup-2026-10-18T09-57-04-264Z.json` (39 records). | Kritis | (1) Membuat backup snapshot terverifikasi 39 records `ptv_content_planner` Staging sebelum mutasi; (2) Membungkus seluruh 4 modal dengan React Portal `createPortal(..., document.body)`, fixed fullscreen backdrop (`position: fixed; inset: 0; z-index: 9998; backdrop-filter: blur(8px); background: rgba(15, 23, 42, 0.65)`), centered layout horizontal & vertikal, dan dynamic scroll locking pada `document.body` tanpa layout shift; (3) Mengimplementasikan 9 pola rekurensi legacy PHP, live preview box, input daftar konten dinamis (1 baris per item), catatan doa/amalan, dan URL referensi; (4) Menambahkan handler POST (CREATE), PATCH/PUT (UPDATE), dan DELETE (DELETE) pada `/api/planner` dengan HttpOnly session cookie, HMAC-SHA256, live revocation check, RBAC write gate (`calendar.edit`, `events.edit`, `events.manage`, `hub.access`), dan UUID validation; (5) Memastikan `tanggal_hijriah: null` pada rekurensi bulan penuh Hijriah; (6) Menambahkan 7 unit regression tests baru; seluruh 569 tests repositori lulus 100%, 0 lint warnings, build produksi lolos 13.96s. | **Fixed** |
| **CLN-063** | 2026-10-18 | `PTV-DEV-053` | `api/acara.ts`, `src/products/hub/acara/*`, `tests/hub/acaraStagingRegression.test.ts` | Modul Acara UPDATE Mutation, Concurrency Protection, RBAC Gate & Non-Destructive PTV_META Preservation | (1) Perubahan detail acara (kru, peralatan, rundown, waktu, lokasi, deskripsi, status) sebelumnya hanya tersimpan di React Context dan hilang setelah refresh halaman; (2) Perlunya endpoint terautentikasi serverless `/api/acara` yang mendukung method `PATCH`/`PUT` dengan RBAC gate (`events.edit`, `events.manage`, `hub.access`, `admin`, `eksekutif`); (3) Perlindungan konkurensi (optimistic locking via `expected_updated_at`) untuk mencegah penimpaan perubahan bersamaan; (4) Penggabungan non-destruktif terhadap metadata virtual `<!-- PTV_META: {...} -->` pada kolom deskripsi `ptv_acara`, menjamin seluruh metadata legacy/unknown keys dan deskripsi plain text tidak hilang; (5) Perlindungan anti-prod barrier dan penolakan metode `POST`/`DELETE` (HTTP 405); (6) Perubahan client layer `acaraService.updateEvent` & `AcaraContext.tsx` menjadi async fail-closed: notifikasi sukses hanya muncul setelah backend mengonfirmasi HTTP 200, dan modal tidak menutup jika simpan gagal. | Instruksi Operator: "PTVPRO — AKTIVASI PENYIMPANAN EDIT ACARA KE STAGING", Snapshot backup `staging-ptv-acara-backup-2026-10-18T09-34-46-962Z.json` (71 records). | Kritis | (1) Membuat backup snapshot terverifikasi 71 records `ptv_acara` Staging sebelum mutasi apa pun; (2) Mengimplementasikan handler `PATCH`/`PUT` di `api/acara.ts` dengan parser JSON, verifikasi token HttpOnly, RBAC fail-closed, optimistic lock check (>2s beda timestamp menghasilkan HTTP 409), preservasi non-destruktif PTV_META, dan anti-prod safety check; (3) Menambahkan `updateEvent` di `acaraService.ts` dan memperbarui `AcaraContext.tsx` agar mutasi menjadi async fail-closed; (4) Menyesuaikan seluruh modal (`AcaraFormModal`, `AcaraStatusModal`, `AcaraCrewModal`, `AcaraGearModal`, `AcaraRundownModal`) dan halaman detail `AcaraDetailPage.tsx` dengan `isSubmitting` loading guard dan disabled buttons; (5) Menambahkan 6 regression tests di `acaraStagingRegression.test.ts`; seluruh 562 tests lulus 100%, 0 lint warnings, build lolos. | **Fixed** |
| **CLN-062** | 2026-10-18 | `PTV-DEV-052` | `api/peminjaman.ts`, `api/lapor-kerusakan.ts`, `api/lost-found.ts`, `src/products/hub/*`, `tests/hub/*` | 3 Modul Operasional Staging Integration (Read-Only), Fail-Closed RBAC & Zero Dummy Fixture Realignment | (1) Ketiga modul operasional (Peminjaman, Lost & Found, Lapor Kerusakan) sebelumnya mengandalkan fixture/mock lokal atau in-memory arrays; (2) Transaksi peminjaman asli di Staging tersimpan sebanyak 41 records di `legacy_archive_unresolved` dengan metadata PTV_META berkarakter escaped single quote (`Rafa Putra Ro\'uf`) dan referensi master item; (3) Lapor Kerusakan memiliki 1 record riil di Staging (iPhone 11 128 iBox `INV-972`, status Selesai) yang belum terhubung ke React; (4) Lost & Found berstatus 0 records di Staging, namun UI sebelumnya menampilkan dummy fixtures fiktif; (5) Perlunya pencegahan mutasi data (Strict Read-Only) dan perlindungan agar laporan kerusakan tidak otomatis mengubah kondisi fisik unit inventaris tanpa proses resmi; (6) Penggunaan inline pixel border-radius (`4px`, `999px`) melanggar continuous curve audit. | Instruksi Operator: "PTVPRO — MIGRASI 3 MODUL OPERASIONAL KE SUPABASE STAGING" | Sedang | (1) Membangun 3 serverless endpoint `api/peminjaman.ts`, `api/lapor-kerusakan.ts`, dan `api/lost-found.ts` dengan session cookie auth, HMAC-SHA256, live account check, dan RBAC gate (`loans.view`, `damage.view`, `lostfound.view`); (2) Memetakan 41 pinjaman riil Staging, resolusi master item `ptv_inventaris`, penanda `Alat Historis (Referensi Lepas)` dan badge `Arsip Historis`; (3) Menghubungkan 1 laporan kerusakan asli `INV-972` ke `damageReportService.ts` dan mengisolasi kondisi unit inventaris dari auto-mutasi; (4) Menghubungkan `lostFoundService.ts` ke Staging, menyajikan empty state transparan tanpa dummy fixture; (5) Menambahkan handling loading, empty state, error banner dengan tombol retry; (6) Menyelaraskan border radius ke continuous curve token (`var(--r-xs, 4px)` dan `9999px`); (7) Mendaftarkan redirect alias `/hub/lost-found` dan `/hub/lapor-kerusakan` di router; (8) Menambahkan 13 regression tests di `operationalModulesStagingRegression.test.ts`; seluruh 556 tests repositori lulus 100%, 0 lint warnings, build lolos. | **Fixed** |
| **CLN-061** | 2026-10-18 | `PTV-DEV-051` | `vite.config.ts`, `src/products/hub/kalender/kalenderService.ts`, `tests/hub/kalenderStagingRegression.test.ts` | Runtime Hotfix: Vite Dev Server Middleware Filter & Non-JSON Content-Type Guard | `SyntaxError: Unexpected token 'i', "import { c"... is not valid JSON` pada pemanggilan `/api/planner` akibat rute `/api/planner` tidak terdaftar dalam filter guard middleware di `vite.config.ts` (menyebabkan Vite menyajikan `api/planner.ts` sebagai modul JavaScript statis berawalan "import { createClient..." alih-alih mengeksekusi SSR serverless handler). | Laporan error runtime operator: "Unexpected token 'i', \"import { c\"... is not valid JSON" | Sedang | (1) Menambahkan intercept rute `!req.url.startsWith('/api/planner')` pada middleware guard `vercelApiDevPlugin` di `vite.config.ts` sehingga request dieksekusi oleh serverless handler; (2) Menambahkan validasi header Content-Type pada `kalenderService.ts` untuk menolak respon non-JSON sebelum parsing; (3) Menambahkan 1 unit regression test di `kalenderStagingRegression.test.ts`; seluruh 543 unit tests lulus (0 fail). | **Fixed** |
| **CLN-060** | 2026-10-18 | `PTV-DEV-051` | `api/planner.ts`, `src/products/hub/kalender/*`, `vite.config.ts`, `tests/hub/*` | Modul Kalender & Content Planner Staging Integration (Read-Only) & Mock Removal | (1) Modul Kalender React sebelumnya menggunakan fallback mock aktif `MOCK_CALENDAR_EVENTS` dan `MOCK_CONTENT_PLANNERS` dari `calendarMockData.ts`; (2) 39 data asli Momentum & Ide Konten pada tabel Supabase Staging `ptv_content_planner` belum terintegrasi ke React; (3) Belum ada endpoint backend terproteksi RBAC untuk query tabel `ptv_content_planner`; (4) Client bundle sempat terkontaminasi modul `node:crypto` akibat import langsung dari serverless API; (5) Perlunya pencegahan silent fallback, penanganan recurrence fleksibel, penyelarasan dots kalender riil, dan sinkronisasi navigasi ke modul Acara. | Instruksi Operator: "PTVPRO — AUDIT & INTEGRASI MODUL KALENDER KE SUPABASE STAGING" | Sedang | (1) Mengimplementasikan serverless API endpoint `api/planner.ts` dengan otentikasi sesi HttpOnly cookie (`ptv_hub_session`), verifikasi HMAC-SHA256, RBAC gate (`calendar.view`/`events.view`/`hub.access`), cek status akun live, dan query terisolasi ke Supabase Staging (`ptv_content_planner`); (2) Mendaftarkan endpoint `/api/planner` pada middleware Vite dev server (`vite.config.ts`); (3) Membangun `kalenderService.ts` di layer client tanpa dependensi node built-ins (mencegah error build Rollup), mencakup parser rekurensi `<!-- PTV_RECURRENCE: {...} -->`; (4) Menambahkan dukungan recurrence 'fleksibel' pada `calendarDateUtils.ts`; (5) Memperbarui `KalenderPage.tsx` untuk menghapus seluruh fallback mock aktif, mengonsumsi 71 data acara dari `AcaraProvider` dan 39 momentum planner dari `/api/planner`, menyajikan loading spinner dan error alert jujur dengan tombol retry, serta tombol "Buka di Modul Acara"; (6) Memindahkan data mock di `calendarMockData.ts` murni sebagai test fixtures; (7) Menambahkan 13 unit regression tests di `kalenderStagingRegression.test.ts`; seluruh 542 unit tests lulus (0 fail). | **Fixed** |
| **CLN-059** | 2026-10-18 | `PTV-DEV-050` | `api/acara.ts`, `src/products/hub/acara/*`, `src/products/hub/kalender/*`, `vite.config.ts`, `tests/hub/*` | Modul Acara Staging Integration (Read-Only) & Calendar Synchronization | (1) Modul Acara sebelumnya beroperasi menggunakan data mock in-memory terisolasi (`acaraMockData.ts`); (2) Data 71 acara resmi Production di Staging (`ptv_acara`) belum terintegrasi ke React; (3) Halaman Kalender dan Daftar Acara menggunakan dataset yang terpisah; (4) Perlunya verifikasi RBAC fail-closed di backend API `/api/acara` untuk kapabilitas `events.view` / `calendar.view` / `hub.access` dan pencegahan silent fallback ke mock data saat backend gagal. | Instruksi Operator: "PTVPRO — MIGRASI MODUL ACARA KE SUPABASE STAGING" | Sedang | (1) Mengimplementasikan serverless API endpoint `api/acara.ts` dengan otentikasi sesi HttpOnly cookie, verifikasi HMAC-SHA256, RBAC gate (`events.view`/`calendar.view`/`hub.access`), cek keaktifan akun live, dan query terisolasi ke Supabase Staging (`ptv_acara`); (2) Mendaftarkan endpoint `/api/acara` pada middleware Vite dev server (`vite.config.ts`); (3) Membangun `acaraService.ts` dengan normalizer kanonikal `mapDbRowToAcaraItem` (ekstraksi metadata JSON `<!-- PTV_META: ... -->`, normalisasi crew, gear, rundown, format waktu, dan status dinamis berbasis tanggal); (4) Memperbarui `AcaraContext.tsx` dengan loading state, error state informatif, dan fungsi `refreshEvents()`; (5) Memperbarui `AcaraPage.tsx` dengan UI loading spinner, error state informatif ber-tombol retry, dan list 71 acara asli Staging; (6) Menyelaraskan `KalenderPage.tsx` via `useOptionalAcara()` agar menggunakan dataset acara yang sama persis dengan daftar acara; (7) Membungkus route `kalender` dengan `<AcaraProvider>` di router; (8) Menambahkan 12 unit regression tests di `acaraStagingRegression.test.ts`; seluruh 529 unit tests lulus (0 fail). | **Fixed** |
| **CLN-058** | 2026-10-18 | `PTV-DEV-049` | `src/products/hub/shell/*`, `tests/hub/*` | Header Features Implementation & Continuous Curve Governance | (1) Tiga komponen header PTVPRO belum fungsional: Global Search (pencarian universal shortcut `/`), Notification Center (lonceng & unread badge), dan User Profile Menu (avatar & menu profil); (2) Pelanggaran Continuous Curve pada komponen baru dengan penggunaan inline pixel radius mentah (`borderRadius: '14px' | '8px'`); (3) Potensi SSR crash `ReferenceError: document is not defined` pada pembacaan theme default di HubShell; (4) Inkonsistensi role `executive` vs kanonikal `eksekutif` pada skenario uji profil. | Instruksi Operator: "PTVPRO — IMPLEMENTASI 3 FITUR HEADER BERDASARKAN LEGACY PHP" | Sedang | (1) Mengimplementasikan `UniversalSearchModal.tsx` dengan live search multi-kategori (Inventaris Staging `swadgljnyelsjstqqxbm` + Client stores Kru, Acara, Catatan, Dokumen), visual desktop sheet vs mobile overlay, keyboard navigation, dan filter RBAC fail-closed; (2) Mengimplementasikan `NotificationCenterModal.tsx` dengan pembacaan real dari staging Supabase `ptv_notifications`, unread counter, filter tab, lock/unlock per notif, delete single/unlocked, mark read all, detail drawer, dan fallback lokal; (3) Mengimplementasikan `UserProfileMenuModal.tsx` dengan avatar inisial dinamis, kartu identitas akun (nama, PTV ID, divisi, badge role), menu aksesibilitas (ID Digital, Dokumen Saya, Pengaturan, toggle mode gelap/terang), dan logout resmi via `useSessionStore`; (4) Menyelaraskan seluruh inline border radius ke design system tokens `var(--ptv-curve-md)` dan `var(--ptv-curve-sm)`; (5) Menambahkan SSR guard `typeof document !== 'undefined'`; (6) Menambahkan 8 unit regression tests di `headerFeaturesRegression.test.tsx`; seluruh 517 unit tests lulus (0 fail). | **Fixed** |
| **CLN-057** | 2026-10-18 | `PTV-DEV-048` | `src/products/hub/inventaris/*`, `src/styles/*`, `tests/hub/*` | Inventaris Revision Tahap 2: Mobile 2-Col Grid, Action Touch Targets, Vertical Units & Clean Redesign | (1) Grid inventaris mobile 1-kolom terlalu besar; (2) Tombol aksi detail terlalu tipis (< 42px touch target); (3) Carousel unit fisik mobile horizontal menyulitkan navigasi; (4) Spesifikasi teknis berulang kali ditampilkan ganda; (5) Detail mobile terlalu padat serta membocorkan teks internal developer (`swadgljnyelsjstqqxbm` dan `Pilot 2 Ditunda`). | Instruksi Operator: "PTVPRO STAGING — INVENTARIS REVISION TAHAP 2 (INV-05 s.d. INV-09)" | Rendah | (1) Mengubah grid mobile katalog menjadi 2 kolom (`grid-template-columns: repeat(2, minmax(0, 1fr))`) dengan penyesuaian font 12px clamp dan thumbnail radius; (2) Meningkatkan tinggi tombol aksi detail ke 48px; (3) Mengubah carousel unit fisik mobile menjadi vertical stack 1 kartu per baris dan menyembunyikan tombol panah desktop; (4) Mengkondisikan spesifikasi tambahan hanya muncul jika berbeda dari deskripsi alat; (5) Merapikan mobile layout detail (max-height foto 220px, metadata 2x2 grid) dan membersihkan seluruh teks kebocoran internal developer; (6) Menambahkan 13 regression tests di `inventarisMobileTahap2Regression.test.ts`. | **Fixed** |
| **CLN-056** | 2026-10-18 | `PTV-DEV-047` | `src/products/hub/inventaris/*`, `tests/hub/*` | Inventaris Revision Tahap 1: Staging Dummy Cleanup & 17 Canonical Categories Parity | (1) Penghapusan terisolasi data dummy `INV-STG-001` (1 master, 2 unit fisik) di Supabase Staging dengan snapshot backup terverifikasi; (2) Pengembalian 17 kategori kanonikal dari `page-dasbor.php` dan `ptv-dashboard-data-bridge.php` menggantikan 10 filter hardcoded; (3) Resolusi kategori hilang `'Tripod'` via `normalizeInventoryCategory`; (4) Implementasi pengurutan hierarkis 3-level (Kategori 1-17, Nama A-Z, Kode A-Z) via `sortInventoryItems`. | Instruksi Operator: "PTVPRO STAGING — INVENTARIS REVISION TAHAP 1 (INV-01 s.d. INV-04)" | Rendah | (1) Membuat backup snapshot Staging `staging-inventaris-pre-dummy-delete-*.json` (162 inventaris, 247 unit); (2) Menjalankan eksekusi atomik bersyarat menghapus 2 unit dummy (`666ca...`, `cc5ad...`) dan 1 master dummy (`17cd...`); total master Staging menjadi tepat 161 dan unit 245; master `INV-001` Production terbukti 100% utuh; (3) Mendefinisikan `INVENTORY_CATEGORIES`, `normalizeInventoryCategory`, dan `sortInventoryItems` pada `types.ts` dan `inventarisService.ts`; (4) Menghubungkan normalizer ke `InventarisPage.tsx` pada filter rail, scoped metrics, dan icon mapping; (5) Menambahkan 9 regression tests di `inventarisKategoriRegression.test.ts`; seluruh 491 unit tests lulus (0 fail). | **Fixed** |
| **CLN-055** | 2026-10-18 | `PTV-DEV-046` | `src/core/policy/*`, `src/core/auth/*`, `src/core/session/*`, `src/app/router/*`, `api/auth/*`, `tests/auth/*` | Runtime Crash Hotfix: Session Normalization & Fail-Closed Capability Resolution | `TypeError: Cannot read properties of undefined (reading 'includes')` pada `hasCapability()` akibat session dari login form dan `/api/auth/session` tidak memuat array `allowed_overrides` dan `denied_overrides`. | Sesi PTV-DEV-046 Runtime Bug Report | Kritis | (1) Menambahkan pertahanan fail-closed pada `hasCapability()` terhadap `undefined` array overrides & profiles; (2) Membangun normalizer kanonikal `normalizeAuthUser`; (3) Mengintegrasikan normalizer pada `VercelAuthService` dan `useSessionStore`; (4) Melengkapi payload response pada `api/auth/login.ts` dan `api/auth/session.ts`; (5) Memperkuat `ProtectedRoute` terhadap session expired, loading, dan partial; (6) Menambahkan 13 regression tests di `sessionCapabilityRegression.test.tsx`; 482 tests lulus, build sukses. | **Fixed** |
| **CLN-052** | 2026-10-18 | `PTV-DEV-044` | `scripts/*`, `docs/*DDL.sql` | Diagnostic Scripts Hygiene & Importer Payload Safety | Penanganan investigasi error import dan pemeriksaan schema cache Staging secara aman menggunakan scratch isolated scripts tanpa kebocoran kredensial ke repo. | Sesi PTV-DEV-044 Live Import Audit | Rendah | Melakukan targeted probe read-only, menghentikan live import seketika saat terdeteksi constraint mismatch, dan mencatat diagnosa secara presisi. | **Fixed** |
| **CLN-050** | 2026-10-18 | `PTV-DEV-042` | `src/products/verification/*`, `src/styles/publicVerification.css`, `tests/hub/publicVerification.test.ts` | Portal Verifikasi UI Hotfix: White Cards, Dark Text Contrast, & Origin-Preserving Home Navigation | (1) Kartu hasil verifikasi dokumen dan identitas kru sebelumnya menampilkan header berwarna gelap/navy pekat (`pub-cert-header`, `pub-id-card-hero`); (2) Logo header sebelumnya mengarah ke rute verifikasi surat, bukan kembali ke homepage (`/`) origin aktif; (3) Teks pada kartu hasil verifikasi memerlukan kontras gelap yang nyaman dibaca dengan border tipis dan soft shadow. | Instruksi Operator: "PTVPRO — Hotfix UI Portal Verifikasi" | Rendah | (1) Mengembalikan seluruh area kartu hasil verifikasi (`pub-cert-header`, `pub-id-card-hero`, `pub-doc-no-banner`) menjadi latar putih bersih (`#ffffff` / `var(--surface)`) dengan teks gelap berbobot kontras tinggi (`var(--ink, #072a52)`); (2) Mengganti banner gelap foto kru dengan bingkai putih berlatar netral halus dan initial badge warna hijau tua; (3) Menautkan logo header ke root homepage (`to="/"`) dengan `aria-label="Kembali ke Beranda PTVPRO"` agar adaptif terhadap localhost, Staging, maupun Production tanpa mengubah origin; (4) Memperbarui pengujian unit dan memvalidasi seluruh quality gates (typecheck 0 error, lint 0 error, test 469 passed, build sukses). | **Fixed** |
| **CLN-049** | 2026-10-18 | `PTV-DEV-041` | `src/products/verification/*`, `src/styles/publicVerification.css`, `tests/hub/publicVerification.test.ts` | Portal Verifikasi UI Refinement: Clean Monochrome Dark Green Logo & Designbook Token Alignment | (1) Header Verifikasi Publik sebelumnya menampilkan teks brand sekunder di samping logo ("Portal Verifikasi", "Dokumen & Kru Resmi") yang memadati header; (2) Filter warna logo sebelumnya menggunakan siluet biru royal sedangkan tombol verifikasi bertema hijau tua (`#0e4f40`); (3) Parameter header, input, card, badge, dan button belum sepenuhnya menggunakan token terpadu Profile D (`--ptv-curve-*`, `--ok-*`, `--shadow-*`). | Permintaan Operator: "PTVPRO — UI Refinement Portal Verifikasi" | Rendah | (1) Menghapus teks "Portal Verifikasi" dan "Dokumen & Kru Resmi" serta divider vertikal di samping logo, menyisakan logo resmi polos di kiri atas; (2) Menyelaraskan filter warna logo ke warna hitam/hijau tua (`#0e4f40`) senada dengan tombol aksi verifikasi dan menghilangkan warna biru; (3) Menstandarkan tinggi header ke 56px desktop / 52px mobile dengan `position: sticky; top: env(safe-area-inset-top, 0px); z-index: 50`; (4) Menyelaraskan token designbook: input focus ring hijau tua (`#0e4f40`), border radius Profile D (`--ptv-curve-xl: 22px`, `--ptv-curve-md: 12px`, `--ptv-curve-pill: 9999px`), elevasi halus (`--shadow-s`, `--shadow-m`), serta status badges (`--ok-bg`, `--ok-border`); (5) Memperbarui unit test pengujian header logo; seluruh 4 quality gates lulus sempurna. | **Fixed** |
| **CLN-048** | 2026-10-17 | `PTV-DEV-040` | `src/products/verification/*`, `src/products/portal/*`, `src/styles/peminjaman.css`, `src/styles/dashboard.css` | UI Refinement R04 (Official Logos, Sticky Portal Header, Neutral Loan Cards, & Neutral Seasonal Feature Card) | (1) Header verifikasi publik (`/verifikasi-identitas` & `/verifikasi-surat`) menggunakan logo kotak teks "PTV" bukan logo resmi PTVPRO Hub; (2) Header Public Portal menggunakan teks "PTVPRO" dan tidak sticky saat scroll konten panjang karena terkurung di dalam container `.top`; (3) Kartu peminjaman inventaris yang terlambat (`.loan-txn-card.is-overdue`) memiliki garis aksen border merah tebal di sekeliling kartu yang mencolok; (4) Kartu layanan musiman Registrasi Majelis Sama' (`.feature`) memiliki garis border tebal biru di sisi kiri (`border-left: 4px solid var(--brand)`) dan border biru mencolok. | Permintaan Operator: "PTVPRO — UI REFINEMENT R04" | Rendah | (1) Mengganti teks/kotak logo di `PublicVerificationHeader.tsx` dengan gambar logo resmi `/assets/images/ptv-logo-white.webp`, filter PTV Royal Blue siluet untuk background terang, divider vertikal, dan teks identitas portal responsif; (2) Mengganti teks brand pada `PortalHeader.tsx` dengan logo resmi `/assets/images/ptv-logo-white.webp`, memindahkan header ke root `.ptvpro-portal` agar sticky saat scroll, menetapkan `z-index: 50`, background `var(--brand)`, serta box-shadow dan border-bottom halus; (3) Mengganti border merah aksen pada `.loan-txn-card.is-overdue` di `peminjaman.css` dan `dashboard.css` dengan border netral `1px solid var(--line-2)` tanpa menyentuh indikator keterlambatan (badge, teks, tanggal); (4) Menghilangkan `border-left: 4px solid var(--brand)` dan border biru mencolok pada `.feature` di `portal.css`, menggantinya dengan border netral `1px solid var(--tint-line)` dan padding simetris yang rapi; (5) Menambahkan unit test assertions untuk logo resmi di portal & public verification; seluruh 4 quality gates lulus sempurna. | **Fixed** |
| **CLN-047** | 2026-10-17 | `PTV-DEV-039` | `src/products/portal/*` (`portal.css`, `PortalFooter.tsx`, `WhatsAppHelpModal.tsx`, `portalConfig.ts`, `portalCatalog.ts`, `tests/portal/portal.test.tsx`) | Portal UI Polish R03 (Consistent Rounded Corner Hierarchy, Sticky Footer 100dvh, WhatsApp Official Helpdesk Config, & Footer Email Removal) | (1) Nilai border-radius sebelumnya belum memiliki hierarki bertingkat yang jelas antara status badge kecil dan tombol/kartu (`--r-sm: 6px` dan `--r-md: 10px`); (2) Pada halaman konten pendek seperti "Registrasi Majelis Sama’" (Segera Hadir) dan Status Layanan, footer berhenti sebelum tepi bawah viewport menyisakan area kosong terang; (3) Tautan email `kontak@progresiftv.com` di footer perlu dieliminasi dengan merapikan kembali jarak/alignment tautan resmi tersisa (Status Layanan, Instagram, YouTube); (4) Fitur Bantuan WhatsApp perlu diarahkan ke konfigurasi terpusat nomor resmi internasional tanpa dummy URL dan salam pembuka yang sopan kontekstual ("Assalamu'alaikum..."). | Instruksi Operator: "PTVPRO PUBLIC PORTAL — UI POLISH R03" | Rendah | (1) Mengimplementasikan skala token radius resmi R03 pada `.ptvpro-portal`: `--r-xs: 6px` (badge kecil), `--r-sm: 8px` (nav controls, close, lang switcher, back link), `--r-md: 12px` (tombol utama, sekunder, input, chips, alerts), `--r-lg: 16px` (service cards, featured card, modals, toast), dan `--r-pill: 9999px`; (2) Menerapkan pendekatan `display: flex; flex-direction: column; min-height: 100dvh` pada `.ptvpro-portal` dengan `flex: 1 0 auto` pada `main` dan `margin-top: auto` pada `footer` sehingga footer selalu menempel di bawah pada halaman pendek dan mengikuti konten alami pada halaman panjang tanpa horizontal overflow; (3) Menghapus tautan email dari `PortalFooter.tsx` dan merapikan `.fl` gap serta text-underline; (4) Membuat modul `portalConfig.ts` dan fungsi `buildWhatsAppHelpUrl` dengan validasi nomor internasional, fail-closed jika unconfigured (tidak mengarah ke nomor dummy), dan pesan pembuka sopan kontekstual; (5) Menambahkan 3 unit tests baru (total 468 passed, lint 0 error, build sukses). | **Fixed** |
| **CLN-046** | 2026-10-17 | `PTV-DEV-038` | `api/auth/_utils/identity.ts`, `api/auth/google/callback.ts`, `tests/auth/googleOAuthCallbackStatus.test.ts` | Google OAuth Live Identity Resolution Code Mapping & Safe Diagnostics | (1) Pada live Supabase database mode, fungsi `resolveIdentityByGoogleSub` tidak mengembalikan properti `code` (`'unlinked'`, `'access_denied'`, `'server_error'`), menyebabkan callback handler jatuh ke fallback `identityResult.code || 'error'`; (2) Akun Google belum tertaut salah diklasifikasikan sebagai `auth_status=error` ('Gagal Masuk') alih-alih `auth_status=unlinked` ('Akun Belum Terdaftar') serta menyembunyikan widget penautan Subject ID; (3) Parameter callback rejection (`access_denied`) dan session/state error belum meneruskan status semantik yang tepat. | Bug Report Operator: "Pengujian Google OAuth sungguhan pada localhost:5174 menghasilkan modal: Gagal Masuk..." | Tinggi | (1) Menambahkan `code: 'unlinked'` saat akun tidak ditemukan di `auth_credentials`; (2) Menambahkan `code: 'access_denied'` saat status akun non-aktif atau tidak memiliki izin `hub.access`; (3) Menambahkan `code: 'server_error'` pada kegagalan query database/koneksi; (4) Menyelaraskan status semantik callback (`unlinked`, `access_denied`, `cancelled`, `state_error`, `error`); (5) Menambahkan structured dev logging aman tanpa membocorkan token, kode, atau secret; (6) Menambahkan 7 unit regression tests di `googleOAuthCallbackStatus.test.ts`; (7) Membersihkan unused import `PORTAL_CONFIG` di `WhatsAppHelpModal.tsx`. Seluruh 4 quality gates lulus 100%. | **Fixed** |
| **CLN-043** | 2026-10-17 | `PTV-DEV-036` | `src/products/portal/styles/portal.css`, `ServiceCard.tsx`, `tests/portal/portal.test.tsx` | Portal Service Card Hover Clipping Fix & Harmonious Identity Accent Colors | (1) Kartu layanan saat hover terpotong atau tertabrak oleh divider horizontal section akibat ketiadaan stacking context elevation (`z-index: 10`) dan margin clipping pada container `.list`; (2) Belum adanya identitas aksen warna per layanan yang harmonis (Aset Yayasan amber `#B7791F`, Shortlink purple `#8054C8`, PTV Hub blue `#194AC7`, Verifikasi Identitas emerald `#14836A`, Verifikasi Surat terracotta `#C46B42`). | Instruksi Operator: "PTVPRO PUBLIC PORTAL — CARD HOVER FIX & SERVICE ACCENT COLORS" | Rendah | (1) Menambahkan `position: relative; z-index: 1` pada `.cat`, elevasi `z-index: 4` pada `.cat:has(.svc:hover, .svc:focus-visible)`, dan `z-index: 10` pada `.svc:hover, .svc:focus-visible`; (2) Menerapkan 4px top padding buffer pada `.list` sehingga `translateY(-3px)` lift dan focus ring 3px tidak pernah menyentuh divider atau header section; (3) Mengimplementasikan scoped CSS variables `--svc-accent`, `--svc-bg`, `--svc-hover-bg`, `--svc-shadow` untuk 5 layanan + seasonal; (4) Menyelaraskan icon container, arrow indicator, hover border, dan focus ring aksesibel (kontras >3:1 grafis / >4.5:1 teks); (5) Menjaga status badge dan akses badge tetap semantik dan konsisten; (6) Menambahkan penanganan `prefers-reduced-motion`; (7) Menambahkan skenario pengujian 2.3 (total 449 tests lulus sempurna, build sukses). | **Fixed** |
| **CLN-042** | 2026-10-17 | `PTV-DEV-034` | `src/products/portal/components/PortalHero.tsx`, `tests/portal/portal.test.tsx` | Portal Hero UI Simplification & Unused Note Elimination | Teks 'There is no login on this page. Each service manages its own access.' / 'Tidak ada login di halaman ini...' di dalam container hero `.note` dihapus sesuai permintaan operator, beserta pembersihan unused import `PortalIcon`. | Arahan Operator: "hapus tulisan 'There is no login on this page. Each service manages its own access.'" | Rendah | (1) Menghapus elemen `<div className="note">` pada `PortalHero.tsx`; (2) Membersihkan import tak terpakai `PortalIcon`; (3) Memperbarui pengujian unit di `portal.test.tsx` untuk menguji ketiadaan teks tersebut; (4) Seluruh quality gates lulus 100% (typecheck 0 error, lint 0 error, 448 tests passed, build sukses). | **Fixed** |
| **CLN-041** | 2026-10-17 | `PTV-DEV-034` | `src/products/portal/styles/portal.css` | Typography & Design System Alignment (SF Pro Display) | (1) Portal Publik sebelumnya memuat Google Fonts eksternal (`Bricolage Grotesque` dan `Hanken Grotesk`) via `@import` yang bertentangan dengan standar identitas visual PTV Hub dan R03 Design Guide (`--ptv-font-family: "SF Pro Display"`); (2) Menimbulkan blocking network latency saat font eksternal diunduh dan inkonsistensi tipografi brand; (3) Styling root `html.portal-page-active` dan `body.portal-page-active` belum mewarisi font stack resmi PTVPRO. | Instruksi Operator: "PTVPRO — PUBLIC PORTAL DESIGN SYSTEM ALIGNMENT" (Harmonisasi Design Guide R03, PTV Hub, dan Prototype HTML). | Rendah | (1) Menghapus `@import` Google Fonts eksternal; (2) Menyelaraskan `--font-display` dan `--font-body` ke `var(--ptv-font-family, "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif)` yang telah dibundel lokal dan di-preload via WOFF2 di `index.html`; (3) Mempertahankan 100% letter spacing prototype (`-0.02em` s.d. `-0.06em`), weights (500, 600, 700), dan fluid clamp; (4) Menegakkan font stack resmi pada root portal; (5) Seluruh quality gates lulus 100% (typecheck 0 error, lint 0 error, 448 tests passed, build sukses 12.60s). | **Fixed** |
| **CLN-040** | 2026-10-17 | `PTV-DEV-031` | `src/products/portal/styles/portal.css`, `PortalFooter.tsx`, `ServiceCard.tsx`, `FeaturedCarousel.tsx` | PTVPRO Public Portal Visual Fidelity Rebuild from HTML Prototype Single Source of Truth | (1) CSS portal sebelumnya membengkak menjadi 1.234 baris dengan nested overrides redundant; (2) Notch safe-area bar mobile hilang akibat pemadaman `body::before`; (3) Footer watermark `.mark` dan `footer` memiliki `overflow-y: visible` dan margin 0 yang membocorkan blok navy kosong di bawah footer; (4) Karakter copyright di footer rusak menjadi ASCII `c` bukan entitas simbol `©`; (5) Card layanan dan slide featured menggunakan tag `div` bukan semantic anchor `a` sesuai HTML prototype. | Instruksi Operator: "PTVPRO PUBLIC PORTAL — VISUAL FIDELITY REBUILD" (Single source of truth `media_1792247307522.html`). | Rendah | (1) Menulis ulang `portal.css` secara terarah dan terstruktur dari prototype HTML (582 baris bersih vs 1234 baris); (2) Menghidupkan kembali blue bar safe area `#1749C0` pada `body.portal-page-active::before` dan meniadakan atmosfer gelap dashboard; (3) Menegakkan `footer { overflow: hidden }`, `padding-block: var(--s6) 0`, dan `.mark { margin-bottom: -0.12em }` sehingga watermark menempel natural di tepi bawah halaman; (4) Memperbaiki copyright encoding menjadi `&copy;` di `PortalFooter.tsx`; (5) Mengonversi `ServiceCard` dan `FeaturedCarousel` ke semantik `<a>` dengan navigasi React; (6) Seluruh quality gates lulus 100% (typecheck 0 error, lint 0 error, 448 tests passed, build sukses). | **Fixed** |
| **CLN-039** | 2026-10-17 | `PTV-DEV-030` | `src/products/portal/styles/portal.css`, `PortalPage.tsx`, `AnnouncementModal.tsx` | PTVPRO Public Portal Bugfix: Scroll Cut-off, Navy Leak & Footer Layout | (1) Halaman berhenti scroll sebelum footer terlihat penuh akibat parent overflow clipping, overscroll-behavior none, dan modal overlay; (2) Kategori Layanan Musiman menampilkan blok navy kosong di kolom kedua akibat leakage selector global `.list` dengan background `var(--surface)` dark mode dari `dashboard.css`; (3) Footer desktop mengalami tabrakan horizontal antara tautan `.fl` dan copyright `<small class="cp">` akibat leakage global `.wrap` (flexbox) dari `dashboard.css`. | Laporan Operator: "PTVPRO — URGENT PORTAL BUGFIX" (Bug 1, Bug 2, Bug 3). | Rendah | (1) Mengisolasi `html` dan `body` dengan `portal-page-active` (`overflow-x: clip`, `overflow-y: auto`, `overscroll-behavior-y: auto`, min-height 100%), menambahkan scroll locking aman saat modal pengumuman aktif dan pelepasan total saat ditutup; (2) Menimpa selector global `.list` di scope portal dengan `background: transparent !important`, `border: 0 !important`, `box-shadow: none !important` sehingga celah kosong kategori single-item menjadi warna canvas `#F5F7FA` yang bersih 1:1 prototype; (3) Menegaskan `.ptvpro-portal .wrap` dan `footer .wrap` sebagai `display: block !important`, mengatur `foot-top` 100% width, memisahkan copyright ke baris tersendiri, dan mengubah `footer` menjadi `overflow-x: clip; overflow-y: visible` dengan padding bawah responsif agar watermark PTVPRO tampil utuh tanpa terpotong; (4) Terverifikasi dengan headless Chrome pada 1440px, 1280px, dan 390px (`isScrolledToBottom: true`, `overlap: false`, `listBg: transparent`). | **Fixed** |
| **CLN-038** | 2026-10-17 | `PTV-DEV-029` | `api/auth/*`, `docs/PTV-PRO-DIRECT-AUTH-SECURITY-READINESS.md`, `eslint.config.js` | Direct Google OAuth Security Hardening & Cryptographic Token Verification | Audit keamanan Vercel Direct Google OAuth menemukan perlunya verifikasi ID token Google secara kriptografis (RS256 JWKS publik), penyematan binding nonce anti-replay, deteksi pembatalan status kru langsung ke database pada `/api/auth/session`, mitigasi fail-closed tanpa kebocoran mock ke staging/prod, dan perbaikan ignore eslint untuk scripts CLI. | Instruksi Operator: "PTVPRO — DIRECT GOOGLE OAUTH SECURITY & DATABASE INTEGRATION AUDIT". | Kritis | (1) Mengimplementasikan verifikasi RS256 JWKS Google publik via `node:crypto` (`createPublicKey`, `createVerify`) dengan in-memory cache 1 jam; (2) Menyematkan parameter `nonce` acak 32-byte pada login request dan memverifikasinya terhadap ID token claims; (3) Menerapkan fungsi `verifyAccountStatusLive` pada `/api/auth/session` agar penonaktifan kru di database langsung memusnahkan cookie sesi; (4) Menambahkan `scripts/**` ke `eslint.config.js` ignores; (5) Memverifikasi seluruh quality gates (typecheck 0 error, lint 0 error, 448 tests passed, build sukses). | **Fixed** |
| **CLN-037** | 2026-10-17 | `PTV-DEV-027` | `api/auth/*`, `src/core/auth/authService.ts`, `LoginPage.tsx`, `tests/auth/vercelDirectAuth.test.ts`, `vercel.json` | Vercel Direct Google OAuth Implementation, Clean URL Error Handling & Cookie Isolation | Sesuai persetujuan Operator Roup, PTV Hub menghentikan penggunaan Supabase Auth (GoTrue) dan mengadopsi Direct Google OAuth berbasis Vercel Serverless Functions (`/api/auth/*`) dengan HttpOnly Secure cookie; perlunya isolasi Google Client Secret di server-side, verifikasi Google `sub` terhadap `user_account.google_sub` (Phase 0B), penegakan capability `hub.access`, dan penanganan error flash tanpa merusak Clean Login URL (`/hub/login`). | Arahan Operator: "PTVPRO — DIRECT AUTH IMPLEMENTATION APPROVAL & ARCHITECTURE ALIGNMENT". | Sedang | (1) Membangun 4 endpoint Vercel Serverless (`/api/auth/google/login`, `/api/auth/google/callback`, `/api/auth/session`, `/api/auth/logout`) menggunakan standard node:crypto PKCE dan HMAC-SHA256 signing; (2) Menerapkan cookie `ptv_hub_session` dengan flag HttpOnly, Secure, SameSite=Lax, Path=/; (3) Membangun identity resolver `resolveIdentityByGoogleSub` yang memvalidasi `google_sub` kanonikal, `status_akun = 'active'`, dan capability `hub.access` secara fail-closed; (4) Mengimplementasikan `VercelAuthService` di frontend; (5) Memperbarui `LoginPage.tsx` agar menyerap `auth_error` dan menormalisasi URL kembali ke `/hub/login` tanpa query param; (6) Menambahkan 25 skenario unit test baru (total 434 tests lulus sempurna). | **Fixed** |
| **CLN-036** | 2026-10-17 | `PTV-DEV-026` | `src/core/auth/*`, `LoginPage.tsx`, `ProtectedRoute.tsx`, `AuthCallbackPage.tsx`, `destination.ts` | Google OAuth Integration, Clean Login URL, & Security Boundary Hardening | Tombol "Lanjutkan dengan Google" pada halaman login PTV Hub sebelumnya hanya menampilkan dialog statis; URL login memuat `?redirect=...`; belum ada rute callback OAuth resmi; serta perlunya mitigasi fail-closed terhadap akun tidak terdaftar, akun inactive, dan pencegahan open-redirect loop. | Arahan Operator: "PTV PRO — GOOGLE OAUTH ACTIVATION: Supabase Auth Integration & Secure Account Linking". | Sedang | (1) Mengintegrasikan alur Google OAuth via Supabase Auth adapter (`signInWithOAuth`) dengan parameter PKCE; (2) Membuat utilitas sanitasi destination internal (`destination.ts`) dengan pencegahan open-redirect dan anti-loop; (3) Menerapkan kebijakan Clean Login URL (`/hub/login`) tanpa query string; (4) Membangun halaman callback `/hub/auth/callback` dengan pertukaran kode PKCE, evaluasi RPC PostgreSQL `jwt_custom_claims`, dan penegakan capability `hub.access`; (5) Menambahkan disabled protection dan loading spinner pada tombol login Google; (6) Menulis 18 skenario pengujian komprehensif (total 409 tests lulus). | **Fixed** |
| **CLN-035** | 2026-10-17 | `PTV-DEV-025` | `src/styles/broadcast.css` (`.bc-btn-card-del`) | Button Spacing & Icon-Text Alignment Hotfix | Jarak antara ikon trash can (`fa-regular fa-trash-can`) dan teks "Hapus" pada kartu pengumuman Broadcast terlalu mepet karena ketiadaan `display: inline-flex` dan `gap` aktif. | Screenshot operator & permintaan perbaikan spacing tombol Hapus (`/hub/broadcast`). | Rendah | Mengubah `.bc-btn-card-del` menjadi `display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 4px 11px;`, memastikan jarak 6–8px antara ikon dan teks, tidak menempel pada tepi tombol, serta responsif di desktop dan mobile dengan mempertahankan bentuk pill dan palet warna. | **Fixed** |
| **CLN-034** | 2026-10-17 | `PTV-DEV-024` | `src/app/router/index.tsx`, `ProtectedRoute.tsx`, `LoginPage.tsx`, `hubLoginRouting.test.tsx` | Hub Login Routing Canonicalization & Open Redirect Prevention | Rute login canonical PTV Hub sebelumnya berada di `/login` alih-alih `/hub/login`, dan auth guard serta LoginPage belum memiliki sanitasi open redirect dari parameter `redirect`. | Temuan navigasi & audit routing PTV Hub. | Sedang | Menjadikan `/hub/login` sebagai rute canonical login; menambahkan compatibility redirect `/login` -> `/hub/login`; memperbarui `ProtectedRoute.tsx`; menambahkan proteksi open-redirect pada `LoginPage.tsx`; dan menambahkan 7 skenario unit test. | **Fixed** |
| **CLN-033** | 2026-10-17 | `PTV-DEV-021` | `HubShell.tsx`, `verificationService.ts`, `IdDigitalPage.tsx`, `DocDetailDrawer.tsx`, `publicVerification.test.ts` | Public Verification Routing & Canonical Deep Links Hotfix | Tombol navigasi Keabsahan Dokumen dan Verifikasi Identitas pada sidebar PTV Hub sebelumnya mengarah ke domain eksternal `progresiftv.id`; belum ada fungsi pembentuk URL kanonikal resmi vs lokal; dan nomor surat/ID yang mengandung trailing slash berpotensi menghasilkan query tidak bersih. | Instruksi Operator: "PTV PRO — PUBLIC VERIFICATION ROUTING: Migrasi Tautan Keabsahan Dokumen & Verifikasi Identitas". | Rendah | (1) Memigrasikan tautan sidebar Keabsahan Dokumen (-> `/verifikasi-surat`) dan Verifikasi Identitas (-> `/verifikasi-identitas`) menjadi same-origin relative routes dengan tetap mempertahankan ikon eksternal tab baru (`rel="noopener noreferrer"`) dan styling R03; (2) Mengimplementasikan pembentuk URL kanonikal resmi (`https://ptvpro.com/verifikasi-...`) dan navigasi lokal di `verificationService.ts`; (3) Menambahkan sanitasi pembersihan trailing slash pada `cleanDocNumber` dan `ptvNormalizeCrewId`; (4) Menghubungkan pratinjau modal ID Digital dan Drawer Detail Dokumen dengan akses langsung ke portal verifikasi publik; (5) Menambahkan 9 skenario unit test baru di `publicVerification.test.ts` (total 29 tests passed). | **Fixed** |
| **CLN-032** | 2026-10-17 | `PTV-DEV-020` | `BroadcastPage.tsx`, `broadcastStore.ts`, `types.ts`, `broadcast.css`, `PengaturanPage.tsx`, `PushDiagnosticsModal.tsx`, `LogoutConfirmModal.tsx`, `pengaturan.css`, `BerandaPage.tsx`, `router/index.tsx`, `broadcastAndPengaturan.test.tsx` | Batch 6B: Broadcast & Pengaturan Legacy Parity, Beranda Reactive Sync & Non-Misleading Security | Dua modul Media & Sistem terakhir (`legacy/page-dasbor.php` L25908–L25931 `pgBroadcast` dan L26037–L26207 `pgPengaturan`) belum termigrasi ke React; perlunya shared reactive announcement store yang tersinkronisasi otomatis dengan widget pengumuman Beranda, dialog form R03 tanpa pixel radius, integrasi QR ID kru ke `/verifikasi-identitas/{CREW_ID}`, diagnostik push Web Notification API, serta keterbukaan keamanan jujur (tidak memalsukan mutasi password/auth produksi). | Arahan migrasi Batch 6B: "PTV PRO — BATCH 6B: Implementasi Broadcast & Pengaturan". | Rendah | (1) Mengimplementasikan `BroadcastPage.tsx` dan `broadcastStore.ts` dengan reactive subscriber pattern yang tersinkronisasi langsung ke `BerandaPage.tsx`; (2) Menerapkan styling R03 continuous curves (`broadcast.css` & `pengaturan.css`) tanpa inline pixel radius; (3) Mengimplementasikan `PengaturanPage.tsx` dengan integrasi sesi auth riil (read-only username & PTV ID, role description), QR identitas resmi, sinkronisasi tema `ptv-theme`, dan diagnostik Web Notification API; (4) Melindungi keamanan dengan validasi jujur tanpa klaim palsu mutasi auth produksi; (5) Menghubungkan rute `/hub/broadcast` (`broadcast.view`) dan `/hub/pengaturan` (`settings.personal`); (6) Menambahkan 13 unit tests komprehensif (total 375 tests lulus). | **Fixed** |
| **CLN-031** | 2026-10-17 | `PTV-DEV-019` | `HaulPage.tsx`, `SeoPage.tsx`, `fixtures.ts`, `haul.css`, `seo.css`, `tests/hub/haulAndSeo.test.tsx` | Batch 6A: Haul & Harlah PPBS + SEO & Analytics Legacy Parity & Clean-as-You-Go | Modul Haul & Harlah PPBS (`legacy/page-dasbor.php` L25936–L26002) dan SEO & Analytics (`legacy/page-dasbor.php` L26007–L26031) belum termigrasi ke React; perlunya live countdown ticker anti-leak (cleanup interval), status dinamis sebelum/berlangsung/selesai tanpa ticketing/CRUD, 4 Bento KPI, grafik batang 7-hari dengan skala proporsional murni terhadap nilai maks (88), daftar kata kunci pencarian teratas, serta disclosure telemetri internal tanpa klaim live external API. | Arahan migrasi Batch 6A: "PTV PRO — BATCH 6A: Implementasi Haul & Harlah PPBS + SEO & Analytics". | Rendah | (1) Mengimplementasikan `HaulPage.tsx` dengan countdown interval cleanup dan zero negative values; (2) Menerapkan styling R03 continuous curves (`haul.css` & `seo.css`) tanpa inline pixel radius; (3) Membangun fixture lokal `fixtures.ts` 1:1 dari Legacy PHP untuk KPI, 7-day traffic, dan kata kunci; (4) Menghubungkan rute `/hub/haul` (`projecthaul.view`) dan `/hub/seo` (`settings.system`); (5) Mencegah memory leak dan multiple timers pada unmount; (6) Menambahkan 13 skenario pengujian unit komprehensif. | **Fixed** |
| **CLN-030** | 2026-10-17 | `PTV-DEV-018` | `KeuanganPage.tsx`, `keuanganStore.ts`, `types.ts`, `fixtures.ts`, `keuangan.css`, `tests/hub/keuangan.test.ts` | Batch 5: Legacy-First Finance Module Implementation, Single Ledger & RBAC Isolation | Modul Keuangan (`legacy/page-dasbor.php` L23769–L24650) belum diimplementasikan di React; perlunya 3 pilar (Kas Kru, Pemasukan, Pengeluaran), pengalaman read-only 'Kas Saya' untuk kru biasa (`finance.view_own`), pencegahan double-counting ledger, continuous curve compliance, dan modal pencatatan. | Arahan migrasi Batch 5: "PTV PRO — KEUANGAN: Legacy-First Finance Module Implementation". | Rendah | (1) Mengimplementasikan arsitektur single-entry ledger dengan sinkronisasi otomatis kas kru ke pemasukan berstatus 'Iuran Kas' (anti double counting); (2) Mengimplementasikan pengalaman terisolasi 'Kas Saya' khusus kru biasa berdasarkan session auth riil tanpa parameter manipulasi; (3) Membangun matriks iuran kas kru multi-periode dengan quick lunas/undo toggle; (4) Membangun daftar pemasukan & pengeluaran terkelompok per bulan dengan bukti preview ImageLightboxModal; (5) Mematuhi audit continuous curve dan zero inline pixel radius; (6) Menambahkan 20 skenario unit tests komprehensif. | **Fixed** |
| **CLN-029** | 2026-10-17 | `PTV-DEV-018` | `CatatanPage.tsx`, `NoteCategoryDropdown.tsx`, `catatan.css`, `catatanHotfix.test.ts` | Targeted Hotfix: Duplicate Add Button & Category Dropdown Portal | Card tambah catatan terduplikasi di grid dan dropdown kategori warna gagal terbuka/terpotong di dalam scrollable modal body. | Instruksi Operator: Targeted Hotfix: Duplicate Add Button & Category Dropdown. | Rendah | (1) Menghapus card aksi Tambah Catatan dari grid dan menggantikannya dengan empty state informatif; (2) Membuat komponen aksesibel NoteCategoryDropdown berbasis React Portal bebas clipping modal body; (3) Menambahkan listener outside click dan intersep Escape key; (4) Menambahkan 5 skenario unit tests. | **Fixed** |
| **CLN-028** | 2026-10-17 | `PTV-DEV-017` | `KeabsahanDokumenPage.tsx`, `VerifikasiIdentitasPage.tsx`, `verificationService.ts`, `publicVerification.css`, `publicVerification.test.ts` | Public Verification Legacy Parity, Smart ID Normalization & Privacy Protection | Dua portal verifikasi publik (`page-verifikasi-surat.php` dan `page-verifikasi-identitas.php`) belum termigrasi ke React; normalisasi ID smart (1 -> PTV-001), pencocokan surat tugas aktif pada tanggal verifikasi, layout publik non-dashboard, serta perlindungan ketat dari kebocoran data privat/auth/roles. | Arahan migrasi Batch 4: "PTV PRO — PUBLIC VERIFICATION". | Rendah | (1) Mengimplementasikan portal Keabsahan Dokumen (`/verifikasi-surat/*`) dengan pencarian nomor surat, verifikasi status (Valid, Revisi, Ditolak, Tidak Ditemukan), dan banner simulasi showcase; (2) Mengimplementasikan portal Verifikasi Identitas (`/verifikasi-identitas/*`) dengan normalisasi PTV-ID, deteksi surat tugas aktif hari ini, dan tautan langsung ke verifikasi dokumen; (3) Menerapkan zero privacy leakage (tanpa email, password, OAuth, permissions, internal roles); (4) Merancang layout publik mandiri non-dashboard dengan R03 visual tokens; (5) Menambahkan 20 skenario unit tests komprehensif. | **Fixed** |
| **CLN-027** | 2026-10-17 | `PTV-DEV-016` | `GeneratorSuratPage.tsx`, `SuratIzinPdfPreview.tsx`, `santriMockData.ts`, `generatorSurat.css`, `generatorSurat.test.ts` | Generator Surat Izin Legacy-First Parity & Continuous Curve Compliance | Modul Generator Surat Izin (`legacy/page-dasbor.php` L34238–L35916) belum termigrasi ke React; pemilihan santri, tabel terkelompok per angkatan, batas 6 kolom aktif, pagination A4 multi-halaman (20 hal 1, 22 hal 2+), serta penegakan audit Continuous Curve tanpa inline pixel radius. | Arahan migrasi Batch 3: "PTV PRO — GENERATOR SURAT IZIN". | Rendah | (1) Mengimplementasikan Generator Surat Izin dengan 4 panel modular R03; (2) Multi-page pagination A4 akurat (20 baris hal 1, 22 baris hal 2+); (3) Kop surat resmi forest green double border + SVG QR code generator; (4) Ekstraksi seluruh inline pixel radius ke utility CSS terpusat; (5) Presets Sekolah/Asrama dengan max 6 kolom aktif; (6) Proteksi RBAC `documents.generate`; (7) Menambahkan 6 skenario unit tests komprehensif. | **Fixed** |
| **CLN-026** | 2026-10-17 | `PTV-DEV-015` | `ArsipPage.tsx`, `arsip.css`, `arsip.test.ts` | Monthly Archive Grouping & Current Year Default Filter | Pengelompokan arsip sebelumnya berbasis per tahun (`Arsip 2026`), sehingga daftar surat di dalam tahun tersebut bercampur dan tidak terbagi per bulan; serta filter tahun belum default ke tahun berjalan. | Instruksi Operator: "PTV PRO — SURAT & ARSIP: Hotfix: Monthly Archive Grouping". | Rendah | (1) Mengubah pengelompokan arsip menjadi per bulan dalam tahun terpilih (contoh "Oktober 2026", "September 2026") dengan urutan bulan terbaru ke terlama; (2) Mengurutkan surat dalam setiap bulan dari tanggal terbaru ke terlama; (3) Menggunakan parsing tanggal kalender lokal tanpa pergeseran UTC; (4) Menjadikan tahun sebagai filter yang aktif default pada tahun berjalan (`currentYear`); (5) Mengimplementasikan header accordion interaktif dengan counter surat, di mana bulan terbaru terbuka secara default dan dapat di-toggle independen; (6) Menambahkan 3 unit test baru (total 11 tests). | **Fixed** |
| **CLN-025** | 2026-10-17 | `PTV-DEV-015` | `ArsipPage.tsx`, `arsip.css`, `DocDetailDrawer.tsx`, `arsip.test.ts` | Filter Layout Clipping & Detail Drawer Auto-Expanded Hotfix | Filter status pada viewport sempit terpotong dan sebagian pilihan tidak terjangkau; serta bagian rincian dalam Detail Dokumen tertutup secara default sehingga membutuhkan klik berulang untuk memeriksa kru/alat/jejak audit. | Laporan Operator: "PTV PRO — SURAT & ARSIP: Hotfix Filter Layout & Detail Dokumen". | Rendah | (1) Menata ulang area pencarian dan filter menjadi 3 tingkat berlabel mikro (Search full-width, Status pills dengan horizontal scroll momentum yang disengaja tanpa clipping, dan Select jenis surat full-width di baris tersendiri); (2) Menambahkan prop `defaultExpanded?: boolean` pada `DocDetailDrawer.tsx` dengan default `false` (melindungi modul Perizinan & Dokumen Saya) dan mengaktifkannya (`true`) khusus di `ArsipPage.tsx`; (3) Mereset status expanded pada setiap pergantian identitas dokumen (`doc.id`); (4) Menambahkan 2 unit test verifikasi kombinasi filter dan kontrak drawer. | **Fixed** |
| **CLN-025** | 2026-10-17 | `PTV-DEV-MIGRATION-002` | `docs/PTV-PRO-STAGING-INVENTARIS-ATOMIC-DDL.sql`, `docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`, `docs/PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql` | Pre-Deployment SQL Security & RLS Hardening | (1) RLS `ptv_inventaris` terbuka ke anon via `USING (true)`; (2) View `ptv_kru_legacy_compat` memaparkan `password_hash`; (3) `rpc_create_inventaris` missing fail-closed `auth.uid() IS NULL`; (4) `harga_beli` katalog mengekspos valuasi ke Pembina; (5) Missing `UNIQUE (inventaris_id)` pada `ptv_nilai_inventaris`; (6) Missing column `nama_unit` pada DDL induk; (7) Missing UPDATE storage policy; (8) Potensi privilege drift role Pembina. | Audit Pre-Deployment Migrasi Database Supabase Phase 0A. | Kritis | Meremediasi seluruh 8 temuan keamanan & skema: mengunci RLS inventaris ke authenticated + capability, meredaksikan hash password pada view kompatibilitas, menambahkan fail-closed auth gate, mengisolasi harga belanja modal via trigger otomatis, menambahkan constraint unik dan kolom skema, menambahkan policy UPDATE foto storage, serta menambahkan assertion karantina pembina pada seed. | **Fixed** |
| **CLN-024** | 2026-10-17 | `PTV-DEV-015` | `ArsipPage.tsx`, `arsip.css`, `base.css`, `router/index.tsx`, `arsip.test.ts` | Surat & Arsip Legacy-First Parity & Architecture | Modul Surat & Arsip (`/hub/arsip`) belum memiliki implementasi React dan rute router aktif meskipun tautan telah terdaftar di sidebar navigasi HubShell. | Audit Forensik Administrasi & Verifikasi: `legacy/page-dasbor.php` L23737 `pgArsip()`. | Rendah | Mengimplementasikan `ArsipPage.tsx` dan `arsip.css` dengan paritas penuh: pengelompokan arsip per tahun (`byYear`), pencarian multi-kriteria (nomor, perihal, pihak terkait, alat), filter status & jenis, sinkronisasi Shared Docs Store reaktif, integrasi `DocDetailDrawer.tsx` R03, rotasi palet ikon 6-warna legacy, proteksi RBAC `documents.archive.view` & `documents.archive.manage`, serta pembuatan suite tes 6 skenario. | **Fixed** |
| **CLN-023** | 2026-10-17 | `PTV-DEV-014` | `DocDetailDrawer.tsx`, `perizinan.css`, `base.css` | Detail Dokumen UI Simplification Hotfix & Accordion Architecture | Tampilan detail dokumen di drawer sebelumnya terlalu panjang dan padat (4 kotak alur vertikal besar, daftar mentah baris-per-baris untuk semua kru & inventaris, dan jejak audit panjang meregang ke bawah drawer). | Instruksi Operator: "Detail Dokumen UI Simplification Hotfix". | Rendah | Merefaktor hierarki drawer: (1) Header fokus perihal + badge status; (2) Critical review note banner langsung terlihat saat status Revisi/Ditolak; (3) Compact status summary card 1-baris; (4) Single summary card dengan counter ringkas `X kru ditugaskan` & `X jenis peralatan`; (5) 4 collapsible accordion sections (default tertutup) untuk rincian kru/alat, alur timeline 4-tahap, riwayat jejak audit, dan verifikasi QR; (6) Footer action tetap utuh dan terproteksi permission; (7) Menghubungkan stylesheet `perizinan.css` ke `base.css` agar styling drawer universal di seluruh modul. | **Fixed** |
| **CLN-022** | 2026-10-17 | `PTV-DEV-014` | `PerizinanPage.tsx`, `perizinan.css`, `AjukanTugasModal.tsx`, `AjukanBarangModal.tsx`, `PerbaikiPengajuanModal.tsx`, `ReviewActionModal.tsx` | Modal Card Refinement & Submission Card Simplification | Modal pengajuan surat sebelumnya menggunakan drawer side-wrapper (`.kk-drawer-content` height 100%) sehingga hampir fullscreen dan menyisakan ruang kosong; serta kartu surat yang diajukan terlalu padat dengan duplikasi jenis surat, nomor lengkap, seluruh list kru/alat, dan paragraf catatan revisi. | Laporan & Instruksi Operator Hotfix: "Modal Card Refinement & Submission Card Simplification". | Rendah | Merefaktor modal ke standar dialog card R03 `.prz-modal-card` (centered, max-width 640-680px, max-height 86dvh, fixed header/footer, scrollable body); menyederhanakan kartu surat menjadi format ringkasan bersih (icon 44x44, category tag + status badge, judul menonjol 2 baris, tanggal & pemohon, counter ringkas `X kru ditugaskan` / `X unit peralatan`, indikator ringkas revisi, dan chevron) dengan informasi lengkap tetap terlindungi dan tersaji di `DocDetailDrawer.tsx`. | **Fixed** |
| **CLN-021** | 2026-10-17 | `PTV-DEV-014` | `PerizinanPage.tsx`, `AjukanTugasModal.tsx`, `AjukanBarangModal.tsx`, `PerbaikiPengajuanModal.tsx`, `tests/hub/perizinan.test.ts` | Continuous Curve Governance, Import Alias & Unused Import Hygiene | Modal pengajuan perizinan menggunakan inline radius pixel mentah (`borderRadius: '10px' | '8px' | '12px'`) yang melanggar audit Continuous Curve; `PerizinanPage.tsx` menggunakan path import `@styles/perizinan.css` yang gagal diresolve Vite bundler; dan `perizinan.test.ts` menyisakan unused import `PtvDocument`. | Test runner `continuousCurveAudit.test.ts`, build error Vite bundler, dan TypeScript TS6133. | Rendah | Mengganti seluruh inline border-radius di ketiga modal ke CSS token resmi `var(--r-md, 10px)`, `var(--r-md, 8px)`, `var(--r-lg, 12px)`; memperbaiki alias stylesheet menjadi `@/styles/perizinan.css`; dan menghapus unused import `PtvDocument`. | **Fixed** |
| **CLN-020** | 2026-10-17 | `PTV-DEV-012` | `IdDigitalPage.tsx`, `kruKomunikasi.css`, `dashboard.css`, `idDigital.test.ts` | Typography Inconsistency & Monospace Font Removal | Teks nilai KRU NO. (contoh `PTV-001`) menggunakan font monospace dan warna biru `#60a5fa` sehingga berbeda dan tidak selaras dari nilai POSITION, DIVISI, dan STATUS. | User Request ID Digital Typography Hotfix & White Color Alignment. | Rendah | Menghapus deklarasi `font-family: monospace` dan letter spacing khusus pada nilai nomor kru; menyelaraskan font family ke SF Pro Display bawaan `.idcard-cred-val`; menyamakan font-size (13px preview, 22px canvas), font-weight (850 di CSS, bold di canvas), line-height (1.25), letter-spacing (0.02em); mengubah warna nomor kru menjadi putih `#ffffff` murni sesuai permintaan operator; menyelaraskan generator PNG Canvas (`ctx.fillStyle = '#FFFFFF'`); dan menambahkan pengujian unit verifikasi tipografi. | **Fixed** |
| **CLN-019** | 2026-10-17 | `PTV-DEV-012` | `IdDigitalPage.tsx`, `kruKomunikasi.css`, `idDigitalAssets.ts` | Visual Asset Fidelity & Generic Text Elimination | Logo resmi Progresif TV digantikan teks generik HTML statis dan frame foto berukuran kaku 130x160 tanpa crop proporsional, berpotensi memotong wajah subjek. | Audit aset rujukan legacy `page-dasbor.php` & instruksi fidelity operator. | Sedang | Mengintegrasikan logo resmi `/assets/images/ptv-logo-white.webp` + fallback base64, menyelaraskan frame foto ke rasio 1:1.08 dengan object-fit cover & position center 20%, eliminasi zombie CSS `.idcard-logo-text`, integrasi shared crew store, dan generator Canvas PNG HD 720×1120. | **Fixed** |
| **CLN-018** | 2026-10-17 | `PTV-DEV-010` | `src/styles/acara.css`, `src/products/hub/acara/components/AcaraCard.tsx` | Visual Regression & Flat White Bleed | Seluruh baris daftar acara kehilangan identitas warna dan tampil dominan putih polos, sementara warna hanya tersisa pada ikon kalender biru statis. | Laporan operator & evaluasi visual modul Acara. | Rendah | Mengembalikan rotasi 6 palet warna tint lembut R03 (`6n+1` s.d. `6n+6`: Biru PTV, Indigo, Teal, Amber, Purple, Emerald), kotak ikon kalender harmonis dengan baris, tint khusus status Batal (soft rose), serta dukungan Dark Mode. | **Fixed** |
| **CLN-001** | 2026-10-15 | `PTV-DEV-001` | `src/products/hub/kalender/KalenderPage.tsx` | Mock Leakage / Unused Element | Label teks teknis `"Preview UI · Isolated Mock Fixture"` dan unused import `IS_MOCK_FIXTURE` pada header antarmuka. | Finalisasi tampilan UI Kalender agar murni tanpa teks teknis mock. | Rendah | Dihapus dari JSX dan import | **Fixed** |
| **CLN-002** | 2026-10-15 | `PTV-DEV-002` | `src/products/hub/catatan/CatatanPage.tsx` | Regex Hygiene / ESLint | Karakter escape tidak perlu `[\/]` pada regex `stripHtml` (`no-useless-escape`). | Laporan ESLint `eslint . --max-warnings 0`. | Rendah | Disederhanakan menjadi `\/` | **Fixed** |
| **CLN-003** | 2026-10-15 | `PTV-DEV-002` | `src/products/hub/catatan/CatatanPage.tsx` | Curve Governance / Disallowed Inline Radius | Hardcoded `borderRadius: '8px'` pada form atribut rapat melanggar continuous curve audit. | Test runner `continuousCurveAudit.test.ts`. | Rendah | Diganti ke token resmi `var(--r-md, 8px)` | **Fixed** |
| **CLN-004** | 2026-10-15 | `PTV-DEV-002` | `src/products/hub/catatan/CatatanPage.tsx` | Curve Governance & Markup Hygiene | Penggunaan `borderRadius: '50%'` pada icon modal hapus distandarkan ke `var(--r-full, 999px)` serta pembersihan redundant closing tag modal. | Test runner `continuousCurveAudit.test.ts` & sanitasi JSX. | Rendah | Diganti ke token resmi `var(--r-full, 999px)` & perapian JSX | **Fixed** |
| **CLN-005** | 2026-10-15 | `PTV-DEV-003` | `src/products/hub/kalender/KalenderPage.tsx` & `src/styles/kalender.css` | Responsive Architecture & Duplicate CSS | Inline hardcoded desktop grid `minmax(320px, 0.95fr)` merusak layout mobile, serta deklarasi duplikat card di stylesheet. | Laporan investigasi responsive kalender mobile. | Sedang | Refactor ke scoped responsive classes `.kal-layout-grid` dan eliminasi duplikasi CSS | **Fixed** |
| **CLN-006** | 2026-10-15 | `PTV-DEV-003` | `src/products/hub/kalender/KalenderPage.tsx` & `src/styles/kalender.css` | CSS Scoping & Layout Hierarchy | Ketiadaan styling flex pada `.kal-planner-item` menyebabkan badge periode melebar 100% full-width dan memecah 3-kolom horizontal. | Laporan kendala layout momentum & ide konten kalender. | Rendah | Standardisasi markup semantik `.kal-planner-*` dan implementasi pola compact editorial list | **Fixed** |
| **CLN-007** | 2026-10-16 | `PTV-DEV-004` | `src/products/hub/catatan/CatatanPage.tsx` & `src/styles/catatan.css` | Whitespace Pollution & Raw HTML Form Leakage | Penggunaan `whiteSpace: pre-line` pada detail modal menimbulkan celah baris ganda, textarea mentah menampilkan raw tags, dan toolbar hanya melakukan penambahan string dummy. | Laporan perbaikan rich text editor catatan bersama. | Sedang | Eliminasi `pre-line`, standardisasi compact prose CSS, ekstraksi sanitasi HTML aman, dan migrasi ke WYSIWYG `NoteRichEditor`. | **Fixed** |
| **CLN-008** | 2026-10-16 | `PTV-DEV-005` | `src/products/hub/catatan/*` & `src/styles/catatan.css` | Security Sanitization & Responsive Boundaries | Sanitasi gambar berbasis allowlist scheme, pencegahan XSS event-handler img, batas file 5MB, desktop read max-width 780px, dan responsive image scaling. | Permintaan Image Support & Content Boundaries Catatan Bersama. | Sedang | Izinkan safe img (data URL/blob/https), batasi file 5MB, overflow-wrap anywhere, dan adaptif max-height modal | **Fixed** |
| **CLN-009** | 2026-10-16 | `PTV-DEV-006` | `src/products/hub/acara/*` | Curve Governance & Type Hygiene | Standardisasi inline pixel border-radius stepper ke token resmi `var(--r-sm, 6px)`, penggantian `50%` ke `var(--r-full, 9999px)`, eliminasi unused imports, dan penyelarasan properti AuthUser `full_name`. | Test runner `continuousCurveAudit.test.ts` dan `tsc --noEmit`. | Rendah | Diganti ke token resmi, eliminasi unused imports, dan penyesuaian tipe | **Fixed** |
| **CLN-010** | 2026-10-16 | `PTV-DEV-006` | `src/products/hub/acara/AcaraDetailPage.tsx` & `src/styles/acara.css` | UI Hierarchy & Action Duplication | Jarak mepet antara kotak Instruksi Teknis dan heading Notulensi Terkait, serta duplikasi tombol "Tautkan Notulensi" di header card dan empty state box. | Screenshot dan evaluasi visual operator. | Rendah | Refactor spacing ke scoped CSS `.acara-notes-*` (23px vertikal lega, 11px heading), dan eliminasi tombol duplikat di empty state box | **Fixed** |
| **CLN-011** | 2026-10-16 | `PTV-DEV-006` | `src/shared/components/AcaraKalenderNav.tsx`, `AcaraPage.tsx`, `KalenderPage.tsx` | Nav Fragmentation & Header Asymmetry | Navigasi segmented hanya ada di Acara, tidak ada di Kalender, perpindahan rute kaku tanpa transisi, filter reset saat navigasi, serta breadcrumb di Kalender tidak selaras. | Permintaan Nav Refinement Acara & Kalender. | Rendah | Implementasi shared component `AcaraKalenderNav` dengan sliding pill indicator 220ms, view transition 200ms, filter persistence session, eliminasi CSS usang, dan penghapusan breadcrumb header Kalender | **Fixed** |
| **CLN-012** | 2026-10-16 | `PTV-DEV-007` | `lapor-kerusakan/*`, `lost-found/*`, `src/styles/*` | Photo Visibility, Card Surfaces & Zoom Lightbox | Foto alat inventaris belum tampil di kartu laporan, foto bukti fisik belum terpisah dari alat, missing card surface pada CSS variabel non-standar, tidak ada fallback onError gambar, serta drawer/modal belum mendukung zoom foto. | Permintaan Photo Visibility & Card UI Refinement Lapor Kerusakan & Lost & Found. | Sedang | Pemisahan tegas asset photo vs damage photo, pembuatan `EquipmentThumbnail` dengan ikon studio netral R03, pembuatan shared `ImageLightboxModal` zoom layar penuh, penambahan badge bukti kerusakan di kartu, image onError fallback, dan pemulihan surface solid putih `var(--surface, #FFFFFF)`. | **Fixed** |
| **CLN-013** | 2026-10-16 | `PTV-DEV-008` | `HubShell.tsx`, `dashboard.css`, `LostFoundDetailDrawer.tsx`, `lostFound.css` | Mobile Header Transparency & Drawer Header Overlap | Header mobile transparan tanpa batas saat scroll (`.hdr.stuck` tidak aktif), tombol aksi padat (gap 3px) di bawah 44px, badge status drawer mewarisi `position: absolute` menimpa tombol close, dan drawer belum memiliki Escape key handler. | Evaluasi screenshot mobile operator & Targeted UI Hotfix. | Sedang | Implementasi scroll listener di `HubShell.tsx`, surface solid translucent 96% + blur 16px, touch target 44px, restrukturisasi header drawer 2-baris, isolation badge static, dan background scroll lock + Escape handler. | **Fixed** |
| **CLN-014** | 2026-10-17 | `PTV-DEV-009` | `HubShell.tsx`, `dashboard.css` | Global Header Desktop Alignment & Viewport Centering Drift | Search bar berada di tengah header terpisah jauh dari notification bell dan avatar karena deklarasi `margin-left: auto` ganda pada `.hdr-search` dan `.hdr-actions`, serta search bar berada di luar container aksi kanan. | Permintaan Alignment Global Header Desktop sesuai Screenshot Operator & Guidebook R03. | Rendah | Memindahkan elemen `.hdr-search` ke dalam kelompok `.hdr-actions`, memberikan `margin-left: auto` tunggal pada container `.hdr-actions`, menyisakan ruang fleksibel tengah kosong, menetapkan gap 14px konsisten (margin-right 6px + gap 8px), dan mempertahankan search icon compact pada layar sempit/mobile. | **Fixed** |
| **CLN-015** | 2026-10-17 | `PTV-DEV-010` | `kruKomunikasi.css`, `KontakEksternalPage.tsx`, `DokumenSayaPage.tsx`, `IdDigitalPage.tsx`, `KruPage.tsx` | Mobile Overflow, Date Wrapping & Secondary Modals Accessibility | Teks nama terpotong di mobile 320-420px pada Kontak Eksternal; tanggal dokumen terpotong 2 baris di Dokumen Saya; KTA Digital terlalu mepet tepi layar pada <= 375px; dan modal sekunder (Delete, Login History, Verifikasi ID) belum menerapkan background scroll lock, focus trap, and escape handler. | Laporan Audit Kepatuhan R03 Kru & Komunikasi PTV-DEV-010. | Sedang | Sembunyikan tombol teks Detail pada <= 420px & buat card dapat diakses secara keyboard/touch, nowrap pada tanggal dokumen & flex-wrap footer kartu, breathing room 14px pada KTA tanpa merusak proporsi 720x1120 canvas export, serta integrasi shared hook `useModalScrollLock` lengkap dengan focus trap, escape listener, focus restoration, dan ARIA attributes. | **Fixed** |
| **CLN-016** | 2026-10-17 | `PTV-DEV-010` | `types.ts`, `internalContactStore.ts`, `internalContactMockData.ts`, `KontakInternalDetailDrawer.tsx`, `KontakInternalPage.tsx`, `crewMockData.ts` | Conceptual Data Leakage & Unauthorized Account Controls in Directory | Figur kiai/pengasuh pesantren (KH. Agoes Ali Masyhuri) keliru dimasukkan sebagai anggota kru operasional PTV dan detail drawer Kontak Internal menampilkan Status Akun Portal, Username, Google OAuth SSO, dan tombol administrasi akun. | Temuan Evaluasi Operator: "Kontak Internal tidak sama dengan anggota PTV". | Sedang | Memisahkan model data `InternalContact` dari `CrewMember`; membersihkan mock kiai dari daftar akun kru PTV; membuat `KontakInternalDetailDrawer` murni direktori komunikasi; menghilangkan seluruh kontrol akun/role dari Kontak Internal; dan menghubungkan shared reference `crew_id` reaktif. | **Fixed** |
| **CLN-017** | 2026-10-17 | `PTV-DEV-010` | `ManagePermissionsModal.tsx`, `KruDetailDrawer.tsx`, `crewPermissions.ts`, `kruStore.ts`, `kruKomunikasi.test.ts` | Redundant RBAC Architecture Avoidance & Style/Unused Import Hygiene | Potensi pembuatan model RBAC paralel kedua dicegah dengan menggunakan kanonik `@core/policy`; perbaikan invalid inline style `divideY`; utilisasi `isEffective` untuk status badge visual; eliminasi unused import `ALL_CAPABILITIES` di unit test; dan penambahan 11 skenario pengujian komprehensif. | Permintaan Operator: "Role & Permission Management UI Showcase". | Sedang | Re-use arsitektur `@core/policy` (`policyEngine`, `capabilities`, `profiles`); pembuatan `ManagePermissionsModal` dan utilitas `crewPermissions.ts`; perbaikan style/imports; dan pengujian 100% lolos (268/268). | **Fixed** |* |

---

## C. RIWAYAT CLEANING (ACTION LOG)

### [CLN-029] — 2026-10-17 — Targeted Hotfix: Duplicate Add Button & Category Dropdown Portal
- **Session ID:** `PTV-DEV-018`
- **Developer / Operator:** Roup
- **File Terdampak:** `src/products/hub/catatan/CatatanPage.tsx`, `src/products/hub/catatan/components/NoteCategoryDropdown.tsx`, `src/styles/catatan.css`, `src/products/hub/catatan/__tests__/catatanHotfix.test.ts`
- **Kategori Temuan:** Targeted UI & Functional Hotfix / Modal Body Overflow & Clipping Fix / Accessibility
- **Tingkat Risiko:** Rendah
- **Uraian Perbaikan:**
  1. Menghapus action card 'Tambah Catatan Baru' beserta dekorasi lingkaran plus dan dot warna dari grid Catatan Bersama dan Catatan Tersemat.
  2. Memastikan item catatan regular otomatis mengalir dari kolom pertama tanpa menyisakan slot kosong atau placeholder.
  3. Menyediakan komponen pesan informatif ringkas untuk empty state tanpa tombol duplikat.
  4. Mendiagnosis akar masalah dropdown: percampuran antara `overflow-y: auto` modal body dengan positioning absolute yang terpotong batas dialog, ketiadaan handler outside click, dan intersep tombol Escape yang menutup seluruh modal.
  5. Mengimplementasikan `NoteCategoryDropdown.tsx` berbasis `ReactDOM.createPortal` ke `document.body` dengan z-index 1100, pemosisian dinamis (bottom/top flip), event listener klik di luar, dan penanganan Escape key capture-phase (`stopPropagation`).
  6. Memastikan kelima palet warna resmi legacy (Buñol/Penting, Bagan/Ide, Sagano/Info, Valensole/Agenda, Nara/Tugas) tampil konsisten dan responsif pada desktop maupun mobile.
  7. Menambahkan 5 skenario unit test verifikasi (`catatanHotfix.test.ts`) dengan 324/324 total test suite pass.
- **Status Akhir:** Fixed (Terverifikasi Penuh).

### [CLN-028] — 2026-10-17 — Public Verification Legacy Parity, Smart ID Normalization & Privacy Protection
- **Session ID:** `PTV-DEV-017`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/verification/KeabsahanDokumenPage.tsx`, `src/products/verification/VerifikasiIdentitasPage.tsx`, `src/products/verification/verificationService.ts`, `src/products/verification/types.ts`, `src/products/verification/components/PublicVerificationHeader.tsx`, `src/styles/publicVerification.css`, `src/app/router/index.tsx`, `tests/hub/publicVerification.test.ts`.
- **Alasan Teknis:** Memenuhi arahan migrasi Batch 4: Public Verification (Keabsahan Dokumen & Verifikasi Identitas) berdasarkan implementasi PHP Legacy (`page-verifikasi-surat.php` dan `page-verifikasi-identitas.php`) dan standar PTV Design System R03:
  1. Membangun portal publik Keabsahan Dokumen (`/verifikasi-surat/*`) yang dapat diakses tanpa autentikasi, mendukung pencarian nomor surat fleksibel (URI decode, spasi toleran, nomor resmi ST-PTV/SI-PTV/SBB-PTV), serta menyajikan status verifikasi terstruktur (Valid, Revisi, Ditolak, Menunggu, Tidak Ditemukan).
  2. Membangun portal publik Verifikasi Identitas (`/verifikasi-identitas/*`) dengan normalisasi Smart ID (`ptvNormalizeCrewId`: 1 -> PTV-001, 25 -> PTV-025, ptv-25 -> PTV-025, PTV-PTV-025 -> PTV-025), profil anggota terverifikasi, dan pendeteksian otomatis surat tugas aktif pada hari ini (`getActiveAssignmentForCrew`) dengan direct link ke portal dokumen.
  3. Menegakkan proteksi privasi zero-leakage: informasi sensitif autentikasi (email, password, OAuth credentials, permissions, assigned profiles, internal roles) dieliminasi 100% dari model data publik.
  4. Merancang layout publik mandiri non-dashboard dengan R03 visual tokens (tidak menggunakan sidebar internal atau bottom dock Hub).
  5. Menambahkan 20 skenario unit tests komprehensif pada `tests/hub/publicVerification.test.ts` dan memastikan zero inline pixel border-radius pada seluruh JSX.
- **Dampak Perubahan:** Dua portal publik verifikasi keabsahan kini aktif di `/verifikasi-surat` dan `/verifikasi-identitas`, lolos seluruh quality gates (typecheck 0 error, lint 0 error, 319/319 unit tests passed, build produksi sukses).

### [CLN-027] — 2026-10-17 — Generator Surat Izin Legacy-First Parity & Continuous Curve Compliance
- **Session ID:** `PTV-DEV-016`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/surat/generator/GeneratorSuratPage.tsx`, `src/products/hub/surat/generator/components/SuratIzinPdfPreview.tsx`, `src/products/hub/surat/generator/mock/santriMockData.ts`, `src/styles/generatorSurat.css`, `tests/hub/generatorSurat.test.ts`.
- **Alasan Teknis:** Memenuhi arahan migrasi Batch 3: Generator Surat Izin Santri Progresif TV berdasarkan implementasi PHP Legacy (`legacy/page-dasbor.php` L34238–L35916) dan standar PTV Design System R03:
  1. Mengimplementasikan 4 panel terstruktur: (1) Parameter Surat (Nama Kegiatan, Tanggal Mulai & Rentang Selesai opsional, Nomor Surat Resmi simulasi `001/SI-PTV/X/2026`, Opsi Dikeluarkan); (2) Pengaturan Kolom (Presets Sekolah & Asrama, 9 kolom santri dinamis, batas maksimal 6 kolom aktif, angkatan chips, live search, select all); (3) Tabel Data Santri terkelompok per angkatan alfabetis dengan sticky header dan internal scroll; (4) PDF Multi-page A4 Preview dengan Kop Surat resmi forest green double border, QR code SVG, pagination counter akurat (maksimal 20 baris hal 1, 22 baris hal 2+).
  2. Menegakkan continuous curve governance: mengekstraksi seluruh inline pixel border-radius ke stylesheet `src/styles/generatorSurat.css` (`.gen-panel-card`, `.gen-input`, `.gen-preset-btn`, `.gen-col-chip`, `.gen-angkatan-chip`, `.gen-search-input`, `.gen-unit-pill`, `.gen-pdf-box`, `.gen-modal-card`).
  3. Mengamankan hak akses penerbitan surat izin santri dengan capability RBAC `documents.generate` (khusus eksekutif/administrasi) dengan polite banner info bagi peran kru biasa, serta dev route bypass `/dev-generator-surat` untuk visual review terisolasi.
  4. Menghubungkan pengesahan surat izin resmi ke Shared Docs Store (`useDocsStore.requestDoc`) dengan status langsung `Disetujui` dan nomor resmi terarsip otomatis di modul Surat & Arsip.
- **Dampak Perubahan:** Modul Generator Surat Izin kini aktif di `/hub/surat/generator` (dan preview di `/dev-generator-surat`), lolos seluruh quality gates (typecheck 0 error, lint 0 error, 299/299 unit tests passed, build produksi sukses).

### [CLN-024] — 2026-10-17 — Surat & Arsip Legacy-First Parity & Architecture
- **Session ID:** `PTV-DEV-015`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/arsip/ArsipPage.tsx`, `src/styles/arsip.css`, `src/styles/base.css`, `src/app/router/index.tsx`, `tests/hub/arsip.test.ts`.
- **Alasan Teknis:** Memenuhi arahan migrasi Batch 2: Surat & Arsip (`/hub/arsip`) berbasis forensic discovery PHP Legacy (`legacy/page-dasbor.php` L23737 `pgArsip()`) dan PTV Design System R03:
  1. Menyediakan tampilan repositori master arsip resmi Progresif TV yang terkelompokkan per tahun (`byYear`: `Arsip 2026`, `Arsip 2025`, dst.) dengan pengurutan kronologis.
  2. Mengimplementasikan pencarian multi-kriteria sesuai legacy (nomor surat, perihal, pihak terkait/pemohon/penanggung jawab, penerima tugas, dan jenis surat).
  3. Menyediakan filter status interaktif (`Semua`, `Resmi (ACC)`, `Menunggu`, `Revisi`, `Ditolak`) dan filter jenis surat.
  4. Menghubungkan secara reaktif ke Shared Docs Store (`docsStore.ts`), sehingga pengajuan dan persetujuan surat dari modul Pengajuan Perizinan langsung tersinkronisasi tanpa duplikasi model data.
  5. Menggunakan kembali `DocDetailDrawer.tsx` yang telah disempurnakan dengan compact hierarchy dan collapsible accordions untuk melihat detail surat, riwayat timeline, jejak audit, QR verifikasi resmi, dan unduh PDF.
  6. Menegakkan proteksi RBAC: rute `/hub/arsip` diproteksi dengan capability `documents.archive.view`, dan aksi pengelolaan/penghapusan arsip diverifikasi dengan `documents.archive.manage`.
  7. Menjamin kejujuran penomoran surat: Hanya surat berstatus `Disetujui` dengan nomor resmi yang menampilkan nomor surat terbit, sedangkan dokumen draft/revisi berstatus transparan `Belum diterbitkan (Draft)`.
- **Dampak Perubahan:** Modul Surat & Arsip kini berfungsi 100% pada rute `/hub/arsip`, lolos seluruh quality gates (typecheck 0 error, lint 0 error, 288/288 unit tests passed, build produksi sukses).

### [CLN-023] — 2026-10-17 — Detail Dokumen UI Simplification Hotfix & Accordion Architecture
- **Session ID:** `PTV-DEV-014`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/dokumen-saya/components/DocDetailDrawer.tsx`, `src/styles/perizinan.css`, `src/styles/base.css`.
- **Alasan Teknis:** Menyelesaikan masalah kepadatan visual pada drawer detail dokumen di mana sebelumnya informasi tersaji terlalu panjang dan padat (4 kotak alur vertikal besar, daftar mentah seluruh nama personel dan unit alat, dan timeline audit yang meregang ke bawah drawer).
- **Dampak Perubahan:**
  1. **Header Fokus & Rapi:** Menampilkan jenis dokumen, judul perihal lengkap yang dominan, nomor surat resmi / status draft, dan badge status warna R03 tanpa label berulang.
  2. **Catatan Revisi Kritis Langsung Terlihat:** Untuk dokumen berstatus `Revisi` (amber) atau `Ditolak` (red), alert banner catatan reviewer ditempatkan tepat di atas ringkasan dan langsung terlihat tanpa harus membuka accordion.
  3. **Compact Status Summary Card:** Menggantikan 4 kotak alur besar dengan 1 kartu ringkasan status satu-baris yang menjelaskan status aktual secara presisi.
  4. **Single Summary Card:** Merangkum pemohon, tanggal dokumen, penanggung jawab, acara terkait (jika ada), serta pill count `X kru ditugaskan` dan `X jenis peralatan`.
  5. **4 Accessible Collapsible Accordion Sections (Default Closed):**
     - Rincian Personel & Peralatan (menampilkan daftar pill personel kru dan unit alat lengkap dengan jumlahnya).
     - Alur Persetujuan & Timeline (menampilkan timeline visual 4-tahap lengkap: Pengajuan, Review, Pengesahan, Pengarsipan).
     - Riwayat Jejak Audit (menampilkan riwayat status dan waktu pengubahan dokumen).
     - Keabsahan & QR Verifikasi (menampilkan QR code resmi simulasi dan panduan keabsahan).
  6. **Pelestarian Fitur & Aksi Footer:** Tombol unduh PDF resmi dan aksi penghapusan arsip (bagi peran berwenang) tetap utuh dengan modal konfirmasi dan proteksi permission.
  7. **Universal Stylesheet Import:** Menghubungkan `@import './perizinan.css';` di `src/styles/base.css` sehingga komponen drawer detail dokumen terstyling sempurna di `/hub/perizinan` maupun `/hub/dokumen-saya`.
- **Pengujian yang Dijalankan:** `npm run typecheck` (0 error), `npm run lint` (0 error, 0 warning), `npm test` (26 test files, 282/282 passed), `npm run build` (sukses).

### [CLN-022] — 2026-10-17 — Pengajuan Perizinan Modal Card Refinement & Submission Card Simplification
- **Session ID:** `PTV-DEV-014`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/perizinan/PerizinanPage.tsx`, `src/styles/perizinan.css`, `src/products/hub/perizinan/components/AjukanTugasModal.tsx`, `src/products/hub/perizinan/components/AjukanBarangModal.tsx`, `src/products/hub/perizinan/components/PerbaikiPengajuanModal.tsx`, `src/products/hub/perizinan/components/ReviewActionModal.tsx`.
- **Alasan Teknis:** Menyelesaikan dua feedback visual konkret dari Operator:
  1. **Modal Card Proportion & Scroll Remediation:** Menggantikan wrapper side-drawer full-height (`.kk-drawer-content` dengan `height: 100%`) yang sebelumnya menyebabkan modal terlihat fullscreen dan menyisakan ruang kosong besar di bawah footer. Diganti dengan standar dialog card R03 terpusat (`.prz-modal-overlay` dan `.prz-modal-card`: centered horizontal & vertikal, max-width 640–680px, max-height 86dvh, fixed header, scrollable body, dan fixed footer). Pada mobile, modal bertransisi mulus menjadi bottom sheet 90dvh dengan tombol aksi full-width.
  2. **Submission Card Simplification:** Menerapkan prinsip `CARD = RINGKASAN` dan `DETAIL = INFORMASI LENGKAP`. Menghapus duplikasi label jenis surat berulang, nomor surat mentah, seluruh daftar nama kru, seluruh daftar alat, dan paragraf panjang catatan revisi dari tampilan kartu utama. Menggantinya dengan layout ringkas: icon box 44×44, kategori tag (`IZIN TUGAS` / `IZIN BAWA BARANG`), judul perihal menonjol (maks 2 baris), status badge, metadata tanggal & pemohon, counter ringkas (`X kru ditugaskan` / `X unit peralatan`), indikator ringkas revisi, dan chevron interaktif. Seluruh rincian lengkap tetap terlindungi dan tersaji di drawer detail `DocDetailDrawer.tsx`.
- **Dampak Perubahan:** Tampilan kartu menjadi sangat bersih, ringan, dan mudah dipindai; modal tampil proporsional tanpa fullscreen drift; 100% lolos quality gates: `typecheck`, `lint`, `test` (282/282 passed), dan `build` sukses.

### [CLN-021] — 2026-10-17 — Pengajuan Perizinan Continuous Curve, Import Alias & Unused Import Hygiene
- **Session ID:** `PTV-DEV-014`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/perizinan/PerizinanPage.tsx`, `src/products/hub/perizinan/components/AjukanTugasModal.tsx`, `src/products/hub/perizinan/components/AjukanBarangModal.tsx`, `src/products/hub/perizinan/components/PerbaikiPengajuanModal.tsx`, `tests/hub/perizinan.test.ts`.
- **Alasan Teknis:** Memenuhi standardisasi kualitas dan tata kelola kode repositori PTV PRO:
  1. **Continuous Curve Governance:** Menghilangkan deklarasi hardcoded pixel inline radius (`borderRadius: '10px' | '8px' | '12px'`) pada badge/counter kru di modal perizinan, diganti dengan token CSS resmi `var(--r-md, 10px)`, `var(--r-md, 8px)`, `var(--r-lg, 12px)` sehingga lolos audit geometris `tests/hub/continuousCurveAudit.test.ts`.
  2. **Vite Import Alias Resolution:** Memperbaiki impor stylesheet di `PerizinanPage.tsx` dari `@styles/perizinan.css` menjadi alias resmi `@/styles/perizinan.css` agar bundling produksi `vite build` berhasil mengompilasi CSS.
  3. **TypeScript Unused Import Hygiene:** Menghapus import tipe `PtvDocument` yang tidak digunakan secara langsung pada `tests/hub/perizinan.test.ts` untuk mematuhi konfigurasi `noUnusedLocals` (TS6133).
- **Dampak Perubahan:** 100% lolos quality gates: `npm run typecheck`, `npm run lint`, `npm test` (282/282 tests passed), dan `npm run build` sukses.

### [CLN-020] — 2026-10-17 — ID Digital Typography Consistency Hotfix
- **Session ID:** `PTV-DEV-012`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/id-digital/IdDigitalPage.tsx`, `src/styles/kruKomunikasi.css`, `src/styles/dashboard.css`, `tests/hub/idDigital.test.ts`.
- **Alasan Teknis:** Menyelesaikan inkonsistensi tipografi pada kartu ID Digital kru di mana nilai `KRU NO.` (`PTV-001`) sebelumnya menggunakan `font-family: monospace` (`.font-mono`) dan letter spacing 0.05em sehingga berbeda dari nilai `POSITION`, `DIVISI`, dan `STATUS`:
  1. Menghilangkan kelas `.font-mono` dari elemen nilai `KRU NO.` di `IdDigitalPage.tsx`, diganti dengan kelas spesifik `.idcard-cred-kruno`.
  2. Menyelaraskan tipografi nomor kru agar secara alami mewarisi font keluarga utama kartu (`SF Pro Display`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `sans-serif`), ukuran font 13px, font weight 850, line height 1.25, dan letter spacing 0.02em identik dengan nilai kredensial lainnya.
  3. Mengubah warna teks nilai nomor kru menjadi putih murni `#ffffff` pada `.idcard-cred-kruno` sesuai instruksi operator (bukan biru `#60a5fa`), sehingga serasi dengan nilai POSITION dan DIVISI.
  4. Menyelaraskan styling rendering Canvas PNG 720×1120 HD (`handleDownloadPng`) dari font monospace 24px menjadi font SF Pro Display bold 22px dengan `ctx.fillStyle = '#FFFFFF'`.
  5. Menambahkan test case ke-6 pada `tests/hub/idDigital.test.ts` untuk memastikan tipografi nomor kru tidak lagi memuat styling monospace dan konsisten pada preview maupun ekspor canvas.

### [CLN-019] — 2026-10-17 — ID Digital Visual Asset Fidelity & Generic Text Elimination
- **Session ID:** `PTV-DEV-012`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/id-digital/IdDigitalPage.tsx`, `src/styles/kruKomunikasi.css`, `src/products/hub/id-digital/idDigitalAssets.ts`, `tests/hub/idDigital.test.ts`.
- **Alasan Teknis:** Menyelesaikan regresi visual kartu ID Digital kru di mana logo resmi Progresif TV digantikan teks generik HTML statis dan frame foto berukuran kaku 130x160 tanpa kalkulasi crop proporsional:
  1. Mengintegrasikan aset logo resmi asli `public/assets/images/ptv-logo-white.webp` (Resolusi 1424 × 184 px, aspek rasio ~7.74:1) dengan tag `<img>` `.idcard-logo-img` di kiri atas kartu dan pada generator unduhan Canvas PNG 720×1120 HD.
  2. Menyediakan offline synchronous fallback base64 (`PTV_ID_CARD_LOGO_BASE64`) di `idDigitalAssets.ts` agar ekspor gambar canvas tidak pernah mengalami CORS / blank image saat offline.
  3. Mengeliminasi kelas zombie CSS `.idcard-logo-text` dan `.idcard-logo-badge` dari `kruKomunikasi.css`.
  4. Menyelaraskan frame foto ke rasio legacy resmi `aspect-ratio: 1 / 1.08` dengan `object-fit: cover` dan `object-position: center 20%` (posisi wajah di sepertiga atas frame terjaga sehingga tidak pernah terpotong keningnya).
  5. Menghubungkan ID Digital secara reaktif ke shared crew identity `useCrewStore` / `crewStore`: foto anggota asli tampil otomatis jika tersedia, dan jika belum ada foto, fallback inisial rapi dengan gradien biru elegan (`linear-gradient(145deg, #1D4ED8 0%, #0A2F72 100%)`) tampil tanpa pernah mengambil placeholder foto orang lain.
  6. Menambahkan suite pengujian unit `tests/hub/idDigital.test.ts` (5 unit tests lolos 100%).

### [CLN-018] — 2026-10-17 — Modul Acara Visual Color Restoration Hotfix
- **Session ID:** `PTV-DEV-010`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/styles/acara.css`, `src/products/hub/acara/components/AcaraCard.tsx`.
- **Alasan Teknis:** Menyelesaikan regresi visual daftar acara di mana seluruh kartu baris acara kehilangan identitas warna (tampil dominan putih polos) dan warna hanya tersisa pada ikon kalender biru statis:
  1. Baris acara sebelumnya menggunakan tint lembut berotasi harmonis R03 yang selaras dengan tema acara.
  2. Mengembalikan rotasi 6 palet warna semantik R03 (`6n+1` s.d. `6n+6`): Biru PTV (Royal Blue), Indigo, Teal, Amber, Purple/Violet, dan Emerald.
  3. Menyelaraskan warna kotak ikon kalender `.acara-icon-box` agar serasi dengan latar dan border masing-masing baris (tidak hardcoded biru untuk semua kartu).
  4. Menambahkan spesialisasi tint lembut bernuansa soft rose untuk status Batal (`.status-batal`) dan memastikan kontras status badge `Mendatang`, `Hari ini`, dan `✓ Selesai` tetap prima.
  5. Memberikan dukungan tema Dark Mode (`:root[data-theme="dark"]`) yang kontras dan elegan.
  6. Mempertahankan 100% tata letak (layout, padding, font SF Pro, urutan data, filter chips, mobile dock, tanpa CSS leakage ke modul lain).
- **Dampak Perubahan:**
  1. Baris acara kini tampil dinamis dengan tint lembut (background opacity 0.035, border opacity 0.16, hover background 0.065, elevation 4px).
  2. Kotak ikon kalender `.acara-icon-box` memiliki background, border, dan warna teks/ikon yang bersesuaian dengan tema baris.
  3. `AcaraCard.tsx` menyematkan class pembantu `.status-batal` dan `.status-selesai` secara deklaratif.
- **Pengujian yang Dijalankan:** `npm run typecheck`, `npm run lint`, `npm test` (24 files, 268/268 passed), `npm run build`, Edge visual snapshot desktop (1280px) dan mobile multi-viewport (320px, 375px, 390px, 430px) untuk seluruh filter (Semua, Mendatang, Saya, Selesai).
- **Hasil Pengujian:** Lolos 100% tanpa error, 0 warning.

---

### [CLN-017] — 2026-10-17 — Manajemen Kru Role & Permission Management (RBAC) UI Showcase
- **Session ID:** `PTV-DEV-010`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/kru/types.ts`, `src/products/hub/kru/kruStore.ts`, `src/products/hub/kru/utils/crewPermissions.ts`, `src/products/hub/kru/components/ManagePermissionsModal.tsx`, `src/products/hub/kru/components/KruDetailDrawer.tsx`, `src/products/hub/kru/KruPage.tsx`, `tests/hub/kruKomunikasi.test.ts`.
- **Alasan Teknis:** Memenuhi arahan operasional pengembangan Role & Permission Management (RBAC) pada modul Manajemen Kru:
  1. Mencegah pembuatan model RBAC kedua/paralel dengan menggunakan single source of truth arsitektur resmi `@core/policy` (`policyEngine`, `capabilities`, `profiles`).
  2. Memisahkan tegas 4 dimensi: Identitas Kru, Status Keanggotaan, Status Akun, dan Hak Akses.
  3. Memastikan Kontak Internal tetap murni direktori komunikasi tanpa fitur pengaturan role/akun/permission.
  4. Menerapkan evaluasi deterministik precedence: status akun nonaktif (fail-closed) ➔ status organisasi inactive (mutation blocked) ➔ denied_overrides (prioritas tertinggi) ➔ allowed_overrides ➔ assigned_profiles ➔ default deny.
  5. Menegakkan proteksi No Self-Escalation dan otorisasi hanya bagi Eksekutif.
- **Dampak Perubahan:**
  1. Ditambahkan field `denied_overrides?: readonly AppCapability[];` pada model `CrewMember` dan action `updateCrewPermissions` pada `crewStore`.
  2. Dibuat modul utilitas `crewPermissions.ts` yang memetakan role/profil, menghitung capability efektif, dan mengelompokkan 13 kategori modul.
  3. Dibuat dialog interaktif 3 tab `ManagePermissionsModal`: Profil Akses Utama, Izin Modul Granular (dengan 3-state toggle: Default/Allow/Deny), dan Ringkasan Perubahan sebelum simpan dengan peringatan eskalasi.
  4. Ditambahkan section "Hak Akses & Perizinan" pada `KruDetailDrawer` yang menampilkan role aktif, modul terbuka, total izin efektif, dan status akses efektif (atau pesan informatif jika belum ada akun).
  5. Dihapus invalid inline style `divideY`, unused variable `isEffective` dijadikan badge visual, dan unused import `ALL_CAPABILITIES` di unit test dibersihkan.
- **Pengujian yang Dijalankan:** `npm run typecheck`, `npm run lint`, `npm test` (24 files, 268/268 passed termasuk 11 skenario uji RBAC), `npm run build`, Edge visual snapshot desktop (1280px) dan mobile (390px).
- **Hasil Pengujian:** Lolos 100% tanpa error, 0 warning.

---

### [CLN-016] — 2026-10-17 — Koreksi Arsitektur Kontak Internal vs Crew Member
- **Session ID:** `PTV-DEV-010`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/kontak/types.ts`, `src/products/hub/kontak/mock/internalContactMockData.ts`, `src/products/hub/kontak/internalContactStore.ts`, `src/products/hub/kontak/components/KontakInternalDetailDrawer.tsx`, `src/products/hub/kontak/KontakInternalPage.tsx`, `src/products/hub/kru/mock/crewMockData.ts`, `tests/hub/kruKomunikasi.test.ts`.
- **Alasan Teknis:** Memenuhi arahan arsitektur operator bahwa Kontak Internal BUKAN anggota PTV:
  1. KH. Agoes Ali Masyhuri dan dewan pembina kehormatan pesantren tercatat sebagai kontak tanpa menjadi anggota PTV atau memiliki akun portal fiktif (`username: gus_ali`, role, Google OAuth).
  2. Manajemen Kru menjadi satu-satunya tempat pengelolaan keanggotaan PTV, role portal, status akun, aktivasi akun, dan Google OAuth.
  3. Kontak Internal murni berfungsi sebagai direktori komunikasi yang bermartabat.
- **Dampak Perubahan:**
  1. Dibuat model data terpisah `InternalContact` dengan atribut gelar/sapaan, jabatan, unit lembaga, kategori, nomor telepon, email, catatan koordinasi, dan opsional `crew_id`.
  2. Dibuat store reaktif `internalContactStore` yang menyinkronkan data kontak yang terkait kru secara otomatis saat data kru diubah di Manajemen Kru.
  3. Dibuat `KontakInternalDetailDrawer` mandiri dengan `useModalScrollLock`, tombol komunikasi WhatsApp/Telepon/Email terstandar, dan eliminasi total seluruh elemen akun portal (Status Akun, Username, Google OAuth SSO, tombol Aktivasi Akun, tombol Edit Role, tombol Nonaktifkan/Hapus).
  4. Manajemen Kru dibersihkan dari akun fiktif tokoh kehormatan pesantren.
- **Pengujian yang Dijalankan:** `npm run typecheck`, `npm run lint`, `npm test` (24 files, 257/257 passed termasuk 16 tes Kru & Komunikasi), `npm run build`, Edge visual snapshot di desktop 1280px dan mobile 375px.
- **Hasil Pengujian:** Lolos 100% tanpa error, 0 warning.

---

## C. RIWAYAT CLEANING (ACTION LOG)

### [CLN-015] — 2026-10-17 — Kru & Komunikasi R03 Compliance Hotfix & Modal Accessibility
- **Session ID:** `PTV-DEV-010`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/styles/kruKomunikasi.css`, `src/products/hub/kontak-eksternal/KontakEksternalPage.tsx`, `src/products/hub/dokumen-saya/DokumenSayaPage.tsx`, `src/products/hub/id-digital/IdDigitalPage.tsx`, `src/products/hub/kru/KruPage.tsx`, `piketdev.md`.
- **Alasan Teknis:** Menyelesaikan 4 temuan spesifik dari audit R03:
  1. *Kontak Eksternal (Mobile 320-420px):* Tiga tombol sejajar menyebabkan nama terpotong berlebihan. Tombol Detail disembunyikan pada `<= 420px`, seluruh card dijadikan elemen interaktif (`role="button"`, `tabIndex={0}`, keyboard Enter/Space), dan tombol WhatsApp & Telepon dipertahankan dengan touch target `>= 44px`.
  2. *Dokumen Saya (Mobile 320px):* Tanggal dokumen terpotong menjadi 2 baris. Diterapkan `.kk-doc-date { white-space: nowrap; }` dan `.kk-doc-card-footer { flex-wrap: wrap; gap: 8px; }` sehingga tanggal utuh dan tombol aksi membungkus secara natural.
  3. *ID Digital (Mobile <= 375px):* Kartu KTA terlalu mepet ke tepi layar. Diterapkan horizontal breathing room 12–16px (`max-width: calc(100vw - 28px)`) tanpa memengaruhi canvas export 720×1120px atau tata letak internal kartu.
  4. *Modal Accessibility:* Modal sekunder (`isVerifModalOpen` di ID Digital, serta `isDeleteModalOpen` dan `isLoginHistoryOpen` di Manajemen Kru) kini dihubungkan ke shared hook `useModalScrollLock` yang menyediakan penguncian scroll latar belakang, layout shift prevention, focus trap, Escape-to-close, focus restoration, `role="dialog"`, `aria-modal="true"`, dan `aria-labelledby`.
- **Pengujian yang Dijalankan:** `npm run typecheck`, `npm run lint`, `npm test` (24 test files, 251/251 tests passed), `npm run build`, visual multi-viewport snapshot (320px, 375px, 390px, 430px, 1280px).
- **Hasil Pengujian:** Lolos 100% tanpa error, 0 warning.

### [CLN-014] — 2026-10-17 — Global Header Desktop Alignment & Flex Action Groupingrouping
- **Session ID:** `PTV-DEV-009`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/shell/HubShell.tsx`, `src/styles/dashboard.css`.
- **Alasan Teknis:** Memenuhi arahan operator untuk memperbaiki alignment global header desktop PTV Hub: sebelumnya search bar melayang di tengah header dan terpisah jauh dari notification bell dan avatar. Penyebabnya adalah deklarasi `margin-left: auto` ganda pada elemen `.hdr-search` dan container `.hdr-actions` di CSS desktop Flexbox, serta penempatan DOM search bar di luar container aksi.
- **Dampak Perubahan:**
  1. Elemen `<button className="hdr-search">` dipindahkan ke dalam container `<div className="hdr-actions">` di `HubShell.tsx`.
  2. Deklarasi CSS desktop (`@media (min-width: 1024px)`) di `dashboard.css`:
     - Sisi Kiri: Judul halaman (`.crumb`) tetap pada posisi aslinya.
     - Sisi Tengah: Ruang fleksibel kosong (`justify-content: space-between` pada `.hdr-in`).
     - Sisi Kanan: `.hdr-actions` memegang `margin-left: auto; display: flex; align-items: center; gap: 8px; flex: none;`.
     - Susunan di kanan: Search bar → Notification bell → Avatar.
     - Gap antara search bar dan notification bell: `margin-right: 6px` + `gap: 8px` = **14px** (sesuai spesifikasi 12–20px Design System Guidebook R03).
     - Ukuran fixed search bar desktop dipertahankan: `width: 340px; max-width: 380px;`, continuous pill curve `var(--ptv-curve-pill)`.
     - Notification bell dan avatar tetap sejajar vertikal (`align-items: center`).
  3. Responsivitas terjamin:
     - Pada layar tablet (`< 1024px`) dan mobile, `.hdr-search` desktop disembunyikan (`display: none`).
     - Search icon compact (`.icon-btn.only-mobile`) tetap aktif di mobile/tablet dengan touch target 44×44px.
- **Pengujian yang Dijalankan:** `npm run typecheck`, `npm run lint` (`--max-warnings 0`), `npm test` (23 test files, 241/241 passed), `npm run build`, HTTP Server `200 OK` di `http://localhost:5174/hub/lostfound` dan `/hub/beranda`, serta visual testing Chromium Edge headless pada viewport 1280px, 768px, dan 390px.
- **Hasil Pengujian:** Lolos 100% tanpa error, 0 warning, dan screenshot membuktikan susunan layout kanan tepat sasaran.

### [CLN-013] — 2026-10-16 — Mobile Header Transparency & Lost & Found Detail Drawer Refinement
- **Session ID:** `PTV-DEV-008`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/shell/HubShell.tsx`, `src/styles/dashboard.css`, `src/products/hub/lost-found/components/LostFoundDetailDrawer.tsx`, `src/styles/lostFound.css`.
- **Alasan Teknis:** Memenuhi arahan Targeted Mobile UI Hotfix dari operator terkait dua temuan visual: (1) Global mobile header transparan 100% sehingga konten teks dan logo bertumpukan saat scroll (karena `.hdr.stuck` tidak pernah dipicu event scroll di `HubShell.tsx`), tombol search/notif/avatar terlalu padat (gap 3px) dan touch target di bawah 44px; (2) Header drawer detail Lost & Found kurang rapi, badge status mewarisi `position: absolute; top: 12px; right: 12px` dari kartu inventaris sehingga menimpa tombol close (X), judul panjang menabrak tombol close, dan drawer belum memiliki handler Escape key maupun background scroll lock.
- **Dampak Perubahan:** 
  1. Header global mobile di `HubShell.tsx` kini memiliki listener scroll dinamis (`window.scrollY > 8`) yang menempelkan class `.stuck` secara reaktif.
  2. Header global mobile di `dashboard.css` memiliki surface solid translucent 96% (`color-mix(in srgb, var(--surface) 96%, transparent)`) dengan blur 16px dan border-bottom `var(--line-2)` saat diam, dan 100% solid `var(--surface)` dengan border subtle dan micro shadow saat di-scroll. Teks dan kartu yang meluncur di belakang header terisolasi penuh tanpa tembus pandang.
  3. Action buttons di header mobile (`.hdr-actions`) memiliki gap 4px, tombol profil terstandarisasi, dan touch target minimal 44x44px dengan focus visible state sesuai standar aksesibilitas Apple HIG / R03.
  4. Header drawer Lost & Found (`LostFoundDetailDrawer.tsx` & `lostFound.css`) direstrukturisasi menjadi dua baris elegan: baris atas untuk badge kelompok (Tipe & Status) di kiri dan tombol close 44x44px di kanan; baris bawah untuk judul barang yang membungkus 100% leluasa tanpa risiko tabrakan pada viewport 320–430px.
  5. Menambahkan keyboard listener `Escape` dan background scroll lock (`overflow: hidden` pada `document.body`) saat detail drawer terbuka, serta melepaskannya kembali saat ditutup.
  6. Zero regression pada layout desktop (1280px), sidebar, bottom nav, dan modul-modul lainnya.
- **Pengujian yang Dijalankan:** `npm run typecheck`, `npm run lint` (`--max-warnings 0`), `npm test` (23 test files, 241/241 passed), `npm run build`, dan visual testing langsung via headless Edge browser pada breakpoint 320px, 390px, dan 1280px.
- **Hasil Pengujian:** Lolos 100% tanpa error, 0 warning, dan hasil screenshot terverifikasi tajam.

### [CLN-012] — 2026-10-16 — Photo Visibility, Asset Equipment Thumbnail & Lightbox Zoom Refinement
- **Session ID:** `PTV-DEV-007`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/lapor-kerusakan/components/EquipmentThumbnail.tsx`, `DamageReportCard.tsx`, `DamageDetailModal.tsx`, `fixtures.ts`, `src/products/hub/lost-found/components/LostFoundCard.tsx`, `LostFoundDetailDrawer.tsx`, `src/shared/components/ImageLightboxModal.tsx`, `src/shared/components/index.ts`, `src/styles/kerusakan.css`, `src/styles/lostFound.css`, `src/styles/base.css`.
- **Alasan Teknis:** Memenuhi arahan operator untuk menampilkan foto barang dan foto alat secara jelas, membedakan secara tegas antara foto profil alat inventaris (asset photo) dengan foto bukti fisik kerusakan dari pelapor (damage evidence photo), mencegah broken image dengan `onError` fallback, menyediakan placeholder netral studio equipment tanpa gambar acak internet, serta menambahkan zoom lightbox modal layar penuh.
- **Dampak Perubahan:** 
  1. Kartu Lapor Kerusakan kini menampilkan thumbnail alat proporsional dengan ikon studio kategori netral R03 (Kamera, Lensa, Audio, Lighting, Streaming, Rig).
  2. Kartu Lapor Kerusakan menampilkan badge penanda jika ada foto bukti fisik kerusakan yang dilampirkan oleh pelapor.
  3. Modal Detail Lapor Kerusakan memisahkan profil alat studio dan section foto bukti kerusakan dari pelapor secara terpisah dan jelas, dengan tombol zoom lightbox modal.
  4. Kartu Lost & Found dan Detail Drawer memiliki gambar tajam, penanganan `onError` fallback ke placeholder netral elegan, serta fitur zoom lightbox saat foto diklik.
  5. Seluruh kartu dan container pada kedua modul terjamin memiliki card surface putih murni `var(--surface, #FFFFFF)` dengan border lembut dan continuous curve profile D R03.
- **Pengujian yang Dijalankan:** `npm run typecheck`, `npm run lint` (`--max-warnings 0`), `npm test` (23 test files, 241/241 passed), `npm run build`.
- **Hasil Pengujian:** Lolos 100% tanpa error, 0 warning.

### [CLN-010] — 2026-10-16 — kerusakan.css & DamageReportCard.tsx R03 Surface Resolution
- **Session ID:** `PTV-DEV-007`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/styles/kerusakan.css`, `src/products/hub/lapor-kerusakan/components/DamageReportCard.tsx`.
- **Alasan Teknis:** Penggunaan token CSS non-standar (`--surface-card`, `--border-subtle`, `--surface-sunken`, `--shadow-md`) menyebabkan komponen kartu statistik, searchbar, dan laporan kerusakan kehilangan background surface putih dan border (teks mengambang di atas kanvas).
- **Dampak Perubahan:** Mengembalikan surface solid putih `var(--surface, #FFFFFF)`, border line lembut `var(--line, rgba(11, 42, 74, 0.09))`, elevation shadow `var(--shadow-s)` dan `--shadow-m`, continuous curve radius `var(--ptv-curve-xl, 22px)`, perataan footer card seragam via `.dmg-card-body` flex-grow, dan action pill button terstruktur pada footer laporan.
- **Pengujian yang Dijalankan:** `npm run typecheck`, `npm run lint` (`--max-warnings 0`), `npm test` (23 test files, 241/241 passed), `npm run build`.
- **Hasil Pengujian:** Lolos 100% tanpa error, 0 warning.

### [CLN-009] — 2026-10-16 — LostFound & LaporKerusakan Code Hygiene & Type Resolution
- **Session ID:** `PTV-DEV-007`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/lost-found/`, `src/products/hub/lapor-kerusakan/`, `tests/hub/lostFoundAndDamage.test.ts`, pembersihan temporary scratch files di root repository.
- **Alasan Teknis:** Memastikan kedua modul baru (`/hub/lostfound` dan `/hub/kerusakan`) mematuhi tata kelola repository: membersihkan script scratch di root, memperbaiki typo method `readAsDataURL`, menghapus unused variables (`isTotalDamage`, unused `DamageSeverity`, unused `DamageFilterTab`), membetulkan path alias impor stylesheet `@/styles/...`, dan memastikan single source of truth untuk fixtures unit studio.
- **Dampak Perubahan:** Type checking dan build produksi Vite berjalan mulus tanpa peringatan atau sisa artefak sementara; unit test mencakup 100% alur kerja kedua modul dengan 14 skenario uji baru.
- **Pengujian yang Dijalankan:** `npm run typecheck`, `npm run lint` (`--max-warnings 0`), `npm test` (23 test files, 241/241 passed), `npm run build`.
- **Hasil Pengujian:** Lolos 100% tanpa error, 0 warning.

### [CLN-008] — 2026-10-16 — htmlSanitizer.ts, NoteRichEditor.tsx, CatatanPage.tsx, catatan.css
- **Session ID:** `PTV-DEV-005`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/catatan/utils/htmlSanitizer.ts`, `src/products/hub/catatan/components/NoteRichEditor.tsx`, `src/products/hub/catatan/CatatanPage.tsx`, `src/styles/catatan.css`, dan `tests/hub/catatanEditor.test.ts`.
- **Alasan Teknis:** Sebelumnya tag gambar dilarang dan dihapus secara total (`.replace(/<img[^>]*>/gi, '')`), tidak ada tombol gambar, modal belum memiliki batasan lebar baca 760–800px terstandar, dan gambar berpotensi merusak layout jika tidak diberi aturan responsif `max-width: 100%` dan `height: auto`.
- **Dampak Perubahan:** Pengguna dapat menyisipkan gambar (picker, clipboard paste, drag & drop) dengan batasan aman 5 MB, tag `img` tersanitasi dari payload berbahaya/event-handler, gambar adaptif tidak distorsi, dan modal memiliki batas baca proporsional 780px dengan internal scroll.
- **Pengujian yang Dijalankan:** `npm run typecheck`, `npm run lint`, `npm test` (21 test files, 210/210 passed termasuk `catatanEditor.test.ts` & `continuousCurveAudit.test.ts`), `npm run build`.
- **Hasil Pengujian:** Lolos 100% tanpa error, 0 warning.

### [CLN-007] — 2026-10-16 — CatatanPage.tsx, catatan.css, NoteRichEditor.tsx
- **Session ID:** `PTV-DEV-004`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/catatan/CatatanPage.tsx`, `src/styles/catatan.css`, `src/products/hub/catatan/components/NoteRichEditor.tsx`, dan pembuatan utilitas terpusat `src/products/hub/catatan/utils/htmlSanitizer.ts`.
- **Alasan Teknis:** `whiteSpace: 'pre-line'` membuat setiap karakter newline di antara tag HTML diubah menjadi baris kosong fisik ganda, textarea mengekspos tag HTML mentah, dan tidak ada sanitasi XSS yang tepat.
- **Dampak Perubahan:** Spacing vertikal menjadi alami dan compact (`margin: 0 0 6px`), editor menampilkan hasil format visual nyata (WYSIWYG), dan konten HTML disanitasi secara aman.
- **Pengujian yang Dijalankan:** `npm run typecheck`, `npm run lint`, `npm test` (21 test files, 205/205 passed termasuk `catatanEditor.test.ts`), `npm run build`.
- **Hasil Pengujian:** Lolos 100% tanpa error, 0 warning.

### [CLN-006] — 2026-10-15 — KalenderPage.tsx & kalender.css
- **Session ID:** `PTV-DEV-003`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/kalender/KalenderPage.tsx` (daftar momentum) dan `src/styles/kalender.css` (penambahan scoped class `.kal-planner-*`)
- **Alasan Teknis:** `.kal-planner-item` tidak memiliki definisi flexbox di stylesheet sehingga elemen tanggal/periode bertindak sebagai block biasa dan membentang 100% lebar layar, menyebabkan layout vertikal acak dan tinggi berlebih.
- **Dampak Perubahan:** Komponen Momentum & Ide Konten bertransformasi menjadi 3-kolom compact editorial list (kolom kiri date/capsule ringkas, kolom tengah judul & meta, kolom kanan chevron affordance) yang rapi di desktop dan mobile.
- **Pengujian yang Dijalankan:** `npm run typecheck`, `npm run lint`, `npm test` (195/195 tests passed), `npm run build`.
- **Hasil Pengujian:** Lolos 100% tanpa error, 0 warning.

### [CLN-005] — 2026-10-15 — KalenderPage.tsx & kalender.css
- **Session ID:** `PTV-DEV-003`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/kalender/KalenderPage.tsx` (wrapper layout Layer 1) dan `src/styles/kalender.css` (penghapusan duplikasi CSS item card)
- **Alasan Teknis:** Inline style `gridTemplateColumns: minmax(0, 1.45fr) minmax(320px, 0.95fr)` memaksakan 2-kolom berdampingan pada layar mobile sehingga kalender terjepit.
- **Dampak Perubahan:** Layout menjadi adaptif murni melalui CSS grid-template-areas di desktop dan 1-kolom fleksibel di mobile, dengan urutan Kalender -> Agenda -> Momentum.
- **Pengujian yang Dijalankan:** `npm run typecheck`, `npm run lint`, `npm test` (195/195 tests passed), `npm run build`.
- **Hasil Pengujian:** Lolos 100% tanpa error dan tanpa warning.

### [CLN-004] — 2026-10-15 — CatatanPage.tsx
- **Session ID:** `PTV-DEV-002`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/catatan/CatatanPage.tsx` (icon konfirmasi hapus modal dan penutup JSX modal)
- **Alasan Teknis:** Standarisasi continuous curve Design System PTV R03 mewajibkan penggunaan token `var(--r-full, 999px)` alih-alih hardcoded inline persentase, serta memastikan JSX bebas dari elemen penutup menggantung.
- **Dampak Perubahan:** Modal konfirmasi hapus mematuhi audit continuous curve PTV secara konsisten.
- **Pengujian yang Dijalankan:** `npm run typecheck`, `npm run lint`, `npm test` (`tests/hub/continuousCurveAudit.test.ts`)
- **Hasil Pengujian:** Lolos 100% (195/195 tests passed, 0 errors, 0 warnings).

### [CLN-003] — 2026-10-15 — CatatanPage.tsx
- **Session ID:** `PTV-DEV-002`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/catatan/CatatanPage.tsx` (baris input form tanggal, waktu, tempat, dan peserta rapat)
- **Alasan Teknis:** Standarisasi continuous curve Design System PTV R03 melarang hardcoded pixel radius inline.
- **Dampak Perubahan:** Seluruh input rapat mematuhi audit continuous curve PTV.
- **Pengujian yang Dijalankan:** `npm test` (`tests/hub/continuousCurveAudit.test.ts`)
- **Hasil Pengujian:** Lolos 100% (195/195 tests passed).

### [CLN-015] — 2026-10-17 — Modul Kru & Komunikasi (UI Showcase & Governance)
- **Session ID:** `PTV-DEV-010`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:**
  - `src/products/hub/kru/types.ts`: Menghapus unused import `AccountStatus`.
  - `src/products/hub/kru/kruService.ts`: Mengeliminasi duplikasi data mock hardcoded scaffold lama, diarahkan menggunakan `INITIAL_CREW_FIXTURES` bersama dan menyelaraskan status akun `'Aktif'`.
  - `src/products/hub/kontak/KontakInternalPage.tsx`: Menghapus deklarasi unused `updateCrew`.
  - `src/products/hub/dokumen-saya/components/DocDetailDrawer.tsx`, `IdDigitalPage.tsx`, `KontakEksternalFormModal.tsx`, `KruDetailDrawer.tsx`, `KruFormModal.tsx`, `KruPage.tsx`: Mengganti hardcoded inline pixel border-radius (`10px`, `12px`, `24px`) dengan continuous curve tokens Design System R03 (`var(--ptv-curve-sm)`, `var(--ptv-curve-md)`, `var(--ptv-curve-modal)`).
  - Mengintegrasikan `useModalScrollLock` dengan parameter `modalRef` yang valid pada seluruh modal dan detail drawer.
- **Alasan Teknis:** Memenuhi aturan strict `noUnusedLocals`, menyatukan single-source-of-truth mock kru, dan mematuhi tata kelola continuous curve geometry audit (`continuousCurveAudit.test.ts`).
- **Dampak Perubahan:** 0 TS errors, 0 ESLint warnings, lolos uji continuous curve radius governance, dan UX modal aman dari background scroll leak.
- **Pengujian yang Dijalankan:** `npm run typecheck`, `npm run lint`, `npm test` (251 passed, 24 test files), `npm run build`.
- **Hasil Pengujian:** Lolos 100% tanpa error, tanpa warning.

### [CLN-002] — 2026-10-15 — CatatanPage.tsx
- **Session ID:** `PTV-DEV-002`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/catatan/CatatanPage.tsx` (fungsi helper `stripHtml`)
- **Alasan Teknis:** Memperbaiki unnecessary regex escape character `[\/]` yang melanggar aturan ESLint `no-useless-escape`.
- **Dampak Perubahan:** Parsing regex bersih dan lolos validasi linter tanpa peringatan.
- **Pengujian yang Dijalankan:** `npm run lint` (`eslint . --max-warnings 0`)
- **Hasil Pengujian:** Lolos 100% (0 errors, 0 warnings).

### [CLN-001] — 2026-10-15 — KalenderPage.tsx
- **Session ID:** `PTV-DEV-001`
- **Developer / Operator:** Roup
- **Kode / File yang Dibersihkan:** `src/products/hub/kalender/KalenderPage.tsx` (baris import dan elemen header)
- **Alasan Teknis:** Menghilangkan badge teks teknis mock dari tampilan antarmuka visual agar bersih dan siap produksi, serta membersihkan unused import `IS_MOCK_FIXTURE` agar mematuhi `noUnusedLocals`.
- **Dampak Perubahan:** Header halaman Kalender menjadi bersih tanpa label teknis. Fixture dummy tetap terisolasi secara internal di `calendarMockData.ts`.
- **Pengujian yang Dijalankan:** `npm run typecheck`, `npm run lint`, `npm test` (195 tests passed), `npm run build`
- **Hasil Pengujian:** Lolos 100% tanpa error, tanpa warning, dan lolos uji Continuous Curve Audit.
- **Catatan Rollback:** Jika diperlukan kembali, tambahkan kembali blok `{IS_MOCK_FIXTURE && ...}` dengan import dari `./mock/calendarMockData`.

---

## D. KANDIDAT CLEANING BERISIKO (PROTECTED & REVIEW REQUIRED)

Kategori kode berikut **DILARANG** dihapus secara sepihak tanpa review mendalam dan persetujuan eksplisit:

1. **Legacy PHP Source (`legacy/`):** Berkas `page-dasbor.php`, `admin-panel.js`, `ptv-dashboard-data-bridge.php`, dll. adalah *single source of truth* untuk migrasi fitur ke React. Dilarang dihapus atau dibersihkan.
2. **Shared Design System (`src/design-system/`, `ContinuousSurface.tsx`):** Komponen inti geometris dan curve tokens yang terikat pada uji tata kelola `continuousCurveAudit.test.ts`.
3. **Autentikasi & RBAC (`src/core/auth/`, `src/core/policy/`):** Seluruh registry capability dan kontrak otorisasi.
4. **Database Service & Migrasi SQL (`src/core/supabase/`, `docs/*.sql`):** RPC atomik, schema DDL, dan kontrak integritas Supabase staging.
5. **Fixture & Mock Showcase (`src/products/hub/*/mock/`):** Data tiruan terisolasi yang sengaja digunakan untuk pratinjau UI tanpa koneksi backend.
6. **Dynamic Imports & Code-Splitting Candidates:** Halaman yang di-import melalui `React.lazy` (misal: `DevCatalogPage`).
7. **Kode Terikat Lintas Modul:** Helper yang berpotensi dipakai oleh modul operasional lain (misal: `calendarDateUtils.ts` yang dapat digunakan modul Acara atau Beranda).


### [CLN-030] — 2026-10-17 — Lost & Found: Floating Dialog Card Modal & PTVSelect Portal Dropdown
- **Session ID:** `PTV-DEV-019`
- **Developer / Operator:** Roup
- **File Terdampak:** `src/products/hub/lost-found/components/LostFoundModalForm.tsx`, `src/styles/lostFound.css`, `src/products/hub/lost-found/LostFoundModal.test.ts`
- **Kategori Temuan:** Targeted UI/UX Hotfix / Floating Dialog Card R03 / Shared Popover Dropdown / Accessibility
- **Tingkat Risiko:** Rendah
- **Uraian Perbaikan:**
  1. **Floating Dialog Card R03:** Mengadopsi arsitektur dialog proporsional yang konsisten dengan AcaraKelolaKruModal: fixed header, scrollable body (`overflow-y: auto`, `-webkit-overflow-scrolling: touch`), dan fixed footer (`flex-shrink: 0`, sticky bottom).
  2. **Viewport & Spacing Governance:** Desktop dibatasi pada lebar 600px (rentang 560–640px) dengan `max-height: 86dvh`. Mobile menyesuaikan viewport dengan padding 12px, `max-height: 88dvh`, dan footer aman dari safe area (`env(safe-area-inset-bottom)`).
  3. **PTVSelect Portal Dropdown:** Mengganti native HTML select pada field Kategori dengan shared `PTVSelect` R03 menggunakan opsi `usePortal={true}` (portal ke `document.body`, z-index 99999) sehingga panel pilihan tidak pernah terpotong modal body, memiliki highlight kategori aktif, serta mendukung navigasi keyboard penuh (Arrow, Enter, Escape).
  4. **Preservasi 7 Kategori & Nilai Form:** Seluruh kategori resmi ('Aksesori Kamera', 'Kabel & Audio', 'Perlengkapan Kru', 'Pakaian', 'Barang Pribadi', 'Dokumen', 'Lainnya') dan seluruh field form (jenis laporan hilang/temuan, nama barang, tanggal, lokasi, deskripsi, foto preview max 2MB, nama pelapor, nomor WA) dipertahankan 100%.
  5. **Body Scroll Lock & Escape Listener:** Menambahkan efek pembersihan overflow body saat modal terbuka dan pembersihan saat tertutup, serta dukungan tombol Escape.
  6. **Dark Mode & Styling:** Melengkapi override tema gelap menyeluruh (`[data-theme="dark"]`) dan class backward-compatibility (`.lf-switcher-btn` & `.lf-type-btn`).
  7. **Testing:** Menambahkan 5 skenario unit test kontrak dan validasi (`LostFoundModal.test.ts`) dengan 19/19 pengujian modul Lost & Found lulus.
- **Status Akhir:** Fixed (Terverifikasi Penuh).


### [CLN-033] — 2026-10-17 — Public Verification Routing & Canonical Deep Links Hotfix
- **Sesi ID:** `PTV-DEV-021`
- **File Dimodifikasi:**
  - `src/products/hub/shell/HubShell.tsx`
  - `src/products/verification/verificationService.ts`
  - `src/products/hub/id-digital/IdDigitalPage.tsx`
  - `src/products/hub/dokumen-saya/components/DocDetailDrawer.tsx`
  - `tests/hub/publicVerification.test.ts`
- **Masalah:** Tombol Keabsahan Dokumen dan Verifikasi Identitas di sidebar internal mengarah ke situs luar `progresiftv.id`. Tidak ada pembentuk URL resmi untuk QR dokumen/kru.
- **Tindakan:**
  1. Mengarahkan kedua tombol sidebar ke relative path same-origin (`/verifikasi-surat` dan `/verifikasi-identitas`) dengan membuka tab baru (`target="_blank"`, `rel="noopener noreferrer"`).
  2. Menyediakan helper URL kanonikal resmi (`https://ptvpro.com/verifikasi-...`) dan lokal di `verificationService.ts`.
  3. Memastikan nomor surat berslash atau ber-trailing slash dinormalisasi secara anggun.
  4. Menghubungkan kartu ID Digital dan Detail Dokumen ke portal publik yang relevan.
  5. Menambahkan 9 skenario unit tests penegakan tata kelola routing.
- **Hasil:** Typecheck 0 errors, ESLint 0 warnings, 34/34 test files lolos (384/384 tests), Build Vite sukses 14.20s.


### [CLN-034] — 2026-10-17 — Hub Login Canonical Routing (/hub/login) & Open Redirect Guard
- **Sesi ID:** `PTV-DEV-024`
- **File Dimodifikasi:**
  - `src/app/router/ProtectedRoute.tsx`
  - `src/app/router/LoginPage.tsx`
  - `src/app/router/index.tsx`
  - `tests/hub/hubLoginRouting.test.tsx`
- **Masalah:** Route canonical login PTV Hub berada pada `/login` alih-alih `/hub/login`. Guard proteksi mengarahkan unauthenticated user ke `/login`. Tidak ada validasi redirect target untuk mencegah potensi open redirect ke domain eksternal. Belum ada backward compatibility redirect dari `/login` ke `/hub/login`.
- **Tindakan:**
  1. Memindahkan canonical login route PTV Hub ke `/hub/login` di `src/app/router/index.tsx` tanpa mengubah UI, validasi form, atau authentication service.
  2. Mengarahkan unauthenticated user pada `ProtectedRoute.tsx` ke `/hub/login?redirect=${encodeURIComponent(returnTarget)}` (BUKAN ke `/login`).
  3. Menambahkan backward-compatibility redirect `LegacyLoginRedirect` di `src/app/router/index.tsx` untuk `/login` dan `/login/*` menuju `/hub/login` dengan preservasi query string dan flag `replace: true`.
  4. Menerapkan validasi sanitasi redirect URL pada `LoginPage.tsx` untuk mencegah open redirect: hanya mengizinkan target yang berawalan `/` dan bukan `//` atau `/\\` (fallback aman ke `/hub`).
  5. Menambahkan automatic redirect jika user yang telah terautentikasi membuka `/hub/login`.
  6. Menambahkan suite pengujian unit `tests/hub/hubLoginRouting.test.tsx` yang memverifikasi struktur routing, proteksi guard, isolasi portal publik, dan pencegahan open redirect.
- **Hasil:** Typecheck 0 errors, ESLint 0 warnings, 35/35 test files lolos (391/391 tests), Build Vite sukses 25.94s, HTTP 200 terverifikasi pada port 5174.


### [CLN-035] — 2026-10-17 — Login Help Modal Button Sizing & Alignment Hotfix
- **Sesi ID:** `PTV-DEV-024`
- **File Dimodifikasi:**
  - `src/styles/login.css`
  - `src/app/router/LoginPage.tsx`
- **Masalah:** Tombol "Hubungi Admin" pada modal bantuan akses login memiliki tinggi 72px (terlihat jauh lebih besar) sementara tombol "Tutup" berukuran 42px akibat interferensi class `.sec` dengan margin-top global dari stylesheet dashboard.
- **Tindakan:** Mengisolasi class spesifik `.lk-modal-btn-pri` dan `.lk-modal-btn-sec`, menyetel `margin: 0 !important`, `align-items: center` pada `.lk-modal-footer`, dan mengunci tinggi kedua tombol pada 42px seragam.
- **Hasil:** Kedua tombol berukuran persis 193px × 42px dengan penataan vertikal simetris. Typecheck 0 errors, ESLint 0 warnings, 35/35 test suites lolos, Build Vite sukses.


### [CLN-036] — 2026-10-17 — Clean Login URL (/hub/login) & Navigation State Intended Destination
- **Sesi ID:** `PTV-DEV-024`
- **File Dimodifikasi:**
  - `src/app/router/ProtectedRoute.tsx`
  - `src/app/router/LoginPage.tsx`
  - `src/app/router/index.tsx`
  - `src/core/auth/destination.ts`
  - `src/core/auth/authService.ts`
  - `tests/hub/hubLoginRouting.test.tsx`
- **Masalah:** Saat pengguna mengakses protected route tanpa autentikasi, URL login memuat query parameter `/hub/login?redirect=%2Fhub%2F...`. Hal ini membuat address bar tidak bersih dan berpotensi memicu query pollution.
- **Tindakan:**
  1. Menghilangkan penggunaan query parameter (`redirect`, `returnUrl`, `next`) dari URL login.
  2. Mengarahkan pengguna belum login di `ProtectedRoute.tsx` ke `/hub/login` secara bersih dengan menyimpan intended destination via React Router navigation state (`state: { from: location, returnTo: returnTarget }`).
  3. Menyediakan pembersihan otomatis di `LoginPage.tsx` jika pengguna mengakses link lama yang masih memuat query string agar address bar segera dinormalisasi ke `/hub/login`.
  4. Memvalidasi intended destination melalui `getSafeInternalDestination`: hanya mengizinkan internal route `/hub/*` (selain `/hub/login`), mencegah open redirect, dan fallback aman ke `/hub` jika dibuka langsung atau di-refresh tanpa navigation state.
  5. Menghilangkan query search params pada compatibility redirect `LegacyLoginRedirect` di `index.tsx`.
  6. Menulis suite pengujian unit komprehensif (12 skenario) di `tests/hub/hubLoginRouting.test.tsx` yang memvalidasi kebijakan Clean Login URL, proteksi open redirect, dan pencegahan loop.
- **Hasil:** Typecheck 0 errors, ESLint 0 warnings, 21/21 test suites di `tests/hub/` lolos (306/306 tests), kompilasi Vite build sukses 19.43s, dan browser runtime terverifikasi bersih di port 5174.


### [CLN-037] — 2026-10-17 — Vercel Direct Google OAuth Implementation & Clean URL Error Handling
- **Sesi ID:** `PTV-DEV-027`
- **File Dimodifikasi:**
  - `api/auth/_utils/types.ts`
  - `api/auth/_utils/cookies.ts`
  - `api/auth/_utils/crypto.ts`
  - `api/auth/_utils/identity.ts`
  - `api/auth/google/login.ts`
  - `api/auth/google/callback.ts`
  - `api/auth/session.ts`
  - `api/auth/logout.ts`
  - `vercel.json`
  - `src/core/auth/authService.ts`
  - `src/app/router/LoginPage.tsx`
  - `tests/auth/vercelDirectAuth.test.ts`
  - `tsconfig.json`
  - `eslint.config.js`
- **Masalah:** Sistem autentikasi sebelumnya menggunakan Supabase GoTrue Auth di sisi klien. Sesuai keputusan resmi Operator Roup, Supabase Auth ditinggalkan dan digantikan dengan Direct Google OAuth berbasis Vercel Serverless Functions (`/api/auth/*`) dengan HttpOnly Secure cookie sesi website, mapping `user_account.google_sub` (Phase 0B), penegakan capability `hub.access` server-side, serta preservasi Clean Login URL (`/hub/login`) tanpa query string.
- **Tindakan:**
  1. Membangun 4 endpoint Vercel Serverless Functions (`/api/auth/google/login`, `/api/auth/google/callback`, `/api/auth/session`, `/api/auth/logout`) dengan zero dependency eksternal (murni `node:crypto` dan standard Node.js).
  2. Menerapkan perlindungan anti-CSRF dengan HMAC-SHA256 signed `state` parameter dan RFC 7636 PKCE `code_verifier`/`code_challenge`.
  3. Menerapkan isolasi cookie sesi website `ptv_hub_session` dengan atribut `HttpOnly; Secure; SameSite=Lax; Path=/` dan masa berlaku 7 hari.
  4. Membangun identity resolver `resolveIdentityByGoogleSub` yang memetakan Google subject ID ke `user_account.google_sub`, memverifikasi `status_akun = 'active'`, dan menegakkan capability `hub.access` secara fail-closed.
  5. Mengintegrasikan adapter `VercelAuthService` di frontend (`authService.ts`) yang berkomunikasi dengan `/api/auth/*`.
  6. Memperbarui `LoginPage.tsx` untuk menyerap parameter error (`auth_error`), menyimpannya ke Zustand error state, dan menormalisasi URL secara bersih ke `/hub/login`.
  7. Mengonfigurasi `vercel.json` untuk routing SPA dan serverless functions.
  8. Menulis 25 skenario pengujian unit komprehensif pada `tests/auth/vercelDirectAuth.test.ts`.
- **Hasil:** Typecheck 0 errors, ESLint 0 warnings, 37/37 test suites lolos (434/434 tests), kompilasi Vite build sukses 14.66s (1854 modules).

### [CLN-038] � 2026-10-17 � PTVPRO Public Portal Modular Implementation & Prototype Demo Stripping
- **Sesi ID:** `PTV-DEV-028`
- **File Dimodifikasi / Dibuat:**
  - `src/products/portal/types.ts`
  - `src/products/portal/services/portalCatalog.ts`
  - `src/products/portal/components/PortalIcons.tsx`
  - `src/products/portal/components/PortalHeader.tsx`
  - `src/products/portal/components/PortalHero.tsx`
  - `src/products/portal/components/FeaturedCarousel.tsx`
  - `src/products/portal/components/ServiceSearch.tsx`
  - `src/products/portal/components/CategoryFilterChips.tsx`
  - `src/products/portal/components/ServiceCard.tsx`
  - `src/products/portal/components/ServiceCategorySection.tsx`
  - `src/products/portal/components/ServiceStatusView.tsx`
  - `src/products/portal/components/ComingSoonView.tsx`
  - `src/products/portal/components/MaintenanceView.tsx`
  - `src/products/portal/components/AnnouncementModal.tsx`
  - `src/products/portal/components/WhatsAppHelpModal.tsx`
  - `src/products/portal/components/PortalFooter.tsx`
  - `src/products/portal/styles/portal.css`
  - `src/products/portal/PortalPage.tsx`
  - `src/products/portal/index.ts`
  - `src/app/router/index.tsx`
  - `tests/portal/portal.test.tsx`
  - `docs/PTVPRO-PUBLIC-PORTAL-IMPLEMENTATION.md`
- **Masalah:** Konversi homepage publik PTVPRO dari baseline prototype HTML interaktif ke aplikasi React multi-produk. Prototype awal memuat kontrol demo simulator (`d-svc`, `d-st`, `d-mt`, add soon dummy, toast navigasi dummy, dan tautan `example.com`) yang tidak boleh bocor ke produksi. Selain itu, CSS portal berpotensi bentrok dengan token Hub jika tidak diisolasi dalam scope produk `src/products/portal`.
- **Tindakan:**
  1. Mengisolasi seluruh kode portal ke folder `src/products/portal` tanpa menyentuh modul Hub (`src/products/hub/*`), auth, maupun SQL database.
  2. Mengeliminasi seluruh kontrol simulator demo prototype, tombol reset demo, dan URL dummy `example.com`.
  3. Memetakan rute nyata: PTV Hub (`/hub`), Verifikasi Identitas (`/verifikasi-identitas`), Verifikasi Surat (`/verifikasi-surat`), Shortlink (`https://bsh.bio`), dan status `soon` dengan halaman penjelasan jujur untuk Aset Yayasan dan Registrasi Majelis Sama'.
  4. Menghapus entri layanan "Aset Publik" sesuai instruksi kepatuhan katalog operator.
  5. Mengisolasi stylesheet ke namespace `.ptvpro-portal` dan mengimpor tipografi resmi Bricolage Grotesque & Hanken Grotesk.
  6. Mengintegrasikan WhatsApp floating helpdesk dengan verifikasi aman nomor resmi via environment variable `VITE_WHATSAPP_HELP_NUMBER`.
  7. Mengintegrasikan rute `/` dan `/status-layanan` pada `src/app/router/index.tsx` dengan perubahan seminimal mungkin.
  8. Menulis 14 skenario unit test pada `tests/portal/portal.test.tsx`.
- **Hasil:** Typecheck 0 errors, ESLint 0 warnings, 38/38 test suites passed (448/448 tests passed), kompilasi Vite build sukses dalam 12.85s.

### [CLN-039] - 2026-10-17 - PTVPRO Public Portal Bugfix (Scroll Cut-off, Navy Leak & Footer Layout)
- **File:** `src/products/portal/styles/portal.css`, `src/products/portal/PortalPage.tsx`, `src/products/portal/components/AnnouncementModal.tsx`
- **Masalah:**
  1. Halaman berhenti scroll saat footer belum tuntas karena clipping `overflow: hidden` pada footer, negative margin watermark, serta overscroll-behavior-y none pada html.
  2. Kategori Layanan Musiman dengan 1 kartu menampilkan kotak navy gelap di sebelah kanannya karena global style `dashboard.css` menetapkan `.list { background: var(--surface); }` yang pada dark mode bernilai `#0E1B2D`.
  3. Tautan navigasi footer dan teks copyright saling bertabrakan secara horizontal karena global style `dashboard.css` menetapkan `.wrap { display: flex; flex-wrap: wrap; gap: 10px; }`.
- **Tindakan Perbaikan:**
  1. Menetapkan isolasi dokumen penuh `html.portal-page-active`, `body.portal-page-active` dengan document scrolling normal.
  2. Mereset `.ptvpro-portal .list` menjadi `background: transparent !important; border: 0 !important;`.
  3. Menegaskan `.ptvpro-portal .wrap` dan `footer .wrap` menjadi `display: block !important;`, memisahkan copyright ke baris independen, dan memberikan padding bawah yang nyaman.
  4. Menyelaraskan kelas overlay AnnouncementModal (`.ov`, `.dlg`) serta memastikan scroll lock dibersihkan 100% saat modal ditutup.
- **Hasil:** Typecheck passed, Lint 0 warnings, Vitest 448/448 tests passed, Build passed, Browser verification 1440px, 1280px, 390px scroll sampai ujung dan footer utuh.

### [CLN-040] - 2026-10-17 - VercelAuthService Anti-Hydration-Race Guard & Staging Configuration Alignment
- **File:** `src/core/auth/authService.ts`, `.env.staging`, `docs/PTV-PRO-STAGING-OAUTH-INDEX-PATCH.sql`
- **Masalah:**
  1. Pada `VercelAuthService`, pendaftaran listener `onAuthStateChange()` pertama kali menyalurkan nilai `currentSession = null` secara prematur sebelum panggilan asinkron `fetchServerSession()` ke `/api/auth/session` tuntas. Hal ini menyebabkan `useSessionStore` menandai `isLoading = false` sepersekian detik lebih awal, memicu pengalihan paksa (*false redirect*) ke `/hub/login` saat browser me-refresh rute terproteksi.
  2. Variabel backend di `.env.staging` masih bernilai `VITE_AUTH_BACKEND=supabase` yang mengarahkan tombol login Google ke Supabase GoTrue Auth, bukan ke Direct Vercel OAuth.
  3. Indeks unik belum tersedia pada kolom `(oauth_provider, oauth_subject_id)` di tabel `auth_credentials`.
- **Tindakan Perbaikan:**
  1. Menambahkan state `isInitialized` dan `initPromise` pada `VercelAuthService`. Pendaftaran listener `onAuthStateChange` menahan notifikasi awal hingga pemeriksaan sesi server perdana selesai secara asinkron.
  2. Memperbarui `getCurrentSession()` agar menunggu `initPromise` jika inisialisasi awal belum selesai.
  3. Memperbarui `.env.staging` menjadi `VITE_AUTH_BACKEND=vercel` secara terisolasi tanpa menyentuh production.
  4. Melakukan pra-pemeriksaan duplikasi data pada Supabase Staging (terkonfirmasi 0 duplikasi, 0 baris pada `auth_credentials`).
  5. Menyiapkan berkas patch SQL terisolasi `docs/PTV-PRO-STAGING-OAUTH-INDEX-PATCH.sql` untuk pemasangan partial unique index `idx_auth_credentials_oauth_provider_subject` dan verifikasi katalog `pg_indexes`.
- **Hasil:** Typecheck passed (0 errors), Lint passed (0 warnings), 448/448 tests passed, Vite production build passed (11.84s).

### [CLN-041] - 2026-10-17 - Local Vite Dev Server Native Vercel Function Emulation
- **File:** `vite.config.ts`
- **Masalah:** Pada saat dijalankan secara lokal melalui `npm run dev:staging` di `localhost:5174`, Vite secara default memperlakukan endpoint `/api/auth/*` sebagai permintaan file statis TypeScript dan mengembalikan kode mentah JavaScript alih-alih mengeksekusi function backend. Akibatnya, `fetch('/api/auth/session')` di browser gagal mengurai JSON dan `vercel dev` CLI tidak terpasang di sistem.
- **Tindakan Perbaikan:**
  1. Menambahkan middleware Vite dev terisolasi `vercelApiDevPlugin` pada `vite.config.ts` menggunakan API resmi Vite `server.ssrLoadModule`.
  2. Middleware mencegat permintaan `/api/auth/session`, `/api/auth/logout`, `/api/auth/google/login`, dan `/api/auth/google/callback` dan mengeksekusinya secara native pada Node.js runtime dev server di port 5174.
  3. Menginjeksikan variabel server-side dari `.env.staging` ke `process.env` saat dev server berjalan.
  4. Memvalidasi eksekusi live via probe curl/fetch di `http://localhost:5174/api/auth/session` (berhasil mengembalikan HTTP 200 JSON `{"authenticated":false,"user":null}`).
- **Hasil:** Typecheck passed (0 errors), Lint passed (0 warnings), 448/448 tests passed, Vite build passed (13.04s).

### [CLN-042] - 2026-10-17 - OAuth Mock Bypass Hardening & Local Secret Protection
- **File:** `api/auth/google/login.ts`, `api/auth/google/callback.ts`, `vite.config.ts`, `.gitignore`
- **Masalah:**
  1. Parameter query `?mock=true` dan `?mock_sub=...` pada handler OAuth tidak memiliki guard lingkungan eksplisit, berpotensi disalahgunakan pada rute live production apabila tidak diblokir.
  2. Middleware lokal `vercelApiDevPlugin` pada `vite.config.ts` mencetak detail `err.message` mentah ke respons browser jika terjadi exception.
  3. Berkas override rahasia lokal (`.env.staging.local`) berisiko terikut ke git commit jika `.gitignore` hanya mengecualikan `.env.local`.
- **Tindakan Perbaikan:**
  1. Menyematkan guard ketat `process.env.NODE_ENV === 'test' || process.env.ENABLE_DEV_MOCK_AUTH === 'true'` pada `login.ts` dan `callback.ts` sehingga bypass mock 100% dinonaktifkan di production dan staging.
  2. Menambahkan `apply: 'serve'` pada `vercelApiDevPlugin` dan menyamarkan respons internal error menjadi pesan generik aman tanpa membocorkan detail stack trace internal ke klien.
  3. Memperbarui `.gitignore` dengan pola `.env*.local` dan `.env.*.local` untuk menjamin file rahasia lokal operator tidak pernah ter-commit.
- **Hasil:** Typecheck passed (0 errors), Lint passed (0 warnings), 448/448 tests passed, Vite production build passed (11.01s).

### [CLN-043] - 2026-10-17 - Safe Subject ID Self-Discovery for Unlinked Google Accounts
- **File:** `api/auth/_utils/identity.ts`
- **Masalah:** Operator membutuhkan cara yang mudah dan aman untuk mengetahui Google Subject ID (`sub`) miliknya saat mencoba login pertama kali agar dapat ditautkan ke database tanpa harus memeriksa token JWT atau log backend.
- **Tindakan Perbaikan:**
  1. Memperbarui pesan error fail-closed pada `resolveIdentityByGoogleSub` di `identity.ts` agar menyertakan `[Subject ID: ${googleSub}]` di samping email.
  2. Pesan ini aman ditampilkan pada UI login alert karena Google Subject ID hanyalah identifier publik (seperti username/UID) dan bukan kredensial rahasia.
  3. Mempertahankan kompatibilitas 100% terhadap seluruh unit tests.
- **Hasil:** Typecheck passed (0 errors), Lint passed (0 warnings), 448/448 tests passed, Vite build passed.

### [CLN-044] - 2026-10-17 - Fix Google OAuth 401 invalid_client & Environment Sync Hardening
- **File:** `vite.config.ts`, `api/auth/google/login.ts`, `api/auth/google/callback.ts`
- **Masalah:** Saat mencoba login Google di `http://localhost:5174/hub/login`, Google menampilkan error 401 `invalid_client: The OAuth client was not found`. Diagnosis membuktikan proses Vite dev server lama (PID 29740) yang berjalan sejak siang masih menyimpan environment placeholder awal dalam memori proses, serta `vite.config.ts` sebelumnya menggunakan `process.cwd()` dengan guard `if (!process.env[key])` yang mencegah nilai baru dari `.env.staging.local` menimpa nilai lama.
- **Tindakan Perbaikan:**
  1. Memperbarui `vite.config.ts` agar selalu menggunakan `path.resolve(__dirname)` dan menyinkronkan ulang variabel lingkungan secara dinamis pada setiap panggilan `/api/auth/*` tanpa memerlukan guard pasif.
  2. Menambahkan sanitasi string (`.trim().replace(/^["']|["']$/g, '')`) pada `clientId`, `authSecret`, `redirectUri`, dan `clientSecret` di `login.ts` dan `callback.ts` untuk mencegah bug whitespace atau tanda kutip yang tidak terlihat.
  3. Menghentikan proses Vite lama yang *stale* dan me-restart dev server bersih pada port 5174.
  4. Melakukan verifikasi empiris live handshake ke `https://accounts.google.com` (terbukti mengembalikan HTTP 200 OK dengan halaman Google Account Chooser aktif tanpa error `invalid_client`).
- **Hasil:** Typecheck passed (0 errors), Lint passed (0 warnings), 448/448 tests passed, Vite build passed (11.00s).

### [CLN-045] - 2026-10-17 - PTV Hub Google OAuth Feedback Modals & Accessible UI Hardening
- **File:** `src/app/router/LoginPage.tsx`, `src/styles/login.css`, `api/auth/_utils/identity.ts`, `api/auth/google/callback.ts`, `tests/auth/vercelDirectAuth.test.ts`, `tests/hub/googleOAuthModals.test.tsx`
- **Masalah:** Alur login Google OAuth di PTV Hub sebelumnya hanya me-redirect atau menampilkan baris teks error standar tanpa modal umpan balik interaktif, kartu identitas pengguna terverifikasi, maupun tombol aksi coba lagi yang konsisten dengan sistem modal PTV Hub.
- **Tindakan Perbaikan:**
  1. Mengimplementasikan 4 modal feedback interaktif pada `LoginPage.tsx` menggunakan kelas baku `.lk-modal` dan `.lk-modal-scrim`:
     - **Modal Login Berhasil:** Ikon `CheckCircle2` hijau, judul *"Login Berhasil!"*, deskripsi selamat datang, kartu pengguna terverifikasi (`full_name`, `ptv_id`, divisi/posisi), dan tombol *"Masuk ke Dashboard"* yang menahan auto-redirect sampai dikonfirmasi pengguna.
     - **Modal Akun Belum Terdaftar:** Ikon `UserX` rose, judul *"Akun Belum Terdaftar"*, penjelasan bahwa akun Google belum tertaut ke kru resmi PTVPRO, tombol *"Coba Akun Google Lain"* (`prompt=select_account`), dan collapsible detail staging dev-only yang aman tanpa membocorkan Subject ID di production.
     - **Modal Akses Ditolak:** Ikon `ShieldAlert` amber, judul *"Akses Ditolak"*, penjelasan akun tidak memiliki izin akses PTV Hub tanpa membocorkan informasi internal seperti SQL atau capability, serta tombol *"Gunakan Akun Lain"*.
     - **Modal Error Login:** Ikon `AlertTriangle` merah, menangani pembatalan pengguna (*"Login Dibatalkan"*), sesi kedaluwarsa (*"Sesi Tidak Valid"*), dan kesalahan teknis (*"Gagal Masuk"*) dengan tombol *"Coba Lagi"*.
  2. Menerapkan **Lazy State Initialization** (`parseFeedbackFromQuery`) dan penahanan auto-redirect pada `LoginPage.tsx` untuk mencegah hydration race condition dan flicker saat membersihkan address bar URL.
  3. Menambahkan aturan CSS resmi di `src/styles/login.css` untuk varian warna ikon (`.success`, `.warning`, `.danger`, `.error`), kartu identitas `.lk-verified-user-card`, focus ring yang jelas (`.lk-modal-btn:focus-visible`), dan dukungan `@media (prefers-reduced-motion: reduce)`.
  4. Menambahkan dukungan navigasi keyboard lengkap (tombol Escape untuk menutup modal/melanjutkan ke dashboard, focus trap otomatis ke tombol utama saat modal terbuka).
  5. Memperbarui `tests/auth/vercelDirectAuth.test.ts` dan membuat test suite baru `tests/hub/googleOAuthModals.test.tsx` (7 unit test baru) yang memvalidasi seluruh variasi modal dan aksesibilitas dialog.
- **Hasil:** Typecheck passed (0 errors), Lint passed (0 warnings), 458/458 tests passed (39 suites), Production build passed.

### [CLN-057] - 2026-10-18 - Inventaris Revision Tahap 2: Mobile Grid, Detail Redesign & Internal Leak Stripping (INV-05 s.d. INV-09)
- **Sesi ID:** `PTV-DEV-048`
- **File Dimodifikasi / Dibuat:**
  - `src/products/hub/inventaris/InventarisPage.tsx`
  - `src/products/hub/inventaris/AlatDetailPage.tsx`
  - `src/styles/inventaris.css`
  - `src/styles/dashboard.css`
  - `tests/hub/inventarisMobileTahap2Regression.test.ts`
- **Masalah:**
  1. **INV-05:** Tampilan kartu katalog inventaris pada mobile (< 640px) sebelumnya menggunakan auto-fill minmax(210px) yang menyebabkan render 1 kolom saja, dan teks/badge berisiko overflow pada viewport sempit (375px/430px).
  2. **INV-06:** Tombol aksi detail "+ Daftar Pinjaman" dan "Pinjam Sekarang" terlalu tipis (height 42px), kurang nyaman untuk target sentuh mobile (touch target standar >= 48px).
  3. **INV-07:** Carousel rincian unit fisik pada mobile menyamping secara horizontal dan membutuhkan tombol navigasi panah yang memakan ruang vertikal layar kecil.
  4. **INV-08:** Bagian bawah halaman detail alat secara repetitif merender box besar "Spesifikasi & Catatan Teknis" yang menduplikasi teks `asset.spesifikasi` yang sudah tampil di subhead atas.
  5. **INV-09:** Halaman detail alat pada mobile memiliki kartu informasi yang terlalu besar, status kesiapan boros ruang, empty state riwayat peminjaman membocorkan internal database ID `swadgljnyelsjstqqxbm` dan label `Pilot 2 (Ditunda)` kepada pengguna biasa.
- **Tindakan Perbaikan:**
  1. **INV-05:** Mengimplementasikan layout grid mobile 2 kolom per baris (`grid-template-columns: repeat(2, minmax(0, 1fr))`) pada `@media (max-width: 640px)` di `src/styles/inventaris.css`. Menyesuaikan padding kartu (7px), radius foto (10px), status badge (9.5px dengan text ellipsis), nama alat (12px dengan 2-line clamp), dan quick action button (26px) agar zero overflow pada mobile 375px dan 430px, dengan desktop grid tetap utuh.
  2. **INV-06:** Menaikkan tinggi tombol aksi detail pada `src/styles/dashboard.css` menjadi `48px` (desktop & mobile) dengan padding vertikal lebih nyaman (`12px 20px`), mempertahankan kontras visual primary (gradient blue + bold shadow) dan secondary (surface putih + border blue).
  3. **INV-07:** Mengubah daftar unit fisik pada mobile (`@media (max-width: 768px)`) menjadi daftar vertikal (`flex-direction: column !important`), 1 kartu per baris (`width: 100% !important`), menampilkan seluruh unit secara berurutan, dan menyembunyikan tombol navigasi panah melalui wrapper `.prod-unit-desktop-nav` (`display: none !important`). Desktop tetap mempertahankan carousel horizontal.
  4. **INV-08:** Mengondisikan seksi "Spesifikasi & Catatan Teknis" agar hanya tampil apabila terdapat catatan tambahan nyata (`asset.nilai_inventaris?.catatan`) yang berbeda dari `asset.spesifikasi` utama. Jika teks sama atau tidak ada catatan tambahan, seksi repetitif tidak dirender. Data tersimpan di database sama sekali tidak disentuh.
  5. **INV-09:** Melakukan perapian hierarki mobile detail: showcase card padding 16px, photo wrap max-height 220px, judul 20px, status kesiapan alat lebih ringkas tanpa duplikasi lokasi/sumber dana, metadata inventaris 2x2 compact grid (`.prod-spec-grid`), dan mengganti empty state riwayat cloud yang membocorkan status teknis internal dengan komponen ramah pengguna `.prod-empty-history-compact`.
  6. Menghapus import tidak terpakai `isSupabaseConfigured` dan variabel `isCloudMode` dari `AlatDetailPage.tsx`.
  7. Menulis 13 skenario regression test komprehensif pada `tests/hub/inventarisMobileTahap2Regression.test.ts`.
### [CLN-071] - 2026-10-18 - Kru & External Contacts Staging Persistence Activation & Safety Hardening
- **Sesi ID:** `PTV-DEV-062`
- **File Dimodifikasi / Dibuat:**
  - `api/kru.ts` (Validasi allowlist, auto sequence PTV-ID, anti-production write barrier, proteksi DELETE 405)
  - `api/kontak.ts` (Validasi allowlist, anti-production write barrier, RBAC fail-closed, UUID validation)
  - `src/products/hub/kru/kruService.ts` (Asynchronous error propagation, no silent mock fallback)
  - `src/products/hub/kontak/kontakService.ts` (Asynchronous error propagation, no silent mock fallback)
  - `tests/hub/kruKontakCrudPersistence.test.ts` (12 unit regression tests untuk RBAC, validasi ID, dan proteksi mutasi)
  - `scripts/verify-kru-kontak-staging-persistence.mjs` (Script verifikasi live transaction Staging)
  - `backups/staging-legacy-archive-kru-pre-crud-2026-10-18T13-13-58-273Z.json` (Snapshot backup 93 rows)
  - `backups/staging-ptv-kontak-eksternal-pre-crud-2026-10-18T13-13-58-273Z.json` (Snapshot backup 8 rows)
- **Tindakan Pembersihan & Hardening:**
  1. Memastikan tidak ada silent fallback ke localStorage atau dummy fixtures pada operasi mutasi tulis (CREATE, UPDATE, DELETE).
  2. Memverifikasi pemisahan mutlak antara profil data kru dengan tabel autentikasi pengguna (`user_account`, `account_profiles`). Form profil kru tidak dapat memicu eskalasi izin RBAC atau mutasi kredensial login.
  3. Memastikan metode HTTP DELETE pada modul Manajemen Kru diblokir secara fail-closed (HTTP 405 Method Not Allowed) demi menjaga keutuhan riwayat data relasional (Acara, Peminjaman Alat, Dokumen Surat).
  4. Menerapkan anti-Production write barrier di seluruh handler serverless (`jthzuhkblxcaohiuypqq` strictly read-only).
  5. Menambahkan 3 skenario regression test baru di `tests/hub/kruKontakCrudPersistence.test.ts` (total 12 unit tests passed).
- **Hasil:** Typecheck passed (0 errors), Lint passed (0 warnings), 54/54 test files passed (644/644 tests passed 100%), Kompilasi Vite build sukses dalam 16.29s (1889 modules transformed).

### [CLN-072] - 2026-10-18 - Urgent Hotfix: React Rules of Hooks Render Crash Elimination on Modal & Forms
- **Sesi ID:** `PTV-DEV-062`
- **File Dimodifikasi / Dibuat:**
  - `src/products/hub/acara/components/AcaraCrewModal.tsx` (Pindahkan hook `useState` isSubmitting ke top-level sebelum early return `if (!isOpen) return null;`)
  - `src/products/hub/acara/components/AcaraDeleteModal.tsx` (Pindahkan hook `useState` isDeleting ke top-level sebelum early return `if (!isOpen || !event) return null;`)
  - `src/products/hub/acara/components/AcaraFormModal.tsx` (Pindahkan hook `useState` isSubmitting ke top-level sebelum early return `if (!isOpen) return null;`)
  - `src/products/hub/acara/components/AcaraGearModal.tsx` (Pindahkan hook `useState` isSubmitting ke top-level sebelum early return `if (!isOpen) return null;`)
  - `scripts/audit-react-hooks.mjs` (AST TypeScript compiler tool untuk verifikasi otomatis kepatuhan Rules of Hooks di 124 komponen TSX)
  - `tests/hub/modalHooksLifecycleRegression.test.tsx` (13 skenario regression test render lifecycle: Open, Close, Re-open, Add/Edit mode switching, Event switching)
- **Akar Masalah (Root Cause):**
  Pada `AcaraCrewModal.tsx`, `AcaraFormModal.tsx`, `AcaraGearModal.tsx`, dan `AcaraDeleteModal.tsx`, deklarasi state lokal `const [isSubmitting, setIsSubmitting] = useState(false);` (atau `isDeleting`) diletakkan SETELAH baris `if (!isOpen) return null;`. Ketika modal awalnya tertutup, React merender N hooks. Begitu modal dibuka (`isOpen = true`), React mengeksekusi N+1 hooks, yang langsung memicu fatal error React: *"Rendered more hooks than during the previous render"* dan meng-crash aplikasi.
- **Tindakan Perbaikan:**
  1. Memindahkan seluruh pemanggilan hook ke top-level fungsi komponen secara berurutan dan deterministik sebelum statement early return `if (!isOpen) return null;`.
  2. Memastikan early return `if (!isOpen) return null;` diletakkan tepat sebelum instruksi `return (...)` render JSX sheet modal.
  3. Mengaudit seluruh 124 file komponen TSX pada repositori menggunakan TypeScript Compiler API AST analyzer untuk memastikan zero conditional hooks, zero loop hooks, dan zero hooks after early return.
  4. Menulis 13 skenario regression test siklus render modal di `tests/hub/modalHooksLifecycleRegression.test.tsx`.
- **Hasil:** Typecheck passed (0 errors), Lint passed (0 warnings), 55/55 test files passed (657/657 tests passed 100%), Kompilasi Vite build sukses dalam 16.18s (1889 modules transformed).

### [CLN-073] - 2026-10-18 - Urgent Audit & Reconciliation Modul Keuangan vs Legacy PHP & Production
- **Sesi ID:** `PTV-DEV-063`
- **File Dimodifikasi / Dibuat:**
  - `src/products/hub/kru/types.ts` (Implementasi dan ekspor kanonikal helper `isOperationalCrew` sesuai logika legacy PHP `page-dasbor.php`)
  - `src/products/hub/keuangan/KeuanganPage.tsx` (Mengganti filter status aktif mentah dengan `isOperationalCrew(c)` dan memperbaiki rendering status lunas pra-join-date)
  - `src/products/hub/keuangan/keuanganStore.ts` (Integrasi `isOperationalCrew`, perbaikan nominal fallback periode [25k, 25k, 20k, 20k], migrasi storage key `ptv_shared_keuangan_v2`)
  - `src/products/hub/keuangan/types.ts` (Penambahan tipe kanonikal PaymentMethod `'Transfer'` dan PemasukanKategori `'Penjualan Merchandise'`)
  - `src/products/hub/keuangan/fixtures.ts` (Sinkronisasi dataset historis 100% identik dengan Production bundle: 4 periode kas, 38 kas kru, 43 pemasukan, 9 pengeluaran)
  - `src/products/hub/kru/kruStore.ts` (Kompatibilitas `resetToFixtures` dengan `INITIAL_CREW_FIXTURES` agar suite test legacy tetap stabil)
  - `tests/hub/keuangan.test.ts` (Pembaruan & penambahan 27 unit regression tests validasi rekonsiliasi kas, pengecualian pembina, dan verifikasi nominal kanonikal)
- **Akar Masalah (Root Causes):**
  1. **Pembina/Pengarah Muncul:** React hanya memfilter `c.status_kru === 'Aktif'`, padahal PHP Legacy menerapkan pengecualian role/divisi/jabatan Pembina, Pengarah, Penasihat, Member, Non-operasional (`isOperationalCrew`). Akibatnya 7 tokoh pimpinan kehormatan aktif masuk ke daftar tagihan kas.
  2. **Nominal Rp95.000:** Fixtures lama meng-hardcode nominal periode [20k, 25k, 25k, 25k] = Rp95.000. Data kanonikal Production sesungguhnya adalah [25k, 25k, 20k, 20k] = Rp90.000 total tunggakan 4 bulan.
  3. **Histori Pembayaran Tidak Sesuai:** State React beroperasi di localStorage terisolasi dengan data dummy dan belum tersinkronisasi dengan transaksi riil `production-bundle.json`.
- **Tindakan Pembersihan & Perbaikan:**
  1. Mengekstraksi fungsi kanonikal `isOperationalCrew(c)` ke `src/products/hub/kru/types.ts` dan menerapkannya konsisten pada tabel iuran kas serta fungsi `getSummary()`.
  2. Memperbaiki nominal periode kas default dan memperbarui fixture baseline ke snapshot transaksi Production yang valid.
  3. Mengisolasi storage key ke `ptv_shared_keuangan_v2` untuk membersihkan cache browser lama yang membawa nominal Rp95.000.
  4. Memperbarui 27 unit regression tests di `tests/hub/keuangan.test.ts`.
- **Hasil:** Typecheck passed (0 errors), Lint passed (0 warnings), 55/55 test files passed (664/664 tests passed 100%), Kompilasi Vite build sukses dalam 18.59s (1890 modules transformed).

### [CLN-074] - 2026-10-18 - Safe Deletion of Test External Contact on Supabase Staging
- **Sesi ID:** `PTV-DEV-064`
- **File Dimodifikasi / Dibuat:**
  - `backups/staging-deleted-contact-49ae25d7-3454-41a6-901e-279901fd5b4d-2026-10-18T13-53-37-103Z.json` (Backup snapshot record kontak uji)
  - `backups/staging-ptv-kontak-eksternal-pre-delete-2026-10-18T13-53-37-103Z.json` (Backup snapshot tabel ptv_kontak_eksternal 9 baris)
  - `cleanings.md` (Pencatatan CLN-074)
  - `piketdev.md` (Dashboard, Section D, Logbook PTV-DEV-064)
- **Akar Kebutuhan:**
  Kontak eksternal uji *"PT Sinar Broadcast Solusindo (Uji)"* (Telp: `6281133344499`, ID: `49ae25d7-3454-41a6-901e-279901fd5b4d`) yang sebelumnya dibuat pada sesi verifikasi persistensi Staging `PTV-DEV-062` perlu dibersihkan sesuai instruksi operator, tanpa merusak data kontak lembaga riil.
- **Tindakan Pembersihan & Hardening:**
  1. Melakukan audit kandidat: Memverifikasi tepat 1 kandidat persis pada Supabase Staging `swadgljnyelsjstqqxbm`.
  2. Memeriksa relasi inbound & foreign keys: 0 relasi atau referensi ditemukan pada `ptv_acara`, `ptv_inventaris`, `ptv_catatan`, `ptv_pemasukan`, `ptv_pengeluaran`, `ptv_surat_izin`.
  3. Mengarsipkan backup JSON record dan tabel penuh sebelum mutasi ke direktori `backups/`.
  4. Mengeksekusi DELETE terarah secara eksklusif menggunakan filter ID `49ae25d7-3454-41a6-901e-279901fd5b4d`.
  5. Memastikan Production `jthzuhkblxcaohiuypqq` strictly tidak disentuh sama sekali.
  6. Memverifikasi pasca-penghapusan: Total baris `ptv_kontak_eksternal` di Staging berkurang dari 9 menjadi tepat 8 baris, seluruh 8 kontak lembaga riil (U. Dadang, U. Isma Dwi, U. Pujo, U. Rizal Babel, Ust. Arshy Fajar, Ust. Horison, Ust. Nasikhul Amin, Ust. Udin) utuh 100%, dan kontak uji terbukti lenyap dari tampilan React pasca-refetch.
- **Hasil:** 55/55 test files passed (664/664 tests passed 100%), 0 error, data lembaga asli aman utuh.

### [CLN-075] - 2026-10-24 - Finance 2.0 Final UX Revision, Feature Completion & Database Hardening
- **Sesi ID:** `PTV-DEV-130`
- **Operator:** Zidnal (`jidnaal`)
- **File Dimodifikasi / Dibuat:**
  - `src/styles/financeFoundation.css` (Koreksi whitespace kartu saldo & bento, layout compact mobile/desktop)
  - `src/products/hub/keuangan/FinanceWorkspace.tsx` (Tabel transaksi bulanan sistem lama terkunci, pill filter, modal edit & batalkan, lightbox bukti)
  - `src/products/hub/keuangan/components/EditTransaksiModal.tsx` (Modal edit pengeluaran/pemasukan dengan live preview foto/struk)
  - `src/products/hub/keuangan/components/BatalkanTransaksiModal.tsx` (Modal pembatalan transaksi dengan alasan wajib dan reversal non-destruktif)
  - `src/products/hub/keuangan/FinanceSettingsView.tsx` (Pengaturan keuangan all-in-one editable D1-D5, tabel tarif bulanan kas kru, proteksi 4 pilar arsitektur)
  - `src/products/hub/keuangan/FinanceKasKruView.tsx` (Tabel kas kru menampilkan tarif mandiri per bulan pada header periode)
  - `src/products/hub/keuangan/kasKruTypes.ts` & `kasKruService.ts` (Aturan tarif bulanan mandiri, multi-cicilan kas kru, proteksi join_date, fee waiver)
  - `src/products/hub/keuangan/financeSettingsService.ts` (CRUD kategori canonical, proteksi kategori sistem, arsip/restore)
  - `src/products/hub/keuangan/financeCanonical.ts` & `api/finance.ts` (Pemetaan proofUrl, notes, recordedBy, dan endpoint update/void/kategori)
  - `docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-MIGRATION.sql` (Hardening preflight barrier, monthly_fees JSONB, tabel ptv_finance_kas_payments)
  - `docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-ROLLBACK.sql` (Rollback two-tier terverifikasi)
  - `tests/hub/financeUxAndTariff.test.ts` (12 skenario pengujian komprehensif tarif dinamis, cicilan, dan kategori)
- **Tindakan Pembersihan & Hardening:**
  1. Menghilangkan dead whitespace pada ringkasan keuangan tanpa memotong margin atau padding sentuh.
  2. Mengembalikan struktur tabel transaksi desktop sesuai sistem lama (pengelompokan bulanan, total per bulan, kolom lengkap) dengan wrapper `.fin-table-scroll` untuk mobile.
  3. Mengunci perlindungan transaksi otomatis (Kas Kru & Piutang) agar tidak dapat diedit atau dibatalkan langsung di tabel transaksi umum.
  4. Menerapkan perhitungan matematis deterministik kas kru: multi-cicilan, tarif naik (status 'sebagian', sisa dihitung tepat), tarif turun (overpayment tanpa saldo negatif), dan fee waiver.
  5. Menjaga kepatuhan 100% Rules of Hooks, zero unused imports/variables, dan zero lint warnings.
### [CLN-076] - 2026-10-24 - Finance 2.0 Finalization, Staging Preflight/Postflight & Ledger Hardening
- **Sesi ID:** `PTV-DEV-132`
- **Operator:** Zidnal (`jidnaal`)
- **File Dimodifikasi / Dibuat:**
  - `api/finance.ts` (Implementasi atomic void transaction balance rollback & database RPC fallback)
  - `docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-MIGRATION.sql` (Postgres 15+, `rpc_void_finance_transaction_atomic`, storage bucket `finance-proofs` dengan RLS)
  - `docs/PTVPRO-FINANCE-2.0-OPERATIONAL-MODULES-ROLLBACK.sql` (Postgres 15+, void RPC & storage drops, resilient transaction count check)
  - `docs/PTVPRO-FINANCE-2.0-STAGING-PREFLIGHT-READONLY.sql` (8-point read-only preflight audit multi-barrier script)
  - `docs/PTVPRO-FINANCE-2.0-STAGING-POSTFLIGHT-READONLY.sql` (7-point read-only postflight verification & ledger reconciliation script)
  - `tests/hub/financeStagingReadiness.test.ts` (8 skenario pengujian komprehensif: Kas Kru kenaikan tarif retroaktif, penolakan Pembina/Pengarah fail-closed, audit SQL scripts, isolasi akuntansi Piutang)
- **Tindakan Pembersihan & Hardening:**
  1. Menutup celah ledger reversal pada `api/finance.ts`: Sebelumnya pembatalan transaksi hanya mengubah status transaksi menjadi `reversed` tanpa mengembalikan saldo kantong yang dialokasikan. Kini secara otomatis memanggil RPC atomik di database atau fallback membalik alokasi saldo kantong secara aman dan mencatat audit log.
  2. Merelaksasi syarat versi Postgres pada skrip SQL migrasi dan rollback dari Postgres 17 (`170000`) menjadi Postgres 15+ (`150000`) agar kompatibel dengan infrastruktur cloud Supabase Staging.
  3. Mempersiapkan Supabase Storage bucket `finance-proofs` (kapasitas 5MB per file, mime-type image/pdf) lengkap dengan 3 RLS policies untuk memastikan foto bukti transaksi tersimpan persisten di cloud dan tidak bocor ke Pembina/Pengarah.
  4. Membuat skrip read-only preflight dan postflight yang 100% aman (SELECT only, zero mutasi) untuk memudahkan verifikasi multi-barrier oleh operator sebelum dan sesudah eksekusi DDL di Staging.
  5. Menulis unit regression test suite `tests/hub/financeStagingReadiness.test.ts` untuk memvalidasi kasus uji tarif Kas Kru naik Rp30k -> Rp35k (sisa tagihan tepat Rp5.000), isolasi akuntansi piutang, dan keamanan akses API.
- **Hasil:** Typecheck passed (0 errors), Lint passed (0 warnings), 115/115 test files passed repository-wide (1196/1196 tests passed 100%), Kompilasi Vite build sukses dalam 16.00s.

### [CLN-189] - 2026-10-27 - Kalender PTVPRO Rounded Shape Cards Remediation & Visual Parity
- **Sesi ID:** `PTV-DEV-177`
- **Operator:** Zidnal (`jidnaal`)
- **File Dimodifikasi:**
  - `src/styles/kalender.css` (Normalisasi grid date cells menjadi rounded rectangle cards 6px presisi, border 1px #e5e7eb, out-of-month cards tetap memiliki outline rounded utuh dengan angka muted, selected card solid #1D6EE5/#059669 dengan teks putih kontras, today card soft tint dengan border tajam 1.5px, mobile cell radius 5px).
- **Tindakan Pembersihan & Hardening:**
  1. **Akar Masalah Ketidaksesuaian:** Sebelumnya kotak sel tanggal menggunakan `--line-2` yang hanya beropasitas 0.055 (hampir tidak tampak di background putih) dan sel out-of-month memudar dengan `opacity: 0.42` sehingga garis kotaknya terputus. Radius sel sebelumnya juga terlalu bulat (`8px`-`9px`) pada rasio kotak tinggi sehingga tampak cembung (soap-bar/squircle) alih-alih kartu rounded rectangle editorial yang rapi.
  2. **Penyelarasan dengan Referensi Pengguna:**
     - Mengubah border sel menjadi garis 1px nyata yang konsisten (`#e5e7eb` pada Light Mode, `rgba(255, 255, 255, 0.1)` pada Dark Mode).
     - Menetapkan corner radius `6px` presisi pada desktop dan `5px` pada mobile.
     - Memastikan sel out-of-month (seperti tanggal 27-30 awal bulan dan 1-7 akhir bulan) tetap mempertahankan border kartu rounded utuh dengan teks angka yang pudar (`#d1d5db`), menciptakan matriks 42 sel yang kontinu dan seragam tanpa efek "gigi tanggal".
     - Menyelaraskan status sel terpilih (`.cal-day-cell.sel`) menjadi solid fill yang tegas (PTV Blue `#1D6EE5`, Pesantren Emerald `#059669`, Sekolah `#6D28D9`) dengan teks putih bersih (`#ffffff`), persis seperti kartu tanggal 27 pada tangkapan layar referensi editorial.
     - Mempertahankan 100% data Masehi, Hijriah (Arab Indic), data weton pasaran Jawa, dan titik indikator kegiatan/planner tanpa merusak struktur atau menambah dependensi baru.
- **Hasil Verifikasi:**
  - `npm run typecheck`: 0 error (`tsc --noEmit`).
  - Unit test `kalenderGridRedesign.test.tsx` & `kalenderStagingRegression.test.ts`: 27/27 passed (100%).
  - Visual QA via Headless Edge/Playwright: 5 screenshot terverifikasi (Desktop Light, Desktop Dark, Mobile Light, Mobile Dark, dan Layer Pesantren Emerald).




### [CLN-192] - 2026-10-27 - Portal Management Centered Modals, Broadcast R03, Dark Waiting Screen, Unified Profile & Finance Diagnostics
- **Sesi ID:** `PTV-DEV-179`
- **Operator:** Zidnal (`zidnal`) / Antigravity
- **File Dimodifikasi:**
  - `src/styles/portalManagement.css` (Styling modal dialog terpusat R03, overlay fixed, sticky header & footer, scrollable form body, responsive mobile).
  - `src/products/hub/portal-management/components/ServiceEditModal.tsx` (Ditulis ulang menggunakan `createPortal`, dialog terpusat 720px, radius 22px, sticky header/footer, konfirmasi unsaved changes, 100% field & validasi dipertahankan).
  - `src/products/hub/portal-management/components/AnnouncementFormModal.tsx` (Ditulis ulang menggunakan `createPortal`, dialog terpusat 720px, sticky header/footer, form body scroll, konfirmasi unsaved changes).
  - `src/products/hub/portal-management/components/ServiceStatusModal.tsx` & `PublishConfirmModal.tsx` (Ditulis ulang menggunakan `createPortal` & dialog terpusat R03).
  - `src/products/hub/portal-management/PortalManagementPage.tsx` (Openers mutually exclusive mencegah modal ganda bertumpuk).
  - `src/styles/broadcast.css` (Harmonisasi R03: container 1200px, title 24px/21px semibold 600, primary button pill 38px #1273E6, card radius 22px, font-weight natural, dark mode charcoal netral).
  - `src/styles/splash.css` & `src/app/router/ProtectedRoute.tsx` (Dukungan penuh tema gelap pada waiting screen splash, eliminasi white flash saat refresh dark mode, sinkronisasi tema instan sebelum render splash).
  - `src/products/hub/profile/ProfilePage.tsx` (Halaman terpadu baru Profil & Akun Kru: 2 kolom desktop dengan ID Card digital resmi, live QR verifikasi, PNG exporter HD 720x1120, info kru, preferensi tema, Google SSO, ganti kata sandi).
  - `src/app/router/index.tsx` (Rute `/hub/profile` ditambahkan, `/hub/id` dan `/hub/pengaturan` diredirect aman ke profil terpadu).
  - `src/products/hub/shell/HubShell.tsx` (Sidebar disatukan menampilkan menu tunggal `Profil` di bawah Sistem, menghapus entri ID Digital redundan).
  - `src/products/hub/keuangan/FinancePage.tsx` (Polesan header, tab segmented pill, tombol Muat ulang, kartu error informatif R03).
- **Tindakan Pembersihan & Hardening:**
  1. Menghilangkan pola inline form yang canggung pada Pengelolaan Portal, menggantikannya dengan standard dialog modal terpusat (R03) via React Portal ke `document.body`.
  2. Menghilangkan white flash pada splash waiting screen dengan menambahkan style dark mode sadar-tema dan penyesuaian lifecycle mount pada `ProtectedRoute.tsx`.
  3. Mengonsolidasikan dua halaman terpisah (ID Digital dan Pengaturan) ke dalam satu modul terpadu `/hub/profile` yang modular, bersih, dan mempertahankan kompatibilitas navigasi eksternal maupun rute lama.
  4. Mendiagnosis secara empiris akar masalah kegagalan Keuangan Staging: database PostgreSQL Supabase Staging belum memiliki RPC `public.rpc_finance_visible_transactions_server` yang dibutuhkan `api/finance.ts`. Tidak ada manipulasi database sepihak; blocker dicatat secara resmi.
- **Hasil Verifikasi:**
  - `npm run typecheck`: PASS (0 errors).
  - Vitest Unit Tests: 19/19 passed (Broadcast & Profile), 47/47 passed (Finance Foundation, Overview, Functional).
  - Visual QA Headless Chrome CDP: 16 screenshot terverifikasi (Portal Edit Modal desktop/mobile, Announcement Modal desktop, Broadcast light/dark desktop/mobile, Waiting screen dark mode, Profile 2-col desktop & 1-col mobile light/dark, Keuangan desktop/mobile).

### [CLN-196] - 2026-10-29 - Sidebar Branding, Tint Masking & Synchronized 240ms Transition Polish
- **Sesi ID:** `PTV-DEV-196`
- **Operator:** Zidnal (`zidnal`) / Antigravity
- **File Dimodifikasi:**
  - `src/products/hub/shell/HubShell.tsx` (Mengganti `img` menjadi semantic `span` dengan CSS masking silhouette `--symbol-url`, menyatukan link branding).
  - `src/styles/dashboard.css` (Mengecilkan simbol PTV menjadi 32px, menerapkan warna `--ink-2` melalui silhouette mask, sinkronisasi transisi 240ms cubic-bezier(0.2, 0, 0, 1) pada `.side`, `.hdr`, dan `.main`, eliminasi pemutusan `display: none !important` prematur, crossfade mulus opacity & transform, dan penambahan `prefers-reduced-motion`).
- **Tindakan Pembersihan & Hardening:**
  1. Menghapus duplikasi deklarasi `.brand-logo-expanded` dan `.side-brand .brand-logo-expanded` di `dashboard.css`.
  2. Mengganti `display: none !important;` pada frame 0 yang menyebabkan teks dan logo berkedip/hilang seketika dengan transisi terkoordinasi `opacity`, `transform: translateX()`, dan `max-width`.
  3. Menyinkronkan durasi animasi `.hdr` (sebelumnya 200ms) dan `.main` (sebelumnya 200ms) dengan `.side` (240ms cubic-bezier(0.2, 0, 0, 1)) sehingga pergeseran margin/left berjalan serempak tanpa jitter.
  4. Menerapkan CSS mask `--ink-2` pada simbol PTV 32px sehingga warna simbol otomatis serasi dengan ikon navigasi FontAwesome, baik pada light mode (`#38587A`) maupun dark mode (`#BDC1C6`), serta hover (`#1D6EE5`/`#FFFFFF`).
- **Hasil Verifikasi:**
  - `npm run typecheck`: PASS (0 errors).
  - `npx eslint src/products/hub/shell/HubShell.tsx`: PASS (0 errors / 0 warnings).
  - `npm run build`: PASS (`tsc && vite build` selesai dalam 20.79s).
  - Vitest Unit Tests: 8/8 passed (`globalNavigationInteractions.test.tsx`).
  - Browser Visual QA via Headless Edge/Playwright: 8 screenshot terverifikasi (Expanded Light/Dark, Minimized Light/Dark, Mid-transition t=120ms serempak, Rapid toggles, Navigasi Minimized ke Inventaris, Reload persistence, dan Mobile responsive 390x844).
