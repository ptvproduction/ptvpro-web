import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
  DOW,
  generateMonthGridCells,
  getShortHijriFormatted,
  getEventDisplayTime,
  isLiveEvent,
  getEventAccentClass
} from '../../src/products/hub/kalender/utils/calendarDateUtils';
import { CalendarEvent, ContentPlannerItem } from '../../src/products/hub/kalender/types';
import { KalenderPage } from '../../src/products/hub/kalender/KalenderPage';

vi.mock('@/core/session', () => ({
  useSessionStore: () => ({
    session: {
      user: {
        name: 'Zidnal Falah',
        email: 'zidna@progresiftv.id',
      },
    },
  }),
}));

vi.mock('../../src/products/hub/acara/context/AcaraContext', () => ({
  useAcara: () => ({
    events: [
      { id: '1', name: 'Briefing Produksi', date: '2026-10-19', time: '08:30' },
      { id: '2', name: 'Liputan Lapangan', date: '2026-10-19', time: '10:00' },
      { id: '3', name: 'Pengambilan Alat', date: '2026-10-19', time: '14:00' },
      { id: '4', name: 'Evaluasi Live', date: '2026-10-19', time: '19:30' },
    ],
    isLoading: false,
    error: null,
    refreshEvents: vi.fn(),
  }),
  useOptionalAcara: () => ({
    events: [
      { id: '1', name: 'Briefing Produksi', date: '2026-10-19', time: '08:30' },
      { id: '2', name: 'Liputan Lapangan', date: '2026-10-19', time: '10:00' },
      { id: '3', name: 'Pengambilan Alat', date: '2026-10-19', time: '14:00' },
      { id: '4', name: 'Evaluasi Live', date: '2026-10-19', time: '19:30' },
    ],
    isLoading: false,
    error: null,
    refreshEvents: vi.fn(),
    createEvent: vi.fn(),
  }),
}));

vi.mock('../../src/products/hub/kalender/kalenderService', () => ({
  kalenderService: {
    getPlanners: vi.fn().mockResolvedValue([
      {
        id: 'p1',
        judul_momentum: 'Hari Santri Nasional',
        kategori: 'Event Masehi',
        recurrence_type: 'tanggal_masehi_tahunan',
        bulan_masehi: 10,
        tanggal_masehi: 22,
      },
    ]),
    createPlanner: vi.fn().mockResolvedValue({}),
    updatePlanner: vi.fn().mockResolvedValue({}),
    deletePlanner: vi.fn().mockResolvedValue(true),
  },
}));

