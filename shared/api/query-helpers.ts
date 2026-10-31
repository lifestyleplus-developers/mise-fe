import { useMutationState } from '@tanstack/react-query';

import { ApiError } from './http';

/**
 * Retry a read only when it might work next time. A 4xx is the platform's final
 * answer (module off, role lost, not found), so the screen shows it at once.
 */
export function retryTransient(count: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500) return false;
  return count < 3;
}

/**
 * One write held on the phone. `waiting` is "Waiting to send": still going, or
 * failed in transit and awaiting a retry; never shown as failed (FE Spec §6).
 * `refused` is the platform's answer to a write that did get there, such as
 * 409 `window_closed`; the screen explains it as "Not recorded". `done` never
 * leaves this module: it is how a later success replaces an earlier failure.
 */
export type QueuedWrite<Variables> = {
  key: string;
  variables: Variables;
  kind: 'waiting' | 'refused' | 'done';
  /** The refusal, when `kind` is `refused`. */
  error: ApiError | null;
  submittedAt: number;
};

/**
 * The writes under a mutation key that have not landed, latest per `keyOf`.
 * Re-renders as the retry queue changes.
 */
export function useQueuedWrites<Variables>(
  mutationKey: readonly unknown[],
  keyOf: (variables: Variables) => string,
): (QueuedWrite<Variables> & { kind: 'waiting' | 'refused' })[] {
  const writes = useMutationState<QueuedWrite<Variables> | null>({
    filters: { mutationKey },
    select: (mutation) => {
      const { status, variables, error, submittedAt } = mutation.state;
      if (status === 'idle') return null;
      return {
        key: keyOf(variables as Variables),
        variables: variables as Variables,
        kind:
          status === 'success'
            ? 'done'
            : error instanceof ApiError
              ? 'refused'
              : 'waiting',
        error: error instanceof ApiError ? error : null,
        submittedAt,
      };
    },
  });

  const latest = new Map<string, QueuedWrite<Variables>>();
  for (const write of writes) {
    if (!write) continue;
    const earlier = latest.get(write.key);
    if (!earlier || earlier.submittedAt <= write.submittedAt) {
      latest.set(write.key, write);
    }
  }
  return [...latest.values()].filter(
    (
      write,
    ): write is QueuedWrite<Variables> & { kind: 'waiting' | 'refused' } =>
      write.kind !== 'done',
  );
}
