import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  ArrowDownLeft,
  Ban,
  History,
  X,
  Loader2,
  Banknote,
  Building2,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@shared/components/Button';
import type { FinanceSnapshot } from './financeFoundation';
import type { FinanceOperationalData } from './financeOperationalData';
import type { PiutangRecord } from './piutangTypes';
import {
  calculateLoanStatus,
  calculatePiutangStats,
  createPiutang,
  recordLoanRepayment,
  cancelPiutang,
} from './piutangService';
import { submitOperationalReversalAtomic } from './financeOperationalCloudService';
import { TEST_POCKET_IDS } from './financeCanonical';

interface Finance3PiutangProps {
  data: FinanceSnapshot;
  operationalData: FinanceOperationalData | null;
  operationalLoading?: boolean;
  operationalError?: string;
  onRetryOperational?: () => void;
  onRefreshAll?: () => void;
}

export function Finance3Piutang({
  data,
  operationalData,
  operationalLoading = false,
  operationalError = '',
  onRetryOperational,
  onRefreshAll,
}: Finance3PiutangProps) {
  const canManage = data.canManage;
  const pockets = (data.canonical.state === 'available' ? data.canonical.pockets || [] : []).filter(
    p => !TEST_POCKET_IDS.has(p.id)
  );
  const categories = data.canonical.state === 'available' ? data.canonical.categories || [] : [];

  const [localLoans, setLocalLoans] = useState<PiutangRecord[] | null>(null);
  useEffect(() => {
    setLocalLoans(null);
  }, [operationalData]);

  const loans: PiutangRecord[] = useMemo(() => {
    if (localLoans) return localLoans;
    return operationalData?.loans || [];
  }, [localLoans, operationalData]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'aktif' | 'overdue' | 'lunas' | 'dibatalkan'>('all');
  const [borrowerTypeFilter, setBorrowerTypeFilter] = useState<'all' | 'kru' | 'eksternal'>('all');
  const [notice, setNotice] = useState('');

  // Modal Catat Piutang Baru
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [borrowerType, setBorrowerType] = useState<'kru' | 'eksternal'>('kru');
  const [borrowerId, setBorrowerId] = useState('PTV-001');
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerContact, setBorrowerContact] = useState('');
  const [borrowerInstitution, setBorrowerInstitution] = useState('');
  const [principalRupiah, setPrincipalRupiah] = useState('');
  const [interestType, setInterestType] = useState<'none' | 'flat'>('none');
  const [interestRate, setInterestRate] = useState('0');
  const [disbursedOn, setDisbursedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [fromPocketId, setFromPocketId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [loanNotes, setLoanNotes] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Modal Bayar / Cicil Tagihan
  const [repayLoan, setRepayLoan] = useState<PiutangRecord | null>(null);
  const [repayMode, setRepayMode] = useState<'full' | 'partial'>('full');
  const [repayRupiah, setRepayRupiah] = useState('');
  const [repayDate, setRepayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [repayMethod, setRepayMethod] = useState<'cash' | 'transfer' | 'qris'>('transfer');
  const [repayPocketId, setRepayPocketId] = useState('');
  const [repayNotes, setRepayNotes] = useState('');
  const [repayLoading, setRepayLoading] = useState(false);
  const [repayError, setRepayError] = useState('');

  // Modal Detail & Riwayat Pelunasan
  const [detailLoan, setDetailLoan] = useState<PiutangRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [detailError, setDetailError] = useState('');

  const stats = useMemo(() => calculatePiutangStats(loans), [loans]);

  const filteredLoans = useMemo(() => {
    return loans.filter(loan => {
      const liveStatus = calculateLoanStatus(loan);
      if (statusFilter !== 'all' && liveStatus !== statusFilter) return false;
      if (borrowerTypeFilter !== 'all' && loan.borrowerType !== borrowerTypeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        return (
          loan.borrowerName.toLowerCase().includes(q) ||
          loan.purpose.toLowerCase().includes(q) ||
          (loan.borrowerId || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [loans, statusFilter, borrowerTypeFilter, search]);

  const openCreateModal = () => {
    setBorrowerType('kru');
    setBorrowerId('PTV-001');
    setBorrowerName('');
    setBorrowerContact('');
    setBorrowerInstitution('');
    setPrincipalRupiah('');
    setInterestType('none');
    setInterestRate('0');
    setPurpose('');
    setLoanNotes('');
    const main = pockets.find(p => !p.archived && p.name.includes('Kas Utama')) || pockets[0];
    setFromPocketId(main?.id || '');
    const defaultDue = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    setDueDate(defaultDue);
    setCreateError('');
    setIsCreateOpen(true);
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    const cleanPrincipal = parseInt(principalRupiah.replace(/\D/g, ''), 10) || 0;
    if (cleanPrincipal <= 0) {
      setCreateError('Nominal pokok piutang harus lebih dari Rp 0.');
      return;
    }

    try {
      setCreateLoading(true);
      const res = await createPiutang(
        {
          borrowerType,
          borrowerId: borrowerType === 'kru' ? borrowerId.trim() : undefined,
          borrowerName: borrowerName.trim(),
          borrowerContact: borrowerContact.trim() || '-',
          borrowerInstitution: borrowerType === 'eksternal' ? borrowerInstitution.trim() : undefined,
          principalMinor: String(BigInt(cleanPrincipal) * 100n),
          interestType,
          interestRatePercent: interestType === 'flat' ? Number(interestRate) || 0 : 0,
          disbursedOn,
          dueDate: dueDate || undefined,
          disbursedFromPocketId: fromPocketId || pockets[0]?.id || '60e8d033-2794-4219-a960-c56bedca0111',
          purpose: purpose.trim(),
          notes: loanNotes.trim() || undefined,
        },
        {
          pockets,
          categories,
          canManage,
          existingLoans: loans,
        }
      );

      setLocalLoans([res.loan, ...loans]);
      setNotice(`Piutang atas nama '${res.loan.borrowerName}' berhasil dicatat.`);
      setIsCreateOpen(false);
      onRefreshAll?.();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Gagal mencatat piutang baru.');
    } finally {
      setCreateLoading(false);
    }
  };

  const openRepayModal = (loan: PiutangRecord) => {
    const remRupiah = Math.round((Number(loan.remainingMinor) || 0) / 100);
    setRepayLoan(loan);
    setRepayMode('full');
    setRepayRupiah(remRupiah.toLocaleString('id-ID'));
    setRepayDate(new Date().toISOString().slice(0, 10));
    setRepayMethod('transfer');
    const main = pockets.find(p => !p.archived && p.name.includes('Kas Utama')) || pockets[0];
    setRepayPocketId(main?.id || '');
    setRepayNotes('');
    setRepayError('');
  };

  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayLoan) return;
    setRepayError('');
    const cleanPay = parseInt(repayRupiah.replace(/\D/g, ''), 10) || 0;
    if (cleanPay <= 0) {
      setRepayError('Nominal pelunasan/cicilan harus lebih dari Rp 0.');
      return;
    }

    try {
      setRepayLoading(true);
      const res = await recordLoanRepayment(
        {
          loanId: repayLoan.id,
          amountMinor: String(BigInt(cleanPay) * 100n),
          paidOn: repayDate,
          toPocketId: repayPocketId || pockets[0]?.id || '60e8d033-2794-4219-a960-c56bedca0111',
          method: repayMethod,
          notes: repayNotes.trim() || (repayMode === 'full' ? 'Pelunasan penuh piutang' : 'Cicilan sebagian piutang'),
        },
        {
          pockets,
          categories,
          canManage,
          existingLoans: loans,
        }
      );

      setLocalLoans(loans.map(l => (l.id === res.loan.id ? res.loan : l)));
      setNotice(`Pembayaran tagihan '${repayLoan.borrowerName}' sebesar Rp ${cleanPay.toLocaleString('id-ID')} berhasil dicatat ke kas.`);
      setRepayLoan(null);
      onRefreshAll?.();
    } catch (err) {
      setRepayError(err instanceof Error ? err.message : 'Gagal mencatat pembayaran piutang.');
    } finally {
      setRepayLoading(false);
    }
  };

  const handleCancelLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailLoan) return;
    if (!cancelReason.trim()) {
      setDetailError('Alasan pembatalan piutang wajib diisi.');
      return;
    }
    try {
      setDetailError('');
      try {
        await submitOperationalReversalAtomic('loan_disbursement', detailLoan.id, cancelReason.trim());
      } catch {
        // Fallback local cancel
      }
      const res = cancelPiutang(detailLoan.id, cancelReason.trim(), loans);
      setLocalLoans(res.updatedList);
      setNotice(`Piutang '${detailLoan.borrowerName}' telah dibatalkan.`);
      setDetailLoan(null);
      onRefreshAll?.();
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Gagal membatalkan piutang.');
    }
  };

  const totalRemainingRupiah = (Number(stats.totalRemainingMinor) || 0) / 100;
  const totalCollectedRupiah = (Number(stats.totalCollectedMinor) || 0) / 100;
  const totalPrincipalRupiah = (Number(stats.totalPrincipalMinor) || 0) / 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {operationalError && (
        <div
          className="finance3-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            borderColor: '#fca5a5',
            background: '#fef2f2',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', fontSize: '13px' }}>
            <AlertCircle size={18} />
            <div>
              <b>Gagal Memuat Data Piutang & Tagihan:</b> {operationalError}
            </div>
          </div>
          {onRetryOperational && (
            <Button size="sm" shape="pill" variant="secondary" onClick={onRetryOperational}>
              <RefreshCw size={13} /> Coba Lagi
            </Button>
          )}
        </div>
      )}

      {notice && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: 'var(--ptv-curve-md, 12px)',
            background: 'var(--ok-bg, #e1f5ee)',
            color: 'var(--ok, #0f7a5a)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <span>✓ {notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="finance3-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header */}
        <div className="finance3-card-header">
          <div>
            <h2 className="finance3-card-title">
              <FileText size={18} style={{ color: 'var(--b-700, #0b5fbf)' }} /> Piutang & Pengelolaan Tagihan
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--muted, #6e8cae)' }}>
              Daftar piutang kru maupun pihak eksternal (`ptv_finance_loans`), jatuh tempo, pencatatan cicilan/pelunasan, dan riwayat pembayaran.
            </p>
          </div>

          {canManage && (
            <Button
              size="sm"
              shape="pill"
              variant="primary"
              onClick={openCreateModal}
              style={{ background: '#0b5fbf', borderColor: '#0b5fbf' }}
            >
              <Plus size={14} /> + Catat Piutang Baru
            </Button>
          )}
        </div>

        {/* Pemisahan Akuntansi Piutang dari Pemasukan Kas Aktual */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--ptv-curve-md, 12px)',
            background: '#edf4ff',
            border: '1px solid #dcebff',
            color: '#0b5fbf',
            fontSize: '12px',
            lineHeight: 1.45,
          }}
        >
          <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '5px' }} />
          <b>Prinsip Akuntansi Piutang:</b> Tagihan piutang aktif tidak dicampurkan sebagai pemasukan kas aktual sebelum pembayaran cicilan atau pelunasan benar-benar tercatat masuk ke kantong studio.
        </div>

        {/* Ringkasan Piutang Aktif & Lunas */}
        <div className="finance3-hero-metrics" style={{ borderTop: 'none', paddingTop: 0 }}>
          <div className="finance3-metric-pill">
            <span className="finance3-metric-label">Sisa Tagihan Piutang Aktif</span>
            <span className="finance3-metric-value expense">
              Rp {totalRemainingRupiah.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="finance3-metric-pill">
            <span className="finance3-metric-label">Total Pelunasan Diterima (Kas Masuk)</span>
            <span className="finance3-metric-value income">
              Rp {totalCollectedRupiah.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="finance3-metric-pill">
            <span className="finance3-metric-label">Total Pokok Dicairkan</span>
            <span className="finance3-metric-value">
              Rp {totalPrincipalRupiah.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="finance3-metric-pill">
            <span className="finance3-metric-label">Status Tagihan (Aktif / Overdue / Lunas)</span>
            <span className="finance3-metric-value net">
              {stats.activeLoansCount} Aktif · {stats.overdueLoansCount} Jatuh Tempo · {stats.fullyPaidLoansCount} Lunas
            </span>
          </div>
        </div>

        {/* Toolbar Pencarian & Filter */}
        <div className="finance3-toolbar">
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted, #6e8cae)',
              }}
            />
            <input
              type="text"
              className="finance3-search-input"
              placeholder="Cari pihak berutang, PTV ID, atau keperluan..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="finance3-filter-group">
            <button
              type="button"
              className={`finance3-filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              Semua ({loans.length})
            </button>
            <button
              type="button"
              className={`finance3-filter-chip ${statusFilter === 'aktif' ? 'active' : ''}`}
              onClick={() => setStatusFilter('aktif')}
            >
              Aktif ({stats.activeLoansCount})
            </button>
            <button
              type="button"
              className={`finance3-filter-chip ${statusFilter === 'overdue' ? 'active' : ''}`}
              onClick={() => setStatusFilter('overdue')}
            >
              Jatuh Tempo ({stats.overdueLoansCount})
            </button>
            <button
              type="button"
              className={`finance3-filter-chip ${statusFilter === 'lunas' ? 'active' : ''}`}
              onClick={() => setStatusFilter('lunas')}
            >
              Lunas ({stats.fullyPaidLoansCount})
            </button>
          </div>

          <select
            aria-label="Filter Jenis Pihak"
            className="finance3-select"
            style={{ width: 'auto', padding: '8px 12px', fontSize: '13px' }}
            value={borrowerTypeFilter}
            onChange={e => setBorrowerTypeFilter(e.target.value as 'all' | 'kru' | 'eksternal')}
          >
            <option value="all">Semua Pihak</option>
            <option value="kru">Kru Internal</option>
            <option value="eksternal">Pihak Eksternal</option>
          </select>
        </div>

        {operationalLoading && (
          <div style={{ fontSize: '12px', color: 'var(--muted, #6e8cae)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={12} className="animate-spin" /> Memuat daftar piutang dan riwayat pelunasan...
          </div>
        )}

        {/* Tabel Daftar Piutang */}
        <div className="finance3-table-wrapper">
          <table className="finance3-table">
            <thead>
              <tr>
                <th>Pihak Berutang</th>
                <th>Keperluan / Tagihan</th>
                <th style={{ width: '125px', textAlign: 'right' }}>Total Tagihan</th>
                <th style={{ width: '125px', textAlign: 'right' }}>Terbayar</th>
                <th style={{ width: '125px', textAlign: 'right' }}>Sisa Tagihan</th>
                <th style={{ width: '120px' }}>Jatuh Tempo</th>
                <th style={{ width: '125px', textAlign: 'center' }}>Status</th>
                <th style={{ width: '175px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted, #6e8cae)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--ink, #0b2a4a)', marginBottom: '4px' }}>
                      Belum ada piutang atau tagihan aktif yang tercatat
                    </div>
                    <div style={{ fontSize: '12px' }}>
                      Seluruh kas studio saat ini berada pada kantong kas tanpa piutang tertunggak. Gunakan tombol <b>+ Catat Piutang Baru</b> jika terdapat pencairan pinjaman atau tagihan baru.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLoans.map(loan => {
                  const liveStatus = calculateLoanStatus(loan);
                  const totalDue = (Number(loan.totalDueMinor) || 0) / 100;
                  const paid = (Number(loan.totalPaidMinor) || 0) / 100;
                  const remaining = (Number(loan.remainingMinor) || 0) / 100;

                  return (
                    <tr key={loan.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--ink, #0b2a4a)' }}>
                          {loan.borrowerName}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--muted, #6e8cae)' }}>
                          {loan.borrowerType === 'kru'
                            ? `Kru · ${loan.borrowerId || 'PTV'}`
                            : `Eksternal · ${loan.borrowerInstitution || loan.borrowerContact || '-'}`}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--ink, #0b2a4a)' }}>{loan.purpose}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted, #6e8cae)' }}>
                          Dicairkan: {loan.disbursedOn} · {loan.payments?.length || 0}x cicilan
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        Rp {totalDue.toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#059669', fontWeight: 700 }}>
                        Rp {paid.toLocaleString('id-ID')}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          color: remaining > 0 ? '#dc2626' : 'var(--muted, #6e8cae)',
                          fontWeight: 700,
                        }}
                      >
                        Rp {remaining.toLocaleString('id-ID')}
                      </td>
                      <td style={{ fontSize: '12.5px', color: liveStatus === 'overdue' ? '#dc2626' : 'var(--muted, #6e8cae)', fontWeight: liveStatus === 'overdue' ? 700 : 500 }}>
                        {loan.dueDate || 'Tanpa Tenggat'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`finance3-badge ${
                            liveStatus === 'lunas'
                              ? 'posted'
                              : liveStatus === 'overdue'
                                ? 'reversed'
                                : 'legacy'
                          }`}
                        >
                          {liveStatus === 'lunas' ? (
                            <>
                              <CheckCircle2 size={12} /> Lunas
                            </>
                          ) : liveStatus === 'overdue' ? (
                            <>
                              <AlertTriangle size={12} /> Jatuh Tempo
                            </>
                          ) : liveStatus === 'dibatalkan' ? (
                            <>Dibatalkan</>
                          ) : (
                            <>
                              <Clock size={12} /> Aktif
                            </>
                          )}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {canManage && liveStatus !== 'lunas' && liveStatus !== 'dibatalkan' && (
                            <Button
                              size="sm"
                              shape="pill"
                              variant="primary"
                              onClick={() => openRepayModal(loan)}
                              style={{ background: '#059669', borderColor: '#059669', fontSize: '11.5px', padding: '4px 10px' }}
                            >
                              <ArrowDownLeft size={12} /> Bayar / Cicil
                            </Button>
                          )}
                          <Button
                            size="sm"
                            shape="pill"
                            variant="secondary"
                            onClick={() => {
                              setCancelReason('');
                              setDetailError('');
                              setDetailLoan(loan);
                            }}
                            style={{ fontSize: '11.5px', padding: '4px 10px' }}
                          >
                            <History size={12} /> Riwayat
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Catat Piutang Baru */}
      {isCreateOpen &&
        createPortal(
          <div className="finance3-modal-backdrop" onClick={() => setIsCreateOpen(false)} role="dialog" aria-modal="true">
            <div className="finance3-modal-surface" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="finance3-modal-header">
                <h3>Catat Piutang / Tagihan Baru</h3>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="finance3-tab-btn"
                  style={{ padding: '4px 8px', minWidth: 'auto' }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateLoan}>
                <div className="finance3-modal-body">
                  {createError && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        borderRadius: 'var(--ptv-curve-md, 12px)',
                        background: 'var(--dang-bg, #fde8e6)',
                        color: 'var(--dang, #b02b23)',
                        fontSize: '13px',
                      }}
                    >
                      <AlertCircle size={16} />
                      <span>{createError}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className={`finance3-filter-chip ${borrowerType === 'kru' ? 'active' : ''}`}
                      style={{ flex: 1 }}
                      onClick={() => setBorrowerType('kru')}
                    >
                      Pihak Kru Internal
                    </button>
                    <button
                      type="button"
                      className={`finance3-filter-chip ${borrowerType === 'eksternal' ? 'active' : ''}`}
                      style={{ flex: 1 }}
                      onClick={() => setBorrowerType('eksternal')}
                    >
                      Pihak Eksternal / Mitra
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="finance3-form-field">
                      <label className="finance3-form-label">Nama Pihak Berutang *</label>
                      <input
                        type="text"
                        className="finance3-input"
                        placeholder="Nama lengkap peminjam..."
                        value={borrowerName}
                        onChange={e => setBorrowerName(e.target.value)}
                        required
                      />
                    </div>

                    {borrowerType === 'kru' ? (
                      <div className="finance3-form-field">
                        <label className="finance3-form-label">PTV ID Kru</label>
                        <input
                          type="text"
                          className="finance3-input"
                          placeholder="Contoh: PTV-001"
                          value={borrowerId}
                          onChange={e => setBorrowerId(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="finance3-form-field">
                        <label className="finance3-form-label">Instansi / Unit</label>
                        <input
                          type="text"
                          className="finance3-input"
                          placeholder="Nama instansi atau organisasi..."
                          value={borrowerInstitution}
                          onChange={e => setBorrowerInstitution(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="finance3-form-field">
                      <label className="finance3-form-label">Nominal Pokok Piutang (Rp) *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="finance3-input"
                        placeholder="0"
                        value={principalRupiah}
                        onChange={e => {
                          const raw = e.target.value.replace(/\D/g, '');
                          setPrincipalRupiah(raw ? parseInt(raw, 10).toLocaleString('id-ID') : '');
                        }}
                        required
                      />
                    </div>

                    <div className="finance3-form-field">
                      <label className="finance3-form-label">Kontak WhatsApp / Telepon *</label>
                      <input
                        type="text"
                        className="finance3-input"
                        placeholder="+62 8..."
                        value={borrowerContact}
                        onChange={e => setBorrowerContact(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="finance3-form-field">
                      <label className="finance3-form-label">Tanggal Pencairan *</label>
                      <input
                        type="date"
                        className="finance3-input"
                        value={disbursedOn}
                        onChange={e => setDisbursedOn(e.target.value)}
                        required
                      />
                    </div>

                    <div className="finance3-form-field">
                      <label className="finance3-form-label">Tanggal Jatuh Tempo</label>
                      <input
                        type="date"
                        className="finance3-input"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Kantong Sumber Dana Pencairan *</label>
                    <select
                      className="finance3-select"
                      value={fromPocketId}
                      onChange={e => setFromPocketId(e.target.value)}
                      required
                    >
                      {pockets
                        .filter(p => !p.archived)
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Saldo: Rp {((Number(p.balanceMinor) || 0) / 100).toLocaleString('id-ID')})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Keperluan / Keterangan Tagihan *</label>
                    <input
                      type="text"
                      className="finance3-input"
                      placeholder="Contoh: Talangan produksi acara, pinjaman darurat kru..."
                      value={purpose}
                      onChange={e => setPurpose(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="finance3-modal-footer">
                  <Button type="button" variant="secondary" shape="pill" onClick={() => setIsCreateOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" variant="primary" shape="pill" disabled={createLoading}>
                    {createLoading ? <Loader2 size={15} className="animate-spin" /> : 'Simpan & Cairkan Piutang'}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Pencatatan Pembayaran Penuh atau Cicilan Sebagian */}
      {repayLoan &&
        createPortal(
          <div className="finance3-modal-backdrop" onClick={() => setRepayLoan(null)} role="dialog" aria-modal="true">
            <div className="finance3-modal-surface" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
              <div className="finance3-modal-header">
                <h3>Catat Pembayaran Piutang: {repayLoan.borrowerName}</h3>
                <button
                  type="button"
                  onClick={() => setRepayLoan(null)}
                  className="finance3-tab-btn"
                  style={{ padding: '4px 8px', minWidth: 'auto' }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleRepaySubmit}>
                <div className="finance3-modal-body">
                  {repayError && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        borderRadius: 'var(--ptv-curve-md, 12px)',
                        background: 'var(--dang-bg, #fde8e6)',
                        color: 'var(--dang, #b02b23)',
                        fontSize: '13px',
                      }}
                    >
                      <AlertCircle size={16} />
                      <span>{repayError}</span>
                    </div>
                  )}

                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: 'var(--surface-2, #f8fafd)',
                      fontSize: '13px',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Sisa Tagihan Saat Ini:</span>
                    <b style={{ color: '#dc2626' }}>
                      Rp {((Number(repayLoan.remainingMinor) || 0) / 100).toLocaleString('id-ID')}
                    </b>
                  </div>

                  {/* Mode Pelunasan Penuh vs Cicilan Sebagian */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className={`finance3-filter-chip ${repayMode === 'full' ? 'active' : ''}`}
                      style={{ flex: 1 }}
                      onClick={() => {
                        setRepayMode('full');
                        const rem = Math.round((Number(repayLoan.remainingMinor) || 0) / 100);
                        setRepayRupiah(rem.toLocaleString('id-ID'));
                      }}
                    >
                      Pelunasan Penuh (100%)
                    </button>
                    <button
                      type="button"
                      className={`finance3-filter-chip ${repayMode === 'partial' ? 'active' : ''}`}
                      style={{ flex: 1 }}
                      onClick={() => setRepayMode('partial')}
                    >
                      Cicilan Sebagian
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="finance3-form-field">
                      <label className="finance3-form-label">Nominal Pembayaran (Rp) *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="finance3-input"
                        value={repayRupiah}
                        onChange={e => {
                          const raw = e.target.value.replace(/\D/g, '');
                          setRepayRupiah(raw ? parseInt(raw, 10).toLocaleString('id-ID') : '');
                        }}
                        required
                      />
                    </div>

                    <div className="finance3-form-field">
                      <label className="finance3-form-label">Tanggal Diterima *</label>
                      <input
                        type="date"
                        className="finance3-input"
                        value={repayDate}
                        onChange={e => setRepayDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Metode Pembayaran *</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className={`finance3-filter-chip ${repayMethod === 'cash' ? 'active' : ''}`}
                        style={{ flex: 1, display: 'inline-flex', justifyContent: 'center', gap: '6px' }}
                        onClick={() => setRepayMethod('cash')}
                      >
                        <Banknote size={14} /> Tunai
                      </button>
                      <button
                        type="button"
                        className={`finance3-filter-chip ${repayMethod === 'transfer' ? 'active' : ''}`}
                        style={{ flex: 1, display: 'inline-flex', justifyContent: 'center', gap: '6px' }}
                        onClick={() => setRepayMethod('transfer')}
                      >
                        <Building2 size={14} /> Transfer
                      </button>
                      <button
                        type="button"
                        className={`finance3-filter-chip ${repayMethod === 'qris' ? 'active' : ''}`}
                        style={{ flex: 1, display: 'inline-flex', justifyContent: 'center', gap: '6px' }}
                        onClick={() => setRepayMethod('qris')}
                      >
                        <QrCode size={14} /> QRIS
                      </button>
                    </div>
                  </div>

                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Kantong Penerima Dana *</label>
                    <select
                      className="finance3-select"
                      value={repayPocketId}
                      onChange={e => setRepayPocketId(e.target.value)}
                      required
                    >
                      {pockets
                        .filter(p => !p.archived)
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Rp {((Number(p.balanceMinor) || 0) / 100).toLocaleString('id-ID')})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="finance3-form-field">
                    <label className="finance3-form-label">Catatan Pelunasan</label>
                    <input
                      type="text"
                      className="finance3-input"
                      placeholder="Contoh: Cicilan tahap 1 via transfer..."
                      value={repayNotes}
                      onChange={e => setRepayNotes(e.target.value)}
                    />
                  </div>
                </div>

                <div className="finance3-modal-footer">
                  <Button type="button" variant="secondary" shape="pill" onClick={() => setRepayLoan(null)}>
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    shape="pill"
                    disabled={repayLoading}
                    style={{ background: '#059669', borderColor: '#059669' }}
                  >
                    {repayLoading ? <Loader2 size={15} className="animate-spin" /> : 'Simpan Pelunasan'}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Detail & Riwayat Pelunasan */}
      {detailLoan &&
        createPortal(
          <div className="finance3-modal-backdrop" onClick={() => setDetailLoan(null)} role="dialog" aria-modal="true">
            <div className="finance3-modal-surface" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="finance3-modal-header">
                <h3>Rincian & Riwayat Pelunasan: {detailLoan.borrowerName}</h3>
                <button
                  type="button"
                  onClick={() => setDetailLoan(null)}
                  className="finance3-tab-btn"
                  style={{ padding: '4px 8px', minWidth: 'auto' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="finance3-modal-body">
                {detailError && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: 'var(--ptv-curve-md, 12px)',
                      background: 'var(--dang-bg, #fde8e6)',
                      color: 'var(--dang, #b02b23)',
                      fontSize: '13px',
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{detailError}</span>
                  </div>
                )}

                <div
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: 'var(--surface-2, #f8fafd)',
                    fontSize: '13px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                  }}
                >
                  <div>
                    Pihak Berutang: <b>{detailLoan.borrowerName}</b>
                  </div>
                  <div>
                    Keperluan: <b>{detailLoan.purpose}</b>
                  </div>
                  <div>
                    Total Tagihan: <b>Rp {((Number(detailLoan.totalDueMinor) || 0) / 100).toLocaleString('id-ID')}</b>
                  </div>
                  <div>
                    Sudah Terbayar: <b style={{ color: '#059669' }}>Rp {((Number(detailLoan.totalPaidMinor) || 0) / 100).toLocaleString('id-ID')}</b>
                  </div>
                  <div>
                    Sisa Tagihan: <b style={{ color: '#dc2626' }}>Rp {((Number(detailLoan.remainingMinor) || 0) / 100).toLocaleString('id-ID')}</b>
                  </div>
                  <div>
                    Jatuh Tempo: <b>{detailLoan.dueDate || 'Tanpa Tenggat'}</b>
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--ink, #0b2a4a)', marginBottom: '8px' }}>
                    Riwayat Cicilan & Pelunasan ({detailLoan.payments?.length || 0})
                  </div>
                  {!detailLoan.payments || detailLoan.payments.length === 0 ? (
                    <div style={{ fontSize: '12.5px', color: 'var(--muted, #6e8cae)', padding: '12px 0' }}>
                      Belum ada riwayat pembayaran cicilan pada tagihan ini.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {detailLoan.payments.map(pay => (
                        <div
                          key={pay.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            background: 'var(--surface-2, #f8fafd)',
                            border: '1px solid var(--line-2, rgba(11,42,74,0.06))',
                            fontSize: '12.5px',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: '#059669' }}>
                              + Rp {((Number(pay.amountMinor) || 0) / 100).toLocaleString('id-ID')}
                            </div>
                            <div style={{ color: 'var(--muted, #6e8cae)', fontSize: '11.5px' }}>
                              {pay.paidOn} · Metode: {pay.method.toUpperCase()} {pay.notes ? `· ${pay.notes}` : ''}
                            </div>
                          </div>
                          <span className="finance3-badge posted">Tercatat</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {canManage && detailLoan.payments.length === 0 && detailLoan.status !== 'dibatalkan' && (
                  <form onSubmit={handleCancelLoan} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--line-2, rgba(11,42,74,0.08))', paddingTop: '12px' }}>
                    <div className="finance3-form-field">
                      <label className="finance3-form-label">Batalkan Pencatatan Piutang Ini</label>
                      <input
                        type="text"
                        className="finance3-input"
                        placeholder="Alasan pembatalan piutang..."
                        value={cancelReason}
                        onChange={e => setCancelReason(e.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      shape="pill"
                      style={{ color: '#dc2626', alignSelf: 'flex-start' }}
                    >
                      <Ban size={14} /> Batalkan Piutang
                    </Button>
                  </form>
                )}
              </div>

              <div className="finance3-modal-footer">
                <Button type="button" variant="secondary" shape="pill" onClick={() => setDetailLoan(null)}>
                  Tutup
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
