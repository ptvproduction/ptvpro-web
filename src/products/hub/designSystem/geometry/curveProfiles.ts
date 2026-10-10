/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V2
 * Curve Profiles: Mathematical definitions, derivatives, curvature calculation,
 * and SVG path generation for Profiles A, B, C, and D.
 */

import {
  CurveProfileId,
  CurveProfileConfig,
  CurvePoint,
  CurvatureCombSample,
  ProfileMetrics,
} from './types';

export const PROFILE_CONFIGS: Record<CurveProfileId, CurveProfileConfig> = {
  circle: {
    id: 'circle',
    name: 'Circular Rounded Rectangle',
    shortName: 'Profile A: Circle',
    tagline: 'Standard CSS border-radius baseline',
    continuityClass: 'G1',
    description:
      'Busur lingkaran 90° standar. Kontinu secara posisi (G0) dan tangen (G1), namun diskontinu pada turunan kedua (G2): kelengkungan melompat seketika dari 0 ke 1/R pada titik temu garis lurus.',
    mathematicalFormula: 'x(θ) = R(1 - cos θ), y(θ) = R(1 - sin θ), θ ∈ [0, π/2], κ = 1/R',
  },
  superellipse: {
    id: 'superellipse',
    name: 'Gabriel Lamé Superellipse',
    shortName: 'Profile B: Superellipse',
    tagline: 'Persamaan Lamé dengan exponent (n) adaptif',
    continuityClass: 'G1+',
    description:
      'Superellipse Gabriel Lamé (1818). Memberikan fullness lebih besar di sudut diagonal, namun terbatas pada bounding box R × R dan memusatkan kelengkungan ekstrem di bahu sudut ketika n > 3.0.',
    mathematicalFormula: '|x/R|^n + |y/R|^n = 1, x(t) = R(1 - cos^(2/n)(πt/2)), t ∈ [0, 1]',
  },
  bezier: {
    id: 'bezier',
    name: 'Continuous Composite Bézier (Apple Model)',
    shortName: 'Profile C: Continuous Bézier',
    tagline: 'Transisi bertahap terinspirasi Apple iOS / Figma Squircle',
    continuityClass: 'G1+',
    description:
      'Profil kurva Bézier kubik komposit dengan zona transisi diperpanjang (L = R × (1 + s × 0.55)) sepanjang tepi lurus. Menghilangkan efek pinched corner dan menciptakan transisi visual organik layaknya hardware Apple.',
    mathematicalFormula: 'Composite Cubic Bézier: L = R(1 + 0.55s), tangen G1 kontinu di junction & diagonal',
  },
  'curvature-optimized': {
    id: 'curvature-optimized',
    name: 'Curvature-Optimized Profile (G2 Quintic)',
    shortName: 'Profile D: Curvature-Optimized',
    tagline: 'Turunan kelengkungan kontinu (G2) dengan awal κ = 0',
    continuityClass: 'G2',
    description:
      'Profil parametrik orde-5 (quintic Bézier) yang dirancang secara eksplisit dengan kontrol titik collinear pada sumbu lurus. Terbukti secara analitis memiliki kelengkungan awal κ(0) = 0 dan κ(1) = 0, mencapai kontinuitas kelengkungan G2 sejati tanpa lonjakan sentrifugal.',
    mathematicalFormula: 'Quintic Bézier P0..P5 dengan P0,P1,P2 collinear pada tepi lurus ⇒ κ(0) = 0 (G2 terverifikasi)',
  },
};

/**
 * Parameter interface for profile calculations
 */
export interface ProfileParameters {
  exponent?: number; // For superellipse (default 3.5, clamped to [1.5, 6.0])
  smoothing?: number; // For bezier (0 to 1, default 0.6)
  transitionRatio?: number; // lambda in [0.15, 0.90] (default 0.45, L = r * (1 + lambda))
  shoulderSoftness?: number; // alpha in [0.20, 0.50] (default 0.38, controls P1 on straight axis)
  cornerFullness?: number; // beta in [0.50, 0.85] (default 0.65, controls P2 on straight axis)
  opticalRadiusScale?: number; // Visual radius scaling factor
}