describe('PTVPRO — Redesign Kalender Kegiatan (Grid, Chips & Selected Date)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Header DOW harus 7 kolom berawal dari AHAD dan berakhir di SABTU', () => {
    expect(DOW).toEqual(['AHAD', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']);
    expect(DOW[0]).toBe('AHAD');
    expect(DOW[6]).toBe('SABTU');
  });

  it('2. Format Hijriah ringkas harus menghasilkan format standar (cth: "17 Rab II", "8 Jum I")', () => {
    const sampleHijri1 = {
      day: 17,
      month: 4,
      monthName: 'Rabiul Akhir',
      year: 1448,
      full: '17 Rabiul Akhir 1448 H',
      short: '17 Rabi',
    };
    expect(getShortHijriFormatted(sampleHijri1)).toBe('17 Rab II');

    const sampleHijri2 = {
      day: 8,
      month: 5,
      monthName: 'Jumadil Awal',
      year: 1448,
      full: '8 Jumadil Awal 1448 H',
      short: '8 Juma',
    };
    expect(getShortHijriFormatted(sampleHijri2)).toBe('8 Jum I');
  });

  it('3. Helper event chips: waktu mulai dan deteksi Live/kategori acara', () => {
    const liveEvent: CalendarEvent = {
      id: 'ev-live-1',
      name: 'Siaran Langsung Tabligh Akbar',
      date: '2026-10-19',
      time: '19:30 WIB',
      category: 'Liputan Utama',
    };
    expect(isLiveEvent(liveEvent)).toBe(true);
    expect(getEventAccentClass(liveEvent)).toBe('chip-live');
    expect(getEventDisplayTime(liveEvent)).toBe('19:30');

    const multiSessionEvent: CalendarEvent = {
      id: 'ev-multi-1',
      name: 'Rapat Koordinasi Evaluasi',
      date: '2026-10-19',
      sessions: [
        { id: 'sess-1', label: 'Pagi', start_time: '08:30', has_end_time: true, end_time: '11:00' },
      ],
    };
    expect(isLiveEvent(multiSessionEvent)).toBe(false);
    expect(getEventAccentClass(multiSessionEvent)).toBe('chip-internal');
    expect(getEventDisplayTime(multiSessionEvent)).toBe('08:30');
  });

  it('4. generateMonthGridCells harus menghasilkan 42 sel stabil editorial berawal dari Ahad', () => {
    const sampleEvents: CalendarEvent[] = [
      { id: '1', name: 'Briefing Produksi', date: '2026-10-19', time: '08:30' },
      { id: '2', name: 'Liputan Lapangan', date: '2026-10-19', time: '10:00' },
      { id: '3', name: 'Pengambilan Alat', date: '2026-10-19', time: '14:00' },
      { id: '4', name: 'Evaluasi Sore', date: '2026-10-19', time: '16:30' },
    ];

    const samplePlanners: ContentPlannerItem[] = [
      {
        id: 'p1',
        judul_momentum: 'Hari Santri Nasional',
        kategori: 'Event Masehi',
        recurrence_type: 'tanggal_masehi_tahunan',
        bulan_masehi: 10,
        tanggal_masehi: 22,
      },
    ];

    // Oktober 2026 = monthIndex 9
    const cells = generateMonthGridCells(2026, 9, '2026-10-19', sampleEvents, samplePlanners);

    // Grid editorial harus 42 sel stabil (6 baris x 7 kolom)
    expect(cells.length).toBe(42);

    // Tanggal 1 Oktober 2026 adalah Kamis, maka kolom ke-5 (index 4 di AHAD-SABTU)
    const cellOct1 = cells.find((c) => !c.isOutOfMonth && c.dayNumber === 1);
    expect(cellOct1).toBeDefined();

    // Tanggal 19 Oktober: memiliki 4 acara dan terpilih
    const cellOct19 = cells.find((c) => !c.isOutOfMonth && c.dayNumber === 19);
    expect(cellOct19).toBeDefined();
    expect(cellOct19?.isSelected).toBe(true);
    expect(cellOct19?.events?.length).toBe(4);
    expect(cellOct19?.hasEvent).toBe(true);

    // Tanggal 22 Oktober: memiliki planner p1
    const cellOct22 = cells.find((c) => !c.isOutOfMonth && c.dayNumber === 22);
    expect(cellOct22?.hasPlanner).toBe(true);
  });

  it('5. Render KalenderPage menampilkan DOW AHAD-SABTU, header editorial, dan sel progresif', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/hub/kalender']}>
        <KalenderPage />
      </MemoryRouter>
    );

    // Header Editorial kartu kalender
    expect(html).toContain('cal-editorial-header');
    expect(html).toContain('cal-editorial-nav-row');
    expect(html).toContain('cal-editorial-title');
    expect(html).toContain('cal-editorial-today-row');
    expect(html).toContain('cal-editorial-hijri-range');
    expect(html).toContain('Hari Ini');

    // DOW harus ter-render dengan AHAD dan SABTU, serta styling merah pada Ahad
    expect(html).toContain('cal-dow-col');
    expect(html).toContain('AHAD');
    expect(html).toContain('SABTU');
    expect(html).toContain('cal-dow-sunday');

    // Memastikan class grid kalender editorial ter-render
    expect(html).toContain('cal-days-grid');
    expect(html).toContain('cal-day-cell');
    expect(html).toContain('cal-cell-corner-tl');
    expect(html).toContain('cal-cell-corner-tr');
    expect(html).toContain('cal-cell-corner-bl');
    expect(html).toContain('cal-cell-corner-br');
    expect(html).toContain('cal-cell-header-row');
    expect(html).toContain('cal-cell-masehi');
    expect(html).toContain('cal-cell-hijri');
    expect(html).toContain('calendar-hijri-number');
    expect(html).toContain('cal-cell-sub-row');
    expect(html).toContain('cal-cell-weton');
    expect(html).toContain('cal-cell-dots');

    // Memastikan detail tanggal terpilih editorial banner ter-render
    expect(html).toContain('kal-selected-banner');
    expect(html).toContain('Detail Tanggal Terpilih');

    // Memastikan legend bawah grid kalender ter-render
    expect(html).toContain('Tanggal Terpilih');
    expect(html).toContain('Ada Acara / Kegiatan');
    expect(html).toContain('Ada Momentum Konten');
  });

  it('6. Helper toArabicIndicDigits mengonversi angka latin ke angka Arab-Indic dengan benar', async () => {
    const { toArabicIndicDigits } = await import(
      '../../src/products/hub/kalender/utils/calendarDateUtils'
    );
    expect(toArabicIndicDigits(1)).toBe('١');
    expect(toArabicIndicDigits(8)).toBe('٨');
    expect(toArabicIndicDigits(19)).toBe('١٩');
    expect(toArabicIndicDigits(28)).toBe('٢٨');
  });
});

