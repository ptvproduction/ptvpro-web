export function usesInventoryPortal(env = import.meta.env): boolean {
  // Production dan Staging wajib menggunakan Serverless API Gateway /api/inventaris
  // Mengabaikan mock dan mencegah browser direct anonymous REST ke Supabase table ptv_inventaris
  if (env.VITE_INVENTARIS_BACKEND === 'mock') return false;
  if (env.MODE === 'test' && env.VITE_INVENTARIS_BACKEND === 'local') return false;
  
  const isProdOrStaging = Boolean(
    env.PROD ||
    env.MODE === 'production' ||
    env.MODE === 'staging' ||
    env.VITE_APP_ENV === 'production' ||
    env.VITE_APP_ENV === 'staging' ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
  );

  if (!isProdOrStaging) {
    // Development lokal tanpa staging
    return env.VITE_INVENTARIS_BACKEND === 'vercel' || env.VITE_INVENTARIS_BACKEND === 'supabase';
  }

  // Jika URL Supabase dikonfigurasi, validasi target staging swadgljnyelsjstqqxbm
  if (env.VITE_SUPABASE_URL && !env.VITE_SUPABASE_URL.includes('localhost')) {
    try {
      const url = new URL(env.VITE_SUPABASE_URL);
      if (url.origin !== 'https://swadgljnyelsjstqqxbm.supabase.co') {
        throw new Error('Konfigurasi Inventaris tidak cocok dengan project yang diizinkan.');
      }
    } catch (e: any) {
      if (e.message?.includes('tidak cocok')) throw e;
    }
  }

  return true;
}

export async function inventoryPortalRequest(action: string, payload: object = {}, read = false) {
  const query = read ? `?action=${encodeURIComponent(action)}&payload=${encodeURIComponent(JSON.stringify(payload))}` : '';
  try {
    const response = await fetch(`/api/inventaris${query}`, {
      method: read ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      ...(!read ? { body: JSON.stringify({ action, payload }) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    const body = await response.json();
    if (!response.ok || body.success !== true) return { data: null, error: { code: body.code || String(response.status), message: body.error || 'Inventaris belum dikonfirmasi server.' } };
    return { data: body.data, error: null };
  } catch {
    return { data: null, error: { code: '504', message: 'Network timeout: konfirmasi Inventaris belum diterima.' } };
  }
}
