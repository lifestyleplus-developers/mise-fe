import type { MessageKey } from '@/shared/i18n';

/** HH:MM, 24-hour, in the device's local time. */
export function clockTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Whether `iso` falls on a later day than `now` — the wording then says "tomorrow". */
export function isTomorrow(iso: string, now: number): boolean {
  return !sameDay(new Date(iso), new Date(now));
}

/** Picks the "today" or "tomorrow" catalogue key for a moment. */
export function dayKey(
  iso: string,
  now: number,
  today: MessageKey,
  tomorrow: MessageKey,
): MessageKey {
  return isTomorrow(iso, now) ? tomorrow : today;
}
