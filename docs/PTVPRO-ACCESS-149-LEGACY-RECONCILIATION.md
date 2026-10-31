# PTV-DEV-149 — Rekonsiliasi akun dan personel Legacy

> Koreksi operator dan lanjutan 25 Oktober: Legacy **tidak memiliki Root**. Root adalah profil sistem baru dan boleh dipilih dari akun yang kepemilikannya terbukti, tanpa mengharuskan akun Legacy tertentu. Penetapan pertama terpisah dari rekonsiliasi: [bootstrap Root dan recovery](PTVPRO-ACCESS-149-ROOT-BOOTSTRAP.md). Catatan kebutuhan Root pada laporan historis ini tidak boleh dibaca sebagai pencarian Root Legacy.

24 Oktober 2026, operator zidnal. **NO-GO untuk migrasi/linking Staging.** Sesi ini hanya menjalankan SELECT pada database Legacy dan Staging, pembacaan source/backup lokal, serta perubahan lokal. Tidak menjalankan SQL proposal, DDL, linking, merge, perubahan permission, commit/push/deploy. Akses Legacy read-only diizinkan oleh instruksi terbaru operator; batas lama yang melarang akses Legacy tidak diterapkan pada tugas ini.

## Hasil yang dapat dipakai operator

| Objek yang dihitung | VERIFIED | AMBIGUOUS | UNMATCHED | DUPLICATE |
| --- | ---: | ---: | ---: | ---: |
| 94 arsip: bukti asal UUID Legacy → archive | 91 | 0 | 1 | 2 |
| 2 akun arsitektur baru: cocok dengan akun Legacy | 0 | 0 | 2 | 0 |

VERIFIED baris pertama hanya berarti asal personel terbukti dari UUID sumber dan ID PTV yang konsisten. Bukan bukti login/izin sudah dimigrasikan. Ada 92 UUID personel Legacy unik dan semuanya tercakup oleh 93 arsip; satu sumber diimpor dua kali. Arsip ke-94 adalah data uji berstatus test_quarantine, ditandai created_by_test; tidak dihapus atau dianggap personel Legacy.

Arsitektur baru mempunyai 2 canonical_identity, 2 membership, 2 user_account, 2 assignment profil, dan 0 override. Tidak ada archive yang sudah linked; tidak ada kecocokan ID PTV archive dengan canonical. Dua akun baru mempunyai profil eksekutif dan crew; **0 assignment root_executive**. Kedua akun mempunyai auth_user_id dan masing-masing provider native email; auth.users menunjukkan keduanya pernah sign-in. Namun auth_credentials baru tidak mempunyai password/Google yang terisi, tidak ada kecocokan sub Google/username/email-hint dengan Legacy, dan login pemulihan Vercel portal belum dibuktikan. Jangan menyebut dua akun ini sudah memigrasikan pemilik akun lama.

Legacy mempunyai 39 personel dengan password_hash terisi; 4 dari 39 juga mempunyai OAuth UID. Jadi terdapat **39 kandidat preservasi kredensial**, bukan 43 akun. Ini bukan bukti semua kredensial masih valid. Sebanyak 53 personel lain tidak mempunyai bukti kredensial pada sumber Supabase yang dibaca; tidak otomatis perlu akun. Role member berjumlah 35, kru 46, eksekutif 6, administrasi 5. Role bukan bukti kepemilikan/login aktif dan tidak otomatis dikonversi menjadi profil baru.

Manifest `PTVPRO-ACCESS-149-RECONCILIATION.json` diperbarui ke schemaVersion 2, berisi queue arsip, queue akun, kategori empat status, versi baris, scope bukti, hash snapshot, dan automaticLinkAllowed=false pada seluruh baris. Semua referensi adalah pseudonim MD5 UUID untuk membandingkan tanpa mencetak nama/email/credential. Hash adalah referensi pembanding, bukan token otorisasi atau anonimisasi kriptografis. Manifest lama dari backup offline digantikan hasil SELECT terbaru. Jangan menjumlah kategori arsip dan akun sebagai orang unik.

