# Finance 149 — ACC pembatasan sementara dan recovery

25 Oktober 2026. **NO-GO aktivasi penuh.** SQL containment terpisah dari migrasi operasional lama, belum dieksekusi atau diuji PostgreSQL. Jangan menjalankan ulang migrasi lama untuk mengatasi blocker: definisinya masih memuat B01–B04. Pembatasan API lokal tidak menutup RPC yang sudah terbuka di cloud sampai perubahan disetujui dan diterapkan.

## Kelanjutan151 (25 Oktober)

Perbaikan B01–B04 kini tersedia sebagai [proposal hardening151 yang diuji 105 kasus PostgreSQL sintetis](PTVPRO-FINANCE-151-HARDENING-REVIEW.md), beserta preflight dan safe rollback. Containment149 tetap rujukan fallback pembatasan sementara; jangan menganggapnya migrasi penyelesaian atau menjalankan ulang skrip operasional lama. Belum ada perubahan cloud. Backup/restore Staging nyata dan keputusan recovery Root masih prasyarat; NO-GO eksekusi/deployment sekarang.

## Sebelum ACC

1. Verifikasi koneksi benar ke Staging `swadgljnyelsjstqqxbm`, physical system identifier, operator dan maintenance window. Legacy/Production tidak disentuh. Ganti placeholder proposal hanya berdasarkan bukti koneksi tepercaya.
2. Hentikan penulis Finance sementara. Ambil backup konsisten dengan snapshot transaksi yang sama, bukan salinan tabel satu per satu: enam tabel operasional, canonical pockets/transactions/allocations/source_references/categories/audit, serta relasi identitas terkait. Simpan backup terenkripsi di lokasi terkontrol di luar Git. Jangan mencetak data pribadi/credential ke log.
3. Simpan `pg_get_functiondef`, owner, proacl, default privileges, pg_policy/pg_policies, grants tabel/schema, role membership dan trigger yang relevan. Buat checksum artefak dan catat row counts serta ledger invariants pada snapshot yang sama. Backup bukti Storage secara terpisah beserta manifest path/checksum; dump PostgreSQL bukan backup isi bucket.
4. Restore ke clone terisolasi; buktikan dapat dibaca, bandingkan checksum/counts dan ACL. Backup belum dianggap siap sebelum restore berhasil. Backup fixture bootstrap sebelumnya tidak membuktikan restore data Finance nyata.

## Pengujian yang harus lulus sebelum aktivasi

- Root/Bendahara/Eksekutif dengan capability efektif, setiap profil lain, denied override, akun nonaktif, sesi dicabut, Pembina/Pengarah dan peminjam terkait. Direct anon/native authenticated/service-role diuji terpisah; kategori/jabatan bukan pemberian capability.
- B01: aggregate tidak dapat dibaca publik; peminjam tidak melihat detail milik orang lain termasuk deskripsi/source reference canonical.
- B02: kru sintetis/nonaktif, periode di luar semester, periode ganda, nominal/command berbeda ditolak. Tarif diambil dari semester; cicilan parsial tersimpan di kas_payments, status berdasarkan akumulasi pembayaran. Pembebasan tidak menghapus nominal/histori yang sudah dibayar.
- B03: tidak ada DELETE cicilan saat reversal. Pembalikan satu transaksi bersama memperbarui seluruh record terkait tepat sekali; seluruh pocket dikunci dengan urutan konsisten. Audit gagal harus membatalkan seluruh perubahan.
- B04: replay pelunasan memakai payload yang sama mengembalikan hasil lama sebelum pemeriksaan lunas; key sama/payload berbeda ditolak. Dua pembayaran bersamaan tidak melebihi kewajiban.
- Saldo negatif ditolak sesuai aturan existing; dua pengeluaran bersamaan tidak melewati saldo. Injeksi gagal setelah debit transfer membatalkan debit/kredit/audit sekaligus. Ledger net-zero untuk transfer.
- Peralihan semester satu transaksi, tarif/join-month dan pembebasan konsisten; QRIS belum dianggap cair sebelum konfirmasi manual. Reimburse belum mempunyai implementasi operasional terverifikasi.
- Metadata pocket/kategori/transaksi dan audit harus atomik; CAS lokal pocket belum menggantikan RPC audit atomik. Unggah bukti dengan sesi cookie, batas MIME/size/path, otorisasi signed URL dan refresh URL diuji nyata.
- Laporan harus memuat seluruh halaman transaksi dan sumber kewajiban backend, konsisten dengan ledger; PDF/XLSX tidak memakai storage browser. Daftar canonical saat ini masih maksimal 100 dan diberi penanda terbatas.

Uji transaksi di clone atau BEGIN/ROLLBACK dengan fixture terisolasi setelah ACC. Uji concurrency memakai dua koneksi clone; jangan membuat transaksi keuangan permanen di Staging untuk tes. Bukti unit/mock tidak menggantikan pemeriksaan ini.

## Rollback dan pemulihan aman

- Jika pemasangan gagal sebelum COMMIT: `ROLLBACK`; verifikasi tidak ada perubahan ACL parsial. Proposal berisi satu transaksi.
- Sesudah containment commit: jangan mengembalikan EXECUTE publik atau direct DML yang membuka B01–B04. Pertahankan mode baca dan halaman penahanan. Tidak ada rollback otomatis berupa GRANT izin lama yang tidak aman.
- Jika perubahan berikutnya merusak data: hentikan penulis, restore snapshot ke clone baru, rekonsiliasi perubahan sah sejak snapshot dengan audit/ledger dan operator, lalu rencanakan recovery terkontrol. Jangan menimpa Staging langsung dari backup lama atau menghapus transaksi baru.
- Pulihkan definisi/policy/owner/grant yang telah direview aman, bukan membabi buta memulihkan ACL rentan. Buka EXECUTE hanya ke role yang diperlukan setelah pengujian otorisasi dan replay lulus. Recovery membutuhkan ACC baru dengan hash artefak; operasi Root/linking tetap mengikuti prosedur 149 tersendiri.
- Pascamigrasi: pastikan row counts/histori tidak berkurang, orphan/duplikat tidak bertambah, alokasi seimbang, saldo cocok snapshot plus perubahan sah, audit lengkap, grant efektif tertutup dan kedua administrator dapat login. Jika gagal, tetap NO-GO.
