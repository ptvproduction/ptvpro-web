import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { FinanceOverview } from '../../src/products/hub/keuangan/FinanceOverview';
import type { FinanceSnapshot } from '../../src/products/hub/keuangan/financeFoundation';
import type { CanonicalTransaction, FinancePocket } from '../../src/products/hub/keuangan/financeCanonical';

const pocketKasUtama: FinancePocket = {
  id: '60e8d033-2794-4219-a960-c56bedca0111',
  name: 'Kas Utama Studio',
  kind: 'cash',
  provider: '',
  accountHolder: '',
  accountNumber: '',
  balanceMinor: '52027600', // Rp 520.276,00
  archived: false,
  version: 50,
  qris: null,
};

const pocketDummyArsip: FinancePocket = {
  id: '77777777-7777-4777-8777-777777777777',
  name: 'Kantong Dummy Arsip',
  kind: 'bank',
  provider: 'BCA',
  accountHolder: 'Studio PTV',
  accountNumber: '1234567890',
  balanceMinor: '0',
  archived: true,
  version: 2,
  qris: null,
};

const txPostedIncome: CanonicalTransaction = {
  id: 'tx-1',
  occurredOn: '2026-10-20',
  description: 'Pemasukan Project A',
  kind: 'income',
  amountMinor: '10000000', // Rp 100.000
  status: 'posted',
  auditReference: 'AUDIT-001',
  allocations: [{ pocketId: pocketKasUtama.id, amountMinor: '10000000', direction: 'in' }],
  sourceReferences: [{ kind: 'pemasukan', id: '1' }],
};

const txReversedIncome: CanonicalTransaction = {
  id: 'tx-2',
  occurredOn: '2026-10-19',
  description: 'Pemasukan Batal Uji',
  kind: 'income',
  amountMinor: '5000000', // Rp 50.000
  status: 'reversed',
  auditReference: 'AUDIT-002',
  allocations: [{ pocketId: pocketKasUtama.id, amountMinor: '5000000', direction: 'in' }],
  sourceReferences: [{ kind: 'pemasukan', id: '2' }],
};

function createSnapshot(overrides: Partial<FinanceSnapshot> = {}): FinanceSnapshot {
  return {
    source: 'staging',
    canManage: true,
    scope: 'global',
    counts: { income: 1, expense: 0, ledger: 1 },
    entries: [],
    kas: [],
    limited: false,
    writesEnabled: true,
    canonical: {
      state: 'available',
      pockets: [pocketKasUtama, pocketDummyArsip],
      transactions: [txPostedIncome, txReversedIncome],
      categories: [
        { id: 'cat-1', name: 'Jasa Produksi', kind: 'income', isActive: true },
      ],
    },
    ...overrides,
  };
}

describe('FinanceOverview Visual & Visibility Tests', () => {
  it('menampilkan total saldo kas aktif Rp 520.276 dan dua tombol aksi di hero', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FinanceOverview data={createSnapshot()} onRefresh={() => {}} />
      </MemoryRouter>
    );

    expect(html).toContain('Rp 520.276,00');
    expect(html).toContain('Kas Utama Studio');
    expect(html).toContain('Saldo Rekonstruksi Historis (Buku)');
    // Hero menyederhanakan quick actions menjadi 2 tombol di kanan atas
    expect(html).toContain('Transfer Kantong');
    expect(html).toContain('Catat Pengeluaran');
    // Kartu bento ke-3 menampilkan Rekening & QRIS Bendahara
    expect(html).toMatch(/Rekening (&amp;|&) QRIS Bendahara/);
    expect(html).toMatch(/Lihat informasi rekening dan QRIS Bendahara/);
    expect(html).toContain('Lihat Detail');
  });

  it('membedakan transaksi posted dan reversed: reversed tetap tercatat di riwayat tanpa menambah pemasukan aktif', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FinanceOverview data={createSnapshot()} onRefresh={() => {}} />
      </MemoryRouter>
    );

    // Pemasukan posted tercatat di statistik pemasukan
    expect(html).toContain('Pemasukan Project A');
    expect(html).toContain('Posted');
    expect(html).toContain('Rp 100.000,00');

    // Transaksi reversed tetap muncul di riwayat transaksi recent
    expect(html).toContain('Pemasukan Batal Uji');
    expect(html).toContain('Dibatalkan (Reversed)');
  });

  it('memisahkan kantong aktif dari kantong diarsipkan', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FinanceOverview data={createSnapshot()} onRefresh={() => {}} />
      </MemoryRouter>
    );

    expect(html).toContain('1 Kantong aktif');
    expect(html).toContain('Kantong Diarsipkan (1)');
  });

  it('scope own (Kru) menampilkan Access Denied yang ramah dan link Kas Kru', () => {
    const kruSnapshot = createSnapshot({
      scope: 'own',
      canManage: false,
      canonical: { state: 'awaiting_schema', pockets: null, transactions: null },
    });

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FinanceOverview data={kruSnapshot} onRefresh={() => {}} />
      </MemoryRouter>
    );

    expect(html).toContain('Akses Terbatas: Mode Kru');
    expect(html).toContain('Buka Kas Kru Saya');
    expect(html).not.toContain('Rp 520.276');
  });

  it('state awaiting_schema menampilkan informasi persiapan yang jelas', () => {
    const schemaSnapshot = createSnapshot({
      canonical: { state: 'awaiting_schema', pockets: null, transactions: null },
    });

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FinanceOverview data={schemaSnapshot} onRefresh={() => {}} />
      </MemoryRouter>
    );

    expect(html).toContain('Modul Finance 2.0 Sedang Disiapkan');
  });

  it('kartu Rekening & QRIS Bendahara interaktif dengan affordance dan atribut aksesibilitas lengkap', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FinanceOverview data={createSnapshot()} onRefresh={() => {}} />
      </MemoryRouter>
    );

    expect(html).toContain('bento-bendahara');
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Lihat informasi rekening dan QRIS Bendahara"');
    expect(html).toMatch(/Rekening (&amp;|&) QRIS Bendahara/);
    expect(html).toContain('Lihat Detail');
  });

  it('hero menyederhanakan quick actions menjadi 2 tombol di kanan atas tanpa baris 4 tombol bawah', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FinanceOverview data={createSnapshot()} onRefresh={() => {}} />
      </MemoryRouter>
    );

    // Dua tombol di kanan atas hero
    expect(html).toContain('finance-hero-actions');
    expect(html).toContain('action-transfer');
    expect(html).toContain('action-expense');
    expect(html).toContain('Transfer Kantong');
    expect(html).toContain('Catat Pengeluaran');

    // Baris 4 quick actions lama di bawah hero tidak ada lagi di hero
    expect(html).not.toContain('finance-quick-actions');
    // Tombol pemasukan di hero bento tidak ada (tetap ada di tab Transaksi)
    expect(html).not.toContain('action-income');
  });
});
