import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyLegacyBcryptPassword } from '../api/auth/_utils/legacyPassword.ts';

// Native Node 24 runner; does not load environment files, user credentials or database clients.
const fixture=JSON.parse(readFileSync('tests/fixtures/legacy-bcrypt151-synthetic.json','utf8'));
assert.equal(await verifyLegacyBcryptPassword(fixture.syntheticPassword,fixture.encoded),true);
assert.equal(await verifyLegacyBcryptPassword('WRONG-SYNTHETIC',fixture.encoded),false);
console.log(JSON.stringify({node:process.version,syntheticOnly:true,checksPassed:2,liveLoginEnabled:false}));
