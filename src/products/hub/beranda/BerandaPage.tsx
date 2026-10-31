import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { useOptionalAcara } from '../acara/context/AcaraContext';
import { berandaService } from './berandaService';
import { AcaraItem } from '../acara/types';
import { AcaraCard } from '../acara/components/AcaraCard';
import { DokumenStats } from '../dokumen-saya/dokumenService';
import {
  getWibCurrentInfo,
  formatRelDay,
  getGreeting,
  filterUpcomingEvents,
  MyLoanItem,
} from './berandaDataUtils';
import { ContinuousSurface, PTV_CURVE_TOKENS } from '../../../design-system';
import { SkeletonBase } from '@shared/components';
import { useInstantData } from '@shared/hooks/useInstantData';
import '../../../styles/beranda.css';

export const BerandaPage: React.FC = () => {
  const { user } = useSessionStore();
  const navigate = useNavigate();
  const acaraContext = useOptionalAcara();

  // Instant-First Persistent Cache: Instant display on remount, background revalidation
  const {
    data: dashboardData,
    isLoading,
    error: loadError,
    refetch: fetchDashboardData,
  } = useInstantData<{ events: AcaraItem[]; myLoans: MyLoanItem[]; docStats: DokumenStats | null }>({
    key: 'beranda_aggregated_data',
    fetcher: () => berandaService.getAggregatedData(user),
    ttlMs: 5 * 60 * 1000,
    initialFallback: { events: [], myLoans: [], docStats: null },
  });

  const events = acaraContext?.events?.length ? acaraContext.events : dashboardData.events;
  const myLoans = dashboardData.myLoans;
  const docStats = dashboardData.docStats;

  // Time in Asia/Jakarta timezone
  const [wibInfo, setWibInfo] = useState(() => getWibCurrentInfo());

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setWibInfo(getWibCurrentInfo());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Filter real upcoming events
  const upcomingEvents = filterUpcomingEvents(events, wibInfo.todayIso);
  const upcomingEvent = upcomingEvents[0] || null;
  const nextAgendas = upcomingEvents.slice(1, 4);

  // Document stats counts
  const approvedDocsCount = docStats?.disetujui ?? 0;
  const waitingDocsCount = (docStats?.menunggu ?? 0) + (docStats?.revisi ?? 0);
  const waitingDocsLabel = docStats && docStats.revisi > 0 ? 'Menunggu / revisi' : 'Menunggu';

  const bentoItems = [
    {
      id: 'surat',
      title: 'Generator Surat Izin',
      desc: 'Penerbitan surat izin resmi',
      icon: 'fa-file-lines',
      color: 'var(--shortcut-surat-fg)',
      bg: 'var(--shortcut-surat-bg)',
      border: 'var(--shortcut-surat-border)',
      hoverBorder: 'var(--shortcut-surat-hover-border)',
      shortcutClass: 'shortcut-surat',
      path: '/hub/surat/generator',
    },
    {
      id: 'pinjam',
      title: 'Pinjam Alat',
      desc: 'Kamera, lensa & audio',
      icon: 'fa-boxes-stacked',
      color: 'var(--shortcut-pinjam-fg)',
      bg: 'var(--shortcut-pinjam-bg)',
      border: 'var(--shortcut-pinjam-border)',
      hoverBorder: 'var(--shortcut-pinjam-hover-border)',
      shortcutClass: 'shortcut-pinjam',
      path: '/hub/peminjaman',
    },
    {
      id: 'kerusakan',
      title: 'Lapor Masalah',
      desc: 'Kendala alat & perbaikan',
      icon: 'fa-screwdriver-wrench',
      color: 'var(--shortcut-masalah-fg)',
      bg: 'var(--shortcut-masalah-bg)',
      border: 'var(--shortcut-masalah-border)',
      hoverBorder: 'var(--shortcut-masalah-hover-border)',
      shortcutClass: 'shortcut-masalah',
      path: '/hub/kerusakan',
    },
    {
      id: 'lostfound',
      title: 'Lost & Found',
      desc: 'Barang hilang & temuan',
      icon: 'fa-magnifying-glass-location',
      color: 'var(--shortcut-lostfound-fg)',
      bg: 'var(--shortcut-lostfound-bg)',
      border: 'var(--shortcut-lostfound-border)',
      hoverBorder: 'var(--shortcut-lostfound-hover-border)',
      shortcutClass: 'shortcut-lostfound',
      path: '/hub/lostfound',
    },
    {
      id: 'perizinan',
      title: 'Surat Tugas',
      desc: 'Disposisi tugas liputan',
      icon: 'fa-clipboard-check',
      color: 'var(--shortcut-tugas-fg)',
      bg: 'var(--shortcut-tugas-bg)',
      border: 'var(--shortcut-tugas-border)',
      hoverBorder: 'var(--shortcut-tugas-hover-border)',
      shortcutClass: 'shortcut-tugas',
      path: '/hub/perizinan',
    },
    {
      id: 'id',
      title: 'ID Digital',
      desc: 'Kartu kru & verifikasi QR',
      icon: 'fa-id-card',
      color: 'var(--shortcut-id-fg)',
      bg: 'var(--shortcut-id-bg)',
      border: 'var(--shortcut-id-border)',
      hoverBorder: 'var(--shortcut-id-hover-border)',
      shortcutClass: 'shortcut-id',
      path: '/hub/id',
    },
  ];

  return (
    <div className="page beranda-page">
      {/* Error Retry Banner */}
      {loadError && (
        <div
          role="alert"
          style={{
            background: 'var(--dang-bg, #FEF2F2)',
            border: '1px solid var(--dang-border, #FECACA)',
            borderRadius: 'var(--ptv-curve-md)',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: '13px',
            color: '#dc2626',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-triangle-exclamation" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={fetchDashboardData}
            style={{
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--ptv-curve-pill)',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* ── HERO SECTION WITH EXACT PROFILE D CONTINUOUS CURVATURE ── */}
      <div className="hero">
        <div className="hero-hd">
          <div className="hero-greet">
            <p className="hero-eyebrow">{getGreeting(wibInfo.currentHour)},</p>
            <h1 className="hero-name">{user?.full_name || 'Kru Progresif TV'}</h1>
          </div>
        </div>
        <div id="berandaHeroWrap">
          {isLoading ? (
            <div
              className="hero-card hero-continuous"
              style={{
                width: '100%',
                minHeight: '168px',
                padding: '24px 28px',
                marginTop: '16px',
                borderRadius: '28px',
                background: 'linear-gradient(135deg, rgba(13, 18, 28, 0.95), rgba(13, 18, 28, 0.85))',
                border: '0.75px solid rgba(255, 255, 255, 0.16)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SkeletonBase width="140px" height="20px" radius="9999px" style={{ background: 'rgba(255, 255, 255, 0.12)' }} />
                <SkeletonBase width="80px" height="18px" radius="9999px" style={{ background: 'rgba(255, 255, 255, 0.12)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '14px 0' }}>
                <SkeletonBase width="65%" height="24px" radius="6px" style={{ background: 'rgba(255, 255, 255, 0.15)' }} />
                <SkeletonBase width="40%" height="14px" radius="4px" style={{ background: 'rgba(255, 255, 255, 0.10)' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <SkeletonBase width="110px" height="28px" radius="9999px" style={{ background: 'rgba(255, 255, 255, 0.12)' }} />
              </div>
            </div>
          ) : upcomingEvent ? (
            <ContinuousSurface
              as="button"
              type="button"
              id="berandaHeroCard"
              className="hero-card hero-continuous"
              radius={PTV_CURVE_TOKENS['2xl']} // 28px Profile D canonical hero radius
              onClick={() => navigate(`/hub/acara/${upcomingEvent.id}`)}
              fillColor="#0d121c"
              shadow="drop-shadow(0 12px 28px rgba(11, 60, 116, 0.14)) drop-shadow(0 3px 8px rgba(0, 0, 0, 0.20))"
              hoverShadow="drop-shadow(0 18px 40px rgba(11, 60, 116, 0.22)) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.26))"
              hoverBorderColor="rgba(255, 255, 255, 0.32)"
              borderColor="rgba(255, 255, 255, 0.16)"
              borderWidth={0.75}
              hoverElevation
              backgroundOverlay={
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#0d121c',
                    backgroundImage: `linear-gradient(180deg, rgba(10, 15, 25, 0.15) 0%, rgba(10, 15, 25, 0.30) 50%, rgba(10, 15, 25, 0.90) 88%, #0d121c 100%), linear-gradient(90deg, rgba(10, 15, 25, 0.85) 0%, rgba(10, 15, 25, 0.25) 50%, rgba(10, 15, 25, 0.05) 100%), url('/assets/images/hero-bg-default.webp')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
              }
              style={{
                width: '100%',
                minHeight: '168px',
                padding: '24px 28px',
                marginTop: '16px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              <div className="hero-card-cnt">
                <span className="lbl">
                  {formatRelDay(upcomingEvent.date, wibInfo.todayIso, wibInfo.tomorrowIso).toUpperCase()}
                </span>
                <div className="ttl">{upcomingEvent.name}</div>
                <div className="hero-meta">
                  <span>
                    <i className="fa-regular fa-clock" /> {upcomingEvent.time}
                  </span>
                  <span>
                    <i className="fa-solid fa-location-dot" /> {upcomingEvent.loc}
                  </span>
                  <span>
                    <i className="fa-solid fa-users" /> {upcomingEvent.crew ? upcomingEvent.crew.length : 0} kru
                  </span>
                </div>
              </div>
            </ContinuousSurface>
          ) : (
            <ContinuousSurface
              as="button"
              type="button"
              id="berandaHeroCard"
              className="hero-card hero-continuous"
              radius={PTV_CURVE_TOKENS['2xl']}
              onClick={() => navigate('/hub/acara')}
              fillColor="#0d121c"
              shadow="drop-shadow(0 12px 28px rgba(11, 60, 116, 0.14)) drop-shadow(0 3px 8px rgba(0, 0, 0, 0.20))"
              hoverShadow="drop-shadow(0 18px 40px rgba(11, 60, 116, 0.22)) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.26))"
              hoverBorderColor="rgba(255, 255, 255, 0.32)"
              borderColor="rgba(255, 255, 255, 0.16)"
              borderWidth={0.75}
              hoverElevation
              backgroundOverlay={
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#0d121c',
                    backgroundImage: `linear-gradient(180deg, rgba(10, 15, 25, 0.15) 0%, rgba(10, 15, 25, 0.30) 50%, rgba(10, 15, 25, 0.90) 88%, #0d121c 100%), linear-gradient(90deg, rgba(10, 15, 25, 0.85) 0%, rgba(10, 15, 25, 0.25) 50%, rgba(10, 15, 25, 0.05) 100%), url('/assets/images/hero-bg-default.webp')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
              }
              style={{
                width: '100%',
                minHeight: '168px',
                padding: '24px 28px',
                marginTop: '16px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              <div className="hero-card-cnt">
                <span className="lbl">HARI INI</span>
                <div className="ttl">Tidak ada kegiatan terjadwal</div>
                <div className="hero-meta">
                  <span>
                    <i className="fa-solid fa-circle-info" /> Agenda berikutnya akan muncul di sini
                  </span>
                </div>
              </div>
            </ContinuousSurface>
          )}
        </div>
      </div>

      {/* ── QUICK ACCESS (KHUSUS MOBILE: 4-COLUMN PROFILE D SQUIRCLE BUTTONS) ── */}
      <div className="quick-access-wrap only-mobile">
        <button
          type="button"
          className="qa-ref-item shortcut-surat"
          title="Ajukan izin"
          onClick={() => navigate('/hub/perizinan')}
        >
          <ContinuousSurface
            width={58}
            height={58}
            radius={PTV_CURVE_TOKENS.lg}
            variant="soft"
            hoverElevation
            fillColor="var(--shortcut-surat-bg)"
            borderColor="var(--shortcut-surat-border)"
            hoverBorderColor="var(--shortcut-surat-hover-border)"
            className="qa-ref-btn qa-ref-btn-continuous"
            shadow="drop-shadow(0 4px 10px rgba(15, 23, 42, 0.05))"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--shortcut-surat-fg)',
              fontSize: '20px',
            }}
          >
            <i className="fa-solid fa-shield-halved" />
          </ContinuousSurface>
          <span className="qa-ref-label">Ajukan izin</span>
        </button>

        <button
          type="button"
          className="qa-ref-item shortcut-pinjam"
          title="Pinjam alat"
          onClick={() => navigate('/hub/peminjaman')}
        >
          <ContinuousSurface
            width={58}
            height={58}
            radius={PTV_CURVE_TOKENS.lg}
            variant="soft"
            hoverElevation
            fillColor="var(--shortcut-pinjam-bg)"
            borderColor="var(--shortcut-pinjam-border)"
            hoverBorderColor="var(--shortcut-pinjam-hover-border)"
            className="qa-ref-btn qa-ref-btn-continuous"
            shadow="drop-shadow(0 4px 10px rgba(15, 23, 42, 0.05))"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--shortcut-pinjam-fg)',
              fontSize: '20px',
            }}
          >
            <i className="fa-solid fa-boxes-stacked" />
          </ContinuousSurface>
          <span className="qa-ref-label">Pinjam alat</span>
        </button>

        <button
          type="button"
          className="qa-ref-item shortcut-masalah"
          title="Lapor masalah"
          onClick={() => navigate('/hub/kerusakan')}
        >
          <ContinuousSurface
            width={58}
            height={58}
            radius={PTV_CURVE_TOKENS.lg}
            variant="soft"
            hoverElevation
            fillColor="var(--shortcut-masalah-bg)"
            borderColor="var(--shortcut-masalah-border)"
            hoverBorderColor="var(--shortcut-masalah-hover-border)"
            className="qa-ref-btn qa-ref-btn-continuous"
            shadow="drop-shadow(0 4px 10px rgba(15, 23, 42, 0.05))"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--shortcut-masalah-fg)',
              fontSize: '20px',
            }}
          >
            <i className="fa-solid fa-screwdriver-wrench" />
          </ContinuousSurface>
          <span className="qa-ref-label">
            Lapor<br />masalah
          </span>
        </button>

        <button
          type="button"
          className="qa-ref-item shortcut-lostfound"
          title="Lost & Found"
          onClick={() => navigate('/hub/lostfound')}
        >
          <ContinuousSurface
            width={58}
            height={58}
            radius={PTV_CURVE_TOKENS.lg}
            variant="soft"
            hoverElevation
            fillColor="var(--shortcut-lostfound-bg)"
            borderColor="var(--shortcut-lostfound-border)"
            hoverBorderColor="var(--shortcut-lostfound-hover-border)"
            className="qa-ref-btn qa-ref-btn-continuous"
            shadow="drop-shadow(0 4px 10px rgba(15, 23, 42, 0.05))"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--shortcut-lostfound-fg)',
              fontSize: '20px',
            }}
          >
            <i className="fa-solid fa-magnifying-glass-location" />
          </ContinuousSurface>
          <span className="qa-ref-label">Lost &amp; Found</span>
        </button>
      </div>

      {/* ── BENTO GRID QUICK ACCESS (KHUSUS DESKTOP: PROFILE D SOFT SURFACE) ── */}
      <div className="sec only-desktop" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
        <div className="bento-grid">
          {bentoItems.map((item) => (
            <ContinuousSurface
              as="button"
              type="button"
              key={item.id}
              className={`bento-card bento-continuous ${item.shortcutClass}`}
              radius={PTV_CURVE_TOKENS.xl}
              variant="soft"
              hoverElevation
              hoverBorderColor={item.hoverBorder}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px 18px',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <ContinuousSurface
                className={`bento-ic ${item.shortcutClass}`}
                width={44}
                height={44}
                radius={PTV_CURVE_TOKENS.md}
                fillColor={item.bg}
                borderColor={item.border}
                borderWidth={0.75}
                shadow={false}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: item.color,
                  fontSize: '18px',
                  flexShrink: 0,
                }}
              >
                <i className={`fa-solid ${item.icon}`} />
              </ContinuousSurface>
              <span className="bento-body">
                <span className="bento-title">{item.title}</span>
                <span className="bento-desc">{item.desc}</span>
              </span>
              <span className="bento-arrow">
                <i className="fa-solid fa-chevron-right" />
              </span>
            </ContinuousSurface>
          ))}
        </div>
      </div>

      {/* ── 2 COLUMNS SECTION: EXACT LEGACY VISUAL RESTORATION ── */}
      <div className="cols mt16">
        {/* Kolom Kiri: Agenda & Alat Saya */}
        <div>
          {/* Agenda Berikutnya: Editorial List without card container */}
          <div className="sec" id="berandaAgendaWrap">
            <div className="sec-hd">
              <h2>Agenda berikutnya</h2>
              <button
                type="button"
                className="link"
                onClick={() => navigate('/hub/acara')}
              >
                Lihat semua
              </button>
            </div>
            {isLoading ? (
              <div className="agenda-editorial-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[1, 2].map((idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 14px', background: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--line-2, rgba(11, 42, 74, 0.06))' }}>
                    <SkeletonBase width="38px" height="38px" radius="10px" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                      <SkeletonBase width="65%" height="15px" radius="4px" />
                      <SkeletonBase width="40%" height="12px" radius="4px" />
                    </div>
                  </div>
                ))}
              </div>
            ) : nextAgendas.length > 0 ? (
              <div className="agenda-editorial-list">
                {nextAgendas.map((item) => (
                  <AcaraCard key={item.id} event={item} compact />
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: '20px 16px',
                  color: 'var(--muted)',
                  fontSize: '13px',
                  textAlign: 'center',
                  background: 'rgba(11, 42, 74, 0.02)',
                  borderRadius: 'var(--ptv-curve-md)',
                  border: '1px dashed var(--line)',
                }}
              >
                <i className="fa-solid fa-calendar-day" style={{ marginRight: '6px', opacity: 0.6 }} />
                Tidak ada agenda mendatang lainnya.
              </div>
            )}
          </div>

          {/* Alat Saya */}
          <div className="sec" id="berandaLoansWrap">
            <div className="sec-hd">
              <h2>Alat saya</h2>
              <button
                type="button"
                className="link"
                onClick={() => navigate('/hub/peminjaman')}
              >
                Riwayat
              </button>
            </div>
            {isLoading ? (
              <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--line-2, rgba(11, 42, 74, 0.06))' }}>
                  <SkeletonBase width="42px" height="42px" radius="10px" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <SkeletonBase width="55%" height="15px" radius="4px" />
                    <SkeletonBase width="35%" height="12px" radius="4px" />
                  </div>
                </div>
              </div>
            ) : myLoans.length > 0 ? (
              <div className="stack">
                {myLoans.map((loan) => (
                  <ContinuousSurface
                    as="button"
                    type="button"
                    key={loan.id}
                    className="equipment-card equipment-continuous"
                    radius={PTV_CURVE_TOKENS.xl}
                    variant="soft"
                    hoverElevation
                    onClick={() => navigate('/hub/peminjaman')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '16px 18px',
                      width: '100%',
                      textAlign: 'left',
                    }}
                  >
                    <ContinuousSurface
                      className="equipment-ic"
                      width={44}
                      height={44}
                      radius={PTV_CURVE_TOKENS.md}
                      fillColor="rgba(79, 70, 229, 0.10)"
                      borderColor="rgba(79, 70, 229, 0.18)"
                      borderWidth={0.75}
                      shadow={false}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#4F46E5',
                        fontSize: '18px',
                        flexShrink: 0,
                      }}
                    >
                      <i className="fa-solid fa-boxes-stacked" />
                    </ContinuousSurface>
                    <span className="equipment-body">
                      <span className="equipment-title">{loan.name}</span>
                      <span className="equipment-due">{loan.due}</span>
                    </span>
                    <span className={`chip ${loan.isLate ? 'dang' : 'warn'}`}>
                      <i className={loan.isLate ? 'fa-regular fa-circle-xmark' : 'fa-solid fa-clock'} />
                      <span>{loan.isLate ? 'Terlambat' : 'Dipinjam'}</span>
                    </span>
                  </ContinuousSurface>
                ))}
              </div>
            ) : (
              <ContinuousSurface
                className="empty card empty-continuous"
                radius={PTV_CURVE_TOKENS.xl}
                variant="soft"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px 16px',
                  textAlign: 'center',
                }}
              >
                <i className="fa-solid fa-boxes-stacked" style={{ fontSize: '28px', color: 'var(--muted)', marginBottom: '8px' }} />
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--muted)' }}>Tidak ada alat yang sedang kamu pinjam.</p>
                <ContinuousSurface
                  as="button"
                  type="button"
                  className="btn sm pri"
                  radius={PTV_CURVE_TOKENS.sm}
                  fillColor="var(--b-600, #1273E6)"
                  borderColor="rgba(11, 95, 191, 0.35)"
                  borderWidth={0.75}
                  shadow="drop-shadow(0 2px 6px rgba(18, 115, 230, 0.28))"
                  hoverElevation
                  onClick={() => navigate('/hub/peminjaman')}
                  style={{
                    padding: '6px 14px',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Pinjam alat
                </ContinuousSurface>
              </ContinuousSurface>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Dokumen Saya */}
        <div>
          {/* Dokumen Saya: 2-column Stat Cards */}
          <div className="sec" id="berandaDocsWrap">
            <div className="sec-hd">
              <h2>Dokumen saya</h2>
              <button
                type="button"
                className="link"
                onClick={() => navigate('/hub/dokumen')}
              >
                Buka
              </button>
            </div>
            <div className="grid-2">
              <ContinuousSurface
                as="button"
                type="button"
                className="stat-card stat-continuous stat-approved"
                radius={PTV_CURVE_TOKENS.xl}
                variant="soft"
                hoverElevation
                hoverBorderColor="rgba(15, 122, 90, 0.40)"
                onClick={() => navigate('/hub/dokumen')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: '16px 18px',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <b className="num num-ok">{approvedDocsCount}</b>
                <span>Disetujui</span>
              </ContinuousSurface>
              <ContinuousSurface
                as="button"
                type="button"
                className="stat-card stat-continuous stat-pending"
                radius={PTV_CURVE_TOKENS.xl}
                variant="soft"
                hoverElevation
                hoverBorderColor="rgba(217, 119, 6, 0.40)"
                onClick={() => navigate('/hub/dokumen')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: '16px 18px',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <b className="num num-warn">{waitingDocsCount}</b>
                <span>{waitingDocsLabel}</span>
              </ContinuousSurface>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
