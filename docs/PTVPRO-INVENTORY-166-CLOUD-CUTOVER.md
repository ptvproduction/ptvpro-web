# PTV-DEV-166 — Cloud Staging dan keputusan cutover Inventaris/Storage

> **Update167:** setelah ACC eksplisit, unique index valuasi167 dipasang di Staging dan create/update/retry cloud PASS; data existing/grant/policy tidak berubah. Rehearsal lokal28checks PASS atas persetujuan pengguna. Cutover keamanan tetap NO-GO karena gate penguji/consumer/shared-report/ACC privilege; [readiness terbaru](PTVPRO-INVENTORY-167-READINESS.md). Bukti166 di bawah tetap riwayat.

26 Oktober 2026, operator zidnal / Codex. **Status final: PARTIAL, cutover NO-GO.** Prasyarat gagal terbukti; tidak ada grant/policy/schema yang diubah. Tidak commit/push/deploy, tidak mengakses Production, tidak mengerjakan Portal persistence/notifikasi/desain.

## Mekanisme privat Phase 1 ditemukan dan dipakai

Artefak password DPAPI Phase1 existing tersedia pada profil pemilik. Metadata menunjukkan dua artefak dimiliki Windows SID pemilik yang sama; guard `Assert-Dev155Acl` existing dan dekripsi native `ConvertTo-SecureString` PASS. Tidak ada password baru, salinan plaintext file, perubahan ACL/DPAPI, execution-policy bypass, atau kredensial buatan.

Kegagalan runner165 bukan bukti artefak hilang: pemeriksaan sandbox dan proses pemilik memiliki visibilitas berbeda; Windows PowerShell anak juga mewarisi path modul PowerShell lain sehingga `Get-Acl` tidak tersedia. Variabel lingkungan Windows dapat mempunyai duplikasi nama beda kapitalisasi pada worker tes. Pembaca kini memakai script berparameter `read-phase1-portal-private.ps1`, guard ACL/reparse existing, native DPAPI, dan pipe redirect. Runner menormalkan hanya `PSModulePath` proses anak ke modul bawaan Windows PowerShell serta membuang duplikasi nama tersebut secara case-insensitive. Tidak mengubah environment permanen atau guard manual-console untuk kredensial administrator database.

Plaintext hanya transit di memori/pipe menuju request login HTTPS atau server loopback Staging milik runner; tidak menjadi argumen proses, environment password, log, dokumentasi atau output tool. SecureString/BSTR dibersihkan pada helper. Error helper hanya kode tahap konstan; cookie tidak dicetak. Tests helper memakai metadata cmdlet/AST/GUID kosong, bukan credential nyata, dan memerlukan opt-in runtime pemilik.

## Hasil nyata cloud

| Skenario | Hasil | Batas bukti |
| --- | --- | --- |
| Runtime | PASS | Vite mode staging, port5174, project swadgljnyelsjstqqxbm |
| Login jid dan rouf | PASS HTTP200 | Kredensial existing via DPAPI; cookie Portal nyata; logout PASS |
| Anonim API Inventaris | PASS401 | Tidak memakai cookie atau sesi palsu |
| Katalog dengan cookie berizin | PASS200 | Data berasal dari Supabase Staging |
| Sesi nyata mencoba namespace foto asing | PASS403 | Uji otorisasi sumber daya; bukan bukti akun tanpa capability |
| Upload Storage | PASS | Objek gambar fixture benar-benar diunggah ke bucket inventory; dibersihkan |
| Create + replay | PASS | Dua unit, master ID sama pada retry, tidak menggandakan unit |
| Edit dua unit | PASS | RPC existing berhasil dengan data fixture |
| Valuasi | **FAIL503 / SQLSTATE42P10** | Skema tidak menyediakan unique key untuk ON CONFLICT(inventaris_id) |
| Checkout dua unit | PASS | Baris loan menyimpan UUID unit fixture yang benar, status unit dipinjam |
| Return per unit + sisa transaksi | PASS | Kedua histori returned dan tetap menunjuk unit yang benar |
| Laporan kerusakan + QC | PASS200 | Unit-parent benar; SQL existing memakai status unit rusak setelah laporan, bukan maintenance; QC dikonfirmasi |
| Akun live tanpa capability | **BELUM TERSEDIA** | Kedua akun aktif memiliki seluruh7 capability inventory; tidak mengubah Root/recovery atau mengarang akun/password |

Runner awal berhenti saat valuasi gagal. Untuk mengumpulkan bukti independen setelahnya, runner mempertahankan exit code gagal tetapi melanjutkan sirkulasi/QC, lalu cleanup. Ekspektasi runner unit rusak diselaraskan dengan fungsi SQL aktual. Tidak memperbaiki SQL bisnis atau mengulang implementasi aplikasi yang sudah PASS.

## Temuan valuasi yang membatalkan prasyarat

`ptv_nilai_inventaris` mempunyai114 baris,0 kelompok inventaris duplikat, dan hanya unique index primary key `id`. API165 memakai upsert `onConflict: inventaris_id`, sehingga PostgreSQL menolak dengan42P10 sebelum nilai tersimpan. Fixture dibersihkan; angka114 bukan hasil penyimpanan baru dari runner.

Langkah minimum: review penambahan unique index pada `inventaris_id` setelah fresh duplicate/null/dependency check dan rollback disiapkan, lalu uji save/update/retry/zero-book-value cloud. Contoh perubahan non-destruktif yang **belum dijalankan**:

```sql
CREATE UNIQUE INDEX ptv_nilai_inventaris_asset_unique_166
ON public.ptv_nilai_inventaris (inventaris_id);
```

