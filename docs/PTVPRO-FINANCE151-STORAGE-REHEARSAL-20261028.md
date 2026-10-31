# Storage owner compatibility: actual snapshot rehearsal

28 Oktober2026, zidnal. NO-GO staging; GO terbatas untuk kontrak SQL lokal yang dibuktikan di bawah.

Kontrak managed: https://supabase.com/docs/guides/platform/permissions menetapkan owner objek storage sebagai supabase_storage_admin. Owner storage.objects pada snapshot aktual memang role tersebut. Tidak mengubah ownership, role membership, superuser atau direct-write grants agar migrasi lulus.

Revisi: blok DDL policy Storage dikeluarkan dari FINANCE-151-POLICIES.sql; generator membangun ulang core proposal. Fase FINANCE-151-STORAGE-OWNER.sql terpisah memeriksa current_user sama dengan existing table owner lalu membuat dua restrictive policy yang sama. Tidak ada kebijakan yang dihilangkan dari hasil final; pemasangan core saja bukan aktivasi lengkap. Fase Storage harus selesai dan diverifikasi sebelum writer dibuka. Urutan core postgres -> fase Storage owner sah -> verifikasi final -> keputusan aktivasi. Bila fase Storage gagal setelah core commit, pertahankan hold/writer freeze dan containment core; jangan menyatakan seluruh rangkaian satu transaksi atomik.

Hash core:30ffcc6bdc970ada7f43af7fc80bae8c7feb7cd268927e2206db4283eca81f69.
Hash Storage:e76eb7d85d31b8f708f2c603ae895bd0249b0c6cf01c5400234b28e38cdf9fd2.
Evidence sintetis/hash versi lama tidak berlaku untuk bundle baru tanpa rerun yang sesuai.

## Bukti aktual snapshot

Snapshot terbaru existing dipulihkan ke clone DEV155 network-none/tmpfs/no-swap/read-only-root/logging-none. Vault dan event-trigger baseline existing dipakai tanpa eskalasi postgres. Restore107 COPY tables,0 mismatch; comparator captured security PASS sesudah enam perbedaan urutan default ACL terbukti setara. Snapshot tidak diambil ulang.

- Trial core lalu ROLLBACK: digest ledger sama.
- Core commit pada clone PASS; owner Storage tetap supabase_storage_admin.
- Fase Storage sebagai role owner existing melalui socket trust clone PASS. Ini otorisasi lokal restore, bukan bukti tersedianya akses role managed pada hosted staging.
- 12 tabel Finance RLS aktif,0 direct service_role writers,0 anon/authenticated EXECUTE grants pada enam RPC server yang diperiksa. Dua guard Storage ditemukan dengan permissive=RESTRICTIVE.
- Delapan kontrak RPC admin dieksekusi memakai aktor manager snapshot yang lolos otorisasi live: create/update/archive pocket, create/update/archive/restore category, update metadata transaction. Semua dalam transaksi yang dirollback; tidak mencetak aktor/data pengguna. Ini uji kontrak SQL aktual, bukan HTTP/API end-to-end.
- Ledger tetap58,54 posted/4 reversed. Digest kolom histori original sesudah migrasi/uji: b38dcc5a1079297c77106039c82d742a, sama checkpoint sebelum migrasi. Kolom tambahan dikecualikan secara eksplisit agar perbandingan sesuai projection original.
- SAFE-ROLLBACK151 mencabut EXECUTE admin RPC; forward recovery core PASS pada clone. Policy Storage dipertahankan selama containment.

Belum dibuktikan pada clone aktual: pembayaran/pencairan/reversal positif dengan seluruh prasyarat personel/semester, RLS row-visibility per aktor beserta platform Auth/PostgREST/Storage E2E, dan delapan aksi melalui HTTP cookie. Tes sintetis lama bukan substitusinya.

## Blocker spesifik

1. Jalur administrasi resmi untuk memasang restrictive policy Storage pada hosted staging sebagai owner belum terverifikasi. Jangan memakai credential alternatif, GRANT managed role, ALTER OWNER atau mengasumsikan socket trust clone tersedia di hosted. Perlu verifikasi mekanisme resmi operator/provider; belum ada perintah operator yang dapat dinyatakan aman dan sah untuk hosted.
2. Pengujian operasional positif dan HTTP/platform aktual di atas belum lengkap. Tidak mengubah kategori/join-month/akun riil untuk meluluskan tes.
3. Snapshot capture tetap tidak membekukan sequence/writers dan tidak mencakup seluruh platform state; maintenance/checkpoint final tetap diperlukan.

Tidak ada staging/production mutation, resource cloud baru, commit/push/deploy atau perubahan Antigravity. Hanya proposal/dokumen Finance dan harness scratch Finance diubah. Dokumen koordinasi bersama tetap dilindungi. Hygiene: generator tetap sumber tunggal core; DDL Storage satu file owner terpisah, tanpa fallback privilege. SESSION HEALTH:85/100,Sehat,confidence Sedang; bukti clone jelas, jalur hosted belum terverifikasi.
