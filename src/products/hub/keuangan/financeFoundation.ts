import type { CanonicalFinanceData } from './financeCanonical';

export const FINANCE_SECTIONS = [
  ['ringkasan', 'Ringkasan'], ['transaksi', 'Transaksi'], ['kantong', 'Kantong'],
  ['kas-kru', 'Kas Kru'], ['piutang', 'Piutang'], ['laporan', 'Laporan'], ['pengaturan', 'Pengaturan Keuangan'],
] as const;
export type FinanceSection = typeof FINANCE_SECTIONS[number][0];
export function financeSection(value: string | null): FinanceSection {
  if (value === 'kas_kru') return 'kas-kru';
  if (value === 'pemasukan' || value === 'pengeluaran') return 'transaksi';
  return FINANCE_SECTIONS.find(([id]) => id === value)?.[0] ?? 'ringkasan';
}
export const FINANCE_SETTINGS: Record<FinanceSection, string> = {
  ringkasan: 'umum', transaksi: 'transaksi', kantong: 'kantong', 'kas-kru': 'kas-kru',
  piutang: 'piutang', laporan: 'laporan', pengaturan: 'umum',
};
export interface FinanceEntry { id: string; label: string; date: string; amount: number; kind: 'pemasukan' | 'pengeluaran'; description?: string }
export interface FinanceKas { id: string; period: string; amount: number; status: string }
export interface FinanceSnapshot {
  source: 'staging'; canManage: boolean; scope: 'global' | 'own';
  counts: { income: number; expense: number; ledger: number } | null;
  entries: FinanceEntry[]; kas: FinanceKas[]; limited: boolean;
  writesEnabled: boolean;
  canonical: CanonicalFinanceData;
}
export async function loadFinance(signal?: AbortSignal): Promise<FinanceSnapshot> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch('/api/finance', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        let body: any;
        const rawText = await response.text();
        try {
          body = JSON.parse(rawText);
        } catch {
          if (response.status === 504) {
            throw new Error('Gateway Timeout (504): Sambungan ke server keuangan melampaui batas waktu. Silakan muat ulang.');
          }
          throw new Error(`Gagal memuat keuangan (HTTP ${response.status}).`);
        }
        if (!response.ok) throw new Error(body.error || 'Gagal memuat keuangan.');
        if (body.source !== 'staging' || !Array.isArray(body.entries) || !Array.isArray(body.kas)
          || typeof body.canManage !== 'boolean' || !['global', 'own'].includes(body.scope) || typeof body.writesEnabled !== 'boolean'
          || !body.canonical || !['awaiting_schema', 'available'].includes(body.canonical.state)) {
          throw new Error('Respons keuangan tidak valid.');
        }
        if (body.canonical.state === 'awaiting_schema') {
          if (body.canonical.pockets !== null || body.canonical.transactions !== null) {
            throw new Error('Respons keuangan tidak valid.');
          }
        } else if (body.canonical.state === 'available') {
          if (!Array.isArray(body.canonical.pockets) || !Array.isArray(body.canonical.transactions)) {
            throw new Error('Respons keuangan tidak valid.');
          }
        }
        return body as FinanceSnapshot;
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(new Error('Waktu memuat keuangan habis. Coba lagi.')); controller.abort(); }, 15000); }),
    ]);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
