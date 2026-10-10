# PTV PRO HUB — DESIGN SYSTEM MANUAL
## PTV Unified Continuous Curve & SF Pro Display Universal Typography

> **Status:** APPROVED & MANDATORY GLOBAL PERMANENT STANDARD  
> **Permanent Core Standard:** **Every PTV PRO Hub component must use the canonical smoothed continuous curve system and SF Pro Display universal typography.**  
> **Target Products:** PTV PRO Hub (`/hub`), Login, HubShell, Beranda, Inventaris, Detail Alat, Nilai Inventaris, Peminjaman, Kru, PTVSelect, modal dialogs, and all future modules.  
> **Inspirasi Visual:** Bahasa bentuk keluarga perangkat Apple premium (MacBook, iPad, iPhone) dan Google Pixel Material 3 (Continuous Squircle Alignment & Concentric Contour Geometry).  
> **Aturan Wajib:** Seluruh halaman PTV PRO Hub yang sudah dibangun atau yang akan dimigrasikan/dibangun WAJIB mematuhi sistem sudut continuous dan tipografi universal SF Pro Display tanpa pengecualian.

---

## 1. DESIGN PHILOSOPHY: ONE CURVE FAMILY, EVERY COMPONENT

Filosofi dasar desain antarmuka PTV PRO Hub adalah:

**"ONE CURVE FAMILY, EVERY COMPONENT."**

Maksudnya bukan menyamakan angka `border-radius` semua elemen, melainkan membuat semua komponen menggunakan **profil lengkungan continuous yang sama**, walaupun ukuran, dimensi, dan kedalaman radiusnya berbeda.

### Karakteristik Profil Kurva:
- **Soft & Smooth:** Lembut, organik, dan elegan tanpa terasa kekanak-kanakan.
- **Continuous, bukan Rounded Kaku:** Transisi dari sisi lurus ke titik lengkung berlangsung mulus (continuous tangent), meniru kelengkungan superellipse/squircle ($n \approx 3-4$).
- **Proporsional Lintas Skala:** Proporsi kurva terjaga konsisten dari tombol kecil hingga modal besar.
- **Bukan Kapsul Arbitrer:** Tidak memaksakan bentuk pill/kapsul pada kontrol form persegi panjang.
- **Concentric Nested Harmony:** Elemen bersarang mengikuti kontur induknya secara harmonis.
- **Zero Hallucination:** Tidak mengubah struktur layout WordPress legacy atau launcher `/` tanpa otorisasi.

---

## 2. PTV UNIFIED CONTINUOUS CURVE TOKENS

### 2.1 Final Token Scales (`:root`)

Tokens didefinisikan secara kanonikal di `src/styles/tokens.css` dan diimpor ke `src/styles/dashboard.css`:

```css
:root {
  /* ── PTV Unified Continuous Curve System ── */
  --ptv-curve-xs: 6px;       /* Micro badges, inline tags (h: 18-24px) */
  --ptv-curve-sm: 9px;       /* Small controls, compact buttons (h: 28-34px) */
  --ptv-curve-md: 12px;      /* Standard controls: inputs, PTVSelect triggers, buttons (h: 38-46px) */
  --ptv-curve-lg: 16px;      /* Floating menus, sub-panels, nested cards (h: 80-240px) */
  --ptv-curve-xl: 22px;      /* Standard cards, bento grid items, surface panels */
  --ptv-curve-2xl: 28px;     /* Modal dialogs, prominent bento containers, hero cards */
  --ptv-curve-3xl: 34px;     /* Drawers, floating bottom sheets, master surfaces */
  --ptv-curve-pill: 9999px;  /* Pill chips (.fchip), status tags, progress bars */
  --ptv-curve-circle: 50%;   /* Avatars, circular action icon buttons, indicator dots */

  /* ── Concentric Inset Offsets: R_inner ≈ max(0, R_outer - inset) ── */
  --ptv-concentric-inset-xs: 4px;
  --ptv-concentric-inset-sm: 6px;
  --ptv-concentric-inset-md: 10px;
  --ptv-concentric-inset-lg: 12px;

  /* ── Backward Compatibility Aliases (Phase 1 Codebase) ── */
  --ptv-corner-xs: var(--ptv-curve-xs);
  --ptv-corner-sm: var(--ptv-curve-md);
  --ptv-corner-md: var(--ptv-curve-lg);
  --ptv-corner-lg: var(--ptv-curve-xl);
  --ptv-corner-xl: var(--ptv-curve-2xl);
  --ptv-corner-2xl: var(--ptv-curve-3xl);
  --ptv-corner-pill: var(--ptv-curve-pill);
  --ptv-corner-circle: var(--ptv-curve-circle);
}
```

