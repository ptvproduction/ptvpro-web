/**
 * PTV PRO HUB — Reusable Continuous Surface Primitive
 * Canonical Profile D (G2 Quintic) with Soft Surface Treatment
 *
 * Guarantees:
 * - Geometric Ground Truth: Exact G2 quintic Bézier closed path (λ=0.45, α=0.38, β=0.65)
 * - Contour-Following Border: SVG stroke directly renders the border along the quintic path
 * - Organic Silhouette Shadow: filter: drop-shadow(...) follows the exact SVG silhouette
 * - Exact Background Clipping: Optional SVG clipPath for background images / gradients
 * - Zero Circular Contamination: Enforces transparent CSS background/border so standard
 *   circular CSS border-radius never contaminates the Profile D contour
 */

import React, { useState, useLayoutEffect, useEffect, useRef, useId } from 'react';
import {
  generateContinuousPath,
  clampRadius,
  PTV_CURVE_TOKENS,
  ContinuousCurveParams,
} from '../geometry/continuousCurve';
import { getSurfaceStyle, SurfaceVariant } from '../styles/softSurface';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface ContinuousSurfaceProps extends React.HTMLAttributes<HTMLElement> {
  width?: number | string;
  height?: number | string;
  radius?: number;
  variant?: SurfaceVariant;
  border?: boolean;
  borderColor?: string;
  borderWidth?: number;
  fillColor?: string;
  shadow?: string | boolean;
  hoverShadow?: string;
  hoverBorderColor?: string;
  hoverElevation?: boolean;
  interactive?: boolean;
  isDark?: boolean;
  params?: ContinuousCurveParams;
  clipContent?: boolean;
  backgroundOverlay?: React.ReactNode;
  contentPadding?: string | number;
  as?: React.ElementType;
  type?: 'button' | 'submit' | 'reset';
  children?: React.ReactNode;
}

