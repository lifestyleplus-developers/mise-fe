import { useQuery } from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { retryTransient } from '@/shared/api/query-helpers';

/** The worst runs of the last 24 hours. ADMIN and OWNER only, so others never ask. */
export function useAtRisk(enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'at-risk'],
    queryFn: () => api.reports.atRisk(),
    enabled,
    retry: retryTransient,
  });
}
