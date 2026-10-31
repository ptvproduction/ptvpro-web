# PTV-DEV-169 — keputusan tiga gate Inventaris/Storage

> **Final171: COMPLETE Cloud Staging security.** Tester pasca-bootstrap Root-authorized,25negative hosted PASS, retirement0sesi, cutover5tabel/6RPC/Storage inventory dan postflight hosted PASS. [Receipt final171](PTVPRO-INVENTORY-171-EXECUTION.json). Status blocker/readiness169–170 di bawah adalah riwayat; tidak memerlukan keputusan tambahan untuk scope ini.

> **Eksekusi170 (26–27 Oktober):** Preview hosted nyata dan guard report sudah PASS setelah ACC. Persetujuan Rouf SUDAH dikonfirmasi; blocker kini kanal enrollment privat tester pasca-bootstrap, bukan persetujuan. Grant belum dicabut. Lihat [receipt eksekusi170](PTVPRO-INVENTORY-170-EXECUTION.json) dan handoff170; bagian169 berikut historis, jangan memulai audit/readiness ulang.

26 Oktober 2026, zidnal. **NO-GO cutover; tidak ada perubahan privilege, akun, DDL cloud atau deployment.** Rouf/PTV-002 ditunjuk pengguna sebagai pemilik koordinasi tes; ini bukan bukti persetujuan langsung Rouf untuk provisioning. Akun utamanya tetap Recovery Admin, aktif dengan profil crew+eksekutif berdasarkan fresh read-only. Tidak mengirim pesan kepadanya otomatis.

## 1. Audit paket native damage guard

Paket168 tidak diubah: [proposal](PTVPRO-INVENTORY-168-REPORT-PROPOSAL.sql), [rollback](PTVPRO-INVENTORY-168-REPORT-ROLLBACK.sql), [baseline](PTVPRO-INVENTORY-168-REPORT-BASELINE.sql).

| Pemeriksaan169 | Hasil |
| --- | --- |
| Body cloud write_report | MD5 `050ec0fe8d7414999c6654e9e7c41ee9`, sesuai baseline168; belum dipatch |
| SHA256 proposal | `11c252add3f0dc5b89a66a37ea4ef97d2a242dc2583b336f04383f18796f9ff0`, tidak berubah |
| SHA256 rollback | `ad353743da60d2c21ec0c684c71ca6c48a51ba0b280deea489a4d44f71d443fd`, tidak berubah |
| Pemanggil rutin pada katalog/source scan | public.rpc_write_report dan public.rpc_write_report_server; tidak ada caller rutin lain pada pencarian target tersebut |
| Native wrapper | SECURITY INVOKER; authenticated EXECUTE; meneruskan account/iat NULL |
| Server wrapper | SECURITY INVOKER; service_role EXECUTE, bukan authenticated; meneruskan account/iat server |
| Private writer | postgres owner, SECURITY DEFINER, search_path pg_catalog/public/auth; EXECUTE postgres/authenticated/service_role |
| can_report server | Membatasi jenis capability report, akun aktif, session iat/cutoff, deny override, serta allow/profile grant; fingerprint `b3e2e6b3d9d16608129e48a1c181058b` |
| Dampak statement DDL | Hanya CREATE OR REPLACE fungsi yang sama dari definisi aktual; tidak memanggil write_report, tidak menulis baris, tidak mengubah signature/ACL/policy/index |
| Idempotensi/drift/rollback | Transaksi+timeout, marker persetujuan, CAS body sebelum/sesudah; repeat no-op; sumber tak dikenal ditolak.14checks lokal168 tetap berlaku, tidak diulang |

Guard menolak semua operasi damage native ketika p_account_id NULL. Caller native tidak bisa menyiasati dengan account ID karena guard existing mensyaratkan JWT role service_role untuk account non-NULL. Native Lost & Found tetap menggunakan cabang existing. Guard ini **tidak memvalidasi cookie di PostgreSQL**: cookie/lifecycle tetap diperiksa API Portal sebelum server wrapper, lalu DB memeriksa capability/cutoff. Service-role tetap trusted backend, bukan credential penguji.

CREATE OR REPLACE mempertahankan owner/ACL dan dependensi signature; tidak perlu DROP/CASCADE. Source scan tidak membuktikan semua pemanggil dinamis atau deployment lama sudah berpindah: gate hosted tetap wajib. Jumlah inventaris read-only saat audit164 master/251unit/1report; tidak ada fixture ditulis169. Proposal tidak mengubah data, tetapi **secara sengaja menghentikan consumer damage native lama**. Karena hosted belum teridentifikasi aktif, perubahan fungsi tidak disarankan dieksekusi mendahului verifikasi consumer.

