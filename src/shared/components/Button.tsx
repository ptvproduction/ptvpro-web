import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  style,
  className = '',
  ...props
}) => {
  const getStyles = (): React.CSSProperties => {
    const radiusVar =
      size === 'sm'
        ? 'var(--ptv-curve-sm)'
        : size === 'lg'
        ? 'var(--ptv-curve-lg)'
        : 'var(--ptv-curve-md)';

    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      fontWeight: 600,
      fontFamily: 'var(--ptv-font-family, inherit)',
      borderRadius: radiusVar,
      transition: 'all 0.16s ease',
      border: '1px solid transparent',
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      opacity: disabled || isLoading ? 0.6 : 1,
    };

    const sizeStyles: Record<string, React.CSSProperties> = {
      sm: { padding: '0.35rem 0.65rem', fontSize: '12px' },
      md: { padding: '0.5rem 1rem', fontSize: '13.5px' },
      lg: { padding: '0.75rem 1.5rem', fontSize: '15px' },
    };

    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        backgroundColor: 'var(--b-600, #1273e6)',
        color: '#ffffff',
        boxShadow: '0 2px 8px rgba(18, 115, 230, 0.28)',
      },
      secondary: {
        backgroundColor: 'var(--surface, #ffffff)',
        border: 'var(--ptv-soft-border)',
        boxShadow: 'var(--ptv-soft-shadow)',
        color: 'var(--ink, #0b2a4a)',
      },
      danger: {
        backgroundColor: 'var(--dang-bg, #fde8e6)',
        border: '0.75px solid rgba(176, 43, 35, 0.20)',
        color: 'var(--dang, #b02b23)',
      },
      ghost: {
        backgroundColor: 'transparent',
        color: 'var(--muted, #6e8cae)',
      },
    };

    return { ...base, ...sizeStyles[size], ...variantStyles[variant], ...style };
  };

  const curveClass =
    size === 'sm' ? 'ptv-curve-sm' : size === 'lg' ? 'ptv-curve-lg' : 'ptv-curve-md';

  return (
    <button
      disabled={disabled || isLoading}
      className={`ptv-btn ${curveClass} ${className}`}
      style={getStyles()}
      {...props}
    >
      {isLoading ? <span>Memuat...</span> : children}
    </button>
  );
};
