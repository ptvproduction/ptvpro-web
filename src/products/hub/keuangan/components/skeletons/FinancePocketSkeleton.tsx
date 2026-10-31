import React from 'react';
import { FinanceSkeletonBase } from './FinanceSkeletonBase';

export const FinancePocketSkeleton: React.FC = () => {
  return (
    <div className="fin-skel-root" role="status" aria-busy="true" aria-label="Memuat data kantong kas…">
      {/* 1. Hero Summary Card */}
      <div className="fin-skel-hero-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <FinanceSkeletonBase width="150px" height="14px" radius="4px" />
          <FinanceSkeletonBase width="230px" height="32px" radius="6px" />
          <FinanceSkeletonBase width="190px" height="12px" radius="4px" />
        </div>
        <FinanceSkeletonBase width="150px" height="40px" radius="9999px" />
      </div>

      {/* 2. Responsive Pockets Grid */}
      <div className="fin-skel-pockets-grid">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="fin-skel-pocket-card">
            {/* Top row: Icon & Type Pill */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FinanceSkeletonBase width="40px" height="40px" radius="12px" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <FinanceSkeletonBase width="110px" height="16px" radius="4px" />
                  <FinanceSkeletonBase width="60px" height="18px" radius="9999px" />
                </div>
              </div>
              <FinanceSkeletonBase width="28px" height="28px" radius="8px" />
            </div>

            {/* Account Info */}
            <div style={{ margin: '18px 0 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <FinanceSkeletonBase width="140px" height="12px" radius="4px" />
              <FinanceSkeletonBase width="90px" height="12px" radius="4px" />
            </div>

            {/* Big Balance Number */}
            <div style={{ marginBottom: '16px' }}>
              <FinanceSkeletonBase width="60%" height="26px" radius="6px" />
            </div>

            {/* Card Footer Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                paddingTop: '12px',
                borderTop: '1px solid var(--line-2, rgba(11, 42, 74, 0.06))',
              }}
            >
              <FinanceSkeletonBase width="70px" height="30px" radius="9999px" />
              <FinanceSkeletonBase width="70px" height="30px" radius="9999px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
