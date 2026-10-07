// ============================================================
// js/supabase.js — Singleton Supabase Client
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PTV_CONFIG } from './config.js';

let _client = null;

export function getSupabase() {
  if (!_client) {
    _client = createClient(PTV_CONFIG.supabase.url, PTV_CONFIG.supabase.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    });
  }
  return _client;
}
