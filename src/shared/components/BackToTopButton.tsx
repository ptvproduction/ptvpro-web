import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

interface BackToTopButtonProps {
  threshold?: number;
}

export const BackToTopButton: React.FC<BackToTopButtonProps> = ({ threshold = 350 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const location = useLocation();

  // Check if any modal / scrim / drawer is currently active in the DOM
  const checkModalActive = useCallback(() => {
    if (typeof document === 'undefined') return false;
    if (document.body.classList.contains('modal-open')) return true;
    const activeDialog = document.querySelector(
      '.loan-modal-scrim, .scrim.on, .sheet.on, .loan-mobile-drawer-overlay.open, .unit-picker-dialog-card, .loan-modal-card'
    );
    return !!activeDialog;
  }, []);

  // Check scroll position
  const handleScroll = useCallback(() => {
    if (typeof window === 'undefined') return;

    const winScroll = window.scrollY || document.documentElement.scrollTop || 0;
    const mainEl = document.getElementById('main') || document.querySelector('.main');
    const mainScroll = mainEl ? mainEl.scrollTop : 0;
    const currentScroll = Math.max(winScroll, mainScroll);

    setIsVisible(currentScroll > threshold);
    setIsModalOpen(checkModalActive());
  }, [threshold, checkModalActive]);

  // Set up scroll listeners and MutationObserver for modals
  useEffect(() => {
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    const mainEl = document.getElementById('main') || document.querySelector('.main');
    if (mainEl) {
      mainEl.addEventListener('scroll', handleScroll, { passive: true });
    }

    // Observer to detect when modals open or close
    const observer = new MutationObserver(() => {
      setIsModalOpen(checkModalActive());
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (mainEl) {
        mainEl.removeEventListener('scroll', handleScroll);
      }
      observer.disconnect();
    };
  }, [handleScroll, checkModalActive]);

  // Recalculate on route change
  useEffect(() => {
    handleScroll();
  }, [location.pathname, handleScroll]);

  const scrollToTop = () => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = prefersReducedMotion ? 'auto' : 'smooth';

    window.scrollTo({ top: 0, behavior });
    const mainEl = document.getElementById('main') || document.querySelector('.main');
    if (mainEl && mainEl.scrollTop > 0) {
      mainEl.scrollTo({ top: 0, behavior });
    }
  };

  const shouldShow = isVisible && !isModalOpen;

  return (
    <button
      type="button"
      className={`ptv-back-to-top-btn ${shouldShow ? 'show' : ''}`}
      onClick={scrollToTop}
      aria-label="Kembali ke atas"
      title="Kembali ke atas"
    >
      <i className="fa-solid fa-arrow-up" />
    </button>
  );
};
