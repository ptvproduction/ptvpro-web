# PTV HUB — ROADMAP PENYELARASAN DESAIN REVISI 03 (R03)

> [!IMPORTANT]
> **STATUS DOKUMEN: SUPERSEDED (DIGANTIKAN)**  
> Dokumen spesifik fase ini telah digantikan oleh dokumen acuan tunggal pada root repository: [`/roadmap.md`](file:///c:/Users/zidna/ptvpro/roadmap.md).  
> Silakan rujuk [`roadmap.md`](file:///c:/Users/zidna/ptvpro/roadmap.md) untuk status proyek terkini, alur aplikasi, peta kode, matriks paritas, dan roadmap pekerjaan stabil. Dokumen historis di bawah tetap dipertahankan untuk referensi detail teknis.

**Sistem:** PTV PRO Super App — Modul PTV Hub (`/hub`)  
**Dokumen Acuan:**  
- `design_guide/MASTER-PROMPT-R03.md`  
- `design_guide/PTV-Hub-Guide-R03.md`  
- Ekstraksi Token & HTML Referensi R03 (`design_guide/reference/`)  
**Status Terkini:** Tahap C — Pilot 1 Telah Diverifikasi Presisi 1:1 Berdampingan; Pilot 2 Ditunda Menunggu Review  
**Tanggal Pembaruan:** 13 Oktober 2026  

---

## 1. Status Eksekusi Tahapan

| Fase / Tahapan | Cakupan | Status | Catatan & Bukti Verifikasi |
| :--- | :--- | :--- | :--- |
| **Tahap A** | Audit visual read-only & ekstraksi standar R03 | **SELESAI** | Ekstraksi token, gap analysis komponen, isolasi lingkup Hub. |
| **Tahap B & B.1** | Fondasi desain, katalog dev, isolasi token scoped | **SELESAI** | Dev catalog terisolasi di `/hub/dev-catalog`. Shared components mendukung mode `r03`. |
| **Tahap C — Pilot 1** | Implementasi visual halaman Inventaris (`InventarisPage`) | **SELESAI (SUDUT TERVERIFIKASI)** | Bentuk sudut dipulihkan 100% mengikuti Pilot 1 awal (standard circular arc) untuk hero (24px), panel kategori (18px), kartu kategori (18px), wadah ikon (13px), kartu alat (18px), dan thumbnail (14px). Pengecualian resmi hanya bar status (pill) dan tombol "+ Alat" (pill). |
| **Tahap C — Pilot 2** | Halaman Peminjaman & LoanModal | **DITUNDA (PAUSED)** | Menunggu review dan persetujuan pengguna sebelum melanjutkan ke implementasi Pilot 2. |
| **Tahap C — Pilot 3** | Acara & halaman operasional lainnya | **PENDING** | Terjadwal setelah Pilot 2 disetujui. |
| **Tahap D** | Deployment ke staging/production | **HOLD** | Tidak ada deployment sebelum seluruh pilot disetujui. |

---

## 2. Acuan Visual Aktif Inventaris (Hasil Restorasi Terverifikasi)

### 2.1 Elemen yang Dikembalikan 100% Sesuai Baseline Pilot 1 (Bentuk Sudut & Komposisi)
1. **Bentuk Sudut (Corner Geometry)**:
   - **Keputusan Desain**: Seluruh bentuk sudut elemen Inventaris dipulihkan mengikuti mekanisme Pilot 1 awal, yaitu busur lingkaran standar (`corner-shape: round !important;` scoped pada `.r03-inventaris`).
   - Aturan `@supports (corner-shape: squircle)` dibatalkan secara terisolasi pada Inventaris agar tidak mendistorsi kelengkungan menjadi squircle continuous curvature.
   - Nilai token sudut yang dipulihkan:
     - Hero Banner: `24px` (`var(--r-ref-l)`)
     - Panel Kategori: `18px` (`var(--r-ref-m)`)
     - Kartu Kategori: `18px` (`var(--r-ref-m)`)
     - Wadah Ikon Kategori: `13px` (`var(--r-icon-box)`)
     - Kartu Alat: `18px` (`var(--r-ref-m)`)
     - Thumbnail Foto Alat: `14px` (`var(--r-thumb)`)
2. **Hero Banner**:
   - Desktop: Tinggi 205px, padding overlay 18px 24px.
   - Mobile: Tinggi 180px, padding overlay 16px 20px, teks deskripsi (*"Kelola peminjaman, monitor ketersediaan unit..."*) tampil penuh tanpa pemadatan.
3. **Kategori Alat (Category Rail)**:
   - Ukuran kartu kategori tetap 105px dengan padding `12px 10px 10px`.
   - Ukuran ikon kategori 44×44px dengan font ikon 19px.
   - Warna latar dan ikon pendamping kategori (Kamera biru muda `#EBF3FE`/`#1273E6`, Lensa ungu muda `#F3E8FF`/`#7C3AED`, Tripod sian muda `#E0F2FE`, dsb.) dipulihkan dengan fallback penuh.
4. **Katalog Produk & Kartu Alat**:
   - Grid kartu alat (`minmax(210px, 1fr)`) dengan thumbnail rasio 16:11 radius 14px circular arc.
   - Searchbar kapsul pill min-height 48px dengan teks input 16px.

### 2.2 Pengecualian Visual yang Disetujui (Desain Terbaru)
1. **Bar Filter Status**:
   - Format pill kapsul dengan kontras netral (`#E9F0F9`).
   - Menyajikan 4 filter lengkap: **Semua**, **Tersedia**, **Dipinjam**, dan **Rusak** beserta counter angka.
   - Indikator status semantik: `--ok` (hijau), `--warn` (amber), `--dang` (merah).
2. **Tombol "+ Alat"**:
   - Kapsul pill sempurna (`border-radius: 999px; min-height: 36px; padding: 0 16px; font-weight: 700`).
3. **Keterjangkauan Mobile (Overflow Reachability)**:
   - Bar status mendukung scroll horizontal mulus pada layar kecil dengan petunjuk gradasi overflow (`mask-image`).
   - Fungsi auto-scroll otomatis menggeser tombol aktif (misal "Rusak") ke area pandang saat diklik.
4. **Label Navigasi**:
   - Bottom bar mobile menggunakan Bahasa Indonesia yang disepakati (*Beranda, Acara, Inventaris, Lainnya*).

---

## 3. Bukti Verifikasi Berdampingan (*Side-by-Side*)

- **Desktop (1280×900)**: `screenshots/perbandingan_desktop_sbs.png`
- **Mobile (390×844)**: `screenshots/perbandingan_mobile_sbs.png`
- **Tangkapan Layar Tunggal Revisi**:
  - `screenshots/revisi_inventaris_desktop_light.png`
  - `screenshots/revisi_inventaris_mobile_light.png`

---

## 4. Jaminan Stabilitas

- **Vitest**: 17/17 test files lulus (143/143 tests passed).
- **TypeScript**: 0 error pada `tsc --noEmit`.
- **Production Build**: Lolos kompilasi penuh via `vite build`.
- **Integritas Modul**: Tidak ada perubahan pada backend produksi, schema, RLS, maupun modul di luar lingkup.

---

## 5. Status Migrasi Fitur “Tambah Alat” (Legacy Parity ke PTV Hub)

**Status:** **SELESAI & TERVERIFIKASI**  
**Tanggal Eksekusi:** 13 Oktober 2026  

### 5.1 Sumber Implementasi Lama (Legacy Reference)
1. **Frontend Dasbor Lama**:
   - File: [`legacy/page-dasbor.php`](file:///c:/Users/zidna/ptvpro/legacy/page-dasbor.php)
   - Fungsi kunci:
     - `openNewAsset()` (baris 29621): Konstruksi form sheet, dropdown kategori, lokasi, sumber perolehan, input jumlah, dan render box rincian unit fisik.
     - `getNextAvailableInvCode()` (baris 29595): Logika pembuatan kode inventaris otomatis (*First Available Inventory Number* — nomor terkecil >= 1 yang belum digunakan, diformat `INV-` + 3 digit).
     - `saveAsset()` (baris 30220): Validasi nama wajib, pengumpulan kondisi tiap unit fisik (`unit_conditions`), penanganan status submit, dan pencegahan submit ganda.
     - `renderUnitConditionInputs()` (baris 29539): Render interaktif baris per unit dengan tombol "Semua Baik" dan "+ Tambah Unit".
2. **Backend / Data Bridge Lama**:
   - File: [`legacy/ptv-dashboard-data-bridge.php`](file:///c:/Users/zidna/ptvpro/legacy/ptv-dashboard-data-bridge.php)
   - Handler: `ptv_dashboard_action_save_asset_cb` (baris 4282)
   - Validasi hak akses: Peran Eksekutif dan Administrasi.
   - Pengecekan kode duplikat: Anti-duplikasi dan auto-retry collision.
   - Insert relasional: Master katalog (`ptv_inventaris`) dan rincian unit fisik (`ptv_inventaris_unit`).

### 5.2 Pemetaan Paritas: Fitur Lama vs Hasil Migrasi Hub
| Fitur / Field | Implementasi Lama (`dasbor.php`) | Hasil Migrasi PTV Hub | Status Paritas |
| :--- | :--- | :--- | :--- |
| **Kode Inventaris** | Otomatis (*First Available Number* `INV-001`, `INV-002`, ...), read-only di form dengan tombol ubah manual | Otomatis via `inventarisService.getNextAvailableCode()`, badge pill `[ 🔒 Otomatis ]`, opsi toggle manual/reset | **100% Setara** |
| **Kategori** | Pilihan 11 kategori studio | Custom Dropdown `PTVSelect` dengan 12 kategori studio, wadah ikon berwarna, active checkmark | **100% Setara** |
| **Nama Alat** | Wajib diisi, trim teks | Wajib diisi, input teks placeholder *"Contoh: Sony Alpha A7 IV / Mic Wireless Rode"*, error banner jika kosong | **100% Setara** |
| **Merk / Model** | Input teks `brand` dan `model` (default `—`) | Input teks `brand` dan `model` pada Section A | **100% Setara** |
| **Lokasi Penyimpanan** | Dropdown lokasi standar + input lokasi baru (`__NEW__`) | Custom Dropdown `PTVSelect` + aksi interaktif `+ Tambah Lokasi Baru...` (dialog instan) | **100% Setara** |
| **Sumber Perolehan** | Dropdown (Yayasan, Hibah Kementerian, dll.) + input baru | Custom Dropdown `PTVSelect` + aksi interaktif `+ Tambah Sumber...` (dialog instan) | **100% Setara** |
| **Status Operasional** | Status tingkat alat ('Tersedia', 'Dipinjam', 'Rusak / Servis', 'Hilang') | Custom Dropdown `PTVSelect` Status Operasional (Section B), membedakan status alat dari kondisi unit | **100% Setara** |
| **Jumlah & Satuan** | Input angka `qty` (min 1) dan `unit` ("unit" / "set") | Input angka `jumlah` (min 1) dan `satuan` (default `"unit"`) | **100% Setara** |
| **Identitas Per Unit** | Dynamic unit list dengan nama custom, kondisi (`Baik`/`Servis`/`Rusak`), tombol "Semua Baik" & "+ Tambah Unit" | Dynamic unit rows: Nomor Urut (`#1`), Nama Unit (`Unit 01`), Custom Dropdown Kondisi Unit (`Baik`/`Butuh Servis`/`Rusak`). Tombol "Semua Baik" & "+ Tambah Unit". | **100% Setara** |
| **Nomor Seri Unit** | Input nomor seri per baris | **TIDAK ditampilkan pada form Tambah Alat** sesuai keputusan pengguna. Nomor seri diisi/diedit nanti pada form **Edit Data Alat**. Model backend tetap mempertahankan field `nomor_seri` tanpa data palsu. | **Sesuai Keputusan Pengguna** |
| **Spesifikasi & Foto** | Textarea deskripsi dan photo widget (preview, max 15MB) | Textarea deskripsi, 2 kartu upload terpisah ("Foto Alat" kamera & "Pilih dari Galeri"), preview, tombol ganti/hapus | **100% Setara** |
| **Pencegahan Submit Ganda** | Tombol disable saat request berlangsung (`opacity: 0.75`, loading spinner) | State `submitting` menonaktifkan tombol simpan dan menampilkan spinner "Menyimpan ke Inventaris..." | **100% Setara** |
| **Hak Akses (RBAC)** | `['eksekutif', 'executive'].includes(role)` | Terintegrasi dengan policy engine `can('inventory.create')` | **100% Setara** |
| **Pembaruan Daftar & Counter** | Unshift ke daftar inventaris dan render ulang | Unshift data di service, modal tertutup otomatis, list ter-refresh dan counter status terbarui | **100% Setara** |

### 5.3 File Terdampak dalam Migrasi
1. [`src/products/hub/inventaris/types.ts`](file:///c:/Users/zidna/ptvpro/src/products/hub/inventaris/types.ts): Penambahan `status_operasional`, interface `InventarisUnit`, `ItemInventaris`, `CreateUnitDTO`, dan `CreateInventarisDTO`.
2. [`src/products/hub/inventaris/inventarisService.ts`](file:///c:/Users/zidna/ptvpro/src/products/hub/inventaris/inventarisService.ts): Implementasi `getNextAvailableCode()`, `createInventaris` dengan relasi unit fisik & status operasional, serta metode `uploadPhoto(file)`.
3. [`src/shared/components/PTVSelect.tsx`](file:///c:/Users/zidna/ptvpro/src/shared/components/PTVSelect.tsx): Dukungan wadah ikon berwarna (`iconBg`, `iconColor`), pemisah opsi (`hasSeparatorBefore`), dan aksi kustom (`isAction`, `onAction`).
4. [`src/products/hub/inventaris/TambahAlatModal.tsx`](file:///c:/Users/zidna/ptvpro/src/products/hub/inventaris/TambahAlatModal.tsx): Komponen modal form baru lengkap dengan 5 dropdown custom, penataan 4 section, peniadaan input nomor seri, dan 2 aksi upload foto.
5. [`src/styles/inventaris.css`](file:///c:/Users/zidna/ptvpro/src/styles/inventaris.css): Penataan grid form, kartu upload foto putus-putus, button pill, dialog prompt, dan containment scrolling.
6. [`src/styles/dashboard.css`](file:///c:/Users/zidna/ptvpro/src/styles/dashboard.css): Styling wadah ikon berwarna `ptv-select-icon-box`, separator garis putus-putus, dan pemulihan lebar portal `min-width: 0 !important; right: auto;`.
7. [`tests/hub/inventarisPeminjaman.test.ts`](file:///c:/Users/zidna/ptvpro/tests/hub/inventarisPeminjaman.test.ts): Penambahan test suite 1.11 - 1.14 untuk pembuatan banyak unit tanpa nomor seri, pemetaan kondisi, status operasional, dan validasi foto.

### 5.4 Batas Verifikasi & Bukti Uji
- **Screenshot Form Desktop Atas (1280×900)**: `screenshots/tambah_alat_desktop.png`
- **Screenshot Form Desktop Bawah Scrolled (1280×900)**: `screenshots/tambah_alat_desktop_scrolled.png`
- **Screenshot Dropdown Kategori Terbuka**: `screenshots/tambah_alat_dropdown_kategori.png`
- **Screenshot Dropdown Lokasi Terbuka**: `screenshots/tambah_alat_dropdown_lokasi.png`
- **Screenshot Mobile Bottom Sheet (390×844)**: `screenshots/tambah_alat_mobile.png`
- **Batas Lingkungan**: Tidak membuat transaksi uji pada database produksi (pengujian dilakukan pada repository development lokal dan unit test suite terisolasi).
- **Hasil Test**:
  - `npm test`: 17 file lolos (**147/147 tests passed**).
  - `npm run typecheck`: **0 error** (`tsc --noEmit`).
  - `npm run build`: Berhasil kompilasi penuh dalam **17.79 detik** (`vite build`).
