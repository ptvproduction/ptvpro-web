import { compareRestoreManifests } from './lib/restore-manifest-154.mjs';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import console from 'node:console';
try {
  const chunks=[];
  let size=0;
  for await (const chunk of process.stdin) {
    size+=chunk.length;
    if(size>16*1024*1024) throw new Error('Input limit');
    chunks.push(chunk);
  }
  const {original,restored}=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const result=compareRestoreManifests(original,restored);
  console.log(JSON.stringify(result));
  if(!result.equal) process.exitCode=1;
} catch {
  console.error('Private in-memory manifest comparison failed.');
  process.exitCode=1;
}
