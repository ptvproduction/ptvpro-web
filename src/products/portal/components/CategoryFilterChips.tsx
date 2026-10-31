import React from 'react';
import { CategoryConfig, Locale } from '../types';
import { PORTAL_UI_STRINGS } from '../services/portalCatalog';

interface CategoryFilterChipsProps {
  categories: CategoryConfig[];
  lang: Locale;
  onSelectCategory: (categoryId: string) => void;
}

export const CategoryFilterChips: React.FC<CategoryFilterChipsProps> = ({
  categories,
  lang,
  onSelectCategory,
}) => {
  const strings = PORTAL_UI_STRINGS;

  return (
    <nav className="chips" aria-label={strings.catNav[lang]}>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelectCategory(cat.id)}
        >
          {cat.n[lang]}
        </button>
      ))}
    </nav>
  );
};
