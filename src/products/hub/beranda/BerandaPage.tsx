import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import {
  Clock,
  MapPin,
  Users,
  ShieldAlert,
  Boxes,
  Wrench,
  Search,
  FileText,
  CreditCard,
  ChevronRight,
  Calendar,
  AlertCircle,
  Package,
} from 'lucide-react';

export const BerandaPage: React.FC = () => {
  const { user } = useSessionStore();
  const navigate = useNavigate();

  // Dynamic greeting based on current local hour
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr >= 4 && hr < 11) return 'Selamat pagi';
    if (hr >= 11 && hr < 15) return 'Selamat siang';
    if (hr >= 15 && hr < 18) return 'Selamat sore';
    return 'Selamat malam';
  };

  // Sample authentic data matching DB.events, DB.loans, DB.announcements, DB.docs
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

  const heroStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(180deg, rgba(10, 15, 25, 0.15) 0%, rgba(10, 15, 25, 0.3) 50%, rgba(10, 15, 25, 0.90) 88%, #0d121c 100%), linear-gradient(90deg, rgba(10, 15, 25, 0.85) 0%, rgba(10, 15, 25, 0.25) 50%, rgba(10, 15, 25, 0.05) 100%), url('/assets/images/hero-bg-default.webp')`,
  };

  return (
    <div className="page" style={{ paddingBottom: '32px' }}>
      {/* ── HERO SECTION ── */}
      <div className="hero">
        <div className="hero-hd">
          <div className="hero-greet">
            <p className="hero-eyebrow">{getGreeting()},</p>
            <h1 className="hero-name">{user?.full_name || 'Kru Progresif TV'}</h1>
          </div>
        </div>

        {/* Hero Card */}
        <div id="berandaHeroWrap">
          <button
            type="button"
            className="hero-card"
            style={heroStyle}
            onClick={() => navigate('/hub/acara')}
          >
            <div className="hero-card-cnt">
              <span className="lbl">{upcomingEvent.date.toUpperCase()}</span>
              <div className="ttl">{upcomingEvent.name}</div>
              <div className="hero-meta">
                <span>
                  <Clock size={14} /> {upcomingEvent.time}
                </span>
                <span>
                  <MapPin size={14} /> {upcomingEvent.loc}
                </span>
                <span>
                  <Users size={14} /> {upcomingEvent.crewCount} kru
                </span>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ── QUICK ACCESS (KHUSUS MOBILE: 4-COLUMN SQUIRCLE BUTTONS) ── */}
      <div className="quick-access-wrap only-mobile">
        <button
          type="button"
          className="qa-ref-item"
          title="Ajukan izin"
          onClick={() => navigate('/hub/perizinan')}
        >
          <span className="qa-ref-btn">
            <ShieldAlert size={22} />
          </span>
          <span className="qa-ref-label">Ajukan izin</span>
        </button>

        <button
          type="button"
          className="qa-ref-item"
          title="Pinjam alat"
          onClick={() => navigate('/hub/peminjaman')}
        >
          <span className="qa-ref-btn">
            <Boxes size={22} />
          </span>
          <span className="qa-ref-label">Pinjam alat</span>
        </button>

        <button
          type="button"
          className="qa-ref-item"
          title="Lapor masalah"
          onClick={() => navigate('/hub/kerusakan')}
        >
          <span className="qa-ref-btn">
            <Wrench size={22} />
          </span>
          <span className="qa-ref-label">Lapor masalah</span>
        </button>

        <button
          type="button"
          className="qa-ref-item"
          title="Lost & Found"
          onClick={() => navigate('/hub/lostfound')}
        >
          <span className="qa-ref-btn">
            <Search size={22} />
          </span>
          <span className="qa-ref-label">Lost &amp; Found</span>
        </button>
      </div>

      {/* ── BENTO GRID QUICK ACCESS (KHUSUS DESKTOP) ── */}
      <div className="sec only-desktop" style={{ padding: '16px', background: 'transparent', border: 'none', boxShadow: 'none' }}>
        <div className="bento-grid">
          <button
            type="button"
            className="bento-card"
            onClick={() => navigate('/hub/surat/generator')}
          >
            <span className="bento-ic blue">
              <FileText size={20} />
            </span>
            <span className="bento-body">
              <span className="bento-title">Generator Surat Izin</span>
              <span className="bento-desc">Penerbitan surat izin resmi</span>
            </span>
            <span className="bento-arrow">
              <ChevronRight size={16} />
            </span>
          </button>

          <button
            type="button"
            className="bento-card"
            onClick={() => navigate('/hub/peminjaman')}
          >
            <span className="bento-ic indigo">
              <Boxes size={20} />
            </span>
            <span className="bento-body">
              <span className="bento-title">Pinjam Alat</span>
              <span className="bento-desc">Kamera, lensa &amp; audio</span>
            </span>
            <span className="bento-arrow">
              <ChevronRight size={16} />
            </span>
          </button>

          <button
            type="button"
            className="bento-card"
            onClick={() => navigate('/hub/kerusakan')}
          >
            <span className="bento-ic amber">
              <Wrench size={20} />
            </span>
            <span className="bento-body">
              <span className="bento-title">Lapor Masalah</span>
              <span className="bento-desc">Kendala alat &amp; perbaikan</span>
            </span>
            <span className="bento-arrow">
              <ChevronRight size={16} />
            </span>
          </button>

          <button
            type="button"
            className="bento-card"
            onClick={() => navigate('/hub/lostfound')}
          >
            <span className="bento-ic teal">
              <Search size={20} />
            </span>
            <span className="bento-body">
              <span className="bento-title">Lost &amp; Found</span>
              <span className="bento-desc">Barang hilang &amp; temuan</span>
            </span>
            <span className="bento-arrow">
              <ChevronRight size={16} />
            </span>
          </button>

          <button
            type="button"
            className="bento-card"
            onClick={() => navigate('/hub/perizinan')}
          >
            <span className="bento-ic emerald">
              <FileText size={20} />
            </span>
            <span className="bento-body">
              <span className="bento-title">Surat Tugas</span>
              <span className="bento-desc">Disposisi tugas liputan</span>
            </span>
            <span className="bento-arrow">
              <ChevronRight size={16} />
            </span>
          </button>

          <button
            type="button"
            className="bento-card"
            onClick={() => navigate('/hub/id')}
          >
            <span className="bento-ic purple">
              <CreditCard size={20} />
            </span>
            <span className="bento-body">
              <span className="bento-title">ID Digital</span>
              <span className="bento-desc">Kartu kru &amp; verifikasi QR</span>
            </span>
            <span className="bento-arrow">
              <ChevronRight size={16} />
            </span>
          </button>
        </div>
      </div>

      {/* ── 2 COLUMNS SECTION ── */}
      <div className="cols mt16">
        {/* Kolom Kiri: Agenda & Alat Saya */}
        <div>
          {/* Agenda Berikutnya */}
          <div className="sec">
            <div className="sec-hd">
              <h3>
                <Calendar size={16} style={{ color: 'var(--b-600)' }} />
                Agenda berikutnya
              </h3>
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate('/hub/acara')}
              >
                Lihat semua
              </button>
            </div>
            <div className="list">
              {nextAgendas.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="li"
                  onClick={() => navigate('/hub/acara')}
                >
                  <span className="li-ic">
                    <Calendar size={16} />
                  </span>
                  <span className="li-body">
                    <span className="li-t">{item.name}</span>
                    <span className="li-s">{item.time}</span>
                  </span>
                  <span className="chev">
                    <ChevronRight size={16} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Alat Saya */}
          <div className="sec">
            <div className="sec-hd">
              <h3>
                <Package size={16} style={{ color: 'var(--b-600)' }} />
                Alat saya
              </h3>
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate('/hub/peminjaman')}
              >
                Riwayat
              </button>
            </div>
            <div className="list">
              {myLoans.map((loan) => (
                <button
                  type="button"
                  key={loan.id}
                  className="li"
                  onClick={() => navigate('/hub/peminjaman')}
                >
                  <span className="li-ic">
                    <Package size={16} />
                  </span>
                  <span className="li-body">
                    <span className="li-t">{loan.name}</span>
                    <span className="li-s">{loan.due}</span>
                  </span>
                  <span className={`chip ${loan.isLate ? 'dang' : 'info'}`}>
                    {loan.isLate ? 'Terlambat' : 'Dipinjam'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Pengumuman & Dokumen Saya */}
        <div>
          {/* Pengumuman */}
          <div className="sec">
            <div className="sec-hd">
              <h3>
                <AlertCircle size={16} style={{ color: 'var(--b-600)' }} />
                Pengumuman
              </h3>
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate('/hub/broadcast')}
              >
                Semua
              </button>
            </div>
            <div className="stack">
              {announcements.map((ann) => (
                <button
                  type="button"
                  key={ann.id}
                  className={`ann ${ann.isImportant ? 'high' : ''}`}
                  onClick={() => navigate('/hub/broadcast')}
                >
                  <div className="row-b">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="t-md">{ann.title}</div>
                      <div className="t-xs clamp2" style={{ color: 'var(--muted)', marginTop: '4px' }}>
                        {ann.body}
                      </div>
                    </div>
                    {ann.isImportant && <span className="chip gold">Penting</span>}
                  </div>
                  <div className="t-xs" style={{ color: 'var(--muted)', marginTop: '8px' }}>
                    {ann.by} &bull; {ann.date}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Dokumen Saya */}
          <div className="sec">
            <div className="sec-hd">
              <h3>
                <FileText size={16} style={{ color: 'var(--b-600)' }} />
                Dokumen saya
              </h3>
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate('/hub/dokumen')}
              >
                Buka
              </button>
            </div>
            <div className="grid-2">
              <button
                type="button"
                className="stat"
                onClick={() => navigate('/hub/dokumen')}
              >
                <b className="num">3</b>
                <span>Disetujui</span>
              </button>
              <button
                type="button"
                className="stat"
                onClick={() => navigate('/hub/dokumen')}
              >
                <b className="num">1</b>
                <span>Menunggu / revisi</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
