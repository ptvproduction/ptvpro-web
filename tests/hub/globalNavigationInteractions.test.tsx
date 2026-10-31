import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dialogManager } from '../../src/shared/utils/dialogManager';

describe('PTVPRO Global Navigation & Header Interactions Test Suite', () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const mockBody: any = {
      style: {
        position: '',
        top: '',
        width: '',
        overflow: '',
        paddingRight: '',
      },
      contains: vi.fn(() => true),
    };

    (globalThis as any).document = {
      activeElement: null,
      querySelectorAll: vi.fn(() => []),
      querySelector: vi.fn(() => null),
      body: mockBody,
      documentElement: {
        scrollTop: 0,
        clientWidth: 1024,
      },
    };
    (globalThis as any).window = {
      scrollY: 0,
      pageYOffset: 0,
      innerWidth: 1024,
      scrollTo: vi.fn(),
      getComputedStyle: vi.fn(() => ({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
      })),
    };
    dialogManager._resetForTesting();
  });

  afterEach(() => {
    dialogManager._resetForTesting();
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
  });

  describe('Root Cause 1: Closed Sheets & Scrims Must Not Block Global Navigation', () => {
    it('does not treat closed action sheet (#quickSheet:not(.on)) as an active dialog', () => {
      const closedSheet = {
        id: 'quickSheet',
        classList: { contains: (cls: string) => cls === 'sheet' },
        getAttribute: (attr: string) => (attr === 'aria-hidden' ? 'true' : null),
        isConnected: true,
      };

      (globalThis.document.querySelectorAll as any).mockReturnValue([closedSheet]);

      // Closed sheet must NOT block canOpenGlobalModal()
      expect(dialogManager.hasActiveDialog()).toBe(false);
      expect(dialogManager.canOpenGlobalModal()).toBe(true);
    });

    it('does not treat closed scrim (#quickScrim:not(.on)) as an active dialog', () => {
      const closedScrim = {
        id: 'quickScrim',
        classList: { contains: (cls: string) => cls === 'scrim' },
        getAttribute: (attr: string) => (attr === 'aria-hidden' ? 'true' : null),
        isConnected: true,
      };

      (globalThis.document.querySelectorAll as any).mockReturnValue([closedScrim]);

      expect(dialogManager.hasActiveDialog()).toBe(false);
      expect(dialogManager.canOpenGlobalModal()).toBe(true);
    });

    it('ignores elements with aria-hidden="true" or hidden computed styles', () => {
      const hiddenDialog = {
        id: 'hidden-dialog',
        classList: { contains: () => false },
        getAttribute: (attr: string) => (attr === 'aria-hidden' ? 'true' : null),
        isConnected: true,
      };

      (globalThis.document.querySelectorAll as any).mockReturnValue([hiddenDialog]);

      expect(dialogManager.hasActiveDialog()).toBe(false);
      expect(dialogManager.canOpenGlobalModal()).toBe(true);
    });

    it('detects a genuinely open sheet (.sheet.on) as an active dialog', () => {
      const openSheet = {
        id: 'quickSheet',
        classList: { contains: (cls: string) => cls === 'sheet' || cls === 'on' },
        getAttribute: (attr: string) => (attr === 'aria-hidden' ? 'false' : null),
        isConnected: true,
      };

      (globalThis.document.querySelectorAll as any).mockReturnValue([openSheet]);

      expect(dialogManager.hasActiveDialog()).toBe(true);
      expect(dialogManager.canOpenGlobalModal()).toBe(false);
    });
  });

  describe('Root Cause 2: Route Change Cleanup & Scroll Lock Restoration', () => {
    it('restores body styles and clears dialogs on route change', () => {
      const onClose = vi.fn();
      dialogManager.register({
        id: 'open-sheet-or-modal',
        onClose,
      });

      expect(globalThis.document.body.style.position).toBe('fixed');
      expect(globalThis.document.body.style.overflow).toBe('hidden');
      expect(dialogManager.hasActiveDialog()).toBe(true);

      // User navigates to /hub/inventaris or /hub/acara
      dialogManager.resetOnRouteChange();

      // Scroll lock must be fully cleared and stack emptied
      expect(globalThis.document.body.style.position).toBe('');
      expect(globalThis.document.body.style.overflow).toBe('');
      expect(dialogManager.hasActiveDialog()).toBe(false);
      expect(dialogManager.canOpenGlobalModal()).toBe(true);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('cleans up orphan dialogs whose DOM elements are removed without calling unregister', () => {
      const detachedElement = { isConnected: false };
      (globalThis.document.body.contains as any).mockReturnValue(false);

      dialogManager.register({
        id: 'orphan-dialog',
        onClose: vi.fn(),
        triggerElement: detachedElement as any,
      });

      expect(dialogManager.getActiveDialogs()).toHaveLength(1);

      // Perform orphan cleanup
      dialogManager.cleanupOrphanDialogs();

      expect(dialogManager.getActiveDialogs()).toHaveLength(0);
      expect(globalThis.document.body.style.position).toBe('');
    });
  });

  describe('Header & Navigation Responsiveness Invariants', () => {
    it('allows opening Global Search when header search button is clicked in normal state', () => {
      expect(dialogManager.canOpenGlobalModal()).toBe(true);
    });

    it('allows header menu buttons to open their dialogs independently after previous modal closes', () => {
      const unregSearch = dialogManager.register({ id: 'universal-search-modal', onClose: vi.fn() });
      expect(dialogManager.canOpenGlobalModal()).toBe(false);

      // User closes search
      unregSearch();
      expect(dialogManager.canOpenGlobalModal()).toBe(true);

      // User opens profile modal
      const unregProfile = dialogManager.register({ id: 'user-profile-modal', onClose: vi.fn() });
      expect(dialogManager.canOpenGlobalModal()).toBe(false);

      // User closes profile
      unregProfile();
      expect(dialogManager.canOpenGlobalModal()).toBe(true);
    });
  });
});
