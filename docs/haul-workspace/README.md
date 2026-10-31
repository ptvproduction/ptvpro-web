# Haul & Harlah Workspace

Status: **terimplementasi dan teruji lokal menggunakan mock**, belum terintegrasi cloud. PTV-DEV-197 / Zidnal / 29 Oktober 2026.

## Menjalankan

Worktree: `C:\Users\zidna\.codex\worktrees\haul-harlah\ptvpro`
Branch: `codex/haul-harlah-workspace`

```powershell
npx vite --config vite.haul.config.ts --mode haul-isolated
```

Buka `http://127.0.0.1:5180/haul-workspace.html`. Server memakai `127.0.0.1`, port ketat 5180 dan `envDir: false`. Environment staging tidak dibaca. Entry preview mengimpor mock repository saja, tanpa klien Supabase, middleware API, login, atau shell baru. Runtime utama 5174 tidak digunakan atau dihentikan. Dependencies menggunakan junction ke node_modules existing, tanpa pengunduhan ulang.

## Arsitektur dan hasil audit terarah

- React 18, TypeScript, Vite 6, CSS existing. Halaman Haul lama masih countdown (`src/products/hub/haul/HaulPage.tsx`); tidak diganti.
- Route utama, HubShell, autentikasi, layanan existing, dan CSS global tidak diedit oleh pekerjaan ini. Baseline source/public disalin dari working tree operator ke worktree karena HEAD belum memuat banyak modul terkini. Perubahan baseline itu bukan hasil pekerjaan DEV-197 dan jangan ikut di-stage massal.
- Capability aktual: `projecthaul.view` dan `projecthaul.manage` pada `src/core/policy/capabilities.ts`. Shell memakai Outlet dan sesi Hub; tidak diperlukan sidebar/login tambahan.
- `api/kru.ts` membaca identitas personel `canonical_identity_id` dan relasi akun `user_account.identity_id`. ID personel dan ID akun harus tetap berbeda. `CrewMember.id` tidak boleh dianggap otomatis sebagai UUID canonical_identity.
- Source kebijakan native: `docs/PTVPRO-ACCESS-152-NATIVE-SESSION-PROPOSAL.sql`; layanan Hub juga memakai jalur cookie server. `auth.uid()` tidak otomatis tersedia dari cookie tersebut. Ini penghalang integrasi cloud, bukan alasan membuat autentikasi kedua.
- `types.ts`: kontrak domain; `fixtures.ts`: data sintetis terstruktur dan daftar kru simulasi; `repository.ts`: persistensi, validasi dan permission mock; `HaulWorkspace.tsx`: semua tampilan/editor; `preview.tsx`: harness development terpisah.
- Komponen menerima `repository`, `people`, dan `actor` dari host. Kru hanya dirujuk melalui ID; tidak ada tabel atau master kru produksi baru.
- Modal memakai ulang `ContinuousModalSurface` dan `useModalScrollLock`, sehingga lifecycle fokus/scroll tetap mengikuti Hub. CSS hanya berawalan `hh-`.

## Fitur lokal

- Edisi tahunan: tambah, ubah periode/judul, dan pindah edisi; histori pekerjaan edisi sebelumnya tetap tersimpan.
- Acara: tambah/edit, brief, lokasi, jadwal, urutan numerik dan arsip/pulihkan. Card membuka panel dialog. Detail mencantumkan pekerjaan terkait.
- Project/task: relasi acara jamak, PIC, anggota jamak, status, prioritas, deadline, subtugas, dependency, referensi, tautan berkas/hasil, dan approval simulasi.
- Rundown: satu acara per sesi, waktu mulai/selesai, lokasi, catatan teknis, kebutuhan liputan/posisi, beberapa kru. Bentrok ditolak sebelum penyimpanan; interval bersebelahan diizinkan.
- Konten: format/platform bebas diisi, caption/brief, PIC, deadline, jadwal tayang, tautan hasil, acara jamak dan referensi project/task tanpa menggandakan task.
- List, Calendar, By Project, By Person, By Event memakai repository yang sama; pencarian, filter jenis/status/kru, urutan dan saved views per akun.
- Catatan/pin: catatan dipin diurutkan lebih awal. Reminder dan pengingat tanggal mulai/deadline/tayang tampil dalam halaman dan dihitung ulang setiap menit saat terbuka.
- Kru yang ditugaskan hanya dapat mengubah status, hasil dan pengajuan review. Koordinator mengatur penugasan dan keputusan approval. Simulator akses hanya berada pada entry preview.
- Penyimpanan localStorage melaporkan kegagalan quota/JSON, tidak mengganti data rusak diam-diam dengan fixtures. Audit lokal mencatat aktor, waktu dan jenis perubahan. Revision check menolak editor lama dalam instance yang sama.

## Arah visual dan delivery gate

Arah: workspace operasional Progresif TV, editorial, ringkas, SF Pro dan biru R03. ENERGY 1 / RHYTHM 2 / MOTION 1. Card terbatas pada rangkaian acara untuk orientasi; pekerjaan memakai baris agar mudah dipindai. Aksen biru menandai pilihan/aksi. Panah pada baris menandai pembukaan detail. Shadow hanya untuk elevasi dialog. Tidak membuat logo, foto, ilustrasi, statistik, testimonial atau struktur navigasi Hub baru.

