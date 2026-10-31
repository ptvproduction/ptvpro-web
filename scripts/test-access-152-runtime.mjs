import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

// No env files, database clients invoked, network calls, or real credentials are used.
if (process.argv.length !== 2) throw new Error('This synthetic runner accepts no arguments.');
await mkdir('.gemini/scratch', { recursive: true });
const output = resolve('.gemini/scratch/access152-runtime.mjs');
await build({ stdin: { contents: `export {default as login} from './api/auth/login.ts';
  export {signSessionToken,verifySessionToken} from './api/auth/_utils/crypto.ts';
  export {verifyLegacyBcryptPassword} from './api/auth/_utils/legacyPassword.ts';`,
  resolveDir: process.cwd(), loader: 'ts' }, outfile: output, bundle: true, platform: 'node',
  format: 'esm', target: 'node24', packages: 'external', logLevel: 'silent' });
const auth = await import(pathToFileURL(output).href);
process.env.NODE_ENV = 'production';
globalThis.fetch = async () => { throw new Error('Network forbidden in synthetic runtime test.'); };
const fixture = JSON.parse(await readFile('tests/fixtures/legacy-bcrypt151-synthetic.json', 'utf8'));
assert.equal(await auth.verifyLegacyBcryptPassword(fixture.syntheticPassword, fixture.encoded), true);
assert.equal(await auth.verifyLegacyBcryptPassword('WRONG-SYNTHETIC', fixture.encoded), false);
const now = Math.floor(Date.now() / 1000), secret = 'synthetic-runtime152-test-only';
const payload = { account_id: 'synthetic-account', identity_id: 'synthetic-identity', iat: now, exp: now + 60 };
assert.ok(auth.verifySessionToken(auth.signSessionToken(payload, secret), secret));
assert.equal(auth.verifySessionToken(auth.signSessionToken({ ...payload, exp: now - 1 }, secret), secret), null);
assert.equal(auth.verifySessionToken(auth.signSessionToken(payload, secret), 'wrong-synthetic-key'), null);
const req = Readable.from(['{"identifier":"SYNTHETIC","password":"SYNTHETIC"}']);
req.method = 'POST'; req.headers = { cookie: 'ptv_hub_session=SYNTHETIC_UNCHANGED' };
const headers = new Map(); let body;
const res = { statusCode: 200, setHeader: (name, value) => headers.set(name.toLowerCase(), value),
  getHeader: name => headers.get(name.toLowerCase()), end: value => { body = value; } };
await auth.login(req, res);
assert.equal(res.statusCode, 403);
assert.ok(JSON.parse(body).error.includes('Login password belum tersedia secara aman'));
assert.equal(headers.has('set-cookie'), false);
console.log(JSON.stringify({ node: process.version, bundleTarget: 'node24', syntheticOnly: true,
  checksPassed: 8, cloudRequests: 0, liveLoginEnabled: false, deployedRuntimeVerified: false }));
