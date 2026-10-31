import React, { useState, useRef } from 'react';
import { useSessionStore } from '@core/session';
import {
  portalManagementService,
} from './services/portalManagementService';
import {
  PortalManagedService,
  PortalManagedAnnouncement,
  PortalSettings,
  PortalAuditLog,
  ServiceStatus,
} from './types';
import { ServiceEditModal } from './components/ServiceEditModal';
import { ServiceStatusModal } from './components/ServiceStatusModal';
import { AnnouncementFormModal } from './components/AnnouncementFormModal';
import { PublishConfirmModal } from './components/PublishConfirmModal';
import { CardListSkeleton } from '@/shared/components';
import { useInstantData } from '@/shared/hooks/useInstantData';
import '../../../styles/portalManagement.css';

type ActiveTab = 'services' | 'status' | 'announcements' | 'seasonal' | 'settings' | 'audit';

const getServiceIconClass = (icon?: string): string => {
  switch (icon) {
    case 'hub':
      return 'fa-solid fa-tv';
    case 'id':
      return 'fa-solid fa-id-badge';
    case 'surat':
      return 'fa-solid fa-file-signature';
    case 'bsh':
      return 'fa-solid fa-link';
    case 'haul':
      return 'fa-solid fa-calendar-days';
    default:
      return 'fa-solid fa-globe';
  }
};

