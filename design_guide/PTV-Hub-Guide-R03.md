# PTV Design System 1 0

Panduan penyelarasan dan pemolesan isi PTV Hub

Versi 1.0 Revisi 03 • 13 Oktober 2026

PTV Hub adalah dashboard internal yang dipindahkan dari progresiftv.id/dasbor ke ptvpro.com/hub. HTML ptv-dashboard claude.html menjadi sumber konkret untuk fondasi visual modul ini. Pekerjaan berikutnya menyelaraskan fitur baru dengan desain awal dan memoles detail yang belum konsisten. SF Pro serta palet biru yang sudah dipakai tetap menjadi landasan.

Panduan ini menjadi pegangan pengelola PTV, desainer, developer, dan Antigravity. Audit mencari perbedaan dari desain rujukan, kemudian menentukan perubahan sekecil yang diperlukan untuk memperbaikinya.

## Keputusan desain

HTML referensi menjadi acuan visual utama yang terukur. Arahan terbaru pengelola tetap mengatasi perbedaan dengan referensi. Apple Human Interface Guidelines dan Google Material Design menjadi acuan prinsip untuk hierarki, interaksi, komponen, dan aksesibilitas. Keduanya membantu menilai keputusan; identitas visual tetap mengikuti PTV Hub.

Warna dan ukuran diambil dari CSS referensi. SF Pro dan continuous corner merupakan penyesuaian yang disepakati. Nilai untuk komponen yang belum ada ditandai sebagai usulan; fungsi aplikasi mengikuti implementasi Hub yang nyata.

## Isi panduan

01 Arah visual dan batas perubahan
02 Audit antarmuka
03 Warna dan semantic tokens
04 Tipografi dan ikon
05 Spacing dan layout
06 Continuous corner
07 Surface dan motion
08 Navigasi dan tombol
09 Form dan dialog
10 Tabel dan status data
11 Pola halaman PTV
12 Aksesibilitas dan responsivitas
13 Implementasi dan pengujian
14 Instruksi untuk Antigravity
15 Referensi dan pemeliharaan
16 Sumber HTML dan paket implementasi

<!-- PAGE -->
# 01 Arah visual dan batas perubahan

Pertahankan estetika PTV Hub yang sudah baik. Masalah utama adalah perbedaan bahasa desain antara fondasi awal dan beberapa fitur yang ditambahkan kemudian. Polish dilakukan pada detail yang dapat ditunjukkan melalui perbandingan visual.

## Modul dan alamat pekerjaan

Progresif TV Super App adalah nama payung sementara. PTVPro berasal dari PTVProduction dan digunakan pada domain ptvpro.com. Root ptvpro.com/ merupakan launcher publik dengan login pada masing-masing app. Buku ini hanya mengatur isi PTV Hub di /hub; launcher serta app lain dibahas terpisah.

## Urutan acuan

1. Arahan terbaru pengelola PTV, termasuk SF Pro dan warna biru.
2. HTML referensi dan aturan komponen hasil ekstraksinya.
3. Komponen Hub yang sudah cocok dengan standar hasil ekstraksi.
4. Prinsip Apple dan Google untuk menyelesaikan detail yang belum diatur.
5. Ukuran usulan buku untuk bagian yang belum memiliki standar.

Bandingkan seluruh komponen Hub dengan standar hasil ekstraksi. Tidak perlu mengklasifikasikan fitur sebagai lama atau baru. Perbedaan fungsi dapat menghasilkan variant; semua variant tetap memakai fondasi visual yang sama.

## Bentuk polish yang diizinkan

Samakan font dan weight, shade biru, radius dan bentuk sudut, jarak, alignment, border, shadow, serta state interaksi. Pertahankan komposisi, proporsi, kepadatan informasi, dan karakter halaman yang sudah disukai. Refactor komponen boleh dilakukan tanpa mengganti penampilan baik yang sudah ada.

Setiap perubahan visual harus menjawab masalah yang konkret, seperti tinggi input berbeda atau tombol fitur baru memakai warna lain. Jika tidak ada masalah yang terbukti, elemen tersebut tidak perlu diubah.

## Disiplin estetika

Jangan menambahkan gradient, glassmorphism, blob, hero besar, card berlapis, ilustrasi dekoratif, atau animasi mencolok tanpa kebutuhan dan rujukan. Elemen dekoratif yang memang sudah menjadi bagian desain awal dapat dipertahankan. Mengikuti Apple atau Google tidak berarti memasang skin aplikasi keduanya.

Kesan hasil AI yang generik dinilai melalui bukti: dekorasi tanpa fungsi, komponen dengan gaya berbeda, informasi yang dipaksa menjadi card, atau penggantian identitas tanpa alasan. Perbaiki penyebabnya melalui konsistensi dan ketelitian.

## Batas pekerjaan

Halaman login PTV Hub dipertahankan persis. Perubahan hanya mencakup isi setelah login. Refactor token atau CSS bersama tidak boleh mengubah tampilan login.

<!-- PAGE -->
# 02 Audit antarmuka

Audit membandingkan seluruh isi Hub dengan standar dari HTML. Ekstrak dan dokumentasikan standar terlebih dahulu, lalu simpan baseline website saat ini. Jangan menyebut temuan tanpa membuka halaman atau menemukan bukti di kode. Panduan ini tidak menggantikan pemeriksaan repository dan dashboard yang sebenarnya.

## Urutan audit

