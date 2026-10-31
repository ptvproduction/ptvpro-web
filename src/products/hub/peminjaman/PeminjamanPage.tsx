import React, { useState, useCallback } from 'react';
import { useSessionStore } from '@core/session';
import { peminjamanService } from './peminjamanService';
import { PeminjamanRecord, KondisiKembali } from './types';
import { LoanModal } from './LoanModal';
import { PTVSelect, CardListSkeleton } from '@shared/components';
import { inventarisService } from '../inventaris/inventarisService';
import { ItemInventaris } from '../inventaris/types';
import { resolveInventoryPhotoUrl } from '../inventaris/utils/inventoryPhotoUtils';
import { useInstantData } from '@/shared/hooks/useInstantData';
import '../../../styles/peminjaman.css';

interface GroupedTransaction {
  transaction_id: string;
  by: string;
  purpose: string;
  out: string;
  due: string;
  items: PeminjamanRecord[];
}

const getCatKey = (kategori?: string): string => {
  const norm = (kategori || '').toLowerCase().trim();
  if (norm.includes('kamera') || norm.includes('camera')) return 'kamera';
  if (norm.includes('lensa') || norm.includes('lens')) return 'lensa';
  if (norm.includes('audio') || norm.includes('mic')) return 'audio';
  if (norm.includes('lighting') || norm.includes('lampu')) return 'lighting';
  if (norm.includes('stabilizer') || norm.includes('gimbal')) return 'stabilizer';
  if (norm.includes('tripod') || norm.includes('rig') || norm.includes('monopod')) return 'tripod & rig';
  if (norm.includes('baterai') || norm.includes('power') || norm.includes('battery')) return 'baterai & power';
  if (norm.includes('streaming') || norm.includes('live')) return 'streaming / live';
  if (norm.includes('smartphone') || norm.includes('tablet')) return 'smartphone / tablet';
  if (norm.includes('komputer') || norm.includes('laptop') || norm.includes('pc')) return 'komputer / laptop';
  if (norm.includes('kabel') || norm.includes('adapter')) return 'kabel & adapter';
  return 'lainnya';
};

const getCatIconClass = (kategori?: string): string => {
  const k = getCatKey(kategori);
  switch (k) {
    case 'kamera':
      return 'fa-solid fa-camera';
    case 'lensa':
      return 'fa-solid fa-circle-dot';
    case 'audio':
      return 'fa-solid fa-microphone';
    case 'lighting':
      return 'fa-solid fa-lightbulb';
    case 'stabilizer':
      return 'fa-solid fa-arrows-to-dot';
    case 'tripod & rig':
      return 'fa-solid fa-ring';
    case 'baterai & power':
      return 'fa-solid fa-battery-three-quarters';
    case 'streaming / live':
      return 'fa-solid fa-tower-broadcast';
    case 'smartphone / tablet':
      return 'fa-solid fa-mobile-screen-button';
    case 'komputer / laptop':
      return 'fa-solid fa-laptop';
    case 'kabel & adapter':
      return 'fa-solid fa-plug';
    default:
      return 'fa-solid fa-box-archive';
  }
};

