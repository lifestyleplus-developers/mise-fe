import type { MessageKey } from '@/shared/i18n';

/** What a tick on an outlet will do when Apply is pressed. */
export type Stage = 'start' | 'stop';

/** Outlet id → the change waiting to be applied. Outlets with no change are absent. */
export type Staged = Record<number, Stage>;

/**
 * Taps an outlet. A change waiting on it is taken back; otherwise a running
 * outlet is marked to stop and one that is not running to start.
 */
export function toggleStage(
  staged: Staged,
  outletId: number,
  running: boolean,
): Staged {
  if (staged[outletId]) {
    const { [outletId]: _removed, ...rest } = staged;
    return rest;
  }
  return { ...staged, [outletId]: running ? 'stop' : 'start' };
}

/** The outlets to start and to stop, each in a stable order. */
export function splitStaged(staged: Staged): {
  starts: number[];
  stops: number[];
} {
  const ids = Object.keys(staged)
    .map(Number)
    .sort((a, b) => a - b);
  return {
    starts: ids.filter((id) => staged[id] === 'start'),
    stops: ids.filter((id) => staged[id] === 'stop'),
  };
}

/** The Apply button's wording follows what is waiting. */
export function applyLabel(
  starts: number,
  stops: number,
): { key: MessageKey; n?: number } {
  if (starts > 0 && stops > 0) return { key: 'out.apply-changes' };
  if (starts === 1) return { key: 'out.apply-one' };
  if (starts > 1) return { key: 'out.apply-n', n: starts };
  return { key: 'out.apply' };
}

/** The outlets that run a checklist once the changes land. */
export function runningAfter(
  runningNow: number,
  startsDone: number,
  stopsDone: number,
): number {
  return runningNow + startsDone - stopsDone;
}
