import * as XLSX from 'xlsx';
import type { CanonicalCategory, FinancePocket } from './financeCanonical';
import { cleanTransactionTitle, formatMinor } from './financeCanonical';
import type { LaporanResult } from './laporanService';
import { reportTransactionAmountMinor } from './laporanService';
import type { KasKruRecord } from './kasKruTypes';
import type { PiutangRecord } from './piutangTypes';
import type { FinancePdfAssets } from './financeReportPdf';

/**
 * Format timestamp generator (e.g. 23 Oktober 2026, 14:30 WIB)
 */
export function formatReportDateTime(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

/**
 * Hasilkan workbook .xlsx asli (multi-sheet) menggunakan library xlsx
 */
export function buildLaporanXLSXWorkbook(
  laporan: LaporanResult,
  pockets: FinancePocket[],
  categories: CanonicalCategory[],
  extra?: {
    kasRecords?: KasKruRecord[];
    loans?: PiutangRecord[];
  }
): XLSX.WorkBook {
  const pocketMap = new Map(pockets.map(p => [p.id, p.name]));
  const catMap = new Map(categories.map(c => [c.id, c.name]));
  const wb = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // Sheet 1: Ringkasan Eksekutif
  // -------------------------------------------------------------
  const summaryRows: (string | number)[][] = [
    ['PROGRESIF TV — STUDIO BROADCASTING & MEDIA PRODUCTION'],
    ['LAPORAN KEUANGAN & REKONSILIASI KAS RESMI FINANCE 3.0'],
    [`Periode: ${laporan.filter.startDate} s/d ${laporan.filter.endDate}`],
    [`Tanggal Unduh: ${formatReportDateTime()}`],
    ['Status: Rekonsiliasi Buku Utama Staging (swadgljnyelsjstqqxbm)'],
    [],
    ['INDIKATOR KEUANGAN', 'NOMINAL (RUPIAH)', 'KETERANGAN'],
    ['Pemasukan Operasional Sah', Number(laporan.totalInflowMinor) / 100, 'Di luar transfer & transaksi reversed'],
    ['Pengeluaran Operasional Sah', Number(laporan.totalOutflowMinor) / 100, 'Beban operasional studio sah'],
    ['Arus Kas Bersih (Net Cash Flow)', Number(laporan.netCashFlowMinor) / 100, 'Pemasukan dikurangi Pengeluaran'],
    ['Volume Transfer Antar-Kantong', Number(laporan.totalTransferMinor) / 100, 'Net Zero (Pemindahan saldo internal)'],
    ['Total Transaksi Reversed', Number(laporan.totalReversedMinor) / 100, `${laporan.reversedCount} transaksi batal historis`],
    ['Total Saldo Terbuku', Number(laporan.totalBalanceMinor) / 100, laporan.filter.pocketId === 'semua' ? 'Seluruh kantong aktif studio saat ini' : 'Kantong terpilih saat ini'],
    ['Saldo Awal Periode', Number(laporan.openingBalanceMinor) / 100, laporan.filter.startDate],
    ['Saldo Akhir Periode', Number(laporan.closingBalanceMinor) / 100, laporan.filter.endDate],
    [],
    ['DISTRIBUSI KATEGORI TERBANYAK', 'JENIS', 'JUMLAH TRANSAKSI', 'TOTAL (RUPIAH)', 'PORSI'],
  ];

  for (const cat of laporan.categoryDistribution) {
    summaryRows.push([
      cat.categoryName,
      cat.kind === 'income' ? 'Pemasukan' : 'Pengeluaran',
      cat.count,
      Number(cat.amountMinor) / 100,
      `${cat.percentage.toFixed(1)}%`,
    ]);
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 45 }, { wch: 18 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Eksekutif');

  // -------------------------------------------------------------
  // Sheet 2: Mutasi Transaksi
  // -------------------------------------------------------------
  const txRows: (string | number)[][] = [
    [
      'No',
      'Tanggal',
      'Keterangan Transaksi',
      'Jenis',
      'Kategori',
      'Kantong Terkait',
      'Status',
      'Masuk (Rp)',
      'Keluar (Rp)',
      'Referensi Audit',
    ],
  ];

  let no = 1;
  for (const tx of laporan.filteredTransactions) {
    const isIncome = tx.kind === 'income';
    const isExpense = tx.kind === 'expense';
    const isTransfer = tx.kind === 'transfer';
    const categoryName = tx.categoryId ? catMap.get(tx.categoryId) || '—' : isTransfer ? 'Transfer Internal' : '—';
    const pocketNames = (tx.allocations || [])
      .map(a => pocketMap.get(a.pocketId) || 'Kantong')
      .join(', ');

    txRows.push([
      no++,
      tx.occurredOn,
      cleanTransactionTitle(tx.description),
      isIncome ? 'Pemasukan' : isExpense ? 'Pengeluaran' : 'Transfer Antar-Kantong',
      categoryName,
      pocketNames || '—',
      tx.status === 'reversed' ? 'Dibatalkan (Reversed)' : 'Posted',
      isIncome ? Number(reportTransactionAmountMinor(tx, laporan.filter.pocketId)) / 100 : 0,
      isExpense ? Number(reportTransactionAmountMinor(tx, laporan.filter.pocketId)) / 100 : 0,
      tx.auditReference,
    ]);
  }

  const wsTx = XLSX.utils.aoa_to_sheet(txRows);
  wsTx['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 42 },
    { wch: 18 },
    { wch: 22 },
    { wch: 24 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 28 },
  ];
  wsTx['!autofilter'] = { ref: `A1:J${txRows.length}` };
  XLSX.utils.book_append_sheet(wb, wsTx, 'Mutasi Transaksi');

  // -------------------------------------------------------------
  // Sheet 3: Saldo Kantong Resmi
  // -------------------------------------------------------------
  const pocketRows: (string | number)[][] = [
    ['Nama Kantong', 'Jenis', 'Penyedia / Bank', 'Nomor Rekening', 'Saldo Terbuku (Rp)', 'Status Verifikasi'],
  ];

  for (const pb of laporan.pocketBalances) {
    pocketRows.push([
      pb.pocket.name,
      pb.pocket.kind,
      pb.pocket.provider || 'Kas Tunai',
      pb.pocket.accountNumber || '—',
      Number(pb.balanceMinor) / 100,
      pb.isReconstructed ? 'Saldo Rekonstruksi Historis (Rp 520.276)' : 'Terbuku Terverifikasi',
    ]);
  }

  const wsPockets = XLSX.utils.aoa_to_sheet(pocketRows);
  wsPockets['!cols'] = [
    { wch: 28 },
    { wch: 14 },
    { wch: 20 },
    { wch: 22 },
    { wch: 22 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPockets, 'Saldo Kantong Resmi');

  // -------------------------------------------------------------
  // Sheet 4: Kas Kru & Piutang (Jika data tersedia)
  // -------------------------------------------------------------
  if (extra?.kasRecords || extra?.loans) {
    const opRows: (string | number)[][] = [
      ['--- DATA OPERASIONAL KAS KRU & PIUTANG ---'],
      [],
      ['KAS KRU: CATATAN PEMBAYARAN'],
      ['No', 'Nama Kru', 'PTV ID', 'Periode', 'Nominal (Rp)', 'Terbayar (Rp)', 'Status', 'Tanggal Bayar', 'Metode'],
    ];

    let kkNo = 1;
    for (const kr of (extra.kasRecords || [])) {
      opRows.push([
        kkNo++,
        kr.crewName,
        kr.ptvId,
        kr.period,
        Number(kr.amountMinor) / 100,
        Number(kr.paidAmountMinor) / 100,
        kr.status,
        kr.paymentDate || '—',
        kr.method,
      ]);
    }

    opRows.push([]);
    opRows.push(['PIUTANG: DAFTAR PINJAMAN & BUNGA']);
    opRows.push([
      'No',
      'Nama Peminjam',
      'Tipe',
      'Pokok (Rp)',
      'Bunga',
      'Total Tagihan (Rp)',
      'Terbayar (Rp)',
      'Sisa (Rp)',
      'Jatuh Tempo',
      'Status',
    ]);

    let pNo = 1;
    for (const l of (extra.loans || [])) {
      opRows.push([
        pNo++,
        l.borrowerName,
        l.borrowerType,
        Number(l.principalMinor) / 100,
        l.interestType === 'flat' ? `Flat ${l.interestRatePercent}% (Rp ${(Number(l.interestMinor) / 100).toLocaleString('id-ID')})` : 'Tanpa Bunga (0%)',
        Number(l.totalDueMinor) / 100,
        Number(l.totalPaidMinor) / 100,
        Number(l.remainingMinor) / 100,
        l.dueDate || '—',
        l.status,
      ]);
    }

    const wsOp = XLSX.utils.aoa_to_sheet(opRows);
    wsOp['!cols'] = [
      { wch: 6 },
      { wch: 24 },
      { wch: 14 },
      { wch: 16 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, wsOp, 'Kas Kru & Piutang');
  }

  return wb;
}

/**
 * Ekspor file spreadsheet .XLSX asli (multi-sheet) dan unduh langsung
 */
export function exportLaporanXLSX(
  laporan: LaporanResult,
  pockets: FinancePocket[],
  categories: CanonicalCategory[],
  extra?: {
    kasRecords?: KasKruRecord[];
    loans?: PiutangRecord[];
  }
): string {
  const wb = buildLaporanXLSXWorkbook(laporan, pockets, categories, extra);
  const fileName = `Laporan-Keuangan-PTVPRO-${laporan.filter.startDate}-sd-${laporan.filter.endDate}.xlsx`;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    XLSX.writeFile(wb, fileName);
  }
  return fileName;
}

export async function buildLaporanPdf14(
  laporan: LaporanResult, _pockets: FinancePocket[], categories: CanonicalCategory[], assets?: FinancePdfAssets,
): Promise<string> {
  const { buildFinanceReportPdf } = await import('./financeReportPdf');
  const bytes = await buildFinanceReportPdf(laporan, categories, assets);
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8192) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  return chunks.join('');
}

export async function downloadLaporanPDF(
  laporan: LaporanResult, pockets: FinancePocket[], categories: CanonicalCategory[], assets?: FinancePdfAssets,
): Promise<string> {
  const binary = await buildLaporanPdf14(laporan, pockets, categories, assets);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const fileName = `Laporan-Keuangan-PTVPRO-${laporan.filter.startDate}-sd-${laporan.filter.endDate}.pdf`;
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const url = window.URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = fileName;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1500);
  }
  return fileName;
}

