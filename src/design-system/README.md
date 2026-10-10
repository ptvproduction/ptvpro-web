# PTV PRO Hub — Universal Continuous Corner Design System

## Canonical Standard: Profile D (Curvature-Optimized G2 Quintic) & Soft Surface

Sistem continuous corners resmi PTV PRO Hub mengadopsi **Profile D (Curvature-Optimized G2 Quintic Bézier)** dengan **Soft Surface Treatment** sebagai standar tunggal untuk **SELURUH** antarmuka Hub (kartu, panel, tombol, input, dropdown, tabel, navigasi, badge, dan modal dialog).

Profile D adalah **standar geometri**, bukan efek dekoratif opsional.

---

### 1. Landasan Geometri (Profile D)

Kurva sudut menggunakan kurva parametrik Bézier orde-5 (Quintic) yang menjamin kontinuitas kelengkungan $G^2$ sejati ($\kappa(0) = 0$ dan $\kappa(1) = 0$) pada sambungan garis lurus.

#### Parameter Kanonikal
- **Transition ratio ($\lambda$):** `0.45` $\implies L = R \times (1 + \lambda) = 1.45 \times R$
- **Shoulder softness ($\alpha$):** `0.38` $\implies P_1 = (0, L(1 - \alpha))$
- **Corner fullness ($\beta$):** `0.65` $\implies P_2 = (0, L(1 - \beta))$
- **Control Points (Top-Left):**
  - $P_0 = (0, L)$
  - $P_1 = (0, 0.62L)$
  - $P_2 = (0, 0.35L)$
  - $P_3 = (0.35L, 0)$
  - $P_4 = (0.62L, 0)$
  - $P_5 = (L, 0)$

#### Karakteristik
1. **$G^0$ (Posisi):** Terhubung sempurna tanpa celah.
2. **$G^1$ (Tangen):** Tangen vertikal murni di $t=0$, horizontal murni di $t=1$.
3. **$G^2$ (Kelengkungan):** Kelengkungan awal dan akhir bernilai 0, menghilangkan lonjakan sentrifugal visual.
4. **Konveksitas:** $\dot{x}\ddot{y} - \dot{y}\ddot{x} \ge 0$, tidak ada titik balik atau self-intersection.

---

### 2. Universal Proportional Radius Matrix

Radius disesuaikan secara proporsional terhadap hierarki dan dimensi fisik komponen:

| Kategori Komponen | Token CSS | Radius Nominal | Inset Default | Target Komponen Hub |
|---|---|---|---|---|
| **Micro Badge / Tag** | `--ptv-curve-xs` | 6px | 2px | Status badge, keyboard shortcut `<kbd>`, inline indicator |
| **Small Button / Control** | `--ptv-curve-sm` | 9px | 4px | Tombol filter kecil, icon button compact, chip search |
| **Input / Select / Nav** | `--ptv-curve-md` | 12px | 6px | Input field, trigger select, search bar, item sidebar `.snav` |
| **Subpanel / Dropdown / Thumb** | `--ptv-curve-lg` | 16px | 8px | Dropdown menu, table wrapper, thumbnail gambar, nested subpanel |
| **Standard Card / Panel** | `--ptv-curve-xl` | 22px | 10px | Bento cards, KPI card, stat card, announcement card |
| **Modal / Dialog / Hero** | `--ptv-curve-2xl`| 28px | 12px | Dialog modal desktop, popup bantuan login, hero banner |
| **Drawer / Bottom Sheet** | `--ptv-curve-3xl`| 34px | 16px | Sheet modal mobile, drawer peminjaman |
| **Pill Tag / Capsule** | `--ptv-curve-pill`| 9999px | — | Capsule filter `.fchip`, status tag pil |
| **Circular Indicator** | `--ptv-curve-circle`| 50% | — | Avatar kru, circular action icon buttons (lingkaran murni) |

---

### 3. Formula Concentric Nested Corners

Outer dan inner rounded corners dihitung dengan formula geometris konsisten:
$$R_{\text{inner}} = \max(0, R_{\text{outer}} - (\text{padding} + \text{border}))$$

Contoh hubungan hierarki aktual:
- **Card (22px) $\to$ Thumbnail (12px):** Inset padding 8px + border 2px = 10px ($22 - 10 = 12\text{px}$).
- **Modal (28px) $\to$ Subpanel (16px):** Inset padding 10px + border 2px = 12px ($28 - 12 = 16\text{px}$).
- **Dropdown Panel (16px) $\to$ Menu Item (9px):** Inset padding 5px + border 2px = 7px ($16 - 7 = 9\text{px}$).

---

### 4. Soft Surface Treatment

Perlakuan permukaan kanonikal dari Surface Treatment Lab V3:
- **Fill:** `#ffffff` (Mode gelap: `#0e1b2d`)
- **Border Stroke:** `0.75px` `rgba(226, 232, 240, 0.85)` (Mode gelap: `rgba(255, 255, 255, 0.12)`)
- **Multi-tiered Ambient Shadow:**
  ```css
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06), 0 2px 5px rgba(15, 23, 42, 0.03);
  /* SVG filter */
  filter: drop-shadow(0 10px 22px rgba(15, 23, 42, 0.06)) drop-shadow(0 2px 5px rgba(15, 23, 42, 0.03));
  ```

---

### 5. Strategi Rendering & Accessibility

1. **Vector Underlay Mode (`ContinuousSurface`):** Digunakan untuk kontainer surface visual khusus. Menempatkan SVG path di layer background terpisah (`z-index: 0, pointer-events: none`) tanpa `overflow: hidden`, menjamin dropdown dan popover di dalamnya tidak pernah terpotong (*zero clipping*).
2. **Progressive Squircle Mode:** Seluruh elemen interaktif semantik (`button`, `input`, `.snav`, `.bnav`, `.tbl-wrap`, dll.) menggunakan token CSS `--ptv-curve-*` dan progressive enhancement `@supports (corner-shape: squircle)`, mempertahankan native keyboard navigation, accessible focus ring (`:focus-visible`), dan performa render 60fps.
