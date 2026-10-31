import React from 'react';
import { SkeletonBase } from './SkeletonBase';

export interface PageHeaderSkeletonProps {
  hasAction?: boolean;
}

export const PageHeaderSkeleton: React.FC<PageHeaderSkeletonProps> = ({ hasAction = true }) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '24px',
        gap: '16px',
        flexWrap: 'wrap',
      }}
      aria-hidden="true"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <SkeletonBase width="180px" height="28px" radius="8px" />
        <SkeletonBase width="280px" height="15px" radius="6px" />
      </div>
      {hasAction && (
        <div style={{ display: 'flex', gap: '10px' }}>
          <SkeletonBase width="110px" height="38px" radius="9999px" />
        </div>
      )}
    </div>
  );
};

