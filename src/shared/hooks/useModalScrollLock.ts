import { useEffect, useRef } from 'react';
import { dialogManager } from '../utils/dialogManager';

export interface UseModalScrollLockOptions {
  isOpen: boolean;
  onClose: () => void;
  modalRef: React.RefObject<HTMLElement | null>;
  id?: string;
  isGlobal?: boolean;
  restoreScroll?: boolean;
}

/**
 * Hook aksesibilitas modal dan penguncian scroll latar belakang (Background Scroll Lock)
 * Terintegrasi langsung dengan dialogManager untuk:
 * - Single-modal policy & Dialog Stack (LIFO)
 * - Mencegah scroll halaman di belakang modal secara terpusat (termasuk iOS Safari)
 * - Mencegah layout shift dengan mengukur scrollbar
 * - Focus Trap: membatasi navigasi Tab di dalam modal
 * - Focus Restoration: mengembalikan fokus ke elemen pemicu saat modal ditutup
 * - Tombol Escape berjenjang: hanya menutup dialog teratas
 */
export function useModalScrollLock({
  isOpen,
  onClose,
  modalRef,
  id: customId,
  isGlobal = false,
  restoreScroll = true,
}: UseModalScrollLockOptions) {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const idRef = useRef<string>(customId || `dlg-${Math.random().toString(36).substring(2, 9)}`);
  const onCloseRef = useRef(onClose);

  // Keep onClose callback fresh without triggering unregister on every re-render
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Update idRef if customId changes
  useEffect(() => {
    if (customId) idRef.current = customId;
  }, [customId]);

  // 1. Dialog Registration & Centralized Scroll Lock
  useEffect(() => {
    if (!isOpen) return;

    // Simpan elemen yang sedang aktif sebelum modal terbuka untuk focus restoration jika belum tersimpan
    if (!previousActiveElementRef.current || !modalRef.current?.contains(previousActiveElementRef.current)) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    }

    const unregister = dialogManager.register({
      id: idRef.current,
      onClose: () => onCloseRef.current(),
      element: modalRef.current,
      triggerElement: previousActiveElementRef.current,
      isGlobal,
      restoreScroll,
    });

    return () => {
      unregister();
    };
  }, [isOpen, isGlobal, restoreScroll]);

  // 2. Focus Trap & Hierarchical Escape Key Listener
  useEffect(() => {
    if (!isOpen) return;

    // Pindahkan fokus ke dalam modal hanya saat initial open jika belum ada elemen dalam modal yang terfokus
    const focusTimer = setTimeout(() => {
      if (modalRef.current) {
        if (modalRef.current.contains(document.activeElement)) {
          return; // Elemen di dalam modal sudah aktif / sedang diketik pengguna; jangan mencuri fokus
        }

        // Prioritaskan input/textarea pertama agar kursor langsung siap ketik
        const formInput = modalRef.current.querySelector<HTMLElement>(
          'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
        );
        if (formInput) {
          formInput.focus();
        } else {
          const focusable = modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) {
            focusable[0].focus();
          } else {
            modalRef.current.focus();
          }
        }
      }
    }, 30);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Hanya proses jika dialog ini adalah dialog teratas di dialogManager
        const top = dialogManager.getTopDialog();
        if (!top || top.id === idRef.current) {
          dialogManager.handleEscape(e);
        }
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, modalRef]);
}
