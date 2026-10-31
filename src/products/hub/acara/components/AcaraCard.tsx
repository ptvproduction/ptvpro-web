/**
 * PTV PRO — Modul Acara
 * Komponen Baris Agenda Acara (Compact Agenda Card)
 * Porting dari render card legacy page-dasbor.php L15456–15468
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AcaraItem } from '../types';
import { formatHumanDateIndo, getHijriInfo } from '../utils/acaraDateUtils';
import { getAcaraStatusInfo } from '../utils/acaraStatusUtils';
import { Calendar, MapPin, Clock } from 'lucide-react';
import { acaraColorStyle } from '../utils/acaraColors';
import '@/styles/acara.css';

interface AcaraCardProps {
  event: AcaraItem;
  compact?: boolean;
}

export const AcaraCard: React.FC<AcaraCardProps> = ({ event, compact = false }) => {
  const navigate = useNavigate();
  const hijri = getHijriInfo(event.date);
  const statusInfo = getAcaraStatusInfo(event);

  const handleClick = () => {
    navigate(`/hub/acara/${event.id}`);
  };

  const isBatal = event.status === 'Batal' || event.status === 'Dibatalkan';
  const isSelesai = statusInfo.variant === 'ok';
  const statusBadge = (
    <span className={`acara-badge ${statusInfo.variant}`} style={{ fontWeight: 600 }}>
      {statusInfo.variant === 'ok' && '✓ '}{statusInfo.variant === 'dang' && '✕ '}{statusInfo.label}
    </span>
  );

  return (
    <div
      className={`acara-item-row${compact ? ' acara-item-compact' : ''}${isBatal ? ' status-batal' : ''}${isSelesai ? ' status-selesai' : ''}`}
      style={acaraColorStyle(event.display_color)}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`Buka detail acara ${event.name}`}
    >
      <div className="acara-item-left">
        <div className="acara-icon-box">
          <Calendar size={20} />
        </div>
        <div className="acara-item-body">
          <div className="acara-item-title" title={event.name}>
            {event.name}
          </div>
          <div className="acara-item-meta">
            <span className="acara-meta-date">{formatHumanDateIndo(event.date, true)}</span>
            {hijri.short && <span className="acara-badge-hijri">{hijri.short}</span>}
            <span className="acara-meta-sep">•</span>
            <span className="acara-meta-time" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={12} style={{ opacity: 0.7, flexShrink: 0 }} />
              <span>{event.time || '08:00 – Selesai'}</span>
            </span>
            <span className="acara-meta-sep">•</span>
            <span className="acara-meta-loc">
              <MapPin size={12} style={{ opacity: 0.7, flexShrink: 0 }} />
              <span className="acara-loc-text">{event.loc || 'Studio PTV'}</span>
            </span>
            {compact && <span className="acara-meta-badge">{statusBadge}</span>}
          </div>
        </div>
      </div>

      {!compact && <div className="acara-item-right">{statusBadge}</div>}
    </div>
  );
};
