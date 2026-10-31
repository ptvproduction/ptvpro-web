# Finance 2.0 — kontrak persiapan PTV-DEV-110

Status: proposal, belum menjadi schema/RPC aktif. Operator zidnal; 21 Oktober 2026. Database hanya dibaca pada Staging `swadgljnyelsjstqqxbm`; Production tidak diakses. UI Finance mengikuti R03.

## PTV-DEV-114 (21 Oktober 2026) — Keputusan Operator: Legacy WordPress/PHP Finance RETIRED

- **Keputusan Resmi Operator (zidnal):** Integrasi WordPress/PHP Finance lama (termasuk direct write via `legacy/ptv-dashboard-data-bridge.php` dan aksi `admin-ajax.php` terkait) resmi dinyatakan **RETIRED** dan tidak perlu lagi didukung dalam pengembangan Finance 2.0.
- **Batasan Operasional:** Kode legacy, data historis (53 baris pada `ptv_pemasukan` dan `ptv_pengeluaran`), kelima tabel lama, dan izin database yang ada saat ini tetap dipertahankan utuh tanpa penghapusan atau modifikasi.
- **Dampak Arsitektur:** Aktivasi schema canonical (`ptv_finance_*`) dan RPC atomik Finance 2.0 dinyatakan independen dan tidak lagi terhambat oleh blocker audit runtime WordPress eksternal. Rekonsiliasi sumber 53 baris legacy tetap menggunakan pemetaan 1:1 via `ptv_finance_source_references` agar tidak terjadi pencatatan ganda (*double-counting*).


## PTV-DEV-113 — kontrak UI multi-Kantong (belum aktif)

`financeCanonical.ts` menambahkan envelope **v2** income/expense/transfer dengan incoming/outgoing allocations, total minor IDR, kategori hanya untuk income/expense, dan key UUID. Satu transaksi boleh beberapa Kantong; total setiap sisi transfer sama, pasangan asal/tujuan tidak berulang. V1 tetap untuk kontrak persiapan sebelumnya. Service menyiapkan hash payload terurut, expected versions, dan kebutuhan atomic commit/audit; belum mengirim RPC atau menjamin atomic write di database. Server kelak wajib menghitung ulang hash/otorisasi/versions, mengunci saldo dan menyimpan jurnal/audit/idempotency satu transaksi menurut invariants kontrak di bawah. Guard browser bukan pengganti backend.

Form Kantong tidak menerima saldo sebagai metadata. Arsip hanya untuk saldo nol terverifikasi; edit arsip ditolak. QRIS hanya aset lokal dengan metadata verifikasi server, tanpa generasi dari nomor rekening; upload/storage/merchant verification belum diintegrasikan. UI membaca sumber Staging existing; canonical null diberi status awaiting_schema. Semua mutasi tetap 405 server dan submit service selalu menolak. Tidak ada schema/izin/data cloud berubah, source/ledger tidak dijumlah ganda. UI baru tidak mengubah kontrak PHP/Finance lama.

## PTV-DEV-112 — bridge dan kesiapan pemulihan

