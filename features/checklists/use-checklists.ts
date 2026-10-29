import { useInfiniteQuery } from '@tanstack/react-query';

import { checklistKeys } from '@/features/checklists/checklist-keys';
import { api } from '@/shared/api/client';

export const CHECKLISTS_PAGE_SIZE = 25;

/**
 * Every checklist the caller can see, a page at a time (§1 pagination).
 * `archivedOnly` is the admin list's Archived filter: the server sends only the
 * archived ones, and only an ADMIN or OWNER gets them.
 */
export function useChecklists({
  archivedOnly = false,
}: { archivedOnly?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: archivedOnly
      ? [...checklistKeys.lists, 'archived']
      : checklistKeys.lists,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.checklists.list(pageParam, CHECKLISTS_PAGE_SIZE, { archivedOnly }),
    getNextPageParam: (last) => last.next ?? undefined,
  });
}
