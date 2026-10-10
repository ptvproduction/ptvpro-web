# PTV PRO Hub — Continuous Corner Design System

## Canonical Standard: Profile D (Curvature-Optimized G2 Quintic) & Soft Surface

Sistem continuous corners resmi PTV PRO Hub mengadopsi **Profile D (Curvature-Optimized G2 Quintic Bézier)** dengan **Soft Surface Treatment** sebagai standar tunggal untuk kartu, panel, kontrol, dan modal dialog.

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

### 2. Hierarki Radius & Nested Offset Kanonikal

| Token | Radius | Inset Default | Target Penggunaan |
|---|---|---|---|
| `--ptv-curve-xs` | 6px | 4px | Micro badge, status indicator |
| `--ptv-curve-sm` | 9px | 4px | Small button, compact control |
| `--ptv-curve-md` | 12px | 6px | Input field, dropdown trigger, standard button |
| `--ptv-curve-lg` | 16px | 10px | Floating menu, nested card, sub-panel |
| `--ptv-curve-xl` | 22px | 10px | Standard card, bento grid item, main surface |
| `--ptv-curve-2xl`| 28px | 12px | Modal dialog, hero banner card |
| `--ptv-curve-3xl`| 34px | 16px | Master sheet, drawer |

#### Formula Nested Corners
$$R_{\text{inner}} = \max(0, R_{\text{outer}} - \text{inset})$$

---

### 3. Soft Surface Treatment

Perlakuan permukaan kanonikal dari Surface Treatment Lab V3:
- **Fill:** `#ffffff` (Dark mode: `#0e1b2d`)
- **Border Stroke:** `0.75px` `rgba(226, 232, 240, 0.85)` (Dark mode: `rgba(255, 255, 255, 0.12)`)
- **Multi-tiered Ambient Shadow:**
  ```css
  drop-shadow(0 10px 22px rgba(15, 23, 42, 0.06)) drop-shadow(0 2px 5px rgba(15, 23, 42, 0.03))
  ```

---

### 4. Reusable Primitives

- `ContinuousSurface`: Container permukaan utama dengan SVG path underlay murni atau CSS squircle fallback. Menghindari clipping popover/dropdown.
- `ContinuousCard`: Kartu konten dan bento grid item ($R=22\text{px}$).
- `ContinuousPanel`: Panel dan section dengan nested inner harmony ($R=16\text{px}$).
- `ContinuousModalSurface`: Dialog modal melayang ($R=28\text{px}$) dengan ARIA dialog semantics.
- `ContinuousButton`: Tombol semantik dengan native accessibility dan visible focus ring.
- `ContinuousInputWrapper`: Pembungkus form input tanpa clipping dropdown.
- `ContinuousNavItem`: Item navigasi sidebar dengan active state continuous curve.
