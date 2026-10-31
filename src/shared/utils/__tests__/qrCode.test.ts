import { describe, it, expect } from 'vitest';
import jsQR from 'jsqr';
import { getQrMatrix, generateQrCodeSvgString } from '../qrCode';

describe('Global QR Code Standardization', () => {
  it('generates a valid QR matrix that decodes identically to crew verification payload', () => {
    const payload = 'https://ptvpro.com/verifikasi-identitas/PTV-STG-KRU';
    const qr = getQrMatrix(payload, 'M');
    expect(qr).not.toBeNull();

    if (!qr) return;

    const moduleSize = qr.modules.size;
    const margin = 4;
    const totalSize = moduleSize + margin * 2;

    // Build RGBA bitmap
    const rgba = new Uint8ClampedArray(totalSize * totalSize * 4);
    rgba.fill(255); // White background

    for (let r = 0; r < moduleSize; r++) {
      for (let c = 0; c < moduleSize; c++) {
        if (qr.modules.get(r, c)) {
          const idx = ((r + margin) * totalSize + (c + margin)) * 4;
          rgba[idx] = 0;     // R
          rgba[idx + 1] = 0; // G
          rgba[idx + 2] = 0; // B
          rgba[idx + 3] = 255;
        }
      }
    }

    const decoded = jsQR(rgba, totalSize, totalSize);
    expect(decoded).not.toBeNull();
    expect(decoded?.data).toBe(payload);
  });

  it('generates a valid QR matrix for document verification payload', () => {
    const payload = 'https://ptvpro.com/verifikasi-surat/001%2FPTV%2FST%2FX%2F2026';
    const qr = getQrMatrix(payload, 'M');
    expect(qr).not.toBeNull();

    if (!qr) return;

    const moduleSize = qr.modules.size;
    const margin = 4;
    const totalSize = moduleSize + margin * 2;

    const rgba = new Uint8ClampedArray(totalSize * totalSize * 4);
    rgba.fill(255);

    for (let r = 0; r < moduleSize; r++) {
      for (let c = 0; c < moduleSize; c++) {
        if (qr.modules.get(r, c)) {
          const idx = ((r + margin) * totalSize + (c + margin)) * 4;
          rgba[idx] = 0;
          rgba[idx + 1] = 0;
          rgba[idx + 2] = 0;
          rgba[idx + 3] = 255;
        }
      }
    }

    const decoded = jsQR(rgba, totalSize, totalSize);
    expect(decoded).not.toBeNull();
    expect(decoded?.data).toBe(payload);
  });

  it('generates valid SVG string containing standard SVG tags', async () => {
    const payload = 'https://ptvpro.com/verifikasi-identitas/PTV-STG-ADM';
    const svg = await generateQrCodeSvgString(payload, { margin: 2 });
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('viewBox=');
  });

  it('handles empty or blank payload gracefully', () => {
    const qrEmpty = getQrMatrix('');
    expect(qrEmpty).toBeNull();

    const qrBlank = getQrMatrix('   ');
    expect(qrBlank).toBeNull();
  });
});
