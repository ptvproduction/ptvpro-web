# PTV PRO — STAGING REFERENCE DATA SEED AUDIT REPORT

**Subsystem:** PTV PRO Database & Supabase Integration  
**Phase:** Phase 5C.1 — Staging Seed Audit  
**Date:** 09 Oktober 2026  
**Target Project:** Supabase Staging (`swadgljnyelsjstqqxbm`)  
**Status:** **AUDITED & GATED (SEED-ONLY SCRIPT PREPARED)**  

---

## 1. Executive Summary & Root Cause Investigation

### Observasi Awal:
Validator cloud melaporkan bahwa seluruh **37 tabel/view** dan **7 RPC** telah berhasil terdeploy di Supabase Staging (`swadgljnyelsjstqqxbm`). Namun, pemeriksaan baris referensi menemukan:
- `capability_registry`: **0 baris** (Ekspektasi: 53)
- `access_profile`: **0 baris** (Ekspektasi: 5)
- `organization`: **0 baris** (Ekspektasi: 2)
- `organization_division`: **0 baris** (Ekspektasi: 5)
- `profile_capabilities`: **0 baris** (Ekspektasi: 177)

### Analisis Akar Masalah:
1. **Pemisahan Eksekusi DDL:** Saat eksekusi perbaikan DDL dilakukan di SQL Editor Supabase, hanya blok definisi skema (`CREATE TABLE`, `CREATE OR REPLACE VIEW`, `CREATE OR REPLACE FUNCTION`, `CREATE POLICY`) yang terproses atau dieksekusi secara selektif.
2. **Ketiadaan Data Parsial:** Kueri katalog membuktikan bahwa tabel-tabel referensi tersebut berstatus `rowsecurity = false` (RLS tidak aktif pada tabel metadata referensi) dan mengembalikan array kosong `[]` dengan status `HTTP 200 OK`. Ini membuktikan tabel telah sukses terbuat, namun blok pernyataan `INSERT INTO` (baris 131–306) belum sempat dijalankan ke database staging.

---

## 2. Audit Integritas Data Referensi (53 Capabilities & 5 Profiles)

