import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, style, id, className = '', ...props }) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {label && (
        <label htmlFor={inputId} style={{ fontSize: '12px', color: 'var(--ink-2, #38587a)', fontWeight: 500 }}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`ptv-input ptv-curve-md ${error ? 'is-error' : ''} ${className}`}
        style={{
          backgroundColor: 'var(--surface, #ffffff)',
          border: error ? '1.5px solid var(--dang, #b02b23)' : 'var(--ptv-soft-border)',
          borderRadius: 'var(--ptv-curve-md)',
          color: 'var(--ink, #0b2a4a)',
          padding: '0.55rem 0.75rem',
          fontSize: '13.5px',
          fontFamily: 'var(--ptv-font-family, inherit)',
          outline: 'none',
          transition: 'border-color 0.16s ease, box-shadow 0.16s ease',
          boxSizing: 'border-box',
          ...style,
        }}
        {...props}
      />
      {error && (
        <span style={{ fontSize: '11px', color: 'var(--dang, #b02b23)', fontWeight: 500 }}>
          {error}
        </span>
      )}
    </div>
  );
};
