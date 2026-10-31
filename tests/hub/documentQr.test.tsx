import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DocDetailDrawer } from '../../src/products/hub/dokumen-saya/components/DocDetailDrawer';
import { PtvDocument } from '../../src/products/hub/dokumen-saya/mock/docsMockData';

describe('QR verifikasi surat resmi', () => {
  const doc: PtvDocument = { id: 'si_internal-test', no: '007/SI-PTV/X/2026', subject: 'Surat Uji',
    type: 'Surat Izin Santri', date: '2026-10-20', owner: 'Operator Uji', status: 'Disetujui', created_at: '2026-10-20' };
  function render(value = doc) {
    return renderToStaticMarkup(<DocDetailDrawer doc={value} onClose={() => {}} canApprove={false}
      onApprove={() => {}} onReject={() => {}} onDelete={() => {}} defaultExpanded />);
  }
  it('menampilkan QR SVG nyata dan link resmi dengan nomor asli tanpa klaim verifikasi lokal', () => {
    const html = render();
    expect(html).toContain('QR verifikasi surat 007/SI-PTV/X/2026');
    expect(html).toContain('shape-rendering="crispEdges"');
    expect(html).toContain('https://ptvpro.com/verifikasi-surat/007%2FSI-PTV%2FX%2F2026');
    expect(html).toContain('Nomor Surat: 007/SI-PTV/X/2026');
    expect(html).toContain('href="/verifikasi-surat?nomor=007%2FSI-PTV%2FX%2F2026"');
    expect(html).toContain('Buka Verifikasi');
    expect(html).not.toContain('VERIF-SI_');
    expect(html).not.toContain('Dokumen Resmi Sah &amp; Terverifikasi');
  });
  it('tidak menerbitkan QR untuk dokumen yang belum disetujui', () => {
    expect(render({ ...doc, status: 'Menunggu' })).not.toContain('QR verifikasi surat');
  });
});
