import { HijriInfo, WetonInfo, CalendarDayCell, ContentPlannerItem, CalendarEvent } from '../types';

export const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const DOW = ['AHAD', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

export const DOW_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const HIJRI_MONTHS = [
  'Muharram', 'Shafar', 'Rabiul Awal', 'Rabiul Akhir',
  'Jumadil Awal', 'Jumadil Akhir', 'Rajab', "Sya'ban",
  'Ramadhan', 'Syawal', "Dzulqo'dah", 'Dzulhijjah'
];

export const PASARAN_NAMES = ['Wage', 'Kliwon', 'Legi', 'Pahing', 'Pon'];

export function padZero(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatIsoDate(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

export function parseIsoDate(s: string): Date {
  const parts = s.split('T')[0].split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d);
  }
  return new Date(s);
}

export function formatHumanDateIndo(isoStr: string): string {
  const d = parseIsoDate(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Porting algoritma Weton Jawa dari legacy (page-dasbor.php L11076)
 * Menghitung hari pasaran Jawa: Wage, Kliwon, Legi, Pahing, Pon
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
 * Menggunakan Intl.DateTimeFormat 'id-ID-u-ca-islamic-umalqura'
 * dengan fallback perhitungan astronomis MABIMS/Kuwaiti
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
      let dayVal: number | undefined;
      let monthVal: number | undefined;
      let yearVal: number | undefined;

      for (const p of parts) {
        if (p.type === 'day') dayVal = parseInt(p.value, 10);
        if (p.type === 'month') monthVal = parseInt(p.value, 10);
        if (p.type === 'year') yearVal = parseInt(p.value, 10);
      }

      if (dayVal && monthVal && yearVal) {
        const mName = HIJRI_MONTHS[(monthVal - 1) % 12] || `Bulan ${monthVal}`;
        return {
          day: dayVal,
          month: monthVal,
          monthName: mName,
          year: yearVal,
          full: `${dayVal} ${mName} ${yearVal} H`,
          short: `${dayVal} ${mName.slice(0, 4)}`
        };
      }
    } catch {
      // Fallback ke rumus manual di bawah
    }
  }

  // Pure Algorithmic Fallback (Indonesian MABIMS / Kuwaiti Astronomical Criteria)
  let gY = d.getFullYear();
  let gM = d.getMonth() + 1;
  const gD = d.getDate();
  if (gM < 3) {
    gY -= 1;
    gM += 12;
  }
  const a = Math.floor(gY / 100);
  const b = 2 - a + Math.floor(a / 4);
  const jd = Math.floor(365.25 * (gY + 4716)) + Math.floor(30.6001 * (gM + 1)) + gD + b - 1524;
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const hm = Math.floor((24 * l3) / 709);
  const hd = l3 - Math.floor((709 * hm) / 24);
  const hy = 30 * n + j - 30;

  const mName = HIJRI_MONTHS[(hm - 1) % 12] || `Bulan ${hm}`;
  return {
    day: hd,
    month: hm,
    monthName: mName,
    year: hy,
    full: `${hd} ${mName} ${hy} H`,
    short: `${hd} ${mName.slice(0, 4)}`
  };
}

/**
 * Normalisasi pencocokan nama bulan Hijriah
 */
export function normalizeHijriMonth(name?: string): string {
  if (!name) return '';
  const s = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s.includes('muhar')) return 'Muharram';
  if (s.includes('shaf') || s.includes('safar')) return 'Shafar';
  if (s.includes('rabi') && (s.includes('awal') || s.includes('ula') || s.includes('1') || s.includes('awwal'))) return 'Rabiul Awal';
  if (s.includes('rabi') && (s.includes('akhir') || s.includes('tsani') || s.includes('2') || s.includes('sani'))) return 'Rabiul Akhir';
  if (s.includes('jumad') && (s.includes('awal') || s.includes('ula') || s.includes('1'))) return 'Jumadil Awal';
  if (s.includes('jumad') && (s.includes('akhir') || s.includes('tsani') || s.includes('2') || s.includes('sani'))) return 'Jumadil Akhir';
  if (s.includes('rajab')) return 'Rajab';
  if (s.includes('syab') || s.includes("sha'b") || s.includes('shab')) return "Sya'ban";
  if (s.includes('ramad')) return 'Ramadhan';
  if (s.includes('syaw') || s.includes('shaw')) return 'Syawal';
  if (s.includes('dzulq') || s.includes('zulka') || s.includes('dhuqi')) return "Dzulqo'dah";
  if (s.includes('dzulh') || s.includes('zulhij') || s.includes('dhuhij')) return 'Dzulhijjah';
  return String(name).trim();
}

