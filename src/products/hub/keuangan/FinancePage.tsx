import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Settings, RefreshCw, AlertCircle, ShieldCheck, Sparkles, Lock } from 'lucide-react';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { useSessionStore } from '@core/session/sessionStore';
import {
  FINANCE_SECTIONS,
  FINANCE_SETTINGS,
  financeSection,
  loadFinance,
  type FinanceSnapshot,
} from './financeFoundation';
import { PocketWorkspace, TransactionWorkspace } from './FinanceWorkspace';
import { FinanceOverview } from './FinanceOverview';
import {
  FinanceKasKruView,
  FinancePiutangView,
  FinanceLaporanView,
  FinanceSettingsView,
} from './FinanceSections';
import './financeFoundation.css';
import { FinanceOperationalWorkspace } from './FinanceOperationalWorkspace';
import { isFinanceFixtureRuntime } from './financeRuntimeSafety';
import { FinanceSectionSkeleton } from './components/skeletons';

interface FinancePageProps {
  initialData?: FinanceSnapshot;
}

export function FinancePage({ initialData }: FinancePageProps = {}) {
  const userId = useSessionStore(state => state.user?.id);
  return <FinancePageContent key={userId || 'signed-out'} initialData={initialData} />;
}

function FinancePageContent({ initialData }: FinancePageProps) {
  const user = useSessionStore(state => state.user);
  const [params] = useSearchParams();
  const location = useLocation();
  const section = financeSection(params.get('tab'));
  const [data, setData] = useState<FinanceSnapshot | null>(initialData || null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!initialData);
  const [retry, setRetry] = useState(0);

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

  useEffect(() => {
    if (section === 'pengaturan' && location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
    }
  }, [section, location.hash, data]);

  const canManage = !loading && !error && !!data?.canManage;
  const operationalCloud = !isFinanceFixtureRuntime() && (section === 'kas-kru' || section === 'piutang' || section === 'laporan');
  const label = FINANCE_SECTIONS.find(([id]) => id === section)![1];

  return (
    <div className="finance-foundation">
      <header className="finance-heading">
        <div>
          <h1>Keuangan Studio</h1>
          <p>Pencatatan kas, buku utama Finance 2.0, dan pembukuan PTVPRO.</p>
        </div>
        <div className="finance-actions">
          <Button
            shape="pill"
            size="sm"
            variant="secondary"
            onClick={() => setRetry(value => value + 1)}
            disabled={loading}
            aria-label="Muat ulang keuangan"
          >
            <RefreshCw size={15} /> Muat ulang
          </Button>
          {canManage && section !== 'pengaturan' && (
            <Link className="finance-settings-link" to={`?tab=pengaturan#${FINANCE_SETTINGS[section]}`}>
              <Settings size={15} /> Pengaturan
            </Link>
          )}
        </div>
      </header>

      <div className="finance-nav-scroll-wrap">
        <nav className="finance-nav" aria-label="Navigasi keuangan">
          {FINANCE_SECTIONS.filter(([id]) => id !== 'pengaturan' || canManage).map(([id, text]) => (
            <Link key={id} aria-current={section === id ? 'page' : undefined} to={`?tab=${id}`}>
              {text}
            </Link>
          ))}
        </nav>
      </div>

      {data && !data.writesEnabled && (
        <div className="finance-maintenance-banner" role="status">
          <div className="maintenance-banner-icon">
            <Lock size={16} />
          </div>
          <div className="maintenance-banner-content">
            <div className="maintenance-banner-title">Mode Pemeliharaan Aktif (Write-Freeze)</div>
            <p className="maintenance-banner-text">
              Pencatatan mutasi kas ditahan sementara untuk validasi integritas buku Finance 2.0.
              Seluruh data transaksi, saldo, dan laporan tetap dapat dibaca secara aman.
            </p>
          </div>
        </div>
      )}

      <div className="finance-section-title">
        <h2>{label}</h2>
        <span>
          {loading && !data ? (
            <span className="finance-badge-pill" aria-live="polite">Memuat data pembukuan…</span>
          ) : loading && data ? (
            <span className="finance-badge-pill" aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={12} className="animate-spin" /> Memperbarui data…
            </span>
          ) : data?.scope === 'own' ? (
            <span className="finance-badge-pill crew">
              <ShieldCheck size={13} /> Data kas saya · Kru
            </span>
          ) : data ? (
            <span className="finance-badge-pill">
              <Sparkles size={13} /> Database Utama · {data.canManage ? 'Pengelola Keuangan' : 'Hanya Baca'}
            </span>
          ) : (
            'Belum terhubung'
          )}
        </span>
      </div>

      {loading && !data ? (
        <FinanceSectionSkeleton section={section} />
      ) : error && !data ? (
        <Card standard="r03">
          <div className="finance-error-card" role="alert">
            <div className="finance-error-icon">
              <AlertCircle size={28} />
            </div>
            <h2>Gagal Memuat Keuangan</h2>
            <p>{error}</p>
            <Button shape="pill" onClick={() => setRetry(value => value + 1)}>
              Coba lagi
            </Button>
          </div>
        </Card>
      ) : (
        data && (
          <div className="finance-content-container" aria-busy={loading}>
            {error && (
              <div
                style={{
                  padding: '10px 16px',
                  borderRadius: 'var(--ptv-curve-md, 12px)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: 'var(--danger, #ef4444)',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '14px',
                }}
                role="alert"
              >
                <AlertCircle size={16} />
                <span>Gagal memperbarui data terkini: {error}. Menampilkan data sebelumnya.</span>
              </div>
            )}
            {section === 'ringkasan' && (
              <FinanceOverview data={data} onRefresh={() => setRetry(v => v + 1)} />
            )}

            {section === 'transaksi' && (
              <TransactionWorkspace
                key={`${user?.id}-${params.get('tab')}`}
                data={data}
                initialKind={params.get('tab')}
                onSuccess={() => setRetry(v => v + 1)}
              />
            )}

            {section === 'kantong' && (
              <PocketWorkspace
                key={user?.id}
                data={data}
                onSuccess={() => setRetry(v => v + 1)}
              />
            )}

            {operationalCloud && <FinanceOperationalWorkspace key={user?.id} section={section as 'kas-kru' | 'piutang' | 'laporan'} data={data} />}
            {section === 'kas-kru' && !operationalCloud && (
              <FinanceKasKruView data={data} onRefresh={() => setRetry(v => v + 1)} />
            )}

            {section === 'piutang' && !operationalCloud && (
              <FinancePiutangView data={data} onRefresh={() => setRetry(v => v + 1)} />
            )}

            {section === 'laporan' && !operationalCloud && (
              <FinanceLaporanView data={data} />
            )}

            {section === 'pengaturan' && (
              canManage ? (
                <FinanceSettingsView canManage={canManage} data={data} onRefresh={() => setRetry(v => v + 1)} />
              ) : (
                <Card standard="r03">
                  <div className="finance-error-card" role="status">
                    <h2>Akses Pengaturan Terbatas</h2>
                    <p>Halaman Pengaturan Keuangan hanya dapat dikelola oleh Bendahara, Eksekutif, atau Root.</p>
                  </div>
                </Card>
              )
            )}

            {data.limited && (
              <p role="status">
                Ditampilkan maksimal 100 catatan per sumber; daftar ini belum mencakup seluruh riwayat.
              </p>
            )}

            <p className="finance-footnote">
              Data terhubung langsung dengan database utama PTVPRO (swadgljnyelsjstqqxbm). Mutasi diposting ke ledger resmi.
            </p>
          </div>
        )
      )}
    </div>
  );
}
