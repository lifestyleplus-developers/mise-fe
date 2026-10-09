import { Text } from '@/shared/components/ui/text';
import { PendingPill } from '@/shared/components/pending-pill';
import { cn } from '@/shared/lib/utils';
import { Circle } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

type TaskRowProps = {
  first: boolean;
  position: number;
  /** Authored text, shown exactly as typed. */
  text: string;
  answer?: React.ReactNode;
  /** "You · 06:14" or "Kiran · 06:14". */
  attribution?: string;
  pendingLabel?: string;
  /** A watching supervisor sees what is still open. */
  notAnsweredLabel?: string;
  /** Stands in for the answer control until it is built (week 5). */
  controlPlaceholder?: string;
  onLayout?: (y: number) => void;
};

/** One task on a run. */
export function TaskRow({
  first,
  position,
  text,
  answer,
  attribution,
  pendingLabel,
  notAnsweredLabel,
  controlPlaceholder,
  onLayout,
}: TaskRowProps) {
  return (
    <View
      onLayout={onLayout ? (e) => onLayout(e.nativeEvent.layout.y) : undefined}
      className={cn(
        'flex-row gap-3 px-4 py-3.5',
        !first && 'border-border border-t',
      )}
    >
      <View className="bg-secondary mt-0.5 size-6 items-center justify-center rounded-full">
        <Text className="font-sans-semibold text-[12px]">{position}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-sans-medium text-[16px] leading-snug">
          {text}
        </Text>
        {answer}
        {attribution || pendingLabel ? (
          <View className="mt-1.5 flex-row flex-wrap items-center gap-2">
            {attribution ? (
              <Text className="text-muted-foreground text-[13px]">
                {attribution}
              </Text>
            ) : null}
            {pendingLabel ? <PendingPill label={pendingLabel} /> : null}
          </View>
        ) : null}
        {notAnsweredLabel ? (
          <View className="mt-1.5 flex-row items-center gap-1.5">
            <Circle className="text-foreground size-4 shrink-0" />
            <Text className="font-sans-semibold text-[13px]">
              {notAnsweredLabel}
            </Text>
          </View>
        ) : null}
        {controlPlaceholder ? (
          <Text className="border-input-edge text-muted-foreground font-sans-semibold mt-2 rounded-2xl border border-dashed px-3 py-2.5 text-center text-[12px] tracking-wide uppercase">
            {controlPlaceholder}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** First-load placeholder rows. */
export function TaskRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border"
    >
      {Array.from({ length: rows }, (_, index) => (
        <View
          key={index}
          className={cn(
            'flex-row gap-3 px-4 py-4',
            index > 0 && 'border-border border-t',
          )}
        >
          <View className="bg-muted size-6 rounded-full" />
          <View className="flex-1 gap-2">
            <View className="bg-muted h-3.5 w-2/3 rounded-full" />
            <View className="bg-muted h-3 w-1/3 rounded-full" />
          </View>
        </View>
      ))}
    </View>
  );
}
