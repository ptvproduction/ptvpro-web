import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from '@app/router';
import { AppProviders } from '@app/providers/AppProviders';
import { useSessionStore } from '@core/session';
import './styles/base.css';

if (typeof window !== 'undefined') {
  (window as any).__sessionStore = useSessionStore;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </AppProviders>
  </React.StrictMode>
);
