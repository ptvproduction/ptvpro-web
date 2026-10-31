import React from 'react';
import { FinanceSkeletonBase } from './FinanceSkeletonBase';

export const FinancePiutangSkeleton: React.FC = () => {
  return (
    <div className="fin-skel-root" role="status" aria-busy="true" aria-label="Memuat data piutang…">
      {/* 1. 4 Summary KPI Cards */}
      <div className="fin-skel-kpi-grid">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="fin-skel-kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <FinanceSkeletonBase width="95px" height="13px" radius="4px" />
              <FinanceSkeletonBase width="32px" height="32px" radius="10px" />
            </div>
            <div style={{ margin: '12px 0 6px' }}>
              <FinanceSkeletonBase width="140px" height="24px" radius="4px" />
            </div>
            <FinanceSkeletonBase width="90px" height="12px" radius="4px" />
          </div>
        ))}
      </div>

      {/* 2. Search & Filter Toolbar */}
      <div className="fin-skel-toolbar">
        <FinanceSkeletonBase width="240px" height="38px" radius="10px" style={{ flexGrow: 1, maxWidth: '350px' }} />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Borrower Type Pills */}
          <FinanceSkeletonBase width="70px" height="32px" radius="9999px" />
          <FinanceSkeletonBase width="65px" height="32px" radius="9999px" />
          <FinanceSkeletonBase width="85px" height="32px" radius="9999px" />
          {/* Status Pills */}
          <FinanceSkeletonBase width="60px" height="32px" radius="9999px" />
          <FinanceSkeletonBase width="65px" height="32px" radius="9999px" />
          <FinanceSkeletonBase width="80px" height="32px" radius="9999px" />
          <FinanceSkeletonBase width="135px" height="38px" radius="9999px" style={{ marginLeft: '6px' }} />
        </div>
      </div>

      {/* 3. Piutang Table (Desktop) */}
      <div className="fin-skel-table-card desktop-only">
        {/* Table Header */}
        <div className="fin-skel-table-header">
          <FinanceSkeletonBase width="160px" height="13px" radius="4px" />
          <FinanceSkeletonBase width="120px" height="13px" radius="4px" />
          <FinanceSkeletonBase width="100px" height="13px" radius="4px" />
          <FinanceSkeletonBase width="100px" height="13px" radius="4px" />
          <FinanceSkeletonBase width="140px" height="13px" radius="4px" />
          <FinanceSkeletonBase width="90px" height="13px" radius="4px" />
          <FinanceSkeletonBase width="75px" height="13px" radius="4px" />
          <div style={{ marginLeft: 'auto' }}>
            <FinanceSkeletonBase width="60px" height="13px" radius="4px" />
          </div>
        </div>

        {/* 5 Loan Rows */}
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="fin-skel-table-row">
            {/* Peminjam */}
            <div style={{ width: '160px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FinanceSkeletonBase width="34px" height="34px" radius="50%" style={{ flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                <FinanceSkeletonBase width="90%" height="14px" radius="4px" />
                <FinanceSkeletonBase width="60px" height="11px" radius="3px" />
              </div>
            </div>

            {/* Kontak & Tipe */}
            <div style={{ width: '120px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <FinanceSkeletonBase width="85px" height="12px" radius="4px" />
              <FinanceSkeletonBase width="55px" height="18px" radius="9999px" />
            </div>

            {/* Pokok Pinjaman */}
            <FinanceSkeletonBase width="100px" height="15px" radius="4px" />

            {/* Total Tagihan */}
            <FinanceSkeletonBase width="100px" height="15px" radius="4px" />

            {/* Sisa & Progress Bar */}
            <div style={{ width: '140px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <FinanceSkeletonBase width="90px" height="14px" radius="4px" />
              <FinanceSkeletonBase width="100%" height="6px" radius="9999px" />
            </div>

            {/* Jatuh Tempo */}
            <FinanceSkeletonBase width="90px" height="14px" radius="4px" />

            {/* Status Pill */}
            <FinanceSkeletonBase width="75px" height="22px" radius="9999px" />

            {/* Actions */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
              <FinanceSkeletonBase width="60px" height="28px" radius="9999px" />
            </div>
          </div>
        ))}
      </div>

      {/* 4. Mobile Cards View */}
      <div className="fin-skel-mobile-cards">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="fin-skel-mobile-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FinanceSkeletonBase width="32px" height="32px" radius="50%" />
                <FinanceSkeletonBase width="120px" height="15px" radius="4px" />
              </div>
              <FinanceSkeletonBase width="65px" height="20px" radius="9999px" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              <FinanceSkeletonBase width="90px" height="12px" radius="4px" />
              <FinanceSkeletonBase width="100px" height="15px" radius="4px" />
            </div>
            <FinanceSkeletonBase width="100%" height="6px" radius="9999px" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <FinanceSkeletonBase width="80px" height="12px" radius="4px" />
              <FinanceSkeletonBase width="75px" height="28px" radius="9999px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
