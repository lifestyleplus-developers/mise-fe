import { useQuery } from '@tanstack/react-query';

import { api, MockApiError } from '@/shared/api/client';
import { API_ERROR_CODE } from '@/shared/api/types';

/** GET /auth/me — called on every launch (§2). */
export function useMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    retry: false,
    staleTime: 60_000,
  });
}

/** True when the platform says there is no usable session (401). */
export function isSessionExpired(error: unknown): boolean {
  return (
    error instanceof MockApiError &&
    error.body.error.code === API_ERROR_CODE.TOKEN_EXPIRED
  );
}
