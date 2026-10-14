import { useMutation } from '@tanstack/react-query';
import * as React from 'react';

import { api } from '@/shared/api/client';
import { queryClient } from '@/shared/api/query-client';
import type { AnswerTaskRequest, RunDetail, RunTask } from '@/shared/api/types';

/**
 * PATCH /run-tasks/{id} — its defaults, so a paused (queued) mutation can be
 * replayed after the app restarts (AGENTS.md: setMutationDefaults at the
 * point the mutation is defined).
 */
const answerTaskMutationFn = ([id, request]: readonly [
  number,
  AnswerTaskRequest,
]): Promise<RunTask> => api.runTasks.answer(id, request);

queryClient.setMutationDefaults(['run-tasks', 'answer'], {
  mutationFn: answerTaskMutationFn,
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
    { taskId: number; request: AnswerTaskRequest },
    { previous: RunDetail | undefined }
  >({
    mutationKey: ['run-tasks', 'answer'],
    networkMode: 'online',
    mutationFn: ({ taskId, request }) =>
      answerTaskMutationFn([taskId, request]),
    onMutate: async ({ taskId, request }) => {
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
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['runs', runId], context.previous);
      }
    },
    onSuccess: (task) => {
      applyAnswer(runId, task);
    },
  });
}

/**
 * How many of this run's writes are held on the phone: a mutation that is
 * paused while offline, or one that errored and is awaiting a Retry. Both
 * count as "waiting to send" (FE Spec §6, §11) — a queued No counts once.
 */
export function useAnswerPendingCount(taskIds: number[]) {
  return React.useMemo(() => {
    const cache = queryClient.getMutationCache();
    let count = 0;
    for (const mutation of cache.getAll()) {
      if (
        mutation.state.status === 'pending' &&
        JSON.stringify(mutation.options.mutationKey) ===
          JSON.stringify(['run-tasks', 'answer'])
      ) {
        const variables = mutation.state.variables as
          { taskId: number } | undefined;
        if (variables && taskIds.includes(variables.taskId)) count += 1;
      }
    }
    return count;
  }, [taskIds]);
}