/**
 * Clamp radius to maximum possible inside bounding box
 */
export function clampRadius(r: number, w: number, h: number): number {
  if (r <= 0 || w <= 0 || h <= 0) return 0;
  return Math.min(r, w / 2, h / 2);
}

/**
 * Evaluate single Top-Left corner point and its derivatives at parameter t in [0, 1]
 * Coordinate frame: Corner vertex at (0, 0), curve starts at (0, L) and ends at (L, 0).
 */
export function evaluateCornerAt(
  t: number,
  r: number,
  profileId: CurveProfileId,
  params: ProfileParameters = {}
): { x: number; y: number; dx: number; dy: number; d2x: number; d2y: number; L: number } {
  const clampedT = Math.max(0, Math.min(1, t));

  // Handle radius = 0 degenerate case
  if (r <= 0) {
    return { x: 0, y: 0, dx: 0, dy: 0, d2x: 0, d2y: 0, L: 0 };
  }

  if (profileId === 'circle') {
    const L = r;
    const theta = (Math.PI / 2) * clampedT;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);

    const x = r * (1 - cosT);
    const y = r * (1 - sinT);

    const dt = Math.PI / 2;
    const dx = r * dt * sinT;
    const dy = -r * dt * cosT;

    const d2x = r * dt * dt * cosT;
    const d2y = r * dt * dt * sinT;

    return { x, y, dx, dy, d2x, d2y, L };
  }

  if (profileId === 'superellipse') {
    const n = Math.max(1.5, Math.min(6.0, params.exponent ?? 3.5));
    const L = r;

    // Use regularized angle parameterization with central difference for numerical stability
    const theta = (Math.PI / 2) * clampedT;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    const safePow = (base: number, p: number) => {
      if (base <= 0) return 0;
      return Math.pow(base, p);
    };

    const x = r * (1 - safePow(cosT, 2 / n));
    const y = r * (1 - safePow(sinT, 2 / n));

    // Numerical differentiation for stable derivatives without singularities near 0 and pi/2
    const h = 0.001;
    const tPlus = Math.min(1, clampedT + h);
    const tMinus = Math.max(0, clampedT - h);
    const thPlus = (Math.PI / 2) * tPlus;
    const thMinus = (Math.PI / 2) * tMinus;

    const xPlus = r * (1 - safePow(Math.cos(thPlus), 2 / n));
    const xMinus = r * (1 - safePow(Math.cos(thMinus), 2 / n));
    const yPlus = r * (1 - safePow(Math.sin(thPlus), 2 / n));
    const yMinus = r * (1 - safePow(Math.sin(thMinus), 2 / n));

    let dx = (xPlus - xMinus) / (tPlus - tMinus);
    let dy = (yPlus - yMinus) / (tPlus - tMinus);

    // Exact analytical boundary tangent alignment
    if (clampedT <= 0) {
      dx = 0;
      dy = -r * (Math.PI / 2);
    } else if (clampedT >= 1) {
      dy = 0;
      dx = r * (Math.PI / 2);
    }

    const d2x = (xPlus - 2 * x + xMinus) / Math.pow(h, 2);
    const d2y = (yPlus - 2 * y + yMinus) / Math.pow(h, 2);

    return { x, y, dx, dy, d2x, d2y, L };
  }

  if (profileId === 'bezier') {
    const s = Math.max(0, Math.min(1, params.smoothing ?? 0.6));
    // Extended transition length (tunable via transitionRatio or smoothing)
    const lambda = params.transitionRatio !== undefined ? Math.max(0.1, Math.min(0.9, params.transitionRatio)) : s * 0.55;
    const effectiveR = r * (params.opticalRadiusScale ?? 1.0);
    const L = effectiveR * (1 + lambda);

    // Diagonal apex coordinates at t = 0.5
    // Fullness adjustment allows optical tuning of diagonal bite
    const fullnessMod = params.cornerFullness !== undefined ? Math.max(0.7, Math.min(1.3, params.cornerFullness / 0.65)) : 1.0;
    const diagBase = effectiveR * (1 - Math.SQRT1_2);
    const xm = diagBase * (1 - 0.25 * s * fullnessMod);
    const ym = xm;

    // Composite cubic Bézier split into two symmetric segments around t = 0.5
    if (clampedT <= 0.5) {
      // First segment: [0, L] to [xm, ym]
      const u = clampedT * 2; // reparameterize to [0, 1]
      const c1 = L * (0.35 + 0.15 * s);
      const c2 = effectiveR * (0.22 + 0.1 * s);

      const p0 = { x: 0, y: L };
      const p1 = { x: 0, y: L - c1 };
      const p2 = { x: xm - c2 * Math.SQRT1_2, y: ym + c2 * Math.SQRT1_2 };
      const p3 = { x: xm, y: ym };

      const u2 = u * u;
      const u3 = u2 * u;
      const mu = 1 - u;
      const mu2 = mu * mu;
      const mu3 = mu2 * mu;

      const x = mu3 * p0.x + 3 * mu2 * u * p1.x + 3 * mu * u2 * p2.x + u3 * p3.x;
      const y = mu3 * p0.y + 3 * mu2 * u * p1.y + 3 * mu * u2 * p2.y + u3 * p3.y;

      const du_dt = 2;
      const dx_du = 3 * mu2 * (p1.x - p0.x) + 6 * mu * u * (p2.x - p1.x) + 3 * u2 * (p3.x - p2.x);
      const dy_du = 3 * mu2 * (p1.y - p0.y) + 6 * mu * u * (p2.y - p1.y) + 3 * u2 * (p3.y - p2.y);
      const dx = dx_du * du_dt;
      const dy = dy_du * du_dt;

      const d2x_du2 = 6 * mu * (p2.x - 2 * p1.x + p0.x) + 6 * u * (p3.x - 2 * p2.x + p1.x);
      const d2y_du2 = 6 * mu * (p2.y - 2 * p1.y + p0.y) + 6 * u * (p3.y - 2 * p2.y + p1.y);
      const d2x = d2x_du2 * du_dt * du_dt;
      const d2y = d2y_du2 * du_dt * du_dt;

      return { x, y, dx, dy, d2x, d2y, L };
    } else {
      // Second segment: [xm, ym] to [L, 0] (symmetric by swapping x and y)
      const u = (clampedT - 0.5) * 2;
      const c1 = L * (0.35 + 0.15 * s);
      const c2 = effectiveR * (0.22 + 0.1 * s);

      const q0 = { x: xm, y: ym };
      const q1 = { x: xm + c2 * Math.SQRT1_2, y: ym - c2 * Math.SQRT1_2 };
      const q2 = { x: L - c1, y: 0 };
      const q3 = { x: L, y: 0 };

      const u2 = u * u;
      const u3 = u2 * u;
      const mu = 1 - u;
      const mu2 = mu * mu;
      const mu3 = mu2 * mu;

      const x = mu3 * q0.x + 3 * mu2 * u * q1.x + 3 * mu * u2 * q2.x + u3 * q3.x;
      const y = mu3 * q0.y + 3 * mu2 * u * q1.y + 3 * mu * u2 * q2.y + u3 * q3.y;

      const du_dt = 2;
      const dx_du = 3 * mu2 * (q1.x - q0.x) + 6 * mu * u * (q2.x - q1.x) + 3 * u2 * (q3.x - q2.x);
      const dy_du = 3 * mu2 * (q1.y - q0.y) + 6 * mu * u * (q2.y - q1.y) + 3 * u2 * (q3.y - q2.y);
      const dx = dx_du * du_dt;
      const dy = dy_du * du_dt;

      const d2x_du2 = 6 * mu * (q2.x - 2 * q1.x + q0.x) + 6 * u * (q3.x - 2 * q2.x + q1.x);
      const d2y_du2 = 6 * mu * (q2.y - 2 * q1.y + q0.y) + 6 * u * (q3.y - 2 * q2.y + q1.y);
      const d2x = d2x_du2 * du_dt * du_dt;
      const d2y = d2y_du2 * du_dt * du_dt;

      return { x, y, dx, dy, d2x, d2y, L };
    }
  }

  // Profile D: curvature-optimized (Quintic Bézier with guaranteed G2 continuity)
  {
    const lambda = Math.max(0.15, Math.min(0.90, params.transitionRatio ?? 0.45));
    const effectiveR = r * (params.opticalRadiusScale ?? 1.0);
    const L = effectiveR * (1 + lambda);

    // Alpha controls shoulder softness (P1 along entry/exit tangent)
    const alphaRaw = params.shoulderSoftness ?? 0.38;
    const alpha = Math.max(0.20, Math.min(0.50, alphaRaw));

    // Beta controls corner fullness (P2 along entry/exit tangent)
    // Constraint: beta must be strictly > alpha to preserve convexity and avoid self-intersection
    const betaRaw = params.cornerFullness ?? 0.65;
    const beta = Math.max(alpha + 0.15, Math.min(0.85, betaRaw));

    const p0 = { x: 0, y: L };
    const p1 = { x: 0, y: L * (1 - alpha) };
    const p2 = { x: 0, y: L * (1 - beta) };
    const p3 = { x: L * (1 - beta), y: 0 };
    const p4 = { x: L * (1 - alpha), y: 0 };
    const p5 = { x: L, y: 0 };

    const t_val = clampedT;
    const mt = 1 - t_val;

    // Quintic Bernstein polynomials
    const b0 = Math.pow(mt, 5);
    const b1 = 5 * Math.pow(mt, 4) * t_val;
    const b2 = 10 * Math.pow(mt, 3) * Math.pow(t_val, 2);
    const b3 = 10 * Math.pow(mt, 2) * Math.pow(t_val, 3);
    const b4 = 5 * mt * Math.pow(t_val, 4);
    const b5 = Math.pow(t_val, 5);

    const x = b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x + b4 * p4.x + b5 * p5.x;
    const y = b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y + b4 * p4.y + b5 * p5.y;

    // First derivatives: 5 * sum_{i=0}^4 B_{4,i} (P_{i+1} - P_i)
    const db0 = Math.pow(mt, 4);
    const db1 = 4 * Math.pow(mt, 3) * t_val;
    const db2 = 6 * Math.pow(mt, 2) * Math.pow(t_val, 2);
    const db3 = 4 * mt * Math.pow(t_val, 3);
    const db4 = Math.pow(t_val, 4);

    const d0 = { x: p1.x - p0.x, y: p1.y - p0.y };
    const d1 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const d2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    const d3 = { x: p4.x - p3.x, y: p4.y - p3.y };
    const d4 = { x: p5.x - p4.x, y: p5.y - p4.y };

    const dx = 5 * (db0 * d0.x + db1 * d1.x + db2 * d2.x + db3 * d3.x + db4 * d4.x);
    const dy = 5 * (db0 * d0.y + db1 * d1.y + db2 * d2.y + db3 * d3.y + db4 * d4.y);

    // Second derivatives: 20 * sum_{i=0}^3 B_{3,i} (P_{i+2} - 2P_{i+1} + P_i)
    const d2b0 = Math.pow(mt, 3);
    const d2b1 = 3 * Math.pow(mt, 2) * t_val;
    const d2b2 = 3 * mt * Math.pow(t_val, 2);
    const d2b3 = Math.pow(t_val, 3);

    const dd0 = { x: p2.x - 2 * p1.x + p0.x, y: p2.y - 2 * p1.y + p0.y };
    const dd1 = { x: p3.x - 2 * p2.x + p1.x, y: p3.y - 2 * p2.y + p1.y };
    const dd2 = { x: p4.x - 2 * p3.x + p2.x, y: p4.y - 2 * p3.y + p2.y };
    const dd3 = { x: p5.x - 2 * p4.x + p3.x, y: p5.y - 2 * p4.y + p3.y };

    const d2x = 20 * (d2b0 * dd0.x + d2b1 * dd1.x + d2b2 * dd2.x + d2b3 * dd3.x);
    const d2y = 20 * (d2b0 * dd0.y + d2b1 * dd1.y + d2b2 * dd2.y + d2b3 * dd3.y);

    return { x, y, dx, dy, d2x, d2y, L };
  }
}

