/**
 * PTV PRO HUB — Continuous Panel Component
 * Standard panel container with harmonic nested corner geometry
 */

import React from 'react';
import { ContinuousSurface, ContinuousSurfaceProps } from './ContinuousSurface';
import { PTV_CURVE_TOKENS, calculateNestedRadius } from '../geometry/continuousCurve';

export interface ContinuousPanelProps extends ContinuousSurfaceProps {
  padding?: string | number;
  inset?: number; // Inset for nested corner calculation
}

export const ContinuousPanel = React.forwardRef<HTMLDivElement, ContinuousPanelProps>(
  (
    {
      radius = PTV_CURVE_TOKENS.lg, // 16px canonical panel radius
      padding = '20px 24px',
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
        contentPadding={padding}
        className={`ptv-continuous-panel ${className}`}
        style={{
          width: '100%',
          ...style,
        }}
        {...rest}
      >
        {children}
      </ContinuousSurface>
    );
  }
);

ContinuousPanel.displayName = 'ContinuousPanel';

/**
 * Harmonic nested inner container
 * Ensures R_inner = max(0, outerRadius - inset)
 */
export interface NestedInnerContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  outerRadius: number;
  inset: number;
  children?: React.ReactNode;
}

export const NestedInnerContainer: React.FC<NestedInnerContainerProps> = ({
  outerRadius,
  inset,
  children,
  style = {},
  className = '',
  ...props
}) => {
  const innerR = calculateNestedRadius(outerRadius, inset);

  return (
    <div
      className={`ptv-nested-inner ${className}`}
      style={{
        borderRadius: `${innerR}px`,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
