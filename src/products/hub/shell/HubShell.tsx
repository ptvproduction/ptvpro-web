import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSessionStore } from '@core/session';
import { useCrewStore } from '../kru/kruStore';
import { AppCapability } from '@core/policy';
import { UniversalSearchModal } from './UniversalSearchModal';
import { NotificationCenterModal } from './NotificationCenterModal';
import { notificationService } from './notificationService';
import { UserProfileMenuModal } from './UserProfileMenuModal';
import { TopAnnouncementBanner } from './TopAnnouncementBanner';
import { useThemeStore } from '@core/theme/themeStore';
import { BackToTopButton, GlobalToastContainer } from '@shared/components';
import { dialogManager } from '@shared/utils/dialogManager';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { WorkspaceBottomSheet } from './WorkspaceBottomSheet';
import '@/styles/shell.css';

interface SidebarItemDef {
  key: string;
  label: string;
  path: string;
  iconClass: string;
  capability?: AppCapability;
  anyCapabilities?: AppCapability[];
  isExternal?: boolean;
}

interface SidebarGroupDef {
  groupName: string;
  items: SidebarItemDef[];
}

/**
 * 7 Authoritative Sidebar Groups ported 1:1 from page-dasbor.php (SIDEBAR definition)
 */
export const SIDEBAR_GROUPS: SidebarGroupDef[] = [
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
        key: 'akses',
        label: 'Manajemen Akun',
        path: '/hub/akses',
        iconClass: 'fa-solid fa-user-shield',
        capability: 'crew.permissions.manage',
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
        key: 'keuangan',
        label: 'Keuangan',
        path: '/hub/keuangan',
        iconClass: 'fa-solid fa-receipt',
        anyCapabilities: ['finance.view', 'finance.view_own'],
      },
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
        key: 'arsip',
        label: 'Surat & Arsip',
        path: '/hub/arsip',
        iconClass: 'fa-solid fa-box-archive',
        anyCapabilities: ['documents.archive.view', 'documents.view', 'documents.approve', 'documents.archive.manage'],
      },
      {
        key: 'verifikasiSurat',
        label: 'Keabsahan Dokumen',
        path: '/verifikasi-surat',
        iconClass: 'fa-solid fa-shield-halved',
        isExternal: true,
      },
      {
        key: 'verifikasiIdentitas',
        label: 'Verifikasi Identitas',
        path: '/verifikasi-identitas',
        iconClass: 'fa-solid fa-id-card',
        isExternal: true,
      },
    ],
  },
  {
    groupName: 'Media',
    items: [
      {
        key: 'projectHaul',
        label: 'Haul & Harlah PPBS',
        path: '/hub/haul',
        iconClass: 'fa-solid fa-calendar-day',
        capability: 'projecthaul.view',
      },
      {
        key: 'portal',
        label: 'Pengelolaan Portal',
        path: '/hub/portal',
        iconClass: 'fa-solid fa-globe',
        anyCapabilities: ['settings.system', 'crew.permissions.manage'],
      },
      {
        key: 'broadcast',
        label: 'Pengumuman',
        path: '/hub/broadcast',
        iconClass: 'fa-solid fa-bullhorn',
        capability: 'broadcast.view',
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
        key: 'profile',
        label: 'Profil',
        path: '/hub/profile',
        iconClass: 'fa-solid fa-circle-user',
        capability: 'settings.personal',
      },
      {
        key: 'portofolio',
        label: 'Portofolio Saya',
        path: '/hub/portofolio',
        iconClass: 'fa-solid fa-briefcase',
        anyCapabilities: ['id.view', 'settings.personal', 'crew.view'],
      },
    ],
  },
];

