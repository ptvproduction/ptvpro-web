import React, { useState, useMemo } from "react";
import { useLocation } from 'react-router-dom';
import { useDamageReport, DamageReportProvider } from "./DamageReportContext";
import { DamageReportItem } from "./types";
import { DamageSummaryBar } from "./components/DamageSummaryBar";
import { DamageFilterBar } from "./components/DamageFilterBar";
import { DamageReportCard } from "./components/DamageReportCard";
import { DamageReportModal } from "./components/DamageReportModal";
import { DamageDetailModal } from "./components/DamageDetailModal";
import { Wrench, Plus } from "lucide-react";
import { useSessionStore } from '@core/session';
import { CardListSkeleton } from '@/shared/components';
import "./lapor-kerusakan.css";

const LaporKerusakanInner: React.FC = () => {
  const can = useSessionStore((state) => state.can);
  const {
    reports,
    loading,
    error,
    refreshReports,
    filterTab,
    setFilterTab,
    searchQuery,
    setSearchQuery,
    createReport,
    updateQCAction,
    deleteReport,
  } = useDamageReport();

  const location = useLocation();
  const preset = new URLSearchParams(location.search);
  const [isCreateOpen, setIsCreateOpen] = useState(Boolean(preset.get('asset')));
  const [selectedReport, setSelectedReport] = useState<DamageReportItem | null>(null);

  const counts = useMemo(() => {
    const baru = reports.filter((r) => r.status === "Baru").length;
    const sedangDicek = reports.filter(
      (r) => r.status === "Sedang Dicek" || r.status === "Dalam Perbaikan"
    ).length;
    const selesai = reports.filter((r) => r.status === "Selesai").length;
    const rusakTotal = reports.filter((r) => r.status === "Rusak Total").length;
    const aktif = reports.filter((r) => r.status !== "Selesai").length;

    return {
      total: reports.length,
      semua: reports.length,
      baru,
      sedangDicek,
      selesai,
      rusakTotal,
      aktif,
      perluTindakan: baru + sedangDicek,
      dalamProses: sedangDicek,
    };
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((item) => {
      // 1. Tab Filtering (Legacy Support + Backward Compat)
      if (filterTab === "Baru" && item.status !== "Baru") return false;
      if (
        filterTab === "Sedang Dicek" &&
        item.status !== "Sedang Dicek" &&
        item.status !== "Dalam Perbaikan"
      )
        return false;
      if (filterTab === "Selesai" && item.status !== "Selesai") return false;
      if (filterTab === "Rusak Total" && item.status !== "Rusak Total") return false;
      if (
        filterTab === "Perlu Tindakan" &&
        item.status !== "Baru" &&
        item.status !== "Sedang Dicek"
      )
        return false;
      if (
        filterTab === "Dalam Proses" &&
        item.status !== "Dalam Perbaikan" &&
        item.status !== "Sedang Dicek"
      )
        return false;

      // 2. Search Query Filtering
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAsset = item.assetName.toLowerCase().includes(q);
        const matchUnit = item.unitCode.toLowerCase().includes(q);
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchReporter = item.reporterName.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        if (!matchAsset && !matchUnit && !matchTitle && !matchReporter && !matchDesc) {
          return false;
        }
      }
      return true;
    });
  }, [reports, filterTab, searchQuery]);

  return (
    <div className="damage-page-wrap">
      {/* Header Halaman Standar R03 */}
      <div className="ptv-page-header">
        <div className="ptv-page-header-main">
          <h1 className="ptv-page-title">Laporan Kerusakan</h1>
          <p className="ptv-page-subtitle">
            Pelaporan kendala teknis, pemeriksaan QC, dan pemantauan perbaikan unit inventaris produksi.
          </p>
        </div>
      </div>

      {/* 1. Toolbar: Search, Filters, & CTA Button (PHP Legacy Fidelity) */}
      <DamageFilterBar
        activeTab={filterTab}
        onTabChange={setFilterTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenCreate={() => setIsCreateOpen(true)}
        counts={counts}
      />

      {/* 2. Inline Summary Statistics Bar (PHP Legacy Fidelity) */}
      <DamageSummaryBar counts={counts} />

      {/* 3. Daftar Laporan Kerusakan (Shopee Grid Kotak) */}
      {loading && reports.length === 0 ? (
        <CardListSkeleton count={4} />
      ) : error ? (
        <div className="damage-empty-box" style={{ border: '1px solid #fecaca', background: '#fff5f5' }}>
          <p style={{ color: '#991b1b', fontWeight: 600, marginBottom: '8px' }}>{error}</p>
          <button
            type="button"
            className="damage-btn-cta"
            onClick={() => refreshReports()}
            style={{ background: '#ef4444' }}
          >
            <span>Coba Lagi</span>
          </button>
        </div>
      ) : filteredReports.length > 0 ? (
        <div className="damage-shopee-grid">
          {filteredReports.map((item) => (
            <DamageReportCard
              key={item.id}
              item={item}
              onClick={(rep) => setSelectedReport(rep)}
            />
          ))}
        </div>
      ) : (
        /* 4. Empty State (PHP Legacy Style) */
        <div className="damage-empty-box">
          <div className="damage-empty-icon">
            <Wrench size={20} />
          </div>
          <p className="damage-empty-text">
            {searchQuery
              ? `Tidak ditemukan laporan yang cocok dengan "${searchQuery}".`
              : "Tidak ada catatan laporan kerusakan pada filter ini."}
          </p>
          <button
            type="button"
            className="damage-btn-cta"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus size={14} />
            <span>Lapor Kerusakan Baru</span>
          </button>
        </div>
      )}

      {/* 5. Modal Tambah Laporan Kerusakan (R03 Floating Dialog) */}
      <DamageReportModal
        isOpen={isCreateOpen}
        initialAssetId={preset.get('asset') || undefined}
        initialUnitId={preset.get('unit') || undefined}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={createReport}
      />

      {/* 6. Modal Detail & Quality Check (R03 Floating Dialog) */}
      <DamageDetailModal
        isExecutive={can('damage.qc.approve')}
        item={selectedReport}
        onClose={() => setSelectedReport(null)}
        onUpdateQC={async (id, qcStatus, qcNotes) => {
          await updateQCAction(id, qcStatus, qcNotes);
          setSelectedReport((prev) =>
            prev && prev.id === id
              ? { ...prev, status: qcStatus, qcNotes, qcLocked: qcStatus === "Selesai" }
              : prev
          );
        }}
        onDelete={async (id) => {
          await deleteReport(id);
          setSelectedReport(null);
        }}
      />
    </div>
  );
};

export const LaporKerusakanPage: React.FC = () => {
  return (
    <DamageReportProvider>
      <LaporKerusakanInner />
    </DamageReportProvider>
  );
};

