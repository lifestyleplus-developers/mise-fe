import { create } from 'zustand';

/**
 * Things the platform has said it cannot do (SPT-01, SPT-03, SPT-05 and SPT-06
 * fallbacks). The app finds out from an answer, never by asking who is signed in,
 * remembers it for the session, and draws the plainer screen the mockup has for
 * it. A new session starts by assuming the platform can.
 * - `archivedAreas`: it will not list archived areas.
 * - `listEdit`: it will not change the prompts or items of a check that exists.
 * - `overrideAfterClose`: it will not accept an override once the window has closed.
 */
export type PlatformLimit = 'archivedAreas' | 'listEdit' | 'overrideAfterClose';

type PlatformLimits = {
  limits: Record<PlatformLimit, boolean>;
  learn: (limit: PlatformLimit) => void;
  reset: () => void;
};

const NONE: Record<PlatformLimit, boolean> = {
  archivedAreas: false,
  listEdit: false,
  overrideAfterClose: false,
};

export const usePlatformLimits = create<PlatformLimits>()((set) => ({
  limits: NONE,
  learn: (limit) =>
    set((state) => ({ limits: { ...state.limits, [limit]: true } })),
  reset: () => set({ limits: NONE }),
}));

/** Whether the platform has said it cannot do this. */
export function usePlatformLimit(limit: PlatformLimit): boolean {
  return usePlatformLimits((state) => state.limits[limit]);
}
