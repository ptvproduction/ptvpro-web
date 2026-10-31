import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { getSuratIzinDocumentProps } from '../../src/products/hub/surat/generator/suratIzinDocument';
import { buildCapturedA4Pdf } from '../../src/products/hub/dokumen-saya/utils/pdfSerialization';
import { buildOfficialDocPdf14 } from '../../src/products/hub/dokumen-saya/utils/docPdfPrinter';
import type { PtvDocument } from '../../src/products/hub/dokumen-saya/mock/docsMockData';

const doc: PtvDocument = {
  id: 'synthetic', no: '014/SI-PTV/X/2026', type: 'Surat Izin Santri', subject: 'Uji lokal',
  date: '2026-10-29', owner: 'Operator Uji', status: 'Disetujui', created_at: '2026-10-29T00:00:00Z',
  recipients: ['Nama saja'], penanggung_jawab: 'Penerbit server',
  santri_list: [{ nama: 'Santri lengkap', unit: 'SMA', kelas: 'XI A', walikelas: 'Wali Uji', kamar: '01',
    asrama: 'Putra', murobbi: 'Murobbi Uji', intensif: 'Tahfidz', madin: 'Madin Uji', jobdesc: 'Catatan lengkap', jobdesc_enabled: true, is_intern: true }],
};

describe('Surat Izin uses the preview document model', () => {
  it('retains objects and the explicit order of custom columns', () => {
    const props = getSuratIzinDocumentProps({ ...doc, metadata: { activeCols: ['jobdesc','unit','kelas'], customDikeluarkan: 'Stale issuer' } });
    expect(props.activeCols).toEqual(['jobdesc','unit','kelas']);
    expect(props.selectedSantri[0]).toMatchObject(doc.santri_list![0] as Record<string, unknown>);
    expect(props.nomorSurat).toBe(doc.no);
    expect(props.customDikeluarkan).toBe('Penerbit server');
  });
  it('reconstructs historical Asrama column order independently of JSONB object order', () => {
    const props = getSuratIzinDocumentProps({ ...doc, metadata: { activePreset: 'asrama',
      colsConfig: { asrama:true,intensif:true,kamar:true,madin:true,murobbi:true,unit:true } } });
    expect(props.activeCols).toEqual(['unit','kamar','asrama','murobbi','intensif','madin']);
  });
  it('uses Sekolah defaults for older records and preserves issuer visibility', () => {
    expect(getSuratIzinDocumentProps(doc).activeCols).toEqual(['unit','kelas','walikelas','kamar','asrama','murobbi']);
    const props = getSuratIzinDocumentProps({ ...doc, metadata: { activeCols: [], showDikeluarkan:false } });
    expect(props.activeCols).toEqual([]);
    expect(props.showDikeluarkan).toBe(false);
  });
  it('never invents missing historical metadata and blocks the unrelated generic SI template', () => {
    const props = getSuratIzinDocumentProps({ ...doc, santri_list: undefined });
    expect(props.selectedSantri[0]).toMatchObject({ nama:'Nama saja',kelas:'—',walikelas:'—' });
    expect(() => buildOfficialDocPdf14(doc)).toThrow('template preview');
  });
  it('writes image pages and a searchable Unicode text layer through the byte-safe serializer', () => {
    const text = '014/SI-PTV/X/2026\nJosé — “Izin”\n' + Array.from({length:300},(_,i)=>String.fromCodePoint(0x400+i)).join('');
    const bytes = buildCapturedA4Pdf([{width:1,height:1,rgbDeflated:deflateSync(new Uint8Array([255,255,255])),text}]);
    const binary = Buffer.from(bytes).toString('latin1');
    const xref = Number(binary.match(/startxref\n(\d+)/)![1]);
    expect(binary.slice(xref)).toMatch(/^xref\n/);
    expect(binary).toContain('/MediaBox [0 0 595.28 841.89]');
    expect(binary).toContain('/ToUnicode');
    expect(binary).toContain('3 Tr');
    expect(binary).toContain('/Filter /FlateDecode');
    if (process.env.PTV_PDF_ARTIFACT_DIR) {
      const folder = process.env.PTV_PDF_ARTIFACT_DIR;
      mkdirSync(folder,{recursive:true});
      writeFileSync(folder+'/unicode-layer.pdf',bytes);
      writeFileSync(folder+'/unicode-layer.txt',text);
    }
  });
});
