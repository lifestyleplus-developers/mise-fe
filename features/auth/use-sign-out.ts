import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { api } from '@/shared/api/client';

/** Ends the session and returns to Login. */
export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return () => {
    void api.auth.logout().catch(() => undefined);
    router.replace('/');
    queryClient.removeQueries({ queryKey: ['auth'] });
    queryClient.getMutationCache().clear();
  };
}
