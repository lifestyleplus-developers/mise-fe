import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
  /** 409 with a businesses array — picker not built; screen degrades it. */
  | { kind: 'ambiguous_username'; businesses: BusinessRef[] };

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
  // identity the mutation's onSuccess writes. The signed-in render reads it
  // here; a future Home screen reads the same key.
  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    enabled: false,
    staleTime: Infinity,
  });

  const mutation = useMutation<LoginResponse, unknown, LoginRequest>({
    mutationKey: ['auth', 'login'],
    networkMode: 'always',

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
    if (mutation.isPending) return { kind: 'submitting' };
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
        };
      }
      return { kind: 'failure', failure: classify(error) };
    }
    if (mutation.isSuccess) {
      // me-fill still in flight (or it failed — see the catch above); either
      // way the screen holds the submitting state rather than flickering.
      if (!me) return { kind: 'submitting' };
      return { kind: 'ok', fullName: me.user.full_name };
    }
    return { kind: 'idle' };
  })();

  const login = (request: LoginRequest) => mutation.mutate(request);

  const signOut = () => {
    // POST /auth/logout clears the mock session; clearing the key drops the
    // cached identity. Fire-and-forget with a guard — sign-out must succeed
    // locally even if the call fails.
    void api.auth.logout().catch(() => undefined);
    queryClient_.removeQueries({ queryKey: ['auth'] });
    mutation.reset();
  };

  return { state, login, signOut, resetLogin: mutation.reset };
}
