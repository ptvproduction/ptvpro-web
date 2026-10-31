import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { useCrewStore } from '@products/hub/kru/kruStore';
import type { FinanceSnapshot } from './financeFoundation';
import { loadFinanceOperational, type FinanceOperationalData } from './financeOperationalData';
import { FinanceKasKruView, FinancePiutangView, FinanceLaporanView } from './FinanceSections';
import { FinanceSectionSkeleton } from './components/skeletons';

export function FinanceOperationalWorkspace({ section, data }: {
  section: 'kas-kru' | 'piutang' | 'laporan'; data: FinanceSnapshot;
}) {
  const [result, setResult] = useState<FinanceOperationalData | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const { members, loading: crewLoading, error: crewError, refreshCrew } = useCrewStore();
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); setError('Waktu memuat data operasional habis. Coba lagi.'); }, 15000);
    setResult(null);
    setError('');
    loadFinanceOperational(controller.signal).then(value => {
      if (!controller.signal.aborted) setResult(value);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Gagal memuat data operasional.');
    }).finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, [retry, data]);

  if (error || (section !== 'piutang' && crewError)) {
    return (
      <Card standard="r03">
        <div className="finance-error-card" role="alert">
          <div className="finance-error-icon">
            <AlertCircle size={28} />
          </div>
          <h2>Gagal Memuat Data Operasional</h2>
          <p>{error || crewError}</p>
          <Button shape="pill" onClick={() => { setRetry(v => v + 1); if (crewError) void refreshCrew(); }}>
            Coba lagi
          </Button>
        </div>
      </Card>
    );
  }

  if (!result || (section !== 'piutang' && crewLoading)) {
    return (
      <div role="status" aria-busy="true" aria-label="Memuat data operasional dari Staging…">
        <FinanceSectionSkeleton section={section} />
        <span className="sr-only">Memuat data operasional dari Staging…</span>
      </div>
    );
  }

  if (section === 'laporan' && data.scope !== 'global') {
    return (
      <Card standard="r03">
        <div className="finance-access-card" role="status">
          <h2>Akses Laporan Terbatas</h2>
          <p>Laporan studio memerlukan izin baca keuangan global. Kas Kru dan Piutang saya tersedia pada tab masing-masing.</p>
        </div>
      </Card>
    );
  }

  const crew = result.scope === 'own' ? members.filter(member => member.ptv_id === result.ownerPtvId) : members;
  const operationalData = { ...data, canManage: data.canManage, writesEnabled: data.writesEnabled };
  return <>
    {!data.writesEnabled && (
      <p role="status" style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 12px 2px' }}>
        Mode Pemeliharaan Aktif (Write-Freeze): Data operasional dapat dibaca lengkap. Transaksi baru ditahan demi integritas buku Finance 2.0.
      </p>
    )}
    {result.scope === 'own' && (
      <p role="status" style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 10px 2px' }}>
        Detail Kas Kru dan Piutang terbatas pada data saya.
      </p>
    )}
    {section === 'kas-kru' && <FinanceKasKruView key={retry} data={operationalData} operational={result} crew={crew} onRefresh={() => setRetry(v => v + 1)} />}
    {section === 'piutang' && <FinancePiutangView key={retry} data={operationalData} operational={result} onRefresh={() => setRetry(v => v + 1)} />}
    {section === 'laporan' && <FinanceLaporanView data={operationalData} operational={result} crew={crew} />}
  </>;
}
