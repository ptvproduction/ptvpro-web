/**
 * PTV PRO HUB — Continuous Navigation Item Component
 * Sidebar & navigation control with continuous curvature
 */

import React from 'react';
import { PTV_CURVE_TOKENS } from '../geometry/continuousCurve';

export interface ContinuousNavItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: string;
  badge?: string | number;
  label: string;
}

export const ContinuousNavItem = React.forwardRef<HTMLButtonElement, ContinuousNavItemProps>(
  (
    {
      active = false,
      icon,
      badge,
      label,
      className = '',
      style = {},
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        className={`ptv-nav-item ptv-curve-md ${active ? 'active' : ''} ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          width: '100%',
          padding: '10px 14px',
          borderRadius: `${PTV_CURVE_TOKENS.md}px`,
          backgroundColor: active ? 'var(--b-050, #edf4ff)' : 'transparent',
          color: active ? 'var(--b-700, #0b5fbf)' : 'var(--ink-2, #38587a)',
          fontWeight: active ? 600 : 500,
          fontSize: '13px',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background-color 0.15s ease, color 0.15s ease',
          outline: 'none',
          boxSizing: 'border-box',
          ...style,
        }}
        {...props}
      >
        {icon && (
          <span
            style={{
              fontSize: '15px',
              width: '20px',
              textAlign: 'center',
              color: active ? 'var(--b-600, #1273e6)' : 'var(--muted, #6e8cae)',
            }}
          >
            <i className={icon} />
          </span>
        )}
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
        {badge !== undefined && (
          <span
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: `${PTV_CURVE_TOKENS.xs}px`,
              backgroundColor: active ? 'var(--b-600, #1273e6)' : 'var(--line-2, #f1f5f9)',
              color: active ? '#ffffff' : 'var(--muted, #6e8cae)',
            }}
          >
            {badge}
          </span>
        )}
      </button>
    );
  }
);

ContinuousNavItem.displayName = 'ContinuousNavItem';
