import type { Incident } from '@/shared/api/types';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { formatDay, toDay } from '@/shared/lib/date-range';
import { isoToClock } from '@/shared/lib/time';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { cn } from '@/shared/lib/utils';
import { useLanguageStore } from '@/shared/stores/language-store';
import {
  Check,
  ChevronRight,
  CircleMinus,
  CircleX,
  Clock,
  Hourglass,
  Zap,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type IssueCardProps = {
  incident: Incident;
  /** A resolve that has not reached the platform yet: shown, never as failed. */
  waiting: boolean;
  onPress: () => void;
};

type Line = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  strong?: boolean;
};

/** A score from 0 to 1 as the percentage people read. */
export function scorePercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * One imperfect run (§9): the checklist, where and when, its score, what failed,
 * and any marks. A resolved one reads quieter, with who resolved it and when.
 */
export function IssueCard({ incident, waiting, onPress }: IssueCardProps) {
  const t = useT();
  const language = useLanguageStore((state) => state.language);
  const formatClock = useFormatClock();

  const resolved = incident.status === 'RESOLVED';
  const when = (iso: string) =>
    `${formatDay(toDay(new Date(iso)), language)}, ${formatClock(isoToClock(iso))}`;

  const counts: Line[] = [];
  if (incident.failed_count > 0) {
    counts.push({
      key: 'failed',
      icon: CircleX,
      text: format(t('iss.n-failed'), { n: String(incident.failed_count) }),
    });
  }
  if (incident.missed_count > 0) {
    counts.push({
      key: 'missed',
      icon: CircleMinus,
      text: format(t('iss.n-missed'), { n: String(incident.missed_count) }),
    });
  }

  const marks: Line[] = [];
  if (resolved) {
    marks.push({
      key: 'resolved',
      icon: Check,
      text: format(t('iss.resolved-by'), {
        name: incident.resolved_by?.full_name ?? '',
        when: incident.resolved_at ? when(incident.resolved_at) : '',
      }),
    });
  } else {
    if (incident.rushed) {
      marks.push({ key: 'rushed', icon: Zap, text: t('iss.rushed') });
    }
    if (incident.assessing_count) {
      marks.push({
        key: 'assessing',
        icon: Hourglass,
        text: format(t('iss.n-assessing'), {
          n: String(incident.assessing_count),
        }),
      });
    }
    if (waiting) {
      marks.push({
        key: 'waiting',
        icon: Clock,
        text: t('iss.waiting'),
        strong: true,
      });
    }
  }

  const score = scorePercent(incident.score);
  const sub = `${incident.outlet.name} · ${formatDay(toDay(new Date(incident.window_open)), language)}`;
  const spoken = [
    incident.checklist.name,
    sub,
    score,
    ...counts.map((line) => line.text),
    ...marks.map((line) => line.text),
  ].join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      className="shadow-card border-border bg-card active:bg-accent mx-4 min-h-16 flex-row items-start gap-3 rounded-3xl border px-4 py-3"
    >
      <View className="min-w-0 flex-1">
        <Text
          className={cn(
            'font-sans-semibold text-[16px] leading-snug',
            resolved && 'text-muted-foreground',
          )}
        >
          {incident.checklist.name}
        </Text>
        <Text className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
          {sub}
        </Text>
        <View className="mt-1.5 flex-row flex-wrap items-center gap-x-3 gap-y-1">
          <Text className="font-sans-semibold text-[14px]">{score}</Text>
          {counts.map((line) => (
            <View key={line.key} className="flex-row items-center gap-1">
              <line.icon className="text-foreground size-4 shrink-0" />
              <Text className="font-sans-medium text-[14px]">{line.text}</Text>
            </View>
          ))}
        </View>
        {marks.map((line) => (
          <View key={line.key} className="mt-1 flex-row items-center gap-1.5">
            <line.icon className="text-foreground size-4 shrink-0" />
            <Text
              className={cn(
                'min-w-0 shrink text-[13px] leading-snug',
                line.strong && 'font-sans-semibold',
              )}
            >
              {line.text}
            </Text>
          </View>
        ))}
      </View>
      <ChevronRight className="text-muted-foreground mt-0.5 size-5 shrink-0" />
    </Pressable>
  );
}