- Rantai source terbukti: `legacy/page-dasbor.php` memuat `$bridge_path` dari direktori theme; sepuluh aksi Finance memanggil URL WordPress `admin-ajax.php`. Bridge mendaftarkan wp_ajax/wp_ajax_nopriv dan memakai sesi PHP/helper akses, bukan cookie Hub canonical. Registrasi nopriv sendiri tidak membuktikan akses anonim tanpa pemeriksaan sesi.
- Definisi class/config runtime `PTV_Supabase` tidak ditemukan pada source relevan yang diperiksa. Payload ledger lama (`no/type/client/amount/date/status/notes`) berbeda dari kolom canonical; helper eksternal mungkin memetakan, tetapi belum terbukti. Vercel existing melayani Vite/TypeScript API dan SPA, bukan runtime PHP. Ini tidak membuktikan WordPress eksternal nonaktif: deployment aktif, project ref, dan role koneksinya tetap **belum diketahui**. Tidak membaca key/.env atau mengakses Production untuk menebaknya.
- Dampak freeze bersyarat: bridge anon/authenticated yang menulis ke lima tabel Staging akan ditolak; bridge service_role tidak dibekukan; bridge dengan target lain tidak terpengaruh freeze Staging, tetapi target lain tidak diakses/diverifikasi. Finance React legacy lokal dan GET Finance 2.0 tidak memerlukan grant tulis langsung. Layanan eksternal lain belum dapat dinyatakan bebas dependensi tanpa inventaris runtime.
- **Restore data lokal PostgreSQL 17 PASS 53/53**, seluruh kolom dibandingkan melalui jsonb_populate_recordset bertipe (termasuk normalisasi timestamp/zona waktu), PK/FK/CHECK/NOT NULL aktif. Backup/manifest DEV-111 tetap asli. PostgreSQL ditemukan di Program Files, meski tidak di PATH. Cluster khusus 127.0.0.1:55432 diverifikasi data_directory-nya dan dihentikan setelah uji; tidak membaca credential/cloud. Bukti `.gemini/scratch/finance-112-restore/result.json`, runner `.gemini/scratch/finance-112-restore.py`. Parent canonical_identity dibuat kosong sebagai stub FK lokal; ini bukan pemulihan seluruh identitas/trigger/default/policy. ACL/RLS restore belum diuji.
- `scripts/restore-staging-backup.mjs` lama bukan alat latihan aman: membaca environment cloud, memakai upsert dan mengharapkan format `tables`, sedangkan backup Finance baru memakai `data`. Tidak dijalankan/diubah; jangan menunjuknya ke backup ini atau Staging aktif.
- Kompatibilitas bila WordPress masih diperlukan: pertahankan baca; jangan menonaktifkan handler atau mengubah role koneksi secara spekulatif. Tulis kelak melalui adapter server yang memvalidasi identitas/capability canonical dan pemetaan field eksplisit, lalu satu RPC atomik/idempoten. Sesi PHP/label role tidak boleh dipercaya sebagai identitas Hub; jangan memakai service-role sebagai jalan pintas, membuka grant atau menerjemahkan invoice/quotation otomatis menjadi arus kas. Saat ini belum ada kontrak tulis aman yang dapat dipasang tanpa bukti runtime; tidak membuat endpoint atau bypass baru.

### Rencana freeze final (hanya setelah ACC dan gate runtime lulus)

1. Bukti metadata runtime WordPress Staging: URL/hosting, theme/plugin aktif yang memuat bridge, project ref koneksi dan jenis role efektif, tanpa key/JWT/password. Jika target Production, hentikan pemeriksaan target itu; minta metadata operasional operator, bukan akses Production. Tentukan apakah bridge adalah dependensi Staging dan apakah penghentian direct write diterima.
2. Ulangi hanya preflight yang mudah berubah: backup data/ACL/RLS baru dan checksum, fingerprint, grants/membership, RLS/owner/dependensi serta layanan aktif. Snapshot DEV-111 yang teruji membuktikan format restore, bukan bebas drift saat eksekusi mendatang. Tutup gate bila bukti runtime tetap tidak jelas.
3. Jalankan draft v2 satu transaksi dengan guard host eksternal/manual GUC dan snapshot, tanpa mengubah RLS/schema/data; kegagalan sebelum commit => STOP/ROLLBACK. Jangan mengaktifkan transaksi atau menambah grant untuk membuat client lama lolos.
4. Tes setelah freeze memakai koneksi/sesi terpisah; **rencana, belum dilakukan**:

