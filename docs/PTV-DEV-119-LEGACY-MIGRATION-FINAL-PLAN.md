# PTV-DEV-119 — Finalized Legacy Migration Plan & Execution Readiness

**Sesi:** PTV-DEV-119  
**Operator / Developer:** Zidnal (`jidnaal`)  
**AI Agent:** Antigravity (Gemini 3.8 Flash)  
**Lingkungan Target:** Supabase Staging `swadgljnyelsjstqqxbm` (PostgreSQL 17)  
**Production Guardrail:** `jthzuhkblxcaohiuypqq` STRICT READ-ONLY / DILARANG DISENTUH  
**Status Kesiapan:** `READY_FOR_OPERATOR_ACC` (Seluruh rencana difinalisasi, dry-run 100% lulus, 0 mutasi tulis cloud dijalankan).

---

## 1. DELEGASI KEPUTUSAN OPERATOR YANG DIADOPSI

| Parameter | Keputusan yang Ditetapkan | Implikasi Teknis |
| :--- | :--- | :--- |
| **Kantong Rekonstruksi** | `Kas Utama Studio` (tipe: `cash`) | Dibuat sebagai kantong operasional sah untuk menampung seluruh transaksi historis. |
| **4 Record `[BATAL/UNDO]`** | Rp 90.000 tidak boleh menambah saldo bersih | Dicatat sebagai transaksi canonical dengan status `'reversed'` dan memiliki tautan provenance di `ptv_finance_source_references`, **tanpa mutasi saldo kantong** dan **tanpa pengeluaran operasional fiktif**. |
| **Pengeluaran Digital (Rp 35.424)** | Dialokasikan ke `Kas Utama Studio` | Metadata asli (`KAS UANG DIGITAL`) dipertahankan 100% pada `description`. Tidak menyatakan dibayar tunai. Mencegah defisit kantong digital. |
| **Target Saldo Bersih** | **Rp 520.276** | Hasil perhitungan: Rp 1.154.200 (39 pemasukan aktif) - Rp 633.924 (10 pengeluaran). |
| **Total Provenance Mapped** | **53 / 53 record (100% UTUH)** | 43 pemasukan + 10 pengeluaran terpetakan 1:1 di `ptv_finance_source_references`. |

---

## 2. AUDIT KONTRAK CANONICAL & PERLAKUAN 4 TRANSAKSI BATAL

### A. Keterbatasan RPC Harian (`rpc_post_finance_transaction_server`)
- RPC `rpc_post_finance_transaction_server` dirancang khusus untuk pencatatan operasional harian:
  - Meng-hardcode `status = 'posted'`.
  - Selalu memutasi saldo kantong (`incoming`: balance bertambah, `outgoing`: balance berkurang).
  - Tidak memiliki parameter status `'reversed'` dan tidak mendukung voiding tanpa mutasi kas.
- **Konsekuensi Jika Dipaksakan:** Jika ke-4 record batal dimasukkan lewat RPC harian ini, saldo kantong akan membengkak menjadi Rp 610.276, dan untuk menurunkannya ke Rp 520.276 terpaksa harus membuat pengeluaran operasional fiktif Rp 90.000. **Hal ini dilarang keras oleh operator.**

