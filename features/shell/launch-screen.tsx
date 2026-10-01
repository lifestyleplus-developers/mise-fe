import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { View } from 'react-native';

type LaunchScreenProps = {
  loadingLabel: string;
  /** Present when the identity could not be fetched and there is no cache. */
  error?: { message: string; retryLabel: string; onRetry: () => void };
};

/**
 * What shows while /auth/me is in flight, or has failed with nothing cached
 * to fall back on: the wordmark, and either "Loading…" or the failure with
 * a Retry. Without an identity there are no tabs to build, so nothing
 * richer is possible.
 */
export function LaunchScreen({ loadingLabel, error }: LaunchScreenProps) {
  return (
    <View className="flex-1 items-center justify-center gap-6 px-8">
      <Text className="font-display text-center text-[48px] leading-none tracking-[-0.015em]">
        mise
      </Text>
      {error ? (
        <View className="items-center gap-4">
          <Text className="font-sans-medium text-center text-[15px]">
            {error.message}
          </Text>
          <Button onPress={error.onRetry}>
            <Text>{error.retryLabel}</Text>
          </Button>
        </View>
      ) : (
        <Text className="text-muted-foreground font-sans-medium text-[13px]">
          {loadingLabel}
        </Text>
      )}
    </View>
  );
}
