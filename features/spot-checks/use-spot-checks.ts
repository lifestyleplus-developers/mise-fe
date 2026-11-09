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
  CreateSpotCheckRequest,
  Page,
  SpotCheck,
  SpotCheckAssertionRequest,
  SpotCheckCaptureRequest,
  UpdateSpotCheckRequest,
} from '@/shared/api/types';

import { spotCheckKeys } from './spot-check-keys';

const PAGE_SIZE = 25;

export type SpotCheckFilters = {
  outletId?: number;
  includeArchived: boolean;
};

/** Checks by name, 25 at a time. */
export function useSpotChecks(filters: SpotCheckFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: spotCheckKeys.checkList(filters),
    queryFn: ({ pageParam }) =>
      api.spotChecks.checks({
        ...filters,
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.next ?? undefined,
    placeholderData: keepPreviousData,
    retry: retryTransient,
    enabled,
  });
}

/**
 * One check with its prompts and items, shown at once from any cached list that
 * has it (a listed check carries both). Gone or lost to a role change is a 404.
 */
export function useSpotCheck(id: number | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: spotCheckKeys.check(id ?? 0),
    queryFn: () => api.spotChecks.check(id!),
    initialData: () => {
      const lists = queryClient.getQueriesData<InfiniteData<Page<SpotCheck>>>({
        queryKey: spotCheckKeys.checkLists,
      });
      for (const [, data] of lists) {
        const found = data?.pages
          .flatMap((page) => page.results)
          .find((check) => check.id === id);
        if (found) return found;
      }
      return undefined;
    },
    enabled: id !== undefined,
    retry: retryTransient,
  });
}

/**
 * Check edits fail now rather than pause offline. Every write refreshes the
 * check and the lists, since prompts and items sit inside both.
 */
function useCheckWrite<Variables, Result>(
  id: number | null,
  mutationFn: (variables: Variables) => Promise<Result>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    networkMode: 'always',
    onSuccess: () => {
      if (id !== null) {
        void queryClient.invalidateQueries({
          queryKey: spotCheckKeys.check(id),
        });
      }
      void queryClient.invalidateQueries({
        queryKey: spotCheckKeys.checkLists,
      });
    },
  });
}

export function useCreateSpotCheck() {
  return useCheckWrite(null, (request: CreateSpotCheckRequest) =>
    api.spotChecks.createCheck(request),
  );
}

/** Edits and archive. Runs already made keep the prompts and items they were made with. */
export function useUpdateSpotCheck(id: number) {
  return useCheckWrite(id, (patch: UpdateSpotCheckRequest) =>
    api.spotChecks.updateCheck(id, patch),
  );
}

export function useAddCapture(id: number) {
  return useCheckWrite(id, (request: SpotCheckCaptureRequest) =>
    api.spotChecks.addCapture(id, request),
  );
}

export function useUpdateCapture(id: number) {
  return useCheckWrite(
    id,
    (variables: { position: number; request: SpotCheckCaptureRequest }) =>
      api.spotChecks.updateCapture(id, variables.position, variables.request),
  );
}

export function useRemoveCapture(id: number) {
  return useCheckWrite(id, (position: number) =>
    api.spotChecks.removeCapture(id, position),
  );
}

/** Items are never paired with a prompt: there is no field for it. */
export function useAddAssertion(id: number) {
  return useCheckWrite(id, (request: SpotCheckAssertionRequest) =>
    api.spotChecks.addAssertion(id, request),
  );
}

/** Edit an item, or archive and restore it with `is_archived`. */
export function useUpdateAssertion(id: number) {
  return useCheckWrite(
    id,
    (variables: { position: number; request: SpotCheckAssertionRequest }) =>
      api.spotChecks.updateAssertion(id, variables.position, variables.request),
  );
}
