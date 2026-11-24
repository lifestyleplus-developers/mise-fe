import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  focusManager,
  MutationCache,
  onlineManager,
  QueryCache,
  QueryClient,
  type Query,
} from '@tanstack/react-query';
import * as ExpoNetwork from 'expo-network';
import { router } from 'expo-router';
import * as React from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { runSignOutHandlers } from '@/shared/lib/on-sign-out';
import {
  useHeldWrites,
  type HeldWrite,
} from '@/shared/stores/held-writes-store';
import { useSessionOwner } from '@/shared/stores/session-owner-store';

import { ApiError } from './http';
import { reportLateWrite } from './late-writes';
import { API_ERROR_CODE } from './types';
import { getTokens } from './session';

/** When the last session end was handled; several queries fail on one 401. */
let lastSessionEnd = 0;

/**
 * A query answered 401 after the refresh was refused (§15): the session is
 * over while the app is open — the refresh token expired, the account was
 * deactivated or its password reset. Queries keep their last data when a
 * refetch fails, so no screen would notice; clean up and go to Login here.
 */
async function onQueryError(error: Error): Promise<void> {
  if (!(error instanceof ApiError) || error.status !== 401) return;
  // Tokens are cleared when a refresh is refused. If some exist, a newer
  // sign-in has happened and this is a late answer to the old session.
  if (await getTokens()) return;
  const now = Date.now();
  if (now - lastSessionEnd < 5000) return;
  lastSessionEnd = now;
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
  endSession();
  runSignOutHandlers(undefined);
}

/**
 * A write refused because its window had closed (409 `window_closed`). It is the
 * one refusal the person must be told about wherever they are: they did the work
 * and the record will not show it (FE Spec §6).
 */
function onMutationError(
  error: Error,
  variables: unknown,
  context: unknown,
  mutationKey: readonly unknown[] | undefined,
  meta: Record<string, unknown> | undefined,
): void {
  if (!mutationKey) return;
  if (
    error instanceof ApiError &&
    error.body.error.code === API_ERROR_CODE.WINDOW_CLOSED
  ) {
    reportLateWrite({ mutationKey, variables, context, meta });
  }
}

/** One client for the whole app. */
export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, variables, context, mutation) =>
      onMutationError(
        error,
        variables,
        context,
        mutation.options.mutationKey,
        mutation.meta,
      ),
  }),
  queryCache: new QueryCache({ onError: (error) => void onQueryError(error) }),
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
    },
    mutations: {
      networkMode: 'online',
    },
  },
});

/** expo-network leaves this undefined when it cannot tell; only an explicit false is offline. */
function isOnline(state: ExpoNetwork.NetworkState): boolean {
  return state.isInternetReachable !== false;
}

/** Feeds React Query's online state from expo-network. */
onlineManager.setEventListener((setOnline) => {
  // The listener only fires on a *change*, so an app opened with no signal
  // would look online until signal returned — long enough to fail a write
  // that should have been queued. Ask once for the state it started in.
  let reported = false;

  void ExpoNetwork.getNetworkStateAsync()
    .then((state) => {
      // A real change may have landed first; it is the newer answer.
      if (!reported) setOnline(isOnline(state));
    })
    .catch(() => undefined);

  const subscription = ExpoNetwork.addNetworkStateListener((state) => {
    reported = true;
    setOnline(isOnline(state));
  });
  return () => subscription.remove();
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage });

/**
 * Drops everything cached for the session that is ending — the in-memory
 * queries and the copy on the phone.
 *
 * The persisted cache is not labelled with who it belongs to, so it must be
 * emptied at both ends of a session: on sign-out, and again on sign-in, since
 * the app can be force-closed in between and restored with the previous
 * person's outlets, users and checklists still in it.
 *
 * Queued writes go too: they were made as the previous person, and sent with
 * the next person's token they would be recorded as theirs. The login call
 * itself (the `auth` mutations) is the one thing left, as it is mid-flight when
 * this runs at sign-in.
 */
export function dropSessionCache(): void {
  queryClient.removeQueries();
  const mutations = queryClient.getMutationCache();
  for (const mutation of mutations.getAll()) {
    if (mutation.options.mutationKey?.[0] !== 'auth') {
      mutations.remove(mutation);
    }
  }
  void persister.removeClient();
}

/** Reads what a late dialog will need about a write. Registered by the features. */
let describeWrite: (
  key: readonly unknown[],
  variables: unknown,
) => unknown = () => undefined;

export function setWriteDescriber(
  describe: (key: readonly unknown[], variables: unknown) => unknown,
): void {
  describeWrite = describe;
}

/**
 * The platform ended the session while the app was open or on launch. The work
 * the person did is kept for them: what is waiting to send moves to a store
 * under their name and goes out when they sign in again (FE Spec §6, §2). Sent
 * with another person's token it would be recorded as theirs, so nobody else
 * can send it. What the platform refused stays refused, and the rest of the
 * session's cache goes as on sign-out.
 */
export function endSession(): void {
  const { owner } = useSessionOwner.getState();
  if (owner) {
    const held: HeldWrite[] = [];
    for (const mutation of queryClient.getMutationCache().getAll()) {
      const key = mutation.options.mutationKey;
      const { status, isPaused, variables, error } = mutation.state;
      if (!key || key[0] === 'auth' || variables === undefined) continue;
      const waiting =
        (status === 'pending' && isPaused) ||
        (status === 'error' &&
          (!(error instanceof ApiError) || error.status === 401));
      if (!waiting) continue;
      held.push({
        ownerId: owner.userId,
        ownerName: owner.name,
        businessId: owner.businessId,
        mutationKey: key,
        variables,
        detail: describeWrite(key, variables),
      });
    }
    if (held.length > 0) useHeldWrites.getState().hold(held);
  }
  useSessionOwner.getState().markEnded();
  dropSessionCache();
}

/** Auth never persists; neither does a query still in flight. */
function shouldPersist(query: Query) {
  return query.queryKey[0] !== 'auth' && query.state.status === 'success';
}

/** Resume any mutations that went offline mid-flight (retry queue seed). */
function resumePaused() {
  void queryClient.resumePausedMutations();
}

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
    if (status === 'active') resumePaused();
  }
}

/** Provider for the whole app. */
export function ApiProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const appState = AppState.addEventListener('change', onAppStateChange);
    const network = ExpoNetwork.addNetworkStateListener((event) => {
      if (event.isInternetReachable) resumePaused();
    });
    return () => {
      appState.remove();
      network.remove();
    };
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
      }}
      onSuccess={resumePaused}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