### B. Solusi Bersih yang Sesuai Kontrak Database Canonical
- Skema database canonical pada tabel `ptv_finance_transactions` mendukung status `'reversed'` (`CONSTRAINT check_tx_status CHECK (status IN ('posted', 'reversed'))`).
- Skrip migrasi deterministik [`scripts/migrate-legacy-finance-to-canonical.mjs`](file:///c:/Users/zidna/ptvpro/scripts/migrate-legacy-finance-to-canonical.mjs) membagi eksekusi ke dalam dua perlakuan transparan:
  1. **49 Transaksi Aktif (39 In + 10 Out):**
     - Status: `posted`
     - Alokasi: Masuk/keluar dari kantong `Kas Utama Studio`.
     - Mutasi Saldo: Akumulasi bertahap menghasilkan saldo akhir tepat **Rp 520.276**.
     - Provenance: 49 baris di `ptv_finance_source_references`.
  2. **4 Transaksi Batal (`[BATAL/UNDO]` Rp 90.000):**
     - Status: `reversed`
     - Alokasi Saldo Kantong: **Rp 0 (tidak memutasi saldo kas)**.
     - Provenance: 4 baris di `ptv_finance_source_references`.
     - Audit Trail: Dicatat di `ptv_finance_audit_log` dengan alasan `BATAL/UNDO di teks legacy`.
- **Hasil Akhir:** Provenance 53 record legacy 100% terlacak, tidak ada kartu "Catatan sumber" tertinggal di UI, saldo kas bersih tepat Rp 520.276, dan tidak ada satu pun transaksi fiktif yang dikarang.

---

## 3. SIMULASI KRONOLOGIS & INTEGRITAS SALDO

Eksekusi 49 transaksi aktif diurutkan kronologis (`tanggal ASC`, pemasukan mendahului pengeluaran pada tanggal yang sama):

| Tanggal | Pemasukan Aktif | Pengeluaran | Saldo Akhir Hari | Keterangan |
| :--- | :---: | :---: | :---: | :--- |
| **2026-09-28** | Rp 492.500 | Rp 21.000 | Rp 471.500 | Sisa Kas (Rp 292.500) + 9 Kas Kru aktif, Beli Galon |
| **2026-10-02** | Rp 280.000 | Rp 200.000 | Rp 551.500 | 12 Kas Kru aktif, Paylater Roller Blind |
| **2026-10-07** | Rp 0 | Rp 135.000 | Rp 416.500 | Gabus/Tape (Rp 35.000) & Domain PTV (Rp 100.000) |
| **2026-10-08** | Rp 0 | Rp 22.000 | Rp 394.500 | Galon Cleo |
| **2026-10-12** | Rp 381.700 | Rp 0 | Rp 776.200 | 18 Kas Kru aktif + Uang Receh Ghaib (Rp 1.700) |
| **2026-10-16** | Rp 0 | Rp 227.924 | Rp 548.276 | MPJ Digital, Es Teh, Kresek, Tinta Printer |
| **2026-10-19** | Rp 0 | Rp 28.000 | **Rp 520.276** | Konsumsi Kru Liputan |

- **Saldo Terendah:** Rp 0 (pada awal mula).
- **Saldo Defisit / Negatif:** **TIDAK PERNAH TERJADI (0% overdraft)**.
- **Saldo Akhir Bersih:** **Tepat Rp 520.276** (52.027.600 minor).

---

## 4. ISOLASI DATA PENGUJIAN DUMMY PTV-DEV-117

- 5 transaksi pengujian PTV-DEV-117 beralokasi ke 2 kantong dummy:
  - `[TEST][PTV-DEV-117] Kas Uji Alpha` (ID: `94f454b2...`, saldo 0, `archived = true`)
  - `[TEST][PTV-DEV-117] Bank Uji Beta` (ID: `4dd78d1f...`, saldo 0, `archived = true`)
- Transaksi migrasi legacy hanya beralokasi ke kantong operasional sah `Kas Utama Studio`.
- Pada UI dan laporan keuangan, kantong berstatus `archived` disembunyikan dari transaksi aktif, sehingga data uji tidak mencemari angka operasional.

---

## 5. SKRIP MIGRASI DETERMINISTIK & IDEMPOTEN

Skrip migrasi telah dibuat dan teruji di [`scripts/migrate-legacy-finance-to-canonical.mjs`](file:///c:/Users/zidna/ptvpro/scripts/migrate-legacy-finance-to-canonical.mjs).

### Fitur Keamanan Skrip:
1. **Preflight Otomatis:** Memvalidasi target Staging `swadgljnyelsjstqqxbm`, memblokir Production, memverifikasi akun pengelola, memverifikasi 11 kategori, dan mengecek keutuhan 53 data legacy.
2. **Checkpoint & Resume Aman:** Membaca `ptv_finance_source_references` sebelum eksekusi. Record yang sudah termigrasi akan di-skip tanpa duplikasi alokasi.
3. **Guardrail Pencegah Eksekusi Otomatis:** Skrip berjalan dalam mode `--dry-run` secara default. Mode `--execute` wajib disertai environment variable `CONFIRM_MIGRATION_EXECUTE=swadgljnyelsjstqqxbm`.
4. **Postflight Verifikasi:** Memvalidasi saldo akhir tepat Rp 520.276 dan menghasilkan manifest JSON di [`docs/PTV-DEV-119-MIGRATION-EXECUTION-PLAN.json`](file:///c:/Users/zidna/ptvpro/docs/PTV-DEV-119-MIGRATION-EXECUTION-PLAN.json).

---

## 6. HASIL QUALITY GATES (PTV-DEV-119)

- **Simulasi Dry-Run Migrasi:** **PASS 100%** (49 posted, 4 reversed, 0 error, saldo Rp 520.276).
- **Unit & Integration Test Suite (`npm test`):** **86 test files passed, 944 tests passed (100%)**.
- **TypeScript Typecheck (`npm run typecheck`):** **0 errors** (`tsc --noEmit`).
- **ESLint (`npm run lint`):** **0 warnings, 0 errors** (`eslint . --max-warnings 0`).
- **Kompilasi Build Produksi Vite (`npm run build`):** **Sukses** (18.56s).

---

## 7. INSTRUKSI MINIMUM MEMINTA ACC OPERATOR

Seluruh persiapan, audit, pemetaan, mitigasi pembatalan, dan skrip deterministik telah **100% SIAP**.  
Tidak ada mutasi tulis yang dijalankan pada sesi ini.

Untuk mengeksekusi migrasi riil ke database Supabase Staging pada sesi berikutnya, operator cukup memberikan konfirmasi:

> **"ACC PTV-DEV-120: Setujui eksekusi migrasi 53 record legacy ke Supabase Staging dengan pembentukan Kantong Kas Utama Studio, 49 transaksi posted, 4 transaksi reversed, dan saldo akhir Rp 520.276."**
