import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Where a photograph is before it reaches the retry queue:
 * - `uploading`: the upload location is being asked for, or the bytes are going.
 * - `noUploadUrl`: there was no signal to get the upload location; kept, and tried
 *   again when the signal returns (SPT-01 `noUploadUrl`).
 * - `uploadFailed`: the bytes did not go; shows Retry (SPT-01 `uploadFailed`).
 * After the bytes are in storage the photograph leaves the outbox for the queue.
 */
export type PhotoStage = 'uploading' | 'noUploadUrl' | 'uploadFailed';

export type PhotoDraft = {
  /** `userId:runId:position`: one per prompt, so a retake replaces it. */
  id: string;
  /** Whose phone-held photograph this is; nobody else's screen shows it. */
  userId: number;
  runId: number;
  position: number;
  /** The captured file on the phone. */
  uri: string;
  takenAt: number;
  stage: PhotoStage;
  error: string | null;
};

type PhotoOutbox = {
  drafts: PhotoDraft[];
  put: (draft: PhotoDraft) => void;
  update: (
    id: string,
    patch: Partial<Pick<PhotoDraft, 'stage' | 'error'>>,
  ) => void;
  remove: (id: string) => void;
  /** Sign-out: nothing of this person's stays on the phone. */
  clearFor: (userId: number) => void;
};

export function photoDraftId(userId: number, runId: number, position: number) {
  return `${userId}:${runId}:${position}`;
}

/**
 * Photographs taken but not yet in storage. Persisted, so one waiting for signal
 * survives the app being closed; a run's window ends in minutes, so these are
 * short-lived either way.
 */
export const usePhotoOutbox = create<PhotoOutbox>()(
  persist(
    (set) => ({
      drafts: [],
      put: (draft) =>
        set((state) => ({
          drafts: [...state.drafts.filter((d) => d.id !== draft.id), draft],
        })),
      update: (id, patch) =>
        set((state) => ({
          drafts: state.drafts.map((d) =>
            d.id === id ? { ...d, ...patch } : d,
          ),
        })),
      remove: (id) =>
        set((state) => ({ drafts: state.drafts.filter((d) => d.id !== id) })),
      clearFor: (userId) =>
        set((state) => ({
          drafts: state.drafts.filter((d) => d.userId !== userId),
        })),
    }),
    {
      name: 'mise.spot-photo-outbox',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ drafts }) => ({ drafts }),
    },
  ),
);
