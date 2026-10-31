import { createPortal } from 'react-dom';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppCapability } from '@core/policy';

export interface WorkspaceBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  can: (capability: AppCapability) => boolean;
  navigate: (path: string) => void;
  user: any;
}

interface WorkspaceFeatureItem {
  id: string;
  name: string;
  path: string;
  icon: string;
  capability?: AppCapability;
  pastelBg: string;
  pastelBorder: string;
  iconColor: string;
  darkPastelBg?: string;
  darkIconColor?: string;
}

export const ALL_WORKSPACE_FEATURES: WorkspaceFeatureItem[] = [
  {
    id: 'beranda',
    name: 'Beranda',
    path: '/hub/beranda',
    icon: 'fa-solid fa-house',
    capability: 'hub.access',
    pastelBg: 'rgba(11, 95, 191, 0.08)',
    pastelBorder: 'rgba(11, 95, 191, 0.16)',
    iconColor: '#0b5fbf',
    darkPastelBg: 'rgba(59, 130, 246, 0.12)',
    darkIconColor: '#93c5fd',
  },
  {
    id: 'acara',
    name: 'Acara',
    path: '/hub/acara',
    icon: 'fa-solid fa-calendar-day',
    capability: 'events.view',
    pastelBg: 'rgba(124, 58, 237, 0.08)',
    pastelBorder: 'rgba(124, 58, 237, 0.16)',
    iconColor: '#7c3aed',
    darkPastelBg: 'rgba(167, 139, 250, 0.12)',
    darkIconColor: '#c4b5fd',
  },
  {
    id: 'kalender',
    name: 'Kalender',
    path: '/hub/kalender',
    icon: 'fa-solid fa-calendar-days',
    capability: 'calendar.view',
    pastelBg: 'rgba(13, 148, 136, 0.08)',
    pastelBorder: 'rgba(13, 148, 136, 0.16)',
    iconColor: '#0d9488',
    darkPastelBg: 'rgba(45, 212, 191, 0.12)',
    darkIconColor: '#5eead4',
  },
  {
    id: 'catatan',
    name: 'Catatan Kru',
    path: '/hub/catatan',
    icon: 'fa-solid fa-note-sticky',
    capability: 'notes.view',
    pastelBg: 'rgba(180, 83, 9, 0.08)',
    pastelBorder: 'rgba(180, 83, 9, 0.16)',
    iconColor: '#b45309',
    darkPastelBg: 'rgba(251, 191, 36, 0.12)',
    darkIconColor: '#fde047',
  },
  {
    id: 'inventaris',
    name: 'Inventaris',
    path: '/hub/inventaris',
    icon: 'fa-solid fa-boxes-stacked',
    capability: 'inventory.view',
    pastelBg: 'rgba(2, 132, 199, 0.08)',
    pastelBorder: 'rgba(2, 132, 199, 0.16)',
    iconColor: '#0284c7',
    darkPastelBg: 'rgba(56, 189, 248, 0.12)',
    darkIconColor: '#7dd3fc',
  },
  {
    id: 'nilai-inventaris',
    name: 'Nilai Aset',
    path: '/hub/inventaris/nilai',
    icon: 'fa-solid fa-receipt',
    capability: 'inventory.valuation.view',
    pastelBg: 'rgba(71, 85, 105, 0.08)',
    pastelBorder: 'rgba(71, 85, 105, 0.16)',
    iconColor: '#475569',
    darkPastelBg: 'rgba(148, 163, 184, 0.12)',
    darkIconColor: '#cbd5e1',
  },
  {
    id: 'peminjaman',
    name: 'Peminjaman',
    path: '/hub/peminjaman',
    icon: 'fa-solid fa-right-left',
    capability: 'loans.view',
    pastelBg: 'rgba(13, 148, 136, 0.08)',
    pastelBorder: 'rgba(13, 148, 136, 0.16)',
    iconColor: '#0d9488',
    darkPastelBg: 'rgba(45, 212, 191, 0.12)',
    darkIconColor: '#5eead4',
  },
  {
    id: 'kerusakan',
    name: 'Kerusakan',
    path: '/hub/kerusakan',
    icon: 'fa-solid fa-screwdriver-wrench',
    capability: 'damage.view',
    pastelBg: 'rgba(194, 65, 12, 0.08)',
    pastelBorder: 'rgba(194, 65, 12, 0.16)',
    iconColor: '#c2410c',
    darkPastelBg: 'rgba(251, 146, 60, 0.12)',
    darkIconColor: '#fdba74',
  },
  {
    id: 'lostfound',
    name: 'Lost & Found',
    path: '/hub/lostfound',
    icon: 'fa-solid fa-magnifying-glass-location',
    capability: 'lostfound.view',
    pastelBg: 'rgba(124, 58, 237, 0.08)',
    pastelBorder: 'rgba(124, 58, 237, 0.16)',
    iconColor: '#7c3aed',
    darkPastelBg: 'rgba(167, 139, 250, 0.12)',
    darkIconColor: '#c4b5fd',
  },
  {
    id: 'kru',
    name: 'Manajemen Kru',
    path: '/hub/kru',
    icon: 'fa-solid fa-users',
    capability: 'crew.view',
    pastelBg: 'rgba(11, 95, 191, 0.08)',
    pastelBorder: 'rgba(11, 95, 191, 0.16)',
    iconColor: '#0b5fbf',
    darkPastelBg: 'rgba(59, 130, 246, 0.12)',
    darkIconColor: '#93c5fd',
  },
  {
    id: 'akses',
    name: 'Manajemen Akun',
    path: '/hub/akses',
    icon: 'fa-solid fa-user-shield',
    capability: 'crew.permissions.manage',
    pastelBg: 'rgba(51, 65, 85, 0.08)',
    pastelBorder: 'rgba(51, 65, 85, 0.16)',
    iconColor: '#334155',
    darkPastelBg: 'rgba(148, 163, 184, 0.12)',
    darkIconColor: '#94a3b8',
  },
  {
    id: 'dokumen',
    name: 'Dokumen',
    path: '/hub/dokumen',
    icon: 'fa-solid fa-file-lines',
    capability: 'documents.view',
    pastelBg: 'rgba(79, 70, 229, 0.08)',
    pastelBorder: 'rgba(79, 70, 229, 0.16)',
    iconColor: '#4f46e5',
    darkPastelBg: 'rgba(165, 180, 252, 0.12)',
    darkIconColor: '#a5b4fc',
  },
  {
    id: 'kontak-internal',
    name: 'Kontak Internal',
    path: '/hub/kontak',
    icon: 'fa-solid fa-phone',
    capability: 'contacts.internal.view',
    pastelBg: 'rgba(5, 150, 105, 0.08)',
    pastelBorder: 'rgba(5, 150, 105, 0.16)',
    iconColor: '#059669',
    darkPastelBg: 'rgba(52, 211, 153, 0.12)',
    darkIconColor: '#6ee7b7',
  },
  {
    id: 'kontak-eksternal',
    name: 'Kontak Luar',
    path: '/hub/kontak-eksternal',
    icon: 'fa-solid fa-address-book',
    capability: 'contacts.external.view',
    pastelBg: 'rgba(71, 85, 105, 0.08)',
    pastelBorder: 'rgba(71, 85, 105, 0.16)',
    iconColor: '#475569',
    darkPastelBg: 'rgba(148, 163, 184, 0.12)',
    darkIconColor: '#cbd5e1',
  },
  {
    id: 'generator-izin',
    name: 'Generator Surat',
    path: '/hub/surat/generator',
    icon: 'fa-solid fa-file-signature',
    capability: 'documents.generate',
    pastelBg: 'rgba(124, 58, 237, 0.08)',
    pastelBorder: 'rgba(124, 58, 237, 0.16)',
    iconColor: '#7c3aed',
    darkPastelBg: 'rgba(167, 139, 250, 0.12)',
    darkIconColor: '#c4b5fd',
  },
  {
    id: 'perizinan',
    name: 'Perizinan',
    path: '/hub/perizinan',
    icon: 'fa-solid fa-shield-halved',
    capability: 'documents.request',
    pastelBg: 'rgba(5, 150, 105, 0.08)',
    pastelBorder: 'rgba(5, 150, 105, 0.16)',
    iconColor: '#059669',
    darkPastelBg: 'rgba(52, 211, 153, 0.12)',
    darkIconColor: '#6ee7b7',
  },
  {
    id: 'arsip',
    name: 'Surat & Arsip',
    path: '/hub/arsip',
    icon: 'fa-solid fa-box-archive',
    capability: 'documents.archive.view',
    pastelBg: 'rgba(11, 95, 191, 0.08)',
    pastelBorder: 'rgba(11, 95, 191, 0.16)',
    iconColor: '#0b5fbf',
    darkPastelBg: 'rgba(59, 130, 246, 0.12)',
    darkIconColor: '#93c5fd',
  },
  {
    id: 'keuangan',
    name: 'Keuangan',
    path: '/hub/keuangan',
    icon: 'fa-solid fa-wallet',
    capability: 'finance.view',
    pastelBg: 'rgba(180, 83, 9, 0.08)',
    pastelBorder: 'rgba(180, 83, 9, 0.16)',
    iconColor: '#b45309',
    darkPastelBg: 'rgba(251, 191, 36, 0.12)',
    darkIconColor: '#fde047',
  },
  {
    id: 'broadcast',
    name: 'Broadcast',
    path: '/hub/broadcast',
    icon: 'fa-solid fa-bullhorn',
    capability: 'broadcast.view',
    pastelBg: 'rgba(219, 39, 119, 0.08)',
    pastelBorder: 'rgba(219, 39, 119, 0.16)',
    iconColor: '#db2777',
    darkPastelBg: 'rgba(244, 114, 182, 0.12)',
    darkIconColor: '#f472b6',
  },
  {
    id: 'haul',
    name: 'Haul PPBS',
    path: '/hub/haul',
    icon: 'fa-solid fa-calendar-star',
    capability: 'projecthaul.view',
    pastelBg: 'rgba(5, 150, 105, 0.08)',
    pastelBorder: 'rgba(5, 150, 105, 0.16)',
    iconColor: '#059669',
    darkPastelBg: 'rgba(52, 211, 153, 0.12)',
    darkIconColor: '#6ee7b7',
  },
  {
    id: 'portal-admin',
    name: 'Kelola Portal',
    path: '/hub/portal',
    icon: 'fa-solid fa-globe',
    capability: 'settings.system',
    pastelBg: 'rgba(13, 148, 136, 0.08)',
    pastelBorder: 'rgba(13, 148, 136, 0.16)',
    iconColor: '#0d9488',
    darkPastelBg: 'rgba(45, 212, 191, 0.12)',
    darkIconColor: '#5eead4',
  },
  {
    id: 'seo',
    name: 'SEO & Analytics',
    path: '/hub/seo',
    icon: 'fa-solid fa-chart-simple',
    capability: 'settings.system',
    pastelBg: 'rgba(71, 85, 105, 0.08)',
    pastelBorder: 'rgba(71, 85, 105, 0.16)',
    iconColor: '#475569',
    darkPastelBg: 'rgba(148, 163, 184, 0.12)',
    darkIconColor: '#cbd5e1',
  },
  {
    id: 'profil',
    name: 'Profil & ID',
    path: '/hub/profile',
    icon: 'fa-solid fa-id-card-clip',
    capability: 'hub.access',
    pastelBg: 'rgba(11, 95, 191, 0.08)',
    pastelBorder: 'rgba(11, 95, 191, 0.16)',
    iconColor: '#0b5fbf',
    darkPastelBg: 'rgba(59, 130, 246, 0.12)',
    darkIconColor: '#93c5fd',
  },
  {
    id: 'portofolio',
    name: 'Portofolio Saya',
    path: '/hub/portofolio',
    icon: 'fa-solid fa-briefcase',
    capability: 'hub.access',
    pastelBg: 'rgba(79, 70, 229, 0.08)',
    pastelBorder: 'rgba(79, 70, 229, 0.16)',
    iconColor: '#4f46e5',
    darkPastelBg: 'rgba(165, 180, 252, 0.12)',
    darkIconColor: '#a5b4fc',
  },
];

