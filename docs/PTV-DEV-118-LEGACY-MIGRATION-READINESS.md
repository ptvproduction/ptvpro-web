# PTV-DEV-118 — Legacy Reconciliation & Migration Readiness Report

**Sesi:** PTV-DEV-118  
**Operator / Developer:** Zidnal (`jidnaal`)  
**AI Agent:** Antigravity (Gemini 3.8 Flash)  
**Lingkungan Target:** Supabase Staging `swadgljnyelsjstqqxbm` (PostgreSQL 17)  
**Production Guardrail:** `jthzuhkblxcaohiuypqq` STRICT READ-ONLY / DILARANG DISENTUH  
**Status Kesiapan:** `READY_WITH_DECISIONS` (Audit, mapping, dan simulasi dry-run 100% lulus; menunggu ACC & 3 keputusan operator terpusat sebelum eksekusi tulis).

---

## 1. RINGKASAN EKSEKUTIF & METRIK REKONSILIASI

| Parameter | Legacy Sumber | Simulasi Canonical (Gross) | Simulasi Canonical (Net Rekomendasi) |
| :--- | :--- | :--- | :--- |
| **Total Record** | 53 record | 53 transaksi posted | 53 transaksi (49 aktif + 4 reversal) |
| **Pemasukan** | 43 record (Rp 1.244.200) | 43 record (Rp 1.244.200) | 43 record (Rp 1.154.200 net) |
| **Pengeluaran** | 10 record (Rp 633.924) | 10 record (Rp 633.924) | 10 record (Rp 633.924) |
| **Selisih Aritmetis** | Rp 610.276 | Rp 610.276 | Rp 520.276 |
| **Status Saldo Negatif** | N/A (Tanpa constraint) | Terbukti Rp 0 (Aman) | Terbukti Rp 0 (Aman) |
| **Status Cloud Tulis** | Read-Only (0 mutasi) | 0 mutasi tulis dijalankan | 0 mutasi tulis dijalankan |

---

## 2. AUDIT DATA LEGACY SECARA READ-ONLY (BUKTI EMPIRIS)

### A. Tabel `ptv_pemasukan` (43 Baris — Total Rp 1.244.200)
- **Sumber Dana:**
  1. `Kas Kru`: 41 transaksi (total Rp 950.000). Semua berformat keterangan: `Iuran Kas Kru — <Nama Kru> — <Bulan> — <Nominal>`.
  2. `SISA UANG KAS`: 1 transaksi (Rp 292.500 pada `2026-09-28`). Keterangan kosong.
  3. `Uang Receh Ghaib`: 1 transaksi (Rp 1.700 pada `2026-10-12`). Keterangan: `Hasil sisa sisa dijadiin satu`.
- **Temuan Anomali `[BATAL/UNDO]` (4 Record — Total Rp 90.000):**
  Di sistem legacy lama, ketika transaksi dibatalkan, sistem **hanya menambahkan teks** ` | [BATAL/UNDO] oleh <nama> pada <timestamp>` ke dalam kolom `keterangan`. Baris tersebut tidak dihapus dan tidak dibuatkan transaksi pengurang.
  1. `093acc53-2ed8-4eb3-9b6d-ccc0719700cc` (`2026-09-28`, Rp 25.000): *Aqil Afzal Al Farisi — Juli 2026*
  2. `5e23c352-08b8-49d1-87b7-3b24fe117955` (`2026-09-28`, Rp 25.000): *Muhammad Izzur Fauzil Adhim — September 2026*
  3. `c06aa984-848e-462c-ba8e-cac8d46854e3` (`2026-10-02`, Rp 20.000): *Iyyaka Fahabil Farhan — September 2026*
  4. `ef35a758-ab66-41db-a42f-cd99f97ccd8e` (`2026-10-02`, Rp 20.000): *Nasshar Rasikh Arsyadiano — Oktober 2026*

### B. Tabel `ptv_pengeluaran` (10 Baris — Total Rp 633.924)
- Seluruh 10 pengeluaran diaudit apa adanya:
  1. `b0435461-dc04-42af-bc18-2233cc4d2ba1` (`2026-09-28`, Rp 21.000): `BELI GALON`
  2. `8db72353-90ae-4cf2-a15b-54dea21b5877` (`2026-10-02`, Rp 200.000): `PAYLATER ROLLER BLIND`
  3. `85fbb09f-bfe7-4dfa-904a-18fa32940482` (`2026-10-07`, Rp 35.000): `PEMBELIAN GABUS DAN MAGIC TAPE`
  4. `b9ef1b0d-e118-4dbc-917e-5756e6a90e87` (`2026-10-07`, Rp 100.000): `DOMAIN PTVPRO.COM` (Ket: `SUBSIDI SEBESAR RP 100000 DARI KAS`)
  5. `5517077f-9cf6-43a6-9609-020f1787df1b` (`2026-10-08`, Rp 22.000): `GALON CLEO`
  6. `0b27dc31-d694-419c-a6d3-f649b183ae7f` (`2026-10-16`, Rp 35.424): `BIAYA REGISTRASI AKUN MPJ` (Ket: `KAS UANG DIGITAL`)
  7. `9e14cb19-ddc0-4341-a462-e373937c5f8a` (`2026-10-16`, Rp 30.000): `KONSUMSI EVENT` (Ket: `ES TEH 10`)
  8. `bcc00994-902a-4198-a0f6-ed9525bb5933` (`2026-10-16`, Rp 62.500): `BELI KRESEK SAMPAH`
  9. `be83381c-5bc0-4ce5-b139-edeacb7a1aee` (`2026-10-16`, Rp 100.000): `BELI TINTA WARNA HITAM PRINTER`
  10. `ac23e115-708b-4d12-9eb5-bec20264bbfb` (`2026-10-19`, Rp 28.000): `KONSUMSI CREW` (Ket: `Konsumsi kru liputan lapangan`)

