import { Text } from '@/shared/components/ui/text';
import type { SpotCheckResult } from '@/shared/api/types';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { isoToClock } from '@/shared/lib/time';
import { cn } from '@/shared/lib/utils';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { OutcomeBadge } from './outcome-badge';

const OUTCOME_WORD: Record<SpotCheckResult['outcome'], MessageKey> = {
  PASS: 'spot.passed',
  FAIL: 'spot.failed',
  NEEDS_REVIEW: 'spot.review',
  PENDING_JUDGEMENT: 'spot.assessing',
};

/**
 * "Overridden: Passed, by Reshma · 3:10 PM", and the note under it. Secondary to the
 * assessment: it sits beside the original outcome and never replaces it (FE Spec §3.11).
 * A result with no override time (the platform may not record one) drops the time.
 */
export function OverrideNote({ result }: { result: SpotCheckResult }) {
  const t = useT();
  const formatClock = useFormatClock();
  if (result.overridden_to === null) return null;
  const to = t(OUTCOME_WORD[result.overridden_to]);
  const name = result.overridden_by?.full_name ?? '';
  const line = result.overridden_at
    ? format(t('spot.overridden-at'), {
        to,
        name,
        time: formatClock(isoToClock(result.overridden_at)),
      })
    : format(t('spot.overridden-by'), { to, name });
  return (
    <View className="border-border mt-1.5 ml-3 border-l-2 pl-2.5">
      <Text className="font-sans-semibold text-muted-foreground text-[13px] leading-snug">
        {line}
      </Text>
      {result.override_note ? (
        <Text className="text-muted-foreground text-[13px] leading-snug">
          {`“${result.override_note}”`}
        </Text>
      ) : null}
    </View>
  );
}

type ResultRowProps = {
  result: SpotCheckResult;
  /** Opens the override sheet. Omit where the caller cannot override. */
  onOpen?: () => void;
  first?: boolean;
};

/**
 * One assertion and its outcome. The badge is always the assessment's own answer;
 * an override, when there is one, is the line under the text. Nothing here maps an
 * item to a photograph: every item is judged against the whole set.
 */
export function ResultRow({ result, onOpen, first = false }: ResultRowProps) {
  const t = useT();
  const body = (
    <>
      <View className="min-w-[10rem] flex-1 basis-[10rem]">
        <Text className="text-[15px] leading-snug">
          {result.assertion_text}
        </Text>
        <OverrideNote result={result} />
      </View>
      <OutcomeBadge outcome={result.outcome} />
      {onOpen ? (
        <ChevronRight className="text-muted-foreground size-5 shrink-0" />
      ) : null}
    </>
  );
  const rowClass = cn(
    'min-h-14 flex-row flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3',
    !first && 'border-border border-t',
  );
  return onOpen ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${result.assertion_text}, ${t(OUTCOME_WORD[result.outcome])}`}
      onPress={onOpen}
      className={cn(rowClass, 'active:bg-accent')}
    >
      {body}
    </Pressable>
  ) : (
    <View className={rowClass}>{body}</View>
  );
}
