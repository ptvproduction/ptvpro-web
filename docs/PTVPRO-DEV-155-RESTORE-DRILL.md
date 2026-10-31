# PTV-DEV-155 — Restore drill Staging

25 Oktober 2026. Operator: zidnal. **Status terbaru: PASS untuk restore logical backup dan cakupan security manifest yang terekam. Migrasi/aktivasi/Production tetap NO-GO tanpa gate dan ACC terpisah.**

## Hasil final setelah restart — restore nyata PASS

Backup DPAPI existing yang sama digunakan; tidak ada capture ulang, password baru/credential read, koneksi cloud atau migrasi Finance/Access. Verifikasi manifest/SHA/envelope dilakukan di memori. WSL2 dapat berjalan setelah restart. Distro **PTVPRO-DEV155** dibuat terpisah dari development, memakai rootfs Alpine resmi yang hash-nya diverifikasi. Daemon Docker privat tanpa bridge, clone `network=none`, tanpa port/volume data publik, read-only root, log-driver none, PGDATA/socket/temporary files di tmpfs. Swap WSL khusus ini dinonaktifkan dan /proc/swaps diperiksa kosong. Tidak ada dump plaintext di disk.

Baseline PostgreSQL lokal17.6 memakai image resmi terpin `supabase/postgres@sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00`; snapshot berasal dari17.11. Vault0.3.1, pg_stat_statements1.11, pgcrypto1.3, uuid-ossp1.1 dan plpgsql1.0 tersedia/pulih. Image self-hosted tidak membundel supautils: library PG17 GNU **v4.0.0 resmi** ditambahkan read-only setelah digest aset rilis diverifikasi (`f89420eb7caaf91559961ae0ddff4f390e437fcd8d63c940c34ac3f55f05e566`). Konfigurasi privileged_role=postgres/superuser=supabase_admin merekonstruksi kemampuan managed event triggers tanpa menjadikan postgres SUPERUSER. Versi supautils cloud tidak diketahui; tidak mengklaim paritas platform/binary persis.

Percobaan awal gagal pada owner event trigger dan **ROLLBACK seluruh transaksi**; clone kosong diverifikasi sebelum penyesuaian baseline. Restore final memakai SQL native pg_restore untuk seluruh objek/data, dengan tujuh entri EVENT TRIGGER dirender menggunakan native --use-set-session-authorization agar owner non-superuser ditangani supautils. Kedua bagian dijalankan dalam **satu BEGIN/COMMIT**. Tidak mengedit dump, membuang event trigger, menonaktifkan RLS/trigger secara blanket, memodifikasi katalog atau menaikkan postgres menjadi SUPERUSER.

| Bukti nyata | Hasil |
| --- | --- |
| Restore logical archive lengkap ke clone | PASS — transaksi final selesai tanpa error |
| Semua COPY table-data dalam archive | **103 tabel,0 mismatch**; row count dan SHA256 rowset tekstual terurut dibandingkan di RAM terhadap native COPY TO STDOUT clone, bukan hanya23 tabel Finance/Akses |
| Comparator DEV154 untuk cakupan manifest | PASS —23 tabel inti,101 constraints,60 indexes serta data/schema/kolom/owner/functions/EXECUTE/grants/RLS/policies/triggers/roles/memberships/default ACL/sequences yang terekam |
| Default ACL | Raw comparator awal berbeda hanya default_acl.6 perbedaan urutan dievaluasi read-only memakai aclexplode; grantor/grantee/privilege/grant-option identik. Sesudah canonicalization yang **terbukti setara**, engine154 lulus. Tidak mengabaikan/grant ulang izin atau melonggarkan engine154 |
| Ledger |54 posted/4 reversed;0 negative pockets/duplicate idempotency keys/orphan allocations/duplicate allocations/posted allocation invariant failures |
| Index/RLS/owner |0 invalid/not-ready public indexes;12 tabel Finance RLS aktif;7 event triggers pulih;postgres NOSUPERUSER,anon/authenticated NOBYPASSRLS |
| Validasi kode terarah |10 regression tests comparator154 PASS; memory CLI syntax, lint terarah --no-ignore/max-warnings0 dan restore harness AST PASS. Node globals diimpor eksplisit; konfigurasi repo memang mengabaikan scripts, tidak diubah. Hasil14 envelope/consumer sintetis sebelumnya dipertahankan, tidak diulang. Tidak mengulang full suite/typecheck/build aplikasi karena tidak ada perubahan aplikasi/TypeScript/UI |
| Cleanup | Clone DEV155 dihentikan/dihapus setelah label/network diperiksa;0 container tersisa pada daemon privat; daemon/distro khusus dihentikan. Semua data clone tmpfs dibuang, backup tidak dihapus. Cache runtime/image publik dipertahankan untuk rehearsal berikutnya |

