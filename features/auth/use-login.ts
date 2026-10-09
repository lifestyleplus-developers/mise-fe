import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import { api, MockApiError } from '@/shared/api/client';
import { dropSessionCache, queryClient } from '@/shared/api/query-client';
import {
  API_ERROR_CODE,
  type AmbiguousUsernameBody,
  type ApiErrorBody,
  type BusinessRef,
  type LoginRequest,
  type LoginResponse,
} from '@/shared/api/types';
import { LOGIN_FAILURE, type LoginFailure } from '@/shared/constants/errors';
import { useLanguageStore } from '@/shared/stores/language-store';

/** Login is the one mutation that must fire now or fail now. */
const loginMutationFn = (request: LoginRequest): Promise<LoginResponse> =>
  api.auth.login(request);

queryClient.setMutationDefaults(['auth', 'login'], {
  mutationFn: loginMutationFn,
  networkMode: 'always',
});

/** What the login screen renders. */
export type LoginState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  /** Signed in; identity read straight from the ['auth','me'] cache. */
  | { kind: 'ok'; fullName: string }
  | { kind: 'failure'; failure: LoginFailure }
  /** 409 with a businesses array — the screen shows the picker. */
  | {
      kind: 'ambiguous_username';
      businesses: BusinessRef[];
      choosingId: number | null;
    };

function classify(error: unknown): LoginFailure {
  if (!(error instanceof MockApiError)) return LOGIN_FAILURE.UNREACHABLE;

  const { code } = error.body.error;
  if (code === API_ERROR_CODE.INVALID_CREDENTIALS) {
    return LOGIN_FAILURE.INVALID_CREDENTIALS;
  }
  if (error.status === 429) return LOGIN_FAILURE.RATE_LIMITED;
  return LOGIN_FAILURE.UNREACHABLE;
}

export function useLogin() {
  const queryClient_ = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    enabled: false,
    staleTime: Infinity,
  });

  const [candidates, setCandidates] = React.useState<BusinessRef[] | null>(
    null,
  );
  const lastRequest = React.useRef<LoginRequest | null>(null);

  const mutation = useMutation<LoginResponse, unknown, LoginRequest>({
    mutationKey: ['auth', 'login'],
    networkMode: 'always',

    onError: (error) => {
      if (
        error instanceof MockApiError &&
        error.body.error.code === API_ERROR_CODE.AMBIGUOUS_USERNAME
      ) {
        setCandidates(
          (error.body as ApiErrorBody & AmbiguousUsernameBody).businesses,
        );
      } else {
        setCandidates(null);
      }
    },

    onSuccess: () => {
      // Whoever just signed in must never read what the last session cached.
      dropSessionCache();
      queryClient_
        .fetchQuery({ queryKey: ['auth', 'me'], queryFn: () => api.auth.me() })
        .then((meResponse) => {
          useLanguageStore
            .getState()
            .setLanguage(meResponse.user.interface_language);
        })
        .catch(() => undefined);
    },
  });

  const state: LoginState = (() => {
    if (mutation.isPending) {
      const choosingId = mutation.variables?.tenant_id;
      if (candidates && choosingId !== undefined) {
        return {
          kind: 'ambiguous_username',
          businesses: candidates,
          choosingId,
        };
      }
      return { kind: 'submitting' };
    }
    if (mutation.isError) {
      const error = mutation.error;
      if (
        error instanceof MockApiError &&
        error.body.error.code === API_ERROR_CODE.AMBIGUOUS_USERNAME
      ) {
        return {
          kind: 'ambiguous_username',
          businesses: (error.body as ApiErrorBody & AmbiguousUsernameBody)
            .businesses,
          choosingId: null,
        };
      }
      return { kind: 'failure', failure: classify(error) };
    }
    if (mutation.isSuccess) {
      if (!me) {
        const choosingId = mutation.variables?.tenant_id;
        if (candidates && choosingId !== undefined) {
          return {
            kind: 'ambiguous_username',
            businesses: candidates,
            choosingId,
          };
        }
        return { kind: 'submitting' };
      }
      return { kind: 'ok', fullName: me.user.full_name };
    }
    return { kind: 'idle' };
  })();

  const login = (request: LoginRequest) => {
    lastRequest.current = request;
    mutation.mutate(request);
  };

  /** §2: resend the same credentials with the chosen business's id. */
  const chooseBusiness = (tenantId: number) => {
    if (!lastRequest.current) return;
    mutation.mutate({ ...lastRequest.current, tenant_id: tenantId });
  };

  const resetLogin = () => {
    setCandidates(null);
    mutation.reset();
  };

  return { state, login, chooseBusiness, resetLogin };
}
