import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dialogManager } from '../../src/shared/utils/dialogManager';

describe('PTVPRO Global Modal Management & Keyboard Shortcuts', () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    (globalThis as any).document = {
      activeElement: null,
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      body: {
        style: {
          position: '',
          top: '',
          width: '',
          overflow: '',
          paddingRight: '',
        },
        contains: vi.fn(() => true),
      },
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
    };
    dialogManager._resetForTesting();
  });

  afterEach(() => {
    dialogManager._resetForTesting();
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
  });

  describe('Single-Modal Policy & Dialog Lifecycle', () => {
    it('allows opening a global modal when no dialog is active', () => {
      expect(dialogManager.hasActiveDialog()).toBe(false);
      expect(dialogManager.canOpenGlobalModal()).toBe(true);
    });

    it('blocks opening global modals when a dialog is active in the stack', () => {
      const onCloseParent = vi.fn();
      const unregister = dialogManager.register({
        id: 'catatan-form-modal',
        onClose: onCloseParent,
      });

      expect(dialogManager.hasActiveDialog()).toBe(true);
      expect(dialogManager.canOpenGlobalModal()).toBe(false);

      unregister();
      expect(dialogManager.hasActiveDialog()).toBe(false);
      expect(dialogManager.canOpenGlobalModal()).toBe(true);
    });

    it('detects active dialog from DOM fallback selectors even if not yet in stack', () => {
      (globalThis.document.querySelector as any).mockReturnValue({ className: 'catatan-modal-backdrop' });

      expect(dialogManager.hasActiveDialog()).toBe(true);
      expect(dialogManager.canOpenGlobalModal()).toBe(false);

      (globalThis.document.querySelector as any).mockReturnValue(null);
      expect(dialogManager.hasActiveDialog()).toBe(false);
      expect(dialogManager.canOpenGlobalModal()).toBe(true);
    });
  });

  describe('Shortcut Guard (Notulis & Typing Context)', () => {
    it('blocks global shortcut when typing in standard input or textarea', () => {
      const mockInput = {
        tagName: 'INPUT',
        isContentEditable: false,
        getAttribute: () => null,
        closest: () => null,
      } as unknown as HTMLElement;

      (globalThis.document as any).activeElement = mockInput;

      const event = { key: '/', target: mockInput } as unknown as KeyboardEvent;
      expect(dialogManager.isTypingOrEditable(mockInput)).toBe(true);
      expect(dialogManager.shouldBlockGlobalShortcut(event)).toBe(true);
    });

    it('blocks global shortcut when typing in contenteditable rich editor', () => {
      const mockParagraph = {
        tagName: 'P',
        isContentEditable: true,
        getAttribute: () => null,
        closest: (sel: string) => (sel.includes('note-editor-content') ? {} : null),
      } as unknown as HTMLElement;

      (globalThis.document as any).activeElement = mockParagraph;

      const event = { key: '/', target: mockParagraph } as unknown as KeyboardEvent;
      expect(dialogManager.isTypingOrEditable(mockParagraph)).toBe(true);
      expect(dialogManager.shouldBlockGlobalShortcut(event)).toBe(true);
    });

    it('blocks global shortcut when Notulis modal is open even if focus is on non-input element', () => {
      dialogManager.register({
        id: 'catatan-form-modal',
        onClose: vi.fn(),
      });

      const mockModalHeader = {
        tagName: 'DIV',
        isContentEditable: false,
        getAttribute: () => null,
        closest: () => null,
      } as unknown as HTMLElement;

      (globalThis.document as any).activeElement = mockModalHeader;

      const event = { key: '/', target: mockModalHeader } as unknown as KeyboardEvent;
      // shouldBlockGlobalShortcut MUST return true because modal is active!
      expect(dialogManager.shouldBlockGlobalShortcut(event)).toBe(true);
    });

    it('allows global shortcut when outside modal and not typing', () => {
      const mockGeneralDiv = {
        tagName: 'DIV',
        isContentEditable: false,
        getAttribute: () => null,
        closest: () => null,
      } as unknown as HTMLElement;

      (globalThis.document as any).activeElement = mockGeneralDiv;

      const event = { key: '/', target: mockGeneralDiv } as unknown as KeyboardEvent;
      expect(dialogManager.isTypingOrEditable(mockGeneralDiv)).toBe(false);
      expect(dialogManager.shouldBlockGlobalShortcut(event)).toBe(false);
    });
  });

  describe('Nested Dialog Workflow & LIFO Escape Handling', () => {
    it('supports nested dialogs and closes ONLY the top dialog on Escape', () => {
      const onCloseParent = vi.fn();
      const onCloseChild = vi.fn();

      // 1. Parent modal (Notulis / Catatan) opens
      const unregParent = dialogManager.register({
        id: 'catatan-form-modal',
        onClose: onCloseParent,
      });

      expect(dialogManager.getActiveDialogs()).toHaveLength(1);
      expect(dialogManager.getTopDialog()?.id).toBe('catatan-form-modal');

      // 2. Child modal (Konfirmasi Hapus) opens on top of parent
      const unregChild = dialogManager.register({
        id: 'catatan-delete-confirm-modal',
        onClose: onCloseChild,
      });

      expect(dialogManager.getActiveDialogs()).toHaveLength(2);
      expect(dialogManager.getTopDialog()?.id).toBe('catatan-delete-confirm-modal');

      // 3. User presses Escape
      const escEvent = {
        key: 'Escape',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        stopImmediatePropagation: vi.fn(),
      } as unknown as KeyboardEvent;

      const handled = dialogManager.handleEscape(escEvent);

      expect(handled).toBe(true);
      // ONLY the child modal's onClose is called!
      expect(onCloseChild).toHaveBeenCalledTimes(1);
      expect(onCloseParent).not.toHaveBeenCalled();

      // Child unregisters upon close
      unregChild();
      expect(dialogManager.getActiveDialogs()).toHaveLength(1);
      expect(dialogManager.getTopDialog()?.id).toBe('catatan-form-modal');

      // 4. User presses Escape again
      const escEvent2 = {
        key: 'Escape',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        stopImmediatePropagation: vi.fn(),
      } as unknown as KeyboardEvent;

      const handled2 = dialogManager.handleEscape(escEvent2);

      expect(handled2).toBe(true);
      // Now the parent modal's onClose is called!
      expect(onCloseParent).toHaveBeenCalledTimes(1);

      unregParent();
      expect(dialogManager.getActiveDialogs()).toHaveLength(0);
      expect(dialogManager.hasActiveDialog()).toBe(false);
    });

    it('restores focus to trigger element when dialog is unregistered', () => {
      const triggerFocus = vi.fn();
      const mockTriggerBtn = {
        tagName: 'BUTTON',
        focus: triggerFocus,
      } as unknown as HTMLElement;

      const unregister = dialogManager.register({
        id: 'test-dialog',
        onClose: vi.fn(),
        triggerElement: mockTriggerBtn,
      });

      unregister();
      expect(triggerFocus).toHaveBeenCalled();
    });
  });

  describe('Centralized Body Scroll Lock Reference Counting', () => {
    it('maintains body lock while nested modal closes and only releases when all modals close', () => {
      const unreg1 = dialogManager.register({ id: 'modal-1', onClose: vi.fn() });
      expect(globalThis.document.body.style.position).toBe('fixed');
      expect(globalThis.document.body.style.overflow).toBe('hidden');

      const unreg2 = dialogManager.register({ id: 'modal-2', onClose: vi.fn() });
      expect(globalThis.document.body.style.position).toBe('fixed');

      // Close modal 2 (child)
      unreg2();
      // Body should STILL be fixed because modal 1 is still open!
      expect(globalThis.document.body.style.position).toBe('fixed');
      expect(globalThis.document.body.style.overflow).toBe('hidden');

      // Close modal 1 (parent)
      unreg1();
      // Body should now be released!
      expect(globalThis.document.body.style.position).not.toBe('fixed');
    });
  });
});
