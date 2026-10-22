import type { Checklist } from '@/shared/api/types';

const MINUTES_PER_DAY = 24 * 60;

/**
 * The shortest gap between two runs of a schedule, in minutes. A window must be
 * shorter than this, or two windows overlap (API Contract §5, FE Spec §5).
 *
 * Weekly is the closest pair of chosen weekdays, counting round the week
 * (1 = Monday … 7 = Sunday). Monthly assumes the shortest month, 28 days.
 */
export function runGapMinutes(
  recurrence: Checklist['recurrence'],
  weekdays: readonly number[] | null | undefined,
): number {
  switch (recurrence) {
    case 'HOURLY':
      return 60;
    case 'DAILY':
      return MINUTES_PER_DAY;
    case 'MONTHLY':
      return 28 * MINUTES_PER_DAY;
    case 'WEEKLY': {
      const days = [...new Set(weekdays ?? [])].sort((a, b) => a - b);
      if (days.length < 2) return 7 * MINUTES_PER_DAY;
      let gap = days[0] + 7 - days[days.length - 1];
      for (let i = 1; i < days.length; i++) {
        gap = Math.min(gap, days[i] - days[i - 1]);
      }
      return gap * MINUTES_PER_DAY;
    }
  }
}

/** True when a window of this length runs into the next period's window. */
export function windowOverlapsNextRun(
  recurrence: Checklist['recurrence'],
  weekdays: readonly number[] | null | undefined,
  deadlineMinutes: number,
): boolean {
  return deadlineMinutes >= runGapMinutes(recurrence, weekdays);
}
