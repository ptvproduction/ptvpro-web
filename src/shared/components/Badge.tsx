import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  shape?: 'pill' | 'rounded';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  shape = 'pill',
  children,
  style,
  className = '',
  ...props
}) => {
  const getBadgeStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.15rem 0.5rem',
      borderRadius: shape === 'rounded' ? 'var(--ptv-curve-xs)' : 'var(--ptv-curve-pill)',
      fontSize: '11px',
      fontWeight: 600,
      lineHeight: 1.2,
      border: '1px solid transparent',
      fontFamily: 'var(--ptv-font-family, inherit)',
    };

    switch (variant) {
      case 'success':
        return { ...base, backgroundColor: 'var(--ok-bg, #e1f5ee)', color: 'var(--ok, #0f7a5a)', borderColor: 'rgba(15, 122, 90, 0.2)' };
      case 'warning':
        return { ...base, backgroundColor: 'var(--warn-bg, #fcf0d6)', color: 'var(--warn, #9a6b08)', borderColor: 'rgba(154, 107, 8, 0.2)' };
      case 'danger':
        return { ...base, backgroundColor: 'var(--dang-bg, #fde8e6)', color: 'var(--dang, #b02b23)', borderColor: 'rgba(176, 43, 35, 0.2)' };
      case 'info':
        return { ...base, backgroundColor: 'var(--info-bg, #e2edfd)', color: 'var(--info, #0b5fbf)', borderColor: 'rgba(11, 95, 191, 0.2)' };
      default:
        return { ...base, backgroundColor: 'var(--surface, #ffffff)', color: 'var(--ink-2, #38587a)', border: 'var(--ptv-soft-border)' };
    }
  };

  return (
    <span
      className={`ptv-badge ${shape === 'rounded' ? 'ptv-curve-xs' : 'ptv-curve-pill'} ${className}`}
      style={{ ...getBadgeStyle(), ...style }}
      {...props}
    >
      {children}
    </span>
  );
};
