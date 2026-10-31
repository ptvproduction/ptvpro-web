# Phase 1 — proposal provisioning dan batas sesi native

> Keputusan terbaru operator: migrasi massal akun Legacy yang valid, bukan dua akun manual. Lihat [inventaris aktual dan proposal batch](PTVPRO-PHASE1-LEGACY-MIGRATION-READINESS.md). Dokumen/proposal dua target ini dipertahankan sebagai base teruji dan riwayat, bukan payload ACC eksekusi yang sedang diminta.

26 Oktober 2026. **Proposal lokal teruji; BLOCKED untuk ACC eksekusi** sampai manifest privat lengkap direview. Staging hanya SELECT/READ ONLY/ROLLBACK pada sesi ini. Tidak provisioning, enrollment, perubahan sesi/gate, Production, backup baru, UI, commit/push/deploy.

## Sesi testing: containment PARTIAL

Cloud read-only: fingerprint cocok; dua akun inactive, dua native user banned, empat native sessions tetap, Root0 dan policy OFF. Row sesi bukan bukti token masih valid maupun sudah dicabut. Tidak tersedia access token pengguna; tidak dicari, diminta, dipalsukan atau diterbitkan untuk keperluan sign-out.

| Jalur | Bukti dan batas |
| --- | --- |
| Server portal Akses/Kru/session | resolveLiveAccess membaca status/cutoff/version dan registry ketika diperlukan; akun inactive ditolak. |
| Acara, Broadcast, Catatan, Dokumen, Kontak, Planner, Peminjaman, Laporan Kerusakan, Lost Found | refreshLiveSession/verifyAccountStatusLive membaca status/cutoff; pemeriksaan source pada handler relevan, bukan replay JWT nyata di cloud. |
| Finance server | financeAccess membaca status_akun dan tokens_valid_after. RLS berbasis has_capability memakai status + native session/not_after. Finance151 belum dipasang dan tidak diubah. |
| Direct Data API/Storage | Policy true pada SELECT inventaris/unit dan katalog, SELECT storage inventory berdasarkan bucket, INSERT push berdasarkan auth.uid, identity_contact berdasarkan claimidentity; tidak seluruhnya memeriksa status/cutoff. Public reads mungkin memang disengaja; ini tetap mencegah klaim seluruh akses dummy telah hilang. |
| Finance read fallback | current_authenticated_ptv_id memeriksa active; is_finance_restricted_personnel juga memeriksa active, tetapi NOT restricted pada semester/settings bukan syarat bahwa akun active. Tahan maintenance; perubahan policy perlu proposal dan ACC terpisah. |

**Penanganan resmi:** ban lewat Auth Admin telah diterapkan pada sesi sebelumnya untuk membatasi login, tetapi bukan global sign-out. SDK admin.signOut memerlukan user JWT; tidak ada jalur by-user-ID yang dibuktikan pada SDK/route resmi yang diperiksa. Jangan memakai deleteUser, reset password, generateLink atau raw DELETE Auth sebagai pengganti. Pembatasan lifetime/inactivity native merupakan konfigurasi platform yang memerlukan ACC baru dan bukan pencabutan access JWT langsung. Tetap ban+inactive+cutoff dan maintenance; untuk melepas maintenance butuh bukti refresh ditolak, umur maksimum token aktual dan lewatnya batas itu, atau jalur revocation resmi yang diverifikasi tanpa mengambil token pengguna. Tidak menebak TTL1jam/menurunkan TTL untuk menganggap token lama kedaluwarsa. Maintenance localhost tidak menutup endpoint Supabase publik.

