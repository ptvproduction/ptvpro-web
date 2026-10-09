/**
 * Client Session & Auth State Management (Zustand)
 * Encapsulates client-side auth state, session lifecycle, and policy capabilities.
 */

import { create } from 'zustand';
import { AuthSession, AuthUser, LoginCredentials, getAuthService } from '../auth';
import { AppCapability, hasCapability } from '../policy';

export interface SessionState {
  session: AuthSession | null;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  initSession: () => () => void;
  login: (credentials: LoginCredentials) => Promise<boolean>;
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
      set({
        session,
        user: session?.user ?? null,
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
        set({
          session: result.session,
          user: result.session.user,
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

  logout: async () => {
    set({ isLoading: true });
    try {
      const authService = getAuthService();
      await authService.logout();
    } finally {
      set({
        session: null,
        user: null,
        isLoading: false,
        error: null,
      });
    }
  },

  can: (capability: AppCapability) => {
    const { user } = get();
    return hasCapability(user, capability);
  },
}));
