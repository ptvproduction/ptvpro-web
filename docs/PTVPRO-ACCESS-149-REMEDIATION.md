# PTV-DEV-149 — Remediasi lokal dan syarat ACC

> Lanjutan 25 Oktober: Root hanya profil sistem baru, bukan role Legacy. Mode prebootstrap/guard/recovery terbaru serta hasil SQL lokal tersedia di [prosedur bootstrap Root](PTVPRO-ACCESS-149-ROOT-BOOTSTRAP.md). Catatan SQL belum diuji di bawah adalah status historis sebelum pengujian fixture lokal; cloud tetap belum diuji mutasi.

> Lanjutan rekonsiliasi menggunakan SELECT cloud terbaru: [laporan akun/personel Legacy](PTVPRO-ACCESS-149-LEGACY-RECONCILIATION.md). Manifest kini v2, bukan daftar hash SHA256 backup lama. Asal 91 arsip verified tidak berarti akun baru sudah linked. Bagian bukti offline di bawah adalah catatan tahap remediasi sebelumnya.

24 Oktober 2026; operator zidnal. **NO-GO untuk penerapan Staging.** Tidak ada SQL, DDL, RLS, atau mutasi cloud dijalankan dalam remediasi ini. Tidak ada commit/push/deploy. Source lokal dan proposal saja.

## Perbaikan dan batas bukti

| Blocker | Status | Bukti dan pekerjaan tersisa |
| --- | --- | --- |
| Login identifier tanpa verifikasi password | CLOSED lokal | Resolver menolak login live; fixtures hanya test tanpa service key. Password login sengaja tidak dinyatakan tersedia. |
| Token exp/iat dan actor | CLOSED lokal | Wajib angka integer positif, belum kedaluwarsa, iat tidak di masa depan, exp sesudah iat; identity cookie harus cocok dengan akun DB. Cutoff invalid ditolak. |
| Root/self melalui personel | PARTIAL | API dan proposal SQL menolak seluruh edit Root/self; RPC akses tetap melindungi Root. Belum diterapkan atau diuji di PostgreSQL. Jalur SQL/cloud lain belum diinventaris ulang. |
| Login pemulihan | BLOCKED | Proposal mensyaratkan Root dan sedikitnya dua identitas administrator efektif dengan kredensial Google. Ini hanya prasyarat struktur, bukan bukti login. Operator harus membuktikan dua login terpisah. |
| Linking/unlinking Google multi-query | CLOSED untuk bypass lokal; fitur BLOCKED | Penulisan live dinonaktifkan; tautan yang sudah sama hanya no-op. Pergantian/penambahan/pelepasan perlu RPC atomik dan ACC terpisah. Login Google yang sudah tertaut tetap memakai otorisasi live. |
| Gate cookie/profil lama | PARTIAL | Sembilan endpoint memakai refresh grant DB; fallback nama profil/hub.access dihapus dari izin modul. Scope kepemilikan, penugasan, divisi, dan RPC cloud lintas modul masih harus diuji. Finance mempunyai aturan kategori/own tersendiri yang tidak diubah. |
| Pemetaan kategori/divisi/angkatan | PARTIAL | Proposal menolak kategori tidak eksplisit, divisi tidak ditemukan, angkatan tidak numerik/di luar batas. Pembina/Pengarah memang tidak memerlukan divisi/angkatan. Histori divisi yang masih valid dipertahankan jika tidak diganti. |
| Linking identitas/ID duplikat | BLOCKED | Planner hanya menghasilkan antrean review, tanpa write/provisioning. Keputusan identitas harus dari operator. |
| Atomicity/concurrency/audit failure | PARTIAL | Struktur transaksi, lock bersama, versi, audit dan recovery check tersedia; tests inspeksi SQL bukan bukti eksekusi PostgreSQL. |
| Recovery aman | PARTIAL | Rollback RLS sekarang mempertahankan helper yang mengikat auth.uid; tidak mengembalikan definisi rentan. Restore data/owner/grant harus dilatih setelah ACC. |

## Bukti duplikat dan daftar rekonsiliasi

