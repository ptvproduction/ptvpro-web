import type { ApiRequest, ApiResponse } from '../_utils/types';
import { generatePkceVerifier, generatePkceChallenge, createHmacState } from '../_utils/crypto';
import { serializeCookie, appendSetCookieHeader } from '../_utils/cookies';
import { sessionNeedsRegistry } from '../_utils/portalLifecycle';
import { verifyAccountStatusLive } from '../_utils/identity';

function sanitizeReturnTo(rawTarget?: string | string[]): string {
  if (!rawTarget || typeof rawTarget !== 'string') return '/hub';
  const trimmed = rawTarget.trim();
  // Anti open-redirect: Must begin with /hub or /dev-, no protocol, no double slashes
  if (
    trimmed.startsWith('/hub') &&
    !trimmed.startsWith('/hub/login') &&
    !trimmed.startsWith('//') &&
    !trimmed.includes('\\')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/dev-') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  return '/hub';
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader?.('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // Parse URL query
  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const returnTo = sanitizeReturnTo(urlObj.searchParams.get('returnTo') || undefined);
  const action = urlObj.searchParams.get('action');

  // Read environment secrets (sanitized against whitespace and surrounding quotes)
  const rawClientId = process.env.GOOGLE_CLIENT_ID || 'mock-google-client-id';
  const clientId = rawClientId.trim().replace(/^["']|["']$/g, '');
  const rawAuthSecret = process.env.AUTH_SECRET || '';
  const authSecret = rawAuthSecret.trim().replace(/^["']|["']$/g, '');
  const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host || 'localhost:5174'}`;
  const rawRedirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`;
  const redirectUri = rawRedirectUri.trim().replace(/^["']|["']$/g, '');

  // Never let a development flag select identities on a live backend.
  const isMockAllowed = process.env.NODE_ENV === 'test' && !process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Guard: Jangan biarkan mock-client-id bocor ke Google di production/staging live
  if (!isMockAllowed && (!process.env.GOOGLE_CLIENT_ID || clientId === 'mock-google-client-id')) {
    res.statusCode = 302;
    res.setHeader?.('Location', `/hub/login?auth_error=${encodeURIComponent('Kredensial GOOGLE_CLIENT_ID belum dikonfigurasi pada server Vercel.')}&auth_status=error`);
    res.end();
    return;
  }

  // Jika action adalah linking akun, wajib verifikasi bahwa pengguna saat ini sedang login secara sah
  let linkingAccountId: string | undefined;
  let linkingPtvId: string | undefined;
  if (action === 'link') {
    const { parseCookies } = await import('../_utils/cookies');
    const { verifySessionToken } = await import('../_utils/crypto');
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies['ptv_hub_session'];
    const currentSession = sessionToken ? verifySessionToken(sessionToken, authSecret) : null;

    if (!currentSession || currentSession.status_akun !== 'active'
      || (sessionNeedsRegistry(currentSession) && !await verifyAccountStatusLive(currentSession.account_id,currentSession.iat,currentSession))) {
      res.statusCode = 302;
      res.setHeader?.('Location', `/hub/login?auth_error=${encodeURIComponent('Sesi login diperlukan untuk menghubungkan akun Google. Silakan login terlebih dahulu.')}&auth_status=error`);
      res.end();
      return;
    }

    linkingAccountId = currentSession.account_id;
    linkingPtvId = currentSession.ptv_id;
  }

  // Generate PKCE & Signed State
  const codeVerifier = generatePkceVerifier();
  const codeChallenge = generatePkceChallenge(codeVerifier);

  const statePayload: any = {
    nonce: generatePkceVerifier(),
    timestamp: Date.now(),
    returnTo,
  };

  if (action === 'link' && linkingAccountId) {
    statePayload.action = 'link';
    statePayload.account_id = linkingAccountId;
    statePayload.ptv_id = linkingPtvId;
  }

  const state = createHmacState(statePayload, authSecret);

  // Save state + code_verifier in temporary HttpOnly cookie (valid for 5 minutes)
  const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  const cookieValue = `${state}:${codeVerifier}`;
  const stateCookie = serializeCookie('ptv_oauth_state', cookieValue, {
    maxAge: 300,
    path: '/api/auth',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
  });

  appendSetCookieHeader(res, stateCookie);

  // Build Google OAuth authorization URL
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('state', state);
  googleAuthUrl.searchParams.set('nonce', statePayload.nonce);
  googleAuthUrl.searchParams.set('code_challenge', codeChallenge);
  googleAuthUrl.searchParams.set('code_challenge_method', 'S256');
  googleAuthUrl.searchParams.set('prompt', 'select_account');
  googleAuthUrl.searchParams.set('access_type', 'offline');

  if (isMockAllowed && urlObj.searchParams.get('mock') === 'true') {
    const mockCallbackUrl = new URL(redirectUri);
    mockCallbackUrl.searchParams.set('code', 'mock-auth-code');
    mockCallbackUrl.searchParams.set('state', state);
    if (urlObj.searchParams.get('mock_sub')) {
      mockCallbackUrl.searchParams.set('mock_sub', urlObj.searchParams.get('mock_sub')!);
    }
    if (urlObj.searchParams.get('mock_email')) {
      mockCallbackUrl.searchParams.set('mock_email', urlObj.searchParams.get('mock_email')!);
    }
    res.statusCode = 302;
    res.setHeader?.('Location', mockCallbackUrl.toString());
    res.end();
    return;
  }

  // 302 Redirect to Google Consent Screen
  res.statusCode = 302;
  res.setHeader?.('Location', googleAuthUrl.toString());
  res.end();
}
