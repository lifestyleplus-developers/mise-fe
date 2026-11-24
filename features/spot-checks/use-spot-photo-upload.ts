import { onlineManager } from '@tanstack/react-query';
import * as React from 'react';

import { useMe } from '@/features/auth/use-me';
import { api } from '@/shared/api/client';
import { ApiError } from '@/shared/api/http';
import { UPLOAD_TIMEOUT_MS, withTimeout } from '@/shared/api/with-timeout';

import { photoDraftId, usePhotoOutbox, type PhotoDraft } from './photo-outbox';
import {
  useSpotPhotoQueue,
  useSubmitSpotCheckPhoto,
  type SubmitPhotoVariables,
} from './use-spot-photo-queue';

/** Drafts being worked on in this app session; one found `uploading` outside it was cut short. */
const inFlight = new Set<string>();

type Submit = (variables: SubmitPhotoVariables) => void;

/**
 * Gets one captured photograph into storage, then hands it to the retry queue.
 * Never throws: every outcome is a stage on the draft, so a screen only reads state.
 */
async function transfer(draft: PhotoDraft, submit: Submit): Promise<void> {
  const { update, remove } = usePhotoOutbox.getState();
  if (inFlight.has(draft.id)) return;
  // Signing out removes the draft; whatever is still awaited must then stop, so a
  // photograph is never sent under whoever signs in next.
  const gone = () =>
    !usePhotoOutbox.getState().drafts.some((d) => d.id === draft.id);
  inFlight.add(draft.id);
  try {
    update(draft.id, { stage: 'uploading', error: null });

    // The platform signs the size of the photograph into the upload, so read the
    // bytes first. The file is on the phone: failing to read it is not "no signal".
    let photo: Blob;
    try {
      photo = await fetch(draft.uri).then((r) => r.blob());
    } catch (error) {
      update(draft.id, {
        stage: 'uploadFailed',
        error: error instanceof Error ? error.message : 'Upload failed',
      });
      return;
    }

    let sign;
    try {
      sign = await api.uploads.sign({
        purpose: 'spot_check',
        target_id: draft.runId,
        capture_position: draft.position,
        content_type: 'image/jpeg',
        content_length: photo.size,
      });
    } catch (error) {
      // No answer at all is "no signal": keep the photograph and wait. An answer
      // that refuses is a failure the person can retry.
      update(draft.id, {
        stage: error instanceof ApiError ? 'uploadFailed' : 'noUploadUrl',
        error: error instanceof ApiError ? error.message : null,
      });
      return;
    }

    if (gone()) return;

    try {
      // The mock hands out `mock://` locations there is nothing to PUT to; one
      // handed out as `mock://refuse` stands for storage turning the bytes away.
      if (sign.upload_url.startsWith('mock://refuse')) {
        throw new Error('Upload failed');
      }
      if (!sign.upload_url.startsWith('mock://')) {
        // The length is signed in, but the phone sets it from the body itself;
        // sending it by hand as well risks a duplicate header.
        const { 'Content-Length': _length, ...headers } = sign.headers;
        const response = await withTimeout(UPLOAD_TIMEOUT_MS, (signal) =>
          fetch(sign.upload_url, {
            method: sign.method,
            headers: { 'Content-Type': 'image/jpeg', ...headers },
            body: photo,
            signal,
          }),
        );
        if (!response.ok) throw new Error('Upload failed');
      }
    } catch (error) {
      update(draft.id, {
        stage: 'uploadFailed',
        error: error instanceof Error ? error.message : 'Upload failed',
      });
      return;
    }

    if (gone()) return;
    submit({
      runId: draft.runId,
      request: { capture_position: draft.position, image_key: sign.key },
    });
    remove(draft.id);
  } finally {
    inFlight.delete(draft.id);
  }
}

/**
 * A run's photographs on the phone. `send` takes a captured file for a prompt
 * (a retake replaces the earlier draft). `drafts` are the ones not yet in storage
 * (uploading, no upload location, failed); `queued` are the ones in storage waiting
 * to be sent or refused. Together they are the per-prompt states SPT-01 shows.
 *
 * Capturing the file (camera, permission, preview) is the screen's business: this
 * takes its `uri`, so it works the same whichever camera library is chosen.
 */
export function useSpotPhotoUpload(runId: number | undefined) {
  const me = useMe();
  const userId = me.data?.user.id;
  const { mutate: submit } = useSubmitSpotCheckPhoto();
  const queued = useSpotPhotoQueue(runId);
  const allDrafts = usePhotoOutbox((state) => state.drafts);

  const drafts = React.useMemo(
    () =>
      allDrafts.filter(
        (draft) => draft.userId === userId && draft.runId === runId,
      ),
    [allDrafts, userId, runId],
  );

  const send = React.useCallback(
    (position: number, uri: string) => {
      if (userId === undefined || runId === undefined) return;
      const draft: PhotoDraft = {
        id: photoDraftId(userId, runId, position),
        userId,
        runId,
        position,
        uri,
        takenAt: Date.now(),
        stage: 'uploading',
        error: null,
      };
      usePhotoOutbox.getState().put(draft);
      void transfer(draft, submit);
    },
    [userId, runId, submit],
  );

  const retry = React.useCallback(
    (position: number) => {
      if (userId === undefined || runId === undefined) return;
      const draft = usePhotoOutbox
        .getState()
        .drafts.find((d) => d.id === photoDraftId(userId, runId, position));
      if (draft) void transfer(draft, submit);
    },
    [userId, runId, submit],
  );

  const discard = React.useCallback(
    (position: number) => {
      if (userId === undefined || runId === undefined) return;
      usePhotoOutbox.getState().remove(photoDraftId(userId, runId, position));
    },
    [userId, runId],
  );

  // Back in signal: try again what could not get an upload location. A draft left
  // `uploading` by a closed app is treated as failed, so Retry is offered.
  React.useEffect(() => {
    if (userId === undefined || runId === undefined) return;
    const { drafts: all, update } = usePhotoOutbox.getState();
    for (const draft of all) {
      if (
        draft.userId === userId &&
        draft.runId === runId &&
        draft.stage === 'uploading' &&
        !inFlight.has(draft.id)
      ) {
        update(draft.id, { stage: 'uploadFailed' });
      }
    }
    const retryWaiting = () => {
      if (!onlineManager.isOnline()) return;
      for (const draft of usePhotoOutbox.getState().drafts) {
        if (
          draft.userId === userId &&
          draft.runId === runId &&
          draft.stage === 'noUploadUrl'
        ) {
          void transfer(draft, submit);
        }
      }
    };
    retryWaiting();
    return onlineManager.subscribe(retryWaiting);
  }, [userId, runId, submit]);

  return { drafts, queued, send, retry, discard };
}
