import React from 'react';
import { Locale, PortalService } from '../types';
import {
  PORTAL_UI_STRINGS,
  SERVICE_NOTES,
  SERVICE_STATUS_LABELS,
} from '../services/portalCatalog';
import { PortalIcon } from './PortalIcons';

interface ServiceStatusViewProps {
  services: PortalService[];
  lang: Locale;
  onBack: () => void;
}

export const ServiceStatusView: React.FC<ServiceStatusViewProps> = ({
  services,
  lang,
  onBack,
}) => {
  const strings = PORTAL_UI_STRINGS;
  const publicServices = services.filter((s) => s.pub !== 0);
  const issuesCount = publicServices.filter(
    (s) => s.st === 'incident' || s.st === 'maint'
  ).length;

  return (
    <main className="wrap pg">
      <button type="button" className="back" onClick={onBack}>
        <PortalIcon name="left" />
        {strings.back[lang]}
      </button>

      <h1>{strings.statusLink[lang]}</h1>
      <p className="lead">{strings.stLead[lang]}</p>

      <div
        className={`sum${issuesCount > 0 ? ' warn' : ''}`}
        role="status"
      >
        <PortalIcon name={issuesCount > 0 ? 'alert' : 'check'} />
        <span>
          {issuesCount > 0
            ? strings.issues(issuesCount)[lang]
            : strings.allOk[lang]}
        </span>
      </div>

      <ul className="stl">
        {publicServices.map((service) => {
          const note = SERVICE_NOTES[service.st]
            ? SERVICE_NOTES[service.st]![lang]
            : '';

          return (
            <li key={service.id}>
              <div>
                <b>{service.n[lang]}</b>
                {note && <span className="nt">{note}</span>}
              </div>
              <span className={`bd ${service.st}`}>
                {SERVICE_STATUS_LABELS[service.st][lang]}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="fine">
        {lang === 'id'
          ? 'Data status dipantau berkala dan diperbarui langsung oleh pengelola infrastruktur Progresif TV.'
          : 'Service conditions are periodically monitored and updated by Progresif TV infrastructure maintainers.'}
      </p>
    </main>
  );
};
