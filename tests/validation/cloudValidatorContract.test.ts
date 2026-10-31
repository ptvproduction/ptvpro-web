import { describe, it, expect } from 'vitest';
// @ts-ignore
import { EXPECTED_TABLES, CONTRACTED_RPCS, evaluateRpcResponse } from '../../scripts/validate-staging-cloud.mjs';

interface RpcSpec {
  name: string;
  type: string;
  body: Record<string, unknown>;
  expectedStatus?: number;
  checkResponse?: (data: unknown) => boolean;
  description?: string;
}

describe('Cloud Validator Logic & Hardened Contract Specification', () => {
  const rpcs = CONTRACTED_RPCS as RpcSpec[];

  it('1. CONTRACTED_RPCS contains all 7 contracted database functions', () => {
    const rpcNames = rpcs.map((r) => r.name);
    expect(rpcNames).toEqual([
      'has_capability',
      'jwt_custom_claims',
      'rpc_get_next_inv_code',
      'rpc_checkout_loan',
      'rpc_return_loan',
      'rpc_return_single_unit',
      'rpc_submit_official_doc',
    ]);
  });

  it('2. has_capability is explicitly configured as anonymous_executable with fail-closed check', () => {
    const hasCap = rpcs.find((r) => r.name === 'has_capability');
    expect(hasCap).toBeDefined();
    expect(hasCap?.type).toBe('anonymous_executable');
    expect(hasCap?.expectedStatus).toBe(200);
    expect(hasCap?.checkResponse?.(false)).toBe(true);
    expect(hasCap?.checkResponse?.(true)).toBe(false);
  });

  it('3. All 6 sensitive functions are explicitly configured as anonymous_restricted', () => {
    const restrictedRpcs = rpcs.filter((r) => r.type === 'anonymous_restricted');
    expect(restrictedRpcs.length).toBe(6);
    const names = restrictedRpcs.map((r) => r.name);
    expect(names).toContain('jwt_custom_claims');
    expect(names).toContain('rpc_get_next_inv_code');
    expect(names).toContain('rpc_checkout_loan');
    expect(names).toContain('rpc_return_loan');
    expect(names).toContain('rpc_return_single_unit');
    expect(names).toContain('rpc_submit_official_doc');
  });

  it('4. evaluateRpcResponse correctly accepts secure anonymous restriction modes', () => {
    const restrictedRpc = rpcs.find((r) => r.name === 'rpc_checkout_loan')!;

    // Gateway 401 Unauthorized
    expect(evaluateRpcResponse(restrictedRpc, 401, null)).toEqual({
      ok: true,
      status: 'verified',
      detail: 'HTTP 401 (Access Securely Denied)',
    });

    // Gateway 403 Forbidden
    expect(evaluateRpcResponse(restrictedRpc, 403, null)).toEqual({
      ok: true,
      status: 'verified',
      detail: 'HTTP 403 (Access Securely Denied)',
    });

    // PostgREST 404 PGRST202 (Routine hidden from schema cache for unprivileged role)
    expect(evaluateRpcResponse(restrictedRpc, 404, { code: 'PGRST202' })).toEqual({
      ok: true,
      status: 'verified',
      detail: 'HTTP 404 [PGRST202] (Access Securely Denied)',
    });

    // PL/pgSQL P0001 (Internal capability guard exception)
    expect(evaluateRpcResponse(restrictedRpc, 400, { code: 'P0001' })).toEqual({
      ok: true,
      status: 'verified',
      detail: 'HTTP 400 [P0001] (Access Securely Denied)',
    });

    // PL/pgSQL 28000 (Internal session requirement exception)
    expect(evaluateRpcResponse(restrictedRpc, 400, { code: '28000' })).toEqual({
      ok: true,
      status: 'verified',
      detail: 'HTTP 400 [28000] (Access Securely Denied)',
    });
  });

  it('5. evaluateRpcResponse strictly detects and flags security leaks (HTTP 200 on restricted RPC)', () => {
    const restrictedRpc = rpcs.find((r) => r.name === 'jwt_custom_claims')!;
    const leakResult = evaluateRpcResponse(restrictedRpc, 200, { role: 'anon' });
    expect(leakResult.ok).toBe(false);
    expect(leakResult.status).toBe('failed');
    expect(leakResult.detail).toMatch(/CRITICAL SECURITY LEAK/i);
  });

  it('6. EXPECTED_TABLES includes all 37 canonical tables and views', () => {
    expect(EXPECTED_TABLES.length).toBe(37);
    expect(EXPECTED_TABLES).toContain('canonical_identity');
    expect(EXPECTED_TABLES).toContain('ptv_surat_tugas');
    expect(EXPECTED_TABLES).toContain('ptv_surat_izin');
    expect(EXPECTED_TABLES).toContain('ptv_surat_barang');
    expect(EXPECTED_TABLES).toContain('ptv_kru_legacy_compat');
  });
});