Rollback hanya untuk index yang benar-benar dibuat oleh perubahan tersebut: `DROP INDEX public.ptv_nilai_inventaris_asset_unique_166`. Jangan mengganti nama/menghapus index existing, melakukan deduplikasi otomatis, atau memakai update+insert terpisah yang menghilangkan jaminan atomik upsert. Sesi166 tidak menerapkan migrasi ini karena cutover keseluruhan belum siap.

## Audit jalur langsung dan dependensi

- **Data API nyata tanpa cookie:** anon key Staging dapat membaca master dan unit (HTTP200, terdapat baris). Valuasi ditolak401 pada probe aktual; grant tabelnya tetap luas, RLS membatasi hasilnya. Jangan menyamakan grant tabel dengan hak row efektif.
- **Metadata Storage nyata:** list bucket inventory memakai anon key tanpa cookie mengembalikan200 dengan metadata objek. URL media bucket public tetap merupakan kontrak katalog existing, bukan bukti otorisasi Portal.
- Tiga tabel Inventaris memberi privilege luas kepada anon/authenticated; snapshot menyimpan ACL persis, termasuk MAINTAIN PostgreSQL17. Service_role tetap mempunyai akses yang dibutuhkan API pengganti.
- Enam RPC native inventory/create/update/next-code/checkout/return/single-return masih executable oleh authenticated; anon tidak memiliki EXECUTE. Server replacement memakai create/update existing dan wrapper loan server yang berbeda. Menutup hanya tabel tidak menutup SECURITY DEFINER RPC native.
- Tidak ditemukan view publik yang bergantung langsung pada tiga tabel tersebut melalui katalog view_table_usage. Fungsi yang menyebut tabel diperiksa terarah, termasuk private loan/report dan wrapper publiknya; ini bukan audit global seluruh fungsi dinamis.
- RPC native `rpc_write_report` dan private `ptv_report_private.write_report` masih dapat dipanggil authenticated. Jalurnya berbagi Lost & Found dan damage; mutation unit terjadi melalui SECURITY DEFINER. Guard p_account_id non-null mensyaratkan service_role, sehingga authenticated tidak boleh menyamar sebagai aktor server, tetapi native auth.uid path tetap ada. Mencabut EXECUTE generik akan berdampak pada Lost & Found, di luar cutover Inventaris murni.
- Source client MODE staging memakai API pengganti; source native di luar mode tersebut masih dipertahankan. Tidak ada bukti seluruh consumer hosted menggunakan build staging yang sesuai, dan deployment dilarang pada tugas ini. Jangan mencabut grant karena keberhasilan server loopback saja.

## Paket cutover dan rollback

- [ACL snapshot](PTVPRO-INVENTORY-166-ACL-SNAPSHOT.json): tiga table ACL, enam function ACL, empat policy Storage inventory, serta12 statement restore grant berdasarkan keadaan aktual.
- [Candidate cutover](PTVPRO-INVENTORY-166-CUTOVER-CANDIDATE.sql): draft revoke client roles pada tiga tabel/enam RPC dan policy Storage RESTRICTIVE khusus bucket inventory. Service_role dan bucket lain tidak ditargetkan. **Barrier RAISE EXCEPTION aktif, tidak dijalankan dan belum lengkap untuk dependency shared report.** Jangan menghapus barrier tanpa paket baru yang direview setelah semua gate terpenuhi.
- [Rollback](PTVPRO-INVENTORY-166-ROLLBACK.sql): exact restore grant snapshot dan drop hanya empat policy baru bernama166; policy existing tidak ditimpa. Default ditahan oleh approval setting. **Tersedia sebagai artefak, belum direhearsal atau diaplikasikan**, sebab cutover tidak terjadi. Rollback akan membuka kembali akses lama; bukan perbaikan keamanan.

Gate eksekusi yang belum terpenuhi: valuasi cloud PASS; akun existing tanpa capability dengan kredensial sah untuk negative-role test (tanpa meminta password di chat); pemisahan/keputusan shared native report; inventaris consumer hosted dan urutan aktivasi build; rehearsal rollback pada lingkungan terisolasi. Setelah itu fresh preflight drift, jalankan cutover atomik yang disetujui, lalu buktikan REST/RPC/upload native tertutup, cookie berizin tetap berhasil, cookie tanpa izin ditolak, revocation bekerja, dan bucket lain tidak berubah.

## Validasi dan postflight

- Regresi terarah57 tes /5 file PASS pada konteks pemilik dengan `PTV_TEST_PRIVATE_READER_RUNTIME=true`.54 tes memakai fixture;3 memeriksa engine/modul/guard pembaca tanpa credential nyata. Tes native reader default opt-in karena sandbox menolak eksekusi script; tidak mengubah execution policy untuk membuatnya lulus. Kegagalan awal tes modul akibat variasi kapitalisasi environment diselesaikan dengan normalisasi yang sama seperti runner.
- Typecheck, lint dan build Staging PASS; warning chunk besar existing. Syntax runner dan parser Windows PowerShell PASS. Tidak mengulang suite Hub penuh atau baseline visual.
- Postflight cloud:164 master,251 unit,114 valuasi,2 loan,0 orphan loan-unit,0 fixture165. Semua objek fixture dibersihkan oleh runner; audit operasional/login nyata dipertahankan.
- Perbandingan terhadap snapshot membuktikan **table ACL, RPC ACL, dan policy Storage inventory tidak berubah**. Tidak ada ALTER/GRANT/REVOKE atau migration cloud dieksekusi. Tidak membutuhkan rollback aktif.

Status final **PARTIAL / NO-GO cutover**, dengan bukti positif yang lebih lengkap daripada165. Hygiene CLN-177. Sesi berikutnya cukup menutup blocker di atas; jangan mengulang login/CRUD yang sudah terbukti tanpa perubahan relevan.
