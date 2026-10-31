import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LivingHeader } from '../components/LivingHeader';
import { LauncherFooter } from '../components/LauncherFooter';
import { HelpDialogModal } from '../components/HelpDialogModal';
import { PortalInitScreen } from '../components/PortalInitScreen';
import { PortalManagedService } from '../../hub/portal-management/types';
import { useLivingPortalShell } from '../hooks/useLivingPortalShell';
import { usePortalSnapshot } from '../hooks/usePortalSnapshot';
import type { PortalSnapshot } from '../portalSnapshot';
import '../styles/livingPortal.css';

/**
 * Halaman status layanan publik. Memakai siklus hidup yang sama dengan portal utama:
 * layar inisialisasi dulu, lalu seluruh halaman dari satu snapshot published.
 */
export const LivingStatusPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const isPreviewDraft = searchParams.get('previewDraft') === 'true';

  useLivingPortalShell();
  const { state, isSlow, retry } = usePortalSnapshot({ includeDraft: isPreviewDraft });

  if (state.status === 'ready') {
    return <LivingStatusContent snapshot={state.snapshot} isPreviewDraft={isPreviewDraft} />;
  }

  return (
    <PortalInitScreen
      status={state.status}
      isSlow={isSlow}
      errorMessage={state.status === 'error' ? state.message : undefined}
      onRetry={retry}
    />
  );
};

