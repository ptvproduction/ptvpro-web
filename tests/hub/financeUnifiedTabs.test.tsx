import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { FinanceOverview } from '../../src/products/hub/keuangan/FinanceOverview';
import { PocketWorkspace, TransactionWorkspace } from '../../src/products/hub/keuangan/FinanceWorkspace';
import {
  FinanceKasKruView,
  FinancePiutangView,
  FinanceLaporanView,
  FinanceSettingsView,
} from '../../src/products/hub/keuangan/FinanceSections';
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

const pocketBCA: FinancePocket = {
  id: '77777777-7777-4777-8777-777777777777',
  name: 'Rekening BCA Operasional',
  kind: 'bank',
  provider: 'BCA',
  accountHolder: 'Studio PTV',
  accountNumber: '1234567890',
  balanceMinor: '150000000', // Rp 1.500.000,00
  archived: false,
  version: 2,
  qris: null,
};

const pocketDummyArsip: FinancePocket = {
  id: '99999999-9999-4999-8999-999999999999',
  name: 'Kantong Dummy Arsip',
  kind: 'ewallet',
  provider: 'GoPay',
  accountHolder: 'Studio PTV',
  accountNumber: '08123456789',
  balanceMinor: '0',
  archived: true,
  version: 3,
  qris: null,
};

const txOperasional1: CanonicalTransaction = {
  id: 'tx-op-1',
  occurredOn: '2026-10-20',
  description: 'Pemasukan Jasa Video',
  kind: 'income',
  amountMinor: '115420000', // Rp 1.154.200,00
  status: 'posted',
  auditReference: 'AUDIT-001',
  allocations: [{ pocketId: pocketKasUtama.id, amountMinor: '115420000', direction: 'in' }],
  sourceReferences: [{ kind: 'pemasukan', id: '1' }],
};

const txOperasional2: CanonicalTransaction = {
  id: 'tx-op-2',
  occurredOn: '2026-10-20',
  description: 'Pengeluaran Konsumsi Kru',
  kind: 'expense',
  amountMinor: '63392400', // Rp 633.924,00
  status: 'posted',
  auditReference: 'AUDIT-002',
  allocations: [{ pocketId: pocketKasUtama.id, amountMinor: '63392400', direction: 'out' }],
  sourceReferences: [{ kind: 'pengeluaran', id: '1' }],
};

const txReversed: CanonicalTransaction = {
  id: 'tx-rev-1',
  occurredOn: '2026-10-19',
  description: 'Pemasukan Dibatalkan [BATAL/UNDO]',
  kind: 'income',
  amountMinor: '9000000', // Rp 90.000,00
  status: 'reversed',
  auditReference: 'AUDIT-003',
  allocations: [{ pocketId: pocketKasUtama.id, amountMinor: '9000000', direction: 'in' }],
  sourceReferences: [{ kind: 'pemasukan', id: '2' }],
};

const txDummyTest: CanonicalTransaction = {
  id: 'tx-dummy-1',
  occurredOn: '2026-10-21',
  description: 'TEST MUTATION PTV-DEV-117',
  kind: 'income',
  amountMinor: '10000000',
  status: 'posted',
  auditReference: 'PTV-DEV-117-TEST-RUN-1',
  allocations: [{ pocketId: 'a1111111-1111-4111-8111-111111111111', amountMinor: '10000000', direction: 'in' }],
  sourceReferences: [],
};

function createSnapshot(): FinanceSnapshot {
  return {
    source: 'staging',
    canManage: true,
    scope: 'global',
    counts: { income: 39, expense: 10, ledger: 49 },
    entries: [],
    kas: [
      { id: 'kas-1', period: '2026-10', amount: 150000, status: 'lunas' },
      { id: 'kas-2', period: '2026-09', amount: 50000, status: 'belum' },
    ],
    limited: false,
    writesEnabled: true,
    canonical: {
      state: 'available',
      pockets: [pocketKasUtama, pocketBCA, pocketDummyArsip],
      transactions: [txOperasional1, txOperasional2, txReversed, txDummyTest],
      categories: [
        { id: 'c1', name: 'Jasa Video', kind: 'income', isActive: true },
        { id: 'c2', name: 'Konsumsi Kru', kind: 'expense', isActive: true },
      ],
    },
  };
}

