import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { ApiError } from '@/shared/api/http';
import { retryTransient } from '@/shared/api/query-helpers';
import type {
  CreateInventoryItemRequest,
  InventoryItem,
  Page,
  UpdateInventoryItemRequest,
} from '@/shared/api/types';
import { API_ERROR_CODE } from '@/shared/api/types';

import { inventoryKeys } from './inventory-keys';

const PAGE_SIZE = 25;

export type ItemFilters = {
  outletId?: number;
  search: string;
  includeArchived: boolean;
};

/** Items by name, 25 at a time. */
export function useInventoryItems(filters: ItemFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: inventoryKeys.itemList(filters),
    queryFn: ({ pageParam }) =>
      api.inventory.items({
        page: pageParam,
        pageSize: PAGE_SIZE,
        outletId: filters.outletId,
        search: filters.search || undefined,
        includeArchived: filters.includeArchived,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.next ?? undefined,
    placeholderData: keepPreviousData,
    retry: retryTransient,
    enabled,
  });
}

/** Walks an outlet's items for one; the contract has no GET for a single item. */
async function findItem(id: number, outletId: number): Promise<InventoryItem> {
  for (let page = 1; ; page++) {
    const result = await api.inventory.items({
      page,
      pageSize: 100,
      outletId,
      includeArchived: true,
    });
    const found = result.results.find((item) => item.id === id);
    if (found) return found;
    if (result.next === null) break;
  }
  throw new ApiError(404, {
    error: {
      code: API_ERROR_CODE.NOT_FOUND,
      message: 'Not found.',
      field: null,
    },
  });
}

/**
 * One item, shown at once from any cached list that has it. An item that has
 * been archived or lost to a role change comes back as a 404 ("gone").
 */
export function useInventoryItem(id: number, outletId: number) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: inventoryKeys.item(id),
    queryFn: () => findItem(id, outletId),
    initialData: () => {
      const lists = queryClient.getQueriesData<
        InfiniteData<Page<InventoryItem>>
      >({ queryKey: inventoryKeys.itemLists });
      for (const [, data] of lists) {
        const found = data?.pages
          .flatMap((page) => page.results)
          .find((item) => item.id === id);
        if (found) return found;
      }
      return undefined;
    },
    retry: retryTransient,
  });
}

/**
 * Item edits fail now rather than pause offline: a save that hangs unseen is
 * worse than "Couldn't save", which can be tapped again.
 */
export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateInventoryItemRequest) =>
      api.inventory.createItem(request),
    networkMode: 'always',
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.itemLists });
    },
  });
}

export function useUpdateInventoryItem(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateInventoryItemRequest) =>
      api.inventory.updateItem(id, patch),
    networkMode: 'always',
    onSuccess: (item) => {
      queryClient.setQueryData(inventoryKeys.item(id), item);
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.itemLists });
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.reports });
    },
  });
}

/**
 * Every item of an outlet, archived ones too, for screens that read names and units
 * off a movement's item id. Pages through the list 100 at a time.
 */
export function useAllInventoryItems(outletId: number | undefined) {
  return useQuery({
    queryKey: [...inventoryKeys.itemLists, 'all', outletId ?? null],
    queryFn: async (): Promise<InventoryItem[]> => {
      const all: InventoryItem[] = [];
      for (let page = 1; ; page++) {
        const result = await api.inventory.items({
          page,
          pageSize: 100,
          outletId,
          includeArchived: true,
        });
        all.push(...result.results);
        if (result.next === null) return all;
      }
    },
    enabled: outletId !== undefined,
    retry: retryTransient,
  });
}
