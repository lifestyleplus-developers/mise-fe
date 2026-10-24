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

/** The platform refused a task's text, which the sheet reports under the field. */
export function isTextRejected(error: unknown): boolean {
  return (
    error instanceof MockApiError &&
    error.status === 400 &&
    error.body.error.code === API_ERROR_CODE.VALIDATION_ERROR &&
    error.body.error.field === 'text'
  );
}
