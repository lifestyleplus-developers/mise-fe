import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';
import { Camera, Check, Flag } from 'lucide-react-native';
import { View } from 'react-native';

export type AnswerView =
  | { kind: 'photo'; label: string }
  | { kind: 'yes'; label: string }
  | { kind: 'no'; label: string; comment: string | null }
  | {
      kind: 'reading';
      value: string;
      inRange: boolean;
      rangeLabel: string;
      /** "max 4 °C" — the bound the reading was held to. */
      limit?: string;
      comment: string | null;
    };

/**
 * What was answered, read-only. A No is a flag, not a tick, and an
 * out-of-range reading wears the same flag: shape, not just colour (FE Spec §11).
 */
export function AnswerDisplay(answer: AnswerView) {
  const flagged =
    answer.kind === 'no' || (answer.kind === 'reading' && !answer.inRange);
  const comment =
    answer.kind === 'no' || answer.kind === 'reading' ? answer.comment : null;

  return (
    <View className="mt-1.5">
      <View className="flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
        {answer.kind === 'photo' ? (
          <Camera className="text-foreground size-4 shrink-0" />
        ) : flagged ? (
          <Flag className="text-destructive-soft-foreground size-4 shrink-0" />
        ) : (
          <Check
            className="text-foreground size-4 shrink-0"
            strokeWidth={2.5}
          />
        )}
        {answer.kind === 'reading' ? (
          <>
            <Text className="font-sans-semibold text-[15px] leading-snug">
              {answer.value}
            </Text>
            <Text
              className={cn(
                'text-[13px]',
                flagged
                  ? 'font-sans-semibold text-destructive-soft-foreground'
                  : 'font-sans-medium text-muted-foreground',
              )}
            >
              {answer.rangeLabel}
              {answer.limit ? ` (${answer.limit})` : ''}
            </Text>
          </>
        ) : (
          <Text
            className={cn(
              'font-sans-semibold text-[15px] leading-snug',
              flagged && 'text-destructive-soft-foreground',
            )}
          >
            {answer.label}
          </Text>
        )}
      </View>
      {comment ? (
        <Text className="bg-muted mt-1 rounded-2xl px-3 py-2 text-[14px] leading-snug">
          {comment}
        </Text>
      ) : null}
    </View>
  );
}
