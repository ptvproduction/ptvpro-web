/**
 * Application Configuration & Environment
 */

export const APP_CONFIG = {
  env: import.meta.env.VITE_APP_ENV || 'local',
  title: import.meta.env.VITE_APP_TITLE || 'PTV PRO Super App',
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key',
  },
} as const;
