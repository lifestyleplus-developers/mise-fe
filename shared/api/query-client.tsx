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

/** Feeds React Query's online state from expo-network. */
onlineManager.setEventListener((setOnline) => {
  const subscription = ExpoNetwork.addNetworkStateListener((state) => {
    setOnline(state.isInternetReachable !== false);
  });
  return () => subscription.remove();
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage });

/** Auth never persists. */
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
        dehydrateOptions: { shouldDehydrateQuery: shouldDehydrateAuth },
      }}
      onSuccess={resumePaused}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
