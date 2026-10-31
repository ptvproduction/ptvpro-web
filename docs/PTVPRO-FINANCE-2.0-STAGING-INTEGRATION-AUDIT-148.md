# Finance 2.0 — Audit integrasi Staging PTV-DEV-148

Tanggal: 24 Oktober 2026. Operator: zidnal. Agent: Codex.

**Keputusan: BELUM SIAP OPERASIONAL.** Audit dan perbaikan lokal parsial selesai; integrasi penuh serta E2E belum selesai. Perubahan database berisiko dihentikan sesuai instruksi operator. Tidak ada deploy atau akses Production.

## Kelanjutan PTV-DEV-151 — 25 Oktober2026

B01–B04 sudah diperbaiki pada proposal lokal dan lulus105 pengujian PostgreSQL sintetis, termasuk concurrency, rollback, RLS, audit dan recovery. [Laporan/bukti/ACC151](PTVPRO-FINANCE-151-HARDENING-REVIEW.md). API baca kini wajib memakai scope database untuk sesi cookie/service-role dan menolak fallback ketika RPC belum terpasang. Tidak ada UI yang dibuka kembali atau SQL cloud dijalankan. Temuan cloud148 di bawah tetap merupakan baseline historis yang **belum diperbaiki di cloud**. Finance penuh/deployment masih NO-GO.

## Pembaruan finishing 149 — 25 Oktober 2026

**PARTIAL / NO-GO aktivasi penuh.** Bukti cloud 148 tetap baseline historis; sprint ini tidak menjalankan SQL atau mutasi cloud. Konfigurasi .env.staging diperiksa terbatas pada mode backend dan hostname: auth vercel, inventaris supabase, project swadgljnyelsjstqqxbm. Server/browser tidak diverifikasi ulang; tidak menyamakan build production lokal dengan koneksi Production.

Perbaikan lokal:

- API menahan lima operasi bermasalah dengan 503 FINANCE_OPERATIONAL_HOLD sebelum RPC/DML: pembayaran Kas, pencairan/pelunasan piutang, reversal operasional, pembebasan kas. Handler upsert pembebasan hardcoded yang mereset pembayaran dan empat handler RPC yang belum aman dihapus dari endpoint; proposal SQL lama disimpan sebagai bahan perbaikan, tidak dijalankan ulang.
- Getter/saver localStorage operasional dan direct-cloud write adapters ditolak di luar MODE=test. Guard readiness tidak lagi menganggap keberadaan tabel sebagai bukti siap operasional. Halaman Kas/Piutang/Pengaturan/Laporan menampilkan penahanan dengan komponen R03 existing, tanpa angka fixture dan tanpa ekspor yang menyamar sebagai laporan cloud. Desain/navigasi dipertahankan. Ini penahanan sementara, bukan implementasi penuh modul tersebut.
- Kantong/Transaksi/Ringkasan canonical tetap menggunakan jalur existing. Error kategori/alokasi/source reference wajib menggagalkan snapshot; tidak ditelan sebagai awaiting_schema. Batas 100 canonical diberi penanda berdasarkan count, urutan daftar ditambah id. Laporan penuh tetap membutuhkan pagination/snapshot backend sebelum diaktifkan.
- Respons HTTP 200 success=false/null tidak menjadi sukses client. Update/archive pocket mengirim expectedVersion, membandingkan versi dan memakai filter CAS pada UPDATE; archive mensyaratkan balance_minor=0 pada UPDATE, bukan hanya pembacaan sebelumnya. Konflik CAS tidak dianggap sukses.
- API menolak cross-site/Origin host berbeda dan Content-Type non-JSON yang diberikan. Batas 64KB juga berlaku pada body yang sudah diproses framework.

[Proposal containment](PTVPRO-FINANCE-149-CONTAINMENT-PROPOSAL.sql) hanya mempersempit ACL sementara, tidak memperbaiki B02–B04 dan belum diuji SQL. [Backup, recovery dan checklist](PTVPRO-FINANCE-149-CONTAINMENT-RECOVERY.md) melarang rollback yang membuka kembali celah lama. Pembatasan lokal belum mengamankan cloud yang belum diubah. RPC/RLS/cakupan data tetap memerlukan ACC dan pengujian nyata.

