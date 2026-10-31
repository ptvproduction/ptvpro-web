import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { NoteRichEditor } from '../../src/products/hub/catatan/components/NoteRichEditor';
import fs from 'fs';
import path from 'path';

describe('PTV-DEV-132: UI/UX & Interaction Regressions', () => {
  describe('Issue 1: Kalender Mobile Readability & Cell Height', () => {
    it('verifies kalender.css defines improved cell heights and font tokens for mobile', () => {
      const kalenderCssPath = path.resolve(process.cwd(), 'src/styles/kalender.css');
      const cssContent = fs.readFileSync(kalenderCssPath, 'utf-8');

      // Check min-height >= 54px without cramped aspect-ratio clamp
      expect(cssContent).toContain('min-height: 54px;');
      expect(cssContent).toContain('max-height: none;');
      expect(cssContent).toContain('aspect-ratio: auto;');

      // Check Masehi font size increased to 14px and Hijriah to 12.5px
      expect(cssContent).toContain('font-size: 14px;');
      expect(cssContent).toContain('.r03-kalender .cal-cell-hijri');
      expect(cssContent).toContain('font-size: 12.5px;');

      // Check weton font size and weight
      expect(cssContent).toContain('.r03-kalender .cal-cell-weton');
      expect(cssContent).toContain('font-size: 9.5px;');
      expect(cssContent).toContain('font-weight: 600;');

      // Check event indicator dots
      expect(cssContent).toContain('.r03-kalender .cal-dot');
      expect(cssContent).toContain('width: 4.5px;');
      expect(cssContent).toContain('height: 4.5px;');
    });
  });

  describe('Issue 2 & 4: Note Detail Modal Touch Scroll & Portal Architecture', () => {
    it('verifies catatan.css configures touch-action pan-y, momentum scrolling, and safe-area', () => {
      const catatanCssPath = path.resolve(process.cwd(), 'src/styles/catatan.css');
      const css = fs.readFileSync(catatanCssPath, 'utf-8');

      expect(css).toContain('touch-action: pan-y;');
      expect(css).toContain('-webkit-overflow-scrolling: touch;');
      expect(css).toContain('overscroll-behavior: contain;');
      expect(css).toContain('safe-area-inset-top');
      expect(css).toContain('safe-area-inset-bottom');

      // Ensure touch-action: none is removed from backdrop
      expect(css).not.toContain('.catatan-modal-backdrop { touch-action: none;');
    });

    it('verifies CatatanPage source code uses createPortal to document.body for modals', () => {
      const pagePath = path.resolve(process.cwd(), 'src/products/hub/catatan/CatatanPage.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('createPortal(');
      expect(content).toContain('document.body');
      expect(content).toContain('detailNote &&');
    });
  });

  describe('Issue 3: NoteRichEditor DOM Stability & Caret Protection', () => {
    it('renders NoteRichEditor with required contenteditable surface and formatting toolbar', () => {
      const html = renderToString(
        <NoteRichEditor initialHtml="<p>Notulensi Rapat Koordinasi</p>" onChange={() => {}} />
      );

      expect(html).toContain('contenteditable="true"');
      expect(html).toContain('note-editor-toolbar');
      expect(html).toContain('note-editor-content');
      expect(html).toContain('role="textbox"');
      expect(html).toContain('aria-multiline="true"');
    });

    it('verifies NoteRichEditor source implements isInternalTypingRef to guard against focus reset', () => {
      const editorSrcPath = path.resolve(
        process.cwd(),
        'src/products/hub/catatan/components/NoteRichEditor.tsx'
      );
      const code = fs.readFileSync(editorSrcPath, 'utf-8');

      expect(code).toContain('isInternalTypingRef');
      expect(code).toContain('lastEmittedHtmlRef');
      expect(code).toContain('isInternalTypingRef.current || initialHtml === lastEmittedHtmlRef.current');
    });
  });

  describe('Issue 5: Nilai Inventaris Mobile Card Compact Single-Row Layout', () => {
    it('verifies nilaiInventaris.css enforces auto height and single-row nowrap actions', () => {
      const cssPath = path.resolve(process.cwd(), 'src/styles/nilaiInventaris.css');
      const css = fs.readFileSync(cssPath, 'utf-8');

      expect(css).toContain('.ptv-nilai-card-actions-col {');
      expect(css).toContain('flex-wrap: nowrap !important;');
      expect(css).toContain('height: auto !important;');
      expect(css).toContain('min-height: 0 !important;');
      expect(css).toContain('.ptv-nilai-btn-del {');
    });

    it('verifies dashboard.css mobile rules match nilaiInventaris.css single-row nowrap layout', () => {
      const cssPath = path.resolve(process.cwd(), 'src/styles/dashboard.css');
      const css = fs.readFileSync(cssPath, 'utf-8');

      expect(css).toContain('flex-wrap: nowrap;');
      expect(css).toContain('.ptv-nilai-btn-del {');
      expect(css).toContain('min-width: 38px;');
    });
  });

  describe('Issue 6: WhatsApp Pelapor Field Accessibility in Damage Report Modal', () => {
    it('verifies DamageReportModal source contains WhatsApp Pelapor field and submit button', () => {
      const modalSrc = fs.readFileSync(
        path.resolve(process.cwd(), 'src/products/hub/lapor-kerusakan/components/DamageReportModal.tsx'),
        'utf-8'
      );

      expect(modalSrc).toContain('id="damage-contact"');
      expect(modalSrc).toContain('type="tel"');
      expect(modalSrc).toContain('placeholder="08xxxxxxxxxx"');
      expect(modalSrc).toContain('WhatsApp Pelapor');
      expect(modalSrc).toContain('Kirim Laporan');
    });

    it('verifies lapor-kerusakan.css configures scroll clearance and safe-area padding for sticky footer', () => {
      const cssPath = path.resolve(
        process.cwd(),
        'src/products/hub/lapor-kerusakan/lapor-kerusakan.css'
      );
      const css = fs.readFileSync(cssPath, 'utf-8');

      expect(css).toContain('scroll-margin-bottom: 96px;');
      expect(css).toContain('scroll-padding-bottom: 90px;');
      expect(css).toContain('scroll-padding-bottom: 110px;');
      expect(css).toContain('env(safe-area-inset-bottom, 0px)');
    });
  });

  describe('Issue 7: Search Input Padding & Icon Collision Prevention', () => {
    it('verifies search inputs have sufficient left padding to prevent overlapping with magnifying-glass icon', () => {
      const nilaiCss = fs.readFileSync(
        path.resolve(process.cwd(), 'src/styles/nilaiInventaris.css'),
        'utf-8'
      );
      const dashCss = fs.readFileSync(
        path.resolve(process.cwd(), 'src/styles/dashboard.css'),
        'utf-8'
      );
      const dmgCss = fs.readFileSync(
        path.resolve(process.cwd(), 'src/products/hub/lapor-kerusakan/lapor-kerusakan.css'),
        'utf-8'
      );

      // Nilai Inventaris search padding
      expect(nilaiCss).toContain('padding-left: 46px;');
      expect(dashCss).toContain('padding-left: 46px;');

      // Damage report search padding
      expect(dmgCss).toContain('padding-left: 38px;');
      expect(dmgCss).toContain('padding-left: 42px !important;');
    });
  });
});