Artifact metadata hasil restore dan ringkasan verifikasi disimpan **DPAPI terenkripsi** di lokasi privat backup existing dengan nama baru; tidak menimpa archive/manifest asli. Bukti publik teragregasi ada di JSON evidence155. Helper memory CLI mengimpor engine154 existing, tidak menggandakan comparator. Harness lokal/script startup/check/cleanup berada di scratch existing; tidak menyentuh UI, source bisnis, SQL151/152/154 atau Git commit/push/deploy.

## Batas PASS dan ACC berikutnya

**PASS ini membuktikan logical backup yang direkam dapat dipulihkan pada clone terisolasi**, beserta data seluruh103 COPY table dan metadata security yang tercakup manifest. Tidak membuktikan seluruh global role attributes/memberships di luar capture, disaster recovery setelah kehilangan key DPAPI/mesin, exact managed platform binary/config parity, Storage bytes, provider/JWT/Vercel settings atau login/Auth/PostgREST/Storage E2E. Role flags dan memberships yang memang direkam dipulihkan/diverifikasi; tidak menebak yang tidak dicapture. Sequence baseline yang direkam cocok; tidak pernah membekukan writer sumber, sehingga ini bukan snapshot atomic seluruh platform. Runtime Auth/email/frontend tidak dijalankan.

- PF03 bukti restore **logical captured scope** kini PASS. Kewajiban custody/platform coverage tetap di-review pada gate migrasi; jangan menafsirkan PASS sebagai seluruh layanan Supabase terpulihkan.
- PF06 rehearsal149 preparation→Access152→Finance151 revisi154 **belum dijalankan** pada clone aktual; instruksi batch ini melarang migrasi. Memerlukan scope/ACC berikutnya, dengan rollback/forward, owner/role equivalence, concurrency dan validasi lintas modul. Backup yang sama dapat dipakai; jangan capture ulang tanpa kebutuhan/ACC baru.
- Review freshness/RPO/RTO, custody/key recovery dan batas managed di atas sebelum maintenance/ACC eksekusi. Rangkaian eksekusi tetap prep149 PREBOOTSTRAP (bukan bootstrap)→152→151; pin hash, freeze writer terotorisasi, preflight checkpoint, validasi lalu pembukaan writer hanya setelah gate lulus. Rollback memakai safe containment/recovery, bukan helper/RLS149 lama atau restore yang menimpa histori baru secara buta.
- Root/linking/password activation serta keputusan kategori/bulan masuk/histori tetap terpisah. Tidak ada persetujuan cloud/migrasi/aktivasi tersirat dari hasil restore.

