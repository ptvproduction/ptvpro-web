import React from 'react';
import { FinanceSkeletonBase } from './FinanceSkeletonBase';

export const FinanceSettingsSkeleton: React.FC = () => {
  return (
    <div className="fin-skel-root" role="status" aria-busy="true" aria-label="Memuat pengaturan keuangan…">
      {/* 1. Sub-navigation Pills */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingBottom: '4px' }}>
        <FinanceSkeletonBase width="180px" height="34px" radius="9999px" />
        <FinanceSkeletonBase width="150px" height="34px" radius="9999px" />
        <FinanceSkeletonBase width="160px" height="34px" radius="9999px" />
        <FinanceSkeletonBase width="170px" height="34px" radius="9999px" />
      </div>

      {/* 2. Group 1: Iuran Bulanan & Semester */}
      <div className="fin-skel-surface">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <FinanceSkeletonBase width="210px" height="18px" radius="4px" />
            <div style={{ marginTop: '4px' }}>
              <FinanceSkeletonBase width="280px" height="12px" radius="4px" />
            </div>
          </div>
          <FinanceSkeletonBase width="130px" height="34px" radius="9999px" />
        </div>

        {/* Inputs row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
          <div>
            <FinanceSkeletonBase width="120px" height="13px" radius="4px" style={{ marginBottom: '6px' }} />
            <FinanceSkeletonBase width="100%" height="40px" radius="10px" />
          </div>
          <div>
            <FinanceSkeletonBase width="130px" height="13px" radius="4px" style={{ marginBottom: '6px' }} />
            <FinanceSkeletonBase width="100%" height="40px" radius="10px" />
          </div>
        </div>

        {/* Semester items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Array.from({ length: 2 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'var(--bg-surface-2, rgba(11, 42, 74, 0.02))',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <FinanceSkeletonBase width="180px" height="15px" radius="4px" />
                <FinanceSkeletonBase width="130px" height="12px" radius="4px" />
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <FinanceSkeletonBase width="65px" height="22px" radius="9999px" />
                <FinanceSkeletonBase width="32px" height="32px" radius="8px" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Group 2: Parameter Piutang */}
      <div className="fin-skel-surface">
        <div style={{ marginBottom: '14px' }}>
          <FinanceSkeletonBase width="170px" height="18px" radius="4px" />
          <div style={{ marginTop: '4px' }}>
            <FinanceSkeletonBase width="250px" height="12px" radius="4px" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div>
            <FinanceSkeletonBase width="140px" height="13px" radius="4px" style={{ marginBottom: '6px' }} />
            <FinanceSkeletonBase width="100%" height="40px" radius="10px" />
          </div>
          <div>
            <FinanceSkeletonBase width="150px" height="13px" radius="4px" style={{ marginBottom: '6px' }} />
            <FinanceSkeletonBase width="100%" height="40px" radius="10px" />
          </div>
        </div>
      </div>

      {/* 4. Group 3: Kategori Transaksi Canonical */}
      <div className="fin-skel-surface">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <FinanceSkeletonBase width="190px" height="18px" radius="4px" />
            <div style={{ marginTop: '4px' }}>
              <FinanceSkeletonBase width="230px" height="12px" radius="4px" />
            </div>
          </div>
          <FinanceSkeletonBase width="140px" height="34px" radius="9999px" />
        </div>

        {/* Categories grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--line-2, rgba(11, 42, 74, 0.08))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FinanceSkeletonBase width="10px" height="10px" radius="50%" />
                <FinanceSkeletonBase width="110px" height="14px" radius="4px" />
              </div>
              <FinanceSkeletonBase width="45px" height="20px" radius="9999px" />
            </div>
          ))}
        </div>
      </div>

      {/* 5. Group 4: Pengelola & Rekening Resmi Studio */}
      <div className="fin-skel-surface">
        <div style={{ marginBottom: '14px' }}>
          <FinanceSkeletonBase width="200px" height="18px" radius="4px" />
          <div style={{ marginTop: '4px' }}>
            <FinanceSkeletonBase width="260px" height="12px" radius="4px" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div>
            <FinanceSkeletonBase width="110px" height="13px" radius="4px" style={{ marginBottom: '6px' }} />
            <FinanceSkeletonBase width="100%" height="40px" radius="10px" />
          </div>
          <div>
            <FinanceSkeletonBase width="100px" height="13px" radius="4px" style={{ marginBottom: '6px' }} />
            <FinanceSkeletonBase width="100%" height="40px" radius="10px" />
          </div>
          <div>
            <FinanceSkeletonBase width="120px" height="13px" radius="4px" style={{ marginBottom: '6px' }} />
            <FinanceSkeletonBase width="100%" height="40px" radius="10px" />
          </div>
        </div>
      </div>
    </div>
  );
};
