import type { ApiRequest, ApiResponse } from '../_utils/types';
import { parseCookies } from '../_utils/cookies';
import { verifySessionToken } from '../_utils/crypto';
import { verifyAccountStatusLive, getGoogleOAuthStatus } from '../_utils/identity';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  res.setHeader?.('Content-Type', 'application/json');

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
    res.end(JSON.stringify({ authenticated: false, is_linked: false }));
    return;
  }

  const session = verifySessionToken(sessionToken, authSecret);
  if (!session || session.status_akun !== 'active') {
    res.statusCode = 200;
    res.end(JSON.stringify({ authenticated: false, is_linked: false }));
    return;
  }

  const isStillActive = await verifyAccountStatusLive(session.account_id, session.iat, session);
  if (!isStillActive) {
    res.statusCode = 200;
    res.end(JSON.stringify({ authenticated: false, is_linked: false }));
    return;
  }

  const status = await getGoogleOAuthStatus(session.account_id);

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      authenticated: true,
      account_id: session.account_id,
      ptv_id: session.ptv_id,
      is_linked: status.is_linked,
      provider: status.oauth_provider || null,
      email: status.oauth_email || null,
      updated_at: status.updated_at || null,
    })
  );
}
