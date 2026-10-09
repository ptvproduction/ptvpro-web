# PTV PRO — PHASE 5C.2 STAGING STATE RECONCILIATION REPORT

**Subsystem:** PTV PRO Database & Supabase Security Architecture  
**Phase:** Phase 5C.2 — Staging State Reconciliation  
**Date:** 09 Oktober 2026  
**Target Environment:** Supabase Staging (`swadgljnyelsjstqqxbm`)  
**Target URL:** `https://swadgljnyelsjstqqxbm.supabase.co`  
**Status:** **REKONSILIASI HYBRID SELESAI — KATALOG TINGKAT DATABASE MENUNGGU BUKTI PREFLIGHT DBA**  
**Authoritative References:**
- [PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md)
- [PTV-PRO-DATABASE-MIGRATION-REVISED.sql](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql)
- [PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql)
- [PTV-PRO-PHASE-5C1-REVIEW.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-PHASE-5C1-REVIEW.md)

---

## 1. Metodologi Rekonsiliasi & Batasan Bukti

Rekonsiliasi ini membandingkan kontrak arsitektur kanonikal dan kandidat DDL ([`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql)) dengan kondisi aktual Supabase Staging (`swadgljnyelsjstqqxbm`).

### Pembedaan Sumber Bukti (Strict Proof Separation):
1. **Bukti Endpoint REST (Live PostgREST Probe):**
   - Diperoleh melalui probe jaringan lokal read-only terhadap endpoint staging API menggunakan `anon` key.
   - Membuktikan keterpaparan tabel/view pada schema cache, respons operasi HTTP, perilaku RLS sisi klien, dan payload data publik/referensi.
2. **Katalog Internal PostgreSQL (System Catalog Metadata):**
   - Meliputi tabel sistem `pg_proc`, `pg_roles`, `pg_policies`, `pg_constraint`, `pg_class.relforcerowsecurity`, dan `pg_depend`.
   - **Keterbatasan Terbukti:** PostgREST dengan anon key tidak mengekspos tabel katalog sistem (`404 PGRST205: table pg_proc not found in schema cache`).
   - Oleh karena itu, pemeriksaan katalog murni disiapkan sebagai query read-only mandiri pada [`docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql) untuk dijalankan langsung oleh DBA manusia di Supabase SQL Editor.

---

## 2. Matriks Rekonsiliasi Empiris (4 Kategori Status)

### Kategori 1: TERBUKTI ADA (Verified Exists)

| Entitas / Komponen | Detail Pembuktian | Status Empiris |
| :--- | :--- | :--- |
| **Konektivitas Staging** | Probe `GET /auth/v1/health` merespons `HTTP 200 OK` (`GoTrue v2.197.0`). | **TERBUKTI ADA** |
| **36 Tabel Kanonikal** | Seluruh 36 tabel kanonikal merespons `HTTP 200 OK` via PostgREST schema cache. | **TERBUKTI ADA** |
| **View Kompatibilitas** | View `public.ptv_kru_legacy_compat` merespons `HTTP 200 OK` (0 baris, updatable). | **TERBUKTI ADA** |
| **Master Organisasi** | `GET /rest/v1/organization`: Tepat 2 baris (`ptv_studio`, `bsh_pesantren`). | **TERBUKTI ADA** |
| **Master Divisi** | `GET /rest/v1/organization_division`: Tepat 5 baris (`technical`, `editor`, `layouter`, `creative`, `engagements`). | **TERBUKTI ADA** |
| **Master Access Profile** | `GET /rest/v1/access_profile`: Tepat 5 baris (`root_executive`, `eksekutif`, `kepolo_kepali`, `crew`, `pembina`). | **TERBUKTI ADA** |
| **Capability Registry** | `GET /rest/v1/capability_registry`: Tepat 53 kapabilitas kanonikal (range 0-52/53). | **TERBUKTI ADA** |
| **Profile Capabilities** | `GET /rest/v1/profile_capabilities`: Tepat 177 pemetaan peran-kapabilitas. | **TERBUKTI ADA** |
| **Karantina Pembina** | `pembina` terbukti memiliki tepat 10 kapabilitas non-finansial & non-valuasi. | **TERBUKTI ADA** |
| **Perlindungan RLS (Peminjaman)** | Direct `INSERT` anon pada `ptv_peminjaman` ditolak: `HTTP 400 error 42501 (RLS violation)`. | **TERBUKTI ADA** |
| **Perlindungan RLS (Surat)** | Direct `INSERT` anon pada `ptv_surat_tugas` ditolak: `HTTP 400 error 42501 (RLS violation)`. | **TERBUKTI ADA** |
| **Isolasi Kredensial** | `GET /rest/v1/auth_credentials`: Mengembalikan array kosong `[]` (tertutup aman). | **TERBUKTI ADA** |
| **Isolasi Keuangan** | `GET /rest/v1/ptv_keuangan`: Mengembalikan array kosong `[]` (tertutup aman). | **TERBUKTI ADA** |

---

### Kategori 2: TERBUKTI TIDAK ADA (Verified Missing)

| Entitas / Komponen | Detail Pembuktian | Status Empiris |
| :--- | :--- | :--- |
| **Kolom `diajukan_oleh` (Surat Tugas)** | Probe `GET /rest/v1/ptv_surat_tugas?select=diajukan_oleh` menghasilkan error: `code: 42703, message: column ptv_surat_tugas.diajukan_oleh does not exist`. | **TERBUKTI TIDAK ADA** |
| **Kolom `nama_acara` (Peminjaman)** | Probe `GET /rest/v1/ptv_peminjaman?select=nama_acara` menghasilkan error: `code: 42703, message: column ptv_peminjaman.nama_acara does not exist`. | **TERBUKTI TIDAK ADA** |

> [!NOTE]
> Ketidakhadiran kolom `nama_acara` konsisten dengan **Keputusan Arsitektur 2 (Opsi 2 - Implementasi Ditangguhkan)**.  
> Namun, ketidakhadiran kolom `diajukan_oleh` adalah **schema drift** dari versi migrasi awal yang wajib diperbaiki oleh kandidat DDL revisi ([`docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql)).

---

### Kategori 3: BERBEDA DARI KONTRAK (Contract Drift / Discrepancy)

| Area Perbedaan | Kondisi Aktual Staging (Empiris) | Kontrak Arsitektur / DDL Kandidat | Tingkat Keparahan |
| :--- | :--- | :--- | :--- |
| **Hak Eksekusi Anon pada `rpc_get_next_inv_code`** | Pemanggilan POST anon mengembalikan `"INV-001"` (HTTP 200). Role anon dapat mengeksekusi advisory lock dan pembacaan kode inventaris. | Kontrak mewajibkan `REVOKE ALL FROM PUBLIC, anon;` dan guard kapabilitas `inventory.create` atau `service_role`. | **TINGGI** |
| **Hak Eksekusi Anon pada RPC Operasional** | Pemanggilan POST anon pada `rpc_checkout_loan`, `rpc_return_loan`, dll. mengeksekusi PL/pgSQL hingga memicu error exception `P0001`. | Kontrak mewajibkan penolakan otorisasi di lapisan privilege PostgREST (`REVOKE ALL FROM PUBLIC, anon`). | **SEDANG** |
| **Integritas Penyetuju Surat (`disetujui_oleh`)** | Fungsi lama di staging menulis identitas pembuat (`p_actor_id`) langsung ke kolom `disetujui_oleh` saat surat baru diajukan. | Kontrak mewajibkan identitas pemohon dicatat di `diajukan_oleh` dan `disetujui_oleh = NULL` saat surat diajukan. | **KRITIS** |
| **Resolusi Aktor & Anti-Spoofing** | RPC lama di staging mempercayai parameter klien `p_actor_id` tanpa mencocokkan dengan `auth.uid()`. | Kontrak mewajibkan resolusi `auth.uid()` di sisi server dan penolakan `FORBIDDEN: Actor spoofing detected (42501)`. | **KRITIS** |

---

### Kategori 4: BELUM DAPAT DIVERIFIKASI (Awaiting DBA Human Preflight)

Komponen-komponen berikut berada di dalam katalog internal PostgreSQL yang tidak diekspos melalui endpoint REST anon key, sehingga statusnya ditandai secara jujur sebagai **MENUNGGU BUKTI**:

1. **Definisi Fungsi Live di Katalog (`pg_proc`):**
   - Apakah terdapat fungsi institusional PTV yang masih tersisa di skema terkelola `auth`?
   - Apakah fungsi `SECURITY DEFINER` saat ini di staging memiliki konfigurasi `SET search_path = pg_catalog, public, auth` pada kolom `pg_proc.proconfig`?
   - Apakah overload fungsi warisan tanpa parameter `p_actor_id` masih terdaftar di `pg_proc`?
2. **Hak Istimewa Peran & Rutin (`information_schema.routine_privileges`):**
   - Matriks penugasan hak eksekusi lengkap pada role `anon`, `authenticated`, `service_role`, dan pseudo-role `PUBLIC`.
3. **Status FORCE ROW LEVEL SECURITY (`pg_class.relforcerowsecurity`):**
   - Apakah relasi tabel sensitif menerapkan FORCE RLS untuk mencegah bypass oleh table owner?
4. **Detail Logika Kebijakan RLS (`pg_policies`):**
   - Definisi ekspresi `qual` dan `with_check` pada tabel-tabel operasional.
5. **Indeks, Trigger, Constraint, & Sequence (`pg_indexes`, `pg_trigger`, `pg_constraint`, `pg_sequences`):**
   - Keberadaan trigger penguncian dan integritas constraint di tingkat database PostgreSQL.

---

## 3. Panduan Langkah DBA untuk Memverifikasi Kategori 4

DBA yang berwenang dapat menyelesaikan verifikasi Kategori 4 dengan langkah read-only berikut:
1. Buka **Supabase Dashboard Staging (`swadgljnyelsjstqqxbm`) $\rightarrow$ SQL Editor**.
2. Salin dan jalankan seluruh query dari:  
   [`docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-PARTIAL-STATE-CHECK.sql)
3. Amati hasil output Section 1 s.d. 14:
   - Pastikan Section 6 melaporkan `target_ptv_functions_in_auth_schema_count = 0`.
   - Periksa Section 14 (*Candidate Contract Drift Reconciliation Summary*) untuk mencatat seluruh item yang berstatus `DRIFT / MISSING`.
4. Catat hasil temuan ke lembar verifikasi sebelum memberikan persetujuan eksekusi kandidat DDL revisi.
