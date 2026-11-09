import type { SpotCheck } from '@/shared/api/types';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import * as React from 'react';

/**
 * A check's list-row lines: "Staff · Daily · 2:00 PM · 20 min window" and
 * "3 photos · 5 check items". Archived prompts and items are not counted. Times follow
 * the phone's clock.
 */
export function useCheckText() {
  const t = useT();
  const formatClock = useFormatClock();
  return React.useMemo(
    () => ({
      line(check: SpotCheck) {
        return format(t('spot.row-line'), {
          subject: t(
            check.subject_type === 'STAFF' ? 'spot.staff' : 'spot.area',
          ),
          freq: t(`sched.freq.${check.recurrence}` as MessageKey),
          time: formatClock(check.st_time),
          n: String(check.reveal_window_minutes),
        });
      },
      counts(check: SpotCheck) {
        return format(t('spot.counts'), {
          p: String(check.captures.length),
          i: String(
            check.assertions.filter((item) => !item.is_archived).length,
          ),
        });
      },
    }),
    [t, formatClock],
  );
}
