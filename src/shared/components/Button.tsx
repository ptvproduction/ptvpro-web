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
  ...props
}) => {
  const getStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      fontWeight: 500,
      borderRadius: 'var(--radius-sm)',
      transition: 'all var(--transition-fast)',
      border: '1px solid transparent',
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      opacity: disabled || isLoading ? 0.6 : 1,
    };

    const sizeStyles: Record<string, React.CSSProperties> = {
      sm: { padding: '0.35rem 0.65rem', fontSize: 'var(--text-xs)' },
      md: { padding: '0.5rem 1rem', fontSize: 'var(--text-sm)' },
      lg: { padding: '0.75rem 1.5rem', fontSize: 'var(--text-base)' },
    };

    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        backgroundColor: 'var(--accent-cyan)',
        color: 'var(--text-inverse)',
        boxShadow: '0 0 10px var(--accent-glow)',
      },
      secondary: {
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--bg-card-border)',
        color: 'var(--text-primary)',
      },
      danger: {
        backgroundColor: 'var(--status-danger-bg)',
        borderColor: 'var(--status-danger)',
        color: '#fca5a5',
      },
      ghost: {
        backgroundColor: 'transparent',
        color: 'var(--text-secondary)',
      },
    };

    return { ...base, ...sizeStyles[size], ...variantStyles[variant], ...style };
  };

  return (
    <button disabled={disabled || isLoading} style={getStyles()} {...props}>
      {isLoading ? <span>Memuat...</span> : children}
    </button>
  );
};
