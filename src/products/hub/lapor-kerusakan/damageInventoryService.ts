import { SupabaseInventarisService } from '../inventaris/inventarisService';
import { isSupabaseConfigured } from '@core/supabase';

export async function loadDamageInventory() {
  let staging = false;
  try {
    staging = new URL(import.meta.env.VITE_SUPABASE_URL || '').hostname === 'swadgljnyelsjstqqxbm.supabase.co';
  } catch { /* Konfigurasi tidak lengkap ditampilkan sebagai error, bukan data dummy. */ }
  if (!staging || !isSupabaseConfigured()) {
    throw new Error('Sumber inventaris Supabase Staging belum terkonfigurasi. Tidak ada data simulasi yang digunakan.');
  }
  return SupabaseInventarisService.getInstance().getInventarisList();
}