Backup lokal 18 Oktober (dua snapshot, masing-masing 93 baris) dan 19 Oktober (94 baris) sama-sama memuat satu kelompok duplikat berisi dua baris. Keduanya berbeda hanya pada archive_id, source_key, imported_at; kolom lain serta metadata identik. Tanggal impor keduanya 17 Oktober. Ini mendukung hipotesis impor berulang dengan source_key berbeda; akar penyebab belum dibuktikan dari log import. Keunikan source_key tidak menjamin keunikan ptv_id. Tidak menyalin nama, kontak, token, atau payload pribadi ke laporan.

`PTVPRO-ACCESS-149-RECONCILIATION.json` berisi 94 referensi arsip tersamarkan dari backup 19 Oktober, semuanya perlu review. Dua referensi diberi alasan DUPLICATE_PTV_ID. Referensi ialah 16 karakter awal SHA256(archive_id), bukan ID baru. Tidak ada kandidat identitas yang dikarang. Snapshot tidak cukup untuk menyatakan relasi canonical/membership/account saat ini. Laporan cloud sesi sebelumnya juga mencatat 0 archive linked dan 0 exact PTV matches; tidak diperiksa cloud ulang.

Opsi operator: (a) orang sama: tetapkan canonical yang dibuktikan, pertahankan dua arsip dan histori, tentukan representasi utama/alias; (b) orang berbeda: proposal koreksi ID dan seluruh referensi secara terpisah; (c) bukti kurang: tetap karantina dari linking/mutasi ambigu. Tidak ada opsi dijalankan otomatis.

`planIdentityReconciliation` menolak kandidat tidak unik, link konflik, canonical sudah dipakai, membership ganda/hilang, serta akun ganda/hilang. Exact match sekalipun tetap REQUIRES_OPERATOR_REVIEW. Tidak memakai nama/email untuk mencocokkan otomatis.

Mekanisme linking yang harus disetujui: manifest privat berisi archive UUID/version, canonical UUID/version, membership UUID/version, account UUID/version, bukti identitas, reviewer, keputusan kategori/divisi/angkatan, serta hash manifest. Verifikasi dua pihak jika melibatkan administrator. Setelah ACC terpisah, transaksi harus mengunci semua baris terkait dalam urutan tetap dan lock 149/1; ulangi cek uniqueness/version/FK, tolak self/Root, jangan mengubah profil/override/kredensial; update relasi yang disetujui saja, cutoff akun, audit, recovery check lalu commit. Provisioning identitas/akun baru tidak termasuk linking; memerlukan keputusan dan proposal sendiri. Belum ada RPC linking yang diklaim siap.

## Batas kepercayaan dan keputusan operator

Gate dokumen tidak lagi menerima crew.permissions.manage sebagai hak dokumen, dan mutasi kontak eksternal tidak menerima crew.create/edit sebagai pengganti contacts.external.manage. Perubahan status dokumen memerlukan canApprove; delete memerlukan documents.archive.manage. Resubmit/edit milik sendiri sementara ditahan sampai ownership backend terverifikasi. Query dokumen gagal tidak boleh mengembalikan fixtures runtime. Mekanisme fallback write/penomoran dokumen legacy masih perlu audit transaksi tersendiri: perubahan ini bukan sertifikasi atomicity seluruh modul Surat.

RPC adalah delegasi server: actor/iat berasal dari cookie HMAC terverifikasi, lalu diotorisasi live. Payload tidak boleh menentukan actor. Grant RPC hanya service_role; PostgreSQL administratif tetap pihak tepercaya. Helper native RLS mengikat auth.uid ke tepat satu akun. Jangan menganggap parameter actor sudah menjadi identitas kriptografis di SQL. Penyalahgunaan service_role berada di luar proteksi RLS; inventaris semua pemegang key/penulis lain wajib sebelum GO.

