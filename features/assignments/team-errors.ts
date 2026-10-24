import { MockApiError } from '@/shared/api/client';
import { API_ERROR_CODE, type AssignmentRole } from '@/shared/api/types';

/** What a failed change to a team means for the screen. */
export type TeamFailure =
  | 'saveFailed'
  | 'conflict'
  | 'serverError'
  | 'forbiddenManager'
  /** The caller was taken off this checklist. */
  | 'notYours'
  /** The caller can no longer change this team at all. */
  | 'roleLost'
  /** The checklist was archived or removed. */
  | 'gone';

/** Failures that end the screen's usefulness: the lists are hidden. */
export const LOCKING_FAILURES: readonly TeamFailure[] = [
  'notYours',
  'roleLost',
  'gone',
];

/**
 * Sorts a failed add or remove. A 403 reads differently by who is asking: an
 * administrator has lost their role; a Checklist Manager reaching for the
 * managers' list was never allowed; otherwise they are off the checklist.
 */
export function classifyTeamError(
  error: unknown,
  context: { role: AssignmentRole; viewerIsAdmin: boolean },
): TeamFailure {
  if (!(error instanceof MockApiError)) return 'saveFailed';
  const { status, body } = error;
  if (status === 404 || (status === 409 && body.error.code === 'archived')) {
    return 'gone';
  }
  if (status === 409 && body.error.code === API_ERROR_CODE.ROLE_CONFLICT) {
    return 'conflict';
  }
  if (status === 403) {
    if (context.viewerIsAdmin) return 'roleLost';
    return context.role === 'CL_ADMIN' ? 'forbiddenManager' : 'notYours';
  }
  if (status === 400) return 'serverError';
  return 'saveFailed';
}
