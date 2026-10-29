import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { api } from '@/shared/api/client';

const PAGE_SIZE = 20;

/**
 * Everyone in the business, active or not, for choosing a person to put on a
 * checklist: twenty at a time as the list is scrolled, and searched on the
 * server, so anyone can be found however many people there are.
 */
export function usePeople(search: string) {
  return useInfiniteQuery({
    queryKey: ['users', 'picker', search],
    queryFn: ({ pageParam }) =>
      api.users.list({
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
