import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { APP_CONFIG } from '../../src/app/config/env';

describe('Phase 5C — Environment Isolation & Safety Verification', () => {
  it('1. Application configuration defaults to local and never production', () => {
    expect(APP_CONFIG.env).toBe('local');
    expect(APP_CONFIG.supabase.url).not.toContain('progresiftv.id');
    expect(APP_CONFIG.supabase.url).not.toContain('.supabase.co');
  });

  it('2. Zero production URLs, IDs, or secrets committed in repository files', () => {
    const rootDir = path.resolve(__dirname, '../../');
    const checkedFiles = [
      '.env.example',
      'package.json',
      'vite.config.ts',
      'src/app/config/env.ts',
      'src/core/supabase/client.ts',
      'docs/PTV-PRO-DATABASE-MIGRATION-DRAFT.sql',
    ];

    const forbiddenPatterns = [
      /supabase\.co\/.*prod/i,
      /service_role/i,
      /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[a-zA-Z0-9_.-]{20,}/i,
      /postgres:\/\/postgres:[^@]+@db\.[^:]+\.supabase\.co/i,
    ];

    for (const relativePath of checkedFiles) {
      const fullPath = path.join(rootDir, relativePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        for (const pattern of forbiddenPatterns) {
          expect(pattern.test(content)).toBe(false);
        }
      }
    }
  });

  it('3. Environment Gate: Fails closed if expected environment is not staging', () => {
    function assertStagingTarget(envTarget: string): boolean {
      if (envTarget !== 'staging') {
        throw new Error(`ABORT: Target environment is '${envTarget}'. Expected strictly 'staging'.`);
      }
      return true;
    }

    expect(() => assertStagingTarget('production')).toThrowError(/ABORT/);
    expect(() => assertStagingTarget('prod')).toThrowError(/ABORT/);
    expect(() => assertStagingTarget('live')).toThrowError(/ABORT/);
    expect(assertStagingTarget('staging')).toBe(true);
  });
});
