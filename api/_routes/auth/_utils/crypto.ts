import { randomBytes, createHash, createHmac, timingSafeEqual, createVerify, createPublicKey } from 'node:crypto';
import type { SessionPayload } from './types';

export function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

/**
 * PKCE Code Verifier generator (RFC 7636)
 */
export function generatePkceVerifier(): string {
  return base64UrlEncode(randomBytes(32));
}

/**
 * PKCE Code Challenge generator (S256)
 */
export function generatePkceChallenge(verifier: string): string {
  return base64UrlEncode(createHash('sha256').update(verifier).digest());
}

/**
 * Generates an HMAC-signed CSRF state parameter.
 * Format: payloadBase64.signatureBase64
 */
export function createHmacState(payload: Record<string, any>, secret: string): string {
  if (!secret) throw new Error('Konfigurasi penandatanganan sesi tidak tersedia.');
  const jsonStr = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(Buffer.from(jsonStr, 'utf-8'));
  const hmac = createHmac('sha256', secret).update(payloadB64).digest();
  const sigB64 = base64UrlEncode(hmac);
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verifies and decodes an HMAC-signed CSRF state parameter.
 */
export function verifyHmacState<T = any>(stateStr: string, secret: string): T | null {
  if (!secret || !stateStr || !stateStr.includes('.')) return null;
  const parts = stateStr.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;
  const expectedHmac = createHmac('sha256', secret).update(payloadB64).digest();
  const actualHmac = base64UrlDecode(sigB64);

  if (expectedHmac.length !== actualHmac.length) return null;
  if (!timingSafeEqual(expectedHmac, actualHmac)) return null;

  try {
    const jsonStr = base64UrlDecode(payloadB64).toString('utf-8');
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

/**
 * Signs a website session token with HMAC-SHA256.
 * Format: payloadBase64.signatureBase64
 */
export function signSessionToken(payload: SessionPayload, secret: string): string {
  if (!secret) throw new Error('Konfigurasi penandatanganan sesi tidak tersedia.');
  const { token_fingerprint: _derived, ...signedPayload } = payload;
  const jsonStr = JSON.stringify(signedPayload);
  const payloadB64 = base64UrlEncode(Buffer.from(jsonStr, 'utf-8'));
  const sig = createHmac('sha256', secret).update(payloadB64).digest();
  const sigB64 = base64UrlEncode(sig);
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verifies and parses a website session token with HMAC-SHA256.
 * Checks HMAC signature and expiration timestamp.
 */
export function verifySessionToken(tokenStr: string, secret: string): SessionPayload | null {
  if (!secret || !tokenStr || !tokenStr.includes('.')) return null;
  const parts = tokenStr.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;
  const expectedSig = createHmac('sha256', secret).update(payloadB64).digest();
  const actualSig = base64UrlDecode(sigB64);

  if (expectedSig.length !== actualSig.length) return null;
  if (!timingSafeEqual(expectedSig, actualSig)) return null;

  try {
    const jsonStr = base64UrlDecode(payloadB64).toString('utf-8');
    const payload = JSON.parse(jsonStr) as SessionPayload;

    if (!payload || typeof payload !== 'object'
      || typeof payload.account_id !== 'string' || !payload.account_id.trim()
      || typeof payload.identity_id !== 'string' || !payload.identity_id.trim()
      || !Number.isSafeInteger(payload.iat) || payload.iat <= 0
      || !Number.isSafeInteger(payload.exp) || payload.exp <= 0) return null;

    // Check expiration (exp in milliseconds or seconds)
    const now = Date.now();
    const expMs = payload.exp > 10000000000 ? payload.exp : payload.exp * 1000;
    if (now >= expMs || payload.iat * 1000 > now || expMs <= payload.iat * 1000) {
      return null;
    }
    if (payload.session_id !== undefined && (typeof payload.session_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.session_id))) return null;
    // Canonical signature bytes prevent equivalent base64 encodings bypassing revocation.
    Object.defineProperty(payload, 'token_fingerprint', {
      value: createHash('sha256').update(`${payloadB64}.${base64UrlEncode(expectedSig)}`).digest('hex'),
      enumerable: true,
      writable: true,
      configurable: true,
    });
    return payload;
  } catch {
    return null;
  }
}

export interface GoogleIdTokenClaims {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  nonce?: string;
}

// In-memory cache for Google JWKS public certs (1 hour TTL)
let googleJwksCache: { keys: any[]; fetchedAt: number } | null = null;

async function getGoogleJwksKeys(): Promise<any[]> {
  const now = Date.now();
  if (googleJwksCache && now - googleJwksCache.fetchedAt < 3600 * 1000) {
    return googleJwksCache.keys;
  }

  const resp = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!resp.ok) {
    throw new Error('Gagal mengunduh Google public JWKS certs.');
  }
  const data = await resp.json();
  if (Array.isArray(data.keys)) {
    googleJwksCache = { keys: data.keys, fetchedAt: now };
    return data.keys;
  }
  return [];
}

/**
 * Cryptographically verifies a Google ID Token (RS256 JWT) against Google's public JWKS.
 * Enforces signature validation, issuer check, audience check, expiration, and optional nonce.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expectedClientId: string,
  expectedNonce?: string
): Promise<GoogleIdTokenClaims | null> {
  if (!idToken || !idToken.includes('.')) return null;
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;

  try {
    // 1. Decode header to extract Key ID (kid) and algorithm
    const headerStr = base64UrlDecode(parts[0]).toString('utf-8');
    const header = JSON.parse(headerStr);
    if (header.alg !== 'RS256' || !header.kid) {
      return null;
    }

    // 2. Fetch Google public JWKS keys and find matching key
    const keys = await getGoogleJwksKeys();
    const matchingKey = keys.find((k: any) => k.kid === header.kid);
    if (!matchingKey) {
      return null;
    }

    // 3. Cryptographic signature verification using node:crypto RS256
    const publicKey = createPublicKey({ key: matchingKey, format: 'jwk' });
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    const signatureBuffer = base64UrlDecode(parts[2]);
    const isSignatureValid = verifier.verify(publicKey, signatureBuffer);

    if (!isSignatureValid) {
      return null;
    }

    // 4. Validate claims
    const payloadStr = base64UrlDecode(parts[1]).toString('utf-8');
    const claims = JSON.parse(payloadStr) as GoogleIdTokenClaims;
    if (!claims || typeof claims.sub!=='string' || !claims.sub.trim()
      || !Number.isSafeInteger(claims.exp) || !Number.isSafeInteger(claims.iat) || claims.iat<=0 || claims.exp<=claims.iat) return null;

    // Issuer must be Google
    if (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') {
      return null;
    }

    // Audience must match Client ID
    if (claims.aud !== expectedClientId) {
      return null;
    }

    // Must not be expired (clock skew allowance: 60s)
    const nowSec = Math.floor(Date.now() / 1000);
    if (claims.exp < nowSec - 60 || claims.iat>nowSec+60) {
      return null;
    }

    // Nonce validation if expected
    if (expectedNonce && claims.nonce !== expectedNonce) {
      return null;
    }

    return claims;
  } catch {
    return null;
  }
}

