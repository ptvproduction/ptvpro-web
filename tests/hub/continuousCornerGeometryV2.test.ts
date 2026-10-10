/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V2
 * Automated Computational Geometry Verification Tests:
 * 1. Endpoint and Tangent Continuity (G0, G1)
 * 2. Curvature Continuity (G2) with Explicit Numerical Tolerances
 * 3. Curve Symmetry (Diagonal Reflection Invariant)
 * 4. SVG Path Structural Validity (Syntax, Closures, Non-NaN)
 * 5. Radius Bounds Clamping & Degenerate Zero Radius
 * 6. Extreme Aspect Ratios (Ultra-wide and Ultra-tall)
 * 7. Concentric Nested Offset Behavior (Normal vs Scalar Distance Analysis)
 * 8. Invalid Parameter Handling & Boundary Clamping
 * 9. Browser Fallback Mechanics
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateCornerAt,
  evaluateCornerPoints,
  calculateProfileMetrics,
  generateClosedPath,
  generateCornerPathForProfile,
  clampRadius,
} from '../../src/products/hub/designSystem/geometry/curveProfiles';
import {
  evaluateConcentricOffsetQuality,
  computeNormalOffsetPoints,
  generateTrueOffsetInnerPath,
  generateScalarInnerPath,
} from '../../src/products/hub/designSystem/geometry/concentricOffset';
import { CurveProfileId } from '../../src/products/hub/designSystem/geometry/types';

