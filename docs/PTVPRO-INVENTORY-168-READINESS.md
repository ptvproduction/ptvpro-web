# PTV-DEV-168 — kesiapan consumer Inventaris/Storage

> Kelanjutan169: [audit tiga gate dan keputusan terbaru](PTVPRO-INVENTORY-169-READINESS.md). Rouf dipilih untuk koordinasi, akun Recovery Admin tetap utuh. Constraint identity menuntut tester terpisah; belum provisioning. Hosted0Preview/0custom environment; SQL168 tetap belum di-ACC/dijalankan.

26 Oktober 2026, operator zidnal. **NO-GO cutover keamanan; integrasi PARTIAL.** Tidak deploy, revoke, DDL cloud, perubahan akun/role, commit atau push. Production hanya metadata deployment read-only. Login, valuasi dan rollback167 yang sudah PASS tidak diulang.

## Perubahan yang dijalankan

Pemilih existing `usesInventoryPortal` kini menerima MODE staging atau penanda eksplisit VITE_APP_ENV=staging untuk build hosted. Keduanya wajib memakai origin HTTPS project `swadgljnyelsjstqqxbm`; konfigurasi salah berhenti sebelum fallback native/mock. Di luar penandaan Staging, pemilihan existing dipertahankan. Helper direuse Inventaris manager/service, Universal Search, peminjaman dan shared report. Cookie peminjaman GET dibuat eksplisit; adapter tidak lagi menginisialisasi native client sebelum memilih backend cookie.

Pemeriksaan loadEnv aktual: mode staging, APP_ENV staging, auth vercel, Inventaris supabase, project tepat. Ini pemeriksaan konfigurasi build, **bukan runtime hosted**. Tidak memulai login/cloud CRUD ulang. Tidak mengubah UI, kontrak API atau skema cloud.

## Matriks consumer dan dependensi aktual

| Consumer/operasi | Pengganti Staging dan capability server | Status / sisa dependensi |
| --- | --- | --- |
| Katalog/detail/unit/search, termasuk pemakai service pada Acara | `/api/inventaris`, inventory.view | PASS lokal; shared service dan search memilih cookie juga pada hosted build yang ditandai Staging |
| Next code/create/edit master+unit | inventory.create / inventory.edit, RPC atomik server existing | PASS regresi; native create/update/next-code EXECUTE tetap menunggu cutover |
| Valuasi baca/simpan/hapus | inventory.valuation.view / inventory.valuation.manage | PASS167 cloud dipertahankan; regresi lokal PASS; tidak mengulang index/upsert cloud |
| Upload dan diagnostik | API cookie; upload inventory.create ATAU inventory.edit, origin/MIME/size/path server | PASS regresi; tidak memakai upload/listBuckets browser pada Staging |
| Cleanup foto | Jalur cookie tidak menghapus otomatis ketika hasil transaksi belum pasti | Native remove hanya cabang legacy non-Staging; jangan mengaktifkan cleanup native sebagai fallback |
| Loan/history/checkout/return/single-return | `/api/peminjaman`, loans.view dan loans.checkout / loans.return; account/iat server | PASS regresi termasuk hosted-staging dan unit-parent history; tabel loan RLS tanpa policy tetap default-deny |
| Damage/QC | `/api/lapor-kerusakan`, damage.view dan damage.report / damage.qc.approve | Consumer cookie PASS lokal; native SECURITY DEFINER database masih terbuka: PARTIAL |
| Shared Lost & Found | API cookie pada Staging; capability lostfound.view/report/manage | Native Lost & Found di luar Staging dipertahankan; jangan blanket-revoke fungsi shared |
| Backend tabel/Storage/RPC | Service-role setelah pemeriksaan sesi live/capability; tidak bergantung grant anon/authenticated | Jalur server existing dipertahankan; jangan revoke service_role atau fungsi `_server` |
| URL gambar public inventory | URL media existing, bukan consumer Data API/list metadata | Kontrak dipertahankan; perlu smoke HTTP public-media saat cutover aktual, model RLS lokal bukan bukti Storage HTTP |