1. Identifikasi framework, routing, stylesheet, UI library, font, ikon, dan struktur shared components.
2. Inventarisasi seluruh route serta role yang dapat mengaksesnya. Pisahkan halaman aktif, lama, dan belum selesai.
3. Ambil baseline visual dengan data uji yang aman pada desktop dan mobile. Catat viewport, role, state, dan versi kode.
4. Audit per keluarga komponen di seluruh isi Hub: kontrol, wadah, navigasi, form, dan tabel. Bandingkan dengan katalog dari HTML dan catat file sumber.
5. Periksa kesamaan visual dan perilaku untuk fungsi sejenis. Inventaris mempertahankan sistem filter khusus, dengan fondasi visual yang sama.
6. Tandai elemen yang dipertahankan, diselaraskan, atau dipoles tipis. Nyatakan alasan perubahan dan batasnya.

## Data minimal tiap temuan

| Field | Isi yang diperlukan |
| --- | --- |
| Halaman dan role | Route sebenarnya dan role yang diuji |
| Elemen | Nama komponen serta file sumber |
| Bukti | Screenshot atau nilai CSS yang ditemukan |
| Masalah | Perbedaan yang konkret dan dampaknya |
| Usulan | Komponen rujukan dan penyesuaian terkecil |
| Prioritas | P0, P1, atau P2 dengan alasan |

P0 mencakup gangguan akses atau pekerjaan inti, seperti tombol tertutup dan form tidak bisa digunakan. P1 mencakup ketidakkonsistenan komponen utama. P2 mencakup polish kecil yang tidak menghambat pekerjaan. Risiko permission harus segera dilaporkan sebagai masalah fungsi, bukan ditutupi lewat perubahan UI.

## Hasil wajib

Sediakan peta route, komponen rujukan, inventaris token, perbandingan screenshot, serta daftar elemen yang dipertahankan dan diubah. Jangan langsung mengganti stylesheet global sebelum mengetahui halaman yang terdampak.

CSS HTML menjadi sumber angka; screenshot menjadi bukti hasil render. Catat setiap keputusan sebagai hasil ekstraksi, penyesuaian yang disepakati, atau usulan. Hub yang ada tidak boleh dijadikan standar hanya karena paling baru.

<!-- PAGE -->
# 03 Warna dan semantic tokens

Warna berikut diekstrak dari CSS HTML referensi. Biru tetap menjadi warna utama. Gunakan nama semantik untuk memetakan primitive asli ke fungsi komponen; jangan mengganti palet dengan warna bawaan Apple atau Material Design.

## Palet terang dari referensi

| Token asli | Nilai | Fungsi awal |
| --- | --- | --- |
| b-900 dan b-800 | #072A52 dan #0A3C74 | Biru gelap |
| b-700 | #0B5FBF | Biru pendamping |
| b-600 | #1273E6 | Biru utama |
| b-500 | #3B8EF7 | Aksen terang |
| b-400 dan b-300 | #6FB0FF dan #A7CEFF | Aksen dan border aktif |
| b-100 dan b-050 | #DCEBFF dan #EDF4FF | Tint biru |
| bg dan bg-2 | #F1F7FF dan #F7FBFF | Canvas dan input |
| surface | #FFFFFF | Card dan dialog |
| ink dan ink-2 | #0B2A4A dan #38587A | Teks utama dan sekunder |
| muted | #6E8CAE | Metadata |
| ok dan ok-bg | #0F7A5A dan #E1F5EE | Sukses |
| warn dan warn-bg | #9A6B08 dan #FCF0D6 | Peringatan |
| dang dan dang-bg | #B02B23 dan #FDE8E6 | Error |

Nilai adalah hasil ekstraksi, bukan jaminan semua pasangan lolos kontras. Uji pemakaian aktual, terutama muted pada surface terang, border kontrol, dan teks di atas gradient. Koreksi pasangan seminimal mungkin dengan alasan terdokumentasi.

## Warna hidup dengan fungsi tetap

Pertahankan gradient biru pada komponen yang memang memilikinya, atmosphere background, dan transparansi navigasi. Warna pendamping muncul konsisten pada kategori, agenda, shortcut internal, atau status. Label atau ikon tetap menjelaskan makna warna.

Jangan menambahkan aksen baru secara acak pada setiap card. Varian warna yang belum ada harus mempunyai nama, fungsi, pasangan teks, serta aturan pengulangan. Background section Agenda berikutnya tetap mengikuti arahan pengelola dan tidak otomatis diberi radius.

## Mode gelap

Referensi sudah menyediakan mode gelap: bg #060F1C, surface #0E1B2D, ink #E6F0FC, dan b-600 #4E9BFB. Pemetaan lengkap tersedia dalam reference-tokens.json. Pertahankan pasangan mode yang sesuai; jangan membawa hex light mode langsung ke dark mode.

<!-- PAGE -->
# 04 Tipografi dan ikon

HTML mendahulukan Inter lalu SF Pro Text pada font stack. Keputusan produk tetap menggunakan SF Pro sebagai landasan Hub. Pertahankan konfigurasi SF Pro yang sudah berlaku pada aplikasi nyata dan periksa font yang benar-benar dirender.

## Skala yang diekstrak

| Selector referensi | Ukuran | Weight dan detail |
| --- | --- | --- |
| body | 15 px | 400, line height 1.5 |
| display | 27 px | 700, line height 1.12 |
| t-xl | 20 px | 700 |
| t-lg | 17 px | 650 |
| t-md | 15 px | 600 |
| t-sm | 13.5 px | Mengikuti konteks |
| t-xs | 12.5 px | Mengikuti konteks |
| sec-hd h2 | 15 px | 680 |
| btn | 14.5 px | 620 |
| input | 16 px | Mengikuti font control |

