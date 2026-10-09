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

/** Which language the interface renders in. */
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
