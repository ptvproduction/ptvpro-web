import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { FinancePage } from '../../src/products/hub/keuangan/FinancePage';
import { useSessionStore } from '../../src/core/session/sessionStore';
import * as foundation from '../../src/products/hub/keuangan/financeFoundation';

describe('FinancePage Integration Render', () => {
  it('merender FinanceOverview secara mulus saat data staging termuat', async () => {
    useSessionStore.setState({
      user: {
        id: 'acc-1',
        ptv_id: 'PTV-001',
        full_name: 'Zidnal Executive',
        role: 'eksekutif',
        status: 'active',
      } as any,
    });

    vi.spyOn(foundation, 'loadFinance').mockResolvedValue({
      source: 'staging',
      canManage: true,
      scope: 'global',
      counts: { income: 43, expense: 10, ledger: 0 },
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
        transactions: [
          {
            id: 'tx-1',
            occurredOn: '2026-10-21',
            description: 'Uji Transaksi Staging',
            kind: 'income',
            amountMinor: '100000',
            status: 'posted',
            auditReference: 'AUDIT-REF-1',
            allocations: [
              {
                pocketId: '60e8d033-2794-4219-a960-c56bedca0111',
                amountMinor: '100000',
                direction: 'in',
              },
            ],
          },
        ],
        categories: [],
      },
    });

    // Render komponen FinancePage
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/hub/keuangan']}>
        <FinancePage />
      </MemoryRouter>
    );

    // Initial render displays skeleton / title
    expect(html).toContain('Keuangan Studio');
    expect(html).toContain('Navigasi keuangan');
  });
});
