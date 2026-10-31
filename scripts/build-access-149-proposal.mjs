import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import process from 'node:process';

const sources = ['docs/PTVPRO-ACCESS-149-PROPOSAL.sql', 'docs/PTVPRO-ACCESS-149-RLS-PROPOSAL.sql'];
const prepareBootstrap=process.argv.includes('--prepare-bootstrap');
const parts = sources.map(path => {
  const source = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  if ((source.match(/^BEGIN;$/gm) || []).length !== 1 || (source.match(/^COMMIT;$/gm) || []).length !== 1) {
    throw new Error(`Transaction boundaries require manual review: ${path}`);
  }
  return { path, hash: createHash('sha256').update(source).digest('hex'), body: source.replace(/^BEGIN;\n/m, '').replace(/^COMMIT;\n?/m, '') };
});
const header = '-- GENERATED PROPOSAL ONLY. NOT EXECUTED. ACC required; staging swadgljnyelsjstqqxbm only.\n'
  + '-- Regenerate with node scripts/build-access-149-proposal.mjs. Review input hashes before ACC.\n'
  + parts.map(p => `-- ${p.path} sha256=${p.hash}`).join('\n');
let body=parts.map(p=>p.body).join('\n');
let installationGuard='';
if(prepareBootstrap) {
  const guard='DO $$ BEGIN PERFORM ptv_access_private.assert_recovery(); END $$;';
  if(body.split(guard).length!==2) throw new Error('Recovery installation guard requires review.');
  body=body.replace(guard,'-- Bootstrap preparation only: mutation EXECUTE remains revoked until approved bootstrap.');
  body=body.split('\n').filter(line=>!line.startsWith('GRANT EXECUTE ')).join('\n');
  installationGuard=`-- Bind this template to the separately approved physical cluster before execution.
DO $installation$
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres'
 OR coalesce(current_setting('role',true),'none') NOT IN ('none','postgres')
 OR coalesce(current_setting('request.jwt.claims',true),'') NOT IN ('','{}')
 OR (SELECT system_identifier::text FROM pg_control_system()) IS DISTINCT FROM '__APPROVED_DATABASE_SYSTEM_IDENTIFIER__'
 THEN RAISE EXCEPTION 'approved direct administrative target required' USING ERRCODE='42501'; END IF;
 IF to_regnamespace('ptv_access_private') IS NOT NULL THEN RAISE EXCEPTION 'Access149 already present; review drift before replay' USING ERRCODE='42501'; END IF;
END;
$installation$;
`;
  body+=`\n-- Override inherited/default function grants in this transaction; do not change global defaults.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ptv_access_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_manage_account_access(uuid,bigint,jsonb),public.rpc_update_crew_personnel(uuid,bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
DO $closed$
DECLARE r text; f regprocedure;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='ptv_access_private' OR (n.nspname='public' AND p.proname IN ('rpc_manage_account_access','rpc_update_crew_personnel')) LOOP
   IF has_function_privilege(r,f,'EXECUTE') THEN RAISE EXCEPTION 'inherited mutation privilege remains' USING ERRCODE='42501'; END IF;
  END LOOP;
 END LOOP;
END;
$closed$;\n`;
}
const output=prepareBootstrap?'docs/PTVPRO-ACCESS-149-PREBOOTSTRAP-BUNDLE.sql':'docs/PTVPRO-ACCESS-149-STAGING-BUNDLE.sql';
writeFileSync(output, `${header}\n-- Mode: ${prepareBootstrap?'PREBOOTSTRAP: ADMINISTRATIVE WRITES CLOSED':'NORMAL: VERIFIED ROOT/RECOVERY REQUIRED'}\nBEGIN;\n${installationGuard}${body}\nCOMMIT;\n`);
