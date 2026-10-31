import React from 'react';
import { Locale } from '../types';
import { PORTAL_UI_STRINGS } from '../services/portalCatalog';
import { PortalIcon } from './PortalIcons';

interface ServiceSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  lang: Locale;
}

export const ServiceSearch: React.FC<ServiceSearchProps> = ({
  query,
  onQueryChange,
  lang,
}) => {
  const strings = PORTAL_UI_STRINGS;

  return (
    <label className="search">
      <span className="sr">{strings.ph[lang]}</span>
      <PortalIcon name="search" />
      <input
        id="q"
        type="search"
        autoComplete="off"
        placeholder={strings.ph[lang]}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />
    </label>
  );
};
