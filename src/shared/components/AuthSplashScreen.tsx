import React from 'react';

export interface AuthSplashScreenProps {
  /**
   * Status pesan opsional. Default: "Memeriksa sesi Anda..."
   */
  message?: string;
  /**
   * Subtitle opsional. Default: "Ruang kerja digital Progresif TV"
   * Set null jika ingin disembunyikan.
   */
  subtitle?: string | null;
  /**
   * Flag transisi keluar (fade-out 250ms).
   */
  isExiting?: boolean;
  /**
   * Callback ketika transisi CSS fade-out selesai.
   */
  onTransitionEnd?: () => void;
}

/**
 * AuthSplashScreen
 * Apple-inspired, clean, restrained full-screen authentication splash.
 * Digunakan saat inisialisasi sesi autentikasi (Supabase session restoration / auth guard check).
 * Selalu dimulai dalam mode terang netral (#F8FAFD) dengan transisi fade-out halus ke tema final.
 */
export const AuthSplashScreen: React.FC<AuthSplashScreenProps> = ({
  message = 'Memeriksa sesi Anda...',
  subtitle = 'Ruang kerja digital Progresif TV',
  isExiting = false,
  onTransitionEnd,
}) => {
  return (
    <div
      className={`ptv-splash-screen ${isExiting ? 'ptv-splash-fading' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={message}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && onTransitionEnd) {
          onTransitionEnd();
        }
      }}
    >
      <div className="ptv-splash-content">
        <div
          className="ptv-splash-logo"
          role="img"
          aria-label="PTVPRO"
        />
        {subtitle && (
          <p className="ptv-splash-subtitle">
            {subtitle}
          </p>
        )}
        <div
          className="ptv-splash-progress-track"
          role="progressbar"
          aria-label={message}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="ptv-splash-progress-bar" />
        </div>
        <p className="ptv-splash-status">
          {message}
        </p>
      </div>
    </div>
  );
};
