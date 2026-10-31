import React from 'react';
import { Locale, PortalService } from '../types';
import {
  PORTAL_UI_STRINGS,
  SERVICE_STATUS_LABELS,
} from '../services/portalCatalog';
import { PortalIcon } from './PortalIcons';

interface ComingSoonViewProps {
  service: PortalService;
  lang: Locale;
  onBack: () => void;
}

export const ComingSoonView: React.FC<ComingSoonViewProps> = ({
  service,
  lang,
  onBack,
}) => {
  const strings = PORTAL_UI_STRINGS;

  return (
    <main className="wrap pg">
      <button type="button" className="back" onClick={onBack}>
        <PortalIcon name="left" />
        {strings.back[lang]}
      </button>

      <div className="idrow">
        <span className="tile big">
          <PortalIcon name={service.ic} />
        </span>
        <span className={`bd ${service.st}`}>
          {SERVICE_STATUS_LABELS[service.st][lang]}
        </span>
      </div>

      <h1>{service.n[lang]}</h1>
      <p className="lead">{service.d[lang]}</p>

      <div className="info">
        <PortalIcon name="clock" />
        <span>{strings.soonInfo[lang]}</span>
      </div>

      <button type="button" className="btn" onClick={onBack}>
        {strings.back[lang]}
      </button>
    </main>
  );
};
