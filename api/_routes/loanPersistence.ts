import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionPayload } from './auth/_utils/types';

const operations: Record<string, { rpc: string; fields: string[] }> = {
  rpc_checkout_loan: { rpc: 'rpc_checkout_loan_server', fields: ['p_transaction_id', 'p_borrower_name', 'p_purpose', 'p_out_date', 'p_due_date', 'p_event_name', 'p_unit_ids'] },
  rpc_return_loan: { rpc: 'rpc_return_loan_server', fields: ['p_transaction_id', 'p_back_date', 'p_condition_status', 'p_notes'] },
  rpc_return_single_unit: { rpc: 'rpc_return_single_unit_server', fields: ['p_loan_row_id', 'p_unit_id', 'p_condition_status', 'p_notes'] },
};

export async function loanCanRead(client: SupabaseClient, session: SessionPayload) {
  const { data, error } = await client.rpc('rpc_loans_can_read_server', { p_account_id: session.account_id, p_session_iat: session.iat });
  if (error || data !== true) throw new Error('Izin baca peminjaman tidak dapat diverifikasi.');
}

export async function handleLoanWrite(req: IncomingMessage, res: ServerResponse, client: SupabaseClient, session: SessionPayload) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!req.headers.origin || new URL(req.headers.origin).host !== req.headers.host || req.headers['sec-fetch-site'] === 'cross-site') {
      res.statusCode = 403; res.end(JSON.stringify({ error: 'Asal permintaan peminjaman tidak diizinkan.' })); return;
    }
    if (!req.headers['content-type']?.includes('application/json')) throw new Error('Permintaan harus berupa JSON.');
    let body = (req as IncomingMessage & { body?: unknown }).body;
    if (body === undefined) {
      const chunks: Buffer[] = []; let length = 0;
      for await (const chunk of req) {
        length += Buffer.byteLength(chunk);
        if (length > 65536) throw new Error('Permintaan peminjaman terlalu besar.');
        chunks.push(Buffer.from(chunk));
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Permintaan tidak valid.');
    if (Buffer.byteLength(JSON.stringify(body)) > 65536) throw new Error('Permintaan peminjaman terlalu besar.');
    const { operation, args } = body as Record<string, unknown>;
    const config = typeof operation === 'string' && Object.hasOwn(operations, operation) ? operations[operation] : null;
    if (!config || !args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Operasi peminjaman tidak valid.');
    const capability = operation === 'rpc_checkout_loan' ? 'loans.checkout' : 'loans.return';
    if (!session.capabilities?.includes(capability)) {
      res.statusCode = 403; res.end(JSON.stringify({ error: 'Capability operasi peminjaman tidak mencukupi.' })); return;
    }
    const payload: Record<string, unknown> = {};
    for (const field of config.fields) payload[field] = (args as Record<string, unknown>)[field] ?? null;
    const { data, error } = await client.rpc(config.rpc, { ...payload, p_account_id: session.account_id, p_session_iat: session.iat });
    if (error) {
      res.statusCode = error.code === '42501' ? 403 : error.code === '23505' ? 409 : 400;
      res.end(JSON.stringify({ error: `Penyimpanan belum dikonfirmasi: ${error.message}` })); return;
    }
    if (data?.success !== true) throw new Error('Backend belum mengonfirmasi penyimpanan.');
    res.statusCode = 200; res.end(JSON.stringify(data));
  } catch (error) {
    res.statusCode = 400; res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Penyimpanan belum dikonfirmasi.' }));
  }
}

