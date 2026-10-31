import { ApiError } from '@/shared/api/client';
import { API_ERROR_CODE } from '@/shared/api/types';

export type ItemFailure =
  'duplicate' | 'unit-locked' | 'rejected' | 'forbidden' | 'gone' | 'failed';

/** Sorts a failed item write into what the sheet says about it. */
export function classifyItemError(error: unknown): ItemFailure {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'forbidden';
    if (error.status === 404) return 'gone';
    if (
      error.status === 409 &&
      error.body.error.code === API_ERROR_CODE.UNIT_LOCKED
    ) {
      return 'unit-locked';
    }
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
export function itemMessage(error: unknown): string | null {
  return error instanceof ApiError ? error.body.error.message : null;
}