### 2.2 Optical Size Adjustment Matrix

| Token CSS | Radius Nilai | Dimensi / Target | Penggunaan Komponen Hub |
|---|---|---|---|
| `--ptv-curve-xs` | 6px | Tinggi 18–24px | Tag mikro, kode inventaris (`.ptv-nilai-badge-code`), unit counter |
| `--ptv-curve-sm` | 9px | Tinggi 28–34px | Small button (`btn sm`), mini filter trigger, reset filter badge |
| `--ptv-curve-md` | 12px | Tinggi 38–46px | Standard control: text input, `.ptv-select-trigger`, thumbnail gambar |
| `--ptv-curve-lg` | 16px | Tinggi 60–240px | Floating menu (`.ptv-select-menu`), sub-panel dossier, price highlight banner |
| `--ptv-curve-xl` | 22px | Lebar 280–900px | Kartu katalog (`.card`, `.ptv-nilai-card`), KPI bento metric card |
| `--ptv-curve-2xl` | 28px | Lebar 400–700px | Modal dialog envelope, prominent bento container |
| `--ptv-curve-3xl` | 34px | Full-width / view | Mobile drawer, bottom sheet (`.sheet`), master overlay |
| `--ptv-curve-pill` | 9999px | Variable width | Pill chips (`.fchip`), status badges, coverage progress bar |
| `--ptv-curve-circle` | 50% | 1:1 Aspect ratio | Avatar profil (`.user-avatar`), quick action FAB, unit dot indicator |

---

## 3. CONCENTRIC NESTED ALIGNMENT RULES

### 3.1 Formula Keselarasan Kontur & Inset Aktual

Untuk menghindari efek **"padding pinch"** (sudut elemen anak tampak mencuat keluar menembus sudut induk atau terlihat tercekik kaku), radius sudut elemen bersarang dihitung menggunakan rumus konsentris:

$$R_{\text{inner\_math}} = \max(0, R_{\text{outer}} - \text{Inset}_{\text{aktual}})$$

Di mana **Inset Aktual** diukur secara fisik dari batas terluar kontainer induk:
$$\text{Inset}_{\text{aktual}} = \text{padding} + \text{border}$$

### 3.2 Transparansi: Inset Aktual vs. Penyesuaian Optis

Ketika hasil matematis murni menghasilkan angka di luar skala token (misalnya 4.5px, 6px, atau 10px), sistem membedakan secara jujur antara nilai matematis murni dan penyesuaian optis yang dipilih:

1. **Kasus 1: Kartu Konten ($R=22\text{px}$) & Thumbnail Media ($R=12\text{px}$):**
   - Induk: `.ptv-nilai-card` memiliki $R_{\text{outer}} = 22\text{px}$ (`--ptv-curve-xl`), padding 10px, border 2px (border-box).
   - Inset fisik aktual: $10\text{px}$.
   - $R_{\text{math}} = 22\text{px} - 10\text{px} = 12\text{px}$.
   - Token dirender: `--ptv-curve-md` ($12\text{px}$).
   - **Status:** Kesesuaian 100% identik secara matematis.

2. **Kasus 2: Modal Dialog ($R=28\text{px}$) & Sub-Panel Dossier ($R=16\text{px}$):**
   - Induk: Modal envelope memiliki $R_{\text{outer}} = 28\text{px}$ (`--ptv-curve-2xl`), padding 12px.
   - Inset fisik aktual: $12\text{px}$.
   - $R_{\text{math}} = 28\text{px} - 12\text{px} = 16\text{px}$.
   - Token dirender: `--ptv-curve-lg` ($16\text{px}$).
   - **Status:** Kesesuaian 100% identik secara matematis.

3. **Kasus 3: Sub-Panel ($R=16\text{px}$) & Form Control / Dropdown ($R=12\text{px}$):**
   - Induk: Sub-panel memiliki $R_{\text{outer}} = 16\text{px}$, padding 10px.
   - Inset fisik aktual: $10\text{px}$.
   - $R_{\text{math}} = 16\text{px} - 10\text{px} = 6\text{px}$ (`--ptv-curve-xs`).
   - Token aktual dirender: `--ptv-curve-md` ($12\text{px}$).
   - **Penjelasan Penyesuaian Optis:** Sesuai standar Human Interface Guidelines dan ergonomi sentuhan (affordance interaktif), kontrol tombol dan dropdown input memerlukan lengkungan minimal $12\text{px}$ agar dapat dibedakan secara visual dari tag pasif atau teks label kaku. Nilai ini adalah penyesuaian fungsional yang disengaja.

