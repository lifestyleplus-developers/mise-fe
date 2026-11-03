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
  Area,
  CreateAreaRequest,
  Page,
  UpdateAreaRequest,
} from '@/shared/api/types';

import { spotCheckKeys } from './spot-check-keys';

const PAGE_SIZE = 25;

export type AreaFilters = {
  outletId?: number;
  includeArchived: boolean;
};

/** Areas by name, 25 at a time. */
export function useAreas(filters: AreaFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: spotCheckKeys.areaList(filters),
    queryFn: ({ pageParam }) =>
      api.spotChecks.areas({
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
 * Every live area of an outlet, for screens that only need to know how many can
 * be picked (SPT-05's pool line, SPT-06's "no area can be picked"). Pages 100 at a time.
 */
export function useAllAreas(outletId: number | undefined) {
  return useQuery({
    queryKey: [...spotCheckKeys.areaLists, 'all', outletId ?? null],
    queryFn: async (): Promise<Area[]> => {
      const all: Area[] = [];
      for (let page = 1; ; page++) {
        const result = await api.spotChecks.areas({
          outletId,
          includeArchived: false,
          page,
          pageSize: 100,
        });
        all.push(...result.results);
        if (result.next === null) return all;
      }
    },
    enabled: outletId !== undefined,
    retry: retryTransient,
  });
}

/**
 * Area edits fail now rather than pause offline: a save that hangs unseen is
 * worse than "Couldn't save", which can be tapped again.
 */
export function useCreateArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateAreaRequest) =>
      api.spotChecks.createArea(request),
    networkMode: 'always',
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: spotCheckKeys.areaLists });
    },
  });
}

export function useUpdateArea(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateAreaRequest) =>
      api.spotChecks.updateArea(id, patch),
    networkMode: 'always',
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: spotCheckKeys.areaLists });
    },
  });
}

type EligibleVariables = { id: number; is_eligible: boolean };

/** A cached list of areas: paged (the screen's list) or whole (the count of live ones). */
export type CachedAreas = InfiniteData<Page<Area>> | Area[];

/**
 * The cached lists with one area's switch moved. Both shapes sit under the same
 * key, so the update has to know each.
 */
export function withEligible(
  data: CachedAreas | undefined,
  id: number,
  is_eligible: boolean,
): CachedAreas | undefined {
  if (!data) return data;
  const set = (area: Area): Area =>
    area.id === id ? { ...area, is_eligible } : area;
  if (Array.isArray(data)) return data.map(set);
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      results: page.results.map(set),
    })),
  };
}

/**
 * The switch on a row: it moves at once, and if the save fails it is put back
 * (SPT-06 `switchFailed`). The mutation's `error` stays set for the line under the row.
 */
export function useSetAreaEligible() {
  const queryClient = useQueryClient();
  type Lists = [readonly unknown[], CachedAreas | undefined][];
  return useMutation<Area, Error, EligibleVariables, { previous: Lists }>({
    mutationFn: ({ id, is_eligible }) =>
      api.spotChecks.updateArea(id, { is_eligible }),
    networkMode: 'always',
    onMutate: async ({ id, is_eligible }) => {
      await queryClient.cancelQueries({ queryKey: spotCheckKeys.areaLists });
      const previous = queryClient.getQueriesData<CachedAreas>({
        queryKey: spotCheckKeys.areaLists,
      });
      queryClient.setQueriesData<CachedAreas>(
        { queryKey: spotCheckKeys.areaLists },
        (data) => withEligible(data, id, is_eligible),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: spotCheckKeys.areaLists });
    },
  });
}