describe('PTV-DEV-122: Finance 2.0 Unified UI/UX Overhaul Across All Tabs', () => {
  it('Tab 1 - Ringkasan: Mengisolasi transaksi uji dan menampilkan statistik operasional bersih', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FinanceOverview data={createSnapshot()} onRefresh={() => {}} />
      </MemoryRouter>
    );

    // Saldo terverifikasi
    expect(html).toContain('Rp 520.276');
    // Pemasukan operasional posted bersih
    expect(html).toContain('Rp 1.154.200');
    // Pengeluaran operasional posted
    expect(html).toContain('Rp 633.924');
    // Banner isolasi pengelola
    expect(html).toContain('Mutasi Uji Coba PTV-DEV-117');
    expect(html).toContain('terisolasi aman dari statistik operasional');
    // Bukan bullet list mentah HTML
    expect(html).not.toMatch(/<ul[^>]*>\s*<li>/);
  });

  it('Tab 2 - Transaksi: Modern list, toolbar filter, nominal rata kanan, badge status, isolasi dummy', () => {
    const html = renderToStaticMarkup(
      <TransactionWorkspace data={createSnapshot()} />
    );

    // Toolbar filter pencarian dan tombol filter
    expect(html).toContain('toolbar-search-input');
    expect(html).toContain('Semua Jenis');
    expect(html).toContain('Pemasukan');
    expect(html).toContain('Pengeluaran');
    expect(html).toContain('Transfer');

    // Transaksi operasional muncul
    expect(html).toContain('Pemasukan Jasa Video');
    expect(html).toContain('Pengeluaran Konsumsi Kru');
    // Badge status jelas
    expect(html).toContain('Posted');
    expect(html).toContain('Dibatalkan');

    // Nominal rata kanan
    expect(html).toContain('tx-amount');

    // Default: dummy test terisolasi dari daftar utama
    expect(html).not.toContain('TEST MUTATION PTV-DEV-117');
    // Toggle pengujian tersedia bagi pengelola
    expect(html).toContain('Termasuk Mutasi Uji');

    // Tidak ada bullet list mentah
    expect(html).not.toMatch(/<ul[^>]*>\s*<li>/);
  });

  it('Tab 3 - Kantong: Grid kartu berkarakter, saldo menonjol, dan pemisahan arsip', () => {
    const html = renderToStaticMarkup(
      <PocketWorkspace data={createSnapshot()} />
    );

    // Karakter jenis kantong
    expect(html).toContain('card-cash');
    expect(html).toContain('card-bank');
    expect(html).toContain('Kas Utama Studio');
    expect(html).toContain('Rekening BCA Operasional');

    // Saldo menonjol
    expect(html).toContain('Rp 520.276');
    expect(html).toContain('Rp 1.500.000');

    // Action buttons & pills (PTV-DEV-125)
    expect(html).toContain('Rincian');
    expect(html).toContain('Edit');
    expect(html).toContain('Tambah Kantong');

    // Tab status filter
    expect(html).toContain('Aktif');
    expect(html).toContain('Diarsipkan');

    // Tidak ada bullet list mentah
    expect(html).not.toMatch(/<ul[^>]*>\s*<li>/);
  });

  it('Tab 4 - Kas Kru: Tampilan modern, kartu iuran berstatus, dan pemisahan tegas dari Kas Utama', () => {
    const html = renderToStaticMarkup(
      <FinanceKasKruView data={createSnapshot()} />
    );

    // Header ramah & deskripsi pemisahan
    expect(html).toContain('Kas Kru &amp; Iuran Bulanan');
    expect(html).toContain('terpisah dari Kas Utama Studio');

    // Data kas kru
    expect(html).toContain('2026-10');
    expect(html).toContain('2026-09');
    expect(html).toContain('Lunas');
    expect(html).toContain('Belum Lunas');

    // Tidak ada bullet list mentah
    expect(html).not.toMatch(/<ul[^>]*>\s*<li>/);
  });

  it('Tab 5 - Piutang: Arsitektur piutang terstruktur, status jujur tanpa mengarang backend', () => {
    const html = renderToStaticMarkup(
      <FinancePiutangView />
    );

    // Status jujur
    expect(html).toContain('Tahap Perancangan Kontrak Database');
    expect(html).toContain('Piutang &amp; Pelunasan Pihak Ketiga');
    // Konsep pilar arsitektur
    expect(html).toContain('Pihak Terkait &amp; Klien');
    expect(html).toContain('Jatuh Tempo &amp; Termin');
    expect(html).toContain('Alokasi Masuk Otomatis');

    // Tidak ada bullet list mentah
    expect(html).not.toMatch(/<ul[^>]*>\s*<li>/);
  });

  it('Tab 6 - Laporan: Posisi pembukuan terverifikasi Staging tanpa data fiktif', () => {
    const html = renderToStaticMarkup(
      <FinanceLaporanView data={createSnapshot()} />
    );

    // Judul & status integritas
    expect(html).toContain('Laporan &amp; Rekonsiliasi Pembukuan');
    expect(html).toContain('Supabase Staging Terverifikasi');

    // Angka riil
    expect(html).toContain('Rp 1.154.200');
    expect(html).toContain('Rp 633.924');
    expect(html).toContain('Rp 90.000');
    expect(html).toContain('4 transaksi batal');

    // Tidak ada bullet list mentah
    expect(html).not.toMatch(/<ul[^>]*>\s*<li>/);
  });

  it('Tab 7 - Pengaturan: 4 pilar pengaturan fungsional tanpa placeholder basi', () => {
    const html = renderToStaticMarkup(
      <FinanceSettingsView canManage={true} />
    );

    // Pilar pengaturan
    expect(html).toContain('Akses &amp; Otoritas Pengelolaan');
    expect(html).toContain('Buku Utama &amp; Rekening Studio');
    expect(html).toContain('Kategori Transaksi Canonical');
    expect(html).toContain('Integritas Transaksi &amp; Anti-Overdraft');

    // Detail status
    expect(html).toContain('11 Kategori Aktif');
    expect(html).toContain('PostgreSQL 17 Staging');
    expect(html).toContain('Anti-Overdraft');

    // Tidak ada bullet list mentah
    expect(html).not.toMatch(/<ul[^>]*>\s*<li>/);
  });
});