export const exportLaporanPDF = downloadLaporanPDF;

/**
 * Mencetak lembar laporan resmi melalui dialog browser print (HTML printable alternative)
 */
export function printLaporanHtml(
  laporan: LaporanResult,
  pockets: FinancePocket[],
  categories: CanonicalCategory[]
): void {
  const pocketMap = new Map(pockets.map(p => [p.id, p.name]));
  const catMap = new Map(categories.map(c => [c.id, c.name]));

  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) {
    alert('Jendela cetak pop-up terblokir oleh peramban. Izinkan pop-up untuk mencetak laporan.');
    return;
  }

  const rowsHtml = laporan.filteredTransactions.map((tx, idx) => {
    const isIncome = tx.kind === 'income';
    const isExpense = tx.kind === 'expense';
    const isReversed = tx.status === 'reversed';
    const catName = tx.categoryId ? catMap.get(tx.categoryId) || '—' : 'Transfer';
    const pNames = (tx.allocations || []).map(a => pocketMap.get(a.pocketId) || 'Kas').join(', ');

    return `
      <tr class="${isReversed ? 'row-reversed' : ''}">
        <td style="text-align: center;">${idx + 1}</td>
        <td>${tx.occurredOn}</td>
        <td><strong>${tx.description}</strong><br><small style="color: #64748b;">Ref: ${tx.auditReference}</small></td>
        <td>${catName}</td>
        <td>${pNames}</td>
        <td style="text-align: center;">
          <span class="badge ${isReversed ? 'badge-rev' : 'badge-posted'}">
            ${isReversed ? 'Reversed' : 'Posted'}
          </span>
        </td>
        <td style="text-align: right; color: ${isIncome && !isReversed ? '#059669' : '#0f172a'}; font-weight: 600;">
          ${isIncome ? formatMinor(tx.amountMinor) : '—'}
        </td>
        <td style="text-align: right; color: ${isExpense && !isReversed ? '#e11d48' : '#0f172a'}; font-weight: 600;">
          ${isExpense ? formatMinor(tx.amountMinor) : '—'}
        </td>
      </tr>
    `;
  }).join('');

  const pocketRowsHtml = laporan.pocketBalances.map(pb => `
    <tr>
      <td><strong>${pb.pocket.name}</strong></td>
      <td>${pb.pocket.kind}</td>
      <td>${pb.pocket.provider || 'Kas Tunai'} (${pb.pocket.accountNumber || '—'})</td>
      <td style="text-align: right; font-weight: 700;">${formatMinor(pb.balanceMinor)}</td>
      <td>${pb.isReconstructed ? '<span style="color:#d97706; font-size:12px;">Saldo Rekonstruksi Historis</span>' : 'Terbuku'}</td>
    </tr>
  `).join('');

  const catRowsHtml = laporan.categoryDistribution.slice(0, 8).map(c => `
    <tr>
      <td>${c.categoryName}</td>
      <td><span class="badge ${c.kind === 'income' ? 'badge-income' : 'badge-expense'}">${c.kind === 'income' ? 'Pemasukan' : 'Pengeluaran'}</span></td>
      <td style="text-align: center;">${c.count}</td>
      <td style="text-align: right; font-weight: 600;">${formatMinor(c.amountMinor)}</td>
      <td style="text-align: right;">${c.percentage.toFixed(1)}%</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8">
      <title>Laporan Keuangan Studio PTVPRO — ${laporan.filter.startDate} s/d ${laporan.filter.endDate}</title>
      <style>
        @page { size: A4; margin: 16mm 14mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #0f172a; line-height: 1.45; margin: 0; padding: 24px; }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
        .brand-title { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #0f172a; }
        .brand-sub { font-size: 12px; color: #475569; margin-top: 2px; }
        .meta-box { text-align: right; font-size: 11.5px; color: #475569; }
        h2 { font-size: 15px; font-weight: 750; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin: 20px 0 10px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.03em; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
        .summary-card .lbl { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 4px; }
        .summary-card .val { font-size: 16px; font-weight: 800; color: #0f172a; }
        .summary-card.inflow .val { color: #059669; }
        .summary-card.outflow .val { color: #e11d48; }
        .summary-card.net .val { color: #2563eb; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 18px; }
        th, td { border: 1px solid #cbd5e1; padding: 7px 10px; }
        th { background: #f1f5f9; font-weight: 700; text-align: left; color: #334155; }
        tr:nth-child(even) { background: #f8fafc; }
        .row-reversed { background: #fff1f2 !important; color: #9f1239; }
        .badge { display: inline-block; padding: 2px 6px; font-size: 10px; font-weight: 700; border-radius: 4px; text-transform: uppercase; }
        .badge-posted { background: #dcfce7; color: #166534; }
        .badge-rev { background: #fee2e2; color: #991b1b; }
        .badge-income { background: #ecfdf5; color: #065f46; }
        .badge-expense { background: #fff1f2; color: #9f1239; }
        .disclaimer { background: #fefce8; border: 1px solid #fef08a; border-radius: 6px; padding: 10px 14px; font-size: 11px; color: #713f12; margin-top: 24px; line-height: 1.5; }
        .footer-note { font-size: 11px; color: #64748b; text-align: center; margin-top: 28px; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand-title">PROGRESIF TV STUDIO</div>
          <div class="brand-sub">Sistem Informasi Keuangan Resmi Finance 2.0</div>
        </div>
        <div class="meta-box">
          <strong>LAPORAN KEUANGAN RESMI</strong><br>
          Periode: ${laporan.filter.startDate} s/d ${laporan.filter.endDate}<br>
          Dicetak: ${formatReportDateTime()}
        </div>
      </div>

      <div class="summary-grid">
        <div class="summary-card inflow">
          <div class="lbl">Pemasukan Operasional</div>
          <div class="val">${formatMinor(laporan.totalInflowMinor)}</div>
        </div>
        <div class="summary-card outflow">
          <div class="lbl">Pengeluaran Operasional</div>
          <div class="val">${formatMinor(laporan.totalOutflowMinor)}</div>
        </div>
        <div class="summary-card net">
          <div class="lbl">Arus Kas Bersih</div>
          <div class="val">${formatMinor(laporan.netCashFlowMinor)}</div>
        </div>
        <div class="summary-card">
          <div class="lbl">Total Saldo Terbuku</div>
          <div class="val">${formatMinor(laporan.totalBalanceMinor)}</div>
        </div>
      </div>

      <h2>1. Saldo Terbuku Per Kantong</h2>
      <table>
        <thead>
          <tr>
            <th>Nama Kantong</th>
            <th>Jenis</th>
            <th>Penyedia / Akun</th>
            <th style="text-align: right;">Saldo Terbuku</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${pocketRowsHtml}
        </tbody>
      </table>

      ${laporan.categoryDistribution.length > 0 ? `
        <h2>2. Distribusi Kategori Transaksi</h2>
        <table>
          <thead>
            <tr>
              <th>Nama Kategori</th>
              <th>Jenis</th>
              <th style="text-align: center;">Jumlah Transaksi</th>
              <th style="text-align: right;">Total Nominal</th>
              <th style="text-align: right;">Porsi</th>
            </tr>
          </thead>
          <tbody>
            ${catRowsHtml}
          </tbody>
        </table>
      ` : ''}

      <h2>3. Rincian Mutasi Transaksi (${laporan.filteredTransactions.length} Record)</h2>
      <table>
        <thead>
          <tr>
            <th style="text-align: center; width: 30px;">No</th>
            <th style="width: 80px;">Tanggal</th>
            <th>Keterangan Transaksi</th>
            <th>Kategori</th>
            <th>Kantong</th>
            <th style="text-align: center; width: 60px;">Status</th>
            <th style="text-align: right; width: 110px;">Masuk (Rp)</th>
            <th style="text-align: right; width: 110px;">Keluar (Rp)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="disclaimer">
        <strong>Catatan Integritas Pembukuan:</strong><br>
        1. Transaksi internal (pindah kantong) dihitung secara net-zero dan tidak memengaruhi total pendapatan atau beban operasional.<br>
        2. Transaksi berstatus <em>reversed</em> (dibatalkan) diisolasi dan tidak diperhitungkan dalam mutasi kas aktif.<br>
        3. Saldo Kas Utama Studio sebesar Rp 520.276,00 merupakan hasil rekonsiliasi pembukuan historis, bukan hasil opname kas fisik langsung.<br>
        4. Dokumen ini dicetak langsung dari sistem pembukuan Finance 2.0 PTVPRO tanpa modifikasi angka.
      </div>

      <div class="footer-note">
        Dokumen Resmi Pembukuan — Progresif TV Studio · Dilindungi Protokol Integritas PostgreSQL 17
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
