import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { FinancePage } from '../../src/products/hub/keuangan/FinancePage';
import { FinanceOverview } from '../../src/products/hub/keuangan/FinanceOverview';
import { TransactionWorkspace, PocketWorkspace } from '../../src/products/hub/keuangan/FinanceWorkspace';
import { FinanceKasKruView, FinancePiutangView, FinanceLaporanView, FinanceSettingsView } from '../../src/products/hub/keuangan/FinanceSections';
import type { FinanceSnapshot } from '../../src/products/hub/keuangan/financeFoundation';

function createMockSnapshot(): FinanceSnapshot {
  return {
    source: 'staging',
    canManage: true,
    scope: 'global',
    counts: { income: 39, expense: 10, ledger: 0 },
    entries: [],
    kas: [
      { id: 'kas-1', period: 'Oktober 2026', amount: 50000, status: 'Lunas' },
      { id: 'kas-2', period: 'November 2026', amount: 50000, status: 'Belum Lunas' },
    ],
    limited: false,
    writesEnabled: true,
    canonical: {
      state: 'available',
      pockets: [
        {
          id: '60e8d033-2794-4219-a960-c56bedca0111',
          name: 'Kas Utama Studio',
          kind: 'cash',
          provider: 'Kas Tunai Studio',
          accountHolder: '',
          accountNumber: '',
          balanceMinor: '52027600',
          archived: false,
          version: 50,
          qris: null,
        },
      ],
      transactions: [
        {
          id: 'tx-1',
          occurredOn: '2026-10-21',
          description: 'Honor Kru Produksi Pilot',
          kind: 'expense',
          amountMinor: '20000000',
          status: 'posted',
          auditReference: 'AUDIT-001',
          allocations: [
            {
              pocketId: '60e8d033-2794-4219-a960-c56bedca0111',
              amountMinor: '20000000',
              direction: 'out',
            },
          ],
        },
      ],
      categories: [
        { id: 'cat-1', name: 'Honor Kru', kind: 'expense', isActive: true },
      ],
    },
  };
}

describe('PTV-DEV-126: Finance 2.0 Mobile UX Audit & Compact Redesign', () => {
  it('1. Header & Navigation: Container nav-scroll-wrap terpasang untuk horizontal scrolling touch tanpa layout overflow', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/hub/keuangan']}>
        <FinancePage />
      </MemoryRouter>
    );

    expect(html).toContain('finance-nav-scroll-wrap');
    expect(html).toContain('finance-nav');
    expect(html).toContain('Ringkasan');
    expect(html).toContain('Transaksi');
    expect(html).toContain('Kantong');
  });

  it('2. Tab Ringkasan: Hero saldo compact dan 4 kartu bento siap untuk 2-kolom mobile', () => {
    const snapshot = createMockSnapshot();
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/hub/keuangan']}>
        <FinanceOverview data={snapshot} onRefresh={() => {}} />
      </MemoryRouter>
    );

    // Hero saldo & action buttons
    expect(html).toContain('finance-hero-bento');
    expect(html).toContain('Transfer Kantong');
    expect(html).toContain('Catat Pengeluaran');

    // 4 Bento Metric Cards
    expect(html).toContain('Pemasukan Tercatat');
    expect(html).toContain('Pengeluaran Tercatat');
    expect(html).toContain('Rekening &amp; QRIS Bendahara');
    expect(html).toContain('Kantong Keuangan');
  });

  it('3. Tab Transaksi: Menyediakan toggle filter lanjutan mobile dan quick actions yang responsif', () => {
    const snapshot = createMockSnapshot();
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/hub/keuangan?tab=transaksi']}>
        <TransactionWorkspace data={snapshot} />
      </MemoryRouter>
    );

    expect(html).toContain('toolbar-filter-toggle-mobile');
    expect(html).toContain('Filter Lanjutan');
    expect(html).toContain('Catat Pemasukan');
    expect(html).toContain('Catat Pengeluaran');
    expect(html).toContain('Pindah Kantong');
  });

  it('4. Tab Kantong, Kas Kru, Piutang, Laporan, Pengaturan: Merender komponen compact tanpa tabel overflow', () => {
    const snapshot = createMockSnapshot();

    const pocketHtml = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/hub/keuangan?tab=kantong']}>
        <PocketWorkspace data={snapshot} />
      </MemoryRouter>
    );
    expect(pocketHtml).toContain('pocket-balance-panel');
    expect(pocketHtml).toContain('Rincian');
    expect(pocketHtml).toContain('Edit');

    const kasHtml = renderToStaticMarkup(<FinanceKasKruView data={snapshot} />);
    expect(kasHtml).toContain('finance-substats-row');
    expect(kasHtml).toContain('finance-kru-cards-grid');

    const piutangHtml = renderToStaticMarkup(<FinancePiutangView />);
    expect(piutangHtml).toContain('arch-pillars-grid');

    const laporanHtml = renderToStaticMarkup(<FinanceLaporanView data={snapshot} />);
    expect(laporanHtml).toContain('Buku Utama Terekonsiliasi');

    const settingsHtml = renderToStaticMarkup(<FinanceSettingsView canManage={true} />);
    expect(settingsHtml).toContain('finance-settings-modern-grid');
  });

  it('5. CSS Mobile Breakpoints Audit: Aturan @media (max-width: 639px) dan (max-width: 360px) lengkap', () => {
    const cssPath = resolve(__dirname, '../../src/products/hub/keuangan/financeFoundation.css');
    const cssContent = readFileSync(cssPath, 'utf-8');

    // Cek media query 639px
    expect(cssContent).toContain('@media (max-width: 639px)');
    expect(cssContent).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important');
    expect(cssContent).toContain('.finance-nav-scroll-wrap');
    expect(cssContent).toContain('.toolbar-filter-toggle-mobile');
    expect(cssContent).toContain('.toolbar-row-filters.mobile-collapsed');
    expect(cssContent).toContain('.toolbar-row-filters.mobile-expanded');

    // Cek modal bottom sheet mobile
    expect(cssContent).toContain('border-top-left-radius: 24px');
    expect(cssContent).toContain('border-top-right-radius: 24px');

    // Cek penyesuaian khusus smartphone kecil (360px)
    expect(cssContent).toContain('@media (max-width: 360px)');
  });
});
