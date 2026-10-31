import React from 'react';
import { LostFoundFilterTab } from '../types';
import { Search, X } from 'lucide-react';

interface LostFoundFilterBarProps {
  activeTab: LostFoundFilterTab;
  onTabChange: (tab: LostFoundFilterTab) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  counts: {
    semua: number;
    dicari: number;
    ditemukan: number;
    dikembalikan: number;
  };
}

export const LostFoundFilterBar: React.FC<LostFoundFilterBarProps> = ({
  activeTab,
  onTabChange,
  searchQuery = '',
  onSearchChange,
  counts,
}) => {
  const tabs: { key: LostFoundFilterTab; label: string; count: number }[] = [
    { key: 'Semua', label: 'Semua', count: counts.semua },
    { key: 'Dicari', label: 'Dicari', count: counts.dicari },
    { key: 'Ditemukan', label: 'Ditemukan', count: counts.ditemukan },
    { key: 'Dikembalikan', label: 'Dikembalikan', count: counts.dikembalikan },
  ];

  return (
    <div className="lf-toolbar">
      {onSearchChange && (
        <div className="lf-search-box">
          <Search className="lf-search-icon" size={14} />
          <input
            type="text"
            className="lf-search-input"
            placeholder="Cari nama barang, kategori, lokasi, atau pelapor..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Cari laporan barang hilang atau temuan"
          />
          {searchQuery && (
            <button
              type="button"
              className="lf-search-clear"
              onClick={() => onSearchChange('')}
              aria-label="Hapus pencarian"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      <div className="lf-segmented-nav" role="tablist" aria-label="Filter status laporan">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`lf-segmented-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => onTabChange(tab.key)}
          >
            <span>{tab.label}</span>
            <span className="lf-count-pill">{tab.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
