import type { AttendanceSessionsQuery, StaffQuery } from '@/shared/api/types';

/** Query keys for staff, configurations and sessions; `['attendance']` is all of it. */
export const attendanceKeys = {
  all: ['attendance'] as const,
  staffLists: ['attendance', 'staff'] as const,
  staffList: (filters: Omit<StaffQuery, 'page' | 'pageSize'>) =>
    ['attendance', 'staff', filters] as const,
  configs: (outletId: number | undefined, includeArchived: boolean) =>
    ['attendance', 'configs', outletId ?? null, includeArchived] as const,
  configLists: ['attendance', 'configs'] as const,
  sessionLists: ['attendance', 'sessions'] as const,
  sessionList: (filters: Omit<AttendanceSessionsQuery, 'page' | 'pageSize'>) =>
    ['attendance', 'sessions', 'list', filters] as const,
  openSessions: (outletId: number | undefined) =>
    ['attendance', 'sessions', 'open', outletId ?? null] as const,
  session: (id: number) => ['attendance', 'sessions', id] as const,
};
