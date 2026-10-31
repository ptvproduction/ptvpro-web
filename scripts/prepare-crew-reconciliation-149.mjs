import { readFileSync, writeFileSync } from 'node:fs';
import { reconcileLegacySnapshot, evidenceFingerprint } from './lib/legacy-crew-reconciliation.mjs';

// Offline only: accepts the pseudonymized SELECT snapshot, never opens a database connection.
const input=process.argv[2];
if(!input) throw new Error('Supply a pseudonymized evidence JSON file; raw credentials/PII must never be used.');
const snapshot=JSON.parse(readFileSync(input,'utf8'));
const manifest={...reconcileLegacySnapshot(snapshot),evidenceSha256:evidenceFingerprint(snapshot)};
writeFileSync('docs/PTVPRO-ACCESS-149-RECONCILIATION.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest.counts));
