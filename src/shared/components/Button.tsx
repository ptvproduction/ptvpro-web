import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  shape?: 'pill' | 'rounded'; // R03 canonical standard is 'pill' (999px)
  isLoading?: boolean;
  loadingText?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  shape = 'rounded', // Default 'rounded' preserves existing caller layout; 'pill' activates R03 canonical spec
  isLoading = false,
  loadingText,
  disabled,
  style,
  className = '',
  ...props
}) => {
  const isPill = shape === 'pill';

  const getStyles = (): React.CSSProperties => {
    const radiusVal = isPill
      ? 'var(--r-full, 999px)'
      : size === 'sm'
      ? 'var(--ptv-curve-sm, 9px)'
      : size === 'lg'
      ? 'var(--ptv-curve-lg, 16px)'
      : 'var(--ptv-curve-md, 12px)';

    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      fontWeight: isPill ? 620 : 600,
      fontFamily: 'var(--ptv-font-family, inherit)',
      borderRadius: radiusVal,
      transition: 'transform 0.12s ease, background 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease',
      border: '1px solid transparent',
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      opacity: disabled || isLoading ? 0.45 : 1,
      minHeight: isPill ? (size === 'sm' ? '36px' : size === 'lg' ? '50px' : '46px') : undefined,
      letterSpacing: isPill ? '-0.015em' : 'normal',
    };

    const sizeStyles: Record<string, React.CSSProperties> = isPill
      ? {
          sm: { padding: '0 14px', fontSize: '13px' },
          md: { padding: '0 18px', fontSize: '14.5px' },
          lg: { padding: '0 24px', fontSize: '16px' },
        }
      : {
          sm: { padding: '0.35rem 0.65rem', fontSize: '12px' },
          md: { padding: '0.5rem 1rem', fontSize: '13.5px' },
          lg: { padding: '0.75rem 1.5rem', fontSize: '15px' },
        };

    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        background: isPill
          ? 'linear-gradient(150deg, var(--b-500, #3B8EF7), var(--b-700, #0B5FBF))'
          : 'var(--b-600, #1273e6)',
        color: '#ffffff',
        borderColor: 'transparent',
        boxShadow: isPill ? 'var(--shadow-blue, 0 8px 22px rgba(18,115,230,.28))' : '0 2px 8px rgba(18, 115, 230, 0.28)',
      },
      secondary: {
        backgroundColor: 'var(--surface, #ffffff)',
        border: isPill ? '1px solid var(--line, rgba(11,42,74,.10))' : 'var(--ptv-soft-border)',
        boxShadow: isPill ? 'var(--shadow-s)' : 'var(--ptv-soft-shadow)',
        color: 'var(--ink, #0b2a4a)',
      },
      danger: {
        backgroundColor: 'var(--dang-bg, #fde8e6)',
        border: isPill ? '1px solid rgba(176, 43, 35, 0.20)' : '0.75px solid rgba(176, 43, 35, 0.20)',
        color: 'var(--dang, #b02b23)',
      },
      ghost: {
        backgroundColor: 'transparent',
        borderColor: isPill ? 'var(--line)' : 'transparent',
        color: isPill ? 'var(--ink-2, #38587a)' : 'var(--muted, #6e8cae)',
      },
      gold: {
        backgroundColor: 'var(--b-100, #DCEBFF)',
        borderColor: 'transparent',
        color: 'var(--b-700, #0B5FBF)',
      },
    };

    return { ...base, ...sizeStyles[size], ...variantStyles[variant], ...style };
  };

  const curveClass = isPill
    ? 'ptv-curve-pill r03-pill-btn'
    : size === 'sm'
    ? 'ptv-curve-sm'
    : size === 'lg'
    ? 'ptv-curve-lg'
    : 'ptv-curve-md';

  return (
    <button
      disabled={disabled || isLoading}
      className={`ptv-btn ${curveClass} ${className}`}
      style={getStyles()}
      {...props}
    >
      {isLoading ? (
        <>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '13px', marginRight: '4px' }} />
          <span>{loadingText || 'Memuat...'}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};
