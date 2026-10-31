# PTV-DEV-167 — valuasi selesai; cutover keamanan menunggu gate

> Kelanjutan168: [matriks dan readiness terbaru](PTVPRO-INVENTORY-168-READINESS.md). Routing hosted-Staging diperbaiki, proposal guard report/rollback14checks lokal PASS; belum DDL cloud, akun terbatas atau hosted PASS. Bukti valuasi167 di bawah tetap berlaku.

26 Oktober 2026, zidnal / Codex. **GO valuasi: EXECUTED_VERIFIED di Staging. NO-GO cutover keamanan.** Tidak ada revoke/grant/policy cloud, perubahan akun, Production, commit/push/deploy, atau migrasi destruktif. Implementasi aplikasi165 dan hasil CRUD166 yang sudah PASS tidak diulang; hanya fixture minimum untuk valuasi baru diuji.

## Status blocker

| Blocker | Hasil167 | Langkah tersisa |
| --- | --- | --- |
| Valuasi503/42P10 | **SELESAI cloud** | Tidak perlu mengulang migrasi/login/CRUD valuasi tanpa perubahan relevan |
| Rollback valuasi | **PASS lokal terisolasi** | Cloud rollback tidak diperlukan/dijalankan; perlu persetujuan terpisah jika kelak digunakan |
| Rollback grant/policy | **PASS model lokal terisolasi** | Bukan bukti rollback pada hosted/cloud; fresh drift/dependency check tetap wajib sebelum cutover |
| Penguji live tanpa capability | **TERTUNDA** | Identitas existing dan otorisasi pemilik belum diberikan; template tes siap, tidak membuat credential atau mengubah role |
| Native report berbagi Lost & Found | **TERPETAKAN, belum ditutup** | Siapkan/review guard native khusus damage yang tetap membiarkan Lost & Found existing; uji kedua jalur sebelum ACC cutover |
| Consumer hosted/aktivasi | **BELUM TERBUKTI** | Build Staging/cookie API harus diverifikasi pada setiap consumer; tidak ada deploy dalam scope ini |
| Revoke grant lama | **TIDAK DIJALANKAN** | Semua gate pengganti, negative-role, rollback, dependensi dan ACC privilege harus lengkap |

## Diagnosis dan migrasi yang benar-benar dieksekusi

API `api/inventaris.ts` memakai upsert `ON CONFLICT(inventaris_id)`. Skema sebelum perubahan hanya mempunyai unique primary key `id`, sehingga arbiter conflict tidak ditemukan. Preflight fresh:114 baris,0 key NULL,0 kelompok duplikat,0 referensi aset hilang. Ini sesuai model DTO/mapper: satu valuasi **terkini** per aset; histori event ada di audit, bukan baris valuasi ganda.

