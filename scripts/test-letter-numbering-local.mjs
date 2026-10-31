import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// This fixture starts its own loopback-only cluster; it never reads project credentials.
const root = resolve('.gemini/scratch/letters-pg');
const bin = 'C:/Program Files/PostgreSQL/17/bin/';
const port = '55447';
const database = `letters_fixture_${Date.now()}`;
const env = { ...process.env, PGHOST: '127.0.0.1', PGHOSTADDR: '127.0.0.1', PGPORT: port, PGUSER: 'postgres', PGPASSWORD: '', PGSSLMODE: 'disable' };
for (const key of ['PGSERVICE','PGSERVICEFILE','PGOPTIONS','PGPASSFILE','DATABASE_URL']) delete env[key];
const run = (tool, args, options = {}) => spawnSync(bin + tool + '.exe', args, { env, encoding: 'utf8', windowsHide: true, timeout: 60000, ...options });
const args = (db = database) => ['-X','--no-password','-h','127.0.0.1','-p',port,'-U','postgres','-qAt','-v','ON_ERROR_STOP=1','-d',db];
const query = (input, db) => run('psql',args(db),{ input });
const sql = (input, db) => { const result = query(input,db); assert.equal(result.status,0,result.stderr); return result.stdout.trim(); };
const checks = [];
const check = (name, result) => { assert(result,name); checks.push(name); };
const reject = (name, input, reason) => { const r = query(input); check(name,r.status !== 0 && r.stderr.includes(reason)); };
const request = (date = '2026-10-29', extra = {}) => ({
  id: randomUUID(), nama_pemohon: 'Synthetic operator', alasan: 'Synthetic permission',
  tanggal_mulai: date, tanggal_selesai: date, diajukan_oleh: null, disetujui_oleh: null,
  penanggung_jawab: 'Synthetic issuer', santri_list: [{ nama: 'Synthetic A', kelas: 'X', asrama: 'A', jobdesc: 'Camera' }, { nama: 'Synthetic B', kelas: 'XI' }],
  metadata: { colsConfig: { kelas: true }, activePreset: 'sekolah' }, ...extra,
});
const issue = (doc) => `SELECT public.issue_ptv_surat_izin_atomic('${JSON.stringify(doc).replaceAll("'","''")}'::jsonb)`;
const issueAsync = (doc) => new Promise((resolveResult, rejectResult) => {
  const child = spawn(bin+'psql.exe',args(),{ env,windowsHide:true });
  let stdout=''; let stderr=''; child.stdout.on('data',x=>stdout+=x); child.stderr.on('data',x=>stderr+=x);
  child.on('error',rejectResult); child.on('close',code=>code===0 ? resolveResult(JSON.parse(stdout.trim())) : rejectResult(new Error(stderr)));
  child.stdin.end('SET ROLE service_role; '+issue(doc));
});
let started=false; let created=false;
try {
  mkdirSync(root,{ recursive:true });
  if (!existsSync(join(root,'PG_VERSION'))) assert.equal(run('initdb',['-D',root,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C']).status,0);
  assert.notEqual(run('pg_ctl',['-D',root,'status']).status,0,'Fixture cluster already running; refusing interference');
  const start = run('pg_ctl',['-D',root,'-l',join(root,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -c max_connections=40`,'-w','start'], { stdio: 'ignore' });
  assert.equal(start.status,0,start.stderr); started=true;
  sql(`CREATE DATABASE ${database}`,'postgres'); created=true;
  check('isolated local database',sql(`SELECT current_database()='${database}' AND inet_server_addr()='127.0.0.1'::inet`)==='t');
  sql(`DO $$BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
    IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
    IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END$$;
    CREATE TABLE public.ptv_surat_izin(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),nomor_surat varchar(64) NOT NULL UNIQUE,
    nama_pemohon text NOT NULL,alasan text NOT NULL,tanggal_mulai date NOT NULL,tanggal_selesai date NOT NULL,
    disetujui_oleh uuid,status text NOT NULL DEFAULT 'diajukan',created_at timestamptz NOT NULL DEFAULT now(),diajukan_oleh uuid,
    santri_list jsonb,qr_token text,metadata jsonb,jenis_surat text,penanggung_jawab text,review_note text,updated_at timestamptz DEFAULT now());
    CREATE TABLE public.ptv_surat_tugas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),nomor_surat text,status text);
    CREATE TABLE public.ptv_surat_barang(LIKE public.ptv_surat_tugas INCLUDING ALL);
    GRANT USAGE ON SCHEMA public TO service_role;
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.ptv_surat_izin,public.ptv_surat_tugas,public.ptv_surat_barang TO service_role;
    INSERT INTO public.ptv_surat_izin(nomor_surat,nama_pemohon,alasan,tanggal_mulai,tanggal_selesai,status)
    SELECT lpad(n::text,3,'0')||'/SI-PTV/X/2026','Synthetic','Historical','2026-10-01','2026-10-01','disetujui' FROM unnest(ARRAY[1,7,9,11]) n;`);
  const baseline = sql('SELECT md5(jsonb_agg(to_jsonb(s) ORDER BY id)::text) FROM public.ptv_surat_izin s');
  const migration = readFileSync('supabase/migrations/20261029091743_annual_letter_numbering.sql','utf8');
  sql(`INSERT INTO public.ptv_surat_izin(nomor_surat,nama_pemohon,alasan,tanggal_mulai,tanggal_selesai,status)
    VALUES('011/SI-PTV/XI/2026','Synthetic','Conflict','2026-11-01','2026-11-01','disetujui')`);
  reject('conflicting historical sequence halts migration',migration,'LETTER_HISTORY_CONFLICT_REVIEW_REQUIRED');
  sql(`DELETE FROM public.ptv_surat_izin WHERE nomor_surat='011/SI-PTV/XI/2026'`);
  sql(migration); sql(migration);
  check('migration repeatable and history unchanged',sql('SELECT md5(jsonb_agg(to_jsonb(s) ORDER BY id)::text) FROM public.ptv_surat_izin s')===baseline);
  reject('anonymous RPC denied',`SET ROLE anon; ${issue(request())}`,'permission denied');
  reject('authenticated RPC denied',`SET ROLE authenticated; ${issue(request())}`,'permission denied');
  const firstRequest=request(); const first=JSON.parse(sql('SET ROLE service_role; '+issue(firstRequest)));
  check('highest historical plus one',first.nomor_surat==='012/SI-PTV/X/2026');
  check('multi-santri object and metadata retained',first.santri_list.length===2 && first.santri_list[0].kelas==='X' && first.metadata.activePreset==='sekolah');
  check('idempotent retry returns same document',JSON.parse(sql(issue(firstRequest))).nomor_surat===first.nomor_surat);
  reject('changed retry rejected',issue({...firstRequest,alasan:'changed'}),'LETTER_REQUEST_CONFLICT');
  const november=JSON.parse(sql(issue(request('2026-11-01'))));
  check('month does not reset',november.nomor_surat==='013/SI-PTV/XI/2026');
  sql(`UPDATE public.ptv_surat_izin SET status='batal' WHERE id='${november.id}'`);
  const december=JSON.parse(sql(issue(request('2026-12-01'))));
  check('cancelled number never reused',december.nomor_surat==='014/SI-PTV/XII/2026');
  sql(`DELETE FROM public.ptv_surat_izin WHERE id='${december.id}'`);
  const afterDelete=JSON.parse(sql(issue(request())));
  check('deleted highest never reused',afterDelete.nomor_surat==='015/SI-PTV/X/2026');
  const nextYear=JSON.parse(sql(issue(request('2027-01-01'))));
  check('calendar year resets',nextYear.nomor_surat==='001/SI-PTV/I/2027');
  sql(`INSERT INTO public.ptv_surat_tugas(nomor_surat,status) VALUES('001/ST-PTV/X/2026','disetujui')`);
  check('type separated',JSON.parse(sql(`SELECT public.ptv_letter_preview('ST','2026-11-01')`)).sequence===2);
  reject('number cannot change',`UPDATE public.ptv_surat_izin SET nomor_surat='099/SI-PTV/X/2026' WHERE id='${first.id}'`,'LETTER_NUMBER_IMMUTABLE');
  reject('registry cannot be deleted','DELETE FROM public.ptv_issued_letter_registry','LETTER_REGISTRY_IMMUTABLE');
  reject('registry cannot be truncated','TRUNCATE public.ptv_issued_letter_registry','LETTER_REGISTRY_IMMUTABLE');
  reject('failed document write',issue(request('2026-10-29',{nama_pemohon:null})),'null value');
  check('failed write rolls back number',JSON.parse(sql(`SELECT public.ptv_letter_preview('SI','2026-10-29')`)).sequence===16);
  reject('santri names alone rejected',issue(request('2026-10-29',{santri_list:['Synthetic']})),'SANTRI_OBJECTS_REQUIRED');
  const draftId=randomUUID();
  sql(`INSERT INTO public.ptv_surat_izin(id,nomor_surat,nama_pemohon,alasan,tanggal_mulai,tanggal_selesai,status)
    VALUES('${draftId}','—','Synthetic','Draft','2028-02-01','2028-02-01','menunggu')`);
  const approved=JSON.parse(sql(`SET ROLE service_role; SELECT public.approve_ptv_surat_izin_atomic('${draftId}',NULL,'Synthetic',NULL)`));
  check('draft approval allocates atomically',approved.nomor_surat==='001/SI-PTV/II/2028');
  check('approval retry preserves number',JSON.parse(sql(`SELECT public.approve_ptv_surat_izin_atomic('${draftId}',NULL,'Other issuer',NULL)`)).penanggung_jawab==='Synthetic');
  const parallel=await Promise.all(Array.from({length:16},()=>issueAsync(request())));
  const seqs=parallel.map(d=>Number(d.nomor_surat.split('/')[0])).sort((a,b)=>a-b);
  check('16 concurrent issuances unique and consecutive',JSON.stringify(seqs)===JSON.stringify(Array.from({length:16},(_,i)=>16+i)));
  const retry=request(); const retries=await Promise.all(Array.from({length:8},()=>issueAsync(retry)));
  check('8 concurrent identical retries allocate once',new Set(retries.map(d=>d.nomor_surat)).size===1 && retries[0].nomor_surat==='032/SI-PTV/X/2026');
  sql(`DELETE FROM public.ptv_surat_izin WHERE id='${retry.id}'`);
  reject('deleted request cannot be recreated',issue(retry),'LETTER_REQUEST_DELETED');
  sql(`INSERT INTO public.ptv_surat_izin(nomor_surat,nama_pemohon,alasan,tanggal_mulai,tanggal_selesai,status) VALUES('1000/SI-PTV/X/2026','Synthetic','Manual','2026-10-01','2026-10-01','disetujui')`);
  check('four-digit allocation retained',JSON.parse(sql(issue(request()))).nomor_surat==='1001/SI-PTV/X/2026');
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
} finally {
  if(created) sql(`DROP DATABASE ${database}`,'postgres');
  if(started) assert.equal(run('pg_ctl',['-D',root,'-m','fast','-w','stop']).status,0);
}
