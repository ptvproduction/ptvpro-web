/**
 * PTV PRO HUB — Continuous Corner Geometry Design System
 * Profile D: Curvature-Optimized G2 Quintic Bézier Engine
 *
 * Approved canonical parameters:
 * - Transition ratio (lambda) = 0.45  (L = R * (1 + lambda) = 1.45 * R)
 * - Shoulder softness (alpha) = 0.38  (P1 collinear on straight edge)
 * - Corner fullness (beta)    = 0.65  (P2 collinear on straight edge)
 *
 * Guarantees:
 * - G0 (Position continuity): P0 and P5 connect continuously to straight lines
 * - G1 (Tangent continuity): Entry tangent is purely vertical, exit tangent is purely horizontal
 * - G2 (Curvature continuity): Initial and terminal curvature kappa(0) = 0 and kappa(1) = 0
 * - Strict convexity: No inflection points, no self-intersection, monotonic quadrant traversal
 * - Bounding box containment: Clamped safe transition length with symmetric 4-corner clockwise assembly
 */

export interface ContinuousCurveParams {
  transitionRatio?: number; // lambda: default 0.45
  shoulderSoftness?: number; // alpha: default 0.38
  cornerFullness?: number; // beta: default 0.65
}

export interface CurvePoint {
  x: number;
  y: number;
  t: number;
  tangentX: number;
  tangentY: number;
  normalX: number;
  normalY: number;
  curvature: number;
}

export interface ContinuousPointEvaluation {
  x: number;
  y: number;
  dx: number;
  dy: number;
  d2x: number;
  d2y: number;
  L: number;
}

/** Canonical Profile D Constants */
export const PROFILE_D_LAMBDA = 0.45;
export const PROFILE_D_ALPHA = 0.38;
export const PROFILE_D_BETA = 0.65;

export const DEFAULT_CONTINUOUS_PARAMS: Required<ContinuousCurveParams> = {
  transitionRatio: PROFILE_D_LAMBDA,
  shoulderSoftness: PROFILE_D_ALPHA,
  cornerFullness: PROFILE_D_BETA,
};

/** Canonical PTV Token Radius Hierarchy */
export const PTV_CURVE_TOKENS = {
  xs: 6, // Micro badges, inline tags (h: 18-24px)
  sm: 9, // Small controls, compact buttons (h: 28-34px)
  md: 12, // Standard controls: inputs, select triggers, buttons (h: 38-46px)
  lg: 16, // Sub-panels, dropdowns, nested cards (h: 80-240px)
  xl: 22, // Standard cards, bento grid items, surface panels
  '2xl': 28, // Modal dialogs, prominent bento containers, hero cards
  '3xl': 34, // Drawers, floating bottom sheets, master surfaces
} as const;

export type PtvCurveTokenKey = keyof typeof PTV_CURVE_TOKENS;

/**
 * Clamp radius to maximum permissible value within bounding box [0, w] x [0, h]
 */
export function clampRadius(r: number, w: number, h: number): number {
  if (r <= 0 || w <= 0 || h <= 0) return 0;
  return Math.min(r, w / 2, h / 2);
}

/**
 * Calculate concentric nested inner radius: R_inner = max(0, R_outer - inset)
 */
export function calculateNestedRadius(outerRadius: number, inset: number): number {
  return Math.max(0, outerRadius - inset);
}

/**
 * Evaluate single Top-Left continuous corner point and its derivatives at parameter t in [0, 1]
 * Coordinate frame: Corner vertex at (0, 0), curve starts at (0, L) and ends at (L, 0).
 */
