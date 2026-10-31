import React from 'react';
import { SkeletonBase } from './SkeletonBase';

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
}) => {
  return (
    <div className="ptv-skel-table-wrapper" aria-hidden="true">
      {/* Header bar */}
      <div
        className="ptv-skel-table-row"
        style={{
          background: 'var(--ptv-skel-base)',
          borderBottom: '1px solid var(--ptv-skel-border)',
        }}
      >
        <SkeletonBase width="40px" height="14px" radius="4px" />
        <SkeletonBase width="180px" height="14px" radius="4px" />
        <SkeletonBase width="120px" height="14px" radius="4px" />
        <SkeletonBase width="100px" height="14px" radius="4px" />
        <div style={{ marginLeft: 'auto' }}>
          <SkeletonBase width="60px" height="14px" radius="4px" />
        </div>
      </div>

      {/* Row list */}
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="ptv-skel-table-row">
          <SkeletonBase width="36px" height="36px" radius="9999px" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '220px' }}>
            <SkeletonBase width="85%" height="15px" radius="4px" />
            <SkeletonBase width="55%" height="12px" radius="4px" />
          </div>
          <SkeletonBase width="110px" height="22px" radius="9999px" />
          <SkeletonBase width="90px" height="14px" radius="4px" />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <SkeletonBase width="28px" height="28px" radius="6px" />
            <SkeletonBase width="28px" height="28px" radius="6px" />
          </div>
        </div>
      ))}
    </div>
  );
};

