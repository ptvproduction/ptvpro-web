import { describe, it, expect, beforeEach } from 'vitest';
import {
  ptvNormalizeCrewId,
  cleanDocNumber,
  formatIdDate,
  verifyDocument,
  verifyCrew,
  getActiveAssignmentForCrew,
  buildOfficialDocVerificationUrl,
  buildOfficialCrewVerificationUrl,
  buildLocalDocVerificationUrl,
  buildLocalCrewVerificationUrl,
  resolveCrewVerificationQrUrl,
} from '../../src/products/verification/verificationService';
import { SIDEBAR_GROUPS } from '../../src/products/hub/shell/HubShell';
import { crewStore } from '../../src/products/hub/kru/kruStore';
import { docsStore } from '../../src/products/hub/dokumen-saya/docsStore';

describe('Portal Verifikasi Publik (Public Verification)', () => {
  beforeEach(() => {
    crewStore.resetToFixtures();
    docsStore.requestDoc({
      id: 'doc-101',
      no: '042/ST-PTV/X/2026',
      subject: 'Surat Tugas Siaran Langsung Pengajian Akbar Maulid Nabi',
      type: 'Surat Tugas',
      date: '2026-10-12',
      start_date: '2026-10-12',
      end_date: '2026-10-12',
      owner: 'M. Zidna Ilma Roup',
      pembawa: 'M. Zidna Ilma Roup',
      penanggung_jawab: 'Dr. H. Ahmad Musthofa, M.Pd.',
      recipients: ['M. Zidna Ilma Roup', 'Rizky Alamsyah'],
      status: 'Disetujui',
    });
    docsStore.requestDoc({
      id: 'doc-103',
      no: '038/SI-PTV/IX/2026',
      subject: 'Surat Izin Pengambilan Dokumentasi Laboratorium Bahasa',
      type: 'Surat Izin Santri',
      date: '2026-09-28',
      owner: 'Muhammad Dimas Prayoga',
      status: 'Disetujui',
    });
    docsStore.requestDoc({
      id: 'doc-104',
      no: '—',
      subject: 'Pengajuan Surat Tugas Liputan Karnaval Santri Sidoarjo',
      type: 'Surat Tugas',
      date: '2026-10-16',
      owner: 'Bagus Setiawan',
      status: 'Revisi',
      review_note: 'Mohon tambahkan minimal 1 personel kamera pendamping dan rincian rundown peliputan karnaval.',
    });
  });

  describe('1. Normalisasi Smart Crew ID (Legacy Parity)', () => {
    it('harus menormalisasi angka tunggal ke format PTV-00X', () => {
      expect(ptvNormalizeCrewId('1')).toBe('PTV-001');
      expect(ptvNormalizeCrewId('2')).toBe('PTV-002');
      expect(ptvNormalizeCrewId('9')).toBe('PTV-009');
    });

    it('harus menormalisasi angka puluhan dan ratusan', () => {
      expect(ptvNormalizeCrewId('25')).toBe('PTV-025');
      expect(ptvNormalizeCrewId('10')).toBe('PTV-010');
      expect(ptvNormalizeCrewId('881')).toBe('PTV-881');
    });

    it('harus menangani awalan PTV dan huruf kecil secara toleran', () => {
      expect(ptvNormalizeCrewId('ptv-1')).toBe('PTV-001');
      expect(ptvNormalizeCrewId('ptv-25')).toBe('PTV-025');
      expect(ptvNormalizeCrewId('PTV-010')).toBe('PTV-010');
      expect(ptvNormalizeCrewId('PTV-PTV-025')).toBe('PTV-025');
    });

    it('harus mengembalikan string kosong untuk input kosong', () => {
      expect(ptvNormalizeCrewId('')).toBe('');
      expect(ptvNormalizeCrewId('   ')).toBe('');
    });
  });

  describe('2. Sanitasi & Normalisasi Nomor Surat', () => {
    it('harus membersihkan spasi berlebih dan decode URI component', () => {
      expect(cleanDocNumber('  042/ST-PTV/X/2026  ')).toBe('042/ST-PTV/X/2026');
      expect(cleanDocNumber('042%2FST-PTV%2FX%2F2026')).toBe('042/ST-PTV/X/2026');
      expect(cleanDocNumber('042   /   ST-PTV')).toBe('042 / ST-PTV');
    });
  });

  describe('3. Formatting Tanggal Kalender Indonesia Ramah Lokal', () => {
    it('harus memformat tanggal YYYY-MM-DD ke teks nama hari dan bulan Indonesia', () => {
      expect(formatIdDate('2026-10-12')).toBe('Senin, 12 Oktober 2026');
      expect(formatIdDate('2026-10-17')).toBe('Sabtu, 17 Oktober 2026');
    });

    it('harus menangani string kosong atau rentang tanggal yang sudah diformat', () => {
      expect(formatIdDate('')).toBe('-');
      expect(formatIdDate('—')).toBe('-');
      expect(formatIdDate('12 Okt s.d. 14 Okt 2026')).toBe('12 Okt s.d. 14 Okt 2026');
    });
  });

  describe('4. Keabsahan Dokumen (verifyDocument)', () => {
    it('harus memvalidasi surat tugas yang telah disetujui (Valid)', () => {
      const res = verifyDocument('042/ST-PTV/X/2026');
      expect(res.is_valid).toBe(true);
      expect(res.status).toBe('valid');
      expect(res.status_title).toBe('DOKUMEN VALID');
      expect(res.nomor_surat).toBe('042/ST-PTV/X/2026');
      expect(res.jenis_surat).toBe('Surat Tugas Resmi Kru');
      expect(res.penanggung_jawab).toContain('Musthofa');
      expect(res.recipients.length).toBeGreaterThan(0);
    });

    it('harus memvalidasi surat izin santri yang telah disetujui', () => {
      const res = verifyDocument('038/SI-PTV/IX/2026');
      expect(res.is_valid).toBe(true);
      expect(res.status).toBe('valid');
      expect(res.jenis_surat).toBe('Surat Izin Resmi Santri');
    });

    it('harus menangani dokumen yang memerlukan revisi dengan tepat', () => {
      const res = verifyDocument('doc-104');
      expect(res.is_valid).toBe(false);
      expect(res.status).toBe('revisi');
      expect(res.status_title).toBe('PERLU REVISI');
      expect(res.status_desc).toContain('Mohon tambahkan minimal 1 personel');
    });

    it('harus mengembalikan status tidak ditemukan untuk nomor yang tidak terdaftar', () => {
      const res = verifyDocument('999/INVALID/NOMOR/2026');
      expect(res.is_valid).toBe(false);
      expect(res.status).toBe('tidak_ditemukan');
      expect(res.status_title).toBe('DOKUMEN TIDAK DITEMUKAN');
    });

    it('harus mengembalikan status tidak ditemukan jika query kosong', () => {
      const res = verifyDocument('');
      expect(res.is_valid).toBe(false);
      expect(res.status).toBe('tidak_ditemukan');
    });
  });

  describe('5. Verifikasi Identitas Kru & Proteksi Privasi (verifyCrew)', () => {
    it('harus memverifikasi identitas kru aktif berdasarkan PTV-ID', () => {
      const res = verifyCrew('PTV-001');
      expect(res.is_found).toBe(true);
      expect(res.crew_id).toBe('PTV-001');
      expect(res.status_kru).toBe('Aktif');
      expect(res.full_name).toBeTruthy();
      expect(res.position).toBeTruthy();
    });

    it('harus mendukung pencarian dengan Smart ID (angka murni)', () => {
      const res = verifyCrew('1');
      expect(res.is_found).toBe(true);
      expect(res.crew_id).toBe('PTV-001');
    });

    it('harus mendukung pencarian dengan nama kru', () => {
      const res = verifyCrew('Zidna');
      expect(res.is_found).toBe(true);
      expect(res.crew_id).toBe('PTV-001');
    });

    it('harus mengembalikan not found untuk kru yang tidak terdaftar', () => {
      const res = verifyCrew('PTV-999');
      expect(res.is_found).toBe(false);
      expect(res.status_kru).toBe('Nonaktif');
    });

    it('PROTEKSI PRIVASI: Tidak boleh mengekspos field sensitif ke publik', () => {
      const res = verifyCrew('PTV-001') as any;
      expect(res.email).toBeUndefined();
      expect(res.password).toBeUndefined();
      expect(res.oauth_email).toBeUndefined();
      expect(res.oauth_uid).toBeUndefined();
      expect(res.username).toBeUndefined();
      expect(res.phone).toBeUndefined();
      expect(res.role).toBeUndefined();
      expect(res.assigned_profiles).toBeUndefined();
      expect(res.allowed_overrides).toBeUndefined();
      expect(res.denied_overrides).toBeUndefined();
    });
  });

  describe('6. Deteksi Surat Tugas Aktif Hari Ini (Active Assignment Matching)', () => {
    it('harus mendeteksi surat tugas aktif jika tanggal hari ini berada dalam rentang penugasan', () => {
      const allCrews = crewStore.getAll();
      const targetCrew = allCrews.find((c) => c.ptv_id === 'PTV-001') || allCrews[0];

      // Surat tugas doc-101 berlaku pada 2026-10-12
      const assignment = getActiveAssignmentForCrew(targetCrew, '2026-10-12');
      expect(assignment).not.toBeNull();
      expect(assignment?.nomor_surat).toBe('042/ST-PTV/X/2026');
      expect(assignment?.is_today_active).toBe(true);
      expect(assignment?.verification_url).toContain('042%2FST-PTV%2FX%2F2026');
    });

    it('tidak boleh menampilkan surat tugas jika tanggal sudah kedaluwarsa atau belum mulai', () => {
      const allCrews = crewStore.getAll();
      const targetCrew = allCrews.find((c) => c.ptv_id === 'PTV-001') || allCrews[0];

      // Tanggal jauh di masa depan
      const assignment = getActiveAssignmentForCrew(targetCrew, '2029-01-01');
      expect(assignment).toBeNull();
    });

    it('tidak boleh menampilkan surat tugas yang belum disahkan (Revisi/Menunggu) sebagai tugas aktif', () => {
      const allCrews = crewStore.getAll();
      const bagus = allCrews.find((c) => c.full_name.includes('Bagus')) || allCrews[0];

      // doc-104 (Bagus Setiawan) berstatus Revisi pada tanggal 2026-10-16
      const assignment = getActiveAssignmentForCrew(bagus, '2026-10-16');
      expect(assignment).toBeNull();
    });
  });

  describe('7. URL Builder & Deep Link Canonical Generator', () => {
    it('harus membentuk URL QR resmi kru tanpa domain legacy ptv.my.id', () => {
      const url = resolveCrewVerificationQrUrl('1');
      expect(url).toContain('/verifikasi-identitas/PTV-001');
      expect(url).not.toContain('ptv.my.id');
      expect(url).not.toContain('progresiftv.id');

      const urlKru = resolveCrewVerificationQrUrl('PTV-025');
      expect(urlKru).toContain('/verifikasi-identitas/PTV-025');
      expect(urlKru).not.toContain('ptv.my.id');
    });

    it('harus membuat URL resmi dokumen untuk publik tanpa localhost', () => {
      const url = buildOfficialDocVerificationUrl('042/ST-PTV/X/2026');
      expect(url).toBe('https://ptvpro.com/verifikasi-surat/042%2FST-PTV%2FX%2F2026');
      expect(url).not.toContain('localhost');
      expect(url).not.toContain('progresiftv.id');
    });

    it('harus membuat URL resmi kru untuk publik tanpa localhost', () => {
      const url = buildOfficialCrewVerificationUrl('1');
      expect(url).toBe('https://ptvpro.com/verifikasi-identitas/PTV-001');
      expect(url).not.toContain('localhost');
      expect(url).not.toContain('progresiftv.id');
    });

    it('harus membuat URL navigasi lokal dokumen secara relatif', () => {
      const url = buildLocalDocVerificationUrl('042/ST-PTV/X/2026');
      expect(url).toBe('/verifikasi-surat/042%2FST-PTV%2FX%2F2026');
    });

    it('harus membuat URL navigasi lokal kru secara relatif', () => {
      const url = buildLocalCrewVerificationUrl('PTV-025');
      expect(url).toBe('/verifikasi-identitas/PTV-025');
    });
  });

  describe('8. Ketahanan Terhadap Trailing Slash & Karakter Khusus', () => {
    it('harus menangani trailing slash pada nomor surat dengan anggun', () => {
      expect(cleanDocNumber('042/ST-PTV/X/2026/')).toBe('042/ST-PTV/X/2026');
      expect(cleanDocNumber('042%2FST-PTV%2FX%2F2026///')).toBe('042/ST-PTV/X/2026');
    });

    it('harus menangani trailing slash pada Crew ID', () => {
      expect(ptvNormalizeCrewId('PTV-001/')).toBe('PTV-001');
      expect(ptvNormalizeCrewId('25/')).toBe('PTV-025');
    });
  });

  describe('9. Tata Kelola Sidebar Navigasi PTV Hub (HubShell)', () => {
    it('harus mengarahkan Keabsahan Dokumen ke same-origin /verifikasi-surat', () => {
      const adminGroup = SIDEBAR_GROUPS.find((g) => g.groupName === 'Administrasi & Verifikasi');
      expect(adminGroup).toBeDefined();

      const docItem = adminGroup?.items.find((i) => i.key === 'verifikasiSurat');
      expect(docItem).toBeDefined();
      expect(docItem?.path).toBe('/verifikasi-surat');
      expect(docItem?.isExternal).toBe(true);
      expect(docItem?.label).toBe('Keabsahan Dokumen');
      expect(docItem?.iconClass).toBe('fa-solid fa-shield-halved');
    });

    it('harus mengarahkan Verifikasi Identitas ke same-origin /verifikasi-identitas', () => {
      const adminGroup = SIDEBAR_GROUPS.find((g) => g.groupName === 'Administrasi & Verifikasi');
      expect(adminGroup).toBeDefined();

      const idItem = adminGroup?.items.find((i) => i.key === 'verifikasiIdentitas');
      expect(idItem).toBeDefined();
      expect(idItem?.path).toBe('/verifikasi-identitas');
      expect(idItem?.isExternal).toBe(true);
      expect(idItem?.label).toBe('Verifikasi Identitas');
      expect(idItem?.iconClass).toBe('fa-solid fa-id-card');
    });

    it('TIDAK BOLEH ada link yang mengarah ke domain legacy progresiftv.id', () => {
      SIDEBAR_GROUPS.forEach((group) => {
        group.items.forEach((item) => {
          expect(item.path).not.toContain('progresiftv.id');
        });
      });
    });
  });

  describe('8. UI Refinement Portal Verifikasi: Header Official Clean Logo', () => {
    it('harus merender logo resmi PTV ptv-logo-white.webp tanpa teks judul di header verifikasi publik', async () => {
      const React = await import('react');
      const { renderToString } = await import('react-dom/server');
      const { MemoryRouter } = await import('react-router-dom');
      const { PublicVerificationHeader } = await import('../../src/products/verification/components/PublicVerificationHeader');

      const element = React.createElement(
        MemoryRouter,
        { initialEntries: ['/verifikasi-surat'] },
        React.createElement(PublicVerificationHeader, null)
      );
      const html = renderToString(element);

      expect(html).toContain('/assets/images/ptv-logo-white.webp');
      expect(html).toContain('pub-brand-logo-img');
      expect(html).toContain('href="/"');
      expect(html).toContain('aria-label="Kembali ke Beranda PTVPRO"');
      expect(html).not.toContain('pub-brand-title');
      expect(html).not.toContain('pub-brand-sub');
      expect(html).not.toContain('pub-brand-divider');
      expect(html).not.toContain('pub-logo-box');
    });
  });

  describe('9. Verifikasi Identitas: Sticky Biodata & Compact Unified Portfolio Card', () => {
    it('harus merender layout split dua kolom, sticky biodata, dan container portofolio terpadu', async () => {
      const React = await import('react');
      const { renderToString } = await import('react-dom/server');
      const { MemoryRouter } = await import('react-router-dom');
      const { VerifikasiIdentitasPage } = await import('../../src/products/verification/VerifikasiIdentitasPage');

      // Panggil halaman dengan crew PTV-001 (M. Zidna Ilma Roup)
      const element = React.createElement(
        MemoryRouter,
        { initialEntries: ['/verifikasi-identitas?id=PTV-001'] },
        React.createElement(VerifikasiIdentitasPage, null)
      );
      const html = renderToString(element);

      // Verifikasi struktur split layout desktop 2-kolom
      expect(html).toContain('pub-crew-split-layout');
      expect(html).toContain('pub-crew-left-col');
      expect(html).toContain('pub-crew-card');
      expect(html).toContain('pub-crew-right-col');

      // Verifikasi biodata kru ter-render
      expect(html).toContain('M. Zidna Ilma Roup');
      expect(html).toContain('PTV-001');

      // Verifikasi header portofolio & filter platform
      expect(html).toContain('pub-portfolio-header-card');
      expect(html).toContain('Portofolio &amp; Rekam Karya Kru');
      expect(html).toContain('role="region"');
      expect(html).toContain('aria-label="Daftar Portofolio dan Rekam Karya Kru"');

      // Verifikasi badge status keanggotaan dan label verifikasi resmi
      expect(html).toContain('pub-status-badge');
      expect(html).toContain('pub-status-dot');
      expect(html).toContain('pub-status-text');
      expect(html).toContain('Anggota Resmi Aktif');
      expect(html).toContain('PTV Verification System');
      expect(html).not.toContain('Server Staging Cloud');
      expect(html).not.toContain('ptv.my.id');
    });

    it('harus memastikan container portofolio kanan bebas dari scroll trap (native CSS chaining)', async () => {
      const fs = await import('node:fs');
      const cssContent = fs.readFileSync('src/styles/publicVerification.css', 'utf-8');

      // Memastikan overscroll-behavior tidak menggunakan contain yang menjebak pointer wheel
      expect(cssContent).not.toMatch(/\.pub-crew-right-col\s*\{[^}]*overscroll-behavior:\s*contain/);
      expect(cssContent).toMatch(/\.pub-crew-right-col\s*\{[^}]*overscroll-behavior-y:\s*auto/);

      // Memastikan tidak ada cursor grab/grabbing buatan
      expect(cssContent).not.toContain('cursor: grab');
      expect(cssContent).not.toContain('cursor: grabbing');
    });
  });

  describe('10. Keabsahan Dokumen: Riwayat Pemeriksaan Dokumen Resmi', () => {
    it('harus memiliki struktur interface dan sanitasi riwayat pemeriksaan dokumen', async () => {
      const { KeabsahanDokumenPage } = await import('../../src/products/verification/KeabsahanDokumenPage');
      const React = await import('react');
      const { renderToString } = await import('react-dom/server');
      const { MemoryRouter } = await import('react-router-dom');

      const element = React.createElement(
        MemoryRouter,
        { initialEntries: ['/keabsahan-dokumen'] },
        React.createElement(KeabsahanDokumenPage, null)
      );
      const html = renderToString(element);

      // Verifikasi komponen form pencarian dokumen resmi ter-render
      expect(html).toContain('Keabsahan Dokumen Resmi');
      expect(html).toContain('pub-formal-search-card');
      expect(html).toContain('Masukkan Nomor Surat Resmi');
    });
  });
});
