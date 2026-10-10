/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V3
 * Curve Difference Engine:
 * Implements high-precision numerical contour deviation (Hausdorff distance, Mean, RMS),
 * difference ribbon polygon generator, and normalized arc-length curvature parameterization.
 */

import {
  CurvePoint,
  ContourDeviationMetrics,
  NormalizedArcLengthSample,
} from './types';

/**
 * Compute shortest Euclidean distance from a 2D point P to line segment AB
 */
function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-12) {
    return Math.hypot(px - ax, py - ay);
  }
  // Orthogonal projection parameter t clamped to [0, 1]
  const apx = px - ax;
  const apy = py - ay;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq));
  const projX = ax + t * abx;
  const projY = ay + t * aby;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Compute minimum Euclidean distance from point P to continuous polyline C
 */
function pointToPolylineDistance(
  px: number,
  py: number,
  polyline: CurvePoint[]
): number {
  let minDist = Number.POSITIVE_INFINITY;
  for (let i = 1; i < polyline.length; i++) {
    const d = pointToSegmentDistance(
      px,
      py,
      polyline[i - 1].x,
      polyline[i - 1].y,
      polyline[i].x,
      polyline[i].y
    );
    if (d < minDist) {
      minDist = d;
    }
  }
  return minDist;
}

/**
 * Compute rigorous contour deviation metrics between two curves using dense continuous projection.
 * Evaluates in both directions (C1 -> C2 and C2 -> C1) to ensure true Hausdorff distance.
 */
export function computeContourDeviation(
  baseCurve: CurvePoint[],
  testCurve: CurvePoint[]
): ContourDeviationMetrics {
  if (baseCurve.length === 0 || testCurve.length === 0) {
    return {
      maxDeviation: 0,
      meanDeviation: 0,
      rmsDeviation: 0,
      diagonalDifference: 0,
      curvaturePeak: 0,
      curvatureVariation: 0,
      transitionLength: 0,
      samplingTolerance: 0.05,
    };
  }

  const distances: number[] = [];

  // Direction 1: Base -> Test polyline
  for (const pt of baseCurve) {
    distances.push(pointToPolylineDistance(pt.x, pt.y, testCurve));
  }

  // Direction 2: Test -> Base polyline
  for (const pt of testCurve) {
    distances.push(pointToPolylineDistance(pt.x, pt.y, baseCurve));
  }

  let maxDist = 0;
  let sumDist = 0;
  let sumSqDist = 0;

  for (const d of distances) {
    if (d > maxDist) maxDist = d;
    sumDist += d;
    sumSqDist += d * d;
  }

  const count = distances.length;
  const meanDeviation = sumDist / count;
  const rmsDeviation = Math.sqrt(sumSqDist / count);

  // Diagonal intersection difference at mid parameter t = 0.5
  const baseMid = baseCurve[Math.floor(baseCurve.length / 2)];
  const testMid = testCurve[Math.floor(testCurve.length / 2)];
  const baseDiag = Math.hypot(baseMid.x, baseMid.y);
  const testDiag = Math.hypot(testMid.x, testMid.y);
  const diagonalDifference = Math.abs(baseDiag - testDiag);

  // Curvature peak & variation on test curve
  let kappaMax = 0;
  let kappaMin = Number.POSITIVE_INFINITY;
  for (const pt of testCurve) {
    if (pt.curvature > kappaMax) kappaMax = pt.curvature;
    if (pt.curvature < kappaMin) kappaMin = pt.curvature;
  }
  const kappaVar = kappaMax - (kappaMin === Number.POSITIVE_INFINITY ? 0 : kappaMin);

  // Transition length of test curve
  const transitionLength = testCurve[testCurve.length - 1].x;

  // Theoretical sampling tolerance bound (half the max segment length along curve)
  let maxSegLen = 0;
  for (let i = 1; i < testCurve.length; i++) {
    const seg = Math.hypot(testCurve[i].x - testCurve[i - 1].x, testCurve[i].y - testCurve[i - 1].y);
    if (seg > maxSegLen) maxSegLen = seg;
  }
  const samplingTolerance = maxSegLen / 2;

  return {
    maxDeviation: maxDist,
    meanDeviation,
    rmsDeviation,
    diagonalDifference,
    curvaturePeak: kappaMax,
    curvatureVariation: kappaVar,
    transitionLength,
    samplingTolerance,
  };
}

/**
 * Generate closed SVG path for difference ribbon between two corner curves.
 * Creates a polygon enclosing the delta area: Base curve forward, Test curve reverse, closed with Z.
 */
export function generateDifferenceRibbonPath(
  baseCurve: CurvePoint[],
  testCurve: CurvePoint[],
  offsetX = 0,
  offsetY = 0,
  scale = 1
): string {
  if (baseCurve.length === 0 || testCurve.length === 0) return '';

  let d = `M ${(offsetX + baseCurve[0].x * scale).toFixed(2)} ${(offsetY + baseCurve[0].y * scale).toFixed(2)}`;

  // Forward along Base curve
  for (let i = 1; i < baseCurve.length; i++) {
    const px = offsetX + baseCurve[i].x * scale;
    const py = offsetY + baseCurve[i].y * scale;
    d += ` L ${px.toFixed(2)} ${py.toFixed(2)}`;
  }

  // Reverse along Test curve
  for (let i = testCurve.length - 1; i >= 0; i--) {
    const px = offsetX + testCurve[i].x * scale;
    const py = offsetY + testCurve[i].y * scale;
    d += ` L ${px.toFixed(2)} ${py.toFixed(2)}`;
  }

  d += ' Z';
  return d;
}

/**
 * Parameterize corner curve against normalized arc length s in [0, 1]
 * for plotting curvature kappa(s) independent of parameter speed.
 */
export function computeArcLengthParameterization(
  points: CurvePoint[]
): NormalizedArcLengthSample[] {
  if (points.length === 0) return [];

  const cumulativeLengths: number[] = [0];
  let totalLength = 0;

  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    totalLength += seg;
    cumulativeLengths.push(totalLength);
  }

  if (totalLength < 1e-9) {
    return points.map((p) => ({
      sNorm: 0,
      t: p.t,
      x: p.x,
      y: p.y,
      curvature: p.curvature,
    }));
  }

  return points.map((p, idx) => ({
    sNorm: cumulativeLengths[idx] / totalLength,
    t: p.t,
    x: p.x,
    y: p.y,
    curvature: p.curvature,
  }));
}