export const LivingStatusContent: React.FC<{ snapshot: PortalSnapshot; isPreviewDraft?: boolean }> = ({
  snapshot,
  isPreviewDraft = false,
}) => {
  const { services, settings: portalSettings } = snapshot;

  const [filter, setFilter] = useState<'all' | 'issue' | 'ok'>('all');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const publicServices = services.filter((s) => s.pub === 1);
  const incidentServices = publicServices.filter((s) => s.st === 'incident');
  const maintServices = publicServices.filter((s) => s.st === 'maint');
  const okServices = publicServices.filter((s) => s.st === 'ok');
  const soonServices = publicServices.filter((s) => s.st === 'soon');
  const hasIssues = incidentServices.length > 0 || maintServices.length > 0;

  const latestUpdateFormatted = React.useMemo(() => {
    let latest = 0;
    for (const s of publicServices) {
      const ts = s.statusUpdatedAt ? new Date(s.statusUpdatedAt).getTime() : 0;
      if (ts > latest) latest = ts;
    }
    if (latest > 0) {
      return new Date(latest).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    return '—';
  }, [publicServices]);

  const filteredServices = publicServices.filter((s) => {
    if (filter === 'ok') return s.st === 'ok';
    if (filter === 'issue') return s.st === 'incident' || s.st === 'maint';
    return true;
  });

  const getStatusBadge = (st: PortalManagedService['st']) => {
    switch (st) {
      case 'ok':
        return <span className="lp-status-badge ok">● Beroperasi Normal</span>;
      case 'incident':
        return <span className="lp-status-badge incident">⚠️ Terjadi Gangguan</span>;
      case 'maint':
        return <span className="lp-status-badge maint">🔧 Pemeliharaan Sistem</span>;
      case 'soon':
        return <span className="lp-status-badge soon">○ Segera Hadir</span>;
    }
  };

  return (
    <div className="living-portal-root lp-portal-enter">
      <LivingHeader
        isScrolled={isScrolled}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenAnnouncement={() => {}}
      />

      {/* Main Status Container */}
      <main className="lp-section" style={{ minHeight: '80vh', paddingTop: '120px', paddingBottom: '80px' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
          {/* Header Status Page */}
          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span className="lp-service-cat-pill">STATUS SISTEM & LAYANAN PUBLIK</span>
              {isPreviewDraft && <span className="badge badge-warning" style={{ fontSize: '11px' }}>Preview Draft Mode</span>}
            </div>

            <h1 className="lp-title-editorial" style={{ margin: '0 0 16px', fontSize: 'clamp(40px, 6vw, 76px)', lineHeight: 1.02 }}>
              Kondisi Layanan. <em style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--lp-blue)' }}>Transparan.</em>
            </h1>

            <p style={{ color: 'var(--lp-ink-secondary)', fontSize: 'clamp(16px, 1.8vw, 20px)', maxWidth: '720px', lineHeight: 1.6, margin: 0 }}>
              Informasi terkini mengenai ketersediaan dan performa operasional seluruh instrumen digital resmi Progresif TV & keluarga yayasan.
            </p>
          </div>

          {/* Banner Status Agregat Dinamis & Akurat */}
          <div
            style={{
              background: hasIssues ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${hasIssues ? '#fecaca' : '#bbf7d0'}`,
              borderRadius: '20px',
              padding: '24px 28px',
              marginBottom: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              boxShadow: '0 4px 20px rgba(17, 18, 26, 0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: hasIssues ? '#fee2e2' : '#dcfce7',
                  color: hasIssues ? '#b91c1c' : '#15803d',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '24px',
                }}
              >
                {hasIssues ? '⚠️' : '✓'}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: hasIssues ? '#991b1b' : '#166534' }}>
                  {hasIssues
                    ? `${incidentServices.length + maintServices.length} Layanan Sedang Mengalami Penyesuaian`
                    : soonServices.length > 0
                    ? 'Seluruh Layanan Aktif Beroperasi Normal'
                    : 'Seluruh Layanan Beroperasi Normal'}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: hasIssues ? '#b91c1c' : '#15803d', opacity: 0.9 }}>
                  {hasIssues
                    ? 'Pemberitahuan resmi mengenai pemeliharaan atau kendala teknis pada layanan terkait.'
                    : soonServices.length > 0
                    ? `${okServices.length} layanan aktif · ${soonServices.length} segera hadir. Pembaruan dicatat secara berkala oleh pengelola sistem.`
                    : `Seluruh ${okServices.length} layanan digital beroperasi normal tanpa kendala.`}
                </p>
              </div>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--lp-ink-secondary)', textAlign: 'right' }}>
              <div>Sumber: <strong>Operator Portal PTVPRO</strong></div>
              <div>Pembaruan Terakhir: {latestUpdateFormatted}</div>
            </div>
          </div>

          {/* Filter Chips */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`lp-chip ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Semua Layanan ({publicServices.length})
            </button>
            <button
              type="button"
              className={`lp-chip ${filter === 'ok' ? 'active' : ''}`}
              onClick={() => setFilter('ok')}
            >
              Beroperasi Normal ({okServices.length})
            </button>
            {hasIssues && (
              <button
                type="button"
                className={`lp-chip ${filter === 'issue' ? 'active' : ''}`}
                onClick={() => setFilter('issue')}
              >
                Penyesuaian / Gangguan ({incidentServices.length + maintServices.length})
              </button>
            )}
          </div>

          {/* Grid Layanan Status */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
              {filteredServices.map((svc) => (
                <div
                  key={svc.id}
                  style={{
                    background: 'var(--lp-card, #ffffff)',
                    border: '1px solid rgba(216, 217, 226, 0.75)',
                    borderRadius: 'var(--lp-radius, 20px)',
                    padding: '24px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '210px',
                    boxShadow: '0 4px 20px rgba(17, 18, 26, 0.03)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <span className="lp-service-cat-pill">
                        {svc.cat === 'yayasan'
                          ? 'KELUARGA YAYASAN'
                          : svc.cat === 'season'
                          ? 'LAYANAN MUSIMAN'
                          : 'PROGRESIF TV'}
                      </span>
                      {getStatusBadge(svc.st)}
                    </div>

                    <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 800, color: 'var(--lp-ink)' }}>
                      {svc.name.id}
                    </h3>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--lp-ink-secondary)', lineHeight: 1.5 }}>
                      {svc.desc.id}
                    </p>

                    {svc.statusNote && (
                      <div
                        style={{
                          marginTop: '12px',
                          background: svc.st === 'incident' ? '#fef2f2' : svc.st === 'maint' ? '#fffbeb' : '#f8f9fd',
                          borderLeft: `3px solid ${svc.st === 'incident' ? '#ef4444' : svc.st === 'maint' ? '#f59e0b' : 'var(--lp-blue)'}`,
                          padding: '8px 12px',
                          borderRadius: '4px',
                          fontSize: '12.5px',
                          color: 'var(--lp-ink)',
                        }}
                      >
                        <strong>Catatan:</strong> {svc.statusNote}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(216, 217, 226, 0.5)' }}>
                    <span style={{ fontSize: '11.5px', color: 'var(--lp-ink-secondary)' }}>
                      {svc.statusUpdatedAt ? `Update: ${new Date(svc.statusUpdatedAt).toLocaleDateString('id-ID')}` : 'Status Terverifikasi'}
                    </span>
                    {svc.st === 'soon' ? (
                      <span
                        className="lp-pill"
                        style={{ padding: '6px 14px', fontSize: '11px', opacity: 0.6, cursor: 'not-allowed' }}
                      >
                        Segera Hadir
                      </span>
                    ) : (
                      <a
                        href={svc.href || svc.url || '#'}
                        target={svc.href?.startsWith('http') || svc.url?.startsWith('http') ? '_blank' : undefined}
                        rel={svc.href?.startsWith('http') || svc.url?.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="lp-pill dark"
                        style={{ padding: '6px 14px', fontSize: '11px', textDecoration: 'none' }}
                      >
                        Buka Layanan ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

          {/* Catatan Transparansi Footer */}
          <div style={{ marginTop: '48px', padding: '20px 24px', background: 'rgba(255,255,255,0.7)', borderRadius: '16px', border: '1px solid rgba(216, 217, 226, 0.6)' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700 }}>Transparansi & Metodologi Pelaporan</h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--lp-ink-secondary)', lineHeight: 1.6 }}>
              Kondisi operasional diverifikasi dan diperbarui secara terpusat oleh pengelola infrastruktur Progresif TV melalui PTV Hub. Status tidak diklaim sebagai monitoring otomatis jika belum terintegrasi dengan probe sistem. Jika Anda mengalami kendala saat mengakses layanan, hubungi Pusat Bantuan Resmi melalui tombol di kanan atas.
            </p>
          </div>
        </div>
      </main>

      <LauncherFooter
        totalServices={publicServices.length}
        onOpenHelp={() => setIsHelpOpen(true)}
        managedServices={services}
        footerSignature={portalSettings.footerSignature}
        footerCopyright={portalSettings.footerCopyright}
      />

      <HelpDialogModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        helpWaNumber={portalSettings.helpWaNumber}
      />
    </div>
  );
};
