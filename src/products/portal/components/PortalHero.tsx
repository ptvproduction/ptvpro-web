import React from 'react';
import { Locale } from '../types';
import { PORTAL_UI_STRINGS } from '../services/portalCatalog';

interface PortalHeroProps {
  lang: Locale;
}

export const PortalHero: React.FC<PortalHeroProps> = ({ lang }) => {
  const strings = PORTAL_UI_STRINGS;

  return (
    <section className="hero" aria-labelledby="judul-portal">
      <div className="wrap">
        <h1 id="judul-portal">{strings.h1[lang]}</h1>
        <p>{strings.sub[lang]}</p>
      </div>
    </section>
  );
};