### A. Capability Registry (Tepat 53 Kapabilitas Granular — ADR-016)
Pemeriksaan silang terhadap [`src/core/policy/capabilities.ts`](file:///c:/Users/zidna/ptvpro/src/core/policy/capabilities.ts) dan [`docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-HUB-FINAL-DATABASE-AUTH-CONTRACT.md):
- **Total Keys:** Tepat 53 kunci unik.
- **Duplikasi:** 0 duplikat (`unique Set size = 53`).
- **Domain Distribution:**
  - `hub` (1): `hub.access`
  - `events` (6): `events.view`, `events.create`, `events.edit`, `events.delete`, `events.rundown.manage`, `calendar.view`
  - `inventory` (7): `inventory.view`, `inventory.create`, `inventory.edit`, `inventory.delete`, `inventory.units.manage`, `inventory.valuation.view`, `inventory.valuation.manage`
  - `loans` (4): `loans.view`, `loans.checkout`, `loans.return`, `loans.manage`
  - `damage` (3): `damage.view`, `damage.report`, `damage.qc.approve`
  - `lostfound` (3): `lostfound.view`, `lostfound.report`, `lostfound.manage`
  - `crew` (7): `crew.view`, `crew.create`, `crew.edit`, `crew.status.manage`, `crew.permissions.manage`, `id.view`, `id.export`
  - `documents` (6): `documents.view`, `documents.request`, `documents.generate`, `documents.approve`, `documents.archive.view`, `documents.archive.manage`
  - `finance` (3): `finance.view`, `finance.manage`, `finance.operator`
  - `contacts` (3): `contacts.internal.view`, `contacts.external.view`, `contacts.external.manage`
  - `broadcast` (2): `broadcast.view`, `broadcast.dispatch`
  - `projecthaul` (2): `projecthaul.view`, `projecthaul.manage`
  - `notes` (3): `notes.view`, `notes.create`, `notes.manage`
  - `settings` (2): `settings.personal`, `settings.system`
  - `audit` (1): `audit.logs.view`
- **Klasifikasi Keamanan:** Tepat 32 kapabilitas bertipe mutasi (`is_mutation = true`) dan 12 kapabilitas bertipe sensitif (`is_sensitive = true`).

### B. Canonical Access Profiles (Tepat 5 Profil)
Pemeriksaan silang terhadap [`src/core/policy/profiles.ts`](file:///c:/Users/zidna/ptvpro/src/core/policy/profiles.ts):
1. `root_executive` ("PTV / Root Executive"): Akun institusi emergency override.
2. `eksekutif` ("Eksekutif"): Kepemimpinan operasional penuh (Ketua Umum, Sekretaris & Bendahara, Koor Operasional).
3. `kepolo_kepali` ("Kepolo Kepali"): Kepala divisi fungsional & supervisor operasional.
4. `crew` ("Crew"): Santri kru operasional studio aktif.
5. `pembina` ("Pembina"): Majelis pembina & penasihat yayasan.

### C. Matriks Pemetaan Profil-Kapabilitas (177 Relasi Unik)
| Profil | Jumlah Kapabilitas | Cakupan Hak Akses | Karantina Keamanan |
| :--- | :--- | :--- | :--- |
| **`root_executive`** | **53** | 100% dari seluruh 53 kapabilitas | Tidak ada restriksi |
| **`eksekutif`** | **53** | 100% dari seluruh 53 kapabilitas (ADR-016) | Termasuk keuangan & valuasi |
| **`kepolo_kepali`** | **37** | Hak supervisi divisi, inventaris, persuratan, dan tim | Bebas dari modul keuangan kas besar |
| **`crew`** | **24** | Hak operasional harian, peminjaman alat, rundown acara | Terisolasi dari mutasi kru & persetujuan QC |
| **`pembina`** | **10** | Hak monitoring pasif (view event, kalender, inventaris non-harga) | **Karantina Ketat:** `finance.*` dan `inventory.valuation.*` dilarang total |

$$\text{Total Relasi Pemetaan: } 53 + 53 + 37 + 24 + 10 = \mathbf{177\ Rows}$$

---

## 3. Analisis Keselamatan & Idempotensi Skrip Seed

File khusus seed telah disiapkan:  
[`docs/PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql)

### A. Dependensi Foreign Key (Urutan Penataan):
1. Level 1: `organization` & `organization_division` (Mandiri, tanpa FK).
2. Level 2: `access_profile` & `capability_registry` (Mandiri, tanpa FK).
3. Level 3: `profile_capabilities` (Bergantung pada FK `profile_id` dan `capability_key`).  
*Urutan penataan dalam skrip menjamin Level 1 dan 2 terisi sebelum Level 3 dieksekusi.*

### B. Perlindungan Konflik (`ON CONFLICT`):
- `organization`: `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`
- `organization_division`: `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`
- `access_profile`: `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`
- `capability_registry`: `ON CONFLICT (key) DO UPDATE SET domain = EXCLUDED.domain, description = EXCLUDED.description, is_mutation = EXCLUDED.is_mutation, is_sensitive = EXCLUDED.is_sensitive`
- `profile_capabilities`: `ON CONFLICT (profile_id, capability_key) DO NOTHING`

### C. Dampak Terhadap Objek yang Ada:
- **Zero Schema Touch:** Nol `CREATE TABLE`, nol `ALTER TABLE`, nol `DROP`, nol `TRUNCATE`.
- **Zero User Touch:** Nol pembuatan akun, kredensial, hash password, atau data kru.
- **Zero Production Risk:** Hanya berisi konstanta kamus data sistem.
- **Atomic Rollback:** Seluruh blok diikat dalam `BEGIN; ... COMMIT;`. Jika terjadi anomali sintaks, database kembali ke status awal secara atomik.

---

## 4. Audit & Peningkatan Validator Cloud (`validate-staging-cloud.mjs`)

Validator cloud pada [`scripts/validate-staging-cloud.mjs`](file:///c:/Users/zidna/ptvpro/scripts/validate-staging-cloud.mjs) telah diaudit dan diperketat untuk mengeliminasi potensi *false positive*:

1. **Eliminasi Ambigu Status Code:**
   - Sebelumnya, status `401` dan `403` dianggap sebagai bukti keberadaan objek (`deployed`).
   - Perbaikan: Hanya `HTTP 200 OK` (dengan respon valid JSON) yang diterima sebagai bukti tabel/view eksis dan terbaca. Jika terjadi `401`, validator secara eksplisit mengklasifikasikannya sebagai *Authentication Failure* (bukan *Object Deployed*).
2. **Audit RPC Berbasis Exception Signature:**
   - Panggilan ke 5 RPC bisnis diuji menggunakan parameter kontrak yang tepat.
   - Respon `HTTP 400` dengan kode PostgREST `P0001` (misalnya `"UNAUTHORIZED: loans.checkout capability required"`) divalidasi sebagai bukti **fungsi ada, terkompilasi, dan guard PL/pgSQL aktif memvalidasi kapabilitas**.
3. **Verifikasi Matriks Seed Mendalam:**
   - Validator kini menguji kuantitas baris dari 5 tabel referensi:
     - `organization` == 2
     - `organization_division` == 5
     - `access_profile` == 5
     - `capability_registry` == 53
     - `profile_capabilities` == 177
   - Memeriksa langsung bahwa profil `pembina` memiliki tepat 10 kapabilitas dan tidak memiliki satupun kapabilitas keuangan/valuasi.

---

## 5. Ringkasan File Deliverables Phase 5C.1

1. **[docs/PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql):**  
   Skrip SQL mandiri, aman, dan idempoten untuk mengisi seluruh data referensi (2 organisasi, 5 divisi, 5 profil, 53 kapabilitas, 177 pemetaan) tanpa menyentuh DDL atau tabel data kru/operasional.
2. **[scripts/validate-staging-cloud.mjs](file:///c:/Users/zidna/ptvpro/scripts/validate-staging-cloud.mjs):**  
   Skrip validator cloud yang telah diperketat, bebas dari false positive, dan memverifikasi kuantitas serta integritas relasi referensi secara menyeluruh.
3. **[docs/PTV-PRO-STAGING-SEED-AUDIT.md](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-SEED-AUDIT.md):**  
   Laporan audit komprehensif ini.

---

## 6. Rekomendasi Langkah Selanjutnya (Menunggu Persetujuan Pengguna)

Pengguna dipersilakan meninjau laporan ini. Setelah disetujui, langkah manual yang dapat dilakukan adalah:
1. Salin seluruh isi [docs/PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-SEED-REFERENCE-DATA.sql).
2. Tempel dan jalankan di SQL Editor Supabase Staging (`swadgljnyelsjstqqxbm`).
3. Jalankan validator di terminal lokal:
   ```powershell
   node scripts/validate-staging-cloud.mjs
   ```
