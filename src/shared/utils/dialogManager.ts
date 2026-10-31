/**
 * PTVPRO — Centralized Dialog & Modal Lifecycle Manager
 * File: src/shared/utils/dialogManager.ts
 *
 * Mengelola tumpukan modal (Dialog Stack), single-modal policy,
 * shortcut guards, focus restoration, scroll lock berjenjang,
 * dan penanganan tombol Escape secara LIFO (hanya menutup dialog teratas).
 *
 * Sesuai pedoman AGENTS.md dan PTV Hub Guide R03.
 */

export interface RegisteredDialog {
  id: string;
  onClose: () => void;
  element?: HTMLElement | null;
  triggerElement?: HTMLElement | null;
  isGlobal?: boolean;
  restoreScroll?: boolean;
}

class DialogManager {
  private stack: RegisteredDialog[] = [];
  private listeners: Set<() => void> = new Set();
  private originalBodyStyles: {
    overflow: string;
    position: string;
    top: string;
    width: string;
    paddingRight: string;
    scrollY: number;
  } | null = null;

  /**
   * Daftarkan dialog yang sedang aktif (terbuka).
   * Mengembalikan fungsi unregister untuk cleanup.
   */
  public register(dialog: RegisteredDialog): () => void {
    // Hapus jika ID sudah ada untuk mencegah duplikasi
    this.stack = this.stack.filter((d) => d.id !== dialog.id);
    this.stack.push(dialog);
    this.applyBodyScrollLock();
    this.notify();

    return () => {
      this.unregister(dialog.id);
    };
  }

  /**
   * Lepaskan pendaftaran dialog saat ditutup / unmount.
   */
  public unregister(id: string): void {
    const idx = this.stack.findIndex((d) => d.id === id);
    if (idx === -1) return;

    const [removed] = this.stack.splice(idx, 1);
    if (this.stack.length === 0) {
      this.releaseBodyScrollLock(removed?.restoreScroll !== false);
    }
    this.notify();

    // Focus restoration ke elemen pemicu saat seluruh dialog ditutup
    if (this.stack.length === 0 && removed?.triggerElement && typeof removed.triggerElement.focus === 'function') {
      try {
        removed.triggerElement.focus();
      } catch {
        // ignore jika elemen sudah hilang dari DOM
      }
    }
  }

  /**
   * Bersihkan dialog yang elemennya sudah di-unmount dari DOM tanpa unregister formal.
   */
  public cleanupOrphanDialogs(): void {
    if (typeof document === 'undefined') return;
    const initialLen = this.stack.length;
    this.stack = this.stack.filter((d) => {
      if (d.element) {
        if ('isConnected' in d.element && !d.element.isConnected) return false;
        if (document.body && typeof document.body.contains === 'function' && !document.body.contains(d.element)) return false;
      }
      if (d.triggerElement) {
        if ('isConnected' in d.triggerElement && !d.triggerElement.isConnected) return false;
        if (document.body && typeof document.body.contains === 'function' && !document.body.contains(d.triggerElement)) return false;
      }
      return true;
    });
    if (this.stack.length === 0 && initialLen > 0) {
      this.releaseBodyScrollLock();
      if (document.body?.style) {
        if (document.body.style.position === 'fixed') document.body.style.position = '';
        if (document.body.style.overflow === 'hidden') document.body.style.overflow = '';
        if (document.body.style.top) document.body.style.top = '';
        if (document.body.style.width === '100%') document.body.style.width = '';
      }
      this.notify();
    }
  }

  /**
   * Reset siklus hidup modal dan scroll lock saat route berganti.
   */
  public resetOnRouteChange(): void {
    while (this.stack.length > 0) {
      const top = this.stack.pop();
      if (top?.onClose) {
        try {
          top.onClose();
        } catch {
          // ignore
        }
      }
    }
    this.releaseBodyScrollLock();
    if (typeof document !== 'undefined' && document.body?.style) {
      if (document.body.style.position === 'fixed') document.body.style.position = '';
      if (document.body.style.overflow === 'hidden') document.body.style.overflow = '';
      if (document.body.style.top) document.body.style.top = '';
      if (document.body.style.width === '100%') document.body.style.width = '';
      if (document.body.classList?.remove) document.body.classList.remove('modal-open');
      if (document.documentElement?.classList?.remove) document.documentElement.classList.remove('modal-open');
    }
    this.notify();
  }

