# PTV-DEV-154 — Rehearsal snapshot Staging pada target lokal

**PROSEDUR UNTUK REVIEW/ACC, bukan skrip yang dijalankan pada cloud.** Sesi154 tidak mengambil snapshot. Tidak ada izin implisit menggunakan backup lama berisi data nyata. Restore ke database lokal baru saja, bukan Legacy/Staging/Production atau database kerja yang sudah ada. Jangan menimpa/menghapus backup existing.

## 1. Persetujuan dan cakupan sebelum mengambil data

Operator menetapkan nomor ACC persiapan, PIC, masa berlaku, project swadgljnyelsjstqqxbm, schema/tabel yang boleh diekspor, klasifikasi data, lokasi privat terenkripsi di luar Git, pemegang kunci, retensi dan target lokal baru. Otorisasi harus secara eksplisit mencakup penyalinan data personel/credential bila masuk scope; tidak cukup hanya izin read-only katalog153. Legacy jthzuhkblxcaohiuypqq tidak termasuk scope.

Manifest privat minimal: approval reference; ref/fingerprint cluster sumber; waktu snapshot; versi PostgreSQL/server/client/CLI dan extension; daftar schema/tabel/dependency termasuk objek yang sengaja tidak disalin; versi/hash SQL149/152/151/rollback; file ukuran/SHA256; pemetaan owner/role; hasil before/after dan pengecualian yang ditandatangani. Jangan menyimpan password, connection string, JWT atau password hash dalam manifest/log. Dump sendiri diperlakukan sebagai data rahasia, bukan artefak Git.

Inventaris minimum:

- 12 tabel Finance beserta seluruh data/relasi/histori, audit dan sequence; canonical_identity, user_account, membership, profil/grants/overrides, registry, auth_credentials, auth_audit_log,94 arsip dan relasi organisasinya.
- Schema aplikasi public/ptv_finance_private serta ptv_access_private **jika sudah ada pada snapshot**. Seluruh dependency tambahan seperti organization/division, Finance legacy references dan modul pemakai helper harus tercakup atau dipetakan secara eksplisit. Dump schema terpilih tidak otomatis membawa seluruh dependency lintas schema.
- Function signatures/body/owner/SECURITY DEFINER/search_path/EXECUTE, table/schema/sequence/default ACL, role membership/INHERIT/SET/BYPASSRLS, RLS/FORCE RLS, policies, triggers, constraints, indexes, sequence state, extension versions dan catatan migrasi/manual SQL.
- Managed dependencies auth.uid/auth.jwt, auth.sessions.id/user_id/not_after serta custom policies pada storage.objects. Storage file bytes/bucket manifest, runtime/Auth settings, ingress limiter dan secret custody adalah cakupan terpisah.

## 2. Batas Supabase managed PostgreSQL

