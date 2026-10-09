import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inventarisService } from './inventarisService';
import { ItemInventaris, InventarisUnit } from './types';
import { loanBasketStore, LoanBasketItem } from './loanBasketStore';
import { peminjamanService } from '../peminjaman/peminjamanService';
import { PeminjamanRecord } from '../peminjaman/types';
import { LoanModal } from '../peminjaman/LoanModal';

export const AlatDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [asset, setAsset] = useState<ItemInventaris | null>(null);
  const [loans, setLoans] = useState<PeminjamanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);

  // Reactive subscription to loanBasketStore
  useSyncExternalStore(
    (cb) => loanBasketStore.subscribe(cb),
    () => loanBasketStore.getItems()
  );

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [assetData, allLoans] = await Promise.all([
          inventarisService.getInventarisById(id),
          peminjamanService.getPeminjamanList(),
        ]);
        if (isMounted) {
          setAsset(assetData);
          if (assetData) {
            // Match loans for this asset
            const matched = allLoans.filter((l) =>
              assetData.units.some((u) => u.id === l.unit_id || u.kode_unit === l.kode_unit) ||
              l.nama_alat.toLowerCase().includes(assetData.nama_alat.toLowerCase())
            );
            setLoans(matched);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="page" style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '10px', display: 'block' }} />
        <span>Memuat rincian aset inventaris...</span>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="page" style={{ padding: '40px 16px', textAlign: 'center' }}>
        <div className="empty card" style={{ maxWidth: '440px', margin: '40px auto' }}>
          <i className="fa-solid fa-box-open" style={{ fontSize: '32px', color: 'var(--muted)', marginBottom: '12px' }} />
          <h3>Alat tidak ditemukan</h3>
          <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '6px' }}>
            Data inventaris dengan ID ini tidak tersedia atau telah dihapus.
          </p>
          <button
            type="button"
            className="btn pri mt16"
            onClick={() => navigate('/hub/inventaris')}
          >
            <i className="fa-solid fa-arrow-left" style={{ marginRight: '6px' }} />
            Kembali ke Katalog
          </button>
        </div>
      </div>
    );
  }

  const total = asset.total_unit;
  const avail = asset.unit_tersedia;
  const borrowed = total - avail;
  const damaged = asset.units.filter((u) => u.kondisi === 'rusak').length;

  const inBasket = loanBasketStore.hasAsset(asset.id);

  const getCatIconMarkup = (catName: string) => {
    switch (catName.toLowerCase()) {
      case 'kamera':
        return <i className="fa-solid fa-camera-retro" />;
      case 'lensa':
        return <i className="fa-solid fa-circle-dot" />;
      case 'audio':
        return <i className="fa-solid fa-microphone-lines" />;
      case 'lighting':
        return <i className="fa-solid fa-lightbulb" />;
      case 'stabilizer':
      case 'tripod & rig':
      case 'tripod':
        return <i className="fa-solid fa-video" />;
      default:
        return <i className="fa-solid fa-boxes-stacked" />;
    }
  };

  const handleUnitBasketToggle = (u: InventarisUnit, unitIndex: number) => {
    const key = `${asset.id}_${u.id}`;
    const basketItem: LoanBasketItem = {
      key,
      assetId: asset.id,
      unitId: u.id,
      unitNo: unitIndex + 1,
      unitCode: u.kode_unit,
      unitName: `Unit ${unitIndex + 1}`,
      assetName: asset.nama_alat,
      invCode: asset.kode,
    };
    loanBasketStore.toggle(basketItem);
  };

  const handleQuickAddFirstAvailable = () => {
    const firstAvailIdx = asset.units.findIndex((u) => u.status_peminjaman === 'tersedia');
    if (firstAvailIdx !== -1) {
      handleUnitBasketToggle(asset.units[firstAvailIdx], firstAvailIdx);
    }
  };

  const fmtDate = (dStr?: string) => {
    if (!dStr) return '—';
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const mIdx = parseInt(parts[1], 10) - 1;
        return `${parseInt(parts[2], 10)} ${months[mIdx] || parts[1]} ${parts[0]}`;
      }
    } catch {
      // ignore
    }
    return dStr;
  };

  return (
    <div className="page">
      <div className="prod-detail-container">
        {/* ── 1. BREADCRUMBS NAVIGATION (1:1 LEGACY) ── */}
        <div className="prod-breadcrumb">
          <button type="button" onClick={() => navigate('/hub/inventaris')}>
            <i className="fa-solid fa-boxes-stacked" /> Inventaris
          </button>
          <span className="sep">
            <i className="fa-solid fa-chevron-right" />
          </span>
          <button type="button" onClick={() => navigate('/hub/inventaris')}>
            {asset.kategori}
          </button>
          <span className="sep">
            <i className="fa-solid fa-chevron-right" />
          </span>
          <span style={{ color: 'var(--ink)', fontWeight: 700 }} className="trunc">
            {asset.nama_alat}
          </span>
        </div>

        {/* ── 2. MAIN SHOWCASE CARD (2 COLUMNS 1:1 LEGACY) ── */}
        <div className="prod-showcase-card">
          {/* Left Column: Gallery & Image Showcase */}
          <div className="prod-gallery-col">
            <div className="prod-main-photo-wrap" id="prodMainPhotoWrap">
              {asset.foto_url ? (
                <img
                  id="prodMainImg"
                  src={asset.foto_url}
                  alt={asset.nama_alat}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className="prod-photo-fallback"
                style={{ display: asset.foto_url ? 'none' : 'flex' }}
              >
                {getCatIconMarkup(asset.kategori)}
              </div>
            </div>
          </div>

          {/* Right Column: Specs, Stats, Highlight Banner & CTAs */}
          <div className="prod-info-col">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <span className="chip blue" style={{ fontSize: '11px', fontWeight: 750, letterSpacing: '0.02em', padding: '2px 8px' }}>
                  {asset.kode}
                </span>
                <span className="chip" style={{ fontSize: '11px', fontWeight: 650, color: 'var(--muted)', background: 'var(--bg-2)', border: '1px solid var(--line-2)' }}>
                  {asset.kategori}
                </span>
              </div>
              <h1 className="prod-main-title">{asset.nama_alat}</h1>
              <div className="prod-subhead">
                <i className="fa-solid fa-microchip" style={{ marginRight: '5px', opacity: 0.7 }} />
                {asset.spesifikasi || 'Spesifikasi operasional standar laboratorium PTV'}
              </div>
            </div>

            {/* Curated gear health & stats pills */}
            <div className="prod-stats-bar">
              <span className="prod-stat-pill">
                <i className="fa-solid fa-shield-halved" style={{ color: '#2563eb' }} />
                <span>Kondisi Fisik: <b>Prima</b></span>
              </span>
              <span className="prod-stat-pill">
                <i className="fa-solid fa-clock-rotate-left" style={{ color: '#6366f1' }} />
                <span><b>{loans.length}x</b> Dipinjam</span>
              </span>
              <span className="prod-stat-pill">
                <i className="fa-solid fa-cubes-stacked" style={{ color: avail > 0 ? '#16a34a' : '#d97706' }} />
                <span>Ketersediaan: <b style={{ color: avail > 0 ? '#16a34a' : '#d97706' }}>{avail}/{total} Unit</b></span>
              </span>
            </div>

            {/* Apple-style Hardware Status Banner */}
            <div className={`prod-pricing-box ${avail === 0 ? (damaged > 0 ? 'is-danger' : 'is-warning') : ''}`}>
              <div className="prod-price-main">
                <span className="prod-price-label">
                  <i className={`fa-solid ${avail > 0 ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} /> STATUS KESIAPAN ALAT
                </span>
                <div className="prod-price-val">
                  {avail > 0 ? `${avail} Unit Siap Digunakan` : (borrowed > 0 ? 'Semua Unit Sedang Dipinjam' : 'Dalam Pemeliharaan / Servis')}
                </div>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 550, marginTop: '2px' }}>
                  <i className="fa-solid fa-building-columns" style={{ color: '#2563eb', marginRight: '4px' }} />
                  Sumber Dana: <b>{asset.sumber_perolehan || 'Yayasan'}</b> &bull; Lokasi: <b>{asset.units[0]?.lokasi_penyimpanan || 'Studio PTV'}</b>
                </span>
              </div>
              <div
                className="prod-price-badge"
                style={{
                  background: avail > 0 ? '#22c55e' : (damaged > 0 ? '#ef4444' : '#f59e0b'),
                  color: '#ffffff',
                }}
              >
                <i className={`fa-solid ${avail > 0 ? 'fa-check' : 'fa-info'}`} />
                <span>{avail > 0 ? `${avail} Tersedia` : 'Tidak Ada'}</span>
              </div>
            </div>

            {/* Sleek 2x2 Hardware Spec Cards Grid */}
            <div className="prod-spec-grid">
              <div className="prod-spec-card">
                <div className="prod-spec-card-icon"><i className="fa-solid fa-barcode" /></div>
                <div className="prod-spec-card-info">
                  <span className="label">Kode Inventaris</span>
                  <span className="val font-mono" style={{ color: 'var(--b-600)' }}>{asset.kode}</span>
                </div>
              </div>
              <div className="prod-spec-card">
                <div className="prod-spec-card-icon"><i className="fa-solid fa-layer-group" /></div>
                <div className="prod-spec-card-info">
                  <span className="label">Kategori</span>
                  <span className="val">{asset.kategori}</span>
                </div>
              </div>
              <div className="prod-spec-card">
                <div className="prod-spec-card-icon"><i className="fa-solid fa-location-dot" /></div>
                <div className="prod-spec-card-info">
                  <span className="label">Lokasi Penyimpanan</span>
                  <span className="val">{asset.units[0]?.lokasi_penyimpanan || 'Studio PTV'}</span>
                </div>
              </div>
              <div className="prod-spec-card">
                <div className="prod-spec-card-icon"><i className="fa-solid fa-building-columns" /></div>
                <div className="prod-spec-card-info">
                  <span className="label">Sumber Perolehan</span>
                  <span className="val">{asset.sumber_perolehan || 'Yayasan'}</span>
                </div>
              </div>
            </div>

            {/* Primary Borrow CTA Buttons */}
            <div className="prod-cta-area" style={{ marginTop: 'auto', paddingTop: '14px' }}>
              {avail > 0 ? (
                <>
                  <button
                    type="button"
                    className={`prod-btn-basket ${inBasket ? 'added' : ''}`}
                    onClick={handleQuickAddFirstAvailable}
                  >
                    <i className={`fa-solid ${inBasket ? 'fa-check' : 'fa-clipboard-list'}`} />
                    <span>{inBasket ? 'Ada di Daftar Pinjaman' : '+ Daftar Pinjaman'}</span>
                  </button>
                  <button
                    type="button"
                    className="prod-btn-primary-borrow"
                    onClick={() => setIsLoanModalOpen(true)}
                  >
                    <i className="fa-solid fa-hand-holding-hand" />
                    <span>Pinjam Sekarang ({avail} Tersedia)</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn block"
                  disabled
                  style={{ opacity: 0.65, minHeight: '44px', borderRadius: 'var(--r-m)' }}
                >
                  <i className="fa-solid fa-ban" style={{ marginRight: '6px' }} />
                  Seluruh Unit Sedang Tidak Tersedia
                </button>
              )}
            </div>
          </div>

          {/* ── FULL-WIDTH HORIZONTAL UNIT CAROUSEL SECTION (1:1 LEGACY) ── */}
          <div className="prod-unit-section full-width">
            <div className="prod-unit-header">
              <span>Rincian Tiap Unit Fisik ({total} Unit)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div className="inv-cat-nav-btns" style={{ display: 'inline-flex', marginRight: '2px' }}>
                  <button
                    type="button"
                    className="inv-cat-nav-btn"
                    onClick={() => {
                      const el = document.getElementById('prodUnitCardsScroll');
                      if (el) el.scrollBy({ left: -240, behavior: 'smooth' });
                    }}
                    aria-label="Geser Unit ke Kiri"
                  >
                    <i className="fa-solid fa-chevron-left" />
                  </button>
                  <button
                    type="button"
                    className="inv-cat-nav-btn"
                    onClick={() => {
                      const el = document.getElementById('prodUnitCardsScroll');
                      if (el) el.scrollBy({ left: 240, behavior: 'smooth' });
                    }}
                    aria-label="Geser Unit ke Kanan"
                  >
                    <i className="fa-solid fa-chevron-right" />
                  </button>
                </div>
              </div>
            </div>

            {/* List Menyamping Unit Cards */}
            <div className="prod-unit-cards-scroll" id="prodUnitCardsScroll">
              {asset.units.map((u, idx) => {
                const isAvail = u.status_peminjaman === 'tersedia';
                const isBorrowed = u.status_peminjaman === 'dipinjam';
                const isDamaged = u.kondisi === 'rusak';
                const uKey = `${asset.id}_${u.id}`;
                const isUnitInBasket = loanBasketStore.has(uKey);

                let cardClass = '';
                if (isBorrowed) cardClass += ' is-borrowed';
                if (isDamaged) cardClass += ' is-damaged';

                const statusLabel = isAvail ? 'Tersedia' : isDamaged ? 'Rusak' : 'Dipinjam';
                const statusChipClass = isAvail ? 'ok' : isDamaged ? 'dang' : 'warn';

                return (
                  <div key={u.id} className={`prod-unit-hcard${cardClass}`}>
                    <div className="prod-unit-hcard-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px' }}>
                        <span className="chip" style={{ fontSize: '10.5px', fontWeight: 750, color: '#2563eb', background: '#eff6ff', padding: '1px 7px' }}>
                          Unit {idx + 1}
                        </span>
                        <span className={`chip ${statusChipClass}`} style={{ fontSize: '10px', padding: '1px 7px', fontWeight: 750 }}>
                          {statusLabel}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <span
                          className="u-status-dot"
                          style={{
                            display: 'inline-block',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: isAvail ? '#22c55e' : isDamaged ? '#ef4444' : '#f59e0b',
                          }}
                        />
                        <span className="prod-unit-hcard-name">Unit #{idx + 1}</span>
                        <span className="chip blue" style={{ fontSize: '10.5px', fontWeight: 750, letterSpacing: '0.02em', padding: '1px 7px' }}>
                          {u.kode_unit}
                        </span>
                      </div>
                    </div>

                    <div className="prod-unit-hcard-body">
                      <span className="prod-unit-hcard-cond">
                        Kondisi: <b>{u.kondisi.toUpperCase()}</b>
                      </span>
                      {u.nomor_seri && (
                        <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginTop: '2px' }}>
                          SN: {u.nomor_seri}
                        </span>
                      )}
                      {isBorrowed && (
                        <span className="prod-unit-hcard-loan">
                          <i className="fa-solid fa-user-clock" style={{ marginRight: '4px' }} />
                          Sedang Dipinjam
                        </span>
                      )}
                    </div>

                    <div className="prod-unit-hcard-actions">
                      {isAvail ? (
                        <button
                          type="button"
                          className={`btn sm ${isUnitInBasket ? '' : 'pri'}`}
                          onClick={() => handleUnitBasketToggle(u, idx)}
                          style={{
                            flex: 1,
                            fontSize: '11.5px',
                            padding: '5px 10px',
                            minHeight: '30px',
                            borderRadius: '8px',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <i className={`fa-solid ${isUnitInBasket ? 'fa-check' : 'fa-box-archive'}`} style={{ marginRight: '4px' }} />
                          {isUnitInBasket ? 'Dipilih' : 'Pinjam Unit Ini'}
                        </button>
                      ) : (
                        <span style={{ flex: 1, fontSize: '11px', color: 'var(--muted)', textAlign: 'center', alignSelf: 'center' }}>
                          {isBorrowed ? 'Unit sedang dipinjam' : 'Unit butuh perbaikan'}
                        </span>
                      )}
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => navigate('/hub/kerusakan')}
                        style={{ fontSize: '11.5px', padding: '5px 9px', minHeight: '30px', color: '#d97706', borderRadius: '8px' }}
                        title="Lapor Kerusakan"
                      >
                        <i className="fa-solid fa-wrench" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── 3. BOTTOM INFORMATION SECTIONS (1:1 LEGACY) ── */}
        <div className="prod-bottom-sections">
          {/* Spesifikasi Teknis & Catatan */}
          <div className="prod-section-card">
            <div className="prod-section-header">
              <div className="prod-section-title-wrap">
                <div className="prod-section-icon-badge">
                  <i className="fa-solid fa-file-lines" />
                </div>
                <div>
                  <h3 className="prod-section-title">Spesifikasi &amp; Catatan Teknis</h3>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 550, marginTop: '2px' }}>
                    Dokumentasi operasional dan rincian parameter alat
                  </div>
                </div>
              </div>
            </div>
            <div className="prod-tech-specs-box">
              <p className="prod-tech-specs-body">
                {asset.spesifikasi || 'Spesifikasi operasional standar laboratorium Progresif TV.'}
              </p>
            </div>
          </div>

          {/* Riwayat Peminjaman Alat (Jejak Sirkulasi) */}
          <div className="prod-section-card">
            <div className="prod-section-header">
              <div className="prod-section-title-wrap">
                <div className="prod-section-icon-badge emerald">
                  <i className="fa-solid fa-clock-rotate-left" />
                </div>
                <div>
                  <h3 className="prod-section-title">
                    <span>Riwayat Aktivitas &amp; Peminjaman</span>
                    <span className="prod-section-count-chip">{loans.length} Log</span>
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 550, marginTop: '2px' }}>
                    Jejak sirkulasi penggunaan unit alat oleh praktikan atau teknisi
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600 }}>
                Total: {loans.length} peminjaman
              </span>
            </div>

            {loans.length > 0 ? (
              <div className="stack gap12">
                {loans.map((l) => {
                  const isBack = l.status === 'dikembalikan';
                  return (
                    <div
                      key={l.id}
                      className="loan-hist-card"
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '14px 16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                      }}
                    >
                      <div
                        className="loan-hist-ic"
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isBack ? '#16a34a' : '#2563eb',
                          flexShrink: 0,
                        }}
                      >
                        <i className={`fa-solid ${isBack ? 'fa-circle-check' : 'fa-hand-holding'}`} />
                      </div>
                      <div className="loan-hist-main" style={{ flex: 1, minWidth: 0 }}>
                        <div className="loan-hist-row-top" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span className="loan-hist-name" style={{ fontSize: '13.5px', fontWeight: 750, color: '#0f172a' }}>
                            {l.peminjam_nama}
                          </span>
                          <span className="loan-hist-dot" style={{ color: '#cbd5e1' }}>&bull;</span>
                          <span className="loan-hist-range" style={{ fontSize: '12px', color: '#64748b', fontWeight: 550 }}>
                            {fmtDate(l.tanggal_pinjam)} &rarr; {isBack ? `${fmtDate(l.tanggal_kembali)} (Kembali)` : <span style={{ color: '#d97706', fontWeight: 650 }}>Belum kembali</span>}
                          </span>
                          {isBack ? (
                            <span className="chip ok" style={{ fontSize: '10.5px', padding: '2px 8px', fontWeight: 700 }}>
                              <i className="fa-solid fa-check" style={{ marginRight: '4px' }} /> Dikembalikan
                            </span>
                          ) : (
                            <span className="chip info" style={{ fontSize: '10.5px', padding: '2px 8px', fontWeight: 700 }}>
                              <i className="fa-solid fa-clock" style={{ marginRight: '4px' }} /> Dipinjam
                            </span>
                          )}
                        </div>
                        {l.keperluan && (
                          <div className="loan-hist-desc" style={{ fontSize: '12px', color: '#475569', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-regular fa-bookmark" style={{ fontSize: '10px', color: '#94a3b8' }} />
                            <span>{l.keperluan}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="prod-empty-history">
                <div className="prod-empty-history-icon">
                  <i className="fa-solid fa-clock-rotate-left" />
                </div>
                <h4 className="prod-empty-history-title">Belum Ada Riwayat Peminjaman</h4>
                <p className="prod-empty-history-desc">
                  Alat ini belum pernah tercatat dipinjam. Seluruh unit siap digunakan untuk kebutuhan laboratorium dan kegiatan.
                </p>
                <div className="prod-empty-history-badge">
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
                  <span>Semua Unit Tersedia</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── LOAN MODAL (MULTI-UNIT CHECKOUT DRAWER) ── */}
      <LoanModal
        isOpen={isLoanModalOpen}
        onClose={() => setIsLoanModalOpen(false)}
        presetAssetId={asset.id}
        presetUnit={1}
      />
    </div>
  );
};
