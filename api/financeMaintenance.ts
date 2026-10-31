import fs from 'fs';
import { financeBackendUrl } from './auth/_utils/financeLocalHarness';

export const financeMaintenanceResponse = {
  code: 'FINANCE_MAINTENANCE',
  error: 'Keuangan sedang dalam pemeliharaan. Penyimpanan sementara dihentikan. Coba lagi nanti.',
};

export function financeMaintenanceActive(): boolean {
  let flag = process.env.PTV_FINANCE_MAINTENANCE;
  try {
    if (!process.env.VITEST && fs.existsSync('.env.staging.local')) {
      const content = fs.readFileSync('.env.staging.local', 'utf8');
      const match = content.match(/PTV_FINANCE_MAINTENANCE\s*=\s*(false|true)/i);
      if (match) flag = match[1].toLowerCase();
    }
  } catch {
    // fallback to process.env
  }
  if (!flag || flag === 'false') return false;
  if (process.env.VERCEL_ENV === 'production' || process.env.VITE_APP_ENV === 'production') return false;
  const staging = process.env.VITE_APP_ENV === 'staging' || process.env.VERCEL_ENV === 'preview';
  const harness = process.env.PTV_FINANCE_LOCAL_E2E === 'true' && process.env.NODE_ENV === 'test';
  if (!staging && !harness) return false;
  try {
    financeBackendUrl();
    return true;
  } catch {
    return false;
  }
}
