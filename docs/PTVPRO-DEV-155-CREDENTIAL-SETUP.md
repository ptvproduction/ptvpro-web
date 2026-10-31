# DEV-155 — Input password manual Windows

Operator melaporkan C04-MISSING-PARENT: CIM tidak menemukan salah satu ancestor, bukan kegagalan password. Penelusuran kini berhenti pada launcher desktop terverifikasi: explorer.exe pada lokasi Windows resmi, atau WindowsTerminal.exe pada paket Microsoft.WindowsTerminal di Program Files/WindowsApps, keduanya wajib Authenticode Valid dan signer Microsoft Corporation. Ancestor agen yang ditemukan sebelum launcher tetap ditolak; parent hilang sebelum anchor tetap ditolak, tanpa anchor C04-NO-TRUSTED-LAUNCHER. Ini menghindari kewajiban menelusuri parent historis setelah launcher sah; bukan mengizinkan semua rantai putus. Identifikasi launcher bukan jaminan terhadap proses berbahaya dengan akun yang sama. Parser tiga file dan pemeriksaan statis keberadaan guard PASS; runtime manual belum diuji.

Jika setup berhenti, versi terbaru menampilkan `DEV155 code` berisi tahap tetap, tanpa exception/password/path privat. Laporkan hanya kode itu. C01 console, C02 language mode, C03 marker agen, C04 ancestry proses (MISSING-PARENT/AGENT-PARENT lebih spesifik), C05 transcription policy, C06 konfirmasi; S02 lokasi/file existing, S03 ACL direktori, S04 prompt, S05 enkripsi/simpan, S06 ACL file, S07 decrypt check; R02/R03 pemeriksaan reader. Error umum pertama dari operator belum membuktikan akar masalah; guard tidak dilonggarkan. Ketiga skrip diparse ulang secara statis PASS, tanpa eksekusi/input/dekripsi.

Scope tahap ini hanya menyiapkan mekanisme lokal dan pemeriksaan statis. Tidak ada password diterima, direktori privat dibuat, DPAPI dijalankan, jaringan/database diakses atau snapshot diambil oleh Codex.

## Jalankan manual

Buka **Windows PowerShell dari menu Start**, memakai akun Windows biasa Anda, bukan Run as administrator, terminal Codex/VS Code, remote shell, atau terminal yang sedang direkam. Hentikan screen/session recording. Jangan menaruh password di clipboard/argumen/perintah/chat.

Jalankan:

```powershell
powershell.exe -NoProfile -File "C:\Users\zidna\ptvpro\scripts\setup-dev155-credential.ps1"
```

Ketik `MANUAL DEV155` pada konfirmasi. Masukkan password hanya saat prompt `Password PostgreSQL STAGING (hidden)` muncul. Password tidak menjadi bagian command history. Bila kebijakan eksekusi memblokir skrip, berhenti dan laporkan status umum saja; jangan memakai ExecutionPolicy Bypass atau mengubah kebijakan keamanan.

Kemudian periksa secara manual:

```powershell
powershell.exe -NoProfile -File "C:\Users\zidna\ptvpro\scripts\check-dev155-credential.ps1"
```

Ketik konfirmasi yang sama. Skrip kedua tidak meminta password, tidak mencetak password/connection string dan tidak membuka koneksi. Cukup laporkan **setup berhasil / check PASS / gagal**. Jangan mengirim credential file atau dump error.

## Penyimpanan dan batas keamanan

