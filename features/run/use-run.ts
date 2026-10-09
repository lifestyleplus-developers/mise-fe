import { useQuery } from '@tanstack/react-query';

import { api } from '@/shared/api/client';

/** How often a supervisor's view refreshes while they watch (Model §7). */
const WATCH_INTERVAL_MS = 15_000;

/**
 * One run with its tasks. A CL_ADMIN watches live, so their copy refetches on
 * a timer; an implementer's does not, since their own answers are what change it.
 */
export function useRun(id: number) {
  return useQuery({
    queryKey: ['runs', id],
    queryFn: () => api.runs.get(id),
    refetchInterval: (query) =>
      query.state.data?.my_role === 'CL_ADMIN' ? WATCH_INTERVAL_MS : false,
  });
}
