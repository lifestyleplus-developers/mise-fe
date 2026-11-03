import { useMutation } from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { queryClient } from '@/shared/api/query-client';
import { useQueuedWrites } from '@/shared/api/query-helpers';
import type {
  SpotCheckRun,
  SubmitSpotCheckPhotoRequest,
} from '@/shared/api/types';

import { spotCheckKeys } from './spot-check-keys';

export type SubmitPhotoVariables = {
  runId: number;
  request: SubmitSpotCheckPhotoRequest;
};

const SUBMIT_KEY = ['spot-checks', 'photo'] as const;

/**
 * POST /spot-check-runs/{id}/photos — its defaults, so a paused (queued) photograph
 * can be replayed after the app restarts (AGENTS.md: setMutationDefaults at the
 * point the mutation is defined).
 */
const submitMutationFn = ({
  runId,
  request,
}: SubmitPhotoVariables): Promise<SpotCheckRun> =>
  api.spotChecks.submitPhoto(runId, request);

queryClient.setMutationDefaults(SUBMIT_KEY, { mutationFn: submitMutationFn });

/**
 * Sends a photograph whose bytes are already in storage (it has an `image_key`).
 * Offline it waits ("Waiting to send") and replays; 409 `window_closed` is the
 * platform's final answer and reads as refused. The answer is the run itself,
 * written into the cache so the prompt shows as sent.
 */
export function useSubmitSpotCheckPhoto() {
  return useMutation<SpotCheckRun, Error, SubmitPhotoVariables>({
    mutationKey: SUBMIT_KEY,
    networkMode: 'online',
    mutationFn: submitMutationFn,
    onSuccess: (run, { runId }) => {
      queryClient.setQueryData<SpotCheckRun>(spotCheckKeys.run(runId), run);
      void queryClient.invalidateQueries({ queryKey: spotCheckKeys.runLists });
    },
  });
}

/**
 * Photographs of one run that have not landed. `waiting` shows as "Waiting to
 * send" on the prompt; `refused` (the window closed first) as "Not recorded".
 * One entry per prompt: the latest.
 */
export function useSpotPhotoQueue(runId: number | undefined) {
  const writes = useQueuedWrites<SubmitPhotoVariables>(
    SUBMIT_KEY,
    (v) => `${v.runId}:${v.request.capture_position}`,
  );
  return writes.filter(
    (write) => runId === undefined || write.variables.runId === runId,
  );
}
