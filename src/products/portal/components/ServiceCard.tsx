import React from 'react';
import { Locale, PortalService } from '../types';
import {
  SERVICE_ACCESS_LABELS,
  SERVICE_NOTES,
  SERVICE_STATUS_LABELS,
} from '../services/portalCatalog';
import { PortalIcon } from './PortalIcons';

interface ServiceCardProps {
  service: PortalService;
  lang: Locale;
  onOpenService: (service: PortalService) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  lang,
  onOpenService,
}) => {
  const isSoon = service.st === 'soon';
  const note = SERVICE_NOTES[service.st] ? SERVICE_NOTES[service.st]![lang] : '';

  return (
    <a
      className={`svc svc-${service.id}${service.hub ? ' hub' : ''}`}
      href={isSoon ? '#' : (service.url || '#')}
      onClick={(e) => {
        e.preventDefault();
        onOpenService(service);
      }}
      data-svc={service.id}
    >
      <span className="tile">
        <PortalIcon name={service.ic} />
      </span>
      <span>
        <h3>{service.n[lang]}</h3>
        <p>{service.d[lang]}</p>
        <span className="meta">
          <span className={`access ${service.ac}`}>
            {SERVICE_ACCESS_LABELS[service.ac][lang]}
          </span>
          {service.st !== 'ok' && (
            <span className={`bd ${service.st}`}>
              {SERVICE_STATUS_LABELS[service.st][lang]}
            </span>
          )}
        </span>
        {note && <span className="nt">{note}</span>}
      </span>
      <PortalIcon
        name={isSoon ? 'right' : 'out'}
        className="i go"
      />
    </a>
  );
};
