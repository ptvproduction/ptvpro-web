import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { HaulPage } from '../../src/products/hub/haul/HaulPage';
import { useSessionStore } from '../../src/core/session';
import { ProductionDraftRepository, IsolatedMockRepository } from '../../src/products/hub/haul-workspace/adapter';
import { seedWorkspace, demoPeople } from '../../src/products/hub/haul-workspace/fixtures';

describe('PTV-DEV-206: Haul & Harlah Workspace Hub Integration Tests', () => {
  beforeEach(() => {
    // Reset session store to a clean state
    useSessionStore.setState({
      user: {
        id: 'user-zidnal-001',
        username: 'jid',
        full_name: 'Muhammad Zidnal Falah',
        assigned_profiles: ['eksekutif'],
        allowed_overrides: [],
        denied_overrides: [],
        status_akun: 'active',
        status_organisasi: 'active',
      } as any,
    });
  });

  describe('1. RBAC & Capability Enforcement', () => {
    it('1.1 should deny access to users without projecthaul.view capability', () => {
      // Pembina profile does not have projecthaul.view
      useSessionStore.setState({
        user: {
          id: 'pembina-user',
          username: 'pembina',
          full_name: 'Dewan Pembina',
          assigned_profiles: ['pembina'],
          allowed_overrides: [],
          denied_overrides: [],
          status_akun: 'active',
          status_organisasi: 'active',
        } as any,
      });

      const html = renderToString(<HaulPage />);
      expect(html).toContain('Akses Terbatas');
      expect(html).toContain('projecthaul.view');
      expect(html).not.toContain('Ruang Kerja');
    });

    it('1.2 should grant access to users with projecthaul.view capability', () => {
      // Eksekutif profile has projecthaul.view and projecthaul.manage
      const html = renderToString(<HaulPage />);
      expect(html).not.toContain('Akses Terbatas');
      expect(html).toContain('Haul &amp; Harlah');
      expect(html).toContain('hh-workspace-surface');
    });

    it('1.3 should grant coordinator privileges when user has projecthaul.manage', () => {
      // Eksekutif has projecthaul.manage
      const html = renderToString(<HaulPage />);
      expect(html).toContain('Atur edisi');
      expect(html).toContain('+ Edisi');
      expect(html).toContain('+ Paket PPBS');
    });

    it('1.4 should restrict coordinator controls when user only has projecthaul.view (crew member)', () => {
      // Anggota kru only has projecthaul.view, NOT projecthaul.manage
      useSessionStore.setState({
        user: {
          id: 'kru-user-001',
          username: 'kru_biasa',
          full_name: 'Kru Lapangan',
          assigned_profiles: ['anggota_kru'],
          allowed_overrides: [],
          denied_overrides: [],
          status_akun: 'active',
          status_organisasi: 'active',
        } as any,
      });

      const html = renderToString(<HaulPage />);
      expect(html).toContain('Haul &amp; Harlah');
      // Coordinator buttons should NOT be rendered for crew
      expect(html).not.toContain('Atur edisi');
      expect(html).not.toContain('+ Edisi');
      expect(html).not.toContain('+ Paket PPBS');
    });
  });

  describe('2. Workspace Architecture & Notion Parity in Hub', () => {
    it('2.1 should render minimal editorial header without welcome banner or decorative statistics', () => {
      const html = renderToString(<HaulPage />);
      expect(html).toContain('PTV Hub');
      expect(html).toContain('Haul &amp; Harlah');
      expect(html).toContain('Haul &amp; Harlah PPBS 2027');
      // No decorative welcome banner or bloated notices
      expect(html).not.toContain('welcome-banner');
      expect(html).not.toContain('hh-notice-body');
    });

    it('2.2 should render compact event cards with real PPBS event titles', () => {
      const html = renderToString(<HaulPage />);
      expect(html).toContain('Majelis Sama&#x27; Shahih Bukhari');
      expect(html).toContain('Maulid Haul PPBS');
      expect(html).toContain('Haul Puncak (Malam Puncak)');
    });

    it('2.3 should render horizontal view switcher tabs with aria-pressed attribute', () => {
      const html = renderToString(<HaulPage />);
      for (const mode of ['Calendar', 'By Project', 'By Person', 'By Event', 'List']) {
        expect(html).toContain(mode);
      }
      expect(html).toContain('aria-pressed');
    });

    it('2.4 should render dynamic database-style groups from PPBS template', () => {
      const html = renderToString(<HaulPage />);
      // Default view is List/Semua pekerjaan or grouped by project
      expect(html).toContain('hh-table');
      expect(html).toContain('Pekerjaan');
      expect(html).toContain('PIC &amp; Kru');
      expect(html).toContain('Deadline');
    });

    it('2.5 should not render developer simulators or second navigation shells', () => {
      const html = renderToString(<HaulPage />);
      expect(html).not.toContain('Simuler akses');
      expect(html).not.toContain('mobilebar');
      expect(html).not.toContain('Tema gelap');
    });
  });

  describe('3. Repository Adapter Separation & Guardrails', () => {
    it('3.1 ProductionDraftRepository should be distinct from IsolatedMockRepository', () => {
      const seed = seedWorkspace();
      const mockRepo = new IsolatedMockRepository(seed, demoPeople);
      const prodRepo = new ProductionDraftRepository(seed, demoPeople);

      expect(mockRepo.isProduction()).toBe(false);
      expect(prodRepo.isProduction()).toBe(true);
      expect(prodRepo.getBackendNotice()).toContain('Penyimpanan Database Cloud Tertunda');
    });

    it('3.2 ProductionDraftRepository should provide clear cloud notice to user', () => {
      const seed = seedWorkspace();
      const prodRepo = new ProductionDraftRepository(seed, demoPeople);
      const notice = prodRepo.getBackendNotice();

      expect(notice).not.toBeNull();
      expect(notice).toContain('ptv_haul');
      expect(notice).toContain('Supabase');
    });

    it('3.3 Hub HaulPage should display the safe draft mode notice in production runtime', () => {
      const html = renderToString(<HaulPage />);
      expect(html).toContain('Penyimpanan Database Cloud Tertunda');
    });
  });
});
