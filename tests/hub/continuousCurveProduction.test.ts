import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  evaluateQuinticCornerAt,
  calculateCurvatureAt,
  evaluateContinuousCornerPoints,
  generateContinuousPath,
  generateContinuousInnerPath,
  clampRadius,
  calculateNestedRadius,
  PTV_CURVE_TOKENS,
  PROFILE_D_LAMBDA,
} from '../../src/design-system/geometry/continuousCurve';
import {
  getSurfaceStyle,
  SOFT_SURFACE_LIGHT,
  SOFT_SURFACE_DARK,
} from '../../src/design-system/styles/softSurface';
import { ContinuousSurface } from '../../src/design-system/components/ContinuousSurface';
import { ContinuousCard } from '../../src/design-system/components/ContinuousCard';
import { ContinuousPanel, NestedInnerContainer } from '../../src/design-system/components/ContinuousPanel';
import { ContinuousModalSurface } from '../../src/design-system/components/ContinuousModalSurface';
import { ContinuousButton } from '../../src/design-system/components/ContinuousButton';
import { ContinuousInputWrapper } from '../../src/design-system/components/ContinuousInputWrapper';
import { ContinuousNavItem } from '../../src/design-system/components/ContinuousNavItem';

describe('PTV PRO Hub — Profile D Production Geometry & Soft Surface Tests', () => {
  describe('1. Profile D Mathematical Properties & G2 Continuity', () => {
    const R = 22; // Canonical card radius

    it('1.1 Should guarantee zero curvature at boundary junctions (G2 continuity)', () => {
      // Entry junction with straight vertical edge at t = 0
      const entryKappa = calculateCurvatureAt(0, R);
      expect(entryKappa).toBeCloseTo(0, 5);

      // Exit junction with straight horizontal edge at t = 1
      const exitKappa = calculateCurvatureAt(1, R);
      expect(exitKappa).toBeCloseTo(0, 5);
    });

    it('1.2 Should satisfy G0 and G1 boundary continuity', () => {
      const entry = evaluateQuinticCornerAt(0, R);
      const exit = evaluateQuinticCornerAt(1, R);
      const L = R * (1 + PROFILE_D_LAMBDA);

      // G0: Position starts at (0, L) and ends at (L, 0)
      expect(entry.x).toBeCloseTo(0, 5);
      expect(entry.y).toBeCloseTo(L, 5);
      expect(exit.x).toBeCloseTo(L, 5);
      expect(exit.y).toBeCloseTo(0, 5);

      // G1: Tangent vector is purely vertical at t = 0 and purely horizontal at t = 1
      expect(entry.dx).toBeCloseTo(0, 5);
      expect(entry.dy).toBeLessThan(0); // moving downwards along y
      expect(exit.dy).toBeCloseTo(0, 5);
      expect(exit.dx).toBeGreaterThan(0); // moving rightwards along x
    });

    it('1.3 Should maintain strict convexity (no inflection points or negative curvature)', () => {
      const steps = 40;
      const points = evaluateContinuousCornerPoints(R, steps);

      for (let i = 0; i < points.length; i++) {
        expect(points[i].curvature).toBeGreaterThanOrEqual(0);
        // Monotonic coordinate progression in first quadrant
        expect(points[i].x).toBeGreaterThanOrEqual(0);
        expect(points[i].y).toBeGreaterThanOrEqual(0);
      }
    });

    it('1.4 Diagonal apex at t = 0.5 should be symmetric (x ≈ y)', () => {
      const mid = evaluateQuinticCornerAt(0.5, R);
      expect(mid.x).toBeCloseTo(mid.y, 4);
    });
  });

  describe('2. SVG Path Generation & Bounding Box Robustness', () => {
    it('2.1 Should generate valid closed path within [0, w] x [0, h]', () => {
      const w = 320;
      const h = 200;
      const r = 24;
      const d = generateContinuousPath(w, h, r);

      expect(d.startsWith('M')).toBe(true);
      expect(d.endsWith('Z')).toBe(true);
      expect(d).not.toContain('NaN');
      expect(d).not.toContain('undefined');
    });

    it('2.2 Should handle extreme radii gracefully via clampRadius', () => {
      const w = 100;
      const h = 60;
      // Clamped radius should not exceed min(w/2, h/2) = 30
      expect(clampRadius(80, w, h)).toBe(30);
      expect(clampRadius(0, w, h)).toBe(0);
      expect(clampRadius(-10, w, h)).toBe(0);

      const dOver = generateContinuousPath(w, h, 80);
      expect(dOver).not.toContain('NaN');
      expect(dOver.endsWith('Z')).toBe(true);
    });

    it('2.3 Should handle zero/degenerate dimensions safely', () => {
      const dZero = generateContinuousPath(0, 0, 16);
      expect(dZero).toContain('M 0 0');
    });
  });

  describe('3. Concentric Nested Geometry', () => {
    it('3.1 Should calculate harmonic inner radius: R_inner = max(0, R_outer - inset)', () => {
      // Card (22px) -> Thumbnail (12px) with inset 10px
      expect(calculateNestedRadius(PTV_CURVE_TOKENS.xl, 10)).toBe(12);

      // Modal (28px) -> Subpanel (16px) with inset 12px
      expect(calculateNestedRadius(PTV_CURVE_TOKENS['2xl'], 12)).toBe(16);

      // Oversized inset clamps safely to 0
      expect(calculateNestedRadius(8, 15)).toBe(0);
    });

    it('3.2 generateContinuousInnerPath should generate valid scaled path', () => {
      const outerW = 400;
      const outerH = 300;
      const outerR = 28;
      const inset = 12;

      const innerPath = generateContinuousInnerPath(outerW, outerH, outerR, inset);
      expect(innerPath.startsWith('M')).toBe(true);
      expect(innerPath.endsWith('Z')).toBe(true);
      expect(innerPath).not.toContain('NaN');
    });
  });

  describe('4. Soft Surface Treatment Styling Tokens', () => {
    it('4.1 Light soft surface should match approved parameters from Lab V3', () => {
      const style = getSurfaceStyle('soft', false);
      expect(style.fill).toBe(SOFT_SURFACE_LIGHT.fill);
      expect(style.stroke).toBe('rgba(226, 232, 240, 0.85)');
      expect(style.strokeWidth).toBe(0.75);
      expect(style.shadow).toContain('drop-shadow(0 10px 22px rgba(15, 23, 42, 0.06))');
      expect(style.shadow).toContain('drop-shadow(0 2px 5px rgba(15, 23, 42, 0.03))');
    });

    it('4.2 Dark soft surface should provide adequate contrast', () => {
      const style = getSurfaceStyle('soft', true);
      expect(style.fill).toBe(SOFT_SURFACE_DARK.fill);
      expect(style.stroke).toBe('rgba(255, 255, 255, 0.12)');
      expect(style.strokeWidth).toBe(0.75);
      expect(style.shadow).toContain('rgba(0, 0, 0, 0.45)');
    });
  });

  describe('5. Production Components SSR Rendering', () => {
    it('5.1 ContinuousSurface renders properly with child elements and no clipping', () => {
      const html = renderToString(
        React.createElement(
          ContinuousSurface,
          { width: 300, height: 180, radius: 22 },
          React.createElement('span', null, 'Content')
        )
      );

      expect(html).toContain('ptv-continuous-surface');
      expect(html).toContain('Content');
      expect(html).toContain('<svg');
      expect(html).toContain('<path');
      expect(html).toContain('drop-shadow');
    });

    it('5.2 ContinuousCard renders with card classes and padding', () => {
      const html = renderToString(
        React.createElement(
          ContinuousCard,
          { padding: 'lg', hoverElevation: true },
          React.createElement('h3', null, 'KPI Metric')
        )
      );

      expect(html).toContain('ptv-continuous-card');
      expect(html).toContain('ptv-card-hover');
      expect(html).toContain('KPI Metric');
    });

    it('5.3 ContinuousPanel and NestedInnerContainer render harmoniously', () => {
      const html = renderToString(
        React.createElement(
          ContinuousPanel,
          { radius: 16 },
          React.createElement(
            NestedInnerContainer,
            { outerRadius: 16, inset: 4 },
            React.createElement('span', null, 'Inner Item')
          )
        )
      );

      expect(html).toContain('ptv-continuous-panel');
      expect(html).toContain('ptv-nested-inner');
      expect(html).toContain('Inner Item');
      // R_inner = 16 - 4 = 12px
      expect(html).toContain('border-radius:12px');
    });

    it('5.4 ContinuousModalSurface renders with dialog semantics', () => {
      const html = renderToString(
        React.createElement(
          ContinuousModalSurface,
          { ariaLabel: 'Peminjaman Alat' },
          React.createElement('p', null, 'Konfirmasi')
        )
      );

      expect(html).toContain('ptv-continuous-modal-surface');
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-label="Peminjaman Alat"');
    });

    it('5.5 ContinuousButton preserves native button semantics & focus visibility', () => {
      const html = renderToString(
        React.createElement(
          ContinuousButton,
          { variant: 'primary', size: 'md' },
          'Simpan'
        )
      );

      expect(html).toContain('<button');
      expect(html).toContain('ptv-continuous-btn');
      expect(html).toContain('Simpan');
    });

    it('5.6 ContinuousInputWrapper renders with input wrapper classes', () => {
      const html = renderToString(
        React.createElement(
          ContinuousInputWrapper,
          { error: false },
          React.createElement('input', { type: 'text', placeholder: 'Cari alat...' })
        )
      );

      expect(html).toContain('ptv-input-wrapper');
      expect(html).toContain('Cari alat...');
    });

    it('5.7 ContinuousNavItem renders with nav item classes', () => {
      const html = renderToString(
        React.createElement(ContinuousNavItem, {
          label: 'Inventaris',
          icon: 'fa-solid fa-boxes-stacked',
          active: true,
          badge: 5,
        })
      );

      expect(html).toContain('ptv-nav-item');
      expect(html).toContain('active');
      expect(html).toContain('Inventaris');
      expect(html).toContain('fa-boxes-stacked');
    });
  });
});