Angka ini merekam referensi. Weight seperti 620 atau 680 harus diuji terhadap aset SF Pro yang tersedia; catat mapping jika hanya tersedia weight diskret. Penggantian font dapat mengubah panjang teks dan tinggi komponen, jadi periksa ulang wrapping.

## Penulisan dan angka

Pertahankan hierarchy serta kepadatan referensi. Gunakan label tindakan yang jelas, sentence case, dan tabular numerals untuk angka yang dibandingkan. Jangan memangkas nomor surat, kode alat, atau pesan error yang diperlukan untuk bekerja.

## Ikon

Referensi menggunakan Font Awesome 6.5.2 dari CDN. Bentuk ikon itu menjadi rujukan awal; library aktual dapat dipertahankan bila gaya, ukuran, dan maknanya konsisten. Jangan mencampur keluarga ikon per halaman. Penggantian keluarga ikon harus menjadi satu keputusan terpusat yang dicatat.

Icon button memiliki accessible name. Area tekan cukup besar dan fokus terlihat. Tooltip hanya pendukung; aksi penting mobile tetap mempunyai penjelasan yang dapat dijangkau tanpa hover.

## Pemeriksaan font

Bandingkan label panjang, menu, button, row tabel, dan form pada browser target. Fallback harus tetap terbaca bila font utama gagal dimuat. Katalog komponen menunjukkan typography setelah adaptasi SF Pro, bukan hanya screenshot Inter dari referensi.

<!-- PAGE -->
# 05 Spacing dan layout

Ukuran fondasi diambil dari HTML. Gunakan nilai tersebut sebagai titik awal dan pertahankan proporsi referensi. Kebutuhan fungsi yang belum tersedia boleh mempunyai layout khusus dengan alignment dan skala yang sama.

## Ukuran dari CSS referensi

| Elemen | Nilai | Konteks |
| --- | --- | --- |
| Sidebar | 250 px | Mulai viewport 1024 px |
| Lebar konten | 1160 px | page-in desktop |
| Header | 58 dan 66 px | Mobile dan desktop |
| Padding main | 18, 26, 32 px | Mobile, tablet, desktop |
| Card pad | 15 px | card.pad |
| Jarak section | 24 px | sec |
| Stack dan grid | 10 px | stack dan grid-2 |
| Row | 12 px | row dan row-b |
| Label ke input | 6 px | field |
| Button | Minimum 46 px | Default |
| Button compact | Minimum 36 px | btn.sm |
| Input | Minimum 48 px | Padding 12 x 15 px |

Referensi menggunakan gap 6, 7, 8, 10, 11, 12, dan nilai lain sesuai konteks. Normalisasi melalui semantic tokens, misalnya field.gap dan section.gap; jangan membulatkan seluruh angka secara massal demi skala 4 px.

## Breakpoint dan overlay

Pada 640 px, grid shortcut serta padding berubah. Pada 1024 px, sidebar desktop aktif dan bottom dock disembunyikan. Pada 1280 px, layout cols memakai rasio 1.6 : 0.95 dengan gap 26 px. Angka ini menjadi baseline responsive Hub.

Sheet mobile memakai panel bawah. Pada desktop, sheet berada di tengah dengan lebar hingga 560 px atau variant wide 760 px. Pastikan isi panjang, fokus, keyboard mobile, dan footer aksi tetap dapat digunakan.

## Section dan wadah

Section tidak otomatis menjadi card. Background Agenda berikutnya mengikuti arahan pengelola tanpa radius pada background section. Card, hero, dan inset panel dibedakan berdasarkan fungsinya agar tidak semua informasi dipaksa mempunyai wadah.

Fixed height hanya dipakai jika fungsi memerlukan. Data nyata, nama panjang, dan pesan error harus dapat memperbesar konten. Perubahan ukuran untuk aksesibilitas dicatat sebagai penyesuaian, bukan dianggap nilai ekstraksi.

<!-- PAGE -->
# 06 Continuous corner

Continuous corner memiliki transisi kelengkungan yang lebih halus daripada sudut lingkaran dari border-radius biasa. Bentuk harus berasal dari satu mekanisme shared component, sehingga card, gambar, dan dialog tidak mempunyai karakter sudut yang berbeda-beda.

## Token shape PTV

| Token | Radius nominal | Komponen |
| --- | --- | --- |
| shape.none | 0 px | Canvas, section penuh, area header |
| shape.small | 9 px | Badge persegi dan elemen kecil |
| shape.control | 13 px | Input dan control nonpill |
| shape.card | 18 px | Card dan wadah gambar |
| shape.dialog | 24 px | Dialog dan hero rujukan |
| shape.pill | 999 px | Chip yang memang berbentuk kapsul |
| shape.sheet | 30 px | Sudut atas sheet mobile |
| shape.circle | 50% | Avatar atau tombol bulat |

Radius nominal berasal dari token HTML 9, 13, 18, 24, 30 px dan pill 999 px. HTML masih memakai border-radius biasa; continuous corner adalah adaptasi yang disepakati. Button referensi tetap pill, tidak dipaksa menjadi persegi bersudut. Radius nominal mengatur keluasan sudut; ia tidak menjamin bentuk yang sama pada semua metode rendering. Pill dan circle memakai geometri masing-masing, bukan dipaksa mengikuti squircle.

## Strategi implementasi

Dasar kompatibel memakai border-radius dari token. corner-shape: squircle dapat ditambahkan melalui feature query pada browser yang mendukungnya. MDN menandai properti ini sebagai limited availability pada saat penyusunan [3]. Hasilnya perlu diuji, dan tidak boleh disebut identik dengan geometri Apple.

