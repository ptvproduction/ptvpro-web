# PTV-DEV-149 — Root pertama, pemulihan, dan persiapan migrasi

## Prosedur privat Phase1 terbaru — belum dijalankan

1. Melalui perangkat/kanal administratif privat, operator memilih **dua UUID akun existing dan dua canonical identity berbeda**: pemilik utama dan pemilik recovery. Cocokkan bukti penguasaan login dengan personel/provenance; jangan gunakan nama/email/jabatan sebagai bukti. Simpan manifest pemilihan dan bukti di penyimpanan privat di luar Git, tanpa password/hash/cookie/token di laporan/chat. Belum ada akun dipilih oleh AI.
2. Masing-masing pemilik membuktikan login sendiri, faktor MFA/perangkat dan sarana recovery terpisah. Dua identitas berbeda sudah diwajibkan desain bootstrap149 agar satu identitas tidak sekaligus menguasai pemulihan. Dua record, dua browser atau dua bcrypt salt tidak membuktikan independensi. Recovery harus sudah memiliki hub.access + crew.permissions.manage efektif yang disetujui; jangan otomatis menambah izin. Uji alternatif provider saat jalur utama tidak tersedia.
3. Review pemetaan akun→canonical→membership dan arsip UUID secara privat. Legacy25 sudah diprovisioning inactive-only (receipt5); gunakan akun existing, jangan membuat ulang atau memakai akun testing.14HOLD/arsip duplicate tetap ditahan. **ACC linking/enrollment terpisah**: enrollment privat existing/non-Root tanpa password existing memakai CAS+audit dan Binary COPY/TEMP privat; hash Legacy tidak disalin. Review pin executable dan ACC redaksi logging sementara wajib; launcher C01 memulihkan baseline persis. [Kesiapan operasional terbaru](PTVPRO-ACCESS-152-AUTH-READINESS.md) membedakan proof owner, enrollment, aktivasi pilot dan bootstrap. Sesi ini tidak mengubah akun/credential nyata.
4. **ACC Staging terkontrol terlebih dahulu**, sesuai urutan152 terbaru. Setelah addendum default-off direhearsal dan disetujui, buktikan login portal kedua akun dan recovery browser aktual, simpan ID audit/version serta hash evidence nonsensitif. Template sekarang mendukung proof password atau Google; guard signature/CAS/freshness24jam tetap. Rekam profil/override/katalog Root, versi akun/credential dan physical cluster di manifest existing, tanda tangani offline melalui trust store operator. Public trust store tetap tidak diisi AI.
5. **ACC bootstrap/aktivasi tersendiri** diperlukan sesudah review manifest. Bootstrap akan mencabut sesi target; itu tidak dilakukan sekarang. Setelah eksekusi yang diotorisasi nanti, kedua pemilik login ulang, uji akses efektif/deny/recovery dan penolakan bootstrap kedua. Jika gagal, tahan aktivasi dan lakukan containment/forward recovery yang direview; jangan menghapus marker atau mengembalikan celah lama.

Implementasi lokal:80 pemeriksaan SQL PostgreSQL17 sintetis PASS termasuk password-primary/Google-recovery, dua identitas/credential, cutoff pascabootstrap, linking tanpa akun dan audit failure. Bukti ownership/login/recovery Staging tetap belum ada. [Detail dan evidence Phase1](PTVPRO-ACCESS-152-AUTH-READINESS.md). Bagian152/151 di bawah adalah riwayat sebelum implementasi ini.

> Lanjutan sesi152: [audit autentikasi dan prosedur operator](PTVPRO-ACCESS-152-AUTH-READINESS.md). Guard password tetap tertutup; lockout server, preservasi cookie saat outage dan OIDC diperketat. Addendum native sesi152 terpisah lulus31 SQL lokal; bundle149 ini tidak diubah. Ownership/linking/recovery nyata tetap BLOCKED. Bootstrap existing akan mencabut sesi target melalui cutoff, sehingga memerlukan ACC eksplisit dan belum boleh dijalankan pada batasan sesi152.

