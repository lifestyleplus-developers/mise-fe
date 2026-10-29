import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { checklistKeys } from '@/features/checklists/checklist-keys';
import { api } from '@/shared/api/client';
import type {
  CreateTaskRequest,
  ReorderTasksRequest,
  Task,
  UpdateTaskRequest,
} from '@/shared/api/types';

/** A checklist's tasks, in authored order. */
export function useChecklistTasks(checklistId: number) {
  return useQuery({
    queryKey: checklistKeys.tasks(checklistId),
    queryFn: () => api.checklists.tasks(checklistId),
  });
}

/**
 * The task cache is written directly, so the list is right at once. What it
 * shares a key prefix with, and the lists that count tasks, are refetched.
 * Run snapshots are not: "Edits apply from tomorrow" (Model §7).
 */
function useTaskCache(checklistId: number) {
  const queryClient = useQueryClient();
  const key = checklistKeys.tasks(checklistId);
  return {
    key,
    read: () => queryClient.getQueryData<Task[]>(key),
    write: (update: (tasks: Task[]) => Task[]) =>
      queryClient.setQueryData<Task[]>(key, (tasks) => tasks && update(tasks)),
    replace: (tasks: Task[] | undefined) =>
      queryClient.setQueryData<Task[]>(key, tasks),
    cancel: () => queryClient.cancelQueries({ queryKey: key }),
    refreshAround: () => {
      void queryClient.invalidateQueries({
        queryKey: checklistKeys.detail(checklistId),
        exact: true,
      });
      void queryClient.invalidateQueries({ queryKey: checklistKeys.lists });
    },
  };
}

/** The platform closes the gap a removed task leaves. */
function renumber(tasks: Task[]): Task[] {
  return tasks.map((task, index) => ({ ...task, position: index + 1 }));
}

/** Fails now rather than pausing offline, like every authoring save. */
export function useCreateTask(checklistId: number) {
  const cache = useTaskCache(checklistId);
  return useMutation({
    mutationFn: (request: CreateTaskRequest) =>
      api.checklists.createTask(checklistId, request),
    networkMode: 'always',
    onSuccess: (task) => {
      cache.write((tasks) => [...tasks, task]);
      cache.refreshAround();
    },
  });
}

export function useUpdateTask(checklistId: number) {
  const cache = useTaskCache(checklistId);
  return useMutation({
    mutationFn: ({ id, ...request }: UpdateTaskRequest & { id: number }) =>
      api.tasks.update(id, request),
    networkMode: 'always',
    onSuccess: (task) => {
      cache.write((tasks) => tasks.map((t) => (t.id === task.id ? task : t)));
      cache.refreshAround();
    },
  });
}

export function useRemoveTask(checklistId: number) {
  const cache = useTaskCache(checklistId);
  return useMutation({
    mutationFn: (id: number) => api.tasks.archive(id),
    networkMode: 'always',
    onSuccess: (_result, id) => {
      cache.write((tasks) => renumber(tasks.filter((t) => t.id !== id)));
      cache.refreshAround();
    },
  });
}

/**
 * The list moves at once and snaps back to the saved order if the save fails
 * (the mockup's `reorderFailed`).
 */
export function useReorderTasks(checklistId: number) {
  const cache = useTaskCache(checklistId);
  return useMutation({
    mutationFn: (request: ReorderTasksRequest) =>
      api.checklists.reorderTasks(checklistId, request),
    networkMode: 'always',
    onMutate: async ({ task_ids }) => {
      await cache.cancel();
      const previous = cache.read();
      cache.write((tasks) =>
        renumber(
          task_ids.flatMap((id) => tasks.find((t) => t.id === id) ?? []),
        ),
      );
      return { previous };
    },
    onError: (_error, _request, context) => cache.replace(context?.previous),
    onSuccess: (tasks) => {
      cache.replace(tasks);
      cache.refreshAround();
    },
  });
}
