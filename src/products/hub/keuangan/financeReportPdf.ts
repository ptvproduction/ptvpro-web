import { PDFDocument, PDFDict, PDFName, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { cleanTransactionTitle, formatMinor, type CanonicalCategory } from './financeCanonical';
import { reportTransactionAmountMinor, type LaporanResult } from './laporanService';

export interface FinancePdfAssets { font: Uint8Array; boldFont: Uint8Array; logoPng: Uint8Array }
export interface FinancePdfLayoutRow { page: number; top: number; bottom: number; section: string; text: string[]; lines: string[][]; widths: number[] }
const fontUrl = '/assets/fonts/plus-jakarta-sans/PlusJakartaSans-PdfRegular.ttf';
const boldFontUrl = '/assets/fonts/plus-jakarta-sans/PlusJakartaSans-PdfBold.ttf';
const officialLogoUrl = '/assets/images/BS-X-PTV.webp';
const green = rgb(14 / 255, 79 / 255, 64 / 255);
const ink = rgb(15 / 255, 23 / 255, 42 / 255);
const line = rgb(203 / 255, 213 / 255, 225 / 255);
const margin = 28.5; // Surat: 38 px pada A4 794 × 1122 px.
const pageWidth = 595.28;
const pageHeight = 841.89;
const contentWidth = pageWidth - margin * 2;
const bottomLimit = 54;

export async function loadFinancePdfAssets(): Promise<FinancePdfAssets> {
  const signal = AbortSignal.timeout(15_000);
  const [fontResponse, boldFontResponse, logoResponse] = await Promise.all([fetch(fontUrl, { signal }), fetch(boldFontUrl, { signal }), fetch(officialLogoUrl, { signal })]);
  if (!fontResponse.ok || !boldFontResponse.ok || !logoResponse.ok) throw new Error('Font atau logo kop resmi gagal dimuat.');
  const bitmap = await createImageBitmap(await logoResponse.blob());
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Logo kop tidak dapat disiapkan.');
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Logo kop gagal diproses.')), 'image/png'));
    return { font: new Uint8Array(await fontResponse.arrayBuffer()), boldFont: new Uint8Array(await boldFontResponse.arrayBuffer()), logoPng: new Uint8Array(await blob.arrayBuffer()) };
  } finally { bitmap.close(); }
}

export function wrapFinancePdfText(value: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.replace(/\r/g, '').split('\n')) {
    let current = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (font.widthOfTextAtSize(current ? `${current} ${word}` : word, size) <= width) {
        current = current ? `${current} ${word}` : word;
        continue;
      }
      if (current) { lines.push(current); current = ''; }
      for (const char of word) {
        if (font.widthOfTextAtSize(current + char, size) > width && current) { lines.push(current); current = ''; }
        current += char;
      }
    }
    lines.push(current);
  }
  return lines.length ? lines : [''];
}