---

## 3. IDENTIFIKASI KANTONG & ANALISIS SALDO NEGATIF

### Kondisi Cloud Staging Aktual
- Hanya ada 2 kantong di database staging: `[TEST][PTV-DEV-117] Kas Uji Alpha` dan `Bank Uji Beta`.
- Keduanya berstatus **diarsipkan** (`archived = true`, `balance_minor = 0`) dan khusus dummy isolasi.
- **Belum ada kantong operasional aktif.**

### Simulasi Skenario Kantong
1. **Skenario Kas Terpadu (Recommended):**
   - Seluruh transaksi historis dialokasikan ke satu Kantong Kas Operasional Sah (`Kas Utama Studio`).
   - Hasil simulasi kronologis per tanggal:
     - 2026-09-28: In Rp 542.500, Out Rp 21.000 -> Saldo: Rp 521.500
     - 2026-10-02: In Rp 320.000, Out Rp 200.000 -> Saldo: Rp 641.500
     - 2026-10-07: In Rp 0, Out Rp 135.000 -> Saldo: Rp 506.500
     - 2026-10-08: In Rp 0, Out Rp 22.000 -> Saldo: Rp 484.500
     - 2026-10-12: In Rp 381.700, Out Rp 0 -> Saldo: Rp 866.200
     - 2026-10-16: In Rp 0, Out Rp 227.924 -> Saldo: Rp 638.276
     - 2026-10-19: In Rp 0, Out Rp 28.000 -> Saldo: Rp 610.276
   - **Evaluasi:** Saldo terendah adalah Rp 0 (tidak pernah negatif). AMAN 100%.

2. **Skenario Pemisahan Kas Digital Otomatis:**
   - Transaksi pengeluaran `BIAYA REGISTRASI AKUN MPJ` (Rp 35.424) dialokasikan ke kantong Kas Digital karena ada teks `KAS UANG DIGITAL`.
   - Di tabel pemasukan, TIDAK ADA catatan pemasukan ke kas digital.
   - Hasil: Saldo Kas Digital menjadi **-Rp 35.424**.
   - **Evaluasi:** **BLOCKER KERAS**. Database canonical menolak saldo negatif (`balance_minor >= 0`).

---

## 4. PEMETAAN KATEGORI CANONICAL (11 SEED RESMI)

| Tipe | Nama Kategori Canonical | ID Kategori Canonical | Jumlah Record Dipetakan |
| :--- | :--- | :--- | :--- |
| **Income** | `Iuran Kru` | `e6852c70-5f57-436b-84e1-fc85752ad4dc` | 41 record (Kas Kru) |
| **Income** | `Kas Masuk / Operasional` | `eeb57bb5-0d84-4b71-a6ea-76f74d8ec256` | 2 record (Sisa Kas & Receh) |
| **Expense** | `Konsumsi & Logistik` | `064b9558-8d37-48ad-b179-19bc23f67b0b` | 4 record (Galon, Es Teh, Kru) |
| **Expense** | `Operasional Studio` | `275a7d0b-cdcd-4b53-b995-e005e2324898` | 4 record (Blind, Domain, MPJ, Kresek) |
| **Expense** | `Peralatan & Perlengkapan` | `e43a15cf-c9d5-4d61-950b-b7e75b568ec1` | 2 record (Gabus/Tape, Tinta) |

---

## 5. DESAIN IDEMPOTENSI, PROVENANCE, DAN ANTI-DUPLIKASI

1. **Idempotency Key Deterministik:**
   - Dibuat dari hash stabil SHA-256 berbasis UUIDv5 format: `UUIDv5(namespace, "legacy:" + table + ":" + id)`.
   - Menjamin bahwa jika migrasi dijalankan ulang, PostgreSQL `unique_ptv_finance_transactions_idempotency_key` akan menolak insert duplikat atau menjalankan replay idempoten.
