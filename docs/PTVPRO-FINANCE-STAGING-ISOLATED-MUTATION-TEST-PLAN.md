# PTVPRO — RENCANA UJI MUTASI CLOUD TERISOLASI FINANCE 2.0 (STAGING)

Dokumen ini memuat rencana pengujian fungsional mutasi live pada Supabase Staging (`swadgljnyelsjstqqxbm`) dengan prinsip isolasi ketat, data dummy terstandarisasi, dan prosedur pembersihan terverifikasi.

> [!IMPORTANT]
> **STATUS: DRAFT TERKUNCI (MENUNGGU ACC EKSPLISIT OPERATOR).**
> Pengujian mutasi cloud live belum dieksekusi ke database Staging. Sesuai guardrails PTV-DEV-116, penulisan data ke cloud dilarang tanpa ACC operator terpisah.

---

## 1. Identifikasi Lingkungan & Isolasi Mutasi
- **Target Project:** Supabase Staging `swadgljnyelsjstqqxbm` (us-east-1).
- **Production Barrier:** Database Production `jthzuhkblxcaohiuypqq` STRICT READ-ONLY. Dilarang disentuh.
- **Legacy Barrier:** 53 baris data legacy (43 `ptv_pemasukan`, 10 `ptv_pengeluaran`) TIDAK BOLEH DIMUTASI, DIHAPUS, ATAU DIGABUNGKAN.
- **Scope Objek Uji:** Hanya tabel canonical `ptv_finance_pockets`, `ptv_finance_transactions`, `ptv_finance_allocations`, dan `ptv_finance_audit_log`.

---

## 2. Rencana Skenario Pengujian Mutasi Live (End-to-End)

### Langkah 1: Pembuatan 2 Kantong Dummy
- **Kantong 1 (Cash):**
  - Nama: `[TEST] Kas Uji Terisolasi Alpha`
  - Jenis: `cash` (tanpa nomor rekening)
  - Saldo Awal: `0`
- **Kantong 2 (Bank):**
  - Nama: `[TEST] Bank Uji Terisolasi Beta`
  - Jenis: `bank`
  - Provider: `Bank Uji Staging`
  - Nomor Rekening: `999900001111`
  - Atas Nama: `Studio Test Staging`
  - Saldo Awal: `0`
- **Ekspektasi:** 2 baris terbentuk di `ptv_finance_pockets` dengan `balance_minor = 0`, `archived = false`, `version = 1`. 2 rekaman audit `create` terbentuk di `ptv_finance_audit_log`.

### Langkah 2: Transaksi Pemasukan (Income)
- **Operasi:** `income`
- **Nominal:** Rp 200.000 (`amountMinor = '20000000'`)
- **Kategori:** Kategori seed aktif (misal `Sewa Studio & Alat`)
- **Alokasi:** Rp 200.000 masuk ke Kantong Alpha.
- **Ekspektasi:** Transaksi tercatat di `ptv_finance_transactions` (`status = 'posted'`), alokasi tercatat di `ptv_finance_allocations`, saldo Kantong Alpha menjadi Rp 200.000 (`balance_minor = 20000000`, `version = 2`).

### Langkah 3: Transfer Internal Antarkantong
- **Operasi:** `transfer`
- **Nominal:** Rp 100.000 (`amountMinor = '10000000'`)
- **Kategori:** `null` (transfer internal tidak memiliki kategori)
- **Alokasi Asal:** Rp 100.000 keluar dari Kantong Alpha.
- **Alokasi Tujuan:** Rp 100.000 masuk ke Kantong Beta.
- **Ekspektasi:** Saldo Kantong Alpha menjadi Rp 100.000, saldo Kantong Beta menjadi Rp 100.000. Total kekayaan bersih organisasi tidak berubah (net 0).

### Langkah 4: Pengujian Anti-Saldo Negatif (Uji Negatif)
- **Operasi:** `expense`
- **Nominal:** Rp 500.000 (`amountMinor = '50000000'`) dari Kantong Beta (saldo hanya Rp 100.000).
- **Ekspektasi:** Transaksi DITOLAK oleh RPC dengan kode error `22023` / saldo tidak mencukupi. Saldo Kantong Beta tetap Rp 100.000 (auto-rollback).

### Langkah 5: Pengeluaran Penyeimbang (Draining ke Nol)
- **Operasi:** `expense`
- **Nominal 1:** Rp 100.000 dari Kantong Alpha (saldo Alpha kembali menjadi 0).
- **Nominal 2:** Rp 100.000 dari Kantong Beta (saldo Beta kembali menjadi 0).
- **Ekspektasi:** Saldo kedua kantong dummy kembali tepat Rp 0 (`balance_minor = 0`).

### Langkah 6: Pengarsipan Kantong Dummy
- **Aksi:** `archive_pocket` untuk Kantong Alpha dan Kantong Beta.
- **Ekspektasi:** `archived = true`, status Kantong di UI beralih ke "Diarsipkan".

---

## 3. Rencana Cleanup Terverifikasi (Penghapusan Data Uji)
Karena trigger `trg_prevent_audit_tampering` mencegah `DELETE` pada `ptv_finance_audit_log`, penghapusan baris uji dummy dilakukan melalui skrip terisolasi oleh superuser `postgres` di Supabase SQL Editor:
```sql
-- SKRIP CLEANUP DATA UJI TERISOLASI FINANCE 2.0 (STAGING ONLY)
BEGIN;
-- Hapus alokasi transaksi dummy
DELETE FROM public.ptv_finance_allocations 
 WHERE pocket_id IN (SELECT id FROM public.ptv_finance_pockets WHERE name LIKE '[TEST]%');

-- Hapus transaksi dummy
DELETE FROM public.ptv_finance_transactions 
 WHERE description LIKE '%[TEST]%' OR description LIKE '%Uji Terisolasi%';

-- Hapus kantong dummy
DELETE FROM public.ptv_finance_pockets 
 WHERE name LIKE '[TEST]%';

-- Hapus audit log transaksi dummy
ALTER TABLE public.ptv_finance_audit_log DISABLE TRIGGER trg_prevent_audit_tampering;
DELETE FROM public.ptv_finance_audit_log 
 WHERE payload::text LIKE '%[TEST]%' OR payload::text LIKE '%Uji Terisolasi%';
ALTER TABLE public.ptv_finance_audit_log ENABLE TRIGGER trg_prevent_audit_tampering;

COMMIT;
```

---

## 4. Tindakan Minimum yang Diperlukan dari Operator
Jika operator menyetujui pengujian mutasi cloud ini:
- Berikan instruksi persetujuan ACC: *"ACC Eksekusi Uji Mutasi Cloud Terisolasi Staging"*.
- Antigravity akan menjalankan langkah uji 1 s.d. 6 secara berurutan, memverifikasi konsistensi saldo dan audit log di database nyata, lalu membersihkannya kembali sesuai prosedur cleanup di atas.
