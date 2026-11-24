import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/shared/api/client';
import { USE_REAL_API } from '@/shared/api/http';

/**
 * Remote push needs a development build: Expo Go on Android dropped it in
 * SDK 53, and calling the push-token APIs there throws. On the web there is no
 * push at all.
 */
export const pushSupported =
  Platform.OS !== 'web' &&
  !(
    Platform.OS === 'android' &&
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  );

/** True when the phone lets us show notifications. Never asks. */
export async function isAllowed(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/** The system's own question. Resolves to whether the answer was yes. */
export async function askSystem(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Give the platform this phone's Expo push token. Quietly does nothing when it
 * cannot: no permission, a simulator (no token), the mock, or the platform
 * refusing. A person must still be able to use the app without notifications.
 */
export async function registerPushToken(): Promise<void> {
  if (!USE_REAL_API || !pushSupported) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'mise',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    if (!(await isAllowed())) return;
    const projectId = (
      Constants.expoConfig?.extra as
        { eas?: { projectId?: string } } | undefined
    )?.eas?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await api.auth.setPushToken(data);
  } catch {
    // Offline, a simulator, or no Firebase/APNs credentials yet.
  }
}
