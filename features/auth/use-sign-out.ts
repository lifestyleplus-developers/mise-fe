import { useRouter } from 'expo-router';

import { api } from '@/shared/api/client';
import { dropSessionCache, queryClient } from '@/shared/api/query-client';
import type { MeResponse } from '@/shared/api/types';
import { runSignOutHandlers } from '@/shared/lib/on-sign-out';

/** Ends the session and returns to Login. */
export function useSignOut() {
  const router = useRouter();

  return () => {
    // Who is signing out, read before the cache is emptied.
    const userId = queryClient.getQueryData<MeResponse>(['auth', 'me'])?.user
      .id;
    void api.auth.logout().catch(() => undefined);
    // Drop Home, More, Settings… from the history, so back cannot reach them.
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
    // clear() also drops queued writes, which do not survive sign-out (§6).
    queryClient.clear();
    dropSessionCache();
    // Each feature that keeps data on the phone clears its own.
    runSignOutHandlers(userId);
  };
}
