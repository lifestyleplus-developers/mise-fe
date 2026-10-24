import { useQuery } from '@tanstack/react-query';

import { api } from '@/shared/api/client';

/**
 * Everyone in the business, active or not, for choosing a person to put on a
 * checklist. One page of a hundred: the picker searches within it.
 */
export function usePeople() {
  return useQuery({
    queryKey: ['users', 'picker'],
    queryFn: () => api.users.list({ page: 1, pageSize: 100 }),
  });
}
