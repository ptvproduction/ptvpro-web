import React, { useState } from 'react';
import { PTVSelect } from '@shared/components/PTVSelect';

/**
 * PTVContinuousCurveFixture
 * Visual inspection fixture for "PTV Unified Continuous Curve"
 * Demonstrating:
 *  1. One Curve Family Across Every Component (Optical Sizing)
 *  2. Concentric Nested Alignment (R_inner ≈ max(0, R_outer - inset))
 *  3. Progressive Squircle Enhancement & Continuous Tangent Fallback
 */
export const PTVContinuousCurveFixture: React.FC = () => {
  const [selectedDropdown, setSelectedDropdown] = useState('kamera');
  const [activeTab, setActiveTab] = useState<'comparison' | 'nested' | 'overlay'>('comparison');

  const isSquircleSupported =
    typeof window !== 'undefined' &&
    typeof CSS !== 'undefined' &&
    CSS.supports &&
    CSS.supports('corner-shape', 'squircle');

  return (
    <div className="page subview-fade ptv-continuous-curve-fixture" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* ── 1. Fixture Header ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--ptv-curve-pill)',
              background: '#e0f2fe',
              color: '#0369a1',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Design System Inspection Fixture
          </span>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--ptv-curve-pill)',
              background: isSquircleSupported ? '#ecfdf5' : '#f1f5f9',
              color: isSquircleSupported ? '#059669' : '#475569',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            <i className={`fa-solid ${isSquircleSupported ? 'fa-check' : 'fa-circle-info'}`} style={{ marginRight: '5px' }} />
            {isSquircleSupported ? 'Engine: Native Squircle Active' : 'Engine: Continuous Tangent Scale Active'}
          </span>
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--ink, #0f172a)', margin: '0 0 6px 0', letterSpacing: '-0.03em' }}>
          PTV Unified Continuous Curve
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--muted, #64748b)', margin: 0, lineHeight: 1.5 }}>
          Filosofi <b>"One Curve Family, Every Component"</b>. Setiap komponen berbagi profil lengkungan kontinu harmonis yang disesuaikan secara optis menurut dimensi dan kedalaman hierarki.
        </p>
      </div>

      {/* ── 2. Interactive Navigation Tabs ── */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '1px solid var(--line-2, #e2e8f0)',
          paddingBottom: '10px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('comparison')}
          style={{
            padding: '7px 16px',
            borderRadius: 'var(--ptv-curve-md)',
            border: activeTab === 'comparison' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
            background: activeTab === 'comparison' ? '#eff6ff' : '#ffffff',
            color: activeTab === 'comparison' ? '#1d4ed8' : '#475569',
            fontWeight: 750,
            fontSize: '12.5px',
            cursor: 'pointer',
          }}
        >
          <i className="fa-solid fa-shapes" style={{ marginRight: '6px' }} />
          1. Optical Size Matrix
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('nested')}
          style={{
            padding: '7px 16px',
            borderRadius: 'var(--ptv-curve-md)',
            border: activeTab === 'nested' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
            background: activeTab === 'nested' ? '#eff6ff' : '#ffffff',
            color: activeTab === 'nested' ? '#1d4ed8' : '#475569',
            fontWeight: 750,
            fontSize: '12.5px',
            cursor: 'pointer',
          }}
        >
          <i className="fa-solid fa-vector-square" style={{ marginRight: '6px' }} />
          2. Concentric Nested Alignment
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('overlay')}
          style={{
            padding: '7px 16px',
            borderRadius: 'var(--ptv-curve-md)',
            border: activeTab === 'overlay' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
            background: activeTab === 'overlay' ? '#eff6ff' : '#ffffff',
            color: activeTab === 'overlay' ? '#1d4ed8' : '#475569',
            fontWeight: 750,
            fontSize: '12.5px',
            cursor: 'pointer',
          }}
        >
          <i className="fa-solid fa-crosshairs" style={{ marginRight: '6px' }} />
          3. Corner Superimposed Overlay
        </button>
      </div>

      {/* ── TAB 1: OPTICAL SIZE MATRIX ── */}
      {activeTab === 'comparison' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '16px',
            }}
          >
            {/* Control Small & Micro Badge */}
            <div
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1.5px solid var(--line, #e2e8f0)',
                borderRadius: 'var(--ptv-curve-xl)',
                padding: '18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>
                  Micro &amp; Small Controls
                </span>
                <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                  --ptv-curve-xs (6px) / sm (9px)
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px', lineHeight: 1.4 }}>
                Digunakan untuk tag mikro, badge status unit, dan tombol sekunder kompak agar kurva proporsional tanpa terlihat seperti kapsul.
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--ptv-curve-xs)',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    fontSize: '11px',
                    fontWeight: 800,
                  }}
                >
                  INV-001 (Micro 6px)
                </span>
                <button
                  type="button"
                  className="btn sm"
                  style={{ borderRadius: 'var(--ptv-curve-sm)', padding: '5px 12px', fontSize: '12px', fontWeight: 700 }}
                >
                  <i className="fa-solid fa-filter" style={{ marginRight: '4px' }} />
                  Filter (Small 9px)
                </button>
                <button
                  type="button"
                  className="btn sm pri"
                  style={{ borderRadius: 'var(--ptv-curve-sm)', padding: '5px 12px', fontSize: '12px', fontWeight: 700 }}
                >
                  Aksi Mini
                </button>
              </div>
            </div>

            {/* Standard Form Controls & Dropdown */}
            <div
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1.5px solid var(--line, #e2e8f0)',
                borderRadius: 'var(--ptv-curve-xl)',
                padding: '18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>
                  Standard Controls &amp; PTVSelect
                </span>
                <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                  --ptv-curve-md (12px)
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px', lineHeight: 1.4 }}>
                Profil kurva standar untuk trigger custom dropdown, text input, search input, dan tombol aksi primer Hub.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <PTVSelect
                  value={selectedDropdown}
                  onChange={setSelectedDropdown}
                  options={[
                    { value: 'kamera', label: 'Kategori: Kamera & Video' },
                    { value: 'audio', label: 'Kategori: Audio & Sound' },
                    { value: 'lighting', label: 'Kategori: Lighting & Grip' },
                  ]}
                  ariaLabel="Pilih Kategori Demo"
                />
                <input
                  type="text"
                  readOnly
                  value="Input Standar (R: 12px Continuous)"
                  style={{
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: 'var(--ptv-curve-md)',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    background: '#f8fafc',
                    color: '#334155',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Floating Menu & Sub-Card */}
            <div
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1.5px solid var(--line, #e2e8f0)',
                borderRadius: 'var(--ptv-curve-xl)',
                padding: '18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>
                  Floating Panel / Sub-Card
                </span>
                <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                  --ptv-curve-lg (16px)
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px', lineHeight: 1.4 }}>
                Menu dropdown melayang (floating popover), filter container toolbar, dan panel anak bersarang di dalam kartu.
              </p>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--ptv-curve-lg)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 750, color: '#0f172a' }}>Floating Dossier Surface</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>R: 16px continuous contour</div>
                </div>
                <span className="chip ok" style={{ fontSize: '10.5px' }}>Aktif</span>
              </div>
            </div>

            {/* Standard Card & Bento Item */}
            <div
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1.5px solid var(--line, #e2e8f0)',
                borderRadius: 'var(--ptv-curve-xl)',
                padding: '18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>
                  Standard Card &amp; Bento Item
                </span>
                <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                  --ptv-curve-xl (22px)
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px', lineHeight: 1.4 }}>
                Kartu konten katalog inventaris, item valuasi finansial, dan KPI bento card.
              </p>
              <div
                style={{
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 'var(--ptv-curve-xl)',
                  padding: '14px 16px',
                  background: '#ffffff',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Sony FX3 Cinema Line</div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>Surface Card Boundary: R = 22px</div>
              </div>
            </div>

            {/* Modal Dialog & Prominent Surface */}
            <div
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1.5px solid var(--line, #e2e8f0)',
                borderRadius: 'var(--ptv-curve-xl)',
                padding: '18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>
                  Modal Dialog &amp; Sheet
                </span>
                <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                  --ptv-curve-2xl (28px)
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px', lineHeight: 1.4 }}>
                Kontainer modal dialog melayang dan kartu hero utama dengan radius sudut yang berkarakter lembut dan anggun.
              </p>
              <div
                style={{
                  border: '1.5px solid #94a3b8',
                  borderRadius: 'var(--ptv-curve-2xl)',
                  padding: '16px 20px',
                  background: '#f8fafc',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Modal Surface Container</div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>Dialog Envelope: R = 28px</div>
              </div>
            </div>

            {/* Drawer & Floating Bottom Sheet */}
            <div
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1.5px solid var(--line, #e2e8f0)',
                borderRadius: 'var(--ptv-curve-xl)',
                padding: '18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>
                  Drawer &amp; Bottom Sheet
                </span>
                <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                  --ptv-curve-3xl (34px)
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px', lineHeight: 1.4 }}>
                Sheet drawer mobile dan panel navigasi mengambang untuk pengalaman sentuh modern.
              </p>
              <div
                style={{
                  border: '1.5px solid #94a3b8',
                  borderRadius: 'var(--ptv-curve-3xl)',
                  padding: '16px 20px',
                  background: '#f8fafc',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Drawer Container Envelope</div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>Maximum Master Surface: R = 34px</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: CONCENTRIC NESTED ALIGNMENT ── */}
      {activeTab === 'nested' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--ptv-curve-lg)',
              padding: '14px 18px',
            }}
          >
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              Formula Keselarasan Konsentris: <code>R_inner ≈ max(0, R_outer - inset)</code>
            </div>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Ketika elemen bersarang (nested) di dalam permukaan induk, lengkungan elemen anak harus mengecil sebanding dengan jarak inset (padding + border). Hal ini mencegah "corner pinch" atau celah sudut yang janggal.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '20px',
            }}
          >
            {/* Concentric Example A: Modal (R=28) -> Subpanel (R=16) -> Control (R=12) */}
            <div
              style={{
                background: 'var(--surface, #ffffff)',
                border: '2px solid #0f172a',
                borderRadius: 'var(--ptv-curve-2xl)', /* 28px */
                padding: '12px', /* inset = 12px */
                boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginBottom: '8px', letterSpacing: '0.04em' }}>
                LEVEL 1: MODAL OUTER ENVELOPE (R = 28px, Inset = 12px)
              </div>
              <div
                style={{
                  background: '#f1f5f9',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 'var(--ptv-curve-lg)', /* 28 - 12 = 16px */
                  padding: '8px', /* inset = 8px (padding 4 + offset) */
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', marginBottom: '8px' }}>
                  LEVEL 2: NESTED PANEL (R = 16px, Inset = 4px)
                </div>
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #94a3b8',
                    borderRadius: 'var(--ptv-curve-md)', /* 16 - 4 = 12px */
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                    LEVEL 3: CONTROL (R = 12px)
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--ptv-curve-xs)', /* 6px */
                      background: '#ecfdf5',
                      color: '#059669',
                      fontSize: '10px',
                      fontWeight: 800,
                    }}
                  >
                    Harmonis
                  </span>
                </div>
              </div>
            </div>

            {/* Concentric Example B: Content Card (R=22) -> Thumbnail (R=12) */}
            <div
              style={{
                background: 'var(--surface, #ffffff)',
                border: '2px solid #0f172a',
                borderRadius: 'var(--ptv-curve-xl)', /* 22px */
                padding: '10px', /* inset = 10px */
                boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginBottom: '8px', letterSpacing: '0.04em' }}>
                LEVEL 1: CARD ENVELOPE (R = 22px, Inset = 10px)
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 'var(--ptv-curve-md)', /* 22 - 10 = 12px */
                  padding: '10px',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--ptv-curve-md)', /* 12px */
                    background: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    flexShrink: 0,
                  }}
                >
                  <i className="fa-solid fa-camera" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                    Thumbnail &amp; Sub-Surface
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Kontur sudut seirama tanpa distorsi visual
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: CORNER SUPERIMPOSED OVERLAY ── */}
      {activeTab === 'overlay' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--ptv-curve-lg)',
              padding: '14px 18px',
            }}
          >
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              Uji Kelurusan Tangen &amp; Profil Kontinu (One Curve Family)
            </div>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Sudut-sudut komponen disejajarkan pada titik acuan yang sama (origin 0,0) untuk memvalidasi bahwa rasio kurvatur ke sisi lurus berada dalam profil continuous yang identik.
            </p>
          </div>

          <div
            style={{
              background: '#090d16',
              borderRadius: 'var(--ptv-curve-2xl)',
              padding: '30px 24px',
              color: '#ffffff',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Corner Origin Gauge (Top-Left Aligned)
                </span>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 900 }}>Superimposed Visual Rulers</h3>
              </div>
              <div style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8' }} />
                  Control (12px)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#a855f7' }} />
                  Panel (16px)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#34d399' }} />
                  Card (22px)
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
                  Modal (28px)
                </span>
              </div>
            </div>

            {/* Visual Gauge Stage */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '480px',
                height: '240px',
                margin: '0 auto',
                background: '#0e1726',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--ptv-curve-xl)',
                overflow: 'hidden',
              }}
            >
              {/* Origin Crosshair Axis */}
              <div style={{ position: 'absolute', left: '20px', top: '0', bottom: '0', width: '1px', background: 'rgba(255,255,255,0.2)' }} />
              <div style={{ position: 'absolute', top: '20px', left: '0', right: '0', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
              <div style={{ position: 'absolute', left: '24px', top: '24px', fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                Origin (0,0)
              </div>

              {/* Superimposed Layer 4: Modal 28px */}
              <div
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '20px',
                  width: '280px',
                  height: '180px',
                  borderTop: '2.5px solid #f59e0b',
                  borderLeft: '2.5px solid #f59e0b',
                  borderTopLeftRadius: 'var(--ptv-curve-2xl)', /* 28px */
                  background: 'rgba(245, 158, 11, 0.05)',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ position: 'absolute', right: '10px', top: '6px', fontSize: '10px', color: '#f59e0b', fontWeight: 800 }}>
                  Modal 28px
                </span>
              </div>

              {/* Superimposed Layer 3: Card 22px */}
              <div
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '20px',
                  width: '240px',
                  height: '150px',
                  borderTop: '2.5px solid #34d399',
                  borderLeft: '2.5px solid #34d399',
                  borderTopLeftRadius: 'var(--ptv-curve-xl)', /* 22px */
                  background: 'rgba(52, 211, 153, 0.06)',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ position: 'absolute', right: '10px', top: '6px', fontSize: '10px', color: '#34d399', fontWeight: 800 }}>
                  Card 22px
                </span>
              </div>

              {/* Superimposed Layer 2: Sub-panel 16px */}
              <div
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '20px',
                  width: '200px',
                  height: '120px',
                  borderTop: '2.5px solid #a855f7',
                  borderLeft: '2.5px solid #a855f7',
                  borderTopLeftRadius: 'var(--ptv-curve-lg)', /* 16px */
                  background: 'rgba(168, 85, 247, 0.08)',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ position: 'absolute', right: '10px', top: '6px', fontSize: '10px', color: '#a855f7', fontWeight: 800 }}>
                  Panel 16px
                </span>
              </div>

              {/* Superimposed Layer 1: Control 12px */}
              <div
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '20px',
                  width: '150px',
                  height: '90px',
                  borderTop: '2.5px solid #38bdf8',
                  borderLeft: '2.5px solid #38bdf8',
                  borderTopLeftRadius: 'var(--ptv-curve-md)', /* 12px */
                  background: 'rgba(56, 189, 248, 0.12)',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ position: 'absolute', right: '10px', top: '6px', fontSize: '10px', color: '#38bdf8', fontWeight: 800 }}>
                  Control 12px
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
              Semua sudut bertransisi mulus ke sisi datar tanpa kurva terputus atau sudut tajam artifisial.
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Unified Token Reference Table ── */}
      <div style={{ marginTop: '30px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ink, #0f172a)', marginBottom: '12px' }}>
          Tabel Standar Token Kurva PTV Hub
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-lg)' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Token CSS</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Radius Nilai</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Peruntukan Optis</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Contoh Komponen Hub</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>--ptv-curve-xs</td>
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>6px</td>
                <td style={{ padding: '10px 14px' }}>Micro badges, inline tags, indikator status</td>
                <td style={{ padding: '10px 14px' }}><code>.ptv-nilai-badge-code</code>, <code>.ptv-nilai-unit-badge</code></td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>--ptv-curve-sm</td>
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>9px</td>
                <td style={{ padding: '10px 14px' }}>Small controls, compact buttons (h: 28-34px)</td>
                <td style={{ padding: '10px 14px' }}>Tombol Reset Filter, Mini Action Icons</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>--ptv-curve-md</td>
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>12px</td>
                <td style={{ padding: '10px 14px' }}>Standard form controls &amp; buttons (h: 38-46px)</td>
                <td style={{ padding: '10px 14px' }}><code>.ptv-select-trigger</code>, text input, search wrap</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>--ptv-curve-lg</td>
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>16px</td>
                <td style={{ padding: '10px 14px' }}>Floating dropdown menu, sub-panels bersarang</td>
                <td style={{ padding: '10px 14px' }}><code>.ptv-select-menu</code>, dossier col, price highlight</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>--ptv-curve-xl</td>
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>22px</td>
                <td style={{ padding: '10px 14px' }}>Standard content cards, bento metric items</td>
                <td style={{ padding: '10px 14px' }}><code>.ptv-nilai-card</code>, <code>.ptv-nilai-kpi-card</code></td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>--ptv-curve-2xl</td>
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>28px</td>
                <td style={{ padding: '10px 14px' }}>Modal dialogs, prominent bento containers</td>
                <td style={{ padding: '10px 14px' }}>Modal Catat Nilai, Modal Konfirmasi</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>--ptv-curve-3xl</td>
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>34px</td>
                <td style={{ padding: '10px 14px' }}>Mobile drawers, floating bottom sheets</td>
                <td style={{ padding: '10px 14px' }}><code>.sheet</code> drawer, master overlays</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>--ptv-curve-pill</td>
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>9999px</td>
                <td style={{ padding: '10px 14px' }}>Filter chips (.fchip), pill tags, progress bar</td>
                <td style={{ padding: '10px 14px' }}><code>.fchip</code>, coverage progress bar</td>
              </tr>
              <tr>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>--ptv-curve-circle</td>
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>50%</td>
                <td style={{ padding: '10px 14px' }}>Avatars, circular icon buttons, status dots</td>
                <td style={{ padding: '10px 14px' }}>Avatar profil, indikator unit dot</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
