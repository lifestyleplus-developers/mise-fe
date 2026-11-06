import { ApiError, NotBuiltError } from '@/shared/api/client';

export type CheckFailure = 'rejected' | 'forbidden' | 'gone' | 'failed';

/** Sorts a failed check write into what the editor says about it. */
export function classifyCheckError(error: unknown): CheckFailure {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'forbidden';
    if (error.status === 404) return 'gone';
    if (error.status === 400) return 'rejected';
  }
  return 'failed';
}

/** The platform's own words for a refusal. */
export function checkMessage(error: unknown): string | null {
  return error instanceof ApiError ? error.body.error.message : null;
}

/**
 * The platform will not change the prompts or items of a check that exists
 * (SPT-05 `itemFallback`): the answer to a save that carried them.
 */
export function isListLocked(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 400 &&
    error.body.error.code === 'list_locked'
  );
}

/**
 * The platform has no way to list, appoint or remove a Spot-check Manager (SPT-05
 * `managerNotWired`): the request was never built here, or it answered "method not
 * allowed".
 */
export function isManagerNotWired(error: unknown): boolean {
  return (
    error instanceof NotBuiltError ||
    (error instanceof ApiError && error.status === 405)
  );
}
