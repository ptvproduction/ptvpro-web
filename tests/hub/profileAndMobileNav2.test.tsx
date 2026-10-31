import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { OfficialIdCard } from '@products/hub/id-digital/components/OfficialIdCard';
import { HubShell } from '@products/hub/shell/HubShell';
import { WorkspaceBottomSheet } from '@products/hub/shell/WorkspaceBottomSheet';
import { useSessionStore } from '@core/session';
import { crewStore } from '@products/hub/kru/kruStore';

// Mock localStorage
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe('PTV-DEV-180: Official ID Card & Profile Visual Restoration', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    crewStore.resetToFixtures();
    useSessionStore.setState({
      user: {
        id: 'usr-1',
        ptv_id: 'PTV-001',
        full_name: 'Muhammad Zidnal Falah',
        position: 'Ketua Umum',
        division: 'Layouter',
        status_kru: 'Aktif',
      } as any,
    });
  });

  it('1. OfficialIdCard merender komposisi KTA vertikal dengan logo, QR code, nama tegas, dan grid 4-item', () => {
    const html = renderToString(
      <OfficialIdCard
        fullName="Muhammad Zidnal Falah"
        ptvId="PTV-001"
        position="Ketua Umum"
        division="Layouter"
        status="Aktif"
        fotoUrl={null}
        showActions={true}
      />
    );

    // Header label & logo
    expect(html).toContain('KARTU IDENTITAS RESMI');
    expect(html).toContain('idcard-logo-img');
    expect(html).toContain('/assets/images/ptv-logo-white.webp');

    // QR Code container
    expect(html).toContain('idcard-qr-box');

    // Nama Anggota
    expect(html).toContain('idcard-person-name');
    expect(html).toContain('Muhammad Zidnal Falah');

    // Grid 4-item terpisah (label tidak menempel ke value)
    expect(html).toContain('KRU NO.');
    expect(html).toContain('PTV-001');
    expect(html).toContain('POSITION');
    expect(html).toContain('Ketua Umum');
    expect(html).toContain('DIVISI');
    expect(html).toContain('Layouter');
    expect(html).toContain('STATUS');
    expect(html).toContain('Aktif');

    // Footer strip
    expect(html).toContain('PROGRESIF TV');
    expect(html).toContain('2026–2027');

    // Tombol tindakan
    expect(html).toContain('Unduh Kartu PNG');
  });

  it('2. Status kru Nonaktif diberi warna merah dan Aktif diberi warna hijau', () => {
    const htmlActive = renderToString(
      <OfficialIdCard
        fullName="Fulan"
        ptvId="PTV-099"
        position="Kru"
        division="Technical"
        status="Aktif"
      />
    );
    expect(htmlActive).toContain('color:#4ade80');

    const htmlInactive = renderToString(
      <OfficialIdCard
        fullName="Fulan"
        ptvId="PTV-099"
        position="Kru"
        division="Technical"
        status="Nonaktif"
      />
    );
    expect(htmlInactive).toContain('color:#f87171');
  });

  it('3. Tidak menghasilkan teks mentah menempel seperti STATUSAktif', () => {
    const html = renderToString(
      <OfficialIdCard
        fullName="Muhammad Zidnal Falah"
        ptvId="PTV-001"
        position="Ketua Umum"
        division="Layouter"
        status="Aktif"
      />
    );

    expect(html).toContain('idcard-creds-grid');
    expect(html).toContain('idcard-cred-item');
    expect(html).not.toContain('STATUSAktif');
    expect(html).not.toContain('NOMOR ANGGOTA (PTV-ID)PTV-001');
  });
});

