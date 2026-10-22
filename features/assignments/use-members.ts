import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { checklistKeys } from '@/features/checklists/checklist-keys';
import { api } from '@/shared/api/client';
import type { AssignmentMember, AssignmentRole } from '@/shared/api/types';

/** Both buckets of one assignment, Checklist Managers first. */
export function useMembers(assignmentId: number) {
  return useQuery({
    queryKey: checklistKeys.members(assignmentId),
    queryFn: () => api.assignments.members(assignmentId),
  });
}

/** Managers before Team Members, then by name: the order the platform uses. */
function inOrder(members: AssignmentMember[]): AssignmentMember[] {
  return [...members].sort(
    (a, b) =>
      a.role.localeCompare(b.role) || a.full_name.localeCompare(b.full_name),
  );
}

/**
 * Who is on an assignment decides what Home shows and what the caller may
 * do, so the identity and the runs are refetched along with the list.
 */
function useMembersCache(assignmentId: number) {
  const queryClient = useQueryClient();
  return {
    write: (update: (members: AssignmentMember[]) => AssignmentMember[]) =>
      queryClient.setQueryData<AssignmentMember[]>(
        checklistKeys.members(assignmentId),
        (members) => members && inOrder(update(members)),
      ),
    refreshAround: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['runs'] });
    },
  };
}

/** Fails now rather than pausing offline: the same tap retries. */
export function useAddMember(assignmentId: number) {
  const cache = useMembersCache(assignmentId);
  return useMutation({
    mutationFn: (request: { userId: number; role: AssignmentRole }) =>
      api.assignments.addMember(assignmentId, {
        user_id: request.userId,
        role: request.role,
      }),
    networkMode: 'always',
    onSuccess: (member) => {
      cache.write((members) => [...members, member]);
      cache.refreshAround();
    },
  });
}

export function useRemoveMember(assignmentId: number) {
  const cache = useMembersCache(assignmentId);
  return useMutation({
    mutationFn: (userId: number) =>
      api.assignments.removeMember(assignmentId, userId),
    networkMode: 'always',
    onSuccess: (_result, userId) => {
      cache.write((members) => members.filter((m) => m.user_id !== userId));
      cache.refreshAround();
    },
  });
}
