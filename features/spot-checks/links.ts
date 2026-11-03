import type { Href } from 'expo-router';

/**
 * Where "a spot check was revealed" lands (FE Spec §2): the capture screen, on that
 * run. With nothing behind it, Back goes to the Modules tab rather than out of the app.
 */
export function spotCheckRunHref(runId: number): Href {
  return { pathname: '/spot-checks', params: { run: String(runId) } };
}

/** One run's capture screen, opened from the landing list when two are revealed at once. */
export function spotCheckCaptureHref(runId: number): Href {
  return { pathname: '/spot-checks/capture/[runId]', params: { runId } };
}

/** One run's results and review. */
export function spotCheckResultsHref(runId: number): Href {
  return { pathname: '/spot-checks/results/[runId]', params: { runId } };
}

/** A check in the editor. */
export function spotCheckEditHref(id: number): Href {
  return { pathname: '/spot-checks/checks/[id]', params: { id } };
}