Menurut [PostgreSQL17 INSERT](https://www.postgresql.org/docs/17/sql-insert.html), target conflict harus mempunyai arbiter unique yang cocok. [CREATE INDEX](https://www.postgresql.org/docs/17/sql-createindex.html) juga menegaskan bahwa nama index existing saja tidak membuktikan definisi yang benar. Karena itu paket167 memeriksa struktur index, bukan sekadar `IF NOT EXISTS`.

- SQL: [migrasi](PTVPRO-INVENTORY-167-VALUATION-MIGRATION.sql), [rollback](PTVPRO-INVENTORY-167-VALUATION-ROLLBACK.sql).
- SHA256 migrasi yang **disetujui eksplisit pengguna**: `fe9f5756ea4b56933da2505d5d3f0db0c9ab365bd921ed067472734e1326cfa9`.
- SHA256 rollback: `1d9535473ec12522d99eb9a33685626dbef59c273e7be3a16316c89efb420b01`.
- ACC hanya DDL valuasi Staging; **bukan** persetujuan perubahan privilege atau guard report.
- Migrasi cloud `inventory_167_valuation_asset_unique`, receipt/version `20261026135324`, PASS.
- Index `ptv_nilai_inventaris_asset_unique_167` valid, ready, immediate, unique pada `inventaris_id`; tidak partial/expression. Index equivalent yang sudah valid dipakai ulang; collision nama asing, NULL/duplikat/orphan menghentikan transaksi. Lock timeout5detik/statement timeout60detik membatasi penantian writer.
- Paket tidak mengubah baris, grants, policies, kolom atau relasi FK. Rollback hanya dapat menghapus index167 bertag kepemilikan yang cocok, memakai RESTRICT; tidak menyentuh index asing atau data. Rollback mengembalikan kondisi lama yang tidak mendukung upsert ini, sehingga jangan dijalankan tanpa koordinasi.

Postflight sebelum fixture membuktikan digest114 baris existing, grant tabel dan semua policy Storage **sama** dengan sebelum DDL. Sesudah fixture valuasi dibersihkan, digest tersebut tetap sama. Bukti agregat dan receipt ada di [validation](PTVPRO-INVENTORY-167-VALIDATION.json).

## Valuasi dengan sesi Portal nyata

Runner existing diberi mode `PTV_INVENTORY_VALUATION_ONLY=true`; tidak mengulang upload/checkout/return/QC166. Setup memakai satu master dan satu unit fixture, credential privat existing, cookie Portal nyata dan project Staging yang dipin.

1. Create valuasi: HTTP200 dan record baru terkonfirmasi PostgreSQL.
2. Update: HTTP200, ID valuasi tetap.
3. Retry payload update: HTTP200, tetap satu record untuk aset yang sama dan ID tetap.
4. Nominal perolehan, nilai buku0, residu0, vendor, invoice, sumber, status, dan catatan cocok dengan payload terakhir di database.
5. Tiga permintaan menambah tepat tiga event `inventory_valuation_save_confirmed` pada entity/account fixture. Ini membuktikan append audit event, **bukan** fitur histori snapshot nilai lama yang baru dibuat.
6. Logout dan cleanup PASS; kembali164 master/251 unit/114 valuasi,0 fixture. Audit operasional sah dipertahankan. Tidak ada password/cookie di output.

## Rehearsal yang disetujui dan benar-benar dijalankan

Pengguna menyetujui **PostgreSQL lokal terisolasi**, bukan cloud branch. Supabase Staging tidak mempunyai branch terisolasi yang tersedia; tidak membuat branch berbiaya atau koneksi rehearsal ke database operasional.

`scripts/test-inventory167-local.mjs` memakai PostgreSQL17 pada127.0.0.1:55439, cluster khusus ber-marker, database fixture unik dan data sintetis. Tidak menerima parameter koneksi, tidak membaca environment credential cloud. Database sendiri dihapus dan server sendiri dihentikan; cluster cache tidak dihapus massal.

**28 pemeriksaan PASS** di [hasil lokal](PTVPRO-INVENTORY-167-LOCAL-RESULTS.json): baseline42P10; instalasi/idempotensi index; insert/update/retry; metadata/nilai nol/ID tetap; row/history preservation; collision/duplikat/ownership/dependency protection; rollback idempoten; guard candidate166; revoke model dan policy khusus inventory; akses fixture bucket lain tetap; server privilege tetap; approval rollback; pemulihan semantic ACL/policy dan data.

Rehearsal awal memakai hash array ACL mentah sehingga urutan grant yang berubah menghasilkan mismatch palsu. Pembanding diperbaiki ke tuple terurut object/grantee/grantor/privilege/grant-option. Hasil akhir memverifikasi izin efektif dan policy yang sama, tanpa mengklaim byte-order array ACL identik.

Fungsi native dalam model ACL memakai stub dengan signature yang sama; rehearsal ini **tidak** membuktikan seluruh body RPC atau layanan Storage HTTP cloud. Logika RPC/publik-media yang sudah PASS166 tidak diulang. Bucket lain pada model memakai fixture sintetis, bukan audit Finance.

## Matriks dependensi baca/tulis

| Permukaan | Jalur Staging yang dipertahankan | Akses native / tindakan cutover |
| --- | --- | --- |
| Katalog/detail/unit tersedia/search | service Inventaris + `/api/inventaris`, inventory.view | Tiga tabel master/unit/nilai masih mempunyai grant native; master/unit anon read terbukti166. Tutup client grants setelah consumer aktif |
| Kode/create/edit unit | inventory.create/edit + RPC existing server | Native next-code/create/update authenticated EXECUTE harus ditutup tanpa mencabut service_role |
| Valuasi | valuation.view/manage + upsert unik167 | Index sekarang benar; visibility nilai tetap khusus. Grant native belum dicabut |
| Upload/gambar | cookie API upload, origin/capability, path immutable akun | Policy authenticated native write dan metadata list masih ada. Tambah restrictive policy khusus inventory; jangan mengubah bucket lain atau URL media public |
| Cleanup foto | Jalur cookie tidak menghapus foto saat hasil belum pasti | Policy cleanup native bergantung auth.uid dan referensi master; tidak boleh dijadikan alternatif untuk caller Portal |
| Loan/history/return | `/api/peminjaman` + wrapper server account/iat, kemampuan per operasi | Enam RPC native mencakup checkout/return/single. Tabel ptv_peminjaman punya grant luas tetapi **RLS aktif tanpa policy**, sehingga default-deny saat ini; grant saja bukan bukti row terbuka |
| Damage/QC | `/api/lapor-kerusakan` + server report RPC | Tabel report tidak memiliki direct insert/update client privilege. Native report SECURITY DEFINER tetap jalur mutasi unit yang harus ditangani |
| Shared Lost & Found/report | Pertahankan native Lost & Found existing | Jangan blanket-revoke public/private report function. Perlu guard p_module=damage dan p_account_id IS NULL, sementara server damage p_account_id terverifikasi tetap lolos |
| Hosted/non-staging build | Mode staging terbukti lokal terhadap cloud | MODE di luar staging masih menyimpan native adapter. Bukti loopback/build bukan bukti seluruh hosted consumer sudah berpindah; tidak deploy di167 |

Tidak ditemukan dependent view/materialized view melalui katalog rewrite/depend untuk tabel Inventaris/loan yang diperiksa. Source frontend/backend dan akses tabel/fungsi terkait diperiksa terarah, tanpa audit ulang Hub. Private report body digest tetap `050ec0fe8d7414999c6654e9e7c41ee9`; modifikasi masa depan harus memakai CAS/fingerprint body dan menyimpan rollback definisi asli. `pgrst.db_schemas` tidak tersedia dari setting yang diperiksa, sehingga tidak menyimpulkan private schema pasti tidak terekspos.

## Tes negatif yang siap tetapi belum boleh dinyatakan PASS

[Template](PTVPRO-INVENTORY-167-NEGATIVE-TEST-PLAN.json) sengaja menyimpan identitas/approval kosong. Pertanyaan identitas existing sudah diajukan; belum ada penguji dengan hak terbatas yang dikonfirmasi. Tidak menurunkan/mengangkat hak jid/rouf, tidak membuat password atau sesi buatan.

Sesudah identitas sah disetujui: baca baseline status/version/profil/override secara read-only, gunakan mekanisme privat existing untuk login, verifikasi account ID dari sesi, jalankan hanya kasus yang capability-nya benar-benar ditolak. Operasi harus403 dan fixture/object tidak berubah; uji kontrol200 hanya untuk izin yang memang ada. Upload ditolak jika create **dan** edit tidak ada. Gunakan fixture milik aktor setup berizin; jangan menyasar aset operasional. Logout/revocation dan cleanup diverifikasi. Tidak memberi privilege sementara demi tes.

## Urutan cutover dan rollback

1. Valuasi167 tetap terpasang; tidak di-rollback bersama pemulihan ACL.
2. Tutup gate identitas penguji dan jalankan negative-role cloud. Kasus ownership403 yang sudah PASS tidak menggantikannya.
3. Siapkan/review patch native report khusus damage (bukan blanket revoke), beserta definisi asli/CAS dan rollback. Uji native damage ditolak, server damage tetap berhasil, native/server Lost & Found tidak berubah.
4. Inventaris seluruh consumer hosted/client, mode build, API route dan storage calls; aktivasi pengganti Staging harus dibuktikan. Tidak mengubah perilaku Production dan tidak melakukan deploy tanpa tugas/ACC terpisah.
5. Refresh snapshot ACL/policy/owner/grant-option. [Candidate166](PTVPRO-INVENTORY-166-CUTOVER-CANDIDATE.sql) tetap terkunci dan **bukan paket executable yang sudah siap**; dependency report dan gate consumer/tester harus masuk revisi baru. Grant loan yang default-deny tetap dicatat, jangan mengubah RLS jadi permissive.
6. Rehearse paket final dan rollback pada isolasi yang disetujui; validasi diff hanya object yang dituju, service_role dan bucket lain terjaga. Bukti28 model lokal tidak menggantikan perubahan baru yang belum direhearsal.
7. Minta ACC eksplisit pada hash paket privilege final. Hanya setelah semua gate PASS boleh transaksi revoke/grant/policy dijalankan.
8. Post-cutover: anon REST master/unit/metadata tidak bocor, RPC/upload native ditolak, cookie berizin berhasil, cookie capability-denied403, data/actor/unit/history tetap benar.
9. Jika gate postflight gagal, rollback ACL/policy yang cocok dengan snapshot serta revert guard report yang cocok dengan CAS; jangan otomatis menghapus unique index atau data fixture/operasional secara luas. Revalidasi dan catat insiden; rollback keamanan memang membuka kembali surface lama.

## Validasi dan batas akhir

54 tes Vitest terkait PASS; typecheck/lint/build mode staging PASS (warning chunk existing). Rehearsal SQL28 PASS dan syntax runner PASS. Hanya DDL valuasi yang telah di-ACC dieksekusi cloud; privilege/cutover/report guard tidak disentuh. Source aplikasi/UI dan alur stabil tidak didesain ulang.

Keputusan: **GO valuasi, NO-GO cutover keamanan** sampai identitas tes negatif, native report, hosted activation dan ACC privilege lengkap. Hygiene CLN-178; sesi berikutnya hanya menutup gate tersisa, bukan mengulang hasil PASS.
