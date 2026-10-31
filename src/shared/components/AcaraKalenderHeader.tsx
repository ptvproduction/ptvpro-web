/**
 * PTV PRO — Shared Acara & Kalender Header Component
 * Menyediakan layout header tunggal yang konsisten antara Halaman Acara (/hub/acara)
 * dan Halaman Kalender (/hub/kalender), menjamin koordinat segmented nav stabil tanpa pergeseran.
 * Sesuai panduan PTV Design System R03 & W3C Route Navigation Accessibility.
 */

import React from 'react';
import { AcaraKalenderNav } from './AcaraKalenderNav';
import '@/styles/acaraKalenderNav.css';

export interface AcaraKalenderHeaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export const AcaraKalenderHeader: React.FC<AcaraKalenderHeaderProps> = ({
  title = 'Agenda & Kalender Kegiatan',
  subtitle = 'Jadwal peliputan, produksi siaran studio, dan koordinasi agenda kegiatan terpadu Progresif TV.',
  className = ''
}) => {
  return (
    <header className={`acara-kal-shared-header ${className}`.trim()}>
      <div className="acara-kal-header-info">
        <h1 className="acara-kal-header-title">{title}</h1>
        <p className="acara-kal-header-subtitle">{subtitle}</p>
      </div>

      <div className="acara-kal-header-nav-wrap">
        <AcaraKalenderNav />
      </div>
    </header>
  );
};

export default AcaraKalenderHeader;
