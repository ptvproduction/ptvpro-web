import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Memuat data...' }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        gap: '0.75rem',
        color: 'var(--text-secondary)',
      }}
    >
      <Loader2
        size={28}
        style={{
          animation: 'spin 1s linear infinite',
          color: 'var(--accent-cyan)',
        }}
      />
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <span style={{ fontSize: 'var(--text-sm)' }}>{message}</span>
    </div>
  );
};
