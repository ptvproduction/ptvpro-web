# Finance151: kompatibilitas API dan kesiapan penerapan

Operator zidnal, 28 Oktober 2026. Hanya file Finance disentuh. Tidak ada mutasi cloud, migrasi, reset, commit, push atau deploy. Dokumen koordinasi bersama dilindungi sesuai instruksi kerja paralel PTV-DEV-186; laporan ini mencatat delta sementara.

## API dan kontrak

Delapan aksi POST /api/finance kini menggunakan rpc_finance_admin_mutation_server(account_id uuid, session_iat bigint, action text, payload jsonb): create/update/archive_pocket, create/update/archive/restore_category, update_transaction. Signature PostgreSQL memakai nama parameter p_account_id, p_session_iat, p_action, p_payload. Aktor berasal dari cookie terverifikasi dan resolveFinanceAccess, tidak dari payload. POST mempertahankan pemeriksaan canManage, origin dan JSON.

Private admin_mutation memanggil authorize finance.manage existing: identitas/capability live, advisory transaction lock151/1, freeze izin dan lock target FOR UPDATE. Versi kantong wajib sama; arsip hanya saldo nol; kategori sistem dilindungi. Metadata hanya menerima description, occurredOn, categoryId, notes, proofUrl; nominal, alokasi, jenis dan histori reversed tidak dapat diedit. Audit berada dalam transaksi yang sama dan kegagalannya membatalkan mutasi. Response existing success/pocket/category/transaction dipertahankan. Missing RPC menghasilkan503; forbidden403; stale version409. Tidak ada fallback direct write.

post_transaction dan void_transaction tetap menggunakan RPC existing. Empat aksi pembayaran/pencairan/reversal operasional dan waive_kas_fee tetap503 FINANCE_OPERATIONAL_HOLD. Adapter direct writers operasional tetap fixture-only; bukan jalur produksi yang baru diaktifkan. Pengaturan semester, pembebasan dan pengaturan operasional belum mempunyai kontrak mutasi server lengkap dan tetap tertahan. Tidak mengklaim seluruh fitur operasional siap hanya karena wrapper pembayaran ada.

## SQL dan dependency

SQL baru: PTVPRO-FINANCE-151-ADMIN-RPC.sql, dibundel generator Finance151 setelah policies dan sebelum COMMIT. Grant EXECUTE hanya service_role pada dua signature admin; private definer melakukan otorisasi, public wrapper SECURITY INVOKER. Tidak membuka direct DML.

Delapan kolom Finance151 tetap ditambahkan sesuai proposal. Admin SQL juga memastikan kategori.is_archived serta transactions.notes/proof_url tersedia secara idempotent; ketiganya sudah ada pada staging yang diperiksa sebelumnya, tetapi tidak ada pada definisi fixture historis. Tidak mengubah nilai baris existing atau mengisi operational_envelope histori.

Hash proposal baru: add0530fb870c9ad7421980b5461b3a8bb0f13ad18cf95efbb55dbedf5a718c5. Hash lama DEV154 bukan lagi bukti untuk proposal baru; evidence baru ditulis ke FINANCE-151-ADMIN-LOCAL-SQL-RESULTS.json dan FINANCE-151-ADMIN-154-SQL-RESULTS.json. File evidence historis tidak ditimpa.

Urutan: verifikasi preparation149/Access152 aktual atau ekuivalensinya, Finance151 satu transaksi termasuk admin RPC, validasi ACL/owner/schema dan refresh PostgREST setelah izin penerapan. Jangan replay149 setelah152. Tidak menjalankan langkah ini di cloud. Rehearsal gabungan memakai dependency Access existing tanpa mengubah source modul Access.

## Validasi nyata yang dijalankan

