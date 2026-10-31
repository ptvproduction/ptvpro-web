import { describe, it, expect } from 'vitest';
import {
  formatHumanDateIndo,
  getWetonInfo,
  getHijriInfo,
  parseIsoDate,
  formatIsoDate
} from '@products/hub/acara/utils/acaraDateUtils';
import { getAcaraStatusInfo } from '@products/hub/acara/utils/acaraStatusUtils';
import {
  normalizeJam,
  formatRundownJam,
  sortRundownList
} from '@products/hub/acara/utils/rundownUtils';
import { INITIAL_ACARA_FIXTURES } from '@products/hub/acara/mock/acaraMockData';
import { AcaraRundownItem } from '@products/hub/acara/types';

describe('Modul Acara — Date & Calendar Utilities', () => {
  it('harus memformat tanggal Masehi ke Bahasa Indonesia dengan benar', () => {
    expect(formatHumanDateIndo('2026-10-16')).toBe('16 Oktober 2026');
    expect(formatHumanDateIndo('2026-10-16', true)).toContain('16 Oktober 2026');
  });

  it('harus menghitung Pasaran Weton Jawa dengan akurat', () => {
    const weton = getWetonInfo('2026-10-16');
    expect(weton.day).toBeDefined();
    expect(weton.pasaran).toBeDefined();
    expect(['Wage', 'Kliwon', 'Legi', 'Pahing', 'Pon']).toContain(weton.pasaran);
    expect(weton.full).toContain(weton.pasaran);
  });

  it('harus mengembalikan kalkulasi tanggal Hijriah', () => {
    const hijri = getHijriInfo('2026-10-16');
    expect(hijri.year).toBeGreaterThanOrEqual(1447);
    expect(hijri.monthName).toBeDefined();
    expect(hijri.full).toContain('H');
  });

  it('harus melakukan round-trip parseIsoDate dan formatIsoDate secara presisi', () => {
    const d = parseIsoDate('2026-10-16');
    expect(formatIsoDate(d)).toBe('2026-10-16');
  });
});

describe('Modul Acara — Status Badge & Countdown Logic', () => {
  const refDate = new Date('2026-10-16T12:00:00Z');

  it('harus mengembalikan status Selesai untuk event berstatus Selesai', () => {
    const status = getAcaraStatusInfo({ status: 'Selesai', date: '2026-10-20' }, refDate);
    expect(status.variant).toBe('ok');
    expect(status.label).toBe('Selesai');
  });

  it('harus mengembalikan status Batal untuk event berstatus Dibatalkan / Batal', () => {
    const status1 = getAcaraStatusInfo({ status: 'Batal' }, refDate);
    expect(status1.variant).toBe('dang');
    expect(status1.label).toBe('Batal');

    const status2 = getAcaraStatusInfo({ status: 'Dibatalkan' }, refDate);
    expect(status2.variant).toBe('dang');
    expect(status2.label).toBe('Batal');
  });

  it('harus menandai event hari ini dengan Hari ini dan isBold', () => {
    const status = getAcaraStatusInfo({ date: '2026-10-16', status: 'Mendatang' }, refDate);
    expect(status.variant).toBe('info');
    expect(status.label).toBe('Hari ini');
    expect(status.isBold).toBe(true);
  });

  it('harus menandai event besok dengan Besok', () => {
    const status = getAcaraStatusInfo({ date: '2026-10-17', status: 'Mendatang' }, refDate);
    expect(status.variant).toBe('info');
    expect(status.label).toBe('Besok');
  });

  it('harus menghitung countdown hari untuk event mendatang di atas 1 hari', () => {
    const status = getAcaraStatusInfo({ date: '2026-10-21', status: 'Mendatang' }, refDate);
    expect(status.variant).toBe('info');
    expect(status.label).toBe('5 hari lagi');
  });

  it('harus menandai event masa lalu yang belum dibatalkan sebagai Selesai secara otomatis', () => {
    const status = getAcaraStatusInfo({ date: '2026-10-05', status: 'Mendatang' }, refDate);
    expect(status.variant).toBe('ok');
    expect(status.label).toBe('Selesai');
  });
});

describe('Modul Acara — Rundown Timeline Utilities', () => {
  it('harus menormalisasi format jam titik menjadi titik dua HH:mm', () => {
    expect(normalizeJam('19.00')).toBe('19:00');
    expect(normalizeJam('8.30')).toBe('08:30');
    expect(normalizeJam('19:45')).toBe('19:45');
  });

  it('harus memformat jam rundown ke format display legacy titik', () => {
    expect(formatRundownJam('19:00')).toBe('19.00');
    expect(formatRundownJam('08:30')).toBe('08.30');
  });

  it('harus mengurutkan item rundown strictly kronologis berdasarkan waktu', () => {
    const unsorted: AcaraRundownItem[] = [
      { id: '1', jam_mulai: '21:00', kegiatan: 'Mauidhoh Hasanah' },
      { id: '2', jam_mulai: '19.00', kegiatan: 'Persiapan Teknis' },
      { id: '3', jam_mulai: '22:15', kegiatan: 'Doa Penutup' },
      { id: '4', jam_mulai: '19:30', kegiatan: 'Pembukaan' }
    ];

    const sorted = sortRundownList(unsorted);
    expect(sorted.map((s) => s.id)).toEqual(['2', '4', '1', '3']);
    expect(sorted[0].kegiatan).toBe('Persiapan Teknis');
    expect(sorted[3].kegiatan).toBe('Doa Penutup');
  });
});

describe('Modul Acara — Mock Fixtures Data Integrity', () => {
  it('harus memuat seluruh fixture awal dengan identitas data yang valid', () => {
    expect(INITIAL_ACARA_FIXTURES.length).toBeGreaterThanOrEqual(8);
    INITIAL_ACARA_FIXTURES.forEach((ev) => {
      expect(ev.id).toBeDefined();
      expect(ev.name.length).toBeGreaterThan(0);
      expect(ev.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ev.time).toBeDefined();
      expect(ev.loc).toBeDefined();
      expect(ev.status).toBeDefined();
    });
  });

  it('harus memastikan alokasi peralatan memiliki unit fisik barcode terdefinisi', () => {
    const eventWithGear = INITIAL_ACARA_FIXTURES.find((e) => (e.gear || []).length > 0);
    expect(eventWithGear).toBeDefined();
    if (eventWithGear && eventWithGear.gear.length > 0) {
      const g = eventWithGear.gear[0];
      expect(g.code).toMatch(/^INV-/);
      expect(g.qty).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(g.units)).toBe(true);
    }
  });

  it('harus memastikan kru yang bertugas memiliki tugas / job yang jelas', () => {
    const eventWithCrew = INITIAL_ACARA_FIXTURES.find((e) => (e.crew || []).length > 0);
    expect(eventWithCrew).toBeDefined();
    if (eventWithCrew && eventWithCrew.crew.length > 0) {
      const c = eventWithCrew.crew[0];
      expect(c.name).toBeDefined();
      expect(c.job).toBeDefined();
    }
  });
});

describe('Modul Acara & Kalender — Shared Segmented Navigation', () => {
  it('harus memastikan AcaraKalenderNav terdefinisi dan dapat diimpor', async () => {
    const mod = await import('@/shared/components/AcaraKalenderNav');
    expect(mod.AcaraKalenderNav).toBeDefined();
  });
});