`pg_dump` adalah logical backup database, bukan salinan cluster/platform; global roles tidak ikut. Jangan menjalankan hasil `pg_dumpall --globals-only` secara buta pada Supabase atau clone. Role/platform bawaan, SUPERUSER, tablespace, extension binaries, JWT keys, provider settings, Vercel env dan Storage bytes memerlukan penanganan terpisah. [PostgreSQL17 pg_dumpall](https://www.postgresql.org/docs/17/app-pg-dumpall.html).

Supabase CLI membungkus pg_dump dan secara default mengecualikan schema managed seperti auth/storage; default dump bukan backup data/custom roles. Karena itu keberhasilan satu perintah CLI belum membuktikan cakupan lengkap. Rekam versi dan periksa TOC/hasil secara eksplisit. [CLI db dump](https://supabase.com/docs/reference/cli/supabase-db-dump).

Customizations pada auth/storage dan credential custom LOGIN perlu proses terpisah menurut [panduan Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Sesi154 tidak mereset password atau mengubah role nyata untuk memudahkan dump. Bila credential yang sudah diotorisasi tidak mempunyai izin membaca objek wajib, hasilnya BLOCKED; jangan menambah grant cloud diam-diam.

Dua jenis target dibedakan:

1. PostgreSQL17 lokal biasa: membuktikan logical data/schema/ACL dan SQL authorization dengan dependency managed yang sudah direview. Tidak membuktikan Auth/PostgREST/Storage berjalan seperti platform.
2. Stack Supabase lokal terisolasi dengan baseline Auth/Storage/extension yang cocok: untuk drill runtime setelah otorisasi tambahan. Jangan menyalin data managed ke baseline versi lain tanpa review. Auth users/sessions/credential asli tidak boleh dibawa hanya agar SQL test lolos; bila dikecualikan, uji sesi memakai fixture sintetis dan tandai runtime recovery aktual NOT VERIFIED.

## 3. Capture setelah ACC persiapan — belum dijalankan

Gunakan existing credential yang sah melalui profil libpq/passfile privat; tidak menaruh URI/password pada command history. Session pooler yang mendukung snapshot atau direct connection yang sudah diverifikasi dapat dipakai; jangan transaction-pooler untuk sesi snapshot berumur panjang. Tidak memodifikasi project/Vercel env.

1. PIC mengonfirmasi ref/physical fingerprint melalui management + query read-only. Tetapkan maintenance/freeze writer administratif dan Finance termasuk API/otomasi eksternal. Jangan menonaktifkan user atau menghapus sesi aktif untuk membuat snapshot. Bila writer tidak dapat dibekukan, gunakan exported snapshot untuk data dan beri batas eksplisit pada konsistensi Storage/roles/settings.
2. Buka koneksi A: `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`. Export snapshot dengan `SELECT pg_export_snapshot()` dan simpan identifier hanya pada workspace privat; pertahankan koneksi sampai dump dan baseline selesai. Token snapshot PostgreSQL bukan JWT, tetapi jangan mencetaknya pada laporan publik.
3. Jalankan pg_dump17 pada koneksi B dengan snapshot tersebut. Contoh PowerShell berikut **template operator**, bukan otorisasi/eksekusi otomatis:

```powershell
# Profil libpq privat bernama PTV_STAGING_APPROVED_SNAPSHOT sudah diverifikasi operator.
# Snapshot ID dan direktori berasal dari manifest ACC privat; tidak diisi oleh agen.
$env:PGSERVICE = 'PTV_STAGING_APPROVED_SNAPSHOT'
$approvedSchemas = @('public', 'ptv_finance_private') # baseline153; tambah hanya schema yang benar-benar ada dan disetujui
$dumpArgs = @('--no-password', '--format=custom', '--strict-names', '--snapshot', $approvedSnapshotId, '--file', $newArchivePath)
foreach ($schemaName in $approvedSchemas) { $dumpArgs += @('--schema', $schemaName) }
if (Test-Path -LiteralPath $newArchivePath) { throw 'Archive path already exists; choose a new approved path.' }
& 'C:/Program Files/PostgreSQL/17/bin/pg_dump.exe' @dumpArgs
if ($LASTEXITCODE -ne 0) { throw 'Capture failed; do not treat partial output as backup.' }
```

Tidak menggunakan `--no-acl` atau membuang owner metadata dari archive. Full public schema/data dapat memuat modul dan data pribadi lain; ACC scope harus mengizinkannya. Bila memakai subset, dependency graph serta semua objek terlewat wajib tercatat dan diverifikasi; jangan menganggap23 tabel validasi mencakup seluruh database.

4. Jalankan [restore checks](PTVPRO-DEV-154-RESTORE-CHECKS.sql) pada snapshot A atau koneksi read-only yang mengimpor snapshot **sebelum SELECT pertama**, keluarkan ke berkas privat. SQL mencakup digest seluruh23 tabel inti, struktur, policies/grants/default ACL, functions, triggers, roles/membership dan sequence. Tambahkan digest/metadata untuk setiap dependency tambahan dalam scope dump. Jangan mencatat hash data nyata ke Git; tool tidak mengekspor row values.
5. Katalog roles tanpa password, schema-level grants/owner, extension/collation versions, auth/storage customizations, managed migration versions dan kebijakan runtime dicatat terpisah. Pengambilan beberapa berkas tanpa exported snapshot/freeze bukan otomatis snapshot yang konsisten. Sequence bukan MVCC: freeze penulis dan nextval wajib untuk membandingkan nilainya secara tepat.
6. Storage bytes diekspor hanya bila disetujui, dengan checksum/path manifest privat; dump SQL hanya memuat metadata. Jika source berubah selama capture, labelkan ketidakkonsistenan dan ulangi dengan ACC yang sesuai. Jangan memakai hitungan0 object dari153 sebagai bukti keadaan terbaru.
7. Akhiri transaksi A tanpa mutasi, cek exit status/ukuran/SHA256 setiap artefak, enkripsi dan batasi akses. Log cukup status/counts yang diizinkan; jangan verbose echo credential/record. Jangan mengubah backup111/114/112/151 atau menganggap checksum membuktikan restore.

## 4. Restore pada target baru — setelah scope data lokal diotorisasi

- Verifikasi target literal127.0.0.1, port lokal khusus, physical cluster identifier berbeda dari sumber, database baru belum ada, marker clone dan label ACC. Libpq PGSERVICE/PGHOSTADDR/PGOPTIONS lama harus diisolasi pada proses restore agar tidak mengalihkan target. Jangan menerima URI cloud sebagai target. Tidak menggunakan --clean/reset/drop terhadap database existing.
- Matikan akses keluar jaringan, cron/worker/Auth email/webhook/integrasi aplikasi. Dump adalah kode SQL yang harus direview, bukan hanya data. Jangan menjalankan backup tidak tepercaya pada komputer berkredensial cloud aktif.
- Siapkan role mapping dengan admin **lokal** terpisah: owner postgres NOSUPERUSER/BYPASSRLS sesuai153, anon/authenticated NOSUPERUSER/NOBYPASSRLS, service_role NOSUPERUSER/BYPASSRLS dan membership/grant minimum sesuai sumber. Jangan menaikkan postgres menjadi SUPERUSER untuk membuat tes lulus. Role mapping dan pengecualian managed harus direview, bukan hasil restore globals otomatis.
- Siapkan baseline auth/storage/extension versi yang disepakati sebelum fungsi/policies aplikasi. Managed roles seperti supabase_admin tidak disalin kredensialnya; representasi lokal dan owner dependency dipetakan eksplisit. Jangan mengganti semua owner dengan satu superuser lalu mengklaim SECURITY DEFINER setara cloud.
- Periksa `pg_restore --list` ke berkas privat; validasi schema/data/ACL/trigger/default privileges yang tercakup. Install baseline/default ACL lokal yang cocok sebelum restore; defaults target yang terlalu luas dapat memberi privilege tambahan. ACL dari archive harus tetap dipulihkan dan diperiksa.
- Restore archive lengkap sekali dengan exit-on-error dan urutan pre-data→data→post-data. Contoh berikut hanya setelah database baru, roles dan dependency disiapkan; variabel dibuat operator, target tidak boleh cloud:

```powershell
# Dalam proses PowerShell lokal khusus restore; jangan mewarisi profil snapshot/cloud.
Remove-Item Env:PGSERVICE, Env:PGSERVICEFILE, Env:PGOPTIONS, Env:PGPASSWORD, Env:PGPASSFILE -ErrorAction SilentlyContinue
$env:PGHOSTADDR = '127.0.0.1'
$env:PGCONNECT_TIMEOUT = '5'
& 'C:/Program Files/PostgreSQL/17/bin/pg_restore.exe' --no-password --host=127.0.0.1 --port=55440 `
  --username=fixture_admin154 --role=postgres --no-owner --exit-on-error --single-transaction `
  --dbname=$approvedNewLocalDatabase $approvedArchivePath
if ($LASTEXITCODE -ne 0) { throw 'Restore failed; keep clone isolated and inspect privately.' }
```

`--no-owner` pada contoh hanya sah bila seluruh owner aplikasi memang postgres atau pemetaan owner lain direplay persis dari manifest yang direview. Jika tidak, ubah rencana sebelum restore; jangan mengabaikan perbedaan owner. Jangan memakai --no-acl/--disable-triggers/session_replication_role=replica secara luas untuk menutupi kegagalan. Memulihkan data ke fresh schema sebelum post-data triggers menghindari bypass guard pada database aktif.

Untuk rehearsal pemasangan proposal, koneksi admin lokal harus login sebagai postgres non-superuser yang telah disiapkan, bukan sekadar SET ROLE postgres dari fixture_admin154: guard memeriksa session_user/current role/claims. Jangan mengedit guard agar koneksi yang salah diterima. fixture_admin154 hanya administrator cluster lokal untuk persiapan dependency dan role mapping.

Reapply custom managed policies/objects dan owner/grant mapping yang direview; jangan replay DDL platform atau reset managed roles. Jika ada objek/privilege managed yang tidak dapat direpresentasikan, tandai BLOCKED untuk parity yang terpengaruh. SQL-only clone tetap tidak membuktikan platform login/recovery.

## 5. Kriteria PASS/FAIL dan checkpoint

| Gate | PASS wajib | FAIL/BLOCKED |
| --- | --- | --- |
| Otorisasi/source/target | Manifest ACC valid; source Staging terikat fingerprint; target lokal baru; egress tertutup | Scope/izin data atau identitas target tidak jelas |
| Capture | Exit0, seluruh scope/dependency tercakup; file SHA256/ukuran cocok; snapshot/freeze terdokumentasi | Partial dump, schema tidak terambil, snapshot berubah, file existing ditimpa |
| Data | Counts dan SHA256 rowset seluruh tabel inti+dependency cocok; histori/audit/marker sama; sequence tepat | Satu tabel/kolom hilang atau berbeda tanpa pengecualian yang direview |
| Struktur/security | Owner, definer/search_path, RLS/FORCE, grants/default ACL, role flags/membership, constraints/indexes/triggers dan function definitions sesuai | Grant tambahan/hilang, helper/guard hilang, owner superuser menggantikan owner managed |
| Finance | Snapshot ledger/allocation/pocket baseline cocok; orphan/duplicate/negative/invariant tidak memburuk; cicilan/status sesuai | Balance atau relasi berubah; backfill/reset otomatis diperlukan |
| Auth | Deadline/expiry/revocation/actor/permission dan spoof-service ditolak; Root guard/marker preserved | Stale session lolos, izin cookie/profile memulihkan grant tercabut |
| Rangkaian migrasi |149 preparation→152→151 revisi lulus; concurrency dua koneksi, audit failure dan transfer failure rollback menyeluruh | Satu tahapan/owner/lock/grant gagal; jangan melonggarkan pengaman |
| Recovery | Safe rollback151/152 dan forward recovery lulus pada clone; data/ACL aman; waktu pemulihan tercatat | Restore mengembalikan grant/helper rentan atau menimpa mutasi sah |

Perbandingan memakai manifest privat sebelum/sesudah. Urutan array ACL mentah bukan semantik izin; bandingkan grantee/grantor/privilege/grant-option secara canonical. Jangan menormalisasi hilangnya hak, owner, definition atau default ACL sebagai sekadar format. Schema/object OID lokal dapat berbeda; jangan membandingkan OID sebagai identitas bisnis.

Comparator offline yang tersedia, tanpa koneksi database:

```powershell
node scripts/compare-restore-154.mjs $privateBeforeJson $privateAfterJson
if ($LASTEXITCODE -ne 0) { throw 'Manifest mismatch or incomplete input; review required.' }
```

Input berupa objek JSON private_restore_manifest dari SQL, tanpa header psql; gunakan -X -qAt dan output ke file privat. Comparator menolak input tidak lengkap. Ia hanya menormalisasi rewrite PostgreSQL17 yang sudah direview: cast ARRAY literal varchar ke text[] menjadi cast text pada setiap literal, dengan semua nilai dan ekspresi sekeliling tetap sama. Semua perbedaan ACL mentah tetap dilaporkan untuk review, bukan dihapus otomatis. Unit tests menolak enum yang berubah, constraint tidak tervalidasi, owner/grant/function/data berubah dan promosi superuser. Reformat constraint ini ditemukan oleh drill sintetis154, tidak diasumsikan berlaku pada seluruh perbedaan SQL.

Simpan hanya ringkasan PASS/FAIL dan referensi bukti privat dalam laporan repo. Record scope yang dikecualikan secara eksplisit (misalnya real Auth sessions tidak diotorisasi); hasil tidak boleh disebut full restore/platform READY. Bila gagal, pertahankan clone terisolasi untuk investigasi; jangan menimpa backup atau memperbaiki source Staging.

## 6. Setelah rehearsal, tetap perlu ACC eksekusi

Rehearsal lokal bukan ACC cloud. Operator harus menyetujui artefak/hash final, waktu maintenance/freeze, baseline baru, kanal recovery admin, rollout API/schema dan rollback. Root ownership, recovery independen, kategori/bulan masuk, linking serta58 histori unclassified dari153 adalah keputusan terpisah; jangan menetapkan nilai hanya untuk meluluskan tes. Bootstrap yang memajukan cutoff sesi tetap dilarang tanpa ACC khusus.