Dua keputusan kebijakan proposal perlu ACC eksplisit: administrator pemulihan kedua dengan identitas berbeda, serta crew.permissions.manage untuk perubahan kategori/divisi/angkatan/jabatan yang dapat mengubah scope. Tidak memberi izin baru agar pengujian lolos. Jika capability tersebut tidak sesuai kebijakan operator, revisi proposal dengan kewenangan existing yang disepakati sebelum penerapan.

## Backup dan penerapan setelah ACC

1. Pastikan koneksi menunjuk ref swadgljnyelsjstqqxbm melalui konfigurasi efektif dan panel Staging; komentar SQL bukan pengaman salah koneksi. Tidak mengakses Legacy/Production. Bekukan penulisan administratif termasuk SQL di luar RPC selama snapshot/penerapan.
2. Ambil backup konsisten terenkripsi di luar Git: archive, canonical, membership, accounts, profiles, overrides, credentials, catalogs dan audit; rekam PK/FK, count/checksum tanpa PII. Jangan mengekspor isi credentials ke log/laporan. Backup Storage relevan bila relasi foto akan disentuh.
3. Simpan pg_get_functiondef, owner, search_path, proacl, grant schema/table/function, policy definitions dan status RLS; inventaris trigger dan seluruh fungsi SECURITY DEFINER yang menulis tabel terlindungi. Preflight read-only tersedia, tetapi belum dijalankan.
4. Uji restore pada database terisolasi. Pastikan dua administrator dapat login melalui alur Google sebenarnya dan mempunyai izin efektif; simpan bukti waktu/hasil tanpa cookie/token. Kredensial ada tidak cukup.
5. Uji paket di clone terisolasi lebih dahulu. Gunakan `PTVPRO-ACCESS-149-STAGING-BUNDLE.sql`, hasil generator `scripts/build-access-149-proposal.mjs`: satu BEGIN/COMMIT untuk RPC dan helper RLS, disertai hash sumber. Generator hanya menulis file lokal. Dua proposal sumber tetap terpisah untuk review; jangan menjalankan keduanya secara terpisah sebagai paket atomik. Regenerasi dan review hash bila sumber berubah.
6. Setelah validasi dan ACC, terapkan hanya paket yang hash-nya disetujui; jangan membuka write sebelum postflight lulus. Versi kode lokal saat ini bukan deployment.

## Rollback dan recovery data

- Sebelum ada write bisnis: bekukan akses mutasi, jalankan rollback RPC yang menghapus wrapper/internal helper baru tanpa CASCADE/data deletion. Periksa dependensi/owner/grant aktual dahulu. Schema privat kosong boleh tersisa. Jika objek sudah ada sebelum penerapan, pulihkan definisi terverifikasi dari manifest, bukan menghapusnya tanpa penilaian.
- Helper RLS: pertahankan definisi aman dari RLS-ROLLBACK.sql. Berkas ini adalah safe recovery, bukan pemulihan byte-for-byte helper lama. Jika ada regresi, tutup jalur terkait dan forward-fix; jangan pulihkan helper yang mempercayai account_id/status klaim.
- Setelah write bisnis: rollback objek tidak mengembalikan data. Buat manifest restore per PK dari backup konsisten, bandingkan versi terakhir agar tidak menimpa perubahan sah. Pulihkan profil/override beserta reason/granted_by/timestamp, status, serta field membership/personel yang berubah dalam satu transaksi terkunci. Jangan restore seluruh tabel secara buta atau menghapus audit.
- Cutoff sesi tidak boleh dimundurkan ketika restore: gunakan cutoff baru dan wajibkan login ulang. Audit restore ditambahkan, tidak dihapus. Jangan mengganti kredensial dari backup tanpa keputusan recovery terpisah. Validasi administrator yang login, FK, izin efektif dan deny setelah restore.
- Owner/grant/policy dipulihkan dari manifest hanya setelah review keamanan; jangan GRANT ALL dan jangan memulihkan grant rentan. Jika tidak ada jalur login aman, write tetap ditutup; operator DB melakukan recovery terkontrol dengan persetujuan, bukan endpoint publik atau secret fallback.

## Rencana uji SQL nyata — belum dijalankan

