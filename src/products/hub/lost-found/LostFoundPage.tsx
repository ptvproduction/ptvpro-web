import React, { useState, useMemo } from "react";
import { useLostFound, LostFoundProvider } from "./LostFoundContext";
import { LostFoundType, LostFoundItem } from "./types";
import { LostFoundBentoCta } from "./components/LostFoundBentoCta";
import { LostFoundFilterBar } from "./components/LostFoundFilterBar";
import { LostFoundCard } from "./components/LostFoundCard";
import { LostFoundModalForm } from "./components/LostFoundModalForm";
import { LostFoundDetailDrawer } from "./components/LostFoundDetailDrawer";
import { Inbox } from "lucide-react";
import { useSessionStore } from '@core/session';
import { InventoryGridSkeleton } from '@/shared/components';
import "@/styles/lostFound.css";

const LostFoundInner: React.FC = () => {
  const can = useSessionStore((state) => state.can);
  const {
    items,
    loading,
    error,
    refreshItems,
    filterTab,
    setFilterTab,
    searchQuery,
    setSearchQuery,
    addItem,
    updateStatus,
    deleteItem,
  } = useLostFound();

  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<LostFoundType>("hilang");
  const [selectedItem, setSelectedItem] = useState<LostFoundItem | null>(null);

  // Perhitungan count tepat berdasarkan status item
  const counts = useMemo(() => {
    return {
      semua: items.length,
      dicari: items.filter((it) => it.status === "Dicari").length,
      ditemukan: items.filter((it) => it.status === "Ditemukan").length,
      dikembalikan: items.filter((it) => it.status === "Dikembalikan").length,
    };
  }, [items]);

  // Filter reaktif berdasarkan tab aktif dan search query (bila ada)
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (filterTab !== "Semua" && it.status !== filterTab) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = it.title.toLowerCase().includes(q);
        const matchLoc = it.location.toLowerCase().includes(q);
        const matchReporter = it.reporterName.toLowerCase().includes(q);
        const matchCat = it.category.toLowerCase().includes(q);
        if (!matchTitle && !matchLoc && !matchReporter && !matchCat) return false;
      }
      return true;
    });
  }, [items, filterTab, searchQuery]);

  const handleOpenForm = (type: LostFoundType) => {
    setFormType(type);
    setFormOpen(true);
  };

  return (
    <div className="lf-page-container">
      {/* Header Halaman Standar R03 */}
      <div className="ptv-page-header">
        <div className="ptv-page-header-main">
          <h1 className="ptv-page-title">Lost &amp; Found</h1>
          <p className="ptv-page-subtitle">
            Pusat pelaporan barang hilang, penemuan barang di area studio, dan koordinasi pengembalian kru.
          </p>
        </div>
      </div>

      {/* 1. Dua Kartu Aksi Compact (Saya Kehilangan Barang / Saya Menemukan Barang) */}
      <LostFoundBentoCta onOpenForm={handleOpenForm} />

      {/* 2. Filter Status Segmented (Semua, Dicari, Ditemukan, Dikembalikan) Rata Kiri */}
      <LostFoundFilterBar
        activeTab={filterTab}
        onTabChange={setFilterTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        counts={counts}
      />

      {/* 3. Daftar Laporan atau Empty State Minimalis R03 */}
      {loading && items.length === 0 ? (
        <InventoryGridSkeleton count={4} />
      ) : error ? (
        <div className="lf-empty-state" style={{ border: '1px solid #fecaca', background: '#fff5f5' }}>
          <p style={{ color: '#991b1b', fontWeight: 600, marginBottom: '8px' }}>{error}</p>
          <button
            type="button"
            onClick={() => refreshItems()}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              border: 'none',
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Coba Lagi
          </button>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="lf-items-grid">
          {filteredItems.map((item) => (
            <LostFoundCard
              key={item.id}
              item={item}
              onClick={(it) => setSelectedItem(it)}
            />
          ))}
        </div>
      ) : (
        <div className="lf-empty-state">
          <div className="lf-empty-icon-wrap">
            <Inbox size={20} className="lf-empty-icon" />
          </div>
          <p className="lf-empty-desc">
            {searchQuery
              ? `Tidak ditemukan laporan yang cocok dengan "${searchQuery}".`
              : 'Belum ada catatan barang hilang atau temuan di database.'}
          </p>
        </div>
      )}

      {/* Modal Laporan (Floating Dialog Card R03 + PTVSelect Dropdown) */}
      <LostFoundModalForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={addItem}
        initialType={formType}
      />

      {/* Drawer Detail Laporan & WhatsApp Action */}
      <LostFoundDetailDrawer
        isExecutive={can('lostfound.manage')}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onMarkDone={async (id) => {
          await updateStatus(id, "Dikembalikan");
          setSelectedItem((prev) => (prev && prev.id === id ? { ...prev, status: "Dikembalikan" } : prev));
        }}
        onDelete={async (id) => {
          await deleteItem(id);
          setSelectedItem(null);
        }}
      />
    </div>
  );
};

export const LostFoundPage: React.FC = () => {
  return (
    <LostFoundProvider>
      <LostFoundInner />
    </LostFoundProvider>
  );
};
