import { useQuery } from '@tanstack/react-query';

import { api } from '@/shared/api/client';

/** Every run the caller may act on that has not closed (§7). */
export function useRuns() {
  return useQuery({ queryKey: ['runs'], queryFn: () => api.runs.list() });
}
