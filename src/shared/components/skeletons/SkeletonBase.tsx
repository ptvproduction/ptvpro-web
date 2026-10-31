import React from 'react';

export interface SkeletonBaseProps {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const SkeletonBase: React.FC<SkeletonBaseProps> = ({
  width = '100%',
  height = '16px',
  radius = '8px',
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`ptv-skeleton-block ${className}`}
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