25 Oktober 2026; operator zidnal. **PARTIAL / NO-GO untuk eksekusi atau pengujian mutasi Staging.** Seluruh cloud tetap read-only. SQL yang dieksekusi untuk pengujian hanya pada PostgreSQL 17 lokal dengan fixture sintetis, bukan data Legacy/Staging/Production.

## Koreksi konsep

**Legacy tidak memiliki role Root.** Root adalah profil akses sistem baru `root_executive`, sudah ada pada katalog PTVPRO baru. SELECT aktual menemukan 53 capability profil itu, 0 assignment, dan 0 marker bootstrap. Tidak ada akun Root Legacy yang perlu dicari atau dipulihkan. Penetapan Root pertama adalah keputusan administratif baru oleh operator.

Identitas personel, akun login dan profil akses tetap terpisah. Ketua/Koordinator/Pembina/Pengarah, nama, email, dan role Legacy tidak menentukan Root. Source UI memiliki profil Root statis, tetapi otorisasi server memakai grant database efektif dan deny override; manifest harus merekam daftar capability Root dari DB, bukan mengasumsikan daftar statis sama.

## Prosedur sederhana untuk operator

1. **Pilih akun A dan B secara sengaja.** A calon Root pertama, B administrator pemulihan. Pakai UUID akun/identitas yang kepemilikannya sudah terbukti. Keduanya boleh berasal dari sistem baru atau hasil migrasi yang sudah direview; tidak harus akun Legacy tertentu. Bootstrap tidak membuat, mengaktifkan, menggabungkan atau menautkan akun.
2. **Buktikan dua login terpisah.** Pemilik, akun Google, sub provider, perangkat/sesi, MFA dan sarana recovery harus independen. B harus sudah mempunyai `hub.access` dan `crew.permissions.manage`; bootstrap tidak menambah izin B agar tes lolos. Jangan membuktikan independensi dengan mengganti profil pada cookie yang sama.
3. **Lengkapi bukti portal.** Calon A dan B harus dapat login melalui alur yang benar dan membuka sesi portal miliknya sendiri. Kode lokal sekarang merekam audit server setelah Google terverifikasi dan sesi ditandatangani, sebelum cookie diterbitkan. Itu bukti validasi server, belum bukti browser menerima cookie atau recovery E2E; operator harus menyimpan hasil drill E2E terpisah tanpa token/cookie/password. Bukti bootstrap harus berumur paling lama 24 jam dan sesuai versi credential saat ini.
4. **Review kenaikan hak dan tanda tangani manifest.** Catat target UUID, versi akun/credential, ID bukti login, profil/override sebelum perubahan, daftar capability Root, database system identifier Staging, hash template SQL, bukti independensi dan E2E, nomor ACC, waktu terbit/kedaluwarsa maksimal 24 jam. Operator yang berwenang menandatangani byte manifest secara offline dengan Ed25519. Jangan menyerahkan private key/password kepada AI. Hanya public key yang didaftarkan ke trust store melalui review operator.
5. **Siapkan SQL secara offline.** Trust store saat ini kosong dan tidak ada target terpilih. Renderer menolak manifest tanpa tanda tangan yang cocok dengan public key tepercaya. Renderer tidak mempunyai client database, tidak mengambil key Supabase, tidak mengeksekusi SQL, dan tidak menimpa file output yang sudah ada. Review SQL hasil render dan hash file sebelum ACC pelaksanaan.
6. **Setelah ACC terpisah, uji clone lalu Staging terkontrol.** Bekukan penulis administratif, verifikasi project ref fisik dan backup, jalankan proposal persiapan dengan jalur mutasi masih tertutup. Jalankan bootstrap melalui koneksi SQL administratif langsung yang sah, bukan browser, REST/RPC, atau service-role. Identitas administratif di audit berasal dari session_user/current_user database dan fingerprint penanda tangan yang diverifikasi renderer, bukan operator_id dari payload.
7. **Validasi setelah commit.** Login ulang kedua akun karena sesi lama dicabut. Pastikan hanya A mendapat profil Root, B tetap dapat mengelola sesuai hak awal, deny tetap berlaku, data personel/histori tetap utuh, audit tercatat, marker tidak bisa dihapus, dan bootstrap ulang ditolak. Jangan membuka penggunaan normal jika salah satu gagal.

