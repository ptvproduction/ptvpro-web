import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { AppCapability } from '@core/policy';

interface SidebarItemDef {
  key: string;
  label: string;
  path: string;
  iconClass: string;
  capability?: AppCapability;
  isExternal?: boolean;
}

interface SidebarGroupDef {
  groupName: string;
  items: SidebarItemDef[];
}

/**
 * 7 Authoritative Sidebar Groups ported 1:1 from page-dasbor.php (SIDEBAR definition)
 */
const SIDEBAR_GROUPS: SidebarGroupDef[] = [
  {
    groupName: 'Utama',
    items: [
      {
        key: 'beranda',
        label: 'Beranda',
        path: '/hub/beranda',
        iconClass: 'fa-solid fa-house',
        capability: 'hub.access',
      },
    ],
  },
  {
    groupName: 'Operasional',
    items: [
      {
        key: 'acara',
        label: 'Acara',
        path: '/hub/acara',
        iconClass: 'fa-solid fa-calendar-day',
        capability: 'events.view',
      },
      {
        key: 'kalender',
        label: 'Kalender',
        path: '/hub/kalender',
        iconClass: 'fa-solid fa-calendar-days',
        capability: 'calendar.view',
      },
      {
        key: 'catatan',
        label: 'Catatan Bersama',
        path: '/hub/catatan',
        iconClass: 'fa-solid fa-note-sticky',
        capability: 'notes.view',
      },
    ],
  },
  {
    groupName: 'Peralatan',
    items: [
      {
        key: 'inventaris',
        label: 'Inventaris',
        path: '/hub/inventaris',
        iconClass: 'fa-solid fa-boxes-stacked',
        capability: 'inventory.view',
      },
      {
        key: 'nilaiInventaris',
        label: 'Nilai Inventaris',
        path: '/hub/inventaris/nilai',
        iconClass: 'fa-solid fa-receipt',
        capability: 'inventory.valuation.view',
      },
      {
        key: 'peminjaman',
        label: 'Peminjaman',
        path: '/hub/peminjaman',
        iconClass: 'fa-solid fa-right-left',
        capability: 'loans.view',
      },
      {
        key: 'kerusakan',
        label: 'Lapor Kerusakan',
        path: '/hub/kerusakan',
        iconClass: 'fa-solid fa-screwdriver-wrench',
        capability: 'damage.view',
      },
      {
        key: 'lostfound',
        label: 'Lost & Found',
        path: '/hub/lostfound',
        iconClass: 'fa-solid fa-magnifying-glass-location',
        capability: 'lostfound.view',
      },
    ],
  },
  {
    groupName: 'Kru & Komunikasi',
    items: [
      {
        key: 'kru',
        label: 'Manajemen Kru',
        path: '/hub/kru',
        iconClass: 'fa-solid fa-users',
        capability: 'crew.view',
      },
      {
        key: 'id',
        label: 'ID Digital',
        path: '/hub/id',
        iconClass: 'fa-solid fa-id-card',
        capability: 'id.view',
      },
      {
        key: 'dokumen',
        label: 'Dokumen Saya',
        path: '/hub/dokumen',
        iconClass: 'fa-solid fa-file-lines',
        capability: 'documents.view',
      },
      {
        key: 'kontak',
        label: 'Kontak Internal',
        path: '/hub/kontak',
        iconClass: 'fa-solid fa-phone',
        capability: 'contacts.internal.view',
      },
      {
        key: 'kontakEksternal',
        label: 'Kontak Eksternal',
        path: '/hub/kontak-eksternal',
        iconClass: 'fa-solid fa-users',
        capability: 'contacts.external.view',
      },
    ],
  },
  {
    groupName: 'Administrasi & Verifikasi',
    items: [
      {
        key: 'generatorIzin',
        label: 'Generator Surat Izin',
        path: '/hub/surat/generator',
        iconClass: 'fa-solid fa-file-lines',
        capability: 'documents.generate',
      },
      {
        key: 'perizinan',
        label: 'Pengajuan Perizinan',
        path: '/hub/perizinan',
        iconClass: 'fa-solid fa-shield-halved',
        capability: 'documents.request',
      },
      {
        key: 'verifikasiSurat',
        label: 'Keabsahan Dokumen',
        path: 'https://progresiftv.id/verifikasi-surat/',
        iconClass: 'fa-solid fa-shield-halved',
        isExternal: true,
      },
      {
        key: 'verifikasiIdentitas',
        label: 'Verifikasi Identitas',
        path: 'https://progresiftv.id/verifikasi-identitas/',
        iconClass: 'fa-solid fa-id-card',
        isExternal: true,
      },
      {
        key: 'arsip',
        label: 'Surat & Arsip',
        path: '/hub/arsip',
        iconClass: 'fa-solid fa-box-archive',
        capability: 'documents.archive.view',
      },
      {
        key: 'keuangan',
        label: 'Keuangan',
        path: '/hub/keuangan',
        iconClass: 'fa-solid fa-receipt',
        capability: 'finance.view',
      },
    ],
  },
  {
    groupName: 'Media',
    items: [
      {
        key: 'broadcast',
        label: 'Broadcast',
        path: '/hub/broadcast',
        iconClass: 'fa-solid fa-bullhorn',
        capability: 'broadcast.view',
      },
      {
        key: 'projectHaul',
        label: 'Haul & Harlah PPBS',
        path: '/hub/haul',
        iconClass: 'fa-solid fa-calendar-day',
        capability: 'projecthaul.view',
      },
      {
        key: 'seo',
        label: 'SEO & Analytics',
        path: '/hub/seo',
        iconClass: 'fa-solid fa-chart-simple',
        capability: 'settings.system',
      },
    ],
  },
  {
    groupName: 'Sistem',
    items: [
      {
        key: 'pengaturan',
        label: 'Pengaturan',
        path: '/hub/pengaturan',
        iconClass: 'fa-solid fa-gear',
        capability: 'settings.personal',
      },
    ],
  },
];

