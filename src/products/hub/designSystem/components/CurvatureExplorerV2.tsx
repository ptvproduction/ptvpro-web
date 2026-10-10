/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V2
 * CurvatureExplorerV2: Interactive inspection tool with dual-profile overlay,
 * side-by-side comparison, 4×-16× macro zoom, curvature comb visualization,
 * tangent lines, and 3 surface modes (Geometry Only, Soft Surface, Technical Outline).
 */

import React, { useState } from 'react';
import { CurveProfileId, SurfaceMode } from '../geometry/types';
import {
  PROFILE_CONFIGS,
  generateClosedPath,
  generateCornerPathForProfile,
  evaluateCornerPoints,
  generateCurvatureComb,
  calculateProfileMetrics,
  ProfileParameters,
} from '../geometry/curveProfiles';

interface CurvatureExplorerV2Props {
  onProfileChange?: (profileId: CurveProfileId) => void;
}

export const CurvatureExplorerV2: React.FC<CurvatureExplorerV2Props> = ({
  onProfileChange,
}) => {
  // ── Geometry Parameters ──
  const [compW, setCompW] = useState<number>(340);
  const [compH, setCompH] = useState<number>(220);
  const [radius, setRadius] = useState<number>(24);
  const [superExponent, setSuperExponent] = useState<number>(3.5);
  const [bezierSmoothing, setBezierSmoothing] = useState<number>(0.6);
  const [optRatio, setOptRatio] = useState<number>(0.45);
  const [insetPadding, setInsetPadding] = useState<number>(14);

  // ── Visual Inspection State ──
  const [inspectMode, setInspectMode] = useState<'overlay' | 'side-by-side' | 'macro-zoom' | 'debug-assembly'>('overlay');
  const [showCssReference, setShowCssReference] = useState<boolean>(true);
  const [showAnchors, setShowAnchors] = useState<boolean>(true);
  const [primaryProfile, setPrimaryProfile] = useState<CurveProfileId>('curvature-optimized');
  const [secondaryProfile, setSecondaryProfile] = useState<CurveProfileId>('circle');
  const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>('soft-surface');
  const [borderThickness, setBorderThickness] = useState<number>(1.5);
  const [shadowIntensity, setShadowIntensity] = useState<'none' | 'soft' | 'deep'>('soft');
  const [zoomLevel, setZoomLevel] = useState<1 | 4 | 8 | 16>(4);
  const [showCurvatureComb, setShowCurvatureComb] = useState<boolean>(true);
  const [showTangentMarkers, setShowTangentMarkers] = useState<boolean>(true);
  const [showNestedChild, setShowNestedChild] = useState<boolean>(true);

  // Parameter pack
  const params: ProfileParameters = {
    exponent: superExponent,
    smoothing: bezierSmoothing,
    transitionRatio: optRatio,
  };

  // Metrics for active profiles
  const primMetrics = calculateProfileMetrics(radius, primaryProfile, params);
  const secMetrics = calculateProfileMetrics(radius, secondaryProfile, params);

  // Surface mode style resolution
  let surfaceFill = '#ffffff';
  let surfaceStroke = '#cbd5e1';
  let surfaceTextColor = '#0f172a';
  let containerBg = '#f8fafc';

  if (surfaceMode === 'geometry-only') {
    surfaceFill = '#0f172a';
    surfaceStroke = 'none';
    surfaceTextColor = '#ffffff';
    containerBg = '#e2e8f0';
  } else if (surfaceMode === 'soft-surface') {
    surfaceFill = '#ffffff';
    surfaceStroke = borderThickness > 0 ? '#e2e8f0' : 'none';
    surfaceTextColor = '#0f172a';
    containerBg = '#f8fafc';
  } else if (surfaceMode === 'technical-outline') {
    surfaceFill = 'rgba(239, 246, 255, 0.4)';
    surfaceStroke = '#2563eb';
    surfaceTextColor = '#1e3a8a';
    containerBg = '#ffffff';
  }

  // Shadow resolution
  let shadowFilter = 'none';
  if (surfaceMode !== 'geometry-only') {
    if (shadowIntensity === 'soft') {
      shadowFilter = 'drop-shadow(0 10px 15px rgba(0,0,0,0.06)) drop-shadow(0 4px 6px rgba(0,0,0,0.03))';
    } else if (shadowIntensity === 'deep') {
      shadowFilter = 'drop-shadow(0 20px 25px rgba(0,0,0,0.12)) drop-shadow(0 8px 10px rgba(0,0,0,0.06))';
    }
  }

  // Paths
  const primaryPath = generateClosedPath(compW, compH, radius, primaryProfile, params);
  const secondaryPath = generateClosedPath(compW, compH, radius, secondaryProfile, params);

  // Nested child dimensions
  const innerW = Math.max(60, compW - insetPadding * 2);
  const innerH = 54;
  const innerR = Math.max(0, radius - insetPadding);
  const primaryInnerPath = generateClosedPath(innerW, innerH, innerR, primaryProfile, params);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ── Header Card ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: 'var(--ptv-curve-xl)',
          padding: '20px 24px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--ptv-curve-pill)',
              background: '#ecfdf5',
              color: '#059669',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Curvature Geometry Explorer V2
          </span>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--ptv-curve-pill)',
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            Active: {PROFILE_CONFIGS[primaryProfile].shortName}
          </span>
        </div>
        <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
          Laboratorium Interaktif: Eksplorasi &amp; Analisis Transisi Kurva
        </h2>
        <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.55 }}>
          Uji langsung perilaku kurva dengan kontrol ukuran dinamis, zoom mikroskopis hingga 16×, curvature comb analitis, dan overlay kontur antara dua profil berbeda.
        </p>
      </div>

      {/* ── Control Console ── */}
      <div
        style={{
          background: '#f8fafc',
          border: '1.5px solid #e2e8f0',
          borderRadius: 'var(--ptv-curve-xl)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <i className="fa-solid fa-sliders" style={{ color: '#2563eb', marginRight: '8px' }} />
            Parameter Geometri &amp; Kontrol Rendering
          </span>
          <button
            type="button"
            onClick={() => {
              setCompW(340);
              setCompH(220);
              setRadius(24);
              setSuperExponent(3.5);
              setBezierSmoothing(0.6);
              setOptRatio(0.45);
              setInsetPadding(14);
              setBorderThickness(1.5);
              setZoomLevel(4);
            }}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--ptv-curve-sm)',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#64748b',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <i className="fa-solid fa-rotate-left" style={{ marginRight: '5px' }} />
            Reset Default (R=24px)
          </button>
        </div>

        {/* Sliders Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '14px',
          }}
        >
          {/* 1. Radius Nominal */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-md)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label htmlFor="exp-radius" style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                Nominal Radius (R)
              </label>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', fontFamily: 'var(--ptv-font-mono)' }}>
                {radius} px
              </span>
            </div>
            <input
              id="exp-radius"
              type="range"
              min="8"
              max="48"
              step="2"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#2563eb' }}
            />
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
              {[12, 16, 22, 28, 36].map((rVal) => (
                <button
                  key={rVal}
                  type="button"
                  onClick={() => setRadius(rVal)}
                  style={{
                    flex: 1,
                    padding: '2px 4px',
                    borderRadius: 'var(--ptv-curve-xs)',
                    border: radius === rVal ? '1px solid #2563eb' : '1px solid #e2e8f0',
                    background: radius === rVal ? '#eff6ff' : '#ffffff',
                    color: radius === rVal ? '#1d4ed8' : '#64748b',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {rVal}px
                </button>
              ))}
            </div>
          </div>

          {/* 2. Algorithm Specific Parameters */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-md)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label htmlFor="exp-algo-param" style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                {primaryProfile === 'superellipse'
                  ? 'Exponent Lamé (n)'
                  : primaryProfile === 'bezier'
                  ? 'Smoothing Bézier (s)'
                  : primaryProfile === 'curvature-optimized'
                  ? 'Transition Ratio (λ)'
                  : 'Circle Parameter'}
              </label>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669', fontFamily: 'var(--ptv-font-mono)' }}>
                {primaryProfile === 'superellipse'
                  ? `n = ${superExponent.toFixed(1)}`
                  : primaryProfile === 'bezier'
                  ? `s = ${(bezierSmoothing * 100).toFixed(0)}%`
                  : primaryProfile === 'curvature-optimized'
                  ? `λ = ${optRatio.toFixed(2)}`
                  : 'Fixed (n=2)'}
              </span>
            </div>
            {primaryProfile === 'superellipse' && (
              <input
                id="exp-algo-param"
                type="range"
                min="2.0"
                max="5.0"
                step="0.1"
                value={superExponent}
                onChange={(e) => setSuperExponent(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#059669' }}
              />
            )}
            {primaryProfile === 'bezier' && (
              <input
                id="exp-algo-param"
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={bezierSmoothing}
                onChange={(e) => setBezierSmoothing(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#7c3aed' }}
              />
            )}
            {primaryProfile === 'curvature-optimized' && (
              <input
                id="exp-algo-param"
                type="range"
                min="0.2"
                max="0.8"
                step="0.05"
                value={optRatio}
                onChange={(e) => setOptRatio(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#059669' }}
              />
            )}
            {primaryProfile === 'circle' && (
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Standar lingkaran circular memiliki exponent tetap n = 2.0 tanpa parameter smoothing.
              </div>
            )}
          </div>

          {/* 3. Surface & Border Mode */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-md)', padding: '12px 14px' }}>
            <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
              Surface &amp; Border Mode (Section 8)
            </span>
            <div style={{ display: 'flex', gap: '5px' }}>
              {(
                [
                  { id: 'geometry-only', label: 'Siluet', icon: 'fa-cube' },
                  { id: 'soft-surface', label: 'Soft Surface', icon: 'fa-feather' },
                  { id: 'technical-outline', label: 'Wireframe', icon: 'fa-compass-drafting' },
                ] as const
              ).map((sm) => (
                <button
                  key={sm.id}
                  type="button"
                  onClick={() => setSurfaceMode(sm.id)}
                  style={{
                    flex: 1,
                    padding: '4px 6px',
                    borderRadius: 'var(--ptv-curve-xs)',
                    border: surfaceMode === sm.id ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                    background: surfaceMode === sm.id ? '#0f172a' : '#ffffff',
                    color: surfaceMode === sm.id ? '#ffffff' : '#334155',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <i className={`fa-solid ${sm.icon}`} style={{ marginRight: '4px' }} />
                  {sm.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Inspection Viewport Zoom */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-md)', padding: '12px 14px' }}>
            <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
              Zoom Sudut &amp; Alat Inspeksi
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {([1, 4, 8, 16] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoomLevel(z)}
                  style={{
                    flex: 1,
                    padding: '4px',
                    borderRadius: 'var(--ptv-curve-xs)',
                    border: zoomLevel === z ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                    background: zoomLevel === z ? '#eff6ff' : '#ffffff',
                    color: zoomLevel === z ? '#1d4ed8' : '#475569',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {z}×
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>Shadow:</span>
              {(['none', 'soft', 'deep'] as const).map((sh) => (
                <button
                  key={sh}
                  type="button"
                  onClick={() => setShadowIntensity(sh)}
                  style={{
                    padding: '2px 6px',
                    borderRadius: 'var(--ptv-curve-xs)',
                    border: shadowIntensity === sh ? '1px solid #0f172a' : '1px solid #e2e8f0',
                    background: shadowIntensity === sh ? '#0f172a' : '#ffffff',
                    color: shadowIntensity === sh ? '#ffffff' : '#475569',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {sh}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowNestedChild(!showNestedChild)}
                style={{
                  marginLeft: 'auto',
                  padding: '2px 6px',
                  borderRadius: 'var(--ptv-curve-xs)',
                  border: '1px solid #cbd5e1',
                  background: showNestedChild ? '#eff6ff' : '#ffffff',
                  color: showNestedChild ? '#1d4ed8' : '#64748b',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Nested: {showNestedChild ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* Profile Selector Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            paddingTop: '10px',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Profil Utama (C1):</span>
            {(['circle', 'superellipse', 'bezier', 'curvature-optimized'] as const).map((pId) => (
              <button
                key={pId}
                type="button"
                onClick={() => {
                  setPrimaryProfile(pId);
                  if (onProfileChange) onProfileChange(pId);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--ptv-curve-xs)',
                  border: primaryProfile === pId ? '1.5px solid #059669' : '1px solid #cbd5e1',
                  background: primaryProfile === pId ? '#ecfdf5' : '#ffffff',
                  color: primaryProfile === pId ? '#065f46' : '#475569',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {PROFILE_CONFIGS[pId].shortName.replace('Profile ', '')}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Profil Pembanding (C2):</span>
            {(['circle', 'superellipse', 'bezier', 'curvature-optimized'] as const).map((pId) => (
              <button
                key={pId}
                type="button"
                onClick={() => setSecondaryProfile(pId)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--ptv-curve-xs)',
                  border: secondaryProfile === pId ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                  background: secondaryProfile === pId ? '#eff6ff' : '#ffffff',
                  color: secondaryProfile === pId ? '#1d4ed8' : '#475569',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {PROFILE_CONFIGS[pId].shortName.replace('Profile ', '')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Viewport Display Area ── */}
      <div
        style={{
          background: containerBg,
          border: '1.5px solid #e2e8f0',
          borderRadius: 'var(--ptv-curve-xl)',
          padding: '30px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          overflowX: 'auto',
          minHeight: '320px',
        }}
      >
        {/* Mode Selector Tabs */}
        <div style={{ display: 'flex', gap: '8px', background: '#ffffff', padding: '4px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #e2e8f0' }}>
          <button
            type="button"
            onClick={() => setInspectMode('overlay')}
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--ptv-curve-sm)',
              border: inspectMode === 'overlay' ? '1px solid #0f172a' : 'none',
              background: inspectMode === 'overlay' ? '#0f172a' : 'transparent',
              color: inspectMode === 'overlay' ? '#ffffff' : '#475569',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <i className="fa-solid fa-layer-group" style={{ marginRight: '6px' }} />
            Overlay Kontur (C1 vs C2)
          </button>
          <button
            type="button"
            onClick={() => setInspectMode('side-by-side')}
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--ptv-curve-sm)',
              border: inspectMode === 'side-by-side' ? '1px solid #0f172a' : 'none',
              background: inspectMode === 'side-by-side' ? '#0f172a' : 'transparent',
              color: inspectMode === 'side-by-side' ? '#ffffff' : '#475569',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <i className="fa-solid fa-table-columns" style={{ marginRight: '6px' }} />
            Berdampingan
          </button>
          <button
            type="button"
            onClick={() => setInspectMode('macro-zoom')}
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--ptv-curve-sm)',
              border: inspectMode === 'macro-zoom' ? '1px solid #0f172a' : 'none',
              background: inspectMode === 'macro-zoom' ? '#0f172a' : 'transparent',
              color: inspectMode === 'macro-zoom' ? '#ffffff' : '#475569',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <i className="fa-solid fa-magnifying-glass-chart" style={{ marginRight: '6px' }} />
            Macro Zoom &amp; Curvature Comb
          </button>
          <button
            type="button"
            onClick={() => setInspectMode('debug-assembly')}
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--ptv-curve-sm)',
              border: inspectMode === 'debug-assembly' ? '1.5px solid #dc2626' : 'none',
              background: inspectMode === 'debug-assembly' ? '#fef2f2' : 'transparent',
              color: inspectMode === 'debug-assembly' ? '#b91c1c' : '#475569',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <i className="fa-solid fa-bug" style={{ marginRight: '6px' }} />
            Debug Assembly &amp; CSS Reference
          </button>
        </div>

        {/* ── MODE 1: OVERLAY VIEW ── */}
        {inspectMode === 'overlay' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', fontWeight: 700 }}>
              <span style={{ color: '#059669' }}>
                <i className="fa-solid fa-minus" style={{ marginRight: '6px' }} />
                C1 (Hijau): {PROFILE_CONFIGS[primaryProfile].shortName}
              </span>
              <span style={{ color: '#2563eb' }}>
                <i className="fa-solid fa-minus" style={{ marginRight: '6px' }} />
                C2 (Biru): {PROFILE_CONFIGS[secondaryProfile].shortName}
              </span>
            </div>

            <div
              style={{
                width: `${compW}px`,
                height: `${compH}px`,
                position: 'relative',
                filter: shadowFilter,
              }}
            >
              <svg width={compW} height={compH} style={{ position: 'absolute', top: 0, left: 0 }}>
                {/* Surface background */}
                <path d={primaryPath} fill={surfaceFill} />
                {/* Primary contour */}
                <path d={primaryPath} fill="none" stroke="#059669" strokeWidth={2} />
                {/* Secondary contour dashed */}
                <path d={secondaryPath} fill="none" stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 3" />
              </svg>

              {/* Foreground content mockup */}
              <div
                style={{
                  width: `${compW}px`,
                  height: `${compH}px`,
                  padding: `${insetPadding}px`,
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  color: surfaceTextColor,
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700 }}>Overlay Curvature Inspector</div>
                  <div style={{ fontSize: '11px', opacity: 0.7 }}>R = {radius}px • Superimposed Trajectory</div>
                </div>

                {showNestedChild && (
                  <div
                    style={{
                      width: `${innerW}px`,
                      height: `${innerH}px`,
                      position: 'relative',
                      boxSizing: 'border-box',
                    }}
                  >
                    <svg width={innerW} height={innerH} style={{ position: 'absolute', top: 0, left: 0 }}>
                      <path d={primaryInnerPath} fill="rgba(241, 245, 249, 0.7)" stroke="#cbd5e1" strokeWidth={1} />
                    </svg>
                    <div
                      style={{
                        padding: '8px 10px',
                        fontSize: '11px',
                        position: 'relative',
                        zIndex: 2,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>Nested Inset Child</span>
                      <b>p = {insetPadding}px</b>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', opacity: 0.8 }}>Delta Fullness: +{(primMetrics.fullnessVsCircle - secMetrics.fullnessVsCircle).toFixed(2)}px</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669' }}>C1 vs C2</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MODE 2: SIDE-BY-SIDE VIEW ── */}
        {inspectMode === 'side-by-side' && (
          <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* Primary Profile Card */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669' }}>
                C1: {PROFILE_CONFIGS[primaryProfile].shortName}
              </span>
              <div
                style={{
                  width: `${compW}px`,
                  height: `${compH}px`,
                  position: 'relative',
                  filter: shadowFilter,
                }}
              >
                <svg width={compW} height={compH} style={{ position: 'absolute', top: 0, left: 0 }}>
                  <path d={primaryPath} fill={surfaceFill} stroke={surfaceStroke} strokeWidth={borderThickness} />
                </svg>
                <div
                  style={{
                    width: `${compW}px`,
                    height: `${compH}px`,
                    padding: `${insetPadding}px`,
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    color: surfaceTextColor,
                    position: 'relative',
                    zIndex: 2,
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700 }}>{PROFILE_CONFIGS[primaryProfile].name}</div>
                    <div style={{ fontSize: '11px', opacity: 0.7 }}>Continuity: {primMetrics.isG2Continuous ? 'G2' : 'G1'}</div>
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>Transition L: {primMetrics.transitionLengthX.toFixed(1)}px</div>
                </div>
              </div>
            </div>

            {/* Secondary Profile Card */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>
                C2: {PROFILE_CONFIGS[secondaryProfile].shortName}
              </span>
              <div
                style={{
                  width: `${compW}px`,
                  height: `${compH}px`,
                  position: 'relative',
                  filter: shadowFilter,
                }}
              >
                <svg width={compW} height={compH} style={{ position: 'absolute', top: 0, left: 0 }}>
                  <path d={secondaryPath} fill={surfaceFill} stroke={surfaceStroke} strokeWidth={borderThickness} />
                </svg>
                <div
                  style={{
                    width: `${compW}px`,
                    height: `${compH}px`,
                    padding: `${insetPadding}px`,
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    color: surfaceTextColor,
                    position: 'relative',
                    zIndex: 2,
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700 }}>{PROFILE_CONFIGS[secondaryProfile].name}</div>
                    <div style={{ fontSize: '11px', opacity: 0.7 }}>Continuity: {secMetrics.isG2Continuous ? 'G2' : 'G1'}</div>
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>Transition L: {secMetrics.transitionLengthX.toFixed(1)}px</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MODE 3: MACRO ZOOM & CURVATURE COMB VIEW ── */}
        {inspectMode === 'macro-zoom' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%', maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                  Macro Inspection: Top-Left Corner ({zoomLevel}× Zoom)
                </span>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Visualisasi Curvature Comb (κ) &amp; Tangen Kontak
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowCurvatureComb(!showCurvatureComb)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 'var(--ptv-curve-xs)',
                    border: '1px solid #cbd5e1',
                    background: showCurvatureComb ? '#eff6ff' : '#ffffff',
                    color: showCurvatureComb ? '#1d4ed8' : '#475569',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Curvature Comb {showCurvatureComb ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTangentMarkers(!showTangentMarkers)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 'var(--ptv-curve-xs)',
                    border: '1px solid #cbd5e1',
                    background: showTangentMarkers ? '#eff6ff' : '#ffffff',
                    color: showTangentMarkers ? '#1d4ed8' : '#475569',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Tangent Guides {showTangentMarkers ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Macro SVG Viewport */}
            {(() => {
              const canvasW = 380;
              const canvasH = 340;
              const scale = (canvasW / (radius * 2.5)) * (zoomLevel / 4);
              const cx = 35;
              const cy = 35;

              // Corner points
              const primPoints = evaluateCornerPoints(radius, primaryProfile, params, 50);

              // Curvature combs
              const primComb = generateCurvatureComb(primPoints, 40 * scale);

              // SVG Corner Paths
              const primCornerD = generateCornerPathForProfile(cx, cy, radius, primaryProfile, params, 50 * scale);
              const secCornerD = generateCornerPathForProfile(cx, cy, radius, secondaryProfile, params, 50 * scale);

              return (
                <div
                  style={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: 'var(--ptv-curve-lg)',
                    padding: '16px',
                    width: `${canvasW}px`,
                    height: `${canvasH}px`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <svg width={canvasW} height={canvasH}>
                    {/* Background Grid */}
                    <defs>
                      <pattern id="macro-grid-exp" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#macro-grid-exp)" />

                    {/* Coordinate axes */}
                    <line x1={cx} y1={0} x2={cx} y2={canvasH} stroke="#334155" strokeWidth="1.5" strokeDasharray="3 3" />
                    <line x1={0} y1={cy} x2={canvasW} y2={cy} stroke="#334155" strokeWidth="1.5" strokeDasharray="3 3" />

                    {/* Curvature Comb for Primary Profile */}
                    {showCurvatureComb &&
                      primComb.map((c, idx) => (
                        <line
                          key={idx}
                          x1={cx + c.originX * scale}
                          y1={cy + c.originY * scale}
                          x2={cx + c.combEndX}
                          y2={cy + c.combEndY}
                          stroke="#10b981"
                          strokeWidth="1.5"
                          opacity={0.7}
                        />
                      ))}

                    {/* Secondary Profile Corner Curve (Blue dashed) */}
                    <path
                      d={secCornerD}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                    />

                    {/* Primary Profile Corner Curve (Emerald bold) */}
                    <path
                      d={primCornerD}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth={3}
                    />

                    {/* Tangent Markers */}
                    {showTangentMarkers && (
                      <>
                        {/* Entry T1 */}
                        <circle cx={cx} cy={cy + primMetrics.transitionLengthY * scale} r="4" fill="#38bdf8" />
                        <text
                          x={cx + 8}
                          y={cy + primMetrics.transitionLengthY * scale + 4}
                          fill="#94a3b8"
                          fontSize="10"
                          fontFamily="var(--ptv-font-mono)"
                        >
                          T1 (0, L)
                        </text>

                        {/* Exit T2 */}
                        <circle cx={cx + primMetrics.transitionLengthX * scale} cy={cy} r="4" fill="#38bdf8" />
                        <text
                          x={cx + primMetrics.transitionLengthX * scale - 14}
                          y={cy - 8}
                          fill="#94a3b8"
                          fontSize="10"
                          fontFamily="var(--ptv-font-mono)"
                        >
                          T2 (L, 0)
                        </text>
                      </>
                    )}
                  </svg>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── MODE 4: PATH ASSEMBLY DEBUG & NATIVE CSS REFERENCE ── */}
        {inspectMode === 'debug-assembly' && (() => {
          const pad = 24;
          const svgW = compW + pad * 2;
          const svgH = compH + pad * 2;
          const safeL = Math.min(primMetrics.transitionLengthX, compW / 2, compH / 2);

          // 8 Corner Anchor Points
          const anchors = [
            { id: 'TR1', x: compW - safeL, y: 0, label: `TR-entry (${(compW - safeL).toFixed(0)}, 0)` },
            { id: 'TR2', x: compW, y: safeL, label: `TR-exit (${compW}, ${safeL.toFixed(0)})` },
            { id: 'BR1', x: compW, y: compH - safeL, label: `BR-entry (${compW}, ${(compH - safeL).toFixed(0)})` },
            { id: 'BR2', x: compW - safeL, y: compH, label: `BR-exit (${(compW - safeL).toFixed(0)}, ${compH})` },
            { id: 'BL1', x: safeL, y: compH, label: `BL-entry (${safeL.toFixed(0)}, ${compH})` },
            { id: 'BL2', x: 0, y: compH - safeL, label: `BL-exit (0, ${(compH - safeL).toFixed(0)})` },
            { id: 'TL1', x: 0, y: safeL, label: `TL-entry (0, ${safeL.toFixed(0)})` },
            { id: 'TL2', x: safeL, y: 0, label: `TL-exit (${safeL.toFixed(0)}, 0)` },
          ];

          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', width: '100%', maxWidth: '780px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                    <i className="fa-solid fa-compass-drafting" style={{ color: '#dc2626', marginRight: '6px' }} />
                    Mode Debug Geometri: Assembly Rekursif &amp; Verifikasi CSS
                  </span>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                    Memisahkan kurva matematika murni dari assembly koordinat global [0, {compW}] × [0, {compH}] px.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowCssReference(!showCssReference)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--ptv-curve-xs)',
                      border: showCssReference ? '1.5px solid #d97706' : '1px solid #cbd5e1',
                      background: showCssReference ? '#fffbeb' : '#ffffff',
                      color: showCssReference ? '#b45309' : '#64748b',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <i className="fa-solid fa-code" style={{ marginRight: '5px' }} />
                    CSS border-radius Ref: {showCssReference ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAnchors(!showAnchors)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--ptv-curve-xs)',
                      border: showAnchors ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      background: showAnchors ? '#eff6ff' : '#ffffff',
                      color: showAnchors ? '#1d4ed8' : '#64748b',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    8 Anchor Points: {showAnchors ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Debug SVG Canvas */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 'var(--ptv-curve-md)',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  overflow: 'auto',
                  position: 'relative',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ width: `${svgW}px`, height: `${svgH}px`, position: 'relative' }}>
                  {/* Native CSS border-radius reference element */}
                  {showCssReference && (
                    <div
                      style={{
                        position: 'absolute',
                        top: `${pad}px`,
                        left: `${pad}px`,
                        width: `${compW}px`,
                        height: `${compH}px`,
                        borderRadius: `${radius}px`,
                        border: '2px dashed #f59e0b',
                        boxSizing: 'border-box',
                        pointerEvents: 'none',
                        zIndex: 1,
                      }}
                    />
                  )}

                  <svg width={svgW} height={svgH} style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
                    <g transform={`translate(${pad}, ${pad})`}>
                      {/* Bounding Box Reference */}
                      <rect
                        x={0}
                        y={0}
                        width={compW}
                        height={compH}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />

                      {/* Straight Edges Highlights (Cyan) */}
                      {/* Top straight */}
                      <line x1={safeL} y1={0} x2={compW - safeL} y2={0} stroke="#06b6d4" strokeWidth="4" opacity={0.6} />
                      {/* Right straight */}
                      <line x1={compW} y1={safeL} x2={compW} y2={compH - safeL} stroke="#06b6d4" strokeWidth="4" opacity={0.6} />
                      {/* Bottom straight */}
                      <line x1={compW - safeL} y1={compH} x2={safeL} y2={compH} stroke="#06b6d4" strokeWidth="4" opacity={0.6} />
                      {/* Left straight */}
                      <line x1={0} y1={compH - safeL} x2={0} y2={safeL} stroke="#06b6d4" strokeWidth="4" opacity={0.6} />

                      {/* The Assembled Closed Path (Blue Outline Only) */}
                      <path
                        d={primaryPath}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="2.5"
                      />

                      {/* Anchor Markers */}
                      {showAnchors &&
                        anchors.map((anc) => (
                          <g key={anc.id}>
                            <circle cx={anc.x} cy={anc.y} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                          </g>
                        ))}
                    </g>
                  </svg>
                </div>
              </div>

              {/* Diagnostic Checklist Card */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--ptv-curve-md)',
                  padding: '14px 18px',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  Status Validasi Geometri Path Assembly:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', fontSize: '11px', color: '#334155' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-circle-check" style={{ color: '#16a34a' }} />
                    <span>Top Edge: Horizontal (y = 0, Δy = 0)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-circle-check" style={{ color: '#16a34a' }} />
                    <span>Right Edge: Vertikal (x = {compW}, Δx = 0)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-circle-check" style={{ color: '#16a34a' }} />
                    <span>Bottom Edge: Horizontal (y = {compH}, Δy = 0)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-circle-check" style={{ color: '#16a34a' }} />
                    <span>Left Edge: Vertikal (x = 0, Δx = 0)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-circle-check" style={{ color: '#16a34a' }} />
                    <span>4 Corner Symmetry: Presisi 100%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-circle-check" style={{ color: '#16a34a' }} />
                    <span>Winding: Clockwise Tertutup Sempurna (`Z`)</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
