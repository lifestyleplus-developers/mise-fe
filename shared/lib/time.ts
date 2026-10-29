/** Times of day are HH:MM, 24-hour, in the business's local time (API §1). */
export type Clock = { hour: number; minute: number };

export function parseClock(value: string): Clock {
  const [hour, minute] = value.split(':').map(Number);
  return { hour: hour || 0, minute: minute || 0 };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toClockString({ hour, minute }: Clock): string {
  return `${pad(hour)}:${pad(minute)}`;
}

/** 0–23 → 1–12 and whether it is the afternoon. */
export function to12Hour(hour: number): { hour12: number; pm: boolean } {
  return { hour12: hour % 12 || 12, pm: hour >= 12 };
}

export function to24Hour(hour12: number, pm: boolean): number {
  return (hour12 % 12) + (pm ? 12 : 0);
}

/**
 * Whether the phone shows a 12-hour clock. When the runtime cannot say, 12
 * hours: it is what most people reading this app expect.
 */
export function deviceUses12HourClock(): boolean {
  try {
    const options = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
    }).resolvedOptions();
    return options.hour12 ?? true;
  } catch {
    return true;
  }
}

/** A window length as whole hours and the minutes left over. */
export function splitMinutes(total: number): {
  hours: number;
  minutes: number;
} {
  const whole = Math.max(0, Math.round(total));
  return { hours: Math.floor(whole / 60), minutes: whole % 60 };
}

export function joinMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}
