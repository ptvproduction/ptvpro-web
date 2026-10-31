import { describe, it, expect } from 'vitest';
import { SIDEBAR_GROUPS } from '../../src/products/hub/shell/HubShell';
import { ALL_WORKSPACE_FEATURES } from '../../src/products/hub/shell/WorkspaceBottomSheet';

describe('PTVPRO HUB — Penyesuaian Posisi Menu Portofolio', () => {
  describe('1. Sidebar Desktop (SIDEBAR_GROUPS)', () => {
    it('harus memuat Portofolio Saya tepat di bawah Profil dalam grup Sistem', () => {
      const sistemGroup = SIDEBAR_GROUPS.find((g) => g.groupName === 'Sistem');
      expect(sistemGroup).toBeDefined();

      const profileIndex = sistemGroup?.items.findIndex((i) => i.key === 'profile');
      const portofolioIndex = sistemGroup?.items.findIndex((i) => i.key === 'portofolio');

      expect(profileIndex).toBeGreaterThanOrEqual(0);
      expect(portofolioIndex).toBeGreaterThanOrEqual(0);
      expect(portofolioIndex).toBe(profileIndex! + 1);
    });

    it('Portofolio Saya TIDAK BOLEH lagi berada di grup Kru & Komunikasi', () => {
      const kruGroup = SIDEBAR_GROUPS.find((g) => g.groupName === 'Kru & Komunikasi');
      expect(kruGroup).toBeDefined();

      const portofolioInKru = kruGroup?.items.find((i) => i.key === 'portofolio');
      expect(portofolioInKru).toBeUndefined();
    });

    it('harus mempertahankan atribut, icon, route, dan capability Portofolio Saya', () => {
      const sistemGroup = SIDEBAR_GROUPS.find((g) => g.groupName === 'Sistem');
      const item = sistemGroup?.items.find((i) => i.key === 'portofolio');

      expect(item).toBeDefined();
      expect(item?.label).toBe('Portofolio Saya');
      expect(item?.path).toBe('/hub/portofolio');
      expect(item?.iconClass).toBe('fa-solid fa-briefcase');
      expect(item?.anyCapabilities).toEqual(['id.view', 'settings.personal', 'crew.view']);
    });
  });

  describe('2. Navigasi Mobile (ALL_WORKSPACE_FEATURES)', () => {
    it('harus memuat Portofolio Saya tepat setelah Profil pada modul navigasi mobile', () => {
      const profilIndex = ALL_WORKSPACE_FEATURES.findIndex((f) => f.id === 'profil');
      const portofolioIndex = ALL_WORKSPACE_FEATURES.findIndex((f) => f.id === 'portofolio');

      expect(profilIndex).toBeGreaterThanOrEqual(0);
      expect(portofolioIndex).toBeGreaterThanOrEqual(0);
      expect(portofolioIndex).toBe(profilIndex + 1);
    });

    it('harus memiliki path dan icon yang konsisten', () => {
      const portofolio = ALL_WORKSPACE_FEATURES.find((f) => f.id === 'portofolio');
      expect(portofolio).toBeDefined();
      expect(portofolio?.name).toBe('Portofolio Saya');
      expect(portofolio?.path).toBe('/hub/portofolio');
      expect(portofolio?.icon).toBe('fa-solid fa-briefcase');
    });
  });
});
