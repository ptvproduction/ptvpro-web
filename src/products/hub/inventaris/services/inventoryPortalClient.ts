export function usesInventoryPortal(env = import.meta.env): boolean {
  const staging = env.MODE === 'staging' || env.VITE_APP_ENV === 'staging';
  if (!staging) return false;
  let valid = false;
  try {
    const url = new URL(env.VITE_SUPABASE_URL);
    valid = url.origin === 'https://swadgljnyelsjstqqxbm.supabase.co';
  } catch { /* Reject an incomplete Staging configuration before selecting an adapter. */ }
  if (!valid) throw new Error('Konfigurasi Inventaris Staging tidak cocok dengan project yang diizinkan.');
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
