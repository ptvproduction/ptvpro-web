import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gold' | 'neutral';
  shape?: 'pill' | 'rounded';
  dot?: boolean;
  standard?: 'r03' | 'legacy';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  shape = 'pill',
  dot = false,
  standard = 'legacy', // Preserves exact legacy appearance for old callers until Tahap C pilot migration
  children,
  style,
  className = '',
  ...props
}) => {
  const isR03 = standard === 'r03';
  const isPill = shape === 'pill';

  const getBadgeStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: isR03 ? '5px' : '4px',
      padding: isR03 ? '4px 10px' : '0.15rem 0.5rem',
      borderRadius: isPill
        ? isR03
          ? 'var(--r-full, 999px)'
          : 'var(--ptv-curve-pill)'
        : isR03
        ? 'var(--r-xs, 9px)'
        : 'var(--ptv-curve-xs)',
      fontSize: isR03 ? '11.5px' : '11px',
      fontWeight: isR03 ? 650 : 600,
      lineHeight: 1.2,
      letterSpacing: isR03 ? '-0.005em' : 'normal',
      whiteSpace: 'nowrap',
      fontFamily: 'var(--ptv-font-family, inherit)',
      border: '1px solid transparent',
    };

    switch (variant) {
      case 'success':
        return {
          ...base,
          backgroundColor: 'var(--ok-bg, #e1f5ee)',
          color: 'var(--ok, #0f7a5a)',
          borderColor: isR03 ? 'transparent' : 'rgba(15, 122, 90, 0.2)',
        };
      case 'warning':
        return {
          ...base,
          backgroundColor: 'var(--warn-bg, #fcf0d6)',
          color: 'var(--warn, #9a6b08)',
          borderColor: isR03 ? 'transparent' : 'rgba(154, 107, 8, 0.2)',
        };
      case 'danger':
        return {
          ...base,
          backgroundColor: 'var(--dang-bg, #fde8e6)',
          color: 'var(--dang, #b02b23)',
          borderColor: isR03 ? 'transparent' : 'rgba(176, 43, 35, 0.2)',
        };
      case 'info':
        return {
          ...base,
          backgroundColor: 'var(--info-bg, #e2edfd)',
          color: 'var(--info, #0b5fbf)',
          borderColor: isR03 ? 'transparent' : 'rgba(11, 95, 191, 0.2)',
        };
      case 'gold':
        return {
          ...base,
          backgroundColor: 'var(--accent-bg, #e2edfd)',
          color: 'var(--accent-fg, #0b5fbf)',
        };
      case 'neutral':
        return {
          ...base,
          backgroundColor: 'var(--neutral-bg, #e9f0f9)',
          color: 'var(--neutral-fg, #5a7793)',
        };
      default:
        return {
          ...base,
          backgroundColor: isR03 ? 'var(--neutral-bg, #e9f0f9)' : 'var(--surface, #ffffff)',
          color: isR03 ? 'var(--neutral-fg, #5a7793)' : 'var(--ink-2, #38587a)',
          border: isR03 ? '1px solid transparent' : 'var(--ptv-soft-border)',
        };
    }
  };

  const badgeStyles = getBadgeStyle();

  return (
    <span
      className={`${isR03 ? 'chip ' : ''}ptv-badge ${shape === 'rounded' ? 'ptv-curve-xs' : 'ptv-curve-pill'} ${className}`.trim()}
      style={{ ...badgeStyles, ...style }}
      {...props}
    >
      {dot && (
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: badgeStyles.color as string,
            opacity: 0.85,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};
