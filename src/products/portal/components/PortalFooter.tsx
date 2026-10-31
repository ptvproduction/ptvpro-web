import React from 'react';
import { Locale } from '../types';
import { PORTAL_UI_STRINGS } from '../services/portalCatalog';

interface PortalFooterProps {
  lang: Locale;
  onNavigateStatus: () => void;
  footerCopyright?: string;
}

export const PortalFooter: React.FC<PortalFooterProps> = ({
  lang,
  onNavigateStatus,
  footerCopyright,
}) => {
  const strings = PORTAL_UI_STRINGS;
  const currentYear = new Date().getFullYear();

  return (
    <footer>
      <div className="wrap">
        <div className="foot-top">
          <div>
            <strong>PTVPRO</strong>
            <span>Dibangun oleh santri, didedikasikan untuk semua.</span>
          </div>
          <div className="fl">
            <button
              type="button"
              className="foot-link"
              onClick={onNavigateStatus}
            >
              {strings.statusLink[lang]}
            </button>
            <a
              href="https://instagram.com/progresiftv"
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram
            </a>
            <a
              href="https://youtube.com/@progresiftv"
              target="_blank"
              rel="noopener noreferrer"
            >
              YouTube
            </a>
          </div>
        </div>
        <small className="cp">
          {footerCopyright || `${'\u00A9'} ${currentYear} Progresif TV`}
        </small>
        <div className="mark" aria-hidden="true">
          PTVPRO
        </div>
      </div>
    </footer>
  );
};
