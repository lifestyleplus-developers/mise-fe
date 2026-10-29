import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { checklistKeys } from '@/features/checklists/checklist-keys';
import { api } from '@/shared/api/client';

const PAGE_SIZE = 20;

/**
 * Who could be added to an assignment: active people not already on it, twenty
 * at a time as the list is scrolled, and searched on the server. This is the
 * assignment's candidates list, not /users, which a Checklist Manager may not
 * read.
 */
export function usePeople(assignmentId: number, search: string) {
  return useInfiniteQuery({
    queryKey: [...checklistKeys.members(assignmentId), 'candidates', search],
    queryFn: ({ pageParam }) =>
      api.assignments.candidates(assignmentId, {
        page: pageParam,
        pageSize: PAGE_SIZE,
        search: search || undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.next ?? undefined,
    // The old results stay up while a new search loads.
    placeholderData: keepPreviousData,
  });
}
