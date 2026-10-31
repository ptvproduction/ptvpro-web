import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Wallet,
  ArrowUpDown,
  Users,
  FileSpreadsheet,
  Settings,
  RefreshCw,
  Plus,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  QrCode,
  FileText,
} from 'lucide-react';
import { Button } from '@shared/components/Button';
import { useSessionStore } from '@core/session/sessionStore';
import { loadFinance, type FinanceSnapshot } from './financeFoundation';
import { loadFinanceOperational, type FinanceOperationalData } from './financeOperationalData';
import type { CanonicalTransaction } from './financeCanonical';
import { Finance3Overview } from './Finance3Overview';
import { Finance3Transactions } from './Finance3Transactions';
import { Finance3Pockets } from './Finance3Pockets';
import { Finance3KasKru } from './Finance3KasKru';
import { Finance3Piutang } from './Finance3Piutang';
import { Finance3Laporan } from './Finance3Laporan';
import { CatatTransaksiModal } from './components/CatatTransaksiModal';
import { TransactionDetailDrawer } from './components/TransactionDetailDrawer';
import { PengaturanKeuanganModal } from './components/PengaturanKeuanganModal';
import './finance3.css';

export type Finance3Tab =
  | 'ringkasan'
  | 'transaksi'
  | 'kantong'
  | 'kas-kru'
  | 'piutang'
  | 'laporan';

interface Finance3PageProps {
  initialData?: FinanceSnapshot;
  initialOperationalData?: FinanceOperationalData;
}

