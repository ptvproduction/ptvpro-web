import React from 'react';
import { CategoryConfig, Locale, PortalService } from '../types';
import { PORTAL_UI_STRINGS } from '../services/portalCatalog';
import { ServiceCard } from './ServiceCard';

interface ServiceCategorySectionProps {
  categories: CategoryConfig[];
  services: PortalService[];
  lang: Locale;
  query: string;
  onClearQuery: () => void;
  onOpenService: (service: PortalService) => void;
}

export const ServiceCategorySection: React.FC<ServiceCategorySectionProps> = ({
  categories,
  services,
  lang,
  query,
  onClearQuery,
  onOpenService,
}) => {
  const strings = PORTAL_UI_STRINGS;
  const q = query.trim().toLowerCase();

  const isMatch = (s: PortalService) => {
    if (!q) return true;
    const cat = categories.find((c) => c.id === s.cat);
    const words = [
      s.n.id,
      s.n.en,
      s.d.id,
      s.d.en,
      cat ? cat.n.id : '',
      cat ? cat.n.en : '',
    ]
      .join(' ')
      .toLowerCase();
    return words.includes(q);
  };

  const sections = categories
    .map((cat) => ({
      category: cat,
      items: services.filter((s) => s.cat === cat.id && isMatch(s)),
    }))
    .filter((sec) => sec.items.length > 0);

  if (sections.length === 0) {
    return (
      <div className="empty">
        <h3>{strings.emT[lang]}</h3>
        <p>{strings.emD[lang]}</p>
        <button
          type="button"
          className="btn ghost"
          style={{ marginTop: 0 }}
          onClick={onClearQuery}
        >
          {strings.clr[lang]}
        </button>
      </div>
    );
  }

  return (
    <div id="cats">
      {sections.map(({ category, items }) => (
        <section
          key={category.id}
          className="cat"
          id={`c-${category.id}`}
          aria-labelledby={`h-${category.id}`}
        >
          <div className="cat-head">
            <h2 id={`h-${category.id}`}>{category.n[lang]}</h2>
            <p>{category.d[lang]}</p>
          </div>
          <div className="list">
            {items.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                lang={lang}
                onOpenService={onOpenService}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
