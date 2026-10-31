import { z } from 'zod';

const uuid = z.string().uuid();
const minor = z.string().regex(/^[1-9][0-9]{0,17}$/);
export const pocketFormSchema = z.object({
  name: z.string().trim().min(1, 'Nama Kantong wajib diisi.').max(80),
  kind: z.enum(['cash', 'bank', 'ewallet']),
  provider: z.string().trim().max(80), accountNumber: z.string().trim().max(64),
  accountHolder: z.string().trim().max(120),
}).strict().superRefine((pocket, ctx) => {
  if (pocket.kind !== 'cash') {
    for (const key of ['provider', 'accountNumber', 'accountHolder'] as const) {
      if (!pocket[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'Informasi rekening wajib diisi.' });
    }
  } else if (pocket.provider || pocket.accountNumber || pocket.accountHolder) {
    ctx.addIssue({ code: 'custom', path: ['kind'], message: 'Kantong tunai tidak memiliki rekening.' });
  }
});
export type PocketForm = z.infer<typeof pocketFormSchema>;
export interface FinancePocket extends PocketForm {
  id: string; archived: boolean; version: number; balanceMinor: string | null;
  qris: { assetPath: string; merchantName: string; nmid: string; verifiedAt: string } | null;
}
export interface CanonicalTransaction {
  id: string; occurredOn: string; description: string; kind: 'income' | 'expense' | 'transfer';
  amountMinor: string; status: 'posted' | 'reversed'; auditReference: string;
  allocations: { pocketId: string; amountMinor: string; direction: 'in' | 'out' }[];
  sourceReferences?: { kind: 'pemasukan' | 'pengeluaran'; id: string }[];
  categoryId?: string;
  proofUrl?: string;
  notes?: string;
  recordedBy?: string;
}
export interface CanonicalCategory {
  id: string; name: string; kind: 'income' | 'expense'; isActive: boolean;
}
export function cleanTransactionTitle(description: string): string {
  return description
    .replace(/^\s*(?:(?:\[(?:legacy|migrasi(?:\s+(?:dari\s+)?dasbor\s+ptv)?|dasbor\s+ptv)\]|(?:legacy|migrasi(?:\s+(?:dari\s+)?dasbor\s+ptv)?|dasbor\s+ptv)\s*[:|–—-])\s*)+/i, '')
    .replace(/(?:\s*\[(?:legacy|migrasi|dasbor\s+ptv)\])+\s*$/i, '')
    .trim() || 'Transaksi Keuangan';
}

export function isMigratedTransaction(transaction: CanonicalTransaction): boolean {
  return Boolean(transaction.sourceReferences?.length)
    || Boolean(transaction.description.trim() && cleanTransactionTitle(transaction.description) !== transaction.description.trim());
}

export type CanonicalFinanceData = { state: 'awaiting_schema'; pockets: null; transactions: null; categories?: null }
  | { state: 'available'; pockets: FinancePocket[]; transactions: CanonicalTransaction[]; categories?: CanonicalCategory[] };
