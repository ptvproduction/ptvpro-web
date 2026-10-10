/**
 * PTV PRO HUB — Continuous Corner Geometry Research & Laboratory V2
 * ComponentSpecimenGallery: Evaluates ecosystem consistency across 8 real UI specimens
 * using a single chosen curve profile with proportional radius scaling:
 * 1. Large Panel (520×270, R=24px)
 * 2. Nested Content Panel (inside Large Panel, R=12px)
 * 3. Standard Card (300×180, R=16px)
 * 4. Small Card (190×110, R=12px)
 * 5. Input Field (260×38, R=8px)
 * 6. Button (140×36, R=8px - non-pill!)
 * 7. Modal Dialog (340×210, R=20px)
 * 8. Sidebar Nav Item (220×36, R=8px)
 */

import React, { useState } from 'react';
import { CurveProfileId } from '../geometry/types';
import {
  PROFILE_CONFIGS,
  generateClosedPath,
  ProfileParameters,
} from '../geometry/curveProfiles';

export const ComponentSpecimenGallery: React.FC = () => {
  const [activeProfile, setActiveProfile] = useState<CurveProfileId>('curvature-optimized');
  const [inputVal, setInputVal] = useState('Sony FE 24-70mm GM');

  const params: ProfileParameters = {
    exponent: 3.5,
    smoothing: 0.6,
    transitionRatio: 0.45,
  };

  // Helper to render an SVG-curved container
  const renderCurvedSurface = (
    w: number,
    h: number,
    r: number,
    fill: string,
    stroke: string,
    strokeWidth = 1.5,
    shadow = 'drop-shadow(0 4px 8px rgba(0,0,0,0.04))',
    children?: React.ReactNode
  ) => {
    const pathD = generateClosedPath(w, h, r, activeProfile, params);
    return (
      <div
        style={{
          width: `${w}px`,
          height: `${h}px`,
          position: 'relative',
          filter: shadow,
        }}
      >
        <svg width={w} height={h} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <path d={pathD} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        </svg>
        <div
          style={{
            width: `${w}px`,
            height: `${h}px`,
            position: 'relative',
            zIndex: 2,
            boxSizing: 'border-box',
          }}
        >
          {children}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--ptv-curve-pill)',
              background: '#ede9fe',
              color: '#6d28d9',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Design System Specimen Suite
          </span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            8 Spesimen UI Nyata • Radius Proporsional Berskala
          </span>
        </div>
        <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
          Uji Konsistensi Bahasa Geometri Antar-Komponen
        </h2>
        <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.55 }}>
          Mengevaluasi apakah profil kurva yang dipilih menghasilkan estetika yang harmonis dan kohesif ketika diterapkan secara proporsional ke berbagai ukuran komponen (dari modal besar hingga tombol mikro), tanpa menyeragamkan semua radius atau mengubah semua tombol menjadi kapsul/pill.
        </p>

        {/* Profile Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Terapkan Profil Kurva:</span>
          {(['circle', 'superellipse', 'bezier', 'curvature-optimized'] as const).map((pId) => (
            <button
              key={pId}
              type="button"
              onClick={() => setActiveProfile(pId)}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--ptv-curve-xs)',
                border: activeProfile === pId ? '1.5px solid #6d28d9' : '1px solid #cbd5e1',
                background: activeProfile === pId ? '#f5f3ff' : '#ffffff',
                color: activeProfile === pId ? '#5b21b6' : '#475569',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {PROFILE_CONFIGS[pId].shortName}
            </button>
          ))}
        </div>
      </div>

      {/* ── Gallery Layout ── */}
      <div
        style={{
          background: '#f8fafc',
          border: '1.5px solid #e2e8f0',
          borderRadius: 'var(--ptv-curve-xl)',
          padding: '28px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* SPECIMEN 1 & 2: Large Panel with Nested Content Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
            1 &amp; 2. Large Panel (500×260, R=24px) + Nested Panel (R=12px)
          </span>
          {renderCurvedSurface(
            500,
            260,
            24,
            '#ffffff',
            '#cbd5e1',
            1.5,
            'drop-shadow(0 10px 15px rgba(0,0,0,0.05))',
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Dossier Unit Inventaris</span>
                  <span style={{ fontSize: '11px', background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 'var(--ptv-curve-pill)', fontWeight: 700 }}>
                    INV-CAM-001
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Spesifikasi Teknis &amp; Riwayat Maintenance
                </div>
              </div>

              {/* Nested Content Panel (Specimen 2) */}
              {renderCurvedSurface(
                460,
                110,
                12,
                '#f8fafc',
                '#e2e8f0',
                1,
                'none',
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>Pemeriksaan Sensor Terakhir</span>
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                      <i className="fa-solid fa-check" style={{ marginRight: '4px' }} /> Bersih (Zero Dust)
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Shutter count: 14.820 • Firmware v3.01 • Kalibrasi sensor 10 Okt 2026.
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                    Nested Inset: 20px • Jarak antar-sudut terdistribusi seragam
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#64748b' }}>
                <span>Status: Tersedia untuk Peminjaman</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>Rp 750.000 / hari</span>
              </div>
            </div>
          )}
        </div>

        {/* SPECIMEN 3: Standard Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
            3. Standard Card (300×180, R=16px)
          </span>
          {renderCurvedSurface(
            300,
            180,
            16,
            '#ffffff',
            '#cbd5e1',
            1.5,
            'drop-shadow(0 8px 12px rgba(0,0,0,0.06))',
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>Sony FE 50mm f/1.2 GM</span>
                  <span style={{ fontSize: '10px', background: '#ecfdf5', color: '#059669', padding: '2px 6px', borderRadius: 'var(--ptv-curve-pill)', fontWeight: 700 }}>
                    Tersedia
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Lensa Prime Portrait E-Mount
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: 'var(--ptv-curve-xs)', border: '1px solid #e2e8f0', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Nilai Inventaris:</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>Rp 28.500.000</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Rp 250.000 / hari</span>
                <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700 }}>Detail Unit &rarr;</span>
              </div>
            </div>
          )}
        </div>

        {/* SPECIMEN 4: Small Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
            4. Small Card (200×110, R=12px)
          </span>
          {renderCurvedSurface(
            200,
            110,
            12,
            '#ffffff',
            '#cbd5e1',
            1.5,
            'drop-shadow(0 4px 6px rgba(0,0,0,0.04))',
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Baterai NP-FZ100</span>
                <div style={{ fontSize: '10px', color: '#64748b' }}>Aksesori Kamera</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                <span style={{ color: '#059669', fontWeight: 700 }}>3 Unit Siap</span>
                <span style={{ fontWeight: 700 }}>Rp 25.000</span>
              </div>
            </div>
          )}
        </div>

        {/* SPECIMEN 5 & 6: Input Field + Button (Non-pill!) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
            5 &amp; 6. Form Control: Input (260×38, R=8px) &amp; Button (140×36, R=8px - Bukan Pill!)
          </span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Input Field Surface */}
            {renderCurvedSurface(
              260,
              38,
              8,
              '#ffffff',
              '#cbd5e1',
              1.5,
              'none',
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ color: '#94a3b8', fontSize: '12px', marginRight: '8px' }} />
                <input
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '12px',
                    color: '#0f172a',
                    width: '100%',
                    fontFamily: 'inherit',
                  }}
                  placeholder="Cari inventaris..."
                />
              </div>
            )}

            {/* Non-Pill Button */}
            {renderCurvedSurface(
              130,
              38,
              8,
              '#0f172a',
              '#0f172a',
              1,
              'drop-shadow(0 2px 4px rgba(0,0,0,0.08))',
              <button
                type="button"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: 'transparent',
                  color: '#ffffff',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <i className="fa-solid fa-plus" style={{ marginRight: '6px' }} /> Tambah Unit
              </button>
            )}
          </div>
        </div>

        {/* SPECIMEN 7: Modal Dialog */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
            7. Modal Dialog (330×200, R=20px)
          </span>
          {renderCurvedSurface(
            330,
            200,
            20,
            '#ffffff',
            '#cbd5e1',
            1.5,
            'drop-shadow(0 16px 24px rgba(0,0,0,0.12))',
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Konfirmasi Pengembalian</span>
                  <i className="fa-solid fa-xmark" style={{ color: '#94a3b8', cursor: 'pointer' }} />
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px', lineHeight: 1.45 }}>
                  Pastikan kondisi fisik lensa Sony GM tidak mengalami goresan optik sebelum menyimpan data.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                {renderCurvedSurface(
                  80,
                  32,
                  6,
                  '#f1f5f9',
                  '#cbd5e1',
                  1,
                  'none',
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      background: 'transparent',
                      color: '#475569',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Batal
                  </button>
                )}
                {renderCurvedSurface(
                  110,
                  32,
                  6,
                  '#2563eb',
                  '#2563eb',
                  1,
                  'none',
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      background: 'transparent',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Simpan Selesai
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SPECIMEN 8: Sidebar Navigation Item */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
            8. Sidebar Navigation Item (220×36, R=8px)
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Active item */}
            {renderCurvedSurface(
              220,
              36,
              8,
              '#eff6ff',
              '#bfdbfe',
              1,
              'none',
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '0 12px', color: '#1d4ed8', fontSize: '12px', fontWeight: 700 }}>
                <i className="fa-solid fa-boxes-stacked" style={{ marginRight: '8px', width: '16px' }} />
                Inventaris Studio (Aktif)
              </div>
            )}

            {/* Inactive item */}
            {renderCurvedSurface(
              220,
              36,
              8,
              'transparent',
              'transparent',
              1,
              'none',
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '0 12px', color: '#64748b', fontSize: '12px', fontWeight: 500 }}>
                <i className="fa-solid fa-hand-holding-hand" style={{ marginRight: '8px', width: '16px' }} />
                Peminjaman Aktif
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
