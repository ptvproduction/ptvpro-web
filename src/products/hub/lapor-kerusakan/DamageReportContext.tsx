import React, { createContext, useContext, useState } from 'react';
import { DamageReportItem, DamageFilterTab, DamageStatus } from './types';
import { damageReportService } from './damageReportService';
import { useInstantData } from '@/shared/hooks/useInstantData';
export interface SimulatedUnitCondition {
  assetId: string;
  unitNumber: number;
  unitCode: string;
  isDamaged: boolean;
}

interface DamageReportContextType {
  reports: DamageReportItem[];
  loading: boolean;
  error: string | null;
  refreshReports: () => Promise<void>;
  filterTab: DamageFilterTab;
  setFilterTab: (tab: DamageFilterTab) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  unitConditions: SimulatedUnitCondition[];
  createReport: (report: Omit<DamageReportItem, 'id' | 'reportedAt' | 'status' | 'qcLocked'>) => Promise<void>;
  updateQCAction: (id: string, qcStatus: DamageStatus, qcNotes: string) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  getReportById: (id: string) => DamageReportItem | undefined;
  isUnitDamaged: (assetId: string, unitNumber: number) => boolean;
  resetToDefaults: () => void;
}

const DamageReportContext = createContext<DamageReportContextType | undefined>(undefined);

export const DamageReportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    data: reports,
    isLoading: loading,
    error,
    refetch: refreshReportsAsync,
  } = useInstantData<DamageReportItem[]>({
    key: 'damage_reports_list',
    fetcher: () => damageReportService.getReports(),
    initialData: [],
    ttlMs: 5 * 60 * 1000,
  });

  const refreshReports = async () => {
    await refreshReportsAsync();
  };

  const [filterTab, setFilterTab] = useState<DamageFilterTab>('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  // Antarmuka kompatibilitas; kondisi unit tidak lagi dimutasi melalui simulasi browser.
  const unitConditions: SimulatedUnitCondition[] = [];

  const createReport = async (report: Omit<DamageReportItem, 'id' | 'reportedAt' | 'status' | 'qcLocked'>) => {
    await damageReportService.create(report);
    await refreshReports();
  };
  const updateQCAction = async (id: string, status: DamageStatus, notes: string) => {
    await damageReportService.updateQC(id, status, notes);
    await refreshReports();
  };
  const deleteReport = async (id: string) => {
    await damageReportService.delete(id);
    await refreshReports();
  };

  const getReportById = (id: string) => reports.find((r) => r.id === id);
  const isUnitDamaged = (assetId: string, unitNumber: number) => {
    const item = unitConditions.find((u) => u.assetId === assetId && u.unitNumber === unitNumber);
    return item ? item.isDamaged : false;
  };

  const resetToDefaults = () => {
    refreshReports();
  };

  return (
    <DamageReportContext.Provider
      value={{
        reports,
        loading,
        error,
        refreshReports,
        filterTab,
        setFilterTab,
        searchQuery,
        setSearchQuery,
        unitConditions,
        createReport,
        updateQCAction,
        deleteReport,
        getReportById,
        isUnitDamaged,
        resetToDefaults,
      }}
    >
      {children}
    </DamageReportContext.Provider>
  );
};

export const useDamageReport = () => {
  const context = useContext(DamageReportContext);
  if (!context) throw new Error('useDamageReport harus digunakan di dalam DamageReportProvider');
  return context;
};
