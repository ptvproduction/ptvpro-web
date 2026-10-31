import React from 'react';
import { FinanceSkeletonBase } from './FinanceSkeletonBase';

export const FinanceLaporanSkeleton: React.FC = () => {
  return (
    <div className="fin-skel-root" role="status" aria-busy="true" aria-label="Memuat laporan keuangan…">
      {/* 1. Filter Panel */}
      <div className="fin-skel-surface">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <FinanceSkeletonBase width="150px" height="18px" radius="4px" />
            <div style={{ marginTop: '4px' }}>
              <FinanceSkeletonBase width="210px" height="12px" radius="4px" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <FinanceSkeletonBase width="115px" height="34px" radius="9999px" />
            <FinanceSkeletonBase width="115px" height="34px" radius="9999px" />
          </div>
        </div>

        {/* Date presets pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <FinanceSkeletonBase width="70px" height="28px" radius="9999px" />
          <FinanceSkeletonBase width="85px" height="28px" radius="9999px" />
          <FinanceSkeletonBase width="105px" height="28px" radius="9999px" />
          <FinanceSkeletonBase width="100px" height="28px" radius="9999px" />
          <FinanceSkeletonBase width="85px" height="28px" radius="9999px" />
        </div>

        {/* Dropdowns row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
          <FinanceSkeletonBase width="100%" height="36px" radius="8px" />
          <FinanceSkeletonBase width="100%" height="36px" radius="8px" />
          <FinanceSkeletonBase width="100%" height="36px" radius="8px" />
          <FinanceSkeletonBase width="100%" height="36px" radius="8px" />
        </div>
      </div>

      {/* 2. Executive Summary Cards (4 stats) */}
      <div className="fin-skel-kpi-grid">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="fin-skel-kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <FinanceSkeletonBase width="90px" height="13px" radius="4px" />
              <FinanceSkeletonBase width="30px" height="30px" radius="8px" />
            </div>
            <div style={{ margin: '14px 0 6px' }}>
              <FinanceSkeletonBase width="135px" height="24px" radius="4px" />
            </div>
            <FinanceSkeletonBase width="80px" height="12px" radius="4px" />
          </div>
        ))}
      </div>

      {/* 3. Visual Breakdown Section */}
      <div className="fin-skel-surface">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <FinanceSkeletonBase width="160px" height="16px" radius="4px" />
          <FinanceSkeletonBase width="85px" height="14px" radius="4px" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <FinanceSkeletonBase width="120px" height="14px" radius="4px" />
              <FinanceSkeletonBase width="80px" height="14px" radius="4px" />
            </div>
            <FinanceSkeletonBase width="100%" height="10px" radius="9999px" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <FinanceSkeletonBase width="120px" height="14px" radius="4px" />
              <FinanceSkeletonBase width="80px" height="14px" radius="4px" />
            </div>
            <FinanceSkeletonBase width="100%" height="10px" radius="9999px" />
          </div>
        </div>
      </div>

      {/* 4. Detailed Report Ledger Table */}
      <div className="fin-skel-table-card">
        <div className="fin-skel-table-header">
          <FinanceSkeletonBase width="85px" height="13px" radius="4px" />
          <FinanceSkeletonBase width="220px" height="13px" radius="4px" />
          <FinanceSkeletonBase width="110px" height="13px" radius="4px" />
          <FinanceSkeletonBase width="110px" height="13px" radius="4px" />
          <FinanceSkeletonBase width="100px" height="13px" radius="4px" />
          <FinanceSkeletonBase width="100px" height="13px" radius="4px" />
          <div style={{ marginLeft: 'auto' }}>
            <FinanceSkeletonBase width="100px" height="13px" radius="4px" />
          </div>
        </div>

        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="fin-skel-table-row">
            <FinanceSkeletonBase width="85px" height="14px" radius="4px" />
            <FinanceSkeletonBase width="220px" height="15px" radius="4px" />
            <FinanceSkeletonBase width="110px" height="18px" radius="9999px" />
            <FinanceSkeletonBase width="110px" height="14px" radius="4px" />
            <FinanceSkeletonBase width="100px" height="15px" radius="4px" />
            <FinanceSkeletonBase width="100px" height="15px" radius="4px" />
            <div style={{ marginLeft: 'auto' }}>
              <FinanceSkeletonBase width="100px" height="15px" radius="4px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
