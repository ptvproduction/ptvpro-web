# Finalisasi Kru & Hardening Akses — PTV-DEV-149

## Hasil implementasi lanjutan Phase1 (status terbaru)

25 Oktober2026, tanpa DEV baru: enrollment administratif, login atomik, limiter PostgreSQL durable dan revocation lintas API selesai dan teruji lokal. Root bootstrap existing mendukung proof password/Google; pengaitan arsip existing diuji tanpa provisioning akun. **80 pemeriksaan SQL PostgreSQL17 sintetis PASS dan329 tests relevan/17files PASS**, typecheck/lint/build PASS. [Implementasi, batas bukti, urutan ACC152](PTVPRO-ACCESS-152-AUTH-READINESS.md) dan [prosedur privat operator](PTVPRO-ACCESS-149-ROOT-BOOTSTRAP.md). Proposal default-off, tidak cloud/akun/sesi nyata/backup/UI5/commit/push/deploy.

Phase1 tetap **PARTIAL**: ownership/pemilihan dua akun dan pemetaan personel, keputusan rekonsiliasi/status/override, ACC pemasangan SQL serta login/recovery/E2E Staging belum selesai. Bukan lagi blocker implementasi limiter/enrollment/revoke lokal; daftar sebelumnya di bawah adalah riwayat. CRUD/foto/generator surat dan integrasi managed cloud tetap perlu validasi Staging yang diotorisasi. Tidak menyimpulkan READY dari unit tests atau fixture SQL.

## Phase 1 — kelanjutan setelah DEV155, tanpa DEV baru

25 Oktober2026; operator zidnal. **PARTIAL**. Acuan: backlog asli Manajemen Kru & Akses (kategori/divisi, jabatan vs role, grouping/foto, status aktif, data generator surat, audit capability) serta kriteria keamanan/pemisahan149. Status reported lama bukan bukti implementasi. Roadmap R03 memakai Tahap A–D; tidak mengarang kontrak Phase2–4 yang belum tertulis konsisten. Phase5 Antigravity tidak diubah. DEV155 tetap PASS restore logical captured scope, tidak diuji ulang.

| Acceptance | Status berdasarkan kode/bukti |
| --- | --- |
| Kru/Pembina/Pengarah; empat divisi; angkatan | Implementasi lokal/tests tersedia; histori lama tidak diklasifikasi ulang otomatis. |
| Jabatan organisasi vs profil/capability | Terpisah pada engine/guard existing; jabatan Ketua/Koordinator/Pembina/Pengarah tidak otomatis Root/admin. |
| Grouping/foto/filter dan CRUD personel | Implementasi lokal; persistensi linked-personnel/foto dan E2E generator surat/cloud belum semuanya terbukti. Hanya kru aktif menjadi kandidat operasional, termasuk personel tanpa login. |
| Modul Kru vs Akses | /hub/kru dan /hub/akses terpisah; route akses dijaga crew.permissions.manage, default/allow/deny existing dipertahankan, Root tidak ditawarkan editor biasa. |
| Hubungan personel↔akun | **Bug lokal diperbaiki:** canonical identity tidak lagi berarti akun aktif. GET memakai user_account.identity_id/status_akun; missing→Belum Ada Akun, inactive→Nonaktif; duplicate/invalid/error gagal tertutup. Edit linked-personnel mempertahankan status dari pembacaan sebelum RPC, tanpa post-commit lookup. Tidak membuat/link akun. |
| Autentikasi/sesi | **Bug lokal diperbaiki:** endpoint session menerima SUPABASE_URL server bila VITE_SUPABASE_URL kosong, konsisten resolver existing; URL konflik/salah tetap ditolak, target Staging exact. Cookie tidak ditimpa/dihapus. Password live tetap guard-closed. |
| Root/recovery dan hak akses database | Bukti lokal149–154 dan restore155 tersedia; tidak membuktikan ownership, linking, dua login recovery, penerapan SQL atau E2E Staging. |

