import { ptvCache } from '@core/cache/ptvCache';
import { getSupabaseClient, isSupabaseConfigured } from '@core/supabase/client';
import { usesInventoryPortal } from './inventaris/services/inventoryPortalClient';
import { safeRandomUuid } from '@/shared/utils/uuid';

const pendingCreates = new Map<string, string>();

export async function writeReport(module: 'lostfound' | 'damage', action: 'create' | 'update' | 'delete', payload: object, id?: string): Promise<string> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const cookieBackend = usesInventoryPortal() || import.meta.env.VITE_AUTH_BACKEND === 'vercel';
  if ((!isSupabaseConfigured() && !cookieBackend) || !url || new URL(url).hostname !== 'swadgljnyelsjstqqxbm.supabase.co') {
    throw new Error('Penyimpanan laporan hanya diizinkan pada Supabase Staging.');
  }
  const key = `${module}:${JSON.stringify(payload)}`;
  const reportId = id || pendingCreates.get(key) || safeRandomUuid();
  if (action === 'create') pendingCreates.set(key, reportId);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = cookieBackend
      ? (async () => {
          const response = await fetch(module === 'lostfound' ? '/api/lost-found' : '/api/lapor-kerusakan', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
            body: JSON.stringify({ action, id: reportId, payload }), signal: controller.signal,
          });
          const data = await response.json();
          return response.ok ? { data, error: null } : { data: null, error: { message: data.error || `HTTP ${response.status}` } };
        })()
      : getSupabaseClient().rpc('rpc_write_report', { p_module: module, p_action: action, p_id: reportId, p_payload: payload }).abortSignal(controller.signal);
    const result = await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Konfirmasi simpan belum diterima. Muat ulang daftar sebelum mencoba lagi; input tetap dipertahankan.'));
        }, 15000);
      }),
    ]);
    if (result.error) throw new Error(`Laporan belum tersimpan: ${result.error.message}`);
    if (result.data?.success !== true || result.data.id !== reportId) throw new Error('Backend belum mengonfirmasi laporan. Periksa daftar sebelum mencoba lagi.');
    ptvCache.invalidate(module === 'damage' ? 'damage_reports_list' : 'lostfound_items_list');
    if (module === 'damage') ptvCache.invalidate('inventaris_catalog_list');
    pendingCreates.delete(key);
    return reportId;
  } finally { clearTimeout(timer); }
}
