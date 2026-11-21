/** An ordinary call to the platform: sent, answered and read. */
export const REQUEST_TIMEOUT_MS = 20_000;

/** A photograph going up to storage; a phone on poor Wi-Fi needs longer. */
export const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * Runs `run` with an abort signal that fires after `ms`. Pass the signal to
 * `fetch`: a stalled connection then ends as a network error, which screens
 * already read as "unreachable", instead of a spinner with no end.
 */
export async function withTimeout<T>(
  ms: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}
