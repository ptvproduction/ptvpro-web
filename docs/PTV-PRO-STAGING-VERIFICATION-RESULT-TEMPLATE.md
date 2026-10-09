# PTV PRO — SUPABASE STAGING VERIFICATION RESULT
## Laporan Hasil Eksekusi Manual Preflight Staging

> [!IMPORTANT]
> **PETUNJUK PENGISIAN BAGI OPERATOR / DBA MANUSIA:**  
> Dokumen ini adalah **TEMPLATE RESMI** untuk mencatat bukti eksekusi manual di dashboard Supabase SQL Editor.  
> **DILARANG MENGISI TEMPLATE INI DENGAN DATA ASUMSI, ESTIMASI, ATAU DATA REKAAN.**  
> Seluruh bagian di bawah ini wajib diisi berdasarkan **output nyata (*real live execution output*)** yang dikembalikan oleh Supabase SQL Editor saat menjalankan kueri dari [`docs/PTV-PRO-STAGING-PREFLIGHT-FINAL-STATIC.sql`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-PREFLIGHT-FINAL-STATIC.sql) mengikuti panduan [`docs/PTV-PRO-STAGING-VERIFICATION-RUNBOOK.md`](file:///c:/Users/zidna/ptvpro/docs/PTV-PRO-STAGING-VERIFICATION-RUNBOOK.md).

---

## 1. Metadata Eksekusi & Identifikasi Target

| Parameter Verifikasi | Nilai Ekspektasi / Standar | Nilai Aktual Lapangan (Wajib Diisi) | Status Validasi |
| :--- | :--- | :--- | :--- |
| **Tanggal Eksekusi** | YYYY-MM-DD | `[ISI TANGGAL EKSEKUSI]` | [ ] TERVERIFIKASI |
| **Waktu Eksekusi (WIB)** | HH:MM WIB | `[ISI WAKTU EKSEKUSI]` | [ ] TERVERIFIKASI |
| **Nama Operator / DBA** | Nama Personil Berwenang | `[ISI NAMA DBA PENGUJI]` | [ ] TERVERIFIKASI |
| **URL Dashboard Supabase** | `.../project/swadgljnyelsjstqqxbm` | `[SALIN URL BROWSER LENGKAP]` | [ ] COCOK / [ ] MISMATCH |
| **Project Reference ID** | `swadgljnyelsjstqqxbm` | `[ISI DARI PROJECT SETTINGS]` | [ ] COCOK / [ ] MISMATCH |
| **Connected Database** | `postgres` | `[HASIL current_database()]` | [ ] COCOK / [ ] MISMATCH |
| **Connected User Role** | `postgres` (Superuser) | `[HASIL current_user]` | [ ] COCOK / [ ] MISMATCH |
| **PostgreSQL Version** | PostgreSQL 15+ | `[HASIL server_version]` | [ ] TERVERIFIKASI |

---

## 2. Bagian Preflight yang Dijalankan

Tandai bagian yang telah dieksekusi secara aktual di Supabase SQL Editor:

- [ ] **Bagian 1: Katalog Metadata Murni** (Seksi 1 s.d. Seksi 6) — Status: `[SELESAI / BELUM / SEBAGIAN]`
- [ ] **Bagian 2: Agregat Baris Data Terbatas** (Seksi 7 s.d. Seksi 8) — Status: `[SELESAI / SKIPPED KARENA PRASYARAT BELUM TERPENUHI]`

---

## 3. Hasil Pemeriksaan Bagian 1 — Katalog Metadata Murni

### Seksi 1: Ekstensi Sistem
| Nama Ekstensi | Status Ekspektasi | Versi Terpasang (Hasil Aktual) | Skema Penempatan | Catatan Operator |
| :--- | :--- | :--- | :--- | :--- |
| `uuid-ossp` | Terpasang | `[ISI VERSI]` | `[extensions / public]` | |
| `pgcrypto` | Terpasang | `[ISI VERSI]` | `[extensions / public]` | |
| `pgjwt` | Terpasang | `[ISI VERSI]` | `[extensions / public]` | |

### Seksi 2: Keberadaan 36 Tabel Kanonikal & Dukungan Partisi
*Rekapitulasi:* `[ ... ]` Tabel EXISTS | `[ ... ]` Tabel MISSING

| No | Nama Tabel | Status Aktual (`EXISTS` / `MISSING`) | Tipe Relasi (`ORDINARY` / `PARTITIONED`) | RLS Status (`ENABLED` / `DISABLED`) | FORCE RLS (`TRUE` / `FALSE`) |
| :-: | :--- | :---: | :---: | :---: | :---: |
| 1 | `canonical_identity` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 2 | `identity_contact` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 3 | `user_account` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 4 | `auth_credentials` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 5 | `organization` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 6 | `organization_division` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 7 | `organization_membership` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 8 | `access_profile` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 9 | `capability_registry` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 10 | `profile_capabilities` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 11 | `account_profiles` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 12 | `account_capability_overrides` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 13 | `auth_audit_log` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 14 | `ptv_login_history` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 15 | `ptv_acara` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 16 | `ptv_acara_rundown` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 17 | `ptv_content_planner` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 18 | `ptv_inventaris` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 19 | `ptv_inventaris_unit` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 20 | `ptv_nilai_inventaris` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 21 | `ptv_peminjaman` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 22 | `ptv_lapor_masalah` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 23 | `ptv_lost_found` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 24 | `ptv_surat_tugas` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 25 | `ptv_surat_izin` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 26 | `ptv_surat_barang` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 27 | `ptv_keuangan` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 28 | `ptv_pemasukan` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 29 | `ptv_pengeluaran` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 30 | `ptv_kas_kru` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 31 | `ptv_kas_periode` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 32 | `ptv_catatan` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 33 | `ptv_kontak_eksternal` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 34 | `ptv_notifications` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 35 | `ptv_push_subscriptions` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| 36 | `ptv_pengumuman` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |

### Seksi 3: View Kompatibilitas (`ptv_kru_legacy_compat`)
- **Status View:** `[EXISTS / MISSING]`
- **Table Schema:** `[public / lainnya]`
- **Is Updatable:** `[YES / NO]`

### Seksi 4A & 4B: Audit 7 Fungsi Kanonikal, Overload, dan Hak Eksekusi
| Nama Fungsi | Skema | Status | Identity Arguments (Signature Aktual) | Tipe Keamanan | Volatilitas | Konfigurasi Lokal (`proconfig`) | Owner | Grantee yang Memiliki Hak `EXECUTE` |
| :--- | :---: | :---: | :--- | :---: | :---: | :--- | :---: | :--- |
| `jwt_custom_claims` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `has_capability` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `rpc_checkout_loan` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `rpc_return_loan` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `rpc_return_single_unit` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `rpc_get_next_inv_code` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `rpc_submit_official_doc` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |

*Catatan Khusus Overload:*  
- Apakah ditemukan fungsi dengan nama sama tetapi signature berbeda (PGRST203)? `[YA / TIDAK]`  
- Rincian jika YA: `[SEBUTKAN FUNGSI DAN ARGUMENNYA]`

### Seksi 5A: Hak Akses Skema `public`
| Role Sasaran | Status Role di `pg_roles` | Hak `USAGE` pada Skema `public` | Hak `CREATE` pada Skema `public` | Evaluasi Keamanan |
| :--- | :---: | :---: | :---: | :--- |
| `anon` | `[DEFINED / NOT FOUND]` | `[TRUE / FALSE]` | `[TRUE / FALSE]` | `[AMAN / RENTAN]` |
| `authenticated` | `[DEFINED / NOT FOUND]` | `[TRUE / FALSE]` | `[TRUE / FALSE]` | `[AMAN / RENTAN]` |
| `service_role` | `[DEFINED / NOT FOUND]` | `[TRUE / FALSE]` | `[TRUE / FALSE]` | `[NORMAL]` |
| `public` (pseudo-role) | PSEUDO-ROLE | `[TRUE / FALSE]` | `[TRUE / FALSE]` | `[AMAN / RENTAN]` |

### Seksi 5B & 5C: Status RLS & Policy pada 15 Tabel Operasional
| Nama Tabel | Status RLS | FORCE RLS | Jumlah Kebijakan (`policy_count`) | Ringkasan Kebijakan Eksisting di `pg_policies` |
| :--- | :---: | :---: | :---: | :--- |
| `ptv_keuangan` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_pemasukan` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_pengeluaran` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_kas_kru` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_nilai_inventaris` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `identity_contact` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `auth_credentials` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_push_subscriptions` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `auth_audit_log` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `canonical_identity` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_surat_tugas` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_surat_izin` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_surat_barang` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_peminjaman` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_inventaris_unit` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |

*Temuan Khusus Policy SELECT Persuratan (Keputusan 12):*  
`[CATAT APAKAH ADA POLICY SELECT UNTUK ptv_surat_tugas, ptv_surat_izin, ptv_surat_barang]`

### Seksi 5D: Hak Akses Tabel (`information_schema.table_privileges`)
*Hak INSERT pada tabel surat untuk role `authenticated`, `anon`, `PUBLIC`:*  
- `ptv_surat_tugas`: `[TERKUNCI / TERBUKA]`  
- `ptv_surat_izin`: `[TERKUNCI / TERBUKA]`  
- `ptv_surat_barang`: `[TERKUNCI / TERBUKA]`

### Seksi 5E: Status Kolom Khusus
| Nama Tabel | Nama Kolom | Status di Katalog (`EXISTS` / `MISSING`) | Tipe Data Aktual | Is Nullable |
| :--- | :--- | :---: | :---: | :---: |
| `ptv_peminjaman` | `nama_acara` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_peminjaman` | `keperluan` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_peminjaman` | `actor_id` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_surat_tugas` | `diajukan_oleh` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_surat_tugas` | `disetujui_oleh` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_surat_izin` | `diajukan_oleh` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_surat_izin` | `disetujui_oleh` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_surat_barang` | `diajukan_oleh` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_surat_barang` | `disetujui_oleh` | `[ ... ]` | `[ ... ]` | `[ ... ]` |

### Seksi 6: Rekapitulasi Kuantitatif Objek Skema `public`
- `public_tables_count`: `[ ... ]`
- `views_count`: `[ ... ]`
- `public_functions_count`: `[ ... ]`
- `target_ptv_functions_in_auth_schema_count`: `[ ... ]`
- `total_rls_policies_count`: `[ ... ]`

---

## 4. Hasil Pemeriksaan Bagian 2 — Agregat Baris Data Terbatas

> [!WARNING]
> Bagian ini **HANYA DIISI** jika seluruh tabel prasyarat (`ptv_surat_*` dan `organization_membership`) berstatus `EXISTS` pada Seksi 2.  
> Jika tabel belum ada, tandai: `SKIPPED (PREREQUISITE TABLES MISSING)`.

### Seksi 7: Audit Agregat Penomoran Surat Historis
| Nama Tabel | Total Surat | Nomor Terisi | Nomor NULL | Nomor Tertinggi | Jumlah Format Non-Standar (`count_format_non_standar`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `ptv_surat_tugas` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_surat_izin` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |
| `ptv_surat_barang` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` | `[ ... ]` |

*Catatan Pola Format Surat:*  
`[JELASKAN APAKAH SELURUH NOMOR MEMATUHI FORMAT -PTV/ ATAU ADA VARIASI LAIN]`

### Seksi 8: Audit Agregat Anomali Keanggotaan Studio (`ptv_studio`)
- **Total Identitas dengan Multi-Membership Aktif (`is_current = TRUE`):** `[ ... ]` *(Target: 0)*
- **Maksimum Duplikasi Keanggotaan per Identitas:** `[ ... ]` *(Target: 0 atau 1)*

*Evaluasi Integritas Data:*  
`[JELASKAN APAKAH TERDAPAT ANOMALI DUPLIKASI ATAU BERSIH]`

---

## 5. Log Error & Anomali Teknis yang Muncul Saat Eksekusi

Catat setiap pesan error, warning, atau perilaku tak terduga yang dikembalikan oleh PostgreSQL:

```text
[JIKA ADA ERROR, TEMPELKAN PESAN ERROR LENGKAP BESERTA KODE SQLSTATE DI SINI]
[JIKA TIDAK ADA ERROR, TULIS: 'ZERO ERROR ENCOUNTERED']
```

---

## 6. Rekapitulasi Klasifikasi Temuan

Klasifikasikan temuan lapangan ke dalam taksonomi berikut:

### Level 1: BLOCKER (Wajib Diselesaikan Sebelum DDL/Patch)
1. `[DAFTARKAN TEMUAN BLOCKER / TULIS 'NIHIL']`
2. `[ ... ]`

### Level 2: REVIEW REQUIRED (Memerlukan Keputusan Arsitektur Manusia)
1. `[DAFTARKAN TEMUAN PERLU REVIEW / TULIS 'NIHIL']`
2. `[ ... ]`

### Level 3: INFORMATIONAL (Catatan Dokumentasi)
1. `[DAFTARKAN TEMUAN INFORMASIONAL]`
2. `[ ... ]`

---

## 7. Status Gerbang Pra-Perubahan & Persetujuan Manusia

Berdasarkan hasil eksekusi aktual di atas:

- [ ] **Gerbang 1 (Kelengkapan Laporan):** Laporan telah terisi lengkap berdasarkan bukti eksekusi nyata.
- [ ] **Gerbang 2 (Zero Blocker Gate):** Seluruh temuan Level 1 bernilai NIHIL atau telah terselesaikan.
- [ ] **Gerbang 3 (Rekonsiliasi Skema):** Seluruh perbedaan skema dipahami dan disetujui.
- [ ] **Gerbang 4 (Rollback Plan):** Prosedur rollback telah tersedia.
- [ ] **Gerbang 5 (Persetujuan Manusia):** Penanggung jawab teknis memberikan izin lanjut ke tahap mutasi.

### Keputusan Akhir:
**[ ] DIIZINKAN MELANJUTKAN KE TAHAP PERUBAHAN (MUTATION PHASE)**  
**[ ] DITAHAN / DITOLAK (REMEDIATION REQUIRED BEFORE ANY MUTATION)**

**Tanda Tangan & Konfirmasi Operator / DBA:**  
Nama: `[ISI NAMA]`  
Jabatan: `[ISI JABATAN / ROLE]`  
Tanggal: `[YYYY-MM-DD]`  
Tanda Tangan / Konfirmasi: `[TERKONFIRMASI]`
