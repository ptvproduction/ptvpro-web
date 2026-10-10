/**
 * PTV PRO HUB — CONTINUOUS CORNER LABORATORY V3
 * Master Suite: Optical Precision, Curve Differentiation & Surface Refinement
 * Unites all 6 core experimental modules:
 * 1. Curve Difference Inspector
 * 2. Optical Curvature Tuning
 * 3. Normalized Curve Comparison
 * 4. Real UI Scale Test
 * 5. Surface Treatment Lab
 * 6. Nested Corner Optical Test
 */

import React, { useState } from 'react';
import { CurveDifferenceInspector } from './CurveDifferenceInspector';
import { OpticalTuningView } from './OpticalTuningView';
import { NormalizedComparisonView } from './NormalizedComparisonView';
import { RealUIScaleGallery } from './RealUIScaleGallery';
import { SurfaceTreatmentLab } from './SurfaceTreatmentLab';
import { NestedOpticalLab } from './NestedOpticalLab';

export const LaboratoryV3Suite: React.FC = () => {
  const [subTab, setSubTab] = useState<
    'difference' | 'tuning' | 'normalized' | 'ui-scale' | 'surface' | 'nested'
  >('difference');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Executive Hero Banner ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: 'var(--ptv-curve-2xl)',
          padding: '28px 32px',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--ptv-curve-pill)',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            Laboratory V3 — Optical Precision
          </span>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--ptv-curve-pill)',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              fontSize: '11px',
              fontWeight: 700,
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <i className="fa-solid fa-check" style={{ marginRight: '5px' }} />
            Path Assembly Validated
          </span>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--ptv-curve-pill)',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#fbbf24',
              fontSize: '11px',
              fontWeight: 700,
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            Prinsip: Tingkatkan Kualitas Curvature, Bukan Ukuran Radius
          </span>
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-0.03em', color: '#f8fafc' }}>
          Continuous Corner Laboratory V3 — Presisi Optik &amp; Diferensiasi Kurva
        </h1>

        <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: 0, maxWidth: '880px', lineHeight: 1.6 }}>
          Mengatasi masalah kesamaan visual Profile A (Circular) dan Profile D (G2) pada ukuran normal melalui 
          <b> normalisasi analitis 4-metode</b>, <b>inspeksi deviasi kontur sub-piksel</b>, <b>penalaan parameter optik murni</b>, 
          dan <b>validasi pada matriks skala nyata UI (36px s/d 360px)</b>.
        </p>

        {/* Sub-tab Navigation Pill Group */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '22px',
            flexWrap: 'wrap',
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '6px',
            borderRadius: 'var(--ptv-curve-lg)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {[
            { id: 'difference', label: '1. Curve Difference Inspector', icon: 'fa-magnifying-glass-chart' },
            { id: 'tuning', label: '2. Optical Curvature Tuning', icon: 'fa-sliders' },
            { id: 'normalized', label: '3. Normalized Comparison', icon: 'fa-scale-balanced' },
            { id: 'ui-scale', label: '4. Real UI Scale Test', icon: 'fa-layer-group' },
            { id: 'surface', label: '5. Surface Treatment Lab', icon: 'fa-gem' },
            { id: 'nested', label: '6. Nested Optical Lab', icon: 'fa-circle-notch' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id as any)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--ptv-curve-md)',
                border: subTab === tab.id ? '1px solid rgba(56, 189, 248, 0.5)' : 'none',
                background: subTab === tab.id ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: subTab === tab.id ? '#38bdf8' : '#94a3b8',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <i className={`fa-solid ${tab.icon}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sub-tab Content Views ── */}
      {subTab === 'difference' && <CurveDifferenceInspector />}
      {subTab === 'tuning' && <OpticalTuningView />}
      {subTab === 'normalized' && <NormalizedComparisonView />}
      {subTab === 'ui-scale' && <RealUIScaleGallery />}
      {subTab === 'surface' && <SurfaceTreatmentLab />}
      {subTab === 'nested' && <NestedOpticalLab />}
    </div>
  );
};
