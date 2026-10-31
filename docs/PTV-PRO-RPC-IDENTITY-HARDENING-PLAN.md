# PTV PRO — RPC Identity Hardening & Anti-Spoofing Architecture Plan (Comprehensive Audit Edition)

**Subsystem:** PTV PRO Database & Supabase Security Architecture  
**Phase:** Phase 5C.1 — Staging RPC Security Hardening Pre-Execution Audit  
**Target Environment:** Supabase Staging (`swadgljnyelsjstqqxbm`)  
**Scope:** Hardening Stored Procedures against Actor/Identity Spoofing, Concurrency Deadlocks, Authorization Bypasses, and Unauthorized Mutation  
**Authoritative Contracts:**  
- [`docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md)  
- [`docs/PTV-PRO-IDENTITY-AUTH-CONTRACT.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-IDENTITY-AUTH-CONTRACT.md)  
- [`docs/PTV-PRO-PROJECT-ARCHITECTURE.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PROJECT-ARCHITECTURE.md)  
- [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql)  
- [`docs/PTV-PRO-STAGING-SECURITY-AUDIT.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-SECURITY-AUDIT.md)  
- [`docs/PTV-PRO-RPC-IDENTITY-HARDENING-DECISIONS.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-DECISIONS.md)  
**Status:** **NOT READY — BLOCKERS REMAIN (PRE-EXECUTION AUDIT COMPLETE — ZERO EXECUTION APPLIED)**  

---

> [!CAUTION]
> **BATASAN WAJIB — ZERO EXECUTION APPLIED:**  
> Seluruh analisis dan perbaikan dalam dokumen ini disusun berdasarkan audit dokumen kontrak, skema DDL, dan basis kode lokal tanpa melakukan eksekusi SQL apa pun ke staging maupun production. Tidak ada koneksi database, migrasi, DDL, DML, atau seeding yang dijalankan.

---

## 1. Klasifikasi Fakta Terverifikasi, Inferensi, Asumsi, dan Blocker (9 Area Audit)

Untuk menjaga kejujuran forensik audit, seluruh temuan diklasifikasikan berdasarkan status pembuktiannya:

### 1.1 Temuan Terverifikasi dari Kode Sumber & Skema DDL Lokal
1. **Model Relasi Identitas Aktual (`user_account`):**  
   Berdasarkan [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql` (Baris 65-79)](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql#L65-L79), kolom `user_account.auth_user_id` memiliki constraint `UNIQUE NULL`. Satu `auth.uid()` dijamin secara fisik hanya dapat memetakan ke paling banyak 1 baris akun aktif (deterministik murni). Kolom `identity_id` juga `UNIQUE NOT NULL` mengarah ke `canonical_identity.id`.
2. **Ketiadaan Constraint Unik pada `organization_membership`:**  
   Berdasarkan DDL [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql` (Baris 112-130)](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql#L112-L130), tabel `organization_membership` **tidak memiliki unique constraint** pada `(identity_id, is_current)` maupun `(identity_id, organization_id, is_current)`. Penggunaan `ORDER BY ... LIMIT 1` pada proposal awal menyamarkan potensi ambiguitas multi-baris aktif.
3. **Celah Identity & Actor Spoofing pada RPC Baseline:**  
   Pada `rpc_checkout_loan` dan `rpc_submit_official_doc` baseline, parameter input klien `p_actor_id UUID` dipercaya mentah tanpa validasi terhadap sesi `auth.uid()`, dan pada `rpc_submit_official_doc` ditulis ke kolom `disetujui_oleh`.
4. **Dead Parameters pada Pengembalian Alat:**  
   `rpc_return_loan` dan `rpc_return_single_unit` menerima parameter `p_actor_id UUID`, tetapi parameter ini diabaikan sepenuhnya dalam statement mutasi SQL.
5. **Ketiadaan Kolom Pemohon Surat (`diajukan_oleh`):**  
   Skema baseline ketiga tabel surat (`ptv_surat_tugas`, `ptv_surat_izin`, `ptv_surat_barang`) hanya memiliki kolom `disetujui_oleh`. Kolom khusus `diajukan_oleh` belum ada di baseline DDL.
6. **Constraint Unik Penomoran Inventaris & Surat:**  
   Kolom `ptv_inventaris.kode` memiliki constraint `UNIQUE`. Kolom `nomor_surat` pada ketiga tabel surat memiliki constraint `UNIQUE`. Formula `count(*) + 1` pada baseline surat rentan collision jika terdapat nomor surat yang terhapus/berlubang.
7. **Ketidaksinkronan Recovery Runbook terhadap Baseline:**  
   Runbook pemulihan Bagian 4 pada proposal awal menyertakan parameter `DEFAULT NULL`, perbaikan format regex inventaris, penguncian `ORDER BY id`, dan pencabutan hak `service_role` yang tidak ada di baseline revisi.

### 1.2 Temuan Terverifikasi dari Runtime Staging Probe (Read-Only REST)
1. **Eksekusi Anonim `rpc_get_next_inv_code`:**  
   Probe REST menggunakan `anonKey` pada [`scripts/validate-staging-cloud.mjs` (Baris 86-90)](file:///c:/Users/zidna/ptvpro/scripts/validate-staging-cloud.mjs#L86-L90) mengembalikan `HTTP 200 OK` dan kode inventaris, membuktikan role `anon` saat ini memiliki izin eksekusi aktif di Supabase Staging.
2. **Karantina Otorisasi Pembina:**  
   Profil `pembina` terisolasi dari domain keuangan dan valuasi inventaris.
3. **Keterbacaan Tabel Referensi:**  
   Role `anon` dapat membaca 5 tabel referensi sistem publik.

### 1.3 Temuan yang Memerlukan Bukti Runtime Staging (BELUM DAPAT DIVERIFIKASI TANPA METADATA DATABASE)
1. **Pemilik Fungsi Aktual (`proowner`):** Apakah fungsi di staging dimiliki oleh `postgres`, `supabase_admin`, atau role migrasi lain belum dapat dipastikan tanpa kueri katalog `pg_proc`.
2. **Hak Skema `public`:** Apakah hak `CREATE` pada skema `public` terbuka untuk role `PUBLIC`, `anon`, atau `authenticated`.
3. **Status Riil Kebijakan RLS (`pg_policies`):** Baseline revisi mengaktifkan RLS pada tabel surat dan peminjaman tanpa membuat statement `CREATE POLICY`. Status riil apakah RLS aktif dengan policy atau di-disable di staging belum dapat dipastikan tanpa membaca katalog `pg_policies`.
4. **Daftar Overload Fungsi Eksisting:** Apakah di database staging saat ini terdapat overload fungsi tanpa `p_actor_id` belum dapat dibuktikan tanpa kueri `pg_proc`.
5. **Format Nomor Surat Historis:** Apakah terdapat surat lama dengan format non-standar yang berpotensi memicu kegagalan regex ekstraksi sufiks belum dapat diverifikasi tanpa query data historis di staging.

### 1.4 Status Keputusan Manusia & Prasyarat Eksekusi
1. **Keputusan Kolom Acara (`p_event_name`) — [FINAL]:** Disetujui **Opsi 2** (menambahkan kolom terstruktur `nama_acara VARCHAR(255) NULL` ke `ptv_peminjaman`). Audit dampak 5 dimensi telah selesai; implementasi DDL ditangguhkan (*deferred*) sampai jendela rilis migrasi resmi.
2. **Keputusan Skema Audit Pengembalian (`return_actor_id`) — [FINAL]:** Disetujui **Opsi 6B** (pencatatan forensik via `auth_audit_log` tanpa menambah kolom `return_actor_id` pada `ptv_peminjaman`).
3. **Kebijakan Hak Baca (SELECT) Tabel Persuratan — [FINAL]:** Wajib memeriksa katalog `pg_policies` aktual via preflight dan mengonfirmasi kebutuhan bisnis sebelum merancang policy; dilarang membuat policy spekulatif tanpa bukti.
4. **Prasyarat Eksekusi Preflight Staging:** Eksekusi kueri preflight inspeksi (PREFLIGHT 1-10) di Supabase SQL Editor oleh operator manusia untuk mengumpulkan bukti katalog live.

---

## 2. Temuan Audit Komprehensif (9 Area Wajib)

Berikut adalah 9 temuan audit yang disusun sesuai format standar baku:

### Temuan 1: Risiko Resolusi Objek & Search Path pada `SECURITY DEFINER`
1. **ID & Keparahan:** `SEC-DEF-01` — **P1 (Tinggi)**.
2. **Status Bukti:** Terbukti dari kode lokal ([`docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L177`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L177)).
3. **Referensi File:** Proposal Bagian 2 (Baris 177, 332, 543, 692, 828).
4. **Skenario Kegagalan:** Fungsi menggunakan `SET search_path = public, auth`. Dalam PostgreSQL, jika skema `public` memiliki hak `CREATE` bagi unprivileged user atau jika skema sementara `pg_temp` dicari sebelum skema sistem, penyerang dapat membuat operator atau fungsi bayangan (shadowing) untuk membajak eksekusi prosedur berhak superuser.
5. **Dampak:** Potensi eskalasi hak istimewa (privilege escalation) pada fungsi berhak `SECURITY DEFINER`.
6. **Perbaikan Direkomendasikan:** 
   - Ubah konfigurasi runtime menjadi `SET search_path = pg_catalog, public, auth`.
   - Pastikan 100% tabel dan fungsi kustom dikualifikasikan secara eksplisit (`public.ptv_*`, `public.has_capability`, `auth.uid()`, `pg_catalog.pg_advisory_xact_lock`).
   - Jalankan inspeksi preflight terhadap hak `CREATE` pada skema `public`.
7. **Pengujian Diperlukan:** Uji eksekusi fungsi dari role `authenticated` yang tidak memiliki hak `CREATE` pada skema `public`.
8. **Keputusan Manusia:** Konfirmasi konfigurasi hak schema `public` di instance Supabase Staging.

### Temuan 2: Arbitrary Row Selection pada Resolusi Keanggotaan Organisasi
1. **ID & Keparahan:** `IDN-RES-01` — **P0 (Kritis)**.
2. **Status Bukti:** Terbukti dari kode lokal ([`docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L205-L217`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L205-L217)).
3. **Referensi File:** Proposal Bagian 2 (Baris 205-217, 367-379, 569-581, 720-732).
4. **Skenario Kegagalan:** Kueri resolusi membership menggunakan `ORDER BY CASE om.status_organisasi WHEN 'active' THEN 1 ... LIMIT 1`. Jika terdapat anomali data di mana seorang pengguna memiliki lebih dari 1 baris keanggotaan studio aktif (misal mutasi divisi yang tidak menutup baris lama, atau baris ganda dengan status berlawanan), fungsi secara arbitrer memilih baris pertama dan menyembunyikan korupsi integritas data.
5. **Dampak:** Bypass status inaktif atau inkonsistensi otorisasi keanggotaan PTV Studio.
6. **Perbaikan Direkomendasikan:** Hapus `ORDER BY ... LIMIT 1`. Ganti dengan verifikasi deterministik fail-closed: hitung `COUNT(*)`. Jika `COUNT(*) > 1`, lempar eksepsi `DATA_INTEGRITY_ERROR (23514)`. Jika `COUNT(*) = 0` atau status != `'active'`, tolak fail-closed (`42501`).
7. **Pengujian Diperlukan:** Buat test case di mana sebuah akun memiliki 2 baris `is_current = TRUE` di `ptv_studio`; pastikan seluruh RPC menolak transaksi secara fail-closed.
8. **Keputusan Manusia:** Persetujuan penambahan DDL partial unique index `idx_unique_current_studio_membership`.

### Temuan 3: Kesalahan Asumsi Keamanan Alokasi Nomor Inventaris
1. **ID & Keparahan:** `INV-NUM-01` — **P1 (Tinggi)**.
2. **Status Bukti:** Terbukti dari kode lokal & didukung dokumen ([`docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md#L374-L380`](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md#L374-L380)).
3. **Referensi File:** Proposal Bagian 2 (Baris 824-856) dan Migration Baseline (Baris 971-988).
4. **Skenario Kegagalan:** `rpc_get_next_inv_code()` beroperasi sebagai transaksi pembacaan mandiri. Kunci `pg_advisory_xact_lock(1001)` langsung dilepas saat fungsi selesai. Jika dua pengguna membuka dialog pendaftaran alat bersamaan, keduanya menerima nomor pratinjau yang sama (misal `INV-042`). Saat keduanya menekan submit di browser, pengguna kedua mengalami tabrakan constraint unik.
5. **Dampak:** Asumsi salah bahwa advisory lock menjamin alokasi bebas benturan saat penyimpanan.
6. **Perbaikan Direkomendasikan:** 
   - Klasifikasikan fungsi secara tegas sebagai *Read-Only Code Suggester / Preview*.
   - Rancang usulan RPC atomik `rpc_create_inventory(...)` untuk mengalokasikan kode dan menyimpan alat dalam transaksi tunggal.
   - Ganti casting `::INT` menjadi `::BIGINT` untuk mencegah integer overflow jika ada data eksternal panjang.
7. **Pengujian Diperlukan:** Uji coba dua pemanggilan simultan `rpc_get_next_inv_code()` diikuti dua operasi insert paralel.
8. **Keputusan Manusia:** Keputusan apakah implementasi form inventaris mengadopsi RPC pembuatan atomik atau mengandalkan retry UI.

### Temuan 4: Risiko Format Non-Standar Data Historis Nomor Surat
1. **ID & Keparahan:** `DOC-NUM-01` — **P1 (Tinggi)**.
2. **Status Bukti:** Didukung dokumen kontraktual & belum dapat diverifikasi di database staging.
3. **Referensi File:** [`docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md#L390-L394`](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md#L390-L394), Proposal Bagian 2 (Baris 446-514).
4. **Skenario Kegagalan:** Algoritma penomoran mengekstrak angka sufiks via regex `substring(nomor_surat from '[0-9]+$')` dengan filter bulan `v_year || '/' || v_month || '/%'`. Jika data migrasi dari legacy MySQL memuat nomor surat dengan format berbeda (misal bulan angka romawi atau sufiks huruf), ekstraksi regex menghasilkan nilai tidak terduga atau nomor berulang.
5. **Dampak:** Potensi kegagalan penerbitan surat resmi akibat tabrakan nomor unik.
6. **Perbaikan Direkomendasikan:** Jalankan kueri preflight 4 pada staging untuk memetakan seluruh pola nomor surat historis sebelum menerapkan patch.
7. **Pengujian Diperlukan:** Kueri agregasi format nomor surat pada `ptv_surat_tugas`, `ptv_surat_izin`, dan `ptv_surat_barang`.
8. **Keputusan Manusia:** Konfirmasi format data historis dan kebijakan normalisasi arsip lama.

### Temuan 5: Uncaught Database Cast Exception pada Parameter Tanggal Surat
1. **ID & Keparahan:** `VAL-BIZ-01` — **P1 (Tinggi)**.
2. **Status Bukti:** Terbukti dari kode lokal ([`docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L461-L486`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L461-L486)).
3. **Referensi File:** Proposal Bagian 2 (Baris 461, 485, 486).
4. **Skenario Kegagalan:** Input tanggal pada `p_payload ->> 'tanggal_tugas'` langsung di-cast menggunakan `::DATE`. Jika klien mengirimkan teks tanggal tidak valid (misal `'2026-02-31'` atau string sembarang), PostgreSQL melempar uncaught casting error (SQLSTATE `22007 invalid input syntax for type date`) tanpa pesan error terstruktur.
5. **Dampak:** Error runtime 500 tidak ramah yang tidak membedakan error validasi bisnis dari kegagalan sistem.
6. **Perbaikan Direkomendasikan:** Tambahkan validasi regex format tanggal ISO 8601 (`^[0-9]{4}-[0-9]{2}-[0-9]{2}$`) sebelum casting, dan validasi nilai logika tanggal.
7. **Pengujian Diperlukan:** Kirimkan payload surat dengan format tanggal cacat, tanggal non-eksisten, dan string kosong.
8. **Keputusan Manusia:** Konfirmasi kontrak format tanggal payload API.

### Temuan 6: Risiko Ambiguitas PostgREST (PGRST203) vs Penghapusan Overload Prematur
1. **ID & Keparahan:** `FNC-CMP-01` — **P0 (Kritis)**.
2. **Status Bukti:** Terbukti dari kode & inferensi arsitektur ([`docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L153-L156`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L153-L156)).
3. **Referensi File:** Proposal Bagian 1.5 dan Baseline Migration (Baris 818-1059).
4. **Skenario Kegagalan:** Proposal awal memuat perintah `DROP FUNCTION IF EXISTS ...` untuk signature tanpa `p_actor_id`. Namun pada baseline migrasi, signature yang tercatat adalah versi 8-parameter dengan `p_actor_id`. Menghapus overload tanpa memeriksa `pg_proc` staging berisiko memutus pemanggil tak terduga; sebaliknya, jika overload ada di staging dan tidak dihapus, PostgREST akan gagal dengan error `PGRST203 (More than one function was found)` saat menerima panggilan dengan jumlah argumen default.
5. **Dampak:** Outage antarmuka RPC di PostgREST atau kegagalan DDL.
6. **Perbaikan Direkomendasikan:** 
   - Wajibkan eksekusi `PREFLIGHT 1` untuk mencatat seluruh OID dan identity arguments di `pg_proc` staging.
   - Jangan jalankan DROP sebelum bukti overload di katalog database terdokumentasi.
   - Susun urutan eksekusi yang aman: verifikasi preflight $\rightarrow$ drop overload terbukti $\rightarrow$ create or replace dengan default parameter $\rightarrow$ notify pgrst.
7. **Pengujian Diperlukan:** Uji pemanggilan HTTP PostgREST dengan parameter lengkap dan parameter minimal (tanpa `p_actor_id`).
8. **Keputusan Manusia:** Konfirmasi hasil audit `PREFLIGHT 1` sebelum menyetujui langkah DROP.

### Temuan 7: Kebijakan RLS Tabel Surat Pasca-Pencabutan INSERT Langsung
1. **ID & Keparahan:** `ACC-WRT-01` — **P1 (Tinggi)**.
2. **Status Bukti:** Terbukti dari kode lokal ([`docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L142-L146`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L142-L146)).
3. **Referensi File:** Proposal Bagian 1.4 dan Baseline Migration (Baris 1077-1079).
4. **Skenario Kegagalan:** Proposal mencabut izin `INSERT` pada tabel persuratan dari `authenticated, anon, PUBLIC`. Namun, pada baseline revisi, tabel surat diaktifkan RLS-nya tanpa policy `CREATE POLICY` apa pun. Jika di staging tidak ada policy SELECT yang dibuat, penutupan jalur penulisan langsung dapat berdampak pada ketidakmampuan pengguna membaca surat mereka sendiri jika RLS berada pada status default deny.
5. **Dampak:** Potensi error izin saat membaca daftar dokumen resmi di frontend.
6. **Perbaikan Direkomendasikan:** Audit status riil `pg_policies` untuk ketiga tabel surat via kueri preflight dan siapkan policy SELECT yang sesuai jika belum ada.
7. **Pengujian Diperlukan:** Uji pembacaan data surat resmi oleh akun kru terotentikasi pasca-aplikasi patch.
8. **Keputusan Manusia:** Penetapan kebijakan akses baca surat resmi (visibilitas publik vs terbatas pemohon/approver).

### Temuan 8: Analisis Deadlock, Concurrency Lock Order, dan Hash Collision
1. **ID & Keparahan:** `CNC-DLK-01` — **P2 (Sedang)**.
2. **Status Bukti:** Terbukti dari kode lokal ([`docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L272-L283`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L272-L283)).
3. **Referensi File:** Proposal Bagian 2 (Baris 272-283, 614-632, 760-775).
4. **Skenario Kegagalan:** Lock order pada checkout (`ptv_inventaris_unit` ORDER BY id FOR UPDATE $\rightarrow$ INSERT `ptv_peminjaman`) dan return (`ptv_peminjaman` FOR UPDATE $\rightarrow$ `ptv_inventaris_unit` ORDER BY id FOR UPDATE) terbukti deterministik dan bebas dari deadlock antartransaksi. Namun pada checkout, advisory lock menggunakan `hashtext(p_transaction_id)`. Karena `hashtext()` menghasilkan integer 32-bit bertanda, terdapat kemungkinan kecil hash collision antara dua transaction ID berbeda yang memicu lock contention sementara.
5. **Dampak:** Lock contention minor (bukan deadlock) jika terjadi tabrakan hash 32-bit.
6. **Perbaikan Direkomendasikan:** Pertahankan advisory lock sebagai pelindung sesi paralel, dan pastikan integritas akhir dijamin oleh pemeriksaan eksistensi transaksi dan composite check `(transaction_id, unit_id)`.
7. **Pengujian Diperlukan:** Uji checkout paralel dengan keranjang unit yang saling bersilangan.
8. **Keputusan Manusia:** Format standar transaction ID dari frontend.

### Temuan 9: Ketidaksesuaian Klaim Restorasi Baseline pada Runbook Pemulihan
1. **ID & Keparahan:** `RCV-INT-01` — **P0 (Kritis)**.
2. **Status Bukti:** Terbukti dari perbandingan kode lokal ([`docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L958-L1236`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L958-L1236) vs [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql#L818-L1059`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql#L818-L1059)).
3. **Referensi File:** Proposal Bagian 4 (Disaster Recovery Runbook).
4. **Skenario Kegagalan:** Runbook pemulihan mengklaim mengembalikan fungsi ke versi baseline skema awal (`PTV-PRO-DATABASE-MIGRATION-REVISED.sql`). Namun definisi fungsi yang disajikan memuat parameter `DEFAULT NULL`, penguncian `ORDER BY id`, dan perbaikan regex inventaris yang tidak ada di baseline revisi asli, serta mencabut hak `service_role`. Klaim "revert to baseline" ini tidak akurat secara forensik.
5. **Dampak:** Pelanggaran integritas audit dan kebingungan operasional saat prosedur pemulihan dievaluasi.
6. **Perbaikan Direkomendasikan:** 
   - Ubah klasifikasi menjadi **Hybrid Functional Rollback (Pembalikan Logika Bisnis dengan Preservasi Proteksi Akses & Skema Kolom)**.
   - Sajikan dua opsi pemulihan terpisah secara transparan: Opsi A (Strict Historical Baseline Revert 100%) dan Opsi B (Hybrid Safe Functional Reversion).
7. **Pengujian Diperlukan:** Uji coba perbandingan output `pg_get_functiondef` pasca-eksekusi terhadap file baseline.
8. **Keputusan Manusia:** Pemilihan opsi pemulihan resmi oleh operator database.

---
---

## 3. Audit Identitas dan Keanggotaan Organisasi

Berdasarkan kontrak [`docs/PTV-PRO-IDENTITY-AUTH-CONTRACT.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-IDENTITY-AUTH-CONTRACT.md) dan skema DDL:

### 3.1 Pipeline Resolusi Identitas Kanonikal
Alur resolusi identitas wajib mengikuti rantai tepercaya:
$$\mathbf{auth.uid()} \xrightarrow{\text{verifikasi sesi}} \mathbf{user\_account.auth\_user\_id} \xrightarrow{\text{1:1 relasi}} \mathbf{user\_account.identity\_id} \xrightarrow{\text{FK}} \mathbf{canonical\_identity.id}$$

Implementasi SQL deterministik:
```sql
SELECT ua.identity_id, ua.id
INTO v_verified_identity_id, v_account_id
FROM public.user_account ua
WHERE ua.auth_user_id = auth.uid()
  AND ua.status_akun = 'active';

IF v_verified_identity_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Valid active user account not found for current session' 
        USING ERRCODE = '28000';
END IF;
```
Karena kolom `user_account.auth_user_id` memiliki constraint `UNIQUE`, kueri ini dijamin menghasilkan **paling banyak 1 baris** (deterministik murni).

### 3.2 Audit Relasi `organization_membership`
1. **Analisis Multi-Baris `is_current = TRUE`:**  
   Tabel `organization_membership` **tidak memiliki unique constraint** pada `(identity_id, is_current)` maupun `(identity_id, organization_id, is_current)`. Seorang santri dapat memiliki keanggotaan ganda (misal divisi Technical dan divisi Creative, atau pencatatan riwayat transisi divisi yang belum ditutup).
2. **Larangan Arbitrary Selection (`ORDER BY ... LIMIT 1`):**  
   Penggunaan klausa `ORDER BY CASE ... LIMIT 1` **dilarang secara mutlak** karena secara diam-diam memilih baris pertama dan menyembunyikan inkonsistensi data.
3. **Mitigasi Fail-Closed Deterministic:**  
   Pemeriksaan status keanggotaan untuk operasional PTV Studio **wajib dibatasi secara eksplisit** pada `organization_id = 'ptv_studio' AND is_current = TRUE`, dengan evaluasi integritas deterministik:
   ```sql
   SELECT 
       COUNT(*), 
       COUNT(CASE WHEN om.status_organisasi = 'active' THEN 1 END),
       MAX(om.status_organisasi)
   INTO v_member_count, v_active_count, v_status_organisasi
   FROM public.organization_membership om
   WHERE om.identity_id = v_verified_identity_id
     AND om.organization_id = 'ptv_studio'
     AND om.is_current = TRUE;

   -- Fail-Closed jika terdeteksi anomali baris ganda
   IF v_member_count > 1 THEN
       RAISE EXCEPTION 'DATA_INTEGRITY_ERROR: Inconsistent membership state (multiple current memberships in ptv_studio)' 
           USING ERRCODE = '23514';
   END IF;

   -- Fail-Closed jika tidak ada keanggotaan atau tidak aktif
   IF v_member_count = 0 OR v_status_organisasi != 'active' THEN
       RAISE EXCEPTION 'FORBIDDEN: Active organization membership required (current status: %)', 
           COALESCE(v_status_organisasi, 'none') USING ERRCODE = '42501';
   END IF;
   ```
4. **Kebijakan Alumni (`status_organisasi = 'inactive'`):**  
   Sesuai matriks kontrak Section 4.1 & 7.1, alumni memiliki `status_akun = 'active'` dan `status_organisasi = 'inactive'`. Alumni diizinkan login membaca arsip pribadi, tetapi **seluruh kapabilitas mutasi (32 mutasi termasuk checkout alat dan pembuatan surat dinas) diblokir total**.
5. **Kebijakan Pembina:**  
   Profil `pembina` memiliki kapabilitas pengawasan operasional, namun dikarantina ketat dari valuasi harga alat dan pencatatan keuangan. Pembina tidak memiliki hak checkout alat mandiri (`loans.checkout` tidak diberikan).
6. **Kebijakan Akun Ditangguhkan (`status_akun = 'inactive'`):**  
   Jika akun dinonaktifkan oleh administrator, `user_account.status_akun = 'inactive'` memicu penolakan *fail-closed* instan sebelum pemeriksaan lainnya.

### 3.3 Penyelarasan dengan `public.has_capability(...)`
Fungsi `public.has_capability(p_capability TEXT)` pada [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql` (Baris 694-807)](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql#L694-L807) telah menerapkan:
1. Pengecekan sesi anonim (`auth.uid() IS NULL` $\rightarrow$ `FALSE`).
2. Pengecekan status akun aktif (`status_akun != 'active'` $\rightarrow$ `FALSE`).
3. Karantina alumni aktif terhadap mutasi (`status_organisasi = 'inactive' AND is_mutation IS TRUE` $\rightarrow$ `FALSE`).
4. Evaluasi live override (`deny` override memiliki prioritas tertinggi).
5. Evaluasi profil akses pengguna (`profile_capabilities`).

RPC mutasi harus memanggil `public.has_capability(...)` sebagai gerbang otorisasi utama setelah resolusi identitas sesi berhasil.

---

## 4. Audit Mendalam dan Rancangan Perbaikan per RPC

### 4.1 `rpc_checkout_loan`
* **Signature Eksisting:**
  ```sql
  rpc_checkout_loan(
      p_transaction_id TEXT, p_borrower_name TEXT, p_purpose TEXT,
      p_out_date DATE, p_due_date DATE, p_event_name TEXT,
      p_unit_ids UUID[], p_actor_id UUID
  ) RETURNS JSONB
  ```
* **Signature Usulan (Kompatibel):**
  ```sql
  rpc_checkout_loan(
      p_transaction_id TEXT, p_borrower_name TEXT, p_purpose TEXT,
      p_out_date DATE, p_due_date DATE, p_event_name TEXT,
      p_unit_ids UUID[], p_actor_id UUID DEFAULT NULL
  ) RETURNS JSONB
  ```
* **Daftar Perbaikan:**
  1. **Resolusi Identitas Sesi:** Selesaikan `v_verified_identity_id` dari `auth.uid()`.
  2. **Anti-Spoofing Strict Rejection:** Jika `p_actor_id IS NOT NULL AND p_actor_id != v_verified_identity_id`, batalkan transaksi dengan error code `42501`.
  3. **Otorisasi Kapabilitas:** Verifikasi `public.has_capability('loans.checkout')`.
  4. **Pencegahan Transaksi Duplikat:** Tolak eksekusi jika `p_transaction_id` sudah ada di `ptv_peminjaman`:
     ```sql
     IF EXISTS (SELECT 1 FROM public.ptv_peminjaman WHERE transaction_id = p_transaction_id) THEN
         RAISE EXCEPTION 'DUPLICATE_TRANSACTION: Transaction ID % already exists', p_transaction_id 
             USING ERRCODE = '23505';
     END IF;
     ```
  5. **Validasi Parameter Tanggal:** Verifikasi `p_due_date >= p_out_date`.
  6. **Validasi Array Unit Ketat:** Tolak `p_unit_ids IS NULL`, array kosong (`cardinality = 0`), atau mengandung UUID duplikat (menggunakan `unnest` dan perbandingan `cardinality`).
  7. **Penguncian Deterministik Bebas Deadlock:**
     ```sql
     PERFORM id FROM public.ptv_inventaris_unit 
     WHERE id = ANY(v_deduped_unit_ids) AND status_peminjaman = 'tersedia' 
     ORDER BY id 
     FOR UPDATE;
     ```
     Klausa `ORDER BY id` memastikan seluruh transaksi mengunci baris dalam urutan indeks UUID yang identik, secara matematis mengeliminasi potensi deadlock AB-BA antarunit.
  8. **Verifikasi Ketersediaan Unit Penuh:** Pastikan jumlah baris yang berhasil dikunci sama persis dengan jumlah unit yang diminta. Jika ada yang sedang dipinjam atau rusak, batalkan dengan pesan spesifik.
  9. **Penanganan `p_event_name`:** Sesuai Keputusan 2, jangan menggabungkan string ke `keperluan` tanpa mandat kontrak. Nilai `p_event_name` dipertahankan dalam memori prosedur sementara keputusan DDL kolom acara diselesaikan.
  10. **Mutasi Atomik:** Sisipkan baris ke `ptv_peminjaman` dengan `actor_id = v_verified_identity_id`, lalu perbarui `ptv_inventaris_unit.status_peminjaman = 'dipinjam'`.

---

### 4.2 `rpc_submit_official_doc`
* **Signature Eksisting:**
  ```sql
  rpc_submit_official_doc(p_doc_type TEXT, p_payload JSONB, p_actor_id UUID) RETURNS JSONB
  ```
* **Signature Usulan (Kompatibel):**
  ```sql
  rpc_submit_official_doc(p_doc_type TEXT, p_payload JSONB, p_actor_id UUID DEFAULT NULL) RETURNS JSONB
  ```
* **Daftar Perbaikan:**
  1. **Resolusi Identitas Sesi:** Selesaikan `v_verified_identity_id` dari `auth.uid()`.
  2. **Anti-Spoofing Strict Rejection:** Jika `p_actor_id IS NOT NULL AND p_actor_id != v_verified_identity_id`, batalkan dengan `42501`.
  3. **Otorisasi Dokumen:** Verifikasi `has_capability('documents.request') OR has_capability('documents.generate')`.
  4. **Pemisahan Pengaju dan Penyetuju (Keputusan 1):**
     * Dokumen yang disubmit melalui fungsi ini secara default berstatus `'diajukan'`.
     * Kolom `diajukan_oleh` diisi dengan `v_verified_identity_id`.
     * Kolom `disetujui_oleh` diisi dengan `NULL`. (Pengguna tanpa hak approve tidak boleh mencatatkan identitas approver fiktif).
  5. **Pembersihan Metadata `kru_terlibat`:** Tidak lagi menyisipkan field `submitted_by` ke dalam payload `kru_terlibat`.
  6. **Algoritma Penomoran Bebas Lubang (*Gap-Resilient MAX Suffix*):**
     * Mengganti formula cacat `count(*) + 1` dengan kalkulasi nilai maksimum dari nomor surat yang telah terbit pada bulan berjalan:
       ```sql
       SELECT COALESCE(MAX(NULLIF(regexp_replace(substring(nomor_surat from '[0-9]+$'), '\D', '', 'g'), '')::INT), 0)
       INTO v_max_num
       FROM public.ptv_surat_tugas 
       WHERE nomor_surat LIKE v_prefix || '-PTV/' || v_year || '/' || v_month || '/%';
       ```
     * Menggunakan regex `[0-9]+$` (bukan `[0-9]{3}$`) agar aman jika penomoran melampaui 999 surat.
     * Dilindungi transaksi serial melalui advisory lock per tipe dokumen:
       - ST: `pg_advisory_xact_lock(1002)`
       - SI: `pg_advisory_xact_lock(1003)`
       - SBB: `pg_advisory_xact_lock(1004)`
     * Constraint `UNIQUE` pada kolom `nomor_surat` tetap menjadi pertahanan benteng terakhir (*last line of defense*).
  7. **Respons Terstruktur Kompatibel:** Mengembalikan objek JSON:
     ```json
     {
       "success": true,
       "nomor_surat": "ST-PTV/2026/10/001",
       "doc_id": "uuid-...",
       "status": "diajukan",
       "diajukan_oleh": "uuid-...",
       "disetujui_oleh": null
     }
     ```

---

### 4.3 `rpc_return_loan`
* **Signature Eksisting:**
  ```sql
  rpc_return_loan(
      p_transaction_id TEXT, p_back_date DATE,
      p_condition_status TEXT, p_notes TEXT, p_actor_id UUID
  ) RETURNS JSONB
  ```
* **Signature Usulan (Kompatibel):**
  ```sql
  rpc_return_loan(
      p_transaction_id TEXT, p_back_date DATE,
      p_condition_status TEXT, p_notes TEXT, p_actor_id UUID DEFAULT NULL
  ) RETURNS JSONB
  ```
* **Daftar Perbaikan:**
  1. **Resolusi Identitas Sesi:** Selesaikan `v_verified_identity_id` dari `auth.uid()`.
  2. **Anti-Spoofing Strict Rejection:** Jika `p_actor_id IS NOT NULL AND p_actor_id != v_verified_identity_id`, batalkan dengan `42501`.
  3. **Otorisasi Kapabilitas:** Verifikasi `public.has_capability('loans.return')`.
  4. **Penguncian Baris Transaksi Aktif:**
     Kunci baris pinjaman yang aktif untuk mencegah konflik return paralel:
     ```sql
     SELECT array_agg(unit_id ORDER BY unit_id) INTO v_unit_ids
     FROM (
         SELECT unit_id
         FROM public.ptv_peminjaman
         WHERE transaction_id = p_transaction_id AND status = 'dipinjam'
         ORDER BY unit_id
         FOR UPDATE
     ) sub_loans;
     ```
     Jika `v_unit_ids` kosong, tolak dengan `TRANSACTION_NOT_FOUND: No active loans found for transaction %`.
  5. **Penguncian Unit Deterministik:**
     ```sql
     PERFORM id FROM public.ptv_inventaris_unit
     WHERE id = ANY(v_unit_ids)
     ORDER BY id
     FOR UPDATE;
     ```
  6. **Pencegahan Double-Return:** Klausa `WHERE status = 'dipinjam'` dan penguncian row lock menjamin tidak ada dua panggilan yang dapat memproses pengembalian pada unit yang sama secara bersamaan.
  8. **Pembaruan Kondisi & Status Siklus:** Perbarui kondisi unit sesuai `p_condition_status`. Status peminjaman unit diset secara konsisten: jika kondisi adalah `'rusak'` atau `'perlu_servis'`, maka `status_peminjaman` diset menjadi `'rusak'` (karantina dari sirkulasi peminjaman berikutnya). Jika kondisi `'bagus'`, `status_peminjaman` diset menjadi `'tersedia'`.

---

### 4.4 `rpc_return_single_unit`
* **Signature Eksisting:**
  ```sql
  rpc_return_single_unit(
      p_loan_row_id UUID, p_unit_id UUID,
      p_condition_status TEXT, p_actor_id UUID
  ) RETURNS JSONB
  ```
* **Signature Usulan (Kompatibel):**
  ```sql
  rpc_return_single_unit(
      p_loan_row_id UUID, p_unit_id UUID,
      p_condition_status TEXT, p_actor_id UUID DEFAULT NULL
  ) RETURNS JSONB
  ```
* **Daftar Perbaikan:**
  1. **Resolusi Identitas Sesi:** Selesaikan `v_verified_identity_id` dari `auth.uid()`.
  2. **Anti-Spoofing Strict Rejection:** Jika `p_actor_id IS NOT NULL AND p_actor_id != v_verified_identity_id`, batalkan dengan `42501`.
  3. **Otorisasi Kapabilitas:** Verifikasi `public.has_capability('loans.return')`.
  4. **Penguncian Baris Pinjaman Tunggal:**
     ```sql
     PERFORM id FROM public.ptv_peminjaman
     WHERE id = p_loan_row_id AND unit_id = p_unit_id AND status = 'dipinjam'
     FOR UPDATE;
     
     IF NOT FOUND THEN
         RAISE EXCEPTION 'LOAN_NOT_ACTIVE: Specified loan record is not active or already returned'
             USING ERRCODE = 'P0001';
     END IF;
     ```
  5. **Penguncian Unit:**
     ```sql
     PERFORM id FROM public.ptv_inventaris_unit
     WHERE id = p_unit_id
     FOR UPDATE;
     ```
  6. **Mutasi Atomik Tunggal:**
     * Perbarui baris `ptv_peminjaman` yang bersangkutan: `status = 'dikembalikan'`, `tanggal_kembali = CURRENT_DATE`, `kondisi_kembali = p_condition_status`.
     * Perbarui baris `ptv_inventaris_unit` yang bersangkutan: `status_peminjaman = CASE WHEN p_condition_status IN ('rusak', 'perlu_servis') THEN 'rusak' ELSE 'tersedia' END`, `kondisi = p_condition_status`.
     * Sisa unit lain dalam basket transaksi yang sama tetap berstatus `'dipinjam'` tanpa terganggu.
  7. **Audit Log:** Catat log audit ke `auth_audit_log`.
  8. **Respons Terstruktur:** Mengembalikan `loan_id`, `unit_id`, `status: 'dikembalikan'`, dan `processed_by`.

---

### 4.5 `rpc_get_next_inv_code`
* **Signature:** `rpc_get_next_inv_code() RETURNS TEXT`
* **Daftar Perbaikan:**
  1. **Pencabutan Hak Akses Publik & Anonim:**
     ```sql
     REVOKE ALL ON FUNCTION public.rpc_get_next_inv_code() FROM PUBLIC, anon;
     GRANT EXECUTE ON FUNCTION public.rpc_get_next_inv_code() TO authenticated, service_role;
     ```
  2. **Otorisasi Internal Fail-Closed (3VL):**
     Tambahkan guard di dalam badan fungsi:
     ```sql
     IF (public.has_capability('inventory.create') IS NOT TRUE) AND (public.has_capability('inventory.units.manage') IS NOT TRUE) THEN
         RAISE EXCEPTION 'UNAUTHORIZED: inventory management capability required' USING ERRCODE = 'P0001';
     END IF;
     ```
  3. **Advisory Lock & Gap Analysis:** Pertahankan `pg_advisory_xact_lock(1001)` untuk mengunci nomor urut kode inventaris master tanpa race condition pembacaan.
  4. **Filter Regex & Format Dinamis Bebas Truncation:** Menggunakan `WHERE kode ~ '^INV-[0-9]+$'` untuk mencegah polusi kode non-INV dan integer overflow, serta format dinamis untuk mencegah pemotongan `LPAD` jika angka melampaui 999.
  5. **Semantik Alokasi (Suggester vs Reservasi):** Mengakui `rpc_get_next_inv_code` sebagai generator nomor pratinjau (*code suggester*). Jaminan konkurensi mutlak saat insert ditegakkan oleh constraint `UNIQUE (kode)` pada tabel `ptv_inventaris`.

---

## 5. Kompatibilitas Signature dan Analisis Pemanggil

### 5.1 Audit Pemanggil di Repository
Pencarian menyeluruh terhadap seluruh codebase lokal menghasilkan temuan berikut:
* **`src/`:** Belum ada komponen frontend yang memanggil kelima RPC ini secara langsung melalui Supabase JS SDK. Seluruh interaksi UI saat ini masih menggunakan mock store atau service abstrak.
* **`tests/database/rpcHarness.test.ts`:** Menguji logika bisnis kelima RPC melalui engine simulasi internal TypeScript (`SimulatedRpcEngine`).
* **`scripts/validate-staging-cloud.mjs`:** Skrip probe REST eksternal yang memanggil seluruh RPC dengan payload JSON spesifik.
* **Dampak PostgREST Function Resolution:**  
  Menambahkan `DEFAULT NULL` pada parameter `p_actor_id` aman bagi PostgREST. PostgREST menyelesaikan fungsi berdasarkan nama dan nama argumen dalam payload JSON. Selama nama fungsi tidak di-overload dengan signature ambigu, PostgREST akan memetakan payload yang memuat atau tidak memuat `p_actor_id` ke fungsi hardened yang sama.
* **Schema Cache Refresh:** Setelah DDL diubah di database, PostgreSQL schema cache di PostgREST wajib diperbarui dengan mengirimkan perintah:
  `NOTIFY pgrst, 'reload schema';`

---

## 6. Analisis Strategi Penomoran dan Konkurensi

### 6.1 Perbandingan Mekanisme Penomoran Surat
| Kriteria | `count(*) + 1` (Lama) | `MAX(suffix) + 1` + Advisory Lock (Usulan) | Dedicated Sequence Counter Table |
| :--- | :--- | :--- | :--- |
| **Resistensi terhadap Gap / Delete** | **Gagal (Collision)** | **Aman (Gap-Resilient)** | **Aman (Monotonik)** |
| **Keamanan Konkurensi** | Bergantung lock | Dijamin `pg_advisory_xact_lock` | Dijamin row-lock counter baris |
| **Kebutuhan Objek DDL Baru** | Tidak ada | Tidak ada | Membutuhkan tabel `ptv_doc_sequence` |
| **Overhead Scanning** | Scan baris bulanan | Scan baris bulanan via index | Sangat ringan (baca 1 baris) |
| **Pilihan Arsitektur** | **Ditolak** | **Direkomendasikan (Fase Ini)** | Alternatif Masa Depan |

### 6.2 Analisis Urutan Penguncian & Pencegahan Deadlock
Tabel berikut merangkum urutan penguncian objek pada masing-masing transaksi untuk membuktikan bebas deadlock:

| Transaksi | Objek Kunci 1 | Objek Kunci 2 | Objek Kunci 3 | Penjelasan Keamanan Deadlock |
| :--- | :--- | :--- | :--- | :--- |
| **`rpc_checkout_loan`** | `ptv_inventaris_unit` (`ORDER BY id FOR UPDATE`) | `INSERT ptv_peminjaman` | — | Urutan penguncian unit selalu menaik berdasarkan UUID primary key. Dua checkout tumpang tindih tidak akan deadlock. |
| **`rpc_return_loan`** | `ptv_peminjaman` (`ORDER BY id FOR UPDATE`) | `ptv_inventaris_unit` (`ORDER BY id FOR UPDATE`) | — | Mengunci baris pinjaman terlebih dahulu, kemudian mengunci unit inventaris terkait secara deterministik. |
| **`rpc_return_single_unit`**| `ptv_peminjaman` (Single row `FOR UPDATE`) | `ptv_inventaris_unit` (Single row `FOR UPDATE`) | — | Mengunci baris peminjaman spesifik, kemudian mengunci unit spesifik. Hierarki searah dengan `rpc_return_loan`. |
| **`rpc_submit_official_doc`**| `pg_advisory_xact_lock(lock_id)` | `INSERT ptv_surat_*` | — | Advisory lock tingkat sesi serialisasi penuh per jenis surat. Nol deadlock antartabel. |
| **`rpc_get_next_inv_code`** | `pg_advisory_xact_lock(1001)` | `SELECT ptv_inventaris` | — | Advisory lock serialisasi penuh. Bebas deadlock. |

---

## 7. Rencana Rollback dan Pemulihan (Disaster Recovery Analysis)

### 7.1 Kejujuran Klasifikasi Prosedur Pemulihan (Hybrid vs Baseline)
> [!IMPORTANT]
> **KLASIFIKASI FORENSIK PEMULIHAN:**  
> Prosedur pemulihan pada Bagian 4 proposal **TIDAK MENGEMBALIKAN SKEMA SECARA 100% KE BASELINE AWAL**.  
> Prosedur tersebut diklasifikasikan secara jujur sebagai **Hybrid Functional Rollback (Pembalikan Logika Bisnis dengan Preservasi Proteksi Akses & Skema Kolom)**.

Tabel perbandingan forensik antara Baseline Revisi asli ([`PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql)) dengan Runbook Pemulihan Proposal:

| Dimensi Skema / Fungsi | Baseline Revisi Asli | Runbook Pemulihan Proposal | Status Penyesuaian |
| :--- | :--- | :--- | :--- |
| **Signature `rpc_checkout_loan`** | `p_actor_id UUID` (tanpa default) | `p_actor_id UUID DEFAULT NULL` | Mempertahankan kompatibilitas argumen opsional. |
| **Lock Order `rpc_checkout_loan`** | `FOR UPDATE` tanpa `ORDER BY id` | Mempertahankan `ORDER BY id FOR UPDATE` | Mempertahankan proteksi anti-deadlock. |
| **Format `rpc_get_next_inv_code`** | `regexp_replace` & `LPAD` (rentan trunc >999) | Regex filter `^INV-[0-9]+$` & format dinamis | Mempertahankan perbaikan anti-truncation. |
| **Kolom DDL `diajukan_oleh`** | Belum ada di tabel `ptv_surat_*` | **TETAP DIPERTAHANKAN** (tidak di-DROP) | Mencegah kerusakan data audit yang telah tercatat. |
| **Hak Akses `service_role` & `anon`**| `GRANT TO authenticated, service_role` | `REVOKE FROM anon, service_role; GRANT TO authenticated` | Mempertahankan isolasi least privilege. |
| **Jalur Pembuatan Surat** | Langsung via `INSERT` atau RPC | `INSERT` langsung tetap diblokir | Mempertahankan kanal tunggal pembuatan surat. |

### 7.2 Dua Opsi Pemulihan Bencana
1. **Opsi A — Strict Historical Baseline Revert (Pembalikan Murni 100%):**  
   Mengembalikan seluruh definisi 5 fungsi PL/pgSQL persis 100% ke teks baris 818-1059 pada `PTV-PRO-DATABASE-MIGRATION-REVISED.sql`. Opsi ini mengembalikan perilaku awal secara harfiah, namun membuka kembali celah `P0001` vs `28000`, ketiadaan `ORDER BY id`, dan truncation LPAD >999.
2. **Opsi B — Recommended Hybrid Functional Revert (Pembalikan Fungsional Aman):**  
   Mengembalikan logika bisnis (misal parameter `p_actor_id` diterima kembali dan surat kembali mengisi `disetujui_oleh`), namun **tetap mempertahankan** konfigurasi keamanan `ORDER BY id`, proteksi format LPAD, kolom audit `diajukan_oleh`, dan pencabutan hak eksekusi anonim.

---

## 8. Status Kesiapan dan Rekomendasi Selanjutnya

### 8.1 Status Akhir Audit
> [!CAUTION]
> **STATUS AKHIR: NOT READY — OPERATIONAL PREFLIGHT REQUIRED (ARCHITECTURAL DECISIONS FINALIZED)**  
> Seluruh 14 keputusan arsitektur dan mitigasi celah keamanan telah selesai dan disetujui secara tuntas. Namun, eksekusi naskah SQL di database staging **tetap ditahan** sampai operator DBA manusia menjalankan kueri inspeksi preflight (PREFLIGHT 1-10) untuk memvalidasi katalog live staging di bawah prinsip *Zero Execution*.

### 8.2 Rincian Blocker Operasional yang Tersisa

Berikut adalah 3 blocker operasional pra-eksekusi yang wajib diselesaikan sebelum mengeksekusi patch migrasi:

1. **BLK-PRE-01 (Prioritas: P0 / Kritis) — Verifikasi Katalog Live Staging via Kueri Preflight (Zero Live Evidence Block):**  
   * **Referensi File & Lokasi:** [`docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md` (Bagian 1, Baris 27-175)](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L27-L175) dan [`docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql).  
   * **Bukti Masalah:** Berdasarkan batasan mutlak *Zero Execution*, agen AI dilarang terhubung ke database atau mengeksekusi SQL. Hasil audit statis/probe lama tidak boleh diperlakukan sebagai bukti live terkini. Tanpa hasil eksekusi aktual kueri PREFLIGHT 1 (`pg_proc` overload check), PREFLIGHT 2 (routine privileges), PREFLIGHT 4 (format nomor surat historis), dan PREFLIGHT 8 (`pg_policies` aktual), patch DDL berisiko memutus ketergantungan tersembunyi.  
   * **Rekomendasi Teknis:** Operator database manusia mengeksekusi script read-only `docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql` dan kueri PREFLIGHT 1-10 pada Supabase SQL Editor Staging (`swadgljnyelsjstqqxbm`), kemudian mendokumentasikan hasilnya sebagai bukti empiris pra-patch.

2. **BLK-SEL-02 (Prioritas: P1 / Tinggi) — Spesifikasi Hak Baca (SELECT Policy) Tabel Persuratan Berdasarkan Bukti Staging:**  
   * **Referensi File & Lokasi:** [`docs/PTV-PRO-RPC-IDENTITY-HARDENING-DECISIONS.md` (Keputusan 12 & Area ACC-WRT-01)](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-DECISIONS.md) dan [`docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md` (Langkah 1.4, Baris 231-236)](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L231-L236).  
   * **Bukti Masalah:** Proposal mencabut hak `INSERT` langsung pada tabel surat demi menegakkan kanal tunggal `rpc_submit_official_doc`. Namun tabel persuratan memiliki RLS aktif (`ENABLE ROW LEVEL SECURITY`) tanpa definisi `CREATE POLICY` eksplisit di baseline migrasi. Sesuai keputusan operator, **dilarang membuat policy SELECT spekulatif tanpa bukti**. Kebutuhan otorisasi baca (apakah kru hanya boleh membaca surat miliknya `diajukan_oleh = auth.uid()` atau seluruh kru studio dapat membaca arsip) belum dispesifikasikan.  
   * **Rekomendasi Teknis:** Jalankan PREFLIGHT 8 untuk memeriksa `pg_policies` aktual di staging. Konfirmasi spesifikasi kebutuhan bisnis SELECT dengan stakeholder sebelum merilis naskah DDL policy baru.

3. **BLK-EVT-03 (Prioritas: P2 / Sedang) — Penjadwalan Jendela Eksekusi DDL `nama_acara` pada Tabel `ptv_peminjaman`:**  
   * **Referensi File & Lokasi:** [`docs/PTV-PRO-RPC-IDENTITY-HARDENING-DECISIONS.md` (Keputusan 2)](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-DECISIONS.md) dan [`docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md` (Langkah 2.10, Baris 380-394)](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md#L380-L394).  
   * **Bukti Masalah:** Operator telah menyetujui Opsi 2 (menambahkan kolom terstruktur `nama_acara VARCHAR(255) NULL`) dan audit dampak 5 dimensi (schema, writer, reader, RPC, frontend) telah diselesaikan secara tuntas. Namun sesuai instruksi, implementasi DDL dan penulisan kolom ini pada INSERT ditangguhkan (*deferred*) agar tidak mengubah skema aktif tanpa jadwal rilis resmi.  
   * **Rekomendasi Teknis:** Jadwalkan DDL `ALTER TABLE public.ptv_peminjaman ADD COLUMN IF NOT EXISTS nama_acara VARCHAR(255) NULL;` dan pemetaan di badan fungsi `rpc_checkout_loan` sebagai satu paket migrasi terjadwal yang dieksekusi bersamaan dengan rilis fitur integrasi acara.
