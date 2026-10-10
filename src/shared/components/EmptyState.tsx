import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Tidak ada data',
  description = 'Belum ada data yang tersedia untuk ditampilkan.',
  action,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        textAlign: 'center',
        border: '1px dashed rgba(11, 42, 74, 0.15)',
        borderRadius: 'var(--ptv-curve-xl)',
        backgroundColor: 'var(--surface, #ffffff)',
        boxShadow: 'var(--ptv-soft-shadow)',
      }}
    >
      <Inbox size={36} style={{ color: 'var(--text-muted)' }} />
      <h4 style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', fontWeight: 600 }}>
        {title}
      </h4>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: '400px' }}>
        {description}
      </p>
      {action && <div style={{ marginTop: '0.5rem' }}>{action}</div>}
    </div>
  );
};
