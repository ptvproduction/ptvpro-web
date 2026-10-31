import { useQuery } from '@tanstack/react-query';
import { getKruService } from './kruService';
import { CrewFilterParams } from './types';

export function useKruList(filters?: CrewFilterParams) {
  const service = getKruService();

  return useQuery({
    queryKey: ['hub', 'kru', 'list', filters],
    queryFn: () => service.getCrewList(filters),
  });
}

export function useKruMember(ptvId: string) {
  const service = getKruService();

  return useQuery({
    queryKey: ['hub', 'kru', 'detail', ptvId],
    queryFn: () => service.getCrewByPtvId(ptvId),
    enabled: Boolean(ptvId),
  });
}
