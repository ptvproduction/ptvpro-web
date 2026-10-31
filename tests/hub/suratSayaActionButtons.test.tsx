import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ArsipPage } from '../../src/products/hub/arsip/ArsipPage';

// Mock sessionStore so the user has permission to view archive
vi.mock('../../src/core/session/sessionStore', () => ({
  useSessionStore: () => ({
    user: { id: 'test-user', full_name: 'Ahmad Zidni', username: 'zidni' },
    can: () => true,
  }),
}));

// Mock instantData at @shared/hooks/useInstantData
vi.mock('@/shared/hooks/useInstantData', () => ({
  useInstantData: () => ({
    data: [
      {
        id: 'doc-approved-1',
        no: '001/SI-PTV/X/2026',
        subject: 'Liputan Acara Haul Akbar',
        type: 'Surat Izin',
        status: 'Disetujui',
        date: '2026-10-28',
        created_at: '2026-10-28T09:00:00Z',
        diajukan_oleh: 'Ahmad Zidni',
        owner: 'Ahmad Zidni',
      },
      {
        id: 'doc-pending-2',
        no: '—',
        subject: 'Izin Membawa Kamera Sony FX3',
        type: 'Surat Bawa Barang',
        status: 'Menunggu',
        date: '2026-10-29',
        created_at: '2026-10-29T10:00:00Z',
        diajukan_oleh: 'Budi Santoso',
        owner: 'Budi Santoso',
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe('PTVPRO HUB — Micro UI Fix: Aksi Surat Saya & Surat Arsip', () => {
  it('merender pasangan tombol aksi PDF (Primary) dan Rincian (Secondary)', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ArsipPage />
      </MemoryRouter>
    );

    // Memastikan container action buttons memiliki class arsip-doc-actions
    expect(html).toContain('arsip-doc-actions');

    // Memastikan tombol PDF memiliki class primary dan icon download
    expect(html).toContain('arsip-doc-btn-primary');
    expect(html).toContain('arsip-pdf-btn');
    expect(html).toContain('fa-download');
    expect(html).toContain('PDF');

    // Memastikan tombol Rincian memiliki class secondary outline dan icon chevron-right
    expect(html).toContain('arsip-doc-btn-secondary');
    expect(html).toContain('arsip-doc-view-btn');
    expect(html).toContain('fa-chevron-right');
    expect(html).toContain('Rincian');
  });

  it('memiliki aksesibilitas title dan aria-label yang lengkap', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ArsipPage />
      </MemoryRouter>
    );

    expect(html).toContain('title="Unduh PDF Resmi"');
    expect(html).toContain('title="Lihat Rincian Dokumen"');
    expect(html).toContain('aria-label="Unduh PDF surat 001/SI-PTV/X/2026"');
    expect(html).toContain('aria-label="Buka rincian surat 001/SI-PTV/X/2026"');
  });
});