| Subjek | Positif | Negatif |
| --- | --- | --- |
| Anon | Konten publik existing di luar Finance tidak berubah | API Finance 401; write langsung lima tabel ditolak; grants TRUNCATE/MAINTAIN nihil |
| Kru aktif | GET hanya kas identitas sendiri, hasil tetap setelah refresh | Tidak menerima global/settings/manage; POST/PUT/PATCH/DELETE 405; direct write ditolak |
| Operator tanpa manage | Baca sesuai finance.view/operator | Tidak ada aksi manage, semua tulis tetap ditolak |
| Bendahara terdelegasi / Root / Eksekutif | GET global dan settings sesuai capability live | Direct write dan endpoint mutasi tetap ditolak selama fondasi read-only; role bukan pengecualian freeze |
| Akun dicabut/inaktif/deny | Akses lain hanya sesuai kebijakan existing | Finance ditolak walau cookie lama masih ada |
| service_role/owner | Hak server existing tetap dan GET bekerja | Key tidak tersedia di frontend; bukan jalur bypass bridge |

5. Verifikasi katalog hak tabel+kolom untuk setiap role, RLS/policy/SELECT unchanged dan fingerprint data tidak berubah; uji DML hanya pada fixture terisolasi yang disetujui, dengan transaksi rollback eksplisit, tanpa menyentuh historis. TRUNCATE tidak diuji pada tabel historis: buktikan lewat ACL. Uji role aplikasi memerlukan sesi sah, bukan role switch SQL yang dianggap login pengguna.
6. Rollback setelah commit hanya setelah ACC terpisah: periksa konflik ACL baru, restore grant spesifik sesuai snapshot tepat sebelum eksekusi; jangan GRANT ALL, restore data atau mengulang Revision 4. Karena freeze tidak mengubah data, rollback data tidak diperlukan. Pemulihan ACL membuka risiko lama dan bukan tindakan otomatis.

Keputusan ACC berikutnya: izinkan freeze setelah operator memberikan bukti metadata runtime WordPress Staging (URL/hosting, project ref/role tanpa credential) dan menyatakan direct write legacy bukan dependensi yang perlu dipertahankan, atau menyetujui penghentiannya. Bukti yang belum ada tidak dapat digantikan persetujuan untuk menebak. Tidak ada ACC freeze yang diasumsikan dari sesi ini.

## Gate eksekusi PTV-DEV-111 — STOP sebelum freeze

ACC zidnal bersyarat pada seluruh pemeriksaan keamanan dan dampak legacy lulus. Project Management API mengonfirmasi ptvpro-staging, ref swadgljnyelsjstqqxbm, host db.swadgljnyelsjstqqxbm.supabase.co, PostgreSQL 17.11. Backup baru lima tabel dan ACL/RLS disimpan pada `backups/staging-finance-pre-freeze-PTV-DEV-111.json`; manifest SHA-256 pada berkas `.manifest.json` berdampingan. Data backup tidak disalin ke laporan/log.

