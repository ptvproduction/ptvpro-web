# PTV-DEV-206 — DOKUMENTASI RENCANA INTEGRASI DATABASE CLOUD (DRAFT ONLY)

Dokumen resmi panduan persiapan migrasi skema PostgreSQL dan Supabase untuk modul **Haul & Harlah Workspace** pada fase finalisasi cloud mendatang.

> [!CAUTION]
> **STATUS: DRAFT ONLY (TIDAK DIEKSEKUSI PADA SESI INI)**  
> Sesuai instruksi dan batas aman engineering DEV-206:
> 1. Dilarang menjalankan skrip SQL terhadap database staging maupun production.
> 2. Dilarang mengubah konfigurasi Supabase proyek `swadgljnyelsjstqqxbm`.
> 3. Modul Haul & Harlah di PTV Hub beroperasi dengan `ProductionDraftRepository` yang terisolasi in-memory secara aman tanpa klaim persistensi cloud palsu.

---

## 1. Rujukan Berkas Migrasi Draft
- **Berkas Draft SQL:** [`docs/haul-workspace/migration.draft.sql`](file:///c:/Users/zidna/ptvpro/docs/haul-workspace/migration.draft.sql)
- **Karakteristik Skrip:** Dimulai dengan `BEGIN;` dan diakhiri dengan `ROLLBACK;` untuk mencegah eksekusi ceroboh tanpa review lokal DBA.

---

## 2. Struktur Skema `ptv_haul`

Skema relasional mencakup entitas operasional berikut:

```
ptv_haul
├── edition             (Edisi tahunan, rentang tanggal, konfigurasi)
├── event               (Rangkaian acara, lokasi, waktu mulai-selesai)
├── project             (Kelompok garapan/project, PIC, status)
├── project_event       (Junction relasi M-to-N project dan acara)
├── task                (Pekerjaan, hierarki subtugas, PIC, anggota, dependency)
├── session             (Rundown liputan acara, posisi kebutuhan, kru)
├── content             (Konten publikasi media sosial, platform, jadwal tayang)
├── note                (Catatan koordinasi, pin informasi penting)
├── audit_log           (Audit trail riwayat perubahan data operasional)
└── personal_view       (Preferensi filter dan sorting tersimpan per-aktor)
```

---

## 3. Matriks Hak Akses & Kebijakan RLS (Row Level Security)

Skema `ptv_haul` terikat langsung pada capability native PTV Hub:

| Entitas | Operasi | Capability Dibutuhkan | Kondisi Row Level Security |
| :--- | :--- | :--- | :--- |
| **Semua Tabel** | `SELECT` | `projecthaul.view` | Pengguna aktif terautentikasi dengan izin view |
| **Edition / Event** | `INSERT`, `UPDATE`, `DELETE` | `projecthaul.manage` | Hanya koordinator / eksekutif |
| **Project** | `INSERT`, `UPDATE`, `DELETE` | `projecthaul.manage` | Hanya koordinator / eksekutif |
| **Task** | `INSERT`, `DELETE` | `projecthaul.manage` | Hanya koordinator / eksekutif |
| **Task** | `UPDATE` (Koordinator) | `projecthaul.manage` | Semua field dapat diubah |
| **Task** | `UPDATE` (Kru Bertugas) | `projecthaul.view` | Hanya boleh mengubah `status`, `result_url`, dan mengajukan `approval = 'Menunggu'` jika `auth.uid() = pic_id` atau terdaftar dalam `member_ids` |
| **Session (Rundown)** | `INSERT`, `UPDATE`, `DELETE` | `projecthaul.manage` | Hanya koordinator (wajib lolos validasi anti-bentrok) |
| **Content** | `INSERT`, `UPDATE`, `DELETE` | `projecthaul.manage` | Koordinator; kru hanya status progres |
| **Personal View** | `ALL` | `projecthaul.view` | Terisolasi per akun (`user_id = auth.uid()`) |

---

## 4. Invariant Bisnis & Validasi Concurrency

1. **Anti-Cycle Dependency:**
   Subtugas (`parent_id`) dan dependensi (`dependency_ids`) tidak boleh membentuk siklus rekursif tertutup. Diperiksa melalui recursive CTE pada level database atau trigger validasi.
2. **Dependency Completion Gate:**
   Task dengan status `Selesai` tidak dapat disimpan jika dependensi sebelumnya belum berstatus `Selesai`.
3. **Pendeteksian Bentrok Sesi Kru (Overlapping Session Conflict):**
   Dua sesi rundown pada edisi yang sama dengan personel bertugas yang sama dilarang memiliki interval waktu tumpang tindih (`a.starts_at < b.ends_at AND b.starts_at < a.ends_at`).
4. **Optimistic Locking via Revision Counter:**
   Setiap update baris wajib memeriksa `revision = expected_revision` guna menghindari *blind overwrite* antarpengguna saat koordinasi lapangan.
5. **Pemisahan Lintas Edisi:**
   Seluruh relasi foreign key terikat ke `(edition_id, id)` untuk menjamin integritas data antar-edisi tahunan tidak saling mencemari.

---

## 5. Prosedur Aktivasi Staging (Checklist Fase Berikutnya)

Ketika koordinator memutuskan mengaktifkan integrasi database nyata:
- [ ] Review berkas `docs/haul-workspace/migration.draft.sql` oleh DBA / tim backend.
- [ ] Buat file migrasi Supabase resmi di `supabase/migrations/<timestamp>_ptv_haul_workspace.sql`.
- [ ] Hapus blok pelindung `BEGIN; ... ROLLBACK;` dan ganti dengan transaksi migrasi final.
- [ ] Jalankan pengujian migrasi pada local database cluster terlebih dahulu.
- [ ] Jalankan migrasi ke proyek Supabase staging `swadgljnyelsjstqqxbm`.
- [ ] Buat `SupabaseWorkspaceRepository` pada `src/products/hub/haul-workspace/adapter.ts` yang memanggil Supabase client native.
- [ ] Lakukan verifikasi integrasi baca dan tulis data aktual pada staging.