export async function buildFinanceReportPdf(
  report: LaporanResult, categories: CanonicalCategory[], assets?: FinancePdfAssets,
  onLayoutRow?: (row: FinancePdfLayoutRow) => void,
): Promise<Uint8Array> {
  const source = assets ?? await loadFinancePdfAssets();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // Full static fonts preserve glyph outlines; variable-font subsetting corrupted P/R/B.
  const features = { kern: false, liga: false, clig: false };
  const regular = await pdf.embedFont(source.font, { subset: false, features });
  const bold = await pdf.embedFont(source.boldFont, { subset: false, features });
  const logo = await pdf.embedPng(source.logoPng);
  pdf.setTitle('LAPORAN KEUANGAN PROGRESIF TV');
  pdf.setAuthor('Progresif TV');
  const created = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date());
  let page: PDFPage;
  let y = 0;
  const unicodeMaps = new Map<PDFFont, Map<string, string>>([[regular, new Map()], [bold, new Map()]]);
  const text = (value: string, x: number, baseline: number, size = 8, font = regular, color = ink) => {
    const mapping = unicodeMaps.get(font)!;
    for (const char of value) {
      const cid = font.encodeText(char).asString();
      const unicode = char.split('').map(unit => unit.charCodeAt(0).toString(16).padStart(4, '0')).join('');
      mapping.set(cid, unicode);
    }
    page.drawText(value, { x, y: baseline, size, font, color });
  };
  const right = (value: string, x: number, baseline: number, size = 8, font = regular, color = ink) => text(value, x - font.widthOfTextAtSize(value, size), baseline, size, font, color);
  function newPage() {
    page = pdf.addPage([pageWidth, pageHeight]);
    if (pdf.getPageCount() === 1) {
      const dimensions = logo.scaleToFit(135, 36);
      page.drawImage(logo, { x: margin, y: pageHeight - 25.5 - dimensions.height, ...dimensions });
      right('PROGRESIF TV', pageWidth - margin, 802, 15, bold, green);
      right('OFFICIAL MEDIA BROADCASTER', pageWidth - margin, 789, 7.5, bold);
      right('Jl. Kyai Dasuki No.1, Lebo, Kecamatan Sidoarjo,', pageWidth - margin, 779, 6.75);
      right('Kabupaten Sidoarjo, Jawa Timur 61223', pageWidth - margin, 770, 6.75);
      for (const [baseline, thickness] of [[760, 1.25], [757.5, 0.6]]) page.drawLine({ start: { x: margin, y: baseline }, end: { x: pageWidth - margin, y: baseline }, thickness, color: green });
      const title = 'LAPORAN KEUANGAN PROGRESIF TV';
      text(title, (pageWidth - bold.widthOfTextAtSize(title, 11.25)) / 2, 739, 11.25, bold);
      text('Jenis: Laporan & Rekap Keuangan', margin, 719);
      text(`Periode: ${report.filter.startDate} s.d. ${report.filter.endDate}`, margin, 706);
      text(`Tanggal pembuatan: ${created} WIB`, margin, 693);
      const scope = report.filter.pocketId === 'semua' ? 'Semua kantong' : report.pocketBalances[0]?.pocket.name ?? report.filter.pocketId;
      const scopeLines = wrapFinancePdfText(`Kantong: ${scope}`, regular, 8, contentWidth);
      scopeLines.forEach((value, index) => text(value, margin, 680 - index * 11));
      y = 660 - (scopeLines.length - 1) * 11;
    } else {
      text('PROGRESIF TV · LAPORAN KEUANGAN (LANJUTAN)', margin, 807, 9, bold, green);
      text(`Periode: ${report.filter.startDate} s.d. ${report.filter.endDate}`, margin, 792, 7.5);
      page.drawLine({ start: { x: margin, y: 783 }, end: { x: pageWidth - margin, y: 783 }, thickness: 0.6, color: green });
      y = 767;
    }
  }
  newPage();
  type Cell = { value: string; right?: boolean };
  function table(section: string, headers: string[], widths: number[], rows: Cell[][]) {
    const fontSize = 7.5;
    const leading = 11;
    const padding = 5;
    const headerLines = headers.map((value, i) => wrapFinancePdfText(value, bold, fontSize, widths[i] - padding * 2));
    const headerHeight = Math.max(...headerLines.map(values => values.length)) * leading + padding * 2;
    function header() {
      text(section, margin, y, 9, bold, green); y -= 10;
      page.drawRectangle({ x: margin, y: y - headerHeight, width: contentWidth, height: headerHeight, color: green });
      let x = margin;
      headerLines.forEach((values, i) => {
        values.forEach((value, index) => text(value, x + padding, y - padding - fontSize - index * leading, fontSize, bold, rgb(1, 1, 1)));
        x += widths[i];
      });
      y -= headerHeight;
    }
    if (y < bottomLimit + headerHeight + 50) newPage();
    header();
    for (const row of rows.length ? rows : [[{ value: 'Tidak ada data pada periode/filter ini.' }]]) {
      const rowWidths = rows.length ? widths : [contentWidth];
      const emphasized = section === 'RINGKASAN KEUANGAN' && /^(Saldo|Total|Arus)/.test(row[0].value);
      const cellFont = emphasized ? bold : regular;
      const cellLines = row.map((cell, i) => wrapFinancePdfText(cell.value, cellFont, fontSize, rowWidths[i] - padding * 2));
      const height = Math.max(...cellLines.map(values => values.length)) * leading + padding * 2;
      if (height > 767 - bottomLimit - headerHeight - 10) throw new Error('Satu baris laporan melebihi tinggi halaman A4; ekspor dihentikan agar isi tidak terpotong.');
      if (y - height < bottomLimit) { newPage(); header(); }
      onLayoutRow?.({ page: pdf.getPageCount(), top: y, bottom: y - height, section, text: row.map(cell => cell.value), lines: cellLines, widths: rowWidths });
      let x = margin;
      row.forEach((cell, i) => {
        page.drawRectangle({ x, y: y - height, width: rowWidths[i], height, borderColor: line, borderWidth: 0.4, ...(emphasized ? { color: rgb(0.96, 0.97, 0.97) } : {}) });
        cellLines[i].forEach((value, index) => {
          const baseline = y - padding - fontSize - index * leading;
          if (cell.right) right(value, x + rowWidths[i] - padding, baseline, fontSize, cellFont);
          else text(value, x + padding, baseline, fontSize, cellFont);
        });
        x += rowWidths[i];
      });
      y -= height;
    }
    y -= 23;
  }
  table('RINGKASAN KEUANGAN', ['Keterangan', 'Jumlah'], [contentWidth - 170, 170], [
    ['Pemasukan Operasional', report.totalInflowMinor], ['Pengeluaran Operasional', report.totalOutflowMinor],
    ['Arus Kas Bersih', report.netCashFlowMinor], ['Saldo Awal Periode', report.openingBalanceMinor],
    ['Saldo Akhir Periode', report.closingBalanceMinor], ['Total Saldo Terbuku Saat Ini', report.totalBalanceMinor],
    ['Volume Transfer Antarkantong', report.totalTransferMinor], [`Transaksi Dibatalkan (${report.reversedCount})`, report.totalReversedMinor],
  ].map(([label, amount]) => [{ value: label }, { value: formatMinor(amount), right: true }]));
  table('SALDO TERBUKU PER KANTONG', ['Kantong', 'Jenis', 'Penyedia / Akun', 'Saldo', 'Status'], [135, 48, 140, 120, contentWidth - 443],
    report.pocketBalances.map(pb => [{ value: pb.pocket.name }, { value: pb.pocket.kind }, { value: `${pb.pocket.provider || 'Kas Tunai'} ${pb.pocket.accountNumber || ''}` }, { value: formatMinor(pb.balanceMinor), right: true }, { value: pb.isReconstructed ? 'Rekonstruksi Historis' : 'Terbuku Sah' }]));
  const catMap = new Map(categories.map(category => [category.id, category.name]));
  table('RINCIAN MUTASI TRANSAKSI', ['No', 'Tanggal', 'Keterangan / Kategori', 'Masuk', 'Keluar', 'Status'], [25, 65, contentWidth - 348, 103, 103, 52],
    report.filteredTransactions.map((tx, index) => {
      const amount = formatMinor(reportTransactionAmountMinor(tx, report.filter.pocketId));
      return [{ value: String(index + 1) }, { value: tx.occurredOn }, { value: `${cleanTransactionTitle(tx.description)}\n${catMap.get(tx.categoryId || '') || (tx.kind === 'transfer' ? 'Transfer Antarkantong' : 'Tanpa Kategori')}` },
        { value: tx.kind === 'income' ? amount : '—', right: true }, { value: tx.kind === 'expense' ? amount : '—', right: true }, { value: tx.status === 'reversed' ? 'VOID' : 'Posted' }];
    }));
  table('DISTRIBUSI KATEGORI', ['Kategori', 'Jenis', 'Transaksi', 'Jumlah', 'Porsi'], [contentWidth - 290, 80, 60, 105, 45],
    report.categoryDistribution.map(category => [{ value: category.categoryName }, { value: category.kind === 'income' ? 'Pemasukan' : 'Pengeluaran' }, { value: String(category.count), right: true }, { value: formatMinor(category.amountMinor), right: true }, { value: `${category.percentage.toFixed(1)}%`, right: true }]));
  const pages = pdf.getPages();
  pages.forEach((item, index) => {
    page = item;
    page.drawLine({ start: { x: margin, y: 43 }, end: { x: pageWidth - margin, y: 43 }, thickness: 0.4, color: line });
    text('Progresif TV · Laporan Keuangan', margin, 31, 7);
    right(`Halaman ${index + 1} dari ${pages.length}`, pageWidth - margin, 31, 7);
  });
  await pdf.flush();
  // Fontkit's full-font CMap aliases the minus sign to hyphen; map the actual encoded text.
  for (const [font, mapping] of unicodeMaps) {
    let cmap = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /PTVUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <ffff>\nendcodespacerange\n';
    const pairs = [...mapping].map(([cid, unicode]) => `<${cid}> <${unicode}>`);
    for (let offset = 0; offset < pairs.length; offset += 100) {
      const chunk = pairs.slice(offset, offset + 100);
      cmap += `${chunk.length} beginbfchar\n${chunk.join('\n')}\nendbfchar\n`;
    }
    cmap += 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
    pdf.context.lookup(font.ref, PDFDict).set(PDFName.of('ToUnicode'), pdf.context.register(pdf.context.flateStream(cmap)));
  }
  return new Uint8Array(await pdf.save({ useObjectStreams: false }));
}