Pencarian terarah pada source aplikasi/API menemukan akses langsung objek Inventaris dalam service legacy, Universal Search dan adapter loan/report. Semua cabang operasional yang **ditandai Staging** kini memilih API cookie. Kode native di luar Staging tetap ada untuk kompatibilitas; tidak menyatakan seluruh deployment otomatis memakai pengganti. Modul lain, SQL historis dan script administratif bukan consumer browser yang otomatis dihapus. Pemeriksaan identity existing mengonfirmasi refreshLiveSession memperbarui session.capabilities sebelum handler write.

## Shared native report — paket siap review, belum cloud

Sumber aktual private write_report masih MD5 `050ec0fe8d7414999c6654e9e7c41ee9`. Snapshot [baseline](PTVPRO-INVENTORY-168-REPORT-BASELINE.sql), [proposal](PTVPRO-INVENTORY-168-REPORT-PROPOSAL.sql) dan [rollback](PTVPRO-INVENTORY-168-REPORT-ROLLBACK.sql) disiapkan. Proposal menambah satu guard: damage dengan p_account_id NULL ditolak42501. Guard service_role, active account, session/capability dan seluruh logika existing tetap ada. Native Lost & Found tidak diblokir secara massal. Tidak mengubah ACL, policy atau data.

- SHA256 proposal: `11c252add3f0dc5b89a66a37ea4ef97d2a242dc2583b336f04383f18796f9ff0`.
- SHA256 rollback: `ad353743da60d2c21ec0c684c71ca6c48a51ba0b280deea489a4d44f71d443fd`.
- Keduanya memerlukan marker persetujuan project, CAS fingerprint sebelum/sesudah; repeat idempoten dan drift ditolak. Marker bukan pengganti ACC manusia atau pemilihan project MCP yang tepat.
- [Rehearsal lokal](PTVPRO-INVENTORY-168-REPORT-LOCAL-RESULTS.json):14 checks PASS memakai body aktual pada PostgreSQL17 terisolasi. Native damage ditolak, spoof account server ditolak, server damage/native+server Lost & Found tetap mencapai gate akun existing; owner/ACL/security/search_path terjaga, rollback memulihkan sumber persis. DB fixture dihapus/server dihentikan.
- **Batas bukti:** akun/tabel lokal sintetis kosong; bukan operasi penuh damage/QC/Lost & Found dengan data cloud. Tidak mengulang rehearsal valuation/ACL167. Proposal **belum diterapkan**, sehingga native bypass belum dinyatakan tertutup.

## Bukti hosted

Read-only Vercel: project `ptvpro-web`, ID `prj_U1Rtauj8BlOwusamXhsEKATqCYdM`, team `team_MYSLnI6crKW78Hb7Lw3CFlOV`. Daftar target Preview mengembalikan0 deployment. Deployment terbaru yang tersedia `dpl_8Zd2kbvW3JekKXDh1GuwA9Px4szw`, READY, target Production, commit `d6ce79868943fcb95979af4b2cef57b0c1a44459`; ini **tidak** dianggap consumer Staging aktif. File tree API mengembalikan404; tidak menebak isi/source/environment deployment. Tidak melakukan HTTP login/mutasi terhadap target Production.

| Lapisan | Bukti168 | Keputusan |
| --- | --- | --- |
| Localhost terhadap cloud | Hasil165–167 tetap referensi; tidak diuji ulang168 | PASS historis sesuai lingkup masing-masing |
| Source/regresi routing |64 tes/5 file PASS, termasuk MODE production + APP_ENV staging dan penolakan project salah | PASS lokal |
| Build Staging | typecheck/lint/build --mode staging PASS; warning ukuran chunk existing | PASS build, bukan aktivasi |
| Deployment Staging aktual | Tidak ada Preview pada project terhubung; endpoint/cookie/consumer hosted belum dibuktikan | BELUM TERVERIFIKASI |

