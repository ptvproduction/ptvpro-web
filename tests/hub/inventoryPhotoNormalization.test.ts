import { describe, it, expect } from 'vitest';
import { resolveInventoryPhotoUrl } from '../../src/products/hub/inventaris/utils/inventoryPhotoUtils';

describe('PTVPRO — Inventory Photo URL Normalization (Task B Regression)', () => {
  it('1. Mengembalikan null untuk URL legacy WordPress lokal ptv-rebuild.local', () => {
    const brokenUrl = 'http://ptv-rebuild.local/wp-content/uploads/foto-alat-1789574522922.jpg';
    expect(resolveInventoryPhotoUrl(brokenUrl)).toBeNull();

    const brokenHttpsUrl = 'https://ptv-rebuild.local/wp-content/uploads/IMG_0374.jpeg';
    expect(resolveInventoryPhotoUrl(brokenHttpsUrl)).toBeNull();
  });

  it('2. Mengembalikan null untuk sembarang domain development lokal (*.local atau localhost)', () => {
    expect(resolveInventoryPhotoUrl('http://staging-app.local/uploads/alat.jpg')).toBeNull();
    expect(resolveInventoryPhotoUrl('http://localhost:8000/wp-content/uploads/img.jpg')).toBeNull();
    expect(resolveInventoryPhotoUrl('http://127.0.0.1:3000/img.png')).toBeNull();
  });

  it('3. Mempertahankan URL valid publik (Supabase Storage, CDN, HTTPS eksternal)', () => {
    const validPublicUrl = 'https://swadgljnyelsjstqqxbm.supabase.co/storage/v1/object/public/inventory/catalog/inv-1791989374503-e535m.png';
    expect(resolveInventoryPhotoUrl(validPublicUrl)).toBe(validPublicUrl);

    const relativeUrl = '/assets/images/ptv-logo-white.webp';
    expect(resolveInventoryPhotoUrl(relativeUrl)).toBe(relativeUrl);
  });

  it('4. Mempertahankan blob: dan data: URLs (kamera upload dan canvas preview)', () => {
    const blobUrl = 'blob:http://localhost:5174/3b9b4a12-8822-4a0b-99c5-654dbff2f08a';
    expect(resolveInventoryPhotoUrl(blobUrl)).toBe(blobUrl);

    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    expect(resolveInventoryPhotoUrl(dataUrl)).toBe(dataUrl);
  });

  it('5. Mengembalikan null untuk falsy, null, undefined, atau string kosong', () => {
    expect(resolveInventoryPhotoUrl(null)).toBeNull();
    expect(resolveInventoryPhotoUrl(undefined)).toBeNull();
    expect(resolveInventoryPhotoUrl('')).toBeNull();
    expect(resolveInventoryPhotoUrl('   ')).toBeNull();
  });
});
