# Penomoran surat — review PTV-DEV-205

Status: **PENDING OPERATOR ACC**. Finalisasi font PDF dan alur cetak terimplementasi/teruji lokal, belum deploy. Kelulusan teknis sebelumnya bukan persetujuan visual/UX operator.

## Aturan aktif

Nomor berikutnya adalah nomor tertinggi dalam registry permanen ditambah satu, per jenis dan tahun tanggal mulai kegiatan. Bulan hanya menentukan segmen Romawi. Lebar urutan minimal tiga digit; urutan empat sampai enam digit didukung. Tidak ada kategori surat 1/2/3. Satu dokumen multi-santri mendapat satu nomor.

## Migrasi yang ditinjau

`supabase/migrations/20261029091743_annual_letter_numbering.sql` menggantikan proposal gap-filling di `docs/PTVPRO-OFFICIAL-LETTER-NUMBERING-ATOMIC-PROPOSAL.sql`. Jangan menjalankan proposal lama sesudah migrasi ini.

Migrasi berjalan dalam satu transaksi, memakai lock tabel dengan timeout 10 detik, dan membatalkan seluruh perubahan jika format/urutan historis berbenturan. Tidak memperbarui baris dokumen historis. Registry mengimpor nomor SI/ST/SBB yang masih tersimpan tanpa memfilter status, mempertahankan reservasi SI 001/007/009 tahun 2026, serta tidak memiliki cascade delete ke dokumen. Registry menolak UPDATE/DELETE/TRUNCATE. Trigger menolak perubahan nomor resmi dan penggunaan nomor pada/bawah high-water. Trigger SI mengalokasikan nomor dalam transaksi penyimpanan/persetujuan; trigger ST/SBB mencatat dan memvalidasi nomor yang diberikan jalur masing-masing.

RPC penerbitan dan preview hanya dapat dipanggil `service_role`; API tetap memeriksa sesi dan capability aktual. Fungsi menggunakan SECURITY INVOKER dan search_path kosong. Penerbitan SI menggunakan `identity_id` sesuai FK canonical_identity. Request ID yang sama menghasilkan dokumen yang sama; payload berbeda atau request yang dokumennya telah dihapus ditolak.

Kode baru menolak penerbitan SI jika RPC belum tersedia. Tidak ada fallback penerbitan resmi SI melalui local store. Preview tidak mencadangkan nomor. PDF dan mapping arsip menggunakan nomor final dari row hasil RPC; endpoint verifikasi publik mencari nomor tersimpan secara persis.

## Pemeriksaan sebelum aktivasi (read-only)

Connector staging `swadgljnyelsjstqqxbm`: empat surat SI bernomor, maksimum 011, nol format tidak cocok dan nol konflik urutan per jenis/tahun. Belum ada registry atau RPC penomoran; unique nomor_surat sudah ada. Tidak ada nomor ST/SBB pada snapshot pemeriksaan. Jika data tidak berubah, nomor SI berikutnya setelah migrasi adalah 012. Snapshot ini bukan jaminan nomor tetap 012 ketika migrasi dijalankan kemudian.

Konfigurasi Vite staging diperiksa tanpa menampilkan isi environment: auth=vercel, inventaris=supabase, project ref sesuai staging. Tidak ada server aplikasi yang dimulai atau diuji melalui browser pada sesi ini.

## Hasil aktivasi staging — 29 Oktober 2026

Migrasi diterapkan melalui connector hanya ke `swadgljnyelsjstqqxbm`, menggunakan isi berkas SHA256 `80a7fdc8163ea497c87a1e8cb54ebdd7cb952fda355ed65ae30a59f6bf9b127e`. Tidak ada deploy/push atau perubahan database lain. Lima fungsi, empat trigger aktif, tiga indeks unik registry, RLS dan pembatasan eksekusi server telah diperiksa langsung di katalog PostgreSQL.

Backup `ptv_surat_izin` (empat baris), `ptv_surat_tugas` dan `ptv_surat_barang` (keduanya kosong) tersimpan dalam `.gemini/scratch/letter-activation/before-migration.dpapi`, dilindungi DPAPI CurrentUser dan diverifikasi dengan dekripsi serta hash payload. Receipt tidak mengandung data pribadi. Backup memerlukan akun Windows yang sama untuk pemulihan. Checksum empat dokumen historis sebelum/sesudah migrasi dan uji tetap identik.

