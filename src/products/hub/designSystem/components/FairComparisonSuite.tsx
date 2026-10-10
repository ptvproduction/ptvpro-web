/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V2
 * Fair Comparison Suite: Strictly identical bounding box, padding,
 * surface colors, borders, shadows, content, and alignment across all 4 profiles.
 */

import React, { useState } from 'react';
import { CurveProfileId } from '../geometry/types';
import {
  PROFILE_CONFIGS,
  generateClosedPath,
  calculateProfileMetrics,
  ProfileParameters,
} from '../geometry/curveProfiles';

interface FairComparisonSuiteProps {
  nominalRadius: number;
  params: ProfileParameters;
}

export const FairComparisonSuite: React.FC<FairComparisonSuiteProps> = ({
  nominalRadius,
  params,
}) => {
  const [selectedCard, setSelectedCard] = useState<CurveProfileId | null>(null);
  const [showMetrics, setShowMetrics] = useState(true);

  // Strictly fixed dimensions for 100% fair isolation
  const cardW = 270;
  const cardH = 190;
  const cardPadding = 16;
  const cardBg = '#ffffff';
  const cardColor = '#0f172a';
  const cardShadow = 'drop-shadow(0 8px 14px rgba(15, 23, 42, 0.07)) drop-shadow(0 2px 4px rgba(15, 23, 42, 0.04))';

  const profiles: CurveProfileId[] = ['circle', 'superellipse', 'bezier', 'curvature-optimized'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Fair Comparison Benchmark
          </span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Dimensi: <b>{cardW} × {cardH} px</b> • Bounding Box, Konten, &amp; Warna 100% Identik
          </span>
        </div>
        <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
          Isolasi Murni Profil Kurva (A vs B vs C vs D)
        </h2>
        <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.55 }}>
          Untuk mengeliminasi bias psikologis desain, keempat sampel di bawah memiliki konten teks, tombol, harga, thumbnail, padding, border stroke, dan drop-shadow yang <b>sepenuhnya identik</b>.
          Perbedaan yang terlihat murni merupakan <b>kualitas geometri transisi kelengkungan sudut</b>.
        </p>
      </div>

      {/* ── Toggle bar ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setShowMetrics(!showMetrics)}
          style={{
            padding: '5px 12px',
            borderRadius: 'var(--ptv-curve-sm)',
            border: '1px solid #cbd5e1',
            background: showMetrics ? '#eff6ff' : '#ffffff',
            color: showMetrics ? '#1d4ed8' : '#64748b',
            fontSize: '11.5px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <i className="fa-solid fa-chart-simple" style={{ marginRight: '6px' }} />
          {showMetrics ? 'Sembunyikan Metrik' : 'Tampilkan Metrik Matematis'}
        </button>
      </div>

      {/* ── 4 Cards Grid ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
        }}
      >
        {profiles.map((pId) => {
          const cfg = PROFILE_CONFIGS[pId];
          const metrics = calculateProfileMetrics(nominalRadius, pId, params);
          const pathD = generateClosedPath(cardW, cardH, nominalRadius, pId, params);
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
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
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
                  transition: 'transform 0.15s ease',
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
                    <span style={{ color: '#64748b' }}>Tarif Sewa Harian:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>Rp 750.000</span>
                  </div>

                  {/* Bottom Row: Footer Action */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#10b981' }}>
                      <i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }} />
                      Siap Digunakan
                    </span>
                    <button
                      type="button"
                      style={{
                        padding: '5px 12px',
                        borderRadius: 'var(--ptv-curve-sm)',
                        border: '1px solid #0f172a',
                        background: '#0f172a',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCard(pId);
                      }}
                    >
                      Pilih Unit
                    </button>
                  </div>
                </div>
              </div>

              {/* Mathematical Metrics Card */}
              {showMetrics && (
                <div
                  style={{
                    width: `${cardW}px`,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 'var(--ptv-curve-md)',
                    padding: '10px 12px',
                    fontSize: '11px',
                    color: '#334155',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    fontFamily: 'var(--ptv-font-mono)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Transition L:</span>
                    <b>{metrics.transitionLengthX.toFixed(1)} px</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Jump Δκ @ Entry:</span>
                    <b style={{ color: metrics.entryCurvatureJump < 1e-4 ? '#059669' : '#dc2626' }}>
                      {metrics.entryCurvatureJump < 1e-4
                        ? '0 (G2 Continu)'
                        : `${metrics.entryCurvatureJump.toFixed(3)} px⁻¹`}
                    </b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Max Curvature κ:</span>
                    <b>{metrics.maxCurvature.toFixed(3)} px⁻¹</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Corner Fullness:</span>
                    <b style={{ color: metrics.fullnessVsCircle > 0 ? '#2563eb' : '#64748b' }}>
                      {metrics.fullnessVsCircle > 0
                        ? `+${metrics.fullnessVsCircle.toFixed(2)} px`
                        : `${metrics.fullnessVsCircle.toFixed(2)} px`}
                    </b>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
