import { useCameraPermissions } from 'expo-camera';
import * as React from 'react';
import { Linking } from 'react-native';

import {
  CAPTURE_IDLE,
  captureReducer,
  permissionPlan,
} from './capture-machine';

/**
 * iOS will not show the phone's own permission question while one of our cards is
 * still leaving the screen, so a step that follows a card waits a moment first.
 * Moving between the live view and the preview needs no wait: they are the same
 * screen.
 */
const CARD_LEAVES_MS = 400;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Taking one photograph with our own camera (live capture only: the gallery is
 * never offered, FE Spec §7). `start` asks about permission, explains on first
 * use, and shows the live camera; the picture comes back as a preview with Retake
 * and Use photo. Every outcome is a step on `state`, so a screen only reads it.
 */
export function useCaptureFlow() {
  const [state, dispatch] = React.useReducer(captureReducer, CAPTURE_IDLE);
  const [, requestPermission, getPermission] = useCameraPermissions();

  /** Check the phone's answer and go on to the camera, the explanation, or "off". */
  const open = React.useCallback(async () => {
    try {
      const plan = permissionPlan(await getPermission());
      if (plan === 'open') dispatch({ type: 'live' });
      else if (plan === 'explain') dispatch({ type: 'explain' });
      else dispatch({ type: 'denied' });
    } catch {
      dispatch({ type: 'failed' });
    }
  }, [getPermission]);

  /** Begin on a prompt; `retake` when it already has a photograph. */
  const start = React.useCallback(
    async (position: number, retake = false) => {
      dispatch({ type: 'start', position, retake });
      await open();
    },
    [open],
  );

  /** Continue, on the first-use explanation: now the phone asks. */
  const ask = React.useCallback(async () => {
    dispatch({ type: 'ask' });
    try {
      await pause(CARD_LEAVES_MS);
      const permission = await requestPermission();
      dispatch(permission.granted ? { type: 'live' } : { type: 'denied' });
    } catch {
      dispatch({ type: 'failed' });
    }
  }, [requestPermission]);

  /** Try again, from a card (camera off, would not start, no picture). */
  const again = React.useCallback(async () => {
    dispatch({ type: 'ask' });
    await pause(CARD_LEAVES_MS);
    await open();
  }, [open]);

  /** Retake, from the preview: straight back to the live camera. */
  const retake = React.useCallback(() => dispatch({ type: 'live' }), []);
  /** Use photo has gone, and another prompt is still to take: on to it. */
  const next = React.useCallback(
    (position: number) => dispatch({ type: 'live', position, retake: false }),
    [],
  );

  const captured = React.useCallback(
    (uri: string) => dispatch({ type: 'photo', uri }),
    [],
  );
  const noPicture = React.useCallback(() => dispatch({ type: 'noPhoto' }), []);
  const cameraFailed = React.useCallback(
    () => dispatch({ type: 'failed' }),
    [],
  );
  const close = React.useCallback(() => dispatch({ type: 'close' }), []);
  const openSettings = React.useCallback(() => {
    void Linking.openSettings();
  }, []);

  return {
    state,
    start,
    ask,
    again,
    retake,
    next,
    captured,
    noPicture,
    cameraFailed,
    close,
    openSettings,
  };
}
