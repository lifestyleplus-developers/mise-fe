import { Text } from '@/shared/components/ui/text';
import { Clock } from 'lucide-react-native';
import { View } from 'react-native';

/**
 * "Waiting to send" — distinct from both success and failure (FE Spec §11):
 * the work is not lost and must not look lost. Slate, not amber or red.
 */
function PendingPill({ label }: { label: string }) {
  return (
    <View
      accessibilityRole="text"
      className="bg-pending-soft flex-row items-center gap-2 self-start rounded-full px-3 py-1.5"
    >
      <Clock className="text-pending-soft-foreground size-4 shrink-0" />
      <Text className="text-pending-soft-foreground font-sans-semibold text-[13px]">
        {label}
      </Text>
    </View>
  );
}

export { PendingPill };
