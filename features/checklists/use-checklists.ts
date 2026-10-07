import { useInfiniteQuery } from '@tanstack/react-query';

import { api } from '@/shared/api/client';

export const CHECKLISTS_PAGE_SIZE = 25;

/** Every checklist the caller can see, a page at a time (§1 pagination). */
export function useChecklists() {
  return useInfiniteQuery({
    queryKey: ['checklists'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.checklists.list(pageParam, CHECKLISTS_PAGE_SIZE),
    getNextPageParam: (last) => last.next ?? undefined,
  });
}
