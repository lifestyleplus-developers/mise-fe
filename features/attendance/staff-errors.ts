import { ApiError } from '@/shared/api/client';

export type StaffFailure = 'forbidden' | 'module-off' | 'rejected' | 'failed';

/** Sorts a failed roster call into what the screen does about it. */
export function classifyStaffError(error: unknown): StaffFailure {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'forbidden';
    // A module that is off answers 404, as does a person who is gone.
    if (error.status === 404) return 'module-off';
    // The platform's own words, for a code already taken and the like.
    if (error.status === 400) return 'rejected';
  }
  return 'failed';
}

/** The message the platform sent with a refusal, in its own words. */
export function serverMessage(error: unknown): string | null {
  return error instanceof ApiError ? error.body.error.message : null;
}
