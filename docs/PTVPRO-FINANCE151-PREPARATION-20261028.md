# Review persiapan Finance151 staging

28 Oktober 2026. Operator zidnal. Status: NO-GO penerapan; tidak ada SQL mutasi dijalankan. Scope hanya persiapan Finance151. Dokumen bersama Antigravity PTV-DEV-186 tidak diedit.

## Artefak dan dependensi

Proposal: PTVPRO-FINANCE-151-STAGING-PROPOSAL.sql, SHA256 2d94be1365298ccc8579e7c9dc9f04da10e9a0b0e5a3766e68ca6286717bc426. Hash cocok dengan evidence DEV154 yang mencatat 133 pemeriksaan PostgreSQL sintetis. Pemeriksaan tersebut tidak dijalankan ulang dalam review ini.

Proposal menggabungkan core posting, hardening source dan policies. Urutan dependency yang didokumentasikan: preparation Access149, Access152, Finance151 revisi154; jangan replay bundle149 setelah152. Scope sesi ini tidak mengizinkan perubahan Access. Verifikasi katalog staging menunjukkan 0 pasangan role/tabel dari 27 kombinasi sembilan tabel akses dan anon/authenticated/service_role mempunyai privilege tulis yang diperiksa. Ini memenuhi guard privilege tersebut saja, bukan bukti seluruh Access149/152 sudah ekuivalen.

Private authorize/post_transaction/disburse_loan_atomic/record_kas_kru_payment_atomic/record_loan_payment_atomic/reverse_operational_record_atomic/void_finance_transaction tersedia dengan owner postgres. Public post_transaction dan void tersedia. Scope pembacaan dan empat wrapper operasional belum tersedia. Proposal memasang helper personnel_category, can_account, native_account, owns_finance, visible_transaction, operational_command/replay dan reversal bersama. Wrapper server memakai account_id/iat dan otorisasi live; public EXECUTE dibatasi signature ke service_role. Native memeriksa auth.uid, session_id, exp/iat dan auth.sessions.not_after. Owner postgres memiliki SELECT auth.sessions saat diperiksa.

## Perubahan database yang diusulkan

- Delapan kolom belum ada dan akan ditambahkan: transactions.operational_envelope/reversal_reason/reversed_at/reversed_by serta loan_payments.status/reversal_reason/reversed_at/reversed_by.
- Tidak ada backfill klasifikasi histori atau perbaikan saldo otomatis. Guard histori menghentikan migrasi jika cicilan tidak konsisten.
- RLS SELECT dan restrictive guards diterapkan pada 12 tabel Finance; direct DML dicabut termasuk dari service_role. Mutasi harus melalui RPC definer terotorisasi. Audit menolak perubahan/penghapusan dan truncate. Storage.objects mendapat guard khusus finance-proofs; bytes Storage tidak dicadangkan oleh SQL.
- Mutasi memakai advisory lock 151/1 dan lock kantong terurut. SHARE lock pada tabel identitas/izin dapat menahan penulis administratif. Jendela maintenance dan pemantauan timeout diperlukan.
- Histori tanpa operational_envelope tetap manager-only. Kategori personel harus terverifikasi; kas memerlukan finance_join_month dari bukti. Proposal tidak mengisinya otomatis.

## Integritas staging yang diperiksa langsung

Project swadgljnyelsjstqqxbm. Sebanyak 58 transaksi: 54 posted dan 4 reversed. Tiga kantong memiliki balance_minor 0, 52027600, 0. Tidak ada orphan allocations, duplicate allocations, duplicate idempotency atau saldo kantong negatif. Pemeriksaan paid total Kas dan Piutang menghasilkan 0 selisih; tabel kewajiban/piutang kosong sehingga hasil ini tidak membuktikan alur cicilan operasional.

Digest ledger saat review: b38dcc5a1079297c77106039c82d742a (MD5 agregasi JSONB berurut id). Ini checkpoint read-only, bukan backup konsisten atau bukti seluruh 58 baris identik dengan snapshot155. Invariant per jenis transaksi, rekonsiliasi saldo terhadap seluruh alokasi, kesetaraan checksum snapshot155 dan seluruh dependency/owner/ACL managed belum dinyatakan lulus.

## Backup dan restore

Evidence DEV155-RESTORE-EVIDENCE.json mencatat PASS logical captured-scope restore pada 25 Oktober: 103 COPY tables dibandingkan tanpa mismatch; 23 core tables, 101 constraints, 60 indexes; ACL dibandingkan setelah canonicalization urutan; 54 posted dan 4 reversed. Restore transaksi atomik berhasil di clone terisolasi tanpa network, kemudian clone dihapus. Ini memperbarui catatan lama Finance151/DEV154 yang menyebut restore aktual masih blocked.

Batas bukti: laporan/evidence existing dibaca, artefak privat tidak dibuka atau didekripsi ulang. Kesegaran terhadap staging 28 Oktober belum dibuktikan dengan snapshot baru. Storage bytes, pemulihan kunci DPAPI setelah kehilangan mesin, pengaturan platform Auth/PostgREST dan seluruh global roles belum tercakup. PF06 rehearsal Finance/Access pada snapshot aktual masih tertunda. Tidak ada backup baru atau restore drill baru dijalankan pada sesi ini.

## Blocker kompatibilitas aplikasi

api/finance.ts masih INSERT/UPDATE langsung untuk kantong, kategori dan metadata transaksi, serta INSERT audit terpisah. Pencabutan service_role DML oleh proposal akan memutus jalur ini. Dibutuhkan kontrak RPC atomik untuk operasi tersebut dan migrasi pemanggil sebelum aktivasi; jangan memulihkan grant luas sebagai jalan pintas.

FinancePage/financeRuntimeSafety dan API tetap menahan modul operasional. Pembacaan operasional langsung Supabase memakai sesi native, sedangkan runtime auth portal memakai cookie server. Wrapper SQL tersedia setelah migrasi tidak otomatis menyelesaikan perbedaan sesi dan kontrak reversal/cicilan. Guard hanya boleh dibuka setelah integrasi dan uji cloud.

## Rencana rollback dan persetujuan final

Sebelum COMMIT: rollback transaksi apabila guard, timeout atau validasi gagal. Setelah COMMIT: hentikan writer, jalankan SAFE-ROLLBACK151 yang direview untuk mencabut EXECUTE mutasi, pertahankan kolom/histori/RLS aman, lalu forward recovery. Safe rollback adalah containment, tidak mengembalikan layanan penuh. Restore backup hanya setelah rekonsiliasi mutasi sah sejak snapshot; jangan kembalikan grants rentan atau menimpa histori baru.

Sebelum meminta ACC final: tutup gap API/RPC, verifikasi dependency actual-equivalent tanpa mengubah Access di luar scope, buat checkpoint backup konsisten terenkripsi terbaru dan manifest Storage, rehearsal pada clone dengan owner/grants aktual, uji failure/concurrency/rollback, tetapkan PIC maintenance dan recovery independen. Pin hash artefak final dan ulangi preflight. Baru tampilkan hasil PASS dan minta persetujuan penerapan terpisah. Saat ini belum layak meminta ACC eksekusi.

Tidak ada perubahan aplikasi atau proposal SQL dalam review ini. Tidak menjalankan unit/typecheck/lint karena hanya menambah laporan; tidak mengklaim CRUD atau persistensi cloud lulus. Hygiene: tidak ada pembersihan kode. SESSION HEALTH 87/100, Sehat, keyakinan Sedang; scope terjaga, bukti pemulihan terbaru dan kompatibilitas masih perlu ditutup.
