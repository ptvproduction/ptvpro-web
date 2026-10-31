import React from 'react';
import { SkeletonBase } from './SkeletonBase';

export interface InventoryGridSkeletonProps {
  count?: number;
}

export const InventoryGridSkeleton: React.FC<InventoryGridSkeletonProps> = ({ count = 6 }) => {
  return (
    <div className="ptv-skel-grid-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="ptv-skel-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '12px',
            borderRadius: '20px',
          }}
        >
          {/* 16:9 Image Thumbnail */}
          <SkeletonBase width="100%" height="150px" radius="14px" />

          {/* Details */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SkeletonBase width="70px" height="18px" radius="9999px" />
            <SkeletonBase width="60px" height="18px" radius="9999px" />
          </div>

          <SkeletonBase width="85%" height="18px" radius="6px" />
          <SkeletonBase width="55%" height="14px" radius="4px" />

          {/* Bottom row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '8px',
              borderTop: '1px solid var(--ptv-skel-border)',
              marginTop: '4px',
            }}
          >
            <SkeletonBase width="80px" height="14px" radius="4px" />
            <SkeletonBase width="75px" height="28px" radius="9999px" />
          </div>
        </div>
      ))}
    </div>
  );
};

