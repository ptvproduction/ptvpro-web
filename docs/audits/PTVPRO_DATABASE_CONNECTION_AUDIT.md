# PTVPRO — Database Connection Mapping Audit

Tanggal: 28 Oktober 2026 (Asia/Jakarta). Operator: zidnal. Lingkup: repository lokal, seluruh route aplikasi dan jalur data yang dirujuknya. Mode: read-only, kecuali pembuatan laporan ini.

## 1. Kesimpulan dan batas bukti

- **30 modul/fitur utama** dipetakan pada tabel bagian 4. Route alias dan halaman detail dihitung bersama modul induknya. Fitur pendukung, implementasi lama, dan worker terpisah dicatat pada bagian 7.
- **2 identifier project Supabase** ditemukan: `swadgljnyelsjstqqxbm` (ptvpro-staging) dan `jthzuhkblxcaohiuypqq` (PTV Website lama). Hanya staging terbukti menjadi konfigurasi frontend runtime yang sedang dilayani. Referensi legacy tidak otomatis berarti koneksi aktif.
- **28 dari 30 baris** mempunyai jalur baca/tulis database langsung atau melalui dependensi layanan, dengan target staging berdasarkan konfigurasi lokal. **2 modul tanpa database bisnis sendiri: Haul/Harlah dan SEO/Analytics**. Keduanya tetap menggunakan konteks sesi/guard Hub.
- **Tidak ditemukan modul web aktif yang secara eksplisit memilih production lama** dalam konfigurasi staging yang diperiksa. Worker sinkronisasi legacy mempunyai jalur dua sumber, tetapi proses worker dan koneksi cloud-nya belum diverifikasi.
- Tidak ditemukan bukti dua project cloud aktif sekaligus pada halaman web. Campuran **cloud + localStorage/fixtures** nyata ada pada Portal, Status Layanan, Beranda, Dokumen Saya, Arsip, Generator, Perizinan, Pengelolaan Portal, Broadcast, Notifikasi, dan Pencarian Universal. Cache persisten juga dipakai oleh banyak modul lain; cache bukan database kedua.
- Tidak ada SQL, migration, operasi CRUD, login, deployment, build, atau test yang dijalankan. Tidak ada pembacaan isi tabel cloud maupun data pengguna. Source, environment, roadmap, piketdev, dan cleanings tidak diubah sesuai pembatasan terbaru pengguna.

### Bukti runtime yang benar-benar diperoleh

HTTP GET read-only ke modul Vite `/src/core/supabase/client.ts` pada `127.0.0.1:5174` menghasilkan HTTP 200. Dari environment frontend hasil transformasi Vite, hanya field nonrahasia berikut diekstrak di memori:

| Pemeriksaan | Hasil |
|---|---|
| Port 5174 | HTTP 200 |
| MODE | `staging` |
| VITE_APP_ENV | `staging` |
| VITE_AUTH_BACKEND | `vercel` |
| VITE_INVENTARIS_BACKEND | `supabase` |
| Project ref frontend | `swadgljnyelsjstqqxbm` |
| Port 5173 | `ECONNREFUSED` |

Percobaan awal dalam sandbox menghasilkan `EACCES`; hasil itu bukan bukti server mati. Pemeriksaan di luar sandbox memberikan hasil di atas. Enumerasi proses CIM tidak tersedia. Tidak dilakukan restart server atau pembukaan halaman yang bisa menginisialisasi penyimpanan browser.

**Yang belum terbukti:** respons database tiap modul, kredensial server efektif dalam proses yang sedang berjalan, state cookie/session browser, isi localStorage, skema/RPC cloud terpasang, RLS yang berlaku, dan keberhasilan persistensi. Environment server di disk menunjuk staging, tetapi bukan inspeksi langsung memori proses server. Semua operasi pada tabel di bawah adalah kemampuan/call-site kode, bukan operasi yang dieksekusi dalam audit.

## 2. Project, endpoint, dan sumber selain database

| Identifier | Peran yang terbukti dari kode/konfigurasi | Status |
|---|---|---|
| `swadgljnyelsjstqqxbm` | Supabase frontend staging; URL server lokal; target wajib beberapa API | Frontend runtime terverifikasi; akses cloud belum diuji |
| `jthzuhkblxcaohiuypqq` | Metadata asal migrasi, guard anti-production, referensi legacy dan worker | Bukan bukti koneksi runtime web |
| `localhost:54321` | Default client/config ketika URL frontend kosong | Fallback konfigurasi, tidak terbukti aktif |
| `127.0.0.1:55441` | Harness Finance terisolasi; memerlukan test mode dan flag khusus | Test-only, bukan project cloud ketiga |
| Google Sheets CSV | Data santri Generator; URL di `santriMockData.ts:1005` | Fetch eksternal; dapat diganti melalui field CSV UI |
| Google OAuth / Google certs | Login/taut akun dan validasi identitas Google | Provider auth, bukan database bisnis |
| `progresiftv.id/wp-content/uploads/…` | Foto/aset legacy, termasuk fallback foto kontak | HTTP aset WordPress, bukan query database WordPress |
| localStorage / memori | Draft, fixtures, preferensi, cache, dan beberapa mutasi lokal | Tidak membuktikan persistensi cloud |

Tidak ditemukan pemanggilan `functions.invoke`/`functions/v1` pada jalur source aplikasi yang dipindai. Direktori `supabase/` berisi dua migration SQL; tidak ada implementasi Edge Function di sana. API `api/*.ts` adalah handler serverless Node, diemulasikan Vite secara lokal, bukan Supabase Edge Functions. Tidak ditemukan klien PostgreSQL langsung di `src/` atau `api/`; koneksi `pg` ada dalam utilitas administrasi/test `scripts/`, terpisah dari runtime halaman. Tidak ditemukan panggilan WordPress REST `wp-json` pada jalur aktif `src/` dan `api/`.

## 3. Konfigurasi dan pemilihan koneksi

### File environment

Nama variabel dan target saja dicatat; seluruh nilai credential dikecualikan.

| File | Pengaruh |
|---|---|
| `.env.staging:17` | `VITE_SUPABASE_URL` menunjuk staging |
| `.env.staging:18` | Konfigurasi credential frontend tersedia; nilai tidak disalin |
| `.env.staging:25` | Auth `vercel` |
| `.env.staging:26` | Inventaris `supabase` |
| `.env.staging:27`–`:28` | Flag lifecycle auth dan password login |
| `.env.staging.local:19` | `SUPABASE_URL` menunjuk staging |
| `.env.staging.local:21` | Credential server tersedia; nilai tidak disalin |
| `.env.staging.local:10`–`:15` | Konfigurasi Google OAuth dan signing sesi; nilai tidak disalin |
| `.env.staging.local:22` | Flag maintenance Finance |
| `.env.example`, `.env.staging.example` | Template, tidak membuktikan runtime |

Pada root yang diperiksa tidak ditemukan `.env`, `.env.local`, `.env.development`, `.env.development.local`, `.env.production`, atau `.env.production.local`. Tidak ada klaim mengenai environment dashboard deployment. Variabel proses/injeksi deployment dapat berbeda dari file lokal.

- [vite.config.ts](../../vite.config.ts:24): `loadEnv(mode, root, '')` dimuat ulang saat request `/api/`, lalu disalin ke `process.env`. Konfigurasi utama juga memuat environment saat start (`:110`). Handler lokal dipilih eksplisit untuk inventaris, surat publik, broadcast, catatan, acara, planner, finance, peminjaman, laporan, akses, kru, dokumen, kontak, dan auth.
- [package.json](../../package.json:7): `dev` memakai default mode Vite; `dev:staging` memakai `--mode staging --port 5174`. `build` tidak menyertakan `--mode staging`. Karena itu build biasa tidak otomatis memakai `.env.staging`.
- [vercel.json](../../vercel.json:1): rewrite API dan SPA saja; tidak menetapkan project database.
- [client.ts](../../src/core/supabase/client.ts:10), `getSupabaseClient` (`:26`): singleton Supabase SDK browser memakai `VITE_SUPABASE_URL`; `isSupabaseConfigured` memeriksa konfigurasi, bukan konektivitas.
- [env.ts](../../src/app/config/env.ts:5): `APP_CONFIG` mengulang default URL lokal; bukan koneksi database tambahan.
- [authService.ts](../../src/core/auth/authService.ts:656), `getAuthService`: `vercel`/`native` → API cookie; `supabase` → SDK Auth + `jwt_custom_claims`; development non-staging dengan backend kosong/mock → `LocalMockAuthService`. Tidak semua mode memakai Supabase Auth native.
- [inventoryPortalClient.ts](../../src/products/hub/inventaris/services/inventoryPortalClient.ts:1): staging dipaksa ke API inventaris dan ref staging tertentu. Di luar staging, [InventarisServiceManager](../../src/products/hub/inventaris/inventarisService.ts:1871) memilih env eksplisit → preferensi `ptv_inventaris_backend` → default berdasarkan app env. Local adapter menyimpan `ptv_local_inventaris_items`.

### Perbedaan prioritas URL server

| Jalur | Prioritas |
|---|---|
| Acara, Catatan, Planner, Verifikasi Surat; beberapa fungsi identity | `SUPABASE_URL` lalu `VITE_SUPABASE_URL` |
| Dokumen, Kru, Kontak, Broadcast, Auth session/login proof; Finance helper | `VITE_SUPABASE_URL` lalu `SUPABASE_URL` |
| Peminjaman, Kerusakan, Lost & Found, Akses | `VITE_SUPABASE_URL` saja |
| Browser SDK | `VITE_SUPABASE_URL` saja |

