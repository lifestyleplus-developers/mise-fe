import { useCountdown } from '@/features/run/use-countdown';

/** The ring turns heavy and says so this long before the window closes (SPT-01 `final`). */
export const SPOT_FINAL_MS = 5 * 60 * 1000;

/** `10:00`, `4:59`, `0:07`: rounded up, so it never reads 0:00 while time remains. */
export function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/** The time left in a reveal window, ticking every second, and whether it is the last stretch. */
export function useSpotCountdown(windowClose: string | undefined) {
  const { remainingMs } = useCountdown(windowClose);
  return {
    remainingMs,
    value: remainingMs === null ? '' : formatRemaining(remainingMs),
    final:
      remainingMs !== null && remainingMs > 0 && remainingMs <= SPOT_FINAL_MS,
    closed: remainingMs === 0,
  };
}
