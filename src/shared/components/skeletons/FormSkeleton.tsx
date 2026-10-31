import React from 'react';
import { SkeletonBase } from './SkeletonBase';

export const FormSkeleton: React.FC = () => {
  return (
    <div className="ptv-skel-wrapper" aria-hidden="true">
      <div className="ptv-skel-card" style={{ padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <SkeletonBase width="180px" height="22px" radius="6px" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <SkeletonBase width="100px" height="14px" radius="4px" />
              <SkeletonBase width="100%" height="42px" radius="10px" />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <SkeletonBase width="90px" height="40px" radius="9999px" />
          <SkeletonBase width="140px" height="40px" radius="9999px" />
        </div>
      </div>
    </div>
  );
};

