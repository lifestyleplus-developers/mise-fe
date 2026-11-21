import { useMutation } from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { ApiError } from '@/shared/api/http';
import { queryClient } from '@/shared/api/query-client';
import { useQueuedWrites } from '@/shared/api/query-helpers';
import type { AnswerTaskRequest, RunDetail, RunTask } from '@/shared/api/types';

/**
 * PATCH /run-tasks/{id} — its defaults, so a paused (queued) mutation can be
 * replayed after the app restarts (AGENTS.md: setMutationDefaults at the
 * point the mutation is defined).
 */
type AnswerTaskVariables = { taskId: number; request: AnswerTaskRequest };

const answerTaskMutationFn = ({
  taskId,
  request,
}: AnswerTaskVariables): Promise<RunTask> =>
  api.runTasks.answer(taskId, request);

queryClient.setMutationDefaults(['run-tasks', 'answer'], {
  mutationFn: answerTaskMutationFn,
  // A replayed mutation has no hook around it, so it does not know its run:
  // find the cached run that holds this task and update that one.
  onSuccess: (task: RunTask) => {
    for (const [key, run] of queryClient.getQueriesData<RunDetail>({
      queryKey: ['runs'],
    })) {
      if (run?.tasks?.some((candidate) => candidate.id === task.id)) {
        applyAnswer(key[1] as number, task);
      }
    }
  },
});

function applyAnswer(runId: number, task: RunTask): void {
  queryClient.setQueryData<RunDetail>(['runs', runId], (run) =>
    run
      ? {
          ...run,
          answered_count: Math.min(
            run.total_tasks,
            run.tasks.filter((candidate) => candidate.answered_at !== null)
              .length,
          ),
          tasks: run.tasks.map((candidate) =>
            candidate.id === task.id ? task : candidate,
          ),
        }
      : run,
  );
}

/** One answer, written as it is given — there is no submit endpoint (§7). */
export function useAnswerTask(runId: number) {
  return useMutation<
    RunTask,
    Error,
    AnswerTaskVariables,
    { previous: RunDetail | undefined }
  >({
    mutationKey: ['run-tasks', 'answer'],
    networkMode: 'online',
    mutationFn: answerTaskMutationFn,
    onMutate: async ({ taskId, request }) => {
      // A refetch already in flight would land after this and overwrite the
      // optimistic answer with the platform's older copy.
      await queryClient.cancelQueries({ queryKey: ['runs', runId] });
      // Optimistic: the row shows the answer (or its pending part) at once.
      const previous = queryClient.getQueryData<RunDetail>(['runs', runId]);
      queryClient.setQueryData<RunDetail>(['runs', runId], (run) =>
        run
          ? {
              ...run,
              tasks: run.tasks.map((candidate) =>
                candidate.id === taskId
                  ? {
                      ...candidate,
                      ...request,
                      answered_by: null,
                      answered_at: new Date().toISOString(),
                    }
                  : candidate,
              ),
            }
          : run,
      );
      return { previous };
    },
    onError: (error, { taskId }, context) => {
      // Only a refusal is rolled back. A write that never arrived stays on the
      // row as answered, waiting to send.
      if (!(error instanceof ApiError)) return;
      // Put back this task's row only: other answers sent meanwhile stay.
      const before = context?.previous?.tasks.find(
        (candidate) => candidate.id === taskId,
      );
      if (before) {
        queryClient.setQueryData<RunDetail>(['runs', runId], (run) =>
          run
            ? {
                ...run,
                tasks: run.tasks.map((candidate) =>
                  candidate.id === taskId ? before : candidate,
                ),
              }
            : run,
        );
      }
      // Settle on what the platform holds.
      void queryClient.invalidateQueries({ queryKey: ['runs', runId] });
    },
    onSuccess: (task) => {
      applyAnswer(runId, task);
    },
  });
}

/**
 * How many of this run's writes are held on the phone: paused while offline, or
 * failed in transit and awaiting a retry. Both count as "waiting to send" (FE
 * Spec §6, §11) — a queued No counts once. Re-renders as the queue changes.
 */
export function useAnswerPendingCount(taskIds: number[]) {
  const writes = useQueuedWrites<AnswerTaskVariables>(
    ['run-tasks', 'answer'],
    (variables) => String(variables.taskId),
  );
  return writes.filter(
    (write) =>
      write.kind === 'waiting' && taskIds.includes(write.variables.taskId),
  ).length;
}
