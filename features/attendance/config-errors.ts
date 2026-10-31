import { ApiError } from '@/shared/api/client';
import { API_ERROR_CODE } from '@/shared/api/types';

export type ConfigFailure =
  'overlap' | 'rejected' | 'forbidden' | 'gone' | 'failed';

/** What a failed configuration write or load means for the editor. */
export function classifyConfigError(error: unknown): ConfigFailure {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'forbidden';
    // A module that is off answers 404, as does a configuration that is gone.
    if (error.status === 404) return 'gone';
    if (
      error.status === 409 &&
      error.body.error.code === API_ERROR_CODE.WINDOW_OVERLAPS_NEXT_PERIOD
    ) {
      return 'overlap';
    }
    if (error.status === 400) return 'rejected';
  }
  return 'failed';
}

/** The platform's own words for a refusal, e.g. a name already used at the outlet. */
export function configMessage(error: unknown): string | null {
  return error instanceof ApiError ? error.body.error.message : null;
}
