import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  standard?: 'r03' | 'legacy';
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  standard = 'legacy', // Preserves exact legacy styling for old callers until Tahap C pilot migration
  style,
  id,
  className = '',
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const isR03 = standard === 'r03';

  return (
    <div className={isR03 ? 'field' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: isR03 ? '6px' : '0.35rem' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: isR03 ? '12.5px' : '12px',
            color: 'var(--ink-2, #38587a)',
            fontWeight: isR03 ? 620 : 500,
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={`${isR03 ? 'input ' : ''}ptv-input ${isR03 ? 'ptv-curve-sm' : 'ptv-curve-md'} ${error ? 'is-error' : ''} ${className}`.trim()}
        style={{
          backgroundColor: isR03 ? 'var(--bg-2, #F7FBFF)' : 'var(--surface, #ffffff)',
          border: error ? '1.5px solid var(--dang, #b02b23)' : isR03 ? '1px solid var(--line, rgba(11,42,74,0.10))' : 'var(--ptv-soft-border)',
          borderRadius: isR03 ? 'var(--r-s, 13px)' : 'var(--ptv-curve-md)',
          color: 'var(--ink, #0b2a4a)',
          minHeight: isR03 ? '48px' : undefined,
          padding: isR03 ? '12px 15px' : '0.55rem 0.75rem',
          fontSize: isR03 ? '16px' : '13.5px', // 16px is required to avoid auto-zoom in mobile Safari
          fontFamily: 'var(--ptv-font-family, inherit)',
          outline: 'none',
          transition: isR03
            ? 'border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease'
            : 'border-color 0.16s ease, box-shadow 0.16s ease',
          boxSizing: 'border-box',
          width: '100%',
          ...style,
        }}
        {...props}
      />
      {error ? (
        <span id={`${inputId}-error`} role="alert" style={{ fontSize: isR03 ? '11.5px' : '11px', color: 'var(--dang, #b02b23)', fontWeight: isR03 ? 550 : 500, marginTop: '2px' }}>
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="hint" style={{ fontSize: '11.5px', color: 'var(--muted, #6e8cae)' }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
};
