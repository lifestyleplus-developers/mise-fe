import { useT, format } from '@/shared/i18n';
import { deviceUses12HourClock, parseClock, to12Hour } from '@/shared/lib/time';
import { useCallback } from 'react';

/**
 * Formats an HH:MM time the way the phone does: 6:30 AM on a 12-hour phone,
 * 06:30 on a 24-hour one. Stored values are never localised (Model §15).
 */
export function useFormatClock() {
  const t = useT();
  return useCallback(
    (value: string) => {
      const { hour, minute } = parseClock(value);
      const mm = String(minute).padStart(2, '0');
      if (!deviceUses12HourClock()) {
        return `${String(hour).padStart(2, '0')}:${mm}`;
      }
      const { hour12, pm } = to12Hour(hour);
      return `${hour12}:${mm} ${t(pm ? 'time.pm' : 'time.am')}`;
    },
    [t],
  );
}

/** A window length as "1 d 2 h 30 min": days once it passes a day, then hours, then minutes. */
export function useFormatDuration() {
  const t = useT();
  return useCallback(
    (totalMinutes: number) => {
      const whole = Math.max(0, Math.round(totalMinutes));
      const days = Math.floor(whole / 1440);
      const hours = Math.floor((whole % 1440) / 60);
      const minutes = whole % 60;
      const parts = [
        days > 0 ? format(t('duration.days'), { n: String(days) }) : '',
        hours > 0 ? format(t('duration.hours-only'), { h: String(hours) }) : '',
        minutes > 0 || whole === 0
          ? format(t('duration.minutes-only'), { m: String(minutes) })
          : '',
      ];
      return parts.filter(Boolean).join(' ');
    },
    [t],
  );
}
