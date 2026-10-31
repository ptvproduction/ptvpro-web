import { z } from 'zod';

// Contract only: no transport, ledger calculation, or write activation.
const id = z.string().uuid();
const amountMinor = z.string().regex(/^[1-9][0-9]{0,17}$/, 'Nominal wajib bilangan positif dalam satuan minor IDR.');
const date = z.string().date();
const common = { version: z.literal(1), idempotencyKey: id, occurredOn: date, description: z.string().trim().min(1).max(1000), currency: z.literal('IDR') };
const source = { pocketId: id, amountMinor, categoryId: id };
export const financeCommandSchema = z.discriminatedUnion('operation', [
  z.object({ ...common, operation: z.literal('income'), ...source }).strict(),
  z.object({ ...common, operation: z.literal('expense'), ...source }).strict(),
  z.object({ ...common, operation: z.literal('transfer'), fromPocketId: id, toPocketId: id, amountMinor }).strict(),
  z.object({ ...common, operation: z.literal('reimburse_recognize'), claimantIdentityId: id, amountMinor, categoryId: id, evidenceId: id }).strict(),
  z.object({ ...common, operation: z.literal('reimburse_pay'), obligationId: id, pocketId: id, amountMinor, expectedVersion: z.number().int().nonnegative().safe() }).strict(),
  z.object({ ...common, operation: z.literal('installment_collect'), receivableId: id, pocketId: id, amountMinor, expectedVersion: z.number().int().nonnegative().safe() }).strict(),
  z.object({ ...common, operation: z.literal('crew_dues_assess'), identityId: id, period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), amountMinor }).strict(),
  z.object({ ...common, operation: z.literal('crew_dues_collect'), assessmentId: id, pocketId: id, amountMinor, expectedVersion: z.number().int().nonnegative().safe() }).strict(),
]).superRefine((command, context) => {
  if (command.operation === 'transfer' && command.fromPocketId === command.toPocketId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Kantong asal dan tujuan harus berbeda.', path: ['toPocketId'] });
  }
});
export type FinanceCommand = z.infer<typeof financeCommandSchema>;
