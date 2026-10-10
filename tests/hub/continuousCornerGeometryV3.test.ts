/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V3
 * Automated Verification Suite for Optical Precision, Curve Differentiation & Surface Refinement:
 * 1. Geometric Validity and Non-NaN Coordinates
 * 2. Tangent Continuity (G1) at Junctions
 * 3. Curvature Continuity (G2) for Profile D across Parametric Tuning
 * 4. Strict Convexity and Absence of Inflection Points
 * 5. Diagonal Reflection Symmetry Invariant
 * 6. Monotonicity and No Self-Intersection
 * 7. Path Bounds & Small-Scale UI Stability (100×36px, 260×42px)
 * 8. Numerical Contour Deviation Engine Verification
 * 9. Normalization Engine Invariant Verification (Equal R, L, Diag, Area)
 * 10. Concentric Nested Offset Quality & Optical Compensation
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateCornerAt,
  evaluateCornerPoints,
  calculateProfileMetrics,
  generateClosedPath,
  clampRadius,
} from '../../src/products/hub/designSystem/geometry/curveProfiles';
import {
  normalizeProfileRadius,
  calculateDiagonalCutoutDepth,
  calculateCornerCutoutArea,
} from '../../src/products/hub/designSystem/geometry/curveNormalization';
import {
  computeContourDeviation,
  generateDifferenceRibbonPath,
  computeArcLengthParameterization,
} from '../../src/products/hub/designSystem/geometry/curveDifference';
import { evaluateConcentricOffsetQuality } from '../../src/products/hub/designSystem/geometry/concentricOffset';
import { CurveProfileId } from '../../src/products/hub/designSystem/geometry/types';

