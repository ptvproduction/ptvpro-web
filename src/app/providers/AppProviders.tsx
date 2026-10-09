import React, { useEffect } from 'react';
import { QueryProvider } from './QueryProvider';
import { useSessionStore } from '@core/session';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initSession = useSessionStore((state) => state.initSession);

  useEffect(() => {
    const unsubscribe = initSession();
    return () => {
      unsubscribe();
    };
  }, [initSession]);

  return <QueryProvider>{children}</QueryProvider>;
};
