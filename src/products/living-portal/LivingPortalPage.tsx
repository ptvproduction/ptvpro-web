import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './styles/livingPortal.css';
import { LivingHeader } from './components/LivingHeader';
import { LauncherHero } from './components/LauncherHero';
import { LauncherDirectory } from './components/LauncherDirectory';
import { LauncherFooter } from './components/LauncherFooter';
import { HelpDialogModal } from './components/HelpDialogModal';
import { PortalInitScreen } from './components/PortalInitScreen';
import { PortalManagedAnnouncement } from '../hub/portal-management/types';
import { useModalScrollLock } from '../../shared/hooks/useModalScrollLock';
import { smoothScrollTo } from './utils/scrollUtils';
import { useLivingPortalShell } from './hooks/useLivingPortalShell';
import { usePortalSnapshot } from './hooks/usePortalSnapshot';
import type { PortalSnapshot } from './portalSnapshot';

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

/**
 * Halaman portal publik. Selama data published belum siap hanya layar inisialisasi yang
 * dirender; seluruh portal baru muncul sekaligus dari satu snapshot.
 */
export const LivingPortalPage: React.FC = () => {
  const isPreviewDraft = typeof window !== 'undefined' && window.location.search.includes('previewDraft=true');

  useLivingPortalShell('PTVPRO — Launcher Layanan Digital');
  const { state, isSlow, retry } = usePortalSnapshot({ includeDraft: isPreviewDraft });

  if (state.status === 'ready') {
    return <LivingPortalContent snapshot={state.snapshot} isPreviewDraft={isPreviewDraft} />;
  }

  return (
    <PortalInitScreen
      status={state.status}
      isSlow={isSlow}
      errorMessage={state.status === 'error' ? state.message : undefined}
      onRetry={retry}
    />
  );
};

export const LivingPortalContent: React.FC<{ snapshot: PortalSnapshot; isPreviewDraft?: boolean }> = ({
  snapshot,
  isPreviewDraft = false,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<PortalManagedAnnouncement | null>(null);

  const { services: managedServices, announcements: activeAnnouncements, settings: portalSettings } = snapshot;

  const location = useSafeLocation();

  useEffect(() => {
    // Track scroll state for header blur
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Viewport-triggered scroll reveal observer (konten sudah ada di DOM saat efek ini berjalan)
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const isReduced = reducedQuery.matches;

    let revealObserver: IntersectionObserver | null = null;

    if (!isReduced && typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      document.documentElement.classList.add('lp-scroll-motion');

      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              revealObserver?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
      );

      const revealEls = document.querySelectorAll('.lp-scroll-reveal');
      revealEls.forEach((el) => revealObserver?.observe(el));
    } else {
      document.querySelectorAll('.lp-scroll-reveal').forEach((el) => {
        el.classList.add('is-visible');
      });
    }

    return () => {
      revealObserver?.disconnect();
      window.removeEventListener('scroll', handleScroll);
      document.documentElement.classList.remove('lp-scroll-motion');
    };
  }, []);

  // Reactive hash scroll navigation (misal navigasi dari /preview/status-layanan ke #direktori-layanan)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentHash = location.hash || window.location.hash;
    if (!currentHash) return;

    const hashId = currentHash.replace(/^#/, '');
    const timer = setTimeout(() => {
      smoothScrollTo(hashId);
    }, 150);

    return () => clearTimeout(timer);
  }, [location.hash, location.pathname]);

  const effectiveTotal = managedServices.filter((s) => s.pub === 1).length;

  return (
    <div className="living-portal-root lp-portal-enter">
      <LivingHeader
        isScrolled={isScrolled}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Mode Preview Draft Banner */}
      {isPreviewDraft && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: '#171923',
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: '100px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '12px',
          fontWeight: 700,
        }}>
          <span>👁️ MODE PREVIEW DRAFT</span>
          <a
            href="/hub/portal"
            style={{ color: '#60a5fa', textDecoration: 'none' }}
          >
            Kembali ke Hub ↗
          </a>
        </div>
      )}

      {/* Compact Active Announcement Strip (Hanya jika ada pengumuman aktif yang sah) */}
      {activeAnnouncements.length > 0 && (
        <aside
          className="lp-announcement-strip"
          aria-label="Pengumuman Resmi"
        >
          <div className="lp-announcement-inner">
            <div className="lp-announcement-content">
              <span className="badge badge-primary" style={{ fontSize: '10px', padding: '2px 8px', flexShrink: 0 }}>PENGUMUMAN</span>
              <strong className="lp-announcement-title">{activeAnnouncements[0].title.id}:</strong>
              <span className="lp-announcement-body">
                {activeAnnouncements[0].body.id}
              </span>
            </div>
            <button
              type="button"
              className="lp-pill lp-announcement-cta"
              onClick={() => setSelectedAnnouncement(activeAnnouncements[0])}
            >
              Baca ↗
            </button>
          </div>
        </aside>
      )}

      <main style={{ position: 'relative' }}>
        {/* Section 1: Hero */}
        <LauncherHero
          onOpenHelp={() => setIsHelpOpen(true)}
          totalServices={effectiveTotal}
          heroTitle={portalSettings.heroTitle}
          heroDesc={portalSettings.heroDesc}
        />

        <div className="lp-line" />

        {/* Section 2: Direktori Layanan */}
        <LauncherDirectory managedServices={managedServices} />
      </main>

      {/* Section 3: Footer */}
      <LauncherFooter
        onOpenHelp={() => setIsHelpOpen(true)}
        managedServices={managedServices}
        footerSignature={portalSettings.footerSignature}
        footerCopyright={portalSettings.footerCopyright}
      />

      {/* Official Help Dialog */}
      <HelpDialogModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        helpWaNumber={portalSettings.helpWaNumber}
      />

      {/* Announcement Detail Modal with centralized scroll locking */}
      <AnnouncementDetailPopup
        announcement={selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
      />
    </div>
  );
};

const AnnouncementDetailPopup: React.FC<{
  announcement: PortalManagedAnnouncement | null;
  onClose: () => void;
}> = ({ announcement, onClose }) => {
  const modalRef = React.useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen: Boolean(announcement),
    onClose,
    modalRef,
    id: 'lp-announcement-detail-modal',
  });

  if (!announcement) return null;

  return (
    <div
      className="lp-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div ref={modalRef} className="lp-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <span className="lp-service-cat-pill">PENGUMUMAN RESMI</span>
          <button
            type="button"
            className="lp-modal-close"
            onClick={onClose}
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
        <h3 className="lp-modal-title">{announcement.title.id}</h3>
        <p className="lp-modal-desc" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {announcement.body.id}
        </p>
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          {announcement.ctaHref && (
            <a
              href={announcement.ctaHref}
              className="lp-pill dark"
              style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}
              onClick={onClose}
            >
              {announcement.ctaText?.id || 'Pelajari Lebih Lanjut'} ↗
            </a>
          )}
          <button
            type="button"
            className="lp-pill"
            onClick={onClose}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default LivingPortalPage;
