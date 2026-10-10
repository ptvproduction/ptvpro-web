/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V3
 * Optical Curvature Tuning View:
 * Interactive geometry parameter cockpit for Profile C (Bézier) and Profile D (G2 Quintic).
 * Features:
 * - Mathematical controls for Transition Ratio (lambda), Shoulder Softness (alpha), Corner Fullness (beta)
 * - Live convexity and G2 continuity invariant verification
 * - Dynamic Curvature Comb visualization
 * - Honest mathematical boundary documentation
 */

import React, { useState, useMemo } from 'react';
import {
  evaluateCornerPoints,
  calculateProfileMetrics,
  generateCurvatureComb,
  generateClosedPath,
  ProfileParameters,
} from '../geometry/curveProfiles';

export const OpticalTuningView: React.FC = () => {
  const [profile, setProfile] = useState<'curvature-optimized' | 'bezier'>('curvature-optimized');
  const [radius, setRadius] = useState<number>(24);
  const [transitionRatio, setTransitionRatio] = useState<number>(0.45);
  const [shoulderSoftness, setShoulderSoftness] = useState<number>(0.38);
  const [cornerFullness, setCornerFullness] = useState<number>(0.65);
  const [bezierSmoothing, setBezierSmoothing] = useState<number>(0.6);
  const [showCurvatureComb, setShowCurvatureComb] = useState<boolean>(true);
  const [combScale, setCombScale] = useState<number>(140);

  const params: ProfileParameters = useMemo(() => {
    return {
      transitionRatio,
      shoulderSoftness,
      cornerFullness,
      smoothing: bezierSmoothing,
    };
  }, [transitionRatio, shoulderSoftness, cornerFullness, bezierSmoothing]);

  // Evaluate corner points
  const points = useMemo(() => {
    return evaluateCornerPoints(radius, profile, params, 50);
  }, [radius, profile, params]);

  // Profile metrics
  const metrics = useMemo(() => {
    return calculateProfileMetrics(radius, profile, params);
  }, [radius, profile, params]);

  // Curvature comb
  const comb = useMemo(() => {
    return generateCurvatureComb(points, combScale);
  }, [points, combScale]);

  // Convexity check: verify all curvature values are positive and non-inflecting
  const isConvex = useMemo(() => {
    return points.every((p) => p.curvature >= -1e-6);
  }, [points]);

  // Canvas setup
  const canvasSize = 340;
  const originOffset = 45;
  const zoomScale = 3.6;

  // Closed path for full card
  const closedPathD = useMemo(() => {
    return generateClosedPath(300, 200, radius, profile, params);
  }, [radius, profile, params]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Header ── */}
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
                  background: '#f5f3ff',
                  color: '#7c3aed',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Optical Tuning Cockpit
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Penalaan Karakter Kurva Tanpa Memperbesar Radius Visual
              </span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
              Kontrol Parameter Geometris Murni (Profile C &amp; D)
            </h2>
            <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
              Mengatur kelembutan bahu sudut (shoulder softness), panjang zona transisi (transition length), dan fullness kurva dengan batas matematis cembung (strictly convex).
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setProfile('curvature-optimized')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--ptv-curve-sm)',
                border: profile === 'curvature-optimized' ? '1.5px solid #059669' : '1px solid #cbd5e1',
                background: profile === 'curvature-optimized' ? '#ecfdf5' : '#ffffff',
                color: profile === 'curvature-optimized' ? '#065f46' : '#475569',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Profile D (G2 Quintic)
            </button>
            <button
              type="button"
              onClick={() => setProfile('bezier')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--ptv-curve-sm)',
                border: profile === 'bezier' ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                background: profile === 'bezier' ? '#f5f3ff' : '#ffffff',
                color: profile === 'bezier' ? '#5b21b6' : '#475569',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Profile C (Continuous Bézier)
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Layout: Controls Sliders + Corner Comb Canvas ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Left: Parameter Sliders */}
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: 'var(--ptv-curve-xl)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'flex', justifyContent: 'space-between' }}>
            <span>
              <i className="fa-solid fa-sliders" style={{ color: '#2563eb', marginRight: '6px' }} />
              Parameter Geometri Eksplisit
            </span>
            <button
              type="button"
              onClick={() => {
                setRadius(24);
                setTransitionRatio(0.45);
                setShoulderSoftness(0.38);
                setCornerFullness(0.65);
                setBezierSmoothing(0.6);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Reset Standar
            </button>
          </div>

          {/* 1. Radius Nominal */}
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>Nominal Radius (R)</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', fontFamily: 'var(--ptv-font-mono)' }}>
                {radius} px
              </span>
            </div>
            <input
              type="range"
              min="12"
              max="44"
              step="2"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#2563eb' }}
            />
          </div>

          {/* 2. Transition Ratio (lambda) */}
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                Transition Ratio (λ): {transitionRatio.toFixed(2)}
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#059669', fontFamily: 'var(--ptv-font-mono)' }}>
                L = {(radius * (1 + transitionRatio)).toFixed(1)} px
              </span>
            </div>
            <input
              type="range"
              min="0.15"
              max="0.85"
              step="0.05"
              value={transitionRatio}
              onChange={(e) => setTransitionRatio(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#059669' }}
            />
            <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '4px' }}>
              Menentukan panjang zona transisi sepanjang tepi lurus (L = R × (1 + λ)). Semakin tinggi λ, onset kelengkungan semakin halus.
            </div>
          </div>

          {/* 3. Shoulder Softness (alpha) */}
          {profile === 'curvature-optimized' && (
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                  Shoulder Softness (α): {shoulderSoftness.toFixed(2)}
                </span>
                <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 700 }}>
                  P1 = L × {(1 - shoulderSoftness).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.20"
                max="0.48"
                step="0.02"
                value={shoulderSoftness}
                onChange={(e) => setShoulderSoftness(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#7c3aed' }}
              />
              <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '4px' }}>
                Mengontrol posisi titik kontrol P1 pada garis lurus. Menentukan percepatan awal laju kelengkungan κ(t) saat meninggalkan garis lurus.
              </div>
            </div>
          )}

          {/* 4. Corner Fullness (beta) */}
          {profile === 'curvature-optimized' && (
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                  Corner Fullness (β): {cornerFullness.toFixed(2)}
                </span>
                <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 700 }}>
                  P2 = L × {(1 - cornerFullness).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={Math.max(0.50, shoulderSoftness + 0.15)}
                max="0.85"
                step="0.02"
                value={Math.max(cornerFullness, shoulderSoftness + 0.15)}
                onChange={(e) => setCornerFullness(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#d97706' }}
              />
              <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '4px' }}>
                Mengontrol titik kontrol P2. Wajib &gt; α + 0.15 agar kurva strictly convex dan tidak mengalami pembalikan kelengkungan (inflection).
              </div>
            </div>
          )}

          {/* 5. Bezier Smoothing factor (if Profile C) */}
          {profile === 'bezier' && (
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                  Bezier Smoothing Factor (s): {bezierSmoothing.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.95"
                step="0.05"
                value={bezierSmoothing}
                onChange={(e) => setBezierSmoothing(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#7c3aed' }}
              />
              <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '4px' }}>
                Interpolasi kelengkungan model Apple Squircle pada composite cubic Bézier.
              </div>
            </div>
          )}

          {/* Invariant Quality Monitor */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--ptv-curve-md)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '11px',
            }}
          >
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>
              Status Invarian Matematis:
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>G2 Curvature Continuity (κ_jump &lt; 1e-6):</span>
              <span style={{ fontWeight: 700, color: metrics.isG2Continuous ? '#16a34a' : '#d97706' }}>
                {metrics.isG2Continuous ? 'TERVERIFIKASI (G2)' : 'TERBATAS (G1+)'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Strict Convexity (No Inflection):</span>
              <span style={{ fontWeight: 700, color: isConvex ? '#16a34a' : '#dc2626' }}>
                {isConvex ? 'LOLOS (Convex)' : 'GAGAL (Inflection)'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Diagonal Offset Ray (d_diag):</span>
              <span style={{ fontWeight: 700, color: '#2563eb', fontFamily: 'var(--ptv-font-mono)' }}>
                {metrics.diagonalOffset.toFixed(2)} px
              </span>
            </div>
          </div>
        </div>

        {/* Right: Corner Curvature Comb Visualization Canvas */}
        <div
          style={{
            background: '#090d16',
            border: '1.5px solid #1e293b',
            borderRadius: 'var(--ptv-curve-xl)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '12px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#f8fafc' }}>
              <i className="fa-solid fa-chart-area" style={{ color: '#10b981', marginRight: '6px' }} />
              Curvature Comb Vectors (κ) &amp; Tangen Kontak
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setShowCurvatureComb(!showCurvatureComb)}
                style={{
                  padding: '3px 8px',
                  borderRadius: 'var(--ptv-curve-xs)',
                  border: '1px solid #334155',
                  background: showCurvatureComb ? '#064e3b' : 'transparent',
                  color: showCurvatureComb ? '#34d399' : '#94a3b8',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Comb: {showCurvatureComb ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* SVG Corner Comb */}
          <div
            style={{
              width: `${canvasSize}px`,
              height: `${canvasSize}px`,
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 'var(--ptv-curve-md)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <svg width={canvasSize} height={canvasSize} style={{ position: 'absolute', top: 0, left: 0 }}>
              {/* Origin Crosshairs */}
              <line x1={originOffset} y1={0} x2={originOffset} y2={canvasSize} stroke="#334155" strokeWidth="1.5" strokeDasharray="3 3" />
              <line x1={0} y1={originOffset} x2={canvasSize} y2={originOffset} stroke="#334155" strokeWidth="1.5" strokeDasharray="3 3" />

              {/* Curvature Comb Needles */}
              {showCurvatureComb &&
                comb.map((c, idx) => (
                  <line
                    key={idx}
                    x1={originOffset + c.originX * zoomScale}
                    y1={originOffset + c.originY * zoomScale}
                    x2={originOffset + (c.originX - (c.combEndX - c.originX)) * zoomScale}
                    y2={originOffset + (c.originY - (c.combEndY - c.originY)) * zoomScale}
                    stroke="#10b981"
                    strokeWidth="1.5"
                    opacity={0.8}
                  />
                ))}

              {/* The Continuous Curve (Emerald) */}
              <path
                d={(() => {
                  let d = `M ${originOffset + points[0].x * zoomScale} ${originOffset + points[0].y * zoomScale}`;
                  for (let i = 1; i < points.length; i++) {
                    d += ` L ${originOffset + points[i].x * zoomScale} ${originOffset + points[i].y * zoomScale}`;
                  }
                  return d;
                })()}
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
              />

              {/* Entry & Exit Anchor Markers */}
              <circle
                cx={originOffset + points[0].x * zoomScale}
                cy={originOffset + points[0].y * zoomScale}
                r="4.5"
                fill="#38bdf8"
              />
              <circle
                cx={originOffset + points[points.length - 1].x * zoomScale}
                cy={originOffset + points[points.length - 1].y * zoomScale}
                r="4.5"
                fill="#38bdf8"
              />
            </svg>
          </div>

          {/* Comb scale slider & Legend */}
          <div style={{ width: '100%', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              Tinggi comb menunjukkan magnitudo kelengkungan κ(t).
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '10.5px', color: '#64748b' }}>Comb Scale:</span>
              <input
                type="range"
                min="60"
                max="260"
                value={combScale}
                onChange={(e) => setCombScale(Number(e.target.value))}
                style={{ width: '80px', accentColor: '#10b981' }}
              />
            </div>
          </div>

          {/* Full Card Preview */}
          <div style={{ width: '100%', marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>Hasil Kontur Kartu Lengkap (300 × 200 px):</span>
            <div style={{ width: '300px', height: '200px', position: 'relative' }}>
              <svg width={300} height={200} style={{ position: 'absolute', top: 0, left: 0 }}>
                <path d={closedPathD} fill="#1e293b" stroke="#38bdf8" strokeWidth={1.5} />
              </svg>
              <div style={{ position: 'relative', zIndex: 2, padding: '16px', color: '#f8fafc', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>Kartu Hasil Penalaan Optik</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>R={radius}px • λ={transitionRatio.toFixed(2)} • L={(radius*(1+transitionRatio)).toFixed(1)}px</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
