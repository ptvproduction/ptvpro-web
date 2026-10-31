import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  getStoredFinanceSettings,
  saveFinanceSettings,
  createCanonicalCategory,
  toggleCategoryActive,
  attachQrisToPocket,
} from '../../src/products/hub/keuangan/financeSettingsService';
import { FinanceSettingsView } from '../../src/products/hub/keuangan/FinanceSettingsView';
import type { FinanceSnapshot } from '../../src/products/hub/keuangan/financeFoundation';
import type { CanonicalCategory, FinancePocket } from '../../src/products/hub/keuangan/financeCanonical';

const mockPockets: FinancePocket[] = [
  {
    id: 'p-cash',
    name: 'Kas Tunai Studio',
    kind: 'cash',
    provider: '',
    accountNumber: '',
    accountHolder: '',
    archived: false,
    version: 1,
    balanceMinor: '50000000',
    qris: null,
  },
  {
    id: 'p-bank',
    name: 'Rekening BCA',
    kind: 'bank',
    provider: 'BCA',
    accountNumber: '88889999',
    accountHolder: 'Studio PTV',
    archived: false,
    version: 1,
    balanceMinor: '100000000',
    qris: null,
  },
];

const mockCategories: CanonicalCategory[] = [
  { id: 'c1', name: 'Jasa Produksi', kind: 'income', isActive: true },
  { id: 'c2', name: 'Konsumsi', kind: 'expense', isActive: true },
];

const mockSnapshot: FinanceSnapshot = {
  source: 'staging',
  canManage: true,
  scope: 'global',
  counts: { income: 39, expense: 10, ledger: 0 },
  entries: [],
  kas: [],
  limited: false,
  writesEnabled: true,
  canonical: {
    state: 'available',
    pockets: mockPockets,
    categories: mockCategories,
    transactions: [],
  },
};

afterEach(() => vi.unstubAllGlobals());

describe('Finance 2.0: Settings & Configuration Module', () => {
  it('1. Operational Settings: dapat menyimpan parameter iuran, jatuh tempo, dan kontak bendahara', () => {
    saveFinanceSettings({
      defaultMonthlyFeeMinor: '3000000',
      feeDueDay: 15,
      defaultLoanDueDays: 45,
      treasurerName: 'Zidnal',
      treasurerPtvId: 'PTV-001',
      treasurerPhone: '+62 812-9999-8888',
      officialBankPocketId: 'p-bank',
      officialQrisPocketId: 'p-bank',
    });

    const settings = getStoredFinanceSettings();
    expect(settings.defaultMonthlyFeeMinor).toBe('3000000');
    expect(settings.feeDueDay).toBe(15);
    expect(settings.treasurerName).toBe('Zidnal');
    expect(settings.treasurerPhone).toBe('+62 812-9999-8888');
  });

  it('2. createCanonicalCategory: menolak duplikasi nama dan jenis', async () => {
    // Duplicate rejection
    await expect(
      createCanonicalCategory('Jasa Produksi', 'income', mockCategories)
    ).rejects.toThrow(/sudah ada/i);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, category: { id: 'cloud-category', name: 'Sponsorship Acara', kind: 'income', is_active: true } }) }));
    // New category creation
    const newCat = await createCanonicalCategory('Sponsorship Acara', 'income', mockCategories);
    expect(newCat.name).toBe('Sponsorship Acara');
    expect(newCat.kind).toBe('income');
    expect(newCat.isActive).toBe(true);
  });

  it('3. toggleCategoryActive: melakukan soft-archive kategori tanpa penghapusan destruktif', () => {
    const updated = toggleCategoryActive('c1', false, mockCategories);
    expect(updated.find(c => c.id === 'c1')?.isActive).toBe(false);
    expect(updated.find(c => c.id === 'c2')?.isActive).toBe(true);
  });

  it('4. attachQrisToPocket: menolak pemasangan QRIS pada kas tunai dan memvalidasi kelengkapan merchant/NMID', () => {
    // Menolak kantong tunai
    expect(() =>
      attachQrisToPocket(
        {
          pocketId: 'p-cash',
          merchantName: 'PTV',
          nmid: '123',
          assetPath: '/test.png',
          verifiedAt: '2026-10-23',
        },
        mockPockets
      )
    ).toThrow(/tunai/i);

    // Sukses pada kantong bank/ewallet
    const updated = attachQrisToPocket(
      {
        pocketId: 'p-bank',
        merchantName: 'PTV OFFICIAL',
        nmid: 'ID102030',
        assetPath: '/finance-assets/qris-official.png',
        verifiedAt: '2026-10-23',
      },
      mockPockets
    );

    const bankPocket = updated.find(p => p.id === 'p-bank');
    expect(bankPocket?.qris?.merchantName).toBe('PTV OFFICIAL');
    expect(bankPocket?.qris?.nmid).toBe('ID102030');
  });

  it('5. Render UI: FinanceSettingsView mematuhi 4 pilar arsitektur dan persyaratan unified tabs', () => {
    const html = renderToStaticMarkup(<FinanceSettingsView canManage={true} data={mockSnapshot} />);
    expect(html).toContain('Akses &amp; Otoritas Pengelolaan');
    expect(html).toContain('Buku Utama &amp; Rekening Studio');
    expect(html).toContain('Kategori Transaksi Canonical');
    expect(html).toContain('Integritas Transaksi &amp; Anti-Overdraft');
    expect(html).toContain('11 Kategori Aktif');
    expect(html).toContain('PostgreSQL 17 Staging');
    expect(html).toContain('Anti-Overdraft');
    expect(html).toContain('finance-settings-modern-grid');
  });
});