export const PortalManagementPage: React.FC = () => {
  const { user, can } = useSessionStore();

  const canManage = can('settings.system') || can('crew.permissions.manage');
  const canPublish = can('settings.system') || can('crew.permissions.manage');

  const [activeTab, setActiveTab] = useState<ActiveTab>('services');

  const {
    data: bundle,
    isLoading,
    refetch: loadData,
  } = useInstantData<{
    services: PortalManagedService[];
    announcements: PortalManagedAnnouncement[];
    settings: PortalSettings | null;
    auditLogs: PortalAuditLog[];
  }>({
    key: 'portal_management_bundle',
    fetcher: async () => {
      const [svc, ann, set, logs] = await Promise.all([
        portalManagementService.getServices(true),
        portalManagementService.getAnnouncements(true),
        portalManagementService.getSettings(true),
        portalManagementService.getAuditLogs(),
      ]);
      return {
        services: svc,
        announcements: ann,
        settings: set,
        auditLogs: logs,
      };
    },
    initialData: {
      services: [],
      announcements: [],
      settings: null,
      auditLogs: [],
    },
    ttlMs: 5 * 60 * 1000,
  });

  const [localServices, setLocalServices] = useState<PortalManagedService[] | null>(null);
  const services = localServices || bundle.services;
  const setServices = setLocalServices;
  const announcements = bundle.announcements;
  const [localSettings, setLocalSettings] = useState<PortalSettings | null>(null);
  const settings = localSettings || bundle.settings;
  const setSettings = setLocalSettings;
  const auditLogs = bundle.auditLogs;

  React.useEffect(() => {
    setLocalServices(null);
  }, [bundle.services]);

  // Modals state
  const [editingService, setEditingService] = useState<PortalManagedService | null | undefined>(undefined);
  const [statusModalService, setStatusModalService] = useState<PortalManagedService | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<PortalManagedAnnouncement | null | undefined>(undefined);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  // Modal mutually-exclusive openers (prevents stacked modals)
  const openServiceModal = (svc: PortalManagedService | null) => {
    setStatusModalService(null);
    setEditingAnnouncement(undefined);
    setIsPublishModalOpen(false);
    setEditingService(svc);
  };

  const openStatusModal = (svc: PortalManagedService) => {
    setEditingService(undefined);
    setEditingAnnouncement(undefined);
    setIsPublishModalOpen(false);
    setStatusModalService(svc);
  };

  const openAnnouncementModal = (ann: PortalManagedAnnouncement | null) => {
    setEditingService(undefined);
    setStatusModalService(null);
    setIsPublishModalOpen(false);
    setEditingAnnouncement(ann);
  };

  const openPublishModal = () => {
    setEditingService(undefined);
    setStatusModalService(null);
    setEditingAnnouncement(undefined);
    setIsPublishModalOpen(true);
  };

  // Hitung jumlah draft yang belum dipublikasikan
  const pendingServiceDrafts = services.filter((s) => s.hasDraft).length;
  const pendingAnnDrafts = announcements.filter((a) => a.hasDraft).length;
  const pendingSettingsDraft = settings?.hasDraft ? 1 : 0;
  const totalPendingDrafts = pendingServiceDrafts + pendingAnnDrafts + pendingSettingsDraft;

  // Handlers untuk Service
  const handleSaveService = async (data: Partial<PortalManagedService> & { id: string }, asDraft: boolean) => {
    await portalManagementService.saveService(data, asDraft, { id: user?.id, name: user?.full_name });
    await loadData();
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartIndexRef = useRef<number | null>(null);

  const handleSaveStatus = async (serviceId: string, status: ServiceStatus, note?: string) => {
    await portalManagementService.updateServiceStatus(serviceId, status, note, true, { id: user?.id, name: user?.full_name });
    await loadData();
  };

  const handleToggleServiceActive = async (service: PortalManagedService) => {
    if (!canManage) return;
    await portalManagementService.saveService(
      { id: service.id, isActive: !service.isActive },
      true,
      { id: user?.id, name: user?.full_name }
    );
    await loadData();
  };

  const handleDragStart = (index: number, e: React.DragEvent) => {
    if (!canManage) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (index: number, e: React.DragEvent) => {
    if (!canManage || draggedIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (targetIndex: number) => {
    if (!canManage || draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...services];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, moved);

    setDraggedIndex(null);
    setDragOverIndex(null);

    // Update state segera dengan status draft
    const draftUpdated = updated.map((s, idx) => ({
      ...s,
      sortOrder: idx,
      hasDraft: true,
      draftPayload: {
        ...(s.draftPayload || {}),
        sortOrder: idx,
      },
    }));
    setServices(draftUpdated);

    const orderPayload = updated.map((s, idx) => ({ id: s.id, sortOrder: idx }));
    await portalManagementService.reorderServices(orderPayload, true, { id: user?.id, name: user?.full_name });
    await loadData();
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Touch Drag & Drop untuk mobile
  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    if (!canManage) return;
    touchStartIndexRef.current = index;
    touchStartYRef.current = e.touches[0].clientY;
    setDraggedIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!canManage || touchStartIndexRef.current === null) return;
    const touch = e.touches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    const rowEl = targetElement?.closest('[data-service-index]');
    if (rowEl) {
      const idxAttr = rowEl.getAttribute('data-service-index');
      if (idxAttr !== null) {
        const hoverIdx = parseInt(idxAttr, 10);
        if (!isNaN(hoverIdx) && hoverIdx !== dragOverIndex) {
          setDragOverIndex(hoverIdx);
        }
      }
    }
  };

  const handleTouchEnd = async () => {
    if (!canManage || touchStartIndexRef.current === null) return;
    const fromIdx = touchStartIndexRef.current;
    const toIdx = dragOverIndex;
    touchStartIndexRef.current = null;
    touchStartYRef.current = null;

    if (toIdx !== null && toIdx !== fromIdx) {
      setDraggedIndex(fromIdx);
      await handleDrop(toIdx);
    } else {
      setDraggedIndex(null);
      setDragOverIndex(null);
    }
  };

  // Handlers untuk Announcement
  const handleSaveAnnouncement = async (data: Partial<PortalManagedAnnouncement> & { id?: string }, asDraft: boolean) => {
    await portalManagementService.saveAnnouncement(data, asDraft, { id: user?.id, name: user?.full_name });
    await loadData();
  };

  const handleToggleAnnouncementActive = async (ann: PortalManagedAnnouncement) => {
    if (!canManage) return;
    await portalManagementService.saveAnnouncement(
      { id: ann.id, isActive: !ann.isActive },
      true,
      { id: user?.id, name: user?.full_name }
    );
    await loadData();
  };

  // Handlers untuk Settings
  const handleSaveSettings = async (asDraft: boolean) => {
    if (!settings || !canManage) return;
    await portalManagementService.saveSettings(settings, asDraft, { id: user?.id, name: user?.full_name });
    await loadData();
    alert(asDraft ? 'Draft pengaturan tersimpan.' : 'Pengaturan portal langsung diperbarui.');
  };

  // Handler Global Publish
  const handleConfirmPublishAll = async () => {
    await portalManagementService.publishAllDrafts({ id: user?.id, name: user?.full_name });
    await loadData();
  };

  // Status helper badge
  const getStatusBadge = (st: ServiceStatus) => {
    switch (st) {
      case 'ok':
        return (
          <span className="pm-status-pill ok">
            <i className="fa-solid fa-circle" style={{ fontSize: '6px' }} /> Normal
          </span>
        );
      case 'incident':
        return (
          <span className="pm-status-pill incident">
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '10px' }} /> Gangguan
          </span>
        );
      case 'maint':
        return (
          <span className="pm-status-pill maint">
            <i className="fa-solid fa-screwdriver-wrench" style={{ fontSize: '10px' }} /> Pemeliharaan
          </span>
        );
      case 'soon':
        return (
          <span className="pm-status-pill soon">
            <i className="fa-regular fa-clock" style={{ fontSize: '10px' }} /> Segera Hadir
          </span>
        );
    }
  };

  return (
    <div className="pm-page-root">
      {/* Header Halaman Standar R03 */}
      <div className="pm-header-row">
        <div className="ptv-page-header-main">
          <h1 className="ptv-page-title">Pengelolaan Portal &amp; Status Layanan</h1>
          <p className="ptv-page-subtitle">
            Pusat kendali direktori layanan, status operasional transparan, pengumuman, dan konfigurasi launcher resmi Progresif TV.
          </p>
        </div>

        <div className="pm-header-actions">
          <a
            href="/?previewDraft=true"
            target="_blank"
            rel="noopener noreferrer"
            className="pm-btn-pill pm-btn-secondary"
          >
            <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '11px' }} />
            <span>Preview Portal</span>
          </a>

          {canPublish && (
            <button
              type="button"
              className={`pm-btn-pill ${totalPendingDrafts > 0 ? 'pm-btn-primary' : 'pm-btn-secondary'}`}
              disabled={totalPendingDrafts === 0}
              onClick={openPublishModal}
            >
              <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '11.5px' }} />
              <span>Publikasikan ({totalPendingDrafts} Draft)</span>
            </button>
          )}
        </div>
      </div>

      {/* Draft Notification Banner jika ada draft tertunda */}
      {totalPendingDrafts > 0 && (
        <div className="pm-draft-banner">
          <div className="pm-draft-banner-text">
            <strong>Terdapat {totalPendingDrafts} perubahan draft yang belum dipublikasikan ke publik.</strong>
            <span>
              Perubahan hanya terlihat pada mode preview dan tidak memengaruhi portal publik sebelum diterbitkan oleh Administrator.
            </span>
          </div>
          {canPublish && (
            <button
              type="button"
              className="pm-btn-pill pm-btn-primary"
              onClick={openPublishModal}
            >
              Publikasikan Sekarang
            </button>
          )}
        </div>
      )}

      {/* Segmented Tab Navigation R03 */}
      <div className="pm-tabs-wrap">
        <div className="pm-tabs-rail" role="tablist" aria-label="Navigasi Pengelolaan Portal">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'services'}
            className={`pm-tab-btn ${activeTab === 'services' ? 'active' : ''}`}
            onClick={() => setActiveTab('services')}
          >
            <i className="fa-solid fa-layer-group" />
            <span>Direktori Layanan</span>
            <span className="pm-tab-count">{services.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'status'}
            className={`pm-tab-btn ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => setActiveTab('status')}
          >
            <i className="fa-solid fa-heart-pulse" />
            <span>Status Operasional</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'announcements'}
            className={`pm-tab-btn ${activeTab === 'announcements' ? 'active' : ''}`}
            onClick={() => setActiveTab('announcements')}
          >
            <i className="fa-solid fa-bullhorn" />
            <span>Pengumuman</span>
            <span className="pm-tab-count">{announcements.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'seasonal'}
            className={`pm-tab-btn ${activeTab === 'seasonal' ? 'active' : ''}`}
            onClick={() => setActiveTab('seasonal')}
          >
            <i className="fa-solid fa-calendar-check" />
            <span>Layanan Musiman</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'settings'}
            className={`pm-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <i className="fa-solid fa-sliders" />
            <span>Pengaturan Portal</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'audit'}
            className={`pm-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <i className="fa-solid fa-clock-rotate-left" />
            <span>Riwayat Perubahan</span>
          </button>
        </div>
      </div>

      {isLoading && services.length === 0 ? (
        <CardListSkeleton count={4} />
      ) : (
        <>
          {/* TAB 1: DIREKTORI LAYANAN */}
          {activeTab === 'services' && (
            <div>
              <div className="pm-section-bar">
                <p className="pm-section-desc">
                  Kelola daftar layanan yang terdaftar pada sistem launcher Progresif TV.
                </p>
                {canManage && (
                  <button
                    type="button"
                    className="pm-btn-pill pm-btn-primary"
                    onClick={() => openServiceModal(null)}
                  >
                    <i className="fa-solid fa-plus" style={{ fontSize: '11px' }} />
                    <span>Tambah Layanan Baru</span>
                  </button>
                )}
              </div>

              <div className="pm-service-list">
                {services.map((svc, index) => (
                  <div
                    key={svc.id}
                    data-service-index={index}
                    className={`pm-service-row ${!svc.isActive ? 'is-inactive' : ''} ${draggedIndex === index ? 'is-dragging' : ''} ${dragOverIndex === index ? 'is-dragover' : ''}`}
                    onDragOver={(e) => handleDragOver(index, e)}
                    onDrop={() => handleDrop(index)}
                  >
                    <div className="pm-service-identity">
                      {canManage && (
                        <div
                          className="pm-drag-handle"
                          draggable
                          onDragStart={(e) => handleDragStart(index, e)}
                          onDragEnd={handleDragEnd}
                          onTouchStart={(e) => handleTouchStart(index, e)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          title="Tahan dan geser untuk mengatur urutan (Draft)"
                          aria-label={`Geser urutan ${svc.name.id}`}
                        >
                          <i className="fa-solid fa-grip-vertical" />
                        </div>
                      )}
                      <div className="pm-service-icon">
                        <i className={getServiceIconClass(svc.icon)} />
                      </div>
                      <div className="pm-service-main">
                        <div className="pm-service-title-row">
                          <span className="pm-service-name">{svc.name.id}</span>
                          {getStatusBadge(svc.st)}
                          {svc.hasDraft && <span className="pm-meta-tag draft">Draft Update</span>}
                          {svc.isSeasonal && <span className="pm-meta-tag">Musiman</span>}
                          {svc.pub === 0 && <span className="pm-meta-tag">Internal Saja</span>}
                          {!svc.isActive && <span className="pm-meta-tag inactive">Nonaktif</span>}
                        </div>
                        <div className="pm-service-sub">
                          <span>{svc.desc.id}</span>
                          <code className="pm-service-path">{svc.href}</code>
                          {svc.statusNote && (
                            <span className="pm-status-note" title={svc.statusNote}>
                              · {svc.statusNote}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {canManage && (
                      <div className="pm-service-controls">
                        <button
                          type="button"
                          className="pm-row-btn"
                          onClick={() => openStatusModal(svc)}
                          title="Ubah kondisi operasional"
                        >
                          Status
                        </button>

                        <button
                          type="button"
                          className="pm-row-btn"
                          onClick={() => openServiceModal(svc)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className={`pm-row-btn ${!svc.isActive ? 'activate' : ''}`}
                          onClick={() => handleToggleServiceActive(svc)}
                        >
                          {svc.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: STATUS OPERASIONAL */}
          {activeTab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="pm-surface-card">
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>
                  Ringkasan Kondisi Ekosistem Publik
                </h3>
                <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: '13px' }}>
                  Status ini menjadi <strong>satu sumber data kebenaran</strong> untuk kartu launcher, ringkasan footer, dan halaman status publik.
                </p>

                <div className="pm-stat-grid">
                  <div className="pm-stat-box ok">
                    <div className="pm-stat-num">
                      {services.filter((s) => s.st === 'ok' && s.pub === 1).length}
                    </div>
                    <div className="pm-stat-label">Layanan Normal</div>
                  </div>
                  <div className="pm-stat-box incident">
                    <div className="pm-stat-num">
                      {services.filter((s) => s.st === 'incident').length}
                    </div>
                    <div className="pm-stat-label">Gangguan Terdeteksi</div>
                  </div>
                  <div className="pm-stat-box maint">
                    <div className="pm-stat-num">
                      {services.filter((s) => s.st === 'maint').length}
                    </div>
                    <div className="pm-stat-label">Sedang Pemeliharaan</div>
                  </div>
                  <div className="pm-stat-box soon">
                    <div className="pm-stat-num">
                      {services.filter((s) => s.st === 'soon').length}
                    </div>
                    <div className="pm-stat-label">Segera Hadir</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>
                  Kontrol Cepat Status Per Layanan
                </h4>
                <div className="pm-status-cards-grid">
                  {services.map((svc) => (
                    <div key={svc.id} className="pm-status-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{svc.name.id}</strong>
                        {getStatusBadge(svc.st)}
                      </div>
                      <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.4 }}>
                        {svc.statusNote || 'Kondisi operasional normal.'}
                      </p>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: 'auto', paddingTop: '4px' }}>
                        Diperbarui: {new Date(svc.statusUpdatedAt || svc.updatedAt || Date.now()).toLocaleString('id-ID')}
                      </div>
                      {canManage && (
                        <button
                          type="button"
                          className="pm-row-btn"
                          style={{ width: '100%', justifyContent: 'center', marginTop: '4px', minHeight: '34px' }}
                          onClick={() => openStatusModal(svc)}
                        >
                          Perbarui Catatan / Status
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PENGUMUMAN */}
          {activeTab === 'announcements' && (
            <div>
              <div className="pm-section-bar">
                <p className="pm-section-desc">
                  Kelola pesan pengumuman resmi yang tampil secara compact pada launcher.
                </p>
                {canManage && (
                  <button
                    type="button"
                    className="pm-btn-pill pm-btn-primary"
                    onClick={() => openAnnouncementModal(null)}
                  >
                    <i className="fa-solid fa-plus" style={{ fontSize: '11px' }} />
                    <span>Buat Pengumuman Baru</span>
                  </button>
                )}
              </div>

              <div className="pm-service-list">
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className={`pm-service-row ${!ann.isActive ? 'is-inactive' : ''}`}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="pm-service-title-row">
                        <span className="pm-service-name">{ann.title.id}</span>
                        {ann.hasDraft && <span className="pm-meta-tag draft">Draft Update</span>}
                        <span className="pm-meta-tag">Format: {ann.format}</span>
                        {!ann.isActive && <span className="pm-meta-tag inactive">Diarsipkan</span>}
                      </div>
                      <p style={{ margin: '4px 0 6px', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.45 }}>
                        {ann.body.id}
                      </p>
                      <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                        Periode: {ann.startDate || 'Sekarang'} s/d {ann.endDate || 'Seterusnya'} · Tombol: <strong style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{ann.ctaText?.id || '-'}</strong> ({ann.ctaHref || '-'})
                      </div>
                    </div>

                    {canManage && (
                      <div className="pm-service-controls">
                        <button
                          type="button"
                          className="pm-row-btn"
                          onClick={() => openAnnouncementModal(ann)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={`pm-row-btn ${!ann.isActive ? 'activate' : ''}`}
                          onClick={() => handleToggleAnnouncementActive(ann)}
                        >
                          {ann.isActive ? 'Arsipkan' : 'Aktifkan'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: LAYANAN MUSIMAN */}
          {activeTab === 'seasonal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="pm-surface-card">
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>
                  Manajemen Layanan Musiman (Seasonal Services)
                </h3>
                <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: '13px', lineHeight: 1.45 }}>
                  Layanan musiman (seperti Registrasi Majelis Sama&apos; Haul PPBS, Layanan Ramadhan) akan otomatis aktif dan nonaktif sesuai rentang tanggal yang ditentukan tanpa menghapus data historis.
                </p>
              </div>

              <div className="pm-service-list">
                {services.filter((s) => s.isSeasonal).map((svc) => (
                  <div key={svc.id} className="pm-service-row">
                    <div>
                      <div className="pm-service-title-row">
                        <span className="pm-service-name">{svc.name.id}</span>
                        <span className="pm-meta-tag">Musiman</span>
                        {getStatusBadge(svc.st)}
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--ink-2)', marginTop: '4px' }}>
                        Periode Aktif: <strong style={{ fontWeight: 600, color: 'var(--ink)' }}>{svc.seasonalStart || 'Tidak dibatasi'}</strong> s/d <strong style={{ fontWeight: 600, color: 'var(--ink)' }}>{svc.seasonalEnd || 'Tidak dibatasi'}</strong>
                      </div>
                    </div>

                    {canManage && (
                      <div className="pm-service-controls">
                        <button
                          type="button"
                          className="pm-row-btn"
                          onClick={() => openServiceModal(svc)}
                        >
                          Ubah Periode &amp; Pengaturan
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {services.filter((s) => s.isSeasonal).length === 0 && (
                  <div className="pm-surface-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-2)' }}>
                    Belum ada layanan yang ditandai sebagai musiman. Anda dapat menandai layanan sebagai musiman melalui tombol Edit di Direktori Layanan.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: PENGATURAN PORTAL */}
          {activeTab === 'settings' && settings && (
            <div className="pm-surface-card" style={{ maxWidth: '800px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>
                Pengaturan Pusat Bantuan Portal
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="set-label">Nomor WhatsApp Pusat Bantuan Resmi</label>
                  <input
                    type="text"
                    className="set-input"
                    value={settings.helpWaNumber}
                    onChange={(e) => setSettings({ ...settings, helpWaNumber: e.target.value })}
                    placeholder="contoh: 62895325884964"
                    disabled={!canManage}
                  />
                  <small style={{ color: 'var(--muted)', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                    Format nomor WhatsApp resmi internasional (misal: 62895325884964) tanpa tanda tambah atau spasi.
                  </small>
                </div>

                {canManage && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="pm-btn-pill pm-btn-secondary"
                      onClick={() => handleSaveSettings(true)}
                    >
                      <i className="fa-regular fa-floppy-disk" />
                      <span>Simpan Sebagai Draft</span>
                    </button>
                    {canPublish && (
                      <button
                        type="button"
                        className="pm-btn-pill pm-btn-primary"
                        onClick={() => handleSaveSettings(false)}
                      >
                        <i className="fa-solid fa-cloud-arrow-up" />
                        <span>Terbitkan Pengaturan</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: RIWAYAT PERUBAHAN */}
          {activeTab === 'audit' && (
            <div>
              <div className="pm-section-bar">
                <p className="pm-section-desc">
                  Catatan audit log setiap penambahan, pengubahan, pembaruan status, dan publikasi portal.
                </p>
              </div>

              <div className="pm-surface-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
                        <th style={{ padding: '11px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Waktu</th>
                        <th style={{ padding: '11px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Pengguna</th>
                        <th style={{ padding: '11px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Aksi</th>
                        <th style={{ padding: '11px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Entitas</th>
                        <th style={{ padding: '11px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Detail Perubahan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid var(--line-2)' }}>
                          <td style={{ padding: '11px 16px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                            {new Date(log.timestamp).toLocaleString('id-ID')}
                          </td>
                          <td style={{ padding: '11px 16px', fontWeight: 600, color: 'var(--ink)' }}>{log.userName}</td>
                          <td style={{ padding: '11px 16px' }}>
                            <span className={`pm-status-pill ${
                              log.action === 'publish' ? 'ok' : log.action === 'create' ? 'soon' : 'maint'
                            }`}>
                              {log.action.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '11px 16px', color: 'var(--ink-2)' }}>
                            {log.entityType} ({log.entityId})
                          </td>
                          <td style={{ padding: '11px 16px', color: 'var(--ink)' }}>{log.details}</td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
                            Belum ada catatan aktivitas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODALS (Mutually exclusive via portal) */}
      {editingService !== undefined && (
        <ServiceEditModal
          isOpen={true}
          onClose={() => setEditingService(undefined)}
          service={editingService}
          onSave={handleSaveService}
          canPublish={canPublish}
        />
      )}

      {statusModalService && editingService === undefined && (
        <ServiceStatusModal
          isOpen={true}
          onClose={() => setStatusModalService(null)}
          service={statusModalService}
          onSaveStatus={handleSaveStatus}
        />
      )}

      {editingAnnouncement !== undefined && editingService === undefined && !statusModalService && (
        <AnnouncementFormModal
          isOpen={true}
          onClose={() => setEditingAnnouncement(undefined)}
          announcement={editingAnnouncement}
          onSave={handleSaveAnnouncement}
          canPublish={canPublish}
        />
      )}

      {isPublishModalOpen && editingService === undefined && !statusModalService && editingAnnouncement === undefined && (
        <PublishConfirmModal
          isOpen={true}
          onClose={() => setIsPublishModalOpen(false)}
          pendingCount={totalPendingDrafts}
          onConfirmPublish={handleConfirmPublishAll}
        />
      )}
    </div>
  );
};