Tidak ada langkah 6 atau 7 yang dijalankan pada cloud dalam sesi ini.

## Implementasi lokal

- `config/access-bootstrap-trust.json`: daftar public key operator masih kosong. Tidak membuat key approval sungguhan atau memilih akun otomatis.
- `scripts/lib/root-bootstrap-149.mjs`: validasi manifest ketat, signature tepercaya, expiry, project/system identifier, target dan identity berbeda, proof berbeda, hash SQL dan snapshot privilege. Field operatorId/nama/email/jabatan/Legacy role tidak diterima sebagai pemilih Root.
- `scripts/prepare-root-bootstrap-149.mjs`: renderer offline. Bentuk perintah sesudah berkas operator tersedia: `node scripts/prepare-root-bootstrap-149.mjs manifest.json signature.txt new-output.sql`. Jangan menaruh manifest privat atau berkas signature nyata di Git. Signature bukan secret, tetapi artefak ACC tetap harus terkontrol.
- `ROOT-BOOTSTRAP-TEMPLATE.sql`: satu DO dalam transaksi; tidak membuat function/RPC/role bootstrap. Memeriksa principal administratif, JWT claims kosong, database cluster yang disetujui, snapshot versi, grants, bukti login, kepemilikan terpisah yang diattestasi, serta marker belum pernah dikonsumsi. Global lock 149/1 dan table/row locks mencegah dua bootstrap bersamaan.
- Hanya menambahkan profil `root_executive` ke akun yang dipilih. Profil lama, override, status, credential, canonical identity, membership, kategori dan histori tidak diganti. Deny yang menghalangi pengelolaan menyebabkan abort, bukan dihapus. Cutoff sesi kedua akun diperbarui agar hak baru hanya dipakai setelah login ulang.
- Audit `root_bootstrap_completed` menggunakan actor_id NULL, karena principal SQL administratif tidak boleh dikarang sebagai canonical person. Metadata menyimpan principal DB nyata, hash ACC/key/template/bukti serta UUID target. Tidak menyimpan secret/sub Google/password/token.
- `api/auth/_utils/loginProof.ts` dan callback: verifikasi live account serta binding credential Google sebelum audit; audit gagal berarti cookie login tidak diterbitkan. Flag ENABLE_DEV_MOCK_AUTH tidak lagi dapat memilih identitas pada backend live. Mock hanya NODE_ENV=test tanpa service key. OAuth state mempunyai batas 5 menit, nonce/verifier wajib untuk alur nyata; PKCE code_verifier diteruskan. Klaim Google exp/iat/sub juga diperketat.

**Tidak meninggalkan pintu bootstrap:** tidak ada endpoint baru atau RPC bootstrap, tidak ada role/credential sementara, dan approval GUC bersifat transaction-local. Profil Root yang memang disetujui adalah hasil bisnis yang disengaja, bukan privilege SQL sementara. Function trigger guard tetap ada sebagai pagar penolakan; bukan jalur pemberian Root.

## Penyelesaian dependensi dan grant/RLS

Proposal normal sebelumnya memeriksa Root/recovery pada akhir instalasi, sehingga tidak dapat dipakai untuk instalasi pertama tanpa Root. Generator sekarang menyediakan dua mode:

