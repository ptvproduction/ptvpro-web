import React, { useState, useEffect, useRef } from 'react';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface PushDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PushDiagnosticsModal: React.FC<PushDiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const [notificationPermission, setNotificationPermission] = useState<string>('unknown');
  const [hasNotificationApi, setHasNotificationApi] = useState(false);
  const [hasServiceWorker, setHasServiceWorker] = useState(false);
  const [hasPushManager, setHasPushManager] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalScrollLock({
    isOpen,
    onClose,
    modalRef,
    id: 'push-diagnostics-modal',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasNotif = 'Notification' in window;
      const hasSW = 'serviceWorker' in navigator;
      const hasPush = 'PushManager' in window;

      setHasNotificationApi(hasNotif);
      setHasServiceWorker(hasSW);
      setHasPushManager(hasPush);

      if (hasNotif) {
        setNotificationPermission(Notification.permission);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    if (!hasNotificationApi) return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      setRequestStatus(
        permission === 'granted'
          ? 'Izin notifikasi browser berhasil diaktifkan!'
          : 'Izin notifikasi belum diberikan atau ditolak.'
      );
    } catch {
      setRequestStatus('Gagal meminta izin notifikasi.');
    }
  };

  return (
    <div ref={modalRef} className="set-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="set-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="set-modal-header">
          <div className="set-modal-title-wrap">
            <div className="set-modal-icon">
              <i className="fa-solid fa-stethoscope" />
            </div>
            <div>
              <h3 className="set-modal-title">Diagnostik Push Notifikasi</h3>
              <p className="set-modal-desc">
                Pemeriksaan kapabilitas browser dan gateway notifikasi perangkat kru.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="set-modal-close-btn"
            onClick={onClose}
            aria-label="Tutup"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="set-modal-body">
          {requestStatus && (
            <div
              className={`set-modal-alert ${
                notificationPermission === 'granted' ? 'success' : 'warn'
              }`}
            >
              <i
                className={`fa-solid ${
                  notificationPermission === 'granted'
                    ? 'fa-circle-check'
                    : 'fa-circle-exclamation'
                }`}
              />
              <span>{requestStatus}</span>
            </div>
          )}

          <div className="set-diag-list">
            <div className="set-diag-item">
              <div className="set-diag-info">
                <span className="set-diag-label">Web Notification API</span>
                <span className="set-diag-sub">Ketersediaan antarmuka notifikasi browser</span>
              </div>
              <span className={`set-diag-badge ${hasNotificationApi ? 'ok' : 'err'}`}>
                {hasNotificationApi ? 'Didukung' : 'Tidak Didukung'}
              </span>
            </div>

            <div className="set-diag-item">
              <div className="set-diag-info">
                <span className="set-diag-label">Status Izin Perangkat (Permission)</span>
                <span className="set-diag-sub">Otorisasi izin pop-up browser pengguna</span>
              </div>
              <span
                className={`set-diag-badge ${
                  notificationPermission === 'granted'
                    ? 'ok'
                    : notificationPermission === 'denied'
                    ? 'err'
                    : 'warn'
                }`}
              >
                {notificationPermission === 'granted'
                  ? 'Diizinkan (Granted)'
                  : notificationPermission === 'denied'
                  ? 'Diblokir (Denied)'
                  : 'Belum Ditentukan (Default)'}
              </span>
            </div>

            <div className="set-diag-item">
              <div className="set-diag-info">
                <span className="set-diag-label">Service Worker Support</span>
                <span className="set-diag-sub">Eksekusi background worker untuk notifikasi offline</span>
              </div>
              <span className={`set-diag-badge ${hasServiceWorker ? 'ok' : 'warn'}`}>
                {hasServiceWorker ? 'Tersedia' : 'Tidak Tersedia'}
              </span>
            </div>

            <div className="set-diag-item">
              <div className="set-diag-info">
                <span className="set-diag-label">PushManager Web Standard</span>
                <span className="set-diag-sub">Protokol Web Push W3C standar</span>
              </div>
              <span className={`set-diag-badge ${hasPushManager ? 'ok' : 'warn'}`}>
                {hasPushManager ? 'Tersedia' : 'Tidak Tersedia'}
              </span>
            </div>

            <div className="set-diag-item">
              <div className="set-diag-info">
                <span className="set-diag-label">Gateway Push Server</span>
                <span className="set-diag-sub">Koneksi gateway Progresif TV Push Service</span>
              </div>
              <span className="set-diag-badge info">Client-Side Standby</span>
            </div>
          </div>

          {notificationPermission !== 'granted' && hasNotificationApi && (
            <div className="set-diag-action-box">
              <p className="set-diag-action-text">
                Aktifkan izin notifikasi agar browser dapat menampilkan siaran darurat, pengumuman liputan, dan status persetujuan surat tugas.
              </p>
              <button
                type="button"
                className="set-btn set-btn-primary"
                onClick={handleRequestPermission}
              >
                <i className="fa-regular fa-bell" />
                <span>Minta Izin Notifikasi Browser</span>
              </button>
            </div>
          )}
        </div>

        <div className="set-modal-footer">
          <button type="button" className="set-btn set-btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
