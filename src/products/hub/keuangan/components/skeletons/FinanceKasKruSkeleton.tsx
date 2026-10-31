import React from 'react';
import { FinanceSkeletonBase } from './FinanceSkeletonBase';

export const FinanceKasKruSkeleton: React.FC = () => {
  return (
    <div className="fin-skel-root" role="status" aria-busy="true" aria-label="Memuat data kas kru…">
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
            <FinanceSkeletonBase width="85px" height="12px" radius="4px" />
          </div>
        ))}
      </div>

      {/* 2. Semester & Filter Toolbar */}
      <div className="fin-skel-toolbar">
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Semester Selector */}
          <FinanceSkeletonBase width="210px" height="38px" radius="10px" />
          {/* Search Input */}
          <FinanceSkeletonBase width="220px" height="38px" radius="10px" />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <FinanceSkeletonBase width="65px" height="32px" radius="9999px" />
          <FinanceSkeletonBase width="75px" height="32px" radius="9999px" />
          <FinanceSkeletonBase width="75px" height="32px" radius="9999px" />
          <FinanceSkeletonBase width="90px" height="32px" radius="9999px" />
          <FinanceSkeletonBase width="140px" height="38px" radius="9999px" style={{ marginLeft: '6px' }} />
        </div>
      </div>

      {/* 3. Kas Kru Matrix Table (Desktop) */}
      <div className="fin-skel-table-card desktop-only">
        {/* Table Header with 6 Month Columns */}
        <div className="fin-skel-table-header" style={{ display: 'grid', gridTemplateColumns: '220px repeat(6, 1fr) 100px 80px', gap: '8px' }}>
          <FinanceSkeletonBase width="100px" height="13px" radius="4px" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
              <FinanceSkeletonBase width="55px" height="13px" radius="4px" />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <FinanceSkeletonBase width="60px" height="13px" radius="4px" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <FinanceSkeletonBase width="45px" height="13px" radius="4px" />
          </div>
        </div>

        {/* 6 Matrix Rows */}
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="fin-skel-table-row"
            style={{ display: 'grid', gridTemplateColumns: '220px repeat(6, 1fr) 100px 80px', gap: '8px' }}
          >
            {/* Kru: Avatar + Name + PTV-ID */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FinanceSkeletonBase width="34px" height="34px" radius="50%" style={{ flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                <FinanceSkeletonBase width="85%" height="14px" radius="4px" />
                <FinanceSkeletonBase width="55px" height="11px" radius="3px" />
              </div>
            </div>

            {/* 6 Month Period Cells */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <FinanceSkeletonBase width="45px" height="22px" radius="9999px" />
              </div>
            ))}

            {/* Status Summary Cell */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <FinanceSkeletonBase width="70px" height="20px" radius="9999px" />
            </div>

            {/* Action Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              <FinanceSkeletonBase width="60px" height="28px" radius="9999px" />
            </div>
          </div>
        ))}
      </div>

      {/* 4. Mobile Cards View */}
      <div className="fin-skel-mobile-cards">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="fin-skel-mobile-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FinanceSkeletonBase width="36px" height="36px" radius="50%" />
              <div style={{ flex: 1 }}>
                <FinanceSkeletonBase width="70%" height="15px" radius="4px" />
                <div style={{ marginTop: '4px' }}>
                  <FinanceSkeletonBase width="60px" height="12px" radius="3px" />
                </div>
              </div>
              <FinanceSkeletonBase width="65px" height="22px" radius="9999px" />
            </div>
            {/* 6 months pill grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', margin: '6px 0' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <FinanceSkeletonBase key={i} width="100%" height="22px" radius="6px" />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <FinanceSkeletonBase width="90px" height="14px" radius="4px" />
              <FinanceSkeletonBase width="80px" height="30px" radius="9999px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
