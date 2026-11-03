import { ApiError } from '@/shared/api/client';

export type AreaFailure =
  'duplicate' | 'rejected' | 'forbidden' | 'gone' | 'failed';

/** Sorts a failed area write into what the screen says about it. */
export function classifyAreaError(error: unknown): AreaFailure {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'forbidden';
    if (error.status === 404) return 'gone';
    if (error.status === 400) {
      return error.body.error.field === 'name' &&
        /already exists/i.test(error.body.error.message)
        ? 'duplicate'
        : 'rejected';
    }
  }
  return 'failed';
}

/** The platform's own words for a refusal. */
export function areaMessage(error: unknown): string | null {
  return error instanceof ApiError ? error.body.error.message : null;
}