---

## 4. CSS STRATEGY & EMPIRICAL BROWSER RENDERING FACTS

### 4.1 Realitas Rendering Browser Saat Ini vs. Teori Squircle

Sistem dokumentasi PTV berpegang pada **integritas empiris**:
- **Realitas Browser Saat Ini (Chromium, Firefox, Safari default):**  
  Mesin render browser merender properti CSS standar `border-radius: R` sebagai **busur lingkaran kuadran ($n = 2.0$)**, bukan superellipse kontinyu ($n \approx 3.5$). Ketika berbagai ukuran komponen (12px, 16px, 22px, 28px) dinormalisasi ke skala referensi yang sama, garis-garis kurva berimpit pada busur lingkaran $n = 2.0$.
- **Karakter Sistem Saat Ini:**  
  Sistem PTV saat ini beroperasi secara jujur sebagai **satu keluarga radius proporsional harmonis berbusur lingkaran ($n = 2.0$)**, dengan rasio transisi optis yang rapi dan konsisten di seluruh hierarki antarmuka.
- **Progressive Squircle Enhancement (`corner-shape: squircle`):**  
  Rule `@supports (corner-shape: squircle)` telah diimplementasikan di `dashboard.css`. Ketika spesifikasi W3C Box Corners Level 4 diaktifkan oleh peramban di masa mendatang, profil kurva akan otomatis bertransisi ke kurva superellipse ($n \approx 3.5$) tanpa mengubah layout.

```css
@supports (corner-shape: squircle) {
  .ptv-squircle,
  .ptv-continuous-curve,
  .ptv-curve-xs,
  .ptv-curve-sm,
  .ptv-curve-md,
  .ptv-curve-lg,
  .ptv-curve-xl,
  .ptv-curve-2xl,
  .ptv-curve-3xl,
  .ptv-select-trigger,
  .ptv-select-menu,
  .ptv-nilai-kpi-card,
  .ptv-nilai-card,
  .ptv-nilai-filter-bar,
  .card,
  .sheet {
    corner-shape: squircle;
  }
}
```

---

## 5. REUSABLE CUSTOM DROPDOWN: `PTVSelect`

Komponen `PTVSelect` terintegrasi penuh ke dalam sistem PTV Unified Continuous Curve dan SF Pro Display Universal Typography:
- **Trigger Button:** Radius `var(--ptv-curve-md)` (12px), tinggi konsisten 40px (size `md`), 34px (size `sm`), 48px (size `lg`).
- **Floating Menu:** Radius `var(--ptv-curve-lg)` (16px), padding 5px, backdrop blur, elevation shadow halus.
- **Option Items:** Radius `var(--ptv-curve-sm)` (9px) untuk keselarasan konsentris terhadap menu 16px.
- **Universal Typography Inheritance:** Trigger, menu, search input, dan item opsi mewarisi `--ptv-font-family` secara eksplisit, baik saat dirender in-DOM maupun saat dirender melalui React Portal ke `document.body`.
- **W3C Accessibility:** ARIA combobox/listbox, auto-flip positioning, full keyboard navigation (Tab, ArrowKeys, Enter, Escape).

---

## 6. SF PRO DISPLAY UNIVERSAL TYPOGRAPHY SPECIFICATION

> **Standar Permanen:** **SF Pro Display adalah font utama dan universal seluruh PTV PRO Hub.**  
> Diterapkan sebagai self-hosted webfont berformat WOFF2 untuk menjamin konsistensi visual 100% identik di Windows, Android, macOS, dan iOS tanpa ketergantungan pada font sistem operasi.  
> Berlaku mutlak pada: Login Hub, HubShell, Sidebar, Header, Mobile Bottom Nav, Beranda, Inventaris, Detail Alat, Nilai Inventaris, Peminjaman, seluruh form input, textarea, button, dropdown PTVSelect, tabel, kartu, modal dialog, drawer, sheet, popover, tooltip, portal React, halaman `/hub/design-system`, dan seluruh modul Hub yang akan dibangun.

### 6.1 Typography Tokens (`:root`)

