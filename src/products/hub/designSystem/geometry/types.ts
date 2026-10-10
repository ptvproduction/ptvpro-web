/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V2
 * Type definitions for computational geometry algorithms, metrics, and inspection modes.
 */

export type CurveProfileId = 'circle' | 'superellipse' | 'bezier' | 'curvature-optimized';

export interface CurveProfileConfig {
  id: CurveProfileId;
  name: string;
  shortName: string;
  tagline: string;
  continuityClass: 'G1' | 'G1+' | 'G2';
  description: string;
  mathematicalFormula: string;
}

export interface CurvePoint {
  x: number;
  y: number;
  t: number; // Parameter in [0, 1]
  tangentX: number;
  tangentY: number;
  normalX: number;
  normalY: number;
  curvature: number; // Curvature kappa
}

export interface CurvatureCombSample {
  originX: number;
  originY: number;
  combEndX: number;
  combEndY: number;
  curvature: number;
  t: number;
}

export interface ProfileMetrics {
  profileId: CurveProfileId;
  transitionLengthX: number;
  transitionLengthY: number;
  maxCurvature: number;
  minCurvature: number;
  entryCurvatureJump: number; // Delta kappa at junction with straight line (0 for G2)
  exitCurvatureJump: number;
  diagonalOffset: number; // Distance from corner vertex (0,0) at 45 deg
  fullnessVsCircle: number; // Difference in diagonal distance compared to pure circle
  isG2Continuous: boolean;
  minRadiusOfCurvature: number; // 1 / maxCurvature
}

export interface OffsetEvaluationPoint {
  angleDeg: number;
  normalDistance: number;
  scalarDistance: number;
  distanceError: number;
}

export interface OffsetAnalysis {
  requestedInset: number;
  minRadiusOfCurvature: number;
  hasSelfIntersection: boolean;
  maxDistanceError: number;
  avgDistanceError: number;
  evaluations: OffsetEvaluationPoint[];
}

export type SurfaceMode = 'geometry-only' | 'soft-surface' | 'technical-outline';

export type NormalizationMethod =
  | 'equal-radius'
  | 'equal-transition'
  | 'equal-diagonal'
  | 'equal-area';

export interface ContourDeviationMetrics {
  maxDeviation: number; // Maximum nearest-neighbor distance (Hausdorff, px)
  meanDeviation: number; // Mean nearest-neighbor distance (px)
  rmsDeviation: number; // Root-mean-square distance (px)
  diagonalDifference: number; // Absolute distance difference at 45-degree ray (px)
  curvaturePeak: number; // Maximum curvature (1/px)
  curvatureVariation: number; // kappa_max - kappa_min (1/px)
  transitionLength: number; // Corner transition length L (px)
  samplingTolerance: number; // Theoretical discrete sampling precision bound (px)
}

export interface NormalizedArcLengthSample {
  sNorm: number; // Normalized arc length in [0, 1]
  t: number; // Parameter in [0, 1]
  x: number;
  y: number;
  curvature: number;
}

export interface NormalizationResult {
  method: NormalizationMethod;
  effectiveRadius: number;
  effectiveTransitionLength: number;
  diagonalCutoutDepth: number;
  cornerCutoutArea: number;
  scaleFactorVsNominal: number;
}

