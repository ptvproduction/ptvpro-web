import React from 'react';

interface PortalInitScreenProps {
  status: 'initializing' | 'error';
  /** Menambah catatan bahwa koneksi lambat. Tidak menampilkan persentase. */
  isSlow?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

/**
 * Layar inisialisasi portal publik. Selama tampil, tidak ada hero, layanan, footer,
 * atau teks default yang dirender.
 */
export const PortalInitScreen: React.FC<PortalInitScreenProps> = ({
  status,
  isSlow = false,
  errorMessage,
  onRetry,
}) => {
  if (status === 'error') {
    return (
      <div className="lp-init" role="alert">
        <div className="lp-init-inner">
          <div className="lp-init-logo" role="img" aria-label="PTVPRO" />
          <h1 className="lp-init-error-title">Portal belum dapat dimuat</h1>
          <p className="lp-init-text">
            {errorMessage ? `${errorMessage} ` : ''}Data layanan resmi belum berhasil diambil. Coba lagi
            sebentar lagi.
          </p>
          <button type="button" className="lp-pill dark lp-init-retry" onClick={onRetry}>
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-init" role="status" aria-live="polite" aria-label="Menyiapkan portal">
      <div className="lp-init-inner">
        <div className="lp-init-logo" role="img" aria-label="PTVPRO" />
        <div className="lp-init-track" aria-hidden="true">
          <div className="lp-init-bar" />
        </div>
        <p className="lp-init-text">
          {isSlow ? 'Koneksi terasa lambat. Portal masih disiapkan.' : 'Menyiapkan portal layanan'}
        </p>
      </div>
    </div>
  );
};
