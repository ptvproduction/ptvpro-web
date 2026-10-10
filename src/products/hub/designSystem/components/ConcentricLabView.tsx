/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V2
 * ConcentricLabView: Outer and inner container geometry experiments,
 * True numerical normal offset vs. Naive scalar R_inner = R_outer - inset,
 * multi-angle distance consistency, extreme aspect ratio stress testing,
 * and self-intersection / cusp detection.
 */

import React, { useState } from 'react';
import { CurveProfileId } from '../geometry/types';
import {
  PROFILE_CONFIGS,
  generateClosedPath,
  calculateProfileMetrics,
  ProfileParameters,
} from '../geometry/curveProfiles';
import {
  evaluateConcentricOffsetQuality,
  generateScalarInnerPath,
  generateTrueOffsetInnerPath,
} from '../geometry/concentricOffset';

export const ConcentricLabView: React.FC = () => {
  const baseW = 360;
  const baseH = 240;
  const [activeProfile, setActiveProfile] = useState<CurveProfileId>('curvature-optimized');
  const [outerR, setOuterR] = useState<number>(26);
  const [insetPadding, setInsetPadding] = useState<number>(14);
  const [aspectPreset, setAspectPreset] = useState<'standard' | 'extreme-wide' | 'extreme-tall'>('standard');
  const [offsetMode, setOffsetMode] = useState<'compare' | 'true-normal' | 'scalar'>('compare');

  // Adjust dimensions based on preset
  let effectiveW = baseW;
  let effectiveH = baseH;
  if (aspectPreset === 'extreme-wide') {
    effectiveW = 460;
    effectiveH = 76;
  } else if (aspectPreset === 'extreme-tall') {
    effectiveW = 110;
    effectiveH = 340;
  }

  const params: ProfileParameters = {
    exponent: 3.5,
    smoothing: 0.6,
    transitionRatio: 0.45,
  };

  // Live evaluation of offset quality
  const offsetAnalysis = evaluateConcentricOffsetQuality(outerR, activeProfile, insetPadding, params);
  const metrics = calculateProfileMetrics(outerR, activeProfile, params);

  // SVG Paths
  const outerPath = generateClosedPath(effectiveW, effectiveH, outerR, activeProfile, params);
  const scalarInnerPath = generateScalarInnerPath(effectiveW, effectiveH, outerR, insetPadding, activeProfile, params);
  const trueNormalInnerPath = generateTrueOffsetInnerPath(effectiveW, effectiveH, outerR, insetPadding, activeProfile, params);

  const innerW = Math.max(0, effectiveW - insetPadding * 2);
  const innerH = Math.max(0, effectiveH - insetPadding * 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ── Explanation Header ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: 'var(--ptv-curve-xl)',
          padding: '20px 24px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--ptv-curve-pill)',
              background: '#fef3c7',
              color: '#92400e',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Concentric Geometry Laboratory
          </span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            R_min Kelengkungan: <b>{metrics.minRadiusOfCurvature.toFixed(1)}px</b> • Inset: <b>{insetPadding}px</b>
          </span>
        </div>
        <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
          Geometri Sudut Konsentris: Normal Offset vs Skalar Pengurangan
        </h2>
        <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.55 }}>
          Rumus klasik <code>R_inner = R_outer - inset</code> hanya berlaku mutlak untuk busur lingkaran murni.
          Pada kurva kontinu (superellipse / Bézier), evolute kurva bukan titik tunggal melainkan astroid, sehingga kontur dalam yang benar-benar berjarak seragam membutuhkan <b>Normal Offset</b> numerik.
        </p>
      </div>

      {/* ── Warning Alert if Inset Exceeds Min Radius of Curvature ── */}
      {offsetAnalysis.hasSelfIntersection && (
        <div
          style={{
            background: '#fef2f2',
            border: '1.5px solid #fecaca',
            borderRadius: 'var(--ptv-curve-lg)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <i className="fa-solid fa-triangle-exclamation" style={{ color: '#dc2626', fontSize: '18px' }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#991b1b' }}>
              Peringatan Geometri: Potensi Self-Intersection (Cusp / Swallowtail Singularity)
            </div>
            <div style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '2px' }}>
              Nilai inset ({insetPadding}px) melampaui jari-jari kelengkungan minimum R_min ({metrics.minRadiusOfCurvature.toFixed(1)}px). Vektor normal saling bersilangan di area sudut dalam.
            </div>
          </div>
        </div>
      )}

      {/* ── Controls Toolbar ── */}
      <div
        style={{
          background: '#f8fafc',
          border: '1.5px solid #e2e8f0',
          borderRadius: 'var(--ptv-curve-xl)',
          padding: '18px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Profile Selector */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
            Profil Kurva
          </label>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {(['circle', 'superellipse', 'bezier', 'curvature-optimized'] as const).map((pId) => (
              <button
                key={pId}
                type="button"
                onClick={() => setActiveProfile(pId)}
                style={{
                  padding: '3px 8px',
                  borderRadius: 'var(--ptv-curve-xs)',
                  border: activeProfile === pId ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                  background: activeProfile === pId ? '#0f172a' : '#ffffff',
                  color: activeProfile === pId ? '#ffffff' : '#334155',
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

        {/* Outer Radius Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Outer Radius (R_outer)</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', fontFamily: 'var(--ptv-font-mono)' }}>
              {outerR}px
            </span>
          </div>
          <input
            type="range"
            min="8"
            max="44"
            step="2"
            value={outerR}
            onChange={(e) => setOuterR(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#2563eb' }}
          />
        </div>

        {/* Inset Padding Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Inset Padding (d)</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#d97706', fontFamily: 'var(--ptv-font-mono)' }}>
              {insetPadding}px
            </span>
          </div>
          <input
            type="range"
            min="4"
            max="28"
            step="2"
            value={insetPadding}
            onChange={(e) => setInsetPadding(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#d97706' }}
          />
        </div>

        {/* Aspect Ratio Stress Test */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
            Aspect Ratio Stress Test
          </label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(
              [
                { id: 'standard', label: 'Standar' },
                { id: 'extreme-wide', label: 'Wide Bar' },
                { id: 'extreme-tall', label: 'Tall Col' },
              ] as const
            ).map((ap) => (
              <button
                key={ap.id}
                type="button"
                onClick={() => setAspectPreset(ap.id)}
                style={{
                  flex: 1,
                  padding: '4px',
                  borderRadius: 'var(--ptv-curve-xs)',
                  border: aspectPreset === ap.id ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                  background: aspectPreset === ap.id ? '#eff6ff' : '#ffffff',
                  color: aspectPreset === ap.id ? '#1d4ed8' : '#475569',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {ap.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Visual Comparison Canvas ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: 'var(--ptv-curve-xl)',
          padding: '30px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          overflowX: 'auto',
        }}
      >
        {/* Submode Selector */}
        <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '3px', borderRadius: 'var(--ptv-curve-md)' }}>
          <button
            type="button"
            onClick={() => setOffsetMode('compare')}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--ptv-curve-xs)',
              border: offsetMode === 'compare' ? '1px solid #0f172a' : 'none',
              background: offsetMode === 'compare' ? '#0f172a' : 'transparent',
              color: offsetMode === 'compare' ? '#ffffff' : '#475569',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Overlay: Normal (Hijau) vs Skalar (Merah)
          </button>
          <button
            type="button"
            onClick={() => setOffsetMode('true-normal')}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--ptv-curve-xs)',
              border: offsetMode === 'true-normal' ? '1px solid #0f172a' : 'none',
              background: offsetMode === 'true-normal' ? '#0f172a' : 'transparent',
              color: offsetMode === 'true-normal' ? '#ffffff' : '#475569',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Hanya True Normal Offset
          </button>
          <button
            type="button"
            onClick={() => setOffsetMode('scalar')}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--ptv-curve-xs)',
              border: offsetMode === 'scalar' ? '1px solid #0f172a' : 'none',
              background: offsetMode === 'scalar' ? '#0f172a' : 'transparent',
              color: offsetMode === 'scalar' ? '#ffffff' : '#475569',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Hanya Naive Skalar (R - d)
          </button>
        </div>

        {/* Outer + Inner Container SVG */}
        <div
          style={{
            width: `${effectiveW}px`,
            height: `${effectiveH}px`,
            position: 'relative',
            filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.06))',
          }}
        >
          {/* Outer Container SVG */}
          <svg width={effectiveW} height={effectiveH} style={{ position: 'absolute', top: 0, left: 0 }}>
            <path d={outerPath} fill="#f8fafc" stroke="#334155" strokeWidth={2} />
          </svg>

          {/* Inner Container Placed with Padding */}
          <div
            style={{
              position: 'absolute',
              top: `${insetPadding}px`,
              left: `${insetPadding}px`,
              width: `${innerW}px`,
              height: `${innerH}px`,
            }}
          >
            <svg width={innerW} height={innerH} style={{ position: 'absolute', top: 0, left: 0 }}>
              {/* True Normal Offset Curve (Green) */}
              {(offsetMode === 'compare' || offsetMode === 'true-normal') && (
                <path d={trueNormalInnerPath} fill="none" stroke="#10b981" strokeWidth={2} />
              )}
              {/* Naive Scalar Offset Curve (Red dashed) */}
              {(offsetMode === 'compare' || offsetMode === 'scalar') && (
                <path
                  d={scalarInnerPath}
                  fill={offsetMode === 'scalar' ? '#ffffff' : 'none'}
                  stroke="#ef4444"
                  strokeWidth={1.8}
                  strokeDasharray={offsetMode === 'compare' ? '4 3' : undefined}
                />
              )}
            </svg>

            {/* Inner child label */}
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#334155',
                fontSize: '11px',
                fontWeight: 700,
                textAlign: 'center',
                padding: '10px',
                boxSizing: 'border-box',
              }}
            >
              <div>
                <div>Inner Container Surface</div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
                  Inset = {insetPadding}px • {innerW}×{innerH}px
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Multi-Angle Radial Ray Distance Table ── */}
        <div style={{ width: '100%', maxWidth: '680px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
            <i className="fa-solid fa-ruler-combined" style={{ color: '#2563eb', marginRight: '6px' }} />
            Tabel Evaluasi Jarak Antar-Kontur Sepanjang Sudut Radial (0° s.d. 90°)
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-md)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'center' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '8px' }}>Sudut Ray</th>
                  <th style={{ padding: '8px', color: '#059669' }}>Normal Distance Ideal</th>
                  <th style={{ padding: '8px', color: '#dc2626' }}>Scalar Gap (R_in = R_out - d)</th>
                  <th style={{ padding: '8px' }}>Penyimpangan Padding (Error)</th>
                  <th style={{ padding: '8px' }}>Status Visual</th>
                </tr>
              </thead>
              <tbody>
                {offsetAnalysis.evaluations.map((ev) => (
                  <tr key={ev.angleDeg} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px', fontWeight: 700 }}>{ev.angleDeg}°</td>
                    <td style={{ padding: '8px', color: '#059669', fontWeight: 700, fontFamily: 'var(--ptv-font-mono)' }}>
                      {ev.normalDistance.toFixed(2)} px
                    </td>
                    <td style={{ padding: '8px', color: '#dc2626', fontFamily: 'var(--ptv-font-mono)' }}>
                      {ev.scalarDistance.toFixed(2)} px
                    </td>
                    <td style={{ padding: '8px', fontWeight: 700, fontFamily: 'var(--ptv-font-mono)', color: ev.distanceError > 1.5 ? '#b91c1c' : '#334155' }}>
                      {ev.distanceError.toFixed(2)} px
                    </td>
                    <td style={{ padding: '8px' }}>
                      {ev.distanceError < 0.5 ? (
                        <span style={{ color: '#16a34a', fontWeight: 700 }}>Konsentris Sempurna</span>
                      ) : ev.distanceError < 2.0 ? (
                        <span style={{ color: '#d97706', fontWeight: 700 }}>Penyimpangan Ringan</span>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: 700 }}>Optical Pinching</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', lineHeight: 1.5 }}>
            Rata-rata deviasi jarak: <b>{offsetAnalysis.avgDistanceError.toFixed(2)}px</b> • Maksimum deviasi: <b>{offsetAnalysis.maxDistanceError.toFixed(2)}px</b> pada area bahu diagonal.
          </div>
        </div>
      </div>
    </div>
  );
};