const allocation = z.object({ pocketId: uuid, amountMinor: minor }).strict();
export const multiPocketCommandSchema = z.object({
  version: z.literal(2), idempotencyKey: uuid, operation: z.enum(['income', 'expense', 'transfer']),
  occurredOn: z.string().date(), description: z.string().trim().min(1).max(1000),
  currency: z.literal('IDR'), amountMinor: minor, categoryId: uuid.optional(),
  incoming: z.array(allocation).max(20), outgoing: z.array(allocation).max(20),
}).strict().superRefine((value, ctx) => {
  if (![value.amountMinor, ...value.incoming.map(line => line.amountMinor), ...value.outgoing.map(line => line.amountMinor)].every(amount => /^[1-9][0-9]{0,17}$/.test(amount))) return;
  const sum = (lines: typeof value.incoming) => lines.reduce((n, line) => n + BigInt(line.amountMinor), 0n);
  const total = BigInt(value.amountMinor);
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const ids = [...value.incoming, ...value.outgoing].map(line => line.pocketId);
  if (new Set(ids).size !== ids.length) issue('Kantong tidak boleh berulang atau menjadi asal sekaligus tujuan.');
  if (value.operation === 'income' && (sum(value.incoming) !== total || value.outgoing.length || !value.categoryId)) issue('Alokasi pemasukan harus sama dengan total dan memiliki kategori.');
  if (value.operation === 'expense' && (sum(value.outgoing) !== total || value.incoming.length || !value.categoryId)) issue('Alokasi pengeluaran harus sama dengan total dan memiliki kategori.');
  if (value.operation === 'transfer' && (sum(value.incoming) !== total || sum(value.outgoing) !== total || value.categoryId)) issue('Total asal dan tujuan transfer harus sama, tanpa kategori pemasukan/pengeluaran.');
});
export type MultiPocketCommand = z.infer<typeof multiPocketCommandSchema>;
export function assertPocketBalances(command: MultiPocketCommand, pockets: readonly FinancePocket[]) {
  const live = new Map(pockets.map(pocket => [pocket.id, pocket]));
  for (const line of [...command.incoming, ...command.outgoing]) {
    const pocket = live.get(line.pocketId);
    if (!pocket || pocket.archived) throw new Error('Kantong tidak tersedia atau sudah diarsipkan.');
    if (command.outgoing.some(out => out.pocketId === line.pocketId)
      && (pocket.balanceMinor === null || BigInt(pocket.balanceMinor) < BigInt(line.amountMinor))) throw new Error('Saldo belum terverifikasi atau tidak mencukupi. Saldo negatif tidak diizinkan.');
  }
}
export function rupiahToMinor(value: string): string {
  if (!/^(0|[1-9][0-9]{0,15})(,[0-9]{1,2})?$/.test(value.trim())) throw new Error('Gunakan nominal rupiah tanpa pemisah ribuan, maksimal dua desimal.');
  const [whole, fraction = ''] = value.trim().split(',');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (result <= 0n) throw new Error('Nominal harus lebih dari nol.');
  return result.toString();
}
export function formatMinor(value: string | null) {
  if (value === null) return 'Belum terverifikasi';
  if (!/^-?[0-9]+$/.test(value)) return 'Nominal tidak valid';
  const amount = BigInt(value); const abs = amount < 0n ? -amount : amount;
  return `${amount < 0n ? '−' : ''}Rp ${(abs / 100n).toLocaleString('id-ID')},${(abs % 100n).toString().padStart(2, '0')}`;
}
export function officialQrisPath(pocket: FinancePocket): string | null {
  const qris = pocket.qris;
  return qris && qris.merchantName.trim() && qris.nmid.trim() && Number.isFinite(Date.parse(qris.verifiedAt))
    && /^\/finance-assets\/[a-zA-Z0-9/_-]+\.(png|webp|jpg)$/.test(qris.assetPath) ? qris.assetPath : null;
}
export function assertPocketArchivable(pocket: FinancePocket) {
  if (pocket.archived || pocket.balanceMinor === null || !/^0+$/.test(pocket.balanceMinor)) {
    throw new Error('Arsip hanya untuk Kantong aktif dengan saldo nol terverifikasi.');
  }
}

export const TEST_POCKET_IDS = new Set([
  '94f454b2-af09-43b2-a172-ff2cbc263082', // [TEST][PTV-DEV-117] Kas Uji Alpha
  '4dd78d1f-6370-438a-9fd0-ea3f10473f66', // [TEST][PTV-DEV-117] Bank Uji Beta
]);

export const TEST_RUN_PREFIXES = ['PTV-DEV-117-TEST'] as const;

export function isTestTransaction(tx: CanonicalTransaction): boolean {
  if (TEST_RUN_PREFIXES.some(prefix => tx.auditReference?.startsWith(prefix))) {
    return true;
  }
  if (tx.description?.trim().startsWith('[TEST]')) {
    return true;
  }
  if (tx.allocations && tx.allocations.length > 0 && tx.allocations.every(a => TEST_POCKET_IDS.has(a.pocketId))) {
    return true;
  }
  return false;
}

