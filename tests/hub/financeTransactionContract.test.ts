import { describe, expect, it } from 'vitest';
import { financeCommandSchema } from '../../src/products/hub/keuangan/financeTransactionContract';
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const common = { version: 1, idempotencyKey: a, occurredOn: '2026-10-21', description: 'UJI LOKAL KONTRAK', currency: 'IDR' };
const income = { ...common, operation: 'income', pocketId: a, categoryId: b, amountMinor: '100' };
describe('Kontrak Finance persiapan, tanpa jalur tulis', () => {
  it('menerima nominal minor string tanpa konversi float', () => expect(financeCommandSchema.parse(income)).toMatchObject({ amountMinor: '100' }));
  it.each(['0', '-1', '1.5', '01', '1e4', '1000000000000000000'])('menolak nominal %s', amountMinor => expect(financeCommandSchema.safeParse({ ...income, amountMinor }).success).toBe(false));
  it('menolak nominal number yang berpotensi kehilangan presisi', () => expect(financeCommandSchema.safeParse({ ...income, amountMinor: 100 }).success).toBe(false));
  it.each(['actorId', 'accountId', 'capabilities', 'committed'])('identitas/konfirmasi %s tidak dapat disisipkan browser', field => expect(financeCommandSchema.safeParse({ ...income, [field]: a }).success).toBe(false));
  it('menolak transfer ke Kantong sama', () => expect(financeCommandSchema.safeParse({ ...common, operation: 'transfer', fromPocketId: a, toPocketId: a, amountMinor: '100' }).success).toBe(false));
  it('menerima transfer berbeda tanpa kategori pendapatan/beban', () => expect(financeCommandSchema.safeParse({ ...common, operation: 'transfer', fromPocketId: a, toPocketId: b, amountMinor: '100' }).success).toBe(true));
  it.each(['2026-02-30', '2026-13-01'])('menolak tanggal invalid %s', occurredOn => expect(financeCommandSchema.safeParse({ ...income, occurredOn }).success).toBe(false));
  it('pembayaran reimburse memerlukan versi kewajiban', () => expect(financeCommandSchema.safeParse({ ...common, operation: 'reimburse_pay', obligationId: a, pocketId: b, amountMinor: '100' }).success).toBe(false));
  it.each(['reimburse_pay', 'installment_collect', 'crew_dues_collect'])('menerima kontrak alokasi %s', operation => {
    const relation = operation === 'reimburse_pay' ? 'obligationId' : operation === 'installment_collect' ? 'receivableId' : 'assessmentId';
    expect(financeCommandSchema.safeParse({ ...common, operation, [relation]: a, pocketId: b, amountMinor: '100', expectedVersion: 0 }).success).toBe(true);
  });
  it('menolak periode kas invalid', () => expect(financeCommandSchema.safeParse({ ...common, operation: 'crew_dues_assess', identityId: a, period: '2026-13', amountMinor: '100' }).success).toBe(false));
});
