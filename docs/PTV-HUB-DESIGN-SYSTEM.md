# PTV PRO HUB — DESIGN SYSTEM MANUAL
## Unified Continuous Corner Geometry & Reusable Custom Dropdown System

> **Status:** APPROVED & ACTIVE  
> **Target Products:** PTV PRO Hub (`/hub`), Inventaris, Peminjaman, Nilai Inventaris, Kru, and future modules.  
> **Inspirasi Visual:** Keharmonisan kurva Apple iOS / macOS dan Google Pixel Material 3 (Continuous Squircle Alignment & Concentric Geometry).

---

## 1. DESIGN PHILOSOPHY

Sistem visual PTV PRO Hub dibangun di atas prinsip:
- **Soft & Organic:** Menghilangkan sudut kaku 90° dan transisi kurva patah tanpa membuat antarmuka terasa kekanak-kanakan.
- **Continuous Curvature:** Menggunakan pendekatan *squircle / superellipse* (kelengkungan kontinu $n \approx 3-4$) yang menyatu mulus dengan garis lurus kontur elemen.
- **Concentric Harmony:** Sudut elemen bersarang (nested) harus memiliki pusat kelengkungan yang selaras, bukan radius seragam yang memicu distorsi visual ("padding pinch").
- **Consistent Control Metrics:** Seluruh kontrol formulir, input, tombol, dan trigger dropdown memiliki ketinggian, ketebalan border, dan focus state yang seragam.
- **Progressive Enhancement:** Dukungan fitur mutakhir (`corner-shape: squircle`) dimanfaatkan bila tersedia di browser pengguna, dengan fallback `border-radius` standar yang stabil dan performan.
- **Zero Hallucination:** Tidak mengubah layout launcher `/` atau WordPress legacy tanpa justifikasi.

---

## 2. CONTINUOUS CORNER GEOMETRY TOKENS

### 2.1 Final Token Scales (`:root`)

Tokens didefinisikan secara terpusat pada `src/styles/tokens.css` dan `src/styles/dashboard.css`:

```css
:root {
  /* ── Unified Continuous Corner Geometry System ── */
  --ptv-corner-xs: 6px;       /* Micro elements, internal status tags, nested badges */
  --ptv-corner-sm: 10px;      /* Controls, input, buttons, select triggers, table row items */
  --ptv-corner-md: 14px;      /* Floating dropdown menus, nested cards, inner modal panels */
  --ptv-corner-lg: 20px;      /* Standard cards, bento containers, modal dialog bodies */
  --ptv-corner-xl: 28px;      /* Large drawers, floating bottom sheets, hero containers */
  --ptv-corner-2xl: 36px;     /* Prominent hero wrappers, master panels */
  --ptv-corner-pill: 9999px;  /* Filter chips, status pills, search pills */
  --ptv-corner-circle: 50%;   /* User avatars, circular action icon buttons */

  /* ── Inset Geometry Defaults ── */
  --ptv-concentric-inset-xs: 4px;
  --ptv-concentric-inset-sm: 6px;
  --ptv-concentric-inset-md: 8px;
}
```

### 2.2 Token Mapping Matrix

| Token | Ukuran (px) | Penggunaan Utama | Contoh Komponen |
|---|---|---|---|
| `--ptv-corner-xs` | 6px | Sub-elemen mikro, mini tag | Quick badge di dalam tabel, indikator status |
| `--ptv-corner-sm` | 10px | Form controls, trigger, dropdown items | `<input>`, `.ptv-select-trigger`, `.ptv-select-item` |
| `--ptv-corner-md` | 14px | Floating panels, nested container | `.ptv-select-menu`, inner card grouping |
| `--ptv-corner-lg` | 20px | Kartu utama, bento cards, surface | `.card`, `.ptv-nilai-card`, modal surfaces |
| `--ptv-corner-xl` | 28px | Drawers, dialogs, bottom sheets | `.sheet`, `.loan-mobile-drawer`, detail modal |
| `--ptv-corner-2xl` | 36px | Master panels | Prominent showcase banner |
| `--ptv-corner-pill` | 9999px | Filter chips & badges | `.fchip`, `.inv-prod-status-badge`, dock pills |
| `--ptv-corner-circle` | 50% | Ikon bulat & avatar | Avatar profil, close buttons, action FAB |

---

## 3. CONCENTRIC CORNER ALIGNMENT RULES

### 3.1 Teorema Hubungan Radius Bersarang

Ketika elemen berada di dalam container dengan padding/border, keselarasan kurva dijamin melalui rumus:

$$R_{\text{inner}} \approx \max(0, R_{\text{outer}} - \text{inset})$$

