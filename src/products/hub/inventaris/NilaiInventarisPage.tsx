import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { inventarisService, NilaiFilterParams } from './inventarisService';
import { ItemInventaris } from './types';
import { PTVSelect, TableSkeleton } from '@shared/components';
import { useInstantData } from '@shared/hooks/useInstantData';
import { resolveInventoryPhotoUrl } from './utils/inventoryPhotoUtils';

export const formatRupiah = (val: number | string | undefined | null): string => {
  const n = typeof val === 'number' ? val : parseFloat(String(val || 0).replace(/[^0-9.-]/g, '')) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
};

export const formatDateIndo = (isoDate?: string): string => {
  if (!isoDate) return '—';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
};

export const getCatIconClass = (cat: string) => {
  const lower = cat.toLowerCase();
  if (lower.includes('kamera')) return 'fa-camera-retro';
  if (lower.includes('lensa')) return 'fa-circle-dot';
  if (lower.includes('audio') || lower.includes('mic')) return 'fa-microphone';
  if (lower.includes('lighting') || lower.includes('lampu')) return 'fa-lightbulb';
  if (lower.includes('stabilizer') || lower.includes('gimbal')) return 'fa-arrows-to-dot';
  if (lower.includes('tripod') || lower.includes('rig')) return 'fa-arrows-to-dot';
  return 'fa-box';
};

export const getCatCompanionClass = (cat: string) => {
  const lower = cat.toLowerCase();
  if (lower.includes('kamera')) return 'ptv-nilai-cat-kamera';
  if (lower.includes('lensa')) return 'ptv-nilai-cat-lensa';
  if (lower.includes('audio') || lower.includes('mic')) return 'ptv-nilai-cat-audio';
  if (lower.includes('lighting') || lower.includes('lampu')) return 'ptv-nilai-cat-lighting';
  if (lower.includes('stabilizer') || lower.includes('gimbal')) return 'ptv-nilai-cat-stabilizer';
  if (lower.includes('tripod') || lower.includes('rig')) return 'ptv-nilai-cat-tripod';
  if (lower.includes('baterai') || lower.includes('power')) return 'ptv-nilai-cat-baterai';
  if (lower.includes('streaming') || lower.includes('live')) return 'ptv-nilai-cat-streaming';
  if (lower.includes('komputer') || lower.includes('laptop')) return 'ptv-nilai-cat-komputer';
  if (lower.includes('kabel') || lower.includes('adapter')) return 'ptv-nilai-cat-kabel';
  return 'ptv-nilai-cat-lainnya';
};

