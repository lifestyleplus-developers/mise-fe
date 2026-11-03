import type { QueuedWrite } from '@/shared/api/query-helpers';
import type { SpotCheckRunCapture } from '@/shared/api/types';

import type { PhotoDraft } from './photo-outbox';
import type { SubmitPhotoVariables } from './use-spot-photo-queue';

/**
 * One prompt of a capture, as the row shows it:
 * - `toTake`: nothing yet, window open.
 * - `uploading`: the photograph is going to storage.
 * - `waiting`: kept on the phone or queued, "Waiting to send".
 * - `failed`: the upload did not go; Retry.
 * - `sent`: the platform has it.
 * - `notTaken`: the window closed without one.
 * - `late`: a photograph the platform refused because the window had closed.
 */
export type PromptState =
  'toTake' | 'uploading' | 'waiting' | 'failed' | 'sent' | 'notTaken' | 'late';

type PromptStateInput = {
  capture: Pick<SpotCheckRunCapture, 'photo'>;
  /** The photograph still on the phone for this prompt, if any. */
  draft?: Pick<PhotoDraft, 'stage'> | null;
  /** The send for this prompt that has not landed, if any. */
  queued?: Pick<QueuedWrite<SubmitPhotoVariables>, 'kind'> | null;
  /** The run's window has closed. */
  closed: boolean;
};

/**
 * Folds the three places a photograph can be (the run's own record, the outbox,
 * the retry queue) into the one state a row shows. What is newest wins: a retake
 * going up shows as `uploading` even though the earlier photograph is `sent`.
 */
export function promptState({
  capture,
  draft,
  queued,
  closed,
}: PromptStateInput): PromptState {
  if (queued?.kind === 'refused') return 'late';
  if (draft) {
    if (draft.stage === 'uploading') return 'uploading';
    if (draft.stage === 'noUploadUrl') return 'waiting';
    return 'failed';
  }
  if (queued?.kind === 'waiting') return 'waiting';
  if (capture.photo) return 'sent';
  return closed ? 'notTaken' : 'toTake';
}
