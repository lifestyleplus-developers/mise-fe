import { format, useT } from '@/shared/i18n';
import { useNow } from '@/shared/lib/use-now';
import * as React from 'react';

/** The look switches this long before the window closes (bundle: finalMinutes). */
export const FINAL_MINUTES_THRESHOLD_MS = 10 * 60 * 1000;

type CountdownLook = 'normal' | 'finalMinutes' | 'finalSeconds';

/**
 * The remaining window, in its three looks (FE Spec §3.3, §11):
 * `normal`, `finalMinutes` (≤ 10 min), `finalSeconds` (< 1 min). The floor
 * rounding keeps "40 s left" honest — it never says 0 while time remains.
 */
export function useCountdown(windowCloseIso: string | undefined) {
  const close = React.useMemo(
    () => (windowCloseIso ? new Date(windowCloseIso).getTime() : null),
    [windowCloseIso],
  );
  // Second tick: the countdown must move every second, not every 15.
  const now = useNow(1_000);
  const t = useT();

  return React.useMemo(() => {
    if (close === null) {
      return { look: 'normal' as CountdownLook, label: '', remainingMs: null };
    }
    const remainingMs = Math.max(0, close - now);
    const look: CountdownLook =
      remainingMs <= 0
        ? 'finalSeconds'
        : remainingMs < 60_000
          ? 'finalSeconds'
          : remainingMs <= FINAL_MINUTES_THRESHOLD_MS
            ? 'finalMinutes'
            : 'normal';
    const label = (() => {
      if (remainingMs <= 0) return format(t('run.closing-now'), {});
      const totalSeconds = Math.floor(remainingMs / 1000);
      if (totalSeconds < 60) {
        return format(t('run.seconds-left'), { n: String(totalSeconds) });
      }
      const minutes = Math.floor(totalSeconds / 60);
      return format(t('run.minutes-left'), { n: String(minutes) });
    })();
    return { look, label, remainingMs };
  }, [close, now, t]);
}

export type { CountdownLook };
