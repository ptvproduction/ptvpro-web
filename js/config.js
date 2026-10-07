// ============================================================
// js/config.js — Konfigurasi Supabase & Konstan Global PTV
// ============================================================
// PENTING: File ini hanya berisi anonKey (kunci publik baca).
// Service Role Key TIDAK BOLEH ADA di sini (hanya di backend/Edge Function).
// ============================================================

export const PTV_CONFIG = {
  supabase: {
    url: 'https://jthzuhkblxcaohiuypqq.supabase.co',
    anonKey: 'PASTE_ANON_KEY_SUPABASE_KAMU_DI_SINI',
  },
  app: {
    name: 'PTV Pro',
    version: '1.0.0',
    pushVapidPublicKey: 'PASTE_VAPID_PUBLIC_KEY_KAMU_DI_SINI',
  },
  realtime: {
    channelName: 'ptv_dashboard_realtime_sync',
  },
};
