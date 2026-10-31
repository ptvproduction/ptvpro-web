/**
 * PTV PRO HUB — Soft Surface Design Treatment
 * Canonical surface styling tokens approved from Surface Treatment Lab V3
 *
 * Characteristics:
 * - Subtle surface contrast (clean white or dark slate)
 * - Ultra-thin 0.75px contour-following border (never dominant or harsh)
 * - Organic multi-tiered ambient shadow:
 *   drop-shadow(0 10px 22px rgba(15, 23, 42, 0.06)) drop-shadow(0 2px 5px rgba(15, 23, 42, 0.03))
 */

export interface SurfaceStyleConfig {
  fill: string;
  stroke: string;
  strokeWidth: number;
  shadow: string;
  textColor: string;
}

export const SOFT_SURFACE_LIGHT: SurfaceStyleConfig = {
  fill: '#ffffff',
  stroke: 'rgba(226, 232, 240, 0.85)',
  strokeWidth: 0.75,
  shadow: 'drop-shadow(0 10px 22px rgba(15, 23, 42, 0.06)) drop-shadow(0 2px 5px rgba(15, 23, 42, 0.03))',
  textColor: '#0f172a',
};

export const SOFT_SURFACE_DARK: SurfaceStyleConfig = {
  fill: '#24282C',
  stroke: 'rgba(255, 255, 255, 0.12)',
  strokeWidth: 0.75,
  shadow: 'drop-shadow(0 10px 22px rgba(0, 0, 0, 0.45)) drop-shadow(0 2px 5px rgba(0, 0, 0, 0.25))',
  textColor: '#E8EAED',
};

export const SOFT_SURFACE_ELEVATED: SurfaceStyleConfig = {
  fill: '#ffffff',
  stroke: 'rgba(226, 232, 240, 0.90)',
  strokeWidth: 0.75,
  shadow: 'drop-shadow(0 16px 36px rgba(15, 23, 42, 0.09)) drop-shadow(0 4px 10px rgba(15, 23, 42, 0.04))',
  textColor: '#0f172a',
};

export const SOFT_SURFACE_FLAT: SurfaceStyleConfig = {
  fill: '#f8fafc',
  stroke: 'rgba(226, 232, 240, 0.75)',
  strokeWidth: 0.75,
  shadow: 'none',
  textColor: '#0f172a',
};

export const SOFT_SURFACE_OUTLINE: SurfaceStyleConfig = {
  fill: 'transparent',
  stroke: 'rgba(203, 213, 225, 0.90)',
  strokeWidth: 1.0,
  shadow: 'none',
  textColor: '#0f172a',
};

export type SurfaceVariant = 'soft' | 'elevated' | 'flat' | 'outline' | 'ghost';

export function getSurfaceStyle(variant: SurfaceVariant = 'soft', isDark = false): SurfaceStyleConfig {
  if (isDark) {
    if (variant === 'elevated') {
      return {
        ...SOFT_SURFACE_DARK,
        shadow: 'drop-shadow(0 18px 40px rgba(0, 0, 0, 0.60)) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.35))',
      };
    }
    if (variant === 'flat') {
      return {
        ...SOFT_SURFACE_DARK,
        fill: '#1B1E21',
        shadow: 'none',
      };
    }
    if (variant === 'outline') {
      return {
        ...SOFT_SURFACE_DARK,
        fill: 'transparent',
        stroke: 'rgba(255, 255, 255, 0.15)',
        shadow: 'none',
      };
    }
    if (variant === 'ghost') {
      return {
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
        shadow: 'none',
        textColor: '#e6f0fc',
      };
    }
    return SOFT_SURFACE_DARK;
  }

  switch (variant) {
    case 'elevated':
      return SOFT_SURFACE_ELEVATED;
    case 'flat':
      return SOFT_SURFACE_FLAT;
    case 'outline':
      return SOFT_SURFACE_OUTLINE;
    case 'ghost':
      return {
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
        shadow: 'none',
        textColor: '#0f172a',
      };
    case 'soft':
    default:
      return SOFT_SURFACE_LIGHT;
  }
}
