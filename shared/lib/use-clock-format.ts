import { useT, format } from '@/shared/i18n';
import {
  deviceUses12HourClock,
  parseClock,
  splitMinutes,
  to12Hour,
} from '@/shared/lib/time';
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

/** A window length as "2 h 30 min", "2 h" or "45 min". */
export function useFormatDuration() {
  const t = useT();
  return useCallback(
    (totalMinutes: number) => {
      const { hours, minutes } = splitMinutes(totalMinutes);
      if (hours > 0 && minutes > 0) {
        return format(t('duration.hours-minutes'), {
          h: String(hours),
          m: String(minutes),
        });
      }
      if (hours > 0) {
        return format(t('duration.hours-only'), { h: String(hours) });
      }
      return format(t('duration.minutes-only'), { m: String(minutes) });
    },
    [t],
  );
}
