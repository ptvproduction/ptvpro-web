import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, style, ...props }) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--bg-card-border)',
        borderRadius: 'var(--radius-md)',
        backdropFilter: 'blur(12px)',
        padding: '1.25rem',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
