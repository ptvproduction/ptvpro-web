# PTV-DEV-165 — Inventaris dan Storage melalui sesi Portal

> **Update167:** valuasi42P10 yang ditemukan166 sudah diselesaikan melalui DDL Staging yang di-ACC; create/update/retry metadata/nilai nol cloud PASS. Cutover privilege tetap NO-GO; [paket dan gate167](PTVPRO-INVENTORY-167-READINESS.md).

> **Update166:** blocker kredensial terselesaikan tanpa bypass DPAPI. Login jid/rouf, upload, create/edit, loan/return/histori dan QC cloud PASS. Valuasi gagal42P10 karena unique inventaris_id tidak ada. Grant/policy native tetap, cutover NO-GO; [bukti dan gate166](PTVPRO-INVENTORY-166-CLOUD-CUTOVER.md). Riwayat165 di bawah tidak ditulis ulang sebagai bukti cloud.

26 Oktober 2026, operator zidnal / Codex. **Implementasi teruji lokal; integrasi cloud positif PARTIAL.** Scope hanya Inventaris/unit/valuasi/Storage, keterkaitan peminjaman/pengembalian/kerusakan, serta pencarian Inventaris yang sebelumnya membaca Data API langsung. Tidak redesign, perubahan skema/grant/policy, commit, push, atau deploy. Production tidak diakses.

## Perubahan yang diterapkan

- API `/api/inventaris` menerima cookie `ptv_hub_session`, memverifikasi signature/expiry, registry sesi/revocation, akun/membership/lockout/cutoff dan capability live melalui `resolveLiveAccess`. Project ref server dipatok ke Staging `swadgljnyelsjstqqxbm`. Tidak menerima actor/role/capability dari browser.
- Adapter Inventaris pada **MODE=staging** memakai API untuk list/detail/kode, create/update, valuasi, diagnostik dan upload. Mapping DTO/UI existing dipertahankan. Local adapter tidak dapat dipilih pada mode tersebut; client browser tidak membuat query/RPC atau sesi Supabase untuk jalur ini. Jalur di luar mode Staging tidak diperluas dalam sesi ini.
- Create dan edit tetap memakai `rpc_create_inventaris` / `rpc_update_inventaris` existing. Tidak fallback insert master+unit terpisah. Create menolak unit awal dipinjam serta kondisi rusak yang tidak maintenance. Unit edit tetap memakai verifikasi parent dan transaksi RPC; status pinjam tidak diganti lewat edit master.
- Request UUID create dinamespace server dengan HMAC akun terverifikasi. Akun berbeda tidak dapat memakai ulang ruang idempotensi akun lain; payload mismatch tetap diperiksa RPC existing. Timeout bukan bukti gagal/sukses, dan client tidak lagi merekonsiliasi berdasarkan ID mentah saja pada mode Portal. Retry memakai request key yang sama.
- Kolom `ptv_inventaris.created_by` tetap FK ke `auth.users`, tidak diisi UUID akun Portal atau identitas palsu. API merekam intent dan konfirmasi dengan `auth_audit_log.actor_id = canonical_identity.id` serta account/entity reference. Audit intent harus berhasil sebelum mutasi. Audit dan mutasi bukan satu transaksi lintas RPC: kegagalan konfirmasi audit menghasilkan status belum pasti, bukan klaim sukses; operator perlu memeriksa hasil sebelum retry.
- Valuasi membutuhkan hak khusus. API list/detail tidak memilih kolom harga/nilai tanpa hak valuation view/manage. Nilai buku nol dipertahankan. Vendor, invoice, sumber, status, residu dan link dokumen yang memang ada dalam skema Staging kini disimpan/dipetakan, tidak lagi hilang saat reload. Nama aktor tidak diambil dari payload client.
- Universal Search pada Staging membaca melalui service Inventaris yang sama. UI, CSS, kategori, shape, tombol dan barcode tidak didesain ulang.
- Peminjaman/pengembalian serta laporan pada Staging memakai API cookie juga ketika konfigurasi auth bertuliskan native. Hak checkout/return/report/QC dicek di server sebelum RPC, selain pemeriksaan atomik RPC existing. Hak view tidak mengizinkan mutasi.
- Histori lama yang berisi ID unit kini memetakan nama/kategori/foto dari `unit.inventaris_id`, bukan memperlakukan ID unit sebagai ID master. Arsip tetap historis dan tidak diubah menjadi transaksi baru.

