import { Text } from '@/shared/components/ui/text';
import type { AttendanceMark } from '@/shared/api/types';
import { useT, type MessageKey } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { Check, CircleDashed, TriangleAlert, X } from 'lucide-react-native';
import { View } from 'react-native';

/**
 * What a mark reads as. "Not marked" (nobody checked) is told apart from "Not
 * present" (a manager said absent): both are NOT_PRESENT, told apart by source.
 */
export type MarkBadgeKind =
  'present' | 'notPresent' | 'notMarked' | 'needsReview';

/** The badge for a mark, or null for one still waiting to be marked in an open session. */
export function markBadgeKind(
  mark: Pick<AttendanceMark, 'status' | 'source'>,
): MarkBadgeKind | null {
  switch (mark.status) {
    case 'PRESENT':
      return 'present';
    case 'NOT_PRESENT':
      return mark.source === 'SYSTEM' ? 'notMarked' : 'notPresent';
    case 'NEEDS_REVIEW':
      return 'needsReview';
    case 'UNMARKED':
      return null;
  }
}

const BADGE: Record<
  MarkBadgeKind,
  {
    label: MessageKey;
    Icon: typeof Check;
    box: string;
    ink: string;
  }
> = {
  present: {
    label: 'att.present',
    Icon: Check,
    box: 'bg-success-soft',
    ink: 'text-success-soft-foreground',
  },
  notPresent: {
    label: 'att.not-present',
    Icon: X,
    box: 'bg-destructive-soft',
    ink: 'text-destructive-soft-foreground',
  },
  notMarked: {
    label: 'att.not-marked',
    Icon: CircleDashed,
    box: 'bg-pending-soft',
    ink: 'text-pending-soft-foreground',
  },
  needsReview: {
    label: 'att.needs-review',
    Icon: TriangleAlert,
    box: 'bg-warning-soft',
    ink: 'text-warning-soft-foreground',
  },
};

/** A mark's outcome as a word and an icon as well as a colour. */
export function StatusBadge({ kind }: { kind: MarkBadgeKind }) {
  const t = useT();
  const { label, Icon, box, ink } = BADGE[kind];
  return (
    <View
      accessibilityRole="text"
      className={cn(
        'flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5',
        box,
      )}
    >
      <Icon className={cn('size-4 shrink-0', ink)} />
      <Text className={cn('font-sans-semibold text-[13px]', ink)}>
        {t(label)}
      </Text>
    </View>
  );
}
