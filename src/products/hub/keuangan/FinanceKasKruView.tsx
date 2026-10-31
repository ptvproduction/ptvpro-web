import { useState, useMemo, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Search,
  Check,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { useCrewStore } from '@products/hub/kru/kruStore';
import type { FinanceSnapshot } from './financeFoundation';
import { formatMinor } from './financeCanonical';
import { FinanceDialog } from './FinanceWorkspace';
import { SearchableCrewSelect } from './components/SearchableCrewSelect';
import type { FinanceOperationalData } from './financeOperationalData';
import type { CrewMember } from '@products/hub/kru/types';
import type { FinanceSemester } from './kasKruTypes';
import {
  calculateKasKruMatrix,
  getStoredRecords,
  getStoredSemesters,
  recordKasKruPayment,
  reverseKasKruRecord,
  waiveKasKruFee,
  getCurrentPeriodMonth,
  getSemesterPeriodFeeMinor,
} from './kasKruService';

export function FinanceKasKruView({
  data,
  onRefresh,
  operational,
  crew,
}: {
  data: FinanceSnapshot;
  onRefresh?: () => void;
  operational?: FinanceOperationalData;
  crew?: CrewMember[];
}) {
  const { members, error: crewError, loading: crewLoading } = useCrewStore();
  const crewMembers = crew || members;
  const semesters = useMemo<FinanceSemester[]>(() => operational?.semesters ?? getStoredSemesters(), [operational]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>(
    () => semesters.find(s => s.isActive && !s.isArchived)?.id || semesters[0]?.id || 'sem-2026-ganjil'
  );
  const [records, setRecords] = useState(() => operational?.records ?? getStoredRecords());

  useEffect(() => {
    if (operational?.records) {
      setRecords(operational.records);
    }
  }, [operational?.records]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'lunas' | 'belum' | 'tunggakan'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModal, setActiveModal] = useState<'bayar' | 'semester' | 'reversal' | 'exemption' | null>(null);

  // Selected crew for payment modal
  const [selectedCrewPtvId, setSelectedCrewPtvId] = useState<string>('');
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [customPaymentRupiah, setCustomPaymentRupiah] = useState<string>('');
  const [paymentPocketId, setPaymentPocketId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris'>('cash');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [paymentError, setPaymentError] = useState('');

  // Exemption state
  const [exemptionCrewPtvId, setExemptionCrewPtvId] = useState<string>('');
  const [exemptionPeriod, setExemptionPeriod] = useState<string>('');
  const [exemptionReason, setExemptionReason] = useState<string>('');
  const [exemptionError, setExemptionError] = useState<string>('');

  // Reversal modal state
  const [reversalRecordId, setReversalRecordId] = useState('');
  const [reversalReason, setReversalReason] = useState('');

  // ATURAN H: Filter peserta kru aktif (Pembina & Pengarah strictly excluded)
  const activeBillableCrew = useMemo(() => {
    return crewMembers.filter(c => {
      const cat = (c.category || '').toLowerCase().trim();
      if (cat === 'pembina' || cat === 'pengarah') return false;
      return (c.status_kru || '').toLowerCase().trim() === 'aktif';
    });
  }, [crewMembers]);

  const currentSemester = useMemo(() => {
    return semesters.find(s => s.id === selectedSemesterId) || semesters[0];
  }, [semesters, selectedSemesterId]);

  const activePockets = useMemo(() => {
    return (data.canonical?.pockets || []).filter(p => !p.archived);
  }, [data.canonical?.pockets]);

  const categories = useMemo(() => {
    return data.canonical?.categories || [];
  }, [data.canonical?.categories]);

  // Matrix calculation
  const matrix = useMemo(() => {
    if (!currentSemester) return { periods: [], rows: [], stats: { totalCollectedMinor: '0', totalArrearsMinor: '0', activePeriodsCount: 0, totalCrewCount: 0, fullyPaidCrewCount: 0, partiallyPaidCrewCount: 0, unpaidCrewCount: 0 } };
    return calculateKasKruMatrix(currentSemester, crewMembers, records, operational?.feeDueDay);
  }, [currentSemester, records, crewMembers, operational?.feeDueDay]);

  // Filtered rows
  const visibleRows = useMemo(() => {
    return matrix.rows.filter(row => {
      const matchSearch =
        row.crew.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.crew.ptv_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.crew.division.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      if (filterStatus === 'lunas') return row.isAllPaid;
      if (filterStatus === 'belum') return !row.isAllPaid;
      if (filterStatus === 'tunggakan') return BigInt(row.arrearsMinor) > 0n;
      return true;
    });
  }, [matrix.rows, searchQuery, filterStatus]);

  const handleOpenPayment = (ptvId: string, preselectedPeriod?: string) => {
    setSelectedCrewPtvId(ptvId);
    let initialPeriods: string[];
    if (preselectedPeriod) {
      initialPeriods = [preselectedPeriod];
    } else {
      // Default to current month or first unpaid
      const cur = getCurrentPeriodMonth();
      initialPeriods = matrix.periods.includes(cur) ? [cur] : [matrix.periods[0] || ''];
    }
    setSelectedPeriods(initialPeriods);
    const feeBig = BigInt(currentSemester?.monthlyFeeMinor || '2500000');
    setCustomPaymentRupiah((Number(feeBig * BigInt(initialPeriods.length)) / 100).toString());
    setPaymentPocketId(activePockets[0]?.id || '');
    setPaymentMethod('cash');
    setPaymentNotes('');
    setPaymentError('');
    setPaymentSuccess('');
    setActiveModal('bayar');
  };

  const togglePeriodSelection = (period: string) => {
    setSelectedPeriods(prev => {
      const next = prev.includes(period) ? prev.filter(p => p !== period) : [...prev, period].sort();
      const feeBig = BigInt(currentSemester?.monthlyFeeMinor || '2500000');
      setCustomPaymentRupiah((Number(feeBig * BigInt(next.length)) / 100).toString());
      return next;
    });
  };

  const calculatedTotalFeeMinor = useMemo(() => {
    if (!currentSemester) return '0';
    const feeBig = BigInt(currentSemester.monthlyFeeMinor || '2500000');
    return (feeBig * BigInt(selectedPeriods.length)).toString();
  }, [currentSemester, selectedPeriods]);

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCrewPtvId) return;
    if (selectedPeriods.length === 0) {
      setPaymentError('Pilih minimal satu periode bulan untuk dibayar.');
      return;
    }
    const crew = crewMembers.find(c => c.ptv_id === selectedCrewPtvId);
    if (!crew) return;

    setSubmittingPayment(true);
    setPaymentError('');
    setPaymentSuccess('');

    const cleanAmount = customPaymentRupiah.replace(/\D/g, '');
    const amountMinor = cleanAmount && Number(cleanAmount) > 0
      ? (BigInt(cleanAmount) * 100n).toString()
      : calculatedTotalFeeMinor;

    try {
      await recordKasKruPayment(
        {
          ptvId: crew.ptv_id,
          crewName: crew.full_name,
          semesterId: currentSemester.id,
          selectedPeriods,
          amountMinor,
          pocketId: paymentPocketId,
          paymentDate,
          method: paymentMethod,
          notes: paymentNotes,
        },
        {
          pockets: data.canonical?.pockets || [],
          categories,
          canManage: data.canManage,
          existingRecords: records,
        }
      );

      setRecords(getStoredRecords());
      setPaymentSuccess(
        `Pembayaran iuran ${crew.full_name} (${selectedPeriods.join(', ')}) berhasil dicatat!`
      );
      onRefresh?.();
      setTimeout(() => {
        setActiveModal(null);
        setPaymentSuccess('');
      }, 1200);
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : 'Gagal mencatat pembayaran.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleConfirmReversal = () => {
    if (!reversalRecordId) return;
    try {
      reverseKasKruRecord(reversalRecordId, reversalReason, records);
      setRecords(getStoredRecords());
      setActiveModal(null);
      setReversalRecordId('');
      setReversalReason('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal membatalkan pembayaran.');
    }
  };

  const handleOpenExemption = (ptvId: string, period?: string) => {
    setExemptionCrewPtvId(ptvId);
    setExemptionPeriod(period || currentSemester?.startDate.slice(0, 7) || getCurrentPeriodMonth());
    setExemptionReason('');
    setExemptionError('');
    setActiveModal('exemption');
  };

  const handleConfirmExemption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exemptionReason.trim()) {
      setExemptionError('Alasan pembebasan iuran wajib diisi.');
      return;
    }
    const crew = crewMembers.find(c => c.ptv_id === exemptionCrewPtvId);
    try {
      const res = waiveKasKruFee(
        {
          semesterId: selectedSemesterId,
          ptvId: exemptionCrewPtvId,
          crewName: crew?.full_name || exemptionCrewPtvId,
          period: exemptionPeriod,
          reason: exemptionReason,
        },
        records
      );
      setRecords(res.updatedList);
      setActiveModal(null);
    } catch (err: unknown) {
      setExemptionError(err instanceof Error ? err.message : 'Gagal membebaskan iuran.');
    }
  };

  return (
    <div className="finance-section-container">
      {crewLoading && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: 'var(--bg-surface-2, rgba(11, 42, 74, 0.04))',
            borderRadius: 'var(--ptv-curve-pill, 9999px)',
            marginBottom: '10px',
            fontSize: '12px',
            color: 'var(--ink2)',
          }}
        >
          <RefreshCw size={13} className="animate-spin" />
          <span>Memperbarui direktori Kru dari Staging…</span>
        </div>
      )}
      {crewError && (
        <div
          role="alert"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--ptv-curve-pill, 9999px)',
            marginBottom: '10px',
            fontSize: '12px',
            color: 'var(--danger, #ef4444)',
          }}
        >
          <AlertCircle size={13} />
          <span>Data kru tidak dapat dimuat: {crewError}</span>
        </div>
      )}
      {/* 1. HEADER & HERO WITH EXACT COMPLIANCE STRINGS */}
      <div className="finance-section-hero">
        <div className="hero-icon-wrap kru">
          <Users size={24} />
        </div>
        <div>
          <h2>Kas Kru &amp; Iuran Bulanan</h2>
          <p>
            Catatan kontribusi internal anggota per periode bulan. Kas Kru dikelola terpisah dari Kas Utama Studio.
          </p>
        </div>
      </div>

      {/* 2. STATS SUMMARY (SUBSTATS ROW - TEST IDENTIFIER) */}
      <div className="finance-substats-row">
        <div className="finance-bento-card">
          <div className="bento-header">
            <span className="bento-icon-wrap pocket-icon">
              <Users size={16} />
            </span>
            <span className="bento-label">Total Kas Kru Tercatat</span>
          </div>
          <div className="bento-value">
            {formatMinor(matrix.stats.totalCollectedMinor)}
          </div>
          <div className="bento-footer">
            <span className="bento-count">
              {records.filter(r => r.semesterId === currentSemester?.id && r.status === 'lunas').length} pembayaran lunas tercatat
            </span>
          </div>
        </div>

        <div className="finance-bento-card">
          <div className="bento-header">
            <span className="bento-icon-wrap income-icon">
              <CheckCircle2 size={16} />
            </span>
            <span className="bento-label">Status Iuran</span>
          </div>
          <div className="bento-value">
            {matrix.stats.fullyPaidCrewCount} Lunas
          </div>
          <div className="bento-footer">
            <span className="bento-count" style={{ color: BigInt(matrix.stats.totalArrearsMinor) > 0n ? 'var(--fin-red-dark)' : 'inherit' }}>
              {matrix.stats.unpaidCrewCount + matrix.stats.partiallyPaidCrewCount} Belum Lunas
              {BigInt(matrix.stats.totalArrearsMinor) > 0n && ` · Tunggakan: ${formatMinor(matrix.stats.totalArrearsMinor)}`}
            </span>
          </div>
        </div>
      </div>

      {/* 3. SEMESTER SELECTOR & TOOLBAR */}
      <div className="finance-modern-toolbar" style={{ marginTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label htmlFor="semester-select" style={{ fontSize: '13px', fontWeight: 650, color: 'var(--ink)' }}>
            <Calendar size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            Semester:
          </label>
          <select
            id="semester-select"
            className="finance-select"
            value={selectedSemesterId}
            onChange={e => setSelectedSemesterId(e.target.value)}
            style={{ minWidth: '220px', padding: '6px 12px', fontSize: '13px' }}
          >
            {semesters.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.isActive ? '(Aktif)' : '(Historis)'}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-search-wrap">
          <Search size={15} className="search-icon" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama kru, PTV-ID, divisi..."
            className="toolbar-search-input"
          />
        </div>
      </div>

      {/* 4. FILTER PILLS (TEST COMPLIANCE: 'Semua Periode', 'Lunas', 'Belum Lunas') */}
      <div className="finance-filter-pills-row">
        <button
          type="button"
          className={`filter-pill ${filterStatus === 'all' ? 'active' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          Semua Periode ({matrix.rows.length})
        </button>
        <button
          type="button"
          className={`filter-pill ${filterStatus === 'lunas' ? 'active' : ''}`}
          onClick={() => setFilterStatus('lunas')}
        >
          Lunas ({matrix.stats.fullyPaidCrewCount})
        </button>
        <button
          type="button"
          className={`filter-pill ${filterStatus === 'belum' ? 'active' : ''}`}
          onClick={() => setFilterStatus('belum')}
        >
          Belum Lunas ({matrix.stats.unpaidCrewCount + matrix.stats.partiallyPaidCrewCount})
        </button>
        <button
          type="button"
          className={`filter-pill ${filterStatus === 'tunggakan' ? 'active' : ''}`}
          onClick={() => setFilterStatus('tunggakan')}
        >
          Ada Tunggakan ({matrix.rows.filter(r => BigInt(r.arrearsMinor) > 0n).length})
        </button>
      </div>

      {/* 5. DESKTOP VIEW: COMPACT STICKY MATRIX TABLE */}
      <div className="finance-matrix-desktop-container">
        <div className="finance-matrix-scroll-wrap">
          <table className="finance-matrix-table">
            <thead>
              <tr>
                <th className="sticky-col header-col-crew">Kru PTVPRO</th>
                {matrix.periods.map(period => (
                  <th key={period} className="header-col-period">
                    <div>{period}</div>
                    {currentSemester && (
                      <div style={{ fontSize: '10.5px', fontWeight: 650, color: 'var(--ink3)', marginTop: '2px' }}>
                        {formatMinor(getSemesterPeriodFeeMinor(currentSemester, period))}
                      </div>
                    )}
                  </th>
                ))}
                <th className="header-col-summary">Status Semester</th>
                {data.canManage && <th className="sticky-col-right header-col-action">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(row => {
                const hasArrears = BigInt(row.arrearsMinor) > 0n;
                return (
                  <tr key={row.crew.id} className={hasArrears ? 'row-has-arrears' : ''}>
                    <td className="sticky-col cell-crew-info">
                      <div className="matrix-crew-box">
                        {row.crew.foto_url ? (
                          <img src={row.crew.foto_url} alt="" className="matrix-crew-avatar" />
                        ) : (
                          <div className="matrix-crew-avatar-placeholder">
                            {row.crew.full_name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <strong className="matrix-crew-name">{row.crew.full_name}</strong>
                          <div className="matrix-crew-sub">
                            <code>{row.crew.ptv_id}</code> · {row.crew.division}
                          </div>
                        </div>
                      </div>
                    </td>

                    {matrix.periods.map(period => {
                      const cell = row.periods[period];
                      const isPaid = cell?.status === 'lunas';
                      const isPartial = cell?.status === 'sebagian';
                      const isExempt = cell?.status === 'dikecualikan';
                      return (
                        <td key={period} className="cell-matrix-period">
                          <button
                            type="button"
                            className={`matrix-status-cell-btn ${cell?.status || 'belum'}`}
                            onClick={() => {
                              if (data.canManage && !isPaid && !isExempt) {
                                handleOpenPayment(row.crew.ptv_id, period);
                              } else if (cell?.record && data.canManage) {
                                setReversalRecordId(cell.record.id);
                                setReversalReason('');
                                setActiveModal('reversal');
                              }
                            }}
                            title={
                              isPaid
                                ? `Lunas: ${formatMinor(cell.paidAmountMinor)} (Klik untuk opsi batalkan)`
                                : isPartial
                                ? `Cicilan: ${formatMinor(cell.paidAmountMinor)} dari ${formatMinor(cell.amountMinor)}`
                                : isExempt
                                ? `Dikecualikan / Bebas Iuran Resmi (${cell.record?.notes || 'Dispensasi resmi'})`
                                : `Belum Bayar (Klik untuk catat pembayaran)`
                            }
                          >
                            {isPaid ? (
                              <CheckCircle2 size={14} className="icon-lunas" />
                            ) : isPartial ? (
                              <Clock size={14} className="icon-sebagian" />
                            ) : isExempt ? (
                              <ShieldCheck size={14} className="icon-dikecualikan" />
                            ) : (
                              <span className="dot-belum" />
                            )}
                            <span className="matrix-cell-text">
                              {isPaid ? 'Lunas' : isPartial ? 'Sebagian' : isExempt ? 'Bebas' : 'Belum'}
                            </span>
                          </button>
                        </td>
                      );
                    })}

                    <td className="cell-summary-status">
                      <div className="summary-status-wrap">
                        <span className={`kru-status-badge ${row.isAllPaid ? 'lunas' : 'belum'}`}>
                          {row.isAllPaid ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {row.isAllPaid ? 'Lunas' : 'Belum Lunas'}
                        </span>
                        {hasArrears && (
                          <span className="arrears-warning-tag" title="Tunggakan periode lewat">
                            Tunggakan: {formatMinor(row.arrearsMinor)}
                          </span>
                        )}
                      </div>
                    </td>

                    {data.canManage && (
                      <td className="sticky-col-right cell-action">
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <Button
                            shape="pill"
                            size="sm"
                            variant={row.isAllPaid ? 'secondary' : 'primary'}
                            onClick={() => handleOpenPayment(row.crew.ptv_id)}
                          >
                            + Bayar
                          </Button>
                          <Button
                            shape="pill"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenExemption(row.crew.ptv_id)}
                            title="Bebaskan kewajiban iuran periode tertentu untuk kru ini"
                          >
                            Bebaskan
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. MOBILE ALTERNATIVE VIEW: CARDS GRID (TEST COMPLIANCE: 'finance-kru-cards-grid') */}
      <div className="finance-kru-cards-grid">
        {visibleRows.map(row => {
          const hasArrears = BigInt(row.arrearsMinor) > 0n;
          return (
            <div key={row.crew.id} className="finance-kru-card">
              <div className="kru-card-top">
                <div className="kru-period-wrap">
                  <span className="kru-period-label">{row.crew.ptv_id} · {row.crew.division}</span>
                  <strong className="kru-period-name">{row.crew.full_name}</strong>
                </div>
                <span className={`kru-status-badge ${row.isAllPaid ? 'lunas' : 'belum'}`}>
                  {row.isAllPaid ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                  {row.isAllPaid ? 'Lunas' : 'Belum Lunas'}
                </span>
              </div>

              {/* Grid mini periode per kru */}
              <div className="mobile-kru-periods-row">
                {matrix.periods.map(period => {
                  const cell = row.periods[period];
                  const isLunas = cell?.status === 'lunas';
                  return (
                    <span
                      key={period}
                      className={`mobile-period-pill ${cell?.status || 'belum'}`}
                      title={`${period}: ${cell?.status || 'belum'}`}
                    >
                      {period.slice(5)} {isLunas ? '✓' : ''}
                    </span>
                  );
                })}
              </div>

              <div className="kru-card-bottom">
                <div>
                  <span className="kru-amount-label">
                    {hasArrears ? 'Tunggakan Aktif' : 'Nominal Iuran Bulanan'}
                  </span>
                  <strong
                    className="kru-amount-value"
                    style={{ color: hasArrears ? 'var(--fin-red-dark)' : 'inherit' }}
                  >
                    {hasArrears ? formatMinor(row.arrearsMinor) : formatMinor(currentSemester?.monthlyFeeMinor || '2500000')}
                  </strong>
                </div>

                {data.canManage && (
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <Button
                      shape="pill"
                      size="sm"
                      variant={row.isAllPaid ? 'secondary' : 'primary'}
                      onClick={() => handleOpenPayment(row.crew.ptv_id)}
                    >
                      + Bayar Iuran
                    </Button>
                    <Button
                      shape="pill"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenExemption(row.crew.ptv_id)}
                      title="Bebaskan kewajiban iuran untuk kru ini"
                    >
                      Bebaskan
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {visibleRows.length === 0 && (
        <Card standard="r03">
          <div className="finance-empty">
            <div className="finance-empty-icon">
              <AlertCircle size={32} />
            </div>
            <h3>Tidak Ada Catatan yang Sesuai</h3>
            <p>Sesuaikan pencarian atau filter status di atas.</p>
          </div>
        </Card>
      )}

      {/* 7. MODAL PEMBAYARAN IURAN */}
      {activeModal === 'bayar' && (
        <FinanceDialog
          title="Konfirmasi Pembayaran Kas Kru"
          onClose={() => setActiveModal(null)}
        >
          <form className="finance-form" onSubmit={handleSubmitPayment}>
            {paymentError && <div className="dialog-alert-box error"><AlertCircle size={16} /><p>{paymentError}</p></div>}
            {paymentSuccess && <div className="dialog-alert-box success"><Check size={16} /><p>{paymentSuccess}</p></div>}

            <div className="finance-form-grid">
              <div>
                <SearchableCrewSelect
                  crewMembers={activeBillableCrew}
                  selectedPtvId={selectedCrewPtvId}
                  onSelect={setSelectedCrewPtvId}
                  label="Kru Anggota"
                  placeholder="Ketik nama atau PTV-ID kru..."
                  required
                />
              </div>

              <div>
                <label className="finance-field-label">Tanggal Pembayaran</label>
                <Input
                  standard="r03"
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <fieldset>
              <legend>Pilih Periode Iuran (Bisa Beberapa Bulan Sekaligus)</legend>
              <div className="periods-checkbox-grid">
                {matrix.periods.map(p => {
                  const isChecked = selectedPeriods.includes(p);
                  return (
                    <label
                      key={p}
                      className={`period-checkbox-card ${isChecked ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePeriodSelection(p)}
                      />
                      <span>{p}</span>
                    </label>
                  );
                })}
              </div>
              <p className="finance-footnote" style={{ marginTop: '8px' }}>
                Total {selectedPeriods.length} bulan terpilih · Tagihan per bulan: {formatMinor(currentSemester?.monthlyFeeMinor || '2500000')}
              </p>
            </fieldset>

            <div className="finance-form-grid">
              <div>
                <label className="finance-field-label">Kantong Penerima (Ledger)</label>
                <select
                  className="finance-select"
                  value={paymentPocketId}
                  onChange={e => setPaymentPocketId(e.target.value)}
                  required
                >
                  {activePockets.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatMinor(p.balanceMinor)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="finance-field-label">Metode Pembayaran</label>
                <select
                  className="finance-select"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as any)}
                >
                  <option value="cash">Tunai (Cash)</option>
                  <option value="transfer">Transfer Bank</option>
                  <option value="qris">QRIS Studio</option>
                </select>
              </div>
            </div>

            <Input
              standard="r03"
              label="Nominal Pembayaran (Rp)"
              inputMode="numeric"
              value={customPaymentRupiah}
              onChange={e => setCustomPaymentRupiah(e.target.value)}
              placeholder="Nominal iuran yang disetorkan"
              required
              hint={`Nominal standar (${selectedPeriods.length} bulan): ${formatMinor(calculatedTotalFeeMinor)} · Dapat disesuaikan jika cicilan/parsial`}
            />

            <Input
              standard="r03"
              label="Catatan Pembayaran (Opsional)"
              value={paymentNotes}
              onChange={e => setPaymentNotes(e.target.value)}
              placeholder="Contoh: Titip lewat bendahara studio"
            />

            <div className="payment-summary-box">
              <div className="summary-line">
                <span>Total Nominal Penerimaan</span>
                <strong>
                  {formatMinor(
                    customPaymentRupiah && Number(customPaymentRupiah.replace(/\D/g, '')) > 0
                      ? (BigInt(customPaymentRupiah.replace(/\D/g, '')) * 100n).toString()
                      : calculatedTotalFeeMinor
                  )}
                </strong>
              </div>
              <p className="summary-desc">
                Penerimaan dana otomatis dicatat ke transaksi canonical ledger pemasukan kategori <strong>Iuran Kru</strong> pada Kantong terpilih.
              </p>
            </div>

            <footer className="finance-form-footer">
              <Button shape="pill" variant="secondary" type="button" onClick={() => setActiveModal(null)}>
                Batal
              </Button>
              <Button
                shape="pill"
                variant="primary"
                type="submit"
                disabled={submittingPayment || selectedPeriods.length === 0}
              >
                {submittingPayment ? 'Memproses Ledger...' : 'Konfirmasi Pembayaran'}
              </Button>
            </footer>
          </form>
        </FinanceDialog>
      )}

      {/* 8. MODAL REVERSAL / PEMBATALAN PEMBAYARAN */}
      {activeModal === 'reversal' && (
        <FinanceDialog
          title="Pembatalan / Koreksi Pembayaran Kas Kru"
          onClose={() => setActiveModal(null)}
        >
          <div className="finance-form">
            <p>
              Anda akan membatalkan status pembayaran iuran ini. Pembatalan dilakukan secara transparan melalui mekanisme
              <strong> reversal</strong> (bukan penghapusan destruktif row database).
            </p>
            <Input
              standard="r03"
              label="Alasan Pembatalan / Koreksi"
              placeholder="Contoh: Salah entri kru / transfer gagal"
              value={reversalReason}
              onChange={e => setReversalReason(e.target.value)}
              required
            />
            <footer className="finance-form-footer">
              <Button shape="pill" variant="secondary" type="button" onClick={() => setActiveModal(null)}>
                Batal
              </Button>
              <Button shape="pill" variant="primary" onClick={handleConfirmReversal}>
                Konfirmasi Reversal
              </Button>
            </footer>
          </div>
        </FinanceDialog>
      )}

      {/* 9. MODAL PEMBEBASAN IURAN INDIVIDUAL (DIKECUALIKAN) */}
      {activeModal === 'exemption' && (
        <FinanceDialog
          title="Pembebasan Iuran Kas Kru (Dispensasi Resmi)"
          onClose={() => setActiveModal(null)}
        >
          <form className="finance-form" onSubmit={handleConfirmExemption}>
            {exemptionError && (
              <div className="dialog-alert-box error">
                <AlertCircle size={16} />
                <p>{exemptionError}</p>
              </div>
            )}

            <p>
              Fitur ini memberikan dispensasi resmi (bebas iuran) bagi anggota kru untuk periode tertentu tanpa memicu mutasi buku besar kas studio.
            </p>

            <div className="finance-form-grid">
              <div>
                <label className="finance-field-label">Kru Anggota</label>
                <select
                  className="finance-select"
                  value={exemptionCrewPtvId}
                  onChange={e => setExemptionCrewPtvId(e.target.value)}
                  required
                >
                  <option value="">Pilih Kru</option>
                  {activeBillableCrew.map(c => (
                    <option key={c.id} value={c.ptv_id}>
                      {c.full_name} ({c.ptv_id}) — {c.division}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="finance-field-label">Periode yang Dibebaskan</label>
                <select
                  className="finance-select"
                  value={exemptionPeriod}
                  onChange={e => setExemptionPeriod(e.target.value)}
                  required
                >
                  {matrix.periods.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Input
              standard="r03"
              label="Alasan Pembebasan Iuran"
              placeholder="Contoh: Kru magang / dispensasi khusus pembina studio"
              value={exemptionReason}
              onChange={e => setExemptionReason(e.target.value)}
              required
            />

            <footer className="finance-form-footer">
              <Button shape="pill" variant="secondary" type="button" onClick={() => setActiveModal(null)}>
                Batal
              </Button>
              <Button shape="pill" variant="primary" type="submit">
                Konfirmasi Pembebasan
              </Button>
            </footer>
          </form>
        </FinanceDialog>
      )}
    </div>
  );
}
