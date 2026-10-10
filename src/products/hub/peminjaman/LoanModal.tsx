import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { useSessionStore } from '@core/session';
import { inventarisService } from '../inventaris/inventarisService';
import { peminjamanService } from './peminjamanService';
import { ItemInventaris } from '../inventaris/types';
import { loanBasketStore, LoanBasketItem } from '../inventaris/loanBasketStore';

interface LoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetAssetId?: string;
  presetUnit?: number;
  onSuccess?: () => void;
}

const CATEGORY_ORDER = [
  'Kamera',
  'Lensa',
  'Tripod & Rig',
  'Tripod',
  'Baterai & Power',
  'Audio',
  'Lighting',
  'Smartphone / Tablet',
  'Komputer / Laptop',
  'Kabel & Adapter',
  'Streaming / Live',
  'Lainnya',
];

const PURPOSE_CHIPS = [
  'Dokumentasi',
  'Latihan shooting',
  'Konten PTV',
  'Kegiatan asrama',
  'Persiapan acara',
];

export const LoanModal: React.FC<LoanModalProps> = ({
  isOpen,
  onClose,
  presetAssetId,
  presetUnit,
  onSuccess,
}) => {
  const { user } = useSessionStore();

  const [items, setItems] = useState<ItemInventaris[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCat, setActiveCat] = useState('Semua');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Form Fields
  const [borrowerName, setBorrowerName] = useState(user?.full_name || '');
  const [purpose, setPurpose] = useState('');
  const [outDate, setOutDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [eventRelated, setEventRelated] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Sync loanBasket
  const basketItems = useSyncExternalStore(
    (cb) => loanBasketStore.subscribe(cb),
    () => loanBasketStore.getItems()
  );
  const basketCount = basketItems.length;

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const fetchCatalog = async () => {
      setLoading(true);
      try {
        const data = await inventarisService.getInventarisList();
        if (!mounted) return;
        setItems(data);

        // Auto-expand and add preset if passed
        if (presetAssetId) {
          const target = data.find((i) => i.id === presetAssetId || i.kode === presetAssetId);
          if (target) {
            setExpandedCategories((prev) => new Set([...prev, target.kategori]));
            setExpandedAssets((prev) => new Set([...prev, target.id]));

            if (presetUnit !== undefined) {
              const uObj = target.units.find((u, idx) => {
                const uNum = parseInt(u.kode_unit.split('-U')[1] || `${idx + 1}`, 10);
                return uNum === presetUnit;
              }) || target.units[presetUnit - 1];

              if (uObj && uObj.status_peminjaman === 'tersedia') {
                const uKey = `${target.id}_${presetUnit}`;
                loanBasketStore.toggle({
                  key: uKey,
                  assetId: target.id,
                  unitId: uObj.id,
                  unitNo: presetUnit,
                  unitCode: uObj.kode_unit,
                  unitName: `Unit ${presetUnit.toString().padStart(2, '0')} (${uObj.kode_unit})`,
                  assetName: target.nama_alat,
                  invCode: target.kode,
                });
              }
            }
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchCatalog();
    return () => {
      mounted = false;
    };
  }, [isOpen, presetAssetId, presetUnit]);

  // If user changed
  useEffect(() => {
    if (user?.full_name && !borrowerName) {
      setBorrowerName(user.full_name);
    }
  }, [user, borrowerName]);

  if (!isOpen) return null;

  // Build sorted categories
  const dbCats = Array.from(new Set(items.map((x) => x.kategori).filter(Boolean)));
  dbCats.sort((a, b) => {
    const idxA = CATEGORY_ORDER.indexOf(a);
    const idxB = CATEGORY_ORDER.indexOf(b);
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
  });
  const catList = ['Semua', ...dbCats];

  // Group items by category
  const catMap = new Map<string, ItemInventaris[]>();
  items.forEach((x) => {
    if (!catMap.has(x.kategori)) catMap.set(x.kategori, []);
    catMap.get(x.kategori)!.push(x);
  });

  // Filter categories and search items
  const q = searchQuery.toLowerCase().trim();
  let resultCategories: [string, ItemInventaris[]][] = [];

  if (activeCat !== 'Semua') {
    if (catMap.has(activeCat)) {
      resultCategories = [[activeCat, catMap.get(activeCat)!]];
    }
  } else {
    resultCategories = Array.from(catMap.entries());
    resultCategories.sort((a, b) => {
      const idxA = CATEGORY_ORDER.indexOf(a[0]);
      const idxB = CATEGORY_ORDER.indexOf(b[0]);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });
  }

  if (q) {
    const filtered: [string, ItemInventaris[]][] = [];
    resultCategories.forEach(([catName, catItems]) => {
      const matchingItems = catItems.filter((x) => {
        const nameMatch = (x.nama_alat || '').toLowerCase().includes(q);
        const codeMatch = (x.kode || '').toLowerCase().includes(q);
        const specMatch = (x.spesifikasi || '').toLowerCase().includes(q);
        const locMatch = x.units.some((u) => (u.lokasi_penyimpanan || '').toLowerCase().includes(q));
        const unitMatch = x.units.some(
          (u, idx) =>
            u.kode_unit.toLowerCase().includes(q) ||
            `unit ${idx + 1}`.toLowerCase().includes(q)
        );
        return nameMatch || codeMatch || specMatch || locMatch || unitMatch;
      });

      if (matchingItems.length > 0) {
        filtered.push([catName, matchingItems]);
      }
    });
    resultCategories = filtered;
  }

  const toggleCategory = (catName: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catName)) next.delete(catName);
      else next.add(catName);
      return next;
    });
  };

  const toggleAsset = (assetId: string) => {
    setExpandedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const handleUnitToggle = (asset: ItemInventaris, unitNo: number, unitId: string, unitCode: string) => {
    const uKey = `${asset.id}_${unitNo}`;
    loanBasketStore.toggle({
      key: uKey,
      assetId: asset.id,
      unitId: unitId,
      unitNo: unitNo,
      unitCode: unitCode,
      unitName: `Unit ${unitNo.toString().padStart(2, '0')} (${unitCode})`,
      assetName: asset.nama_alat,
      invCode: asset.kode,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (basketCount === 0) {
      alert('Pilih minimal satu unit fisik terlebih dahulu.');
      return;
    }
    if (!purpose.trim()) {
      alert('Keperluan peminjaman wajib diisi.');
      return;
    }

    try {
      setSubmitting(true);
      const unitIds = basketItems.map((b) => b.unitId);
      await peminjamanService.checkoutLoan(
        {
          borrower_name: borrowerName.trim() || user?.full_name || 'Kru PTV',
          purpose: purpose.trim(),
          due_date: dueDate,
          unit_ids: unitIds,
        },
        user?.ptv_id,
        user?.full_name
      );

      loanBasketStore.clear();
      setMobileDrawerOpen(false);
      alert('Peminjaman multi-unit berhasil diajukan!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      alert((err as Error).message || 'Gagal mengajukan peminjaman.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCatIconClass = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes('kamera')) return 'fa-solid fa-camera-retro';
    if (lower.includes('lensa')) return 'fa-solid fa-circle-dot';
    if (lower.includes('audio') || lower.includes('mic')) return 'fa-solid fa-microphone';
    if (lower.includes('lighting') || lower.includes('lampu')) return 'fa-solid fa-lightbulb';
    if (lower.includes('tripod') || lower.includes('rig') || lower.includes('stabilizer')) return 'fa-solid fa-arrows-to-dot';
    if (lower.includes('baterai') || lower.includes('power')) return 'fa-solid fa-battery-three-quarters';
    if (lower.includes('smartphone') || lower.includes('tablet')) return 'fa-solid fa-mobile-screen-button';
    if (lower.includes('komputer') || lower.includes('laptop')) return 'fa-solid fa-laptop';
    if (lower.includes('kabel')) return 'fa-solid fa-plug';
    if (lower.includes('streaming') || lower.includes('live')) return 'fa-solid fa-tower-broadcast';
    return 'fa-solid fa-shapes';
  };

  // Group selected items by asset
  const groupedSelected = new Map<string, LoanBasketItem[]>();
  basketItems.forEach((b) => {
    if (!groupedSelected.has(b.assetId)) groupedSelected.set(b.assetId, []);
    groupedSelected.get(b.assetId)!.push(b);
  });

  const renderFormFields = () => (
    <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: '10px', marginTop: '6px' }}>
      <div className="field" style={{ marginBottom: '9px' }}>
        <label style={{ fontWeight: 600, fontSize: '12px', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          Keperluan Peminjaman <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          className="input"
          id="f_purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Contoh: Dokumentasi Syamail 2026, Konten PTV..."
          required
          style={{ fontSize: '12.5px', padding: '6px 10px', minHeight: '36px', width: '100%' }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '5px' }}>
          {PURPOSE_CHIPS.map((p) => (
            <button
              key={p}
              type="button"
              className="fchip"
              onClick={() => setPurpose(p)}
              style={{ fontSize: '10.5px', padding: '2px 7px', fontWeight: 500 }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-2" style={{ gap: '8px', marginBottom: '9px' }}>
        <div className="field">
          <label style={{ fontWeight: 600, fontSize: '11.5px', color: 'var(--ink-2)' }}>Tanggal Ambil</label>
          <input
            className="input"
            type="date"
            value={outDate}
            onChange={(e) => setOutDate(e.target.value)}
            style={{ fontSize: '12.5px', padding: '6px 10px', minHeight: '36px', width: '100%' }}
          />
        </div>
        <div className="field">
          <label style={{ fontWeight: 600, fontSize: '11.5px', color: 'var(--ink-2)' }}>Rencana Kembali</label>
          <input
            className="input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ fontSize: '12.5px', padding: '6px 10px', minHeight: '36px', width: '100%' }}
          />
        </div>
      </div>

      <div className="field" style={{ marginBottom: '9px' }}>
        <label style={{ fontWeight: 600, fontSize: '11.5px', color: 'var(--ink-2)' }}>Terkait Acara (Opsional)</label>
        <input
          className="input"
          value={eventRelated}
          onChange={(e) => setEventRelated(e.target.value)}
          placeholder="Nama acara liputan..."
          style={{ fontSize: '12px', padding: '5px 9px', minHeight: '34px', width: '100%' }}
        />
      </div>

      <div className="field" style={{ marginBottom: '12px' }}>
        <label style={{ fontWeight: 600, fontSize: '11.5px', color: 'var(--ink-2)' }}>Catatan Tambahan (Opsional)</label>
        <input
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan kondisi, kelengkapan, dll..."
          style={{ fontSize: '12px', padding: '5px 9px', minHeight: '34px', width: '100%' }}
        />
      </div>

      <button
        type="button"
        className="btn block pri"
        onClick={handleSubmit}
        disabled={basketCount === 0 || submitting}
        style={{
          fontWeight: 600,
          fontSize: '13px',
          padding: '10px 14px',
          minHeight: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '7px',
          borderRadius: 'var(--ptv-curve-md)',
          boxShadow: 'var(--shadow-s)',
          width: '100%',
        }}
      >
        <i className="fa-solid fa-paper-plane" style={{ fontSize: '12px' }} />
        <span>{submitting ? 'Memproses...' : basketCount > 0 ? `Ajukan Peminjaman (${basketCount} Unit)` : 'Ajukan Peminjaman'}</span>
      </button>
    </div>
  );

  const renderSelectedPanel = () => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--b-700)' }}>
          <i className="fa-solid fa-clipboard-check" style={{ marginRight: '5px' }} />
          Alat yang Dipilih
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {basketCount > 0 && (
            <button
              type="button"
              className="btn-clear-basket"
              onClick={() => loanBasketStore.clear()}
              style={{
                fontSize: '10.5px',
                color: '#ef4444',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
              title="Kosongkan Semua Pilihan"
            >
              <i className="fa-solid fa-trash-can" style={{ fontSize: '10px' }} />
              Kosongkan
            </button>
          )}
          <span className="chip blue" style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px' }}>
            {basketCount} Unit Dipilih
          </span>
        </div>
      </div>

      {basketCount === 0 ? (
        <div style={{ padding: '20px 14px', textAlign: 'center', border: '1.5px dashed var(--line-2)', borderRadius: 'var(--ptv-curve-lg)', background: 'var(--bg-2)' }}>
          <i className="fa-solid fa-boxes-stacked" style={{ fontSize: '22px', color: 'var(--muted)', opacity: 0.5, display: 'block', marginBottom: '6px' }} />
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)' }}>Belum ada unit dipilih</div>
          <div className="t-xs muted" style={{ marginTop: '2px' }}>Buka kategori dan centang unit fisik di sebelah kiri.</div>
        </div>
      ) : (
        <div className="selected-items-scroll">
          {Array.from(groupedSelected.entries()).map(([assetId, uList]) => (
            <div className="selected-asset-block" key={assetId}>
              <div className="selected-asset-head">
                <i className="fa-solid fa-box" style={{ fontSize: '10.5px', color: 'var(--b-500)', marginRight: '4px' }} />
                <span>{uList[0].assetName}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '12px', borderLeft: '2px solid var(--b-200)', marginLeft: '2px' }}>
                {uList.map((u) => (
                  <div className="selected-unit-tag" key={u.key}>
                    <span style={{ color: 'var(--b-600)', fontSize: '13px', lineHeight: 1 }}>&bull;</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span>{u.unitName}</span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'monospace', marginLeft: '3px' }}>
                        ({u.unitCode})
                      </span>
                    </span>
                    <button
                      type="button"
                      className="btn-remove-unit"
                      onClick={() => loanBasketStore.remove(u.key)}
                      title="Hapus unit"
                      aria-label="Hapus unit"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {renderFormFields()}
    </>
  );

  return (
    <>
      <div className="scrim on" onClick={onClose} />
      <section
        className="sheet on loan-picker-sheet-modal"
        role="dialog"
        aria-modal="true"
        style={{
          maxWidth: '1060px',
          width: '95%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div className="sheet-grab" />
        <div className="sheet-hd" style={{ padding: '12px 18px', borderBottom: '1px solid var(--line-2)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-boxes-stacked" style={{ color: 'var(--b-600)' }} />
            <span>Peminjaman Alat & Pemilihan Unit Fisik</span>
          </h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="sheet-body" style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
          <div className="loan-picker-modal-root" id="loanPickerModalRoot">
            <div className="loan-picker-container">
              {/* LEFT COLUMN: Inventory Picker & Hierarchical Accordions */}
              <div className="loan-picker-left">
                {/* Search Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="inv-search-wrap" style={{ flex: 1 }}>
                    <span className="search-icon">
                      <i className="fa-solid fa-magnifying-glass" />
                    </span>
                    <input
                      id="loanGearSearch"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari nama alat, kode (INV-xxx), unit (U01)..."
                      autoComplete="off"
                      style={{ fontSize: '12.5px' }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => alert('Scanner barcode kamera fisik aktif')}
                    style={{ padding: '4px 10px', minHeight: '36px', fontSize: '11.5px', fontWeight: 600, flexShrink: 0 }}
                  >
                    <i className="fa-solid fa-qrcode" style={{ marginRight: '4px' }} />
                    Scan
                  </button>
                </div>

                {/* Category Filter Chips Bar */}
                <div className="loan-cat-chips-bar" id="loanCatChipsWrap">
                  {catList.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`fchip ${activeCat === c ? 'on' : ''}`}
                      onClick={() => setActiveCat(c)}
                      style={{ fontSize: '11.5px', padding: '3px 10px', whiteSpace: 'nowrap', fontWeight: 600 }}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {/* Inventory Hierarchical Categories and Units */}
                <div className="loan-inventory-scroll" id="loanInventoryScrollWrap">
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }} />
                      Memuat katalog alat...
                    </div>
                  ) : resultCategories.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 15px', background: 'var(--surface)', borderRadius: 'var(--ptv-curve-lg)', border: '1px dashed var(--line-2)' }}>
                      <i className="fa-solid fa-box-open" style={{ fontSize: '26px', color: 'var(--muted)', opacity: 0.6, marginBottom: '8px', display: 'block' }} />
                      <p className="t-sm muted" style={{ margin: 0, fontWeight: 600 }}>Tidak ada inventaris yang cocok.</p>
                      <span className="t-xs muted">Coba kata kunci lain atau pilih filter kategori "Semua".</span>
                    </div>
                  ) : (
                    resultCategories.map(([catName, catItems]) => {
                      const isCatExp = expandedCategories.has(catName) || activeCat !== 'Semua' || !!q;
                      const catCount = catItems.length;

                      let totalCatAvail = 0;
                      let totalCatSelected = 0;
                      catItems.forEach((it) => {
                        totalCatAvail += it.unit_tersedia;
                        it.units.forEach((u, uIdx) => {
                          const uNum = parseInt(u.kode_unit.split('-U')[1] || `${uIdx + 1}`, 10);
                          if (loanBasketStore.has(`${it.id}_${uNum}`)) {
                            totalCatSelected++;
                          }
                        });
                      });
                      const hasCatSelected = totalCatSelected > 0;

                      return (
                        <div
                          className={`loan-cat-card ${isCatExp ? 'expanded' : ''} ${hasCatSelected ? 'has-selected' : ''}`}
                          key={catName}
                        >
                          {/* 1. Category Accordion Header */}
                          <div
                            className="loan-cat-head"
                            onClick={() => toggleCategory(catName)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') toggleCategory(catName);
                            }}
                          >
                            <i
                              className={`fa-solid ${isCatExp ? 'fa-chevron-down' : 'fa-chevron-right'}`}
                              style={{ fontSize: '12px', color: 'var(--ink-2)', width: '14px', flexShrink: 0, transition: 'transform .15s' }}
                            />
                            <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--b-600)', flexShrink: 0 }}>
                              <i className={getCatIconClass(catName)} />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span className="loan-cat-title-text">
                                {catName} <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted)' }}>({catCount})</span>
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: totalCatAvail > 0 ? 'var(--ok)' : 'var(--warn)' }}>
                                {totalCatAvail} tersedia
                              </span>
                              {hasCatSelected && (
                                <span className="chip blue" style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 7px', background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                                  <i className="fa-solid fa-check" style={{ marginRight: '3px', fontSize: '9.5px' }} />
                                  {totalCatSelected} dipilih
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 2. Category Body (List of Collapsible Asset Cards) */}
                          {isCatExp && (
                            <div className="loan-cat-body">
                              {catItems.map((x) => {
                                const isAssetExp = expandedAssets.has(x.id) || !!q;
                                const selectedThisAsset = x.units.filter((u, uIdx) => {
                                  const uNum = parseInt(u.kode_unit.split('-U')[1] || `${uIdx + 1}`, 10);
                                  return loanBasketStore.has(`${x.id}_${uNum}`);
                                });
                                const selectedCount = selectedThisAsset.length;
                                const hasSelected = selectedCount > 0;
                                const assetLoc = x.units[0]?.lokasi_penyimpanan || 'Studio PTV';

                                return (
                                  <div
                                    className={`loan-asset-card ${isAssetExp ? 'expanded' : ''} ${hasSelected ? 'has-selected' : ''}`}
                                    key={x.id}
                                  >
                                    {/* Asset Accordion Header */}
                                    <div
                                      className="loan-asset-head"
                                      onClick={() => toggleAsset(x.id)}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') toggleAsset(x.id);
                                      }}
                                    >
                                      <i
                                        className={`fa-solid ${isAssetExp ? 'fa-chevron-down' : 'fa-chevron-right'}`}
                                        style={{ fontSize: '11px', color: 'var(--ink-2)', width: '14px', flexShrink: 0, transition: 'transform .15s' }}
                                      />
                                      <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--b-600)', flexShrink: 0, fontSize: '14px' }}>
                                        <i className={getCatIconClass(x.kategori)} />
                                      </span>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25 }}>
                                            {x.nama_alat}
                                          </span>
                                          <span style={{ fontSize: '10.5px', color: 'var(--ink-2)', fontFamily: 'monospace', background: 'var(--bg-2)', padding: '1px 5px', borderRadius: 'var(--ptv-curve-xs)', border: '1px solid var(--line-2)' }}>
                                            {x.kode}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                          <span>{x.total_unit} Unit</span>
                                          <span>&bull;</span>
                                          <span style={{ fontWeight: 600, color: x.unit_tersedia > 0 ? 'var(--ok)' : 'var(--dang)' }}>
                                            {x.unit_tersedia} Tersedia
                                          </span>
                                          <span>&bull;</span>
                                          <span>{assetLoc}</span>
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                        {hasSelected && (
                                          <span className="chip blue" style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 7px', background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                                            <i className="fa-solid fa-check" style={{ marginRight: '3px', fontSize: '9.5px' }} />
                                            {selectedCount} Dipilih
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* 3. Physical Units Checklist */}
                                    {isAssetExp && (
                                      <div className="loan-units-container">
                                        {x.units.map((u, uIdx) => {
                                          const uNum = parseInt(u.kode_unit.split('-U')[1] || `${uIdx + 1}`, 10);
                                          const key = `${x.id}_${uNum}`;
                                          const isChecked = loanBasketStore.has(key);
                                          const isAvail = u.status_peminjaman === 'tersedia';
                                          const uName = `Unit ${uNum.toString().padStart(2, '0')}`;

                                          let chipStyle = 'background:#dcfce7;color:#166534;border:1px solid #bbf7d0';
                                          let chipIcon = <i className="fa-regular fa-circle-check" style={{ marginRight: '3px' }} />;
                                          let statusLabel = 'Tersedia';

                                          if (u.status_peminjaman === 'dipinjam') {
                                            chipStyle = 'background:#e0e7ff;color:#3730a3;border:1px solid #c7d2fe';
                                            chipIcon = <i className="fa-solid fa-user-clock" style={{ marginRight: '3px' }} />;
                                            statusLabel = 'Dipinjam';
                                          } else if (u.kondisi === 'rusak' || u.status_peminjaman === 'maintenance') {
                                            chipStyle = 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca';
                                            chipIcon = <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '3px' }} />;
                                            statusLabel = 'Rusak';
                                          }

                                          return (
                                            <label
                                              key={u.id}
                                              className={`loan-unit-item ${isChecked ? 'selected' : ''} ${!isAvail ? 'disabled' : ''}`}
                                              onClick={(e) => {
                                                if (!isAvail) {
                                                  e.preventDefault();
                                                  return;
                                                }
                                                handleUnitToggle(x, uNum, u.id, u.kode_unit);
                                              }}
                                            >
                                              <input
                                                type="checkbox"
                                                className="loan-unit-checkbox"
                                                checked={isChecked}
                                                disabled={!isAvail}
                                                readOnly
                                              />
                                              <div className="loan-unit-info">
                                                <span className="loan-unit-name">{uName}</span>
                                                <span className="loan-unit-code">{u.kode_unit}</span>
                                              </div>
                                              <span className="chip" style={{ fontSize: '10px', padding: '2px 7px', fontWeight: 600, marginLeft: 'auto', flexShrink: 0, ...Object.fromEntries(chipStyle.split(';').filter(Boolean).map(s => { const [k,v] = s.split(':'); return [k.trim().replace(/-([a-z])/g, g => g[1].toUpperCase()), v.trim()]; })) }}>
                                                {chipIcon}
                                                {statusLabel}
                                              </span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Desktop Selected Items & Form Panel */}
              <div className="loan-picker-right desktop-only-panel" id="loanSelectedPanelWrap">
                {renderSelectedPanel()}
              </div>
            </div>

            {/* MOBILE STICKY BOTTOM BAR */}
            <div
              className="loan-mobile-sticky-bar"
              id="loanMobileStickyBar"
              onClick={() => setMobileDrawerOpen(true)}
              role="button"
              tabIndex={0}
            >
              <span>
                <i className="fa-solid fa-boxes-stacked" style={{ marginRight: '7px' }} />
                <span>{basketCount} unit dipilih</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Lihat &amp; Ajukan <i className="fa-solid fa-arrow-right" style={{ fontSize: '11px' }} />
              </span>
            </div>

            {/* MOBILE FULL BOTTOM SHEET DRAWER */}
            <div className={`loan-mobile-drawer-overlay ${mobileDrawerOpen ? 'open' : ''}`} id="loanMobileDrawerOverlay">
              <div className="loan-mobile-drawer-content" id="loanMobileDrawerContent">
                <div className="loan-mobile-drawer-header">
                  <button
                    type="button"
                    className="loan-mobile-back-btn"
                    onClick={() => setMobileDrawerOpen(false)}
                    aria-label="Kembali ke Daftar Alat"
                  >
                    <i className="fa-solid fa-arrow-left" style={{ fontSize: '13.5px' }} />
                    <span>Pilih Alat</span>
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {basketCount > 0 && (
                      <button
                        type="button"
                        className="btn-clear-basket"
                        onClick={() => loanBasketStore.clear()}
                        style={{ fontSize: '10.5px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontWeight: 600 }}
                        title="Kosongkan Semua Pilihan"
                      >
                        <i className="fa-solid fa-trash-can" style={{ fontSize: '10px' }} />
                        Kosongkan
                      </button>
                    )}
                    <span className="chip blue" style={{ fontSize: '11.5px', fontWeight: 600, padding: '3px 9px' }}>
                      {basketCount} Unit Dipilih
                    </span>
                    <button
                      type="button"
                      className="loan-mobile-close-all-btn"
                      onClick={onClose}
                      aria-label="Tutup Peminjaman"
                    >
                      <i className="fa-solid fa-xmark" style={{ fontSize: '17px' }} />
                    </button>
                  </div>
                </div>
                <div className="loan-mobile-drawer-body">
                  {renderSelectedPanel()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
