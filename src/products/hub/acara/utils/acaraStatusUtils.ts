/**
 * PTV PRO — Modul Acara
 * Helper status dan countdown badge acara
 * Porting 1:1 dari implementasi legacy getAcaraStatusBadge (page-dasbor.php L15305–15336)
 */

import { AcaraItem } from '../types';
import { parseIsoDate, formatIsoDate } from './acaraDateUtils';

export interface AcaraStatusInfo {
  label: string;
  variant: 'ok' | 'dang' | 'info' | 'muted';
  icon: string;
  isBold?: boolean;
  diffDays?: number;
}

export function getAcaraStatusInfo(e: Partial<AcaraItem>, referenceDate?: Date): AcaraStatusInfo {
  const normStatus = String(e?.status || '').trim().toLowerCase();

  if (normStatus === 'selesai') {
    return {
      label: 'Selesai',
      variant: 'ok',
      icon: 'fa-regular fa-circle-check'
    };
  }

  if (normStatus === 'batal' || normStatus === 'dibatalkan') {
    return {
      label: 'Batal',
      variant: 'dang',
      icon: 'fa-regular fa-circle-xmark'
    };
  }

  const today = referenceDate || new Date();
  const todayStr = formatIsoDate(today);

  if (!e?.date) {
    return {
      label: 'Terjadwal',
      variant: 'muted',
      icon: 'fa-regular fa-clock'
    };
  }

  const eventDateStr = e.date.split('T')[0];

  if (eventDateStr === todayStr) {
    return {
      label: 'Hari ini',
      variant: 'info',
      icon: 'fa-solid fa-bolt',
      isBold: true,
      diffDays: 0
    };
  }

  const dToday = parseIsoDate(todayStr);
  const dEvent = parseIsoDate(eventDateStr);
  const diffTime = dEvent.getTime() - dToday.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: 'Selesai',
      variant: 'ok',
      icon: 'fa-regular fa-circle-check',
      diffDays
    };
  }

  if (diffDays === 1) {
    return {
      label: 'Besok',
      variant: 'info',
      icon: 'fa-regular fa-clock',
      diffDays
    };
  }

  return {
    label: `${diffDays} hari lagi`,
    variant: 'info',
    icon: 'fa-regular fa-clock',
    diffDays
  };
}
