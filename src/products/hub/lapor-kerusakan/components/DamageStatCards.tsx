import React from "react";
import { DamageSummaryBar, DamageSummaryCounts } from "./DamageSummaryBar";

interface DamageStatCardsProps {
  counts: {
    total: number;
    baru: number;
    dalamProses?: number;
    sedangDicek?: number;
    selesai: number;
    rusakTotal?: number;
    aktif?: number;
  };
}

export const DamageStatCards: React.FC<DamageStatCardsProps> = ({ counts }) => {
  const summaryCounts: DamageSummaryCounts = {
    total: counts.total,
    baru: counts.baru,
    sedangDicek: counts.sedangDicek ?? counts.dalamProses ?? 0,
    dalamPerbaikan: counts.dalamProses ?? 0,
    selesai: counts.selesai,
    rusakTotal: counts.rusakTotal ?? 0,
    aktif: counts.aktif ?? (counts.baru + (counts.sedangDicek ?? counts.dalamProses ?? 0)),
  };

  return <DamageSummaryBar counts={summaryCounts} />;
};

