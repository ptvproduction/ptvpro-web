import type { ApiRequest, ApiResponse } from './_utils/types';
import { resolveIdentityByCredentials } from './_utils/identity';
import { signSessionToken } from './_utils/crypto';
import { serializeCookie, appendSetCookieHeader } from './_utils/cookies';
import { authenticatePortalPassword, passwordLoginEnabled } from './_utils/portalLifecycle';

class LoginInputError extends Error {
  constructor(readonly statusCode: number) { super('Permintaan login tidak valid.'); }
}

async function parseJsonBody(req: ApiRequest): Promise<Record<string, unknown>> {
  const limit = 4096;
  let value: unknown = req.body;
  if (value === undefined) {
    value = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      const cleanup = () => {
        req.off('data', onData); req.off('end', onEnd);
        req.off('error', onError); req.off('aborted', onError);
      };
      const onError = () => { cleanup(); reject(new LoginInputError(400)); };
      const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks)); };
      const onData = (chunk: Buffer | string) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > limit) {
          cleanup(); req.resume(); reject(new LoginInputError(413));
        } else chunks.push(bytes);
      };
      req.on('data', onData); req.on('end', onEnd);
      req.on('error', onError); req.on('aborted', onError);
    });
  }
  if (Buffer.isBuffer(value)) value = value.toString('utf8');
  try {
    const encoded = typeof value === 'string' ? value : JSON.stringify(value);
    if (typeof encoded !== 'string') throw new LoginInputError(400);
    if (Buffer.byteLength(encoded, 'utf8') > limit) throw new LoginInputError(413);
    value = JSON.parse(encoded);
  } catch (error) {
    if (error instanceof LoginInputError) throw error;
    throw new LoginInputError(400);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['identifier', 'password'].includes(key))) throw new LoginInputError(400);
  return value as Record<string, unknown>;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  res.setHeader?.('Content-Type', 'application/json');
  res.setHeader?.('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!identifier || identifier.length > 254 || !password || Buffer.byteLength(password, 'utf8') > 72 || password.length < 4) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Identitas dan password (minimal 4 karakter) wajib diisi dengan format yang didukung.' }));
      return;
    }

    // 1. Resolve identity and verify status & capabilities
    let issuedToken: string | undefined;
    let identityResult;
    if (passwordLoginEnabled()) {
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
        res.statusCode = 403; res.end(JSON.stringify({ error: 'Origin tidak diizinkan.' })); return;
      }
      const result = await authenticatePortalPassword(req, identifier, password);
      if (!result.session || !result.token) {
        res.statusCode = result.status;
        if (result.retryAfter) res.setHeader('Retry-After', String(result.retryAfter));
        res.end(JSON.stringify({ error: result.error })); return;
      }
      identityResult = { success: true, session: result.session };
      issuedToken = result.token;
    } else identityResult = await resolveIdentityByCredentials(identifier, password);
    if (!identityResult.success || !identityResult.session) {
      const statusCode = identityResult.code === 'access_denied' ? 403 : 401;
      res.statusCode = statusCode;
      res.end(JSON.stringify({ error: identityResult.error || 'Autentikasi gagal.' }));
      return;
    }

    // 2. Sign official session token with AUTH_SECRET
    const authSecret = process.env.AUTH_SECRET || '';
    const isSecure = req.headers?.['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    const sessionToken = issuedToken || signSessionToken(identityResult.session, authSecret);

    // 3. Issue server-side HttpOnly session cookie
    const sessionCookie = serializeCookie('ptv_hub_session', sessionToken, {
      path: '/',
      maxAge: issuedToken ? identityResult.session.exp - identityResult.session.iat : 7 * 24 * 3600,
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
    });

    appendSetCookieHeader(res, sessionCookie);

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        expires_at: identityResult.session.exp * 1000,
        user: {
          id: identityResult.session.account_id,
          ptv_id: identityResult.session.ptv_id,
          full_name: identityResult.session.full_name,
          username: identityResult.session.username,
          avatar_url: identityResult.session.avatar_url,
          division: identityResult.session.division || '',
          position: identityResult.session.position || '',
          organization: 'PTV Studio',
          status_akun: identityResult.session.status_akun,
          status_organisasi: identityResult.session.status_organisasi || 'active',
          assigned_profiles: identityResult.session.assigned_profiles || [],
          allowed_overrides: [],
          denied_overrides: [],
          capabilities: identityResult.session.capabilities || [],
          capabilities_verified_live: Boolean(issuedToken),
        },
      })
    );
  } catch (error) {
    if (error instanceof LoginInputError) {
      res.statusCode = error.statusCode;
      res.end(JSON.stringify({ error: error.message }));
      return;
    }
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Terjadi kesalahan internal pada server autentikasi.' }));
  }
}
