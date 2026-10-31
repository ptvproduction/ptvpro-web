# PTV PRO — HUB LEGACY MIGRATION MAP & SYSTEM AUDIT

**Dokumen Acuan:** Penyelarasan Migrasi Dashboard WordPress ke Aplikasi PTV PRO (`/hub`)  
**Sumber Utama Tervalidasi:**  
1. `C:\Users\zidna\Local Sites\ptvrebuild\app\public\wp-content\themes\FIXPTV\page-dasbor.php` (1,734,902 bytes, 40,201 baris)
2. `C:\Users\zidna\ptvpro-web\legacy-reference\page-dasbor.php` (Identik, 1,734,902 bytes)
3. `C:\Users\zidna\Local Sites\ptvrebuild\app\public\wp-content\themes\FIXPTV\ptv-dashboard-data-bridge.php` (432,035 bytes, 8,570 baris)
4. `C:\Users\zidna\Local Sites\ptvrebuild\app\public\wp-content\themes\FIXPTV\admin-panel.css` (36,242 bytes, 495 baris)
5. `C:\Users\zidna\Local Sites\ptvrebuild\app\public\wp-content\themes\FIXPTV\admin-panel.js` (83,466 bytes)

---

## 1. LOKASI SOURCE ASLI & BUKTI AUDIT

Audit mendalam terhadap file asli membuktikan bahwa dashboard lama `https://progresiftv.id/dasbor` bukanlah aplikasi WordPress standar berbasis server-rendered HTML template, melainkan sebuah **Single-Page Application (SPA) monolitik vanilla JavaScript/CSS** yang terbungkus di dalam template `page-dasbor.php`:

