import React, { useState, useRef } from 'react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { Locale } from '../types';
import {
  PORTAL_UI_STRINGS,
  WHATSAPP_TOPICS,
} from '../../portal/services/portalCatalog';
import { buildWhatsAppHelpUrl } from '../../portal/config/portalConfig';

interface HelpDialogModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: Locale;
  helpWaNumber?: string;
}

export const HelpDialogModal: React.FC<HelpDialogModalProps> = ({
  isOpen,
  onClose,
  lang = 'id',
  helpWaNumber,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'lp-help-dialog-modal',
  });

  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);

  if (!isOpen) return null;

  const strings = PORTAL_UI_STRINGS;
  const currentTopic = WHATSAPP_TOPICS[selectedTopicIndex] || WHATSAPP_TOPICS[0];
  const currentPageName = 'Living Launcher Preview';
  const messagePreview = strings.msg(currentTopic.label[lang], currentPageName)[lang];

  const targetUrl = buildWhatsAppHelpUrl({
    number: helpWaNumber,
    topic: currentTopic.label[lang],
    pageName: currentPageName,
    lang,
    customMessage: messagePreview,
  });
  const isConfigured = Boolean(targetUrl);

  const handleOpenWhatsApp = () => {
    if (!targetUrl) return;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="lp-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="helpModalTitle"
    >
      <div ref={modalRef} className="lp-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <span className="lp-service-cat-pill">PUSAT BANTUAN WHATSAPP</span>
          <button
            type="button"
            className="lp-modal-close"
            onClick={onClose}
            aria-label="Tutup dialog bantuan"
          >
            ✕
          </button>
        </div>

        <h3 id="helpModalTitle" className="lp-modal-title">
          {strings.waT[lang]}
        </h3>
        <p className="lp-modal-desc">{strings.waD[lang]}</p>

        <div className="lp-help-topics-list">
          {WHATSAPP_TOPICS.map((topic, i) => (
            <button
              key={topic.id}
              type="button"
              className={`lp-help-topic-btn ${i === selectedTopicIndex ? 'active' : ''}`}
              onClick={() => setSelectedTopicIndex(i)}
            >
              <span>{topic.label[lang]}</span>
              {i === selectedTopicIndex && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>

        <div className="lp-help-preview-box">
          <small>{strings.waPrev[lang]}</small>
          <pre>{messagePreview}</pre>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="lp-pill dark"
            style={{ flex: 1, justifyContent: 'center' }}
            disabled={!isConfigured}
            onClick={handleOpenWhatsApp}
          >
            {strings.waSend[lang]} ↗
          </button>
          <button
            type="button"
            className="lp-pill"
            onClick={onClose}
          >
            Tutup
          </button>
        </div>

        {!isConfigured && (
          <p className="lp-side-label" style={{ color: '#B45309', marginTop: '12px' }}>
            {strings.waUnconfigured[lang]}
          </p>
        )}
      </div>
    </div>
  );
};