Bukti: `api/acara.ts:361`, `api/catatan.ts:179`, `api/planner.ts:142`, `api/verifikasi-surat.ts:29`, `api/dokumen.ts:362`, `api/kru.ts:132`, `api/kontak.ts:95`, `api/broadcast.ts:118`, `api/peminjaman.ts:95`, `api/lapor-kerusakan.ts:82`, `api/lost-found.ts:77`, `api/akses.ts:43`, `api/auth/_utils/identity.ts:230`, `api/auth/_utils/financeLocalHarness.ts:2`.

Kedua URL lokal saat audit sama-sama staging. Jika berubah tidak serempak, API dan fallback SDK dapat menuju project berbeda. Guard staging pada Akses, Kru, Finance, lifecycle auth, Inventaris portal, Peminjaman, Kerusakan, dan Lost & Found akan menolak sebagian target baru. Acara/Catatan/Planner menolak ref legacy secara eksplisit. Kontak membatasi mutasi terhadap ref legacy tetapi kode GET memungkinkan URL tersebut. Nama class berawalan `Staging` sendiri bukan guard project.

## 4. Tabel utama seluruh modul

Notasi: **S** = `swadgljnyelsjstqqxbm` / ptvpro-staging berdasarkan konfigurasi frontend aktif dan file server lokal. **K/E** = jalur terverifikasi dari kode, pemilihan/keberhasilan koneksi bergantung environment dan session; bukan hasil query cloud. **L** = sumber lokal terbukti dari kode. R = SELECT; I = INSERT; U = UPDATE; D = DELETE; UPS = UPSERT. `RPC` menunjukkan panggilan function, bukan klaim semua DML internalnya telah diverifikasi. Tabel business tercantum di setiap baris; tabel auth bersama dijelaskan pada bagian 5 agar tidak disamarkan sebagai sumber bisnis.

| # / Modul | Route | Project ID | Tabel / RPC | Operasi | Sumber Data | Status |
|---|---|---|---|---|---|---|
| 1 Portal / Launcher | `/` | S | `ptv_portal_services` | R | SDK; localStorage; `INITIAL_SERVICES`; pengumuman/settings lokal | K/E + L |
| 2 Status Layanan | `/status-layanan` | S | `ptv_portal_services` | R | `portalManagementService`, fallback katalog lokal; bukan probe uptime DB | K/E + L |
| 3 Beranda Hub | `/hub/beranda` | S | `ptv_acara`, `ptv_pengumuman`, `ptv_peminjaman`, `ptv_inventaris`, `ptv_inventaris_unit`, `legacy_archive_unresolved`, `ptv_surat_izin`, `ptv_surat_tugas`, `ptv_surat_barang`, `ptv_catatan` (AcaraProvider); RPC izin pinjaman | R / RPC | Agregasi empat service; cache; fallback broadcast/docs; jumlah kru hardcoded | K/E + L |
| 4 Acara dan detail | `/hub/acara`, `/hub/acara/:id` | S | `ptv_acara`, `canonical_identity`, `ptv_catatan`; kelompok C; `ptv_inventaris`, `ptv_inventaris_unit`, `ptv_nilai_inventaris`; tiga tabel surat; `dispatch_smart_notification` | R/I/U/D + RPC dokumen terkait | API → fallback SDK untuk baca; surat lewat dokumenService | K/E |
| 5 Kalender & Momentum | `/hub/kalender` | S | `ptv_content_planner`, `ptv_acara`, `ptv_catatan` (notulensi provider) | R/I/U/D planner; R acara/notulensi | API planner + AcaraProvider; PDF kalender berupa aset | K/E |
| 6 Catatan Bersama | `/hub/catatan` | S | `ptv_catatan` | R/I/U/D | API; fallback baca SDK | K/E |
| 7 Inventaris / detail | `/hub/inventaris`, `/hub/inventaris/:id` | S | `ptv_inventaris`, `ptv_inventaris_unit`, `ptv_nilai_inventaris`, `auth_audit_log`; `rpc_create_inventaris`, `rpc_update_inventaris`; jalur native `rpc_get_next_inv_code`; bucket `inventory` | R; RPC create/update; I audit; upload; cleanup storage jalur native | API portal saat staging; SDK/native atau local adapter pada mode lain | K/E |
| 8 Nilai Inventaris / detail | `/hub/inventaris/nilai`, `/hub/inventaris/nilai/:id` | S | `ptv_inventaris`, `ptv_inventaris_unit`, `ptv_nilai_inventaris`, `auth_audit_log` | R/UPS/D nilai; I audit | inventarisService → API; direct SDK di luar portal | K/E |
| 9 Peminjaman | `/hub/peminjaman` | S | `ptv_peminjaman`, `ptv_inventaris`, `ptv_inventaris_unit`, `legacy_archive_unresolved`; `ptv_nilai_inventaris` (picker); `rpc_loans_can_read_server`, `rpc_checkout_loan_server`, `rpc_return_loan_server`, `rpc_return_single_unit_server`, `dispatch_smart_notification` | R; RPC checkout/return | API; RPC native alternatif di luar auth cookie | K/E |
| 10 Kerusakan | `/hub/kerusakan` | S | `ptv_lapor_masalah`, `ptv_inventaris`, `ptv_inventaris_unit`, `legacy_archive_unresolved`; `rpc_report_can_read`, `rpc_write_report_server` | R; RPC laporan | API + inventory picker; direct `rpc_write_report` alternatif | K/E |
| 11 Lost & Found | `/hub/lostfound` | S | `ptv_lost_found`; `rpc_report_can_read`, `rpc_write_report_server` | R; RPC laporan | API; direct `rpc_write_report` alternatif | K/E |
| 12 Manajemen Kru | `/hub/kru` | S | Kelompok C; `ptv_login_history`; `rpc_update_crew_personnel` | R/I/U archive; RPC update identitas tertaut | API `/api/kru`; crewStore cache | K/E |
| 13 Manajemen Akses | `/hub/akses` | S | Kelompok A + `access_profile`, `capability_registry`, `auth_audit_log`; `rpc_manage_account_access`; kelompok C untuk kru UI | R; RPC perubahan akses | API `/api/akses` dan crewStore | K/E |
| 14 Dokumen Saya | `/hub/dokumen` | S | `ptv_surat_izin`, `ptv_surat_tugas`, `ptv_surat_barang`; `approve_ptv_document_atomic` | R/U/D/RPC; create ST/SBB I | API → SDK → docsStore; fixtures server bila kosong | K/E + L |
| 15 Kontak Internal | `/hub/kontak` | S | `legacy_archive_kru`, `canonical_identity`, `organization_membership`, `user_account`, `account_profiles` | R | API `/api/kontak?type=internal`; fallback SDK archive; crewStore untuk dependensi | K/E |
| 16 Kontak Eksternal | `/hub/kontak-eksternal` | S | `ptv_kontak_eksternal` | R/I/U/D | API; fallback SDK termasuk penulisan | K/E |
| 17 Keuangan | `/hub/keuangan` | S | `ptv_kas_kru`, `ptv_pemasukan`, `ptv_pengeluaran`, `ptv_keuangan`, `ptv_finance_pockets`, `ptv_finance_transactions`, `ptv_finance_categories`, `ptv_finance_allocations`, `ptv_finance_source_references`; RPC Finance bagian 5; bucket `finance-proofs` | R; RPC posting/admin/void; signed URL | FinancePage → API; bukan KeuanganPage lama/local store | K/E |
| 18 Generator Surat Izin | `/hub/surat/generator` | S + Google Sheets + lokal | Baca tiga tabel surat lewat pemeriksaan nomor dokumen; **publish tidak INSERT `ptv_surat_izin`** | R; tulis docsStore lokal | CSV Google / fixtures santri; pemeriksaan nomor API; pengajuan localStorage | K/E + L |
| 19 Pengajuan Perizinan | `/hub/perizinan` | S | Tiga tabel surat; `approve_ptv_document_atomic`; `ptv_acara`; kelompok C; `ptv_inventaris`, `ptv_inventaris_unit`, `ptv_nilai_inventaris` untuk picker | R; I ST/SBB; U/D/RPC dokumen | List API-only; operasi dokumen punya fallback lokal | K/E + L |
| 20 Surat & Arsip | `/hub/arsip` | S | Tiga tabel surat; `approve_ptv_document_atomic` | R/U/D/RPC | dokumenService + docsStore; fallback fixtures | K/E + L |
| 21 Verifikasi Surat | `/verifikasi-surat`, `/verifikasi-surat/*` | S | `ptv_surat_izin` / `ptv_surat_tugas` / `ptv_surat_barang` dipilih kode surat | R | API publik `/api/verifikasi-surat`; error jika backend gagal | K/E |
| 22 Verifikasi Identitas | `/verifikasi-identitas`, `/:crewId`, `/*` | S + lokal | Kelompok C via crewStore; penugasan dari docsStore/fixtures | R | verifyCrew sinkron atas store, init async melalui API kru | K/E + L |
| 23 Haul & Harlah | `/hub/haul` | — | Tidak ada tabel bisnis | — | Countdown/tanggal dan konten hardcoded | L |
| 24 Pengelolaan Portal | `/hub/portal` | S + lokal | `ptv_portal_services` untuk baca; pengumuman/settings/audit draft lokal | R DB; CRUD/publish lokal | SDK baca; seluruh writer service localStorage | K/E + L |
| 25 Pengumuman / Broadcast | `/hub/broadcast` | S + lokal | `ptv_pengumuman` | R DB; CRUD lokal | API baca → broadcastStore; writer UI lokal | K/E + L |
| 26 SEO & Analytics | `/hub/seo` | — | Tidak ada | — | `SEO_KPIS`, `SEO_WEEKLY_VISITS`, `SEO_TOP_KEYWORDS` dari fixtures | L |
| 27 Profil & ID Digital | `/hub/profile` | S + lokal | Kelompok C; `auth_credentials`, `user_account`; auth/session terkait | R; U unlink OAuth | crewStore, auth API; preferensi tema lokal | K/E |
| 28 Autentikasi | `/hub/login`, `/hub/auth/callback`, `/api/auth/*` | S | Kelompok A; `auth_credentials`, `capability_registry`, `auth_audit_log`; RPC lifecycle bagian 5 | R/U/I audit; RPC sesi/login | API cookie + Google; SDK native hanya mode alternatif | K/E |
| 29 Notifikasi | Modal pada Hub | S + lokal | `ptv_notifications`; `dispatch_smart_notification` | R/U/D; RPC dispatch | SDK langsung, merge cache lokal; fallback dispatch lokal | K/E + L |
| 30 Pencarian Universal | Modal pada Hub | S + lokal | `ptv_inventaris` (portal juga relasi unit/nilai); `ptv_catatan`; kelompok C via crewStore; indeks lain lokal | R | inventarisService/API atau SDK; catatanService; `MOCK_NOTES` bila kosong/error | K/E + L |

