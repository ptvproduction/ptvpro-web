import React, { useState, useMemo, useRef } from 'react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import {
  PORTAL_CATEGORIES,
  SERVICE_STATUS_LABELS,
  SERVICE_ACCESS_LABELS,
} from '../../portal/services/portalCatalog';
import { PortalService, CategoryFilterId, Locale } from '../types';
import { PortalManagedService } from '../../hub/portal-management/types';

interface LauncherDirectoryProps {
  lang?: Locale;
  /** Layanan published dari snapshot portal. Tidak ada katalog cadangan. */
  managedServices: PortalManagedService[];
}

export const LauncherDirectory: React.FC<LauncherDirectoryProps> = ({
  lang = 'id',
  managedServices,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterId>('all');
  const [soonModalService, setSoonModalService] = useState<PortalService | null>(null);

  const soonModalRef = useRef<HTMLDivElement>(null);
  useModalScrollLock({
    isOpen: Boolean(soonModalService),
    onClose: () => setSoonModalService(null),
    modalRef: soonModalRef,
    id: 'lp-soon-service-modal',
  });

  // Adaptasi layanan snapshot ke bentuk kartu direktori
  const activeServiceList: PortalService[] = useMemo(() => {
    return managedServices
      .filter((ms) => ms.isActive && (ms.pub === 1 || ms.isPublished))
      .map((ms) => {
        const nameObj = ms.name || ms.n || { id: (ms as any).title || ms.id, en: (ms as any).title || ms.id, ar: '' };
        const descObj = ms.desc || ms.d || { id: (ms as any).description || '', en: (ms as any).description || '', ar: '' };
        return {
          id: ms.id,
          cat: (ms.cat === 'yayasan' || ms.cat === 'ptv' || ms.cat === 'season'
            ? ms.cat
            : ms.isSeasonal
            ? 'season'
            : 'ptv') as 'ptv' | 'yayasan' | 'season',
          n: nameObj,
          d: descObj,
          url: ms.href || ms.url || (ms as any).link,
          ic: ms.icon || ms.ic || 'globe',
          st: ms.st || 'ok',
          ac: (ms.ac || (ms.cat === 'internal' ? 'crew' : 'open')),
          pub: ms.pub ?? (ms.isPublished ? 1 : 0),
          isExternal: Boolean((ms.url || ms.href || (ms as any).link) && String(ms.url || ms.href || (ms as any).link).startsWith('http')),
        };
      });
  }, [managedServices]);

  // Filtered services logic
  const filteredServices = useMemo(() => {
    return activeServiceList.filter((svc) => {
      // 1. Category match
      if (selectedCategory !== 'all' && svc.cat !== selectedCategory) {
        return false;
      }
      // 2. Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const displayName = svc.n[lang] || svc.n.id;
        const nameMatch = displayName?.toLowerCase().includes(q);
        const descMatch = svc.d[lang]?.toLowerCase().includes(q) || svc.d.id?.toLowerCase().includes(q);
        return nameMatch || descMatch;
      }
      return true;
    });
  }, [activeServiceList, selectedCategory, searchQuery, lang]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilterId, number> = {
      all: activeServiceList.length,
      yayasan: activeServiceList.filter((s) => s.cat === 'yayasan').length,
      ptv: activeServiceList.filter((s) => s.cat === 'ptv').length,
      season: activeServiceList.filter((s) => s.cat === 'season').length,
    };
    return counts;
  }, [activeServiceList]);

  const handleCardClick = (e: React.MouseEvent, svc: PortalService) => {
    if (svc.st === 'soon' || !svc.url) {
      e.preventDefault();
      setSoonModalService(svc);
    }
  };

  return (
    <section id="direktori-layanan" className="lp-section lp-directory-section">
      <div className="lp-section-head lp-scroll-reveal">
        <div>
          <span className="lp-eyebrow">DIREKTORI RESMI PTVPRO</span>
          <h2 className="lp-directory-heading">
            <span className="lp-title-line-mask">
              <span className="lp-title-line">Jelajahi layanan.</span>
            </span>
          </h2>
        </div>
        <p className="lp-directory-lead">
          Akses cepat ke seluruh aplikasi, sistem administrasi, dan media internal.
        </p>
      </div>

      {/* Search and Filter Controls */}
      <div className="lp-directory-controls lp-scroll-reveal">
        <div className="lp-search-box">
          <span className="lp-search-icon" aria-hidden="true">
            🔍
          </span>
          <input
            type="text"
            className="lp-search-input"
            placeholder="Cari layanan (misal: PTV Hub, Dokumen, Aset)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Cari layanan"
          />
          {searchQuery && (
            <button
              type="button"
              className="lp-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Hapus teks pencarian"
            >
              ✕
            </button>
          )}
        </div>

        <div
          className="lp-category-chips"
          role="group"
          aria-label="Filter kategori layanan"
        >
          <button
            type="button"
            className={`lp-chip ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            Semua ({categoryCounts.all})
          </button>
          {PORTAL_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`lp-chip ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id as CategoryFilterId)}
            >
              {cat.n[lang]} ({categoryCounts[cat.id as CategoryFilterId] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {/* Services Grid */}
      {filteredServices.length > 0 ? (
        <div className="lp-services-grid lp-scroll-reveal">
          {filteredServices.map((svc, index) => {
            const isSoon = svc.st === 'soon';
            const statusLabel = SERVICE_STATUS_LABELS[svc.st]?.[lang] || 'Aktif';
            const accessLabel = SERVICE_ACCESS_LABELS[svc.ac]?.[lang] || 'Umum';
            const categoryName =
              PORTAL_CATEGORIES.find((c) => c.id === svc.cat)?.n[lang] || svc.cat;
            const serviceDisplayName = svc.n[lang] || svc.n.id;

            return (
              <a
                key={svc.id}
                href={svc.url || '#'}
                onClick={(e) => handleCardClick(e, svc)}
                target={svc.isExternal ? '_blank' : undefined}
                rel={svc.isExternal ? 'noopener noreferrer' : undefined}
                className={`lp-service-item lp-card-reveal ${isSoon ? 'is-soon' : ''}`}
                style={{ '--card-index': index } as React.CSSProperties}
              >
                <div>
                  <div className="lp-service-header">
                    <span className="lp-service-cat-pill">{categoryName}</span>
                    <span
                      className={`lp-service-status-pill ${
                        isSoon ? 'status-soon' : 'status-ok'
                      }`}
                    >
                      <span className="lp-dot" />
                      {statusLabel}
                    </span>
                  </div>

                  <h3 className="lp-service-name">{serviceDisplayName}</h3>
                  <p className="lp-service-description">{svc.d[lang]}</p>
                </div>

                <div className="lp-service-footer">
                  <span className="lp-access-badge">{accessLabel}</span>
                  <div className="lp-service-action">
                    <span>{isSoon ? 'INFO' : 'BUKA'}</span>
                    <span aria-hidden="true">{isSoon ? 'ℹ' : '↗'}</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="lp-empty-state lp-reveal">
          <div className="lp-empty-icon">📂</div>
          <h3>Tidak ada layanan yang cocok</h3>
          <p>
            Kata kunci &ldquo;<strong>{searchQuery}</strong>&rdquo; tidak ditemukan pada
            kategori ini.
          </p>
          <button
            type="button"
            className="lp-pill dark"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
          >
            TAMPILKAN SEMUA LAYANAN
          </button>
        </div>
      )}

      {/* Segera Hadir / Info Modal */}
      {soonModalService && (
        <div
          className="lp-modal-overlay"
          onClick={() => setSoonModalService(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="soonModalTitle"
        >
          <div
            ref={soonModalRef}
            className="lp-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lp-modal-header">
              <span className="lp-service-cat-pill">INFORMASI LAYANAN</span>
              <button
                type="button"
                className="lp-modal-close"
                onClick={() => setSoonModalService(null)}
                aria-label="Tutup dialog"
              >
                ✕
              </button>
            </div>
            <h3 id="soonModalTitle" className="lp-modal-title">
              {soonModalService.n[lang]}
            </h3>
            <div className="lp-modal-badge status-soon">
              <span className="lp-dot" />
              {SERVICE_STATUS_LABELS[soonModalService.st]?.[lang]}
            </div>
            <p className="lp-modal-desc">{soonModalService.d[lang]}</p>
            <div className="lp-modal-note">
              Layanan ini masih dalam tahap persiapan atau beroperasi secara musiman.
              Pemberitahuan resmi akan diumumkan saat layanan telah dibuka untuk publik.
            </div>
            <button
              type="button"
              className="lp-pill dark"
              style={{ width: '100%', justifyContent: 'center', marginTop: '20px' }}
              onClick={() => setSoonModalService(null)}
            >
              MENGERTI
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
