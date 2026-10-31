import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PeminjamanPage } from '../../src/products/hub/peminjaman/PeminjamanPage';
import { useSessionStore } from '../../src/core/session';
import { dialogManager } from '../../src/shared/utils/dialogManager';
import fs from 'fs';
import path from 'path';

// Mock session and instant data
vi.mock('@core/session', () => ({
  useSessionStore: vi.fn(),
}));

vi.mock('@/shared/hooks/useInstantData', () => ({
  useInstantData: vi.fn(({ key }) => {
    if (key === 'peminjaman_loans_list') {
      return {
        data: [
          {
            id: 'loan-1',
            transaction_id: 'TXN-001',
            peminjam_nama: 'Muhammad Zidnal Falah',
            keperluan: 'Produksi Podcast',
            tanggal_pinjam: '2026-10-20',
            tenggat_kembali: '2026-10-22',
            status: 'dipinjam',
            nama_alat: 'Sony FX3',
            kode_unit: 'CAM-01',
            kategori: 'Kamera',
            created_at: '2026-10-20T10:00:00Z',
          },
          {
            id: 'loan-2',
            transaction_id: 'TXN-002',
            peminjam_nama: 'Farras Ahmad',
            keperluan: 'Dokumentasi Acara',
            tanggal_pinjam: '2026-10-21',
            tenggat_kembali: '2026-10-23',
            status: 'dipinjam',
            nama_alat: 'Wireless Mic',
            kode_unit: 'MIC-01',
            kategori: 'Audio',
            created_at: '2026-10-21T10:00:00Z',
          },
          {
            id: 'loan-3',
            transaction_id: 'TXN-003',
            peminjam_nama: 'Muhammad Zidnal Falah',
            keperluan: 'Liputan Lapangan',
            tanggal_pinjam: '2026-10-15',
            tenggat_kembali: '2026-10-16',
            status: 'dikembalikan',
            nama_alat: 'Tripod Carbon',
            kode_unit: 'TRP-01',
            kategori: 'Tripod',
            created_at: '2026-10-15T10:00:00Z',
          },
        ],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    return { data: [], isLoading: false, error: null, refetch: vi.fn() };
  }),
}));

describe('PTV-DEV-190: Mobile UX Stabilization & Polish Verification', () => {
  beforeEach(() => {
    (useSessionStore as any).mockReturnValue({
      user: {
        id: 'usr-zidnal-001',
        ptv_id: 'PTV-001',
        full_name: 'Muhammad Zidnal Falah',
        email: 'zidnal@ptv.id',
      },
      can: () => true,
    });
  });

  it('1. Peminjaman Alat: Filter "History Saya" menggantikan "Milik Saya" dan filter "Terlambat" telah dihapus', () => {
    const html = renderToString(<PeminjamanPage />);

    // Filter "History Saya" wajib tampil
    expect(html).toContain('History Saya');

    // Filter "Milik Saya" dan "Terlambat" dilarang ada di rail
    expect(html).not.toContain('Milik Saya');
    expect(html).not.toMatch(/role="tab"[^>]*>Terlambat<\/button>/);

    // Default tab aktif: Sedang Dipinjam
    expect(html).toContain('Sedang Dipinjam');
  });

  it('2. Anti Auto-Zoom: index.html TIDAK menggunakan maximum-scale=1 atau user-scalable=no', () => {
    const htmlPath = path.resolve(process.cwd(), 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    expect(htmlContent).not.toMatch(/maximum-scale\s*=\s*1/i);
    expect(htmlContent).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(htmlContent).toMatch(/<meta name="viewport" content="width=device-width, initial-scale=1\.0"/);
  });

  it('3. Anti Auto-Zoom: CSS base memuat aturan font-size minimal 16px untuk mobile inputs/selects/textareas', () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles/base.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    expect(cssContent).toMatch(/@media\s*\(\s*max-width\s*:\s*768px\s*\)/);
    expect(cssContent).toMatch(/font-size\s*:\s*16px\s*!important/);
  });

  it('4. Global Modal Scroll Lock: dialogManager menambahkan kelas modal-open ke document.body', () => {
    const classListSet = new Set<string>();
    const originalDocument = (globalThis as any).document;
    const originalWindow = (globalThis as any).window;

    (globalThis as any).window = {
      scrollY: 0,
      innerWidth: 1024,
      scrollTo: vi.fn(),
    };
    (globalThis as any).document = {
      body: {
        classList: {
          add: (cls: string) => classListSet.add(cls),
          remove: (cls: string) => classListSet.delete(cls),
          contains: (cls: string) => classListSet.has(cls),
        },
        style: {},
      },
      documentElement: {
        clientWidth: 1024,
        scrollTop: 0,
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
        },
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    try {
      const unregister = dialogManager.register({
        id: 'test-modal-190',
        onClose: vi.fn(),
        element: {} as any,
      });

      expect((globalThis as any).document.body.classList.contains('modal-open')).toBe(true);

      unregister();
      expect((globalThis as any).document.body.classList.contains('modal-open')).toBe(false);
    } finally {
      (globalThis as any).document = originalDocument;
      (globalThis as any).window = originalWindow;
    }
  });

  it('5. Floating Dock Auto-Hide: shell.css menyembunyikan floating dock saat modal aktif', () => {
    const shellCssPath = path.resolve(process.cwd(), 'src/styles/shell.css');
    const shellContent = fs.readFileSync(shellCssPath, 'utf8');

    expect(shellContent).toMatch(/body\.modal-open\s+\.ptv-floating-dock/);
    expect(shellContent).toMatch(/body:has\(\[role="dialog"\]\)\s+\.ptv-floating-dock/);
  });

  it('6. Discovery Sheet: Gesture scroll konten terpisah dari drag handle & spring transition', () => {
    const sheetPath = path.resolve(process.cwd(), 'src/products/hub/shell/WorkspaceBottomSheet.tsx');
    const sheetContent = fs.readFileSync(sheetPath, 'utf8');

    // Drag handle terpisah
    expect(sheetContent).not.toMatch(/onTouchStart=\{\(e\)\s*=>\s*handleTouchStart\(e,\s*'content'\)\}/);
    // iOS spring cubic-bezier
    expect(sheetContent).toMatch(/cubic-bezier\(0\.32,\s*0\.72,\s*0,\s*1\)/);
  });

  it('7. Perizinan & Surat: Modal date grid responsive', () => {
    const perizinanCss = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/perizinan.css'), 'utf8');
    expect(perizinanCss).toMatch(/\.prz-date-grid/);
    expect(perizinanCss).toMatch(/overflow-x:\s*hidden/);
    expect(perizinanCss).toMatch(/overscroll-behavior:\s*contain/);
  });

  it('8. Nilai Inventaris: Kartu compact tanpa fixed min-height besar', () => {
    const nilaiCss = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/nilaiInventaris.css'), 'utf8');
    expect(nilaiCss).toMatch(/\.ptv-nilai-card\s*\{[^}]*height:\s*auto\s*!important/);
  });
});
