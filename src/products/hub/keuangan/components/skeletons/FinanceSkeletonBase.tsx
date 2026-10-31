import React from 'react';

export interface FinanceSkeletonBaseProps {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const FinanceSkeletonBase: React.FC<FinanceSkeletonBaseProps> = ({
  width = '100%',
  height = '16px',
  radius = 'var(--ptv-corner-sm, 8px)',
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`fin-skel-block ${className}`}
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
};
