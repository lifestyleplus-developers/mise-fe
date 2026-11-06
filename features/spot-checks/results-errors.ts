import { ApiError } from '@/shared/api/client';

export type OverrideFailure =
  'note-missing' | 'refused' | 'closed' | 'rejected' | 'failed';

/** Sorts a failed override into what the sheet says about it. */
export function classifyOverrideError(error: unknown): OverrideFailure {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'refused';
    // The platform takes no override once the window has closed (SPT-03 `afterCloseFallback`).
    if (error.status === 409) return 'closed';
    if (error.status === 400) {
      return error.body.error.code === 'override_note_required'
        ? 'note-missing'
        : 'rejected';
    }
  }
  return 'failed';
}

/** The platform's own words for a refusal. */
export function overrideMessage(error: unknown): string | null {
  return error instanceof ApiError ? error.body.error.message : null;
}
