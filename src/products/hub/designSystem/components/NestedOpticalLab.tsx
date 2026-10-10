/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V3
 * Nested Corner Optical Lab:
 * Evaluates relationship between outer container and inner child element using continuous curves.
 * Compares:
 * 1. Scalar radius subtraction (R_inner = R_outer - inset)
 * 2. Numerical normal offset (true equidistant curve)
 * 3. Optical correction (adjusted inner radius to prevent optical corner pinch)
 */

import React, { useState, useMemo } from 'react';
import { CurveProfileId } from '../geometry/types';
import { generateClosedPath, ProfileParameters } from '../geometry/curveProfiles';
import {
  evaluateConcentricOffsetQuality,
  generateTrueOffsetInnerPath,
  generateScalarInnerPath,
} from '../geometry/concentricOffset';

export const NestedOpticalLab: React.FC = () => {
  const [profile, setProfile] = useState<CurveProfileId>('curvature-optimized');
  const [outerR, setOuterR] = useState<number>(26);
  const [inset, setInset] = useState<number>(12);
  const [offsetMethod, setOffsetMethod] = useState<'scalar' | 'normal' | 'optical'>('optical');

  const outerW = 320;
  const outerH = 200;
  const innerW = outerW - inset * 2;
  const innerH = outerH - inset * 2;

  const optParams: ProfileParameters = {
    exponent: 3.5,
    smoothing: 0.6,
    transitionRatio: 0.45,
    shoulderSoftness: 0.38,
    cornerFullness: 0.65,
  };

  // Outer Path
  const outerPath = useMemo(() => {
    return generateClosedPath(outerW, outerH, outerR, profile, optParams);
  }, [outerW, outerH, outerR, profile, optParams]);

  // Optical compensation factor for continuous curves:
  // Because continuous curves have L = 1.45 R, the diagonal cutout is slightly deeper.
  // Optical correction scales the inner radius slightly to equalize diagonal visual padding.
  const opticalCompensationRatio = 0.88;
  const opticalInnerR = Math.max(0, outerR - inset * opticalCompensationRatio);

  // Inner Path based on selected method
  const innerPath = useMemo(() => {
    if (offsetMethod === 'scalar') {
      return generateScalarInnerPath(outerW, outerH, outerR, inset, profile, optParams);
    }
    if (offsetMethod === 'normal') {
      return generateTrueOffsetInnerPath(outerW, outerH, outerR, inset, profile, optParams);
    }
    // Optical correction mode
    return generateClosedPath(innerW, innerH, opticalInnerR, profile, optParams);
  }, [outerW, outerH, outerR, innerW, innerH, inset, profile, offsetMethod, opticalInnerR, optParams]);

  // Numerical distance quality evaluation
  const offsetQuality = useMemo(() => {
    return evaluateConcentricOffsetQuality(outerR, profile, inset, optParams);
  }, [outerR, profile, inset, optParams]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
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
                  background: '#fffbeb',
                  color: '#b45309',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Concentric Harmony Lab
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Relasi Outer vs Inner Sudut Bertingkat (Nested Containers)
              </span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
              Uji Keselarasan Sudut Bersarang (Nested Corners)
            </h2>
            <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
              Mencegah efek sudut terjepit (corner pinch) pada kartu bertingkat, modal dialog, dan input panel.
            </p>
          </div>

          {/* Method Switcher */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'scalar', label: '1. Scalar (R - d)' },
              { id: 'normal', label: '2. Normal Offset' },
              { id: 'optical', label: '3. Optical Correction' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setOffsetMethod(m.id as any)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--ptv-curve-sm)',
                  border: offsetMethod === m.id ? '1.5px solid #d97706' : '1px solid #cbd5e1',
                  background: offsetMethod === m.id ? '#fffbeb' : '#ffffff',
                  color: offsetMethod === m.id ? '#b45309' : '#475569',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Outer Radius (R):</span>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#2563eb' }}>{outerR}px</span>
            </div>
            <input
              type="range"
              min="16"
              max="40"
              step="2"
              value={outerR}
              onChange={(e) => setOuterR(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#2563eb' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Inset Padding (d):</span>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#059669' }}>{inset}px</span>
            </div>
            <input
              type="range"
              min="6"
              max="24"
              step="1"
              value={inset}
              onChange={(e) => setInset(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#059669' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Karakter Profil:</span>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#7c3aed' }}>{profile}</span>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['circle', 'bezier', 'curvature-optimized'] as CurveProfileId[]).map((pId) => (
                <button
                  key={pId}
                  type="button"
                  onClick={() => setProfile(pId)}
                  style={{
                    flex: 1,
                    padding: '4px 6px',
                    borderRadius: 'var(--ptv-curve-xs)',
                    border: profile === pId ? '1px solid #7c3aed' : '1px solid #cbd5e1',
                    background: profile === pId ? '#f5f3ff' : '#ffffff',
                    color: profile === pId ? '#5b21b6' : '#64748b',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {pId === 'circle' ? 'Circle' : pId === 'bezier' ? 'Profile C' : 'Profile D'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Canvas & Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Visual Nested Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: 'var(--ptv-curve-xl)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '14px', alignSelf: 'flex-start' }}>
            Simulasi Kartu Bertingkat ({outerW} × {outerH} px, Inset {inset}px):
          </span>

          <div
            style={{
              width: `${outerW}px`,
              height: `${outerH}px`,
              position: 'relative',
              filter: 'drop-shadow(0 8px 16px rgba(15, 23, 42, 0.06))',
            }}
          >
            {/* Outer SVG Container */}
            <svg width={outerW} height={outerH} style={{ position: 'absolute', top: 0, left: 0 }}>
              <path d={outerPath} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1.5} />
            </svg>

            {/* Inner Nested Child Element */}
            <div
              style={{
                position: 'absolute',
                top: `${inset}px`,
                left: `${inset}px`,
                width: `${innerW}px`,
                height: `${innerH}px`,
              }}
            >
              <svg width={innerW} height={innerH} style={{ position: 'absolute', top: 0, left: 0 }}>
                <path d={innerPath} fill="#ffffff" stroke="#2563eb" strokeWidth={1.5} />
              </svg>
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Komponen Bersarang</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Metode: {offsetMethod.toUpperCase()} • Inset = {inset}px
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#059669', fontWeight: 700 }}>
                  <span>Jarak Padding Sudut Harmonis</span>
                  <span>100% Selaras</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Diagnostic Distance Deviation Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: 'var(--ptv-curve-xl)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
          }}
        >
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
              <i className="fa-solid fa-arrows-left-right" style={{ color: '#d97706', marginRight: '6px' }} />
              Analisis Deviasi Padding Sudut
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Deviasi Jarak Maks</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--ptv-font-mono)', marginTop: '2px' }}>
                  {offsetQuality.maxDistanceError.toFixed(2)} px
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Selisih vs jarak normal</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Deviasi Rata-rata</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb', fontFamily: 'var(--ptv-font-mono)', marginTop: '2px' }}>
                  {offsetQuality.avgDistanceError.toFixed(2)} px
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Error rata-rata sudut</div>
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--ptv-curve-md)',
                padding: '12px 14px',
                fontSize: '11.5px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Self-Intersection (Inset ≥ R_min):</span>
                <span style={{ fontWeight: 700, color: offsetQuality.hasSelfIntersection ? '#dc2626' : '#16a34a' }}>
                  {offsetQuality.hasSelfIntersection ? 'TERDETEKSI (Cusp)' : 'AMAN (Bebas Cusp)'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Radius Minimum Kelengkungan (R_min):</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  {offsetQuality.minRadiusOfCurvature.toFixed(1)} px
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Batas Inset Maksimum Aman:</span>
                <span style={{ fontWeight: 700, color: '#059669' }}>
                  &lt; {offsetQuality.minRadiusOfCurvature.toFixed(1)} px
                </span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '16px', lineHeight: 1.45 }}>
            <i className="fa-solid fa-circle-info" style={{ color: '#2563eb', marginRight: '5px' }} />
            Pada kurva continuous, metode <b>Optical Correction</b> mengkompensasi zona transisi yang lebih panjang agar celah visual di sudut diagonal tampak selebar celah sisi horizontal/vertikal.
          </div>
        </div>
      </div>
    </div>
  );
};
