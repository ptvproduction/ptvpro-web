import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { Finance3Page } from '../../src/products/hub/keuangan/Finance3Page';
import type { FinanceSnapshot } from '../../src/products/hub/keuangan/financeFoundation';
import type { FinanceOperationalData } from '../../src/products/hub/keuangan/financeOperationalData';

const mockFinanceData: FinanceSnapshot = {
  source: 'staging',
  canManage: true,
  scope: 'global',
  counts: { income: 49, expense: 12, ledger: 0 },
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
        accountNumber: '',
        accountHolder: '',
        archived: false,
        version: 55,
        balanceMinor: '59327600', // Rp 593.276
        qris: null,
      },
      {
        id: '77777777-2794-4219-a960-c56bedca0222',
        name: 'Rekening BSI Operasional',
        kind: 'bank',
        provider: 'BSI',
        accountNumber: '7192837465',
        accountHolder: 'PTV Studio Pondok',
        archived: false,
        version: 3,
        balanceMinor: '0',
        qris: {
          assetPath: '/finance-assets/qris/ptv-official-qris.png',
          merchantName: 'PTVPRO Studio Pondok',
          nmid: 'ID1024319901827',
          verifiedAt: '2026-10-01T00:00:00.000Z',
        },
      },
    ],
    categories: [
      { id: 'cat-1', name: 'Iuran Kru', kind: 'income', isActive: true },
      { id: 'cat-2', name: 'Konsumsi & Logistik', kind: 'expense', isActive: true },
      { id: 'cat-3', name: 'Operasional Studio', kind: 'expense', isActive: true },
    ],
    transactions: [
      {
        id: 'tx-1',
        occurredOn: '2026-10-28',
        description: '[LEGACY] Kas Kru: Iuran Kas Kru — Taqiu Rabbani Fadillah — Juli 2026 — Rp25.000',
        kind: 'income',
        amountMinor: '2500000',
        status: 'posted',
        auditReference: 'PTV-DEV-236-ptv_pemasukan-tx-1',
        allocations: [{ pocketId: '60e8d033-2794-4219-a960-c56bedca0111', amountMinor: '2500000', direction: 'in' }],
        categoryId: 'cat-1',
        sourceReferences: [{ kind: 'pemasukan', id: 'legacy-pem-1' }],
      },
      {
        id: 'tx-2',
        occurredOn: '2026-10-26',
        description: '[LEGACY] BELI GALON CLEO: HARGA ASLI = RP. 22.000, SUBSIDI DARI ZAIDAN = RP. 2000, UANG KAS YANG KELUAR = RP. 20.000',
        kind: 'expense',
        amountMinor: '2000000',
        status: 'posted',
        auditReference: 'PTV-DEV-236-ptv_pengeluaran-tx-2',
        allocations: [{ pocketId: '60e8d033-2794-4219-a960-c56bedca0111', amountMinor: '2000000', direction: 'out' }],
        categoryId: 'cat-2',
        sourceReferences: [{ kind: 'pengeluaran', id: 'legacy-peng-2' }],
      },
      {
        id: 'tx-3',
        occurredOn: '2026-10-30',
        description: '[LEGACY][BATAL/UNDO] Kas Kru: Iuran Kas Kru — Niki Santri — Juli 2026 — Rp25.000',
        kind: 'income',
        amountMinor: '2500000',
        status: 'reversed',
        auditReference: 'PTV-DEV-236-ptv_pemasukan-tx-3',
        allocations: [],
        categoryId: 'cat-1',
      },
    ],
  },
};