Blocker tetap: B01–B04, metadata dan audit belum satu transaksi, privasi deskripsi canonical, laporan lengkap, persistensi QRIS/settings/semester, upload bukti cookie end-to-end, reimburse operasional. Tidak membuat schema/RPC baru tanpa bukti kebutuhan dan persetujuan. Uji saldo negatif/concurrency/partial transfer/partial installment yang ada di unit tests bukan bukti PostgreSQL Staging; skenario SQL wajib ada pada checklist recovery.

Validasi sprint final dicatat pada roadmap/handoff. UI diuji static render untuk halaman penahanan; visual browser desktop/mobile/dark belum diverifikasi ulang. Hygiene CLN-159.

## Lingkungan dan baseline terverifikasi

- Supabase project yang dituju setiap SQL: `swadgljnyelsjstqqxbm`; PostgreSQL 17.11.
- Runtime diaktifkan dengan `npm run dev -- --mode staging --port 5174 --strictPort`. Modul Vite yang disajikan HTTP mengonfirmasi MODE staging dan project ref tersebut, VITE_AUTH_BACKEND vercel, VITE_INVENTARIS_BACKEND supabase. `/api/finance` tanpa cookie: HTTP 401.
- Enam tabel operasional tersedia dengan RLS: semesters, kas_records, kas_payments, loans, loan_payments, settings (prefix `ptv_finance_`).
- Bucket finance-proofs privat, batas 5 MB, MIME gambar/PDF.
- Baseline SQL sebelum DAN sesudah rollback: 54 posted, 4 reversed; saldo Kas Utama Studio 52027600 minor (Rp520.276,00); 2 semester, 0 kas_records, 0 kas_payments, 0 loans, 0 loan_payments.
- Angka ini membuktikan pemulihan uji ke baseline; bukan bukti seluruh alur atau seluruh histori lulus.

## Peta integrasi aktual

| Modul | Implementasi aktual dan tujuan database | Status/batas |
| --- | --- | --- |
| Kantong | FinanceWorkspace → financeCanonicalService → /api/finance → ptv_finance_pockets | Baca/tulis tersedia dalam kode. CRUD metadata belum E2E login cloud; audit log terpisah dari mutasi. |
| Transaksi | readFinance membaca canonical transactions/allocations/source_references/categories; post memakai rpc_post_finance_transaction_server | Posting income diuji langsung SQL dan rollback. Daftar dibatasi 100; kegagalan canonical masih dapat tersembunyi sebagai awaiting_schema. |
| Transfer | Command operation transfer menggunakan RPC posting canonical yang sama | Kontrak dan unit test tersedia; belum diuji transfer cloud di sesi ini. |
| Kas Kru | View membaca getStoredSemesters/getStoredRecords dan fixture kru; recordKasKruPayment masih memanggil generic posting lalu menyimpan lokal, error posting ditelan | **Belum terintegrasi.** Adapter submitKasKruPaymentAtomic ada tetapi bukan jalur UI aktif. RPC actual cacat (lihat B02). |
| Cicilan Kas | Array payments lokal; tabel kas_payments tersedia | **Belum terintegrasi.** RPC Kas tidak INSERT rincian cicilan. |
| Pembebasan kas | View → waiveKasKruFee lokal; API waive_kas_fee terpisah memiliki upsert tarif hardcoded dan reset paid_amount_minor | **Belum aman.** Endpoint dapat menimpa pembayaran lama; audit entity/action tidak cocok constraint. Tidak dieksekusi. |
| Semester/tarif | View Settings memakai create/update/saveSemesters lokal; tabel semesters punya monthly_fees | Adapter cloud dikoreksi, belum dihubungkan ke view. Peralihan beberapa semester belum atomik. |
| Piutang dan pelunasan | View → getStoredLoans; service generic ledger posting + saveLoans lokal; adapter atomic tersedia | **Belum terintegrasi.** loans/loan_payments RLS membatasi manage atau borrower kru terkait. Jalur API cookie memerlukan penyaringan identitas bila ditambahkan. |
| Reimburse | Hanya kontrak reimburse_recognize/reimburse_pay di financeTransactionContract.ts | Tidak ditemukan view/service/handler operasional di modul Finance. **Belum diimplementasikan**, tanpa membuat tabel/RPC baru. |
| Pengaturan umum/QRIS | Settings disimpan localStorage; attachQrisToPocket menghasilkan array baru yang diabaikan view | **Belum persisten cloud.** Jangan menganggap pesan sukses sebagai bukti simpan. |
| Kategori | CRUD melalui /api/finance ke categories; sebelumnya fallback lokal | Diperbaiki agar kegagalan HTTP tidak berubah menjadi sukses lokal; arsip ikut terbaca untuk restore. Belum CRUD E2E cloud. |
| Bukti | Helper Storage upload/sign tersedia; form memakai URL/preview dan menyimpan proof_url | Bucket aktif bukan bukti integrasi UI. Upload dan refresh signed URL belum E2E; browser memakai client Supabase sedangkan login utama cookie Vercel. |
| Laporan | Canonical transaksi + getStoredRecords/getStoredLoans | PDF/XLSX teruji unit lokal; sumber operasional masih lokal dan transaksi maksimal 100. **Belum laporan cloud lengkap.** |

