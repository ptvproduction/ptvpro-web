/**
 * PTV PRO — Modul Acara
 * Modal Kelola Peralatan yang Digunakan pada Acara
 * Sinkronisasi penuh dengan Inventaris Asli Supabase Staging.
 * Mendukung foto inventaris nyata, status ketersediaan unit fisik,
 * stepper kuantitas real-time, dan barcode unit fisik.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AcaraItem, AcaraGearAllocation, AcaraGearUnit } from '../types';
import { useAcara } from '../context/AcaraContext';
import { inventarisService } from '../../inventaris/inventarisService';
import { ItemInventaris } from '../../inventaris/types';
import { resolveInventoryPhotoUrl } from '../../inventaris/utils/inventoryPhotoUtils';
import { X, Search, Check, Camera, Minus, Plus, Barcode, Box, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface AcaraGearModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: AcaraItem;
}

interface StudioGearUnitDef {
  id: string;
  unit: number;
  code: string;
  nama_unit?: string;
  nomor_seri?: string;
  status_peminjaman: string;
  kondisi: string;
  isAvailable: boolean;
  statusLabel: string;
}

interface StudioGearDef {
  id: string;
  name: string;
  code: string;
  cat: string;
  total_unit: number;
  available_unit: number;
  brand?: string;
  photo?: string;
  units: StudioGearUnitDef[];
}

export const AcaraGearModal: React.FC<AcaraGearModalProps> = ({
  isOpen,
  onClose,
  event
}) => {
  const { updateEventGear } = useAcara();
  const [search, setSearch] = useState('');
  const [inventarisList, setInventarisList] = useState<ItemInventaris[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'acara-gear-modal',
  });

  // Map gear ID -> AcaraGearAllocation
  const [allocatedMap, setAllocatedMap] = useState<Map<string, AcaraGearAllocation>>(new Map());

  // Load canonical inventaris from Supabase
  const loadInventaris = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await inventarisService.getInventarisList();
      setInventarisList(data || []);
    } catch (err: unknown) {
      console.error('[AcaraGearModal] Gagal memuat daftar inventaris:', err);
      setLoadError((err as Error).message || 'Gagal memuat inventaris dari database.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadInventaris();
    }
  }, [isOpen, loadInventaris]);

  // Transform ItemInventaris to StudioGearDef with accurate unit availability
  const gearPool: StudioGearDef[] = useMemo(() => {
    const allocatedCodesForThisEvent = new Set<string>();
    (event?.gear || []).forEach((g) => {
      (g.units || []).forEach((u) => {
        if (u.code) allocatedCodesForThisEvent.add(u.code.toUpperCase());
        if (u.barcode) allocatedCodesForThisEvent.add(u.barcode.toUpperCase());
      });
    });

    return inventarisList.map((item) => {
      const units: StudioGearUnitDef[] = (item.units || []).map((u, idx) => {
        const isCurrentEventUnit = allocatedCodesForThisEvent.has(u.kode_unit.toUpperCase());
        const isLoanTersedia = u.status_peminjaman === 'tersedia';
        const isKondisiBagus = !u.kondisi || u.kondisi === 'bagus';
        const isAvailable = (isLoanTersedia && isKondisiBagus) || isCurrentEventUnit;

        let statusLabel = 'Tersedia';
        if (!isLoanTersedia) {
          statusLabel = u.status_peminjaman === 'dipinjam' ? 'Dipinjam' : u.status_peminjaman;
        } else if (!isKondisiBagus) {
          statusLabel = u.kondisi === 'rusak' ? 'Rusak' : u.kondisi === 'hilang' ? 'Hilang' : u.kondisi;
        } else if (isCurrentEventUnit) {
          statusLabel = 'Dialokasikan Acara Ini';
        }

        const match = u.kode_unit.match(/-U?(\d+)$/i);
        const unitNum = match ? parseInt(match[1], 10) : idx + 1;

        return {
          id: u.id,
          unit: unitNum,
          code: u.kode_unit,
          nama_unit: u.nama_unit,
          nomor_seri: u.nomor_seri,
          status_peminjaman: u.status_peminjaman,
          kondisi: u.kondisi,
          isAvailable,
          statusLabel
        };
      });

      const availableCount = units.length > 0
        ? units.filter((u) => u.isAvailable).length
        : (item.unit_tersedia ?? item.total_unit ?? 1);

      const totalCount = units.length > 0 ? units.length : (item.total_unit ?? 1);

      return {
        id: item.id,
        name: item.nama_alat,
        code: item.kode,
        cat: item.kategori,
        brand: item.brand,
        photo: item.foto_url,
        total_unit: Math.max(1, totalCount),
        available_unit: Math.max(0, availableCount),
        units
      };
    });
  }, [inventarisList, event?.gear]);

  // Inisialisasi gear terpilih saat modal dibuka
  useEffect(() => {
    if (isOpen && event) {
      const map = new Map<string, AcaraGearAllocation>();
      (event.gear || []).forEach((g) => {
        const matched = inventarisList.find(
          (p) => p.id === g.id || (g.item_id && p.id === g.item_id) || p.kode.toUpperCase() === (g.code || '').toUpperCase()
        );
        const resolvedId = matched ? matched.id : g.id;
        map.set(resolvedId, {
          id: resolvedId,
          item_id: matched?.id || g.item_id || g.id,
          name: g.name || matched?.nama_alat || 'Alat Studio',
          code: g.code || matched?.kode || 'INV',
          cat: g.cat || matched?.kategori || 'Alat',
          photo: g.photo || matched?.foto_url || '',
          qty: Math.max(1, g.qty || 1),
          units: Array.isArray(g.units) ? g.units : []
        });
      });
      setAllocatedMap(map);
    }
  }, [isOpen, event, inventarisList]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  const filteredGear = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return gearPool;
    return gearPool.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.code.toLowerCase().includes(q) ||
        g.cat.toLowerCase().includes(q) ||
        (g.brand && g.brand.toLowerCase().includes(q))
    );
  }, [search, gearPool]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleGear = (item: StudioGearDef) => {
    setAllocatedMap((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        const availableUnits = item.units.filter((u) => u.isAvailable);
        const targetUnit = availableUnits.length > 0 ? availableUnits[0] : item.units[0];
        const initialUnits: AcaraGearUnit[] = targetUnit
          ? [{ unit: targetUnit.unit, code: targetUnit.code, barcode: targetUnit.code }]
          : [];
        next.set(item.id, {
          id: item.id,
          item_id: item.id,
          name: item.name,
          code: item.code,
          cat: item.cat,
          photo: item.photo || '',
          qty: 1,
          units: initialUnits
        });
      }
      return next;
    });
  };

  const changeQty = (itemId: string, delta: number, maxQty: number) => {
    setAllocatedMap((prev) => {
      const next = new Map(prev);
      const cur = next.get(itemId);
      if (!cur) return prev;

      const newQty = Math.max(1, Math.min(maxQty, cur.qty + delta));
      const poolItem = gearPool.find((p) => p.id === itemId);

      // Sinkronisasi unit fisik
      let nextUnits = [...cur.units];
      if (poolItem && poolItem.units.length > 1) {
        if (newQty > nextUnits.length) {
          // Tambah unit fisik yang tersedia dan belum terpilih
          const unselected = poolItem.units.filter(
            (u) => u.isAvailable && !nextUnits.some((nu) => nu.unit === u.unit || nu.code === u.code)
          );
          const toAdd = unselected.slice(0, newQty - nextUnits.length);
          nextUnits.push(...toAdd.map((u) => ({ unit: u.unit, code: u.code, barcode: u.code })));
        } else if (newQty < nextUnits.length) {
          nextUnits = nextUnits.slice(0, newQty);
        }
      }

      next.set(itemId, { ...cur, qty: newQty, units: nextUnits });
      return next;
    });
  };

  const toggleUnitSelection = (itemId: string, unitDef: StudioGearUnitDef, maxUnits: number) => {
    if (!unitDef.isAvailable && !allocatedMap.get(itemId)?.units.some((u) => u.code === unitDef.code)) {
      return;
    }

    setAllocatedMap((prev) => {
      const next = new Map(prev);
      const cur = next.get(itemId);
      if (!cur) return prev;

      let nextUnits = [...cur.units];
      const exists = nextUnits.some((u) => u.unit === unitDef.unit || u.code === unitDef.code);

      if (exists) {
        // Jangan hapus jika hanya tersisa 1 unit
        if (nextUnits.length > 1) {
          nextUnits = nextUnits.filter((u) => u.unit !== unitDef.unit && u.code !== unitDef.code);
        }
      } else {
        if (nextUnits.length < maxUnits) {
          nextUnits.push({ unit: unitDef.unit, code: unitDef.code, barcode: unitDef.code });
        }
      }

      next.set(itemId, { ...cur, qty: nextUnits.length, units: nextUnits });
      return next;
    });
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const gearArray = Array.from(allocatedMap.values());
      const ok = await updateEventGear(event.id, gearArray);
      if (ok) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAllocatedCount = Array.from(allocatedMap.values()).reduce((sum, g) => sum + g.qty, 0);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="acara-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="acara-gear-modal-title"
    >
      <div ref={modalRef} className="acara-modal-sheet" style={{ maxWidth: '720px' }}>
        <div className="acara-modal-header">
          <div>
            <h3 className="acara-modal-title" id="acara-gear-modal-title">
              Kelola Peralatan yang Digunakan
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted, #64748b)' }}>
              {allocatedMap.size} jenis alat ({totalAllocatedCount} unit) dialokasikan untuk {event.name}
            </p>
          </div>
          <button type="button" className="acara-modal-close-btn" onClick={onClose} aria-label="Tutup modal">
            <X size={18} />
          </button>
        </div>

        <div className="acara-modal-body">
          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 14px',
              background: 'var(--surface-2, #f8fafc)',
              borderRadius: 'var(--r-lg, 12px)',
              border: '1.5px solid var(--line, #e2e8f0)'
            }}
          >
            <Search size={16} style={{ color: 'var(--muted, #94a3b8)', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Cari kode alat (INV-xxx), nama alat, kategori, atau brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                width: '100%',
                color: 'var(--ink, #0f172a)'
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', color: 'var(--muted, #94a3b8)', cursor: 'pointer', padding: 0 }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Loading & Error Indicators */}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px 16px', color: 'var(--muted)' }}>
              <Loader2 size={18} className="animate-spin" />
              <span style={{ fontSize: '13px' }}>Memuat katalog inventaris resmi...</span>
            </div>
          )}

          {loadError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'var(--dang-bg, #fef2f2)',
                border: '1px solid var(--dang-border, #fca5a5)',
                borderRadius: 'var(--r-md, 8px)',
                color: 'var(--dang, #dc2626)',
                fontSize: '12.5px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{loadError}</span>
              </div>
              <button
                type="button"
                onClick={loadInventaris}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                <RefreshCw size={12} /> Coba lagi
              </button>
            </div>
          )}

          {/* List Peralatan Canonical */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {!isLoading && filteredGear.map((item) => {
              const isChecked = allocatedMap.has(item.id);
              const allocation = allocatedMap.get(item.id);
              const curQty = allocation?.qty || 1;
              const selectedUnits = allocation?.units || [];
              const maxUnits = item.available_unit > 0 ? item.available_unit : item.total_unit;
              const isZeroAvailable = item.available_unit === 0 && !isChecked;

              let availColor = 'var(--ok, #16a34a)';
              let availText = `${item.available_unit} / ${item.total_unit} unit tersedia`;
              if (item.available_unit === 0) {
                availColor = 'var(--dang, #dc2626)';
                availText = `0 / ${item.total_unit} unit tersedia (habis/dipinjam/rusak)`;
              } else if (item.available_unit < item.total_unit) {
                availColor = 'var(--warn, #d97706)';
              }

              const resolvedPhoto = resolveInventoryPhotoUrl(item.photo);

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    padding: '14px 16px',
                    borderRadius: 'var(--r-xl, 16px)',
                    border: isChecked ? '1.5px solid var(--b-600, #2563eb)' : '1.5px solid var(--line, #e2e8f0)',
                    background: isChecked ? 'rgba(37, 99, 235, 0.12)' : 'var(--surface-2, #ffffff)',
                    boxShadow: isChecked ? '0 4px 14px rgba(37, 99, 235, 0.08)' : '0 1px 3px rgba(0, 0, 0, 0.02)',
                    transition: 'all 0.15s ease',
                    opacity: isZeroAvailable ? 0.7 : 1
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    {/* Thumbnail Foto Canonical */}
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: 'var(--r-lg, 12px)',
                        background: 'var(--surface-sunken, #f8fafc)',
                        border: isChecked ? '1px solid var(--b-400, #bfdbfe)' : '1px solid var(--line, #e2e8f0)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--muted, #94a3b8)',
                        flexShrink: 0,
                        overflow: 'hidden'
                      }}
                    >
                      {resolvedPhoto ? (
                        <img
                          src={resolvedPhoto}
                          alt={item.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Camera size={22} />
                      )}
                    </div>

                    {/* Metadata Alat */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 750,
                            padding: '1px 7px',
                            borderRadius: 'var(--r-md, 6px)',
                            background: 'var(--surface)',
                            color: 'var(--b-400, #1d4ed8)',
                            border: '1px solid var(--line, #bfdbfe)'
                          }}
                        >
                          {item.code}
                        </span>
                        <span style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)', fontWeight: 600 }}>
                          {item.cat} {item.brand ? `• ${item.brand}` : ''}
                        </span>
                        {isChecked && (
                          <span
                            style={{
                              background: 'rgba(37, 99, 235, 0.2)',
                              color: 'var(--b-400, #1e40af)',
                              fontSize: '10px',
                              fontWeight: 750,
                              padding: '1px 7px',
                              borderRadius: 'var(--r-full, 9999px)'
                            }}
                          >
                            ✓ Terpilih
                          </span>
                        )}
                      </div>

                      <div style={{ fontWeight: 750, fontSize: '14px', color: 'var(--ink, #0f172a)', lineHeight: 1.35 }}>
                        {item.name}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11.5px', fontWeight: 600 }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: 'var(--r-full, 9999px)', background: availColor, display: 'inline-block' }} />
                        <span style={{ color: availColor }}>{availText}</span>
                      </div>
                    </div>

                    {/* Checkbox & Stepper Control */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: isZeroAvailable ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: isChecked ? '#ffffff' : isZeroAvailable ? 'var(--muted)' : 'var(--ink, #475569)',
                          padding: '5px 10px',
                          borderRadius: 'var(--r-md, 8px)',
                          background: isChecked ? 'var(--b-600, #2563eb)' : 'var(--surface)',
                          border: '1px solid var(--line, #e2e8f0)',
                          opacity: isZeroAvailable ? 0.6 : 1
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isZeroAvailable}
                          onChange={() => toggleGear(item)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--b-600, #2563eb)', cursor: isZeroAvailable ? 'not-allowed' : 'pointer' }}
                        />
                        <span>{isChecked ? 'Digunakan' : 'Gunakan'}</span>
                      </label>

                      {isChecked && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'var(--surface, #ffffff)',
                              padding: '2px 4px',
                              borderRadius: 'var(--r-md, 8px)',
                              border: '1.5px solid var(--line, #93c5fd)'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => changeQty(item.id, -1, maxUnits)}
                              disabled={curQty <= 1}
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: 'var(--r-sm, 6px)',
                                border: 'none',
                                background: 'var(--surface-2, #f1f5f9)',
                                color: 'var(--ink, #0f172a)',
                                cursor: curQty <= 1 ? 'not-allowed' : 'pointer',
                                opacity: curQty <= 1 ? 0.4 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Minus size={12} />
                            </button>
                            <span style={{ fontSize: '13px', fontWeight: 800, minWidth: '24px', textAlign: 'center', color: 'var(--b-400, #1e40af)' }}>
                              {curQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => changeQty(item.id, 1, maxUnits)}
                              disabled={curQty >= maxUnits}
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: 'var(--r-sm, 6px)',
                                border: 'none',
                                background: 'var(--surface-2, #f1f5f9)',
                                color: 'var(--ink, #0f172a)',
                                cursor: curQty >= maxUnits ? 'not-allowed' : 'pointer',
                                opacity: curQty >= maxUnits ? 0.4 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <span style={{ fontSize: '10.5px', color: 'var(--muted, #1e40af)', fontWeight: 600 }}>
                            Maks: {maxUnits} unit
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Physical Units Selection Barcode Grid */}
                  {isChecked && item.units.length > 1 && (
                    <div style={{ marginTop: '4px', paddingTop: '10px', borderTop: '1px dashed var(--line, #bfdbfe)' }}>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 750,
                          color: 'var(--b-400, #1e40af)',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '4px'
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Barcode size={12} /> Unit Fisik Terpilih ({selectedUnits.length} dari {item.total_unit} unit):
                        </span>
                        <span style={{ fontSize: '10.5px', color: 'var(--b-400, #2563eb)', fontWeight: 600 }}>
                          Sinkron otomatis dengan kuantitas
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
                        {item.units.map((u) => {
                          const isUnitSelected = selectedUnits.some((su) => su.unit === u.unit || su.code === u.code);
                          const isAvailable = u.isAvailable;
                          return (
                            <button
                              key={u.id || u.unit}
                              type="button"
                              onClick={() => toggleUnitSelection(item.id, u, maxUnits)}
                              disabled={!isAvailable && !isUnitSelected}
                              title={!isAvailable ? `Unit ${u.code} tidak tersedia: ${u.statusLabel}` : `Pilih unit ${u.code}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 10px',
                                borderRadius: 'var(--r-md, 8px)',
                                border: isUnitSelected
                                  ? '1.5px solid var(--b-600, #2563eb)'
                                  : isAvailable
                                  ? '1.5px solid var(--line, #cbd5e1)'
                                  : '1.5px dashed var(--dang-border, #fca5a5)',
                                background: isUnitSelected
                                  ? 'rgba(37, 99, 235, 0.18)'
                                  : isAvailable
                                  ? 'var(--surface)'
                                  : 'var(--dang-bg, #fef2f2)',
                                color: isUnitSelected
                                  ? 'var(--b-400, #1d4ed8)'
                                  : isAvailable
                                  ? 'var(--ink, #334155)'
                                  : 'var(--dang, #b91c1c)',
                                cursor: isAvailable || isUnitSelected ? 'pointer' : 'not-allowed',
                                opacity: isAvailable || isUnitSelected ? 1 : 0.65,
                                textAlign: 'left',
                                fontSize: '12px',
                                fontWeight: isUnitSelected ? 750 : 600,
                                transition: 'all 0.1s ease'
                              }}
                            >
                              <Box size={14} style={{ color: isUnitSelected ? 'var(--b-600, #2563eb)' : isAvailable ? 'var(--muted, #94a3b8)' : 'var(--dang, #ef4444)', flexShrink: 0 }} />
                              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                Unit #{u.unit} ({u.code})
                                {u.nama_unit && <span style={{ opacity: 0.8, fontSize: '11px', display: 'block' }}>{u.nama_unit}</span>}
                                {!isAvailable && !isUnitSelected && <span style={{ fontSize: '10px', color: 'var(--dang)', display: 'block' }}>({u.statusLabel})</span>}
                              </span>
                              {isUnitSelected && <Check size={14} style={{ color: 'var(--b-600, #2563eb)', flexShrink: 0 }} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {!isLoading && filteredGear.length === 0 && (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted, #64748b)', fontSize: '13px' }}>
                Tidak ada peralatan yang sesuai dengan kata kunci &quot;{search}&quot;.
              </div>
            )}
          </div>
        </div>

        <div className="acara-modal-footer">
          <button type="button" className="acara-btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </button>
          <button type="button" className="acara-btn-primary" onClick={handleSave} disabled={isSubmitting}>
            <Check size={16} />
            {isSubmitting ? 'Menyimpan...' : `Simpan Alokasi Peralatan (${totalAllocatedCount} unit)`}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