Bila persamaan bentuk antarbrowser menjadi syarat ketat, buat satu renderer SVG atau path yang mempertimbangkan lebar, tinggi, radius, dan smoothing. Parameter smoothing harus dicatat sesuai algoritme, lalu dikalibrasi melalui katalog komponen. Tidak ada angka smoothing Apple yang diklaim exact dalam buku ini. Jangan meregangkan satu SVG persegi ke semua ukuran.

## Clipping dan penerimaan

Pisahkan shell luar untuk shadow serta focus ring dari lapisan dalam untuk clipping gambar. Dropdown dan tooltip tidak boleh terpotong oleh overflow wadah. Border mengikuti bentuk yang sama, tanpa sudut ganda atau garis putus.

Uji control 44 px, card landscape, portrait, dialog, dan gambar pada Safari iOS serta Chrome Android dan desktop. Catat jalur native, path, atau fallback. Fallback bulat yang rapi diperbolehkan sebagai mode kompatibilitas; jangan melaporkannya sebagai continuous corner yang exact.

<!-- PAGE -->
# 07 Surface dan motion

Surface membedakan lapisan informasi. Pertahankan canvas, surface, dan layering dari desain awal; selaraskan bagian fitur baru yang berbeda. Tingkat kedalaman mengikuti fungsi komponen.

## Elevation

| Token | Shadow referensi | Penggunaan |
| --- | --- | --- |
| elevation.none | none | Section, input, tabel inline |
| elevation.card | 0 1px 2px dan 0 3px 10px | shadow-s |
| elevation.popover | 0 4px 12px dan 0 18px 40px | shadow-m |
| elevation.dialog | 0 -4px 16px dan 0 -24px 60px | shadow-l sheet |

Tabel merangkum offset shadow asli; nilai rgba lengkap ada di reference-tokens.json. Biru pada shadow dan gradient merupakan karakter referensi. Motion yang disebut di bawah adalah usulan polish; CSS asli memakai durasi sekitar 120 sampai 220 ms.

Card referensi memakai border line-2 serta shadow-s. Jangan menambahkan shadow besar pada setiap elemen. Border kontrol yang dibutuhkan untuk mengenali input harus cukup kontras, berbeda dari divider dekoratif yang boleh lebih halus.

## Transparansi

Surface utama, tabel, dan form harus terbaca jelas tanpa bergantung pada blur. Jika ada header transparan yang dipertahankan dari desain lama, sediakan warna fallback yang solid. Hindari menjadikan seluruh aplikasi bertema kaca hanya karena rujukannya Apple.

## Motion

Gunakan 120 ms untuk perubahan state sederhana, 180 ms untuk transisi komponen, dan maksimum 240 ms untuk dialog atau drawer. Easing awal: cubic-bezier(.2,0,0,1). Nilai tersebut adalah token PTV, bukan aturan vendor.

Animasi menjelaskan perubahan posisi atau state. Button referensi mempunyai pressed scale .97. Pertahankan bila tidak mengganggu dan matikan gerakan nonesensial pada reduced motion. Card data yang bukan link tidak diberi efek seperti elemen klik. Loading mempertahankan tinggi konten agar posisi halaman stabil.

Hormati prefers-reduced-motion. Hapus gerakan nonesensial, terutama slide besar, parallax, dan animasi berulang. Spinner boleh diganti indikator loading yang sederhana. Fokus dan feedback hasil tetap terlihat walaupun animasi dihilangkan.

## Z index

Definisikan layer terpusat untuk header, dropdown, drawer, dialog, dan toast. Dropdown di dalam dialog harus berada pada layer yang sesuai dengan dialog. Hindari angka z-index acak yang saling mengalahkan di file halaman.

<!-- PAGE -->
# 08 Navigasi dan tombol

Navigasi menunjukkan lokasi pengguna dan tujuan berikutnya. Pertahankan nama menu serta pengelompokan yang sudah dipahami kru; perubahan nama perlu alasan operasional yang jelas.

## Shell aplikasi

Shell di bagian ini hanya milik isi PTV Hub. Login tetap persis seperti rujukan; launcher root dan navigasi app lain berada di luar scope.

Sidebar referensi mempunyai active gradient biru, teks putih, dan shadow-blue. Pertahankan karakter tersebut serta tambahkan aria-current dan fokus yang terlihat. Jangan mengandalkan warna saja. Kelompok menu memakai label kecil yang tetap mudah dibaca.

Mobile menggunakan drawer bila jumlah menu banyak. Jika bottom navigation sudah digunakan dan berjalan baik, pertahankan untuk tujuan utama yang terbatas; jangan menampilkan dua navigasi utama yang saling bersaing. Route langsung, tombol kembali, dan status aktif harus tetap benar.

Topbar memuat konteks halaman serta akses akun yang relevan. Judul, aksi, dan breadcrumb tidak perlu diulang di beberapa tempat. Menu hanya tampil sesuai role, sementara pemeriksaan akses tetap dilakukan pada lapisan otorisasi yang ada.

## Keluarga button

| Variant | Fungsi | Visual |
| --- | --- | --- |
| Primary | Aksi utama pada satu area | Gradient b-500 ke b-700 |
| Secondary | Aksi pendamping | Surface dengan border |
| Tertiary | Aksi ringan atau navigasi | Teks dengan hover surface |
| Destructive | Hapus atau tindakan berisiko | Danger dengan label eksplisit |

Ukuran rujukan yang sudah baik dipertahankan. Untuk kontrol yang belum distandardisasi, ukuran referensi minimal 46 px tinggi dengan padding horizontal 18 px dan gap ikon 8 px. Ukuran compact 36 px hanya untuk area desktop yang padat; area sentuh mobile tetap minimal 44 px sesuai aturan PTV.