export function Finance3Page({ initialData, initialOperationalData }: Finance3PageProps = {}) {
  const user = useSessionStore(state => state.user);
  const [params, setParams] = useSearchParams();

  // Tab mapping for full feature navigation & backward compatibility
  const tabParam = params.get('tab');
  const getActiveTab = (tab: string | null): Finance3Tab => {
    if (tab === 'transaksi' || tab === 'pemasukan' || tab === 'pengeluaran') return 'transaksi';
    if (tab === 'kantong' || tab === 'qris') return 'kantong';
    if (tab === 'kas-kru' || tab === 'kas_kru') return 'kas-kru';
    if (tab === 'piutang' || tab === 'tagihan') return 'piutang';
    if (tab === 'laporan') return 'laporan';
    return 'ringkasan';
  };

  const [activeTab, setActiveTab] = useState<Finance3Tab>(() => getActiveTab(tabParam));
  const [data, setData] = useState<FinanceSnapshot | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  // Operational data state (semesters, kas_records, loans, feeDueDay)
  const [operationalData, setOperationalData] = useState<FinanceOperationalData | null>(
    initialOperationalData || null
  );
  const [operationalLoading, setOperationalLoading] = useState(false);
  const [operationalError, setOperationalError] = useState('');
  const [operationalRetry, setOperationalRetry] = useState(0);

  // Modals & Drawers state
  const [isCatatOpen, setIsCatatOpen] = useState(false);
  const [catatType, setCatatType] = useState<'income' | 'expense' | 'transfer'>('income');
  const [catatPocketId, setCatatPocketId] = useState<string | undefined>(undefined);
  const [catatMethod, setCatatMethod] = useState<'cash' | 'transfer' | 'qris'>('cash');
  const [catatDesc, setCatatDesc] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => tabParam === 'pengaturan');
  const [settingsInitialSubTab, setSettingsInitialSubTab] = useState<'umum' | 'kategori' | 'semester'>('umum');
  const [settingsInitialSemesterId, setSettingsInitialSemesterId] = useState<string | undefined>(undefined);
  const [selectedTx, setSelectedTx] = useState<CanonicalTransaction | null>(null);

  // Sync tab with URL
  useEffect(() => {
    if (tabParam === 'pengaturan') {
      setIsSettingsOpen(true);
    } else {
      setActiveTab(getActiveTab(tabParam));
    }
  }, [tabParam]);

  const handleSelectTab = (tab: string) => {
    if (tab === 'pengaturan') {
      setIsSettingsOpen(true);
      return;
    }
    setActiveTab(getActiveTab(tab));
    setParams({ tab });
  };

  // Fetch canonical finance data
  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError('');

    if (!user) {
      setLoading(false);
      return () => controller.abort();
    }

    loadFinance(controller.signal)
      .then(result => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch(reason => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Gagal memuat keuangan.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [user?.id, retry, initialData]);

  // Fetch operational finance data (semesters, kas_records, loans)
  useEffect(() => {
    if (initialOperationalData) {
      setOperationalData(initialOperationalData);
      setOperationalLoading(false);
      return;
    }
    if (initialData && !user) {
      return;
    }
    if (!user) return;

    const controller = new AbortController();
    setOperationalLoading(true);
    setOperationalError('');

    loadFinanceOperational(controller.signal)
      .then(result => {
        if (!controller.signal.aborted) setOperationalData(result);
      })
      .catch(reason => {
        if (!controller.signal.aborted) {
          setOperationalError(
            reason instanceof Error ? reason.message : 'Gagal memuat data operasional keuangan.'
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setOperationalLoading(false);
      });

    return () => controller.abort();
  }, [user?.id, retry, operationalRetry, initialData, initialOperationalData]);

  const canManage = !loading && !error && !!data?.canManage;
  const pockets = data?.canonical.state === 'available' ? data.canonical.pockets || [] : [];
  const categories = data?.canonical.state === 'available' ? data.canonical.categories || [] : [];

  const handleOpenCatat = (
    type: 'income' | 'expense' | 'transfer',
    options?: {
      pocketId?: string;
      paymentMethod?: 'cash' | 'transfer' | 'qris';
      description?: string;
    }
  ) => {
    setCatatType(type);
    setCatatPocketId(options?.pocketId);
    setCatatMethod(options?.paymentMethod || 'cash');
    setCatatDesc(options?.description || '');
    setIsCatatOpen(true);
  };

  const handleRefreshAll = () => {
    setRetry(v => v + 1);
    setOperationalRetry(v => v + 1);
  };

  return (
    <div className="finance3-container">
      {/* 1. Header Halaman */}
      <header className="finance3-header">
        <div className="finance3-header-text">
          <h1>Keuangan Studio</h1>
          <p>Pencatatan kas resmi, transparansi iuran, kantong & QRIS, piutang, serta pembukuan Finance 3.0 PTV.</p>
        </div>

        <div className="finance3-header-actions">
          {canManage && (
            <Button
              shape="pill"
              size="sm"
              variant="primary"
              onClick={() => handleOpenCatat('income')}
              style={{ background: '#0b5fbf', borderColor: '#0b5fbf' }}
            >
              <Plus size={15} /> Catat Transaksi
            </Button>
          )}

          <Button
            shape="pill"
            size="sm"
            variant="secondary"
            onClick={handleRefreshAll}
            disabled={loading}
            aria-label="Muat ulang keuangan"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span style={{ marginLeft: '4px' }}>Muat Ulang</span>
          </Button>

          {canManage && (
            <Button
              shape="pill"
              size="sm"
              variant="secondary"
              onClick={() => {
                setSettingsInitialSubTab('umum');
                setIsSettingsOpen(true);
              }}
              aria-label="Pengaturan Keuangan"
            >
              <Settings size={14} />
              <span style={{ marginLeft: '4px' }}>Pengaturan</span>
            </Button>
          )}
        </div>
      </header>

      {/* 2. Navigation Pill Tab Bar (Seluruh Modul Finance 3.0) */}
      <div className="finance3-tabs-wrapper">
        <nav className="finance3-tabs" aria-label="Navigasi Keuangan 3.0">
          <button
            type="button"
            className={`finance3-tab-btn ${activeTab === 'ringkasan' ? 'active' : ''}`}
            onClick={() => handleSelectTab('ringkasan')}
          >
            <Wallet size={15} /> Ringkasan Kas
          </button>
          <button
            type="button"
            className={`finance3-tab-btn ${activeTab === 'transaksi' ? 'active' : ''}`}
            onClick={() => handleSelectTab('transaksi')}
          >
            <ArrowUpDown size={15} /> Riwayat Transaksi
          </button>
          <button
            type="button"
            className={`finance3-tab-btn ${activeTab === 'kantong' ? 'active' : ''}`}
            onClick={() => handleSelectTab('kantong')}
          >
            <QrCode size={15} /> Kantong & QRIS
          </button>
          <button
            type="button"
            className={`finance3-tab-btn ${activeTab === 'kas-kru' ? 'active' : ''}`}
            onClick={() => handleSelectTab('kas-kru')}
          >
            <Users size={15} /> Iuran Kas Kru
          </button>
          <button
            type="button"
            className={`finance3-tab-btn ${activeTab === 'piutang' ? 'active' : ''}`}
            onClick={() => handleSelectTab('piutang')}
          >
            <FileText size={15} /> Piutang & Tagihan
          </button>
          <button
            type="button"
            className={`finance3-tab-btn ${activeTab === 'laporan' ? 'active' : ''}`}
            onClick={() => handleSelectTab('laporan')}
          >
            <FileSpreadsheet size={15} /> Laporan & Rekap
          </button>
        </nav>
      </div>

      {/* 3. Subline Status Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted, #6e8cae)', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {loading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={12} className="animate-spin" /> Memperbarui data pembukuan...
            </span>
          ) : data?.scope === 'own' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0f7a5a' }}>
              <ShieldCheck size={14} /> Akses Terbatas · Kru Studio
            </span>
          ) : data ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} style={{ color: '#0b5fbf' }} />
              Database Cloud Staging · {data.canManage ? 'Akses Penuh Pengelola' : 'Mode Baca Transparan'}
            </span>
          ) : (
            'Belum terhubung'
          )}
        </div>

        <div>
          Target Database: <code>swadgljnyelsjstqqxbm</code>
        </div>
      </div>

      {/* 4. Konten Aktif Berdasarkan Tab */}
      {loading && !data ? (
        <div className="finance3-card" style={{ padding: '48px 0', textAlign: 'center' }}>
          <RefreshCw size={24} className="animate-spin" style={{ color: '#0b5fbf', margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink, #0b2a4a)' }}>
            Memuat Data Keuangan Studio...
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted, #6e8cae)', marginTop: '4px' }}>
            Menghubungkan ke buku besar dan verifikasi ledger staging cloud.
          </div>
        </div>
      ) : error && !data ? (
        <div className="finance3-card" style={{ padding: '36px 20px', textAlign: 'center' }}>
          <AlertCircle size={32} style={{ color: '#dc2626', margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--ink, #0b2a4a)' }}>
            Gagal Memuat Keuangan
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--muted, #6e8cae)', margin: '0 0 16px 0' }}>{error}</p>
          <Button shape="pill" onClick={handleRefreshAll}>
            Coba Lagi
          </Button>
        </div>
      ) : (
        data && (
          <>
            {activeTab === 'ringkasan' && (
              <Finance3Overview
                data={data}
                operationalData={operationalData}
                onOpenCatat={t => handleOpenCatat(t)}
                onSelectTab={handleSelectTab}
                onSelectTransaction={setSelectedTx}
              />
            )}

            {activeTab === 'transaksi' && (
              <Finance3Transactions
                data={data}
                onOpenCatat={t => handleOpenCatat(t)}
                onSelectTransaction={setSelectedTx}
              />
            )}

            {activeTab === 'kantong' && (
              <Finance3Pockets
                data={data}
                canManage={canManage}
                initialPocketId={params.get('pocketId') || undefined}
                onOpenCatat={handleOpenCatat}
                onSelectTransaction={setSelectedTx}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onRefresh={handleRefreshAll}
              />
            )}

            {activeTab === 'kas-kru' && (
              <Finance3KasKru
                data={data}
                operationalData={operationalData}
                operationalLoading={operationalLoading}
                operationalError={operationalError}
                onRetryOperational={() => setOperationalRetry(v => v + 1)}
                onRefreshAll={handleRefreshAll}
                onOpenTariffSettings={semesterId => {
                  setSettingsInitialSubTab('semester');
                  setSettingsInitialSemesterId(semesterId);
                  setIsSettingsOpen(true);
                }}
              />
            )}

            {activeTab === 'piutang' && (
              <Finance3Piutang
                data={data}
                operationalData={operationalData}
                operationalLoading={operationalLoading}
                operationalError={operationalError}
                onRetryOperational={() => setOperationalRetry(v => v + 1)}
                onRefreshAll={handleRefreshAll}
              />
            )}

            {activeTab === 'laporan' && (
              <Finance3Laporan data={data} operationalData={operationalData} operationalLoading={operationalLoading} operationalError={operationalError} onRetryOperational={() => setOperationalRetry(v => v + 1)} />
            )}
          </>
        )
      )}

      {/* 5. Modals & Drawers */}
      <CatatTransaksiModal
        isOpen={isCatatOpen}
        onClose={() => setIsCatatOpen(false)}
        onSuccess={handleRefreshAll}
        initialType={catatType}
        initialPocketId={catatPocketId}
        initialPaymentMethod={catatMethod}
        initialDescription={catatDesc}
        categories={categories}
        pockets={pockets}
      />

      <TransactionDetailDrawer
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
        onSuccess={handleRefreshAll}
        canManage={canManage}
        categories={categories}
        pockets={pockets}
      />

      <PengaturanKeuanganModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        pockets={pockets}
        categories={categories}
        semesters={operationalData?.semesters}
        feeHistory={operationalData?.feeHistory}
        canManage={canManage}
        initialSubTab={settingsInitialSubTab}
        initialSemesterId={settingsInitialSemesterId}
        onSemesterTariffUpdated={({ semesters: updatedSemesters, feeHistory: updatedHistory }) => {
          setOperationalData(prev => {
            if (!prev) {
              return {
                source: 'staging',
                scope: 'global',
                ownerPtvId: 'PTV-001',
                writesEnabled: false,
                semesters: updatedSemesters || [],
                records: [],
                loans: [],
                feeDueDay: 10,
                feeHistory: updatedHistory || [],
              };
            }
            return {
              ...prev,
              semesters: updatedSemesters || prev.semesters,
              feeHistory: updatedHistory || prev.feeHistory,
            };
          });
        }}
        onRefresh={handleRefreshAll}
      />
    </div>
  );
}
