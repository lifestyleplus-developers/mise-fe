import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, NotBuiltError } from '@/shared/api/client';
import { retryTransient } from '@/shared/api/query-helpers';

const managersKey = (outletId: number) =>
  ['inventory', 'managers', outletId] as const;

/** Who records stock at an outlet. Not on the platform yet, so only the mock answers. */
export function useInventoryManagers(outletId: number, enabled = true) {
  return useQuery({
    queryKey: managersKey(outletId),
    queryFn: () => api.inventory.managers(outletId),
    enabled,
    retry: (count, error) =>
      error instanceof NotBuiltError ? false : retryTransient(count, error),
  });
}

/** Who can record stock decides what /auth/me tells them, so the identity is refetched. */
function useManagerWrite<Variables>(
  outletId: number,
  mutationFn: (variables: Variables) => Promise<void>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    networkMode: 'always',
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managersKey(outletId) });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useAppointInventoryManager(outletId: number) {
  return useManagerWrite(outletId, (userId: number) =>
    api.inventory.appointManager(outletId, userId),
  );
}

export function useRemoveInventoryManager(outletId: number) {
  return useManagerWrite(outletId, (userId: number) =>
    api.inventory.removeManager(outletId, userId),
  );
}
