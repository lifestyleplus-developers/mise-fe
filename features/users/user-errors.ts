import { MockApiError } from '@/shared/api/client';
import { API_ERROR_CODE } from '@/shared/api/types';

export type UserSaveFailure = 'username-taken' | 'forbidden' | 'failed';

export function isForbidden(error: unknown): boolean {
  return error instanceof MockApiError && error.status === 403;
}

/** Sorts a failed user write into what the screen says about it. */
export function classifyUserSaveError(error: unknown): UserSaveFailure {
  if (isForbidden(error)) return 'forbidden';
  if (
    error instanceof MockApiError &&
    error.body.error.code === API_ERROR_CODE.VALIDATION_ERROR &&
    error.body.error.field === 'username'
  ) {
    return 'username-taken';
  }
  return 'failed';
}
