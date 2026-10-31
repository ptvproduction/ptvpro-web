import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const windows = process.platform === 'win32';
const windowsRoot = process.env.SystemRoot || 'C:\\Windows';
const executable = join(windowsRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([name]) => name.toLowerCase() !== 'psmodulepath')),
  PSModulePath: join(windowsRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules') };
const reader = resolve('scripts/read-phase1-portal-private.ps1');
const run = (args: string[]) => spawnSync(executable, ['-NoProfile', ...args], { env, encoding: 'utf8', windowsHide: true });

describe.skipIf(!windows || process.env.PTV_TEST_PRIVATE_READER_RUNTIME !== 'true')('Private Portal reader166 — no real credential access', () => {
  it('loads native ACL and DPAPI cmdlets without inheriting incompatible PowerShell modules', () => {
    const result = run(['-Command', '[Console]::Out.Write([bool]((Get-Command Get-Acl -ErrorAction Stop) -and (Get-Command ConvertTo-SecureString -ErrorAction Stop)))']);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0); expect(result.stdout).toBe('True');
  }, 20000);
  it('rejects an empty account before touching any credential and prints no plaintext', () => {
    const result = run(['-File', reader, '-AccountId', '00000000-0000-0000-0000-000000000000']);
    expect(result.status).toBe(1); expect(result.stdout).toBe(''); expect(result.stderr).toBe('PRIVATE_PORTAL_READER_BLOCKED:pipe');
  }, 20000);
  it('parses the guarded reader with the same Windows PowerShell engine used at runtime', () => {
    const path = reader.replace(/'/g, "''");
    const result = run(['-Command', `$t=$null; $e=$null; [void][Management.Automation.Language.Parser]::ParseFile('${path}',[ref]$t,[ref]$e); [Console]::Out.Write($e.Count -eq 0)`]);
    expect(result.status).toBe(0); expect(result.stdout).toBe('True');
  }, 20000);
});
