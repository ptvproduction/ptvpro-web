# Phase 1 / ACC-2 — PTVPRO — PHASE 1 / ACC-2: NONAKTIFKAN AKSES AKUN TESTING

Operator memberikan ACC terbatas untuk menonaktifkan akses login dua akun testing pada Supabase Staging `swadgljnyelsjstqqxbm`:

- PTV-STG-ADM
- PTV-STG-KRU

Tujuan: kedua akun tidak dapat login atau menggunakan sesi lama, tetapi seluruh identitas dan histori tetap dipertahankan.

Kerjakan dalam satu sesi:

1. Verifikasi fingerprint Staging dan UUID tepat kedua akun berdasarkan manifest ACC-2. Pastikan tidak ada drift identitas atau dependensi kritis.
2. Gunakan jalur administratif yang sah untuk menonaktifkan kedua user_account secara atomik dan mencatat audit perubahan.
3. Cabut sesi native Supabase Auth dan sesi portal milik kedua akun melalui mekanisme resmi yang didukung. Jangan melakukan raw DELETE pada auth.sessions, refresh_tokens, atau tabel Auth internal.
4. Pastikan token/sesi lama tidak lagi dapat digunakan untuk mengakses jalur yang dilindungi. Jika revocation penuh tidak dapat dibuktikan, jangan mengklaim akses telah dicabut sepenuhnya; laporkan batasnya.
5. Pertahankan canonical_identity, organization_membership, profile, native user, serta seluruh transaksi Finance, audit, acara, peminjaman, inventaris, dan laporan masalah.
6. Lakukan postflight terarah: dua akun nonaktif, tidak ada login aktif yang masih sah, histori dan atribusi tetap utuh, Root tetap 0, lifecycle/password gate tetap OFF.
7. Pertahankan maintenance Staging sampai keputusan pembukaan kembali diberikan.

BATASAN:
- Staging saja. Production dilarang diakses.
- Tidak ada DELETE data historis atau penggantian actor_id.
- Tidak ada provisioning akun baru, enrollment, linking, bootstrap, atau aktivasi Root.
- Jangan mengubah frontend, deployment, atau environment variables.
- Jangan commit/push/deploy atau mengulang audit global.
- Jika perlu mutasi di luar cakupan ACC ini, STOP dan minta persetujuan baru.

OUTPUT:
- Status penonaktifan masing-masing akun.
- Status pencabutan sesi dan batas verifikasinya.
- Bukti histori tetap utuh.
- Status maintenance.
- Satu langkah berikutnya untuk provisioning PTV-001/PTV-002.akun testing dan rencana enrollment

26 Oktober 2026. Klarifikasi operator menggantikan asumsi sebelumnya: PTV-STG-ADM dan PTV-STG-KRU adalah **akun testing**, bukan akun kandidat Root. Penandaan dilakukan pada manifest/rencana lokal ini; tidak ada metadata akun cloud diubah. Akun testing tidak boleh dipakai ulang, diganti namanya, atau ditautkan ke PTV-001/PTV-002.

## Dependensi aktual Staging (read-only)

Fingerprint fisik cocok ACC-1. Katalog FK diperiksa untuk account, canonical, native user/session; hitungan berikut gabungan kedua akun, bukan jumlah baris unik lintas objek.

| Objek/relasi | Baris terkait | Keputusan |
| --- | ---: | --- |
| public.user_account / canonical_identity / organization_membership / account_profiles | masing-masing 2 | Pertahankan; klasifikasi testing bukan izin hapus |
| public.auth_audit_log.actor_id | 2 | Pertahankan audit dan actor asli |
| public.ptv_acara.created_by | 2 | Pertahankan |
| public.ptv_peminjaman.actor_id | 2 | Pertahankan |
| public.ptv_lapor_masalah.pelapor_id / qc_approved_by | 1 / 1 | Bisa baris sama; pertahankan |
| public.ptv_inventaris.created_by → auth.users | 1 | ON DELETE SET NULL akan menghilangkan atribusi; jangan hapus native user |
| public.ptv_finance_transactions.created_by | 58 | Soft reference, pertahankan seluruh transaksi dan pembuatnya |
| public.ptv_finance_audit_log.actor_id | 9 | Soft reference, pertahankan |
| auth.users / identities | 2 / 2 | Tidak dihapus; native-user delete berpotensi cascade |
| auth.sessions / refresh_tokens / mfa_amr_claims | 4 / 84 / 4 | State autentikasi; jangan hapus/revoke tanpa ACC khusus |

FK lain yang diperiksa memiliki 0 baris terkait, termasuk credential portal, overrides, contact, login_history, kas, content planner, surat dan private lifecycle sessions/attempts. Soft reference terarah: borrower loans0, catatan created_by0, archive canonical0, audit metadata0, kru_terlibat surat0, auth.flow_state0. Ini bukan jaminan seluruh string/JSON/Storage/platform/external reference sudah tercakup; hard delete tetap NO-GO. Klasifikasi akun testing **tidak berarti** transaksi/riwayat tersebut data dummy atau boleh dihapus.

## Daftar pembersihan yang menunggu persetujuan

