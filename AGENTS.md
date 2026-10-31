# PTVPRO / PTV HUB — ATURAN OPERASIONAL AI AGENTS (AGENTS.MD)

Dokumen ini adalah pedoman operasional wajib bagi setiap sesi Antigravity atau AI coding assistant di repositori `ptvpro`.

---

## 1. ATURAN KERJA UTAMA & WORKFLOW ANTARSESI

1. **Mulai Sesi dari Roadmap:** Pada awal setiap sesi baru, baca [`roadmap.md`](file:///c:/Users/zidna/ptvpro/roadmap.md) pada root repository terlebih dahulu untuk memahami status aktif, fokus pekerjaan, dan batas proyek.
2. **Pencarian Terarah (Search-First):** Gunakan peta codebase di [`roadmap.md`](file:///c:/Users/zidna/ptvpro/roadmap.md#3-peta-codebase) untuk memilih file yang relevan. Dilarang melakukan audit atau membaca seluruh repositori secara *default*.
3. **Verifikasi Kode Nyata:** Roadmap adalah peta panduan; kode aktual tetap harus diperiksa secara terarah pada file spesifik sebelum melakukan modifikasi.
4. **Rekonsiliasi Selisih:** Jika terdapat perbedaan antara dokumentasi dan kode aktual, verifikasi kode riil, laporkan selisihnya, dan perbarui [`roadmap.md`](file:///c:/Users/zidna/ptvpro/roadmap.md). Jangan mengikuti dokumentasi lama secara membabi buta.
5. **Kepatuhan Desain R03 & Override Pengguna:**
   * Sebelum mengubah antarmuka (UI), baca panduan R03 di [`design_guide/MASTER-PROMPT-R03.md`](file:///c:/Users/zidna/ptvpro/design_guide/MASTER-PROMPT-R03.md) dan [`design_guide/PTV-Hub-Guide-R03.md`](file:///c:/Users/zidna/ptvpro/design_guide/PTV-Hub-Guide-R03.md).
   * **Dilarang Mendesain Ulang Spontan:** Keputusan visual yang telah disetujui pengguna (misalnya: bentuk sudut circular rounded pada Inventaris, pill filter bar, pill tombol `+ Alat`, dan label bottom bar mobile Bahasa Indonesia) **wajib dipertahankan**.
6. **Perbarui Roadmap Setelah Perubahan:** Setiap kali menyelesaikan perubahan kode atau keputusan teknis baru, segera perbarui bagian terkait pada [`roadmap.md`](file:///c:/Users/zidna/ptvpro/roadmap.md) pada sesi yang sama.
7. **Bukti Validasi yang Jujur:** Bedakan secara tegas antara status:
   * *Terimplementasi (UI saja)*
   * *Teruji lokal (mock in-memory / unit test)*
   * *Teruji integrasi (staging cloud)*
   * *Belum diverifikasi / Ditunda*  
   Dilarang menandai pekerjaan selesai tanpa bukti pengujian konkret. Penambahan data ke array lokal atau preview base64 foto bukan bukti persistensi backend!
8. **Bahasa Komunikasi:** Gunakan Bahasa Indonesia yang lugas, profesional, dan terstruktur untuk semua komunikasi, respons, dan laporan serah terima.
9. **Kerahasiaan Data (No Secrets):** Dilarang keras menuliskan credential, token rahasia, JWT, password, PIN, isi `.env`, atau data pribadi pengguna ke dalam file dokumentasi, log, atau screenshot.
10. **Instruksi Pengguna Tertinggi:** Arahan eksplisit terbaru dari pengguna membatalkan asumsi lama. Rekam lingkup instruksi tersebut secara jelas agar perubahan tidak melebar ke modul lain.
11. **Dilarang Mengklaim Palsu:** Jangan mengklaim pengujian, paritas, atau perbaikan bug yang tidak benar-benar dijalankan dan dibuktikan.
12. **Disiplin Runtime, Port, dan Isolasi Backend:**
    * **Port 5174 adalah Runtime Utama Verifikasi Staging:** Dijalankan dengan perintah `npm run dev -- --mode staging` yang memuat `.env.staging` dan terhubung langsung ke proyek Supabase staging `swadgljnyelsjstqqxbm`.
    * **Port 5173 Riwayat Development Mock:** Port 5173 sebelumnya digunakan untuk development mock lokal (`npm run dev` tanpa parameter mode) yang beroperasi pada `localStorage` browser.
    * **Port Bukan Penentu Database:** Nomor port jaringan hanyalah penanda listen HTTP; penentu backend sesungguhnya adalah `MODE`, file environment yang dimuat, serta variabel `VITE_AUTH_BACKEND` dan `VITE_INVENTARIS_BACKEND`.
    * **Verifikasi Runtime Wajib:** Agen wajib memverifikasi runtime efektif dan Supabase project ref pada setiap sesi sebelum melakukan uji coba.
    * **Dilarang Menyamakan Mock dengan Cloud:** Jangan pernah menganggap keberhasilan pengujian mock lokal sebagai bukti keberhasilan integrasi Supabase cloud. Bukti cloud wajib diverifikasi langsung terhadap database PostgreSQL staging.

---

## 2. ATURAN HOUSEKEEPING & KEBERSIHAN REPOSITORI

1. **Satu Lokasi File Sementara:** Gunakan direktori sementara yang terisolasi di luar root proyek atau di subdirektori artefak sementara (misal `.gemini/scratch/`) untuk skrip ad-hoc atau log sementara.
2. **Jangan Buat Folder Cache / Screenshot Berulang:** Jangan membuat folder baru untuk setiap eksperimen.
3. **Lindungi Baseline Visual:** Jangan menimpa tangkapan layar baseline visual yang telah disetujui pengguna. Gunakan penamaan stabil yang membedakan baseline dan hasil uji.
4. **Hindari Duplikasi:** Dilarang menyimpan arsip ZIP, salinan folder repositori, profil browser, atau salinan penuh transkrip AI di dalam repositori.
5. **Gunakan Cache yang Ada:** Jangan menghapus cache dependencies (`node_modules`) sembarangan karena akan memicu pengunduhan ulang yang boros bandwidth dan waktu.
6. **Kebijakan Pembersihan:**
   * Dilarang menjalankan perintah destruktif seperti `git clean -fdx` atau `git reset --hard` secara ceroboh.
   * Dilarang menghapus berkas legacy rujukan migrasi (`legacy/`), panduan desain (`design_guide/`), konfigurasi, kredensial, atau perubahan working tree pengguna yang belum di-commit.
   * Hanya hapus artefak hasil *generate* sementara yang dipastikan aman dan dapat dibuat ulang dengan mudah.

---

## 3. PERINTAH VERIFIKASI RESMI

| Kebutuhan | Perintah |
| :--- | :--- |
| **Pengecekan Tipe** | `npm run typecheck` (`tsc --noEmit`) |
| **Pengujian Unit** | `npm test` (`vitest run`) |
| **Linting** | `npm run lint` (`eslint . --max-warnings 0`) |
| **Kompilasi Build** | `npm run build` (`tsc && vite build`) |
| **Server Lokal** | `npm run dev` |

---

## 4. SISTEM PIKET DEVELOPER (PIKETDEV.MD)

Semua sesi AI Agent (Antigravity) wajib berkoordinasi melalui [`piketdev.md`](file:///c:/Users/zidna/ptvpro/piketdev.md):
1. **Prosedur Pembukaan Sesi:**
   - Baca [`AGENTS.md`](file:///c:/Users/zidna/ptvpro/AGENTS.md) dan [`piketdev.md`](file:///c:/Users/zidna/ptvpro/piketdev.md) (Dashboard & Handoff Terbaru).
   - Periksa `git status` secara read-only.
   - Wajib menanyakan identitas operator/developer yang bertugas jika belum dikonfirmasi pada sesi berjalan: *"Halo! Sebelum mulai piket, siapa developer/operator yang bertugas di sesi ini?"*
   - Catat entri piket baru berstatus **Aktif** dengan Session ID berurutan (`PTV-DEV-001`, `PTV-DEV-002`, dst).
   - Baca roadmap dan file teknis hanya yang relevan dengan scope yang dikonfirmasi. Dilarang melakukan audit penuh tanpa instruksi spesifik.
2. **Prosedur Penutupan Sesi:**
   - Ringkas pekerjaan riil, catat file yang berubah, hasil uji terverifikasi, dan pekerjaan tertunda.
   - Cantumkan ringkasan pembersihan kode (code hygiene) yang benar-benar dilakukan beserta referensi ID temuan dari [`cleanings.md`](file:///c:/Users/zidna/ptvpro/cleanings.md). Jangan menggandakan seluruh isi laporan.
   - Tulis handoff terbaru di bagian atas [`piketdev.md`](file:///c:/Users/zidna/ptvpro/piketdev.md) dan perbarui status entri menjadi **Selesai** atau **Tertunda**.
   - Sarankan membuka sesi baru jika berganti scope atau konteks mulai terlalu panjang.
3. **Batas Validitas:** Isi logbook piket adalah koordinasi kerja, bukan bukti otomatis kebenaran kode. Verifikasi kode aktual dan kepatuhan pengujian tetap wajib dijalankan sesuai aturan repositori.

---

## 5. KEBIJAKAN CODE HYGIENE & CLEAN-AS-YOU-GO (CLEANINGS.MD)

Semua developer dan AI Agent wajib menerapkan prinsip **Clean-as-You-Go** secara terarah dan terukur:

1. **Sebelum Melakukan Perubahan:**
   - Cari implementasi yang sudah ada sebelum membuat function, component, utility, hook, service, atau CSS baru.
   - Prioritaskan reuse dan perbaikan implementasi existing.
   - Hindari membuat versi paralel tanpa alasan teknis yang kuat.
   - Tentukan scope perubahan secara jelas agar pembersihan tidak merembet ke area luar tugas.

2. **Selama Melakukan Perubahan:**
   - Hindari meninggalkan dead code, duplicate logic, unused imports, orphan components, zombie CSS, dan abstraction yang tidak diperlukan.
   - Jangan membiarkan implementasi lama yang sudah diganti mengambang tanpa alasan.
   - Jangan menghapus kode hanya karena terlihat tidak digunakan tanpa verifikasi menyeluruh.
   - Pertahankan kompatibilitas antarmuka dengan pemanggil yang sah.

3. **Setelah Melakukan Perubahan (Targeted Cleaning Review):**
   Wajib melakukan audit kebersihan terarah khusus pada file dan modul yang disentuh:
   - *Unused imports & variables*
   - *Unreferenced functions*
   - *Duplicate helpers & components*
   - *Orphan files*
   - *Unused CSS selectors*
   - *Mock leakage ke jalur produksi*
   - *Stale comments & obsolete TODOs*
   - *Unnecessary abstractions*
   
   Periksa juga referensi pemanggilan tidak langsung dari routing, dynamic imports (`React.lazy`), unit tests, dan konfigurasi build.
   - Hapus **hanya** kode yang terbukti aman dan berada dalam scope pekerjaan.
   - **Dilarang** melakukan cleanup massal repository-wide secara otomatis.
   - Catat temuan dan tindakan pembersihan ke dalam [`cleanings.md`](file:///c:/Users/zidna/ptvpro/cleanings.md).

---

## 6. KEBIJAKAN EVALUASI KESEHATAN SESI (SESSION HEALTH SCORE)

Antigravity wajib mengevaluasi dan melaporkan estimasi kesehatan sesi (0–100%) ketika:
- Pengembang meminta melanjutkan sesi setelah disarankan pindah.
- Menyelesaikan satu milestone tugas besar.
- Mengubah fokus pekerjaan ke modul lain.
- Muncul tanda kebingungan konteks atau inkonsistensi keputusan.

### 1. Indikator Evaluasi Heuristik:
- Kejelasan konteks aktif & kepatuhan terhadap roadmap.
- Konsistensi terhadap keputusan arsitektur sebelumnya.
- Frekuensi pergantian fokus/topik dalam satu sesi.
- Kemampuan mengidentifikasi status pekerjaan yang sudah dan belum selesai secara konkret.
- Adanya instruksi bertentangan antar-permintaan pengguna.
- Risiko salah sasaran saat memodifikasi file atau modul.
- Panjang dan kompleksitas alur percakapan (tanpa mengklaim mengetahui kapasitas context window atau token tersisa yang tidak tersedia).

Setiap skor wajib disertai alasan ringkas dan tingkat keyakinan (*Tinggi / Sedang / Rendah*). Jika bukti tidak memadai, nyatakan skor tidak dapat dinilai secara andal dan sarankan sesi baru.

### 2. Ambang Batas Kebijakan:
- **80–100% (Sehat):** Sesi prima. Boleh melanjutkan pekerjaan normal.
- **60–79% (Cukup Sehat):** Sesi stabil. Boleh melanjutkan setelah mengonfirmasi ulang batasan scope.
- **40–59% (Risiko Meningkat):** Sangat disarankan membuat sesi baru. Boleh melanjutkan hanya untuk tugas kecil dengan konfirmasi eksplisit pengguna dan konteks yang masih selaras.
- **0–39% (Wajib Sesi Baru):** Kritis. **Dilarang keras** menerima atau mengeksekusi instruksi penulisan kode/fitur baru. Agen **hanya boleh**:
  1. Melakukan pemeriksaan *read-only* untuk persiapan serah terima.
  2. Menyimpan progres dan memperbarui catatan handoff di [`piketdev.md`](file:///c:/Users/zidna/ptvpro/piketdev.md).
  3. Menjelaskan panduan membuka sesi percakapan baru kepada operator.

### 3. Critical Override (Wajib Sesi Baru Tanpa Memandang Skor):
Sesi wajib segera dihentikan dan diarahkan ke sesi baru jika:
- Konteks arsitektur penting hilang atau terhapus.
- Terjadi kontradiksi instruksi yang tidak dapat direkonsiliasi.
- Terjadi pergantian nama operator/pengembang.
- Agen tidak lagi yakin terhadap batas file/scope yang dimodifikasi.
- Risiko merusak atau menimpa pekerjaan pengembang lain meningkat.

*Dilarang menggelembungkan skor hanya demi menyenangkan atau menuruti permintaan operator.*

### 4. Format Laporan Standar:
```text
SESSION HEALTH
Score: XX/100
Status: Sehat / Cukup Sehat / Risiko / Wajib Sesi Baru
Confidence: Tinggi / Sedang / Rendah
Alasan: ...
Keputusan: Lanjut / Lanjut Terbatas / Sesi Baru
```
*(Catatan: Penilaian ini merupakan estimasi heuristik kualitatif, bukan telemetri kuantitatif mutlak).*

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read these installed skill files directly (use these paths even if a same-named global skill exists):
- Core filter, always on: `antislop`: `.agents/skills/antislop/SKILL.md`
- UI / visual: `antislop-ui`: `.agents/skills/antislop-ui/SKILL.md`
- People: `antislop-human`: `.agents/skills/antislop-human/SKILL.md`
- Copy & text: `antislop-copywriting`: `.agents/skills/antislop-copywriting/SKILL.md`
- Mobile / responsive: `antislop-layoutmobile`: `.agents/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `antislop-code`: `.agents/skills/antislop-code/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->
