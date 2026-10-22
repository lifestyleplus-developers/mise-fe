import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { checklistKeys } from '@/features/checklists/checklist-keys';
import { api } from '@/shared/api/client';
import type {
  Checklist,
  ChecklistDetail,
  CreateChecklistRequest,
  UpdateChecklistRequest,
} from '@/shared/api/types';

/** One checklist with its tasks. */
export function useChecklist(id: number) {
  return useQuery({
    queryKey: checklistKeys.detail(id),
    queryFn: () => api.checklists.get(id),
  });
}

/**
 * A change to the schedule or to whether a checklist exists reaches every
 * list, and Home: which runs there are, and when, depends on it.
 */
function refreshAfterScheduleChange(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: checklistKeys.lists });
  void queryClient.invalidateQueries({ queryKey: ['runs'] });
}

/** Writes a changed checklist into its detail, keeping the tasks it holds. */
function useStoreChecklist() {
  const queryClient = useQueryClient();
  return (checklist: Checklist) => {
    queryClient.setQueryData<ChecklistDetail>(
      checklistKeys.detail(checklist.id),
      (detail) => detail && { ...detail, ...checklist },
    );
    refreshAfterScheduleChange(queryClient);
  };
}

/**
 * These fail now rather than pause offline: a save that hangs invisibly is
 * worse than one that says "Couldn't save" and can be tapped again.
 */
export function useCreateChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateChecklistRequest) =>
      api.checklists.create(request),
    networkMode: 'always',
    onSuccess: () => refreshAfterScheduleChange(queryClient),
  });
}

export function useUpdateChecklist(id: number) {
  const storeChecklist = useStoreChecklist();
  return useMutation({
    mutationFn: (request: UpdateChecklistRequest) =>
      api.checklists.update(id, request),
    networkMode: 'always',
    onSuccess: storeChecklist,
  });
}

export function useArchiveChecklist(id: number) {
  const queryClient = useQueryClient();
  const storeChecklist = useStoreChecklist();
  return useMutation({
    mutationFn: () => api.checklists.archive(id),
    networkMode: 'always',
    onSuccess: (checklist) => {
      storeChecklist(checklist);
      // Archiving stops it at every outlet.
      void queryClient.invalidateQueries({
        queryKey: checklistKeys.assignments(id),
      });
    },
  });
}

export function useRestoreChecklist(id: number) {
  const storeChecklist = useStoreChecklist();
  return useMutation({
    mutationFn: () => api.checklists.restore(id),
    networkMode: 'always',
    onSuccess: storeChecklist,
  });
}
