import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  standard?: 'r03' | 'legacy';
}

export const Card: React.FC<CardProps> = ({
  children,
  standard = 'legacy', // Preserves exact legacy appearance for old callers (KruPage, ProtectedRoute) until Tahap C pilot migration
  style,
  className = '',
  ...props
}) => {
  const isR03 = standard === 'r03';

  return (
    <div
      className={`card ptv-card ${isR03 ? 'r03-card card-pad' : 'ptv-curve-xl ptv-soft-surface'} ${className}`}
      style={{
        backgroundColor: 'var(--surface, #ffffff)',
        border: isR03 ? '1px solid var(--line-2, rgba(11,42,74,0.055))' : 'var(--ptv-soft-border)',
        borderRadius: isR03 ? 'var(--r-ref-m, 18px)' : 'var(--ptv-curve-xl)',
        boxShadow: isR03 ? 'var(--shadow-s)' : 'var(--ptv-soft-shadow)',
        backdropFilter: isR03 ? undefined : 'blur(12px)',
        padding: isR03 ? '15px' : '1.25rem',
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
