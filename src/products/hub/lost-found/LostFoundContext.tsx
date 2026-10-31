import React, { createContext, useContext, useState } from 'react';
import { LostFoundItem, LostFoundFilterTab, LostFoundStatus } from './types';
import { lostFoundService } from './lostFoundService';
import { useInstantData } from '@/shared/hooks/useInstantData';

interface LostFoundContextType {
  items: LostFoundItem[];
  loading: boolean;
  error: string | null;
  refreshItems: () => Promise<void>;
  filterTab: LostFoundFilterTab;
  setFilterTab: (tab: LostFoundFilterTab) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  addItem: (item: Omit<LostFoundItem, 'id' | 'createdAt' | 'status'>) => Promise<void>;
  updateStatus: (id: string, status: LostFoundStatus) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  getItemById: (id: string) => LostFoundItem | undefined;
  resetToDefaults: () => void;
}

const LostFoundContext = createContext<LostFoundContextType | undefined>(undefined);

export const LostFoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    data: items,
    isLoading: loading,
    error,
    refetch: refreshItemsAsync,
  } = useInstantData<LostFoundItem[]>({
    key: 'lostfound_items_list',
    fetcher: () => lostFoundService.getItems(),
    initialData: [],
    ttlMs: 5 * 60 * 1000,
  });

  const refreshItems = async () => {
    await refreshItemsAsync();
  };

  const [filterTab, setFilterTab] = useState<LostFoundFilterTab>('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  const addItem = async (item: Omit<LostFoundItem, 'id' | 'createdAt' | 'status'>) => {
    await lostFoundService.create(item);
    await refreshItems();
  };
  const updateStatus = async (id: string, status: LostFoundStatus) => {
    await lostFoundService.updateStatus(id, status);
    await refreshItems();
  };
  const deleteItem = async (id: string) => {
    await lostFoundService.delete(id);
    await refreshItems();
  };

  const getItemById = (id: string) => items.find((it) => it.id === id);

  const resetToDefaults = () => {
    refreshItems();
  };

  return (
    <LostFoundContext.Provider
      value={{
        items,
        loading,
        error,
        refreshItems,
        filterTab,
        setFilterTab,
        searchQuery,
        setSearchQuery,
        addItem,
        updateStatus,
        deleteItem,
        getItemById,
        resetToDefaults,
      }}
    >
      {children}
    </LostFoundContext.Provider>
  );
};

export const useLostFound = () => {
  const context = useContext(LostFoundContext);
  if (!context) throw new Error('useLostFound harus digunakan di dalam LostFoundProvider');
  return context;
};
