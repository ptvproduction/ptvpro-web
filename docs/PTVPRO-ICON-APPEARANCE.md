# Ikon Apple/PWA v3

30 Oktober 2026; zidnal / Codex; PTV-DEV-224.

## Status efektif v3

Instruksi utama 56% dipakai; angka 57% di checklist pengguna diperlakukan sebagai ketidakkonsistenan, diumumkan sebelum perubahan. Lebar raster aktual 56,11% (180), 56,25% (192), 56,05% (512), pembulatan piksel. Optical centering memakai centroid alpha sama seperti v2; pusat massa berjarak <0,5px per sumbu dari pusat kanvas. Bentuk/proporsi sumber tetap. Light hijau asli di #F8FAFD; Dark putih dengan alpha identik di #111315. Perubahan iPhone hanya ukuran dan koreksi posisi optik akibat resize.

Aset aktif: Apple `/apple-touch-icon-light-v3.png`; alternatif `/apple-touch-icon-dark-v3.png`. PWA Light/Dark 192/512 tersedia di `/icons/pwa-{light|dark}-{192x192|512x512}-v3.png` sebagai varian appearance dengan latar tetap. Desktop manifest `/manifest.webmanifest?v=3` menggunakan `/icons/pwa-transparent-{192x192|512x512}-v3.png` purpose any dan `/icons/pwa-maskable-transparent-{192x192|512x512}-v3.png` purpose maskable. Seluruh entri manifest memakai alpha transparan hijau resmi, tidak memakai ikon iPhone opaque.

Transparansi dibuat langsung dari RGBA sumber resmi, bukan menghapus piksel putih. Pemeriksaan byte membandingkan hasil dengan sumber yang diresize/diposisikan; alpha=0 dan alpha=255 benar-benar ada, tidak ada piksel putih dengan alpha>0 pada ikon desktop. Seluruh piksel logo termasuk tepi antialias berada di lingkaran aman radius 40%, sehingga maskable valid secara geometris. Transparansi maskable tidak menjamin hasil sistem transparan: user agent dapat menambah latar sendiri menurut spesifikasi. Tidak menambahkan bidang putih buatan. Favicon ICO/PNG desktop dan logo sumber identik SHA-256 sebelum/sesudah. Apple fallback tanpa versi disinkronkan; seluruh v2 dipertahankan.

Sumber primer: https://www.w3.org/TR/appmanifest/#icon-masks (user agent dapat menambah background pada transparansi); https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/icon-theme-color (icons/purpose). Batas appearance iOS pada catatan v2 di bawah tetap berlaku: default Light statis, Dark tersedia terpisah, tidak menjanjikan pergantian otomatis.

Validasi: dimensi, rasio, warna, alpha sumber, centroid, maskable safe circle, hash favicon/source PASS. Apple Light dan desktop transparan diperiksa visual. HTML/manifest v3 dan standalone PASS. HTTP lokal staging 4175: tiga route /, /hub, /hub/catatan serta 15 URL metadata/aset PASS 200 dan byte cocok sumber. Runtime staging ref swadgljnyelsjstqqxbm diverifikasi; tanpa request backend/database. Server ditutup.

`npm run build` GAGAL pada src/products/hub/catatan/components/NoteRichEditor.tsx:21, TS1005 ',' expected (`const lastEmittedHtmlRef.current = ...`), di luar scope dan tidak diubah. Karena itu HTML hasil build v3 belum terverifikasi; pengujian HTTP memakai dev server, bukan dist lama. Vite juga melaporkan parse error file tersebut. Belum uji instalasi Chrome/Edge atau perangkat iPhone fisik. Tidak mengubah UI, service worker atau deployment.

## Riwayat v2

# Ikon Apple/PWA v2

30 Oktober 2026; zidnal / Codex; PTV-DEV-223.

## Aset dan proporsi

Sumber resmi: `public/assets/images/ptv-symbol.png`, tidak diubah. Resize proporsional Lanczos, lebar nominal 53% kanvas. Posisi dihitung dari centroid alpha sumber agar massa visual centered; koreksi sekitar 0,52% kanvas ke kiri dan 1,59% ke bawah dibanding bounding-box centering. Varian Light mempertahankan warna sumber di atas #F8FAFD. Dark mengubah RGB logo menjadi putih, mempertahankan alpha dan posisi persis, di atas #111315. Tanpa efek atau pre-rounded corner.

- Apple 180: `/apple-touch-icon-light-v2.png`, `/apple-touch-icon-dark-v2.png`.
- PWA 192/512: `/icons/pwa-{light|dark}-{192x192|512x512}-v2.png`.
- Maskable 192/512: `/icons/pwa-maskable-{light|dark}-{192x192|512x512}-v2.png`.
- Default tanpa versi tetap disinkronkan ke Light v2 untuk pemanggil lama. Favicon desktop ICO dan PNG 16/32 tidak disentuh.

## Pilihan kompatibilitas

Satu `apple-touch-icon` statis menunjuk Light v2. Manifest `/manifest.webmanifest?v=2` menunjuk empat ikon Light v2, mempertahankan id, name, start_url, scope dan standalone. Dark tersedia sebagai aset alternatif final, belum diaktifkan sebagai appearance otomatis. Tidak memasukkan Dark sebagai kandidat ukuran sama di manifest karena tidak ada selector appearance standar untuk icons; browser dapat memilihnya tanpa memperhatikan tema.

Tidak menggunakan media pada apple-touch-icon, pergantian link via JavaScript, matchMedia listener, atau pergantian manifest. Dengan begitu implementasi tidak menimbulkan flicker atau perubahan ikon akibat tema. Tidak mengklaim ikon terpasang berubah otomatis; ikon Home Screen lama dapat tetap tersimpan oleh iOS dan perlu ditambahkan ulang untuk mengevaluasi versi baru.

Sumber primer diperiksa 30 Oktober 2026:
- Apple Safari Web Content Guide, konfigurasi Web Clip dan standalone: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
- WebKit, prioritas apple-touch-icon di atas manifest icons: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- W3C Manifest, color_scheme_dark hanya mengatur theme_color/background_color, tidak icons: https://www.w3.org/TR/appmanifest/#color_scheme_dark-member

Dokumentasi tersebut tidak memberikan jaminan Apple Touch Icon mengikuti prefers-color-scheme atau appearance Home Screen native. Keputusan default statis adalah batas kompatibilitas konservatif; bukan klaim pengujian Safari fisik.

## Validasi

Pemeriksaan seluruh ukuran: RGB opaque, logo 52,78–53,12% lebar, centroid visual <1 piksel dari tengah, seluruh logo di lingkaran aman maskable radius 40%, bentuk/posisi Light-Dark sama. Sumber dan hasil Apple Light/Dark diperiksa visual. Instalasi iPhone fisik belum diuji. Tidak ada perubahan UI, backend/database, service worker, atau deployment.

Build tsc + Vite PASS (peringatan chunk >500 kB). Preview statis lokal: HTTP 200 + isi cocok pada /, /hub, /hub/catatan serta 15 URL manifest/ikon (termasuk seluruh sepuluh varian v2). Metadata HTML dan manifest standalone/versi PASS; server pemeriksaan ditutup.
