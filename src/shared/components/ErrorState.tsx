import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Terjadi Kesalahan',
  message = 'Gagal memuat data. Silakan coba lagi.',
  onRetry,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        gap: '0.75rem',
        borderRadius: 'var(--ptv-curve-xl)',
        border: '0.75px solid rgba(239, 68, 68, 0.3)',
        backgroundColor: 'var(--dang-bg, #fde8e6)',
      }}
    >
      <AlertTriangle size={32} style={{ color: 'var(--status-danger)' }} />
      <h4 style={{ fontSize: 'var(--text-base)', color: '#fca5a5', fontWeight: 600 }}>
        {title}
      </h4>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: '420px' }}>
        {message}
      </p>
      {onRetry && (
        <div style={{ marginTop: '0.5rem' }}>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Coba Lagi
          </Button>
        </div>
      )}
    </div>
  );
};
