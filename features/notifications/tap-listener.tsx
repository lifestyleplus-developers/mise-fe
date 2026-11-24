import * as Notifications from 'expo-notifications';
import * as React from 'react';
import { Platform } from 'react-native';

import { offerTap } from './pending-tap';
import { targetFromPush, type PushData } from './targets';

// The app draws its own banner while open, so the system shows nothing then.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Turns a tap on a push, including the one that launched the app, into a target
 * to open. Mounted at the root so a tap before sign-in is not lost; the signed-in
 * shell opens it.
 */
export function TapListener() {
  const response = Notifications.useLastNotificationResponse();
  const handled = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER)
      return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const target = targetFromPush(
      response.notification.request.content.data as PushData,
    );
    if (target) offerTap(target);
  }, [response]);

  return null;
}
