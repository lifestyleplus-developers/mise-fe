import { useInfiniteQuery } from '@tanstack/react-query';

import { checklistKeys } from '@/features/checklists/checklist-keys';
import { api } from '@/shared/api/client';

export const CHECKLISTS_PAGE_SIZE = 25;

/**
 * Every checklist the caller can see, a page at a time (§1 pagination).
 * `includeArchived` is the admin list's Archived filter; only an ADMIN or
 * OWNER gets them back.
 */
export function useChecklists({
  includeArchived = false,
}: { includeArchived?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: includeArchived
      ? [...checklistKeys.lists, 'archived']
      : checklistKeys.lists,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.checklists.list(pageParam, CHECKLISTS_PAGE_SIZE, { includeArchived }),
    getNextPageParam: (last) => last.next ?? undefined,
  });
}
