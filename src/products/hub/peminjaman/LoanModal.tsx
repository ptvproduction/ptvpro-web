import React, { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useSessionStore } from '@core/session';
import { inventarisService, normalizeInventoryCategory } from '../inventaris/inventarisService';
import { peminjamanService } from './peminjamanService';
import { ItemInventaris, InventarisUnit } from '../inventaris/types';
import { loanBasketStore, LoanBasketItem } from '../inventaris/loanBasketStore';
import { PTVSelect, PTVSelectOption } from '@shared/components';
import { InventoryScanDialog } from '../inventaris/InventoryScanDialog';
import { acaraService } from '../acara/acaraService';
import { AcaraItem } from '../acara/types';
import { formatHumanDateIndo } from '../acara/utils/acaraDateUtils';
import { resolveInventoryPhotoUrl } from '../inventaris/utils/inventoryPhotoUtils';
import { notificationService } from '../shell/notificationService';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import '../../../styles/loanModal.css';

interface LoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetAssetId?: string;
  presetUnit?: number;
  onSuccess?: () => void | Promise<void>;
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
  const [scanOpen, setScanOpen] = useState(false);

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
  const [formError, setFormError] = useState('');
  const [conflictingUnits, setConflictingUnits] = useState<Map<string, string>>(new Map());

  // Real Acara Data State
  const [acaraList, setAcaraList] = useState<AcaraItem[]>([]);
  const [acaraLoading, setAcaraLoading] = useState(false);
  const [acaraError, setAcaraError] = useState<string | null>(null);

  const fetchAcara = useCallback(async () => {
    try {
      setAcaraLoading(true);
      setAcaraError(null);
      const events = await acaraService.getEvents();
      setAcaraList(events || []);
    } catch (err: unknown) {
      setAcaraError((err as Error).message || 'Gagal memuat daftar agenda acara.');
    } finally {
      setAcaraLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchAcara();
    }
  }, [isOpen, fetchAcara]);

  const eventOptions: PTVSelectOption[] = useMemo(() => {
    if (acaraLoading) {
      return [
        { value: '', label: 'Memuat agenda acara studio...', icon: 'fa-solid fa-spinner fa-spin', iconColor: 'var(--muted)', iconBg: 'var(--bg-2)' },
      ];
    }
    if (acaraError) {
      return [
        { value: '', label: `Gagal memuat acara — Klik untuk coba lagi`, icon: 'fa-solid fa-rotate-right', iconColor: '#dc2626', iconBg: '#fee2e2' },
      ];
    }

    const opts: PTVSelectOption[] = [
      { value: '', label: 'Tidak terkait acara', icon: 'fa-solid fa-circle-minus', iconColor: 'var(--muted)', iconBg: 'var(--bg-2)' },
    ];

    if (acaraList.length === 0) {
      opts.push({
        value: '__empty__',
        label: 'Belum ada agenda acara',
        icon: 'fa-solid fa-calendar-xmark',
        iconColor: 'var(--muted)',
        iconBg: 'var(--bg-2)',
      });
      return opts;
    }

    acaraList.forEach((ev) => {
      opts.push({
        value: ev.id,
        label: `${ev.name} (${formatHumanDateIndo(ev.date)})`,
        icon: 'fa-solid fa-calendar-day',
        iconColor: 'var(--b-600)',
        iconBg: 'var(--b-050)',
      });
    });

    return opts;
  }, [acaraList, acaraLoading, acaraError]);

  // Category Rail Drag & Arrow Navigation State
  const catRailRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const checkCatScroll = useCallback(() => {
    const rail = catRailRef.current;
    if (!rail) return;
    setCanScrollLeft(rail.scrollLeft > 6);
    setCanScrollRight(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 6);
  }, []);

  useEffect(() => {
    checkCatScroll();
    const rail = catRailRef.current;
    if (!rail) return;
    const handleScroll = () => checkCatScroll();
    rail.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      rail.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [checkCatScroll, items]);

  const scrollCatRail = (direction: 'left' | 'right') => {
    const rail = catRailRef.current;
    if (!rail) return;
    const offset = direction === 'left' ? -200 : 200;
    rail.scrollBy({ left: offset, behavior: 'smooth' });
    setTimeout(checkCatScroll, 250);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const rail = catRailRef.current;
    if (!rail) return;
    isMouseDownRef.current = true;
    startXRef.current = e.pageX - rail.offsetLeft;
    scrollLeftRef.current = rail.scrollLeft;
    hasDraggedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current) return;
    const rail = catRailRef.current;
    if (!rail) return;
    const x = e.pageX - rail.offsetLeft;
    const walk = x - startXRef.current;
    if (Math.abs(walk) > 5) {
      hasDraggedRef.current = true;
      rail.scrollLeft = scrollLeftRef.current - walk;
    }
  };

  const handleMouseUpOrLeave = () => {
    isMouseDownRef.current = false;
  };

  const modalRef = useRef<HTMLDivElement>(null);

  // Centralized Modal Lifecycle & Background Scroll Lock
  useModalScrollLock({
    isOpen,
    onClose: () => {
      if (scanOpen) {
        setScanOpen(false);
      } else if (mobileDrawerOpen) {
        setMobileDrawerOpen(false);
      } else {
        onClose();
      }
    },
    modalRef,
    id: 'ptv-loan-modal',
  });

  // Sync loanBasket
  const basketItems = useSyncExternalStore(
    (cb) => loanBasketStore.subscribe(cb),
    () => loanBasketStore.getItems(),
    () => []
  );
  const basketCount = basketItems.length;

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const data = await inventarisService.getInventarisList();
      setItems(data || []);
      return data || [];
    } catch (err: unknown) {
      console.error('[LoanModal] Gagal memuat katalog:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    fetchCatalog().then((data) => {
      if (!mounted) return;
      if (presetAssetId && data) {
        const target = data.find((i) => i.id === presetAssetId || i.kode === presetAssetId);
        if (target) {
          setExpandedCategories((prev) => new Set([...prev, target.kategori]));
          setExpandedAssets((prev) => new Set([...prev, target.id]));

          if (presetUnit !== undefined) {
            const uObj = target.units.find((u, idx) => {
              const uNum = parseInt(u.kode_unit.split('-U')[1] || `${idx + 1}`, 10);
              return uNum === presetUnit;
            }) || target.units[presetUnit - 1];

            if (uObj && uObj.status_peminjaman === 'tersedia' && uObj.kondisi === 'bagus') {
              const uKey = `${target.id}_${uObj.id}`;
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
    });

    return () => {
      mounted = false;
    };
  }, [isOpen, presetAssetId, presetUnit, fetchCatalog]);

  // If user changed
  useEffect(() => {
    if (user?.full_name && !borrowerName) {
      setBorrowerName(user.full_name);
    }
  }, [user, borrowerName]);

  // Auto-expand all populated categories so items are visible immediately
  useEffect(() => {
    if (items.length > 0) {
      const allCats = new Set(items.map((x) => normalizeInventoryCategory(x.kategori)));
      setExpandedCategories(allCats);
    }
  }, [items]);

  if (!isOpen) return null;

  // Build sorted categories
  const dbCats = Array.from(
    new Set(items.map((x) => normalizeInventoryCategory(x.kategori)).filter(Boolean))
  );
  dbCats.sort((a, b) => {
    const idxA = CATEGORY_ORDER.indexOf(a);
    const idxB = CATEGORY_ORDER.indexOf(b);
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
  });
  const catList = ['Semua', ...dbCats];

  // Group items by category
  const catMap = new Map<string, ItemInventaris[]>();
  items.forEach((x) => {
    const normCat = normalizeInventoryCategory(x.kategori);
    if (!catMap.has(normCat)) catMap.set(normCat, []);
    catMap.get(normCat)!.push(x);
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
    const uKey = `${asset.id}_${unitId}`;
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
      setFormError('Pilih minimal satu unit fisik terlebih dahulu.');
      return;
    }
    if (!purpose.trim()) {
      setFormError('Keperluan peminjaman wajib diisi.');
      const inp = document.getElementById('f_purpose');
      if (inp) inp.focus();
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      setConflictingUnits(new Map());

      // Pre-validation: Fetch latest inventory availability before submitting
      let freshItems: ItemInventaris[];
      try {
        freshItems = await inventarisService.getInventarisList();
        setItems(freshItems);
      } catch {
        freshItems = items;
      }

      const freshUnitMap = new Map<string, { unit: InventarisUnit; item: ItemInventaris }>();
      freshItems.forEach((it) => {
        (it.units || []).forEach((u) => {
          freshUnitMap.set(u.id, { unit: u, item: it });
        });
      });

      const conflictMap = new Map<string, string>();
      const conflictDetails: string[] = [];

      for (const b of basketItems) {
        const found = freshUnitMap.get(b.unitId);
        if (!found) {
          conflictMap.set(b.unitId, 'Unit tidak ditemukan dalam sistem');
          conflictDetails.push(`• ${b.assetName} (${b.unitCode}): Tidak ditemukan`);
          continue;
        }
        const { unit, item } = found;
        if (unit.status_peminjaman !== 'tersedia') {
          const reason = unit.status_peminjaman === 'dipinjam' ? 'Sedang dipinjam' : `Status: ${unit.status_peminjaman}`;
          conflictMap.set(b.unitId, reason);
          conflictDetails.push(`• ${item.nama_alat} (${unit.kode_unit}): ${reason}`);
        } else if (unit.kondisi && unit.kondisi !== 'bagus') {
          const reason = unit.kondisi === 'rusak' ? 'Kondisi rusak' : unit.kondisi === 'hilang' ? 'Unit hilang' : `Kondisi: ${unit.kondisi}`;
          conflictMap.set(b.unitId, reason);
          conflictDetails.push(`• ${item.nama_alat} (${unit.kode_unit}): ${reason}`);
        }
      }

      if (conflictMap.size > 0) {
        setConflictingUnits(conflictMap);
        setFormError(
          `Unit berikut tidak tersedia untuk dipinjam:\n${conflictDetails.join('\n')}\nSilakan hapus unit bermasalah dari daftar pilihan dan coba lagi.`
        );
        return;
      }

      const unitIds = basketItems.map((b) => b.unitId);
      const selectedEvent = acaraList.find((a) => a.id === eventRelated);
      const result = await peminjamanService.checkoutLoan(
        {
          borrower_name: borrowerName.trim() || user?.full_name || 'Kru PTV',
          purpose: purpose.trim(),
          due_date: dueDate,
          unit_ids: unitIds,
          event_name: selectedEvent ? selectedEvent.name : (eventRelated && eventRelated !== '__empty__' ? eventRelated : undefined),
        },
        user?.ptv_id,
        user?.full_name
      );

      if (!result.success) throw new Error('Backend belum mengonfirmasi peminjaman.');

      notificationService.notifyLoanCheckout({
        transaction_id: result.transaction_id,
        borrower_ptv_id: user?.ptv_id,
        borrower_name: borrowerName.trim() || user?.full_name || 'Kru PTV',
        unit_count: unitIds.length,
        due_date: dueDate,
      });

      loanBasketStore.clear();
      setMobileDrawerOpen(false);
      alert('Peminjaman multi-unit berhasil diajukan!');
      if (onSuccess) {
        try { await onSuccess(); }
        catch { alert('Peminjaman tersimpan, tetapi daftar belum berhasil dimuat ulang. Refresh halaman sebelum membuat transaksi lagi.'); }
      }
      onClose();
    } catch (err: unknown) {
      const errMsg = (err as Error).message || 'Gagal mengajukan peminjaman.';
      if (errMsg.includes('UNIT_NOT_AVAILABLE') || errMsg.toLowerCase().includes('tidak lagi tersedia') || errMsg.toLowerCase().includes('already loaned')) {
        // Diagnosis against fresh inventory state to pinpoint collision
        try {
          const refreshed = await inventarisService.getInventarisList();
          setItems(refreshed);
          const refreshedUnitMap = new Map<string, { unit: InventarisUnit; item: ItemInventaris }>();
          refreshed.forEach((it) => {
            (it.units || []).forEach((u) => {
              refreshedUnitMap.set(u.id, { unit: u, item: it });
            });
          });

          const reConflictMap = new Map<string, string>();
          const reConflictDetails: string[] = [];

          for (const b of basketItems) {
            const found = refreshedUnitMap.get(b.unitId);
            if (found) {
              if (found.unit.status_peminjaman !== 'tersedia' || (found.unit.kondisi && found.unit.kondisi !== 'bagus')) {
                const statusReason = found.unit.status_peminjaman !== 'tersedia'
                  ? (found.unit.status_peminjaman === 'dipinjam' ? 'Sedang dipinjam oleh transaksi lain' : found.unit.status_peminjaman)
                  : `Kondisi: ${found.unit.kondisi}`;
                reConflictMap.set(b.unitId, statusReason);
                reConflictDetails.push(`• ${found.item.nama_alat} (${found.unit.kode_unit}): ${statusReason}`);
              }
            }
          }

          if (reConflictMap.size > 0) {
            setConflictingUnits(reConflictMap);
            setFormError(
              `Backend menolak transaksi (UNIT_NOT_AVAILABLE). Unit berikut tidak dapat dipinjam:\n${reConflictDetails.join('\n')}\nSilakan hapus unit bermasalah dari daftar pilihan dan coba lagi.`
            );
          } else {
            setFormError(`Backend menolak transaksi: ${errMsg}. Silakan periksa atau muat ulang ketersediaan.`);
          }
        } catch {
          setFormError(`Backend menolak transaksi: ${errMsg}`);
        }
      } else {
        setFormError(errMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getCatKey = (cat: string) => {
    const lower = (cat || '').toLowerCase().trim();
    if (lower.includes('kamera')) return 'kamera';
    if (lower.includes('lensa')) return 'lensa';
    if (lower.includes('audio') || lower.includes('mic')) return 'audio';
    if (lower.includes('lighting') || lower.includes('lampu')) return 'lighting';
    if (lower.includes('stabilizer')) return 'stabilizer';
    if (lower.includes('tripod') || lower.includes('rig')) return 'tripod & rig';
    if (lower.includes('baterai') || lower.includes('power')) return 'baterai & power';
    if (lower.includes('streaming') || lower.includes('live')) return 'streaming / live';
    if (lower.includes('smartphone') || lower.includes('tablet')) return 'smartphone / tablet';
    if (lower.includes('komputer') || lower.includes('laptop')) return 'komputer / laptop';
    if (lower.includes('kabel') || lower.includes('adapter')) return 'kabel & adapter';
    return 'lainnya';
  };

  const getCatIconClass = (cat: string) => {
    const lower = (cat || '').toLowerCase();
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

  const renderUnitStatusChip = (unit: InventarisUnit) => {
    if (unit.kondisi === 'rusak') {
      return (
        <span className="loan-status-chip dang">
          <i className="fa-solid fa-triangle-exclamation" />
          <span>Rusak</span>
        </span>
      );
    }
    if (unit.kondisi === 'perlu_servis' || unit.status_peminjaman === 'maintenance') {
      return (
        <span className="loan-status-chip warn">
          <i className="fa-solid fa-wrench" />
          <span>Perlu Servis</span>
        </span>
      );
    }
    if (unit.status_peminjaman === 'dipinjam') {
      return (
        <span className="loan-status-chip warn">
          <i className="fa-solid fa-clock" />
          <span>Dipinjam</span>
        </span>
      );
    }
    if (unit.status_peminjaman === 'tersedia') {
      return (
        <span className="loan-status-chip ok">
          <i className="fa-solid fa-circle-check" />
          <span>Tersedia</span>
        </span>
      );
    }
    return (
      <span className="loan-status-chip neutral">
        <i className="fa-solid fa-circle-xmark" />
        <span>{unit.status_peminjaman === 'hilang' ? 'Hilang' : 'Tidak Tersedia'}</span>
      </span>
    );
  };

  // Group selected items by asset
  const groupedSelected = new Map<string, LoanBasketItem[]>();
  basketItems.forEach((b) => {
    if (!groupedSelected.has(b.assetId)) groupedSelected.set(b.assetId, []);
    groupedSelected.get(b.assetId)!.push(b);
  });

  const renderFormFields = () => (
    <div className="loan-form-section">
      {formError && (
        <div
          className="loan-form-error-banner"
          role="alert"
          style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <i className="fa-solid fa-circle-exclamation" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ flex: 1, whiteSpace: 'pre-line', fontSize: '12.5px', lineHeight: 1.4 }}>
              {formError}
            </div>
          </div>
          {conflictingUnits.size > 0 && (
            <button
              type="button"
              onClick={() => fetchCatalog()}
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm, 6px)',
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--dang-border, #fca5a5)',
                color: 'var(--dang, #dc2626)',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <i className="fa-solid fa-rotate-right" /> Muat Ulang Ketersediaan
            </button>
          )}
        </div>
      )}

      <div className="loan-form-field">
        <label className="loan-form-label" htmlFor="f_purpose">
          <span>Keperluan Peminjaman</span>
          <span className="required">*</span>
        </label>
        <input
          className="loan-form-input"
          id="f_purpose"
          value={purpose}
          onChange={(e) => {
            setPurpose(e.target.value);
            if (formError) setFormError('');
          }}
          placeholder="Contoh: Dokumentasi Syamail 2026, Konten PTV..."
          required
        />
        <div className="loan-purpose-chips-row">
          {PURPOSE_CHIPS.map((p) => (
            <button
              key={p}
              type="button"
              className={`loan-purpose-pill ${purpose === p ? 'active' : ''}`}
              onClick={() => {
                setPurpose(p);
                if (formError) setFormError('');
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="loan-date-grid">
        <div className="loan-form-field">
          <label className="loan-form-label" htmlFor="f_outDate">
            Tanggal Ambil
          </label>
          <input
            id="f_outDate"
            className="loan-form-input"
            type="date"
            value={outDate}
            onChange={(e) => setOutDate(e.target.value)}
          />
        </div>
        <div className="loan-form-field">
          <label className="loan-form-label" htmlFor="f_dueDate">
            Rencana Kembali
          </label>
          <input
            id="f_dueDate"
            className="loan-form-input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="loan-form-field">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <label className="loan-form-label" htmlFor="f_event" style={{ margin: 0 }}>
            Terkait Acara (Opsional)
          </label>
          {acaraError && (
            <button
              type="button"
              onClick={fetchAcara}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--b-600)',
                fontSize: '11.5px',
                fontWeight: 650,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: 0,
              }}
            >
              <i className="fa-solid fa-rotate-right" /> Coba lagi
            </button>
          )}
        </div>
        <PTVSelect
          id="f_event"
          value={eventRelated}
          onChange={(val) => {
            if (val === '__empty__') return;
            if (acaraError) {
              fetchAcara();
              return;
            }
            setEventRelated(val);
          }}
          options={eventOptions}
          placeholder={acaraLoading ? "Memuat agenda acara..." : "Pilih acara liputan..."}
          usePortal={true}
          clearable={true}
          onClear={() => setEventRelated('')}
        />
      </div>

      <div className="loan-form-field">
        <label className="loan-form-label" htmlFor="f_notes">
          Catatan Tambahan (Opsional)
        </label>
        <textarea
          id="f_notes"
          className="loan-form-input loan-form-textarea"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan kondisi, kelengkapan, dll..."
        />
      </div>

      <button
        type="button"
        className="loan-btn-submit"
        onClick={handleSubmit}
        disabled={basketCount === 0 || submitting}
        aria-busy={submitting}
      >
        {submitting ? (
          <>
            <i className="fa-solid fa-spinner fa-spin" />
            <span>Memproses...</span>
          </>
        ) : (
          <>
            <i className="fa-solid fa-paper-plane" />
            <span>{basketCount > 0 ? `Ajukan Peminjaman (${basketCount} Unit)` : 'Ajukan Peminjaman'}</span>
          </>
        )}
      </button>
    </div>
  );

  const renderSelectedPanel = (isMobileDrawer = false) => (
    <>
      {!isMobileDrawer && (
        <div className="loan-selected-header">
          <span className="loan-selected-title">
            <i className="fa-solid fa-clipboard-check" />
            <span>Alat yang Dipilih</span>
          </span>
          <div className="loan-selected-controls">
            {basketCount > 0 && (
              <button
                type="button"
                className="loan-btn-clear-basket"
                onClick={() => loanBasketStore.clear()}
                title="Kosongkan Semua Pilihan"
              >
                <i className="fa-solid fa-trash-can" style={{ fontSize: '11px' }} />
                <span>Kosongkan</span>
              </button>
            )}
            <span className="loan-badge-count">
              {basketCount} Unit Dipilih
            </span>
          </div>
        </div>
      )}

      {basketCount === 0 ? (
        <div className="loan-empty-selection">
          <i className="fa-solid fa-boxes-stacked" />
          <div className="empty-title">Belum ada unit dipilih</div>
          <div className="empty-desc">Buka kategori dan centang unit fisik di sebelah kiri.</div>
        </div>
      ) : (
        <div className="loan-selected-scroll-box">
          {Array.from(groupedSelected.entries()).map(([assetId, uList]) => {
            const assetObj = items.find((it) => it.id === assetId);
            const assetThumb = resolveInventoryPhotoUrl(assetObj?.foto_url);
            return (
              <div className="loan-selected-asset-card" key={assetId}>
                <div className="loan-selected-asset-head" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {assetThumb ? (
                    <img
                      src={assetThumb}
                      alt={uList[0].assetName}
                      style={{ width: '22px', height: '22px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <i className="fa-solid fa-box" style={{ color: 'var(--b-600)', fontSize: '12px' }} />
                  )}
                  <span>{uList[0].assetName}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '12px', borderLeft: '2px solid var(--b-600)', marginLeft: '2px' }}>
                  {uList.map((u) => {
                    const hasConflict = conflictingUnits.has(u.unitId);
                    const conflictReason = conflictingUnits.get(u.unitId);
                    return (
                      <div
                        className="loan-selected-unit-row"
                        key={u.key}
                        style={hasConflict ? {
                          background: 'var(--dang-bg, #fef2f2)',
                          border: '1px solid var(--dang-border, #fca5a5)',
                          borderRadius: 'var(--radius-sm, 6px)',
                          padding: '4px 6px'
                        } : undefined}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ color: hasConflict ? 'var(--dang, #dc2626)' : 'var(--b-600)', fontSize: '12px', lineHeight: 1 }}>&bull;</span>
                            <span style={{ fontWeight: 600, color: hasConflict ? 'var(--dang, #dc2626)' : 'inherit' }}>{u.unitName}</span>
                            <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'monospace' }}>
                              ({u.unitCode})
                            </span>
                          </div>
                          {hasConflict && (
                            <span style={{ fontSize: '10.5px', color: 'var(--dang, #dc2626)', fontWeight: 700, marginTop: '2px' }}>
                              ⚠️ {conflictReason}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="loan-btn-remove-unit"
                          onClick={() => {
                            loanBasketStore.remove(u.key);
                            setConflictingUnits((prev) => {
                              const next = new Map(prev);
                              next.delete(u.unitId);
                              return next;
                            });
                          }}
                          title="Hapus unit"
                          aria-label="Hapus unit"
                        >
                          &times;
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {renderFormFields()}
    </>
  );

  const modalContent = (
    <div className="ptv-hub-root loan-portal-root">
      {scanOpen && (
        <InventoryScanDialog
          onClose={() => setScanOpen(false)}
          catalogItems={items}
          onScan={(value, match) => {
            setScanOpen(false);
            if (match?.unit && match.asset) {
              const u = match.unit;
              const ast = match.asset;
              if (u.status_peminjaman === 'tersedia' && u.kondisi === 'bagus') {
                const uKey = `${ast.id}_${u.id}`;
                const unitNo = match.unitIndex || 1;
                loanBasketStore.toggle({
                  key: uKey,
                  assetId: ast.id,
                  unitId: u.id,
                  unitNo: unitNo,
                  unitCode: u.kode_unit,
                  unitName: `Unit ${unitNo.toString().padStart(2, '0')} (${u.kode_unit})`,
                  assetName: ast.nama_alat,
                  invCode: ast.kode,
                });
                setExpandedCategories((prev) => new Set([...prev, ast.kategori]));
                setExpandedAssets((prev) => new Set([...prev, ast.id]));
              } else {
                alert(`Unit ${u.kode_unit} tidak dapat dipinjam (Status: ${u.status_peminjaman}, Kondisi: ${u.kondisi}).`);
              }
            } else if (match && match.asset) {
              const ast = match.asset;
              setSearchQuery(ast.kode);
              setExpandedCategories((prev) => new Set([...prev, ast.kategori]));
              setExpandedAssets((prev) => new Set([...prev, ast.id]));
            } else {
              setSearchQuery(value);
            }
          }}
        />
      )}
      <div className="loan-modal-scrim" onClick={onClose} />
      <div ref={modalRef} className="loan-modal-container">
        <section
          className="loan-modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="loanModalTitle"
        >
          {/* Header */}
          <div className="loan-modal-header">
            <div className="loan-modal-title-group">
              <i className="fa-solid fa-boxes-stacked title-icon" />
              <h3 id="loanModalTitle">Peminjaman Alat &amp; Pemilihan Unit Fisik</h3>
            </div>
            <button
              type="button"
              className="loan-modal-close-btn"
              onClick={onClose}
              aria-label="Tutup modal"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {/* Body */}
          <div className="loan-modal-body">
            <div className="loan-split-layout">
              {/* LEFT COLUMN: Inventory Picker & Hierarchical Accordions */}
              <div className="loan-left-column">
                {/* Search & Scan Row */}
                <div className="loan-search-row">
                  <div className="loan-searchbar-pill">
                    <span className="search-icon">
                      <i className="fa-solid fa-magnifying-glass" />
                    </span>
                    <input
                      id="loanGearSearch"
                      aria-label="Cari alat atau unit fisik"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari nama alat, kode (INV-xxx), unit (U01)..."
                      autoComplete="off"
                    />
                  </div>
                  <button
                    type="button"
                    className="loan-btn-scan"
                    onClick={() => setScanOpen(true)}
                  >
                    <i className="fa-solid fa-qrcode" />
                    <span>Scan</span>
                  </button>
                </div>

                {/* Category Filter Chips Bar (Pure Pill with Drag & Navigation) */}
                <div className="loan-cat-rail-wrap">
                  {canScrollLeft && (
                    <button
                      type="button"
                      className="loan-cat-nav-btn left"
                      onClick={() => scrollCatRail('left')}
                      aria-label="Geser kategori ke kiri"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  )}
                  <div
                    ref={catRailRef}
                    className="loan-cat-rail"
                    id="loanCatChipsWrap"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUpOrLeave}
                    onMouseLeave={handleMouseUpOrLeave}
                  >
                    {catList.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`loan-cat-pill ${activeCat === c ? 'on' : ''}`}
                        onClick={(e) => {
                          if (hasDraggedRef.current) {
                            e.preventDefault();
                            return;
                          }
                          setActiveCat(c);
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {canScrollRight && (
                    <button
                      type="button"
                      className="loan-cat-nav-btn right"
                      onClick={() => scrollCatRail('right')}
                      aria-label="Geser kategori ke kanan"
                    >
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>

                {/* Hierarchical Accordions */}
                <div className="loan-catalog-scroll" id="loanInventoryScrollWrap">
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px', fontSize: '18px' }} />
                      Memuat katalog alat...
                    </div>
                  ) : resultCategories.length === 0 ? (
                    <div className="loan-catalog-empty">
                      <i className="fa-solid fa-box-open" style={{ fontSize: '32px', color: 'var(--muted)', opacity: 0.6, marginBottom: '8px', display: 'block' }} />
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: 'var(--ink)' }}>Tidak ada inventaris yang cocok.</p>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>Coba kata kunci lain atau pilih filter kategori "Semua".</span>
                    </div>
                  ) : (
                    resultCategories.map(([catName, catItems]) => {
                      const catKey = getCatKey(catName);
                      const isCatExp = expandedCategories.has(catName) || activeCat !== 'Semua' || !!q;
                      const catCount = catItems.length;

                      let totalCatAvail = 0;
                      let totalCatSelected = 0;
                      catItems.forEach((it) => {
                        totalCatAvail += it.unit_tersedia;
                        it.units.forEach((u) => {
                          if (loanBasketStore.has(u.id) || loanBasketStore.has(`${it.id}_${u.id}`)) {
                            totalCatSelected++;
                          }
                        });
                      });
                      const hasCatSelected = totalCatSelected > 0;

                      return (
                        <div
                          className={`loan-cat-acc-card ${isCatExp ? 'expanded' : ''} ${hasCatSelected ? 'has-selected' : ''}`}
                          key={catName}
                        >
                          {/* Category Accordion Header */}
                          <div
                            className="loan-cat-acc-header"
                            onClick={() => toggleCategory(catName)}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isCatExp}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleCategory(catName);
                              }
                            }}
                          >
                            <i className={`fa-solid fa-chevron-right loan-chevron-icon ${isCatExp ? 'open' : ''}`} />
                            <div className="loan-cat-tint-box" data-cat={catKey}>
                              <i className={getCatIconClass(catName)} />
                            </div>
                            <div className="loan-cat-acc-title">
                              <span className="loan-cat-acc-title-text">{catName}</span>
                              <span className="loan-cat-acc-count">({catCount})</span>
                            </div>
                            <div className="loan-cat-meta-right">
                              <span className={`loan-avail-text ${totalCatAvail > 0 ? 'ok' : 'warn'}`}>
                                {totalCatAvail} tersedia
                              </span>
                              {hasCatSelected && (
                                <span className="loan-badge-selected">
                                  <i className="fa-solid fa-check" style={{ fontSize: '10px' }} />
                                  <span>{totalCatSelected} dipilih</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Category Body (List of Assets) */}
                          {isCatExp && (
                            <div className="loan-cat-inner-list">
                              {catItems.map((x) => {
                                const assetCatKey = getCatKey(x.kategori);
                                const isAssetExp = expandedAssets.has(x.id) || !!q;
                                const selectedThisAsset = x.units.filter((u) => {
                                  return loanBasketStore.has(u.id) || loanBasketStore.has(`${x.id}_${u.id}`);
                                });
                                const selectedCount = selectedThisAsset.length;
                                const hasSelected = selectedCount > 0;
                                const assetLoc = x.units[0]?.lokasi_penyimpanan || 'Studio PTV';
                                const isSingleUnit = x.units.length === 1;
                                const singleUnit = isSingleUnit ? x.units[0] : null;
                                const isSingleAvail = singleUnit
                                  ? (singleUnit.status_peminjaman || '').toLowerCase() === 'tersedia' &&
                                    (singleUnit.kondisi || '').toLowerCase() === 'bagus'
                                  : false;
                                const isSingleChecked = singleUnit
                                  ? loanBasketStore.has(singleUnit.id) || loanBasketStore.has(`${x.id}_${singleUnit.id}`)
                                  : false;

                                return (
                                  <div
                                    className={`loan-asset-acc-card ${isAssetExp ? 'expanded' : ''} ${hasSelected ? 'has-selected' : ''}`}
                                    key={x.id}
                                  >
                                    {/* Asset Accordion Header */}
                                    <div
                                      className="loan-asset-acc-header"
                                      onClick={() => {
                                        if (isSingleUnit && isSingleAvail && singleUnit) {
                                          handleUnitToggle(x, 1, singleUnit.id, singleUnit.kode_unit);
                                        } else {
                                          toggleAsset(x.id);
                                        }
                                      }}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          if (isSingleUnit && isSingleAvail && singleUnit) {
                                            handleUnitToggle(x, 1, singleUnit.id, singleUnit.kode_unit);
                                          } else {
                                            toggleAsset(x.id);
                                          }
                                        }
                                      }}
                                    >
                                      {!isSingleUnit && (
                                        <i className={`fa-solid fa-chevron-right loan-chevron-icon ${isAssetExp ? 'open' : ''}`} />
                                      )}
                                      {(() => {
                                        const photoUrl = resolveInventoryPhotoUrl(x.foto_url);
                                        if (photoUrl) {
                                          return (
                                            <div className="loan-asset-thumb-box">
                                              <img
                                                src={photoUrl}
                                                alt={x.nama_alat}
                                                className="loan-asset-thumb-img"
                                                loading="lazy"
                                                onError={(e) => {
                                                  e.currentTarget.style.display = 'none';
                                                  const fallback = e.currentTarget.parentElement?.querySelector('.loan-cat-tint-box') as HTMLElement;
                                                  if (fallback) fallback.style.display = 'flex';
                                                }}
                                              />
                                              <div className="loan-cat-tint-box loan-asset-icon-sm" data-cat={assetCatKey} style={{ display: 'none' }}>
                                                <i className={getCatIconClass(x.kategori)} />
                                              </div>
                                            </div>
                                          );
                                        }
                                        return (
                                          <div className="loan-cat-tint-box loan-asset-icon-sm" data-cat={assetCatKey}>
                                            <i className={getCatIconClass(x.kategori)} />
                                          </div>
                                        );
                                      })()}
                                      <div className="loan-asset-info-group">
                                        <div className="loan-asset-title-row">
                                          <span className="loan-asset-name">{x.nama_alat}</span>
                                          <span className="loan-asset-code-badge">{x.kode}</span>
                                          <span className="inv-prod-cat" style={{ fontSize: '10.5px', color: 'var(--muted)', fontWeight: 600 }}>
                                            {normalizeInventoryCategory(x.kategori)}
                                          </span>
                                        </div>
                                        <div className="loan-asset-subtext">
                                          <span>{x.total_unit} Unit</span>
                                          <span>&bull;</span>
                                          <span style={{ fontWeight: 600, color: x.unit_tersedia > 0 ? 'var(--ok)' : 'var(--warn)' }}>
                                            {x.unit_tersedia} Tersedia
                                          </span>
                                          <span>&bull;</span>
                                          <span>{assetLoc}</span>
                                        </div>
                                      </div>
                                      <div className="loan-cat-meta-right" onClick={(e) => e.stopPropagation()}>
                                        {isSingleUnit ? (
                                          isSingleAvail && singleUnit ? (
                                            <button
                                              type="button"
                                              className={`btn sm ${isSingleChecked ? 'pri' : ''}`}
                                              onClick={() => handleUnitToggle(x, 1, singleUnit.id, singleUnit.kode_unit)}
                                              style={{
                                                minHeight: '32px',
                                                padding: '0 12px',
                                                borderRadius: 'var(--ptv-curve-pill)',
                                                fontSize: '11.5px',
                                                fontWeight: 700,
                                              }}
                                            >
                                              <i className={`fa-solid ${isSingleChecked ? 'fa-check' : 'fa-plus'}`} style={{ marginRight: '4px' }} />
                                              {isSingleChecked ? 'Dipilih' : 'Pilih'}
                                            </button>
                                          ) : (
                                            <span className="chip" style={{ fontSize: '10.5px', fontWeight: 600, background: 'var(--bg-2)', color: 'var(--muted)' }}>
                                              {singleUnit?.status_peminjaman === 'dipinjam' ? 'Dipinjam' : singleUnit?.kondisi === 'rusak' ? 'Rusak' : 'Tidak Tersedia'}
                                            </span>
                                          )
                                        ) : (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {hasSelected && (
                                              <span className="loan-badge-selected">
                                                <i className="fa-solid fa-check" style={{ fontSize: '10px' }} />
                                                <span>{selectedCount} Dipilih</span>
                                              </span>
                                            )}
                                            <button
                                              type="button"
                                              className="btn sm"
                                              onClick={() => toggleAsset(x.id)}
                                              style={{
                                                minHeight: '30px',
                                                padding: '0 10px',
                                                borderRadius: 'var(--ptv-curve-pill)',
                                                fontSize: '11px',
                                                fontWeight: 650,
                                                background: isAssetExp ? 'var(--b-050)' : 'var(--surface)',
                                                border: '1px solid var(--line-2)',
                                              }}
                                            >
                                              <span>{isAssetExp ? 'Tutup' : `Unit (${x.units.length})`}</span>
                                              <i className={`fa-solid ${isAssetExp ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ marginLeft: '4px', fontSize: '9px' }} />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Physical Units Checklist */}
                                    {!isSingleUnit && isAssetExp && (
                                      <div className="loan-units-list">
                                        {x.units.map((u, uIdx) => {
                                          const uNum = parseInt(u.kode_unit.split('-U')[1] || `${uIdx + 1}`, 10) || uIdx + 1;
                                          const isChecked = loanBasketStore.has(u.id) || loanBasketStore.has(`${x.id}_${u.id}`);
                                          const isAvail = (u.status_peminjaman || '').toLowerCase() === 'tersedia' && (u.kondisi || '').toLowerCase() === 'bagus';
                                          const uName = u.nama_unit?.trim() || `Unit ${uNum.toString().padStart(2, '0')}`;

                                          return (
                                            <div
                                              role="button"
                                              tabIndex={isAvail ? 0 : -1}
                                              key={u.id || uIdx}
                                              className={`loan-unit-row ${isChecked ? 'selected' : ''} ${!isAvail ? 'disabled' : ''}`}
                                              onClick={(e) => {
                                                if (!isAvail) {
                                                  e.preventDefault();
                                                  return;
                                                }
                                                handleUnitToggle(x, uNum, u.id, u.kode_unit);
                                              }}
                                              onKeyDown={(e) => {
                                                if (isAvail && (e.key === 'Enter' || e.key === ' ')) {
                                                  e.preventDefault();
                                                  handleUnitToggle(x, uNum, u.id, u.kode_unit);
                                                }
                                              }}
                                            >
                                              <input
                                                type="checkbox"
                                                className="loan-unit-checkbox"
                                                checked={isChecked}
                                                disabled={!isAvail}
                                                readOnly
                                              />
                                              <div className="loan-unit-detail">
                                                <span className="loan-unit-title">{uName}</span>
                                                <span className="loan-unit-code font-mono">{u.kode_unit}</span>
                                              </div>
                                              {renderUnitStatusChip(u)}
                                            </div>
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
              <div className="loan-right-column desktop-only-panel" id="loanSelectedPanelWrap">
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setMobileDrawerOpen(true);
                }
              }}
            >
              <div className="loan-mobile-bar-info">
                <i className="fa-solid fa-boxes-stacked" style={{ color: 'var(--b-600)' }} />
                <span>{basketCount} unit dipilih</span>
              </div>
              <div className="loan-mobile-bar-btn">
                <span>Lihat &amp; Ajukan</span>
                <i className="fa-solid fa-arrow-right" style={{ fontSize: '12px' }} />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* MOBILE FULL BOTTOM SHEET DRAWER (Nominal 30px Top Corner Radius) */}
      <div className={`loan-mobile-drawer-overlay ${mobileDrawerOpen ? 'open' : ''}`} id="loanMobileDrawerOverlay">
        <div className="loan-mobile-drawer-backdrop" onClick={() => setMobileDrawerOpen(false)} />
        <div className="loan-mobile-drawer-content" id="loanMobileDrawerContent">
          <div className="loan-mobile-drawer-header">
            <button
              type="button"
              className="loan-mobile-back-btn"
              onClick={() => setMobileDrawerOpen(false)}
              aria-label="Kembali ke Daftar Alat"
            >
              <i className="fa-solid fa-arrow-left" />
              <span>Pilih Alat</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {basketCount > 0 && (
                <button
                  type="button"
                  className="loan-btn-clear-basket"
                  onClick={() => loanBasketStore.clear()}
                  title="Kosongkan Semua Pilihan"
                >
                  <i className="fa-solid fa-trash-can" style={{ fontSize: '11px' }} />
                  <span>Kosongkan</span>
                </button>
              )}
              <span className="loan-badge-count">
                {basketCount} Unit
              </span>
              <button
                type="button"
                className="loan-modal-close-btn"
                style={{ width: '32px', height: '32px' }}
                onClick={onClose}
                aria-label="Tutup Peminjaman"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          </div>
          <div className="loan-mobile-drawer-body">
            {renderSelectedPanel(true)}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
