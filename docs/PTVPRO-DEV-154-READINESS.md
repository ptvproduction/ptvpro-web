# PTV-DEV-154 — Session Deadline Alignment & Restore Readiness

25 Oktober2026; operator zidnal. **PF01/not_after CLOSED pada proposal lokal yang diuji; migrasi Staging tetap NO-GO.** Sesi ini tidak mengakses Legacy maupun Staging, mengambil snapshot, mengubah akun/sesi/credential/Vercel, bootstrap/linking, UI/Guidebook, commit/push atau deploy.

## Hasil alignment

- Finance151.native_account sekarang mensyaratkan stored session milik auth.uid yang masih ada, JWT exp/iat valid, serta **not_after IS NULL atau not_after>now()**. Deadline tepat now() ditolak. Identity account dan capability tetap dibaca dari database, bukan account_id/profil/jabatan dalam payload.
- Finance dan Access152 kini sama-sama menolak timestamp string, pecahan dan malformed. Finance.finance_can_native mengembalikan false ketika identitas native tidak valid tanpa cast error yang keluar dari helper. Tidak melonggarkan RLS, grant, tarif, saldo atau kontrak RPC bisnis.
- Seluruh helper native Finance (permission, current PTV ID, ownership/visible transaction, aggregate dan Storage policy) melewati native_account. Access.has_capability memakai pemeriksaan deadline yang sama. Preflight Finance juga mencantumkan kolom not_after sebagai dependency wajib.
- **Jalur server/cookie berbeda dari sesi native.** Ketujuh RPC server Finance hanya menerima SQL role service_role beserta klaim service yang benar dan actor/iat/permission live. Cookie HMAC diperiksa expiry/signature oleh API; iat/cutoff/lock/status/capability diperiksa database. Service JWT bukan JWT pengguna sehingga tidak diubah menjadi login native atau dipaksa memakai native session_id. Klaim service_role saja tidak memberi izin. Revocation per-sesi cookie portal tetap blocker existing Access152; patch native ini tidak menyelesaikannya.

## Bukti VERIFIED lokal

| Bukti | Hasil / cakupan |
| --- | --- |
| PostgreSQL17 Finance/gabungan | **133 PASS**, [hasil mesin](PTVPRO-DEV-154-FINANCE-SQL-RESULTS.json); rangkaian149 preparation→152→151 revisi. Seluruh105 checks Finance sebelumnya tetap berjalan, ditambah parity deadline/JWT/revocation/actor, RLS dan7 spoof RPC, borrower deadline, serta restore manifest. |
| PostgreSQL17 Access | **33 PASS**, [hasil mesin](PTVPRO-DEV-154-ACCESS-SQL-RESULTS.json);31 kasus lama ditambah timestamp string/pecahan. |
| Concurrency dua koneksi | Identical idempotency key hanya satu posting; cicilan Kas/pelunasan tidak overpay; dua pengeluaran tidak membuat saldo negatif. Audit failure/debit transfer failure/late loan detail failure rollback seluruh saldo/ledger/audit; explicit rollback, reversal history dan idempotent retry tetap lulus. |
| Restore sintetis | pg_dump/pg_restore fixture baru; digest seluruh23 tabel inti dan metadata structure/constraints/indexes/owner/ACL/RLS/policies/functions/triggers/default ACL/roles/membership/sequence cocok. Safe rollback151 dan forward recovery tidak menulis ulang saldo/histori atau membuka grant rentan. Dump baru diberi nama unik; backup lama tidak ditimpa. |
| Regression terkait | **6 files /135 Vitest tests PASS**, termasuk10 tests comparator restore baru. Tidak menjalankan full suite1443 ulang; tidak mengklaim jumlah suite penuh terbaru. |
| Typecheck / lint / build | PASS exit0; build17.35s, warning chunk>500kB existing. Tidak ada perubahan UI. |

Runner SQL hanya menerima localhost55439 dan tidak menerima argumen koneksi. Flag --session154 memilih output laporan baru, bukan target. Server fixture sudah dihentikan. Hash Finance proposal/preparation149/Access152 pada laporan133 sesuai file final. Hasil105/31 lama dipertahankan sebagai bukti historis dengan hash lamanya; jangan memakainya sebagai hash versi154.

Perintah reproduksi lokal:

