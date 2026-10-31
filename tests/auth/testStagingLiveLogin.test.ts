import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { authenticatePortalPassword } from '../../api/auth/_utils/portalLifecycle';
import { Readable } from 'node:stream';
import type { ApiRequest } from '../../api/auth/_utils/types';
import { spawnSync } from 'node:child_process';

describe.runIf(process.env.PTV_RUN_LIVE_AUTH_TESTS === 'true')('Real Staging Cloud Authentication Verification', () => {
  it('authenticates PTV-001 against live Staging Supabase with DPAPI password', async () => {
    // Read DPAPI password via PowerShell child process without printing secret
    const psCmd = `
      $path = Join-Path $env:LOCALAPPDATA 'PTVPRO-Phase1-Private\\c08952de-a8ff-48e0-8182-ac0bb7ac6767.password.dpapi'
      $secure = ConvertTo-SecureString -String ([IO.File]::ReadAllText($path))
      $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
      $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
      [Console]::Out.Write($plain)
    `;

    // Load staging env
    if (fs.existsSync('.env.staging.local')) {
      const localLines = fs.readFileSync('.env.staging.local', 'utf8').split('\n');
      for (const line of localLines) {
        const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (m) {
          let v = (m[2] || '').trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
          process.env[m[1]] = v;
        }
      }
    }
    const envLines = fs.readFileSync('.env.staging', 'utf8').split('\n');
    for (const line of envLines) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (m) {
        let v = (m[2] || '').trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (!process.env[m[1]]) process.env[m[1]] = v;
      }
    }

    expect(process.env.VITE_SUPABASE_URL).toMatch(/^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/);
    const ps = spawnSync('powershell.exe', ['-NoProfile', '-Command', psCmd], { encoding: 'utf8' });
    if (ps.status !== 0 || !ps.stdout) throw new Error('Kredensial uji privat tidak tersedia.');
    const password = ps.stdout;

    process.env.PTV_AUTH_LIFECYCLE_ENABLED = 'true';
    process.env.PTV_PASSWORD_LOGIN_ENABLED = 'true';

    const req = Readable.from([]) as unknown as ApiRequest;
    req.method = 'POST';
    req.headers = {
      host: 'localhost:5174',
      'x-forwarded-proto': 'http',
    };
    req.socket = { remoteAddress: '127.0.0.1' } as any;

    const result = await authenticatePortalPassword(req, 'jid', password);

    expect(result.status).toBe(200);
    expect(result.session).toBeDefined();
    expect(result.session?.ptv_id).toBe('PTV-001');
    expect(result.session?.username).toBe('jid');
    expect(result.session?.status_akun).toBe('active');
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.session?.capabilities).toContain('hub.access');
    expect(result.session?.capabilities).toContain('crew.view');
  });

  it('authenticates PTV-002 (rouf) against live Staging Supabase with DPAPI password', async () => {
    const psCmd = `
      $path = Join-Path $env:LOCALAPPDATA 'PTVPRO-Phase1-Private\\6bf10320-dc82-4223-b43c-4c988470a3cc.password.dpapi'
      $secure = ConvertTo-SecureString -String ([IO.File]::ReadAllText($path))
      $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
      $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
      [Console]::Out.Write($plain)
    `;

    const ps = spawnSync('powershell.exe', ['-NoProfile', '-Command', psCmd], { encoding: 'utf8' });
    if (ps.status !== 0 || !ps.stdout) throw new Error('Kredensial uji privat rouf tidak tersedia.');
    const password = ps.stdout;

    const req = Readable.from([]) as unknown as ApiRequest;
    req.method = 'POST';
    req.headers = {
      host: 'localhost:5174',
      'x-forwarded-proto': 'http',
    };
    req.socket = { remoteAddress: '127.0.0.1' } as any;

    const result = await authenticatePortalPassword(req, 'rouf', password);

    expect(result.status).toBe(200);
    expect(result.session).toBeDefined();
    expect(result.session?.ptv_id).toBe('PTV-002');
    expect(result.session?.username).toBe('rouf');
    expect(result.session?.status_akun).toBe('active');
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.session?.capabilities).toContain('hub.access');
  });
});