2. **Provenance Traceability (`ptv_finance_source_references`):**
   - Setiap transaksi canonical mencatat 1 baris di tabel ini:
     `source_table`: `'ptv_pemasukan'` atau `'ptv_pengeluaran'`
     `source_id`: UUID asli dari tabel legacy
   - Constraint `unique_source_record_mapping` (`UNIQUE (source_table, source_id)`) menjamin 1 record legacy tidak akan pernah bisa dimigrasikan lebih dari 1 kali.
3. **Audit Reference Eksplisit:**
   - Kolom `audit_reference` diisi dengan format: `MIGRATION-LEGACY-<source_table>-<source_id>`.

---

## 6. ISOLASI TRANSAKSI DUMMY PTV-DEV-117

- Transaksi dummy PTV-DEV-117 (5 transaksi) mengarah ke 2 kantong dummy Alpha dan Beta yang saat ini telah diarsipkan (`archived = true`, `balance_minor = 0`).
- Transaksi dummy tidak memiliki baris di `ptv_finance_source_references`.
- Transaksi migrasi legacy akan mengarah ke Kantong Operasional Sah yang baru, sehingga tidak bercampur secara saldo maupun alokasi dengan kantong uji.

---

## 7. AUDIT DAN KESIAPAN TAMPILAN UI FINANCE 2.0

- Kode `FinanceWorkspace.tsx` dan `api/finance.ts` telah diperiksa dan disempurnakan secara non-destruktif:
  - Normalisasi prefix `ptv_` pada `sourceReferences` telah diterapkan di backend `api/finance.ts` dan frontend `FinanceWorkspace.tsx`.
  - Ketika transaksi legacy dimigrasikan ke `ptv_finance_transactions` dengan referensi `sourceReferences`, UI secara otomatis **menyembunyikan kartu legacy** (`Catatan sumber`) dan menampilkan seluruh transaksi langsung di dalam daftar utama transaksi canonical (`Finance 2.0`).
  - Tidak ada duplikasi tampilan dan penanda historis tetap dapat dilihat melalui rincian transaksi.

---

## 8. MANIFEST & HASIL DRY-RUN SIMULASI

- **Manifest JSON:** Tersimpan di [`docs/PTV-DEV-118-RECONCILIATION-MANIFEST.json`](file:///c:/Users/zidna/ptvpro/docs/PTV-DEV-118-RECONCILIATION-MANIFEST.json).
- **Hasil Eksekusi Dry-Run:**
  - Validasi individual: 53/53 record valid.
  - Idempotency keys unik: 53/53.
  - Source references unik: 53/53.
  - Kategori cloud cocok: 11/11 aktif.
  - Saldo minimum historis: Rp 0 (TIDAK ADA SALDO NEGATIF).
  - Status Kelulusan: **PASS 100%**.

---

## 9. TIGA KEPUTUSAN OPERATOR YANG DIPERLUKAN (SEBELUM ACC EKSEKUSI)

Untuk mengeksekusi migrasi tulis ke Supabase Staging pada tahap berikutnya, operator cukup memutuskan 3 butir berikut:

### DEC-01: Penyediaan Kantong Operasional Sah
- **Opsi A (Recommended):** Buat satu kantong baru bernama `Kas Utama Studio` (tipe: `cash`) sebagai penampung seluruh 53 transaksi historis.
- **Opsi B:** Tentukan nama kantong lain atau gunakan kantong rekening bank tertentu.

### DEC-02: Kebijakan Penanganan 4 Record `[BATAL/UNDO]` (Rp 90.000)
- **Opsi A (Recommended - Audit Trail Sempurna):** Migrasikan ke-4 record sebagai transaksi posted, lalu sertakan 4 transaksi penyeimbang/pembalik (reversal) sehingga jejak mutasi historis utuh dan saldo akhir kas riil adalah **Rp 520.276**.
- **Opsi B (Strict Net):** Abaikan ke-4 record batal dari migrasi ke canonical, sehingga hanya 49 record aktif yang dimigrasikan (saldo Rp 520.276).
- **Opsi C (As-Is Gross):** Migrasikan ke-4 record sebagai pemasukan normal tanpa pembalik, sehingga saldo akhir buku gross tetap **Rp 610.276**.

### DEC-03: Penanganan 1 Pengeluaran `KAS UANG DIGITAL` (Rp 35.424)
- **Opsi A (Recommended):** Dialokasikan ke `Kas Utama Studio` dengan keterangan digital tetap dipertahankan pada kolom description, untuk mencegah defisit saldo kantong digital.
- **Opsi B:** Buat kantong terpisah `Kas Digital` dan buat transaksi transfer dana dari Kas Utama ke Kas Digital sebelum tanggal 2026-10-16.

---

## 10. REKOMENDASI TAHAP BERIKUTNYA

Status saat ini: **READY_WITH_DECISIONS**.  
Seluruh audit, manifest pemetaan, skrip validasi, dan pengujian lokal telah siap.  
**Menunggu ACC dan arahan keputusan operator sebelum menjalankan operasi tulis ke database Staging.**
