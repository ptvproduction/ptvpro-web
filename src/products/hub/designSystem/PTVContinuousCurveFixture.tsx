import React, { useState } from 'react';
import { PTVSelect } from '@shared/components/PTVSelect';

/**
 * PTVContinuousCurveFixture
 * Visual inspection fixture for "PTV Unified Continuous Curve"
 * Demonstrating:
 *  1. One Curve Family Across Every Component (Optical Sizing)
 *  2. Concentric Nested Alignment (Actual Inset: Padding + Border vs. Optical Adjustments)
 *  3. Real Browser Rendering vs. Theoretical Reference Curves
 *  4. Superimposed Outline-Only Corner Overlay & Normalized Trajectory Verification
 */
export const PTVContinuousCurveFixture: React.FC = () => {
  const [selectedDropdown, setSelectedDropdown] = useState('kamera');
  const [activeTab, setActiveTab] = useState<'lab' | 'comparison' | 'nested' | 'overlay' | 'typography'>('lab');

  // ── Tab 0: True Corner Smoothing Laboratory State ──
  const [labRadius, setLabRadius] = useState<number>(24);
  const [labSmoothing, setLabSmoothing] = useState<number>(3.5);
  const [labSizePreset, setLabSizePreset] = useState<'compact' | 'standard' | 'large' | 'custom'>('standard');
  const [labCustomW, setLabCustomW] = useState<number>(340);
  const [labCustomH, setLabCustomH] = useState<number>(220);
  const [labTheme, setLabTheme] = useState<'light' | 'dark' | 'grid'>('light');
  const [labNestedInset, setLabNestedInset] = useState<number>(14);
  const [labZoom, setLabZoom] = useState<1 | 4 | 8 | 16>(1);
  const [labInspectMode, setLabInspectMode] = useState<'side-by-side' | 'zoomed-overlay'>('side-by-side');
  const [labActionMessage, setLabActionMessage] = useState<string | null>(null);

  // Tab 2: Concentric Nested Alignment State
  const [nestedScenario, setNestedScenario] = useState<'card' | 'modal' | 'calculator'>('card');
  const [calcOuterR, setCalcOuterR] = useState(22);
  const [calcPadding, setCalcPadding] = useState(10);
  const [calcBorder, setCalcBorder] = useState(2);

  // Tab 3: Superimposed Overlay Sub-modes
  const [overlayMode, setOverlayMode] = useState<'outline' | 'normalized' | 'empirical'>('outline');
  const [zoomLevel, setZoomLevel] = useState<1 | 2 | 3>(1);
  const [offsetShift, setOffsetShift] = useState(0); // 0px = exact origin alignment
  const [normalizedGap, setNormalizedGap] = useState(0); // 0px = exact superimposed comparison
  const [visibleLayers, setVisibleLayers] = useState({
    control: true, // 12px
    panel: true,   // 16px
    card: true,    // 22px
    modal: true,   // 28px
    drawer: true,  // 34px
  });
  const [showTheoreticalSquircle, setShowTheoreticalSquircle] = useState(true);
  const [showTheoreticalCircle, setShowTheoreticalCircle] = useState(true);
  const [showActualBrowserCSS, setShowActualBrowserCSS] = useState(true);

  // Browser Engine Squircle Support Check
  const isSquircleSupported =
    typeof window !== 'undefined' &&
    typeof CSS !== 'undefined' &&
    CSS.supports &&
    CSS.supports('corner-shape', 'squircle');

  // Helper to generate closed rectangular superellipse SVG path (TR, BR, BL, TL)
  const generateClosedSuperellipsePath = (
    w: number,
    h: number,
    r: number,
    n: number,
    steps = 28
  ): string => {
    const clampedR = Math.max(0, Math.min(r, w / 2, h / 2));
    if (clampedR === 0) {
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
    }
    let d = `M ${clampedR} 0 L ${w - clampedR} 0`;
    // TR Corner
    for (let i = 0; i <= steps; i++) {
      const t = (Math.PI / 2) * (1 - i / steps);
      const x = w - clampedR + clampedR * Math.pow(Math.cos(t), 2 / n);
      const y = clampedR * (1 - Math.pow(Math.sin(t), 2 / n));
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    d += ` L ${w} ${h - clampedR}`;
    // BR Corner
    for (let i = 0; i <= steps; i++) {
      const t = (Math.PI / 2) * (i / steps);
      const x = w - clampedR + clampedR * Math.pow(Math.cos(t), 2 / n);
      const y = h - clampedR + clampedR * Math.pow(Math.sin(t), 2 / n);
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    d += ` L ${clampedR} ${h}`;
    // BL Corner
    for (let i = 0; i <= steps; i++) {
      const t = (Math.PI / 2) * (1 - i / steps);
      const x = clampedR * (1 - Math.pow(Math.cos(t), 2 / n));
      const y = h - clampedR + clampedR * Math.pow(Math.sin(t), 2 / n);
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    d += ` L 0 ${clampedR}`;
    // TL Corner
    for (let i = 0; i <= steps; i++) {
      const t = (Math.PI / 2) * (i / steps);
      const x = clampedR * (1 - Math.pow(Math.cos(t), 2 / n));
      const y = clampedR * (1 - Math.pow(Math.sin(t), 2 / n));
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    d += ' Z';
    return d;
  };

  // Helper to generate superellipse SVG path (top-left corner)
  const generateSuperellipsePath = (
    cx: number,
    cy: number,
    r: number,
    n: number,
    steps = 40,
    straightLen = 40
  ): string => {
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * (Math.PI / 2);
      const cosT = Math.cos(t);
      const sinT = Math.sin(t);
      const x = cx + r * (1 - Math.pow(cosT, 2 / n));
      const y = cy + r * (1 - Math.pow(sinT, 2 / n));
      points.push({ x, y });
    }
    let d = `M ${cx} ${cy + r + straightLen} L ${cx} ${cy + r}`;
    for (const pt of points) {
      d += ` L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
    }
    d += ` L ${cx + r + straightLen} ${cy}`;
    return d;
  };

  // Concentric Calculator Inset math
  const actualInset = calcPadding + calcBorder;
  const calculatedMathInner = Math.max(0, calcOuterR - actualInset);

  // Closest available token for concentric calculator
  const tokenOptions = [
    { label: '--ptv-curve-xs (6px)', val: 6 },
    { label: '--ptv-curve-sm (9px)', val: 9 },
    { label: '--ptv-curve-md (12px)', val: 12 },
    { label: '--ptv-curve-lg (16px)', val: 16 },
    { label: '--ptv-curve-xl (22px)', val: 22 },
    { label: '--ptv-curve-2xl (28px)', val: 28 },
    { label: '--ptv-curve-3xl (34px)', val: 34 },
  ];
  const closestToken = tokenOptions.reduce((prev, curr) =>
    Math.abs(curr.val - calculatedMathInner) < Math.abs(prev.val - calculatedMathInner) ? curr : prev
  );

  return (
    <div className="page subview-fade ptv-continuous-curve-fixture" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* ── 1. Fixture Header & Engine Truth Status ── */}
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
              background: '#f1f5f9',
              color: '#334155',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            <i className="fa-solid fa-code" style={{ marginRight: '5px' }} />
            {isSquircleSupported ? 'CSS Parser: corner-shape didukung' : 'CSS Parser: Standard border-radius'}
          </span>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--ptv-curve-pill)',
              background: '#eff6ff',
              color: '#1e40af',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            <i className="fa-solid fa-microchip" style={{ marginRight: '5px' }} />
            Rasterizer Nyata: Skala Busur Lingkaran Proporsional (n=2)
          </span>
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--ink, #0f172a)', margin: '0 0 6px 0', letterSpacing: '-0.03em' }}>
          PTV Unified Continuous Curve — Validation &amp; Geometry Inspector
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--muted, #64748b)', margin: 0, lineHeight: 1.5 }}>
          Laboratorium inspeksi geometri visual sudut. Membuktikan secara empiris keselarasan kurva di seluruh ukuran komponen, validasi inset konsentris aktual, dan transparansi rendering browser aktual vs. kurva teoretis.
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
          onClick={() => setActiveTab('lab')}
          style={{
            padding: '7px 16px',
            borderRadius: 'var(--ptv-curve-md)',
            border: activeTab === 'lab' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
            background: activeTab === 'lab' ? '#eff6ff' : '#ffffff',
            color: activeTab === 'lab' ? '#1d4ed8' : '#475569',
            fontWeight: 750,
            fontSize: '12.5px',
            cursor: 'pointer',
          }}
        >
          <i className="fa-solid fa-flask" style={{ marginRight: '6px' }} />
          0. True Corner Smoothing Laboratory (A vs B vs C)
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
          1. Corner Superimposed Overlay &amp; Normalized Validation
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
          2. Concentric Nested Alignment (Actual Inset Breakdown)
        </button>
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
          3. Optical Size Matrix &amp; Token Catalog
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('typography')}
          style={{
            padding: '7px 16px',
            borderRadius: 'var(--ptv-curve-md)',
            border: activeTab === 'typography' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
            background: activeTab === 'typography' ? '#eff6ff' : '#ffffff',
            color: activeTab === 'typography' ? '#1d4ed8' : '#475569',
            fontWeight: 750,
            fontSize: '12.5px',
            cursor: 'pointer',
          }}
        >
          <i className="fa-solid fa-font" style={{ marginRight: '6px' }} />
          4. Inter Universal Typography &amp; Portal Inheritance
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 0: TRUE CORNER SMOOTHING LABORATORY (A vs B vs C) ─────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'lab' && (() => {
        // Compute dimensions and live metrics for laboratory
        let labW = 340;
        let labH = 220;
        if (labSizePreset === 'compact') {
          labW = 280;
          labH = 170;
        } else if (labSizePreset === 'large') {
          labW = 400;
          labH = 260;
        } else if (labSizePreset === 'custom') {
          labW = labCustomW;
          labH = labCustomH;
        }

        // Live diagonal math at 45°
        const dCircle = labRadius * Math.SQRT2 * (1 - Math.SQRT1_2);
        const dSuper = labRadius * Math.SQRT2 * (1 - Math.pow(0.5, 1 / labSmoothing));
        const deltaD = dCircle - dSuper;

        // Theme settings
        const themeCardBg = labTheme === 'dark' ? '#1e293b' : '#ffffff';
        const themeCardBorder = labTheme === 'dark' ? '#334155' : labTheme === 'grid' ? '#2563eb' : '#cbd5e1';
        const themeCardText = labTheme === 'dark' ? '#f8fafc' : '#0f172a';
        const themeCardMuted = labTheme === 'dark' ? '#94a3b8' : '#64748b';
        const themeContainerBg = labTheme === 'dark' ? '#0f172a' : labTheme === 'grid' ? '#f8fafc' : '#f8fafc';
        const themeInnerCardBg = labTheme === 'dark' ? '#0f172a' : '#f1f5f9';
        const themeInnerCardBorder = labTheme === 'dark' ? '#334155' : '#cbd5e1';

        // Inner nested dimensions
        const innerR = Math.max(0, labRadius - labNestedInset);
        const innerW = Math.max(80, labW - labNestedInset * 2);
        const innerH = 56;

        // Superellipse SVG paths
        const outerSuperPath = generateClosedSuperellipsePath(labW, labH, labRadius, labSmoothing);
        const innerSuperPath = generateClosedSuperellipsePath(innerW, innerH, innerR, labSmoothing);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* ── 0.1 Laboratory Header & Status Bar ── */}
            <div
              style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: 'var(--ptv-curve-xl)',
                padding: '20px 24px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: 'var(--ptv-curve-pill)',
                    background: '#dbeafe',
                    color: '#1d4ed8',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  True Corner Smoothing Laboratory
                </span>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: 'var(--ptv-curve-pill)',
                    background: isSquircleSupported ? '#dcfce7' : '#fee2e2',
                    color: isSquircleSupported ? '#15803d' : '#b91c1c',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  <i className={`fa-solid ${isSquircleSupported ? 'fa-check' : 'fa-triangle-exclamation'}`} style={{ marginRight: '5px' }} />
                  {isSquircleSupported
                    ? 'Native CSS corner-shape: DIDUKUNG'
                    : 'Native CSS corner-shape: TIDAK DIDUKUNG ENGINE (Fallback ke border-radius)'}
                </span>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: 'var(--ptv-curve-pill)',
                    background: '#f1f5f9',
                    color: '#334155',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  <i className="fa-solid fa-square-root-variable" style={{ marginRight: '5px' }} />
                  Prototipe C: Gabriel Lamé Superellipse (n = {labSmoothing.toFixed(1)})
                </span>
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                Eksperimen Perbandingan Empiris: Tiga Pendekatan Sudut Komponen
              </h2>
              <p style={{ fontSize: '13.5px', color: '#475569', margin: 0, lineHeight: 1.6 }}>
                Laboratorium ini membandingkan secara langsung tiga metode pembentukan sudut pada dimensi, warna, border, dan shadow yang identik:
                <b> Komponen A (Standard CSS circular border-radius)</b>, <b> Komponen B (Native CSS corner-shape: squircle)</b>, dan <b> Komponen C (Custom Mathematically Defined Superellipse)</b>.
                Gunakan kontrol interaktif di bawah untuk mengubah radius, derajat smoothing ($n$), ukuran, dan menginspeksi makro kontur sudut.
              </p>
            </div>

            {/* ── 0.2 Interactive Control Console ── */}
            <div
              style={{
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: 'var(--ptv-curve-xl)',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <i className="fa-solid fa-sliders" style={{ marginRight: '8px', color: '#2563eb' }} />
                  Kontrol Eksperimen Interaktif
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setLabRadius(24);
                    setLabSmoothing(3.5);
                    setLabSizePreset('standard');
                    setLabTheme('light');
                    setLabNestedInset(14);
                    setLabZoom(1);
                    setLabInspectMode('side-by-side');
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--ptv-curve-sm)',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#64748b',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <i className="fa-solid fa-rotate-left" style={{ marginRight: '5px' }} />
                  Reset ke Standar Lab (R=24, n=3.5)
                </button>
              </div>

              {/* Sliders Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '16px',
                }}
              >
                {/* 1. Radius Slider */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-md)', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label htmlFor="lab-radius-slider" style={{ fontSize: '12.5px', fontWeight: 750, color: '#1e293b' }}>
                      Nominal Corner Radius (R)
                    </label>
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#2563eb', fontFamily: 'var(--ptv-font-mono)' }}>
                      {labRadius}px
                    </span>
                  </div>
                  <input
                    id="lab-radius-slider"
                    type="range"
                    min="8"
                    max="52"
                    step="2"
                    value={labRadius}
                    onChange={(e) => setLabRadius(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', gap: '5px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {[12, 16, 24, 32, 40].map((rVal) => (
                      <button
                        key={rVal}
                        type="button"
                        onClick={() => setLabRadius(rVal)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--ptv-curve-xs)',
                          border: labRadius === rVal ? '1px solid #2563eb' : '1px solid #e2e8f0',
                          background: labRadius === rVal ? '#eff6ff' : '#ffffff',
                          color: labRadius === rVal ? '#1d4ed8' : '#475569',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {rVal}px
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Smoothing Exponent Slider (n) */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-md)', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label htmlFor="lab-smoothing-slider" style={{ fontSize: '12.5px', fontWeight: 750, color: '#1e293b' }}>
                      Smoothing Exponent (n)
                    </label>
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#059669', fontFamily: 'var(--ptv-font-mono)' }}>
                      n = {labSmoothing.toFixed(1)} {labSmoothing === 2 ? '(Lingkaran Murni)' : labSmoothing === 3.5 ? '(Lamé Standar)' : ''}
                    </span>
                  </div>
                  <input
                    id="lab-smoothing-slider"
                    type="range"
                    min="2.0"
                    max="5.0"
                    step="0.1"
                    value={labSmoothing}
                    onChange={(e) => setLabSmoothing(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#059669', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', gap: '5px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {[
                      { label: 'n=2.0 (Circle)', val: 2.0 },
                      { label: 'n=2.8 (Soft)', val: 2.8 },
                      { label: 'n=3.5 (Lamé)', val: 3.5 },
                      { label: 'n=4.2 (Squircle)', val: 4.2 },
                      { label: 'n=5.0 (Boxy)', val: 5.0 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setLabSmoothing(p.val)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--ptv-curve-xs)',
                          border: Math.abs(labSmoothing - p.val) < 0.05 ? '1px solid #059669' : '1px solid #e2e8f0',
                          background: Math.abs(labSmoothing - p.val) < 0.05 ? '#ecfdf5' : '#ffffff',
                          color: Math.abs(labSmoothing - p.val) < 0.05 ? '#065f46' : '#475569',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Component Dimensions Preset */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-md)', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 750, color: '#1e293b' }}>
                      Dimensi Komponen
                    </span>
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#6366f1', fontFamily: 'var(--ptv-font-mono)' }}>
                      {labW} × {labH} px
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {(['compact', 'standard', 'large', 'custom'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setLabSizePreset(sz)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--ptv-curve-xs)',
                          border: labSizePreset === sz ? '1.5px solid #6366f1' : '1px solid #cbd5e1',
                          background: labSizePreset === sz ? '#eef2ff' : '#ffffff',
                          color: labSizePreset === sz ? '#4338ca' : '#475569',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          textTransform: 'capitalize',
                          cursor: 'pointer',
                        }}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                  {labSizePreset === 'custom' && (
                    <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '10.5px', color: '#64748b' }}>Width: {labCustomW}px</span>
                        <input
                          type="range"
                          min="240"
                          max="460"
                          step="10"
                          value={labCustomW}
                          onChange={(e) => setLabCustomW(Number(e.target.value))}
                          style={{ width: '100%', accentColor: '#6366f1' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '10.5px', color: '#64748b' }}>Height: {labCustomH}px</span>
                        <input
                          type="range"
                          min="140"
                          max="300"
                          step="10"
                          value={labCustomH}
                          onChange={(e) => setLabCustomH(Number(e.target.value))}
                          style={{ width: '100%', accentColor: '#6366f1' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Contrast & Theme Environment */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-md)', padding: '14px 16px' }}>
                  <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 750, color: '#1e293b', marginBottom: '8px' }}>
                    Kontras &amp; Latar Belakang
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                      { id: 'light', label: 'Light Clean', icon: 'fa-sun' },
                      { id: 'dark', label: 'Dark Studio', icon: 'fa-moon' },
                      { id: 'grid', label: 'Precision Grid', icon: 'fa-border-all' },
                    ].map((th) => (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => setLabTheme(th.id as any)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 'var(--ptv-curve-xs)',
                          border: labTheme === th.id ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                          background: labTheme === th.id ? '#0f172a' : '#ffffff',
                          color: labTheme === th.id ? '#ffffff' : '#334155',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <i className={`fa-solid ${th.icon}`} style={{ marginRight: '5px' }} />
                        {th.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Nested Inset Slider */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-md)', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label htmlFor="lab-nested-slider" style={{ fontSize: '12.5px', fontWeight: 750, color: '#1e293b' }}>
                      Nested Inset Padding (p)
                    </label>
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#d97706', fontFamily: 'var(--ptv-font-mono)' }}>
                      {labNestedInset}px (R_inner: {innerR}px)
                    </span>
                  </div>
                  <input
                    id="lab-nested-slider"
                    type="range"
                    min="6"
                    max="26"
                    step="2"
                    value={labNestedInset}
                    onChange={(e) => setLabNestedInset(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#d97706', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Menguji keselarasan kontur konsentris elemen anak di dalam komponen.
                  </span>
                </div>

                {/* 6. Inspection Zoom & Display Mode */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-md)', padding: '14px 16px' }}>
                  <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 750, color: '#1e293b', marginBottom: '8px' }}>
                    Inspeksi Visual &amp; Zoom Sudut
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setLabInspectMode('side-by-side')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--ptv-curve-xs)',
                        border: labInspectMode === 'side-by-side' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                        background: labInspectMode === 'side-by-side' ? '#eff6ff' : '#ffffff',
                        color: labInspectMode === 'side-by-side' ? '#1d4ed8' : '#475569',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Berdampingan
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabInspectMode('zoomed-overlay')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--ptv-curve-xs)',
                        border: labInspectMode === 'zoomed-overlay' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                        background: labInspectMode === 'zoomed-overlay' ? '#eff6ff' : '#ffffff',
                        color: labInspectMode === 'zoomed-overlay' ? '#1d4ed8' : '#475569',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Macro Overlay Sudut
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {[
                      { z: 1, label: '1× Normal' },
                      { z: 4, label: '4× Zoom' },
                      { z: 8, label: '8× Zoom' },
                      { z: 16, label: '16× Macro' },
                    ].map((item) => (
                      <button
                        key={item.z}
                        type="button"
                        onClick={() => setLabZoom(item.z as any)}
                        style={{
                          flex: 1,
                          padding: '3px 4px',
                          borderRadius: 'var(--ptv-curve-xs)',
                          border: labZoom === item.z ? '1px solid #0f172a' : '1px solid #e2e8f0',
                          background: labZoom === item.z ? '#0f172a' : '#ffffff',
                          color: labZoom === item.z ? '#ffffff' : '#475569',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── 0.3 Mathematical Profile & Live Curvature Metrics ── */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--ptv-curve-lg)',
                padding: '16px 20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                  <i className="fa-solid fa-square-root-variable" style={{ color: '#059669', marginRight: '6px' }} />
                  Definisi Matematis Prototipe C: Gabriel Lamé Superellipse (1818)
                </div>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 'var(--ptv-curve-sm)',
                    padding: '10px 14px',
                    fontFamily: 'var(--ptv-font-mono)',
                    fontSize: '11.5px',
                    color: '#334155',
                    lineHeight: 1.6,
                  }}
                >
                  <div><b>Persamaan Kartesian:</b> |x/R|^n + |y/R|^n = 1</div>
                  <div><b>Parametrik Sudut Kuadran:</b></div>
                  <div>x(t) = R · (1 - cos^(2/n)(t))</div>
                  <div>y(t) = R · (1 - sin^(2/n)(t)), t ∈ [0, π/2]</div>
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px', lineHeight: 1.4 }}>
                  <b>Catatan Independensi:</b> Profil prototipe C adalah formulasi Lamé Superellipse terdokumentasi (1818). <i>Tidak diklaim identik dengan kurva berpemilik (proprietary) Apple iOS/macOS yang menggunakan continuous cubic Bézier splines berpemilik.</i>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                  <i className="fa-solid fa-chart-line" style={{ color: '#2563eb', marginRight: '6px' }} />
                  Pengukuran Diagonal &amp; Fullness Sudut Real-time (45°)
                </div>
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 'var(--ptv-curve-sm)',
                    padding: '10px 14px',
                    fontSize: '12px',
                    color: '#1e40af',
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Jarak diagonal lingkaran murni ke origin (d_circle):</span>
                    <b>{dCircle.toFixed(2)} px</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Jarak diagonal superellipse ke origin (d_super):</span>
                    <b>{dSuper.toFixed(2)} px</b>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderTop: '1px dashed #93c5fd',
                      marginTop: '4px',
                      paddingTop: '4px',
                      color: '#0f172a',
                    }}
                  >
                    <span><b>Pergeseran sudut (Δd = d_circle - d_super):</b></span>
                    <b style={{ color: '#059669' }}>
                      {deltaD > 0 ? `+${deltaD.toFixed(2)} px lebih dekat ke sudut box` : `${deltaD.toFixed(2)} px`}
                    </b>
                  </div>
                </div>
                <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                  Nilai positif Δd membuktikan secara empiris bahwa superellipse tidak &quot;tercekik&quot; (pinched) di titik diagonal 45° seperti busur lingkaran circular.
                </span>
              </div>
            </div>

            {/* SVG Defs for reusable superellipse clipPath */}
            <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
              <defs>
                <clipPath id="lab-superellipse-outer-clip" clipPathUnits="userSpaceOnUse">
                  <path d={outerSuperPath} />
                </clipPath>
                <clipPath id="lab-superellipse-inner-clip" clipPathUnits="userSpaceOnUse">
                  <path d={innerSuperPath} />
                </clipPath>
              </defs>
            </svg>

            {/* Action notification toast */}
            {labActionMessage && (
              <div
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: 'var(--ptv-curve-md)',
                  fontSize: '12px',
                  fontWeight: 600,
                  alignSelf: 'center',
                }}
              >
                {labActionMessage}
              </div>
            )}

            {/* ── 0.4 The Three Side-by-Side Components ── */}
            {labInspectMode === 'side-by-side' && (
              <div
                style={{
                  background: themeContainerBg,
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 'var(--ptv-curve-xl)',
                  padding: '30px 20px',
                  position: 'relative',
                  overflowX: 'auto',
                  backgroundImage:
                    labTheme === 'grid'
                      ? 'radial-gradient(#2563eb 0.75px, transparent 0.75px), radial-gradient(#94a3b8 0.5px, #f8fafc 0.5px)'
                      : undefined,
                  backgroundSize: labTheme === 'grid' ? '20px 20px, 5px 5px' : undefined,
                  backgroundPosition: labTheme === 'grid' ? '0 0, 10px 10px' : undefined,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '24px',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                  }}
                >
                  {/* ══════════════════════════════════════════════════════ */}
                  {/* ── KOMPONEN A: Standard CSS border-radius ─────────── */}
                  {/* ══════════════════════════════════════════════════════ */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 'var(--ptv-curve-pill)',
                          background: '#dbeafe',
                          color: '#1d4ed8',
                          fontSize: '11px',
                          fontWeight: 800,
                        }}
                      >
                        Komponen A: Standard border-radius
                      </span>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        Native CSS <code>border-radius: {labRadius}px</code> (Circular Arc, n=2.0)
                      </div>
                    </div>

                    {/* Card A Element */}
                    <div
                      style={{
                        width: `${labW}px`,
                        height: `${labH}px`,
                        borderRadius: `${labRadius}px`,
                        border: `1.5px solid ${themeCardBorder}`,
                        background: themeCardBg,
                        color: themeCardText,
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)',
                        padding: `${labNestedInset}px`,
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transform: labZoom > 1 ? `scale(${labZoom})` : undefined,
                        transformOrigin: 'top left',
                        transition: 'transform 0.15s ease',
                      }}
                    >
                      {/* Card Content Header */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: 800 }}>Kamera Sony FX3</span>
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '9999px',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontWeight: 700,
                            }}
                          >
                            Tersedia
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: themeCardMuted, marginTop: '2px' }}>
                          INV-CAM-001 • Standard CSS Circle
                        </div>
                      </div>

                      {/* Nested Inset Child */}
                      <div
                        style={{
                          height: `${innerH}px`,
                          borderRadius: `${innerR}px`,
                          border: `1px solid ${themeInnerCardBorder}`,
                          background: themeInnerCardBg,
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxSizing: 'border-box',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '10px', color: themeCardMuted }}>Concentric Inner Child</div>
                          <div style={{ fontSize: '12px', fontWeight: 750 }}>R_inner = {innerR}px</div>
                        </div>
                        <i className="fa-solid fa-circle-check" style={{ color: '#2563eb' }} />
                      </div>

                      {/* Card Bottom Footer */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: themeCardMuted }}>
                          Rp 750.000 / hari
                        </span>
                        <button
                          type="button"
                          onClick={() => setLabActionMessage('Tombol Komponen A diklik.')}
                          style={{
                            padding: '5px 12px',
                            borderRadius: `${Math.max(6, labRadius - 12)}px`,
                            border: '1px solid #2563eb',
                            background: '#2563eb',
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Pilih (A)
                        </button>
                      </div>
                    </div>

                    <div style={{ maxWidth: `${labW}px`, fontSize: '11.5px', color: '#64748b', textAlign: 'center' }}>
                      <i className="fa-solid fa-circle-info" style={{ marginRight: '4px' }} />
                      Curvature berubah seketika dari 0 ke 1/R di titik tangent ($G^1$ kontinu, $G^2$ diskontinu).
                    </div>
                  </div>

                  {/* ══════════════════════════════════════════════════════ */}
                  {/* ── KOMPONEN B: Native CSS corner-shape: squircle ─── */}
                  {/* ══════════════════════════════════════════════════════ */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 'var(--ptv-curve-pill)',
                          background: '#fef3c7',
                          color: '#92400e',
                          fontSize: '11px',
                          fontWeight: 800,
                        }}
                      >
                        Komponen B: CSS corner-shape (Draft)
                      </span>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        <code>corner-shape: squircle</code> (
                        {isSquircleSupported ? (
                          <span style={{ color: '#15803d', fontWeight: 700 }}>Aktif</span>
                        ) : (
                          <span style={{ color: '#b91c1c', fontWeight: 700 }}>Fallback ke Circle</span>
                        )}
                        )
                      </div>
                    </div>

                    {/* Card B Element */}
                    <div
                      style={{
                        width: `${labW}px`,
                        height: `${labH}px`,
                        borderRadius: `${labRadius}px`,
                        // @ts-expect-error CSS draft property
                        cornerShape: 'squircle',
                        WebkitCornerShape: 'squircle',
                        border: `1.5px solid ${themeCardBorder}`,
                        background: themeCardBg,
                        color: themeCardText,
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)',
                        padding: `${labNestedInset}px`,
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transform: labZoom > 1 ? `scale(${labZoom})` : undefined,
                        transformOrigin: 'top left',
                        transition: 'transform 0.15s ease',
                      }}
                    >
                      {/* Card Content Header */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: 800 }}>Lensa FE 24-70mm GM</span>
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '9999px',
                              background: '#fef3c7',
                              color: '#92400e',
                              fontWeight: 700,
                            }}
                          >
                            {isSquircleSupported ? 'Squircle' : 'Fallback Circle'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: themeCardMuted, marginTop: '2px' }}>
                          INV-LNS-002 • CSS WG Level 4 Draft
                        </div>
                      </div>

                      {/* Nested Inset Child */}
                      <div
                        style={{
                          height: `${innerH}px`,
                          borderRadius: `${innerR}px`,
                          // @ts-expect-error CSS draft property
                          cornerShape: 'squircle',
                          WebkitCornerShape: 'squircle',
                          border: `1px solid ${themeInnerCardBorder}`,
                          background: themeInnerCardBg,
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxSizing: 'border-box',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '10px', color: themeCardMuted }}>Concentric Inner Child</div>
                          <div style={{ fontSize: '12px', fontWeight: 750 }}>
                            {isSquircleSupported ? 'Squircle Inset' : `Fallback R=${innerR}px`}
                          </div>
                        </div>
                        <i className="fa-solid fa-shapes" style={{ color: '#d97706' }} />
                      </div>

                      {/* Card Bottom Footer */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: themeCardMuted }}>
                          Rp 350.000 / hari
                        </span>
                        <button
                          type="button"
                          onClick={() => setLabActionMessage('Tombol Komponen B diklik.')}
                          style={{
                            padding: '5px 12px',
                            borderRadius: `${Math.max(6, labRadius - 12)}px`,
                            border: '1px solid #d97706',
                            background: '#d97706',
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Pilih (B)
                        </button>
                      </div>
                    </div>

                    <div style={{ maxWidth: `${labW}px`, fontSize: '11.5px', color: '#64748b', textAlign: 'center' }}>
                      <i className="fa-solid fa-triangle-exclamation" style={{ color: '#d97706', marginRight: '4px' }} />
                      {isSquircleSupported
                        ? 'Browser mendukung native squircle.'
                        : 'Engine saat ini tidak mengenali corner-shape, merender identik 100% dengan Komponen A.'}
                    </div>
                  </div>

                  {/* ══════════════════════════════════════════════════════ */}
                  {/* ── KOMPONEN C: Custom Mathematically Defined Superellipse */}
                  {/* ══════════════════════════════════════════════════════ */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 'var(--ptv-curve-pill)',
                          background: '#dcfce7',
                          color: '#15803d',
                          fontSize: '11px',
                          fontWeight: 800,
                        }}
                      >
                        Komponen C: Custom Superellipse (Lamé)
                      </span>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        Continuous Curvature <code>n = {labSmoothing.toFixed(1)}</code> (Fullness: +{deltaD.toFixed(1)}px)
                      </div>
                    </div>

                    {/* Card C Wrapper with Filter Drop-Shadow */}
                    <div
                      style={{
                        width: `${labW}px`,
                        height: `${labH}px`,
                        position: 'relative',
                        filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.08)) drop-shadow(0 4px 6px rgba(0,0,0,0.04))',
                        transform: labZoom > 1 ? `scale(${labZoom})` : undefined,
                        transformOrigin: 'top left',
                        transition: 'transform 0.15s ease',
                      }}
                    >
                      {/* SVG Background Path (Fill & Stroke) */}
                      <svg
                        width={labW}
                        height={labH}
                        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                      >
                        <path
                          d={outerSuperPath}
                          fill={themeCardBg}
                          stroke={themeCardBorder}
                          strokeWidth={1.5}
                        />
                      </svg>

                      {/* Foreground Clipped Content */}
                      <div
                        style={{
                          width: `${labW}px`,
                          height: `${labH}px`,
                          clipPath: 'url(#lab-superellipse-outer-clip)',
                          padding: `${labNestedInset}px`,
                          boxSizing: 'border-box',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          color: themeCardText,
                          position: 'relative',
                          zIndex: 2,
                        }}
                      >
                        {/* Card Content Header */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 800 }}>Audio Mic Wireless DJI</span>
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '9999px',
                                background: '#dcfce7',
                                color: '#15803d',
                                fontWeight: 700,
                              }}
                            >
                              True Squircle (n={labSmoothing.toFixed(1)})
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: themeCardMuted, marginTop: '2px' }}>
                            INV-MIC-003 • True Continuous Squircle
                          </div>
                        </div>

                        {/* Nested Inset Child using Inner Superellipse */}
                        <div
                          style={{
                            width: `${innerW}px`,
                            height: `${innerH}px`,
                            position: 'relative',
                            boxSizing: 'border-box',
                          }}
                        >
                          <svg
                            width={innerW}
                            height={innerH}
                            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                          >
                            <path
                              d={innerSuperPath}
                              fill={themeInnerCardBg}
                              stroke={themeInnerCardBorder}
                              strokeWidth={1}
                            />
                          </svg>
                          <div
                            style={{
                              width: `${innerW}px`,
                              height: `${innerH}px`,
                              clipPath: 'url(#lab-superellipse-inner-clip)',
                              padding: '8px 10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              boxSizing: 'border-box',
                              position: 'relative',
                              zIndex: 1,
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '10px', color: themeCardMuted }}>Concentric Superellipse Child</div>
                              <div style={{ fontSize: '12px', fontWeight: 750 }}>
                                R_inner = {innerR}px (n={labSmoothing.toFixed(1)})
                              </div>
                            </div>
                            <i className="fa-solid fa-sparkles" style={{ color: '#059669' }} />
                          </div>
                        </div>

                        {/* Card Bottom Footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: themeCardMuted }}>
                            Rp 250.000 / hari
                          </span>
                          <button
                            type="button"
                            onClick={() => setLabActionMessage('Tombol Komponen C diklik.')}
                            style={{
                              padding: '5px 12px',
                              borderRadius: `${Math.max(6, labRadius - 12)}px`,
                              border: '1px solid #059669',
                              background: '#059669',
                              color: '#ffffff',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Pilih (C)
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ maxWidth: `${labW}px`, fontSize: '11.5px', color: '#64748b', textAlign: 'center' }}>
                      <i className="fa-solid fa-circle-check" style={{ color: '#059669', marginRight: '4px' }} />
                      Kontur melengkung secara bertahap dan mengisi area diagonal tanpa pinched radius.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 0.5 Macro Corner Zoom & Tangent Analysis Tool ── */}
            {(labInspectMode === 'zoomed-overlay' || labZoom > 1) && (
              <div
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 'var(--ptv-curve-xl)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                      <i className="fa-solid fa-magnifying-glass-plus" style={{ color: '#2563eb', marginRight: '8px' }} />
                      Inspeksi Makro Sudut: Superimposed Tangent Overlay ({labZoom}× Zoom)
                    </h3>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                      Membandingkan lintasan geometri sudut Top-Left pada titik origin (0,0) untuk melihat perbedaan tangensial secara mikroskopis.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: 700 }}>
                      <i className="fa-solid fa-circle" style={{ fontSize: '9px', marginRight: '4px' }} />
                      A: Circle (n=2.0)
                    </span>
                    <span style={{ fontSize: '11.5px', color: '#d97706', fontWeight: 700 }}>
                      <i className="fa-solid fa-circle" style={{ fontSize: '9px', marginRight: '4px' }} />
                      B: Actual Engine
                    </span>
                    <span style={{ fontSize: '11.5px', color: '#059669', fontWeight: 700 }}>
                      <i className="fa-solid fa-circle" style={{ fontSize: '9px', marginRight: '4px' }} />
                      C: Superellipse (n={labSmoothing.toFixed(1)})
                    </span>
                  </div>
                </div>

                {/* Macro Canvas Viewport */}
                <div
                  style={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: 'var(--ptv-curve-lg)',
                    padding: '20px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {(() => {
                    const canvasSize = 320;
                    const scaleFactor = (canvasSize / (labRadius * 2.2)) * (labZoom === 1 ? 1 : labZoom / 2);
                    const R_scaled = labRadius * scaleFactor;
                    const cx = 30;
                    const cy = 30;

                    // Superellipse points for TL corner
                    const superPoints: { x: number; y: number }[] = [];
                    const steps = 40;
                    for (let i = 0; i <= steps; i++) {
                      const t = (Math.PI / 2) * (i / steps);
                      const sx = cx + R_scaled * (1 - Math.pow(Math.cos(t), 2 / labSmoothing));
                      const sy = cy + R_scaled * (1 - Math.pow(Math.sin(t), 2 / labSmoothing));
                      superPoints.push({ x: sx, y: sy });
                    }
                    let superD = `M ${cx} ${cy + R_scaled + 40} L ${cx} ${cy + R_scaled}`;
                    for (const pt of superPoints) {
                      superD += ` L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
                    }
                    superD += ` L ${cx + R_scaled + 40} ${cy}`;

                    // Circular arc points for TL corner
                    const circleD = `M ${cx} ${cy + R_scaled + 40} L ${cx} ${cy + R_scaled} A ${R_scaled} ${R_scaled} 0 0 1 ${cx + R_scaled} ${cy} L ${cx + R_scaled + 40} ${cy}`;

                    // Midpoint 45 deg
                    const circleMidX = cx + R_scaled * (1 - Math.SQRT1_2);
                    const circleMidY = cy + R_scaled * (1 - Math.SQRT1_2);
                    const superMidX = cx + R_scaled * (1 - Math.pow(0.5, 1 / labSmoothing));
                    const superMidY = cy + R_scaled * (1 - Math.pow(0.5, 1 / labSmoothing));

                    return (
                      <svg width={canvasSize + 60} height={canvasSize + 60} style={{ overflow: 'visible' }}>
                        {/* Grid lines */}
                        <defs>
                          <pattern id="macro-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="1" />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#macro-grid)" />

                        {/* Tangent bounding box lines */}
                        <line x1={cx} y1="0" x2={cx} y2={canvasSize + 60} stroke="#334155" strokeWidth="1.5" strokeDasharray="4 4" />
                        <line x1="0" y1={cy} x2={canvasSize + 60} y2={cy} stroke="#334155" strokeWidth="1.5" strokeDasharray="4 4" />

                        {/* Tangent contact markers */}
                        <circle cx={cx} cy={cy + R_scaled} r="4" fill="#38bdf8" />
                        <text x={cx + 10} y={cy + R_scaled + 4} fill="#94a3b8" fontSize="11" fontFamily="var(--ptv-font-mono)">
                          T1 (0, R)
                        </text>
                        <circle cx={cx + R_scaled} cy={cy} r="4" fill="#38bdf8" />
                        <text x={cx + R_scaled - 15} y={cy - 10} fill="#94a3b8" fontSize="11" fontFamily="var(--ptv-font-mono)">
                          T2 (R, 0)
                        </text>

                        {/* Curve A: Circular Arc (Blue) */}
                        <path d={circleD} fill="none" stroke="#2563eb" strokeWidth="3" />

                        {/* Curve B: Engine Actual (Amber dashed) */}
                        <path
                          d={isSquircleSupported ? superD : circleD}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="2"
                          strokeDasharray="5 3"
                        />

                        {/* Curve C: Superellipse (Emerald) */}
                        <path d={superD} fill="none" stroke="#10b981" strokeWidth="3.5" />

                        {/* 45 degree diagonal ray */}
                        <line x1={cx} y1={cy} x2={cx + R_scaled} y2={cy + R_scaled} stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />

                        {/* Midpoint markers */}
                        <circle cx={circleMidX} cy={circleMidY} r="4.5" fill="#2563eb" />
                        <circle cx={superMidX} cy={superMidY} r="4.5" fill="#10b981" />

                        {/* Delta indicator line */}
                        <line x1={circleMidX} y1={circleMidY} x2={superMidX} y2={superMidY} stroke="#f43f5e" strokeWidth="2.5" />

                        {/* Label callouts */}
                        <text x={superMidX - 18} y={superMidY - 14} fill="#34d399" fontSize="11" fontWeight="bold" fontFamily="var(--ptv-font-mono)">
                          C: Superellipse (Fuller)
                        </text>
                        <text x={circleMidX + 10} y={circleMidY + 18} fill="#60a5fa" fontSize="11" fontWeight="bold" fontFamily="var(--ptv-font-mono)">
                          A: Circle (Pinched)
                        </text>
                        <text x={superMidX + 14} y={superMidY - 2} fill="#fb7185" fontSize="11" fontWeight="bold" fontFamily="var(--ptv-font-mono)">
                          Δd = +{deltaD.toFixed(2)}px
                        </text>
                      </svg>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ── 0.6 Real Render Validation & Engineering Consequences Table ── */}
            <div
              style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: 'var(--ptv-curve-xl)',
                padding: '24px',
              }}
            >
              <h3 style={{ fontSize: '17px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0' }}>
                Evaluasi Kritis &amp; Konsekuensi Teknis Nyata pada Browser Engine
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Tabel audit perbandingan menyeluruh antara standard CSS circular radius, native CSS draft squircle, dan custom superellipse SVG clip-path.
              </p>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 12px', color: '#334155', fontWeight: 800 }}>Aspek Evaluasi</th>
                      <th style={{ padding: '10px 12px', color: '#1d4ed8', fontWeight: 800 }}>A. Standard border-radius</th>
                      <th style={{ padding: '10px 12px', color: '#92400e', fontWeight: 800 }}>B. Native corner-shape (Draft)</th>
                      <th style={{ padding: '10px 12px', color: '#15803d', fontWeight: 800 }}>C. Custom Superellipse (Lamé)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>Kontinuitas Garis &amp; Tangent</td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>
                        $G^1$ kontinu, namun curvature $\kappa$ melompat seketika dari 0 ke $1/R$ ($G^2$ diskontinu, efek &quot;sudut di dalam sudut&quot;).
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>
                        Secara spesifikasi $G^2$ kontinu. Namun di browser nyata saat ini identik dengan A karena fallback.
                      </td>
                      <td style={{ padding: '10px 12px', color: '#15803d', fontWeight: 600 }}>
                        Continuous smoothing matematis. Curvature bertransisi halus dari sisi lurus tanpa patahan optis.
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>Kompatibilitas Box Shadow</td>
                      <td style={{ padding: '10px 12px', color: '#15803d', fontWeight: 600 }}>
                        Sangat baik. Native CSS <code>box-shadow</code> (blur + spread) diakselerasi penuh GPU.
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>
                        Native CSS <code>box-shadow</code> mengikuti bentuk fallback border-radius.
                      </td>
                      <td style={{ padding: '10px 12px', color: '#b91c1c' }}>
                        <b>Perhatian Teknis:</b> CSS <code>box-shadow</code> standar terpotong kotak oleh <code>clip-path</code>. Wajib menggunakan <code>filter: drop-shadow()</code> (tidak memiliki parameter spread).
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>Rendering Border / Outline</td>
                      <td style={{ padding: '10px 12px', color: '#15803d', fontWeight: 600 }}>
                        Native CSS <code>border</code> dan <code>outline</code> bekerja sempurna.
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>
                        Native CSS <code>border</code> bekerja sempurna pada fallback.
                      </td>
                      <td style={{ padding: '10px 12px', color: '#b91c1c' }}>
                        <b>Perhatian Teknis:</b> CSS <code>border</code> terpotong oleh clip-path. Border harus digambar sebagai stroke SVG atau pseudo-element terpisah.
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>Clipping Konten &amp; Overflow</td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>
                        <code>overflow: hidden</code> memotong isi sesuai radius standar.
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>
                        Sama dengan standar A.
                      </td>
                      <td style={{ padding: '10px 12px', color: '#d97706' }}>
                        Menggunakan <code>clip-path</code> SVG. Memotong gambar dan background dengan presisi squircle.
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>Dropdown &amp; Popover Terbuka</td>
                      <td style={{ padding: '10px 12px', color: '#15803d', fontWeight: 600 }}>
                        Aman jika menu menggunakan fixed/portal atau in-flow dropdown tanpa overflow hidden.
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>
                        Sama dengan standar A.
                      </td>
                      <td style={{ padding: '10px 12px', color: '#b91c1c' }}>
                        <b>Kritikal:</b> Komponen berkas dengan <code>clip-path</code> akan memenggal (slice) menu popup atau tooltip jika tidak dirender via React Portal ke <code>document.body</code>.
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>Performa GPU &amp; Scroll</td>
                      <td style={{ padding: '10px 12px', color: '#15803d', fontWeight: 600 }}>
                        0 ms overhead. Diakselerasi GPU di level layer compositor.
                      </td>
                      <td style={{ padding: '10px 12px', color: '#15803d', fontWeight: 600 }}>
                        0 ms overhead.
                      </td>
                      <td style={{ padding: '10px 12px', color: '#d97706' }}>
                        Ada overhead kalkulasi SVG path saat resize dinamis. Aman untuk 10–20 kartu, tidak disarankan untuk 500+ baris tabel sekaligus.
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>Cross-Browser Compatibility</td>
                      <td style={{ padding: '10px 12px', color: '#15803d', fontWeight: 600 }}>
                        100% konsisten di seluruh browser (Chrome, Safari, Edge, Firefox, iOS, Android).
                      </td>
                      <td style={{ padding: '10px 12px', color: '#b91c1c' }}>
                        0% didukung saat ini (seluruh browser stabil saat ini mengevaluasi false).
                      </td>
                      <td style={{ padding: '10px 12px', color: '#15803d', fontWeight: 600 }}>
                        100% didukung via SVG / CSS clip-path di semua browser modern.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── 0.7 Safe vs Unsafe Component Classification Matrix ── */}
            <div
              style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: 'var(--ptv-curve-xl)',
                padding: '24px',
              }}
            >
              <h3 style={{ fontSize: '17px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0' }}>
                Matriks Klasifikasi Komponen: Aman vs Tidak Aman untuk True Smoothing
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
                Panduan arsitektur wajib sebelum mempertimbangkan penerapan smoothing pada modul Hub manapun.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {/* Safe List */}
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1.5px solid #bbf7d0',
                    borderRadius: 'var(--ptv-curve-lg)',
                    padding: '16px 20px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <i className="fa-solid fa-circle-check" style={{ color: '#16a34a', fontSize: '16px' }} />
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#166534' }}>
                      KOMPONEN AMAN (Safe for Superellipse Smoothing)
                    </span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: '#14532d', lineHeight: 1.6 }}>
                    <li><b>Hero &amp; Bento Metric Cards:</b> Kartu berdimensi tetap tanpa overflow scrollbars (`.ptv-nilai-card`, `.card`).</li>
                    <li><b>Modal Dialog Containers:</b> Window pop-up terpusat dengan ukuran tetap (`.modal-box`).</li>
                    <li><b>Media Thumbnails &amp; Avatars:</b> Gambar alat, cover foto, dan avatar pengguna.</li>
                    <li><b>Dossier Spec Panels:</b> Panel ringkasan data inventaris yang bersifat read-only.</li>
                  </ul>
                  <div style={{ fontSize: '11px', color: '#15803d', marginTop: '10px' }}>
                    &rarr; Komponen ini aman karena tidak memiliki text-selection input atau scrollable dropdowns di dalamnya.
                  </div>
                </div>

                {/* Unsafe List */}
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1.5px solid #fecaca',
                    borderRadius: 'var(--ptv-curve-lg)',
                    padding: '16px 20px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <i className="fa-solid fa-circle-xmark" style={{ color: '#dc2626', fontSize: '16px' }} />
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#991b1b' }}>
                      KOMPONEN TIDAK AMAN (Wajib Mempertahankan Standard CSS)
                    </span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: '#7f1d1d', lineHeight: 1.6 }}>
                    <li><b>Input Form &amp; Textarea:</b> Native cursor kursor caret, IME composition, dan focus outline rusak jika di-clip.</li>
                    <li><b>Trigger &amp; Menu PTVSelect:</b> Floating listbox akan terpotong batas jika tidak di-portal.</li>
                    <li><b>Data Tables &amp; Virtualized Lists:</b> Ratusan sel tabel akan mengalami degradasi framerate jika di-clip SVG per baris.</li>
                    <li><b>Toast Notifications &amp; Tooltips:</b> Memerlukan rendering cepat dan dinamis tanpa overhead kalkulasi path.</li>
                    <li><b>Mobile Bottom Dock:</b> Menggunakan CSS standard agar gesture dan backdrop-filter native iOS/Android tetap mulus.</li>
                  </ul>
                  <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '10px' }}>
                    &rarr; Komponen ini WAJIB tetap menggunakan standard CSS <code>border-radius</code> (`var(--ptv-curve-*)`).
                  </div>
                </div>
              </div>
            </div>

            {/* ── 0.8 Architectural Recommendation ── */}
            <div
              style={{
                background: '#eff6ff',
                border: '1.5px solid #bfdbfe',
                borderRadius: 'var(--ptv-curve-xl)',
                padding: '20px 24px',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e3a8a', marginBottom: '6px' }}>
                <i className="fa-solid fa-compass" style={{ marginRight: '8px' }} />
                Rekomendasi Arsitektur Final untuk PTV PRO Hub
              </div>
              <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#1e40af', lineHeight: 1.6 }}>
                <li>
                  <b>Pertahankan Token CSS Global:</b> Tetap gunakan skala token `--ptv-curve-*` sebagai pondasi universal di seluruh CSS produksi Hub.
                </li>
                <li>
                  <b>Jangan Terapkan SVG Clip-Path Global:</b> Jangan mengganti seluruh CSS `border-radius` dengan SVG clip-path di ratusan selector secara membabi buta karena akan mematahkan border, shadow, dan form input.
                </li>
                <li>
                  <b>Gunakan Wrapper Terisolasi Jika Disetujui:</b> Jika True Smoothing ingin diaktifkan, buat komponen pembungkus khusus (misal <code>&lt;PTVSquircleCard&gt;</code>) hanya untuk kartu dashboard utama dan modal, dengan border SVG stroke dan drop-shadow terintegrasi.
                </li>
                <li>
                  <b>Konfirmasi Pengguna:</b> Sesuai batasan, implementasi smoothing TIDAK AKAN diterapkan ke UI produksi sampai pengguna meninjau dan menyetujui prototipe visual ini.
                </li>
              </ol>
            </div>
          </div>
        );
      })()}
      {/* ── TAB 1: CORNER SUPERIMPOSED OVERLAY & NORMALIZED VALIDATION ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overlay' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Sub-mode Navigation Pill Bar */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--ptv-curve-lg)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setOverlayMode('outline')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--ptv-curve-sm)',
                  border: overlayMode === 'outline' ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                  background: overlayMode === 'outline' ? '#0f172a' : '#ffffff',
                  color: overlayMode === 'outline' ? '#ffffff' : '#334155',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-border-top-left" style={{ marginRight: '6px' }} />
                Mode 1: Outline-Only Origin Overlay
              </button>
              <button
                type="button"
                onClick={() => setOverlayMode('normalized')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--ptv-curve-sm)',
                  border: overlayMode === 'normalized' ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                  background: overlayMode === 'normalized' ? '#0f172a' : '#ffffff',
                  color: overlayMode === 'normalized' ? '#ffffff' : '#334155',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-scale-balanced" style={{ marginRight: '6px' }} />
                Mode 2: Normalized Curve Comparison (Scale 1:1)
              </button>
              <button
                type="button"
                onClick={() => setOverlayMode('empirical')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--ptv-curve-sm)',
                  border: overlayMode === 'empirical' ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                  background: overlayMode === 'empirical' ? '#0f172a' : '#ffffff',
                  color: overlayMode === 'empirical' ? '#ffffff' : '#334155',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-flask" style={{ marginRight: '6px' }} />
                Mode 3: Empirical Browser Rendering vs. Theory
              </button>
            </div>

            {/* Magnification / Zoom Control */}
            {overlayMode === 'outline' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Zoom Sudut:</span>
                {([1, 2, 3] as const).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoomLevel(z)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 'var(--ptv-curve-xs)',
                      border: zoomLevel === z ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      background: zoomLevel === z ? '#eff6ff' : '#ffffff',
                      color: zoomLevel === z ? '#1d4ed8' : '#475569',
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    {z}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── SUB-MODE 1: OUTLINE-ONLY CORNER OVERLAY ── */}
          {overlayMode === 'outline' && (
            <div
              style={{
                background: '#090d16',
                borderRadius: 'var(--ptv-curve-2xl)',
                padding: '28px 24px',
                color: '#ffffff',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}
            >
              {/* Header & Legends */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Outline Precision Gauge (Origin 0,0 Aligned)
                  </span>
                  <h3 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 900 }}>
                    Lintasan Kurva Nyata Tanpa Fill Obscuring
                  </h3>
                </div>

                {/* Layer Toggles & Colors */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11.5px' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={visibleLayers.control}
                      onChange={(e) => setVisibleLayers({ ...visibleLayers, control: e.target.checked })}
                    />
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8' }} />
                    <span style={{ color: '#e2e8f0' }}>Control (12px)</span>
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={visibleLayers.panel}
                      onChange={(e) => setVisibleLayers({ ...visibleLayers, panel: e.target.checked })}
                    />
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#c084fc' }} />
                    <span style={{ color: '#e2e8f0' }}>Panel (16px)</span>
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={visibleLayers.card}
                      onChange={(e) => setVisibleLayers({ ...visibleLayers, card: e.target.checked })}
                    />
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#34d399' }} />
                    <span style={{ color: '#e2e8f0' }}>Card (22px)</span>
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={visibleLayers.modal}
                      onChange={(e) => setVisibleLayers({ ...visibleLayers, modal: e.target.checked })}
                    />
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fbbf24' }} />
                    <span style={{ color: '#e2e8f0' }}>Modal (28px)</span>
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={visibleLayers.drawer}
                      onChange={(e) => setVisibleLayers({ ...visibleLayers, drawer: e.target.checked })}
                    />
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fb7185' }} />
                    <span style={{ color: '#e2e8f0' }}>Drawer (34px)</span>
                  </label>
                </div>
              </div>

              {/* Stack Offset Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', fontSize: '12px', color: '#94a3b8' }}>
                <span>Offset Pemisahan Sumbu Diagonal:</span>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={offsetShift}
                  onChange={(e) => setOffsetShift(Number(e.target.value))}
                  style={{ width: '140px', accentColor: '#38bdf8' }}
                />
                <span style={{ fontFamily: 'monospace', color: '#f8fafc' }}>
                  {offsetShift === 0 ? '0px (Superimposed Murni)' : `+${offsetShift}px diagonal offset`}
                </span>
              </div>

              {/* Outline Viewport Stage */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '520px',
                  height: '320px',
                  margin: '0 auto',
                  background: '#0d131f',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--ptv-curve-xl)',
                  overflow: 'hidden',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
                }}
              >
                {/* Precision Pixel Grid Lines */}
                <svg
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                    </pattern>
                    <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                      <rect width="50" height="50" fill="url(#smallGrid)" />
                      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>

                {/* Coordinate Crosshairs at Origin (30, 30) */}
                <div style={{ position: 'absolute', left: '30px', top: '0', bottom: '0', width: '1px', background: 'rgba(255,255,255,0.25)' }} />
                <div style={{ position: 'absolute', top: '30px', left: '0', right: '0', height: '1px', background: 'rgba(255,255,255,0.25)' }} />
                <div style={{ position: 'absolute', left: '34px', top: '34px', fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                  Origin (0,0)
                </div>

                {/* Magnified Container Box with CSS Transform */}
                <div
                  style={{
                    position: 'absolute',
                    left: '30px',
                    top: '30px',
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: '0 0',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  {/* Layer 5: Drawer 34px (Rose) */}
                  {visibleLayers.drawer && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${offsetShift * 4}px`,
                        top: `${offsetShift * 4}px`,
                        width: '260px',
                        height: '200px',
                        borderTop: `${2.5 / zoomLevel}px solid #fb7185`,
                        borderLeft: `${2.5 / zoomLevel}px solid #fb7185`,
                        borderTopLeftRadius: 'var(--ptv-curve-3xl)', /* 34px */
                        background: 'transparent',
                        boxSizing: 'border-box',
                        pointerEvents: 'none',
                      }}
                    >
                      <span style={{ position: 'absolute', right: '8px', top: '4px', fontSize: '9px', color: '#fb7185', fontWeight: 800 }}>
                        Drawer (34px)
                      </span>
                    </div>
                  )}

                  {/* Layer 4: Modal 28px (Amber) */}
                  {visibleLayers.modal && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${offsetShift * 3}px`,
                        top: `${offsetShift * 3}px`,
                        width: '220px',
                        height: '170px',
                        borderTop: `${2.5 / zoomLevel}px solid #fbbf24`,
                        borderLeft: `${2.5 / zoomLevel}px solid #fbbf24`,
                        borderTopLeftRadius: 'var(--ptv-curve-2xl)', /* 28px */
                        background: 'transparent',
                        boxSizing: 'border-box',
                        pointerEvents: 'none',
                      }}
                    >
                      <span style={{ position: 'absolute', right: '8px', top: '4px', fontSize: '9px', color: '#fbbf24', fontWeight: 800 }}>
                        Modal (28px)
                      </span>
                    </div>
                  )}

                  {/* Layer 3: Card 22px (Emerald) */}
                  {visibleLayers.card && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${offsetShift * 2}px`,
                        top: `${offsetShift * 2}px`,
                        width: '180px',
                        height: '140px',
                        borderTop: `${2.5 / zoomLevel}px solid #34d399`,
                        borderLeft: `${2.5 / zoomLevel}px solid #34d399`,
                        borderTopLeftRadius: 'var(--ptv-curve-xl)', /* 22px */
                        background: 'transparent',
                        boxSizing: 'border-box',
                        pointerEvents: 'none',
                      }}
                    >
                      <span style={{ position: 'absolute', right: '8px', top: '4px', fontSize: '9px', color: '#34d399', fontWeight: 800 }}>
                        Card (22px)
                      </span>
                    </div>
                  )}

                  {/* Layer 2: Panel 16px (Purple) */}
                  {visibleLayers.panel && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${offsetShift * 1}px`,
                        top: `${offsetShift * 1}px`,
                        width: '140px',
                        height: '110px',
                        borderTop: `${2.5 / zoomLevel}px solid #c084fc`,
                        borderLeft: `${2.5 / zoomLevel}px solid #c084fc`,
                        borderTopLeftRadius: 'var(--ptv-curve-lg)', /* 16px */
                        background: 'transparent',
                        boxSizing: 'border-box',
                        pointerEvents: 'none',
                      }}
                    >
                      <span style={{ position: 'absolute', right: '8px', top: '4px', fontSize: '9px', color: '#c084fc', fontWeight: 800 }}>
                        Panel (16px)
                      </span>
                    </div>
                  )}

                  {/* Layer 1: Control 12px (Cyan) */}
                  {visibleLayers.control && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '0px',
                        top: '0px',
                        width: '100px',
                        height: '80px',
                        borderTop: `${2.5 / zoomLevel}px solid #38bdf8`,
                        borderLeft: `${2.5 / zoomLevel}px solid #38bdf8`,
                        borderTopLeftRadius: 'var(--ptv-curve-md)', /* 12px */
                        background: 'transparent',
                        boxSizing: 'border-box',
                        pointerEvents: 'none',
                      }}
                    >
                      <span style={{ position: 'absolute', right: '8px', top: '4px', fontSize: '9px', color: '#38bdf8', fontWeight: 800 }}>
                        Control (12px)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Informational Readout */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 'var(--ptv-curve-md)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: '12px',
                  color: '#94a3b8',
                  lineHeight: 1.5,
                }}
              >
                <b style={{ color: '#ffffff' }}>Hasil Pengamatan Visual:</b> Tanpa penutup warna latar (outline-only), garis batas atas dan kiri tiap komponen berimpit sempurna di sisi datar origin (0,0), lalu bertransisi secara bertahap menuju kurvatur masing-masing radius (12px &rarr; 16px &rarr; 22px &rarr; 28px &rarr; 34px). Tidak ditemukan sudut patah atau 'tangent kink' pada titik awal transisi.
              </div>
            </div>
          )}

          {/* ── SUB-MODE 2: NORMALIZED CURVE COMPARISON ── */}
          {overlayMode === 'normalized' && (
            <div
              style={{
                background: '#090d16',
                borderRadius: 'var(--ptv-curve-2xl)',
                padding: '28px 24px',
                color: '#ffffff',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Normalized Geometry Benchmark (Scaled to R = 120px)
                  </span>
                  <h3 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 900 }}>
                    Uji Kesamaan Profil Kurva Lintas Ukuran
                  </h3>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11.5px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8' }} />
                    Control (12px &times; 10.0x)
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#c084fc' }} />
                    Panel (16px &times; 7.5x)
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#34d399' }} />
                    Card (22px &times; 5.45x)
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fbbf24' }} />
                    Modal (28px &times; 4.28x)
                  </span>
                </div>
              </div>

              {/* Separation Gap Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', fontSize: '12px', color: '#94a3b8' }}>
                <span>Jarak Uji Garis Normalisasi:</span>
                <input
                  type="range"
                  min="0"
                  max="12"
                  value={normalizedGap}
                  onChange={(e) => setNormalizedGap(Number(e.target.value))}
                  style={{ width: '140px', accentColor: '#34d399' }}
                />
                <span style={{ fontFamily: 'monospace', color: '#f8fafc' }}>
                  {normalizedGap === 0 ? '0px (Tumpukan Sempurna / Superimposed)' : `+${normalizedGap}px celah pembanding`}
                </span>
              </div>

              {/* Normalized Stage Box */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '520px',
                  height: '340px',
                  margin: '0 auto',
                  background: '#0d131f',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--ptv-curve-xl)',
                  overflow: 'hidden',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
                }}
              >
                {/* Crosshairs & Grid */}
                <div style={{ position: 'absolute', left: '30px', top: '0', bottom: '0', width: '1px', background: 'rgba(255,255,255,0.2)' }} />
                <div style={{ position: 'absolute', top: '30px', left: '0', right: '0', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
                <div style={{ position: 'absolute', left: '34px', top: '34px', fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                  Normalized Origin (0,0) &bull; Target R = 120px
                </div>

                {/* Theoretical Circular Reference Arc (120px) */}
                <svg
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d={generateSuperellipsePath(30, 30, 120, 2.0, 40, 60)}
                    fill="none"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="4"
                    strokeDasharray="4 4"
                  />
                  <text x="160" y="50" fill="rgba(255,255,255,0.3)" fontSize="10" fontFamily="monospace">
                    Busur Lingkaran Standar (n=2, R=120px)
                  </text>
                </svg>

                {/* Layer 4: Modal 28px Normalized (Scale = 120 / 28 ≈ 4.2857) */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${30 + normalizedGap * 3}px`,
                    top: `${30 + normalizedGap * 3}px`,
                    width: '60px',
                    height: '60px',
                    transform: `scale(${120 / 28})`,
                    transformOrigin: '0 0',
                    borderTop: `${2 / (120 / 28)}px solid #fbbf24`,
                    borderLeft: `${2 / (120 / 28)}px solid #fbbf24`,
                    borderTopLeftRadius: 'var(--ptv-curve-2xl)', /* 28px */
                    background: 'transparent',
                    boxSizing: 'border-box',
                    pointerEvents: 'none',
                  }}
                />

                {/* Layer 3: Card 22px Normalized (Scale = 120 / 22 ≈ 5.4545) */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${30 + normalizedGap * 2}px`,
                    top: `${30 + normalizedGap * 2}px`,
                    width: '60px',
                    height: '60px',
                    transform: `scale(${120 / 22})`,
                    transformOrigin: '0 0',
                    borderTop: `${2 / (120 / 22)}px solid #34d399`,
                    borderLeft: `${2 / (120 / 22)}px solid #34d399`,
                    borderTopLeftRadius: 'var(--ptv-curve-xl)', /* 22px */
                    background: 'transparent',
                    boxSizing: 'border-box',
                    pointerEvents: 'none',
                  }}
                />

                {/* Layer 2: Panel 16px Normalized (Scale = 120 / 16 = 7.5) */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${30 + normalizedGap * 1}px`,
                    top: `${30 + normalizedGap * 1}px`,
                    width: '60px',
                    height: '60px',
                    transform: `scale(${120 / 16})`,
                    transformOrigin: '0 0',
                    borderTop: `${2 / (120 / 16)}px solid #c084fc`,
                    borderLeft: `${2 / (120 / 16)}px solid #c084fc`,
                    borderTopLeftRadius: 'var(--ptv-curve-lg)', /* 16px */
                    background: 'transparent',
                    boxSizing: 'border-box',
                    pointerEvents: 'none',
                  }}
                />

                {/* Layer 1: Control 12px Normalized (Scale = 120 / 12 = 10.0) */}
                <div
                  style={{
                    position: 'absolute',
                    left: '30px',
                    top: '30px',
                    width: '60px',
                    height: '60px',
                    transform: `scale(${120 / 12})`,
                    transformOrigin: '0 0',
                    borderTop: `${2 / (120 / 12)}px solid #38bdf8`,
                    borderLeft: `${2 / (120 / 12)}px solid #38bdf8`,
                    borderTopLeftRadius: 'var(--ptv-curve-md)', /* 12px */
                    background: 'transparent',
                    boxSizing: 'border-box',
                    pointerEvents: 'none',
                  }}
                />
              </div>

              {/* Honest Normalized Technical Analysis */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '14px 18px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 'var(--ptv-curve-md)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: '12.5px',
                  color: '#94a3b8',
                  lineHeight: 1.6,
                }}
              >
                <div style={{ color: '#ffffff', fontWeight: 800, marginBottom: '4px' }}>
                  <i className="fa-solid fa-circle-check" style={{ color: '#34d399', marginRight: '6px' }} />
                  Hasil Audit Normalisasi Empiris (One Curve Family Proof)
                </div>
                Ketika keempat elemen CSS aktual di atas diskalakan ke ukuran referensi seragam (R = 120px):
                <ul style={{ margin: '6px 0 8px 18px', padding: 0 }}>
                  <li>
                    <b>Hasil Pengamatan:</b> Garis kurva hasil normalisasi dari Control (12px), Panel (16px), Card (22px), dan Modal (28px) <b>saling berimpit secara identik (overlap sempurna)</b> pada busur referensi.
                  </li>
                  <li>
                    <b>Penyebab Geometris Jujur:</b> Karena engine browser saat ini (Chromium / WebKit default) merender standar CSS <code>border-radius</code> sebagai busur lingkaran kuadran (derajat kurva $n = 2$), setiap kurva memiliki profil geometris yang seragam saat dinormalisasi.
                  </li>
                  <li>
                    <b>Status Sistem:</b> Sistem saat ini merupakan <b>satu keluarga busur lingkaran proporsional harmonis</b> dengan kesiapan progressive enhancement squircle (<code>corner-shape: squircle</code>). Garis normalisasi tidak divergen atau acak.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ── SUB-MODE 3: REAL RENDERING VS. THEORETICAL SQUIRCLE ── */}
          {overlayMode === 'empirical' && (
            <div
              style={{
                background: '#090d16',
                borderRadius: 'var(--ptv-curve-2xl)',
                padding: '28px 24px',
                color: '#ffffff',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Empirical Engine Verification
                  </span>
                  <h3 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 900 }}>
                    Perbandingan Hasil Nyata CSS Browser vs. Rumus Teoretis
                  </h3>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11.5px' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showTheoreticalSquircle}
                      onChange={(e) => setShowTheoreticalSquircle(e.target.checked)}
                    />
                    <span style={{ width: '12px', height: '2px', background: '#fbbf24', display: 'inline-block' }} />
                    <span style={{ color: '#fbbf24', fontWeight: 700 }}>1. Teoretis Apple Squircle (n = 3.5)</span>
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showTheoreticalCircle}
                      onChange={(e) => setShowTheoreticalCircle(e.target.checked)}
                    />
                    <span style={{ width: '12px', height: '2px', background: '#38bdf8', display: 'inline-block' }} />
                    <span style={{ color: '#38bdf8', fontWeight: 700 }}>2. Teoretis Busur Lingkaran (n = 2.0)</span>
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showActualBrowserCSS}
                      onChange={(e) => setShowActualBrowserCSS(e.target.checked)}
                    />
                    <span style={{ width: '12px', height: '3px', background: '#34d399', display: 'inline-block' }} />
                    <span style={{ color: '#34d399', fontWeight: 800 }}>3. Real Rendered CSS Curve (Browser)</span>
                  </label>
                </div>
              </div>

              {/* Visual Empirical Stage Box */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '520px',
                  height: '340px',
                  margin: '0 auto',
                  background: '#0d131f',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--ptv-curve-xl)',
                  overflow: 'hidden',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
                }}
              >
                {/* SVG Mathematical Curve References (R = 140px) */}
                <svg
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Axis Crosshairs */}
                  <line x1="30" y1="0" x2="30" y2="340" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <line x1="0" y1="30" x2="520" y2="30" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <text x="36" y="24" fill="#64748b" fontSize="10" fontFamily="monospace">
                    Origin (0,0) &bull; R = 140px
                  </text>

                  {/* 1. Theoretical Squircle (n = 3.5) */}
                  {showTheoreticalSquircle && (
                    <g>
                      <path
                        d={generateSuperellipsePath(30, 30, 140, 3.5, 60, 50)}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="2.5"
                        strokeDasharray="6 3"
                      />
                      <text x="180" y="75" fill="#fbbf24" fontSize="11" fontWeight="700">
                        Teoretis Squircle (n = 3.5)
                      </text>
                    </g>
                  )}

                  {/* 2. Theoretical Circle (n = 2.0) */}
                  {showTheoreticalCircle && (
                    <g>
                      <path
                        d={generateSuperellipsePath(30, 30, 140, 2.0, 60, 50)}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2"
                        strokeDasharray="3 3"
                      />
                      <text x="180" y="98" fill="#38bdf8" fontSize="11" fontWeight="700">
                        Teoretis Busur Lingkaran (n = 2.0)
                      </text>
                    </g>
                  )}
                </svg>

                {/* 3. Actual Rendered CSS DOM Element (Card R = 28px Scaled 5x to 140px) */}
                {showActualBrowserCSS && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '30px',
                      top: '30px',
                      width: '38px',
                      height: '38px',
                      transform: `scale(${140 / 28})`,
                      transformOrigin: '0 0',
                      borderTop: `${3 / (140 / 28)}px solid #34d399`,
                      borderLeft: `${3 / (140 / 28)}px solid #34d399`,
                      borderTopLeftRadius: 'var(--ptv-curve-2xl)', /* 28px native CSS token */
                      background: 'transparent',
                      boxSizing: 'border-box',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>

              {/* Honest Empirical Conclusion */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '14px 18px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 'var(--ptv-curve-md)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: '12.5px',
                  color: '#94a3b8',
                  lineHeight: 1.6,
                }}
              >
                <div style={{ color: '#ffffff', fontWeight: 800, marginBottom: '4px' }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ color: '#fbbf24', marginRight: '6px' }} />
                  Laporan Integritas Render Mesin Peramban
                </div>
                <p style={{ margin: '0 0 6px 0' }}>
                  Perhatikan dengan teliti garis solid hijau (<b>Actual Rendered CSS Curve</b>):
                </p>
                <ul style={{ margin: '0 0 8px 18px', padding: 0 }}>
                  <li>
                    Garis hijau browser <b>berimpit persis dengan Garis Biru Putus-Putus (Busur Lingkaran $n=2.0$)</b>, dan berjarak renggang dari Garis Emas Putus-Putus (Squircle $n=3.5$).
                  </li>
                  <li>
                    <b>Kesimpulan Ilmiah:</b> Peramban Chromium/Blink saat ini menjalankan rendering standar busur lingkaran. Mengklaim bahwa halaman Hub saat ini merender profil squircle secara matematis di browser Chrome adalah <i>tidak benar secara faktual</i>.
                  </li>
                  <li>
                    <b>Arsitektur Produksi:</b> Desain Hub dibangun dengan <b>Progressive Enhancement</b>. Ketika spesifikasi W3C <code>corner-shape: squircle</code> diaktifkan pada engine browser masa depan, rule <code>@supports (corner-shape: squircle)</code> di <code>dashboard.css</code> akan langsung mengangkat profil kurva ke garis emas secara otomatis tanpa merusak tata letak.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: CONCENTRIC NESTED ALIGNMENT (ACTUAL INSET AUDIT) ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'nested' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Explanation Header */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--ptv-curve-lg)',
              padding: '16px 20px',
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
              Formula Keselarasan Konsentris: <code>R_inner_math = max(0, R_outer - Inset_aktual)</code>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 8px 0', lineHeight: 1.5 }}>
              <b>Inset Aktual</b> diukur secara fisik dari batas terluar kontainer induk: <code>Inset_aktual = Padding + Border_width</code>.
              Jika elemen anak menggunakan radius yang tidak dikompensasi dengan inset, terjadi efek distorsi optis <i>"corner pinch"</i> (sudut berhimpitan) atau celah sudut yang tidak rata.
            </p>
            <div style={{ fontSize: '12px', color: '#64748b', background: '#ffffff', padding: '8px 12px', borderRadius: 'var(--ptv-curve-sm)', border: '1px solid #cbd5e1' }}>
              <i className="fa-solid fa-circle-info" style={{ color: '#2563eb', marginRight: '6px' }} />
              <b>Transparansi Optis:</b> Di UI Hub, ketika hasil matematis murni menghasilkan angka non-standar (misal 4.5px atau 7px), desainer Hub memilih token terdekat dari sistem (misal 6px atau 12px) demi ergonomi target sentuh dan konsistensi tombol. Bagian ini menjelaskan secara jujur perbedaan antara angka matematis dan penyesuaian optis tersebut.
            </div>
          </div>

          {/* Scenario Selector */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setNestedScenario('card')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--ptv-curve-sm)',
                border: nestedScenario === 'card' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                background: nestedScenario === 'card' ? '#eff6ff' : '#ffffff',
                color: nestedScenario === 'card' ? '#1d4ed8' : '#475569',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Kasus 1: Card (22px) &rarr; Thumbnail (12px)
            </button>
            <button
              type="button"
              onClick={() => setNestedScenario('modal')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--ptv-curve-sm)',
                border: nestedScenario === 'modal' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                background: nestedScenario === 'modal' ? '#eff6ff' : '#ffffff',
                color: nestedScenario === 'modal' ? '#1d4ed8' : '#475569',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Kasus 2: Modal (28px) &rarr; Sub-Panel (16px) &rarr; Control (12px)
            </button>
            <button
              type="button"
              onClick={() => setNestedScenario('calculator')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--ptv-curve-sm)',
                border: nestedScenario === 'calculator' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                background: nestedScenario === 'calculator' ? '#eff6ff' : '#ffffff',
                color: nestedScenario === 'calculator' ? '#1d4ed8' : '#475569',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Kasus 3: Interactive Inset Calculator &amp; Live Audit
            </button>
          </div>

          {/* Scenario 1: Card -> Thumbnail */}
          {nestedScenario === 'card' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '20px',
              }}
            >
              {/* Visual Render */}
              <div
                style={{
                  background: 'var(--surface, #ffffff)',
                  border: '2px solid #0f172a',
                  borderRadius: 'var(--ptv-curve-xl)', /* 22px */
                  padding: '10px', /* padding = 10px */
                  boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginBottom: '8px', letterSpacing: '0.04em' }}>
                  KARTU INDUK: R_outer = 22px (Padding: 10px, Border: 2px)
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: 'var(--ptv-curve-md)', /* 12px */
                    padding: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: 'var(--ptv-curve-md)', /* 12px */
                      background: '#e0f2fe',
                      color: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      flexShrink: 0,
                    }}
                  >
                    <i className="fa-solid fa-camera" />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                      Kamera Cinema FX3 (R_inner = 12px)
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      Inset Aktual: 10px padding = R matematis 12px
                    </div>
                  </div>
                </div>
              </div>

              {/* Breakdown Table */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--ptv-curve-lg)',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '12.5px',
                }}
              >
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '14px', marginBottom: '4px' }}>
                  Audit Metrik Kasus 1:
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Radius Induk (R_outer):</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>22px (--ptv-curve-xl)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Padding Induk:</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>10px</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Border Induk:</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>2px (border-box)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Inset Aktual ke Anak:</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>10px</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Radius Matematis Murni (22 - 10):</span>
                  <span style={{ fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>12px</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Token Dirender:</span>
                  <span style={{ fontWeight: 800, color: '#2563eb', fontFamily: 'monospace' }}>--ptv-curve-md (12px)</span>
                </div>
                <div style={{ marginTop: '4px', fontSize: '11.5px', color: '#059669', background: '#ecfdf5', padding: '6px 10px', borderRadius: 'var(--ptv-curve-sm)' }}>
                  <i className="fa-solid fa-check" style={{ marginRight: '6px' }} />
                  <b>Kesesuaian 100%:</b> Nilai matematis murni (12px) tepat berimpit dengan token desain standard (--ptv-curve-md).
                </div>
              </div>
            </div>
          )}

          {/* Scenario 2: Modal -> Sub-Panel -> Control */}
          {nestedScenario === 'modal' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '20px',
              }}
            >
              {/* Visual Render */}
              <div
                style={{
                  background: 'var(--surface, #ffffff)',
                  border: '2px solid #0f172a',
                  borderRadius: 'var(--ptv-curve-2xl)', /* 28px */
                  padding: '12px', /* padding = 12px */
                  boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginBottom: '8px', letterSpacing: '0.04em' }}>
                  LEVEL 1: MODAL ENVELOPE (R = 28px, Inset = 12px)
                </div>
                <div
                  style={{
                    background: '#f1f5f9',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: 'var(--ptv-curve-lg)', /* 16px */
                    padding: '10px', /* padding = 10px */
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', marginBottom: '8px' }}>
                    LEVEL 2: SUB-PANEL DOSSIER (R = 16px, Inset = 10px)
                  </div>
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #94a3b8',
                      borderRadius: 'var(--ptv-curve-md)', /* 12px */
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                      LEVEL 3: FORM CONTROL (R = 12px)
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--ptv-curve-xs)',
                        background: '#ecfdf5',
                        color: '#059669',
                        fontSize: '10px',
                        fontWeight: 800,
                      }}
                    >
                      Kompensasi Optis
                    </span>
                  </div>
                </div>
              </div>

              {/* Breakdown Table with Optical Disclosure */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--ptv-curve-lg)',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '12px',
                }}
              >
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px', marginBottom: '2px' }}>
                  Audit Metrik &amp; Penjelasan Optis:
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                  <b style={{ color: '#0f172a' }}>Transisi Level 1 &rarr; Level 2 (Modal &rarr; Sub-Panel):</b>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span style={{ color: '#64748b' }}>R_outer (28px) - Inset (12px):</span>
                    <span style={{ fontWeight: 700, color: '#059669' }}>R_math = 16px (Match --ptv-curve-lg)</span>
                  </div>
                </div>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                  <b style={{ color: '#0f172a' }}>Transisi Level 2 &rarr; Level 3 (Sub-Panel &rarr; Control):</b>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span style={{ color: '#64748b' }}>R_outer (16px) - Inset (10px):</span>
                    <span style={{ fontWeight: 700, color: '#d97706' }}>R_math = 6px (--ptv-curve-xs)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span style={{ color: '#64748b' }}>Token Aktual Dirender:</span>
                    <span style={{ fontWeight: 800, color: '#2563eb' }}>12px (--ptv-curve-md)</span>
                  </div>
                </div>
                <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '8px 10px', borderRadius: 'var(--ptv-curve-sm)', color: '#92400e', lineHeight: 1.4 }}>
                  <b>Mengapa Control Menggunakan 12px bukan 6px?</b>
                  <div style={{ marginTop: '2px' }}>
                    Sesuai panduan Human Interface Guidelines, tombol dan input form memerlukan sudut yang cukup bulat (12px) untuk menandakan elemen interaktif (affordance). Sudut 6px akan membuat tombol terlihat seperti label kaku. Inilah penyesuaian optis sadar yang dilakukan tim desain.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scenario 3: Live Interactive Concentric Calculator */}
          {nestedScenario === 'calculator' && (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--ptv-curve-xl)',
                padding: '20px',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a', marginBottom: '14px' }}>
                Kalkulator Inset Konsentris Interaktif
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px',
                  alignItems: 'center',
                }}
              >
                {/* Sliders */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: '#334155' }}>Radius Induk (R_outer):</span>
                      <span style={{ fontWeight: 800, color: '#2563eb', fontFamily: 'monospace' }}>{calcOuterR}px</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="34"
                      value={calcOuterR}
                      onChange={(e) => setCalcOuterR(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#2563eb' }}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: '#334155' }}>Padding Fisik:</span>
                      <span style={{ fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>{calcPadding}px</span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="24"
                      value={calcPadding}
                      onChange={(e) => setCalcPadding(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#059669' }}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: '#334155' }}>Border Width:</span>
                      <span style={{ fontWeight: 800, color: '#d97706', fontFamily: 'monospace' }}>{calcBorder}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="4"
                      value={calcBorder}
                      onChange={(e) => setCalcBorder(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#d97706' }}
                    />
                  </div>

                  {/* Calculated Output Badges */}
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Total Inset Aktual:</span>
                      <b>{calcPadding}px + {calcBorder}px = {actualInset}px</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>R_inner Matematis Murni:</span>
                      <b style={{ color: '#2563eb' }}>{calcOuterR} - {actualInset} = {calculatedMathInner}px</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Token Sistem Terdekat:</span>
                      <b style={{ color: '#059669' }}>{closestToken.label}</b>
                    </div>
                  </div>
                </div>

                {/* Live Preview Box */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div
                    style={{
                      width: '260px',
                      height: '180px',
                      border: `${calcBorder}px solid #0f172a`,
                      borderRadius: 'var(--ptv-curve-xl)',
                      padding: `${calcPadding}px`,
                      background: '#ffffff',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
                      boxSizing: 'border-box',
                      display: 'flex',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        background: '#eff6ff',
                        border: '1.5px solid #93c5fd',
                        borderRadius: 'var(--ptv-curve-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        padding: '10px',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#1d4ed8' }}>
                        Elemen Bersarang
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        R_math: {calculatedMathInner}px
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: OPTICAL SIZE MATRIX & TOKEN CATALOG ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 4: INTER UNIVERSAL TYPOGRAPHY & PORTAL INHERITANCE ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'typography' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Status & Cascade Strategy Card */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--ptv-curve-xl)',
              padding: '20px 24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 'var(--ptv-curve-pill)',
                  background: '#dcfce7',
                  color: '#15803d',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                }}
              >
                Universal Typography: Inter
              </span>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                <code>--ptv-font-family: &quot;Inter&quot;, Arial, sans-serif</code>
              </span>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ink, #0f172a)', margin: '0 0 8px 0' }}>
              Inter Universal Typography Engine
            </h3>
            <p style={{ fontSize: '13.5px', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Seluruh komponen PTV PRO Hub (Login, Shell, Header, Sidebar, Bottom Dock, Inventaris, Nilai Inventaris, Peminjaman, PTVSelect, modal, dan drawer) diwajibkan menggunakan font universal <strong>Inter</strong> untuk konsistensi 100% lintas OS dan browser tanpa dependensi font sistem operasi.
            </p>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 'var(--ptv-curve-lg)',
                padding: '14px 16px',
                fontSize: '12.5px',
                lineHeight: 1.6,
                color: '#334155',
              }}
            >
              <div style={{ marginBottom: '6px' }}>
                <b>Sumber &amp; Lisensi Font:</b>{' '}
                <span style={{ color: '#15803d', fontWeight: 700 }}>
                  Inter Variable WOFF2 (Official by Rasmus Andersson, SIL Open Font License 1.1).
                </span>
              </div>
              <div style={{ marginBottom: '6px' }}>
                <b>Lokasi Aset Lokal:</b> Tersedia mandiri secara lokal di <code>/public/assets/fonts/InterVariable.woff2</code> (352 kB) dengan HTTP 200 tanpa dependensi CDN pihak ketiga.
              </div>
              <div>
                <b>Spesifikasi Variable Font:</b> Rentang bobot <code>100–900</code> dalam satu file variable terpadu dengan <code>font-display: swap</code>.
              </div>
            </div>
          </div>

          {/* Weight Mapping & Hierarchy Showcase */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--ptv-curve-xl)',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
              Inter Variable Weight Mapping &amp; Typographic Hierarchy
            </h4>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
              Memverifikasi render ketebalan huruf Inter dari 400 hingga 900 secara presisi dan konsisten.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Weight 400 — Regular (Body, Deskripsi, Metadata)
                </div>
                <div style={{ fontSize: '15px', fontWeight: 400, color: '#0f172a', lineHeight: 1.5 }}>
                  The quick brown fox jumps over the lazy dog. Sistem inventaris dan peminjaman peralatan audio-visual PTV PRO Hub.
                </div>
              </div>

              <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Weight 500 — Medium (Input form, Filter chip, Sub-label)
                </div>
                <div style={{ fontSize: '15px', fontWeight: 500, color: '#0f172a', lineHeight: 1.5 }}>
                  Unit Tersedia: Sony FX3 Cinema Line, Lensa FE 24-70mm f/2.8 GM II, DJI Ronin RS3 Pro Gimbal Stabilizer.
                </div>
              </div>

              <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Weight 600 — Semibold (Tombol tindakan, Header tabel, Status badge)
                </div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', lineHeight: 1.5 }}>
                  Total 18 Unit Siap Pakai &bull; Nilai Aset Rp 142.500.000 &bull; Pengembalian Tepat Waktu 98.4%
                </div>
              </div>

              <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Weight 700 — Bold (Judul modul, Card heading, Modal title)
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', lineHeight: 1.4 }}>
                  PTV PRO Hub &mdash; Universal Continuous Curve &amp; Inter Typography Standard
                </div>
              </div>

              <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Weight 800/900 — Heavy / Black (Hero greeting, KPI display numerals, Master brand)
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>
                  Rp 142.500.000 &bull; METRIK INVENTARIS PRODUKSI 2026
                </div>
              </div>
            </div>
          </div>

          {/* Numeral Alignment & Tabular Figures */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--ptv-curve-xl)',
              padding: '24px',
            }}
          >
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
              Numeral Alignment &amp; Currency Figures
            </h4>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
              Pengujian stabilitas perataan angka numerik pada KPI dan tabel nilai inventaris.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 'var(--ptv-curve-lg)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>
                  Primary Font (Proportional Figures)
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e40af', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                  Rp 142.500.000
                </div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  + Rp 12.800.000 (Simulasi Penyesuaian Nilai)
                </div>
              </div>
              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 'var(--ptv-curve-lg)', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>
                  Monospace Token (<code>--ptv-font-mono</code>)
                </div>
                <div style={{ fontFamily: 'var(--ptv-font-mono)', fontSize: '22px', fontWeight: 700, color: '#0e7490', marginBottom: '4px' }}>
                  INV-2026-FX3-001
                </div>
                <div style={{ fontFamily: 'var(--ptv-font-mono)', fontSize: '12.5px', color: '#64748b' }}>
                  ID: 741c2592-d274-4723-8f83-e38e1cefc0bb
                </div>
              </div>
            </div>
          </div>

          {/* Portal Dropdown & Modal Inheritance Test */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--ptv-curve-xl)',
              padding: '24px',
            }}
          >
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
              Portal Font Inheritance Proof (In-DOM vs. Body-Portaled)
            </h4>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
              Membuktikan secara empiris bahwa dropdown yang dirender di portal <code>document.body</code> mewarisi <code>--ptv-font-family</code> dan continuous curve yang identik dengan dropdown in-DOM.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 'var(--ptv-curve-lg)', border: '1px solid #cbd5e1' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 750, color: '#0f172a', marginBottom: '6px' }}>
                  Dropdown A: Standard In-DOM (usePortal = false)
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px 0' }}>
                  Menu dirender bersarang di dalam hierarki komponen induk.
                </p>
                <PTVSelect
                  value={selectedDropdown}
                  onChange={setSelectedDropdown}
                  options={[
                    { value: 'kamera', label: 'Kamera Cinema Sony FX3' },
                    { value: 'lensa', label: 'Lensa FE 24-70mm GM II' },
                    { value: 'audio', label: 'Sennheiser Wireless Mic' },
                  ]}
                  usePortal={false}
                />
              </div>

              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 'var(--ptv-curve-lg)', border: '1px solid #cbd5e1' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 750, color: '#0f172a', marginBottom: '6px' }}>
                  Dropdown B: Portal Body (usePortal = true)
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px 0' }}>
                  Menu dirender langsung di <code>document.body</code> via React Portal.
                </p>
                <PTVSelect
                  value={selectedDropdown}
                  onChange={setSelectedDropdown}
                  options={[
                    { value: 'kamera', label: 'Kamera Cinema Sony FX3' },
                    { value: 'lensa', label: 'Lensa FE 24-70mm GM II' },
                    { value: 'audio', label: 'Sennheiser Wireless Mic' },
                  ]}
                  usePortal={true}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