## 5. Jejak fungsi, dependensi, metode, dan operasi

### Kelompok tabel bersama

**A — identitas/otorisasi:** `user_account`, `canonical_identity`, `organization_membership`, `account_profiles`, `account_capability_overrides`, `profile_capabilities`. Dipakai `resolveLiveAccess` (`api/auth/_utils/liveAccess.ts:12`), `resolveFinanceAccess` (`api/financeAccess.ts:7`), session dan API yang memanggil helper tersebut. Finance juga membaca `legacy_archive_kru` untuk kategori personel. Lifecycle sesi memanggil `rpc_portal_session_valid`; tidak menganggap semua handler selalu melakukan query auth yang identik, karena beberapa hanya memvalidasi cookie dan capability dari sesi.

**C — personel Kru:** `legacy_archive_kru`, `canonical_identity`, `organization_membership`, `user_account`, `account_profiles`. Archive dibaca `api/kru.ts:165`; enrichment `api/crewPhase1Adapter.ts:18`–`:40`. Metadata `legacy_source_project` menghubungkan archive dengan canonical identity, **bukan membuka koneksi ke project legacy**.

**D — dokumen:** `ptv_surat_izin`, `ptv_surat_tugas`, `ptv_surat_barang`. Dibaca bersama oleh Dokumen Saya, Arsip, Perizinan dan agregator Beranda; Generator membaca untuk penomoran. Server publik hanya membaca nomor/status dari satu tabel. Inventory safety-check juga membaca dokumen/pinjaman/laporan melalui service untuk pemeriksaan keterkaitan, bukan database baru.

### Dependensi lintas fitur yang turut terbaca

Semua halaman di bawah Hub juga mewarisi session/guard dan notifikasi shell (`HubShell.tsx:323` → `ptv_notifications`). Tabel utama memisahkan akses bisnis dari akses shell ini. Checkout pinjaman (`LoanModal.tsx:480`), assignment kru (`AcaraContext.tsx:222`) dan approval docsStore (`docsStore.ts:146`) dapat memanggil `dispatch_smart_notification` → notifikasi SDK/lokal. Smart Delete Inventaris (`SmartDeleteInventarisModal.tsx:59`) menjalankan `inspectAssetSafety`: membaca `ptv_peminjaman`, `ptv_inventaris`, `ptv_inventaris_unit`, `legacy_archive_unresolved`, `ptv_lapor_masalah`, dan tiga tabel surat melalui service pinjaman/laporan/dokumen (`inventorySafetyCheckService.ts:84`, `:117`, `:153`). Detail alat juga membaca riwayat pinjaman (`AlatDetailPage.tsx:44`). Daftar ini menambah dependensi pada baris Inventaris, tanpa menambahkan koneksi project lain.

### Portal, dashboard, acara, kalender, catatan

- Portal dan Status Layanan → `portalManagementService.getPublicPortalData`/`getPreviewPortalData` → `getServices` [portalManagementService.ts:205](../../src/products/hub/portal-management/services/portalManagementService.ts:205). Satu SELECT `ptv_portal_services`; hasil kosong/error jatuh ke localStorage lalu `INITIAL_SERVICES`. `getAnnouncements` dan `getSettings` membaca lokal/default. `saveService`, `publishService`, `updateServiceStatus`, `reorderServices`, `saveAnnouncement`, `publishAnnouncement`, `saveSettings`, `publishAllDrafts`, `logAction` hanya menulis localStorage. Tidak ada writer SDK ke tabel portal pada service ini.
- Beranda → [LiveBerandaService.getAggregatedData:19](../../src/products/hub/beranda/berandaService.ts:19), empat service: acara, broadcast, peminjaman, dokumen. Promise gagal menjadi array/statistik kosong; pengumuman dapat kembali ke broadcastStore. `activeCrewCount: 25` adalah konstanta, bukan COUNT database (`:60`).
- Acara → [acaraService.getEvents:157](../../src/products/hub/acara/acaraService.ts:157), API `/api/acara`, fallback SELECT SDK di `:190`. Create/update/delete memakai API (`:217`, `:268`, `:313`). [api/acara.ts:387](../../api/acara.ts:387) membaca `ptv_acara`; `:472` membaca canonical identity; `:482`, `:553`, `:681` merupakan jalur mutasi. Detail Acara memilih kru melalui `getActiveCrewCandidates` (`kruService.ts:45`), alat melalui inventarisService, dan membuat surat melalui dokumenService. Karena itu tabel picker dan D ikut menjadi dependensinya.
- Kalender → [KalenderService:177](../../src/products/hub/kalender/kalenderService.ts:177) → `/api/planner`; list/create/update/delete (`:184`, `:225`, `:256`, `:287`), `api/planner.ts:170` dan seterusnya memakai `ptv_content_planner`. AcaraProvider memberi data acara dan membaca `ptv_catatan` untuk notulensi (`acara/context/AcaraContext.tsx:68`), dengan initial notulensi fixtures (`:63`). Provider ini juga dipasang pada Beranda. Tidak ada fallback mock diam-diam dalam `getPlanners`. PDF kalender menggunakan HTTP HEAD/aset, bukan tabel kalender lain.
- Catatan → [catatanService:87](../../src/products/hub/catatan/catatanService.ts:87), GET API lalu SDK `ptv_catatan` (`:118`); mutasi API (`:140`, `:180`, `:212`). Handler `api/catatan.ts:204`, `:269`, `:377`, `:432` melakukan SELECT/INSERT/UPDATE/DELETE pada tabel yang sama.

### Inventaris, nilai, pinjaman, laporan

- Inventaris → `InventarisServiceManager` → `SupabaseInventarisService`. Saat staging, [inventoryPortalRequest:13](../../src/products/hub/inventaris/services/inventoryPortalClient.ts:13) meneruskan operasi ke `/api/inventaris`. Handler memakai `lifecycleClient`, bukan URL production hardcoded. SELECT master mengikutkan relasi `units:ptv_inventaris_unit` dan `nilai:ptv_nilai_inventaris`; lihat `inventarisService.ts:1098`, `:1110` dan `api/inventaris.ts` konstanta kolom. [api/inventaris.ts:172](../../api/inventaris.ts:172) memilih RPC create/update berdasarkan action. `auth_audit_log` INSERT (`:100`) merupakan efek samping jalur audit, sehingga audit ini tidak memanggil handler tersebut.
- Nilai → API `upsert-valuation` / `delete-valuation`, [api/inventaris.ts:189](../../api/inventaris.ts:189), `:197`; direct SDK alternatif `inventarisService.ts:1820`, `:1835`. Hard-delete alat master tidak dijalankan oleh service: `:1842` melempar error belum diaktifkan; nama `rpc_delete_inventaris` dalam pesan bukan pemanggilan RPC aktual.
- Foto Inventaris: bucket dinamis `targetBucket` ditelusuri ke `this.storageBucket = 'inventory'` (`inventarisService.ts:1072`, `:1756`). Staging mengunggah via API (`:1741`) → storage `inventory` (`api/inventaris.ts:144`); jalur native mempunyai cleanup remove saat rollback (`inventarisService.ts:1506`). URL dokumen nilai dibatasi literal host staging (`api/inventaris.ts:186`).
- Pinjaman → [StagingPeminjamanService:6](../../src/products/hub/peminjaman/stagingPeminjamanService.ts:6). List GET API `:23`; write `:48` memilih cookie API atau SDK. Nama dinamis `config.rpc` pada [loanPersistence.ts:5](../../api/loanPersistence.ts:5) dipetakan: `rpc_checkout_loan` → `rpc_checkout_loan_server`, `rpc_return_loan` → `rpc_return_loan_server`, `rpc_return_single_unit` → `rpc_return_single_unit_server`. Tiga nama native tetap ada sebagai jalur SDK alternatif. SELECT pada `api/peminjaman.ts:136`–`:173` mencampur pinjaman operasional dan `legacy_archive_unresolved` **dalam staging yang sama**. LocalPeminjamanService hanya dipilih pada test mode + inventaris local (`peminjamanService.ts:289`).
- Kerusakan → `damageReportService.getReports` / Lost & Found → `lostFoundService.getItems` → API masing-masing (`:15`). Writer bersama [reportPersistence.ts:1](../../src/products/hub/reportPersistence.ts:1) memakai `rpc_write_report` native atau API. [api/reportPersistence.ts:47](../../api/reportPersistence.ts:47) memakai `rpc_write_report_server` dengan module `damage`/`lostfound`; izin `rpc_report_can_read` (`:6`). Nama modul bukan nama tabel dinamis bebas. Kerusakan membaca inventaris/unit serta `legacy_archive_unresolved` (`api/lapor-kerusakan.ts:130`–`:164`); Lost & Found membaca `ptv_lost_found` (`api/lost-found.ts:125`). Dampak internal RPC hanya dapat dipastikan penuh dari definisi cloud; tidak ditebak dari nama.

