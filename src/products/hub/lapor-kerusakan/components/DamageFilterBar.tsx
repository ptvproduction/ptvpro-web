import React from "react";
import { Search, Plus, X } from "lucide-react";
import { DamageFilterTab } from "../types";

export interface DamageFilterCounts {
  semua: number;
  baru?: number;
  sedangDicek?: number;
  selesai: number;
  rusakTotal?: number;
  perluTindakan?: number;
  dalamProses?: number;
}

interface DamageFilterBarProps {
  activeTab: DamageFilterTab;
  onTabChange: (tab: DamageFilterTab) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenCreate: () => void;
  counts: DamageFilterCounts;
}

export const DamageFilterBar: React.FC<DamageFilterBarProps> = ({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  onOpenCreate,
  counts,
}) => {
  // Legacy Tabs: Semua, Baru, Sedang Dicek, Selesai, Rusak Total
  const tabs: { key: DamageFilterTab; label: string; count: number }[] = [
    { key: "Semua", label: "Semua", count: counts.semua },
    { key: "Baru", label: "Baru", count: counts.baru ?? counts.perluTindakan ?? 0 },
    {
      key: "Sedang Dicek",
      label: "Sedang Dicek",
      count: counts.sedangDicek ?? counts.dalamProses ?? 0,
    },
    { key: "Selesai", label: "Selesai", count: counts.selesai },
    { key: "Rusak Total", label: "Rusak Total", count: counts.rusakTotal ?? 0 },
  ];

  return (
    <div className="damage-toolbar">
      {/* 1. Left Search Input with Clear Button */}
      <div className="damage-search-box">
        <Search className="damage-search-icon" size={14} />
        <input
          type="text"
          id="dmgSearchInput"
          placeholder="Cari alat, unit, pelapor, atau kendala kerusakan..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="damage-search-input"
        />
        {searchQuery.trim().length > 0 && (
          <button
            type="button"
            id="dmgSearchClearBtn"
            className="damage-search-clear"
            onClick={() => onSearchChange("")}
            title="Hapus pencarian"
            aria-label="Hapus pencarian"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* 2. Right Actions: Filter Chips & + Lapor Kerusakan */}
      <div className="damage-toolbar-actions">
        <div className="damage-filter-tabs" role="tablist">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`damage-fchip ${isActive ? "active" : ""}`}
                onClick={() => onTabChange(tab.key)}
              >
                <span>{tab.label}</span>
                <span className="cnt">{tab.count}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="damage-btn-cta"
          onClick={onOpenCreate}
        >
          <Plus size={14} />
          <span>Lapor Kerusakan</span>
        </button>
      </div>
    </div>
  );
};