const mockOperationalData: FinanceOperationalData = {
  source: 'staging',
  scope: 'global',
  ownerPtvId: 'PTV-001',
  writesEnabled: false,
  feeDueDay: 10,
  semesters: [
    {
      id: '2941ab08-a7f9-4f35-9539-93131fbe5685',
      name: 'Semester Ganjil 2026/2027',
      startDate: '2026-09-01',
      endDate: '2027-02-28',
      monthlyFeeMinor: '2500000',
      monthlyFees: { '2026-09': '2000000', '2026-10': '2000000', '2026-11': '5000000' },
      isActive: true,
      isArchived: false,
      createdAt: '2026-09-01T00:00:00.000Z',
    },
  ],
  records: [
    {
      id: 'rec-1',
      semesterId: '2941ab08-a7f9-4f35-9539-93131fbe5685',
      ptvId: 'PTV-001',
      crewName: 'Muhammad Zidnal Falah',
      period: '2026-10',
      amountMinor: '2000000',
      paidAmountMinor: '2000000',
      status: 'lunas',
      paymentDate: '2026-10-08',
      method: 'transfer',
      pocketId: '60e8d033-2794-4219-a960-c56bedca0111',
      transactionId: 'tx-1',
      createdAt: '2026-10-08T00:00:00.000Z',
      updatedAt: '2026-10-08T00:00:00.000Z',
    },
  ],
  loans: [
    {
      id: 'loan-1',
      borrowerType: 'kru',
      borrowerId: 'PTV-019',
      borrowerName: 'Taqiu Rabbani Fadillah',
      borrowerContact: '+62 812-0000-1111',
      principalMinor: '10000000',
      interestType: 'none',
      interestRatePercent: 0,
      interestMinor: '0',
      totalDueMinor: '10000000',
      totalPaidMinor: '4000000',
      remainingMinor: '6000000',
      disbursedOn: '2026-10-01',
      dueDate: '2026-11-15',
      disbursedFromPocketId: '60e8d033-2794-4219-a960-c56bedca0111',
      disbursementTxId: null,
      status: 'aktif',
      purpose: 'Talangan konsumsi liputan',
      payments: [
        {
          id: 'pay-1',
          loanId: 'loan-1',
          paidOn: '2026-10-15',
          amountMinor: '4000000',
          toPocketId: '60e8d033-2794-4219-a960-c56bedca0111',
          receiptTxId: null,
          method: 'transfer',
          notes: 'Cicilan tahap 1',
          createdAt: '2026-10-15T00:00:00.000Z',
        },
      ],
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z',
    },
  ],
};

