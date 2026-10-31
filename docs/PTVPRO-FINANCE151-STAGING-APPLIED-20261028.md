# Finance151 — staging applied, maintenance retained

Target: `ptvpro-staging`, `swadgljnyelsjstqqxbm`. ACC staging existing digunakan. Production tidak disentuh.

## Bukti aktual

- Checkpoint DEV155 28 Oktober 2026 15:42 WIB: restore snapshot 107 tabel, 0 mismatch; 58 transaksi dan digest identik. Backup tidak diulang.
- Kontrol freeze baru diuji pada clone snapshot: 51 percobaan INSERT/UPDATE/DELETE tanpa baris ditolak; 17 trigger BEFORE STATEMENT mencakup INSERT/UPDATE/DELETE/TRUNCATE dengan ENABLE ALWAYS. Core DDL dan Storage berhasil saat freeze aktif; histori tetap identik.
- Migrasi hosted `20261028084942 finance151_staging_write_freeze` APPLIED. Lock SHARE ROW EXCLUSIVE pada 17 tabel menunggu writer aktif selesai sebelum pemasangan atomis. Lock timeout membatalkan pemasangan bila tidak dapat diperoleh. Uji 51 mutasi kosong melalui role service_role pada staging lulus dengan SQLSTATE 55000; tidak ada perubahan baris uji.
- Migrasi hosted `20261028085422 finance151_core_and_managed_storage` APPLIED. Core dan fase Storage digabung dalam satu transaksi; assertion sebelum COMMIT memeriksa histori dan 17 freeze trigger. Jalur postgres managed Storage digunakan tanpa mengganti ownership atau meningkatkan privilege.
- Verifikasi sesudah commit: 8 kolom tersedia, 8 RPC memiliki EXECUTE service_role dan tidak memiliki EXECUTE anon/authenticated; 0 direct-write grants service_role pada tabel Finance; 12 tabel Finance tetap RLS aktif; 2 policy Storage RESTRICTIVE tersedia; 17 freeze trigger tetap ENABLE ALWAYS.
- Ledger: 58 transaksi. Digest proyeksi kolom histori sebelum penambahan empat kolom transaksi: `b38dcc5a1079297c77106039c82d742a`, identik baseline. Tidak ada transaksi uji ditambahkan.
- HTTP aktual preview `https://ptvpro-bwfuq58ad-ptvpro-web.vercel.app/api/finance`: POST 503 FINANCE_MAINTENANCE; GET tanpa cookie 401 sesi tidak valid. Runtime lokal 127.0.0.1:5174 tidak dapat dihubungi (curl connection refused). Tidak menghentikan atau memulai runtime Antigravity.
- Clone sementara dihapus; container tersisa 0; backup tidak dihapus. Cleanup mengeluarkan error trailing CR setelah penghapusan; penghentian daemon tidak diklaim terverifikasi.

## Kontrol dan recovery

Freeze tidak memiliki pengecualian role, GUC, JWT, atau request yang dapat digunakan writer eksternal. DDL yang disetujui berjalan tanpa bypass DML. TRUNCATE tidak dijalankan untuk pengujian hosted; cakupannya diverifikasi dari bit trigger (tgtype=62).

Jika transaksi migrasi gagal sebelum commit, seluruh core dan Storage rollback bersama. Setelah commit, pertahankan freeze dan maintenance; gunakan proposal containment `PTVPRO-FINANCE-151-SAFE-ROLLBACK.sql` bila dibutuhkan, tanpa menjatuhkan kolom atau histori. Pemulihan snapshot hanya melalui prosedur recovery terkontrol.

Status database migration: PASS / APPLIED. Status pembukaan operasional: PENDING / NO-GO sampai smoke login/read pengguna berwenang pada runtime staging dapat dijalankan. Bukti E2E clone sebelumnya tetap baseline, bukan bukti login hosted setelah migrasi. Maintenance aplikasi dan database tidak dicabut. Deployment preview yang ada hanya rollout gate; tidak mengklaim kode API Finance151 working tree sudah dideploy.

Tindakan minimum berikut: sediakan runtime staging yang menjalankan kode API Finance151 dan sesi pengguna sah untuk smoke login/read/logout; pertahankan maintenance saat pengujian. Jangan membuka kembali direct table writes agar API lama berjalan.

## Follow-up authenticated smoke, 28 Oktober 2026

Runtime 5174 kembali tersedia: PID 29808 node/Vite --mode staging; middleware Vite memuat handler API working tree melalui ssrLoadModule. Konfigurasi efektif menunjuk swadgljnyelsjstqqxbm dan maintenance true. Proses existing tidak dihentikan atau diganti. Tab Chrome smoke terpisah berhasil membuka Keuangan Studio dengan sesi existing, scope Pengelola Keuangan dan data staging terbaca. Ini bukti read dengan sesi existing, bukan pengujian login baru atau logout.

HTTP tanpa cookie 401 dan POST maintenance 503 terverifikasi ulang. Ledger aktual 58, digest b38dcc5a1079297c77106039c82d742a identik. Tidak ada mutasi Finance. Browser in-app terpisah dibuka pada http://localhost:5174/hub/login untuk login operator tanpa mengganggu cookie Chrome/Antigravity. Login baru, role pengguna tanpa kewenangan, serta logout belum teruji; tidak mengekstrak cookie atau membuat token pengganti. Pembukaan operasional tetap NO-GO sementara menunggu sesi staging sah untuk rangkaian tersebut.

Urutan pelepasan setelah seluruh smoke PASS: pertahankan gate aplikasi; verifikasi semua runtime memakai API Finance151 dan grants RPC kompatibel; cabut hanya 17 trigger freeze melalui transaksi admin staging dengan lock serta assertion ledger; verifikasi RLS/grants tetap; nonaktifkan flag maintenance staging pada runtime yang telah diverifikasi; periksa read dan error aplikasi. Jangan mencabut grants/RLS atau mengaktifkan preview API lama. Jika ada kegagalan, aktifkan kembali gate dan freeze, gunakan containment yang telah disiapkan. Langkah pelepasan belum dijalankan.

Scope file sesi ini: proposal freeze dan catatan Finance ini; tidak mengubah file Antigravity, roadmap/logbook bersama, atau modul lain. Tidak melakukan cleanup massal, commit, push, reset, atau deploy aplikasi.
