import React from 'react';
import { SkeletonBase } from './SkeletonBase';

export const BerandaSkeleton: React.FC = () => {
  return (
    <div className="ptv-skel-wrapper" aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Hero Widget Skeleton */}
      <div
        className="ptv-skel-card"
        style={{
          minHeight: '190px',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <SkeletonBase width="140px" height="14px" radius="9999px" />
            <SkeletonBase width="240px" height="28px" radius="8px" />
            <SkeletonBase width="180px" height="16px" radius="6px" />
          </div>
          <SkeletonBase width="48px" height="48px" radius="9999px" />
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <SkeletonBase width="120px" height="34px" radius="9999px" />
          <SkeletonBase width="110px" height="34px" radius="9999px" />
        </div>
      </div>

      {/* 2. Bento Shortcuts 4 Columns */}
      <div className="ptv-skel-grid-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="ptv-skel-card"
            style={{
              padding: '16px',
              borderRadius: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <SkeletonBase width="38px" height="38px" radius="10px" />
            <SkeletonBase width="75%" height="16px" radius="6px" />
            <SkeletonBase width="90%" height="12px" radius="4px" />
          </div>
        ))}
      </div>

      {/* 3. Editorial Two Columns: Agenda Mendatang & Alat Saya */}
      <div className="ptv-skel-grid-2">
        <div className="ptv-skel-card" style={{ padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SkeletonBase width="130px" height="20px" radius="6px" />
            <SkeletonBase width="60px" height="14px" radius="4px" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <SkeletonBase width="36px" height="36px" radius="10px" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <SkeletonBase width="70%" height="15px" radius="4px" />
                  <SkeletonBase width="40%" height="12px" radius="4px" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ptv-skel-card" style={{ padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SkeletonBase width="100px" height="20px" radius="6px" />
            <SkeletonBase width="60px" height="14px" radius="4px" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '8px 0' }}>
                <SkeletonBase width="42px" height="42px" radius="10px" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <SkeletonBase width="65%" height="15px" radius="4px" />
                  <SkeletonBase width="45%" height="12px" radius="4px" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

