import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { checklistKeys } from '@/features/checklists/checklist-keys';
import { api } from '@/shared/api/client';
import type { AssignmentMember, AssignmentRole } from '@/shared/api/types';

import { currentMembers, removedMembers } from './team';

/** The members query and `useTeams` share a key, so they share this shape. */
async function fetchMembers(assignmentId: number) {
  return currentMembers(await api.assignments.members(assignmentId));
}

/** Both buckets of one assignment, Checklist Managers first. */
export function useMembers(
  assignmentId: number,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: checklistKeys.members(assignmentId),
    queryFn: () => fetchMembers(assignmentId),
    enabled,
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
 * do, so the identity and the runs are refetched along with the list. The
 * people taken off are refetched too, since a removal adds to them.
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
      void queryClient.invalidateQueries({
        queryKey: checklistKeys.pastMembers(assignmentId),
      });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['runs'] });
    },
  };
}

/** Fails now rather than pausing offline: the same tap retries. */
export function useAddMember(assignmentId: number) {
  const cache = useMembersCache(assignmentId);
  return useMutation({
    mutationFn: async (request: { userId: number; role: AssignmentRole }) =>
      currentMembers(
        await api.assignments.addMember(assignmentId, {
          user_id: request.userId,
          role: request.role,
        }),
      ),
    networkMode: 'always',
    // The platform answers with the team as it now stands.
    onSuccess: (team) => {
      cache.write(() => team);
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

/**
 * The people taken off an assignment, latest first, with when and by whom.
 * Only fetched while asked for (`enabled`): it is a sheet, not the screen.
 */
export function usePastMembers(
  assignmentId: number,
  { enabled }: { enabled: boolean },
) {
  return useQuery({
    queryKey: checklistKeys.pastMembers(assignmentId),
    queryFn: async () =>
      removedMembers(
        await api.assignments.members(assignmentId, { includeRemoved: true }),
      ),
    enabled,
  });
}

/**
 * The people on several assignments at once, by assignment id. An assignment
 * whose list has not arrived yet is absent from the map.
 */
export function useTeams(assignmentIds: readonly number[]) {
  return useQueries({
    queries: assignmentIds.map((id) => ({
      queryKey: checklistKeys.members(id),
      queryFn: () => fetchMembers(id),
    })),
    combine: (results) => ({
      byAssignment: Object.fromEntries(
        assignmentIds.flatMap((id, index) =>
          results[index]?.data ? [[id, results[index].data]] : [],
        ),
      ) as Record<number, AssignmentMember[]>,
      isPending: results.some((result) => result.isPending),
    }),
  });
}
