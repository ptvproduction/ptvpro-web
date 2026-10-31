import { assertPocketArchivable, assertPocketBalances, multiPocketCommandSchema, pocketFormSchema, type FinancePocket, type PocketForm, type MultiPocketCommand } from './financeCanonical';

export function preparePocketChange(input: unknown, existing?: FinancePocket) {
  if (existing?.archived) throw new Error('Kantong yang sudah diarsipkan tidak dapat diedit.');
  return { fields: pocketFormSchema.parse(input), expectedVersion: existing?.version ?? null, requiresAudit: true as const };
}

export function preparePocketArchive(existing: FinancePocket) {
  assertPocketArchivable(existing);
  return { pocketId: existing.id, expectedVersion: existing.version, requiresAudit: true as const };
}

export async function prepareFinanceOperation(input: unknown, pockets: readonly FinancePocket[]) {
  const command = multiPocketCommandSchema.parse(input);
  assertPocketBalances(command, pockets);
  const payload: MultiPocketCommand = { ...command,
    incoming: [...command.incoming].sort((a, b) => a.pocketId.localeCompare(b.pocketId)),
    outgoing: [...command.outgoing].sort((a, b) => a.pocketId.localeCompare(b.pocketId)),
  };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
  return {
    command: payload,
    payloadHash: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''),
    expectedVersions: Object.fromEntries(pockets.filter(p => [...payload.incoming, ...payload.outgoing].some(line => line.pocketId === p.id)).map(p => [p.id, p.version])),
    requiresAtomicCommit: true as const,
    requiresAudit: true as const
  };
}

async function apiPost(body: Record<string, unknown>) {
  const res = await fetch('/api/finance', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data || typeof data !== 'object' || data.success === false) {
    throw new Error(data?.error || 'Backend belum mengonfirmasi operasi keuangan.');
  }
  return data;
}

export async function submitFinanceOperation(input: unknown, pockets: readonly FinancePocket[]) {
  const prepared = await prepareFinanceOperation(input, pockets);
  return apiPost({
    action: 'post_transaction',
    command: prepared.command,
  });
}

export async function submitPocketCreate(pocket: PocketForm) {
  preparePocketChange(pocket);
  return apiPost({
    action: 'create_pocket',
    pocket,
  });
}

export async function submitPocketUpdate(pocketId: string, pocket: PocketForm, existing: FinancePocket) {
  preparePocketChange(pocket, existing);
  return apiPost({
    action: 'update_pocket',
    pocketId,
    pocket,
    expectedVersion: existing.version,
  });
}

export async function submitPocketArchive(existing: FinancePocket) {
  preparePocketArchive(existing);
  return apiPost({
    action: 'archive_pocket',
    pocketId: existing.id,
    expectedVersion: existing.version,
  });
}

export async function submitCategoryCreate(name: string, kind: 'income' | 'expense') {
  return apiPost({
    action: 'create_category',
    name,
    kind,
  });
}

export async function submitTransactionUpdate(
  txId: string,
  updates: {
    description?: string;
    occurredOn?: string;
    categoryId?: string;
    notes?: string;
    proofUrl?: string;
  }
) {
  return apiPost({
    action: 'update_transaction',
    txId,
    updates,
  });
}

export async function submitTransactionVoid(txId: string, reason: string) {
  return apiPost({
    action: 'void_transaction',
    txId,
    reason,
  });
}