## Matriks operasi

| Operasi | Otorisasi server | Penyimpanan / kontrak |
| --- | --- | --- |
| Katalog, detail, unit tersedia | inventory.view | SELECT server; available dihitung mapper existing |
| Kode berikutnya | inventory.create | Query kode server; konflik final tetap di RPC |
| Tambah master + unit | inventory.create | RPC atomik existing, actor-scoped request ID |
| Edit master / atribut unit | inventory.edit | RPC existing, anti-cross-asset dan concurrency check existing |
| Mutasi status unit langsung | inventory.units.manage lalu HTTP409 | Sengaja tidak mengubah status di luar transaksi loan/QC; pemanggil operasional memakai RPC loan/report |
| Daftar nilai | inventory.valuation.view | Query nilai server |
| Simpan / hapus record valuasi | inventory.valuation.manage | Upsert/delete dengan konfirmasi row; audit aktor kanonikal |
| Upload foto alat | inventory.create ATAU inventory.edit | Server Storage inventory, path akun, immutable object |
| Baca peminjaman | loans.view | API cookie, live permission dan RPC baca server existing |
| Checkout / pengembalian | loans.checkout / loans.return | API + RPC atomik existing, account/iat dari sesi |
| Baca / buat laporan kerusakan | damage.view / damage.report | API + RPC existing, unit-parent diverifikasi DB |
| QC / hapus laporan kerusakan | damage.qc.approve | API + RPC existing; bukan izin inventory.view |

## Storage dan lampiran

- Bucket aktual `inventory` sudah ada dan **public**, batas bucket 15 MiB, MIME JPEG/PNG/WebP/GIF/HEIC/HEIF. Public URL foto existing dipertahankan; pembacaan media publik tidak diklaim memerlukan cookie.
- Upload baru melewati server cookie, same-origin dan capability; path dibuat server `catalog/portal/<account>/<UUID>.<ext>`, tanpa bucket/path/overwrite dari browser. Signature berkas dan MIME diperiksa, SVG/HTML ditolak. URL foto create harus berasal dari namespace akun; edit boleh mempertahankan URL existing alat.
- Payload upload server maksimal 4 MiB agar tidak melewati batas payload fungsi hosting. Input foto masih maksimal 15 MiB; yang lebih besar dari 4 MiB dipadatkan memakai utilitas canvas existing (maksimum 800px, JPEG quality0.8). Jika browser tidak dapat memadatkan format tersebut, unggahan gagal jelas; tidak ada base64 fallback yang diklaim sebagai Storage berhasil.
- Foto tidak otomatis dihapus saat create gagal/timeout: objek mungkin sudah direferensikan commit sebelumnya. Lifecycle pembersihan orphan terpisah belum ditambahkan. Runner hanya menghapus objek fixture yang dibuatnya sendiri.
- Foto laporan kerusakan existing dikirim dalam payload report melalui cookie. Fungsi DB existing mendukung data URL JPEG/PNG/WebP dan URL Storage Staging; tidak ditambahkan jalur upload/kolom baru. Dukungan SQL ini bukan bukti persistensi foto positif sesi 165.
- Tidak ada file-upload invoice aktif di dua form valuasi yang diperiksa; form mengirim metadata invoice/vendor. Link dokumen pada DTO hanya menerima Storage Staging. Tidak membuat fitur lampiran baru.

## Bukti validasi dan batasnya

