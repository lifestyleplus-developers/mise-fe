import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme, useColorScheme } from 'nativewind';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeName = 'light' | 'dark';

type ThemeStore = {
  theme: ThemeName;
  /** False until AsyncStorage has been read; see the note below. */
  hasHydrated: boolean;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
};

/** Points NativeWind's `dark:` variants at the given theme. */
function applyColorScheme(theme: ThemeName) {
  colorScheme.set(theme);
}

/** Delay before NativeWind is told, so the veil is opaque first. */
export const THEME_FADE_IN_MS = 160;
const APPLY_DELAY_MS = THEME_FADE_IN_MS + 20;

let applyTimer: ReturnType<typeof setTimeout> | undefined;

/** Applies a user's change behind the veil; the latest wins. */
function applyColorSchemeBehindVeil(theme: ThemeName) {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(() => applyColorScheme(theme), APPLY_DELAY_MS);
}

/** Which palette the app renders in. */
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'light',
      hasHydrated: false,
      setTheme: (theme) => {
        applyColorSchemeBehindVeil(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        applyColorSchemeBehindVeil(next);
        set({ theme: next });
      },
    }),
    {
      name: 'mise.theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ theme }) => ({ theme }),
      onRehydrateStorage: () => (state) => {
        const { theme } = useThemeStore.getState();
        applyColorScheme(state?.theme ?? theme);
        useThemeStore.setState({ hasHydrated: true });
      },
    },
  ),
);

/** The palette NativeWind is rendering; the store's `theme` flips first. */
export function useAppliedTheme(): ThemeName {
  const { colorScheme: applied } = useColorScheme();
  const stored = useThemeStore((state) => state.theme);
  return applied ?? stored;
}