- Backup memuat 43 pemasukan, 10 pengeluaran, ledger/kas/periode kosong, seluruh kolom; ACL tabel/kolom, owner, RLS/force RLS, policy, constraints, metadata role/membership dan finance profile capabilities. File dibaca kembali, JSON/target/tabel/ID unik/RLS diuji; totals sesuai sebelumnya. Pembacaan cloud kedua cocok persis dengan data, ACL/RLS dan memberships snapshot. SHA-256 file: `49f768da7e81012dbcb9eaac9d86ab7df45a2025fca48d85fe0dbf17d6468629`. Ini verifikasi ekspor/readback, **bukan uji restore PostgreSQL**; psql/docker tidak tersedia pada PATH yang diperiksa.
- **Blocker nyata:** `legacy/ptv-dashboard-data-bridge.php` memiliki direct write Finance: ledger insert/update (5825–5828), pemasukan (6426–6433), pengeluaran (6496–6503), kas (6658–6661), periode (6948–6951). Target/role koneksi dan status pemakaian deployment lama belum terverifikasi tanpa mengakses credential/Production. Freeze dapat memutus client lama berbasis anon/authenticated; client service_role justru tidak dibekukan. Jangan menganggap seluruh Finance lama hanya localStorage: pernyataan itu berlaku untuk React store, bukan bridge PHP.
- Draft v2 tetap hanya ditinjau statis, tidak diubah/dijalankan. REVOKE harus memutus direct write Data API termasuk manager; rollback sebelum COMMIT memakai ROLLBACK, setelah COMMIT hanya pemulihan ACL snapshot dengan pemeriksaan konflik dan ACC terpisah. Tidak membuat atau menjalankan GRANT pemulihan otomatis.
- Pemeriksaan katalog live atas 5 tabel × anon/authenticated/service_role masih menunjukkan privilege SELECT/INSERT/UPDATE/DELETE/TRUNCATE/MAINTAIN tersedia, termasuk hak kolom efektif dari grant tabel. RLS tetap aktif dan tidak diubah. Ini bukti **belum freeze**, bukan bukti semua role dapat mengubah setiap row (RLS tetap membatasi DML); TRUNCATE tidak dilindungi RLS.
- 68 tes lokal membuktikan policy backend untuk Root/Eksekutif/delegasi finance.manage, kru own-scope, operator read-only, deny/revocation serta HTTP write denial; bukan uji login role cloud. Tidak menjalankan probe INSERT/UPDATE/DELETE/TRUNCATE atau uji akses pascafreeze karena gate eksekusi gagal. Penolakan tulis kru pada database pascafreeze **belum terbukti**.

Lanjutan yang diperlukan: operator memastikan bridge PHP tidak lagi dipakai pada Staging atau menyetujui dampak penghentian direct write yang relevan; verifikasi target/role melalui metadata aman tanpa memberikan key. Tinjau kesiapan pemulihan/restore lokal, lalu ulangi snapshot/preflight baru sebelum mengizinkan freeze. Persetujuan transaksi/schema/RPC tetap di luar scope.

## Rekonsiliasi read-only

| Sumber Staging | Baris | Total rupiah | Tanpa keuangan_id |
| --- | ---: | ---: | ---: |
| ptv_pemasukan | 43 | 1.244.200 | 43 |
| ptv_pengeluaran | 10 | 633.924 | 10 |
| ptv_keuangan | 0 | 0 | — |

Selisih aritmetis sumber **Rp610.276**, bukan saldo Kantong terverifikasi: saldo awal, rekening tujuan, rekonsiliasi bank/kas fisik dan periode belum tersedia. ptv_kas_periode kosong. Tidak ada nominal NULL/nonpositif atau tanggal NULL pada 53 sumber. Tidak menghitung pemasukan/pengeluaran sumber bersama ledger sebagai dua transaksi.

- Duplikat identik: 0, berdasarkan jenis, tanggal, nominal, label trim/lowercase/spasi dinormalisasi, dan keterangan penuh (ID/timestamp tidak dipakai untuk menentukan duplikasi). Tujuh kelompok kandidat pemasukan mencakup 40 baris: ukuran 22, 8, 2, 2, 2, 2, 2. Masing-masing memiliki keterangan berbeda; bukan bukti transaksi ganda. Perlu review bukti oleh Bendahara; tidak ada penghapusan/penyatuan otomatis.
- Fingerprint pemeriksaan sumber saat ini: `b9866320d559640f7afb8c94a96425de` (MD5 deteksi perubahan, bukan bukti autentisitas). Gabungan terurut jenis/ID atas ID, link ledger, nominal, tanggal, label normalisasi, keterangan; simpan query pemeriksaan di riwayat sesi bila diperlukan audit ulang.
- Backup Revision 4 `backups/staging-pre-reconciliation-revision4-2026-10-19T23-37-04-658Z.json` hanya memuat **9 pengeluaran**, tidak memuat pemasukan/ledger. Sembilan ID ditemukan dan cocok 9/9 untuk id, keuangan_id, keperluan, nominal, tanggal, keterangan dengan normalisasi CRLF/CR; created_at tidak termasuk pembandingan ini. Tambahan satu pengeluaran konsisten dengan rencana Revision 4 yang sudah ada; migrasi tidak diulang.
- Total sumber cocok dengan angka pada rencana rekonsiliasi Revision 4 terdahulu. Bundle sumber original 43 pemasukan tidak ditemukan pada lokasi artefak relevan yang diperiksa; **paritas baru per-baris 43 pemasukan dengan ekspor original belum terbukti**. Database sumber Production tidak dibaca untuk mengisi kekosongan tersebut. Backup tujuh tabel bukan backup Finance lengkap.