```powershell
node scripts/build-finance-151.mjs
node scripts/test-finance-151-local.mjs --session154
node scripts/test-access-152-local.mjs --session154
npm test -- tests/hub/restoreManifest154.test.ts tests/auth/accessReadiness152.test.ts tests/auth/legacyBcrypt151.test.ts tests/hub/financeDatabaseHardening151.test.ts tests/hub/accessHardening149.test.ts tests/hub/rootBootstrap149.test.ts
npm run typecheck
npm run lint
npm run build
```

Runner memakai cluster fixture existing dan berhenti jika server sudah aktif; jangan mengambil alih proses milik sesi lain. Jalankan dua runner SQL secara berurutan, bukan paralel. Memerlukan PostgreSQL17 binaries/cluster lokal yang sesuai; izin loopback sandbox diminta saat diperlukan. Tidak ada Supabase client/koneksi cloud pada runner.

**Temuan restore yang tidak disembunyikan:** pemeriksaan metadata baru awalnya gagal pada CHECK constraint. PostgreSQL17 menulis ulang cast array varchar→text[] menjadi cast text per literal. Setelah memeriksa nilai/ekspresi yang sama, comparator dibatasi pada rewrite itu; enum/grant/owner/definition/data yang berubah tetap gagal dan diuji. Manifest kosong/tidak lengkap ditolak. Ini perbaikan validator, bukan penghapusan constraint atau pengabaian perbedaan security. Temporary diagnostic manifests seluruhnya sintetis di scratch existing.

Hygiene: pemeriksaan diff luas juga menemukan trailing whitespace pada dua SQL database/seed lama yang tidak disentuh154. Tidak dibersihkan karena di luar scope; pemeriksaan diff file154 dipisahkan dari kondisi working tree pengguna tersebut.

## Restore aktual dan perbedaan cloud

| Area | Status |
| --- | --- |
| PF01 alignment source + DB sintetis | **VERIFIED lokal / CLOSED lokal** |
| Implementasi di Staging | **BLOCKED** menunggu ACC; tidak ada query cloud baru pada154. Evidence153 tetap snapshot historis: fungsi/grant lama masih kondisi terakhir yang diketahui. |
| Snapshot aktual berizin untuk lokal | **BLOCKED** — belum tersedia manifest ACC/capture terkini yang mencakup scope dan izin penggunaan data. Tidak mengambil data diam-diam. |
| Backup lama/restore112 | VERIFIED historis terbatas:5 tabel lama/53 baris, ACL belum diuji; tidak cukup untuk12 tabel canonical+Access sekarang. Backup lama tidak diubah/dihapus. |
| Rehearsal snapshot aktual / owner managed | **BLOCKED** — fixture memakai PostgreSQL lokal, belum membuktikan restore schema/data/owner non-superuser seperti Staging atau Auth/PostgREST/Storage platform. |
| Root/login/recovery/Vercel aktual | **BLOCKED / NOT CHECKED**, mengikuti152/153; tidak diaktifkan atau diuji melalui akun nyata. |

[Prosedur rehearsal](PTVPRO-DEV-154-RESTORE-REHEARSAL.md) memuat scope, capture snapshot konsisten, batas Supabase managed roles/schema, target lokal baru, owner/grant mapping, before/after validation, PASS/FAIL serta recovery. [SQL checks](PTVPRO-DEV-154-RESTORE-CHECKS.sql) dan [comparator offline](../scripts/compare-restore-154.mjs) dapat digunakan setelah ACC data. Output manifest aktual harus privat di luar Git, bukan log/laporan repo.23 tabel inti adalah minimum; dependency tambahan pada snapshot harus mempunyai pemeriksaan setara.

pg_dump tidak memulihkan seluruh global roles/konfigurasi platform. Default CLI Supabase mengecualikan managed schemas; Auth/Storage customizations, Storage bytes dan konfigurasi/secrets platform harus diperlakukan terpisah. Jangan mengasumsikan plain PostgreSQL restore sama dengan pemulihan login portal. Tidak ada rencana password reset sebagai syarat backup.

## Matriks ACC dan urutan berikutnya

