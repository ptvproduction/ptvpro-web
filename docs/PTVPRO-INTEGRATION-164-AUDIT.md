# PTV-DEV-164: audit integrasi Authentication & Access

> **Final171 — Inventaris/Storage COMPLETE di Cloud Staging:**25negative hosted PASS, tester disabled/credentialNULL/0sesi, cutover5tabel+6RPC+Storage inventory EXECUTED_VERIFIED, postflight hosted/public-media/shared LF PASS.83regresi/typecheck/lint,18+18rehearsal lokal PASS. Tidak deploy ulang/Production/main-account roles berubah. [Receipt171](PTVPRO-INVENTORY-171-EXECUTION.json); modul lain tetap mengikuti audit masing-masing.

> **Eksekusi170:** hosted Inventaris/Storage positif PASS, guard native damage diterapkan+diverifikasi, shared LF tetap PASS.83regresi/typecheck/lint/build PASS. Tester mendapat persetujuan Rouf tetapi enrollment privat pasca-bootstrap belum tersedia; negative-role/cutover grant belum. [Receipt170](PTVPRO-INVENTORY-170-EXECUTION.json); tidak audit seluruh modul ulang.

> **Update169:** audit tiga gate read-only; SQL168 tidak drift, tester terpisah perlu ACC karena UNIQUE(identity_id), akun Rouf Recovery Admin dipertahankan.11simulasi policy PASS; hosted0Preview/0custom environment. [Matriks efektif169](PTVPRO-INVENTORY-169-READINESS.md). Cutover tetap NO-GO, tidak privilege/DDL/deploy berubah.

> **Update168:** routing hosted-Staging cookie dengan pin project teruji;64regresi/typecheck/lint/build PASS,14checks guard report/rollback lokal PASS. Guard cloud, limited-account negative test dan hosted activation tetap PARTIAL/BLOCKED; tidak revoke/deploy/DDL cloud. [Matriks efektif168](PTVPRO-INVENTORY-168-READINESS.md).

> **Update167:** valuasi create/update/retry cloud PASS setelah migrasi unique index yang di-ACC;28checks rehearsal lokal dan54regresi PASS. Gate cutover keamanan masih terbuka, tanpa perubahan privilege; [matriks167](PTVPRO-INVENTORY-167-READINESS.md).

> **Update166:** cloud nyata login/upload/create/edit/loan/return/QC PASS; valuasi503/42P10 terbukti. Grant native tidak dicabut karena gate cutover belum lengkap; [matriks terbaru166](PTVPRO-INVENTORY-166-CLOUD-CUTOVER.md). Tidak audit ulang modul lainnya.

> **Kelanjutan PTV-DEV-165:** jalur Inventaris/Storage aplikasi MODE staging kini memakai API cookie dengan capability live; 145 regresi terkait/typecheck/lint/build PASS. Integrasi cloud tetap PARTIAL: credential privat tidak tersedia untuk uji positif dan privilege Data API native belum dicabut. Detail matriks/bukti terbaru di [integrasi 165](PTVPRO-INVENTORY-165-INTEGRATION.md). Modul lain tidak diaudit ulang.

26 Oktober 2026, operator zidnal, Codex. Status: perbaikan minimum teruji lokal; integrasi seluruh modul **PARTIAL**, bukan sertifikasi seluruh operasi cloud. Production tidak diakses. Tidak commit Git, push, deploy, perubahan environment, atau migrasi/data cloud dilakukan.

## Bukti dan batas pemeriksaan

- Sumber: kode aktual route, session/policy, service boundary dan API terkait; query read-only PostgreSQL proyek Staging `swadgljnyelsjstqqxbm`. Tidak mengulang enrollment, bootstrap 149, migrasi Legacy25, atau audit historis keseluruhan.
- PostgreSQL: gate enabled, session policy 604800 detik, tepat 2 akun aktif dan 2 credential, 1 Root, 1 audit `root_bootstrap_completed`; 13 audit `portal_login_verified` saat diperiksa. Kedua akun yang disebut operator sesuai: jid aktif dengan crew/root_executive, rouf aktif dengan crew/eksekutif. Total profil eksekutif database = 2, sehingga jumlah assignment profil tidak boleh disamakan dengan jumlah recovery admin aktif.
- RPC `rpc_manage_account_access` dan `rpc_update_crew_personnel` ada, SECURITY INVOKER, anon/authenticated tidak memiliki EXECUTE. Keberadaan/grant diperiksa; mutasi administratif tidak dijalankan.
- Runtime Vite efektif `staging`, port 5174, auth `vercel`, inventory `supabase`, project ref tepat. Server verifikasi dibuat dan ditutup oleh sesi ini. HTTP nyata: `/api/auth/session` 200 dengan authenticated=false; 12 API internal (`akses`, `kru`, `acara`, `planner`, `catatan`, `broadcast`, `dokumen`, `kontak`, `finance`, `peminjaman`, `lost-found`, `lapor-kerusakan`) semuanya 401 tanpa cookie.
- Tidak membuka kredensial privat atau mengulang login positif. Pengujian role, revocation, permission refresh, dan race memakai fixture sintetis. File `browserPhase1E2E.test.tsx` menggunakan SSR/mocked fetch; namanya bukan bukti browser interaktif atau persistensi cloud.

