import React, { useState, useEffect, useMemo } from 'react';
import { useSessionStore } from '@core/session';
import { HaulWorkspace } from '../haul-workspace/HaulWorkspace';
import { ProductionDraftRepository } from '../haul-workspace/adapter';
import { seedWorkspace, demoPeople, getPpbsTemplateItems } from '../haul-workspace/fixtures';
import { CANONICAL_STAGING_CREW_FIXTURES } from '../kru/canonicalCrewData';
import type { Actor, Person } from '../haul-workspace/types';
import '@/styles/haul.css';

export interface HaulCountdownValues {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
  isOngoing: boolean;
}

export const DEFAULT_HAUL_TARGET_DATE = '2027-02-01T00:00:00+07:00';
export const HAUL_DURATION_MS = 28 * 24 * 60 * 60 * 1000; // 28 hari durasi rangkaian

/**
 * Pure calculation function for Haul countdown and state.
 * Prevents negative numbers and guarantees consistent tabular output.
 */
export function calculateHaulTimeRemaining(
  targetIso: string = DEFAULT_HAUL_TARGET_DATE,
  currentTimestamp: number = Date.now()
): HaulCountdownValues {
  const targetTime = new Date(targetIso).getTime();
  const diff = targetTime - currentTimestamp;
  const isPast = diff <= 0;
  const isOngoing = isPast && currentTimestamp - targetTime < HAUL_DURATION_MS;

  if (isPast) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isPast: true,
      isOngoing,
    };
  }

  const safeDiff = Math.max(0, diff);
  const days = Math.floor(safeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((safeDiff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((safeDiff / (1000 * 60)) % 60);
  const seconds = Math.floor((safeDiff / 1000) % 60);

  return {
    days,
    hours,
    minutes,
    seconds,
    isPast: false,
    isOngoing: false,
  };
}

export interface HaulPageProps {
  /** Optional target date override for deterministic testing */
  targetDate?: string;
  /** Optional current timestamp override for static testing */
  currentTimestampOverride?: number;
}

export const HaulPage: React.FC<HaulPageProps> = ({
  targetDate = DEFAULT_HAUL_TARGET_DATE,
  currentTimestampOverride,
}) => {
  const { user, can } = useSessionStore();
  const hasAccess = can('projecthaul.view');
  const canManage = can('projecthaul.manage');

  // State untuk countdown (digunakan saat evaluasi countdown dan regression testing)
  const [countdown, setCountdown] = useState<HaulCountdownValues>(() =>
    calculateHaulTimeRemaining(targetDate, currentTimestampOverride ?? Date.now())
  );

  useEffect(() => {
    if (currentTimestampOverride !== undefined) {
      setCountdown(calculateHaulTimeRemaining(targetDate, currentTimestampOverride));
      return;
    }

    const timerId = setInterval(() => {
      const updated = calculateHaulTimeRemaining(targetDate, Date.now());
      setCountdown(updated);
      if (updated.isPast) {
        clearInterval(timerId);
      }
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, [targetDate, currentTimestampOverride]);

  // PTV-DEV-208: Hanya ambil kru berstatus 'Aktif' dari master kru Hub
  const people: Person[] = useMemo(() => {
    const activeHubCrew: Person[] = CANONICAL_STAGING_CREW_FIXTURES
      .filter(c => (c.status_kru || '').toLowerCase() === 'aktif')
      .map(c => ({
        id: c.id,
        name: `${c.full_name}${c.division ? ` (${c.division})` : ''}`,
      }));
    const activeDemo = demoPeople.filter(p => !p.name.includes('(Nonaktif)'));
    return [...activeDemo, ...activeHubCrew];
  }, []);

  // Tentukan identitas aktor yang login
  const actor: Actor = useMemo(() => {
    const matchedCrew = CANONICAL_STAGING_CREW_FIXTURES.find(
      c =>
        c.username === user?.username ||
        c.id === user?.id ||
        c.full_name.toLowerCase() === (user?.full_name || '').toLowerCase()
    );

    return {
      id: user?.id || 'hub-operator',
      personId: matchedCrew?.id || 'person-zidnal',
      role: canManage ? 'coordinator' : 'crew',
    };
  }, [user, canManage]);

  // Siapkan dataset operasional awal PPBS
  const repository = useMemo(() => {
    const seed = seedWorkspace();
    const ppbsItems = getPpbsTemplateItems(seed.edition.id);
    seed.items = ppbsItems;
    return new ProductionDraftRepository(seed, people);
  }, [people]);

  // Pengecekan akses RBAC: projecthaul.view
  if (!hasAccess) {
    return (
      <div className="haul-page">
        <div className="haul-coming-wrap">
          <div className="haul-event-banner past">
            <div className="haul-event-banner-title">
              <i className="fa-solid fa-lock" style={{ color: 'var(--warn, #9A6B08)' }} />
              Akses Terbatas
            </div>
            <p className="haul-event-banner-desc">
              Anda tidak memiliki izin (<code>projecthaul.view</code>) untuk melihat modul Haul &amp; Harlah PPBS.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Jika dipanggil dalam mode uji countdown spesifik (currentTimestampOverride diberikan)
  if (currentTimestampOverride !== undefined) {
    const { days, hours, minutes, seconds, isPast, isOngoing } = countdown;
    const pad = (n: number) => String(n).padStart(2, '0');
    const subtitle = isPast
      ? isOngoing
        ? 'Rangkaian Haul & Harlah sedang berlangsung.'
        : 'Rangkaian Haul & Harlah telah berlangsung.'
      : 'Coming Soon';

    return (
      <div className="haul-page">
        <div className="haul-coming-wrap">
          <div className="haul-badge">
            <i className="fa-solid fa-mosque" />
            <span>Pesantren Progresif Bumi Shalawat</span>
          </div>

          <h1 className="haul-title">Project Haul &amp; Harlah PPBS</h1>
          <p className="haul-subtitle">{subtitle}</p>

          {!isPast ? (
            <div className="haul-countdown" id="haulCountdown" role="timer" aria-label="Hitung Mundur Acara">
              <div className="haul-cd-box">
                <span className="cd-num" id="haulDays">{pad(days)}</span>
                <span className="cd-lbl">Hari</span>
              </div>
              <div className="haul-cd-box">
                <span className="cd-num" id="haulHours">{pad(hours)}</span>
                <span className="cd-lbl">Jam</span>
              </div>
              <div className="haul-cd-box">
                <span className="cd-num" id="haulMins">{pad(minutes)}</span>
                <span className="cd-lbl">Menit</span>
              </div>
              <div className="haul-cd-box">
                <span className="cd-num" id="haulSecs">{pad(seconds)}</span>
                <span className="cd-lbl">Detik</span>
              </div>
            </div>
          ) : (
            <div className={`haul-event-banner ${isOngoing ? 'ongoing' : 'past'}`}>
              <div className="haul-event-banner-title">
                <i className={isOngoing ? 'fa-solid fa-satellite-dish' : 'fa-solid fa-circle-check'} style={{ color: isOngoing ? 'var(--ok, #0F7A5A)' : 'var(--muted)' }} />
                <span>{isOngoing ? 'Liputan Siaran Langsung Aktif' : 'Rangkaian Acara Selesai'}</span>
              </div>
              <p className="haul-event-banner-desc">
                {isOngoing
                  ? 'Seluruh tim multimedia dan kru liputan Progresif TV bertugas di area pesantren sesuai rundown harian.'
                  : 'Dokumentasi, arsip liputan, dan rekaman siaran dapat diakses melalui portal media Progresif TV.'}
              </p>
            </div>
          )}

          <div className="haul-info-card">
            <p>
              <i className="fa-solid fa-calendar-days" style={{ color: 'var(--ptv-green, #0e4f40)' }} />
              <span>
                Rangkaian acara Haul &amp; Harlah akan berlangsung pada bulan <b>Januari–Februari 2027</b>.
              </span>
            </p>
            <p>
              <i className="fa-solid fa-video" style={{ color: 'var(--b-600, #1273E6)' }} />
              <span>
                <b>Persiapan Kru Liputan &amp; Multimedia:</b> Penugasan tim operasional siaran, live streaming, dan logistik kamera dikoordinasikan secara bertahap menjelang agenda akbar.
              </span>
            </p>
            <p className="hint">
              <i className="fa-solid fa-circle-info" />
              <span>Persiapkan diri. Informasi rangkaian acara akan diumumkan secara bertahap.</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Tampilan Utama Operasional Haul & Harlah Workspace di PTV Hub
  return (
    <div className="haul-page" style={{ padding: 0 }}>
      <HaulWorkspace repository={repository} people={people} actor={actor} />
    </div>
  );
};
