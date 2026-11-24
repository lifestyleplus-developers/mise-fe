import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type NotificationPrefs = {
  /** True once our own "Notifications" question has been answered either way. */
  asked: boolean;
  hasHydrated: boolean;
  markAsked: () => void;
};

/**
 * The question is asked once per phone (NTF-01 `askPermission`). "Not now" is
 * remembered, so it is not asked again; the system setting is the way back.
 */
export const useNotificationPrefs = create<NotificationPrefs>()(
  persist(
    (set) => ({
      asked: false,
      hasHydrated: false,
      markAsked: () => set({ asked: true }),
    }),
    {
      name: 'mise.notifications',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ asked }) => ({ asked }),
      onRehydrateStorage: () => () => {
        useNotificationPrefs.setState({ hasHydrated: true });
      },
    },
  ),
);