**DELETE yang diusulkan saat ini: tidak ada.** Pilihan aman adalah mengarsipkan akses testing, bukan menghapus identitas/histori.

1. Dengan ACC terpisah dan payload/CAS direview: tandai canonical metadata sebagai testing tanpa mengubah UUID/PTV/provenance; nonaktifkan dua user_account melalui jalur administratif tepercaya dan audit perubahan. Ini belum dijalankan. Tidak menghapus profile/overrides/membership.
2. Jika penonaktifan disetujui, rencanakan cutoff/revocation native Auth dan portal yang benar; status akun saja bukan bukti semua token native dicabut. Ini mengubah sesi sehingga memerlukan ACC eksplisit; jangan raw DELETE auth tables.
3. Simpan canonical identities, memberships, account tombstones, native identity attribution, seluruh Finance/audit/acara/peminjaman/laporan/inventaris. Jangan mengganti actor dengan kandidat Root.
4. Hard delete bukan syarat enrollment. Jika kelak diminta, perlu daftar rowset privat lengkap termasuk soft references/platform, kajian retensi dan pemulihan, ACC baru. Jangan cascade atau SET NULL secara otomatis.

## Rencana enrollment kandidat (belum eksekusi)

- PTV-001 dan PTV-002 memakai **production_id UUID historis** yang telah ada pada masing-masing legacy_archive_kru, bukan UUID akun testing atau WordPress ID. Referensi pseudonim dari pemeriksaan sebelumnya: PTV001 source6b9f8c2e58bf/archiveae5e2f3fdbe6; PTV002 source0ee0cd077f6e/archive17aa6608109e. Nilai UUID lengkap tetap dalam database, tidak disalin ke laporan publik. Setiap sumber memiliki satu arsip; personel historis tidak dibuat ulang.
- Belum ada canonical yang memiliki tuple provenance sumber untuk kedua personel. Diperlukan proposal administratif atomik dan idempotent yang **belum tersedia untuk provisioning target ini**: assert physical fingerprint; kunci transaksi; unique provenance+PTV checks; reuse canonical bila sudah terbukti cocok, selain itu buat representasi canonical dari satu UUID sumber yang sama; satu membership dan akun login baru per identitas; audit; rollback menyeluruh. Pembuatan canonical adalah representasi target atas personel existing, bukan personel baru/UUID historis pengganti. Konflik apa pun STOP, tidak merge atau mengambil alih akun testing.
- Pisahkan provisioning canonical/account dari linking arsip. Tidak mengubah legacy_archive_kru pada tahap persiapan ini. Proposal linking149 sekarang belum terpasang, memerlukan bootstrap/recovery attestation dan menolak self/Root target. Jangan bootstrap untuk mengakali siklus tersebut. Review prosedur administrative initial mapping yang sempit sebelum implementasi/ACC; ACC-4 saja tidak otomatis menyelesaikan konflik guard.
- Fungsi terpasang ptv_auth_private.enroll_password hanya menerima **akun existing** dengan identity/version/CAS cocok, manifest direview, principal administratif dan bcrypt cost10 sesuai kontrak. Fungsi ini bukan pembuat akun/canonical dan tidak memerlukan bootstrap lebih dahulu. Tidak dapat langsung dipakai ketika target belum dibuat. Tidak ada credential sintetis atau hash Legacy yang disalin.
- Pilih jalur login resmi yang disetujui (password privat atau provider terverifikasi), dua pemilik/kredensial/recovery terpisah. Koleksi secret melalui jalur privat manusia, bukan chat/log/script argument. Review profil awal dan capability recovery secara eksplisit; tidak menambahkan Root atau izin manage otomatis.
- Konflik WordPress PTV002 hanya relevan terhadap provenance akun/credential/privilege WordPress jika dipakai; **tidak mengganti UUID personel yang sudah dikonfirmasi**. Enrollment baru independen tidak perlu mewarisi akun/role/password WordPress.
- Urutan: ACC proposal provisioning/mapping terbatas dan profil awal → rehearsal sintetis terarah untuk jalur baru → ACC pemasangan/target provisioning serta enrollment privat → ACC-3 login/recovery terkontrol → ACC-4 bootstrap bertanda tangan setelah prasyarat lengkap. Gate lifecycle/password tetap OFF sepanjang sesi ini; aktivasi bukan termasuk ACC-2 saat ini.

## Hasil dan batas

Tidak ada DDL/DML, DELETE, provisioning, credential enrollment, linking, revoke, bootstrap atau Production access. Maintenance dipertahankan, listener5174=0. Tidak mengulang audit global, rehearsal ACC-1 atau suite aplikasi; tidak source/SQL/UI/env change. Bukti dependensi tersanitasi: PTVPRO-PHASE1-ACC2-TESTING-DEPENDENCIES.json.

**Satu keputusan operator berikut:** setujui arah retain-and-disable dua akun testing (tanpa DELETE) serta penyusunan proposal provisioning/mapping awal untuk dua akun baru berbasis UUID historis, dengan pilihan jalur login dan profil awal. Persetujuan arah ini bukan eksekusi perubahan akun/sesi/gate/Root.
