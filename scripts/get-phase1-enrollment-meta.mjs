import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import process from 'node:process';
import console from 'node:console';
import { URL } from 'node:url';
import { Client } from 'pg';
import { STAGING_FINGERPRINT, enrollmentSurfaceSql } from './lib/private-enrollment.mjs';

if (process.argv.length !== 3) {
  throw new Error('Supply account UUID as argument');
}
const accountId = process.argv[2];

let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.length > 65536) throw new Error('Input limit exceeded');
}
input = input.replace(/^\uFEFF/, '').trim();
const { database_password } = JSON.parse(input);
input = '';

const ca = readFileSync(new URL('./certificates/supabase-prod-ca-2021.crt', import.meta.url));
if (createHash('sha256').update(ca).digest('hex') !== '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7') {
  throw new Error('Approved CA mismatch');
}

const options = {
  host: 'db.swadgljnyelsjstqqxbm.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: database_password,
  ssl: { ca: ca.toString(), rejectUnauthorized: true },
  connectionTimeoutMillis: 10000,
  query_timeout: 30000
};

const client = new Client(options);
try {
  await client.connect();
  const p = (await client.query("SELECT md5(system_identifier::text) AS fingerprint,session_user,current_user,coalesce(current_setting('role',true),'none') AS role,coalesce(current_setting('request.jwt.claims',true),'') AS claims FROM pg_control_system()")).rows[0];
  if (p.fingerprint !== STAGING_FINGERPRINT || p.session_user !== 'postgres') {
    throw new Error('Untrusted target database');
  }

  const surfaceDigest = (await client.query(enrollmentSurfaceSql)).rows[0]?.digest;
  if (!surfaceDigest) throw new Error('Could not compute security surface digest');

  const ua = (await client.query("SELECT id, identity_id, username, status_akun, to_char(updated_at, 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM public.user_account WHERE id = $1", [accountId])).rows[0];
  if (!ua) throw new Error('Account not found in Staging user_account');

  const ci = (await client.query("SELECT id, ptv_id, metadata->>'legacy_uuid' AS source_uuid FROM public.canonical_identity WHERE id = $1", [ua.identity_id])).rows[0];
  if (!ci) throw new Error('Canonical identity not found for account');

  console.log(JSON.stringify({
    ok: true,
    security_surface_sha256: surfaceDigest,
    account_id: ua.id,
    identity_id: ua.identity_id,
    source_uuid: ci.source_uuid,
    username: ua.username,
    ptv_id: ci.ptv_id,
    status_akun: ua.status_akun,
    expected_account_version: ua.updated_at
  }));
} finally {
  await client.end().catch(() => {});
}