/**
 * Calculate signed curvature kappa at parameter t
 * kappa = |dx * d2y - dy * d2x| / (dx^2 + dy^2)^(3/2)
 */
export function calculateCurvatureAt(
  t: number,
  r: number,
  profileId: CurveProfileId,
  params: ProfileParameters = {}
): number {
  if (r <= 0) return 0;
  const { dx, dy, d2x, d2y } = evaluateCornerAt(t, r, profileId, params);
  const speedSq = dx * dx + dy * dy;
  if (speedSq < 1e-12) return 0;
  const num = Math.abs(dx * d2y - dy * d2x);
  const den = Math.pow(speedSq, 1.5);
  return num / den;
}

/**
 * Sample discrete points along single top-left corner
 */
export function evaluateCornerPoints(
  r: number,
  profileId: CurveProfileId,
  params: ProfileParameters = {},
  steps = 40
): CurvePoint[] {
  const points: CurvePoint[] = [];
  const clampedSteps = Math.max(10, Math.min(200, steps));

  for (let i = 0; i <= clampedSteps; i++) {
    const t = i / clampedSteps;
    const { x, y, dx, dy, d2x, d2y } = evaluateCornerAt(t, r, profileId, params);
    const speed = Math.sqrt(dx * dx + dy * dy);

    let tx = 0;
    let ty = 0;
    let nx = 0;
    let ny = 0;
    if (speed > 1e-9) {
      tx = dx / speed;
      ty = dy / speed;
      // Inward normal for TL corner (pointing towards center of component)
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
 * Calculate comprehensive mathematical metrics for a profile
 */
export function calculateProfileMetrics(
  r: number,
  profileId: CurveProfileId,
  params: ProfileParameters = {}
): ProfileMetrics {
  const points = evaluateCornerPoints(r, profileId, params, 60);
  const { L } = evaluateCornerAt(0, r, profileId, params);

  let maxCurvature = 0;
  let minCurvature = Number.POSITIVE_INFINITY;
  for (const pt of points) {
    if (pt.curvature > maxCurvature) maxCurvature = pt.curvature;
    if (pt.curvature < minCurvature) minCurvature = pt.curvature;
  }

  // Jump at junctions with straight edges (where kappa_straight = 0)
  const entryKappa = points[0].curvature;
  const exitKappa = points[points.length - 1].curvature;

  // Diagonal point at t = 0.5
  const midPt = points[Math.floor(points.length / 2)];
  const diagonalOffset = Math.sqrt(midPt.x * midPt.x + midPt.y * midPt.y);

  // Circle reference diagonal offset at R
  const circleMid = r * (1 - Math.SQRT1_2);
  const circleDiag = Math.sqrt(2) * circleMid;
  const fullnessVsCircle = circleDiag - diagonalOffset;

  const isG2 = profileId === 'curvature-optimized' || (entryKappa < 1e-4 && exitKappa < 1e-4);

  return {
    profileId,
    transitionLengthX: L,
    transitionLengthY: L,
    maxCurvature,
    minCurvature: minCurvature === Number.POSITIVE_INFINITY ? 0 : minCurvature,
    entryCurvatureJump: entryKappa,
    exitCurvatureJump: exitKappa,
    diagonalOffset,
    fullnessVsCircle,
    isG2Continuous: isG2,
    minRadiusOfCurvature: maxCurvature > 0 ? 1 / maxCurvature : r,
  };
}

/**
 * Generate Curvature Comb visualization vectors
 */
export function generateCurvatureComb(
  points: CurvePoint[],
  combScale = 120
): CurvatureCombSample[] {
  return points.map((pt) => {
    // Offset outwards along negative normal for visible comb
    const length = pt.curvature * combScale;
    return {
      originX: pt.x,
      originY: pt.y,
      combEndX: pt.x - pt.normalX * length,
      combEndY: pt.y - pt.normalY * length,
      curvature: pt.curvature,
      t: pt.t,
    };
  });
}

/**
 * Generate single top-left corner SVG path (with straight extensions for inspection)
 */
export function generateCornerPathForProfile(
  cx: number,
  cy: number,
  r: number,
  profileId: CurveProfileId,
  params: ProfileParameters = {},
  straightLen = 40,
  steps = 40
): string {
  const points = evaluateCornerPoints(r, profileId, params, steps);
  const L = points.length > 0 ? evaluateCornerAt(0, r, profileId, params).L : r;

  let d = `M ${cx} ${cy + L + straightLen} L ${cx} ${cy + L}`;
  for (const pt of points) {
    const px = cx + pt.x;
    const py = cy + pt.y;
    d += ` L ${px.toFixed(2)} ${py.toFixed(2)}`;
  }
  d += ` L ${cx + L + straightLen} ${cy}`;
  return d;
}

/**
 * Generate complete closed rectangular SVG path with symmetric 4 continuous corners.
 * Bounding box is w × h.
 */
export function generateClosedPath(
  w: number,
  h: number,
  r: number,
  profileId: CurveProfileId,
  params: ProfileParameters = {},
  steps = 28
): string {
  const clampedR = clampRadius(r, w, h);
  if (clampedR <= 0 || w <= 0 || h <= 0) {
    return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
  }

  // Get raw corner points for top-left
  const tlPoints = evaluateCornerPoints(clampedR, profileId, params, steps);
  const L = evaluateCornerAt(0, clampedR, profileId, params).L;
  const safeL = Math.min(L, w / 2, h / 2);

  // If transition length L was clamped by half-width/height, scale points proportionally
  const scale = L > 0 ? safeL / L : 1;

  // 1. Top Edge: from TL exit (safeL, 0) to TR entry (w - safeL, 0)
  let d = `M ${safeL.toFixed(2)} 0 L ${(w - safeL).toFixed(2)} 0`;

  // 2. Top-Right Corner (TR): vertex at (w, 0)
  // Curves smoothly from (w - safeL, 0) to (w, safeL)
  // As i decrements from N to 0: pt.x goes L -> 0, pt.y goes 0 -> L
  for (let i = tlPoints.length - 1; i >= 0; i--) {
    const pt = tlPoints[i];
    const px = w - pt.x * scale;
    const py = pt.y * scale;
    d += ` L ${px.toFixed(2)} ${py.toFixed(2)}`;
  }

  // 3. Right Edge: strictly vertical from (w, safeL) to (w, h - safeL)
  d += ` L ${w} ${(h - safeL).toFixed(2)}`;

  // 4. Bottom-Right Corner (BR): vertex at (w, h)
  // Curves smoothly from (w, h - safeL) to (w - safeL, h)
  // As i increments from 0 to N: pt.x goes 0 -> L, pt.y goes L -> 0
  for (let i = 0; i < tlPoints.length; i++) {
    const pt = tlPoints[i];
    const px = w - pt.x * scale;
    const py = h - pt.y * scale;
    d += ` L ${px.toFixed(2)} ${py.toFixed(2)}`;
  }

  // 5. Bottom Edge: strictly horizontal from (w - safeL, h) to (safeL, h)
  d += ` L ${safeL.toFixed(2)} ${h}`;

  // 6. Bottom-Left Corner (BL): vertex at (0, h)
  // Curves smoothly from (safeL, h) to (0, h - safeL)
  // As i decrements from N to 0: pt.x goes L -> 0, pt.y goes 0 -> L
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
  // As i increments from 0 to N: pt.x goes 0 -> L, pt.y goes L -> 0
  for (let i = 0; i < tlPoints.length; i++) {
    const pt = tlPoints[i];
    const px = pt.x * scale;
    const py = pt.y * scale;
    d += ` L ${px.toFixed(2)} ${py.toFixed(2)}`;
  }

  d += ' Z';
  return d;
}
