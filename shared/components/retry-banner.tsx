import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { WifiOff } from 'lucide-react-native';
import { View } from 'react-native';

type RetryBannerProps = {
  message: string;
  retryLabel: string;
  onRetry: () => void;
  /** Disables Retry while the retry itself is in flight. */
  retrying?: boolean;
};

/**
 * Inline "can't reach the server" banner with a Retry (FE Spec §3.2, Error
 * state). Sits above a list that stays visible from cache underneath it —
 * it reports the failure, it does not replace the content.
 */
function RetryBanner({
  message,
  retryLabel,
  onRetry,
  retrying = false,
}: RetryBannerProps) {
  return (
    <View
      accessibilityRole="alert"
      className="bg-warning-soft mx-4 mb-3 flex-row flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl py-2 pr-2 pl-4"
    >
      <WifiOff className="text-warning-soft-foreground size-5 shrink-0" />
      <Text className="font-sans-medium text-warning-soft-foreground min-w-[8rem] flex-1 text-[14px] leading-snug">
        {message}
      </Text>
      <Button
        variant="outline"
        size="sm"
        onPress={onRetry}
        disabled={retrying}
        className="ml-auto"
      >
        <Text>{retryLabel}</Text>
      </Button>
    </View>
  );
}

export { RetryBanner };
export type { RetryBannerProps };