**Status SQL: READY FOR EXPLICIT STAGING REVIEW/ACC, belum execution-ready operasional.** ACC yang diperlukan harus menyebut hash proposal, target project, uji fixture cloud damage/QC+kompatibilitas Lost & Found, serta izin rollback hash pasangannya jika gate gagal. Marker ptv.inventory168.approved_project bukan verifikasi lokasi database dan bukan persetujuan manusia. Eksekutor wajib pin MCP project Staging, fresh-check body/owner/security/ACL, quiesce perubahan fungsi lain, baru apply_migration yang sesuai. CAS body tidak mengunci DDL administrator lain; hentikan jika ada drift metadata. Tidak ada ACC baru pada169.

Rollback hanya menghapus guard bila body patched sesuai; repeat baseline no-op dan drift ditolak. Tidak menghapus data/index167 dan tidak memulihkan privilege lain. Risiko rollback: jalur damage native kembali terbuka. Post-DDL perlu uji native damage42501 pada identitas native yang sah atau model lokal berlabel; credential Portal tidak boleh dipalsukan menjadi JWT Supabase.

## 2. Tes negatif terisolasi di bawah koordinasi Rouf

Fresh schema menetapkan UNIQUE(user_account.identity_id), UNIQUE(username) dan UNIQUE(auth_user_id). Karena itu **akun kedua dengan canonical identity Rouf tidak valid** dan tidak boleh mengubah constraint agar memungkinkan. Profil crew juga terlalu luas: sudah mempunyai loans.checkout/return, damage.report, inventory.view dan inventory.valuation.view.

[Rencana terstruktur169](PTVPRO-INVENTORY-169-NEGATIVE-PLAN.json) menyiapkan satu identitas sintetis Staging berlabel jelas, username usulan `stg-inventory-neg-169` (belum ada saat preflight), **bukan salinan identitas Rouf**. Alternatif yang lebih sedikit provisioning adalah akun existing terbatas dengan pemilik sah; belum ada yang dikonfirmasi. Tidak mengaktifkan akun inactive milik orang lain.

Perubahan minimum yang perlu ACC jika memilih tester sintetis: satu canonical_identity bertag purpose/session/coordinator, satu membership aktif/current ptv_studio, satu user_account Portal, enrollment credential lewat kanal privat sah, serta overrides hanya pada akun tester. Tidak memerlukan DDL menurut skema yang diperiksa. auth_user_id boleh NULL; jangan membuat auth.users atau JWT native tanpa kebutuhan dan ACC tambahan. Tidak menyalin password/role Rouf, tidak memberikan profil crew/eksekutif/root.

- Fase A: allow hub.access saja, deny mutation target secara eksplisit. Cookie valid tetapi baca Inventaris/valuasi/loan/damage harus403.
- Fase B: tambahkan allow inventory.view, inventory.valuation.view, loans.view, damage.view hanya pada tester. Pertahankan deny inventory.create/edit/delete/units.manage/valuation.manage, loans.checkout/return, damage.report/qc.approve. Baca200; operasi tulis terkait403 sebelum RPC/Storage write. Upload harus403 karena create DAN edit ditolak.
- Perubahan A→B termasuk izin privilege tester, sehingga harus tercakup ACC; bukan perubahan role Rouf. Fixture dipersiapkan aktor independen yang berizin, hanya ID milik pengujian. Bandingkan row/object sebelum-sesudah setiap penolakan; anonim401 sebagai kontrol. Tes bukan transaksi rollback data operasional.
- Penutupan yang juga perlu dicakup ACC: logout/revoke sesi tester, nonaktifkan hanya tester dan majukan cutoff; pertahankan audit/identitas bertag untuk provenance, cleanup fixture sendiri. Jangan DELETE CASCADE atau mematikan Recovery Admin.

**11tes simulasi policy PASS169**, membuktikan dua konfigurasi minimum bekerja pada engine aktual dan tidak memutasi konteks Recovery Admin. Ini bukan identitas cloud, persetujuan Rouf, login cookie nyata, atau capability403 cloud. Tes negatif cloud tetap NOT EXECUTED. Diperlukan persetujuan langsung Rouf melalui koordinasi manusia dan ACC provisioning spesifik di atas.

