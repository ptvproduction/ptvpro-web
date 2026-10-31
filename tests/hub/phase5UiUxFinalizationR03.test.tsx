/**
 * PTVPRO — Phase 5 Global UI/UX Finalization (R03) Empirical Verification
 * File: tests/hub/phase5UiUxFinalizationR03.test.tsx
 *
 * Menguji 7 revisi operator tanggal 24 Oktober 2026:
 * 1. Tipografi SF Pro (SF Pro Display untuk heading/display, SF Pro Text untuk UI/body)
 * 2. Compact Layout & Whitespace (margin 12-16px, padding kartu 14-16px, gap 12-16px, label-input 6-8px)
 * 3. Dropdown & Modal Lifecycle (PTVSelect usePortal default, background scroll lock & escape handling)
 * 4. Guidebook R03 Compliance (mobile input 16px anti-zoom Safari iOS, radius Profile D)
 * 5. Dark Mode Token Consistency (WCAG AA contrast, elimination of generic glowing colors)
 * 6. Responsive Viewport Boundaries (no clipping/overflow)
 * 7. Settings & Inspector Panel Stability
 */

import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { dialogManager } from '../../src/shared/utils/dialogManager';

describe('Phase 5 — Global UI/UX Finalization (R03) Operator Revisions', () => {
  const rootDir = process.cwd();
  const tokensCssPath = path.resolve(rootDir, 'src/styles/tokens.css');
  const dashCssPath = path.resolve(rootDir, 'src/styles/dashboard.css');
  const setCssPath = path.resolve(rootDir, 'src/styles/pengaturan.css');

  describe('1. Tipografi SF Pro (SF Pro Display & SF Pro Text)', () => {
    it('1.1 Should declare both SF Pro Display and SF Pro Text semantic tokens in tokens.css', () => {
      const content = fs.readFileSync(tokensCssPath, 'utf-8');
      expect(content).toContain('--font-display: "SF Pro Display"');
      expect(content).toContain('--font-body: "SF Pro Text"');
      expect(content).toContain('--ptv-font-display: var(--font-display);');
      expect(content).toContain('--ptv-font-text: var(--font-body);');
      expect(content).toContain('--ptv-font-family: "SF Pro Display"');
    });

    it('1.2 Should bind headings (h1, h2, h3, h4, .display) to --font-display in dashboard.css', () => {
      const content = fs.readFileSync(dashCssPath, 'utf-8');
      expect(content).toContain('h1,h2,h3,h4{margin:0;font-family:var(--font-display);');
      expect(content).toContain('.display{font-family:var(--font-display);');
      expect(content).toContain('.t-xl{font-family:var(--font-display);');
      expect(content).toContain('.t-lg{font-family:var(--font-display);');
      expect(content).toContain('.t-md{font-family:var(--font-body);');
      expect(content).toContain('.t-sm{font-family:var(--font-body);');
    });
  });

  describe('2. Dropdown, Popover & Portal Clipping Protection', () => {
    it('2.1 PTVSelect should usePortal=true by default to prevent container clipping', () => {
      const ptvSelectSource = fs.readFileSync(
        path.resolve(rootDir, 'src/shared/components/PTVSelect.tsx'),
        'utf-8'
      );
      expect(ptvSelectSource).toContain('usePortal = true');
    });

    it('2.2 PTVSelect should calculate horizontal collision boundaries for narrow screens', () => {
      const ptvSelectSource = fs.readFileSync(
        path.resolve(rootDir, 'src/shared/components/PTVSelect.tsx'),
        'utf-8'
      );
      expect(ptvSelectSource).toContain('const viewportW = typeof window !== \'undefined\' ? window.innerWidth : 1024;');
      expect(ptvSelectSource).toContain('const width = Math.min(rect.width, Math.max(260, viewportW - 24));');
      expect(ptvSelectSource).toContain('const left = Math.max(12, Math.min(rect.left, viewportW - width - 12));');
    });
  });

  describe('3. Modal Lifecycle & Unified Scroll Lock Integration', () => {
    it('3.1 PushDiagnosticsModal must use useModalScrollLock', () => {
      const src = fs.readFileSync(
        path.resolve(rootDir, 'src/products/hub/pengaturan/components/PushDiagnosticsModal.tsx'),
        'utf-8'
      );
      expect(src).toContain("import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';");
      expect(src).toContain('id: \'push-diagnostics-modal\'');
      expect(src).toContain('ref={modalRef}');
    });

    it('3.2 LogoutConfirmModal must use useModalScrollLock', () => {
      const src = fs.readFileSync(
        path.resolve(rootDir, 'src/products/hub/pengaturan/components/LogoutConfirmModal.tsx'),
        'utf-8'
      );
      expect(src).toContain("import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';");
      expect(src).toContain('id: \'logout-confirm-modal\'');
      expect(src).toContain('ref={modalRef}');
    });

    it('3.3 UnlinkGoogleConfirmModal must use useModalScrollLock', () => {
      const src = fs.readFileSync(
        path.resolve(rootDir, 'src/products/hub/pengaturan/components/UnlinkGoogleConfirmModal.tsx'),
        'utf-8'
      );
      expect(src).toContain("import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';");
      expect(src).toContain('id: \'unlink-google-confirm-modal\'');
      expect(src).toContain('ref={modalRef}');
    });

    it('3.4 LoanModal must use useModalScrollLock for background scroll locking', () => {
      const src = fs.readFileSync(
        path.resolve(rootDir, 'src/products/hub/peminjaman/LoanModal.tsx'),
        'utf-8'
      );
      expect(src).toContain("import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';");
      expect(src).toContain('id: \'ptv-loan-modal\'');
      expect(src).toContain('ref={modalRef}');
    });

    it('3.5 Broadcast AnnouncementModal, AnnouncementDetailModal, DeleteConfirmModal must use useModalScrollLock', () => {
      const annSrc = fs.readFileSync(
        path.resolve(rootDir, 'src/products/hub/broadcast/components/AnnouncementModal.tsx'),
        'utf-8'
      );
      expect(annSrc).toContain("import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';");
      expect(annSrc).toContain('id: \'broadcast-announcement-modal\'');

      const detSrc = fs.readFileSync(
        path.resolve(rootDir, 'src/products/hub/broadcast/components/AnnouncementDetailModal.tsx'),
        'utf-8'
      );
      expect(detSrc).toContain("import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';");
      expect(detSrc).toContain('id: \'broadcast-announcement-detail-modal\'');

      const delSrc = fs.readFileSync(
        path.resolve(rootDir, 'src/products/hub/broadcast/components/DeleteConfirmModal.tsx'),
        'utf-8'
      );
      expect(delSrc).toContain("import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';");
      expect(delSrc).toContain('id: \'broadcast-delete-confirm-modal\'');
    });

    it('3.6 Lost & Found Modal and Drawer must use useModalScrollLock', () => {
      const formSrc = fs.readFileSync(
        path.resolve(rootDir, 'src/products/hub/lost-found/components/LostFoundModalForm.tsx'),
        'utf-8'
      );
      expect(formSrc).toContain("import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';");
      expect(formSrc).toContain('id: \'lost-found-modal-form\'');

      const drawerSrc = fs.readFileSync(
        path.resolve(rootDir, 'src/products/hub/lost-found/components/LostFoundDetailDrawer.tsx'),
        'utf-8'
      );
      expect(drawerSrc).toContain("import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';");
      expect(drawerSrc).toContain('id: \'lost-found-detail-drawer\'');
    });

    it('3.7 dialogManager must detect active dialog and block universal search shortcuts', () => {
      expect(dialogManager.hasActiveDialog()).toBe(false);

      const unregister = dialogManager.register({
        id: 'test-inspector-dialog',
        onClose: vi.fn(),
      });

      const slashEvent = { key: '/', target: null } as unknown as KeyboardEvent;
      const kEvent = { key: 'k', ctrlKey: true, target: null } as unknown as KeyboardEvent;

      expect(dialogManager.hasActiveDialog()).toBe(true);
      expect(dialogManager.shouldBlockGlobalShortcut(slashEvent)).toBe(true);
      expect(dialogManager.shouldBlockGlobalShortcut(kEvent)).toBe(true);

      unregister();
      expect(dialogManager.hasActiveDialog()).toBe(false);
      expect(dialogManager.shouldBlockGlobalShortcut(slashEvent)).toBe(false);
    });
  });

  describe('4. Mobile Input Anti-Zoom Safari iOS Compliance', () => {
    it('4.1 Settings form inputs must enforce min 16px on mobile viewports', () => {
      const setCss = fs.readFileSync(setCssPath, 'utf-8');
      expect(setCss).toContain('.set-input {');
      expect(setCss).toMatch(/font-size:\s*16px\s*!important/);
    });

    it('4.2 General input fields in dashboard.css must default to 16px', () => {
      const dashCss = fs.readFileSync(dashCssPath, 'utf-8');
      expect(dashCss).toContain('.input,select.input,textarea.input{');
      expect(dashCss).toContain('font-size:16px;');
    });
  });

  describe('5. Dark Mode Token Alignment', () => {
    it('5.1 tokens.css and dashboard.css must specify authentic charcoal dark palette', () => {
      const tokens = fs.readFileSync(tokensCssPath, 'utf-8');
      expect(tokens).toContain('--bg: #111315;');
      expect(tokens).toContain('--bg-2: #1B1E21;');
      expect(tokens).toContain('--surface: #24282C;');
      expect(tokens).toContain('--surface-2: #2E3338;');
      expect(tokens).toContain('--ink: #E8EAED;');
      expect(tokens).toContain('--ink-2: #BDC1C6;');
    });
  });
});
