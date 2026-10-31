import React from 'react';
import { SkeletonBase } from './SkeletonBase';

export const ProfileSkeleton: React.FC = () => {
  return (
    <div className="ptv-skel-wrapper" aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="ptv-skel-card" style={{ padding: '24px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <SkeletonBase width="72px" height="72px" radius="9999px" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <SkeletonBase width="180px" height="22px" radius="6px" />
          <SkeletonBase width="120px" height="15px" radius="4px" />
          <SkeletonBase width="85px" height="20px" radius="9999px" />
        </div>
      </div>

      <div className="ptv-skel-card" style={{ padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <SkeletonBase width="140px" height="20px" radius="6px" />
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--ptv-skel-border)' }}>
            <SkeletonBase width="120px" height="15px" radius="4px" />
            <SkeletonBase width="160px" height="15px" radius="4px" />
          </div>
        ))}
      </div>
    </div>
  );
};

