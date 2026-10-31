import React from 'react';
import { Locale, PortalView } from '../types';
import { PORTAL_UI_STRINGS } from '../services/portalCatalog';

interface PortalHeaderProps {
  lang: Locale;
  setLang: (lang: Locale) => void;
  view: PortalView;
  setView: (view: PortalView) => void;
  hasIssues: boolean;
  onNavigateServices: () => void;
}

export const PortalHeader: React.FC<PortalHeaderProps> = ({
  lang,
  setLang,
  view,
  setView,
  hasIssues,
  onNavigateServices,
}) => {
  const strings = PORTAL_UI_STRINGS;

  return (
    <>
      <a
        className="skip"
        href="#layanan"
        onClick={(e) => {
          e.preventDefault();
          onNavigateServices();
        }}
      >
        {strings.skip[lang]}
      </a>
      <header className="bar">
        <div className="wrap">
          <button
            type="button"
            className="brand-logo-btn"
            onClick={() => setView('home')}
            aria-label="Progresif TV Beranda"
          >
            <img
              src="/assets/images/ptv-logo-white.webp"
              alt="Progresif TV"
              className="portal-header-logo"
            />
          </button>
          <nav aria-label={strings.nav[lang]}>
            {view !== 'maint' && (
              <>
                <button
                  type="button"
                  className="nav-link nl-svc"
                  onClick={onNavigateServices}
                >
                  {strings.svc[lang]}
                </button>
                <button
                  type="button"
                  className="nav-link"
                  onClick={() => setView(view === 'status' ? 'home' : 'status')}
                  aria-current={view === 'status' ? 'page' : undefined}
                >
                  {hasIssues && <i className="sd" aria-hidden="true" />}
                  {strings.status[lang]}
                </button>
              </>
            )}
            <div className="lang" role="group" aria-label="Language selector">
              <button
                type="button"
                onClick={() => setLang('id')}
                aria-pressed={lang === 'id'}
              >
                ID
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                aria-pressed={lang === 'en'}
              >
                EN
              </button>
            </div>
          </nav>
        </div>
      </header>
    </>
  );
};
