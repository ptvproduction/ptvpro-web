import React, { useMemo } from 'react';
import { useSessionStore } from '@core/session';
import {
  SEO_KPIS,
  SEO_WEEKLY_VISITS,
  SEO_TOP_KEYWORDS,
  SeoKpi,
  SeoBarData,
  SeoKeyword,
} from './fixtures';
import '@/styles/seo.css';

export interface SeoPageProps {
  kpis?: SeoKpi[];
  weeklyVisits?: SeoBarData[];
  topKeywords?: SeoKeyword[];
}

export const SeoPage: React.FC<SeoPageProps> = ({
  kpis = SEO_KPIS,
  weeklyVisits = SEO_WEEKLY_VISITS,
  topKeywords = SEO_TOP_KEYWORDS,
}) => {
  const { can } = useSessionStore();
  const hasAccess = can('settings.system');

  // Nilai maksimum untuk proporsi tinggi grafik batang
  const maxVisits = useMemo(() => {
    if (!weeklyVisits.length) return 100;
    return Math.max(...weeklyVisits.map((item) => item.visits));
  }, [weeklyVisits]);

  if (!hasAccess) {
    return (
      <div className="seo-page">
        <div className="seo-notice-banner" style={{ borderColor: 'var(--warn-border, rgba(217, 119, 6, 0.3))' }}>
          <div className="seo-notice-icon" style={{ background: 'var(--warn-bg, #FCF0D6)', color: 'var(--warn, #9A6B08)' }}>
            <i className="fa-solid fa-lock" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ink)' }}>Akses Khusus Eksekutif</div>
            <p className="seo-notice-text">
              Dashboard SEO &amp; Analytics hanya dapat diakses oleh akun pimpinan berwenang (<code>settings.system</code>).
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="seo-page">
      {/* Header & Judul */}
      <div className="seo-header">
        <h1 className="seo-title">SEO &amp; Analytics</h1>
        <p className="seo-subtitle">
          Ringkasan performa web, volume kunjungan pekanan, dan peringkat pencarian organik Progresif TV.
        </p>
      </div>

      {/* Notice & Disclaimer Transparansi Data */}
      <div className="seo-notice-banner" role="status" aria-label="Informasi Sumber Data">
        <div className="seo-notice-icon">
          <i className="fa-solid fa-chart-line" />
        </div>
        <div className="seo-notice-text">
          <b>Telemetri Internal:</b> Data metrik dan pencarian berbasis catatan log agregat portal media Progresif TV. Tidak memerlukan koneksi API pihak ketiga.
        </div>
      </div>

      {/* A. Empat KPI Bento Grid */}
      <div className="seo-kpi-grid">
        {kpis.map((kpi) => (
          <div key={kpi.id} className="seo-kpi-card">
            <div className="seo-kpi-top">
              <span className="seo-kpi-label">{kpi.title}</span>
              <div className="seo-kpi-icon">
                <i className={kpi.icon} />
              </div>
            </div>
            <div>
              <div className="seo-kpi-value">{kpi.value}</div>
              {kpi.trend && (
                <div className={`seo-kpi-badge ${kpi.trendType === 'neutral' ? 'neutral' : ''}`}>
                  <i className={kpi.trendType === 'neutral' ? 'fa-solid fa-check' : 'fa-solid fa-arrow-trend-up'} />
                  <span>{kpi.trend}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* B. Grafik Kunjungan Pekan Ini */}
      <div className="seo-section">
        <div className="seo-section-header">
          <h2 className="seo-section-title">Kunjungan Pekan Ini</h2>
          <p className="seo-section-desc">Distribusi jumlah pengunjung 7 hari terakhir (Senin–Minggu)</p>
        </div>

        <div className="seo-chart-card">
          <div className="seo-bars-wrap" role="img" aria-label="Grafik Batang Kunjungan Pekan Ini">
            {weeklyVisits.map((item) => {
              const heightPercent = maxVisits > 0 ? (item.visits / maxVisits) * 100 : 0;
              const isPeak = item.visits === maxVisits;

              return (
                <div
                  key={item.day}
                  className={`seo-bar-col ${isPeak ? 'peak' : ''}`}
                  title={`${item.label}: ${item.visits} kunjungan`}
                >
                  <span className="seo-bar-val-pop">{item.visits}</span>
                  <div
                    className="seo-bar-pill"
                    style={{ height: `${heightPercent.toFixed(1)}%` }}
                  />
                  <span className="seo-bar-label">{item.day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* C. Kata Kunci Teratas */}
      <div className="seo-section">
        <div className="seo-section-header">
          <h2 className="seo-section-title">Kata Kunci Teratas</h2>
          <p className="seo-section-desc">Query pencarian Google organik dengan jumlah klik terbanyak</p>
        </div>

        <div className="seo-keywords-card">
          <div className="seo-kw-list">
            {topKeywords.map((kw, idx) => (
              <div key={kw.id} className="seo-kw-item">
                <div className={`seo-kw-rank ${idx === 0 ? 'top' : ''}`}>
                  {`#${kw.position}`}
                </div>
                <div className="seo-kw-body">
                  <div className="seo-kw-title">{kw.keyword}</div>
                  <div className="seo-kw-sub">
                    <span>{`Peringkat ke-${kw.position} Google Search`}</span>
                  </div>
                </div>
                <div className="seo-kw-stats">
                  <div className="seo-kw-clicks">
                    <div className="seo-kw-clicks-val">{kw.clicks}</div>
                    <div className="seo-kw-clicks-lbl">Klik Organik</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
