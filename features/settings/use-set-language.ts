import {
  useMutation,
  useMutationState,
  type Mutation,
} from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { queryClient } from '@/shared/api/query-client';
import type { MeResponse } from '@/shared/api/types';
import type { InterfaceLanguage } from '@/shared/constants/languages';
import { useLanguageStore } from '@/shared/stores/language-store';

const SET_LANGUAGE_KEY = ['auth', 'set-language'] as const;

/**
 * PATCH /auth/me. `networkMode: 'online'` pauses it while offline and
 * resumes it on reconnect or foreground (see query-client.tsx), which is what
 * the "waiting to save" pill reports. The scope serialises it: two quick
 * changes offline must reach the server in the order they were made, or the
 * older one could land last and win.
 */
queryClient.setMutationDefaults(SET_LANGUAGE_KEY, {
  mutationFn: (language: InterfaceLanguage) =>
    api.auth.updateMe({ interface_language: language }),
  networkMode: 'online',
  scope: { id: 'set-language' },
  onSuccess: (me: MeResponse) => {
    queryClient.setQueryData(['auth', 'me'], me);
  },
});

/**
 * Picking a language. The interface changes at once — the store is the
 * source the screens render from — and the account catches up when it can.
 * Model §15: the language is a property of the user, so it must reach the
 * platform, but a slow save never holds the screen back.
 */
export function useSetLanguage() {
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const mutation = useMutation<MeResponse, unknown, InterfaceLanguage>({
    mutationKey: SET_LANGUAGE_KEY,
  });

  return (language: InterfaceLanguage) => {
    setLanguage(language);
    mutation.mutate(language);
  };
}

type SetLanguageMutation = Mutation<
  MeResponse,
  unknown,
  InterfaceLanguage,
  unknown
>;

/**
 * Whether a language choice has not reached the account. `waiting` is the
 * stalled kind — queued behind no connection — which Settings shows as a
 * pill; `unsaved` also counts one in flight, which is what sign-out must
 * warn about, since leaving then loses it too.
 */
export function useLanguageSaveState() {
  const pending = useMutationState({
    filters: { mutationKey: SET_LANGUAGE_KEY, status: 'pending' },
    select: (mutation: SetLanguageMutation) => mutation.state.isPaused,
  });
  return {
    waiting: pending.some(Boolean),
    unsaved: pending.length > 0,
  };
}
