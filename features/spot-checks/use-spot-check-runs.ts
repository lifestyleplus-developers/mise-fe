import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { retryTransient } from '@/shared/api/query-helpers';
import type {
  OverrideSpotCheckResultRequest,
  Page,
  SpotCheckOutcome,
  SpotCheckResult,
  SpotCheckRun,
} from '@/shared/api/types';

import { spotCheckKeys } from './spot-check-keys';

const PAGE_SIZE = 25;
/** A run rolls over (reveals, closes, is assessed) on the clock, so open ones are re-read. */
const WATCH_MS = 15_000;

export type RunFilters = {
  /** `revealed` and `scheduled` are the manager's own; `closed` is the results list. */
  state?: 'revealed' | 'scheduled' | 'closed';
  outletId?: number;
  outcome?: SpotCheckOutcome;
};

/**
 * Runs, 25 at a time. Revealed and scheduled lists are read again every few seconds,
 * so a scheduled check turns into a revealed one without a pull to refresh.
 */
export function useSpotCheckRuns(filters: RunFilters, enabled = true) {
  const watch = filters.state === 'revealed' || filters.state === 'scheduled';
  return useInfiniteQuery({
    queryKey: spotCheckKeys.runList(filters),
    queryFn: ({ pageParam }) =>
      api.spotChecks.runs({
        ...filters,
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.next ?? undefined,
    placeholderData: keepPreviousData,
    refetchInterval: watch ? WATCH_MS : false,
    retry: retryTransient,
    enabled,
  });
}

/** Whether a run is still moving: not yet closed, or closed and waiting on the assessment. */
function runIsMoving(run: SpotCheckRun | undefined): boolean {
  if (!run) return false;
  return (
    run.status !== 'FINALIZED' ||
    (run.results ?? []).some((result) => result.outcome === 'PENDING_JUDGEMENT')
  );
}

/**
 * One run, shown at once from any cached list that has it (until the reveal the
 * list row holds no subject either). Read again while it is moving.
 */
export function useSpotCheckRun(id: number | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: spotCheckKeys.run(id ?? 0),
    queryFn: () => api.spotChecks.run(id!),
    placeholderData: () => {
      const lists = queryClient.getQueriesData<
        InfiniteData<Page<SpotCheckRun>>
      >({
        queryKey: spotCheckKeys.runLists,
      });
      for (const [, data] of lists) {
        const found = data?.pages
          .flatMap((page) => page.results)
          .find((run) => run.id === id);
        if (found) return found;
      }
      return undefined;
    },
    refetchInterval: (query) =>
      runIsMoving(query.state.data) ? WATCH_MS : false,
    enabled: id !== undefined,
    retry: retryTransient,
  });
}

export type OverrideVariables = {
  resultId: number;
  request: OverrideSpotCheckResultRequest;
};

/**
 * Override one result, with a note. Fails now rather than pauses, and keeps the
 * sheet's note on failure. The answer carries both the original and the override,
 * and is written into the cached run in place.
 */
export function useOverrideSpotCheckResult(runId: number) {
  const queryClient = useQueryClient();
  return useMutation<SpotCheckResult, Error, OverrideVariables>({
    mutationFn: ({ resultId, request }) =>
      api.spotChecks.overrideResult(resultId, request),
    networkMode: 'always',
    onSuccess: (result) => {
      queryClient.setQueryData<SpotCheckRun>(
        spotCheckKeys.run(runId),
        (run) =>
          run && {
            ...run,
            results:
              run.results?.map((existing) =>
                existing.id === result.id ? result : existing,
              ) ?? null,
          },
      );
      // An override takes the run off the "needs review" pin, and may clear its issue.
      void queryClient.invalidateQueries({ queryKey: spotCheckKeys.runLists });
      void queryClient.invalidateQueries({
        queryKey: spotCheckKeys.run(runId),
      });
    },
  });
}
