import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  focusManager,
  onlineManager,
  QueryClient,
  type Query,
} from '@tanstack/react-query';
import * as ExpoNetwork from 'expo-network';
import * as React from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

/** One client for the whole app. */
export const queryClient = new QueryClient({
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
 */
export function dropSessionCache(): void {
  queryClient.removeQueries();
  void persister.removeClient();
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