**Sisa blocker nyata:** (1) baseline rekonsiliasi149:91 arsip VERIFIED provenance/1 UNMATCHED/2 DUPLICATE dan2 akun existing belum cocok; provenance bukan kepemilikan. Target canonical/membership, status/override Legacy dan alias duplikat belum disetujui; (2) belum ada bukti penerapan149 prep/Access152 dan RPC mutasi di Staging; baseline153/snapshot155 masih versi lama, tidak diperiksa cloud ulang; (3) enrollment/lifecycle login atomik, limiter durable dengan kebijakan yang disetujui, pencabutan cookie per sesi dan recovery independen belum selesai. Jangan menyebut semua blocker hanya menunggu ACC atau menghapus guard untuk menutupinya.

**Satu tindakan operator berikut:** verifikasi dan tetapkan secara privat dua kandidat akun existing untuk owner utama dan recovery independen beserta pemetaan personelnya, tanpa bootstrap/linking/aktivasi. Nama/email/jabatan saja tidak cukup. Keputusan kandidat bukan ACC aktivasi dan tidak menggantikan implementasi auth serta rehearsal backend yang masih wajib.

Bukti:4files/141 tests regresi akhir PASS +26 tests Kru/service pada source yang sama PASS =167 kasus unik/6files,12 baru; typecheck/lint/build PASS20.78s. Warning chunk/SSR/relative URL fixture existing bukan bukti cloud. Tidak mengulang full suite, SQL149–154 atau restore155. Source hanya api/kru.ts, api/auth/session.ts, kruMapper.ts dan dua test files existing; tanpa UI/Guidebook/Finance/proposal/schema, cloud, akun nyata, sesi aktif, backup, commit/push/deploy. Hygiene CLN-165-P1. Bagian di bawah tetap riwayat149.

> Lanjutan remediasi lokal 24 Oktober 2026: lihat [PTVPRO-ACCESS-149-REMEDIATION.md](PTVPRO-ACCESS-149-REMEDIATION.md), bundle proposal satu transaksi, dan antrean rekonsiliasi. Temuan/bukti di bawah adalah catatan tahap awal. Tidak ada SQL/cloud dijalankan pada tahap remediasi. NO-GO belum dicabut.

Tanggal: 24 Oktober 2026. Operator: zidnal. Target RC: 29 Oktober 2026.

**Status keseluruhan: PARTIAL. Penulisan Manajemen Akses: BLOCKED sampai ACC database.** Tidak ada commit, push, deploy, akses Supabase Legacy/Production, DDL/RLS/migrasi cloud, atau perubahan data penting Staging dalam sesi ini. Scope Finance 148 tetap memiliki blocker ledger; perubahan Finance sesi ini hanya sumber direktori kru.

## Arsitektur aktual dan hasil audit

- Runtime utama menggunakan Vercel cookie session dan API server-side service_role ke Staging `swadgljnyelsjstqqxbm`. Nomor port bukan penentu backend. Runtime 5174 diverifikasi mode staging pada pembukaan rangkaian kerja; browser lokal memuat rute Kru dan navigasi Akses saat sesi ini.
- Data personel: `legacy_archive_kru`, terpisah dari `canonical_identity`, `organization_membership`, `user_account`, `account_profiles`, `profile_capabilities`, `account_capability_overrides`. Tidak ada asumsi kolom `category`: kategori baru disimpan pada `metadata_json.category`, dengan inferensi legacy untuk histori yang belum memiliki kategori eksplisit.
- Lima profil database aktual tetap dipertahankan: root_executive, eksekutif, kepolo_kepali, crew, pembina. Tidak membuat profil, capability, atau hierarki baru.
- Registry aktual: `capability_registry`; daftar profil: `access_profile`; audit existing: `auth_audit_log`. FK actor_id dan granted_by mengarah ke canonical_identity, bukan user_account; proposal sudah mengikuti FK aktual.
- Snapshot read-only: 94 baris personel, satu kelompok ID PTV duplikat, 0 archive canonical_identity_id terhubung, 0 kecocokan archive ptv_id ke canonical identity, 2 akun, 2 assignment profil, 0 override. Tidak dihapus atau direkonsiliasi otomatis.
- Divisi database historis: technical, editor, layouter, creative, engagements. Empat pilihan personel aktif: Editor, Layouter, Technical, Engagement. Creative tetap dapat dibaca sebagai histori; proposal memetakan Engagement ke ID existing engagements.

