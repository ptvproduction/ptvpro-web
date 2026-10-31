import type { ApiRequest, ApiResponse } from '../_utils/types';
import { parseCookies } from '../_utils/cookies';
import { verifySessionToken } from '../_utils/crypto';
import { verifyAccountStatusLive, unlinkGoogleIdentityFromAccount } from '../_utils/identity';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  res.setHeader?.('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['ptv_hub_session'];
  const authSecret = process.env.AUTH_SECRET || '';

  if (!sessionToken) {
    res.statusCode = 401;
    res.end(JSON.stringify({ success: false, error: 'Sesi autentikasi tidak ditemukan. Silakan login kembali.' }));
    return;
  }

  const session = verifySessionToken(sessionToken, authSecret);
  if (!session || session.status_akun !== 'active') {
    res.statusCode = 401;
    res.end(JSON.stringify({ success: false, error: 'Sesi login tidak sah atau telah kedaluwarsa.' }));
    return;
  }

  const isStillActive = await verifyAccountStatusLive(session.account_id, session.iat, session);
  if (!isStillActive) {
    res.statusCode = 403;
    res.end(JSON.stringify({ success: false, error: 'Akun Anda sedang nonaktif. Operasi pemutusan tautan ditolak.' }));
    return;
  }

  const unlinkResult = await unlinkGoogleIdentityFromAccount(session.account_id);
  if (!unlinkResult.success) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: unlinkResult.error || 'Gagal memutuskan tautan Google.' }));
    return;
  }

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      success: true,
      message: 'Tautan akun Google berhasil diputuskan dari akun PTVPRO Anda.',
    })
  );
}
