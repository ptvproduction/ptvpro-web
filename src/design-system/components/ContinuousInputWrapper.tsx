/**
 * PTV PRO HUB — Continuous Input Wrapper Component
 * Semantic container with continuous corner geometry for form inputs
 */

import React from 'react';
import { PTV_CURVE_TOKENS } from '../geometry/continuousCurve';

export interface ContinuousInputWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  error?: boolean;
  disabled?: boolean;
  focused?: boolean;
  children?: React.ReactNode;
}

export const ContinuousInputWrapper = React.forwardRef<HTMLDivElement, ContinuousInputWrapperProps>(
  (
    {
      error = false,
      disabled = false,
      focused = false,
      children,
      className = '',
      style = {},
      ...rest
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`ptv-input-wrapper ptv-curve-md ${error ? 'is-error' : ''} ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          minHeight: '40px',
          borderRadius: `${PTV_CURVE_TOKENS.md}px`,
          backgroundColor: disabled ? 'var(--neutral-bg, #e9f0f9)' : 'var(--surface, #ffffff)',
          border: error
            ? '1.5px solid var(--dang, #b02b23)'
            : focused
            ? '1.5px solid var(--b-600, #1273e6)'
            : '0.75px solid rgba(226, 232, 240, 0.85)',
          boxShadow: focused ? '0 0 0 3px rgba(18, 115, 230, 0.15)' : 'none',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'visible', // Avoid clipping custom dropdowns or popovers
          ...style,
        }}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

ContinuousInputWrapper.displayName = 'ContinuousInputWrapper';
