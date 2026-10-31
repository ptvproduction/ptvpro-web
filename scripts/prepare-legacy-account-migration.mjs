import { readFileSync, writeFileSync } from 'node:fs';
import { planLegacyAccounts, deriveLegacyBatchTemplate, migrationEvidenceHash } from './lib/legacy-account-migration.mjs';
import process from 'node:process';
import console from 'node:console';

if(process.argv.length!==3)throw new Error('Supply current pseudonymized read-only inventory; no credentials accepted');
const snapshot=JSON.parse(readFileSync(process.argv[2],'utf8'));
if(snapshot.sources?.legacy!=='jthzuhkblxcaohiuypqq'||snapshot.sources?.staging!=='swadgljnyelsjstqqxbm')throw new Error('Source/target mismatch');
if(/"(?:password_hash|password|access_token|refresh_token|oauth_uid|oauth_email|nama|username)"\s*:/.test(JSON.stringify(snapshot)))throw new Error('Unsanitized input rejected');
const plan={...planLegacyAccounts(snapshot),capturedAt:snapshot.capturedAt,sources:snapshot.sources,
 sourceSnapshotSha256:migrationEvidenceHash(snapshot),currentCloudReadOnly:true,mutations:false,
 testingAccounts:{count:snapshot.staging.accounts.length,preserve:true,reuse:false},
 status:'BLOCKED: authoritative login status and reviewed mappings required'};
writeFileSync('docs/PTVPRO-PHASE1-LEGACY-MIGRATION-MANIFEST.json',JSON.stringify(plan,null,2)+'\n');
const template=deriveLegacyBatchTemplate(readFileSync('docs/PTVPRO-PHASE1-PROVISIONING-PROPOSAL.sql','utf8'));
writeFileSync('docs/PTVPRO-PHASE1-LEGACY-MIGRATION-PROPOSAL.sql',template);
console.log(JSON.stringify(plan.counts));
