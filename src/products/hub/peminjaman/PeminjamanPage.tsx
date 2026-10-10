import React, { useState, useEffect } from 'react';
import { useSessionStore } from '@core/session';
import { peminjamanService } from './peminjamanService';
import { PeminjamanRecord, KondisiKembali } from './types';
import { LoanModal } from './LoanModal';
import { PTVSelect } from '@shared/components';

interface GroupedTransaction {
  transaction_id: string;
  by: string;
  purpose: string;
  out: string;
  due: string;
  items: PeminjamanRecord[];
}

export const PeminjamanPage: React.FC = () => {
  const { user, can } = useSessionStore();

  const [records, setRecords] = useState<PeminjamanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters from pgPeminjaman()
  const [loanFilter, setLoanFilter] = useState<'aktif' | 'saya' | 'selesai' | 'semua'>('aktif');
  const [searchQ, setSearchQ] = useState('');

  // Modals & Sheets
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [returnTargetUnit, setReturnTargetUnit] = useState<PeminjamanRecord | null>(null);
  const [returnTargetTxn, setReturnTargetTxn] = useState<GroupedTransaction | null>(null);
  const [returnCondition, setReturnCondition] = useState<KondisiKembali>('bagus');
  const [returnNotes, setReturnNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await peminjamanService.getPeminjamanList();
      setRecords(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);


  // Group all loans by transaction (1 submit = 1 card) - identical to groupLoansByTransaction()
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
  } else if (loanFilter === 'saya') {
    groups = groups.filter((g) => g.by.toLowerCase().includes((user?.full_name || '').toLowerCase()));
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
    <div className="page" style={{ paddingTop: '4px' }}>
      {/* ── Search & Filter Controls (Apple-style Clean Toolbar 1:1 Legacy) ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line-2, rgba(15,23,42,0.08))', borderRadius: 'var(--ptv-curve-lg)', padding: '10px 14px', marginBottom: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-2)', fontSize: '12px' }} />
            <input
              type="text"
              id="loanSearchInput"
              className="input"
              placeholder="Cari peminjam, keperluan, nama alat atau kode unit..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              style={{ paddingLeft: '34px', paddingRight: searchQ ? '32px' : '14px', borderRadius: 'var(--ptv-curve-md)', fontSize: '12.5px', height: '36px', background: 'var(--bg-2)', border: '1px solid var(--line-2, rgba(15,23,42,0.08))', width: '100%', boxSizing: 'border-box' }}
            />
            {searchQ && (
              <button
                type="button"
                id="loanSearchClearBtn"
                onClick={() => setSearchQ('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-2)', fontSize: '13px', padding: '4px', display: 'inline-flex' }}
                aria-label="Hapus pencarian"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div className="filters" style={{ marginBottom: 0, display: 'flex', gap: '5px' }}>
              {(
                [
                  ['aktif', 'Sedang Dipinjam'],
                  ['saya', 'Milik Saya'],
                  ['selesai', 'Selesai'],
                  ['semua', 'Semua'],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  className={`fchip ${loanFilter === k ? 'on' : ''}`}
                  onClick={() => setLoanFilter(k)}
                  style={{ fontSize: '12px', padding: '5px 13px', borderRadius: 'var(--ptv-curve-pill)', fontWeight: 500 }}
                >
                  {l}
                </button>
              ))}
            </div>
            {can('loans.checkout') && (
              <button
                type="button"
                className="btn sm pri"
                onClick={() => setIsCheckoutOpen(true)}
                style={{ fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--ptv-curve-md)', fontWeight: 600, background: 'var(--ptv-green, #0e4f40)', border: 'none', boxShadow: '0 1px 3px rgba(14,79,64,0.2)', minHeight: '34px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-plus" style={{ fontSize: '11px' }} />
                <span>Pinjam Alat</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Inline Summary Bar (Subtle & Apple-like 1:1 Legacy) ── */}
      <div className="loan-summary-bar">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <i className="fa-solid fa-clipboard-list" style={{ color: 'var(--ptv-green, #0e4f40)', fontSize: '12px' }} />
          <span><strong style={{ fontWeight: 600, color: 'var(--ink)' }}>{activeTxnCount}</strong> peminjaman aktif</span>
        </span>
        <span style={{ color: 'var(--muted, #94a3b8)' }}>&bull;</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <i className="fa-solid fa-boxes-stacked" style={{ color: '#2563eb', fontSize: '12px' }} />
          <span><strong style={{ fontWeight: 600, color: 'var(--ink)' }}>{activeUnitsCount}</strong> unit dipinjam</span>
        </span>
        <span style={{ color: 'var(--muted, #94a3b8)' }}>&bull;</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: overdueCount > 0 ? '#dc2626' : undefined }}>
          <i className={`fa-solid fa-${overdueCount > 0 ? 'triangle-exclamation' : 'circle-check'}`} style={{ fontSize: '12px', color: overdueCount > 0 ? '#dc2626' : '#10b981' }} />
          <span><strong style={{ fontWeight: 600, color: overdueCount > 0 ? '#dc2626' : 'var(--ink)' }}>{overdueCount}</strong> terlambat</span>
        </span>
      </div>

      {/* ── RESULT COUNT ── */}
      <div className="row-b mb10">
        <span className="t-sm" style={{ fontWeight: 700, color: 'var(--ink)' }}>
          {groups.length} form peminjaman
        </span>
      </div>

      {/* ── TRANSACTION CARDS LIST 1:1 DARI pgPeminjaman() ── */}
      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }} />
          Memuat data peminjaman...
        </div>
      ) : groups.length === 0 ? (
        <div className="empty card">
          <i className="fa-solid fa-right-left" />
          <p>Tidak ada transaksi peminjaman pada tab ini.</p>
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
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px' }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <span className="avatar md">
                          {grp.by
                            .split(' ')
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </span>
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '9px',
                            height: '9px',
                            borderRadius: '50%',
                            border: '2px solid #ffffff',
                            background: allBack ? '#10b981' : anyLate ? '#ef4444' : '#2563eb',
                          }}
                        />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '14.5px',
                              fontWeight: 700,
                              color: 'var(--ink)',
                              letterSpacing: '-0.01em',
                              lineHeight: 1.25,
                            }}
                          >
                            {grp.by}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '1.5px 7px',
                              borderRadius: 'var(--ptv-curve-pill)',
                              background: 'rgba(15,23,42,0.05)',
                              color: 'var(--ink-2)',
                              fontWeight: 500,
                            }}
                          >
                            {grp.transaction_id}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--ink-2)',
                            marginTop: '3px',
                            lineHeight: 1.4,
                            fontWeight: 400,
                          }}
                        >
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
                        <span style={{ color: anyLate ? '#dc2626' : 'var(--ink)', fontWeight: anyLate ? 700 : 600 }}>
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
                  <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
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

                      return (
                        <div key={l.id} className="loan-item-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <div className="loan-item-thumb">
                              <span className="li-ic sm">
                                <i className="fa-solid fa-camera-retro" />
                              </span>
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span className="loan-item-name">{l.nama_alat}</span>
                                <span className="chip blue" style={{ fontSize: '10.5px', fontFamily: 'monospace' }}>
                                  {l.kode_unit}
                                </span>
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
                                  <span style={{ color: '#059669', fontWeight: 600 }}>
                                    &bull; Selesai ({fmtDate(l.tanggal_kembali)})
                                  </span>
                                ) : (
                                  isItemLate && (
                                    <span style={{ color: '#dc2626', fontWeight: 600 }}>
                                      &bull; Batas: {fmtDate(l.tenggat_kembali)}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isBack ? (
                              <span className="loan-status-chip selesai" style={{ fontSize: '11px', padding: '3px 9px' }}>
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
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          color: '#059669',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
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

      {/* ── MODAL KONFIRMASI PENGEMBALIAN UNIT TUNGGAL ── */}
      {returnTargetUnit && (
        <>
          <div className="scrim on" onClick={() => setReturnTargetUnit(null)} />
          <section className="sheet on" role="dialog" aria-modal="true">
            <div className="sheet-grab" />
            <div className="sheet-hd">
              <h3>Konfirmasi Pengembalian Unit</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setReturnTargetUnit(null)}
                aria-label="Tutup"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="sheet-body" style={{ padding: '16px' }}>
              <form onSubmit={handleReturnSingleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-lg)', padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Detail Alat & Unit
                  </div>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {returnTargetUnit.nama_alat}
                  </div>
                  <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: 600, marginTop: '2px' }}>
                    Kode Unit: {returnTargetUnit.kode_unit}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>
                    Kondisi Fisik Saat Dikembalikan
                  </label>
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

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>
                    Catatan Pemeriksaan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="Contoh: Lengkap dengan tas & charger."
                    style={{ width: '100%', marginTop: '4px', height: '40px', padding: '0 10px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    className="btn sec flex-1"
                    onClick={() => setReturnTargetUnit(null)}
                    style={{ borderRadius: 'var(--ptv-curve-md)' }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn pri flex-1"
                    disabled={submittingAction}
                    style={{ borderRadius: 'var(--ptv-curve-md)', background: '#0e4f40' }}
                  >
                    {submittingAction ? 'Menyimpan...' : 'Ya, Kembalikan Unit'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </>
      )}

      {/* ── MODAL KONFIRMASI PENGEMBALIAN SELURUH TRANSAKSI ── */}
      {returnTargetTxn && (
        <>
          <div className="scrim on" onClick={() => setReturnTargetTxn(null)} />
          <section className="sheet on" role="dialog" aria-modal="true">
            <div className="sheet-grab" />
            <div className="sheet-hd">
              <h3>Kembalikan Seluruh Alat Transaksi</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setReturnTargetTxn(null)}
                aria-label="Tutup"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="sheet-body" style={{ padding: '16px' }}>
              <form onSubmit={handleReturnTxnSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--ptv-curve-lg)', padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Nomor Transaksi: {returnTargetTxn.transaction_id}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>
                    Peminjam: {returnTargetTxn.by} ({returnTargetTxn.items.length} Unit Alat)
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>
                    Kondisi Fisik Pengembalian
                  </label>
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

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>
                    Catatan Verifikasi (Opsional)
                  </label>
                  <input
                    type="text"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="Contoh: Seluruh unit telah diverifikasi oleh technical."
                    style={{ width: '100%', marginTop: '4px', height: '40px', padding: '0 10px', borderRadius: 'var(--ptv-curve-md)', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    className="btn sec flex-1"
                    onClick={() => setReturnTargetTxn(null)}
                    style={{ borderRadius: 'var(--ptv-curve-md)' }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn pri flex-1"
                    disabled={submittingAction}
                    style={{ borderRadius: 'var(--ptv-curve-md)', background: '#0e4f40' }}
                  >
                    {submittingAction ? 'Menyimpan...' : 'Kembalikan Semua Unit'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </>
      )}

      {/* ── MODAL PINJAM ALAT 1:1 LEGACY DARI openLoanModal() ── */}
      <LoanModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
};