- `012/SI-PTV/X/2026`: diterbitkan melalui generator browser, lima objek santri lengkap, PDF nyata terunduh.
- `013/SI-PTV/X/2026` dan `014/SI-PTV/X/2026`: diterbitkan oleh dua request RPC HTTPS bersamaan, masing-masing dua objek santri sintetis lengkap.
- Dua retry dengan ID/payload 013 yang sama mengembalikan nomor yang sama tanpa penerbitan tambahan.
- Semua surat uji ditandai `[UJI STAGING PENOMORAN — BUKAN SURAT OPERASIONAL]` dan dipertahankan. Tujuh dokumen, tujuh nomor registry unik, nol duplikasi/orphan. Nomor terakhir 014, kandidat berikutnya 015.
- Arsip browser menampilkan ketiga surat uji. Endpoint publik ketiganya HTTP 200 valid; halaman publik 012 menampilkan Surat Sah dan Terdaftar. Tidak menyimpan screenshot data santri.
- PDF 012 berukuran 33.187 byte, dapat diparse satu halaman dan memuat nomor serta penanda uji yang benar. Penangkap event download browser timeout, tetapi keberhasilan unduh dikonfirmasi langsung dari file Downloads.

## Temuan yang menghentikan pengujian

Pemeriksaan PDF dengan pypdf menghasilkan `incorrect startxref pointer(2)` dan `parsing for Object Streams`. Parser dapat memulihkan file, tetapi itu bukan bukti struktur PDF bersih. `buildOfficialDocPdf14()` menghitung offset/Length memakai TextEncoder UTF-8, sedangkan `downloadOfficialDocPdf()` menulis `charCodeAt(i) & 0xff`; keduanya memakai representasi byte berbeda, termasuk pada binary logo.

Sesuai instruksi operator, pengujian tambahan dihentikan setelah temuan ini. Tidak ada rollback destruktif, penghapusan surat uji, atau perubahan serializer pada aktivasi ini. Penomoran staging aktif dan terbukti bekerja; generator belum dinyatakan siap penuh sampai serializer PDF diperbaiki dan validasi struktur PDF diulang. Tidak perlu mengulang migrasi untuk menyelesaikan masalah PDF ini.

Temuan di atas kemudian ditutup oleh tugas PDF serializer final fix dari operator; hasil dan batas dukungan font dicatat berikut ini.

Riwayat nomor yang telah dihapus sebelum registry pertama kali dibuat tidak dapat direkonstruksi otomatis dari tabel yang ada; reservasi sah tambahan harus direkonsiliasi sebelum aktivasi jika operator memiliki riwayat tersebut.

Rollback aplikasi tidak boleh menghapus registry atau mengembalikan penomoran gap-filling. Jika migrasi gagal, transaksi membatalkan DDL/backfill. Jika sudah berhasil dan perlu menunda penggunaan, hentikan penerbitan SI sambil mempertahankan registry dan nomor dokumen.

## Validasi

- PostgreSQL 17 lokal terisolasi, data sintetis: `node scripts/test-letter-numbering-local.mjs`. Cluster loopback 55447 terpisah dari runtime aplikasi dan database remote; database fixture dibuang dan cluster dihentikan setelah pengujian.
- Vitest terarah mencakup generator, service/API, metadata, PDF/arsip/verifikasi, dan regresi dokumen. Bukti konkurensi berasal dari PostgreSQL lokal, bukan mock Vitest.
- Hasil final dan pengecualian lint/build dicatat di `piketdev.md` PTV-DEV-205 dan `cleanings.md` CLN-215.

## PDF serializer final fix — bukti lokal dan unduh ulang read-only

Perubahan produksi terlokalisasi pada `src/products/hub/dokumen-saya/utils/docPdfPrinter.ts`. Panjang stream dan offset object/xref kini dihitung pada binary string satu code unit per byte. Downloader memakai `buildOfficialDocPdfBytes()` dari serializer yang sama; tidak lagi memotong charCodeAt dengan bitmask. JPEG didekode sebagai byte dan tidak pernah dihitung ulang sebagai UTF-8. Xref mencatat posisi tepat setiap object; trailer Size/Root dan EOF sesuai object tree multi-halaman.

Teks memakai font Helvetica existing dengan WinAnsiEncoding, NFC untuk aksen gabungan, serta escaping kurung/backslash/kontrol dan byte non-ASCII. Unicode Latin/punctuation seperti é, ’, —, ×, dan € diuji round-trip. Aksara atau emoji yang tidak tersedia pada font existing ditolak dengan pesan eksplisit; tidak diklaim mendukung semua Unicode.

