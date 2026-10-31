import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';
import { getSupabaseClient, isSupabaseConfigured } from '@core/supabase';
import { useSessionStore } from '@core/session';
import { notificationService, NotificationItem } from './notificationService';

export const NotificationCenterModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
}> = ({ isOpen, onClose, onUnreadChange }) => {
  const navigate = useNavigate();
  const { user } = useSessionStore();
  const modalRef = useRef<HTMLElement>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedNotif, setSelectedNotif] = useState<NotificationItem | null>(null);
  const [permissionState, setPermissionState] = useState<string>('default');

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'notification-center-modal',
    isGlobal: true,
  });

  // Load push permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionState(Notification.permission);
    }
  }, []);

  // Load user-scoped notifications
  const loadNotifications = useCallback(async () => {
    const loaded = await notificationService.getNotifications(user);
    setNotifications(loaded);
    const unread = loaded.filter((n) => !n.is_read).length;
    onUnreadChange?.(unread);
  }, [user, onUnreadChange]);

  useEffect(() => {
    if (isOpen) {
      setSelectedNotif(null);
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  // Save to isolated user inbox
  const persistNotifications = (updated: NotificationItem[]) => {
    setNotifications(updated);
    notificationService.saveNotifications(user, updated);
    const unread = updated.filter((n) => !n.is_read).length;
    onUnreadChange?.(unread);
  };

  // Actions
  const handleMarkAllRead = async () => {
    const updated = notifications.map((n) => ({ ...n, is_read: true }));
    persistNotifications(updated);

    // Sync to Supabase if configured (strictly scoped to user role/identity, avoiding global table wipe)
    if (isSupabaseConfigured() && user) {
      try {
        const supabase = getSupabaseClient();
        const userRole = (user as any)?.role || (user as any)?.assigned_profiles?.[0];
        let query = supabase.from('ptv_notifications').update({ is_read: true }).eq('is_read', false);
        if (userRole && userRole !== 'all') {
          query = query.eq('target_role', userRole);
        }
        await query;
      } catch {
        // ignore
      }
    }
  };

  const handleDeleteAllUnlocked = () => {
    const unlocked = notifications.filter((n) => !n.is_protected);
    if (unlocked.length === 0) {
      alert('Tidak ada notifikasi yang dapat dihapus (semua dikunci atau daftar kosong).');
      return;
    }
    if (!window.confirm('Hapus semua notifikasi yang tidak dikunci pada inbox Anda?')) return;

    const remaining = notifications.filter((n) => n.is_protected);
    persistNotifications(remaining);

    // Sync deletion to Supabase for current recipient
    if (isSupabaseConfigured() && user) {
      try {
        const supabase = getSupabaseClient();
        const ptvId = (user as any)?.ptv_id;
        let delQuery = supabase.from('ptv_notifications').delete().eq('is_protected', false);
        if (ptvId) {
          delQuery = delQuery.eq('recipient_ptv_id', ptvId);
        }
        delQuery.then();
      } catch {
        // ignore
      }
    }
  };

  const handleToggleLock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, is_protected: !n.is_protected } : n
    );
    persistNotifications(updated);
  };

  const handleDeleteSingle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = notifications.find((n) => n.id === id);
    if (target?.is_protected) {
      alert('Notifikasi ini terkunci dan tidak dapat dihapus.');
      return;
    }
    const updated = notifications.filter((n) => n.id !== id);
    persistNotifications(updated);

    // Sync single delete to Supabase if UUID
    if (isSupabaseConfigured() && !id.startsWith('ntf-')) {
      try {
        const supabase = getSupabaseClient();
        supabase.from('ptv_notifications').delete().eq('id', id).eq('is_protected', false).then();
      } catch {
        // ignore
      }
    }
  };

  const handleOpenDetail = (n: NotificationItem) => {
    // Mark as read
    if (!n.is_read) {
      const updated = notifications.map((item) =>
        item.id === n.id ? { ...item, is_read: true } : item
      );
      persistNotifications(updated);

      // Persist single read status to Supabase if UUID
      if (isSupabaseConfigured() && !n.id.startsWith('ntf-')) {
        try {
          const supabase = getSupabaseClient();
          supabase
            .from('ptv_notifications')
            .update({ is_read: true })
            .eq('id', n.id)
            .then();
        } catch {
          // ignore
        }
      }
    }
    setSelectedNotif(n);
  };

  const handleRequestPush = async () => {
    if ('Notification' in window) {
      const res = await Notification.requestPermission();
      setPermissionState(res);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="scrim on" onClick={onClose} />
      <section
        ref={modalRef}
        className="sheet on"
        role="dialog"
        aria-modal="true"
        style={{ maxHeight: '85vh', maxWidth: '580px', width: '100%' }}
      >
        <div className="sheet-grab" />
        <div className="sheet-hd">
          <h3>{selectedNotif ? 'Detail Notifikasi' : 'Notifikasi'}</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={selectedNotif ? () => setSelectedNotif(null) : onClose}
            aria-label={selectedNotif ? 'Kembali' : 'Tutup'}
          >
            <i className={`fa-solid ${selectedNotif ? 'fa-arrow-left' : 'fa-xmark'}`} />
          </button>
        </div>

        <div className="sheet-body" style={{ overflowY: 'auto', paddingBottom: '20px' }}>
          {/* Detail View */}
          {selectedNotif ? (
            <div style={{ padding: '6px 2px 14px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: 'rgba(37, 99, 235, 0.1)',
                    color: '#2563eb',
                  }}
                >
                  <i className="fa-solid fa-bell" style={{ fontSize: '10px' }} />
                  {selectedNotif.type.toUpperCase()}
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                  {selectedNotif.when || 'Baru saja'}
                </span>
              </div>

              <h4 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
                {selectedNotif.title}
              </h4>

              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--ptv-curve-md)',
                  background: 'var(--bg-2, rgba(0,0,0,0.03))',
                  border: '1px solid var(--line-2)',
                  fontSize: '13.5px',
                  lineHeight: '1.5',
                  color: 'var(--ink-2)',
                  marginBottom: '16px',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedNotif.message}
              </div>

              {selectedNotif.action_url && (
                <button
                  type="button"
                  className="btn primary"
                  style={{ width: '100%', marginBottom: '10px' }}
                  onClick={() => {
                    onClose();
                    navigate(selectedNotif.action_url!);
                  }}
                >
                  <span>Buka Halaman Terkait</span>
                  <i className="fa-solid fa-arrow-right" style={{ marginLeft: '6px' }} />
                </button>
              )}

              <button
                type="button"
                className="btn sm"
                style={{ width: '100%' }}
                onClick={() => setSelectedNotif(null)}
              >
                Kembali ke Daftar Notifikasi
              </button>
            </div>
          ) : (
            /* List View */
            <>
              {/* Push permission banner */}
              {permissionState === 'default' && (
                <div className="notif-push-banner">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <span
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#2563eb',
                        color: '#ffffff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <i className="fa-solid fa-bell" style={{ fontSize: '13px' }} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>
                        Izin Notifikasi Browser
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--ink-2)', lineHeight: 1.25 }}>
                        Aktifkan notifikasi pop-up Chrome &amp; Safari
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={handleRequestPush}
                    style={{
                      flexShrink: 0,
                      padding: '5px 13px',
                      fontSize: '11.5px',
                      fontWeight: 650,
                      borderRadius: 'var(--ptv-curve-pill)',
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Aktifkan
                  </button>
                </div>
              )}

              {/* Notification rows */}
              {notifications.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                  <i
                    className="fa-regular fa-bell-slash"
                    style={{ fontSize: '32px', opacity: 0.35, marginBottom: '10px', display: 'block' }}
                  />
                  <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--ink-2)', fontWeight: 550 }}>
                    Tidak ada notifikasi baru.
                  </p>
                </div>
              ) : (
                <div className="list">
                  {notifications.map((n) => {
                    const isProt = !!n.is_protected;
                    return (
                      <div
                        key={n.id}
                        className={`li ${!n.is_read ? 'is-unread' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          padding: '11px 12px',
                          borderRadius: 'var(--ptv-curve-md)',
                          marginBottom: '6px',
                          gap: '8px',
                          background: !n.is_read
                            ? 'rgba(37, 99, 235, 0.04)'
                            : 'var(--card-bg, rgba(255,255,255,0.03))',
                          border: '1px solid var(--line, rgba(255,255,255,0.07))',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            flex: 1,
                            minWidth: 0,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onClick={() => handleOpenDetail(n)}
                          title="Klik untuk membuka detail"
                        >
                          <span
                            className="li-ic"
                            style={{
                              color: !n.is_read ? 'var(--b-500, #2563eb)' : 'var(--muted)',
                              marginTop: '2px',
                              flexShrink: 0,
                            }}
                          >
                            <i className={n.icon || 'fa-solid fa-bell'} />
                          </span>
                          <span className="li-body" style={{ minWidth: 0, flex: 1 }}>
                            <span
                              className="li-t"
                              style={{
                                fontSize: '13px',
                                fontWeight: !n.is_read ? 700 : 550,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                color: 'var(--ink)',
                                flexWrap: 'wrap',
                              }}
                            >
                              <span className="trunc" style={{ maxWidth: 'calc(100% - 75px)' }}>
                                {n.title}
                              </span>
                              {!n.is_read && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    width: '6.5px',
                                    height: '6.5px',
                                    borderRadius: '50%',
                                    background: 'var(--b-500, #2563eb)',
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                              {isProt && (
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    padding: '2px 7px',
                                    background: 'rgba(197,163,90,0.15)',
                                    color: 'var(--ptv-gold, #c5a35a)',
                                    border: '1px solid rgba(197,163,90,0.3)',
                                    borderRadius: 'var(--ptv-curve-pill)',
                                  }}
                                >
                                  <i className="fa-solid fa-lock" style={{ fontSize: '9px', marginRight: '4px' }} />
                                  Terkunci
                                </span>
                              )}
                            </span>
                            <span
                              className="li-s"
                              style={{
                                fontSize: '12px',
                                color: 'var(--ink-2)',
                                lineHeight: '1.38',
                                marginTop: '2px',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {n.message}
                            </span>
                            <span
                              style={{
                                fontSize: '10.5px',
                                color: 'var(--muted)',
                                marginTop: '4px',
                                display: 'inline-block',
                                fontWeight: 500,
                              }}
                            >
                              {n.when || 'Baru saja'}
                            </span>
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, marginTop: '1px' }}>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={(e) => handleToggleLock(n.id, e)}
                            title={isProt ? 'Buka kunci' : 'Kunci notifikasi'}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: 'var(--ptv-curve-sm)',
                              border: 'none',
                              background: isProt ? 'rgba(197,163,90,0.18)' : 'rgba(255,255,255,0.04)',
                              color: isProt ? 'var(--ptv-gold, #c5a35a)' : 'var(--muted)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                            }}
                          >
                            <i className={`fa-solid ${isProt ? 'fa-lock' : 'fa-lock-open'}`} style={{ opacity: isProt ? 1 : 0.5 }} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={(e) => handleDeleteSingle(n.id, e)}
                            title="Hapus notifikasi ini"
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: 'var(--ptv-curve-sm)',
                              border: 'none',
                              background: 'rgba(255,255,255,0.04)',
                              color: 'var(--muted)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                            }}
                          >
                            <i className="fa-regular fa-trash-can" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions 1:1 legacy */}
        {!selectedNotif && (
          <div
            className="sheet-foot"
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--line-2)',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              className="btn"
              onClick={handleMarkAllRead}
              style={{
                flex: 1,
                fontSize: '12px',
                fontWeight: 600,
                padding: '8px 12px',
                borderRadius: 'var(--ptv-curve-pill)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <i className="fa-regular fa-envelope-open" style={{ fontSize: '12px' }} />
              <span>Tandai dibaca</span>
            </button>
            <button
              type="button"
              className="btn dang"
              onClick={handleDeleteAllUnlocked}
              style={{
                flex: 1.2,
                fontSize: '12px',
                fontWeight: 600,
                padding: '8px 14px',
                borderRadius: 'var(--ptv-curve-pill)',
                background: 'rgba(239,68,68,0.08)',
                color: '#dc2626',
                border: '1px solid rgba(239,68,68,0.22)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
              title="Hapus semua notifikasi yang tidak dikunci"
            >
              <i className="fa-regular fa-trash-can" style={{ fontSize: '12px' }} />
              <span>Hapus Semua</span>
            </button>
          </div>
        )}
      </section>
    </>
  );
};