## 3. Target Hosted Staging aktual

Konfigurasi lokal loadEnv staging menunjuk swadgljnyelsjstqqxbm, APP_ENV staging/auth vercel/inventory supabase. Tidak ada key host/origin/app-url/api-url/vercel pada konfigurasi VITE efektif yang diperiksa. package.json memuat dev:staging loopback5174 dan build generik; vercel.json hanya routing API/SPA, bukan deklarasi target Staging. Tidak membaca atau menyalin nilai environment privat.

Read-only Vercel team yang terhubung `team_MYSLnI6crKW78Hb7Lw3CFlOV`:

| Objek | Bukti169 |
| --- | --- |
| Project terdaftar | Hanya ptvpro-web / prj_U1Rtauj8BlOwusamXhsEKATqCYdM pada halaman lengkap satu item |
| Target Preview |0deployment |
| Custom environment |0environment; metadata accountLimit.total=0, bukan asumsi ketersediaan paket Staging |
| Domain project | ptvpro.com redirect308→www.ptvpro.com; www.ptvpro.com; keduanya gitBranch/customEnvironmentId NULL |
| Alias metadata project | ptvpro-web-ptvpro-web.vercel.app dan alias git-main; nama alias bukan bukti Staging |
| Deployment terakhir | dpl_8Zd2kbvW3JekKXDh1GuwA9Px4szw, READY, target production; sama referensi168 |

**Tidak ditemukan target Hosted Staging terkonfigurasi/aktif pada konfigurasi dan akses project ini.** Jangan menyamakan URL Vercel default, git-main, atau domain utama dengan Staging; tidak melakukan login/mutasi HTTP ke sana. Cakupan temuan terbatas team/project yang terhubung; tidak menyatakan tidak ada host di akun/platform lain yang belum diberikan.

Usulan minimum untuk keputusan pengguna adalah Preview terisolasi pada ptvpro-web yang dipin ke backend Staging, bukan custom environment berbayar atau alias domain Production. Belum ada URL/deployment ID untuk diuji. Aktivasi memerlukan ACC tersendiri untuk target, konfigurasi Preview dan snapshot source yang direview; tidak deploy dari seluruh dirty tree secara otomatis. Setelah disetujui, manifest source/API/build dan isolasi environment harus disiapkan sebelum deploy. Jangan mempromosikan deployment atau mengubah domain/setting Production. Hosted tetap BLOCKED, bukan PASS build.

## GO/NO-GO efektif169

| Gate | Status | Langkah berikutnya |
| --- | --- | --- |
| Login/valuasi/consumer cookie lokal/rollback167–168 | PASS historis sesuai bukti lama | Tidak diulang karena aplikasi/SQL tidak diubah169 |
| Native guard dan rollback review | PASS review+drift read-only;14checks lokal168 | ACC hash dan consumer hosted siap sebelum DDL cloud; cloud compatibility belum PASS |
| Penguji negatif | Rencana+11simulasi lokal PASS; cloud BLOCKED | Persetujuan Rouf dan ACC identitas tester/overrides/enrollment/retirement terisolasi |
| Hosted Staging | BLOCKED, belum ada target aktif terbukti | Pilih/otorisasi Preview Staging; bila target lain sudah ada, berikan identitas project/URL untuk pemeriksaan read-only |
| Privilege cutover | NO-GO | Semua gate sebelumnya, fresh snapshot/rehearsal paket final dan ACC terpisah; candidate166 tetap terkunci |

Urutan minimum: persetujuan/rencana tester dan hosted → aktivasi serta verifikasi cookie consumer hosted → ACC/eksekusi guard report dan postflight kompatibilitas → negative-role cloud → fresh paket/rehearsal/ACC privilege final. Kegagalan post-DDL memakai rollback report yang cocok CAS bila diotorisasi; tidak mencabut grant atau menghapus index167. Rollback ACL166 tetap referensi untuk cutover nanti, bukan dijalankan169.

Validasi169 hanya11tes baru, typecheck dan lint file tes PASS; review fingerprint/dependensi read-only. Tidak mengulang64tes/build/rehearsal PASS168 karena tidak ada perubahan aplikasi atau SQL. Hasil build168 tetap bukti historis, tidak diganti klaim build169. Hygiene CLN-180. Final **NO-GO**, tiga keputusan tercantum di atas; tidak ada otorisasi otomatis dari penunjukan Rouf.
