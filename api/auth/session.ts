import type { ApiRequest, ApiResponse } from './_utils/types';
import { parseCookies } from './_utils/cookies';
import { verifySessionToken } from './_utils/crypto';
import { createClient } from '@supabase/supabase-js';
import { resolveLiveAccess, LiveAccessUnavailableError } from './_utils/liveAccess';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  res.setHeader?.('Content-Type', 'application/json');
  res.setHeader?.('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['ptv_hub_session'];
  const authSecret = process.env.AUTH_SECRET || '';

  if (!sessionToken) {
    res.statusCode = 200;
    res.end(JSON.stringify({ authenticated: false, user: null }));
    return;
  }

  const session = verifySessionToken(sessionToken, authSecret);
  if (!session || session.status_akun !== 'active') {
    res.statusCode = 200;
    res.end(JSON.stringify({ authenticated: false, user: null }));
    return;
  }

  let live: Awaited<ReturnType<typeof resolveLiveAccess>> | null = null;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (key && /^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/.test(url)) {
    try {
      const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } });
      live = await resolveLiveAccess(db, session);
    } catch (error) {
      if (error instanceof LiveAccessUnavailableError || !(error instanceof Error) || error.message !== 'forbidden') {
        res.statusCode = 503;
        res.end(JSON.stringify({ error: 'Verifikasi sesi sementara tidak tersedia. Silakan coba lagi.' }));
        return;
      }
    }
  } else {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: 'Verifikasi sesi belum tersedia.' }));
    return;
  }
  const isStillActive = !!live;
  if (!isStillActive) {
    res.statusCode = 200;
    res.end(JSON.stringify({ authenticated: false, user: null }));
    return;
  }

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      authenticated: true,
      expires_at: session.exp * 1000,
      user: {
        id: live!.account.id,
        ptv_id: live!.identity.ptv_id,
        full_name: live!.identity.full_name,
        username: live!.account.username,
        avatar_url: live!.identity.avatar_url,
        division: live!.membership.division_id || '',
        position: live!.membership.position_title || '',
        organization: 'PTV Studio',
        status_akun: live!.account.status_akun,
        status_organisasi: live!.membership.status_organisasi,
        assigned_profiles: live!.profiles,
        allowed_overrides: live!.context.allowed_overrides,
        denied_overrides: live!.context.denied_overrides,
        capabilities: live!.context.capabilities,
        capabilities_verified_live: true,
      },
    })
  );
}
