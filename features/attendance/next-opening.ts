import type { AttendanceConfig } from '@/shared/api/types';
import { daysInMonth } from '@/shared/lib/date-range';
import { parseClock } from '@/shared/lib/time';

type Schedule = Pick<
  AttendanceConfig,
  'recurrence' | 'st_time' | 'weekdays' | 'day_of_month'
>;

function at(day: Date, hhmm: string): Date {
  const { hour, minute } = parseClock(hhmm);
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hour,
    minute,
  );
}

/**
 * When a configuration next opens a session, worked out on the phone (the platform
 * has no "next session" to ask for). Weekly days are 1 = Monday … 7 = Sunday; a
 * monthly day past the end of a short month falls on its last day.
 */
export function nextOpening(config: Schedule, now: Date = new Date()): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (config.recurrence === 'DAILY') {
    const candidate = at(today, config.st_time);
    return candidate.getTime() > now.getTime()
      ? candidate
      : at(
          new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
          config.st_time,
        );
  }

  if (config.recurrence === 'WEEKLY') {
    const days = config.weekdays ?? [];
    for (let offset = 0; offset <= 7; offset++) {
      const day = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + offset,
      );
      const weekday = day.getDay() === 0 ? 7 : day.getDay();
      const candidate = at(day, config.st_time);
      if (days.includes(weekday) && candidate.getTime() > now.getTime()) {
        return candidate;
      }
    }
  }

  const wanted = config.day_of_month ?? 1;
  for (let offset = 0; offset <= 2; offset++) {
    const month = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const day = Math.min(
      wanted,
      daysInMonth(month.getFullYear(), month.getMonth() + 1),
    );
    const candidate = at(
      new Date(month.getFullYear(), month.getMonth(), day),
      config.st_time,
    );
    if (candidate.getTime() > now.getTime()) return candidate;
  }
  return at(today, config.st_time);
}

/** Which of several configurations opens first, and when. */
export function soonestOpening<T extends Schedule>(
  configs: readonly T[],
  now: Date = new Date(),
): { config: T; opensAt: Date } | null {
  let best: { config: T; opensAt: Date } | null = null;
  for (const config of configs) {
    const opensAt = nextOpening(config, now);
    if (!best || opensAt.getTime() < best.opensAt.getTime()) {
      best = { config, opensAt };
    }
  }
  return best;
}

/** 0 = today, 1 = tomorrow, more = days on, by calendar day (not 24-hour spans). */
export function daysUntil(moment: Date, now: Date = new Date()): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(moment.getFullYear(), moment.getMonth(), moment.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
