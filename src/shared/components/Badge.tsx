import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, style, ...props }) => {
  const getBadgeStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.15rem 0.5rem',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-xs)',
      fontWeight: 500,
      lineHeight: 1.2,
      border: '1px solid transparent',
    };

    switch (variant) {
      case 'success':
        return { ...base, backgroundColor: 'var(--status-success-bg)', color: '#6ee7b7', borderColor: 'rgba(16, 185, 129, 0.3)' };
      case 'warning':
        return { ...base, backgroundColor: 'var(--status-warning-bg)', color: '#fcd34d', borderColor: 'rgba(245, 158, 11, 0.3)' };
      case 'danger':
        return { ...base, backgroundColor: 'var(--status-danger-bg)', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.3)' };
      case 'info':
        return { ...base, backgroundColor: 'var(--status-info-bg)', color: '#93c5fd', borderColor: 'rgba(59, 130, 246, 0.3)' };
      default:
        return { ...base, backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', borderColor: 'var(--bg-card-border)' };
    }
  };

  return (
    <span style={{ ...getBadgeStyle(), ...style }} {...props}>
      {children}
    </span>
  );
};