- `node scripts/build-access-149-proposal.mjs --prepare-bootstrap` menghasilkan `PREBOOTSTRAP-BUNDLE.sql`: helper/guard/RLS disiapkan tetapi **EXECUTE mutasi tidak dibuka**. Pemeriksaan recovery akhir ditunda hanya dalam mode ini; bukan dilonggarkan untuk penggunaan normal.
- Mode normal tetap menghasilkan `STAGING-BUNDLE.sql` dan mensyaratkan bootstrap/recovery sudah valid. Jangan menjalankan mode normal untuk mengakali bootstrap pertama.
- Bootstrap yang berhasil membuka hanya RPC akun/personel normal beserta implementasinya untuk service_role. Helper/guard/bootstrap tidak diberi EXECUTE luas. Root tidak boleh diberikan melalui RPC pengelolaan akses biasa.
- Pemeriksaan read-only cloud menunjukkan RLS aktif pada tabel akses, tetapi grant UPDATE/TRUNCATE masih luas untuk anon/authenticated. Grant itu **bukan bukti exploit publik**, karena RLS/pintu SQL juga menentukan kemampuan efektif dan tidak diuji dengan write cloud. Proposal mencabut direct DML/TRUNCATE/REFERENCES/TRIGGER pada user_account, account_profiles, overrides, credentials, membership, canonical identity dan katalog akses dari anon/authenticated/service_role. Penulis yang sah menggunakan definer RPC atau SQL operator. SELECT tidak diubah; INSERT audit backend tetap tersedia untuk proof/login biasa.
- Guard trigger menolak perubahan profil Root tanpa transaksi administratif yang disetujui, termasuk service-role dengan grant yang keliru. Marker bootstrap append-only; update/delete/truncate tidak dapat membuka bootstrap lagi. Trigger guard tidak memakai SECURITY DEFINER dan EXECUTE publik dicabut.
- `assert_recovery` sekarang mengikat pasangan yang disetujui, tidak menghitung dua record secara longgar: account/identity/sub provider berbeda, binding credential unik, auth_user_id berbeda jika keduanya ada, akun aktif/tidak terkunci, grant efektif, bukti login server, dan versi credential yang dipin. Perubahan yang memutus pasangan ditolak atomik. Rotasi credential/pasangan memerlukan review recovery baru; tidak otomatis mengganti cadangan dengan akun lain.

## Status akun Legacy dan dua akun Staging

SELECT agregat Legacy: 39 hash berformat bcrypt `$2y$` cost 10, 53 tanpa hash. Empat OAuth UID termasuk dalam 39 kandidat tersebut. Tidak ada password/hash asli/OAuth UID yang diekspor atau dicetak. Inspeksi format lokal mengembalikan runtimeCompatible=false sampai known-answer test dan verifier yang benar tersedia; tidak mengubah prefix `$2y$` menjadi `$2b$` secara buta. Login password yang belum aman tetap ditahan.

Dua akun Staging belum cocok dengan identitas Legacy dan hanya memiliki jalur native Auth email yang pernah sign-in. Pembacaan akhir sesi: 0 Root, 0 bootstrap marker, 0 credential Google untuk portal Vercel, 0 proof login baru, 0 RPC bootstrap terpasang. Oleh karena itu keduanya **belum memenuhi syarat bootstrap ini**, dan tidak dipilih otomatis.

**Batas independensi saat ini:** proof collector mendukung route vercel_google. Dua sub berbeda plus dua pemilik adalah independensi akun, bukan diversifikasi provider. Gangguan Google/callback masih dapat memengaruhi keduanya. Jalur native email belum menjadi recovery portal Vercel yang teruji; recovery SQL administratif berada pada kanal tepercaya terpisah, bukan login portal alternatif. Jangan menyatakan recovery sudah READY. Jika operator mensyaratkan cadangan lintas provider, implementasi/approval jalur tersebut masih blocker.

Rencana migrasi tetap memakai manifest rekonsiliasi: 91 archive VERIFIED asal UUID, 2 DUPLICATE satu UUID, 1 UNMATCHED data uji. VERIFIED bukan linked login. Jangan memaksa 94 personel mempunyai akun. Dua arsip duplikat dipertahankan beserta source_key/archive UUID dan histori; keputusan representasi utama/alias belum dijalankan. Tidak mencari Root Legacy atau mengonversi role Legacy menjadi Root. Status login WordPress, override dan target canonical tetap memerlukan bukti terpisah.

## Backup, revert dan recovery

