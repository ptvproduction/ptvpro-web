# PTV-DEV-188 — AUDIT LOADING STATE & GLOBAL PAGE TRANSITIONS
**PTVPRO / PTV Hub — H-1 Preparation Audit Matrix**  
**Tanggal:** 28 Oktober 2026 | **Operator:** zidnal | **Antigravity AI Agent**

---

## 1. PENDAHULUAN & RUANG LINGKUP
Audit ini mencakup seluruh rute aktif pada ekosistem PTV Hub (`src/app/router/index.tsx`), mengidentifikasi titik pemanggilan asinkron (*data fetching*), bentuk penanganan *loading* eksisting, risiko *layout shift* (CLS), serta menentukan tipe *contextual skeleton* yang proporsional sesuai struktur halaman aktual.

---

## 2. MATRIKS AUDIT & STATUS IMPLEMENTASI PER MODUL

| Route | File Komponen | Loading State Eksisting | Target Skeleton R03 | CLS Risk | Status Implementasi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/hub/beranda` | `src/products/hub/beranda/BerandaPage.tsx` | Spinner FontAwesome inline di card | `BerandaHeroSkeleton` + `BentoWidgetSkeleton` + `ListSkeleton` | Tinggi | **FIXED (PASS)** — Cache-first, skeleton per widget saat awal |
| `/hub/kru` | `src/products/hub/kru/KruPage.tsx` | Raw text "Memuat kru..." | `PageHeaderSkeleton` + `TableSkeleton` | Tinggi | **FIXED (PASS)** — Soft shimmer rows |
| `/hub/akses` | `src/products/hub/akses/AksesPage.tsx` | Spinner teks tengah | `TableSkeleton` | Sedang | **FIXED (PASS)** — Matrix table skeleton |
| `/hub/inventaris` | `src/products/hub/inventaris/InventarisPage.tsx` | Spinner tengah `.inv-loading` | `InventoryGridSkeleton` | Tinggi | **FIXED (PASS)** — 6-card shimmer 16:9 aspect |
| `/hub/inventaris/:id` | `src/products/hub/inventaris/AlatDetailPage.tsx` | Spinner teks tengah | `DocDetailSkeleton` | Sedang | **FIXED (PASS)** — Two-column spec layout |
| `/hub/inventaris/nilai` | `src/products/hub/inventaris/NilaiInventarisPage.tsx` | Spinner tengah | `TableSkeleton` | Sedang | **FIXED (PASS)** — Valuation rows skeleton |
| `/hub/inventaris/nilai/:id` | `src/products/hub/inventaris/NilaiInventarisDetailPage.tsx` | Spinner teks | `DocDetailSkeleton` | Rendah | **FIXED (PASS)** — Valuation detail skeleton |
| `/hub/peminjaman` | `src/products/hub/peminjaman/PeminjamanPage.tsx` | Spinner tengah `.pm-loading` | `CardListSkeleton` | Tinggi | **FIXED (PASS)** — Loan card list skeleton |
| `/hub/acara` | `src/products/hub/acara/AcaraPage.tsx` | Spinner `.acara-loading-state` | `CardListSkeleton` | Tinggi | **FIXED (PASS)** — Event timeline card skeleton |
| `/hub/acara/:id` | `src/products/hub/acara/AcaraDetailPage.tsx` | Spinner tengah | `DocDetailSkeleton` | Sedang | **FIXED (PASS)** — Event detail view skeleton |
| `/hub/kalender` | `src/products/hub/kalender/KalenderPage.tsx` | Spinner header & agenda | `CalendarGridSkeleton` | Tinggi | **FIXED (PASS)** — Calendar month grid + planner cards |
| `/hub/catatan` | `src/products/hub/catatan/CatatanPage.tsx` | Spinner `.fa-spin` | `CardListSkeleton` | Sedang | **FIXED (PASS)** — Note card list skeleton |
| `/hub/lostfound` | `src/products/hub/lostfound/LostFoundPage.tsx` | Spinner tengah | `InventoryGridSkeleton` | Sedang | **FIXED (PASS)** — Items grid shimmer |
| `/hub/kerusakan` | `src/products/hub/kerusakan/LaporKerusakanPage.tsx` | Spinner teks | `CardListSkeleton` | Sedang | **FIXED (PASS)** — Damage report list skeleton |
| `/hub/dokumen` | `src/products/hub/dokumen-saya/DokumenSayaPage.tsx` | Spinner inline `.fa-spin` | `CardListSkeleton` | Tinggi | **FIXED (PASS)** — Document row skeleton |
| `/hub/arsip` | `src/products/hub/arsip/ArsipPage.tsx` | Mockup skeleton bars | `TableSkeleton` | Rendah | **FIXED (PASS)** — Unified soft shimmer table |
| `/hub/surat/generator` | `src/products/hub/surat/generator/GeneratorSuratPage.tsx` | Input spinners | `FormSkeleton` | Rendah | **FIXED (PASS)** — Two-column form layout skeleton |
| `/hub/perizinan` | `src/products/hub/perizinan/PerizinanPage.tsx` | Spinner di container & counter | `CardListSkeleton` | Sedang | **FIXED (PASS)** — Permit cards skeleton |
| `/hub/kontak` | `src/products/hub/kontak/KontakInternalPage.tsx` | Div `.loading` | `CardListSkeleton` | Sedang | **FIXED (PASS)** — Contact card list skeleton |
| `/hub/kontak-eksternal` | `src/products/hub/kontak/KontakEksternalPage.tsx` | Spinner teks | `CardListSkeleton` | Sedang | **FIXED (PASS)** — Partner card list skeleton |
| `/hub/broadcast` | `src/products/hub/broadcast/BroadcastPage.tsx` | Div `.loading` spinner | `CardListSkeleton` | Sedang | **FIXED (PASS)** — Broadcast cards skeleton |
| `/hub/haul` | `src/products/hub/haul/HaulPage.tsx` | Spinner teks | `CardListSkeleton` | Rendah | **FIXED (PASS)** — Haul list skeleton |
| `/hub/seo` | `src/products/hub/seo/SeoPage.tsx` | Spinner teks | `CardListSkeleton` | Rendah | **FIXED (PASS)** — Analytics metrics skeleton |
| `/hub/portal` | `src/products/hub/portal-management/PortalManagementPage.tsx` | Spinner `.fa-spin` | `CardListSkeleton` | Sedang | **FIXED (PASS)** — Portal links skeleton |
| `/hub/profile` | `src/products/hub/profile/ProfilePage.tsx` | Local instant | `ProfileSkeleton` | Rendah | **FIXED (PASS)** — Profile view skeleton |
| `/hub/id-card` | `src/products/hub/id-digital/IdDigitalPage.tsx` | Instant / pre-rendered | `CardListSkeleton` | Rendah | **FIXED (PASS)** — Instant render verified |
| `/hub/keuangan` | `src/products/hub/keuangan/KeuanganPage.tsx` | Finance stores | *(Parallel work Codex)* | N/A | **PASS (Codex Isolation Guardrail)** — Strictly untouched |
| **PDF Kop Surat** | `SuratIzinPdfPreview.tsx` & `docPdfPrinter.ts` | Filter CSS biru pada ptv-logo-white | `BS-X-PTV.webp` (48px height, contain) | N/A | **FIXED (PASS)** — Berkas asli `BS-X-PTV.webp` (10,146 bytes, 323×184px) terpasang di `public/assets/images/BS-X-PTV.webp`. Terverifikasi render pada preview Generator Surat Izin (48px height, 84px width) dan tertanam fisik pada PDF unduhan (`buildOfficialDocPdf14` via DCTDecode XObject). |

---

## 3. AUDIT TRANSISI NAVIGASI & SHELL
- **Current Shell Structure:** Di `src/products/hub/shell/HubShell.tsx`, konten route anak dirender di dalam `<main className="main"><div className="page-in" id="view"><Outlet /></div></main>`.
- **Temuan Animasi:**
  - Kelas `.page-in` di beberapa file CSS memiliki animasi yang tidak seragam (ada yang menggunakan `opacity` saja, ada yang memiliki `animation: fadeIn 0.3s`, ada yang tidak beranimasi sama sekali).
  - Saat berpindah route (`/hub/beranda` -> `/hub/inventaris` -> `/hub/acara`), konten berganti secara mendadak (*abrupt snap*) atau memicu kedipan putih.
  - Sidebar desktop, header desktop, mobile dock navbar, dan bottom sheet berada di level luar `#view`, sehingga transisi halaman dapat diterapkan secara terisolasi pada `#view` tanpa membuat header atau dock berkedip.
