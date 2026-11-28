import { attendanceKeys } from '@/features/attendance/attendance-keys';
import {
  MARK_KEY,
  type MarkVariables,
} from '@/features/attendance/use-mark-person';
import {
  ANSWER_KEY,
  type AnswerTaskVariables,
} from '@/features/run/use-answer-task';
import { spotCheckKeys } from '@/features/spot-checks/spot-check-keys';
import {
  SUBMIT_KEY,
  type SubmitPhotoVariables,
} from '@/features/spot-checks/use-spot-photo-queue';
import { onLateWrite } from '@/shared/api/late-writes';
import { queryClient, setWriteDescriber } from '@/shared/api/query-client';
import type {
  AttendanceSessionDetail,
  RunDetail,
  SpotCheckRun,
} from '@/shared/api/types';
import { onSignOut } from '@/shared/lib/on-sign-out';

import { useLateRefusals, type LateGroup } from './late-refusals';

const same = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((part, i) => part === b[i]);

/** What the dialog says about a late answer, read from the cache. */
type AnswerDetail = {
  runId: number;
  name: string;
  closeIso: string;
  task: string;
};
type MarkDetail = { sessionId: number; closeIso: string; name: string };
type PhotoDetail = {
  runId: number;
  closeIso: string | null;
  progress: { sent: number; total: number } | null;
};

/** The cached run that holds this task: a detail, which is the only one with tasks. */
function runOfTask(taskId: number): RunDetail | undefined {
  for (const [, run] of queryClient.getQueriesData<RunDetail>({
    queryKey: ['runs'],
  })) {
    if (run?.tasks?.some((task) => task.id === taskId)) return run;
  }
  return undefined;
}

function answerDetail(
  variables: AnswerTaskVariables,
): AnswerDetail | undefined {
  const run = runOfTask(variables.taskId);
  if (!run) return undefined;
  return {
    runId: run.id,
    name: run.checklist_name,
    closeIso: run.window_close,
    task: run.tasks.find((task) => task.id === variables.taskId)?.text ?? '',
  };
}

function markDetail(variables: MarkVariables): MarkDetail | undefined {
  const session = queryClient.getQueryData<AttendanceSessionDetail>(
    attendanceKeys.session(variables.sessionId),
  );
  const name = session?.marks.find((mark) => mark.id === variables.markId)
    ?.staff.full_name;
  if (!session || !name) return undefined;
  return {
    sessionId: session.id,
    closeIso: session.window_close,
    name,
  };
}

function photoDetail(variables: SubmitPhotoVariables): PhotoDetail {
  const run = queryClient.getQueryData<SpotCheckRun>(
    spotCheckKeys.run(variables.runId),
  );
  const captures = run?.captures ?? null;
  return {
    runId: variables.runId,
    closeIso: run?.window_close ?? null,
    progress: captures
      ? {
          sent: captures.filter((capture) => capture.photo !== null).length,
          total: captures.length,
        }
      : null,
  };
}

/**
 * What a late dialog will need about a write, read now while the run or session is
 * still cached. A write held across a session is described when it is held, since
 * by the time it is sent the cache has been emptied.
 */
function describe(key: readonly unknown[], variables: unknown): unknown {
  if (same(key, ANSWER_KEY))
    return answerDetail(variables as AnswerTaskVariables);
  if (same(key, MARK_KEY)) return markDetail(variables as MarkVariables);
  if (same(key, SUBMIT_KEY))
    return photoDetail(variables as SubmitPhotoVariables);
  return undefined;
}

setWriteDescriber(describe);

function lateAnswer(
  detail: AnswerDetail,
  variables: AnswerTaskVariables,
  context: unknown,
) {
  // Was there an answer before this one? Only a write made in this session knows;
  // one replayed after a restart or a session is treated as the first.
  const before = (context as { previous?: RunDetail } | undefined)?.previous;
  const changed =
    before?.tasks.find((task) => task.id === variables.taskId)?.answered_at !=
    null;
  const id = `answers:${detail.runId}`;
  useLateRefusals.getState().add(
    id,
    () => ({
      id,
      kind: 'answers',
      name: detail.name,
      closeIso: detail.closeIso,
      answers: changed ? [] : [detail.task],
      changes: changed ? [detail.task] : [],
    }),
    (group) =>
      group.kind === 'answers'
        ? {
            ...group,
            answers: changed ? group.answers : [...group.answers, detail.task],
            changes: changed ? [...group.changes, detail.task] : group.changes,
          }
        : group,
  );
}

function lateMark(detail: MarkDetail) {
  const id = `marks:${detail.sessionId}`;
  useLateRefusals.getState().add(
    id,
    () => ({
      id,
      kind: 'marks',
      closeIso: detail.closeIso,
      names: [detail.name],
    }),
    (group) =>
      group.kind === 'marks' && !group.names.includes(detail.name)
        ? { ...group, names: [...group.names, detail.name] }
        : group,
  );
}

function latePhoto(detail: PhotoDetail) {
  const id = `photo:${detail.runId}`;
  const group: LateGroup = {
    id,
    kind: 'photo',
    closeIso: detail.closeIso,
    progress: detail.progress,
  };
  useLateRefusals.getState().add(
    id,
    () => group,
    () => group,
  );
}

// Imported once by the root layout, so it is registered however the app starts.
onLateWrite(({ mutationKey, variables, context, meta }) => {
  // A write held across a session carries what it needs; otherwise read the cache.
  const held = meta?.detail;
  const detail = held ?? describe(mutationKey, variables);
  if (!detail) return;
  if (same(mutationKey, ANSWER_KEY)) {
    lateAnswer(
      detail as AnswerDetail,
      variables as AnswerTaskVariables,
      context,
    );
  } else if (same(mutationKey, MARK_KEY)) lateMark(detail as MarkDetail);
  else if (same(mutationKey, SUBMIT_KEY)) latePhoto(detail as PhotoDetail);
  // Stock and issue resolves have no window, so there is nothing late to say.
});

onSignOut(() => useLateRefusals.getState().clear());
