// PTVPRO Centralized Serverless API Entrypoint Router
// Consolidates all 25 individual backend routes under a single Vercel function
// to stay strictly within the Vercel Hobby 12-function cap while preserving 100%
// of route contracts, auth, and backend capabilities.

type RouteHandler = (req: any, res: any) => Promise<unknown> | unknown;

// Static string imports inside functions allow @vercel/nft to trace and bundle each file,
// while lazy evaluation prevents top-level crashes and isolates failures.
export const routeLoaders: Record<string, () => Promise<{ default: RouteHandler }>> = {
  'acara': () => import('./_routes/acara'),
  'akses': () => import('./_routes/akses'),
  'broadcast': () => import('./_routes/broadcast'),
  'catatan': () => import('./_routes/catatan'),
  'dokumen': () => import('./_routes/dokumen'),
  'finance': () => import('./_routes/finance'),
  'inventaris': () => import('./_routes/inventaris'),
  'kontak': () => import('./_routes/kontak'),
  'kru': () => import('./_routes/kru'),
  'lapor-kerusakan': () => import('./_routes/lapor-kerusakan'),
  'lost-found': () => import('./_routes/lost-found'),
  'peminjaman': () => import('./_routes/peminjaman'),
  'planner': () => import('./_routes/planner'),
  'portal': () => import('./_routes/portal'),
  'portofolio': () => import('./_routes/portofolio'),
  'upload-avatar': () => import('./_routes/upload-avatar'),
  'verifikasi-surat': () => import('./_routes/verifikasi-surat'),
  'auth/change-password': () => import('./_routes/auth/change-password'),
  'auth/login': () => import('./_routes/auth/login'),
  'auth/logout': () => import('./_routes/auth/logout'),
  'auth/session': () => import('./_routes/auth/session'),
  'auth/google/callback': () => import('./_routes/auth/google/callback'),
  'auth/google/login': () => import('./_routes/auth/google/login'),
  'auth/google/status': () => import('./_routes/auth/google/status'),
  'auth/google/unlink': () => import('./_routes/auth/google/unlink'),
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
      routes: Object.keys(routeLoaders),
    }));
    return;
  }

  const loader = routeLoaders[routeKey];
  if (!loader) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: `Endpoint tidak ditemukan: /api/${routeKey}`,
      code: 'endpoint_not_found',
    }));
    return;
  }

  try {
    const module = await loader();
    const routeHandler = module.default || module;
    if (typeof routeHandler !== 'function') {
      throw new Error(`Handler for /api/${routeKey} is not a function`);
    }
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
        stack: process.env.NODE_ENV !== 'production' ? err?.stack : undefined,
      }));
    }
  }
}