Audit serializer juga menemukan implementasi unduh lama hanya satu halaman, maksimal 10 nama dan enam barang. Pagination kini mengikuti 20 baris santri awal/22 lanjutan seperti preview, tanpa menghilangkan baris. Barang tambahan dialirkan ke halaman berikutnya; kop, nomor final, metadata kegiatan/tanggal, pengesahan dan QR diulang konsisten. Legal text footer dibungkus agar tidak menimpa penerbit atau QR. Ini tidak mengubah nomor maupun data surat.

Bukti:
- 149/149 Vitest terkait PASS pada 14 berkas, termasuk 17 regression test baru untuk offset xref/object, stream Length, JPEG biner, page tree, A4, escape karakter dan kesamaan Blob download.
- Verifier `scripts/verify-official-pdfs.py`: pypdf 6.21.2 strict=True, 13 PDF sintetis berisi total 28 halaman, nol warning/recovery; seluruh nama/barang serta subject Unicode terbaca lengkap.
- Kasus 0/1/5/20/21/22/42/43/60/100 santri, 50 barang, dan kombinasi santri/barang. Render A4 halaman awal/lanjutan diperiksa; QR ketiga halaman contoh 60 santri berhasil didekode ke URL verifikasi nomor 014 yang identik.
- Unduh ulang surat 012 yang sudah ada dari drawer arsip staging, tanpa penerbitan baru: PDF 33.312 byte, satu halaman, nomor 012 identik, parser strict tanpa warning/recovery. Tidak menyimpan screenshot data pribadi.
- Typecheck, lint file tersentuh dan build PASS. Build masih warning CSS/ukuran bundle di luar scope; test SSR verifikasi menampilkan warning useLayoutEffect existing. Poppler renderer memiliki warning konfigurasi font Symbol/ArialUnicode pada host, tetapi dapat merender Helvetica; warning tersebut bukan kerusakan xref PDF. Parser pypdf strict tetap nol warning.
- Beberapa assertion lama pada test PDF diperbarui mengikuti kop/pengesahan existing. Assertion ST pada suite campuran dikoreksi menjadi 043 setelah fixture historis 042; algoritma penomoran produksi tidak diubah.

Reproduksi artefak sintetis (PowerShell):

```powershell
$env:PTV_PDF_ARTIFACT_DIR='.gemini/scratch/pdf-serializer'
npx --no-install vitest run tests/hub/docPdfStructure.test.ts
python scripts/verify-official-pdfs.py .gemini/scratch/pdf-serializer
```

Artefak sintetis dan hasil render tahap struktur berada pada `.gemini/scratch/pdf-serializer`. Kesiapan visual yang disebut pada tahap ini kemudian dikoreksi: parser valid tidak membuktikan paritas preview. Perbaikan lanjutannya tercatat di bawah.

## PDF visual dan content parity — validasi lokal

Akar masalah: `downloadOfficialDocPdf` memanggil template generik vector pada `docPdfPrinter.ts`, terpisah dari `SuratIzinPdfPreview.tsx`. Akibatnya tabel hanya tiga kolom, judul/paragraf/footer berbeda, dan metadata santri hilang. PHP legacy `page-dasbor.php:35024`, `35092`, `35143`, `35198` mengonfirmasi kolom terpilih, judul terpusat, pengesahan dan pembagian 20/22; preview React tetap acuan desain utama.

Perubahan:

- `suratIzinDocument.ts`: memetakan objek santri lengkap, nomor final dokumen, visibilitas/nama penerbit dan kolom; tidak mengambil data pribadi atau menebak nilai lama. Array `metadata.activeCols` menjaga urutan; `colsConfig` JSONB lama memakai urutan preset karena urutan custom historis yang tidak disimpan tidak bisa dibuktikan.
- `suratIzinPdfDownload.tsx`: mount komponen preview yang sama, tunggu font/kop/layout, capture A4 2382×3366 lossless. Font-size dikembalikan ke computed style karena html-to-image membulatkannya. Dependency dipin `html-to-image@1.11.13`; allowlist CSS menghindari capture ratusan custom properties.
- `pdfSerialization.ts`: satu serializer byte/xref, image Flate A4 dan lapisan teks Unicode tersembunyi untuk ekstraksi/pencarian. Ini PDF raster resolusi 3x, bukan tipografi vector; lapisan teks tidak menyediakan posisi seleksi per sel.
- `SuratIzinPdfPreview.tsx`: pagination berbasis tinggi aktual dengan batas maksimum 20/22, wrapping nama/metadata dan lebar penerbit aman. Baris tunggal yang melebihi satu A4 ditolak eksplisit, tidak dipotong diam-diam.
- `docPdfPrinter.ts`: SI diarahkan ke capture preview; builder generik menolak SI. ST/SBB tetap jalur existing. Jalur cetak HTML lama terpisah bukan target unduhan pada tugas ini; komentar klaim paritas 100% dihapus.
- `GeneratorSuratPage.tsx`: metadata penerbitan berikutnya menyimpan array urutan kolom dan visibilitas penerbit. Tidak ada penerbitan atau update remote yang dijalankan.

