import React from 'react';
import { MapPin, Calendar, User, ArrowRight, Search, Sparkles } from 'lucide-react';
import { LostFoundItem } from '../types';

interface LostFoundCardProps {
  item: LostFoundItem;
  onClick: (item: LostFoundItem) => void;
}

export const LostFoundCard: React.FC<LostFoundCardProps> = ({ item, onClick }) => {
  const [imgError, setImgError] = React.useState(false);
  const isHilang = item.type === 'hilang';
  const isDone = item.status === 'Dikembalikan';

  const formatRelDate = (dateStr: string) => {
    try {
      const target = new Date(dateStr);
      const now = new Date();
      const diffDays = Math.round((now.getTime() - target.getTime()) / (1000 * 3600 * 24));
      if (diffDays === 0) return 'Hari ini';
      if (diffDays === 1) return 'Kemarin';
      if (diffDays > 1 && diffDays < 7) return `${diffDays} hari lalu`;
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const hasPhoto = Boolean(item.photoUrl && !imgError);

  return (
    <div
      className={`lf-card ${isDone ? 'lf-card-done' : ''}`}
      onClick={() => onClick(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(item);
        }
      }}
    >
      <div className="lf-card-thumb-wrapper">
        {hasPhoto ? (
          <img
            src={item.photoUrl}
            alt={item.title}
            className="lf-card-thumb"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className={`lf-card-thumb-placeholder ${isHilang ? 'lost' : 'found'}`}>
            {isHilang ? <Search size={28} /> : <Sparkles size={28} />}
          </div>
        )}
        <span className={`lf-status-badge ${isDone ? 'done' : isHilang ? 'lost' : 'found'}`}>
          {item.status}
        </span>
      </div>

      <div className="lf-card-body">
        <div className="lf-card-meta-top">
          <span className="lf-type-pill">{isHilang ? 'Kehilangan' : 'Temuan'}</span>
          <span className="lf-category-text">{item.category}</span>
        </div>

        <h4 className="lf-card-title" title={item.title}>
          {item.title}
        </h4>

        <div className="lf-card-details">
          <div className="lf-card-detail-row">
            <MapPin size={13} className="lf-icon-muted" />
            <span className="lf-truncate">{item.location}</span>
          </div>
          <div className="lf-card-detail-row">
            <Calendar size={13} className="lf-icon-muted" />
            <span>{formatRelDate(item.date)}</span>
          </div>
          <div className="lf-card-detail-row">
            <User size={13} className="lf-icon-muted" />
            <span className="lf-truncate">Pelapor: {item.reporterName}</span>
          </div>
        </div>

        <div className="lf-card-footer">
          <span className="lf-view-detail">
            Lihat Detail & Hubungi <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </div>
  );
};
