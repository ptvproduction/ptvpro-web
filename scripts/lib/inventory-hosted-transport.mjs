import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

export const inventoryHostedOrigin = 'https://ptvpro-9sjo6ryow-ptvpro-web.vercel.app';
export async function inventoryHostedFetch(path, options = {}) {
  assert(/^\/api\/[a-z0-9/_?%=&.~-]+$/i.test(path));
  const config = [`request = ${JSON.stringify(options.method || 'GET')}`];
  for (const [key, value] of Object.entries(options.headers || {})) {
    assert(/^[a-z-]+$/i.test(key) && !/[\r\n]/.test(value));
    config.push(`header = ${JSON.stringify(`${key}: ${value}`)}`);
  }
  let fixture;
  try {
    if (options.body !== undefined) {
      if (Buffer.isBuffer(options.body)) {
        assert(options.headers?.['Content-Type'] === 'image/png' && options.body.length < 4194304);
        mkdirSync('.gemini/scratch/inventory-hosted', { recursive: true });
        fixture = `.gemini/scratch/inventory-hosted/upload-${randomUUID()}.png`;
        writeFileSync(fixture, options.body);
        config.push(`data-binary = ${JSON.stringify('@' + fixture)}`);
      } else config.push(`data-binary = ${JSON.stringify(options.body)}`);
    }
    const command = `npx --yes vercel@65.2.0 --scope team_MYSLnI6crKW78Hb7Lw3CFlOV curl "${inventoryHostedOrigin}${path}" -- --include --silent --show-error --max-time 45 --config -`;
    const result = spawnSync(command, { shell: true, input: config.join('\n') + '\n', encoding: 'utf8', windowsHide: true, timeout: 90000, maxBuffer: 8000000 });
    assert(result.status === 0, 'HOSTED_TRANSPORT_FAILED');
    const sections = result.stdout.split(/\r?\n\r?\n/);
    let header = sections.shift();
    while (sections[0]?.startsWith('HTTP/')) header = sections.shift();
    const status = Number(header.match(/^HTTP\/\S+ (\d+)/)?.[1]);
    assert(Number.isInteger(status) && status >= 100);
    const text = sections.join('\n\n');
    return { status, headers: { getSetCookie: () => [...header.matchAll(/^set-cookie:\s*(.+)$/gim)].map(m => m[1].trim()) }, json: async () => JSON.parse(text) };
  } finally { if (fixture) rmSync(fixture, { force: true }); }
}
