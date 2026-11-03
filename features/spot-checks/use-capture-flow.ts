import * as ImagePicker from 'expo-image-picker';
import * as React from 'react';
import { Linking } from 'react-native';

import {
  CAPTURE_IDLE,
  captureReducer,
  permissionPlan,
} from './capture-machine';

/**
 * iOS cannot open the camera while one of our own sheets is still leaving the
 * screen, so a step that came from a sheet waits a moment first.
 */
const SHEET_LEAVES_MS = 400;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Taking one photograph with the phone's own camera (live capture only: the
 * gallery is never offered, FE Spec §7). `start` asks about permission, explains
 * on first use, and opens the camera; the picture comes back as a preview with
 * Retake and Use photo. Every outcome is a step on `state`, so a screen only reads it.
 */
export function useCaptureFlow() {
  const [state, dispatch] = React.useReducer(captureReducer, CAPTURE_IDLE);

  const launch = React.useCallback(async () => {
    dispatch({ type: 'launch' });
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        exif: false,
      });
      if (result.canceled) {
        dispatch({ type: 'cancelled' });
        return;
      }
      const uri = result.assets?.[0]?.uri;
      dispatch(uri ? { type: 'photo', uri } : { type: 'noPhoto' });
    } catch {
      dispatch({ type: 'failed' });
    }
  }, []);

  /** Begin on a prompt; `retake` when it already has a photograph. */
  const start = React.useCallback(
    async (position: number, retake = false) => {
      dispatch({ type: 'start', position, retake });
      try {
        const permission = await ImagePicker.getCameraPermissionsAsync();
        const plan = permissionPlan(permission);
        if (plan === 'open') await launch();
        else if (plan === 'explain') dispatch({ type: 'explain' });
        else dispatch({ type: 'denied' });
      } catch {
        dispatch({ type: 'failed' });
      }
    },
    [launch],
  );

  /** Continue, on the first-use explanation: now the phone asks. */
  const ask = React.useCallback(async () => {
    dispatch({ type: 'ask' });
    try {
      await pause(SHEET_LEAVES_MS);
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.granted) await launch();
      else dispatch({ type: 'denied' });
    } catch {
      dispatch({ type: 'failed' });
    }
  }, [launch]);

  /** Retake from the preview, or Try again after a failure. */
  const again = React.useCallback(async () => {
    dispatch({ type: 'launch' });
    await pause(SHEET_LEAVES_MS);
    await launch();
  }, [launch]);

  const close = React.useCallback(() => dispatch({ type: 'close' }), []);
  const openSettings = React.useCallback(() => {
    void Linking.openSettings();
  }, []);

  return { state, start, ask, again, close, openSettings };
}
