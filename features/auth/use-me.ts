import { useQuery } from '@tanstack/react-query';

import { api, MockApiError } from '@/shared/api/client';
import { API_ERROR_CODE } from '@/shared/api/types';

/**
 * GET /auth/me — §2: "call this on every launch. It drives navigation."
 * Everything that needs to know who is signed in reads this one key; the
 * login mutation fills it, sign-out removes it.
 *
 * `retry: false` because the failure that matters here — an expired or
 * missing session — must reach the shell at once so it can send the user
 * back to Login, not after three backed-off attempts. The shell's Retry
 * button covers the transient case. The one-minute stale time stops every
 * tab mounting from refetching an answer that was fresh a moment ago; a
 * foregrounded app still refreshes it once stale (FE Spec §10).
 */
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
