/**
 * Destination & Redirect Sanitization Utilities
 * Enforces clean URL policies, prevents open-redirect vulnerabilities,
 * and eliminates redirect loops during authentication & OAuth callbacks.
 */

export const SESSION_INTENDED_DESTINATION_KEY = 'ptv_intended_destination';

let memoryDestination: string | null = null;

/**
 * Validasi dan sanitasi intended destination URL.
 * Memastikan URL adalah rute internal terproteksi yang sah:
 * 1. Menolak open redirect ke domain luar (harus diawali '/' tunggal, bukan '//' atau '/\\').
 * 2. Menolak redirect loop ke /hub/login, /login, atau /hub/auth/callback.
 * 3. Mengizinkan rute terproteksi (/hub/* dan rute development /dev-*).
 * 4. Fallback ke '/hub' jika tidak valid, kosong, atau mencurigakan.
 */
export function getSafeInternalDestination(target?: string | null): string {
  if (!target || typeof target !== 'string') {
    return '/hub';
  }

  const trimmed = target.trim();

  // 1. Tolak protocol-relative atau Windows-style UNC paths (// atau /\\)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return '/hub';
  }

  // 2. Ekstrak pathname tanpa query untuk evaluasi loop
  const pathname = trimmed.split('?')[0].split('#')[0];

  // 3. Tolak rute autentikasi untuk mencegah infinite redirect loop
  if (
    pathname === '/hub/login' ||
    pathname === '/login' ||
    pathname === '/hub/auth/callback' ||
    pathname === '/auth/callback'
  ) {
    return '/hub';
  }

  // 4. Pastikan hanya internal route /hub/* (atau /hub) dan rute development yang valid
  if (trimmed === '/hub' || trimmed.startsWith('/hub/') || trimmed.startsWith('/dev-')) {
    return trimmed;
  }

  return '/hub';
}

/**
 * Menyimpan intended destination ke session-scoped storage (survives OAuth redirect).
 */
export function storeIntendedDestination(target: string): void {
  const safe = getSafeInternalDestination(target);
  memoryDestination = safe;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(SESSION_INTENDED_DESTINATION_KEY, safe);
    } catch {
      // Abaikan jika storage disabled / private mode quota error
    }
  }
}

/**
 * Mengambil dan langsung membersihkan intended destination dari session-scoped storage.
 */
export function getAndClearIntendedDestination(): string {
  let stored = memoryDestination;
  memoryDestination = null;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const fromSession = window.sessionStorage.getItem(SESSION_INTENDED_DESTINATION_KEY);
      if (fromSession) {
        stored = fromSession;
      }
      window.sessionStorage.removeItem(SESSION_INTENDED_DESTINATION_KEY);
    } catch {
      // ignore
    }
  }
  return getSafeInternalDestination(stored);
}

/**
 * Membersihkan intended destination dari session storage.
 */
export function clearIntendedDestination(): void {
  memoryDestination = null;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(SESSION_INTENDED_DESTINATION_KEY);
    } catch {
      // ignore
    }
  }
}
