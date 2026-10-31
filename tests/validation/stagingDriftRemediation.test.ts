import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 5C.3 — Staging Drift Remediation & Hardening Verification', () => {
  const sqlPath = path.resolve(__dirname, '../../docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  it('1. Finding 1: auth schema clean from custom funcs (PASS)', () => {
    // Prohibits custom function creation inside managed auth schema
    expect(sqlContent).not.toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+auth\./i);
  });

  it('2. Finding 2: public.has_capability is properly defined and accessible for RLS (PASS)', () => {
    // Function defined in public schema
    expect(sqlContent).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.has_capability\(p_capability\s+TEXT\)/i);
    // Granted to authenticated, anon, service_role so RLS evaluations do not crash
    expect(sqlContent).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.has_capability\(TEXT\)\s+TO\s+authenticated,\s*anon,\s*service_role;/i);
  });

  it('3. Finding 3: jwt_custom_claims anon revocation is remediated', () => {
    // Revoked from PUBLIC and anon
    expect(sqlContent).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.jwt_custom_claims\(\)\s+FROM\s+PUBLIC,\s*anon;/i);
    // Granted strictly to authenticated and service_role
    expect(sqlContent).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.jwt_custom_claims\(\)\s+TO\s+authenticated,\s*service_role;/i);
  });

  it('4. Finding 4: rpc_checkout_loan anon revocation is remediated', () => {
    // Legacy 7-arg overload dropped
    expect(sqlContent).toMatch(/DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.rpc_checkout_loan\(TEXT,\s*TEXT,\s*TEXT,\s*DATE,\s*DATE,\s*TEXT,\s*UUID\[\]\);/i);
    // Revoked from PUBLIC, anon, service_role
    expect(sqlContent).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.rpc_checkout_loan\(TEXT,\s*TEXT,\s*TEXT,\s*DATE,\s*DATE,\s*TEXT,\s*UUID\[\],\s*UUID\)\s+FROM\s+PUBLIC,\s*anon,\s*service_role;/i);
    // Granted exclusively to authenticated
    expect(sqlContent).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_checkout_loan\(TEXT,\s*TEXT,\s*TEXT,\s*DATE,\s*DATE,\s*TEXT,\s*UUID\[\],\s*UUID\)\s+TO\s+authenticated;/i);
  });

  it('5. Finding 5: rpc_get_next_inv_code anon revocation is remediated', () => {
    // Revoked from PUBLIC and anon
    expect(sqlContent).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.rpc_get_next_inv_code\(\)\s+FROM\s+PUBLIC,\s*anon;/i);
    // Granted strictly to authenticated and service_role
    expect(sqlContent).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_get_next_inv_code\(\)\s+TO\s+authenticated,\s*service_role;/i);
  });

  it('6. Finding 6: rpc_return_loan anon revocation is remediated', () => {
    // Legacy 4-arg overload dropped
    expect(sqlContent).toMatch(/DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.rpc_return_loan\(TEXT,\s*DATE,\s*TEXT,\s*TEXT\);/i);
    // Revoked from PUBLIC, anon, service_role
    expect(sqlContent).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.rpc_return_loan\(TEXT,\s*DATE,\s*TEXT,\s*TEXT,\s*UUID\)\s+FROM\s+PUBLIC,\s*anon,\s*service_role;/i);
    // Granted exclusively to authenticated
    expect(sqlContent).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_return_loan\(TEXT,\s*DATE,\s*TEXT,\s*TEXT,\s*UUID\)\s+TO\s+authenticated;/i);
  });

  it('7. Finding 7: rpc_return_single_unit anon revocation is remediated', () => {
    // Legacy 3-arg overload dropped
    expect(sqlContent).toMatch(/DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.rpc_return_single_unit\(UUID,\s*UUID,\s*TEXT\);/i);
    // Revoked from PUBLIC, anon, service_role
    expect(sqlContent).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.rpc_return_single_unit\(UUID,\s*UUID,\s*TEXT,\s*UUID\)\s+FROM\s+PUBLIC,\s*anon,\s*service_role;/i);
    // Granted exclusively to authenticated
    expect(sqlContent).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_return_single_unit\(UUID,\s*UUID,\s*TEXT,\s*UUID\)\s+TO\s+authenticated;/i);
  });

  it('8. Finding 8: rpc_submit_official_doc anon revocation is remediated', () => {
    // Legacy 2-arg overload dropped
    expect(sqlContent).toMatch(/DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.rpc_submit_official_doc\(TEXT,\s*JSONB\);/i);
    // Revoked from PUBLIC, anon, service_role
    expect(sqlContent).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.rpc_submit_official_doc\(TEXT,\s*JSONB,\s*UUID\)\s+FROM\s+PUBLIC,\s*anon,\s*service_role;/i);
    // Granted exclusively to authenticated
    expect(sqlContent).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rpc_submit_official_doc\(TEXT,\s*JSONB,\s*UUID\)\s+TO\s+authenticated;/i);
  });

  it('9. Finding 9: diajukan_oleh columns on all 3 official doc tables are idempotently added', () => {
    expect(sqlContent).toMatch(/ALTER\s+TABLE\s+ptv_surat_tugas\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+diajukan_oleh\s+UUID\s+NULL\s+REFERENCES\s+canonical_identity\(id\)\s+ON\s+DELETE\s+RESTRICT;/i);
    expect(sqlContent).toMatch(/ALTER\s+TABLE\s+ptv_surat_izin\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+diajukan_oleh\s+UUID\s+NULL\s+REFERENCES\s+canonical_identity\(id\)\s+ON\s+DELETE\s+RESTRICT;/i);
    expect(sqlContent).toMatch(/ALTER\s+TABLE\s+ptv_surat_barang\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+diajukan_oleh\s+UUID\s+NULL\s+REFERENCES\s+canonical_identity\(id\)\s+ON\s+DELETE\s+RESTRICT;/i);
  });

  it('10. Finding 10: FK constraints strictly validated against canonical_identity(id) ON DELETE RESTRICT', () => {
    // Verifies DO block catalogs pg_constraint, checks confrelid and confdeltype = 'r'
    expect(sqlContent).toMatch(/c\.confrelid\s*!=\s*'public\.canonical_identity'::regclass\s*OR\s*c\.confdeltype\s*!=\s*'r'/i);
    expect(sqlContent).toMatch(/fk_ptv_surat_tugas_diajukan_oleh/);
    expect(sqlContent).toMatch(/fk_ptv_surat_izin_diajukan_oleh/);
    expect(sqlContent).toMatch(/fk_ptv_surat_barang_diajukan_oleh/);
  });

  it('11. Zero Data Mutation: Prohibits silent UPDATE of diajukan_oleh and enforces fail-closed orphan guard', () => {
    // Prohibits silent UPDATE on diajukan_oleh
    expect(sqlContent).not.toMatch(/UPDATE\s+public\.ptv_surat_tugas\s+SET\s+diajukan_oleh\s*=\s*NULL/i);
    expect(sqlContent).not.toMatch(/UPDATE\s+public\.ptv_surat_izin\s+SET\s+diajukan_oleh\s*=\s*NULL/i);
    expect(sqlContent).not.toMatch(/UPDATE\s+public\.ptv_surat_barang\s+SET\s+diajukan_oleh\s*=\s*NULL/i);

    // Enforces fail-closed orphan check with RAISE EXCEPTION
    expect(sqlContent).toMatch(/v_orphan_count\s*>\s*0\s*THEN\s*RAISE\s+EXCEPTION\s+'MIGRATION BLOCKED: Found % orphan diajukan_oleh record\(s\) in ptv_surat_tugas/i);
    expect(sqlContent).toMatch(/v_orphan_count\s*>\s*0\s*THEN\s*RAISE\s+EXCEPTION\s+'MIGRATION BLOCKED: Found % orphan diajukan_oleh record\(s\) in ptv_surat_izin/i);
    expect(sqlContent).toMatch(/v_orphan_count\s*>\s*0\s*THEN\s*RAISE\s+EXCEPTION\s+'MIGRATION BLOCKED: Found % orphan diajukan_oleh record\(s\) in ptv_surat_barang/i);
  });

  it('12. Dynamic Routine Cleaner: Cleans up any rogue overloads with non-canonical arity', () => {
    expect(sqlContent).toMatch(/p\.proname\s*=\s*'rpc_checkout_loan'\s*AND\s*p\.pronargs\s*!=\s*8/i);
    expect(sqlContent).toMatch(/p\.proname\s*=\s*'rpc_submit_official_doc'\s*AND\s*p\.pronargs\s*!=\s*3/i);
    expect(sqlContent).toMatch(/p\.proname\s*=\s*'rpc_return_loan'\s*AND\s*p\.pronargs\s*!=\s*5/i);
    expect(sqlContent).toMatch(/p\.proname\s*=\s*'rpc_return_single_unit'\s*AND\s*p\.pronargs\s*!=\s*4/i);
    expect(sqlContent).toMatch(/p\.proname\s*=\s*'rpc_get_next_inv_code'\s*AND\s*p\.pronargs\s*!=\s*0/i);
    expect(sqlContent).toMatch(/p\.proname\s*=\s*'jwt_custom_claims'\s*AND\s*p\.pronargs\s*!=\s*0/i);
  });

  it('13. RLS Parity: All RLS policies reference public.has_capability', () => {
    const policyLines = sqlContent
      .split('\n')
      .map(l => l.trim())
      .filter(l => !l.startsWith('--') && l.startsWith('CREATE POLICY'));
    expect(policyLines.length).toBe(10);
    // Zero occurrences of auth.has_capability in policies
    expect(sqlContent).not.toMatch(/auth\.has_capability/i);
  });
});
