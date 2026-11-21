import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { retryTransient } from '@/shared/api/query-helpers';
import type { NamedRef } from '@/shared/api/types';

import { issueKeys, type IssueFilters } from './issue-keys';

const PAGE_SIZE = 25;

/** Incidents, newest first, 25 at a time (§9). Open unless the filters say resolved. */
export function useIncidents(filters: IssueFilters) {
  return useInfiniteQuery({
    queryKey: issueKeys.list(filters),
    queryFn: ({ pageParam }) =>
      api.incidents.list({
        status: filters.status,
        outletId: filters.outletId,
        checklistId: filters.checklistId,
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.next ?? undefined,
    retry: retryTransient,
  });
}

const OPTIONS_PAGE_SIZE = 100;
const OPTIONS_STALE_MS = 5 * 60_000;

/**
 * The outlets and checklists the caller has issues for, for the two filter
 * chips. Taken from the latest hundred incidents of either status, so the
 * choices do not shrink as soon as one is picked, and a manager is offered only
 * their own.
 */
export function useIssueFilterOptions() {
  return useQuery({
    queryKey: issueKeys.options,
    queryFn: async () => {
      const { results } = await api.incidents.list({
        status: 'ALL',
        page: 1,
        pageSize: OPTIONS_PAGE_SIZE,
      });
      const unique = (refs: NamedRef[]) =>
        [...new Map(refs.map((ref) => [ref.id, ref])).values()].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
      return {
        outlets: unique(results.map((incident) => incident.outlet)),
        checklists: unique(results.map((incident) => incident.checklist)),
      };
    },
    staleTime: OPTIONS_STALE_MS,
    retry: retryTransient,
  });
}