### Kru, Akses, kontak, profil, autentikasi

- [StagingKruService:26](../../src/products/hub/kru/kruService.ts:26) memakai `/api/kru` untuk list, kandidat aktif, create dan patch. `api/kru.ts` SELECT archive `:165`, history `:230`, create archive `:373`, update archive `:534`; record tertaut memakai `rpc_update_crew_personnel` `:509`. `crewStore.init` membaca cache lalu revalidasi API (`kruStore.ts:100`); error awal tidak otomatis memuat seluruh fixtures.
- [AksesPage.tsx:12](../../src/products/hub/akses/AksesPage.tsx:12) → API `/api/akses`; handler memuat A + registry/profile (`api/akses.ts:10`–`:17`), log (`:54`), dan mutation `rpc_manage_account_access` (`:75`). Pemilihan profil bukan CRUD langsung dari browser ke tabel otorisasi.
- [kontakService.getInternalContacts:115](../../src/products/hub/kontak/kontakService.ts:115) dan `getExternalContacts:28` → `/api/kontak`. Fallback direct SDK terdapat pada `:71` dan `:151`. Internal handler membaca archive lalu enrichment canonical; eksternal membaca `ptv_kontak_eksternal` (`api/kontak.ts:199`) dengan INSERT/UPDATE/DELETE pada jalur berikutnya. Direct fallback penulisan eksternal ada di `kontakService.ts:293`, `:351`, `:400`. Komentar “test runner” tidak menjadi guard runtime; kondisi aktual tetap harus diperhatikan.
- Profil memakai `useCrewStore`, sesi, [ProfilePage.tsx:118](../../src/products/hub/profile/ProfilePage.tsx:118) untuk status Google dan `:147` untuk unlink. Taut/unlink mengakses `auth_credentials`, sedangkan `user_account`/canonical identity ikut resolusi identitas. Tema disimpan `ptv-theme`, bukan Supabase.
- Auth cookie → `api/auth/login.ts`, `session.ts`, `logout.ts`, `google/*`. [portalLifecycle.ts:14](../../api/auth/_utils/portalLifecycle.ts:14) membuat SDK server; RPC `rpc_portal_session_valid`, `rpc_portal_login_begin`, `rpc_portal_login_finish`, `rpc_portal_session_revoke`, dan `rpc_portal_google_session`. Login proof juga membaca `auth_credentials` dan INSERT `auth_audit_log` (`loginProof.ts:13`, `:23`). `identity.ts:241` SELECT credentials dengan join `user_account` → `canonical_identity`; `:294`/`:302` profil dan overrides; fungsi link/unlink mengubah credentials. Google adalah penyedia OAuth, bukan database kru.
- Mode auth `supabase` alternatif memanggil SDK Auth dan `jwt_custom_claims` (`authService.ts:313`); bukan jalur auth frontend yang aktif pada port 5174.

### Dokumen, generator, verifikasi

- [StagingDokumenService.getDocuments:54](../../src/products/hub/dokumen-saya/dokumenService.ts:54) → API → SDK tiga tabel (`:111`) → docsStore (`:246`). Error auth tertentu dilempar; fallback tidak berlaku seragam untuk semua error. Perizinan memanggil `apiOnly` melalui `loadPerizinan`, sehingga list tidak menggunakan fallback SDK/client, tetapi handler server tetap punya fallback fixtures bila ketiga tabel kosong (`api/dokumen.ts:405`).
- Writer `createDocument`, `updateDocStatus`, `deleteDocument` (`dokumenService.ts:305`, `:395`, `:453`) mempunyai jalur API dan fallback docsStore. Handler create memasukkan **barang ke `ptv_surat_barang`, selain itu ke `ptv_surat_tugas`** (`api/dokumen.ts:750`, `:768`). Tidak ditemukan INSERT langsung ke `ptv_surat_izin` dalam handler create ini. Beberapa error SQL dicatat lalu alur tetap membentuk dokumen respons; respons sukses sendiri bukan bukti persistensi.
- Tabel dinamis update/delete di `api/dokumen.ts:467`/`:607`: prefix `st_` → `ptv_surat_tugas`; `sbb_` → `ptv_surat_barang`; selain itu → `ptv_surat_izin`. Approval mencoba `approve_ptv_document_atomic` (`:482`), lalu memiliki jalur update/fallback. SQL proposal lokal juga menyebut `ptv_issued_letter_registry` dan `ptv_notifications`, tetapi penerapan proposal/versi function cloud tidak diverifikasi.
- Generator [GeneratorSuratPage.tsx:272](../../src/products/hub/surat/generator/GeneratorSuratPage.tsx:272) memuat CSV eksternal; ada fixtures santri. `handleConfirmPublish` memanggil `requestDoc` dari `useDocsStore`, bukan `dokumenService.createDocument`. [docsStore.ts:77](../../src/products/hub/dokumen-saya/docsStore.ts:77) menyimpan dokumen lokal; `save` (`:44`) menulis localStorage. Pemeriksaan nomor memakai dokumenService, sehingga Generator tidak boleh diklasifikasikan “sepenuhnya tanpa DB” maupun “publish cloud”.
- Verifikasi Surat aktif memakai [publicDocumentService.ts:8](../../src/products/verification/publicDocumentService.ts:8) → [api/verifikasi-surat.ts:37](../../api/verifikasi-surat.ts:37): `SI` → izin, `ST` → tugas, `SBB/SB` → barang. Hanya SELECT `nomor_surat,status`; tanpa fallback docsStore pada endpoint ini. Fungsi verifikasi dokumen lokal di `verificationService.ts` bukan reader halaman publik aktif.
- Verifikasi Identitas → [VerifikasiIdentitasPage.tsx:39](../../src/products/verification/VerifikasiIdentitasPage.tsx:39) menginisialisasi crewStore, lalu [verifyCrew:345](../../src/products/verification/verificationService.ts:345) membaca store sinkron. Penugasan aktif membaca docsStore dengan fallback `INITIAL_DOCS_FIXTURES` (`:124`). Ini bukan endpoint verifikasi identitas publik tersendiri dan bukan bukti query anonim berhasil.

### Keuangan

- [index.ts:4](../../src/products/hub/keuangan/index.ts:4) mengekspor **FinancePage sebagai KeuanganPage**. Router menggunakan ekspor ini, bukan file `KeuanganPage.tsx` lama. [FinancePage.tsx:78](../../src/products/hub/keuangan/FinancePage.tsx:78) memanggil `loadFinance`; [financeFoundation.ts:35](../../src/products/hub/keuangan/financeFoundation.ts:35) GET `/api/finance`.
- [api/finance.ts:19](../../api/finance.ts:19), `readFinance`: `rpc_finance_visible_transactions_server`, SELECT legacy staging `ptv_kas_kru`, `ptv_pemasukan`, `ptv_pengeluaran`, `ptv_keuangan`, serta canonical pockets/transactions/categories/allocations/source_references (`:29`–`:98`). Istilah legacy di sini menunjuk tabel dalam target staging, bukan koneksi production lama.
- [financeCanonicalService.ts:30](../../src/products/hub/keuangan/financeCanonicalService.ts:30) POST API untuk submit transaksi, create/update/archive kantong, kategori, update/void transaksi. Handler memakai `rpc_post_finance_transaction_server` (`api/finance.ts:276`), `rpc_finance_admin_mutation_server` (`:312`), `rpc_void_finance_transaction_atomic` (`:333`). SQL lokal admin menulis pockets/categories/transactions dan `ptv_finance_audit_log` (`docs/PTVPRO-FINANCE-151-ADMIN-RPC.sql:15`–`:89`); ledger source juga menyebut allocations. Deployment function tersebut belum diperiksa.
- Helper `financeBackendUrl` memaksa ref staging, kecuali test harness localhost `55441`. Tidak ada fallback otomatis ke production lama.
- **Jalur operasional yang ada tetapi dibatasi:** `financeOperationalCloudService.ts` mengandung SELECT/UPSERT/INSERT terhadap `ptv_finance_semesters`, `ptv_finance_kas_records`, `ptv_finance_kas_payments`, `ptv_finance_loans`, `ptv_finance_loan_payments`, `ptv_finance_settings`. `FinancePage.tsx:105` menahan tab kas-kru/piutang/laporan/pengaturan di luar test; `financeRuntimeSafety.ts:3` membatasi fixture runtime ke `MODE=test`. Jangan menganggap seluruh adapter ini aktif pada halaman staging hanya karena file tersedia.
- Storage `finance-proofs`: signed URL server (`api/finance.ts:299`); helper upload/signed URL SDK (`financeOperationalCloudService.ts:504`, `:515`, `:549`) juga ada, tetapi tidak ditemukan pemanggilan helper upload/signed URL itu pada file TSX keuangan yang dipindai. Ini dibedakan dari operasi halaman aktif.