Sumber resmi: [sessions](https://supabase.com/docs/guides/auth/sessions), [user management](https://supabase.com/docs/guides/auth/managing-user-data), [sign-out](https://supabase.com/docs/guides/auth/signout). Tidak mengubah konfigurasi cloud atau menguji password/token nyata.

## Paket provisioning sempit

[Proposal SQL](PTVPRO-PHASE1-PROVISIONING-PROPOSAL.sql) adalah satu transaksi administratif langsung, bukan function/RPC baru. Dua placeholder sengaja membuat file belum dapat dieksekusi: physical system identifier dan JSON manifest privat. Jangan mengeksekusi file mentah, menginterpolasi string SQL tanpa escaping, atau menaruh hasil render privat dalam Git. Review hash template dan hash hasil render sebelum ACC.

- Manifest wajib: project_ref Staging; approval_scope PROVISION_TWO_INACTIVE_CREW_ACCOUNTS; approval_reference; operation_id UUID; expires_at maksimal24jam; tepat dua targets PTV-001/PTV-002.
- Setiap target: archive_uuid existing, source_uuid dari production_id historis, archive_sha256 dari SHA256(to_jsonb(archive)::text) aktual, account_uuid baru, membership_uuid baru, username baru lowercase3–48 karakter (a-z lalu a-z0-9._-, tidak diawali ptv-/ptv_); category eksplisit; division_id/cohort terkonfirmasi untuk Kru; membership_status; membership_period_start; initial_profile crew. Nama dibaca dari arsip, tidak dipakai menentukan kepemilikan. SQL menolak jabatan kosong agar tidak diam-diam mengisi NOT NULL dengan nilai rekaan.
- canonical.id memakai UUID personel historis yang sama; provenance source_project/source_table/source_uuid tersimpan. Ini representasi canonical atas personel existing, bukan UUID historis/personel baru. Akun testing tidak direuse. UUID/username/provenance/tabrakan tanpa receipt yang cocok ditolak, bukan di-merge/upsert.
- Dua canonical+membership+account+crew-profile dan satu audit pair dibuat atomik. Account inactive, auth_user_id NULL, tanpa credential/overrides/Root. Profil crew adalah batas proposal ini, bukan izin otomatis eksekusi; recovery manage/Root memerlukan review kenaikan hak terpisah.
- Advisory149/1 dan table locks mengecualikan concurrency; receipt operation+hash manifest+state mendukung replay exact dan menolak drift. Kegagalan target kedua/audit me-rollback seluruh transaksi. Tidak ada grant/RLS/catalog/platform change.
- legacy_archive_kru dan histori tidak ditulis. Linking arsip tetap langkah terpisah: proposal lama mensyaratkan bootstrap/recovery dan menolak self/Root; jangan mengakali siklus ini. Bila initial archive linking diperlukan, review proposal administratif khusus **sebelum** aktivasi, dengan ACC eksplisit; bukan menjalankan bootstrap demi linking.

## Enrollment password privat

Setelah provisioning yang diotorisasi, masing-masing pemilik memilih username yang disetujui dan password baru sendiri. Jangan menyalin hash Legacy atau memakai akun testing. Skrip offline scripts/prepare-phase1-password.ps1 menerima UUID akun hasil provisioning dan menggunakan Read-Host -AsSecureString dua kali, guard console eksternal existing, DPAPI current-user dan ACL privat di luar repository. Tidak dijalankan sesi ini; bukti hanya PowerShell AST. Skrip tidak menghubungi database dan tidak menerbitkan login; penyimpanan DPAPI bukan bukti kepemilikan/recovery. Minimum12 karakter adalah batas alat persiapan baru; verifier backend existing tidak diubah. Byte UTF8 maksimal72 sesuai bcrypt; plaintext hanya transient RAM untuk byte count, managed-memory zeroization tidak dijamin.

Jalankan hanya manual kelak dari Windows Terminal privat milik pemilik, sesudah ACC enrollment dan UUID akun final tersedia. Contoh bentuk perintah, bukan instruksi menjalankan sekarang:

    powershell.exe -NoProfile -File scripts/prepare-phase1-password.ps1 -AccountId <UUID-AKUN-BARU-TERVERIFIKASI>

Consumer enrollment administratif **belum dibuat/dijalankan**: baca DPAPI hanya dalam proses privat, bcryptjs cost10 di RAM, validasi manifest account/identity/version, lalu panggil ptv_auth_private.enroll_password melalui koneksi PostgreSQL terverifikasi dengan parameter binding. Jangan memasukkan password/hash ke command line, fileSQL, transcript, error dump atau laporan; jangan melakukan string interpolation hash ke log psql. Consumer perlu review dan uji parameter-binding sebelum ACC enrollment nyata. Fungsi existing terbukti menerima akun inactive tanpa mengaktifkan login. Seluruh gate tetap OFF; aktivasi status akun untuk uji login adalah ACC-3, bootstrap ACC-4.

## Uji dan kompatibilitas

[Evidence SQL](PTVPRO-PHASE1-PROVISIONING-LOCAL-RESULTS.json):36 checks PostgreSQL17 nyata pada database sementara sintetis localhost55439, dua koneksi, baseline fixture149+152+Lifecycle terpasang. Bukan mock, bukan cloud atau replay backup155. Clone/database sintetis dibersihkan dan server dihentikan; menolak server existing/argumen koneksi. Pengujian mengulang hanya jalur baru, bukan rehearsalACC1. Katalog Staging dicek untuk kolom NOT NULL/default/FK yang relevan; fixture ditambah period_start dan position_title NOT NULL agar error nyata tidak tertutup oleh fixture longgar. Ini belum bukti proposal diterapkan pada managed owner Staging.

Regresi sesi:79 tests/4files PASS. Typecheck PASS pada awal batch; lint global dan lint runner no-ignore PASS. Build FAIL pada ekspor ExplorerCategory/ProductionItem/StatItem di InsightsSection.tsx dan ServiceItem di ServicesSection.tsx (Living Portal di luar scope, tidak disentuh). Jangan klaim seluruh quality gates PASS. Tidak fullsuite ulang. Uji SQL mencakup penolakan anon/authenticated/service role/JWTclaim, Root/eksekutif profile, target salah, expired manifest, ambiguity, stale source, conflict provenance, duplikasi, fault audit dan target kedua, replay/drift, serta enrollment sintetis inactive.

## ACC berikutnya dan postflight

1. Operator melengkapi manifest privat dua target: source/archive UUID final, digest sumber baru, username, kategori/divisi/angkatan, status dan tanggal membership; menyetujui profil awal crew + inactive, tanpa native Auth/credential/Root. Daftar kandidat nama/operator sudah dikonfirmasi; tidak meminta mengonfirmasi akun testing lagi.
2. Review hash proposal/render, principal postgres kanal independen, fingerprint, maintenance, baseline setelahdisable. Backup155 adalah snapshot lama; jangan menganggapnya snapshot terkini. Tentukan retensi baseline/delta privat terenkripsi dan recovery atas perubahan sesudah155 sebelum ACC eksekusi. Tidak mengambil backup baru tanpa izin.
3. ACC provisioning hanya transaksi di atas; tidak implicit enrollment, linking, password activation atau bootstrap. Jika manifest/source drift, STOP. Kegagalan sebelumcommit rollback menyeluruh; jangan memperbaiki lalu retry otomatis atas data nyata yang ambigu.
4. Jalankan [postflight read-only](PTVPRO-PHASE1-PROVISIONING-POSTFLIGHT.sql): +2canonical/+2membership/+2account/+2crewprofile/+1receipt; provenance/UUID tepat; inactive/nativeNULL/no credential/no override; Root0/gateOFF; arsip dan histori/tombstone testing/actor/grants/RLS tidak berubah. Replay sama tidak menambah apa pun. Cek ownership/recovery bukan disimpulkan dari keberhasilan provision.
5. Kegagalan setelahcommit: tahan akun inactive/writer, simpan receipt/audit, lakukan forward repair dengan ACC terpisah. Tidak DELETE identitas baru atau restore snapshot lama/grants rentan otomatis. Enrollment/corrective linking/ACC3/4 tetap terpisah; masalah native session residual harus ditutup sebelum maintenance release.

**Satu tindakan operator:** review dan lengkapi manifest privat provisioning dua target (username dan field membership terkonfirmasi) untuk ACC transaksi inactive-only. Proposal teruji tersedia; paket eksekusi belum READY tanpa manifest dan checkpoint recovery, dan consumer enrollment belum siap produksi.
