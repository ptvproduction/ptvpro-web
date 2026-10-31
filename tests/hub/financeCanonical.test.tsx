import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PocketWorkspace, TransactionWorkspace } from '../../src/products/hub/keuangan/FinanceWorkspace';
import { assertPocketBalances, formatMinor, multiPocketCommandSchema, officialQrisPath, pocketFormSchema, rupiahToMinor, type FinancePocket } from '../../src/products/hub/keuangan/financeCanonical';
import { prepareFinanceOperation, preparePocketArchive, preparePocketChange, submitFinanceOperation } from '../../src/products/hub/keuangan/financeCanonicalService';
import type { FinanceSnapshot } from '../../src/products/hub/keuangan/financeFoundation';
const a = '11111111-1111-4111-8111-111111111111'; const b = '22222222-2222-4222-8222-222222222222'; const c = '33333333-3333-4333-8333-333333333333';
const pocket = (id = a, balanceMinor: string | null = '50000'): FinancePocket => ({ id, name: 'Kantong uji lokal', kind: 'cash', provider: '', accountHolder: '', accountNumber: '', balanceMinor, archived: false, version: 1, qris: null });
const command = { version: 2, idempotencyKey: c, operation: 'transfer', currency: 'IDR', occurredOn: '2026-10-21', description: 'UJI LOKAL', amountMinor: '30000', incoming: [{ pocketId: c, amountMinor: '30000' }], outgoing: [{ pocketId: a, amountMinor: '10000' }, { pocketId: b, amountMinor: '20000' }] };
const snapshot = (canManage = false): FinanceSnapshot => ({ source: 'staging', canManage, scope: 'global', counts: { income: 0, expense: 0, ledger: 0 }, entries: [], kas: [], limited: false, writesEnabled: false, canonical: { state: 'awaiting_schema', pockets: null, transactions: null } });
afterEach(() => vi.unstubAllGlobals());
describe('Canonical Kantong dan alokasi transaksi', () => {
  it('konversi minor tidak memakai float', () => { expect(rupiahToMinor('90071992547409,91')).toBe('9007199254740991'); expect(rupiahToMinor('1000,5')).toBe('100050'); });
  it.each(['0', '-1', '1.000', '1e3', '2,123'])('menolak input rupiah %s', value => expect(() => rupiahToMinor(value)).toThrow());
  it('saldo unknown bukan nol', () => { expect(formatMinor(null)).toBe('Belum terverifikasi'); expect(formatMinor('0')).toBe('Rp 0,00'); });
  it('arsip wajib saldo nol terverifikasi dan menyertakan versi', () => {
    expect(() => preparePocketArchive(pocket(a, null))).toThrow(); expect(() => preparePocketArchive(pocket(a, '1'))).toThrow();
    expect(preparePocketArchive(pocket(a, '0')).expectedVersion).toBe(1);
  });
  it('edit Kantong arsip ditolak, tanpa membuat saldo baru', () => {
    const fields = { name: 'Tunai uji', kind: 'cash', provider: '', accountNumber: '', accountHolder: '' };
    expect(() => preparePocketChange(fields, { ...pocket(), archived: true })).toThrow(); expect(preparePocketChange(fields).fields).not.toHaveProperty('balanceMinor');
  });
  it('form bank wajib rekening dan tidak dapat menyisipkan saldo', () => {
    expect(pocketFormSchema.safeParse({ name: 'Bank', kind: 'bank', provider: '', accountNumber: '', accountHolder: '' }).success).toBe(false);
    expect(pocketFormSchema.safeParse({ name: 'Tunai', kind: 'cash', provider: '', accountNumber: '', accountHolder: '', balanceMinor: '100' }).success).toBe(false);
  });
  it('transfer multi-Kantong seimbang diterima', () => expect(multiPocketCommandSchema.safeParse(command).success).toBe(true));
  it('transfer tidak menerima kategori pendapatan', () => expect(multiPocketCommandSchema.safeParse({ ...command, categoryId: a }).success).toBe(false));
  it('alokasi tidak seimbang ditolak', () => expect(multiPocketCommandSchema.safeParse({ ...command, amountMinor: '40000' }).success).toBe(false));
  it('Kantong asal/tujuan sama dan duplikat ditolak', () => expect(multiPocketCommandSchema.safeParse({ ...command, incoming: [{ pocketId: a, amountMinor: '30000' }] }).success).toBe(false));
  it('amount invalid menghasilkan validation error, bukan exception BigInt', () => expect(multiPocketCommandSchema.safeParse({ ...command, amountMinor: '1.5' }).success).toBe(false));
  it.each([null, '9999'])('pengeluaran dengan saldo %s ditolak', balance => expect(() => assertPocketBalances(multiPocketCommandSchema.parse(command), [pocket(a, balance), pocket(b), pocket(c)])).toThrow('Saldo'));
  it('Kantong arsip ditolak', () => expect(() => assertPocketBalances(multiPocketCommandSchema.parse(command), [{ ...pocket(), archived: true }, pocket(b), pocket(c)])).toThrow('diarsipkan'));
  it('payload hash/idempotency stabil walaupun urutan alokasi berubah', async () => {
    const pockets = [pocket(a), pocket(b), pocket(c)]; const first = await prepareFinanceOperation(command, pockets);
    const retry = await prepareFinanceOperation({ ...command, outgoing: [...command.outgoing].reverse() }, pockets);
    expect(retry.payloadHash).toBe(first.payloadHash); expect(retry.command.idempotencyKey).toBe(c); expect(first.requiresAtomicCommit && first.requiresAudit).toBe(true);
  });
  it('submitFinanceOperation mengirim POST ke /api/finance dengan command yang disiapkan', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, transaction_id: 'tx-123' }),
    });
    vi.stubGlobal('fetch', fetch);
    const pockets = [pocket(a), pocket(b), pocket(c)];
    const res = await submitFinanceOperation(command, pockets);
    expect(res).toEqual({ success: true, transaction_id: 'tx-123' });
    expect(fetch).toHaveBeenCalledWith('/api/finance', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
    }));
  });
  it('QRIS hanya menggunakan aset lokal resmi yang diberi metadata server', () => {
    const p = { ...pocket(), qris: { assetPath: '/finance-assets/merchant.png', merchantName: 'Merchant uji', nmid: 'NMID-UJI', verifiedAt: '2026-10-21T00:00:00Z' } };
    expect(officialQrisPath(p)).toBe('/finance-assets/merchant.png'); expect(officialQrisPath({ ...p, qris: { ...p.qris, assetPath: 'https://untrusted.example/qr.png' } })).toBeNull(); expect(officialQrisPath(pocket())).toBeNull();
  });
  it('kru tidak mendapat aksi pengelolaan; Kantong belum tersedia bukan saldo dummy', () => {
    const html = renderToStaticMarkup(<PocketWorkspace data={snapshot()} />); expect(html).not.toContain('Tambah Kantong'); expect(html).not.toContain('Rp 0'); expect(html).toContain('belum terhubung');
  });
  it('pengelola dapat membuka formulir persiapan', () => expect(renderToStaticMarkup(<PocketWorkspace data={snapshot(true)} />)).toContain('Tambah Kantong'));
  it('daftar sumber kosong tidak membuat transaksi dummy', () => { const html = renderToStaticMarkup(<TransactionWorkspace data={snapshot()} />); expect(html).toContain('Tidak ada transaksi'); expect(html).not.toContain('Pindah Kantong</button>'); });
  it('scope own tidak mengekspos transaksi global walaupun payload berisi rows', () => {
    const data = snapshot(); data.scope = 'own'; data.entries = [{ id: 'row', kind: 'pemasukan', label: 'RAHASIA UJI', date: '2026-10-21', amount: 123 }];
    expect(renderToStaticMarkup(<TransactionWorkspace data={data} />)).not.toContain('RAHASIA UJI');
  });
  it('sumber yang sudah dipetakan tidak ditampilkan lagi sebagai transaksi kedua', () => {
    const data = snapshot(); data.entries = [{ id: a, kind: 'pemasukan', label: 'LEGACY-TERTAUT-UJI', amount: 300, date: '2026-10-21' }];
    data.canonical = { state: 'available', pockets: [pocket()], transactions: [{ id: b, kind: 'income', occurredOn: '2026-10-21', description: 'CANONICAL-UJI', amountMinor: '30000', status: 'posted', auditReference: 'AUDIT-UJI', allocations: [{ pocketId: a, amountMinor: '30000', direction: 'in' }], sourceReferences: [{ id: a, kind: 'pemasukan' }] }] };
    const html = renderToStaticMarkup(<TransactionWorkspace data={data} />); expect(html).toContain('CANONICAL-UJI'); expect(html).not.toContain('LEGACY-TERTAUT-UJI');
  });
  it.each(['income', 'expense'])('alokasi multi-Kantong %s tidak boleh melebihi total', operation => {
    expect(multiPocketCommandSchema.safeParse({ ...command, operation, categoryId: c, incoming: operation === 'income' ? command.outgoing : [], outgoing: operation === 'expense' ? command.outgoing : [] }).success).toBe(true);
    expect(multiPocketCommandSchema.safeParse({ ...command, operation, categoryId: c, amountMinor: '10000', incoming: operation === 'income' ? command.outgoing : [], outgoing: operation === 'expense' ? command.outgoing : [] }).success).toBe(false);
  });
});
