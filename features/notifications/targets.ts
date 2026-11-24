import type { Href } from 'expo-router';

import { spotCheckRunHref } from '@/features/spot-checks/links';

/** What the platform sends with a push (API Contract §14). Anything may be missing. */
export type PushData = {
  type?: unknown;
  run_id?: unknown;
  session_id?: unknown;
};

/** A positive whole number, or null. The payload is untrusted: never build a route from it as-is. */
function idOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null;
}

/**
 * Where a tap goes (FE Spec §8). A push whose id is missing or malformed opens
 * the module's list instead, so a tap never lands on a blank screen. A type this
 * app does not know opens nothing.
 */
export function targetFromPush(data: PushData | null | undefined): Href | null {
  switch (data?.type) {
    case 'run_opened': {
      const runId = idOf(data.run_id);
      return runId === null
        ? '/home'
        : { pathname: '/runs/[id]', params: { id: runId } };
    }
    case 'attendance_session_opened': {
      const sessionId = idOf(data.session_id);
      return sessionId === null
        ? '/attendance'
        : { pathname: '/attendance', params: { session: String(sessionId) } };
    }
    case 'spot_check_revealed': {
      const runId = idOf(data.run_id);
      return runId === null ? '/spot-checks' : spotCheckRunHref(runId);
    }
    default:
      return null;
  }
}
