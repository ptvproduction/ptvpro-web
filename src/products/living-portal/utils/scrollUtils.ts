/**
 * PTVPRO — Living Portal Smooth Scroll Utility
 * Menangani smooth scroll terpadu dengan offset sticky header dinamis dan update history hash.
 */

export const smoothScrollTo = (targetId: string, customOffset?: number) => {
  if (typeof window === 'undefined') return;

  const cleanId = targetId.replace(/^#/, '');
  const element = document.getElementById(cleanId);
  if (!element) return;

  // 1. Ukur tinggi aktual sticky header secara dinamis
  let offset = customOffset;
  if (typeof offset !== 'number') {
    const headerEl = document.querySelector('.lp-top');
    if (headerEl) {
      const headerRect = headerEl.getBoundingClientRect();
      offset = Math.round(headerRect.height) + 12; // safety breathing room
    } else {
      offset = 80;
    }
  }

  // 2. Dukung preferensi reduced motion pengguna
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 3. Hitung koordinat target absolut terhadap dokumen
  const elementTop = element.getBoundingClientRect().top;
  const currentScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
  const targetTop = elementTop + currentScrollY - offset;

  window.scrollTo({
    top: Math.max(0, Math.round(targetTop)),
    behavior: reducedMotion ? 'auto' : 'smooth',
  });

  // 4. Update URL hash tanpa merusak riwayat browser
  if (window.history && window.history.pushState) {
    const newUrl = `${window.location.pathname}${window.location.search}#${cleanId}`;
    if (window.location.hash !== `#${cleanId}`) {
      window.history.pushState(null, '', newUrl);
    } else {
      window.history.replaceState(null, '', newUrl);
    }
  }
};

