import { useState, useEffect, useCallback } from 'react';
import { PeminjamanRecord, PeminjamanFilterParams, CheckoutLoanDTO, ReturnLoanDTO } from './types';
import { peminjamanService } from './peminjamanService';
import { inventarisService } from '../inventaris/inventarisService';
import { ItemInventaris, InventarisUnit } from '../inventaris/types';

export function usePeminjamanList(initialFilters?: PeminjamanFilterParams) {
  const [data, setData] = useState<PeminjamanRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPeminjaman = useCallback(async (filters?: PeminjamanFilterParams) => {
    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);
      const res = await peminjamanService.getPeminjamanList(filters);
      setData(res);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Gagal memuat daftar peminjaman'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeminjaman(initialFilters);
  }, [fetchPeminjaman, initialFilters?.search, initialFilters?.status]);

  const checkout = async (dto: CheckoutLoanDTO, actorId?: string, actorNama?: string) => {
    const res = await peminjamanService.checkoutLoan(dto, actorId, actorNama);
    await fetchPeminjaman(initialFilters);
    return res;
  };

  const returnLoan = async (dto: ReturnLoanDTO, actorId?: string, actorNama?: string) => {
    const res = await peminjamanService.returnLoan(dto, actorId, actorNama);
    await fetchPeminjaman(initialFilters);
    return res;
  };

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: () => fetchPeminjaman(initialFilters),
    checkout,
    returnLoan,
  };
}

export function useAvailableUnits() {
  const [availableUnits, setAvailableUnits] = useState<{ unit: InventarisUnit; item: ItemInventaris }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const units = await inventarisService.getAvailableUnits();
      setAvailableUnits(units);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { availableUnits, isLoading, reload };
}
