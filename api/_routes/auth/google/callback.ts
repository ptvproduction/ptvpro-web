import type { ApiRequest, ApiResponse } from '../_utils/types';
import { verifyHmacState, signSessionToken, verifyGoogleIdToken } from '../_utils/crypto';
import { parseCookies, serializeCookie, appendSetCookieHeader } from '../_utils/cookies';
import { resolveIdentityByGoogleSub, verifyAccountStatusLive } from '../_utils/identity';
import { recordPortalLoginProof } from '../_utils/loginProof';
import { randomUUID } from 'node:crypto';
import { lifecycleEnabled, sessionNeedsRegistry } from '../_utils/portalLifecycle';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader?.('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const errorParam = urlObj.searchParams.get('error');
  const code = urlObj.searchParams.get('code');
  const state = urlObj.searchParams.get('state');
  const authSecret = process.env.AUTH_SECRET || '';
  const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';

  // 1. Google OAuth cancellation or rejection
  if (errorParam) {
    let friendlyError = 'Autentikasi Google gagal.';
    let authStatus = 'error';
    if (errorParam === 'access_denied') {
      friendlyError = 'Autentikasi Google dibatalkan oleh pengguna.';
      authStatus = 'cancelled';
    }
    let redirectDest = `/hub/login?auth_error=${encodeURIComponent(friendlyError)}&auth_status=${authStatus}`;
    if (state) {
      const maybeState = verifyHmacState<{ action?: string }>(state, authSecret);
      if (maybeState?.action === 'link') {
        redirectDest = `/hub/pengaturan?oauth_status=${authStatus}&oauth_error=${encodeURIComponent(friendlyError)}`;
      }
    }
    res.statusCode = 302;
    res.setHeader?.('Location', redirectDest);
    res.end();
    return;
  }

  // 2. Validate state and code presence
  if (!code || !state) {
    res.statusCode = 302;
    res.setHeader?.('Location', `/hub/login?auth_error=${encodeURIComponent('Parameter OAuth callback tidak lengkap.')}&auth_status=error`);
    res.end();
    return;
  }

  // 3. Read and verify state cookie
  const cookies = parseCookies(req.headers.cookie);
  const stateCookieRaw = cookies['ptv_oauth_state'];

  // Clear state cookie regardless of outcome
  const clearStateCookie = serializeCookie('ptv_oauth_state', '', {
    path: '/api/auth',
    maxAge: 0,
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
  });
  appendSetCookieHeader(res, clearStateCookie);

  if (!stateCookieRaw || !stateCookieRaw.includes(':')) {
    res.statusCode = 302;
    res.setHeader?.('Location', `/hub/login?auth_error=${encodeURIComponent('Sesi state OAuth telah kedaluwarsa atau tidak ditemukan. Silakan coba lagi.')}&auth_status=state_error`);
    res.end();
    return;
  }

  const [cookieState,cookieVerifier] = stateCookieRaw.split(':');
  if (cookieState !== state) {
    res.statusCode = 302;
    res.setHeader?.('Location', `/hub/login?auth_error=${encodeURIComponent('Verifikasi keamanan CSRF state gagal. Permintaan login ditolak.')}&auth_status=state_error`);
    res.end();
    return;
  }

  const verifiedState = verifyHmacState<{
    returnTo?: string;
    timestamp?: number;
    nonce?: string;
    action?: string;
    account_id?: string;
    ptv_id?: string;
  }>(state, authSecret);

  if (!verifiedState) {
    res.statusCode = 302;
    res.setHeader?.('Location', `/hub/login?auth_error=${encodeURIComponent('Tanda tangan CSRF state tidak valid. Akses ditolak.')}&auth_status=state_error`);
    res.end();
    return;
  }

  const returnTo = verifiedState.returnTo?.startsWith('/hub') ? verifiedState.returnTo : '/hub';

  // 4. Resolve Google identity (real exchange or local mock fixture)
  let googleSub = '';
  let googleEmail = '';

  const isMockAllowed = process.env.NODE_ENV === 'test' && !process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mockSubParam = isMockAllowed ? urlObj.searchParams.get('mock_sub') : null;
  const mockEmailParam = isMockAllowed ? urlObj.searchParams.get('mock_email') : null;

  if (isMockAllowed && (code === 'mock-auth-code' || mockSubParam)) {
    // Development / Automated Test Mock Mode
    googleSub = mockSubParam || 'google-sub-ptv-025';
    googleEmail = mockEmailParam || 'zidna@ptvpro.com';
  } else {
    if (typeof verifiedState.timestamp!=='number' || !Number.isFinite(verifiedState.timestamp)
      || verifiedState.timestamp>Date.now() || Date.now()-verifiedState.timestamp>300000 || !verifiedState.nonce || !cookieVerifier) {
      res.statusCode=302; res.setHeader?.('Location','/hub/login?auth_status=state_error'); res.end(); return;
    }
    // Real Google OAuth code exchange
    try {
      const rawClientId = process.env.GOOGLE_CLIENT_ID;
      const rawClientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const clientId = rawClientId?.trim().replace(/^["']|["']$/g, '');
      const clientSecret = rawClientSecret?.trim().replace(/^["']|["']$/g, '');
      const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host || 'localhost:5174'}`;
      const rawRedirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`;
      const redirectUri = rawRedirectUri.trim().replace(/^["']|["']$/g, '');

      if (!clientId || !clientSecret) {
        throw new Error('Kredensial GOOGLE_CLIENT_ID atau GOOGLE_CLIENT_SECRET belum dikonfigurasi pada server Vercel.');
      }

      // Exchange code for token
      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: cookieVerifier,
        }),
      });

      if (!tokenResp.ok) {
        const errJson = await tokenResp.json().catch(() => ({}));
        throw new Error(`Pertukaran kode token Google gagal: ${errJson.error_description || tokenResp.statusText}`);
      }

      const tokenData = await tokenResp.json();
      const idToken = tokenData.id_token;

      // 4.1 Cryptographic verification of Google ID Token (RS256 against Google Public JWKS)
      if (idToken) {
        const verifiedClaims = await verifyGoogleIdToken(idToken, clientId, verifiedState.nonce);
        if (!verifiedClaims) {
          throw new Error('Verifikasi tanda tangan kriptografis Google ID Token (RS256) gagal atau token tidak sah.');
        }
        googleSub = verifiedClaims.sub;
        googleEmail = verifiedClaims.email || '';
      } else {
        throw new Error('Respons Google tidak memuat ID token untuk verifikasi nonce.');
      }
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[GoogleOAuth:Callback] Token exchange or ID token validation failed.');
      }
      res.statusCode = 302;
      res.setHeader?.('Location', `/hub/login?auth_error=${encodeURIComponent(err.message || 'Gagal memproses autentikasi Google.')}&auth_status=error`);
      res.end();
      return;
    }
  }

  // ── 4.2 SPECIAL ACTION: GOOGLE ACCOUNT LINKING ──
  if (verifiedState.action === 'link') {
    const targetAccountId = verifiedState.account_id;
    const sessionCookieRaw = cookies['ptv_hub_session'];
    const currentSession = sessionCookieRaw ? (await import('../_utils/crypto')).verifySessionToken(sessionCookieRaw, authSecret) : null;

    // Security Guard: Pastikan sesi aktif saat ini masih sah dan cocok dengan targetAccountId pada signed state
    if (!currentSession || currentSession.account_id !== targetAccountId || currentSession.status_akun !== 'active'
      || (sessionNeedsRegistry(currentSession) && !await verifyAccountStatusLive(currentSession.account_id,currentSession.iat,currentSession))) {
      res.statusCode = 302;
      res.setHeader?.('Location', `/hub/pengaturan?oauth_status=error&oauth_error=${encodeURIComponent('Sesi autentikasi tidak valid atau telah kedaluwarsa saat proses linking. Permintaan dibatalkan demi keamanan.')}`);
      res.end();
      return;
    }

    const { linkGoogleIdentityToAccount } = await import('../_utils/identity');
    const linkResult = await linkGoogleIdentityToAccount(targetAccountId, googleSub, googleEmail);

    if (linkResult.conflict) {
      res.statusCode = 302;
      res.setHeader?.('Location', `/hub/pengaturan?oauth_status=conflict&oauth_error=${encodeURIComponent(linkResult.error || 'Akun Google tersebut sudah terhubung ke akun PTVPRO lain.')}`);
      res.end();
      return;
    }

    if (!linkResult.success) {
      res.statusCode = 302;
      res.setHeader?.('Location', `/hub/pengaturan?oauth_status=error&oauth_error=${encodeURIComponent(linkResult.error || 'Gagal menghubungkan akun Google.')}`);
      res.end();
      return;
    }

    // Berhasil dihubungkan
    res.statusCode = 302;
    res.setHeader?.('Location', `/hub/pengaturan?oauth_status=linked_success&oauth_email=${encodeURIComponent(googleEmail || '')}`);
    res.end();
    return;
  }

  // 5. Canonical Database Identity & Capability Validation (Fail-Closed)
  const identityResult = await resolveIdentityByGoogleSub(googleSub, googleEmail);
  if (!identityResult.success || !identityResult.session) {
    const authStatus =
      identityResult.code === 'unlinked'
        ? 'unlinked'
        : identityResult.code === 'access_denied'
        ? 'access_denied'
        : 'error';
    const isDev = process.env.NODE_ENV !== 'production';
    const devSubParam = (authStatus === 'unlinked' && isMockAllowed && googleSub)
      ? `&dev_sub=${encodeURIComponent(googleSub)}`
      : '';
    if (isDev) {
      console.log(`[GoogleOAuth:Callback] Stage: identity_check, Status: ${authStatus}, Reason: ${identityResult.code || 'unknown'}`);
    }
    res.statusCode = 302;
    res.setHeader?.('Location', `/hub/login?auth_error=${encodeURIComponent(identityResult.error || 'Autentikasi akun ditolak.')}&auth_status=${authStatus}${devSubParam}`);
    res.end();
    return;
  }

  // 6. Issue Website Session Token & Set HttpOnly Cookie
  if (lifecycleEnabled()) identityResult.session.session_id = randomUUID();
  const sessionToken = signSessionToken(identityResult.session, authSecret);
  try { if (!isMockAllowed) await recordPortalLoginProof(identityResult.session,googleSub,sessionToken); }
  catch {
    res.statusCode=302;
    res.setHeader?.('Location','/hub/login?auth_status=error&auth_error=Verifikasi%20audit%20login%20belum%20tersedia.');
    res.end(); return;
  }
  const sessionCookie = serializeCookie('ptv_hub_session', sessionToken, {
    path: '/',
    maxAge: 7 * 24 * 3600, // 7 days
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
  });
  appendSetCookieHeader(res, sessionCookie);

  // 7. 302 Redirect to intended internal route with success feedback modal trigger
  res.statusCode = 302;
  res.setHeader?.('Location', `/hub/login?auth_status=success&returnTo=${encodeURIComponent(returnTo)}`);
  res.end();
}