```css
:root {
  /* ── Universal PTV PRO Hub Typography Tokens ── */
  --ptv-font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  --ptv-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  --font: var(--ptv-font-family);
  --font-sans: var(--ptv-font-family);
}

.ptv-hub-root {
  --ptv-font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  font-family: var(--ptv-font-family);
  font-synthesis: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### 6.2 Sumber Resmi, Konversi WOFF2 & Implementasi Lokal

- **Sumber Resmi:** Apple SF Pro Display asli (berkas OpenType PostScript CFF `.otf`).
- **Konversi Webfont WOFF2:** Dikonversi secara presisi menggunakan `fontTools` dan `brotli` ke format `.woff2` teroptimasi web.
- **Cakupan Karakter Lengkap:** Mempertahankan 100% glif Basic Latin, Latin-1 Supplement, Latin Extended A & B, ortografi bahasa Indonesia, mata uang (Rupiah `Rp`, USD `$`, EUR `€`, dsb.), tanda baca, simbol matematika, dan seluruh fitur OpenType (`layout_features=['*']` termasuk kerning dan tabular numbers).
- **Hasil Ukuran Kompresi Aktual:**
  - `SF-Pro-Display-Regular.woff2`: 241,7 kB (Weight 400)
  - `SF-Pro-Display-Medium.woff2`: 274,3 kB (Weight 500)
  - `SF-Pro-Display-Semibold.woff2`: 274,3 kB (Weight 600)
  - `SF-Pro-Display-Bold.woff2`: 266,1 kB (Weight 700)
  - *Total paket 4 bobot:* ~1,05 MB (reduksi efisien dibanding file OTF mentah 30,35 MB).
- **Penyimpanan Lokal:** Disimpan secara mandiri di `/public/assets/fonts/sf-pro-display/`.
- **Preload Selektif di `index.html`:**
  Hanya melakukan preload untuk 2 bobot kritis viewport awal (Regular 400 dan Semibold 600):
  ```html
  <link rel="preload" href="/assets/fonts/sf-pro-display/SF-Pro-Display-Regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/fonts/sf-pro-display/SF-Pro-Display-Semibold.woff2" as="font" type="font/woff2" crossorigin>
  ```
- **Deklarasi `@font-face` Terstruktur:**
  ```css
  @font-face {
    font-family: "SF Pro Display";
    src: url("/assets/fonts/sf-pro-display/SF-Pro-Display-Regular.woff2") format("woff2");
    font-weight: 400; font-style: normal; font-display: swap;
  }
  @font-face {
    font-family: "SF Pro Display";
    src: url("/assets/fonts/sf-pro-display/SF-Pro-Display-Medium.woff2") format("woff2");
    font-weight: 500; font-style: normal; font-display: swap;
  }
  @font-face {
    font-family: "SF Pro Display";
    src: url("/assets/fonts/sf-pro-display/SF-Pro-Display-Semibold.woff2") format("woff2");
    font-weight: 600; font-style: normal; font-display: swap;
  }
  @font-face {
    font-family: "SF Pro Display";
    src: url("/assets/fonts/sf-pro-display/SF-Pro-Display-Bold.woff2") format("woff2");
    font-weight: 700; font-style: normal; font-display: swap;
  }
  ```

### 6.3 Weight Mapping & Typographic Hierarchy (400–700)

| Weight | Nama Token / CSS | Komponen & Peruntukan di PTV PRO Hub |
|---|---|---|
| **400** | Regular (`font-weight: 400`) | Body copy, deskripsi alat, data sel tabel, teks bantuan form |
| **500** | Medium (`font-weight: 500`) | Input control value, placeholder trigger dropdown, sub-label metadata, navigasi |
| **600** | Semibold (`font-weight: 600`) | Tombol sekunder & tindakan, header kolom tabel, pill badge status, tab aktif |
| **700** | Bold (`font-weight: 700`) | CTA primer, judul kartu, judul seksi, judul modal dialog, angka KPI display (`.num`), master brand |

### 6.4 Portal & Modal Font Inheritance

Komponen yang dirender di luar hierarki DOM root Hub (misalnya `PTVSelect` yang menggunakan `createPortal(..., document.body)` atau modal dialog yang di-portal) memiliki aturan font eksplisit yang mengikat ke token `--ptv-font-family`:
```css
.ptv-select-wrapper,
.ptv-select-menu,
.ptv-select-menu-portal,
.modal,
.sheet {
  font-family: var(--ptv-font-family, inherit);
}
```
Aturan ini menjamin bahwa seluruh portal dan floating surface mewarisi tipografi SF Pro Display tanpa mengontaminasi root launcher `/` atau produk legacy lainnya.

---

## 7. ATURAN PENGECUALIAN YANG DIPERBOLEHKAN

Bentuk khusus yang diperbolehkan di luar skala continuous curve standar:
1. **Pill (`--ptv-curve-pill: 9999px`):**
   - Filter chips interaktif (`.fchip`).
   - Status badge alat (`.inv-prod-status-badge`, `.badge-pill`).
   - Progress bar (misal: coverage nilai inventaris).
2. **Circle (`--ptv-curve-circle: 50%`):**
   - User profile avatar (`.user-avatar`).
   - Circular action button / FAB.
   - Status availability dot (hijau/kuning/merah).

---

## 8. CARA MEMVALIDASI KONSISTENSI VISUAL

### 8.1 Visual Fixture Inspection (`/hub/design-system`)

Kunjungi rute pengujian internal `/hub/design-system`:
1. **Tab 1: Corner Superimposed Overlay & Normalized Validation:**
   - **Mode 1 (Outline-Only Origin Overlay):** Membandingkan lintasan lengkungan Control (12px, cyan), Panel (16px, purple), Card (22px, emerald), Modal (28px, amber), dan Drawer (34px, rose) pada titik origin $(0,0)$ dengan background transparan dan kontrol zoom ($1\times, 2\times, 3\times$).
   - **Mode 2 (Normalized Curve Comparison):** Menormalkan kurva ke skala referensi seragam ($R = 120\text{px}$) pada origin $(0,0)$. Membuktikan secara empiris bahwa seluruh kurva berimpit sempurna pada profil geometris yang identik.
   - **Mode 3 (Empirical Browser Rendering vs. Theory):** Membandingkan secara langsung kurva teoretis Apple squircle ($n = 3.5$, garis putus-putus emas), kurva teoretis busur lingkaran ($n = 2.0$, garis putus-putus biru), dan kurva CSS nyata yang dirender peramban (garis solid hijau).
2. **Tab 2: Concentric Nested Alignment (Actual Inset Breakdown):**
   - Menampilkan audit inset aktual ($\text{padding} + \text{border}$) vs. $R_{\text{inner}}$ matematis.
   - Menguji Kasus 1 (Card $\to$ Thumb), Kasus 2 (Modal $\to$ Sub-panel $\to$ Control), dan kalkulator interaktif live slider.
3. **Tab 3: Optical Size Matrix & Token Catalog:**
   - Demonstrasi komponen nyata Hub di setiap tingkatan token.
4. **Tab 4: SF Pro Display Universal Typography & Portal Inheritance:**
   - Visual inspection status token `--ptv-font-family` (`"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`), status self-hosted WOFF2 (5 bobot: 400, 500, 600, 700, 800), numeral alignment, dan pembuktian empiris pewarisan font pada dropdown in-DOM vs. portal `document.body`.

