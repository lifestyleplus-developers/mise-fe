import type { InterfaceLanguage } from '@/shared/constants/languages';

/**
 * A span of whole days, as the YYYY-MM-DD the platform's `from` and `to` take
 * (both inclusive). `preset` remembers which row of the sheet made it.
 */
export type RangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom';

export type DateRange = { preset: RangePreset; from: string; to: string };

const pad = (n: number) => String(n).padStart(2, '0');

/** The local day of a moment, as YYYY-MM-DD. */
export function toDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of a YYYY-MM-DD. */
export function fromDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

function daysBefore(day: Date, count: number): Date {
  const earlier = new Date(day);
  earlier.setDate(earlier.getDate() - count);
  return earlier;
}

/** A named range ending today (Yesterday ends yesterday). */
export function rangeFor(
  preset: Exclude<RangePreset, 'custom'>,
  now: Date = new Date(),
): DateRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case 'today':
      return { preset, from: toDay(today), to: toDay(today) };
    case 'yesterday': {
      const day = toDay(daysBefore(today, 1));
      return { preset, from: day, to: day };
    }
    case 'last7':
      return { preset, from: toDay(daysBefore(today, 6)), to: toDay(today) };
    case 'last30':
      return { preset, from: toDay(daysBefore(today, 29)), to: toDay(today) };
  }
}

/** "To can't be before From." YYYY-MM-DD strings compare in date order. */
export function isRangeValid(from: string, to: string): boolean {
  return from <= to;
}

/** How many days a month has; `month` is 1 to 12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

const LOCALE: Record<InterfaceLanguage, string> = {
  EN: 'en-IN',
  HI: 'hi-IN',
  ML: 'ml-IN',
  KN: 'kn-IN',
};

/** "14 Oct", or "14 Oct 2025" for another year. Month names come from the phone. */
export function formatDay(
  day: string,
  language: InterfaceLanguage,
  now: Date = new Date(),
): string {
  const date = fromDay(day);
  try {
    return new Intl.DateTimeFormat(LOCALE[language], {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    }).format(date);
  } catch {
    return day;
  }
}

/** A month's short name, for the month column. */
export function monthName(month: number, language: InterfaceLanguage): string {
  try {
    return new Intl.DateTimeFormat(LOCALE[language], { month: 'short' }).format(
      new Date(2000, month - 1, 1),
    );
  } catch {
    return String(month);
  }
}
