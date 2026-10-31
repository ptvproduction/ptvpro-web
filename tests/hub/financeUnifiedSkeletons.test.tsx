import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import * as kruStoreModule from '../../src/products/hub/kru/kruStore';
import {
  FinanceOverviewSkeleton,
  FinanceTransactionSkeleton,
  FinancePocketSkeleton,
  FinanceKasKruSkeleton,
  FinancePiutangSkeleton,
  FinanceLaporanSkeleton,
  FinanceSettingsSkeleton,
  FinanceSectionSkeleton,
} from '../../src/products/hub/keuangan/components/skeletons';
import { FinancePage } from '../../src/products/hub/keuangan/FinancePage';
import { FinanceOperationalWorkspace } from '../../src/products/hub/keuangan/FinanceOperationalWorkspace';
import type { FinanceSnapshot } from '../../src/products/hub/keuangan/financeFoundation';

const mockSnapshot: FinanceSnapshot = {
  source: 'staging',
  canManage: true,
  scope: 'global',
  counts: { income: 54, expense: 4, ledger: 58 },
  entries: [],
  kas: [],
  limited: false,
  writesEnabled: true,
  canonical: {
    state: 'available',
    pockets: [
      {
        id: '60e8d033-2794-4219-a960-c56bedca0111',
        name: 'Kas Utama Studio',
        kind: 'cash',
        provider: '',
        accountHolder: '',
        accountNumber: '',
        balanceMinor: '52027600',
        archived: false,
        version: 50,
        qris: null,
      },
    ],
    transactions: [],
    categories: [],
  },
};

describe('Finance 2.0 Unified Skeleton Loading System', () => {
  it('1. Ringkasan: renders FinanceOverviewSkeleton with content-aware hero, 4 KPIs, chart, and activity', () => {
    const html = renderToStaticMarkup(<FinanceOverviewSkeleton />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Memuat ringkasan keuangan…"');
    expect(html).toContain('fin-skel-hero-card');
    expect(html).toContain('fin-skel-kpi-grid');
    expect(html).toContain('fin-skel-two-cols');
  });

  it('2. Transaksi: renders FinanceTransactionSkeleton with actions, toolbar, desktop table, and mobile cards', () => {
    const html = renderToStaticMarkup(<FinanceTransactionSkeleton />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Memuat data transaksi…"');
    expect(html).toContain('fin-skel-toolbar');
    expect(html).toContain('fin-skel-table-card desktop-only');
    expect(html).toContain('fin-skel-mobile-cards');
  });

  it('3. Kantong: renders FinancePocketSkeleton with hero balance and pocket grid', () => {
    const html = renderToStaticMarkup(<FinancePocketSkeleton />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Memuat data kantong kas…"');
    expect(html).toContain('fin-skel-hero-card');
    expect(html).toContain('fin-skel-pockets-grid');
  });

  it('4. Kas Kru: renders FinanceKasKruSkeleton with 4 KPIs, toolbar, 6-period matrix table, and mobile cards', () => {
    const html = renderToStaticMarkup(<FinanceKasKruSkeleton />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Memuat data kas kru…"');
    expect(html).toContain('fin-skel-kpi-grid');
    expect(html).toContain('fin-skel-toolbar');
    expect(html).toContain('fin-skel-table-card desktop-only');
    expect(html).toContain('fin-skel-mobile-cards');
  });

  it('5. Piutang: renders FinancePiutangSkeleton with 4 KPIs, borrower toolbar, loan table with progress, and mobile cards', () => {
    const html = renderToStaticMarkup(<FinancePiutangSkeleton />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Memuat data piutang…"');
    expect(html).toContain('fin-skel-kpi-grid');
    expect(html).toContain('fin-skel-toolbar');
    expect(html).toContain('fin-skel-table-card desktop-only');
    expect(html).toContain('fin-skel-mobile-cards');
  });

  it('6. Laporan: renders FinanceLaporanSkeleton with filter presets, 4 summary cards, breakdown, and ledger table', () => {
    const html = renderToStaticMarkup(<FinanceLaporanSkeleton />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Memuat laporan keuangan…"');
    expect(html).toContain('fin-skel-kpi-grid');
    expect(html).toContain('fin-skel-surface');
    expect(html).toContain('fin-skel-table-card');
  });

  it('7. Pengaturan: renders FinanceSettingsSkeleton with subnav, semester cards, category pills, and treasurer info', () => {
    const html = renderToStaticMarkup(<FinanceSettingsSkeleton />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Memuat pengaturan keuangan…"');
    expect(html).toContain('fin-skel-surface');
  });

  it('8. FinanceSectionSkeleton routes to correct skeleton for each section', () => {
    const sections = ['ringkasan', 'transaksi', 'kantong', 'kas-kru', 'piutang', 'laporan', 'pengaturan'] as const;
    for (const sec of sections) {
      const html = renderToStaticMarkup(<FinanceSectionSkeleton section={sec} />);
      expect(html).toContain('fin-skel-root');
      expect(html).toContain('aria-busy="true"');
    }
  });

  it('9. FinancePage renders content-aware skeleton during initial loading', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/hub/keuangan?tab=transaksi']}>
        <FinancePage />
      </MemoryRouter>
    );
    expect(html).toContain('fin-skel-root');
    expect(html).toContain('fin-skel-toolbar');
  });

  it('10. FinanceOperationalWorkspace renders section skeleton when operational data is pending', () => {
    vi.spyOn(kruStoreModule, 'useCrewStore').mockReturnValue({
      members: [],
      loading: true,
      error: null,
      refreshCrew: vi.fn(),
      getCurrentUser: vi.fn(),
      getById: vi.fn(),
      addCrew: vi.fn(),
      updateCrew: vi.fn(),
      toggleCrewStatus: vi.fn(),
      activateAccount: vi.fn(),
      updateOAuthEmail: vi.fn(),
      deleteCrew: vi.fn(),
      updateCrewPermissions: vi.fn(),
      getSuggestedNextPtvId: vi.fn(),
    });

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/hub/keuangan?tab=kas-kru']}>
        <FinanceOperationalWorkspace section="kas-kru" data={mockSnapshot} />
      </MemoryRouter>
    );
    expect(html).toContain('fin-skel-root');
    expect(html).toContain('fin-skel-kpi-grid');
  });

  it('11. FinanceOperationalWorkspace renders clean R03 error card on failure', () => {
    vi.spyOn(kruStoreModule, 'useCrewStore').mockReturnValue({
      members: [],
      loading: false,
      error: 'Koneksi staging terputus',
      refreshCrew: vi.fn(),
      getCurrentUser: vi.fn(),
      getById: vi.fn(),
      addCrew: vi.fn(),
      updateCrew: vi.fn(),
      toggleCrewStatus: vi.fn(),
      activateAccount: vi.fn(),
      updateOAuthEmail: vi.fn(),
      deleteCrew: vi.fn(),
      updateCrewPermissions: vi.fn(),
      getSuggestedNextPtvId: vi.fn(),
    });

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/hub/keuangan?tab=kas-kru']}>
        <FinanceOperationalWorkspace section="kas-kru" data={mockSnapshot} />
      </MemoryRouter>
    );
    expect(html).toContain('Gagal Memuat Data Operasional');
    expect(html).toContain('Koneksi staging terputus');
    expect(html).toContain('Coba lagi');
  });
});
