# Master prompt PTV Hub Revisi 03

Baca README.md, PTV-Hub-Guide-R03.md, reference-tokens.json, dan reference/ptv-dashboard-reference.html. Jadikan Revisi 03 rujukan aktif; panduan lama hanya arsip dan tidak boleh menjadi sumber aturan yang bertentangan.

## Identitas dan lingkup
PTV Hub adalah modul internal di ptvpro.com/hub, migrasi dari progresiftv.id/dasbor. PTVPro berasal dari PTVProduction dan merupakan domain. Root ptvpro.com/ adalah launcher publik dengan login pada masing-masing app. Kerjakan isi Hub saja. Login tetap persis. Launcher dan app lain tidak dikerjakan.

## Tahap A Audit read-only dan ekstraksi
1. Baca instruksi repository yang berlaku. Identifikasi stack, route, roles, font, token, shared components, dan query aktual.
2. Jalankan referensi serta aplikasi dengan data uji aman bila lingkungan tersedia. Ambil baseline desktop/mobile dan light/dark; catat browser, viewport, role, font rendered, serta kegagalan aset. Jangan mengklaim visual identik dari pembacaan CSS saja.
3. Definisikan standar dari HTML: primitive dan semantic tokens, typography, layout, shape, gradient, atmosphere, border, shadow, ikon, serta interaksi. Catat selector sumber tiap aturan.
4. Terapkan prioritas keputusan: instruksi pengelola, ekstraksi referensi, prinsip Apple/Google, lalu usulan untuk celah standar. SF Pro adalah penyesuaian font yang disepakati. Continuous corner adalah penyesuaian shape, dengan geometri/fallback yang dicatat.
5. Audit seluruh keluarga komponen Hub terhadap standar, tanpa menebak lama/baru. Inventaris menjaga sistem filter khusus. Lindungi data, permission, dan route aktual.
6. Laporkan temuan dengan route, file, bukti, komponen rujukan, prioritas, perubahan minimum, serta risiko fungsi. Buat rencana file dan katalog. Pada tahap A jangan mengubah kode aplikasi, schema, data, atau deploy. Dokumentasi hasil audit boleh ditulis.

## Tahap B Katalog setelah implementasi ditugaskan
Gunakan struktur repository yang ada. Ekstrak standar menjadi satu sumber tokens dan shared components, lalu katalog lokal/development. Lengkapi Button, Field, Select, Card, Dialog/Sheet, Badge, DataTable, EmptyState, Toast, PageHeader, navigasi, dan gambar. Tampilkan default, hover, pressed, focus, disabled, loading, empty, error, serta success sesuai fungsi.
Pertahankan ukuran referensi dan pill button. Continuous renderer mempertimbangkan ukuran elemen, nominal radius, border, clipping, shadow, dan focus ring. Uji Safari iOS serta Chrome Android/desktop. Jangan mengklaim exact Apple untuk border-radius atau squircle CSS. Dropdown tidak boleh terpotong. QR/barcode tidak ikut clipping dekoratif.
Perbaiki token undefined/invalid dari prototipe dengan keputusan tercatat. Jangan menyalin mock data, role switcher atau aksi simulasi. Tampilan katalog memakai SF Pro aplikasi dengan fallback yang terbukti; tidak mengambil prioritas Inter tanpa izin.

## Tahap C Pilot dan penerapan bertahap
Pilih satu daftar/tabel, satu form kompleks, dan satu halaman komponen berulang. Implementasikan minimum yang diperlukan agar sesuai katalog. Periksa dampak shared CSS pada login dengan screenshot sebelum/sesudah yang stabil. Terapkan ke modul lain hanya setelah fondasi pilot diperiksa; komponen yang sudah sesuai cukup diverifikasi.
Pertahankan auth, permission, routing, API, realtime, Supabase query, validasi, simpan, unduh, dan data aktual. Tidak ada migrasi database atau penghapusan data dalam scope ini. Perubahan fungsi dicatat sebagai pekerjaan terpisah.

## Tahap D Validasi dan dokumentasi
Jalankan build, typecheck/lint tersedia, tes alur terdampak, serta aksesibilitas. Uji semua route yang berubah per role relevan, search/filter, modal, submit/error, reload, realtime bila ada, QR/barcode final, serta mobile/zoom/reduced-motion. Bedakan gagal, belum diuji, dan lulus.
Setiap batch melaporkan daftar file, alasan keputusan, asal aturan (ekstraksi/adaptasi/usulan), screenshot, hasil tes, keterbatasan, dan rollback commit. Update roadmap serta changelog setelah perubahan. AGENTS.md merujuk satu guide aktif dan mewajibkan update dokumentasi; jangan menimpa aturan yang sudah ada. Arsipkan rujukan lama yang bertentangan tanpa menghapus bukti kerja. Jangan deploy tanpa tugas deployment yang jelas.
Hasil akhir tetap mempunyai karakter referensi, SF Pro, biru asli, warna pendamping terarah, login identik, dan fungsi aktual yang utuh.
