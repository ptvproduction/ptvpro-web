import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { inventarisService, NilaiFilterParams } from './inventarisService';
import { ItemInventaris } from './types';
import { PTVSelect } from '@shared/components';

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

export const NilaiInventarisPage: React.FC = () => {
  const { can } = useSessionStore();
  const navigate = useNavigate();

  // Role permissions
  const canView = can('inventory.valuation.view');
  const canManage = can('inventory.valuation.manage') || can('inventory.create');
  const canDelete = can('inventory.delete');

  // Filters state
  const [searchQ, setSearchQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('semua');
  const [filterCat, setFilterCat] = useState('semua');
  const [filterSource, setFilterSource] = useState('semua');
  const [sortBy, setSortBy] = useState<'default' | 'val_desc' | 'val_asc' | 'date_desc' | 'name_asc'>('default');

  // Data state
  const [rawItems, setRawItems] = useState<ItemInventaris[]>([]);
  const [displayItems, setDisplayItems] = useState<ItemInventaris[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Load items
  const loadData = async () => {
    setLoading(true);
    try {
      const all = await inventarisService.getInventarisList();
      setRawItems(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const getCatIconClass = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes('kamera')) return 'fa-camera-retro';
    if (lower.includes('lensa')) return 'fa-circle-dot';
    if (lower.includes('audio') || lower.includes('mic')) return 'fa-microphone';
    if (lower.includes('lighting') || lower.includes('lampu')) return 'fa-lightbulb';
    if (lower.includes('stabilizer') || lower.includes('tripod') || lower.includes('gimbal')) return 'fa-arrows-to-dot';
    return 'fa-box';
  };

  // Unauthorized screen 1:1 legacy
  if (!canView) {
    return (
      <div className="page subview-fade">
        <div style={{ background: '#fff', border: '1.5px solid #fee2e2', borderRadius: 'var(--ptv-curve-xl)', padding: '32px 24px', textAlign: 'center', boxShadow: '0 4px 16px rgba(239,68,68,0.06)', maxWidth: '560px', margin: '40px auto' }}>
          <div style={{ width: '56px', height: '56px', background: '#fef2f2', color: '#ef4444', borderRadius: 'var(--ptv-curve-circle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
            <i className="fa-solid fa-lock" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Akses Modul Terbatas</h3>
          <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.5, marginBottom: '20px' }}>
            Modul <b>Nilai Inventaris PTV</b> hanya dapat diakses oleh peran <b>Eksekutif, Administrasi, dan Kru Operasional</b> aktif.
          </p>
          <button className="btn pri" onClick={() => navigate('/hub/beranda')} style={{ borderRadius: 'var(--ptv-curve-md)', padding: '8px 20px' }}>
            <i className="fa-solid fa-house" style={{ marginRight: '6px' }} /> Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page subview-fade ptv-nilai-page" style={{ paddingTop: '4px' }}>
      {/* Simulation Banner Notice */}
      <div style={{ background: 'var(--b-050, #eff6ff)', border: '1px solid var(--b-200, #bfdbfe)', borderRadius: 'var(--ptv-curve-md)', padding: '10px 14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <i className="fa-solid fa-circle-info" style={{ color: 'var(--b-600, #2563eb)', fontSize: '16px', flexShrink: 0 }} />
        <span style={{ fontSize: '12.5px', color: 'var(--b-800, #1e40af)', lineHeight: 1.4 }}>
          <strong>Data Simulasi Finansial:</strong> Nilai perolehan dan catatan valuasi yang ditampilkan di bawah ini merupakan data simulasi untuk keperluan verifikasi antarmuka dan operasional sistem, bukan nilai buku riil aset Progresif TV.
        </span>
      </div>

      {/* ── 1. Header 1:1 Legacy ── */}
      <div className="ptv-nilai-header">
        <div className="ptv-nilai-header-left">
          <div className="ptv-nilai-header-icon">
            <i className="fa-solid fa-coins" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="ptv-nilai-header-title">Nilai Inventaris PTV</h1>
            <p className="ptv-nilai-header-sub">
              Valuasi aset, pencatatan perolehan, dan audit finansial peralatan Progresif TV
            </p>
          </div>
        </div>
        <div className="ptv-nilai-header-actions">
          <button
            type="button"
            className="btn sm"
            onClick={() => navigate('/hub/inventaris')}
            style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 'var(--ptv-curve-md)', fontWeight: 700, padding: '6px 14px', color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="fa-solid fa-boxes-stacked" style={{ color: '#2563eb' }} />
            <span>Katalog Alat</span>
          </button>
        </div>
      </div>

      {/* ── 2. KPI Metric Bento Grid 1:1 Legacy ── */}
      <div className="ptv-nilai-kpi-grid">
        {/* Total Nilai */}
        <div className="ptv-nilai-kpi-card">
          <div className="ptv-nilai-kpi-card-hd">
            <span className="ptv-nilai-kpi-card-lbl">Total Nilai Aset</span>
            <span className="ptv-nilai-kpi-card-ic" style={{ background: '#ecfdf5', color: '#059669' }}>
              <i className="fa-solid fa-vault" />
            </span>
          </div>
          <div className="ptv-nilai-kpi-card-val" style={{ color: '#047857' }}>
            {formatRupiah(totalValuation)}
          </div>
          <div className="ptv-nilai-kpi-card-sub">
            Akumulasi {itemsWithValueCount} jenis alat bernilai ({totalRegisteredItems} ditampilkan)
          </div>
        </div>

        {/* Terdaftar vs Bernilai */}
        <div className="ptv-nilai-kpi-card">
          <div className="ptv-nilai-kpi-card-hd">
            <span className="ptv-nilai-kpi-card-lbl">Cakupan Valuasi</span>
            <span className="ptv-nilai-kpi-card-ic" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <i className="fa-solid fa-chart-pie" />
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span className="ptv-nilai-kpi-card-val" style={{ color: '#1e40af' }}>{coveragePercent}%</span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>({itemsWithValueCount}/{totalRegisteredItems})</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: 'var(--ptv-curve-pill)', overflow: 'hidden', marginTop: '8px' }}>
            <div style={{ width: `${coveragePercent}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #10b981)', borderRadius: 'var(--ptv-curve-pill)' }} />
          </div>
        </div>

        {/* Rata-rata Nilai */}
        <div className="ptv-nilai-kpi-card">
          <div className="ptv-nilai-kpi-card-hd">
            <span className="ptv-nilai-kpi-card-lbl">Rata-rata / Alat</span>
            <span className="ptv-nilai-kpi-card-ic" style={{ background: '#fdf4ff', color: '#a855f7' }}>
              <i className="fa-solid fa-calculator" />
            </span>
          </div>
          <div className="ptv-nilai-kpi-card-val" style={{ color: '#7e22ce' }}>
            {formatRupiah(avgValuation)}
          </div>
          <div className="ptv-nilai-kpi-card-sub">
            Rata-rata alat bernilai
          </div>
        </div>

        {/* Belum Dicatat */}
        <div className="ptv-nilai-kpi-card">
          <div className="ptv-nilai-kpi-card-hd">
            <span className="ptv-nilai-kpi-card-lbl">Belum Dicatat</span>
            <span className="ptv-nilai-kpi-card-ic" style={{ background: '#fffbeb', color: '#d97706' }}>
              <i className="fa-solid fa-file-circle-question" />
            </span>
          </div>
          <div className="ptv-nilai-kpi-card-val" style={{ color: '#b45309' }}>
            {unrecordedCount} <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Alat</span>
          </div>
          <div className="ptv-nilai-kpi-card-sub">
            Menunggu data perolehan
          </div>
        </div>
      </div>

      {/* ── 3. Filters & Search Toolbar 1:1 Legacy ── */}
      <div className="ptv-nilai-filter-bar">
        <div className="ptv-nilai-toolbar-grid">
          {/* Search Input */}
          <div className="ptv-nilai-search-wrap">
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '13px' }} />
            <input
              type="text"
              id="nilaiSearchInput"
              className="input"
              placeholder="Cari nama alat, kode, vendor, invoice, sumber..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              style={{ paddingLeft: '36px', paddingRight: searchQ ? '32px' : '14px' }}
            />
            {searchQ && (
              <button
                type="button"
                className="btn sm"
                id="nilaiSearchClearBtn"
                onClick={() => setSearchQ('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94a3b8', padding: '4px 8px', cursor: 'pointer' }}
                aria-label="Hapus pencarian"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="ptv-nilai-filter-grid">
            {/* Status */}
            <div>
              <PTVSelect
                id="nilaiFilterStatusSel"
                value={filterStatus}
                onChange={(val) => setFilterStatus(val)}
                options={[
                  { value: 'semua', label: 'Semua Status Nilai' },
                  { value: 'Aktif', label: 'Aktif' },
                  { value: 'Belum Dicatat', label: 'Belum Dicatat' },
                ]}
                ariaLabel="Semua Status Nilai"
              />
            </div>

            {/* Kategori */}
            <div>
              <PTVSelect
                id="nilaiFilterCatSel"
                value={filterCat}
                onChange={(val) => setFilterCat(val)}
                options={[
                  { value: 'semua', label: 'Semua Kategori' },
                  ...activeCats.map((c) => ({ value: c, label: c })),
                ]}
                ariaLabel="Semua Kategori"
              />
            </div>

            {/* Sumber Dana */}
            <div>
              <PTVSelect
                id="nilaiFilterSourceSel"
                value={filterSource}
                onChange={(val) => setFilterSource(val)}
                options={[
                  { value: 'semua', label: 'Semua Sumber Dana' },
                  ...availableSources.map((s) => ({ value: s, label: s })),
                ]}
                ariaLabel="Semua Sumber Dana"
              />
            </div>

            {/* Urutkan */}
            <div>
              <PTVSelect
                id="nilaiSortBySel"
                value={sortBy}
                onChange={(val) => setSortBy(val as any)}
                options={[
                  { value: 'default', label: 'Urutan: Kategori & Nama' },
                  { value: 'val_desc', label: 'Nilai Tertinggi → Terendah' },
                  { value: 'val_asc', label: 'Nilai Terendah → Tertinggi' },
                  { value: 'date_desc', label: 'Tanggal Perolehan Terbaru' },
                  { value: 'name_asc', label: 'Nama Alat (A-Z)' },
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
              className="btn sm"
              onClick={resetFilters}
              style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 'var(--ptv-curve-sm)', padding: '3px 10px', fontWeight: 700, fontSize: '11.5px', cursor: 'pointer' }}
            >
              <i className="fa-solid fa-rotate-left" style={{ marginRight: '4px' }} /> Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* ── 4. Data List Cards 1:1 Legacy ── */}
      <div id="nilaiInventarisListWrap">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }} />
            Memuat data nilai inventaris...
          </div>
        ) : displayItems.length === 0 ? (
          <div style={{ background: 'var(--surface, #ffffff)', border: '1.5px solid var(--line, #e2e8f0)', borderRadius: 'var(--ptv-curve-xl)', padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ width: '52px', height: '52px', background: '#f1f5f9', color: '#94a3b8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '22px' }}>
              <i className="fa-solid fa-box-open" />
            </div>
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ink, #0f172a)', margin: '0 0 6px 0' }}>Tidak Ada Data Inventaris yang Cocok</h4>
            <p style={{ fontSize: '13px', color: 'var(--muted, #64748b)', margin: '0 0 16px 0' }}>Silakan sesuaikan kata kunci pencarian atau filter status nilai di atas.</p>
            <button type="button" className="btn sm pri" onClick={resetFilters} style={{ borderRadius: 'var(--ptv-curve-md)', padding: '6px 16px' }}>
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
                      <div className="ptv-nilai-thumb">
                        {x.foto_url ? (
                          <img
                            src={x.foto_url}
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
                            display: x.foto_url ? 'none' : 'flex',
                            width: '100%',
                            height: '100%',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#64748b',
                            fontSize: '22px',
                          }}
                        >
                          <i className={`fa-solid ${getCatIconClass(x.kategori)}`} />
                        </div>
                      </div>

                      {/* Text metadata */}
                      <div className="ptv-nilai-card-info">
                        <div className="ptv-nilai-badges">
                          <span className="ptv-nilai-badge-code">{x.kode}</span>
                          <span className="ptv-nilai-badge-cat">
                            <i className="fa-solid fa-layer-group" style={{ fontSize: '10px', marginRight: '3px' }} />
                            {x.kategori}
                          </span>
                          <span className="ptv-nilai-badge-loc">
                            <i className="fa-solid fa-location-dot" style={{ fontSize: '9.5px', marginRight: '3px', color: '#ef4444' }} />
                            {locName}
                          </span>
                        </div>

                        <h3
                          className="ptv-nilai-card-name"
                          onClick={() => navigate(`/hub/inventaris/nilai/${x.id}`)}
                          style={{ cursor: 'pointer' }}
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
                        {hasVal ? (
                          <span style={{ fontSize: '10.5px', fontWeight: 750, padding: '1px 6px', borderRadius: 'var(--ptv-curve-xs)', background: '#ecfdf5', color: '#059669' }}>
                            {statusAset}
                          </span>
                        ) : (
                          <span style={{ fontSize: '10.5px', fontWeight: 750, padding: '1px 6px', borderRadius: 'var(--ptv-curve-xs)', background: '#fef3c7', color: '#b45309' }}>
                            Belum Dicatat
                          </span>
                        )}
                      </div>

                      <div className="ptv-nilai-dossier-val">{hasVal && v ? formatRupiah(v.nilai_perolehan) : 'Rp —'}</div>

                      {hasVal && v && totalUnits > 1 && (
                        <div style={{ fontSize: '11px', fontWeight: 650, color: '#64748b', marginTop: '2px' }}>
                          @ {formatRupiah(Math.round(v.nilai_perolehan / totalUnits))} &times; {totalUnits} Unit
                        </div>
                      )}

                      <div className="ptv-nilai-dossier-meta-grid">
                        <span style={{ color: '#94a3b8' }}>
                          <i className="fa-regular fa-calendar" style={{ fontSize: '10px', marginRight: '3px' }} />
                          Tanggal:
                        </span>
                        <span style={{ fontWeight: 600 }}>{tglPerolehan}</span>

                        <span style={{ color: '#94a3b8' }}>
                          <i className="fa-solid fa-hand-holding-dollar" style={{ fontSize: '10px', marginRight: '3px' }} />
                          Sumber:
                        </span>
                        <span style={{ fontWeight: 600 }}>{sourceName}</span>

                        {vendorName !== '—' && (
                          <>
                            <span style={{ color: '#94a3b8' }}>
                              <i className="fa-solid fa-store" style={{ fontSize: '10px', marginRight: '3px' }} />
                              Vendor:
                            </span>
                            <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={vendorName}>
                              {vendorName}
                            </span>
                          </>
                        )}

                        {noInvoice !== '—' && (
                          <>
                            <span style={{ color: '#94a3b8' }}>
                              <i className="fa-solid fa-receipt" style={{ fontSize: '10px', marginRight: '3px' }} />
                              Invoice:
                            </span>
                            <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={noInvoice}>
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
                        className="btn sm ptv-nilai-btn-detail"
                        onClick={() => navigate(`/hub/inventaris/nilai/${x.id}`)}
                        style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 'var(--ptv-curve-md)', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <i className="fa-solid fa-eye" style={{ color: '#2563eb' }} />
                        <span>Detail</span>
                      </button>

                      {canManage && (
                        <button
                          type="button"
                          className="btn sm pri ptv-nilai-btn-edit"
                          onClick={() => handleOpenEdit(x)}
                          style={{
                            borderRadius: 'var(--ptv-curve-md)',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: hasVal ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'linear-gradient(135deg, #059669, #10b981)',
                          }}
                        >
                          <i className={`fa-solid ${hasVal ? 'fa-pen-to-square' : 'fa-plus'}`} />
                          <span>{hasVal ? 'Ubah' : 'Catat Nilai'}</span>
                        </button>
                      )}

                      {canDelete && hasVal && (
                        <button
                          type="button"
                          className="btn sm ptv-nilai-btn-del"
                          onClick={() => handleDeleteNilai(x.id, x.nama_alat)}
                          style={{ background: '#fff', border: '1px solid #fee2e2', color: '#dc2626', borderRadius: 'var(--ptv-curve-md)', fontWeight: 700, fontSize: '11px' }}
                          title="Hapus catatan nilai finansial saja (alat fisik tetap ada)"
                        >
                          <i className="fa-regular fa-trash-can" />
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
      {editingItem && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: 'var(--surface, #ffffff)',
              borderRadius: 'var(--ptv-curve-2xl)',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line-2, #f1f5f9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--ink, #0f172a)' }}>
                  {editingItem.nilai_inventaris ? 'Ubah Catatan Nilai' : 'Catat Nilai Inventaris'}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--muted, #64748b)' }}>
                  {editingItem.kode} &bull; {editingItem.nama_alat}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted, #94a3b8)', fontSize: '16px' }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveEdit} style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink, #334155)', display: 'block', marginBottom: '4px' }}>
                  Total Nilai Perolehan (Rp) *
                </label>
                <input
                  type="number"
                  className="input"
                  required
                  placeholder="Contoh: 58000000"
                  value={editForm.nilai_perolehan}
                  onChange={(e) => setEditForm({ ...editForm, nilai_perolehan: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: '2px', display: 'block' }}>
                  Format Rupiah: {editForm.nilai_perolehan ? formatRupiah(editForm.nilai_perolehan) : 'Rp 0'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink, #334155)', display: 'block', marginBottom: '4px' }}>
                    Tanggal Perolehan *
                  </label>
                  <input
                    type="date"
                    className="input"
                    required
                    value={editForm.tanggal_perolehan}
                    onChange={(e) => setEditForm({ ...editForm, tanggal_perolehan: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink, #334155)', display: 'block', marginBottom: '4px' }}>
                    Sumber Dana *
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink, #334155)', display: 'block', marginBottom: '4px' }}>
                    Vendor / Toko
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Contoh: JPC Kemang"
                    value={editForm.vendor}
                    onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink, #334155)', display: 'block', marginBottom: '4px' }}>
                    Nomor Invoice
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Contoh: INV/2024/001"
                    value={editForm.nomor_invoice}
                    onChange={(e) => setEditForm({ ...editForm, nomor_invoice: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink, #334155)', display: 'block', marginBottom: '4px' }}>
                  Catatan Administratif
                </label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Catatan kondisi atau keperluan pembelian..."
                  value={editForm.catatan}
                  onChange={(e) => setEditForm({ ...editForm, catatan: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', height: 'auto', padding: '8px' }}
                />
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setEditingItem(null)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: 'var(--ptv-curve-md)', padding: '8px 16px', fontWeight: 700 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn sm pri"
                  style={{ borderRadius: 'var(--ptv-curve-md)', padding: '8px 20px', fontWeight: 700 }}
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Catatan Nilai'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