## Fitur dan pemisahan modul

| Bagian | Hasil | Tingkat bukti |
| --- | --- | --- |
| `/hub/kru` | Direktori/filter/detail serta tambah/edit/nonaktif personel, tanpa form password/profil akses/status login/OAuth. | Implementasi lokal + tests; baca halaman Staging sempat terlihat. CRUD cloud setelah perubahan belum diuji. |
| `/hub/akses` | Rute dan navigasi terpisah, guard `crew.permissions.manage`; cari akun, status, profil, default/allow/deny, ringkasan, alasan, konfirmasi, history audit jika diizinkan. | Implementasi lokal; heading/navigasi browser terlihat. Mutasi cloud belum aktif. |
| `/api/kru` | Live authorization dari DB; capability terpisah crew.view/create/edit/status.manage; tidak ada bypass berdasarkan nama profil/jabatan cookie. | 35 regression test baru termasuk API mock; bukan bukti CRUD cloud. |
| `/api/akses` | GET membaca akun/profil/override/registry aktual. POST memvalidasi self-account/self-identity, Root, versi, katalog, konflik, alasan/konfirmasi dan memakai RPC atomik. | Mock endpoint; missing RPC menghasilkan 503, tidak sukses lokal. |
| Editor akses existing | ManagePermissionsModal dipakai ulang; error/save/loading ditangani; profil tambahan tidak dihapus saat profil utama diubah. Root tidak ditawarkan. | Typecheck/render/unit. Mobile visual belum terverifikasi. |
| Status akun & sesi | `/api/auth/session` memuat identitas/status/grant/override live, tanpa memulihkan grant dari static frontend defaults. | Unit/mock; hydration multi-peran browser belum E2E. |
| Akun baru/kredensial | Tidak membuat akun otomatis dari tambah personel, tidak menawarkan password simulasi/tautan OAuth palsu. Pengikatan identitas dan provisioning akun baru masih perlu workflow yang disetujui. | Partial; dua akun existing dapat dibaca. |

## Perbaikan keamanan lokal

1. `api/auth/_utils/liveAccess.ts` menjadi resolver live yang dipakai API Kru, API Akses, dan endpoint session. Memeriksa akun aktif, cutoff sesi, identitas canonical, satu membership current ptv_studio, status organisasi, grants DB dan deny/allow. Cookie hanya sumber account_id dan waktu sesi terverifikasi, bukan otoritas capability.
2. Frontend tetap memakai permission engine existing. Marker `capabilities_verified_live` mencegah profil statis menghidupkan kembali capability yang sudah dicabut database; deny dan status tetap diperiksa lebih dahulu.
3. Fallback signing secret publik di handler auth/API dihapus; verifier menolak secret kosong dan signer tidak menerbitkan sesi tanpa konfigurasi. Nilai signing di konfigurasi Vitest hanya fixture unit test, tidak masuk konfigurasi runtime aplikasi.
4. Pemeriksaan akun bersama sekarang memeriksa tokens_valid_after terhadap session.iat; pemanggil API dan Google status/unlink mengirim iat. Pengecualian ID berpola acc-* dan default unknown-account aktif di development dihapus. Test harness unit dipisahkan dari network/credential nyata pada test terkait.
5. API personel menolak payload akun/role/password/OAuth/override; alias status/divisi/jabatan dinormalisasi sebelum otorisasi agar tidak menjadi bypass. Izin mengelola status tidak memberikan hak edit profil. PATCH membutuhkan versi personel; conditional update mendeteksi konflik HTTP 409.
6. ID PTV existing tidak dapat diganti melalui edit. Pencarian non-UUID memakai eq terarah, identifier tidak valid ditolak, duplikat ambigu tidak ditulis. Source key create deterministik per ID PTV memanfaatkan UNIQUE existing untuk dua request create bersamaan melalui jalur ini. Bukan pengganti unique constraint ptv_id lintas semua penulis.
7. Origin lintas-host ditolak untuk API Kru/Akses. Endpoint sensitif memakai Cache-Control no-store dan timeout. Error kategori/validasi dan save gagal tidak menjadi pesan sukses.
8. KruService tidak lagi fallback ke fixtures/direct Supabase setelah kegagalan API. Store mulai kosong dan tidak menampilkan snapshot lama ketika load gagal; mutasi store lokal lama dibatasi mode test. Riwayat relasi dummy pada detail tidak lagi ditampilkan seolah data backend.

