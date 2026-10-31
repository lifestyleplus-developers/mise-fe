import type { Href } from 'expo-router';

/**
 * Where "attendance session opened" lands (FE Spec §2): Marking, on that session.
 * With nothing behind it, Back goes to the Modules tab rather than out of the app.
 */
export function attendanceSessionHref(sessionId: number): Href {
  return { pathname: '/attendance', params: { session: String(sessionId) } };
}
