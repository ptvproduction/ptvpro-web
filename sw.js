// ============================================================
// sw.js — Service Worker PTV Pro v1.0
// PWA Cache & Web Push Notification
// ============================================================
const CACHE_NAME = 'ptv-pro-v1.1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/base.css',
  '/css/dashboard.css',
  '/css/login.css',
  '/js/bcrypt.min.js',
  '/manifest.json',
];

// Install: Pre-cache static assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: Bersihkan cache lama
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Network-first strategy
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Jangan intercept Supabase calls
  if (e.request.url.includes('supabase.co')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Client IDs untuk sender suppression
const _activeClientIds = new Set();

// Push Notification
self.addEventListener('push', (e) => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { return; }

  // Sender suppression
  if (data.client_id && _activeClientIds.has(data.client_id)) return;

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Jika tab sedang fokus, jangan tampilkan OS banner (biarkan in-app yang handle)
      if (clients.some(c => c.focused)) return;

      return self.registration.showNotification(data.title || 'PTV Pro', {
        body:  data.message || data.body || '',
        icon:  '/assets/icons/icon-192.png',
        badge: '/assets/icons/icon-32.png',
        tag:   data.tag || 'ptv-notif',
        data:  { url: data.action_url || '/' },
        vibrate: [100, 50, 100],
        requireInteraction: false,
      });
    })
  );
});

// Klik notifikasi — buka/fokus tab
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const targetUrl = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(targetUrl); }
      else self.clients.openWindow(targetUrl);
    })
  );
});

// Message dari dashboard: registrasi client ID
self.addEventListener('message', (e) => {
  if (!e.data) return;
  if (e.data.type === 'REGISTER_CLIENT_ID' && e.data.client_id) {
    _activeClientIds.add(e.data.client_id);
  }
  if (e.data.type === 'UNREGISTER_CLIENT_ID' && e.data.client_id) {
    _activeClientIds.delete(e.data.client_id);
  }
});
