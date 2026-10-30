import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { retryTransient } from '@/shared/api/query-helpers';
import type {
  AttendanceConfig,
  CreateAttendanceConfigRequest,
  UpdateAttendanceConfigRequest,
} from '@/shared/api/types';

import { attendanceKeys } from './attendance-keys';

/** A business has a handful of configurations per outlet, so one page holds them. */
const CONFIG_PAGE_SIZE = 100;

/** Configurations, by name. An outlet may have several (shifts). */
export function useAttendanceConfigs(
  outletId?: number,
  { includeArchived = false, enabled = true } = {},
) {
  return useQuery({
    queryKey: attendanceKeys.configs(outletId, includeArchived),
    queryFn: async (): Promise<AttendanceConfig[]> =>
      (
        await api.attendance.configs({
          page: 1,
          pageSize: CONFIG_PAGE_SIZE,
          outletId,
          includeArchived,
        })
      ).results,
    retry: retryTransient,
    enabled,
  });
}

/**
 * Who manages a configuration decides what they can mark and see, so the
 * identity and the sessions are refetched with the lists.
 */
function useConfigWrite<Variables>(
  mutationFn: (variables: Variables) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    networkMode: 'always',
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.configLists,
      });
      void queryClient.invalidateQueries({
        queryKey: attendanceKeys.sessionLists,
      });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useCreateAttendanceConfig() {
  return useConfigWrite((request: CreateAttendanceConfigRequest) =>
    api.attendance.createConfig(request),
  );
}

export function useUpdateAttendanceConfig(id: number) {
  return useConfigWrite((patch: UpdateAttendanceConfigRequest) =>
    api.attendance.updateConfig(id, patch),
  );
}

/** No more sessions are made; past ones stay. */
export function useArchiveAttendanceConfig(id: number) {
  return useConfigWrite(() => api.attendance.archiveConfig(id));
}

export function useAppointManager(configId: number) {
  return useConfigWrite((userId: number) =>
    api.attendance.appointManager(configId, { user_id: userId }),
  );
}

export function useRemoveManager(configId: number) {
  return useConfigWrite((userId: number) =>
    api.attendance.removeManager(configId, userId),
  );
}