- Lokasi tetap: `%LOCALAPPDATA%\PTVPRO-DEV155-Private\staging-password.dpapi`, di luar repository; tidak memakai path bebas dari payload. Root reparse point ditolak.
- DPAPI melalui ConvertFrom-SecureString tanpa key eksplisit, terikat pada pengguna Windows saat ini dan komputer/profil DPAPI. Ini bukan plaintext, bukan file passfile, bukan enkripsi seluruh backup. Folder backup terenkripsi untuk drill masih tahap terpisah.
- Folder/file mempunyai owner SID pengguna saat ini, inheritance dimatikan dan tepat satu ACE FullControl bagi SID tersebut; hasil diperiksa ulang. File existing tidak ditimpa. Salah password database belum bisa diketahui dari dekripsi DPAPI.
- Reader bersama `Read-Dev155SecurePassword` mengulang guard manual sebelum membaca/dekripsi, memeriksa ACL dan ukuran, lalu mengembalikan SecureString untuk pemanggil manual yang sah. Entry point check menampungnya dan Dispose; tidak menghasilkan plaintext. Belum ada adapter pg_dump/libpq, environment password atau file sementara. Konsumsi untuk snapshot harus direview terpisah agar tidak merusak jaminan ini.
- Guard menolak host selain ConsoleHost, redirected stdin/stdout, non-Windows/noninteractive, language mode terbatas, marker agen/editor yang dikenal, ancestry codex/node/electron/code/cursor/antigravity, serta kebijakan transcription wajib Windows PowerShell/PowerShellCore. Ancestry yang tidak dapat diverifikasi gagal tertutup. Transcript sukarela dihentikan sebelum prompt; debugging PowerShell dimatikan. Error hanya pesan tetap tanpa detail exception.
- Guard ini mencegah pemakaian tidak sengaja dari tool, bukan batas keamanan terhadap proses berbahaya yang dapat memodifikasi script/akun Windows. Tidak dapat membuktikan ketiadaan EDR/keylogger/recorder atau mencegah admin mengambil alih file. Jangan menjalankan pada sesi yang tidak Anda percayai.
- Tidak mengubah akun, password cloud, environment permanen atau kebijakan OS. Tidak memberi SYSTEM/Administrators ACE tambahan. ACL parent/DPAPI dan hak admin OS tetap tunduk pada keamanan workstation.

## Bukti tahap persiapan

## Pemulihan C06-MANUAL-CONFIRM

Tahap C06 lama membandingkan hasil Console.ReadLine() langsung dengan MANUAL DEV155;status BLOCKED saja tidak membedakan EOF,input kosong/salah atau exception input host. Perilaku keluar seketika pada console operator belum direproduksi;uji pembaca lama di PTY tetap menunggu. Tidak mengklaim penyebab EOF sebagai fakta.

Perbaikan minimal:Read-Dev155ManualConfirmation memakai Read-Host agar input ditangani PowerShell host UI,bukan reader stdin .NET langsung. Konfirmasi tetap case-sensitive dan harus persis MANUAL DEV155;tidak trim,tidak default yes,tidak retry otomatis atau bypass. Penolakan sekarang membedakan input kosong dan frasa salah tanpa mencetak input. C01–C05,signature launcher,agent ancestry,transcription,konfirmasi wajib dan DPAPI tidak dilonggarkan.

Uji nyata console PTY Windows PowerShell5.1.26100.9711:masing-masing proses tetap menunggu setelah prompt,sebelum input diberikan melalui terminal. MANUAL DEV155 diterima(exit0);SALAH ditolak(exit1);Enter kosong ditolak(exit1). Harness memanggil fungsi konfirmasi asli tanpa mock Read-Host,tanpa membaca credential atau menghubungkan database. Enam regresi ancestry sintetis dan parser helper juga PASS. Ini bukan pengujian seluruh runner/capture/restore;operator tetap harus menjalankannya di console desktop yang sah.

Satu perintah final dari dialog Win+R:

```powershell
powershell.exe -NoProfile -NoExit -File "C:\Users\zidna\ptvpro\scripts\run-dev155-restore-drill.ps1"
```

Setelah prompt MANUAL DEV155: muncul,ketik MANUAL DEV155 lalu Enter. Kirim drill code/outcome dan status snapshot/envelope saja. Jika C06 masih muncul,kirim kategori empty input/exact phrase required bila ditampilkan,tanpa credential/command line/file privat. Checkpoint baru hanya PASS setelah capture dan restore aktual terverifikasi. Maintenance Finance tetap aktif;tidak melakukan migrasi.

## Pemulihan C04-MISSING-PARENT

Kode ini berasal dari lookup proses Win32_Process saat memverifikasi ancestry terminal, bukan dari direktori/file/checkpoint backup. Lookup ancestor tidak mengembalikan proses; parent dapat sudah berakhir. Nama proses yang hilang tidak dapat ditentukan dari kode status lama saja. Working directory bukan penyebab guard ini;runner memakai PSScriptRoot untuk dependensinya. Kegagalan terjadi sebelum DPAPI credential dibaca atau koneksi database dibuat.

