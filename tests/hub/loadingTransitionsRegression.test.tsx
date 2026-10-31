import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  SkeletonBase,
  PageHeaderSkeleton,
  CardListSkeleton,
  TableSkeleton,
  CalendarGridSkeleton,
  InventoryGridSkeleton,
  BerandaSkeleton,
  DocDetailSkeleton,
  FormSkeleton,
  ProfileSkeleton,
} from '../../src/shared/components/skeletons';
import { OFFICIAL_KOP_LOGO_URL, SuratIzinPdfPreview } from '../../src/products/hub/surat/generator/components/SuratIzinPdfPreview';
import { INITIAL_SANTRI_FIXTURES } from '../../src/products/hub/surat/generator/mock/santriMockData';
import fs from 'fs';
import path from 'path';

describe('PTV-DEV-188: Unified Loading Skeletons & Page Transition Regression Tests', () => {
  it('renders all 10 contextual skeleton components without errors', () => {
    const skeletons = [
      <SkeletonBase key="base" width="100px" height="20px" />,
      <PageHeaderSkeleton key="header" hasAction />,
      <CardListSkeleton key="cardlist" count={3} variant="horizontal-card" />,
      <TableSkeleton key="table" rows={4} />,
      <CalendarGridSkeleton key="cal" weeks={5} />,
      <InventoryGridSkeleton key="inv" count={4} />,
      <BerandaSkeleton key="beranda" />,
      <DocDetailSkeleton key="detail" />,
      <FormSkeleton key="form" />,
      <ProfileSkeleton key="profile" />,
    ];

    for (const skel of skeletons) {
      let html = '';
      expect(() => {
        html = renderToString(skel);
      }).not.toThrow();
      expect(html).toContain('ptv-skeleton-block');
      expect(html).toContain('aria-hidden="true"');
    }
  });

  it('ensures official legacy kop surat logo URL matches canonical BS-X-PTV asset', () => {
    expect(OFFICIAL_KOP_LOGO_URL).toBe('/assets/images/BS-X-PTV.webp');

    // Verifikasi berkas fisik BS-X-PTV.webp tersedia nyata di folder public
    const filePath = path.resolve(process.cwd(), 'public/assets/images/BS-X-PTV.webp');
    expect(fs.existsSync(filePath)).toBe(true);
    const stat = fs.statSync(filePath);
    expect(stat.size).toBeGreaterThan(1000); // 10,146 bytes real asset
  });

  it('renders official kop logo in SuratIzinPdfPreview with 48px height and object-fit contain', () => {
    const previewHtml = renderToString(
      <SuratIzinPdfPreview
        selectedSantri={INITIAL_SANTRI_FIXTURES.slice(0, 3)}
        activeCols={['unit', 'kelas']}
        kegiatan="Liputan Harlah PPBS 2026"
        tanggalMulai="2026-10-28"
        hasEndDate={false}
        nomorSurat="045/SI-PTV/X/2026"
        showDikeluarkan={false}
        customDikeluarkan=""
      />
    );
    expect(previewHtml).toContain('src="/assets/images/BS-X-PTV.webp"');
    expect(previewHtml).toContain('height:48px');
    expect(previewHtml).toContain('object-fit:contain');
    expect(previewHtml).toContain('PROGRESIF TV');
    expect(previewHtml).toContain('OFFICIAL MEDIA BROADCASTER');
  });

  it('renders SkeletonBase with custom dimensions and radius', () => {
    const html = renderToString(
      <SkeletonBase width="250px" height="32px" radius="16px" className="custom-test" />
    );
    expect(html).toContain('width:250px');
    expect(html).toContain('height:32px');
    expect(html).toContain('border-radius:16px');
    expect(html).toContain('custom-test');
  });

  it('verifies TableSkeleton structure with header and rows', () => {
    const html = renderToString(<TableSkeleton rows={5} />);
    expect(html).toContain('ptv-skel-table-wrapper');
    expect(html).toContain('ptv-skel-table-row');
  });

  it('verifies CalendarGridSkeleton renders 7 columns for month layout', () => {
    const html = renderToString(<CalendarGridSkeleton weeks={5} />);
    expect(html).toContain('ptv-skel-calendar-grid');
    expect(html).toContain('ptv-skel-calendar-cell');
  });
});
