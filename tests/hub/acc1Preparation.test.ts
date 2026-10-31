import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const prep=readFileSync('docs/PTVPRO-ACCESS-149-PREBOOTSTRAP-BUNDLE.sql','utf8');
describe('ACC1 installation package (static, actual restored clone evidence separate)',()=>{
 it('binds administrative principal and approved physical cluster before first DDL',()=>{
  const guard=prep.indexOf('DO $installation$'),ddl=prep.indexOf('CREATE SCHEMA');
  expect(guard).toBeGreaterThan(0);expect(guard).toBeLessThan(ddl);
  for(const text of ['pg_control_system()','__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',"session_user<>'postgres'","current_user<>'postgres'",'request.jwt.claims','IS DISTINCT FROM'])expect(prep.slice(guard,ddl)).toContain(text);
 });
 it('closes service EXECUTE after all definitions and verifies effective inherited rights',()=>{
  const closure=prep.lastIndexOf('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ptv_access_private FROM PUBLIC,anon,authenticated,service_role;');
  expect(closure).toBeGreaterThan(prep.lastIndexOf('CREATE OR REPLACE FUNCTION'));
  expect(prep.slice(closure)).toContain('has_function_privilege');expect(prep.slice(closure)).toContain('inherited mutation privilege remains');
  expect(prep).not.toMatch(/^GRANT EXECUTE/m);
 });
 it('refuses replay and keeps reviewed source hashes without modifying global defaults',()=>{
  expect(prep).toContain('Access149 already present; review drift before replay');
  expect(prep).not.toMatch(/ALTER DEFAULT PRIVILEGES/);
  for(const file of ['docs/PTVPRO-ACCESS-149-PROPOSAL.sql','docs/PTVPRO-ACCESS-149-RLS-PROPOSAL.sql']){
   const sha=createHash('sha256').update(readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex');
   expect(prep).toContain(`${file} sha256=${sha}`);
  }
 });
 it('preserves one transaction and includes no bootstrap or enrollment execution',()=>{
  expect(prep.match(/^BEGIN;$/gm)).toHaveLength(1);expect(prep.match(/^COMMIT;$/gm)).toHaveLength(1);
  expect(prep).not.toMatch(/SELECT\s+ptv_auth_private\.enroll_password|VALUES\([^\n]*'root_executive'|UPDATE\s+auth\.sessions/i);
 });
 it('preflight stays read-only with no business function calls or credential values',()=>{
  const sql=readFileSync('docs/PTVPRO-PHASE1-ACC1-PREFLIGHT-READONLY.sql','utf8');
  expect(sql).toContain('BEGIN TRANSACTION READ ONLY');expect(sql.trim()).toMatch(/ROLLBACK;$/);
  expect(sql).not.toMatch(/^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE|DO)\b/im);
  expect(sql).not.toMatch(/SELECT\s+public\.rpc_|SELECT\s+password_hash\b/i);
 });
});