- Typecheck PASS. Lint file Finance tersentuh dengan --no-ignore PASS. Lint global FAIL: currentUser tidak dipakai pada HubShell.tsx:279; file di luar scope tidak diubah.
- Vitest6 suite:89/89 PASS, mock saja. Mencakup delapan dispatch RPC, cookie actor melawan spoof payload, missing RPC/forbidden/conflict tanpa direct-write fallback, serta regresi Finance existing.
- PostgreSQL17 sintetis lokal:113 pemeriksaan PASS; mode gabungan Access152/Finance151:141 PASS. Termasuk pocket create/update/archive, stale version, kategori CRUD, metadata-only, denial actor/anon, audit fault rollback, pembayaran kas parsial/replay, pencairan/pelunasan/reversal, konkurensi, RLS, restore sintetis dan containment/forward recovery. Baca evidence mesin untuk batas dan daftar pemeriksaan. Ini bukan pengujian cloud.
- Cluster fixture lama tidak ada; initdb awal dalam sandbox tidak selesai, dihentikan. Cluster sintetis Finance khusus dibuat di scratch; runner akhirnya menghentikan server. Cache dan data pengguna tidak dihapus.
- PostgreSQL staging read-only:58 transaksi,54 posted/4 reversed; digest ledger b38dcc5a1079297c77106039c82d742a identik checkpoint sebelum perubahan. Tidak melakukan CRUD cloud.

## Backup, rollback dan gate final

DEV155 membuktikan restore logical snapshot25 Oktober:103 tabel dibandingkan tanpa mismatch, termasuk metadata core/ACL dalam lingkup capture. Belum ada snapshot baru, checksum snapshot vs seluruh staging terkini, backup Storage bytes, pemulihan DPAPI lintas mesin, atau rehearsal proposal baru pada clone snapshot aktual. Uji lokal di atas memakai data sintetis.

Sebelum commit: ROLLBACK pada kegagalan guard/validasi/timeout. Sesudah commit: freeze writers dan SAFE-ROLLBACK151 untuk containment; daftar public RPC kini mencakup admin mutation. Pertahankan histori/kolom/RLS; forward recovery direview. Containment tidak mengembalikan layanan penuh. Restore data memerlukan rekonsiliasi mutasi sah setelah snapshot, tidak mengembalikan grants lama.

Checklist sebelum ACC penerapan:

1. Snapshot konsisten terenkripsi terbaru, checksum/count/ACL/owner lengkap, cakupan Storage terpisah dan custody pemulihan.
2. Restore snapshot aktual pada clone terisolasi, lalu rehearsal hash proposal baru dengan role managed-equivalent; failure/concurrency/rollback/forward recovery dan lintas modul.
3. Verifikasi runtime staging/project, dependency Access aktual, owner dan exact grants, kategori personel serta keputusan histori; jangan mengisi kategori/join-month otomatis.
4. Tetapkan PIC, maintenance, writer freeze dan kanal admin pemulihan; ulangi preflight/digest tepat sebelum penerapan.
5. Persetujuan final terpisah atas hash/urutan dan risiko. Jangan membuka hold operasional sebelum kontrak/sesi dan uji cloud masing-masing fitur selesai.

Status: incompatibility direct DML pada endpoint kantong/kategori/metadata diperbaiki dan teruji PostgreSQL lokal. NO-GO penerapan sekarang karena backup terkini dan rehearsal snapshot aktual belum diverifikasi. Aktivasi seluruh operasional juga masih memerlukan kontrak server tambahan; tidak disamakan dengan kesiapan SQL hardening.

Hygiene terarah: blok writer/audit API berurutan diganti satu dispatch RPC; tidak ada writer lama paralel. Generator source dipakai sebagai sumber tunggal; import pocket schema yang tidak dipakai di API dihapus. Lint script memakai import Node eksplisit. CLN bersama tidak dialokasikan karena dokumen paralel dilindungi.

SESSION HEALTH:87/100, Sehat, confidence Sedang. Scope jelas dan bukti lokal tersedia; cloud dan readiness aktual tetap dibedakan.
