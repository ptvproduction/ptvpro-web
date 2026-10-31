import { createClient } from '@supabase/supabase-js';
import type { SessionPayload } from './types';
import { resolveLiveAccess } from './liveAccess';
import { fingerprintSession, lifecycleEnabled } from './portalLifecycle';

/** Called only after the Google callback has verified the provider token and signed the website session. */
export async function recordPortalLoginProof(session: SessionPayload, verifiedGoogleSubject: string, signedToken?: string) {
  const url=process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key || !/^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/.test(url)) throw new Error('login proof unavailable');
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const live=await resolveLiveAccess(db,session,{issuingSession:true});
  const credential=await db.from('auth_credentials').select('oauth_provider,oauth_subject_id,updated_at').eq('account_id',live.account.id).single();
  if(credential.error || credential.data?.oauth_provider!=='google' || !verifiedGoogleSubject
    || credential.data.oauth_subject_id!==verifiedGoogleSubject || !Number.isFinite(Date.parse(credential.data.updated_at))) throw new Error('login proof unavailable');
  if(lifecycleEnabled()) {
    if(!signedToken || !session.session_id) throw new Error('login proof unavailable');
    const result=await db.rpc('rpc_portal_google_session',{p_actor:live.account.id,p_identity:live.identity.id,p_subject:verifiedGoogleSubject,
      p_credential_version:credential.data.updated_at,p_session_id:session.session_id,p_fingerprint:fingerprintSession(signedToken),p_iat:session.iat,p_exp:session.exp});
    if(result.error || result.data!==true) throw new Error('login proof unavailable');
    return;
  }
  const audit=await db.from('auth_audit_log').insert({actor_id:live.identity.id,event_type:'portal_login_verified',
    metadata:{proof_version:1,account_id:live.account.id,credential_version:credential.data.updated_at,login_route:'vercel_google',session_iat:session.iat}});
  if(audit.error) throw new Error('login proof unavailable');
}