const BREADCRUMB_MAP: Record<string, string> = {
  '/hub': 'Beranda',
  '/hub/beranda': 'Beranda',
  '/hub/kru': 'Manajemen Kru',
  '/hub/akses': 'Manajemen Akun',
  '/hub/inventaris': 'Aset Inventaris Progresif TV',
  '/hub/inventaris/nilai': 'Nilai Inventaris PTV',
  '/hub/peminjaman': 'Peminjaman Alat',
  '/hub/acara': 'Agenda Acara',
  '/hub/kalender': 'Kalender Kegiatan',
  '/hub/catatan': 'Catatan Bersama',
  '/hub/kerusakan': 'Lapor Kerusakan',
  '/hub/lostfound': 'Lost & Found',
  '/hub/profile': 'Profil & Akun Kru',
  '/hub/id': 'Profil & Akun Kru',
  '/hub/dokumen': 'Surat & Arsip',
  '/hub/kontak': 'Kontak Internal',
  '/hub/kontak-eksternal': 'Kontak Eksternal',
  '/hub/perizinan': 'Pengajuan Perizinan',
  '/hub/surat/generator': 'Generator Surat Izin',
  '/hub/arsip': 'Surat & Arsip',
  '/hub/keuangan': 'Keuangan & Kas PTV',
  '/hub/broadcast': 'Broadcast & Pengumuman',
  '/hub/haul': 'Haul & Harlah PPBS',
  '/hub/seo': 'SEO & Analytics',
  '/hub/portal': 'Pengelolaan Portal & Status',
  '/hub/pengaturan': 'Profil & Akun Kru',
};