export function evaluateQuinticCornerAt(
  t: number,
  r: number,
  params: ContinuousCurveParams = {}
): ContinuousPointEvaluation {
  const clampedT = Math.max(0, Math.min(1, t));

  if (r <= 0) {
    return { x: 0, y: 0, dx: 0, dy: 0, d2x: 0, d2y: 0, L: 0 };
  }

  const lambda = Math.max(0.15, Math.min(0.9, params.transitionRatio ?? PROFILE_D_LAMBDA));
  const L = r * (1 + lambda);

  const alphaRaw = params.shoulderSoftness ?? PROFILE_D_ALPHA;
  const alpha = Math.max(0.2, Math.min(0.5, alphaRaw));

  const betaRaw = params.cornerFullness ?? PROFILE_D_BETA;
  const beta = Math.max(alpha + 0.15, Math.min(0.85, betaRaw));

  // 6 Control points of the quintic Bézier curve
  // P0, P1, P2 collinear along vertical straight axis (x = 0)
  // P3, P4, P5 collinear along horizontal straight axis (y = 0)
  const p0 = { x: 0, y: L };
  const p1 = { x: 0, y: L * (1 - alpha) };
  const p2 = { x: 0, y: L * (1 - beta) };
  const p3 = { x: L * (1 - beta), y: 0 };
  const p4 = { x: L * (1 - alpha), y: 0 };
  const p5 = { x: L, y: 0 };

  const mt = 1 - clampedT;

  // Quintic Bernstein basis polynomials B_{5, i}(t)
  const b0 = Math.pow(mt, 5);
  const b1 = 5 * Math.pow(mt, 4) * clampedT;
  const b2 = 10 * Math.pow(mt, 3) * Math.pow(clampedT, 2);
  const b3 = 10 * Math.pow(mt, 2) * Math.pow(clampedT, 3);
  const b4 = 5 * mt * Math.pow(clampedT, 4);
  const b5 = Math.pow(clampedT, 5);

  const x = b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x + b4 * p4.x + b5 * p5.x;
  const y = b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y + b4 * p4.y + b5 * p5.y;

  // First derivative basis: 5 * sum_{i=0}^4 B_{4, i}(t) * Delta P_i
  const db0 = Math.pow(mt, 4);
  const db1 = 4 * Math.pow(mt, 3) * clampedT;
  const db2 = 6 * Math.pow(mt, 2) * Math.pow(clampedT, 2);
  const db3 = 4 * mt * Math.pow(clampedT, 3);
  const db4 = Math.pow(clampedT, 4);

  const d0 = { x: p1.x - p0.x, y: p1.y - p0.y };
  const d1 = { x: p2.x - p1.x, y: p2.y - p1.y };
  const d2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  const d3 = { x: p4.x - p3.x, y: p4.y - p3.y };
  const d4 = { x: p5.x - p4.x, y: p5.y - p4.y };

  const dx = 5 * (db0 * d0.x + db1 * d1.x + db2 * d2.x + db3 * d3.x + db4 * d4.x);
  const dy = 5 * (db0 * d0.y + db1 * d1.y + db2 * d2.y + db3 * d3.y + db4 * d4.y);

  // Second derivative basis: 20 * sum_{i=0}^3 B_{3, i}(t) * Delta^2 P_i
  const d2b0 = Math.pow(mt, 3);
  const d2b1 = 3 * Math.pow(mt, 2) * clampedT;
  const d2b2 = 3 * mt * Math.pow(clampedT, 2);
  const d2b3 = Math.pow(clampedT, 3);

  const dd0 = { x: p2.x - 2 * p1.x + p0.x, y: p2.y - 2 * p1.y + p0.y };
  const dd1 = { x: p3.x - 2 * p2.x + p1.x, y: p3.y - 2 * p2.y + p1.y };
  const dd2 = { x: p4.x - 2 * p3.x + p2.x, y: p4.y - 2 * p3.y + p2.y };
  const dd3 = { x: p5.x - 2 * p4.x + p3.x, y: p5.y - 2 * p4.y + p3.y };

  const d2x = 20 * (d2b0 * dd0.x + d2b1 * dd1.x + d2b2 * dd2.x + d2b3 * dd3.x);
  const d2y = 20 * (d2b0 * dd0.y + d2b1 * dd1.y + d2b2 * dd2.y + d2b3 * dd3.y);

  return { x, y, dx, dy, d2x, d2y, L };
}

/**
 * Calculate signed curvature kappa(t) = |dx * d2y - dy * d2x| / (dx^2 + dy^2)^(3/2)
 */
export function calculateCurvatureAt(
  t: number,
  r: number,
  params: ContinuousCurveParams = {}
): number {
  if (r <= 0) return 0;
  const { dx, dy, d2x, d2y } = evaluateQuinticCornerAt(t, r, params);
  const speedSq = dx * dx + dy * dy;
  if (speedSq < 1e-12) return 0;
  const num = Math.abs(dx * d2y - dy * d2x);
  const den = Math.pow(speedSq, 1.5);
  return num / den;
}

/**
 * Sample discrete points along single top-left corner
 */
export function evaluateContinuousCornerPoints(
  r: number,
  steps = 32,
  params: ContinuousCurveParams = {}
): CurvePoint[] {
  const points: CurvePoint[] = [];
  const clampedSteps = Math.max(10, Math.min(100, steps));

  for (let i = 0; i <= clampedSteps; i++) {
    const t = i / clampedSteps;
    const { x, y, dx, dy, d2x, d2y } = evaluateQuinticCornerAt(t, r, params);
    const speed = Math.sqrt(dx * dx + dy * dy);

    let tx = 0;
    let ty = 0;
    let nx = 0;
    let ny = 0;
    if (speed > 1e-9) {
      tx = dx / speed;
      ty = dy / speed;
      // Inward normal for TL corner
      nx = -ty;
      ny = tx;
    }

    const num = Math.abs(dx * d2y - dy * d2x);
    const den = Math.pow(Math.max(1e-12, dx * dx + dy * dy), 1.5);
    const curvature = den > 0 ? num / den : 0;

    points.push({
      x,
      y,
      t,
      tangentX: tx,
      tangentY: ty,
      normalX: nx,
      normalY: ny,
      curvature,
    });
  }

  return points;
}