### Notifikasi, pencarian, modul lokal

- [NotificationService.getNotifications:76](../../src/products/hub/shell/notificationService.ts:76) SELECT `ptv_notifications` melalui SDK browser, merge cache user-scoped localStorage. `dispatchEventNotification` mencoba `dispatch_smart_notification` (`:217`) dan jalur lokal. [NotificationCenterModal.tsx:68](../../src/products/hub/shell/NotificationCenterModal.tsx:68), `:95`, `:128`, `:148` melakukan update/delete. Tidak ada API cookie khusus notifikasi; adanya auth cookie Vercel tidak membuktikan SDK browser mendapat sesi Supabase native.
- [UniversalSearchModal.tsx:74](../../src/products/hub/shell/UniversalSearchModal.tsx:74) memakai inventarisService saat portal staging, SDK langsung di luar itu, catatanService untuk notes, dan `MOCK_NOTES` pada hasil kosong/error (`:102`). Indeks Kru memakai crewStore (kelompok C). Indeks Acara memakai `ptv_acara_state_v1`/fixtures; Dokumen memakai `ptv_shared_docs_store_v1`/fixtures; Broadcast memakai `ptv_broadcast_announcements_v1`/default (berbeda dari key v2 writer broadcast); Kerusakan memakai `ptv_damage_reports_v1`/fixtures; Lost & Found memakai `ptv_lost_found_items_v1`/fixtures. Indeks-indeks terakhir ini tidak otomatis memanggil service cloud modul asalnya.
- [HaulPage.tsx:14](../../src/products/hub/haul/HaulPage.tsx:14) memakai tanggal target dan perhitungan waktu lokal; tidak ada service DB bisnis.
- [SeoPage.tsx:3](../../src/products/hub/seo/SeoPage.tsx:3) mengimpor `fixtures.ts`; tidak ada request Google Analytics/Search Console atau tabel analytics pada halaman ini.

## 6. Temuan khusus pergantian database

1. **Frontend dan server dapat terpisah targetnya.** Prioritas `SUPABASE_URL` vs `VITE_SUPABASE_URL` tidak seragam. Fallback SDK menambah jalur yang harus dipetakan saat mengganti environment.
2. **Guard project hardcoded tersebar.** Inventaris portal, API Kru/Akses/Finance/Peminjaman/laporan, identity/session/login proof dan reportPersistence mempunyai pengecekan staging. Mengganti env saja tidak menjamin semua modul berfungsi pada project baru.
3. **Cloud read tidak berarti cloud write.** Portal Management dan Broadcast punya DB reader tetapi writer lokal. Generator Surat Izin menulis docsStore lokal. Ketiga kasus ini dibuktikan dari pemanggil UI dan implementasi writer.
4. **Fixture dapat muncul setelah pembacaan database.** Dokumen server mengisi fixtures ketika hasil ketiga tabel kosong; dokumen client punya fallback store; Broadcast fallback default; Universal Search fallback notes; portal fallback katalog. Ini berbeda dari cache data cloud yang pernah berhasil dibaca.
5. **Production lama tidak terbukti aktif di web.** Ref legacy pada metadata Kru, guard API, komentar fixtures, dan label bukan koneksi. Foto WordPress juga bukan koneksi DB lama.
6. **Tabel lintas modul:** inventory/unit/nilai melayani inventaris, valuasi, picker acara/perizinan/pinjaman/kerusakan dan search; surat melayani dokumen, arsip, perizinan, nomor generator, Beranda dan verifikasi; archive Kru/canonical identity melayani Kru, kontak, profil, assignment dan akses; pengumuman melayani Broadcast/Beranda; portal_services melayani root/status/management.
7. **RPC bukan tabel.** Nama dinamis loan RPC dan dokumen table sudah ditelusuri. Fungsi SQL dapat mengakses tabel tambahan, trigger, atau schema privat; daftar deployed dependency tidak bisa dinyatakan lengkap tanpa inspeksi definisi cloud. SQL proposal lokal hanya bukti rancangan implementasi, bukan bukti terpasang.

## 7. Fitur lain, alias, kode lama, dan worker

- **Cache persisten:** `src/core/cache/ptvCache.ts`, `src/shared/hooks/useInstantData.ts`, `src/core/session/sessionStore.ts`. Cache user-scoped localStorage menghidrasi halaman lalu revalidasi service. Ini dapat menampilkan data tanpa request baru pada frame awal; bukan bukti koneksi saat itu dan bukan project database tambahan.
- **Push diagnostics:** `PushDiagnosticsModal.tsx:25` hanya memeriksa Notification/serviceWorker/PushManager dan meminta permission browser (`:47`). Tidak ada penulisan tabel push/subscription dalam komponen ini.
- **Alias:** `/hub` → Beranda; `/preview`, `/preview/living-portal`, `/preview/*` → `/`; `/preview/status-layanan` → `/status-layanan`; `/login*` → login Hub; `/hub/nilai-inventaris`, `catatan-bersama`, `lost-found`, `lapor-kerusakan`, `generator-surat`, `kontakEksternal` → modul canonical; `/hub/id` dan `/hub/pengaturan` → profile. Alias tidak dihitung database/modul baru.
- **Development:** router membuka `/dev-catalog`, `/hub/katalog`, `/dev-arsip`, `/dev-generator-surat`, `/dev-keuangan`, `/dev-haul`, `/dev-seo`, `/dev-broadcast`, `/dev-pengaturan` hanya jika DEV + MODE development + auth kosong/mock. **Tidak aktif pada runtime staging yang teramati.** Auto-auth mock untuk beberapa route tidak membuktikan backend modul ikut mock; service API yang tidak memeriksa mode tetap dapat dipanggil. [router/index.tsx:40](../../src/app/router/index.tsx:40).
- **Implementasi lama:** `src/products/portal/PortalPage.tsx` bukan root route saat ini; `portalCatalog` masih dipakai portal baru sebagai fallback. `KeuanganPage.tsx` lama dan local keuanganStore tidak boleh disamakan dengan halaman canonical yang diekspor index. `PengaturanPage` lama hanya terjangkau dev route; route pengaturan normal redirect profile. ID digital dirender sebagai komponen profil.
- **Worker sinkronisasi:** [cron-sync-worker.mjs:23](../../scripts/cron-sync-worker.mjs:23) memanggil `executeLetterSync` dengan sumber cloud, default dry-run. [sync-legacy-letters.mjs:44](../../scripts/sync-legacy-letters.mjs:44) mengambil URL legacy dari env atau fallback dump SQL WordPress lokal, bukan dari konfigurasi frontend. Kredensial dump tidak dibaca dalam audit ini. Sumber URL worker aktual belum dapat ditentukan tanpa environment worker/dump.
- Worker membaca `ptv_surat_izin`, `ptv_surat_tugas`, `ptv_surat_barang`, `ptv_catatan`, `ptv_pengumuman`, `ptv_ebook` pada client legacy (`sync-legacy-letters.mjs:582`–`:589`); membaca tiga surat/catatan/pengumuman/canonical_identity pada staging (`:621`–`:628`); jalur eksekusi menulis `upsert` ke daftar `syncableTables` literal (`:906`): `ptv_surat_izin`, `ptv_surat_tugas`, `ptv_surat_barang`, `ptv_catatan`, `ptv_pengumuman` (`:911`). `ptv_ebook` diekstrak untuk manifest, tidak termasuk daftar upsert tersebut. Kode worker **mampu mencampur dua database**, tetapi keberadaan worker tidak membuktikan ia berjalan bersama Vite. Tidak ditemukan import worker dari entry app/API yang diperiksa, atau cron pada vercel.json. Script tidak dijalankan.
- Utilitas audit, migrasi, restore, enrollment, dan test di `scripts/` menggunakan Supabase SDK/REST atau PostgreSQL langsung ke staging/legacy/local harness sesuai input. Mereka bukan route aplikasi dan tidak dijalankan. Kehadiran URL di script tidak dihitung sebagai koneksi runtime halaman.

## 8. Validasi laporan dan pekerjaan yang tidak dilakukan

Audit memakai router aktual, caller halaman, service/helper/API, selector environment, reader/writer store, serta pemeriksaan HTTP modul Vite yang hanya mengekstrak field aman. Lampiran berikut menginventarisasi call-site literal Supabase di `src/` dan `api/` untuk memudahkan pemeriksaan ulang; mencakup kode alternatif/test sehingga harus dibaca bersama klasifikasi reachability di atas.

Tidak ada klaim integrasi cloud lulus. Typecheck, lint, unit test, dan build tidak dijalankan karena tidak ada perubahan aplikasi dan request membatasi penulisan ke satu laporan. Tidak ada cleanup kode. Roadmap lama menyebut local mock sebagai auth aktif di bagian peta; runtime yang diperiksa menunjukkan `vercel`. Selisih dicatat di sini tanpa mengubah roadmap sesuai instruksi read-only terbaru.

