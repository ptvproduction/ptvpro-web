import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { smoothScrollTo } from '../../src/products/living-portal/utils/scrollUtils';
import { dialogManager } from '../../src/shared/utils/dialogManager';

describe('Living Portal — Menu Navigation & Scroll Coordination', () => {
  const originalDocument = (globalThis as any).document;
  const originalWindow = (globalThis as any).window;

  let mockBodyStyle: Record<string, string>;
  let mockScrollTo: any;
  let mockPushState: any;
  let mockReplaceState: any;
  let mockMatchMedia: any;
  let mockElements: Record<string, any>;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockBodyStyle = {
      position: '',
      top: '',
      width: '',
      overflow: '',
      paddingRight: '',
    };

    mockScrollTo = vi.fn();
    mockPushState = vi.fn();
    mockReplaceState = vi.fn();
    mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    mockElements = {};

    (globalThis as any).document = {
      activeElement: null,
      body: {
        style: mockBodyStyle,
        contains: vi.fn(() => true),
      },
      documentElement: {
        scrollTop: 0,
        clientWidth: 1200,
      },
      getElementById: vi.fn((id: string) => mockElements[id] || null),
      querySelector: vi.fn((selector: string) => {
        if (selector === '.lp-top') {
          return mockElements['.lp-top'] || null;
        }
        return null;
      }),
      querySelectorAll: vi.fn(() => []),
    };

    (globalThis as any).window = {
      scrollY: 0,
      pageYOffset: 0,
      innerWidth: 1200,
      location: {
        pathname: '/preview/living-portal',
        search: '',
        hash: '',
      },
      history: {
        pushState: mockPushState,
        replaceState: mockReplaceState,
      },
      matchMedia: mockMatchMedia,
      scrollTo: mockScrollTo,
    };

    dialogManager._resetForTesting();
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
    dialogManager._resetForTesting();
  });

  it('1. smoothScrollTo memperhitungkan tinggi sticky header dinamis .lp-top + breathing room', () => {
    // Setup mock header dengan tinggi 60px
    mockElements['.lp-top'] = {
      getBoundingClientRect: () => ({
        top: 0,
        bottom: 60,
        height: 60,
      }),
    };

    // Setup target section direktori di koordinat top: 800
    mockElements['direktori-layanan'] = {
      getBoundingClientRect: () => ({
        top: 800,
        height: 600,
      }),
    };

    smoothScrollTo('direktori-layanan');

    // Target = elementTop (800) + scrollY (0) - (headerHeight (60) + 12) = 728
    expect(mockScrollTo).toHaveBeenCalledWith({
      top: 728,
      behavior: 'smooth',
    });
    expect(mockPushState).toHaveBeenCalledWith(null, '', '/preview/living-portal#direktori-layanan');
  });

  it('2. smoothScrollTo mendukung prefers-reduced-motion', () => {
    mockElements['direktori-layanan'] = {
      getBoundingClientRect: () => ({
        top: 500,
        height: 500,
      }),
    };

    mockMatchMedia.mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    smoothScrollTo('direktori-layanan', 80);

    // Target = 500 - 80 = 420 dengan behavior: 'auto'
    expect(mockScrollTo).toHaveBeenCalledWith({
      top: 420,
      behavior: 'auto',
    });
  });

  it('3. dialogManager melepaskan scroll lock seketika dengan releaseScrollLockNow(false) tanpa mereset scroll', () => {
    // Simulasi dialog menu dibuka saat scrollY = 0
    (globalThis as any).window.scrollY = 0;
    const unregister = dialogManager.register({
      id: 'lp-mobile-nav-menu',
      onClose: vi.fn(),
      restoreScroll: false,
    });

    expect(mockBodyStyle.position).toBe('fixed');
    expect(mockBodyStyle.overflow).toBe('hidden');

    // Panggil releaseScrollLockNow(false)
    dialogManager.releaseScrollLockNow(false);

    expect(mockBodyStyle.position).toBe('');
    expect(mockBodyStyle.overflow).toBe('');
    // mockScrollTo TIDAK boleh dipanggil untuk restore 0
    expect(mockScrollTo).not.toHaveBeenCalled();

    unregister();
  });

  it('4. unregister dialog dengan restoreScroll: false tidak menimpa scroll viewport', () => {
    (globalThis as any).window.scrollY = 150;
    const unregister = dialogManager.register({
      id: 'lp-mobile-nav-menu',
      onClose: vi.fn(),
      restoreScroll: false,
    });

    unregister();

    expect(mockBodyStyle.position).toBe('');
    expect(mockScrollTo).not.toHaveBeenCalled();
  });

  it('5. Navigasi ulang saat hash sudah sama menggunakan replaceState agar history tetap rapi', () => {
    (globalThis as any).window.location.hash = '#direktori-layanan';
    mockElements['direktori-layanan'] = {
      getBoundingClientRect: () => ({
        top: 200,
        height: 400,
      }),
    };

    smoothScrollTo('direktori-layanan', 50);

    expect(mockScrollTo).toHaveBeenCalledWith({
      top: 150,
      behavior: 'smooth',
    });
    expect(mockReplaceState).toHaveBeenCalledWith(null, '', '/preview/living-portal#direktori-layanan');
    expect(mockPushState).not.toHaveBeenCalled();
  });
});
