/**
 * How far the phone's clock is from the platform's. Whether a run is open or
 * closed is decided by the platform, so the app reads the time as the platform
 * does: the phone's clock plus this offset, learned from the `Date` header of
 * its replies. Until a reply arrives the offset is 0.
 */
let offsetMs = 0;
let known = false;

/** Changes smaller than this are noise (the header is whole seconds). */
const JITTER_MS = 2_000;

/**
 * Take the time from one reply. `sentAt` and `receivedAt` are the phone's own
 * clock (ms) around the call; the platform stamped it somewhere between, and
 * the header drops the fraction of a second, so aim for the middle of both.
 */
export function noteServerTime(
  dateHeader: string | null,
  sentAt: number,
  receivedAt: number,
): void {
  if (!dateHeader) return;
  const server = Date.parse(dateHeader);
  if (Number.isNaN(server)) return;
  const next = server + 500 - (sentAt + receivedAt) / 2;
  if (!known || Math.abs(next - offsetMs) > JITTER_MS) {
    offsetMs = next;
    known = true;
  }
}

/** The platform's current time, in ms. */
export function serverNow(): number {
  return Date.now() + offsetMs;
}
