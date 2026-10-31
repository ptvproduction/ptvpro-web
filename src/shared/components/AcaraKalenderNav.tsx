/**
 * PTV PRO — Shared Acara & Kalender Segmented Navigation
 * Komponen navigasi bersama subview Acara (Daftar Acara) & Kalender
 * Sesuai panduan PTV Design System R03 & W3C Route Navigation Accessibility
 */

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { List, CalendarDays } from 'lucide-react';
import '@/styles/acaraKalenderNav.css';

export interface AcaraKalenderNavProps {
  className?: string;
}

export const AcaraKalenderNav: React.FC<AcaraKalenderNavProps> = ({ className = '' }) => {
  const location = useLocation();
  const isKalender = location.pathname.startsWith('/hub/kalender');

  return (
    <nav
      className={`acara-kal-nav ${className}`.trim()}
      aria-label="Navigasi Tampilan Agenda Acara dan Kalender"
    >
      {/* Sliding active indicator with smooth animation */}
      <div
        className="acara-kal-nav-indicator"
        style={{
          transform: isKalender ? 'translateX(100%)' : 'translateX(0%)'
        }}
        aria-hidden="true"
      />

      <NavLink
        to="/hub/acara"
        className={({ isActive }) =>
          `acara-kal-nav-link ${isActive && !isKalender ? 'active' : ''}`
        }
        aria-current={!isKalender ? 'page' : undefined}
      >
        <List size={14} className="acara-kal-nav-icon" />
        <span>Daftar Acara</span>
      </NavLink>

      <NavLink
        to="/hub/kalender"
        className={({ isActive }) =>
          `acara-kal-nav-link ${isActive || isKalender ? 'active' : ''}`
        }
        aria-current={isKalender ? 'page' : undefined}
      >
        <CalendarDays size={14} className="acara-kal-nav-icon" />
        <span>Kalender</span>
      </NavLink>
    </nav>
  );
};

export { AcaraKalenderHeader } from './AcaraKalenderHeader';
