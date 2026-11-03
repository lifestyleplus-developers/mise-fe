import { ApiError } from '@/shared/api/client';

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