SESSION HEALTH: 93/100 — Sehat; confidence Tinggi. Scope tetap pemetaan koneksi, operator tetap zidnal, dan batas bukti runtime/cloud dinyatakan eksplisit. Keputusan: audit dapat diserahkan; perubahan implementasi memerlukan scope terpisah.


## 9. Lampiran call-site literal (source, bukan query yang dijalankan)

Operasi `select` setelah mutasi adalah pembacaan hasil mutasi. Bucket storage tidak dihitung tabel bisnis. Nama dinamis, relasi pada string SELECT, dan pemanggil tidak langsung dijelaskan pada bagian 4–7. Fungsi/variabel adalah konteks AST terdekat, sehingga bukan selalu nama method layanan terluar.

| File : baris | Fungsi/konteks | Tabel / RPC / bucket | Operasi pada chain |
|---|---|---|---|
| [api/acara.ts:386](../../api/acara.ts:386) | { data, error } | `ptv_acara` | select |
| [api/acara.ts:471](../../api/acara.ts:471) | { data: idCheck } | `canonical_identity` | select |
| [api/acara.ts:481](../../api/acara.ts:481) | { data: insertedRow, error: errInsert } | `ptv_acara` | insert, select |
| [api/acara.ts:540](../../api/acara.ts:540) | { data: existing, error: errFind } | `ptv_acara` | select |
| [api/acara.ts:552](../../api/acara.ts:552) | { error: errDel } | `ptv_acara` | delete |
| [api/acara.ts:602](../../api/acara.ts:602) | { data: existing, error: errFetch } | `ptv_acara` | select |
| [api/acara.ts:680](../../api/acara.ts:680) | { data: updatedRow, error: errUpdate } | `ptv_acara` | update, select |
| [api/akses.ts:10](../../api/akses.ts:10) | [accounts, identities, members, profiles, overrides, catalog, registry, grants] | `user_account` | select |
| [api/akses.ts:11](../../api/akses.ts:11) | [accounts, identities, members, profiles, overrides, catalog, registry, grants] | `canonical_identity` | select |
| [api/akses.ts:12](../../api/akses.ts:12) | [accounts, identities, members, profiles, overrides, catalog, registry, grants] | `organization_membership` | select |
| [api/akses.ts:13](../../api/akses.ts:13) | [accounts, identities, members, profiles, overrides, catalog, registry, grants] | `account_profiles` | select |
| [api/akses.ts:14](../../api/akses.ts:14) | [accounts, identities, members, profiles, overrides, catalog, registry, grants] | `account_capability_overrides` | select |
| [api/akses.ts:15](../../api/akses.ts:15) | [accounts, identities, members, profiles, overrides, catalog, registry, grants] | `access_profile` | select |
| [api/akses.ts:16](../../api/akses.ts:16) | [accounts, identities, members, profiles, overrides, catalog, registry, grants] | `capability_registry` | select |
| [api/akses.ts:17](../../api/akses.ts:17) | [accounts, identities, members, profiles, overrides, catalog, registry, grants] | `profile_capabilities` | select |
| [api/akses.ts:54](../../api/akses.ts:54) | result | `auth_audit_log` | select |
| [api/akses.ts:75](../../api/akses.ts:75) | { data, error } | `rpc_manage_account_access` | RPC |
| [api/auth/_utils/identity.ts:26](../../api/auth/_utils/identity.ts:26) | registry | `capability_registry` | select |
| [api/auth/_utils/identity.ts:240](../../api/auth/_utils/identity.ts:240) | { data: credentialRow, error: credError } | `auth_credentials` | select |
| [api/auth/_utils/identity.ts:293](../../api/auth/_utils/identity.ts:293) | { data: profileRows } | `account_profiles` | select |
| [api/auth/_utils/identity.ts:301](../../api/auth/_utils/identity.ts:301) | { data: capRows } | `account_capability_overrides` | select |
| [api/auth/_utils/identity.ts:445](../../api/auth/_utils/identity.ts:445) | { data, error } | `user_account` | select |
| [api/auth/_utils/identity.ts:489](../../api/auth/_utils/identity.ts:489) | { data, error } | `auth_credentials` | select |
| [api/auth/_utils/identity.ts:565](../../api/auth/_utils/identity.ts:565) | { data: conflictCred, error: conflictErr } | `auth_credentials` | select |
| [api/auth/_utils/liveAccess.ts:15](../../api/auth/_utils/liveAccess.ts:15) | account | `user_account` | select |
| [api/auth/_utils/liveAccess.ts:24](../../api/auth/_utils/liveAccess.ts:24) | [identity, membership, profiles, overrides] | `canonical_identity` | select |
| [api/auth/_utils/liveAccess.ts:25](../../api/auth/_utils/liveAccess.ts:25) | [identity, membership, profiles, overrides] | `organization_membership` | select |
| [api/auth/_utils/liveAccess.ts:26](../../api/auth/_utils/liveAccess.ts:26) | [identity, membership, profiles, overrides] | `account_profiles` | select |
| [api/auth/_utils/liveAccess.ts:27](../../api/auth/_utils/liveAccess.ts:27) | [identity, membership, profiles, overrides] | `account_capability_overrides` | select |
| [api/auth/_utils/liveAccess.ts:33](../../api/auth/_utils/liveAccess.ts:33) | grants | `profile_capabilities` | select |
| [api/auth/_utils/loginProof.ts:13](../../api/auth/_utils/loginProof.ts:13) | credential | `auth_credentials` | select |
| [api/auth/_utils/loginProof.ts:18](../../api/auth/_utils/loginProof.ts:18) | result | `rpc_portal_google_session` | RPC |
| [api/auth/_utils/loginProof.ts:23](../../api/auth/_utils/loginProof.ts:23) | audit | `auth_audit_log` | insert |
| [api/auth/_utils/portalLifecycle.ts:29](../../api/auth/_utils/portalLifecycle.ts:29) | result | `rpc_portal_session_valid` | RPC |
| [api/auth/_utils/portalLifecycle.ts:60](../../api/auth/_utils/portalLifecycle.ts:60) | begin | `rpc_portal_login_begin` | RPC |
| [api/auth/_utils/portalLifecycle.ts:79](../../api/auth/_utils/portalLifecycle.ts:79) | registry | `capability_registry` | select |
| [api/auth/_utils/portalLifecycle.ts:89](../../api/auth/_utils/portalLifecycle.ts:89) | finish | `rpc_portal_login_finish` | RPC |
| [api/auth/logout.ts:15](../../api/auth/logout.ts:15) | result | `rpc_portal_session_revoke` | RPC |
| [api/broadcast.ts:151](../../api/broadcast.ts:151) | { data, error } | `ptv_pengumuman` | select |
| [api/broadcast.ts:160](../../api/broadcast.ts:160) | fallbackRes | `ptv_pengumuman` | select |
| [api/catatan.ts:203](../../api/catatan.ts:203) | { data, error } | `ptv_catatan` | select |
| [api/catatan.ts:268](../../api/catatan.ts:268) | { data: inserted, error: insertErr } | `ptv_catatan` | insert, select |
| [api/catatan.ts:329](../../api/catatan.ts:329) | { data: existing, error: errFind } | `ptv_catatan` | select |
| [api/catatan.ts:341](../../api/catatan.ts:341) | { error: errDel } | `ptv_catatan` | delete |
| [api/catatan.ts:376](../../api/catatan.ts:376) | { data: existing, error: errFind } | `ptv_catatan` | select |
| [api/catatan.ts:431](../../api/catatan.ts:431) | { data: updated, error: errUpdate } | `ptv_catatan` | update, select |
| [api/crewPhase1Adapter.ts:18](../../api/crewPhase1Adapter.ts:18) | identities | `canonical_identity` | select |
| [api/crewPhase1Adapter.ts:35](../../api/crewPhase1Adapter.ts:35) | memberships | `organization_membership` | select |
| [api/crewPhase1Adapter.ts:37](../../api/crewPhase1Adapter.ts:37) | accounts | `user_account` | select |
| [api/crewPhase1Adapter.ts:40](../../api/crewPhase1Adapter.ts:40) | profiles | `account_profiles` | select |
| [api/dokumen.ts:388](../../api/dokumen.ts:388) | [resIzin, resTugas, resBarang] | `ptv_surat_izin` | select |
| [api/dokumen.ts:389](../../api/dokumen.ts:389) | [resIzin, resTugas, resBarang] | `ptv_surat_tugas` | select |
| [api/dokumen.ts:390](../../api/dokumen.ts:390) | [resIzin, resTugas, resBarang] | `ptv_surat_barang` | select |
| [api/dokumen.ts:482](../../api/dokumen.ts:482) | { data: atomicRes, error: rpcErr } | `approve_ptv_document_atomic` | RPC |
| [api/dokumen.ts:750](../../api/dokumen.ts:750) | { error: insErr } | `ptv_surat_barang` | insert |
| [api/dokumen.ts:768](../../api/dokumen.ts:768) | { error: insErr } | `ptv_surat_tugas` | insert |
| [api/finance.ts:19](../../api/finance.ts:19) | initialScope | `rpc_finance_visible_transactions_server` | RPC |
| [api/finance.ts:29](../../api/finance.ts:29) | kasQuery | `ptv_kas_kru` | select |
| [api/finance.ts:49](../../api/finance.ts:49) | [income, expense, ledger] | `ptv_pemasukan` | select |
| [api/finance.ts:50](../../api/finance.ts:50) | [income, expense, ledger] | `ptv_pengeluaran` | select |
| [api/finance.ts:51](../../api/finance.ts:51) | [income, expense, ledger] | `ptv_keuangan` | select |
| [api/finance.ts:65](../../api/finance.ts:65) | [pocketsRes, txRes, catRes] | `ptv_finance_pockets` | select |
| [api/finance.ts:66](../../api/finance.ts:66) | [pocketsRes, txRes, catRes] | `ptv_finance_transactions` | select |
| [api/finance.ts:67](../../api/finance.ts:67) | [pocketsRes, txRes, catRes] | `ptv_finance_categories` | select |
| [api/finance.ts:75](../../api/finance.ts:75) | scope | `rpc_finance_visible_transactions_server` | RPC |
| [api/finance.ts:97](../../api/finance.ts:97) | [allocRes, srcRes] | `ptv_finance_allocations` | select |
| [api/finance.ts:98](../../api/finance.ts:98) | [allocRes, srcRes] | `ptv_finance_source_references` | select |
| [api/finance.ts:276](../../api/finance.ts:276) | { data, error } | `rpc_post_finance_transaction_server` | RPC |
| [api/finance.ts:298](../../api/finance.ts:298) | { data: signData, error: signError } | `finance-proofs` | createSignedUrl |
| [api/finance.ts:312](../../api/finance.ts:312) | { data, error } | `rpc_finance_admin_mutation_server` | RPC |
| [api/finance.ts:333](../../api/finance.ts:333) | { data: rpcData, error: rpcErr } | `rpc_void_finance_transaction_atomic` | RPC |
| [api/financeAccess.ts:8](../../api/financeAccess.ts:8) | account | `user_account` | select |
| [api/financeAccess.ts:15](../../api/financeAccess.ts:15) | [members, profiles, overrides, identityRec] | `organization_membership` | select |
| [api/financeAccess.ts:16](../../api/financeAccess.ts:16) | [members, profiles, overrides, identityRec] | `account_profiles` | select |
| [api/financeAccess.ts:17](../../api/financeAccess.ts:17) | [members, profiles, overrides, identityRec] | `account_capability_overrides` | select |
| [api/financeAccess.ts:18](../../api/financeAccess.ts:18) | [members, profiles, overrides, identityRec] | `canonical_identity` | select |
| [api/financeAccess.ts:28](../../api/financeAccess.ts:28) | crewRes | `legacy_archive_kru` | select |
| [api/financeAccess.ts:36](../../api/financeAccess.ts:36) | grants | `profile_capabilities` | select |
| [api/inventaris.ts:100](../../api/inventaris.ts:100) | result | `auth_audit_log` | insert |
| [api/inventaris.ts:117](../../api/inventaris.ts:117) | handler | `ptv_inventaris` | select |
| [api/inventaris.ts:119](../../api/inventaris.ts:119) | rows | `ptv_inventaris` | select |
| [api/inventaris.ts:124](../../api/inventaris.ts:124) | handler | `ptv_inventaris` | select |
| [api/inventaris.ts:125](../../api/inventaris.ts:125) | handler | `ptv_inventaris_unit` | select |
| [api/inventaris.ts:130](../../api/inventaris.ts:130) | rows | `ptv_inventaris` | select |
| [api/inventaris.ts:144](../../api/inventaris.ts:144) | handler | `inventory` | upload |
| [api/inventaris.ts:146](../../api/inventaris.ts:146) | handler | `inventory` | getPublicUrl |
| [api/inventaris.ts:159](../../api/inventaris.ts:159) | existing | `ptv_inventaris` | select |
| [api/inventaris.ts:180](../../api/inventaris.ts:180) | item | `ptv_inventaris` | select |
| [api/inventaris.ts:189](../../api/inventaris.ts:189) | handler | `ptv_nilai_inventaris` | upsert, select |
| [api/inventaris.ts:197](../../api/inventaris.ts:197) | removed | `ptv_nilai_inventaris` | delete, select |
| [api/kontak.ts:198](../../api/kontak.ts:198) | { data: rows, error: qErr } | `ptv_kontak_eksternal` | select |
| [api/kontak.ts:245](../../api/kontak.ts:245) | { data: crewRows, error: cErr } | `legacy_archive_kru` | select |
| [api/kontak.ts:432](../../api/kontak.ts:432) | { data: createdRow, error: insErr } | `ptv_kontak_eksternal` | insert, select |
| [api/kontak.ts:503](../../api/kontak.ts:503) | { data: existing, error: findErr } | `ptv_kontak_eksternal` | select |
| [api/kontak.ts:551](../../api/kontak.ts:551) | { data: updatedRow, error: upErr } | `ptv_kontak_eksternal` | update, select |
| [api/kontak.ts:628](../../api/kontak.ts:628) | { data: existing, error: findErr } | `ptv_kontak_eksternal` | select |
| [api/kontak.ts:656](../../api/kontak.ts:656) | { error: delErr } | `ptv_kontak_eksternal` | delete |
| [api/kru.ts:17](../../api/kru.ts:17) | accounts | `user_account` | select |
| [api/kru.ts:164](../../api/kru.ts:164) | { data: rows, error: queryErr } | `legacy_archive_kru` | select |
| [api/kru.ts:229](../../api/kru.ts:229) | { data: histRows } | `ptv_login_history` | select |
| [api/kru.ts:282](../../api/kru.ts:282) | { data: ptvRows, error: sequenceError } | `legacy_archive_kru` | select |
| [api/kru.ts:299](../../api/kru.ts:299) | { data: existingPtv, error: duplicateError } | `legacy_archive_kru` | select |
| [api/kru.ts:372](../../api/kru.ts:372) | { data: createdRow, error: insertErr } | `legacy_archive_kru` | insert, select |
| [api/kru.ts:429](../../api/kru.ts:429) | query | `legacy_archive_kru` | select |
| [api/kru.ts:501](../../api/kru.ts:501) | linkedAccounts | `user_account` | select |
| [api/kru.ts:504](../../api/kru.ts:504) | roots | `account_profiles` | select |
| [api/kru.ts:509](../../api/kru.ts:509) | result | `rpc_update_crew_personnel` | RPC |
| [api/kru.ts:534](../../api/kru.ts:534) | updateQuery | `legacy_archive_kru` | update |
| [api/lapor-kerusakan.ts:129](../../api/lapor-kerusakan.ts:129) | { data: invItems, error: invError } | `ptv_inventaris` | select |
| [api/lapor-kerusakan.ts:134](../../api/lapor-kerusakan.ts:134) | { data: units, error: unitsError } | `ptv_inventaris_unit` | select |
| [api/lapor-kerusakan.ts:140](../../api/lapor-kerusakan.ts:140) | { data: canonicalReports, error: errCanon } | `ptv_lapor_masalah` | select |
| [api/lapor-kerusakan.ts:163](../../api/lapor-kerusakan.ts:163) | { data: historicalRows, error: errHist } | `legacy_archive_unresolved` | select |
| [api/loanPersistence.ts:12](../../api/loanPersistence.ts:12) | { data, error } | `rpc_loans_can_read_server` | RPC |
| [api/lost-found.ts:124](../../api/lost-found.ts:124) | { data: dbItems, error: errDb } | `ptv_lost_found` | select |
| [api/peminjaman.ts:135](../../api/peminjaman.ts:135) | { data: invItems, error: invError } | `ptv_inventaris` | select |
| [api/peminjaman.ts:141](../../api/peminjaman.ts:141) | { data: unitItems, error: unitError } | `ptv_inventaris_unit` | select |
| [api/peminjaman.ts:148](../../api/peminjaman.ts:148) | { data: canonicalLoans, error: errCanon } | `ptv_peminjaman` | select |
| [api/peminjaman.ts:172](../../api/peminjaman.ts:172) | { data: historicalRows, error: errHist } | `legacy_archive_unresolved` | select |
| [api/planner.ts:169](../../api/planner.ts:169) | { data, error } | `ptv_content_planner` | select |
| [api/planner.ts:247](../../api/planner.ts:247) | { data, error } | `ptv_content_planner` | insert, select |
| [api/planner.ts:284](../../api/planner.ts:284) | { data: existing, error: findError } | `ptv_content_planner` | select |
| [api/planner.ts:354](../../api/planner.ts:354) | { data: updated, error: updateError } | `ptv_content_planner` | update, select |
| [api/planner.ts:392](../../api/planner.ts:392) | { data: existing, error: findError } | `ptv_content_planner` | select |
| [api/planner.ts:404](../../api/planner.ts:404) | { error: deleteError } | `ptv_content_planner` | delete |
| [api/reportPersistence.ts:6](../../api/reportPersistence.ts:6) | { data, error } | `rpc_report_can_read` | RPC |
| [api/reportPersistence.ts:47](../../api/reportPersistence.ts:47) | { data, error } | `rpc_write_report_server` | RPC |
| [src/core/auth/authService.ts:313](../../src/core/auth/authService.ts:313) | { data: claims, error: rpcError } | `jwt_custom_claims` | RPC |
| [src/products/hub/acara/acaraService.ts:189](../../src/products/hub/acara/acaraService.ts:189) | { data, error } | `ptv_acara` | select |
| [src/products/hub/catatan/catatanService.ts:117](../../src/products/hub/catatan/catatanService.ts:117) | { data, error } | `ptv_catatan` | select |
| [src/products/hub/dokumen-saya/dokumenService.ts:111](../../src/products/hub/dokumen-saya/dokumenService.ts:111) | [resIzin, resTugas, resBarang] | `ptv_surat_izin` | select |
| [src/products/hub/dokumen-saya/dokumenService.ts:112](../../src/products/hub/dokumen-saya/dokumenService.ts:112) | [resIzin, resTugas, resBarang] | `ptv_surat_tugas` | select |
| [src/products/hub/dokumen-saya/dokumenService.ts:113](../../src/products/hub/dokumen-saya/dokumenService.ts:113) | [resIzin, resTugas, resBarang] | `ptv_surat_barang` | select |
| [src/products/hub/inventaris/inventarisService.ts:1085](../../src/products/hub/inventaris/inventarisService.ts:1085) | query | `ptv_inventaris` | select |
| [src/products/hub/inventaris/inventarisService.ts:1232](../../src/products/hub/inventaris/inventarisService.ts:1232) | query | `ptv_inventaris` | select |
| [src/products/hub/inventaris/inventarisService.ts:1377](../../src/products/hub/inventaris/inventarisService.ts:1377) | { data, error } | `rpc_get_next_inv_code` | RPC |
| [src/products/hub/inventaris/inventarisService.ts:1386](../../src/products/hub/inventaris/inventarisService.ts:1386) | { data: rows } | `ptv_inventaris` | select |
| [src/products/hub/inventaris/inventarisService.ts:1417](../../src/products/hub/inventaris/inventarisService.ts:1417) | { data: existing, error: existingErr } | `ptv_inventaris` | select |
| [src/products/hub/inventaris/inventarisService.ts:1540](../../src/products/hub/inventaris/inventarisService.ts:1540) | { data: reconciled } | `ptv_inventaris` | select |
| [src/products/hub/inventaris/inventarisService.ts:1565](../../src/products/hub/inventaris/inventarisService.ts:1565) | { data: rpcData, error: rpcError } | `rpc_create_inventaris` | RPC |
| [src/products/hub/inventaris/inventarisService.ts:1701](../../src/products/hub/inventaris/inventarisService.ts:1701) | { error: rpcError } | `rpc_update_inventaris` | RPC |
| [src/products/hub/inventaris/inventarisService.ts:1786](../../src/products/hub/inventaris/inventarisService.ts:1786) | { error } | `ptv_inventaris_unit` | update |
| [src/products/hub/inventaris/inventarisService.ts:1820](../../src/products/hub/inventaris/inventarisService.ts:1820) | { error } | `ptv_nilai_inventaris` | upsert |
| [src/products/hub/inventaris/inventarisService.ts:1835](../../src/products/hub/inventaris/inventarisService.ts:1835) | { error } | `ptv_nilai_inventaris` | delete |
| [src/products/hub/inventaris/inventarisService.ts:2015](../../src/products/hub/inventaris/inventarisService.ts:2015) | { error } | `ptv_inventaris` | select |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:73](../../src/products/hub/keuangan/financeOperationalCloudService.ts:73) | [semRes, kasRes, kasPayRes, loansRes, payRes, setRes] | `ptv_finance_semesters` | select |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:74](../../src/products/hub/keuangan/financeOperationalCloudService.ts:74) | [semRes, kasRes, kasPayRes, loansRes, payRes, setRes] | `ptv_finance_kas_records` | select |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:75](../../src/products/hub/keuangan/financeOperationalCloudService.ts:75) | [semRes, kasRes, kasPayRes, loansRes, payRes, setRes] | `ptv_finance_kas_payments` | select |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:76](../../src/products/hub/keuangan/financeOperationalCloudService.ts:76) | [semRes, kasRes, kasPayRes, loansRes, payRes, setRes] | `ptv_finance_loans` | select |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:77](../../src/products/hub/keuangan/financeOperationalCloudService.ts:77) | [semRes, kasRes, kasPayRes, loansRes, payRes, setRes] | `ptv_finance_loan_payments` | select |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:78](../../src/products/hub/keuangan/financeOperationalCloudService.ts:78) | [semRes, kasRes, kasPayRes, loansRes, payRes, setRes] | `ptv_finance_settings` | select |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:148](../../src/products/hub/keuangan/financeOperationalCloudService.ts:148) | { data, error } | `ptv_finance_semesters` | select |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:170](../../src/products/hub/keuangan/financeOperationalCloudService.ts:170) | { error } | `ptv_finance_semesters` | upsert |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:186](../../src/products/hub/keuangan/financeOperationalCloudService.ts:186) | query | `ptv_finance_kas_records` | select |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:217](../../src/products/hub/keuangan/financeOperationalCloudService.ts:217) | { error } | `ptv_finance_kas_records` | upsert |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:241](../../src/products/hub/keuangan/financeOperationalCloudService.ts:241) | [loansRes, paymentsRes] | `ptv_finance_loans` | select |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:242](../../src/products/hub/keuangan/financeOperationalCloudService.ts:242) | [loansRes, paymentsRes] | `ptv_finance_loan_payments` | select |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:294](../../src/products/hub/keuangan/financeOperationalCloudService.ts:294) | { error } | `ptv_finance_loans` | upsert |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:323](../../src/products/hub/keuangan/financeOperationalCloudService.ts:323) | { error } | `ptv_finance_loan_payments` | insert |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:338](../../src/products/hub/keuangan/financeOperationalCloudService.ts:338) | { data, error } | `ptv_finance_settings` | select |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:361](../../src/products/hub/keuangan/financeOperationalCloudService.ts:361) | { error } | `ptv_finance_settings` | upsert |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:503](../../src/products/hub/keuangan/financeOperationalCloudService.ts:503) | { error: uploadError } | `finance-proofs` | upload |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:514](../../src/products/hub/keuangan/financeOperationalCloudService.ts:514) | { data: signedData, error: signError } | `finance-proofs` | createSignedUrl |
| [src/products/hub/keuangan/financeOperationalCloudService.ts:548](../../src/products/hub/keuangan/financeOperationalCloudService.ts:548) | { data, error } | `finance-proofs` | createSignedUrl |
| [src/products/hub/kontak/kontakService.ts:70](../../src/products/hub/kontak/kontakService.ts:70) | { data, error } | `ptv_kontak_eksternal` | select |
| [src/products/hub/kontak/kontakService.ts:150](../../src/products/hub/kontak/kontakService.ts:150) | { data: crewRows, error: cErr } | `legacy_archive_kru` | select |
| [src/products/hub/kontak/kontakService.ts:292](../../src/products/hub/kontak/kontakService.ts:292) | { data: createdRow, error } | `ptv_kontak_eksternal` | insert, select |
| [src/products/hub/kontak/kontakService.ts:350](../../src/products/hub/kontak/kontakService.ts:350) | { data: updatedRow, error } | `ptv_kontak_eksternal` | update, select |
| [src/products/hub/kontak/kontakService.ts:399](../../src/products/hub/kontak/kontakService.ts:399) | { error } | `ptv_kontak_eksternal` | delete |
| [src/products/hub/peminjaman/stagingPeminjamanService.ts:96](../../src/products/hub/peminjaman/stagingPeminjamanService.ts:96) | checkoutLoan | `rpc_checkout_loan` | RPC |
| [src/products/hub/peminjaman/stagingPeminjamanService.ts:106](../../src/products/hub/peminjaman/stagingPeminjamanService.ts:106) | returnLoan | `rpc_return_loan` | RPC |
| [src/products/hub/peminjaman/stagingPeminjamanService.ts:119](../../src/products/hub/peminjaman/stagingPeminjamanService.ts:119) | returnSingleLoan | `rpc_return_single_unit` | RPC |
| [src/products/hub/portal-management/services/portalManagementService.ts:213](../../src/products/hub/portal-management/services/portalManagementService.ts:213) | { data, error } | `ptv_portal_services` | select |
| [src/products/hub/reportPersistence.ts:27](../../src/products/hub/reportPersistence.ts:27) | request | `rpc_write_report` | RPC |
| [src/products/hub/shell/NotificationCenterModal.tsx:68](../../src/products/hub/shell/NotificationCenterModal.tsx:68) | query | `ptv_notifications` | update |
| [src/products/hub/shell/NotificationCenterModal.tsx:95](../../src/products/hub/shell/NotificationCenterModal.tsx:95) | delQuery | `ptv_notifications` | delete |
| [src/products/hub/shell/NotificationCenterModal.tsx:128](../../src/products/hub/shell/NotificationCenterModal.tsx:128) | handleDeleteSingle | `ptv_notifications` | delete |
| [src/products/hub/shell/NotificationCenterModal.tsx:147](../../src/products/hub/shell/NotificationCenterModal.tsx:147) | handleOpenDetail | `ptv_notifications` | update |
| [src/products/hub/shell/notificationService.ts:83](../../src/products/hub/shell/notificationService.ts:83) | { data, error } | `ptv_notifications` | select |
| [src/products/hub/shell/notificationService.ts:217](../../src/products/hub/shell/notificationService.ts:217) | { error: rpcErr } | `dispatch_smart_notification` | RPC |
| [src/products/hub/shell/UniversalSearchModal.tsx:81](../../src/products/hub/shell/UniversalSearchModal.tsx:81) | { data } | `ptv_inventaris` | select |