Di mana:
$$\text{inset} = \text{padding} + \text{border}$$

### 3.2 Contoh Implementasi Nyata

1. **Custom Dropdown Menu:**
   - Panel Floating (`.ptv-select-menu`): $R_{\text{outer}} = 14\text{px}$ (`--ptv-corner-md`), `padding: 4px`.
   - Option Item (`.ptv-select-item`): $R_{\text{inner}} = 14 - 4 = 10\text{px}$ (`--ptv-corner-sm`).
   - *Hasil:* Tidak ada sudut terhimpit; celah antara item dan batas panel tetap simetris sepanjang kurva.

2. **Katalog Kartu Alat:**
   - Kartu (`.card`): $R_{\text{outer}} = 20\text{px}$ (`--ptv-corner-lg`), `padding: 10px`.
   - Thumbnail foto (`.thumb`): $R_{\text{inner}} = 20 - 10 = 10\text{px}$ (`--ptv-corner-sm`).

3. **Modal & Inner Panel:**
   - Modal Body: $R_{\text{outer}} = 28\text{px}$ (`--ptv-corner-xl`), `padding: 14px`.
   - Inner Group Box: $R_{\text{inner}} = 28 - 14 = 14\text{px}$ (`--ptv-corner-md`).

---

## 4. BROWSER COMPATIBILITY & PROGRESSIVE ENHANCEMENT

### 4.1 Native Fallback vs. Squircle Enhancement

- **Baseline Cross-Browser Support:** Seluruh browser modern (Chrome, Edge, Safari macOS & iOS, Firefox) merender `border-radius: var(--ptv-corner-*)` dengan hardware acceleration penuh, anti-aliasing sempurna, dan tanpa clipping bug pada `box-shadow` atau `overflow`.
- **Progressive Squircle Support:**
  ```css
  @supports (corner-shape: squircle) {
    .ptv-squircle,
    .ptv-corner-sm,
    .ptv-corner-md,
    .ptv-corner-lg,
    .ptv-corner-xl,
    .ptv-corner-2xl,
    .ptv-select-trigger,
    .ptv-select-menu {
      corner-shape: squircle;
    }
  }
  ```
- **Larangan Clipping Berlebihan:** Dilarang membungkus container interaktif dengan `clip-path: path(...)` arbitrer karena mematikan `box-shadow`, merusak navigasi sub-menu, dan menimbulkan rendering flicker pada Safari iOS.

---

## 5. REUSABLE CUSTOM DROPDOWN: `PTVSelect`

### 5.1 Spesifikasi Komponen

Komponen `PTVSelect` menggantikan elemen native HTML `<select>` yang kaku menjadi dropdown interaktif, modern, dan aksesibel.

Lokasi File:
`src/shared/components/PTVSelect.tsx` (diekspor melalui `@shared/components`).

### 5.2 TypeScript Interface

```typescript
export interface PTVSelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: string;
  disabled?: boolean;
  description?: string;
}

export interface PTVSelectProps<T extends string = string> {
  id?: string;
  name?: string;
  value: T;
  onChange: (value: T) => void;
  options: PTVSelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean | string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  clearable?: boolean;
  onClear?: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
  usePortal?: boolean;
}
```

### 5.3 States & Visual Feedback

- **Default Trigger:** Ketinggian konsisten (size `md` = 40px, `sm` = 34px, `lg` = 48px). Border tipis 1px `var(--line)`. Radius `--ptv-corner-sm` (10px).
- **Hover:** Border berubah halus ke `var(--b-400)` (`#6fb0ff`) dengan transisi 150ms.
- **Active / Open:** Focus ring biru transparan `box-shadow: 0 0 0 3px color-mix(in srgb, var(--b-500) 18%, transparent)`.
- **Animated Chevron:** Ikon panah berotasi 180° menggunakan kurva bezier `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Selected Option:** Latar highlight lembut `var(--b-050)` (dark: `var(--b-100)`), font-weight 600, teks warna `var(--b-700)`, dan ikon checklist (`fa-check`).
- **Collision Detection & Auto-Flip:** Bila jarak ke dasar layar < 220px dan ruang atas lebih lega, menu otomatis membuka ke atas (`placement-top`).
- **Dark Mode Support:** Otomatis menyesuaikan palet warna gelap (`--surface: #0e1b2d`, `--bg-2: #0a1626`, shadow pekat).

### 5.4 Aksesibilitas & Keyboard Navigation

- **W3C ARIA Combobox / Listbox:**
  - Trigger: `role="combobox"`, `aria-expanded`, `aria-haspopup="listbox"`, `aria-controls`.
  - Floating panel: `role="listbox"`, `aria-label`.
  - Item opsi: `role="option"`, `aria-selected`, `aria-disabled`.
