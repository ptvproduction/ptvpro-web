/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V2
 * Concentric Offset Geometry: Exact numerical normal offsets,
 * comparison with naive scalar R_inner = R_outer - inset,
 * self-intersection / cusp detection, and multi-angle distance analysis.
 */

import {
  CurveProfileId,
  OffsetAnalysis,
  OffsetEvaluationPoint,
} from './types';
import {
  ProfileParameters,
  evaluateCornerPoints,
  calculateProfileMetrics,
  generateClosedPath,
  clampRadius,
} from './curveProfiles';

export interface OffsetPoint {
  x: number;
  y: number;
  t: number;
  originX: number;
  originY: number;
}

/**
 * Compute the True Numerical Normal Offset for a corner profile.
 * Formula: C_offset(t) = C(t) + d * n_inward(t)
 */
export function computeNormalOffsetPoints(
  r: number,
  profileId: CurveProfileId,
  inset: number,
  params: ProfileParameters = {},
  steps = 50
): OffsetPoint[] {
  const outerPoints = evaluateCornerPoints(r, profileId, params, steps);
  const offsetPoints: OffsetPoint[] = [];

  for (const pt of outerPoints) {
    // Offset along inward unit normal
    const ox = pt.x + inset * pt.normalX;
    const oy = pt.y + inset * pt.normalY;

    offsetPoints.push({
      x: ox,
      y: oy,
      t: pt.t,
      originX: pt.x,
      originY: pt.y,
    });
  }

  return offsetPoints;
}

/**
 * Evaluate distance between outer curve and offset curve along radial rays (0° to 90°)
 */
export function evaluateConcentricOffsetQuality(
  r: number,
  profileId: CurveProfileId,
  inset: number,
  params: ProfileParameters = {}
): OffsetAnalysis {
  const metrics = calculateProfileMetrics(r, profileId, params);
  const minR = metrics.minRadiusOfCurvature;
  const hasSelfIntersection = inset >= minR;

  // Angles to evaluate in degrees (from vertical edge 0 deg to horizontal edge 90 deg)
  const testAngles = [0, 15, 30, 45, 60, 75, 90];
  const evaluations: OffsetEvaluationPoint[] = [];

  const innerR = Math.max(0, r - inset);
  // Use dense sampling for high-precision Euclidean distance measurement
  const scalarInnerPoints = evaluateCornerPoints(innerR, profileId, params, 120);

  let totalError = 0;
  let maxError = 0;

  for (const deg of testAngles) {
    const t = deg / 90;
    const ptOuter = evaluateCornerPoints(r, profileId, params, 90).find(
      (p) => Math.abs(p.t - t) < 0.006
    ) ?? evaluateCornerPoints(r, profileId, params, 90)[Math.round(t * 90)];

    const normalDist = inset;

    // Compute shortest Euclidean distance from ptOuter to the scalar inner curve
    let minScalarDist = Number.POSITIVE_INFINITY;
    for (const inPt of scalarInnerPoints) {
      const worldX = inPt.x + inset;
      const worldY = inPt.y + inset;
      const d = Math.hypot(ptOuter.x - worldX, ptOuter.y - worldY);
      if (d < minScalarDist) {
        minScalarDist = d;
      }
    }

    const scalarEffectiveDist = minScalarDist;
    const distanceError = Math.abs(normalDist - scalarEffectiveDist);

    totalError += distanceError;
    if (distanceError > maxError) {
      maxError = distanceError;
    }

    evaluations.push({
      angleDeg: deg,
      normalDistance: normalDist,
      scalarDistance: scalarEffectiveDist,
      distanceError,
    });
  }

  const avgError = totalError / testAngles.length;

  return {
    requestedInset: inset,
    minRadiusOfCurvature: minR,
    hasSelfIntersection,
    maxDistanceError: maxError,
    avgDistanceError: avgError,
    evaluations,
  };
}

/**
 * Generate closed SVG path for an inner container using naive scalar R_inner
 */
export function generateScalarInnerPath(
  outerW: number,
  outerH: number,
  outerR: number,
  inset: number,
  profileId: CurveProfileId,
  params: ProfileParameters = {}
): string {
  const innerW = Math.max(0, outerW - inset * 2);
  const innerH = Math.max(0, outerH - inset * 2);
  const innerR = clampRadius(Math.max(0, outerR - inset), innerW, innerH);
  return generateClosedPath(innerW, innerH, innerR, profileId, params);
}

/**
 * Generate closed SVG path for an inner container using true numerical normal offset
 */
export function generateTrueOffsetInnerPath(
  outerW: number,
  outerH: number,
  outerR: number,
  inset: number,
  profileId: CurveProfileId,
  params: ProfileParameters = {},
  steps = 28
): string {
  const innerW = Math.max(0, outerW - inset * 2);
  const innerH = Math.max(0, outerH - inset * 2);

  if (innerW <= 0 || innerH <= 0) {
    return 'M 0 0 Z';
  }

  // If circle profile, exact normal offset is identical to scalar R_inner = R - inset
  if (profileId === 'circle') {
    const innerR = clampRadius(Math.max(0, outerR - inset), innerW, innerH);
    return generateClosedPath(innerW, innerH, innerR, 'circle', params);
  }

  // Compute raw normal offset points for top-left
  const offsetPoints = computeNormalOffsetPoints(outerR, profileId, inset, params, steps);

  // Shift coordinates from outer frame into inner frame (subtract inset)
  // Ensure points don't cross center
  const validPoints = offsetPoints.map((pt) => ({
    x: Math.max(0, Math.min(innerW / 2, pt.x - inset)),
    y: Math.max(0, Math.min(innerH / 2, pt.y - inset)),
  }));

  const L_inner_y = validPoints[0]?.y ?? 0;
  const L_inner_x = validPoints[validPoints.length - 1]?.x ?? 0;

  // Build closed rectangle path inside innerW × innerH
  // 1. Top Edge: from TL exit to TR entry
  let d = `M ${L_inner_x.toFixed(2)} 0 L ${(innerW - L_inner_x).toFixed(2)} 0`;

  // 2. Top-Right Corner: curves from (innerW - L_inner_x, 0) to (innerW, L_inner_y)
  for (let i = validPoints.length - 1; i >= 0; i--) {
    const pt = validPoints[i];
    d += ` L ${(innerW - pt.x).toFixed(2)} ${pt.y.toFixed(2)}`;
  }

  // 3. Right Edge: vertical to BR entry
  d += ` L ${innerW} ${(innerH - L_inner_y).toFixed(2)}`;

  // 4. Bottom-Right Corner: curves to (innerW - L_inner_x, innerH)
  for (let i = 0; i < validPoints.length; i++) {
    const pt = validPoints[i];
    d += ` L ${(innerW - pt.x).toFixed(2)} ${(innerH - pt.y).toFixed(2)}`;
  }

  // 5. Bottom Edge: horizontal to BL entry
  d += ` L ${L_inner_x.toFixed(2)} ${innerH}`;

  // 6. Bottom-Left Corner: curves to (0, innerH - L_inner_y)
  for (let i = validPoints.length - 1; i >= 0; i--) {
    const pt = validPoints[i];
    d += ` L ${pt.x.toFixed(2)} ${(innerH - pt.y).toFixed(2)}`;
  }

  // 7. Left Edge: vertical to TL entry
  d += ` L 0 ${L_inner_y.toFixed(2)}`;

  // 8. Top-Left Corner: curves to (L_inner_x, 0)
  for (let i = 0; i < validPoints.length; i++) {
    const pt = validPoints[i];
    d += ` L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
  }

  d += ' Z';
  return d;
}
