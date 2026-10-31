/**
 * PTVPRO — Unit Barcode Printing and High-Resolution PNG Export Utilities
 * Memastikan hasil cetak dan unduhan PNG 100% identik dengan tampilan,
 * dengan resolusi 3x HD solid, kontras tinggi, dan quiet zone aman untuk scanner fisik.
 */

import { barcode128SVG, getCode128Modules } from './barcode128';

export const PTV_LOGO_PATH = '/assets/images/ptv-logo-white.webp';

/**
 * Normalisasi teks branding label barcode sesuai standar PTV Hub:
 * Setiap label branding barcode yang mengandung nama NIKSAN (termasuk format
 * 'PROGRESIF TV × NIKSAN', 'PTV × NIKSAN', dll.) harus ditampilkan sebagai 'NIKSAN' saja.
 * Label non-NIKSAN tetap mengikuti branding standar ('PROGRESIF TV').
 */
export function normalizeBarcodeBranding(brandText?: string | null, isNiksan?: boolean): string {
  if (isNiksan || (brandText && brandText.toUpperCase().includes('NIKSAN'))) {
    return 'NIKSAN';
  }
  return brandText?.trim() || 'PROGRESIF TV';
}

/**
 * Helper untuk load gambar secara aman ke dalam HTMLImageElement
 */
function loadHtmlImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Menggambar rounded rect path pada Canvas 2D
 */
function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Menggambar gambar ke dalam bounding box secara object-contain
 */
function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number
): boolean {
  if (!img || !img.naturalWidth || !img.naturalHeight) return false;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const scale = Math.min(w / nw, h / nh);
  const dw = nw * scale;
  const dh = nh * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
  return true;
}

/**
 * Render barcode label ke HTMLCanvasElement resolusi tinggi (3x HD / 300 DPI)
 */