## Sumber tepercaya dan batas sumber

- Source PHP `legacy/page-dasbor.php` memverifikasi password_hash lama dan menyimpan UUID ptv_kru dalam sesi. `legacy/ptv-dashboard-data-bridge.php` memakai UUID itu untuk mengambil personel. Fallback username/ID PTV di PHP bukan pengganti bukti kepemilikan untuk migrasi.
- `public.ptv_kru.id` Legacy aktual adalah UUID, bukan INT. `wp_user_id` tersedia tetapi seluruh 92 baris bernilai NULL. `canonical_identity.legacy_id` aktual BIGINT, sehingga tidak boleh diisi UUID atau diasumsikan sama dengan WordPress user/post ID. Provenance UUID disimpan sebagai tuple source_project/source_table/legacy_uuid di metadata yang sudah ada, setelah review.
- Email/username hanya dipakai sebagai petunjuk; data cloud yang dibaca untuk perbandingan sudah di-hash di SELECT. Password hash, OAuth UID asli, token, email dan nama tidak diekspor ke log/manifest/dokumen.
- Status akun lama dapat berada pada WordPress option `ptv_kru_account_status_map` atau CPT meta `ptv_kru_status_akun`, terpisah dari status keanggotaan. Bukti ini terlihat dari PHP tetapi isi WordPress belum tersedia. Jangan mengubah status personel menjadi status login atau memakai default aktif dari kode lama.
- Export lama `PTV-PRO-PRODUCTION-SINGLE-EXPORT.sql` sengaja menghapus password/password_hash/user_pass dan beberapa kontak. Importer juga menyaring credential. Karena itu keberhasilan impor arsip tidak membuktikan preservasi akun. Jangan mengulang export umum untuk memulihkan credential.
- Pemetaan historis yang benar-benar dibaca: 40 baris Kas Kru Legacy mempunyai kru_id yang cocok dengan UUID ptv_kru. Sebanyak 41 peminjaman mempunyai kru_id NULL, bukan 41 UUID yatim; jangan mengisi dari kemiripan nama. Riwayat tugas pada tabel yang diperiksa 0 baris. Relasi JSON/modul lain tetap perlu inventaris terarah sebelum migrasi; tidak diklaim seluruh relasi telah diaudit.
- Pembacaan antarproyek dilakukan terpisah, bukan snapshot lintas database yang atomik. Versi/fingerprint wajib diperbarui dan dibandingkan lagi sebelum ACC eksekusi. Snapshot pembanding pseudonim di scratch **bukan backup yang dapat direstore**.

## Penyebab duplikat

SELECT Staging membuktikan dua archive menunjuk production_id/UUID Legacy yang sama, ID PTV dan payload sama setelah mengecualikan archive_id/source_key/imported_at. Kunci masing-masing `ptv_kru:<legacy_uuid>` dan `ptv_kru:<ptv_id>`. Waktu impor 17 Oktober 20:08:03.608058 UTC dan 20:08:28.923656 UTC. Backup lokal 18/19 Oktober juga sudah memuat pasangan ini.

Importer lama memilih `s[idKey] || s.production_id || s.id`, dengan idKey=ptv_id untuk kru. Input raw dan input yang sudah dipetakan dapat menghasilkan kunci berbeda untuk sumber UUID yang sama. Bukti ini mendukung kesimpulan **sumber yang sama diimpor berulang dengan dua skema kunci**, bukan dua orang dengan identitas yang perlu digabung. Log proses spesifik kedua eksekusi belum tersedia.

Perbaikan lokal: kunci kru hanya boleh UUID Legacy valid dan konsisten; ID PTV/nama/angka/random tidak menjadi fallback. Re-import live yang membawa arsip kru pada bulk importer lama ditahan sebelum write pertama, agar patch kunci tidak menciptakan duplikat pada arsip berformat lama. Script importer tidak dijalankan dalam sesi ini. Modul lain tidak diubah.