## State wajib

Button memiliki default, hover, pressed, focus-visible, disabled, dan loading. Loading mempertahankan lebar, mencegah submit ganda, serta memakai label yang sesuai seperti Menyimpan. Fokus harus terlihat di luar shape tanpa terpotong.

Gunakan button untuk tindakan dan link untuk perpindahan halaman. Label menyebut tindakan: Tambah unit, Unduh PDF, atau Simpan perubahan. Tombol Batal tidak boleh terlihat setara dominan dengan aksi utama.

<!-- PAGE -->
# 09 Form dan dialog

Label selalu terlihat di atas field. Placeholder memberi petunjuk format, bukan menggantikan label. Helper text ditempatkan sebelum pengguna melakukan kesalahan bila persyaratan input perlu dijelaskan.

## Kontrak field

Field referensi memakai teks input 16 px, tinggi minimal 48 px, padding horizontal 15 px, serta shape.control. Textarea memiliki tinggi sesuai isi dan dapat membesar. State mencakup default, hover bila relevan, focus, filled, invalid, disabled, dan read-only.

Read-only tetap terbaca serta dapat disalin bila perlu. Disabled menjelaskan ketidaktersediaan tindakan; jangan membuat data penting terlalu pudar. Required ditunjukkan lewat teks atau penanda yang dijelaskan, serta atribut semantik.

Pesan error ditempatkan dekat field dan terhubung melalui aria-describedby. Gunakan aria-invalid untuk field yang salah. Saat submit gagal, arahkan fokus ke ringkasan error atau field pertama yang perlu diperbaiki. Input pengguna tetap tersimpan.

## Pilihan dan upload

Select panjang menyediakan pencarian bila jumlah pilihannya memerlukan. Multi-select menampilkan pilihan yang jelas, cara menghapus, dan jumlah terpilih. Gunakan kontrol native bila sudah memenuhi kebutuhan; kontrol custom harus menjaga keyboard dan semantik aksesibilitas.

Upload menjelaskan tipe file, batas ukuran sesuai konfigurasi sebenarnya, progress, dan cara mencoba lagi. Jangan menampilkan keberhasilan sebelum server mengonfirmasi penyimpanan.

## Dialog

Dialog memiliki judul, isi, dan area tindakan yang jelas. Fokus masuk ke dialog, tetap berada di dalam selama modal terbuka, lalu kembali ke pemicu setelah ditutup. Escape dan klik backdrop mengikuti kebijakan jenis dialog; perubahan yang belum disimpan memerlukan perilaku konsisten untuk mencegah kehilangan input.

Tindakan destruktif menyebut objek yang terkena, misalnya Hapus unit INV-023. Jangan memakai konfirmasi generik tanpa konteks. Dialog panjang memiliki scroll internal dan footer aksi yang tetap dapat dijangkau.

## Feedback

Toast cocok untuk hasil singkat yang tidak memerlukan respons. Error yang membutuhkan tindakan muncul dekat pekerjaan terkait. Gunakan teks seperti Perubahan tersimpan atau Gagal menyimpan. Coba lagi. Jangan menampilkan detail teknis server kepada pengguna umum.

<!-- PAGE -->
# 10 Tabel dan status data

Tabel membantu kru membandingkan data. Prioritaskan kolom yang sering dipakai dan letakkan aksi pada posisi yang konsisten. Informasi status harus tetap dapat dibaca tanpa menghafal warna.

## Standar tabel

Header memakai 14 px dengan weight 600. Body memakai 14 px, padding vertikal sekitar 12 px, dan tinggi row normal minimal 48 px bila memuat tindakan. Nomor dan jumlah rata kanan; nama serta catatan rata kiri.

Sorting menampilkan arah serta aria-sort. Checkbox seleksi memiliki label yang menyebut row. Jika seluruh dataset dapat diseleksi, jelaskan perbedaan antara memilih halaman aktif dan memilih seluruh hasil. Pagination menyebut rentang yang sedang ditampilkan.

Toolbar berisi pencarian, filter, dan aksi yang relevan. Tampilan, posisi, dan cara pakai kontrol sejenis konsisten antarmodul. Inventaris boleh mempertahankan sistem filter khusus tanpa mengubah bahasa visualnya. Filter aktif terlihat dan bisa direset. Pencarian tidak boleh kehilangan input setiap kali data diperbarui. Sticky header hanya dipakai bila tidak menutup konten saat zoom.

## State data

| State | Tampilan dan tindakan |
| --- | --- |
| Loading awal | Skeleton dengan struktur yang stabil |
| Memperbarui | Pertahankan data; tunjukkan indikator ringan |
| Kosong | Jelaskan belum ada data dan aksi berikutnya |
| Tanpa hasil filter | Jelaskan hasil kosong; tawarkan reset filter |
| Error | Pesan ringkas dan tombol coba lagi |
| Berhasil | Data aktual dengan feedback seperlunya |
| Akses ditolak | Penjelasan sesuai konteks tanpa membocorkan data |

Empty state bukan bukti bahwa query sukses. Bedakan hasil kosong, error jaringan, dan akses ditolak. Hindari menampilkan angka nol saat data sebenarnya masih loading.

## Perilaku mobile dan realtime

Daftar sederhana dapat berubah menjadi card dengan label field. Tabel perbandingan yang kompleks dapat memakai horizontal scroll lokal; halaman keseluruhan tetap tidak melebar. Nama dan status utama harus terlihat tanpa bergantung pada kolom aksi di ujung tabel.

