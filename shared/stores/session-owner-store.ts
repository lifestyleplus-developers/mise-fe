import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Who was last signed in on this phone. */
export type SessionOwner = { userId: number; name: string; businessId: number };

type SessionOwnerStore = {
  owner: SessionOwner | null;
  /** True from the moment the platform ended a session until someone signs in again. */
  sessionEnded: boolean;
  hasHydrated: boolean;
  setOwner: (owner: SessionOwner) => void;
  markEnded: () => void;
  /** Someone signed in, or the person signed out on purpose. */
  clearEnded: () => void;
  clearOwner: () => void;
};

/**
 * Remembered so that when the platform ends a session (the refresh token expired,
 * the account was deactivated) the app still knows whose unsent work it is holding
 * (FE Spec §6). A person who signs out on purpose is forgotten.
 */
export const useSessionOwner = create<SessionOwnerStore>()(
  persist(
    (set) => ({
      owner: null,
      sessionEnded: false,
      hasHydrated: false,
      setOwner: (owner) => set({ owner, sessionEnded: false }),
      markEnded: () => set({ sessionEnded: true }),
      clearEnded: () => set({ sessionEnded: false }),
      clearOwner: () => set({ owner: null, sessionEnded: false }),
    }),
    {
      name: 'mise.session-owner',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ owner, sessionEnded }) => ({ owner, sessionEnded }),
      onRehydrateStorage: () => () => {
        useSessionOwner.setState({ hasHydrated: true });
      },
    },
  ),
);
