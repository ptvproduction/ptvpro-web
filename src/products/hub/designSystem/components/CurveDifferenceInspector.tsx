/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V3
 * Curve Difference Inspector:
 * Visualizes sub-pixel contour differences between baseline Profile A and continuous candidates (B, C, D).
 * Features:
 * - 4 Normalization strategies (Equal Radius, Equal Transition, Equal Diagonal, Equal Area)
 * - Difference Ribbon Highlight (enclosed delta area polygon)
 * - Corner Zoom (1x, 4x, 8x, 16x)
 * - Curvature graph kappa(s) against normalized arc length s
 * - Quantitative metrics: Hausdorff max, mean, RMS, diagonal diff, curvature peak, variation
 * - Pure Geometry Mode (toggle off all shadows/decorations)
 */

import React, { useState, useMemo } from 'react';
import { CurveProfileId, NormalizationMethod } from '../geometry/types';
import {
  evaluateCornerPoints,
  generateClosedPath,
  ProfileParameters,
} from '../geometry/curveProfiles';
import { normalizeProfileRadius } from '../geometry/curveNormalization';
import {
  computeContourDeviation,
  generateDifferenceRibbonPath,
  computeArcLengthParameterization,
} from '../geometry/curveDifference';

export const CurveDifferenceInspector: React.FC = () => {
  const [candidateProfile, setCandidateProfile] = useState<CurveProfileId>('curvature-optimized');
  const [normMethod, setNormMethod] = useState<NormalizationMethod>('equal-diagonal');
  const [nominalR, setNominalR] = useState(24);
  const [zoomLevel, setZoomLevel] = useState<1 | 4 | 8 | 16>(8);
  const [showDifferenceRibbon, setShowDifferenceRibbon] = useState(true);
  const [showCurvatureGraph, setShowCurvatureGraph] = useState(true);
  const [showTangentMarkers, setShowTangentMarkers] = useState(true);
  const [pureGeometryMode, setPureGeometryMode] = useState(false);

  // Optical parameters
  const optParams: ProfileParameters = useMemo(() => ({
    exponent: 3.5,
    smoothing: 0.6,
    transitionRatio: 0.45,
    shoulderSoftness: 0.38,
    cornerFullness: 0.65,
  }), []);

  // Base canvas dimensions
  const compW = 320;
  const compH = 200;

  // 1. Evaluate Profile A baseline (Circle)
  const basePoints = useMemo(() => {
    return evaluateCornerPoints(nominalR, 'circle', {}, 120);
  }, [nominalR]);

  // 2. Normalization calculation for Candidate Profile
  const normResult = useMemo(() => {
    return normalizeProfileRadius(nominalR, candidateProfile, normMethod, optParams);
  }, [nominalR, candidateProfile, normMethod, optParams]);

  // 3. Evaluate Candidate Profile points with normalized effective radius
  const candidateParams = useMemo(() => {
    return {
      ...optParams,
      opticalRadiusScale: normResult.scaleFactorVsNominal,
    };
  }, [optParams, normResult.scaleFactorVsNominal]);

  const candidatePoints = useMemo(() => {
    return evaluateCornerPoints(nominalR, candidateProfile, candidateParams, 120);
  }, [nominalR, candidateProfile, candidateParams]);

  // 4. Calculate contour deviation metrics
  const deviationMetrics = useMemo(() => {
    return computeContourDeviation(basePoints, candidatePoints);
  }, [basePoints, candidatePoints]);

  const candArcSamples = useMemo(() => {
    return computeArcLengthParameterization(candidatePoints);
  }, [candidatePoints]);

  // 6. Assembled paths for full card preview
  const basePath = useMemo(() => {
    return generateClosedPath(compW, compH, nominalR, 'circle');
  }, [compW, compH, nominalR]);

  const candidatePath = useMemo(() => {
    return generateClosedPath(compW, compH, nominalR, candidateProfile, candidateParams);
  }, [compW, compH, nominalR, candidateProfile, candidateParams]);

  // Zoom canvas setup
  const zoomCanvasSize = 360;
  const zoomCenterOffset = 40;
  const effectiveScale = zoomLevel * 2.8;

  // Difference Ribbon Path in Zoom Coordinates
  const ribbonD = useMemo(() => {
    return generateDifferenceRibbonPath(
      basePoints,
      candidatePoints,
      zoomCenterOffset,
      zoomCenterOffset,
      effectiveScale
    );
  }, [basePoints, candidatePoints, zoomCenterOffset, effectiveScale]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Console Header ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: 'var(--ptv-curve-xl)',
          padding: '20px 24px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 'var(--ptv-curve-pill)',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Optical Difference Inspector
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Perbandingan Sub-Piksel Kontur: Baseline A (Circle) vs Kandidat
              </span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
              Visualisasi Deviasi Kontur &amp; Delta Area
            </h2>
            <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
              Mengisolasi perbedaan transisi kelengkungan murni dari distorsi skala melalui 4 metode normalisasi analitis.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowCurvatureGraph(!showCurvatureGraph)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--ptv-curve-sm)',
                border: showCurvatureGraph ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                background: showCurvatureGraph ? '#eff6ff' : '#ffffff',
                color: showCurvatureGraph ? '#1d4ed8' : '#475569',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-chart-line" style={{ marginRight: '5px' }} />
              Grafik Curvature: {showCurvatureGraph ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={() => setShowTangentMarkers(!showTangentMarkers)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--ptv-curve-sm)',
                border: showTangentMarkers ? '1.5px solid #059669' : '1px solid #cbd5e1',
                background: showTangentMarkers ? '#ecfdf5' : '#ffffff',
                color: showTangentMarkers ? '#065f46' : '#475569',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-circle-dot" style={{ marginRight: '5px' }} />
              Tangen Markers: {showTangentMarkers ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={() => setPureGeometryMode(!pureGeometryMode)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--ptv-curve-sm)',
                border: pureGeometryMode ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                background: pureGeometryMode ? '#0f172a' : '#ffffff',
                color: pureGeometryMode ? '#ffffff' : '#334155',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-vector-square" style={{ marginRight: '6px' }} />
              {pureGeometryMode ? 'Pure Geometry: ON' : 'Pure Geometry Mode'}
            </button>
          </div>
        </div>

        {/* ── Control Bar ── */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
          }}
        >
          {/* Candidate Profile Selector */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Kandidat Kurva (vs Profile A)
            </label>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              {(['superellipse', 'bezier', 'curvature-optimized'] as CurveProfileId[]).map((pId) => (
                <button
                  key={pId}
                  type="button"
                  onClick={() => setCandidateProfile(pId)}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: 'var(--ptv-curve-sm)',
                    border: candidateProfile === pId ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                    background: candidateProfile === pId ? '#eff6ff' : '#ffffff',
                    color: candidateProfile === pId ? '#1d4ed8' : '#475569',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {pId === 'superellipse' ? 'Profile B' : pId === 'bezier' ? 'Profile C' : 'Profile D (G2)'}
                </button>
              ))}
            </div>
          </div>

          {/* Normalization Strategy Selector */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Metode Normalisasi
            </label>
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
              {[
                { id: 'equal-radius', label: 'Equal R' },
                { id: 'equal-transition', label: 'Equal L' },
                { id: 'equal-diagonal', label: 'Equal Diag' },
                { id: 'equal-area', label: 'Equal Area' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setNormMethod(m.id as NormalizationMethod)}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    borderRadius: 'var(--ptv-curve-xs)',
                    border: normMethod === m.id ? '1.5px solid #059669' : '1px solid #cbd5e1',
                    background: normMethod === m.id ? '#ecfdf5' : '#ffffff',
                    color: normMethod === m.id ? '#065f46' : '#475569',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Radius Nominal Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Radius Nominal: {nominalR} px
              </label>
              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                R_eff: {normResult.effectiveRadius.toFixed(1)} px
              </span>
            </div>
            <input
              type="range"
              min="12"
              max="40"
              step="2"
              value={nominalR}
              onChange={(e) => setNominalR(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#2563eb' }}
            />
          </div>

          {/* Zoom Level */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Tingkat Zoom Sudut
            </label>
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
              {([1, 4, 8, 16] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoomLevel(z)}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    borderRadius: 'var(--ptv-curve-xs)',
                    border: zoomLevel === z ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                    background: zoomLevel === z ? '#f5f3ff' : '#ffffff',
                    color: zoomLevel === z ? '#5b21b6' : '#475569',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {z}×
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Inspection Grid: Zoom Canvas + Metrics Panel ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Left: Corner Macro Zoom Canvas */}
        <div
          style={{
            background: pureGeometryMode ? '#090d16' : '#ffffff',
            border: pureGeometryMode ? '1.5px solid #1e293b' : '1.5px solid #e2e8f0',
            borderRadius: 'var(--ptv-curve-xl)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: pureGeometryMode ? 'none' : '0 2px 4px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '14px', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: pureGeometryMode ? '#f8fafc' : '#0f172a' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ color: '#2563eb', marginRight: '6px' }} />
              Corner Macro Canvas ({zoomLevel}× Zoom)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowDifferenceRibbon(!showDifferenceRibbon)}
                style={{
                  padding: '3px 8px',
                  borderRadius: 'var(--ptv-curve-xs)',
                  border: showDifferenceRibbon ? '1px solid #d97706' : '1px solid #cbd5e1',
                  background: showDifferenceRibbon ? '#fffbeb' : 'transparent',
                  color: showDifferenceRibbon ? '#b45309' : '#64748b',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Ribbon Delta: {showDifferenceRibbon ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* SVG Corner Zoom Frame */}
          <div
            style={{
              width: `${zoomCanvasSize}px`,
              height: `${zoomCanvasSize}px`,
              background: pureGeometryMode ? '#0f172a' : '#f8fafc',
              border: pureGeometryMode ? '1px solid #334155' : '1px solid #cbd5e1',
              borderRadius: 'var(--ptv-curve-md)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <svg width={zoomCanvasSize} height={zoomCanvasSize} style={{ position: 'absolute', top: 0, left: 0 }}>
              {/* Background Grid Lines */}
              <defs>
                <pattern id="zoomGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke={pureGeometryMode ? '#1e293b' : '#e2e8f0'} strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={zoomCanvasSize} height={zoomCanvasSize} fill="url(#zoomGrid)" />

              {/* Coordinate Origin Axes (x=0, y=0) */}
              <line
                x1={zoomCenterOffset}
                y1={0}
                x2={zoomCenterOffset}
                y2={zoomCanvasSize}
                stroke={pureGeometryMode ? '#475569' : '#94a3b8'}
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <line
                x1={0}
                y1={zoomCenterOffset}
                x2={zoomCanvasSize}
                y2={zoomCenterOffset}
                stroke={pureGeometryMode ? '#475569' : '#94a3b8'}
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />

              {/* 45-degree Diagonal Reference Ray */}
              <line
                x1={zoomCenterOffset}
                y1={zoomCenterOffset}
                x2={zoomCenterOffset + 240}
                y2={zoomCenterOffset + 240}
                stroke={pureGeometryMode ? '#334155' : '#cbd5e1'}
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Difference Ribbon Enclosed Polygon */}
              {showDifferenceRibbon && ribbonD && (
                <path
                  d={ribbonD}
                  fill="rgba(245, 158, 11, 0.28)"
                  stroke="#d97706"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              )}

              {/* Profile A Contour (Orange dashed) */}
              <path
                d={(() => {
                  let d = `M ${zoomCenterOffset + basePoints[0].x * effectiveScale} ${zoomCenterOffset + basePoints[0].y * effectiveScale}`;
                  for (let i = 1; i < basePoints.length; i++) {
                    d += ` L ${zoomCenterOffset + basePoints[i].x * effectiveScale} ${zoomCenterOffset + basePoints[i].y * effectiveScale}`;
                  }
                  return d;
                })()}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="5 3"
              />

              {/* Candidate Contour (Cyan bold) */}
              <path
                d={(() => {
                  let d = `M ${zoomCenterOffset + candidatePoints[0].x * effectiveScale} ${zoomCenterOffset + candidatePoints[0].y * effectiveScale}`;
                  for (let i = 1; i < candidatePoints.length; i++) {
                    d += ` L ${zoomCenterOffset + candidatePoints[i].x * effectiveScale} ${zoomCenterOffset + candidatePoints[i].y * effectiveScale}`;
                  }
                  return d;
                })()}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
              />

              {/* Tangent & Anchor Markers */}
              {showTangentMarkers && (
                <>
                  {/* Entry point T1 (0, L) */}
                  <circle
                    cx={zoomCenterOffset + candidatePoints[0].x * effectiveScale}
                    cy={zoomCenterOffset + candidatePoints[0].y * effectiveScale}
                    r="4"
                    fill="#3b82f6"
                  />
                  {/* Exit point T2 (L, 0) */}
                  <circle
                    cx={zoomCenterOffset + candidatePoints[candidatePoints.length - 1].x * effectiveScale}
                    cy={zoomCenterOffset + candidatePoints[candidatePoints.length - 1].y * effectiveScale}
                    r="4"
                    fill="#3b82f6"
                  />
                  {/* Diagonal mid point */}
                  <circle
                    cx={zoomCenterOffset + candidatePoints[Math.floor(candidatePoints.length / 2)].x * effectiveScale}
                    cy={zoomCenterOffset + candidatePoints[Math.floor(candidatePoints.length / 2)].y * effectiveScale}
                    r="3.5"
                    fill="#ef4444"
                  />
                </>
              )}
            </svg>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '11px', fontWeight: 700 }}>
            <span style={{ color: '#d97706' }}>
              <i className="fa-solid fa-minus" style={{ marginRight: '5px' }} />
              Profile A (Circle)
            </span>
            <span style={{ color: '#06b6d4' }}>
              <i className="fa-solid fa-minus" style={{ marginRight: '5px' }} />
              Kandidat ({candidateProfile})
            </span>
            <span style={{ color: '#b45309' }}>
              <i className="fa-solid fa-square" style={{ marginRight: '5px', opacity: 0.5 }} />
              Delta Area
            </span>
          </div>
        </div>

        {/* Right: Quantitative Deviation Metrics Panel */}
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: 'var(--ptv-curve-xl)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                <i className="fa-solid fa-calculator" style={{ color: '#059669', marginRight: '6px' }} />
                Metrik Deviasi Kontur Sub-Piksel
              </span>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--ptv-curve-pill)',
                  background: '#f1f5f9',
                  color: '#475569',
                }}
              >
                Toleransi: ±{deviationMetrics.samplingTolerance.toFixed(3)} px
              </span>
            </div>

            {/* Metrics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              {/* Max Deviation (Hausdorff) */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Max Deviation (Hausdorff)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--ptv-font-mono)', marginTop: '2px' }}>
                  {deviationMetrics.maxDeviation.toFixed(3)} px
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                  Jarak terdekat maksimum antar-kontur
                </div>
              </div>

              {/* Mean Deviation */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Mean Deviation</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb', fontFamily: 'var(--ptv-font-mono)', marginTop: '2px' }}>
                  {deviationMetrics.meanDeviation.toFixed(3)} px
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                  Rata-rata jarak terdekat
                </div>
              </div>

              {/* RMS Deviation */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>RMS Deviation</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#7c3aed', fontFamily: 'var(--ptv-font-mono)', marginTop: '2px' }}>
                  {deviationMetrics.rmsDeviation.toFixed(3)} px
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                  Root-mean-square deviasi
                </div>
              </div>

              {/* Diagonal Cutout Diff */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Diagonal Intersect Diff</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#059669', fontFamily: 'var(--ptv-font-mono)', marginTop: '2px' }}>
                  {deviationMetrics.diagonalDifference.toFixed(3)} px
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                  Selisih titik potong 45°
                </div>
              </div>
            </div>

            {/* Curvature & Transition Row */}
            <div
              style={{
                background: '#f8fafc',
                borderRadius: 'var(--ptv-curve-md)',
                padding: '12px 14px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '11.5px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Curvature Peak (κ_max):</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--ptv-font-mono)', color: '#0f172a' }}>
                  {deviationMetrics.curvaturePeak.toFixed(4)} px⁻¹ (R_min = {(1 / Math.max(1e-4, deviationMetrics.curvaturePeak)).toFixed(1)}px)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Curvature Variation (Δκ):</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--ptv-font-mono)', color: '#0f172a' }}>
                  {deviationMetrics.curvatureVariation.toFixed(4)} px⁻¹
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Transition Length (L):</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--ptv-font-mono)', color: '#0f172a' }}>
                  {deviationMetrics.transitionLength.toFixed(1)} px ({((deviationMetrics.transitionLength / nominalR) * 100).toFixed(0)}% dari R)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Normalisasi Aktif:</span>
                <span style={{ fontWeight: 700, color: '#059669' }}>
                  {normResult.method} (Faktor Skala = {normResult.scaleFactorVsNominal.toFixed(3)}×)
                </span>
              </div>
            </div>
          </div>

          {/* Full Card Superimposed Overlay Preview */}
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '8px', alignSelf: 'flex-start' }}>
              Superimposed Card Overlay (320 × 200 px):
            </div>
            <div
              style={{
                width: `${compW}px`,
                height: `${compH}px`,
                position: 'relative',
                background: pureGeometryMode ? '#0f172a' : '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 'var(--ptv-curve-md)',
              }}
            >
              <svg width={compW} height={compH} style={{ position: 'absolute', top: 0, left: 0 }}>
                {/* Profile A Base Outline */}
                <path d={basePath} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" />
                {/* Candidate Outline */}
                <path d={candidatePath} fill="none" stroke="#06b6d4" strokeWidth={2} />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ── Curvature vs Normalized Arc Length Graph ── */}
      {showCurvatureGraph && (
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: 'var(--ptv-curve-xl)',
            padding: '20px 24px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                <i className="fa-solid fa-chart-line" style={{ color: '#2563eb', marginRight: '6px' }} />
                Grafik Kelengkungan κ(s) terhadap Normalized Arc Length s ∈ [0, 1]
              </span>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                Membuktikan G2 kontinuitas (Profile D naik mulus dari 0) versus diskontinuitas G1 Profile A (langsung meloncat ke 1/R).
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', fontWeight: 700 }}>
              <span style={{ color: '#f59e0b' }}>Profile A: Busur Lingkaran (κ konstan = {(1 / nominalR).toFixed(3)})</span>
              <span style={{ color: '#06b6d4' }}>Kandidat ({candidateProfile})</span>
            </div>
          </div>

          {/* SVG Plot */}
          <div style={{ width: '100%', height: '180px', position: 'relative' }}>
            {(() => {
              const graphW = 800;
              const graphH = 150;
              const padX = 50;
              const padY = 20;
              const maxKappa = Math.max(1 / nominalR, deviationMetrics.curvaturePeak) * 1.25;

              // Profile A plot points: flat step from entry to exit
              const baseKappa = 1 / nominalR;
              const basePlotY = graphH - padY - (baseKappa / maxKappa) * (graphH - padY * 2);

              // Candidate plot points
              let candPlotD = '';
              candArcSamples.forEach((sample, idx) => {
                const px = padX + sample.sNorm * (graphW - padX * 2);
                const py = graphH - padY - (sample.curvature / maxKappa) * (graphH - padY * 2);
                if (idx === 0) candPlotD = `M ${px.toFixed(1)} ${py.toFixed(1)}`;
                else candPlotD += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
              });

              return (
                <svg
                  viewBox={`0 0 ${graphW} ${graphH}`}
                  style={{ width: '100%', height: '100%', overflow: 'visible' }}
                >
                  {/* Grid Lines */}
                  <line x1={padX} y1={graphH - padY} x2={graphW - padX} y2={graphH - padY} stroke="#94a3b8" strokeWidth="1" />
                  <line x1={padX} y1={padY} x2={padX} y2={graphH - padY} stroke="#94a3b8" strokeWidth="1" />

                  {/* Horizontal zero label */}
                  <text x={padX - 8} y={graphH - padY + 4} fill="#64748b" fontSize="10" textAnchor="end">0</text>
                  <text x={padX - 8} y={padY + 4} fill="#64748b" fontSize="10" textAnchor="end">
                    {maxKappa.toFixed(3)}
                  </text>
                  <text x={padX} y={graphH - 4} fill="#64748b" fontSize="10">s = 0 (Entry Lurus)</text>
                  <text x={graphW - padX} y={graphH - 4} fill="#64748b" fontSize="10" textAnchor="end">s = 1 (Exit Lurus)</text>

                  {/* Profile A Flat Step */}
                  <line
                    x1={padX}
                    y1={basePlotY}
                    x2={graphW - padX}
                    y2={basePlotY}
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray="5 3"
                  />

                  {/* Candidate Curvature Curve */}
                  <path d={candPlotD} fill="none" stroke="#06b6d4" strokeWidth="2.5" />
                </svg>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
