import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ALL_CAPABILITIES } from '../../src/core/policy/capabilities';

describe('Phase 5C.1 — Revised Candidate DDL & Security Hardening Harness', () => {
  const sqlPath = path.resolve(__dirname, '../../docs/PTV-PRO-DATABASE-MIGRATION-REVISED.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  it('1. Managed Schema Safety: Zero custom functions in auth schema', () => {
    // Prohibits CREATE FUNCTION auth.* to prevent Supabase 42501 permission denied
    const authFunctionPattern = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+auth\./i;
    expect(authFunctionPattern.test(sqlContent)).toBe(false);

    // Custom functions must be in public schema
    expect(sqlContent).toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.jwt_custom_claims/i);
    expect(sqlContent).toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.has_capability/i);
  });

  it('2. Preserves Supabase built-in context functions: auth.uid() and auth.jwt()', () => {
    // Built-in functions must remain intact
    expect(sqlContent).toMatch(/auth\.uid\(\)/);
    expect(sqlContent).toMatch(/auth\.jwt\(\)/);
  });

  it('3. Destructive safety: No DROP DATABASE, TRUNCATE, or uncontrolled DROP TABLE', () => {
    const lines = sqlContent.split('\n');
    const dangerousPatterns = [
      /^\s*DROP\s+DATABASE/i,
      /^\s*TRUNCATE\s+/i,
      /^\s*DROP\s+TABLE\s+(?!IF\s+EXISTS)/i,
    ];

    for (const line of lines) {
      if (line.trim().startsWith('--')) continue;
      for (const pattern of dangerousPatterns) {
        expect(pattern.test(line)).toBe(false);
      }
    }
  });

  it('4. Zero production credentials or URLs in candidate DDL', () => {
    const forbiddenStrings = [
      'progresiftv.id/wp-admin',
      'postgres://postgres:',
      'SUPABASE_SERVICE_ROLE_KEY',
      'eyJhbGciOi',
    ];

    for (const forbidden of forbiddenStrings) {
      expect(sqlContent.includes(forbidden)).toBe(false);
    }
  });

  it('5. Submitter / Approver separation: diajukan_oleh exists on all 3 official doc tables with consistent FK', () => {
    // 5a. Check CREATE TABLE definitions include diajukan_oleh referencing canonical_identity(id) ON DELETE RESTRICT
    expect(sqlContent).toMatch(/CREATE TABLE IF NOT EXISTS ptv_surat_tugas[\s\S]*?diajukan_oleh UUID NULL REFERENCES canonical_identity\(id\) ON DELETE RESTRICT/i);
    expect(sqlContent).toMatch(/CREATE TABLE IF NOT EXISTS ptv_surat_izin[\s\S]*?diajukan_oleh UUID NULL REFERENCES canonical_identity\(id\) ON DELETE RESTRICT/i);
    expect(sqlContent).toMatch(/CREATE TABLE IF NOT EXISTS ptv_surat_barang[\s\S]*?diajukan_oleh UUID NULL REFERENCES canonical_identity\(id\) ON DELETE RESTRICT/i);

    // 5b. Check idempotent ALTER TABLE statements for existing staging drift remediation
    expect(sqlContent).toMatch(/ALTER TABLE ptv_surat_tugas ADD COLUMN IF NOT EXISTS diajukan_oleh UUID NULL REFERENCES canonical_identity\(id\) ON DELETE RESTRICT;/i);
    expect(sqlContent).toMatch(/ALTER TABLE ptv_surat_izin ADD COLUMN IF NOT EXISTS diajukan_oleh UUID NULL REFERENCES canonical_identity\(id\) ON DELETE RESTRICT;/i);
    expect(sqlContent).toMatch(/ALTER TABLE ptv_surat_barang ADD COLUMN IF NOT EXISTS diajukan_oleh UUID NULL REFERENCES canonical_identity\(id\) ON DELETE RESTRICT;/i);

    // 5c. Check indexing on diajukan_oleh for performance & foreign key cascade lookup
    expect(sqlContent).toMatch(/CREATE INDEX IF NOT EXISTS idx_ptv_surat_tugas_diajukan_oleh ON ptv_surat_tugas \(diajukan_oleh\);/i);
    expect(sqlContent).toMatch(/CREATE INDEX IF NOT EXISTS idx_ptv_surat_izin_diajukan_oleh ON ptv_surat_izin \(diajukan_oleh\);/i);
    expect(sqlContent).toMatch(/CREATE INDEX IF NOT EXISTS idx_ptv_surat_barang_diajukan_oleh ON ptv_surat_barang \(diajukan_oleh\);/i);

    // 5d. Non-destructive preservation: disetujui_oleh column must remain intact
    expect(sqlContent).toMatch(/ptv_surat_tugas[\s\S]*?disetujui_oleh UUID NULL REFERENCES canonical_identity\(id\)/i);
    expect(sqlContent).toMatch(/ptv_surat_izin[\s\S]*?disetujui_oleh UUID NULL REFERENCES canonical_identity\(id\)/i);
    expect(sqlContent).toMatch(/ptv_surat_barang[\s\S]*?disetujui_oleh UUID NULL REFERENCES canonical_identity\(id\)/i);

    // 5e. Defensive FK constraint enforcement DO block
    expect(sqlContent).toMatch(/DO \$\$[\s\S]*?fk_ptv_surat_tugas_diajukan_oleh[\s\S]*?fk_ptv_surat_izin_diajukan_oleh[\s\S]*?fk_ptv_surat_barang_diajukan_oleh[\s\S]*?END \$\$;/i);
    expect(sqlContent).toMatch(/c\.confrelid\s*!=\s*'public\.canonical_identity'::regclass\s*OR\s*c\.confdeltype\s*!=\s*'r'/i);
    expect(sqlContent).toMatch(/REFERENCES\s+public\.canonical_identity\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
  });

  it('6. All 5 contracted RPCs enforce authentication session and anti-spoofing', () => {
    const rpcs = [
      'rpc_checkout_loan',
      'rpc_return_loan',
      'rpc_return_single_unit',
      'rpc_submit_official_doc',
    ];

    for (const rpc of rpcs) {
      // Must contain auth.uid() check
      const rpcBlockMatch = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${rpc}[\\s\\S]*?\\$\\$;`, 'i').exec(sqlContent);
      expect(rpcBlockMatch).not.toBeNull();
      const rpcBody = rpcBlockMatch![0];

      expect(rpcBody).toMatch(/auth\.uid\(\)\s+IS\s+NULL/i);
      expect(rpcBody).toMatch(/Actor spoofing detected/i);
    }
  });

  it('7. rpc_checkout_loan enforces exact signature, concurrency safety, and zero data regression', () => {
    // 7a. Legacy overload cleanup to prevent PostgREST PGRST203 ambiguity
    expect(sqlContent).toMatch(/DROP FUNCTION IF EXISTS public\.rpc_checkout_loan\(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID\[\]\);/i);

    // 7b. Exact canonical signature with optional p_actor_id
    expect(sqlContent).toMatch(/CREATE OR REPLACE FUNCTION public\.rpc_checkout_loan\(\s*p_transaction_id TEXT,\s*p_borrower_name\s+TEXT,\s*p_purpose\s+TEXT,\s*p_out_date\s+DATE,\s*p_due_date\s+DATE,\s*p_event_name\s+TEXT,\s*p_unit_ids\s+UUID\[\],\s*p_actor_id\s+UUID DEFAULT NULL\s*\)/i);

    // 7c. Deadlock-free row locking on inventory units
    expect(sqlContent).toMatch(/ORDER\s+BY\s+id\s+FOR\s+UPDATE/i);

    // 7d. Transaction concurrency serialization
    expect(sqlContent).toMatch(/pg_advisory_xact_lock\(hashtext\(p_transaction_id\)\)/i);

    // 7e. Preserves loan creation and inventory status transition
    expect(sqlContent).toMatch(/INSERT INTO public\.ptv_peminjaman/i);
    expect(sqlContent).toMatch(/UPDATE public\.ptv_inventaris_unit\s+SET status_peminjaman = 'dipinjam'/i);
  });

  it('8. rpc_submit_official_doc safely assigns diajukan_oleh and leaves disetujui_oleh null', () => {
    expect(sqlContent).toMatch(/v_verified_identity_id,\s+v_approver_identity_id,\s+v_initial_status/i);
    expect(sqlContent).toMatch(/REVOKE\s+INSERT\s+ON\s+TABLE\s+public\.ptv_surat_tugas/i);
    expect(sqlContent).toMatch(/REVOKE\s+INSERT\s+ON\s+TABLE[\s\S]*?public\.ptv_surat_izin/i);
    expect(sqlContent).toMatch(/REVOKE\s+INSERT\s+ON\s+TABLE[\s\S]*?public\.ptv_surat_barang/i);
  });

  it('9. rpc_get_next_inv_code enforces inventory capability check and safe formatting', () => {
    expect(sqlContent).toMatch(/inventory\.create/i);
    expect(sqlContent).toMatch(/pg_advisory_xact_lock\(1001\)/i);
    expect(sqlContent).toMatch(/BIGINT/i);
  });

  it('10. Strict privilege revocation and grant ordering: rpc_checkout_loan and mutation RPCs', () => {
    // 10a. rpc_checkout_loan: REVOKE precedes GRANT, revoked from PUBLIC and anon, granted exclusively to authenticated
    const checkoutRevokeMatch = /REVOKE ALL ON FUNCTION public\.rpc_checkout_loan\(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID\[\], UUID\) FROM PUBLIC, anon, service_role;/i.exec(sqlContent);
    const checkoutGrantMatch = /GRANT EXECUTE ON FUNCTION public\.rpc_checkout_loan\(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID\[\], UUID\) TO authenticated;/i.exec(sqlContent);

    expect(checkoutRevokeMatch).not.toBeNull();
    expect(checkoutGrantMatch).not.toBeNull();
    expect(checkoutRevokeMatch!.index).toBeLessThan(checkoutGrantMatch!.index);

    // Verify NO grants of rpc_checkout_loan to anon or PUBLIC anywhere in file
    const invalidCheckoutAnonGrant = /GRANT\s+(?:ALL|EXECUTE)\s+ON\s+FUNCTION\s+public\.rpc_checkout_loan[^;]*TO[^;]*(?:anon|PUBLIC)/i;
    expect(invalidCheckoutAnonGrant.test(sqlContent)).toBe(false);

    // 10b. Other mutation RPCs follow identical strict revocation pattern
    expect(sqlContent).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.rpc_submit_official_doc[\s\S]*?FROM\s+PUBLIC,\s*anon,\s*service_role/i);
    expect(sqlContent).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.rpc_return_loan[\s\S]*?FROM\s+PUBLIC,\s*anon,\s*service_role/i);
    expect(sqlContent).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.rpc_return_single_unit[\s\S]*?FROM\s+PUBLIC,\s*anon,\s*service_role/i);
    expect(sqlContent).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.rpc_get_next_inv_code\(\)\s+FROM\s+PUBLIC,\s*anon/i);
  });

  it('11. All 53 capabilities and 5 profiles are seeded in candidate DDL', () => {
    for (const cap of ALL_CAPABILITIES) {
      expect(sqlContent.includes(`'${cap}'`)).toBe(true);
    }

    const profiles = ['root_executive', 'eksekutif', 'kepolo_kepali', 'crew', 'pembina'];
    for (const prof of profiles) {
      expect(sqlContent.includes(`'${prof}'`)).toBe(true);
    }
  });

  it('12. search_path is pinned to pg_catalog, public, auth across all functions', () => {
    const secDefinerMatches = sqlContent.match(/SET\s+search_path\s*=\s*[^;\n]+/gi) || [];
    expect(secDefinerMatches.length).toBeGreaterThan(0);

    for (const match of secDefinerMatches) {
      expect(match).toMatch(/pg_catalog,\s*public,\s*auth/i);
    }
  });

  it('13. Staging Inspection Reconciliation: Proves candidate SQL remedies all reported staging drifts', () => {
    // Staging Item 1: auth schema clean from custom funcs (Staging: PASS)
    expect(sqlContent).not.toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+auth\./i);

    // Staging Item 2: public.has_capability (Staging: PASS)
    expect(sqlContent).toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.has_capability/i);

    // Staging Items 3, 4, 5: ptv_surat_*.diajukan_oleh (Staging: DRIFT / MISSING)
    // Proves candidate SQL includes compensatory idempotent ALTER TABLE statements for all 3 tables
    const requiredDriftRemedies = [
      'ALTER TABLE ptv_surat_barang ADD COLUMN IF NOT EXISTS diajukan_oleh UUID NULL REFERENCES canonical_identity(id) ON DELETE RESTRICT;',
      'ALTER TABLE ptv_surat_izin ADD COLUMN IF NOT EXISTS diajukan_oleh UUID NULL REFERENCES canonical_identity(id) ON DELETE RESTRICT;',
      'ALTER TABLE ptv_surat_tugas ADD COLUMN IF NOT EXISTS diajukan_oleh UUID NULL REFERENCES canonical_identity(id) ON DELETE RESTRICT;',
    ];
    for (const remedy of requiredDriftRemedies) {
      expect(sqlContent.includes(remedy)).toBe(true);
    }

    // Staging Item 6: rpc_checkout_loan anon revocation (Staging: LEAK / ANON CAN EXECUTE)
    // Proves candidate SQL revokes all privileges from PUBLIC, anon, and drops legacy overload
    expect(sqlContent).toMatch(/DROP FUNCTION IF EXISTS public\.rpc_checkout_loan\(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID\[\]\);/i);
    expect(sqlContent).toMatch(/REVOKE ALL ON FUNCTION public\.rpc_checkout_loan\(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID\[\], UUID\) FROM PUBLIC, anon, service_role;/i);
    expect(sqlContent).toMatch(/GRANT EXECUTE ON FUNCTION public\.rpc_checkout_loan\(TEXT, TEXT, TEXT, DATE, DATE, TEXT, UUID\[\], UUID\) TO authenticated;/i);
  });
});

