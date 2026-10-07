// ============================================================
// js/router.js — SPA Hash Router (#beranda, #acara, dst.)
// ============================================================

const _routes = new Map();
let _currentRoute = null;
let _defaultRoute = 'beranda';

// Registrasi route
export function addRoute(hash, handlerFn) {
  _routes.set(hash, handlerFn);
}

// Inisialisasi router — dengarkan event hashchange
export function initRouter(defaultRoute = 'beranda') {
  _defaultRoute = defaultRoute;
  window.addEventListener('hashchange', _dispatch);
  _dispatch(); // Jalankan route awal
}

// Navigasi programatik
export function navigateTo(hash) {
  window.location.hash = '#' + hash;
}

export function getCurrentRoute() {
  return _currentRoute;
}

function _dispatch() {
  const raw = window.location.hash.replace('#', '').split(':')[0].trim();
  const route = raw || _defaultRoute;
  _currentRoute = route;

  const handler = _routes.get(route) || _routes.get(_defaultRoute);
  if (typeof handler === 'function') {
    handler(window.location.hash.replace('#', ''));
  }
}
