import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import { api, MockApiError } from '@/shared/api/client';
import { queryClient } from '@/shared/api/query-client';
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

/**
 * Login is the one mutation that must fire now or fail now. `'always'`
 * attempts the request even with no network, so the transport fails and the
 * user sees "Can't reach mise" — 'online' (the client default) would PAUSE
 * an offline attempt and replay it when the provider resumes paused
 * mutations, silently resubmitting stale credentials. Persistence is not a
 * concern here: v5's persister dehydrates queries only, so no mutation can
 * land in AsyncStorage. The retry queue is for checklist answers, never
 * credentials.
 */
const loginMutationFn = (request: LoginRequest): Promise<LoginResponse> =>
  api.auth.login(request);

queryClient.setMutationDefaults(['auth', 'login'], {
  mutationFn: loginMutationFn,
  networkMode: 'always',
});

/**
 * What the login screen renders. Derived entirely from mutation and cache
 * state in the hook — the screen holds no async state of its own, so an
 * unmount mid-flight has nothing to write to (issue 4's property, without
 * leaning on callback-after-unmount semantics).
 */
export type LoginState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  /** Signed in; identity read straight from the ['auth','me'] cache. */
  | { kind: 'ok'; fullName: string }
  | { kind: 'failure'; failure: LoginFailure }
  /**
   * 409 with a businesses array — the screen shows the picker. `choosingId`
   * is the business already picked while its resend is in flight, so the
   * picker stays up showing which row is signing in rather than flashing
   * away and back.
   */
  | {
      kind: 'ambiguous_username';
      businesses: BusinessRef[];
      choosingId: number | null;
    };

function classify(error: unknown): LoginFailure {
  // No response at all — transport died. (Also what the mock's "offline"
  // username throws.)
  if (!(error instanceof MockApiError)) return LOGIN_FAILURE.UNREACHABLE;

  const { code } = error.body.error;
  if (code === API_ERROR_CODE.INVALID_CREDENTIALS) {
    return LOGIN_FAILURE.INVALID_CREDENTIALS;
  }
  // 429 carries a status but no code string (API Contract §15); everything
  // else a login can receive — ambiguous_username handled before this, an
  // expired token impossible pre-auth, server faults — reads as unreachable.
  if (error.status === 429) return LOGIN_FAILURE.RATE_LIMITED;
  return LOGIN_FAILURE.UNREACHABLE;
}

export function useLogin() {
  const queryClient_ = useQueryClient();

  // Subscribed, never fetched (enabled: false) — the hook's window onto the
  // identity the mutation's onSuccess writes. Home reads the same key
  // through useMe.
  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    enabled: false,
    staleTime: Infinity,
  });

  // The businesses a 409 offered. Held beside the mutation because resending
  // with a tenant_id replaces the mutation's error — and with it the list —
  // while the picker still has to render. Cleared by anything that is not
  // the picker's own flow: success, another failure, cancel.
  const [candidates, setCandidates] = React.useState<BusinessRef[] | null>(
    null,
  );
  // What the resend repeats. A ref, not state: nothing renders from it.
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
      // Fill ['auth','me'] the way the real flow will — GET /auth/me after
      // sign-in. Default staleTime (0) means every login refetches, so
      // switching personas never serves the previous persona's identity.
      // Fire-and-forget with a guard: the sign-in itself succeeded, so a
      // failure here must not surface as a login failure — the screen stays
      // on the form instead of showing a phantom error.
      queryClient_
        .fetchQuery({ queryKey: ['auth', 'me'], queryFn: () => api.auth.me() })
        .then((meResponse) => {
          // §15: the language is a property of the user, not the device —
          // sign-in adopts what /auth/me reports.
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
          // The 409 body is the error envelope plus the businesses array —
          // the same intersection the mock types it with.
          businesses: (error.body as ApiErrorBody & AmbiguousUsernameBody)
            .businesses,
          choosingId: null,
        };
      }
      return { kind: 'failure', failure: classify(error) };
    }
    if (mutation.isSuccess) {
      // me-fill still in flight (or it failed — see the catch above); either
      // way the screen holds the submitting state rather than flickering.
      if (!me) {
        // A picked business keeps its picker (row spinning) until the
        // redirect, instead of flashing the form between the two.
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