| Tahap | ACC / keputusan yang diperlukan | Checkpoint sebelum lanjut |
| --- | --- | --- |
| Persiapan snapshot | **ACC PERSIAPAN**, bukan ACC migrasi: PIC, source ref/physical fingerprint, izin scope data/credential, storage terenkripsi, retensi, existing credential yang sah | Tidak ada ekspor tanpa scope; tidak mengakses Legacy; artefak backup baru tidak menimpa lama |
| Capture dan restore drill | ACC penggunaan data lokal, target baru terisolasi/egress tertutup, owner/role managed mapping, jendela freeze/consistent snapshot | SHA/count/ledger serta semua metadata/grants/roles sesuai; data tambahan tercakup; backup belum dianggap aman sebelum restore lulus |
| Rehearsal migrasi | Persetujuan menjalankan149 prep→152→151 revisi dan safe rollback pada clone | Owner non-superuser/ACL actual-equivalent, lintas28 policies/7 fungsi dari153, concurrency/fault/recovery lulus; runtime platform dicatat terpisah |
| Maintenance Staging | PIC/waktu/batas timeout/freeze seluruh penulis Finance/akun/otomasi, backup baseline baru dan jalur recovery admin | Freeze bukan menonaktifkan akun atau menghapus sesi aktif; tidak membuka operasi yang masih ditahan |
| Eksekusi migrasi | **ACC EKSEKUSI MIGRASI TERPISAH**, mem-pin hash final154/cluster/urutan/rollback/deployment coordination |149 PREBOOTSTRAP menutup direct writes/mutator;152 memperketat native;151 revisi memasang Finance. Jangan replay149 sesudah152. Satu transaksi per proposal; failure sebelum COMMIT→ROLLBACK |
| Pascamigrasi | ACC untuk fixture/rollback test atau clone, schema cache refresh dan pembukaan writer bila memenuhi gate | Definisi/grant/RLS match; counts/histori/saldo/invariant cocok; privacy, audit, idempotency dan scope API diuji. API tidak dideploy sebelum RPC scope tersedia |
| Recovery | ACC safe rollback/forward recovery, bukan restore grants/helper lama | Freeze dipertahankan;151 menutup Finance writers,152 menolak native helper. Pertahankan guard149, marker/histori; rekonsiliasi mutasi sah sebelum restore backup.149 RLS rollback lama tidak boleh menimpa152 |
| Identitas dan Root | **ACC TERSENDIRI:** owner Root, recovery independen, enrollment/linking, kategori/bulan masuk, duplikasi/58 histori berdasarkan bukti |2 akun native/94 arsip dari153 bukan bukti ownership atau login portal. Jangan memilih berdasarkan nama/email/jabatan. Bootstrap memajukan cutoff target dan membutuhkan ACC dampak sesi; tidak termasuk hardening |

Keputusan operator data yang masih terbuka: kategori dan bulan masuk2 canonical; relasi94 arsip dan satu kelompok duplikat; visibilitas58 histori unclassified (manager-only sampai direview); credential/status/override Legacy yang belum terbukti; Root utama dan recovery dengan credential/pemilik/jalur login independen. Data153 adalah baseline terakhir, bukan pembacaan cloud154. Limiter durable, enrollment atomik, cookie revocation dan recovery E2E tetap belum selesai.

## File berubah

- Proposal: Finance151-HARDENING-SOURCE.sql dan STAGING-PROPOSAL.sql hasil generator; Finance151-PREFLIGHT-READONLY.sql; Access152-NATIVE-SESSION-PROPOSAL.sql. Kontrak bisnis dan rollback SQL existing tidak diubah.
- Harness: scripts/test-finance-151-local.mjs dan test-access-152-local.mjs, mode154/output baru; scripts/lib/restore-manifest-154.mjs beserta declaration, scripts/compare-restore-154.mjs; tests/hub/restoreManifest154.test.ts.
- Bukti/prosedur: dua SQL results154, RESTORE-CHECKS.sql, RESTORE-REHEARSAL.md dan laporan ini; penunjuk hasil pada review151/readiness152/preflight153 serta roadmap/piketdev/cleanings.

**GO lokal untuk review perbaikan PF01 dan permintaan ACC persiapan. NO-GO eksekusi migrasi/aktivasi/deployment:** restore aktual berizin, parity managed owner/platform, keputusan identitas dan bukti runtime/recovery masih wajib. Tidak menandai migrasi READY berdasarkan fixture/unit tests saja.
