import { readFileSync } from 'node:fs';
import { compareRestoreManifests } from './lib/restore-manifest-154.mjs';
try {
  if(process.argv.length!==4) throw new Error('Two private manifest paths required.');
  const result=compareRestoreManifests(JSON.parse(readFileSync(process.argv[2],'utf8')),JSON.parse(readFileSync(process.argv[3],'utf8')));
  // Only status and section names, never data digests, definitions or user values.
  console.log(JSON.stringify(result));
  if(!result.equal) process.exitCode=1;
} catch {
  console.error('Restore manifest comparison failed; verify private input files and coverage.');
  process.exitCode=1;
}
