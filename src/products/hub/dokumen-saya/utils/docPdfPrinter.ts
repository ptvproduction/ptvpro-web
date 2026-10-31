/** PDF 1.4 binary serialization and A4 printing for official documents. */

import QRCode from 'qrcode';
import { serializePdfObjects, pdfBinaryBytes } from './pdfSerialization';
import { isSuratIzinDocument } from '../../surat/generator/suratIzinDocument';
import { PtvDocument } from '../mock/docsMockData';
import { buildOfficialDocVerificationUrl, formatIdDate } from '@products/verification/verificationService';
import {
  OFFICIAL_KOP_LOGO_JPEG_BASE64,
  OFFICIAL_KOP_LOGO_WIDTH,
  OFFICIAL_KOP_LOGO_HEIGHT,
  OFFICIAL_KOP_LOGO_PDF_WIDTH,
  OFFICIAL_KOP_LOGO_PDF_HEIGHT,
} from './officialKopLogoData';

// Helvetica uses WinAnsi; text operators stay ASCII and the JPEG remains a binary stream.
const WIN_ANSI = new Map(Array.from('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ').map((char, index) => [char,
  [128,130,131,132,133,134,135,136,137,138,139,140,142,145,146,147,148,149,150,151,152,153,154,155,156,158,159][index]]));

function escapePdfText(str?: string | null): string {
  return Array.from((str || '').normalize('NFC')).map((char) => {
    const point = char.codePointAt(0)!;
    const byte = WIN_ANSI.get(char) ?? point;
    if (byte > 255 || (point >= 128 && point < 160)) {
      throw new Error('Karakter surat tidak didukung font PDF Helvetica: U+' + point.toString(16).toUpperCase());
    }
    if (char === '\\' || char === '(' || char === ')') return '\\' + char;
    if (byte < 32 || byte >= 127) return '\\' + byte.toString(8).padStart(3, '0');
    return char;
  }).join('');
}

