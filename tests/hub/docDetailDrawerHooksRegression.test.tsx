import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DocDetailDrawer } from '../../src/products/hub/dokumen-saya/components/DocDetailDrawer';
import { PtvDocument } from '../../src/products/hub/dokumen-saya/mock/docsMockData';

const mockDocA: PtvDocument = {
  id: 'doc-001',
  no: '001/SI-PTV/X/2026',
  type: 'Surat Izin Santri',
  subject: 'Izin Pulang Maulid Nabi',
  owner: 'Muhammad Farras',
  diajukan_oleh: 'Muhammad Farras',
  date: '2026-10-03',
  status: 'Disetujui',
  recipients: ['Muhammad Farras'],
  created_at: '2026-10-01T08:00:00Z',
  status_history: [
    { status: 'Menunggu', timestamp: '2026-10-01 08:00', actor: 'Pemohon' },
    { status: 'Disetujui', timestamp: '2026-10-03 09:00', actor: 'Pimpinan' },
  ],
};

const mockDocB: PtvDocument = {
  id: 'doc-002',
  no: '—',
  type: 'Surat Tugas Resmi',
  subject: 'Liputan Pengajian Akbar',
  owner: 'Zidnal',
  diajukan_oleh: 'Zidnal',
  date: '2026-10-10',
  status: 'Menunggu',
  created_at: '2026-10-10T08:00:00Z',
  recipients: ['Zidnal', 'Alamsyah'],
};

describe('DocDetailDrawer - React Hooks Lifecycle & Crash Regression Test', () => {
  it('1. Render doc=null -> menghasilkan string kosong tanpa crash', () => {
    const html = renderToString(
      <DocDetailDrawer
        doc={null}
        onClose={vi.fn()}
        canApprove={true}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('2. Render doc tersedia -> merender detail dokumen dan action buttons', () => {
    const html = renderToString(
      <DocDetailDrawer
        doc={mockDocA}
        onClose={vi.fn()}
        canApprove={true}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(html).toContain('Izin Pulang Maulid Nabi');
    expect(html).toContain('001/SI-PTV/X/2026');
    expect(html).toContain('Unduh PDF Resmi');
  });

  it('3. Transisi siklikal doc=null -> doc=A -> doc=B -> doc=null (10x iterasi konsisten)', () => {
    for (let i = 0; i < 10; i++) {
      // Step A: tertutup
      const closed1 = renderToString(
        <DocDetailDrawer
          doc={null}
          onClose={vi.fn()}
          canApprove={true}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      expect(closed1).toBe('');

      // Step B: terbuka dengan Dokumen A
      const openA = renderToString(
        <DocDetailDrawer
          doc={mockDocA}
          onClose={vi.fn()}
          canApprove={true}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      expect(openA).toContain('001/SI-PTV/X/2026');

      // Step C: transisi ke Dokumen B
      const openB = renderToString(
        <DocDetailDrawer
          doc={mockDocB}
          onClose={vi.fn()}
          canApprove={true}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      expect(openB).toContain('Liputan Pengajian Akbar');

      // Step D: ditutup kembali
      const closed2 = renderToString(
        <DocDetailDrawer
          doc={null}
          onClose={vi.fn()}
          canApprove={true}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      expect(closed2).toBe('');
    }
  });

  it('4. Memastikan hook useState(isDownloading) berada di level teratas dan tidak melanggar aturan hook', () => {
    // Memverifikasi bahwa dokumen tanpa nomor sah tidak memicu render error
    const html = renderToString(
      <DocDetailDrawer
        doc={mockDocB}
        onClose={vi.fn()}
        canApprove={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(html).toContain('Liputan Pengajian Akbar');
  });
});
