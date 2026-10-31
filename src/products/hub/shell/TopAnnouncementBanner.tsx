import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useBroadcastAnnouncements } from '../broadcast';
import { useSessionStore } from '@core/session';
import { Announcement } from '../broadcast/types';
import { AnnouncementDetailModal } from '../broadcast/components/AnnouncementDetailModal';

// Helper: Mendapatkan tanggal hari ini di zona waktu Asia/Jakarta (format: YYYY-MM-DD)
export const getJakartaDateString = (dateObj: Date = new Date()): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(dateObj);
  } catch {
    const d = new Date(dateObj.getTime() + 7 * 3600000);
    return d.toISOString().slice(0, 10);
  }
};

// Subtle procedural SVG noise pattern overlay
const NOISE_SVG_DATA_URI =
  'url("data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20200%20200%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cfilter%20id%3D%22noiseFilter%22%3E%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%220.8%22%20numOctaves%3D%223%22%20stitchTiles%3D%22stitch%22%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20filter%3D%22url(%23noiseFilter)%22%2F%3E%3C%2Fsvg%3E")';

// Skema warna gradien ala Apple HIG: refined, deep, dan kontras sempurna
interface ColorThemeDef {
  gradient: string;
  fallbackBg: string;
  pillBg: string;
  icon: string;
}

const COLOR_THEMES: Record<string, ColorThemeDef> = {
  blue: {
    gradient: 'linear-gradient(105deg, #0284c7 0%, #0056d6 50%, #1e40af 100%)',
    fallbackBg: '#0056d6',
    pillBg: 'rgba(255, 255, 255, 0.20)',
    icon: 'fa-solid fa-bullhorn',
  },
  purple: {
    gradient: 'linear-gradient(105deg, #a855f7 0%, #7c3aed 50%, #5b21b6 100%)',
    fallbackBg: '#7c3aed',
    pillBg: 'rgba(255, 255, 255, 0.20)',
    icon: 'fa-solid fa-sparkles',
  },
  orange: {
    gradient: 'linear-gradient(105deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
    fallbackBg: '#ea580c',
    pillBg: 'rgba(0, 0, 0, 0.20)',
    icon: 'fa-solid fa-bolt',
  },
  green: {
    gradient: 'linear-gradient(105deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
    fallbackBg: '#16a34a',
    pillBg: 'rgba(0, 0, 0, 0.20)',
    icon: 'fa-solid fa-triangle-exclamation',
  },
  red: {
    gradient: 'linear-gradient(105deg, #ef4444 0%, #dc2626 50%, #991b1b 100%)',
    fallbackBg: '#dc2626',
    pillBg: 'rgba(0, 0, 0, 0.22)',
    icon: 'fa-solid fa-circle-exclamation',
  },
  yellow: {
    gradient: 'linear-gradient(105deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
    fallbackBg: '#d97706',
    pillBg: 'rgba(0, 0, 0, 0.20)',
    icon: 'fa-solid fa-bell',
  },
};

const getColorTheme = (ann: Announcement): ColorThemeDef => {
  if (ann.color_theme && COLOR_THEMES[ann.color_theme]) {
    return COLOR_THEMES[ann.color_theme];
  }
  if (ann.prio === 'penting') {
    return COLOR_THEMES.orange;
  }
  return COLOR_THEMES.blue;
};

// Interface data penyimpanan dismiss harian: Record<announcementId, YYYY-MM-DD>
type DailyDismissMap = Record<string, string>;

interface TopAnnouncementBannerProps {
  onHeightChange?: (height: number) => void;
}

