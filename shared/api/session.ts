import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** The pair `/auth/login` and `/auth/refresh` answer with. */
export type Tokens = { access: string; refresh: string };

const STORAGE_KEY = 'mise.tokens';

/**
 * The keychain (iOS) or keystore (Android). The web build has neither, so it
 * falls back to AsyncStorage there.
 */
const storage =
  Platform.OS === 'web'
    ? {
        get: () => AsyncStorage.getItem(STORAGE_KEY),
        set: (value: string) => AsyncStorage.setItem(STORAGE_KEY, value),
        remove: () => AsyncStorage.removeItem(STORAGE_KEY),
      }
    : {
        get: () => SecureStore.getItemAsync(STORAGE_KEY),
        set: (value: string) => SecureStore.setItemAsync(STORAGE_KEY, value),
        remove: () => SecureStore.deleteItemAsync(STORAGE_KEY),
      };

let tokens: Tokens | null = null;

/**
 * Read once from storage, the first time anything asks. A request waits on this
 * before it goes out, so the first call after a restart already has its token.
 */
let loaded: Promise<void> | null = null;

function load(): Promise<void> {
  loaded ??= storage
    .get()
    .then((raw) => {
      tokens = raw ? (JSON.parse(raw) as Tokens) : null;
    })
    .catch(() => {
      tokens = null;
    });
  return loaded;
}

/** The tokens now, never the ones from when a call was queued. */
export async function getTokens(): Promise<Tokens | null> {
  await load();
  return tokens;
}

/** Keep a fresh pair. Refresh rotates, so the refresh token changes every time. */
export async function setTokens(next: Tokens): Promise<void> {
  await load();
  tokens = next;
  await storage.set(JSON.stringify(next));
}

/** Sign out on this device. */
export async function clearTokens(): Promise<void> {
  await load();
  tokens = null;
  await storage.remove().catch(() => undefined);
}
