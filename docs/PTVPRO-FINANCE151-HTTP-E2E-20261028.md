# Finance151 HTTP E2E: actual snapshot clone

28 Oktober2026,operator zidnal. GO khusus kesiapan pengajuan penerapan Finance151 staging; bukan izin menerapkan SQL atau mengaktifkan seluruh fitur operasional. Tidak ada hosted staging/production mutation atau resource cloud baru.

## Runtime dan isolasi

Clone berasal dari snapshot terbaru existing, dipulihkan memakai consumer yang telah diverifikasi.107 COPY tables dibandingkan tanpa mismatch; captured security comparator PASS setelah default ACL ordering terbukti setara. Runtime PostgreSQL memakai tmpfs,no swap,root read-only,logging none. Jaringan Docker baru finance151-e2e-internal bertanda Internal=true; database tidak mempublikasikan port. PostgREST resmi v16.5 dipin ke digest sha256:1347d7552b88f17832912c06afbf7c43209af6eeeb60834b04aae12c9bd9d5cc. Tidak membuat layanan cloud.

Windows tidak dapat mengakses port PostgREST pada internal network. Harness memakai proxy loopback127.0.0.1:55441 yang meneruskan HTTP nyata melalui curl di container DB ke PostgREST internal. Ini bukan mock Data API/query adapter. Aplikasi HTTP127.0.0.1:55443 menjalankan handler login,Finance dan logout asli melalui Vite SSR configFile=false; tidak memuat env staging. Semua target upstream tetap, tanpa redirect eksternal. Container Data API juga read-only/logging none; credential test,JWT backend dan AUTH_SECRET dibuat acak di RAM dan tidak dicetak/ditulis ke file.

Baseline authenticator clone awalnya tidak mempunyai membership SET role yang dibutuhkan Data API. Query read-only spesifik hosted mengonfirmasi authenticator -> anon/authenticated/service_role dengan SET TRUE,INHERIT FALSE. Hanya tiga membership exact-equivalent tersebut direkonstruksi pada clone memakai admin restore existing, tanpa mengubah grants hosted atau membuat role pengguna menjadi service_role. Password koneksi authenticator clone diganti credential fixture SCRAM; host rule dibatasi database,role dan IP container Data API tunggal. User fixture tetap memakai login password dan cookie portal normal; server memakai service JWT lokal hanya untuk boundary RPC backend existing, bukan sebagai sesi pengguna.

## Perubahan kode minimum

api/auth/_utils/financeLocalHarness.ts menyatukan validasi endpoint: hosted allowlist tetap swadgljnyelsjstqqxbm; override hanya PTV_FINANCE_LOCAL_E2E=true,NODE_ENV=test,tanpa VERCEL/VERCEL_ENV,URL persis http://127.0.0.1:55441. Hostname/port/protokol/trailing slash lain ditolak. api/finance.ts dan lifecycleClient memakai helper ini. Tidak mengganti verifier token,resolveLiveAccess,registry sesi,capability/RLS atau handler login. File Antigravity/shared shell tidak diubah.

## Bukti HTTP aktual

Fixture baru pengelola dan kru dibuat hanya pada clone, dengan bcrypt cost10 dan password acak RAM. Tidak membaca password/hash pengguna snapshot. Kebijakan login normal diaktifkan hanya pada clone. Login diproses melalui rpc_portal_login_begin,verifier bcrypt aplikasi,resolveLiveAccess,rpc_portal_login_finish,registrasi fingerprint dan cookie HttpOnly aplikasi. Tidak menandatangani cookie manual dalam harness.

