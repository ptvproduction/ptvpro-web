/**
 * PTV PRO HUB — Continuous Modal Surface Component
 * Dialog container utilizing Profile D (28px) Elevated Soft Surface
 */

import React from 'react';
import { ContinuousSurface, ContinuousSurfaceProps } from './ContinuousSurface';
import { PTV_CURVE_TOKENS } from '../geometry/continuousCurve';

export interface ContinuousModalSurfaceProps extends ContinuousSurfaceProps {
  maxWidth?: string | number;
  onClose?: () => void;
  ariaLabel?: string;
}

export const ContinuousModalSurface = React.forwardRef<HTMLDivElement, ContinuousModalSurfaceProps>(
  (
    {
      radius = PTV_CURVE_TOKENS['2xl'], // 28px canonical modal radius
      variant = 'elevated',
      maxWidth = '540px',
      contentPadding = '24px 28px',
      clipContent = true,
      ariaLabel,
      className = '',
      style = {},
      children,
      ...rest
    },
    ref
  ) => {
    return (
      <ContinuousSurface
        ref={ref}
        radius={radius}
        variant={variant}
        contentPadding={contentPadding}
        clipContent={clipContent}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`ptv-continuous-modal-surface ${className}`}
        style={{
          width: '100%',
          maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
          margin: '0 auto',
          position: 'relative',
          ...style,
        }}
        {...rest}
      >
        {children}
      </ContinuousSurface>
    );
  }
);

ContinuousModalSurface.displayName = 'ContinuousModalSurface';