1. Backup privat konsisten sebelum/ sesudah perubahan harus mencakup akun, credential, assignments, overrides, katalog, membership, audit, fungsi, owner, grant, RLS/policy dan trigger. Backup pembanding pseudonim bukan backup restore. Jangan masukkan credential asli ke log/Git. Uji restore pada clone baru dan verifikasi ACL/marker.
2. `ROOT-BOOTSTRAP-REVERT-TEMPLATE.sql` membutuhkan **ACC dan signature baru** dengan purpose first_root_bootstrap_revert; renderer memakai opsi `--revert`. Manifest menunjuk event bootstrap, bukan memilih akun lain. Template mengambil target dari marker, memeriksa versi/profil yang belum berubah dan recovery masih dapat login, menutup EXECUTE mutasi, menghapus hanya assignment Root yang ditambahkan, mencabut sesi lama, serta menambahkan audit rollback. Tidak menghapus akun/credential/histori atau mengembalikan cutoff ke masa lalu.
3. Marker root_bootstrap_completed tetap tersimpan setelah revert. Revert tidak membuka kesempatan menjadi Root pertama lagi. Bila akun/profil telah berubah sesudah bootstrap, CAS menolak revert otomatis; operator harus menyiapkan forward recovery terbatas, bukan restore tabel secara buta.
4. Hilangnya credential Root harus ditangani pada pemilik/provider dengan verifikasi kepemilikan, atau prosedur SQL recovery baru dengan ACC terpisah; tidak ada fallback password, pembuatan Root otomatis atau endpoint reset istimewa. Backend account-access biasa tidak boleh menjadi jalan mengambil alih Root.
5. Jangan memulihkan backup pra-bootstrap lalu menganggap sistem belum pernah bootstrap. Cocokkan dengan register ACC/audit eksternal, pertahankan marker konsumsi terbaru, dan gunakan prosedur recovery baru. Jaminan sekali pakai tidak melindungi dari administrator DB yang sengaja membuang seluruh database/guard; principal tersebut berada di batas kepercayaan administratif. Pengikatan system_identifier menolak replay SQL pada cluster lain, expiry membatasi masa ACC.
6. Rollback bundle tetap mempertahankan helper RLS aman dan guard keamanan; jangan mengembalikan broad write grants atau helper lama yang mempercayai account_id/status dari klaim. Pemulihan owner/grant selalu ditinjau, bukan GRANT ALL.

## Bukti pengujian

- Typecheck/lint lulus. Full Vitest **120 files / 1367 tests lulus**; termasuk 35 regression bootstrap/signature/proof/hash-format. Build lulus **28.86s**, warning chunk >500 kB tetap ada.
- **36 pemeriksaan SQL nyata pada PostgreSQL 17 lokal lulus**, hasil terstruktur di `ROOT-LOCAL-SQL-RESULTS.json`. Termasuk kompilasi bundle, grant tertutup sebelum bootstrap, penolakan role salah/cluster salah/versi stale/credential sama/proof lama, concurrency dua koneksi (tepat satu berhasil), audit failure rollback assignment/cutoff, marker immutable, bypass service-role ditolak, RLS setelah grant sengaja diregresikan, pencegahan penonaktifan cadangan, binding native sub, backup/restore schema+grants+marker, revert serta replay setelah revert.
- Uji nyata menemukan dua cacat SQL yang tidak terlihat dari inspeksi teks: CASE pada kondisi IF perlu kurung dan kolom registry.key ambigu terhadap variabel PL/pgSQL. Keduanya diperbaiki sebelum run lulus.
- Fixture lokal minimal dan sintetis, termasuk tiga capability Root untuk uji; bukan salinan penuh Staging dengan 53 capability. Auth.uid/jwt disimulasikan dari GUC lokal untuk menguji SQL; bukan bukti JWT publik dapat dipalsukan atau validasi Supabase/Google E2E. Cloud hanya SELECT schema/agregat/readiness; tidak menguji DML rollback pada cloud.
- Server fixture lokal dimatikan, postmaster.pid tidak tersisa. Key Ed25519 pengujian hanya di memori; trust store operator tetap kosong. Tidak ada SQL Root sungguhan dirender/diaktifkan, commit/push/deploy atau perubahan UI/R03.

