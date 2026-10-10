/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V3
 * Surface Treatment Lab:
 * Separates pure geometry evaluation from surface styling.
 * 3 Modes:
 * 1. Geometry Only: Solid silhouette, no border, no shadow.
 * 2. Soft Surface: Subtle surface contrast, ultra-thin 0.75px border, organic multi-tiered ambient shadow.
 * 3. Technical Outline: High-contrast stroke on technical grid for pure contour inspection.
 */

import React, { useState } from 'react';
import { CurveProfileId, SurfaceMode } from '../geometry/types';
import { generateClosedPath, ProfileParameters } from '../geometry/curveProfiles';

export const SurfaceTreatmentLab: React.FC = () => {
  const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>('soft-surface');
  const [candidateProfile, setCandidateProfile] = useState<CurveProfileId>('curvature-optimized');
  const [radius, setRadius] = useState<number>(24);

  const compW = 320;
  const compH = 200;

  const optParams: ProfileParameters = {
    exponent: 3.5,
    smoothing: 0.6,
    transitionRatio: 0.45,
    shoulderSoftness: 0.38,
    cornerFullness: 0.65,
  };

  const basePath = generateClosedPath(compW, compH, radius, 'circle');
  const candPath = generateClosedPath(compW, compH, radius, candidateProfile, optParams);

  // Surface treatment styles
  let cardFill = '#ffffff';
  let cardStroke = '#cbd5e1';
  let cardStrokeWidth = 1.5;
  let cardShadow = 'none';
  let containerBg = '#f8fafc';
  let textColor = '#0f172a';

  if (surfaceMode === 'geometry-only') {
    cardFill = '#0f172a';
    cardStroke = 'none';
    cardStrokeWidth = 0;
    cardShadow = 'none';
    containerBg = '#f1f5f9';
    textColor = '#ffffff';
  } else if (surfaceMode === 'soft-surface') {
    cardFill = '#ffffff';
    cardStroke = 'rgba(226, 232, 240, 0.85)';
    cardStrokeWidth = 0.75;
    cardShadow = 'drop-shadow(0 10px 22px rgba(15, 23, 42, 0.06)) drop-shadow(0 2px 5px rgba(15, 23, 42, 0.03))';
    containerBg = '#f8fafc';
    textColor = '#0f172a';
  } else if (surfaceMode === 'technical-outline') {
    cardFill = 'transparent';
    cardStroke = '#2563eb';
    cardStrokeWidth = 2;
    cardShadow = 'none';
    containerBg = '#090d16';
    textColor = '#f8fafc';
  }

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
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Surface Isolation Lab
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Memisahkan Kualitas Geometri Murni dari Efek Rendering Permukaan
              </span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
              Uji Perlakuan Permukaan (Surface Treatment)
            </h2>
            <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
              Memastikan border mengikuti kontur SVG aktual (bukan circular CSS outline) dan tidak terdistorsi oleh dekorasi berlebih.
            </p>
          </div>

          {/* Controls: Radius & Candidate & Mode Switcher */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>R:</span>
              <input
                type="range"
                min="16"
                max="36"
                step="2"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                style={{ width: '80px', accentColor: '#2563eb' }}
              />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb' }}>{radius}px</span>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setCandidateProfile('curvature-optimized')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--ptv-curve-xs)',
                  border: candidateProfile === 'curvature-optimized' ? '1.5px solid #059669' : '1px solid #cbd5e1',
                  background: candidateProfile === 'curvature-optimized' ? '#ecfdf5' : '#ffffff',
                  color: candidateProfile === 'curvature-optimized' ? '#065f46' : '#64748b',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Profile D
              </button>
              <button
                type="button"
                onClick={() => setCandidateProfile('bezier')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--ptv-curve-xs)',
                  border: candidateProfile === 'bezier' ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                  background: candidateProfile === 'bezier' ? '#f5f3ff' : '#ffffff',
                  color: candidateProfile === 'bezier' ? '#5b21b6' : '#64748b',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Profile C
              </button>
            </div>

            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: 'var(--ptv-curve-md)' }}>
              {(['geometry-only', 'soft-surface', 'technical-outline'] as SurfaceMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSurfaceMode(m)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--ptv-curve-xs)',
                    border: surfaceMode === m ? '1px solid #0f172a' : 'none',
                    background: surfaceMode === m ? '#ffffff' : 'transparent',
                    color: surfaceMode === m ? '#0f172a' : '#64748b',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: surfaceMode === m ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  {m === 'geometry-only'
                    ? 'Geometry'
                    : m === 'soft-surface'
                    ? 'Soft Surface'
                    : 'Outline'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Surface Preview Canvas */}
      <div
        style={{
          background: containerBg,
          border: '1.5px solid #e2e8f0',
          borderRadius: 'var(--ptv-curve-xl)',
          padding: '36px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '36px',
          flexWrap: 'wrap',
          transition: 'background 0.2s ease',
        }}
      >
        {/* Profile A Sample */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: surfaceMode === 'technical-outline' ? '#94a3b8' : '#64748b' }}>
            Profile A: Circular Baseline (R={radius}px)
          </span>
          <div
            style={{
              width: `${compW}px`,
              height: `${compH}px`,
              position: 'relative',
              filter: cardShadow,
            }}
          >
            <svg width={compW} height={compH} style={{ position: 'absolute', top: 0, left: 0 }}>
              <path
                d={basePath}
                fill={cardFill}
                stroke={surfaceMode === 'technical-outline' ? '#f59e0b' : cardStroke}
                strokeWidth={cardStrokeWidth}
              />
            </svg>
            <div
              style={{
                width: `${compW}px`,
                height: `${compH}px`,
                padding: '20px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                color: textColor,
                position: 'relative',
                zIndex: 2,
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>Profile A (Circle)</div>
                <div style={{ fontSize: '11px', opacity: 0.7 }}>Diskontinuitas Curvature G1</div>
              </div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>Tepi melingkar standar</div>
            </div>
          </div>
        </div>

        {/* Candidate Sample */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: surfaceMode === 'technical-outline' ? '#38bdf8' : '#059669' }}>
            {candidateProfile === 'curvature-optimized' ? 'Profile D (G2 Quintic)' : 'Profile C (Bézier)'}
          </span>
          <div
            style={{
              width: `${compW}px`,
              height: `${compH}px`,
              position: 'relative',
              filter: cardShadow,
            }}
          >
            <svg width={compW} height={compH} style={{ position: 'absolute', top: 0, left: 0 }}>
              <path
                d={candPath}
                fill={cardFill}
                stroke={surfaceMode === 'technical-outline' ? '#06b6d4' : cardStroke}
                strokeWidth={cardStrokeWidth}
              />
            </svg>
            <div
              style={{
                width: `${compW}px`,
                height: `${compH}px`,
                padding: '20px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                color: textColor,
                position: 'relative',
                zIndex: 2,
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>
                  {candidateProfile === 'curvature-optimized' ? 'Profile D (Continuous)' : 'Profile C'}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.7 }}>Kontinuitas Curvature G2 Sejati</div>
              </div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>Transisi kelengkungan organik</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