export const ContinuousSurface = React.forwardRef<HTMLElement, ContinuousSurfaceProps>(
  (
    {
      width,
      height,
      radius = PTV_CURVE_TOKENS.xl, // Default 22px canonical card radius
      variant = 'soft',
      border = true,
      borderColor,
      borderWidth,
      fillColor,
      shadow = true,
      hoverShadow,
      hoverBorderColor,
      hoverElevation = false,
      interactive = false,
      isDark = false,
      params,
      clipContent = false,
      backgroundOverlay,
      contentPadding,
      as: Component = 'div',
      className = '',
      style = {},
      children,
      onMouseEnter,
      onMouseLeave,
      ...rest
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLElement>(null);
    const containerRef = (forwardedRef as React.RefObject<HTMLElement>) || internalRef;
    const rawId = useId ? useId().replace(/[^a-zA-Z0-9_-]/g, '') : `surf-${Math.random().toString(36).substring(2, 9)}`;
    const clipId = `ptv-clip-${rawId}`;

    const [isHovered, setIsHovered] = useState(false);

    // Initial dimension estimation
    const isFixedW = typeof width === 'number';
    const isFixedH = typeof height === 'number';

    const [measuredDimensions, setMeasuredDimensions] = useState<{ w: number; h: number }>({
      w: isFixedW ? (width as number) : 0,
      h: isFixedH ? (height as number) : 0,
    });

    useIsomorphicLayoutEffect(() => {
      if (isFixedW && isFixedH) {
        setMeasuredDimensions({ w: width as number, h: height as number });
        return;
      }

      const node = containerRef.current;
      if (!node) return;

      const updateDimensions = () => {
        const rect = node.getBoundingClientRect();
        const w = isFixedW ? (width as number) : Math.round(rect.width);
        const h = isFixedH ? (height as number) : Math.round(rect.height);
        if (w > 0 && h > 0) {
          setMeasuredDimensions((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
        }
      };

      updateDimensions();

      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
          updateDimensions();
        });
        ro.observe(node);
        return () => ro.disconnect();
      }
    }, [width, height, isFixedW, isFixedH, containerRef]);

    const surfaceStyle = getSurfaceStyle(variant, isDark);
    const effectiveFill = fillColor !== undefined ? fillColor : surfaceStyle.fill;
    const effectiveStrokeWidth = borderWidth !== undefined ? borderWidth : border ? surfaceStyle.strokeWidth : 0;
    
    // Stroke color changes on hover if interactive/hoverElevation
    const baseStrokeColor = borderColor !== undefined ? borderColor : border ? surfaceStyle.stroke : 'none';
    const effectiveStrokeColor = (isHovered && (interactive || hoverElevation) && hoverBorderColor)
      ? hoverBorderColor
      : baseStrokeColor;

    // Shadow configuration
    const baseShadow = shadow === false ? 'none' : typeof shadow === 'string' ? shadow : surfaceStyle.shadow;
    const elevatedShadow = hoverShadow || (isDark
      ? 'drop-shadow(0 18px 40px rgba(0, 0, 0, 0.60)) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.35))'
      : 'drop-shadow(0 16px 36px rgba(15, 23, 42, 0.09)) drop-shadow(0 4px 10px rgba(15, 23, 42, 0.04))');
    const effectiveShadow = (isHovered && (interactive || hoverElevation)) ? elevatedShadow : baseShadow;

    const effectiveW = measuredDimensions.w;
    const effectiveH = measuredDimensions.h;
    const clampedR = clampRadius(radius, effectiveW || 300, effectiveH || 200);

    const svgPath =
      effectiveW > 0 && effectiveH > 0
        ? generateContinuousPath(effectiveW, effectiveH, clampedR, 28, params)
        : '';

    const widthStyle = typeof width === 'number' ? `${width}px` : width || '100%';
    const heightStyle = typeof height === 'number' ? `${height}px` : height || 'auto';

    const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
      setIsHovered(true);
      if (onMouseEnter) onMouseEnter(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
      setIsHovered(false);
      if (onMouseLeave) onMouseLeave(e);
    };

    const {
      display,
      flexDirection,
      alignItems,
      justifyContent,
      placeItems,
      placeContent,
      justifyItems,
      gap,
      padding,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
      textAlign,
      ...outerStyle
    } = (style as React.CSSProperties) || {};

    const contentLayout: React.CSSProperties = {
      display: display !== undefined ? display : 'block',
      flexDirection,
      alignItems,
      justifyContent,
      placeItems,
      placeContent,
      justifyItems,
      gap,
      padding: padding !== undefined ? padding : contentPadding !== undefined ? contentPadding : undefined,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
      textAlign,
    };

    return (
      <Component
        ref={containerRef as any}
        className={`ptv-continuous-surface ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'relative',
          width: widthStyle,
          height: heightStyle,
          boxSizing: 'border-box',
          // Ground truth: Background, border and box-shadow on the HTML container MUST be transparent/none
          // so that the only visible surface is the exact Profile D SVG contour!
          background: 'transparent',
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          border: 'none',
          boxShadow: 'none',
          borderRadius: 0,
          filter: effectiveShadow,
          transform: (isHovered && (interactive || hoverElevation)) ? 'translateY(-2px)' : undefined,
          transition: (interactive || hoverElevation)
            ? 'transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1), filter 0.18s ease'
            : undefined,
          cursor: (interactive || hoverElevation) ? 'pointer' : undefined,
          ...outerStyle,
        }}
        {...rest}
      >
        {/* Profile D SVG Ground Truth Layer */}
        {effectiveW > 0 && effectiveH > 0 && (
          <svg
            width={effectiveW}
            height={effectiveH}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 0,
              overflow: 'visible',
            }}
          >
            {/* Defs for Clipping if required */}
            {(clipContent || Boolean(backgroundOverlay)) && (
              <defs>
                <clipPath id={clipId}>
                  <path d={svgPath} />
                </clipPath>
              </defs>
            )}

            {/* Continuous Profile D Fill */}
            {effectiveFill !== 'transparent' && (
              <path
                d={svgPath}
                fill={effectiveFill}
                stroke="none"
              />
            )}
          </svg>
        )}

        {/* Optional Profile D Clipped Background Layer (e.g. Hero Banner Photo Mosaic / Gradients) */}
        {backgroundOverlay && effectiveW > 0 && effectiveH > 0 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              clipPath: `url(#${clipId})`,
              WebkitClipPath: `url(#${clipId})`,
              pointerEvents: 'none',
              zIndex: 0,
              overflow: 'hidden',
            }}
          >
            {backgroundOverlay}
          </div>
        )}

        {/* Top Stroke Layer: Ensures border is drawn cleanly on top of backgroundOverlay along the exact Profile D contour */}
        {effectiveW > 0 && effectiveH > 0 && effectiveStrokeWidth > 0 && (
          <svg
            width={effectiveW}
            height={effectiveH}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1,
              overflow: 'visible',
            }}
          >
            <path
              d={svgPath}
              fill="none"
              stroke={effectiveStrokeColor}
              strokeWidth={effectiveStrokeWidth}
              style={{
                transition: 'stroke 0.18s ease',
              }}
            />
          </svg>
        )}

        {/* Content Layer (Unclipped HTML with native stacking and full accessibility) */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            color: surfaceStyle.textColor,
            ...contentLayout,
          }}
        >
          {children}
        </div>
      </Component>
    );
  }
);

ContinuousSurface.displayName = 'ContinuousSurface';
