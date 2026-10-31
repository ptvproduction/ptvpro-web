import React from 'react';
import { Locale } from '../types';
import { PORTAL_UI_STRINGS } from '../services/portalCatalog';
import { PortalIcon } from './PortalIcons';

interface MaintenanceViewProps {
  lang: Locale;
  onNavigateHub: () => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  lang,
  onNavigateHub,
}) => {
  const strings = PORTAL_UI_STRINGS;

  return (
    <main className="wrap pg">
      <span className="tile big">
        <PortalIcon name="wrench" />
      </span>
      <h1>{strings.mT[lang]}</h1>
      <p className="lead">{strings.mD[lang]}</p>
      <div className="info">
        <PortalIcon name="info" />
        <span>{strings.mHub[lang]}</span>
      </div>
      <button
        type="button"
        className="btn ghost"
        onClick={onNavigateHub}
      >
        {strings.mHubB[lang]}
      </button>
    </main>
  );
};
