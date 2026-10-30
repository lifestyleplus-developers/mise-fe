import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { retryTransient } from '@/shared/api/query-helpers';
import type { AttendanceSession } from '@/shared/api/types';

import { attendanceKeys } from './attendance-keys';

const PAGE_SIZE = 25;

export type SessionFilters = {
  outletId?: number;
  state?: 'open' | 'upcoming' | 'closed';
  /** Dates, YYYY-MM-DD; both inclusive. */
  from?: string;
  to?: string;
};

/** Sessions, newest window first, 25 at a time. */
export function useAttendanceSessions(filters: SessionFilters) {
  return useInfiniteQuery({
    queryKey: attendanceKeys.sessionList(filters),
    queryFn: ({ pageParam }) =>
      api.attendance.sessions({
        ...filters,
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.next ?? undefined,
    placeholderData: keepPreviousData,
    retry: retryTransient,
  });
}

/** How often the open list is asked again, so a session that has closed drops out. */
const OPEN_REFRESH_MS = 60_000;

/** The sessions open right now: Marking's picker, and the open-now card in history. */
export function useOpenSessions(outletId?: number) {
  return useQuery({
    queryKey: attendanceKeys.openSessions(outletId),
    queryFn: async (): Promise<AttendanceSession[]> =>
      (
        await api.attendance.sessions({
          page: 1,
          pageSize: 100,
          outletId,
          state: 'open',
        })
      ).results,
    refetchInterval: OPEN_REFRESH_MS,
    retry: retryTransient,
  });
}

/** One session with its roster snapshot. */
export function useAttendanceSession(id: number | undefined) {
  return useQuery({
    queryKey: attendanceKeys.session(id ?? 0),
    queryFn: () => api.attendance.session(id!),
    enabled: id !== undefined,
    retry: retryTransient,
  });
}