## Blocker database yang memerlukan persetujuan

### B01 — Akses agregat tanpa otorisasi (tinggi)

`public.rpc_get_finance_loans_aggregate()` SECURITY DEFINER, GRANT EXECUTE termasuk anon dan authenticated; tubuh SQL tidak memeriksa auth/finance capability/personel. `BEGIN; SET LOCAL ROLE anon; SELECT ... IS NOT NULL; ROLLBACK` menghasilkan true. Saat ini loans kosong, tetapi fungsi tetap mengekspos agregat ke publik ketika data masuk.

Usulan: revoke akses anon dan terapkan pemeriksaan finance.view/manage serta kategori personel dalam jalur authenticated, atau server-only sesuai arsitektur cookie. Tidak diterapkan karena mengubah hak akses database.

### B02 — RPC Kas menerima kru tidak terdaftar dan salah menilai cicilan (kritis)

Uji rollback dengan identitas sintetis khusus tes dan pembayaran 100 minor diterima. Baris baru menyimpan amount_minor sama dengan pembayaran dan status lunas, bukan tarif semester. Tabel kas_payments tetap 0. Pemeriksaan kru hanya mencari jabatan Pembina/Pengarah; tidak mensyaratkan keberadaan/status kru aktif, periode sah/unik, maupun kesesuaian metadata dan command. Perubahan tarif juga tidak direkonsiliasi ke target tagihan existing oleh RPC.

Usulan: validasi personel/periode dan command; gunakan tarif monthly_fees; INSERT rincian pembayaran dalam transaksi yang sama; idempotency atas seluruh payload. Tidak diterapkan. Jangan mengaktifkan adapter atomik ini ke UI sebelum diperbaiki.

### B03 — Reversal tidak mempertahankan riwayat dan berpotensi selisih (kritis)

Definisi aktual reverse_operational_record_atomic untuk loan_payment memakai DELETE FROM ptv_finance_loan_payments. Cabang kas membatalkan hanya transaction_id terakhir dan mereset paid_amount_minor seluruh record ke 0. Pembayaran lintas-periode dapat membalik satu transaksi bersama tetapi hanya memperbarui satu record. Loop kantong reversal ini tidak ORDER BY pocket_id. Temuan berasal dari definisi aktual, belum dijalankan dengan data cloud.

Usulan: reversal non-destruktif dengan penanda/tautan reversal; rekonsiliasi seluruh record terkait dan lock deterministik. Membutuhkan keputusan schema/kontrak; tidak diterapkan.

### B04 — Idempotency pelunasan dan otorisasi belum lengkap (tinggi)

