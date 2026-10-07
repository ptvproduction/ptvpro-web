# PTV Pro Web (ptvpro.com)

Aplikasi Web & Dasbor Operasional Studio **Progresif TV (PTV)** berbasis Single Page Application (SPA) mandiri tanpa dependensi WordPress/PHP, siap di-deploy ke **Vercel** dengan arsitektur modern berkecepatan tinggi.

---

## 🚀 Keunggulan Arsitektur

- **Zero-WordPress & Zero-PHP**: Berjalan 100% menggunakan Vanilla HTML5, modern CSS3 (Azure Glassmorphism), dan Modular JavaScript ES6.
- **Hosting Vercel Global Edge Network**: Cepat, ringan, dan biaya hosting Rp 0 (Free Tier).
- **Koneksi Langsung ke Supabase Cloud**: Autentikasi kru, data CRUD PostgreSQL, dan Realtime WebSocket.
- **Struktur URL Bersih**:
  - `/` : Dasbor Operasional Studio
  - `/event/` : Daftar Acara & Event Publik
  - `/event/haul-2027/` : Halaman Khusus Haul Akbar
  - `/event/daurah-ilmiah/` : Halaman Daurah Ilmiah
  - `/event/majelis/` : Halaman Majelis Hadits

---

## 📁 Struktur Direktori

```text
ptvpro-web/
├── vercel.json                 # Konfigurasi routing CDN & Clean URLs Vercel
├── index.html                  # Dasbor Utama Studio SPA
├── manifest.json               # Web App Manifest PWA
├── sw.js                       # Service Worker
│
├── css/
│   ├── base.css                # Tokens, Tipografi Plus Jakarta Sans, Palet Azure
│   ├── dashboard.css           # Glassmorphism, Layout, Sidebar, Modals
│   └── event.css               # Styling halaman publik
│
├── js/
│   ├── config.js               # Konfigurasi Supabase URL & Anon Key
│   ├── supabase.js             # Singleton Supabase Client
│   ├── auth.js                 # Session Guard, Login, Google SSO
│   ├── router.js               # SPA Hash Router
│   ├── audio.js                # Web Audio API Harmonic Chime
│   └── modules/                # 11 Modul Operasional:
│       ├── beranda.js          # Ringkasan Dasbor & Sambutan Kru
│       ├── acara.js            # Jadwal Siaran, Event & Rundown
│       ├── inventaris.js       # Katalog Aset & Barcode Unit Fisik
│       ├── peminjaman.js       # Transaksi Pinjam & Checklist Pengembalian
│       ├── kerusakan.js        # Laporan Kendala & Timeline QC
│       ├── lostfound.js        # Pelacakan Barang Hilang/Temuan
│       ├── catatan.js          # Catatan & Notulensi (Autosave nonaktif)
│       ├── keuangan.js         # Buku Kas Studio & Matriks Iuran Kru
│       ├── kru.js              # Direktori Anggota Kru
│       ├── surat.js            # Generator & Cetak Surat Resmi
│       └── pengaturan.js       # Profil & Konfigurasi Sistem
│
├── assets/
│   ├── icons/                  # PWA Icons & Favicons
│   ├── img/                    # Gambar & Logo
│   └── sound/                  # Audio files
│
└── event/                      # Halaman Publik Acara
    ├── index.html
    ├── haul-2027/index.html
    ├── daurah-ilmiah/index.html
    └── majelis/index.html
```

---

## 🛠️ Konfigurasi Awal

Buka `js/config.js` dan masukkan **Anon Key** Supabase project Anda:

```javascript
export const PTV_CONFIG = {
  supabase: {
    url: 'https://jthzuhkblxcaohiuypqq.supabase.co',
    anonKey: 'MASUKKAN_ANON_KEY_SUPABASE_DI_SINI',
  },
  ...
};
```

---

## 🌐 Deployment ke Vercel

1. Push folder ini ke GitHub repository baru (misal: `ptvpro-web`).
2. Masuk ke [vercel.com](https://vercel.com) dan impor repository tersebut.
3. Hubungkan custom domain **`ptvpro.com`** pada pengaturan domain Vercel.
4. Website langsung aktif dan siap digunakan secara global!