export type WorkspaceSnapPoint = 'compact' | 'medium' | 'expanded';

export const WorkspaceBottomSheet: React.FC<WorkspaceBottomSheetProps> = ({
  isOpen,
  onClose,
  can,
  navigate,
  user,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [liveDragOffset, setLiveDragOffset] = useState<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return 844;
    return window.visualViewport?.height || window.innerHeight;
  });

  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const lastTouchY = useRef<number>(0);
  const lastTouchTime = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const dragOrigin = useRef<'handle' | 'header'>('handle');

  // Track window resize and visualViewport for accurate dvh snap heights
  useEffect(() => {
    const handleResize = () => {
      const vh = window.visualViewport?.height || window.innerHeight;
      setViewportHeight(vh);
    };
    window.addEventListener('resize', handleResize, { passive: true });
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setLiveDragOffset(null);
      isDragging.current = false;
    }
  }, [isOpen]);

  // Lock body scroll when open on mobile
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  // Filter accessible features
  const userCategory = ((user?.category || user?.kategori || user?.kategori_personel || '').toString().toLowerCase().trim());
  const isPembinaOrPengarah = userCategory === 'pembina' || userCategory === 'pengarah' || user?.assigned_profiles?.includes('pembina');

  const accessibleFeatures = useMemo(() => {
    return ALL_WORKSPACE_FEATURES.filter((f) => {
      if (f.id === 'keuangan' && isPembinaOrPengarah) return false;
      if (!f.capability) return true;
      return can(f.capability);
    });
  }, [can, isPembinaOrPengarah]);

  // Filtered by search query
  const displayFeatures = useMemo(() => {
    if (!searchQuery.trim()) return accessibleFeatures;
    const q = searchQuery.toLowerCase().trim();
    return accessibleFeatures.filter((f) => f.name.toLowerCase().includes(q));
  }, [accessibleFeatures, searchQuery]);

  // Quick Action items (real available actions)
  const quickActions = useMemo(() => {
    const actions: Array<{
      id: string;
      title: string;
      sub: string;
      icon: string;
      path: string;
      capability?: AppCapability;
    }> = [
        {
          id: 'qa-surat',
          title: 'Generator Surat',
          sub: 'Penerbitan surat izin santri',
          icon: 'fa-solid fa-shield-halved',
          path: '/hub/surat/generator',
          capability: 'hub.access',
        },
        {
          id: 'qa-pinjam',
          title: 'Pinjam Alat',
          sub: 'Ambil unit dari inventaris',
          icon: 'fa-solid fa-boxes-stacked',
          path: '/hub/peminjaman',
          capability: 'loans.view',
        },
        {
          id: 'qa-rusak',
          title: 'Lapor Kerusakan',
          sub: 'Pengajuan servis / perbaikan',
          icon: 'fa-solid fa-screwdriver-wrench',
          path: '/hub/kerusakan',
          capability: 'damage.view',
        },
        {
          id: 'qa-catatan',
          title: 'Catatan Kru',
          sub: 'Tulis & bagikan briefing',
          icon: 'fa-solid fa-note-sticky',
          path: '/hub/catatan',
          capability: 'notes.view',
        },
      ];

    return actions.filter((a) => !a.capability || can(a.capability));
  }, [can]);

  // Height calculations: Target ~80% of available viewport height so more features & quick actions are visible immediately
  const sheetHeight = Math.min(Math.max(400, Math.round(viewportHeight * 0.80)), viewportHeight - 56 - 16);

  // Touch gesture handling: strictly separated drag handle & header for dismiss, leaving internal content scroll unhindered
  const handleTouchStart = (e: React.TouchEvent, origin: 'handle' | 'header') => {
    const touch = e.touches[0];
    touchStartY.current = touch.clientY;
    touchStartX.current = touch.clientX;
    lastTouchY.current = touch.clientY;
    lastTouchTime.current = Date.now();
    isDragging.current = true;
    dragOrigin.current = origin;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const touch = e.touches[0];
    const currentY = touch.clientY;
    const currentX = touch.clientX;
    const deltaY = currentY - touchStartY.current;
    const deltaX = currentX - touchStartX.current;

    // Prevent horizontal swiping from moving sheet
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 12) {
      return;
    }

    // Only allow dragging downwards to dismiss (deltaY > 0)
    if (deltaY > 0) {
      setLiveDragOffset(deltaY);
    } else {
      // Subtle rubber-band resistance if user pulls up beyond top
      setLiveDragOffset(deltaY * 0.12);
    }
    lastTouchY.current = currentY;
    lastTouchTime.current = Date.now();
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (liveDragOffset === null) return;
    const currentOffset = liveDragOffset;
    setLiveDragOffset(null);

    const now = Date.now();
    const dt = Math.max(1, now - lastTouchTime.current);
    const velocity = (lastTouchY.current - touchStartY.current) / dt; // px/ms

    // iOS spring-based dismiss: require intentional drag > 100px or downward flick with velocity > 0.6
    if (currentOffset > 100 || (velocity > 0.6 && currentOffset > 30)) {
      onClose();
    }
  };

  // Tap on grab handle dismisses sheet
  const handleHandleTap = () => {
    onClose();
  };

  if (!isOpen) return null;

  // Real-time transform
  const currentTranslateY = liveDragOffset !== null
    ? Math.max(0, liveDragOffset)
    : 0;

  const content = (
    <>
      {/* Backdrop Scrim */}
      <div
        className="ptv-workspace-scrim"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Apple Find My Style Floating Bottom Sheet */}
      <section
        ref={sheetRef}
        className="ptv-workspace-sheet is-medium"
        role="dialog"
        aria-modal="true"
        aria-label="Progresif TV Workspace"
        style={{
          height: `${sheetHeight}px`,
          maxHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom, 0px) - 12px)',
          transform: `translate3d(0, ${currentTranslateY}px, 0)`,
          transition: liveDragOffset !== null
            ? 'none'
            : 'transform 0.36s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle & Header */}
        <div
          className="ptv-workspace-header-bar"
          onTouchStart={(e) => handleTouchStart(e, 'header')}
        >
          <div
            className="ptv-workspace-grab-handle"
            onClick={handleHandleTap}
            onTouchStart={(e) => {
              e.stopPropagation();
              handleTouchStart(e, 'handle');
            }}
            aria-label="Ubah ukuran Workspace"
            role="button"
            tabIndex={0}
          />
          <div className="ptv-workspace-header-row">
            <div>
              <h2 className="ptv-workspace-title">Progresif TV Workspace</h2>
              <p className="ptv-workspace-subtitle">
                {accessibleFeatures.length} modul &amp; ruang kerja aktif
              </p>
            </div>
            <button
              type="button"
              className="ptv-workspace-close-btn"
              onClick={onClose}
              aria-label="Tutup Workspace"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {/* Search Feature Input */}
          <div className="ptv-workspace-search-wrap">
            <i className="fa-solid fa-magnifying-glass ptv-workspace-search-icon" />
            <input
              type="text"
              className="ptv-workspace-search-input"
              placeholder="Cari fitur di workspace…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Cari fitur"
            />
            {searchQuery && (
              <button
                type="button"
                className="ptv-workspace-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Hapus pencarian"
              >
                <i className="fa-solid fa-circle-xmark" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Sheet Content (Zero drag interference) */}
        <div
          ref={contentRef}
          className="ptv-workspace-scroll-area"
        >
          {/* Quick Actions Bar (Shown when not actively searching) */}
          {!searchQuery && quickActions.length > 0 && (
            <div className="ptv-workspace-section">
              <div className="ptv-workspace-section-title">Aksi Cepat</div>
              <div className="ptv-workspace-qa-grid">
                {quickActions.map((qa) => (
                  <button
                    key={qa.id}
                    type="button"
                    className="ptv-workspace-qa-card"
                    onClick={() => {
                      onClose();
                      navigate(qa.path);
                    }}
                  >
                    <div className="ptv-workspace-qa-icon">
                      <i className={qa.icon} />
                    </div>
                    <div className="ptv-workspace-qa-info">
                      <span className="ptv-workspace-qa-name">{qa.title}</span>
                      <span className="ptv-workspace-qa-sub">{qa.sub}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All Features Grid */}
          <div className="ptv-workspace-section" style={{ marginTop: searchQuery ? '4px' : '14px' }}>
            <div className="ptv-workspace-section-title">
              {searchQuery ? `Hasil Pencarian (${displayFeatures.length})` : 'Semua Fitur & Modul'}
            </div>

            {displayFeatures.length === 0 ? (
              <div className="ptv-workspace-empty-search">
                <i className="fa-solid fa-compass" />
                <p>Tidak ada fitur yang cocok dengan &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              <div className="ptv-workspace-features-grid">
                {displayFeatures.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="ptv-workspace-app-item"
                    onClick={() => {
                      onClose();
                      navigate(item.path);
                    }}
                  >
                    <div
                      className="ptv-workspace-app-icon-box"
                      style={{
                        backgroundColor: item.pastelBg,
                        borderColor: item.pastelBorder,
                        color: item.iconColor,
                      }}
                    >
                      <i className={item.icon} />
                    </div>
                    <span className="ptv-workspace-app-name">{item.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
};