## Keputusan dan blocker

**NO-GO untuk pengujian mutasi/migrasi Staging dan belum READY.** Artefak lokal dapat direview dan diuji pada fixture/clone yang disetujui. Blocker: pemilihan akun+ownership oleh operator, enrollment public key operator, binding credential/login portal yang sah, dua drill recovery E2E, provider/path alternatif bila diwajibkan, data status/override WordPress dan kompatibilitas verifier Legacy, review seluruh penulis privileged/cloud grants/RPC, serta uji schema/auth Staging sebenarnya setelah ACC.

Bootstrap Root pertama dan preservasi akun Legacy adalah dua proses terpisah. Tidak perlu registrasi ulang massal. Tidak ada izin diberikan agar pengujian lulus pada akun sungguhan. Code hygiene CLN-158.


## Sprint finishing 25 Oktober — pilihan akun dan bcrypt

Tidak ada pembacaan SQL cloud baru pada sprint ini. Bukti berikut memakai manifest rekonsiliasi terakhir, bukan verifikasi kepemilikan baru. Root utama direncanakan untuk operator/pemilik; belum ada akun yang dipilih atau dinaikkan haknya.

| Opsi untuk diverifikasi operator | Referensi akun tersamarkan | Bukti yang tersedia | Kelayakan Root/recovery sekarang |
| --- | --- | --- | --- |
| A | 1719faf48d78… | Akun aktif, profil eksekutif, native Auth bound, satu membership dan canonical ada | Belum layak: kepemilikan pemilik, hubungan Legacy dan login portal belum terbukti |
| B | 27e931c95822… | Akun aktif, profil crew, native Auth bound, satu membership dan canonical ada | Belum layak: kepemilikan independen dan login portal belum terbukti; tidak otomatis diberi manage |

Referensi lengkap tetap di manifest existing; tidak menyalin nama/email/credential ke laporan. Profil eksekutif bukan bukti bahwa A adalah pemilik. Operator perlu mencocokkan akun melalui kanal administratif privat, membuktikan login sendiri, lalu memilih target Root. Kandidat pemulihan harus membuktikan pemilik/kredensial/jalur login terpisah serta kemampuan pengelolaan efektif yang sah. Belum ada kandidat independen yang terbukti memenuhi semua syarat. Jika B dipilih, pemberian capability pemulihan harus disetujui secara spesifik, bukan dilakukan demi meluluskan tes. Tidak meminta registrasi ulang massal atau membuat akun baru otomatis.

`python scripts/test-legacy-bcrypt-149.py` lulus **2 unittest / 6 pemeriksaan prefix** dengan Python bcrypt 5.0.0 yang tersedia lokal: fixture sintetis cost10 diterima sebagai 2a/2b/2y, password fixture salah ditolak dan hash malformed ditolak. Tidak membaca atau mencetak hash/password pengguna dan tidak menambah dependency aplikasi. Ini bukti kompatibilitas verifier Python tersebut, **bukan bukti login Node/Vercel atau kompatibilitas semua 39 credential**. Verifier portal, rate limiting dan migrasi kredensial tetap perlu implementasi/review tersendiri; login identifier-only live tetap diblokir.

Rekonsiliasi tidak berubah: 91 VERIFIED provenance arsip saja, 0 AMBIGUOUS, 1 UNMATCHED karantina, 2 DUPLICATE dari satu UUID; dua akun baru UNMATCHED ke Legacy; 39 kandidat credential dan 53 personel tanpa bukti credential. Rekomendasi duplikat: pertahankan kedua arsip dan UUID sumber, jangan merge/delete/rekey; operator memilih penanda arsip rujukan setelah pemeriksaan relasi. Belum ada target canonical Legacy yang disetujui untuk linking.

Status **PARTIAL / NO-GO**: pilihan Root/recovery, status/override WordPress, verifier portal serta uji keamanan dan login nyata Staging belum selesai. Hasil 36 SQL fixture bootstrap sebelumnya dipertahankan, tidak diulang tanpa perubahan relevan; tidak ada bootstrap/linking/RLS cloud pada sprint ini.