Referensi metode: [WSL import resmi](https://learn.microsoft.com/windows/wsl/use-custom-distro), [image resmi Supabase](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml), [supautils resmi](https://github.com/supabase/supautils), [event triggers managed](https://supabase.com/blog/event-triggers-wo-superuser). Detail berikutnya merupakan riwayat progres sebelum PASS final ini.

## Pemeriksaan langsung backup existing — restore tertahan lingkungan

**Pemeriksaan runtime setelah operator menyiapkan Windows:** dilakukan hanya status lokal, tidak mengulang audit atau capture. Docker/Podman tetap tidak ditemukan. WSL --status di host (bukan sandbox) masih menyatakan WSL2 tidak dapat mulai; daftar distro kosong. CIM menunjukkan VirtualMachinePlatform InstallState=1 (enabled), komponen WSL opsional InstallState=2, HypervisorPresent=true; registry CBS RebootPending ada. Nilai firmware/VM-monitor/SLAT=false tidak disimpulkan sebagai bukti BIOS salah karena hypervisor sudah terdeteksi. **Satu blocker aktif: WSL2 belum usable pada boot saat ini. Satu langkah operator: simpan pekerjaan lalu Restart Windows untuk menerapkan perubahan pending**, kemudian periksa ulang runtime. Reboot pending terverifikasi, tetapi restart belum dijalankan dan tidak dijamin menutup semua kemungkinan konfigurasi. Tidak memaksa restart/fitur/instalasi, tidak membuka backup ulang, tidak membuat clone atau koneksi cloud. Status restore tetap BLOCKED/PARTIAL keseluruhan.

Instruksi terbaru mengizinkan pemakaian snapshot existing untuk restore otomatis; tidak mengambil snapshot baru atau membaca password. Ditemukan tepat1 kandidat lengkap pada root privat yang sudah digunakan runner. ACL root/run/file diperiksa, manifest DPAPI dibaca hanya di memori; ref Staging dan ukuran/SHA256 ciphertext cocok. Seluruh envelope dump diverifikasi dan custom archive header PGDMP valid. **Ini bukti langsung Codex atas artefak existing**, melengkapi laporan manual operator sebelumnya.

Consumer bounded memory ditambahkan pada helper envelope existing: verifikasi seluruh envelope terlebih dahulu, replay ke RAM dengan batas256MiB, tanpa dump plaintext di disk.14 uji sintetis PASS (10 sebelumnya +3 roundtrip consumer +1 batas memori). Tidak menjalankan ulang Finance/Access/full suite. Parser native pg_restore17 --list menerima archive lewat stdin, exit0:1172 TOC entries,4 required extensions,7 event triggers. Manifest sumber memuat23 tabel inti,101 constraints,60 indexes. Tidak mencetak TOC, definition, row/digest privat atau isi snapshot. Satu extension dibutuhkan arsip tetapi tidak tersedia pada PG17 Windows lokal: supabase_vault.

**Satu blocker konkret:** belum ada runtime Supabase/Linux lokal yang dapat berjalan. Docker/Podman tidak terpasang; pemeriksaan WSL di luar sandbox membuktikan service tersedia tetapi0 distro dan status WSL2 tidak dapat mulai karena virtualisasi belum aktif, meminta Virtual Machine Platform/virtualisasi firmware. Pemeriksaan sandbox awal AccessDenied tidak dipakai sebagai kesimpulan. Tidak memasang distro/image besar yang tidak dapat dijalankan, mengubah fitur Windows/firmware, atau melakukan reboot tanpa penanganan operator. PG17 Windows existing bukan pengganti setara karena tidak memiliki vault; tidak membuat dummy extension atau menghilangkan objek dari dump.

Karena blocker tersebut, tidak ada clone/database dibuat atau SQL restore dijalankan. Comparator154 belum dijalankan karena tidak ada manifest hasil restore; function/grant/RLS/policy/data parity dan integritas transaksi pascarestore tetap **NOT VERIFIED**, bukan PASS dari keberhasilan TOC. Tidak menghubungi Legacy/Staging/Production atau mengubah development DB, akun/sesi/cloud/config. Tidak membuat/menghapus backup atau menulis data nyata di repository/temp. Tidak ada resource cluster sementara untuk dibersihkan.

Langkah berikutnya hanya menyiapkan runtime lokal kompatibel yang dapat mulai (aktivasi virtualisasi/Virtual Machine Platform dan reboot bila diperlukan); setelah itu gunakan backup yang sama. Tetap **PARTIAL**, restore BLOCKED, NO-GO ACC eksekusi migrasi. Key custody dan semua gate pascarestore tetap harus diverifikasi, bukan dianggap hilang dari daftar kewajiban.

## Hasil manual terbaru — snapshot berhasil

Operator mengirim keluaran runner: `Snapshot captured on verified Staging; source transaction closed`, `Encrypted snapshot and envelope verification completed`, dan `DEV155 outcome: PARTIAL`. Berdasarkan alur runner, keluaran ini berarti identity/TLS/read-only/fingerprint guard lulus, dump native selesai tanpa error, envelope DPAPI diperiksa, dan transaksi exported snapshot ditutup. Tidak ada database lokal dibuat. Bukti ini **runtime yang dilaporkan operator**, bukan Codex membaca/mendekripsi backup atau memverifikasi ulang artefak privat. Ukuran/checksum/path spesifik tidak diminta atau dicetak di chat.

Kredensial tidak perlu dibuat ulang. Pertahankan direktori privat dan seluruh backup; jangan mengirim atau memindahkannya ke Git/folder publik. Full logical capture tidak memuat global role passwords, Storage bytes, konfigurasi Auth/platform/Vercel; sequence dan writer tidak dibekukan. Enkripsi DPAPI serta envelope integrity bukan bukti restore PostgreSQL atau recovery setelah kehilangan workstation.

**Gate tersisa:** baseline Supabase lokal dengan supabase_vault0.3.1 dan pemetaan managed role/event triggers, encrypted clone storage/egress isolation, consumer envelope yang diverifikasi sebelum restore tanpa plaintext temp, pemeriksaan seluruh scope/dependency/roles/memberships/grants/RLS/policies/sequences dan comparator154. Key custody/recovery tetap harus direview. PF03 hanya maju pada capture, belum tertutup; PF06 belum tertutup. Tidak ada ACC migrasi/bootstrap/linking/Root/password activation dari hasil ini. Catatan kegagalan capture di bagian bawah merupakan riwayat, digantikan hasil terbaru di sini.

ACC terbatas pada percakapan ini mengizinkan snapshot read-only Staging dan restore lokal terisolasi. Izin tersebut tidak mencakup migrasi, bootstrap, linking, aktivasi Root/password atau perubahan cloud. Legacy tidak diakses.

## Kelanjutan setelah DPAPI manual PASS

**D03 — perbaikan lokal TLS terverifikasi:** operator melaporkan D03-SOURCE-IDENTITY. Pemeriksaan terarah tanpa credential membuktikan DNS AAAA/rute IPv6/TCP5432 tersedia pada host (cek sandbox awal tidak merepresentasikan rute host). psql17.11 dengan PGSSLMODE=verify-full dan PGSSLROOTCERT=system gagal sertifikat. CA publik resmi diunduh dari Database Settings → Download certificate pada dashboard project Staging yang sudah login, lalu disimpan scripts/certificates/supabase-prod-ca-2021.crt. Nama prod-ca adalah nama CA Supabase, bukan akses project Production. File SHA256 dipin di runner. Setelah perubahan, probe psql tanpa password/passfile, tanpa query, mencapai TLS_VERIFY_FULL_OK_PASSWORD_REQUIRED. Ini membuktikan perbaikan TLS, bukan password benar atau backup berhasil. Tidak melemahkan TLS, tidak memasang CA global atau mengubah cloud. Seluruh child cloud memakai path CA yang sama, termasuk keeper snapshot. Operator cukup mengulang perintah runner yang sama; tidak perlu setup ulang kredensial.

**Revisi setelah kegagalan manual D02-ENCRYPTED-STORAGE:** snapshot belum diambil; stage lama gagal saat persiapan storage sebelum jaringan. EFS bukan prasyarat backup lagi: runner kini menulis DPAPI envelope streaming dari stdout pg_dump, tanpa file plaintext. Metadata/probe juga DPAPI; ACL privat tetap wajib. Library envelope dan10 tests sintetis lulus pada pwsh serta Windows PowerShell5 (kasus sama di dua runtime). AST/static checks PASS; tidak membaca credential atau mengakses cloud dalam tests. Folder/backup existing tidak disentuh.

Branch restore sebelumnya yang belum memiliki baseline managed/encrypted clone yang sesuai dihapus dari runner. Revisi runner **capture-only saat ini**, maksimal PARTIAL setelah native dump exit0, hash ciphertext, dan full-envelope integrity verification. Restore, comparator154 dan platform parity tetap BLOCKED. Tidak menutup PF03/PF06 berdasarkan tes enkripsi. Catatan EFS/branch restore di bawah adalah sejarah revisi sebelumnya, digantikan mekanisme pada petunjuk credential terbaru. Operator perlu menjalankan ulang satu perintah manual yang sama; tidak memasukkan password ulang.

Operator melaporkan setup dan check ACL/DPAPI PASS, kemudian memberi instruksi melanjutkan. **Blocker penyimpanan credential lokal tertutup berdasarkan laporan runtime operator**, bukan pengujian password database. Pembaca credential tetap manual-only; Codex tidak memanggil/dekripsi credential melalui tool.

Management/ref Staging dikonfirmasi ulang; DNS direct AAAA ditemukan. Query targeted dependency dilakukan dalam BEGIN TRANSACTION READ ONLY/SELECT/ROLLBACK: read_only=on, fingerprint sesuai153; extension pg_stat_statements1.11, pgcrypto1.3, plpgsql1.0, supabase_vault0.3.1, uuid-ossp1.1;0 foreign servers,7 event triggers,1 nonbuiltin superuser role. PostgreSQL17 lokal memiliki extension control selain supabase_vault; extension ini belum tersedia. Tidak membaca row/auth data atau Legacy.

**Restore aktual masih BLOCKED** pada baseline managed vault/roles/event triggers. Jangan menghapus extension/event trigger dari backup atau menaikkan postgres lokal menjadi superuser. Runner scripts/run-dev155-restore-drill.ps1 disiapkan dan diparse statis; **belum dieksekusi**. Manual-only berarti operator perlu menjalankan satu perintah di [petunjuk](PTVPRO-DEV-155-CREDENTIAL-SETUP.md); tidak perlu memasukkan password ulang. Snapshot hanya ditulis setelah EFS/ACL/source fingerprint/TLS/read-only lulus. Backup berhasil pun tidak menutup PF03 sampai restore tervalidasi.

Runner menyimpan file baru EFS di luar repo, memakai snapshot terkoordinasi dan manifest154; tidak plaintext temp/password argumen/permanent env. Native child hanya menerima password di environment sementara dalam RAM. Guard D06 akan menghentikan restore bila managed extension tidak tersedia. Branch restore belum diuji; role mapping, egress firewall, memberships/full dependency/sequence dan recovery custody tetap membatasi status. Tidak ada snapshot/clone/resource baru dibuat dari tool; tidak ada cleanup backup.

## Pemeriksaan lanjutan — operator menggunakan HP

### Batas input secret terminal

**Pembaruan tahap laptop:** mekanisme manual sudah disiapkan pada [petunjuk credential setup](PTVPRO-DEV-155-CREDENTIAL-SETUP.md), dengan tiga skrip PowerShell di scripts/. AST dan pemeriksaan statis PASS; belum dieksekusi, belum menerima password atau membuat penyimpanan privat. Catatan "belum disiapkan" di bawah merekam batas tahap sebelumnya. Scope terbaru hanya persiapan statis dan berhenti menunggu konfirmasi operator; snapshot/restore tidak dijalankan.

Operator kemudian menyatakan masih mungkin mengingat password dan mengizinkan input tersembunyi. Tool sesi ini tidak menyediakan field secret atau jalur input operator yang terdokumentasi menjamin password tidak masuk transcript/log. exec/write_stdin adalah argumen tool yang dapat tercatat; membuka panel terminal tidak membuktikan redaksi input. Karena operator secara eksplisit meminta berhenti jika input aman tidak tersedia, tidak membuka prompt password atau meminta pengiriman stdin/chat.

Alternatif: operator memasukkan password langsung melalui PowerShell Windows terpisah dari Codex menggunakan Read-Host -AsSecureString, lalu menyimpan dengan proteksi Windows DPAPI bagi akun Windows yang sama, di direktori privat ber-ACL terbatas di luar repository. Jangan mengubahnya menjadi plaintext untuk dicetak atau memasukkannya ke command line/.env/history. Persiapan penyimpanan dan script konsumsi harus direview sebelum meminta operator memasukkan nilai; belum dibuat/dijalankan di155. Dari HP saja, tunda sampai terminal komputer dapat diakses secara aman atau gunakan password manager yang sudah tersedia. Tidak menerima secret melalui chat. Snapshot dan restore tetap belum dijalankan; ACC persiapan tetap berlaku.

Sesi dashboard Chrome yang sudah terautentikasi berhasil digunakan secara read-only pada **project yang sama**. Ini menutup ketidakpastian akses dashboard, tetapi belum menyediakan kredensial PostgreSQL:

- Panel Connect → Direct menampilkan template dengan `[YOUR-PASSWORD]`, bukan password tersimpan. Tidak menekan Reset database password atau add-on IPv4. Login dashboard/MCP bukan bukti adanya sesi libpq.
- Database → Backups menampilkan **Free Plan does not include project backups**; overview juga menyebut No backups. Tidak ada snapshot dashboard yang dapat diunduh melalui halaman tersebut. Ini bukan klaim bahwa operator tidak mempunyai backup eksternal.
- Pemeriksaan tambahan tidak menemukan CLI pada PATH, binary project/node_modules, lokasi npm-global/Scoop yang diperiksa, project supabase/.temp, atau profil konfigurasi tambahan yang diperiksa. Folder user .supabase ada, tetapi file root yang ditemukan hanya cli-latest dan telemetry.json; folder tersebut bukan bukti CLI login atau kredensial database. Tidak membaca browser token/cookie, password vault, atau kredensial project lain.
- Jalur resmi direct/session pooler tetap memerlukan password database yang sah: [dokumentasi koneksi](https://supabase.com/docs/guides/database/connecting-to-postgres). [CLI backup](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) bukan mekanisme mengambil kembali password lama. Tidak menjalankan link/login role provisioning, reset password atau grant baru untuk mengatasi pembatasan read-only.
- Dashboard menampilkan advisor Security Definer View untuk public.ptv_kru_legacy_compat. Ini indikator yang perlu ditinjau pada gate keamanan, bukan bukti exploit/critical terkonfirmasi; tidak mengubah view atau memperluas audit sesi ini.

**Instruksi singkat dari HP:** periksa password manager untuk kredensial database project **ptvpro-staging / swadgljnyelsjstqqxbm**. Jika tersimpan dan disinkronkan secara aman ke komputer ini, cukup beri tahu nama entri/lokasi penyimpanannya; jangan kirim password atau connection string lewat chat. Jika tidak ada, tidak ada langkah HP yang dapat mengaktifkan dump dalam guardrail sekarang: tunda sampai kredensial lama dapat disediakan melalui profil privat komputer, atau bahas ACC perubahan kredensial secara terpisah. Jangan melakukan reset saat ini. Lokasi backup terenkripsi di luar repo tetap harus diverifikasi sebelum capture.

Kesimpulan lanjutan: **BLOCKED tetap valid**, kini dengan bukti dashboard langsung. Tidak ada pengambilan snapshot, restore, perubahan cloud, penggunaan Legacy atau pengulangan pengujian aplikasi.

## Hasil yang benar-benar diperiksa

| Pemeriksaan | Status | Bukti / batas |
| --- | --- | --- |
| Identitas management | VERIFIED cloud | get_project hanya untuk swadgljnyelsjstqqxbm: ptvpro-staging, ACTIVE_HEALTHY, host db.swadgljnyelsjstqqxbm.supabase.co, PostgreSQL17.11. |
| Identitas SQL | VERIFIED cloud | BEGIN TRANSACTION READ ONLY; satu SELECT katalog; ROLLBACK. read_only=on, database/role postgres, NOSUPERUSER dan BYPASSRLS. Fingerprint cluster cocok baseline153. Tidak memanggil RPC bisnis. |
| Jalur snapshot | BLOCKED | Tidak ditemukan variabel koneksi PG/database pada environment proses, profil libpq standar Windows/user, atau key koneksi database pada empat file .env yang diperiksa. Hanya nama key/presence diperiksa, nilainya tidak dicetak. Ini bukan pernyataan bahwa operator tidak memiliki kredensial di tempat lain. |
| Peralatan | VERIFIED lokal sebagian | pg_dump17 dan psql17 ada. supabase/docker/pg_dump/psql tidak ditemukan melalui Get-Command PATH; binary PostgreSQL tersedia lewat path absolut. |
| Kemampuan konektor | BLOCKED untuk ekspor | Tool Supabase yang tersedia menyediakan query SQL/metadata, tanpa mekanisme ekspor/download snapshot. Tidak menyalin row melalui hasil query MCP, memakai API key sebagai password database, mereset password, atau menambah grant. |
| Snapshot konsisten dan penyimpanan privat | BLOCKED | Tidak ada koneksi dump sah, sehingga tidak membuka exported snapshot atau membuat dump. Direktori privat terenkripsi, ACL, custody dan retensi belum diverifikasi. Tidak menulis data nyata di repository. |
| Restore dan integritas | BLOCKED | Tidak membuat cluster/database/role lokal baru. Data, constraints, indexes, RPC, grants, RLS, policies, sequences dan dependencies belum diuji dari snapshot aktual. |
| Comparator terhadap baseline | BLOCKED | Comparator154 dan SQL manifest tersedia, tetapi tidak dijalankan tanpa pasangan manifest snapshot/restore. Evidence153 adalah katalog/agregat historis, bukan snapshot data konsisten yang bisa menggantikan manifest sumber terbaru. |
| Cleanup | VERIFIED — tidak diperlukan | Tidak ada resource lokal sementara atau backup baru yang dibuat. Tidak menghapus backup/resource existing. |

Bukti mesin tersanitasi: [evidence155](PTVPRO-DEV-155-RESTORE-EVIDENCE.json). Hasil133+33 SQL sintetis154 tetap bukti historis lokal; tidak diulang atau diklaim sebagai restore aktual.

## Langkah aman untuk melanjutkan ACC persiapan yang sudah diberikan

1. Operator menyediakan **jalur koneksi PostgreSQL yang sudah sah** lewat service/passfile privat atau secret store yang aman, bukan mengirim password/token di chat. Target direct/session pooler harus mendukung exported snapshot dan diverifikasi ke project yang sama. Jangan memakai transaction pooler untuk koneksi snapshot berumur panjang. Tidak mereset password atau mengubah akun/grant.
2. Tetapkan lokasi privat terenkripsi di luar repository, pemegang kunci dan retensi. Bila lokasi berada di luar writable root, izin filesystem tetap diperlukan; ACC database tidak otomatis melewati sandbox OS. Belum ada tindakan tulis di luar root pada sesi ini.
3. Ikuti [runbook154](PTVPRO-DEV-154-RESTORE-REHEARSAL.md): source read-only repeatable-read/exported snapshot yang sama bagi dump dan manifest; dump17 custom mempertahankan owner/ACL; inventaris seluruh dependency, bukan hanya23 tabel inti. Pilih nama baru, jangan menimpa backup.
4. Tidak membekukan writer cloud dalam ACC155 ini. Sequence tidak MVCC; ukur drift sebelum/sesudah dan laporkan keterbatasan. Bila freeze diperlukan, minta ACC maintenance terpisah. Jangan mengunci writer untuk memaksakan hasil PASS.
5. Restore hanya ke cluster baru loopback dengan direktori data privat di luar repository, database unik, egress/integrasi dinonaktifkan, owner postgres NOSUPERUSER/BYPASSRLS dan role mapping eksplisit. Review baseline auth/storage/extensions; jangan mengganti owner dengan superuser atau memulihkan globals secara buta.
6. Jalankan manifest sebelum/sesudah dengan [SQL154](PTVPRO-DEV-154-RESTORE-CHECKS.sql), tambah coverage dependency lain; gunakan scripts/compare-restore-154.mjs pada berkas privat. Bandingkan counts/digests, constraints/indexes/functions/owners/grants/RLS/policies/triggers/default ACL/roles/memberships/sequences. PASS hanya jika seluruh cakupan wajib cocok, pengecualian managed direview, dan integritas transaksi lolos. Mismatch security/data atau objek wajib hilang berarti FAIL/BLOCKED.
7. Simpan backup dan manifest privat. Publikasikan hanya status/counts cakupan yang aman; setelah verifikasi, hentikan dan bersihkan hanya cluster sementara155 dengan target absolut terverifikasi. Jangan menghapus backup.

## Batas pemulihan managed Supabase

pg_dump tidak membawa global role credentials, extension binaries, konfigurasi Auth/provider/JWT, Vercel secrets, platform jobs atau Storage file bytes. Baseline managed auth/storage, custom policies/functions dan dependency extension harus diinventarisasi terpisah; jangan menganggap dump public lengkap. Jangan membawa hash/session pengguna nyata hanya untuk membuat fixture lulus. Pemeriksaan metadata Storage153 yang kosong bukan bukti keadaan terbaru. Restore PostgreSQL biasa juga bukan bukti login/Auth/PostgREST/Storage platform berhasil. Semua bagian ini belum diverifikasi pada155.

## Urutan berikutnya dan ACC

| Tahap | Keputusan / status |
| --- | --- |
| Snapshot + restore saat ini | ACC155 sudah ada; terhambat jalur koneksi aman dan kesiapan penyimpanan privat. Tidak perlu mengulang permintaan izin database yang sama. |
| Rehearsal migrasi pada clone aktual | ACC terpisah diperlukan sebelum menerapkan proposal pada clone berisi snapshot nyata; restore baseline saja tidak membuktikan migrasi. Uji actual-equivalent owner, failure/concurrency, lintas modul, audit dan safe rollback/forward. |
| Maintenance Staging | Tetapkan PIC, jendela, RPO/RTO, kanal SQL pemulihan independen dan freeze seluruh writer termasuk service-role/otomasi. Belum diizinkan/dijalankan. |
| ACC eksekusi | Setelah backup/restore dan rehearsal aktual PASS, pin hash proposal154, ulangi read-only preflight/dependency, checkpoint snapshot dan invariant. Urutan:149 PREBOOTSTRAP preparation → Access152 → Finance151 revisi154. Bukan bootstrap149. Tidak replay149 setelah152. |
| Validasi / rollback | Periksa helper not_after/expiry/revocation/aktor, exact EXECUTE, direct writers, RLS lintas modul, ledger/audit dan API compatibility sebelum membuka writer. Bila gagal: hentikan writer, rollback transaksi yang belum commit; untuk perubahan committed gunakan safe containment/recovery yang direview, bukan mengembalikan helper/RLS149 yang rentan. Restore data hanya dengan ACC insiden dan analisis selisih sejak snapshot; jangan menimpa histori baru secara buta. |
| Identitas / autentikasi | Ownership Root, recovery independen, linking, kategori/bulan masuk dan58 histori unclassified tetap keputusan tersendiri. Jangan membuka login password atau mengaktifkan Root dari hasil drill. |

**Readiness:** boleh melanjutkan persiapan backup dengan jalur aman; **belum cukup bukti untuk ACC eksekusi migrasi Finance151+Access152**. PF03 restore aktual dan PF06 rehearsal actual-equivalent masih terbuka; batas runtime/auth dan release coordination153/152 tetap berlaku. Tidak menyatakan production GO.

## Perubahan dan validasi sesi

Hanya laporan/evidence155 dan koordinasi roadmap/piketdev/cleanings. Tidak mengubah aplikasi, SQL proposal, UI atau konfigurasi. Tidak mengulang tests/typecheck/lint/build karena tidak ada perubahan kode. JSON evidence dan diff dokumentasi diperiksa; tidak mengklaim seluruh dirty working tree bersih. Hygiene CLN-165.
