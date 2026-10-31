/**
 * Client Session & Auth State Management (Zustand)
 * Encapsulates client-side auth state, session lifecycle, and policy capabilities.
 */

import { create } from 'zustand';
import { AuthResult, AuthSession, AuthUser, LoginCredentials, OAuthSignInOptions, getAuthService, normalizeAuthUser } from '../auth';
import { AppCapability, hasCapability } from '../policy';
import { ptvCache } from '../cache/ptvCache';

export interface SessionState {
  session: AuthSession | null;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  initSession: () => () => void;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  loginWithOAuth: (options: OAuthSignInOptions) => Promise<AuthResult>;
  logout: () => Promise<void>;
  can: (capability: AppCapability) => boolean;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,
  error: null,

  initSession: () => {
    const authService = getAuthService();
    set({ isLoading: true });

    const unsubscribe = authService.onAuthStateChange((session) => {
      const normalizedUser = session?.user ? normalizeAuthUser(session.user) : null;
      ptvCache.setActiveUser(normalizedUser?.id || normalizedUser?.ptv_id || null);
      set({
        session: session ? { ...session, user: normalizedUser ?? session.user } : null,
        user: normalizedUser,
        isLoading: false,
        error: null,
      });
    });

    return unsubscribe;
  },

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });
    try {
      const authService = getAuthService();
      const result = await authService.login(credentials);

      if (result.success && result.session) {
        const normalizedUser = normalizeAuthUser(result.session.user);
        set({
          session: { ...result.session, user: normalizedUser ?? result.session.user },
          user: normalizedUser,
          isLoading: false,
          error: null,
        });
        return true;
      } else {
        set({
          isLoading: false,
          error: result.error || 'Autentikasi gagal.',
        });
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      set({ isLoading: false, error: msg });
      return false;
    }
  },

  loginWithOAuth: async (options: OAuthSignInOptions) => {
    set({ isLoading: true, error: null });
    try {
      const authService = getAuthService();
      if (!authService.loginWithOAuth) {
        const err = 'OAuth tidak didukung oleh auth service aktif.';
        set({ isLoading: false, error: err });
        return { success: false, error: err };
      }
      const result = await authService.loginWithOAuth(options);
      if (!result.success) {
        set({ isLoading: false, error: result.error || 'Gagal memulai login dengan Google.' });
      }
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat memulai Google OAuth.';
      set({ isLoading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      const authService = getAuthService();
      await authService.logout();
    } catch {
      set({ isLoading: false, error: 'Logout belum berhasil. Coba lagi.' });
      return;
    }
    set({
      session: null,
      user: null,
      isLoading: false,
      error: null,
    });
    ptvCache.clearActiveUserCache();
  },

  can: (capability: AppCapability) => {
    const { user } = get();
    return hasCapability(user, capability);
  },
}));

if (typeof window !== 'undefined') {
  (window as any).__sessionStore = useSessionStore;
}
