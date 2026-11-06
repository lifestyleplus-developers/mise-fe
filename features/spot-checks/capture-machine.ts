/**
 * Where taking one photograph has got to. The camera is ours (an in-app live view
 * with the prompt and the time over the picture), and so is everything around it:
 * - `idle`: nothing going on.
 * - `firstUse`: the phone has not been asked yet, so say why before it asks.
 * - `launching`: checking or asking the phone about the camera; nothing is drawn.
 * - `live`: the live camera, with the band over it.
 * - `preview`: the picture just taken, with Retake and Use photo.
 * - `denied`: camera access is off.
 * - `failed`: the camera would not start.
 * - `saveFailed`: the camera gave back no picture.
 */
export type CaptureStep =
  | 'idle'
  | 'firstUse'
  | 'launching'
  | 'live'
  | 'preview'
  | 'denied'
  | 'failed'
  | 'saveFailed';

export type CaptureState = {
  step: CaptureStep;
  /** The prompt being photographed. */
  position: number | null;
  /** A retake of a prompt that already has a photograph: do not move on after it. */
  retake: boolean;
  uri: string | null;
  /** In a row, for "still couldn't". */
  failures: number;
};

export const CAPTURE_IDLE: CaptureState = {
  step: 'idle',
  position: null,
  retake: false,
  uri: null,
  failures: 0,
};

export type CaptureEvent =
  | { type: 'start'; position: number; retake: boolean }
  | { type: 'explain' } // the phone has not been asked: say why first
  | { type: 'ask' } // on to the phone's own question, or checking again
  // The camera is allowed: show it. With a position it moves on to that prompt
  // (Use photo, then the next one) without closing the screen in between.
  | { type: 'live'; position?: number; retake?: boolean }
  | { type: 'photo'; uri: string }
  | { type: 'cancelled' }
  | { type: 'denied' }
  | { type: 'failed' }
  | { type: 'noPhoto' }
  | { type: 'close' };

/** What the camera steps do with each event. Pure, so every path can be checked. */
export function captureReducer(
  state: CaptureState,
  event: CaptureEvent,
): CaptureState {
  switch (event.type) {
    case 'start':
      return {
        step: 'launching',
        position: event.position,
        retake: event.retake,
        uri: null,
        failures: 0,
      };
    case 'explain':
      return state.position === null ? state : { ...state, step: 'firstUse' };
    case 'ask':
      return state.position === null ? state : { ...state, step: 'launching' };
    case 'live': {
      const position = event.position ?? state.position;
      if (position === null) return state;
      return {
        step: 'live',
        position,
        retake: event.retake ?? state.retake,
        uri: null,
        failures: 0,
      };
    }
    case 'photo':
      return { ...state, step: 'preview', uri: event.uri, failures: 0 };
    case 'cancelled':
    case 'close':
      return CAPTURE_IDLE;
    case 'denied':
      return { ...state, step: 'denied' };
    case 'failed':
      return { ...state, step: 'failed', failures: state.failures + 1 };
    case 'noPhoto':
      return { ...state, step: 'saveFailed', failures: state.failures + 1 };
  }
}

/** What to do about the phone's permission before opening the camera. */
export function permissionPlan(permission: {
  granted: boolean;
  canAskAgain: boolean;
}): 'open' | 'explain' | 'denied' {
  if (permission.granted) return 'open';
  return permission.canAskAgain ? 'explain' : 'denied';
}
