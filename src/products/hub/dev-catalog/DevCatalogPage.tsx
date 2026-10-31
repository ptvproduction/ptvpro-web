import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Card, Badge, PTVSelect } from '@shared/components';
import { ContinuousSurface, PTV_CURVE_TOKENS } from '../../../design-system';
import { IdDigitalPage } from '../id-digital/IdDigitalPage';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import '@/styles/tokens.css';

export const DevCatalogPage: React.FC = () => {
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Interactive component states
  const [btnLoading, setBtnLoading] = useState(false);
  const [selectVal, setSelectVal] = useState('cam-1');
  const [selectModalVal, setSelectModalVal] = useState('opt-a');
  const [activeFchip, setActiveFchip] = useState<'all' | 'avail' | 'loaned' | 'repair'>('all');
  const [segTab, setSegTab] = useState<'overview' | 'details' | 'history'>('overview');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalWideOpen, setModalWideOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Live Inspector state
  const [renderedBodyFont, setRenderedBodyFont] = useState<string>('Mendeteksi...');
  const [renderedDisplayFont, setRenderedDisplayFont] = useState<string>('Mendeteksi...');
  const [fontAwesomeActive, setFontAwesomeActive] = useState<boolean>(false);
  const fontDetectBodyRef = useRef<HTMLSpanElement>(null);
  const fontDetectDisplayRef = useRef<HTMLSpanElement>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const modalWideRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen: modalOpen,
    onClose: () => setModalOpen(false),
    modalRef,
    id: 'dev-catalog-modal',
  });

  useModalScrollLock({
    isOpen: modalWideOpen,
    onClose: () => setModalWideOpen(false),
    modalRef: modalWideRef,
    id: 'dev-catalog-modal-wide',
  });

  useModalScrollLock({
    isOpen: sheetOpen,
    onClose: () => setSheetOpen(false),
    modalRef: sheetRef,
    id: 'dev-catalog-sheet',
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Inspect font and icons
  useEffect(() => {
    if (fontDetectBodyRef.current) {
      setRenderedBodyFont(window.getComputedStyle(fontDetectBodyRef.current).fontFamily);
    }
    if (fontDetectDisplayRef.current) {
      setRenderedDisplayFont(window.getComputedStyle(fontDetectDisplayRef.current).fontFamily);
    }
    // Check if Font Awesome classes create pseudo element or SVG
    const testIcon = document.createElement('i');
    testIcon.className = 'fa-solid fa-house';
    testIcon.style.position = 'absolute';
    testIcon.style.visibility = 'hidden';
    document.body.appendChild(testIcon);
    const hasFa =
      window.getComputedStyle(testIcon, ':before').content !== 'none' ||
      testIcon.classList.contains('svg-inline--fa');
    setFontAwesomeActive(hasFa);
    document.body.removeChild(testIcon);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 3200);
  };

  const sampleOptions = [
    { value: 'cam-1', label: 'Sony FX3 Cinema Line' },
    { value: 'cam-2', label: 'Canon EOS R6 Mark II' },
    { value: 'lens-1', label: 'Sony FE 24-70mm f/2.8 GM II' },
    { value: 'mic-1', label: 'Rode Wireless GO II' },
    { value: 'disabled-opt', label: 'Tripod Manfrotto (Dalam Servis)', disabled: true },
  ];

  return (
    <div
      className="ptv-hub-root"
      style={{
        backgroundColor: 'var(--bg, #F1F7FF)',
        color: 'var(--ink, #0B2A4A)',
        minHeight: '100vh',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        padding: '24px 14px 80px',
        fontFamily: 'var(--ptv-font-family, sans-serif)',
        transition: 'background-color 0.2s ease, color 0.2s ease',
      }}
    >
      <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
        {/* ── HEADER / TOOLBAR KATALOG ── */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            paddingBottom: '20px',
            borderBottom: '1px solid var(--line, rgba(11,42,74,0.10))',
            marginBottom: '32px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  background: 'linear-gradient(150deg, var(--b-500, #3B8EF7), var(--b-700, #0B5FBF))',
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: 'var(--r-full)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                PTV REVISI 03
              </span>
              <span style={{ fontSize: '12.5px', color: 'var(--muted, #6E8CAE)', fontWeight: 550 }}>
                Tahap B: Katalog Komponen Development
              </span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.03em', margin: '6px 0 2px' }}>
              PTV Hub Component Standards &amp; Continuous Corner Lab
            </h1>
            <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--ink-2, #38587A)' }}>
              Standar konkret hasil ekstraksi <code>ptv-dashboard-reference.html</code> dipadukan dengan konfigurasi SF Pro dan geometri Profile D.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              className="btn sm"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              style={{
                borderRadius: 'var(--r-full)',
                padding: '0 16px',
                minHeight: '36px',
                fontSize: '13px',
                fontWeight: 620,
                backgroundColor: 'var(--surface, #FFFFFF)',
                border: '1px solid var(--line, rgba(11,42,74,0.10))',
                color: 'var(--ink, #0B2A4A)',
                boxShadow: 'var(--shadow-s)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <i className={theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'} style={{ color: 'var(--b-600)' }} />
              <span>{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
            </button>
          </div>
        </header>

        {/* ── LIVE ASSET & FONT INSPECTOR ── */}
        <section
          style={{
            background: 'var(--surface, #FFFFFF)',
            border: '1px solid var(--line-2, rgba(11,42,74,0.055))',
            borderRadius: 'var(--r-m, 18px)',
            padding: '14px 18px',
            boxShadow: 'var(--shadow-s)',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '14px', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 650, color: 'var(--ink-2)' }}>UI &amp; Body (SF Pro Text):</span>
              <span
                ref={fontDetectBodyRef}
                style={{
                  fontFamily: 'var(--font-body)',
                  background: 'var(--b-050, #EDF4FF)',
                  color: 'var(--b-700, #0B5FBF)',
                  padding: '2px 8px',
                  borderRadius: 'var(--ptv-curve-xs)',
                  fontWeight: 600,
                }}
              >
                {renderedBodyFont}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 650, color: 'var(--ink-2)' }}>Display (SF Pro Display):</span>
              <span
                ref={fontDetectDisplayRef}
                style={{
                  fontFamily: 'var(--font-display)',
                  background: 'var(--b-050, #EDF4FF)',
                  color: 'var(--b-700, #0B5FBF)',
                  padding: '2px 8px',
                  borderRadius: 'var(--ptv-curve-xs)',
                  fontWeight: 700,
                }}
              >
                {renderedDisplayFont}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
            <span style={{ fontWeight: 650, color: 'var(--ink-2)' }}>Pustaka Ikon Referensi:</span>
            <span
              style={{
                background: fontAwesomeActive ? 'var(--ok-bg, #E1F5EE)' : 'var(--warn-bg, #FCF0D6)',
                color: fontAwesomeActive ? 'var(--ok, #0F7A5A)' : 'var(--warn, #9A6B08)',
                padding: '2px 8px',
                borderRadius: 'var(--ptv-curve-xs)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <i className="fa-solid fa-check" />
              <span>Font Awesome 6.5.2 CDN (Aktif)</span>
            </span>
          </div>
        </section>

        {/* ── 1. KELUARGA BUTTON (PILL 46PX, COMPACT 36PX, FAB, STATES) ── */}
        <div className="sec" style={{ marginTop: '28px' }}>
          <div className="sec-hd" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.025em' }}>
              1. Keluarga Tombol (Button Family — Pill Acuan R03)
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Standar: Kapsul Penuh (<code>--r-full: 999px</code>), Normal: 46px, Compact: 36px
            </span>
          </div>

          <Card standard="r03" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Ukuran Normal (46px) */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 650, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Ukuran Normal (Min-Height: 46px, Padding: 0 18px, Font: 14.5px Wt 620)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                <Button shape="pill" variant="primary" size="md">
                  <i className="fa-solid fa-plus" /> Primary Pill
                </Button>
                <Button shape="pill" variant="secondary" size="md">
                  <i className="fa-solid fa-arrow-down-to-bracket" /> Secondary
                </Button>
                <Button shape="pill" variant="gold" size="md">
                  <i className="fa-solid fa-camera-retro" /> Accent Tint (Gold)
                </Button>
                <Button shape="pill" variant="ghost" size="md">
                  <i className="fa-solid fa-sliders" /> Ghost / Borderless
                </Button>
                <Button shape="pill" variant="danger" size="md">
                  <i className="fa-solid fa-trash-can" /> Destruktif
                </Button>
              </div>
            </div>

            {/* Ukuran Compact (36px) */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 650, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Ukuran Compact (Min-Height: 36px, Padding: 0 14px, Font: 13px Wt 620)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                <Button shape="pill" variant="primary" size="sm">
                  <i className="fa-solid fa-check" /> Simpan
                </Button>
                <Button shape="pill" variant="secondary" size="sm">
                  <i className="fa-solid fa-rotate-left" /> Reset
                </Button>
                <Button shape="pill" variant="gold" size="sm">
                  <i className="fa-solid fa-qrcode" /> Scan Barcode
                </Button>
                <Button shape="pill" variant="danger" size="sm">
                  <i className="fa-solid fa-xmark" /> Batal
                </Button>
              </div>
            </div>

            {/* State Khusus: Loading, Disabled, Circular, FAB */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 650, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                State Fungsional &amp; Tombol Melingkar (Circle 50%)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <Button
                  shape="pill"
                  variant="primary"
                  size="md"
                  isLoading={btnLoading}
                  loadingText="Menyimpan perubahan..."
                  onClick={() => {
                    setBtnLoading(true);
                    setTimeout(() => {
                      setBtnLoading(false);
                      triggerToast('Perubahan berhasil disimpan ke database!');
                    }, 1800);
                  }}
                >
                  <i className="fa-solid fa-floppy-disk" /> Klik Uji State Loading
                </Button>

                <Button shape="pill" variant="primary" size="md" disabled>
                  <i className="fa-solid fa-lock" /> Disabled State
                </Button>

                {/* Circular Icon Button 38px */}
                <button
                  type="button"
                  className="icon-btn"
                  title="Notifikasi Kru"
                  aria-label="Notifikasi Kru"
                  onClick={() => triggerToast('Daftar notifikasi kru dibuka')}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--line-2)',
                    color: 'var(--ink-2)',
                    fontSize: '15px',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-s)',
                    position: 'relative',
                  }}
                >
                  <i className="fa-solid fa-bell" />
                  <span
                    style={{
                      position: 'absolute',
                      top: '2px',
                      right: '2px',
                      minWidth: '14px',
                      height: '14px',
                      padding: '0 3px',
                      borderRadius: 'var(--r-full)',
                      backgroundColor: 'var(--b-600)',
                      color: '#fff',
                      fontSize: '9px',
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    3
                  </span>
                </button>

                {/* Floating Action Button (FAB 50px) */}
                <button
                  type="button"
                  className="fab"
                  title="Tambah Cepat"
                  aria-label="Tambah Cepat"
                  onClick={() => triggerToast('Menu aksi cepat melayang dibuka')}
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: 'linear-gradient(150deg, var(--b-500), var(--b-700))',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '18px',
                    border: 'none',
                    boxShadow: 'var(--shadow-blue)',
                    cursor: 'pointer',
                  }}
                >
                  <i className="fa-solid fa-plus" />
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* ── 2. FORM & INPUT CONTROLS (16PX TEXT, MIN 48PX HEIGHT) ── */}
        <div className="sec" style={{ marginTop: '28px' }}>
          <div className="sec-hd" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.025em' }}>
              2. Form &amp; Input Controls (Standard: 16px Font, Min 48px Height)
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Mencegah auto-zoom iOS Safari, Radius Nominal 13px (<code>--r-s</code>), Background <code>--bg-2</code>
            </span>
          </div>

          <Card standard="r03">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <Input
                standard="r03"
                label="Nama Lengkap Kru"
                placeholder="Misal: Farras Zaidan Mubarok"
                defaultValue="M. Farras Zaidan Mubarok"
                hint="Nama sesuai dengan identitas resmi database PTV"
              />

              <Input
                standard="r03"
                label="Nomor Surat / Kode Unit"
                placeholder="PTV/ST/026/X"
                defaultValue="PTV/ST/026/X"
              />

              <Input
                standard="r03"
                label="Field dengan Error Validasi"
                defaultValue="INV-INVALID-99"
                error="Kode inventaris tidak terdaftar pada katalog sistem."
              />

              <Input
                standard="r03"
                label="Read-Only Field (Dapat Disalin)"
                readOnly
                defaultValue="SN-A73-0091-PHYSICAL-ASSET"
                hint="Data nomor seri permanen dari pabrikan"
              />

              <Input
                standard="r03"
                label="Disabled Control"
                disabled
                placeholder="Pengaturan terkunci hak akses"
              />

              {/* Pill Searchbar */}
              <div className="field">
                <label style={{ fontSize: '12.5px', fontWeight: 620, color: 'var(--ink-2)', letterSpacing: '-0.01em' }}>
                  Pill Searchbar (Input 16px, Kapsul 999px)
                </label>
                <div
                  className="searchbar"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '11px',
                    padding: '10px 16px',
                    borderRadius: 'var(--r-full)',
                    background: 'var(--bg-2, #F7FBFF)',
                    border: '1px solid var(--line, rgba(11,42,74,0.10))',
                    color: 'var(--muted)',
                  }}
                >
                  <i className="fa-solid fa-magnifying-glass" />
                  <input
                    placeholder="Cari alat, kru, atau berkas..."
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      fontSize: '16px',
                      color: 'var(--ink)',
                      fontFamily: 'var(--ptv-font-family)',
                    }}
                  />
                  <kbd style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: 'var(--ptv-concentric-inset-xs)', background: 'var(--neutral-bg)', border: '1px solid var(--line-2)' }}>
                    ⌘K
                  </kbd>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ── 3. PTVSELECT & SEARCHABLE LISTBOX ── */}
        <div className="sec" style={{ marginTop: '28px' }}>
          <div className="sec-hd" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.025em' }}>
              3. Custom PTVSelect Component (Trigger 48px, ARIA Combobox)
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Dropdown floating, keyboard navigasi, searchable mode
            </span>
          </div>

          <Card standard="r03">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 620, color: 'var(--ink-2)', display: 'block', marginBottom: '6px' }}>
                  Standard Single Select (Kamera Utama)
                </label>
                <PTVSelect
                  value={selectVal}
                  onChange={(val) => setSelectVal(val)}
                  options={sampleOptions}
                  ariaLabel="Pilih Kamera Utama"
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 620, color: 'var(--ink-2)', display: 'block', marginBottom: '6px' }}>
                  Searchable Select (Pencarian Katalog)
                </label>
                <PTVSelect
                  value={selectVal}
                  onChange={(val) => setSelectVal(val)}
                  options={sampleOptions}
                  searchable
                  searchPlaceholder="Ketik nama alat..."
                  ariaLabel="Cari Peralatan"
                />
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 620, color: 'var(--ink-2)', display: 'block', marginBottom: '6px' }}>
                  Select State Error
                </label>
                <PTVSelect
                  value=""
                  onChange={() => {}}
                  options={sampleOptions}
                  placeholder="Pilih divisi penanggung jawab..."
                  error="Wajib memilih divisi operasional."
                  ariaLabel="Divisi Error"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* ── 4. BADGES, CHIPS & STATUS TOKENS ── */}
        <div className="sec" style={{ marginTop: '28px' }}>
          <div className="sec-hd" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.025em' }}>
              4. Badges, Filter Chips &amp; Segmented Controls
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Palet status semantik dengan indikator titik 5px
            </span>
          </div>

          <Card standard="r03" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Status Chips */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 650, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Status Chips (Font: 11.5px Wt 650, Kapsul 999px)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <Badge standard="r03" variant="success" dot>Tersedia (ok)</Badge>
                <Badge standard="r03" variant="warning" dot>Dipinjam (warn)</Badge>
                <Badge standard="r03" variant="danger" dot>Rusak / Servis (dang)</Badge>
                <Badge standard="r03" variant="info" dot>Terjadwal (info)</Badge>
                <Badge standard="r03" variant="gold" dot>Penting (gold usulan)</Badge>
                <Badge standard="r03" variant="neutral" dot>Nonaktif (neutral)</Badge>
                <Badge standard="r03" variant="default" shape="rounded">Badge Kotak 9px (xs)</Badge>
              </div>
            </div>

            {/* Filter Chips Bar (.fchip) */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 650, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Filter Chips Bar (Interaktif .fchip)
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(['all', 'avail', 'loaned', 'repair'] as const).map((key) => {
                  const labels = { all: 'Semua (48)', avail: 'Tersedia (32)', loaned: 'Dipinjam (12)', repair: 'Rusak (4)' };
                  const isOn = activeFchip === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`fchip ${isOn ? 'on' : ''}`}
                      onClick={() => setActiveFchip(key)}
                      style={{
                        minHeight: '34px',
                        padding: '0 14px',
                        borderRadius: 'var(--r-full)',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        border: isOn ? 'none' : '1px solid var(--line, rgba(11,42,74,0.10))',
                        background: isOn ? 'var(--b-600, #1273E6)' : 'var(--surface, #FFFFFF)',
                        color: isOn ? '#ffffff' : 'var(--ink-2, #38587A)',
                        boxShadow: isOn ? 'var(--shadow-blue)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {labels[key]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Segmented Control (.seg) */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 650, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Segmented Control Capsule (.seg)
              </div>
              <div
                className="seg"
                style={{
                  display: 'inline-flex',
                  gap: '4px',
                  padding: '4px',
                  backgroundColor: 'var(--neutral-bg, #E9F0F9)',
                  borderRadius: 'var(--r-full)',
                }}
              >
                {(['overview', 'details', 'history'] as const).map((tab) => {
                  const titles = { overview: 'Ringkasan', details: 'Rincian Spesifikasi', history: 'Riwayat Log' };
                  const isOn = segTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSegTab(tab)}
                      style={{
                        border: 'none',
                        minHeight: '34px',
                        padding: '0 16px',
                        borderRadius: 'var(--r-full)',
                        fontSize: '13px',
                        fontWeight: 620,
                        cursor: 'pointer',
                        backgroundColor: isOn ? 'var(--surface, #FFFFFF)' : 'transparent',
                        color: isOn ? 'var(--b-700, #0B5FBF)' : 'var(--muted, #6E8CAE)',
                        boxShadow: isOn ? 'var(--shadow-s)' : 'none',
                        transition: 'all 0.16s ease',
                      }}
                    >
                      {titles[tab]}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* ── 5. CARDS, SURFACES & IMAGES (.CARD, .STAT, .LI, .THUMB) ── */}
        <div className="sec" style={{ marginTop: '28px' }}>
          <div className="sec-hd" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.025em' }}>
              5. Wadah Permukaan (Surface Cards, Stats, Row Lists, Image Containers)
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Radius Card 18px (<code>--r-m</code>), Thumbnail 14px (<code>--r-thumb</code>), Icon box 13px
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* Stat Box Card */}
            <div
              className="stat"
              style={{
                backgroundColor: 'var(--surface, #FFFFFF)',
                border: '1px solid var(--line-2, rgba(11,42,74,0.055))',
                borderRadius: 'var(--r-m, 18px)',
                padding: '16px',
                boxShadow: 'var(--shadow-s)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 550 }}>Total Aset Inventaris PTV</span>
              <b style={{ fontSize: '28px', fontWeight: 700, color: 'var(--b-700)', letterSpacing: '-0.03em' }}>
                48 Unit
              </b>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <Badge variant="success">32 Tersedia</Badge>
                <Badge variant="warning">12 Dipinjam</Badge>
              </div>
            </div>

            {/* Asset Row Card with 14px Thumbnail (.thumb) */}
            <div
              className="li"
              style={{
                backgroundColor: 'var(--surface, #FFFFFF)',
                border: '1px solid var(--line-2, rgba(11,42,74,0.055))',
                borderRadius: 'var(--r-m, 18px)',
                padding: '12px 14px',
                boxShadow: 'var(--shadow-s)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {/* Thumbnail 52x52px with 14px radius */}
              <div
                className="thumb"
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: 'var(--r-thumb)',
                  overflow: 'hidden',
                  backgroundColor: 'var(--b-050)',
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--b-600)',
                  fontSize: '20px',
                }}
              >
                <i className="fa-solid fa-camera-retro" />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '14.5px', fontWeight: 620, color: 'var(--ink)', display: 'block' }} className="trunc">
                  Sony FX3 Cinema Line (Unit 02)
                </span>
                <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginTop: '1px' }}>
                  Kode: INV-001 · Dipinjam oleh Farras Zaidan
                </span>
              </div>

              <Badge variant="warning">Dipinjam</Badge>
            </div>

            {/* Floating Row (.li with .li-ic 13px) */}
            <div
              className="li"
              style={{
                backgroundColor: 'var(--surface, #FFFFFF)',
                border: '1px solid var(--line-2, rgba(11,42,74,0.055))',
                borderRadius: 'var(--r-m, 18px)',
                padding: '12px 14px',
                boxShadow: 'var(--shadow-s)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {/* Icon Container 13px */}
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--r-icon-box)',
                  backgroundColor: 'var(--b-050)',
                  color: 'var(--b-600)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '16px',
                  flexShrink: 0,
                }}
              >
                <i className="fa-solid fa-calendar-day" />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '14.5px', fontWeight: 620, color: 'var(--ink)', display: 'block' }}>
                  Liputan Haflah Akhirussanah
                </span>
                <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginTop: '1px' }}>
                  Sabtu, 19.30 WIB · Lapangan Utama Pondok
                </span>
              </div>

              <i className="fa-solid fa-chevron-right" style={{ color: 'var(--b-300)', fontSize: '12px' }} />
            </div>
          </div>
        </div>

        {/* ── 6. CENTRAL CONTINUOUS CORNER LABORATORY (PROFILE D G2 QUINTIC) ── */}
        <div className="sec" style={{ marginTop: '28px' }}>
          <div className="sec-hd" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.025em' }}>
              6. Laboratorium Geometri Continuous Corner (Profile D G2 Quintic Bézier)
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Verifikasi kelengkungan halus, proteksi clipping, dan zero dropdown clipping
            </span>
          </div>

          <Card standard="r03">
            <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.5 }}>
              <b>Prinsip Geometri R03:</b> Tombol pill (999px) dan avatar (50%) mempertahankan geometri alaminya tanpa dipaksa menjadi squircle. Wadah kontainer permukaan non-pill (Card 18px, Panel 16px, Modal 24px) menggunakan mesin continuous corner terpusat (Profile D G2 Bézier quintic).
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Continuous Surface Card */}
              <ContinuousSurface
                radius={PTV_CURVE_TOKENS.xl} // 22px / 18px
                variant="soft"
                hoverElevation
                style={{
                  padding: '16px',
                  minHeight: '120px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--b-600)', letterSpacing: '0.04em' }}>
                    PROFILE D VECTOR UNDERLAY
                  </span>
                  <div style={{ fontSize: '14.5px', fontWeight: 650, color: 'var(--ink)', marginTop: '2px' }}>
                    Surface Tanpa Clipping Dropdown
                  </div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <PTVSelect
                    value={selectModalVal}
                    onChange={(v) => setSelectModalVal(v)}
                    options={[
                      { value: 'opt-a', label: 'Dropdown Menu Berhasil Melayang' },
                      { value: 'opt-b', label: 'Bebas Dari Overflow Hidden' },
                    ]}
                    size="sm"
                    ariaLabel="Uji Dropdown Continuous"
                  />
                </div>
              </ContinuousSurface>

              {/* Native CSS Squircle vs Standard Border Radius */}
              <div
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--line-2)',
                  borderRadius: 'var(--r-m)',
                  padding: '16px',
                  boxShadow: 'var(--shadow-s)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.04em' }}>
                    STANDARD CSS BORDER-RADIUS
                  </span>
                  <div style={{ fontSize: '14.5px', fontWeight: 650, color: 'var(--ink)', marginTop: '2px' }}>
                    Mode Kompatibilitas Lintas Browser (18px)
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '4px 0 0' }}>
                    Dicatat jujur sebagai standard rounded rectangle fallback, tidak diklaim sebagai exact Apple squircle.
                  </p>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <Badge variant="info">Fallback Bersih Terverifikasi</Badge>
                </div>
              </div>

              {/* Nested Thumbnail Clipping Check */}
              <div
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--line-2)',
                  borderRadius: 'var(--r-m)',
                  padding: '16px',
                  boxShadow: 'var(--shadow-s)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: 'var(--r-thumb)',
                    overflow: 'hidden',
                    flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--b-400), var(--b-700))',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#fff',
                    fontSize: '22px',
                    boxShadow: '0 4px 10px rgba(18,115,230,0.22)',
                  }}
                >
                  <i className="fa-solid fa-boxes-stacked" />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 650, color: 'var(--ink)' }}>
                    Concentric Inset Inner Radius
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
                    R_outer: 18px → R_inner: 14px (Inset: 4px)
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--ok)', fontWeight: 600 }}>
                    <i className="fa-solid fa-circle-check" /> Radius Proporsional
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ── 7. MODALS, SHEETS & DIALOGS ── */}
        <div className="sec" style={{ marginTop: '28px' }}>
          <div className="sec-hd" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.025em' }}>
              7. Dialog, Modal &amp; Mobile Bottom Sheet (Responsif &amp; Teruji)
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Standard 560px, Wide 760px–1060px, Mobile Sheet 30px
            </span>
          </div>

          <Card standard="r03">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <Button
                shape="pill"
                variant="primary"
                onClick={() => setModalOpen(true)}
              >
                <i className="fa-solid fa-window-maximize" /> Buka Modal Standar (560px)
              </Button>

              <Button
                shape="pill"
                variant="secondary"
                onClick={() => setModalWideOpen(true)}
              >
                <i className="fa-solid fa-arrows-left-right" /> Buka Modal Wide Inventaris (760px / 1060px)
              </Button>

              <Button
                shape="pill"
                variant="gold"
                onClick={() => setSheetOpen(true)}
              >
                <i className="fa-solid fa-mobile-screen" /> Buka Mobile Bottom Sheet
              </Button>
            </div>
          </Card>
        </div>

        {/* ── 8. FEEDBACK, EMPTY, LOADING, ERROR STATES ── */}
        <div className="sec" style={{ marginTop: '28px' }}>
          <div className="sec-hd" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.025em' }}>
              8. Status Fungsional Sistem (Empty, Skeleton Loading, Error)
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Umpan balik jelas bagi kru operasional
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* Empty State Card */}
            <Card standard="r03" style={{ textAlign: 'center', padding: '28px 16px' }}>
              <i className="fa-solid fa-box-open" style={{ fontSize: '32px', color: 'var(--muted)', opacity: 0.5, marginBottom: '10px', display: 'block' }} />
              <div style={{ fontSize: '15px', fontWeight: 650, color: 'var(--ink)' }}>Belum Ada Riwayat Peminjaman</div>
              <p style={{ fontSize: '12.5px', color: 'var(--muted)', margin: '4px 0 16px' }}>
                Seluruh transaksi peminjaman alat kru yang telah selesai akan diarsipkan di sini.
              </p>
              <Button shape="pill" variant="primary" size="sm" onClick={() => triggerToast('Dialihkan ke formulir pinjam alat')}>
                <i className="fa-solid fa-plus" /> Ajukan Peminjaman
              </Button>
            </Card>

            {/* Skeleton Loading Card */}
            <Card standard="r03" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 650, color: 'var(--muted)', marginBottom: '4px' }}>
                Struktur Skeleton Indikator Pemuatan (.skel)
              </div>
              <div className="skel" style={{ height: '22px', width: '65%', borderRadius: 'var(--ptv-curve-xs)' }} />
              <div className="skel" style={{ height: '14px', width: '90%', borderRadius: 'var(--ptv-concentric-inset-xs)' }} />
              <div className="skel" style={{ height: '14px', width: '45%', borderRadius: 'var(--ptv-concentric-inset-xs)' }} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <div className="skel" style={{ height: '32px', width: '90px', borderRadius: 'var(--r-full)' }} />
                <div className="skel" style={{ height: '32px', width: '90px', borderRadius: 'var(--r-full)' }} />
              </div>
            </Card>

            {/* Error State Card */}
            <Card standard="r03" style={{ textAlign: 'center', padding: '24px 16px', border: '1px solid rgba(176,43,35,0.20)' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '30px', color: 'var(--dang)', marginBottom: '10px', display: 'block' }} />
              <div style={{ fontSize: '15px', fontWeight: 650, color: 'var(--dang)' }}>Gagal Menghubungkan ke Server</div>
              <p style={{ fontSize: '12.5px', color: 'var(--muted)', margin: '4px 0 16px' }}>
                Koneksi database terputus. Pastikan jaringan internet studio aktif.
              </p>
              <Button shape="pill" variant="danger" size="sm" onClick={() => triggerToast('Mencoba menyambung kembali...')}>
                <i className="fa-solid fa-rotate" /> Coba Lagi
              </Button>
            </Card>
          </div>
        </div>

        {/* ── 9. TIPOGRAFI, ANGKA TABULAR & SKALA FONT ── */}
        <div className="sec" style={{ marginTop: '28px' }}>
          <div className="sec-hd" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.025em' }}>
              9. Tipografi &amp; Angka Tabular (Tabular Numerals .num)
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Kerapian komparasi nilai inventaris dan nomor seri
            </span>
          </div>

          <Card standard="r03">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div>
                <span className="display" style={{ display: 'block', marginBottom: '4px' }}>Display 27px/32px</span>
                <span className="t-xl" style={{ display: 'block', marginBottom: '4px' }}>t-xl: Header Utama 20px Wt 700</span>
                <span className="t-lg" style={{ display: 'block', marginBottom: '4px' }}>t-lg: Sub Judul 17px Wt 650</span>
                <span className="t-md" style={{ display: 'block', marginBottom: '4px' }}>t-md: Label Kontrol 15px Wt 600</span>
                <span className="t-sm" style={{ display: 'block', color: 'var(--muted)' }}>t-sm: Metadata Sekunder 13.5px</span>
                <span className="t-xs" style={{ display: 'block', color: 'var(--muted)' }}>t-xs: Keterangan Mikro 12.5px</span>
              </div>

              <div>
                <div style={{ fontSize: '12px', fontWeight: 650, color: 'var(--muted)', marginBottom: '8px' }}>
                  Perbandingan Nilai Rupiah (Tabular Numerals .num)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line-2)', paddingBottom: '4px' }}>
                    <span>Sony FX3 Cinema:</span>
                    <b className="num" style={{ fontFamily: 'var(--ptv-font-family)' }}>Rp 54.999.000</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line-2)', paddingBottom: '4px' }}>
                    <span>Lensa 24-70mm GM II:</span>
                    <b className="num" style={{ fontFamily: 'var(--ptv-font-family)' }}>Rp 31.500.000</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line-2)', paddingBottom: '4px' }}>
                    <span>Tripod Manfrotto 190:</span>
                    <b className="num" style={{ fontFamily: 'var(--ptv-font-family)' }}>Rp &nbsp;4.850.000</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px' }}>
                    <span>Total Evaluasi:</span>
                    <b className="num" style={{ color: 'var(--b-700)', fontWeight: 700 }}>Rp 91.349.000</b>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ── 10. EDGE CASES & LONG TEXT BEHAVIOR ── */}
        <div className="sec" style={{ marginTop: '28px' }}>
          <div className="sec-hd" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.025em' }}>
              10. Pengujian Teks Panjang &amp; Batas Overflow (.trunc, .clamp2)
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Memastikan tidak ada card rusak saat data dinamis melebihi ukuran normal
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <Card standard="r03">
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>SATU BARIS (.trunc)</span>
              <div className="trunc" style={{ fontSize: '14.5px', fontWeight: 650, color: 'var(--ink)', marginTop: '4px' }}>
                Kamera Mirrorless Sony Alpha A7S Mark III Full-Frame 4K 120fps Cinema Line Official Body Only
              </div>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Teks terpotong halus tanpa melebar</span>
            </Card>

            <Card standard="r03">
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>DUA BARIS (.clamp2)</span>
              <div className="clamp2" style={{ fontSize: '13.5px', color: 'var(--ink)', marginTop: '4px', lineHeight: 1.4 }}>
                Catatan kerusakan teknis: Kabel HDMI converter mengalami korsleting internal pada pin 4 sehingga sinyal OBS Studio berkedip setiap 3 menit saat perekaman multicam acara wisuda.
              </div>
              <span style={{ fontSize: '11px', color: 'var(--dang)', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                Maksimal 2 baris terpotong rapi
              </span>
            </Card>
          </div>
        </div>

        {/* ── 11. LIVE SHOWCASE: ID DIGITAL RESMI ── */}
        <div className="sec" style={{ marginTop: '28px' }}>
          <div className="sec-hd" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.025em' }}>
              11. Pratinjau ID Digital Resmi (Visual Asset Fidelity R03)
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Portrait 360×560, Logo Resmi, Foto Asli Anggota, Frame Proporsional
            </span>
          </div>

          <Card standard="r03" style={{ display: 'flex', justifyContent: 'center', padding: '24px 12px' }}>
            <IdDigitalPage />
          </Card>
        </div>
      </div>

      {/* ── FLOATING TOAST NOTIFICATION ── */}
      {toastMsg && (
        <div id="toasts" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 120 }}>
          <div
            className="toast"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 18px',
              borderRadius: 'var(--r-full)',
              backgroundColor: 'var(--b-900, #072A52)',
              color: '#EAF3FF',
              fontSize: '13.5px',
              fontWeight: 550,
              boxShadow: '0 10px 30px rgba(7,42,82,0.35)',
            }}
          >
            <i className="fa-solid fa-circle-check" style={{ color: 'var(--b-400)' }} />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

      {/* ── MODAL STANDAR (560px) ── */}
      {modalOpen && (
        <>
          <div
            className="scrim on"
            onClick={() => setModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 80,
              backgroundColor: 'rgba(7,32,62,0.36)',
              backdropFilter: 'blur(4px)',
            }}
          />
          <section
            ref={modalRef}
            className="sheet on"
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 90,
              width: 'min(560px, 92vw)',
              borderRadius: 'var(--r-l, 24px)',
              backgroundColor: 'var(--surface, #FFFFFF)',
              boxShadow: 'var(--shadow-m)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '84vh',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Konfirmasi Persetujuan Surat Tugas</h3>
              <button type="button" className="icon-btn" onClick={() => setModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div style={{ padding: '18px 20px', overflowY: 'auto' }}>
              <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: 'var(--ink-2)' }}>
                Apakah Anda yakin ingin menyetujui penerbitan surat tugas <b>PTV/ST/026/IX</b> untuk peliputan Haflah Akhirussanah?
              </p>
              <div style={{ marginBottom: '14px' }}>
                <PTVSelect
                  value={selectVal}
                  onChange={(v) => setSelectVal(v)}
                  options={sampleOptions}
                  ariaLabel="Pilih Alat Sertaan"
                />
              </div>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line-2)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button shape="pill" variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button shape="pill" variant="primary" size="sm" onClick={() => { setModalOpen(false); triggerToast('Surat tugas berhasil disetujui'); }}>
                Setujui Surat
              </Button>
            </div>
          </section>
        </>
      )}

      {/* ── MODAL WIDE INVENTARIS (760px–1060px) ── */}
      {modalWideOpen && (
        <>
          <div
            className="scrim on"
            onClick={() => setModalWideOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 80,
              backgroundColor: 'rgba(7,32,62,0.36)',
              backdropFilter: 'blur(4px)',
            }}
          />
          <section
            ref={modalWideRef}
            className="sheet on"
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 90,
              width: 'min(760px, 94vw)',
              borderRadius: 'var(--r-l, 24px)',
              backgroundColor: 'var(--surface, #FFFFFF)',
              boxShadow: 'var(--shadow-l)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '88vh',
            }}
          >
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Modal Wide Variant: Pemilihan Multi-Unit Peminjaman</h3>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Variant lebar terdokumentasi (760px) untuk tabel inventaris komparatif</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => setModalWideOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div style={{ padding: '18px 22px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                <div style={{ padding: '12px', borderRadius: 'var(--r-s)', background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                  <b>Unit 01 (Kondisi Baik)</b>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>SN: SN-A73-0091</p>
                </div>
                <div style={{ padding: '12px', borderRadius: 'var(--r-s)', background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                  <b>Unit 02 (Kondisi Baik)</b>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>SN: SN-A73-0092</p>
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line-2)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button shape="pill" variant="ghost" size="sm" onClick={() => setModalWideOpen(false)}>
                Tutup
              </Button>
              <Button shape="pill" variant="primary" size="sm" onClick={() => { setModalWideOpen(false); triggerToast('Unit terpilih ditambahkan ke keranjang!'); }}>
                Tambahkan 2 Unit
              </Button>
            </div>
          </section>
        </>
      )}

      {/* ── MOBILE BOTTOM SHEET (30px RADIUS ATAS) ── */}
      {sheetOpen && (
        <>
          <div
            className="scrim on"
            onClick={() => setSheetOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 80,
              backgroundColor: 'rgba(7,32,62,0.36)',
              backdropFilter: 'blur(4px)',
            }}
          />
          <section
            ref={sheetRef}
            className="sheet on"
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 90,
              borderTopLeftRadius: 'var(--r-xl, 30px)',
              borderTopRightRadius: 'var(--r-xl, 30px)',
              backgroundColor: 'var(--surface, #FFFFFF)',
              boxShadow: 'var(--shadow-l)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            }}
          >
            <div style={{ width: '40px', height: '4px', borderRadius: 'var(--r-full)', backgroundColor: 'var(--line)', margin: '10px auto 4px', flexShrink: 0 }} />
            <div style={{ padding: '10px 20px 14px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Menu Aksi Cepat Kru</h3>
              <button type="button" className="icon-btn" onClick={() => setSheetOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div style={{ padding: '16px 20px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  className="li"
                  onClick={() => { setSheetOpen(false); triggerToast('Membuka form izin santri...'); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: 'var(--ptv-curve-lg)',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--line-2)',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ width: '38px', height: '38px', borderRadius: 'var(--ptv-curve-md)', backgroundColor: 'var(--b-050)', color: 'var(--b-600)', display: 'grid', placeItems: 'center' }}>
                    <i className="fa-solid fa-shield-halved" />
                  </span>
                  <div>
                    <b style={{ fontSize: '14px', color: 'var(--ink)' }}>Ajukan Surat Izin</b>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>Izin keluar pondok atau membawa alat</span>
                  </div>
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