Update realtime tidak menghapus seleksi atau menimpa form yang sedang diedit. Konflik data memakai perilaku bisnis yang ada; UI harus memberitahu pengguna bila data berubah dan membutuhkan refresh atau penyelesaian konflik.

<!-- PAGE -->
# 11 Pola halaman PTV

Pola berikut memandu penerapan pada modul yang dibahas untuk PTV. Cocokkan nama route, schema, dan status dengan implementasi aktual sebelum mengubah halaman.

## Dashboard dan agenda

Pertahankan susunan dashboard awal, ringkasan, agenda, dan akses cepat yang sudah disukai. Selaraskan fitur tambahan pada komposisi tersebut. Hindari kartu statistik dekoratif yang tidak memiliki definisi data. Background section Agenda berikutnya tidak otomatis menjadi card rounded. Judul agenda, jam, dan status tetap memiliki hierarki yang konsisten.

## Inventaris dan peminjaman

Bedakan model alat dengan unit fisiknya. Tampilkan kode, nama unit, status, serta lokasi pada hierarchy yang mudah dipindai. Peminjaman multi-alat tetap mempertahankan unit terpilih saat pencarian berubah. Keperluan peminjaman memakai field sesuai alur yang ada.

QC pengembalian, laporan kerusakan, dan riwayat harus tetap dapat diakses sesuai haknya. Desain baru tidak menyatukan status yang sebenarnya berbeda. Barcode Code-128 tetap tajam, berkontras tinggi, dan memiliki ruang kosong yang cukup; jangan mengikuti clipping dekoratif card.

## Generator surat izin

Jaga form multi-santri, pencarian, filter angkatan, penomoran, tanggal, preview, unduh, dan arsip sesuai fungsi yang ada. Preview dokumen memakai canvas sendiri dan tidak diwarisi shadow atau font UI secara sembarangan. QR pengesahan tetap utuh dan dapat dipindai dari PDF final.

## ID Digital dan Portfolio Saya

Identitas menonjolkan nama, divisi, ID, dan status dengan sumber data kru yang berlaku. QR tidak diletakkan pada background transparan atau diberi sudut yang memotong modulnya. Halaman verifikasi publik memuat informasi sesuai kontrak publik, tanpa membuka data internal.

Portfolio Saya menjaga operasi tulis per pemilik. Perubahan UI tidak boleh membuat kru bisa mengubah role atau portfolio orang lain. Halaman publik dapat memiliki shell lebih ringan sambil memakai typography dan tokens yang sama.

## Yayasan dan akses publik

Gunakan label area yang jelas untuk aset yayasan, aset publik, dan PTV Hub. Saat pindah area, tampilkan konteks pengguna serta akses yang berlaku. Jangan menyimpulkan model login hanya dari kesamaan tampilan.

<!-- PAGE -->
# 12 Aksesibilitas dan responsivitas

Target penerimaan adalah WCAG 2.2 level AA pada area yang diubah, dengan pemeriksaan pada alur utama [4]. Aturan PTV menambahkan area sentuh 44 x 44 px sebagai default nyaman; ukuran tersebut adalah keputusan produk, bukan pernyataan minimum AA untuk semua situasi.

## Pemeriksaan aksesibilitas

- Kontras teks normal minimal 4.5:1; teks besar minimal 3:1 menurut definisi WCAG.
- Batas dan indikator kontrol yang diperlukan untuk mengenali komponen memenuhi kontras 3:1 terhadap warna yang bersebelahan.
- Status memakai teks atau ikon selain warna. Grafik memakai label atau pola pembeda.
- Semua aksi utama dapat dioperasikan dengan keyboard dan memiliki fokus terlihat yang tidak tertutup header atau dialog.
- Label, heading, link, dialog, dan pesan status memiliki semantik yang benar.
- Zoom teks dan halaman tidak memotong isi atau menghilangkan aksi penting.

Disabled control memiliki pengecualian kontras dalam WCAG, tetapi data penting yang ditampilkan dalam keadaan noneditable tetap harus terbaca. Jangan memakai pengecualian itu sebagai alasan memudarkan seluruh form.

## Breakpoint kerja

| Rentang usulan | Perilaku |
| --- | --- |
| Di bawah 640 px | Satu kolom, navigasi mobile |
| 640 sampai 1023 px | Grid adaptif dan dock mobile |
| 1024 px ke atas | Sidebar tetap dan layout penuh |

Breakpoint utama diekstrak dari HTML. Pada 1280 px, cols berubah proporsi. Angka breakpoint bukan identitas perangkat. Sesuaikan saat isi menu, tabel, dan form memerlukan. Hindari deteksi perangkat melalui user agent untuk menentukan layout.

## Viewport pengujian

Periksa lebar 320, 390, 768, 1280, dan 1440 px. Uji desktop pada zoom 200% dan reflow setara 320 CSS px sesuai konteks WCAG. Tabel dua dimensi boleh memiliki scroll lokal sesuai pengecualian yang relevan; judul, filter, dan kontrol di sekitarnya tetap harus reflow.

Uji dengan keyboard, screen reader pada satu alur inti, reduced motion, dan nama panjang. Gunakan label status yang dapat dipahami pengguna dengan perbedaan persepsi warna. Jangan mengandalkan pasangan biru dan hijau sebagai satu-satunya pembeda.

<!-- PAGE -->
# 13 Implementasi dan pengujian

Implementasi mengikuti struktur repository yang ditemukan. Nama direktori berikut adalah usulan: docs/design-system untuk dokumentasi, styles/tokens untuk token, dan components/ui untuk komponen. Jangan membuat sistem kedua bila repository sudah memiliki fondasi yang dapat diperbaiki.