| Request | Hasil aktual / assertion |
| --- | --- |
| POST /api/auth/login pengelola |200;cookie aplikasi diterbitkan;begin/finish RPC200 |
| POST /api/auth/login kru |200;cookie aplikasi diterbitkan;begin/finish RPC200 |
| POST /api/finance create_category,pengelola |200;validasi registry sesi200;RPC admin200 |
| Verifikasi tabel kategori sesudah write |0 baris kategori uji;PostgREST Prefer tx=rollback efektif |
| POST /api/finance create_category,kru |403;tidak menjalankan RPC admin untuk mutasi |
| GET /api/finance,kru |200,scope own;kas fixture kru ada,kas fixture pengelola tidak ada |
| GET tanpa cookie |401 |
| GET cookie invalid |401 |
| DELETE /api/finance |405 |
| POST /api/auth/logout,pengelola |200;rpc_portal_session_revoke200 |
| GET dengan cookie sah yang sudah dicabut |403;registry sesi ditolak |

Data API mengcommit operasi registry login normal agar sesi benar-benar valid. Mutasi Finance yang diuji memakai opsi transaksi rollback resmi PostgREST melalui proxy test; tidak menonaktifkan RLS. Fixture auth/kas setup hanya pada clone yang dibuang saat cleanup. Tidak mengklaim persistence commit dari uji rollback.

Digest seluruh58 histori original tetap b38dcc5a1079297c77106039c82d742a. Pembuktian membandingkan proyeksi kolom sebelum empat kolom additive Finance151; jumlah58 tetap. Uji SQL delapan aksi,operasional positif,idempotency,audit-failure rollback,containment dan forward recovery actual-snapshot sebelumnya tetap bukti terpisah; HTTP kali ini menguji satu aksi tulis representatif dan own-scope, bukan mengulang delapan aksi HTTP atau seluruh platform Supabase.

## Validasi kode dan keputusan

Typecheck PASS; lint targeted API/auth helper PASS;83/83 regresi lokal PASS dalam empat suite:financeLocalHarness9,financeAdminRpc11,financeFoundation31,portalLifecycle32. Regresi mencakup override production/development,hosted Vercel,endpoint selain loopback exact dan allowlist hosted existing. Bukti E2E di atas berasal dari request HTTP dan PostgreSQL nyata pada clone,bukan83 tes mock tersebut.

Tiga blocker terakhir ditutup pada scope:delegasi admin Storage hosted terverifikasi read-only;operasional positif actual clone PASS;HTTP dengan cookie normal allowed/denied/ownership/revocation PASS. Fase Storage tetap dijalankan oleh postgres dengan delegasi managed existing sesuai dokumentasi resmi,https://supabase.com/kb/troubleshooting/revoking-privileges-on-storage-pg_cron-vault-and-extension-objects-has-no-effect. Tidak meminta role managed/credential alternatif atau ownership change.

Checklist penerapan terpisah:pin core30ffcc6bdc970ada7f43af7fc80bae8c7feb7cd268927e2206db4283eca81f69 dan Storage69935ab4d2477b92630a01834c7c74332f8660bf3c604153aa9bc5ade55a7f9f;tetapkan maintenance/writer freeze/checkpoint snapshot terkini;verifikasi delegasi Storage dan dependency admin;core lalu fase Storage lalu pemeriksaan final;rollback sebelum commit atau containment/forward setelah commit. Persetujuan operator final tetap diperlukan. Snapshot capture belum atomic atas sequence/writer/platform state;hal itu wajib ditangani saat maintenance, bukan disimpulkan dari PASS clone.

Status GO untuk pengajuan migrasi yang direview pada hash tersebut. Bukan GO production,deployment,CRUD hosted atau pengaktifan UI operasional yang masih ditahan. Tidak menjalankan commit/push/deploy. Dokumen bersama roadmap/piketdev/cleanings dilindungi oleh batas paralel;catatan ini menjadi handoff Finance sementara. Hygiene terarah:validasi hostname direuse,tidak ada fallback auth atau writer paralel. SESSION HEALTH:82/100,Sehat,confidence Sedang;milestone E2E selesai dan bukti dipisahkan;scope baru sebaiknya sesi baru setelah persetujuan penerapan.