export async function renderBarcodeCardToCanvas(
  unitCode: string,
  isNiksan: boolean = false
): Promise<HTMLCanvasElement> {
  const ptvImg = await loadHtmlImage(PTV_LOGO_PATH);
  const { text, barStr, totalModules } = getCode128Modules(unitCode);

  const canvas = document.createElement('canvas');
  const S = 3; // 3x scale factor for crisp 300 DPI scanning

  if (isNiksan) {
    const W = 340;
    const H = 152;
    canvas.width = W * S;
    canvas.height = H * S;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get canvas 2d context');
    ctx.scale(S, S);

    // Background & Card Border
    drawRoundedRectPath(ctx, 1, 1, W - 2, H - 2, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top Header: Branding Area (NIKSAN)
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(1, 46);
    ctx.lineTo(W - 1, 46);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(normalizeBarcodeBranding('NIKSAN', true), 170, 23);

    // Middle: Code 128 Barcode
    const marginSide = 28;
    const availW = W - (marginSide * 2);
    const modW = availW / totalModules;
    const barH = 38;
    const barY = 55;

    ctx.fillStyle = '#0f172a';
    let curX = marginSide;
    for (let i = 0; i < barStr.length; i++) {
      const w = parseInt(barStr[i], 10) * modW;
      if (i % 2 === 0) {
        ctx.fillRect(Math.round(curX), barY, Math.ceil(w), barH);
      }
      curX += w;
    }

    // Human readable code
    ctx.font = 'bold 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(text, 170, 99);

    // Bottom: Footer Bar
    ctx.save();
    drawRoundedRectPath(ctx, 1, 1, W - 2, H - 2, 8);
    ctx.clip();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 122, W, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NIKSAN', 170, 137);
    ctx.restore();

  } else {
    // Non-Niksan standard horizontal layout
    const W = 340;
    const H = 112;
    canvas.width = W * S;
    canvas.height = H * S;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get canvas 2d context');
    ctx.scale(S, S);

    // Card background & border
    drawRoundedRectPath(ctx, 1, 1, W - 2, H - 2, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Left Column: Logo Separator
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(96, 0);
    ctx.lineTo(96, H);
    ctx.stroke();

    // Draw PTV Logo
    const ptvOk = drawContainedImage(ctx, ptvImg, 10, 18, 76, 76);
    if (!ptvOk) {
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PTV', 48, 56);
    }

    // Right Barcode Separator (di atas footer)
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(96, 82);
    ctx.lineTo(W, 82);
    ctx.stroke();

    const marginSide = 18;
    const availW = (W - 96) - (marginSide * 2);
    const modW = availW / totalModules;
    const barH = 36;
    const barY = 13;

    ctx.fillStyle = '#0f172a';
    let curX = 96 + marginSide;
    for (let i = 0; i < barStr.length; i++) {
      const w = parseInt(barStr[i], 10) * modW;
      if (i % 2 === 0) {
        ctx.fillRect(Math.round(curX), barY, Math.ceil(w), barH);
      }
      curX += w;
    }

    // Human readable code
    ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(text, 96 + ((W - 96) / 2), 55);

    // Right Footer Bar
    ctx.save();
    drawRoundedRectPath(ctx, 1, 1, W - 2, H - 2, 8);
    ctx.clip();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(96, 82, W - 96, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PROGRESIF TV', 96 + ((W - 96) / 2), 97);
    ctx.restore();
  }

  return canvas;
}

/**
 * Download HTMLCanvasElement sebagai file PNG
 */
export function downloadCanvasPNG(canvas: HTMLCanvasElement, filename: string): Promise<boolean> {
  return new Promise((resolve) => {
    const cleanFilename = String(filename || 'Barcode.png').replace(/\.svg$/i, '.png');
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (!blob) {
          const dataUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = cleanFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          resolve(true);
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = cleanFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        resolve(true);
      }, 'image/png');
    } else {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = cleanFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      resolve(true);
    }
  });
}

/**
 * Ekspor satu unit barcode ke PNG
 */
export async function exportUnitBarcodePNG(
  unitCode: string,
  isNiksan: boolean = false
): Promise<void> {
  const canvas = await renderBarcodeCardToCanvas(unitCode, isNiksan);
  await downloadCanvasPNG(canvas, `${unitCode}.png`);
}

/**
 * Ekspor semua unit barcode ke PNG secara berurutan
 */
export async function exportAllUnitBarcodesPNG(
  units: { unitCode: string; isNiksan: boolean }[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const total = units.length;
  for (let i = 0; i < total; i++) {
    const u = units[i];
    if (onProgress) onProgress(i + 1, total);
    try {
      const canvas = await renderBarcodeCardToCanvas(u.unitCode, u.isNiksan);
      await downloadCanvasPNG(canvas, `${u.unitCode}.png`);
      if (i < total - 1) {
        await new Promise((r) => setTimeout(r, 260));
      }
    } catch (err) {
      console.warn(`Gagal ekspor barcode unit ${u.unitCode}:`, err);
    }
  }
}

/**
 * Cetak satu label barcode
 */
export function printUnitBarcode(
  itemTitle: string,
  unitCode: string,
  unitName: string,
  isNiksan: boolean = false
): void {
  const barcodeSvg = barcode128SVG(unitCode, { width: isNiksan ? 230 : 220, showText: true });
  const win = window.open('', '_blank', 'width=620,height=520');
  if (!win) {
    alert('Izinkan popup browser untuk mencetak label barcode.');
    return;
  }

  const escapeHtml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Cetak Barcode - ${escapeHtml(unitCode)} - Progresif TV</title>
      <style>
        @page { size: auto; margin: 8mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .label-wrap { width: 330px; margin: 0 auto 16px; page-break-inside: avoid; }
        .label-header { display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 700; color: #333; margin-bottom: 5px; padding: 0 2px; }
        
        .label-card { width: 330px; border: 2px solid #000; border-radius: 8px; overflow: hidden; display: flex; flex-direction: row; align-items: stretch; background: #fff; box-sizing: border-box; }
        .label-logo-col { width: 92px; min-width: 92px; border-right: 2px solid #000; display: flex; align-items: center; justify-content: center; padding: 8px; box-sizing: border-box; background: #fff; }
        .label-logo-col img { width: 100%; max-width: 74px; max-height: 74px; object-fit: contain; display: block; }
        .label-right-col { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; }
        .label-barcode-box { flex: 1; padding: 8px 10px 4px; display: flex; align-items: center; justify-content: center; border-bottom: 2px solid #000; box-sizing: border-box; }
        .label-barcode-box svg { max-width: 100%; height: auto; display: block; margin: 0 auto; color: #000; }
        
        .label-card-collab { width: 330px; border: 2px solid #000; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; background: #fff; box-sizing: border-box; }
        .label-collab-header { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 8px 14px 6px; border-bottom: 2px solid #000; background: #fff; box-sizing: border-box; }
        .label-collab-x { font-size: 13px; font-weight: 800; color: #000; line-height: 1; user-select: none; }
        .label-collab-barcode { padding: 10px 14px 6px; display: flex; align-items: center; justify-content: center; border-bottom: 2px solid #000; box-sizing: border-box; background: #fff; }
        .label-collab-barcode svg { max-width: 100%; height: auto; display: block; margin: 0 auto; color: #000; }
        
        .label-footer-bar { background: #000 !important; color: #fff !important; text-align: center; font-size: 11.5px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase; padding: 6px 10px; line-height: 1.2; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    </head>
    <body>
      <div class="label-wrap">
        <div class="label-header">
          <span>${escapeHtml(itemTitle)} · ${escapeHtml(unitName)}</span>
          <span style="font-family:monospace;font-size:10.5px;">${escapeHtml(unitCode)}</span>
        </div>
        ${isNiksan ? `
          <div class="label-card label-card-collab">
            <div class="label-collab-header">
              <span style="font-weight:900;font-size:13px;letter-spacing:0.06em;">${escapeHtml(normalizeBarcodeBranding('NIKSAN', true))}</span>
            </div>
            <div class="label-collab-barcode">
              ${barcodeSvg}
            </div>
            <div class="label-footer-bar">
              <span>NIKSAN</span>
            </div>
          </div>
        ` : `
          <div class="label-card">
            <div class="label-logo-col">
              <img src="${PTV_LOGO_PATH}" alt="PROGRESIF TV" onerror="this.outerHTML='<span style=\\'font-weight:900;font-size:16px;\\'>PTV</span>';">
            </div>
            <div class="label-right-col">
              <div class="label-barcode-box">
                ${barcodeSvg}
              </div>
              <div class="label-footer-bar">
                <span>PROGRESIF TV</span>
              </div>
            </div>
          </div>
        `}
      </div>
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => {
    try { win.print(); } catch { /* ignore */ }
  }, 350);
}

/**
 * Cetak seluruh label barcode unit dalam 1 batch print layout
 */
export function printAllUnitBarcodes(
  itemTitle: string,
  invCode: string,
  units: { unitCode: string; unitName: string; isNiksan: boolean }[]
): void {
  const total = units.length;
  const escapeHtml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const labelsHTML = units.map((u) => {
    const barcodeSvg = barcode128SVG(u.unitCode, { width: u.isNiksan ? 210 : 200, showText: true });
    return `
      <div class="label-wrap">
        <div class="label-header">
          <span>${escapeHtml(itemTitle)} · ${escapeHtml(u.unitName)}</span>
          <span style="font-family:monospace;font-size:10px;">${escapeHtml(u.unitCode)}</span>
        </div>
        ${u.isNiksan ? `
          <div class="label-card label-card-collab">
            <div class="label-collab-header">
              <span style="font-weight:900;font-size:11px;letter-spacing:0.06em;">${escapeHtml(normalizeBarcodeBranding('NIKSAN', true))}</span>
            </div>
            <div class="label-collab-barcode">
              ${barcodeSvg}
            </div>
            <div class="label-footer-bar">
              <span>NIKSAN</span>
            </div>
          </div>
        ` : `
          <div class="label-card">
            <div class="label-logo-col">
              <img src="${PTV_LOGO_PATH}" alt="PROGRESIF TV" onerror="this.outerHTML='<span style=\\'font-weight:900;font-size:14px;\\'>PTV</span>';">
            </div>
            <div class="label-right-col">
              <div class="label-barcode-box">
                ${barcodeSvg}
              </div>
              <div class="label-footer-bar">
                <span>PROGRESIF TV</span>
              </div>
            </div>
          </div>
        `}
      </div>
    `;
  }).join('');

  const win = window.open('', '_blank', 'width=740,height=600');
  if (!win) {
    alert('Izinkan popup browser untuk mencetak label barcode.');
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Cetak Semua Barcode (${total} Unit) - ${escapeHtml(invCode)} - Progresif TV</title>
      <style>
        @page { size: auto; margin: 8mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .label-grid { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
        .label-wrap { width: 310px; page-break-inside: avoid; box-sizing: border-box; }
        .label-header { display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; font-weight: 700; color: #333; margin-bottom: 4px; padding: 0 2px; }
        
        .label-card { width: 310px; border: 2px solid #000; border-radius: 8px; overflow: hidden; display: flex; flex-direction: row; align-items: stretch; background: #fff; box-sizing: border-box; }
        .label-logo-col { width: 86px; min-width: 86px; border-right: 2px solid #000; display: flex; align-items: center; justify-content: center; padding: 8px; box-sizing: border-box; background: #fff; }
        .label-logo-col img { width: 100%; max-width: 68px; max-height: 68px; object-fit: contain; display: block; }
        .label-right-col { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; }
        .label-barcode-box { flex: 1; padding: 7px 8px 3px; display: flex; align-items: center; justify-content: center; border-bottom: 2px solid #000; box-sizing: border-box; }
        .label-barcode-box svg { max-width: 100%; height: auto; display: block; margin: 0 auto; color: #000; }
        
        .label-card-collab { width: 310px; border: 2px solid #000; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; background: #fff; box-sizing: border-box; }
        .label-collab-header { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 8px 12px 6px; border-bottom: 2px solid #000; background: #fff; box-sizing: border-box; }
        .label-collab-x { font-size: 13px; font-weight: 800; color: #000; line-height: 1; user-select: none; }
        .label-collab-barcode { padding: 8px 10px 4px; display: flex; align-items: center; justify-content: center; border-bottom: 2px solid #000; box-sizing: border-box; background: #fff; }
        .label-collab-barcode svg { max-width: 100%; height: auto; display: block; margin: 0 auto; color: #000; }
        
        .label-footer-bar { background: #000 !important; color: #fff !important; text-align: center; font-size: 11px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase; padding: 5px 8px; line-height: 1.2; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    </head>
    <body>
      <div class="label-grid">
        ${labelsHTML}
      </div>
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => {
    try { win.print(); } catch { /* ignore */ }
  }, 350);
}
