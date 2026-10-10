# PTV PRO HUB — DESIGN SYSTEM MANUAL
## PTV Unified Continuous Curve & Reusable Custom Dropdown System

> **Status:** APPROVED & MANDATORY GLOBAL STANDARD  
> **Target Products:** PTV PRO Hub (`/hub`), Inventaris, Peminjaman, Nilai Inventaris, Kru, and all future modules.  
> **Inspirasi Visual:** Bahasa bentuk keluarga perangkat Apple (MacBook, iPad, iPhone) dan Google Pixel Material 3 (Continuous Squircle Alignment & Concentric Contour Geometry).  
> **Aturan Wajib:** **Seluruh halaman PTV PRO Hub yang akan dibangun atau dimigrasikan harus mengikuti PTV Unified Continuous Curve.**

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

### 3.1 Formula Keselarasan Kontur

Untuk menghindari efek **"padding pinch"** (sudut elemen anak tampak mencuat keluar menembus sudut induk), sudut elemen bersarang dihitung menggunakan rumus konsentris:

$$R_{\text{inner}} \approx \max(0, R_{\text{outer}} - \text{inset})$$

Di mana:
$$\text{inset} = \text{padding} + \text{border}$$

### 3.2 Contoh Arsitektur Bersarang di PTV Hub:

1. **Card ($R=22\text{px}$) & Thumbnail ($R=12\text{px}$):**
   - Induk: `.ptv-nilai-card` memiliki $R_{\text{outer}} = 22\text{px}$ (`--ptv-curve-xl`) dengan padding 16px.
   - Anak: `.ptv-nilai-thumb` memiliki $R_{\text{inner}} = 12\text{px}$ (`--ptv-curve-md`).
   - Inset optis $\approx 10\text{px} \rightarrow 22 - 10 = 12\text{px}$. Kontur sejajar dan harmonis.

2. **Modal ($R=28\text{px}$), Inner Dossier ($R=16\text{px}$), & Input Control ($R=12\text{px}$):**
   - Level 1 (Modal): $R = 28\text{px}$ (`--ptv-curve-2xl`), padding 12px.
   - Level 2 (Sub-panel): $R = 28 - 12 = 16\text{px}$ (`--ptv-curve-lg`), padding 4px.
   - Level 3 (Input/Trigger): $R = 16 - 4 = 12\text{px}$ (`--ptv-curve-md`).

3. **Dropdown Trigger ($R=12\text{px}$) & Floating Menu ($R=16\text{px}$) & Option Item ($R=10\text{px}$):**
   - Menu Floating: $R = 16\text{px}$ (`--ptv-curve-lg`), padding 6px.
   - Option Hover Item: $R = 16 - 6 = 10\text{px}$ (`--ptv-curve-sm` / `--ptv-corner-sm`).

---

## 4. CSS STRATEGY & PROGRESSIVE SQUIRCLE ENHANCEMENT

### 4.1 Native Fallback vs. Squircle Enhancement

- **Baseline Fallback (Semua Browser):**  
  Menggunakan `border-radius: var(--ptv-curve-*)`. Seluruh browser modern (Chrome, Edge, Firefox, Safari iOS & macOS) mendukung akselerasi perangkat keras, rendering subpixel, dan transisi tanpa glitch.
- **Progressive Enhancement (`corner-shape: squircle`):**  
  Untuk browser masa depan yang mendukung CSS Box Corners Spec:
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
- **Catatan Realistis Kompatibilitas:**  
  Jangan mengklaim bentuk squircle identik 100% lintas browser jika implementasi internal browser masih berbeda. Baseline skala continuous curve PTV menjamin bahwa tanpa dukungan squircle pun, proporsi kelengkungan tetap selaras sebagai satu keluarga bentuk.

---

## 5. REUSABLE CUSTOM DROPDOWN: `PTVSelect`

Komponen `PTVSelect` terintegrasi penuh ke dalam sistem PTV Unified Continuous Curve:
- **Trigger Button:** Radius `var(--ptv-curve-md)` (12px), tinggi konsisten 40px (size `md`), 34px (size `sm`), 48px (size `lg`).
- **Floating Menu:** Radius `var(--ptv-curve-lg)` (16px), padding 6px, backdrop blur, elevation shadow halus.
- **Option Items:** Radius `var(--ptv-curve-sm)` (10px / 9px) untuk keselarasan konsentris terhadap menu 16px.
- **W3C Accessiblity:** ARIA combobox/listbox, auto-flip positioning, full keyboard navigation (Tab, ArrowKeys, Enter, Escape).

---

## 6. ATURAN PENGECUALIAN YANG DIPERBOLEHKAN

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

## 7. CARA MEMVALIDASI KONSISTENSI VISUAL

1. **Visual Fixture Inspection Route:**
   - Kunjungi rute pengujian internal: `/hub/design-system`
   - Buka tab:
     - **Optical Size Matrix:** Membandingkan rendering kontrol kecil, dropdown, kartu, dan modal.
     - **Concentric Nested Alignment:** Memeriksa keselarasan padding dan contour tracing.
     - **Corner Superimposed Overlay:** Meneliti sudut-sudut yang disejajarkan pada origin (0,0) untuk memvalidasi kelurusan tangen.
2. **Automated Regression Audit Test:**
   - Jalankan: `npm test tests/hub/continuousCurveAudit.test.ts`
   - Test akan memindai seluruh file komponen React di `src/products/hub/**/*.tsx` dan mendeteksi adanya penggunaan radius hardcoded acak (misal `8px`, `10px`, `14px`, `18px`, `20px`).

---

## 8. CHECKLIST MIGRASI MODUL BARU

Sebelum modul baru (Jadwal, Produksi, Distribusi, Pengaturan) disetujui:
- [ ] Semua input, trigger dropdown, dan button form memakai `var(--ptv-curve-md)` (atau `sm` untuk aksi sekunder mini).
- [ ] Semua kartu dan bento container memakai `var(--ptv-curve-xl)`.
- [ ] Elemen anak di dalam kartu mengikuti formula $R_{\text{inner}} \approx \max(0, R_{\text{outer}} - \text{inset})$.
- [ ] Dropdown menggunakan `PTVSelect`.
- [ ] Tidak ada hardcoded `borderRadius: 'Xpx'` inline di JSX.
- [ ] Lulus pengujian otomatis `npm test tests/hub/continuousCurveAudit.test.ts`.