## Sumber tunggal

Pisahkan primitive tokens seperti warna dasar dari semantic tokens seperti text.primary. Komponen mengonsumsi semantic tokens; halaman memakai shared components. Nilai role, status bisnis, serta permission tetap berasal dari sumber fungsi yang berlaku.

Tambahkan katalog komponen pada lingkungan development yang sudah tersedia, atau halaman demo lokal yang tidak masuk navigasi produksi. Tampilkan setiap variant dan state. Komponen minimal: Button, Field, Select, Card, Dialog, Drawer, Badge, DataTable, EmptyState, Toast, serta PageHeader.

## Tahapan migrasi

1. Audit dan dokumentasikan baseline tanpa perubahan UI.
2. Ekstrak HTML, adaptasi SF Pro dan continuous corner, lalu bangun katalog komponen beserta state.
3. Audit semua komponen Hub terhadap katalog. Pilih pilot: satu daftar, satu form, dan satu halaman dengan komponen berulang.
4. Bandingkan dengan katalog hasil ekstraksi dan baseline saat ini. Pastikan polish tidak mengubah identitas atau komposisi.
5. Selaraskan modul yang masih menyimpang. Bagian yang sudah konsisten cukup diverifikasi.
6. Jalankan pemeriksaan akhir serta dokumentasikan pengecualian yang tersisa.

## Bukti penerimaan

Gunakan screenshot sebelum dan sesudah pada viewport, role, serta data uji yang sama. Stabilkan waktu dan data dinamis bila perlu. Perubahan visual yang disengaja dicatat; selisih gambar bukan otomatis regresi.

Jalankan build, typecheck atau lint yang tersedia, pemeriksaan aksesibilitas, dan tes alur terdampak. Verifikasi login, route, role, pencarian, filter, submit, error, arsip, serta unduh sesuai modul yang berubah. QR dan barcode diuji dari hasil final, bukan hanya preview layar.

## Kriteria selesai

SF Pro, palet biru, dan komposisi awal tetap terbaca pada hasil akhir. Setiap perubahan memiliki masalah asal dan komponen rujukan yang jelas. Tidak ada aksi inti yang rusak, overflow halaman, fokus terpotong, atau token acak baru. State error dan kosong bekerja. Hak akses tetap benar. Catat file berubah, hasil tes, browser yang diuji, fallback corner, dan keterbatasan yang nyata. Commit per kelompok perubahan agar dapat dikembalikan tanpa menghapus pekerjaan lain.

<!-- PAGE -->
# 14 Instruksi untuk Antigravity

Berikan paket PTV-Hub-Design-Pack-R03 ke Antigravity bersama project Hub yang sebenarnya. Instruksi ini dimulai dengan audit dan penyusunan standar, tanpa mengubah aplikasi pada langkah awal.

## Instruksi awal

Baca PTV-Hub-Guide-R03.md dan reference/ptv-dashboard-reference.html. Kerjakan hanya isi PTV Hub di ptvpro.com/hub. Hub berasal dari progresiftv.id/dasbor. PTVPro adalah nama domain dari PTVProduction; root ptvpro.com/ adalah launcher publik yang berada di luar scope. Login Hub dipertahankan persis.

HTML adalah prototipe visual, bukan sumber data atau fungsi produksi. Gunakan CSS serta komponen tampilannya untuk mendefinisikan standar konkret. Jangan menyalin mock data, role switcher, fake scan, fake upload, fake unduh PDF, atau simulasi logout ke aplikasi nyata.

Mulai read-only. Identifikasi framework, route, role, CSS, font, komponen, dan integrasi data Hub. Petakan token serta selector HTML ke komponen aktual. Untuk setiap aturan, catat asalnya sebagai ekstraksi, penyesuaian disepakati, atau usulan bagi komponen yang belum ada.

Pertahankan warna, gradient, atmosphere, transparansi, proporsi, dan ukuran referensi. SF Pro menggantikan prioritas Inter pada referensi sesuai keputusan produk. Continuous corner menggantikan sudut bulat biasa pada komponen yang sesuai; pill dan circle tetap mengikuti fungsinya. Background section Agenda berikutnya tidak otomatis diberi radius.

Perbaiki cacat sumber saat membangun standar: deklarasi warna invalid dan token gold serta g-500/g-700 yang tidak didefinisikan. Jangan mengarang pemetaan warna tanpa alasan. Uji kontras pada pasangan aktual dan jangan menyatakan semua token pasti memenuhi aksesibilitas.

Jangan menebak mana fitur lama atau baru. Audit seluruh isi Hub per keluarga komponen terhadap standar hasil ekstraksi. Pertahankan sistem filter khusus inventaris, dengan typography, warna, dan shape yang konsisten. Fungsi yang berbeda boleh mempunyai variant yang terdokumentasi.

Hasil tahap awal harus memuat peta route dan role, mapping komponen, standar hasil ekstraksi, penyesuaian font dan sudut, daftar masalah prioritas, daftar file terdampak, serta rencana katalog komponen. Catat halaman yang belum dapat diperiksa. Jangan ubah kode aplikasi atau database pada tahap audit ini.

Setelah implementasi ditugaskan, bangun katalog dahulu pada lingkungan development, kemudian terapkan pilot. Bandingkan katalog dengan HTML dan pilot dengan baseline Hub. Lindungi login dari dampak CSS bersama. Pertahankan autentikasi, permission, routing, query Supabase, data, validasi, dan seluruh fungsi aktual.

## Bukti selesai

