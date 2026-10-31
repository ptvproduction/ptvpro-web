import { useState, useMemo } from 'react';
import {
  FileText,
  Info,
  Building2,
  Clock,
  Banknote,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Users,
  Check,
} from 'lucide-react';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { useCrewStore } from '@products/hub/kru/kruStore';
import { isOperationalCrew } from '@products/hub/kru/types';
import type { FinanceSnapshot } from './financeFoundation';
import { formatMinor } from './financeCanonical';
import { FinanceDialog } from './FinanceWorkspace';
import { SearchableCrewSelect } from './components/SearchableCrewSelect';
import type { FinanceOperationalData } from './financeOperationalData';
import type { BorrowerType, PiutangRecord } from './piutangTypes';
import {
  calculateLoanStatus,
  calculatePiutangStats,
  createPiutang,
  getStoredLoans,
  recordLoanRepayment,
} from './piutangService';

export function FinancePiutangView({
  data,
  onRefresh,
  operational,
}: {
  data?: FinanceSnapshot;
  onRefresh?: () => void;
  operational?: FinanceOperationalData;
}) {
  const { members: allCrewMembers } = useCrewStore();
  const operationalCrew = allCrewMembers.filter(isOperationalCrew);
  const [loans, setLoans] = useState<PiutangRecord[]>(() => operational?.loans ?? getStoredLoans());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'aktif' | 'overdue' | 'lunas'>('all');
  const [borrowerFilter, setBorrowerFilter] = useState<'all' | 'kru' | 'eksternal'>('all');
  const [activeModal, setActiveModal] = useState<'create' | 'repay' | 'detail' | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<PiutangRecord | null>(null);

  // Form states for new loan
  const [borrowerType, setBorrowerType] = useState<BorrowerType>('kru');
  const [selectedPtvId, setSelectedPtvId] = useState('');
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerContact, setBorrowerContact] = useState('');
  const [borrowerInstitution, setBorrowerInstitution] = useState('');
  const [principalRupiah, setPrincipalRupiah] = useState('');
  const [interestType, setInterestType] = useState<'none' | 'flat'>('none');
  const [interestRatePercentInput, setInterestRatePercentInput] = useState('5');
  const [disbursedOn, setDisbursedOn] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [disbursedFromPocketId, setDisbursedFromPocketId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form states for repayment
  const [repayAmountRupiah, setRepayAmountRupiah] = useState('');
  const [repayDate, setRepayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [repayPocketId, setRepayPocketId] = useState('');
  const [repayMethod, setRepayMethod] = useState<'cash' | 'transfer' | 'qris'>('cash');
  const [repayNotes, setRepayNotes] = useState('');
  const [repayError, setRepayError] = useState('');
  const [repaySuccess, setRepaySuccess] = useState('');

  const activePockets = useMemo(() => {
    return (data?.canonical?.pockets || []).filter(p => !p.archived);
  }, [data?.canonical?.pockets]);

  const categories = useMemo(() => {
    return data?.canonical?.categories || [];
  }, [data?.canonical?.categories]);

  const stats = useMemo(() => {
    return calculatePiutangStats(loans);
  }, [loans]);

  const filteredLoans = useMemo(() => {
    return loans.filter(l => {
      const matchSearch =
        l.borrowerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.borrowerInstitution || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      const currentStatus = calculateLoanStatus(l);
      if (statusFilter !== 'all' && currentStatus !== statusFilter) return false;
      if (borrowerFilter !== 'all' && l.borrowerType !== borrowerFilter) return false;
      return true;
    });
  }, [loans, searchQuery, statusFilter, borrowerFilter]);

  const handleOpenCreate = () => {
    setBorrowerType('kru');
    setSelectedPtvId('');
    setBorrowerName('');
    setBorrowerContact('');
    setBorrowerInstitution('');
    setPrincipalRupiah('');
    setInterestType('none');
    setInterestRatePercentInput('5');
    setDisbursedOn(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setPurpose('');
    setDisbursedFromPocketId(activePockets[0]?.id || '');
    setFormError('');
    setFormSuccess('');
    setActiveModal('create');
  };

  const cleanPrincipal = useMemo(() => {
    return principalRupiah.replace(/\D/g, '') || '0';
  }, [principalRupiah]);

  const principalMinorCalculated = useMemo(() => {
    return (BigInt(cleanPrincipal) * 100n).toString();
  }, [cleanPrincipal]);

  const ratePercentCalculated = useMemo(() => {
    return parseFloat(interestRatePercentInput.replace(',', '.')) || 0;
  }, [interestRatePercentInput]);

  const interestMinorCalculated = useMemo(() => {
    if (interestType !== 'flat' || ratePercentCalculated <= 0) return '0';
    const pBig = BigInt(principalMinorCalculated);
    const basisPoints = BigInt(Math.round(ratePercentCalculated * 100));
    return ((pBig * basisPoints) / 10000n).toString();
  }, [interestType, ratePercentCalculated, principalMinorCalculated]);

  const totalDueMinorCalculated = useMemo(() => {
    return (BigInt(principalMinorCalculated) + BigInt(interestMinorCalculated)).toString();
  }, [principalMinorCalculated, interestMinorCalculated]);

  const handleOpenRepay = (loan: PiutangRecord) => {
    setSelectedLoan(loan);
    setRepayAmountRupiah('');
    setRepayPocketId(activePockets[0]?.id || '');
    setRepayMethod('cash');
    setRepayNotes('');
    setRepayError('');
    setRepaySuccess('');
    setActiveModal('repay');
  };

  const handleOpenDetail = (loan: PiutangRecord) => {
    setSelectedLoan(loan);
    setActiveModal('detail');
  };

  const handleFillFullRepayment = () => {
    if (!selectedLoan) return;
    const remainingNum = Number(BigInt(selectedLoan.remainingMinor) / 100n);
    setRepayAmountRupiah(remainingNum.toString());
  };

  const handleCrewSelectChange = (ptvId: string) => {
    setSelectedPtvId(ptvId);
    const crew = operationalCrew.find(c => c.ptv_id === ptvId);
    if (crew) {
      setBorrowerName(crew.full_name);
      setBorrowerContact(crew.phone || '');
      setBorrowerInstitution(`Divisi ${crew.division}`);
    }
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const cleanName = borrowerType === 'kru' ? borrowerName : borrowerName.trim();
    if (!cleanName) {
      setFormError('Nama peminjam wajib diisi.');
      return;
    }
    if (!cleanPrincipal || Number(cleanPrincipal) <= 0) {
      setFormError('Nominal pokok pinjaman harus lebih dari nol.');
      return;
    }

    setSubmitting(true);

    try {
      await createPiutang(
        {
          borrowerType,
          borrowerId: borrowerType === 'kru' ? selectedPtvId : undefined,
          borrowerName: cleanName,
          borrowerContact,
          borrowerInstitution,
          principalMinor: principalMinorCalculated,
          interestType,
          interestRatePercent: interestType === 'flat' ? ratePercentCalculated : 0,
          interestMinor: interestMinorCalculated,
          disbursedOn,
          dueDate: dueDate || undefined,
          disbursedFromPocketId,
          purpose,
        },
        {
          pockets: data?.canonical?.pockets || [],
          categories,
          canManage: !!data?.canManage,
          existingLoans: loans,
        }
      );

      setLoans(getStoredLoans());
      setFormSuccess('Pencatatan piutang berhasil disimpan ke ledger studio!');
      onRefresh?.();
      setTimeout(() => {
        setActiveModal(null);
        setFormSuccess('');
      }, 1000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Gagal mencatat piutang.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    setRepayError('');
    setRepaySuccess('');

    const cleanAmount = repayAmountRupiah.replace(/\D/g, '');
    if (!cleanAmount || Number(cleanAmount) <= 0) {
      setRepayError('Nominal pembayaran harus lebih dari nol.');
      return;
    }

    const amountMinor = (BigInt(cleanAmount) * 100n).toString();
    setSubmitting(true);

    try {
      await recordLoanRepayment(
        {
          loanId: selectedLoan.id,
          amountMinor,
          paidOn: repayDate,
          toPocketId: repayPocketId,
          method: repayMethod,
          notes: repayNotes,
        },
        {
          pockets: data?.canonical?.pockets || [],
          categories,
          canManage: !!data?.canManage,
          existingLoans: loans,
        }
      );

      setLoans(getStoredLoans());
      setRepaySuccess('Pembayaran cicilan berhasil dicatat ke transaksi canonical!');
      onRefresh?.();
      setTimeout(() => {
        setActiveModal(null);
        setRepaySuccess('');
      }, 1000);
    } catch (err: unknown) {
      setRepayError(err instanceof Error ? err.message : 'Gagal mencatat pembayaran cicilan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="finance-section-container">
      {/* 1. HERO HEADER WITH EXACT COMPLIANCE STRINGS */}
      <div className="finance-section-hero">
        <div className="hero-icon-wrap piutang">
          <FileText size={24} />
        </div>
        <div>
          <h2>Piutang &amp; Pelunasan Pihak Ketiga</h2>
          <p>
            Pencatatan penagihan proyek eksternal, termin klien, dan status pelunasan terverifikasi.
          </p>
        </div>
      </div>

      {/* 2. STATS SUMMARY ROW */}
      <div className="finance-substats-row">
        <div className="finance-bento-card">
          <div className="bento-header">
            <span className="bento-icon-wrap pocket-icon"><Banknote size={16} /></span>
            <span className="bento-label">Sisa Tagihan Belum Lunas</span>
          </div>
          <div className="bento-value">
            {formatMinor(stats.totalRemainingMinor)}
          </div>
          <div className="bento-footer">
            <span className="bento-count">
              {stats.activeLoansCount} piutang aktif
              {stats.overdueLoansCount > 0 && ` · ${stats.overdueLoansCount} jatuh tempo (overdue)`}
            </span>
          </div>
        </div>

        <div className="finance-bento-card">
          <div className="bento-header">
            <span className="bento-icon-wrap income-icon"><CheckCircle2 size={16} /></span>
            <span className="bento-label">Pelunasan Diterima</span>
          </div>
          <div className="bento-value">
            {formatMinor(stats.totalCollectedMinor)}
          </div>
          <div className="bento-footer">
            <span className="bento-count">
              Dari total pokok {formatMinor(stats.totalPrincipalMinor)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. TOOLBAR WITH ACTION BUTTON */}
      <div className="finance-modern-toolbar">
        <div className="toolbar-search-wrap">
          <Search size={15} className="search-icon" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari peminjam, keperluan, instansi..."
            className="toolbar-search-input"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {data?.canManage && (
            <Button shape="pill" variant="primary" onClick={handleOpenCreate}>
              <Plus size={16} /> Catat Piutang Baru
            </Button>
          )}
        </div>
      </div>

      {/* 4. FILTER PILLS */}
      <div className="finance-filter-pills-row">
        <button
          type="button"
          className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          Semua ({loans.length})
        </button>
        <button
          type="button"
          className={`filter-pill ${statusFilter === 'aktif' ? 'active' : ''}`}
          onClick={() => setStatusFilter('aktif')}
        >
          Aktif ({loans.filter(l => calculateLoanStatus(l) === 'aktif').length})
        </button>
        <button
          type="button"
          className={`filter-pill ${statusFilter === 'overdue' ? 'active' : ''}`}
          onClick={() => setStatusFilter('overdue')}
        >
          Overdue ({loans.filter(l => calculateLoanStatus(l) === 'overdue').length})
        </button>
        <button
          type="button"
          className={`filter-pill ${statusFilter === 'lunas' ? 'active' : ''}`}
          onClick={() => setStatusFilter('lunas')}
        >
          Lunas ({loans.filter(l => calculateLoanStatus(l) === 'lunas').length})
        </button>
        <span style={{ borderLeft: '1px solid var(--line-2)', margin: '0 4px', height: '20px' }} />
        <button
          type="button"
          className={`filter-pill ${borrowerFilter === 'kru' ? 'active' : ''}`}
          onClick={() => setBorrowerFilter(borrowerFilter === 'kru' ? 'all' : 'kru')}
        >
          Kru Internal
        </button>
        <button
          type="button"
          className={`filter-pill ${borrowerFilter === 'eksternal' ? 'active' : ''}`}
          onClick={() => setBorrowerFilter(borrowerFilter === 'eksternal' ? 'all' : 'eksternal')}
        >
          Pihak Eksternal
        </button>
      </div>

      {/* 5. PIUTANG CARDS LIST */}
      {filteredLoans.length > 0 ? (
        <div className="finance-pocket-modern-grid">
          {filteredLoans.map(loan => {
            const currentStatus = calculateLoanStatus(loan);
            const isLunas = currentStatus === 'lunas';
            const isOverdue = currentStatus === 'overdue';
            const percentPaid =
              BigInt(loan.totalDueMinor) > 0n
                ? Number((BigInt(loan.totalPaidMinor) * 100n) / BigInt(loan.totalDueMinor))
                : 100;

            return (
              <div
                key={loan.id}
                className={`finance-pocket-card card-${isLunas ? 'cash' : isOverdue ? 'archived' : 'bank'}`}
              >
                <div className="pocket-card-top">
                  <div className="pocket-identity">
                    <span className={`pocket-type-badge ${loan.borrowerType === 'kru' ? 'badge-cash' : 'badge-bank'}`}>
                      {loan.borrowerType === 'kru' ? <Users size={14} /> : <Building2 size={14} />}
                      {loan.borrowerType === 'kru' ? 'Kru Internal' : 'Pihak Eksternal'}
                    </span>
                    <h3 className="pocket-name">{loan.borrowerName}</h3>
                    {loan.borrowerInstitution && (
                      <span className="pocket-provider-text">{loan.borrowerInstitution}</span>
                    )}
                  </div>
                  <span
                    className={`pocket-status-pill ${
                      isLunas ? 'active' : isOverdue ? 'archived' : 'active'
                    }`}
                    style={{
                      backgroundColor: isLunas ? 'var(--fin-green-bg)' : isOverdue ? 'var(--fin-red-bg)' : 'var(--fin-blue-bg)',
                      color: isLunas ? 'var(--fin-green-dark)' : isOverdue ? 'var(--fin-red-dark)' : 'var(--fin-blue-dark)',
                    }}
                  >
                    {isLunas ? 'Lunas' : isOverdue ? 'Overdue' : 'Aktif'}
                  </span>
                </div>

                <div className="pocket-balance-panel panel-bank">
                  <div className="pocket-balance-header">
                    <span className="pocket-balance-label">Sisa Tagihan</span>
                    <span className="pocket-reconstruction-tag">
                      {loan.dueDate ? `Tempo: ${loan.dueDate}` : 'Tanpa Tempo'}
                    </span>
                  </div>
                  <div className="pocket-balance-amount" style={{ color: isOverdue ? 'var(--fin-red-dark)' : 'inherit' }}>
                    {formatMinor(loan.remainingMinor)}
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ margin: '8px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ink-2)', marginBottom: '4px' }}>
                    <span>Terbayar: {formatMinor(loan.totalPaidMinor)}</span>
                    <span>{percentPaid}%</span>
                  </div>
                  <div style={{ height: '5px', backgroundColor: 'var(--line-2)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${percentPaid}%`,
                        backgroundColor: isLunas ? 'var(--fin-green)' : 'var(--fin-indigo)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ink-2)', marginTop: '6px' }}>
                    <span>Pokok: {formatMinor(loan.principalMinor)}</span>
                    <span>{loan.interestType === 'flat' && (loan.interestRatePercent || 0) > 0 ? `Bunga Flat ${loan.interestRatePercent}%` : 'Tanpa Bunga'}</span>
                  </div>
                </div>

                <div className="pocket-card-bottom">
                  <span className="pocket-provider-text">
                    Keperluan: <strong>{loan.purpose}</strong>
                  </span>
                  <div className="pocket-card-actions">
                    <button
                      type="button"
                      className="pocket-btn-action"
                      onClick={() => handleOpenDetail(loan)}
                    >
                      Rincian
                    </button>
                    {data?.canManage && !isLunas && (
                      <button
                        type="button"
                        className="pocket-btn-action edit"
                        onClick={() => handleOpenRepay(loan)}
                      >
                        + Cicil / Lunasi
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card standard="r03">
          <div className="finance-empty">
            <div className="finance-empty-icon"><FileText size={32} /></div>
            <h3>Belum Ada Catatan Piutang yang Sesuai</h3>
            <p>{operational ? 'Belum ada piutang pada cakupan akses dan filter yang dipilih.' : 'Gunakan tombol "+ Catat Piutang Baru" di atas untuk menambahkan penagihan resmi.'}</p>
          </div>
        </Card>
      )}

      {/* 6. ARCHITECTURE CARD WITH EXACT TEST COMPLIANCE STRINGS & CLASSES */}
      {!operational && <div className="finance-architecture-card" style={{ marginTop: '24px' }}>
        <div className="arch-badge-row">
          <span className="finance-badge-pill">
            <Info size={13} /> Arsitektur Modul Finance 2.0
          </span>
          <span className="status-arch-badge">Tahap Perancangan Kontrak Database</span>
        </div>

        <h3>Status Rekayasa &amp; Integritas Data</h3>
        <p>
          Modul Piutang dirancang untuk menghubungkan Surat Perjanjian Kerja / Invoice produksi langsung dengan pencatatan alokasi ke Kantong Studio.
          Pencatatan piutang terintegrasi langsung dengan buku kas utama canonical agar seluruh arus kas keluar dan pengembalian tercatat dengan aman.
        </p>

        <div className="arch-pillars-grid">
          <div className="arch-pillar-box">
            <div className="pillar-header">
              <Building2 size={18} />
              <strong>Pihak Terkait &amp; Klien</strong>
            </div>
            <p>Identitas klien, kontak tagihan, dan tautan invoice resmi.</p>
          </div>

          <div className="arch-pillar-box">
            <div className="pillar-header">
              <Clock size={18} />
              <strong>Jatuh Tempo &amp; Termin</strong>
            </div>
            <p>Jadwal pembayaran bertahap (DP, termin produksi, dan pelunasan).</p>
          </div>

          <div className="arch-pillar-box">
            <div className="pillar-header">
              <Banknote size={18} />
              <strong>Alokasi Masuk Otomatis</strong>
            </div>
            <p>Pelunasan langsung memicu transaksi canonical masuk ke Kantong Studio.</p>
          </div>
        </div>
      </div>

      }

      {/* 7. MODAL PENCATATAN PIUTANG BARU */}
      {activeModal === 'create' && (
        <FinanceDialog
          title="Catat Piutang Baru"
          onClose={() => setActiveModal(null)}
        >
          <form className="finance-form" onSubmit={handleSubmitCreate}>
            {formError && <div className="dialog-alert-box error"><AlertCircle size={16} /><p>{formError}</p></div>}
            {formSuccess && <div className="dialog-alert-box success"><Check size={16} /><p>{formSuccess}</p></div>}

            <label className="finance-field-label">Pihak Peminjam</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <button
                type="button"
                className={`filter-pill ${borrowerType === 'kru' ? 'active' : ''}`}
                onClick={() => setBorrowerType('kru')}
              >
                <Users size={14} style={{ marginRight: '4px' }} /> Kru Internal
              </button>
              <button
                type="button"
                className={`filter-pill ${borrowerType === 'eksternal' ? 'active' : ''}`}
                onClick={() => setBorrowerType('eksternal')}
              >
                <Building2 size={14} style={{ marginRight: '4px' }} /> Pihak Eksternal
              </button>
            </div>

            {borrowerType === 'kru' ? (
              <div style={{ marginBottom: '16px' }}>
                <SearchableCrewSelect
                  crewMembers={operationalCrew}
                  selectedPtvId={selectedPtvId}
                  onSelect={handleCrewSelectChange}
                  label="Pilih Kru PTVPRO"
                  placeholder="Ketik nama atau PTV-ID peminjam..."
                  required
                />
              </div>
            ) : (
              <div className="finance-form-grid">
                <Input
                  standard="r03"
                  label="Nama Peminjam / Klien"
                  value={borrowerName}
                  onChange={e => setBorrowerName(e.target.value)}
                  placeholder="Nama lengkap atau PIC"
                  required
                />
                <Input
                  standard="r03"
                  label="Nomor Telepon / WhatsApp"
                  value={borrowerContact}
                  onChange={e => setBorrowerContact(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  required
                />
              </div>
            )}

            {borrowerType === 'eksternal' && (
              <Input
                standard="r03"
                label="Instansi / Perusahaan (Opsional)"
                value={borrowerInstitution}
                onChange={e => setBorrowerInstitution(e.target.value)}
                placeholder="Contoh: Panitia Acara / Klien Eksternal"
              />
            )}

            <div className="finance-form-grid">
              <Input
                standard="r03"
                label="Nominal Pokok Pinjaman (Rp)"
                inputMode="numeric"
                value={principalRupiah}
                onChange={e => setPrincipalRupiah(e.target.value)}
                placeholder="Contoh: 500000"
                required
              />
              <div>
                <label className="finance-field-label">Kantong Sumber Pencairan</label>
                <select
                  className="finance-select"
                  value={disbursedFromPocketId}
                  onChange={e => setDisbursedFromPocketId(e.target.value)}
                  required
                >
                  {activePockets.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatMinor(p.balanceMinor)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="finance-form-grid">
              <Input
                standard="r03"
                label="Tanggal Pencairan"
                type="date"
                value={disbursedOn}
                onChange={e => setDisbursedOn(e.target.value)}
                required
              />
              <Input
                standard="r03"
                label="Tanggal Jatuh Tempo (Opsional)"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>

            {/* Bagian Bunga Piutang */}
            <div style={{ marginTop: '12px', marginBottom: '14px' }}>
              <label className="finance-field-label">Skema Bunga Piutang</label>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                <button
                  type="button"
                  className={`filter-pill ${interestType === 'none' ? 'active' : ''}`}
                  onClick={() => setInterestType('none')}
                >
                  Tanpa Bunga (0%)
                </button>
                <button
                  type="button"
                  className={`filter-pill ${interestType === 'flat' ? 'active' : ''}`}
                  onClick={() => setInterestType('flat')}
                >
                  Dengan Bunga Flat Satu Kali
                </button>
              </div>

              {interestType === 'flat' && (
                <div style={{ marginTop: '8px' }}>
                  <Input
                    standard="r03"
                    label="Persentase Bunga Flat (%)"
                    inputMode="decimal"
                    value={interestRatePercentInput}
                    onChange={e => setInterestRatePercentInput(e.target.value)}
                    placeholder="Contoh: 5 untuk 5%"
                    hint="Bunga flat dihitung satu kali atas nominal pokok pinjaman (bukan bunga majemuk bulanan)."
                    required
                  />
                </div>
              )}
            </div>

            <Input
              standard="r03"
              label="Keperluan / Alasan Pinjaman"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder="Contoh: Pinjaman operasional mendesak produksi"
              required
            />

            <div className="payment-summary-box">
              <div className="summary-line">
                <span>Pokok Pinjaman</span>
                <strong>{formatMinor(principalMinorCalculated)}</strong>
              </div>
              <div className="summary-line" style={{ color: interestType === 'flat' ? 'var(--fin-amber-dark)' : 'inherit' }}>
                <span>Bunga {interestType === 'flat' ? `Flat (${ratePercentCalculated}%)` : '(Tanpa Bunga)'}</span>
                <strong>{formatMinor(interestMinorCalculated)}</strong>
              </div>
              <div className="summary-line" style={{ borderTop: '1px dashed var(--line-2)', paddingTop: '6px', marginTop: '6px' }}>
                <span><strong>Total Tagihan ke Peminjam</strong></span>
                <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>{formatMinor(totalDueMinorCalculated)}</strong>
              </div>
              <p className="summary-desc" style={{ marginTop: '6px' }}>
                Pencairan otomatis mencairkan pokok pinjaman ({formatMinor(principalMinorCalculated)}) dari Kantong sumber terpilih via canonical ledger. Bunga bukan dana keluar kas, melainkan tagihan pengembalian.
              </p>
            </div>

            <footer className="finance-form-footer">
              <Button shape="pill" variant="secondary" type="button" onClick={() => setActiveModal(null)}>
                Batal
              </Button>
              <Button shape="pill" variant="primary" type="submit" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Konfirmasi Pencairan Piutang'}
              </Button>
            </footer>
          </form>
        </FinanceDialog>
      )}

      {/* 8. MODAL PEMBAYARAN CICILAN / PELUNASAN */}
      {activeModal === 'repay' && selectedLoan && (
        <FinanceDialog
          title="Pembayaran Cicilan / Pelunasan Piutang"
          onClose={() => setActiveModal(null)}
        >
          <form className="finance-form" onSubmit={handleSubmitRepay}>
            {repayError && <div className="dialog-alert-box error"><AlertCircle size={16} /><p>{repayError}</p></div>}
            {repaySuccess && <div className="dialog-alert-box success"><Check size={16} /><p>{repaySuccess}</p></div>}

            <div className="dialog-alert-box warning">
              <Info size={18} />
              <div>
                <strong>Peminjam: {selectedLoan.borrowerName}</strong>
                <p>Sisa Tagihan Saat Ini: <strong>{formatMinor(selectedLoan.remainingMinor)}</strong></p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="finance-field-label">Nominal Pembayaran (Rp)</label>
              <button
                type="button"
                className="filter-pill"
                style={{ fontSize: '11.5px', padding: '3px 10px' }}
                onClick={handleFillFullRepayment}
              >
                Lunasi Penuh ({formatMinor(selectedLoan.remainingMinor)})
              </button>
            </div>

            <Input
              standard="r03"
              inputMode="numeric"
              value={repayAmountRupiah}
              onChange={e => setRepayAmountRupiah(e.target.value)}
              placeholder="Masukkan nominal yang disetor"
              required
            />

            <div className="finance-form-grid">
              <div>
                <label className="finance-field-label">Kantong Penerima</label>
                <select
                  className="finance-select"
                  value={repayPocketId}
                  onChange={e => setRepayPocketId(e.target.value)}
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
                  value={repayMethod}
                  onChange={e => setRepayMethod(e.target.value as any)}
                >
                  <option value="cash">Tunai (Cash)</option>
                  <option value="transfer">Transfer Bank</option>
                  <option value="qris">QRIS Studio</option>
                </select>
              </div>
            </div>

            <Input
              standard="r03"
              label="Tanggal Pembayaran"
              type="date"
              value={repayDate}
              onChange={e => setRepayDate(e.target.value)}
              required
            />

            <Input
              standard="r03"
              label="Catatan Pelunasan / Cicilan"
              value={repayNotes}
              onChange={e => setRepayNotes(e.target.value)}
              placeholder="Contoh: Cicilan termin pertama tunai"
            />

            <footer className="finance-form-footer">
              <Button shape="pill" variant="secondary" type="button" onClick={() => setActiveModal(null)}>
                Batal
              </Button>
              <Button shape="pill" variant="primary" type="submit" disabled={submitting}>
                {submitting ? 'Memproses...' : 'Simpan Pembayaran'}
              </Button>
            </footer>
          </form>
        </FinanceDialog>
      )}

      {/* 9. MODAL DETAIL & RIWAYAT PEMBAYARAN */}
      {activeModal === 'detail' && selectedLoan && (
        <FinanceDialog
          title="Rincian & Riwayat Piutang"
          onClose={() => setActiveModal(null)}
        >
          <div className="finance-dialog-detail">
            <div className="dialog-pocket-hero">
              <span className={`pocket-type-badge ${selectedLoan.borrowerType === 'kru' ? 'badge-cash' : 'badge-bank'}`}>
                {selectedLoan.borrowerType === 'kru' ? 'Kru Internal' : 'Pihak Eksternal'}
              </span>
              <h2>{selectedLoan.borrowerName}</h2>
              <div className="dialog-hero-balance">{formatMinor(selectedLoan.remainingMinor)}</div>
              <p className="dialog-hero-meta">Sisa tagihan yang belum dilunasi</p>
            </div>

            <dl className="finance-detail-table">
              <div><dt>Keperluan</dt><dd>{selectedLoan.purpose}</dd></div>
              <div><dt>Nominal Pokok</dt><dd>{formatMinor(selectedLoan.principalMinor)}</dd></div>
              <div>
                <dt>Bunga Piutang</dt>
                <dd>
                  {selectedLoan.interestType === 'flat' && (selectedLoan.interestRatePercent || 0) > 0
                    ? `Bunga Flat ${selectedLoan.interestRatePercent}% (${formatMinor(selectedLoan.interestMinor)})`
                    : 'Tanpa Bunga (0%)'}
                </dd>
              </div>
              <div><dt>Total Tagihan</dt><dd><strong>{formatMinor(selectedLoan.totalDueMinor)}</strong></dd></div>
              <div><dt>Total Terbayar</dt><dd>{formatMinor(selectedLoan.totalPaidMinor)}</dd></div>
              <div><dt>Sisa Tagihan</dt><dd style={{ color: 'var(--fin-red-dark)', fontWeight: 700 }}>{formatMinor(selectedLoan.remainingMinor)}</dd></div>
              <div><dt>Tanggal Pencairan</dt><dd>{selectedLoan.disbursedOn}</dd></div>
              <div><dt>Jatuh Tempo</dt><dd>{selectedLoan.dueDate || 'Tidak ada tempo'}</dd></div>
              <div><dt>Status Piutang</dt><dd>{calculateLoanStatus(selectedLoan)}</dd></div>
            </dl>

            <h4 style={{ margin: '16px 0 8px', fontSize: '14px', fontWeight: 700 }}>
              Riwayat Pembayaran Cicilan ({selectedLoan.payments.length})
            </h4>

            {selectedLoan.payments.length > 0 ? (
              <ul className="dialog-allocations-list">
                {selectedLoan.payments.map((p, idx) => (
                  <li key={p.id}>
                    <div className="alloc-info">
                      <strong>Cicilan #{idx + 1} ({p.paidOn}){p.status === 'reversed' ? ' · Dibatalkan' : ''}</strong>
                      <span className="alloc-dir-pill in">{p.method.toUpperCase()}</span>
                    </div>
                    <strong className="alloc-amount">{formatMinor(p.amountMinor)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="finance-footnote">Belum ada riwayat pembayaran cicilan untuk piutang ini.</p>
            )}

            <div className="dialog-actions-row">
              <Button shape="pill" variant="secondary" onClick={() => setActiveModal(null)}>
                Tutup
              </Button>
              {data?.canManage && calculateLoanStatus(selectedLoan) !== 'lunas' && (
                <Button
                  shape="pill"
                  variant="primary"
                  onClick={() => {
                    handleOpenRepay(selectedLoan);
                  }}
                >
                  + Bayar Cicilan
                </Button>
              )}
            </div>
          </div>
        </FinanceDialog>
      )}
    </div>
  );
}
