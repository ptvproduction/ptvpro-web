import { useQuery } from '@tanstack/react-query';
import { getBerandaService } from './berandaService';

export function useBeranda() {
  const service = getBerandaService();

  return useQuery({
    queryKey: ['hub', 'beranda', 'summary'],
    queryFn: () => service.getSummary(),
  });
}
