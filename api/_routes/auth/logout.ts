import type { ApiRequest, ApiResponse } from './_utils/types';
import { serializeCookie, appendSetCookieHeader } from './_utils/cookies';
import { parseCookies } from './_utils/cookies';
import { verifySessionToken } from './_utils/crypto';
import { lifecycleClient, lifecycleEnabled, sessionArguments, sessionNeedsRegistry } from './_utils/portalLifecycle';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  res.setHeader?.('Cache-Control', 'no-store');
  const raw=parseCookies(req.headers.cookie).ptv_hub_session;
  const session=raw && verifySessionToken(raw,process.env.AUTH_SECRET || '');
  if(lifecycleEnabled() || (session && sessionNeedsRegistry(session))) {
    if(req.method!=='POST'){res.statusCode=405;res.end(JSON.stringify({error:'Gunakan POST untuk logout.'}));return;}
    try {
      if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host){res.statusCode=403;res.end(JSON.stringify({error:'Origin tidak diizinkan.'}));return;}
      if(session){const result=await lifecycleClient().rpc('rpc_portal_session_revoke',sessionArguments(session));if(result.error || result.data!==true)throw new Error('revocation unavailable');}
    } catch {res.statusCode=503;res.end(JSON.stringify({error:'Pencabutan sesi belum berhasil. Coba lagi.'}));return;}
  }
  const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';

  // Clear session cookie with Max-Age=0
  const clearSessionCookie = serializeCookie('ptv_hub_session', '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
  });
  appendSetCookieHeader(res, clearSessionCookie);

  if (req.method === 'POST') {
    res.statusCode = 200;
    res.setHeader?.('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // If called via GET, redirect back to /hub/login
  res.statusCode = 302;
  res.setHeader?.('Location', '/hub/login');
  res.end();
}
