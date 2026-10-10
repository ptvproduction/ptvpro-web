/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V3
 * Real UI Scale Test Gallery:
 * Evaluates Profile A vs Candidate Continuous Curve side-by-side across 6 real component scales:
 * 1. Small button: 100 × 36 px (R = 8px)
 * 2. Input: 260 × 42 px (R = 10px)
 * 3. Navigation item: 200 × 44 px (R = 10px)
 * 4. Small card: 240 × 140 px (R = 16px)
 * 5. Standard card: 320 × 200 px (R = 22px)
 * 6. Large panel: 600 × 360 px (R = 28px)
 */

import React, { useState } from 'react';
import { CurveProfileId, NormalizationMethod } from '../geometry/types';
import { generateClosedPath, ProfileParameters } from '../geometry/curveProfiles';
import { normalizeProfileRadius } from '../geometry/curveNormalization';

export const RealUIScaleGallery: React.FC = () => {
  const [candidateProfile, setCandidateProfile] = useState<CurveProfileId>('curvature-optimized');
  const [normMethod, setNormMethod] = useState<NormalizationMethod>('equal-diagonal');

  const optParams: ProfileParameters = {
    exponent: 3.5,
    smoothing: 0.6,
    transitionRatio: 0.45,
    shoulderSoftness: 0.38,
    cornerFullness: 0.65,
  };

  const specimens = [
    {
      id: 'button',
      name: 'Small Button',
      w: 100,
      h: 36,
      nominalR: 8,
      category: 'Tindakan Kompak',
      renderContent: () => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '6px' }}>
          <i className="fa-solid fa-plus" style={{ fontSize: '11px', color: '#ffffff' }} />
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#ffffff' }}>Pinjam</span>
        </div>
      ),
      bgFill: '#2563eb',
      strokeColor: '#1d4ed8',
    },
    {
      id: 'input',
      name: 'Input Field',
      w: 260,
      h: 42,
      nominalR: 10,
      category: 'Form Kontrol',
      renderContent: () => (
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 12px', gap: '8px' }}>
          <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '12px', color: '#94a3b8' }} />
          <span style={{ fontSize: '12px', color: '#64748b' }}>Cari inventaris kamera...</span>
        </div>
      ),
      bgFill: '#ffffff',
      strokeColor: '#cbd5e1',
    },
    {
      id: 'nav',
      name: 'Navigation Item',
      w: 200,
      h: 44,
      nominalR: 10,
      category: 'Navigasi Shell',
      renderContent: () => (
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 14px', gap: '10px' }}>
          <i className="fa-solid fa-boxes-stacked" style={{ fontSize: '13px', color: '#2563eb' }} />
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>Inventaris Alat</span>
        </div>
      ),
      bgFill: '#eff6ff',
      strokeColor: '#bfdbfe',
    },
    {
      id: 'small-card',
      name: 'Small Card',
      w: 240,
      h: 140,
      nominalR: 16,
      category: 'Kartu Ringkas',
      renderContent: () => (
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
          <div>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '2px 6px', borderRadius: 'var(--ptv-curve-xs)' }}>
              AUDIO
            </span>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>Rode Wireless GO II</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Dual Channel Mic</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Rp 120k/hari</span>
            <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: 700 }}>Ready</span>
          </div>
        </div>
      ),
      bgFill: '#ffffff',
      strokeColor: '#e2e8f0',
    },
    {
      id: 'standard-card',
      name: 'Standard Card',
      w: 320,
      h: 200,
      nominalR: 22,
      category: 'Kartu Inventaris Standar',
      renderContent: () => (
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Sony FX3 Cinema</span>
              <span style={{ fontSize: '10.5px', fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 'var(--ptv-curve-pill)' }}>
                Unit #01
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>Full-Frame 4K 120p Cinema Line</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 'var(--ptv-curve-sm)', border: '1px solid #e2e8f0', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Tarif Sewa:</span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>Rp 450.000 / hari</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
              <i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }} />
              Tersedia untuk dipinjam
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb' }}>Detail →</span>
          </div>
        </div>
      ),
      bgFill: '#ffffff',
      strokeColor: '#cbd5e1',
    },
    {
      id: 'large-panel',
      name: 'Large Panel',
      w: 600,
      h: 360,
      nominalR: 28,
      category: 'Panel Modal / Dashboard View',
      renderContent: () => (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
                  Panel Dialog Transaksi
                </span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>Formulir Peminjaman Unit Kamera</div>
              </div>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>ID: LOAN-2026-X01</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginTop: '16px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--ptv-curve-sm)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Peminjam</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>Zidna Rahman</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--ptv-curve-sm)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Durasi</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>3 Hari Kerja</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--ptv-curve-sm)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Deposit</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>Rp 500.000</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <span style={{ fontSize: '11.5px', color: '#64748b', alignSelf: 'center' }}>Batas waktu konfirmasi: 24 jam</span>
          </div>
        </div>
      ),
      bgFill: '#ffffff',
      strokeColor: '#cbd5e1',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Controls */}
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
                Real UI Component Matrix
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Pengujian Skala Nyata: Tombol (36px) s/d Panel Modal (360px)
              </span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
              Perbandingan Berdampingan pada Skala UI Aktual
            </h2>
            <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
              Radius disesuaikan secara proporsional sesuai peruntukan komponen. Tidak memaksa radius besar pada tombol kecil.
            </p>
          </div>

          {/* Normalization & Candidate Switcher */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['equal-diagonal', 'equal-radius', 'equal-transition'] as NormalizationMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setNormMethod(m)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--ptv-curve-xs)',
                    border: normMethod === m ? '1.5px solid #059669' : '1px solid #cbd5e1',
                    background: normMethod === m ? '#ecfdf5' : '#ffffff',
                    color: normMethod === m ? '#065f46' : '#64748b',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {m === 'equal-diagonal' ? 'Equal Diag' : m === 'equal-radius' ? 'Equal R' : 'Equal L'}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setCandidateProfile('curvature-optimized')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--ptv-curve-sm)',
                  border: candidateProfile === 'curvature-optimized' ? '1.5px solid #059669' : '1px solid #cbd5e1',
                  background: candidateProfile === 'curvature-optimized' ? '#ecfdf5' : '#ffffff',
                  color: candidateProfile === 'curvature-optimized' ? '#065f46' : '#475569',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Kandidat: Profile D (G2)
              </button>
              <button
                type="button"
                onClick={() => setCandidateProfile('bezier')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--ptv-curve-sm)',
                  border: candidateProfile === 'bezier' ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                  background: candidateProfile === 'bezier' ? '#f5f3ff' : '#ffffff',
                  color: candidateProfile === 'bezier' ? '#5b21b6' : '#475569',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Kandidat: Profile C (Bézier)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Specimens List ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {specimens.map((item) => {
          const normResult = normalizeProfileRadius(item.nominalR, candidateProfile, normMethod, optParams);
          const effectiveParams: ProfileParameters = {
            ...optParams,
            opticalRadiusScale: normResult.scaleFactorVsNominal,
          };

          const basePath = generateClosedPath(item.w, item.h, item.nominalR, 'circle');
          const candPath = generateClosedPath(item.w, item.h, item.nominalR, candidateProfile, effectiveParams);

          return (
            <div
              key={item.id}
              style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: 'var(--ptv-curve-xl)',
                padding: '20px 24px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{item.name}</span>
                    <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 'var(--ptv-curve-xs)' }}>
                      {item.w} × {item.h} px • R={item.nominalR}px
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>{item.category}</div>
                </div>

                <div style={{ fontSize: '11px', color: '#475569' }}>
                  R_eff Kandidat: <b>{normResult.effectiveRadius.toFixed(1)}px</b> • Transition L: <b>{normResult.effectiveTransitionLength.toFixed(1)}px</b>
                </div>
              </div>

              {/* Side-by-side rendering row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  flexWrap: 'wrap',
                  background: '#f8fafc',
                  padding: '20px',
                  borderRadius: 'var(--ptv-curve-md)',
                  border: '1px solid #e2e8f0',
                }}
              >
                {/* 1. Profile A Sample */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#d97706' }}>
                    Profile A: Circular Baseline (R={item.nominalR}px)
                  </span>
                  <div style={{ width: `${item.w}px`, height: `${item.h}px`, position: 'relative' }}>
                    <svg width={item.w} height={item.h} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                      <path d={basePath} fill={item.bgFill} stroke={item.strokeColor} strokeWidth={1.5} />
                    </svg>
                    <div style={{ width: `${item.w}px`, height: `${item.h}px`, position: 'relative', zIndex: 2 }}>
                      {item.renderContent()}
                    </div>
                  </div>
                </div>

                {/* 2. Candidate Continuous Sample */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#059669' }}>
                    {candidateProfile === 'curvature-optimized' ? 'Profile D (G2 Quintic)' : 'Profile C (Bézier)'}
                  </span>
                  <div style={{ width: `${item.w}px`, height: `${item.h}px`, position: 'relative' }}>
                    <svg width={item.w} height={item.h} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                      <path d={candPath} fill={item.bgFill} stroke={item.strokeColor} strokeWidth={1.5} />
                    </svg>
                    <div style={{ width: `${item.w}px`, height: `${item.h}px`, position: 'relative', zIndex: 2 }}>
                      {item.renderContent()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
