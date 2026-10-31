// PTVPRO Centralized Serverless API Entrypoint Router
// Consolidates all 25 individual backend routes under a single Vercel function
// to stay strictly within the Vercel Hobby 12-function cap while preserving 100%
// of route contracts, auth, and backend capabilities.

import acaraHandler from './_routes/acara';
import aksesHandler from './_routes/akses';
import broadcastHandler from './_routes/broadcast';
import catatanHandler from './_routes/catatan';
import dokumenHandler from './_routes/dokumen';
import financeHandler from './_routes/finance';
import inventarisHandler from './_routes/inventaris';
import kontakHandler from './_routes/kontak';
import kruHandler from './_routes/kru';
import laporKerusakanHandler from './_routes/lapor-kerusakan';
import lostFoundHandler from './_routes/lost-found';
import peminjamanHandler from './_routes/peminjaman';
import plannerHandler from './_routes/planner';
import portalHandler from './_routes/portal';
import portofolioHandler from './_routes/portofolio';
import uploadAvatarHandler from './_routes/upload-avatar';
import verifikasiSuratHandler from './_routes/verifikasi-surat';
import changePasswordHandler from './_routes/auth/change-password';
import loginHandler from './_routes/auth/login';
import logoutHandler from './_routes/auth/logout';
import sessionHandler from './_routes/auth/session';
import googleCallbackHandler from './_routes/auth/google/callback';
import googleLoginHandler from './_routes/auth/google/login';
import googleStatusHandler from './_routes/auth/google/status';
import googleUnlinkHandler from './_routes/auth/google/unlink';

type RouteHandler = (req: any, res: any) => Promise<unknown> | unknown;

export const routes: Record<string, RouteHandler> = {
  'acara': acaraHandler,
  'akses': aksesHandler,
  'broadcast': broadcastHandler,
  'catatan': catatanHandler,
  'dokumen': dokumenHandler,
  'finance': financeHandler,
  'inventaris': inventarisHandler,
  'kontak': kontakHandler,
  'kru': kruHandler,
  'lapor-kerusakan': laporKerusakanHandler,
  'lost-found': lostFoundHandler,
  'peminjaman': peminjamanHandler,
  'planner': plannerHandler,
  'portal': portalHandler,
  'portofolio': portofolioHandler,
  'upload-avatar': uploadAvatarHandler,
  'verifikasi-surat': verifikasiSuratHandler,
  'auth/change-password': changePasswordHandler,
  'auth/login': loginHandler,
  'auth/logout': logoutHandler,
  'auth/session': sessionHandler,
  'auth/google/callback': googleCallbackHandler,
  'auth/google/login': googleLoginHandler,
  'auth/google/status': googleStatusHandler,
  'auth/google/unlink': googleUnlinkHandler,
};

/**
 * Normalizes the incoming request path into a route key (e.g. 'auth/session', 'acara').
 */
export function resolveRouteKey(req: any): string {
  // 1. From Vercel rewrite parameter (?__route=...)
  const paramRoute = req.query?.__route;
  if (paramRoute) {
    const raw = Array.isArray(paramRoute) ? paramRoute.join('/') : String(paramRoute);
    const cleaned = raw.split('?')[0].replace(/^\/+|\/+$/g, '');
    if (cleaned) return cleaned;
  }

  // 2. From Vercel catch-all route query parameter
  const routeParam = req.query?.route || req.query?.path;
  if (routeParam) {
    const raw = Array.isArray(routeParam) ? routeParam.join('/') : String(routeParam);
    const cleaned = raw.split('?')[0].replace(/^\/+|\/+$/g, '');
    if (cleaned) return cleaned;
  }

  // 3. From Vercel rewrite / proxy headers
  const headerPath = (
    req.headers?.['x-forwarded-uri'] ||
    req.headers?.['x-invoke-path'] ||
    req.headers?.['x-matched-path']
  ) as string | undefined;

  if (headerPath) {
    const cleanHeader = headerPath.split('?')[0];
    const match = cleanHeader.match(/^\/api(?:\/(.*))?$/);
    if (match) {
      return (match[1] || '').replace(/^\/+|\/+$/g, '');
    }
  }

  // 4. From standard req.url
  if (req.url) {
    const cleanUrl = req.url.split('?')[0];
    const match = cleanUrl.match(/^\/api(?:\/(.*))?$/);
    if (match) {
      return (match[1] || '').replace(/^\/+|\/+$/g, '');
    }
  }

  return '';
}

/**
 * Universal Serverless API Entrypoint Router for PTVPRO
 */
export default async function handler(req: any, res: any) {
  const routeKey = resolveRouteKey(req);

  // Restore authentic client req.url for handlers that parse searchParams from req.url
  const originalUri = req.headers?.['x-forwarded-uri'] as string | undefined;
  if (originalUri) {
    req.url = originalUri;
  } else if (req.url && req.url.startsWith('/api') && routeKey) {
    const urlObj = new URL(req.url, 'http://localhost');
    urlObj.searchParams.delete('__route');
    const remainingQuery = urlObj.searchParams.toString();
    req.url = `/api/${routeKey}${remainingQuery ? `?${remainingQuery}` : ''}`;
  }

  // Ensure req.query doesn't leak internal __route parameter to handlers
  if (req.query && '__route' in req.query) {
    delete req.query.__route;
  }

  // Root API status endpoint
  if (!routeKey) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'ok',
      service: 'ptvpro-api',
      version: '1.0.0',
      routes: Object.keys(routes),
    }));
    return;
  }

  const routeHandler = routes[routeKey];
  if (!routeHandler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: `Endpoint tidak ditemukan: /api/${routeKey}`,
      code: 'endpoint_not_found',
    }));
    return;
  }

  try {
    await routeHandler(req, res);
  } catch (err: any) {
    console.error(`[Router Error] Failure in route /api/${routeKey}:`, err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: err?.message || 'Terjadi kesalahan internal server.',
        code: 'internal_server_error',
        route: routeKey,
      }));
    }
  }
}
