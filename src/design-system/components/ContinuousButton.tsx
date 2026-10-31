/**
 * PTV PRO HUB — Continuous Button Primitive
 * Accessible semantic button with continuous curvature & subtle soft surface styles
 */

import React from 'react';

export interface ContinuousButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'soft' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  radius?: number;
  isLoading?: boolean;
}

export const ContinuousButton = React.forwardRef<HTMLButtonElement, ContinuousButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      radius,
      isLoading = false,
      disabled,
      className = '',
      style = {},
      ...props
    },
    ref
  ) => {
    // Dynamic radius based on button size
    const effectiveRadius = radius ?? 9999;

    const getBaseStyles = (): React.CSSProperties => {
      const base: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: 600,
        fontFamily: 'var(--ptv-font-family, inherit)',
        borderRadius: `${effectiveRadius}px`,
        transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled || isLoading ? 0.6 : 1,
        touchAction: 'manipulation',
        userSelect: 'none',
        outline: 'none',
        position: 'relative',
      };

      const sizeStyles: Record<string, React.CSSProperties> = {
        sm: { height: '32px', padding: '0 12px', fontSize: '12px' },
        md: { height: '40px', padding: '0 16px', fontSize: '13px' },
        lg: { height: '48px', padding: '0 22px', fontSize: '15px' },
      };

      const variantStyles: Record<string, React.CSSProperties> = {
        primary: {
          backgroundColor: 'var(--b-600, #1273e6)',
          borderColor: 'transparent',
          color: '#ffffff',
          boxShadow: '0 2px 8px rgba(18, 115, 230, 0.28)',
        },
        secondary: {
          backgroundColor: 'var(--surface, #ffffff)',
          border: '0.75px solid rgba(226, 232, 240, 0.85)',
          color: 'var(--ink, #0b2a4a)',
          boxShadow: '0 1px 3px rgba(11, 60, 116, 0.05)',
        },
        soft: {
          backgroundColor: 'var(--b-050, #edf4ff)',
          border: '0.75px solid rgba(167, 206, 255, 0.40)',
          color: 'var(--b-700, #0b5fbf)',
        },
        outline: {
          backgroundColor: 'transparent',
          border: '1px solid var(--line, rgba(11, 42, 74, 0.15))',
          color: 'var(--ink, #0b2a4a)',
        },
        ghost: {
          backgroundColor: 'transparent',
          border: '1px solid transparent',
          color: 'var(--muted, #6e8cae)',
        },
        danger: {
          backgroundColor: 'var(--dang-bg, #fde8e6)',
          border: '0.75px solid rgba(176, 43, 35, 0.20)',
          color: 'var(--dang, #b02b23)',
        },
      };

      return { ...base, ...sizeStyles[size], ...variantStyles[variant], ...style };
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`ptv-continuous-btn ptv-curve-md ${className}`}
        style={getBaseStyles()}
        {...props}
      >
        {isLoading ? (
          <>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '12px' }} />
            <span>Memuat...</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

ContinuousButton.displayName = 'ContinuousButton';
