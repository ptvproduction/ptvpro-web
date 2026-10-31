import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

if (process.argv.length !== 2) throw new Error('No connection arguments accepted.');
const root = resolve('.gemini/scratch/inventory167-pg');
const allowed = resolve('.gemini/scratch') + '\\';
assert(root.startsWith(allowed));
const bin = 'C:/Program Files/PostgreSQL/17/bin/';
const marker = join(root, 'inventory167-local-only.marker');
const database = `inventory167_fixture_${Date.now()}`;
const env = { ...process.env, PGHOST: '127.0.0.1', PGHOSTADDR: '127.0.0.1', PGPORT: '55439', PGUSER: 'postgres',
  PGDATABASE: database, PGPASSWORD: '', PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '5', PGAPPNAME: 'PTVPRO-167-ISOLATED' };
for (const key of ['PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS', 'PGPASSFILE']) delete env[key];
const run = (name, args, extra = {}) => spawnSync(bin + name, args, { env, encoding: 'utf8', windowsHide: true, timeout: 60000, ...extra });
const query = (input, db = database) => run('psql.exe', ['-X', '--no-password', '-h', '127.0.0.1', '-p', '55439', '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1', '-d', db], { input });
const sql = (input, db = database) => { const result = query(input, db); if (result.status !== 0) throw new Error('LOCAL_SQL_FAILED'); return result.stdout.trim(); };
const checks = [];
const check = (name, value) => { assert(value, name); checks.push(name); };
const reject = (name, input, reason) => { const result = query(input); check(name, result.status !== 0 && result.stderr.includes(reason)); };
const migration = readFileSync('docs/PTVPRO-INVENTORY-167-VALUATION-MIGRATION.sql', 'utf8');
const undo = readFileSync('docs/PTVPRO-INVENTORY-167-VALUATION-ROLLBACK.sql', 'utf8');
const candidate = readFileSync('docs/PTVPRO-INVENTORY-166-CUTOVER-CANDIDATE.sql', 'utf8');
const rollback = readFileSync('docs/PTVPRO-INVENTORY-166-ROLLBACK.sql', 'utf8');
const snapshot = JSON.parse(readFileSync('docs/PTVPRO-INVENTORY-166-ACL-SNAPSHOT.json', 'utf8'));
const ownIndex = 'public.ptv_nilai_inventaris_asset_unique_167';
const dataDigest = () => sql("SELECT md5(coalesce(jsonb_agg(to_jsonb(v) ORDER BY id),'[]'::jsonb)::text) FROM public.ptv_nilai_inventaris v");
const grants = () => sql("SELECT md5(string_agg(relname||coalesce(relacl::text,''),'|' ORDER BY relname)) FROM pg_class WHERE oid IN ('public.ptv_inventaris'::regclass,'public.ptv_inventaris_unit'::regclass,'public.ptv_nilai_inventaris'::regclass)");
const aclState = () => sql("SELECT md5(jsonb_build_object('tables',(SELECT jsonb_agg(jsonb_build_object('n',c.relname,'to',a.grantee,'by',a.grantor,'p',a.privilege_type,'g',a.is_grantable) ORDER BY c.relname,a.grantee,a.grantor,a.privilege_type) FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid IN ('public.ptv_inventaris'::regclass,'public.ptv_inventaris_unit'::regclass,'public.ptv_nilai_inventaris'::regclass)),'rpc',(SELECT jsonb_agg(jsonb_build_object('n',p.oid::regprocedure::text,'to',a.grantee,'by',a.grantor,'p',a.privilege_type,'g',a.is_grantable) ORDER BY p.oid::regprocedure::text,a.grantee,a.grantor,a.privilege_type) FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.pronamespace='public'::regnamespace AND p.proname LIKE 'rpc_%'),'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_policies p WHERE schemaname='storage'))::text)");
let started = false; let created = false; let phase = 'local_cluster'; let success = false;
try {
  if (existsSync(join(root, 'PG_VERSION'))) {
    assert(existsSync(marker) && readFileSync(marker, 'utf8') === 'SYNTHETIC_INVENTORY167_ONLY');
  } else {
    mkdirSync(root, { recursive: true });
    const init = run('initdb.exe', ['-D', root, '-U', 'postgres', '--auth-local=trust', '--auth-host=trust', '--encoding=UTF8', '--no-locale']);
    assert(init.status === 0, 'Cannot initialize dedicated synthetic cluster.');
    writeFileSync(marker, 'SYNTHETIC_INVENTORY167_ONLY');
  }
  assert(run('pg_ctl.exe', ['-D', root, 'status']).status !== 0, 'Do not control an existing running server.');
  assert(run('pg_ctl.exe', ['-D', root, '-l', join(root, 'server.log'), '-o', '-h 127.0.0.1 -p 55439 -c max_connections=20', '-w', 'start'], { stdio: 'ignore' }).status === 0);
  started = true;
  sql(`CREATE DATABASE ${database};`, 'postgres'); created = true;
  check('loopback isolated database verified', sql(`SELECT inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=55439 AND current_database()='${database}'`) === 't');
  sql(`CREATE TABLE public.inventory167_fixture(marker text NOT NULL); INSERT INTO public.inventory167_fixture VALUES('SYNTHETIC_ONLY');
    CREATE TABLE public.ptv_inventaris(id uuid PRIMARY KEY, name text);
    CREATE TABLE public.ptv_inventaris_unit(id uuid PRIMARY KEY,inventaris_id uuid REFERENCES public.ptv_inventaris(id));
    CREATE TABLE public.ptv_nilai_inventaris(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),inventaris_id uuid NOT NULL REFERENCES public.ptv_inventaris(id),
      nilai_perolehan numeric NOT NULL DEFAULT 0,nilai_buku_saat_ini numeric NOT NULL DEFAULT 0,vendor text,nomor_invoice text,status text DEFAULT 'Aktif',nilai_residu numeric DEFAULT 0);
    CREATE TABLE public.auth_audit_log(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,event_type text,metadata jsonb);
    INSERT INTO public.ptv_inventaris VALUES('10000000-0000-4000-8000-000000000001','SYNTHETIC_A'),('10000000-0000-4000-8000-000000000002','SYNTHETIC_B');
    INSERT INTO public.ptv_nilai_inventaris(inventaris_id,nilai_perolehan,vendor,nomor_invoice) VALUES('10000000-0000-4000-8000-000000000001',10,'SYNTHETIC_VENDOR','SYN-BASE');
    INSERT INTO public.auth_audit_log(event_type,metadata) VALUES('synthetic_history','{"marker":"preserve"}');
    DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$;
    GRANT ALL ON public.ptv_inventaris,public.ptv_inventaris_unit,public.ptv_nilai_inventaris TO anon,authenticated,service_role;`);
  const initialData = dataDigest(); const initialGrants = grants();
  const upsert = (amount, invoice) => `INSERT INTO public.ptv_nilai_inventaris(inventaris_id,nilai_perolehan,nilai_buku_saat_ini,vendor,nomor_invoice,status,nilai_residu)
    VALUES('10000000-0000-4000-8000-000000000002',${amount},0,'SYNTHETIC_VENDOR','${invoice}','Dihapuskan',0)
    ON CONFLICT(inventaris_id) DO UPDATE SET nilai_perolehan=excluded.nilai_perolehan,nilai_buku_saat_ini=excluded.nilai_buku_saat_ini,
      vendor=excluded.vendor,nomor_invoice=excluded.nomor_invoice,status=excluded.status,nilai_residu=excluded.nilai_residu RETURNING id;`;
  phase = 'valuation_migration';
  reject('baseline reproduces42P10', '\\set VERBOSITY sqlstate\n' + upsert(100, 'SYN-1'), '42P10');
  sql(migration); const indexOid = sql(`SELECT '${ownIndex}'::regclass::oid`);
  check('migration preserves initial rows', dataDigest() === initialData);
  sql(migration); check('idempotent migration keeps same index', sql(`SELECT '${ownIndex}'::regclass::oid`) === indexOid);
  const valueId = sql(upsert(100, 'SYN-1'));
  check('valuation insert acknowledged', /^[a-f0-9-]{36}$/.test(valueId));
  check('update preserves row identity', sql(upsert(200, 'SYN-2')) === valueId);
  check('retry preserves identity', sql(upsert(200, 'SYN-2')) === valueId);
  check('one row per asset and metadata/zero preserved', sql("SELECT count(*)=1 AND bool_and(nilai_perolehan=200 AND nilai_buku_saat_ini=0 AND vendor='SYNTHETIC_VENDOR' AND nomor_invoice='SYN-2' AND status='Dihapuskan' AND nilai_residu=0) FROM ptv_nilai_inventaris WHERE inventaris_id='10000000-0000-4000-8000-000000000002'") === 't');
  const beforeUndo = dataDigest(); sql(undo); sql(undo);
  check('schema rollback idempotent and data intact', sql(`SELECT to_regclass('${ownIndex}') IS NULL`) === 't' && dataDigest() === beforeUndo);
  check('history preserved across migration and rollback', sql("SELECT count(*)=1 AND bool_and(metadata->>'marker'='preserve') FROM auth_audit_log") === 't');
  check('valuation migration never changes grants', grants() === initialGrants);
  sql(`INSERT INTO ptv_nilai_inventaris(inventaris_id) VALUES('10000000-0000-4000-8000-000000000001');`);
  const duplicateDigest = dataDigest();
  reject('duplicates stop migration without deduplication', migration, 'VALUATION167_DUPLICATE_KEY');
  check('duplicate rejection preserves data', dataDigest() === duplicateDigest);
  sql("DELETE FROM ptv_nilai_inventaris WHERE inventaris_id='10000000-0000-4000-8000-000000000001' AND vendor IS NULL;");
  sql('CREATE UNIQUE INDEX ptv_nilai_inventaris_asset_unique_167 ON ptv_nilai_inventaris(id);');
  reject('reserved-name collision is rejected', migration, 'VALUATION167_RESERVED_NAME_COLLISION');
  reject('rollback refuses an unowned index', undo, 'VALUATION167_ROLLBACK_NOT_OWNED');
  sql('DROP INDEX public.ptv_nilai_inventaris_asset_unique_167; CREATE UNIQUE INDEX fixture_existing_asset_unique ON ptv_nilai_inventaris(inventaris_id);');
  sql(migration); sql(undo);
  check('equivalent existing index reused and never removed', sql("SELECT to_regclass('public.fixture_existing_asset_unique') IS NOT NULL AND to_regclass('public.ptv_nilai_inventaris_asset_unique_167') IS NULL") === 't');
  sql('DROP INDEX public.fixture_existing_asset_unique;'); sql(migration);
  sql("CREATE TABLE dependency_fixture(asset uuid REFERENCES ptv_nilai_inventaris(inventaris_id));");
  reject('rollback RESTRICT protects new dependencies', undo, 'depend');
  sql('DROP TABLE dependency_fixture;'); sql(undo);
  phase = 'cutover_rehearsal';
  sql(`CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
    INSERT INTO storage.objects(bucket_id,name) VALUES('inventory','SYNTHETIC_CATALOG'),('finance-proofs','SYNTHETIC_OTHER_BUCKET');
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
    GRANT ALL ON storage.objects TO anon,authenticated,service_role;
    CREATE POLICY inventory_public_view ON storage.objects FOR SELECT TO PUBLIC USING(bucket_id='inventory');
    CREATE POLICY fixture_other_bucket ON storage.objects FOR ALL TO authenticated USING(bucket_id='finance-proofs') WITH CHECK(bucket_id='finance-proofs');`);
  for (const rpc of snapshot.rpc_acls) {
    sql(`CREATE FUNCTION public.${rpc.name}(${rpc.args}) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';
      REVOKE ALL ON FUNCTION public.${rpc.name}(${rpc.args}) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.${rpc.name}(${rpc.args}) TO authenticated;`);
    if (rpc.acl.includes('service_role=')) sql(`GRANT EXECUTE ON FUNCTION public.${rpc.name}(${rpc.args}) TO service_role;`);
  }
  const baselineAcl = aclState();
  reject('unapproved166 candidate stops unchanged', candidate, 'NO_GO_166');
  check('NO-GO barrier preserves ACL/policies', aclState() === baselineAcl);
  check('synthetic clone marker required before rendering local candidate', sql("SELECT marker='SYNTHETIC_ONLY' FROM inventory167_fixture") === 't');
  const barrier = "DO $$ BEGIN RAISE EXCEPTION 'NO_GO_166: valuation42P10, restricted-account proof, shared-report dependency and activation unresolved'; END $$;";
  assert(candidate.split(barrier).length === 2);
  const localOnly = candidate.replace(barrier, '');
  sql(localOnly);
  check('local cutover closes direct table grants', sql("SELECT NOT has_table_privilege('anon','ptv_inventaris','SELECT') AND NOT has_table_privilege('authenticated','ptv_nilai_inventaris','UPDATE')") === 't');
  check('local cutover closes native function while preserving server', sql("SELECT NOT has_function_privilege('authenticated','rpc_create_inventaris(jsonb,jsonb)','EXECUTE') AND has_function_privilege('service_role','rpc_create_inventaris(jsonb,jsonb)','EXECUTE') AND has_table_privilege('service_role','ptv_inventaris','SELECT')") === 't');
  check('inventory metadata hidden under restrictive policy', sql("SET ROLE anon; SELECT count(*) FROM storage.objects WHERE bucket_id='inventory'; RESET ROLE;") === '0');
  check('other bucket access is unchanged', sql("SET ROLE authenticated; SELECT count(*) FROM storage.objects WHERE bucket_id='finance-proofs'; RESET ROLE;") === '1');
  reject('rollback requires explicit approval even locally', rollback, 'Explicit matching Staging rollback approval required');
  sql("SET ptv.inventory166.rollback_approved='swadgljnyelsjstqqxbm';\n" + rollback);
  check('local rollback restores exact ACL/policy model', aclState() === baselineAcl);
  sql("SET ptv.inventory166.rollback_approved='swadgljnyelsjstqqxbm';\n" + rollback);
  check('repeat cutover rollback is idempotent', aclState() === baselineAcl);
  check('all valuation data preserved after cutover rehearsal', dataDigest() === beforeUndo);
  success = true;
} catch (error) {
  process.stderr.write(JSON.stringify({ phase, pass: false, check: error instanceof assert.AssertionError ? error.message : 'LOCAL_SQL_FAILED' }) + '\n');
  process.exitCode = 1;
} finally {
  let cleaned = true;
  if (created) cleaned = query(`DROP DATABASE ${database};`, 'postgres').status === 0;
  if (started) cleaned = run('pg_ctl.exe', ['-D', root, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' }).status === 0 && cleaned;
  const result = { scope: 'LOCAL_POSTGRESQL17_SYNTHETIC_STAGING_MODEL_ONLY', cloudDdlOrPrivilegeExecuted: false,
    status: success && cleaned ? 'PASS' : 'FAIL', checksPassed: checks.length, checks, ownDatabaseRemoved: cleaned,
    ownServerStopped: !started || cleaned, migrationSha256: createHash('sha256').update(migration).digest('hex'), rollbackSha256: createHash('sha256').update(undo).digest('hex') };
  writeFileSync('docs/PTVPRO-INVENTORY-167-LOCAL-RESULTS.json', JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify(result) + '\n'); if (!cleaned) process.exitCode = 1;
}
