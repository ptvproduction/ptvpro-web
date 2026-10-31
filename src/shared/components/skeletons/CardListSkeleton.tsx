import React from 'react';
import { SkeletonBase } from './SkeletonBase';

export interface CardListSkeletonProps {
  count?: number;
  variant?: 'row' | 'horizontal-card' | 'dense';
}

export const CardListSkeleton: React.FC<CardListSkeletonProps> = ({
  count = 4,
  variant = 'row',
}) => {
  return (
    <div className="ptv-skel-card-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="ptv-skel-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            minHeight: variant === 'horizontal-card' ? '80px' : '64px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
            <SkeletonBase width="44px" height="44px" radius="12px" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, maxWidth: '420px' }}>
              <SkeletonBase width="70%" height="16px" radius="6px" />
              <SkeletonBase width="45%" height="13px" radius="4px" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SkeletonBase width="80px" height="24px" radius="9999px" />
            <SkeletonBase width="32px" height="32px" radius="8px" />
          </div>
        </div>
      ))}
    </div>
  );
};