Guard tetap fail-closed:tidak mempercayai ancestry yang terputus,tidak melewati penolakan parent agen/editor,signature launcher,transcription atau konfirmasi manual. Helper kini menampilkan PID ancestor yang tidak tersedia dan petunjuk membuka console baru. Verifikasi ancestry dipisahkan menjadi fungsi agar dapat diuji tanpa credential. Enam kasus sintetis PASS pada Windows PowerShell5 dan pwsh:current process unavailable,parent unavailable,agent parent,launcher terpercaya,launcher tidak terpercaya dan cycle. Parser runner/helper PASS;ini bukan bukti capture/restore berhasil.

Tutup console lama untuk pekerjaan ini,lalu tekan Win+R dan jalankan satu perintah berikut langsung dari dialog Run:

```powershell
powershell.exe -NoProfile -NoExit -File "C:\Users\zidna\ptvpro\scripts\run-dev155-restore-drill.ps1"
```

Konfirmasi MANUAL DEV155 bila diminta. Kirim drill code dan outcome saja;kalau C04 berulang,kirim PID ancestor yang ditampilkan,tanpa command line,credential atau file privat. Console baru harus memiliki rantai launcher desktop yang dapat diverifikasi;jangan menjalankan perintah ini sebagai child dari terminal lama/IDE/agen. Jangan memakai ExecutionPolicy Bypass atau menghapus guard untuk melanjutkan. Setelah capture berhasil,restore aktual tetap wajib sebelum checkpoint dinyatakan PASS. Maintenance Finance tidak diubah oleh perbaikan ini.

## Kelanjutan snapshot setelah konfirmasi operator

Perbaikan D03: runner kini memakai CA resmi dari dashboard Staging, scripts/certificates/supabase-prod-ca-2021.crt, dengan SHA256 dipin; PGSSLROOTCERT=system sebelumnya gagal TLS pada host. Probe tanpa password/query lulus TLS verify-full setelah perbaikan. Tidak perlu memasang CA ke Windows atau membuat ulang credential. Satu langkah operator tetap perintah runner di bawah. Password database belum diuji oleh Codex.

Operator melaporkan setup dan check DPAPI/ACL **PASS** melalui console manual, lalu memberi instruksi melanjutkan snapshot/restore. Status ini membuktikan penyimpanan lokal, belum kebenaran password database.

Runner manual tersedia:

```powershell
powershell.exe -NoProfile -File "C:\Users\zidna\ptvpro\scripts\run-dev155-restore-drill.ps1"
```

Konfirmasi `MANUAL DEV155`; tidak perlu memasukkan ulang password. Jalankan hanya dari console eksternal yang sama, tanpa recording. Kirim **pesan status/kode Dxx saja**, jangan file private. Runner **belum dijalankan oleh Codex**; AST/required-forbidden static checks saja PASS.

**Revisi setelah D02-ENCRYPTED-STORAGE:** operator melaporkan kegagalan tahap penyimpanan; tahap lama mencakup persiapan ACL dan EFS, sehingga kode itu sendiri bukan bukti edisi Windows tertentu. Runner kini memakai DPAPI CurrentUser berbentuk envelope streaming, tanpa ketergantungan EFS untuk backup. Folder unik di luar repo tetap wajib ACL SID-only; file existing tidak ditimpa/dihapus. Tidak membaca atau mengubah folder/backup percobaan sebelumnya.

Sebelum jaringan, probe sintetis harus berhasil dienkripsi dan diverifikasi. pg_dump custom-format dikirim melalui pipe memori langsung ke envelope .dpapi; tidak ada dump plaintext sementara atau final. Manifest before/roles/archive juga berakhiran .dpapi. Header mempunyai nonce acak; tiap blok memakai DPAPI Protect dengan entropy nonce+nomor blok+tipe. Footer DPAPI mengikat jumlah blok, byte dan SHA256 plaintext. Verifier menolak blok tertukar/berubah, truncation dan trailing bytes, serta memeriksa seluruh hasil backup tanpa mengeluarkan plaintext ke disk. Format ini wrapper ciphertext, bukan file yang dapat diberikan langsung ke pg_restore. DPAPI terikat pengguna/komputer; key custody/recovery tetap wajib sebelum backup dinyatakan dapat dipulihkan setelah kehilangan workstation.

