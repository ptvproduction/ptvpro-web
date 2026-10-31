import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import { hashSync } from 'bcryptjs';
import { authenticatePortalPassword, fingerprintSession, sessionArguments } from '../../api/auth/_utils/portalLifecycle';
import { signSessionToken, verifySessionToken } from '../../api/auth/_utils/crypto';
import logout from '../../api/auth/logout';
import login from '../../api/auth/login';
import type { ApiRequest, ApiResponse, SessionPayload } from '../../api/auth/_utils/types';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), live: vi.fn(), create: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: (...args: unknown[]) => {
 mock.create(...args); return { rpc: mock.rpc, from: () => ({ select: async () => ({data:[{key:'hub.access'}],error:null}) }) };
} }));
vi.mock('../../api/auth/_utils/liveAccess', () => ({ resolveLiveAccess: mock.live }));
const secret='SYNTHETIC-PHASE1-SECRET-ONLY-32-CHARS';
const account='00000000-0000-4000-8000-000000000001',identity='10000000-0000-4000-8000-000000000001';
const password='SYNTHETIC-PHASE1-PASSWORD';
const encoded=hashSync(password,10).replace('$2b$','$2y$');
function payload():SessionPayload {
 const iat=Math.floor(Date.now()/1000);
 return {account_id:account,identity_id:identity,username:'synthetic',full_name:'Synthetic',ptv_id:'SYNTHETIC',status_akun:'active',status_organisasi:'active',assigned_profiles:[],capabilities:['hub.access'],iat,exp:iat+3600};
}
function request():ApiRequest {
 const req=Readable.from([]) as ApiRequest;req.method='POST';req.headers={host:'synthetic.example','x-forwarded-for':'192.0.2.10'};return req;
}
function response(){const headers:Record<string,unknown>={};let body='';const res={statusCode:200,setHeader:(k:string,v:unknown)=>{headers[k.toLowerCase()]=v;},getHeader:(k:string)=>headers[k.toLowerCase()],end:(v?:string)=>{body=v||'';}};return {res:res as unknown as ApiResponse,headers,body:()=>body};}
beforeEach(()=>{
 vi.stubEnv('PTV_AUTH_LIFECYCLE_ENABLED','true');vi.stubEnv('PTV_PASSWORD_LOGIN_ENABLED','true');vi.stubEnv('AUTH_SECRET',secret);
 vi.stubEnv('VITE_SUPABASE_URL','https://swadgljnyelsjstqqxbm.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','SYNTHETIC-NOT-A-KEY');vi.stubEnv('VERCEL','1');
 mock.create.mockClear();mock.rpc.mockReset();mock.live.mockReset();
 mock.rpc.mockImplementation(async(name:string)=>({error:null,data:name==='rpc_portal_login_begin'?{enabled:true,allowed:true,account_id:account,identity_id:identity,hash:encoded,session_seconds:600}:true}));
 mock.live.mockResolvedValue({account:{id:account,username:'synthetic'},identity:{id:identity,ptv_id:'SYNTHETIC',full_name:'Synthetic'},membership:{status_organisasi:'active'},profiles:['crew'],can:(key:string)=>key==='hub.access'});
});
afterEach(()=>vi.unstubAllEnvs());
describe('Phase1 portal lifecycle server adapter (synthetic, not database proof)',()=>{
 it('default-off guard does not query backend',async()=>{vi.stubEnv('PTV_AUTH_LIFECYCLE_ENABLED','false');expect((await authenticatePortalPassword(request(),'synthetic',password)).status).toBe(403);expect(mock.create).not.toHaveBeenCalled();});
 it('password flag independently remains off',async()=>{vi.stubEnv('PTV_PASSWORD_LOGIN_ENABLED','false');expect((await authenticatePortalPassword(request(),'synthetic',password)).status).toBe(403);});
 it('rejects wrong backend before a network call',async()=>{vi.stubEnv('VITE_SUPABASE_URL','https://wrong-project.example');expect((await authenticatePortalPassword(request(),'synthetic',password)).status).toBe(503);expect(mock.create).not.toHaveBeenCalled();});
 it('rejects inadequate signing secret',async()=>{vi.stubEnv('AUTH_SECRET','short');expect((await authenticatePortalPassword(request(),'synthetic',password)).status).toBe(503);expect(mock.rpc).not.toHaveBeenCalled();});
 it.each(['192.0.2.1, 192.0.2.2','not-an-ip',''])('rejects untrusted ingress %s',async value=>{const req=request();req.headers['x-forwarded-for']=value;expect((await authenticatePortalPassword(req,'synthetic',password)).status).toBe(503);expect(mock.rpc).not.toHaveBeenCalled();});
 it('does not trust forwarded headers outside Vercel',async()=>{vi.stubEnv('VERCEL','');expect((await authenticatePortalPassword(request(),'synthetic',password)).status).toBe(503);expect(mock.rpc).not.toHaveBeenCalled();});
 it.each(['192.168.1.20','10.0.0.20','172.16.0.20','::ffff:192.168.1.20'])('accepts direct private peer only in staging dev server: %s',async ip=>{
  vi.stubEnv('VERCEL','');vi.stubEnv('NODE_ENV','development');vi.stubEnv('PTV_AUTH_DEV_LAN_ENABLED','true');
  const req=request();req.socket={remoteAddress:ip} as ApiRequest['socket'];
  expect((await authenticatePortalPassword(req,'synthetic',password)).status).toBe(200);
 });
 it.each([
  ['production','true','192.168.1.20'],['development','false','192.168.1.20'],
  ['development','true','203.0.113.20'],['development','true','172.32.0.20'],
 ])('rejects LAN ingress outside dev boundary %s/%s/%s',async(nodeEnv,enabled,ip)=>{
  vi.stubEnv('VERCEL','');vi.stubEnv('NODE_ENV',nodeEnv);vi.stubEnv('PTV_AUTH_DEV_LAN_ENABLED',enabled);
  const req=request();req.socket={remoteAddress:ip} as ApiRequest['socket'];
  expect((await authenticatePortalPassword(req,'synthetic',password)).status).toBe(503);expect(mock.rpc).not.toHaveBeenCalled();
 });
 it('uses socket peer rather than spoofed forwarding headers for dev rate limits',async()=>{
  vi.stubEnv('VERCEL','');vi.stubEnv('NODE_ENV','development');vi.stubEnv('PTV_AUTH_DEV_LAN_ENABLED','true');
  const req=request();req.socket={remoteAddress:'192.168.1.20'} as ApiRequest['socket'];
  await authenticatePortalPassword(req,'synthetic',password);const first=mock.rpc.mock.calls[0][1].p_ingress_key;
  mock.rpc.mockClear();req.headers['x-forwarded-for']='10.0.0.99';
  await authenticatePortalPassword(req,'synthetic',password);expect(mock.rpc.mock.calls[0][1].p_ingress_key).toBe(first);
 });
 it('returns a signed session only after durable commit using actual 2y verifier',async()=>{
  const result=await authenticatePortalPassword(request(),'synthetic',password);expect(result.status).toBe(200);
  if(!('token' in result)||!result.token)throw new Error('expected token');
  const verified=verifySessionToken(result.token,secret)!;expect(verified.exp-verified.iat).toBe(600);expect(verified.session_id).toBeTruthy();
  const finish=mock.rpc.mock.calls.find(([name])=>name==='rpc_portal_login_finish')![1];expect(finish.p_success).toBe(true);expect(finish.p_fingerprint).toBe(fingerprintSession(result.token));
  const begin=mock.rpc.mock.calls[0][1];expect(begin.p_ingress_key).toMatch(/^[0-9a-f]{64}$/);expect(JSON.stringify(begin)).not.toContain('192.0.2.10');expect(JSON.stringify(mock.rpc.mock.calls)).not.toContain(password);
 });
 it('wrong password finishes an audited failure without cookie',async()=>{const result=await authenticatePortalPassword(request(),'synthetic','WRONG-SYNTHETIC');expect(result.status).toBe(401);expect('token' in result).toBe(false);expect(mock.rpc.mock.calls[1][1].p_success).toBe(false);});
 it('rate limit returns retry without credential verification',async()=>{mock.rpc.mockResolvedValue({error:null,data:{enabled:true,allowed:false,retry_after:900}});const result=await authenticatePortalPassword(request(),'synthetic',password);expect(result.status).toBe(429);expect(mock.live).not.toHaveBeenCalled();});
 it.each([false,'error','throw'])('finish %s does not issue cookie',async mode=>{mock.rpc.mockImplementation(async(name:string)=>{if(name==='rpc_portal_login_begin')return {error:null,data:{enabled:true,allowed:true,account_id:account,identity_id:identity,hash:encoded,session_seconds:600}};if(mode==='throw')throw new Error('synthetic');return {data:false,error:mode==='error'?{message:'synthetic'}:null};});const result=await authenticatePortalPassword(request(),'synthetic',password);expect(result.status).toBe(mode===false?401:503);expect('token' in result).toBe(false);});
 it('login HTTP endpoint only emits cookie after lifecycle success',async()=>{const req=request();req.body={identifier:'synthetic',password};const out=response();await login(req,out.res);expect(out.res.statusCode).toBe(200);expect(String(out.headers['set-cookie'])).toContain('Max-Age=600');expect(out.body()).not.toContain(encoded);});
 it('login response keeps live capability authority and does not invent operational membership',async()=>{const req=request();req.body={identifier:'synthetic',password};const out=response();await login(req,out.res);const result=JSON.parse(out.body());expect(result.user.capabilities_verified_live).toBe(true);expect(result.user.division).toBe('');expect(result.user.position).toBe('');expect(result.expires_at).toBeGreaterThan(Date.now());});
 it('login HTTP rejects cross-origin without backend call',async()=>{const req=request();req.headers.origin='https://foreign.example';req.body={identifier:'synthetic',password};const out=response();await login(req,out.res);expect(out.res.statusCode).toBe(403);expect(mock.rpc).not.toHaveBeenCalled();});
 it('fingerprint is derived and omitted from serialized claims',()=>{const p=payload();p.token_fingerprint='untrusted';const token=signSessionToken(p,secret);const checked=verifySessionToken(token,secret)!;expect(checked.token_fingerprint).toBe(fingerprintSession(token));expect(JSON.stringify(checked)).not.toContain('token_fingerprint');expect(Buffer.from(token.split('.')[0],'base64url').toString()).not.toContain('token_fingerprint');});
 it('equivalent padded signature has identical revocation key',()=>{const token=signSessionToken(payload(),secret);expect(verifySessionToken(token+'=',secret)?.token_fingerprint).toBe(verifySessionToken(token,secret)?.token_fingerprint);});
 it('session RPC binding rejects unsigned state',()=>{expect(()=>sessionArguments(payload())).toThrow('Verified token required');});
 it('logout waits for durable revoke before clearing cookie',async()=>{const req=request();req.headers.cookie='ptv_hub_session='+signSessionToken(payload(),secret);const out=response();await logout(req,out.res);expect(mock.rpc.mock.calls[0][0]).toBe('rpc_portal_session_revoke');expect(out.res.statusCode).toBe(200);expect(out.headers['set-cookie']).toBeTruthy();});
 it('logout failure preserves browser cookie',async()=>{mock.rpc.mockResolvedValue({data:false,error:{message:'synthetic'}});const req=request();req.headers.cookie='ptv_hub_session='+signSessionToken(payload(),secret);const out=response();await logout(req,out.res);expect(out.res.statusCode).toBe(503);expect(out.headers['set-cookie']).toBeUndefined();});
 it('GET cannot revoke or clear an active session',async()=>{const req=request();req.method='GET';const out=response();await logout(req,out.res);expect(out.res.statusCode).toBe(405);expect(out.headers['set-cookie']).toBeUndefined();expect(mock.rpc).not.toHaveBeenCalled();});
});
