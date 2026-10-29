import type { Checklist } from '@/shared/api/types';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { useFormatClock } from '@/shared/lib/use-clock-format';

const SCHEDULE_KEY = {
  HOURLY: 'checklists.hourly',
  DAILY: 'checklists.daily',
  WEEKLY: 'checklists.weekly',
  MONTHLY: 'checklists.monthly',
} as const satisfies Record<Checklist['recurrence'], MessageKey>;

/**
 * A checklist's schedule in words: "Daily · opens 6:30 AM". The time follows
 * the phone's 12 or 24-hour clock; the stored value is always 24-hour.
 */
export function useScheduleText() {
  const t = useT();
  const formatClock = useFormatClock();
  return (checklist: Checklist) => {
    // An hourly checklist says how often and until when, not just when it starts.
    if (checklist.recurrence === 'HOURLY' && checklist.last_run_time) {
      return format(
        t(
          (checklist.interval_hours ?? 1) === 1
            ? 'chk-list.hourly-one'
            : 'chk-list.hourly-n',
        ),
        {
          first: formatClock(checklist.st_time),
          last: formatClock(checklist.last_run_time),
          e: String(checklist.interval_hours ?? 1),
        },
      );
    }
    return format(t(SCHEDULE_KEY[checklist.recurrence]), {
      time: formatClock(checklist.st_time),
      day: String(checklist.day_of_month ?? ''),
      days: (checklist.weekdays ?? [])
        .map((day) => t(`wd.${day}` as MessageKey))
        .join(', '),
    });
  };
}