* **Baris 1 – 1040:** Handler sesi WordPress, otentikasi login email/password & Google OAuth, serta stylesheet login.
* **Baris 1040 – 1150:** Inisialisasi data boot via `ptv_dashboard_get_initial_data()`, resolusi logo dinamis, kurasi background hero dari media library, dan pemuatan stylesheet pihak ketiga (Font Awesome 6.5.2, CDN font SF Pro Display & Plus Jakarta Sans, html2pdf.js, Supabase JS).
* **Baris 1150 – 10810 (Style #2, 9,654 baris):** Seluruh visual design system dashboard asli:
  * Tema Terang (Light Mode): `--bg: #F8FAFD;`, `--surface: #FFFFFF;`, `--ink: #0B2A4A;`, `--b-700: #0B5FBF;`, `--b-600: #1273E6;`, `--b-100: #DCEBFF;`, `--ok: #0F7A5A;`, `--warn: #9A6B08;`, `--dang: #B02B23;`
  * Tema Gelap (Dark Mode `[data-theme="dark"]`): `--bg: #060F1C;`, `--surface: #0E1B2D;`, `--ink: #E6F0FC;`, `--muted: #7F9ABA;`, `--line: rgba(255,255,255,.10);`
  * Layout metrics: `--header-h: 58px;`, `--dock-h: 64px;`, `--sidebar-w: 250px;`, `--maxw: 1160px;`
  * Typography: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Plus Jakarta Sans", sans-serif;`
* **Baris 10811 – 10817:** Kontainer mounting aplikasi tunggal:
  ```html
  <div id="app"></div>
  <div id="toasts"></div>
  <button id="ptvScrollTopBtn" type="button" class="ptv-scroll-top-btn"><i class="fa-solid fa-arrow-up"></i></button>
  ```
* **Baris 10818 – 40201 (Script #7, 29,380 baris):** Inti logika SPA:
  * State lokal terpusat pada objek `DB` (`DB.events`, `DB.loans`, `DB.inventory`, `DB.damages`, `DB.crew`, `DB.finance`, `DB.docs`, `DB.lost`, `DB.notes`, `DB.planners`, `DB.contacts`).
  * Sinkronisasi data live melalui endpoint AJAX: `wp-admin/admin-ajax.php?action=ptv_dashboard_get_live_data` yang didefinisikan pada `ptv-dashboard-data-bridge.php`.
  * Router berbasis kamus renderer `const RENDERERS = { ... }` yang memanggil fungsi render spesifik seperti `pgBeranda()`, `pgInventaris()`, `pgAlatDetail()`, `pgPeminjaman()`, `pgKru()`, dll.

---

## 2. PEMETAAN LENGKAP STRUKTUR LAMA KE TARGET BARU (MIGRATION MAP)

Tabel berikut memetakan setiap modul dan subhalaman asli dari `SIDEBAR` dan `PAGES` pada `page-dasbor.php` ke route aplikasi baru pada `/hub`:

| No | Modul / Halaman Lama | Key Lama (`PAGES`) & Renderer Sumber | Target Route Baru (`/hub`) | Roles / Kapabilitas Sumber | Status Migrasi Saat Ini |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A** | **Layout & Shell** | `shellHTML()`, `renderSidebar()`, `SIDEBAR` (7 grup) | `HubShell.tsx` | Global (`hub.access`) | **Sebagian / Perlu Koreksi** (Sidebar saat ini belum memiliki hierarki 7 grup asli dan belum memakai palet warna `#F8FAFD`/`#0B2A4A`) |
| **B** | **Beranda** | `beranda` (`pgBeranda()`) | `/hub/beranda` | Semua role terautentikasi | **Scaffold Baru** (Komponen buatan baru, belum menggunakan hero card dynamic photo background, mobile quick-access squircle buttons, dan card layout asli) |
| **C** | **Kru** | `kru` (`pgKru()`) | `/hub/kru` | `eksekutif`, `administrasi` (`crew.view`) | **Scaffold Baru** (Belum mengikuti grouping angkatan `groupCrewByAngkatan()`, tab filter `Aktif`, `Nonaktif`, `Pengarah`, `Pembina`, dan modal detail kru) |
| **D** | **Inventaris** | `inventaris` (`pgInventaris()`) | `/hub/inventaris` | Semua role (`inventory.view`, `inventory.create`) | **Baru Dibuat (Clean-Room)** (Bukan migrasi 1:1; belum memiliki filter Lokasi & Sumber Perolehan, multi-unit loan basket, dan tata letak kartu alat asli) |
| **E** | **Detail Alat** | `alatDetail` (`pgAlatDetail(id)`) | `/hub/inventaris/:id` | Semua role | **Belum Dimigrasikan** (Modal saat ini hanya menampilkan daftar unit sederhana tanpa hero gambar, tab pemilihan unit fisik, ekspor barcode SVG/PNG, print label, dan riwayat kerusakan/peminjaman) |
| **F** | **Nilai Inventaris** | `nilaiInventaris` (`pgNilaiInventaris()`), `pgNilaiInventarisDetail()` | `/hub/inventaris/nilai` | `eksekutif`, `administrasi`, `crew` | **Belum Dimigrasikan** |
| **G** | **Peminjaman** | `peminjaman` (`pgPeminjaman()`) | `/hub/peminjaman` | Semua role (`loans.view`, `loans.checkout`, `loans.return`) | **Baru Dibuat (Clean-Room)** (Bukan migrasi 1:1; kartu peminjaman asli mengelompokkan multi-unit per transaksi via `groupLoansByTransaction()`, memiliki tab `aktif`/`saya`/`selesai`, dan tombol kembalikan per-unit) |
| **H** | **Lapor Kerusakan** | `kerusakan` (`pgKerusakan()`) | `/hub/kerusakan` | Semua role (`damage.view`, `damage.report`) | **Belum Dimigrasikan** |
| **I** | **Lost & Found** | `lostfound` (`pgLostFound()`) | `/hub/lostfound` | Semua role (`lostfound.view`) | **Belum Dimigrasikan** |
| **J** | **Acara & Agenda** | `acara` (`pgAcara()`), `acaraDetail` (`pgAcaraDetail()`) | `/hub/acara` | Semua role (`events.view`) | **Belum Dimigrasikan** |
| **K** | **Kalender & Rundown**| `kalender` (`pgKalender()`) | `/hub/kalender` | Semua role (`calendar.view`) | **Belum Dimigrasikan** |
| **L** | **Catatan Bersama** | `catatan` (`pgCatatan()`) | `/hub/catatan` | Semua role (`notes.view`) | **Belum Dimigrasikan** |
| **M** | **ID Digital** | `id` (`pgID()`) | `/hub/id` | Semua role (`id.view`) | **Belum Dimigrasikan** |
| **N** | **Dokumen Saya** | `dokumen` (`pgDokumen()`) | `/hub/dokumen` | Semua role (`documents.view`) | **Belum Dimigrasikan** |
| **O** | **Kontak Internal & Eksternal** | `kontak` (`pgKontak()`), `kontakEksternal` (`pgKontakEksternal()`) | `/hub/kontak` | Semua role (`contacts.*`) | **Belum Dimigrasikan** |
| **P** | **Pengajuan Perizinan**| `perizinan` (`pgPerizinan()`) | `/hub/perizinan` | Semua role (`documents.request`) | **Belum Dimigrasikan** |
| **Q** | **Generator Surat Izin**| `generatorIzin` (`pgGeneratorIzin()`) | `/hub/surat/generator` | `eksekutif`, `administrasi` (`documents.generate`) | **Belum Dimigrasikan** |
| **R** | **Surat & Arsip** | `arsip` (`pgArsip()`) | `/hub/arsip` | `eksekutif`, `administrasi` (`documents.archive.*`) | **Belum Dimigrasikan** |
| **S** | **Keuangan & Kas** | `keuangan` (`pgKeuangan()`), `canAccessKeuangan()` | `/hub/keuangan` | `eksekutif`, kru operasional (`finance.*`) | **Belum Dimigrasikan** |
| **T** | **Media & Broadcast** | `broadcast` (`pgBroadcast()`), `projectHaul` (`pgProjectHaul()`), `seo` (`pgSeo()`) | `/hub/media` | `eksekutif`, `administrasi` | **Belum Dimigrasikan** |
| **U** | **Pengaturan** | `pengaturan` (`pgPengaturan()`) | `/hub/pengaturan` | Semua role (`settings.*`) | **Belum Dimigrasikan** |

---

## 3. AUDIT MENDALAM MODUL INVENTARIS: SUMBER ASLI VS IMPLEMENTASI SAAT INI

### A. Implementasi Asli (`pgInventaris` & `pgAlatDetail`)
* **Struktur Data Aset (`DB.inventory`):**
  * Properti objek aset: `id`, `code` (`INV-xxx`), `name`, `brand`, `model`, `cat` (Kategori), `loc` (Lokasi fisik), `sumber_perolehan` / `sumber` (e.g. Yayasan, Mandiri, Hibah), `photo`/`foto_url`, `status`, `unit_conditions` (array detail per-unit: `{ unit: 1, cond: 'Baik', sn: '...', unit_code: '...', status: 'Tersedia'|'Dipinjam'|'Rusak' }`).
* **Hierarki Tampilan:**
  * Header metrik inventaris (total aset, unit tersedia, unit dipinjam, unit perbaikan).
  * Filter Tab Status Utama: `Tersedia`, `Dipinjam`, `Rusak`, `Tidak tersedia`, `Hilang`, `Semua`.
  * Filter Dropdown Multi-Dimensi:
    1. Kategori (`normalizeInventoryCategory`)
    2. Lokasi (`invLocFilter` — default Studio PTV, Gudang, dll.)
    3. Sumber Perolehan (`invSourceFilter` — Yayasan, Pembelian Kru, dll.)
  * Pencarian Multi-Kolom (`invQ`): mencocokkan nama, kode, brand, model, serial number, lokasi, kategori, dan sumber.
  * Pengurutan Kanonikal (`sortInventoryItems`): Level 1 berdasarkan Kategori $\rightarrow$ Level 2 Nama A–Z.
  * Fitur **Loan Basket (`loanBasket`)**: Pengguna dapat menandai checklist unit-unit dari berbagai kartu alat langsung di halaman katalog, melihat counter keranjang (`basketCount`), dan membuka checkout multi-alat sekaligus.
  * Kartu Alat Asli:
    * Thumbnail gambar dengan aspek rasio tetap & fallback SVG kategori.
    * Tag kategori dan kode aset monospace.
    * Judul alat tebal + subjudul brand & model.
    * Status pill per unit: chip angka hijau (tersedia), merah (dipinjam), kuning (rusak/servis).
    * Tombol aksi: "Detail", "Barcode / Label", dan tombol tambah ke keranjang pinjam.
* **Halaman / Modal Detail Alat (`pgAlatDetail`):**
  * Foto hero besar dengan status badge mengambang.
  * Selector unit interaktif (tab `Unit 1`, `Unit 2`, ...).
  * Generator label Barcode SVG & PNG yang dapat di-download serta dicetak langsung (`printUnitBarcodeLabel`).
  * Tabel Riwayat Peminjaman (`DB.loans` difilter berdasarkan `item === x.id`).
  * Tabel Riwayat Laporan Kerusakan (`DB.damages` difilter berdasarkan `item === x.id`).

### B. Implementasi Saat Ini di `/hub/inventaris` (`InventarisPage.tsx`)
* **Kondisi Aktual:** Dibangun secara *clean-room* dari nol menggunakan komponen UI generic.
* **Kesenjangan (Gaps):**
  1. Palet warna menggunakan tema gelap kebiruan (`--bg-primary: #0a0f1d`), bukan tema royal blue/putih asli (`--bg: #F8FAFD;`, `--ink: #0B2A4A;`).
  2. Properti aset disederhanakan menjadi `{ kode, nama_alat, kategori, spesifikasi, lokasi_penyimpanan }`; kehilangan field `brand`, `model`, `sumber_perolehan`, `foto_url`.
  3. Filter dropdown lokasi dan sumber perolehan belum ada.
  4. Fitur keranjang peminjaman alat langsung (`loanBasket`) belum ada.
  5. Fitur ekspor barcode SVG/PNG dan cetak label belum ada.
  6. Riwayat transaksi per-alat belum ditampilkan di tampilan rincian.

---

## 4. AUDIT MENDALAM MODUL PEMINJAMAN: SUMBER ASLI VS IMPLEMENTASI SAAT INI

### A. Implementasi Asli (`pgPeminjaman`)
* **Struktur Data Transaksi (`DB.loans`):**
  * Properti per baris: `id`, `transaction_id`, `item` (ID alat), `unit_no`, `unit_code`, `by` (nama peminjam), `purpose` (keperluan), `out` (tanggal pinjam), `due` (tenggat kembali), `back` (tanggal kembali aktual / null jika aktif), `cond_back` (kondisi pengembalian), `notes`.
* **Pengelompokan Kartu Transaksi (`groupLoansByTransaction`):**
  * Data pinjaman di database tersimpan per unit item, namun di antarmuka dikelompokkan menjadi **1 Kartu Transaksi per Checkout (`transaction_id`)**.
  * 1 Kartu menampilkan:
    * Header: ID Transaksi (`TRX-...`), Badge Status gabungan (Hijau jika seluruh unit kembali, Merah/Oranye jika ada yang aktif/terlambat).
    * Peminjam & Keperluan: Nama peminjam (`grp.by`), tanggal pinjam (`grp.out`), tenggat (`grp.due`), keperluan (`grp.purpose`).
    * **Daftar Unit di Dalam Kartu:** Setiap unit yang dipinjam terdaftar dengan checkbox/badge status masing-masing.
    * **Aksi Pengembalian Parsial vs Penuh:** Terdapat tombol untuk mengembalikan unit individual (`returnSingleUnit`) atau tombol besar "Kembalikan Semua Unit Transaksi Ini" (`returnLoanTransaction`).
* **Filter & Pencarian:**
  * Tab filter: `aktif` (menampilkan transaksi yang masih memiliki unit belum kembali), `saya` (transaksi atas nama pengguna yang login), `selesai` (transaksi lunas).
  * Pencarian `loanSearchQ`: mencocokkan nomor transaksi, nama peminjam, nama alat, kode inventaris, kode unit fisik, atau keperluan.
  * Sorting: Transaksi terlambat diutamakan di paling atas, kemudian diurutkan berdasarkan tanggal pinjam terbaru.

### B. Implementasi Saat Ini di `/hub/peminjaman` (`PeminjamanPage.tsx`)
* **Kondisi Aktual:** Menampilkan kartu transaksi flat dan modal checkout baru.
* **Kesenjangan (Gaps):**
  1. Kartu transaksi saat ini belum mengelompokkan unit secara terstruktur seperti `groupLoansByTransaction` asli dengan opsi pengembalian per-unit parsial.
  2. Tab filter asli adalah `aktif`, `saya`, `selesai`; implementasi saat ini menggunakan `all`, `dipinjam`, `dikembalikan`, `terlambat`.
  3. Header metrik ringkasan global (`activeTxnCount`, `activeUnitsCount`, `overdueCount`) belum terpasang persis dengan tata letak aslinya.

---

## 5. AUDIT DATA BRIDGE DAN ENDPOINT AJAX (`ptv-dashboard-data-bridge.php`)

Modul lama berkomunikasi dengan backend WordPress menggunakan pola aksi AJAX terpusat:

1. **Pengambilan State Penuh:**  
   `wp_ajax_ptv_dashboard_get_live_data` mengembalikan JSON raksasa berisi `{ ME, DB: { events, loans, inventory, crew, ... } }`.
2. **Operasi Inventaris:**
   * `ptv_dashboard_action_save_asset`: Menyimpan/memperbarui data master alat beserta seluruh unit fisik.
   * `ptv_dashboard_action_add_unit`: Menambah unit fisik ke aset yang sudah ada.
   * `ptv_dashboard_action_update_single_unit`: Memperbarui kondisi, nomor seri, atau status unit individual.
   * `ptv_dashboard_action_delete_asset`: Menghapus aset (khusus `eksekutif`).
   * `ptv_dashboard_get_next_inv_code`: Auto-generate kode berikutnya (e.g. `INV-042`).
3. **Operasi Peminjaman:**
   * `ptv_dashboard_action_pinjam`: Checkout pinjaman multi-unit (`transaction_id`, daftar unit, nama peminjam, tenggat, keperluan).
   * `ptv_dashboard_action_return`: Pengembalian transaksi pinjaman.
   * `ptv_dashboard_return_loan_item`: Pengembalian unit individual secara parsial.

---

## 6. DAFTAR BAGIAN YANG DIBUAT DARI NOL DAN BUKAN MERUPAKAN MIGRASI

Berdasarkan audit komparasi di atas, berikut adalah bagian-bagian dalam repository `ptvpro` saat ini yang **dibangun dari nol (clean-room/scaffold baru) dan belum merefleksikan migrasi 1:1 dari source asli**:

1. **`src/products/hub/beranda/BerandaPage.tsx`:**  
   Komponen ringkasan baru buatan sendiri. Bukan migrasi dari `pgBeranda()`.
2. **`src/products/hub/kru/KruPage.tsx`:**  
   Komponen tabel kru generik. Belum mengadopsi struktur `groupCrewByAngkatan()`, tab kategori `Aktif`/`Nonaktif`/`Pengarah`/`Pembina`, serta format avatar/kartu asli dari `pgKru()`.
3. **`src/products/hub/inventaris/InventarisPage.tsx` & `inventarisService.ts`:**  
   Katalog alat generik modern. Belum menyertakan field `brand`, `model`, `sumber`, `loc`, filter multidimensi, keranjang pinjam `loanBasket`, generator barcode label SVG/PNG, serta halaman rincian `pgAlatDetail()`.
4. **`src/products/hub/peminjaman/PeminjamanPage.tsx` & `peminjamanService.ts`:**  
   Tabel sirkulasi baru. Belum menggunakan grouping kartu transaksi multi-unit `groupLoansByTransaction()`, tab filter `aktif`/`saya`/`selesai`, dan alur pengembalian unit individual `returnSingleUnit`.
5. **Design System & Tokens Global (`index.css` & `HubShell.tsx`):**  
   Tema gelap bernuansa sian saat ini (`--bg-primary: #0a0f1d`, `--accent-cyan: #06b6d4`) bukan merupakan tema asli dashboard. Tema asli menggunakan palet *Royal Blue & Crisp White* (`--bg: #F8FAFD;`, `--ink: #0B2A4A;`, `--b-700: #0B5FBF;`) dengan dark mode terpisah (`[data-theme="dark"]`).

---

## 7. RENCANA KOREKSI DAN URUTAN PENGERJAAN MIGRASI PARITAS PENUH

Agar proses migrasi berjalan tertib, presisi, dan tidak merusak aplikasi baru, tahapan berikutnya dirumuskan sebagai berikut:

```
[Tahap 1: Sinkronisasi Design Tokens & App Shell]
  - Import CSS tokens resmi Style #2 (9,654 baris) ke dalam modul CSS Hub.
  - Perbarui HubShell agar menampilkan 7 grup navigasi SIDEBAR asli dan mobile bottom-dock.

[Tahap 2: Migrasi Paritas 1:1 Modul Inventaris]
  - Porting struktur data dan fungsi utilitas: `getAssetUnitSummary`, `sortInventoryItems`, `normalizeInventoryCategory`.
  - Porting UI `pgInventaris()`: tab ketersediaan, filter Kategori/Lokasi/Sumber, pencarian multi-kolom.
  - Implementasikan interaksi keranjang pinjam langsung (`loanBasket`).
  - Porting `pgAlatDetail()`: selector unit fisik, SVG/PNG barcode exporter, riwayat pinjam & kerusakan.

[Tahap 3: Migrasi Paritas 1:1 Modul Peminjaman]
  - Porting logika pengelompokan transaksi `groupLoansByTransaction()`.
  - Porting UI `pgPeminjaman()`: tab filter (`aktif`, `saya`, `selesai`), kartu transaksi multi-unit, pengembalian per-unit (`returnSingleUnit`) dan per-transaksi (`returnLoanTransaction`).
  - Porting modal checkout `openLoanModal()` & `submitMultiLoan()`.

[Tahap 4: Migrasi Paritas 1:1 Beranda & Kru]
  - Porting `pgBeranda()`: hero photo background dinamis, greeting, mobile quick-access squircle buttons, upcoming events card.
  - Porting `pgKru()`: grouping angkatan, tab divisi/status (`Aktif`, `Nonaktif`, `Pengarah`, `Pembina`).

[Tahap 5: Verifikasi Paritas UI/UX & Quality Gate]
  - Uji kesesuaian visual berdampingan (side-by-side) dengan dashboard asli di `https://progresiftv.id/dasbor`.
  - Typecheck, unit test, dan linter pass 100%.
```

---
*Dokumen ini disusun berdasarkan pembacaan langsung terhadap file sumber `page-dasbor.php` dan `ptv-dashboard-data-bridge.php` tanpa rekayasa maupun asumsi.*
