import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ALL_CAPABILITIES } from '../../src/core/policy/capabilities';

describe('Phase 5B — SQL Schema & Safety Audit Harness', () => {
  const sqlPath = path.resolve(__dirname, '../../docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  it('1. SQL Safety Audit: No uncontrolled destructive statements', () => {
    // Uncontrolled DROP TABLE, TRUNCATE, or DROP DATABASE are prohibited
    const lines = sqlContent.split('\n');
    const dangerousPatterns = [
      /^\s*DROP\s+DATABASE/i,
      /^\s*TRUNCATE\s+/i,
      /^\s*DROP\s+TABLE\s+(?!IF\s+EXISTS)/i,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip commented lines
      if (line.trim().startsWith('--')) continue;

      for (const pattern of dangerousPatterns) {
        expect(pattern.test(line)).toBe(false);
      }
    }
  });

  it('2. Zero Production Secrets or Hardcoded Credentials in Draft SQL', () => {
    // Ensure no service role keys, production URLs, or personal passwords exist in SQL
    const forbiddenStrings = [
      'service_role',
      'SUPABASE_SERVICE_ROLE_KEY',
      'eyJhbGciOi', // JWT prefix
      'progresiftv.id/wp-admin',
      'postgres://postgres:',
    ];

    for (const forbidden of forbiddenStrings) {
      expect(sqlContent.includes(forbidden)).toBe(false);
    }
  });

  it('3. All 53 Granular Capabilities must be explicitly seeded in capability_registry', () => {
    for (const cap of ALL_CAPABILITIES) {
      const capabilitySeedPattern = new RegExp(`'${cap}'`, 'i');
      expect(capabilitySeedPattern.test(sqlContent)).toBe(true);
    }
  });

  it('4. All 5 Canonical Access Profiles must be seeded in access_profile', () => {
    const profiles = [
      'root_executive',
      'eksekutif',
      'kepolo_kepali',
      'crew',
      'pembina',
    ];

    for (const profile of profiles) {
      const profileSeedPattern = new RegExp(`'${profile}'`, 'i');
      expect(profileSeedPattern.test(sqlContent)).toBe(true);
    }
  });

  it('5. SECURITY DEFINER functions must have fixed search_path to prevent hijacking', () => {
    // Extract all SECURITY DEFINER functions
    const secDefinerMatches = sqlContent.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+[\s\S]*?SECURITY\s+DEFINER[\s\S]*?\$\$/gi) || [];
    expect(secDefinerMatches.length).toBeGreaterThan(0);

    for (const match of secDefinerMatches) {
      // Must contain SET search_path = public, auth or SET search_path = public
      expect(match).toMatch(/SET\s+search_path\s*=\s*public/i);
    }
  });

  it('6. auth.has_capability function must exist and enforce revocation safety', () => {
    expect(sqlContent).toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+auth\.has_capability/i);
    // Must check status_akun
    expect(sqlContent).toMatch(/v_status_akun\s*!=\s*'active'/i);
    // Must check status_organisasi read-only gate
    expect(sqlContent).toMatch(/v_status_organisasi\s*=\s*'inactive'/i);
    // Must have revocation epoch / tokens_valid_after check for sensitive capabilities
    expect(sqlContent).toMatch(/tokens_valid_after/i);
  });
});