1. **Regresi lokal: 10 file / 145 tes PASS.** Mencakup cookie anonim/expired/revoked, privilege claim palsu, grant tidak cukup, namespace retry, penolakan konflik RPC/cross-asset, preservasi metadata valuasi, MIME/size/namespace Storage, mutasi loan/report tanpa izin, mode native Staging, dan identitas unit di histori kanonikal/historis. Nama tes Staging tidak mengubah fixture/mock menjadi bukti cloud.
2. **Typecheck dan lint PASS; build Staging PASS.** `npm run typecheck`, `npm run lint`, `npm run build -- --mode staging`. Warning bundle >500 kB existing dan warning SSR/log fixture suite lama tetap ada; bukan error lint.
3. **HTTP runtime nyata PASS:** Vite mode staging port5174, auth vercel, inventory supabase, project ref tepat. Anonim mendapat401 pada `/api/inventaris`, `?action=valuations`, `?action=diagnostics`, `/api/peminjaman`, `/api/lapor-kerusakan`. Server buatan sesi ditutup.
4. **PostgreSQL Staging read-only:** 164 master,251 unit,2 loan kanonikal,0 loan aktif,0 referensi loan tanpa unit,0 fixture165; gate aktif/Root1. Inspeksi fungsi nyata mengonfirmasi service-role support create/update, transaksi dan row lock loan, serta pemeriksaan unit-parent pada report. Tidak ada migrasi atau mutasi Inventaris/Storage cloud dari sesi ini.
5. **Uji positif cloud TERTUNDA:** runner berhasil memverifikasi runtime dan anonim, lalu berhenti pada `private_credential_available=false`, sebelum mengirim login. Tidak ada password/token ditampilkan, tidak menggunakan kredensial alternatif atau membuat sesi palsu. Upload/create/edit/valuasi/checkout/return/QC nyata belum dijalankan. Bukti agregat di [validation JSON](PTVPRO-INVENTORY-165-VALIDATION.json).

## Blocker dan cutover tersisa

**P1 — Grant/policy akses langsung belum dicabut.** Staging masih memiliki SELECT anon/authenticated untuk tiga tabel Inventaris dan policy SELECT master/unit USING true. RPC native serta policy write Storage authenticated existing juga tetap ada. Jalur aplikasi Staging kini memakai cookie, tetapi itu tidak menutup permintaan langsung ke Data API. Karena schema/kontrak existing dipertahankan dan tidak ada deploy dalam scope ini, tidak mencabut akses dari build lama secara diam-diam.

Cutover harus mengaktifkan kode API/adaptor Staging ini dan menutup privilege native Inventaris sebagai satu pekerjaan terkoordinasi: snapshot ACL/grant/policy, revoke akses data tiga tabel dan EXECUTE RPC native dari client roles dengan service_role tetap; batasi kebijakan write objek hanya namespace/bucket Inventaris tanpa menyentuh bucket lain. Uji anon REST/RPC/upload harus ditolak, cookie berizin harus tetap berhasil, lalu uji revocation saat sesi aktif. Media katalog public merupakan kontrak terpisah; jangan mengubah bucket public menjadi private tanpa penyesuaian URL.

**P1 — Bukti positif belum tersedia.** Pemilik akun dapat menjalankan runner [verify-inventory165-staging.mjs](../scripts/verify-inventory165-staging.mjs) di kanal privat yang memang bisa membuka credential miliknya, setelah meninjau scope fixture. Runner memerlukan opt-in `PTV_RUN_INVENTORY_STAGING_TESTS=true` serta `PTV_TEST_LOGIN_IDENTIFIER`; tidak menerima atau mencetak password pada argumen. Runner membuat fixture master/dua unit/foto/valuasi/loan/report, memeriksa database, logout, lalu membersihkan hanya ID/marker fixture yang dibuatnya. Jangan menganggap runner sudah PASS seluruhnya.

**Batas arsitektur tanpa migrasi:** RPC Inventaris existing melakukan service-role authorization; gate Portal berada di API sebelum RPC, bukan pemeriksaan izin Portal atomik di dalam fungsi DB. Wrapper DB khusus Portal dengan binding aktor/revocation atomik dapat direview terpisah jika dibutuhkan; tidak memalsukan auth.uid/JWT untuk mengatasinya.

Production tidak diakses dan perilaku mutasinya tidak diperluas. Dua usulan patch yang kondisi runtime-nya terlalu luas ditolak automatic approval review; tidak diterapkan. Alternatif akhirnya dibatasi MODE staging.

Hygiene CLN-176: mapper/DTO/RPC existing direuse, tidak membuat engine transaksi paralel atau helper session palsu; test runner ad-hoc dipindah ke satu lokasi scripts dengan opt-in. Trailing whitespace dan blank EOF pada dua file tersentuh dibersihkan; diff-check kedua file PASS (hanya pemberitahuan konversi LF/CRLF Git). Syntax check runner dan parse validation JSON PASS. Tidak cleanup massal, baseline desain/cache/legacy/perubahan Antigravity dipertahankan.
