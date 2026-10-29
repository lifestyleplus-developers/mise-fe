import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import { Check, Flag } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

type AiVerdictProps = {
  outcome: 'PASS' | 'FAIL' | 'MISSED' | 'PENDING_JUDGEMENT' | null;
  /** The AI's reason, once it has one. */
  comment?: string | null;
};

/**
 * What the AI made of a photograph, under its task: a spinner while it looks, then
 * its verdict and its reason. A tick or a flag carries the verdict, not colour alone.
 */
export function AiVerdict({ outcome, comment }: AiVerdictProps) {
  const t = useT();

  if (outcome === 'PENDING_JUDGEMENT') {
    return (
      <View
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        className="bg-pending-soft mt-2 flex-row items-center gap-2 self-start rounded-full px-3 py-1.5"
      >
        <ActivityIndicator size="small" />
        <Text className="text-pending-soft-foreground font-sans-semibold text-[13px]">
          {t('run.ai-checking')}
        </Text>
      </View>
    );
  }

  if (outcome !== 'PASS' && outcome !== 'FAIL') return null;

  return (
    <View className="mt-2 gap-1">
      <View className="flex-row items-center gap-2">
        {outcome === 'PASS' ? (
          <Check className="text-foreground size-4" strokeWidth={2.5} />
        ) : (
          <Flag className="text-destructive-soft-foreground size-4" />
        )}
        <Text className="font-sans-semibold text-[13px]">
          {t(outcome === 'PASS' ? 'run.ai-pass' : 'run.ai-fail')}
        </Text>
      </View>
      {comment ? (
        <Text className="bg-muted rounded-2xl px-3 py-2 text-[14px] leading-snug">
          {comment}
        </Text>
      ) : null}
    </View>
  );
}