Gate lokal: semua jenis item dibuat melalui UI, save/reload, role kru, arsip/pulihkan, saved views, edisi, keyboard, scroll lock, lebar 375/390/768/1024/1440 dan tema terang/gelap diuji di Edge Chromium. Screenshot dilihat langsung. Safari/iPhone fisik dan integrasi shell belum diuji. Tidak mengklaim paritas visual penuh atau dukungan browser yang belum diuji.

## Validasi

```powershell
npx tsc --noEmit -p tsconfig.haul.json
npx vitest run --config vite.haul.config.ts
npx eslint src/products/hub/haul-workspace tests/haul-workspace vite.haul.config.ts --max-warnings 0
npx vite build --config vite.haul.config.ts
```

Hasil final: typecheck modul PASS; 19/19 unit test PASS; lint terarah PASS; build entry terisolasi PASS (38 modul). QA browser 12/12 skenario PASS, 0 page errors, 0 request eksternal. Bukti mesin: `browser-results.json`; harness reproduksi di `tests/haul-workspace/browser.mjs`; enam screenshot stabil di `.gemini/scratch/haul-*.png`.

`npm run typecheck` untuk seluruh snapshot juga dicoba dan **FAIL: 11 error** di `tests/hub/inventarisPeminjaman.test.ts` dan `tests/hub/loanModal.test.ts` (`reset`, `getAvailableUnits`, implicit any). Snapshot memuat src terkini tetapi tes lama dari HEAD; hasil ini bukan penilaian workspace utama. Full-suite test/lint dan build Hub tidak dijalankan. Tidak memperbaiki Peminjaman di luar scope.

## Draft database dan mapping

`migration.draft.sql` berisi 18 tabel pada schema `ptv_haul`: edition, event, project/project_event/project_member, task/task_event/task_member/task_dependency/task_approval, session/assignment, content/content_event, note, reminder, saved_view, audit_log. FK personel ke `public.canonical_identity(id)`; pemilik view/approval/audit ke `public.user_account(id)`; FK komposit menahan relasi lintas edisi. Termasuk indeks jadwal, state checks, URL checks, unique pending approval, arsip dan RLS.

**Belum dieksekusi atau diuji di PostgreSQL.** Draft memiliki guard eksplisit dan berakhir ROLLBACK. CREATE IF NOT EXISTS mendukung pengulangan draft, tetapi tidak memperbaiki schema existing yang berbeda. DBA tetap harus mengaudit bentuk kolom dan policy. Jangan menjalankan file ini pada proyek Supabase saat tahap isolasi.

RLS usulan hanya mengizinkan SELECT dengan `projecthaul.view`, saved view dibatasi akun native aktif. Tidak ada GRANT tulis browser. Tidak ada klaim bahwa kebijakan native sudah cocok dengan cookie Hub. RPC/API terverifikasi diperlukan sebelum memberikan akses tulis, termasuk pembaruan milik kru dan approval koordinator.

Mapping adapter berikutnya: work item `kind` ke tabel bertipe, `eventIds` ke junction; memberIds ke task_member/project_member/assignment; parentId task ke task.parent_id, parentId content ke content.task_id; start/end wall-clock mock dikonversi secara eksplisit ke Asia/Jakarta timestamptz. Note/reminder pada mock dapat memiliki beberapa eventIds, sedangkan draft sementara memakai satu event_id: tambahkan junction sebelum round-trip multi-acara diaktifkan. Kolom umum UI tambahan (status/priority/approval/pin/order pada jenis selain task) juga harus diputuskan dan dimigrasikan sebelum adapter live; jangan membuang field diam-diam.

## Batas dan integrasi berikutnya

1. Preview adalah simulasi browser satu perangkat, bukan autentikasi atau security boundary. Jangan memuat data operasional sensitif ke preview. Belum ada sinkronisasi lintas tab/perangkat, version migration, export/import, unggah biner atau pengiriman notifikasi background.
2. Kalender menampilkan rentang edisi maksimum 93 hari, dengan bucket tanpa tanggal/di luar periode; fokus default 21 hari. Tidak ada drag/drop, pagination server atau virtualisasi.
3. Audit mock berupa event perubahan, bukan forensic before/after ledger. Reminder memerlukan tanggal diisi untuk muncul sebagai pengingat; tidak mengirim email/push.
4. Setelah Hub difinalisasi: gunakan route `/hub/haul` existing dalam Outlet HubShell, proteksi view dengan projecthaul.view, derive manage dari projecthaul.manage, identitas aktor dari sesi server, serta master kru yang sudah direkonsiliasi. Hapus simulator dari bundel host. Perubahan ini belum dilakukan.
5. Lengkapi draft field mapping di atas, API/RPC transaksi atomik, dependency/subtask cycle checks, revision concurrency, conflict lock termasuk reschedule sesi, arsip relation guards, audit append-only dan deny-tests RLS dengan sesi native/cookie sebenarnya. Tidak membuka writes sebelum itu.
6. Baru setelah review dan otorisasi tahap integrasi terpisah: latihan PostgreSQL lokal, staging integration, pemeriksaan shell/dock serta Safari, dan review migration/deployment. Tidak merge, push, deploy atau SQL cloud dalam sesi ini.

## File hasil pekerjaan

Hanya `src/products/hub/haul-workspace/*`, `tests/haul-workspace/*`, `haul-workspace.html`, `vite.haul.config.ts`, `tsconfig.haul.json`, `docs/haul-workspace/*`, serta entri DEV-197 pada roadmap/piketdev/cleanings worktree. Jangan menggabungkan seluruh git diff worktree: source baseline operator juga terlihat sebagai perubahan terhadap HEAD lama.
