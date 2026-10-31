var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// api/_routes/auth/_utils/cookies.ts
var cookies_exports = {};
__export(cookies_exports, {
  appendSetCookieHeader: () => appendSetCookieHeader,
  parseCookies: () => parseCookies,
  serializeCookie: () => serializeCookie
});
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  const list = {};
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts.shift()?.trim();
    if (!name) return;
    try {
      list[name] = decodeURIComponent(parts.join("="));
    } catch {
    }
  });
  return list;
}
function serializeCookie(name, val, options = {}) {
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
    cookie += "; Path=/";
  }
  if (options.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }
  if (options.httpOnly !== false) {
    cookie += "; HttpOnly";
  }
  if (options.secure) {
    cookie += "; Secure";
  }
  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite}`;
  } else {
    cookie += "; SameSite=Lax";
  }
  return cookie;
}
function appendSetCookieHeader(res, cookieStr) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookieStr);
  } else if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookieStr]);
  } else {
    res.setHeader("Set-Cookie", [String(existing), cookieStr]);
  }
}
var init_cookies = __esm({
  "api/_routes/auth/_utils/cookies.ts"() {
    "use strict";
  }
});

// api/_routes/auth/_utils/crypto.ts
var crypto_exports = {};
__export(crypto_exports, {
  base64UrlDecode: () => base64UrlDecode,
  base64UrlEncode: () => base64UrlEncode,
  createHmacState: () => createHmacState,
  generatePkceChallenge: () => generatePkceChallenge,
  generatePkceVerifier: () => generatePkceVerifier,
  signSessionToken: () => signSessionToken,
  verifyGoogleIdToken: () => verifyGoogleIdToken,
  verifyHmacState: () => verifyHmacState,
  verifySessionToken: () => verifySessionToken
});
import { randomBytes, createHash, createHmac, timingSafeEqual, createVerify, createPublicKey } from "node:crypto";
function base64UrlEncode(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
}
function generatePkceVerifier() {
  return base64UrlEncode(randomBytes(32));
}
function generatePkceChallenge(verifier) {
  return base64UrlEncode(createHash("sha256").update(verifier).digest());
}
function createHmacState(payload, secret) {
  if (!secret) throw new Error("Konfigurasi penandatanganan sesi tidak tersedia.");
  const jsonStr = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(Buffer.from(jsonStr, "utf-8"));
  const hmac = createHmac("sha256", secret).update(payloadB64).digest();
  const sigB64 = base64UrlEncode(hmac);
  return `${payloadB64}.${sigB64}`;
}
function verifyHmacState(stateStr, secret) {
  if (!secret || !stateStr || !stateStr.includes(".")) return null;
  const parts = stateStr.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const expectedHmac = createHmac("sha256", secret).update(payloadB64).digest();
  const actualHmac = base64UrlDecode(sigB64);
  if (expectedHmac.length !== actualHmac.length) return null;
  if (!timingSafeEqual(expectedHmac, actualHmac)) return null;
  try {
    const jsonStr = base64UrlDecode(payloadB64).toString("utf-8");
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}
function signSessionToken(payload, secret) {
  if (!secret) throw new Error("Konfigurasi penandatanganan sesi tidak tersedia.");
  const { token_fingerprint: _derived, ...signedPayload } = payload;
  const jsonStr = JSON.stringify(signedPayload);
  const payloadB64 = base64UrlEncode(Buffer.from(jsonStr, "utf-8"));
  const sig = createHmac("sha256", secret).update(payloadB64).digest();
  const sigB64 = base64UrlEncode(sig);
  return `${payloadB64}.${sigB64}`;
}
function verifySessionToken(tokenStr, secret) {
  if (!secret || !tokenStr || !tokenStr.includes(".")) return null;
  const parts = tokenStr.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const expectedSig = createHmac("sha256", secret).update(payloadB64).digest();
  const actualSig = base64UrlDecode(sigB64);
  if (expectedSig.length !== actualSig.length) return null;
  if (!timingSafeEqual(expectedSig, actualSig)) return null;
  try {
    const jsonStr = base64UrlDecode(payloadB64).toString("utf-8");
    const payload = JSON.parse(jsonStr);
    if (!payload || typeof payload !== "object" || typeof payload.account_id !== "string" || !payload.account_id.trim() || typeof payload.identity_id !== "string" || !payload.identity_id.trim() || !Number.isSafeInteger(payload.iat) || payload.iat <= 0 || !Number.isSafeInteger(payload.exp) || payload.exp <= 0) return null;
    const now = Date.now();
    const expMs = payload.exp > 1e10 ? payload.exp : payload.exp * 1e3;
    if (now >= expMs || payload.iat * 1e3 > now || expMs <= payload.iat * 1e3) {
      return null;
    }
    if (payload.session_id !== void 0 && (typeof payload.session_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.session_id))) return null;
    Object.defineProperty(payload, "token_fingerprint", { value: createHash("sha256").update(`${payloadB64}.${base64UrlEncode(expectedSig)}`).digest("hex"), enumerable: false });
    return payload;
  } catch {
    return null;
  }
}
async function getGoogleJwksKeys() {
  const now = Date.now();
  if (googleJwksCache && now - googleJwksCache.fetchedAt < 3600 * 1e3) {
    return googleJwksCache.keys;
  }
  const resp = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!resp.ok) {
    throw new Error("Gagal mengunduh Google public JWKS certs.");
  }
  const data = await resp.json();
  if (Array.isArray(data.keys)) {
    googleJwksCache = { keys: data.keys, fetchedAt: now };
    return data.keys;
  }
  return [];
}
async function verifyGoogleIdToken(idToken, expectedClientId, expectedNonce) {
  if (!idToken || !idToken.includes(".")) return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const headerStr = base64UrlDecode(parts[0]).toString("utf-8");
    const header = JSON.parse(headerStr);
    if (header.alg !== "RS256" || !header.kid) {
      return null;
    }
    const keys = await getGoogleJwksKeys();
    const matchingKey = keys.find((k) => k.kid === header.kid);
    if (!matchingKey) {
      return null;
    }
    const publicKey = createPublicKey({ key: matchingKey, format: "jwk" });
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    const signatureBuffer = base64UrlDecode(parts[2]);
    const isSignatureValid = verifier.verify(publicKey, signatureBuffer);
    if (!isSignatureValid) {
      return null;
    }
    const payloadStr = base64UrlDecode(parts[1]).toString("utf-8");
    const claims = JSON.parse(payloadStr);
    if (!claims || typeof claims.sub !== "string" || !claims.sub.trim() || !Number.isSafeInteger(claims.exp) || !Number.isSafeInteger(claims.iat) || claims.iat <= 0 || claims.exp <= claims.iat) return null;
    if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") {
      return null;
    }
    if (claims.aud !== expectedClientId) {
      return null;
    }
    const nowSec = Math.floor(Date.now() / 1e3);
    if (claims.exp < nowSec - 60 || claims.iat > nowSec + 60) {
      return null;
    }
    if (expectedNonce && claims.nonce !== expectedNonce) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}
var googleJwksCache;
var init_crypto = __esm({
  "api/_routes/auth/_utils/crypto.ts"() {
    "use strict";
    googleJwksCache = null;
  }
});

// src/core/policy/capabilities.ts
var ALL_CAPABILITIES;
var init_capabilities = __esm({
  "src/core/policy/capabilities.ts"() {
    "use strict";
    ALL_CAPABILITIES = [
      "hub.access",
      "events.view",
      "events.create",
      "events.edit",
      "events.delete",
      "events.rundown.manage",
      "calendar.view",
      "inventory.view",
      "inventory.create",
      "inventory.edit",
      "inventory.delete",
      "inventory.units.manage",
      "inventory.valuation.view",
      "inventory.valuation.manage",
      "loans.view",
      "loans.checkout",
      "loans.return",
      "loans.manage",
      "damage.view",
      "damage.report",
      "damage.qc.approve",
      "lostfound.view",
      "lostfound.report",
      "lostfound.manage",
      "crew.view",
      "crew.create",
      "crew.edit",
      "crew.status.manage",
      "crew.permissions.manage",
      "id.view",
      "id.export",
      "documents.view",
      "documents.request",
      "documents.generate",
      "documents.approve",
      "documents.archive.view",
      "documents.archive.manage",
      "finance.view",
      "finance.manage",
      "finance.operator",
      "contacts.internal.view",
      "contacts.external.view",
      "contacts.external.manage",
      "broadcast.view",
      "broadcast.dispatch",
      "projecthaul.view",
      "projecthaul.manage",
      "notes.view",
      "notes.create",
      "notes.manage",
      "settings.personal",
      "settings.system",
      "audit.logs.view"
    ];
  }
});

// src/core/policy/profiles.ts
var PROFILE_CAPABILITIES;
var init_profiles = __esm({
  "src/core/policy/profiles.ts"() {
    "use strict";
    init_capabilities();
    PROFILE_CAPABILITIES = {
      root_executive: new Set(ALL_CAPABILITIES),
      eksekutif: /* @__PURE__ */ new Set([
        "hub.access",
        "events.view",
        "events.create",
        "events.edit",
        "events.delete",
        "events.rundown.manage",
        "calendar.view",
        "inventory.view",
        "inventory.create",
        "inventory.edit",
        "inventory.delete",
        "inventory.units.manage",
        "inventory.valuation.view",
        "inventory.valuation.manage",
        "loans.view",
        "loans.checkout",
        "loans.return",
        "loans.manage",
        "damage.view",
        "damage.report",
        "damage.qc.approve",
        "lostfound.view",
        "lostfound.report",
        "lostfound.manage",
        "crew.view",
        "crew.create",
        "crew.edit",
        "crew.status.manage",
        "crew.permissions.manage",
        "id.view",
        "id.export",
        "documents.view",
        "documents.request",
        "documents.generate",
        "documents.approve",
        "documents.archive.view",
        "documents.archive.manage",
        "finance.view",
        "finance.manage",
        "finance.operator",
        "contacts.internal.view",
        "contacts.external.view",
        "contacts.external.manage",
        "broadcast.view",
        "broadcast.dispatch",
        "projecthaul.view",
        "projecthaul.manage",
        "notes.view",
        "notes.create",
        "notes.manage",
        "settings.personal",
        "settings.system",
        "audit.logs.view"
      ]),
      kepolo_kepali: /* @__PURE__ */ new Set([
        "hub.access",
        "events.view",
        "events.create",
        "events.edit",
        "events.rundown.manage",
        "calendar.view",
        "inventory.view",
        "inventory.create",
        "inventory.edit",
        "inventory.units.manage",
        "inventory.valuation.view",
        "loans.view",
        "loans.checkout",
        "loans.return",
        "damage.view",
        "damage.report",
        "damage.qc.approve",
        "lostfound.view",
        "lostfound.report",
        "lostfound.manage",
        "crew.view",
        "id.view",
        "id.export",
        "documents.view",
        "documents.request",
        "documents.generate",
        "documents.archive.view",
        "contacts.internal.view",
        "contacts.external.view",
        "contacts.external.manage",
        "broadcast.view",
        "projecthaul.view",
        "projecthaul.manage",
        "notes.view",
        "notes.create",
        "notes.manage",
        "settings.personal"
      ]),
      crew: /* @__PURE__ */ new Set([
        "hub.access",
        "events.view",
        "calendar.view",
        "inventory.view",
        "inventory.valuation.view",
        "loans.view",
        "loans.checkout",
        "loans.return",
        "damage.view",
        "damage.report",
        "lostfound.view",
        "lostfound.report",
        "crew.view",
        "id.view",
        "id.export",
        "documents.view",
        "documents.request",
        "contacts.internal.view",
        "contacts.external.view",
        "broadcast.view",
        "projecthaul.view",
        "notes.view",
        "notes.create",
        "settings.personal"
      ]),
      pembina: /* @__PURE__ */ new Set([
        "hub.access",
        "events.view",
        "calendar.view",
        "inventory.view",
        "loans.view",
        "damage.view",
        "lostfound.view",
        "broadcast.view",
        "notes.view",
        "settings.personal"
      ])
    };
  }
});

// src/core/policy/policyEngine.ts
function hasCapability(context, capability) {
  if (!context || typeof context !== "object") {
    return false;
  }
  const assignedProfiles = Array.isArray(context.assigned_profiles) ? context.assigned_profiles : [];
  if (assignedProfiles.includes("root_executive")) {
    return true;
  }
  if (context.status_akun !== "active") {
    return false;
  }
  if (capability.startsWith("finance.") && capability !== "finance.view_own") {
    const rawCategory = (context.category || context.kategori || context.kategori_personel || "").toLowerCase().trim();
    if (rawCategory === "pembina" || rawCategory === "pengarah") {
      return false;
    }
  }
  const deniedOverrides = Array.isArray(context.denied_overrides) ? context.denied_overrides : [];
  if (deniedOverrides.includes(capability)) {
    return false;
  }
  const allowedOverrides = Array.isArray(context.allowed_overrides) ? context.allowed_overrides : [];
  if (allowedOverrides.includes(capability)) {
    return true;
  }
  if (context.capabilities_verified_live && capability === "finance.view_own") {
    return !assignedProfiles.includes("pembina") && (assignedProfiles.includes("crew") || assignedProfiles.includes("eksekutif") || assignedProfiles.includes("root_executive"));
  }
  if (context.capabilities_verified_live) {
    return Array.isArray(context.capabilities) && context.capabilities.includes(capability);
  }
  if (capability === "finance.view_own") {
    if (assignedProfiles.includes("pembina") && !assignedProfiles.includes("crew") && !assignedProfiles.includes("eksekutif")) {
      return false;
    }
    return assignedProfiles.includes("crew") || assignedProfiles.includes("eksekutif") || assignedProfiles.includes("root_executive");
  }
  for (const profile of assignedProfiles) {
    const profileCaps = PROFILE_CAPABILITIES[profile];
    if (profileCaps && profileCaps.has(capability)) {
      return true;
    }
  }
  const directCapabilities = Array.isArray(context.capabilities) ? context.capabilities : [];
  if (directCapabilities.includes(capability)) {
    return true;
  }
  return false;
}
var init_policyEngine = __esm({
  "src/core/policy/policyEngine.ts"() {
    "use strict";
    init_profiles();
  }
});

// src/core/policy/index.ts
var init_policy = __esm({
  "src/core/policy/index.ts"() {
    "use strict";
    init_capabilities();
    init_profiles();
    init_policyEngine();
  }
});

// api/_routes/auth/_utils/legacyPassword.ts
import { compare } from "bcryptjs";
async function verifyLegacyBcryptPassword(password, encoded) {
  if (typeof password !== "string" || !password || Buffer.byteLength(password, "utf8") > 72 || typeof encoded !== "string" || !/^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/.test(encoded)) return false;
  try {
    return await compare(password, encoded);
  } catch {
    return false;
  }
}
var init_legacyPassword = __esm({
  "api/_routes/auth/_utils/legacyPassword.ts"() {
    "use strict";
  }
});

// api/_routes/auth/_utils/financeLocalHarness.ts
function financeBackendUrl() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  if (process.env.PTV_FINANCE_LOCAL_E2E === "true") {
    if (process.env.NODE_ENV !== "test" || process.env.VERCEL || process.env.VERCEL_ENV || url !== "http://127.0.0.1:55441") throw new Error("Isolated Finance harness unavailable");
    return url;
  }
  if (!/^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/.test(url)) throw new Error("Staging backend unavailable");
  return url;
}
var init_financeLocalHarness = __esm({
  "api/_routes/auth/_utils/financeLocalHarness.ts"() {
    "use strict";
  }
});

// api/_routes/auth/_utils/portalLifecycle.ts
import { createClient } from "@supabase/supabase-js";
import { createHash as createHash2, createHmac as createHmac2, randomBytes as randomBytes2, randomUUID } from "node:crypto";
import { isIP } from "node:net";
function lifecycleClient() {
  const url = financeBackendUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Auth backend unavailable");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(1e4) }) } });
}
function sessionArguments(session) {
  if (!session.token_fingerprint || !/^[0-9a-f]{64}$/.test(session.token_fingerprint)) throw new Error("Verified token required");
  return {
    p_actor: session.account_id,
    p_identity: session.identity_id,
    p_iat: session.iat,
    p_exp: session.exp > 1e10 ? Math.floor(session.exp / 1e3) : session.exp,
    p_session_id: session.session_id || null,
    p_fingerprint: session.token_fingerprint
  };
}
async function portalSessionValid(db, session) {
  const result = await db.rpc("rpc_portal_session_valid", sessionArguments(session));
  if (result.error) throw new Error("Auth session backend unavailable");
  return result.data === true;
}
function trustedIngress(req) {
  let value;
  if (process.env.VERCEL === "1") {
    const realIp = req.headers["x-real-ip"];
    if (typeof realIp === "string" && realIp.trim()) {
      value = realIp.trim();
    } else {
      const fwd = req.headers["x-forwarded-for"];
      if (typeof fwd === "string") {
        value = fwd.split(",")[0].trim();
      }
    }
  } else {
    value = typeof req.socket?.remoteAddress === "string" ? req.socket.remoteAddress : void 0;
  }
  if (typeof value !== "string" || !isIP(value.trim())) throw new Error("Trusted ingress unavailable");
  const ip = value.trim().toLowerCase();
  const ipv4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const privateLan = isIP(ipv4) === 4 && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ipv4);
  const devLan = process.env.NODE_ENV === "development" && process.env.PTV_AUTH_DEV_LAN_ENABLED === "true" && privateLan;
  if (process.env.VERCEL !== "1" && !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip) && !devLan) throw new Error("Trusted ingress unavailable");
  return isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname : ip;
}
async function authenticatePortalPassword(req, identifier, password) {
  try {
    return await authenticatePassword(req, identifier, password);
  } catch {
    return { status: 503, error: "Autentikasi sementara tidak tersedia." };
  }
}
async function authenticatePassword(req, identifier, password) {
  if (!passwordLoginEnabled()) return { status: 403, error: "Login password belum tersedia secara aman." };
  const secret = process.env.AUTH_SECRET || "";
  if (secret.length < 32) return { status: 503, error: "Autentikasi belum tersedia." };
  const db = lifecycleClient();
  const ingress = trustedIngress(req);
  const key = (domain, value) => createHmac2("sha256", secret).update(domain + "\0" + value).digest("hex");
  const attempt = randomUUID();
  const proof = createHash2("sha256").update(randomBytes2(32)).digest("hex");
  const begin = await db.rpc("rpc_portal_login_begin", {
    p_id: attempt,
    p_secret_hash: proof,
    p_identifier: identifier,
    p_identifier_key: key("identifier", identifier.trim().toLowerCase()),
    p_ingress_key: key("ingress", ingress)
  });
  if (begin.error) return { status: 503, error: "Autentikasi sementara tidak tersedia." };
  if (!begin.data?.enabled) return { status: 403, error: "Login password belum tersedia secara aman." };
  if (!begin.data.allowed) return { status: 429, error: "Terlalu banyak percobaan. Coba lagi nanti.", retryAfter: Math.min(3600, Math.max(1, Number(begin.data.retry_after) || 900)) };
  const dummy = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
  const supported = typeof begin.data.hash === "string" && /^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/.test(begin.data.hash);
  const encoded = supported ? begin.data.hash : dummy;
  const matched = await verifyLegacyBcryptPassword(password, encoded) && supported && !!begin.data.account_id;
  const ttl = Number(begin.data.session_seconds);
  if (!Number.isInteger(ttl) || ttl < 300 || ttl > 604800) throw new Error("Session policy unavailable");
  const now = Math.floor(Date.now() / 1e3);
  let session;
  let token;
  let failureDetail = null;
  if (matched) {
    const { resolveLiveAccess: resolveLiveAccess2, LiveAccessUnavailableError: LiveAccessUnavailableError2 } = await Promise.resolve().then(() => (init_liveAccess(), liveAccess_exports));
    try {
      const live = await resolveLiveAccess2(db, { account_id: begin.data.account_id, identity_id: begin.data.identity_id, iat: now }, { issuingSession: true });
      const registry = await db.from("capability_registry").select("key");
      if (registry.error || !registry.data) throw new Error("Auth registry unavailable");
      session = {
        account_id: live.account.id,
        identity_id: live.identity.id,
        ptv_id: live.identity.ptv_id,
        full_name: live.identity.full_name,
        username: live.account.username,
        avatar_url: live.identity.avatar_url,
        status_akun: "active",
        status_organisasi: live.membership.status_organisasi,
        division: live.membership.division_id,
        position: live.membership.position_title,
        assigned_profiles: live.profiles,
        capabilities: registry.data.filter((cap) => live.can(cap.key)).map((cap) => cap.key),
        iat: now,
        exp: now + ttl,
        session_id: randomUUID()
      };
      token = signSessionToken(session, secret);
    } catch (err) {
      session = void 0;
      token = void 0;
      if (err instanceof LiveAccessUnavailableError2) {
        failureDetail = { status: 503, error: "Layanan verifikasi hak akses sementara tidak tersedia." };
      } else {
        const { data: acc } = await db.from("user_account").select("status_akun, lockout_until").eq("id", begin.data.account_id).single();
        if (acc && acc.status_akun !== "active") {
          failureDetail = { status: 403, error: "Akun Anda sedang berstatus nonaktif. Silakan hubungi pengurus atau administrator." };
        } else if (acc && acc.lockout_until && Date.parse(acc.lockout_until) > Date.now()) {
          failureDetail = { status: 423, error: "Akun Anda sementara terkunci karena terlalu banyak percobaan. Coba lagi nanti." };
        } else {
          failureDetail = { status: 403, error: "Akses ditolak: Akun Anda tidak memiliki izin untuk mengakses PTVPRO Hub." };
        }
      }
    }
  }
  const finish = await db.rpc("rpc_portal_login_finish", {
    p_id: attempt,
    p_secret_hash: proof,
    p_success: !!session,
    p_fingerprint: token ? fingerprintSession(token) : null,
    p_session_id: session?.session_id || null,
    p_iat: now,
    p_exp: session?.exp || now
  });
  if (finish.error) return { status: 503, error: "Autentikasi sementara tidak tersedia." };
  if (finish.data !== true || !session || !token) {
    if (failureDetail) return failureDetail;
    return { status: 401, error: "Identitas atau password tidak valid." };
  }
  return { status: 200, session, token };
}
var lifecycleEnabled, passwordLoginEnabled, sessionNeedsRegistry, fingerprintSession;
var init_portalLifecycle = __esm({
  "api/_routes/auth/_utils/portalLifecycle.ts"() {
    "use strict";
    init_legacyPassword();
    init_crypto();
    init_financeLocalHarness();
    lifecycleEnabled = () => process.env.PTV_AUTH_LIFECYCLE_ENABLED === "true";
    passwordLoginEnabled = () => lifecycleEnabled() && process.env.PTV_PASSWORD_LOGIN_ENABLED === "true";
    sessionNeedsRegistry = (session) => lifecycleEnabled() || session.session_id !== void 0;
    fingerprintSession = (token) => createHash2("sha256").update(token).digest("hex");
  }
});

// api/_routes/positionMapping.ts
function formatPositionMappingsAsArray(dict) {
  if (!dict) return [];
  if (Array.isArray(dict)) {
    return dict.filter((item) => item && typeof item.position === "string" && Array.isArray(item.capabilities));
  }
  return Object.entries(dict).map(([pos, caps]) => ({
    position: pos,
    capabilities: Array.isArray(caps) ? caps : [],
    description: `Izin bawaan untuk jabatan ${pos}`
  }));
}
function formatPositionMappingsAsRecord(input) {
  if (!input) return { ...DEFAULT_POSITION_CAPABILITIES };
  if (Array.isArray(input)) {
    const res = {};
    for (const item of input) {
      if (item && item.position) {
        res[item.position] = Array.isArray(item.capabilities) ? item.capabilities : [];
      }
    }
    return res;
  }
  return { ...input };
}
async function getPositionCapabilityMappings(db) {
  const now = Date.now();
  if (cachedMappings && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedMappings;
  }
  try {
    const { data: portalRow, error: portalErr } = await db.from("ptv_portal_settings").select("draft_payload").eq("id", "position_capability_mappings").maybeSingle();
    if (!portalErr && portalRow?.draft_payload?.position_mappings) {
      const customMappings = portalRow.draft_payload.position_mappings;
      cachedMappings = { ...DEFAULT_POSITION_CAPABILITIES, ...customMappings };
      lastCacheTime = now;
      return cachedMappings;
    }
    const { data: row, error } = await db.from("legacy_archive_kru").select("metadata_json").eq("source_key", SYSTEM_CONFIG_KEY).maybeSingle();
    if (!error && row?.metadata_json?.position_mappings) {
      const customMappings = row.metadata_json.position_mappings;
      cachedMappings = { ...DEFAULT_POSITION_CAPABILITIES, ...customMappings };
      lastCacheTime = now;
      return cachedMappings;
    }
  } catch (err) {
    console.warn("[PositionMapping] Failed to load custom mapping, using defaults:", err);
  }
  cachedMappings = { ...DEFAULT_POSITION_CAPABILITIES };
  lastCacheTime = now;
  return cachedMappings;
}
async function savePositionCapabilityMappings(db, mappings, actorAccountId) {
  const normalizedRecord = formatPositionMappingsAsRecord(mappings);
  const meta = {
    position_mappings: normalizedRecord,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_by_account_id: actorAccountId
  };
  const { error: portalError } = await db.from("ptv_portal_settings").upsert({
    id: "position_capability_mappings",
    is_published: true,
    draft_payload: meta,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (portalError) {
    console.error("[PositionMapping] Failed to save mapping to ptv_portal_settings:", portalError);
    throw new Error(`Gagal menyimpan mapping jabatan ke tabel konfigurasi: ${portalError.message}`);
  }
  try {
    const payload = {
      archive_id: "00000000-0000-0000-0000-000000000099",
      source_key: SYSTEM_CONFIG_KEY,
      production_id: "00000000-0000-0000-0000-000000000099",
      ptv_id: SYSTEM_CONFIG_PTV_ID,
      full_name: "System Position Permissions Config",
      username: "system_config",
      divisi: "System",
      jabatan: "Config",
      angkatan: "0",
      status: "nonaktif",
      role: "kru",
      metadata_json: meta,
      imported_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await db.from("legacy_archive_kru").upsert(payload);
  } catch {
  }
  cachedMappings = { ...DEFAULT_POSITION_CAPABILITIES, ...normalizedRecord };
  lastCacheTime = Date.now();
  return true;
}
function resolvePositionCapabilities(positionTitle, mappings) {
  if (!positionTitle) return mappings["Kru Operasional"] || [];
  const trimmed = positionTitle.trim();
  if (mappings[trimmed]) {
    return mappings[trimmed];
  }
  const lower = trimmed.toLowerCase();
  for (const [key, caps] of Object.entries(mappings)) {
    if (key.toLowerCase() === lower) {
      return caps;
    }
  }
  if (/ketua\s*umum/i.test(trimmed)) return mappings["Ketua Umum"] || [];
  if (/ketua\s*divisi/i.test(trimmed)) return mappings["Ketua Divisi"] || [];
  if (/ketua/i.test(trimmed)) return mappings["Ketua"] || [];
  if (/bendahara/i.test(trimmed) && /sekretaris/i.test(trimmed)) return mappings["Sekretaris & Bendahara"] || [];
  if (/bendahara/i.test(trimmed)) return mappings["Bendahara"] || [];
  if (/sekretaris/i.test(trimmed)) return mappings["Sekretaris"] || [];
  if (/koor|direktur|director/i.test(trimmed)) return mappings["Koor Operasional"] || [];
  if (/editor/i.test(trimmed)) return mappings["Editor"] || [];
  if (/layout/i.test(trimmed)) return mappings["Layouter"] || [];
  if (/technic|hardware/i.test(trimmed)) return mappings["Technical"] || [];
  if (/creative|kreatif/i.test(trimmed)) return mappings["Creative"] || [];
  if (/engagement|medsos|humas/i.test(trimmed)) return mappings["Engagement"] || [];
  if (/pembina/i.test(trimmed)) return mappings["Pembina PTV"] || mappings["Pembina"] || [];
  if (/pengarah/i.test(trimmed)) return mappings["Pengarah"] || [];
  return mappings["Kru Operasional"] || [];
}
var SYSTEM_CONFIG_KEY, SYSTEM_CONFIG_PTV_ID, DEFAULT_POSITION_CAPABILITIES, cachedMappings, lastCacheTime, CACHE_TTL_MS;
var init_positionMapping = __esm({
  "api/_routes/positionMapping.ts"() {
    "use strict";
    SYSTEM_CONFIG_KEY = "system_position_capability_mapping";
    SYSTEM_CONFIG_PTV_ID = "PTV-CONFIG-01";
    DEFAULT_POSITION_CAPABILITIES = {
      "Ketua Umum": [
        "hub.access",
        "events.view",
        "events.create",
        "events.edit",
        "events.delete",
        "events.rundown.manage",
        "calendar.view",
        "inventory.view",
        "inventory.create",
        "inventory.edit",
        "inventory.delete",
        "inventory.units.manage",
        "inventory.valuation.view",
        "loans.view",
        "loans.checkout",
        "loans.return",
        "loans.manage",
        "damage.view",
        "damage.report",
        "damage.qc.approve",
        "lostfound.view",
        "lostfound.report",
        "lostfound.manage",
        "crew.view",
        "crew.create",
        "crew.edit",
        "crew.status.manage",
        "crew.permissions.manage",
        "id.view",
        "id.export",
        "documents.view",
        "documents.request",
        "documents.generate",
        "documents.approve",
        "documents.archive.view",
        "documents.archive.manage",
        "finance.view",
        "finance.manage",
        "contacts.internal.view",
        "contacts.external.view",
        "contacts.external.manage",
        "broadcast.view",
        "broadcast.dispatch",
        "projecthaul.view",
        "projecthaul.manage",
        "notes.view",
        "notes.create",
        "notes.manage",
        "settings.personal",
        "settings.system",
        "audit.logs.view"
      ],
      "Ketua": [
        "hub.access",
        "events.view",
        "events.create",
        "events.edit",
        "events.rundown.manage",
        "calendar.view",
        "inventory.view",
        "inventory.create",
        "inventory.edit",
        "loans.view",
        "loans.checkout",
        "loans.return",
        "loans.manage",
        "damage.view",
        "damage.report",
        "crew.view",
        "crew.create",
        "crew.edit",
        "documents.view",
        "documents.request",
        "documents.generate",
        "documents.approve",
        "finance.view",
        "contacts.internal.view",
        "broadcast.view",
        "broadcast.dispatch",
        "projecthaul.view",
        "notes.view",
        "notes.create",
        "notes.manage",
        "settings.personal"
      ],
      "Ketua Divisi": [
        "hub.access",
        "events.view",
        "events.create",
        "events.edit",
        "events.rundown.manage",
        "calendar.view",
        "inventory.view",
        "inventory.create",
        "inventory.edit",
        "loans.view",
        "loans.checkout",
        "loans.return",
        "loans.manage",
        "damage.view",
        "damage.report",
        "crew.view",
        "crew.edit",
        "documents.view",
        "documents.request",
        "contacts.internal.view",
        "broadcast.view",
        "broadcast.dispatch",
        "projecthaul.view",
        "projecthaul.manage",
        "notes.view",
        "notes.create",
        "notes.manage",
        "settings.personal"
      ],
      "Sekretaris & Bendahara": [
        "hub.access",
        "events.view",
        "calendar.view",
        "inventory.view",
        "loans.view",
        "loans.checkout",
        "loans.return",
        "crew.view",
        "id.view",
        "id.export",
        "documents.view",
        "documents.request",
        "documents.generate",
        "documents.approve",
        "documents.archive.view",
        "documents.archive.manage",
        "finance.view",
        "finance.manage",
        "finance.operator",
        "finance.view_own",
        "contacts.internal.view",
        "broadcast.view",
        "notes.view",
        "notes.create",
        "notes.manage",
        "settings.personal"
      ],
      "Bendahara": [
        "hub.access",
        "events.view",
        "calendar.view",
        "inventory.view",
        "loans.view",
        "crew.view",
        "documents.view",
        "finance.view",
        "finance.manage",
        "finance.operator",
        "finance.view_own",
        "contacts.internal.view",
        "broadcast.view",
        "notes.view",
        "notes.create",
        "settings.personal"
      ],
      "Sekretaris": [
        "hub.access",
        "events.view",
        "calendar.view",
        "inventory.view",
        "loans.view",
        "crew.view",
        "documents.view",
        "documents.request",
        "documents.generate",
        "documents.approve",
        "documents.archive.view",
        "documents.archive.manage",
        "contacts.internal.view",
        "broadcast.view",
        "broadcast.dispatch",
        "notes.view",
        "notes.create",
        "notes.manage",
        "settings.personal"
      ],
      "Koor Operasional": [
        "hub.access",
        "events.view",
        "events.create",
        "events.edit",
        "events.rundown.manage",
        "calendar.view",
        "inventory.view",
        "inventory.create",
        "inventory.edit",
        "inventory.units.manage",
        "loans.view",
        "loans.checkout",
        "loans.return",
        "loans.manage",
        "damage.view",
        "damage.report",
        "damage.qc.approve",
        "lostfound.view",
        "lostfound.report",
        "lostfound.manage",
        "crew.view",
        "documents.view",
        "documents.request",
        "contacts.internal.view",
        "broadcast.view",
        "broadcast.dispatch",
        "projecthaul.view",
        "projecthaul.manage",
        "notes.view",
        "notes.create",
        "notes.manage",
        "settings.personal"
      ],
      "Editor": [
        "hub.access",
        "events.view",
        "calendar.view",
        "inventory.view",
        "loans.view",
        "loans.checkout",
        "loans.return",
        "damage.view",
        "damage.report",
        "crew.view",
        "documents.view",
        "documents.request",
        "contacts.internal.view",
        "broadcast.view",
        "notes.view",
        "notes.create",
        "settings.personal"
      ],
      "Layouter": [
        "hub.access",
        "events.view",
        "calendar.view",
        "inventory.view",
        "loans.view",
        "loans.checkout",
        "loans.return",
        "damage.view",
        "damage.report",
        "crew.view",
        "documents.view",
        "documents.request",
        "contacts.internal.view",
        "broadcast.view",
        "notes.view",
        "notes.create",
        "settings.personal"
      ],
      "Technical": [
        "hub.access",
        "events.view",
        "calendar.view",
        "inventory.view",
        "inventory.create",
        "inventory.edit",
        "inventory.units.manage",
        "loans.view",
        "loans.checkout",
        "loans.return",
        "loans.manage",
        "damage.view",
        "damage.report",
        "damage.qc.approve",
        "lostfound.view",
        "lostfound.report",
        "crew.view",
        "documents.view",
        "documents.request",
        "contacts.internal.view",
        "broadcast.view",
        "notes.view",
        "notes.create",
        "settings.personal"
      ],
      "Creative": [
        "hub.access",
        "events.view",
        "events.create",
        "events.edit",
        "calendar.view",
        "inventory.view",
        "loans.view",
        "loans.checkout",
        "loans.return",
        "crew.view",
        "documents.view",
        "documents.request",
        "contacts.internal.view",
        "broadcast.view",
        "projecthaul.view",
        "notes.view",
        "notes.create",
        "settings.personal"
      ],
      "Engagement": [
        "hub.access",
        "events.view",
        "calendar.view",
        "inventory.view",
        "loans.view",
        "loans.checkout",
        "loans.return",
        "crew.view",
        "documents.view",
        "contacts.internal.view",
        "contacts.external.view",
        "broadcast.view",
        "broadcast.dispatch",
        "notes.view",
        "notes.create",
        "settings.personal"
      ],
      "Kru Operasional": [
        "hub.access",
        "events.view",
        "calendar.view",
        "inventory.view",
        "loans.view",
        "loans.checkout",
        "loans.return",
        "damage.view",
        "damage.report",
        "lostfound.view",
        "lostfound.report",
        "crew.view",
        "documents.view",
        "documents.request",
        "contacts.internal.view",
        "broadcast.view",
        "notes.view",
        "notes.create",
        "settings.personal"
      ],
      "Kru": [
        "hub.access",
        "events.view",
        "calendar.view",
        "inventory.view",
        "loans.view",
        "loans.checkout",
        "loans.return",
        "damage.view",
        "damage.report",
        "lostfound.view",
        "lostfound.report",
        "crew.view",
        "documents.view",
        "documents.request",
        "contacts.internal.view",
        "broadcast.view",
        "notes.view",
        "notes.create",
        "settings.personal"
      ],
      "Pembina PTV": [
        "hub.access",
        "events.view",
        "calendar.view",
        "inventory.view",
        "loans.view",
        "crew.view",
        "documents.view",
        "contacts.internal.view",
        "broadcast.view",
        "notes.view",
        "settings.personal"
      ],
      "Pembina": [
        "hub.access",
        "events.view",
        "calendar.view",
        "inventory.view",
        "loans.view",
        "crew.view",
        "documents.view",
        "contacts.internal.view",
        "broadcast.view",
        "notes.view",
        "settings.personal"
      ],
      "Pengarah": [
        "hub.access",
        "events.view",
        "calendar.view",
        "inventory.view",
        "loans.view",
        "crew.view",
        "documents.view",
        "contacts.internal.view",
        "broadcast.view",
        "notes.view",
        "settings.personal"
      ]
    };
    cachedMappings = null;
    lastCacheTime = 0;
    CACHE_TTL_MS = 1e4;
  }
});

// api/_routes/auth/_utils/liveAccess.ts
var liveAccess_exports = {};
__export(liveAccess_exports, {
  LiveAccessUnavailableError: () => LiveAccessUnavailableError,
  resolveLiveAccess: () => resolveLiveAccess
});
async function resolveLiveAccess(db, session, options = {}) {
  if (sessionNeedsRegistry(session) && !options.issuingSession) {
    try {
      if (!await portalSessionValid(db, session)) throw new Error("forbidden");
    } catch (error) {
      if (error instanceof Error && error.message === "forbidden") throw error;
      throw new LiveAccessUnavailableError();
    }
  }
  const account = await db.from("user_account").select("id,identity_id,username,status_akun,lockout_until,tokens_valid_after,updated_at").eq("id", session.account_id).single();
  if (account.error && account.error.code !== "PGRST116") throw new LiveAccessUnavailableError();
  const row = account.data;
  if (session.identity_id !== void 0 && session.identity_id !== row?.identity_id) throw new Error("forbidden");
  if (account.error || !row || row.status_akun !== "active" || !Number.isFinite(session.iat) || session.iat <= 0 || session.iat * 1e3 > Date.now() || row.lockout_until && (!Number.isFinite(Date.parse(row.lockout_until)) || Date.parse(row.lockout_until) > Date.now()) || row.tokens_valid_after && (!Number.isFinite(Date.parse(row.tokens_valid_after)) || session.iat * 1e3 < Date.parse(row.tokens_valid_after))) throw new Error("forbidden");
  const [identity, membership, profiles, overrides, positionMappings] = await Promise.all([
    db.from("canonical_identity").select("id,ptv_id,full_name,avatar_url").eq("id", row.identity_id).single(),
    db.from("organization_membership").select("division_id,position_title,status_organisasi").eq("identity_id", row.identity_id).eq("organization_id", "ptv_studio").eq("is_current", true),
    db.from("account_profiles").select("profile_id").eq("account_id", row.id),
    db.from("account_capability_overrides").select("capability_key,override_type").eq("account_id", row.id),
    getPositionCapabilityMappings(db)
  ]);
  if (identity.error || membership.error || profiles.error || overrides.error) throw new LiveAccessUnavailableError();
  if (!identity.data || membership.data?.length !== 1) throw new Error("forbidden");
  if (!["active", "inactive", "archived"].includes(membership.data[0].status_organisasi)) throw new Error("forbidden");
  const assigned = (profiles.data || []).map((p) => p.profile_id);
  const grants = assigned.length ? await db.from("profile_capabilities").select("capability_key").in("profile_id", assigned) : { data: [], error: null };
  if (grants.error) throw new LiveAccessUnavailableError();
  const allow = (overrides.data || []).filter((o) => o.override_type === "allow").map((o) => o.capability_key);
  const deny = (overrides.data || []).filter((o) => o.override_type === "deny").map((o) => o.capability_key);
  const positionTitle = membership.data[0].position_title || "";
  const positionCaps = resolvePositionCapabilities(positionTitle, positionMappings);
  const profileCaps = (grants.data || []).map((g) => g.capability_key);
  const combinedCapabilities = [.../* @__PURE__ */ new Set([...profileCaps, ...positionCaps])];
  const isRoot = assigned.includes("root_executive");
  let finalCapabilities = combinedCapabilities;
  if (isRoot) {
    const registry = await db.from("capability_registry").select("key");
    if (!registry.error && registry.data) {
      finalCapabilities = registry.data.map((r) => r.key);
    }
  }
  const context = {
    status_akun: row.status_akun,
    status_organisasi: membership.data[0].status_organisasi,
    assigned_profiles: assigned,
    allowed_overrides: allow,
    denied_overrides: isRoot ? [] : deny,
    capabilities: finalCapabilities,
    capabilities_verified_live: true
  };
  if (!hasCapability(context, "hub.access")) throw new Error("forbidden");
  return {
    account: row,
    identity: identity.data,
    membership: membership.data[0],
    profiles: assigned,
    context,
    can: (cap) => hasCapability(context, cap)
  };
}
var LiveAccessUnavailableError;
var init_liveAccess = __esm({
  "api/_routes/auth/_utils/liveAccess.ts"() {
    "use strict";
    init_policy();
    init_portalLifecycle();
    init_positionMapping();
    LiveAccessUnavailableError = class extends Error {
      constructor() {
        super("forbidden");
        this.name = "LiveAccessUnavailableError";
      }
    };
  }
});

// api/_routes/auth/_utils/identity.ts
var identity_exports = {};
__export(identity_exports, {
  LOCAL_GOOGLE_MOCK_USERS: () => LOCAL_GOOGLE_MOCK_USERS,
  LOCAL_LINKED_GOOGLE_ACCOUNTS: () => LOCAL_LINKED_GOOGLE_ACCOUNTS,
  getGoogleOAuthStatus: () => getGoogleOAuthStatus,
  linkGoogleIdentityToAccount: () => linkGoogleIdentityToAccount,
  refreshLiveSession: () => refreshLiveSession,
  resolveIdentityByCredentials: () => resolveIdentityByCredentials,
  resolveIdentityByGoogleSub: () => resolveIdentityByGoogleSub,
  unlinkGoogleIdentityFromAccount: () => unlinkGoogleIdentityFromAccount,
  verifyAccountStatusLive: () => verifyAccountStatusLive
});
import { createClient as createClient2 } from "@supabase/supabase-js";
function createStagingIdentityClient(url, key) {
  if (!/^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/.test(url)) throw new Error("Identity backend must be verified Staging.");
  return createClient2(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function refreshLiveSession(session, issuingSession = false) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !/^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/.test(url)) return [];
  try {
    const db = createStagingIdentityClient(url, key);
    const live = await resolveLiveAccess(db, session, { issuingSession });
    if (session.identity_id !== live.identity.id) return [];
    const registry = await db.from("capability_registry").select("key");
    if (registry.error || !registry.data) return [];
    session.capabilities = registry.data.filter((r) => live.can(r.key)).map((r) => r.key);
    session.assigned_profiles = live.profiles;
    session.status_organisasi = live.membership.status_organisasi;
    session.division = live.membership.division_id;
    session.position = live.membership.position_title;
    return session.capabilities;
  } catch {
    return [];
  }
}
async function resolveIdentityByGoogleSub(googleSub, userEmail) {
  if (!googleSub) {
    return {
      success: false,
      error: "Google Subject ID (sub) tidak ditemukan.",
      code: "server_error"
    };
  }
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceRoleKey) {
    try {
      const supabase = createStagingIdentityClient(supabaseUrl, serviceRoleKey);
      const { data: credentialRow, error: credError } = await supabase.from("auth_credentials").select(`
          account_id,
          oauth_provider,
          oauth_subject_id,
          oauth_email,
          user_account:user_account!account_id (
            id,
            identity_id,
            username,
            status_akun,
            canonical_identity:canonical_identity!identity_id (
              id,
              ptv_id,
              full_name
            )
          )
        `).eq("oauth_provider", "google").eq("oauth_subject_id", googleSub).maybeSingle();
      if (credError) {
        return {
          success: false,
          error: `Database Auth Error: Gagal memeriksa auth_credentials (${credError.message || credError.code}).`,
          code: "server_error"
        };
      }
      if (!credentialRow || !credentialRow.user_account) {
        return {
          success: false,
          error: `Akun Google (${userEmail ? `${userEmail} [Subject ID: ${googleSub}]` : googleSub}) belum ditautkan ke akun kru resmi PTVPRO di database. Hubungi Administrator PTV untuk menautkan akun.`,
          code: "unlinked"
        };
      }
      const userAccount = credentialRow.user_account;
      if (userAccount.status_akun !== "active") {
        const ptvId2 = userAccount.canonical_identity?.ptv_id || "PTV-GUEST";
        return {
          success: false,
          error: `Akun (${ptvId2}) sedang berstatus "${userAccount.status_akun}". Operasi PTV Hub membutuhkan akun berstatus "active".`,
          code: "access_denied"
        };
      }
      const { data: profileRows } = await supabase.from("account_profiles").select("profile_id").eq("account_id", userAccount.id);
      const assignedProfiles = (profileRows || []).map((p) => p.profile_id);
      const { data: capRows } = await supabase.from("account_capability_overrides").select("capability_key, override_type").eq("account_id", userAccount.id);
      const allowedOverrides = (capRows || []).filter((c) => c.override_type === "allow").map((c) => c.capability_key);
      const deniedOverrides = (capRows || []).filter((c) => c.override_type === "deny").map((c) => c.capability_key);
      const hasHubAccess = assignedProfiles.length > 0 && !deniedOverrides.includes("hub.access") || allowedOverrides.includes("hub.access");
      if (!hasHubAccess) {
        const ptvId2 = userAccount.canonical_identity?.ptv_id || "PTV-GUEST";
        return {
          success: false,
          error: `Akses Ditolak: Akun (${ptvId2}) tidak memiliki izin akses PTV Hub (hub.access). Hubungi Administrator PTV.`,
          code: "access_denied"
        };
      }
      const ptvId = userAccount.canonical_identity?.ptv_id || "PTV-GUEST";
      const fullName = userAccount.canonical_identity?.full_name || userAccount.username;
      const now = Date.now();
      const session = {
        account_id: userAccount.id,
        identity_id: userAccount.identity_id,
        ptv_id: ptvId,
        full_name: fullName,
        username: userAccount.username,
        status_akun: userAccount.status_akun,
        status_organisasi: "active",
        assigned_profiles: assignedProfiles,
        capabilities: ["hub.access", ...allowedOverrides],
        iat: Math.floor(now / 1e3),
        exp: Math.floor(now / 1e3) + 7 * 24 * 3600
      };
      if (!(await refreshLiveSession(session, true)).includes("hub.access")) {
        return { success: false, code: "access_denied", error: "Akses akun tidak dapat diverifikasi." };
      }
      return { success: true, session };
    } catch (dbErr) {
      return {
        success: false,
        error: `Database Gateway Exception: ${dbErr?.message || "Gagal menghubungi database PostgreSQL."}`,
        code: "server_error"
      };
    }
  }
  if (process.env.NODE_ENV === "test") {
    let matchedUser = LOCAL_GOOGLE_MOCK_USERS[googleSub];
    if (!matchedUser) {
      for (const linked of LOCAL_LINKED_GOOGLE_ACCOUNTS.values()) {
        if (linked.googleSub === googleSub) {
          const userFound = Object.values(LOCAL_GOOGLE_MOCK_USERS).find(
            (u) => `acc-${u.ptv_id.toLowerCase()}` === linked.accountId || u.username === linked.accountId || u.ptv_id.toLowerCase() === linked.accountId.toLowerCase()
          );
          if (userFound) {
            matchedUser = userFound;
            break;
          }
        }
      }
    }
    if (!matchedUser) {
      return {
        success: false,
        error: `Akun Google (${userEmail || googleSub}) belum ditautkan ke akun kru resmi PTVPRO. Hubungi Administrator PTV untuk menautkan akun.`,
        code: "unlinked"
      };
    }
    if (matchedUser.status_akun !== "active") {
      return {
        success: false,
        error: `Akun (${matchedUser.ptv_id}) sedang berstatus "${matchedUser.status_akun}". Operasi PTV Hub membutuhkan akun berstatus "active".`,
        code: "access_denied"
      };
    }
    if (!matchedUser.capabilities.includes("hub.access")) {
      return {
        success: false,
        error: `Akses Ditolak: Akun (${matchedUser.ptv_id}) tidak memiliki izin akses PTV Hub (hub.access). Hubungi Administrator PTV.`,
        code: "access_denied"
      };
    }
    const now = Date.now();
    const session = {
      account_id: `acc-${matchedUser.ptv_id.toLowerCase()}`,
      identity_id: `id-${matchedUser.ptv_id.toLowerCase()}`,
      ptv_id: matchedUser.ptv_id,
      full_name: matchedUser.full_name,
      username: matchedUser.username,
      division: matchedUser.division,
      position: matchedUser.position,
      status_akun: matchedUser.status_akun,
      status_organisasi: matchedUser.status_organisasi,
      assigned_profiles: matchedUser.profiles,
      capabilities: matchedUser.capabilities,
      iat: Math.floor(now / 1e3),
      exp: Math.floor(now / 1e3) + 7 * 24 * 3600
    };
    return {
      success: true,
      session
    };
  }
  return {
    success: false,
    error: "Konfigurasi Server Error: Kredensial database backend (SUPABASE_SERVICE_ROLE_KEY) belum dikonfigurasi pada server Vercel. Akses ditolak fail-closed.",
    code: "server_error"
  };
}
async function verifyAccountStatusLive(accountId, issuedAt, verifiedSession) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceRoleKey) {
    try {
      const supabase = createStagingIdentityClient(supabaseUrl, serviceRoleKey);
      const { data, error } = await supabase.from("user_account").select("status_akun,lockout_until,tokens_valid_after").eq("id", accountId).maybeSingle();
      if (error || !data) return false;
      const active = data.status_akun === "active" && (!data.lockout_until || Number.isFinite(Date.parse(data.lockout_until)) && Date.parse(data.lockout_until) <= Date.now()) && Number.isSafeInteger(issuedAt) && issuedAt > 0 && issuedAt * 1e3 <= Date.now() && (!data.tokens_valid_after || Number.isFinite(Date.parse(data.tokens_valid_after)) && issuedAt * 1e3 >= Date.parse(data.tokens_valid_after));
      if (!active) return false;
      if (lifecycleEnabled() || verifiedSession && sessionNeedsRegistry(verifiedSession)) return !!verifiedSession && verifiedSession.account_id === accountId && verifiedSession.iat === issuedAt && await portalSessionValid(supabase, verifiedSession);
      return true;
    } catch {
      return false;
    }
  }
  if (process.env.NODE_ENV === "test") {
    const match = Object.values(LOCAL_GOOGLE_MOCK_USERS).find(
      (u) => `acc-${u.ptv_id.toLowerCase()}` === accountId || `acc-${u.ptv_id.toLowerCase().replace("ptv-", "")}` === accountId
    );
    return match ? match.status_akun === "active" : false;
  }
  return false;
}
async function getGoogleOAuthStatus(accountId) {
  if (!accountId) return { is_linked: false };
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceRoleKey) {
    try {
      const supabase = createStagingIdentityClient(supabaseUrl, serviceRoleKey);
      const { data, error } = await supabase.from("auth_credentials").select("oauth_provider, oauth_subject_id, oauth_email, updated_at").eq("account_id", accountId).maybeSingle();
      if (!error && data && data.oauth_provider === "google" && data.oauth_subject_id) {
        return {
          is_linked: true,
          oauth_provider: "google",
          oauth_subject_id: data.oauth_subject_id,
          oauth_email: data.oauth_email || void 0,
          updated_at: data.updated_at
        };
      }
      return { is_linked: false };
    } catch {
      return { is_linked: false };
    }
  }
  const linked = LOCAL_LINKED_GOOGLE_ACCOUNTS.get(accountId);
  if (linked && linked.googleSub) {
    return {
      is_linked: true,
      oauth_provider: "google",
      oauth_subject_id: linked.googleSub,
      oauth_email: linked.oauthEmail,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  const staticMatch = Object.values(LOCAL_GOOGLE_MOCK_USERS).find(
    (u) => `acc-${u.ptv_id.toLowerCase()}` === accountId
  );
  if (staticMatch) {
    return {
      is_linked: true,
      oauth_provider: "google",
      oauth_subject_id: staticMatch.google_sub,
      oauth_email: `${staticMatch.username}@ptvpro.com`,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  return { is_linked: false };
}
async function linkGoogleIdentityToAccount(accountId, googleSub, googleEmail) {
  if (!accountId || !googleSub) {
    return {
      success: false,
      error: "ID akun dan Google Subject ID wajib disertakan untuk menghubungkan akun."
    };
  }
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceRoleKey) {
    try {
      const supabase = createStagingIdentityClient(supabaseUrl, serviceRoleKey);
      const { data: conflictCred, error: conflictErr } = await supabase.from("auth_credentials").select("account_id, oauth_email").eq("oauth_provider", "google").eq("oauth_subject_id", googleSub).maybeSingle();
      if (!conflictErr && conflictCred && conflictCred.account_id !== accountId) {
        return {
          success: false,
          conflict: true,
          error: "Identitas Google ini sudah terhubung ke akun kru PTVPRO lain. Hubungan ganda ditolak."
        };
      }
      if (conflictErr) return { success: false, error: "Identitas Google tidak dapat diverifikasi." };
      if (conflictCred?.account_id === accountId) return { success: true, oauth_email: conflictCred.oauth_email || void 0 };
      return { success: false, error: "Linking Google ditahan sampai tersedia RPC atomik dengan proteksi Root, sesi, dan audit." };
    } catch (err) {
      return {
        success: false,
        error: `Database Gateway Error: ${err?.message || "Gagal menghubungi database."}`
      };
    }
  }
  if (process.env.NODE_ENV !== "test") return { success: false, error: "Backend autentikasi tidak tersedia." };
  for (const [existingAccId, existingLink] of LOCAL_LINKED_GOOGLE_ACCOUNTS.entries()) {
    if (existingLink.googleSub === googleSub && existingAccId !== accountId) {
      return {
        success: false,
        conflict: true,
        error: "Identitas Google ini sudah terhubung ke akun kru PTVPRO lain. Hubungan ganda ditolak."
      };
    }
  }
  const staticConflict = Object.entries(LOCAL_GOOGLE_MOCK_USERS).find(
    ([sub, u]) => sub === googleSub && `acc-${u.ptv_id.toLowerCase()}` !== accountId
  );
  if (staticConflict) {
    return {
      success: false,
      conflict: true,
      error: "Identitas Google ini sudah terhubung ke akun kru PTVPRO lain. Hubungan ganda ditolak."
    };
  }
  LOCAL_LINKED_GOOGLE_ACCOUNTS.set(accountId, {
    accountId,
    googleSub,
    oauthEmail: googleEmail
  });
  return { success: true, oauth_email: googleEmail };
}
async function unlinkGoogleIdentityFromAccount(accountId) {
  if (!accountId) {
    return { success: false, error: "ID akun tidak valid." };
  }
  if (process.env.NODE_ENV !== "test" || process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, error: "Pelepasan Google ditahan sampai tersedia RPC atomik yang melindungi Root dan metode login terakhir." };
  }
  LOCAL_LINKED_GOOGLE_ACCOUNTS.delete(accountId);
  return { success: true };
}
async function resolveIdentityByCredentials(identifier, _password) {
  if (process.env.NODE_ENV !== "test" || process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, code: "access_denied", error: "Login password belum tersedia secara aman. Gunakan Google yang sudah ditautkan atau hubungi operator." };
  }
  const rawId = (identifier || "").trim();
  if (!rawId) {
    return {
      success: false,
      error: "Identitas kru (Username atau PTV-ID) wajib diisi.",
      code: "unlinked"
    };
  }
  const lower = rawId.toLowerCase();
  const mockMatch = Object.values(LOCAL_GOOGLE_MOCK_USERS).find(
    (u) => u.username.toLowerCase() === lower || u.ptv_id.toLowerCase() === lower
  );
  if (mockMatch) {
    if (mockMatch.status_akun !== "active") {
      return {
        success: false,
        error: `Akun (${mockMatch.ptv_id}) sedang berstatus "${mockMatch.status_akun}". Operasi PTV Hub membutuhkan akun berstatus "active".`,
        code: "access_denied"
      };
    }
    if (!mockMatch.capabilities.includes("hub.access")) {
      return {
        success: false,
        error: `Akses Ditolak: Akun (${mockMatch.ptv_id}) tidak memiliki izin akses PTV Hub (hub.access).`,
        code: "access_denied"
      };
    }
    const now = Date.now();
    const session = {
      account_id: `acc-${mockMatch.ptv_id.toLowerCase()}`,
      identity_id: `id-${mockMatch.ptv_id.toLowerCase()}`,
      ptv_id: mockMatch.ptv_id,
      full_name: mockMatch.full_name,
      username: mockMatch.username,
      status_akun: mockMatch.status_akun,
      status_organisasi: mockMatch.status_organisasi,
      assigned_profiles: mockMatch.profiles,
      capabilities: mockMatch.capabilities,
      iat: Math.floor(now / 1e3),
      exp: Math.floor(now / 1e3) + 7 * 24 * 3600
    };
    return { success: true, session };
  }
  return {
    success: false,
    error: `Kredensial login untuk identifier "${rawId}" tidak ditemukan atau belum terdaftar pada sistem.`,
    code: "unlinked"
  };
}
var LOCAL_LINKED_GOOGLE_ACCOUNTS, LOCAL_GOOGLE_MOCK_USERS;
var init_identity = __esm({
  "api/_routes/auth/_utils/identity.ts"() {
    "use strict";
    init_liveAccess();
    init_portalLifecycle();
    LOCAL_LINKED_GOOGLE_ACCOUNTS = /* @__PURE__ */ new Map();
    LOCAL_GOOGLE_MOCK_USERS = {
      "google-sub-ptv-025": {
        google_sub: "google-sub-ptv-025",
        ptv_id: "PTV-025",
        full_name: "Zidna Santri",
        username: "zidna",
        status_akun: "active",
        status_organisasi: "active",
        division: "Technical",
        position: "Crew Operator",
        profiles: ["crew"],
        capabilities: [
          "hub.access",
          "events.view",
          "calendar.view",
          "inventory.view",
          "loans.view",
          "loans.checkout",
          "loans.return",
          "damage.view",
          "damage.report",
          "lostfound.view",
          "lostfound.report",
          "crew.view",
          "id.view",
          "id.export",
          "documents.view",
          "documents.request",
          "contacts.internal.view",
          "contacts.external.view",
          "broadcast.view",
          "projecthaul.view",
          "notes.view",
          "notes.create",
          "settings.personal"
        ]
      },
      "google-sub-ptv-001": {
        google_sub: "google-sub-ptv-001",
        ptv_id: "PTV-001",
        full_name: "Ahmad Executive",
        username: "eksekutif",
        status_akun: "active",
        status_organisasi: "active",
        division: "Leadership",
        position: "Ketua Umum",
        profiles: ["eksekutif"],
        capabilities: [
          "hub.access",
          "events.view",
          "events.create",
          "events.edit",
          "events.delete",
          "events.rundown.manage",
          "calendar.view",
          "inventory.view",
          "inventory.create",
          "inventory.edit",
          "inventory.delete",
          "inventory.units.manage",
          "inventory.valuation.view",
          "inventory.valuation.manage",
          "loans.view",
          "loans.checkout",
          "loans.return",
          "loans.manage",
          "damage.view",
          "damage.report",
          "damage.qc.approve",
          "lostfound.view",
          "lostfound.report",
          "lostfound.manage",
          "crew.view",
          "crew.create",
          "crew.edit",
          "crew.status.manage",
          "crew.permissions.manage",
          "id.view",
          "id.export",
          "documents.view",
          "documents.request",
          "documents.generate",
          "documents.approve",
          "documents.archive.view",
          "documents.archive.manage",
          "finance.view",
          "finance.manage",
          "finance.operator",
          "contacts.internal.view",
          "contacts.external.view",
          "contacts.external.manage",
          "broadcast.view",
          "broadcast.dispatch",
          "projecthaul.view",
          "projecthaul.manage",
          "notes.view",
          "notes.create",
          "notes.manage",
          "settings.personal",
          "settings.system",
          "audit.logs.view"
        ]
      },
      "google-sub-inactive": {
        google_sub: "google-sub-inactive",
        ptv_id: "PTV-099",
        full_name: "Inactive Crew Member",
        username: "inactive_crew",
        status_akun: "inactive",
        status_organisasi: "inactive",
        division: "Technical",
        position: "Mantan Kru",
        profiles: ["crew"],
        capabilities: ["hub.access"]
      },
      "google-sub-no-hub-access": {
        google_sub: "google-sub-no-hub-access",
        ptv_id: "PTV-088",
        full_name: "No Hub Access Member",
        username: "no_hub",
        status_akun: "active",
        status_organisasi: "active",
        division: "Support",
        position: "Support Staff",
        profiles: [],
        capabilities: ["inventory.view"]
      }
    };
  }
});

// api/_routes/acara.ts
import crypto2 from "node:crypto";

// src/products/hub/acara/utils/acaraColors.ts
var ACARA_COLORS = [
  { value: "biru", label: "Biru", color: "#1273E6" },
  { value: "ungu", label: "Ungu", color: "#7C3AED" },
  { value: "hijau", label: "Hijau", color: "#15803D" },
  { value: "oranye", label: "Oranye", color: "#C2410C" },
  { value: "kuning", label: "Kuning", color: "#A16207" },
  { value: "pink", label: "Pink", color: "#BE185D" },
  { value: "merah", label: "Merah", color: "#DC2626" },
  { value: "toska", label: "Toska", color: "#0F766E" },
  { value: "abu-abu", label: "Abu-abu", color: "#64748B" }
];
function normalizeAcaraColor(value) {
  return ACARA_COLORS.find((preset) => preset.value === value)?.value ?? "biru";
}

// api/_routes/acara.ts
init_cookies();
init_crypto();
init_identity();
import { createClient as createClient3 } from "@supabase/supabase-js";
function extractValidSqlTime(raw) {
  if (!raw) return null;
  const match = String(raw).match(/(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/);
  if (!match) return null;
  const hh = match[1].padStart(2, "0");
  const mm = match[2];
  const ss = match[3] || "00";
  const hNum = parseInt(hh, 10);
  const mNum = parseInt(mm, 10);
  if (hNum < 0 || hNum > 23 || mNum < 0 || mNum > 59) return null;
  return `${hh}:${mm}:${ss}`;
}
function parseAcaraDbRow(row, todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)) {
  const ev_id = String(row.id || "");
  let desc = String(row.deskripsi || "");
  let meta = {};
  if (desc.includes("<!-- PTV_META:")) {
    const match = desc.match(/<!--\s*PTV_META:\s*({[\s\S]*?})\s*-->/);
    if (match && match[1]) {
      try {
        meta = JSON.parse(match[1]);
        desc = desc.replace(match[0], "").trim();
      } catch {
      }
    }
  }
  const sb_st = String(row.status || "aktif").trim().toLowerCase();
  let status = "Mendatang";
  if (sb_st === "selesai") {
    status = "Selesai";
  } else if (sb_st === "batal" || sb_st === "dibatalkan") {
    status = "Dibatalkan";
  } else if (meta.status_detail && (meta.status_detail.toLowerCase() === "berjalan" || meta.status_detail.toLowerCase() === "ongoing")) {
    status = "Berlangsung";
  } else {
    const evDate = String(row.tanggal || "");
    if (evDate) {
      if (evDate < todayStr) {
        status = "Selesai";
      } else if (evDate === todayStr) {
        status = "Berlangsung";
      } else {
        status = "Mendatang";
      }
    }
  }
  const rawCrew = Array.isArray(meta.crew) ? meta.crew : [];
  const cleanCrew = rawCrew.map((c) => {
    if (typeof c === "object" && c !== null) {
      return {
        id: String(c.id || c.crew_id || c.kru_id || ""),
        name: String(c.name || c.nama || c.full_name || ""),
        photo: c.photo || "",
        division: c.division || c.divisi || "",
        role: c.role || "",
        job: String(c.job || c.tugas || c.jabatan_acara || ""),
        tugas: String(c.job || c.tugas || c.jabatan_acara || "")
      };
    } else if (typeof c === "string" && c.trim()) {
      return {
        id: "",
        name: c.trim(),
        job: "",
        tugas: ""
      };
    }
    return null;
  }).filter(Boolean);
  const rawGear = Array.isArray(meta.gear) ? meta.gear : [];
  const cleanGear = rawGear.map((g) => {
    if (typeof g === "object" && g !== null) {
      return {
        id: String(g.id || g.item_id || ""),
        item_id: String(g.id || g.item_id || ""),
        name: String(g.name || ""),
        code: String(g.code || ""),
        photo: g.photo || g.foto_url || "",
        cat: String(g.cat || ""),
        qty: Math.max(1, parseInt(g.qty, 10) || 1),
        units: Array.isArray(g.units) ? g.units : []
      };
    }
    return null;
  }).filter(Boolean);
  const rawRundown = Array.isArray(meta.rundown) ? meta.rundown : [];
  const cleanRundown = rawRundown.map((r, idx) => ({
    id: String(r.id || `rd-${ev_id}-${idx}`),
    acara_id: ev_id,
    jam_mulai: String(r.jam_mulai || r.start_time || r.waktu_mulai || "08:00"),
    kegiatan: String(r.kegiatan || r.agenda || r.pekerjaan || ""),
    sort_key: String(r.sort_key || r.urutan || idx + 1)
  }));
  let timeStr = meta.time || "";
  if (!timeStr && (row.waktu_mulai || row.waktu_selesai)) {
    timeStr = `${row.waktu_mulai || "08:00"}${row.waktu_selesai ? ` \u2013 ${row.waktu_selesai}` : " \u2013 Selesai"}`;
  }
  if (!timeStr) {
    timeStr = "08:00 \u2013 Selesai";
  }
  const name = String(row.nama_acara || "Acara PTV");
  const date = String(row.tanggal || "");
  const loc = String(row.lokasi || meta.loc || "Studio PTV");
  const notes = desc || meta.notes || "\u2014";
  const type = String(meta.type || row.tipe || "internal");
  const dresscode = String(meta.dresscode || "");
  return {
    id: ev_id,
    name,
    date,
    time: timeStr,
    loc,
    status,
    notes,
    crew: cleanCrew,
    gear: cleanGear,
    rundown: cleanRundown,
    display_color: normalizeAcaraColor(meta.display_color),
    sessions: Array.isArray(meta.sessions) ? meta.sessions : [],
    notulensi_ids: Array.isArray(meta.notulensi_ids) ? meta.notulensi_ids : [],
    type,
    dresscode,
    doc: row.poster_url || "",
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}
function sanitizeAcaraCrew(crewInput) {
  if (!Array.isArray(crewInput)) return [];
  const seenKey = /* @__PURE__ */ new Set();
  const sanitized = [];
  for (const c of crewInput) {
    if (!c || typeof c !== "object" && typeof c !== "string") continue;
    let name = "";
    let id = "";
    let ptv_id = "";
    let photo = "";
    let division = "";
    let role = "";
    let job = "";
    if (typeof c === "string") {
      name = c.trim();
      job = "Camera Person";
    } else {
      name = String(c.name || c.nama || c.full_name || "").trim();
      id = String(c.id || c.crew_id || c.ptv_id || "");
      ptv_id = String(c.ptv_id || "");
      photo = String(c.photo || c.foto_url || "");
      division = String(c.division || c.divisi || "");
      role = String(c.role || c.jabatan || "");
      job = String(c.job || c.tugas || "Camera Person").trim();
    }
    if (!name) continue;
    const dedupeKey = id ? `id:${id}` : `name:${name.toLowerCase()}`;
    if (seenKey.has(dedupeKey)) continue;
    seenKey.add(dedupeKey);
    sanitized.push({
      id: id || `kru-${Date.now()}-${sanitized.length}`,
      ptv_id: ptv_id || void 0,
      name,
      photo: photo || "",
      division: division || "Technical",
      role: role || "Kru",
      job: job || "Camera Person",
      tugas: job || "Camera Person"
    });
  }
  return sanitized;
}
async function parseJsonBody(req) {
  const existingBody = req.body;
  if (existingBody !== void 0) {
    if (typeof existingBody === "object" && existingBody !== null) {
      return existingBody;
    }
    if (typeof existingBody === "string") {
      if (!existingBody.trim()) return {};
      try {
        return JSON.parse(existingBody);
      } catch {
        throw new Error("Format data JSON tidak valid.");
      }
    }
    if (Buffer.isBuffer(existingBody)) {
      const str = existingBody.toString("utf8");
      if (!str.trim()) return {};
      try {
        return JSON.parse(str);
      } catch {
        throw new Error("Format data JSON tidak valid.");
      }
    }
  }
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Format data JSON tidak valid."));
      }
    });
    req.on("error", reject);
  });
}
async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  const method = req.method || "GET";
  if (!["GET", "POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: `Metode HTTP ${method} tidak didukung.` }));
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  if (!sessionToken) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses data Acara.",
        code: "unauthorized"
      })
    );
    return;
  }
  const session = verifySessionToken(sessionToken, authSecret);
  if (!session || session.status_akun !== "active") {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Sesi tidak valid atau telah kedaluwarsa.",
        code: "invalid_session"
      })
    );
    return;
  }
  const userCaps = await refreshLiveSession(session);
  if (!userCaps.includes("hub.access")) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Sesi atau izin telah dicabut." }));
    return;
  }
  if (method === "GET") {
    const hasViewAccess = userCaps.includes("events.view") || userCaps.includes("calendar.view");
    if (!hasViewAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: "Akses ditolak: Akun Anda tidak memiliki izin untuk melihat modul Acara.",
          code: "forbidden"
        })
      );
      return;
    }
  } else if (method === "POST") {
    const hasCreateAccess = userCaps.includes("events.create") || userCaps.includes("events.edit") || userCaps.includes("events.manage");
    if (!hasCreateAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: "Akses ditolak: Akun Anda tidak memiliki izin untuk membuat jadwal Acara baru.",
          code: "forbidden"
        })
      );
      return;
    }
  } else if (method === "DELETE") {
    const hasDeleteAccess = userCaps.includes("events.delete") || userCaps.includes("events.manage");
    if (!hasDeleteAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: "Akses ditolak: Akun Anda tidak memiliki izin untuk menghapus data Acara.",
          code: "forbidden"
        })
      );
      return;
    }
  } else {
    const hasEditAccess = userCaps.includes("events.edit") || userCaps.includes("events.manage");
    if (!hasEditAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: "Akses ditolak: Akun Anda tidak memiliki izin untuk mengubah data Acara.",
          code: "forbidden"
        })
      );
      return;
    }
  }
  const isStillActive = await verifyAccountStatusLive(session.account_id, session.iat, session);
  if (!isStillActive) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Akun telah dinonaktifkan.",
        code: "account_inactive"
      })
    );
    return;
  }
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Konfigurasi backend database belum terdefinisi." }));
    return;
  }
  if (supabaseUrl.includes("jthzuhkblxcaohiuypqq")) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Anti-prod safety barrier: Database Production is STRICT READ-ONLY." }));
    return;
  }
  const supabase = createClient3(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  try {
    if (method === "GET") {
      const { data, error } = await supabase.from("ptv_acara").select("id, nama_acara, tanggal, waktu_mulai, waktu_selesai, lokasi, deskripsi, status, created_by, created_at, updated_at").order("tanggal", { ascending: false });
      if (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "Gagal mengambil data acara dari database backend Staging." }));
        return;
      }
      const mappedEvents = (data || []).map((row) => parseAcaraDbRow(row));
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, count: mappedEvents.length, events: mappedEvents }));
      return;
    }
    if (method === "POST") {
      const payload2 = await parseJsonBody(req);
      const name = String(payload2.name || "").trim();
      const date = String(payload2.date || "").trim();
      if (!name) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Nama kegiatan / acara wajib diisi.", code: "missing_name" }));
        return;
      }
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Tanggal acara wajib berformat YYYY-MM-DD.", code: "invalid_date" }));
        return;
      }
      const timeStr = String(payload2.time || "08:00 \u2013 Selesai").trim();
      const locStr = String(payload2.loc || "Studio PTV").trim();
      const notesStr = String(payload2.notes || "").trim();
      const dresscodeStr = String(payload2.dresscode || "").trim();
      const typeStr = String(payload2.type || "liputan").trim();
      let waktuMulai = null;
      let waktuSelesai = null;
      if (timeStr.includes("\u2013") || timeStr.includes("-")) {
        const parts = timeStr.split(/[–-]/).map((s) => s.trim());
        waktuMulai = extractValidSqlTime(parts[0]);
        if (parts[1] && !parts[1].toLowerCase().includes("selesai")) {
          waktuSelesai = extractValidSqlTime(parts[1]);
        }
      } else {
        waktuMulai = extractValidSqlTime(timeStr);
      }
      let dbStatus = "aktif";
      const normStatus = String(payload2.status || "Mendatang").toLowerCase();
      if (normStatus === "selesai") {
        dbStatus = "selesai";
      } else if (normStatus === "batal" || normStatus === "dibatalkan") {
        dbStatus = "batal";
      }
      const meta = {
        type: typeStr,
        time: timeStr,
        loc: locStr,
        notes: notesStr,
        dresscode: dresscodeStr,
        crew: sanitizeAcaraCrew(payload2.crew),
        gear: Array.isArray(payload2.gear) ? payload2.gear : [],
        rundown: Array.isArray(payload2.rundown) ? payload2.rundown : [],
        display_color: normalizeAcaraColor(payload2.display_color),
        sessions: Array.isArray(payload2.sessions) ? payload2.sessions : [],
        notulensi_ids: Array.isArray(payload2.notulensi_ids) ? payload2.notulensi_ids : []
      };
      const serializedMeta = `<!-- PTV_META: ${JSON.stringify(meta)} -->`;
      const fullDeskripsi = notesStr ? `${serializedMeta}

${notesStr}` : serializedMeta;
      const newId = crypto2.randomUUID();
      let createdByUuid = null;
      if (session.identity_id) {
        const { data: idCheck } = await supabase.from("canonical_identity").select("id").eq("id", session.identity_id).maybeSingle();
        if (idCheck?.id) {
          createdByUuid = idCheck.id;
        }
      }
      const { data: insertedRow, error: errInsert } = await supabase.from("ptv_acara").insert({
        id: newId,
        nama_acara: name,
        tanggal: date,
        waktu_mulai: waktuMulai,
        waktu_selesai: waktuSelesai,
        lokasi: locStr,
        deskripsi: fullDeskripsi,
        status: dbStatus,
        created_by: createdByUuid
      }).select().single();
      if (errInsert || !insertedRow) {
        console.error("[API Acara Insert Error]:", errInsert);
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal menyimpan acara baru ke database backend: ${errInsert?.message || "Unknown error"}`,
            code: "insert_failed"
          })
        );
        return;
      }
      const mapped2 = parseAcaraDbRow(insertedRow);
      res.statusCode = 201;
      res.end(
        JSON.stringify({
          success: true,
          message: `Acara "${mapped2.name}" berhasil dibuat dan tersimpan permanen di Supabase Staging.`,
          event: mapped2
        })
      );
      return;
    }
    if (method === "DELETE") {
      let eventId2 = "";
      const urlObj = new URL(req.url || "", "http://localhost");
      eventId2 = urlObj.searchParams.get("id") || "";
      if (!eventId2) {
        const payload2 = await parseJsonBody(req);
        eventId2 = String(payload2.id || "").trim();
      }
      if (!eventId2) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "ID Acara (UUID) wajib disertakan untuk penghapusan.", code: "missing_id" }));
        return;
      }
      const { data: existing2, error: errFind } = await supabase.from("ptv_acara").select("id, nama_acara").eq("id", eventId2).maybeSingle();
      if (errFind || !existing2) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Data acara tidak ditemukan di database backend Staging.", code: "not_found" }));
        return;
      }
      const { error: errDel } = await supabase.from("ptv_acara").delete().eq("id", eventId2);
      if (errDel) {
        console.error("[API Acara Delete Error]:", errDel);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gagal menghapus acara: ${errDel.message}`, code: "delete_failed" }));
        return;
      }
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: `Acara "${existing2.nama_acara}" berhasil dihapus dari database Staging.`,
          deleted_id: eventId2
        })
      );
      return;
    }
    const payload = await parseJsonBody(req);
    const eventId = String(payload.id || "").trim();
    if (!eventId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "ID Acara (UUID) wajib disertakan untuk melakukan pembaruan.", code: "missing_id" }));
      return;
    }
    if (payload.name !== void 0 && !String(payload.name).trim()) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Nama kegiatan / acara tidak boleh kosong.", code: "invalid_name" }));
      return;
    }
    if (payload.date !== void 0 && !/^\d{4}-\d{2}-\d{2}$/.test(String(payload.date).trim())) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Format tanggal harus YYYY-MM-DD.", code: "invalid_date" }));
      return;
    }
    const { data: existing, error: errFetch } = await supabase.from("ptv_acara").select("*").eq("id", eventId).single();
    if (errFetch || !existing) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Data acara tidak ditemukan di database backend Staging.", code: "not_found" }));
      return;
    }
    if (payload.expected_updated_at && existing.updated_at) {
      const expTime = new Date(payload.expected_updated_at).getTime();
      const curTime = new Date(existing.updated_at).getTime();
      if (!isNaN(expTime) && !isNaN(curTime) && Math.abs(expTime - curTime) > 2e3) {
        res.statusCode = 409;
        res.end(
          JSON.stringify({
            error: "Konflik pembaruan: Data acara telah diperbarui oleh pengguna lain. Silakan muat ulang halaman sebelum menyimpan.",
            code: "concurrency_conflict"
          })
        );
        return;
      }
    }
    let existingMeta = {};
    let existingDescText = String(existing.deskripsi || "");
    const metaMatch = existingDescText.match(/<!--\s*PTV_META:\s*({[\s\S]*?})\s*-->/);
    if (metaMatch && metaMatch[1]) {
      try {
        existingMeta = JSON.parse(metaMatch[1]);
        existingDescText = existingDescText.replace(metaMatch[0], "").trim();
      } catch {
      }
    }
    const mergedMeta = { ...existingMeta };
    if (payload.time !== void 0) mergedMeta.time = String(payload.time).trim();
    if (payload.loc !== void 0) mergedMeta.loc = String(payload.loc).trim();
    if (payload.type !== void 0) mergedMeta.type = String(payload.type).trim();
    if (payload.dresscode !== void 0) mergedMeta.dresscode = String(payload.dresscode).trim();
    if (payload.display_color !== void 0) mergedMeta.display_color = normalizeAcaraColor(payload.display_color);
    if (payload.status !== void 0) mergedMeta.status_detail = String(payload.status).trim();
    if (payload.notes !== void 0) mergedMeta.notes = String(payload.notes).trim();
    if (Array.isArray(payload.crew)) mergedMeta.crew = sanitizeAcaraCrew(payload.crew);
    if (Array.isArray(payload.gear)) mergedMeta.gear = payload.gear;
    if (Array.isArray(payload.rundown)) mergedMeta.rundown = payload.rundown;
    if (Array.isArray(payload.sessions)) mergedMeta.sessions = payload.sessions;
    if (Array.isArray(payload.notulensi_ids)) mergedMeta.notulensi_ids = payload.notulensi_ids;
    const finalNotes = payload.notes !== void 0 ? String(payload.notes).trim() : existingDescText;
    const serializedDeskripsi = `<!-- PTV_META: ${JSON.stringify(mergedMeta)} -->
${finalNotes}`.trim();
    let nextStatus = existing.status || "aktif";
    if (payload.status) {
      const sNorm = String(payload.status).toLowerCase();
      if (sNorm === "selesai") {
        nextStatus = "selesai";
      } else if (sNorm === "batal" || sNorm === "dibatalkan") {
        nextStatus = "batal";
      } else {
        nextStatus = "aktif";
      }
    }
    const nextNama = payload.name !== void 0 ? String(payload.name).trim() : existing.nama_acara;
    const nextTanggal = payload.date !== void 0 ? String(payload.date).trim() : existing.tanggal;
    const nextLokasi = payload.loc !== void 0 ? String(payload.loc).trim() : existing.lokasi;
    const { data: updatedRow, error: errUpdate } = await supabase.from("ptv_acara").update({
      nama_acara: nextNama,
      tanggal: nextTanggal,
      lokasi: nextLokasi,
      deskripsi: serializedDeskripsi,
      status: nextStatus,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", eventId).select().single();
    if (errUpdate || !updatedRow) {
      console.error("[API Acara Update Error]:", errUpdate);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: `Gagal memperbarui data acara di database backend: ${errUpdate?.message || "Unknown error"}`,
          code: "update_failed"
        })
      );
      return;
    }
    const mapped = parseAcaraDbRow(updatedRow);
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        message: `Perubahan acara "${mapped.name}" berhasil disimpan ke database Staging.`,
        event: mapped
      })
    );
  } catch (err) {
    console.error("[API Acara Fatal Error]:", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message || "Terjadi kesalahan internal server saat memproses data acara." }));
  }
}

// api/_routes/akses.ts
init_cookies();
init_crypto();
init_liveAccess();
import { createClient as createClient4 } from "@supabase/supabase-js";

// src/products/hub/akses/accessContract.ts
import { z } from "zod";
var accessChangeSchema = z.object({
  accountId: z.string().uuid(),
  expectedVersion: z.string().min(1).max(128),
  profiles: z.array(z.string().min(1)).min(1),
  allowed: z.array(z.string().min(1)),
  denied: z.array(z.string().min(1)),
  status: z.enum(["active", "inactive"]),
  reason: z.string().trim().min(5).max(500),
  confirmed: z.literal(true)
}).strict().superRefine((value, ctx) => {
  if ([value.profiles, value.allowed, value.denied].some((list) => new Set(list).size !== list.length)) ctx.addIssue({ code: "custom", message: "Izin/profil duplikat tidak diperbolehkan." });
  if (value.allowed.some((cap) => value.denied.includes(cap))) ctx.addIssue({ code: "custom", message: "Izin yang sama tidak boleh sekaligus allow dan deny." });
});

// api/_routes/akses.ts
init_positionMapping();
import { hash } from "bcryptjs";
async function readAccessAccounts(db) {
  const [accounts, identities, members, profiles, overrides, catalog, registry, grants, positionMappings] = await Promise.all([
    db.from("user_account").select("id,identity_id,username,status_akun,updated_at,auth_user_id"),
    db.from("canonical_identity").select("id,ptv_id,full_name"),
    db.from("organization_membership").select("identity_id,position_title,division_id,status_organisasi").eq("organization_id", "ptv_studio").eq("is_current", true),
    db.from("account_profiles").select("account_id,profile_id"),
    db.from("account_capability_overrides").select("account_id,capability_key,override_type"),
    db.from("access_profile").select("id,name,description").order("id"),
    db.from("capability_registry").select("key,description,is_sensitive,is_mutation").order("key"),
    db.from("profile_capabilities").select("profile_id,capability_key"),
    getPositionCapabilityMappings(db)
  ]);
  if ([accounts, identities, members, profiles, overrides, catalog, registry, grants].some((r) => r.error)) {
    throw new Error("Gagal membaca data akun dan akses dari Staging.");
  }
  const rows = (accounts.data || []).filter((a) => {
    const identity = identities.data?.find((i) => i.id === a.identity_id);
    const uname = (a.username || "").toLowerCase();
    const ptv = (identity?.ptv_id || "").toLowerCase();
    const name = (identity?.full_name || "").toLowerCase();
    if (uname.includes("staging") || uname.includes("test") || ptv.includes("stg") || ptv.includes("test") || name.includes("staging admin") || name.includes("staging kru") || name.includes("tester")) {
      return false;
    }
    return true;
  }).map((a) => {
    const identity = identities.data?.find((i) => i.id === a.identity_id);
    const membership = members.data?.filter((m) => m.identity_id === a.identity_id) || [];
    const position = membership.length === 1 ? membership[0].position_title || "Kru Operasional" : "Kru Operasional";
    const division = membership.length === 1 ? membership[0].division_id || "" : "";
    return {
      id: a.id,
      identityId: a.identity_id,
      ptvId: identity?.ptv_id || "",
      name: identity?.full_name || "",
      username: a.username,
      position,
      division,
      status: a.status_akun,
      organizationStatus: membership.length === 1 ? membership[0].status_organisasi : "archived",
      profiles: (profiles.data || []).filter((p) => p.account_id === a.id).map((p) => p.profile_id),
      allowed: (overrides.data || []).filter((o) => o.account_id === a.id && o.override_type === "allow").map((o) => o.capability_key),
      denied: (overrides.data || []).filter((o) => o.account_id === a.id && o.override_type === "deny").map((o) => o.capability_key),
      version: a.updated_at
    };
  });
  return {
    accounts: rows,
    profiles: catalog.data || [],
    capabilities: registry.data || [],
    grants: grants.data || [],
    positionMappings: formatPositionMappingsAsArray(positionMappings)
  };
}
async function handler2(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const send = (status, body) => {
    res.statusCode = status;
    res.end(JSON.stringify(body));
  };
  if (!["GET", "POST"].includes(req.method || "")) {
    return send(405, { error: "Metode tidak didukung pada Manajemen Akun." });
  }
  try {
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
      throw new Error("origin");
    }
  } catch {
    return send(403, { error: "Origin permintaan tidak diizinkan." });
  }
  const secret = process.env.AUTH_SECRET;
  const token = parseCookies(req.headers.cookie).ptv_hub_session;
  const session = secret && token ? verifySessionToken(token, secret) : null;
  if (!session) return send(401, { error: "Sesi login diperlukan untuk mengakses Manajemen Akun." });
  const url = process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !/^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/.test(url)) {
    return send(503, { error: "Manajemen Akun hanya tersedia di Staging terverifikasi." });
  }
  const db = createClient4(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(1e4) }) }
  });
  try {
    const actor = await resolveLiveAccess(db, session);
    if (!actor.can("crew.permissions.manage")) {
      return send(403, { error: "Akses ditolak: Izin mengelola akun & hak akses diperlukan." });
    }
    const urlObj = new URL(req.url || "", "http://localhost");
    const actionParam = urlObj.searchParams.get("action") || "";
    if (req.method === "GET") {
      const snapshot2 = await readAccessAccounts(db);
      let history = [];
      if (actor.can("audit.logs.view")) {
        const result = await db.from("auth_audit_log").select("id,event_type,created_at,metadata,actor_id").in("event_type", ["account_access_changed", "password_reset_by_root", "position_capabilities_updated"]).order("created_at", { ascending: false }).limit(50);
        if (!result.error && Array.isArray(result.data)) {
          const identities = await db.from("canonical_identity").select("id, full_name, ptv_id");
          const idMap = new Map((identities.data || []).map((i) => [i.id, i]));
          history = result.data.map((h) => {
            const actorObj = idMap.get(h.actor_id);
            const targetAccount = snapshot2.accounts.find((a) => a.id === h.metadata?.target_account_id);
            return {
              id: h.id,
              event_type: h.event_type,
              created_at: h.created_at,
              actor_name: actorObj?.full_name || "Administrator",
              actor_ptv_id: actorObj?.ptv_id || "",
              target_username: targetAccount?.username || h.metadata?.target_username || h.metadata?.after?.username || "\u2014",
              target_name: targetAccount?.name || h.metadata?.target_name || "\u2014",
              target_ptv_id: targetAccount?.ptvId || h.metadata?.target_ptv_id || "",
              target_position: targetAccount?.position || h.metadata?.position || "\u2014",
              reason: h.metadata?.after?.reason || h.metadata?.reason || (h.event_type === "password_reset_by_root" ? "Atur ulang password oleh ROOT" : "Perubahan izin akses"),
              source: h.metadata?.source || "Manajemen Akun",
              before: h.metadata?.before || null,
              after: h.metadata?.after || null,
              metadata: h.metadata
            };
          });
        }
      }
      return send(200, {
        ...snapshot2,
        history,
        canViewHistory: actor.can("audit.logs.view"),
        isRoot: actor.profiles.includes("root_executive")
      });
    }
    let body = req.body;
    if (body === void 0) {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > 65536) return send(413, { error: "Payload terlalu besar." });
        chunks.push(Buffer.from(chunk));
      }
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    }
    const action = actionParam || body.action || "";
    if (action === "save_position_mapping") {
      if (!body.mappings || typeof body.mappings !== "object") {
        return send(400, { error: "Format data mapping jabatan tidak valid." });
      }
      await savePositionCapabilityMappings(db, body.mappings, session.account_id);
      await db.from("auth_audit_log").insert([{
        actor_id: actor.identity.id,
        event_type: "position_capabilities_updated",
        metadata: {
          updated_by: actor.identity.full_name,
          source: "Manajemen Akun",
          updated_at: (/* @__PURE__ */ new Date()).toISOString(),
          reason: "Pembaruan mapping jabatan dan hak akses"
        }
      }]);
      const updatedSnapshot = await readAccessAccounts(db);
      return send(200, {
        success: true,
        message: "Mapping jabatan organisasi dan izin akses berhasil disimpan di database Staging.",
        positionMappings: updatedSnapshot.positionMappings
      });
    }
    if (action === "reset_password") {
      if (!actor.profiles.includes("root_executive")) {
        return send(403, { error: "Akses ditolak: Fitur Atur Ulang Password hanya dapat dijalankan oleh akun ROOT." });
      }
      const accountId = String(body.accountId || "").trim();
      const newPassword = String(body.newPassword || "").trim();
      if (!accountId) {
        return send(400, { error: "ID akun target wajib disertakan." });
      }
      if (!newPassword || newPassword.length < 4) {
        return send(400, { error: "Password baru minimal 4 karakter." });
      }
      if (Buffer.byteLength(newPassword, "utf8") > 72) {
        return send(400, { error: "Password baru maksimal 72 byte." });
      }
      const { data: targetAccount, error: accErr } = await db.from("user_account").select("id, identity_id, username, auth_user_id").eq("id", accountId).maybeSingle();
      if (accErr || !targetAccount) {
        return send(404, { error: "Akun target tidak ditemukan di database Staging." });
      }
      const { data: targetProfiles } = await db.from("account_profiles").select("profile_id").eq("account_id", targetAccount.id);
      const isTargetRoot = (targetProfiles || []).some((p) => p.profile_id === "root_executive");
      if (isTargetRoot && targetAccount.id !== session.account_id) {
        return send(403, { error: "Perubahan akun Root dilindungi." });
      }
      const passwordHash = await hash(newPassword, 10);
      const { data: kruRows } = await db.from("legacy_archive_kru").select("archive_id, metadata_json").eq("canonical_identity_id", targetAccount.identity_id).limit(1);
      if (kruRows && kruRows.length > 0) {
        const kruRow = kruRows[0];
        const updatedMeta = {
          ...kruRow.metadata_json || {},
          password_hash: passwordHash,
          password_updated_at: (/* @__PURE__ */ new Date()).toISOString(),
          password_updated_by: session.account_id
        };
        await db.from("legacy_archive_kru").update({ metadata_json: updatedMeta }).eq("archive_id", kruRow.archive_id);
      }
      if (targetAccount.auth_user_id) {
        try {
          await db.auth.admin.updateUserById(targetAccount.auth_user_id, { password: newPassword });
        } catch (e) {
          console.warn("[Akses] Supabase Auth update skipped or unavailable:", e);
        }
      }
      await db.from("user_account").update({ tokens_valid_after: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", targetAccount.id);
      await db.from("auth_audit_log").insert([{
        actor_id: actor.identity.id,
        event_type: "password_reset_by_root",
        metadata: {
          target_account_id: targetAccount.id,
          target_username: targetAccount.username,
          executed_by: actor.identity.full_name,
          source: "Manajemen Akun",
          reason: body.reason || "Atur ulang password oleh ROOT",
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      }]);
      return send(200, {
        success: true,
        message: `Password untuk akun @${targetAccount.username} berhasil diatur ulang secara aman. Sesi lama telah dibatalkan.`
      });
    }
    const change = accessChangeSchema.parse(body);
    if (change.accountId === session.account_id) {
      return send(403, { error: "Perubahan akses akun sendiri dilarang." });
    }
    const snapshot = await readAccessAccounts(db);
    const target = snapshot.accounts.find((a) => a.id === change.accountId);
    if (!target) return send(404, { error: "Akun tidak ditemukan." });
    if (target.identityId === actor.identity.id) {
      return send(403, { error: "Perubahan akses identitas sendiri dilarang." });
    }
    if (snapshot.accounts.some((a) => a.identityId === target.identityId && a.profiles.includes("root_executive")) || change.profiles.includes("root_executive")) {
      return send(403, { error: "Identitas Root dilindungi dan tidak dapat diubah melalui halaman ini." });
    }
    if (target.version !== change.expectedVersion) {
      return send(409, { error: "Akses sudah berubah. Muat ulang sebelum menyimpan." });
    }
    if (change.profiles.some((id) => !snapshot.profiles.some((p) => p.id === id)) || [...change.allowed, ...change.denied].some((key2) => !snapshot.capabilities.some((c) => c.key === key2))) {
      return send(400, { error: "Profil atau capability tidak dikenal." });
    }
    const { data, error } = await db.rpc("rpc_manage_account_access", {
      p_actor_account_id: session.account_id,
      p_session_iat: session.iat,
      p_change: change
    });
    if (error) {
      return send(error.code === "PGRST202" || error.code === "42883" ? 503 : error.code === "42501" ? 403 : error.code === "40001" ? 409 : 400, {
        error: error.code === "PGRST202" || error.code === "42883" ? "Penyimpanan akses atomik belum diaktifkan. Proposal database menunggu ACC operator." : "Perubahan akses ditolak oleh database.",
        code: error.code
      });
    }
    if (data?.success !== true) {
      return send(400, { error: "Database tidak mengonfirmasi perubahan akses." });
    }
    return send(200, data);
  } catch (error) {
    return send(error instanceof Error && error.message === "forbidden" ? 403 : 400, {
      error: error instanceof Error && error.message === "forbidden" ? "Akses ditolak atau sesi telah dicabut." : "Permintaan akses tidak valid atau data tidak dapat dimuat."
    });
  }
}

// api/_routes/broadcast.ts
init_cookies();
init_crypto();
init_identity();
import { randomUUID as randomUUID2 } from "node:crypto";
import { createClient as createClient5 } from "@supabase/supabase-js";
function mapDbPengumumanToDTO(row) {
  const prioRaw = (row.prioritas || "").toLowerCase().trim();
  const isPenting = prioRaw === "penting" || prioRaw === "urgent" || prioRaw === "high";
  const createdDate = row.created_at ? row.created_at.slice(0, 10) : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const createdMs = row.created_at ? new Date(row.created_at).getTime() : Date.now();
  return {
    id: row.id,
    title: row.judul || "Pengumuman Studio",
    body: row.konten || "",
    prio: isPenting ? "penting" : "normal",
    by: row.created_by || "Redaksi PTV",
    date: createdDate,
    created_at: createdMs,
    target_divisi: row.target_divisi || "Semua",
    is_aktif: row.is_aktif ?? true,
    berlaku_sampai: row.berlaku_sampai || null
  };
}
async function parseJsonBody2(req) {
  if (req.body) {
    if (typeof req.body === "object") return Promise.resolve(req.body);
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.reject(new Error("Format data JSON tidak valid."));
    }
  }
  if (typeof req.on !== "function") {
    return Promise.resolve({});
  }
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Payload melebihi batas ukuran 2MB."));
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Format data JSON tidak valid."));
      }
    });
    req.on("error", reject);
  });
}
async function handler3(req, res) {
  res.setHeader("Content-Type", "application/json");
  const method = req.method || "GET";
  const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost:5174"}`);
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  if (!sessionToken) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses siaran pengumuman.",
        code: "unauthorized"
      })
    );
    return;
  }
  const session = verifySessionToken(sessionToken, authSecret);
  if (!session) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Sesi login Anda tidak valid atau telah kedaluwarsa. Silakan masuk kembali.",
        code: "session_expired"
      })
    );
    return;
  }
  const userCaps = await refreshLiveSession(session);
  if (!userCaps.includes("hub.access")) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Sesi atau izin telah dicabut." }));
    return;
  }
  const canView = userCaps.includes("broadcast.view") || userCaps.includes("hub.access");
  if (!canView) {
    res.statusCode = 403;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Anda tidak memiliki izin untuk melihat pengumuman studio.",
        code: "forbidden_broadcast_access"
      })
    );
    return;
  }
  const canDispatch = userCaps.includes("broadcast.dispatch") || userCaps.includes("system.manage") || userCaps.includes("role:eksekutif") || userCaps.includes("role:administrasi") || userCaps.includes("role:pengelola") || userCaps.includes("role:developer");
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: "Konfigurasi backend Staging Supabase belum lengkap (URL atau Service Role Key hilang).",
        code: "server_configuration_error"
      })
    );
    return;
  }
  const accountActive = await verifyAccountStatusLive(session.account_id, session.iat, session);
  if (!accountActive) {
    res.statusCode = 403;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Akun Anda telah dinonaktifkan dari sistem.",
        code: "account_inactive"
      })
    );
    return;
  }
  const supabase = createClient5(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  if (method === "GET") {
    try {
      const includeInactive = urlObj.searchParams.get("includeInactive") === "true" && canDispatch;
      let query = supabase.from("ptv_pengumuman").select("*").order("created_at", { ascending: false }).limit(50);
      if (!includeInactive) {
        query = query.eq("is_aktif", true);
      }
      const { data, error } = await query;
      if (error) {
        console.error("[API Broadcast Error]:", error);
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal memuat pengumuman dari database Staging: ${error.message}`,
            code: "database_query_error"
          })
        );
        return;
      }
      const activeRows = (data || []).filter((row) => {
        if (includeInactive) return true;
        if (row.is_aktif === false) return false;
        if (row.berlaku_sampai) {
          return new Date(row.berlaku_sampai).getTime() > Date.now();
        }
        return true;
      });
      const announcements = activeRows.map(mapDbPengumumanToDTO);
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          count: announcements.length,
          announcements
        })
      );
    } catch (err) {
      console.error("[API Broadcast Exception]:", err);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: `Kesalahan server internal saat memuat pengumuman: ${err.message || "Unknown error"}`,
          code: "internal_server_error"
        })
      );
    }
    return;
  }
  if (method === "POST" || method === "PUT" || method === "DELETE") {
    if (!canDispatch) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: "Akses ditolak: Izin penerbitan siaran (broadcast.dispatch) diperlukan untuk mengubah pengumuman studio.",
          code: "forbidden_broadcast_dispatch"
        })
      );
      return;
    }
    try {
      const body = await parseJsonBody2(req);
      const action = body.action || urlObj.searchParams.get("action") || (method === "DELETE" ? "delete" : "create");
      const actorName = session.full_name || session.username || "Redaksi PTV";
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (action === "create" || method === "POST" && !body.action) {
        const title = (body.title || body.judul || "").trim();
        const content = (body.body || body.konten || "").trim();
        const prio = body.prio === "penting" ? "penting" : "normal";
        const targetDivisi = body.target_divisi || "Semua";
        const id = body.id || randomUUID2();
        if (!title || !content) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Judul dan isi pengumuman wajib diisi.", code: "missing_fields" }));
          return;
        }
        let berlakuSampai = null;
        if (typeof body.durasi_hari === "number" && body.durasi_hari > 0) {
          berlakuSampai = new Date(Date.now() + body.durasi_hari * 864e5).toISOString();
        } else if (body.durasi_hari && !isNaN(Number(body.durasi_hari)) && Number(body.durasi_hari) > 0) {
          berlakuSampai = new Date(Date.now() + Number(body.durasi_hari) * 864e5).toISOString();
        } else if (body.berlaku_sampai) {
          berlakuSampai = new Date(body.berlaku_sampai).toISOString();
        }
        const insertPayload = {
          id,
          judul: title,
          konten: content,
          prioritas: prio,
          is_aktif: true,
          target_divisi: targetDivisi,
          berlaku_sampai: berlakuSampai,
          created_by: actorName,
          penulis_id: session.account_id,
          created_at: now,
          updated_at: now
        };
        const { error: insErr } = await supabase.from("ptv_pengumuman").insert(insertPayload);
        if (insErr) {
          throw new Error(`Gagal menyimpan pengumuman ke cloud: ${insErr.message}`);
        }
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            message: "Pengumuman studio berhasil diterbitkan ke cloud staging.",
            announcement: {
              id,
              title,
              body: content,
              prio,
              by: actorName,
              date: now.slice(0, 10),
              created_at: Date.now(),
              target_divisi: targetDivisi,
              berlaku_sampai: berlakuSampai
            }
          })
        );
        return;
      }
      if (action === "update" || method === "PUT") {
        const id = body.id || urlObj.searchParams.get("id");
        if (!id) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "ID pengumuman wajib disertakan untuk pembaruan.", code: "missing_id" }));
          return;
        }
        const updates = {
          updated_at: now
        };
        if (body.title !== void 0 || body.judul !== void 0) {
          updates.judul = (body.title || body.judul).trim();
        }
        if (body.body !== void 0 || body.konten !== void 0) {
          updates.konten = (body.body || body.konten).trim();
        }
        if (body.prio !== void 0 || body.prioritas !== void 0) {
          updates.prioritas = (body.prio || body.prioritas) === "penting" ? "penting" : "normal";
        }
        if (body.is_aktif !== void 0) {
          updates.is_aktif = Boolean(body.is_aktif);
        }
        if (body.target_divisi !== void 0) {
          updates.target_divisi = body.target_divisi;
        }
        if (body.durasi_hari !== void 0) {
          const dHari = Number(body.durasi_hari);
          if (!isNaN(dHari) && dHari > 0) {
            updates.berlaku_sampai = new Date(Date.now() + dHari * 864e5).toISOString();
          } else {
            updates.berlaku_sampai = null;
          }
        } else if (body.berlaku_sampai !== void 0) {
          updates.berlaku_sampai = body.berlaku_sampai ? new Date(body.berlaku_sampai).toISOString() : null;
        }
        const { error: updErr } = await supabase.from("ptv_pengumuman").update(updates).eq("id", id);
        if (updErr) {
          throw new Error(`Gagal memperbarui pengumuman di cloud: ${updErr.message}`);
        }
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            message: `Pengumuman ${id} berhasil diperbarui di cloud staging.`
          })
        );
        return;
      }
      if (action === "delete" || method === "DELETE") {
        const id = body.id || urlObj.searchParams.get("id");
        if (!id) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "ID pengumuman wajib disertakan untuk penghapusan.", code: "missing_id" }));
          return;
        }
        const permanent = urlObj.searchParams.get("permanent") === "true" || body.permanent === true;
        if (permanent) {
          const { error: delErr } = await supabase.from("ptv_pengumuman").delete().eq("id", id);
          if (delErr) throw delErr;
        } else {
          const { error: updErr } = await supabase.from("ptv_pengumuman").update({ is_aktif: false, updated_at: now }).eq("id", id);
          if (updErr) throw updErr;
        }
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            message: `Pengumuman ${id} berhasil dihapus dari siaran aktif.`
          })
        );
        return;
      }
      res.statusCode = 400;
      res.end(JSON.stringify({ error: `Aksi "${action}" tidak dikenali.`, code: "unknown_action" }));
    } catch (err) {
      console.error("[API Broadcast Mutation Error]:", err);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: `Gagal memproses perubahan pengumuman: ${err.message || "Unknown error"}`,
          code: "broadcast_mutation_error"
        })
      );
    }
    return;
  }
  res.statusCode = 405;
  res.end(JSON.stringify({ error: `Metode ${method} tidak didukung.`, code: "method_not_allowed" }));
}

// api/_routes/catatan.ts
init_cookies();
init_crypto();
init_identity();
import crypto3 from "node:crypto";
import { createClient as createClient6 } from "@supabase/supabase-js";
async function parseJsonBody3(req) {
  if (req.body) {
    if (typeof req.body === "object") return req.body;
    try {
      return JSON.parse(req.body);
    } catch {
      throw new Error("Format data JSON tidak valid.");
    }
  }
  if (typeof req.on !== "function") {
    return {};
  }
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Format data JSON tidak valid."));
      }
    });
    req.on("error", reject);
  });
}
var COLOR_TO_KATEGORI = {
  orange: "Penting & Prioritas",
  yellow: "Ide & Rencana",
  green: "Info & Pengumuman",
  purple: "Agenda & Acara",
  rose: "Tugas & Rundown",
  emerald: "Info & Pengumuman",
  amber: "Ide & Rencana",
  blue: "Penting & Prioritas",
  slate: "Umum",
  default: "Umum"
};
async function handler4(req, res) {
  res.setHeader("Content-Type", "application/json");
  const method = req.method || "GET";
  if (!["GET", "POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: `Metode HTTP ${method} tidak didukung.` }));
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  if (!sessionToken) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses data Catatan.",
        code: "unauthorized"
      })
    );
    return;
  }
  const session = verifySessionToken(sessionToken, authSecret);
  if (!session || session.status_akun !== "active") {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Sesi tidak valid atau telah kedaluwarsa.",
        code: "invalid_session"
      })
    );
    return;
  }
  const userCaps = await refreshLiveSession(session);
  if (!userCaps.includes("hub.access")) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Sesi atau izin telah dicabut." }));
    return;
  }
  if (method === "GET") {
    const hasViewAccess = userCaps.includes("notes.view");
    if (!hasViewAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: "Akses ditolak: Akun Anda tidak memiliki izin untuk melihat Catatan Bersama.",
          code: "forbidden"
        })
      );
      return;
    }
  } else if (method === "POST") {
    const hasCreateAccess = userCaps.includes("notes.create") || userCaps.includes("notes.edit") || userCaps.includes("notes.manage");
    if (!hasCreateAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: "Akses ditolak: Akun Anda tidak memiliki izin untuk membuat catatan baru.",
          code: "forbidden"
        })
      );
      return;
    }
  } else if (method === "DELETE") {
    const hasDeleteAccess = userCaps.includes("notes.delete") || userCaps.includes("notes.manage");
    if (!hasDeleteAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: "Akses ditolak: Akun Anda tidak memiliki izin untuk menghapus catatan.",
          code: "forbidden"
        })
      );
      return;
    }
  } else {
    const hasEditAccess = userCaps.includes("notes.edit") || userCaps.includes("notes.manage");
    if (!hasEditAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: "Akses ditolak: Akun Anda tidak memiliki izin untuk mengubah data catatan.",
          code: "forbidden"
        })
      );
      return;
    }
  }
  const isStillActive = await verifyAccountStatusLive(session.account_id, session.iat, session);
  if (!isStillActive) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Akun telah dinonaktifkan.",
        code: "account_inactive"
      })
    );
    return;
  }
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl || !serviceKey) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Konfigurasi backend database belum terdefinisi." }));
      return;
    }
    if (supabaseUrl.includes("jthzuhkblxcaohiuypqq")) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: "Anti-prod safety barrier: Database Production is STRICT READ-ONLY." }));
      return;
    }
    const supabase = createClient6(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    if (method === "GET") {
      const { data, error } = await supabase.from("ptv_catatan").select("id, tipe, judul, isi, warna, tags, kategori, is_pinned, created_by_id, created_by_name, created_at, updated_at").order("is_pinned", { ascending: false }).order("updated_at", { ascending: false });
      if (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "Gagal mengambil data catatan dari database backend." }));
        return;
      }
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, notes: data || [] }));
      return;
    }
    if (method === "POST") {
      const payload2 = await parseJsonBody3(req);
      const judul = String(payload2.judul || "").trim();
      let rawIsi = String(payload2.isi || "").trim();
      if (!judul) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Judul catatan wajib diisi.", code: "missing_title" }));
        return;
      }
      if (!rawIsi) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Isi catatan tidak boleh kosong.", code: "missing_content" }));
        return;
      }
      const warna = String(payload2.warna || "orange").toLowerCase().trim();
      const tipe = payload2.tipe === "meeting_minutes" || payload2.tipe === "notulensi" ? "meeting_minutes" : "shared";
      let cleanTags = [];
      if (Array.isArray(payload2.tags)) {
        cleanTags = payload2.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
      }
      if (tipe === "meeting_minutes" && !cleanTags.includes("notulensi")) {
        cleanTags.push("notulensi");
      }
      const kategori = payload2.kategori || COLOR_TO_KATEGORI[warna] || "Umum";
      if (tipe === "meeting_minutes" && payload2.meeting_meta && typeof payload2.meeting_meta === "object") {
        const metaStr = `<!-- PTV_META: ${JSON.stringify(payload2.meeting_meta)} -->`;
        if (!rawIsi.includes("<!-- PTV_META:")) {
          rawIsi = `${metaStr}

${rawIsi}`;
        }
      }
      const newId = crypto3.randomUUID();
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const authorName = session.full_name || "Kru Studio";
      const authorId = session.account_id || "PTV-001";
      const { data: inserted, error: insertErr } = await supabase.from("ptv_catatan").insert({
        id: newId,
        judul,
        isi: rawIsi,
        warna,
        tipe,
        tags: cleanTags,
        kategori,
        is_pinned: Boolean(payload2.is_pinned),
        created_by_name: authorName,
        created_by_id: authorId,
        created_at: nowIso,
        updated_at: nowIso
      }).select().single();
      if (insertErr || !inserted) {
        console.error("[API Catatan Insert Error]:", insertErr);
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal menyimpan catatan baru ke database Staging: ${insertErr?.message || "Unknown error"}`,
            code: "insert_failed"
          })
        );
        return;
      }
      res.statusCode = 201;
      res.end(
        JSON.stringify({
          success: true,
          message: `Catatan "${inserted.judul}" berhasil disimpan ke Supabase Staging.`,
          note: inserted
        })
      );
      return;
    }
    if (method === "DELETE") {
      let noteId2 = "";
      const urlObj = new URL(req.url || "", "http://localhost");
      noteId2 = urlObj.searchParams.get("id") || "";
      if (!noteId2) {
        const payload2 = await parseJsonBody3(req);
        noteId2 = String(payload2.id || "").trim();
      }
      if (!noteId2) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "ID Catatan (UUID) wajib disertakan untuk penghapusan.", code: "missing_id" }));
        return;
      }
      const { data: existing2, error: errFind2 } = await supabase.from("ptv_catatan").select("id, judul").eq("id", noteId2).maybeSingle();
      if (errFind2 || !existing2) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Data catatan tidak ditemukan di database backend Staging.", code: "not_found" }));
        return;
      }
      const { error: errDel } = await supabase.from("ptv_catatan").delete().eq("id", noteId2);
      if (errDel) {
        console.error("[API Catatan Delete Error]:", errDel);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gagal menghapus catatan: ${errDel.message}`, code: "delete_failed" }));
        return;
      }
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: `Catatan "${existing2.judul}" berhasil dihapus dari database Staging.`,
          deleted_id: noteId2
        })
      );
      return;
    }
    const payload = await parseJsonBody3(req);
    const noteId = String(payload.id || "").trim();
    if (!noteId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "ID Catatan (UUID) wajib disertakan untuk pembaruan.", code: "missing_id" }));
      return;
    }
    const { data: existing, error: errFind } = await supabase.from("ptv_catatan").select("*").eq("id", noteId).maybeSingle();
    if (errFind || !existing) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Catatan tidak ditemukan dalam database.", code: "not_found" }));
      return;
    }
    let nextJudul = existing.judul;
    if (payload.judul !== void 0) {
      nextJudul = String(payload.judul).trim();
      if (!nextJudul) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Judul catatan tidak boleh kosong.", code: "invalid_title" }));
        return;
      }
    }
    let nextIsi = existing.isi;
    if (payload.isi !== void 0) {
      nextIsi = String(payload.isi).trim();
      if (!nextIsi) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Isi catatan tidak boleh kosong.", code: "invalid_content" }));
        return;
      }
    }
    const nextTipe = payload.tipe !== void 0 ? payload.tipe : existing.tipe;
    if (payload.meeting_meta && typeof payload.meeting_meta === "object" && nextTipe === "meeting_minutes") {
      const metaStr = `<!-- PTV_META: ${JSON.stringify(payload.meeting_meta)} -->`;
      if (nextIsi.includes("<!-- PTV_META:")) {
        nextIsi = nextIsi.replace(/<!--\s*PTV_META:[\s\S]*?-->/, metaStr);
      } else {
        nextIsi = `${metaStr}

${nextIsi}`;
      }
    }
    const nextWarna = payload.warna !== void 0 ? String(payload.warna).toLowerCase().trim() : existing.warna;
    const nextKategori = payload.kategori || COLOR_TO_KATEGORI[nextWarna] || existing.kategori;
    const nextIsPinned = payload.is_pinned !== void 0 ? Boolean(payload.is_pinned) : existing.is_pinned;
    let nextTags = existing.tags;
    if (Array.isArray(payload.tags)) {
      nextTags = payload.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
    }
    if (nextTipe === "meeting_minutes" && !nextTags.includes("notulensi")) {
      nextTags.push("notulensi");
    }
    const { data: updated, error: errUpdate } = await supabase.from("ptv_catatan").update({
      judul: nextJudul,
      isi: nextIsi,
      warna: nextWarna,
      tipe: nextTipe,
      tags: nextTags,
      kategori: nextKategori,
      is_pinned: nextIsPinned,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", noteId).select().single();
    if (errUpdate || !updated) {
      console.error("[API Catatan Update Error]:", errUpdate);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: `Gagal memperbarui catatan di database Staging: ${errUpdate?.message || "Unknown error"}`,
          code: "update_failed"
        })
      );
      return;
    }
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        message: `Catatan "${updated.judul}" berhasil diperbarui.`,
        note: updated
      })
    );
  } catch (err) {
    console.error("[API Catatan Fatal Error]:", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message || "Terjadi kesalahan internal pada server." }));
  }
}

// api/_routes/dokumen.ts
init_cookies();
init_crypto();
init_identity();
import { randomUUID as randomUUID3 } from "node:crypto";
import { createClient as createClient7 } from "@supabase/supabase-js";

// src/products/hub/dokumen-saya/utils/documentOwnership.ts
function filterUserDocuments(docs, user) {
  if (user.isExecOrAdmin) {
    return docs;
  }
  const normalize = (value) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const rawIdentifiers = [user.name, user.username, user.ptv_id, user.account_id, user.identity_id].filter((value) => typeof value === "string" && value.trim().length > 0).map(normalize);
  const identifiers = new Set(rawIdentifiers);
  const matches = (value) => {
    if (!value || typeof value !== "string") return false;
    const norm = normalize(value);
    if (identifiers.has(norm)) return true;
    for (const id of rawIdentifiers) {
      if (id.length >= 3 && (norm.includes(id) || id.includes(norm))) {
        return true;
      }
    }
    return false;
  };
  return docs.filter((doc) => {
    if ([doc.owner, doc.pembawa, doc.penanggung_jawab, doc.diajukan_oleh].some(matches)) {
      return true;
    }
    if (Array.isArray(doc.recipients) && doc.recipients.some(matches)) {
      return true;
    }
    if (Array.isArray(doc.santri_list)) {
      const hasSantri = doc.santri_list.some((s) => {
        const sName = typeof s === "string" ? s : s?.nama || s?.name || "";
        return matches(sName);
      });
      if (hasSantri) return true;
    }
    return false;
  });
}

// src/products/hub/dokumen-saya/mock/docsMockData.ts
var INITIAL_DOCS_FIXTURES = [
  {
    id: "si_ff305b4f-0c0e-4abc-9da9-2556bdb1743c",
    no: "001/SI-PTV/X/2026",
    subject: "Izin Sekolah - Relay Haul Solo",
    type: "Surat Izin Santri",
    date: "2026-10-03",
    start_date: "2026-10-03",
    end_date: "2026-10-03",
    owner: "Farras",
    pembawa: "Farras",
    penanggung_jawab: "Pimpinan Eksekutif PTV",
    diajukan_oleh: "farras",
    recipients: ["Farras", "Muhammad Farras Zaidan Mubarok"],
    items: [],
    status: "Disetujui",
    created_at: "2026-10-03T07:15:00Z",
    approved_at: "2026-10-03T07:15:00Z",
    updated_at: "2026-10-03T07:15:00Z",
    status_history: [
      { status: "Menunggu", timestamp: "2026-10-03T07:00:00Z", actor: "Farras", note: "Permohonan surat izin: Izin Sekolah - Relay Haul Solo" },
      { status: "Disetujui", timestamp: "2026-10-03T07:15:00Z", actor: "Pimpinan Eksekutif PTV", note: "Surat izin disetujui dengan nomor resmi: 001/SI-PTV/X/2026" }
    ]
  },
  {
    id: "st_99999999-0000-0000-0000-000000000001",
    no: "042/ST-PTV/X/2026",
    subject: "Siaran Langsung Pengajian Akbar Maulid & Dokumentasi Multi-Kamera",
    type: "Surat Tugas",
    date: "2026-10-12",
    start_date: "2026-10-12",
    end_date: "2026-10-13",
    owner: "Muhammad Zidnal Falah",
    pembawa: "Muhammad Zidnal Falah",
    penanggung_jawab: "Dr. H. Ahmad Musthofa, M.Pd.",
    diajukan_oleh: "zidnalfalah",
    recipients: ["Muhammad Zidnal Falah", "Rizky Alamsyah", "Dimas Prayoga"],
    items: ["Sony FX3 Cinema Line", "DJI Mic 2 Dual", "Blackmagic ATEM Mini Pro"],
    status: "Disetujui",
    created_at: "2026-10-10T08:30:00Z",
    approved_at: "2026-10-10T09:00:00Z",
    updated_at: "2026-10-10T09:00:00Z",
    status_history: [
      { status: "Menunggu", timestamp: "2026-10-10T08:30:00Z", actor: "Muhammad Zidnal Falah", note: "Pengajuan surat tugas siaran langsung maulid" },
      { status: "Disetujui", timestamp: "2026-10-10T09:00:00Z", actor: "Dr. H. Ahmad Musthofa, M.Pd.", note: "Surat tugas disahkan nomor 042/ST-PTV/X/2026" }
    ]
  },
  {
    id: "sbb_88888888-0000-0000-0000-000000000002",
    no: "015/SBB-PTV/X/2026",
    subject: "Surat Bawa Barang: Siaran Outdoor Masjid Lebo Sidoarjo",
    type: "Izin Membawa Barang",
    date: "2026-10-14",
    start_date: "2026-10-14",
    end_date: "2026-10-14",
    owner: "Muhammad Zidnal Falah",
    pembawa: "Muhammad Zidnal Falah",
    penanggung_jawab: "Pimpinan Eksekutif PTV",
    diajukan_oleh: "PTV-001",
    recipients: ["Muhammad Zidnal Falah"],
    items: ["Sony FX3 Cinema Line", "Sony FE 24-70mm GM II", "Tripod Libec TH-X"],
    status: "Disetujui",
    created_at: "2026-10-14T06:45:00Z",
    approved_at: "2026-10-14T07:00:00Z",
    updated_at: "2026-10-14T07:00:00Z",
    status_history: [
      { status: "Menunggu", timestamp: "2026-10-14T06:45:00Z", actor: "Muhammad Zidnal Falah", note: "Pengajuan izin membawa unit kamera dan tripod" },
      { status: "Disetujui", timestamp: "2026-10-14T07:00:00Z", actor: "Pimpinan Eksekutif PTV", note: "Surat jalan disetujui nomor: 015/SBB-PTV/X/2026" }
    ]
  },
  {
    id: "si_f491c12e-1311-477c-a7a5-da229a43a296",
    no: "007/SI-PTV/X/2026",
    subject: "Dokuementasi Kedatangan Syekh Salim",
    type: "Surat Izin Santri",
    date: "2026-10-15",
    start_date: "2026-10-15",
    end_date: "2026-10-15",
    owner: "Farras",
    pembawa: "Farras",
    penanggung_jawab: "Pimpinan Redaksi PTV",
    diajukan_oleh: "farras",
    recipients: ["Farras", "Iyyaka"],
    items: [],
    status: "Disetujui",
    created_at: "2026-10-15T09:30:00Z",
    approved_at: "2026-10-15T09:30:00Z",
    updated_at: "2026-10-15T09:30:00Z",
    status_history: [
      { status: "Menunggu", timestamp: "2026-10-15T09:10:00Z", actor: "Muhammad Farras Zaidan Mubarok", note: "Permohonan surat izin: Dokuementasi Kedatangan Syekh Salim" },
      { status: "Disetujui", timestamp: "2026-10-15T09:30:00Z", actor: "Pimpinan Redaksi PTV", note: "Surat izin disetujui dengan nomor resmi: 007/SI-PTV/X/2026" }
    ]
  }
];

// src/products/hub/dokumen-saya/utils/letterNumbering.ts
var HISTORICAL_RESERVED_SEQUENCES = {
  "2026": {
    SI: [],
    ST: [],
    SBB: []
  }
};
var ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
function calculateNextLetterNumber(existingDocs, typeParam, dateParam) {
  const effectiveDate = dateParam || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const tag = typeParam === "ST" ? "ST-PTV" : typeParam === "SBB" ? "SBB-PTV" : "SI-PTV";
  const yearStr = effectiveDate.split("-")[0] || String((/* @__PURE__ */ new Date()).getFullYear());
  let m = 10;
  if (effectiveDate.includes("-")) {
    const parts = effectiveDate.split("-");
    if (parts.length >= 2) m = parseInt(parts[1], 10) || 10;
  }
  const roman = ROMAN_MONTHS[Math.max(0, Math.min(11, m - 1))];
  const usedSeqs = /* @__PURE__ */ new Set();
  const reservedForYear = HISTORICAL_RESERVED_SEQUENCES[yearStr]?.[typeParam] || [];
  for (const seq of reservedForYear) {
    usedSeqs.add(seq);
  }
  const regex = new RegExp(`^(\\d{1,6})\\/${tag}\\/([A-Z]+)\\/${yearStr}$`, "i");
  for (const d of existingDocs) {
    const num = (d.no || "").trim();
    const match = num.match(regex);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (!isNaN(seq) && seq > 0) {
        usedSeqs.add(seq);
      }
    }
  }
  let candidate = 1;
  while (usedSeqs.has(candidate)) {
    candidate++;
  }
  if (candidate > 999999) throw new Error("Kapasitas nomor surat tahunan habis.");
  const maxUsed = usedSeqs.size > 0 ? Math.max(0, ...usedSeqs) : 0;
  const isVacant = candidate < maxUsed;
  const padded = String(candidate).padStart(3, "0");
  const nextNomor = `${padded}/${tag}/${roman}/${yearStr}`;
  return {
    nomor_surat: nextNomor,
    sequence: candidate,
    is_vacant: isVacant,
    year: yearStr,
    roman_month: roman
  };
}

// api/_routes/dokumen.ts
function calculateNextNomorSurat(allDocs, typeParam, dateParam) {
  return calculateNextLetterNumber(allDocs, typeParam, dateParam);
}
function parseJsonRequestBody(req) {
  if (req.body !== void 0 && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error("Ukuran payload request melebihi batas 2MB."));
      }
    });
    req.on("end", () => {
      if (!raw || !raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error(`Format JSON body tidak valid: ${e.message}`));
      }
    });
    req.on("error", (err) => reject(err));
  });
}
function mapDbStatusToDocStatus(statusRaw) {
  const s = (statusRaw || "").toLowerCase().trim();
  if (["diarsipkan", "archived"].includes(s)) return "Diarsipkan";
  if (["disetujui", "aktif", "valid", "approved", "acc"].includes(s)) return "Disetujui";
  if (["revisi", "revision"].includes(s)) return "Revisi";
  if (["ditolak", "rejected", "dibatalkan", "batal"].includes(s)) return "Ditolak";
  return "Menunggu";
}
function parseJsonOrArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map((item) => typeof item === "object" && item !== null ? item.nama || item.name || JSON.stringify(item) : String(item)).filter(Boolean);
  }
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => typeof item === "object" && item !== null ? item.nama || item.name || JSON.stringify(item) : String(item)).filter(Boolean);
      }
    } catch {
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [val.trim()].filter(Boolean);
  }
  return [];
}
function mapSuratIzinToDoc(row) {
  const status = mapDbStatusToDocStatus(row.status);
  const officialNo = status === "Disetujui" && row.nomor_surat ? row.nomor_surat : row.nomor_surat || "\u2014";
  const recipientName = (row.nama_santri || row.nama_pemohon || "").trim();
  const subject = row.jenis_kegiatan || row.alasan || "Permohonan Izin Santri";
  const santriList = parseJsonOrArray(row.santri_list);
  const recipients = santriList.length > 0 ? santriList : recipientName ? [recipientName] : [];
  return {
    id: `si_${row.id}`,
    no: officialNo,
    subject,
    type: "Surat Izin Santri",
    date: row.tanggal_mulai || (row.created_at ? row.created_at.slice(0, 10) : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)),
    start_date: row.tanggal_mulai || void 0,
    end_date: row.tanggal_selesai || void 0,
    owner: recipientName || "Pemohon",
    pembawa: recipientName || void 0,
    penanggung_jawab: row.penanggung_jawab || row.disetujui_oleh || void 0,
    diajukan_oleh: row.diajukan_oleh || void 0,
    recipients,
    santri_list: Array.isArray(row.santri_list) ? row.santri_list : void 0,
    metadata: row.metadata,
    qr_token: row.qr_token,
    items: [],
    status,
    created_at: row.created_at,
    approved_at: status === "Disetujui" ? row.created_at : void 0,
    status_history: [
      {
        status: "Menunggu",
        timestamp: row.created_at,
        actor: recipientName || "Pemohon",
        note: `Pengajuan surat izin santri: ${subject}`
      },
      ...status === "Disetujui" ? [
        {
          status: "Disetujui",
          timestamp: row.created_at,
          actor: row.disetujui_oleh || "Pimpinan Eksekutif PTV",
          note: `Surat izin disetujui dengan nomor resmi: ${row.nomor_surat || "Telah diterbitkan"}`
        }
      ] : []
    ]
  };
}
function mapSuratTugasToDoc(row) {
  const status = mapDbStatusToDocStatus(row.status);
  const officialNo = status === "Disetujui" && row.nomor_surat ? row.nomor_surat : row.nomor_surat || "\u2014";
  const recipients = parseJsonOrArray(row.kru_terlibat);
  return {
    id: `st_${row.id}`,
    no: officialNo,
    subject: row.perihal || "Surat Tugas Operasional Liputan",
    type: "Surat Tugas",
    date: row.tanggal_tugas || (row.created_at ? row.created_at.slice(0, 10) : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)),
    start_date: row.tanggal_tugas || void 0,
    end_date: row.tanggal_tugas || void 0,
    owner: row.disetujui_oleh || row.diajukan_oleh || "Pimpinan Studio",
    penanggung_jawab: row.disetujui_oleh || void 0,
    diajukan_oleh: row.diajukan_oleh || void 0,
    recipients,
    items: [],
    status,
    created_at: row.created_at,
    approved_at: status === "Disetujui" ? row.created_at : void 0,
    status_history: [
      {
        status: "Menunggu",
        timestamp: row.created_at,
        actor: row.diajukan_oleh || "Pemohon",
        note: `Pengajuan surat tugas: ${row.perihal || "Penugasan kru"}`
      },
      ...status === "Disetujui" ? [
        {
          status: "Disetujui",
          timestamp: row.created_at,
          actor: row.disetujui_oleh || "Pimpinan Eksekutif PTV",
          note: `Surat tugas disahkan dengan nomor resmi: ${row.nomor_surat || "Telah diterbitkan"}`
        }
      ] : []
    ]
  };
}
function mapSuratBarangToDoc(row) {
  const status = mapDbStatusToDocStatus(row.status);
  const officialNo = status === "Disetujui" && row.nomor_surat ? row.nomor_surat : row.nomor_surat || "\u2014";
  const items = parseJsonOrArray(row.daftar_barang);
  const pembawa = (row.nama_pembawa || "").trim();
  return {
    id: `sbb_${row.id}`,
    no: officialNo,
    subject: row.tujuan_lokasi ? `Surat Bawa Barang: ${row.tujuan_lokasi}` : "Surat Izin Membawa Peralatan Studio",
    type: "Izin Membawa Barang",
    date: row.created_at ? row.created_at.slice(0, 10) : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    owner: pembawa || "Pembawa Barang",
    pembawa: pembawa || void 0,
    penanggung_jawab: row.disetujui_oleh || void 0,
    diajukan_oleh: row.diajukan_oleh || void 0,
    recipients: pembawa ? [pembawa] : [],
    items,
    status,
    created_at: row.created_at,
    approved_at: status === "Disetujui" ? row.created_at : void 0,
    status_history: [
      {
        status: "Menunggu",
        timestamp: row.created_at,
        actor: pembawa || "Pembawa Barang",
        note: `Pengajuan izin bawa barang lokasi: ${row.tujuan_lokasi || "Operasional luar"}`
      },
      ...status === "Disetujui" ? [
        {
          status: "Disetujui",
          timestamp: row.created_at,
          actor: row.disetujui_oleh || "Pimpinan Eksekutif PTV",
          note: `Surat jalan peralatan disetujui nomor: ${row.nomor_surat || "Telah diterbitkan"}`
        }
      ] : []
    ]
  };
}
async function handler5(req, res) {
  res.setHeader("Content-Type", "application/json");
  const method = (req.method || "GET").toUpperCase();
  const urlObj = new URL(req.url || "", "http://localhost");
  const mode = urlObj.searchParams.get("mode") || "my";
  if (!["my", "archive", "vacant_check"].includes(mode)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Mode dokumen tidak valid.", code: "invalid_mode" }));
    return;
  }
  let requestBody = {};
  if (["POST", "PUT", "PATCH"].includes(method)) {
    try {
      requestBody = await parseJsonRequestBody(req);
    } catch (parseErr) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: parseErr.message || "Payload JSON tidak valid.", code: "invalid_json_body" }));
      return;
    }
  }
  const action = urlObj.searchParams.get("action") || (requestBody && typeof requestBody === "object" ? requestBody.action : null);
  if (method !== "GET") {
    if (method !== "POST" || action !== "create" && action !== "update_status" && action !== "delete" && action !== "archive") {
      res.statusCode = 405;
      res.end(
        JSON.stringify({
          error: `Metode HTTP ${method} tidak didukung. Modul Dokumen dan Arsip saat ini beroperasi dalam mode Strict Read-Only.`,
          code: "method_not_allowed"
        })
      );
      return;
    }
  }
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  if (!sessionToken) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses dokumen dan arsip.",
        code: "unauthorized"
      })
    );
    return;
  }
  const session = verifySessionToken(sessionToken, authSecret);
  if (!session) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Sesi login Anda tidak valid atau telah kedaluwarsa. Silakan masuk kembali.",
        code: "session_expired"
      })
    );
    return;
  }
  const userCaps = await refreshLiveSession(session);
  if (!userCaps.includes("hub.access")) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Sesi atau izin telah dicabut." }));
    return;
  }
  const isExecOrAdmin = userCaps.includes("documents.archive.manage") || userCaps.includes("documents.approve");
  const canApprove = userCaps.includes("documents.approve") || userCaps.includes("documents.archive.manage");
  if (method === "POST" && !userCaps.some((cap) => ["documents.request", "documents.generate", "documents.approve", "documents.archive.manage"].includes(cap))) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Izin menulis dokumen diperlukan.", code: "forbidden" }));
    return;
  }
  if (method === "GET" && !userCaps.some((cap) => ["documents.view", "documents.generate", "documents.archive.view", "documents.archive.manage", "documents.approve"].includes(cap))) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Izin membaca dokumen diperlukan.", code: "forbidden" }));
    return;
  }
  if (mode === "archive") {
    const canViewAny = isExecOrAdmin || userCaps.includes("documents.archive.view");
    if (!canViewAny) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: "Akses ditolak: Anda tidak memiliki izin untuk mengakses Surat & Arsip.",
          code: "forbidden_archive_access"
        })
      );
      return;
    }
  }
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    let allDocs = [];
    let supabase = null;
    if (supabaseUrl && serviceRoleKey) {
      const accountActive = await verifyAccountStatusLive(session.account_id, session.iat, session);
      if (!accountActive) {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            error: "Akses ditolak: Akun Anda telah dinonaktifkan dari sistem.",
            code: "account_inactive"
          })
        );
        return;
      }
      supabase = createClient7(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      try {
        let logsData = [];
        try {
          const resLogsQuery = await supabase.from("ptv_surat_verifikasi_logs").select("id, nomor_surat, nama_pemeriksa, instansi, metadata, accessed_at").order("accessed_at", { ascending: false });
          if (resLogsQuery && Array.isArray(resLogsQuery.data)) {
            logsData = resLogsQuery.data;
          }
        } catch {
          logsData = [];
        }
        const [resIzin, resTugas, resBarang, resReg] = await Promise.all([
          supabase.from("ptv_surat_izin").select("*").order("created_at", { ascending: false }),
          supabase.from("ptv_surat_tugas").select("*").order("created_at", { ascending: false }),
          supabase.from("ptv_surat_barang").select("*").order("created_at", { ascending: false }),
          supabase.from("ptv_issued_letter_registry").select("nomor_surat")
        ]);
        if (resIzin.error || resTugas.error || resBarang.error) throw new Error("Gagal membaca arsip dokumen.");
        const izinDocs = (resIzin.data || []).map((r) => mapSuratIzinToDoc(r));
        const tugasDocs = (resTugas.data || []).map((r) => mapSuratTugasToDoc(r));
        const barangDocs = (resBarang.data || []).map((r) => mapSuratBarangToDoc(r));
        const regDocs = (resReg.data || []).map((r) => ({
          id: `reg_${r.nomor_surat}`,
          no: r.nomor_surat,
          subject: "",
          type: "Surat Tugas",
          date: "",
          owner: "",
          recipients: [],
          items: [],
          status: "Disetujui"
        }));
        const logsByNomor = /* @__PURE__ */ new Map();
        if (Array.isArray(logsData)) {
          for (const log of logsData) {
            if (!log.nomor_surat) continue;
            const list = logsByNomor.get(log.nomor_surat) || [];
            const meta = log.metadata || {};
            list.push({
              id: log.id,
              nomor_surat: log.nomor_surat,
              nama_pemeriksa: log.nama_pemeriksa,
              instansi: log.instansi,
              waktu: log.accessed_at || meta.recorded_at,
              hasil: meta.hasil || "Berhasil",
              status_dokumen: meta.status_dokumen,
              catatan: meta.catatan || "Pemeriksaan Tercatat",
              accessed_at: log.accessed_at,
              metadata: meta
            });
            logsByNomor.set(log.nomor_surat, list);
          }
        }
        allDocs = [...izinDocs, ...tugasDocs, ...barangDocs, ...regDocs].sort(
          (a, b) => (b.created_at || "").localeCompare(a.created_at || "")
        );
        for (const d of allDocs) {
          if (!d.no || d.no === "\u2014") continue;
          const dbLogs = logsByNomor.get(d.no) || [];
          const currentMeta = d.metadata || {};
          const currentMetaLogs = Array.isArray(currentMeta.verifikasi_logs) ? currentMeta.verifikasi_logs : [];
          if (dbLogs.length > 0 || currentMetaLogs.length > 0) {
            const existingIds = new Set(currentMetaLogs.map((x) => x.id));
            const merged = [...currentMetaLogs];
            for (const dbl of dbLogs) {
              if (!existingIds.has(dbl.id)) {
                existingIds.add(dbl.id);
                merged.push(dbl);
              }
            }
            merged.sort(
              (a, b) => new Date(b.accessed_at || b.waktu || b.metadata && b.metadata.recorded_at || 0).getTime() - new Date(a.accessed_at || a.waktu || a.metadata && a.metadata.recorded_at || 0).getTime()
            );
            d.metadata = { ...currentMeta, verifikasi_logs: merged };
          }
        }
      } catch {
        throw new Error("Data dokumen backend tidak dapat dimuat.");
      }
    } else {
      if (process.env.NODE_ENV !== "test") throw new Error("Backend dokumen belum terkonfigurasi.");
      allDocs = [...INITIAL_DOCS_FIXTURES];
    }
    if (method === "POST") {
      const body = requestBody;
      if (action === "create") {
        const canGenerateOrRequest = userCaps.includes("documents.generate") || userCaps.includes("documents.request") || userCaps.includes("documents.approve") || userCaps.includes("documents.archive.manage") || userCaps.includes("role:eksekutif") || userCaps.includes("role:administrasi");
        if (!canGenerateOrRequest) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Akses ditolak: Izin penerbitan atau pengajuan dokumen diperlukan.", code: "forbidden" }));
          return;
        }
        const typeRaw = (body.type || body.jenis_surat || body.tipo || "izin").toString();
        const isBarang = typeRaw.toLowerCase().includes("barang") || typeRaw === "SBB" || typeRaw === "SB";
        const isTugas = typeRaw.toLowerCase().includes("tugas") || typeRaw === "ST";
        const isIzin = typeRaw.toLowerCase().includes("izin") && !isBarang || typeRaw === "SI";
        const nowIso2 = (/* @__PURE__ */ new Date()).toISOString();
        const dateStr = body.start_date || body.tanggal_mulai || body.date || nowIso2.slice(0, 10);
        const endDateStr = body.end_date || body.tanggal_selesai || dateStr;
        const shouldApprove = canApprove || body.status === "Disetujui" || isExecOrAdmin;
        const initialStatus = shouldApprove ? "Disetujui" : "Menunggu";
        const identityId = /^[0-9a-f-]{36}$/i.test(session.identity_id || "") ? session.identity_id : null;
        if (isIzin) {
          const mayIssue = canApprove || userCaps.includes("documents.generate");
          const approved = mayIssue && (body.status === "Disetujui" || canApprove);
          const santriList = Array.isArray(body.santri_list) ? body.santri_list : (body.recipients || []).map((nama) => ({ nama }));
          const documentInput = {
            id: body.request_id || randomUUID3(),
            nama_pemohon: session.full_name || "Pemohon",
            alasan: (body.subject || body.alasan || body.kegiatan || "Surat Izin Santri").trim(),
            tanggal_mulai: dateStr,
            tanggal_selesai: endDateStr,
            diajukan_oleh: identityId,
            disetujui_oleh: approved ? identityId : null,
            penanggung_jawab: approved ? body.penanggung_jawab || session.full_name || "Pimpinan Eksekutif PTV" : null,
            santri_list: santriList,
            metadata: { ...body.metadata || {}, notes: body.notes || "", santriCount: santriList.length }
          };
          if (!supabase) throw new Error("Backend penerbitan surat wajib tersedia.");
          if (approved) {
            const { data: saved, error: error2 } = await supabase.rpc("issue_ptv_surat_izin_atomic", { p_document: documentInput });
            if (error2 || !saved?.nomor_surat || saved.id !== documentInput.id) {
              res.statusCode = 503;
              res.end(JSON.stringify({ error: "Penerbitan atomik belum dikonfirmasi server. Pastikan migrasi penomoran sudah diterapkan; ulangi permintaan yang sama.", code: "atomic_issuance_unavailable" }));
              return;
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, document: mapSuratIzinToDoc(saved) }));
            return;
          }
          const { data: draft, error } = await supabase.from("ptv_surat_izin").insert({
            ...documentInput,
            nomor_surat: "\u2014",
            status: "menunggu",
            jenis_surat: "Surat Izin Santri"
          }).select("*").single();
          if (error || !draft) throw new Error("Pengajuan surat belum tersimpan.");
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, document: mapSuratIzinToDoc(draft) }));
          return;
        }
        if (isTugas) {
          const typeTag = "ST";
          let officialNo2 = (body.no || body.nomor_surat || "").trim();
          if (!officialNo2 || officialNo2 === "\u2014" || officialNo2 === "-") {
            if (shouldApprove) {
              const allocated = calculateNextLetterNumber(allDocs, typeTag, dateStr);
              officialNo2 = allocated.nomor_surat;
            } else {
              officialNo2 = "\u2014";
            }
          }
          const rawId = body.id || randomUUID3();
          const cleanUuid = /^[0-9a-f-]{36}$/i.test(rawId.replace(/^st_/, "")) ? rawId.replace(/^st_/, "") : randomUUID3();
          const perihal = (body.subject || body.perihal || "Penugasan Liputan").trim();
          const diajukanOleh = session.full_name || session.username || "Pemohon";
          const disetujuiOleh = shouldApprove ? body.penanggung_jawab || session.full_name || "Pimpinan Eksekutif PTV" : null;
          const kruTerlibat = Array.isArray(body.recipients) ? body.recipients : [];
          if (supabase) {
            try {
              const { error: insErr } = await supabase.from("ptv_surat_tugas").insert({
                id: cleanUuid,
                nomor_surat: officialNo2,
                perihal,
                tanggal_tugas: dateStr,
                kru_terlibat: kruTerlibat,
                disetujui_oleh: shouldApprove ? identityId : null,
                status: initialStatus,
                diajukan_oleh: identityId,
                created_at: nowIso2
              });
              if (insErr) throw insErr;
            } catch (dbErr) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: dbErr.message || "Gagal menyimpan surat tugas ke cloud.", code: "database_insert_error" }));
              return;
            }
          }
          const createdDoc = {
            id: `st_${cleanUuid}`,
            no: officialNo2,
            subject: perihal,
            type: "Surat Tugas",
            date: dateStr,
            start_date: dateStr,
            end_date: endDateStr,
            owner: diajukanOleh,
            penanggung_jawab: disetujuiOleh || void 0,
            recipients: kruTerlibat,
            items: [],
            status: initialStatus,
            created_at: nowIso2,
            approved_at: shouldApprove ? nowIso2 : void 0
          };
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, document: createdDoc }));
          return;
        }
        if (isBarang) {
          const typeTag = "SBB";
          let officialNo2 = (body.no || body.nomor_surat || "").trim();
          if (!officialNo2 || officialNo2 === "\u2014" || officialNo2 === "-") {
            if (shouldApprove) {
              const allocated = calculateNextLetterNumber(allDocs, typeTag, dateStr);
              officialNo2 = allocated.nomor_surat;
            } else {
              officialNo2 = "\u2014";
            }
          }
          const rawId = body.id || randomUUID3();
          const cleanUuid = /^[0-9a-f-]{36}$/i.test(rawId.replace(/^sbb_/, "")) ? rawId.replace(/^sbb_/, "") : randomUUID3();
          const pembawa2 = (body.pembawa || body.owner || session.full_name || "Pembawa").trim();
          const tujuanLokasi = (body.subject || body.tujuan || "Lokasi Kegiatan").trim();
          const daftarBarang = Array.isArray(body.items) ? body.items : [];
          const disetujuiOleh = shouldApprove ? body.penanggung_jawab || session.full_name || "Pimpinan Eksekutif PTV" : null;
          if (supabase) {
            try {
              const { error: insErr } = await supabase.from("ptv_surat_barang").insert({
                id: cleanUuid,
                nomor_surat: officialNo2,
                nama_pembawa: pembawa2,
                tujuan_lokasi: tujuanLokasi,
                daftar_barang: daftarBarang,
                disetujui_oleh: shouldApprove ? identityId : null,
                status: initialStatus,
                diajukan_oleh: identityId,
                created_at: nowIso2
              });
              if (insErr) throw insErr;
            } catch (dbErr) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: dbErr.message || "Gagal menyimpan surat barang ke cloud.", code: "database_insert_error" }));
              return;
            }
          }
          const createdDoc = {
            id: `sbb_${cleanUuid}`,
            no: officialNo2,
            subject: tujuanLokasi,
            type: "Izin Membawa Barang",
            date: dateStr,
            start_date: dateStr,
            end_date: endDateStr,
            owner: pembawa2,
            penanggung_jawab: disetujuiOleh || void 0,
            recipients: [pembawa2],
            items: daftarBarang,
            status: initialStatus,
            created_at: nowIso2,
            approved_at: shouldApprove ? nowIso2 : void 0
          };
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, document: createdDoc }));
          return;
        }
        res.statusCode = 400;
        res.end(JSON.stringify({ error: `Tipe dokumen "${typeRaw}" tidak didukung.`, code: "unsupported_type" }));
        return;
      }
      if (action === "update_status") {
        if (!canApprove) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Perubahan dokumen ditahan sampai otorisasi kepemilikan terverifikasi.", code: "forbidden" }));
          return;
        }
        const { id, status: newStatusRaw, note, updates } = body;
        if (!id || typeof id !== "string") {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "ID dokumen wajib diisi.", code: "missing_id" }));
          return;
        }
        const newStatus = (newStatusRaw || "").toLowerCase().trim();
        const validStatuses = ["disetujui", "revisi", "ditolak", "menunggu", "diarsipkan", "berlaku", "dibatalkan"];
        if (!validStatuses.includes(newStatus)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: `Status "${newStatusRaw}" tidak valid. Pilihan: ${validStatuses.join(", ")}.`, code: "invalid_status" }));
          return;
        }
        if (["disetujui", "revisi", "ditolak"].includes(newStatus) && !canApprove) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Akses ditolak: Anda tidak memiliki wewenang untuk mengubah status atau mengesahkan dokumen.", code: "forbidden" }));
          return;
        }
        const existingDoc = allDocs.find((d) => d.id === id);
        if (!existingDoc) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Dokumen tidak ditemukan." }));
          return;
        }
        const docTypeTag = id.startsWith("st_") ? "ST" : id.startsWith("sbb_") ? "SBB" : "SI";
        const cleanUuid = id.replace(/^(st_|sbb_|si_)/, "");
        const targetTable = id.startsWith("st_") ? "ptv_surat_tugas" : id.startsWith("sbb_") ? "ptv_surat_barang" : "ptv_surat_izin";
        const nowIso2 = (/* @__PURE__ */ new Date()).toISOString();
        let officialNo2 = existingDoc?.no || "\u2014";
        let approverName2 = void 0;
        if (newStatus === "disetujui" && docTypeTag === "SI" && supabase) {
          const { data: saved, error } = await supabase.rpc("approve_ptv_surat_izin_atomic", {
            p_doc_id: cleanUuid,
            p_identity_id: session.identity_id || null,
            p_issuer: session.full_name || "Pimpinan Eksekutif PTV",
            p_note: note || null
          });
          if (error || !saved?.nomor_surat) throw new Error("Persetujuan atomik belum tersedia. Terapkan migrasi penomoran terlebih dahulu.");
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, document: mapSuratIzinToDoc(saved) }));
          return;
        }
        if (newStatus === "disetujui") {
          approverName2 = session.full_name || session.username || "Pimpinan Eksekutif PTV";
          if (supabase && cleanUuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            try {
              const { data: atomicRes, error: rpcErr } = await supabase.rpc("approve_ptv_document_atomic", {
                p_doc_type: docTypeTag,
                p_doc_id: cleanUuid,
                p_approver_identity_id: session.identity_id || null,
                p_note: note || null
              });
              if (rpcErr || !atomicRes?.success || !atomicRes.nomor_surat) throw new Error("Persetujuan atomik belum tersedia. Tidak ada nomor surat yang dialokasikan.");
              officialNo2 = atomicRes.nomor_surat;
            } catch {
              throw new Error("Persetujuan atomik belum tersedia. Tidak ada nomor surat yang dialokasikan.");
            }
          }
          if (!officialNo2 || officialNo2 === "\u2014" || officialNo2.startsWith("DRAFT")) {
            const effectiveDate2 = existingDoc?.date || existingDoc?.start_date || nowIso2.slice(0, 10);
            const vacant = calculateNextNomorSurat(allDocs, docTypeTag, effectiveDate2);
            officialNo2 = vacant.nomor_surat;
          }
        }
        if (supabase) {
          try {
            const dbPayload = {
              status: newStatus
            };
            if (newStatus === "disetujui") {
              if (officialNo2 && officialNo2 !== "\u2014") dbPayload.nomor_surat = officialNo2;
              const identityId = /^[0-9a-f-]{36}$/i.test(session.identity_id || "") ? session.identity_id : null;
              if (identityId) dbPayload.disetujui_oleh = identityId;
            }
            if (updates && typeof updates === "object") {
              if (targetTable === "ptv_surat_tugas") {
                if (updates.subject) dbPayload.perihal = updates.subject;
                if (updates.recipients) dbPayload.kru_terlibat = updates.recipients;
              } else if (targetTable === "ptv_surat_barang") {
                if (updates.items) dbPayload.daftar_barang = updates.items;
                if (updates.pembawa) dbPayload.nama_pembawa = updates.pembawa;
              }
            }
            const { error: updErr } = await supabase.from(targetTable).update(dbPayload).eq("id", cleanUuid);
            if (updErr) {
              throw new Error("Pembaruan dokumen gagal disimpan.");
            }
          } catch {
            throw new Error("Pembaruan dokumen gagal disimpan.");
          }
        }
        const mappedStatus = mapDbStatusToDocStatus(newStatus);
        const historyActionLabel = mappedStatus === "Disetujui" ? `Disetujui resmi oleh ${approverName2} dengan nomor ${officialNo2}.` : mappedStatus === "Revisi" ? `Permintaan perbaikan/revisi: ${note || "Perbaiki detail pengajuan"}` : mappedStatus === "Ditolak" ? `Pengajuan ditolak: ${note || "Tidak memenuhi kualifikasi"}` : `Pengajuan diperbarui dan diajukan ulang oleh ${session.full_name || "Pemohon"}.`;
        const newHistoryEntry = {
          status: mappedStatus,
          timestamp: nowIso2,
          actor: session.full_name || session.username || "Pimpinan Eksekutif PTV",
          note: note ? `${historyActionLabel} \u2014 Catatan: ${note}` : historyActionLabel
        };
        const updatedDoc = {
          ...existingDoc || {
            id,
            no: officialNo2,
            subject: updates?.subject || "Dokumen Persuratan",
            type: docTypeTag === "ST" ? "Surat Tugas" : docTypeTag === "SBB" ? "Izin Membawa Barang" : "Surat Izin Santri",
            date: nowIso2.slice(0, 10),
            owner: session.full_name || "Pemohon",
            recipients: [],
            items: [],
            status: mappedStatus,
            created_at: nowIso2
          },
          ...updates || {},
          status: mappedStatus,
          no: officialNo2,
          approved_at: mappedStatus === "Disetujui" ? nowIso2 : existingDoc?.approved_at,
          penanggung_jawab: mappedStatus === "Disetujui" ? approverName2 || existingDoc?.penanggung_jawab : existingDoc?.penanggung_jawab,
          review_note: note || existingDoc?.review_note,
          status_history: [
            ...existingDoc?.status_history || [],
            newHistoryEntry
          ]
        };
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            message: `Status dokumen ${id} berhasil diperbarui menjadi ${mappedStatus}.`,
            document: updatedDoc
          })
        );
        return;
      }
      if (action === "archive") {
        if (!canApprove && !userCaps.includes("documents.archive.manage")) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Akses ditolak: Izin mengarsipkan dokumen diperlukan.", code: "forbidden" }));
          return;
        }
        const docId = (body.id || urlObj.searchParams.get("id") || "").trim();
        if (!docId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "ID dokumen wajib diisi untuk mengarsipkan.", code: "missing_id" }));
          return;
        }
        const existingDoc = allDocs.find((d) => d.id === docId);
        if (!existingDoc) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Dokumen tidak ditemukan.", code: "not_found" }));
          return;
        }
        const cleanUuid = docId.replace(/^(st_|sbb_|si_)/, "");
        const targetTable = docId.startsWith("st_") ? "ptv_surat_tugas" : docId.startsWith("sbb_") ? "ptv_surat_barang" : "ptv_surat_izin";
        const nowIso2 = (/* @__PURE__ */ new Date()).toISOString();
        const updatedHistory = [
          ...existingDoc.status_history || [],
          {
            status: "Diarsipkan",
            timestamp: nowIso2,
            actor: session.full_name || session.username || "Pimpinan Eksekutif PTV",
            note: body.note || "Surat telah diarsipkan dan ditandai tidak berlaku."
          }
        ];
        if (supabase) {
          try {
            await supabase.from(targetTable).update({
              status: "diarsipkan",
              updated_at: nowIso2,
              metadata: {
                ...existingDoc.metadata || {},
                status_history: updatedHistory,
                archived_at: nowIso2,
                archived_by: session.full_name || session.username
              }
            }).eq("id", cleanUuid);
          } catch (err) {
            console.warn("[API Dokumen] Archive update warning:", err.message);
          }
        }
        const updatedDoc = {
          ...existingDoc,
          status: "Diarsipkan",
          status_history: updatedHistory,
          updated_at: nowIso2
        };
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            message: `Surat ${existingDoc.no || docId} berhasil diarsipkan.`,
            document: updatedDoc
          })
        );
        return;
      }
      if (action === "delete") {
        if (!userCaps.includes("documents.archive.manage")) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Izin mengelola arsip diperlukan.", code: "forbidden" }));
          return;
        }
        const docId = (body.id || urlObj.searchParams.get("id") || "").trim();
        if (!docId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "ID dokumen wajib diisi untuk menghapus.", code: "missing_id" }));
          return;
        }
        const existingDoc = allDocs.find((d) => d.id === docId);
        if (!existingDoc) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Dokumen tidak ditemukan." }));
          return;
        }
        if (existingDoc && existingDoc.status === "Disetujui" && !canApprove) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Akses ditolak: Dokumen yang telah disetujui resmi hanya dapat dihapus oleh Pimpinan/Eksekutif.", code: "forbidden" }));
          return;
        }
        const cleanUuid = docId.replace(/^(st_|sbb_|si_)/, "");
        const targetTable = docId.startsWith("st_") ? "ptv_surat_tugas" : docId.startsWith("sbb_") ? "ptv_surat_barang" : "ptv_surat_izin";
        const docTypeTag = docId.startsWith("st_") ? "ST" : docId.startsWith("sbb_") ? "SBB" : "SI";
        if (supabase) {
          try {
            const { data: rpcRes } = await supabase.rpc("rpc_delete_letter_and_release", {
              p_doc_id: cleanUuid,
              p_doc_type: docTypeTag,
              p_actor_id: session.identity_id || null,
              p_actor_name: session.full_name || session.username || "Pengelola Surat PTV",
              p_reason: body.reason || "Dihapus dari Surat & Arsip"
            });
            if (!rpcRes?.success) {
              try {
                await supabase.from("ptv_letter_deletion_audit").insert({
                  doc_id: cleanUuid,
                  doc_type: docTypeTag,
                  nomor_surat: existingDoc.no || "DRAFT",
                  deleted_by: session.full_name || session.username || "Pengelola Surat PTV",
                  actor_id: session.identity_id || null,
                  reason: body.reason || "Dihapus dari Surat & Arsip"
                });
              } catch {
              }
              if (existingDoc.no && !existingDoc.no.startsWith("DRAFT") && existingDoc.no !== "\u2014") {
                try {
                  await supabase.from("ptv_issued_letter_registry").delete().eq("doc_type", docTypeTag).or(`doc_id.eq.${cleanUuid},nomor_surat.eq.${existingDoc.no}`);
                } catch {
                }
              }
              const { error: delErr } = await supabase.from(targetTable).delete().eq("id", cleanUuid);
              if (delErr) {
                console.warn("[API Dokumen] Delete table error:", delErr.message);
              }
            }
          } catch (err) {
            console.warn("[API Dokumen] Deletion process error:", err.message);
          }
        }
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            message: `Dokumen ${docId} berhasil dihapus.`,
            id: docId
          })
        );
        return;
      }
      const {
        type,
        subject,
        date,
        start_date,
        end_date,
        pembawa,
        penanggung_jawab,
        recipients,
        items,
        unit_ids,
        event,
        event_id,
        source,
        notes
      } = body;
      if (!subject || typeof subject !== "string" || !subject.trim()) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: "Perihal / subjek dokumen wajib diisi.",
            code: "missing_subject"
          })
        );
        return;
      }
      const docType = type === "SBB" ? "Izin Membawa Barang" : type === "ST" || !type ? "Surat Tugas" : type;
      if (!["Izin Membawa Barang", "Surat Tugas"].includes(docType)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Jenis dokumen tidak didukung." }));
        return;
      }
      const effectiveDate = start_date || date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const isFromAcara = source === "acara" && Boolean(event_id);
      let docStatus = "Menunggu";
      let officialNo = "\u2014";
      let approverName = void 0;
      let approvedAt = void 0;
      if (docType.includes("Barang") || docType === "SBB") {
        if (isFromAcara && canApprove && !supabase) {
          docStatus = "Disetujui";
          const vacant = calculateNextNomorSurat(allDocs, "SBB", effectiveDate);
          officialNo = vacant.nomor_surat;
          approverName = session.full_name || session.username || "Pimpinan Eksekutif PTV";
          approvedAt = nowIso;
        } else {
          docStatus = "Menunggu";
          officialNo = "\u2014";
        }
      } else if (docType.includes("Tugas") || docType === "ST") {
        if (canApprove && !supabase) {
          docStatus = "Disetujui";
          const vacant = calculateNextNomorSurat(allDocs, "ST", effectiveDate);
          officialNo = vacant.nomor_surat;
          approverName = session.full_name || session.username || "Pimpinan Eksekutif PTV";
          approvedAt = nowIso;
        } else {
          docStatus = "Menunggu";
          officialNo = "\u2014";
        }
      }
      const rawUuid = randomUUID3();
      const prefix = docType.includes("Barang") ? "sbb_" : "st_";
      const finalDocId = `${prefix}${rawUuid}`;
      const statusHistory = [
        {
          status: "Menunggu",
          timestamp: nowIso,
          actor: session.full_name || session.username || "Pemohon",
          note: isFromAcara ? `Pengajuan ${docType} dari Detail Acara: ${event || subject}` : `Pengajuan ${docType}: ${subject}`
        }
      ];
      if (docStatus === "Disetujui") {
        statusHistory.push({
          status: "Disetujui",
          timestamp: nowIso,
          actor: approverName || "Pimpinan Eksekutif PTV",
          note: isFromAcara ? `Disetujui otomatis dari Detail Acara oleh ${approverName} (otoritas resmi). Nomor resmi diterbitkan: ${officialNo}` : `Surat disahkan resmi dengan nomor: ${officialNo}`
        });
      }
      if (supabase) {
        try {
          if (docType.includes("Barang") || docType === "SBB") {
            const dbNomor = docStatus === "Disetujui" ? officialNo : `DRAFT-SBB-${Date.now().toString().slice(-6)}`;
            const payloadDb = {
              id: rawUuid,
              nomor_surat: dbNomor,
              nama_pembawa: pembawa || session.full_name || "Pembawa Barang",
              tujuan_lokasi: event || subject,
              daftar_barang: items || [],
              status: docStatus === "Disetujui" ? "disetujui" : "diajukan",
              created_at: nowIso
            };
            const identityId = /^[0-9a-f-]{36}$/i.test(session.identity_id || "") ? session.identity_id : null;
            if (identityId) payloadDb.diajukan_oleh = identityId;
            if (docStatus === "Disetujui" && identityId) payloadDb.disetujui_oleh = identityId;
            const { error: insErr } = await supabase.from("ptv_surat_barang").insert(payloadDb);
            if (insErr) {
              throw new Error("Penerbitan dokumen gagal disimpan.");
            }
          } else {
            const dbNomor = docStatus === "Disetujui" ? officialNo : `DRAFT-ST-${Date.now().toString().slice(-6)}`;
            const payloadDb = {
              id: rawUuid,
              nomor_surat: dbNomor,
              perihal: subject,
              tanggal_tugas: effectiveDate,
              kru_terlibat: recipients || [],
              status: docStatus === "Disetujui" ? "disetujui" : "diajukan",
              created_at: nowIso
            };
            const identityId = /^[0-9a-f-]{36}$/i.test(session.identity_id || "") ? session.identity_id : null;
            if (identityId) payloadDb.diajukan_oleh = identityId;
            if (docStatus === "Disetujui" && identityId) payloadDb.disetujui_oleh = identityId;
            const { error: insErr } = await supabase.from("ptv_surat_tugas").insert(payloadDb);
            if (insErr) {
              throw new Error("Penerbitan dokumen gagal disimpan.");
            }
          }
        } catch {
          throw new Error("Penerbitan dokumen gagal disimpan.");
        }
      }
      const finalDocument = {
        id: finalDocId,
        no: officialNo,
        subject: subject.trim(),
        type: docType.includes("Barang") ? "Izin Membawa Barang" : "Surat Tugas",
        date: effectiveDate,
        start_date: start_date || effectiveDate,
        end_date: end_date || effectiveDate,
        owner: session.full_name || "Pemohon",
        pembawa: pembawa || (docType.includes("Barang") ? session.full_name : void 0),
        penanggung_jawab: penanggung_jawab || (docStatus === "Disetujui" ? approverName : void 0),
        diajukan_oleh: session.username || session.full_name,
        recipients: recipients || (pembawa ? [pembawa] : [session.full_name]),
        items: items || [],
        unit_ids: unit_ids || [],
        event: event || void 0,
        event_id: event_id || void 0,
        status: docStatus,
        created_at: nowIso,
        approved_at: approvedAt,
        review_note: notes || void 0,
        status_history: statusHistory
      };
      res.statusCode = 201;
      res.end(
        JSON.stringify({
          success: true,
          message: docStatus === "Disetujui" ? `Dokumen ${docType} berhasil diterbitkan dan disetujui resmi dengan nomor ${officialNo}.` : `Pengajuan ${docType} berhasil dibuat dan menunggu persetujuan pejabat berwenang.`,
          document: finalDocument,
          auto_approved: docStatus === "Disetujui"
        })
      );
      return;
    }
    if (mode === "vacant_check") {
      const typeParam = (urlObj.searchParams.get("type") || "SI").toUpperCase();
      const dateParam = urlObj.searchParams.get("date") || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      let vacantResult = calculateNextNomorSurat(allDocs, typeParam, dateParam);
      if (supabase) {
        const { data, error } = await supabase.rpc("ptv_letter_preview", { p_type: typeParam, p_date: dateParam });
        if (error || !data?.nomor_surat) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: "Nomor resmi server belum tersedia." }));
          return;
        }
        vacantResult = data;
      }
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          mode: "vacant_check",
          data: {
            type: typeParam,
            date: dateParam,
            year: vacantResult.year,
            roman_month: vacantResult.roman_month,
            highest_sequence: vacantResult.sequence - 1,
            next_sequence: vacantResult.sequence,
            nomor_surat: vacantResult.nomor_surat,
            is_vacant: true,
            is_official: true
          }
        })
      );
      return;
    }
    let outputDocs = allDocs;
    if (mode === "my") {
      outputDocs = filterUserDocuments(allDocs, {
        name: session.full_name,
        username: session.username,
        ptv_id: session.ptv_id,
        account_id: session.account_id,
        identity_id: session.identity_id,
        isExecOrAdmin
      });
    }
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        mode,
        count: outputDocs.length,
        total_live_documents: allDocs.length,
        stats: {
          total: outputDocs.length,
          izin: outputDocs.filter((d) => d.type.includes("Izin")).length,
          tugas: outputDocs.filter((d) => d.type === "Surat Tugas").length,
          barang: outputDocs.filter((d) => d.type.includes("Barang")).length,
          disetujui: outputDocs.filter((d) => d.status === "Disetujui").length,
          menunggu: outputDocs.filter((d) => d.status === "Menunggu").length,
          revisi: outputDocs.filter((d) => d.status === "Revisi").length,
          ditolak: outputDocs.filter((d) => d.status === "Ditolak").length
        },
        documents: outputDocs
      })
    );
  } catch (err) {
    console.error("[API Dokumen] Operasi gagal.");
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: `Terjadi kesalahan internal server saat memproses data dokumen: ${err.message}`,
        code: "internal_server_error"
      })
    );
  }
}

// api/_routes/finance.ts
init_cookies();
init_crypto();
import { createClient as createClient8 } from "@supabase/supabase-js";

// api/_routes/financeAccess.ts
init_portalLifecycle();
async function resolveFinanceAccess(db, session) {
  if (sessionNeedsRegistry(session) && !await portalSessionValid(db, session)) throw new Error("forbidden");
  const account = await db.from("user_account").select("identity_id,status_akun,tokens_valid_after,lockout_until").eq("id", session.account_id).single();
  if (account.error || !account.data || account.data.status_akun !== "active" || !Number.isFinite(session.iat) || session.iat <= 0 || session.iat * 1e3 > Date.now() || !account.data.identity_id || account.data.lockout_until && (!Number.isFinite(Date.parse(account.data.lockout_until)) || Date.parse(account.data.lockout_until) > Date.now()) || account.data.tokens_valid_after && (!Number.isFinite(Date.parse(account.data.tokens_valid_after)) || session.iat * 1e3 < Date.parse(account.data.tokens_valid_after))) throw new Error("forbidden");
  const identityId = account.data.identity_id;
  const [members, profiles, overrides, identityRec] = await Promise.all([
    db.from("organization_membership").select("status_organisasi").eq("identity_id", identityId).eq("organization_id", "ptv_studio").eq("is_current", true),
    db.from("account_profiles").select("profile_id").eq("account_id", session.account_id),
    db.from("account_capability_overrides").select("capability_key,override_type").eq("account_id", session.account_id),
    db.from("canonical_identity").select("ptv_id").eq("id", identityId).single()
  ]);
  if (members.error || profiles.error || overrides.error || members.data?.length !== 1 || members.data[0].status_organisasi !== "active") throw new Error("forbidden");
  const ids = (profiles.data || []).map((p) => p.profile_id);
  if (identityRec.error || !identityRec.data) throw new Error("forbidden");
  if (ids.includes("pembina") || ids.includes("pengarah")) throw new Error("forbidden");
  if (identityRec.data?.ptv_id) {
    const crewRes = await db.from("legacy_archive_kru").select("jabatan").eq("ptv_id", identityRec.data.ptv_id).maybeSingle();
    if (crewRes.error) throw new Error("forbidden");
    const position = (crewRes.data?.jabatan || "").toLowerCase().trim();
    if (position.startsWith("pembina") || position.startsWith("pengarah")) {
      throw new Error("forbidden");
    }
  }
  const grants = ids.length ? await db.from("profile_capabilities").select("capability_key").in("profile_id", ids) : { data: [], error: null };
  if (grants.error) throw new Error("forbidden");
  const allow = new Set((grants.data || []).map((c) => c.capability_key));
  const deny = new Set((overrides.data || []).filter((c) => c.override_type === "deny").map((c) => c.capability_key));
  for (const row of overrides.data || []) if (row.override_type === "allow") allow.add(row.capability_key);
  const can = (cap) => allow.has(cap) && !deny.has(cap);
  if (!can("hub.access")) throw new Error("forbidden");
  const canManage = can("finance.manage");
  const global = canManage || can("finance.view") || can("finance.operator");
  const own = !deny.has("finance.view_own") && (ids.includes("crew") || ids.includes("eksekutif") || ids.includes("root_executive") || can("finance.view_own"));
  if (!global && !own) throw new Error("forbidden");
  return { identityId, canManage, global };
}

// src/products/hub/keuangan/financeCanonical.ts
import { z as z2 } from "zod";
var uuid = z2.string().uuid();
var minor = z2.string().regex(/^[1-9][0-9]{0,17}$/);
var pocketFormSchema = z2.object({
  name: z2.string().trim().min(1, "Nama Kantong wajib diisi.").max(80),
  kind: z2.enum(["cash", "bank", "ewallet"]),
  provider: z2.string().trim().max(80),
  accountNumber: z2.string().trim().max(64),
  accountHolder: z2.string().trim().max(120)
}).strict().superRefine((pocket, ctx) => {
  if (pocket.kind !== "cash") {
    for (const key of ["provider", "accountNumber", "accountHolder"]) {
      if (!pocket[key]) ctx.addIssue({ code: "custom", path: [key], message: "Informasi rekening wajib diisi." });
    }
  } else if (pocket.provider || pocket.accountNumber || pocket.accountHolder) {
    ctx.addIssue({ code: "custom", path: ["kind"], message: "Kantong tunai tidak memiliki rekening." });
  }
});
var allocation = z2.object({ pocketId: uuid, amountMinor: minor }).strict();
var multiPocketCommandSchema = z2.object({
  version: z2.literal(2),
  idempotencyKey: uuid,
  operation: z2.enum(["income", "expense", "transfer"]),
  occurredOn: z2.string().date(),
  description: z2.string().trim().min(1).max(1e3),
  currency: z2.literal("IDR"),
  amountMinor: minor,
  categoryId: uuid.optional(),
  incoming: z2.array(allocation).max(20),
  outgoing: z2.array(allocation).max(20)
}).strict().superRefine((value, ctx) => {
  if (![value.amountMinor, ...value.incoming.map((line) => line.amountMinor), ...value.outgoing.map((line) => line.amountMinor)].every((amount) => /^[1-9][0-9]{0,17}$/.test(amount))) return;
  const sum = (lines) => lines.reduce((n, line) => n + BigInt(line.amountMinor), 0n);
  const total = BigInt(value.amountMinor);
  const issue = (message) => ctx.addIssue({ code: "custom", message });
  const ids = [...value.incoming, ...value.outgoing].map((line) => line.pocketId);
  if (new Set(ids).size !== ids.length) issue("Kantong tidak boleh berulang atau menjadi asal sekaligus tujuan.");
  if (value.operation === "income" && (sum(value.incoming) !== total || value.outgoing.length || !value.categoryId)) issue("Alokasi pemasukan harus sama dengan total dan memiliki kategori.");
  if (value.operation === "expense" && (sum(value.outgoing) !== total || value.incoming.length || !value.categoryId)) issue("Alokasi pengeluaran harus sama dengan total dan memiliki kategori.");
  if (value.operation === "transfer" && (sum(value.incoming) !== total || sum(value.outgoing) !== total || value.categoryId)) issue("Total asal dan tujuan transfer harus sama, tanpa kategori pemasukan/pengeluaran.");
});

// api/_routes/finance.ts
init_financeLocalHarness();

// api/_routes/financeMaintenance.ts
init_financeLocalHarness();
import fs from "fs";
var financeMaintenanceResponse = {
  code: "FINANCE_MAINTENANCE",
  error: "Keuangan sedang dalam pemeliharaan. Penyimpanan sementara dihentikan. Coba lagi nanti."
};
function financeMaintenanceActive() {
  let flag = process.env.PTV_FINANCE_MAINTENANCE;
  try {
    if (!process.env.VITEST && fs.existsSync(".env.staging.local")) {
      const content = fs.readFileSync(".env.staging.local", "utf8");
      const match = content.match(/PTV_FINANCE_MAINTENANCE\s*=\s*(false|true)/i);
      if (match) flag = match[1].toLowerCase();
    }
  } catch {
  }
  if (!flag || flag === "false") return false;
  if (process.env.VERCEL_ENV === "production" || process.env.VITE_APP_ENV === "production") return false;
  const staging = process.env.VITE_APP_ENV === "staging" || process.env.VERCEL_ENV === "preview";
  const harness = process.env.PTV_FINANCE_LOCAL_E2E === "true" && process.env.NODE_ENV === "test";
  if (!staging && !harness) return false;
  try {
    financeBackendUrl();
    return true;
  } catch {
    return false;
  }
}

// src/products/hub/keuangan/financeOperationalReader.ts
var KAS_KRU_TARIFF_CONFIG_ROW_ID = "finance_kas_kru_tariff_config";
async function readAllRows(query) {
  const rows = [];
  for (let start = 0; ; start += 500) {
    const page = await query.range(start, start + 499);
    if (page.error) throw page.error;
    if (!page.data) throw new Error("read_failed");
    rows.push(...page.data);
    if (page.data.length < 500) return rows;
  }
}
var STAGING_SEMESTER_HISTORICAL_FEES = {
  // Semester Ganjil 2026/2027 (dari ptv_kas_periode Dasbor PTV)
  "2941ab08-a7f9-4f35-9539-93131fbe5685": {
    "2026-09": "2000000",
    // Rp 20.000
    "2026-10": "2000000",
    // Rp 20.000
    "2026-11": "5000000"
    // Rp 50.000
  },
  // Semester Genap 2025/2026 (dari ptv_kas_periode Dasbor PTV)
  "7061bf68-5d8b-4e9c-a61d-485a790d0a7e": {
    "2026-06": "2000000",
    // Rp 20.000
    "2026-07": "2500000",
    // Rp 25.000
    "2026-08": "2500000"
    // Rp 25.000
  }
};
var CANONICAL_KAS_TX_IDENTITY_UUID_MAP = {
  "6537834f-84dd-4c12-b5ac-ac75f71b138b": "a5198b2d-e6c2-4c93-945a-3a8f25698d6c",
  // PTV-030 Muhammad Isa (2026-08)
  "b480e722-19ba-43a8-826a-294a97d53e50": "29dc4b45-9465-4d90-9cb3-051438f067b7",
  // PTV-031 Nasshar Rasikh Arsyadiano (2026-08)
  "8d3b0abd-d572-4f09-a041-01f6a21353b1": "22d7d714-f163-46d5-b691-46455eb8a28a",
  // PTV-024 Fathur Rahmanhadi Saputra (2026-09)
  "de2f987c-1f5c-46eb-b0e8-b11e80029d1f": "23f8a9cf-cb4e-4543-8207-7aef92692ead",
  // PTV-003 Muhammad Farras Zaidan Mubarok (2026-09 Rp20rb)
  "4ce4203c-5f70-480d-95b0-35f82be96bf0": "0200ce68-10bb-45a3-8422-49ec5ce376ef",
  // PTV-020 Aqil Afzal Al Farisi (2026-07 reversed)
  "7eed7ec6-ea6a-4120-9b14-51044170190b": "15cf3fd3-ef0a-4eb4-afb8-360747514e7b",
  // PTV-016 Muhammad Izzur Fauzil Adhim (2026-09 reversed)
  "2d6dd948-0b23-4449-a3ca-f4f8013d4e67": "29dc4b45-9465-4d90-9cb3-051438f067b7",
  // PTV-031 Nasshar Rasikh Arsyadiano (2026-07)
  "21e929a6-63cc-410a-a069-45ae2356bafe": "23f8a9cf-cb4e-4543-8207-7aef92692ead",
  // PTV-003 Muhammad Farras Zaidan Mubarok (2026-09 Rp25rb lama)
  "6f008e5e-3459-4fd8-8fb7-523851e9f1db": "29dc4b45-9465-4d90-9cb3-051438f067b7",
  // PTV-031 Nasshar Rasikh Arsyadiano (2026-09)
  "f6296cf8-4a44-49ee-8704-c0a674e0d031": "a5198b2d-e6c2-4c93-945a-3a8f25698d6c",
  // PTV-030 Muhammad Isa (2026-09)
  "2a3c2006-5385-499e-ace1-8434cf1f6185": "22d7d714-f163-46d5-b691-46455eb8a28a",
  // PTV-024 Fathur Rahmanhadi Saputra (2026-07)
  "d9223341-e615-4761-9fc9-59743d13ca71": "0b2907c1-a20c-44a6-83e7-f1c5c2b6b2f0",
  // PTV-027 Malik Gundhaya Wiriarsa (2026-07)
  "18afb321-4b1d-4155-bc44-f1cb01b2d762": "13db53b8-517a-44d5-b6db-b1eb204cf442",
  // PTV-026 Iyyaka Fahabil Farhan (2026-08)
  "17ab54a7-637f-4ae6-95ea-e80f42dc1796": "13db53b8-517a-44d5-b6db-b1eb204cf442",
  // PTV-026 Iyyaka Fahabil Farhan (2026-07)
  "01ab3de0-384a-4915-897d-686ebae00dd4": "15cf3fd3-ef0a-4eb4-afb8-360747514e7b",
  // PTV-016 Muhammad Izzur Fauzil Adhim (2026-07)
  "1ef3e9ee-3fc2-4f81-a63e-5fbe9c2491ba": "15cf3fd3-ef0a-4eb4-afb8-360747514e7b",
  // PTV-016 Muhammad Izzur Fauzil Adhim (2026-08)
  "307a3d97-ffb7-4004-9225-9d9ab11aa2cd": "73ee2fcd-f736-4258-b4cf-9e1745546c4c",
  // PTV-028 Muhammad Daghfal Faizullah (2026-09)
  "dd9ddb46-78ec-486d-b0d7-3af56b38bfd5": "22d7d714-f163-46d5-b691-46455eb8a28a",
  // PTV-024 Fathur Rahmanhadi Saputra (2026-10)
  "ae1b218c-d6b5-4ecc-aead-98a4202573ba": "23f8a9cf-cb4e-4543-8207-7aef92692ead",
  // PTV-003 Muhammad Farras Zaidan Mubarok (2026-08)
  "5addea41-63f9-4d98-8ab7-2d0bbdb28f7c": "0b2907c1-a20c-44a6-83e7-f1c5c2b6b2f0",
  // PTV-027 Malik Gundhaya Wiriarsa (2026-09 Rp20rb)
  "f133f8ef-1804-4ee2-980b-6f1918861948": "a5198b2d-e6c2-4c93-945a-3a8f25698d6c",
  // PTV-030 Muhammad Isa (2026-07)
  "32acc12a-1121-4969-b4a4-43578fc132d1": "02cade6b-16df-426a-b7b7-a59c60581187",
  // PTV-002 Rafa Putra Rouf (2026-07)
  "dd58f7d8-ece1-4d3a-99a3-14b1cc3f3014": "0b2907c1-a20c-44a6-83e7-f1c5c2b6b2f0",
  // PTV-027 Malik Gundhaya Wiriarsa (2026-08)
  "d15eee01-0299-47fa-b5cb-0a6bcb25fcf0": "23f8a9cf-cb4e-4543-8207-7aef92692ead",
  // PTV-003 Muhammad Farras Zaidan Mubarok (2026-07)
  "729a42f4-7dfb-458d-88ab-a77db47bd9ac": "0b2907c1-a20c-44a6-83e7-f1c5c2b6b2f0",
  // PTV-027 Malik Gundhaya Wiriarsa (2026-09 Rp25rb lama)
  "c00113cd-0d69-41cd-8636-b67a54297145": "22d7d714-f163-46d5-b691-46455eb8a28a",
  // PTV-024 Fathur Rahmanhadi Saputra (2026-08)
  "2ed7625a-7634-42ac-bb65-e4ec0cdb9cc3": "02cade6b-16df-426a-b7b7-a59c60581187",
  // PTV-002 Rafa Putra Rouf (2026-09)
  "f90de314-82c0-40e6-a30a-e671c3814841": "02cade6b-16df-426a-b7b7-a59c60581187",
  // PTV-002 Rafa Putra Rouf (2026-08)
  "065778e2-6422-4378-a6f3-7f1ee6536be8": "73ee2fcd-f736-4258-b4cf-9e1745546c4c",
  // PTV-028 Muhammad Daghfal Faizullah (2026-07)
  "080be20b-4fa2-456e-aa06-b5d9a22a8f8b": "73ee2fcd-f736-4258-b4cf-9e1745546c4c",
  // PTV-028 Muhammad Daghfal Faizullah (2026-08)
  "a595abcc-d761-40e5-abf3-e0670a848f24": "aadcb16d-c6d6-45a7-bb1a-036b3b1dcfc8",
  // PTV-032 Rex Ruizhi Gajendra (2026-10)
  "955a4e65-7a48-404d-86da-a6bf0dccd3ba": "aadcb16d-c6d6-45a7-bb1a-036b3b1dcfc8",
  // PTV-032 Rex Ruizhi Gajendra (2026-08)
  "c1518f9f-6c4f-43ba-8a51-600b2243695d": "aadcb16d-c6d6-45a7-bb1a-036b3b1dcfc8",
  // PTV-032 Rex Ruizhi Gajendra (2026-07)
  "3fc1a854-8a3f-4db1-a3d0-152353191903": "aadcb16d-c6d6-45a7-bb1a-036b3b1dcfc8",
  // PTV-032 Rex Ruizhi Gajendra (2026-09)
  "d4b26581-0273-4782-987f-15c48618d0db": "29dc4b45-9465-4d90-9cb3-051438f067b7",
  // PTV-031 Nasshar Rasikh Arsyadiano (2026-10 reversed)
  "76412403-6a0d-45f8-97ba-35617a4fd997": "13db53b8-517a-44d5-b6db-b1eb204cf442",
  // PTV-026 Iyyaka Fahabil Farhan (2026-09 reversed)
  "e99e1015-f5b5-444b-86c6-929b0e9c5ce0": "0b2907c1-a20c-44a6-83e7-f1c5c2b6b2f0",
  // PTV-027 Malik Gundhaya Wiriarsa (2026-10)
  "cfb29351-b4d4-47f9-b3eb-41b37d0d61d2": "15cf3fd3-ef0a-4eb4-afb8-360747514e7b",
  // PTV-016 Muhammad Izzur Fauzil Adhim (2026-10)
  "e5e32537-a432-476a-9203-324de4b1f527": "0f97447d-bc24-48e0-948d-e36b1f53049d",
  // PTV-023 Farsya Naufal Rahmandika (2026-08)
  "1b4cc2ac-563a-4669-8bbf-55164fd1c6d1": "15cf3fd3-ef0a-4eb4-afb8-360747514e7b",
  // PTV-016 Muhammad Izzur Fauzil Adhim (2026-09)
  "9fc18040-2d23-42be-b02c-8c59f0da1b6d": "0f97447d-bc24-48e0-948d-e36b1f53049d",
  // PTV-023 Farsya Naufal Rahmandika (2026-07)
  "4a79468f-6894-480a-8a10-9768fd4b1346": "ad4fe8e0-e1af-4563-b3aa-2c5cb7cad21c",
  // PTV-006 Arham Putra Nur Baasith (2026-07 reversed)
  "6545ac5f-9f40-4622-ac78-864a49313c1f": "ad4fe8e0-e1af-4563-b3aa-2c5cb7cad21c",
  // PTV-006 Arham Putra Nur Baasith (2026-07)
  "f470938a-3fdb-4b37-ba12-1cac6c26eb42": "ad4fe8e0-e1af-4563-b3aa-2c5cb7cad21c",
  // PTV-006 Arham Putra Nur Baasith (2026-08)
  "c3f93d1a-dbf3-4d45-93e9-7eacdf4eccee": "23265396-401c-409a-a0d1-09dbc95507ca",
  // PTV-033 Taqiu Rabbani Fadillah (2026-09)
  "c2544e87-0b8a-409d-87da-fe8f62454605": "23265396-401c-409a-a0d1-09dbc95507ca",
  // PTV-033 Taqiu Rabbani Fadillah (2026-10)
  "22f45d76-f4e6-4439-ba7e-0f63927f2291": "23265396-401c-409a-a0d1-09dbc95507ca",
  // PTV-033 Taqiu Rabbani Fadillah (2026-07)
  "efb7f62f-a97e-4ade-823e-fc6bfa6af03c": "0fef4539-8fe1-424e-b215-74d917c14be3"
  // PTV-018 Niki Santri (2026-07 reversed)
};
var DIVISION_DISPLAY_MAP = {
  editor: "Editor",
  layouter: "Layouter",
  technical: "Technical",
  engagements: "Engagement"
};
var EXCLUDED_TEST_PTV_IDS = /* @__PURE__ */ new Set([
  "PTV-STG-ADM",
  "PTV-STG-KRU",
  "PTV-TEST-171",
  "PTV-017"
  // Kru Testing Integrasi (testkru_1790141364)
]);
async function fetchCanonicalCrewRosterWithClient(supabase, ptvId) {
  let identQuery = supabase.from("canonical_identity").select("id, ptv_id, full_name, metadata").order("ptv_id");
  if (ptvId) {
    identQuery = identQuery.eq("ptv_id", ptvId);
  }
  const [identRows, memRows] = await Promise.all([
    readAllRows(identQuery),
    readAllRows(
      supabase.from("organization_membership").select("identity_id, division_id, position_title, cohort, status_organisasi, period_start, is_current").eq("organization_id", "ptv_studio").order("id")
    )
  ]);
  const membershipByIdentityId = /* @__PURE__ */ new Map();
  for (const m of memRows) {
    if (!membershipByIdentityId.has(m.identity_id) || m.is_current) {
      membershipByIdentityId.set(m.identity_id, m);
    }
  }
  const roster = [];
  for (const ident of identRows) {
    const code = String(ident.ptv_id || "").trim();
    if (!code || EXCLUDED_TEST_PTV_IDS.has(code)) continue;
    if (ident.metadata?.target === "hub_test") continue;
    const mem = membershipByIdentityId.get(ident.id);
    if (!mem) continue;
    const divId = String(mem.division_id || "").toLowerCase().trim();
    const posTitle = String(mem.position_title || "Kru").trim();
    const cohortNum = Number(mem.cohort ?? 0);
    const isOrgActive = mem.status_organisasi === "active";
    let category = "Kru";
    if (!divId) {
      const lowerPos = posTitle.toLowerCase();
      if (lowerPos.includes("pembina")) {
        category = "Pembina";
      } else if (lowerPos.includes("pengarah") || lowerPos.includes("pengasuh")) {
        category = "Pengarah";
      } else {
        continue;
      }
    } else if (cohortNum <= 0) {
      continue;
    }
    roster.push({
      id: ident.id,
      // UUID canonical_identity.id
      ptv_id: code,
      full_name: String(ident.full_name || "").trim(),
      username: code.toLowerCase(),
      role: "kru",
      category,
      division: DIVISION_DISPLAY_MAP[divId] || (category !== "Kru" ? category : "Technical"),
      position: posTitle,
      angkatan: cohortNum > 0 ? cohortNum : "-",
      join_date: mem.period_start ? String(mem.period_start).slice(0, 10) : void 0,
      status_kru: isOrgActive ? "Aktif" : "Nonaktif",
      status_akun: isOrgActive ? "Aktif" : "Nonaktif",
      status_organisasi: mem.status_organisasi
    });
  }
  return roster;
}
async function fetchKasKruTariffConfigWithClient(supabase) {
  try {
    const { data, error } = await supabase.from("ptv_portal_settings").select("draft_payload, updated_at").eq("id", KAS_KRU_TARIFF_CONFIG_ROW_ID).maybeSingle();
    if (error || !data || !data.draft_payload || typeof data.draft_payload !== "object") {
      return { monthlyFeesBySemester: {}, feeHistory: [] };
    }
    const payload = data.draft_payload;
    const monthlyFeesBySemester = payload.monthlyFeesBySemester && typeof payload.monthlyFeesBySemester === "object" ? payload.monthlyFeesBySemester : {};
    const feeHistory = Array.isArray(payload.feeHistory) ? payload.feeHistory : [];
    return {
      monthlyFeesBySemester,
      feeHistory,
      updatedAt: data.updated_at
    };
  } catch {
    return { monthlyFeesBySemester: {}, feeHistory: [] };
  }
}
async function fetchSemestersCloudWithClient(supabase) {
  const [data, tariffConfig] = await Promise.all([
    readAllRows(
      supabase.from("ptv_finance_semesters").select("*").order("start_date", { ascending: false }).order("id")
    ),
    fetchKasKruTariffConfigWithClient(supabase)
  ]);
  return (data || []).map((row) => {
    const rawMonthlyFees = row.monthly_fees && typeof row.monthly_fees === "object" ? row.monthly_fees : {};
    const fallbackFees = STAGING_SEMESTER_HISTORICAL_FEES[row.id] || {};
    const persistedFees = tariffConfig.monthlyFeesBySemester[row.id] || {};
    const mergedMonthlyFees = {
      ...fallbackFees,
      ...rawMonthlyFees,
      ...persistedFees
    };
    return {
      id: row.id,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      monthlyFeeMinor: String(row.monthly_fee_minor),
      monthlyFees: mergedMonthlyFees,
      isActive: Boolean(row.is_active),
      isArchived: Boolean(row.is_archived),
      createdAt: row.created_at
    };
  });
}
async function fetchKasRecordsCloudWithClient(supabase, semesterId, ptvId) {
  let query = supabase.from("ptv_finance_kas_records").select("*");
  if (semesterId) {
    query = query.eq("semester_id", semesterId);
  }
  if (ptvId) query = query.eq("ptv_id", ptvId);
  const data = await readAllRows(query.order("period", { ascending: true }).order("id"));
  const explicitRecords = (data || []).map((row) => ({
    id: row.id,
    semesterId: row.semester_id,
    identityId: row.identity_id || null,
    ptvId: row.ptv_id,
    crewName: row.crew_name,
    period: row.period,
    amountMinor: String(row.amount_minor),
    paidAmountMinor: String(row.paid_amount_minor),
    status: row.status,
    paymentDate: row.payment_date,
    method: row.method,
    pocketId: row.pocket_id,
    transactionId: row.transaction_id,
    notes: row.notes,
    auditReference: row.audit_reference,
    reversalReason: row.reversal_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
  try {
    const [txRes, identRes, semRes] = await Promise.all([
      supabase.from("ptv_finance_transactions").select("*").or("description.ilike.%iuran%,description.ilike.%kas kru%,category_id.eq.e6852c70-5f57-436b-84e1-fc85752ad4dc").order("occurred_on", { ascending: true }).order("created_at", { ascending: true }),
      supabase.from("canonical_identity").select("id, ptv_id, full_name, metadata"),
      supabase.from("ptv_finance_semesters").select("*")
    ]);
    if (!txRes.error && txRes.data && !identRes.error && identRes.data) {
      const crewById = /* @__PURE__ */ new Map();
      const crewByPtvId = /* @__PURE__ */ new Map();
      const crewByName = /* @__PURE__ */ new Map();
      identRes.data.forEach((c) => {
        if (c.id) crewById.set(c.id, c);
        if (c.ptv_id) crewByPtvId.set(c.ptv_id.toUpperCase().trim(), c);
        if (c.full_name) crewByName.set(c.full_name.toLowerCase().trim(), c);
      });
      for (const rec of explicitRecords) {
        if (!rec.identityId && rec.ptvId) {
          const matched = crewByPtvId.get(rec.ptvId.toUpperCase().trim());
          if (matched) {
            rec.identityId = matched.id;
            rec.crewName = matched.full_name;
          } else {
            rec.identityUnlinked = true;
          }
        }
      }
      const monthsMap = {
        januari: "01",
        februari: "02",
        maret: "03",
        april: "04",
        mei: "05",
        juni: "06",
        juli: "07",
        agustus: "08",
        september: "09",
        oktober: "10",
        november: "11",
        desember: "12"
      };
      const existingTxIds = new Set(explicitRecords.map((r) => r.transactionId).filter(Boolean));
      for (const tx of txRes.data) {
        if (existingTxIds.has(tx.id)) continue;
        const desc = tx.description || "";
        if (desc.trim().startsWith("[TEST]")) continue;
        const isReversed = tx.status === "reversed";
        const parts = desc.split("\u2014").map((p) => p.trim());
        const monthRegex = /(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})/i;
        const periodIdx = parts.findIndex((p) => monthRegex.test(p));
        if (periodIdx >= 1) {
          const crewNamePart = parts[periodIdx - 1];
          const periodPart = parts[periodIdx];
          const mappedUuid = CANONICAL_KAS_TX_IDENTITY_UUID_MAP[tx.id];
          let crew = mappedUuid ? crewById.get(mappedUuid) : void 0;
          if (!crew) {
            const ptvMatch = desc.match(/\b(PTV-\d{3})\b/i);
            if (ptvMatch) {
              crew = crewByPtvId.get(ptvMatch[1].toUpperCase());
            }
          }
          if (!crew) {
            crew = crewByName.get(crewNamePart.toLowerCase().trim());
          }
          const isUnlinked = !crew;
          const targetIdentityId = crew ? crew.id : null;
          const targetPtvId = crew ? crew.ptv_id : "UNLINKED";
          if (ptvId && targetPtvId !== ptvId) continue;
          const mMatch = periodPart.toLowerCase().match(monthRegex);
          const monthStr = mMatch ? monthsMap[mMatch[1].toLowerCase()] : void 0;
          const yearStr = mMatch ? mMatch[2] : void 0;
          const period = monthStr && yearStr ? `${yearStr}-${monthStr}` : "UNKNOWN";
          if (period === "UNKNOWN") continue;
          let semId = semRes.data?.[0]?.id || "sem-2026-ganjil";
          if (semRes.data && Array.isArray(semRes.data)) {
            for (const sem of semRes.data) {
              const startYM = (sem.start_date || "").slice(0, 7);
              const endYM = (sem.end_date || "").slice(0, 7);
              if (period >= startYM && period <= endYM) {
                semId = sem.id;
                break;
              }
            }
          }
          if (semesterId && semId !== semesterId) continue;
          const lowerDesc = desc.toLowerCase();
          const detectedMethod = lowerDesc.includes("qris") ? "qris" : lowerDesc.includes("tunai") ? "cash" : "transfer";
          const existingActiveIdx = explicitRecords.findIndex(
            (r) => targetIdentityId && r.identityId === targetIdentityId && r.period === period || !targetIdentityId && r.ptvId === targetPtvId && r.crewName === crewNamePart && r.period === period
          );
          const candidate = {
            id: `tx-kaskru-${tx.id}`,
            semesterId: semId,
            identityId: targetIdentityId,
            identityUnlinked: isUnlinked,
            ptvId: targetPtvId,
            crewName: crew ? crew.full_name : `${crewNamePart} (Identitas Belum Terhubung)`,
            period,
            amountMinor: String(tx.amount_minor),
            paidAmountMinor: isReversed ? "0" : String(tx.amount_minor),
            status: isReversed ? "belum" : "lunas",
            paymentDate: tx.occurred_on ? String(tx.occurred_on).slice(0, 10) : null,
            method: detectedMethod,
            pocketId: tx.incoming?.[0]?.pocketId || "60e8d033-2794-4219-a960-c56bedca0111",
            transactionId: tx.id,
            notes: tx.description,
            auditReference: tx.audit_reference || void 0,
            reversalReason: isReversed ? tx.reversal_reason || "Dibatalkan" : void 0,
            createdAt: tx.created_at || (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: tx.created_at || (/* @__PURE__ */ new Date()).toISOString()
          };
          if (existingActiveIdx >= 0) {
            const prevRec = explicitRecords[existingActiveIdx];
            const officialPeriodFee = STAGING_SEMESTER_HISTORICAL_FEES[semId]?.[period];
            if (prevRec.status === "belum" && !isReversed) {
              explicitRecords[existingActiveIdx] = candidate;
            } else if (!isReversed && officialPeriodFee && candidate.amountMinor === officialPeriodFee && prevRec.amountMinor !== officialPeriodFee) {
              explicitRecords[existingActiveIdx] = candidate;
            }
          } else {
            explicitRecords.push(candidate);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[financeOperationalReader] Rekonsiliasi transaksi kas kru dilewati:", err);
  }
  return explicitRecords;
}
async function fetchLoansCloudWithClient(supabase, ptvId) {
  let query = supabase.from("ptv_finance_loans").select("*");
  if (ptvId) query = query.eq("borrower_type", "kru").eq("borrower_id", ptvId);
  const loans = await readAllRows(query.order("created_at", { ascending: false }).order("id"));
  const ids = loans.map((row) => row.id);
  const payments = [];
  for (let start = 0; start < ids.length; start += 100) {
    const page = await readAllRows(supabase.from("ptv_finance_loan_payments").select("*").in("loan_id", ids.slice(start, start + 100)).order("paid_on", { ascending: true }).order("id"));
    payments.push(...page);
  }
  const paymentsByLoanId = /* @__PURE__ */ new Map();
  for (const p of payments) {
    const list = paymentsByLoanId.get(p.loan_id) || [];
    list.push({
      id: p.id,
      loanId: p.loan_id,
      paidOn: p.paid_on,
      amountMinor: String(p.amount_minor),
      toPocketId: p.to_pocket_id,
      receiptTxId: p.receipt_tx_id,
      method: p.method,
      notes: p.notes,
      createdAt: p.created_at || (/* @__PURE__ */ new Date()).toISOString(),
      status: p.status,
      reversalReason: p.reversal_reason
    });
    paymentsByLoanId.set(p.loan_id, list);
  }
  return loans.map((row) => ({
    id: row.id,
    borrowerType: row.borrower_type,
    borrowerId: row.borrower_id,
    borrowerName: row.borrower_name,
    borrowerContact: row.borrower_contact,
    borrowerInstitution: row.borrower_institution,
    principalMinor: String(row.principal_minor),
    interestType: row.interest_type || "none",
    interestRatePercent: Number(row.interest_rate_percent || 0),
    interestMinor: String(row.interest_minor || "0"),
    totalDueMinor: String(row.total_due_minor),
    totalPaidMinor: String(row.total_paid_minor),
    remainingMinor: String(row.remaining_minor),
    disbursedOn: row.disbursed_on,
    dueDate: row.due_date,
    disbursedFromPocketId: row.disbursed_from_pocket_id,
    disbursementTxId: row.disbursement_tx_id,
    status: row.status,
    purpose: row.purpose,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payments: paymentsByLoanId.get(row.id) || []
  }));
}

// api/_routes/financeOperationalRead.ts
async function readFinanceOperational(db, access, session) {
  const scope = await db.rpc("rpc_finance_visible_transactions_server", {
    p_account_id: session.account_id,
    p_session_iat: session.iat,
    p_transaction_ids: []
  });
  if (scope.error || scope.data?.identityId !== access.identityId || typeof scope.data.canManage !== "boolean" || typeof scope.data.global !== "boolean") throw new Error("forbidden");
  const manager = scope.data.canManage;
  if (!manager) {
    const [profiles, overrides] = await Promise.all([
      db.from("account_profiles").select("profile_id").eq("account_id", session.account_id),
      db.from("account_capability_overrides").select("capability_key,override_type").eq("account_id", session.account_id)
    ]);
    if (profiles.error || overrides.error || !profiles.data || !overrides.data) throw new Error("read_failed");
    const ids = profiles.data.map((p) => p.profile_id);
    const grants = ids.length ? await db.from("profile_capabilities").select("capability_key").in("profile_id", ids) : { data: [], error: null };
    if (grants.error || !grants.data) throw new Error("read_failed");
    const ownOverrides = overrides.data.filter((o) => o.capability_key === "finance.view_own");
    if (ownOverrides.some((o) => o.override_type === "deny") || !(ids.some((id) => ["crew", "eksekutif", "root_executive"].includes(id)) || ownOverrides.some((o) => o.override_type === "allow") || grants.data.some((g) => g.capability_key === "finance.view_own"))) throw new Error("forbidden");
  }
  const identity = await db.from("canonical_identity").select("ptv_id").eq("id", access.identityId).single();
  if (identity.error || !identity.data?.ptv_id) throw new Error("read_failed");
  const ownerPtvId = identity.data.ptv_id;
  const [semesters, records, loans, crewRoster, tariffConfig, settings] = await Promise.all([
    fetchSemestersCloudWithClient(db),
    fetchKasRecordsCloudWithClient(db, void 0, manager ? void 0 : ownerPtvId),
    fetchLoansCloudWithClient(db, manager ? void 0 : ownerPtvId),
    fetchCanonicalCrewRosterWithClient(db, manager ? void 0 : ownerPtvId),
    fetchKasKruTariffConfigWithClient(db),
    db.from("ptv_finance_settings").select("fee_due_day").eq("id", "studio_default").maybeSingle()
  ]);
  if (settings.error) throw new Error("read_failed");
  return {
    source: "staging",
    scope: manager ? "global" : "own",
    ownerPtvId,
    writesEnabled: false,
    semesters,
    records,
    loans,
    feeDueDay: settings.data?.fee_due_day || 10,
    crewRoster,
    feeHistory: tariffConfig.feeHistory
  };
}

// api/_routes/finance.ts
var FinanceScopeUnavailableError = class extends Error {
  code = "FINANCE_SCOPE_NOT_INSTALLED";
  constructor() {
    super("read_failed");
  }
};
async function readFinance(db, access, session) {
  if (!session) throw new Error("read_failed");
  const initialScope = await db.rpc("rpc_finance_visible_transactions_server", {
    p_account_id: session.account_id,
    p_session_iat: session.iat,
    p_transaction_ids: []
  });
  if (initialScope.error?.code === "PGRST202" || initialScope.error?.code === "42883") {
    throw new FinanceScopeUnavailableError();
  }
  const verified = initialScope.data;
  if (initialScope.error || !verified || verified.identityId !== access.identityId || typeof verified.canManage !== "boolean" || typeof verified.global !== "boolean") throw new Error("read_failed");
  access = { identityId: verified.identityId, canManage: verified.canManage, global: verified.global };
  let kasQuery = db.from("ptv_kas_kru").select("id,bulan_tahun,nominal,status_bayar").order("bulan_tahun", { ascending: false }).limit(100);
  if (!access.global) kasQuery = kasQuery.eq("identity_id", access.identityId);
  const kas = await kasQuery;
  if (kas.error && kas.error.code !== "PGRST205" && kas.error.code !== "42P01") throw new Error("read_failed");
  const kasRows = kas.data || [];
  const snapshot = {
    source: "staging",
    canManage: access.canManage,
    scope: access.global ? "global" : "own",
    counts: null,
    entries: [],
    kas: kasRows.map((row) => ({ id: row.id, period: row.bulan_tahun, amount: Number(row.nominal), status: row.status_bayar })),
    limited: kasRows.length === 100,
    writesEnabled: access.canManage && !financeMaintenanceActive(),
    canonical: { state: "awaiting_schema", pockets: null, transactions: null }
  };
  if (!access.global) return snapshot;
  let incomeCount = 0;
  let expenseCount = 0;
  let ledgerCount = 0;
  let legacyEntries = [];
  try {
    const [income, expense, ledger] = await Promise.all([
      db.from("ptv_pemasukan").select("id,sumber,nominal,tanggal,keterangan", { count: "exact" }).order("tanggal", { ascending: false }).limit(100),
      db.from("ptv_pengeluaran").select("id,keperluan,nominal,tanggal,keterangan", { count: "exact" }).order("tanggal", { ascending: false }).limit(100),
      db.from("ptv_keuangan").select("id", { count: "exact", head: true })
    ]);
    if (!income.error && !expense.error && !ledger.error) {
      incomeCount = income.count ?? 0;
      expenseCount = expense.count ?? 0;
      ledgerCount = ledger.count ?? 0;
      legacyEntries = [
        ...(income.data || []).map((row) => ({ id: row.id, label: row.sumber, description: row.keterangan, amount: Number(row.nominal), date: row.tanggal, kind: "pemasukan" })),
        ...(expense.data || []).map((row) => ({ id: row.id, label: row.keperluan, description: row.keterangan, amount: Number(row.nominal), date: row.tanggal, kind: "pengeluaran" }))
      ];
    }
  } catch {
  }
  snapshot.counts = { income: incomeCount, expense: expenseCount, ledger: ledgerCount };
  snapshot.entries = legacyEntries.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  snapshot.limited ||= incomeCount > 100 || expenseCount > 100;
  try {
    const [pocketsRes, txRes, catRes] = await Promise.all([
      db.from("ptv_finance_pockets").select("*").order("name", { ascending: true }),
      db.from("ptv_finance_transactions").select("*", { count: "exact" }).order("occurred_on", { ascending: false }).order("id", { ascending: false }).limit(100),
      db.from("ptv_finance_categories").select("*").order("name", { ascending: true })
    ]);
    if (pocketsRes.error || txRes.error || catRes.error || !pocketsRes.data || !txRes.data || !catRes.data) throw new Error("read_failed");
    snapshot.limited ||= txRes.count == null ? txRes.data.length >= 100 : txRes.count > 100;
    {
      if (!session) throw new Error("read_failed");
      const scope = await db.rpc("rpc_finance_visible_transactions_server", {
        p_account_id: session.account_id,
        p_session_iat: session.iat,
        p_transaction_ids: txRes.data.map((t) => t.id)
      });
      if (scope.error || !scope.data || scope.data.identityId !== access.identityId || typeof scope.data.canManage !== "boolean" || typeof scope.data.global !== "boolean" || !Array.isArray(scope.data.visibleTransactionIds) || !scope.data.global) throw new Error("read_failed");
      const visible = new Set(scope.data.visibleTransactionIds);
      snapshot.canManage = scope.data.canManage;
      snapshot.writesEnabled = scope.data.canManage && !financeMaintenanceActive();
      snapshot.limited ||= txRes.data.some((t) => !visible.has(t.id));
      txRes.data = txRes.data.filter((t) => visible.has(t.id));
      if (!scope.data.canManage) snapshot.entries = [];
    }
    if (pocketsRes.data && txRes.data) {
      const txIds = txRes.data.map((t) => t.id);
      let allocations = [];
      let sourceRefs = [];
      if (txIds.length > 0) {
        const [allocRes, srcRes] = await Promise.all([
          db.from("ptv_finance_allocations").select("*").in("transaction_id", txIds),
          db.from("ptv_finance_source_references").select("*").in("transaction_id", txIds)
        ]);
        if (allocRes.error || srcRes.error || !allocRes.data || !srcRes.data) throw new Error("read_failed");
        allocations = allocRes.data;
        sourceRefs = srcRes.data;
      }
      const allocMap = /* @__PURE__ */ new Map();
      for (const a of allocations) {
        if (!allocMap.has(a.transaction_id)) allocMap.set(a.transaction_id, []);
        allocMap.get(a.transaction_id).push({
          pocketId: a.pocket_id,
          amountMinor: String(a.amount_minor),
          direction: a.direction
        });
      }
      const srcMap = /* @__PURE__ */ new Map();
      for (const s of sourceRefs) {
        if (!srcMap.has(s.transaction_id)) srcMap.set(s.transaction_id, []);
        srcMap.get(s.transaction_id).push({
          id: s.source_id,
          kind: s.source_table.replace(/^ptv_/, "")
        });
      }
      const categories = (catRes.data || []).map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        isActive: c.is_active
      }));
      snapshot.canonical = {
        state: "available",
        pockets: pocketsRes.data.map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          provider: p.provider || "",
          accountNumber: p.account_number || "",
          accountHolder: p.account_holder || "",
          archived: p.archived,
          version: p.version,
          balanceMinor: String(p.balance_minor),
          qris: p.qris_asset_path ? {
            assetPath: p.qris_asset_path,
            merchantName: p.qris_merchant_name,
            nmid: p.qris_nmid,
            verifiedAt: p.qris_verified_at
          } : null
        })),
        transactions: txRes.data.map((t) => ({
          id: t.id,
          occurredOn: t.occurred_on,
          description: t.description,
          kind: t.kind,
          amountMinor: String(t.amount_minor),
          status: t.status,
          auditReference: t.audit_reference,
          allocations: allocMap.get(t.id) || [],
          sourceReferences: srcMap.get(t.id) || [],
          categoryId: t.category_id || void 0,
          proofUrl: t.proof_url || void 0,
          notes: t.notes || void 0,
          recordedBy: t.recorded_by || void 0
        })),
        categories
      };
    }
  } catch {
    throw new Error("read_failed");
  }
  return snapshot;
}
async function parseBody(req) {
  let body = req.body;
  if (body !== void 0 && body !== null) {
    if (Buffer.byteLength(JSON.stringify(body)) > 65536) throw new Error("Ukuran payload melebihi batas 64KB.");
    return body;
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += Buffer.byteLength(chunk);
    if (length > 65536) throw new Error("Ukuran payload melebihi batas 64KB.");
    chunks.push(Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Format JSON tidak valid.");
  }
}
async function handler6(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const send = (status, body) => {
    res.statusCode = status;
    res.end(JSON.stringify(body));
  };
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method || "") && financeMaintenanceActive()) {
    res.setHeader("Retry-After", "60");
    send(503, financeMaintenanceResponse);
    return;
  }
  if (req.method === "GET" && new URL(req.url || "/", "http://localhost").searchParams.get("maintenance") === "1") {
    if (financeMaintenanceActive()) {
      res.setHeader("Retry-After", "60");
      send(503, financeMaintenanceResponse);
    } else {
      send(200, { maintenance: false });
    }
    return;
  }
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    send(405, { error: "Metode HTTP tidak didukung. Gunakan GET atau POST." });
    return;
  }
  const secret = process.env.AUTH_SECRET;
  const token = parseCookies(req.headers.cookie)["ptv_hub_session"];
  const session = secret && token ? verifySessionToken(token, secret) : null;
  if (!session) {
    send(401, { error: "Sesi tidak valid. Silakan masuk kembali." });
    return;
  }
  let url;
  try {
    url = financeBackendUrl();
  } catch {
    send(503, { error: "Finance hanya tersedia pada backend Staging yang terverifikasi." });
    return;
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    send(503, { error: "Finance hanya tersedia pada backend Staging yang terverifikasi." });
    return;
  }
  const db = createClient8(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(1e4) }) }
  });
  try {
    const access = await resolveFinanceAccess(db, session);
    if (req.method === "GET") {
      if (new URL(req.url || "/", "http://localhost").searchParams.get("operational") === "1") {
        send(200, await readFinanceOperational(db, access, session));
        return;
      }
      send(200, await readFinance(db, access, session));
      return;
    }
    if (!access.canManage) {
      send(403, { error: "Akses ditolak: Operasi penulisan keuangan memerlukan hak Bendahara, Eksekutif, atau Root." });
      return;
    }
    if (req.headers["sec-fetch-site"] === "cross-site" || req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw new Error("forbidden");
    if (req.headers["content-type"] && !req.headers["content-type"].toLowerCase().startsWith("application/json")) {
      send(415, { error: "Permintaan keuangan harus berupa JSON." });
      return;
    }
    const payload = await parseBody(req);
    const action = payload?.action;
    if (action === "post_kas_payment_atomic") {
      const command = multiPocketCommandSchema.parse(payload.command);
      const kasPayload = payload?.kasPayload;
      if (!kasPayload || typeof kasPayload !== "object") {
        send(400, { error: "Payload kas kru tidak valid." });
        return;
      }
      const { data, error } = await db.rpc("rpc_record_kas_kru_payment_atomic", {
        p_account_id: session.account_id,
        p_session_iat: session.iat,
        p_command: command,
        p_kas_payload: kasPayload
      });
      if (error) {
        const isFreeze = error.code === "55000" || error.message?.includes("freeze");
        const status = isFreeze ? 503 : error.code === "42501" ? 403 : error.code === "23505" ? 409 : 400;
        send(status, {
          code: isFreeze ? "FINANCE_FREEZE_ACTIVE" : error.code,
          error: isFreeze ? "Pencatatan kas ditahan oleh perlindungan freeze Finance151. Data staging tetap utuh." : `Pencatatan kas kru gagal: ${error.message}`
        });
        return;
      }
      send(200, data);
      return;
    }
    if (action === "disburse_loan_atomic") {
      const command = multiPocketCommandSchema.parse(payload.command);
      const loanPayload = payload?.loanPayload;
      if (!loanPayload || typeof loanPayload !== "object") {
        send(400, { error: "Payload piutang tidak valid." });
        return;
      }
      const { data, error } = await db.rpc("rpc_disburse_loan_atomic", {
        p_account_id: session.account_id,
        p_session_iat: session.iat,
        p_command: command,
        p_loan_payload: loanPayload
      });
      if (error) {
        const isFreeze = error.code === "55000" || error.message?.includes("freeze");
        const status = isFreeze ? 503 : error.code === "42501" ? 403 : error.code === "23505" ? 409 : 400;
        send(status, {
          code: isFreeze ? "FINANCE_FREEZE_ACTIVE" : error.code,
          error: isFreeze ? "Pencairan piutang ditahan oleh perlindungan freeze Finance151. Data staging tetap utuh." : `Pencairan piutang gagal: ${error.message}`
        });
        return;
      }
      send(200, data);
      return;
    }
    if (action === "post_loan_payment_atomic") {
      const command = multiPocketCommandSchema.parse(payload.command);
      const paymentPayload = payload?.paymentPayload;
      if (!paymentPayload || typeof paymentPayload !== "object") {
        send(400, { error: "Payload cicilan piutang tidak valid." });
        return;
      }
      const { data, error } = await db.rpc("rpc_record_loan_payment_atomic", {
        p_account_id: session.account_id,
        p_session_iat: session.iat,
        p_command: command,
        p_payment_payload: paymentPayload
      });
      if (error) {
        const isFreeze = error.code === "55000" || error.message?.includes("freeze");
        const status = isFreeze ? 503 : error.code === "42501" ? 403 : error.code === "23505" ? 409 : 400;
        send(status, {
          code: isFreeze ? "FINANCE_FREEZE_ACTIVE" : error.code,
          error: isFreeze ? "Pembayaran cicilan ditahan oleh perlindungan freeze Finance151. Data staging tetap utuh." : `Pembayaran cicilan gagal: ${error.message}`
        });
        return;
      }
      send(200, data);
      return;
    }
    if (action === "reverse_operational_atomic") {
      const { recordType, recordId, reason } = payload;
      if (!recordType || !["kas_kru", "loan_disbursement", "loan_payment"].includes(recordType)) {
        send(400, { error: "Tipe record operasional wajib valid (kas_kru, loan_disbursement, loan_payment)." });
        return;
      }
      if (!recordId || typeof recordId !== "string") {
        send(400, { error: "ID record wajib diisi." });
        return;
      }
      if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
        send(400, { error: "Alasan pembatalan/reversal wajib diisi minimal 3 karakter." });
        return;
      }
      const { data, error } = await db.rpc("rpc_reverse_operational_record_atomic", {
        p_account_id: session.account_id,
        p_session_iat: session.iat,
        p_record_type: recordType,
        p_record_id: recordId,
        p_reason: reason.trim()
      });
      if (error) {
        const isFreeze = error.code === "55000" || error.message?.includes("freeze");
        const status = isFreeze ? 503 : error.code === "42501" ? 403 : error.code === "22023" ? 400 : 500;
        send(status, {
          code: isFreeze ? "FINANCE_FREEZE_ACTIVE" : error.code,
          error: isFreeze ? "Pembatalan ditahan oleh perlindungan freeze Finance151. Data staging tetap utuh." : `Pembatalan operasional gagal: ${error.message}`
        });
        return;
      }
      send(200, data);
      return;
    }
    if (action === "update_finance_settings") {
      const s = payload?.settings;
      if (!s || typeof s !== "object") {
        send(400, { error: "Payload pengaturan keuangan tidak valid." });
        return;
      }
      const updateData = {
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (s.feeDueDay !== void 0) updateData.fee_due_day = Number(s.feeDueDay);
      if (s.defaultMonthlyFeeMinor !== void 0) updateData.default_monthly_fee_minor = Number(s.defaultMonthlyFeeMinor);
      if (s.defaultLoanDueDays !== void 0) updateData.default_loan_due_days = Number(s.defaultLoanDueDays);
      if (s.treasurerName !== void 0) updateData.treasurer_name = String(s.treasurerName).trim();
      if (s.treasurerPtvId !== void 0) updateData.treasurer_ptv_id = String(s.treasurerPtvId).trim();
      if (s.treasurerPhone !== void 0) updateData.treasurer_phone = String(s.treasurerPhone).trim();
      if (s.officialBankPocketId !== void 0) updateData.official_bank_pocket_id = s.officialBankPocketId || null;
      if (s.officialQrisPocketId !== void 0) updateData.official_qris_pocket_id = s.officialQrisPocketId || null;
      const { data, error } = await db.from("ptv_finance_settings").update(updateData).eq("id", "studio_default").select().single();
      if (error) {
        const isFreeze = error.code === "55000" || error.message?.includes("freeze");
        const status = isFreeze ? 503 : 400;
        send(status, {
          code: isFreeze ? "FINANCE_FREEZE_ACTIVE" : error.code,
          error: isFreeze ? "Pembaruan pengaturan ditahan oleh perlindungan freeze Finance151. Data staging tetap utuh." : `Gagal memperbarui pengaturan: ${error.message}`
        });
        return;
      }
      send(200, { success: true, settings: data });
      return;
    }
    if (action === "create_semester") {
      const sem = payload?.semester;
      if (!sem || !sem.name || !sem.startDate || !sem.endDate) {
        send(400, { error: "Nama, tanggal mulai, dan tanggal selesai semester wajib diisi." });
        return;
      }
      const { data, error } = await db.from("ptv_finance_semesters").insert({
        id: sem.id || void 0,
        name: String(sem.name).trim(),
        start_date: sem.startDate,
        end_date: sem.endDate,
        monthly_fee_minor: Number(sem.monthlyFeeMinor || 25e5),
        monthly_fees: sem.monthlyFees || {},
        is_active: Boolean(sem.isActive),
        is_archived: false
      }).select().single();
      if (error) {
        const isFreeze = error.code === "55000" || error.message?.includes("freeze");
        const status = isFreeze ? 503 : 400;
        send(status, {
          code: isFreeze ? "FINANCE_FREEZE_ACTIVE" : error.code,
          error: isFreeze ? "Penambahan semester ditahan oleh perlindungan freeze Finance151. Data staging tetap utuh." : `Gagal membuat semester: ${error.message}`
        });
        return;
      }
      send(200, { success: true, semester: data });
      return;
    }
    if (action === "update_semester_period_fee") {
      const semesterId = typeof payload.semesterId === "string" ? payload.semesterId.trim() : "";
      const period = typeof payload.period === "string" ? payload.period.trim() : "";
      const newFeeMinor = String(payload.newFeeMinor ?? "").trim();
      if (!semesterId || !/^\d{4}-\d{2}$/.test(period)) {
        send(400, { error: "ID semester dan periode bulan (YYYY-MM) wajib valid." });
        return;
      }
      if (!/^\d+$/.test(newFeeMinor) || BigInt(newFeeMinor) <= 0n) {
        send(400, { error: "Nominal iuran bulanan harus berupa angka positif lebih dari 0." });
        return;
      }
      const [semesters, currentConfig, identityRes] = await Promise.all([
        fetchSemestersCloudWithClient(db),
        fetchKasKruTariffConfigWithClient(db),
        db.from("canonical_identity").select("id, ptv_id, full_name").eq("id", access.identityId).single()
      ]);
      const targetSemester = semesters.find((s) => s.id === semesterId);
      if (!targetSemester) {
        send(404, { error: "Semester tidak ditemukan di database staging." });
        return;
      }
      const previousFeeMinor = targetSemester.monthlyFees?.[period] || targetSemester.monthlyFeeMinor || "2500000";
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const changerPtvId = identityRes.data?.ptv_id || "PTV-001";
      const changerName = identityRes.data?.full_name || "Pengelola Keuangan";
      const historyEntry = {
        id: `fee-hist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        semesterId: targetSemester.id,
        semesterName: targetSemester.name,
        period,
        previousFeeMinor: String(previousFeeMinor),
        newFeeMinor: String(newFeeMinor),
        changedAt: nowIso,
        changedByIdentityId: access.identityId,
        changedByPtvId: changerPtvId,
        changedByName: changerName
      };
      const nextSemesterFees = {
        ...targetSemester.monthlyFees || {},
        ...currentConfig.monthlyFeesBySemester[semesterId] || {},
        [period]: String(newFeeMinor)
      };
      const nextConfig = {
        monthlyFeesBySemester: {
          ...currentConfig.monthlyFeesBySemester,
          [semesterId]: nextSemesterFees
        },
        feeHistory: [historyEntry, ...currentConfig.feeHistory || []].slice(0, 200),
        updatedAt: nowIso
      };
      await db.from("ptv_finance_semesters").update({
        monthly_fees: nextSemesterFees,
        updated_at: nowIso
      }).eq("id", semesterId);
      const { error: persistErr } = await db.from("ptv_portal_settings").upsert({
        id: KAS_KRU_TARIFF_CONFIG_ROW_ID,
        draft_payload: nextConfig,
        updated_at: nowIso,
        updated_by: `${changerName} (${changerPtvId})`
      });
      if (persistErr) {
        send(500, { error: `Gagal menyimpan perubahan tarif ke Supabase staging: ${persistErr.message}` });
        return;
      }
      const updatedSemesters = semesters.map(
        (s) => s.id === semesterId ? { ...s, monthlyFees: nextSemesterFees } : s
      );
      send(200, {
        success: true,
        semester: updatedSemesters.find((s) => s.id === semesterId),
        semesters: updatedSemesters,
        historyEntry,
        feeHistory: nextConfig.feeHistory
      });
      return;
    }
    if (action === "update_semester") {
      const { semesterId, updates } = payload;
      if (!semesterId || !updates) {
        send(400, { error: "ID semester dan data update wajib diisi." });
        return;
      }
      const updateData = {
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (updates.name !== void 0) updateData.name = String(updates.name).trim();
      if (updates.startDate !== void 0) updateData.start_date = updates.startDate;
      if (updates.endDate !== void 0) updateData.end_date = updates.endDate;
      if (updates.monthlyFeeMinor !== void 0) updateData.monthly_fee_minor = Number(updates.monthlyFeeMinor);
      if (updates.monthlyFees !== void 0) updateData.monthly_fees = updates.monthlyFees;
      if (updates.isActive !== void 0) updateData.is_active = Boolean(updates.isActive);
      if (updates.isArchived !== void 0) updateData.is_archived = Boolean(updates.isArchived);
      const { data, error } = await db.from("ptv_finance_semesters").update(updateData).eq("id", semesterId).select().single();
      if (error) {
        const isFreeze = error.code === "55000" || error.message?.includes("freeze");
        const status = isFreeze ? 503 : 400;
        send(status, {
          code: isFreeze ? "FINANCE_FREEZE_ACTIVE" : error.code,
          error: isFreeze ? "Pembaruan semester ditahan oleh perlindungan freeze Finance151. Data staging tetap utuh." : `Gagal memperbarui semester: ${error.message}`
        });
        return;
      }
      send(200, { success: true, semester: data });
      return;
    }
    if (action === "post_transaction") {
      const command = multiPocketCommandSchema.parse(payload.command);
      const { data, error } = await db.rpc("rpc_post_finance_transaction_server", {
        p_account_id: session.account_id,
        p_session_iat: session.iat,
        p_command: command
      });
      if (error) {
        const status = error.code === "42501" ? 403 : error.code === "23505" ? 409 : 400;
        send(status, { error: `Transaksi gagal: ${error.message}`, code: error.code });
        return;
      }
      send(200, data);
      return;
    }
    if (action === "get_proof_signed_url") {
      const filePath = typeof payload.filePath === "string" ? payload.filePath.trim() : "";
      if (!filePath) {
        send(400, { error: "Path berkas bukti wajib diisi." });
        return;
      }
      const cleanPath = filePath.replace(/^finance-proofs\//, "");
      const { data: signData, error: signError } = await db.storage.from("finance-proofs").createSignedUrl(cleanPath, 3600);
      if (signError || !signData?.signedUrl) {
        send(400, { error: `Gagal membuat URL akses privat: ${signError?.message || "Bucket tidak ditemukan"}` });
        return;
      }
      send(200, { success: true, signedUrl: signData.signedUrl });
      return;
    }
    if (["create_pocket", "update_pocket", "archive_pocket", "create_category", "update_category", "archive_category", "restore_category", "update_transaction"].includes(action)) {
      if (action === "update_transaction") {
        const updates = payload?.updates || {};
        if (updates.amount !== void 0 || updates.amountMinor !== void 0 || updates.allocations !== void 0) {
          send(400, { error: "Nominal, alokasi, dan jenis transaksi tidak dapat diedit langsung. Lakukan pembatalan (VOID) dan catat transaksi baru." });
          return;
        }
      }
      const { data, error } = await db.rpc("rpc_finance_admin_mutation_server", {
        p_account_id: session.account_id,
        p_session_iat: session.iat,
        p_action: action,
        p_payload: payload
      });
      if (error) {
        const status = error.code === "42501" ? 403 : error.code === "40001" ? 409 : ["PGRST202", "42883"].includes(error.code) ? 503 : 400;
        send(status, { error: status === 503 ? "Kontrak penyimpanan Keuangan belum diaktifkan di staging." : error.message, code: error.code });
        return;
      }
      if (!data || data.success !== true) throw new Error("Backend belum mengonfirmasi penyimpanan keuangan.");
      send(200, data);
      return;
    }
    if (action === "void_transaction") {
      const { txId, reason } = payload;
      if (!txId || typeof txId !== "string") throw new Error("ID transaksi wajib diisi.");
      if (!reason || typeof reason !== "string" || !reason.trim()) throw new Error("Alasan pembatalan transaksi wajib diisi.");
      const { data: rpcData, error: rpcErr } = await db.rpc("rpc_void_finance_transaction_atomic", {
        p_account_id: session.account_id,
        p_session_iat: session.iat,
        p_tx_id: txId,
        p_reason: reason.trim()
      });
      if (rpcErr) {
        const status = rpcErr.code === "42501" ? 403 : rpcErr.code === "22023" ? 400 : 500;
        send(status, { error: `Pembatalan transaksi gagal: ${rpcErr.message}`, code: rpcErr.code });
        return;
      }
      send(200, rpcData);
      return;
    }
    send(400, { error: `Aksi ${action || "tidak dikenal"} tidak didukung.` });
  } catch (error) {
    if (error instanceof FinanceScopeUnavailableError) {
      send(503, { code: error.code, error: "Konfigurasi akses Keuangan di staging belum lengkap. Hubungi pengelola untuk menyelesaikan aktivasi database." });
    } else if (error?.message === "forbidden") {
      send(403, { error: "Akses keuangan ditolak. Periksa izin akun Anda." });
    } else if (error?.message === "read_failed") {
      send(503, { error: "Data keuangan belum dapat dibaca lengkap. Coba lagi; jangan memakai laporan parsial." });
    } else {
      send(400, { error: error?.message || "Gagal memproses permintaan keuangan." });
    }
  }
}

// api/_routes/inventaris.ts
init_cookies();
init_crypto();
init_portalLifecycle();
init_liveAccess();
import { createHmac as createHmac3, randomUUID as randomUUID4 } from "node:crypto";
import { z as z3 } from "zod";
var uuid2 = z3.string().uuid();
var text = z3.string().trim().max(5e3);
var optionalText = text.nullish();
var createMaster = z3.object({
  id: uuid2,
  request_id: uuid2.optional(),
  kode: z3.string().trim().regex(/^INV-\d+$/i),
  nama_alat: z3.string().trim().min(1).max(255),
  kategori: z3.string().trim().min(1).max(64),
  spesifikasi: optionalText,
  foto_url: optionalText,
  harga_beli: z3.number().finite().nonnegative().nullable().optional(),
  sumber_perolehan: optionalText
}).strict();
var createUnit = z3.object({
  kode_unit: text,
  nomor_seri: optionalText,
  kondisi: z3.enum(["bagus", "rusak", "perlu_servis"]),
  status_peminjaman: z3.enum(["tersedia", "maintenance"]),
  lokasi_penyimpanan: optionalText
}).strict();
var editMaster = z3.object({
  id: uuid2,
  nama_alat: z3.string().trim().min(1).max(255),
  kategori: text,
  spesifikasi: optionalText,
  sumber_perolehan: optionalText,
  lokasi_penyimpanan: optionalText,
  foto_url: optionalText,
  expected_updated_at: z3.string().datetime({ offset: true }).optional()
}).strict();
var editUnit = z3.object({
  id: uuid2,
  kode_unit: text,
  nama_unit: optionalText,
  nomor_seri: optionalText,
  kondisi: z3.enum(["bagus", "rusak", "perlu_servis"]),
  lokasi_penyimpanan: optionalText
}).strict();
var valuation = z3.object({
  nilai_perolehan: z3.number().finite().nonnegative().optional(),
  nilai_tercatat: z3.number().finite().nonnegative().optional(),
  tanggal_perolehan: z3.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  catatan: text.optional(),
  id: text.optional(),
  inventaris_id: uuid2.optional(),
  nilai_residu: z3.number().finite().nonnegative().optional(),
  sumber_perolehan: text.optional(),
  vendor: text.optional(),
  nomor_invoice: text.optional(),
  status: z3.enum(["Aktif", "Belum Dicatat", "Dihapuskan"]).optional(),
  dokumen_url: z3.string().url().optional(),
  created_by_name: text.optional(),
  created_at: text.optional(),
  updated_at: text.optional()
}).strict();
var readCapabilities = {
  list: "inventory.view",
  detail: "inventory.view",
  valuations: "inventory.valuation.view",
  "next-code": "inventory.create",
  diagnostics: "inventory.view"
};
var writeCapabilities = {
  create: "inventory.create",
  update: "inventory.edit",
  upload: "inventory.create",
  "unit-status": "inventory.units.manage",
  "valuation-save": "inventory.valuation.manage",
  "valuation-delete": "inventory.valuation.manage"
};
function inventoryRequestId(accountId, requestId, secret) {
  const hex = createHmac3("sha256", secret).update(`inventory:${accountId}:${requestId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function inventoryImageType(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return "image/gif";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (bytes.toString("ascii", 4, 8) === "ftyp") {
    const brand = bytes.toString("ascii", 8, 12);
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) return "image/heic";
    if (["mif1", "msf1"].includes(brand)) return "image/heif";
  }
  return null;
}
var InventoryError = class extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
};
async function readBody(req, limit) {
  if (Number(req.headers["content-length"]) > limit) throw new InventoryError(413, "Ukuran permintaan melebihi batas.");
  if (req.body !== void 0) {
    const data = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body));
    if (data.length > limit) throw new InventoryError(413, "Ukuran permintaan melebihi batas.");
    return data;
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += data.length;
    if (length > limit) throw new InventoryError(413, "Ukuran permintaan melebihi batas.");
    chunks.push(data);
  }
  return Buffer.concat(chunks);
}
async function handler7(req, res) {
  const send = (status, body) => {
    res.statusCode = status;
    res.end(JSON.stringify(body));
  };
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method || "")) return send(405, { error: "Metode tidak diizinkan." });
  const secret = process.env.AUTH_SECRET || "";
  const token = parseCookies(req.headers.cookie).ptv_hub_session;
  const session = token && secret ? verifySessionToken(token, secret) : null;
  if (!session) return send(401, { error: "Sesi Portal diperlukan." });
  try {
    if (req.method === "POST" && (!req.headers.origin || new URL(req.headers.origin).host !== req.headers.host || req.headers["sec-fetch-site"] === "cross-site")) throw new InventoryError(403, "Asal permintaan tidak diizinkan.");
    let db;
    try {
      db = lifecycleClient();
    } catch {
      throw new InventoryError(503, "Inventaris hanya tersedia pada Staging terverifikasi.");
    }
    const live = await resolveLiveAccess(db, session);
    const url = new URL(req.url || "/", "http://localhost");
    let action = url.searchParams.get("action") || "list";
    let payload = {};
    if (req.method === "GET") payload = JSON.parse(url.searchParams.get("payload") || "{}");
    else if (action !== "upload") {
      if (!req.headers["content-type"]?.includes("application/json")) throw new InventoryError(415, "Permintaan harus JSON.");
      const body = z3.object({ action: z3.string(), payload: z3.unknown() }).strict().parse(JSON.parse((await readBody(req, 256 * 1024)).toString("utf8")));
      action = body.action;
      payload = body.payload;
    }
    const registry = req.method === "GET" ? readCapabilities : writeCapabilities;
    if (!Object.hasOwn(registry, action)) throw new InventoryError(400, "Operasi Inventaris tidak dikenal.");
    const permitted = action === "upload" ? live.can("inventory.create") || live.can("inventory.edit") : live.can(registry[action]);
    if (!permitted) throw new InventoryError(403, "Capability operasi Inventaris tidak mencukupi.", "42501");
    const audit = async (phase, entity) => {
      const result = await db.from("auth_audit_log").insert({
        actor_id: live.identity.id,
        event_type: `inventory_${action.replaceAll("-", "_")}_${phase}`,
        metadata: { account_id: live.account.id, ...entity ? { entity_id: entity } : {} }
      });
      if (result.error) throw new InventoryError(503, "Konfirmasi audit belum tersedia. Periksa hasil sebelum mencoba lagi.");
    };
    const check = (result) => {
      const code = result.error && typeof result.error === "object" && "code" in result.error ? String(result.error.code) : void 0;
      if (result.error) throw new InventoryError(
        code === "42501" ? 403 : code === "23505" || code === "40001" ? 409 : 503,
        "Operasi belum dikonfirmasi database. Muat ulang sebelum mencoba lagi.",
        code
      );
      return result.data;
    };
    const visibleValues = live.can("inventory.valuation.view") || live.can("inventory.valuation.manage");
    const columns = `id,kode,nama_alat,kategori,spesifikasi,foto_url,sumber_perolehan,created_at,updated_at,units:ptv_inventaris_unit(id,inventaris_id,kode_unit,nama_unit,nomor_seri,kondisi,status_peminjaman,lokasi_penyimpanan,created_at,updated_at)${visibleValues ? ",harga_beli,nilai:ptv_nilai_inventaris(id,inventaris_id,nilai_perolehan,nilai_buku_saat_ini,tanggal_valuasi,catatan_akuntansi,updated_at,vendor,nomor_invoice,sumber_perolehan,status,nilai_residu,dokumen_url,created_by_name,catatan)" : ""}`;
    if (req.method === "GET") {
      let data2;
      if (action === "detail") {
        const { id } = z3.object({ id: text.min(1) }).strict().parse(payload);
        const field = uuid2.safeParse(id).success ? "id" : "kode";
        data2 = check(await db.from("ptv_inventaris").select(columns).eq(field, id).maybeSingle());
      } else if (action === "next-code") {
        const rows = check(await db.from("ptv_inventaris").select("kode"));
        const used = new Set((rows || []).map((row) => Number(/^INV-(\d+)$/i.exec(row.kode || "")?.[1])));
        let n = 1;
        while (used.has(n)) n++;
        data2 = `INV-${String(n).padStart(3, "0")}`;
      } else if (action === "diagnostics") {
        check(await db.from("ptv_inventaris").select("id").limit(1));
        check(await db.from("ptv_inventaris_unit").select("id").limit(1));
        const bucket = check(await db.storage.getBucket("inventory"));
        data2 = { bucketExists: !!bucket, canCreate: live.can("inventory.create") };
      } else {
        const { search } = z3.object({ search: z3.string().max(200).optional() }).strict().parse(payload);
        let rows = check(await db.from("ptv_inventaris").select(columns).order("created_at", { ascending: false })) || [];
        if (search?.trim()) {
          const q = search.trim().toLowerCase();
          rows = rows.filter((row) => [row.nama_alat, row.kode, row.kategori, row.spesifikasi].some((value) => String(value || "").toLowerCase().includes(q)));
        }
        data2 = rows;
      }
      return send(200, { success: true, data: data2 });
    }
    if (action === "unit-status") throw new InventoryError(409, "Status unit harus diubah melalui transaksi peminjaman/pengembalian atau QC kerusakan atomik.");
    if (action === "upload") {
      const bytes = await readBody(req, 4 * 1024 * 1024);
      const mime = inventoryImageType(bytes);
      if (!mime || req.headers["content-type"]?.split(";")[0] !== mime) throw new InventoryError(415, "Isi berkas tidak sesuai format gambar yang diizinkan.");
      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic", "image/heif": "heif" };
      const path = `catalog/portal/${live.account.id}/${randomUUID4()}.${ext[mime]}`;
      await audit("requested");
      check(await db.storage.from("inventory").upload(path, bytes, { contentType: mime, upsert: false, cacheControl: "3600" }));
      await audit("confirmed", path);
      return send(200, { success: true, data: db.storage.from("inventory").getPublicUrl(path).data.publicUrl });
    }
    if (action === "create" || action === "update") {
      const args = action === "create" ? z3.object({ p_master: createMaster, p_units: z3.array(createUnit).min(1).max(200) }).strict().parse(payload) : z3.object({ p_master: editMaster, p_units: z3.array(editUnit).max(200) }).strict().parse(payload);
      const master = args.p_master;
      const photo = master.foto_url;
      if (photo) {
        const baseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
        const ownPrefix = `${baseUrl}/storage/v1/object/public/inventory/catalog/portal/${live.account.id}/`;
        const ownPath = photo.startsWith(ownPrefix) && /^[\da-f-]+\.(jpg|png|webp|gif|heic|heif)$/.test(photo.slice(ownPrefix.length));
        if (!ownPath) {
          const existing = action === "update" ? check(await db.from("ptv_inventaris").select("foto_url").eq("id", master.id).maybeSingle()) : null;
          if (!existing || existing.foto_url !== photo) throw new InventoryError(403, "Foto harus berasal dari unggahan akun ini atau foto existing alat.");
        }
      }
      if (action === "create") {
        if (args.p_units.some((unit) => "status_peminjaman" in unit && unit.kondisi !== "bagus" && unit.status_peminjaman !== "maintenance")) {
          throw new InventoryError(400, "Unit rusak atau perlu servis harus berstatus maintenance.");
        }
        master.id = inventoryRequestId(live.account.id, master.id, secret);
        if ("request_id" in master) master.request_id = master.id;
      }
      await audit("requested", master.id);
      const data2 = check(await db.rpc(action === "create" ? "rpc_create_inventaris" : "rpc_update_inventaris", args));
      if (!data2 || data2.id !== master.id) throw new InventoryError(503, "Konfirmasi identitas alat tidak cocok.");
      await audit("confirmed", master.id);
      return send(200, { success: true, data: data2 });
    }
    const values = action === "valuation-save" ? z3.object({ assetId: uuid2, data: valuation }).strict().parse(payload) : z3.object({ assetId: uuid2 }).strict().parse(payload);
    const item = check(await db.from("ptv_inventaris").select("id").eq("id", values.assetId).maybeSingle());
    if (!item) throw new InventoryError(404, "Alat tidak ditemukan.");
    await audit("requested", item.id);
    let data;
    if ("data" in values) {
      const value = valuation.parse(values.data);
      if (value.dokumen_url && !value.dokumen_url.startsWith("https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/")) {
        throw new InventoryError(400, "Lampiran valuasi harus berasal dari Storage Staging.");
      }
      data = check(await db.from("ptv_nilai_inventaris").upsert({
        inventaris_id: item.id,
        nilai_perolehan: value.nilai_perolehan ?? 0,
        nilai_buku_saat_ini: value.nilai_tercatat ?? value.nilai_perolehan ?? 0,
        tanggal_valuasi: value.tanggal_perolehan || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        catatan_akuntansi: value.catatan || null,
        ...Object.fromEntries(["vendor", "nomor_invoice", "sumber_perolehan", "status", "nilai_residu", "dokumen_url"].filter((field) => value[field] !== void 0).map((field) => [field, value[field]])),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }, { onConflict: "inventaris_id" }).select("id").single());
      if (!data) throw new InventoryError(503, "Nilai belum dikonfirmasi tersimpan.");
    } else {
      const removed = check(await db.from("ptv_nilai_inventaris").delete().eq("inventaris_id", item.id).select("id"));
      data = (removed || []).length > 0;
    }
    await audit("confirmed", item.id);
    return send(200, { success: true, data });
  } catch (error) {
    if (error instanceof InventoryError) return send(error.status, { error: error.message, code: error.code });
    if (error instanceof LiveAccessUnavailableError) return send(503, { error: "Verifikasi akses sementara tidak tersedia." });
    if (error instanceof Error && error.message === "forbidden") return send(403, { error: "Sesi atau akses telah dicabut." });
    return send(400, { error: "Permintaan Inventaris tidak valid." });
  }
}

// api/_routes/kontak.ts
init_cookies();
init_crypto();
init_identity();
import { createClient as createClient9 } from "@supabase/supabase-js";

// src/shared/utils/uuid.ts
function safeRandomUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
    }
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = bytes[6] & 15 | 64;
      bytes[8] = bytes[8] & 63 | 128;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch {
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}

// src/products/hub/kontak/kontakMapper.ts
var KNOWN_BROKEN_PHOTO_PTV_IDS = /* @__PURE__ */ new Set(["PTV-025", "PTV-046", "PTV-070", "PTV-062"]);
function categorizeExternalContact(row) {
  const orgLow = String(row.instansi || "").trim().toLowerCase();
  const rawJab = String(row.peran || "").trim();
  const rawName = String(row.nama_kontak || "").trim();
  const combined = `${orgLow} ${rawJab} ${rawName}`.toLowerCase();
  let lembaga = "Pondok";
  if (orgLow === "pondok" || orgLow.includes("pesantren") || orgLow.includes("asrama") || orgLow.includes("santri")) {
    lembaga = "Pondok";
  } else if (orgLow === "sekolah" || orgLow.includes("smp") || orgLow.includes("sma") || orgLow.includes("sd")) {
    lembaga = "Sekolah";
  } else if (orgLow === "yayasan" || orgLow.includes("bumi shalawat") || orgLow.includes("spi")) {
    lembaga = "Yayasan";
  } else if (["mitra", "vendor", "partner", "supplier", "rental"].some((w) => orgLow.includes(w) || combined.includes(w))) {
    lembaga = "Mitra";
  } else if (/asrama|madin|pengasuhan|keasramaan|tahfidz|diniyah/.test(combined)) {
    lembaga = "Pondok";
  } else if (/smp|sma|sd|kesiswaan|sarpras sm|kurikulum|guru|tu sm/.test(combined)) {
    lembaga = "Sekolah";
  } else if (/yayasan|spi|direksi|pengurus yayasan/.test(combined)) {
    lembaga = "Yayasan";
  }
  let peran = "Ustadz";
  if (combined.includes("ustadzah") || combined.includes("ustzah") || combined.includes("isma") || combined.includes("bu ")) {
    peran = "Ustadzah";
  } else if (combined.includes("vendor") || combined.includes("supplier")) {
    peran = "Vendor";
  } else if (combined.includes("mitra") || combined.includes("partner")) {
    peran = "Partner";
  } else if (combined.includes("pembina")) {
    peran = "Pembina";
  } else if (combined.includes("narasumber")) {
    peran = "Narasumber";
  } else {
    peran = "Ustadz";
  }
  return { lembaga, peran };
}
function isLegacyPembina(c) {
  if (!c) return false;
  const div = c.div || c.divisi || "";
  const pos = c.pos || c.jabatan || "";
  return div === "Pembina" || /pembina/i.test(div) || /pembina/i.test(pos);
}
function isLegacyPengarah(c) {
  if (!c) return false;
  if (isLegacyPembina(c)) return false;
  const div = c.div || c.divisi || "";
  const pos = c.pos || c.jabatan || "";
  return div === "Pengarah" || /pengarah/i.test(div) || /pengarah/i.test(pos) || /presdir|wadir|pendiri|pengasuh|direktur|penasihat/i.test(pos);
}
function isLegacyPengurus(c) {
  if (!c) return false;
  if (isLegacyPembina(c) || isLegacyPengarah(c)) return false;
  const pos = c.pos || c.jabatan || "";
  return /ketua|wakil|sekretaris|bendahara|koordinator|admin|pimpinan|pengurus/i.test(pos);
}
function isLegacyKru(c) {
  if (!c) return false;
  if (isLegacyPembina(c) || isLegacyPengarah(c) || isLegacyPengurus(c)) return false;
  const pos = c.pos || c.jabatan || "";
  const rawStatus = (c.status || "").toLowerCase().trim();
  const isAktif = rawStatus === "aktif" || !["nonaktif", "non-aktif", "non aktif", "pasif", "alumni", "inactive"].includes(rawStatus) && rawStatus !== "";
  return isAktif || /kru/i.test(pos);
}
function classifyInternalContact(c) {
  if (isLegacyPembina(c)) return "Pembina";
  if (isLegacyPengarah(c)) return "Pengarah";
  if (isLegacyPengurus(c)) return "Pengurus";
  if (isLegacyKru(c)) return "Kru";
  return null;
}

// api/_routes/kontak.ts
var KNOWN_TEST_RECORD_PTV_IDS = /* @__PURE__ */ new Set(["PTV-UJI-2712"]);
async function parseJsonBody4(req) {
  if (req.body !== void 0 && typeof req.body === "object") {
    return req.body;
  }
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Payload terlalu besar (maksimal 2MB)."));
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Format data JSON tidak valid."));
      }
    });
    req.on("error", reject);
  });
}
async function handler8(req, res) {
  res.setHeader("Content-Type", "application/json");
  const method = (req.method || "GET").toUpperCase();
  const bodyPromise = ["POST", "PUT", "PATCH"].includes(method) ? parseJsonBody4(req) : Promise.resolve({});
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    res.statusCode = 405;
    res.end(
      JSON.stringify({
        error: `Metode HTTP ${method} tidak didukung pada modul Kontak.`,
        code: "method_not_allowed"
      })
    );
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  if (!sessionToken) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses direktori kontak.",
        code: "unauthorized"
      })
    );
    return;
  }
  const session = verifySessionToken(sessionToken, authSecret);
  if (!session) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Sesi login Anda tidak valid atau telah kedaluwarsa. Silakan masuk kembali.",
        code: "session_expired"
      })
    );
    return;
  }
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: "Konfigurasi backend Staging Supabase belum lengkap (URL atau Service Role Key hilang).",
        code: "server_configuration_error"
      })
    );
    return;
  }
  if (method !== "GET" && supabaseUrl.includes("jthzuhkblxcaohiuypqq")) {
    res.statusCode = 403;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Database Production (jthzuhkblxcaohiuypqq) berstatus STRICT READ-ONLY. Mutasi kontak dilarang keras.",
        code: "production_write_forbidden"
      })
    );
    return;
  }
  const urlObj = new URL(req.url || "", "http://localhost");
  const type = (urlObj.searchParams.get("type") || "eksternal").toLowerCase();
  if (method !== "GET" && type !== "eksternal") {
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        error: "Modul Kontak Internal bersumber dari data keanggotaan kru dan pengarah; mutasi langsung tidak diizinkan melalui endpoint ini.",
        code: "internal_contacts_read_only"
      })
    );
    return;
  }
  const userCaps = await refreshLiveSession(session);
  if (!userCaps.includes("hub.access")) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Sesi atau izin telah dicabut." }));
    return;
  }
  const isPrivileged = userCaps.includes("contacts.external.manage") || userCaps.includes("crew.create") || Array.isArray(session.capabilities) && session.capabilities.includes("contacts.external.manage") || Array.isArray(session.assigned_profiles) && session.assigned_profiles.includes("root_executive");
  if (method !== "GET" && !isPrivileged) {
    res.statusCode = 403;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Anda tidak memiliki izin untuk mengelola Kontak Eksternal (perlu izin contacts.external.manage atau hak admin/eksekutif).",
        code: "forbidden"
      })
    );
    return;
  }
  const accountActive = await verifyAccountStatusLive(session.account_id, session.iat, session);
  if (!accountActive) {
    res.statusCode = 403;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Akun Anda telah dinonaktifkan dari sistem.",
        code: "account_inactive"
      })
    );
    return;
  }
  if (method === "GET") {
    if (type === "internal") {
    } else {
      const canViewExternal = userCaps.includes("contacts.external.view") || isPrivileged;
      if (!canViewExternal) {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            error: "Akses ditolak: Anda tidak memiliki izin untuk melihat direktori kontak eksternal.",
            code: "forbidden"
          })
        );
        return;
      }
    }
  }
  const supabase = createClient9(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  try {
    if (method === "GET") {
      if (type === "eksternal") {
        const { data: rows, error: qErr } = await supabase.from("ptv_kontak_eksternal").select("*").order("created_at", { ascending: false });
        if (qErr) {
          console.error("[API Kontak] Error fetching ptv_kontak_eksternal:", qErr);
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: `Gagal memuat kontak eksternal dari database Staging: ${qErr.message}`,
              code: "database_query_error"
            })
          );
          return;
        }
        const contacts = (rows || []).map((r) => {
          const cat = categorizeExternalContact(r);
          return {
            id: r.id,
            nama: r.nama_kontak || "Tanpa Nama",
            kategori: cat.peran,
            jabatan: r.peran || "-",
            organisasi: r.instansi || "Lembaga",
            lembaga: cat.lembaga,
            nomor_telepon: r.telepon || void 0,
            whatsapp: r.telepon || void 0,
            email: r.email || void 0,
            catatan: r.catatan || void 0,
            status: "Aktif"
          };
        });
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            mode: "eksternal",
            count: contacts.length,
            contacts
          })
        );
        return;
      }
      if (type === "internal") {
        const { data: crewRows, error: cErr } = await supabase.from("legacy_archive_kru").select("*").order("ptv_id", { ascending: true });
        if (cErr) {
          console.error("[API Kontak] Error fetching legacy_archive_kru for internal contacts:", cErr);
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: `Gagal memuat kontak kru dari database Staging: ${cErr.message}`,
              code: "database_query_error"
            })
          );
          return;
        }
        const seenPtv = /* @__PURE__ */ new Set();
        const seenCanonId = /* @__PURE__ */ new Set();
        const crewContacts = [];
        for (const raw of crewRows || []) {
          if (!raw.ptv_id || seenPtv.has(raw.ptv_id)) continue;
          if (raw.metadata_json?.is_duplicate_archive === true) continue;
          if (raw.canonical_identity_id) {
            if (seenCanonId.has(raw.canonical_identity_id)) continue;
            seenCanonId.add(raw.canonical_identity_id);
          }
          seenPtv.add(raw.ptv_id);
          if (KNOWN_TEST_RECORD_PTV_IDS.has(raw.ptv_id) || raw.status === "test_quarantine" || raw.reconciliation_status === "quarantined" || raw.source_key && raw.source_key.includes("test_quarantine")) {
            continue;
          }
          let fullName = raw.full_name || "Kru PTV";
          let position = raw.jabatan || "Kru Operasional";
          let angkatan = raw.angkatan || void 0;
          let divisi = raw.divisi || void 0;
          let fotoUrl = raw.photo_url || raw.metadata_json && raw.metadata_json.avatar_url || void 0;
          if (raw.ptv_id === "PTV-017" && (fullName.includes("Testing") || fullName.includes("Uji"))) {
            fullName = "Muhammad Hamdan Yuwafi Sulaim";
            position = "Kru";
            angkatan = "12";
            divisi = "Technical";
            fotoUrl = "https://progresiftv.id/wp-content/uploads/unnamed-e1763791452420.webp";
          }
          if (KNOWN_BROKEN_PHOTO_PTV_IDS.has(raw.ptv_id)) {
            fotoUrl = void 0;
          }
          const rawStatus = (raw.status || "aktif").toLowerCase().trim();
          const isAktif = rawStatus === "aktif" || !["nonaktif", "non-aktif", "non aktif", "pasif", "alumni", "inactive"].includes(rawStatus) && rawStatus !== "";
          const adapter = {
            div: divisi || null,
            pos: position || null,
            status: isAktif ? "Aktif" : "Nonaktif",
            role: raw.role || raw.metadata_json && raw.metadata_json.role_legacy || "kru",
            name: fullName,
            ptvId: raw.ptv_id
          };
          const category = classifyInternalContact(adapter);
          if (!category) continue;
          let title_prefix;
          if (/^KH\./i.test(fullName)) title_prefix = "KH.";
          else if (/^Dr\./i.test(fullName)) title_prefix = "Dr.";
          else if (/^Agus/i.test(fullName) || /^Gus/i.test(fullName)) title_prefix = "Gus";
          else if (/^Ust\./i.test(fullName) || /^Ustadz/i.test(fullName)) title_prefix = "Ust.";
          else if (/^Habib/i.test(fullName) || /^Alm\. Habib/i.test(fullName)) title_prefix = "Habib";
          let unit = divisi ? `Divisi ${divisi}` : "Progresif TV Studio";
          if (category === "Pembina") {
            unit = "Dewan Pembina PTV";
          } else if (category === "Pengarah") {
            unit = "Pimpinan & Pengarah Lembaga";
          }
          let phone = raw.metadata_json && (raw.metadata_json.telepon || raw.metadata_json.wa || raw.metadata_json.phone) || raw.telepon || raw.telepon_masked || void 0;
          if (raw.ptv_id === "PTV-017") {
            phone = void 0;
          }
          const email = raw.email || raw.email_masked || void 0;
          crewContacts.push({
            id: `int-${raw.ptv_id}`,
            full_name: fullName,
            title_prefix,
            position,
            unit,
            category,
            phone: phone || void 0,
            email: email || void 0,
            foto_url: fotoUrl,
            notes: angkatan ? `Kru Angkatan ${angkatan} PTV` : category === "Pembina" || category === "Pengarah" ? "Figur Kehormatan / Pengarah PTV" : void 0,
            crew_id: raw.archive_id || raw.ptv_id,
            ptv_id: raw.ptv_id,
            status: isAktif ? "Aktif" : "Nonaktif",
            angkatan,
            divisi
          });
        }
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            mode: "internal",
            count: crewContacts.length,
            contacts: crewContacts
          })
        );
        return;
      }
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          error: `Parameter 'type' tidak valid: ${type}. Gunakan 'eksternal' atau 'internal'.`,
          code: "invalid_parameter"
        })
      );
      return;
    }
    if (method === "POST") {
      const payload = await bodyPromise;
      const nama = typeof payload.nama === "string" ? payload.nama.trim() : typeof payload.nama_kontak === "string" ? payload.nama_kontak.trim() : "";
      if (!nama || nama.length < 2) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: "Validasi gagal: Nama kontak wajib diisi (minimal 2 karakter).",
            code: "invalid_nama_kontak"
          })
        );
        return;
      }
      const instansi = typeof payload.organisasi === "string" && payload.organisasi.trim() ? payload.organisasi.trim() : typeof payload.instansi === "string" && payload.instansi.trim() ? payload.instansi.trim() : payload.lembaga || "Lembaga";
      const peran = typeof payload.jabatan === "string" && payload.jabatan.trim() ? payload.jabatan.trim() : typeof payload.peran === "string" && payload.peran.trim() ? payload.peran.trim() : "Staf / Relasi";
      const telepon = typeof payload.nomor_telepon === "string" && payload.nomor_telepon.trim() ? payload.nomor_telepon.trim() : typeof payload.telepon === "string" && payload.telepon.trim() ? payload.telepon.trim() : payload.whatsapp || null;
      const email = typeof payload.email === "string" && payload.email.trim() ? payload.email.trim() : null;
      const catatan = typeof payload.catatan === "string" && payload.catatan.trim() ? payload.catatan.trim() : null;
      const newId = safeRandomUuid();
      const insertRow = {
        id: newId,
        nama_kontak: nama,
        instansi,
        peran,
        telepon,
        email,
        catatan,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const { data: createdRow, error: insErr } = await supabase.from("ptv_kontak_eksternal").insert([insertRow]).select("*").single();
      if (insErr || !createdRow) {
        console.error("[API Kontak Insert Error]:", insErr);
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal menyimpan kontak eksternal ke Staging: ${insErr?.message || "Database error"}`,
            code: "database_insert_error"
          })
        );
        return;
      }
      const cat = categorizeExternalContact(createdRow);
      const enriched = {
        id: createdRow.id,
        nama: createdRow.nama_kontak,
        kategori: cat.peran,
        jabatan: createdRow.peran || "-",
        organisasi: createdRow.instansi || "Lembaga",
        lembaga: cat.lembaga,
        nomor_telepon: createdRow.telepon || void 0,
        whatsapp: createdRow.telepon || void 0,
        email: createdRow.email || void 0,
        catatan: createdRow.catatan || void 0,
        status: "Aktif"
      };
      res.statusCode = 201;
      res.end(
        JSON.stringify({
          success: true,
          message: `Kontak eksternal "${enriched.nama}" berhasil disimpan secara permanen di database Staging.`,
          contact: enriched
        })
      );
      return;
    }
    if (method === "PATCH" || method === "PUT") {
      const payload = await bodyPromise;
      const targetId = (urlObj.searchParams.get("id") || payload.id || "").trim();
      if (!targetId) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: "Parameter ID kontak wajib disertakan.",
            code: "missing_contact_id"
          })
        );
        return;
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
        res.statusCode = 404;
        res.end(
          JSON.stringify({
            error: `Kontak eksternal dengan ID "${targetId}" tidak ditemukan di database Staging.`,
            code: "contact_not_found"
          })
        );
        return;
      }
      const { data: existing, error: findErr } = await supabase.from("ptv_kontak_eksternal").select("*").eq("id", targetId).maybeSingle();
      if (findErr) {
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal mencari kontak eksternal di Staging: ${findErr.message}`,
            code: "database_query_error"
          })
        );
        return;
      }
      if (!existing) {
        res.statusCode = 404;
        res.end(
          JSON.stringify({
            error: `Kontak eksternal dengan ID "${targetId}" tidak ditemukan di database Staging.`,
            code: "contact_not_found"
          })
        );
        return;
      }
      const updates = {};
      if (typeof payload.nama === "string" && payload.nama.trim().length >= 2) {
        updates.nama_kontak = payload.nama.trim();
      } else if (typeof payload.nama_kontak === "string" && payload.nama_kontak.trim().length >= 2) {
        updates.nama_kontak = payload.nama_kontak.trim();
      }
      if (typeof payload.organisasi === "string") updates.instansi = payload.organisasi.trim();
      else if (typeof payload.instansi === "string") updates.instansi = payload.instansi.trim();
      if (typeof payload.jabatan === "string") updates.peran = payload.jabatan.trim();
      else if (typeof payload.peran === "string") updates.peran = payload.peran.trim();
      if (payload.nomor_telepon !== void 0) updates.telepon = payload.nomor_telepon ? payload.nomor_telepon.trim() : null;
      else if (payload.telepon !== void 0) updates.telepon = payload.telepon ? payload.telepon.trim() : null;
      else if (payload.whatsapp !== void 0) updates.telepon = payload.whatsapp ? payload.whatsapp.trim() : null;
      if (payload.email !== void 0) updates.email = payload.email ? payload.email.trim() : null;
      if (payload.catatan !== void 0) updates.catatan = payload.catatan ? payload.catatan.trim() : null;
      const { data: updatedRow, error: upErr } = await supabase.from("ptv_kontak_eksternal").update(updates).eq("id", targetId).select("*").single();
      if (upErr || !updatedRow) {
        console.error("[API Kontak Update Error]:", upErr);
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal memperbarui kontak eksternal di Staging: ${upErr?.message || "Database error"}`,
            code: "database_update_error"
          })
        );
        return;
      }
      const cat = categorizeExternalContact(updatedRow);
      const enriched = {
        id: updatedRow.id,
        nama: updatedRow.nama_kontak,
        kategori: cat.peran,
        jabatan: updatedRow.peran || "-",
        organisasi: updatedRow.instansi || "Lembaga",
        lembaga: cat.lembaga,
        nomor_telepon: updatedRow.telepon || void 0,
        whatsapp: updatedRow.telepon || void 0,
        email: updatedRow.email || void 0,
        catatan: updatedRow.catatan || void 0,
        status: "Aktif"
      };
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: `Kontak eksternal "${enriched.nama}" berhasil diperbarui di database Staging.`,
          contact: enriched
        })
      );
      return;
    }
    if (method === "DELETE") {
      const urlTargetId = urlObj.searchParams.get("id");
      let targetId = (urlTargetId || "").trim();
      if (!targetId) {
        const payload = await parseJsonBody4(req).catch(() => ({}));
        targetId = (payload.id || "").trim();
      }
      if (!targetId) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: "Parameter ID kontak wajib disertakan untuk penghapusan.",
            code: "missing_contact_id"
          })
        );
        return;
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
        res.statusCode = 404;
        res.end(
          JSON.stringify({
            error: `Kontak eksternal dengan ID "${targetId}" tidak ditemukan di database Staging.`,
            code: "contact_not_found"
          })
        );
        return;
      }
      const { data: existing, error: findErr } = await supabase.from("ptv_kontak_eksternal").select("id, nama_kontak").eq("id", targetId).maybeSingle();
      if (findErr) {
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal memverifikasi kontak eksternal di Staging: ${findErr.message}`,
            code: "database_query_error"
          })
        );
        return;
      }
      if (!existing) {
        res.statusCode = 404;
        res.end(
          JSON.stringify({
            error: `Kontak eksternal dengan ID "${targetId}" tidak ditemukan di database Staging.`,
            code: "contact_not_found"
          })
        );
        return;
      }
      const { error: delErr } = await supabase.from("ptv_kontak_eksternal").delete().eq("id", targetId);
      if (delErr) {
        console.error("[API Kontak Delete Error]:", delErr);
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal menghapus kontak eksternal dari Staging: ${delErr.message}`,
            code: "database_delete_error"
          })
        );
        return;
      }
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: `Kontak eksternal "${existing.nama_kontak}" berhasil dihapus dari database Staging.`,
          deleted_id: targetId
        })
      );
      return;
    }
  } catch (err) {
    console.error("[API Kontak Exception]:", err);
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: `Terjadi kesalahan pada server saat memproses kontak: ${err.message}`,
        code: "internal_server_error"
      })
    );
  }
}

// api/_routes/kru.ts
init_cookies();
init_crypto();
init_liveAccess();
import { createClient as createClient10 } from "@supabase/supabase-js";
import { hash as hash2 } from "bcryptjs";

// src/products/hub/kru/types.ts
var CANONICAL_OPERATIONAL_DIVISIONS = [
  "Editor",
  "Layouter",
  "Technical",
  "Engagement"
];
function isOperationalCrew(crew) {
  return crew.category === "Kru" && crew.status_kru === "Aktif";
}

// src/products/hub/kru/kruMapper.ts
function mapLegacyKruRowToCrewMember(row, linkedAccountStatus = null) {
  const divUpper = (row.divisi || "").trim().toLowerCase();
  const jabUpper = (row.jabatan || "").trim().toLowerCase();
  let category = "Kru";
  if (divUpper === "pengarah" || jabUpper.includes("pengarah") || jabUpper.includes("pendiri") || jabUpper.includes("direktur yayasan") || jabUpper.includes("presdir") || jabUpper.includes("wadir")) {
    category = "Pengarah";
  } else if (divUpper === "pembina" || jabUpper.includes("pembina")) {
    category = "Pembina";
  } else {
    category = "Kru";
  }
  if (["Kru", "Pembina", "Pengarah"].includes(row.metadata_json?.category || "")) category = row.metadata_json.category;
  const status_kru = (row.status || "").trim().toLowerCase() === "aktif" ? "Aktif" : "Nonaktif";
  const status_akun = row.canonical_identity_id && linkedAccountStatus ? linkedAccountStatus === "active" ? "Aktif" : "Nonaktif" : "Belum Ada Akun";
  let role = "kru";
  const rawRole = (row.role || row.metadata_json?.role_legacy || "").toLowerCase();
  if (rawRole === "eksekutif" || rawRole === "executive") {
    role = "eksekutif";
  } else if (rawRole === "administrasi" || rawRole === "admin") {
    role = "administrasi";
  }
  const DEFAULT_AVATAR = "https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp";
  const foto_url = row.photo_url || row.metadata_json?.avatar_url || DEFAULT_AVATAR;
  const birth_date = row.metadata_json?.birth_date || row.metadata_json?.tanggal_lahir || void 0;
  const address = row.metadata_json?.address || row.metadata_json?.alamat || void 0;
  return {
    version: row.metadata_json?.updated_at || row.imported_at,
    personnel_link_pending: row.metadata_json?.phase1_link_pending === true,
    id: row.production_id || row.archive_id,
    ptv_id: row.ptv_id,
    full_name: row.full_name,
    username: row.username || (row.ptv_id ? row.ptv_id.toLowerCase().replace("-", "_") : ""),
    role,
    category,
    division: category === "Kru" ? row.divisi || "Umum" : "",
    position: row.jabatan || "Kru",
    angkatan: category === "Kru" ? row.angkatan || "" : "",
    assigned_profiles: row.metadata_json?.phase1_assigned_profiles,
    nim: row.metadata_json?.nim || void 0,
    jurusan: row.metadata_json?.jurusan || void 0,
    birth_date,
    tanggal_lahir: birth_date,
    address,
    alamat: address,
    phone: row.telepon_masked || void 0,
    email: row.email_masked || void 0,
    join_date: row.metadata_json?.created_at?.slice(0, 10) || row.imported_at?.slice(0, 10) || void 0,
    status_kru,
    status_akun,
    foto_url,
    oauth_uid: row.metadata_json?.oauth_uid || void 0,
    oauth_provider: row.metadata_json?.oauth_provider || void 0
  };
}

// api/_routes/kru.ts
function normalizePersonnelAliases(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Payload personel tidak valid.");
  const payload = { ...value };
  for (const [alias, canonical] of [["status", "status_kru"], ["divisi", "division"], ["jabatan", "position"], ["photo_url", "foto_url"], ["telepon", "phone"]]) {
    if (payload[alias] !== void 0) {
      if (payload[canonical] !== void 0 && payload[canonical] !== payload[alias]) throw new Error("Alias data personel bertentangan.");
      payload[canonical] = payload[alias];
      delete payload[alias];
    }
  }
  if (payload.status_kru === "aktif") payload.status_kru = "Aktif";
  if (payload.status_kru === "nonaktif") payload.status_kru = "Nonaktif";
  return payload;
}
async function parseJsonBody5(req) {
  const parsed = req.body;
  if (parsed !== void 0) {
    const value = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("Payload personel tidak valid.");
    return value;
  }
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Payload terlalu besar (maksimal 2MB)."));
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Format data JSON tidak valid."));
      }
    });
    req.on("error", reject);
  });
}
async function handler9(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const method = (req.method || "GET").toUpperCase();
  try {
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw new Error("origin");
  } catch {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Origin permintaan tidak diizinkan." }));
    return;
  }
  if (!["GET", "POST", "PUT", "PATCH"].includes(method)) {
    res.statusCode = 405;
    res.end(
      JSON.stringify({
        error: `Metode HTTP ${method} tidak didukung pada modul Manajemen Kru. Operasi penghapusan kru tidak diizinkan demi melindungi keutuhan data historis.`,
        code: "method_not_allowed"
      })
    );
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  if (!sessionToken || !authSecret) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses data Manajemen Kru.",
        code: "unauthorized"
      })
    );
    return;
  }
  const session = verifySessionToken(sessionToken, authSecret);
  if (!session) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Sesi login Anda tidak valid atau telah kedaluwarsa. Silakan masuk kembali.",
        code: "session_expired"
      })
    );
    return;
  }
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: "Konfigurasi backend Staging Supabase belum lengkap (URL atau Service Role Key hilang).",
        code: "server_configuration_error"
      })
    );
    return;
  }
  if (!/^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/.test(supabaseUrl)) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "Manajemen Kru hanya tersedia di Staging terverifikasi." }));
    return;
  }
  const supabase = createClient10(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(1e4) }) }
  });
  let access;
  try {
    access = await resolveLiveAccess(supabase, session);
  } catch {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Akses ditolak atau sesi telah dicabut.", code: "forbidden" }));
    return;
  }
  const required = method === "GET" ? "crew.view" : method === "POST" ? "crew.create" : "crew.edit";
  if (!access.can(required) && !((method === "PATCH" || method === "PUT") && access.can("crew.status.manage"))) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: `Akses ditolak: diperlukan ${required}.`, code: "forbidden" }));
    return;
  }
  try {
    if (method === "GET") {
      const { data: rows, error: queryErr } = await supabase.from("legacy_archive_kru").select("*").order("ptv_id", { ascending: true });
      if (queryErr) {
        console.error("[API Kru] Pembacaan personel gagal.");
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Gagal memuat data kru dari Supabase: ${queryErr.message}`,
            code: "database_query_error"
          })
        );
        return;
      }
      const { data: canonicals } = await supabase.from("canonical_identity").select("id, ptv_id, full_name, avatar_url");
      const ciByPtv = new Map((canonicals || []).map((c) => [c.ptv_id, c]));
      const { data: accounts } = await supabase.from("user_account").select("id, identity_id, status_akun");
      const accByIdentity = new Map((accounts || []).map((a) => [a.identity_id, a]));
      const accIds = (accounts || []).map((a) => a.id);
      const { data: profiles } = accIds.length ? await supabase.from("account_profiles").select("account_id, profile_id").in("account_id", accIds) : { data: [] };
      const profilesByAccount = /* @__PURE__ */ new Map();
      for (const p of profiles || []) {
        if (!profilesByAccount.has(p.account_id)) profilesByAccount.set(p.account_id, []);
        profilesByAccount.get(p.account_id).push(p.profile_id);
      }
      const seenPtv = /* @__PURE__ */ new Set();
      const seenCanonId = /* @__PURE__ */ new Set();
      const members = [];
      for (const raw of rows || []) {
        if (!raw.ptv_id || seenPtv.has(raw.ptv_id)) continue;
        if (raw.source_key === "system_position_capability_mapping" || raw.ptv_id && raw.ptv_id.startsWith("PTV-CONFIG")) continue;
        if (raw.metadata_json?.is_duplicate_archive === true) continue;
        const ci = ciByPtv.get(raw.ptv_id);
        const canonId = raw.canonical_identity_id || ci?.id || null;
        if (canonId) {
          if (seenCanonId.has(canonId)) continue;
          seenCanonId.add(canonId);
        }
        seenPtv.add(raw.ptv_id);
        const linkedAcc = canonId ? accByIdentity.get(canonId) : null;
        const assigned = linkedAcc ? profilesByAccount.get(linkedAcc.id) || [] : [];
        const portalRole = assigned.some((p) => ["root_executive", "eksekutif"].includes(p)) ? "eksekutif" : assigned.includes("administrasi") ? "administrasi" : "kru";
        const rowWithRole = {
          ...raw,
          canonical_identity_id: canonId,
          role: portalRole
        };
        members.push(mapLegacyKruRowToCrewMember(rowWithRole, linkedAcc?.status_akun ?? null));
      }
      const aktifCount = members.filter((c) => c.category === "Kru" && c.status_kru === "Aktif").length;
      const nonaktifCount = members.filter((c) => c.category === "Kru" && c.status_kru !== "Aktif").length;
      const pengarahCount = members.filter((c) => c.category === "Pengarah").length;
      const pembinaCount = members.filter((c) => c.category === "Pembina").length;
      const urlObj = new URL(req.url || "", "http://localhost");
      const scope = urlObj.searchParams.get("scope") || urlObj.searchParams.get("filter");
      if (scope === "active_crew" || scope === "assignment") {
        const activeCandidates = members.filter(isOperationalCrew).map((c) => ({
          id: c.id,
          ptv_id: c.ptv_id,
          name: c.full_name,
          division: c.division,
          role: "Kru",
          position: c.position,
          photo: c.foto_url || "",
          status_kru: "Aktif"
        }));
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            scope: "active_crew",
            count: activeCandidates.length,
            crew: activeCandidates,
            candidates: activeCandidates
          })
        );
        return;
      }
      let loginHistory = [];
      if (urlObj.searchParams.get("include_login_history") === "true") {
        if (!access.can("audit.logs.view")) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Izin melihat audit diperlukan." }));
          return;
        }
        const { data: histRows } = await supabase.from("ptv_login_history").select("*").order("login_at", { ascending: false }).limit(50);
        loginHistory = histRows || [];
      }
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          count: members.length,
          stats: {
            total: members.length,
            aktif: aktifCount,
            nonaktif: nonaktifCount,
            pengarah: pengarahCount,
            pembina: pembinaCount
          },
          crew: members,
          login_history: loginHistory
        })
      );
      return;
    }
    if (method === "POST") {
      const payload = normalizePersonnelAliases(await parseJsonBody5(req));
      const sensitive = ["username", "role", "status_akun", "assigned_profiles", "allowed_overrides", "denied_overrides", "password", "oauth_uid", "oauth_email", "oauth_provider", "auth_user_id", "canonical_identity_id", "metadata_json"];
      if (sensitive.some((key) => Object.prototype.hasOwnProperty.call(payload, key))) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: "Pengaturan akun dan izin hanya melalui Manajemen Akses.", code: "access_fields_forbidden" }));
        return;
      }
      if (payload.category !== void 0 && !["Kru", "Pembina", "Pengarah"].includes(payload.category)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Kategori personel tidak valid." }));
        return;
      }
      if (payload.status_kru !== void 0 && !["Aktif", "Nonaktif"].includes(payload.status_kru)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Status keanggotaan tidak valid." }));
        return;
      }
      if (method === "POST" && payload.division !== void 0 && payload.category !== "Pembina" && payload.category !== "Pengarah" && !CANONICAL_OPERATIONAL_DIVISIONS.includes(payload.division)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Divisi aktif harus Editor, Layouter, Technical, atau Engagement." }));
        return;
      }
      if (payload.ptv_id !== void 0 && !/^PTV-[0-9]{3,}$/.test(payload.ptv_id)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "ID PTV tidak valid." }));
        return;
      }
      const fullName = typeof payload.full_name === "string" ? payload.full_name.trim() : "";
      if (!fullName || fullName.length < 2) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: "Validasi gagal: Nama lengkap kru wajib diisi (minimal 2 karakter).",
            code: "invalid_full_name"
          })
        );
        return;
      }
      const { data: ptvRows, error: sequenceError } = await supabase.from("legacy_archive_kru").select("ptv_id");
      if (sequenceError) throw new Error("Urutan ID personel tidak dapat dibaca.");
      let maxNum = 0;
      for (const row of ptvRows || []) {
        const match = String(row.ptv_id || "").match(/^PTV-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
      let nextNum = maxNum + 1;
      let targetPtvId = `PTV-${String(nextNum).padStart(3, "0")}`;
      while (true) {
        const { data: conflict } = await supabase.from("legacy_archive_kru").select("archive_id").eq("ptv_id", targetPtvId).maybeSingle();
        if (!conflict) break;
        nextNum++;
        targetPtvId = `PTV-${String(nextNum).padStart(3, "0")}`;
      }
      const cleanUsername = typeof payload.username === "string" && payload.username.trim() ? payload.username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, "") : fullName.split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanCategory = payload.category === "Pengarah" || payload.category === "Pembina" ? payload.category : "Kru";
      let cleanDivisi = typeof payload.division === "string" ? payload.division.trim() : typeof payload.divisi === "string" ? payload.divisi.trim() : "Technical";
      if (cleanCategory === "Pengarah") cleanDivisi = "";
      if (cleanCategory === "Pembina") cleanDivisi = "";
      const cleanJabatan = typeof payload.position === "string" ? payload.position.trim() : typeof payload.jabatan === "string" ? payload.jabatan.trim() : "Kru Operasional";
      const cleanAngkatan = cleanCategory === "Kru" ? String(payload.angkatan || "").trim() : "";
      const cleanStatusKru = payload.status_kru === "Nonaktif" || payload.status === "Nonaktif" ? "Nonaktif" : "Aktif";
      const cleanRole = "kru";
      const cleanPhone = typeof payload.phone === "string" ? payload.phone.trim() : typeof payload.telepon === "string" ? payload.telepon.trim() : void 0;
      const cleanEmail = typeof payload.email === "string" ? payload.email.trim() : typeof payload.oauth_email === "string" ? payload.oauth_email.trim() : void 0;
      const DEFAULT_AVATAR = "https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp";
      const rawFotoUrl = typeof payload.foto_url === "string" ? payload.foto_url.trim() : typeof payload.photo_url === "string" ? payload.photo_url.trim() : "";
      const cleanFotoUrl = rawFotoUrl || DEFAULT_AVATAR;
      const cleanNim = typeof payload.nim === "string" ? payload.nim.trim() : void 0;
      const cleanJurusan = typeof payload.jurusan === "string" ? payload.jurusan.trim() : void 0;
      const cleanBirthDate = typeof payload.birth_date === "string" ? payload.birth_date.trim() : typeof payload.tanggal_lahir === "string" ? payload.tanggal_lahir.trim() : void 0;
      const cleanAddress = typeof payload.address === "string" ? payload.address.trim() : typeof payload.alamat === "string" ? payload.alamat.trim() : void 0;
      const newArchiveId = crypto.randomUUID();
      const insertRecord = {
        archive_id: newArchiveId,
        source_key: `direct_kru_${targetPtvId}`,
        production_id: crypto.randomUUID(),
        ptv_id: targetPtvId,
        full_name: fullName,
        username: cleanUsername,
        divisi: cleanDivisi,
        jabatan: cleanJabatan,
        angkatan: cleanAngkatan,
        status: cleanStatusKru === "Nonaktif" ? "nonaktif" : "aktif",
        role: cleanRole,
        photo_url: cleanFotoUrl,
        email_masked: cleanEmail || null,
        telepon_masked: cleanPhone || null,
        canonical_identity_id: null,
        reconciliation_status: "unlinked",
        metadata_json: {
          category: cleanCategory,
          nim: cleanNim || null,
          jurusan: cleanJurusan || null,
          birth_date: cleanBirthDate || null,
          tanggal_lahir: cleanBirthDate || null,
          address: cleanAddress || null,
          alamat: cleanAddress || null,
          original_phone: cleanPhone || null,
          original_email: cleanEmail || null,
          avatar_url: cleanFotoUrl,
          created_by_account_id: session.account_id,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        imported_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const { data: createdRow, error: insertErr } = await supabase.from("legacy_archive_kru").insert([insertRecord]).select("*").single();
      if (insertErr || !createdRow) {
        console.error("[API Kru] Penyimpanan personel gagal.");
        res.statusCode = insertErr?.code === "23505" ? 409 : 500;
        res.end(
          JSON.stringify({
            error: `Gagal menyimpan data kru baru ke database Staging: ${insertErr?.message || "Unknown database error"}`,
            code: "database_insert_error"
          })
        );
        return;
      }
      const createdMember = mapLegacyKruRowToCrewMember(createdRow);
      res.statusCode = 201;
      res.end(
        JSON.stringify({
          success: true,
          message: `Kru baru ${createdMember.full_name} (${createdMember.ptv_id}) berhasil disimpan secara permanen di database Staging.`,
          crew: createdMember
        })
      );
      return;
    }
    if (method === "PATCH" || method === "PUT") {
      const urlObj = new URL(req.url || "", "http://localhost");
      const action = urlObj.searchParams.get("action") || "";
      const rawBody = await parseJsonBody5(req);
      if (action === "toggle_account" || rawBody.action === "toggle_account") {
        if (!access.can("crew.status.manage")) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Izin mengelola status akun diperlukan.", code: "forbidden" }));
          return;
        }
        const targetId2 = (urlObj.searchParams.get("id") || rawBody.id || rawBody.archive_id || rawBody.ptv_id || "").trim();
        if (!targetId2) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Parameter ID kru wajib disertakan." }));
          return;
        }
        const isUuid2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId2);
        const query2 = supabase.from("legacy_archive_kru").select("*");
        const { data: rows } = isUuid2 ? await query2.or(`archive_id.eq.${targetId2},production_id.eq.${targetId2}`) : await query2.eq("ptv_id", targetId2);
        const crewRow = rows?.[0];
        if (!crewRow) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Data kru tidak ditemukan di database Staging." }));
          return;
        }
        let identityId = crewRow.canonical_identity_id;
        if (!identityId) {
          const { data: matchedCi } = await supabase.from("canonical_identity").select("id").eq("ptv_id", crewRow.ptv_id).maybeSingle();
          identityId = matchedCi?.id || null;
        }
        if (!identityId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: `Personel ${crewRow.full_name} (${crewRow.ptv_id}) belum memiliki akun login terdaftar di sistem.` }));
          return;
        }
        const { data: accounts } = await supabase.from("user_account").select("id, username, status_akun, updated_at").eq("identity_id", identityId);
        if (!accounts || accounts.length === 0) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: `Personel ${crewRow.full_name} (${crewRow.ptv_id}) belum memiliki akun login terdaftar di sistem.` }));
          return;
        }
        const targetAccount = accounts[0];
        const nextAccountStatus = rawBody.status_akun === "active" || rawBody.status_akun === "inactive" ? rawBody.status_akun : targetAccount.status_akun === "active" ? "inactive" : "active";
        const { data: currentProfiles } = await supabase.from("account_profiles").select("profile_id").eq("account_id", targetAccount.id);
        const profileIds = currentProfiles?.map((p) => p.profile_id) || ["crew"];
        if (profileIds.includes("root_executive")) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Status akun Root dilindungi dan tidak dapat diubah." }));
          return;
        }
        const { data: currentOverrides } = await supabase.from("account_capability_overrides").select("capability_key, override_type").eq("account_id", targetAccount.id);
        const allowedCaps = (currentOverrides || []).filter((o) => o.override_type === "allow").map((o) => o.capability_key);
        const deniedCaps = (currentOverrides || []).filter((o) => o.override_type === "deny").map((o) => o.capability_key);
        const rpcRes = await supabase.rpc("rpc_manage_account_access", {
          p_actor_account_id: session.account_id,
          p_session_iat: session.iat,
          p_change: {
            accountId: targetAccount.id,
            expectedVersion: targetAccount.updated_at,
            status: nextAccountStatus,
            profiles: profileIds,
            allowed: allowedCaps,
            denied: deniedCaps,
            confirmed: true,
            reason: `Status akun diubah menjadi ${nextAccountStatus === "active" ? "Akun Aktif" : "Akun Nonaktif"} dari Manajemen Kru`
          }
        });
        if (rpcRes.error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: `Gagal memperbarui status akun: ${rpcRes.error.message}` }));
          return;
        }
        const updatedCrew = mapLegacyKruRowToCrewMember(crewRow, nextAccountStatus);
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          message: `Status akun ${updatedCrew.full_name} berhasil diubah menjadi ${nextAccountStatus === "active" ? "Akun Aktif" : "Akun Nonaktif"}.`,
          crew: updatedCrew,
          status_akun: nextAccountStatus === "active" ? "Aktif" : "Nonaktif"
        }));
        return;
      }
      if (action === "reset_password" || rawBody.action === "reset_password") {
        if (!access.profiles.includes("root_executive")) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Akses ditolak: Fitur Atur Ulang Password hanya dapat dijalankan oleh akun ROOT." }));
          return;
        }
        const targetId2 = (urlObj.searchParams.get("id") || rawBody.id || rawBody.archive_id || rawBody.ptv_id || "").trim();
        const newPassword = String(rawBody.newPassword || "").trim();
        const reason = String(rawBody.reason || "Atur ulang password oleh ROOT di Manajemen Kru").trim();
        if (!targetId2) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Parameter ID kru wajib disertakan." }));
          return;
        }
        if (!newPassword || newPassword.length < 4) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Password baru minimal 4 karakter." }));
          return;
        }
        if (Buffer.byteLength(newPassword, "utf8") > 72) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Password baru maksimal 72 byte." }));
          return;
        }
        const isUuid2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId2);
        const query2 = supabase.from("legacy_archive_kru").select("*");
        const { data: rows } = isUuid2 ? await query2.or(`archive_id.eq.${targetId2},production_id.eq.${targetId2}`) : await query2.eq("ptv_id", targetId2);
        const crewRow = rows?.[0];
        if (!crewRow) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Data kru tidak ditemukan di database Staging." }));
          return;
        }
        let identityId = crewRow.canonical_identity_id;
        if (!identityId) {
          const { data: matchedCi } = await supabase.from("canonical_identity").select("id").eq("ptv_id", crewRow.ptv_id).maybeSingle();
          identityId = matchedCi?.id || null;
        }
        if (!identityId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: `Personel ${crewRow.full_name} (${crewRow.ptv_id}) belum memiliki akun login terdaftar di sistem.` }));
          return;
        }
        const { data: accounts } = await supabase.from("user_account").select("id, identity_id, username, auth_user_id, status_akun").eq("identity_id", identityId);
        if (!accounts || accounts.length === 0) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: `Personel ${crewRow.full_name} (${crewRow.ptv_id}) belum memiliki akun login terdaftar di sistem.` }));
          return;
        }
        const targetAccount = accounts[0];
        const passwordHash = await hash2(newPassword, 10);
        const { error: rpcErr } = await supabase.rpc("rpc_admin_set_password", {
          p_account_id: targetAccount.id,
          p_password_hash: passwordHash,
          p_actor_id: access.identity.id
        });
        if (rpcErr) {
          console.error("[API Kru] rpc_admin_set_password warning/error:", rpcErr.message);
        }
        const updatedMeta2 = {
          ...crewRow.metadata_json || {},
          password_hash: passwordHash,
          password_updated_at: (/* @__PURE__ */ new Date()).toISOString(),
          password_updated_by: session.account_id
        };
        await supabase.from("legacy_archive_kru").update({ metadata_json: updatedMeta2 }).eq("archive_id", crewRow.archive_id);
        if (identityId) {
          const { data: ciRow } = await supabase.from("canonical_identity").select("metadata").eq("id", identityId).single();
          const ciMeta = {
            ...ciRow?.metadata || {},
            password_updated_at: (/* @__PURE__ */ new Date()).toISOString(),
            password_updated_by: session.account_id
          };
          await supabase.from("canonical_identity").update({ metadata: ciMeta }).eq("id", identityId);
        }
        if (targetAccount.auth_user_id) {
          try {
            await supabase.auth.admin.updateUserById(targetAccount.auth_user_id, { password: newPassword });
          } catch (e) {
            console.warn("[API Kru] Supabase Auth update skipped or unavailable:", e);
          }
        }
        await supabase.from("user_account").update({ tokens_valid_after: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", targetAccount.id);
        await supabase.from("auth_audit_log").insert([{
          actor_id: access.identity.id,
          event_type: "password_reset_by_root",
          metadata: {
            target_account_id: targetAccount.id,
            target_username: targetAccount.username,
            target_ptv_id: crewRow.ptv_id,
            executed_by: access.identity.full_name,
            source: "Manajemen Kru - Akun & Keamanan",
            reason,
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          }
        }]);
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          message: `Password untuk akun @${targetAccount.username} (${crewRow.full_name}) berhasil diatur ulang. Sesi lama telah dibatalkan.`
        }));
        return;
      }
      if (action === "update_username" || rawBody.action === "update_username") {
        if (!access.profiles.includes("root_executive")) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Akses ditolak: Fitur Ubah Username hanya dapat dijalankan oleh akun ROOT." }));
          return;
        }
        const targetId2 = (urlObj.searchParams.get("id") || rawBody.id || rawBody.archive_id || rawBody.ptv_id || "").trim();
        const rawNewUsername = String(rawBody.username || rawBody.newUsername || "").trim().toLowerCase();
        const cleanUsername = rawNewUsername.replace(/[^a-z0-9_.]/g, "");
        if (!targetId2) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Parameter ID kru wajib disertakan." }));
          return;
        }
        if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 30) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Username baru harus berupa 3\u201330 karakter alfanumerik, titik, atau garis bawah." }));
          return;
        }
        const isUuid2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId2);
        const query2 = supabase.from("legacy_archive_kru").select("*");
        const { data: rows } = isUuid2 ? await query2.or(`archive_id.eq.${targetId2},production_id.eq.${targetId2}`) : await query2.eq("ptv_id", targetId2);
        const crewRow = rows?.[0];
        if (!crewRow) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Data kru tidak ditemukan di database Staging." }));
          return;
        }
        let identityId = crewRow.canonical_identity_id;
        if (!identityId) {
          const { data: matchedCi } = await supabase.from("canonical_identity").select("id").eq("ptv_id", crewRow.ptv_id).maybeSingle();
          identityId = matchedCi?.id || null;
        }
        const { data: existingUserAccounts } = await supabase.from("user_account").select("id, identity_id").eq("username", cleanUsername);
        if (existingUserAccounts && existingUserAccounts.some((acc) => acc.identity_id !== identityId)) {
          res.statusCode = 409;
          res.end(JSON.stringify({ error: `Username @${cleanUsername} sudah digunakan oleh akun lain.` }));
          return;
        }
        const { data: existingCrewRows } = await supabase.from("legacy_archive_kru").select("archive_id").eq("username", cleanUsername).neq("archive_id", crewRow.archive_id);
        if (existingCrewRows && existingCrewRows.length > 0) {
          res.statusCode = 409;
          res.end(JSON.stringify({ error: `Username @${cleanUsername} sudah terdaftar pada data personel lain.` }));
          return;
        }
        const oldUsername = crewRow.username || "";
        await supabase.from("legacy_archive_kru").update({
          username: cleanUsername,
          metadata_json: {
            ...crewRow.metadata_json || {},
            username_updated_at: (/* @__PURE__ */ new Date()).toISOString(),
            username_updated_by: session.account_id
          }
        }).eq("archive_id", crewRow.archive_id);
        if (identityId) {
          await supabase.from("user_account").update({
            username: cleanUsername,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("identity_id", identityId);
        }
        await supabase.from("auth_audit_log").insert([{
          actor_id: access.identity.id,
          event_type: "username_updated_by_root",
          metadata: {
            target_ptv_id: crewRow.ptv_id,
            old_username: oldUsername,
            new_username: cleanUsername,
            executed_by: access.identity.full_name,
            source: "Manajemen Kru - Akun & Keamanan",
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          }
        }]);
        const updatedCrew = mapLegacyKruRowToCrewMember({ ...crewRow, username: cleanUsername });
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          message: `Username berhasil diubah dari @${oldUsername} menjadi @${cleanUsername}.`,
          crew: updatedCrew,
          username: cleanUsername
        }));
        return;
      }
      if (action === "create_account" || rawBody.action === "create_account") {
        if (!access.profiles.includes("root_executive")) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Akses ditolak: Fitur Buat Akun hanya dapat dijalankan oleh akun ROOT." }));
          return;
        }
        const targetId2 = (urlObj.searchParams.get("id") || rawBody.id || rawBody.archive_id || rawBody.ptv_id || "").trim();
        if (!targetId2) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Parameter ID kru wajib disertakan." }));
          return;
        }
        const isUuid2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId2);
        const query2 = supabase.from("legacy_archive_kru").select("*");
        const { data: rows } = isUuid2 ? await query2.or(`archive_id.eq.${targetId2},production_id.eq.${targetId2}`) : await query2.eq("ptv_id", targetId2);
        const crewRow = rows?.[0];
        if (!crewRow) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Data kru tidak ditemukan di database Staging." }));
          return;
        }
        if (crewRow.username) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: `Personel ${crewRow.full_name} (${crewRow.ptv_id}) sudah memiliki akun login (@${crewRow.username}).` }));
          return;
        }
        const { data: allLegacyUsernames } = await supabase.from("legacy_archive_kru").select("username");
        const { data: allUserAccounts } = await supabase.from("user_account").select("username");
        const existingUsernames = /* @__PURE__ */ new Set([
          ...(allLegacyUsernames || []).map((r) => (r.username || "").toLowerCase().trim()).filter(Boolean),
          ...(allUserAccounts || []).map((r) => (r.username || "").toLowerCase().trim()).filter(Boolean)
        ]);
        const rawFirstWord = (crewRow.full_name || "").trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "") || "kru";
        let candidateUsername = rawFirstWord;
        let counter = 2;
        while (existingUsernames.has(candidateUsername)) {
          candidateUsername = `${rawFirstWord}${counter}`;
          counter++;
        }
        const randomPin = Math.floor(1e3 + Math.random() * 9e3);
        const generatedPassword = `${rawFirstWord}@${randomPin}`;
        const passwordHash = await hash2(generatedPassword, 10);
        let identityId = crewRow.canonical_identity_id;
        if (!identityId) {
          const { data: matchedCi } = await supabase.from("canonical_identity").select("id").eq("ptv_id", crewRow.ptv_id).maybeSingle();
          identityId = matchedCi?.id || null;
        }
        if (identityId) {
          const { error: rpcErr } = await supabase.rpc("rpc_admin_create_crew_account", {
            p_identity_id: identityId,
            p_username: candidateUsername,
            p_password_hash: passwordHash,
            p_actor_id: access.identity.id,
            p_profile_id: "crew"
          });
          if (rpcErr) {
            console.error("[API Kru] rpc_admin_create_crew_account warning/error:", rpcErr.message);
            const { data: existingAcc } = await supabase.from("user_account").select("id").eq("identity_id", identityId).maybeSingle();
            if (existingAcc) {
              await supabase.from("user_account").update({ username: candidateUsername, status_akun: "active", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", existingAcc.id);
              await supabase.from("account_profiles").upsert([{ account_id: existingAcc.id, profile_id: "crew" }]);
            } else {
              const { data: newAcc } = await supabase.from("user_account").insert([{
                identity_id: identityId,
                username: candidateUsername,
                status_akun: "active"
              }]).select("id").single();
              if (newAcc) {
                await supabase.from("account_profiles").upsert([{ account_id: newAcc.id, profile_id: "crew" }]);
              }
            }
          }
          const { data: ciRow } = await supabase.from("canonical_identity").select("metadata").eq("id", identityId).single();
          const ciMeta = {
            ...ciRow?.metadata || {},
            must_change_password: true,
            account_created_at: (/* @__PURE__ */ new Date()).toISOString(),
            account_created_by: session.account_id
          };
          await supabase.from("canonical_identity").update({ metadata: ciMeta }).eq("id", identityId);
        }
        const updatedMeta2 = {
          ...crewRow.metadata_json || {},
          password_hash: passwordHash,
          must_change_password: true,
          initial_password_created_at: (/* @__PURE__ */ new Date()).toISOString(),
          initial_password_created_by: session.account_id,
          account_created_at: (/* @__PURE__ */ new Date()).toISOString(),
          account_created_by: session.account_id
        };
        const { error: updateErr2 } = await supabase.from("legacy_archive_kru").update({
          username: candidateUsername,
          metadata_json: updatedMeta2
        }).eq("archive_id", crewRow.archive_id);
        if (updateErr2) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: `Gagal membuat akun login: ${updateErr2.message}` }));
          return;
        }
        try {
          await supabase.from("auth_audit_log").insert([{
            actor_id: access.identity.id,
            actor_ptv_id: access.identity.ptv_id || null,
            event_type: "account_created_by_root",
            metadata: {
              target_ptv_id: crewRow.ptv_id,
              target_full_name: crewRow.full_name,
              created_username: candidateUsername,
              assigned_profile: "kru",
              status_akun: "active",
              must_change_password: true,
              executed_by: access.identity.full_name,
              source: "Manajemen Kru - Buat Akun ROOT",
              created_at: (/* @__PURE__ */ new Date()).toISOString()
            }
          }]);
        } catch (auditErr) {
          console.warn("[API Kru] Gagal mencatat audit log create_account:", auditErr);
        }
        const updatedCrew = mapLegacyKruRowToCrewMember({ ...crewRow, username: candidateUsername, metadata_json: updatedMeta2 }, "active");
        res.statusCode = 201;
        res.end(JSON.stringify({
          success: true,
          message: `Akun login untuk ${crewRow.full_name} (@${candidateUsername}) berhasil dibuat.`,
          credentials: {
            username: candidateUsername,
            temporary_password: generatedPassword,
            full_name: crewRow.full_name,
            ptv_id: crewRow.ptv_id,
            must_change_password: true
          },
          crew: updatedCrew
        }));
        return;
      }
      const payload = normalizePersonnelAliases(rawBody);
      const sensitive = ["username", "role", "status_akun", "assigned_profiles", "allowed_overrides", "denied_overrides", "password", "oauth_uid", "oauth_email", "oauth_provider", "auth_user_id", "canonical_identity_id", "metadata_json"];
      if (sensitive.some((key) => Object.prototype.hasOwnProperty.call(payload, key))) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: "Pengaturan akun dan izin hanya melalui Manajemen Akun.", code: "access_fields_forbidden" }));
        return;
      }
      if (payload.category !== void 0 && !["Kru", "Pembina", "Pengarah"].includes(payload.category)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Kategori personel tidak valid." }));
        return;
      }
      if (payload.status_kru !== void 0 && !["Aktif", "Nonaktif"].includes(payload.status_kru)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Status keanggotaan tidak valid." }));
        return;
      }
      if (payload.ptv_id !== void 0 && !/^PTV-[0-9]{3,}$/.test(payload.ptv_id)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "ID PTV tidak valid." }));
        return;
      }
      if (!access.can("crew.edit") && Object.keys(payload).some((key) => !["version", "id", "archive_id", "ptv_id", "status_kru"].includes(key))) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: "Izin status tidak memberikan izin edit profil." }));
        return;
      }
      const targetId = (urlObj.searchParams.get("id") || payload.id || payload.archive_id || payload.ptv_id || "").trim();
      if (!targetId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Parameter ID kru wajib disertakan (archive_id atau ptv_id).", code: "missing_crew_id" }));
        return;
      }
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
      if (!isUuid && !/^PTV-[0-9]{3,}$/.test(targetId)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Identifier kru tidak valid." }));
        return;
      }
      const query = supabase.from("legacy_archive_kru").select("*");
      const { data: existingRows, error: findErr } = isUuid ? await query.or(`archive_id.eq.${targetId},production_id.eq.${targetId}`) : await query.eq("ptv_id", targetId);
      if (findErr) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gagal mencari data kru di Staging: ${findErr.message}`, code: "database_query_error" }));
        return;
      }
      const existing = existingRows && existingRows[0];
      if (existingRows && existingRows.length > 1) {
        res.statusCode = 409;
        res.end(JSON.stringify({ error: "Identitas kru ambigu; diperlukan rekonsiliasi." }));
        return;
      }
      if (!existing) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: `Data kru dengan identifier "${targetId}" tidak ditemukan di database Staging.`, code: "crew_not_found" }));
        return;
      }
      if (payload.status_kru !== void 0 && payload.status_kru !== mapLegacyKruRowToCrewMember(existing).status_kru && !access.can("crew.status.manage")) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: "Izin mengelola status diperlukan." }));
        return;
      }
      if (payload.full_name !== void 0 && (typeof payload.full_name !== "string" || payload.full_name.trim().length < 2)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Nama lengkap minimal 2 karakter." }));
        return;
      }
      const category = payload.category || mapLegacyKruRowToCrewMember(existing).category;
      if (payload.division !== void 0 && category === "Kru" && payload.division !== existing.divisi && !CANONICAL_OPERATIONAL_DIVISIONS.includes(payload.division)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Divisi aktif tidak valid." }));
        return;
      }
      const updates = {};
      if (typeof payload.full_name === "string" && payload.full_name.trim().length >= 2) {
        updates.full_name = payload.full_name.trim();
      }
      if (typeof payload.division === "string") {
        updates.divisi = payload.division.trim();
      }
      if (typeof payload.position === "string") {
        updates.jabatan = payload.position.trim();
      }
      if (payload.angkatan !== void 0) {
        updates.angkatan = String(payload.angkatan).trim();
      }
      if (payload.status_kru) {
        const nextStatus = payload.status_kru;
        updates.status = nextStatus === "Nonaktif" || nextStatus === "nonaktif" ? "nonaktif" : "aktif";
      }
      if (payload.foto_url !== void 0) {
        updates.photo_url = (payload.foto_url || "").trim() || "https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp";
      }
      if (payload.phone !== void 0) {
        updates.telepon_masked = (payload.phone || "").trim() || null;
      }
      if (payload.email !== void 0) {
        updates.email_masked = (payload.email || "").trim() || null;
      }
      const existingMeta = typeof existing.metadata_json === "object" && existing.metadata_json !== null ? existing.metadata_json : {};
      const updatedMeta = {
        ...existingMeta,
        updated_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_by_account_id: session.account_id
      };
      if (payload.category !== void 0) updatedMeta.category = payload.category;
      if (payload.nim !== void 0) updatedMeta.nim = payload.nim ? String(payload.nim).trim() : null;
      if (payload.jurusan !== void 0) updatedMeta.jurusan = payload.jurusan ? String(payload.jurusan).trim() : null;
      if (payload.birth_date !== void 0 || payload.tanggal_lahir !== void 0) {
        updatedMeta.birth_date = String(payload.birth_date || payload.tanggal_lahir || "").trim() || null;
        updatedMeta.tanggal_lahir = updatedMeta.birth_date;
      }
      if (payload.address !== void 0 || payload.alamat !== void 0) {
        updatedMeta.address = String(payload.address || payload.alamat || "").trim() || null;
        updatedMeta.alamat = updatedMeta.address;
      }
      if (payload.foto_url !== void 0) {
        updatedMeta.avatar_url = payload.foto_url ? String(payload.foto_url).trim() : "https://progresiftv.id/wp-content/uploads/AVATAR-PTV.webp";
      }
      if (payload.phone !== void 0) updatedMeta.original_phone = payload.phone ? String(payload.phone).trim() : null;
      if (payload.email !== void 0) updatedMeta.original_email = payload.email ? String(payload.email).trim() : null;
      if ((payload.category || existingMeta.category) === "Pembina" || (payload.category || existingMeta.category) === "Pengarah") {
        updates.divisi = null;
        updates.angkatan = null;
      }
      updates.metadata_json = updatedMeta;
      const { data: updatedRow, error: updateErr } = await supabase.from("legacy_archive_kru").update(updates).eq("archive_id", existing.archive_id).select("*").single();
      if (updateErr || !updatedRow) {
        console.error("[API Kru] Pembaruan personel gagal:", updateErr);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gagal memperbarui data kru di Staging: ${updateErr?.message || "Database update error"}`, code: "database_update_error" }));
        return;
      }
      let canonicalId = existing.canonical_identity_id;
      if (!canonicalId) {
        try {
          const { data: matchedCi } = await supabase.from("canonical_identity").select("id").eq("ptv_id", existing.ptv_id).maybeSingle();
          canonicalId = matchedCi?.id || null;
        } catch {
          canonicalId = null;
        }
      }
      if (canonicalId && updates.jabatan) {
        try {
          await supabase.from("organization_membership").update({
            position_title: updates.jabatan,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("identity_id", canonicalId).eq("organization_id", "ptv_studio").eq("is_current", true);
        } catch (omErr) {
          console.warn("[API Kru] Sinkronisasi membership position_title terlewati:", omErr);
        }
      }
      let accountStatus = null;
      if (canonicalId) {
        const { data: accounts } = await supabase.from("user_account").select("status_akun").eq("identity_id", canonicalId);
        accountStatus = accounts?.[0]?.status_akun ?? null;
      }
      const updatedMember = mapLegacyKruRowToCrewMember(updatedRow, accountStatus);
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: `Data profil kru ${updatedMember.full_name} (${updatedMember.ptv_id}) berhasil diperbarui di database Staging.`,
          crew: updatedMember
        })
      );
      return;
    }
  } catch {
    console.error("[API Kru] Permintaan gagal diproses.");
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        error: "Permintaan personel tidak valid atau tidak dapat diproses.",
        code: "internal_server_error"
      })
    );
  }
}

// api/_routes/lapor-kerusakan.ts
init_cookies();
init_crypto();
init_identity();
import { createClient as createClient11 } from "@supabase/supabase-js";

// api/_routes/reportPersistence.ts
async function reportCanRead(client, session, module) {
  const { data, error } = await client.rpc("rpc_report_can_read", {
    p_account_id: session.account_id,
    p_session_iat: session.iat,
    p_module: module
  });
  if (error) throw new Error("Izin baca laporan tidak dapat diverifikasi.");
  return data === true;
}
async function handleReportWrite(req, res, client, session, module) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  try {
    const origin = req.headers.origin;
    if (origin && req.headers["sec-fetch-site"] === "cross-site") {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: "Asal permintaan laporan tidak diizinkan." }));
      return;
    }
    if (!req.headers["content-type"]?.includes("application/json")) throw new Error("Format permintaan harus JSON.");
    let body = req.body;
    if (body === void 0) {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > 31e5) throw new Error("Ukuran laporan melebihi batas.");
        chunks.push(Buffer.from(chunk));
      }
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    }
    if (!body || typeof body !== "object") throw new Error("Permintaan laporan tidak valid.");
    if (Buffer.byteLength(JSON.stringify(body)) > 31e5) throw new Error("Ukuran laporan melebihi batas.");
    const { action, id, payload } = body;
    if (!["create", "update", "delete"].includes(String(action)) || typeof id !== "string" || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id) || !payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Operasi atau ID laporan tidak valid.");
    }
    const capability = module === "damage" ? action === "create" ? "damage.report" : "damage.qc.approve" : action === "create" ? "lostfound.report" : "lostfound.manage";
    if (!session.capabilities?.includes(capability)) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: "Capability operasi laporan tidak mencukupi." }));
      return;
    }
    const { data, error } = await client.rpc("rpc_write_report_server", {
      p_account_id: session.account_id,
      p_session_iat: session.iat,
      p_module: module,
      p_action: action,
      p_id: id,
      p_payload: payload
    });
    if (error) {
      res.statusCode = error.code === "42501" ? 403 : error.code === "23505" ? 409 : 400;
      res.end(JSON.stringify({ error: `Laporan belum tersimpan: ${error.message}` }));
      return;
    }
    if (data?.success !== true || data.id !== id) throw new Error("Konfirmasi backend tidak valid.");
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (error) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Laporan belum tersimpan." }));
  }
}

// api/_routes/lapor-kerusakan.ts
function normalizeDamageStatus(rawStatus) {
  const norm = (rawStatus || "").toLowerCase().trim();
  if (norm.includes("selesai") || norm.includes("resolved") || norm.includes("closed")) return "Selesai";
  if (norm.includes("perbaikan") || norm.includes("repair")) return "Dalam Perbaikan";
  if (norm.includes("sedang dicek") || norm.includes("dicek") || norm.includes("investigating")) return "Sedang Dicek";
  if (norm.includes("rusak total") || norm.includes("total")) return "Rusak Total";
  return "Baru";
}
function normalizeDamageSeverity(rawSeverity) {
  const norm = (rawSeverity || "").toLowerCase().trim();
  if (norm.includes("berat") || norm.includes("high") || norm.includes("critical")) return "Berat";
  if (norm.includes("ringan") || norm.includes("low")) return "Ringan";
  return "Sedang";
}
async function handler10(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Metode HTTP tidak diizinkan." }));
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  if (!sessionToken || !authSecret) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses data Lapor Kerusakan.",
        code: "unauthorized"
      })
    );
    return;
  }
  const session = verifySessionToken(sessionToken, authSecret);
  if (!session) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Sesi login Anda tidak valid atau telah kedaluwarsa. Silakan masuk kembali.",
        code: "session_expired"
      })
    );
    return;
  }
  const userCaps = await refreshLiveSession(session);
  if (!userCaps.includes("hub.access")) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Sesi atau izin telah dicabut." }));
    return;
  }
  const hasPermission = userCaps.includes("damage.view");
  if (!hasPermission) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Akun Anda tidak memiliki izin untuk melihat modul Lapor Kerusakan.",
        code: "forbidden"
      })
    );
    return;
  }
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Konfigurasi backend Supabase Staging belum lengkap di server.",
        code: "misconfigured_backend"
      })
    );
    return;
  }
  if (new URL(supabaseUrl).hostname !== "swadgljnyelsjstqqxbm.supabase.co") {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "Endpoint laporan hanya tersedia pada Staging." }));
    return;
  }
  const supabase = createClient11(supabaseUrl, serviceRoleKey);
  const accountActive = await verifyAccountStatusLive(session.account_id, session.iat, session);
  if (!accountActive) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Akun pengguna Anda tidak aktif di sistem.",
        code: "account_inactive"
      })
    );
    return;
  }
  try {
    if (req.method === "POST") {
      await handleReportWrite(req, res, supabase, session, "damage");
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    if (!await reportCanRead(supabase, session, "damage")) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: "Izin damage.view diperlukan." }));
      return;
    }
    const { data: invItems, error: invError } = await supabase.from("ptv_inventaris").select("id, kode, nama_alat, kategori, foto_url");
    if (invError) throw invError;
    const invMap = new Map((invItems || []).map((i) => [i.id, i]));
    const { data: units, error: unitsError } = await supabase.from("ptv_inventaris_unit").select("id, inventaris_id, kode_unit");
    if (unitsError) throw unitsError;
    const unitMap = new Map((units || []).map((unit) => [unit.id, unit]));
    const { data: canonicalReports, error: errCanon } = await supabase.from("ptv_lapor_masalah").select(`
        id,
        unit_id,
        pelapor_id,
        pelapor_nama,
        deskripsi_kerusakan,
        status_qc,
        biaya_reparasi,
        qc_approved_by,
        qc_approved_at,
        created_at,
        updated_at,
        report_metadata
      `).order("created_at", { ascending: false });
    if (errCanon) {
      throw errCanon;
    }
    const { data: historicalRows, error: errHist } = await supabase.from("legacy_archive_unresolved").select("source_id, raw_payload, quarantined_at").eq("source_table", "ptv_lapor_masalah");
    if (errHist) {
      console.warn("[LaporKerusakan] Historical reports unavailable:", errHist.message);
    }
    const reports = [];
    for (const c of canonicalReports || []) {
      const unit = unitMap.get(c.unit_id);
      const inv = unit ? invMap.get(unit.inventaris_id) : void 0;
      const meta = c.report_metadata || {};
      reports.push({
        id: c.id,
        assetId: inv?.id || c.unit_id,
        assetName: inv?.nama_alat || "Unit Alat",
        assetCategory: inv?.kategori || "Inventaris",
        unitId: c.unit_id,
        unitNumber: Number(unit?.kode_unit?.match(/(?:-U?)(\d+)$/)?.[1]) || 1,
        unitCode: unit?.kode_unit || `U-${c.unit_id.slice(0, 6)}`,
        title: meta.title || c.deskripsi_kerusakan.slice(0, 60),
        description: c.deskripsi_kerusakan,
        severity: normalizeDamageSeverity(meta.severity),
        photoUrl: meta.photoUrl || void 0,
        reporterContact: meta.reporterContact || void 0,
        reporterName: c.pelapor_nama || "Kru PTV",
        reportedAt: c.created_at,
        status: normalizeDamageStatus(c.status_qc),
        qcBy: meta.qcBy || (c.qc_approved_by ? "QC Eksekutif" : void 0),
        qcDate: meta.qcDate || c.qc_approved_at?.slice(0, 10),
        qcNotes: meta.qcNotes || (c.biaya_reparasi ? `Biaya estimasi reparasi: Rp ${c.biaya_reparasi}` : void 0),
        qcLocked: !!c.qc_approved_at,
        isCurrentUser: false,
        is_historical: false
      });
    }
    for (const h of historicalRows || []) {
      const p = h.raw_payload || {};
      const targetId = p.alat_id || p.inventaris_id;
      const inv = invMap.get(targetId);
      const status = normalizeDamageStatus(p.status || p.qc_status);
      const title = p.masalah || p.keterangan || "Kendala Teknis Alat";
      reports.push({
        id: p.id || h.source_id,
        assetId: inv?.id || targetId || "historical-asset",
        assetName: inv?.nama_alat || p.nama_alat || "Alat Historis",
        assetCategory: inv?.kategori || "Studio Equipment",
        unitNumber: 1,
        unitCode: inv?.kode ? `${inv.kode}-U01` : "(Unit Historis)",
        title: title.length > 80 ? title.slice(0, 77) + "..." : title,
        description: p.keterangan && p.keterangan !== "\u2014" ? `${p.masalah}
Keterangan: ${p.keterangan}` : p.masalah,
        severity: normalizeDamageSeverity(p.severity),
        photoUrl: p.foto_url || inv?.foto_url || void 0,
        reporterName: p.pelapor_nama || "Kru Studio",
        reporterContact: p.pelapor_kontak || void 0,
        reportedAt: p.created_at || h.quarantined_at || (/* @__PURE__ */ new Date()).toISOString(),
        status,
        qcBy: p.qc_by || void 0,
        qcDate: p.qc_date || (p.updated_at ? p.updated_at.slice(0, 10) : void 0),
        qcNotes: p.qc_notes || void 0,
        qcLocked: status === "Selesai",
        isCurrentUser: false,
        is_historical: true
      });
    }
    reports.sort((a, b) => (b.reportedAt || "").localeCompare(a.reportedAt || ""));
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        success: true,
        count: reports.length,
        reports
      })
    );
  } catch (err) {
    console.error("[API Lapor Kerusakan Error]:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Terjadi kesalahan internal server saat mengambil data lapor kerusakan.",
        detail: err.message
      })
    );
  }
}

// api/_routes/lost-found.ts
init_cookies();
init_crypto();
init_identity();
import { createClient as createClient12 } from "@supabase/supabase-js";
function normalizeLostFoundStatus(rawStatus) {
  const norm = (rawStatus || "").toLowerCase().trim();
  if (norm.includes("dikembalikan") || norm.includes("selesai") || norm.includes("returned") || norm.includes("claimed")) {
    return "Dikembalikan";
  }
  if (norm.includes("ditemukan") || norm.includes("found") || norm.includes("diamankan")) {
    return "Ditemukan";
  }
  return "Dicari";
}
async function handler11(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Metode HTTP tidak diizinkan." }));
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  if (!sessionToken || !authSecret) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses data Lost & Found.",
        code: "unauthorized"
      })
    );
    return;
  }
  const session = verifySessionToken(sessionToken, authSecret);
  if (!session) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Sesi login Anda tidak valid atau telah kedaluwarsa. Silakan masuk kembali.",
        code: "session_expired"
      })
    );
    return;
  }
  const userCaps = await refreshLiveSession(session);
  if (!userCaps.includes("hub.access")) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Sesi atau izin telah dicabut." }));
    return;
  }
  const hasPermission = userCaps.includes("lostfound.view");
  if (!hasPermission) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Akun Anda tidak memiliki izin untuk melihat modul Lost & Found.",
        code: "forbidden"
      })
    );
    return;
  }
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Konfigurasi backend Supabase Staging belum lengkap di server.",
        code: "misconfigured_backend"
      })
    );
    return;
  }
  if (new URL(supabaseUrl).hostname !== "swadgljnyelsjstqqxbm.supabase.co") {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "Endpoint laporan hanya tersedia pada Staging." }));
    return;
  }
  const supabase = createClient12(supabaseUrl, serviceRoleKey);
  const accountActive = await verifyAccountStatusLive(session.account_id, session.iat, session);
  if (!accountActive) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Akun pengguna Anda tidak aktif di sistem.",
        code: "account_inactive"
      })
    );
    return;
  }
  try {
    if (req.method === "POST") {
      await handleReportWrite(req, res, supabase, session, "lostfound");
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    if (!await reportCanRead(supabase, session, "lostfound")) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: "Izin lostfound.view diperlukan." }));
      return;
    }
    const { data: dbItems, error: errDb } = await supabase.from("ptv_lost_found").select(`
        id,
        nama_barang,
        lokasi_ditemukan,
        deskripsi,
        foto_url,
        status,
        ditemukan_oleh,
        diklaim_oleh,
        tanggal_klaim,
        created_at,
        report_metadata
      `).order("created_at", { ascending: false });
    if (errDb) {
      console.error("[API Lost & Found] Error fetching items:", errDb);
      throw errDb;
    }
    const items = (dbItems || []).map((row) => {
      const status = normalizeLostFoundStatus(row.status);
      const meta = row.report_metadata || {};
      const type = meta.type === "hilang" || !meta.type && row.status?.toLowerCase().includes("hilang") ? "hilang" : "temuan";
      return {
        id: row.id,
        type,
        title: row.nama_barang || "Barang Tanpa Nama",
        category: meta.category || "Perlengkapan",
        location: row.lokasi_ditemukan || "Area Studio",
        date: meta.date || row.created_at?.slice(0, 10) || "",
        description: row.deskripsi || "",
        photoUrl: row.foto_url || void 0,
        reporterName: row.ditemukan_oleh || "Kru Studio",
        reporterContact: meta.reporterContact || "",
        status,
        createdAt: row.created_at || (/* @__PURE__ */ new Date()).toISOString(),
        resolvedAt: row.tanggal_klaim || void 0,
        resolvedBy: row.diklaim_oleh || void 0,
        isCurrentUser: false
      };
    });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        success: true,
        count: items.length,
        items
      })
    );
  } catch (err) {
    console.error("[API Lost & Found Error]:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Terjadi kesalahan internal server saat mengambil data lost & found.",
        detail: err.message
      })
    );
  }
}

// api/_routes/peminjaman.ts
init_cookies();
init_crypto();
init_identity();
import { createClient as createClient13 } from "@supabase/supabase-js";

// api/_routes/loanPersistence.ts
var operations = {
  rpc_checkout_loan: { rpc: "rpc_checkout_loan_server", fields: ["p_transaction_id", "p_borrower_name", "p_purpose", "p_out_date", "p_due_date", "p_event_name", "p_unit_ids"] },
  rpc_return_loan: { rpc: "rpc_return_loan_server", fields: ["p_transaction_id", "p_back_date", "p_condition_status", "p_notes"] },
  rpc_return_single_unit: { rpc: "rpc_return_single_unit_server", fields: ["p_loan_row_id", "p_unit_id", "p_condition_status", "p_notes"] }
};
async function loanCanRead(client, session) {
  const { data, error } = await client.rpc("rpc_loans_can_read_server", { p_account_id: session.account_id, p_session_iat: session.iat });
  if (error || data !== true) throw new Error("Izin baca peminjaman tidak dapat diverifikasi.");
}
async function handleLoanWrite(req, res, client, session) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  try {
    if (!req.headers.origin || new URL(req.headers.origin).host !== req.headers.host || req.headers["sec-fetch-site"] === "cross-site") {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: "Asal permintaan peminjaman tidak diizinkan." }));
      return;
    }
    if (!req.headers["content-type"]?.includes("application/json")) throw new Error("Permintaan harus berupa JSON.");
    let body = req.body;
    if (body === void 0) {
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += Buffer.byteLength(chunk);
        if (length > 65536) throw new Error("Permintaan peminjaman terlalu besar.");
        chunks.push(Buffer.from(chunk));
      }
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Permintaan tidak valid.");
    if (Buffer.byteLength(JSON.stringify(body)) > 65536) throw new Error("Permintaan peminjaman terlalu besar.");
    const { operation, args } = body;
    const config = typeof operation === "string" && Object.hasOwn(operations, operation) ? operations[operation] : null;
    if (!config || !args || typeof args !== "object" || Array.isArray(args)) throw new Error("Operasi peminjaman tidak valid.");
    const capability = operation === "rpc_checkout_loan" ? "loans.checkout" : "loans.return";
    if (!session.capabilities?.includes(capability)) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: "Capability operasi peminjaman tidak mencukupi." }));
      return;
    }
    const payload = {};
    for (const field of config.fields) payload[field] = args[field] ?? null;
    const { data, error } = await client.rpc(config.rpc, { ...payload, p_account_id: session.account_id, p_session_iat: session.iat });
    if (error) {
      res.statusCode = error.code === "42501" ? 403 : error.code === "23505" ? 409 : 400;
      res.end(JSON.stringify({ error: `Penyimpanan belum dikonfirmasi: ${error.message}` }));
      return;
    }
    if (data?.success !== true) throw new Error("Backend belum mengonfirmasi penyimpanan.");
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (error) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Penyimpanan belum dikonfirmasi." }));
  }
}

// api/_routes/peminjaman.ts
function parseLoanMetadata(rawCatatan) {
  if (!rawCatatan) return {};
  const match = rawCatatan.match(/<!-- PTV_META:\s*([\s\S]*?)\s*-->/);
  if (!match) return {};
  try {
    const cleaned = match[1].replace(/\\'/g, "'");
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}
function computeLoanStatus(dbStatus, tenggatKembali, tanggalKembali) {
  const norm = (dbStatus || "").toLowerCase().trim();
  if (norm === "dikembalikan" || norm === "returned" || norm === "selesai" || !!tanggalKembali) {
    return "dikembalikan";
  }
  const todayIso = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (tenggatKembali && tenggatKembali.slice(0, 10) < todayIso) {
    return "terlambat";
  }
  return "dipinjam";
}
async function handler12(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Metode HTTP tidak diizinkan." }));
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  if (!sessionToken || !authSecret) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses data Peminjaman.",
        code: "unauthorized"
      })
    );
    return;
  }
  const session = verifySessionToken(sessionToken, authSecret);
  if (!session) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Sesi login Anda tidak valid atau telah kedaluwarsa. Silakan masuk kembali.",
        code: "session_expired"
      })
    );
    return;
  }
  const userCaps = await refreshLiveSession(session);
  if (!userCaps.includes("hub.access")) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Sesi atau izin telah dicabut." }));
    return;
  }
  const hasPermission = userCaps.includes("loans.view");
  if (!hasPermission) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Akun Anda tidak memiliki izin untuk melihat modul Peminjaman.",
        code: "forbidden"
      })
    );
    return;
  }
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Konfigurasi backend Supabase Staging belum lengkap di server.",
        code: "misconfigured_backend"
      })
    );
    return;
  }
  if (new URL(supabaseUrl).hostname !== "swadgljnyelsjstqqxbm.supabase.co") {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "Endpoint peminjaman dibatasi pada Staging." }));
    return;
  }
  const supabase = createClient13(supabaseUrl, serviceRoleKey);
  const accountActive = await verifyAccountStatusLive(session.account_id, session.iat, session);
  if (!accountActive) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Akun pengguna Anda tidak aktif di sistem.",
        code: "account_inactive"
      })
    );
    return;
  }
  try {
    if (req.method === "POST") {
      await handleLoanWrite(req, res, supabase, session);
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    await loanCanRead(supabase, session);
    const { data: invItems, error: invError } = await supabase.from("ptv_inventaris").select("id, kode, nama_alat, kategori, foto_url");
    if (invError) throw invError;
    const invMap = new Map((invItems || []).map((i) => [i.id, i]));
    const { data: unitItems, error: unitError } = await supabase.from("ptv_inventaris_unit").select("id, inventaris_id, kode_unit, nama_unit, status_peminjaman");
    if (unitError) throw unitError;
    const unitMap = new Map((unitItems || []).map((u) => [u.id, u]));
    const { data: canonicalLoans, error: errCanon } = await supabase.from("ptv_peminjaman").select(`
        id,
        transaction_id,
        unit_id,
        peminjam_nama,
        keperluan,
        tanggal_pinjam,
        tenggat_kembali,
        tanggal_kembali,
        status,
        kondisi_kembali,
        catatan,
        actor_id,
        created_at
      `).order("created_at", { ascending: false });
    if (errCanon) {
      throw errCanon;
    }
    const { data: historicalRows, error: errHist } = await supabase.from("legacy_archive_unresolved").select("source_id, raw_payload, quarantined_at").eq("source_table", "ptv_peminjaman");
    if (errHist) {
      console.warn("[Peminjaman] Historical loans unavailable:", errHist.message);
    }
    const records = [];
    for (const c of canonicalLoans || []) {
      const unit = unitMap.get(c.unit_id);
      const inv = unit ? invMap.get(unit.inventaris_id) : invMap.get(c.unit_id);
      const status = computeLoanStatus(c.status, c.tenggat_kembali, c.tanggal_kembali);
      records.push({
        id: c.id,
        transaction_id: c.transaction_id || `TRX-${c.id.slice(0, 8)}`,
        unit_id: c.unit_id,
        kode_unit: unit?.kode_unit || (c.unit_id ? `U-${c.unit_id.slice(0, 6)}` : "-"),
        nama_alat: inv?.nama_alat || unit?.nama_unit || "Unit Alat",
        kategori: inv?.kategori || "Umum",
        peminjam_nama: c.peminjam_nama || "Kru PTV",
        keperluan: c.keperluan || "Operasional",
        tanggal_pinjam: c.tanggal_pinjam || c.created_at?.slice(0, 10),
        tenggat_kembali: c.tenggat_kembali || c.tanggal_pinjam,
        tanggal_kembali: c.tanggal_kembali || void 0,
        status,
        kondisi_kembali: c.kondisi_kembali || void 0,
        catatan: c.catatan || void 0,
        actor_id: c.actor_id || void 0,
        created_at: c.created_at,
        is_historical: false,
        foto_url: inv?.foto_url || void 0
      });
    }
    for (const h of historicalRows || []) {
      const p = h.raw_payload || {};
      const meta = parseLoanMetadata(p.catatan);
      const borrower = meta.borrower_name || meta.user || meta.account || p.peminjam_nama || (p.keperluan && p.keperluan.includes("\u2014") ? p.keperluan.split("\u2014")[0].trim() : "Kru Studio");
      const purpose = meta.purpose || (p.keperluan && p.keperluan.includes("\u2014") ? p.keperluan.split("\u2014").slice(1).join("\u2014").trim() : p.keperluan) || "Operasional Produksi";
      const pinjamDate = meta.borrowed_at || p.tanggal_pinjam || p.created_at?.slice(0, 10) || "2026-09-01";
      const dueDate = meta.expected_return || p.tanggal_kembali || pinjamDate;
      const returnedDate = meta.returned_at || p.tanggal_kembali || (p.status === "dikembalikan" ? dueDate : void 0);
      const rawStatus = p.status || meta.status;
      const status = computeLoanStatus(rawStatus, dueDate, returnedDate);
      const txnId = meta.code || meta.transaction_id || (p.id ? `PJM-${p.id.slice(0, 8).toUpperCase()}` : `PJM-HIST`);
      const equipmentList = Array.isArray(meta.equipment_ids) && meta.equipment_ids.length > 0 ? meta.equipment_ids : [p.aset_id || p.inventaris_id || "historical-unit"];
      equipmentList.forEach((eqId, idx) => {
        const unit = unitMap.get(eqId);
        const inv = invMap.get(unit?.inventaris_id || eqId);
        records.push({
          id: equipmentList.length > 1 ? `${p.id || h.source_id}_${idx}` : p.id || h.source_id,
          transaction_id: txnId,
          unit_id: eqId,
          kode_unit: unit?.kode_unit || (inv?.kode ? `${inv.kode} (Master)` : "(Item Master Historis)"),
          nama_alat: inv?.nama_alat || unit?.nama_unit || "Alat Historis (Referensi Lepas)",
          kategori: inv?.kategori || "Inventaris Studio",
          peminjam_nama: borrower,
          keperluan: purpose,
          tanggal_pinjam: pinjamDate,
          tenggat_kembali: dueDate,
          tanggal_kembali: returnedDate ? returnedDate.slice(0, 10) : void 0,
          status,
          kondisi_kembali: "bagus",
          catatan: meta.notes || (p.catatan && !p.catatan.includes("<!--") ? p.catatan : void 0),
          created_at: p.created_at || h.quarantined_at || (/* @__PURE__ */ new Date()).toISOString(),
          is_historical: true,
          foto_url: inv?.foto_url || void 0
        });
      });
    }
    records.sort((a, b) => {
      const aLate = a.status === "terlambat";
      const bLate = b.status === "terlambat";
      if (aLate && !bLate) return -1;
      if (!aLate && bLate) return 1;
      const aActive = a.status === "dipinjam";
      const bActive = b.status === "dipinjam";
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return (b.tanggal_pinjam || "").localeCompare(a.tanggal_pinjam || "");
    });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        success: true,
        count: records.length,
        loans: records
      })
    );
  } catch (err) {
    console.error("[API Peminjaman Error]:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Terjadi kesalahan internal server saat mengambil data peminjaman.",
        detail: err.message
      })
    );
  }
}

// api/_routes/planner.ts
init_cookies();
init_crypto();
init_identity();
import { createClient as createClient14 } from "@supabase/supabase-js";
import crypto4 from "node:crypto";

// src/products/hub/kalender/kalenderService.ts
var MASEHI_MONTHS = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12
};
var HIJRI_MONTH_LIST = [
  "muharram",
  "shafar",
  "rabiul awal",
  "rabiul akhir",
  "jumadil awal",
  "jumadil akhir",
  "rajab",
  "sya'ban",
  "ramadhan",
  "syawal",
  "dzulqo'dah",
  "dzulhijjah"
];
function parsePlannerDbRow(row) {
  let deskripsi = String(row.catatan || "");
  let metaRecurrence = null;
  const match = deskripsi.match(/<!--\s*PTV_RECURRENCE:\s*(\{[\s\S]*?\})\s*-->/);
  if (match && match[1]) {
    try {
      metaRecurrence = JSON.parse(match[1]);
      deskripsi = deskripsi.replace(match[0], "").trim();
    } catch {
    }
  }
  const platformLower = String(row.platform || "").toLowerCase().trim();
  let recurrence_type = "sekali_tayang";
  let bulan_hijriah = void 0;
  let tanggal_hijriah = void 0;
  let bulan_masehi = void 0;
  let tanggal_masehi = void 0;
  let hari_pasaran = void 0;
  let hari_mingguan = void 0;
  let kategori = "Event Pondok";
  let subkategori = row.platform || "";
  let daftar_konten = [];
  let referensi_url = "";
  let recurrence_rule = void 0;
  if (metaRecurrence) {
    if (metaRecurrence.type) {
      recurrence_type = metaRecurrence.type;
      if (metaRecurrence.rule) {
        recurrence_rule = metaRecurrence.rule;
        if (metaRecurrence.rule.day) {
          if (recurrence_type === "tanggal_hijriah") {
            tanggal_hijriah = Number(metaRecurrence.rule.day);
          } else {
            tanggal_masehi = Number(metaRecurrence.rule.day);
          }
        }
        if (metaRecurrence.rule.month) {
          if (typeof metaRecurrence.rule.month === "number") {
            bulan_masehi = metaRecurrence.rule.month;
          } else {
            bulan_hijriah = String(metaRecurrence.rule.month);
          }
        }
        if (metaRecurrence.rule.pasaran) hari_pasaran = String(metaRecurrence.rule.pasaran);
        if (metaRecurrence.rule.dayOfWeek) hari_mingguan = String(metaRecurrence.rule.dayOfWeek);
      }
    } else {
      if (metaRecurrence.day && metaRecurrence.month) {
        recurrence_type = "tanggal_hijriah";
        tanggal_hijriah = Number(metaRecurrence.day);
        bulan_hijriah = String(metaRecurrence.month);
      } else if (metaRecurrence.month) {
        recurrence_type = "bulan_hijriah";
        bulan_hijriah = String(metaRecurrence.month);
      }
    }
    if (metaRecurrence.kategori) kategori = String(metaRecurrence.kategori);
    if (metaRecurrence.subkategori) subkategori = String(metaRecurrence.subkategori);
    if (Array.isArray(metaRecurrence.daftar_konten)) daftar_konten = metaRecurrence.daftar_konten;
    if (metaRecurrence.referensi_url) referensi_url = String(metaRecurrence.referensi_url);
    if (metaRecurrence.bulan_hijriah) bulan_hijriah = String(metaRecurrence.bulan_hijriah);
    if (metaRecurrence.tanggal_hijriah !== void 0 && metaRecurrence.tanggal_hijriah !== null) {
      tanggal_hijriah = Number(metaRecurrence.tanggal_hijriah);
    }
  }
  if (row.target_tayang) {
    const parts = row.target_tayang.split("-");
    if (parts.length === 3) {
      bulan_masehi = parseInt(parts[1], 10);
      tanggal_masehi = parseInt(parts[2], 10);
      if (!metaRecurrence || !metaRecurrence.type) {
        recurrence_type = "tanggal_masehi_tahunan";
        kategori = "Event Masehi";
      }
    }
  } else if (!metaRecurrence) {
    if (MASEHI_MONTHS[platformLower]) {
      bulan_masehi = MASEHI_MONTHS[platformLower];
      recurrence_type = "bulan_masehi";
      kategori = "Event Masehi";
    } else if (HIJRI_MONTH_LIST.some((hm) => platformLower.includes(hm))) {
      bulan_hijriah = row.platform;
      recurrence_type = "bulan_hijriah";
      kategori = "Event Hijriah";
    } else {
      kategori = "Event Pondok";
      recurrence_type = "fleksibel";
    }
  }
  if (bulan_hijriah && (!metaRecurrence || !metaRecurrence.kategori)) {
    kategori = "Event Hijriah";
  }
  if (recurrence_type === "bulan_hijriah" || recurrence_type === "bagian_bulan_hijriah") {
    tanggal_hijriah = null;
  }
  return {
    id: String(row.id || ""),
    judul_momentum: String(row.judul || ""),
    kategori,
    subkategori,
    deskripsi,
    daftar_konten,
    referensi_url,
    recurrence_type,
    recurrence_rule,
    bulan_hijriah,
    tanggal_hijriah,
    bulan_masehi,
    tanggal_masehi,
    hari_pasaran,
    hari_mingguan,
    tanggal_mulai: row.target_tayang || void 0,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}
var KalenderService = class {
  /**
   * Mengambil data momentum & content planner nyata dari Supabase Staging via serverless endpoint.
   * Kebijakan: Fail-closed — dilarang fallback diam-diam ke mock data jika terjadi error.
   */
  async getPlanners() {
    try {
      const res = await fetch("/api/planner", {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });
      if (!res.ok) {
        let errorMsg = `HTTP Error ${res.status}: Gagal memuat data momentum kalender.`;
        try {
          const errData = await res.json();
          if (errData?.error) {
            errorMsg = errData.error;
          }
        } catch {
        }
        throw new Error(errorMsg);
      }
      const contentType = res.headers?.get?.("content-type");
      if (contentType && !contentType.includes("application/json")) {
        throw new Error("Respon server bukan format JSON yang valid.");
      }
      const body = await res.json();
      if (!body.success || !Array.isArray(body.planners)) {
        throw new Error("Format respon API momentum tidak valid.");
      }
      return body.planners;
    } catch (err) {
      console.error("[KalenderService Error]:", err.message);
      throw err;
    }
  }
  /**
   * Menyimpan data momentum baru ke Supabase Staging.
   */
  async createPlanner(payload) {
    const res = await fetch("/api/planner", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      let errorMsg = "Gagal menyimpan momentum ide konten. Silakan coba lagi.";
      try {
        const errData = await res.json();
        if (errData?.error) errorMsg = errData.error;
      } catch (_err) {
        void _err;
      }
      throw new Error(errorMsg);
    }
    const data = await res.json();
    if (!data.success || !data.planner) {
      throw new Error(data?.error || "Gagal menyimpan momentum ide konten. Silakan coba lagi.");
    }
    return data.planner;
  }
  /**
   * Memperbarui data momentum di Supabase Staging.
   */
  async updatePlanner(id, payload) {
    const res = await fetch("/api/planner", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ id, ...payload })
    });
    if (!res.ok) {
      let errorMsg = "Gagal memperbarui momentum ide konten. Silakan coba lagi.";
      try {
        const errData = await res.json();
        if (errData?.error) errorMsg = errData.error;
      } catch (_err) {
        void _err;
      }
      throw new Error(errorMsg);
    }
    const data = await res.json();
    if (!data.success || !data.planner) {
      throw new Error(data?.error || "Gagal memperbarui momentum ide konten. Silakan coba lagi.");
    }
    return data.planner;
  }
  /**
   * Menghapus data momentum dari Supabase Staging.
   */
  async deletePlanner(id) {
    const res = await fetch("/api/planner", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ id })
    });
    if (!res.ok) {
      let errorMsg = "Gagal menghapus momentum ide konten. Silakan coba lagi.";
      try {
        const errData = await res.json();
        if (errData?.error) errorMsg = errData.error;
      } catch (_err) {
        void _err;
      }
      throw new Error(errorMsg);
    }
    const data = await res.json();
    if (!data.success) {
      throw new Error(data?.error || "Gagal menghapus momentum ide konten. Silakan coba lagi.");
    }
  }
  /**
   * Helper normalisasi row DB mentah ke interface ContentPlannerItem
   */
  mapDbRowToPlannerItem(row) {
    return parsePlannerDbRow(row);
  }
};
var kalenderService = new KalenderService();

// api/_routes/planner.ts
async function parseJsonBody6(req) {
  if (req.body) {
    if (typeof req.body === "object") return req.body;
    try {
      return JSON.parse(req.body);
    } catch {
      throw new Error("Format data JSON tidak valid.");
    }
  }
  if (typeof req.on !== "function") {
    return {};
  }
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Format data JSON tidak valid."));
      }
    });
    req.on("error", reject);
  });
}
var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function handler13(req, res) {
  res.setHeader("Content-Type", "application/json");
  const method = req.method || "GET";
  if (!["GET", "POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: `Metode HTTP ${method} tidak didukung.` }));
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  if (!sessionToken) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Autentikasi sesi login Hub diperlukan untuk mengakses data Kalender & Momentum.",
        code: "unauthorized"
      })
    );
    return;
  }
  const session = verifySessionToken(sessionToken, authSecret);
  if (!session || session.status_akun !== "active") {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Sesi tidak valid atau telah kedaluwarsa.",
        code: "invalid_session"
      })
    );
    return;
  }
  const userCaps = await refreshLiveSession(session);
  if (!userCaps.includes("hub.access")) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Sesi atau izin telah dicabut." }));
    return;
  }
  if (method === "GET") {
    const hasViewAccess = userCaps.includes("calendar.view") || userCaps.includes("events.view");
    if (!hasViewAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: "Akses ditolak: Akun Anda tidak memiliki izin untuk melihat modul Kalender & Momentum.",
          code: "forbidden"
        })
      );
      return;
    }
  } else {
    const hasWriteAccess = userCaps.includes("calendar.edit") || userCaps.includes("events.edit") || userCaps.includes("events.manage");
    if (!hasWriteAccess) {
      res.statusCode = 403;
      res.end(
        JSON.stringify({
          error: "Akses ditolak: Akun Anda tidak memiliki izin untuk menambah, mengedit, atau menghapus Content Planner.",
          code: "forbidden"
        })
      );
      return;
    }
  }
  const isStillActive = await verifyAccountStatusLive(session.account_id, session.iat, session);
  if (!isStillActive) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "Akses ditolak: Akun telah dinonaktifkan.",
        code: "account_inactive"
      })
    );
    return;
  }
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Konfigurasi backend database belum terdefinisi." }));
    return;
  }
  if (supabaseUrl.includes("jthzuhkblxcaohiuypqq")) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Anti-prod safety barrier: Database Production is STRICT READ-ONLY." }));
    return;
  }
  const supabase = createClient14(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const urlObj = new URL(req.url || "", `http://${req.headers.host || "localhost:5174"}`);
  try {
    if (method === "GET") {
      const { data, error } = await supabase.from("ptv_content_planner").select("id, judul, platform, status, target_tayang, pic_id, catatan, created_at, updated_at").order("created_at", { ascending: true });
      if (error) {
        console.error("[API Planner GET Error]:", error);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "Gagal mengambil data momentum dari database backend Staging." }));
        return;
      }
      const mappedPlanners = (data || []).map((row) => parsePlannerDbRow(row));
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, count: mappedPlanners.length, planners: mappedPlanners }));
      return;
    }
    let body = {};
    try {
      body = await parseJsonBody6(req);
    } catch (parseErr) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: parseErr.message || "Format JSON tidak valid." }));
      return;
    }
    if (method === "POST") {
      const judul = String(body.judul_momentum || body.judul || "").trim();
      if (!judul) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Judul momentum / acara konten wajib diisi." }));
        return;
      }
      const kategori = String(body.kategori || "Event Masehi").trim();
      const subkategori = body.subkategori ? String(body.subkategori).trim() : "";
      const platform = subkategori || body.bulan_hijriah || kategori;
      const targetTayang = body.tanggal_mulai ? String(body.tanggal_mulai).trim() : null;
      const recurrenceType = String(body.recurrence_type || "sekali_tayang").trim();
      const recurrenceRule = typeof body.recurrence_rule === "object" && body.recurrence_rule !== null ? body.recurrence_rule : {};
      const recMeta = {
        type: recurrenceType,
        rule: recurrenceRule,
        kategori,
        subkategori: subkategori || void 0,
        bulan_hijriah: body.bulan_hijriah || void 0,
        tanggal_hijriah: body.tanggal_hijriah !== null && body.tanggal_hijriah !== void 0 ? Number(body.tanggal_hijriah) : void 0,
        daftar_konten: Array.isArray(body.daftar_konten) ? body.daftar_konten.map((s) => String(s).trim()).filter(Boolean) : void 0,
        referensi_url: body.referensi_url ? String(body.referensi_url).trim() : void 0
      };
      const rawDeskripsi = String(body.deskripsi || "").replace(/<!--\s*PTV_RECURRENCE:[\s\S]*?-->/g, "").trim();
      const finalCatatan = `<!-- PTV_RECURRENCE: ${JSON.stringify(recMeta)} -->${rawDeskripsi ? "\n" + rawDeskripsi : ""}`;
      const newId = crypto4.randomUUID();
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const insertPayload = {
        id: newId,
        judul,
        platform,
        status: "draft",
        target_tayang: targetTayang,
        pic_id: null,
        catatan: finalCatatan,
        created_at: nowIso,
        updated_at: nowIso
      };
      const { data, error } = await supabase.from("ptv_content_planner").insert(insertPayload).select("*").single();
      if (error) {
        console.error("[API Planner POST Error]:", error);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gagal menyimpan momentum ke Supabase Staging: ${error.message}` }));
        return;
      }
      const createdItem = parsePlannerDbRow(data);
      res.statusCode = 201;
      res.end(
        JSON.stringify({
          success: true,
          message: "Data Content Planner berhasil disimpan ke Supabase Staging.",
          planner: createdItem
        })
      );
      return;
    }
    if (method === "PATCH" || method === "PUT") {
      const id = String(body.id || urlObj.searchParams.get("id") || "").trim();
      if (!id || !UUID_REGEX.test(id)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "ID momentum valid (UUID) wajib disertakan untuk pembaruan." }));
        return;
      }
      const { data: existing, error: findError } = await supabase.from("ptv_content_planner").select("*").eq("id", id).single();
      if (findError || !existing) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Data momentum tidak ditemukan di database backend Staging." }));
        return;
      }
      const updateFields = {
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (body.judul_momentum !== void 0 || body.judul !== void 0) {
        const j = String(body.judul_momentum || body.judul || "").trim();
        if (!j) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Judul momentum tidak boleh kosong." }));
          return;
        }
        updateFields.judul = j;
      }
      if (body.subkategori !== void 0 || body.kategori !== void 0 || body.bulan_hijriah !== void 0) {
        const sub = body.subkategori !== void 0 ? String(body.subkategori).trim() : "";
        const kat = body.kategori !== void 0 ? String(body.kategori).trim() : "";
        const bh = body.bulan_hijriah !== void 0 ? String(body.bulan_hijriah).trim() : "";
        updateFields.platform = sub || bh || kat || existing.platform;
      }
      if (body.tanggal_mulai !== void 0) {
        updateFields.target_tayang = body.tanggal_mulai ? String(body.tanggal_mulai).trim() : null;
      }
      let existingRecMeta = {};
      let existingDesc = String(existing.catatan || "");
      const match = existingDesc.match(/<!--\s*PTV_RECURRENCE:\s*(\{[\s\S]*?\})\s*-->/);
      if (match && match[1]) {
        try {
          existingRecMeta = JSON.parse(match[1]);
          existingDesc = existingDesc.replace(match[0], "").trim();
        } catch (_err) {
          void _err;
        }
      }
      const updatedRecMeta = {
        ...existingRecMeta,
        type: body.recurrence_type !== void 0 ? String(body.recurrence_type).trim() : existingRecMeta.type,
        rule: body.recurrence_rule !== void 0 ? body.recurrence_rule : existingRecMeta.rule,
        kategori: body.kategori !== void 0 ? String(body.kategori).trim() : existingRecMeta.kategori,
        subkategori: body.subkategori !== void 0 ? String(body.subkategori).trim() : existingRecMeta.subkategori,
        bulan_hijriah: body.bulan_hijriah !== void 0 ? body.bulan_hijriah : existingRecMeta.bulan_hijriah,
        tanggal_hijriah: body.tanggal_hijriah !== void 0 ? body.tanggal_hijriah : existingRecMeta.tanggal_hijriah,
        daftar_konten: body.daftar_konten !== void 0 ? Array.isArray(body.daftar_konten) ? body.daftar_konten.map((s) => String(s).trim()).filter(Boolean) : [] : existingRecMeta.daftar_konten,
        referensi_url: body.referensi_url !== void 0 ? String(body.referensi_url).trim() : existingRecMeta.referensi_url
      };
      const finalDeskripsi = body.deskripsi !== void 0 ? String(body.deskripsi).replace(/<!--\s*PTV_RECURRENCE:[\s\S]*?-->/g, "").trim() : existingDesc;
      updateFields.catatan = `<!-- PTV_RECURRENCE: ${JSON.stringify(updatedRecMeta)} -->${finalDeskripsi ? "\n" + finalDeskripsi : ""}`;
      const { data: updated, error: updateError } = await supabase.from("ptv_content_planner").update(updateFields).eq("id", id).select("*").single();
      if (updateError) {
        console.error("[API Planner PATCH Error]:", updateError);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gagal memperbarui momentum di Supabase: ${updateError.message}` }));
        return;
      }
      const updatedItem = parsePlannerDbRow(updated);
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: "Data Content Planner berhasil diperbarui di Supabase Staging.",
          planner: updatedItem
        })
      );
      return;
    }
    if (method === "DELETE") {
      const id = String(body.id || urlObj.searchParams.get("id") || "").trim();
      if (!id || !UUID_REGEX.test(id)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "ID momentum valid (UUID) wajib disertakan untuk penghapusan." }));
        return;
      }
      const { data: existing, error: findError } = await supabase.from("ptv_content_planner").select("id, judul").eq("id", id).single();
      if (findError || !existing) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Data momentum yang akan dihapus tidak ditemukan di Staging." }));
        return;
      }
      const { error: deleteError } = await supabase.from("ptv_content_planner").delete().eq("id", id);
      if (deleteError) {
        console.error("[API Planner DELETE Error]:", deleteError);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gagal menghapus momentum dari Supabase Staging: ${deleteError.message}` }));
        return;
      }
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: "Data Content Planner berhasil dihapus dari Supabase Staging.",
          id
        })
      );
      return;
    }
  } catch (err) {
    console.error("[API Planner Unhandled Error]:", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Terjadi kesalahan internal server saat memproses data momentum." }));
  }
}

// api/_routes/portal.ts
init_cookies();
init_crypto();
init_identity();
import { randomUUID as randomUUID5 } from "node:crypto";
import { createClient as createClient15 } from "@supabase/supabase-js";
function parseJsonBody7(req) {
  if (req.body) {
    if (typeof req.body === "object") return Promise.resolve(req.body);
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.reject(new Error("Format data JSON tidak valid."));
    }
  }
  if (typeof req.on !== "function") {
    return Promise.resolve({});
  }
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Payload melebihi batas ukuran 2MB."));
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Format data JSON tidak valid."));
      }
    });
    req.on("error", reject);
  });
}
var PORTAL_SERVER_TIMEOUT_MS = 8e3;
function getSupabase(signal) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase configuration missing");
  }
  return createClient15(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal
      })
    }
  });
}
async function handler14(req, res) {
  const controller = new AbortController();
  const isReadRequest = (req.method || "GET") === "GET";
  const timer = isReadRequest ? setTimeout(() => controller.abort(), PORTAL_SERVER_TIMEOUT_MS) : void 0;
  const onClose = () => {
    if (isReadRequest && !res.writableEnded) controller.abort();
  };
  res.on?.("close", onClose);
  try {
    await handlePortal(req, res, controller.signal);
  } catch {
    if (!res.writableEnded && !res.destroyed) {
      res.statusCode = controller.signal.aborted ? 504 : 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: controller.signal.aborted ? "Permintaan portal melewati batas waktu." : "Gagal memproses data portal.",
        code: controller.signal.aborted ? "portal_timeout" : "portal_server_error"
      }));
    }
  } finally {
    clearTimeout(timer);
    res.off?.("close", onClose);
  }
}
async function handlePortal(req, res, signal) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const method = req.method || "GET";
  const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost:5174"}`);
  const entity = urlObj.searchParams.get("entity") || "all";
  const includeDraftParam = urlObj.searchParams.get("includeDraft") === "true";
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  let session = null;
  let userCaps = [];
  const needsSession = method !== "GET" || includeDraftParam || entity === "audit_logs";
  if (needsSession && sessionToken && authSecret) {
    const verified = verifySessionToken(sessionToken, authSecret);
    if (verified) {
      session = verified;
      try {
        const active = await verifyAccountStatusLive(session.account_id, session.iat, session);
        if (active) {
          userCaps = await refreshLiveSession(session);
        } else {
          session = null;
        }
      } catch {
        session = null;
      }
    }
  }
  const isAuthenticated = Boolean(session && userCaps.includes("hub.access"));
  const canManagePortal = isAuthenticated && (userCaps.includes("portal.manage") || userCaps.includes("system.manage") || userCaps.includes("admin") || userCaps.includes("role:eksekutif") || userCaps.includes("role:administrasi") || userCaps.includes("role:developer") || userCaps.includes("role:pengelola") || userCaps.includes("hub.access"));
  const supabase = getSupabase(signal);
  if (method === "GET") {
    try {
      const includeDraft = includeDraftParam && canManagePortal;
      const result = { success: true };
      if (entity === "services" || entity === "all") {
        let servicesQuery = supabase.from("ptv_portal_services").select("*").order("sort_order", { ascending: true });
        if (!includeDraft) {
          servicesQuery = servicesQuery.eq("is_active", true).eq("is_published", true).eq("is_public", true);
        }
        const { data: dbServices, error: sErr } = await servicesQuery;
        if (sErr) throw sErr;
        let services = (dbServices || []).map((row) => {
          const base = {
            id: row.id,
            name: { id: row.name_id, en: row.name_en || row.name_id },
            desc: { id: row.desc_id, en: row.desc_en || row.desc_id },
            cat: row.cat,
            href: row.href,
            icon: row.icon,
            st: row.status,
            statusNote: row.status_note || void 0,
            statusUpdatedAt: row.status_updated_at || row.updated_at,
            pub: row.is_public ? 1 : 0,
            isSeasonal: Boolean(row.is_seasonal),
            seasonalStart: row.seasonal_start || void 0,
            seasonalEnd: row.seasonal_end || void 0,
            sortOrder: row.sort_order || 0,
            isActive: Boolean(row.is_active),
            isPublished: Boolean(row.is_published),
            hasDraft: includeDraft && Boolean(row.draft_payload),
            draftPayload: includeDraft ? row.draft_payload || void 0 : void 0,
            updatedAt: row.updated_at,
            updatedBy: row.updated_by
          };
          if (includeDraft && base.hasDraft && base.draftPayload) {
            return {
              ...base,
              ...base.draftPayload,
              hasDraft: true,
              draftPayload: base.draftPayload
            };
          }
          return base;
        });
        services.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        if (!includeDraft) {
          services = services.filter((s) => s.isActive && s.isPublished && s.pub === 1);
        }
        result.services = services;
        if (entity === "services") {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, services }));
          return;
        }
      }
      if (entity === "announcements" || entity === "all") {
        let dbAnnouncements = [];
        try {
          const { data, error: aErr } = await supabase.from("ptv_portal_announcements").select("*").order("created_at", { ascending: false });
          if (aErr) {
            if (aErr.code === "PGRST205" || aErr.code === "42P01" || aErr.message?.includes("schema cache") || aErr.message?.includes("does not exist")) {
              dbAnnouncements = [];
            } else {
              throw aErr;
            }
          } else {
            dbAnnouncements = data || [];
          }
        } catch (err) {
          if (err.code === "PGRST205" || err.code === "42P01" || err.message?.includes("schema cache") || err.message?.includes("does not exist")) {
            dbAnnouncements = [];
          } else {
            throw err;
          }
        }
        let announcements = (dbAnnouncements || []).map((row) => {
          const base = {
            id: row.id,
            title: { id: row.title_id, en: row.title_en || row.title_id },
            body: { id: row.body_id, en: row.body_en || row.body_id },
            ctaText: { id: row.cta_text_id || "Lihat Layanan", en: row.cta_text_en || "View Services" },
            ctaHref: row.cta_href || "#direktori-layanan",
            format: row.format || "text",
            posterSrc: row.poster_src || void 0,
            type: row.type || "info",
            priority: row.priority || 1,
            startDate: row.start_date || void 0,
            endDate: row.end_date || void 0,
            isActive: Boolean(row.is_active),
            isPublished: Boolean(row.is_published),
            hasDraft: includeDraft && Boolean(row.draft_payload),
            draftPayload: includeDraft ? row.draft_payload || void 0 : void 0,
            updatedAt: row.updated_at,
            updatedBy: row.updated_by
          };
          if (includeDraft && base.hasDraft && base.draftPayload) {
            return {
              ...base,
              ...base.draftPayload,
              hasDraft: true,
              draftPayload: base.draftPayload
            };
          }
          return base;
        });
        if (!includeDraft) {
          const nowStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          announcements = announcements.filter((a) => {
            if (!a.isActive || !a.isPublished) return false;
            if (a.startDate && a.startDate > nowStr) return false;
            if (a.endDate && a.endDate < nowStr) return false;
            return true;
          });
        }
        result.announcements = announcements;
        if (entity === "announcements") {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, announcements }));
          return;
        }
      }
      if (entity === "settings" || entity === "all") {
        const { data: dbSettings, error: setErr } = await supabase.from("ptv_portal_settings").select("*").eq("id", "global").maybeSingle();
        if (setErr) throw setErr;
        if (!dbSettings || !includeDraft && !dbSettings.is_published) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: "Konfigurasi portal published belum tersedia.", code: "portal_settings_unavailable" }));
          return;
        }
        let settings = {
          id: dbSettings.id,
          heroTitle: {
            line1: dbSettings.hero_title_1,
            line2: dbSettings.hero_title_2
          },
          heroDesc: dbSettings.hero_desc,
          helpWaNumber: dbSettings.help_wa_number,
          footerSignature: dbSettings.footer_signature,
          footerCopyright: dbSettings.footer_copyright,
          isPublished: Boolean(dbSettings.is_published),
          hasDraft: includeDraft && Boolean(dbSettings.draft_payload),
          draftPayload: includeDraft ? dbSettings.draft_payload || void 0 : void 0,
          updatedAt: dbSettings.updated_at,
          updatedBy: dbSettings.updated_by
        };
        if (includeDraft && settings.hasDraft && settings.draftPayload) {
          settings = {
            ...settings,
            ...settings.draftPayload,
            hasDraft: true,
            draftPayload: settings.draftPayload
          };
        }
        result.settings = settings;
        if (entity === "settings") {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, settings }));
          return;
        }
      }
      if (entity === "audit_logs") {
        if (!canManagePortal) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Akses ditolak: Izin pengelola portal diperlukan.", code: "forbidden" }));
          return;
        }
        const { data: dbLogs, error: logErr } = await supabase.from("ptv_portal_audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
        if (logErr) throw logErr;
        const auditLogs = (dbLogs || []).map((l) => ({
          id: l.id,
          userId: l.user_id,
          userName: l.user_name,
          action: l.action,
          entityType: l.entity_type,
          entityId: l.entity_id,
          details: l.details,
          timestamp: l.created_at
        }));
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, auditLogs }));
        return;
      }
      res.statusCode = 200;
      res.end(JSON.stringify(result));
    } catch (err) {
      if (res.destroyed || res.writableEnded) return;
      res.statusCode = signal.aborted ? 504 : 500;
      res.end(JSON.stringify({
        error: signal.aborted ? "Permintaan portal melewati batas waktu." : "Gagal memuat data portal.",
        code: signal.aborted ? "portal_timeout" : "portal_fetch_error"
      }));
    }
    return;
  }
  if (method === "POST") {
    if (!canManagePortal) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: "Akses ditolak: Izin pengelola portal diperlukan untuk mengubah data.", code: "forbidden" }));
      return;
    }
    try {
      const body = await parseJsonBody7(req);
      const action = body.action || urlObj.searchParams.get("action");
      const actorName = session?.full_name || session?.username || "Operator Hub";
      const actorId = session?.account_id || "system";
      const logAudit = async (act, entType, entId, details) => {
        try {
          await supabase.from("ptv_portal_audit_logs").insert({
            id: `log-${Date.now()}-${randomUUID5().slice(0, 6)}`,
            user_id: actorId,
            user_name: actorName,
            action: act,
            entity_type: entType,
            entity_id: entId,
            details,
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          });
        } catch {
        }
      };
      if (action === "save_service") {
        const { service, asDraft } = body;
        if (!service || !service.id) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Data layanan dan ID wajib diisi.", code: "missing_service" }));
          return;
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        let payload = {
          updated_at: now,
          updated_by: actorName
        };
        payload.id = service.id;
        if (asDraft) {
          const { data: existingRow } = await supabase.from("ptv_portal_services").select("*").eq("id", service.id).maybeSingle();
          const currentDraft = existingRow?.draft_payload || {};
          payload.draft_payload = {
            ...currentDraft,
            ...service
          };
        } else {
          payload = {
            id: service.id,
            name_id: service.name?.id || service.name_id || "Layanan Baru",
            name_en: service.name?.en || service.name_en || null,
            desc_id: service.desc?.id || service.desc_id || "Deskripsi",
            desc_en: service.desc?.en || service.desc_en || null,
            cat: service.cat || "public",
            href: service.href || "/hub",
            icon: service.icon || "globe",
            status: service.st || service.status || "ok",
            status_note: service.statusNote || service.status_note || null,
            status_updated_at: service.statusUpdatedAt || now,
            is_public: service.pub !== void 0 ? service.pub === 1 : service.is_public ?? true,
            is_seasonal: Boolean(service.isSeasonal ?? service.is_seasonal),
            seasonal_start: service.seasonalStart || service.seasonal_start || null,
            seasonal_end: service.seasonalEnd || service.seasonal_end || null,
            sort_order: service.sortOrder ?? service.sort_order ?? 0,
            is_active: service.isActive ?? service.is_active ?? true,
            is_published: true,
            draft_payload: null,
            updated_at: now,
            updated_by: actorName
          };
        }
        const { error: upsertErr } = await supabase.from("ptv_portal_services").upsert(payload, { onConflict: "id" });
        if (upsertErr) throw upsertErr;
        await logAudit(
          asDraft ? "save_draft" : "publish",
          "service",
          service.id,
          asDraft ? "Menyimpan draft perubahan layanan" : "Memperbarui dan memublikasikan layanan langsung"
        );
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: "Layanan berhasil disimpan." }));
        return;
      }
      if (action === "publish_service") {
        const { serviceId } = body;
        if (!serviceId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "serviceId wajib diisi.", code: "missing_id" }));
          return;
        }
        const { data: existing, error: getErr } = await supabase.from("ptv_portal_services").select("*").eq("id", serviceId).single();
        if (getErr || !existing) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Layanan tidak ditemukan.", code: "not_found" }));
          return;
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const draft = existing.draft_payload || {};
        const updateData = {
          is_published: true,
          draft_payload: null,
          updated_at: now,
          updated_by: actorName
        };
        if (draft.name) {
          updateData.name_id = draft.name.id || updateData.name_id;
          updateData.name_en = draft.name.en || updateData.name_en;
        }
        if (draft.desc) {
          updateData.desc_id = draft.desc.id || updateData.desc_id;
          updateData.desc_en = draft.desc.en || updateData.desc_en;
        }
        if (draft.cat) updateData.cat = draft.cat;
        if (draft.href) updateData.href = draft.href;
        if (draft.icon) updateData.icon = draft.icon;
        if (draft.st) updateData.status = draft.st;
        if (draft.statusNote !== void 0) updateData.status_note = draft.statusNote;
        if (draft.pub !== void 0) updateData.is_public = draft.pub === 1;
        if (draft.isSeasonal !== void 0) updateData.is_seasonal = Boolean(draft.isSeasonal);
        if (draft.seasonalStart !== void 0) updateData.seasonal_start = draft.seasonalStart;
        if (draft.seasonalEnd !== void 0) updateData.seasonal_end = draft.seasonalEnd;
        if (draft.sortOrder !== void 0) updateData.sort_order = draft.sortOrder;
        if (draft.isActive !== void 0) updateData.is_active = Boolean(draft.isActive);
        const { error: updErr } = await supabase.from("ptv_portal_services").update(updateData).eq("id", serviceId);
        if (updErr) throw updErr;
        await logAudit("publish", "service", serviceId, "Memublikasikan draft perubahan layanan");
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: "Draft layanan berhasil dipublikasikan." }));
        return;
      }
      if (action === "update_service_status") {
        const { serviceId, status, statusNote, asDraft = true } = body;
        if (!serviceId || !status) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "serviceId dan status wajib diisi.", code: "missing_params" }));
          return;
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        if (asDraft) {
          const { data: existing } = await supabase.from("ptv_portal_services").select("*").eq("id", serviceId).maybeSingle();
          if (existing) {
            const draft = existing.draft_payload || {
              name: { id: existing.name_id, en: existing.name_en },
              desc: { id: existing.desc_id, en: existing.desc_en },
              cat: existing.cat,
              href: existing.href,
              icon: existing.icon,
              st: existing.status,
              statusNote: existing.status_note,
              pub: existing.is_public ? 1 : 0,
              isActive: existing.is_active,
              sortOrder: existing.sort_order
            };
            draft.st = status;
            draft.statusNote = statusNote || null;
            draft.statusUpdatedAt = now;
            await supabase.from("ptv_portal_services").update({ draft_payload: draft, updated_at: now }).eq("id", serviceId);
          }
        } else {
          const { error: stErr } = await supabase.from("ptv_portal_services").update({
            status,
            status_note: statusNote || null,
            status_updated_at: now,
            updated_at: now,
            updated_by: actorName
          }).eq("id", serviceId);
          if (stErr) throw stErr;
        }
        await logAudit(
          asDraft ? "save_draft" : "status_change",
          "service",
          serviceId,
          asDraft ? `Menyimpan draft status "${status}" ${statusNote ? `(${statusNote})` : ""}` : `Mengubah status menjadi "${status}" ${statusNote ? `(${statusNote})` : ""}`
        );
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: asDraft ? "Draft status layanan berhasil disimpan." : "Status operasional layanan berhasil diperbarui." }));
        return;
      }
      if (action === "reorder_services") {
        const { orderList, asDraft = true } = body;
        if (!Array.isArray(orderList)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "orderList array wajib diisi.", code: "missing_order_list" }));
          return;
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        for (const item of orderList) {
          if (item.id && typeof item.sortOrder === "number") {
            if (asDraft) {
              const { data: existing } = await supabase.from("ptv_portal_services").select("*").eq("id", item.id).maybeSingle();
              if (existing) {
                const isDifferentOrder = item.sortOrder !== existing.sort_order;
                const hasExistingDraft = Boolean(existing.draft_payload);
                if (!isDifferentOrder && !hasExistingDraft) {
                  continue;
                }
                const draft = existing.draft_payload || {
                  name: { id: existing.name_id, en: existing.name_en },
                  desc: { id: existing.desc_id, en: existing.desc_en },
                  cat: existing.cat,
                  href: existing.href,
                  icon: existing.icon,
                  st: existing.status,
                  statusNote: existing.status_note,
                  pub: existing.is_public ? 1 : 0,
                  isActive: existing.is_active
                };
                draft.sortOrder = item.sortOrder;
                const hasOtherChanges = draft.name?.id !== void 0 && draft.name.id !== existing.name_id || draft.desc?.id !== void 0 && draft.desc.id !== existing.desc_id || draft.cat !== void 0 && draft.cat !== existing.cat || draft.href !== void 0 && draft.href !== existing.href || draft.icon !== void 0 && draft.icon !== existing.icon || draft.st !== void 0 && draft.st !== existing.status || draft.pub !== void 0 && draft.pub === 1 !== Boolean(existing.is_public) || draft.isActive !== void 0 && Boolean(draft.isActive) !== Boolean(existing.is_active);
                if (!isDifferentOrder && !hasOtherChanges) {
                  await supabase.from("ptv_portal_services").update({ draft_payload: null, updated_at: now }).eq("id", item.id);
                } else {
                  await supabase.from("ptv_portal_services").update({ draft_payload: draft, updated_at: now }).eq("id", item.id);
                }
              }
            } else {
              await supabase.from("ptv_portal_services").update({ sort_order: item.sortOrder, updated_at: now }).eq("id", item.id);
            }
          }
        }
        await logAudit(
          asDraft ? "save_draft" : "reorder",
          "service",
          "all",
          asDraft ? "Menyimpan draft urutan layanan" : "Mengubah urutan direktori layanan"
        );
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: asDraft ? "Draft urutan layanan berhasil disimpan." : "Urutan layanan berhasil disimpan." }));
        return;
      }
      if (action === "delete_service") {
        const { serviceId } = body;
        if (!serviceId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "serviceId wajib diisi.", code: "missing_id" }));
          return;
        }
        const { error: delErr } = await supabase.from("ptv_portal_services").delete().eq("id", serviceId);
        if (delErr) throw delErr;
        await logAudit("delete", "service", serviceId, `Menghapus layanan ${serviceId}`);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: "Layanan berhasil dihapus." }));
        return;
      }
      if (action === "save_announcement") {
        const { announcement, asDraft } = body;
        if (!announcement) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Data pengumuman wajib diisi.", code: "missing_announcement" }));
          return;
        }
        const id = announcement.id || `ann-${Date.now()}`;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        let payload = {
          id,
          updated_at: now,
          updated_by: actorName
        };
        if (asDraft) {
          payload.draft_payload = announcement;
          payload.title_id = announcement.title?.id || "Draft Pengumuman";
          payload.body_id = announcement.body?.id || "";
          payload.is_published = false;
        } else {
          if (announcement.isActive ?? true) {
            await supabase.from("ptv_portal_announcements").update({ is_active: false, updated_at: now }).neq("id", id).eq("is_active", true).eq("is_published", true);
          }
          payload = {
            id,
            title_id: announcement.title?.id || "Pengumuman Portal",
            title_en: announcement.title?.en || null,
            body_id: announcement.body?.id || "",
            body_en: announcement.body?.en || null,
            cta_text_id: announcement.ctaText?.id || "Lihat Layanan",
            cta_text_en: announcement.ctaText?.en || "View Services",
            cta_href: announcement.ctaHref || "#direktori-layanan",
            format: announcement.format || "text",
            poster_src: announcement.posterSrc || null,
            type: announcement.type || "info",
            priority: announcement.priority || 1,
            start_date: announcement.startDate || now.slice(0, 10),
            end_date: announcement.endDate || null,
            is_active: announcement.isActive ?? true,
            is_published: true,
            draft_payload: null,
            updated_at: now,
            updated_by: actorName
          };
        }
        const { error: aErr } = await supabase.from("ptv_portal_announcements").upsert(payload, { onConflict: "id" });
        if (aErr) throw aErr;
        await logAudit(
          asDraft ? "save_draft" : "publish",
          "announcement",
          id,
          asDraft ? "Menyimpan draft pengumuman portal" : "Menerbitkan pengumuman portal"
        );
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: "Pengumuman portal berhasil disimpan.", id }));
        return;
      }
      if (action === "publish_announcement") {
        const { id } = body;
        if (!id) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "id pengumuman wajib diisi.", code: "missing_id" }));
          return;
        }
        const { data: existing, error: getErr } = await supabase.from("ptv_portal_announcements").select("*").eq("id", id).single();
        if (getErr || !existing) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Pengumuman tidak ditemukan.", code: "not_found" }));
          return;
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const draft = existing.draft_payload || {};
        await supabase.from("ptv_portal_announcements").update({ is_active: false, updated_at: now }).neq("id", id).eq("is_active", true).eq("is_published", true);
        const updateData = {
          is_active: true,
          is_published: true,
          draft_payload: null,
          updated_at: now,
          updated_by: actorName
        };
        if (draft.title) {
          updateData.title_id = draft.title.id || updateData.title_id;
          updateData.title_en = draft.title.en || updateData.title_en;
        }
        if (draft.body) {
          updateData.body_id = draft.body.id || updateData.body_id;
          updateData.body_en = draft.body.en || updateData.body_en;
        }
        if (draft.ctaText) {
          updateData.cta_text_id = draft.ctaText.id;
          updateData.cta_text_en = draft.ctaText.en;
        }
        if (draft.ctaHref) updateData.cta_href = draft.ctaHref;
        if (draft.format) updateData.format = draft.format;
        if (draft.posterSrc !== void 0) updateData.poster_src = draft.posterSrc;
        if (draft.type) updateData.type = draft.type;
        if (draft.startDate) updateData.start_date = draft.startDate;
        if (draft.endDate !== void 0) updateData.end_date = draft.endDate;
        const { error: updErr } = await supabase.from("ptv_portal_announcements").update(updateData).eq("id", id);
        if (updErr) throw updErr;
        await logAudit("publish", "announcement", id, "Memublikasikan pengumuman portal (maksimal 1 aktif)");
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: "Pengumuman portal berhasil dipublikasikan." }));
        return;
      }
      if (action === "delete_announcement") {
        const { id } = body;
        if (!id) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "id pengumuman wajib diisi.", code: "missing_id" }));
          return;
        }
        const { error: delErr } = await supabase.from("ptv_portal_announcements").delete().eq("id", id);
        if (delErr) throw delErr;
        await logAudit("delete", "announcement", id, `Menghapus pengumuman portal ${id}`);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: "Pengumuman berhasil dihapus." }));
        return;
      }
      if (action === "save_settings") {
        const { settings, asDraft } = body;
        if (!settings) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "settings wajib diisi.", code: "missing_settings" }));
          return;
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        let payload = {
          id: "global",
          updated_at: now,
          updated_by: actorName
        };
        if (asDraft) {
          const { data: existingSet } = await supabase.from("ptv_portal_settings").select("*").eq("id", "global").maybeSingle();
          const currentDraft = existingSet?.draft_payload || {};
          payload.draft_payload = {
            ...currentDraft,
            ...settings
          };
        } else {
          payload = {
            id: "global",
            hero_title_1: settings.heroTitle?.line1 || "Semua layanan.",
            hero_title_2: settings.heroTitle?.line2 || "Satu tempat.",
            hero_desc: settings.heroDesc || "Pintu akses resmi ekosistem digital keluarga yayasan dan Progresif TV.",
            help_wa_number: settings.helpWaNumber || "62895325884964",
            footer_signature: settings.footerSignature || "Dibangun oleh santri. Didedikasikan untuk sesama.",
            footer_copyright: settings.footerCopyright || "\xA9 2026 Progresif TV Production.",
            is_published: true,
            draft_payload: null,
            updated_at: now,
            updated_by: actorName
          };
        }
        const { error: setErr } = await supabase.from("ptv_portal_settings").upsert(payload, { onConflict: "id" });
        if (setErr) throw setErr;
        await logAudit(
          asDraft ? "save_draft" : "publish",
          "settings",
          "global",
          asDraft ? "Menyimpan draft pengaturan portal" : "Memperbarui pengaturan portal langsung"
        );
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, message: "Pengaturan portal berhasil disimpan." }));
        return;
      }
      if (action === "publish_all_drafts") {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        let count = 0;
        const { data: svcDrafts } = await supabase.from("ptv_portal_services").select("*").not("draft_payload", "is", null);
        if (Array.isArray(svcDrafts)) {
          for (const s of svcDrafts) {
            const draft = s.draft_payload || {};
            const updateData = {
              is_published: true,
              draft_payload: null,
              updated_at: now,
              updated_by: actorName
            };
            if (draft.name) {
              updateData.name_id = draft.name.id || updateData.name_id;
              updateData.name_en = draft.name.en || updateData.name_en;
            }
            if (draft.desc) {
              updateData.desc_id = draft.desc.id || updateData.desc_id;
              updateData.desc_en = draft.desc.en || updateData.desc_en;
            }
            if (draft.cat) updateData.cat = draft.cat;
            if (draft.href) updateData.href = draft.href;
            if (draft.icon) updateData.icon = draft.icon;
            if (draft.st) updateData.status = draft.st;
            if (draft.statusNote !== void 0) updateData.status_note = draft.statusNote;
            if (draft.pub !== void 0) updateData.is_public = draft.pub === 1;
            if (draft.sortOrder !== void 0) updateData.sort_order = draft.sortOrder;
            await supabase.from("ptv_portal_services").update(updateData).eq("id", s.id);
            count++;
          }
        }
        const { data: setRow } = await supabase.from("ptv_portal_settings").select("*").eq("id", "global").maybeSingle();
        if (setRow && setRow.draft_payload) {
          const draft = setRow.draft_payload;
          await supabase.from("ptv_portal_settings").update({
            hero_title_1: draft.heroTitle?.line1 || setRow.hero_title_1,
            hero_title_2: draft.heroTitle?.line2 || setRow.hero_title_2,
            hero_desc: draft.heroDesc || setRow.hero_desc,
            help_wa_number: draft.helpWaNumber || setRow.help_wa_number,
            footer_signature: draft.footerSignature || setRow.footer_signature,
            footer_copyright: draft.footerCopyright || setRow.footer_copyright,
            is_published: true,
            draft_payload: null,
            updated_at: now,
            updated_by: actorName
          }).eq("id", "global");
          count++;
        }
        await logAudit("publish", "settings", "all", `Memublikasikan seluruh draft (${count} item)`);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, publishedCount: count, message: `${count} draft berhasil dipublikasikan.` }));
        return;
      }
      res.statusCode = 400;
      res.end(JSON.stringify({ error: `Aksi "${action}" tidak dikenali.`, code: "unknown_action" }));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message || "Gagal memproses aksi portal.", code: "portal_mutation_error" }));
    }
    return;
  }
  res.statusCode = 405;
  res.end(JSON.stringify({ error: `Metode ${method} tidak didukung.`, code: "method_not_allowed" }));
}

// api/_routes/portofolio.ts
init_cookies();
init_crypto();
import { createClient as createClient16 } from "@supabase/supabase-js";
async function handler15(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "Database portofolio belum tersedia.", code: "service_unavailable" }));
    return;
  }
  const supabase = createClient16(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  let sessionUser = null;
  if (sessionToken) {
    try {
      sessionUser = verifySessionToken(sessionToken, authSecret);
    } catch {
    }
  }
  const queryParams = new URL(req.url || "/", "http://localhost").searchParams;
  const targetPtvId = queryParams.get("ptv_id")?.trim();
  const isMine = queryParams.get("mine") === "true";
  if (req.method === "GET") {
    let effectivePtvId = targetPtvId;
    if (isMine) {
      if (!sessionUser) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: "Sesi login kru diperlukan.", code: "unauthorized" }));
        return;
      }
      effectivePtvId = sessionUser.ptv_id || sessionUser.username;
    }
    if (!effectivePtvId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Parameter ptv_id atau mine=true wajib diisi.", code: "missing_ptv_id" }));
      return;
    }
    try {
      const { data: dbItems, error: dbErr } = await supabase.from("ptv_kru_portofolio").select("*").eq("ptv_id", effectivePtvId).order("tanggal", { ascending: false });
      if (!dbErr && dbItems) {
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, items: dbItems }));
        return;
      }
      const { data: canonData } = await supabase.from("canonical_identity").select("id, ptv_id, metadata").eq("ptv_id", effectivePtvId).maybeSingle();
      const metaPortfolio = canonData?.metadata?.portofolio || [];
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, items: metaPortfolio }));
      return;
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message || "Gagal mengambil portofolio.", code: "server_error" }));
      return;
    }
  }
  if (req.method === "POST") {
    if (!sessionUser) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: "Sesi kru aktif diperlukan untuk mengelola portofolio.", code: "unauthorized" }));
      return;
    }
    let body;
    if (req.body !== void 0 && typeof req.body === "object") {
      body = req.body;
    } else {
      let rawBody = "";
      for await (const chunk of req) {
        rawBody += chunk;
        if (rawBody.length > 65536) {
          res.statusCode = 413;
          res.end(JSON.stringify({ error: "Payload terlalu besar.", code: "payload_too_large" }));
          return;
        }
      }
      try {
        body = JSON.parse(rawBody);
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Body JSON tidak valid.", code: "invalid_json" }));
        return;
      }
    }
    const effectivePtvId = sessionUser.ptv_id || sessionUser.username;
    if (!effectivePtvId) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: "Identitas kru belum memiliki PTV-ID terdaftar.", code: "missing_ptv_id" }));
      return;
    }
    const judul = String(body.judul || "").trim();
    const platform = String(body.platform || "Instagram").trim();
    const jenisKontribusi = String(body.jenis_kontribusi || "Kamera").trim();
    const tanggal = String(body.tanggal || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]).trim();
    const linkKarya = body.link_karya ? String(body.link_karya).trim() : null;
    const itemId = body.id || `pf_${Date.now()}_${safeRandomUuid().substring(0, 8)}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    if (!judul || judul.length < 3) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Judul atau deskripsi pekerjaan wajib diisi (minimal 3 karakter).", code: "invalid_judul" }));
      return;
    }
    const itemPayload = {
      id: itemId,
      ptv_id: effectivePtvId,
      tanggal,
      platform,
      jenis_kontribusi: jenisKontribusi,
      judul,
      link_karya: linkKarya || void 0,
      updated_at: nowIso
    };
    try {
      const { data: canon } = await supabase.from("canonical_identity").select("id, metadata").eq("ptv_id", effectivePtvId).maybeSingle();
      if (canon?.id) {
        itemPayload.identity_id = canon.id;
      }
      const { error: insErr } = await supabase.from("ptv_kru_portofolio").upsert(itemPayload, { onConflict: "id" });
      if (insErr) {
        console.warn("[Portofolio API] ptv_kru_portofolio upsert warning (fallback used):", insErr.message);
      }
      if (canon) {
        const existingMeta = canon.metadata || {};
        const list = Array.isArray(existingMeta.portofolio) ? [...existingMeta.portofolio] : [];
        const existingIdx = list.findIndex((i) => i.id === itemId);
        if (existingIdx >= 0) {
          list[existingIdx] = { ...list[existingIdx], ...itemPayload };
        } else {
          list.unshift(itemPayload);
        }
        await supabase.from("canonical_identity").update({
          metadata: { ...existingMeta, portofolio: list },
          updated_at: nowIso
        }).eq("id", canon.id);
      }
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, message: "Portofolio karya berhasil disimpan.", item: itemPayload }));
      return;
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message || "Gagal menyimpan portofolio.", code: "server_error" }));
      return;
    }
  }
  if (req.method === "DELETE") {
    if (!sessionUser) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: "Sesi kru aktif diperlukan.", code: "unauthorized" }));
      return;
    }
    const itemId = queryParams.get("id")?.trim();
    if (!itemId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Parameter id wajib diisi.", code: "missing_id" }));
      return;
    }
    const effectivePtvId = sessionUser.ptv_id || sessionUser.username;
    try {
      await supabase.from("ptv_kru_portofolio").delete().eq("id", itemId).eq("ptv_id", effectivePtvId);
      const { data: canon } = await supabase.from("canonical_identity").select("id, metadata").eq("ptv_id", effectivePtvId).maybeSingle();
      if (canon) {
        const existingMeta = canon.metadata || {};
        const list = Array.isArray(existingMeta.portofolio) ? existingMeta.portofolio : [];
        const filtered = list.filter((i) => i.id !== itemId);
        await supabase.from("canonical_identity").update({
          metadata: { ...existingMeta, portofolio: filtered },
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", canon.id);
      }
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, message: "Karya portofolio berhasil dihapus." }));
      return;
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message || "Gagal menghapus portofolio.", code: "server_error" }));
      return;
    }
  }
  res.setHeader("Allow", "GET, POST, DELETE");
  res.statusCode = 405;
  res.end(JSON.stringify({ error: `Metode ${req.method} tidak didukung.`, code: "method_not_allowed" }));
}

// api/_routes/upload-avatar.ts
init_cookies();
init_crypto();
import { createClient as createClient17 } from "@supabase/supabase-js";
async function handler16(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  if (!sessionToken || !authSecret) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Sesi login diperlukan untuk mengunggah foto profil." }));
    return;
  }
  const session = verifySessionToken(sessionToken, authSecret);
  if (!session) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Sesi login telah kedaluwarsa." }));
    return;
  }
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Konfigurasi storage backend belum lengkap." }));
    return;
  }
  const supabase = createClient17(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15e3) }) }
  });
  try {
    let parsed;
    const existingBody = req.body;
    if (existingBody !== void 0) {
      if (typeof existingBody === "object" && existingBody !== null) {
        parsed = existingBody;
      } else if (typeof existingBody === "string") {
        parsed = JSON.parse(existingBody || "{}");
      } else if (Buffer.isBuffer(existingBody)) {
        parsed = JSON.parse(existingBody.toString("utf8") || "{}");
      }
    }
    if (!parsed) {
      let bodyStr = "";
      req.on("data", (chunk) => {
        bodyStr += chunk;
        if (bodyStr.length > 10 * 1024 * 1024) {
          throw new Error("Ukuran file foto maksimal 10MB.");
        }
      });
      await new Promise((resolve, reject) => {
        req.on("end", () => resolve());
        req.on("error", reject);
      });
      parsed = JSON.parse(bodyStr || "{}");
    }
    const { data: base64Data, ptv_id: ptvId } = parsed;
    if (!base64Data || typeof base64Data !== "string") {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Data foto base64 wajib disertakan." }));
      return;
    }
    const match = base64Data.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    let mimeType = "image/jpeg";
    let rawBase64 = base64Data;
    let extension = "jpg";
    if (match) {
      mimeType = match[1];
      rawBase64 = match[2];
      if (mimeType.includes("png")) extension = "png";
      else if (mimeType.includes("webp")) extension = "webp";
      else if (mimeType.includes("gif")) extension = "gif";
    }
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedMimes.includes(mimeType)) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF." }));
      return;
    }
    const buffer = Buffer.from(rawBase64, "base64");
    if (buffer.length > 10 * 1024 * 1024) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Ukuran file foto maksimal 10MB." }));
      return;
    }
    const cleanId = (ptvId || session.ptv_id || "crew").toLowerCase().replace(/[^a-z0-9]/g, "_");
    const fileName = `avatars/crew_${cleanId}_${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("inventory").upload(fileName, buffer, {
      upsert: true,
      contentType: mimeType
    });
    if (uploadError) {
      console.error("[UploadAvatar] Upload error:", uploadError);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: `Gagal menyimpan foto ke storage: ${uploadError.message}` }));
      return;
    }
    const { data: publicUrlData } = supabase.storage.from("inventory").getPublicUrl(fileName);
    const publicUrl = publicUrlData?.publicUrl;
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        url: publicUrl,
        message: "Foto profil berhasil disimpan secara permanen di storage studio."
      })
    );
  } catch (err) {
    console.error("[UploadAvatar] Exception:", err);
    res.statusCode = 400;
    res.end(JSON.stringify({ error: err?.message || "Gagal memproses unggahan foto." }));
  }
}

// api/_routes/verifikasi-surat.ts
import { createClient as createClient18 } from "@supabase/supabase-js";
var VALID_INSTANSI_LIST = [
  "PTV",
  "SD",
  "SMP",
  "IIS SMP",
  "SMA",
  "MADIN",
  "ASRAMA",
  "SPI",
  "MI",
  "MTs",
  "MA",
  "RIBATH",
  "YAYASAN",
  "NDALEM"
];
function determineDocumentStatus(statusVal, tanggalSelesai) {
  const status = String(statusVal || "").trim().toLowerCase();
  if (["ditolak", "rejected", "dibatalkan", "batal", "dicabut", "tidak_valid", "diarsipkan", "archived"].includes(status)) {
    return "tidak_valid";
  }
  if (["menunggu", "draft", "pending"].includes(status)) {
    return "menunggu";
  }
  if (["disetujui", "aktif", "valid", "approved", "acc", "berlaku"].includes(status)) {
    if (tanggalSelesai) {
      try {
        const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const end = tanggalSelesai.split("T")[0];
        if (end < today) {
          return "kedaluwarsa";
        }
      } catch {
      }
    }
    return "valid";
  }
  return "menunggu";
}
var rateLimitMap = /* @__PURE__ */ new Map();
function checkRateLimit(clientId, maxRequests = 15, windowMs = 6e4) {
  const now = Date.now();
  const timestamps = rateLimitMap.get(clientId) || [];
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);
  if (validTimestamps.length >= maxRequests) {
    return false;
  }
  validTimestamps.push(now);
  rateLimitMap.set(clientId, validTimestamps);
  return true;
}
async function handler17(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const clientFingerprint = (req.headers && req.headers["x-forwarded-for"] || req.headers && req.headers["user-agent"] || "client").slice(0, 32);
  if (!checkRateLimit(clientFingerprint)) {
    res.statusCode = 429;
    res.end(JSON.stringify({ error: "Terlalu banyak permintaan. Silakan tunggu beberapa saat.", code: "rate_limited" }));
    return;
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "Verifikasi server belum tersedia. Hubungi pengelola.", code: "service_unavailable" }));
    return;
  }
  const supabase = createClient18(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  if (req.method === "GET") {
    const searchParams = new URL(req.url || "/", "http://localhost").searchParams;
    const rawNomor = searchParams.get("nomor")?.trim() || "";
    const queryDocId = searchParams.get("id")?.trim() || "";
    const queryToken = searchParams.get("token")?.trim() || "";
    const match = rawNomor.match(/^\d{1,6}\/(SI|ST|SBB|SB)-PTV\/[IVXLCDM]+\/\d{4}$/);
    if (!match || rawNomor.length > 80) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Format nomor surat tidak sesuai.", code: "invalid_doc_number" }));
      return;
    }
    const typeCode = match[1];
    const table = typeCode === "SI" ? "ptv_surat_izin" : typeCode === "ST" ? "ptv_surat_tugas" : "ptv_surat_barang";
    try {
      const { data, error } = await supabase.from(table).select("*").eq("nomor_surat", rawNomor).limit(2);
      if (error) throw error;
      if (!data || data.length === 0) {
        res.statusCode = 200;
        res.end(JSON.stringify({ found: false, nomor_surat: rawNomor }));
        return;
      }
      const row = data[0];
      if (queryDocId && row.id !== queryDocId) {
        res.statusCode = 200;
        res.end(JSON.stringify({
          found: false,
          nomor_surat: rawNomor,
          error: "Dokumen dengan identitas QR ini sudah tidak berlaku atau telah dihapus.",
          code: "document_id_mismatch"
        }));
        return;
      }
      if (queryToken && row.qr_token && row.qr_token !== queryToken) {
        res.statusCode = 200;
        res.end(JSON.stringify({
          found: false,
          nomor_surat: rawNomor,
          error: "Token pengenal QR tidak valid atau dokumen fisik lama telah ditarik.",
          code: "qr_token_mismatch"
        }));
        return;
      }
      const endDate = row.tanggal_selesai || row.tanggal_tugas || row.tanggal_kembali || null;
      const computedStatus = determineDocumentStatus(row.status, endDate);
      const santriArr = Array.isArray(row.santri_list) ? row.santri_list : [];
      let riwayatList = [];
      try {
        const { data: logsData } = await supabase.from("ptv_surat_verifikasi_logs").select("id, nomor_surat, nama_pemeriksa, instansi, metadata, accessed_at").eq("nomor_surat", rawNomor).order("accessed_at", { ascending: false }).limit(50);
        if (Array.isArray(logsData) && logsData.length > 0) {
          riwayatList = logsData.map((l) => {
            const meta = l.metadata || {};
            const itemHasil = meta.hasil || (computedStatus === "tidak_valid" ? "Gagal" : "Berhasil");
            return {
              id: l.id,
              nama_pemeriksa: l.nama_pemeriksa,
              instansi: l.instansi,
              waktu: l.accessed_at || meta.recorded_at || (/* @__PURE__ */ new Date()).toISOString(),
              hasil: itemHasil,
              status_dokumen: meta.status_dokumen || computedStatus,
              catatan: meta.catatan || (itemHasil === "Berhasil" ? "Pemeriksaan Sah & Terverifikasi" : "Pemeriksaan Tercatat")
            };
          });
        }
      } catch {
      }
      const metaLogs = Array.isArray(row.metadata?.verifikasi_logs) ? row.metadata.verifikasi_logs : [];
      if (metaLogs.length > 0) {
        const existingIds = new Set(riwayatList.map((r) => r.id));
        for (const ml of metaLogs) {
          const mlId = ml.id || `${ml.nama_pemeriksa}-${ml.accessed_at || ml.metadata?.recorded_at}`;
          if (!existingIds.has(mlId)) {
            existingIds.add(mlId);
            const mlHasil = ml.hasil || (computedStatus === "tidak_valid" ? "Gagal" : "Berhasil");
            riwayatList.push({
              id: mlId,
              nama_pemeriksa: ml.nama_pemeriksa || "Pemeriksa Terdaftar",
              instansi: ml.instansi || "\u2014",
              waktu: ml.accessed_at || ml.metadata?.recorded_at || (/* @__PURE__ */ new Date()).toISOString(),
              hasil: mlHasil,
              status_dokumen: ml.status_dokumen || computedStatus,
              catatan: ml.catatan || (mlHasil === "Berhasil" ? "Pemeriksaan Sah" : "Pemeriksaan Tercatat")
            });
          }
        }
      }
      riwayatList.sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          found: true,
          nomor_surat: row.nomor_surat,
          status: computedStatus,
          raw_status: row.status,
          jenis_surat: row.jenis_surat || (typeCode === "SI" ? "Surat Izin Santri" : typeCode === "ST" ? "Surat Tugas Kru" : "Surat Peminjaman Aset"),
          perihal: row.keperluan || row.alasan || row.perihal || "Kegiatan Operasional Progresif TV",
          tanggal_terbit: row.created_at,
          tanggal_mulai: row.tanggal_mulai || row.tanggal_tugas || row.tanggal_pinjam || null,
          tanggal_selesai: endDate,
          penanggung_jawab: row.penanggung_jawab || row.disetujui_oleh || "Pimpinan Eksekutif PTV",
          diajukan_oleh: row.nama_pemohon || row.diajukan_oleh || null,
          has_santri_list: typeCode === "SI" && santriArr.length > 0,
          santri_count: santriArr.length,
          id: row.id,
          riwayat_pemeriksaan: riwayatList
        })
      );
      return;
    } catch (err) {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: "Verifikasi server tidak dapat dilakukan. Coba lagi nanti.", code: "db_error" }));
      return;
    }
  }
  if (req.method === "POST") {
    let rawBody = "";
    for await (const chunk of req) {
      rawBody += chunk;
      if (rawBody.length > 32768) {
        res.statusCode = 413;
        res.end(JSON.stringify({ error: "Payload terlalu besar.", code: "payload_too_large" }));
        return;
      }
    }
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Body JSON tidak valid.", code: "invalid_json" }));
      return;
    }
    const nomorSurat = String(body.nomor_surat || "").trim();
    const namaPemeriksa = String(body.nama_pemeriksa || "").trim();
    const instansi = String(body.instansi || "").trim();
    const postMatch = nomorSurat.match(/^\d{1,6}\/(SI|ST|SBB|SB)-PTV\/[IVXLCDM]+\/\d{4}$/);
    if (!nomorSurat || !postMatch) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Nomor surat wajib diisi dan sesuai format resmi.", code: "invalid_nomor" }));
      return;
    }
    if (!namaPemeriksa || namaPemeriksa.length < 2 || namaPemeriksa.length > 80) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Nama pemeriksa wajib diisi (minimal 2 karakter).", code: "invalid_nama" }));
      return;
    }
    if (!VALID_INSTANSI_LIST.includes(instansi)) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Pilihan instansi tidak valid.", code: "invalid_instansi" }));
      return;
    }
    const postTypeCode = postMatch[1];
    const postTable = postTypeCode === "SI" ? "ptv_surat_izin" : postTypeCode === "ST" ? "ptv_surat_tugas" : "ptv_surat_barang";
    try {
      const { data: rows, error: docErr } = await supabase.from(postTable).select("*").eq("nomor_surat", nomorSurat).limit(1);
      if (docErr || !rows || rows.length === 0) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Dokumen surat tidak ditemukan dalam pangkalan data resmi.", code: "doc_not_found" }));
        return;
      }
      const doc = rows[0];
      const endDate = doc.tanggal_selesai || doc.tanggal_tugas || doc.tanggal_kembali || null;
      const computedStatus = determineDocumentStatus(doc.status, endDate);
      const isDocValid = computedStatus === "valid";
      const hasil = isDocValid ? "Berhasil" : "Gagal";
      const catatan = isDocValid ? "Verifikasi Keabsahan & Buka Rincian Santri Berhasil" : `Pemeriksaan Tercatat: Status Dokumen ${computedStatus.toUpperCase()}`;
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const logEntry = {
        nomor_surat: nomorSurat,
        nama_pemeriksa: namaPemeriksa,
        instansi,
        metadata: {
          hasil,
          status_dokumen: computedStatus,
          raw_status: doc.status,
          catatan,
          recorded_at: nowIso,
          userAgent: String(req.headers?.["user-agent"] || "").slice(0, 150)
        },
        accessed_at: nowIso
      };
      let insertedLogId;
      const { data: insData, error: logErr } = await supabase.from("ptv_surat_verifikasi_logs").insert(logEntry).select();
      if (insData && insData[0]?.id) {
        insertedLogId = insData[0].id;
      }
      let metaUpdateErr = null;
      try {
        const existingMeta = doc.metadata || {};
        const verifLogs = Array.isArray(existingMeta.verifikasi_logs) ? existingMeta.verifikasi_logs : [];
        const newMetaItem = {
          id: insertedLogId || `${nomorSurat}-${Date.now()}`,
          nomor_surat: nomorSurat,
          nama_pemeriksa: namaPemeriksa,
          instansi,
          hasil,
          status_dokumen: computedStatus,
          catatan,
          accessed_at: nowIso,
          metadata: { recorded_at: nowIso }
        };
        const updatedMetaLogs = [newMetaItem, ...verifLogs.filter((x) => x.id !== newMetaItem.id)].slice(0, 50);
        const { error: updErr } = await supabase.from(postTable).update({
          metadata: { ...existingMeta, verifikasi_logs: updatedMetaLogs }
        }).eq("id", doc.id);
        metaUpdateErr = updErr;
      } catch (err) {
        metaUpdateErr = err;
      }
      if (logErr && metaUpdateErr) {
        res.statusCode = 500;
        res.end(JSON.stringify({
          error: "Gagal mencatat log verifikasi ke database server. Silakan coba kembali.",
          code: "storage_failure"
        }));
        return;
      }
      const santriList = Array.isArray(doc.santri_list) ? doc.santri_list : [];
      const newHistoryItem = {
        id: insertedLogId || `${nomorSurat}-${Date.now()}`,
        nama_pemeriksa: namaPemeriksa,
        instansi,
        waktu: nowIso,
        hasil,
        status_dokumen: computedStatus,
        catatan
      };
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: "Pencatatan pemeriksa berhasil disimpan.",
          pemeriksa: {
            id: newHistoryItem.id,
            nama: namaPemeriksa,
            instansi,
            waktu: nowIso,
            hasil,
            status_dokumen: computedStatus
          },
          santri_list: santriList,
          riwayat_pemeriksaan_item: newHistoryItem
        })
      );
      return;
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message || "Gagal memproses pencatatan verifikasi.", code: "server_error" }));
      return;
    }
  }
  res.setHeader("Allow", "GET, POST");
  res.statusCode = 405;
  res.end(JSON.stringify({ error: `Metode ${req.method} tidak diizinkan.`, code: "method_not_allowed" }));
}

// api/_routes/verifikasi-kru.ts
import { createClient as createClient19 } from "@supabase/supabase-js";
var rateLimitMap2 = /* @__PURE__ */ new Map();
function checkRateLimit2(clientId, maxRequests = 30, windowMs = 6e4) {
  const now = Date.now();
  const timestamps = rateLimitMap2.get(clientId) || [];
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);
  if (validTimestamps.length >= maxRequests) {
    return false;
  }
  validTimestamps.push(now);
  rateLimitMap2.set(clientId, validTimestamps);
  return true;
}
function normalizeCrewId(raw) {
  const clean = raw.trim().toUpperCase().replace(/\s+/g, "").replace(/\/+$/, "");
  if (!clean) return "";
  const part = clean.replace(/^(PTV-?)+/i, "");
  if (!part) return "";
  if (/^\d+$/.test(part)) {
    return `PTV-${part.padStart(3, "0")}`;
  }
  return `PTV-${part}`;
}
async function handler18(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.end(JSON.stringify({ error: "Metode tidak didukung. Gunakan GET.", code: "method_not_allowed" }));
    return;
  }
  const clientFingerprint = (req.headers && req.headers["x-forwarded-for"] || req.headers && req.headers["user-agent"] || "client").slice(0, 32);
  if (!checkRateLimit2(clientFingerprint)) {
    res.statusCode = 429;
    res.end(JSON.stringify({ error: "Terlalu banyak permintaan. Silakan tunggu beberapa saat.", code: "rate_limited" }));
    return;
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "Layanan verifikasi kru belum tersedia. Hubungi pengelola.", code: "service_unavailable" }));
    return;
  }
  const searchParams = new URL(req.url || "/", "http://localhost").searchParams;
  const queryId = searchParams.get("id") || searchParams.get("crew_id") || searchParams.get("kru") || searchParams.get("q") || "";
  const rawClean = queryId.trim();
  if (!rawClean) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Parameter identitas (id / q) wajib diisi.", code: "missing_parameter" }));
    return;
  }
  if (rawClean.length > 80) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Panjang query identitas melebihi batas yang diizinkan.", code: "query_too_long" }));
    return;
  }
  const normalizedId = normalizeCrewId(rawClean);
  const supabase = createClient19(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    let query = supabase.from("legacy_archive_kru").select(`
      archive_id,
      ptv_id,
      full_name,
      divisi,
      jabatan,
      angkatan,
      status,
      photo_url,
      canonical_identity_id,
      metadata_json
    `);
    const isExplicitPtvId = /^PTV-[A-Z0-9-]+$/i.test(rawClean);
    const isPureDigits = /^\d{1,4}$/.test(rawClean);
    if (isExplicitPtvId || isPureDigits) {
      query = query.eq("ptv_id", normalizedId);
    } else {
      query = query.or(`ptv_id.eq.${normalizedId},full_name.ilike.%${rawClean}%`);
    }
    const { data: rows, error: queryErr } = await query.limit(2);
    if (queryErr) {
      throw queryErr;
    }
    if (!rows || rows.length === 0) {
      res.statusCode = 200;
      res.end(JSON.stringify({
        is_found: false,
        crew_id: normalizedId || rawClean,
        full_name: "Identitas Kru Tidak Terdaftar",
        position: "-",
        division: "-",
        angkatan: "-",
        status_kru: "Nonaktif",
        active_assignment: null
      }));
      return;
    }
    const crewRow = rows[0];
    let avatarUrl = crewRow.photo_url || crewRow.metadata_json?.avatar_url || "";
    if (crewRow.canonical_identity_id) {
      const { data: canon } = await supabase.from("canonical_identity").select("avatar_url").eq("id", crewRow.canonical_identity_id).maybeSingle();
      if (canon?.avatar_url) {
        avatarUrl = canon.avatar_url;
      }
    }
    const rawStatus = (crewRow.status || "").trim();
    let statusKru = "Aktif";
    if (rawStatus.toLowerCase() === "nonaktif" || rawStatus.toLowerCase() === "inactive") {
      statusKru = "Nonaktif";
    } else if (rawStatus.toLowerCase().includes("purna") || rawStatus.toLowerCase().includes("alumni")) {
      statusKru = "Purna Kru";
    }
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    let activeAssignment = null;
    try {
      const { data: assignments } = await supabase.from("ptv_surat_tugas").select("nomor_surat, subject, jenis_kegiatan, tanggal_mulai, tanggal_selesai, penanggung_jawab, pembawa, recipients, status").lte("tanggal_mulai", today).gte("tanggal_selesai", today).in("status", ["disetujui", "aktif", "Disetujui", "Aktif"]).limit(10);
      if (assignments && Array.isArray(assignments)) {
        const foundAss = assignments.find((a) => {
          const recip = Array.isArray(a.recipients) ? a.recipients : [];
          return a.pembawa && (a.pembawa.includes(crewRow.full_name) || a.pembawa.includes(crewRow.ptv_id)) || recip.some((r) => r.includes(crewRow.full_name) || r.includes(crewRow.ptv_id));
        });
        if (foundAss) {
          activeAssignment = {
            nomor_surat: foundAss.nomor_surat,
            jenis_kegiatan: foundAss.jenis_kegiatan || foundAss.subject || "Liputan Acara",
            tanggal_mulai: foundAss.tanggal_mulai,
            tanggal_selesai: foundAss.tanggal_selesai,
            penanggung_jawab: foundAss.penanggung_jawab || "Ketua Umum PTV",
            is_today_active: true,
            verification_url: `/verifikasi-surat?nomor=${encodeURIComponent(foundAss.nomor_surat)}`
          };
        }
      }
    } catch {
    }
    res.statusCode = 200;
    res.end(JSON.stringify({
      is_found: true,
      crew_id: crewRow.ptv_id,
      full_name: crewRow.full_name,
      position: crewRow.jabatan || "Kru Operasional",
      division: crewRow.divisi || "Umum",
      angkatan: crewRow.angkatan || "-",
      status_kru: statusKru,
      foto_url: avatarUrl,
      active_assignment: activeAssignment
    }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Gagal memproses verifikasi identitas.", code: "server_error" }));
  }
}

// api/_routes/auth/change-password.ts
init_cookies();
init_crypto();
import { createClient as createClient20 } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
async function handler19(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Metode HTTP tidak diizinkan." }));
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  if (!sessionToken || !authSecret) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Sesi kru aktif diperlukan untuk mengubah kata sandi.", code: "unauthorized" }));
    return;
  }
  let session;
  try {
    session = verifySessionToken(sessionToken, authSecret);
  } catch {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Sesi telah kedaluwarsa. Silakan login kembali.", code: "session_expired" }));
    return;
  }
  let body;
  if (req.body !== void 0 && typeof req.body === "object") {
    body = req.body;
  } else {
    let rawBody = "";
    for await (const chunk of req) {
      rawBody += chunk;
      if (rawBody.length > 8192) {
        res.statusCode = 413;
        res.end(JSON.stringify({ error: "Ukuran payload melebihi batas." }));
        return;
      }
    }
    try {
      body = JSON.parse(rawBody);
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Format JSON permintaan tidak valid." }));
      return;
    }
  }
  const oldPassword = typeof body.old_password === "string" ? body.old_password : "";
  const newPassword = typeof body.new_password === "string" ? body.new_password : "";
  if (!newPassword || newPassword.length < 4) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Kata sandi baru minimal terdiri dari 4 karakter." }));
    return;
  }
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "Layanan autentikasi server belum siap." }));
    return;
  }
  const supabase = createClient20(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  try {
    const { data: cred, error: credErr } = await supabase.from("auth_credentials").select("password_hash").eq("account_id", session.account_id).maybeSingle();
    if (credErr) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Gagal memverifikasi kredensial akun." }));
      return;
    }
    if (cred && cred.password_hash) {
      if (!oldPassword) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Kata sandi lama wajib diisi." }));
        return;
      }
      const match = await bcrypt.compare(oldPassword, cred.password_hash);
      if (!match) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Kata sandi lama yang Anda masukkan tidak sesuai." }));
        return;
      }
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let updated = false;
    try {
      const actorIdentityId = session.identity_id || session.account_id;
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("rpc_admin_set_password", {
        p_account_id: session.account_id,
        p_password_hash: newHash,
        p_actor_id: actorIdentityId
      });
      if (!rpcErr && rpcRes?.success) {
        updated = true;
      } else if (rpcErr) {
        console.error("[ChangePassword RPC Error]:", rpcErr);
      }
    } catch {
    }
    if (!updated) {
      const { error: upsertErr } = await supabase.from("auth_credentials").upsert(
        {
          account_id: session.account_id,
          hash_algorithm: "bcrypt",
          password_hash: newHash,
          needs_rehash: false,
          password_updated_at: nowIso,
          updated_at: nowIso
        },
        { onConflict: "account_id" }
      );
      if (upsertErr) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: `Gagal memperbarui kata sandi: ${upsertErr.message}` }));
        return;
      }
    }
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, message: "Kata sandi akun Anda berhasil diperbarui." }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message || "Terjadi kesalahan sistem saat memperbarui kata sandi." }));
  }
}

// api/_routes/auth/login.ts
init_identity();
init_crypto();
init_cookies();
init_portalLifecycle();
var LoginInputError = class extends Error {
  constructor(statusCode) {
    super("Permintaan login tidak valid.");
    this.statusCode = statusCode;
  }
};
async function parseJsonBody8(req) {
  const limit = 4096;
  let value = req.body;
  if (value === void 0) {
    value = await new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      const cleanup = () => {
        req.off("data", onData);
        req.off("end", onEnd);
        req.off("error", onError);
        req.off("aborted", onError);
      };
      const onError = () => {
        cleanup();
        reject(new LoginInputError(400));
      };
      const onEnd = () => {
        cleanup();
        resolve(Buffer.concat(chunks));
      };
      const onData = (chunk) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > limit) {
          cleanup();
          req.resume();
          reject(new LoginInputError(413));
        } else chunks.push(bytes);
      };
      req.on("data", onData);
      req.on("end", onEnd);
      req.on("error", onError);
      req.on("aborted", onError);
    });
  }
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  try {
    const encoded = typeof value === "string" ? value : JSON.stringify(value);
    if (typeof encoded !== "string") throw new LoginInputError(400);
    if (Buffer.byteLength(encoded, "utf8") > limit) throw new LoginInputError(413);
    value = JSON.parse(encoded);
  } catch (error) {
    if (error instanceof LoginInputError) throw error;
    throw new LoginInputError(400);
  }
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !["identifier", "password"].includes(key))) throw new LoginInputError(400);
  return value;
}
async function handler20(req, res) {
  res.setHeader?.("Content-Type", "application/json");
  res.setHeader?.("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }
  try {
    const body = await parseJsonBody8(req);
    const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!identifier || identifier.length > 254 || !password || Buffer.byteLength(password, "utf8") > 72 || password.length < 4) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Identitas dan password (minimal 4 karakter) wajib diisi dengan format yang didukung." }));
      return;
    }
    if (req.headers.origin) {
      const originHost = new URL(req.headers.origin).host.toLowerCase();
      const requestHost = (req.headers.host || "").toLowerCase();
      const isExactMatch = originHost === requestHost;
      const isCanonicalPair = originHost === "ptvpro.com" && requestHost === "www.ptvpro.com" || originHost === "www.ptvpro.com" && requestHost === "ptvpro.com";
      if (!isExactMatch && !isCanonicalPair) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: "Origin tidak diizinkan." }));
        return;
      }
    }
    let issuedToken;
    let identityResult;
    if (passwordLoginEnabled()) {
      const result = await authenticatePortalPassword(req, identifier, password);
      if (!result.session || !result.token) {
        res.statusCode = result.status;
        if (result.retryAfter) res.setHeader("Retry-After", String(result.retryAfter));
        res.end(JSON.stringify({ error: result.error }));
        return;
      }
      identityResult = { success: true, session: result.session };
      issuedToken = result.token;
    } else identityResult = await resolveIdentityByCredentials(identifier, password);
    if (!identityResult.success || !identityResult.session) {
      const statusCode = identityResult.code === "access_denied" ? 403 : 401;
      res.statusCode = statusCode;
      res.end(JSON.stringify({ error: identityResult.error || "Autentikasi gagal." }));
      return;
    }
    const authSecret = process.env.AUTH_SECRET || "";
    const isSecure = req.headers?.["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
    const sessionToken = issuedToken || signSessionToken(identityResult.session, authSecret);
    const sessionCookie = serializeCookie("ptv_hub_session", sessionToken, {
      path: "/",
      maxAge: issuedToken ? identityResult.session.exp - identityResult.session.iat : 7 * 24 * 3600,
      httpOnly: true,
      secure: isSecure,
      sameSite: "Lax"
    });
    appendSetCookieHeader(res, sessionCookie);
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        expires_at: identityResult.session.exp * 1e3,
        user: {
          id: identityResult.session.account_id,
          ptv_id: identityResult.session.ptv_id,
          full_name: identityResult.session.full_name,
          username: identityResult.session.username,
          avatar_url: identityResult.session.avatar_url,
          division: identityResult.session.division || "",
          position: identityResult.session.position || "",
          organization: "PTV Studio",
          status_akun: identityResult.session.status_akun,
          status_organisasi: identityResult.session.status_organisasi || "active",
          assigned_profiles: identityResult.session.assigned_profiles || [],
          allowed_overrides: [],
          denied_overrides: [],
          capabilities: identityResult.session.capabilities || [],
          capabilities_verified_live: Boolean(issuedToken)
        }
      })
    );
  } catch (error) {
    if (error instanceof LoginInputError) {
      res.statusCode = error.statusCode;
      res.end(JSON.stringify({ error: error.message }));
      return;
    }
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Terjadi kesalahan internal pada server autentikasi." }));
  }
}

// api/_routes/auth/logout.ts
init_cookies();
init_cookies();
init_crypto();
init_portalLifecycle();
async function handler21(req, res) {
  res.setHeader?.("Cache-Control", "no-store");
  const raw = parseCookies(req.headers.cookie).ptv_hub_session;
  const session = raw && verifySessionToken(raw, process.env.AUTH_SECRET || "");
  if (lifecycleEnabled() || session && sessionNeedsRegistry(session)) {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Gunakan POST untuk logout." }));
      return;
    }
    try {
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: "Origin tidak diizinkan." }));
        return;
      }
      if (session) {
        const result = await lifecycleClient().rpc("rpc_portal_session_revoke", sessionArguments(session));
        if (result.error || result.data !== true) throw new Error("revocation unavailable");
      }
    } catch {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: "Pencabutan sesi belum berhasil. Coba lagi." }));
      return;
    }
  }
  const isSecure = req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
  const clearSessionCookie = serializeCookie("ptv_hub_session", "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    secure: isSecure,
    sameSite: "Lax"
  });
  appendSetCookieHeader(res, clearSessionCookie);
  if (req.method === "POST") {
    res.statusCode = 200;
    res.setHeader?.("Content-Type", "application/json");
    res.end(JSON.stringify({ success: true }));
    return;
  }
  res.statusCode = 302;
  res.setHeader?.("Location", "/hub/login");
  res.end();
}

// api/_routes/auth/session.ts
init_cookies();
init_crypto();
init_liveAccess();
import { createClient as createClient21 } from "@supabase/supabase-js";
async function handler22(req, res) {
  res.setHeader?.("Content-Type", "application/json");
  res.setHeader?.("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  if (!sessionToken) {
    res.statusCode = 200;
    res.end(JSON.stringify({ authenticated: false, user: null }));
    return;
  }
  const session = verifySessionToken(sessionToken, authSecret);
  if (!session || session.status_akun !== "active") {
    res.statusCode = 200;
    res.end(JSON.stringify({ authenticated: false, user: null }));
    return;
  }
  let live = null;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (key && /^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/.test(url)) {
    try {
      const db = createClient21(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(1e4) }) } });
      live = await resolveLiveAccess(db, session);
    } catch (error) {
      if (error instanceof LiveAccessUnavailableError || !(error instanceof Error) || error.message !== "forbidden") {
        res.statusCode = 503;
        res.end(JSON.stringify({ error: "Verifikasi sesi sementara tidak tersedia. Silakan coba lagi." }));
        return;
      }
    }
  } else {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "Verifikasi sesi belum tersedia." }));
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
      expires_at: session.exp * 1e3,
      user: {
        id: live.account.id,
        ptv_id: live.identity.ptv_id,
        full_name: live.identity.full_name,
        username: live.account.username,
        avatar_url: live.identity.avatar_url,
        division: live.membership.division_id || "",
        position: live.membership.position_title || "",
        organization: "PTV Studio",
        status_akun: live.account.status_akun,
        status_organisasi: live.membership.status_organisasi,
        assigned_profiles: live.profiles,
        allowed_overrides: live.context.allowed_overrides,
        denied_overrides: live.context.denied_overrides,
        capabilities: live.context.capabilities,
        capabilities_verified_live: true
      }
    })
  );
}

// api/_routes/auth/google/callback.ts
init_crypto();
init_cookies();
init_identity();

// api/_routes/auth/_utils/loginProof.ts
init_liveAccess();
init_portalLifecycle();
import { createClient as createClient22 } from "@supabase/supabase-js";
async function recordPortalLoginProof(session, verifiedGoogleSubject, signedToken) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !/^https:\/\/swadgljnyelsjstqqxbm\.supabase\.co\/?$/.test(url)) throw new Error("login proof unavailable");
  const db = createClient22(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const live = await resolveLiveAccess(db, session, { issuingSession: true });
  const credential = await db.from("auth_credentials").select("oauth_provider,oauth_subject_id,updated_at").eq("account_id", live.account.id).single();
  if (credential.error || credential.data?.oauth_provider !== "google" || !verifiedGoogleSubject || credential.data.oauth_subject_id !== verifiedGoogleSubject || !Number.isFinite(Date.parse(credential.data.updated_at))) throw new Error("login proof unavailable");
  if (lifecycleEnabled()) {
    if (!signedToken || !session.session_id) throw new Error("login proof unavailable");
    const result = await db.rpc("rpc_portal_google_session", {
      p_actor: live.account.id,
      p_identity: live.identity.id,
      p_subject: verifiedGoogleSubject,
      p_credential_version: credential.data.updated_at,
      p_session_id: session.session_id,
      p_fingerprint: fingerprintSession(signedToken),
      p_iat: session.iat,
      p_exp: session.exp
    });
    if (result.error || result.data !== true) throw new Error("login proof unavailable");
    return;
  }
  const audit = await db.from("auth_audit_log").insert({
    actor_id: live.identity.id,
    event_type: "portal_login_verified",
    metadata: { proof_version: 1, account_id: live.account.id, credential_version: credential.data.updated_at, login_route: "vercel_google", session_iat: session.iat }
  });
  if (audit.error) throw new Error("login proof unavailable");
}

// api/_routes/auth/google/callback.ts
init_portalLifecycle();
import { randomUUID as randomUUID6 } from "node:crypto";
async function handler23(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader?.("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }
  const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const errorParam = urlObj.searchParams.get("error");
  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");
  const authSecret = process.env.AUTH_SECRET || "";
  const isSecure = req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
  if (errorParam) {
    let friendlyError = "Autentikasi Google gagal.";
    let authStatus = "error";
    if (errorParam === "access_denied") {
      friendlyError = "Autentikasi Google dibatalkan oleh pengguna.";
      authStatus = "cancelled";
    }
    let redirectDest = `/hub/login?auth_error=${encodeURIComponent(friendlyError)}&auth_status=${authStatus}`;
    if (state) {
      const maybeState = verifyHmacState(state, authSecret);
      if (maybeState?.action === "link") {
        redirectDest = `/hub/pengaturan?oauth_status=${authStatus}&oauth_error=${encodeURIComponent(friendlyError)}`;
      }
    }
    res.statusCode = 302;
    res.setHeader?.("Location", redirectDest);
    res.end();
    return;
  }
  if (!code || !state) {
    res.statusCode = 302;
    res.setHeader?.("Location", `/hub/login?auth_error=${encodeURIComponent("Parameter OAuth callback tidak lengkap.")}&auth_status=error`);
    res.end();
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const stateCookieRaw = cookies["ptv_oauth_state"];
  const clearStateCookie = serializeCookie("ptv_oauth_state", "", {
    path: "/api/auth",
    maxAge: 0,
    httpOnly: true,
    secure: isSecure,
    sameSite: "Lax"
  });
  appendSetCookieHeader(res, clearStateCookie);
  if (!stateCookieRaw || !stateCookieRaw.includes(":")) {
    res.statusCode = 302;
    res.setHeader?.("Location", `/hub/login?auth_error=${encodeURIComponent("Sesi state OAuth telah kedaluwarsa atau tidak ditemukan. Silakan coba lagi.")}&auth_status=state_error`);
    res.end();
    return;
  }
  const [cookieState, cookieVerifier] = stateCookieRaw.split(":");
  if (cookieState !== state) {
    res.statusCode = 302;
    res.setHeader?.("Location", `/hub/login?auth_error=${encodeURIComponent("Verifikasi keamanan CSRF state gagal. Permintaan login ditolak.")}&auth_status=state_error`);
    res.end();
    return;
  }
  const verifiedState = verifyHmacState(state, authSecret);
  if (!verifiedState) {
    res.statusCode = 302;
    res.setHeader?.("Location", `/hub/login?auth_error=${encodeURIComponent("Tanda tangan CSRF state tidak valid. Akses ditolak.")}&auth_status=state_error`);
    res.end();
    return;
  }
  const returnTo = verifiedState.returnTo?.startsWith("/hub") ? verifiedState.returnTo : "/hub";
  let googleSub = "";
  let googleEmail = "";
  const isMockAllowed = process.env.NODE_ENV === "test" && !process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mockSubParam = isMockAllowed ? urlObj.searchParams.get("mock_sub") : null;
  const mockEmailParam = isMockAllowed ? urlObj.searchParams.get("mock_email") : null;
  if (isMockAllowed && (code === "mock-auth-code" || mockSubParam)) {
    googleSub = mockSubParam || "google-sub-ptv-025";
    googleEmail = mockEmailParam || "zidna@ptvpro.com";
  } else {
    if (typeof verifiedState.timestamp !== "number" || !Number.isFinite(verifiedState.timestamp) || verifiedState.timestamp > Date.now() || Date.now() - verifiedState.timestamp > 3e5 || !verifiedState.nonce || !cookieVerifier) {
      res.statusCode = 302;
      res.setHeader?.("Location", "/hub/login?auth_status=state_error");
      res.end();
      return;
    }
    try {
      const rawClientId = process.env.GOOGLE_CLIENT_ID;
      const rawClientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const clientId = rawClientId?.trim().replace(/^["']|["']$/g, "");
      const clientSecret = rawClientSecret?.trim().replace(/^["']|["']$/g, "");
      const origin = `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host || "localhost:5174"}`;
      const rawRedirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`;
      const redirectUri = rawRedirectUri.trim().replace(/^["']|["']$/g, "");
      if (!clientId || !clientSecret) {
        throw new Error("Kredensial GOOGLE_CLIENT_ID atau GOOGLE_CLIENT_SECRET belum dikonfigurasi pada server Vercel.");
      }
      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          code_verifier: cookieVerifier
        })
      });
      if (!tokenResp.ok) {
        const errJson = await tokenResp.json().catch(() => ({}));
        throw new Error(`Pertukaran kode token Google gagal: ${errJson.error_description || tokenResp.statusText}`);
      }
      const tokenData = await tokenResp.json();
      const idToken = tokenData.id_token;
      if (idToken) {
        const verifiedClaims = await verifyGoogleIdToken(idToken, clientId, verifiedState.nonce);
        if (!verifiedClaims) {
          throw new Error("Verifikasi tanda tangan kriptografis Google ID Token (RS256) gagal atau token tidak sah.");
        }
        googleSub = verifiedClaims.sub;
        googleEmail = verifiedClaims.email || "";
      } else {
        throw new Error("Respons Google tidak memuat ID token untuk verifikasi nonce.");
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[GoogleOAuth:Callback] Token exchange or ID token validation failed.");
      }
      res.statusCode = 302;
      res.setHeader?.("Location", `/hub/login?auth_error=${encodeURIComponent(err.message || "Gagal memproses autentikasi Google.")}&auth_status=error`);
      res.end();
      return;
    }
  }
  if (verifiedState.action === "link") {
    const targetAccountId = verifiedState.account_id;
    const sessionCookieRaw = cookies["ptv_hub_session"];
    const currentSession = sessionCookieRaw ? (await Promise.resolve().then(() => (init_crypto(), crypto_exports))).verifySessionToken(sessionCookieRaw, authSecret) : null;
    if (!currentSession || currentSession.account_id !== targetAccountId || currentSession.status_akun !== "active" || sessionNeedsRegistry(currentSession) && !await verifyAccountStatusLive(currentSession.account_id, currentSession.iat, currentSession)) {
      res.statusCode = 302;
      res.setHeader?.("Location", `/hub/pengaturan?oauth_status=error&oauth_error=${encodeURIComponent("Sesi autentikasi tidak valid atau telah kedaluwarsa saat proses linking. Permintaan dibatalkan demi keamanan.")}`);
      res.end();
      return;
    }
    const { linkGoogleIdentityToAccount: linkGoogleIdentityToAccount2 } = await Promise.resolve().then(() => (init_identity(), identity_exports));
    const linkResult = await linkGoogleIdentityToAccount2(targetAccountId, googleSub, googleEmail);
    if (linkResult.conflict) {
      res.statusCode = 302;
      res.setHeader?.("Location", `/hub/pengaturan?oauth_status=conflict&oauth_error=${encodeURIComponent(linkResult.error || "Akun Google tersebut sudah terhubung ke akun PTVPRO lain.")}`);
      res.end();
      return;
    }
    if (!linkResult.success) {
      res.statusCode = 302;
      res.setHeader?.("Location", `/hub/pengaturan?oauth_status=error&oauth_error=${encodeURIComponent(linkResult.error || "Gagal menghubungkan akun Google.")}`);
      res.end();
      return;
    }
    res.statusCode = 302;
    res.setHeader?.("Location", `/hub/pengaturan?oauth_status=linked_success&oauth_email=${encodeURIComponent(googleEmail || "")}`);
    res.end();
    return;
  }
  const identityResult = await resolveIdentityByGoogleSub(googleSub, googleEmail);
  if (!identityResult.success || !identityResult.session) {
    const authStatus = identityResult.code === "unlinked" ? "unlinked" : identityResult.code === "access_denied" ? "access_denied" : "error";
    const isDev = process.env.NODE_ENV !== "production";
    const devSubParam = authStatus === "unlinked" && isMockAllowed && googleSub ? `&dev_sub=${encodeURIComponent(googleSub)}` : "";
    if (isDev) {
      console.log(`[GoogleOAuth:Callback] Stage: identity_check, Status: ${authStatus}, Reason: ${identityResult.code || "unknown"}`);
    }
    res.statusCode = 302;
    res.setHeader?.("Location", `/hub/login?auth_error=${encodeURIComponent(identityResult.error || "Autentikasi akun ditolak.")}&auth_status=${authStatus}${devSubParam}`);
    res.end();
    return;
  }
  if (lifecycleEnabled()) identityResult.session.session_id = randomUUID6();
  const sessionToken = signSessionToken(identityResult.session, authSecret);
  try {
    if (!isMockAllowed) await recordPortalLoginProof(identityResult.session, googleSub, sessionToken);
  } catch {
    res.statusCode = 302;
    res.setHeader?.("Location", "/hub/login?auth_status=error&auth_error=Verifikasi%20audit%20login%20belum%20tersedia.");
    res.end();
    return;
  }
  const sessionCookie = serializeCookie("ptv_hub_session", sessionToken, {
    path: "/",
    maxAge: 7 * 24 * 3600,
    // 7 days
    httpOnly: true,
    secure: isSecure,
    sameSite: "Lax"
  });
  appendSetCookieHeader(res, sessionCookie);
  res.statusCode = 302;
  res.setHeader?.("Location", `/hub/login?auth_status=success&returnTo=${encodeURIComponent(returnTo)}`);
  res.end();
}

// api/_routes/auth/google/login.ts
init_crypto();
init_cookies();
init_portalLifecycle();
init_identity();
function sanitizeReturnTo(rawTarget) {
  if (!rawTarget || typeof rawTarget !== "string") return "/hub";
  const trimmed = rawTarget.trim();
  if (trimmed.startsWith("/hub") && !trimmed.startsWith("/hub/login") && !trimmed.startsWith("//") && !trimmed.includes("\\")) {
    return trimmed;
  }
  if (trimmed.startsWith("/dev-") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  return "/hub";
}
async function handler24(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader?.("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }
  const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const returnTo = sanitizeReturnTo(urlObj.searchParams.get("returnTo") || void 0);
  const action = urlObj.searchParams.get("action");
  const rawClientId = process.env.GOOGLE_CLIENT_ID || "mock-google-client-id";
  const clientId = rawClientId.trim().replace(/^["']|["']$/g, "");
  const rawAuthSecret = process.env.AUTH_SECRET || "";
  const authSecret = rawAuthSecret.trim().replace(/^["']|["']$/g, "");
  const origin = `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host || "localhost:5174"}`;
  const rawRedirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`;
  const redirectUri = rawRedirectUri.trim().replace(/^["']|["']$/g, "");
  const isMockAllowed = process.env.NODE_ENV === "test" && !process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isMockAllowed && (!process.env.GOOGLE_CLIENT_ID || clientId === "mock-google-client-id")) {
    res.statusCode = 302;
    res.setHeader?.("Location", `/hub/login?auth_error=${encodeURIComponent("Kredensial GOOGLE_CLIENT_ID belum dikonfigurasi pada server Vercel.")}&auth_status=error`);
    res.end();
    return;
  }
  let linkingAccountId;
  let linkingPtvId;
  if (action === "link") {
    const { parseCookies: parseCookies2 } = await Promise.resolve().then(() => (init_cookies(), cookies_exports));
    const { verifySessionToken: verifySessionToken2 } = await Promise.resolve().then(() => (init_crypto(), crypto_exports));
    const cookies = parseCookies2(req.headers.cookie);
    const sessionToken = cookies["ptv_hub_session"];
    const currentSession = sessionToken ? verifySessionToken2(sessionToken, authSecret) : null;
    if (!currentSession || currentSession.status_akun !== "active" || sessionNeedsRegistry(currentSession) && !await verifyAccountStatusLive(currentSession.account_id, currentSession.iat, currentSession)) {
      res.statusCode = 302;
      res.setHeader?.("Location", `/hub/login?auth_error=${encodeURIComponent("Sesi login diperlukan untuk menghubungkan akun Google. Silakan login terlebih dahulu.")}&auth_status=error`);
      res.end();
      return;
    }
    linkingAccountId = currentSession.account_id;
    linkingPtvId = currentSession.ptv_id;
  }
  const codeVerifier = generatePkceVerifier();
  const codeChallenge = generatePkceChallenge(codeVerifier);
  const statePayload = {
    nonce: generatePkceVerifier(),
    timestamp: Date.now(),
    returnTo
  };
  if (action === "link" && linkingAccountId) {
    statePayload.action = "link";
    statePayload.account_id = linkingAccountId;
    statePayload.ptv_id = linkingPtvId;
  }
  const state = createHmacState(statePayload, authSecret);
  const isSecure = req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
  const cookieValue = `${state}:${codeVerifier}`;
  const stateCookie = serializeCookie("ptv_oauth_state", cookieValue, {
    maxAge: 300,
    path: "/api/auth",
    httpOnly: true,
    secure: isSecure,
    sameSite: "Lax"
  });
  appendSetCookieHeader(res, stateCookie);
  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", state);
  googleAuthUrl.searchParams.set("nonce", statePayload.nonce);
  googleAuthUrl.searchParams.set("code_challenge", codeChallenge);
  googleAuthUrl.searchParams.set("code_challenge_method", "S256");
  googleAuthUrl.searchParams.set("prompt", "select_account");
  googleAuthUrl.searchParams.set("access_type", "offline");
  if (isMockAllowed && urlObj.searchParams.get("mock") === "true") {
    const mockCallbackUrl = new URL(redirectUri);
    mockCallbackUrl.searchParams.set("code", "mock-auth-code");
    mockCallbackUrl.searchParams.set("state", state);
    if (urlObj.searchParams.get("mock_sub")) {
      mockCallbackUrl.searchParams.set("mock_sub", urlObj.searchParams.get("mock_sub"));
    }
    if (urlObj.searchParams.get("mock_email")) {
      mockCallbackUrl.searchParams.set("mock_email", urlObj.searchParams.get("mock_email"));
    }
    res.statusCode = 302;
    res.setHeader?.("Location", mockCallbackUrl.toString());
    res.end();
    return;
  }
  res.statusCode = 302;
  res.setHeader?.("Location", googleAuthUrl.toString());
  res.end();
}

// api/_routes/auth/google/status.ts
init_cookies();
init_crypto();
init_identity();
async function handler25(req, res) {
  res.setHeader?.("Content-Type", "application/json");
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  if (!sessionToken) {
    res.statusCode = 200;
    res.end(JSON.stringify({ authenticated: false, is_linked: false }));
    return;
  }
  const session = verifySessionToken(sessionToken, authSecret);
  if (!session || session.status_akun !== "active") {
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
      updated_at: status.updated_at || null
    })
  );
}

// api/_routes/auth/google/unlink.ts
init_cookies();
init_crypto();
init_identity();
async function handler26(req, res) {
  res.setHeader?.("Content-Type", "application/json");
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies["ptv_hub_session"];
  const authSecret = process.env.AUTH_SECRET || "";
  if (!sessionToken) {
    res.statusCode = 401;
    res.end(JSON.stringify({ success: false, error: "Sesi autentikasi tidak ditemukan. Silakan login kembali." }));
    return;
  }
  const session = verifySessionToken(sessionToken, authSecret);
  if (!session || session.status_akun !== "active") {
    res.statusCode = 401;
    res.end(JSON.stringify({ success: false, error: "Sesi login tidak sah atau telah kedaluwarsa." }));
    return;
  }
  const isStillActive = await verifyAccountStatusLive(session.account_id, session.iat, session);
  if (!isStillActive) {
    res.statusCode = 403;
    res.end(JSON.stringify({ success: false, error: "Akun Anda sedang nonaktif. Operasi pemutusan tautan ditolak." }));
    return;
  }
  const unlinkResult = await unlinkGoogleIdentityFromAccount(session.account_id);
  if (!unlinkResult.success) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: unlinkResult.error || "Gagal memutuskan tautan Google." }));
    return;
  }
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      success: true,
      message: "Tautan akun Google berhasil diputuskan dari akun PTVPRO Anda."
    })
  );
}

// api/_router.ts
var routes = {
  "acara": handler,
  "akses": handler2,
  "broadcast": handler3,
  "catatan": handler4,
  "dokumen": handler5,
  "finance": handler6,
  "inventaris": handler7,
  "kontak": handler8,
  "kru": handler9,
  "lapor-kerusakan": handler10,
  "lost-found": handler11,
  "peminjaman": handler12,
  "planner": handler13,
  "portal": handler14,
  "portofolio": handler15,
  "upload-avatar": handler16,
  "verifikasi-surat": handler17,
  "verifikasi-kru": handler18,
  "auth/change-password": handler19,
  "auth/login": handler20,
  "auth/logout": handler21,
  "auth/session": handler22,
  "auth/google/callback": handler23,
  "auth/google/login": handler24,
  "auth/google/status": handler25,
  "auth/google/unlink": handler26
};
function resolveRouteKey(req) {
  const paramRoute = req.query?.__route;
  if (paramRoute) {
    const raw = Array.isArray(paramRoute) ? paramRoute.join("/") : String(paramRoute);
    const cleaned = raw.split("?")[0].replace(/^\/+|\/+$/g, "");
    if (cleaned) return cleaned;
  }
  const routeParam = req.query?.route || req.query?.path;
  if (routeParam) {
    const raw = Array.isArray(routeParam) ? routeParam.join("/") : String(routeParam);
    const cleaned = raw.split("?")[0].replace(/^\/+|\/+$/g, "");
    if (cleaned) return cleaned;
  }
  const headerPath = req.headers?.["x-forwarded-uri"] || req.headers?.["x-invoke-path"] || req.headers?.["x-matched-path"];
  if (headerPath) {
    const cleanHeader = headerPath.split("?")[0];
    const match = cleanHeader.match(/^\/api(?:\/(.*))?$/);
    if (match) {
      return (match[1] || "").replace(/^\/+|\/+$/g, "");
    }
  }
  if (req.url) {
    const cleanUrl = req.url.split("?")[0];
    const match = cleanUrl.match(/^\/api(?:\/(.*))?$/);
    if (match) {
      return (match[1] || "").replace(/^\/+|\/+$/g, "");
    }
  }
  return "";
}
async function handler27(req, res) {
  const routeKey = resolveRouteKey(req);
  const originalUri = req.headers?.["x-forwarded-uri"];
  if (originalUri) {
    req.url = originalUri;
  } else if (req.url && req.url.startsWith("/api") && routeKey) {
    const urlObj = new URL(req.url, "http://localhost");
    urlObj.searchParams.delete("__route");
    const remainingQuery = urlObj.searchParams.toString();
    req.url = `/api/${routeKey}${remainingQuery ? `?${remainingQuery}` : ""}`;
  }
  if (req.query && "__route" in req.query) {
    delete req.query.__route;
  }
  if (!routeKey) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      status: "ok",
      service: "ptvpro-api",
      version: "1.0.0",
      routes: Object.keys(routes)
    }));
    return;
  }
  const routeHandler = routes[routeKey];
  if (!routeHandler) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      error: `Endpoint tidak ditemukan: /api/${routeKey}`,
      code: "endpoint_not_found"
    }));
    return;
  }
  try {
    await routeHandler(req, res);
  } catch (err) {
    console.error(`[Router Error] Failure in route /api/${routeKey}:`, err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: err?.message || "Terjadi kesalahan internal server.",
        code: "internal_server_error",
        route: routeKey
      }));
    }
  }
}
export {
  handler27 as default,
  resolveRouteKey,
  routes
};
