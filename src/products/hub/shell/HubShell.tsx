import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { AppCapability } from '@core/policy';
import {
  Home,
  Calendar,
  CalendarDays,
  FileText,
  Package,
  CircleDollarSign,
  ArrowLeftRight,
  Wrench,
  HelpCircle,
  Users,
  CreditCard,
  FileCheck,
  Phone,
  UserCheck,
  FileSignature,
  ShieldAlert,
  ShieldCheck,
  Archive,
  Wallet,
  Megaphone,
  Sparkles,
  BarChart2,
  Settings,
  Search,
  Bell,
  Moon,
  Sun,
  LogOut,
  Plus,
  X,
  ExternalLink,
} from 'lucide-react';

interface SidebarItemDef {
  key: string;
  label: string;
  path: string;
  icon: React.ReactNode;
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
        icon: <Home size={16} />,
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
        icon: <Calendar size={16} />,
        capability: 'events.view',
      },
      {
        key: 'kalender',
        label: 'Kalender',
        path: '/hub/kalender',
        icon: <CalendarDays size={16} />,
        capability: 'calendar.view',
      },
      {
        key: 'catatan',
        label: 'Catatan Bersama',
        path: '/hub/catatan',
        icon: <FileText size={16} />,
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
        icon: <Package size={16} />,
        capability: 'inventory.view',
      },
      {
        key: 'nilaiInventaris',
        label: 'Nilai Inventaris',
        path: '/hub/inventaris/nilai',
        icon: <CircleDollarSign size={16} />,
        capability: 'inventory.valuation.view',
      },
      {
        key: 'peminjaman',
        label: 'Peminjaman',
        path: '/hub/peminjaman',
        icon: <ArrowLeftRight size={16} />,
        capability: 'loans.view',
      },
      {
        key: 'kerusakan',
        label: 'Lapor Kerusakan',
        path: '/hub/kerusakan',
        icon: <Wrench size={16} />,
        capability: 'damage.view',
      },
      {
        key: 'lostfound',
        label: 'Lost & Found',
        path: '/hub/lostfound',
        icon: <HelpCircle size={16} />,
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
        icon: <Users size={16} />,
        capability: 'crew.view',
      },
      {
        key: 'id',
        label: 'ID Digital',
        path: '/hub/id',
        icon: <CreditCard size={16} />,
        capability: 'id.view',
      },
      {
        key: 'dokumen',
        label: 'Dokumen Saya',
        path: '/hub/dokumen',
        icon: <FileCheck size={16} />,
        capability: 'documents.view',
      },
      {
        key: 'kontak',
        label: 'Kontak Internal',
        path: '/hub/kontak',
        icon: <Phone size={16} />,
        capability: 'contacts.internal.view',
      },
      {
        key: 'kontakEksternal',
        label: 'Kontak Eksternal',
        path: '/hub/kontak-eksternal',
        icon: <UserCheck size={16} />,
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
        icon: <FileSignature size={16} />,
        capability: 'documents.generate',
      },
      {
        key: 'perizinan',
        label: 'Pengajuan Perizinan',
        path: '/hub/perizinan',
        icon: <ShieldAlert size={16} />,
        capability: 'documents.request',
      },
      {
        key: 'verifikasiSurat',
        label: 'Keabsahan Dokumen',
        path: 'https://progresiftv.id/verifikasi-surat/',
        icon: <ShieldCheck size={16} />,
        isExternal: true,
      },
      {
        key: 'verifikasiIdentitas',
        label: 'Verifikasi Identitas',
        path: 'https://progresiftv.id/verifikasi-identitas/',
        icon: <CreditCard size={16} />,
        isExternal: true,
      },
      {
        key: 'arsip',
        label: 'Surat & Arsip',
        path: '/hub/arsip',
        icon: <Archive size={16} />,
        capability: 'documents.archive.view',
      },
      {
        key: 'keuangan',
        label: 'Keuangan',
        path: '/hub/keuangan',
        icon: <Wallet size={16} />,
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
        icon: <Megaphone size={16} />,
        capability: 'broadcast.view',
      },
      {
        key: 'projectHaul',
        label: 'Haul & Harlah PPBS',
        path: '/hub/haul',
        icon: <Sparkles size={16} />,
        capability: 'projecthaul.view',
      },
      {
        key: 'seo',
        label: 'SEO & Analytics',
        path: '/hub/seo',
        icon: <BarChart2 size={16} />,
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
        icon: <Settings size={16} />,
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

  // Dark / Light Mode state
  const [isDark, setIsDark] = useState<boolean>(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  });

  // Mobile Bottom Sheet states
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const [fallbackModalInfo, setFallbackModalInfo] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('ptv_theme');
    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      setIsDark(true);
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      setIsDark(false);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('ptv_theme', nextTheme);
    setIsDark(!isDark);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleNavClick = (item: SidebarItemDef, e: React.MouseEvent) => {
    if (item.isExternal) {
      return; // Standard external anchor behavior
    }

    // Active routes in Phase 5E.1: /hub/beranda, /hub/kru, /hub/inventaris, /hub/peminjaman
    const activeImplementedRoutes = ['/hub/beranda', '/hub/kru', '/hub/inventaris', '/hub/peminjaman'];
    if (!activeImplementedRoutes.includes(item.path)) {
      e.preventDefault();
      setFallbackModalInfo(item.label);
      setIsMoreSheetOpen(false);
      return;
    }

    setIsMoreSheetOpen(false);
  };

  // Breadcrumb current title
  const currentTitle = BREADCRUMB_MAP[location.pathname] || 'Dashboard';

  return (
    <div className="app-shell">
      {/* ── DESKTOP SIDEBAR (.side) ── */}
      <aside className="side" id="side">
        <div className="side-brand">
          <NavLink to="/hub/beranda" className="brand-logo-text">
            <span>PROGRESIF TV</span>
          </NavLink>
        </div>

        <div className="side-scroll" id="sideNav">
          {SIDEBAR_GROUPS.map((grp) => {
            const visibleItems = grp.items.filter((item) => {
              if (item.isExternal) return true;
              if (!item.capability) return true;
              return can(item.capability);
            });

            if (visibleItems.length === 0) return null;

            return (
              <div className="side-grp" key={grp.groupName}>
                <p>{grp.groupName}</p>
                {visibleItems.map((item) => {
                  if (item.isExternal) {
                    return (
                      <a
                        key={item.key}
                        href={item.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="snav"
                        title={item.label}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                        <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                      </a>
                    );
                  }

                  const isActive = location.pathname === item.path;

                  return (
                    <NavLink
                      key={item.key}
                      to={item.path}
                      onClick={(e) => handleNavClick(item, e)}
                      className={`snav ${isActive ? 'on' : ''}`}
                      title={item.label}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="side-foot">
          <button type="button" className="snav" onClick={toggleTheme}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            <span>{isDark ? 'Mode terang' : 'Mode gelap'}</span>
          </button>
          <button type="button" className="snav" onClick={handleLogout} style={{ color: '#ef4444' }}>
            <LogOut size={16} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* ── TOP HEADER (.hdr) ── */}
      <header className="hdr">
        <div className="hdr-in">
          <div className="brand">
            <NavLink to="/hub/beranda" className="brand-logo-text">
              <span>PTV PRO</span>
            </NavLink>
          </div>

          <div className="crumb" id="crumb">
            <span>{currentTitle}</span>
          </div>

          <button
            type="button"
            className="hdr-search"
            onClick={() => setFallbackModalInfo('Pencarian Global (Search Bar)')}
          >
            <Search size={14} />
            <span>Cari acara, alat, kru, surat…</span>
            <kbd>/</kbd>
          </button>

          <div className="hdr-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={toggleTheme}
              title={isDark ? 'Mode terang' : 'Mode gelap'}
              aria-label="Ubah tema"
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={() => setFallbackModalInfo('Notifikasi Sistem')}
              title="Notifikasi"
              aria-label="Notifikasi"
            >
              <Bell size={17} />
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                borderRadius: 'var(--r-full)',
                backgroundColor: 'var(--b-050)',
                color: 'var(--b-700)',
                fontSize: '12px',
                fontWeight: 650,
                marginLeft: '4px',
              }}
            >
              <span>{user?.full_name ? user.full_name.split(' ').slice(0, 2).join(' ') : 'Kru PTV'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA (.main) ── */}
      <main className="main" id="main">
        <div className="page-in" id="view">
          <Outlet />
        </div>
      </main>

      {/* ── MOBILE BOTTOM NAVIGATION DOCK (.bnav) ── */}
      <nav className="bnav" id="bnav">
        <div className="bnav-in">
          <NavLink
            to="/hub/beranda"
            className={({ isActive }) => `bitem ${isActive ? 'on' : ''}`}
            data-tab="home"
          >
            <Home size={18} />
            <span>Home</span>
          </NavLink>

          <button
            type="button"
            className="bitem"
            data-tab="acara"
            onClick={() => setFallbackModalInfo('Modul Acara & Agenda')}
          >
            <Calendar size={18} />
            <span>Acara</span>
          </button>

          <button
            type="button"
            className="fab"
            aria-label="Aksi cepat"
            onClick={() => setIsQuickActionOpen(true)}
          >
            <Plus size={22} />
          </button>

          <NavLink
            to="/hub/inventaris"
            className={({ isActive }) => `bitem ${isActive ? 'on' : ''}`}
            data-tab="alat"
          >
            <Package size={18} />
            <span>Alat</span>
          </NavLink>

          <button
            type="button"
            className={`bitem ${isMoreSheetOpen ? 'on' : ''}`}
            data-tab="more"
            onClick={() => setIsMoreSheetOpen(true)}
          >
            <Users size={18} />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* ── MOBILE QUICK ACTION SHEET ── */}
      {isQuickActionOpen && (
        <>
          <div className="scrim" onClick={() => setIsQuickActionOpen(false)} />
          <section className="sheet" role="dialog" aria-modal="true">
            <div className="sheet-grab" />
            <div className="sheet-hd">
              <h3>Aksi Cepat</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsQuickActionOpen(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
            <div className="sheet-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                className="snav"
                onClick={() => {
                  setIsQuickActionOpen(false);
                  navigate('/hub/peminjaman');
                }}
                style={{ backgroundColor: 'var(--b-050)', color: 'var(--b-700)', fontWeight: 650 }}
              >
                <ArrowLeftRight size={18} />
                <span>Pinjam Alat Inventaris</span>
              </button>
              <button
                type="button"
                className="snav"
                onClick={() => {
                  setIsQuickActionOpen(false);
                  navigate('/hub/inventaris');
                }}
                style={{ backgroundColor: 'var(--b-050)', color: 'var(--b-700)', fontWeight: 650 }}
              >
                <Package size={18} />
                <span>Lihat Katalog Inventaris</span>
              </button>
              <button
                type="button"
                className="snav"
                onClick={() => {
                  setIsQuickActionOpen(false);
                  navigate('/hub/kru');
                }}
                style={{ backgroundColor: 'var(--b-050)', color: 'var(--b-700)', fontWeight: 650 }}
              >
                <Users size={18} />
                <span>Direktori Manajemen Kru</span>
              </button>
            </div>
          </section>
        </>
      )}

      {/* ── MOBILE MORE MENU SHEET ── */}
      {isMoreSheetOpen && (
        <>
          <div className="scrim" onClick={() => setIsMoreSheetOpen(false)} />
          <section className="sheet" role="dialog" aria-modal="true" style={{ maxHeight: '88vh' }}>
            <div className="sheet-grab" />
            <div className="sheet-hd">
              <h3>Menu Dasbor PTV</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsMoreSheetOpen(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
            <div className="sheet-body">
              {SIDEBAR_GROUPS.map((grp) => {
                const visibleItems = grp.items.filter((item) => {
                  if (item.isExternal) return true;
                  if (!item.capability) return true;
                  return can(item.capability);
                });

                if (visibleItems.length === 0) return null;

                return (
                  <div className="side-grp" key={grp.groupName} style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      {grp.groupName}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {visibleItems.map((item) => (
                        <button
                          type="button"
                          key={item.key}
                          className="snav"
                          onClick={(e) => handleNavClick(item, e)}
                          style={{
                            padding: '10px 14px',
                            backgroundColor: location.pathname === item.path ? 'var(--b-100)' : 'transparent',
                            color: location.pathname === item.path ? 'var(--b-700)' : 'var(--ink)',
                            fontWeight: location.pathname === item.path ? 700 : 500,
                          }}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                          {item.isExternal && <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: '16px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button type="button" className="snav" onClick={toggleTheme}>
                  {isDark ? <Sun size={18} /> : <Moon size={18} />}
                  <span>{isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}</span>
                </button>
                <button type="button" className="snav" onClick={handleLogout} style={{ color: '#ef4444' }}>
                  <LogOut size={18} />
                  <span>Keluar dari Akun</span>
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ── INFORMATIVE FALLBACK MODAL (UNTUK MODUL TAHAP BERIKUTNYA) ── */}
      {fallbackModalInfo && (
        <>
          <div className="scrim" onClick={() => setFallbackModalInfo(null)} />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 100,
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--r-m)',
              boxShadow: 'var(--shadow-m)',
              padding: '24px',
              maxWidth: '440px',
              width: '90%',
              border: '1px solid var(--line)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
                {fallbackModalInfo}
              </h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setFallbackModalInfo(null)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 16px 0' }}>
              Modul <strong>{fallbackModalInfo}</strong> telah terdaftar di dalam navigasi arsitektur PTV PRO dan dijadwalkan untuk dimigrasikan pada tahapan berikutnya sesuai dokumen acuan{' '}
              <code>docs/HUB-LEGACY-MIGRATION-MAP.md</code>.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setFallbackModalInfo(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--r-full)',
                  backgroundColor: 'var(--b-600)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 650,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Mengerti
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
