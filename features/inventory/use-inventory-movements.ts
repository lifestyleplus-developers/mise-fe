import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  type InfiniteData,
} from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { queryClient } from '@/shared/api/query-client';
import { retryTransient, useQueuedWrites } from '@/shared/api/query-helpers';
import type {
  InventoryItem,
  InventoryMovement,
  Page,
  RecordMovementRequest,
} from '@/shared/api/types';

import { inventoryKeys } from './inventory-keys';

const PAGE_SIZE = 25;

export type MovementFilters = {
  outletId?: number;
  itemId?: number;
  /** Dates, YYYY-MM-DD; both inclusive. */
  from?: string;
  to?: string;
};

/** The log, newest first, 25 at a time. Pass `itemId` for one item's ledger. */
export function useInventoryMovements(
  filters: MovementFilters,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: inventoryKeys.movementList(filters),
    queryFn: ({ pageParam }) =>
      api.inventory.movements({
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

export type RecordVariables = {
  itemId: number;
  request: RecordMovementRequest;
};

const RECORD_KEY = ['inventory', 'record'] as const;

/**
 * POST /inventory/items/{id}/movements — its defaults, so a paused (queued)
 * movement can be replayed after the app restarts (AGENTS.md:
 * setMutationDefaults at the point the mutation is defined).
 */
const recordMutationFn = ({
  itemId,
  request,
}: RecordVariables): Promise<InventoryMovement> =>
  api.inventory.record(itemId, request);

queryClient.setMutationDefaults(RECORD_KEY, { mutationFn: recordMutationFn });

/**
 * Add, remove or set actual. Not optimistic: until the platform answers the
 * balance stays as it was and the entry reads "Waiting to send" (INV-02). The
 * answer carries `balance_after`, which is written into the cached item.
 */
export function useRecordMovement() {
  return useMutation<InventoryMovement, Error, RecordVariables>({
    mutationKey: RECORD_KEY,
    networkMode: 'online',
    mutationFn: recordMutationFn,
    onSuccess: (movement, { itemId }) => {
      queryClient.setQueryData<InventoryItem>(
        inventoryKeys.item(itemId),
        (item) => item && { ...item, balance: movement.balance_after },
      );
      queryClient.setQueriesData<InfiniteData<Page<InventoryItem>>>(
        { queryKey: inventoryKeys.itemLists },
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              results: page.results.map((item) =>
                item.id === itemId
                  ? { ...item, balance: movement.balance_after }
                  : item,
              ),
            })),
          },
      );
      void queryClient.invalidateQueries({
        queryKey: inventoryKeys.movementLists,
      });
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.reports });
    },
  });
}

/**
 * Movements that have not landed, for one item or all. `waiting` shows as
 * "Waiting to send" with the balance unchanged; `refused` as "Not recorded".
 */
export function useMovementQueue(itemId?: number) {
  const writes = useQueuedWrites<RecordVariables>(
    RECORD_KEY,
    (v) => `${v.itemId}:${JSON.stringify(v.request)}`,
  );
  return writes.filter(
    (write) => itemId === undefined || write.variables.itemId === itemId,
  );
}
