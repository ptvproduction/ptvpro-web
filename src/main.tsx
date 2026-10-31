import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from '@app/router';
import { AppProviders } from '@app/providers/AppProviders';
import { useSessionStore } from '@core/session';
import './styles/base.css';

if (typeof window !== 'undefined') {
  (window as any).__sessionStore = useSessionStore;

  // Register PWA Service Worker non-blocking
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // Check for worker updates
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (installing) {
              installing.addEventListener('statechange', () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content is available, signal skip waiting
                  installing.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('[SW Registration Error]:', err);
        });
    });
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </AppProviders>
  </React.StrictMode>
);
