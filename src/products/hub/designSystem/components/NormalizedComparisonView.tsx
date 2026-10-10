/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V3
 * Normalized Curve Comparison Suite:
 * Benchmark comparing Profile A (fixed baseline) against Profiles B, C, D across
 * 4 normalization strategies:
 * 1. Equal Nominal Radius (R_test = R_A)
 * 2. Equal Corner Transition Length (L_test = L_A)
 * 3. Equal Diagonal Cutout Depth (d_diag,test = d_diag,A)
 * 4. Equal Corner Cutout Area (A_cut,test = A_cut,A)
 */

import React, { useState } from 'react';
import { CurveProfileId, NormalizationMethod } from '../geometry/types';
import {
  PROFILE_CONFIGS,
  generateClosedPath,
  ProfileParameters,
} from '../geometry/curveProfiles';
import { normalizeProfileRadius } from '../geometry/curveNormalization';

export const NormalizedComparisonView: React.FC = () => {
  const [normMethod, setNormMethod] = useState<NormalizationMethod>('equal-diagonal');
  const [nominalRadius, setNominalRadius] = useState<number>(24);
  const [selectedCard, setSelectedCard] = useState<CurveProfileId | null>(null);

  const cardW = 270;
  const cardH = 190;
  const cardPadding = 16;
  const cardBg = '#ffffff';
  const cardColor = '#0f172a';
  const cardShadow = 'drop-shadow(0 8px 14px rgba(15, 23, 42, 0.07)) drop-shadow(0 2px 4px rgba(15, 23, 42, 0.04))';

  const profiles: CurveProfileId[] = ['circle', 'superellipse', 'bezier', 'curvature-optimized'];

  const optParams: ProfileParameters = {
    exponent: 3.5,
    smoothing: 0.6,
    transitionRatio: 0.45,
    shoulderSoftness: 0.38,
    cornerFullness: 0.65,
  };

  const methodExplanations: Record<NormalizationMethod, { title: string; desc: string; limitations: string }> = {
    'equal-radius': {
      title: '1. Equal Nominal Radius (R_test = R_A)',
      desc: 'Radius nominal R disamakan untuk semua kurva (default CSS border-radius).',
      limitations:
        'Kelemahan: Transition length (L) dan kedalaman potongan diagonal (d_diag) berbeda-beda. Profile D memiliki L = 1.45R sehingga terlihat sedikit lebih besar/penuh, sementara Profile B memiliki bahu lebih kotak. Perbedaan optik bercampur dengan efek ukuran.',
    },
    'equal-transition': {
      title: '2. Equal Corner Transition Length (L_test = L_A = R_A)',
      desc: 'Panjang zona transisi di tepi lurus disamakan persis dengan R lingkaran (L = R_A).',
      limitations:
        'Kelemahan: Radius kelengkungan di puncak diagonal menjadi jauh lebih kecil daripada lingkaran, membuat sudut tampak lebih tajam/sempit di titik belok (pinched shoulder).',
    },
    'equal-diagonal': {
      title: '3. Equal Diagonal Cutout Depth (d_diag,test = d_diag,A) — (Direkomendasikan)',
      desc: 'Kedalaman sudut yang terpotong sepanjang sinar 45° disamakan secara persis.',
      limitations:
        'Kekuatan: Mengisolasi perbedaan kualitas kelengkungan murni! Sudut memotong material pada kedalaman yang identik, sehingga mata murni melihat kelembutan transisi bahu (shoulder fullness) tanpa bias ukuran sudut.',
    },
    'equal-area': {
      title: '4. Equal Corner Cutout Area (A_cut,test = A_cut,A)',
      desc: 'Luas area yang dipotong dari kotak sudut tajam [0, L] × [0, L] disamakan persis.',
      limitations:
        'Kelemahan: Memerlukan integrasi numerik trapesium. Meskipun konservatif terhadap luas, distribusi kelengkungan di sudut tetap bervariasi.',
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Method Selector & Explanation Header ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: 'var(--ptv-curve-xl)',
          padding: '20px 24px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 'var(--ptv-curve-pill)',
                  background: '#ecfdf5',
                  color: '#065f46',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Normalized Benchmark
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Dimensi: <b>{cardW} × {cardH} px</b> • Baseline Profile A (Circle) Tetap
              </span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
              Perbandingan Kurva Ternormalisasi (A vs B vs C vs D)
            </h2>
          </div>

          {/* Nominal Radius Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Radius Acuan:</span>
            <input
              type="range"
              min="14"
              max="36"
              step="2"
              value={nominalRadius}
              onChange={(e) => setNominalRadius(Number(e.target.value))}
              style={{ width: '100px', accentColor: '#2563eb' }}
            />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', fontFamily: 'var(--ptv-font-mono)' }}>
              {nominalRadius}px
            </span>
          </div>
        </div>

        {/* 4 Normalization Strategy Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {(['equal-radius', 'equal-transition', 'equal-diagonal', 'equal-area'] as NormalizationMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setNormMethod(m)}
              style={{
                flex: 1,
                minWidth: '150px',
                padding: '8px 12px',
                borderRadius: 'var(--ptv-curve-sm)',
                border: normMethod === m ? '1.5px solid #059669' : '1px solid #cbd5e1',
                background: normMethod === m ? '#ecfdf5' : '#ffffff',
                color: normMethod === m ? '#065f46' : '#475569',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {m === 'equal-radius'
                ? '1. Equal Radius'
                : m === 'equal-transition'
                ? '2. Equal Transition L'
                : m === 'equal-diagonal'
                ? '3. Equal Diagonal (Rekomendasi)'
                : '4. Equal Area'}
            </button>
          ))}
        </div>

        {/* Explanation Alert */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 'var(--ptv-curve-md)',
            padding: '12px 16px',
            fontSize: '12px',
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
            {methodExplanations[normMethod].title}
          </div>
          <div style={{ color: '#475569', marginBottom: '6px' }}>{methodExplanations[normMethod].desc}</div>
          <div style={{ color: '#b45309', fontSize: '11.5px' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }} />
            {methodExplanations[normMethod].limitations}
          </div>
        </div>
      </div>

      {/* ── 4 Benchmark Cards Grid ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
        }}
      >
        {profiles.map((pId) => {
          const cfg = PROFILE_CONFIGS[pId];
          const normResult = normalizeProfileRadius(nominalRadius, pId, normMethod, optParams);
          const effectiveParams: ProfileParameters = {
            ...optParams,
            opticalRadiusScale: normResult.scaleFactorVsNominal,
          };
          const pathD = generateClosedPath(cardW, cardH, nominalRadius, pId, effectiveParams);
          const isSelected = selectedCard === pId;

          const badgeColor =
            pId === 'circle'
              ? '#2563eb'
              : pId === 'superellipse'
              ? '#d97706'
              : pId === 'bezier'
              ? '#7c3aed'
              : '#059669';

          const badgeBg =
            pId === 'circle'
              ? '#eff6ff'
              : pId === 'superellipse'
              ? '#fffbeb'
              : pId === 'bezier'
              ? '#f5f3ff'
              : '#ecfdf5';

          return (
            <div
              key={pId}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {/* Header Label */}
              <div style={{ textAlign: 'center', minHeight: '44px' }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: 'var(--ptv-curve-pill)',
                    background: badgeBg,
                    color: badgeColor,
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {cfg.shortName}
                </span>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  Kontinuitas: <b>{cfg.continuityClass}</b> • {cfg.tagline}
                </div>
              </div>

              {/* The Fair Card Container */}
              <div
                style={{
                  width: `${cardW}px`,
                  height: `${cardH}px`,
                  position: 'relative',
                  filter: cardShadow,
                  outline: isSelected ? `2px solid ${badgeColor}` : undefined,
                  outlineOffset: '4px',
                  borderRadius: isSelected ? 'var(--ptv-curve-md)' : undefined,
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedCard(isSelected ? null : pId)}
              >
                {/* SVG Background Layer */}
                <svg
                  width={cardW}
                  height={cardH}
                  style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                >
                  <path
                    d={pathD}
                    fill={cardBg}
                    stroke={isSelected ? badgeColor : '#cbd5e1'}
                    strokeWidth={isSelected ? 2 : 1.5}
                  />
                </svg>

                {/* Foreground Clipped Content */}
                <div
                  style={{
                    width: `${cardW}px`,
                    height: `${cardH}px`,
                    padding: `${cardPadding}px`,
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    color: cardColor,
                    position: 'relative',
                    zIndex: 2,
                  }}
                >
                  {/* Card Top Row: Device Name & Status */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                        Sony FX3 Cinema
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 7px',
                          borderRadius: 'var(--ptv-curve-pill)',
                          background: '#f1f5f9',
                          color: '#475569',
                          fontWeight: 700,
                        }}
                      >
                        Unit #01
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Full-Frame 4K 120p • E-Mount
                    </div>
                  </div>

                  {/* Mid Row: Spec Mini-Panel */}
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 'var(--ptv-curve-sm)',
                      padding: '7px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                    }}
                  >
                    <div>
                      <span style={{ color: '#64748b' }}>Tarif: </span>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>Rp 450k/hari</span>
                    </div>
                    <div style={{ color: '#16a34a', fontWeight: 700 }}>
                      <i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }} />
                      Tersedia
                    </div>
                  </div>

                  {/* Bottom Row: CTA Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>Lab V3 Benchmark</span>
                    <button
                      type="button"
                      style={{
                        padding: '5px 12px',
                        borderRadius: 'var(--ptv-curve-sm)',
                        background: '#0f172a',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Pilih Unit
                    </button>
                  </div>
                </div>
              </div>

              {/* Normalized Metrics Badge */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--ptv-curve-md)',
                  padding: '8px 12px',
                  width: '100%',
                  maxWidth: `${cardW}px`,
                  fontSize: '10.5px',
                  color: '#475569',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>R_efektif:</span>
                  <b style={{ color: '#0f172a' }}>{normResult.effectiveRadius.toFixed(1)} px ({normResult.scaleFactorVsNominal.toFixed(2)}×)</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Transition (L):</span>
                  <b style={{ color: '#0f172a' }}>{normResult.effectiveTransitionLength.toFixed(1)} px</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Diagonal Cut (d):</span>
                  <b style={{ color: '#0f172a' }}>{normResult.diagonalCutoutDepth.toFixed(2)} px</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cutout Area:</span>
                  <b style={{ color: '#0f172a' }}>{normResult.cornerCutoutArea.toFixed(1)} px²</b>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