export const TopAnnouncementBanner: React.FC<TopAnnouncementBannerProps> = ({ onHeightChange }) => {
  const { announcements } = useBroadcastAnnouncements();
  const { user } = useSessionStore();

  const userKey = useMemo(() => {
    return user?.id || user?.username || 'guest';
  }, [user]);

  const storageKey = `ptv_announcement_dismiss_${userKey}`;

  // Ambil data dismiss harian dari localStorage
  const [dismissMap, setDismissMap] = useState<DailyDismissMap>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [detailModalItem, setDetailModalItem] = useState<Announcement | null>(null);
  const bannerRef = React.useRef<HTMLDivElement>(null);

  // Sync state if user changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setDismissMap(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setDismissMap({});
  }, [storageKey]);

  // Filter pengumuman aktif:
  // 1. Belum kedaluwarsa (berlaku_sampai > now)
  // 2. Belum ditutup pada tanggal lokal hari ini (Asia/Jakarta)
  const activeAnnouncements = useMemo(() => {
    const now = Date.now();
    const todayJakarta = getJakartaDateString();

    return announcements.filter((ann) => {
      // Cek masa berlaku / kedaluwarsa
      if (ann.berlaku_sampai) {
        const exp = new Date(ann.berlaku_sampai).getTime();
        if (!isNaN(exp) && exp <= now) return false;
      }

      // Cek apakah sudah ditutup pada tanggal hari ini oleh user aktif
      const dismissedDate = dismissMap[ann.id];
      if (dismissedDate === todayJakarta) {
        return false;
      }

      return true;
    });
  }, [announcements, dismissMap]);

  // Pastikan currentIndex selalu valid jika jumlah berkurang
  useEffect(() => {
    if (currentIndex >= activeAnnouncements.length && activeAnnouncements.length > 0) {
      setCurrentIndex(0);
    }
  }, [activeAnnouncements.length, currentIndex]);

  // Laporkan tinggi banner aktual ke parent (HubShell & CSS variable)
  useEffect(() => {
    if (activeAnnouncements.length === 0) {
      document.documentElement.style.setProperty('--ptv-announcement-h', '0px');
      onHeightChange?.(0);
      return;
    }

    const updateHeight = () => {
      if (bannerRef.current) {
        const height = bannerRef.current.offsetHeight;
        document.documentElement.style.setProperty('--ptv-announcement-h', `${height}px`);
        onHeightChange?.(height);
      }
    };

    updateHeight();
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateHeight())
      : null;

    if (ro && bannerRef.current) {
      ro.observe(bannerRef.current);
    }

    window.addEventListener('resize', updateHeight);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateHeight);
      document.documentElement.style.setProperty('--ptv-announcement-h', '0px');
      onHeightChange?.(0);
    };
  }, [activeAnnouncements.length, currentIndex, onHeightChange]);

  // Pergantian pengumuman dengan fade halus 200ms
  const handlePageChange = useCallback((nextIdx: number) => {
    setIsFading(true);
    setTimeout(() => {
      setCurrentIndex(nextIdx);
      setIsFading(false);
    }, 180);
  }, []);

  // Handler: Tutup pengumuman untuk HARI INI saja
  const handleDismissToday = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const todayJakarta = getJakartaDateString();
    const updated: DailyDismissMap = {
      ...dismissMap,
      [id]: todayJakarta,
    };

    setDismissMap(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }, [dismissMap, storageKey]);

  if (activeAnnouncements.length === 0) {
    return null;
  }

  const current = activeAnnouncements[currentIndex] || activeAnnouncements[0];
  const theme = getColorTheme(current);
  const totalCount = activeAnnouncements.length;

  return (
    <>
      <div
        ref={bannerRef}
        id="ptvGlobalNotificationBar"
        role="region"
        aria-label="Pengumuman Siaran Global PTV"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          left: 'var(--sidebar-w, 250px)',
          zIndex: 65, // Di atas header (z-index: 60)
          background: theme.gradient,
          backgroundColor: theme.fallbackBg,
          color: '#ffffff',
          boxSizing: 'border-box',
          overflow: 'hidden',
          transition: 'background 0.3s ease, left 0.24s cubic-bezier(0.2, 0, 0, 1)',
        }}
      >
        {/* Subtle Noise / Grain Texture Layer */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: NOISE_SVG_DATA_URI,
            backgroundRepeat: 'repeat',
            opacity: 0.12,
            mixBlendMode: 'overlay',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* Ambient Top Light Reflection (Sleek Apple Accent) */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />

        {/* ── DESKTOP VIEWPORT LAYOUT (Horizontal Bar) ── */}
        <div className="ptv-banner-desktop-layout">
          {/* Left / Center Content: Badge + Title + Body */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minWidth: 0,
              flex: 1,
              overflow: 'hidden',
              opacity: isFading ? 0 : 1,
              transition: 'opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Subtle Minimal Category Badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: theme.pillBg,
                color: '#ffffff',
                fontSize: '10.5px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <i className={theme.icon} style={{ fontSize: '10px' }} />
              <span>{current.prio === 'penting' ? 'Penting' : 'Info'}</span>
            </span>

            {/* Title & Body */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                fontSize: '13px',
                lineHeight: 1.4,
              }}
            >
              <strong
                style={{
                  fontWeight: 700,
                  color: '#ffffff',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {current.title}
              </strong>
              <span
                style={{
                  color: 'rgba(255, 255, 255, 0.88)',
                  fontWeight: 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                — {current.body}
              </span>
            </div>
          </div>

          {/* Right Section: Multi-Pager + Text Link + Close X */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              flexShrink: 0,
              marginLeft: '16px',
            }}
          >
            {/* Minimalist Apple-style Pager (e.g. < 2 dari 3 >) */}
            {totalCount > 1 && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  color: 'rgba(255, 255, 255, 0.85)',
                  userSelect: 'none',
                }}
              >
                <button
                  type="button"
                  onClick={() => handlePageChange(currentIndex > 0 ? currentIndex - 1 : totalCount - 1)}
                  aria-label="Pengumuman sebelumnya"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '11px',
                    opacity: 0.8,
                    transition: 'opacity 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                >
                  <i className="fa-solid fa-chevron-left" />
                </button>
                <span>
                  {currentIndex + 1} dari {totalCount}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentIndex < totalCount - 1 ? currentIndex + 1 : 0)}
                  aria-label="Pengumuman berikutnya"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '11px',
                    opacity: 0.8,
                    transition: 'opacity 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                >
                  <i className="fa-solid fa-chevron-right" />
                </button>
              </div>
            )}

            {/* Apple-style Refined Text Action Link */}
            <button
              type="button"
              onClick={() => setDetailModalItem(current)}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                padding: '4px 6px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                opacity: 0.95,
                transition: 'opacity 0.15s ease, transform 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'translateX(2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.95';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <span style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}>Buka</span>
              <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px' }} />
            </button>

            {/* Simple Minimalist Close Button (X) */}
            <button
              type="button"
              onClick={(e) => handleDismissToday(current.id, e)}
              title="Tutup untuk hari ini (akan muncul kembali besok jika masih berlaku)"
              aria-label="Tutup pengumuman hari ini"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.85)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'color 0.15s ease, background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)';
              }}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>

        {/* ── MOBILE VIEWPORT LAYOUT (Ultra-Compact Single-Row Apple System Bar) ── */}
        <div className="ptv-banner-mobile-layout">
          {/* Left: Category Badge + Title (Primary Priority) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minWidth: 0,
              flex: 1,
              overflow: 'hidden',
              opacity: isFading ? 0 : 1,
              transition: 'opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Subtle Minimal Category Tag */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '1.5px 6px',
                borderRadius: '4px',
                backgroundColor: theme.pillBg,
                color: '#ffffff',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <i className={theme.icon} style={{ fontSize: '8.5px' }} />
              <span>{current.prio === 'penting' ? 'Penting' : 'Info'}</span>
            </span>

            {/* Title (Primary Focus, Always Clearly Visible) */}
            <strong
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.25,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0,
              }}
            >
              {current.title}
            </strong>
          </div>

          {/* Right: Pager (if multi) + Compact Action Link "Buka >" + Close Button X */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
            }}
          >
            {totalCount > 1 && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '1px',
                  fontSize: '9.5px',
                  fontWeight: 500,
                  color: 'rgba(255, 255, 255, 0.85)',
                  userSelect: 'none',
                }}
              >
                <button
                  type="button"
                  onClick={() => handlePageChange(currentIndex > 0 ? currentIndex - 1 : totalCount - 1)}
                  aria-label="Pengumuman sebelumnya"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    padding: '3px 1px',
                    fontSize: '9px',
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    opacity: 0.8,
                  }}
                >
                  <i className="fa-solid fa-chevron-left" />
                </button>
                <span>
                  {currentIndex + 1}/{totalCount}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentIndex < totalCount - 1 ? currentIndex + 1 : 0)}
                  aria-label="Pengumuman berikutnya"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    padding: '3px 1px',
                    fontSize: '9px',
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    opacity: 0.8,
                  }}
                >
                  <i className="fa-solid fa-chevron-right" />
                </button>
              </div>
            )}

            {/* Compact Action Link "Buka >" */}
            <button
              type="button"
              onClick={() => setDetailModalItem(current)}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                padding: '3px 2px',
                fontSize: '11px',
                fontWeight: 650,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                whiteSpace: 'nowrap',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              <span>Buka</span>
              <i className="fa-solid fa-chevron-right" style={{ fontSize: '8px' }} />
            </button>

            {/* Close Button X */}
            <button
              type="button"
              onClick={(e) => handleDismissToday(current.id, e)}
              aria-label="Tutup pengumuman hari ini"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.9)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '14px',
                cursor: 'pointer',
                flexShrink: 0,
                marginLeft: '1px',
              }}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detailModalItem && (
        <AnnouncementDetailModal
          announcement={detailModalItem}
          isOpen={Boolean(detailModalItem)}
          onClose={() => setDetailModalItem(null)}
          canManage={false}
        />
      )}
    </>
  );
};