  /**
   * Cek apakah ada dialog/modal yang sedang aktif (dari stack atau DOM query).
   * Menjamin zero false positive dari elemen sheet/scrim tertutup atau elemen hidden.
   */
  public hasActiveDialog(): boolean {
    this.cleanupOrphanDialogs();
    if (this.stack.length > 0) return true;
    if (typeof document === 'undefined') return false;

    // DOM fallback inspection untuk modal yang benar-benar aktif/terlihat di layar
    let candidates: HTMLElement[] = [];
    const MODAL_SELECTOR =
      'dialog[open], [role="dialog"], .catatan-modal-backdrop, .modal-backdrop, .scrim.on, .sheet.on, .kk-drawer-overlay, .set-modal-overlay, .prz-modal-overlay, .fin-modal-overlay, .loan-return-modal-card, .acara-modal-overlay, .dmg-modal-backdrop, .dmg-modal-surface, .lf-modal-backdrop, .lf-modal-surface, .sdel-modal-overlay, .ptv-lightbox-backdrop, .lightbox-backdrop, .loan-modal-scrim, .loan-modal-container';
    if (typeof document.querySelectorAll === 'function') {
      try {
        const qsa = document.querySelectorAll<HTMLElement>(MODAL_SELECTOR);
        if (qsa && qsa.length > 0) {
          candidates = Array.from(qsa);
        }
      } catch {
        // ignore
      }
    }
    if (candidates.length === 0 && typeof document.querySelector === 'function') {
      try {
        const single = document.querySelector<HTMLElement>(MODAL_SELECTOR);
        if (single) candidates = [single];
      } catch {
        // ignore
      }
    }

    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      if (document.body && typeof document.body.contains === 'function' && !document.body.contains(el)) continue;
      if (typeof el.getAttribute === 'function' && el.getAttribute('aria-hidden') === 'true') continue;
      if (el.classList?.contains('sheet') && !el.classList.contains('on')) continue;
      if (el.classList?.contains('scrim') && !el.classList.contains('on')) continue;

      if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        try {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            continue;
          }
        } catch {
          // ignore jika getComputedStyle gagal
        }
      }

      return true;
    }

    return false;
  }

  /**
   * Single-Modal Policy:
   * Modal global (Universal Search, Quick Actions, Mobile More Sheet, Notifikasi, Profil)
   * TIDAK BOLEH dibuka jika ada dialog yang sedang aktif di layar.
   */
  public canOpenGlobalModal(): boolean {
    return !this.hasActiveDialog();
  }

  /**
   * Mendapatkan dialog teratas (top-most) di dalam tumpukan.
   */
  public getTopDialog(): RegisteredDialog | undefined {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : undefined;
  }

  /**
   * Mendapatkan seluruh dialog yang sedang aktif.
   */
  public getActiveDialogs(): RegisteredDialog[] {
    return [...this.stack];
  }

  /**
   * Shortcut Guard: Memeriksa apakah target/active element berada dalam area pengetikan:
   * input, textarea, select, contenteditable, atau rich-text editor surface.
   */
  public isTypingOrEditable(target: EventTarget | null): boolean {
    if (typeof document === 'undefined') return false;
    const el = (target as HTMLElement) || (document.activeElement as HTMLElement | null);
    const active = document.activeElement as HTMLElement | null;

    const checkNode = (node: HTMLElement | null): boolean => {
      if (!node) return false;
      const tag = node.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        return true;
      }
      if (node.isContentEditable) {
        return true;
      }
      const ceAttr = node.getAttribute?.('contenteditable');
      if (ceAttr === 'true' || ceAttr === '') {
        return true;
      }
      if (node.closest?.('[contenteditable="true"], [contenteditable=""], [role="textbox"]')) {
        return true;
      }
      if (
        node.closest?.(
          '.note-editor-content, .note-rich-editor, .wysiwyg-editor, .catatan-modal-card, .catatan-modal-body'
        )
      ) {
        return true;
      }
      return false;
    };

    return checkNode(el) || checkNode(active);
  }

  /**
   * Shortcut Guard Komprehensif:
   * Memblokir shortcut global (seperti '/', 'Ctrl/Cmd+K') jika:
   * 1. Pengguna sedang mengetik di input, textarea, contenteditable, atau rich editor.
   * 2. Atau ada modal/dialog yang sedang aktif (Single-modal policy).
   */
  public shouldBlockGlobalShortcut(e: KeyboardEvent): boolean {
    // 1. Jika pengguna sedang mengetik di area editable
    if (this.isTypingOrEditable(e.target)) {
      return true;
    }

    // 2. Jika ada modal atau dialog yang sedang aktif
    if (this.hasActiveDialog()) {
      return true;
    }

    return false;
  }

  /**
   * Menangani tombol Escape secara LIFO:
   * HANYA menutup dialog teratas pada tumpukan.
   * Mengembalikan true jika event diproses dan ditangani.
   */
  public handleEscape(e: KeyboardEvent): boolean {
    if (e.key !== 'Escape') return false;

    if (this.stack.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();

      const top = this.stack[this.stack.length - 1];
      if (top && typeof top.onClose === 'function') {
        top.onClose();
        return true;
      }
    }

    return false;
  }

  /**
   * Penguncian scroll body terpusat
   */
  private applyBodyScrollLock(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (this.originalBodyStyles !== null) return; // Sudah terkunci oleh dialog sebelumnya

    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    this.originalBodyStyles = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
      scrollY,
    };

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    if (document.body.classList?.add) {
      document.body.classList.add('modal-open');
    }
    if (document.documentElement?.classList?.add) {
      document.documentElement.classList.add('modal-open');
    }
  }

  /**
   * Pelepasan penguncian scroll body secara seketika (dapat dipanggil sebelum transisi navigasi).
   */
  public releaseScrollLockNow(restoreScroll = false): void {
    this.releaseBodyScrollLock(restoreScroll);
  }

  /**
   * Pelepasan penguncian scroll body (hanya saat tumpukan dialog kosong atau dipaksa)
   */
  private releaseBodyScrollLock(restoreScroll = true): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!this.originalBodyStyles) return;

    const { position, top, width, overflow, paddingRight, scrollY } = this.originalBodyStyles;
    document.body.style.position = position === 'fixed' ? '' : position;
    document.body.style.top = top;
    document.body.style.width = width;
    document.body.style.paddingRight = paddingRight;
    document.body.style.overflow = overflow === 'hidden' ? '' : overflow;

    if (restoreScroll) {
      window.scrollTo(0, scrollY);
    }
    if (document.body.classList?.remove) {
      document.body.classList.remove('modal-open');
    }
    if (document.documentElement?.classList?.remove) {
      document.documentElement.classList.remove('modal-open');
    }
    this.originalBodyStyles = null;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) {
      try {
        l();
      } catch {
        // ignore
      }
    }
  }

  // Reset state (khusus unit testing)
  public _resetForTesting(): void {
    this.stack = [];
    this.releaseBodyScrollLock();
    this.listeners.clear();
  }
}

export const dialogManager = new DialogManager();