## Temuan dan tindakan

| ID | Prioritas | Bukti aktual / tindakan | Status |
| --- | --- | --- | --- |
| INT-164-01 | P1 | Rute `/dev-*`, DevAutoAuth dan katalog memakai DEV saja sehingga ikut mode Staging. Batasi ke MODE development dengan auth mock/tidak disetel. | Diperbaiki, regresi lokal Staging/production/development PASS |
| INT-164-02 | P1 | Middleware Vite memuat staging untuk setiap mode, berbeda dari bootstrap konfigurasi. Sekarang memakai mode efektif yang sama. | Diperbaiki; runtime Staging HTTP PASS |
| INT-164-03 | P1 | Route/menu/editor Pengelolaan Portal menganggap hub.access sebagai izin kelola. Sekarang mensyaratkan settings.system atau crew.permissions.manage. | Diperbaiki di route, shell, dan page; bukan otorisasi backend baru |
| INT-164-04 | P1 | Finance tidak memeriksa lockout dan menerima iat/cutoff tidak valid dibanding liveAccess. Tambahkan penolakan waktu sesi tidak sah, lockout aktif/invalid, cutoff invalid. | Regresi sintetis PASS |
| INT-164-05 | P2 | finance.view_own tidak ada dalam 53 registry Staging; backend menurunkannya dari profil operasional, sementara frontend live menolak karena array registry saja. Pertahankan derivasi khusus Kas Saya untuk anggota aktif, deny override dan isolasi Pembina tetap berlaku; grant registry lain tidak dipulihkan dari profil statis. | Diperbaiki, regresi policy PASS |
| INT-164-06 | P1 | Suite login live otomatis membuka password DPAPI dan membuat sesi/audit. Sekarang perlu PTV_RUN_LIVE_AUTH_TESTS=true dan pin URL Staging sebelum akses kredensial. | Default SKIPPED; uji live tidak dijalankan |
| INT-164-07 | P1 | updateNilaiInventaris mengabaikan error upsert sehingga penolakan backend tampak sukses. Sekarang melempar kegagalan simpan tanpa mengklaim berhasil. | Diperbaiki, error 42501 sintetis PASS |
| INT-164-08 | P1 | Cloud166 membuktikan upload/create/edit/loan/return/QC;167 menutup42P10 dengan unique index disetujui dan valuasi create/update/retry PASS. Native grants serta gate negative-user/shared-report/hosted tetap belum ditutup. | Jalur fungsi cloud PASS; keamanan cutover PARTIAL/NO-GO, lihat167 |
| INT-164-09 | P1 | Service portal membaca ptv_portal_services lalu fallback localStorage; mutasi/publish lokal. Tidak ada tabel public bernama portal di Staging. | UI/lokal saja, persistensi cloud belum terimplementasi; perlu API/schema dengan review terpisah |
| INT-164-10 | P2 | Notifikasi memakai Supabase browser, tidak membawa cookie portal. ptv_notifications RLS aktif tetapi tidak mempunyai policy; client grants saja tidak membuat SELECT berhasil. Pemilihan target role hanya profil pertama sehingga kombinasi crew/root atau crew/eksekutif dapat salah filter. | Integrasi cloud belum lengkap; cache lokal bukan bukti persistensi |
| INT-164-11 | P2 | Kategori personel dipakai policy frontend, tetapi normalizer/session tidak membawa kategori kanonikal. Backend Finance masih mengecek profil dan jabatan arsip. | Paritas kategori belum tuntas; perlu sumber metadata.category yang konsisten dengan adapter Kru |
| INT-164-12 | P2 | SEO memakai fixtures; Haul countdown/config lokal. ID Digital memiliki download tanpa pemeriksaan id.export yang terpisah dari id.view. | Jangan klaim sebagai data cloud/permission parity lengkap |

## Matriks cakupan modul

Pemeriksaan route dan boundary berikut bersifat terarah; PASS anonim tidak berarti CRUD positif seluruh modul sudah teruji cloud.