/**
 * Menghasilkan singkatan ringkas bulan Hijriah untuk kalender sel
 * Misal: "Rab II", "Jum I", "Ram", dsb.
 */
export function getHijriMonthShortName(name?: string): string {
  if (!name) return '';
  const s = String(name).toLowerCase();
  if (s.includes('muhar')) return 'Muh';
  if (s.includes('shaf') || s.includes('safar')) return 'Shaf';
  if (s.includes('rabi') && (s.includes('awal') || s.includes('ula') || s.includes('1') || s.includes('awwal'))) return 'Rab I';
  if (s.includes('rabi') && (s.includes('akhir') || s.includes('tsani') || s.includes('2') || s.includes('sani'))) return 'Rab II';
  if (s.includes('jumad') && (s.includes('awal') || s.includes('ula') || s.includes('1'))) return 'Jum I';
  if (s.includes('jumad') && (s.includes('akhir') || s.includes('tsani') || s.includes('2') || s.includes('sani'))) return 'Jum II';
  if (s.includes('rajab')) return 'Raj';
  if (s.includes('syab') || s.includes("sha'b") || s.includes('shab')) return "Sya";
  if (s.includes('ramad')) return 'Ram';
  if (s.includes('syaw') || s.includes('shaw')) return 'Syaw';
  if (s.includes('dzulq') || s.includes('zulka') || s.includes('dhuqi')) return "Dzulq";
  if (s.includes('dzulh') || s.includes('zulhij') || s.includes('dhuhij')) return 'Dzulh';
  return name.slice(0, 4);
}

/**
 * Mengonversi angka latin biasa ke angka Arab-Indic (Eastern Arabic Numerals)
 * Contoh: 1 -> ١, 19 -> ١٩, 28 -> ٢٨
 */
export function toArabicIndicDigits(num: number | string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/\d/g, (d) => arabicDigits[parseInt(d, 10)]);
}

/**
 * Menghasilkan format Hijriah ringkas untuk sel kalender
 * Misal: "17 Rab II", "8 Jum I"
 */
export function getShortHijriFormatted(hijri: HijriInfo): string {
  if (!hijri || !hijri.day) return '';
  const shortMonth = getHijriMonthShortName(hijri.monthName);
  return `${hijri.day} ${shortMonth}`;
}

/**
 * Mengambil jam mulai ringkas untuk event chips kalender
 * Mendukung multi-sesi dan acara tanpa jam selesai
 */
export function getEventDisplayTime(event: CalendarEvent): string {
  if (event.sessions && event.sessions.length > 0) {
    const firstSession = event.sessions[0];
    const timeStr = (firstSession as any).start_time || (firstSession as any).time || '';
    if (timeStr) {
      const match = String(timeStr).match(/(\d{1,2}:\d{2})/);
      if (match) return match[1].padStart(5, '0');
    }
  }
  if (event.time) {
    const match = String(event.time).match(/(\d{1,2}:\d{2})/);
    if (match) return match[1].padStart(5, '0');
    return event.time.trim();
  }
  return '--:--';
}

/**
 * Menentukan apakah acara berstatus Live / Siaran Langsung
 */
export function isLiveEvent(event: CalendarEvent): boolean {
  const text = `${event.name || ''} ${event.category || ''} ${event.notes || ''}`.toLowerCase();
  return /live|siaran langsung|streaming/i.test(text);
}

