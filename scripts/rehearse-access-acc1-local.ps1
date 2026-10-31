# Dot-sourced only by the verified DEV155 restore consumer, with data retained in memory.
$phase='ACC1-BASELINE'
$accChecks=New-Object 'Collections.Generic.List[string]'
function Check-Acc1([string]$Name,[bool]$Condition){if(-not $Condition){throw ('ACC1 check failed: '+$Name)};$accChecks.Add($Name)}
function Query-Acc1([string]$Sql){return Invoke-Clone @('psql','-h','/tmp','-U','postgres','-d','dev155_restore','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate') $Sql}
function Reject-Acc1([string]$Name,[string]$Sql){$failed=$false;try{$null=Query-Acc1 $Sql}catch{$failed=$true};Check-Acc1 $Name $failed}
function Render-Acc1([string]$Text){return $Text.Replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__',$clusterId)}
function Hash-Text([string]$Text){$sha=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
function Core-Json($Value){return ConvertTo-Json -InputObject $Value -Depth 80 -Compress}
$clusterId=(Query-Acc1 'SELECT system_identifier::text FROM pg_control_system();').Trim()
Check-Acc1 'trusted local cluster identifier' ($clusterId -match '^\d{10,25}$')
Check-Acc1 'restored owner remains NOSUPERUSER with BYPASSRLS' ((Query-Acc1 "SELECT (NOT rolsuper) AND rolbypassrls FROM pg_roles WHERE rolname='postgres';").Trim() -eq 't')
Check-Acc1 'native dependency and owner read permission' ((Query-Acc1 "SELECT has_table_privilege('postgres','auth.sessions','SELECT') AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='auth' AND table_name='sessions' AND column_name='not_after');").Trim() -eq 't')
$baseline=Query-Acc1 "SELECT jsonb_build_object('roots',(SELECT count(*) FROM public.account_profiles WHERE profile_id='root_executive'),'audit',(SELECT count(*) FROM public.auth_audit_log),'accounts',(SELECT count(*) FROM public.user_account),'credentials',(SELECT count(*) FROM public.auth_credentials),'native_sessions',(SELECT count(*) FROM auth.sessions),'linked',(SELECT count(*) FROM public.legacy_archive_kru WHERE canonical_identity_id IS NOT NULL));"
Check-Acc1 'Root absent before installation' (($baseline|ConvertFrom-Json).roots -eq 0)
$defaultBefore=Query-Acc1 'SELECT coalesce(jsonb_agg(jsonb_build_array(defaclrole,defaclnamespace,defaclobjtype,defaclacl) ORDER BY oid),''[]''::jsonb) FROM pg_default_acl;'
$inheritedService=(Query-Acc1 "SELECT EXISTS(SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a WHERE d.defaclrole='postgres'::regrole AND d.defaclobjtype='f' AND a.grantee='service_role'::regrole AND a.privilege_type='EXECUTE');").Trim() -eq 't'
$prep=[IO.File]::ReadAllText((Join-Path (Get-Location) 'docs/PTVPRO-ACCESS-149-PREBOOTSTRAP-BUNDLE.sql'))
$native=[IO.File]::ReadAllText((Join-Path (Get-Location) 'docs/PTVPRO-ACCESS-152-NATIVE-SESSION-PROPOSAL.sql'))
$lifecycle=[IO.File]::ReadAllText((Join-Path (Get-Location) 'docs/PTVPRO-ACCESS-PHASE1-AUTH-PROPOSAL.sql'))
$phase='ACC1-TARGET-GUARDS'
Reject-Acc1 'unrendered149 rejected' $prep
Reject-Acc1 'wrong physical target149 rejected' ($prep.Replace('__APPROVED_DATABASE_SYSTEM_IDENTIFIER__','0'))
Reject-Acc1 'service role cannot install149' ('SET ROLE service_role;'+(Render-Acc1 $prep))
Check-Acc1 'target guard failures created no schema' ((Query-Acc1 "SELECT to_regnamespace('ptv_access_private') IS NULL;").Trim() -eq 't')
Reject-Acc1 'late149 installation fault rolls back all DDL and grants' ((Render-Acc1 $prep).Replace('COMMIT;',"SELECT 1/0;`nCOMMIT;"))
Check-Acc1 'failed149 transaction leaves original schemas and defaults intact' (((Query-Acc1 "SELECT to_regnamespace('ptv_access_private') IS NULL;").Trim() -eq 't') -and ((Query-Acc1 'SELECT coalesce(jsonb_agg(jsonb_build_array(defaclrole,defaclnamespace,defaclobjtype,defaclacl) ORDER BY oid),''[]''::jsonb) FROM pg_default_acl;') -ceq $defaultBefore))
$phase='ACC1-INSTALL149'
$null=Query-Acc1 (Render-Acc1 $prep)
$closed="SELECT NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN (VALUES('anon'),('authenticated'),('service_role'))r(role) WHERE (n.nspname='ptv_access_private' OR (n.nspname='public' AND p.proname IN ('rpc_manage_account_access','rpc_update_crew_personnel'))) AND has_function_privilege(r.role,p.oid,'EXECUTE'));"
Check-Acc1 '149 closes effective EXECUTE including default grants' ((Query-Acc1 $closed).Trim() -eq 't')
Check-Acc1 '149 removes direct writes on all nine access stores' ((Query-Acc1 "SELECT NOT EXISTS(SELECT 1 FROM (VALUES('user_account'),('account_profiles'),('account_capability_overrides'),('auth_credentials'),('organization_membership'),('canonical_identity'),('access_profile'),('capability_registry'),('profile_capabilities'))t(name) CROSS JOIN (VALUES('anon'),('authenticated'),('service_role'))r(role) WHERE has_table_privilege(r.role,'public.'||t.name,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'));").Trim() -eq 't')
Reject-Acc1 '149 replay refused without replacing later helpers' (Render-Acc1 $prep)
$phase='ACC1-INSTALL152'
$null=Query-Acc1 (Render-Acc1 $native)
Check-Acc1 '152 keeps management RPC closed' ((Query-Acc1 $closed).Trim() -eq 't')
Check-Acc1 '152 helper checks native deadline and stored session' ((Query-Acc1 "SELECT pg_get_functiondef('public.has_capability(text)'::regprocedure) LIKE '%not_after%' AND pg_get_functiondef('public.has_capability(text)'::regprocedure) LIKE '%auth.sessions%';").Trim() -eq 't')
$phase='ACC1-INSTALL-LIFECYCLE'
$null=Query-Acc1 (Render-Acc1 $lifecycle)
Check-Acc1 'lifecycle default disabled' ((Query-Acc1 'SELECT count(*)=1 AND bool_and(NOT enabled) FROM ptv_auth_private.policy;').Trim() -eq 't')
Check-Acc1 'lifecycle creates no attempt or session' ((Query-Acc1 'SELECT NOT EXISTS(SELECT FROM ptv_auth_private.attempts) AND NOT EXISTS(SELECT FROM ptv_auth_private.sessions) AND NOT EXISTS(SELECT FROM ptv_auth_private.buckets);').Trim() -eq 't')
Check-Acc1 'private lifecycle tables RLS enabled and clients have no direct grants' ((Query-Acc1 "SELECT count(DISTINCT c.oid)=4 AND bool_and(c.relrowsecurity) AND bool_and(NOT has_table_privilege(r.role,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN (VALUES('anon'),('authenticated'),('service_role'))r(role) WHERE n.nspname='ptv_auth_private' AND c.relkind='r';").Trim() -eq 't')
Check-Acc1 'private lifecycle functions not client callable' ((Query-Acc1 "SELECT NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN (VALUES('anon'),('authenticated'),('service_role'))r(role) WHERE n.nspname='ptv_auth_private' AND has_function_privilege(r.role,p.oid,'EXECUTE'));").Trim() -eq 't')
Check-Acc1 'five public lifecycle RPCs only service executable' ((Query-Acc1 "SELECT count(*)=5 AND bool_and(has_function_privilege('service_role',p.oid,'EXECUTE')) AND bool_and(NOT has_function_privilege('anon',p.oid,'EXECUTE')) AND bool_and(NOT has_function_privilege('authenticated',p.oid,'EXECUTE')) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('rpc_portal_login_begin','rpc_portal_login_finish','rpc_portal_session_valid','rpc_portal_session_revoke','rpc_portal_google_session');").Trim() -eq 't')
Check-Acc1 'lifecycle leaves account/personnel management closed' ((Query-Acc1 $closed).Trim() -eq 't')
Check-Acc1 'existing default privileges unchanged' ((Query-Acc1 'SELECT coalesce(jsonb_agg(jsonb_build_array(defaclrole,defaclnamespace,defaclobjtype,defaclacl) ORDER BY oid),''[]''::jsonb) FROM pg_default_acl;') -ceq $defaultBefore)
$phase='ACC1-INTEGRITY'
$metadataAfter=(Query-Clone $checks)|ConvertFrom-Json
foreach($section in @('constraints','policies','roles','memberships','sequences')){
 Check-Acc1 ('existing '+$section+' unchanged') ((Core-Json $after.$section) -ceq (Core-Json $metadataAfter.$section))
}
$oldStructure=@($after.tables|Select-Object name,owner,rls,force_rls,columns)
$newStructure=@($metadataAfter.tables|Select-Object name,owner,rls,force_rls,columns)
Check-Acc1 'existing columns table owners and RLS flags unchanged' ((Core-Json $oldStructure) -ceq (Core-Json $newStructure))
$existingIndexes=@($metadataAfter.indexes|Where-Object{$_.name -ne 'auth_password_enrollment_operation'})
Check-Acc1 'all existing indexes unchanged plus one intended audit index' (((Core-Json @($after.indexes)) -ceq (Core-Json $existingIndexes)) -and @($metadataAfter.indexes|Where-Object{$_.name -eq 'auth_password_enrollment_operation'}).Count -eq 1)
$retainedFunctions=$true
foreach($fn in @($after.functions|Where-Object{$_.signature -ne 'has_capability(text)'})){
 $same=@($metadataAfter.functions|Where-Object{$_.signature -ceq $fn.signature})
 if($same.Count -ne 1 -or (Core-Json $same[0]) -cne (Core-Json $fn)){$retainedFunctions=$false}
}
Check-Acc1 'preexisting functions except intended has_capability preserved' $retainedFunctions
$retainedTriggers=$true
foreach($trigger in @($after.triggers)){
 $same=@($metadataAfter.triggers|Where-Object{$_.table -ceq $trigger.table -and $_.name -ceq $trigger.name})
 if($same.Count -ne 1 -or (Core-Json $same[0]) -cne (Core-Json $trigger)){$retainedTriggers=$false}
}
Check-Acc1 'preexisting triggers preserved' $retainedTriggers
$phase='ACC1-PREFLIGHT-SYNTAX'
$preflight=[IO.File]::ReadAllText((Join-Path (Get-Location) 'docs/PTVPRO-PHASE1-ACC1-PREFLIGHT-READONLY.sql'))
$null=Query-Acc1 $preflight
Check-Acc1 'prepared read-only preflight executes on actual restored schema, not cloud' $true
$phase='ACC1-INTEGRITY'
$post=Query-Acc1 "SELECT jsonb_build_object('roots',(SELECT count(*) FROM public.account_profiles WHERE profile_id='root_executive'),'audit',(SELECT count(*) FROM public.auth_audit_log),'accounts',(SELECT count(*) FROM public.user_account),'credentials',(SELECT count(*) FROM public.auth_credentials),'native_sessions',(SELECT count(*) FROM auth.sessions),'linked',(SELECT count(*) FROM public.legacy_archive_kru WHERE canonical_identity_id IS NOT NULL));"
Check-Acc1 'account credential session audit linking Root counts unchanged' ($post -ceq $baseline)
$afterCopy=0;$afterMismatch=0
for($n=0;$n -lt $lines.Length;$n++){
 if($lines[$n] -match '^COPY (.+?) \((.*?)\) FROM stdin;$'){
  $table=$matches[1];$columns=$matches[2];$expected=New-Object 'Collections.Generic.List[string]';$n++
  while($n -lt $lines.Length -and $lines[$n] -cne '\.'){$expected.Add($lines[$n]);$n++}
  $actual=Query-Clone ('COPY '+$table+' ('+$columns+') TO STDOUT;')
  $actualRows=[string[]]@();if($actual.Length){$actualRows=[string[]]($actual.TrimEnd("`n").TrimEnd("`r") -split "\r?\n")}
  $expectedRows=[string[]]$expected.ToArray()
  if($expectedRows.Count -ne $actualRows.Count -or (Row-Digest $expectedRows) -cne (Row-Digest $actualRows)){$afterMismatch++}
  $afterCopy++
 }
}
Check-Acc1 'all103 restored table rowsets unchanged after proposals' ($afterCopy -eq 103 -and $afterMismatch -eq 0)
$phase='ACC1-CONTAINMENT'
$contain=[IO.File]::ReadAllText((Join-Path (Get-Location) 'docs/PTVPRO-ACCESS-PHASE1-AUTH-CONTAINMENT.sql'))
$null=Query-Acc1 (Render-Acc1 $contain)
Check-Acc1 'lifecycle containment keeps policy disabled and management closed' (((Query-Acc1 'SELECT NOT enabled FROM ptv_auth_private.policy;').Trim() -eq 't') -and ((Query-Acc1 $closed).Trim() -eq 't'))
$safe=[IO.File]::ReadAllText((Join-Path (Get-Location) 'docs/PTVPRO-ACCESS-152-SAFE-ROLLBACK.sql'))
$null=Query-Acc1 (Render-Acc1 $safe)
Check-Acc1 '152 safe containment denies native capability' ((Query-Acc1 "SET ROLE authenticated; SELECT public.has_capability('hub.access');").Trim() -eq 'f')
$null=Query-Acc1 (Render-Acc1 $native)
Check-Acc1 '152 forward recovery retains lifecycle and management closure' (((Query-Acc1 $closed).Trim() -eq 't') -and ((Query-Acc1 'SELECT NOT enabled FROM ptv_auth_private.policy;').Trim() -eq 't'))
Check-Acc1 'containment/forward retains all baseline audit and account counts' ((Query-Acc1 "SELECT jsonb_build_object('roots',(SELECT count(*) FROM public.account_profiles WHERE profile_id='root_executive'),'audit',(SELECT count(*) FROM public.auth_audit_log),'accounts',(SELECT count(*) FROM public.user_account),'credentials',(SELECT count(*) FROM public.auth_credentials),'native_sessions',(SELECT count(*) FROM auth.sessions),'linked',(SELECT count(*) FROM public.legacy_archive_kru WHERE canonical_identity_id IS NOT NULL));") -ceq $baseline)
Check-Acc1 'encrypted source snapshot unchanged' ((Get-FileHash -LiteralPath $path).Hash -eq $manifest.sha256)
$evidence=[ordered]@{scope='ACC1 LOCAL CLONE FROM EXISTING DEV155 SNAPSHOT';status='PASS';cloudAccess=$false;realEnrollmentLinkingBootstrap=$false;ownerSuperuser=$false;restoredTables=$copyTables;postMigrationTablesCompared=$afterCopy;rowsetMismatches=$afterMismatch;sourceSnapshotUnchanged=$true;sourceDefaultServiceFunctionGrant=$inheritedService;passed=$accChecks.Count;checks=$accChecks.ToArray();proposalSha256=@{prebootstrap=Hash-Text $prep;access152=Hash-Text $native;lifecycle=Hash-Text $lifecycle};limitations=@('Historical snapshot, not fresh Staging preflight','No Vercel/Auth/PostgREST runtime E2E','Managed platform/Storage bytes outside logical capture')}
[IO.File]::WriteAllText((Join-Path (Get-Location) 'docs/PTVPRO-PHASE1-ACC1-CLONE-RESULTS.json'),($evidence|ConvertTo-Json -Depth 10)+"`n",[Text.UTF8Encoding]::new($false))
Write-Output ('ACC1_RESULT=PASS; checks='+$accChecks.Count+'; unchanged_tables='+$afterCopy+'; cloud_access=False')
