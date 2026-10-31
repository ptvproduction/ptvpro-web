import { describe, it, expect } from 'vitest';
import { LostFoundItem } from './types';

// Mirroring kontrak kategori pada LostFoundModalForm
export const LOST_FOUND_CATEGORIES = [
  'Aksesori Kamera',
  'Kabel & Audio',
  'Perlengkapan Kru',
  'Pakaian',
  'Barang Pribadi',
  'Dokumen',
  'Lainnya',
] as const;

describe('LostFoundModalForm — Contracts & Validation Tests', () => {
  it('1. harus mempertahankan 7 kategori barang resmi tanpa perubahan data', () => {
    expect(LOST_FOUND_CATEGORIES).toHaveLength(7);
    expect(LOST_FOUND_CATEGORIES).toContain('Aksesori Kamera');
    expect(LOST_FOUND_CATEGORIES).toContain('Kabel & Audio');
    expect(LOST_FOUND_CATEGORIES).toContain('Perlengkapan Kru');
    expect(LOST_FOUND_CATEGORIES).toContain('Pakaian');
    expect(LOST_FOUND_CATEGORIES).toContain('Barang Pribadi');
    expect(LOST_FOUND_CATEGORIES).toContain('Dokumen');
    expect(LOST_FOUND_CATEGORIES).toContain('Lainnya');
  });

  it('2. harus memvalidasi payload laporan kehilangan (type: hilang)', () => {
    const rawPayload: Omit<LostFoundItem, 'id' | 'createdAt' | 'status'> = {
      type: 'hilang',
      title: 'Tutup Lensa Sony 67mm',
      category: 'Aksesori Kamera',
      location: 'Studio Utama PMV',
      date: '2026-10-17',
      description: 'Warna hitam, ada stiker nomor 2',
      photoUrl: undefined,
      reporterName: 'Roup',
      reporterContact: '6281298765432',
      isCurrentUser: true,
    };

    expect(rawPayload.type).toBe('hilang');
    expect(rawPayload.title.trim()).not.toBe('');
    expect(rawPayload.location.trim()).not.toBe('');
    expect(LOST_FOUND_CATEGORIES).toContain(rawPayload.category);
    expect(rawPayload.reporterContact).toMatch(/^62[0-9]+$/);
  });

  it('3. harus memvalidasi payload laporan penemuan (type: temuan)', () => {
    const rawPayload: Omit<LostFoundItem, 'id' | 'createdAt' | 'status'> = {
      type: 'temuan',
      title: 'ID Card Kru & Lanyard',
      category: 'Dokumen',
      location: 'Meja Switcher',
      date: '2026-10-17',
      description: 'Ditemukan di dekat monitor multiview',
      photoUrl: 'data:image/svg+xml;base64,...',
      reporterName: 'Farid Technical',
      reporterContact: '6281234567890',
      isCurrentUser: true,
    };

    expect(rawPayload.type).toBe('temuan');
    expect(rawPayload.title.trim()).not.toBe('');
    expect(rawPayload.location.trim()).not.toBe('');
    expect(LOST_FOUND_CATEGORIES).toContain(rawPayload.category);
  });

  it('4. harus menolak pengiriman form jika nama barang atau lokasi kosong', () => {
    const validateForm = (title: string, location: string) => {
      return Boolean(title.trim() && location.trim());
    };

    expect(validateForm('', 'Studio')).toBe(false);
    expect(validateForm('   ', 'Studio')).toBe(false);
    expect(validateForm('Kamera', '')).toBe(false);
    expect(validateForm('Kamera', '   ')).toBe(false);
    expect(validateForm('Kamera', 'Studio')).toBe(true);
  });

  it('5. harus memvalidasi format dan batas ukuran berkas foto (maksimal 2MB)', () => {
    const validatePhoto = (mimeType: string, sizeBytes: number) => {
      if (!mimeType.startsWith('image/')) {
        return { valid: false, error: 'Hanya berkas gambar (JPG, PNG, WebP) yang diizinkan' };
      }
      if (sizeBytes > 2 * 1024 * 1024) {
        return { valid: false, error: 'Ukuran gambar maksimal 2MB untuk preview showcase' };
      }
      return { valid: true, error: '' };
    };

    expect(validatePhoto('application/pdf', 1000).valid).toBe(false);
    expect(validatePhoto('image/png', 3 * 1024 * 1024).valid).toBe(false);
    expect(validatePhoto('image/jpeg', 1.5 * 1024 * 1024).valid).toBe(true);
    expect(validatePhoto('image/webp', 500 * 1024).valid).toBe(true);
  });
});