## Integrasi lintas modul

- **Acara:** getActiveCrewCandidates lewat API Kru → predicate isOperationalCrew. Kru aktif kategori Kru tetap kandidat meskipun jabatan Ketua/Koordinator; Pembina/Pengarah/nonaktif dikecualikan. Fixture fallback di service dihapus. Histori penugasan existing tidak dihapus.
- **Surat Tugas:** jalur Acara tetap menyuplai kru bertugas; referensi ID historis dipertahankan. Tests Acara/Surat lulus lokal. Belum penerbitan surat cloud E2E.
- **Inventaris/Peminjaman:** tidak mengganti relasi atau ledger. Loan API masih memakai RPC server-only untuk baca/mutasi; pemeriksaan cutoff sesi bersama diperkuat. Pengujian penugasan/ownership/divisi lintas peran terhadap cloud belum lengkap.
- **Finance:** KasKruView dan pilihan peminjam internal memakai crewStore yang diisi backend; kru nonaktif tidak menjadi pilihan operasional. Data pembayaran/piutang dan blocker ledger sesi 148 tidak diubah/diselesaikan oleh perubahan ini.
- **Notifikasi:** assignment tetap memakai crew_ptv_id dan idempotency key existing. Tidak mengirim notifikasi uji; delivery cloud belum diuji.
- **ID Digital:** tidak lagi fallback ke PTV-001/orang pertama jika identitas login tidak ditemukan; menampilkan status identitas belum tersedia.
- **Detail personel:** tautan ke modul terkait menggantikan riwayat relasi mock. Penyajian riwayat relasi per-personel dari backend belum diimplementasikan; data historisnya tidak disentuh.

## Temuan database / risiko yang belum ditutup

### A149-01 — Mutasi akses atomik belum tersedia (blocker)

`rpc_manage_account_access` dan `rpc_update_crew_personnel` belum ada pada Staging. Penulisan akses dan edit personel linked diblokir dengan error eksplisit. Tidak menjalankan multi-query update profil/override/status secara parsial. Provisioning akun dan linking identitas juga belum selesai.

Proposal `PTVPRO-ACCESS-149-PROPOSAL.sql` menyediakan private server-only authorizer + RPC wrappers, global advisory lock yang sama, reotorisasi di dalam lock, validasi self/account/identity, Root protection, stale version, konflik/registry, batas delegasi terhadap capability aktor, last-admin check, revocation cutoff, dan audit atomik. Sync personel memperbarui archive/canonical/membership tanpa mengubah role sistem. Tidak ada penghapusan personel/transaksi/riwayat audit; penggantian konfigurasi profil/override dicatat before/after.

**Belum dieksekusi atau diuji SQL/concurrency nyata.** Perlu review operator, snapshot, ACC, lalu uji rollback dua pengguna sebelum dapat disebut siap.

### A149-02 — `has_capability` mempercayai klaim identity/status (risiko tinggi, bersyarat)

Definisi aktual mengambil account_id/status_akun/status_organisasi dari top-level JWT. Jika account_id ada, query live status/auth_user_id/cutoff dilewati. Simulasi SQL dengan role authenticated dan klaim account_id milik akun lain plus sub acak menghasilkan true untuk crew.permissions.manage.

**Batas bukti:** SET LOCAL request.jwt.claims dilakukan sebagai koneksi SQL administratif dalam transaksi rollback; ini membuktikan fungsi mempercayai klaim yang tidak diikat, bukan bahwa pengguna publik dapat memalsukan token bertanda tangan. Klaim stale setelah deactivation/revocation tetap perlu ditutup agar native RLS/RPC aman.

