import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import * as React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AutoDismissBanner } from '@/shared/components/auto-dismiss-banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import { Bell } from 'lucide-react-native';

import { onTapOffered, takeTap } from './pending-tap';
import { useNotificationPrefs } from './prefs-store';
import { askSystem, isAllowed, registerPushToken } from './register';
import { targetFromPush, type PushData } from './targets';

type Shown = { id: string; title: string; body: string; target: Href | null };

/**
 * The signed-in half of notifications (NTF-01): registers this phone's token,
 * asks for permission once, opens a tapped push, and shows one in the app while
 * it is open. Mounted only once `me` has loaded, so a person is always signed in.
 */
export function NotificationsHost({ userId }: { userId: number }) {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const asked = useNotificationPrefs((state) => state.asked);
  const hydrated = useNotificationPrefs((state) => state.hasHydrated);
  const markAsked = useNotificationPrefs((state) => state.markAsked);
  const [asking, setAsking] = React.useState(false);
  const [shown, setShown] = React.useState<Shown | null>(null);

  // Register the token for whoever is signed in; if the phone has not been
  // asked yet, ask in our own words first.
  React.useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void isAllowed().then((allowed) => {
      if (cancelled) return;
      if (allowed) void registerPushToken();
      else if (!asked) setAsking(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, asked, userId]);

  // Expo can hand out a new token; the platform must hear of it.
  React.useEffect(() => {
    const subscription = Notifications.addPushTokenListener(() => {
      void registerPushToken();
    });
    return () => subscription.remove();
  }, []);

  // A tap, whether it came before sign-in or now.
  React.useEffect(() => {
    const open = () => {
      const target = takeTap();
      if (target) router.navigate(target);
    };
    open();
    return onTapOffered(open);
  }, [router]);

  // A push that arrives while the app is open.
  React.useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const { title, body, data } = notification.request.content;
        setShown({
          id: notification.request.identifier,
          title: title ?? '',
          body: body ?? '',
          target: targetFromPush(data as PushData),
        });
      },
    );
    return () => subscription.remove();
  }, []);

  const answer = (allow: boolean) => {
    setAsking(false);
    markAsked();
    if (allow) {
      void askSystem().then((granted) => {
        if (granted) void registerPushToken();
      });
    }
  };

  return (
    <>
      {shown ? (
        <View
          pointerEvents="box-none"
          style={{ top: insets.top + 8 }}
          className="absolute inset-x-4 z-50"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityHint={t('ntf.open')}
            onPress={() => {
              const target = shown.target;
              setShown(null);
              if (target) router.navigate(target);
            }}
          >
            <AutoDismissBanner
              tone="notice"
              icon={Bell}
              message={shown.title}
              detail={shown.body}
              resetKey={shown.id}
              onDismiss={() => setShown(null)}
            />
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={asking}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => answer(false)}
      >
        <View className="bg-scrim flex-1 items-center justify-center px-5">
          <View
            accessibilityViewIsModal
            className="border-border bg-card w-full max-w-sm items-center rounded-[1.75rem] border p-6"
          >
            <View className="bg-secondary mb-4 size-12 items-center justify-center rounded-full">
              <Bell className="text-foreground size-6" />
            </View>
            <Text
              variant="h3"
              className="text-center text-[22px] leading-tight"
              accessibilityRole="header"
            >
              {t('ntf.ask.title')}
            </Text>
            <Text className="mt-2 text-center text-[14px] leading-snug">
              {t('ntf.ask.why')}
            </Text>
            <View className="mt-6 w-full flex-row gap-2">
              <Button
                variant="outline"
                onPress={() => answer(false)}
                className="h-auto min-h-11 flex-1 px-3 py-2"
              >
                <Text className="font-sans-semibold text-center text-[14px]">
                  {t('ntf.ask.later')}
                </Text>
              </Button>
              <Button
                onPress={() => answer(true)}
                className="h-auto min-h-11 flex-1 px-3 py-2"
              >
                <Text className="font-sans-semibold text-center text-[14px]">
                  {t('ntf.ask.allow')}
                </Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
