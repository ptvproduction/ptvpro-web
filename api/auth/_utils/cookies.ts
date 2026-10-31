export interface CookieOptions {
  maxAge?: number; // in seconds
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  path?: string;
  domain?: string;
}

export function parseCookies(cookieHeader?: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const list: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (!name) return;
    try {
      list[name] = decodeURIComponent(parts.join('='));
    } catch {
      // An unrelated malformed cookie must not abort session validation.
    }
  });
  return list;
}

export function serializeCookie(name: string, val: string, options: CookieOptions = {}): string {
  const enc = encodeURIComponent;
  let cookie = `${enc(name)}=${enc(val)}`;

  if (options.maxAge != null) {
    cookie += `; Max-Age=${Math.floor(options.maxAge)}`;
  }
  if (options.domain) {
    cookie += `; Domain=${options.domain}`;
  }
  if (options.path) {
    cookie += `; Path=${options.path}`;
  } else {
    cookie += '; Path=/';
  }
  if (options.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }
  if (options.httpOnly !== false) {
    cookie += '; HttpOnly';
  }
  if (options.secure) {
    cookie += '; Secure';
  }
  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite}`;
  } else {
    cookie += '; SameSite=Lax';
  }

  return cookie;
}

export function appendSetCookieHeader(
  res: { getHeader: (name: string) => any; setHeader: (name: string, val: any) => any },
  cookieStr: string
): void {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookieStr);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieStr]);
  } else {
    res.setHeader('Set-Cookie', [String(existing), cookieStr]);
  }
}
