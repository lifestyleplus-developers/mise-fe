import { useRouter } from 'expo-router';

import { api } from '@/shared/api/client';
import { dropSessionCache, queryClient } from '@/shared/api/query-client';

/** Ends the session and returns to Login. */
export function useSignOut() {
  const router = useRouter();

  return () => {
    void api.auth.logout().catch(() => undefined);
    router.replace('/');
    // clear() also drops queued writes, which do not survive sign-out (§6).
    queryClient.clear();
    dropSessionCache();
  };
}
