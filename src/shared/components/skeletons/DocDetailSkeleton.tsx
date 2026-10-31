import React from 'react';
import { SkeletonBase } from './SkeletonBase';

export const DocDetailSkeleton: React.FC = () => {
  return (
    <div className="ptv-skel-wrapper" aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Back & Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonBase width="100px" height="34px" radius="9999px" />
        <div style={{ display: 'flex', gap: '8px' }}>
          <SkeletonBase width="80px" height="34px" radius="9999px" />
          <SkeletonBase width="90px" height="34px" radius="9999px" />
        </div>
      </div>

      {/* Main Detail Card */}
      <div className="ptv-skel-card" style={{ padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <SkeletonBase width="120px" height="22px" radius="9999px" />
            <SkeletonBase width="65%" height="26px" radius="8px" />
            <SkeletonBase width="40%" height="16px" radius="6px" />
          </div>
          <SkeletonBase width="48px" height="48px" radius="14px" />
        </div>

        {/* Metadata Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', paddingTop: '16px', borderTop: '1px solid var(--ptv-skel-border)' }}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <SkeletonBase width="60px" height="12px" radius="4px" />
              <SkeletonBase width="110px" height="16px" radius="6px" />
            </div>
          ))}
        </div>

        {/* Body content preview box */}
        <div style={{ padding: '16px', background: 'var(--ptv-skel-base)', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SkeletonBase width="95%" height="15px" radius="4px" />
          <SkeletonBase width="88%" height="15px" radius="4px" />
          <SkeletonBase width="75%" height="15px" radius="4px" />
        </div>
      </div>
    </div>
  );
};

