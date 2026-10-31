# Finance151: tiga blocker lanjutan

28 Oktober2026,zidnal. Keputusan NO-GO penerapan; dua blocker ditutup pada lingkup bukti berikut, satu blocker HTTP sah masih terbuka. Tidak ada migrasi/mutasi staging/production, resource cloud baru atau perubahan Antigravity.

## Jalur Storage hosted: terverifikasi read-only

Dokumentasi resmi Supabase menyatakan postgres dapat create/change/drop policy Storage tanpa menjadi owner: https://supabase.com/kb/troubleshooting/revoking-privileges-on-storage-pg_cron-vault-and-extension-objects-has-no-effect bagian Limit access to Storage tables. Implementasi resmi supautils mendokumentasikan policy_grants: https://github.com/supabase/supautils.

Query read-only spesifik pada staging menunjukkan current_user postgres, owner storage.objects supabase_storage_admin, serta existing supautils.policy_grants mencakup postgres -> storage.objects. Artinya jalur resmi adalah SQL Editor/direct admin postgres existing dengan delegasi managed, bukan login managed owner, GRANT role atau ALTER OWNER. Clone restore tidak memuat seluruh konfigurasi GUC platform; itulah penyebab asumsi bahwa hosted postgres tidak berwenang pada laporan sebelumnya terlalu luas.

STORAGE-OWNER.sql direvisi agar menerima existing owner atau postgres; CREATE POLICY tetap menegakkan permission riil. Script tidak memasang delegasi/grant sendiri. Hash baru69935ab4d2477b92630a01834c7c74332f8660bf3c604153aa9bc5ade55a7f9f. Tidak menjalankan DDL probe pada hosted. Ketersediaan delegasi terverifikasi; keberhasilan DDL hosted baru dapat dibuktikan setelah izin penerapan.

## Positif operasional: PASS pada actual snapshot clone

Snapshot existing terbaru dipulihkan ke clone network-none,tmpfs,no swap,read-only root,logging none. Restore ulang diperlukan karena clone sebelumnya dibersihkan; tidak mengambil backup baru.107 COPY tables,0 mismatch,comparator captured security PASS. Core/Storage/containment/forward setup existing dijalankan untuk menyiapkan uji lanjutan.

Harness scratch finance151-operational-actual.sql memakai aktor manager existing yang lolos authorize live dan fixture baru personel/semester/kantong/kategori khusus clone. Tidak mengganti kategori/bulan masuk atau capability personel riil. Fixture memakai schema/constraints nyata, bukan database sintetis kosong; seluruh setup dan mutasi diakhiri ROLLBACK.

PASS:kas100 dari tarif1000 berstatus sebagian; replay tidak menambah transaksi; void mempertahankan kas payment reversed. Pencairan500 membuat piutang; replay tidak menambah transaksi. Pembayaran500 melunasi; replay diterima; reversal mengembalikan remaining500 dan histori cicilan tetap reversed. Replay reversal tidak mengubah saldo lagi. Audit trigger fault pada pembayaran membatalkan ledger,saldo dan piutang bersama. Reversal operasional pencairan memberi status dibatalkan. Setelah ROLLBACK,58 transaksi original dan digest b38dcc5a1079297c77106039c82d742a tetap utuh.

Ini uji RPC PostgreSQL langsung pada actual-snapshot clone dengan fixture berlabel, bukan HTTP atau transaksi cloud. Tidak mengklaim semua concurrency/platform behavior lulus dari satu harness ini.

## HTTP: parsial, blocker tetap terbuka

HTTP aktual localhost5174/api/finance:tanpa cookie401,cookie invalid401,DELETE405. Penolakan terjadi sebelum DB query; tidak melakukan operasi tulis hosted.

Cookie sah untuk allowed/denied belum diuji end-to-end pada clone. api/finance.ts dan api/auth/_utils/portalLifecycle.ts.lifecycleClient mengunci hostname Supabase staging; mengganti env ke clone ditolak. Clone hanya menyediakan PostgreSQL unix socket, tanpa PostgREST/login/session HTTP. Cookie dibuat manual tidak menggantikan login sah. Menjalankan allowed writes melalui runtime5174 saat ini akan mengarah ke staging asli dan dilarang.

Kebutuhan minimum:scope tambahan untuk runtime pengujian auth bersama (portalLifecycle berada di luar Finance) dan endpoint Data API lokal yang terisolasi, dengan fail-closed binding ke clone serta login yang menerbitkan sesi/cookie normal. Gunakan akun fixture clone dengan credential uji yang dibuat lokal dan tidak dicetak, bukan credential pengguna nyata. Tidak boleh menghapus production/staging host guard secara umum atau membuka akses shared auth tanpa scope. Setelah tersedia:login sah -> aksi allowed200; aktor tanpa capability403; logout/revocation/invalid401; verifikasi database clone dan digest original. Tidak diperlukan credential hosted tambahan atau capture ulang.

GO hanya untuk bukti Storage delegation dan RPC operasional clone di atas. NO-GO final sampai HTTP sah allowed/denied dan pengikatan runtime clone teruji. Maintenance/checkpoint final,writer freeze dan persetujuan penerapan terpisah tetap berlaku.

Hygiene:tidak ada pembersihan massal; hanya guard fase Storage dan laporan/harness Finance berubah. Dokumen koordinasi bersama tetap dilindungi. SESSION HEALTH:84/100,Sehat,confidence Sedang; scope shared auth memerlukan keputusan eksplisit sebelum perluasan.