Bukti nyata di `.gemini/scratch/pdf-parity`:

- `qa.html`: harness browser lokal memakai komponen produksi dan data sintetis; `qa-bundle.json` berisi 20 PDF hasil capture. Tidak menyimpan atau menerbitkan surat.
- Sekolah/Asrama/kustom masing-masing 1/5/20/21/42/60 santri. Normal: 21 → 20/1, 42 → 20/22, 60 → 20/22/18. Kustom panjang 60 → 11 halaman, semua nama/catatan/nilai hadir; satu kasus penerbit disembunyikan. Total 42 halaman.
- Screenshot browser native 794×1122 dibandingkan seluruh 42 render Poppler dengan ukuran sama. Selisih mean absolut pixel 2.9–8.9/255 karena antialiasing/rasterisasi dan pergeseran subpixel, tidak diklaim identik per pixel. Inspeksi visual kop/tabel/pengesahan/lanjutan dan geometri DOM tidak menemukan perbedaan substansial, overflow sel/halaman, atau overlap penerbit–QR (`native-geometry.json`, `native-issues.json`).
- `verification.json`: pypdf 6.21.2 `strict=True`, nol warning/recovery; seluruh nilai santri, urutan kolom dan nomor final diperiksa, label/paragraf generik absen. QR seluruh 20 kasus didekode dari render PDF 3x ke URL nomor 014 yang sama. Render 1x tidak selalu cukup untuk decoder sehingga validasi memakai resolusi asli PDF.
- `preview-vs-pdf.png`: screenshot native dan render PDF berdampingan. `before-vs-after.png`: template generik sebelumnya (fixture 60) vs template preview baru (fixture 5); jumlah data berbeda ditandai jelas.
- Regression `suratIzinPdfParity.test.ts` ditambah; `docPdfStructure` tetap menguji jalur generik ST. Dua run Vitest: 63 tes/10 berkas dan 77 tes/6 berkas, total unik 112 tes/13 berkas, semuanya PASS. Unicode tambahan 300 karakter diekstrak identik oleh strict parser. Jalur generik tambahan: 13 PDF/28 halaman strict tanpa warning.
- Typecheck, lint file tersentuh dan build PASS. Build memberi warning CSS `Unexpected }` dan bundle besar existing di luar scope; suite public verification memberi warning SSR useLayoutEffect existing. Bukan hasil lint repo penuh.

Reproduksi parser/render: `python scripts/verify-surat-izin-parity.py .gemini/scratch/pdf-parity` setelah membuat bundle melalui tombol batch harness lokal. Validasi baru hanya lokal, tidak mengklaim integrasi cloud versi capture ini. Tidak ada DB/registry/RPC/migrasi/historis yang diubah; hash SQL tetap `80a7fdc8163ea497c87a1e8cb54ebdd7cb952fda355ed65ae30a59f6bf9b127e`. Tidak deploy/push. Tidak mengubah Finance atau Haul/Harlah.

## Finalisasi font dan alur cetak — PENDING OPERATOR ACC

Instruksi terbaru operator: kelulusan teknis sebelumnya belum merupakan ACC tampilan/UX. DEV-205 tetap PENDING OPERATOR ACC.

Font Plus Jakarta Sans variable 200–800 disediakan lokal di `public/assets/fonts/plus-jakarta-sans` beserta OFL dari sumber Google Fonts resmi. SHA256 TTF `89b3fb38aa0d275d7a731d0d817a4f1622b316b4d7fbdedcf02ee9099ff68bc8`. Alias CSS khusus `PTV Surat Plus Jakarta Sans` mengisolasi dokumen dari font aplikasi/Google Fonts eksternal. Seluruh elemen lembar menggunakan alias yang sama, synthesis dimatikan, renderer menunggu bobot 400–800 dan memastikan data font disertakan sebelum rasterisasi. Font benar-benar dirender pada image lossless 3x PDF; tidak mengklaim font program tertanam sebagai vector. Font Helvetica dalam PDF hanya lapisan teks tersembunyi untuk pencarian. Seluruh glyph pada 20 fixture didukung TTF, tanpa fallback; karakter di luar cakupan memakai fallback glyph browser. Hanya node lembar A4 dirender, tanpa toolbar/zoom/modal aplikasi.

Alur penerbitan:

