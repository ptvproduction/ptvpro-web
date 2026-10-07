// ============================================================
// js/config.js — Konfigurasi Supabase & Konstan Global PTV
// ============================================================
// PENTING: File ini hanya berisi anonKey (kunci publik baca).
// Service Role Key TIDAK BOLEH ADA di sini (hanya di backend/Edge Function).
// ============================================================

export const PTV_CONFIG = {
  supabase: {
    url: 'https://jthzuhkblxcaohiuypqq.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0aHp1aGtibHhjYW9oaXV5cHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1ODgwNDAsImV4cCI6MjEwMzE2NDA0MH0.OA65M6PKfrAm0Tr4nkrel_GRxPzG7zVGeIKPn1D055M',
  },
  app: {
    name: 'PTV Pro',
    version: '1.0.0',
    pushVapidPublicKey: 'BOmb91qJSFGOhajDugnCC_BaMc2qieI-GsK_kVIbCOh_1P5O4Ntlmhxdx6EwaVC1SL6ZihDDvt4d2g1nL-r5UYo',
  },
  realtime: {
    channelName: 'ptv_dashboard_realtime_sync',
  },
};
