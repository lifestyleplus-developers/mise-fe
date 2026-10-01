import { useMe } from '@/features/auth/use-me';
import { RetryBanner } from '@/shared/components/retry-banner';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import * as React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

type TabScreenProps = {
  title: string;
  /** Small line above the title — the business name, on Home. */
  eyebrow?: string;
  children: React.ReactNode;
};

/**
 * Frame shared by every tab root: header, the offline banner, and a scroll
 * area with room under it for the floating tab bar. Pull to refresh is
 * wired here once, and for now re-fetches the identity — the only server
 * state a tab root has. A screen that loads its own data moves it onto that.
 */
export function TabScreen({ title, eyebrow, children }: TabScreenProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { data, isError, isRefetching, refetch } = useMe();

  // A failed refresh while an identity is cached: keep the screen, say so.
  // (With nothing cached the shell shows the launch screen instead.)
  const unreachable = isError && data !== undefined;

  return (
    <SafeAreaView edges={['top']} className="flex-1">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
          />
        }
        // 8rem + the bottom inset clears the floating bar, which sits 1rem
        // above the inset and is ~64pt tall.
        contentContainerStyle={{ paddingBottom: 128 + insets.bottom }}
      >
        <View className="px-5 pt-4 pb-4">
          {/* The row is always there — a tab without an eyebrow keeps its
              title on the same baseline as one with. */}
          <Text
            aria-hidden={!eyebrow}
            className="font-sans-semibold mb-1 min-h-5 text-[13px] tracking-wide"
          >
            {eyebrow ?? ''}
          </Text>
          <Text variant="h1" className="text-left text-[34px] leading-[1.1]">
            {title}
          </Text>
        </View>

        {unreachable ? (
          <RetryBanner
            message={t('common.offline')}
            retryLabel={t('common.retry')}
            onRetry={() => void refetch()}
            retrying={isRefetching}
          />
        ) : null}

        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