- **Keyboard Shortcut:**
  - `Enter` / `Space` pada trigger: Buka / tutup dropdown.
  - `ArrowDown` / `ArrowUp`: Navigasi antar-opsi (otomatis melewati opsi disabled).
  - `Enter` pada opsi terpilih: Memilih opsi dan menutup menu.
  - `Escape`: Menutup dropdown dan mengembalikan fokus ke trigger button.
  - `Tab`: Menutup dropdown dan memindahkan fokus secara alami ke kontrol form berikutnya.
  - *Auto Scroll into View:* Opsi yang disorot via keyboard otomatis di-scroll ke area tampak.

---

## 6. CONTOH PENGGUNAAN

### 6.1 Filter Bar Dropdown (React)

```tsx
import { useState } from 'react';
import { PTVSelect } from '@shared/components';

export function FilterExample() {
  const [status, setStatus] = useState('semua');

  return (
    <div style={{ width: '220px' }}>
      <PTVSelect
        id="filterStatus"
        value={status}
        onChange={(val) => setStatus(val)}
        options={[
          { value: 'semua', label: 'Semua Status Nilai' },
          { value: 'Aktif', label: 'Aktif' },
          { value: 'Belum Dicatat', label: 'Belum Dicatat' },
        ]}
        ariaLabel="Filter Status"
      />
    </div>
  );
}
```

### 6.2 Searchable & Clearable Dropdown (React)

```tsx
<PTVSelect
  value={selectedKategori}
  onChange={setSelectedKategori}
  searchable
  searchPlaceholder="Cari kategori..."
  clearable
  onClear={() => setSelectedKategori('')}
  options={kategoriList.map(k => ({ value: k.id, label: k.name }))}
  placeholder="Pilih Kategori"
/>
```

---

## 7. ATURAN PENGECUALIAN GEOMETRI (GEOMETRY EXCEPTIONS)

Bentuk berikut diizinkan dan dipertahankan demi identitas visual dan ergonomi:

1. **Pill (`--ptv-corner-pill: 9999px`):**
   - Filter chips interaktif (`.fchip`).
   - Status badge alat (`.inv-prod-status-badge`, `.badge-pill`).
   - Floating search bar pill pada mobile header.
2. **Circle (`--ptv-corner-circle: 50%`):**
   - User profile avatar (`.user-avatar`).
   - Quick action button (`.loan-mobile-close-all-btn`, floating add button).
   - Indikator dot ketersediaan unit.
3. **Legacy Dashboard Bento Containers:**
   - Bento items asli `page-dasbor.php` yang menggunakan radius 18px-24px tetap dipertahankan sesuai fidelitas migrasi.

---

## 8. ANTI-PATTERNS (YANG DILARANG)

1. **Dilarang memakai angka radius acak inline:**  
   Hindari `borderRadius: '7px'`, `11px'`, `15px'` yang tidak terdaftar dalam tokens. Gunakan selalu `var(--ptv-corner-*)`.
2. **Dilarang "Padding Pinch" (Non-Concentric):**  
   Dilarang memberi container `border-radius: 20px` dan item dalamnya juga `border-radius: 20px` dengan padding 12px. Sudut dalam akan terlihat menonjol ke luar secara aneh.
3. **Dilarang Native `<select>` tanpa PTVSelect:**  
   Jangan gunakan `<select className="input">` untuk dropdown baru di Hub. Gunakan `PTVSelect`.
4. **Dilarang CSS `overflow: hidden` yang memotong Dropdown:**  
   Pastikan container dropdown tidak memotong menu floating. Jika berada di dalam modal dengan overflow ekstrem, aktifkan prop `usePortal={true}`.
5. **Dilarang merusak launcher `/` atau WordPress luar Hub:**  
   Design tokens Hub terisolasi dan kompatibel penuh dengan layout global.

---

## 9. STANDAR WAJIB UNTUK MODUL HUB BERIKUTNYA

Setiap modul baru (Jadwal, Produksi, Distribusi, Kru Lanjutan, Pengaturan) WAJIB:
1. Memakai kontrol input bertinggi 40px (atau 44-48px untuk hero forms) dengan `--ptv-corner-sm` (10px).
2. Memakai kartu dengan `--ptv-corner-lg` (20px) dan inner element sesuai formula konsentris.
3. Memakai `PTVSelect` untuk seluruh kebutuhan pemilihan opsi.
4. Mendukung navigasi keyboard penuh (Tab, ArrowKeys, Enter, Escape).
5. Teruji pada seluruh breakpoint (Mobile 375-430px, Tablet 768px, Desktop 1280-1440px).
