import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, style, className = '', ...props }) => {
  return (
    <div
      className={`ptv-card ptv-curve-xl ptv-soft-surface ${className}`}
      style={{
        backgroundColor: 'var(--surface, #ffffff)',
        border: 'var(--ptv-soft-border)',
        borderRadius: 'var(--ptv-curve-xl)',
        boxShadow: 'var(--ptv-soft-shadow)',
        backdropFilter: 'blur(12px)',
        padding: '1.25rem',
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
