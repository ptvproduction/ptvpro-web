/**
 * PTV PRO — Kalender PDF Generator & Exporter
 * Menghasilkan berkas PDF resmi Kalender Bulanan PTV (Grid + Agenda)
 * dan Fallback Dokumen Kalender Akademik Pesantren / Sekolah.
 * Menggunakan serialisasi biner murni PDF 1.4 (kompatibel 100% tanpa external headless browser).
 */

import { serializePdfObjects, pdfBinaryBytes } from '../../dokumen-saya/utils/pdfSerialization';
import { MONTHS, DOW, getHijriInfo, getWetonInfo, getHijriMonthHeader } from './calendarDateUtils';
import { CalendarEvent, ContentPlannerItem } from '../types';
import { DEFAULT_KALENDER_PDF_CONFIGS } from '../kalenderPdfConfig';

function sanitizePdfText(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/[^\x20-\x7E]/g, ' ') // Batasi ke ASCII cetak standar Helvetica
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function triggerBlobDownload(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Ekspor Kalender Bulanan PTV ke PDF format A4 Lanskap
 */
export function exportKalenderBulanPdf(
  monthIdx: number,
  year: number,
  events: CalendarEvent[] = [],
  planners: ContentPlannerItem[] = []
): void {
  const pageWidth = 842; // A4 Landscape points (72 pt/inch)
  const pageHeight = 595;
  const monthName = MONTHS[monthIdx] || 'Kalender';
  const hijriSubtitle = getHijriMonthHeader(monthIdx, year);

  // 1. Hitung grid hari dalam bulan
  const firstDay = new Date(year, monthIdx, 1);
  const startDayOfWeek = firstDay.getDay(); // 0 = Ahad
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  // Draw ops
  let stream = '';

  // Background putih bersih
  stream += `1 1 1 rg 0 0 ${pageWidth} ${pageHeight} re f\n`;

  // Top Header Banner (Biru PTV #0B2A4A & Aksen Biru Muda)
  stream += `0.043 0.165 0.290 rg 0 ${pageHeight - 68} ${pageWidth} 68 re f\n`;
  stream += `0.000 0.361 0.902 rg 0 ${pageHeight - 72} ${pageWidth} 4 re f\n`;

  // Header Text
  stream += `BT /F1 18 Tf 1 1 1 rg 36 ${pageHeight - 34} Td (${sanitizePdfText(`PROGRESIF TV  --  AGENDA & KALENDER KEGIATAN`)}) Tj ET\n`;
  stream += `BT /F1 12 Tf 0.85 0.92 1 rg 36 ${pageHeight - 52} Td (${sanitizePdfText(`${monthName.toUpperCase()} ${year}  |  ${hijriSubtitle}`)}) Tj ET\n`;

  // Grid Layout
  const gridX = 36;
  const gridY = 80;
  const gridW = 540;
  const gridH = 410;
  const colW = gridW / 7;
  const totalWeeks = Math.ceil((startDayOfWeek + daysInMonth) / 7);
  const rowH = (gridH - 24) / totalWeeks;

  // Header Baris Hari (Ahad - Sabtu)
  stream += `0.95 0.96 0.98 rg ${gridX} ${gridY + gridH - 24} ${gridW} 24 re f\n`;
  stream += `0.85 0.88 0.92 RG 1 w ${gridX} ${gridY + gridH - 24} ${gridW} 24 re s\n`;

  DOW.forEach((d, idx) => {
    const isSun = idx === 0;
    const x = gridX + idx * colW;
    if (isSun) {
      stream += `BT /F1 9 Tf 0.85 0.15 0.15 rg ${x + 8} ${gridY + gridH - 16} Td (${sanitizePdfText(d)}) Tj ET\n`;
    } else {
      stream += `BT /F1 9 Tf 0.25 0.30 0.38 rg ${x + 8} ${gridY + gridH - 16} Td (${sanitizePdfText(d)}) Tj ET\n`;
    }
  });

  // Gambar Sel Tanggal
  let dayCounter = 1;
  for (let w = 0; w < totalWeeks; w++) {
    const y = gridY + gridH - 24 - (w + 1) * rowH;
    for (let d = 0; d < 7; d++) {
      const x = gridX + d * colW;
      const cellIdx = w * 7 + d;

      // Kotak Grid
      stream += `0.90 0.92 0.95 RG 0.5 w ${x} ${y} ${colW} ${rowH} re s\n`;

      if (cellIdx >= startDayOfWeek && dayCounter <= daysInMonth) {
        const thisDate = new Date(year, monthIdx, dayCounter);
        const iso = thisDate.toISOString().slice(0, 10);
        const isSun = d === 0;
        const hijri = getHijriInfo(iso);
        const weton = getWetonInfo(iso);

        // Angka Masehi
        if (isSun) {
          stream += `BT /F1 12 Tf 0.85 0.15 0.15 rg ${x + 6} ${y + rowH - 15} Td (${dayCounter}) Tj ET\n`;
        } else {
          stream += `BT /F1 12 Tf 0.10 0.15 0.22 rg ${x + 6} ${y + rowH - 15} Td (${dayCounter}) Tj ET\n`;
        }

        // Subtitle Hijriah & Pasaran
        const subtext = `${hijri.day} ${hijri.monthName.slice(0, 4)} . ${weton.pasaran}`;
        stream += `BT /F1 7 Tf 0.50 0.55 0.62 rg ${x + 6} ${y + rowH - 24} Td (${sanitizePdfText(subtext)}) Tj ET\n`;

        // Tandai jika ada acara
        const dayEvents = events.filter((ev) => ev.date === iso);
        if (dayEvents.length > 0) {
          stream += `0.00 0.36 0.90 rg ${x + 4} ${y + 4} ${colW - 8} 12 re f\n`;
          const evTitle = dayEvents[0].name.slice(0, 14);
          stream += `BT /F1 7 Tf 1 1 1 rg ${x + 6} ${y + 7} Td (${sanitizePdfText(evTitle)}) Tj ET\n`;
        }

        dayCounter++;
      }
    }
  }

  // Kolom Kanan: Daftar Acara Liputan & Agenda Bulan Ini
  const sidebarX = 592;
  const sidebarY = 80;
  const sidebarW = 214;
  const sidebarH = 410;

  // Sidebar Container Box
  stream += `0.98 0.98 0.99 rg ${sidebarX} ${sidebarY} ${sidebarW} ${sidebarH} re f\n`;
  stream += `0.85 0.88 0.92 RG 1 w ${sidebarX} ${sidebarY} ${sidebarW} ${sidebarH} re s\n`;

  // Sidebar Header
  stream += `0.043 0.165 0.290 rg ${sidebarX} ${sidebarY + sidebarH - 28} ${sidebarW} 28 re f\n`;
  stream += `BT /F1 10 Tf 1 1 1 rg ${sidebarX + 12} ${sidebarY + sidebarH - 18} Td (${sanitizePdfText('AGENDA & LIPUTAN BULAN INI')}) Tj ET\n`;

  // List acara yang relevan dengan bulan ini
  const monthEvents = events
    .filter((ev) => {
      const dt = new Date(ev.date);
      return dt.getFullYear() === year && dt.getMonth() === monthIdx;
    })
    .slice(0, 10);

  let curY = sidebarY + sidebarH - 46;
  if (monthEvents.length === 0) {
    stream += `BT /F1 9 Tf 0.55 0.60 0.68 rg ${sidebarX + 12} ${curY} Td (${sanitizePdfText('Tidak ada agenda khusus di bulan ini.')}) Tj ET\n`;
  } else {
    monthEvents.forEach((ev) => {
      stream += `0.00 0.36 0.90 rg ${sidebarX + 12} ${curY + 2} 4 4 re f\n`;
      const dateStr = ev.date ? ev.date.slice(8, 10) + ' ' + monthName.slice(0, 3) : '';
      const lineText = `${dateStr} - ${ev.name}`;
      stream += `BT /F1 8.5 Tf 0.15 0.20 0.28 rg ${sidebarX + 22} ${curY} Td (${sanitizePdfText(lineText.slice(0, 32))}) Tj ET\n`;
      curY -= 20;
    });
  }

  // Momentum Penting dari Planner
  const activePlanners = planners.slice(0, 6);
  if (activePlanners.length > 0 && curY > sidebarY + 80) {
    curY -= 10;
    stream += `0.90 0.93 0.98 rg ${sidebarX} ${curY - 16} ${sidebarW} 20 re f\n`;
    stream += `BT /F1 9 Tf 0.05 0.25 0.65 rg ${sidebarX + 12} ${curY - 10} Td (${sanitizePdfText('MOMENTUM & TEMA SIARAN')}) Tj ET\n`;
    curY -= 32;

    activePlanners.forEach((p) => {
      if (curY > sidebarY + 20) {
        stream += `BT /F1 8 Tf 0.35 0.40 0.48 rg ${sidebarX + 14} ${curY} Td (${sanitizePdfText(p.judul_momentum.slice(0, 34))}) Tj ET\n`;
        curY -= 16;
      }
    });
  }

  // Footer Resmi
  stream += `BT /F1 8 Tf 0.55 0.60 0.68 rg 36 40 Td (${sanitizePdfText(`Dokumen resmi dicetak dari PTVPRO Hub  --  Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')} WIB`)}) Tj ET\n`;

  // Assemble PDF Objects
  const objects = [
    '', // 0
    '<< /Type /Catalog /Pages 2 0 R >>', // 1
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', // 2
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`, // 3
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, // 4
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', // 5
  ];

  const serialized = serializePdfObjects(objects);
  const bytes = pdfBinaryBytes(serialized);
  triggerBlobDownload(bytes, `Kalender-PTV-${monthName}-${year}.pdf`);
}

/**
 * Fallback Generator untuk Kalender Akademik Resmi (Pesantren / Sekolah)
 * Memastikan tombol "Unduh PDF" tidak pernah menghasilkan 404 ketika berkas statis belum diunggah ke hosting.
 */
export function exportKalenderAkademikFallbackPdf(layer: 'pesantren' | 'sekolah'): void {
  const cfg = DEFAULT_KALENDER_PDF_CONFIGS[layer];
  const pageWidth = 595; // A4 Portrait (72 pt/inch)
  const pageHeight = 842;

  let stream = '';

  // Background
  stream += `1 1 1 rg 0 0 ${pageWidth} ${pageHeight} re f\n`;

  // Top Kop Surat Resmi
  const isPesantren = layer === 'pesantren';
  const headerColor = isPesantren ? '0.020 0.588 0.412' : '0.145 0.388 0.922'; // Emerald or Blue
  stream += `${headerColor} rg 0 ${pageHeight - 90} ${pageWidth} 90 re f\n`;

  stream += `BT /F1 16 Tf 1 1 1 rg 40 ${pageHeight - 40} Td (${sanitizePdfText(cfg.title.toUpperCase())}) Tj ET\n`;
  stream += `BT /F1 11 Tf 0.9 0.95 1 rg 40 ${pageHeight - 58} Td (${sanitizePdfText(`Tahun Ajaran ${cfg.academicYear}  |  Arsip Dokumen Resmi Lembaga`)}) Tj ET\n`;
  stream += `BT /F1 8.5 Tf 0.85 0.92 1 rg 40 ${pageHeight - 74} Td (${sanitizePdfText(cfg.subtitle)}) Tj ET\n`;

  // Content Box
  let y = pageHeight - 130;

  stream += `BT /F1 12 Tf 0.1 0.15 0.25 rg 40 ${y} Td (${sanitizePdfText('AGENDA KEGIATAN & TANGGAL PENTING')}) Tj ET\n`;
  y -= 8;
  stream += `0.80 0.85 0.90 RG 1 w 40 ${y} ${pageWidth - 80} 0.5 re s\n`;
  y -= 24;

  const agendas = isPesantren
    ? [
        { tgl: '15 Juli 2025', nama: 'Kedatangan Santri Baru & Orientasi Pondok' },
        { tgl: '17 Juli 2025', nama: 'Awal Masuk KBM Kepesantrenan & Madrasah Diniyah' },
        { tgl: '12 - 19 Sept 2025', nama: 'Penilaian Tengah Semester (PTS) Ganjil' },
        { tgl: '12 Rabiul Awal 1447', nama: 'Peringatan Maulid Nabi Muhammad SAW & Sholawat Bersama' },
        { tgl: '22 Oktober 2025', nama: 'Hari Santri Nasional (Upacara & Apel Akbar PTV)' },
        { tgl: '05 - 16 Des 2025', nama: 'Penilaian Akhir Semester (PAS) Ganjil' },
        { tgl: '20 Des - 03 Jan 2026', nama: 'Liburan Santri Semester Ganjil' },
        { tgl: '04 Januari 2026', nama: 'Kedatangan Santri Semester Genap' },
        { tgl: '27 Rajab 1447', nama: 'Peringatan Isra Miraj Nabi Muhammad SAW' },
        { tgl: '01 - 30 Ramadhan 1447', nama: 'Kajian Kilatan Kitab Kuning Ramadhan' },
        { tgl: '01 - 10 Syawal 1447', nama: 'Libur Hari Raya Idul Fitri 1447 H' },
        { tgl: '05 - 18 Mei 2026', nama: 'Penilaian Akhir Tahun (PAT) & Imtihan Akhir' },
        { tgl: '14 Juni 2026', nama: 'Haflah Akhirussanah & Wisuda Santri PTV Progresif' },
      ]
    : [
        { tgl: '14 Juli 2025', nama: 'Hari Pertama Masuk Sekolah & MPLS' },
        { tgl: '17 Agustus 2025', nama: 'Upacara HUT Kemerdekaan Republik Indonesia' },
        { tgl: '22 - 27 Sept 2025', nama: 'Asesmen Sumatif Tengah Semester Ganjil' },
        { tgl: '25 Nov 2025', nama: 'Peringatan Hari Guru Nasional' },
        { tgl: '01 - 12 Des 2025', nama: 'Asesmen Sumatif Akhir Semester (ASAS) Ganjil' },
        { tgl: '19 Desember 2025', nama: 'Pembagian Buku Rapor Hasil Belajar Semester Ganjil' },
        { tgl: '22 Des - 03 Jan 2026', nama: 'Libur Semester Ganjil' },
        { tgl: '05 Januari 2026', nama: 'Hari Pertama Masuk Sekolah Semester Genap' },
        { tgl: '02 - 07 Maret 2026', nama: 'Asesmen Tengah Semester Genap' },
        { tgl: '13 - 18 April 2026', nama: 'Ujian Sekolah Berstandar Nasional (Kelas Akhir)' },
        { tgl: '01 - 12 Juni 2026', nama: 'Asesmen Akhir Tahun (AAT) Semester Genap' },
        { tgl: '19 Juni 2026', nama: 'Pembagian Buku Rapor Kenaikan Kelas' },
        { tgl: '22 Juni - 11 Juli 2026', nama: 'Libur Akhir Tahun Ajaran 2025/2026' },
      ];

  agendas.forEach((item, idx) => {
    // Row background zebra
    if (idx % 2 === 0) {
      stream += `0.97 0.98 0.99 rg 40 ${y - 4} ${pageWidth - 80} 22 re f\n`;
    }
    stream += `0.90 0.92 0.95 RG 0.5 w 40 ${y - 4} ${pageWidth - 80} 22 re s\n`;

    stream += `BT /F1 9 Tf 0.1 0.4 0.8 rg 50 ${y + 3} Td (${sanitizePdfText(item.tgl)}) Tj ET\n`;
    stream += `BT /F1 9 Tf 0.15 0.20 0.28 rg 180 ${y + 3} Td (${sanitizePdfText(item.nama)}) Tj ET\n`;

    y -= 26;
  });

  // Keabsahan / Stempel Resmi di pojok kanan bawah
  y -= 30;
  stream += `BT /F1 9 Tf 0.2 0.25 0.35 rg ${pageWidth - 220} ${y} Td (${sanitizePdfText('Ditetapkan di Sidoarjo,')}) Tj ET\n`;
  y -= 14;
  stream += `BT /F1 9 Tf 0.2 0.25 0.35 rg ${pageWidth - 220} ${y} Td (${sanitizePdfText('Pengelola Kalender Akademik')}) Tj ET\n`;
  y -= 45;
  stream += `BT /F1 9.5 Tf 0.05 0.15 0.30 rg ${pageWidth - 220} ${y} Td (${sanitizePdfText('Yayasan Bumi Shalawat')}) Tj ET\n`;

  // Footer Notice
  stream += `BT /F1 8 Tf 0.55 0.60 0.68 rg 40 36 Td (${sanitizePdfText(`Dokumen kalender digital resmi PTVPRO Hub  --  Diunduh: ${new Date().toLocaleDateString('id-ID')} WIB`)}) Tj ET\n`;

  const objects = [
    '',
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  const serialized = serializePdfObjects(objects);
  const bytes = pdfBinaryBytes(serialized);
  triggerBlobDownload(bytes, cfg.downloadName);
}