Checklist aktivasi untuk operator setelah izin deploy terpisah: pilih deployment **Staging**, tetapkan MODE staging atau APP_ENV staging dengan URL exact Staging; pastikan adapter service/API terbaru dikemas bersama; `/api/inventaris`, `/api/peminjaman`, `/api/lapor-kerusakan`, `/api/lost-found` dan auth lifecycle tersedia pada origin sama. Verifikasi konfigurasi server privat melalui kanal existing tanpa mencetak nilainya. Rekam deployment ID/source digest/build command/project ref, anon401, cookie berizin, capability403, network tanpa Data API/native Storage write, database fixture+histori dan cleanup. Jangan menandai hosted PASS berdasarkan dist/localhost atau metadata READY saja. `vercel.json` tidak diubah dan izin deploy tidak diasumsikan.

## Tes negatif dan keputusan minimal pengguna

Fresh read-only:27 total akun, hanya2 aktif; masing-masing tujuh grant inventory dari profil dan tidak ada deny inventory pada akun aktif. Tidak tersedia akun aktif terbatas yang sudah terkonfirmasi untuk tes negatif Inventaris. Tidak login sebagai akun lain, membuat credential, mengaktifkan akun atau mengubah role. [Rencana negatif167](PTVPRO-INVENTORY-167-NEGATIVE-TEST-PLAN.json) tetap siap dengan identity null dan seluruh kasus wajib403; jangan mengisi identitas spekulatif. Tes sintetis64 bukan pengganti negative-role cloud.

Keputusan minimum: (1) ACC eksplisit proposal guard report168 dengan hash di atas, Staging saja, berikut pengujian fixture damage/QC serta kompatibilitas Lost & Found; (2) tunjuk akun penguji existing sah, persetujuan pemilik, credential privat existing dan capability yang memang ditolak. Jika harus aktivasi/provisioning, perlu persetujuan baru yang menyebut akun dan hak tepat; jangan mengubah Root/recovery; (3) tentukan target hosted Staging dan otorisasi deploy terpisah atau sediakan deployment Staging yang sudah aktif. Tidak meminta password baru. ACC index167 tidak mencakup keputusan ini.

## Checklist GO/NO-GO dan urutan final

1. PASS: valuasi167, positif cloud165–167, rollback model167. Jangan diulang tanpa perubahan relevan.
2. PASS lokal: routing consumer168 dan paket report/rollback; **PARTIAL cloud report**, perlu ACC DDL terpisah dan uji operasi/negative native yang relevan.
3. BLOCKED: limited-account negative-role cloud belum tersedia. Siapkan fixture oleh aktor lain yang sah; cek403 dan tidak ada row/object berubah, lalu cleanup sendiri.
4. BLOCKED: hosted Staging activation belum terbukti. Selesaikan checklist hosted sebelum menyentuh grant.
5. Setelah2–4PASS, refresh ACL/owner/grant-option/policy dan dependensi; susun paket privilege final yang menyertakan gate native damage. Candidate166 tetap terkunci NO_GO_166, **bukan SQL siap eksekusi**. Jangan revoke fungsi shared Lost & Found, service_role, bucket lain atau public-media secara spekulatif.
6. Rehearse paket final+rollback pada isolasi yang disetujui. Rehearsal167/model dan guard168 tidak otomatis memvalidasi paket gabungan baru.
7. Minta persetujuan eksplisit hash paket privilege final. Di168 pencabutan grant tetap dilarang walaupun gate lain nanti lolos.
8. Hanya dalam sesi berizin cutover: aktifkan consumer terlebih dahulu, verifikasi, transaksi privilege khusus objek yang disepakati, lalu probe anonim/native ditolak, cookie berizin berhasil, negative-role403 dan public media/bucket lain tetap bekerja.
9. Bila gagal, gunakan rollback ACL/policy166 yang telah dicocokkan fresh snapshot serta rollback report168 jika CAS cocok dan pemulihan itu diotorisasi. Ini membuka kembali surface native, bukan memperbaiki keamanan. Jangan hapus unique index167 atau baris operasional. Revalidasi rollback dengan bukti aktual.

**Final: NO-GO cutover.** Blocker faktual: guard report belum di-ACC/dipasang cloud, identitas terbatas belum tersedia, hosted Staging belum aktif terbukti, paket privilege final belum direhearsal/di-ACC. Semua grant lama tetap; tidak ada privilege/DDL cloud dieksekusi168. Hygiene CLN-179.
