# PTV PRO — RPC Identity Hardening Architectural Decisions Log

**Subsystem:** PTV PRO Database & Security Architecture  
**Target Environment:** Supabase Staging (`swadgljnyelsjstqqxbm`)  
**Status:** **NOT READY — BLOCKERS REMAIN (PRE-EXECUTION AUDIT COMPLETE — ZERO EXECUTION APPLIED)**  
**Date:** 09 Oktober 2026  
**Authoritative Contracts:**  
- [`docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md)  
- [`docs/PTV-PRO-IDENTITY-AUTH-CONTRACT.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-IDENTITY-AUTH-CONTRACT.md)  
- [`docs/PTV-PRO-PROJECT-ARCHITECTURE.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PROJECT-ARCHITECTURE.md)  
- [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql)  
- [`docs/PTV-PRO-STAGING-SECURITY-AUDIT.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-SECURITY-AUDIT.md)  

---

## 1. Ringkasan Eksekutif & Status Audit

Dokumen ini mencatat secara formal keputusan arsitektur yang mengikat hardening 5 RPC PTV PRO. Berdasarkan audit mendalam terhadap 9 pilar keamanan dan integritas kontraktual, status proposal saat ini ditetapkan sebagai:

> [!CAUTION]
> **STATUS AKHIR: NOT READY — BLOCKERS REMAIN**  
> Status ini **TIDAK mengizinkan eksekusi SQL**. Proposal memerlukan penyelesaian keputusan manusia terkait kolom acara (`p_event_name`), verifikasi metadata katalog database staging (pemilik fungsi, hak schema, overload eksisting, format nomor surat historis), serta konfirmasi strategi pemulihan bencana sebelum dipertimbangkan untuk eksekusi manual di masa mendatang.  
> **BATASAN ZERO EXECUTION:** Tidak ada koneksi database, migrasi, DDL, DML, atau seeding yang dijalankan.

