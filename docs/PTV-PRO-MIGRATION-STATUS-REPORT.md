# PTV PRO — FULL MIGRATION STATUS REPORT
## Production (jthzuhkblxcaohiuypqq) → Staging (swadgljnyelsjstqqxbm)
**Tanggal Audit:** 2026-10-18 00:00 WIB
**Status:** PLANNING COMPLETE — MENUNGGU DATA EXPORT OPERATOR

---

## RINGKASAN EKSEKUTIF

Migrasi tidak dapat dilakukan sepenuhnya secara otomatis karena:
1. **Tidak ada credential Production** di mesin ini (service role Production tidak tersimpan di .env)
2. **Tidak ada psql/Supabase CLI** di mesin ini
3. **Supabase REST API tidak mendukung DDL** (hanya DML via RPC yang sudah ada)

**Yang sudah selesai:**
- ✅ Audit Staging database (row counts semua tabel)
- ✅ Export queries Production siap (`PTV-PRO-PRODUCTION-EXPORT-QUERIES.sql`)
- ✅ DDL arsip legacy tabel siap (`PTV-PRO-STAGING-MIGRATION-PART1-DDL.sql`)
- ✅ Import template scripts siap (`PTV-PRO-STAGING-MIGRATION-PART2-IMPORT.sql`)
- ✅ Migration crew SQL siap (`scripts/legacy-migration-crew.sql` — 89 kru)

---

## STATUS AUDIT 35 TABEL PRODUCTION (ESTIMASI BERDASARKAN SCHEMA)

| # | Tabel Production | Ada di Staging? | Staging Rows | Strategi | Status |
|---|---|---|---:|---|---|
| 1 | ptv_kru | ❌ Tidak | — | Arsip legacy_archive_kru | 🟡 DDL Siap |
| 2 | ptv_aset | ❌ Tidak | — | Arsip legacy_archive_aset | 🟡 DDL Siap |
| 3 | ptv_inventaris | ✅ Ada | 1 | Import ke canonical | 🟡 Template Siap |
| 4 | ptv_inventaris_unit | ✅ Ada | 2 | Import ke canonical | 🟡 Template Siap |
| 5 | ptv_nilai_inventaris | ✅ Ada | 0 | Import ke canonical | 🟡 Template Siap |
| 6 | ptv_peminjaman | ✅ Ada | 0 | Import setelah inventaris | 🟡 Template Siap |
| 7 | ptv_lapor_masalah | ✅ Ada | 0 | Import ke canonical | 🟡 Template Siap |
| 8 | ptv_request_aset | ❌ Tidak | — | Arsip legacy_archive_request_aset | 🟡 DDL Siap |
| 9 | ptv_lost_found | ✅ Ada | 0 | Import ke canonical | 🟡 Template Siap |
| 10 | ptv_acara | ✅ Ada | 0 | Import ke canonical | 🟡 Template Siap |
| 11 | ptv_content_planner | ✅ Ada | 0 | Import ke canonical | 🟡 Template Siap |
| 12 | ptv_konten | ❌ Tidak | — | Arsip legacy_archive_konten | 🟡 DDL Siap |
| 13 | ptv_galeri | ❌ Tidak | — | Arsip legacy_archive_galeri | 🟡 DDL Siap |
| 14 | ptv_ebook | ❌ Tidak | — | Arsip (ebook/portfolio) | ⚪ Perlu DDL |
| 15 | ptv_portfolio | ❌ Tidak | — | Arsip legacy_archive_galeri | ⚪ Perlu DDL |
| 16 | ptv_tugas | ❌ Tidak | — | Arsip legacy_archive_tugas | 🟡 DDL Siap |
| 17 | ptv_riwayat_tugas | ❌ Tidak | — | Arsip referensi ke tugas | ⚪ Perlu DDL |
| 18 | ptv_update | ❌ Tidak | — | Arsip legacy_archive_konten | ⚪ Perlu DDL |
| 19 | ptv_kas_kru | ✅ Ada | 0 | Import ke canonical | 🟡 Template Siap |
| 20 | ptv_kas_periode | ✅ Ada | 0 | Import ke canonical | 🟡 Template Siap |
| 21 | ptv_keuangan | ✅ Ada | 0 | Import ke canonical | 🟡 Template Siap |
| 22 | ptv_pemasukan | ✅ Ada | 0 | Import ke canonical | 🟡 Template Siap |
| 23 | ptv_pengeluaran | ✅ Ada | 0 | Import ke canonical | 🟡 Template Siap |
| 24 | ptv_izin | ❌ Tidak | — | Arsip legacy_archive_izin | 🟡 DDL Siap |
| 25 | ptv_surat_barang | ✅ Ada | 0 | Import ke canonical | 🟡 Template Siap |
| 26 | ptv_surat_izin | ✅ Ada | 0 | Import ke canonical | 🟡 Template Siap |
| 27 | ptv_surat_tugas | ✅ Ada | 0 | Import ke canonical | 🟡 Template Siap |
| 28 | ptv_kontak_eksternal | ✅ Ada | 0 | Import ke canonical | 🟡 Template Siap |
| 29 | ptv_pengumuman | ✅ Ada | 0 | Import ke canonical | 🟡 Template Siap |
| 30 | ptv_pendaftar | ❌ Tidak | — | Arsip legacy_archive_pendaftar | 🟡 DDL Siap |
| 31 | ptv_catatan | ✅ Ada | 0 | Import ke canonical | 🟡 Template Siap |
| 32 | ptv_notifications | ✅ Ada | 0 | DIKECUALIKAN (tidak relevan) | 🔴 Excluded |
| 33 | ptv_login_history | ✅ Ada | 0 | DIKECUALIKAN (keamanan) | 🔴 Excluded |
| 34 | ptv_push_subscriptions | ✅ Ada | 0 | DIKECUALIKAN (subscription aktif) | 🔴 Excluded |
| 35 | users | ❌ Tidak | — | DIKECUALIKAN (Supabase auth internal) | 🔴 Excluded |

