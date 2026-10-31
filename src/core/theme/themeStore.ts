// Smooth Apple-like Theme Transition Handler

import { create } from 'zustand';

export type AppTheme = 'light' | 'dark';

interface ThemeState {
  theme: AppTheme;
  isDark: boolean;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

const getStoredTheme = (): AppTheme => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('ptv-theme') || localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
    } catch {
      // ignore
    }
  }
  // Default mutlak PTVPRO Hub adalah Light Mode untuk login pertama & pengguna baru
  return 'light';
};

let transitionTimeout: ReturnType<typeof setTimeout> | null = null;

const applyThemeToDom = (theme: AppTheme, animate: boolean = false) => {
  if (typeof document === 'undefined') return;

  const updateDomAndStorage = () => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('ptv-theme', theme);
      localStorage.setItem('theme', theme);
    } catch {
      // ignore
    }
  };

  // Jangan animasikan jika saat inisialisasi awal atau prefers-reduced-motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!animate || prefersReducedMotion) {
    updateDomAndStorage();
    return;
  }

  // Jika browser mendukung document.startViewTransition (Apple Safari 18+, Chrome, Edge)
  // gunakan View Transition API untuk crossfade render level murni yang halus dan elegan
  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    try {
      (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(() => {
        updateDomAndStorage();
      });
      return;
    } catch {
      // Fallback jika view transition gagal
    }
  }

  // Fallback CSS class-based smooth crossfade:
  // Pasang class .ptv-theme-transition selama durasi 380ms
  if (transitionTimeout) {
    clearTimeout(transitionTimeout);
  }

  document.documentElement.classList.add('ptv-theme-transition');
  updateDomAndStorage();

  transitionTimeout = setTimeout(() => {
    document.documentElement.classList.remove('ptv-theme-transition');
    transitionTimeout = null;
  }, 400);
};

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialTheme = getStoredTheme();
  
  // Terapkan tema awal ke DOM segera tanpa animasi (instant saat pertama kali load)
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', initialTheme);
  }

  return {
    theme: initialTheme,
    isDark: initialTheme === 'dark',
    setTheme: (nextTheme: AppTheme) => {
      applyThemeToDom(nextTheme, true);
      set({ theme: nextTheme, isDark: nextTheme === 'dark' });
    },
    toggleTheme: () => {
      const current = get().theme;
      const next: AppTheme = current === 'dark' ? 'light' : 'dark';
      applyThemeToDom(next, true);
      set({ theme: next, isDark: next === 'dark' });
    },
  };
});
