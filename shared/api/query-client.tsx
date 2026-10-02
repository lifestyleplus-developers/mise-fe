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

/**
 * One client for the whole app. The async-storage persister is the
 * foundation of the retry queue (Model §13 / FE Spec §6): queries survive a
 * restart, and once mutations are configured to persist, paused writes do
 * too. Nothing is configured to persist yet — login deliberately must not.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Server state is refetchable; a day keeps the persisted cache useful
      // across restarts without growing unbounded.
      gcTime: 1000 * 60 * 60 * 24,
    },
    mutations: {
      // 'online' is the default and is stated here as policy: mutations may
      // pause while offline and resume on focus, but nothing retries blindly.
      // The login mutation narrows this further — see use-login.ts.
      networkMode: 'online',
    },
  },
});

/**
 * React Query assumes it is online on React Native — there is no browser
 * `online` event — so without this a write made offline fails instead of
 * pausing, and `networkMode: 'online'` below would do nothing. Fed from
 * expo-network; an unknown reachability counts as online, never as a reason
 * to hold a write back.
 */
onlineManager.setEventListener((setOnline) => {
  const subscription = ExpoNetwork.addNetworkStateListener((state) => {
    setOnline(state.isInternetReachable !== false);
  });
  return () => subscription.remove();
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage });

/**
 * Auth never persists. §8: the mock session lives in module memory and dies
 * with the JS context, while a persisted `['auth','me']` would survive the
 * restart — cache says signed-in, backend says nobody is, and the first
 * refetch answers token_expired to a screen that believed the cache. (A
 * real token store changes this calculus, and gets to opt back in.)
 */
function shouldDehydrateAuth(query: Query) {
  return query.queryKey[0] !== 'auth';
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

/**
 * Provider for the whole app. Restoring the persisted cache gates children —
 * a second hydration gate alongside the theme store's in _layout.tsx, and
 * for the same reason: rendering before the cache is read would show a
 * signed-out frame to someone who is signed in.
 */
export function ApiProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // RN has no window focus; AppState stands in, so refetchOnWindowFocus
    // and focus-driven behaviour work as on web.
    const appState = AppState.addEventListener('change', onAppStateChange);
    // v5 does not resume paused mutations by itself — the persist plugin
    // restores the cache but nothing replays writes. Connectivity recovery
    // and app foregrounding are the two moments a paused write can proceed.
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
        dehydrateOptions: { shouldDehydrateQuery: shouldDehydrateAuth },
      }}
      // Fires once after restore; the last of the three resume moments
      // (restore, reconnect, foreground) a paused write can proceed at.
      onSuccess={resumePaused}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