const BREADCRUMB_MAP: Record<string, string> = {
  '/hub': 'Beranda',
  '/hub/beranda': 'Beranda',
  '/hub/kru': 'Manajemen Kru',
  '/hub/inventaris': 'Aset Inventaris Progresif TV',
  '/hub/inventaris/nilai': 'Nilai Inventaris PTV',
  '/hub/peminjaman': 'Peminjaman Alat',
  '/hub/acara': 'Agenda Acara',
  '/hub/kalender': 'Kalender Kegiatan',
  '/hub/catatan': 'Catatan Bersama',
  '/hub/kerusakan': 'Lapor Kerusakan',
  '/hub/lostfound': 'Lost & Found',
  '/hub/id': 'ID Digital Kru',
  '/hub/dokumen': 'Dokumen Saya',
  '/hub/kontak': 'Kontak Internal',
  '/hub/kontak-eksternal': 'Kontak Eksternal',
  '/hub/perizinan': 'Pengajuan Perizinan',
  '/hub/surat/generator': 'Generator Surat Izin',
  '/hub/arsip': 'Surat & Arsip',
  '/hub/keuangan': 'Keuangan & Kas PTV',
  '/hub/broadcast': 'Broadcast & Pengumuman',
  '/hub/haul': 'Haul & Harlah PPBS',
  '/hub/seo': 'SEO & Analytics',
  '/hub/pengaturan': 'Pengaturan Sistem',
};

