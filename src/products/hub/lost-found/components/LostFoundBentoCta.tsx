import React from 'react';
import { LostFoundType } from '../types';

interface LostFoundBentoCtaProps {
  onOpenForm: (type: LostFoundType) => void;
}

export const LostFoundBentoCta: React.FC<LostFoundBentoCtaProps> = ({ onOpenForm }) => {
  return (
    <div className="lf-bento-grid">
      <div
        className="lf-bento-card lf-bento-lost"
        onClick={() => onOpenForm('hilang')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenForm('hilang');
          }
        }}
      >
        <div className="lf-bento-icon lf-bento-icon-lost">
          <i className="fa-solid fa-magnifying-glass-location" aria-hidden="true" />
        </div>
        <div className="lf-bento-content">
          <h3 className="lf-bento-title">Saya Kehilangan Barang</h3>
          <p className="lf-bento-desc">
            Buat laporan kehilangan barang atau perlengkapan kru
          </p>
        </div>
      </div>

      <div
        className="lf-bento-card lf-bento-found"
        onClick={() => onOpenForm('temuan')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenForm('temuan');
          }
        }}
      >
        <div className="lf-bento-icon lf-bento-icon-found">
          <i className="fa-solid fa-box-archive" aria-hidden="true" />
        </div>
        <div className="lf-bento-content">
          <h3 className="lf-bento-title">Saya Menemukan Barang</h3>
          <p className="lf-bento-desc">
            Laporkan barang temuan tanpa pemilik di area kerja
          </p>
        </div>
      </div>
    </div>
  );
};