export const HubShell: React.FC = () => {
  const { user, logout, can } = useSessionStore();
  const { getCurrentUser } = useCrewStore();
  const currentUser = getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useThemeStore();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ptv_sidebar_collapsed') === 'true';
        document.documentElement.setAttribute('data-sidebar-collapsed', String(saved));
        return saved;
      } catch {
        return false;
      }
    }
    return false;
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      document.documentElement.setAttribute('data-sidebar-collapsed', String(next));
      try {
        localStorage.setItem('ptv_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const quickSheetRef = useRef<HTMLElement>(null);
  const moreSheetRef = useRef<HTMLElement>(null);

  // 3 Header Features State (Mutually Exclusive - No Stacking)
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const closeAllPopups = () => {
    setIsSearchOpen(false);
    setIsMobileSearchOpen(false);
    setIsNotifOpen(false);
    setIsProfileOpen(false);
    setIsMoreOpen(false);
    setIsQuickOpen(false);
  };

  const handleOpenDesktopSearch = () => {
    if (isSearchOpen) {
      setIsSearchOpen(false);
      return;
    }
    closeAllPopups();
    setIsSearchOpen(true);
  };

  const handleOpenMobileSearch = () => {
    if (isMobileSearchOpen) {
      setIsMobileSearchOpen(false);
      return;
    }
    closeAllPopups();
    setIsMobileSearchOpen(true);
  };

  const handleOpenNotif = () => {
    if (isNotifOpen) {
      setIsNotifOpen(false);
      return;
    }
    closeAllPopups();
    setIsNotifOpen(true);
  };

  useEffect(() => {
    let mounted = true;
    notificationService.getNotifications(user).then((notifs) => {
      if (mounted) setUnreadCount(notifs.filter((n) => !n.is_read).length);
    });
    const unsubscribe = notificationService.subscribe((count) => {
      if (mounted) setUnreadCount(count);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [user]);

  // Integrasi scroll lock & accessibility untuk Quick Actions sheet
  useModalScrollLock({
    isOpen: isQuickOpen,
    onClose: () => setIsQuickOpen(false),
    modalRef: quickSheetRef,
    id: 'hub-quick-actions',
    isGlobal: true,
  });

  // Integrasi scroll lock & accessibility untuk More Menu sheet
  useModalScrollLock({
    isOpen: isMoreOpen,
    onClose: () => setIsMoreOpen(false),
    modalRef: moreSheetRef,
    id: 'hub-more-menu',
    isGlobal: true,
  });

  // Global Keyboard Shortcut: '/' & 'Ctrl/Cmd+K' untuk Universal Search (Guarded)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. ESC: Delegasikan ke dialogManager jika ada modal aktif
      if (e.key === 'Escape') {
        if (dialogManager.hasActiveDialog()) {
          const handled = dialogManager.handleEscape(e);
          if (handled) return;
        }
        closeAllPopups();
        return;
      }

      // 2. Shortcut '/' atau 'Ctrl/Cmd+K' untuk Universal Search
      const isSearchShortcut =
        (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'));

      if (isSearchShortcut) {
        // Jangan picu jika sedang mengetik di input, textarea, contenteditable, atau jika ada dialog aktif
        if (dialogManager.shouldBlockGlobalShortcut(e)) {
          return;
        }

        e.preventDefault();
        if (window.innerWidth < 992) {
          handleOpenMobileSearch();
        } else {
          handleOpenDesktopSearch();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ptv_sidebar_collapsed', String(isSidebarCollapsed));
      document.documentElement.setAttribute('data-sidebar-collapsed', String(isSidebarCollapsed));
    } catch {
      // ignore
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Bersihkan modal dan reset scroll lock saat route berubah
  useEffect(() => {
    closeAllPopups();
    dialogManager.resetOnRouteChange();
  }, [location.pathname]);

  const currentPath = location.pathname;
  const currentCrumb =
    BREADCRUMB_MAP[currentPath] ||
    (currentPath.startsWith('/hub/inventaris/nilai/')
      ? 'Detail Nilai Inventaris'
      : currentPath.startsWith('/hub/inventaris/')
      ? 'Detail Aset Inventaris'
      : 'Beranda');

  const userInitials = (user?.full_name || 'PTV')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'P';

  const isTabActive = (tab: string) => {
    if (tab === 'home') return currentPath === '/hub' || currentPath === '/hub/beranda';
    if (tab === 'acara') return currentPath === '/hub/acara' || currentPath.startsWith('/hub/acara/') || currentPath === '/hub/kalender' || currentPath.startsWith('/hub/kalender/');
    if (tab === 'alat') return (
      currentPath === '/hub/inventaris' ||
      currentPath.startsWith('/hub/inventaris/') ||
      currentPath === '/hub/peminjaman' ||
      currentPath.startsWith('/hub/peminjaman/') ||
      currentPath === '/hub/kerusakan' ||
      currentPath.startsWith('/hub/kerusakan/') ||
      currentPath === '/hub/lostfound' ||
      currentPath.startsWith('/hub/lostfound/')
    );
    if (tab === 'profile') return (
      currentPath === '/hub/profile' ||
      currentPath.startsWith('/hub/profile/') ||
      currentPath === '/hub/id' ||
      currentPath === '/hub/pengaturan'
    );
    return false;
  };

  return (
    <>
      {/* ── DESKTOP SIDEBAR 1:1 DARI shellHTML() ── */}
      <aside className={`side ${isSidebarCollapsed ? 'collapsed' : ''}`} id="side">
        <button
          type="button"
          className="side-collapse-btn"
          onClick={toggleSidebarCollapse}
          aria-label={isSidebarCollapsed ? 'Perluas menu navigasi' : 'Ciutkan menu navigasi'}
          title={isSidebarCollapsed ? 'Perluas menu navigasi' : 'Ciutkan menu navigasi'}
        >
          <i className={isSidebarCollapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-left'} />
        </button>

        <div className="side-brand">
          <a
            href="#beranda"
            className="brand-logo-link"
            onClick={(e) => {
              e.preventDefault();
              navigate('/hub/beranda');
            }}
            aria-label="Progresif TV"
            title="Progresif TV Hub"
          >
            <span
              className="brand-logo-gradient brand-logo-expanded"
              style={{ '--logo-url': "url('/assets/images/ptv-logo-white.webp')" } as React.CSSProperties}
              role="img"
              aria-label="Progresif TV Production"
            />
            <span
              className="brand-logo-symbol brand-logo-minimized"
              style={{ '--symbol-url': "url('/assets/images/ptv-symbol.png')" } as React.CSSProperties}
              role="img"
              aria-label="Progresif TV"
            />
          </a>
        </div>

        <div className="side-scroll" id="sideNav">
          {SIDEBAR_GROUPS.map((grp) => {
            const userCategory = ((user as any)?.category || (user as any)?.kategori || (user as any)?.kategori_personel || '').toLowerCase().trim();
            const isPembinaOrPengarah = userCategory === 'pembina' || userCategory === 'pengarah' || user?.assigned_profiles?.includes('pembina');

            const accessibleItems = grp.items.filter((item) => {
              if (item.key === 'keuangan' && isPembinaOrPengarah) {
                return false;
              }
              if (item.anyCapabilities && item.anyCapabilities.length > 0) {
                return item.anyCapabilities.some((cap) => can(cap));
              }
              return !item.capability || can(item.capability);
            });
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
                        className="snav snav-portal"
                        style={{ textDecoration: 'none' }}
                        title={`${item.label} (Buka tab baru)`}
                      >
                        <i className={item.iconClass} />
                        <span>{item.label}</span>
                        <i
                          className="fa-solid fa-arrow-up-right-from-square snav-ext-ic"
                          style={{ fontSize: '10px', marginLeft: 'auto', opacity: 0.6 }}
                          title="Buka tab baru"
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
                      title={item.label}
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
          <a
            href="/"
            className="snav snav-portal snav-foot-portal"
            title="Kembali ke Portal"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
          >
            <i className="fa-solid fa-house-laptop" />
            <span>Kembali ke Portal</span>
          </a>
          <div className="side-foot-row">
            <button
              type="button"
              className="snav snav-foot-btn snav-foot-theme"
              onClick={toggleTheme}
              data-act="theme"
              title={isDark ? 'Mode terang' : 'Mode gelap'}
              aria-label={isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
            >
              <i className={isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'} />
              <span>{isDark ? 'Terang' : 'Gelap'}</span>
            </button>
            <button
              type="button"
              className="snav snav-foot-btn snav-foot-logout"
              onClick={logout}
              data-act="logout"
              title="Keluar"
              aria-label="Keluar dari akun"
            >
              <i className="fa-solid fa-arrow-right-from-bracket" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── NOTIFICATION BAR GLOBAL DI ATAS HEADER (HANYA AREA KONTEN) ── */}
      <TopAnnouncementBanner />

      {/* ── HEADER 1:1 DARI shellHTML() ── */}
      <header className={`hdr ${isScrolled ? 'stuck' : ''}`}>
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

          <div className="hdr-actions">
            <button
              type="button"
              className="hdr-search"
              onClick={handleOpenDesktopSearch}
              aria-label="Cari acara, alat, kru, surat"
            >
              <i className="fa-solid fa-magnifying-glass" />
              <span>Cari acara, alat, kru, surat…</span>
              <kbd>/</kbd>
            </button>

            <button
              type="button"
              className="icon-btn only-mobile"
              aria-label="Cari"
              onClick={handleOpenMobileSearch}
            >
              <i className="fa-solid fa-magnifying-glass" />
            </button>

            <button
              type="button"
              className="icon-btn only-mobile"
              aria-label="Kembali ke Portal"
              title="Kembali ke Portal"
              onClick={() => navigate('/')}
            >
              <i className="fa-solid fa-house-laptop" style={{ fontSize: '13.5px' }} />
            </button>

            <button
              type="button"
              className="icon-btn"
              aria-label="Notifikasi"
              onClick={handleOpenNotif}
            >
              <i className="fa-solid fa-bell" />
              <span
                className="dot"
                id="notifDot"
                style={{
                  display: unreadCount > 0 ? 'grid' : 'none',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </button>

            <button
              type="button"
              className="icon-btn icon-btn-profile only-desktop"
              title="Buka Profil"
              aria-label="Buka Profil"
              onClick={() => navigate('/hub/profile')}
              style={{ width: 'auto', padding: '0 4px', cursor: 'pointer' }}
            >
              <span className="avatar sm">
                {(currentUser?.foto_url || (user as any)?.foto_url || (user as any)?.avatar_url) ? (
                  <img
                    src={currentUser?.foto_url || (user as any)?.foto_url || (user as any)?.avatar_url}
                    alt={currentUser?.full_name || user?.full_name || 'Profil'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                  />
                ) : (
                  userInitials
                )}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT VIEWPORT (GLOBAL SUBTLE FADE + LIFT TRANSITION) ── */}
      <main className="main" id="main">
        <div className="page-in ptv-page-transition" id="view" key={location.pathname}>
          <Outlet />
        </div>
      </main>

      {/* ── AMBIENT BOTTOM GRADIENT ── */}
      <div className="ptv-nav-ambient-gradient" aria-hidden="true" />

      {/* ── MOBILE FLOATING NAVIGATION 2.0 (JID SPACE EXACT GEOMETRY) ── */}
      <nav className="ptv-floating-dock" id="floatingDock" aria-label="Navigasi Utama Mobile">
        <div className="ptv-dock-pill">
          <button
            type="button"
            className={`ptv-dock-item ${isTabActive('home') ? 'is-active' : ''}`}
            data-tab="home"
            onClick={() => {
              setIsMoreOpen(false);
              navigate('/hub/beranda');
            }}
            aria-label="Home"
          >
            <i className="fa-solid fa-house" />
            {isTabActive('home') && <span className="dock-label">Home</span>}
          </button>

          <button
            type="button"
            className={`ptv-dock-item ${isTabActive('acara') ? 'is-active' : ''}`}
            data-tab="acara"
            onClick={() => {
              setIsMoreOpen(false);
              navigate('/hub/acara');
            }}
            aria-label="Acara"
          >
            <i className="fa-solid fa-calendar-day" />
            {isTabActive('acara') && <span className="dock-label">Acara</span>}
          </button>

          <button
            type="button"
            className={`ptv-dock-item ${isTabActive('alat') ? 'is-active' : ''}`}
            data-tab="alat"
            onClick={() => {
              setIsMoreOpen(false);
              navigate('/hub/inventaris');
            }}
            aria-label="Alat"
          >
            <i className="fa-solid fa-boxes-stacked" />
            {isTabActive('alat') && <span className="dock-label">Alat</span>}
          </button>

          <button
            type="button"
            className={`ptv-dock-item ${isTabActive('profile') ? 'is-active' : ''}`}
            data-tab="profile"
            onClick={() => {
              setIsMoreOpen(false);
              navigate('/hub/profile');
            }}
            aria-label="Profil"
          >
            <i className="fa-solid fa-circle-user" />
            {isTabActive('profile') && <span className="dock-label">Profil</span>}
          </button>
        </div>

        {/* Tombol Discover Lingkaran */}
        <button
          type="button"
          className={`ptv-dock-discover ${isMoreOpen ? 'is-active' : ''}`}
          aria-label="Buka Progresif TV Workspace"
          onClick={() => {
            if (isMoreOpen) {
              setIsMoreOpen(false);
            } else {
              closeAllPopups();
              setIsMoreOpen(true);
            }
          }}
        >
          <i className="fa-solid fa-table-cells-large" />
        </button>
      </nav>

      {/* ── DISCOVER: PROGRESIF TV WORKSPACE (INTERACTIVE BOTTOM SHEET) ── */}
      <WorkspaceBottomSheet
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        can={can}
        navigate={navigate}
        user={user}
      />

      {/* ── 3 FITUR HEADER MODALS (1:1 DENGAN LEGACY PHP) ── */}
      {/* 1. Global Search (Desktop Sheet) */}
      <UniversalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        isMobile={false}
      />

      {/* 1b. Global Search (Mobile Overlay) */}
      <UniversalSearchModal
        isOpen={isMobileSearchOpen}
        onClose={() => setIsMobileSearchOpen(false)}
        isMobile={true}
      />

      {/* 2. Notification Center */}
      <NotificationCenterModal
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        onUnreadChange={(count) => setUnreadCount(count)}
      />

      {/* 3. User Profile Menu */}
      <UserProfileMenuModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onToggleTheme={toggleTheme}
        isDark={isDark}
        user={user}
      />

      {/* 4. Global Back to Top Button */}
      <BackToTopButton threshold={350} />

      {/* 5. Global Toast Container (Top Right under Header & Announcement Bar) */}
      <GlobalToastContainer />
    </>
  );
};