describe('Continuous Corner Geometry V3 — Optical Precision & Differentiation Verification', () => {
  const allProfiles: CurveProfileId[] = ['circle', 'superellipse', 'bezier', 'curvature-optimized'];

  describe('1. Geometric Validity & Parametric Stability', () => {
    it.each(allProfiles)(
      '1.1 [%s] should evaluate points without NaN, null, or undefined coordinates',
      (profileId) => {
        const points = evaluateCornerPoints(24, profileId, {
          exponent: 3.5,
          smoothing: 0.6,
          transitionRatio: 0.45,
          shoulderSoftness: 0.38,
          cornerFullness: 0.65,
        });

        expect(points.length).toBeGreaterThan(30);
        for (const pt of points) {
          expect(Number.isNaN(pt.x)).toBe(false);
          expect(Number.isNaN(pt.y)).toBe(false);
          expect(Number.isFinite(pt.x)).toBe(true);
          expect(Number.isFinite(pt.y)).toBe(true);
          expect(pt.x).toBeGreaterThanOrEqual(-1e-6);
          expect(pt.y).toBeGreaterThanOrEqual(-1e-6);
        }
      }
    );
  });

  describe('2. Tangent Continuity (G1) and Monotonicity', () => {
    it.each(allProfiles)(
      '2.1 [%s] must have purely vertical entry tangent and purely horizontal exit tangent',
      (profileId) => {
        const r = 24;
        const entry = evaluateCornerAt(0, r, profileId, { transitionRatio: 0.5 });
        const exit = evaluateCornerAt(1, r, profileId, { transitionRatio: 0.5 });

        // Entry tangent: dx/dt = 0, dy/dt < 0
        expect(Math.abs(entry.dx)).toBeLessThan(1e-5);
        expect(entry.dy).toBeLessThan(0);

        // Exit tangent: dy/dt = 0, dx/dt > 0
        expect(Math.abs(exit.dy)).toBeLessThan(1e-5);
        expect(exit.dx).toBeGreaterThan(0);
      }
    );

    it.each(allProfiles)(
      '2.2 [%s] coordinates must be monotonic along quadrant: x increases, y decreases',
      (profileId) => {
        const points = evaluateCornerPoints(28, profileId, {}, 40);
        for (let i = 1; i < points.length; i++) {
          expect(points[i].x).toBeGreaterThanOrEqual(points[i - 1].x - 1e-6);
          expect(points[i].y).toBeLessThanOrEqual(points[i - 1].y + 1e-6);
        }
      }
    );
  });

  describe('3. Curvature Continuity (G2) for Profile D across Parametric Tuning', () => {
    it('3.1 Profile D must preserve G2 continuity kappa(0)=0 and kappa(1)=0 across various alpha and beta', () => {
      const testCases = [
        { alpha: 0.25, beta: 0.55, lambda: 0.35 },
        { alpha: 0.38, beta: 0.65, lambda: 0.45 },
        { alpha: 0.45, beta: 0.75, lambda: 0.60 },
        { alpha: 0.30, beta: 0.80, lambda: 0.75 },
      ];

      for (const tc of testCases) {
        const metrics = calculateProfileMetrics(24, 'curvature-optimized', {
          shoulderSoftness: tc.alpha,
          cornerFullness: tc.beta,
          transitionRatio: tc.lambda,
        });

        expect(metrics.entryCurvatureJump).toBeLessThan(1e-9);
        expect(metrics.exitCurvatureJump).toBeLessThan(1e-9);
        expect(metrics.isG2Continuous).toBe(true);
      }
    });

    it('3.2 Profile A must remain G1 discontinuous with step jump = 1/R', () => {
      const R = 20;
      const metrics = calculateProfileMetrics(R, 'circle');
      expect(metrics.entryCurvatureJump).toBeCloseTo(1 / R, 4);
      expect(metrics.exitCurvatureJump).toBeCloseTo(1 / R, 4);
      expect(metrics.isG2Continuous).toBe(false);
    });
  });

  describe('4. Strict Convexity (No Inflection Points)', () => {
    it.each(allProfiles)(
      '4.1 [%s] curvature kappa(t) must be non-negative everywhere along the corner',
      (profileId) => {
        const points = evaluateCornerPoints(24, profileId, {
          exponent: 3.5,
          smoothing: 0.6,
          transitionRatio: 0.45,
          shoulderSoftness: 0.35,
          cornerFullness: 0.65,
        }, 60);

        for (const pt of points) {
          expect(pt.curvature).toBeGreaterThanOrEqual(-1e-6);
        }
      }
    );
  });

  describe('5. Diagonal Reflection Symmetry (y = x Invariant)', () => {
    it.each(allProfiles)(
      '5.1 [%s] should satisfy x(1-t) == y(t) across parametric tuning',
      (profileId) => {
        const R = 26;
        const params = {
          exponent: 3.2,
          smoothing: 0.65,
          transitionRatio: 0.5,
          shoulderSoftness: 0.35,
          cornerFullness: 0.68,
        };

        const tValues = [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9];
        for (const t of tValues) {
          const ptForward = evaluateCornerAt(t, R, profileId, params);
          const ptReflected = evaluateCornerAt(1 - t, R, profileId, params);

          expect(ptForward.x).toBeCloseTo(ptReflected.y, 3);
          expect(ptForward.y).toBeCloseTo(ptReflected.x, 3);
        }

        // Midpoint at t = 0.5 must be on diagonal line y = x
        const midPt = evaluateCornerAt(0.5, R, profileId, params);
        expect(midPt.x).toBeCloseTo(midPt.y, 4);
      }
    );
  });

  describe('6. Small-Scale UI Stability Test (Button 100×36px, Input 260×42px)', () => {
    it('6.1 Small button (100 × 36 px, R = 8px) must generate valid closed path within bounds', () => {
      const pathD = generateClosedPath(100, 36, 8, 'curvature-optimized', { transitionRatio: 0.45 });
      expect(pathD.startsWith('M')).toBe(true);
      expect(pathD.endsWith('Z')).toBe(true);
      expect(pathD).not.toContain('NaN');
    });

    it('6.2 Input field (260 × 42 px, R = 10px) must generate valid closed path within bounds', () => {
      const pathD = generateClosedPath(260, 42, 10, 'bezier', { smoothing: 0.6 });
      expect(pathD.startsWith('M')).toBe(true);
      expect(pathD.endsWith('Z')).toBe(true);
      expect(pathD).not.toContain('NaN');
    });

    it('6.3 Clamping radius prevents degenerate overlap when R > min(w/2, h/2)', () => {
      // 100 × 36 px container has max half-height = 18 px
      const clamped = clampRadius(25, 100, 36);
      expect(clamped).toBe(18);
    });
  });

  describe('7. Numerical Contour Deviation Engine', () => {
    it('7.1 Deviation between identical curves must be zero', () => {
      const pts = evaluateCornerPoints(24, 'circle', {}, 50);
      const metrics = computeContourDeviation(pts, pts);

      expect(metrics.maxDeviation).toBeLessThan(1e-4);
      expect(metrics.meanDeviation).toBeLessThan(1e-4);
      expect(metrics.rmsDeviation).toBeLessThan(1e-4);
      expect(metrics.diagonalDifference).toBeLessThan(1e-4);
    });

    it('7.2 Deviation between corner arcs R=20 and R=24 has max deviation 4.0px at entry/exit', () => {
      const pts20 = evaluateCornerPoints(20, 'circle', {}, 80);
      const pts24 = evaluateCornerPoints(24, 'circle', {}, 80);
      const metrics = computeContourDeviation(pts20, pts24);

      // Max deviation occurs at the axis junctions: exactly 24 - 20 = 4.0px
      expect(metrics.maxDeviation).toBeCloseTo(4.0, 1);
      // Diagonal difference is exactly 4 * (sqrt(2) - 1) ≈ 1.657px
      expect(metrics.diagonalDifference).toBeCloseTo(4 * (Math.SQRT2 - 1), 1);
      // Mean deviation across the corner is ~1.31px
      expect(metrics.meanDeviation).toBeGreaterThan(1.0);
      expect(metrics.meanDeviation).toBeLessThan(2.0);
    });

    it('7.3 generateDifferenceRibbonPath returns valid closed polygon path', () => {
      const ptsA = evaluateCornerPoints(24, 'circle', {}, 30);
      const ptsD = evaluateCornerPoints(24, 'curvature-optimized', {}, 30);
      const ribbon = generateDifferenceRibbonPath(ptsA, ptsD);

      expect(ribbon.startsWith('M')).toBe(true);
      expect(ribbon.endsWith('Z')).toBe(true);
      expect(ribbon).not.toContain('NaN');
    });

    it('7.4 computeArcLengthParameterization normalizes s from 0 to 1 with monotonic progression', () => {
      const pts = evaluateCornerPoints(24, 'curvature-optimized', {}, 40);
      const arcSamples = computeArcLengthParameterization(pts);

      expect(arcSamples[0].sNorm).toBeCloseTo(0, 5);
      expect(arcSamples[arcSamples.length - 1].sNorm).toBeCloseTo(1, 5);

      for (let i = 1; i < arcSamples.length; i++) {
        expect(arcSamples[i].sNorm).toBeGreaterThan(arcSamples[i - 1].sNorm);
      }
    });
  });

  describe('8. Normalization Engine Verification (Equal R, L, Diag, Area)', () => {
    const nominalR = 24;

    it('8.1 Equal Radius keeps nominal radius intact (scale factor = 1.0)', () => {
      const res = normalizeProfileRadius(nominalR, 'curvature-optimized', 'equal-radius');
      expect(res.scaleFactorVsNominal).toBeCloseTo(1.0, 4);
      expect(res.effectiveRadius).toBeCloseTo(nominalR, 4);
    });

    it('8.2 Equal Transition Length matches transition length L_target == L_A == nominalR', () => {
      const res = normalizeProfileRadius(nominalR, 'curvature-optimized', 'equal-transition', {
        transitionRatio: 0.45,
      });

      // For Profile D where L = R * 1.45, scaleFactor = 1 / 1.45
      expect(res.effectiveTransitionLength).toBeCloseTo(nominalR, 1);
    });

    it('8.3 Equal Diagonal Cutout Depth matches diagonal cutout depth d_diag,target == d_diag,A', () => {
      const res = normalizeProfileRadius(nominalR, 'curvature-optimized', 'equal-diagonal', {
        transitionRatio: 0.45,
      });

      const dDiagA = nominalR * (Math.SQRT2 - 1);
      expect(res.diagonalCutoutDepth).toBeCloseTo(dDiagA, 1);
    });

    it('8.4 Equal Cutout Area matches corner cutout area A_target == A_A', () => {
      const res = normalizeProfileRadius(nominalR, 'curvature-optimized', 'equal-area', {
        transitionRatio: 0.45,
      });

      const areaA = (1 - Math.PI / 4) * nominalR * nominalR;
      expect(res.cornerCutoutArea).toBeCloseTo(areaA, 0.5);
    });

    it('8.5 calculateDiagonalCutoutDepth and calculateCornerCutoutArea evaluate analytically for Circle', () => {
      const diagCircle = calculateDiagonalCutoutDepth(20, 'circle');
      const areaCircle = calculateCornerCutoutArea(20, 'circle');

      expect(diagCircle).toBeCloseTo(20 * (Math.SQRT2 - 1), 4);
      expect(areaCircle).toBeCloseTo((1 - Math.PI / 4) * 400, 4);
    });
  });

  describe('9. Concentric Nested Offset Quality', () => {
    it('9.1 Circle profile maintains equidistant offset error < 0.15px', () => {
      const analysis = evaluateConcentricOffsetQuality(24, 'circle', 10);
      expect(analysis.maxDistanceError).toBeLessThan(0.15);
      expect(analysis.hasSelfIntersection).toBe(false);
    });

    it('9.2 Continuous curve flag self-intersection when inset >= minRadiusOfCurvature', () => {
      const metrics = calculateProfileMetrics(20, 'curvature-optimized', { transitionRatio: 0.45 });
      const minR = metrics.minRadiusOfCurvature;

      const safeAnalysis = evaluateConcentricOffsetQuality(20, 'curvature-optimized', minR - 3, { transitionRatio: 0.45 });
      expect(safeAnalysis.hasSelfIntersection).toBe(false);

      const cuspAnalysis = evaluateConcentricOffsetQuality(20, 'curvature-optimized', minR + 3, { transitionRatio: 0.45 });
      expect(cuspAnalysis.hasSelfIntersection).toBe(true);
    });
  });
});
