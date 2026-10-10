/**
 * PTV PRO HUB — Reusable Continuous Surface Primitive
 * Canonical Profile D (G2 Quintic) with Soft Surface Treatment
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  generateContinuousPath,
  clampRadius,
  PTV_CURVE_TOKENS,
  ContinuousCurveParams,
} from '../geometry/continuousCurve';
import { getSurfaceStyle, SurfaceVariant } from '../styles/softSurface';

export interface ContinuousSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  radius?: number;
  variant?: SurfaceVariant;
  border?: boolean;
  interactive?: boolean;
  isDark?: boolean;
  params?: ContinuousCurveParams;
  children?: React.ReactNode;
  contentPadding?: string | number;
  as?: React.ElementType;
}

export const ContinuousSurface = React.forwardRef<HTMLDivElement, ContinuousSurfaceProps>(
  (
    {
      width,
      height,
      radius = PTV_CURVE_TOKENS.xl, // Default 22px canonical card radius
      variant = 'soft',
      border = true,
      interactive = false,
      isDark = false,
      params,
      children,
      contentPadding,
      as: Component = 'div',
      className = '',
      style = {},
      ...rest
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const containerRef = (forwardedRef as React.RefObject<HTMLDivElement>) || internalRef;

    // Measured dimensions for responsive SVG underlay
    const [measuredDimensions, setMeasuredDimensions] = useState<{ w: number; h: number }>({
      w: typeof width === 'number' ? width : 0,
      h: typeof height === 'number' ? height : 0,
    });

    const isFixedW = typeof width === 'number';
    const isFixedH = typeof height === 'number';

    useEffect(() => {
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
    const strokeWidth = border ? surfaceStyle.strokeWidth : 0;
    const strokeColor = border ? surfaceStyle.stroke : 'none';

    const effectiveW = measuredDimensions.w;
    const effectiveH = measuredDimensions.h;
    const clampedR = clampRadius(radius, effectiveW || 300, effectiveH || 200);

    const svgPath =
      effectiveW > 0 && effectiveH > 0
        ? generateContinuousPath(effectiveW, effectiveH, clampedR, 28, params)
        : '';

    const widthStyle = typeof width === 'number' ? `${width}px` : width || '100%';
    const heightStyle = typeof height === 'number' ? `${height}px` : height || 'auto';

    return (
      <Component
        ref={containerRef}
        className={`ptv-continuous-surface ptv-curve-xl ${className}`}
        style={{
          position: 'relative',
          width: widthStyle,
          height: heightStyle,
          boxSizing: 'border-box',
          filter: surfaceStyle.shadow,
          borderRadius: `${clampedR}px`, // Safe fallback before SVG render
          transition: interactive ? 'transform 0.18s ease, filter 0.18s ease' : undefined,
          cursor: interactive ? 'pointer' : undefined,
          ...style,
        }}
        {...rest}
      >
        {/* Profile D SVG Underlay Layer (No overflow: hidden to prevent popover/dropdown clipping) */}
        {effectiveW > 0 && effectiveH > 0 && (
          <svg
            width={effectiveW}
            height={effectiveH}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              pointerEvents: 'none',
              zIndex: 0,
              overflow: 'visible',
            }}
          >
            <path
              d={svgPath}
              fill={surfaceStyle.fill}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          </svg>
        )}

        {/* Content Layer (Unclipped with native stacking) */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            padding: contentPadding !== undefined ? contentPadding : undefined,
            color: surfaceStyle.textColor,
          }}
        >
          {children}
        </div>
      </Component>
    );
  }
);

ContinuousSurface.displayName = 'ContinuousSurface';
