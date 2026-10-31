import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { retryTransient } from '@/shared/api/query-helpers';
import type {
  CreateStaffRequest,
  EnrolStaffRequest,
  UpdateStaffRequest,
} from '@/shared/api/types';

import { attendanceKeys } from './attendance-keys';

const PAGE_SIZE = 25;

export type StaffFilters = {
  outletId?: number;
  search: string;
  includeArchived: boolean;
};

/**
 * The roster, 25 at a time. With an outlet it lists the people active there; to
 * see someone taken off an outlet, ask without one and read `outlets`.
 */
export function useStaff(filters: StaffFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: attendanceKeys.staffList(filters),
    queryFn: ({ pageParam }) =>
      api.staff.list({
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

/**
 * These fail now rather than pause offline: a roster edit that hangs unseen is
 * worse than "Couldn't save", which can be tapped again.
 */
function useRosterWrite<Variables, Result>(
  mutationFn: (variables: Variables) => Promise<Result>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    networkMode: 'always',
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.staffLists,
      });
    },
  });
}

export function useCreateStaff() {
  return useRosterWrite((request: CreateStaffRequest) =>
    api.staff.create(request),
  );
}

export function useUpdateStaff(id: number) {
  return useRosterWrite((patch: UpdateStaffRequest) =>
    api.staff.update(id, patch),
  );
}

/** Enrol at an outlet, or set whether they are active there. */
export function useEnrolStaff(id: number) {
  return useRosterWrite((request: EnrolStaffRequest) =>
    api.staff.enrol(id, request),
  );
}
