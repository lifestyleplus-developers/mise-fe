import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { retryTransient } from '@/shared/api/query-helpers';

import { isManagerNotWired } from './check-errors';
import { spotCheckKeys } from './spot-check-keys';

/** Who takes spot checks at an outlet. Not on the platform yet, so only the mock answers. */
export function useSpotCheckManagers(
  outletId: number | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: spotCheckKeys.managers(outletId ?? 0),
    queryFn: () => api.spotChecks.managers(outletId!),
    enabled: enabled && outletId !== undefined,
    retry: (count, error) =>
      isManagerNotWired(error) ? false : retryTransient(count, error),
  });
}

/** Who can take a check decides what /auth/me tells them, so the identity is refetched. */
function useManagerWrite(
  outletId: number,
  mutationFn: (userId: number) => Promise<void>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    networkMode: 'always',
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: spotCheckKeys.managers(outletId),
      });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useAppointSpotCheckManager(outletId: number) {
  return useManagerWrite(outletId, (userId) =>
    api.spotChecks.appointManager(outletId, userId),
  );
}

export function useRemoveSpotCheckManager(outletId: number) {
  return useManagerWrite(outletId, (userId) =>
    api.spotChecks.removeManager(outletId, userId),
  );
}
