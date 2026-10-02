import { isSessionExpired, useMe } from '@/features/auth/use-me';
import { Text } from '@/shared/components/ui/text';
import { canAdminister } from '@/shared/constants/roles';
import { useT } from '@/shared/i18n';
import { Redirect, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PushedScreenProps = {
  title: string;
  /** ADMIN and OWNER only. The platform enforces it; this mirrors it. */
  adminOnly?: boolean;
  children: React.ReactNode;
};

/**
 * Frame for a screen pushed over the tabs: a Back button and a title, and no
 * tab bar — the pill is hidden on pushed screens. These routes sit outside
 * `(tabs)`, so the shell's auth gate does not cover them; this frame repeats
 * the part of it that matters, sending an expired session back to Login.
 */
export function PushedScreen({
  title,
  adminOnly = false,
  children,
}: PushedScreenProps) {
  const { data: me, isError, error } = useMe();
  const router = useRouter();
  const t = useT();

  if (!me) {
    if (isError && isSessionExpired(error)) return <Redirect href="/" />;
    // Mid sign-out, or the identity is still loading: nothing to show yet.
    return null;
  }
  if (adminOnly && !canAdminister(me.user.role)) {
    return <Redirect href="/more" />;
  }

  // A deep link can land here with nothing behind it; Back then goes to More
  // rather than doing nothing.
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/more');
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1">
      <View className="px-2 pt-2 pb-3">
        <Pressable
          accessibilityRole="button"
          onPress={goBack}
          className="active:bg-accent h-11 flex-row items-center gap-0.5 self-start rounded-full pr-3 pl-1"
        >
          <ChevronLeft className="text-foreground size-6" />
          <Text className="font-sans-semibold text-[15px]">
            {t('common.back')}
          </Text>
        </Pressable>
        <Text
          variant="h1"
          className="mt-1 px-3 text-left text-[26px] leading-tight"
        >
          {title}
        </Text>
      </View>
      <ScrollView contentContainerClassName="pt-2 pb-8">{children}</ScrollView>
    </SafeAreaView>
  );
}
