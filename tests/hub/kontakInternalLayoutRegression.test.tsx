import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { KontakInternalPage } from '../../src/products/hub/kontak/KontakInternalPage';
import { internalContactStore } from '../../src/products/hub/kontak/internalContactStore';

describe('PTVPRO — Kontak Internal One Person One Card Layout Regression Tests', () => {
  it('1. tidak boleh lagi ada outer card (kk-group-card) yang membungkus kategori atau angkatan', () => {
    const html = renderToString(<KontakInternalPage />);

    // Memastikan tidak ada outer card container
    expect(html).not.toContain('kk-group-card');
  });

  it('2. harus menggunakan struktur semantik heading biasa di atas stack kartu kontak individual', () => {
    const html = renderToString(<KontakInternalPage />);

    // Section semantik per kategori
    expect(html).toContain('kontak-category-section');
    expect(html).toContain('kontak-category-header');
    expect(html).toContain('kontak-category-title');
    expect(html).toContain('kontak-category-count');
    expect(html).toContain('kontak-cards-stack');

    // Kategori Pembina, Pengarah, Pengurus, Kru
    expect(html).toContain('Pembina');
    expect(html).toContain('Pengarah');
    expect(html).toContain('Pengurus');
    expect(html).toContain('Kru');
  });

  it('3. setiap kontak harus dirender sebagai satu kartu mandiri (kk-list-item)', () => {
    // Suntikkan satu kontak sampel dengan nomor telepon untuk memvalidasi tombol Chat
    const prev = internalContactStore.getAll();
    try {
      internalContactStore.setLiveContacts([
        {
          id: 'test-pembina-01',
          full_name: 'Dr. Pembina Teladan',
          position: 'Pembina Utama',
          unit: 'Dewan Pembina',
          category: 'Pembina',
          phone: '081234567890',
          status: 'Aktif',
        },
      ]);

      const html = renderToString(<KontakInternalPage />);

      // Card mandiri perorangan
      expect(html).toContain('kk-list-item');
      expect(html).toContain('kk-list-item-name');
      expect(html).toContain('Dr. Pembina Teladan');
      expect(html).toContain('kk-list-item-sub');
      expect(html).toContain('Pembina Utama');

      // Menampilkan tombol WhatsApp untuk nomor valid
      expect(html).toContain('fa-whatsapp');
      expect(html).toContain('https://wa.me/6281234567890');
    } finally {
      internalContactStore.setLiveContacts(prev);
    }
  });

  it('4. sub-kategori angkatan kru harus berupa sub-heading tanpa outer card container', () => {
    const html = renderToString(<KontakInternalPage />);

    expect(html).toContain('kontak-angkatan-group');
    expect(html).toContain('kontak-angkatan-header');
    expect(html).toContain('kontak-angkatan-count');
  });
});