---

## TABEL STAGING YANG DILINDUNGI (TIDAK DISENTUH)

| Tabel | Rows Saat Ini | Status |
|---|---:|---|
| canonical_identity | 2 | ✅ Dilindungi |
| user_account | 2 | ✅ Dilindungi |
| auth_credentials | 0 | ✅ Dilindungi |
| identity_contact | 0 | ✅ Dilindungi |
| access_profile | 5 | ✅ Dilindungi |
| account_profiles | 2 | ✅ Dilindungi |
| capability_registry | 53 | ✅ Dilindungi |
| profile_capabilities | 177 | ✅ Dilindungi |
| organization | 2 | ✅ Dilindungi |
| organization_division | 5 | ✅ Dilindungi |
| organization_membership | 2 | ✅ Dilindungi |

---

## LANGKAH EKSEKUSI YANG DIPERLUKAN OPERATOR

### TAHAP 1: Siapkan DDL Tabel Arsip di Staging (± 5 menit)

Buka **Staging SQL Editor** (`swadgljnyelsjstqqxbm`):
1. Jalankan `docs/PTV-PRO-STAGING-MIGRATION-PART1-DDL.sql`
2. Verifikasi output: Semua `legacy_archive_*` dan `migration_log` terbuat

### TAHAP 2: Export Data dari Production (± 15 menit)

Buka **Production SQL Editor** (`jthzuhkblxcaohiuypqq`):
1. Jalankan masing-masing SECTION dari `docs/PTV-PRO-PRODUCTION-EXPORT-QUERIES.sql`
2. Copy output JSON setiap section
3. Paste ke chat ini (bagian per bagian): **"Data kru:", data JSON...**

### TAHAP 3: Agen Memproses dan Mengimport ke Staging (otomatis)

Setelah menerima data JSON:
- Agen akan mem-populate `docs/PTV-PRO-STAGING-MIGRATION-PART2-IMPORT.sql`
- Agen akan menjalankan INSERT ke Staging via API atau template SQL
- Agen akan memverifikasi row counts setelah import

### TAHAP 4: Jalankan Crew Migration SQL (sudah siap)

Script `scripts/legacy-migration-crew.sql` (221KB, 89 kru) sudah siap:
- Menjalankan ini akan membuat canonical_identity, user_account, organization_membership
- **PERLU KONFIRMASI SEBELUM DIJALANKAN** karena akan menambah 89 identitas ke Staging

---

## REKAP FILE YANG DIBUAT SESI INI

| File | Tujuan | Status |
|---|---|---|
| `docs/PTV-PRO-PRODUCTION-EXPORT-QUERIES.sql` | Queries read-only untuk Production | ✅ Siap |
| `docs/PTV-PRO-STAGING-MIGRATION-PART1-DDL.sql` | DDL tabel arsip legacy Staging | ✅ Siap |
| `docs/PTV-PRO-STAGING-MIGRATION-PART2-IMPORT.sql` | Template import data ke Staging | ✅ Siap |
| `scripts/legacy-migration-crew.sql` | Migration 89 kru (sudah ada sebelumnya) | ✅ Existing |

