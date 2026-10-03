import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import type {
  CreateUserRequest,
  Page,
  UpdateUserRequest,
  User,
} from '@/shared/api/types';
import type { Role } from '@/shared/constants/roles';

const PAGE_SIZE = 20;

export type UserFilters = { role?: Role; isActive: boolean; search: string };

/** People matching the filters, a page at a time. */
export function useUsers(filters: UserFilters) {
  return useInfiniteQuery({
    queryKey: ['users', 'list', filters],
    queryFn: ({ pageParam }) =>
      api.users.list({
        page: pageParam,
        pageSize: PAGE_SIZE,
        role: filters.role,
        isActive: filters.isActive,
        search: filters.search || undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.next ?? undefined,
    placeholderData: keepPreviousData,
  });
}

/** One person, shown at once from any cached list that has them. */
export function useUser(id: number) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => api.users.get(id),
    initialData: () => {
      const lists = queryClient.getQueriesData<InfiniteData<Page<User>>>({
        queryKey: ['users', 'list'],
      });
      for (const [, data] of lists) {
        const found = data?.pages
          .flatMap((page) => page.results)
          .find((user) => user.id === id);
        if (found) return found;
      }
      return undefined;
    },
  });
}

/**
 * These fail now rather than pause offline: a save that hangs invisibly is
 * worse than "Couldn't save", which can be tapped again.
 */
export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateUserRequest) => api.users.create(request),
    networkMode: 'always',
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['users', 'list'] }),
  });
}

/** Also refreshes the identity: the person may be the signed-in one. */
export function useUpdateUser(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateUserRequest) => api.users.update(id, patch),
    networkMode: 'always',
    onSuccess: (user) => {
      queryClient.setQueryData(['users', id], user);
      void queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useResetPassword(id: number) {
  return useMutation({
    mutationFn: (password: string) => api.users.resetPassword(id, { password }),
    networkMode: 'always',
  });
}