## Audit draft pengamanan

Kelima tabel Finance: RLS aktif, owner postgres. ptv_pemasukan/pengeluaran memiliki policy ALL berbasis finance.view/operator; policy tersebut belum layak dipakai untuk mengaktifkan tulis. Kas/periode tidak memiliki SELECT policy langsung untuk pengguna; endpoint baca cookie memeriksa akses live sebelum memakai server client. Tidak mengubah kebijakan baca atau membuka akses baru.

ACL tabel yang teramati identik pada kelimanya: postgres, anon, authenticated, service_role masing-masing `arwdDxtm` (termasuk MAINTAIN); tidak ada ACL kolom eksplisit. anon/authenticated tidak memiliki parent role pada metadata membership yang diperiksa; authenticator boleh SET ROLE sesuai pengaturan platform dan tidak diubah. Tidak ditemukan view dependen atau fungsi dengan referensi nama tabel Finance pada pencarian katalog statis; dynamic SQL/external clients tidak dapat dinyatakan bebas dependensi hanya dari pencarian tersebut.

Draft v2 menutup INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/**MAINTAIN**, termasuk grant kolom eksplisit, dari PUBLIC/anon/authenticated. RESTRICT, timeout, guard RLS/owner/versi, dan assertion hak efektif mencegah commit parsial atau hak turunan tertinggal. Tidak memakai CASCADE, DROP, perubahan data/default privilege global, atau menonaktifkan RLS. SELECT dan akses service_role tetap; **service_role/owner tetap dapat menulis**, sehingga ini bukan pembekuan total semua administrator. Endpoint Finance tetap GET-only. Tidak ada RPC tulis Finance yang ditemukan pada audit statis saat ini.

Dampak: Finance lama berbasis localStorage tidak terhapus/diimpor; client lama yang menulis langsung ke tabel Staging akan ditolak, termasuk akun pengelola. Baca server Finance 2.0 tetap berfungsi; jangan memakai legacy localStorage sebagai bukti penyimpanan cloud. Diperlukan maintenance window/konfirmasi operator untuk penghentian jalur tulis langsung tersebut.

### Prasyarat eksekusi/rollback (belum dijalankan)

1. ACC khusus freeze grant lima tabel, host Staging diverifikasi di luar SQL, PostgreSQL 17 terkonfirmasi; ekspor baru seluruh 53 sumber + ledger/kas/periode beserta ACL/policy/membership. Backup lama tidak cukup. Simpan hasil backup pada lokasi aman tanpa credential/data pribadi dalam log/dokumentasi.
2. Snapshot ACL read-only sebelum eksekusi: `SELECT oid::regclass, relowner, relacl FROM pg_class WHERE oid IN ('public.ptv_keuangan'::regclass,'public.ptv_pemasukan'::regclass,'public.ptv_pengeluaran'::regclass,'public.ptv_kas_kru'::regclass,'public.ptv_kas_periode'::regclass);` serta `pg_attribute.attacl`, pg_policies, pg_auth_members terkait. Siapkan restore ACL spesifik objek/role/grant-option berdasarkan snapshot aktual; bukan GRANT ALL generik.
3. Setelah BEGIN pada draft, operator menyisipkan SET LOCAL app.target_project_ref='swadgljnyelsjstqqxbm' dan SET LOCAL app.finance_acl_backup_confirmed='yes'. Kedua GUC hanya pernyataan operator, bukan verifikasi host/backup otomatis. Jalankan seluruh transaksi sekaligus, tanpa seleksi SQL sebagian.
4. Error sebelum COMMIT: STOP dan ROLLBACK, verifikasi koneksi/ACL tetap baseline. Tidak melewati assertion. REVOKE bersifat transaksional. Keberhasilan/idempotensi SQL **belum diuji dengan eksekusi PostgreSQL**, hanya ditinjau statis; tes lokal mencakup parser kontrak dan regresi Finance, bukan eksekusi draft.
5. Sesudah COMMIT: koneksi baru memeriksa hak efektif tabel/kolom anon/authenticated nihil untuk tulis dan MAINTAIN, SELECT/service_role tetap, RLS/policy tetap, 53 baris/fingerprint/totals tidak berubah; uji GET dan penolakan tulis dengan fixture setelah ACC pengujian terpisah. Hak efektif saja bukan bukti seluruh jalur RPC aman.
6. Jika perlu rollback sesudah commit: pertahankan freeze sebagai pilihan awal. Restore ACL snapshot membutuhkan ACC terpisah karena mengembalikan risiko akses lama; periksa konflik grant baru setelah migrasi dan jangan menimpa perubahan admin lain. Tidak mengubah data atau mengulang Revision 4.

Rujukan perilaku privilege/REVOKE: [PostgreSQL 17 REVOKE](https://www.postgresql.org/docs/17/sql-revoke.html), [Privileges](https://www.postgresql.org/docs/17/ddl-priv.html).

## Kontrak transaksi yang diusulkan

Nama entitas berikut konseptual, bukan tabel yang diasumsikan sudah ada. Implementasi DDL/RPC menunggu review/ACC kontrak.

| Operasi | Satu kejadian atomik | Pencegahan double-counting |
| --- | --- | --- |
| Kantong | UUID, kode unik, label, IDR, status aktif/arsip; saldo berasal dari jurnal, bukan field bebas edit | Saldo awal lewat satu opening event yang disetujui; tidak dicatat ulang sebagai pemasukan usaha. Kantong berisi saldo tidak dapat dihapus/ditutup tanpa penyelesaian |
| Pemasukan | Debit aset Kantong, kredit pendapatan atau akun lawan yang disetujui | Satu event/jurnal; tabel detail dan legacy source hanya referensi, bukan sumber total kedua |
| Pengeluaran | Debit beban, kredit aset Kantong | Beban yang sudah diakui sebagai reimburse tidak dicatat lagi saat pembayarannya |
| Transfer internal | Debit aset Kantong tujuan, kredit Kantong asal, nominal sama, Kantong berbeda, currency sama | Arus internal tidak menambah pendapatan/beban organisasi; fee bank adalah beban terpisah yang ditautkan, bukan selisih tersembunyi. Versi awal tidak menerima fee implisit |
| Reimburse | Pengakuan disetujui: debit beban, kredit utang reimburse; pembayaran debit utang, kredit Kantong | Klaim/dokumen unik dan persetujuan terpisah; bayar parsial tidak melebihi sisa, pembayaran bukan beban baru. Klaimant bukan identitas actor |
| Cicilan piutang | Debit Kantong, kredit piutang untuk setiap penerimaan yang terkait piutang asal | Pokok berasal dari event asal yang disetujui; penerimaan tidak mengakui pendapatan untuk kedua kali. Bunga/denda di luar versi awal |
| Kas Kru | Penetapan: debit piutang kas, kredit pendapatan kas; penerimaan: debit Kantong, kredit piutang kas | Unik identity/periode/jenis tagihan. Pembayaran parsial berkurang dari sisa, tidak membuat pemasukan lain melalui tabel sumber legacy |

Laporan memisahkan **kas** (mutasi aset Kantong) dari **akrual** (pendapatan/beban); transfer, saldo awal dan pembayaran piutang/utang tidak boleh dimasukkan ke kategori pendapatan/beban baru. Kebijakan basis laporan, saldo negatif, saldo awal dan pemetaan akun memerlukan keputusan operator sebelum DDL.

### Envelope dan invariants

- Parser lokal `financeTransactionContract.ts` memvalidasi proposal versi 1: UUID idempotencyKey, operation whitelist, occurredOn tanggal kalender, IDR, description, ID relasi dan amountMinor berupa string integer positif maksimum 18 digit. **1 rupiah = 100 minor units**; konversi memakai integer/decimal server, bukan floating point. Parser belum menjadi endpoint atau izin tulis.
- Identitas actor/account/session/capability diturunkan server dari cookie tervalidasi, bukan payload. Tolak field tambahan. Pengguna biasa tidak punya RPC tulis; Bendahara didelegasikan finance.manage existing, Root/Eksekutif mengikuti capability live dan deny override. Periksa ulang akun, revocation, membership dan scope pada setiap operasi, bukan hanya pada render.
- Satu RPC server-only, satu transaksi: validasi hak dan relasi → klaim kunci unik `(scope,actor_account,idempotency_key)` → kunci Kantong/utang/piutang/tagihan dalam urutan UUID konsisten → validasi periode terbuka/sisa/expectedVersion → event + seluruh jurnal seimbang + alokasi + audit + receipt → COMMIT. Kegagalan audit/jurnal/alokasi membatalkan semuanya. expectedVersion bukan pengganti row lock.
- Setiap jurnal debit=kredit dalam IDR, jumlah >0, relasi FK valid, larangan pembayaran lebih dari sisa; aturan saldo negatif eksplisit (default menolak sampai disetujui). Kunci unik bisnis juga melindungi klaim, tagihan dan pembayaran eksternal dari retry menggunakan key berbeda.
- Replay key+canonical payload hash sama mengembalikan receipt lama tanpa efek kedua; payload berbeda menghasilkan 409. Canonical hash mencakup versi/operasi/relasi/nominal/tanggal/deskripsi; actor dari server. Jangan hash body mentah yang urutan key-nya berbeda. Timeout/hasil commit tidak diketahui: UI mempertahankan input+key dan mengambil receipt; jangan mengirim key baru otomatis.
- Receipt server berisi eventId, version, committed=true dan referensi affected IDs setelah commit; UI baru boleh sukses sesudah konfirmasi, lalu invalidasi daftar dan baca ulang backend. Audit immutable mencatat actor, timestamp server, key/hash, source reference, versi dan alasan; tanpa credential atau payload pribadi berlebihan. Koreksi lewat reversal event terotorisasi, bukan UPDATE/DELETE jurnal posted.
- Migrasi 53 sumber kelak memakai mapping unik `(source_table,source_id)` ke event yang disetujui; idempotent per sumber dan batch manifest. Peninjauan kandidat duplikasi/rekonsiliasi bukti mendahului import; jangan menghitung tabel lama dan jurnal baru bersama, jangan menghapus 53 sumber. Belum ada SQL import atau write RPC yang dibuat/diaktifkan.

### Keputusan ACC berikutnya

1. Izinkan eksekusi **draft v2 freeze grant lima tabel saja**, setelah snapshot baru dan verifikasi host; tanpa mengubah RLS/data. Tetap menutup penulisan transaksi.
2. Review tujuh kelompok kandidat dan bukti saldo Rp610.276; sediakan ekspor original pemasukan untuk pembuktian per-baris. Tidak ada ACC penghapusan/penyatuan yang diminta secara implisit.
3. Setujui model jurnal/basis laporan, Kantong awal, delegasi Bendahara, reimburse approval dan aturan pembayaran parsial; lalu susun DDL/RPC staging dalam review terpisah. Implementasi/migrasi dan uji tulis fixture membutuhkan ACC tersendiri.