- **Solusi Standar R03 (Subtle Fade + Lift):**
  - Durasi: `200ms`
  - Timing: `cubic-bezier(0.16, 1, 0.3, 1)` (atau `ease-out`)
  - Keyframes: `opacity: 0; transform: translateY(6px)` -> `opacity: 1; transform: translateY(0)`
  - Safe Guard: `@media (prefers-reduced-motion: reduce) { animation: none !important; transform: none !important; }`
  - Kontainer transisi: Dibungkus dengan key berbasis `location.pathname` agar setiap pergantian route memicu animasi fade-lift sekali tanpa merusak state scrolling jika tidak diinginkan.

---

## 4. AUDIT TEMPLATE KOP SURAT PDF RESMI (LEGACY PARITY)
- **Rujukan Legacy PHP:**
  - `legacy/page-dasbor.php` (L35072–L35082):
    ```javascript
    var kopLogoSrc = BS_X_PTV_LOGO_DATA || BS_X_PTV_LOGO_URL || '';
    // rendered at: style="height: 48px; width: auto; object-fit: contain; display: block;"
    ```
  - `legacy/page-verifikasi-surat.php` (L376–L379):
    ```php
    // Logo Resmi Kop Surat (BS-X-PTV.webp) melalui /wp-content
    $bs_file = WP_CONTENT_DIR . '/uploads/BS-X-PTV.webp';
    $bs_logo_url = '/wp-content/uploads/BS-X-PTV.webp';
    ```
