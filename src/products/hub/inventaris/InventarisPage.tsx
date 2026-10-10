import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { inventarisService } from './inventarisService';
import { ItemInventaris } from './types';
import { loanBasketStore } from './loanBasketStore';
import { LoanModal } from '../peminjaman/LoanModal';

export const InventarisPage: React.FC = () => {
  const navigate = useNavigate();
  const { can } = useSessionStore();

  const [items, setItems] = useState<ItemInventaris[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters from pgInventaris()
  const [searchQ, setSearchQ] = useState('');
  const [catFilter, setCatFilter] = useState('semua');
  const [statusFilter, setStatusFilter] = useState('semua');

  // Detail & Modals
  const [isDaftarPinjamanOpen, setIsDaftarPinjamanOpen] = useState(false);
  const [isNewAssetOpen, setIsNewAssetOpen] = useState(false);
  const [unitPickerAsset, setUnitPickerAsset] = useState<ItemInventaris | null>(null);

  // Form New Asset
  const [newKode, setNewKode] = useState('');
  const [newNama, setNewNama] = useState('');
  const [newKat, setNewKat] = useState('Kamera');
  const [newSpec, setNewSpec] = useState('');
  const [newLoc, setNewLoc] = useState('Studio PTV');
  const [newQty, setNewQty] = useState('1');
  const [newSubmitting, setNewSubmitting] = useState(false);

  // Sync loanBasket
  const basketItems = useSyncExternalStore(
    (cb) => loanBasketStore.subscribe(cb),
    () => loanBasketStore.getItems()
  );
  const basketCount = basketItems.length;

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await inventarisService.getInventarisList();
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const canCreate = can('inventory.create');

  // Helper categories
  const ALL_CATEGORIES = [
    'Kamera',
    'Lensa',
    'Tripod & Rig',
    'Baterai & Power',
    'Audio',
    'Lighting',
    'Stabilizer',
    'Streaming / Live',
    'Lainnya',
  ];

  const getCatIconMarkup = (c: string) => {
    const lower = c.toLowerCase();
    if (lower.includes('kamera')) return <i className="fa-solid fa-camera-retro" />;
    if (lower.includes('lensa')) return <i className="fa-solid fa-circle-dot" />;
    if (lower.includes('audio') || lower.includes('mic')) return <i className="fa-solid fa-microphone" />;
    if (lower.includes('lighting') || lower.includes('lampu')) return <i className="fa-solid fa-lightbulb" />;
    if (lower.includes('tripod') || lower.includes('rig') || lower.includes('stabilizer')) return <i className="fa-solid fa-arrows-to-dot" />;
    if (lower.includes('baterai') || lower.includes('power')) return <i className="fa-solid fa-battery-three-quarters" />;
    return <i className="fa-solid fa-shapes" />;
  };

  // Filtered Rows
  let filteredRows = [...items];

  // 1. Kategori
  if (catFilter !== 'semua') {
    filteredRows = filteredRows.filter((x) => x.kategori.toLowerCase() === catFilter.toLowerCase());
  }

  // 2. Status
  if (statusFilter !== 'semua') {
    if (statusFilter === 'Tersedia') filteredRows = filteredRows.filter((x) => x.unit_tersedia > 0);
    else if (statusFilter === 'Dipinjam') filteredRows = filteredRows.filter((x) => x.total_unit - x.unit_tersedia > 0);
    else if (statusFilter === 'Rusak') {
      filteredRows = filteredRows.filter((x) => x.units.some((u) => u.kondisi === 'rusak' || u.status_peminjaman === 'maintenance'));
    }
  }

  // 3. Search query
  if (searchQ.trim()) {
    const q = searchQ.trim().toLowerCase();
    filteredRows = filteredRows.filter((x) =>
      (x.nama_alat + ' ' + x.kode + ' ' + (x.spesifikasi || '') + ' ' + x.kategori).toLowerCase().includes(q)
    );
  }

  // Metrics for scoped category
  const catScoped = catFilter === 'semua' ? items : items.filter((x) => x.kategori.toLowerCase() === catFilter.toLowerCase());
  const countCatAll = catScoped.length;
  const countCatAvail = catScoped.filter((x) => x.unit_tersedia > 0).length;
  const countCatBorrowed = catScoped.filter((x) => x.total_unit - x.unit_tersedia > 0).length;
  const countCatDamaged = catScoped.filter((x) => x.units.some((u) => u.kondisi === 'rusak' || u.status_peminjaman === 'maintenance')).length;

  const isFiltered = catFilter !== 'semua' || statusFilter !== 'semua' || !!searchQ.trim();

  // Quick add to basket handler
  const handleQuickAdd = (e: React.MouseEvent, asset: ItemInventaris) => {
    e.stopPropagation();
    const availUnits = asset.units.filter((u) => u.status_peminjaman === 'tersedia');
    if (availUnits.length === 0) {
      alert(`Semua unit "${asset.nama_alat}" sedang tidak tersedia.`);
      return;
    }
    if (asset.units.length > 1) {
      setUnitPickerAsset(asset);
    } else {
      const unit = availUnits[0];
      const basketKey = `${asset.id}_${unit.id}`;
      loanBasketStore.toggle({
        key: basketKey,
        assetId: asset.id,
        unitId: unit.id,
        unitNo: 1,
        unitCode: unit.kode_unit,
        unitName: `Unit 01 (${unit.kode_unit})`,
        assetName: asset.nama_alat,
        invCode: asset.kode,
      });
    }
  };

  const handleNewAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKode.trim() || !newNama.trim()) {
      alert('Kode dan Nama Alat wajib diisi.');
      return;
    }
    try {
      setNewSubmitting(true);
      await inventarisService.createInventaris({
        kode: newKode.trim(),
        nama_alat: newNama.trim(),
        kategori: newKat,
        spesifikasi: newSpec.trim(),
        lokasi_penyimpanan: newLoc.trim(),
        jumlah_unit: parseInt(newQty, 10) || 1,
      });
      setIsNewAssetOpen(false);
      alert('Alat baru berhasil ditambahkan ke inventaris!');
      await loadData();
    } catch (err: unknown) {
      alert((err as Error).message || 'Gagal menyimpan alat baru');
    } finally {
      setNewSubmitting(false);
    }
  };

  return (
    <div className="page">
      {/* ── HEADER: UNIFIED SEARCH BAR WITH SCAN & BASKET BUTTON ── */}
      <div className="row gap8" style={{ alignItems: 'center' }}>
        <div className="inv-search-wrap">
          <span className="search-icon">
            <i className="fa-solid fa-magnifying-glass" />
          </span>
          <input
            id="invQ"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Cari nama, kode (INV-xxx), merk, model, lokasi…"
          />
          <button
            type="button"
            className="inv-search-scan-btn"
            onClick={() => alert('Scanner barcode kamera fisik aktif')}
            aria-label="Pindai Barcode"
          >
            <i className="fa-solid fa-qrcode" />
            <span className="only-desktop" style={{ marginLeft: '4px' }}>
              Scan
            </span>
          </button>
        </div>

        <button
          type="button"
          className="inv-top-basket-btn"
          onClick={() => setIsDaftarPinjamanOpen(true)}
          aria-label="Daftar Pinjaman"
          title="Daftar Pinjaman"
        >
          <i className="fa-solid fa-clipboard-list" />
          {basketCount > 0 && <span className="inv-top-basket-badge">{basketCount}</span>}
        </button>
      </div>

      {/* ── HERO BANNER 1:1 DARI pgInventaris() ── */}
      <div className="inv-hero-banner">
        <img
          src="/assets/images/hero-bg-default.webp"
          alt="Aset Inventaris Progresif TV Production"
          loading="lazy"
        />
        <div className="inv-hero-overlay">
          <div className="inv-hero-tag">
            <i className="fa-solid fa-boxes-stacked" /> KATALOG INVENTARIS
          </div>
          <div className="inv-hero-title">Aset Inventaris Progresif TV Production</div>
          <div className="inv-hero-sub">
            Kelola peminjaman, monitor ketersediaan unit, dan telusuri riwayat alat dengan mudah.
          </div>
        </div>
      </div>

      {/* ── CATEGORY SECTION (PREMIUM CARD RAIL) ── */}
      <div className="inv-cat-box">
        <div className="inv-cat-box-header">
          <div className="inv-cat-box-title">
            <i className="fa-solid fa-layer-group" /> Kategori Alat
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="inv-cat-box-count">{ALL_CATEGORIES.length + 1} Kategori</span>
            <div className="inv-cat-nav-btns">
              <button
                type="button"
                className="inv-cat-nav-btn"
                onClick={() => {
                  const el = document.getElementById('invCatTrack');
                  if (el) el.scrollBy({ left: -200, behavior: 'smooth' });
                }}
                aria-label="Geser Kiri"
              >
                <i className="fa-solid fa-chevron-left" />
              </button>
              <button
                type="button"
                className="inv-cat-nav-btn"
                onClick={() => {
                  const el = document.getElementById('invCatTrack');
                  if (el) el.scrollBy({ left: 200, behavior: 'smooth' });
                }}
                aria-label="Geser Kanan"
              >
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          </div>
        </div>

        <div className="inv-cat-scroll-track" id="invCatTrack">
          <button
            type="button"
            className={`inv-cat-card ${catFilter === 'semua' ? 'on' : ''}`}
            onClick={() => setCatFilter('semua')}
          >
            <div className="inv-cat-card-icon">
              <i className="fa-solid fa-boxes-stacked" />
            </div>
            <div className="inv-cat-card-name">Semua</div>
            <div className="inv-cat-card-count">{items.length} alat</div>
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const cnt = items.filter((x) => x.kategori.toLowerCase() === cat.toLowerCase()).length;
            return (
              <button
                key={cat}
                type="button"
                className={`inv-cat-card ${catFilter.toLowerCase() === cat.toLowerCase() ? 'on' : ''}`}
                onClick={() => setCatFilter(cat)}
              >
                <div className="inv-cat-card-icon">{getCatIconMarkup(cat)}</div>
                <div className="inv-cat-card-name">{cat}</div>
                <div className="inv-cat-card-count">{cnt} alat</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── STATUS SEGMENTED TOOLBAR & ACTIONS ── */}
      <div
        className="inv-toolbar-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          marginTop: '14px',
          flexWrap: 'wrap',
        }}
      >
        <div className="inv-status-segment">
          <button
            type="button"
            className={`inv-segment-btn ${statusFilter === 'semua' ? 'on' : ''}`}
            onClick={() => setStatusFilter('semua')}
          >
            <span>Semua</span>
            <span className="inv-segment-count">{countCatAll}</span>
          </button>
          <button
            type="button"
            className={`inv-segment-btn ${statusFilter === 'Tersedia' ? 'on' : ''}`}
            onClick={() => setStatusFilter('Tersedia')}
          >
            <span className="inv-segment-dot" style={{ background: '#22c55e' }} />
            <span>Tersedia</span>
            <span className="inv-segment-count">{countCatAvail}</span>
          </button>
          <button
            type="button"
            className={`inv-segment-btn ${statusFilter === 'Dipinjam' ? 'on' : ''}`}
            onClick={() => setStatusFilter('Dipinjam')}
          >
            <span className="inv-segment-dot" style={{ background: '#f59e0b' }} />
            <span>Dipinjam</span>
            <span className="inv-segment-count">{countCatBorrowed}</span>
          </button>
          <button
            type="button"
            className={`inv-segment-btn ${statusFilter === 'Rusak' ? 'on' : ''}`}
            onClick={() => setStatusFilter('Rusak')}
          >
            <span className="inv-segment-dot" style={{ background: '#ef4444' }} />
            <span>Rusak</span>
            <span className="inv-segment-count">{countCatDamaged}</span>
          </button>
        </div>

        <div
          className="inv-toolbar-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: 'auto',
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          {isFiltered && (
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                setCatFilter('semua');
                setStatusFilter('semua');
                setSearchQ('');
              }}
              style={{
                fontSize: '11.5px',
                padding: '3px 10px',
                minHeight: '34px',
                fontWeight: 650,
                color: 'var(--warn)',
                borderRadius: 'var(--r-m)',
              }}
            >
              <i className="fa-solid fa-rotate-left" style={{ marginRight: '4px', fontSize: '10.5px' }} />
              Reset Filter
            </button>
          )}

          {basketCount > 0 && (
            <button
              type="button"
              className="btn sm"
              onClick={() => setIsDaftarPinjamanOpen(true)}
              style={{
                fontSize: '12px',
                padding: '0 12px',
                minHeight: '34px',
                fontWeight: 650,
                color: 'var(--b-700)',
                background: 'var(--b-050)',
                border: '1px solid var(--b-200)',
                borderRadius: 'var(--r-full)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 4px rgba(18,115,230,0.08)',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-clipboard-check" style={{ fontSize: '12px' }} />
              <span>{basketCount} dalam daftar pinjaman</span>
            </button>
          )}

          {canCreate && (
            <button
              type="button"
              className="btn sm pri"
              onClick={() => {
                setNewKode(`INV-${(items.length + 1).toString().padStart(3, '0')}`);
                setNewNama('');
                setNewKat('Kamera');
                setNewSpec('');
                setNewLoc('Studio PTV');
                setNewQty('1');
                setIsNewAssetOpen(true);
              }}
              style={{
                minHeight: '34px',
                padding: '0 14px',
                borderRadius: 'var(--r-full)',
                fontWeight: 700,
                fontSize: '12.5px',
                boxShadow: '0 2px 8px rgba(18,115,230,0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <i className="fa-solid fa-plus" />
              <span>Alat</span>
            </button>
          )}
        </div>
      </div>

      {/* ── RESULT COUNT & SCOPE STATUS ── */}
      <div className="row-b mt12 mb10" style={{ alignItems: 'center', padding: '0 1px' }}>
        <span className="t-sm" style={{ fontWeight: 700, color: 'var(--ink)' }}>
          {filteredRows.length} alat{catFilter !== 'semua' ? ` • ${catFilter}` : ''}
        </span>
      </div>

      {/* ── PRODUCT CATALOG GRID 1:1 DARI renderCard() ── */}
      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }} />
          Memuat katalog inventaris...
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="empty card">
          <i className="fa-solid fa-boxes-stacked" />
          <p>Tidak ada alat yang cocok. Ubah filter atau kata kunci.</p>
        </div>
      ) : (
        <div className="inv-catalog-grid">
          {filteredRows.map((x) => {
            const avail = x.unit_tersedia;
            const total = x.total_unit;
            const borrowed = total - avail;
            const damaged = x.units.filter((u) => u.kondisi === 'rusak').length;

            let badgeTxt = 'Tersedia';
            let badgeColor = '#15803d';
            let dotColor = '#22c55e';
            let badgeBorder = 'rgba(34,197,94,0.3)';

            if (avail === total && total > 0) {
              badgeTxt = 'Tersedia';
              badgeColor = '#15803d';
              dotColor = '#22c55e';
              badgeBorder = 'rgba(34,197,94,0.3)';
            } else if (avail > 0) {
              badgeTxt = `${avail}/${total} Tersedia`;
              badgeColor = '#047857';
              dotColor = '#10b981';
              badgeBorder = 'rgba(16,185,129,0.3)';
            } else if (borrowed > 0) {
              badgeTxt = borrowed === total ? 'Dipinjam' : `${borrowed} Dipinjam`;
              badgeColor = '#b45309';
              dotColor = '#f59e0b';
              badgeBorder = 'rgba(245,158,11,0.3)';
            } else if (damaged > 0) {
              badgeTxt = 'Rusak';
              badgeColor = '#b91c1c';
              dotColor = '#ef4444';
              badgeBorder = 'rgba(239,68,68,0.3)';
            } else {
              badgeTxt = 'Tidak Ada';
              badgeColor = '#475569';
              dotColor = '#94a3b8';
              badgeBorder = 'rgba(148,163,184,0.3)';
            }

            const inBasket = loanBasketStore.hasAsset(x.id);

            return (
              <div
                role="button"
                tabIndex={0}
                key={x.id}
                className="inv-prod-card"
                onClick={() => navigate(`/hub/inventaris/${x.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigate(`/hub/inventaris/${x.id}`);
                  }
                }}
                style={
                  inBasket
                    ? { borderColor: 'var(--b-400)', boxShadow: '0 0 0 2px var(--b-100)', cursor: 'pointer' }
                    : { cursor: 'pointer' }
                }
              >
                {/* 1. Status ketersediaan (badge pada foto) 1:1 Legacy */}
                <div className="inv-prod-photo">
                  {x.foto_url ? (
                    <img
                      src={x.foto_url}
                      alt={x.nama_alat}
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <span className="inv-prod-icon" style={{ display: x.foto_url ? 'none' : 'flex' }}>
                    {getCatIconMarkup(x.kategori)}
                  </span>

                  <span
                    className="inv-prod-status-badge"
                    style={{
                      color: badgeColor,
                      borderColor: badgeBorder,
                    }}
                  >
                    <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: dotColor }} />
                    <span>{badgeTxt}</span>
                  </span>
                </div>

                {/* 2. Detail Card Body 1:1 Legacy .inv-prod-body */}
                <div className="inv-prod-body">
                  {/* 2a. Kode & Kategori */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div className="inv-prod-code">{x.kode || `INV-${String(x.id).slice(0, 5).toUpperCase()}`}</div>
                    <span style={{ fontSize: '10.5px', color: 'var(--muted)', fontWeight: 650, textTransform: 'capitalize' }}>
                      {x.kategori || 'Alat'}
                    </span>
                  </div>

                  {/* 2b. Nama & Merk Alat */}
                  <div className="inv-prod-name" style={{ marginTop: '2px' }}>
                    {x.nama_alat}
                  </div>
                  {x.spesifikasi ? (
                    <div className="inv-prod-brand">
                      {x.spesifikasi}
                    </div>
                  ) : null}

                  {/* 2c. Jumlah Unit & Ketersediaan */}
                  <div style={{ marginTop: 'auto', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 650, lineHeight: 1.25 }} className="trunc">
                      {total <= 1 ? (
                        avail === 1 ? (
                          <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', display: 'inline-block', flexShrink: 0 }} />
                            1 unit &bull; Tersedia
                          </span>
                        ) : borrowed === 1 ? (
                          <span style={{ color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d97706', display: 'inline-block', flexShrink: 0 }} />
                            1 unit &bull; Dipinjam
                          </span>
                        ) : damaged === 1 ? (
                          <span style={{ color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626', display: 'inline-block', flexShrink: 0 }} />
                            1 unit &bull; Rusak
                          </span>
                        ) : (
                          <span style={{ color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#64748b', display: 'inline-block', flexShrink: 0 }} />
                            1 unit &bull; Tidak tersedia
                          </span>
                        )
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--ink, #0f172a)', flexWrap: 'wrap' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: avail > 0 ? '#16a34a' : damaged > 0 ? '#dc2626' : '#d97706', display: 'inline-block', flexShrink: 0 }} />
                          <span>
                            <b>{total} unit</b> &bull;{' '}
                            <span style={{ color: avail > 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                              {avail} tersedia
                            </span>
                          </span>
                          {borrowed > 0 ? (
                            <span style={{ color: '#d97706', fontSize: '10.5px' }}>
                              ({borrowed} pinjam)
                            </span>
                          ) : null}
                        </span>
                      )}
                    </div>

                    {/* 2d. Lokasi & Quick Action Button */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', fontWeight: 550, gap: '6px', paddingTop: '3px', borderTop: '1px solid var(--line-2, #f1f5f9)' }}>
                      <span className="trunc" style={{ flex: 1 }} title={`Lokasi: ${x.units?.[0]?.lokasi_penyimpanan || 'Studio PTV'}`}>
                        <i className="fa-solid fa-location-dot" style={{ fontSize: '10px', marginRight: '3px', color: '#0284c7' }} />
                        {x.units?.[0]?.lokasi_penyimpanan || 'Studio PTV'}
                      </span>
                      {avail > 0 && (
                        <button
                          type="button"
                          className={`inv-prod-quick-add ${inBasket ? 'added' : ''}`}
                          onClick={(e) => handleQuickAdd(e, x)}
                          title={inBasket ? 'Keluarkan dari daftar pinjaman' : 'Tambah ke daftar pinjaman'}
                          aria-label={inBasket ? 'Keluarkan dari daftar pinjaman' : 'Tambah ke daftar pinjaman'}
                        >
                          <i className={`fa-solid ${inBasket ? 'fa-check' : 'fa-plus'}`} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}



      {/* ── UNIT PICKER MODAL (MULTI-UNIT SELECTOR) ── */}
      {unitPickerAsset && (
        <>
          <div className="scrim on" onClick={() => setUnitPickerAsset(null)} />
          <section className="sheet on" role="dialog" aria-modal="true">
            <div className="sheet-grab" />
            <div className="sheet-hd">
              <h3>Pilih Unit Fisik — {unitPickerAsset.nama_alat}</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setUnitPickerAsset(null)}
                aria-label="Tutup"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="sheet-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {unitPickerAsset.units.map((u, idx) => {
                const isAvail = u.status_peminjaman === 'tersedia';
                const basketKey = `${unitPickerAsset.id}_${u.id}`;
                const inBasket = loanBasketStore.has(basketKey);

                return (
                  <div
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      border: `1.5px solid ${inBasket ? '#3b82f6' : '#e2e8f0'}`,
                      borderRadius: '12px',
                      background: inBasket ? '#eff6ff' : '#ffffff',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: isAvail ? '#e0f2fe' : '#f1f5f9',
                          color: isAvail ? '#0284c7' : '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                        }}
                      >
                        #{idx + 1}
                      </div>
                      <div>
                        <div style={{ fontWeight: 750, fontSize: '13.5px', color: '#0f172a' }}>
                          Unit {idx + 1} &bull; <span className="font-mono">{u.kode_unit}</span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                          Kondisi: <b>{u.kondisi}</b> &bull; Status: <b>{u.status_peminjaman}</b>
                        </div>
                      </div>
                    </div>
                    {isAvail ? (
                      <button
                        type="button"
                        className={`btn sm ${inBasket ? '' : 'pri'}`}
                        onClick={() => {
                          loanBasketStore.toggle({
                            key: basketKey,
                            assetId: unitPickerAsset.id,
                            unitId: u.id,
                            unitNo: idx + 1,
                            unitCode: u.kode_unit,
                            unitName: `Unit ${idx + 1} (${u.kode_unit})`,
                            assetName: unitPickerAsset.nama_alat,
                            invCode: unitPickerAsset.kode,
                          });
                        }}
                        style={{ minHeight: '34px', padding: '0 12px', borderRadius: '8px' }}
                      >
                        <i className={`fa-solid ${inBasket ? 'fa-check' : 'fa-plus'}`} style={{ marginRight: '4px' }} />
                        {inBasket ? 'Dipilih' : 'Pilih Unit'}
                      </button>
                    ) : (
                      <span className="chip warn" style={{ fontSize: '11px' }}>
                        Tidak Tersedia
                      </span>
                    )}
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', gap: '8px' }}>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setUnitPickerAsset(null)}
                >
                  Selesai
                </button>
                <button
                  type="button"
                  className="btn sm pri"
                  onClick={() => {
                    setUnitPickerAsset(null);
                    setIsDaftarPinjamanOpen(true);
                  }}
                >
                  Lihat Daftar Pinjaman <i className="fa-solid fa-arrow-right" style={{ marginLeft: '4px' }} />
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ── MODAL PINJAM ALAT 1:1 LEGACY DARI openLoanModal() ── */}
      <LoanModal
        isOpen={isDaftarPinjamanOpen}
        onClose={() => setIsDaftarPinjamanOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* ── MODAL TAMBAH ALAT BARU ── */}
      {isNewAssetOpen && (
        <>
          <div className="scrim on" onClick={() => setIsNewAssetOpen(false)} />
          <section className="sheet on" role="dialog" aria-modal="true">
            <div className="sheet-grab" />
            <div className="sheet-hd">
              <h3>Tambah Alat Baru ke Katalog</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsNewAssetOpen(false)}
                aria-label="Tutup"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="sheet-body" style={{ padding: '16px' }}>
              <form onSubmit={handleNewAssetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>Kode Alat</label>
                  <input
                    type="text"
                    value={newKode}
                    onChange={(e) => setNewKode(e.target.value)}
                    required
                    style={{ width: '100%', marginTop: '4px', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>Nama Alat</label>
                  <input
                    type="text"
                    value={newNama}
                    onChange={(e) => setNewNama(e.target.value)}
                    required
                    style={{ width: '100%', marginTop: '4px', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>Kategori</label>
                  <select
                    value={newKat}
                    onChange={(e) => setNewKat(e.target.value)}
                    style={{ width: '100%', marginTop: '4px', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    {ALL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>Spesifikasi / Keterangan</label>
                  <input
                    type="text"
                    value={newSpec}
                    onChange={(e) => setNewSpec(e.target.value)}
                    style={{ width: '100%', marginTop: '4px', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>Lokasi Penyimpanan</label>
                    <input
                      type="text"
                      value={newLoc}
                      onChange={(e) => setNewLoc(e.target.value)}
                      style={{ width: '100%', marginTop: '4px', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div style={{ width: '100px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>Jumlah Unit</label>
                    <input
                      type="number"
                      min="1"
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                      style={{ width: '100%', marginTop: '4px', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="btn sec flex-1"
                    onClick={() => setIsNewAssetOpen(false)}
                    style={{ borderRadius: '8px' }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn pri flex-1"
                    disabled={newSubmitting}
                    style={{ borderRadius: '8px' }}
                  >
                    {newSubmitting ? 'Menyimpan...' : 'Simpan Alat'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