Operator masih harus memilih arsip representasi utama dan cara menyimpan alias/referensi keduanya. Jangan delete/merge/rekey otomatis. Proposal linking menolak kelompok duplikat sampai keputusan ini dituangkan dalam manifest terpisah.

## Mekanisme migrasi bertahap dan idempotensi

1. **Review personel:** 91 VERIFIED bisa masuk review target canonical tanpa menciptakan login. Dua DUPLICATE dan satu UNMATCHED tetap disimpan. Nama/email yang sama tidak pernah cukup.
2. **Preservasi akun lama, bukan registrasi ulang:** untuk 39 kandidat kredensial, butuhkan UUID sumber, bukti credential/provider, status akun WordPress, collision check username/sub/auth UUID, target account/identity yang disetujui, dan matriks izin sebelum/sesudah. Semua 53 lainnya dianggap personel tanpa kewajiban akun sampai bukti menunjukkan sebaliknya. Akun WordPress/CPT di luar 92 baris Supabase belum dapat dihitung sebagai lengkap.
3. **Target belum tersedia:** dua canonical sekarang tidak cocok dengan arsip, sehingga belum ada baris eligible untuk linking proposal. Migrasi canonical/membership/personel yang belum ada memerlukan manifest target tersendiri, dengan UUID asal dipertahankan sebagai provenance. Jangan memasukkan UUID ke legacy_id BIGINT, membuat identitas baru karena nama mirip, atau mengambil alih dua akun existing. Belum menyiapkan INSERT akun aktif generik karena status akun, profil akses dan recovery belum diputuskan.
4. **Jangan menebak privilege:** role administrasi lama tidak sama dengan profil eksekutif baru. Root harus dipilih operator berdasarkan pemilik UUID yang terbukti, bukan nama/role. Pertahankan seluruh akun, capability, assignment, allow/deny dan status existing; proposal linking tidak menulis tabel-tabel tersebut. Override WordPress yang belum diekspor tetap blocker, bukan diasumsikan kosong.
5. **Proposal linking existing target:** `PTVPRO-ACCESS-149-LINKING-PROPOSAL.sql` bergantung pada bundle hardening 149. Private authorizer + wrapper service_role, lock 149/1, row locks, immutable provenance UUID/project/table, perlindungan Root/self, manifest hash/review reference, pengecekan versi, penolakan duplikat/karantina, tepat satu membership current, serta 0 atau 1 akun. Personel tanpa akun diperbolehkan.
6. **Retry:** exact replay link dan manifest yang sama mengembalikan no_op tanpa write/audit ganda. Link lain ditolak; request versi lama ditolak sebelum mutation. Provenance mempunyai usulan unique index agar dua canonical tidak mewakili sumber yang sama. Seluruh update archive/status/metadata dan audit berada pada satu transaksi; kegagalan audit harus membatalkan perubahan.
7. **Batas pengaman:** review reference/hash bukan tanda tangan ACC. Server pemegang service_role tetap dipercaya; operator harus mereview manifest privat dan membatasi penulis di luar RPC. Tidak ada endpoint UI/API baru yang memanggil proposal ini. SQL belum diuji eksekusi/konkurensi dan bukan bagian otomatis bundle 149 sebelumnya.

## Keputusan operator yang masih diperlukan

1. Pemilik UUID Legacy untuk Root serta administrator pemulihan independen, dengan bukti login portal nyata. **Jangan memberi izin tambahan hanya agar recovery check lulus.**
2. Export terbatas WordPress untuk status akun dan overrides berbasis UUID/user/post relation yang terbukti. Tidak perlu meminta registrasi ulang massal.
3. Matriks per akun: profile/capability/allow/deny/status, termasuk penanganan role administrasi lama. Perubahan hak sekecil apa pun harus terlihat sebagai delta, bukan role mapping diam-diam.
4. Keputusan representasi utama/alias untuk dua archive duplikat, tanpa mengubah referensi historis atau menghapus arsip.
5. Persetujuan manifest migrasi identitas/membership dan preservasi credential secara terpisah dari linking. Password verifier baru harus kompatibel dengan hash lama yang valid; jangan memakai plaintext/default password atau meminta reset massal untuk menutupi migrasi yang belum selesai. Google memakai provider/sub yang terbukti, bukan auto-link berdasarkan email.

