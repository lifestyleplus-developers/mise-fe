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
import { SafeAreaView } from 'react-native-safe-area-context';

type PushedScreenProps = {
  title: string;
  /** ADMIN and OWNER only. The platform enforces it too. */
  adminOnly?: boolean;
  /** Sits opposite Back, e.g. a New button. */
  action?: React.ReactNode;
  /** Where Back goes when nothing is behind this screen. Defaults to More. */
  backHref?: '/more' | '/outlets';
  /** Wires pull to refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
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
  children,
}: PushedScreenProps) {
  const { data: me, isError, error } = useMe();
  const router = useRouter();
  const t = useT();
  const theme = useAppliedTheme();

  if (!me) {
    if (isError && isSessionExpired(error)) return <Redirect href="/" />;
    return null;
  }
  if (adminOnly && !canAdminister(me.user.role)) {
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
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
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
          <Text
            variant="h1"
            className="mt-1 px-3 text-left text-[26px] leading-tight"
          >
            {title}
          </Text>
        </View>
        <ScrollView
          contentContainerClassName="pt-2 pb-8"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