1. Tombol `Buat & Unduh PDF` langsung memanggil service existing. Modal kode enam digit sebelumnya hanya memeriksa panjang input di klien; kode itu tidak pernah diverifikasi atau dikirim ke API. Modal/state/CSS tersebut dihapus, tanpa perubahan login utama, capability, validasi API, audit atau RPC.
2. `createSuratIzinPublisher` mempertahankan request ID untuk respons server yang belum pasti, serta dokumen/PDF setelah tersimpan. Kegagalan font/render/download disampaikan dengan nomor tersimpan; retry form yang sama tidak mengalokasikan ulang nomor. Submit bersamaan ditolak. Mengubah payload menghasilkan request baru.
3. `prepareOfficialDocPdf` membuat satu Blob; `startOfficialDocPdfDownload` memicu unduhan. Browser tidak menyediakan konfirmasi file selesai tersimpan untuk anchor download; dialog muncul setelah pemicu unduhan berhasil tanpa exception, bukan sebelum PDF siap.
4. `PrintCopyOffer` menunggu modal lain ditutup, lalu satu `PrintCopyDialog` berisi copy persis instruksi operator. Reuse `useModalScrollLock` untuk fokus/Tab/Escape/scroll. Tombol `Tidak, Terima Kasih` menutup dialog tanpa mencetak; tombol cetak memakai `printOfficialPdf` dengan Blob yang identik, tanpa service create atau arsip baru. Popup diblokir memberi error. SI pada jalur cetak HTML lama juga dialihkan ke renderer PDF shared; ST/SBB tidak diubah.

Bukti terbaru:

- 122/122 Vitest terkait, 14 berkas PASS; termasuk delapan tes publication/download/print dan dua tes keamanan tambahan (tanpa login 401, tanpa hak create 403, tidak memanggil RPC). Ini pengujian lokal/mock, bukan integrasi cloud terbaru.
- 20 PDF/42 halaman dibuat ulang memakai font lokal, pypdf strict nol warning/recovery; seluruh QR terdekode. Pemeriksaan `fontTools` memvalidasi nama font/cmap dan nol glyph fixture hilang. `scripts/verify-surat-izin-parity.py` sekarang mencakup pemeriksaan ini.
- 42 screenshot native A4 utuh dibandingkan render Poppler. Semua elemen memakai family lokal; tidak ada overflow tabel/halaman atau overlap penerbit–QR pada geometri. Pagination normal 20/22/18 untuk 60 santri, teks panjang 60 menjadi 11 halaman. Bukti `.gemini/scratch/pdf-parity/preview-vs-pdf-font-final.png`, `verification.json`, `font-evidence.json`, dan `native-geometry.json`.
- Harness `flow.html` memakai Generator produksi dengan service/fetch santri sintetis lokal. Satu penerbitan, dua unduhan payload sama dan satu cetak mempertahankan Blob ID yang identik. Error unduh tidak menampilkan sukses; retry memakai dokumen yang sudah tersimpan. Tawaran menunggu modal lain, pilihan tidak mencetak menutup dialog. Desktop 1280 px (dialog 480 px) dan mobile 390 px (dialog 358 px) diperiksa. Kontras mode gelap judul 12.31:1 dan deskripsi 8.20:1 setelah memperbaiki background surface. Screenshot `flow-desktop.png`, `flow-mobile.png`; catatan batas `flow-verification.json`.
- Viewer PDF cetak berhasil dibuka. Inspeksi halaman viewer `blob:` ditolak kebijakan browser otomatis, sehingga print preview native dan cetak fisik tidak diklaim terverifikasi. Tidak mencoba melewati pembatasan tersebut. Unit test membuktikan `print()` dipanggil setelah load dan URL memakai Blob unduhan yang sama; pada browser yang membatasi print otomatis, viewer menyediakan kontrol cetak/bagikan bawaan.
- Lint file tersentuh, typecheck dan build akhir PASS. Run perantara sempat terhambat error Haul yang berubah selama pekerjaan paralel, terakhir unused `ProductionDraftRepository`/`crewActor` pada tes Haul. Pemeriksaan akhir lulus setelah file paralel berubah; Codex tidak mengubah file Haul. Build tetap memberi warning CSS `Unexpected }` dan bundle besar existing. Tab dari tombol terakhir kembali ke tombol pertama di dialog; Escape menutup dialog (browser lokal).

Tidak deploy/push, tidak migrasi, tidak mengubah nomor historis, tidak mengakses/menulis database remote, serta tidak mengubah Finance/Haul. Tidak ada ACC visual/UX operator yang diasumsikan.
