import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';
import { ChevronRight, Clock, Eye } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

export type RunRowVariant = 'open' | 'overseeing' | 'upcoming';

type RunRowProps = {
  first: boolean;
  variant: RunRowVariant;
  name: string;
  outlet: string;
  time: string;
  progressLabel: string;
  progress: { value: number; total: number };
  completeLabel: string;
  isComplete: boolean;
  watchLabel: string;
  onPress?: () => void;
};

function ProgressBar({ value, total }: { value: number; total: number }) {
  const percent =
    total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
    >
      <View
        className="bg-foreground h-full rounded-full"
        style={{ width: `${percent}%` }}
      />
    </View>
  );
}

/** One run on Home. Upcoming rows are inert: greyed, no press, no chevron (FE Spec §11). */
export function RunRow({
  first,
  variant,
  name,
  outlet,
  time,
  progressLabel,
  progress,
  completeLabel,
  isComplete,
  watchLabel,
  onPress,
}: RunRowProps) {
  const upcoming = variant === 'upcoming';

  const content = (
    <>
      <View className="min-w-0 flex-1">
        <Text
          className={cn(
            'font-sans-semibold text-[16px] leading-snug',
            upcoming && 'text-muted-foreground',
          )}
        >
          {name}
        </Text>
        <View className="mt-0.5 flex-row flex-wrap items-center gap-x-1.5">
          {variant === 'overseeing' ? (
            <Eye
              accessibilityLabel={watchLabel}
              className="text-muted-foreground size-3.5 shrink-0"
            />
          ) : null}
          <Text className="text-muted-foreground text-[13px] leading-snug">
            {outlet}
          </Text>
          <Text aria-hidden className="text-muted-foreground text-[13px]">
            ·
          </Text>
          {upcoming ? (
            <Clock className="text-muted-foreground size-3.5 shrink-0" />
          ) : null}
          <Text className="text-muted-foreground text-[13px] leading-snug">
            {time}
          </Text>
        </View>
      </View>

      {!upcoming ? (
        <View className="min-w-16 shrink-0 items-end gap-1.5">
          <Text className="font-sans-semibold text-right text-[13px] leading-tight">
            {progressLabel}
            {isComplete ? `\n${completeLabel}` : ''}
          </Text>
          <ProgressBar value={progress.value} total={progress.total} />
        </View>
      ) : null}

      {!upcoming ? (
        <ChevronRight className="text-muted-foreground size-5 shrink-0" />
      ) : null}
    </>
  );

  return (
    <View className={cn(!first && 'border-border border-t')}>
      {upcoming ? (
        <View className="min-h-16 flex-row items-center gap-3 px-4 py-3">
          {content}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          className="active:bg-accent min-h-16 flex-row items-center gap-3 px-4 py-3"
        >
          {content}
        </Pressable>
      )}
    </View>
  );
}
