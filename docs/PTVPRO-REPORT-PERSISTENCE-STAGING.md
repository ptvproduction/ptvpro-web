# Persistensi laporan Staging — PTV-DEV-106

ACC zidnal pada 20 Oktober 2026 mencakup backend/RLS minimal kedua laporan dan uji tulis tiga alur; tidak mencakup Production, autentikasi, struktur RBAC, deployment atau penghapusan record uji.

Target terverifikasi melalui connector: ptvpro-staging, swadgljnyelsjstqqxbm, host db.swadgljnyelsjstqqxbm.supabase.co. Sebelum patch: dua tabel memakai RLS tanpa policy, canonical ketiga modul kosong; arsip historis dipertahankan.

Desain patch: satu kolom JSONB report_metadata per tabel untuk identitas pembuat, fingerprint idempotensi dan field formulir yang belum memiliki kolom; tidak memindahkan data historis. SELECT authenticated memakai lostfound.view/damage.view. Tidak ada akses anon atau direct INSERT/UPDATE/DELETE authenticated. RPC public SECURITY INVOKER meneruskan ke fungsi di schema privat yang memeriksa auth.uid(), akun aktif, keanggotaan studio aktif tunggal, dan capability existing. Lost & Found create: lostfound.report; update/delete: lostfound.manage. Kerusakan create: damage.report; QC/delete: damage.qc.approve. Tidak menambah profil, capability, override, atau mengubah autentikasi.

Fungsi privat membutuhkan SECURITY DEFINER khusus untuk transaksi laporan dan perubahan kondisi unit; tidak memberikan inventory.update kepada pelapor. Unit dikunci, relasi inventaris diverifikasi, dan status peminjaman aktif/hilang tidak ditimpa. QC selesai tidak memulihkan unit bila masih ada laporan aktif lainnya. Record historis di arsip tidak dapat ditargetkan.

Migration connector: report_persistence_staging. SQL tersimpan pada riwayat migrasi Supabase; CLI Supabase tidak tersedia lokal dan tidak diinstal. Tidak ada file migration bernama timestamp buatan dibuat. Hasil penerapan dan ID uji dicatat setelah verifikasi.