/** Returns a binary string: one code unit per output byte, including image streams. */
export function buildOfficialDocPdf14(doc: PtvDocument): string {
  if (isSuratIzinDocument(doc)) throw new Error('Surat Izin harus dirender dari template preview melalui downloadOfficialDocPdf.');
  const safeNo = doc.no || '001/SI-PTV/X/2026';
  const type = doc.type || 'Surat Resmi';
  const subject = doc.subject || 'Surat Resmi Progresif TV';
  const effectiveDate = doc.date || doc.start_date || new Date().toISOString().slice(0, 10);
  const formattedDate = formatIdDate(effectiveDate);
  const dateRangeStr =
    doc.start_date && doc.end_date && doc.start_date !== doc.end_date
      ? `${formatIdDate(doc.start_date)} s.d. ${formatIdDate(doc.end_date)}`
      : formattedDate;
  const signer = doc.penanggung_jawab || 'Pimpinan Eksekutif PTV';
  const verifUrl = buildOfficialDocVerificationUrl(safeNo);

  // 1. Generate High-Precision Vector QR Code Matrix (at bottom right keabsahan box)
  let qrVectorOps = '';
  try {
    const qr = QRCode.create(verifUrl, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const qrBoxX = 475;
    const qrBoxY = 115;
    const qrBoxSize = 65;
    const modSize = qrBoxSize / size;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (qr.modules.get(c, r)) {
          const x = (qrBoxX + c * modSize).toFixed(2);
          const y = (qrBoxY + (size - 1 - r) * modSize).toFixed(2);
          const ms = (modSize + 0.1).toFixed(2);
          qrVectorOps += `${x} ${y} ${ms} ${ms} re `;
        }
      }
    }
    if (qrVectorOps) {
      // Fill QR code in dark green / black
      qrVectorOps = '0 0 0 rg\n' + qrVectorOps + 'f\n';
    }
  } catch (qrErr) {
    console.warn('[buildOfficialDocPdf14] Vector QR generation warning:', qrErr);
  }

  // Brand Green Color in PDF RGB: #0e4f40 -> 14/255=0.055, 79/255=0.310, 64/255=0.251
  const brandGreenRg = '0.055 0.310 0.251 rg';
  const brandGreenRG = '0.055 0.310 0.251 RG';

  const pages: Array<{ recipients: number[]; items: number[] }> = [{ recipients: [], items: [] }];
  let usedRows = 0;
  const nextPage = () => { pages.push({ recipients: [], items: [] }); usedRows = 0; };
  const capacity = () => pages.length === 1 ? 20 : 22;
  for (let index = 0; index < (doc.recipients?.length || 0); index++) {
    if (usedRows === capacity()) nextPage();
    pages[pages.length - 1].recipients.push(index);
    usedRows++;
  }
  if (doc.items?.length && pages[pages.length - 1].recipients.length) {
    if (usedRows + 3 > capacity()) nextPage();
    else usedRows += 2; // A second table needs its own header and spacing.
  }
  for (let index = 0; index < (doc.items?.length || 0); index++) {
    if (usedRows === capacity()) nextPage();
    pages[pages.length - 1].items.push(index);
    usedRows++;
  }

  const streams = pages.map((page, pageIndex) => {
    const streamLines: string[] = [
      'q',
      // --- Kop Surat Lembaga (Paritas Generator Surat Izin & Legacy PHP) ---
      // Left Header: Official BS x PTV Logo (height 48pt, proportional width 84.26pt at margin 50, bottom 752)
      'q',
      `${OFFICIAL_KOP_LOGO_PDF_WIDTH} 0 0 ${OFFICIAL_KOP_LOGO_PDF_HEIGHT} 50 752 cm`,
      '/ImLogo Do',
      'Q',

      // Right Header Block
      brandGreenRg,
      'BT /F2 18 Tf 380 792 Td (PROGRESIF TV) Tj ET',
      '0.118 0.161 0.231 rg', // #1e293b
      'BT /F2 8.5 Tf 380 779 Td (OFFICIAL MEDIA BROADCASTER) Tj ET',
      '0.392 0.455 0.545 rg', // #64748b
      'BT /F1 7.5 Tf 270 766 Td (Jl. Kyai Dasuki No.1, Lebo, Sidoarjo, Jawa Timur 61223) Tj ET',
      'BT /F1 7.5 Tf 270 755 Td (Surel: redaksi@progresiftv.id  |  Portal: https://progresiftv.id) Tj ET',

      // Double horizontal divider line in #0e4f40
      brandGreenRG,
      '2.5 w 50 742 m 545 742 l S',
      '0.8 w 50 738 m 545 738 l S',

      // --- Judul Dokumen & Nomor Resmi (Paritas Generator Surat Izin) ---
      '0.059 0.090 0.165 rg', // #0f172a
      `BT /F2 13 Tf 50 710 Td (${escapePdfText(type.toUpperCase())} PROGRESIF TV) Tj ET`,
      '0.278 0.333 0.412 rg', // #475569
      `BT /F2 9.5 Tf 50 696 Td (Nomor: ${escapePdfText(safeNo)}) Tj ET`,

      // --- Metadata Block Box ---
      '0.89 0.91 0.94 RG 0.8 w', // #e2e8f0
      '50 635 495 48 re S',
      '0.98 0.98 0.99 rg 50 635 495 48 re f',

      // Metadata entries
      '0.278 0.333 0.412 rg',
      'BT /F2 8.5 Tf 60 665 Td (Nama Kegiatan / Perihal) Tj ET',
      '0.059 0.090 0.165 rg',
      `BT /F2 9 Tf 180 665 Td (${escapePdfText(subject)}) Tj ET`,

      '0.278 0.333 0.412 rg',
      'BT /F2 8.5 Tf 60 647 Td (Diizinkan Tanggal / Waktu) Tj ET',
      brandGreenRg,
      `BT /F2 9 Tf 180 647 Td (${escapePdfText(dateRangeStr)}) Tj ET`,

      // --- Paragraf Pengantar ---
      '0.1 0.1 0.1 rg',
      'BT /F1 9 Tf 50 615 Td (Yang bertanda tangan di bawah ini Pimpinan Eksekutif Progresif TV menerangkan dengan sebenarnya bahwa) Tj ET',
      'BT /F1 9 Tf 50 603 Td (personil dan kru yang tercantum di bawah ini diberikan mandat dan izin resmi untuk melaksanakan tugas operasional:) Tj ET',
    ];

    if (pageIndex > 0) streamLines.splice(-3);
    let curY = pageIndex === 0 ? 582 : 614;

    // Recipients / Personil Table with Brand Green Header
    if (page.recipients.length) {
      // Table Header Bar (Brand Green)
      streamLines.push(
        brandGreenRg,
        `50 ${curY} 495 18 re f`,
        '1 1 1 rg', // White header text
        `BT /F2 8.5 Tf 58 ${curY + 5} Td (NO) Tj ET`,
        `BT /F2 8.5 Tf 90 ${curY + 5} Td (NAMA LENGKAP KRU / SANTRI) Tj ET`,
        `BT /F2 8.5 Tf 380 ${curY + 5} Td (PERAN / KETERANGAN) Tj ET`
      );
      curY -= 16;

      page.recipients.forEach((idx) => {
        const name = doc.recipients![idx];
        const isZebra = idx % 2 === 1;
        const rowBg = isZebra ? '0.97 0.98 0.99 rg' : '1 1 1 rg';
        const roleStr = idx === 0 && (doc.pembawa === name || doc.owner === name) ? 'Koordinator / Pembawa' : 'Personil Terlibat';

        streamLines.push(
          rowBg,
          `50 ${curY} 495 16 re f`,
          '0.89 0.91 0.94 RG 0.5 w',
          `50 ${curY} 495 16 re S`,
          '0.2 0.25 0.3 rg',
          `BT /F1 8 Tf 62 ${curY + 4} Td (${idx + 1}) Tj ET`,
          '0.059 0.090 0.165 rg',
          `BT /F2 8.5 Tf 90 ${curY + 4} Td (${escapePdfText(name)}) Tj ET`,
          brandGreenRg,
          `BT /F1 8 Tf 380 ${curY + 4} Td (${roleStr}) Tj ET`
        );
        curY -= 16;
      });

      curY -= 8;
    }

    // Items / Peralatan List (if any)
    if (page.items.length) {
      streamLines.push(
        brandGreenRg,
        `50 ${curY} 495 18 re f`,
        '1 1 1 rg',
        `BT /F2 8.5 Tf 58 ${curY + 5} Td (NO) Tj ET`,
        `BT /F2 8.5 Tf 90 ${curY + 5} Td (DAFTAR PERALATAN / BARANG INVENTARIS) Tj ET`,
        `BT /F2 8.5 Tf 380 ${curY + 5} Td (STATUS IZIN) Tj ET`
      );
      curY -= 16;

      page.items.forEach((idx) => {
        const item = doc.items![idx];
        const isZebra = idx % 2 === 1;
        const rowBg = isZebra ? '0.97 0.98 0.99 rg' : '1 1 1 rg';
        streamLines.push(
          rowBg,
          `50 ${curY} 495 16 re f`,
          '0.89 0.91 0.94 RG 0.5 w',
          `50 ${curY} 495 16 re S`,
          '0.2 0.25 0.3 rg',
          `BT /F1 8 Tf 62 ${curY + 4} Td (${idx + 1}) Tj ET`,
          '0.059 0.090 0.165 rg',
          `BT /F2 8.5 Tf 90 ${curY + 4} Td (${escapePdfText(item)}) Tj ET`,
          brandGreenRg,
          `BT /F2 8 Tf 380 ${curY + 4} Td (Disetujui Resmi) Tj ET`
        );
        curY -= 16;
      });
      curY -= 8;
    }

    // Closing Text
    const closingY = Math.max(curY, 240);
    streamLines.push(
      '0.1 0.1 0.1 rg',
      `BT /F1 8.5 Tf 50 ${closingY} Td (Demikian surat ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya dan kepada) Tj ET`,
      `BT /F1 8.5 Tf 50 ${closingY - 12} Td (pihak yang berkepentingan dimohon memberikan bantuan serta kelancaran pelaksanaan tugas yang dimaksud.) Tj ET`
    );

    // --- Keabsahan & Footer Block (Paritas Generator Surat Izin SuratIzinPdfPreview) ---
    const footerY = 195;
    const signerLines = signer.match(/.{1,23}(?:\s|$)|\S{1,23}/g)?.map((line) => line.trim()) || [''];
    const signerSize = Math.min(10.5, 42 / signerLines.length);
    streamLines.push(
      // Divider line atas keabsahan
      brandGreenRG,
      `1.5 w 50 ${footerY} 495 0 re S`,

      // Left keabsahan text
      brandGreenRg,
      `BT /F2 9 Tf 50 ${footerY - 16} Td (DOKUMEN RESMI PROGRESIF TV) Tj ET`,
      '0.278 0.333 0.412 rg', // #475569
      `BT /F1 8 Tf 50 ${footerY - 29} Td (Dokumen ini diterbitkan secara sah melalui Sistem Digital) Tj ET`,
      `BT /F1 8 Tf 50 ${footerY - 40} Td (Progresif TV dan berlaku resmi tanpa tanda tangan basah.) Tj ET`,
      '0.580 0.639 0.722 rg', // #94a3b8
      `BT /F1 7.5 Tf 50 ${footerY - 53} Td (Pindai QR code di samping untuk memverifikasi keabsahan) Tj ET`,
      `BT /F1 7.5 Tf 50 ${footerY - 64} Td (dokumen di portal resmi Progresif TV.) Tj ET`,

      // Right Signature / Signer Info
      '0.278 0.333 0.412 rg',
      `BT /F1 8.5 Tf 330 ${footerY - 16} Td (Sidoarjo, ${escapePdfText(formattedDate)}) Tj ET`,
      `BT /F1 8.5 Tf 330 ${footerY - 28} Td (Dikeluarkan oleh:) Tj ET`,
      '0.059 0.090 0.165 rg',
      ...signerLines.map((line, index) => `BT /F2 ${signerSize} Tf 330 ${footerY - 42 - index * (signerSize + 1.5)} Td (${escapePdfText(line)}) Tj ET`),
      brandGreenRg,
      `BT /F2 8.5 Tf 330 ${footerY - 42 - signerLines.length * (signerSize + 1.5)} Td (PROGRESIF TV) Tj ET`,

      // Inject Vector QR Code
      qrVectorOps,
      'Q'
    );

    if (pages.length > 1) {
      streamLines.push(`BT /F1 8 Tf 50 60 Td (Halaman ${pageIndex + 1} dari ${pages.length}) Tj ET`);
    }
    return streamLines.join('\n');
  });

  const pageId = (index: number) => index === 0 ? 3 : 8 + (index - 1) * 2;
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, index) => `${pageId(index)} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[6] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  const logoBinary = atob(OFFICIAL_KOP_LOGO_JPEG_BASE64);
  objects[7] = `<< /Type /XObject /Subtype /Image /Width ${OFFICIAL_KOP_LOGO_WIDTH} /Height ${OFFICIAL_KOP_LOGO_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBinary.length} >>\nstream\n${logoBinary}\nendstream`;
  streams.forEach((stream, index) => {
    const id = pageId(index);
    objects[id] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents ${id + 1} 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /ImLogo 7 0 R >> >> >>`;
    objects[id + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  return serializePdfObjects(objects);
}