`PTVPRO-ACCESS-149-RLS-PROPOSAL.sql` selalu mengikat auth.uid() ke user_account dan membership/database grants/status/cutoff aktual. Tidak menambah SELECT/INSERT policy atau privilege baru. **Revisi remediasi:** rollback sekarang mempertahankan helper aman, tidak lagi memulihkan definisi awal yang rentan. Owner/grant/policy serta recovery data harus mengikuti manifest dan runbook remediasi; memerlukan keputusan operator sebelum penerapan.

### A149-03 — Coverage otorisasi lintas modul belum tuntas

API Kru/Akses memakai resolver live baru. Beberapa endpoint lain masih memiliki gate berbasis session capabilities/profile names; cutoff kini diperiksa, tetapi perubahan grants langsung di database di luar RPC yang memperbarui cutoff belum dijamin mengakhiri seluruh otoritas cookie lama. Nama profil privileged juga masih dipakai pada sebagian gate modul lain. Pengujian ownership/assignment/division cloud multi-peran belum dilaksanakan. Jangan mengklaim zero known high security issues atau kesiapan seluruh Hub dari suite unit ini.

### A149-04 — Kualitas relasi dan UI belum lengkap

Satu ID PTV duplikat dan seluruh archive belum terhubung ke canonical identity; tidak diperbaiki otomatis. Drawer belum memiliki riwayat relasi backend per-personel. Desktop/mobile/dark mode interaktif belum selesai karena koneksi browser terputus. Direktori dan histori lama tetap tersedia. Tidak ada penghapusan data untuk memaksakan test lulus.

## Bukti pengujian

- Suite penuh terakhir sebelum regression tambahan final: **117 files, 1255/1255 tests lulus**. Setelah penambahan guard respons RPC, regression akhir: 52/52 (4 files) dan store/ID/directori 38/38 (3 files); test baru accessHardening149 berisi 35 tests. Semua mock/unit/static render, bukan cloud E2E.
- Typecheck, lint, build lulus pada pemeriksaan akhir yang dicatat di handoff. Build masih memiliki warning bundle >500kB; tidak diatasi di luar scope.
- Staging read-only catalog: profiles/capabilities/FK/policies/GRANT diverifikasi; kedua RPC baru benar-benar tidak ada.
- Uji role anon: akun/profil/override/personel masing-masing 0 baris terlihat.
- Uji role authenticated tanpa identity binding: empat sumber yang sama masing-masing 0 baris terlihat.
- Simulasi has_capability dalam BEGIN/SET LOCAL ROLE/ROLLBACK menghasilkan true untuk unbound account claim; bukan bukti signed JWT forgery.
- Baseline akhir tetap 94 personel, 2 akun, 2 profil assignment, 0 override. Tidak melakukan CRUD cloud, mengubah privilege, atau notifikasi uji.
- Browser: navigasi Manajemen Akses dan heading/Muat ulang teramati; interaksi lanjutan/mobile gagal karena CDP/native pipe terputus. Tidak menyimpan screenshot berisi data pribadi; reset viewport dicoba tetapi browser sudah tidak tersedia.

## Rencana ACC dan release candidate

1. Review dua proposal SQL dan rollback; verifikasi target Staging sebelum eksekusi. Belum ada SQL yang diterapkan.
2. Selesaikan review/test lokal SQL, lalu setelah ACC uji transaksi rollback: dua manager saling mencabut akses, stale version, Root/last admin, konflik allow/deny, akun nonaktif dan sesi lama. Jangan menguji dengan mencabut seluruh admin sungguhan.
3. Rekonsiliasi identity linkage dan duplikat dengan pilihan operator; jangan menggabungkan/menghapus histori secara otomatis.
4. Audit sisa gate legacy lintas modul dan jalankan E2E multi-peran dengan sesi Staging yang sah, desktop/mobile/dark mode.
5. RC 29 Oktober tetap **PARTIAL**, bukan READY, hingga blocker di atas teratasi.

Hygiene: CLN-155. Piket: PTV-DEV-149. Working tree pengguna dan pekerjaan sesi 148 dipertahankan.
