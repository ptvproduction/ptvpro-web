/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V3
 * Curve Normalization Engine:
 * Implements 4 mathematical normalization methods to compare continuous curves against circular baseline:
 * 1. Equal Nominal Radius (R_test = R_A)
 * 2. Equal Corner Transition Length (L_test = L_A = R_A)
 * 3. Equal Diagonal Intersection / Corner Cutout (d_diag,test = d_diag,A)
 * 4. Equal Corner Cutout Area (A_cut,test = A_cut,A)
 */

import { CurveProfileId, NormalizationMethod, NormalizationResult } from './types';
import { evaluateCornerAt, evaluateCornerPoints, ProfileParameters } from './curveProfiles';

/**
 * Compute the excised corner cutout area for a single Top-Left corner [0, L] x [0, L]
 * using high-density numerical trapezoidal integration.
 */
export function calculateCornerCutoutArea(
  r: number,
  profileId: CurveProfileId,
  params: ProfileParameters = {},
  steps = 120
): number {
  if (r <= 0) return 0;
  if (profileId === 'circle') {
    return (1 - Math.PI / 4) * r * r;
  }

  const points = evaluateCornerPoints(r, profileId, params, steps);
  let area = 0;
  // Integrate area under curve from x = 0 (t = 0) to x = L (t = 1)
  for (let i = 1; i < points.length; i++) {
    const pPrev = points[i - 1];
    const pCurr = points[i];
    const dx = pCurr.x - pPrev.x;
    const avgY = (pCurr.y + pPrev.y) / 2;
    area += dx * avgY;
  }

  return Math.max(0, area);
}

/**
 * Calculate the diagonal distance from corner origin (0, 0) at 45 degrees (t = 0.5)
 */
export function calculateDiagonalCutoutDepth(
  r: number,
  profileId: CurveProfileId,
  params: ProfileParameters = {}
): number {
  if (r <= 0) return 0;
  if (profileId === 'circle') {
    return r * (Math.SQRT2 - 1);
  }
  const midPt = evaluateCornerAt(0.5, r, profileId, params);
  return Math.hypot(midPt.x, midPt.y);
}

/**
 * Normalize target profile radius to match chosen geometric invariant of baseline Profile A
 */
export function normalizeProfileRadius(
  nominalRadius: number,
  targetProfile: CurveProfileId,
  method: NormalizationMethod,
  params: ProfileParameters = {}
): NormalizationResult {
  if (nominalRadius <= 0) {
    return {
      method,
      effectiveRadius: 0,
      effectiveTransitionLength: 0,
      diagonalCutoutDepth: 0,
      cornerCutoutArea: 0,
      scaleFactorVsNominal: 1.0,
    };
  }

  // Profile A baseline values
  const rA = nominalRadius;
  const lA = rA;
  const diagA = rA * (Math.SQRT2 - 1); // ~0.4142 * rA
  const areaA = (1 - Math.PI / 4) * rA * rA; // ~0.2146 * rA^2

  if (targetProfile === 'circle') {
    return {
      method,
      effectiveRadius: rA,
      effectiveTransitionLength: lA,
      diagonalCutoutDepth: diagA,
      cornerCutoutArea: areaA,
      scaleFactorVsNominal: 1.0,
    };
  }

  // Unit evaluations for target profile at R = 1.0
  const unitL = evaluateCornerAt(0, 1.0, targetProfile, params).L;
  const unitDiag = calculateDiagonalCutoutDepth(1.0, targetProfile, params);
  const unitArea = calculateCornerCutoutArea(1.0, targetProfile, params);

  let scaleFactor = 1.0;

  switch (method) {
    case 'equal-radius':
      // Method 1: Keep nominal radius identical
      scaleFactor = 1.0;
      break;

    case 'equal-transition':
      // Method 2: Match transition length L_target = L_A = rA
      // Since L(R) = R * unitL, we require R * unitL = rA => R = rA / unitL
      scaleFactor = unitL > 1e-6 ? 1.0 / unitL : 1.0;
      break;

    case 'equal-diagonal':
      // Method 3: Match corner cutout depth at 45° ray d_target = d_A
      // Since d(R) = R * unitDiag and d_A(rA) = rA * (sqrt(2) - 1),
      // scaleFactor = (sqrt(2) - 1) / unitDiag
      scaleFactor = unitDiag > 1e-6 ? (Math.SQRT2 - 1) / unitDiag : 1.0;
      break;

    case 'equal-area':
      // Method 4: Match excised corner area A_target = A_A
      // Since A(R) = R^2 * unitArea, we require R^2 * unitArea = areaA => R = sqrt(areaA / unitArea)
      scaleFactor = unitArea > 1e-6 ? Math.sqrt(areaA / unitArea) / rA : 1.0;
      break;
  }

  const effectiveRadius = rA * scaleFactor;
  const effectiveTransitionLength = effectiveRadius * unitL;
  const diagonalCutoutDepth = effectiveRadius * unitDiag;
  const cornerCutoutArea = effectiveRadius * effectiveRadius * unitArea;

  return {
    method,
    effectiveRadius,
    effectiveTransitionLength,
    diagonalCutoutDepth,
    cornerCutoutArea,
    scaleFactorVsNominal: scaleFactor,
  };
}
