import { readFileSync, writeFileSync } from 'node:fs';
import { renderApprovedBootstrap,renderApprovedBootstrapRevert } from './lib/root-bootstrap-149.mjs';

// Offline renderer only. No SQL client, credential reader or database execution path.
const revert=process.argv.includes('--revert');
const [manifestPath,signaturePath,outputPath]=process.argv.slice(2).filter(arg=>arg!=='--revert');
if(!manifestPath||!signaturePath||!outputPath) throw new Error('Supply approved manifest, detached signature and NEW local SQL output path.');
const sql=(revert?renderApprovedBootstrapRevert:renderApprovedBootstrap)(readFileSync(manifestPath),readFileSync(signaturePath,'utf8'),
  JSON.parse(readFileSync('config/access-bootstrap-trust.json','utf8')),readFileSync(revert?'docs/PTVPRO-ACCESS-149-ROOT-BOOTSTRAP-REVERT-TEMPLATE.sql':'docs/PTVPRO-ACCESS-149-ROOT-BOOTSTRAP-TEMPLATE.sql','utf8'));
writeFileSync(outputPath,sql,{flag:'wx'});
console.log('Approved bootstrap SQL rendered locally. Not executed.');
