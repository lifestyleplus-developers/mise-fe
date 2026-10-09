import { MockApiError } from '@/shared/api/client';
import { API_ERROR_CODE } from '@/shared/api/types';

export type SaveFailure = 'name-taken' | 'forbidden' | 'failed';

export function isForbidden(error: unknown): boolean {
  return error instanceof MockApiError && error.status === 403;
}

/** Sorts a failed outlet write into what the screen says about it. */
export function classifySaveError(error: unknown): SaveFailure {
  if (isForbidden(error)) return 'forbidden';
  if (
    error instanceof MockApiError &&
    error.body.error.code === API_ERROR_CODE.VALIDATION_ERROR &&
    error.body.error.field === 'name'
  ) {
    return 'name-taken';
  }
  return 'failed';
}
