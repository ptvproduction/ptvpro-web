import React from 'react';
import { FinanceSkeletonBase } from './FinanceSkeletonBase';

export const FinanceTransactionSkeleton: React.FC = () => {
  return (
    <div className="fin-skel-root" role="status" aria-busy="true" aria-label="Memuat data transaksi…">
      {/* 1. Quick Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <FinanceSkeletonBase width="150px" height="38px" radius="9999px" />
        <FinanceSkeletonBase width="155px" height="38px" radius="9999px" />
        <FinanceSkeletonBase width="140px" height="38px" radius="9999px" />
      </div>

      {/* 2. Filter & Search Toolbar */}
      <div className="fin-skel-toolbar">
        <FinanceSkeletonBase width="260px" height="38px" radius="10px" style={{ flexGrow: 1, maxWidth: '400px' }} />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <FinanceSkeletonBase width="75px" height="34px" radius="9999px" />
          <FinanceSkeletonBase width="95px" height="34px" radius="9999px" />
          <FinanceSkeletonBase width="105px" height="34px" radius="9999px" />
          <FinanceSkeletonBase width="85px" height="34px" radius="9999px" />
        </div>
      </div>

      {/* 3. Month Section Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 18px',
          background: 'var(--surface, #ffffff)',
          border: '1px solid var(--line-2, rgba(11, 42, 74, 0.08))',
          borderRadius: 'var(--fin-card-radius, 18px)',
          marginTop: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FinanceSkeletonBase width="32px" height="32px" radius="8px" />
          <div>
            <FinanceSkeletonBase width="130px" height="16px" radius="4px" />
            <div style={{ marginTop: '4px' }}>
              <FinanceSkeletonBase width="90px" height="12px" radius="4px" />
            </div>
          </div>
        </div>
        <FinanceSkeletonBase width="140px" height="28px" radius="9999px" />
      </div>

      {/* 4. Desktop Table View (7 Columns) */}
      <div className="fin-skel-table-card desktop-only">
        {/* Table Header */}
        <div className="fin-skel-table-header">
          <FinanceSkeletonBase width="85px" height="13px" radius="4px" />
          <FinanceSkeletonBase width="200px" height="13px" radius="4px" />
          <div style={{ width: '45px', textAlign: 'center' }}>
            <FinanceSkeletonBase width="32px" height="13px" radius="4px" />
          </div>
          <FinanceSkeletonBase width="110px" height="13px" radius="4px" />
          <FinanceSkeletonBase width="140px" height="13px" radius="4px" />
          <FinanceSkeletonBase width="100px" height="13px" radius="4px" />
          <div style={{ marginLeft: 'auto' }}>
            <FinanceSkeletonBase width="45px" height="13px" radius="4px" />
          </div>
        </div>

        {/* 6 Table Rows */}
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="fin-skel-table-row">
            {/* Tanggal */}
            <FinanceSkeletonBase width="85px" height="14px" radius="4px" />
            {/* Keperluan & Kategori */}
            <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <FinanceSkeletonBase width="90%" height="15px" radius="4px" />
              <FinanceSkeletonBase width="70px" height="18px" radius="9999px" />
            </div>
            {/* Bukti Thumbnail */}
            <div style={{ width: '45px', display: 'flex', justifyContent: 'center' }}>
              <FinanceSkeletonBase width="34px" height="34px" radius="8px" />
            </div>
            {/* Nominal */}
            <FinanceSkeletonBase width="110px" height="16px" radius="4px" />
            {/* Keterangan */}
            <FinanceSkeletonBase width="140px" height="13px" radius="4px" />
            {/* Dicatat Oleh */}
            <FinanceSkeletonBase width="100px" height="13px" radius="4px" />
            {/* Aksi */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
              <FinanceSkeletonBase width="28px" height="28px" radius="6px" />
              <FinanceSkeletonBase width="28px" height="28px" radius="6px" />
            </div>
          </div>
        ))}
      </div>

      {/* 5. Mobile Cards View (Reflows on mobile / iPhone) */}
      <div className="fin-skel-mobile-cards">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="fin-skel-mobile-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <FinanceSkeletonBase width="75px" height="13px" radius="4px" />
              <FinanceSkeletonBase width="65px" height="18px" radius="9999px" />
            </div>
            <FinanceSkeletonBase width="80%" height="16px" radius="4px" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <FinanceSkeletonBase width="110px" height="18px" radius="4px" />
              <FinanceSkeletonBase width="32px" height="32px" radius="8px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