Laporkan screenshot sebelum dan sesudah, asal setiap keputusan, file berubah, build dan tes fungsi terdampak, pemeriksaan aksesibilitas, serta browser dan fallback corner. Bedakan hasil yang sudah diuji dari yang belum. Baca MASTER-PROMPT-R03.md untuk urutan kerja lengkap dan aturan pembaruan dokumentasi.

<!-- PAGE -->
# 15 Referensi dan pemeliharaan

Panduan ini memandu penyelarasan PTV Hub yang sudah memiliki SF Pro dan palet biru. Revisi 03 mengganti arahan desain abstrak dengan token serta komponen dari HTML yang diberikan. Usulan hijau dan Inter pada versi pertama tidak berlaku. Rujukan vendor membantu menilai prinsip, tetapi tidak menentukan angka token, identitas brand, atau seluruh geometri komponen PTV.

## Rujukan resmi

[1] Apple Human Interface Guidelines. Prinsip desain dan aksesibilitas pada platform Apple. Rujukan untuk clarity, hierarchy, dan kualitas interaksi; bukan bukti bahwa aplikasi web harus meniru seluruh komponen Apple.

https://developer.apple.com/design/human-interface-guidelines/
https://developer.apple.com/design/human-interface-guidelines/accessibility

[2] Google Material Design 3. Rujukan untuk sistem komponen, state, serta struktur interaksi. PTV menetapkan styling sendiri setelah memeriksa kebutuhan halaman.

https://m3.material.io/

[3] MDN corner-shape. Rujukan teknis untuk properti sudut CSS serta kompatibilitas browser. Status dukungan harus diperiksa kembali saat implementasi.

https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/corner-shape

[4] W3C WCAG 2.2 Quick Reference. Rujukan penerimaan aksesibilitas untuk kontras, fokus, keyboard, resize, dan reflow. Lihat kriteria serta pengecualiannya saat melakukan evaluasi.

https://www.w3.org/WAI/WCAG22/quickref/

Rujukan diperiksa pada 13 Oktober 2026. Token dan ukuran referensi berasal dari HTML, bukan angka vendor. Penyesuaian SF Pro dan continuous corner berasal dari keputusan pengelola. Parameter polish yang belum terdapat di HTML diberi label usulan.

## Pemeliharaan versi

Simpan versi panduan bersama kode. Perubahan token yang memengaruhi banyak halaman harus disertai catatan dampak dan screenshot. Gunakan pembaruan kecil untuk perbaikan spesifikasi yang tidak mengubah kontrak; naikkan versi utama bila mengubah aturan atau API komponen secara tidak kompatibel.

Pengelola PTV menetapkan arah visual dan kebutuhan operasional. Developer menjaga token, kontrak komponen, serta dokumentasi. Reviewer memeriksa konsistensi visual, fungsi, dan aksesibilitas pada perubahan yang diajukan. Nama penanggung jawab disesuaikan dengan tim yang aktif.

Setiap laporan akhir menyebut bagian yang sudah diterapkan, pengecualian yang masih berlaku, serta langkah berikutnya yang konkret. Keberhasilan polish dinilai dari konsistensi dan kelancaran kerja kru pada halaman yang sebenarnya.
<!-- PAGE -->
# 16 Sumber HTML dan paket implementasi

Sumber utama: ptv-dashboard claude.html, 2303 baris. Salinan reference/ptv-dashboard-reference.html di paket mempertahankan byte sumber asli. SHA-256 tercatat dalam reference-tokens.json agar developer bisa memastikan memakai referensi yang sama.

## Perbedaan sumber dan target

| Area | Temuan sumber | Keputusan target |
| --- | --- | --- |
| Font | Inter mendahului SF Pro | Pertahankan SF Pro aplikasi |
| Sudut | border-radius biasa | Adaptasi continuous terpusat |
| Button | Pill, minimal 46 px | Pertahankan keluarga pill |
| Data dan role | Mock dan role switcher | Ikuti fungsi nyata Hub |
| Unduh dan scan | Simulasi feedback | Pertahankan integrasi aktual |
| Login | Tidak ada halaman login nyata | Login Hub tetap persis |

## Cacat sumber yang tidak diwariskan

Deklarasi ink-2 pertama memakai #365madeup yang invalid, lalu didefinisikan kembali sebagai #38587A. Ekstraksi memilih nilai valid. Referensi memakai gold, g-500, dan g-700 tanpa definisi; bagian terkait perlu pemetaan semantik yang dicatat sebelum dipakai.

CDN Inter dan Font Awesome adalah dependensi luar. Nilai tokens.css merupakan ekstraksi untuk pemeriksaan, bukan stylesheet yang langsung ditempel global. Penerapan harus dibatasi ke isi Hub agar login serta app lain tidak terkena.

## Isi paket

PTV-Hub-Guide-R03.md menjadi panduan utama untuk AI. MASTER-PROMPT-R03.md mengatur alur audit sampai penerapan. reference-tokens.json menyimpan nilai dan metadata sumber, sedangkan reference-tokens.css memudahkan pemeriksaan primitive CSS.

PDF dan DOCX disediakan untuk dibaca tim. README.md menjelaskan urutan pemakaian serta penggantian panduan lama. HTML asli tetap disertakan sebagai bukti referensi.

## Batas validasi saat penyusunan

Ekstraksi telah diperiksa terhadap kode sumber. Tampilan HTML pada browser belum divalidasi dalam paket ini; baseline render harus dibuat pada tahap audit dengan mencatat font dan ikon yang berhasil dimuat. Paket tidak menyatakan migrasi Hub atau koneksi produksi telah selesai.

