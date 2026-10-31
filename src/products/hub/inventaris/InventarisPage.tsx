import React, { useState, useEffect, useSyncExternalStore, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { inventarisService, normalizeInventoryCategory } from './inventarisService';
import { ItemInventaris, INVENTORY_CATEGORIES } from './types';
import { loanBasketStore } from './loanBasketStore';
import { LoanModal } from '../peminjaman/LoanModal';
import { TambahAlatModal } from './TambahAlatModal';
import { UnitPickerModal } from './UnitPickerModal';
import { InventoryScanDialog } from './InventoryScanDialog';
import { resolveInventoryPhotoUrl } from './utils/inventoryPhotoUtils';
import { InventoryGridSkeleton } from '@/shared/components';
import { useInstantData } from '@shared/hooks/useInstantData';
import '@/styles/inventaris.css';

interface CategoryVisual {
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export function getCategoryVisual(category: string): CategoryVisual {
  const c = category.toLowerCase();
  if (c === 'semua') {
    return {
      icon: 'fa-boxes-stacked',
      color: '#1273E6',
      bgColor: 'rgba(18, 115, 230, 0.10)',
      borderColor: 'rgba(18, 115, 230, 0.22)',
    };
  }
  if (c.includes('kamera')) {
    return {
      icon: 'fa-camera',
      color: '#1273E6',
      bgColor: 'rgba(18, 115, 230, 0.10)',
      borderColor: 'rgba(18, 115, 230, 0.22)',
    };
  }
  if (c.includes('lensa')) {
    return {
      icon: 'fa-circle-dot',
      color: '#9333EA',
      bgColor: 'rgba(147, 51, 234, 0.10)',
      borderColor: 'rgba(147, 51, 234, 0.22)',
    };
  }
  if (c.includes('tripod') || c.includes('rig') || c.includes('stabilizer')) {
    return {
      icon: 'fa-arrows-to-dot',
      color: '#0D9488',
      bgColor: 'rgba(13, 148, 136, 0.10)',
      borderColor: 'rgba(13, 148, 136, 0.22)',
    };
  }
  if (c.includes('baterai') || c.includes('power')) {
    return {
      icon: 'fa-battery-three-quarters',
      color: '#D97706',
      bgColor: 'rgba(217, 119, 6, 0.10)',
      borderColor: 'rgba(217, 119, 6, 0.22)',
    };
  }
  if (c.includes('smartphone') || c.includes('tablet') || c.includes('hp')) {
    return {
      icon: 'fa-mobile-screen',
      color: '#4F46E5',
      bgColor: 'rgba(79, 70, 229, 0.10)',
      borderColor: 'rgba(79, 70, 229, 0.22)',
    };
  }
  if (c.includes('komputer') || c.includes('laptop') || c.includes('pc')) {
    return {
      icon: 'fa-laptop',
      color: '#2563EB',
      bgColor: 'rgba(37, 99, 235, 0.10)',
      borderColor: 'rgba(37, 99, 235, 0.22)',
    };
  }
  if (c.includes('audio') || c.includes('mic')) {
    return {
      icon: 'fa-microphone',
      color: '#059669',
      bgColor: 'rgba(5, 150, 105, 0.10)',
      borderColor: 'rgba(5, 150, 105, 0.22)',
    };
  }
  if (c.includes('lighting') || c.includes('lampu')) {
    return {
      icon: 'fa-lightbulb',
      color: '#D97706',
      bgColor: 'rgba(245, 158, 11, 0.12)',
      borderColor: 'rgba(245, 158, 11, 0.25)',
    };
  }
  if (c.includes('streaming') || c.includes('live') || c.includes('broadcast')) {
    return {
      icon: 'fa-tower-broadcast',
      color: '#E11D48',
      bgColor: 'rgba(225, 29, 72, 0.10)',
      borderColor: 'rgba(225, 29, 72, 0.22)',
    };
  }
  if (c.includes('kabel') || c.includes('adapter')) {
    return {
      icon: 'fa-plug',
      color: '#EA580C',
      bgColor: 'rgba(234, 88, 12, 0.10)',
      borderColor: 'rgba(234, 88, 12, 0.22)',
    };
  }
  if (c.includes('cabinet') || c.includes('dry')) {
    return {
      icon: 'fa-box-archive',
      color: '#0284C7',
      bgColor: 'rgba(2, 132, 199, 0.10)',
      borderColor: 'rgba(2, 132, 199, 0.22)',
    };
  }
  if (c.includes('tv') || c.includes('televisi')) {
    return {
      icon: 'fa-tv',
      color: '#7C3AED',
      bgColor: 'rgba(124, 58, 237, 0.10)',
      borderColor: 'rgba(124, 58, 237, 0.22)',
    };
  }
  if (c.includes('storage') || c.includes('ssd') || c.includes('memory')) {
    return {
      icon: 'fa-hard-drive',
      color: '#4B5563',
      bgColor: 'rgba(75, 85, 99, 0.10)',
      borderColor: 'rgba(75, 85, 99, 0.22)',
    };
  }
  if (c.includes('peralatan') || c.includes('perkakas')) {
    return {
      icon: 'fa-wrench',
      color: '#C026D3',
      bgColor: 'rgba(192, 38, 211, 0.10)',
      borderColor: 'rgba(192, 38, 211, 0.22)',
    };
  }
  if (c.includes('atk')) {
    return {
      icon: 'fa-pen-ruler',
      color: '#65A30D',
      bgColor: 'rgba(101, 163, 13, 0.10)',
      borderColor: 'rgba(101, 163, 13, 0.22)',
    };
  }
  if (c.includes('jaringan') || c.includes('network')) {
    return {
      icon: 'fa-network-wired',
      color: '#0891B2',
      bgColor: 'rgba(8, 145, 178, 0.10)',
      borderColor: 'rgba(8, 145, 178, 0.22)',
    };
  }
  return {
    icon: 'fa-shapes',
    color: '#64748B',
    bgColor: 'rgba(100, 116, 139, 0.10)',
    borderColor: 'rgba(100, 116, 139, 0.22)',
  };
}

export const InventarisPage: React.FC = () => {
  const navigate = useNavigate();
  const { can } = useSessionStore();

  // Instant-First Persistent Cache: Instant display on remount, background revalidation
  const {
    data: items,
    isLoading: loading,
    refetch: loadData,
  } = useInstantData<ItemInventaris[]>({
    key: 'inventaris_catalog_list',
    fetcher: () => inventarisService.getInventarisList(),
    ttlMs: 15 * 60 * 1000,
    initialFallback: [],
  });

  // Navigation State Persistence (PTV-DEV-186)
  const savedNavState = useRef<{ searchQ?: string; catFilter?: string; statusFilter?: string; scrollY?: number } | null>(null);
  if (savedNavState.current === null && typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem('ptv_inventaris_nav_state');
      if (raw) savedNavState.current = JSON.parse(raw);
    } catch (e) {
      void e;
    }
  }

  // Filters with persistence
  const [searchQ, setSearchQ] = useState(() => savedNavState.current?.searchQ || '');
  const [catFilter, setCatFilter] = useState(() => savedNavState.current?.catFilter || 'semua');
  const [statusFilter, setStatusFilter] = useState(() => savedNavState.current?.statusFilter || 'semua');

  // Modals
  const [isDaftarPinjamanOpen, setIsDaftarPinjamanOpen] = useState(false);
  const [isNewAssetOpen, setIsNewAssetOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [unitPickerAsset, setUnitPickerAsset] = useState<ItemInventaris | null>(null);

  const catTrackRef = useRef<HTMLDivElement>(null);

  // Sync loanBasket
  const basketItems = useSyncExternalStore(
    (cb) => loanBasketStore.subscribe(cb),
    () => loanBasketStore.getItems(),
    () => []
  );
  const basketCount = basketItems.length;

  useEffect(() => {
    try {
      sessionStorage.setItem(
        'ptv_inventaris_nav_state',
        JSON.stringify({ searchQ, catFilter, statusFilter, scrollY: window.scrollY })
      );
    } catch (e) {
      void e;
    }
  }, [searchQ, catFilter, statusFilter]);

  useEffect(() => {
    if (!loading && savedNavState.current?.scrollY) {
      const targetScroll = savedNavState.current.scrollY;
      requestAnimationFrame(() => {
        window.scrollTo({ top: targetScroll, behavior: 'instant' });
      });
    }
  }, [loading]);

  const handleOpenDetail = (id: string) => {
    try {
      sessionStorage.setItem(
        'ptv_inventaris_nav_state',
        JSON.stringify({ searchQ, catFilter, statusFilter, scrollY: window.scrollY })
      );
    } catch (e) {
      void e;
    }
    navigate(`/hub/inventaris/${id}`);
  };

  const canCreate = can('inventory.create');

  // Helper categories (17 kanonikal)
  const canonicalCategories = INVENTORY_CATEGORIES;

  // Filtered Rows
  let filteredRows = [...items];

  // 1. Kategori
  if (catFilter !== 'semua') {
    filteredRows = filteredRows.filter((x) => {
      const norm = normalizeInventoryCategory(x.kategori);
      return norm.toLowerCase() === catFilter.toLowerCase();
    });
  }

  // 2. Status
  if (statusFilter !== 'semua') {
    if (statusFilter === 'Tersedia') {
      filteredRows = filteredRows.filter((x) => x.unit_tersedia > 0);
    } else if (statusFilter === 'Dipinjam') {
      filteredRows = filteredRows.filter((x) => x.total_unit - x.unit_tersedia > 0);
    } else if (statusFilter === 'Bermasalah') {
      filteredRows = filteredRows.filter((x) =>
        x.units.some(
          (u) =>
            u.kondisi === 'rusak' ||
            u.kondisi === 'perlu_servis' ||
            u.kondisi === 'hilang' ||
            u.status_peminjaman === 'maintenance'
        )
      );
    }
  }

  // 3. Search query
  if (searchQ.trim()) {
    const q = searchQ.trim().toLowerCase();
    filteredRows = filteredRows.filter((x) =>
      (
        x.nama_alat +
        ' ' +
        x.kode +
        ' ' +
        (x.spesifikasi || '') +
        ' ' +
        x.kategori +
        ' ' +
        (x.lokasi_penyimpanan || '') +
        ' ' + x.units.map((unit) => `${unit.kode_unit} ${unit.nama_unit || ''}`).join(' ')
      )
        .toLowerCase()
        .includes(q)
    );
  }

  // Metrics for scoped category
  const catScoped =
    catFilter === 'semua'
      ? items
      : items.filter((x) => normalizeInventoryCategory(x.kategori).toLowerCase() === catFilter.toLowerCase());

  const countCatAll = catScoped.length;
  const countCatAvail = catScoped.filter((x) => x.unit_tersedia > 0).length;
  const countCatBorrowed = catScoped.filter((x) => x.total_unit - x.unit_tersedia > 0).length;
  const countCatDamaged = catScoped.filter((x) =>
    x.units.some(
      (u) =>
        u.kondisi === 'rusak' ||
        u.kondisi === 'perlu_servis' ||
        u.kondisi === 'hilang' ||
        u.status_peminjaman === 'maintenance'
    )
  ).length;

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

  const scrollCategoryTrack = (direction: 'left' | 'right') => {
    if (catTrackRef.current) {
      const offset = direction === 'left' ? -240 : 240;
      catTrackRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="page r03-inventaris r03-inventaris-restored">
      {/* ── 1. HEADER: UNIFIED SEARCH BAR WITH SCAN & BASKET BUTTON ── */}
      <div className="inv-search-toolbar">
        <div className="inv-search-wrap">
          <span className="search-icon">
            <i className="fa-solid fa-magnifying-glass" />
          </span>
          <input
            id="invQ"
            aria-label="Cari inventaris"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Cari nama, kode (INV-xxx), merk, model, lokasi..."
          />
        </div>
          <button
            type="button"
            className="inv-search-scan-btn"
            onClick={() => setScanOpen(true)}
            aria-label="Pindai Barcode"
          >
            <i className="fa-solid fa-qrcode" />
            <span className="only-desktop" style={{ marginLeft: '6px' }}>
              Scan
            </span>
          </button>
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

      {/* ── 2. HERO BANNER PHOTOGRAPHIC INVENTARIS ── */}
      <div className="inv-hero-banner">
        <img
          src="/assets/images/hero-bg-default.webp"
          alt="Aset Inventaris Progresif TV Production"
          loading="lazy"
        />
        <div className="inv-hero-overlay">
          <div className="inv-hero-title">Aset Inventaris Progresif TV Production</div>
          <div className="inv-hero-sub">
            Kelola peminjaman, monitor ketersediaan unit, dan telusuri riwayat alat dengan mudah.
          </div>
        </div>
      </div>

      {/* ── 3. SECTION KATEGORI ALAT (HORIZONTAL CAROUSEL) ── */}
      <div className="inv-cat-box">
        <div className="inv-cat-box-header">
          <div className="inv-cat-box-title">
            <i className="fa-solid fa-layer-group" />
            <span>KATEGORI ALAT</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="inv-cat-box-count">{canonicalCategories.length} KATEGORI</span>
            <div className="inv-cat-nav-btns">
              <button
                type="button"
                className="inv-cat-nav-btn"
                onClick={() => scrollCategoryTrack('left')}
                aria-label="Geser Kategori ke Kiri"
              >
                <i className="fa-solid fa-chevron-left" />
              </button>
              <button
                type="button"
                className="inv-cat-nav-btn"
                onClick={() => scrollCategoryTrack('right')}
                aria-label="Geser Kategori ke Kanan"
              >
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          </div>
        </div>

        <div className="inv-cat-scroll-track" id="invCatTrack" ref={catTrackRef}>
          {/* Kartu 'Semua' */}
          {(() => {
            const isAllActive = catFilter === 'semua';
            const allVisual = getCategoryVisual('semua');
            return (
              <button
                type="button"
                className={`inv-cat-card ${isAllActive ? 'on' : ''}`}
                onClick={() => setCatFilter('semua')}
                style={
                  isAllActive
                    ? {
                        borderColor: 'var(--b-600, #1273E6)',
                        boxShadow: '0 0 0 2px var(--b-600, #1273E6), 0 4px 14px rgba(18, 115, 230, 0.16)',
                        background: 'var(--surface, #FFFFFF)',
                      }
                    : undefined
                }
              >
                <div
                  className="inv-cat-card-icon"
                  style={
                    isAllActive
                      ? { background: 'var(--b-600, #1273E6)', color: '#FFFFFF', borderColor: 'var(--b-600, #1273E6)' }
                      : { background: allVisual.bgColor, color: allVisual.color, borderColor: allVisual.borderColor }
                  }
                >
                  <i className={`fa-solid ${allVisual.icon}`} />
                </div>
                <div className="inv-cat-card-name" style={{ color: isAllActive ? 'var(--b-700, #0B5FBF)' : undefined }}>
                  Semua
                </div>
                <div
                  className="inv-cat-card-count"
                  style={{ color: isAllActive ? 'var(--b-600, #1273E6)' : undefined, fontWeight: isAllActive ? 700 : 500 }}
                >
                  {items.length} alat
                </div>
              </button>
            );
          })()}

          {/* Seluruh 17 Kategori Kanonikal */}
          {canonicalCategories.map((cat) => {
            const cnt = items.filter(
              (x) => normalizeInventoryCategory(x.kategori).toLowerCase() === cat.toLowerCase()
            ).length;
            const isActive = catFilter.toLowerCase() === cat.toLowerCase();
            const visual = getCategoryVisual(cat);

            return (
              <button
                key={cat}
                type="button"
                className={`inv-cat-card ${isActive ? 'on' : ''}`}
                onClick={() => setCatFilter(cat)}
                style={
                  isActive
                    ? {
                        borderColor: 'var(--b-600, #1273E6)',
                        boxShadow: '0 0 0 2px var(--b-600, #1273E6), 0 4px 14px rgba(18, 115, 230, 0.16)',
                        background: 'var(--surface, #FFFFFF)',
                      }
                    : undefined
                }
              >
                <div
                  className="inv-cat-card-icon"
                  style={
                    isActive
                      ? { background: 'var(--b-600, #1273E6)', color: '#FFFFFF', borderColor: 'var(--b-600, #1273E6)' }
                      : { background: visual.bgColor, color: visual.color, borderColor: visual.borderColor }
                  }
                >
                  <i className={`fa-solid ${visual.icon}`} />
                </div>
                <div className="inv-cat-card-name" style={{ color: isActive ? 'var(--b-700, #0B5FBF)' : undefined }}>
                  {cat}
                </div>
                <div
                  className="inv-cat-card-count"
                  style={{ color: isActive ? 'var(--b-600, #1273E6)' : undefined, fontWeight: isActive ? 700 : 500 }}
                >
                  {cnt} alat
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 4. STATUS SEGMENTED TOOLBAR & ACTION + ALAT ── */}
      <div
        className="inv-toolbar-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginTop: '16px',
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
            className={`inv-segment-btn ${statusFilter === 'Bermasalah' ? 'on' : ''}`}
            onClick={() => setStatusFilter('Bermasalah')}
          >
            <span className="inv-segment-dot" style={{ background: '#ef4444' }} />
            <span>Bermasalah</span>
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
                fontWeight: 600,
                color: 'var(--warn, #9A6B08)',
                background: 'var(--warn-bg, #FCF0D6)',
                border: '1px solid var(--warn-border, rgba(154, 107, 8, 0.25))',
                borderRadius: 'var(--ptv-curve-pill)',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-rotate-left" style={{ marginRight: '5px', fontSize: '10.5px' }} />
              Reset Filter
            </button>
          )}

          {canCreate && (
            <button
              type="button"
              id="btnAddNewAsset"
              className="btn sm pri"
              onClick={() => setIsNewAssetOpen(true)}
              style={{
                minHeight: '36px',
                padding: '0 16px',
                borderRadius: 'var(--ptv-curve-pill)',
                fontWeight: 700,
                fontSize: '13px',
                boxShadow: '0 2px 8px rgba(18,115,230,0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-plus" />
              <span>Alat</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 5. RESULT COUNT LABEL ── */}
      <div style={{ marginTop: '14px', marginBottom: '12px', padding: '0 2px' }}>
        <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink, #0B2A4A)' }}>
          {filteredRows.length} alat
          {catFilter !== 'semua' ? ` • ${catFilter}` : ''}
          {statusFilter !== 'semua' ? ` (${statusFilter})` : ''}
        </span>
      </div>

      {/* ── 6. PRODUCT CATALOG GRID (DOMINANT PHOTO CARDS) ── */}
      {loading ? (
        <InventoryGridSkeleton count={6} />
      ) : filteredRows.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '52px 24px',
            minHeight: '260px',
            background: 'var(--surface, #FFFFFF)',
            border: '1px solid var(--line-2, rgba(11, 42, 74, 0.08))',
            borderRadius: 'var(--ptv-curve-xl)',
            boxShadow: 'var(--shadow-s)',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'var(--bg-2, #F7FBFF)',
              display: 'grid',
              placeItems: 'center',
              fontSize: '22px',
              color: 'var(--muted, #6E8CAE)',
              marginBottom: '12px',
            }}
          >
            <i className="fa-solid fa-boxes-stacked" />
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink, #0B2A4A)', marginBottom: '4px' }}>
            Tidak ada alat yang cocok
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted, #6E8CAE)', maxWidth: '340px' }}>
            Ubah kata kunci pencarian atau reset filter untuk melihat katalog inventaris lengkap.
          </div>
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
                marginTop: '16px',
                borderRadius: 'var(--ptv-curve-pill)',
                padding: '0 16px',
                minHeight: '34px',
                fontWeight: 650,
                color: 'var(--b-700, #0B5FBF)',
                background: 'var(--b-050, #EDF4FF)',
                border: '1px solid var(--b-300, #A7CEFF)',
                cursor: 'pointer',
              }}
            >
              Reset Filter
            </button>
          )}
        </div>
      ) : (
        <div className="inv-catalog-grid">
          {filteredRows.map((x) => {
            const avail = x.unit_tersedia;
            const total = x.total_unit;
            const borrowed = total - avail;
            const damaged = x.units.filter(
              (u) =>
                u.kondisi === 'rusak' ||
                u.kondisi === 'perlu_servis' ||
                u.kondisi === 'hilang' ||
                u.status_peminjaman === 'maintenance'
            ).length;

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
              badgeTxt = 'Bermasalah';
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
            const resolvedPhoto = resolveInventoryPhotoUrl(x.foto_url);
            const catVisual = getCategoryVisual(x.kategori);

            return (
              <div
                role="button"
                tabIndex={0}
                key={x.id}
                className="inv-prod-card"
                onClick={() => handleOpenDetail(x.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleOpenDetail(x.id);
                  }
                }}
                style={
                  inBasket
                    ? { borderColor: 'var(--b-400)', boxShadow: '0 0 0 2px var(--b-100)', cursor: 'pointer' }
                    : { cursor: 'pointer' }
                }
              >
                {/* 1. Status ketersediaan (badge pada foto) */}
                <div className="inv-prod-photo">
                  {resolvedPhoto ? (
                    <img
                      src={resolvedPhoto}
                      alt={x.nama_alat}
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <span
                    className="inv-prod-icon"
                    style={{
                      display: resolvedPhoto ? 'none' : 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      height: '100%',
                      fontSize: '36px',
                      color: catVisual.color,
                      opacity: 0.65,
                    }}
                  >
                    <i className={`fa-solid ${catVisual.icon}`} />
                  </span>

                  <span
                    className="inv-prod-status-badge"
                    style={{
                      color: badgeColor,
                      borderColor: badgeBorder,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: dotColor,
                      }}
                    />
                    <span>{badgeTxt}</span>
                  </span>
                </div>

                {/* 2. Detail Card Body */}
                <div className="inv-prod-body">
                  {/* 2a. Kode & Kategori */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div className="inv-prod-code">{x.kode || `INV-${String(x.id).slice(0, 5).toUpperCase()}`}</div>
                    <span className="inv-prod-cat" style={{ fontSize: '10.5px', color: 'var(--muted)', fontWeight: 600, textTransform: 'capitalize' }}>
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
                    <div className="inv-prod-unit-status trunc" style={{ fontSize: '11px', fontWeight: 600, lineHeight: 1.25 }}>
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
                            1 unit &bull; Bermasalah
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>0 unit</span>
                        )
                      ) : (
                        <span style={{ color: 'var(--ink)' }}>
                          Total {total} unit &bull;{' '}
                          <span style={{ color: avail > 0 ? '#16a34a' : '#dc2626' }}>
                            {avail} siap pakai
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Quick Add Button / Lokasi */}
                    <div
                      className="inv-prod-loc-row"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '4px',
                        paddingTop: '4px',
                        borderTop: '1px solid var(--line-2)',
                      }}
                    >
                      <span className="inv-prod-loc-text trunc" style={{ fontSize: '10px', color: 'var(--muted)' }}>
                        <i className="fa-solid fa-location-dot" style={{ marginRight: '3px' }} />
                        {x.lokasi_penyimpanan || 'Studio PTV'}
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
      {scanOpen && (
        <InventoryScanDialog
          onClose={() => setScanOpen(false)}
          catalogItems={items}
          onScan={(value, match) => {
            setScanOpen(false);
            if (match?.asset) {
              setUnitPickerAsset(match.asset);
            } else {
              setSearchQ(value);
            }
          }}
        />
      )}
      <UnitPickerModal
        isOpen={unitPickerAsset !== null}
        asset={unitPickerAsset}
        onClose={() => setUnitPickerAsset(null)}
        onOpenLoanModal={() => {
          setUnitPickerAsset(null);
          setIsDaftarPinjamanOpen(true);
        }}
      />

      {/* ── MODAL PINJAM ALAT (LOAN MODAL) ── */}
      <LoanModal
        isOpen={isDaftarPinjamanOpen}
        onClose={() => setIsDaftarPinjamanOpen(false)}
        onSuccess={() => {
          loadData();
        }}
      />

      {/* ── MODAL TAMBAH ALAT BARU (SUPABASE ATOMIC RPC) ── */}
      <TambahAlatModal
        isOpen={isNewAssetOpen}
        onClose={() => setIsNewAssetOpen(false)}
        onSuccess={() => {
          setIsNewAssetOpen(false);
          loadData();
        }}
      />
    </div>
  );
};