Library scripts/dev155-dpapi-envelope.ps1 dan tests scripts/test-dev155-envelope-local.ps1 tersedia. **10 kasus sintetis PASS pada pwsh dan 10 kasus yang sama PASS pada Windows PowerShell5**, tanpa credential file/database/cloud. Percobaan Windows PowerShell dalam sandbox sempat diblokir AuthorizationManager; uji sintetis diulang di luar sandbox dengan izin dan lulus, tanpa bypass ExecutionPolicy. AST tiga file revisi PASS. Hasil ini membuktikan roundtrip/integritas enkripsi sintetis, bukan keberhasilan capture/restore nyata.

Untuk libpq, password harus tersedia sesaat dalam memori. Runner menurunkan SecureString ke buffer BSTR sementara, memasukkannya hanya ke environment child psql/pg_dump, segera menghapusnya dari ProcessStartInfo dan menghapus buffer unmanaged. Tidak ada password di argumen, env proses induk/permanen, file temp atau log. String managed/environment OS tidak mempunyai jaminan zeroization sempurna; proses dengan akses akun yang sama tetap bisa membaca memori. Ini batas native libpq, bukan janji password tidak pernah plaintext di RAM. Jangan gunakan terminal yang tidak dipercaya.

Sebelum capture: TLS verify-full/system CA, host/ref tetap Staging, SQL read_only dan fingerprint baseline diverifikasi. Satu exported read-only repeatable-read snapshot dipakai dump dan manifest inti; transaksi ditutup setelah dump. Source PGOPTIONS default_transaction_read_only=on, batas lock3s, koneksi10s dan timeout terbatas. Tidak membekukan writer atau memutasi cloud. Full logical dump menyimpan metadata dan data managed dalam file envelope DPAPI; tidak global passwords, Storage bytes atau platform secrets/config. Pemakaian data lokal hanya dalam ACC155.

**Restore tetap BLOCKED:** Staging mempunyai supabase_vault0.3.1 yang belum tersedia lokal,7 event triggers dan1 managed superuser. Baseline platform/role/event-trigger dan penyimpanan clone terenkripsi yang sesuai belum direview. Runner revisi hanya capture terverifikasi enkripsi; branch pembuatan cluster/restore yang belum dapat dijalankan aman telah dihapus, bukan dibiarkan sebagai fallback. Setelah snapshot berhasil, hasil **PARTIAL**, exit2; restore tetap belum dilakukan dan tidak mengklaim metadata comparator PASS. Kegagalan capture exit1. Tidak ada migrasi/bootstrap/role mapping otomatis, perubahan firewall, penghapusan backup atau clone plaintext.

Untuk restore berikutnya dibutuhkan consumer envelope yang memverifikasi seluruh ciphertext sebelum streaming plaintext ke pg_restore, baseline managed yang sesuai serta storage clone terenkripsi/egress isolation. Jangan mendekripsi dump ke temp plaintext untuk melewati batas ini. Comparator154 dapat dipakai pada manifest yang didekripsi hanya dalam memori melalui jalur aman yang belum disiapkan.23 tabel minimum bukan full-database coverage; sequence tidak MVCC/writer tidak dibekukan. Backup capture saja tidak menutup PF03/PF06 atau mengizinkan migrasi.

Catatan tahap persiapan awal (sebelum runner native): ketiga file credential diparse menggunakan System.Management.Automation.Language.Parser: PASS tanpa mengeksekusi/dot-source skrip. Pemeriksaan string terlarang untuk konversi plaintext, PGPASSWORD, proses/jaringan/database dan output password: PASS. Bukti ini **statis saja**, bukan bukti runtime DPAPI/ACL, kebenaran password atau login database. Tidak menjalankan tests aplikasi/build karena tidak mengubah aplikasi. Menunggu operator menjalankan manual dan mengonfirmasi; tidak lanjut snapshot otomatis.
