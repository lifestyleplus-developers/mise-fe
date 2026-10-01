import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  INTERFACE_LANGUAGE,
  type InterfaceLanguage,
} from '@/shared/constants/languages';

type LanguageStore = {
  language: InterfaceLanguage;
  /** False until AsyncStorage has been read — mirrors the theme store. */
  hasHydrated: boolean;
  setLanguage: (language: InterfaceLanguage) => void;
};

/**
 * Which language the interface renders in.
 *
 * Device-local, like the theme store: `user.interface_language` is the
 * platform's record (Model §15 — the language follows the person between
 * devices), but until the backend exists and /auth/me returns a real
 * setting, this is where the choice lives. Login writes it back from the
 * me response; Settings will own the picker.
 *
 * Not in the same store as the theme on purpose: theme and language change
 * at different times, for different reasons, and login touches only one of
 * them.
 */
export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: INTERFACE_LANGUAGE.EN,
      hasHydrated: false,
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'mise.language',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ language }) => ({ language }),
      onRehydrateStorage: () => () => {
        useLanguageStore.setState({ hasHydrated: true });
      },
    },
  ),
);
