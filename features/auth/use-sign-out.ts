import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { api } from '@/shared/api/client';

/**
 * Ends the session and returns to Login. Fire-and-forget on the server call
 * with a guard — sign-out must succeed locally even if the request fails.
 * Navigation goes first so the signed-in screens are unmounted before their
 * cached identity is dropped; clearing the `auth` subtree is what stops the
 * next person on this phone inheriting the last one's cached identity.
 */
export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return () => {
    void api.auth.logout().catch(() => undefined);
    router.replace('/');
    queryClient.removeQueries({ queryKey: ['auth'] });
    // Settings' sign-out warning says unsent writes are lost; this is the
    // losing. A paused write left behind would replay against nobody.
    queryClient.getMutationCache().clear();
  };
}