export const PeminjamanPage: React.FC = () => {
  const { user, can } = useSessionStore();

  const {
    data: records,
    isLoading: loading,
    error,
    refetch: loadData,
  } = useInstantData<PeminjamanRecord[]>({
    key: 'peminjaman_loans_list',
    fetcher: () => peminjamanService.getPeminjamanList(),
    initialData: [],
    ttlMs: 3 * 60 * 1000,
  });

  const { data: catalogItems } = useInstantData<ItemInventaris[]>({
    key: 'inventaris_catalog_list',
    fetcher: () => inventarisService.getInventarisList(),
    initialData: [],
    ttlMs: 5 * 60 * 1000,
  });

  // Filters
  const [loanFilter, setLoanFilter] = useState<'aktif' | 'history' | 'selesai' | 'semua'>('aktif');
  const [searchQ, setSearchQ] = useState('');

  // Modals & Sheets
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [returnTargetUnit, setReturnTargetUnit] = useState<PeminjamanRecord | null>(null);
  const [returnTargetTxn, setReturnTargetTxn] = useState<GroupedTransaction | null>(null);
  const [returnCondition, setReturnCondition] = useState<KondisiKembali>('bagus');
  const [returnNotes, setReturnNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Helper resolusi foto alat atau unit fisik inventaris nyata
  const getLoanPhotoUrl = useCallback((l: PeminjamanRecord): string | null => {
    if (l.foto_url) {
      const direct = resolveInventoryPhotoUrl(l.foto_url);
      if (direct) return direct;
    }
    // Cocokkan melalui unit fisik terdaftar (unit_id atau kode_unit)
    for (const item of catalogItems) {
      const unit = item.units.find(
        (u) => u.id === l.unit_id || u.kode_unit === l.kode_unit
      );
      if (unit && item.foto_url) {
        const mPhoto = resolveInventoryPhotoUrl(item.foto_url);
        if (mPhoto) return mPhoto;
      }
    }
    // Cocokkan melalui nama alat
    const byName = catalogItems.find(
      (item) => item.nama_alat.toLowerCase().trim() === l.nama_alat.toLowerCase().trim()
    );
    if (byName?.foto_url) {
      const nPhoto = resolveInventoryPhotoUrl(byName.foto_url);
      if (nPhoto) return nPhoto;
    }
    return null;
  }, [catalogItems]);

  // Group all loans by transaction (1 submit = 1 card)
  const groupLoansByTransaction = (loans: PeminjamanRecord[]): GroupedTransaction[] => {
    const map = new Map<string, GroupedTransaction>();
    loans.forEach((l) => {
      const key = l.transaction_id || `txn_${l.id}`;
      if (!map.has(key)) {
        map.set(key, {
          transaction_id: key,
          by: l.peminjam_nama,
          purpose: l.keperluan,
          out: l.tanggal_pinjam,
          due: l.tenggat_kembali,
          items: [],
        });
      }
      const grp = map.get(key)!;
      if (l.tanggal_pinjam && (!grp.out || l.tanggal_pinjam < grp.out)) grp.out = l.tanggal_pinjam;
      if (l.tenggat_kembali && (!grp.due || l.tenggat_kembali > grp.due)) grp.due = l.tenggat_kembali;
      grp.items.push(l);
    });
    return Array.from(map.values());
  };

  const allGroups = groupLoansByTransaction(records);
  const todayIso = new Date().toISOString().split('T')[0];

  // Global metrics
  const activeLoans = records.filter((l) => l.status !== 'dikembalikan');
  const activeTxnCount = allGroups.filter((g) => g.items.some((l) => l.status !== 'dikembalikan')).length;
  const activeUnitsCount = activeLoans.length;
  const overdueCount = activeLoans.filter((l) => l.tenggat_kembali && l.tenggat_kembali < todayIso).length;

  // Filter groups
  let groups = [...allGroups];
  if (loanFilter === 'aktif') {
    groups = groups.filter((g) => g.items.some((l) => l.status !== 'dikembalikan'));
  } else if (loanFilter === 'history') {
    const userFullName = (user?.full_name || '').toLowerCase().trim();
    const userPtvId = (user?.ptv_id || '').toLowerCase().trim();
    const userId = (user?.id || '').toLowerCase().trim();
    const userTokens: string[] = userFullName
      .split(/\s+/)
      .filter((t: string) => t.length > 2 && !['muhammad', 'ahmad', 'moch', 'mohammad'].includes(t));

    groups = groups.filter((g) => {
      const byLower = g.by.toLowerCase();
      const matchesName = userFullName ? byLower.includes(userFullName) : false;
      const matchesTokens = userTokens.some((tok: string) => byLower.includes(tok));
      const matchesItems = g.items.some((l) => {
        const lPeminjam = (l.peminjam_nama || '').toLowerCase();
        const lActor = (l.actor_nama || '').toLowerCase();
        const lActorId = (l.actor_id || '').toLowerCase();
        return (
          (userFullName && (lPeminjam.includes(userFullName) || lActor.includes(userFullName))) ||
          (userPtvId && (lPeminjam.includes(userPtvId) || lActor.includes(userPtvId))) ||
          (userId && lActorId === userId) ||
          userTokens.some((tok: string) => lPeminjam.includes(tok) || lActor.includes(tok))
        );
      });
      return matchesName || matchesTokens || matchesItems;
    });
  } else if (loanFilter === 'selesai') {
    groups = groups.filter((g) => g.items.every((l) => l.status === 'dikembalikan'));
  }

  // Search filter
  if (searchQ.trim()) {
    const q = searchQ.trim().toLowerCase();
    groups = groups.filter((g) => {
      const byMatch = g.by.toLowerCase().includes(q);
      const purpMatch = g.purpose.toLowerCase().includes(q);
      const txnMatch = g.transaction_id.toLowerCase().includes(q);
      const itemMatch = g.items.some(
        (l) => l.nama_alat.toLowerCase().includes(q) || l.kode_unit.toLowerCase().includes(q)
      );
      return byMatch || purpMatch || txnMatch || itemMatch;
    });
  }

  const fmtDate = (dStr?: string) => {
    if (!dStr) return '-';
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

  const handleReturnSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTargetUnit) return;
    try {
      setSubmittingAction(true);
      await peminjamanService.returnSingleLoan(
        returnTargetUnit.id,
        returnCondition,
        returnNotes.trim() || undefined,
        user?.ptv_id,
        user?.full_name
      );
      setReturnTargetUnit(null);
      setReturnNotes('');
      alert(`Unit ${returnTargetUnit.kode_unit} berhasil dikembalikan!`);
      await loadData();
    } catch (err: unknown) {
      alert((err as Error).message || 'Gagal memproses pengembalian');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReturnTxnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTargetTxn) return;
    try {
      setSubmittingAction(true);
      await peminjamanService.returnLoan(
        {
          transaction_id: returnTargetTxn.transaction_id,
          condition_status: returnCondition,
          notes: returnNotes.trim() || undefined,
        },
        user?.ptv_id,
        user?.full_name
      );
      setReturnTargetTxn(null);
      setReturnNotes('');
      alert(`Seluruh alat dalam transaksi ${returnTargetTxn.transaction_id} berhasil dikembalikan!`);
      await loadData();
    } catch (err: unknown) {
      alert((err as Error).message || 'Gagal memproses pengembalian');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="loan-page-root">
      {/* ── Page Header Standar R03 ── */}
      <div className="ptv-page-header">
        <div className="ptv-page-header-main">
          <h1 className="ptv-page-title">Peminjaman Alat</h1>
          <p className="ptv-page-subtitle">
            Pencatatan sirkulasi peminjaman, tenggat waktu, dan verifikasi pengembalian unit inventaris produksi.
          </p>
        </div>
      </div>

      {/* ── Search & Filter Toolbar (R03 Contract) ── */}
      <div className="loan-page-toolbar">
        <div className="loan-search-wrap">
          <i className="fa-solid fa-magnifying-glass loan-search-icon-left" />
          <input
            type="text"
            id="loanSearchInput"
            className="loan-search-input-pill"
            placeholder="Cari peminjam, keperluan, nama alat atau kode unit..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
          {searchQ && (
            <button
              type="button"
              id="loanSearchClearBtn"
              className="loan-search-clear-btn"
              onClick={() => setSearchQ('')}
              aria-label="Hapus pencarian"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </div>

        <div className="loan-toolbar-right">
          <div className="loan-filter-rail" role="tablist" aria-label="Filter status peminjaman">
            {(
              [
                ['aktif', 'Sedang Dipinjam'],
                ['history', 'History Saya'],
                ['selesai', 'Selesai'],
                ['semua', 'Semua'],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={loanFilter === k}
                className={`loan-filter-pill-btn ${loanFilter === k ? 'active' : ''}`}
                onClick={() => setLoanFilter(k)}
              >
                {l}
              </button>
            ))}
          </div>

          {can('loans.checkout') && (
            <button
              type="button"
              id="btnOpenLoanModal"
              className="loan-btn-checkout-primary"
              onClick={() => setIsCheckoutOpen(true)}
            >
              <i className="fa-solid fa-plus" />
              <span>Pinjam Alat</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Inline Summary Metrics Bar (Official Semantic Tokens) ── */}
      <div className="loan-summary-bar">
        <span className="loan-metric-item active-loans">
          <i className="fa-solid fa-clipboard-list" />
          <span>
            <strong className="loan-summary-num">{activeTxnCount}</strong> peminjaman aktif
          </span>
        </span>
        <span className="loan-metric-dot-sep">&bull;</span>
        <span className="loan-metric-item active-units">
          <i className="fa-solid fa-boxes-stacked" />
          <span>
            <strong className="loan-summary-num">{activeUnitsCount}</strong> unit dipinjam
          </span>
        </span>
        <span className="loan-metric-dot-sep">&bull;</span>
        <span className={`loan-metric-item ${overdueCount > 0 ? 'overdue' : 'clean'}`}>
          <i className={`fa-solid fa-${overdueCount > 0 ? 'triangle-exclamation' : 'circle-check'}`} />
          <span>
            <strong className="loan-summary-num">{overdueCount}</strong> terlambat
          </span>
        </span>

        <span className="loan-result-count-label">
          {groups.length} form peminjaman
        </span>
      </div>

      {/* ── TRANSACTION CARDS LIST ── */}
      {loading && records.length === 0 ? (
        <CardListSkeleton count={4} variant="horizontal-card" />
      ) : error ? (
        <div className="loan-empty-card" style={{ border: '1px solid var(--dang-border)', background: 'var(--dang-bg)' }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--dang)', fontSize: '26px', marginBottom: '4px' }} />
          <p className="loan-empty-text" style={{ color: 'var(--dang)', fontWeight: 600 }}>{error}</p>
          <button
            type="button"
            onClick={() => loadData()}
            className="loan-btn-checkout-primary"
            style={{ marginTop: '8px' }}
          >
            <i className="fa-solid fa-arrow-rotate-right" />
            <span>Coba Lagi</span>
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="loan-empty-card">
          <div className="loan-empty-icon-wrap">
            <i className="fa-solid fa-right-left loan-empty-icon" />
          </div>
          <p className="loan-empty-text">Tidak ada transaksi peminjaman pada tab ini.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {groups.map((grp) => {
            const allBack = grp.items.every((l) => l.status === 'dikembalikan');
            const anyLate = grp.items.some(
              (l) => l.status !== 'dikembalikan' && l.tenggat_kembali && l.tenggat_kembali < todayIso
            );
            const returnedCount = grp.items.filter((l) => l.status === 'dikembalikan').length;
            const totalCount = grp.items.length;

            return (
              <div
                key={grp.transaction_id}
                className={`loan-txn-card ${anyLate ? 'is-overdue' : allBack ? 'is-done' : ''}`}
              >
                {/* ── BAGIAN KIRI: Metadata Peminjam ── */}
                <div className="loan-split-left">
                  <div>
                    {/* Header Peminjam: Avatar + Nama + Keperluan */}
                    <div className="loan-borrower-head">
                      <div className="loan-avatar-wrap">
                        <span className="loan-avatar-monogram">
                          {grp.by
                            .split(' ')
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </span>
                        <span
                          className={`loan-avatar-status-dot ${allBack ? 'done' : anyLate ? 'overdue' : 'active'}`}
                        />
                      </div>
                      <div className="loan-borrower-info">
                        <div className="loan-borrower-name-row">
                          <span className="loan-borrower-name">{grp.by}</span>
                          <span className="loan-txn-id-pill">{grp.transaction_id}</span>
                        </div>
                        <div className="loan-purpose-text">
                          {grp.purpose || 'Operasional Produksi PTV'}
                        </div>
                      </div>
                    </div>

                    {/* Metadata Durasi Pinjam */}
                    <div className="loan-meta-block">
                      <div className="loan-meta-label">Durasi Pinjam</div>
                      <div className="loan-meta-dates">
                        <span>{fmtDate(grp.out)}</span>
                        <span style={{ color: 'var(--muted)', fontSize: '11.5px' }}>s/d</span>
                        <span style={{ color: anyLate ? 'var(--dang)' : 'var(--ink)', fontWeight: anyLate ? 700 : 600 }}>
                          {fmtDate(grp.due)}
                        </span>
                      </div>
                      {anyLate && (
                        <div className="loan-late-indicator">
                          <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: '10px' }} />
                          <span>Melewati Batas Pengembalian</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status chip panel kiri */}
                  <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
                    {allBack ? (
                      <span className="loan-status-chip selesai">
                        <i className="fa-solid fa-circle-check" style={{ fontSize: '11px' }} /> Selesai
                      </span>
                    ) : anyLate ? (
                      <span className="loan-status-chip terlambat">
                        <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '11px' }} /> Terlambat
                      </span>
                    ) : (
                      <span className="loan-status-chip dipinjam">
                        <i className="fa-solid fa-arrow-right-arrow-left" style={{ fontSize: '10.5px' }} /> Dipinjam
                      </span>
                    )}
                  </div>
                </div>

                {/* ── BAGIAN KANAN: Daftar Seluruh Alat ── */}
                <div className="loan-split-right">
                  <div className="loan-split-items-list">
                    {grp.items.map((l) => {
                      const isBack = l.status === 'dikembalikan';
                      const isItemLate = !isBack && l.tenggat_kembali && l.tenggat_kembali < todayIso;

                      const itemPhoto = getLoanPhotoUrl(l);

                      return (
                        <div key={l.id} className="loan-item-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                            <div className="loan-item-thumb-box loan-cat-tint-box" data-cat={getCatKey(l.kategori)}>
                              {itemPhoto ? (
                                <>
                                  <img
                                    src={itemPhoto}
                                    alt={l.nama_alat}
                                    className="loan-item-thumb-img"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLElement).style.display = 'none';
                                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                      if (fallback) fallback.style.display = 'flex';
                                    }}
                                  />
                                  <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                    <i className={getCatIconClass(l.kategori)} />
                                  </div>
                                </>
                              ) : (
                                <i className={getCatIconClass(l.kategori)} />
                              )}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span className="loan-item-name">{l.nama_alat}</span>
                                <span className="loan-item-unit-badge">
                                  {l.kode_unit}
                                </span>
                                {l.is_historical && (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      background: 'rgba(100, 116, 139, 0.1)',
                                      color: 'var(--muted, #64748b)',
                                      padding: '1px 6px',
                                      borderRadius: 'var(--r-xs, 4px)',
                                      border: '1px solid rgba(100, 116, 139, 0.2)',
                                    }}
                                  >
                                    Arsip Historis
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: '11.5px',
                                  color: 'var(--muted)',
                                  marginTop: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span>1 Unit</span>
                                {isBack ? (
                                  <span style={{ color: 'var(--ok)', fontWeight: 600 }}>
                                    &bull; Selesai ({fmtDate(l.tanggal_kembali)})
                                  </span>
                                ) : (
                                  isItemLate && (
                                    <span style={{ color: 'var(--dang)', fontWeight: 600 }}>
                                      &bull; Batas: {fmtDate(l.tenggat_kembali)}
                                    </span>
                                  )
                                )}
                              </div>
                              {isBack && l.catatan && (
                                <p style={{ margin: '5px 0 0', fontSize: '12px', color: 'var(--ink-2)', overflowWrap: 'anywhere' }}>
                                  Catatan pengembalian: {l.catatan}
                                </p>
                              )}
                            </div>
                          </div>

                          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isBack ? (
                              <span className="loan-status-chip selesai" style={{ fontSize: '11px', padding: '3px 10px' }}>
                                <i className="fa-solid fa-check" style={{ fontSize: '10px' }} /> Selesai
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="loan-btn-return-item"
                                onClick={() => {
                                  setReturnTargetUnit(l);
                                  setReturnCondition('bagus');
                                  setReturnNotes('');
                                }}
                                title={`Kembalikan ${l.nama_alat}`}
                              >
                                <i className="fa-solid fa-rotate-left" style={{ fontSize: '10.5px' }} />
                                <span>Kembalikan</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer Kanan: Total Unit & Kembalikan Semua */}
                  <div className="loan-split-footer">
                    <div style={{ fontSize: '12px', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-boxes-stacked" style={{ color: 'var(--muted)', fontSize: '11.5px' }} />
                      <span>
                        Total: <strong style={{ fontWeight: 700, color: 'var(--ink)' }}>{totalCount} unit alat</strong>
                      </span>
                      {returnedCount > 0 && (
                        <span style={{ color: 'var(--muted)', fontSize: '11.5px' }}>
                          ({returnedCount} kembali)
                        </span>
                      )}
                    </div>

                    {!allBack ? (
                      <button
                        type="button"
                        className="loan-btn-return-all"
                        onClick={() => {
                          setReturnTargetTxn(grp);
                          setReturnCondition('bagus');
                          setReturnNotes('');
                        }}
                      >
                        <i className="fa-solid fa-rotate-left" style={{ fontSize: '10.5px' }} />
                        <span>Kembalikan Semua</span>
                      </button>
                    ) : (
                      <span className="loan-text-all-returned">
                        <i className="fa-solid fa-circle-check" style={{ fontSize: '12px' }} />
                        <span>Semua alat telah dikembalikan</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL KONFIRMASI PENGEMBALIAN UNIT TUNGGAL (R03 Contract) ── */}
      {returnTargetUnit && (
        <>
          <div className="loan-return-modal-scrim" onClick={() => setReturnTargetUnit(null)} />
          <div className="loan-return-modal-container">
            <section className="loan-return-modal-card" role="dialog" aria-modal="true" aria-labelledby="returnUnitModalTitle">
              <div className="loan-return-modal-header">
                <div className="loan-return-modal-title">
                  <i className="fa-solid fa-rotate-left" />
                  <h3 id="returnUnitModalTitle">Konfirmasi Pengembalian Unit</h3>
                </div>
                <button
                  type="button"
                  className="loan-modal-close-btn"
                  onClick={() => setReturnTargetUnit(null)}
                  aria-label="Tutup modal"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              <div className="loan-return-modal-body">
                <form onSubmit={handleReturnSingleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {(() => {
                    const retPhoto = getLoanPhotoUrl(returnTargetUnit);
                    return (
                      <div className="loan-return-detail-box" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {retPhoto ? (
                          <img
                            src={retPhoto}
                            alt={returnTargetUnit.nama_alat}
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: 'var(--radius-sm, 8px)',
                              objectFit: 'cover',
                              border: '1px solid var(--line-2)',
                              flexShrink: 0,
                            }}
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div
                          className="loan-item-thumb-box loan-cat-tint-box"
                          data-cat={getCatKey(returnTargetUnit.kategori)}
                          style={{
                            display: retPhoto ? 'none' : 'flex',
                            width: '46px',
                            height: '46px',
                            borderRadius: 'var(--radius-sm, 8px)',
                            flexShrink: 0,
                          }}
                        >
                          <i className={getCatIconClass(returnTargetUnit.kategori)} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <span className="loan-return-detail-label">Detail Alat &amp; Unit</span>
                          <span className="loan-return-detail-name">{returnTargetUnit.nama_alat}</span>
                          <span className="loan-return-detail-code">Kode Unit: {returnTargetUnit.kode_unit}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="loan-return-field-group">
                    <label className="loan-return-field-label">Kondisi Fisik Saat Dikembalikan</label>
                    <PTVSelect
                      value={returnCondition}
                      onChange={(val) => setReturnCondition(val as KondisiKembali)}
                      options={[
                        { value: 'bagus', label: 'Bagus / Normal (Siap Pakai)' },
                        { value: 'perlu_servis', label: 'Perlu Servis / Pembersihan' },
                        { value: 'rusak', label: 'Rusak / Bermasalah (Kunci ke Maintenance)' },
                      ]}
                      ariaLabel="Kondisi Fisik Saat Dikembalikan"
                    />
                  </div>

                  <div className="loan-return-field-group">
                    <label className="loan-return-field-label">Catatan Pemeriksaan (Opsional)</label>
                    <input
                      type="text"
                      className="loan-return-input-text"
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      placeholder="Contoh: Lengkap dengan tas &amp; charger."
                    />
                  </div>

                  <div className="loan-return-modal-footer">
                    <button
                      type="button"
                      className="loan-btn-cancel-modal"
                      onClick={() => setReturnTargetUnit(null)}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="loan-btn-submit-modal"
                      disabled={submittingAction}
                    >
                      {submittingAction ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        'Ya, Kembalikan Unit'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </>
      )}

      {/* ── MODAL KONFIRMASI PENGEMBALIAN SELURUH TRANSAKSI (R03 Contract) ── */}
      {returnTargetTxn && (
        <>
          <div className="loan-return-modal-scrim" onClick={() => setReturnTargetTxn(null)} />
          <div className="loan-return-modal-container">
            <section className="loan-return-modal-card" role="dialog" aria-modal="true" aria-labelledby="returnTxnModalTitle">
              <div className="loan-return-modal-header">
                <div className="loan-return-modal-title">
                  <i className="fa-solid fa-rotate-left" />
                  <h3 id="returnTxnModalTitle">Kembalikan Seluruh Alat Transaksi</h3>
                </div>
                <button
                  type="button"
                  className="loan-modal-close-btn"
                  onClick={() => setReturnTargetTxn(null)}
                  aria-label="Tutup modal"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              <div className="loan-return-modal-body">
                <form onSubmit={handleReturnTxnSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="loan-return-detail-box">
                    <span className="loan-return-detail-label">Nomor Transaksi: {returnTargetTxn.transaction_id}</span>
                    <span className="loan-return-detail-name">Peminjam: {returnTargetTxn.by} ({returnTargetTxn.items.length} Unit Alat)</span>
                  </div>

                  <div className="loan-return-field-group">
                    <label className="loan-return-field-label">Kondisi Fisik Pengembalian</label>
                    <PTVSelect
                      value={returnCondition}
                      onChange={(val) => setReturnCondition(val as KondisiKembali)}
                      options={[
                        { value: 'bagus', label: 'Semua Unit Bagus / Normal' },
                        { value: 'perlu_servis', label: 'Perlu Servis / Pengecekan Ulang' },
                        { value: 'rusak', label: 'Terdapat Kerusakan' },
                      ]}
                      ariaLabel="Kondisi Fisik Pengembalian"
                    />
                  </div>

                  <div className="loan-return-field-group">
                    <label className="loan-return-field-label">Catatan Verifikasi (Opsional)</label>
                    <input
                      type="text"
                      className="loan-return-input-text"
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      placeholder="Contoh: Seluruh unit telah diverifikasi oleh technical."
                    />
                  </div>

                  <div className="loan-return-modal-footer">
                    <button
                      type="button"
                      className="loan-btn-cancel-modal"
                      onClick={() => setReturnTargetTxn(null)}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="loan-btn-submit-modal"
                      disabled={submittingAction}
                    >
                      {submittingAction ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        'Kembalikan Semua Unit'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </>
      )}

      {/* ── MODAL PINJAM ALAT 1:1 LEGACY DARI openLoanModal() ── */}
      <LoanModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
};
