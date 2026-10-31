import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { filterUserDocuments } from '../../src/products/hub/dokumen-saya/utils/documentOwnership';
import type { PtvDocument } from '../../src/products/hub/dokumen-saya/mock/docsMockData';

const db = vi.hoisted(() => ({ error: null as unknown, rows: [] as unknown[], writeError: null as unknown }));
vi.mock('../../api/auth/_utils/crypto', () => ({ verifySessionToken: () => ({
  account_id: 'account-test', identity_id: 'identity-test', full_name: 'Test Person', username: 'test-person', ptv_id: 'PTV-TEST',
}) }));
vi.mock('../../api/auth/_utils/identity', () => ({
  refreshLiveSession: async () => ['hub.access', 'documents.view', 'documents.archive.manage'],
  verifyAccountStatusLive: async () => true,
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({
  from: () => ({
    select: () => ({ order: async () => ({ data: db.rows, error: db.error }) }),
    insert: async () => ({ error: db.writeError }),
    delete: () => ({ eq: async () => ({ error: db.writeError }) }),
    update: () => ({ eq: async () => ({ error: db.writeError }) }),
  }),
  rpc: async () => ({ error: { message: 'RPC unavailable' }, data: null }),
}) }));
import handler from '../../api/dokumen';

const document = (owner: string): PtvDocument => ({
  id: owner, owner, no: '—', subject: 'Test', type: 'Surat Tugas', date: '2026-10-28',
  status: 'Menunggu', created_at: '2026-10-28', recipients: [],
});

async function request(url: string, body?: object) {
  const req = Readable.from(body ? [JSON.stringify(body)] : []) as IncomingMessage;
  req.url = url; req.method = body ? 'POST' : 'GET'; req.headers = { cookie: 'ptv_hub_session=test-placeholder' };
  let result: any;
  const res = { statusCode: 200, setHeader() {}, end(text: string) { result = JSON.parse(text); } };
  await handler(req, res as unknown as ServerResponse);
  return { status: res.statusCode, body: result };
}

describe('DEV-192 document isolation and persistence failures', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://staging-test.invalid');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-placeholder');
    db.rows = []; db.error = null; db.writeError = null;
  });
  afterEach(() => vi.unstubAllEnvs());

  it('does not grant ownership by partial names, shared names or PTV ID prefixes', () => {
    const docs = ['Budi Santoso', 'Budi Wijaya', 'Budi', 'PTV-010', 'PTV-01', 'account-test'].map(document);
    expect(filterUserDocuments(docs, { name: 'Budi Santoso', ptv_id: 'PTV-01', account_id: 'account-test' }).map(d => d.id))
      .toEqual(['Budi Santoso', 'PTV-01', 'account-test']);
    expect(filterUserDocuments(docs, {})).toEqual([]);
  });
  it('matches normalized full names and explicit recipient identities', () => {
    const doc = { ...document('Someone Else'), recipients: ['  TEST   PERSON '] };
    expect(filterUserDocuments([doc], { name: 'Test Person' })).toEqual([doc]);
  });
  it('rejects unknown modes that previously returned the entire archive', async () => {
    expect((await request('/api/dokumen?mode=anything')).status).toBe(400);
  });
  it('returns an empty cloud archive without replacing it with fixtures', async () => {
    const result = await request('/api/dokumen?mode=archive');
    expect(result.status).toBe(200); expect(result.body.documents).toEqual([]);
  });
  it('does not silently turn a failed table query into an empty or partial archive', async () => {
    db.error = { message: 'Read rejected' };
    expect((await request('/api/dokumen?mode=archive')).status).toBe(500);
  });
  it('does not acknowledge a failed insert as a published document', async () => {
    db.writeError = { message: 'Write rejected' };
    expect((await request('/api/dokumen?action=create', { type: 'SBB', subject: 'Test' })).status).toBe(500);
  });
  it.each(['delete', 'update_status'])('rejects %s for a missing document', async (action) => {
    expect((await request(`/api/dokumen?action=${action}`, { id: 'st_missing', status: 'ditolak' })).status).toBe(404);
  });
  it('does not acknowledge a failed deletion', async () => {
    db.rows = [{ id: 'test-id', status: 'diajukan', created_at: '2026-10-28' }];
    db.writeError = { message: 'Write rejected' };
    expect((await request('/api/dokumen?action=delete', { id: 'st_test-id' })).status).toBe(500);
  });
});
