/**
 * PTV PRO — Modul Acara
 * Helper tanggal Masehi, Hijriah, dan Weton Jawa
 * Porting 1:1 dari logika kalender legacy PTV (page-dasbor.php L11076–L11115)
 */

export const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const DOW_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const PASARAN_NAMES = ['Wage', 'Kliwon', 'Legi', 'Pahing', 'Pon'];

export const HIJRI_MONTHS = [
  'Muharram', 'Shafar', 'Rabiul Awal', 'Rabiul Akhir',
  'Jumadil Awal', 'Jumadil Akhir', 'Rajab', "Sya'ban",
  'Ramadhan', 'Syawal', "Dzulqo'dah", 'Dzulhijjah'
];

export function padZero(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseIsoDate(s: string): Date {
  if (!s) return new Date();
  const datePart = s.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d);
  }
  return new Date(s);
}

export function formatIsoDate(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

export function formatHumanDateIndo(isoStr: string, withDay = false): string {
  if (!isoStr) return '—';
  const d = parseIsoDate(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (withDay) {
    return `${DOW_FULL[d.getDay()]}, ${dateStr}`;
  }
  return dateStr;
}

export interface WetonInfo {
  day: string;
  pasaran: string;
  full: string;
}

export interface HijriInfo {
  day: number;
  month: number;
  monthName: string;
  year: number;
  full: string;
  short: string;
}

/**
 * Porting algoritma Weton Jawa dari legacy (page-dasbor.php L11076)
 */
export function getWetonInfo(isoStr: string): WetonInfo {
  if (!isoStr) return { day: '', pasaran: '', full: '' };
  const d = parseIsoDate(isoStr);
  if (isNaN(d.getTime())) return { day: '', pasaran: '', full: '' };

  const dayName = DOW_FULL[d.getDay()];
  const epochDays = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const pasaranIndex = ((epochDays % 5) + 5) % 5;
  const pasaranName = PASARAN_NAMES[pasaranIndex];

  return {
    day: dayName,
    pasaran: pasaranName,
    full: `${dayName} ${pasaranName}`
  };
}

/**
 * Porting algoritma Hijriah dari legacy (page-dasbor.php L11090)
 */
export function getHijriInfo(isoStr: string): HijriInfo {
  if (!isoStr) return { day: 1, month: 1, monthName: 'Muharram', year: 1448, full: '', short: '' };
  const d = parseIsoDate(isoStr);
  if (isNaN(d.getTime())) return { day: 1, month: 1, monthName: 'Muharram', year: 1448, full: '', short: '' };

  if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    try {
      const formatter = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
      });
      const parts = formatter.formatToParts(d);
      let hDay = 1;
      let hMonth = 1;
      let hYear = 1448;

      for (const p of parts) {
        if (p.type === 'day') hDay = parseInt(p.value, 10) || 1;
        if (p.type === 'month') hMonth = parseInt(p.value, 10) || 1;
        if (p.type === 'year') {
          const yNum = parseInt(p.value.replace(/\D/g, ''), 10);
          if (yNum) hYear = yNum;
        }
      }

      const mIdx = Math.max(0, Math.min(11, hMonth - 1));
      const mName = HIJRI_MONTHS[mIdx];
      return {
        day: hDay,
        month: hMonth,
        monthName: mName,
        year: hYear,
        full: `${hDay} ${mName} ${hYear} H`,
        short: `${hDay} ${mName}`
      };
    } catch {
      // Fallback below
    }
  }

  // Fallback astronomis sederhana MABIMS
  const epoch = d.getTime() / 86400000 - 1948439.5;
  const hYear = Math.floor(epoch / 354.367) + 1;
  const rem = epoch - (hYear - 1) * 354.367;
  const hMonth = Math.min(12, Math.max(1, Math.floor(rem / 29.53) + 1));
  const hDay = Math.min(30, Math.max(1, Math.floor(rem - (hMonth - 1) * 29.53) + 1));
  const mName = HIJRI_MONTHS[hMonth - 1] || 'Muharram';

  return {
    day: hDay,
    month: hMonth,
    monthName: mName,
    year: hYear,
    full: `${hDay} ${mName} ${hYear} H`,
    short: `${hDay} ${mName}`
  };
}