export const HubShell: React.FC = () => {
  const { user, logout, can } = useSessionStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [isDark, setIsDark] = useState<boolean>(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  });

  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  useEffect(() => {
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('ptv-theme', theme);
    } catch {
      // ignore
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const currentPath = location.pathname;
  const currentCrumb = BREADCRUMB_MAP[currentPath] || 'Beranda';

  const userInitials = (user?.full_name || 'PTV')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'P';

  const isTabActive = (tab: string) => {
    if (tab === 'home') return currentPath === '/hub' || currentPath === '/hub/beranda';
    if (tab === 'acara') return currentPath.startsWith('/hub/acara') || currentPath.startsWith('/hub/kalender');
    if (tab === 'alat') return currentPath.startsWith('/hub/inventaris') || currentPath.startsWith('/hub/peminjaman');
    if (tab === 'more') return isMoreOpen;
    return false;
  };

  return (
    <>
      {/* ── DESKTOP SIDEBAR 1:1 DARI shellHTML() ── */}
      <aside className="side" id="side">
        <div className="side-brand">
          <a
            href="#beranda"
            className="brand-logo-link"
            onClick={(e) => {
              e.preventDefault();
              navigate('/hub/beranda');
            }}
            aria-label="Progresif TV"
          >
            <span
              className="brand-logo-gradient"
              style={{ '--logo-url': "url('/assets/images/ptv-logo-white.webp')" } as React.CSSProperties}
              role="img"
              aria-label="Progresif TV"
            />
          </a>
        </div>

        <div className="side-scroll" id="sideNav">
          {SIDEBAR_GROUPS.map((grp) => {
            const accessibleItems = grp.items.filter((item) => !item.capability || can(item.capability));
            if (!accessibleItems.length) return null;

            return (
              <div className="side-grp" key={grp.groupName}>
                <p>{grp.groupName}</p>
                {accessibleItems.map((item) => {
                  if (item.isExternal) {
                    return (
                      <a
                        key={item.key}
                        href={item.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="snav"
                        style={{ textDecoration: 'none' }}
                      >
                        <i className={item.iconClass} />
                        <span>{item.label}</span>
                        <i
                          className="fa-solid fa-arrow-up-right-from-square"
                          style={{ fontSize: '10px', marginLeft: 'auto', opacity: 0.6 }}
                        />
                      </a>
                    );
                  }

                  const isActive = currentPath === item.path;

                  return (
                    <NavLink
                      key={item.key}
                      to={item.path}
                      className={`snav ${isActive ? 'on' : ''}`}
                    >
                      <i className={item.iconClass} />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="side-foot">
          <button
            type="button"
            className="snav"
            onClick={toggleTheme}
            data-act="theme"
          >
            <i className={isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'} />
            <span>{isDark ? 'Mode terang' : 'Mode gelap'}</span>
          </button>
          <button
            type="button"
            className="snav"
            onClick={logout}
            data-act="logout"
          >
            <i className="fa-solid fa-arrow-right-from-bracket" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* ── HEADER 1:1 DARI shellHTML() ── */}
      <header className="hdr">
        <div className="hdr-in">
          <div className="brand">
            <a
              href="#beranda"
              className="brand-logo-link"
              onClick={(e) => {
                e.preventDefault();
                navigate('/hub/beranda');
              }}
              aria-label="Progresif TV"
            >
              <span
                className="brand-logo-gradient"
                style={{ '--logo-url': "url('/assets/images/ptv-logo-white.webp')" } as React.CSSProperties}
                role="img"
                aria-label="Progresif TV"
              />
            </a>
          </div>

          <div className="crumb" id="crumb">
            <b>{currentCrumb}</b>
          </div>

          <button
            type="button"
            className="hdr-search"
            onClick={() => alert('Pencarian Universal: Ketik acara, alat, kru, atau dokumen.')}
          >
            <i className="fa-solid fa-magnifying-glass" />
            <span>Cari acara, alat, kru, surat…</span>
            <kbd>/</kbd>
          </button>

          <div className="hdr-actions">
            <button
              type="button"
              className="icon-btn only-mobile"
              aria-label="Cari"
              onClick={() => alert('Pencarian Universal')}
            >
              <i className="fa-solid fa-magnifying-glass" />
            </button>

            <button
              type="button"
              className="icon-btn"
              aria-label="Notifikasi"
              onClick={() => alert('Notifikasi PTV PRO')}
            >
              <i className="fa-solid fa-bell" />
              <span className="dot" id="notifDot" style={{ display: 'none' }} />
            </button>

            <button
              type="button"
              className="icon-btn"
              aria-label="Profil"
              style={{ width: 'auto', padding: '0 4px' }}
              onClick={() => navigate('/hub/id')}
            >
              <span className="avatar sm">{userInitials}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT VIEWPORT ── */}
      <main className="main" id="main">
        <div className="page-in" id="view">
          <Outlet />
        </div>
      </main>

      {/* ── MOBILE BOTTOM NAVIGATION 1:1 DARI shellHTML() ── */}
      <nav className="bnav" id="bnav">
        <div className="bnav-in">
          <button
            type="button"
            className={`bitem ${isTabActive('home') ? 'on' : ''}`}
            data-tab="home"
            onClick={() => {
              setIsMoreOpen(false);
              navigate('/hub/beranda');
            }}
          >
            <i className="fa-solid fa-house" />
            <span>Home</span>
          </button>

          <button
            type="button"
            className={`bitem ${isTabActive('acara') ? 'on' : ''}`}
            data-tab="acara"
            onClick={() => {
              setIsMoreOpen(false);
              navigate('/hub/acara');
            }}
          >
            <i className="fa-solid fa-calendar-day" />
            <span>Acara</span>
          </button>

          <button
            type="button"
            className="fab"
            data-act="quick"
            aria-label="Aksi cepat"
            onClick={() => setIsQuickOpen(true)}
          >
            <i className="fa-solid fa-plus" />
          </button>

          <button
            type="button"
            className={`bitem ${isTabActive('alat') ? 'on' : ''}`}
            data-tab="alat"
            onClick={() => {
              setIsMoreOpen(false);
              navigate('/hub/inventaris');
            }}
          >
            <i className="fa-solid fa-camera-retro" />
            <span>Alat</span>
          </button>

          <button
            type="button"
            className={`bitem ${isTabActive('more') ? 'on' : ''}`}
            data-tab="more"
            style={{ position: 'relative' }}
            onClick={() => setIsMoreOpen(!isMoreOpen)}
          >
            <i className="fa-solid fa-ellipsis" />
            <span>More</span>
            <span className="action-dot" id="moreActionDot" style={{ display: 'none' }} />
          </button>
        </div>
      </nav>

      {/* ── AKSI CEPAT BOTTOM SHEET (FAB MODAL) ── */}
      <div
        className={`scrim ${isQuickOpen ? 'on' : ''}`}
        id="quickScrim"
        onClick={() => setIsQuickOpen(false)}
      />
      <section
        className={`sheet ${isQuickOpen ? 'on' : ''}`}
        id="quickSheet"
        role="dialog"
        aria-modal="true"
      >
        <div className="sheet-grab" />
        <div className="sheet-hd">
          <h3 id="sheetTitle">Aksi cepat</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setIsQuickOpen(false)}
            aria-label="Tutup"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="sheet-body" id="sheetBody">
          <div className="qa-grid">
            <button
              type="button"
              className="qa"
              onClick={() => {
                setIsQuickOpen(false);
                navigate('/hub/surat/generator');
              }}
            >
              <span className="qa-ic">
                <i className="fa-solid fa-shield-halved" />
              </span>
              <span>
                <span className="qa-t">Generator Surat Izin</span>
                <span className="qa-s">Penerbitan surat izin resmi santri</span>
              </span>
            </button>

            <button
              type="button"
              className="qa"
              onClick={() => {
                setIsQuickOpen(false);
                navigate('/hub/peminjaman');
              }}
            >
              <span className="qa-ic">
                <i className="fa-solid fa-boxes-stacked" />
              </span>
              <span>
                <span className="qa-t">Pinjam Alat</span>
                <span className="qa-s">Ambil alat dari inventaris</span>
              </span>
            </button>

            <button
              type="button"
              className="qa"
              onClick={() => {
                setIsQuickOpen(false);
                navigate('/hub/catatan');
              }}
            >
              <span className="qa-ic">
                <i className="fa-solid fa-note-sticky" />
              </span>
              <span>
                <span className="qa-t">Tambah Catatan Bersama</span>
                <span className="qa-s">Tulis &amp; bagikan catatan kru</span>
              </span>
            </button>
          </div>
          <p className="hint mt16" style={{ textAlign: 'center', fontSize: '12px' }}>
            Semua pengajuan &amp; pencatatan otomatis tersinkronisasi.
          </p>
        </div>
      </section>

      {/* ── MOBILE MORE SHEET ── */}
      <div
        className={`scrim ${isMoreOpen ? 'on' : ''}`}
        id="moreScrim"
        onClick={() => setIsMoreOpen(false)}
      />
      <section
        className={`sheet ${isMoreOpen ? 'on' : ''}`}
        id="moreSheet"
        role="dialog"
        aria-modal="true"
        style={{ maxHeight: '82vh' }}
      >
        <div className="sheet-grab" />
        <div className="sheet-hd">
          <h3>Menu Lainnya</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setIsMoreOpen(false)}
            aria-label="Tutup"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="sheet-body" style={{ overflowY: 'auto', paddingBottom: '24px' }}>
          {SIDEBAR_GROUPS.map((grp) => {
            const accessibleItems = grp.items.filter((item) => !item.capability || can(item.capability));
            if (!accessibleItems.length) return null;

            return (
              <div key={grp.groupName} style={{ marginBottom: '16px' }}>
                <p
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                    margin: '0 0 6px 12px',
                  }}
                >
                  {grp.groupName}
                </p>
                <div className="list">
                  {accessibleItems.map((item) => {
                    if (item.isExternal) {
                      return (
                        <a
                          key={item.key}
                          href={item.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="li"
                          style={{ textDecoration: 'none' }}
                          onClick={() => setIsMoreOpen(false)}
                        >
                          <span className="li-ic">
                            <i className={item.iconClass} />
                          </span>
                          <span className="li-body">
                            <span className="li-t">{item.label}</span>
                          </span>
                          <i
                            className="fa-solid fa-arrow-up-right-from-square"
                            style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: 'auto', opacity: 0.7 }}
                          />
                        </a>
                      );
                    }

                    return (
                      <button
                        key={item.key}
                        type="button"
                        className="li"
                        onClick={() => {
                          setIsMoreOpen(false);
                          navigate(item.path);
                        }}
                      >
                        <span className="li-ic">
                          <i className={item.iconClass} />
                        </span>
                        <span className="li-body">
                          <span className="li-t">{item.label}</span>
                        </span>
                        <span className="chev">
                          <i className="fa-solid fa-chevron-right" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
};
