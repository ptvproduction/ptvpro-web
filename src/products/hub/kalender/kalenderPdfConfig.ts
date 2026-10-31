export interface KalenderPdfItemConfig {
  id: 'pesantren' | 'sekolah';
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  relPath: string;
  downloadName: string;
  totalPages: number;
  academicYear: string;
  updatedAt?: string;
}

export const DEFAULT_KALENDER_PDF_CONFIGS: Record<'pesantren' | 'sekolah', KalenderPdfItemConfig> = {
  pesantren: {
    id: 'pesantren',
    title: 'Kalender Akademik Pesantren 2026',
    subtitle: 'Arsip & Dokumen Resmi Santri dan Pesantren Progresif Bumi Shalawat',
    icon: 'fa-solid fa-mosque',
    iconColor: '#059669',
    iconBg: 'rgba(16, 185, 129, 0.12)',
    relPath: '/wp-content/uploads/KALENDER-2026@KHOLIL.pdf',
    downloadName: 'Kalender-Pesantren-2026.pdf',
    totalPages: 8,
    academicYear: '2025/2026',
  },
  sekolah: {
    id: 'sekolah',
    title: 'Kalender Akademik Sekolah',
    subtitle: 'Arsip & Dokumen Resmi Pendidikan Yayasan Bumi Shalawat',
    icon: 'fa-solid fa-graduation-cap',
    iconColor: '#2563eb',
    iconBg: 'rgba(37, 99, 235, 0.12)',
    relPath: '/wp-content/uploads/01.013-SK-Agenda-Sekolah.pdf',
    downloadName: '01.013-SK-Agenda-Sekolah.pdf',
    totalPages: 4,
    academicYear: '2025/2026',
  },
};

const STORAGE_KEY = 'ptv_kalender_pdf_config';

/**
 * Mengambil konfigurasi kalender PDF aktif (dari localStorage jika ada kustomisasi pengelola, atau default resmi).
 */
export function getKalenderPdfConfigs(): Record<'pesantren' | 'sekolah', KalenderPdfItemConfig> {
  if (typeof window === 'undefined') return DEFAULT_KALENDER_PDF_CONFIGS;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_KALENDER_PDF_CONFIGS;
    const parsed = JSON.parse(raw);
    return {
      pesantren: { ...DEFAULT_KALENDER_PDF_CONFIGS.pesantren, ...(parsed.pesantren || {}) },
      sekolah: { ...DEFAULT_KALENDER_PDF_CONFIGS.sekolah, ...(parsed.sekolah || {}) },
    };
  } catch (err) {
    console.warn('[kalenderPdfConfig] Gagal membaca konfigurasi kustom:', err);
    return DEFAULT_KALENDER_PDF_CONFIGS;
  }
}

/**
 * Menyimpan pembaruan konfigurasi berkas PDF oleh pengelola tanpa harus mengubah kode sumber.
 */
export function updateKalenderPdfConfig(
  id: 'pesantren' | 'sekolah',
  partial: Partial<KalenderPdfItemConfig>
): Record<'pesantren' | 'sekolah', KalenderPdfItemConfig> {
  const current = getKalenderPdfConfigs();
  const updated = {
    ...current,
    [id]: {
      ...current[id],
      ...partial,
      updatedAt: new Date().toISOString(),
    },
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[kalenderPdfConfig] Gagal menyimpan konfigurasi ke storage:', err);
  }

  return updated;
}

/**
 * Mengembalikan konfigurasi ke setelan default awal.
 */
export function resetKalenderPdfConfigs(): Record<'pesantren' | 'sekolah', KalenderPdfItemConfig> {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[kalenderPdfConfig] Gagal mereset storage:', err);
  }
  return DEFAULT_KALENDER_PDF_CONFIGS;
}
