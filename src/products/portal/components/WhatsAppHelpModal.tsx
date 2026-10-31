import React, { useState } from 'react';
import { Locale } from '../types';
import {
  PORTAL_UI_STRINGS,
  WHATSAPP_TOPICS,
} from '../services/portalCatalog';
import { buildWhatsAppHelpUrl } from '../config/portalConfig';
import { PortalIcon } from './PortalIcons';

interface WhatsAppHelpModalProps {
  lang: Locale;
  currentPageName: string;
  helpWaNumber?: string;
}

export const WhatsAppHelpModal: React.FC<WhatsAppHelpModalProps> = ({
  lang,
  currentPageName,
  helpWaNumber,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);

  const strings = PORTAL_UI_STRINGS;
  const currentTopic = WHATSAPP_TOPICS[selectedTopicIndex] || WHATSAPP_TOPICS[0];
  const messagePreview = strings.msg(currentTopic.label[lang], currentPageName)[lang];

  // Gunakan konfigurasi resmi WhatsApp portal
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
    <>
      {isOpen && (
        <div
          className="wap"
          role="dialog"
          aria-label={strings.waT[lang]}
        >
          <strong>{strings.waT[lang]}</strong>
          <p className="fine" style={{ marginTop: '4px' }}>
            {strings.waD[lang]}
          </p>

          <div className="opts">
            {WHATSAPP_TOPICS.map((topic, i) => (
              <button
                key={topic.id}
                type="button"
                className="opt"
                onClick={() => setSelectedTopicIndex(i)}
                aria-pressed={i === selectedTopicIndex}
              >
                {topic.label[lang]}
              </button>
            ))}
          </div>

          <div className="prev">
            <small>{strings.waPrev[lang]}</small>
            {messagePreview}
          </div>

          <button
            type="button"
            className="btn wb"
            disabled={!isConfigured}
            onClick={handleOpenWhatsApp}
          >
            {strings.waSend[lang]}
          </button>

          {!isConfigured && (
            <p className="fine" style={{ marginTop: '6px', color: '#B45309' }}>
              {strings.waUnconfigured[lang]}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        className="fab"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={strings.waT[lang]}
      >
        <PortalIcon name={isOpen ? 'x' : 'chat'} />
      </button>
    </>
  );
};
