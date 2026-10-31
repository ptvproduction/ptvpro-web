/**
 * PTVPRO — Inventory Photo Normalization Utilities
 * File: src/products/hub/inventaris/utils/inventoryPhotoUtils.ts
 *
 * Mengidentifikasi dan menyelesaikan URL foto inventaris secara aman.
 * Menangani URL legacy WordPress lokal (misal: ptv-rebuild.local, *.local)
 * yang tidak dapat diakses dari browser klien agar tidak memicu
 * net::ERR_NAME_NOT_RESOLVED di console development.
 *
 * PENTING: Fungsi ini beroperasi murni pada presentation layer dan
 * TIDAK MENGUBAH / MENGHAPUS nilai historis di database PostgreSQL.
 */

/**
 * Memvalidasi apakah URL foto aset inventaris dapat diakses secara publik.
 * Mengembalikan string URL yang sah, atau null jika foto berupa legacy unreachable host.
 */
export function resolveInventoryPhotoUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Blob dan Data URLs (preview upload klien)
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Relative asset paths (misal: /assets/...)
  if (trimmed.startsWith('/') || trimmed.startsWith('./')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    // Deteksi host legacy WordPress lokal atau unreachable dev host
    if (
      host === 'ptv-rebuild.local' ||
      host.endsWith('.local') ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0'
    ) {
      return null;
    }

    return trimmed;
  } catch {
    return null;
  }
}
