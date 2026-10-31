import React from 'react';
import { SkeletonBase } from './SkeletonBase';

export interface CalendarGridSkeletonProps {
  weeks?: number;
}

export const CalendarGridSkeleton: React.FC<CalendarGridSkeletonProps> = ({ weeks = 5 }) => {
  return (
    <div className="ptv-skel-wrapper" aria-hidden="true">
      {/* Calendar Header Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SkeletonBase width="34px" height="34px" radius="8px" />
          <SkeletonBase width="140px" height="24px" radius="6px" />
          <SkeletonBase width="34px" height="34px" radius="8px" />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <SkeletonBase width="80px" height="34px" radius="9999px" />
          <SkeletonBase width="90px" height="34px" radius="9999px" />
        </div>
      </div>

      {/* 7 Days Column Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        {Array.from({ length: 7 }).map((_, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'center' }}>
            <SkeletonBase width="40px" height="14px" radius="4px" />
          </div>
        ))}
      </div>

      {/* Month Days Matrix */}
      <div className="ptv-skel-calendar-grid">
        {Array.from({ length: weeks * 7 }).map((_, idx) => (
          <div key={idx} className="ptv-skel-calendar-cell">
            <SkeletonBase width="24px" height="16px" radius="4px" />
            {idx % 4 === 1 && (
              <SkeletonBase width="90%" height="18px" radius="6px" style={{ marginTop: 'auto' }} />
            )}
            {idx % 7 === 3 && (
              <SkeletonBase width="80%" height="18px" radius="6px" style={{ marginTop: 'auto' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