record_loan_payment_atomic memeriksa status lunas dan overpayment sebelum mengenali idempotent replay di posting; retry pembayaran pelunasan sah dapat ditolak. authorize memeriksa account, membership studio, capability/deny, tetapi tidak mengecek hub.access atau kategori Pembina/Pengarah. RLS canonical pockets/transactions/allocations/source refs belum memakai is_finance_restricted_personnel; helper personel operasional berbasis jabatan. RLS semester/settings hanya NOT restricted tanpa capability/membership aktif. Ledger descriptions juga memuat nama/ID peminjam, sehingga aturan privasi detail perlu dievaluasi lintas canonical ledger, bukan hanya loans.

Usulan: tinjau dan selaraskan otorisasi DB terhadap API; perbaiki urutan replay dan verifikasi payload transaksi terhadap metadata loan. Tidak diterapkan.

RPC mutasi yang diperiksa tidak memberi EXECUTE ke anon/authenticated; service_role saja. SELECT loans untuk anon dan INSERT loans untuk authenticated tidak diberikan. Hal ini positif tetapi tidak menutup B01–B04.

## Perbaikan kode sesi ini (teruji lokal)

- api/financeAccess.ts: lookup category yang tidak ada diganti jabatan aktual; Pembina/Pengarah dan kegagalan lookup ditolak; membership dibatasi ptv_studio; error identity lookup tidak diabaikan.
- api/finance.ts: baca juga kategori nonaktif untuk restore; hapus update updated_at kategori yang tidak ada pada schema aktual; sinkronkan is_archived; action audit restore/metadata memakai update yang sah pada CHECK constraint.
- financeSettingsService.ts: create/edit/archive/restore kategori menunggu respons server, tanpa fallback sukses lokal; reuse submitCategoryCreate.
- financeOperationalCloudService.ts: round-trip monthly_fees; kirim nominal string alih-alih BigInt yang gagal JSON.stringify; error fetch cicilan/pengaturan dipropagasikan.
- Tests diperbarui agar memakai schema/chain Supabase dan respons API eksplisit. Delapan regression test adapter/kategori baru dan empat test akses tambahan.
- Tidak ada perubahan CSS/layout/komponen UI. Desain R03 dipertahankan secara source; visual browser desktop/mobile belum diuji dalam sesi ini.

## Bukti pengujian

- Finance: **19 berkas, 201/201 tests lulus** (Vitest mock/unit/static render, bukan E2E cloud).
- `npm run typecheck`: lulus. `npm run lint`: lulus.
- `npm run build`: lulus, warning bundle besar; build lokal bukan deploy. Build dijalankan sebelum perubahan akhir label audit dan filter membership; keduanya juga lolos typecheck/test berikutnya.
- Suite penuh: **1218/1221 lulus; 3 timeout** pada kruKontakCrudPersistence (2) dan suratIzinAndKontakInternalParity (1), masing-masing batas 5 detik. Tidak dinyatakan baseline failure karena belum dibandingkan checkout awal. Tidak diubah karena di luar scope.
- Cloud: income canonical sukses dalam BEGIN/ROLLBACK; Kas Kru rollback membuktikan B02; anon aggregate membuktikan B01; grant/RLS/definisi fungsi diperiksa read-only.
- Belum diuji cloud: transfer, loan disbursement/repayment/reversal, fee waiver, pergantian semester, upload Storage, laporan ekspor, login/peran browser desktop/mobile. Pengujian lanjutan yang bergantung pada B01–B04 ditunda; tidak ada transaksi permanen untuk testing.

## Handoff

Prioritas berikutnya: persetujuan pengerasan RPC/RLS B01–B04; rancangan patch aman tanpa penghapusan histori; validasi rollback. Setelah DB aman, hubungkan view operasional melalui endpoint Finance existing dan identitas server (bukan localStorage/fixtures), selesaikan pembebasan/semester/QRIS/bukti/laporan, lalu E2E multi-peran. Jangan menandai Finance 2.0 siap hanya berdasarkan unit tests ini.

Code hygiene: CLN-154. Runtime lokal 5174 dibiarkan aktif untuk operator. Working tree pengguna dipertahankan, tanpa commit/deploy.
