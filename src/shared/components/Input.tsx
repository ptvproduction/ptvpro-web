import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, style, id, ...props }) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {label && (
        <label htmlFor={inputId} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: error ? '1px solid var(--status-danger)' : '1px solid var(--bg-card-border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          padding: '0.55rem 0.75rem',
          fontSize: 'var(--text-sm)',
          outline: 'none',
          transition: 'border-color var(--transition-fast)',
          ...style,
        }}
        {...props}
      />
      {error && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--status-danger)' }}>
          {error}
        </span>
      )}
    </div>
  );
};
