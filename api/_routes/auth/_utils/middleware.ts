import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseCookies } from './cookies';
import { verifySessionToken } from './crypto';
import { refreshLiveSession } from './identity';
import type { SessionPayload } from './types';

export interface AuthenticatedRequest extends IncomingMessage {
  session: SessionPayload;
  userCaps: string[];
  body?: any;
  query?: Record<string, string | string[] | undefined>;
}

export type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: ServerResponse
) => Promise<void> | void;

export interface WithAuthOptions {
  /** Nama modul untuk pesan 401 kanonikal (misal "Catatan", "Acara") */
  moduleName?: string;
  /** Pesan 401 khusus jika modul memiliki string kanonikal unik */
  unauthorizedMessage?: string;
}

/**
 * Higher-Order Function untuk mengonsolidasikan autentikasi sesi login PTVPRO.
 * 
 * Menangani secara terpadu:
 * 1. Ekstraksi HttpOnly cookie `ptv_hub_session`.
 * 2. Verifikasi kriptografis token HMAC-SHA256 & status akun aktif.
 * 3. Pemuatan hak akses langsung (live capabilities) dengan in-memory cache 20s.
 * 4. Pengecekan izin dasar `hub.access`.
 * 5. Menyematkan `session` dan `userCaps` ke `req` agar tidak memicu query berulang.
 */
export function withAuth(
  handler: AuthenticatedHandler,
  options?: WithAuthOptions
) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // 1. Session Authentication Gate (Vercel Direct Auth HttpOnly Cookie)
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies['ptv_hub_session'];
    const authSecret = process.env.AUTH_SECRET || '';

    if (!sessionToken) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: options?.unauthorizedMessage
            ? options.unauthorizedMessage
            : options?.moduleName
            ? `Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses data ${options.moduleName}.`
            : 'Akses ditolak: Autentikasi sesi login Hub diperlukan.',
          code: 'unauthorized',
        })
      );
      return;
    }

    // 2. Cryptographic Token Verification (HMAC-SHA256 & Expiration)
    const session = verifySessionToken(sessionToken, authSecret);
    if (!session || session.status_akun !== 'active') {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'Akses ditolak: Sesi tidak valid atau telah kedaluwarsa.',
          code: 'invalid_session',
        })
      );
      return;
    }

    // 3. RBAC & Live Capability Gate (menggunakan short-lived cache PTV-DEV-257)
    let userCaps: string[];
    try {
      userCaps = await refreshLiveSession(session);
    } catch {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'Akses ditolak: Sesi tidak valid.',
          code: 'invalid_session',
        })
      );
      return;
    }

    if (!userCaps.includes('hub.access')) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'Sesi atau izin telah dicabut.',
          code: 'forbidden',
        })
      );
      return;
    }

    // Attach authentic state to request
    (req as AuthenticatedRequest).session = session;
    (req as AuthenticatedRequest).userCaps = userCaps;

    return handler(req as AuthenticatedRequest, res);
  };
}

export type CapabilityRequirement =
  | string
  | string[]
  | ((req: AuthenticatedRequest) => string | string[] | boolean | Promise<boolean>);

export interface WithCapabilityOptions {
  deniedMessage?: string;
  deniedCode?: string;
}

/**
 * Higher-Order Function untuk mengonsolidasikan otorisasi kapabilitas (RBAC).
 * 
 * Mendukung:
 * - Kapabilitas tunggal: 'notes.view'
 * - Beberapa kapabilitas (OR): ['events.view', 'calendar.view']
 * - Dynamic resolution per method / kondisi kepemilikan (ownership).
 */
export function withCapability(
  requirement: CapabilityRequirement,
  handler: AuthenticatedHandler,
  options?: WithCapabilityOptions
) {
  return async (req: AuthenticatedRequest, res: ServerResponse): Promise<void> => {
    const userCaps = req.userCaps || [];

    let allowed = false;
    if (typeof requirement === 'string') {
      allowed = userCaps.includes(requirement);
    } else if (Array.isArray(requirement)) {
      allowed = requirement.some((cap) => userCaps.includes(cap));
    } else if (typeof requirement === 'function') {
      const resVal = await requirement(req);
      if (typeof resVal === 'boolean') {
        allowed = resVal;
      } else if (typeof resVal === 'string') {
        allowed = userCaps.includes(resVal);
      } else if (Array.isArray(resVal)) {
        allowed = resVal.some((cap) => userCaps.includes(cap));
      }
    }

    if (!allowed) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: options?.deniedMessage || 'Akses ditolak: Akun Anda tidak memiliki izin untuk operasi ini.',
          code: options?.deniedCode || 'forbidden',
        })
      );
      return;
    }

    return handler(req, res);
  };
}
