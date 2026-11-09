import { Text } from '@/shared/components/ui/text';
import { useT, type MessageKey } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { Check, CircleDashed, Eye, Flag } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

import type { OutcomeKind } from './spot-outcome';

const BADGE: Record<
  OutcomeKind,
  { label: MessageKey; box: string; ink: string }
> = {
  PASS: {
    label: 'spot.passed',
    box: 'bg-success-soft',
    ink: 'text-success-soft-foreground',
  },
  FAIL: {
    label: 'spot.failed',
    box: 'bg-destructive-soft',
    ink: 'text-destructive-soft-foreground',
  },
  // Not red, and edged: a low-confidence result is not a failure.
  NEEDS_REVIEW: {
    label: 'spot.review',
    box: 'bg-review-soft border-review-soft-foreground/40 border',
    ink: 'text-review-soft-foreground',
  },
  PENDING_JUDGEMENT: {
    label: 'spot.assessing',
    box: 'bg-muted',
    ink: 'text-foreground',
  },
  NOT_DONE: {
    label: 'spot.not-done',
    box: 'bg-muted',
    ink: 'text-foreground',
  },
};

function Glyph({ kind, ink }: { kind: OutcomeKind; ink: string }) {
  switch (kind) {
    case 'PASS':
      return <Check className={cn('size-4', ink)} strokeWidth={2.5} />;
    case 'FAIL':
      return <Flag className={cn('size-4', ink)} />;
    case 'NEEDS_REVIEW':
      return <Eye className={cn('size-4', ink)} />;
    case 'PENDING_JUDGEMENT':
      return <ActivityIndicator size="small" />;
    case 'NOT_DONE':
      return <CircleDashed className={cn('size-4', ink)} />;
  }
}

type OutcomeBadgeProps = {
  outcome: OutcomeKind;
  size?: 'sm' | 'md';
};

/**
 * An outcome as a word and an icon as well as a colour. Three outcomes, not two:
 * Needs review has its own colour and is never drawn as a failure (FE Spec §3.11).
 */
export function OutcomeBadge({ outcome, size = 'md' }: OutcomeBadgeProps) {
  const t = useT();
  const { label, box, ink } = BADGE[outcome];
  return (
    <View
      accessibilityRole="text"
      accessibilityLiveRegion={
        outcome === 'PENDING_JUDGEMENT' ? 'polite' : undefined
      }
      className={cn(
        'shrink-0 flex-row items-center gap-1 self-start rounded-full',
        size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1',
        box,
      )}
    >
      <Glyph kind={outcome} ink={ink} />
      <Text
        className={cn(
          'font-sans-semibold',
          size === 'sm' ? 'text-[12px]' : 'text-[13px]',
          ink,
        )}
      >
        {t(label)}
      </Text>
    </View>
  );
}
