import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOfficialDocPdf14, buildOfficialDocPdfBytes, downloadOfficialDocPdf } from '../../src/products/hub/dokumen-saya/utils/docPdfPrinter';
import type { PtvDocument } from '../../src/products/hub/dokumen-saya/mock/docsMockData';

const subject = 'Uji José — “Izin” • D’Angelo × café €5 (A) \\ B';
const fixture = (recipients: number, items = 0): PtvDocument => ({
  id: 'synthetic-pdf-only', no: '014/ST-PTV/X/2026', subject,
  type: 'Surat Tugas', date: '2026-10-29', owner: 'Operator Uji',
  penanggung_jawab: 'Penanda Tangan Uji', status: 'Disetujui', created_at: '2026-10-29T00:00:00Z',
  recipients: Array.from({ length: recipients }, (_, i) => `Santri Uji ${String(i + 1).padStart(3, '0')} José`),
  items: Array.from({ length: items }, (_, i) => `Alat Uji ${String(i + 1).padStart(3, '0')}`),
});

function validateStructure(pdf: string) {
  const tail = pdf.match(/startxref\n(\d+)\n%%EOF\n$/);
  expect(tail).not.toBeNull();
  const start = Number(tail![1]);
  const xref = pdf.slice(start).match(/^xref\n0 (\d+)\n/);
  expect(xref, 'startxref must address the xref keyword').not.toBeNull();
  const count = Number(xref![1]);
  const entries = pdf.slice(start + xref![0].length).split('\n').slice(0, count);
  expect(entries[0]).toBe('0000000000 65535 f ');
  expect(pdf.slice(start)).toContain(`trailer\n<< /Size ${count} /Root 1 0 R >>`);
  for (let id = 1; id < count; id++) {
    expect(entries[id]).toMatch(/^\d{10} 00000 n $/);
    const offset = Number(entries[id].slice(0, 10));
    const next = id + 1 < count ? Number(entries[id + 1].slice(0, 10)) : start;
    const object = pdf.slice(offset, next);
    expect(object.startsWith(`${id} 0 obj\n`), `xref object ${id}`).toBe(true);
    expect(object.endsWith('\nendobj\n')).toBe(true);
    const stream = object.match(/\/Length (\d+) >>\nstream\n/);
    if (stream) {
      const bodyOffset = stream.index! + stream[0].length;
      expect(object.slice(bodyOffset + Number(stream[1]))).toBe('\nendstream\nendobj\n');
    }
  }
  expect(Array.from(pdf).every((char) => char.charCodeAt(0) <= 255)).toBe(true);
  return count;
}

const cases = [
  { recipients: 0, items: 0, pages: 1 },
  { recipients: 1, items: 0, pages: 1 },
  { recipients: 5, items: 0, pages: 1 },
  { recipients: 20, items: 0, pages: 1 },
  { recipients: 21, items: 0, pages: 2 },
  { recipients: 22, items: 0, pages: 2 },
  { recipients: 42, items: 0, pages: 2 },
  { recipients: 43, items: 0, pages: 3 },
  { recipients: 60, items: 0, pages: 3 },
  { recipients: 100, items: 0, pages: 5 },
  { recipients: 0, items: 50, pages: 3 },
  { recipients: 20, items: 7, pages: 2 },
  { recipients: 5, items: 30, pages: 2 },
];
const artifactDir = process.env.PTV_PDF_ARTIFACT_DIR;

describe('PDF byte serialization and A4 pagination', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  afterAll(() => {
    if (artifactDir) writeFileSync(join(artifactDir, 'manifest.json'), JSON.stringify(cases.map((entry) => ({
      ...entry, file: `${entry.recipients}-${entry.items}.pdf`, subject,
      names: fixture(entry.recipients, entry.items).recipients,
      itemNames: fixture(entry.recipients, entry.items).items,
    })), null, 2));
  });

  it.each(cases)('$recipients recipients and $items items retain all rows on $pages pages', ({ recipients, items, pages }) => {
    const doc = fixture(recipients, items);
    const binary = buildOfficialDocPdf14(doc);
    validateStructure(binary);
    expect(binary).toContain(`/Count ${pages} >>`);
    expect(binary.match(/\/Type \/Page\b/g)).toHaveLength(pages);
    expect(binary.match(/\/MediaBox \[0 0 595.28 841.89\]/g)).toHaveLength(pages);
    for (let i = 1; i <= recipients; i++) expect(binary).toContain(`Santri Uji ${String(i).padStart(3, '0')}`);
    for (const item of doc.items!) expect(binary).toContain(item);
    expect(binary).not.toContain('personil lainnya');
    const bytes = buildOfficialDocPdfBytes(doc);
    expect(Buffer.from(bytes).toString('latin1')).toBe(binary);
    if (artifactDir) {
      mkdirSync(artifactDir, { recursive: true });
      writeFileSync(join(artifactDir, `${recipients}-${items}.pdf`), bytes);
    }
  });

  it('escapes WinAnsi Unicode, delimiters, backslashes, controls and combining accents', () => {
    const binary = buildOfficialDocPdf14({ ...fixture(1), subject: subject + '\nCafe\u0301\r\t' });
    expect(binary).toContain('Jos\\351 \\227 \\223Izin\\224');
    expect(binary).toContain('\\(A\\) \\\\ B');
    expect(binary).toContain('\\012Caf\\351\\015\\011');
    validateStructure(binary);
  });

  it('rejects unsupported Helvetica glyphs instead of truncating Unicode code points', () => {
    expect(() => buildOfficialDocPdfBytes({ ...fixture(1), subject: 'Uji 😀' })).toThrow('U+1F600');
  });

  it('detects displaced xref offsets and incorrect stream lengths', () => {
    const binary = buildOfficialDocPdf14(fixture(1));
    expect(() => validateStructure(binary.replace(/startxref\n\d+/, 'startxref\n0'))).toThrow();
    expect(() => validateStructure(binary.replace(/\/Length \d+ >>\nstream/, '/Length 1 >>\nstream'))).toThrow();
  });

  it('downloads exactly the byte buffer validated by the serializer', async () => {
    vi.useFakeTimers();
    let downloaded: Blob | undefined;
    const anchor = { href: '', download: '', style: {}, click: vi.fn() };
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: vi.fn(), removeChild: vi.fn() } });
    vi.stubGlobal('window', { URL: { createObjectURL: (blob: Blob) => { downloaded = blob; return 'blob:synthetic'; }, revokeObjectURL: vi.fn() } });
    await downloadOfficialDocPdf(fixture(43));
    expect(new Uint8Array(await downloaded!.arrayBuffer())).toEqual(buildOfficialDocPdfBytes(fixture(43)));
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.download).toBe('surat-tugas_014_ST-PTV_X_2026.pdf');
    vi.runAllTimers();
  });
});