### 8.2 Automated Regression Audit Test

Jalankan:
```bash
npm test tests/hub/continuousCurveAudit.test.ts
```
Uji otomatis mencakup:
- Monotonicity skala kurva
- Validasi formula konsentris $R_{\text{inner}} = \max(0, R_{\text{outer}} - \text{inset})$
- Deteksi pelanggaran hardcoded radius inline di seluruh kode Hub TSX
- Uji faktor skala normalisasi geometris ($120/12, 120/16, 120/22, 120/28$)
- Uji penyimpangan matematis kurva superellips ($n=2$ vs $n=3.5$)
- Ekspor token `--ptv-font-family` dan `--ptv-font-mono` di `tokens.css` dan `dashboard.css`
- Pewarisan font universal pada `.app-shell`, `.login-page-root`, `.ptv-select-menu`, dan portal
- Pemetaan terpusat legacy border radius `--r-*` ke continuous curve tokens

---

## 9. CHECKLIST MIGRASI MODUL BARU

Sebelum modul baru (Jadwal, Produksi, Distribusi, Pengaturan) disetujui:
- [ ] Semua input, trigger dropdown, dan button form memakai `var(--ptv-curve-md)` (atau `sm` untuk aksi sekunder mini).
- [ ] Semua kartu dan bento container memakai `var(--ptv-curve-xl)`.
- [ ] Elemen anak di dalam kartu mengikuti formula $R_{\text{inner}} \approx \max(0, R_{\text{outer}} - \text{inset})$.
- [ ] Dropdown menggunakan `PTVSelect`.
- [ ] Seluruh teks dan komponen mewarisi `var(--ptv-font-family)` (SF Pro Display).
- [ ] Tidak ada hardcoded `borderRadius: 'Xpx'` atau `fontFamily: '...'` inline di JSX.
- [ ] Lulus pengujian otomatis `npm test tests/hub/continuousCurveAudit.test.ts`.
