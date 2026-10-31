import React, { useState, useEffect } from 'react';
import { useSessionStore } from '@/core/session';
import { AuthUser } from '@/core/auth/types';
import { useBroadcastAnnouncements, broadcastStore } from './broadcastStore';
import { broadcastService } from './broadcastService';
import { Announcement } from './types';
import { AnnouncementModal } from './components/AnnouncementModal';
import { AnnouncementDetailModal } from './components/AnnouncementDetailModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { CardListSkeleton } from '@/shared/components';
import '@/styles/broadcast.css';

interface BroadcastPageProps {
  currentUser?: AuthUser | null;
}

export const BroadcastPage: React.FC<BroadcastPageProps> = ({ currentUser }) => {
  const sessionLoading = useSessionStore((s) => s.isLoading);
  const sessionUser = useSessionStore((s) => s.user);
  const can = useSessionStore((s) => s.can);
  const user = currentUser !== undefined ? currentUser : sessionUser;
  const { announcements, addAnnouncement, updateAnnouncement, deleteAnnouncement } =
    useBroadcastAnnouncements();

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Live Staging fetch
  useEffect(() => {
    if (sessionLoading || !user) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const fetchAnnouncements = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const liveItems = await broadcastService.getAnnouncements(true);
        if (isMounted && Array.isArray(liveItems) && liveItems.length > 0) {
          broadcastStore.setLiveAnnouncements(liveItems);
        }
      } catch (err: any) {
        if (isMounted) setLoadError(err.message || 'Gagal memuat pengumuman live.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchAnnouncements();
    return () => {
      isMounted = false;
    };
  }, [sessionLoading, user]);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [detailAnnouncement, setDetailAnnouncement] = useState<Announcement | null>(null);
  const [deletingAnnouncement, setDeletingAnnouncement] = useState<Announcement | null>(null);

  // Permission check: capability 'broadcast.dispatch' or 'root_executive' / 'eksekutif' profile
  const canDispatch =
    can('broadcast.dispatch') ||
    user?.assigned_profiles?.includes('eksekutif') ||
    user?.assigned_profiles?.includes('root_executive');

  const handleCreateSubmit = (data: { title: string; body: string; prio: 'normal' | 'penting' }) => {
    addAnnouncement({
      title: data.title,
      body: data.body,
      prio: data.prio,
      by: user?.full_name || 'Tim Eksekutif',
    });
  };

  const handleEditSubmit = (data: { title: string; body: string; prio: 'normal' | 'penting' }) => {
    if (!editingAnnouncement) return;
    updateAnnouncement(editingAnnouncement.id, {
      title: data.title,
      body: data.body,
      prio: data.prio,
    });
    setEditingAnnouncement(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingAnnouncement) return;
    deleteAnnouncement(deletingAnnouncement.id);
    if (detailAnnouncement?.id === deletingAnnouncement.id) {
      setDetailAnnouncement(null);
    }
    setDeletingAnnouncement(null);
  };

  return (
    <div className="bc-page-container">
      {/* Header */}
      <header className="bc-header">
        <div className="bc-header-info">
          <h1 className="bc-title">Broadcast & Pengumuman</h1>
          <p className="bc-subtitle">
            Pusat siaran informasi resmi, instruksi operasional, dan pengumuman untuk seluruh kru Progresif TV.
          </p>
        </div>

        {canDispatch && (
          <button
            type="button"
            className="bc-btn bc-btn-primary"
            onClick={() => setIsCreateOpen(true)}
            data-act="newAnn"
          >
            <i className="fa-solid fa-plus" />
            <span>Buat Pengumuman</span>
          </button>
        )}
      </header>

      {/* Announcements List */}
      <main>
        {loadError && (
          <div className="alert-banner mb16" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--ptv-curve-sm)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: '#b91c1c' }}>
              <i className="fa-solid fa-circle-exclamation mr8" style={{ marginRight: '8px' }} />
              {loadError}
            </span>
            <button
              type="button"
              className="bc-btn sm"
              onClick={() => {
                setIsLoading(true);
                broadcastService.getAnnouncements(true).then((items) => {
                  if (items.length > 0) broadcastStore.setLiveAnnouncements(items);
                  setLoadError(null);
                }).catch((err) => setLoadError(err.message)).finally(() => setIsLoading(false));
              }}
              style={{ fontSize: '12px', padding: '4px 10px' }}
            >
              Coba Lagi
            </button>
          </div>
        )}

        {isLoading && announcements.length === 0 ? (
          <CardListSkeleton count={3} />
        ) : announcements.length === 0 ? (
          <div className="bc-empty-state">
            <div className="bc-empty-icon">
              <i className="fa-solid fa-bullhorn" />
            </div>
            <h3 className="bc-empty-title">Belum ada pengumuman</h3>
            <p className="bc-empty-desc">
              Semua siaran informasi dan instruksi kru studio akan muncul di sini.
            </p>
            {canDispatch && (
              <button
                type="button"
                className="bc-btn bc-btn-primary"
                onClick={() => setIsCreateOpen(true)}
              >
                <i className="fa-solid fa-plus" />
                <span>Buat Pengumuman Baru</span>
              </button>
            )}
          </div>
        ) : (
          <div className="bc-stack">
            {announcements.map((ann) => {
              const isHighPrio = ann.prio === 'penting';
              return (
                <article
                  key={ann.id}
                  className={`bc-card ${isHighPrio ? 'high-prio' : ''}`}
                  onClick={() => setDetailAnnouncement(ann)}
                  data-ann={ann.id}
                >
                  <div className="bc-card-header">
                    <div className="bc-card-main">
                      <h2 className="bc-card-title">{ann.title}</h2>
                      <p className="bc-card-body">{ann.body}</p>
                    </div>

                    <div
                      className="bc-card-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span
                        className={`bc-chip ${
                          isHighPrio ? 'bc-chip-gold' : 'bc-chip-muted'
                        }`}
                      >
                        <i
                          className={
                            isHighPrio
                              ? 'fa-solid fa-triangle-exclamation'
                              : 'fa-regular fa-bell'
                          }
                        />
                        <span>{isHighPrio ? 'Penting' : 'Normal'}</span>
                      </span>

                      {canDispatch && (
                        <button
                          type="button"
                          className="bc-btn-card-del"
                          title="Hapus Pengumuman"
                          onClick={() => setDeletingAnnouncement(ann)}
                          data-act={`deleteAnn:${ann.id}`}
                        >
                          <i className="fa-regular fa-trash-can" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bc-card-meta">
                    <span className="bc-meta-item">
                      <i className="fa-solid fa-user-pen" />
                      <span>{ann.by}</span>
                    </span>
                    <span className="bc-meta-item">
                      <i className="fa-regular fa-clock" />
                      <span>{ann.date}</span>
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Modals */}
      <AnnouncementModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateSubmit}
      />

      <AnnouncementModal
        isOpen={Boolean(editingAnnouncement)}
        onClose={() => setEditingAnnouncement(null)}
        onSubmit={handleEditSubmit}
        initialData={editingAnnouncement}
      />

      <AnnouncementDetailModal
        isOpen={Boolean(detailAnnouncement)}
        announcement={detailAnnouncement}
        onClose={() => setDetailAnnouncement(null)}
        canManage={Boolean(canDispatch)}
        onEdit={(ann) => {
          setDetailAnnouncement(null);
          setEditingAnnouncement(ann);
        }}
        onDelete={(ann) => {
          setDeletingAnnouncement(ann);
        }}
      />

      <DeleteConfirmModal
        isOpen={Boolean(deletingAnnouncement)}
        announcement={deletingAnnouncement}
        onClose={() => setDeletingAnnouncement(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