/**
 * Menentukan kelas warna aksen chip acara
 */
export function getEventAccentClass(event: CalendarEvent): string {
  if (isLiveEvent(event)) return 'chip-live';
  const text = `${event.name || ''} ${event.category || ''}`.toLowerCase();
  if (/liput|lapangan|outdoor|dokumentasi/.test(text)) return 'chip-liputan';
  if (/siar|program|tayang/.test(text)) return 'chip-siaran';
  if (/rapat|eval|brief|koor|internal/.test(text)) return 'chip-internal';
  return event.category === 'Internal Studio' ? 'chip-internal' : 'chip-liputan';
}

/**
 * Menghasilkan judul rentang bulan Hijriah pada header bulan Masehi
 * Misal: "Syawal – Dzulqo'dah 1447 H"
 */
export function getHijriMonthHeader(year: number, monthIndex: number): string {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstHijri = getHijriInfo(`${year}-${padZero(monthIndex + 1)}-01`);
  const lastHijri = getHijriInfo(`${year}-${padZero(monthIndex + 1)}-${padZero(daysInMonth)}`);

  if (firstHijri.monthName === lastHijri.monthName) {
    return `${firstHijri.monthName} ${firstHijri.year} H`;
  }
  return `${firstHijri.monthName} – ${lastHijri.monthName} ${lastHijri.year} H`;
}

/**
 * Menghasilkan susunan sel-sel kalender bulanan 7 kolom
 * Berawal dari hari Senin (SEN) s/d Minggu (MIN) sesuai kalender standar Indonesia
 */
export function generateMonthGridCells(
  year: number,
  monthIndex: number,
  selectedIso: string,
  events: CalendarEvent[],
  planners: ContentPlannerItem[]
): CalendarDayCell[] {
  const todayIso = formatIsoDate(new Date());
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  // Kalender berawal dari hari Ahad / Minggu (AHAD=0, SENIN=1, ..., SABTU=6)
  const sundayOffset = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();

  const rawCells: { dayNumber: number; isOut: boolean; isoDate: string }[] = [];

  // 1. Sel hari sisa dari bulan sebelumnya (Abu-abu / out of month)
  for (let i = sundayOffset - 1; i >= 0; i--) {
    const prevDay = daysInPrevMonth - i;
    const prevM = monthIndex === 0 ? 11 : monthIndex - 1;
    const prevY = monthIndex === 0 ? year - 1 : year;
    rawCells.push({
      dayNumber: prevDay,
      isOut: true,
      isoDate: `${prevY}-${padZero(prevM + 1)}-${padZero(prevDay)}`
    });
  }

  // 2. Sel hari bulan berjalan
  for (let d = 1; d <= daysInMonth; d++) {
    rawCells.push({
      dayNumber: d,
      isOut: false,
      isoDate: `${year}-${padZero(monthIndex + 1)}-${padZero(d)}`
    });
  }

  // 3. Sel hari sisa untuk melengkapi grid baris 7 kolom (6 baris x 7 kolom = 42 sel stabil editorial)
  let nextDay = 1;
  while (rawCells.length % 7 !== 0 || rawCells.length < 42) {
    const nextM = monthIndex === 11 ? 0 : monthIndex + 1;
    const nextY = monthIndex === 11 ? year + 1 : year;
    rawCells.push({
      dayNumber: nextDay,
      isOut: true,
      isoDate: `${nextY}-${padZero(nextM + 1)}-${padZero(nextDay)}`
    });
    nextDay++;
  }

  // Map ke struktur CalendarDayCell lengkap
  return rawCells.map(c => {
    const hijri = getHijriInfo(c.isoDate);
    const weton = getWetonInfo(c.isoDate);

    const cellEvents = events.filter(e => e.date === c.isoDate);
    const cellPlanners = planners.filter(p => matchPlannerRule(p, c.isoDate, hijri, weton));
    const hasEvent = cellEvents.length > 0;
    const hasPlanner = cellPlanners.length > 0;
    const hasBoth = hasEvent && hasPlanner;

    return {
      dayNumber: c.dayNumber,
      isOutOfMonth: c.isOut,
      isoDate: c.isoDate,
      hijri,
      weton,
      hasEvent,
      hasPlanner,
      hasBoth,
      isToday: c.isoDate === todayIso,
      isSelected: c.isoDate === selectedIso,
      events: cellEvents,
      planners: cellPlanners
    };
  });
}

