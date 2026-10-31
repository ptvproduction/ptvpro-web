import React from 'react';
import type { FinanceSection } from '../../financeFoundation';
import { FinanceOverviewSkeleton } from './FinanceOverviewSkeleton';
import { FinanceTransactionSkeleton } from './FinanceTransactionSkeleton';
import { FinancePocketSkeleton } from './FinancePocketSkeleton';
import { FinanceKasKruSkeleton } from './FinanceKasKruSkeleton';
import { FinancePiutangSkeleton } from './FinancePiutangSkeleton';
import { FinanceLaporanSkeleton } from './FinanceLaporanSkeleton';
import { FinanceSettingsSkeleton } from './FinanceSettingsSkeleton';

export interface FinanceSectionSkeletonProps {
  section?: FinanceSection;
}

export const FinanceSectionSkeleton: React.FC<FinanceSectionSkeletonProps> = ({
  section = 'ringkasan',
}) => {
  switch (section) {
    case 'transaksi':
      return <FinanceTransactionSkeleton />;
    case 'kantong':
      return <FinancePocketSkeleton />;
    case 'kas-kru':
      return <FinanceKasKruSkeleton />;
    case 'piutang':
      return <FinancePiutangSkeleton />;
    case 'laporan':
      return <FinanceLaporanSkeleton />;
    case 'pengaturan':
      return <FinanceSettingsSkeleton />;
    case 'ringkasan':
    default:
      return <FinanceOverviewSkeleton />;
  }
};
