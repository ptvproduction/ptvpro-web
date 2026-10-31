import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { dialogManager } from '@shared/utils/dialogManager';
import { smoothScrollTo } from '../utils/scrollUtils';

interface LivingHeaderProps {
  isScrolled?: boolean;
  onOpenHelp: () => void;
  onOpenAnnouncement?: () => void;
}

function useSafeLocation() {
  try {
    return useLocation();
  } catch {
    return {
      pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
      hash: typeof window !== 'undefined' ? window.location.hash : '',
      search: typeof window !== 'undefined' ? window.location.search : '',
    };
  }
}

function useSafeNavigate() {
  try {
    return useNavigate();
  } catch {
    return (to: string) => {
      if (typeof window !== 'undefined') {
        window.location.href = to;
      }
    };
  }
}

export const LivingHeader: React.FC<LivingHeaderProps> = ({
  isScrolled = false,
  onOpenHelp,
  onOpenAnnouncement: _onOpenAnnouncement,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useSafeLocation();
  const navigate = useSafeNavigate();

  const isStatusPage = location.pathname === '/status-layanan' || location.pathname.includes('/status-layanan');
  const isLivingPortalPage = location.pathname === '/' || location.pathname.includes('/preview/living-portal');

  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  useModalScrollLock({
    isOpen: isMenuOpen,
    onClose: closeMenu,
    modalRef: menuRef,
    id: 'lp-mobile-nav-menu',
    restoreScroll: false,
  });

  const handleBerandaClick = (e: React.MouseEvent) => {
    e.preventDefault();
    closeMenu();
    dialogManager.releaseScrollLockNow(false);

    if (isLivingPortalPage) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          smoothScrollTo('beranda');
        });
      });
    } else {
      navigate('/');
    }
  };

  const handleDirectoryClick = (e: React.MouseEvent) => {
    e.preventDefault();
    closeMenu();
    dialogManager.releaseScrollLockNow(false);

    if (isLivingPortalPage) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          smoothScrollTo('direktori-layanan');
        });
      });
    } else {
      navigate('/#direktori-layanan');
    }
  };

  const handleStatusClick = (e: React.MouseEvent) => {
    e.preventDefault();
    closeMenu();
    dialogManager.releaseScrollLockNow(false);

    if (isStatusPage) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/status-layanan');
    }
  };

  const handleHelpClick = (e: React.MouseEvent) => {
    e.preventDefault();
    closeMenu();
    onOpenHelp();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className={`lp-top ${isScrolled ? 'scrolled' : ''}`}>
      <a
        href="/"
        onClick={handleBerandaClick}
        className="lp-brand-logo-wrap"
        aria-label="Progresif TV Production - Beranda"
      >
        <img
          src="/assets/images/ptv-logo-white.webp"
          alt="Progresif TV Production"
          className="lp-brand-logo lp-brand-logo-header"
          width={150}
          height={30}
          loading="eager"
        />
      </a>

      <div className="lp-top-actions">
        <a
          className="lp-pill dark lp-hide-mobile"
          href={isLivingPortalPage ? '#direktori-layanan' : '/#direktori-layanan'}
          onClick={handleDirectoryClick}
        >
          {isStatusPage ? 'DIREKTORI ↗' : 'LAYANAN ↓'}
        </a>
        <button
          type="button"
          className="lp-pill lp-pill-help"
          onClick={onOpenHelp}
          aria-label="Pusat Bantuan Resmi"
          title="Pusat Bantuan Resmi"
        >
          <span className="lp-pill-text">BANTUAN ↗</span>
          <span className="lp-pill-icon" aria-hidden="true">?</span>
        </button>
        <button
          ref={buttonRef}
          type="button"
          className={`lp-pill lp-pill-menu ${isMenuOpen ? 'is-active' : ''}`}
          id="lpMenuBtn"
          aria-expanded={isMenuOpen}
          aria-controls="lpNavMenu"
          aria-label={isMenuOpen ? 'Tutup Menu Navigasi' : 'Buka Menu Navigasi'}
          title={isMenuOpen ? 'Tutup Menu' : 'Buka Menu'}
          onClick={toggleMenu}
        >
          <span className="lp-pill-text">{isMenuOpen ? 'CLOSE  ×' : 'MENU  ••'}</span>
          <span className="lp-pill-icon" aria-hidden="true">{isMenuOpen ? '✕' : '••'}</span>
        </button>
      </div>

      <nav
        ref={menuRef}
        className={`lp-menu ${isMenuOpen ? 'open' : ''}`}
        id="lpNavMenu"
        aria-label="Navigasi Launcher"
      >
        <a
          href="/"
          className={`lp-menu-link ${isLivingPortalPage && location.hash !== '#direktori-layanan' ? 'is-active' : ''}`}
          onClick={handleBerandaClick}
        >
          Beranda <span>01</span>
        </a>
        <a
          href="/#direktori-layanan"
          className={`lp-menu-link ${location.hash === '#direktori-layanan' ? 'is-active' : ''}`}
          onClick={handleDirectoryClick}
        >
          Direktori Layanan <span>02</span>
        </a>
        <a
          href="/status-layanan"
          className={`lp-menu-link ${isStatusPage ? 'is-active' : ''}`}
          onClick={handleStatusClick}
        >
          Status Sistem <span>03</span>
        </a>
        <button
          type="button"
          className="lp-menu-link"
          style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={handleHelpClick}
        >
          Pusat Bantuan <span>04</span>
        </button>
      </nav>
    </header>
  );
};
