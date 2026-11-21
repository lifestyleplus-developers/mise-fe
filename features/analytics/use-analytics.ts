import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { retryTransient } from '@/shared/api/query-helpers';

/** Periods per page on "Over time" (the design's "Load earlier" adds another). */
const HISTORY_PAGE_SIZE = 14;

/** The checklist scored at each outlet the caller may see (§10). */
export function useChecklistOutlets(checklistId: number, enabled = true) {
  return useQuery({
    queryKey: ['reports', 'checklist', checklistId, 'outlets'],
    queryFn: () => api.reports.checklistOutlets(checklistId),
    enabled,
    retry: retryTransient,
  });
}

/** One outlet's closed periods, newest first, a page at a time. */
export function useChecklistHistory(
  checklistId: number,
  assignmentId: number | undefined,
) {
  return useInfiniteQuery({
    queryKey: ['reports', 'checklist', checklistId, 'history', assignmentId],
    queryFn: ({ pageParam }) =>
      api.reports.checklistHistory(checklistId, {
        assignmentId,
        page: pageParam,
        pageSize: HISTORY_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.next ?? undefined,
    enabled: assignmentId !== undefined,
    retry: retryTransient,
  });
}

/**
 * This checklist's issues, either status, by run, so a period can say "Issue"
 * or "Resolved" and open it. The history rows carry no incident of their own.
 * The key sits under the issue lists, so resolving one refreshes it.
 */
export function useChecklistIssues(checklistId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['incidents', 'list', 'by-checklist', checklistId],
    queryFn: async () => {
      const { results } = await api.incidents.list({
        status: 'ALL',
        checklistId,
        page: 1,
        pageSize: 100,
      });
      return new Map(results.map((incident) => [incident.run_id, incident]));
    },
    enabled,
    retry: retryTransient,
  });
}
