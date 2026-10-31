export function financeBackendUrl(): string {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  if (process.env.PTV_FINANCE_LOCAL_E2E === 'true') {
    if (process.env.NODE_ENV !== 'test' || process.env.VERCEL || process.env.VERCEL_ENV
      || url !== 'http://127.0.0.1:55441') throw new Error('Isolated Finance harness unavailable');
    return url;
  }
  if (!/^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/.test(url)) throw new Error('Staging backend unavailable');
  return url;
}
