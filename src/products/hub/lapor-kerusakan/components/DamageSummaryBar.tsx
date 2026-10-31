import React from "react";
import { AlertTriangle, Bell, Wrench, CheckCircle2, RefreshCw } from "lucide-react";

export interface DamageSummaryCounts {
  total: number;
  baru: number;
  sedangDicek: number;
  dalamPerbaikan?: number;
  selesai: number;
  rusakTotal?: number;
  aktif: number;
}

interface DamageSummaryBarProps {
  counts: DamageSummaryCounts;
  isSyncing?: boolean;
}

export const DamageSummaryBar: React.FC<DamageSummaryBarProps> = ({
  counts,
  isSyncing = false,
}) => {
  const hasActive = counts.aktif > 0;

  return (
    <div className="damage-summary-bar">
      <span
        className={`damage-summary-item ${hasActive ? "is-active-warn" : ""}`}
        title={`${counts.aktif} laporan kerusakan masih aktif`}
      >
        <AlertTriangle
          size={14}
          style={{ color: hasActive ? "var(--warn, #d97706)" : "var(--ok, #10b981)", flexShrink: 0 }}
        />
        <span>
          <strong className="damage-summary-num">
            {counts.aktif}
          </strong>{" "}
          kendala aktif
        </span>
      </span>

      <span className="damage-summary-bullet">&bull;</span>

      <span
        className="damage-summary-item"
        title={`${counts.baru} laporan baru butuh penanganan`}
      >
        <Bell size={13} style={{ color: "var(--dang, #ef4444)", flexShrink: 0 }} />
        <span>
          <strong className="damage-summary-num">
            {counts.baru}
          </strong>{" "}
          butuh penanganan
        </span>
      </span>

      <span className="damage-summary-bullet">&bull;</span>

      <span
        className="damage-summary-item"
        title={`${counts.sedangDicek} unit sedang dicek atau diservis`}
      >
        <Wrench size={13} style={{ color: "var(--info, #2563eb)", flexShrink: 0 }} />
        <span>
          <strong className="damage-summary-num">
            {counts.sedangDicek}
          </strong>{" "}
          sedang dicek/servis
        </span>
      </span>

      <span className="damage-summary-bullet">&bull;</span>

      <span
        className="damage-summary-item"
        title={`${counts.selesai} unit selesai diperbaiki dan siap pakai`}
      >
        <CheckCircle2 size={13} style={{ color: "var(--ok, #10b981)", flexShrink: 0 }} />
        <span>
          <strong className="damage-summary-num">
            {counts.selesai}
          </strong>{" "}
          selesai diperbaiki
        </span>
      </span>

      <span className="damage-summary-sync" title="Status sinkronisasi data studio">
        {isSyncing ? (
          <>
            <RefreshCw size={11} className="animate-spin" /> Memperbarui...
          </>
        ) : (
          <>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--ok, #10b981)",
                display: "inline-block",
              }}
            />
            Tersinkron
          </>
        )}
      </span>
    </div>
  );
};