Semua skenario menggunakan fixture di clone atau BEGIN/ROLLBACK Staging setelah ACC, tanpa transaksi/data bisnis permanen. Pakai dua koneksi untuk concurrency; selalu rollback kedua koneksi dan pastikan timeout tidak meninggalkan lock. SET LOCAL claims oleh admin hanya simulasi, bukan bukti JWT publik bisa dipalsukan.

| Skenario | Hasil wajib |
| --- | --- |
| Root melalui akses/personel/membership/credential path | Semua jalur mutasi biasa menolak; profil dan login tetap utuh. SQL langsung hanya operator tepercaya. |
| Setiap profil katalog + allow/deny | Deny menang, capability unknown ditolak, jabatan bukan grant; tidak ada penambahan hak otomatis. |
| Actor manipulasi, self account/identity, sesi dicabut/nonaktif | 403/42501; tidak ada perubahan atau audit sukses palsu. |
| anon/authenticated direct RPC/table | Tidak dapat menulis; helper auth.uid tidak menerima akun orang lain dari claim account_id. Inventaris grants/triggers wajib. |
| Kategori/divisi/cohort dan linking ambigu | 22023, tidak ada perubahan archive/canonical/membership/cutoff/audit. |
| Dua pengguna, versi target sama | Satu berhasil; satu stale-version; tidak ada gabungan profil/override dari dua perubahan. |
| Dua admin mencoba menonaktifkan satu sama lain | Recovery check/otorisasi ulang menolak hasil yang menghilangkan Root atau cadangan; dua koneksi diverifikasi. |
| Audit insert gagal | Seluruh mutasi dan cutoff rollback; cek checksum sebelum/sesudah. Fault injection hanya clone, tidak ubah trigger/grant cloud tanpa ACC. |
| Error setelah setiap tahap DML | Tidak ada perubahan parsial. Tidak cukup hanya memeriksa hasil RPC. |
| Restore/rollback | Data sesuai manifest, cutoff baru, audit tetap ada, login recovery dan grant aman teruji. |
| Acara, Surat, Inventaris, Peminjaman, Finance, Notifikasi | Kepemilikan/assignment/divisi/capability efektif; GET dan POST langsung, sesi lama setelah revoke, tidak ada data lintas scope. Tidak kirim notifikasi eksternal uji. |

## Validasi lokal

- `npm run typecheck`: lulus, exit 0.
- `npm run lint`: lulus, exit 0, tanpa warning ESLint.
- `npm run build`: lulus, exit 0, Vite selesai 18.10s; warning chunk melebihi 500 kB masih ada.
- `npm test -- --reporter=dot`: **118 files, 1307/1307 tests lulus**, exit 0. Termasuk accessHardening149 48 tests dan accessRemediation149 38 tests. Fixtures lama diperbaiki dengan mock boundary otorisasi eksplisit, bukan melonggarkan runtime.
- Pengujian API baru membuktikan penolakan grant cookie stale pada sembilan endpoint memakai database in-memory; penolakan self/Root personel, akun saudara Root, dan actor identity mismatch. Token malformed/expired/future, planner ambigu, serta hash/batas transaksi bundle juga diuji.
- Konfigurasi `.env.staging` dibaca dengan output terbatas: project host swadgljnyelsjstqqxbm.supabase.co, auth backend vercel, inventaris backend supabase. Tidak mencetak env/token. Runtime HTTP 5174 tidak diuji pada remediasi ini.
- Tidak ada SQL/RLS/RPC nyata, concurrency dua koneksi, fault injection audit, restore, atau login recovery cloud diuji. Unit mock dan inspeksi teks SQL bukan bukti keamanan database.

Status keseluruhan tetap **NO-GO** sampai blocker tinggi di atas ditutup dan bukti Staging tersedia. Tidak ada UI/CSS diubah; tidak ada perubahan desain R03.

Hygiene CLN-156; roadmap dan piketdev diperbarui. SESSION HEALTH 80/100, Sehat, confidence Sedang: scope/bukti jelas, tetapi perubahan lintas modul serta proposal SQL memerlukan review lanjutan sebelum ACC.
