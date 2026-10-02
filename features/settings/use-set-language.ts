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

/** PATCH /auth/me. Pauses while offline; the scope keeps saves in order. */
queryClient.setMutationDefaults(SET_LANGUAGE_KEY, {
  mutationFn: (language: InterfaceLanguage) =>
    api.auth.updateMe({ interface_language: language }),
  networkMode: 'online',
  scope: { id: 'set-language' },
  onSuccess: (me: MeResponse) => {
    queryClient.setQueryData(['auth', 'me'], me);
  },
});

/** Applies the language locally at once, then saves it to the account. */
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

/** `waiting`: queued offline. `unsaved`: queued or in flight. */
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
