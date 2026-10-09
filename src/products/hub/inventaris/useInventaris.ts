import { useState, useEffect, useCallback } from 'react';
import { ItemInventaris, InventarisFilterParams, CreateInventarisDTO } from './types';
import { inventarisService } from './inventarisService';

export function useInventarisList(initialFilters?: InventarisFilterParams) {
  const [data, setData] = useState<ItemInventaris[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchInventaris = useCallback(async (filters?: InventarisFilterParams) => {
    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);
      const res = await inventarisService.getInventarisList(filters);
      setData(res);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Gagal memuat inventaris'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventaris(initialFilters);
  }, [fetchInventaris, initialFilters?.search, initialFilters?.kategori, initialFilters?.status]);

  const createItem = async (dto: CreateInventarisDTO) => {
    const created = await inventarisService.createInventaris(dto);
    await fetchInventaris(initialFilters);
    return created;
  };

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: () => fetchInventaris(initialFilters),
    createItem,
  };
}
