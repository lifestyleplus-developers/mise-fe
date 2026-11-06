import { useRouter } from 'expo-router';

import { usePhotoOutbox } from '@/features/spot-checks/photo-outbox';
import { usePlatformLimits } from '@/features/spot-checks/platform-limits';
import { api } from '@/shared/api/client';
import { dropSessionCache, queryClient } from '@/shared/api/query-client';
import type { MeResponse } from '@/shared/api/types';

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
    // This person's spot-check photographs not yet in storage do not outlive the
    // session either; another person's on the same phone are left alone.
    if (userId !== undefined) usePhotoOutbox.getState().clearFor(userId);
    // What this session learned about the platform does not carry to the next.
    usePlatformLimits.getState().reset();
  };
}