Seluruh keputusan di bawah ini mengikat dokumen:
1. [`docs/PTV-PRO-RPC-IDENTITY-HARDENING-PLAN.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-PLAN.md)
2. [`docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-FINAL-SQL-PROPOSAL.md)
3. [`docs/PTV-PRO-RPC-IDENTITY-HARDENING-TEST-PLAN.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-RPC-IDENTITY-HARDENING-TEST-PLAN.md)

---

## 2. Empat Keputusan Arsitektur yang Telah Disetujui

### Keputusan 1: Pemisahan Pengaju dan Penyetuju Surat Resmi
* **Status Keputusan:** **DISETUJUI (APPROVED)**
* **Pilihan Terpilih:** **Rencanakan kolom permanen `diajukan_oleh`.**
* **Analisis Skema Eksisting:**
  Ketiga tabel persuratan pada skema baseline [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql#L456-L489):
  1. `ptv_surat_tugas`
  2. `ptv_surat_izin`
  3. `ptv_surat_barang`
  saat ini **hanya** memiliki kolom `disetujui_oleh UUID NULL REFERENCES canonical_identity(id)`. Kolom `diajukan_oleh` belum ada sama sekali.
* **Celah yang Diperbaiki:**
  Pada implementasi awal `rpc_submit_official_doc`, parameter input `p_actor_id` (identitas pembuat) ditulis langsung ke kolom `disetujui_oleh`, padahal status surat adalah `'diajukan'`. Ini menyebabkan surat permohonan santri biasa tercatat seolah-olah telah disahkan oleh santri tersebut.
* **Ketentuan Implementasi:**
  1. **Usulan DDL:** Menambahkan kolom `diajukan_oleh UUID NULL REFERENCES canonical_identity(id) ON DELETE RESTRICT` pada ketiga tabel surat, disertai indeks `idx_surat_*_diajukan_oleh`.
  2. **Nullability & Kompatibilitas Historis:** Kolom dibuat `NULLABLE` pada tingkat DDL agar kompatibel dengan data lama yang telah ada di database.
  3. **Penegakan Data Baru:** Pada fungsi `rpc_submit_official_doc`, kolom `diajukan_oleh` **wajib** diisi dengan identitas terverifikasi sesi (`v_verified_identity_id`).
  4. **Strategi Backfill Historis Tanpa Spekulasi:** Data surat lama **TIDAK BOLEH** diisi dengan menebak dari kolom `disetujui_oleh`. Surat historis yang tidak memiliki jejak pemohon terverifikasi dibiarkan bernilai `NULL` (atau ditandai dalam audit metadata sebagai data prapembaruan).
  5. **Integritas Kolom `disetujui_oleh`:** Kolom `disetujui_oleh` dipertahankan **hanya** untuk mencatat identitas pihak yang secara sah melakukan persetujuan (memiliki kapabilitas `documents.approve`). Surat yang baru diajukan oleh pemohon biasa wajib memiliki `disetujui_oleh = NULL`.
  6. **Penyimpanan Identitas Bersih:** Identitas pengaju **tidak boleh lagi disematkan ke dalam metadata `kru_terlibat`** (`kru_terlibat` dikembalikan ke fungsi aslinya sebagai daftar kru pelaksana tugas).
  7. **Kontrak Respons Aplikasi:** Respons JSON `rpc_submit_official_doc` mempertahankan field eksisting (`success`, `nomor_surat`, `doc_id`) dan menambahkan field terstruktur `diajukan_oleh`, `disetujui_oleh`, dan `status`.
  8. **Aturan Transisi Status Surat:** Hak `documents.approve` tidak otomatis berarti pengguna boleh mengesahkan semua jenis dokumen secara sepihak atau melewati alur pengajuan. Izin santri (`ptv_surat_izin`) tetap memerlukan persetujuan pimpinan/pembina dan tidak boleh disahkan secara sepihak oleh pemohon sendiri.

---

### Keputusan 2: Penanganan Data Acara (`p_event_name`) pada Checkout
* **Status Keputusan:** **DISETUJUI (APPROVED) — OPSI 2: PENAMBAHAN KOLOM TERSTRUKTUR `nama_acara` (AUDIT DAMPAK SELESAI, IMPLEMENTASI DDL DITANGGUHKAN)**
* **Latar Belakang & Analisis Sumber Kontrak:**
  1. **Kontrak Database:** [`docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md` (Bagian 10.1)](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md#L330-L340) secara eksplisit memasukkan parameter `p_event_name TEXT` ke dalam signature kontrak `rpc_checkout_loan`.
  2. **Skema Tabel Baseline:** Pada [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql` (Baris 411-425)](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql#L411-L425), tabel `ptv_peminjaman` belum memiliki kolom `nama_acara`.
  3. **Penggabungan Teks Ditolak:** Pendekatan Opsi 3 (menggabungkan nama acara ke kolom `keperluan`) ditolak keras karena mencemari format teks, menyulitkan ekspor/parsing, dan melanggar prinsip data terstruktur.
* **Audit Dampak 5 Dimensi Perubahan (Opsi 2):**
  1. **Audit Dampak Skema (Schema Impact):**
     * Menambahkan kolom `nama_acara VARCHAR(255) NULL` ke tabel `public.ptv_peminjaman` via DDL `ALTER TABLE public.ptv_peminjaman ADD COLUMN IF NOT EXISTS nama_acara VARCHAR(255) NULL;`.
     * **Relasi ke Tabel `ptv_acara`:** Kolom ini berkarakter teks mandiri (*free-text string*), konsisten dengan tipe parameter kontrak `p_event_name TEXT`. Kolom ini **tidak menggunakan foreign key** ke `ptv_acara.id` agar peminjaman peralatan untuk kegiatan insidental atau belum terdaftar di master acara tidak terblokir oleh constraint.
     * **Kompatibilitas Arsip Historis:** Nilai default adalah `NULL`, sehingga seluruh data historis peminjaman lama tetap valid tanpa memerlukan rekayasa backfill data (*zero-guessing backfill policy*).
  2. **Audit Dampak Penulis Data (Writer Impact):**
     * Fungsi `rpc_checkout_loan` adalah satu-satunya kanal penulisan data yang sah untuk `ptv_peminjaman`.
     * Saat implementasi diaktifkan, mutasi `INSERT INTO public.ptv_peminjaman (...)` akan memetakan parameter `p_event_name` ke kolom `nama_acara`.
     * Akses direct `INSERT` dari klien REST API tetap diblokir oleh RLS, sehingga integritas penulisan terpusat sepenuhnya pada RPC.
  3. **Audit Dampak Pembaca Data (Reader Impact):**
     * Kueri pembacaan operasional (`SELECT * FROM ptv_peminjaman`) secara transparan menerima kolom baru tanpa memengaruhi aplikasi yang membaca kolom-kolom eksisting.
     * Modul logistik dan pelaporan dapat memfilter, mengelompokkan, dan mengekspor peminjaman per nama kegiatan secara terstruktur tanpa manipulasi string.
     * Kolom `keperluan` tetap murni menyimpan tujuan peminjaman tanpa tercemar format gabungan `[Acara: ...]`.
  4. **Audit Dampak Kontrak RPC (RPC Contract Impact):**
     * Parameter `p_event_name TEXT` telah ada pada signature kontrak `rpc_checkout_loan`. Nol perubahan signature antarmuka, sehingga tidak memicu error PostgREST `PGRST202 (Argument mismatch)`.
     * Mengeliminasi anomali *dropped parameter* di masa mendatang.
  5. **Audit Dampak Antarmuka Pengguna & Pengujian (Frontend & Test Impact):**
     * Modul peminjaman pada `src/` saat ini belum memanggil RPC live langsung (masih beroperasi dengan mock state).
     * Skrip pengujian staging `scripts/validate-staging-cloud.mjs` telah mengirimkan `p_event_name: 'Probe'`.
     * UI checkout peminjaman masa depan dapat langsung menyajikan form field terpisah "Nama Kegiatan / Acara" tanpa perlu trik manipulasi string di sisi browser.
* **Instruksi Eksekusi & Penangguhan (Implementation Policy):**
  Sesuai arahan mutlak operator: **Jangan langsung mengimplementasikannya.** DDL penambahan kolom `nama_acara` dan modifikasi penulisan pada badan fungsi `rpc_checkout_loan` disiapkan sebagai usulan patch terpisah (*staged proposal*) dan ditangguhkan hingga jendela eksekusi migrasi resmi disetujui oleh operator database.

---

### Keputusan 3: Penanganan Ketidaksesuaian Aktor (Actor Mismatch)
* **Status Keputusan:** **DISETUJUI (APPROVED) — STRICT REJECTION**
* **Ketentuan:**
  1. **Strict Rejection:** Jika klien mengirim `p_actor_id` dan nilainya tidak identik dengan `v_verified_identity_id` yang diselesaikan dari sesi terverifikasi (`auth.uid()`), transaksi **wajib ditolak secara tegas** sebelum mutasi apa pun terjadi.
  2. **Error Code Standar:** Menghasilkan eksepsi PostgreSQL konsisten:
     `RAISE EXCEPTION 'FORBIDDEN: Actor spoofing detected (p_actor_id does not match authenticated session identity)' USING ERRCODE = '42501';`
  3. **Rollback Atomik:** Penolakan membatalkan seluruh transaksi secara atomik; tidak ada baris yang tersisa di `ptv_peminjaman`, tabel surat, maupun penguncian unit.
  4. **Kompatibilitas Parameter Opsional:** Parameter `p_actor_id UUID DEFAULT NULL` dipertahankan pada signature fungsi agar klien lama yang masih mengirim `p_actor_id` tidak mengalami error PostgREST `PGRST202 (Argument mismatch)`.
  5. **Resolusi Identitas Tepercaya:** Nilai identitas tepercaya untuk audit (`actor_id`, `diajukan_oleh`, dll.) **selalu diambil dari hasil kueri sesi `auth.uid()` $\rightarrow$ `user_account.identity_id`**, dan **tidak pernah mengambil nilai dari input klien**, bahkan ketika `p_actor_id` yang dikirim cocok.
  6. **Pencocokan Bukan Bukti Otorisasi:** Kecocokan `p_actor_id` dengan sesi tidak meloloskan pengguna secara otomatis. Operasi tetap wajib menjalani pemeriksaan status akun (`status_akun = 'active'`), status keanggotaan organisasi, dan kapabilitas spesifik.
  7. **Cakupan Seluruh RPC Berparameter Aktor:** Aturan ini ditegakkan pada keempat RPC mutasi:
     * `rpc_checkout_loan`
     * `rpc_submit_official_doc`
     * `rpc_return_loan`
     * `rpc_return_single_unit`

---

### Keputusan 4: Hak Eksekusi `rpc_get_next_inv_code`
* **Status Keputusan:** **DISETUJUI (APPROVED) — CABUT HAK ANON DAN PUBLIC**
* **Temuan Audit Lapangan:**
  1. Pada DDL revisi [`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql` (Baris 990-991)](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql#L990-L991), terdapat statement:
     `REVOKE ALL ON FUNCTION rpc_get_next_inv_code FROM PUBLIC;`
     `GRANT EXECUTE ON FUNCTION rpc_get_next_inv_code TO authenticated, service_role;`
  2. Namun hasil probe runtime pada [`docs/PTV-PRO-STAGING-SECURITY-AUDIT.md` (Baris 78)](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-SECURITY-AUDIT.md#L78) dan `scripts/validate-staging-cloud.mjs` membuktikan bahwa pemanggilan HTTP POST oleh role anonim (`anonKey`) menghasilkan `HTTP 200 OK` dan mengembalikan kode inventaris berikutnya.
  3. Hal ini terjadi karena hak `EXECUTE` bawaan Supabase pada skema `public` atau privilege default belum sepenuhnya terisolasi dari role `anon`.
  4. Fungsi ini mengunci advisory lock transaksi `1001` (`PERFORM pg_advisory_xact_lock(1001);`), sehingga akses anonim membuka celah *lock contention DoS* dan enumerasi aset institusi.
  5. Fungsi ini sama sekali tidak memiliki pemeriksaan kapabilitas internal di dalam badan fungsinya.
* **Ketentuan Implementasi:**
  1. **Pencabutan Tegas:** Menjalankan perintah REVOKE eksplisit terhadap signature spesifik:
     `REVOKE ALL ON FUNCTION public.rpc_get_next_inv_code() FROM PUBLIC, anon;`
  2. **Least Privilege Grant:** Hanya memberikan hak eksekusi kepada role minimum yang terotentikasi:
     `GRANT EXECUTE ON FUNCTION public.rpc_get_next_inv_code() TO authenticated, service_role;`
  3. **Internal Capability Guard:** Menambahkan guard kapabilitas di dalam fungsi:
     ```sql
     IF NOT public.has_capability('inventory.create') AND NOT public.has_capability('inventory.units.manage') THEN
         RAISE EXCEPTION 'UNAUTHORIZED: inventory management capability required' USING ERRCODE = 'P0001';
     END IF;
     ```
     Dengan guard ini, bahkan pengguna terotentikasi yang tidak memiliki kapabilitas inventaris (seperti Pembina) akan ditolak secara *fail-closed*.

---

## 3. Daftar Keputusan Lanjutan yang Memerlukan Persetujuan Manusia

Berikut adalah keputusan arsitektur tingkat lanjut yang diidentifikasi selama audit dan memerlukan keputusan operator manusia sebelum tahap eksekusi:

### Keputusan 5: Penanganan Ambiguitas Multi-Membership pada `organization_membership`
* **Status Keputusan:** **DISETUJUI (APPROVED) — PENDEKATAN FAIL-CLOSED MUTLAK (DILARANG ORDER BY LIMIT 1)**
* **Latar Belakang Masalah:**
  Tabel `organization_membership` saat ini **tidak memiliki unique constraint** pada `(identity_id, is_current)`. Seorang santri/kru secara teknis dapat memiliki lebih dari satu baris dengan `is_current = TRUE` (misalnya keanggotaan ganda di `ptv_studio` dan organisasi induk `bsh_pesantren`, atau pencatatan riwayat transisi antar-divisi yang belum ditutup).
  Kueri `SELECT ... INTO ... ORDER BY ... LIMIT 1` adalah pemilihan arbitrer (*arbitrary selection*) yang menyamarkan korupsi data atau inkonsistensi status.
* **Ketentuan Implementasi:**
  1. **Larangan Arbitrary Selection:** Kueri resolusi keanggotaan **DILARANG MENGGUNAKAN** `ORDER BY ... LIMIT 1`.
  2. **Penegakan Fail-Closed Deterministic:** Fungsi wajib menghitung jumlah baris keanggotaan studio aktif (`organization_id = 'ptv_studio' AND is_current = TRUE`).
     - Jika `COUNT(*) > 1`: Transaksi **wajib ditolak seketika** dengan eksepsi integritas:
       `RAISE EXCEPTION 'DATA_INTEGRITY_ERROR: Inconsistent membership state (multiple current memberships in ptv_studio)' USING ERRCODE = '23514';`
     - Jika `COUNT(*) = 0` atau status bukan `'active'`: Transaksi **wajib ditolak seketika** (*fail-closed*):
       `RAISE EXCEPTION 'FORBIDDEN: Active organization membership required (current status: %)', COALESCE(v_status_organisasi, 'none') USING ERRCODE = '42501';`
  3. **Rekomendasi DDL Jangka Panjang:** Operator disarankan menambahkan partial unique index pada skema mendatang:
     `CREATE UNIQUE INDEX idx_unique_current_studio_membership ON organization_membership(identity_id) WHERE organization_id = 'ptv_studio' AND is_current = TRUE;`

---

### Keputusan 6: Skema Audit Pemroses Pengembalian Alat pada `rpc_return_loan` & `rpc_return_single_unit`
* **Status Keputusan:** **DISETUJUI (APPROVED) — OPSI 6B: PENCATATAN FORENSIK VIA `auth_audit_log` (DILARANG MENAMBAH KOLOM `return_actor_id`)**
* **Latar Belakang & Analisis Skema:**
  Tabel `ptv_peminjaman` hanya memiliki kolom `actor_id` (pencatat peminjaman awal). Saat alat dikembalikan, identitas kru yang menerima/memeriksa pengembalian sebelumnya hanya digabungkan sebagai teks ke kolom `catatan`.
* **Ketentuan Implementasi Final:**
  1. **Larangan Penambahan Kolom DDL:** Tabel `ptv_peminjaman` **TIDAK DITAMBAHKAN** kolom `return_actor_id` pada fase ini. Dilarang menambahkan kolom tersebut tanpa keputusan dan kebutuhan baru yang disetujui secara eksplisit oleh operator database.
  2. **Resolusi Identitas Tepercaya:** Identitas aktor pengembalian (`v_verified_identity_id`) selalu diselesaikan secara aman dari sesi `auth.uid()` -> `user_account.identity_id`. Input `p_actor_id` dari klien hanya digunakan untuk anti-spoofing verification (wajib identik jika dikirim).
  3. **Pencatatan Forensik Terstruktur ke `auth_audit_log`:**
     * Pada pengembalian transaksi penuh (`rpc_return_loan`), fungsi melakukan pencatatan atomik ke tabel `public.auth_audit_log` dengan `event_type = 'loan.return.full'` dan payload metadata:
       ```json
       {
         "transaction_id": p_transaction_id,
         "returned_units_count": cardinality(v_unit_ids),
         "condition_status": p_condition_status
       }
       ```
     * Pada pengembalian parsial per unit (`rpc_return_single_unit`), fungsi mencatat ke `public.auth_audit_log` dengan `event_type = 'loan.return.single'` dan payload metadata:
       ```json
       {
         "loan_row_id": p_loan_row_id,
         "unit_id": p_unit_id,
         "kode_unit": v_unit_code,
         "transaction_id": v_tx_id,
         "condition_status": p_condition_status
       }
       ```
  4. **Ketersediaan Tabel Audit:** Tabel `auth_audit_log` telah tersedia di baseline skema migrasi ([`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql` Baris 312-321](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql#L312-L321)) dengan relasi `actor_id REFERENCES canonical_identity(id)`.
  5. **Display Hint Sekunder:** String ringkas catatan kru tetap dipertahankan pada kolom teks `catatan` semata-mata sebagai informasi visual sekunder, bukan sebagai sumber bukti forensik utama.

---

### Keputusan 7: Kebijakan Auto-Approval untuk Eksekutif pada `rpc_submit_official_doc`
* **Status Keputusan:** **DISETUJUI (APPROVED) — PEMISAHAN MUTLAK (OPSI 7A)**
* **Ketentuan:**
  1. Seluruh surat yang diajukan melalui `rpc_submit_official_doc` **selalu berstatus `'diajukan'`** dan **kolom `disetujui_oleh` selalu bernilai `NULL`**, tanpa memedulikan peran pemohon (termasuk jika pemohon adalah Eksekutif).
  2. Pengesahan surat resmi wajib melalui aksi persetujuan khusus (*approval action*) terpisah guna mempertahankan jejak audit dan pemisahan tugas (*separation of duties*).
  3. Surat izin santri (`ptv_surat_izin`) secara khusus tidak boleh disahkan secara sepihak oleh pemohon sendiri.

---

### Keputusan 8: Evaluasi Tiga Nilai (3VL) `has_capability` Fail-Closed (`IS NOT TRUE`)
* **Status Keputusan:** **DISETUJUI (APPROVED) — MANDATORY FAIL-CLOSED**
* **Analisis Celah:**
  Evaluasi `IF NOT public.has_capability(...) THEN` dalam PL/pgSQL menghasilkan `NULL` jika `has_capability()` mengembalikan `NULL`. Kondisi `IF NULL THEN` tidak mengeksekusi blok `THEN`, menyebabkan pemeriksaan keamanan lolos secara sepihak (*fail-open*).
* **Ketentuan Implementasi:**
  Seluruh pemanggilan kapabilitas pada kelima RPC wajib menggunakan klausul evaluasi tiga nilai eksplisit:
  `IF public.has_capability(...) IS NOT TRUE THEN RAISE EXCEPTION ...;`
  Hal ini menjamin nilai `FALSE` maupun `NULL` akan ditolak secara mutlak.

---

### Keputusan 9: Validasi Argumen Ketat & Fail-Fast di Level Prosedur
* **Status Keputusan:** **DISETUJUI (APPROVED) — STRICT ARGUMENT VALIDATION**
* **Ketentuan Implementasi:**
  1. Parameter teks wajib (`p_transaction_id`, `p_borrower_name`, `p_purpose`, `p_doc_type`) dilarang bernilai `NULL` atau string kosong (`btrim(x) = ''`).
  2. Parameter tanggal dilarang `NULL` dan divalidasi urutannya (`p_due_date >= p_out_date`, `tanggal_selesai >= tanggal_mulai`). String tanggal JSONB wajib divalidasi pola ISO `YYYY-MM-DD` sebelum casting `::DATE`.
  3. Array unit `p_unit_ids` dilarang `NULL`, dilarang kosong (`cardinality = 0`), dilarang mengandung elemen `NULL`, dan dilarang mengandung duplikat UUID.
  4. Payload JSONB pada surat wajib berupa JSON object valid (`jsonb_typeof = 'object'`) dan memuat field wajib per tipe dokumen.
  5. Nilai kondisi barang (`p_condition_status`) divalidasi ketat terhadap enum yang sah: `'bagus'`, `'rusak'`, atau `'perlu_servis'`.

---

### Keputusan 10: Semantik Alokasi Nomor Inventaris (`rpc_get_next_inv_code`) — Suggester vs Reservasi
* **Status Keputusan:** **DISETUJUI (APPROVED) — ADVISORY CODE SUGGESTER (NON-ALLOCATING)**
* **Analisis Concurrency:**
  Fungsi `rpc_get_next_inv_code()` beroperasi dalam transaksi pembacaan tunggal yang langsung di-commit saat HTTP response dikembalikan ke browser. Fungsi ini **TIDAK mencadangkan baris pada tabel `ptv_inventaris`**.
* **Ketentuan Implementasi:**
  1. `rpc_get_next_inv_code()` diklasifikasikan sebagai *sequential code suggester / preview*.
  2. Transaksi pembacaan diserialkan dengan `pg_advisory_xact_lock(1001)`.
  3. Format sequence dinamis mencegah right-truncation `LPAD` jika angka melampaui 999.
  4. Filter regex `kode ~ '^INV-[0-9]+$'` mencegah polusi kode non-INV dan integer overflow (menggunakan `::BIGINT` parsing).
  5. Jaminan keunikan akhir (*ultimate source of truth*) ditegakkan oleh constraint `UNIQUE (kode)` pada tabel `ptv_inventaris`.
  6. **Peringatan Integritas:** Advisory lock pada fungsi ini tidak melindungi dari tabrakan penyimpanan jika dua klien membuka form pendaftaran barang bersamaan. Pembuatan barang secara atomik di masa depan disarankan melalui RPC terpadu `rpc_create_inventory(...)`.

---

### Keputusan 11: Karantina Unit Rusak Pasca-Pengembalian
* **Status Keputusan:** **DISETUJUI (APPROVED) — DAMAGED GEAR QUARANTINE**
* **Analisis Celah:**
  Rancangan awal menetapkan `status_peminjaman = 'tersedia'` tanpa memedulikan nilai `p_condition_status`, sehingga kamera atau lensa yang dilaporkan rusak langsung dapat dipinjam kembali oleh kru lain.
* **Ketentuan Implementasi:**
  Pada `rpc_return_loan` dan `rpc_return_single_unit`:
  ```sql
  SET status_peminjaman = CASE 
          WHEN p_condition_status IN ('rusak', 'perlu_servis') THEN 'rusak' 
          ELSE 'tersedia' 
      END,
      kondisi = p_condition_status,
      updated_at = now()
  ```
  Unit dengan kondisi rusak atau perlu servis langsung berstatus `'rusak'` dan terkarantina dari checkout peminjaman berikutnya sampai melalui proses inspeksi/reparasi.

---

### Keputusan 12: Kanal Tunggal Pembuatan Surat & Proteksi Alur Persetujuan
* **Status Keputusan:** **DISETUJUI (APPROVED) — WRITE ACCESS LOCKDOWN & KETENTUAN HAK BACA TERVERIFIKASI**
* **Ketentuan Implementasi:**
  1. **Lockdown Penulisan Surat:** Izin `INSERT` pada tabel `ptv_surat_tugas`, `ptv_surat_izin`, dan `ptv_surat_barang` dicabut dari `authenticated`, `anon`, dan `PUBLIC`. Seluruh pembuatan surat **wajib** melalui `rpc_submit_official_doc` demi menjamin keaslian kolom `diajukan_oleh`.
  2. **Preservasi Alur Persetujuan:** Hak `UPDATE` pada kolom status dan `disetujui_oleh` tetap dapat dilakukan oleh role berwenang (`documents.approve`), dengan integritas kolom `diajukan_oleh` dan `nomor_surat` tetap terlindungi dari manipulasi pasca-penerbitan.
  3. **Kebijakan Hak Baca (SELECT Policy) Tabel Persuratan:**
     * **Larangan Kebijakan Spekulatif:** Dilarang membuat policy RLS `SELECT` baru secara spekulatif tanpa bukti aktual dari database staging dan persetujuan spesifikasi hak baca.
     * **Inspeksi Preflight Wajib:** Operator database wajib memeriksa status aktual pada `pg_policies` dan `information_schema.table_privileges` melalui kueri preflight untuk memastikan apakah terdapat policy warisan di staging.
     * **Klarifikasi Kebutuhan Otorisasi Baca:** Spesifikasi kebutuhan baca (apakah santri pemohon hanya diizinkan membaca surat miliknya `diajukan_oleh = auth.uid()` atau kru studio berhak membaca seluruh arsip dinas) wajib dikonfirmasi terlebih dahulu sebelum policy DDL dirancang dan dieksekusi.

---

### Keputusan 13: Kejujuran Klasifikasi Prosedur Pemulihan (Recovery Runbook)
* **Status Keputusan:** **DISETUJUI (APPROVED) — HYBRID FUNCTIONAL ROLLBACK CLASSIFICATION**
* **Analisis Ketidaksesuaian:**
  Runbook pemulihan pada Bagian 4 proposal sebelumnya mengklaim sebagai "Revert to Baseline Revised". Namun hasil audit membuktikan bahwa runbook tersebut:
  1. Menggunakan parameter `p_actor_id UUID DEFAULT NULL` (baseline tidak memiliki default).
  2. Mempertahankan perbaikan regex dan formatting dinamis pada `rpc_get_next_inv_code`.
  3. Mempertahankan `ORDER BY id` pada `rpc_checkout_loan`.
  4. Mempertahankan pencabutan hak eksekusi `service_role` dan `anon` (least privilege lockdown).
  5. Tidak menghapus kolom `diajukan_oleh` pada tabel persuratan.
* **Ketentuan Implementasi:**
  1. Prosedur pemulihan secara formal diklasifikasikan sebagai **Hybrid Functional Rollback (Pembalikan Logika Bisnis dengan Preservasi Proteksi Akses & Skema Kolom)**.
  2. Operator dilarang menyebut prosedur ini sebagai "Rollback Penuh ke Skema Awal".
  3. Menyediakan dua skrip terpisah dalam dokumentasi: **Opsi A (Strict 100% Baseline Revert)** dan **Opsi B (Hybrid Safe Functional Reversion)**.

---

### Keputusan 14: Konfigurasi `search_path` Aman pada `SECURITY DEFINER`
* **Status Keputusan:** **DISETUJUI (APPROVED) — SAFE SEARCH PATH HARDENING**
* **Ketentuan Implementasi:**
  1. Seluruh fungsi `SECURITY DEFINER` wajib menggunakan:
     `SET search_path = pg_catalog, public, auth`
     Penambahan `pg_catalog` secara eksplisit di awal search path menjamin fungsi dan operator bawaan sistem tidak dapat dibajak oleh objek dengan nama sama di skema `public` atau `pg_temp`.
  2. Seluruh pemanggilan tabel dan fungsi buatan sendiri diwajibkan menggunakan kualifikasi skema lengkap (`public.ptv_*`, `public.has_capability`, `auth.uid()`).
  3. Preflight query wajib memeriksa hak `CREATE` pada skema `public` bagi role `PUBLIC`, `anon`, dan `authenticated`.

---

## 4. Matriks Ringkasan Temuan Audit 9 Area Wajib

| ID Temuan | Area Audit | Tingkat Keparahan | Status Bukti | Ringkasan Masalah | Status Solusi / Blocker |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-DEF-01** | 1. SECURITY DEFINER | **P1** | Terbukti dari kode | Risiko pembajakan objek jika `search_path` tidak mendahulukan `pg_catalog` atau jika schema `public` dapat ditulis oleh unprivileged user. | **Terselesaikan dalam Dokumen:** Gunakan `SET search_path = pg_catalog, public, auth` dan kualifikasi skema lengkap. Preflight memeriksa `has_schema_privilege`. |
| **IDN-RES-01** | 2. Resolusi Identitas | **P0** | Terbukti dari kode | Resolusi keanggotaan `ptv_studio` menggunakan `ORDER BY ... LIMIT 1` yang bersifat arbitrer dan menyembunyikan inkonsistensi data. | **Terselesaikan dalam Dokumen:** Diubah menjadi fail-closed mutlak (`COUNT(*) > 1` melempar eksepsi integritas `23514`). |
| **INV-NUM-01** | 3. Penomoran Inventaris | **P1** | Terbukti kode & dokumen | `rpc_get_next_inv_code` disalahartikan sebagai alokasi aman; lock dilepas saat commit fungsi, rentan tabrakan saat form submit. | **Terselesaikan dalam Dokumen:** Diklasifikasikan tegas sebagai *Preview Suggester*; usulkan RPC atomik `rpc_create_inventory`. |
| **DOC-NUM-01** | 4. Penomoran Surat | **P1** | Didukung dokumen | Format `ST-PTV/YYYY/MM/xxx` terbukti konsisten di kontrak, namun data historis di staging berisiko format non-standar. | **Blocker Terbuka:** Perlu eksekusi query preflight di staging sebelum patch untuk membuktikan format arsip lama. |
| **VAL-BIZ-01** | 5. Validasi & Bisnis | **P1** | Terbukti dari kode | Direct casting `::DATE` pada payload JSONB melempar database exception `22007` tanpa validasi format ISO ramah aplikasi. | **Terselesaikan dalam Dokumen:** Tambahkan validasi regex `^[0-9]{4}-[0-9]{2}-[0-9]{2}$` sebelum casting. |
| **FNC-CMP-01** | 6. Kompatibilitas RPC | **P0** | Terbukti & Inferensi | Menghapus overload warisan tanpa bukti preflight berisiko memutus pemanggil tak terduga; membiarkannya memicu `PGRST203`. | **Blocker Terbuka:** Verifikasi daftar overload aktual di staging via `pg_proc` sebelum mengeksekusi `DROP FUNCTION`. |
| **ACC-WRT-01** | 7. Hak Akses Surat | **P1** | Terbukti dari kode | RLS aktif pada tabel surat tanpa policy SELECT terdefinisi di baseline migrasi. | **Blocker Terbuka:** Verifikasi status `pg_policies` aktual di staging via preflight query dan konfirmasi kebutuhan bisnis SELECT. Dilarang membuat policy spekulatif tanpa bukti lapangan. |
| **CNC-DLK-01** | 8. Deadlock & Concurrency | **P2** | Terbukti dari kode | Lock order deterministik terbukti aman. `hashtext()` pada checkout transaction ID berisiko hash contention kecil namun dilindungi unique check. | **Terselesaikan dalam Dokumen:** Diverifikasi bebas deadlock; konfirmasi integritas `(transaction_id, unit_id)`. |
| **RCV-INT-01** | 9. Pemulihan Bencana | **P0** | Terbukti dari kode | Runbook pemulihan mengklaim revert baseline penuh padahal mempertahankan hybrid fixes dan skema DDL. | **Terselesaikan dalam Dokumen:** Diklasifikasikan secara jujur sebagai *Hybrid Functional Rollback* dengan dua opsi terpisah. |
