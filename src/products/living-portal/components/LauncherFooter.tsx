import React, { useMemo } from 'react';
import { smoothScrollTo } from '../utils/scrollUtils';
import { PortalManagedService } from '../../hub/portal-management/types';

interface LauncherFooterProps {
  onOpenHelp: () => void;
  /** Layanan published dari snapshot portal. Bila diabaikan, dianggap kosong. */
  managedServices?: PortalManagedService[];
  totalServices?: number;
  footerSignature?: string;
  footerCopyright?: string;
}

export const LauncherFooter: React.FC<LauncherFooterProps> = ({
  onOpenHelp,
  managedServices = [],
  footerSignature: _footerSignature,
  footerCopyright,
}) => {
  const scrollToTop = () => {
    smoothScrollTo('beranda');
  };

  // Status system dynamic computation from single source of truth
  const systemStatus = useMemo(() => {
    const publicServices = managedServices.filter((s) => s.pub !== 0 && s.isActive !== false);
    const incidentCount = publicServices.filter((s) => s.st === 'incident').length;
    const maintCount = publicServices.filter((s) => s.st === 'maint').length;
    const activeCount = publicServices.filter((s) => s.st === 'ok' || (s as any).status === 'operational').length;

    if (incidentCount > 0) {
      return {
        text: `▲ ${incidentCount} Kendala Layanan Terdeteksi`,
        className: 'lp-footer-status-tag status-warn',
      };
    }
    if (maintCount > 0) {
      return {
        text: `⚙ Pemeliharaan Sistem Berjalan`,
        className: 'lp-footer-status-tag status-maint',
      };
    }
    return {
      text: `● ${activeCount} Layanan Publik Beroperasi`,
      className: 'lp-footer-status-tag status-ok',
    };
  }, [managedServices]);

  return (
    <footer className="lp-compact-footer lp-scroll-reveal">
      <div className="lp-footer-container">
        {/* Identitas Santri Heroic Signature */}
        <div className="lp-footer-santri-signature">
          <p className="lp-santri-statement">
            Dibangun oleh <em>santri</em>, didedikasikan untuk semua.
          </p>
          <p className="lp-santri-sub">
            Pusat layanan dan direktori instrumen digital terpadu Progresif TV &amp; keluarga yayasan.
          </p>
        </div>

        <div className="lp-footer-top-grid">
          <div className="lp-footer-brand-col">
            <a
              href="#beranda"
              onClick={(e) => {
                e.preventDefault();
                scrollToTop();
              }}
              className="lp-brand-logo-wrap"
              aria-label="Progresif TV Production - Beranda"
            >
              <img
                src="/assets/images/ptv-logo-white.webp"
                alt="Progresif TV Production"
                className="lp-brand-logo lp-brand-logo-footer"
                width={150}
                height={30}
                loading="lazy"
              />
            </a>
            <p className="lp-footer-brand-desc">
              Portal direktori dan pintu akses resmi ekosistem digital Progresif TV
              serta layanan digital keluarga yayasan.
            </p>
          </div>

          <div className="lp-footer-mobile-columns">
            <div className="lp-footer-links-col">
              <span className="lp-footer-links-title">LAYANAN UTAMA</span>
              <div className="lp-footer-links-list">
                <a href="/hub" className="lp-footer-link">
                  PTV Hub (Internal Kru) ↗
                </a>
                <a href="/verifikasi-identitas" className="lp-footer-link">
                  Verifikasi Identitas Kru ↗
                </a>
                <a href="/verifikasi-surat" className="lp-footer-link">
                  Keabsahan Dokumen ↗
                </a>
                <a href="https://bsh.bio" target="_blank" rel="noopener noreferrer" className="lp-footer-link">
                  Shortlink Management ↗
                </a>
              </div>
            </div>

            <div className="lp-footer-links-col">
              <span className="lp-footer-links-title">BANTUAN & INFORMASI</span>
              <div className="lp-footer-links-list">
                <button type="button" onClick={onOpenHelp} className="lp-footer-btn-link">
                  Pusat Bantuan WhatsApp ↗
                </button>
                <a href="/status-layanan" className="lp-footer-link">
                  Status Sistem Publik ↗
                </a>
                <span className={systemStatus.className}>{systemStatus.text}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lp-footer-bottom-bar">
          <div>
            {footerCopyright && <span>{footerCopyright}</span>}
            <span style={{ marginLeft: footerCopyright ? '12px' : 0, opacity: 0.7 }}>Hak cipta dilindungi.</span>
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            className="lp-pill dark"
            style={{ padding: '8px 18px', fontSize: '11px' }}
            aria-label="Kembali ke atas halaman"
          >
            ↑ KE ATAS
          </button>
        </div>
      </div>
    </footer>
  );
};
