import React, { useRef } from 'react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { Locale, PortalAnnouncement } from '../types';
import { PORTAL_UI_STRINGS } from '../services/portalCatalog';
import { PortalIcon } from './PortalIcons';

interface AnnouncementModalProps {
  announcement: PortalAnnouncement;
  lang: Locale;
  onClose: () => void;
  onViewServices: () => void;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  announcement,
  lang,
  onClose,
  onViewServices,
}) => {
  const strings = PORTAL_UI_STRINGS;
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useModalScrollLock({
    isOpen: true,
    onClose,
    modalRef,
    id: 'modal-announcement',
  });

  const hasPoster = announcement.format !== 'text' && !!announcement.posterSrc;
  const hasText = announcement.format !== 'poster';

  return (
    <div
      className="ov ptvpro-portal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="dlg ptvpro-portal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={announcement.title[lang]}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className="x"
          onClick={onClose}
          aria-label={strings.close[lang]}
        >
          <PortalIcon name="x" />
        </button>

        <div className="scr">
          {hasPoster && (
            <img
              src={announcement.posterSrc}
              alt={strings.posterAlt[lang]}
            />
          )}

          {hasText && (
            <div className="pb">
              <h2>{announcement.title[lang]}</h2>
              <p>{announcement.body[lang]}</p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  onClose();
                  onViewServices();
                }}
              >
                {announcement.ctaText[lang]}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
