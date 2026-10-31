import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inventarisService, normalizeKondisiUnit, isUnitAvailable } from './inventarisService';
import { ItemInventaris, InventarisUnit } from './types';
import { loanBasketStore, LoanBasketItem } from './loanBasketStore';
import { peminjamanService } from '../peminjaman/peminjamanService';
import { PeminjamanRecord } from '../peminjaman/types';
import { LoanModal } from '../peminjaman/LoanModal';
import { useSessionStore } from '@core/session';
import { EditAlatModal } from './EditAlatModal';
import { UnitBarcodesSection } from './UnitBarcodesSection';
import { resolveInventoryPhotoUrl } from './utils/inventoryPhotoUtils';
import { canDeleteInventory } from './utils/inventoryPermissions';
import { SmartDeleteInventarisModal } from './components/SmartDeleteInventarisModal';
import { DocDetailSkeleton } from '@/shared/components';

export const AlatDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [asset, setAsset] = useState<ItemInventaris | null>(null);
  const [loans, setLoans] = useState<PeminjamanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loansLoading, setLoansLoading] = useState(false);
  const [loansError, setLoansError] = useState<string | null>(null);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSmartDeleteModalOpen, setIsSmartDeleteModalOpen] = useState(false);
  const { can, user } = useSessionStore();
  const canDelete = canDeleteInventory(user, can);
  const fetchIdRef = React.useRef(0);

  // Reactive subscription to loanBasketStore
  useSyncExternalStore(
    (cb) => loanBasketStore.subscribe(cb),
    () => loanBasketStore.getItems(),
    () => []
  );

  const fetchLoansForAsset = async (assetData: ItemInventaris) => {
    setLoansLoading(true);
    setLoansError(null);
    try {
      const allLoans = await peminjamanService.getPeminjamanList();

      const validUnitIds = new Set<string>();
      const validUnitCodes = new Set<string>();

      if (assetData.id) validUnitIds.add(String(assetData.id).trim().toLowerCase());
      if (assetData.kode) validUnitCodes.add(String(assetData.kode).trim().toLowerCase());

      for (const u of assetData.units || []) {
        if (u.id) validUnitIds.add(String(u.id).trim().toLowerCase());
        if (u.kode_unit) validUnitCodes.add(String(u.kode_unit).trim().toLowerCase());
      }

      const cleanAssetName = (assetData.nama_alat || '').trim().toLowerCase();

      const matched = allLoans.filter((l) => {
        const loanUnitId = (l.unit_id || '').trim().toLowerCase();
        const loanUnitCode = (l.kode_unit || '').trim().toLowerCase();
        const loanItemName = (l.nama_alat || '').trim().toLowerCase();

        // 1. Cocokkan ID unit fisik atau master inventaris
        if (loanUnitId && validUnitIds.has(loanUnitId)) return true;

        // 2. Cocokkan kode unit fisik atau kode master inventaris
        if (loanUnitCode && validUnitCodes.has(loanUnitCode)) return true;

        // 3. Cocokkan prefix kode unit (misal 'INV-001-01' saat asset.kode adalah 'INV-001')
        if (assetData.kode && loanUnitCode && loanUnitCode.startsWith(assetData.kode.trim().toLowerCase() + '-')) return true;

        // 4. Fallback nama alat identik (transaksi warisan)
        if (cleanAssetName && loanItemName === cleanAssetName) return true;

        return false;
      });

      // Urutkan riwayat: pinjaman terbaru di atas
      matched.sort((a, b) => {
        const dateA = a.created_at || a.tanggal_pinjam || '';
        const dateB = b.created_at || b.tanggal_pinjam || '';
        return dateB.localeCompare(dateA);
      });

      setLoans(matched);
    } catch (err: any) {
      setLoansError(err?.message || 'Gagal memuat riwayat peminjaman dari sistem.');
    } finally {
      setLoansLoading(false);
    }
  };

  const fetchData = async (silent = false) => {
    if (!id) return;
    const currentFetchId = ++fetchIdRef.current;
    if (!silent) setLoading(true);
    try {
      const assetData = await inventarisService.getInventarisById(id);
      if (currentFetchId !== fetchIdRef.current) return;
      setAsset(assetData);
      if (assetData) {
        await fetchLoansForAsset(assetData);
      }
    } finally {
      if (currentFetchId === fetchIdRef.current && !silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  if (loading && !asset) {
    return (
      <div className="page" style={{ maxWidth: '1060px', margin: '0 auto', padding: '16px' }}>
        <DocDetailSkeleton />
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

  const total = asset.units.length || asset.total_unit;
  const avail = asset.units.filter((u) => isUnitAvailable(u.status_peminjaman, u.kondisi)).length;
  const borrowed = asset.units.filter((u) => (u.status_peminjaman || '').toLowerCase() === 'dipinjam').length;
  const damaged = asset.units.filter((u) => normalizeKondisiUnit(u.kondisi) === 'rusak').length;
  const inService = asset.units.filter((u) => normalizeKondisiUnit(u.kondisi) === 'perlu_servis').length;
  const lost = asset.units.filter((u) => normalizeKondisiUnit(u.kondisi) === 'hilang').length;

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

  const isUnitEligibleForLoan = (u: InventarisUnit) => {
    return isUnitAvailable(u.status_peminjaman, u.kondisi);
  };

  const getKondisiSummary = (units: InventarisUnit[]) => {
    if (!units || units.length === 0) {
      return {
        label: 'Belum Ada Unit',
        color: 'var(--muted)',
        icon: 'fa-circle-question',
      };
    }
    const bagusCount = units.filter((u) => normalizeKondisiUnit(u.kondisi) === 'bagus').length;
    const perluServisCount = units.filter((u) => normalizeKondisiUnit(u.kondisi) === 'perlu_servis').length;
    const rusakCount = units.filter((u) => normalizeKondisiUnit(u.kondisi) === 'rusak').length;
    const hilangCount = units.filter((u) => normalizeKondisiUnit(u.kondisi) === 'hilang').length;

    if (bagusCount === units.length) {
      return {
        label: 'Semua Baik',
        color: 'var(--ok)',
        icon: 'fa-shield-halved',
      };
    }

    const parts: string[] = [];
    if (bagusCount > 0) parts.push(`${bagusCount} Baik`);
    if (perluServisCount > 0) parts.push(`${perluServisCount} Perlu Servis`);
    if (rusakCount > 0) parts.push(`${rusakCount} Rusak`);
    if (hilangCount > 0) parts.push(`${hilangCount} Hilang`);

    const hasDanger = rusakCount > 0 || hilangCount > 0;
    return {
      label: parts.join(' · '),
      color: hasDanger ? 'var(--dang)' : 'var(--warn)',
      icon: hasDanger ? 'fa-triangle-exclamation' : 'fa-wrench',
    };
  };

  const handleUnitBasketToggle = (u: InventarisUnit, unitIndex: number) => {
    if (!isUnitEligibleForLoan(u)) return; // Blokir keras unit yang tidak layak pinjam
    const key = `${asset.id}_${u.id}`;
    const basketItem: LoanBasketItem = {
      key,
      assetId: asset.id,
      unitId: u.id,
      unitNo: unitIndex + 1,
      unitCode: u.kode_unit,
      unitName: u.nama_unit?.trim() || `Unit ${unitIndex + 1}`,
      assetName: asset.nama_alat,
      invCode: asset.kode,
    };
    loanBasketStore.toggle(basketItem);
  };

  const handleQuickAddFirstAvailable = () => {
    const firstAvailIdx = asset.units.findIndex((u) => isUnitEligibleForLoan(u));
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
        {/* ── BACK BUTTON & BREADCRUMBS ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn sec sm"
            onClick={() => navigate(-1)}
            style={{
              borderRadius: 'var(--ptv-curve-pill, 9999px)',
              padding: '6px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="fa-solid fa-arrow-left" />
            <span>Kembali ke Inventaris</span>
          </button>
          <div className="prod-breadcrumb" style={{ margin: 0 }}>
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
        </div>

        {/* ── 2. MAIN SHOWCASE CARD (2 COLUMNS 1:1 LEGACY) ── */}
        <div className="prod-showcase-card">
          {/* Left Column: Gallery & Image Showcase */}
          <div className="prod-gallery-col">
            <div className="prod-main-photo-wrap" id="prodMainPhotoWrap">
              {(() => {
                const resolvedPhoto = resolveInventoryPhotoUrl(asset.foto_url);
                return (
                  <>
                    {resolvedPhoto ? (
                      <img
                        id="prodMainImg"
                        src={resolvedPhoto}
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
                      style={{ display: resolvedPhoto ? 'none' : 'flex' }}
                    >
                      {getCatIconMarkup(asset.kategori)}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Right Column: Specs, Stats, Highlight Banner & CTAs */}
          <div className="prod-info-col">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="chip blue" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em', padding: '2px 8px' }}>
                    {asset.kode}
                  </span>
                  <span className="chip" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', background: 'var(--bg-2)', border: '1px solid var(--line-2)' }}>
                    {asset.kategori}
                  </span>
                </div>
                {can('inventory.edit') && (
                  <button
                    type="button"
                    className="btn sec sm"
                    id="btnEditAlat"
                    style={{
                      borderRadius: 'var(--r-ref-full, 9999px)',
                      fontWeight: 600,
                      fontSize: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 14px',
                      border: '1px solid var(--line-2)',
                      background: 'var(--surface, var(--card-bg, #ffffff))',
                      color: 'var(--ink)',
                      cursor: 'pointer'
                    }}
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--b-600)' }} />
                    <span>Edit Data Alat</span>
                  </button>
                )}
              </div>
              <h1 className="prod-main-title">{asset.nama_alat}</h1>
              <div className="prod-subhead">
                <i className="fa-solid fa-microchip" style={{ marginRight: '5px', opacity: 0.7 }} />
                {asset.spesifikasi || 'Spesifikasi operasional standar laboratorium PTV'}
              </div>
            </div>

            {/* Curated gear health & stats pills */}
            <div className="prod-stats-bar">
              {(() => {
                const cond = getKondisiSummary(asset.units);
                return (
                  <span className="prod-stat-pill" title={`Kondisi Fisik: ${cond.label}`}>
                    <i className={`fa-solid ${cond.icon}`} style={{ color: cond.color }} />
                    <span>Kondisi Fisik: <b style={{ color: cond.color }}>{cond.label}</b></span>
                  </span>
                );
              })()}
              {loans.length > 0 && (
                <span className="prod-stat-pill">
                  <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--b-600)' }} />
                  <span><b>{loans.length}x</b> Dipinjam</span>
                </span>
              )}
              <span className="prod-stat-pill">
                <i className="fa-solid fa-cubes-stacked" style={{ color: avail > 0 ? 'var(--ok)' : 'var(--warn)' }} />
                <span>Ketersediaan: <b style={{ color: avail > 0 ? 'var(--ok)' : 'var(--warn)' }}>{avail}/{total} Unit</b></span>
              </span>
            </div>

            {/* Apple-style Hardware Status Banner */}
            <div className={`prod-pricing-box ${avail === 0 ? (damaged > 0 ? 'is-danger' : 'is-warning') : ''}`}>
              <div className="prod-price-main">
                <span className="prod-price-label">
                  <i className={`fa-solid ${avail > 0 ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} /> STATUS KESIAPAN ALAT
                </span>
                <div className="prod-price-val">
                  {avail > 0
                    ? `${avail} Unit Siap Digunakan`
                    : borrowed > 0
                    ? 'Semua Unit Sedang Dipinjam'
                    : inService > 0
                    ? 'Dalam Pemeliharaan / Butuh Servis'
                    : lost > 0
                    ? 'Unit Dilaporkan Hilang'
                    : 'Seluruh Unit Rusak'}
                </div>
              </div>
              <div
                className="prod-price-badge"
                style={{
                  background: avail > 0 ? 'var(--ok)' : (damaged > 0 ? 'var(--dang)' : 'var(--warn)'),
                  color: '#ffffff',
                }}
              >
                <i className={`fa-solid ${avail > 0 ? 'fa-check' : 'fa-info'}`} />
                <span>{avail > 0 ? `${avail} Siap` : 'Tidak Ada'}</span>
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
            <div className="prod-cta-area" style={{ paddingTop: '14px' }}>
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
                  style={{ opacity: 0.65, minHeight: '44px', borderRadius: 'var(--ptv-curve-md)' }}
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
              <div className="prod-unit-desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                const isBorrowed = (u.status_peminjaman || '').toLowerCase() === 'dipinjam';
                const normK = normalizeKondisiUnit(u.kondisi);
                const isDamaged = normK === 'rusak';
                const isServiceNeeded = normK === 'perlu_servis';
                const isLost = normK === 'hilang';
                const isEligible = isUnitEligibleForLoan(u);

                const uKey = `${asset.id}_${u.id}`;
                const isUnitInBasket = loanBasketStore.has(uKey);

                let cardClass = '';
                if (isBorrowed) cardClass += ' is-borrowed';
                if (isDamaged || isServiceNeeded || isLost) cardClass += ' is-damaged';

                // Status chip & dot: pisahkan kondisi fisik dari status peminjaman
                let statusLabel = 'Siap Digunakan';
                let statusChipClass = 'ok';
                let statusDotColor = 'var(--ok)';
                let statusReason = '';

                if (isBorrowed) {
                  statusLabel = 'Dipinjam';
                  statusChipClass = 'warn';
                  statusDotColor = 'var(--warn)';
                  statusReason = 'Unit sedang dipinjam';
                } else if (isDamaged) {
                  statusLabel = 'Rusak';
                  statusChipClass = 'dang';
                  statusDotColor = 'var(--dang)';
                  statusReason = 'Unit rusak — tidak dapat dipinjam';
                } else if (isServiceNeeded) {
                  statusLabel = 'Perlu Servis';
                  statusChipClass = 'warn';
                  statusDotColor = 'var(--warn)';
                  statusReason = 'Unit butuh servis — tidak dapat dipinjam';
                } else if (isLost) {
                  statusLabel = 'Hilang';
                  statusChipClass = 'dang';
                  statusDotColor = 'var(--dang)';
                  statusReason = 'Unit dilaporkan hilang';
                }

                // Kondisi label ramah pengguna
                const kondisiLabel =
                  normK === 'bagus' ? 'Baik' : normK === 'perlu_servis' ? 'Perlu Servis' : normK === 'hilang' ? 'Hilang' : 'Rusak';
                const kondisiColor =
                  normK === 'bagus' ? 'var(--ok)' : normK === 'perlu_servis' ? 'var(--warn)' : 'var(--dang)';

                const unitDisplayName = u.nama_unit?.trim() || `Unit ${idx + 1}`;
                const serialNumberDisplay = u.nomor_seri && u.nomor_seri.trim() ? u.nomor_seri.trim() : 'Belum diisi';

                return (
                  <div key={u.id} className={`prod-unit-hcard${cardClass}`}>
                    <div className="prod-unit-hcard-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px' }}>
                        <span className="chip" style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--b-600)', background: 'var(--b-050)', padding: '1px 7px' }}>
                          Unit {idx + 1}
                        </span>
                        <span className={`chip ${statusChipClass}`} style={{ fontSize: '10px', padding: '1px 7px', fontWeight: 700 }}>
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
                            background: statusDotColor,
                          }}
                        />
                        <span className="prod-unit-hcard-name" title={unitDisplayName}>{unitDisplayName}</span>
                        <span className="chip blue" style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.02em', padding: '1px 7px' }}>
                          {u.kode_unit}
                        </span>
                      </div>
                    </div>

                    <div className="prod-unit-hcard-body">
                      <div className="prod-unit-hcard-cond" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Kondisi Fisik:</span>
                        <b style={{ color: kondisiColor }}>{kondisiLabel}</b>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                        Nomor Seri: <b style={{ fontFamily: 'monospace', color: u.nomor_seri ? 'var(--ink)' : 'var(--muted)' }}>{serialNumberDisplay}</b>
                      </div>
                      {isBorrowed && (
                        <span className="prod-unit-hcard-loan" style={{ marginTop: '4px' }}>
                          <i className="fa-solid fa-user-clock" style={{ marginRight: '4px' }} />
                          Sedang Dipinjam
                        </span>
                      )}
                    </div>

                    <div className="prod-unit-hcard-actions">
                      {isEligible ? (
                        <button
                          type="button"
                          className={`btn sm ${isUnitInBasket ? '' : 'pri'}`}
                          onClick={() => handleUnitBasketToggle(u, idx)}
                          style={{
                            flex: 1,
                            fontSize: '11.5px',
                            padding: '5px 10px',
                            minHeight: '30px',
                            borderRadius: 'var(--ptv-curve-sm)',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <i className={`fa-solid ${isUnitInBasket ? 'fa-check' : 'fa-box-archive'}`} style={{ marginRight: '4px' }} />
                          {isUnitInBasket ? 'Dipilih' : 'Pinjam Unit Ini'}
                        </button>
                      ) : (
                        <span
                          style={{
                            flex: 1,
                            fontSize: '11px',
                            color: isDamaged ? 'var(--dang)' : isServiceNeeded ? 'var(--warn)' : 'var(--muted)',
                            textAlign: 'center',
                            alignSelf: 'center',
                            fontWeight: 600,
                            lineHeight: 1.3,
                          }}
                        >
                          {statusReason}
                        </span>
                      )}
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => navigate(`/hub/kerusakan?asset=${encodeURIComponent(asset.id)}&unit=${encodeURIComponent(u.id)}`)}
                        style={{ fontSize: '11.5px', padding: '5px 9px', minHeight: '30px', color: 'var(--warn)', borderRadius: 'var(--ptv-curve-sm)' }}
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
          {/* Spesifikasi Teknis & Catatan (INV-08: Hanya tampil jika berbeda dari deskripsi utama) */}
          {(() => {
            const primaryDesc = (asset.spesifikasi || '').trim();
            const additionalNotes = (asset.nilai_inventaris?.catatan || '').trim();
            const hasDistinctSpecs = additionalNotes && additionalNotes.toLowerCase() !== primaryDesc.toLowerCase();
            if (!hasDistinctSpecs) return null;

            return (
              <div className="prod-section-card">
                <div className="prod-section-header">
                  <div className="prod-section-title-wrap">
                    <div className="prod-section-icon-badge">
                      <i className="fa-solid fa-file-lines" />
                    </div>
                    <div>
                      <h3 className="prod-section-title">Spesifikasi &amp; Catatan Teknis</h3>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500, marginTop: '2px' }}>
                        Dokumentasi operasional dan rincian parameter tambahan alat
                      </div>
                    </div>
                  </div>
                </div>
                <div className="prod-tech-specs-box">
                  <p className="prod-tech-specs-body">{additionalNotes}</p>
                </div>
              </div>
            );
          })()}

          {/* ── LABEL BARCODE UNIT (STANDAR CODE 128 SCANNER FISIK) ── */}
          <UnitBarcodesSection asset={asset} />

          {/* Riwayat Peminjaman Alat (Jejak Sirkulasi) — INV-09: Ringkas & tanpa leak internal */}
          <div className="prod-section-card">
            <div className="prod-section-header">
              <div className="prod-section-title-wrap">
                <div className="prod-section-icon-badge emerald">
                  <i className="fa-solid fa-clock-rotate-left" />
                </div>
                <div>
                  <h3 className="prod-section-title">
                    <span>Riwayat Peminjaman</span>
                    <span className="prod-section-count-chip">
                      {loansLoading ? '...' : `${loans.length} Log`}
                    </span>
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500, marginTop: '2px' }}>
                    Jejak sirkulasi dan histori penggunaan unit alat
                  </div>
                </div>
              </div>
              {!loansLoading && !loansError && loans.length > 0 && (
                <span style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600 }}>
                  Total: {loans.length} peminjaman
                </span>
              )}
            </div>

            {loansLoading ? (
              <div className="prod-empty-history-compact" style={{ padding: '24px 16px' }}>
                <div className="prod-empty-history-icon-compact">
                  <i className="fa-solid fa-circle-notch fa-spin" />
                </div>
                <div>
                  <h4 className="prod-empty-history-title-compact">Memuat Riwayat Peminjaman...</h4>
                  <p className="prod-empty-history-desc-compact">
                    Mengambil catatan transaksi peminjaman asli dari sistem.
                  </p>
                </div>
              </div>
            ) : loansError ? (
              <div
                style={{
                  padding: '16px',
                  background: 'var(--dang-bg, #fef2f2)',
                  border: '1px solid var(--dang-border, #fecaca)',
                  borderRadius: 'var(--ptv-curve-md)',
                  color: 'var(--dang, #dc2626)',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '16px', flexShrink: 0 }} />
                  <span>{loansError}</span>
                </div>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => asset && fetchLoansForAsset(asset)}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  <i className="fa-solid fa-rotate-right" style={{ marginRight: '4px' }} />
                  Coba Lagi
                </button>
              </div>
            ) : loans.length > 0 ? (
              <div className="stack gap12">
                {loans.map((l) => {
                  const isBack = l.status === 'dikembalikan';
                  const isLate = l.status === 'terlambat';
                  return (
                    <div
                      key={l.id}
                      className="loan-hist-card"
                      style={{
                        background: 'var(--surface, var(--bg-card, #ffffff))',
                        border: '1px solid var(--line-2)',
                        borderRadius: 'var(--ptv-curve-lg)',
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
                          borderRadius: 'var(--ptv-curve-md)',
                          background: 'var(--bg-2)',
                          border: '1px solid var(--line-2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isBack ? 'var(--ok)' : isLate ? 'var(--dang)' : 'var(--b-600)',
                          flexShrink: 0,
                        }}
                      >
                        <i className={`fa-solid ${isBack ? 'fa-circle-check' : isLate ? 'fa-triangle-exclamation' : 'fa-hand-holding'}`} />
                      </div>
                      <div className="loan-hist-main" style={{ flex: 1, minWidth: 0 }}>
                        <div className="loan-hist-row-top" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span className="loan-hist-name" style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)' }}>
                            {l.peminjam_nama}
                          </span>
                          {l.kode_unit && (
                            <span className="chip blue" style={{ fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}>
                              {l.kode_unit}
                            </span>
                          )}
                          <span className="loan-hist-dot" style={{ color: 'var(--muted)' }}>&bull;</span>
                          <span className="loan-hist-range" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
                            {fmtDate(l.tanggal_pinjam)} &rarr; {isBack ? `${fmtDate(l.tanggal_kembali || l.tenggat_kembali)} (Kembali)` : isLate ? <span style={{ color: 'var(--dang)', fontWeight: 600 }}>Terlambat (Tenggat: {fmtDate(l.tenggat_kembali)})</span> : <span style={{ color: 'var(--warn)', fontWeight: 600 }}>Tenggat: {fmtDate(l.tenggat_kembali)}</span>}
                          </span>
                          {isBack ? (
                            <span className="chip ok" style={{ fontSize: '10.5px', padding: '2px 8px', fontWeight: 700 }}>
                              <i className="fa-solid fa-check" style={{ marginRight: '4px' }} /> Dikembalikan
                            </span>
                          ) : isLate ? (
                            <span className="chip dang" style={{ fontSize: '10.5px', padding: '2px 8px', fontWeight: 700 }}>
                              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '4px' }} /> Terlambat
                            </span>
                          ) : (
                            <span className="chip info" style={{ fontSize: '10.5px', padding: '2px 8px', fontWeight: 700 }}>
                              <i className="fa-solid fa-clock" style={{ marginRight: '4px' }} /> Dipinjam
                            </span>
                          )}
                        </div>
                        {l.keperluan && (
                          <div className="loan-hist-desc" style={{ fontSize: '12px', color: 'var(--ink)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-regular fa-bookmark" style={{ fontSize: '10px', color: 'var(--muted)' }} />
                            <span>{l.keperluan}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="prod-empty-history-compact">
                <div className="prod-empty-history-icon-compact">
                  <i className="fa-solid fa-clock-rotate-left" />
                </div>
                <div>
                  <h4 className="prod-empty-history-title-compact">Belum Ada Riwayat Peminjaman</h4>
                  <p className="prod-empty-history-desc-compact">
                    Alat ini belum memiliki catatan transaksi peminjaman aktif. Seluruh unit siap digunakan.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── 4. ZONA PENGELOLAAN & KEAMANAN ASET (ADMINISTRATIF) ── */}
          {canDelete && (
            <div className="prod-section-card prod-danger-zone-card" id="dangerZoneSection">
              <div className="prod-danger-zone-inner">
                <div className="prod-danger-zone-info">
                  <div className="prod-danger-zone-icon">
                    <i className="fa-solid fa-shield-halved" />
                  </div>
                  <div>
                    <h4 className="prod-danger-zone-title">Pengelolaan &amp; Keamanan Aset</h4>
                    <p className="prod-danger-zone-desc">
                      Audit keterkaitan sirkulasi alat, riwayat peminjaman, serta prosedur pengarsipan atau penghapusan data aset inventaris.
                    </p>
                  </div>
                </div>
                <div className="prod-danger-zone-action">
                  <button
                    type="button"
                    id="btnSmartDeleteAsset"
                    className="btn-danger-outline"
                    onClick={() => setIsSmartDeleteModalOpen(true)}
                  >
                    <i className="fa-regular fa-trash-can" />
                    <span>Hapus / Arsipkan Inventaris</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── LOAN MODAL (MULTI-UNIT CHECKOUT DRAWER) ── */}
      <LoanModal
        isOpen={isLoanModalOpen}
        onClose={() => setIsLoanModalOpen(false)}
        presetAssetId={asset.id}
        presetUnit={1}
        onSuccess={() => fetchData(true)}
      />
      {/* ── EDIT ALAT MODAL ── */}
      {asset && (
        <EditAlatModal
          isOpen={isEditModalOpen}
          asset={asset}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={(updated) => {
            setAsset(updated);
            setIsEditModalOpen(false);
            fetchData(true);
          }}
        />
      )}
      {/* ── SMART DELETE & ARSIP MODAL ── */}
      {asset && (
        <SmartDeleteInventarisModal
          isOpen={isSmartDeleteModalOpen}
          asset={asset}
          onClose={() => setIsSmartDeleteModalOpen(false)}
          onSuccess={() => {
            setIsSmartDeleteModalOpen(false);
            navigate('/hub/inventaris');
          }}
        />
      )}
    </div>
  );
};
