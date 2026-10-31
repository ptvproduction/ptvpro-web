import React from 'react';
import { smoothScrollTo } from '../utils/scrollUtils';

interface LauncherHeroProps {
  onOpenHelp: () => void;
  onOpenAnnouncement?: () => void;
  totalServices: number;
  heroTitle: { line1: string; line2: string };
  heroDesc: string;
}

export const LauncherHero: React.FC<LauncherHeroProps> = ({
  onOpenHelp,
  totalServices,
  heroTitle,
  heroDesc,
}) => {
  const handleScrollToDirectory = (e: React.MouseEvent) => {
    e.preventDefault();
    smoothScrollTo('direktori-layanan');
  };

  const line1 = heroTitle.line1;
  const line2 = heroTitle.line2;
  const description = heroDesc;

  return (
    <section id="beranda" className="lp-hero">
      <div className="lp-hero-meta lp-reveal-meta">
        <span className="lp-eyebrow" style={{ margin: 0 }}>
          PORTAL LAYANAN RESMI · PROGRESIF TV
        </span>
      </div>

      <h1 className="lp-hero-title">
        <span className="lp-hero-line-mask">
          <span className="lp-hero-line lp-line-1">{line1}</span>
        </span>
        <span className="lp-hero-line-mask">
          <em className="lp-hero-line lp-line-2">{line2}</em>
        </span>
      </h1>

      <div className="lp-hero-foot lp-reveal-foot">
        <div style={{ maxWidth: '640px' }}>
          <p>{description}</p>
          <div className="lp-hero-actions">
            <a
              href="#direktori-layanan"
              onClick={handleScrollToDirectory}
              className="lp-pill dark lp-cta-primary"
            >
              JELAJAHI {totalServices} LAYANAN ↓
            </a>
            <button
              type="button"
              onClick={onOpenHelp}
              className="lp-pill lp-cta-secondary"
              aria-label="Buka dialog bantuan WhatsApp"
            >
              BANTUAN RESMI ↗
            </button>
          </div>
        </div>

        <a
          href="#direktori-layanan"
          onClick={handleScrollToDirectory}
          className="lp-scroll-indicator"
          aria-label="Scroll ke direktori layanan"
        >
          ↓
        </a>
      </div>
    </section>
  );
};
