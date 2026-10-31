import { AuthUser } from '@core/auth/types';
import { AcaraItem } from '../acara/types';
import { PeminjamanRecord } from '../peminjaman/types';

export interface WibTimeInfo {
  todayIso: string;
  tomorrowIso: string;
  currentHour: number;
}

/**
 * Mengambil tanggal hari ini, besok, dan jam dalam zona waktu Asia/Jakarta (WIB).
 */
export function getWibCurrentInfo(): WibTimeInfo {
  const now = new Date();
  
  // Format YYYY-MM-DD dalam timezone Asia/Jakarta
  const todayIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(tomorrow);

  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    hour12: false,
  }).format(now);
  const currentHour = parseInt(hourStr, 10) || now.getHours();

  return { todayIso, tomorrowIso, currentHour };
}

/**
 * Format tanggal relatif sesuai pola PHP Legacy: "Hari ini", "Besok", atau "Sen, 19 Okt".
 */
export function formatRelDay(dateStr?: string | null, todayIso?: string, tomorrowIso?: string): string {
  if (!dateStr) return '';
  const d = dateStr.slice(0, 10);
  if (todayIso && d === todayIso) return 'Hari ini';
  if (tomorrowIso && d === tomorrowIso) return 'Besok';

  try {
    const parts = d.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dateObj = new Date(year, month, day);
      return dateObj.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    }
  } catch {
    // fallback
  }
  return d;
}

/**
 * Ucapan salam dinamis berdasarkan jam lokal WIB (greet() di page-dasbor.php).
 */
export function getGreeting(hour: number): string {
  return hour < 11 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 18 ? 'Selamat Sore' : 'Selamat Malam';
}

/**
 * Filter acara mendatang aktif (bukan historis masa lalu dan bukan selesai/dibatalkan).
 * Diurutkan terdekat lebih dulu.
 */
export function filterUpcomingEvents(events: AcaraItem[], todayIso: string): AcaraItem[] {
  if (!Array.isArray(events)) return [];

  return events
    .filter((e) => {
      const d = String(e.date || '').slice(0, 10);
      const st = String(e.status || '').trim().toLowerCase();
      const isPast = d ? d < todayIso : false;
      const isFinished = st === 'selesai' || st === 'batal' || st === 'dibatalkan';
      return !isPast && !isFinished;
    })
    .sort((a, b) => {
      const dateA = String(a.date || '').slice(0, 10);
      const dateB = String(b.date || '').slice(0, 10);
      const comp = dateA.localeCompare(dateB);
      if (comp !== 0) return comp;
      return String(a.time || '').localeCompare(String(b.time || ''));
    });
}

export interface MyLoanItem {
  id: string;
  loanId: string;
  name: string;
  unitCode: string;
  due: string;
  isLate: boolean;
}

/**
 * Filter peminjaman aktif milik akun pengguna login.
 * Mencegah kebocoran data peminjaman antar-kru.
 */
export function filterMyActiveLoans(
  loans: PeminjamanRecord[],
  user: AuthUser | null | undefined,
  todayIso: string,
  tomorrowIso: string
): MyLoanItem[] {
  if (!Array.isArray(loans) || !user) return [];

  const myPtvId = (user.ptv_id || '').toLowerCase().trim();
  const myName = (user.full_name || '').toLowerCase().trim();
  const myUsername = (user.username || '').toLowerCase().trim();
  const myAccId = user.id || (user as any)?.account_id || '';

  return loans
    .filter((l) => {
      // 1. Verifikasi kepemilikan
      const isActor = Boolean(myAccId && l.actor_id && l.actor_id === myAccId);
      const borrower = (l.peminjam_nama || '').toLowerCase().trim();
      const matchName = Boolean(myName && (borrower === myName || borrower.includes(myName) || myName.includes(borrower)));
      const matchUser = Boolean(myUsername && (borrower === myUsername || borrower.includes(myUsername)));
      const matchPtv = Boolean(myPtvId && (borrower === myPtvId || borrower.includes(myPtvId)));

      const isMine = isActor || matchName || matchUser || matchPtv;
      if (!isMine) return false;

      // 2. Hanya peminjaman aktif (belum dikembalikan)
      const st = (l.status || '').toLowerCase().trim();
      const isReturned = st === 'dikembalikan' || st === 'selesai' || Boolean(l.tanggal_kembali);
      return !isReturned;
    })
    .map((l) => {
      const isLate = l.status === 'terlambat' || Boolean(l.tenggat_kembali && l.tenggat_kembali < todayIso);
      const dueLabel = l.tenggat_kembali
        ? `Kembali ${formatRelDay(l.tenggat_kembali, todayIso, tomorrowIso).toLowerCase()}`
        : 'Sedang dipinjam';

      return {
        id: l.id,
        loanId: l.id,
        name: l.nama_alat || 'Unit Alat',
        unitCode: l.kode_unit || '-',
        due: dueLabel,
        isLate,
      };
    });
}