describe('PTV-DEV-180: Mobile Navigation 2.0 & Discover Workspace', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    crewStore.resetToFixtures();
    useSessionStore.setState({
      user: {
        id: 'usr-1',
        ptv_id: 'PTV-001',
        full_name: 'Muhammad Zidnal Falah',
        position: 'Ketua Umum',
        division: 'Layouter',
        status_kru: 'Aktif',
      } as any,
    });
  });

  it('4. Floating dock menampilkan 4 menu utama (Beranda, Acara, Inventaris, Profil) dan tombol Discover', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/hub/beranda']}>
        <HubShell />
      </MemoryRouter>
    );

    expect(html).toContain('ptv-floating-dock');
    expect(html).toContain('ptv-dock-pill');
    expect(html).toContain('data-tab="home"');
    expect(html).toContain('data-tab="acara"');
    expect(html).toContain('data-tab="alat"');
    expect(html).toContain('data-tab="profile"');
    expect(html).toContain('ptv-dock-discover');
    expect(html).toContain('ptv-nav-ambient-gradient');
  });

  it('5. Active state akurat: hanya rute aktif yang ditandai is-active, rute luar 4 menu TIDAK menandai Home', () => {
    // Rute Beranda -> Home aktif
    const htmlBeranda = renderToString(
      <MemoryRouter initialEntries={['/hub/beranda']}>
        <HubShell />
      </MemoryRouter>
    );
    expect(htmlBeranda).toContain('ptv-dock-item is-active" data-tab="home"');
    expect(htmlBeranda).not.toContain('ptv-dock-item is-active" data-tab="acara"');

    // Rute Acara -> Acara aktif
    const htmlAcara = renderToString(
      <MemoryRouter initialEntries={['/hub/acara']}>
        <HubShell />
      </MemoryRouter>
    );
    expect(htmlAcara).toContain('ptv-dock-item is-active" data-tab="acara"');
    expect(htmlAcara).not.toContain('ptv-dock-item is-active" data-tab="home"');

    // Rute Inventaris -> Alat aktif
    const htmlAlat = renderToString(
      <MemoryRouter initialEntries={['/hub/inventaris']}>
        <HubShell />
      </MemoryRouter>
    );
    expect(htmlAlat).toContain('ptv-dock-item is-active" data-tab="alat"');
    expect(htmlAlat).not.toContain('ptv-dock-item is-active" data-tab="home"');

    // Rute Profile -> Profile aktif
    const htmlProfile = renderToString(
      <MemoryRouter initialEntries={['/hub/profile']}>
        <HubShell />
      </MemoryRouter>
    );
    expect(htmlProfile).toContain('ptv-dock-item is-active" data-tab="profile"');
    expect(htmlProfile).not.toContain('ptv-dock-item is-active" data-tab="home"');

    // Rute Kru (/hub/kru) -> TIDAK ADA tab yang aktif (Home TIDAK boleh aktif secara keliru!)
    const htmlKru = renderToString(
      <MemoryRouter initialEntries={['/hub/kru']}>
        <HubShell />
      </MemoryRouter>
    );
    expect(htmlKru).not.toContain('ptv-dock-item is-active" data-tab="home"');
    expect(htmlKru).not.toContain('ptv-dock-item is-active" data-tab="acara"');
    expect(htmlKru).not.toContain('ptv-dock-item is-active" data-tab="alat"');
    expect(htmlKru).not.toContain('ptv-dock-item is-active" data-tab="profile"');
  });

  it('6. Mobile header: avatar Profile disembunyikan di mobile (hanya ada di desktop)', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/hub/beranda']}>
        <HubShell />
      </MemoryRouter>
    );

    // Profile button pada header memiliki class only-desktop sehingga tidak tampil di header mobile
    expect(html).toContain('icon-btn-profile only-desktop');
  });

  it('7. WorkspaceBottomSheet merender header Workspace, input pencarian, aksi cepat, dan grid aplikasi pastel', () => {
    const html = renderToString(
      <WorkspaceBottomSheet
        isOpen={true}
        onClose={() => {}}
        can={() => true}
        navigate={() => {}}
        user={{}}
      />
    );

    expect(html).toContain('Progresif TV Workspace');
    expect(html).toContain('ptv-workspace-grab-handle');
    expect(html).toContain('ptv-workspace-search-input');
    expect(html).toContain('Aksi Cepat');
    expect(html).toContain('Semua Fitur');
    expect(html).toContain('ptv-workspace-features-grid');
    expect(html).toContain('ptv-workspace-app-icon-box');
  });

  it('8. PTV-DEV-181 & PTV-DEV-184: Workspace floating sheet menggunakan 3-snap Apple Find My structure dan default initial snap medium (60-65% dvh)', () => {
    const html = renderToString(
      <WorkspaceBottomSheet
        isOpen={true}
        onClose={() => {}}
        can={() => true}
        navigate={() => {}}
        user={{}}
      />
    );

    // Initial default snap adalah medium (60-65% dvh)
    expect(html).toContain('ptv-workspace-sheet is-medium');
    // Grab handle memiliki role button dan aria-label
    expect(html).toContain('aria-label="Ubah ukuran Workspace"');
    expect(html).toContain('role="button"');
  });

  it('9. PTV-DEV-183: Sidebar collapse button sebagai edge tab pada border sidebar dan external link icon memiliki class snav-ext-ic', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/hub/beranda']}>
        <HubShell />
      </MemoryRouter>
    );

    // Tombol collapse berada langsung di dalam aside.side
    expect(html).toContain('side-collapse-btn');
    // External link icon memiliki class snav-ext-ic
    expect(html).toContain('snav-ext-ic');
    expect(html).toContain('title="Buka tab baru"');
  });

  it('10. PTV-DEV-184: Mobile bottom navbar JID SPACE geometry - hanya tab aktif yang me-render dock-label', () => {
    // Saat Beranda aktif: hanya Home yang punya label, tab lain hanya ikon
    const htmlBeranda = renderToString(
      <MemoryRouter initialEntries={['/hub/beranda']}>
        <HubShell />
      </MemoryRouter>
    );

    // Verifikasi Home aktif me-render label
    expect(htmlBeranda).toContain('ptv-dock-item is-active" data-tab="home"');
    expect(htmlBeranda).toContain('<span class="dock-label">Home</span>');

    // Tab tidak aktif TIDAK me-render dock-label sama sekali di DOM
    expect(htmlBeranda).not.toContain('<span class="dock-label">Acara</span>');
    expect(htmlBeranda).not.toContain('<span class="dock-label">Alat</span>');
    expect(htmlBeranda).not.toContain('<span class="dock-label">Profil</span>');

    // Saat Acara aktif: hanya Acara yang punya label
    const htmlAcara = renderToString(
      <MemoryRouter initialEntries={['/hub/acara']}>
        <HubShell />
      </MemoryRouter>
    );
    expect(htmlAcara).toContain('ptv-dock-item is-active" data-tab="acara"');
    expect(htmlAcara).toContain('<span class="dock-label">Acara</span>');
    expect(htmlAcara).not.toContain('<span class="dock-label">Home</span>');
    expect(htmlAcara).not.toContain('<span class="dock-label">Alat</span>');
    expect(htmlAcara).not.toContain('<span class="dock-label">Profil</span>');

    // Discover button bulat terpisah dengan ikon table-cells-large
    expect(htmlBeranda).toContain('ptv-dock-discover');
    expect(htmlBeranda).toContain('fa-table-cells-large');
  });
});


