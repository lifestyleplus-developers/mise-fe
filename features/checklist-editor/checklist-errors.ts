import { MockApiError } from '@/shared/api/client';
import { API_ERROR_CODE } from '@/shared/api/types';

/** What a failed checklist write or load means for the editor. */
export type EditorFailure = 'overlap' | 'forbidden' | 'gone' | 'failed';

export function classifyEditorError(error: unknown): EditorFailure {
  if (error instanceof MockApiError) {
    if (error.status === 403) return 'forbidden';
    if (error.status === 404) return 'gone';
    if (
      error.status === 409 &&
      error.body.error.code === API_ERROR_CODE.WINDOW_OVERLAPS_NEXT_PERIOD
    ) {
      return 'overlap';
    }
  }
  return 'failed';
}