| Modul | Guard frontend | Boundary aktual / hasil |
| --- | --- | --- |
| Beranda | hub.access | Agregasi Acara/Broadcast/Peminjaman/Dokumen; sebagian kegagalan menjadi array kosong/cache. Belum uji role positif cloud. |
| Kru & Akses | crew.view / crew.permissions.manage | API cookie + resolveLiveAccess; registry/revocation/status live. RPC administratif tersedia, tidak dieksekusi. |
| Inventaris & Nilai | inventory.view / inventory.valuation.view, mutasi create/edit/valuation.manage | Cloud166 katalog/upload/create+replay/edit PASS;167 valuasi create/update/retry/metadata/nilai nol PASS setelah ACC DDL unique. Grant native belum ditutup; cutover NO-GO. |
| Peminjaman | loans.view; checkout/return khusus | Cloud166 checkout2unit, single+remaining return dan histori unit-parent PASS; grant native masih ada, cutover belum dijalankan. |
| Acara & Kalender | events.view / calendar.view | API acara/planner refresh live session; negatif HTTP PASS, regresi operasional lokal. Beberapa alias capability nonkanonikal masih tersisa di API, tidak menjadi sumber grant. |
| Catatan | notes.view | API refresh live session dan notes.create/manage; alias notes.edit/delete bukan registry Staging. Negatif HTTP PASS. |
| Lost & Found / Kerusakan | lostfound.view / damage.view; mutasi report/QC khusus | Cloud166 laporan damage dan QC PASS dengan cookie nyata; Lost & Found tidak diuji ulang. Native report RPC berbagi kedua modul sehingga blanket revoke belum aman. |
| ID Digital | id.view | Identitas dari Crew store; QR/download canvas lokal; id.export belum diterapkan khusus. |
| Perizinan / Dokumen / Arsip / Generator | documents.view / archive.view / generate | API dokumen refresh live, guard request/generate/approve/archive.manage. Negatif HTTP dan regresi dokumen lokal; belum CRUD positif cloud semua peran. |
| Kontak Internal / Eksternal | contacts.internal.view / contacts.external.view | API internal mengizinkan hub.access menurut keputusan operator yang tercatat dalam kode; guard route lebih ketat. Dipertahankan, jangan cabut akses nomor kontak tanpa keputusan operator. Eksternal memeriksa view/manage live. |
| Keuangan | finance.view atau finance.view_own | API registry/override live + membership, isolasi kategori backend, RPC snapshot; perbaikan INT-164-04/05. Direct cloud service masih perlu pemeriksaan role positif lanjutan. |
| Broadcast | broadcast.view | API cookie/live grant; negatif HTTP dan regresi lokal PASS. |
| Haul | projecthaul.view | Countdown lokal, bukan modul backend operasional lengkap. |
| SEO | settings.system | Data fixtures, bukan analytics live. |
| Pengelolaan Portal | settings.system atau crew.permissions.manage | Gate diperketat; save/publish lokal, lihat INT-164-09. |
| Pengaturan | settings.personal | Tema lokal; Google status/unlink melalui API validasi live; regresi OAuth sintetis PASS, OAuth nyata tidak diulang. |
| Notifikasi & pencarian | shell authenticated + filter capability | Notifikasi lihat INT-164-10; pencarian merupakan agregasi client/service dan guard UI, bukan boundary database. |

## Validasi

- Batch A: 12 file PASS, 235 tes PASS; 1 file/1 tes live SKIPPED. Auth lifecycle, revocation, policy, session refresh, route, finance, API access, loan/report persistence.
- Batch B: 15 file, 150 tes PASS. OAuth, SSR lifecycle, portal, finance, inventaris, broadcast/pengaturan, Haul/SEO, dokumen. Sebagian tes diulang antarbatch; jangan menjumlahkan angka mentah sebagai total unik.
- Batch C setelah penanganan error valuasi: 3 file, 55 tes PASS (Inventaris/Peminjaman + route). Test route memakai timeout impor 20 detik karena graph modul besar; kegagalan awal timeout 5 detik sudah terselesaikan, bukan bukti kegagalan guard.
- Typecheck dan lint PASS sesudah perubahan valuasi. Build final `npm run build -- --mode staging` PASS sesudah seluruh patch kode (12,48 detik). Uji route final 3/3 PASS dengan fixture Kru diperbaiki agar impor tidak memicu error respons sintetis. Peringatan chunk >500 kB tetap ada. Warning SSR useLayoutEffect dan log error fixture pada suite lama tetap dibedakan dari kegagalan tes. `git diff --check` masih melaporkan whitespace pada baris di luar patch sesi ini di router/Vite/Inventaris; tidak melakukan formatting massal terhadap perubahan Antigravity.
- Tidak uji browser visual/mobile, mutasi cloud, positive login ulang, atau Production. SQL hanya metadata/agregat, tidak membaca nilai credential/session/token.

## Prioritas berikutnya

1. Selesaikan jalur Inventaris/valuasi/storage untuk sesi cookie melalui backend resmi; uji penolakan dan persistensi nyata dengan akun Staging, tanpa membuka grant anon atau memalsukan JWT.
2. Implementasikan persistensi Portal dan notifikasi melalui boundary yang sama. Schema/migrasi harus direview; localStorage tidak boleh dilaporkan sebagai cloud publish.
3. Satukan kategori kanonikal, hak ID export, dan filter multi-profil; rapikan alias capability setelah kontrak modul dikonfirmasi. Uji role matrix positif/negatif serta perubahan izin saat sesi masih hidup.

Hygiene: CLN-175 pada cleanings.md. Tidak cleanup massal, perubahan pengguna/Antigravity dipertahankan.
