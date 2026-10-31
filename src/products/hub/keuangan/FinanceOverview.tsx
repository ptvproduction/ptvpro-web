import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Plus,
  Building2,
  CreditCard,
  Banknote,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Archive,
  QrCode,
  Copy,
  Check,
  ZoomIn,
  Download,
  History,
} from 'lucide-react';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import type { FinanceSnapshot } from './financeFoundation';
import {
  formatMinor,
  isTestTransaction,
  type CanonicalTransaction,
  type FinancePocket,
} from './financeCanonical';
import {
  FinanceDialog,
  PocketFormView,
  TransactionForm,
  kinds,
} from './FinanceWorkspace';

interface FinanceOverviewProps {
  data: FinanceSnapshot;
  onRefresh: () => void;
}

export function FinanceOverview({ data, onRefresh }: FinanceOverviewProps) {
  const [activeTab, setActiveTab] = useState<'semua' | 'income' | 'expense' | 'transfer'>('semua');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedTx, setSelectedTx] = useState<CanonicalTransaction | null>(null);
  const [selectedPocket, setSelectedPocket] = useState<FinancePocket | null>(null);
  const [activeModal, setActiveModal] = useState<
    'newPocket' | 'editPocket' | 'income' | 'expense' | 'transfer' | 'bendahara' | null
  >(null);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [isQrisZoomed, setIsQrisZoomed] = useState(false);

  // Akses kru (own) - Access Denied State yang ramah & informatif
  if (data.scope === 'own') {
    return (
      <div className="finance-access-denied-wrap">
        <Card standard="r03">
          <div className="finance-access-card">
            <div className="finance-access-icon">
              <ShieldCheck size={32} />
            </div>
            <h2>Akses Terbatas: Mode Kru</h2>
            <p>
              Akun Anda memiliki izin membaca data <strong>Kas Kru pribadi</strong>.
              Seluruh mutasi pembukuan studio, kantong rekening, dan transaksi global dikelola secara aman oleh Bendahara, Eksekutif, dan Root.
            </p>
            <div className="finance-access-actions">
              <Link to="?tab=kas-kru" className="finance-btn-pill primary">
                Buka Kas Kru Saya <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Awaiting schema state jika tabel canonical belum terhubung
  if (data.canonical.state === 'awaiting_schema') {
    return (
      <Card standard="r03">
        <div className="finance-empty">
          <div className="finance-empty-icon">
            <AlertCircle size={36} />
          </div>
          <h2>Modul Finance 2.0 Sedang Disiapkan</h2>
          <p>
            Skema pembukuan canonical belum terhubung pada database ini. Tidak ada saldo perkiraan yang dimunculkan.
          </p>
        </div>
      </Card>
    );
  }

  const pockets = data.canonical.pockets || [];
  const allTransactions = data.canonical.transactions || [];
  const categories = data.canonical.categories || [];

  // Isolasi transaksi pengujian PTV-DEV-117 dari transaksi operasional
  const operationalTxs = allTransactions.filter(t => !isTestTransaction(t));
  const testTxs = allTransactions.filter(t => isTestTransaction(t));

  const activePockets = pockets.filter(p => !p.archived);
  const archivedPockets = pockets.filter(p => p.archived);

  // Perhitungan saldo total dari kantong aktif operasional
  const totalBalanceMinor = activePockets.reduce(
    (sum, p) => sum + (p.balanceMinor ? BigInt(p.balanceMinor) : 0n),
    0n
  );

  // Perhitungan metrik transaksi operasional murni
  const postedIncomes = operationalTxs.filter(t => t.kind === 'income' && t.status === 'posted');
  const postedExpenses = operationalTxs.filter(t => t.kind === 'expense' && t.status === 'posted');

  const totalIncomeMinor = postedIncomes.reduce((sum, t) => sum + BigInt(t.amountMinor), 0n);
  const totalExpenseMinor = postedExpenses.reduce((sum, t) => sum + BigInt(t.amountMinor), 0n);

  // Deteksi jika sudah ada kantong resmi bendahara terkonfigurasi (bank/ewallet dengan rekening atau QRIS)
  const officialPaymentPocket = pockets.find(
    p => p.kind !== 'cash' && (Boolean(p.accountNumber?.trim()) || Boolean(p.qris?.assetPath))
  );

  // Filter transaksi operasional untuk tampilan riwayat
  const filteredTxs = operationalTxs.filter(t => {
    if (activeTab === 'semua') return true;
    return t.kind === activeTab;
  });

  const recentTxs = filteredTxs.slice(0, 7);

  const getPocketIcon = (kind: FinancePocket['kind']) => {
    switch (kind) {
      case 'bank':
        return <Building2 size={20} />;
      case 'ewallet':
        return <CreditCard size={20} />;
      case 'cash':
      default:
        return <Banknote size={20} />;
    }
  };

  const getPocketBadge = (kind: FinancePocket['kind']) => {
    switch (kind) {
      case 'bank':
        return { label: 'Bank', colorClass: 'badge-bank' };
      case 'ewallet':
        return { label: 'E-Wallet', colorClass: 'badge-ewallet' };
      case 'cash':
      default:
        return { label: 'Kas Tunai', colorClass: 'badge-cash' };
    }
  };

  const handleCopyAccount = (accNum: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(accNum);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedTx(null);
    setSelectedPocket(null);
    setIsQrisZoomed(false);
  };

  return (
    <div className="finance-overview-root">
      {/* 1. HERO BENTO BALANCE BANNER (LEBIH RINGKAS & PROPORSIONAL) */}
      <div className="finance-hero-bento">
        <div className="finance-hero-layout">
          <div className="finance-hero-main">
            <div className="finance-hero-badge-row">
              <span className="finance-hero-tag">
                <Sparkles size={14} /> Total Saldo Kas Aktif
              </span>
              <span
                className="finance-historical-badge"
                title="Saldo hasil rekonstruksi aritmetis 53 transaksi historis per 21 Oktober 2026. Bukan saldo fisik hasil opname studio."
              >
                🏛️ Saldo Rekonstruksi Historis (Buku)
              </span>
            </div>

            <div className="finance-hero-amount-wrap">
              <h1 className="finance-hero-amount">{formatMinor(totalBalanceMinor.toString())}</h1>
              <p className="finance-hero-subtext">
                Terdistribusi di <strong>{activePockets.length} Kantong aktif</strong> terverifikasi
              </p>
            </div>
          </div>

          {/* Quick Actions Terarah: Hanya Transfer Kantong & Catat Pengeluaran di Kanan Atas Hero */}
          {data.canManage && (
            <div className="finance-hero-actions">
              <button
                type="button"
                className="finance-action-btn action-transfer"
                onClick={() => setActiveModal('transfer')}
              >
                <ArrowLeftRight size={16} /> Transfer Kantong
              </button>
              <button
                type="button"
                className="finance-action-btn action-expense"
                onClick={() => setActiveModal('expense')}
              >
                <ArrowUpRight size={16} /> Catat Pengeluaran
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. BENTO METRICS STATS GRID */}
      <div className="finance-bento-grid">
        {/* Pemasukan Sah */}
        <div className="finance-bento-card bento-income">
          <div className="bento-header">
            <span className="bento-icon-wrap income-icon">
              <ArrowDownLeft size={18} />
            </span>
            <span className="bento-label">Pemasukan Tercatat</span>
          </div>
          <div className="bento-value">{formatMinor(totalIncomeMinor.toString())}</div>
          <div className="bento-footer">
            <span className="bento-count">{postedIncomes.length} transaksi posted</span>
          </div>
        </div>

        {/* Pengeluaran Sah */}
        <div className="finance-bento-card bento-expense">
          <div className="bento-header">
            <span className="bento-icon-wrap expense-icon">
              <ArrowUpRight size={18} />
            </span>
            <span className="bento-label">Pengeluaran Tercatat</span>
          </div>
          <div className="bento-value">{formatMinor(totalExpenseMinor.toString())}</div>
          <div className="bento-footer">
            <span className="bento-count">{postedExpenses.length} transaksi posted</span>
          </div>
        </div>

        {/* Kartu 3: Rekening & QRIS Bendahara (Interaktif) */}
        <div
          role="button"
          tabIndex={0}
          className="finance-bento-card bento-bendahara"
          onClick={() => setActiveModal('bendahara')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setActiveModal('bendahara');
            }
          }}
          aria-label="Lihat informasi rekening dan QRIS Bendahara"
        >
          <div className="bento-header">
            <span className="bento-icon-wrap bendahara-icon">
              <QrCode size={18} />
            </span>
            <span className="bento-label">Rekening & QRIS Bendahara</span>
          </div>
          <div className="bento-bendahara-desc">
            Lihat informasi rekening dan QRIS Bendahara
          </div>
          <div className="bento-footer bento-bendahara-footer">
            <span className="bento-action-link">
              Lihat Detail <ChevronRight size={14} />
            </span>
          </div>
        </div>

        {/* Kantong Terhubung */}
        <div className="finance-bento-card bento-pockets">
          <div className="bento-header">
            <span className="bento-icon-wrap pocket-icon">
              <Wallet size={18} />
            </span>
            <span className="bento-label">Kantong Keuangan</span>
          </div>
          <div className="bento-value">{activePockets.length} Aktif</div>
          <div className="bento-footer">
            <span className="bento-count">{archivedPockets.length} kantong diarsipkan</span>
          </div>
        </div>
      </div>

      {/* 3. DUA KOLOM: KANTONG KECE & RIWAYAT TRANSAKSI TERBARU */}
      <div className="finance-columns-layout">
        {/* KOLOM KIRI: KANTONG KECE */}
        <section className="finance-col-pockets">
          <div className="finance-section-header">
            <div className="section-title-wrap">
              <Wallet size={20} className="section-icon" />
              <div>
                <h2>Kantong Keuangan</h2>
                <p>Rekening dan kas aktif studio</p>
              </div>
            </div>
            {data.canManage && (
              <Button
                shape="pill"
                size="sm"
                variant="secondary"
                onClick={() => setActiveModal('newPocket')}
              >
                <Plus size={14} /> Kantong Baru
              </Button>
            )}
          </div>

          <div className="finance-pocket-cards-list">
            {activePockets.length === 0 ? (
              <Card standard="r03">
                <div className="finance-empty-pocket">
                  <p>Belum ada Kantong aktif terpasang.</p>
                </div>
              </Card>
            ) : (
              activePockets.map(p => {
                const badge = getPocketBadge(p.kind);
                return (
                  <div key={p.id} className={`finance-pocket-card card-${p.kind}`}>
                    {/* Header */}
                    <div className="pocket-card-top">
                      <div className="pocket-identity">
                        <span className={`pocket-type-badge ${badge.colorClass}`}>
                          {getPocketIcon(p.kind)} {badge.label}
                        </span>
                        <h3 className="pocket-name">{p.name}</h3>
                      </div>
                      <span className="pocket-status-pill active">Aktif</span>
                    </div>

                    {/* Panel Saldo Terbuku Khusus */}
                    <div className={`pocket-balance-panel panel-${p.kind}`}>
                      <div className="pocket-balance-header">
                        <span className="pocket-balance-label">Saldo Terbuku</span>
                        {p.id === '60e8d033-2794-4219-a960-c56bedca0111' && (
                          <span className="pocket-reconstruction-tag" title="Saldo hasil rekonstruksi pembukuan historis">
                            Rekonstruksi
                          </span>
                        )}
                      </div>
                      <div className="pocket-balance-amount">{formatMinor(p.balanceMinor)}</div>
                    </div>

                    {/* Footer */}
                    <div className="pocket-card-bottom">
                      <span className="pocket-provider-text">
                        {p.kind === 'cash'
                          ? 'Kas Tunai Studio'
                          : `${p.provider} • ${p.accountNumber || '—'}`}
                      </span>
                      <div className="pocket-card-actions">
                        <button
                          type="button"
                          className="pocket-btn-action"
                          onClick={() => setSelectedPocket(p)}
                        >
                          Rincian
                        </button>
                        {data.canManage && (
                          <button
                            type="button"
                            className="pocket-btn-action edit"
                            onClick={() => {
                              setSelectedPocket(p);
                              setActiveModal('editPocket');
                            }}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Toggle Kantong Diarsipkan */}
          {archivedPockets.length > 0 && (
            <div className="finance-archived-section">
              <button
                type="button"
                className="finance-toggle-archived-btn"
                onClick={() => setShowArchived(!showArchived)}
              >
                <Archive size={15} />
                <span>{showArchived ? 'Sembunyikan' : 'Tampilkan'} Kantong Diarsipkan ({archivedPockets.length})</span>
                <ChevronRight size={15} className={`chevron-icon ${showArchived ? 'expanded' : ''}`} />
              </button>

              {showArchived && (
                <div className="finance-archived-list">
                  {archivedPockets.map(p => (
                    <div key={p.id} className="finance-pocket-card card-archived">
                      <div className="pocket-card-top">
                        <span className="pocket-type-badge badge-archived">
                          {kinds[p.kind]} · Diarsipkan
                        </span>
                        <h4 className="pocket-name">{p.name}</h4>
                      </div>
                      <div className="pocket-balance-row">
                        <strong className="pocket-balance-amount">{formatMinor(p.balanceMinor)}</strong>
                      </div>
                      <div className="pocket-card-bottom">
                        <span className="pocket-provider-text">{p.provider || 'Kas tunai'}</span>
                        <button
                          type="button"
                          className="pocket-btn-action"
                          onClick={() => setSelectedPocket(p)}
                        >
                          Rincian
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* KOLOM KANAN: RIWAYAT TRANSAKSI TERBARU */}
        <section className="finance-col-transactions">
          <div className="finance-section-header">
            <div className="section-title-wrap">
              <History size={20} className="section-icon" />
              <div>
                <h2>Riwayat Transaksi</h2>
                <p>Aktivitas pencatatan & mutasi kas</p>
              </div>
            </div>
            <Link to="?tab=transaksi" className="finance-view-all-link">
              Buka Semua ({operationalTxs.length}) <ExternalLink size={14} />
            </Link>
          </div>

          {/* Filter Pills */}
          <div className="finance-filter-pills-row">
            {(['semua', 'income', 'expense', 'transfer'] as const).map(tabKey => (
              <button
                key={tabKey}
                type="button"
                className={`filter-pill ${activeTab === tabKey ? 'active' : ''}`}
                onClick={() => setActiveTab(tabKey)}
              >
                {tabKey === 'semua'
                  ? `Semua (${operationalTxs.length})`
                  : tabKey === 'income'
                  ? `Pemasukan (${postedIncomes.length})`
                  : tabKey === 'expense'
                  ? `Pengeluaran (${postedExpenses.length})`
                  : 'Transfer'}
              </button>
            ))}
          </div>

          {/* List Transaksi */}
          <div className="finance-tx-list">
            {recentTxs.length === 0 ? (
              <Card standard="r03">
                <div className="finance-empty-tx">
                  <p>Tidak ada transaksi yang sesuai pada filter ini.</p>
                </div>
              </Card>
            ) : (
              recentTxs.map(tx => {
                const isReversed = tx.status === 'reversed';
                const isIncome = tx.kind === 'income';
                const isExpense = tx.kind === 'expense';

                return (
                  <div
                    key={tx.id}
                    className={`finance-tx-card ${isReversed ? 'is-reversed' : ''}`}
                    onClick={() => setSelectedTx(tx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedTx(tx);
                    }}
                  >
                    <div className="tx-card-left">
                      <div
                        className={`tx-type-avatar ${
                          isReversed
                            ? 'avatar-reversed'
                            : isIncome
                            ? 'avatar-income'
                            : isExpense
                            ? 'avatar-expense'
                            : 'avatar-transfer'
                        }`}
                      >
                        {isReversed ? (
                          <XCircle size={18} />
                        ) : isIncome ? (
                          <ArrowDownLeft size={18} />
                        ) : isExpense ? (
                          <ArrowUpRight size={18} />
                        ) : (
                          <ArrowLeftRight size={18} />
                        )}
                      </div>

                      <div className="tx-info-block">
                        <div className="tx-desc-row">
                          <strong className="tx-description">{tx.description}</strong>
                          {isReversed && (
                            <span className="tx-badge-reversed">Dibatalkan (Reversed)</span>
                          )}
                          {!isReversed && (
                            <span className="tx-badge-posted">
                              <CheckCircle2 size={12} /> Posted
                            </span>
                          )}
                        </div>
                        <div className="tx-meta-row">
                          <span>{tx.occurredOn}</span>
                          <span>•</span>
                          <span>
                            {isIncome
                              ? 'Pemasukan'
                              : isExpense
                              ? 'Pengeluaran'
                              : 'Pindah Kantong'}
                          </span>
                          {tx.allocations && tx.allocations.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="tx-pocket-tag">
                                {pockets.find(p => p.id === tx.allocations[0].pocketId)?.name || 'Kas Studio'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="tx-card-right">
                      <div
                        className={`tx-amount ${
                          isReversed
                            ? 'amount-reversed'
                            : isIncome
                            ? 'amount-income'
                            : isExpense
                            ? 'amount-expense'
                            : 'amount-transfer'
                        }`}
                      >
                        {isReversed
                          ? formatMinor(tx.amountMinor)
                          : isIncome
                          ? `+ ${formatMinor(tx.amountMinor)}`
                          : isExpense
                          ? `- ${formatMinor(tx.amountMinor)}`
                          : formatMinor(tx.amountMinor)}
                      </div>
                      <ChevronRight size={16} className="tx-chevron" />
                    </div>
                  </div>
                );
              })
            )}

            {operationalTxs.length > 7 && (
              <div className="finance-tx-more-box">
                <Link to="?tab=transaksi" className="finance-more-btn">
                  Buka riwayat lengkap ({operationalTxs.length} transaksi) & filter tanggal <ChevronRight size={16} />
                </Link>
              </div>
            )}

            {testTxs.length > 0 && data.canManage && (
              <div className="finance-test-audit-banner">
                <div className="test-audit-info">
                  <ShieldCheck size={16} />
                  <span>
                    <strong>{testTxs.length} Mutasi Uji Coba PTV-DEV-117</strong> terisolasi aman dari statistik operasional.
                  </span>
                </div>
                <Link to="?tab=transaksi&filter=test" className="test-audit-link">
                  Lihat Arsip Audit <ChevronRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* MODAL TRANSAKSI (INCOME, EXPENSE, TRANSFER) */}
      {(activeModal === 'income' || activeModal === 'expense' || activeModal === 'transfer') && (
        <FinanceDialog
          title={
            activeModal === 'income'
              ? 'Catat Pemasukan Baru'
              : activeModal === 'expense'
              ? 'Catat Pengeluaran Baru'
              : 'Transfer Antar-Kantong'
          }
          onClose={closeModal}
        >
          <TransactionForm
            operation={activeModal}
            pockets={pockets}
            categories={categories}
            canManage={data.canManage}
            writesEnabled={data.writesEnabled}
            onSuccess={() => {
              onRefresh();
              closeModal();
            }}
            onClose={closeModal}
          />
        </FinanceDialog>
      )}

      {/* MODAL KANTONG (NEW, EDIT) */}
      {(activeModal === 'newPocket' || activeModal === 'editPocket') && (
        <FinanceDialog
          title={activeModal === 'newPocket' ? 'Tambah Kantong Baru' : 'Edit Kantong'}
          onClose={closeModal}
        >
          <PocketFormView
            pocket={activeModal === 'editPocket' ? selectedPocket || undefined : undefined}
            canManage={data.canManage}
            onSuccess={() => {
              onRefresh();
              closeModal();
            }}
            onClose={closeModal}
          />
        </FinanceDialog>
      )}

      {/* MODAL DETAIL KANTONG */}
      {selectedPocket && !activeModal && (
        <FinanceDialog title="Detail Kantong" onClose={closeModal}>
          <div className="finance-dialog-detail">
            <div className="dialog-pocket-hero">
              <span className={`pocket-type-badge ${getPocketBadge(selectedPocket.kind).colorClass}`}>
                {getPocketIcon(selectedPocket.kind)} {kinds[selectedPocket.kind]}
              </span>
              <h2>{selectedPocket.name}</h2>
              <div className="dialog-hero-balance">{formatMinor(selectedPocket.balanceMinor)}</div>
            </div>

            <dl className="finance-detail-table">
              <div>
                <dt>Penyedia / Bank</dt>
                <dd>{selectedPocket.provider || 'Kas Tunai Studio'}</dd>
              </div>
              <div>
                <dt>Nomor Rekening</dt>
                <dd>{selectedPocket.accountNumber || '—'}</dd>
              </div>
              <div>
                <dt>Atas Nama</dt>
                <dd>{selectedPocket.accountHolder || '—'}</dd>
              </div>
              <div>
                <dt>Status Kantong</dt>
                <dd>{selectedPocket.archived ? 'Diarsipkan' : 'Aktif'}</dd>
              </div>
              <div>
                <dt>Versi Record</dt>
                <dd>v{selectedPocket.version}</dd>
              </div>
            </dl>

            {data.canManage && (
              <div className="dialog-actions-row">
                <Button
                  shape="pill"
                  variant="secondary"
                  onClick={() => setActiveModal('editPocket')}
                >
                  Edit Kantong
                </Button>
              </div>
            )}
          </div>
        </FinanceDialog>
      )}

      {/* MODAL DETAIL TRANSAKSI */}
      {selectedTx && !activeModal && (
        <FinanceDialog title="Detail Transaksi" onClose={closeModal}>
          <div className="finance-dialog-detail">
            <div className="dialog-tx-hero">
              <span
                className={`tx-type-badge ${
                  selectedTx.status === 'reversed'
                    ? 'badge-reversed'
                    : selectedTx.kind === 'income'
                    ? 'badge-income'
                    : selectedTx.kind === 'expense'
                    ? 'badge-expense'
                    : 'badge-transfer'
                }`}
              >
                {selectedTx.status === 'reversed'
                  ? 'Dibatalkan (Reversed)'
                  : selectedTx.kind === 'income'
                  ? 'Pemasukan'
                  : selectedTx.kind === 'expense'
                  ? 'Pengeluaran'
                  : 'Pindah Kantong'}
              </span>
              <h2>{selectedTx.description}</h2>
              <div
                className={`dialog-hero-amount ${
                  selectedTx.status === 'reversed'
                    ? 'amount-reversed'
                    : selectedTx.kind === 'income'
                    ? 'amount-income'
                    : selectedTx.kind === 'expense'
                    ? 'amount-expense'
                    : 'amount-transfer'
                }`}
              >
                {formatMinor(selectedTx.amountMinor)}
              </div>
              <p className="dialog-hero-meta">
                Tanggal: <strong>{selectedTx.occurredOn}</strong> · Status: <strong>{selectedTx.status}</strong>
              </p>
            </div>

            {selectedTx.status === 'reversed' && (
              <div className="dialog-alert-box warning">
                <AlertCircle size={18} />
                <p>
                  Transaksi ini berstatus <strong>reversed (dibatalkan)</strong> pada catatan historis.
                  Nominal ini tidak menambah saldo kas dan tidak dihitung dalam pemasukan operasional aktif.
                </p>
              </div>
            )}

            <h3>Alokasi Kantong ({selectedTx.allocations.length})</h3>
            <ul className="dialog-allocations-list">
              {selectedTx.allocations.map(a => {
                const p = pockets.find(pk => pk.id === a.pocketId);
                return (
                  <li key={`${a.direction}-${a.pocketId}`}>
                    <div className="alloc-info">
                      <strong>{p ? p.name : 'Kantong tidak ditemukan'}</strong>
                      <span className={`alloc-dir-pill ${a.direction}`}>
                        {a.direction === 'in' ? 'Masuk (+)' : 'Keluar (-)'}
                      </span>
                    </div>
                    <strong className="alloc-amount">{formatMinor(a.amountMinor)}</strong>
                  </li>
                );
              })}
            </ul>

            <div className="dialog-audit-box">
              <p>
                <strong>Referensi Audit:</strong> <code>{selectedTx.auditReference}</code>
              </p>
              {selectedTx.sourceReferences && selectedTx.sourceReferences.length > 0 && (
                <p>
                  <strong>Referensi Sumber:</strong>{' '}
                  <code>
                    {selectedTx.sourceReferences.map(s => `${s.kind} #${s.id}`).join(', ')}
                  </code>
                </p>
              )}
            </div>
          </div>
        </FinanceDialog>
      )}

      {/* MODAL REKENING & QRIS BENDAHARA */}
      {activeModal === 'bendahara' && (
        <FinanceDialog title="Rekening & QRIS Bendahara" onClose={closeModal}>
          <div className="finance-dialog-detail bendahara-payment-modal">
            {officialPaymentPocket ? (
              <div className="bendahara-payment-sections">
                {/* 1. INFORMASI REKENING BANK */}
                <div className="bendahara-section">
                  <h4 className="bendahara-section-title">
                    <Building2 size={16} /> Informasi Rekening Bank
                  </h4>
                  <div className="bendahara-account-card">
                    <div className="bendahara-account-row">
                      <span className="account-field-label">Nama Bank</span>
                      <strong className="account-field-val">
                        {officialPaymentPocket.provider || kinds[officialPaymentPocket.kind]}
                      </strong>
                    </div>
                    <div className="bendahara-account-row">
                      <span className="account-field-label">Nomor Rekening</span>
                      <div className="account-number-with-copy">
                        <code className="account-number-code">
                          {officialPaymentPocket.accountNumber || '—'}
                        </code>
                        {officialPaymentPocket.accountNumber && (
                          <button
                            type="button"
                            className="btn-copy-account"
                            onClick={() => handleCopyAccount(officialPaymentPocket.accountNumber!)}
                            title="Salin nomor rekening"
                          >
                            {copiedAccount ? <Check size={14} /> : <Copy size={14} />}
                            <span>{copiedAccount ? 'Tersalin' : 'Salin'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="bendahara-account-row">
                      <span className="account-field-label">Atas Nama</span>
                      <strong className="account-field-val">
                        {officialPaymentPocket.accountHolder || 'Studio PTV'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 2. QRIS BENDAHARA */}
                <div className="bendahara-section">
                  <h4 className="bendahara-section-title">
                    <QrCode size={16} /> QRIS Bendahara
                  </h4>
                  {officialPaymentPocket.qris ? (
                    <div className="bendahara-qris-card">
                      <div className={`qris-image-container ${isQrisZoomed ? 'zoomed' : ''}`}>
                        <img
                          src={officialPaymentPocket.qris.assetPath}
                          alt="QRIS Resmi Bendahara Studio PTV"
                          className="qris-image"
                        />
                      </div>
                      <p className="qris-merchant-name">
                        Merchant: <strong>{officialPaymentPocket.qris.merchantName || officialPaymentPocket.accountHolder || 'PTV STUDIO'}</strong>
                      </p>
                      {officialPaymentPocket.qris.nmid && (
                        <p className="qris-merchant-name" style={{ fontSize: '12px', marginTop: '2px' }}>
                          NMID: <code>{officialPaymentPocket.qris.nmid}</code>
                        </p>
                      )}
                      <div className="qris-actions-row">
                        <button
                          type="button"
                          className="finance-btn-pill secondary"
                          onClick={() => setIsQrisZoomed(!isQrisZoomed)}
                        >
                          <ZoomIn size={14} /> {isQrisZoomed ? 'Perkecil' : 'Perbesar QRIS'}
                        </button>
                        {data.canManage && (
                          <a
                            href={officialPaymentPocket.qris.assetPath}
                            download="QRIS-Bendahara-PTVPRO.png"
                            className="finance-btn-pill secondary"
                          >
                            <Download size={14} /> Unduh QRIS
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bendahara-qris-empty">
                      <p>Gambar QRIS resmi belum diunggah.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* EMPTY STATE JUJUR & AMAN SESUAI INSTRUKSI OPERATOR */
              <div className="bendahara-empty-state">
                <div className="bendahara-empty-icon-wrap">
                  <QrCode size={40} className="bendahara-empty-icon" />
                </div>
                <h3 className="bendahara-empty-title">
                  Informasi Rekening & QRIS Belum Dikonfigurasi
                </h3>
                <p className="bendahara-empty-desc">
                  Informasi rekening dan QRIS Bendahara belum dikonfigurasi.
                </p>
                <div className="bendahara-notice-box">
                  <AlertCircle size={18} className="bendahara-notice-icon" />
                  <div className="bendahara-notice-text">
                    <strong>Pemberitahuan Kasir Studio</strong>
                    <p>
                      Data rekening perbankan dan QRIS resmi Studio PTV belum dihubungkan ke sistem.
                      Untuk pembayaran kas kru, sewa alat, atau jasa produksi, silakan serahkan langsung
                      secara tunai ke Bendahara Studio atau hubungi Eksekutif.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="dialog-actions-row" style={{ marginTop: '24px' }}>
              <Button shape="pill" variant="secondary" onClick={closeModal}>
                Tutup
              </Button>
            </div>
          </div>
        </FinanceDialog>
      )}
    </div>
  );
}
