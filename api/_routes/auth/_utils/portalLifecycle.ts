import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import type { ApiRequest, SessionPayload } from './types';
import { verifyLegacyBcryptPassword } from './legacyPassword';
import { signSessionToken } from './crypto';
import { financeBackendUrl } from './financeLocalHarness';

export const lifecycleEnabled = () => process.env.PTV_AUTH_LIFECYCLE_ENABLED === 'true';
export const passwordLoginEnabled = () => lifecycleEnabled() && process.env.PTV_PASSWORD_LOGIN_ENABLED === 'true';
export const sessionNeedsRegistry = (session: Partial<SessionPayload>) => lifecycleEnabled() || session.session_id !== undefined;
export const fingerprintSession = (token: string) => createHash('sha256').update(token).digest('hex');

export function lifecycleClient() {
  const url = financeBackendUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Auth backend unavailable');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } });
}

export function sessionArguments(session: SessionPayload) {
  let fingerprint = session.token_fingerprint;
  if (!fingerprint || !/^[0-9a-f]{64}$/.test(fingerprint)) {
    fingerprint = createHash('sha256').update(`${session.account_id}:${session.iat}:${session.session_id || 'default'}`).digest('hex');
  }
  return { p_actor: session.account_id, p_identity: session.identity_id, p_iat: session.iat,
    p_exp: session.exp > 10000000000 ? Math.floor(session.exp / 1000) : session.exp,
    p_session_id: session.session_id || null, p_fingerprint: fingerprint };
}

export async function portalSessionValid(db: SupabaseClient, session: SessionPayload) {
  const result = await db.rpc('rpc_portal_session_valid', sessionArguments(session));
  if (result.error) throw new Error('Auth session backend unavailable');
  return result.data === true;
}

function trustedIngress(req: ApiRequest) {
  let value: string | undefined;
  if (process.env.VERCEL === '1') {
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) {
      value = realIp.trim();
    } else {
      const fwd = req.headers['x-forwarded-for'];
      if (typeof fwd === 'string') {
        value = fwd.split(',')[0].trim();
      }
    }
  } else {
    value = typeof req.socket?.remoteAddress === 'string' ? req.socket.remoteAddress : undefined;
  }
  if (typeof value !== 'string' || !isIP(value.trim())) throw new Error('Trusted ingress unavailable');
  const ip = value.trim().toLowerCase();
  const ipv4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const privateLan = isIP(ipv4) === 4 && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ipv4);
  const devLan = process.env.NODE_ENV === 'development'
    && process.env.PTV_AUTH_DEV_LAN_ENABLED === 'true' && privateLan;
  if (process.env.VERCEL !== '1' && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip) && !devLan) throw new Error('Trusted ingress unavailable');
  return isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname : ip;
}

export async function authenticatePortalPassword(req: ApiRequest, identifier: string, password: string) {
  try { return await authenticatePassword(req, identifier, password); }
  catch { return { status: 503, error: 'Autentikasi sementara tidak tersedia.' }; }
}

async function authenticatePassword(req: ApiRequest, identifier: string, password: string) {
  if (!passwordLoginEnabled()) return { status: 403, error: 'Login password belum tersedia secara aman.' };
  const secret = process.env.AUTH_SECRET || '';
  if (secret.length < 32) return { status: 503, error: 'Autentikasi belum tersedia.' };
  const db = lifecycleClient();
  const ingress = trustedIngress(req);
  const key = (domain: string, value: string) => createHmac('sha256', secret).update(domain + '\0' + value).digest('hex');
  const attempt = randomUUID();
  const proof = createHash('sha256').update(randomBytes(32)).digest('hex');
  const begin = await db.rpc('rpc_portal_login_begin', { p_id: attempt, p_secret_hash: proof, p_identifier: identifier,
    p_identifier_key: key('identifier', identifier.trim().toLowerCase()), p_ingress_key: key('ingress', ingress) });
  if (begin.error) return { status: 503, error: 'Autentikasi sementara tidak tersedia.' };
  if (!begin.data?.enabled) return { status: 403, error: 'Login password belum tersedia secara aman.' };
  if (!begin.data.allowed) return { status: 429, error: 'Terlalu banyak percobaan. Coba lagi nanti.', retryAfter: Math.min(3600, Math.max(1, Number(begin.data.retry_after) || 900)) };
  // A valid synthetic bcrypt hash equalizes the unknown-account verification path.
  const dummy = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
  const supported = typeof begin.data.hash === 'string' && /^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/.test(begin.data.hash);
  const encoded = supported ? begin.data.hash : dummy;
  const matched = await verifyLegacyBcryptPassword(password, encoded) && supported && !!begin.data.account_id;
  const ttl = Number(begin.data.session_seconds);
  if (!Number.isInteger(ttl) || ttl < 300 || ttl > 604800) throw new Error('Session policy unavailable');
  const now = Math.floor(Date.now() / 1000);
  let session: SessionPayload | undefined;
  let token: string | undefined;
  let failureDetail: { status: number; error: string } | null = null;
  if (matched) {
    const { resolveLiveAccess, LiveAccessUnavailableError } = await import('./liveAccess');
    try {
      const live = await resolveLiveAccess(db, { account_id: begin.data.account_id, identity_id: begin.data.identity_id, iat: now }, { issuingSession: true });
      const registry = await db.from('capability_registry').select('key');
      if (registry.error || !registry.data) throw new Error('Auth registry unavailable');
      session = { account_id: live.account.id, identity_id: live.identity.id, ptv_id: live.identity.ptv_id, full_name: live.identity.full_name,
        username: live.account.username, avatar_url: live.identity.avatar_url, status_akun: 'active',
        status_organisasi: live.membership.status_organisasi, division: live.membership.division_id, position: live.membership.position_title,
        assigned_profiles: live.profiles, capabilities: registry.data.filter(cap => live.can(cap.key)).map(cap => cap.key),
        iat: now, exp: now + ttl, session_id: randomUUID() };
      token = signSessionToken(session, secret);
    } catch (err) {
      session = undefined;
      token = undefined;
      if (err instanceof LiveAccessUnavailableError) {
        failureDetail = { status: 503, error: 'Layanan verifikasi hak akses sementara tidak tersedia.' };
      } else {
        const { data: acc } = await db.from('user_account').select('status_akun, lockout_until').eq('id', begin.data.account_id).single();
        if (acc && acc.status_akun !== 'active') {
          failureDetail = { status: 403, error: 'Akun Anda sedang berstatus nonaktif. Silakan hubungi pengurus atau administrator.' };
        } else if (acc && acc.lockout_until && Date.parse(acc.lockout_until) > Date.now()) {
          failureDetail = { status: 423, error: 'Akun Anda sementara terkunci karena terlalu banyak percobaan. Coba lagi nanti.' };
        } else {
          failureDetail = { status: 403, error: 'Akses ditolak: Akun Anda tidak memiliki izin untuk mengakses PTVPRO Hub.' };
        }
      }
    }
  }
  const finish = await db.rpc('rpc_portal_login_finish', { p_id: attempt, p_secret_hash: proof, p_success: !!session,
    p_fingerprint: token ? fingerprintSession(token) : null, p_session_id: session?.session_id || null, p_iat: now, p_exp: session?.exp || now });
  if (finish.error) return { status: 503, error: 'Autentikasi sementara tidak tersedia.' };
  if (finish.data !== true || !session || !token) {
    if (failureDetail) return failureDetail;
    return { status: 401, error: 'Identitas atau password tidak valid.' };
  }
  return { status: 200, session, token };
}
