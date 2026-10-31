import React from "react";
import {
  Wrench,
  Camera,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { DamageReportItem } from "../types";

interface DamageReportCardProps {
  item: DamageReportItem;
  onClick: (item: DamageReportItem) => void;
}

export const DamageReportCard: React.FC<DamageReportCardProps> = ({ item, onClick }) => {
  // 1. Status Styling & Icon
  const getStatusConfig = () => {
    switch (item.status) {
      case "Baru":
        return {
          className: "status-baru",
          icon: <Clock size={11} />,
          label: "Baru",
        };
      case "Sedang Dicek":
        return {
          className: "status-sedang-dicek",
          icon: <Wrench size={11} />,
          label: "Sedang Dicek",
        };
      case "Dalam Perbaikan":
        return {
          className: "status-dalam-perbaikan",
          icon: <Wrench size={11} />,
          label: "Dalam Perbaikan",
        };
      case "Selesai":
        return {
          className: "status-selesai",
          icon: <CheckCircle2 size={11} />,
          label: "Selesai",
        };
      case "Rusak Total":
        return {
          className: "status-rusak-total",
          icon: <XCircle size={11} />,
          label: "Rusak Total",
        };
      default:
        return {
          className: "status-baru",
          icon: <HelpCircle size={11} />,
          label: item.status,
        };
    }
  };

  const statusCfg = getStatusConfig();

  // 2. Format Relative Day / Date
  const formatRelDay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return "Hari ini";
      if (diffDays === 1) return "Kemarin";
      if (diffDays < 7) return `${diffDays}h lalu`;
      return `${d.getDate()}/${d.getMonth() + 1}`;
    } catch {
      return dateStr.split("T")[0];
    }
  };

  const reporterFirstWord = item.reporterName.trim().split(" ")[0] || "Kru";
  const reporterInitial = reporterFirstWord.charAt(0).toUpperCase();

  // Display unit label
  const unitLabel = item.unitCode || `Unit ${String(item.unitNumber).padStart(2, "0")}`;

  return (
    <div
      className="damage-shopee-card"
      data-damage={item.id}
      role="button"
      tabIndex={0}
      onClick={() => onClick(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(item);
        }
      }}
    >
      {/* Top Square Image Area (Shopee style 1:1) */}
      <div className="damage-shopee-img-wrap">
        {item.photoUrl ? (
          <img
            src={item.photoUrl}
            alt={item.assetName}
            loading="lazy"
          />
        ) : (
          <div className="damage-shopee-fallback-icon">
            <Wrench size={32} />
          </div>
        )}

        {/* Floating Photo Evidence Indicator (bottom-right) */}
        {item.photoUrl && (
          <div
            className="damage-shopee-badge-photo"
            title="Tersedia foto bukti fisik kerusakan"
          >
            <Camera size={11} />
            <span>Foto</span>
          </div>
        )}
      </div>

      {/* Card Body / Info (Shopee item details) */}
      <div className="damage-shopee-body">
        {/* Non-overlapping Status & Unit Code Metadata Row (R03) */}
        <div className="damage-shopee-meta-top">
          <div className={`damage-shopee-badge-status ${statusCfg.className}`}>
            {statusCfg.icon}
            <span>{statusCfg.label}</span>
          </div>

          {unitLabel && (
            <div
              className="damage-shopee-badge-unit"
              title={`Unit Fisik: ${unitLabel}`}
            >
              <span>{unitLabel}</span>
            </div>
          )}
        </div>

        <div className="damage-shopee-title" title={item.assetName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.assetName}</span>
          {item.is_historical && (
            <span className="damage-shopee-badge-hist">
              Arsip Historis
            </span>
          )}
        </div>

        <div className="damage-shopee-issue" title={item.title}>
          <AlertTriangle size={12} style={{ flexShrink: 0 }} />
          <span>{item.title}</span>
        </div>

        {item.description && (
          <div className="damage-shopee-desc" title={item.description}>
            {item.description}
          </div>
        )}

        {/* Footer (Reporter & QC indicator) */}
        <div className="damage-shopee-footer">
          <div
            className="damage-shopee-reporter"
            title={`Dilaporkan oleh ${item.reporterName} • ${formatRelDay(item.reportedAt)}`}
          >
            <div className="damage-shopee-avatar">
              {reporterInitial}
            </div>
            <span>{reporterFirstWord}</span>
            <span style={{ opacity: 0.6 }}>&bull;</span>
            <span style={{ opacity: 0.85 }}>{formatRelDay(item.reportedAt)}</span>
          </div>

          <div className="damage-shopee-qc">
            {item.qcBy ? (
              <span
                className="damage-qc-indicator is-done"
                title={`Sudah di-QC oleh ${item.qcBy}`}
              >
                <CheckCircle2 size={11} />
                QC
              </span>
            ) : item.status !== "Selesai" ? (
              <span
                className="damage-qc-indicator is-pending"
                title="Menunggu QC teknisi studio"
              >
                <Clock size={11} />
                Cek
              </span>
            ) : (
              <span
                className="damage-qc-indicator is-ready"
                title="Peralatan normal siap pakai"
              >
                <CheckCircle2 size={11} />
                Siap
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

