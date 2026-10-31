// ============================================================
// sw.js — Service Worker PTV PRO v2.1
// Robust PWA Offline Shell, Dynamic Asset Caching & Push
// ============================================================

const CACHE_NAME = 'ptv-pro-v2.1';

// Static Shell Assets for Instant PWA Startup
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest?v=3',
  '/favicon.ico',
];

// 1. INSTALL: Precache Shell Assets and Skip Waiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(PRECACHE_ASSETS);
      } catch (err) {
        console.warn('[SW] Precache asset fetch issue:', err);
      }
    })
  );
  self.skipWaiting();
});

// 2. ACTIVATE: Purge Obsolete Caches and Claim Clients Immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    )
  );
  self.clients.claim();
});

// 3. FETCH: Strict Caching Strategies with 100% Guaranteed Response Return
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only intercept GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Ignore non-http/https requests (e.g. chrome-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // A. PRIVACY & SECURITY GATE: Never cache private APIs or Database requests
  // Bypass Service Worker completely for /api/* and Supabase calls so native network handles them
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    return;
  }

  // B. SPA NAVIGATION REQUESTS (/hub/acara, /verifikasi-identitas, etc.)
  // Strategy: Network-First with Fallback to Cached /index.html Shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            // Update cached index.html shell in background
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(async () => {
          // Network failed or offline: Serve cached SPA shell /index.html
          const cachedShell = await caches.match('/index.html');
          if (cachedShell) {
            return cachedShell;
          }
          // Ultimate fallback if cache is empty
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>PTV PRO Offline</title></head><body style="font-family:sans-serif;padding:32px;text-align:center;"><h2>Anda Sedang Offline</h2><p>Koneksi internet tidak tersedia. Silakan periksa jaringan Anda lalu muat ulang halaman.</p><button onclick="window.location.reload()" style="padding:10px 20px;border-radius:8px;background:#1273e6;color:#fff;border:none;cursor:pointer;">Muat Ulang</button></body></html>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        })
    );
    return;
  }

  // C. STATIC ASSETS (JS, CSS, Fonts, Images, Icons)
  // Strategy: Stale-While-Revalidate for same-origin or static CDNs
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(js|css|woff2?|ttf|png|jpe?g|webp|svg|ico)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => {
            // Network fetch failed, will rely on cachedResponse if available
            return null;
          });

        // If in cache, return immediately while updating in background
        if (cachedResponse) {
          return cachedResponse;
        }

        // Not in cache, wait for network fetch
        return fetchPromise.then((res) => {
          if (res) return res;
          // Fallback response for missing images or assets
          if (/\.(png|jpe?g|webp|svg|ico)$/i.test(url.pathname)) {
            // 1x1 transparent GIF
            return new Response(
              new Uint8Array([
                0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
                0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00,
                0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
                0x00, 0x02, 0x01, 0x44, 0x00, 0x3b,
              ]),
              { status: 200, headers: { 'Content-Type': 'image/gif' } }
            );
          }
          return new Response('', { status: 404, statusText: 'Not Found' });
        });
      })
    );
    return;
  }

  // D. DEFAULT GET REQUESTS: Network-First with Cache Fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('', { status: 504, statusText: 'Gateway Timeout' });
      })
  );
});

// 4. CLIENT IDS FOR SENDER SUPPRESSION
const _activeClientIds = new Set();

// 5. PUSH NOTIFICATION HANDLER
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    return;
  }

  if (data.client_id && _activeClientIds.has(data.client_id)) return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients.some((c) => c.focused)) return;

      return self.registration.showNotification(data.title || 'PTV PRO', {
        body: data.message || data.body || '',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/favicon-32x32.png',
        tag: data.tag || 'ptv-notif',
        data: { url: data.action_url || '/hub' },
        vibrate: [100, 50, 100],
        requireInteraction: false,
      });
    })
  );
});

// 6. NOTIFICATION CLICK HANDLER
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/hub';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.navigate(targetUrl);
      } else {
        self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 7. MESSAGE EVENT
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'REGISTER_CLIENT_ID' && event.data.client_id) {
    _activeClientIds.add(event.data.client_id);
  }
  if (event.data.type === 'UNREGISTER_CLIENT_ID' && event.data.client_id) {
    _activeClientIds.delete(event.data.client_id);
  }
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
