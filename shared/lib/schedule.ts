import type { Checklist } from '@/shared/api/types';

const MINUTES_PER_DAY = 24 * 60;

/** The platform refuses a window shorter than this. */
export const MIN_WINDOW_MINUTES = 5;

/** An hourly checklist runs every 1, 2 or 3 hours. */
export const HOURLY_INTERVALS = [1, 2, 3] as const;

/**
 * The shortest gap between two runs of a schedule, in minutes. A window may be as long
 * as this and no longer (API Contract §5): closing just as the next one opens is fine.
 *
 * Hourly is its interval. Weekly is the closest pair of chosen weekdays, counting round
 * the week (1 = Monday … 7 = Sunday). Monthly assumes the shortest month, 28 days.
 */
export function runGapMinutes(
  recurrence: Checklist['recurrence'],
  weekdays: readonly number[] | null | undefined,
  intervalHours: number | null | undefined = 1,
): number {
  switch (recurrence) {
    case 'HOURLY':
      return (intervalHours ?? 1) * 60;
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

/** True when a window of this length runs into the next run's window. */
export function windowOverlapsNextRun(
  recurrence: Checklist['recurrence'],
  weekdays: readonly number[] | null | undefined,
  deadlineMinutes: number,
  intervalHours: number | null | undefined = 1,
): boolean {
  return deadlineMinutes > runGapMinutes(recurrence, weekdays, intervalHours);
}

/**
 * The times an hourly checklist can end on, as minutes after midnight: every interval
 * after its first run, up to the end of the day. Empty when the first run is so late no
 * other fits — "No later run today".
 */
export function lastRunChoices(
  startMinutes: number,
  intervalHours: number,
): number[] {
  const step = intervalHours * 60;
  const choices: number[] = [];
  for (let at = startMinutes + step; at < MINUTES_PER_DAY; at += step) {
    choices.push(at);
  }
  return choices;
}

/** Whether `lastMinutes` is a run of an hourly schedule: on or after the first, on the step. */
export function isRunTime(
  startMinutes: number,
  lastMinutes: number,
  intervalHours: number,
): boolean {
  return (
    lastMinutes >= startMinutes &&
    lastMinutes < MINUTES_PER_DAY &&
    (lastMinutes - startMinutes) % (intervalHours * 60) === 0
  );
}

/** How many runs an hourly schedule makes in a day. */
export function runsPerDay(
  startMinutes: number,
  lastMinutes: number,
  intervalHours: number,
): number {
  return Math.floor((lastMinutes - startMinutes) / (intervalHours * 60)) + 1;
}