## Pembaruan PTV-DEV-151 — Node dan checklist keputusan operator

25 Oktober 2026. Verifier server `api/auth/_utils/legacyPassword.ts` memakai bcryptjs 3.0.3 versi tetap. **9 tests Node/Vitest lulus**, termasuk fixture Python 2y UTF-8 independen; **2 pemeriksaan Node 24.21.0 langsung** juga lulus tanpa mock. Tidak ada hash pengguna yang dibaca, tidak ada login Legacy diaktifkan. Cakupan verifier: 2a/2b/2y cost10 dan maksimum 72 byte UTF-8. Unsupported cost/format atau password lebih panjang ditolak tanpa truncation diam-diam; jalur recovery harus diputuskan operator sebelum aktivasi agar tidak menyebabkan lockout. Kompatibilitas fixture bukan bukti migrasi seluruh 39 akun atau login Vercel nyata. Rate limiting/login lifecycle, status akun WordPress dan override masih harus diselesaikan sebelum login password dibuka.

Checklist ACC yang belum terpenuhi:

Investigasi pesan login: `api/auth/login.ts` memanggil `resolveIdentityByCredentials` pada `api/auth/_utils/identity.ts`. Resolver sengaja mengembalikan pesan “Login password belum tersedia secara aman” di luar test atau saat service-role tersedia; verifier bcrypt belum dipanggil. Jadi pesan ini bukan kegagalan pembacaan prefix 2y. Schema proposal memiliki kolom password_hash, tetapi keberadaan kolom bukan bukti credential akun sudah dipindahkan dan dimiliki pihak yang tepat. Jalur gagal tidak menerbitkan atau menghapus cookie sesi; sprint ini tidak menyentuh sesi aktif. `vercel.json` tidak menetapkan versi Node, sehingga bukti Node24 lokal belum membuktikan runtime deployment. Jangan membuka guard hanya untuk menghilangkan pesan; selesaikan linking terverifikasi, status/override, lifecycle/rate limiting dan recovery terlebih dahulu.

- [ ] Pemilik/operator memilih UUID akun utama setelah bukti login/kepemilikan privat; profil eksekutif/nama/email bukan bukti ownership. Referensi opsi A/B existing tetap belum terhubung ke Legacy, bukan kandidat yang otomatis lolos.
- [ ] Pemilik recovery berbeda, credential/provider subject dan faktor MFA/recovery terpisah; drill dengan perangkat/sesi sendiri berhasil. Dua record atau dua sesi milik satu credential tidak memenuhi independensi.
- [ ] Jalur masuk dan pemulihan saat provider utama bermasalah benar-benar diuji; native email sign-in lama bukan bukti portal cookie dapat pulih. Capability hub.access/crew.permissions.manage efektif dan deny diverifikasi tanpa menambah izin demi tes.
- [ ] Versi akun/credential, audit proof login baru, hasil drill, expiry dan hash evidence direview untuk manifest. Public key tepercaya serta signature operator dipersiapkan melalui prosedur existing; belum ada key/target diisi oleh sprint ini.
- [ ] Status/override39 kandidat credential dari WordPress dikonfirmasi, tanpa menyalin password mentah, tanpa registrasi ulang massal.53 personel tanpa bukti credential tidak dipaksa memiliki login.
- [ ] Dua arsip duplikat tetap dipertahankan berdasarkan UUID Legacy yang sama; operator menetapkan arsip rujukan/alias setelah meninjau relasi. Jangan merge/delete/rekey histori. Dua akun baru tetap UNMATCHED sampai ownership/provenance terbukti; tidak auto-link berdasarkan nama/email.

Klasifikasi arsip91 VERIFIED provenance/0 AMBIGUOUS/1 UNMATCHED/2 DUPLICATE dan dua akun UNMATCHED adalah bukti rekonsiliasi 149 terakhir, bukan query cloud baru. Tidak ada linking/bootstrap/perubahan akun nyata pada151. **Recovery Root masih BLOCKED; NO-GO aktivasi/deployment.**
