import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  HaulPage,
  calculateHaulTimeRemaining,
  HAUL_DURATION_MS,
} from '../../src/products/hub/haul/HaulPage';
import {
  SeoPage,
} from '../../src/products/hub/seo/SeoPage';
import { useSessionStore } from '../../src/core/session';

describe('Batch 6A: Haul & Harlah PPBS + SEO & Analytics Unit Tests', () => {
  describe('1. Haul & Harlah PPBS — Pure Calculation Logic', () => {
    it('1.1 should correctly calculate remaining days, hours, minutes, and seconds before target date', () => {
      const targetIso = '2027-02-01T00:00:00+07:00';
      const targetTime = new Date(targetIso).getTime();

      // Set timestamp exactly 10 days, 5 hours, 30 minutes, 15 seconds before target
      const offsetMs =
        10 * 24 * 60 * 60 * 1000 +
        5 * 60 * 60 * 1000 +
        30 * 60 * 1000 +
        15 * 1000;
      const currentTimestamp = targetTime - offsetMs;

      const result = calculateHaulTimeRemaining(targetIso, currentTimestamp);

      expect(result.isPast).toBe(false);
      expect(result.isOngoing).toBe(false);
      expect(result.days).toBe(10);
      expect(result.hours).toBe(5);
      expect(result.minutes).toBe(30);
      expect(result.seconds).toBe(15);
    });

    it('1.2 should never produce negative countdown numbers when target date has passed', () => {
      const targetIso = '2027-02-01T00:00:00+07:00';
      const targetTime = new Date(targetIso).getTime();

      // Current time is 5 days after target
      const currentTimestamp = targetTime + 5 * 24 * 60 * 60 * 1000;
      const result = calculateHaulTimeRemaining(targetIso, currentTimestamp);

      expect(result.isPast).toBe(true);
      expect(result.days).toBe(0);
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(0);
      expect(result.seconds).toBe(0);
    });

    it('1.3 should detect ongoing event state during the 28-day duration window', () => {
      const targetIso = '2027-02-01T00:00:00+07:00';
      const targetTime = new Date(targetIso).getTime();

      // 14 days into the event
      const currentTimestamp = targetTime + 14 * 24 * 60 * 60 * 1000;
      const result = calculateHaulTimeRemaining(targetIso, currentTimestamp);

      expect(result.isPast).toBe(true);
      expect(result.isOngoing).toBe(true);
    });

    it('1.4 should detect past/concluded event state after 28-day duration window', () => {
      const targetIso = '2027-02-01T00:00:00+07:00';
      const targetTime = new Date(targetIso).getTime();

      // 30 days after target (beyond 28-day window)
      const currentTimestamp = targetTime + 30 * 24 * 60 * 60 * 1000;
      const result = calculateHaulTimeRemaining(targetIso, currentTimestamp);

      expect(result.isPast).toBe(true);
      expect(result.isOngoing).toBe(false);
    });
  });

  describe('2. Haul & Harlah PPBS — Component Rendering & RBAC', () => {
    beforeEach(() => {
      // Mock session as eksekutif (has projecthaul.view)
      useSessionStore.setState({
        user: {
          id: 'test-user',
          username: 'operator',
          full_name: 'Operator Hub',
          assigned_profiles: ['eksekutif'],
          allowed_overrides: [],
          denied_overrides: [],
          status_akun: 'active',
          status_organisasi: 'active',
        } as any,
      });
    });

    it('2.1 should render institutional badge, title, and countdown boxes before event', () => {
      const targetIso = '2027-02-01T00:00:00+07:00';
      const targetTime = new Date(targetIso).getTime();
      const fixedNow = targetTime - 86400000; // 1 day before

      const html = renderToString(
        <HaulPage targetDate={targetIso} currentTimestampOverride={fixedNow} />
      );

      expect(html).toContain('Pesantren Progresif Bumi Shalawat');
      expect(html).toContain('Project Haul &amp; Harlah PPBS');
      expect(html).toContain('Coming Soon');

      // Check countdown labels
      expect(html).toContain('Hari');
      expect(html).toContain('Jam');
      expect(html).toContain('Menit');
      expect(html).toContain('Detik');

      // Check info card details
      expect(html).toContain('Januari–Februari 2027');
      expect(html).toContain('Persiapan Kru Liputan &amp; Multimedia:');
    });

    it('2.2 should render ongoing event banner when target is reached', () => {
      const targetIso = '2027-02-01T00:00:00+07:00';
      const targetTime = new Date(targetIso).getTime();
      const fixedNow = targetTime + 1000; // 1 second after target

      const html = renderToString(
        <HaulPage targetDate={targetIso} currentTimestampOverride={fixedNow} />
      );

      expect(html).toContain('Rangkaian Haul &amp; Harlah sedang berlangsung.');
      expect(html).toContain('Liputan Siaran Langsung Aktif');
      expect(html).not.toContain('id="haulCountdown"');
    });

    it('2.3 should render concluded banner when event period has passed', () => {
      const targetIso = '2027-02-01T00:00:00+07:00';
      const targetTime = new Date(targetIso).getTime();
      const fixedNow = targetTime + HAUL_DURATION_MS + 1000; // Beyond 28 days

      const html = renderToString(
        <HaulPage targetDate={targetIso} currentTimestampOverride={fixedNow} />
      );

      expect(html).toContain('Rangkaian Haul &amp; Harlah telah berlangsung.');
      expect(html).toContain('Rangkaian Acara Selesai');
      expect(html).not.toContain('id="haulCountdown"');
    });

    it('2.4 should enforce RBAC capability projecthaul.view', () => {
      // Pembina profile does not have projecthaul.view
      useSessionStore.setState({
        user: {
          id: 'test-pembina',
          username: 'pembina',
          full_name: 'Dewan Pembina',
          assigned_profiles: ['pembina'],
          allowed_overrides: [],
          denied_overrides: [],
          status_akun: 'active',
          status_organisasi: 'active',
        } as any,
      });

      const html = renderToString(<HaulPage />);

      expect(html).toContain('Akses Terbatas');
      expect(html).toContain('projecthaul.view');
    });
  });

  describe('3. SEO & Analytics — Dashboard & Fixture Parity', () => {
    beforeEach(() => {
      // Mock session as eksekutif (has settings.system)
      useSessionStore.setState({
        user: {
          id: 'test-exec',
          username: 'direktur',
          full_name: 'Direktur Utama',
          assigned_profiles: ['eksekutif'],
          allowed_overrides: [],
          denied_overrides: [],
          status_akun: 'active',
          status_organisasi: 'active',
        } as any,
      });
    });

    it('3.1 should render 4 authoritative KPI cards matching legacy values', () => {
      const html = renderToString(<SeoPage />);

      // Verify the 4 KPI titles and values
      expect(html).toContain('Kunjungan 30 hari');
      expect(html).toContain('12.4rb');

      expect(html).toContain('CTR rata-rata');
      expect(html).toContain('3.2%');

      expect(html).toContain('Artikel terindeks');
      expect(html).toContain('18');

      expect(html).toContain('Waktu muat');
      expect(html).toContain('2.1s');
    });

    it('3.2 should render weekly visits bar chart with 7 days and correct peak proportion', () => {
      const html = renderToString(<SeoPage />);

      expect(html).toContain('Kunjungan Pekan Ini');

      // Check all 7 days from Sen to Min
      const days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
      for (const d of days) {
        expect(html).toContain(d);
      }

      // Check visits numbers
      expect(html).toContain('42');
      expect(html).toContain('58');
      expect(html).toContain('49');
      expect(html).toContain('73');
      expect(html).toContain('88'); // Peak (100.0%)
      expect(html).toContain('64');
      expect(html).toContain('55');

      // Peak bar should have height 100.0%
      expect(html).toContain('height:100.0%');
    });

    it('3.3 should render top search keywords with exact positions and clicks', () => {
      const html = renderToString(<SeoPage />);

      expect(html).toContain('Kata Kunci Teratas');

      // Keywords
      expect(html).toContain('pesantren progresif');
      expect(html).toContain('#1');
      expect(html).toContain('480');

      expect(html).toContain('ptv progresif tv');
      expect(html).toContain('#2');
      expect(html).toContain('310');

      expect(html).toContain('haflah akhirussanah');
      expect(html).toContain('#5');
      expect(html).toContain('180');

      expect(html).toContain('wisuda tahfidz');
      expect(html).toContain('#7');
      expect(html).toContain('120');
    });

    it('3.4 should show honest data notice indicating internal media telemetry', () => {
      const html = renderToString(<SeoPage />);

      expect(html).toContain('Telemetri Internal:');
      expect(html).toContain('Tidak memerlukan koneksi API pihak ketiga');
    });

    it('3.5 should enforce RBAC capability settings.system', () => {
      // Crew role does not have settings.system
      useSessionStore.setState({
        user: {
          id: 'test-crew',
          username: 'kru_biasa',
          full_name: 'Kru Lapangan',
          assigned_profiles: ['crew'],
          allowed_overrides: [],
          denied_overrides: [],
          status_akun: 'active',
          status_organisasi: 'active',
        } as any,
      });

      const html = renderToString(<SeoPage />);

      expect(html).toContain('Akses Khusus Eksekutif');
      expect(html).toContain('settings.system');
    });
  });
});
