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
  /** Fires once as the user scrolls near the bottom, for paginated lists. */
  onEndReached?: () => void;
};

/** Frame for every tab root: header, offline banner, scroll area. */
export function TabScreen({
  title,
  eyebrow,
  children,
  onEndReached,
}: TabScreenProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { data, isError, isRefetching, refetch } = useMe();

  const unreachable = isError && data !== undefined;

  return (
    <SafeAreaView edges={['top']} className="flex-1">
      <ScrollView
        scrollEventThrottle={100}
        onScroll={
          onEndReached
            ? ({ nativeEvent: e }) => {
                const distance =
                  e.contentSize.height -
                  e.layoutMeasurement.height -
                  e.contentOffset.y;
                if (distance < 400) onEndReached();
              }
            : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
          />
        }
        contentContainerStyle={{ paddingBottom: 128 + insets.bottom }}
      >
        <View className="px-5 pt-4 pb-4">
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
