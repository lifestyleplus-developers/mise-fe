import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import type { Outlet, UpdateOutletRequest } from '@/shared/api/types';

const OUTLETS_KEY = ['outlets'] as const;

/** Every outlet, archived included; the screen filters. */
export function useOutlets() {
  return useQuery({ queryKey: OUTLETS_KEY, queryFn: () => api.outlets.list() });
}

/** One outlet, shown at once from the list cache when it has it. */
export function useOutlet(id: number) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: [...OUTLETS_KEY, id],
    queryFn: () => api.outlets.get(id),
    initialData: () =>
      queryClient.getQueryData<Outlet[]>(OUTLETS_KEY)?.find((o) => o.id === id),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(OUTLETS_KEY)?.dataUpdatedAt,
  });
}

/** Writes a changed outlet into both caches. */
function useStoreOutlet() {
  const queryClient = useQueryClient();
  return (outlet: Outlet) => {
    queryClient.setQueryData<Outlet[]>(OUTLETS_KEY, (list) =>
      list?.map((o) => (o.id === outlet.id ? outlet : o)),
    );
    queryClient.setQueryData([...OUTLETS_KEY, outlet.id], outlet);
  };
}

/**
 * These fail now rather than pause offline: a save that hangs invisibly is
 * worse than one that says "Couldn't save" and can be tapped again.
 */
export function useCreateOutlet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.outlets.create({ name }),
    networkMode: 'always',
    onSuccess: (outlet) => {
      queryClient.setQueryData<Outlet[]>(OUTLETS_KEY, (list) =>
        list ? [...list, outlet] : list,
      );
      queryClient.setQueryData([...OUTLETS_KEY, outlet.id], outlet);
    },
  });
}

/** The identity carries which outlets have modules on, so it is refetched. */
function useRefreshIdentity() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
}

export function useUpdateOutlet(id: number) {
  const storeOutlet = useStoreOutlet();
  const refreshIdentity = useRefreshIdentity();
  return useMutation({
    mutationFn: (patch: UpdateOutletRequest) => api.outlets.update(id, patch),
    networkMode: 'always',
    onSuccess: (outlet, patch) => {
      storeOutlet(outlet);
      if (
        patch.attendance_enabled !== undefined ||
        patch.spot_checks_enabled !== undefined
      ) {
        void refreshIdentity();
      }
    },
  });
}

export function useArchiveOutlet(id: number) {
  const storeOutlet = useStoreOutlet();
  const refreshIdentity = useRefreshIdentity();
  return useMutation({
    mutationFn: () => api.outlets.archive(id),
    networkMode: 'always',
    onSuccess: (outlet) => {
      storeOutlet(outlet);
      void refreshIdentity();
    },
  });
}
