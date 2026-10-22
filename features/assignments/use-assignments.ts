import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { checklistKeys } from '@/features/checklists/checklist-keys';
import { api } from '@/shared/api/client';
import type { OutletAssignment } from '@/shared/api/types';

/**
 * Every outlet the checklist runs or ran at. Stopped ones come back flagged
 * `is_active: false`, so a re-tick can find the people it had.
 */
export function useAssignments(checklistId: number) {
  return useQuery({
    queryKey: checklistKeys.assignments(checklistId),
    queryFn: () => api.checklists.assignments(checklistId),
  });
}

/**
 * Starting or stopping an outlet changes the cards on the Checklists tab and
 * Home's runs. Both are refetched.
 */
function useRefreshAfterAssignmentChange(checklistId: number) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({
      queryKey: checklistKeys.assignments(checklistId),
    });
    void queryClient.invalidateQueries({ queryKey: checklistKeys.lists });
    void queryClient.invalidateQueries({ queryKey: ['runs'] });
    void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
  };
}

/** Tick outlets, in bulk. Fails now rather than pausing offline. */
export function useAssignOutlets(checklistId: number) {
  const refresh = useRefreshAfterAssignmentChange(checklistId);
  return useMutation({
    mutationFn: (outletIds: number[]) =>
      api.checklists.assign(checklistId, { outlet_ids: outletIds }),
    networkMode: 'always',
    onSuccess: refresh,
  });
}

/** Untick one outlet: history stays, no further runs. */
export function useStopAssignment(checklistId: number) {
  const queryClient = useQueryClient();
  const refresh = useRefreshAfterAssignmentChange(checklistId);
  return useMutation({
    mutationFn: (assignmentId: number) =>
      api.assignments.deactivate(assignmentId),
    networkMode: 'always',
    onSuccess: (_result, assignmentId) => {
      queryClient.setQueryData<OutletAssignment[]>(
        checklistKeys.assignments(checklistId),
        (rows) =>
          rows?.map((row) =>
            row.id === assignmentId ? { ...row, is_active: false } : row,
          ),
      );
      refresh();
    },
  });
}