export function buildOfficialDocPdfBytes(doc: PtvDocument): Uint8Array<ArrayBuffer> {
  return pdfBinaryBytes(buildOfficialDocPdf14(doc));
}

export interface OfficialPdfDownload { blob: Blob; fileName: string }

export async function prepareOfficialDocPdf(doc: PtvDocument): Promise<OfficialPdfDownload> {
  if (!doc) {
    throw new Error('Dokumen tidak ditemukan.');
  }

  const isApproved = doc.status === 'Disetujui';
  const hasOfficialNo = isApproved && doc.no && doc.no !== '—' && !doc.no.includes('Menunggu');

  if (!hasOfficialNo) {
    throw new Error(
      `Dokumen "${doc.subject}" belum disahkan atau nomor surat resmi belum diterbitkan.`
    );
  }

  const safeDocNo = doc.no.replace(/[/\\?%*:|"<> ]/g, '_');
  const safeType = (doc.type || 'surat-resmi').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const fileName = `${safeType}_${safeDocNo}.pdf`;

  const pdfBytes = isSuratIzinDocument(doc)
    ? await (await import('../../surat/generator/suratIzinPdfDownload')).buildSuratIzinPdfBytes(doc)
    : buildOfficialDocPdfBytes(doc);
  return { blob: new Blob([pdfBytes], { type: 'application/pdf' }), fileName };
}

export function startOfficialDocPdfDownload(pdf: OfficialPdfDownload): void {
  if (typeof window === 'undefined') throw new Error('Unduhan memerlukan browser.');
  const downloadUrl = window.URL.createObjectURL(pdf.blob);
  try {
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = pdf.fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    try { a.click(); } finally { document.body.removeChild(a); }
  } finally {
    setTimeout(() => {
      window.URL.revokeObjectURL(downloadUrl);
    }, 1500);
  }
}

export async function downloadOfficialDocPdf(doc: PtvDocument): Promise<OfficialPdfDownload> {
  const pdf = await prepareOfficialDocPdf(doc);
  startOfficialDocPdfDownload(pdf);
  return pdf;
}

export function printOfficialPdf(pdf: OfficialPdfDownload): void {
  const url = window.URL.createObjectURL(pdf.blob);
  const viewer = window.open(url, '_blank');
  if (!viewer) {
    window.URL.revokeObjectURL(url);
    throw new Error('Jendela cetak diblokir browser. Izinkan popup untuk mencetak salinan PDF.');
  }
  viewer.addEventListener('load', () => {
    try { viewer.focus(); viewer.print(); } catch { /* PDF viewer remains available for native print/share controls. */ }
  }, { once: true });
  const cleanup = window.setInterval(() => {
    if (viewer.closed) { window.clearInterval(cleanup); window.URL.revokeObjectURL(url); }
  }, 1000);
}

export async function printOfficialDocHtml(doc: PtvDocument): Promise<void> {
  if (!doc) return;
  if (isSuratIzinDocument(doc)) {
    printOfficialPdf(await prepareOfficialDocPdf(doc));
    return;
  }
  const safeDocNo = doc.no || '—';
  const verifUrl = buildOfficialDocVerificationUrl(safeDocNo);
  const effectiveDate = doc.date || doc.start_date || new Date().toISOString().slice(0, 10);
  const formattedDate = formatIdDate(effectiveDate);
  const dateRangeStr =
    doc.start_date && doc.end_date && doc.start_date !== doc.end_date
      ? `${formatIdDate(doc.start_date)} s.d. ${formatIdDate(doc.end_date)}`
      : formattedDate;

  let qrSvgString = '';
  try {
    qrSvgString = await QRCode.toString(verifUrl, { type: 'svg', margin: 1, width: 72 });
  } catch (e) {
    console.warn('Gagal menghasilkan QR SVG:', e);
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const recipientsHtml = (doc.recipients || []).map((name, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding:7px 8px;border:1px solid #cbd5e1;text-align:center;font-size:10px;color:#64748b;">${idx + 1}</td>
      <td style="padding:7px 10px;border:1px solid #cbd5e1;font-weight:700;font-size:10.5px;color:#0f172a;">${name}</td>
      <td style="padding:7px 8px;border:1px solid #cbd5e1;text-align:center;font-size:10px;color:#0e4f40;font-weight:700;">${idx === 0 && (doc.pembawa === name || doc.owner === name) ? 'Koordinator / Pembawa' : 'Personil Terlibat'}</td>
    </tr>
  `).join('');

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${doc.type || 'Dokumen Resmi'} - ${safeDocNo}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    body { margin: 0; padding: 34px 38px; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; color: #0f172a; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3.5px double #0e4f40; padding-bottom: 10px; margin-bottom: 14px; }
    .title-box { text-align: center; margin: 14px 0 12px; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 11px; }
    .meta-table td { padding: 6px 12px; }
    .content-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
    .content-table th { background: #0e4f40; color: #ffffff; padding: 8px; font-weight: 800; border: 1px solid #0e4f40; }
    .footer-box { margin-top: 20px; border-top: 1.5px solid #0e4f40; padding-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <img src="/assets/images/BS-X-PTV.webp" alt="Logo Progresif TV" style="height:48px;width:auto;max-width:180px;object-fit:contain;display:block;" onerror="this.style.display='none';" />
    </div>
    <div style="text-align:right;">
      <div style="font-size:20px;font-weight:900;color:#0e4f40;letter-spacing:0.02em;line-height:1.1;margin:0 0 2px 0;">PROGRESIF TV</div>
      <div style="font-size:10px;font-weight:800;color:#1e293b;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:3px;">OFFICIAL MEDIA BROADCASTER</div>
      <div style="font-size:9px;color:#64748b;font-weight:500;line-height:1.3;">Jl. Kyai Dasuki No.1, Lebo, Sidoarjo, Jawa Timur 61223</div>
      <div style="font-size:9px;color:#64748b;font-weight:500;line-height:1.3;">Surel: redaksi@progresiftv.id | Portal: https://progresiftv.id</div>
    </div>
  </div>

  <div class="title-box">
    <div style="font-size:15px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">${doc.type?.toUpperCase() || 'SURAT RESMI'} PROGRESIF TV</div>
    <div style="font-size:10.5px;font-weight:700;color:#475569;margin-top:3px;">Nomor: ${safeDocNo}</div>
  </div>

  <table class="meta-table">
    <tr>
      <td style="width:28%;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">Nama Kegiatan / Perihal</td>
      <td style="font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;">${doc.subject}</td>
    </tr>
    <tr>
      <td style="font-weight:600;color:#475569;">Diizinkan Tanggal / Waktu</td>
      <td style="font-weight:700;color:#0e4f40;">${dateRangeStr}</td>
    </tr>
  </table>

  <div style="font-size:11px;line-height:1.5;margin-bottom:10px;">
    Yang bertanda tangan di bawah ini Pimpinan Eksekutif Progresif TV menerangkan dengan sebenarnya bahwa personil / santri yang tercantum pada surat ini diberikan mandat dan izin resmi untuk melaksanakan tugas operasional sesuai ketentuan lembaga yang berlaku:
  </div>

  ${doc.recipients && doc.recipients.length > 0 ? `
    <table class="content-table">
      <thead>
        <tr>
          <th style="width:36px;">NO</th>
          <th style="text-align:left;">NAMA LENGKAP KRU / SANTRI</th>
          <th style="width:160px;">PERAN / KETERANGAN</th>
        </tr>
      </thead>
      <tbody>
        ${recipientsHtml}
      </tbody>
    </table>
  ` : ''}

  <div style="font-size:10.5px;line-height:1.5;margin-top:14px;color:#334155;">
    Demikian surat ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya dan kepada pihak yang berkepentingan dimohon memberikan bantuan serta kelancaran pelaksanaan tugas yang dimaksud.
  </div>

  <div class="footer-box">
    <div style="max-width:380px;">
      <div style="font-weight:800;font-size:10.5px;color:#0e4f40;text-transform:uppercase;margin-bottom:3px;">DOKUMEN RESMI PROGRESIF TV</div>
      <div style="color:#475569;font-size:9px;line-height:1.4;">Dokumen ini diterbitkan secara sah melalui Sistem Digital Progresif TV dan berlaku resmi tanpa tanda tangan basah.</div>
      <div style="color:#94a3b8;font-size:8px;margin-top:3px;">Pindai QR code di samping untuk memverifikasi keabsahan dokumen di portal resmi Progresif TV.</div>
    </div>
    <div style="display:flex;align-items:center;gap:14px;text-align:right;">
      <div>
        <div style="font-size:9.5px;color:#64748b;">Sidoarjo, ${formattedDate}</div>
        <div style="font-size:10px;color:#475569;margin-top:2px;">Dikeluarkan oleh:</div>
        <div style="font-size:12px;font-weight:800;color:#0f172a;">${doc.penanggung_jawab || 'Pimpinan Eksekutif PTV'}</div>
        <div style="font-size:9px;font-weight:800;color:#0e4f40;margin-top:2px;">PROGRESIF TV</div>
      </div>
      <div>${qrSvgString}</div>
    </div>
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`);
  printWindow.document.close();
}
