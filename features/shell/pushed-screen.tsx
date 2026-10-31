import { isSessionExpired, useMe } from '@/features/auth/use-me';
import { Text } from '@/shared/components/ui/text';
import { canAdminister } from '@/shared/constants/roles';
import { useT } from '@/shared/i18n';
import { WASH } from '@/shared/lib/theme';
import { useAppliedTheme } from '@/shared/stores/theme-store';
import { Redirect, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

type PushedScreenProps = {
  title: string;
  /** ADMIN and OWNER only. The platform enforces it too. */
  adminOnly?: boolean;
  /** Sits opposite Back, e.g. a New button. */
  action?: React.ReactNode;
  /** Where Back goes when nothing is behind this screen. Defaults to More. */
  backHref?:
    | '/more'
    | '/outlets'
    | '/users'
    | '/checklists'
    | '/checklists/admin'
    | '/modules'
    | '/attendance/configs'
    | '/attendance/history'
    | '/inventory'
    | '/home';
  /** Wires pull to refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Lets the screen scroll itself, e.g. to jump to a row. */
  scrollRef?: React.Ref<ScrollView>;
  /** Called when the scroll nears the bottom, for paged lists. */
  onEndReached?: () => void;
  /** Pinned under the scrolling content, e.g. a Save button. */
  footer?: React.ReactNode;
  /** A small line above the title, e.g. the section the title belongs to. */
  eyebrow?: string;
  /** False while something on the screen is being dragged. */
  scrollEnabled?: boolean;
  children: React.ReactNode;
};

/** Frame for a screen pushed over the tabs: Back button, title, no tab bar. */
export function PushedScreen({
  title,
  adminOnly = false,
  action,
  backHref = '/more',
  onRefresh,
  refreshing = false,
  scrollRef,
  onEndReached,
  footer,
  eyebrow,
  scrollEnabled = true,
  children,
}: PushedScreenProps) {
  const { data: me, isError, error } = useMe();
  const router = useRouter();
  const t = useT();
  const theme = useAppliedTheme();
  const insets = useSafeAreaInsets();

  if (!me) {
    if (isError && isSessionExpired(error)) return <Redirect href="/" />;
    return null;
  }
  if (adminOnly && !canAdminister(me.user.tenant_role)) {
    return <Redirect href="/more" />;
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace(backHref);
  }

  return (
    <View
      className="flex-1"
      style={{
        backgroundColor: WASH[theme].backgroundColor,
        experimental_backgroundImage: WASH[theme].backgroundImage,
      }}
    >
      <SafeAreaView
        edges={footer ? ['top'] : ['top', 'bottom']}
        className="flex-1"
      >
        <View className="px-2 pt-2 pb-3">
          <View className="flex-row items-center justify-between gap-2 pr-2">
            <Pressable
              accessibilityRole="button"
              onPress={goBack}
              className="active:bg-accent h-11 flex-row items-center gap-0.5 rounded-full pr-3 pl-1"
            >
              <ChevronLeft className="text-foreground size-6" />
              <Text className="font-sans-semibold text-[15px]">
                {t('common.back')}
              </Text>
            </Pressable>
            {action}
          </View>
          {eyebrow ? (
            <Text className="text-muted-foreground mt-1 px-3 text-[13px]">
              {eyebrow}
            </Text>
          ) : null}
          <Text
            variant="h1"
            className="mt-1 px-3 text-left text-[26px] leading-tight"
          >
            {title}
          </Text>
        </View>
        <ScrollView
          ref={scrollRef}
          scrollEnabled={scrollEnabled}
          contentContainerClassName="pt-2 pb-8"
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={100}
          onScroll={
            onEndReached
              ? ({ nativeEvent }) => {
                  const { contentOffset, layoutMeasurement, contentSize } =
                    nativeEvent;
                  if (
                    contentOffset.y + layoutMeasurement.height >=
                    contentSize.height - 240
                  ) {
                    onEndReached();
                  }
                }
              : undefined
          }
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
        {footer ? (
          <View
            className="border-border bg-card border-t px-4 pt-3"
            // Runs to the bottom edge; the gesture bar's room is its own padding.
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            {footer}
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
