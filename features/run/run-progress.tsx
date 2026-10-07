import { PendingPill } from '@/shared/components/pending-pill';
import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';
import { Clock } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

type ProgressBarProps = {
  /** Answers the server has. */
  value: number;
  total: number;
  /** Answers the phone is still holding to send: drawn as a second, lighter part. */
  pending?: number;
};

/** Answered so far, with any not-yet-sent answers as a distinct trailing part. */
export function ProgressBar({ value, total, pending = 0 }: ProgressBarProps) {
  const pct = (n: number) =>
    total > 0 ? Math.min(100, Math.max(0, (n / total) * 100)) : 0;
  const solid = pct(value);
  const waiting = pct(value + pending) - solid;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="bg-muted h-1.5 w-full flex-row overflow-hidden rounded-full"
    >
      {solid > 0 ? (
        <View
          className={cn(
            'bg-foreground h-full',
            waiting > 0 ? 'rounded-l-full' : 'rounded-full',
          )}
          style={{ width: `${solid}%` }}
        />
      ) : null}
      {waiting > 0 ? (
        <View
          className={cn(
            'bg-pending-soft-foreground h-full rounded-r-full',
            solid > 0 ? 'ml-0.5' : 'rounded-full',
          )}
          style={{ width: `${waiting}%`, minWidth: 6 }}
        />
      ) : null}
    </View>
  );
}

type RunProgressCardProps = {
  /** "Closes 10:00" or "Closed 10:00". */
  closes: string;
  progressLabel: string;
  value: number;
  total: number;
  pending?: number;
  pendingLabel?: string;
  /** Extra lines under the bar — the watching line and the jump button. */
  children?: React.ReactNode;
};

/** The pinned summary on a run: when it closes and how far along it is (FE Spec §3.3). */
export function RunProgressCard({
  closes,
  progressLabel,
  value,
  total,
  pending = 0,
  pendingLabel,
  children,
}: RunProgressCardProps) {
  return (
    <View className="px-4 pb-3">
      <View className="shadow-card border-border bg-card rounded-3xl border px-4 py-3">
        <View className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <View className="flex-row items-center gap-1.5">
            <Clock className="text-foreground size-4 shrink-0" />
            <Text className="font-sans-semibold text-[14px]">{closes}</Text>
          </View>
          <Text className="font-sans-semibold text-[14px]">
            {progressLabel}
          </Text>
        </View>
        <View className="mt-2">
          <ProgressBar value={value} total={total} pending={pending} />
        </View>
        {pending > 0 && pendingLabel ? (
          <View className="mt-2">
            <PendingPill label={pendingLabel} />
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}
