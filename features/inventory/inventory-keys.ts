import type {
  InventoryItemsQuery,
  InventoryMovementsQuery,
  StockReportQuery,
} from '@/shared/api/types';

/** Query keys for items, movements and reports; `['inventory']` is all of it. */
export const inventoryKeys = {
  all: ['inventory'] as const,
  itemLists: ['inventory', 'items'] as const,
  itemList: (filters: Omit<InventoryItemsQuery, 'page' | 'pageSize'>) =>
    ['inventory', 'items', filters] as const,
  item: (id: number) => ['inventory', 'item', id] as const,
  movementLists: ['inventory', 'movements'] as const,
  movementList: (filters: Omit<InventoryMovementsQuery, 'page' | 'pageSize'>) =>
    ['inventory', 'movements', filters] as const,
  reports: ['inventory', 'reports'] as const,
  stockOnHand: (outletId: number) =>
    ['inventory', 'reports', 'stock-on-hand', outletId] as const,
  summary: (query: StockReportQuery) =>
    ['inventory', 'reports', 'summary', query] as const,
  spend: (query: StockReportQuery) =>
    ['inventory', 'reports', 'spend', query] as const,
};