/**
 * Generate complete closed rectangular SVG path with symmetric 4 continuous corners.
 * Bounding box is w × h.
 *
 * Traversal is clockwise:
 * 1. Top Edge: (safeL, 0) -> (w - safeL, 0)
 * 2. Top-Right Corner: curves to (w, safeL)
 * 3. Right Edge: (w, safeL) -> (w, h - safeL)
 * 4. Bottom-Right Corner: curves to (w - safeL, h)
 * 5. Bottom Edge: (w - safeL, h) -> (safeL, h)
 * 6. Bottom-Left Corner: curves to (0, h - safeL)
 * 7. Left Edge: (0, h - safeL) -> (0, safeL)
 * 8. Top-Left Corner: curves to (safeL, 0)
 * Close path with Z.
 */
export function generateContinuousPath(
  w: number,
  h: number,
  r: number,
  steps = 28,
  params: ContinuousCurveParams = {}
): string {
  const clampedR = clampRadius(r, w, h);
  if (clampedR <= 0 || w <= 0 || h <= 0) {
    return `M 0 0 L ${w.toFixed(2)} 0 L ${w.toFixed(2)} ${h.toFixed(2)} L 0 ${h.toFixed(2)} Z`;
  }

  const tlPoints = evaluateContinuousCornerPoints(clampedR, steps, params);
  const L = evaluateQuinticCornerAt(0, clampedR, params).L;
  const safeL = Math.min(L, w / 2, h / 2);

  // If transition length L was clamped by half-width/height, scale points proportionally
  const scale = L > 0 ? safeL / L : 1;

  // 1. Top Edge: from TL exit (safeL, 0) to TR entry (w - safeL, 0)
  let d = `M ${safeL.toFixed(2)} 0 L ${(w - safeL).toFixed(2)} 0`;

  // 2. Top-Right Corner (TR): vertex at (w, 0)
  // Curves smoothly from (w - safeL, 0) to (w, safeL)
  for (let i = tlPoints.length - 1; i >= 0; i--) {
    const pt = tlPoints[i];
    const px = w - pt.x * scale;
    const py = pt.y * scale;
    d += ` L ${px.toFixed(2)} ${py.toFixed(2)}`;
  }

  // 3. Right Edge: strictly vertical from (w, safeL) to (w, h - safeL)
  d += ` L ${w.toFixed(2)} ${(h - safeL).toFixed(2)}`;

  // 4. Bottom-Right Corner (BR): vertex at (w, h)
  // Curves smoothly from (w, h - safeL) to (w - safeL, h)
  for (let i = 0; i < tlPoints.length; i++) {
    const pt = tlPoints[i];
    const px = w - pt.x * scale;
    const py = h - pt.y * scale;
    d += ` L ${px.toFixed(2)} ${py.toFixed(2)}`;
  }

  // 5. Bottom Edge: strictly horizontal from (w - safeL, h) to (safeL, h)
  d += ` L ${(safeL).toFixed(2)} ${h.toFixed(2)}`;

  // 6. Bottom-Left Corner (BL): vertex at (0, h)
  // Curves smoothly from (safeL, h) to (0, h - safeL)
  for (let i = tlPoints.length - 1; i >= 0; i--) {
    const pt = tlPoints[i];
    const px = pt.x * scale;
    const py = h - pt.y * scale;
    d += ` L ${px.toFixed(2)} ${py.toFixed(2)}`;
  }

  // 7. Left Edge: strictly vertical from (0, h - safeL) to (0, safeL)
  d += ` L 0 ${safeL.toFixed(2)}`;

  // 8. Top-Left Corner (TL): vertex at (0, 0)
  // Curves smoothly from (0, safeL) to (safeL, 0)
  for (let i = 0; i < tlPoints.length; i++) {
    const pt = tlPoints[i];
    const px = pt.x * scale;
    const py = pt.y * scale;
    d += ` L ${px.toFixed(2)} ${py.toFixed(2)}`;
  }

  d += ' Z';
  return d;
}

/**
 * Generate closed SVG path for nested inner container using concentric formula:
 * R_inner = max(0, R_outer - inset)
 * innerW = max(0, outerW - 2 * inset)
 * innerH = max(0, outerH - 2 * inset)
 */
export function generateContinuousInnerPath(
  outerW: number,
  outerH: number,
  outerR: number,
  inset: number,
  steps = 28,
  params: ContinuousCurveParams = {}
): string {
  const innerW = Math.max(0, outerW - inset * 2);
  const innerH = Math.max(0, outerH - inset * 2);
  const innerR = clampRadius(calculateNestedRadius(outerR, inset), innerW, innerH);
  return generateContinuousPath(innerW, innerH, innerR, steps, params);
}