describe('Finance 3.0 Full Feature Parity & Reconciliation Suite', () => {
  it('merender saldo kas aktual Rp 593.276 secara presisi dan menampilkan 6 tab navigasi utama', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/hub/keuangan?tab=ringkasan']}>
        <Finance3Page initialData={mockFinanceData} initialOperationalData={mockOperationalData} />
      </MemoryRouter>
    );

    expect(html).toContain('Keuangan Studio');
    expect(html).toContain('Rp 593.276');
    expect(html).toContain('100% Terekonsiliasi Dasbor PTV');
    expect(html).toContain('Kas Utama Studio');
    expect(html).toContain('Kantong &amp; QRIS');
    expect(html).toContain('Piutang &amp; Tagihan');
  });

  it('merender transaksi resmi dengan judul asli dan badge Migrasi terpisah', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/hub/keuangan?tab=transaksi']}>
        <Finance3Page initialData={mockFinanceData} initialOperationalData={mockOperationalData} />
      </MemoryRouter>
    );

    expect(html).toContain('Buku Riwayat Transaksi');
    expect(html).toContain('Iuran Kas Kru — Taqiu Rabbani Fadillah');
    expect(html).toContain('BELI GALON CLEO');
    expect(html).toContain('Migrasi');
    expect(html).not.toContain('[LEGACY]');
    expect(html).toContain('Transfer Kantong');
  });

  it('merender modul Kantong Keuangan & QRIS lengkap dengan grid kartu berwarna, pencarian, dan verifikasi QRIS', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/hub/keuangan?tab=kantong']}>
        <Finance3Page initialData={mockFinanceData} initialOperationalData={mockOperationalData} />
      </MemoryRouter>
    );

    expect(html).toContain('Kantong Keuangan &amp; Alokasi Kas');
    expect(html).toContain('Cari Kantong');
    expect(html).toContain('Total Saldo Kantong');
    expect(html).toContain('theme-ivory');
    expect(html).toContain('theme-obsidian');
    expect(html).toContain('Transfer Dana Antarkantong');
    expect(html).toContain('QRIS &amp; Metode Pembayaran Resmi Studio');
    expect(html).toContain('PTVPRO Studio Pondok');
    expect(html).toContain('ID1024319901827');
    expect(html).toContain('Menampilkan QRIS tidak dianggap otomatis terkonfirmasi');
  });

  it('merender Halaman Rincian Kantong dengan saldo fokus utama, 3 aksi cepat (Tambah Uang, Pindahkan Uang, Transfer & Bayar), dan riwayat transaksi kantong', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/hub/keuangan?tab=kantong&pocketId=60e8d033-2794-4219-a960-c56bedca0111']}>
        <Finance3Page initialData={mockFinanceData} initialOperationalData={mockOperationalData} />
      </MemoryRouter>
    );

    expect(html).toContain('Rincian Kantong');
    expect(html).toContain('Kas Utama Studio');
    expect(html).toContain('Rp593.276');
    expect(html).toContain('Tambah Uang');
    expect(html).toContain('Pindahkan Uang');
    expect(html).toContain('Transfer &amp; Bayar');
    expect(html).toContain('Cari Transaksi');
    expect(html).toContain('RIWAYAT TRANSAKSI KANTONG');
    expect(html).toContain('+Rp25.000');
    expect(html).toContain('Iuran Kru');
    expect(html).toContain('-Rp20.000');
    expect(html).toContain('Konsumsi &amp; Logistik');

    // Real Browser Visual QA Screenshot Generation (Microsoft Edge Headless)
    const edgePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    const edgeBin = edgePaths.find(p => fs.existsSync(p));
    const artifactDir = 'C:/Users/zidna/.gemini/antigravity/brain/013719a4-97ad-457e-a185-2da2df9a585b';
    const scratchDir = path.join(artifactDir, 'scratch');

    if (edgeBin && fs.existsSync(artifactDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
      const cssContent = fs.readFileSync(
        path.resolve('src/products/hub/keuangan/finance3.css'),
        'utf8'
      );
      const listHtml = renderToStaticMarkup(
        <MemoryRouter initialEntries={['/hub/keuangan?tab=kantong']}>
          <Finance3Page initialData={mockFinanceData} initialOperationalData={mockOperationalData} />
        </MemoryRouter>
      );
      const wrapHtml = (body: string) => `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    html, body { margin: 0; padding: 0; width: 412px; max-width: 412px; box-sizing: border-box; background: #f6f8fb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { padding: 12px; }
    ${cssContent}
  </style>
</head>
<body>${body}</body>
</html>`;

      const listHtmlPath = path.join(scratchDir, 'kantong-list.html');
      const detailHtmlPath = path.join(scratchDir, 'kantong-detail.html');
      fs.writeFileSync(listHtmlPath, wrapHtml(listHtml), 'utf8');
      fs.writeFileSync(detailHtmlPath, wrapHtml(html), 'utf8');

      const listShot = path.join(artifactDir, 'finance3-kantong-list-mobile.png');
      const detailShot = path.join(artifactDir, 'finance3-kantong-detail-mobile.png');

      execFileSync(edgeBin, [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--window-size=412,960',
        `--screenshot=${listShot}`,
        `file:///${listHtmlPath.replace(/\\/g, '/')}`,
      ]);
      execFileSync(edgeBin, [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--window-size=412,1240',
        `--screenshot=${detailShot}`,
        `file:///${detailHtmlPath.replace(/\\/g, '/')}`,
      ]);
      expect(fs.existsSync(listShot)).toBe(true);
      expect(fs.existsSync(detailShot)).toBe(true);
    }
  });

  it('merender modul Iuran Kas Kru & Tabel Semester dengan pemilihan semester dan matriks bulanan', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/hub/keuangan?tab=kas-kru']}>
        <Finance3Page initialData={mockFinanceData} initialOperationalData={mockOperationalData} />
      </MemoryRouter>
    );

    expect(html).toContain('Iuran Kas Kru &amp; Tabel Semester');
    expect(html).toContain('Semester Ganjil 2026/2027');
    expect(html).toContain('Matriks Semester');
    expect(html).toContain('Target Iuran Periode Ini');
    expect(html).toContain('Muhammad Zidnal Falah');
    expect(html).toContain('Taqiu Rabbani Fadillah');
    expect(html).toContain('Tarif Iuran');
  });

  it('merender alur Keuangan -> Pengaturan -> Periode Semester -> Tarif Iuran beserta tombol Ubah Tarif dan Histori Perubahan Tarif', async () => {
    const { PengaturanKeuanganModal } = await import('../../src/products/hub/keuangan/components/PengaturanKeuanganModal');
    const htmlManage = renderToStaticMarkup(
      <PengaturanKeuanganModal
        isOpen={true}
        onClose={() => {}}
        pockets={mockFinanceData.canonical.pockets || []}
        categories={mockFinanceData.canonical.categories || []}
        semesters={mockOperationalData.semesters}
        canManage={true}
        initialSubTab="semester"
        feeHistory={[
          {
            id: 'fee-hist-1',
            semesterId: '2941ab08-a7f9-4f35-9539-93131fbe5685',
            semesterName: 'Semester Ganjil 2026/2027',
            period: '2026-09',
            previousFeeMinor: '2500000',
            newFeeMinor: '2000000',
            changedAt: '2026-10-31T02:00:00.000Z',
            changedByPtvId: 'PTV-001',
            changedByName: 'Muhammad Zidnal Falah',
          },
        ]}
      />
    );

    expect(htmlManage).toContain('Tarif Iuran Kas Kru per Bulan');
    expect(htmlManage).toContain('September 2026');
    expect(htmlManage).toContain('Oktober 2026');
    expect(htmlManage).toContain('November 2026');
    expect(htmlManage).toContain('Desember 2026');
    expect(htmlManage).toContain('Januari 2027');
    expect(htmlManage).toContain('Februari 2027');
    expect(htmlManage).toContain('Ubah Tarif');
    expect(htmlManage).toContain('Histori Perubahan Tarif Iuran');
    expect(htmlManage).toContain('Rp 25.000 → Rp 20.000');
    expect(htmlManage).toContain('Muhammad Zidnal Falah');

    // Jika canManage === false, tombol Ubah Tarif tidak boleh dirender
    const htmlReadOnly = renderToStaticMarkup(
      <PengaturanKeuanganModal
        isOpen={true}
        onClose={() => {}}
        pockets={mockFinanceData.canonical.pockets || []}
        categories={mockFinanceData.canonical.categories || []}
        semesters={mockOperationalData.semesters}
        canManage={false}
        initialSubTab="semester"
      />
    );
    expect(htmlReadOnly).toContain('Tarif Iuran Kas Kru per Bulan');
    expect(htmlReadOnly).not.toContain('Ubah Tarif');
  });

  it('merender modul Piutang & Tagihan dengan rincian pokok, cicilan, sisa tagihan, dan pemisahan akuntansi kas', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/hub/keuangan?tab=piutang']}>
        <Finance3Page initialData={mockFinanceData} initialOperationalData={mockOperationalData} />
      </MemoryRouter>
    );

    expect(html).toContain('Piutang &amp; Pengelolaan Tagihan');
    expect(html).toContain('Prinsip Akuntansi Piutang:');
    expect(html).toContain('Sisa Tagihan Piutang Aktif');
    expect(html).toContain('Talangan konsumsi liputan');
    expect(html).toContain('Rp 60.000'); // sisa tagihan 6000000 minor = Rp 60.000
    expect(html).toContain('Bayar / Cicil');
  });

  it('merender Laporan Keuangan dengan rekap per kantong, rekap per semester, dan unduhan Excel/PDF', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/hub/keuangan?tab=laporan']}>
        <Finance3Page initialData={mockFinanceData} initialOperationalData={mockOperationalData} />
      </MemoryRouter>
    );

    expect(html).toContain('Laporan &amp; Rekapitulasi Pembukuan');
    expect(html).toContain('Saldo Kantong Saat Ini');
    expect(html).toContain('Rekapitulasi Per Kantong Keuangan');
    expect(html).toContain('Rekapitulasi Per Semester');
    expect(html).toContain('Unduh Excel (.xlsx)');
    expect(html).toContain('Unduh PDF');
  });
});
