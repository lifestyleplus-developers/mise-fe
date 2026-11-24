import {
  ANSWER_KEY,
  type AnswerTaskVariables,
} from '@/features/run/use-answer-task';
import {
  MARK_KEY,
  type MarkVariables,
} from '@/features/attendance/use-mark-person';
import {
  RECORD_KEY,
  type RecordVariables,
} from '@/features/inventory/use-inventory-movements';
import {
  RESOLVE_KEY,
  type ResolveVariables,
} from '@/features/issues/issue-keys';
import {
  SUBMIT_KEY,
  type SubmitPhotoVariables,
} from '@/features/spot-checks/use-spot-photo-queue';
import { useQueuedWrites } from '@/shared/api/query-helpers';

/** The kinds of write the app holds on the phone when it cannot send (FE Spec §6). */
export const WRITE_KIND = {
  ANSWER: 'answers',
  MARK: 'marks',
  STOCK: 'stock',
  PHOTO: 'photos',
  RESOLVE: 'resolves',
} as const;

export type WriteKind = (typeof WRITE_KIND)[keyof typeof WRITE_KIND];

export type PendingWrites = {
  byKind: Record<WriteKind, number>;
  /** Every kind together. */
  total: number;
  /** The kinds with something waiting, in a fixed order; one means the line can name it. */
  kinds: WriteKind[];
};

const ORDER: WriteKind[] = [
  WRITE_KIND.ANSWER,
  WRITE_KIND.MARK,
  WRITE_KIND.STOCK,
  WRITE_KIND.PHOTO,
  WRITE_KIND.RESOLVE,
];

/**
 * Everything the phone is holding to send, counted by kind, across the whole app:
 * paused while offline, or failed in transit and awaiting a retry. A refusal
 * (409 `window_closed`) is not waiting, and neither is a send that is going
 * through right now. The keys match each screen's own queue, so the total agrees
 * with the "Waiting to send" shown on a row. Re-renders as the queue changes.
 *
 * Language is left out: it has its own line in Settings and is not work.
 */
export function usePendingWrites(): PendingWrites {
  const answers = useQueuedWrites<AnswerTaskVariables>(ANSWER_KEY, (v) =>
    String(v.taskId),
  );
  const marks = useQueuedWrites<MarkVariables>(MARK_KEY, (v) =>
    String(v.markId),
  );
  const stock = useQueuedWrites<RecordVariables>(
    RECORD_KEY,
    (v) => `${v.itemId}:${JSON.stringify(v.request)}`,
  );
  const photos = useQueuedWrites<SubmitPhotoVariables>(
    SUBMIT_KEY,
    (v) => `${v.runId}:${v.request.capture_position}`,
  );
  const resolves = useQueuedWrites<ResolveVariables>(RESOLVE_KEY, (v) =>
    String(v.incidentId),
  );

  const held = (writes: { kind: string; inFlight: boolean }[]) =>
    writes.filter((write) => write.kind === 'waiting' && !write.inFlight)
      .length;

  const byKind: Record<WriteKind, number> = {
    answers: held(answers),
    marks: held(marks),
    stock: held(stock),
    photos: held(photos),
    resolves: held(resolves),
  };
  const kinds = ORDER.filter((kind) => byKind[kind] > 0);
  return {
    byKind,
    total: kinds.reduce((sum, kind) => sum + byKind[kind], 0),
    kinds,
  };
}
