/**
 * PTV PRO HUB — Continuous Card Component
 * Production implementation of Profile D Soft Surface Card
 */

import React from 'react';
import { ContinuousSurface, ContinuousSurfaceProps } from './ContinuousSurface';
import { PTV_CURVE_TOKENS } from '../geometry/continuousCurve';

export interface ContinuousCardProps extends Omit<ContinuousSurfaceProps, 'contentPadding'> {
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  hoverElevation?: boolean;
}

const PADDING_MAP = {
  none: 0,
  sm: '12px',
  md: '16px',
  lg: '20px',
  xl: '24px',
};

export const ContinuousCard = React.forwardRef<HTMLDivElement, ContinuousCardProps>(
  (
    {
      padding = 'md',
      hoverElevation = false,
      radius = PTV_CURVE_TOKENS.xl, // 22px
      interactive = false,
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
        contentPadding={PADDING_MAP[padding]}
        interactive={interactive || hoverElevation}
        className={`ptv-continuous-card ${hoverElevation ? 'ptv-card-hover' : ''} ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          ...style,
        }}
        {...rest}
      >
        {children}
      </ContinuousSurface>
    );
  }
);

ContinuousCard.displayName = 'ContinuousCard';