## Backup, rollback, recovery dan rencana uji

Sebelum write setelah ACC: backup konsisten terenkripsi di lokasi privat untuk data source/target yang relevan, credential asli dan WordPress account status/override; jangan menaruhnya di Git/log. Catat hash dan uji restore pada clone terisolasi. Simpan fungsi/owner/grant/policy/index sebelum penerapan. Backup arsip 18/19 Oktober saja tidak mencakup akun/kredensial dan tidak cukup untuk recovery.

Proposal linking hanya menambah dua fungsi dan satu unique index; tidak mengubah policy RLS atau profil. Prasyarat bundle hardening dan dua recovery login belum terpenuhi; jangan mencoba menjalankan proposal untuk melewati guard. Unique index memerlukan review kemungkinan duplicate provenance dan objek dengan nama yang sama sebelum penerapan.

`LINKING-ROLLBACK.sql` menghapus objek baru saja, setelah memeriksa manifest objek agar tidak menghapus indeks/fungsi yang sudah ada sebelumnya. Bila sudah ada link, bekukan penulis dan restore **per archive** dengan compare-and-swap: archive UUID, current canonical UUID, link_manifest_sha256 dan current updated_at harus sama dengan hasil eksekusi yang direview. Pulihkan canonical_identity_id, reconciliation_status, nilai metadata updated_at dan link_manifest_sha256 sebelumnya; pertahankan source_key, imported_at, field lain dan seluruh audit. Bila ada perubahan sesudah linking, hentikan restore baris tersebut untuk review. Tambahkan audit recovery. Jangan menyalin metadata penuh secara buta atau menghapus akun/canonical yang mungkin telah mempunyai relasi lain.

Rollback ini tidak mengembalikan helper has_capability rentan. Recovery Root/credential adalah prosedur operator tersendiri dengan bukti kepemilikan dan audit; tidak ada public bypass. Tidak ada data yang perlu direstore dari sesi ini karena tidak ada write cloud.

Rencana clone/Staging setelah ACC: replay manifest dua kali (second no-op); dua koneksi dengan versi sama; link ke identity lain; duplicate UUID/PTV; no-account personnel; protected Root/self; source UUID/metadata mismatch; grant anon/authenticated; akun inactive/deny overrides; audit insertion failure; snapshot account/profile/override/membership/credential sebelum/sesudah harus identik; restore per baris dengan versi stale harus ditolak. Verifikasi relasi Kas UUID dan peminjaman tanpa UUID tetap utuh. SET LOCAL claims simulasi tidak dianggap bukti signed JWT publik aman. Tidak ada uji tersebut dijalankan sebagai mutation cloud pada sesi ini.

## Validasi dan rekomendasi

Typecheck/lint lulus. Full suite **119 files, 1332/1332 tests lulus**; suite baru 25 tests juga diulang setelah revisi SQL. Build lulus **19.25s**, warning chunk besar masih ada. Tests membuktikan klasifikasi/planner/kunci impor lokal dan inspeksi teks SQL, bukan kelulusan RPC/RLS PostgreSQL.

**NO-GO untuk penerapan migrasi/linking.** Langkah aman berikutnya adalah review manifest dan pengumpulan bukti WordPress/recovery, kemudian uji clone terisolasi setelah ACC. Personel lama tidak perlu dibuat ulang atau diminta mendaftar lagi. Data lama tetap ada; yang belum selesai adalah pemetaan ke target, pemulihan login, dan persetujuan izin.

Rujukan teknis: [PostgreSQL INSERT / ON CONFLICT](https://www.postgresql.org/docs/17/sql-insert.html), [transaction/row/advisory locks](https://www.postgresql.org/docs/17/explicit-locking.html). Changelog Supabase dicoba dibaca tetapi fetch markdown tidak didukung; tidak ada dependency Supabase diubah. Hygiene CLN-157.
