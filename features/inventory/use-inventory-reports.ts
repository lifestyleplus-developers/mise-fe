import { useQuery } from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { retryTransient } from '@/shared/api/query-helpers';
import type { StockReportQuery } from '@/shared/api/types';

import { inventoryKeys } from './inventory-keys';

/** Stock on hand now, at one outlet. */
export function useStockOnHand(outletId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: inventoryKeys.stockOnHand(outletId ?? 0),
    queryFn: () => api.inventory.stockOnHand({ outletId: outletId! }),
    enabled: outletId !== undefined && enabled,
    retry: retryTransient,
  });
}

/** Opening, in, out and closing over a range. */
export function useStockSummary(
  query: Omit<StockReportQuery, 'outletId'> & { outletId: number | undefined },
  enabled = true,
) {
  return useQuery({
    queryKey: inventoryKeys.summary({
      ...query,
      outletId: query.outletId ?? 0,
    }),
    queryFn: () =>
      api.inventory.summary({ ...query, outletId: query.outletId! }),
    enabled: query.outletId !== undefined && enabled,
    retry: retryTransient,
  });
}

/** Spend in rupees over a range: only deliveries that carried a price. */
export function useStockSpend(
  query: Omit<StockReportQuery, 'outletId'> & { outletId: number | undefined },
  enabled = true,
) {
  return useQuery({
    queryKey: inventoryKeys.spend({ ...query, outletId: query.outletId ?? 0 }),
    queryFn: () => api.inventory.spend({ ...query, outletId: query.outletId! }),
    enabled: query.outletId !== undefined && enabled,
    retry: retryTransient,
  });
}
