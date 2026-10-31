import {readFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import process from 'node:process';
import console from 'node:console';
import {buildBinaryTransportSql,textSha} from './lib/legacy25-binary-transport.mjs';
import {APPROVED_SQL_SHA,sourceDigestForManifest} from './run-legacy25-staging.mjs';

try {
 let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>262144)throw new Error('Size');}
 const p=JSON.parse(input);input='';
 if(textSha(p.sql)!==APPROVED_SQL_SHA)throw new Error('Parent hash');
 const m=JSON.parse(p.manifest),bound=p.sql.match(/m jsonb := '((?:''|[^'])*)'::jsonb;/);
 if(!bound||JSON.stringify(m)!==JSON.stringify(JSON.parse(bound[1].replaceAll("''","'"))))throw new Error('Parent binding');
 const expected=['001','002','003','004','005','006','016',...Array.from({length:18},(_,i)=>String(i+19).padStart(3,'0'))].map(x=>'PTV-'+x).sort();
 if(m.targets.length!==25||JSON.stringify(m.targets.map(t=>t.ptv_id).sort())!==JSON.stringify(expected)||m.targets.some(t=>t.initial_profile!=='crew'||t.provisioning_mode!=='INACTIVE_ONLY_NO_LOGIN')||Date.parse(m.expires_at)<=Date.now())throw new Error('Targets/expiry');
 const context=JSON.parse(readFileSync('docs/PTVPRO-PHASE1-LEGACY25-BINARY-CONTEXT.json','utf8'));
 if(!context.fingerprintMatch||context.root!==0||!context.gateOff||context.targetCollisionCount!==0||context.archiveCount!==25||context.crewCapsSha!==m.crew_capabilities_sha256||m.targets.some(t=>context.archiveHashes[t.ptv_id]!==t.archive_sha256))throw new Error('Current target drift');
 const checkpoint=JSON.parse(readFileSync('docs/PTVPRO-PHASE1-LEGACY25-SOURCE-CHECKPOINT.json','utf8'));
 if(sourceDigestForManifest(m)!==checkpoint.digest)throw new Error('Source drift');
 const deps=JSON.parse(readFileSync('docs/PTVPRO-PHASE1-ACC2-TESTING-DEPENDENCIES.json','utf8')).fkDependencies.map(x=>x.dependency.split('.').slice(0,2).join('.'));
 const tables=[...new Set([...context.baselineTables,...deps])].sort();
 const sql=buildBinaryTransportSql(p.sql,{manifestSha:textSha(p.manifest),triggerDigest:context.triggerDigest,surfaceDigest:context.surfaceDigest,baselineTables:tables});
 const evidence=JSON.parse(readFileSync('docs/PTVPRO-PHASE1-LEGACY25-BINARY-LOCAL-RESULTS.json','utf8'));
 if(evidence.passed<30||!evidence.binaryEvidence?.namesAndUsernamesNotFoundInLogs)throw new Error('Local proof incomplete');
 const descriptor={version:'COPY_BINARY_V1',status:'PENDING_NEW_HASH_ACC',executionApproved:false,
  artifactPrefix:'phase1-legacy25-binary-'+randomUUID(),parentSqlSha256:APPROVED_SQL_SHA,
  sqlSha256:textSha(sql),manifestSha256:textSha(p.manifest),postflightSha256:textSha(p.postflight),
  generatedAt:new Date().toISOString(),expiresAt:m.expires_at,operationId:m.operation_id,
  targetCount:25,excludedHoldCount:14,activationHoldCount:39,targetPtvIds:expected,
  expectedRows:{canonical_identity:25,organization_membership:25,user_account:25,account_profiles:25,auth_audit_log:1},
  temporaryRoleSetting:{role:'postgres',name:'auto_explain.log_parameter_max_length',value:'0',restoreOriginal:true},
  unsupportedLoggingSettingsChanged:false,localSqlChecks:evidence.passed,cloudProvisioningExecuted:false};
 const previousPath='docs/PTVPRO-PHASE1-LEGACY25-BINARY-PACKAGE.json';
 if(existsSync(previousPath)){const previous=JSON.parse(readFileSync(previousPath,'utf8'));if(previous.executionApproved===true)throw new Error('Approved descriptor must not be overwritten');descriptor.supersedesUnapprovedSqlSha256=previous.sqlSha256;}
 // stdout is captured by the local DPAPI writer, never displayed by this utility's launcher.
 console.log(JSON.stringify({sql,descriptor}));
}catch{console.log('BINARY_PREPARATION_BLOCKED');process.exitCode=1;}