/**
 * Mencocokkan apakah suatu Momentum Konten aktif pada tanggal spesifik
 */
export function matchPlannerRule(
  p: ContentPlannerItem,
  isoStr: string,
  hInfo: HijriInfo,
  wInfo: WetonInfo
): boolean {
  if (!p) return false;

  // Tanggal pasti Masehi
  if (p.recurrence_type === 'sekali_tayang' || p.recurrence_type === 'tanggal_masehi_tahunan') {
    if (p.tanggal_mulai && p.tanggal_mulai === isoStr) return true;
    if (p.tanggal_masehi && p.bulan_masehi) {
      const d = parseIsoDate(isoStr);
      if (d.getDate() === p.tanggal_masehi && d.getMonth() + 1 === p.bulan_masehi) {
        return true;
      }
    }
  }

  // Tanggal pasti Hijriah
  if (p.recurrence_type === 'tanggal_hijriah') {
    if (p.tanggal_hijriah && p.bulan_hijriah) {
      const targetMonth = normalizeHijriMonth(p.bulan_hijriah);
      const curMonth = normalizeHijriMonth(hInfo.monthName);
      if (hInfo.day === p.tanggal_hijriah && targetMonth === curMonth) {
        return true;
      }
    }
  }

  // Tanggal tertentu setiap bulan
  if (p.recurrence_type === 'setiap_bulan') {
    if (p.tanggal_masehi) {
      const d = parseIsoDate(isoStr);
      if (d.getDate() === p.tanggal_masehi) return true;
    }
  }

  // Hari mingguan rutin (misal: Setiap Kamis)
  if (p.recurrence_type === 'hari_mingguan') {
    if (p.hari_mingguan && wInfo.day.toLowerCase() === p.hari_mingguan.toLowerCase()) {
      return true;
    }
  }

  // Hari pasaran Weton (misal: Tiap Jumat Legi)
  if (p.recurrence_type === 'hari_weton') {
    if (p.hari_pasaran && wInfo.pasaran.toLowerCase() === p.hari_pasaran.toLowerCase()) {
      if (!p.hari_mingguan || wInfo.day.toLowerCase() === p.hari_mingguan.toLowerCase()) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Memeriksa apakah momentum periode/fleksibel aktif pada bulan Masehi tertentu
 */
export function isPlannerActiveInMonth(p: ContentPlannerItem, year: number, monthIndex: number): boolean {
  if (!p) return false;
  // Jika recurrence jenis bulan hijriah, periksa apakah bulan Hijriah tersebut beririsan dengan bulan Masehi
  if (p.recurrence_type === 'bulan_hijriah' || p.recurrence_type === 'bagian_bulan_hijriah') {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const targetMonth = normalizeHijriMonth(p.bulan_hijriah);
    // Periksa awal, tengah, dan akhir bulan
    const h1 = getHijriInfo(`${year}-${padZero(monthIndex + 1)}-01`);
    const h2 = getHijriInfo(`${year}-${padZero(monthIndex + 1)}-15`);
    const h3 = getHijriInfo(`${year}-${padZero(monthIndex + 1)}-${padZero(daysInMonth)}`);

    return (
      normalizeHijriMonth(h1.monthName) === targetMonth ||
      normalizeHijriMonth(h2.monthName) === targetMonth ||
      normalizeHijriMonth(h3.monthName) === targetMonth
    );
  }

  // Jika recurrence bulan masehi
  if (p.recurrence_type === 'bulan_masehi') {
    return p.bulan_masehi === monthIndex + 1;
  }

  // Jika recurrence fleksibel / sepanjang periode
  if (p.recurrence_type === 'fleksibel') {
    return true;
  }

  return false;
}