export const NilaiInventarisPage: React.FC = () => {
  const { can } = useSessionStore();
  const navigate = useNavigate();

  // Role permissions
  const canView = can('inventory.valuation.view');
  const canManage = can('inventory.valuation.manage') || can('inventory.create');
  const canDelete = can('inventory.delete');

  // Navigation State Persistence (PTV-DEV-186)
  const savedNavState = React.useRef<{ searchQ?: string; filterStatus?: string; filterCat?: string; filterSource?: string; sortBy?: any; scrollY?: number } | null>(null);
  if (savedNavState.current === null && typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem('ptv_nilai_nav_state');
      if (raw) savedNavState.current = JSON.parse(raw);
    } catch (e) {
      void e;
    }
  }

  // Filters state with persistence
  const [searchQ, setSearchQ] = useState(() => savedNavState.current?.searchQ || '');
  const [filterStatus, setFilterStatus] = useState(() => savedNavState.current?.filterStatus || 'semua');
  const [filterCat, setFilterCat] = useState(() => savedNavState.current?.filterCat || 'semua');
  const [filterSource, setFilterSource] = useState(() => savedNavState.current?.filterSource || 'semua');
  const [sortBy, setSortBy] = useState<'default' | 'val_desc' | 'val_asc' | 'date_desc' | 'name_asc'>(() => savedNavState.current?.sortBy || 'default');

  // Instant-First Persistent Cache: Instant display on remount, background revalidation
  const {
    data: rawItems,
    isLoading: loading,
    refetch: loadData,
  } = useInstantData<ItemInventaris[]>({
    key: 'inventaris_catalog_list',
    fetcher: () => inventarisService.getInventarisList(),
    ttlMs: 15 * 60 * 1000,
    initialFallback: [],
  });
  const [displayItems, setDisplayItems] = useState<ItemInventaris[]>([]);

  // Edit / Catat Modal state
  const [editingItem, setEditingItem] = useState<ItemInventaris | null>(null);
  const [editForm, setEditForm] = useState<{
    nilai_perolehan: string;
    nilai_residu: string;
    nilai_tercatat: string;
    tanggal_perolehan: string;
    sumber_perolehan: string;
    vendor: string;
    nomor_invoice: string;
    status: 'Aktif' | 'Belum Dicatat' | 'Dihapuskan';
    catatan: string;
  }>({
    nilai_perolehan: '',
    nilai_residu: '',
    nilai_tercatat: '',
    tanggal_perolehan: '',
    sumber_perolehan: 'Yayasan',
    vendor: '',
    nomor_invoice: '',
    status: 'Aktif',
    catatan: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Filters synchronization

  useEffect(() => {
    try {
      sessionStorage.setItem(
        'ptv_nilai_nav_state',
        JSON.stringify({ searchQ, filterStatus, filterCat, filterSource, sortBy, scrollY: window.scrollY })
      );
    } catch (e) {
      void e;
    }
  }, [searchQ, filterStatus, filterCat, filterSource, sortBy]);

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
        'ptv_nilai_nav_state',
        JSON.stringify({ searchQ, filterStatus, filterCat, filterSource, sortBy, scrollY: window.scrollY })
      );
    } catch (e) {
      void e;
    }
    navigate(`/hub/inventaris/nilai/${id}`);
  };

  // Filter effect
  useEffect(() => {
    const filterParams: NilaiFilterParams = {
      q: searchQ,
      status: filterStatus,
      cat: filterCat,
      source: filterSource,
      sortBy,
    };
    inventarisService.getNilaiInventarisList(filterParams).then((res) => {
      setDisplayItems(res);
    });
  }, [rawItems, searchQ, filterStatus, filterCat, filterSource, sortBy]);

  // Calculations from currently filtered dataset
  let totalValuation = 0;
  let itemsWithValueCount = 0;
  displayItems.forEach((item) => {
    const v = item.nilai_inventaris;
    if (v && v.nilai_perolehan > 0) {
      totalValuation += v.nilai_perolehan;
      itemsWithValueCount++;
    }
  });

  const totalRegisteredItems = displayItems.length;
  const avgValuation = itemsWithValueCount > 0 ? Math.round(totalValuation / itemsWithValueCount) : 0;
  const coveragePercent = totalRegisteredItems > 0 ? Math.round((itemsWithValueCount / totalRegisteredItems) * 100) : 0;
  const unrecordedCount = totalRegisteredItems - itemsWithValueCount;

  // Active categories & sources
  const catSet = new Set<string>();
  rawItems.forEach((x) => catSet.add(x.kategori));
  const activeCats = Array.from(catSet).sort();

  const sourceSet = new Set<string>(['Yayasan', 'Kas PTV', 'Hibah Alumni']);
  rawItems.forEach((x) => {
    if (x.sumber_perolehan) sourceSet.add(x.sumber_perolehan);
    if (x.nilai_inventaris?.sumber_perolehan) sourceSet.add(x.nilai_inventaris.sumber_perolehan);
  });
  const availableSources = Array.from(sourceSet).sort();

  const isFiltered = filterCat !== 'semua' || filterStatus !== 'semua' || filterSource !== 'semua' || !!searchQ || sortBy !== 'default';

  const resetFilters = () => {
    setSearchQ('');
    setFilterStatus('semua');
    setFilterCat('semua');
    setFilterSource('semua');
    setSortBy('default');
  };

  // Open Edit modal
  const handleOpenEdit = (item: ItemInventaris) => {
    setEditingItem(item);
    const v = item.nilai_inventaris;
    setEditForm({
      nilai_perolehan: v?.nilai_perolehan ? String(v.nilai_perolehan) : '',
      nilai_residu: v?.nilai_residu ? String(v.nilai_residu) : '',
      nilai_tercatat: v?.nilai_tercatat ? String(v.nilai_tercatat) : '',
      tanggal_perolehan: v?.tanggal_perolehan || new Date().toISOString().split('T')[0],
      sumber_perolehan: v?.sumber_perolehan || item.sumber_perolehan || 'Yayasan',
      vendor: v?.vendor || '',
      nomor_invoice: v?.nomor_invoice || '',
      status: v?.status || 'Aktif',
      catatan: v?.catatan || '',
    });
  };

  // Save Edit modal
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const nilaiNum = parseFloat(editForm.nilai_perolehan.replace(/[^0-9.]/g, '')) || 0;
    if (nilaiNum <= 0) {
      alert('Mohon masukkan nilai perolehan yang valid.');
      return;
    }

    setSubmitting(true);
    try {
      await inventarisService.updateNilaiInventaris(editingItem.id, {
        nilai_perolehan: nilaiNum,
        nilai_residu: editForm.nilai_residu ? parseFloat(editForm.nilai_residu.replace(/[^0-9.]/g, '')) : undefined,
        nilai_tercatat: editForm.nilai_tercatat ? parseFloat(editForm.nilai_tercatat.replace(/[^0-9.]/g, '')) : undefined,
        tanggal_perolehan: editForm.tanggal_perolehan,
        sumber_perolehan: editForm.sumber_perolehan,
        vendor: editForm.vendor,
        nomor_invoice: editForm.nomor_invoice,
        status: editForm.status,
        catatan: editForm.catatan,
      });
      setEditingItem(null);
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  // Delete valuation handler
  const handleDeleteNilai = async (assetId: string, assetName: string) => {
    if (!confirm(`Hapus catatan nilai finansial untuk "${assetName}"? Data fisik alat akan tetap ada di katalog.`)) {
      return;
    }
    await inventarisService.deleteNilaiInventaris(assetId);
    await loadData();
  };

  // Unauthorized screen
  if (!canView) {
    return (
      <div className="page subview-fade">
        <div style={{ background: 'var(--surface)', border: '1px solid var(--dang-border)', borderRadius: 'var(--ptv-curve-xl)', padding: '36px 24px', textAlign: 'center', maxWidth: '560px', margin: '40px auto' }}>
          <div style={{ width: '56px', height: '56px', background: 'var(--dang-bg)', color: 'var(--dang)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
            <i className="fa-solid fa-lock" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', marginBottom: '8px' }}>Akses Modul Terbatas</h3>
          <p style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.5, marginBottom: '20px' }}>
            Modul <b>Nilai Inventaris PTV</b> hanya dapat diakses oleh peran <b>Eksekutif, Administrasi, dan Kru Operasional</b> aktif.
          </p>
          <button className="ptv-nilai-btn-catalog" onClick={() => navigate('/hub/beranda')} style={{ margin: '0 auto' }}>
            <i className="fa-solid fa-house" /> Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page subview-fade ptv-nilai-page" style={{ paddingTop: '4px' }}>
      {/* Simulation Banner Notice */}
      <div className="ptv-nilai-notice-banner">
        <i className="fa-solid fa-circle-info ptv-nilai-notice-icon" />
        <span className="ptv-nilai-notice-text">
          <strong>Data Simulasi Finansial:</strong> Nilai perolehan dan catatan valuasi yang ditampilkan di bawah ini merupakan data simulasi untuk keperluan verifikasi antarmuka dan operasional sistem, bukan nilai buku riil aset Progresif TV.
        </span>
      </div>

      {/* ── 1. Standard R03 Header ── */}
      <header className="ptv-page-header">
        <div className="ptv-page-header-main">
          <h1 className="ptv-page-title">Nilai Inventaris PTV</h1>
          <p className="ptv-page-subtitle">
            Valuasi aset, pencatatan perolehan, dan audit finansial peralatan Progresif TV
          </p>
        </div>
        <div className="ptv-page-header-actions">
          <button
            type="button"
            className="ptv-nilai-btn-catalog"
            onClick={() => navigate('/hub/inventaris')}
          >
            <i className="fa-solid fa-boxes-stacked" />
            <span>Katalog Alat</span>
          </button>
        </div>
      </header>

      {/* ── 2. KPI Metric Bento Grid ── */}
      <div className="ptv-nilai-kpi-grid">
        {/* Total Nilai */}
        <div className="ptv-nilai-kpi-card kpi-total">
          <div className="ptv-nilai-kpi-card-hd">
            <span className="ptv-nilai-kpi-card-lbl">Total Nilai Aset</span>
            <span className="ptv-nilai-kpi-card-ic ptv-nilai-ic-total">
              <i className="fa-solid fa-vault" />
            </span>
          </div>
          <div className="ptv-nilai-kpi-card-val">
            {formatRupiah(totalValuation)}
          </div>
          <div className="ptv-nilai-kpi-card-sub">
            Akumulasi {itemsWithValueCount} jenis alat bernilai ({totalRegisteredItems} ditampilkan)
          </div>
        </div>

        {/* Cakupan Valuasi */}
        <div className="ptv-nilai-kpi-card kpi-coverage">
          <div className="ptv-nilai-kpi-card-hd">
            <span className="ptv-nilai-kpi-card-lbl">Cakupan Valuasi</span>
            <span className="ptv-nilai-kpi-card-ic ptv-nilai-ic-coverage">
              <i className="fa-solid fa-chart-pie" />
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span className="ptv-nilai-kpi-card-val">{coveragePercent}%</span>
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>({itemsWithValueCount}/{totalRegisteredItems})</span>
          </div>
          <div className="ptv-nilai-coverage-progress-rail">
            <div className="ptv-nilai-coverage-progress-fill" style={{ width: `${coveragePercent}%` }} />
          </div>
        </div>

        {/* Rata-rata Nilai */}
        <div className="ptv-nilai-kpi-card kpi-avg">
          <div className="ptv-nilai-kpi-card-hd">
            <span className="ptv-nilai-kpi-card-lbl">Rata-rata / Alat</span>
            <span className="ptv-nilai-kpi-card-ic ptv-nilai-ic-avg">
              <i className="fa-solid fa-calculator" />
            </span>
          </div>
          <div className="ptv-nilai-kpi-card-val">
            {formatRupiah(avgValuation)}
          </div>
          <div className="ptv-nilai-kpi-card-sub">
            Rata-rata alat bernilai
          </div>
        </div>

        {/* Belum Dicatat */}
        <div className="ptv-nilai-kpi-card kpi-unrecorded">
          <div className="ptv-nilai-kpi-card-hd">
            <span className="ptv-nilai-kpi-card-lbl">Belum Dicatat</span>
            <span className="ptv-nilai-kpi-card-ic ptv-nilai-ic-unrecorded">
              <i className="fa-solid fa-file-circle-question" />
            </span>
          </div>
          <div className="ptv-nilai-kpi-card-val unrecorded">
            {unrecordedCount} <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Alat</span>
          </div>
          <div className="ptv-nilai-kpi-card-sub">
            Menunggu data perolehan
          </div>
        </div>
      </div>

      {/* ── 3. Filters & Search Toolbar ── */}
      <div className="ptv-nilai-filter-bar">
        <div className="ptv-nilai-toolbar-vertical-wrap">
          {/* Search Input (Pure Pill >=48px, >=16px font) */}
          <div className="ptv-nilai-search-wrap">
            <i className="fa-solid fa-magnifying-glass ptv-nilai-search-icon" />
            <input
              type="text"
              id="nilaiSearchInput"
              className="ptv-nilai-search-input"
              placeholder="Cari nama alat, kode, vendor, invoice, sumber..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
            {searchQ && (
              <button
                type="button"
                className="ptv-nilai-search-clear-btn"
                id="nilaiSearchClearBtn"
                onClick={() => setSearchQ('')}
                aria-label="Hapus pencarian"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="ptv-nilai-filter-grid">
            {/* Status */}
            <div className="ptv-nilai-filter-col">
              <PTVSelect
                id="nilaiFilterStatusSel"
                value={filterStatus}
                onChange={(val) => setFilterStatus(val)}
                options={[
                  { value: 'semua', label: 'Semua Status' },
                  { value: 'Aktif', label: 'Aktif' },
                  { value: 'Belum Dicatat', label: 'Belum Dicatat' },
                ]}
                ariaLabel="Filter Status Nilai"
              />
            </div>

            {/* Kategori */}
            <div className="ptv-nilai-filter-col">
              <PTVSelect
                id="nilaiFilterCatSel"
                value={filterCat}
                onChange={(val) => setFilterCat(val)}
                options={[
                  { value: 'semua', label: 'Semua Kategori' },
                  ...activeCats.map((c) => ({ value: c, label: c })),
                ]}
                ariaLabel="Filter Kategori"
              />
            </div>

            {/* Sumber Dana */}
            <div className="ptv-nilai-filter-col">
              <PTVSelect
                id="nilaiFilterSourceSel"
                value={filterSource}
                onChange={(val) => setFilterSource(val)}
                options={[
                  { value: 'semua', label: 'Semua Sumber' },
                  ...availableSources.map((s) => ({ value: s, label: s })),
                ]}
                ariaLabel="Filter Sumber Dana"
              />
            </div>

            {/* Urutkan */}
            <div className="ptv-nilai-filter-col">
              <PTVSelect
                id="nilaiSortBySel"
                value={sortBy}
                onChange={(val) => setSortBy(val as any)}
                options={[
                  { value: 'default', label: 'Urutan: Kategori' },
                  { value: 'val_desc', label: 'Nilai: Tertinggi' },
                  { value: 'val_asc', label: 'Nilai: Terendah' },
                  { value: 'date_desc', label: 'Perolehan: Terbaru' },
                  { value: 'name_asc', label: 'Nama: A → Z' },
                ]}
                ariaLabel="Urutan Filter Nilai Inventaris"
              />
            </div>
          </div>
        </div>

        {isFiltered && (
          <div className="ptv-nilai-filter-counter-wrap">
            <span>
              Menampilkan <b>{displayItems.length}</b> dari <b>{rawItems.length}</b> alat
            </span>
            <button
              type="button"
              className="ptv-nilai-btn-reset-pill"
              onClick={resetFilters}
            >
              <i className="fa-solid fa-rotate-left" /> Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* ── 4. Data List Cards ── */}
      <div id="nilaiInventarisListWrap">
        {loading && rawItems.length === 0 ? (
          <TableSkeleton rows={5} />
        ) : displayItems.length === 0 ? (
          <div className="ptv-nilai-empty-card">
            <i className="fa-solid fa-box-open ptv-nilai-empty-icon" />
            <h4 className="ptv-nilai-empty-title">Tidak Ada Data Inventaris yang Cocok</h4>
            <p className="ptv-nilai-empty-text">Silakan sesuaikan kata kunci pencarian atau filter status nilai di atas.</p>
            <button type="button" className="ptv-nilai-btn-catalog" onClick={resetFilters} style={{ margin: '0 auto' }}>
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="ptv-nilai-list">
            {displayItems.map((x) => {
              const v = x.nilai_inventaris;
              const hasVal = Boolean(v && v.nilai_perolehan > 0);
              const totalUnits = x.total_unit;
              const availUnits = x.unit_tersedia;
              const borrowedUnits = totalUnits - availUnits;
              const damagedUnits = x.units.filter((u) => u.kondisi === 'rusak' || u.status_peminjaman === 'maintenance').length;
              const sourceName = v?.sumber_perolehan || x.sumber_perolehan || 'Yayasan';
              const tglPerolehan = v?.tanggal_perolehan ? formatDateIndo(v.tanggal_perolehan) : '—';
              const vendorName = v?.vendor || '—';
              const noInvoice = v?.nomor_invoice || '—';
              const statusAset = v?.status || (hasVal ? 'Aktif' : 'Belum Dicatat');
              const locName = x.units[0]?.lokasi_penyimpanan || 'Studio PTV';

              return (
                <div key={x.id} className={`ptv-nilai-card ${hasVal ? 'has-val' : 'no-val'}`}>
                  <div className="ptv-nilai-card-inner">
                    {/* Left: Thumbnail + Name + Code + Badges */}
                    <div className="ptv-nilai-card-main-col">
                      <div className={`ptv-nilai-thumb ${getCatCompanionClass(x.kategori)}`} data-cat={x.kategori.toLowerCase()}>
                        {(() => {
                          const resolvedPhoto = resolveInventoryPhotoUrl(x.foto_url);
                          return (
                            <>
                              {resolvedPhoto ? (
                                <img
                                  src={resolvedPhoto}
                                  alt={x.nama_alat}
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                    if (fallback) fallback.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div
                                style={{
                                  display: resolvedPhoto ? 'none' : 'flex',
                                  width: '100%',
                                  height: '100%',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '22px',
                                }}
                              >
                                <i className={`fa-solid ${getCatIconClass(x.kategori)}`} />
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Text metadata */}
                      <div className="ptv-nilai-card-info">
                        <div className="ptv-nilai-badges">
                          <span className="ptv-nilai-badge-code">{x.kode}</span>
                          <span className={`ptv-nilai-badge-cat ${getCatCompanionClass(x.kategori)}`} data-cat={x.kategori.toLowerCase()}>
                            <i className={`fa-solid ${getCatIconClass(x.kategori)}`} style={{ fontSize: '10px', marginRight: '4px' }} />
                            {x.kategori}
                          </span>
                          <span className="ptv-nilai-badge-loc">
                            <i className="fa-solid fa-location-dot" style={{ fontSize: '9.5px', marginRight: '3px', color: 'var(--muted)' }} />
                            {locName}
                          </span>
                        </div>

                        <h3
                          className="ptv-nilai-card-name"
                          onClick={() => handleOpenDetail(x.id)}
                        >
                          {x.nama_alat}
                        </h3>

                        {x.spesifikasi ? <div className="ptv-nilai-card-brand">{x.spesifikasi}</div> : null}

                        {/* Physical units pill summary */}
                        <div className="ptv-nilai-card-units">
                          <span className="ptv-nilai-unit-badge total">{totalUnits} Unit Fisik</span>
                          <span className="ptv-nilai-unit-badge avail">{availUnits} Tersedia</span>
                          {borrowedUnits > 0 && <span className="ptv-nilai-unit-badge borrow">{borrowedUnits} Dipinjam</span>}
                          {damagedUnits > 0 && <span className="ptv-nilai-unit-badge dmg">{damagedUnits} Rusak</span>}
                        </div>
                      </div>
                    </div>

                    {/* Center: Valuation Dossier Box */}
                    <div className="ptv-nilai-card-dossier-col">
                      <div className="ptv-nilai-dossier-hd">
                        <span className="ptv-nilai-dossier-title">Nilai Perolehan</span>
                        <span className={`ptv-nilai-dossier-badge-status ${hasVal ? 'aktif' : 'belum-dicatat'}`}>
                          {hasVal ? statusAset : 'Belum Dicatat'}
                        </span>
                      </div>

                      <div className="ptv-nilai-dossier-val">{hasVal && v ? formatRupiah(v.nilai_perolehan) : 'Rp —'}</div>

                      {hasVal && v && totalUnits > 1 && (
                        <div className="ptv-nilai-dossier-unit-breakdown">
                          @ {formatRupiah(Math.round(v.nilai_perolehan / totalUnits))} &times; {totalUnits} Unit
                        </div>
                      )}

                      <div className="ptv-nilai-dossier-meta-grid">
                        <span className="meta-lbl">
                          <i className="fa-regular fa-calendar" style={{ fontSize: '10px' }} />
                          Tanggal:
                        </span>
                        <span className="meta-val">{tglPerolehan}</span>

                        <span className="meta-lbl">
                          <i className="fa-solid fa-hand-holding-dollar" style={{ fontSize: '10px' }} />
                          Sumber:
                        </span>
                        <span className="meta-val">{sourceName}</span>

                        {vendorName !== '—' && (
                          <>
                            <span className="meta-lbl">
                              <i className="fa-solid fa-store" style={{ fontSize: '10px' }} />
                              Vendor:
                            </span>
                            <span className="meta-val" title={vendorName}>
                              {vendorName}
                            </span>
                          </>
                        )}

                        {noInvoice !== '—' && (
                          <>
                            <span className="meta-lbl">
                              <i className="fa-solid fa-receipt" style={{ fontSize: '10px' }} />
                              Invoice:
                            </span>
                            <span className="meta-val" title={noInvoice}>
                              {noInvoice}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="ptv-nilai-card-actions-col">
                      <button
                        type="button"
                        className="ptv-nilai-btn-detail"
                        onClick={() => handleOpenDetail(x.id)}
                      >
                        <i className="fa-solid fa-eye" />
                        <span>Detail</span>
                      </button>

                      {canManage && (
                        <button
                          type="button"
                          className="ptv-nilai-btn-edit"
                          onClick={() => handleOpenEdit(x)}
                        >
                          <i className={`fa-solid ${hasVal ? 'fa-pen-to-square' : 'fa-plus'}`} />
                          <span>{hasVal ? 'Ubah' : 'Catat Nilai'}</span>
                        </button>
                      )}

                      {canDelete && hasVal && (
                        <button
                          type="button"
                          className="ptv-nilai-btn-del"
                          onClick={() => handleDeleteNilai(x.id, x.nama_alat)}
                          aria-label={`Hapus catatan nilai finansial untuk ${x.nama_alat}`}
                          title="Hapus catatan nilai finansial saja (alat fisik tetap ada)"
                        >
                          <i className="fa-regular fa-trash-can" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal Edit / Catat Nilai ── */}
      {editingItem && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="ptv-nilai-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingItem(null);
          }}
        >
          <form onSubmit={handleSaveEdit} className="ptv-nilai-modal-card">
            {/* Modal Header */}
            <div className="ptv-nilai-modal-header">
              <div>
                <h3 className="ptv-nilai-modal-title">
                  {editingItem.nilai_inventaris ? 'Ubah Catatan Nilai' : 'Catat Nilai Inventaris'}
                </h3>
                <span className="ptv-nilai-modal-sub">
                  {editingItem.kode} &bull; {editingItem.nama_alat}
                </span>
              </div>
              <button
                type="button"
                className="ptv-nilai-modal-close-btn"
                onClick={() => setEditingItem(null)}
                aria-label="Tutup modal"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="ptv-nilai-modal-body">
              <div className="ptv-nilai-form-group">
                <label className="ptv-nilai-form-label">
                  <span>Total Nilai Perolehan (Rp)</span>
                  <span className="req">*</span>
                </label>
                <input
                  type="number"
                  className="ptv-nilai-form-input"
                  required
                  placeholder="Contoh: 58000000"
                  value={editForm.nilai_perolehan}
                  onChange={(e) => setEditForm({ ...editForm, nilai_perolehan: e.target.value })}
                />
                <span className="ptv-nilai-form-hint">
                  Format Rupiah: {editForm.nilai_perolehan ? formatRupiah(editForm.nilai_perolehan) : 'Rp 0'}
                </span>
              </div>

              <div className="ptv-nilai-form-row-2col">
                <div className="ptv-nilai-form-group">
                  <label className="ptv-nilai-form-label">
                    <span>Tanggal Perolehan</span>
                    <span className="req">*</span>
                  </label>
                  <input
                    type="date"
                    className="ptv-nilai-form-input"
                    required
                    value={editForm.tanggal_perolehan}
                    onChange={(e) => setEditForm({ ...editForm, tanggal_perolehan: e.target.value })}
                  />
                </div>
                <div className="ptv-nilai-form-group">
                  <label className="ptv-nilai-form-label">
                    <span>Sumber Dana</span>
                    <span className="req">*</span>
                  </label>
                  <PTVSelect
                    value={editForm.sumber_perolehan}
                    onChange={(val) => setEditForm({ ...editForm, sumber_perolehan: val })}
                    options={[
                      { value: 'Yayasan', label: 'Yayasan' },
                      { value: 'Kas PTV', label: 'Kas PTV' },
                      { value: 'Hibah Alumni', label: 'Hibah Alumni' },
                      { value: 'Donasi', label: 'Donasi' },
                    ]}
                    ariaLabel="Sumber Dana Perolehan"
                  />
                </div>
              </div>

              <div className="ptv-nilai-form-row-2col">
                <div className="ptv-nilai-form-group">
                  <label className="ptv-nilai-form-label">Vendor / Toko</label>
                  <input
                    type="text"
                    className="ptv-nilai-form-input"
                    placeholder="Contoh: JPC Kemang"
                    value={editForm.vendor}
                    onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                  />
                </div>
                <div className="ptv-nilai-form-group">
                  <label className="ptv-nilai-form-label">Nomor Invoice</label>
                  <input
                    type="text"
                    className="ptv-nilai-form-input"
                    placeholder="Contoh: INV/2024/001"
                    value={editForm.nomor_invoice}
                    onChange={(e) => setEditForm({ ...editForm, nomor_invoice: e.target.value })}
                  />
                </div>
              </div>

              <div className="ptv-nilai-form-group">
                <label className="ptv-nilai-form-label">Catatan Administratif</label>
                <textarea
                  className="ptv-nilai-form-textarea"
                  rows={2}
                  placeholder="Catatan kondisi atau keperluan pembelian..."
                  value={editForm.catatan}
                  onChange={(e) => setEditForm({ ...editForm, catatan: e.target.value })}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="ptv-nilai-modal-footer">
              <button
                type="button"
                className="ptv-nilai-btn-cancel-modal"
                onClick={() => setEditingItem(null)}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="ptv-nilai-btn-submit-modal"
              >
                {submitting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan Catatan Nilai</span>
                )}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
};
