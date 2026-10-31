import { markBadgeKind, StatusBadge } from '@/features/attendance/status-badge';
import { PendingPill } from '@/shared/components/pending-pill';
import { Text } from '@/shared/components/ui/text';
import type { AttendanceMark, AttendanceMarkStatus } from '@/shared/api/types';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { isoToClock } from '@/shared/lib/time';
import { cn } from '@/shared/lib/utils';
import { Check, MessageSquare, X } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

/** A mark that has not landed: still going, or refused by the platform. */
export type MarkQueueState = {
  kind: 'waiting' | 'refused';
  /** The platform's error code, for a refusal. */
  code: string | null;
};

type MarkRowProps = {
  mark: AttendanceMark;
  /**
   * `edit` draws Present and Not present for a manager inside the window;
   * `read` draws the outcome as a word (view-only, and every closed session).
   */
  mode: 'edit' | 'read';
  queue?: MarkQueueState;
  /** The window's close, as HH:MM, for the "Not recorded" line. */
  closedAt?: string;
  /** Who made a change, from its user id; unknown ids are left out. */
  userName?: (id: number) => string | undefined;
  onMark?: (status: 'PRESENT' | 'NOT_PRESENT') => void;
  onNote?: () => void;
  onRetry?: () => void;
};

const STATUS_LABEL: Record<AttendanceMarkStatus, MessageKey> = {
  PRESENT: 'att.present',
  NOT_PRESENT: 'att.not-present',
  UNMARKED: 'att.not-marked',
  NEEDS_REVIEW: 'att.needs-review',
};

/**
 * One person in a session: their name and code, how they were marked, the note,
 * and every correction ("Show all"). Corrections are kept, so a changed mind
 * shows on the row (Model §18).
 */
function MarkRow({
  mark,
  mode,
  queue,
  closedAt,
  userName,
  onMark,
  onNote,
  onRetry,
}: MarkRowProps) {
  const t = useT();
  const formatClock = useFormatClock();
  const [expanded, setExpanded] = React.useState(false);
  const { staff } = mark;
  const badge = markBadgeKind(mark);

  // Latest first: the row leads with the most recent change.
  const changes = [...mark.changes].reverse();
  const shown = expanded ? changes : changes.slice(0, 2);

  return (
    <View className="border-border gap-2 border-b px-4 py-3">
      <View className="flex-row items-start gap-3">
        <View className="min-w-0 flex-1">
          <Text className="font-sans-semibold text-[16px]">
            {staff.full_name}
          </Text>
          {staff.staff_code ? (
            <Text className="text-muted-foreground text-[13px]">
              {staff.staff_code}
            </Text>
          ) : null}
        </View>
        {mode === 'read' ? (
          badge ? (
            <StatusBadge kind={badge} />
          ) : (
            <StatusBadge kind="notMarked" />
          )
        ) : null}
      </View>

      {mode === 'edit' ? (
        <View className="flex-row items-center gap-2">
          <MarkButton
            tone="present"
            selected={mark.status === 'PRESENT'}
            label={t('att.present')}
            accessibilityLabel={format(t('att.mark-present-for'), {
              name: staff.full_name,
            })}
            onPress={() => onMark?.('PRESENT')}
          />
          <MarkButton
            tone="absent"
            selected={mark.status === 'NOT_PRESENT'}
            label={t('att.not-present')}
            accessibilityLabel={format(t('att.mark-absent-for'), {
              name: staff.full_name,
            })}
            onPress={() => onMark?.('NOT_PRESENT')}
          />
          {/* A note goes to the platform with a mark, so it waits for one. */}
          {mark.status === 'UNMARKED' ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={format(t('att.note-for'), {
                name: staff.full_name,
              })}
              onPress={onNote}
              className={cn(
                'size-11 shrink-0 items-center justify-center rounded-full border',
                mark.note ? 'border-primary bg-accent' : 'border-input-edge',
              )}
            >
              <MessageSquare className="text-foreground size-5" />
            </Pressable>
          )}
        </View>
      ) : null}

      {mark.note ? (
        <Text className="text-muted-foreground text-[14px]">{mark.note}</Text>
      ) : null}
      {/* Who marked them and when, until a correction says it better. */}
      {!queue &&
      mark.marked_by &&
      mark.marked_at &&
      mark.changes.length === 0 ? (
        <Text className="text-muted-foreground text-[13px]">
          {`${mark.marked_by.full_name} ${formatClock(isoToClock(mark.marked_at))}`}
        </Text>
      ) : null}

      <Queue
        queue={queue}
        closedAt={closedAt}
        name={staff.full_name}
        onRetry={onRetry}
      />

      {shown.length > 0 ? (
        <View className="gap-1">
          {shown.map((change) => {
            const by = userName?.(change.changed_by);
            return (
              <Text
                key={`${change.changed_at}-${change.to_status}`}
                className="text-muted-foreground text-[13px]"
              >
                {[
                  format(t('att.change'), {
                    from: t(STATUS_LABEL[change.from_status]),
                    to: t(STATUS_LABEL[change.to_status]),
                  }),
                  by ? format(t('att.change-by'), { name: by }) : null,
                  formatClock(isoToClock(change.changed_at)),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            );
          })}
          {changes.length > 2 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setExpanded((open) => !open)}
              className="min-h-11 justify-center self-start"
            >
              <Text className="font-sans-semibold text-[13px] underline">
                {expanded
                  ? t('att.show-less')
                  : format(t('att.show-all'), { n: String(changes.length) })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Queue({
  queue,
  closedAt,
  name,
  onRetry,
}: {
  queue: MarkQueueState | undefined;
  closedAt?: string;
  name: string;
  onRetry?: () => void;
}) {
  const t = useT();
  if (!queue) return null;
  if (queue.kind === 'waiting') {
    return <PendingPill label={t('att.waiting')} />;
  }
  if (queue.code === 'window_closed') {
    return (
      <View
        accessibilityRole="alert"
        className="bg-warning-soft gap-0.5 rounded-2xl px-3 py-2"
      >
        <Text className="text-warning-soft-foreground font-sans-semibold text-[14px]">
          {format(t('att.late'), { time: closedAt ?? '' })}
        </Text>
        <Text className="text-warning-soft-foreground text-[14px]">
          {format(t('att.late-line'), { name })}
        </Text>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onRetry}
      className="bg-destructive-soft min-h-11 justify-center rounded-2xl px-3 py-2"
    >
      <Text className="text-destructive-soft-foreground font-sans-semibold text-[14px]">
        {t('att.row-failed')}
      </Text>
    </Pressable>
  );
}

function MarkButton({
  tone,
  selected,
  label,
  accessibilityLabel,
  onPress,
}: {
  tone: 'present' | 'absent';
  selected: boolean;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const Icon = tone === 'present' ? Check : X;
  const chosen =
    tone === 'present'
      ? 'border-success bg-success-soft'
      : 'border-destructive bg-destructive-soft';
  const ink =
    tone === 'present'
      ? 'text-success-soft-foreground'
      : 'text-destructive-soft-foreground';
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className={cn(
        'min-h-11 min-w-0 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border px-3',
        selected ? chosen : 'border-input-edge bg-card active:bg-accent',
      )}
    >
      {selected ? <Icon className={cn('size-4 shrink-0', ink)} /> : null}
      <Text
        className={cn(
          'shrink text-[14px]',
          selected ? cn('font-sans-bold', ink) : 'font-sans-medium',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export { MarkRow };
export type { MarkRowProps };
