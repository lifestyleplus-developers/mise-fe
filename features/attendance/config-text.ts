import type { AttendanceConfig } from '@/shared/api/types';
import { format, useT, type MessageKey } from '@/shared/i18n';
import {
  useFormatClock,
  useFormatDuration,
} from '@/shared/lib/use-clock-format';
import { useCallback } from 'react';

/**
 * How a configuration reads in a list and as a heading. The name is authored and
 * shown as typed; a configuration the platform sent without one is titled by its
 * schedule instead, "Daily · 8:00 AM".
 */
export function useConfigText() {
  const t = useT();
  const formatClock = useFormatClock();
  const formatDuration = useFormatDuration();

  /** "Daily", "Weekly (Mon, Wed)", "Monthly (day 5)". */
  const frequency = useCallback(
    (config: AttendanceConfig): string => {
      const word = t(`sched.freq.${config.recurrence}` as MessageKey);
      if (config.recurrence === 'WEEKLY' && config.weekdays?.length) {
        const days = [...config.weekdays]
          .sort((a, b) => a - b)
          .map((day) => t(`wd.${day}` as MessageKey))
          .join(', ');
        return `${word} (${days})`;
      }
      if (config.recurrence === 'MONTHLY' && config.day_of_month) {
        return `${word} (${format(t('picker.day-n'), {
          n: String(config.day_of_month),
        }).toLowerCase()})`;
      }
      return word;
    },
    [t],
  );

  const title = useCallback(
    (config: AttendanceConfig): string =>
      config.name.trim() ||
      format(t('cfg.fallback-title'), {
        freq: frequency(config),
        time: formatClock(config.st_time),
      }),
    [t, frequency, formatClock],
  );

  const line = useCallback(
    (config: AttendanceConfig): string =>
      format(t('cfg.line'), {
        freq: frequency(config),
        time: formatClock(config.st_time),
        dur: formatDuration(config.deadline_minutes),
      }),
    [t, frequency, formatClock, formatDuration],
  );

  return { title, line };
}
