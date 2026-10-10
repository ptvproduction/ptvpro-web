import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { ContinuousSurface, PTV_CURVE_TOKENS } from '../../../design-system';

export const BerandaPage: React.FC = () => {
  const { user } = useSessionStore();
  const navigate = useNavigate();

  // Dynamic greeting based on current local hour (greet() in page-dasbor.php)
  const greet = () => {
    const h = new Date().getHours();
    return h < 11 ? 'Selamat Pagi' : h < 15 ? 'Selamat Siang' : h < 18 ? 'Selamat Sore' : 'Selamat Malam';
  };

  const upcomingEvent = {
    id: 'ev-001',
    name: 'Dokumentasi Teaser Video Sambutan Haul Akbar 2026',
    date: 'Hari ini',
    time: '08:30 WIB',
    loc: 'Studio Utama Lt 1 & Lapangan Pondok',
    crewCount: 6,
  };

  const nextAgendas = [
    {
      id: 'ev-002',
      name: 'Liputan Pengajian Rutin Ahad Pagi Masjid Jami',
      time: 'Ahad · 06:00 · Masjid Jami Pusat',
    },
    {
      id: 'ev-003',
      name: 'Podcast Santri Berkisah Episode 14',
      time: 'Senin · 13:00 · Studio Podcast Lt 2',
    },
    {
      id: 'ev-004',
      name: 'Shooting Profil Pesantren Progresif 2026',
      time: 'Rabu · 09:00 · Kompleks Asrama Putra',
    },
  ];

  const myLoans = [
    {
      id: 'loan-01',
      name: 'Sony FX3 Cinema Line Full-Frame Camera',
      unitCode: 'INV-001-U02',
      due: 'Kembali besok (10 Okt)',
      isLate: false,
    },
  ];

  const announcements = [
    {
      id: 'ann-01',
      title: 'Jadwal Piket Haul & Standby Tim Produksi 2026',
      body: 'Seluruh kru operasional yang bertugas pada sesi gladi resik diharapkan hadir 30 menit sebelum jadwal briefing.',
      by: 'Farid Technical',
      date: 'Kemarin',
      isImportant: true,
    },
    {
      id: 'ann-02',
      title: 'Pembaruan SOP Peminjaman Alat Lensa & Lighting',
      body: 'Wajib melakukan pemeriksaan fisik dan kelengkapan adapter/kabel sebelum meninggalkan dry cabinet studio.',
      by: 'Ahmad Executive',
      date: '3 hari lalu',
      isImportant: false,
    },
  ];

  const bentoItems = [
    {
      id: 'surat',
      title: 'Generator Surat Izin',
      desc: 'Penerbitan surat izin resmi',
      icon: 'fa-file-lines',
      color: '#2563eb',
      bg: 'rgba(37, 99, 235, 0.10)',
      border: 'rgba(37, 99, 235, 0.18)',
      path: '/hub/surat/generator',
    },
    {
      id: 'pinjam',
      title: 'Pinjam Alat',
      desc: 'Kamera, lensa & audio',
      icon: 'fa-boxes-stacked',
      color: '#4f46e5',
      bg: 'rgba(79, 70, 229, 0.10)',
      border: 'rgba(79, 70, 229, 0.18)',
      path: '/hub/peminjaman',
    },
    {
      id: 'kerusakan',
      title: 'Lapor Masalah',
      desc: 'Kendala alat & perbaikan',
      icon: 'fa-screwdriver-wrench',
      color: '#d97706',
      bg: 'rgba(217, 119, 6, 0.10)',
      border: 'rgba(217, 119, 6, 0.18)',
      path: '/hub/kerusakan',
    },
    {
      id: 'lostfound',
      title: 'Lost & Found',
      desc: 'Barang hilang & temuan',
      icon: 'fa-magnifying-glass-location',
      color: '#0d9488',
      bg: 'rgba(13, 148, 136, 0.10)',
      border: 'rgba(13, 148, 136, 0.18)',
      path: '/hub/lostfound',
    },
    {
      id: 'perizinan',
      title: 'Surat Tugas',
      desc: 'Disposisi tugas liputan',
      icon: 'fa-file-lines',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.10)',
      border: 'rgba(16, 185, 129, 0.18)',
      path: '/hub/perizinan',
    },
    {
      id: 'id',
      title: 'ID Digital',
      desc: 'Kartu kru & verifikasi QR',
      icon: 'fa-id-card',
      color: '#9333ea',
      bg: 'rgba(147, 51, 234, 0.10)',
      border: 'rgba(147, 51, 234, 0.18)',
      path: '/hub/id',
    },
  ];

  return (
    <div className="page">
      {/* ── HERO SECTION WITH EXACT PROFILE D CONTINUOUS CURVATURE ── */}
      <div className="hero">
        <div className="hero-hd">
          <div className="hero-greet">
            <p className="hero-eyebrow">{greet()},</p>
            <h1 className="hero-name">{user?.full_name || 'Kru Progresif TV'}</h1>
          </div>
        </div>
        <div id="berandaHeroWrap">
          <ContinuousSurface
            as="button"
            type="button"
            id="berandaHeroCard"
            className="hero-card hero-continuous"
            radius={PTV_CURVE_TOKENS['2xl']} // 28px Profile D canonical hero radius
            onClick={() => navigate('/hub/acara')}
            shadow="drop-shadow(0 14px 34px rgba(0,0,0,0.35)) drop-shadow(0 4px 12px rgba(0,0,0,0.15))"
            hoverShadow="drop-shadow(0 22px 48px rgba(0,0,0,0.45))"
            hoverBorderColor="rgba(255, 255, 255, 0.32)"
            borderColor="rgba(255, 255, 255, 0.14)"
            borderWidth={1}
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
              minHeight: '220px',
              padding: '28px 24px',
              marginTop: '16px',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div className="hero-card-cnt">
              <span className="lbl">{upcomingEvent.date.toUpperCase()}</span>
              <div className="ttl">{upcomingEvent.name}</div>
              <div className="hero-meta">
                <span>
                  <i className="fa-regular fa-clock" /> {upcomingEvent.time}
                </span>
                <span>
                  <i className="fa-solid fa-location-dot" /> {upcomingEvent.loc}
                </span>
                <span>
                  <i className="fa-solid fa-users" /> {upcomingEvent.crewCount} kru
                </span>
              </div>
            </div>
          </ContinuousSurface>
        </div>
      </div>

      {/* ── QUICK ACCESS (KHUSUS MOBILE: 4-COLUMN PROFILE D SQUIRCLE BUTTONS) ── */}
      <div className="quick-access-wrap only-mobile">
        <button
          type="button"
          className="qa-ref-item"
          title="Ajukan izin"
          onClick={() => navigate('/hub/perizinan')}
        >
          <ContinuousSurface
            width={58}
            height={58}
            radius={PTV_CURVE_TOKENS.lg} // 16px Profile D
            variant="soft"
            hoverElevation
            className="qa-ref-btn qa-ref-btn-continuous"
            shadow="drop-shadow(0 4px 10px rgba(15, 23, 42, 0.05))"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--b-700)',
              fontSize: '20px',
            }}
          >
            <i className="fa-solid fa-shield-halved" />
          </ContinuousSurface>
          <span className="qa-ref-label">Ajukan izin</span>
        </button>

        <button
          type="button"
          className="qa-ref-item"
          title="Pinjam alat"
          onClick={() => navigate('/hub/peminjaman')}
        >
          <ContinuousSurface
            width={58}
            height={58}
            radius={PTV_CURVE_TOKENS.lg} // 16px Profile D
            variant="soft"
            hoverElevation
            className="qa-ref-btn qa-ref-btn-continuous"
            shadow="drop-shadow(0 4px 10px rgba(15, 23, 42, 0.05))"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--b-700)',
              fontSize: '20px',
            }}
          >
            <i className="fa-solid fa-boxes-stacked" />
          </ContinuousSurface>
          <span className="qa-ref-label">Pinjam alat</span>
        </button>

        <button
          type="button"
          className="qa-ref-item"
          title="Lapor masalah"
          onClick={() => navigate('/hub/kerusakan')}
        >
          <ContinuousSurface
            width={58}
            height={58}
            radius={PTV_CURVE_TOKENS.lg} // 16px Profile D
            variant="soft"
            hoverElevation
            className="qa-ref-btn qa-ref-btn-continuous"
            shadow="drop-shadow(0 4px 10px rgba(15, 23, 42, 0.05))"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--b-700)',
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
          className="qa-ref-item"
          title="Lost & Found"
          onClick={() => navigate('/hub/lostfound')}
        >
          <ContinuousSurface
            width={58}
            height={58}
            radius={PTV_CURVE_TOKENS.lg} // 16px Profile D
            variant="soft"
            hoverElevation
            className="qa-ref-btn qa-ref-btn-continuous"
            shadow="drop-shadow(0 4px 10px rgba(15, 23, 42, 0.05))"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--b-700)',
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
              className="bento-card bento-continuous"
              radius={PTV_CURVE_TOKENS.xl} // 22px canonical card radius
              variant="soft"
              hoverElevation
              hoverBorderColor="rgba(147, 197, 253, 0.90)"
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
                className="bento-ic"
                width={44}
                height={44}
                radius={PTV_CURVE_TOKENS.md} // 12px concentric nested icon radius
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

      {/* ── 2 COLUMNS SECTION WITH PROFILE D CONTINUOUS SURFACES ── */}
      <div className="cols mt16">
        {/* Kolom Kiri: Agenda & Alat Saya */}
        <div>
          {/* Agenda Berikutnya */}
          <div id="berandaAgendaWrap">
            <ContinuousSurface
              className="sec sec-continuous"
              radius={PTV_CURVE_TOKENS.xl}
              variant="soft"
              style={{ padding: '18px 20px', marginTop: '8px', marginBottom: '16px' }}
            >
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
              <div className="list">
                {nextAgendas.map((item) => (
                  <ContinuousSurface
                    as="button"
                    type="button"
                    key={item.id}
                    className="li li-continuous"
                    radius={PTV_CURVE_TOKENS.md} // 12px Profile D
                    fillColor="#ffffff"
                    borderColor="rgba(226, 232, 240, 0.80)"
                    borderWidth={0.75}
                    shadow="drop-shadow(0 2px 4px rgba(15, 23, 42, 0.03))"
                    hoverElevation
                    hoverBorderColor="rgba(147, 197, 253, 0.85)"
                    onClick={() => navigate('/hub/acara')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <ContinuousSurface
                      className="li-ic"
                      width={36}
                      height={36}
                      radius={PTV_CURVE_TOKENS.sm} // 9px nested icon radius
                      fillColor="var(--b-050)"
                      borderColor="rgba(18, 115, 230, 0.12)"
                      borderWidth={0.75}
                      shadow={false}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--b-700)',
                        fontSize: '14px',
                        flexShrink: 0,
                      }}
                    >
                      <i className="fa-solid fa-calendar-day" />
                    </ContinuousSurface>
                    <span className="li-body">
                      <span className="li-t trunc">{item.name}</span>
                      <span className="li-s trunc">{item.time}</span>
                    </span>
                    <span className="chev">
                      <i className="fa-solid fa-chevron-right" />
                    </span>
                  </ContinuousSurface>
                ))}
              </div>
            </ContinuousSurface>
          </div>

          {/* Alat Saya */}
          <div id="berandaLoansWrap">
            <ContinuousSurface
              className="sec sec-continuous"
              radius={PTV_CURVE_TOKENS.xl}
              variant="soft"
              style={{ padding: '18px 20px', marginBottom: '16px' }}
            >
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
              {myLoans.length > 0 ? (
                <div className="list">
                  {myLoans.map((loan) => (
                    <ContinuousSurface
                      as="button"
                      type="button"
                      key={loan.id}
                      className="li li-continuous"
                      radius={PTV_CURVE_TOKENS.md} // 12px Profile D
                      fillColor="#ffffff"
                      borderColor="rgba(226, 232, 240, 0.80)"
                      borderWidth={0.75}
                      shadow="drop-shadow(0 2px 4px rgba(15, 23, 42, 0.03))"
                      hoverElevation
                      hoverBorderColor="rgba(147, 197, 253, 0.85)"
                      onClick={() => navigate('/hub/peminjaman')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 14px',
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      <ContinuousSurface
                        className="li-ic"
                        width={36}
                        height={36}
                        radius={PTV_CURVE_TOKENS.sm} // 9px nested icon radius
                        fillColor="var(--b-050)"
                        borderColor="rgba(18, 115, 230, 0.12)"
                        borderWidth={0.75}
                        shadow={false}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--b-700)',
                          fontSize: '14px',
                          flexShrink: 0,
                        }}
                      >
                        <i className="fa-solid fa-boxes-stacked" />
                      </ContinuousSurface>
                      <span className="li-body">
                        <span className="li-t trunc">{loan.name}</span>
                        <span className="li-s">{loan.due}</span>
                      </span>
                      <span className={`chip ${loan.isLate ? 'dang' : 'info'}`}>
                        <i className={loan.isLate ? 'fa-regular fa-circle-xmark' : 'fa-solid fa-arrows-rotate'} />
                        <span>{loan.isLate ? 'Terlambat' : 'Dipinjam'}</span>
                      </span>
                    </ContinuousSurface>
                  ))}
                </div>
              ) : (
                <div className="empty card">
                  <i className="fa-solid fa-boxes-stacked" />
                  <p>Tidak ada alat yang sedang kamu pinjam.</p>
                  <button
                    type="button"
                    className="btn sm pri"
                    onClick={() => navigate('/hub/peminjaman')}
                  >
                    Pinjam alat
                  </button>
                </div>
              )}
            </ContinuousSurface>
          </div>
        </div>

        {/* Kolom Kanan: Pengumuman & Dokumen Saya */}
        <div>
          {/* Pengumuman */}
          <div id="berandaAnnounceWrap">
            <ContinuousSurface
              className="sec sec-continuous"
              radius={PTV_CURVE_TOKENS.xl}
              variant="soft"
              style={{ padding: '18px 20px', marginTop: '8px', marginBottom: '16px' }}
            >
              <div className="sec-hd">
                <h2>Pengumuman</h2>
                <button
                  type="button"
                  className="link"
                  onClick={() => navigate('/hub/broadcast')}
                >
                  Semua
                </button>
              </div>
              <div className="stack">
                {announcements.map((ann) => (
                  <ContinuousSurface
                    as="button"
                    type="button"
                    key={ann.id}
                    className={`ann ann-continuous ${ann.isImportant ? 'high' : ''}`}
                    radius={PTV_CURVE_TOKENS.lg} // 16px Profile D
                    fillColor="#ffffff"
                    borderColor={ann.isImportant ? 'rgba(245, 158, 11, 0.55)' : 'rgba(226, 232, 240, 0.85)'}
                    borderWidth={ann.isImportant ? 1.0 : 0.75}
                    shadow={
                      ann.isImportant
                        ? 'drop-shadow(0 8px 18px rgba(245, 158, 11, 0.08)) drop-shadow(0 2px 4px rgba(15, 23, 42, 0.03))'
                        : 'drop-shadow(0 8px 18px rgba(15, 23, 42, 0.05)) drop-shadow(0 2px 4px rgba(15, 23, 42, 0.02))'
                    }
                    hoverElevation
                    onClick={() => navigate('/hub/broadcast')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '14px 16px',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <div className="row-b" style={{ alignItems: 'flex-start' }}>
                      <div className="tight">
                        <div className="t-md trunc">{ann.title}</div>
                        <div className="t-xs muted clamp2" style={{ marginTop: '4px' }}>
                          {ann.body}
                        </div>
                      </div>
                      {ann.isImportant && (
                        <span className="chip gold">
                          <i className="fa-solid fa-bolt" />
                          <span>Penting</span>
                        </span>
                      )}
                    </div>
                    <div className="t-xs muted" style={{ marginTop: '9px' }}>
                      {ann.by} &bull; {ann.date}
                    </div>
                  </ContinuousSurface>
                ))}
              </div>
            </ContinuousSurface>
          </div>

          {/* Dokumen Saya */}
          <div id="berandaDocsWrap">
            <ContinuousSurface
              className="sec sec-continuous"
              radius={PTV_CURVE_TOKENS.xl}
              variant="soft"
              style={{ padding: '18px 20px' }}
            >
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
                  className="stat stat-continuous"
                  radius={PTV_CURVE_TOKENS.lg} // 16px Profile D
                  variant="soft"
                  hoverElevation
                  onClick={() => navigate('/hub/dokumen')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px 12px',
                    textAlign: 'center',
                    width: '100%',
                  }}
                >
                  <b className="num">3</b>
                  <span>Disetujui</span>
                </ContinuousSurface>
                <ContinuousSurface
                  as="button"
                  type="button"
                  className="stat stat-continuous"
                  radius={PTV_CURVE_TOKENS.lg} // 16px Profile D
                  variant="soft"
                  hoverElevation
                  onClick={() => navigate('/hub/dokumen')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px 12px',
                    textAlign: 'center',
                    width: '100%',
                  }}
                >
                  <b className="num">1</b>
                  <span>Menunggu / revisi</span>
                </ContinuousSurface>
              </div>
            </ContinuousSurface>
          </div>
        </div>
      </div>
    </div>
  );
};