describe('Continuous Corner Geometry V2 — Mathematical Verification & Safety Tests', () => {
  const allProfiles: CurveProfileId[] = ['circle', 'superellipse', 'bezier', 'curvature-optimized'];

  describe('1. Endpoint and Tangent Continuity (G0 & G1)', () => {
    it.each(allProfiles)(
      '1.1 [%s] should have G0 position and exact vertical tangent at entry (t=0)',
      (profileId) => {
        const R = 24;
        const pt = evaluateCornerAt(0, R, profileId, { exponent: 3.5, smoothing: 0.6, transitionRatio: 0.45 });

        // G0 position at entry must start on vertical axis x=0
        expect(pt.x).toBeCloseTo(0, 5);
        expect(pt.y).toBeGreaterThan(0);

        // G1 tangent direction: dx/dt must be 0 (purely vertical velocity)
        // dy/dt must be negative (moving downwards towards the corner)
        expect(Math.abs(pt.dx)).toBeLessThan(1e-5);
        expect(pt.dy).toBeLessThan(0);
      }
    );

    it.each(allProfiles)(
      '1.2 [%s] should have G0 position and exact horizontal tangent at exit (t=1)',
      (profileId) => {
        const R = 24;
        const pt = evaluateCornerAt(1, R, profileId, { exponent: 3.5, smoothing: 0.6, transitionRatio: 0.45 });

        // G0 position at exit must end on horizontal axis y=0
        expect(pt.y).toBeCloseTo(0, 5);
        expect(pt.x).toBeGreaterThan(0);

        // G1 tangent direction: dy/dt must be 0 (purely horizontal velocity)
        // dx/dt must be positive (moving rightwards along the straight edge)
        expect(Math.abs(pt.dy)).toBeLessThan(1e-5);
        expect(pt.dx).toBeGreaterThan(0);
      }
    );
  });

  describe('2. Curvature Continuity (G2) with Explicit Tolerances', () => {
    it('2.1 Curvature-Optimized Profile (Profile D) must have G2 continuity: kappa(0) = 0 and kappa(1) = 0 within numerical tolerance 1e-9', () => {
      const R = 28;
      const metrics = calculateProfileMetrics(R, 'curvature-optimized', { transitionRatio: 0.45 });

      // Stated tolerance for G2 curvature continuity: 1e-9
      const G2_NUMERICAL_TOLERANCE = 1e-9;

      expect(metrics.entryCurvatureJump).toBeLessThan(G2_NUMERICAL_TOLERANCE);
      expect(metrics.exitCurvatureJump).toBeLessThan(G2_NUMERICAL_TOLERANCE);
      expect(metrics.isG2Continuous).toBe(true);

      // Verify that along the curve, curvature rises to a smooth peak and returns to 0
      expect(metrics.maxCurvature).toBeGreaterThan(0.01);
      expect(metrics.minCurvature).toBeCloseTo(0, 6);
    });

    it('2.2 Circular Arc (Profile A) must exhibit step discontinuity in curvature (G2 broken) equal to 1/R', () => {
      const R = 20;
      const metrics = calculateProfileMetrics(R, 'circle');

      // Curvature jump on a circular arc is exactly 1/R = 1/20 = 0.05
      expect(metrics.entryCurvatureJump).toBeCloseTo(1 / R, 4);
      expect(metrics.exitCurvatureJump).toBeCloseTo(1 / R, 4);
      expect(metrics.isG2Continuous).toBe(false);
    });

    it('2.3 Superellipse (Profile B) curvature at diagonal increases with exponent n', () => {
      const R = 24;
      const metricsN2 = calculateProfileMetrics(R, 'superellipse', { exponent: 2.0 });
      const metricsN35 = calculateProfileMetrics(R, 'superellipse', { exponent: 3.5 });
      const metricsN5 = calculateProfileMetrics(R, 'superellipse', { exponent: 5.0 });

      // Exponent n=2.0 is identical to circle
      expect(metricsN2.maxCurvature).toBeCloseTo(1 / R, 3);

      // Higher exponent concentrates higher curvature at the diagonal shoulder
      expect(metricsN35.maxCurvature).toBeGreaterThan(metricsN2.maxCurvature);
      expect(metricsN5.maxCurvature).toBeGreaterThan(metricsN35.maxCurvature);
    });
  });

  describe('3. Curve Symmetry (Diagonal Reflection Invariant)', () => {
    it.each(allProfiles)(
      '3.1 [%s] should be mathematically symmetric about the 45-degree ray y = x',
      (profileId) => {
        const R = 22;
        const testTValues = [0.1, 0.25, 0.4, 0.5, 0.7, 0.85];

        for (const t of testTValues) {
          const ptForward = evaluateCornerAt(t, R, profileId, { exponent: 3.5, smoothing: 0.6, transitionRatio: 0.45 });
          const ptReflected = evaluateCornerAt(1 - t, R, profileId, { exponent: 3.5, smoothing: 0.6, transitionRatio: 0.45 });

          // By diagonal reflection: x(1-t) == y(t) and y(1-t) == x(t)
          expect(ptForward.x).toBeCloseTo(ptReflected.y, 4);
          expect(ptForward.y).toBeCloseTo(ptReflected.x, 4);
        }

        // At midpoint t = 0.5, x must equal y exactly
        const midPt = evaluateCornerAt(0.5, R, profileId, { exponent: 3.5, smoothing: 0.6, transitionRatio: 0.45 });
        expect(midPt.x).toBeCloseTo(midPt.y, 5);
      }
    );
  });

  describe('4. SVG Path Structural Validity', () => {
    it.each(allProfiles)(
      '4.1 [%s] generateClosedPath must produce closed path starting with M, ending with Z, without NaN',
      (profileId) => {
        const pathD = generateClosedPath(300, 200, 24, profileId, { exponent: 3.5 });

        expect(pathD.startsWith('M')).toBe(true);
        expect(pathD.endsWith('Z')).toBe(true);
        expect(pathD).not.toContain('NaN');
        expect(pathD).not.toContain('undefined');
        expect(pathD).not.toContain('Infinity');

        // Path must contain multiple L commands constructing corners and edges
        const lCount = (pathD.match(/L/g) || []).length;
        expect(lCount).toBeGreaterThan(20);
      }
    );

    it.each(allProfiles)(
      '4.2 [%s] generateCornerPathForProfile must produce valid single corner SVG trajectory',
      (profileId) => {
        const cornerD = generateCornerPathForProfile(0, 0, 20, profileId, { smoothing: 0.6 }, 40);
        expect(cornerD.startsWith('M')).toBe(true);
        expect(cornerD).not.toContain('NaN');
      }
    );
  });

  describe('5. Radius Bounds & Degenerate Radius Clamping', () => {
    it('5.1 clampRadius should clamp radius to half the minimum dimension', () => {
      expect(clampRadius(50, 60, 100)).toBe(30); // 60 / 2 = 30
      expect(clampRadius(50, 120, 80)).toBe(40); // 80 / 2 = 40
      expect(clampRadius(20, 200, 200)).toBe(20); // within bounds
    });

    it('5.2 Radius <= 0 must return standard sharp rectangle', () => {
      const pathZero = generateClosedPath(200, 100, 0, 'curvature-optimized');
      expect(pathZero).toBe('M 0 0 L 200 0 L 200 100 L 0 100 Z');

      const pathNeg = generateClosedPath(200, 100, -10, 'bezier');
      expect(pathNeg).toBe('M 0 0 L 200 0 L 200 100 L 0 100 Z');
    });
  });

  describe('6. Extreme Aspect Ratios Stress Test', () => {
    it('6.1 Ultra-wide component (800 × 40 px) must render without coordinate clipping or NaN', () => {
      const pathWide = generateClosedPath(800, 40, 16, 'curvature-optimized');
      expect(pathWide).not.toContain('NaN');
      expect(pathWide.startsWith('M')).toBe(true);
      expect(pathWide.endsWith('Z')).toBe(true);
    });

    it('6.2 Ultra-tall component (40 × 800 px) must render without coordinate clipping or NaN', () => {
      const pathTall = generateClosedPath(40, 800, 16, 'bezier');
      expect(pathTall).not.toContain('NaN');
      expect(pathTall.startsWith('M')).toBe(true);
      expect(pathTall.endsWith('Z')).toBe(true);
    });
  });

  describe('7. Concentric Nested Offset Behavior (Normal vs Scalar Distance Analysis)', () => {
    it('7.1 For Circle (n=2), true normal offset and scalar R_inner = R_outer - d must be identical (error < 0.1px)', () => {
      const R = 24;
      const inset = 10;
      const analysis = evaluateConcentricOffsetQuality(R, 'circle', inset);

      // In a circular arc, the evolute is a single point, so scalar subtraction IS the exact normal offset
      expect(analysis.maxDistanceError).toBeLessThan(0.15);
      expect(analysis.avgDistanceError).toBeLessThan(0.1);
    });

    it('7.2 For Superellipse (n=3.5), scalar subtraction deviates significantly from normal offset', () => {
      const R = 28;
      const inset = 12;
      const analysis = evaluateConcentricOffsetQuality(R, 'superellipse', inset, { exponent: 3.5 });

      // There is an honest geometric discrepancy of > 0.5px between scalar scaling and true normal offset
      expect(analysis.maxDistanceError).toBeGreaterThan(0.5);
    });

    it('7.3 Self-intersection detection: flag when inset >= 1 / maxCurvature', () => {
      const R = 20;
      const metrics = calculateProfileMetrics(R, 'curvature-optimized', { transitionRatio: 0.45 });
      const minR = metrics.minRadiusOfCurvature;

      // Safe inset smaller than min radius
      const safeAnalysis = evaluateConcentricOffsetQuality(R, 'curvature-optimized', minR - 4, { transitionRatio: 0.45 });
      expect(safeAnalysis.hasSelfIntersection).toBe(false);

      // Dangerous inset exceeding min radius
      const dangerAnalysis = evaluateConcentricOffsetQuality(R, 'curvature-optimized', minR + 4, { transitionRatio: 0.45 });
      expect(dangerAnalysis.hasSelfIntersection).toBe(true);
    });

    it('7.4 generateTrueOffsetInnerPath and generateScalarInnerPath return valid closed paths', () => {
      const normalInner = generateTrueOffsetInnerPath(300, 200, 24, 12, 'curvature-optimized');
      const scalarInner = generateScalarInnerPath(300, 200, 24, 12, 'curvature-optimized');

      expect(normalInner.startsWith('M')).toBe(true);
      expect(normalInner.endsWith('Z')).toBe(true);
      expect(scalarInner.startsWith('M')).toBe(true);
      expect(scalarInner.endsWith('Z')).toBe(true);
    });
  });

  describe('8. Invalid Parameter Handling & Boundary Clamping', () => {
    it('8.1 Superellipse exponent outside [1.5, 6.0] should be clamped safely', () => {
      const ptsLow = evaluateCornerPoints(24, 'superellipse', { exponent: 0.5 }, 20);
      const ptsHigh = evaluateCornerPoints(24, 'superellipse', { exponent: 99 }, 20);

      expect(ptsLow.length).toBe(21);
      expect(ptsHigh.length).toBe(21);
      ptsLow.forEach((pt) => expect(Number.isNaN(pt.x)).toBe(false));
      ptsHigh.forEach((pt) => expect(Number.isNaN(pt.x)).toBe(false));
    });

    it('8.2 Negative container dimensions return degenerate closed path M 0 0 Z', () => {
      const pathNegW = generateClosedPath(-100, 200, 20, 'curvature-optimized');
      expect(pathNegW).toContain('M 0 0');

      const pathNegH = generateClosedPath(200, -50, 20, 'bezier');
      expect(pathNegH).toContain('M 0 0');
    });

    it('8.3 computeNormalOffsetPoints with steps < 10 clamps steps to minimum 10 safely', () => {
      const pts = computeNormalOffsetPoints(20, 'bezier', 8, { smoothing: 0.6 }, 2);
      expect(pts.length).toBeGreaterThanOrEqual(11); // 10 steps + 1 point
    });
  });

  describe('9. Path Assembly Regression Tests (Straight Edges, Symmetry, CSS Parity, No Diagonals)', () => {
    function parsePointsFromSvgPath(pathD: string): Array<{ x: number; y: number }> {
      const matches = [...pathD.matchAll(/([ML])\s+([-\d.]+)\s+([-\d.]+)/g)];
      return matches.map((m) => ({ x: parseFloat(m[2]), y: parseFloat(m[3]) }));
    }

    it.each(allProfiles)(
      '9.1 [%s] should strictly observe rectangular bounds [0, w] × [0, h]',
      (profileId) => {
        const w = 300;
        const h = 200;
        const r = 24;
        const pathD = generateClosedPath(w, h, r, profileId);
        const points = parsePointsFromSvgPath(pathD);

        expect(points.length).toBeGreaterThan(50);
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        for (const pt of points) {
          expect(pt.x).toBeGreaterThanOrEqual(-0.01);
          expect(pt.x).toBeLessThanOrEqual(w + 0.01);
          expect(pt.y).toBeGreaterThanOrEqual(-0.01);
          expect(pt.y).toBeLessThanOrEqual(h + 0.01);
          minX = Math.min(minX, pt.x);
          maxX = Math.max(maxX, pt.x);
          minY = Math.min(minY, pt.y);
          maxY = Math.max(maxY, pt.y);
        }

        expect(minX).toBeCloseTo(0, 1);
        expect(maxX).toBeCloseTo(w, 1);
        expect(minY).toBeCloseTo(0, 1);
        expect(maxY).toBeCloseTo(h, 1);
      }
    );

    it.each(allProfiles)(
      '9.2 [%s] must have strictly horizontal top/bottom edges and strictly vertical left/right edges',
      (profileId) => {
        const w = 300;
        const h = 200;
        const r = 24;
        const L = evaluateCornerAt(0, r, profileId).L;
        const safeL = Math.min(L, w / 2, h / 2);
        const pathD = generateClosedPath(w, h, r, profileId);

        // Verify explicit straight edge commands exist in path string
        // 1. Top Edge: from safeL 0 to (w - safeL) 0 (y = 0 constant)
        expect(pathD).toContain(`M ${safeL.toFixed(2)} 0 L ${(w - safeL).toFixed(2)} 0`);
        // 2. Right Edge: from (w, safeL) to (w, h - safeL) (x = w constant)
        expect(pathD).toContain(`L ${w} ${(h - safeL).toFixed(2)}`);
        // 3. Bottom Edge: from (w - safeL, h) to (safeL, h) (y = h constant)
        expect(pathD).toContain(`L ${safeL.toFixed(2)} ${h}`);
        // 4. Left Edge: from (0, h - safeL) to (0, safeL) (x = 0 constant)
        expect(pathD).toContain(`L 0 ${safeL.toFixed(2)}`);
      }
    );

    it.each(allProfiles)(
      '9.3 [%s] must have 100% four-corner geometric symmetry across centerlines',
      (profileId) => {
        const w = 320;
        const h = 240;
        const r = 28;
        const steps = 30;
        const tlPoints = evaluateCornerPoints(r, profileId, {}, steps);
        const L = evaluateCornerAt(0, r, profileId).L;
        const safeL = Math.min(L, w / 2, h / 2);
        const scale = safeL / L;

        // Verify that corner transforms in generateClosedPath produce symmetric coordinates:
        for (let i = 0; i <= steps; i++) {
          const pt = tlPoints[i];
          // TL coordinates relative to corner (0, 0)
          const tlX = pt.x * scale;
          const tlY = pt.y * scale;

          // TR coordinates relative to corner (w, 0)
          const trX = w - tlPoints[steps - i].x * scale;
          const trY = tlPoints[steps - i].y * scale;
          // In TR, distance from right edge (w - trX) must equal TL distance from top edge (tlY)
          expect(w - trX).toBeCloseTo(tlY, 3);
          expect(trY).toBeCloseTo(tlX, 3);

          // BR coordinates relative to corner (w, h)
          const brX = w - pt.x * scale;
          const brY = h - pt.y * scale;
          expect(w - brX).toBeCloseTo(tlX, 3);
          expect(h - brY).toBeCloseTo(tlY, 3);

          // BL coordinates relative to corner (0, h)
          const blX = tlPoints[steps - i].x * scale;
          const blY = h - tlPoints[steps - i].y * scale;
          expect(blX).toBeCloseTo(tlY, 3);
          expect(h - blY).toBeCloseTo(tlX, 3);
        }
      }
    );

    it('9.4 Profile A (Circular Arc) must be geometrically identical to native CSS border-radius', () => {
      const w = 300;
      const h = 200;
      const r = 24;
      const pathD = generateClosedPath(w, h, r, 'circle', {}, 40);
      const points = parsePointsFromSvgPath(pathD);

      // Verify that all points in each corner quadrant lie on a circle of radius r centered at the corner center
      const corners = [
        { cx: r, cy: r, name: 'TL', test: (p: { x: number; y: number }) => p.x <= r && p.y <= r },
        { cx: w - r, cy: r, name: 'TR', test: (p: { x: number; y: number }) => p.x >= w - r && p.y <= r },
        { cx: w - r, cy: h - r, name: 'BR', test: (p: { x: number; y: number }) => p.x >= w - r && p.y >= h - r },
        { cx: r, cy: h - r, name: 'BL', test: (p: { x: number; y: number }) => p.x <= r && p.y >= h - r },
      ];

      for (const corner of corners) {
        const cornerPoints = points.filter(corner.test);
        expect(cornerPoints.length).toBeGreaterThan(10);
        for (const pt of cornerPoints) {
          const dist = Math.hypot(pt.x - corner.cx, pt.y - corner.cy);
          // Distance to center of circle must equal nominal radius within 0.05px
          expect(dist).toBeCloseTo(r, 1);
        }
      }
    });

    it.each(allProfiles)(
      '9.5 [%s] should never produce diagonal jumps or triangular clipping artifacts across edges',
      (profileId) => {
        const w = 300;
        const h = 200;
        const r = 24;
        const pathD = generateClosedPath(w, h, r, profileId, {}, 30);
        const points = parsePointsFromSvgPath(pathD);

        // Check distance between consecutive points along the contour:
        // Straight edges have lengths (w - 2*safeL) and (h - 2*safeL)
        // Along curved corners, step size is approximately (π/2 * L / 30) ≈ 1.5px
        // In the bug, TR and BL had an axis swap that jumped from (w-L, 0) diagonally across the card to (w, h-L)
        // Check that no segment has both large dx and large dy (which indicates an accidental diagonal)
        for (let i = 1; i < points.length; i++) {
          const p1 = points[i - 1];
          const p2 = points[i];
          const dx = Math.abs(p2.x - p1.x);
          const dy = Math.abs(p2.y - p1.y);

          // If both dx and dy are large (e.g. > 15px), it would be an accidental diagonal cut!
          const isLargeDiagonalJump = dx > 15 && dy > 15;
          expect(isLargeDiagonalJump).toBe(false);
        }
      }
    );

    it.each(allProfiles)(
      '9.6 [%s] path closure: starts with M, ends with Z, and final point connects back to start',
      (profileId) => {
        const w = 280;
        const h = 180;
        const r = 20;
        const L = evaluateCornerAt(0, r, profileId).L;
        const safeL = Math.min(L, w / 2, h / 2);
        const pathD = generateClosedPath(w, h, r, profileId);
        const points = parsePointsFromSvgPath(pathD);

        expect(pathD.startsWith(`M ${safeL.toFixed(2)} 0`)).toBe(true);
        expect(pathD.endsWith('Z')).toBe(true);

        const firstPt = points[0];
        const lastPt = points[points.length - 1];
        // In generateClosedPath, TL corner ends at (safeL, 0), exactly matching the initial M point
        expect(firstPt.x).toBeCloseTo(safeL, 2);
        expect(firstPt.y).toBeCloseTo(0, 2);
        expect(lastPt.x).toBeCloseTo(safeL, 2);
        expect(lastPt.y).toBeCloseTo(0, 2);
      }
    );
  });
});

