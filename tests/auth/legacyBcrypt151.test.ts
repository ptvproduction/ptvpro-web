import { describe, expect, it } from 'vitest';
import { hashSync } from 'bcryptjs';
import { verifyLegacyBcryptPassword } from '../../api/_routes/auth/_utils/legacyPassword';
import pythonFixture from '../fixtures/legacy-bcrypt151-synthetic.json';

const syntheticPassword = 'PTV151-SYNTHETIC-ONLY';
const fixture = hashSync(syntheticPassword, 10);
describe('Node auth Legacy bcrypt compatibility (synthetic credentials only)', () => {
  it('verifies an independent Python 2y UTF-8 fixture without rewriting the hash', async () => {
    expect(await verifyLegacyBcryptPassword(pythonFixture.syntheticPassword, pythonFixture.encoded)).toBe(true);
    expect(await verifyLegacyBcryptPassword('WRONG-SYNTHETIC', pythonFixture.encoded)).toBe(false);
  });
  it.each(['2a', '2b', '2y'])('%s verifies the fixture and rejects the wrong password', async prefix => {
    const encoded = `$${prefix}${fixture.slice(3)}`;
    expect(await verifyLegacyBcryptPassword(syntheticPassword, encoded)).toBe(true);
    expect(await verifyLegacyBcryptPassword('WRONG-SYNTHETIC', encoded)).toBe(false);
  });
  it.each([null, '', '$2y$31$malformed', fixture.replace('$10$', '$31$')])('rejects malformed/unsupported cost before expensive work (%#)', async encoded => {
    expect(await verifyLegacyBcryptPassword(syntheticPassword, encoded)).toBe(false);
  });
  it('does not silently truncate multi-byte passwords to 72 bytes', async () => {
    expect(await verifyLegacyBcryptPassword('é'.repeat(37), fixture)).toBe(false);
  });
});
