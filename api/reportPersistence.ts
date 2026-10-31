import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionPayload } from './auth/_utils/types';

export async function reportCanRead(client: SupabaseClient, session: SessionPayload, module: 'lostfound' | 'damage') {
  const { data, error } = await client.rpc('rpc_report_can_read', {
    p_account_id: session.account_id, p_session_iat: session.iat, p_module: module,
  });
  if (error) throw new Error('Izin baca laporan tidak dapat diverifikasi.');
  return data === true;
}

export async function handleReportWrite(req: IncomingMessage, res: ServerResponse, client: SupabaseClient, session: SessionPayload, module: 'lostfound' | 'damage') {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const origin = req.headers.origin;
    if (origin && req.headers['sec-fetch-site'] === 'cross-site') {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: 'Asal permintaan laporan tidak diizinkan.' }));
      return;
    }
    if (!req.headers['content-type']?.includes('application/json')) throw new Error('Format permintaan harus JSON.');
    let body = (req as IncomingMessage & { body?: unknown }).body;
    if (body === undefined) {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > 3100000) throw new Error('Ukuran laporan melebihi batas.');
        chunks.push(Buffer.from(chunk));
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
    if (!body || typeof body !== 'object') throw new Error('Permintaan laporan tidak valid.');
    if (Buffer.byteLength(JSON.stringify(body)) > 3100000) throw new Error('Ukuran laporan melebihi batas.');
    const { action, id, payload } = body as Record<string, unknown>;
    if (!['create', 'update', 'delete'].includes(String(action)) || typeof id !== 'string' ||
      !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id) || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Operasi atau ID laporan tidak valid.');
    }
    const capability = module === 'damage' ? (action === 'create' ? 'damage.report' : 'damage.qc.approve')
      : (action === 'create' ? 'lostfound.report' : 'lostfound.manage');
    if (!session.capabilities?.includes(capability)) {
      res.statusCode = 403; res.end(JSON.stringify({ error: 'Capability operasi laporan tidak mencukupi.' })); return;
    }
    const { data, error } = await client.rpc('rpc_write_report_server', {
      p_account_id: session.account_id, p_session_iat: session.iat, p_module: module,
      p_action: action, p_id: id, p_payload: payload,
    });
    if (error) {
      res.statusCode = error.code === '42501' ? 403 : error.code === '23505' ? 409 : 400;
      res.end(JSON.stringify({ error: `Laporan belum tersimpan: ${error.message}` }));
      return;
    }
    if (data?.success !== true || data.id !== id) throw new Error('Konfirmasi backend tidak valid.');
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (error) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Laporan belum tersimpan.' }));
  }
}