- **Kondisi Kode Modern Saat Ini:**
  - `SuratIzinPdfPreview.tsx` (L266–L274) saat ini mengimpor `/assets/images/ptv-logo-white.webp` dan menerapkan CSS hack `filter: brightness(0) invert(26%) sepia(89%) ...` agar warnanya biru tua.
  - Ini **tidak sesuai** dengan logo kop surat resmi legacy yang semestinya adalah logo gabungan Bumi Shalawat & Progresif TV (`BS × PTV`).
- **Status Aset Fisik:**
  - Aset `BS-X-PTV.webp` (10,146 bytes, 323×184px) telah tersedia di `public/assets/images/BS-X-PTV.webp`.
  - Terverifikasi tampil pada preview Generator Surat Izin (`SuratIzinPdfPreview.tsx`) dengan dimensi 48px height × 84px width, serta tertanam fisik di binary PDF 1.4 (`docPdfPrinter.ts`) via JPEG XObject `/ImLogo` (DCTDecode).

---

## 5. KESIMPULAN & HASIL VERIFIKASI AKHIR

1. **Contextual Skeleton Loading:** Seluruh 26 modul/halaman aktif (di luar modul Keuangan yang diisolasi) telah berhasil dimigrasikan dari spinner/teks mentah ke unified skeleton components (`src/shared/components/skeletons/`) dengan shimmer effect R03 yang halus, layout-preserving (pencegahan CLS), serta cache-first behavior (`loading && data.length === 0`).
2. **Page Transitions:** Transisi global Subtle Fade + Lift (200ms, `translateY(6px) -> 0`, `opacity 0 -> 1`, ease-out) telah aktif pada kontainer `#view` di `HubShell.tsx`. Sidebar desktop, header, dan floating dock mobile terisolasi sehingga tidak mengalami flicker saat navigasi rute.
3. **Patuhi Guardrail Keuangan:** Modul `/hub/keuangan` (Finance151) sama sekali tidak dimodifikasi (strict read-only untuk kelancaran paralel Codex).
4. **Paritas Penuh Kop Surat Logo (BS × PTV):**
   - Berkas fisik `BS-X-PTV.webp` tersedia di `public/assets/images/BS-X-PTV.webp`.
   - Preview Generator Surat Izin terverifikasi memuat logo resmi dengan proporsi dan posisi legacy PHP (height 48px, object-fit contain, text-align right pada header institusi).
   - Unduhan PDF resmi (`downloadOfficialDocPdf`) terverifikasi menanam gambar logo XObject di posisi koordinat exact (`84.26 0 0 48 50 752 cm`), bukan sekadar preview.
5. **Status Pengujian:**
   - `npm run typecheck`: **PASS (0 error)**
   - `npm run lint`: **PASS (0 warning)**
   - Regression suite:
     - `loadingTransitionsRegression.test.tsx`: **PASS (6/6)**
     - `docPdfPrinter.test.ts`: **PASS (1/1)**
     - `generatorSurat.test.ts`: **PASS (7/7)**
     - `acara.test.ts` & `arsip.test.ts`: **PASS (28/28)**
   - Visual QA Playwright: Berhasil meng-capture render live di Chrome:
     - `vqa-dev188-generator-desktop.png` (Generator Desktop dengan logo live)
     - `vqa-dev188-generator-mobile.png` (Generator Mobile dengan logo live)
     - `vqa-dev188-generator-preview-live.png` (Crop kertas preview)
     - `vqa-dev188-official-pdf-rendered.png` (PDF hasil unduhan di-render di Chrome)

