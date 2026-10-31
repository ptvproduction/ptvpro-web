import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFArray, PDFDict, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { buildFinanceReportPdf, type FinancePdfLayoutRow } from '../../src/products/hub/keuangan/financeReportPdf';
import { generateLaporan } from '../../src/products/hub/keuangan/laporanService';
import type { CanonicalTransaction } from '../../src/products/hub/keuangan/financeCanonical';
import { financePdfTestAssets } from './financePdfTestAssets';

describe('Finance official letter PDF layout', () => {
  it.each([1, 90])('keeps all %s rows whole, repeats table headers and reserves footer space', async count => {
    const transactions: CanonicalTransaction[] = Array.from({ length: count }, (_, i) => ({ id: String(i), description: `Layanan ${i}: keterangan lengkap yang dibungkus tanpa dipotong. ${'Keterangan panjang '.repeat(i % 4)}`, amountMinor: '123456789', kind: 'income', status: 'posted', occurredOn: '2026-10-10', auditReference: String(i), allocations: [] }));
    const report = generateLaporan(transactions, [], [], { datePreset: 'semua', startDate: '2026-10-01', endDate: '2026-10-31', pocketId: 'semua', categoryId: 'semua', kind: 'semua', status: 'posted_only' });
    const rows: FinancePdfLayoutRow[] = [];
    const before = structuredClone(report);
    const bytes = await buildFinanceReportPdf(report, [], financePdfTestAssets, row => rows.push(row));
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe('LAPORAN KEUANGAN PROGRESIF TV');
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(count === 90 ? 3 : 1);
    expect(rows.filter(row => row.section === 'RINCIAN MUTASI TRANSAKSI')).toHaveLength(count);
    const regular = fontkit.create(financePdfTestAssets.font);
    for (const row of rows.filter(value => value.section === 'RINCIAN MUTASI TRANSAKSI')) {
      expect(row.lines[5]).toEqual(['Posted']);
      expect(row.lines[3]).toHaveLength(1);
      expect(row.lines[2].join(' ')).toContain(transactions[Number(row.text[0]) - 1].description.trim());
      row.lines.forEach((lines, column) => lines.forEach(value => {
        const width = regular.layout(value, { kern: false, liga: false, clig: false }).glyphs.reduce((sum, glyph) => sum + glyph.advanceWidth, 0) / regular.unitsPerEm * 7.5;
        expect(width).toBeLessThanOrEqual(row.widths[column] - 10 + 0.001);
      }));
    }
    for (const row of rows) {
      expect(row.bottom).toBeGreaterThanOrEqual(54);
      expect(row.top).toBeLessThan(768);
      expect(row.bottom).toBeLessThan(row.top);
    }
    for (let i = 1; i < rows.length; i++) if (rows[i].page === rows[i - 1].page) expect(rows[i].top).toBeLessThanOrEqual(rows[i - 1].bottom);
    expect(rows.find(row => row.section === 'RINCIAN MUTASI TRANSAKSI')?.text[2]).toContain(transactions[0].description.trim());
    expect(rows.find(row => row.text[0] === 'Pemasukan Operasional')?.text[1]).toBe(`Rp ${(BigInt(count) * 123456789n / 100n).toLocaleString('id-ID')},${String((BigInt(count) * 123456789n) % 100n).padStart(2, '0')}`);
    expect(report).toEqual(before);
  });

  it('embeds intact static glyph programs and matching Unicode/GID maps for previously damaged text', async () => {
    const sample = 'PROGRESIF TV LAPORAN KEUANGAN Rp 593.276,00 Éé — − (PTV) / BRI';
    const report = generateLaporan([{ id: 'glyph', description: sample, amountMinor: '59327600', kind: 'income', status: 'posted', occurredOn: '2026-10-10', auditReference: 'original', allocations: [] }], [], [], { datePreset: 'semua', startDate: '2026-10-01', endDate: '2026-10-31', pocketId: 'semua', categoryId: 'semua', kind: 'semua', status: 'posted_only' });
    const bytes = await buildFinanceReportPdf(report, [], financePdfTestAssets);
    const pdf = await PDFDocument.load(bytes);
    const checked = new Set<string>();
    for (const page of pdf.getPages()) {
      const fonts = page.node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
      for (const [, ref] of fonts.entries()) {
        const font = pdf.context.lookup(ref, PDFDict);
        const descendant = font.lookup(PDFName.of('DescendantFonts'), PDFArray).lookup(0, PDFDict);
        const descriptor = descendant.lookup(PDFName.of('FontDescriptor'), PDFDict);
        const stream = pdf.context.lookup(descriptor.get(PDFName.of('FontFile2')));
        if (!(stream instanceof PDFRawStream)) throw new Error('Embedded font stream missing');
        const embedded = decodePDFRawStream(stream).decode();
        const expected = Buffer.from(embedded).equals(Buffer.from(financePdfTestAssets.font)) ? financePdfTestAssets.font : financePdfTestAssets.boldFont;
        expect(Buffer.from(embedded).equals(Buffer.from(expected))).toBe(true);
        const key = descriptor.toString();
        if (checked.has(key)) continue;
        checked.add(key);
        const actual = fontkit.create(embedded);
        const source = fontkit.create(expected);
        const unicodeStream = pdf.context.lookup(font.get(PDFName.of('ToUnicode')));
        if (!(unicodeStream instanceof PDFRawStream)) throw new Error('Unicode map missing');
        const unicode = new TextDecoder().decode(decodePDFRawStream(unicodeStream).decode());
        expect(descendant.get(PDFName.of('CIDToGIDMap'))?.toString()).toBe('/Identity');
        const printed = expected === financePdfTestAssets.font ? sample : 'PROGRESIF TV LAPORAN KEUANGAN Rp 593.276,00';
        for (const char of new Set(printed.replace(/\s/g, ''))) {
          const glyph = source.glyphForCodePoint(char.codePointAt(0)!);
          const out = actual.getGlyph(glyph.id);
          expect(out.path.toSVG().length).toBeGreaterThan(0);
          expect(out.bbox.width).toBeCloseTo(glyph.bbox.width);
          expect(out.advanceWidth).toBe(glyph.advanceWidth);
          const cid = glyph.id.toString(16).padStart(4, '0');
          const mapped = unicode.toLowerCase().match(new RegExp(`<${cid}> <([0-9a-f]+)>`));
          expect(mapped).not.toBeNull();
          expect(mapped![1]).toBe(char.codePointAt(0)!.toString(16).padStart(4, '0'));
        }
        for (const char of 'PRB') {
          const glyph = actual.glyphForCodePoint(char.codePointAt(0)!);
          expect(glyph.bbox.width).toBeLessThan(glyph.advanceWidth * 1.5);
        }
      }
    }
    expect(checked.size).toBe(2);
  });
});
