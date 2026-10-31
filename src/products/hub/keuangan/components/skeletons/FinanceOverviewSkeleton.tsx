import React from 'react';
import { FinanceSkeletonBase } from './FinanceSkeletonBase';

export const FinanceOverviewSkeleton: React.FC = () => {
  return (
    <div className="fin-skel-root" role="status" aria-busy="true" aria-label="Memuat ringkasan keuangan…">
      {/* 1. Hero Balance Card */}
      <div className="fin-skel-hero-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <FinanceSkeletonBase width="140px" height="14px" radius="4px" />
          <FinanceSkeletonBase width="260px" height="34px" radius="6px" />
          <FinanceSkeletonBase width="180px" height="12px" radius="4px" />
        </div>
        <div className="fin-skel-hero-actions">
          <FinanceSkeletonBase width="130px" height="40px" radius="9999px" />
          <FinanceSkeletonBase width="130px" height="40px" radius="9999px" />
          <FinanceSkeletonBase width="110px" height="40px" radius="9999px" />
        </div>
      </div>

      {/* 2. 4 Bento KPI Cards */}
      <div className="fin-skel-kpi-grid">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="fin-skel-kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <FinanceSkeletonBase width="90px" height="13px" radius="4px" />
              <FinanceSkeletonBase width="32px" height="32px" radius="10px" />
            </div>
            <div style={{ margin: '14px 0 6px' }}>
              <FinanceSkeletonBase width="150px" height="24px" radius="4px" />
            </div>
            <FinanceSkeletonBase width="100px" height="12px" radius="4px" />
          </div>
        ))}
      </div>

      {/* 3. Two-Column Layout: Charts & Recent Transactions */}
      <div className="fin-skel-two-cols">
        {/* Left Column: Cashflow Chart & Quick Pockets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Chart Panel */}
          <div className="fin-skel-surface">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <FinanceSkeletonBase width="160px" height="16px" radius="4px" />
                <div style={{ marginTop: '4px' }}>
                  <FinanceSkeletonBase width="110px" height="12px" radius="4px" />
                </div>
              </div>
              <FinanceSkeletonBase width="80px" height="26px" radius="9999px" />
            </div>
            {/* Visual Bar Chart Skeleton Area */}
            <div
              style={{
                height: '180px',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                padding: '0 10px',
                gap: '12px',
                borderBottom: '1px solid var(--line-2, rgba(11, 42, 74, 0.08))',
                paddingBottom: '12px',
              }}
            >
              {[60, 85, 45, 110, 75, 130].map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', flex: 1, justifyContent: 'center' }}>
                  <FinanceSkeletonBase width="16px" height={`${h}px`} radius="4px 4px 0 0" />
                  <FinanceSkeletonBase width="16px" height={`${Math.max(30, h - 25)}px`} radius="4px 4px 0 0" />
                </div>
              ))}
            </div>
            {/* Month labels under bars */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', padding: '0 10px' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <FinanceSkeletonBase key={i} width="28px" height="11px" radius="3px" />
              ))}
            </div>
          </div>

          {/* Quick Pockets Panel */}
          <div className="fin-skel-surface">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <FinanceSkeletonBase width="130px" height="16px" radius="4px" />
              <FinanceSkeletonBase width="70px" height="14px" radius="4px" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    background: 'var(--bg-surface-2, rgba(11, 42, 74, 0.02))',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FinanceSkeletonBase width="34px" height="34px" radius="8px" />
                    <div>
                      <FinanceSkeletonBase width="120px" height="14px" radius="4px" />
                      <div style={{ marginTop: '4px' }}>
                        <FinanceSkeletonBase width="70px" height="11px" radius="4px" />
                      </div>
                    </div>
                  </div>
                  <FinanceSkeletonBase width="90px" height="16px" radius="4px" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Recent Transactions Activity */}
        <div className="fin-skel-surface">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <FinanceSkeletonBase width="150px" height="16px" radius="4px" />
              <div style={{ marginTop: '4px' }}>
                <FinanceSkeletonBase width="90px" height="12px" radius="4px" />
              </div>
            </div>
            <FinanceSkeletonBase width="60px" height="26px" radius="9999px" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  paddingBottom: '12px',
                  borderBottom: idx < 4 ? '1px solid var(--line-2, rgba(11, 42, 74, 0.06))' : 'none',
                }}
              >
                <FinanceSkeletonBase width="36px" height="36px" radius="50%" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <FinanceSkeletonBase width="75%" height="14px" radius="4px" />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <FinanceSkeletonBase width="65px" height="11px" radius="3px" />
                    <FinanceSkeletonBase width="55px" height="11px" radius="3px" />
                  </div>
                </div>
                <FinanceSkeletonBase width="85px" height="16px" radius="4px" style={{ flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
