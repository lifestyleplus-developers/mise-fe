import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';
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

/**
 * Points NativeWind's `dark:` variants at the given theme.
 *
 * Done here rather than in a component because `colorScheme.set` forwards to
 * RN's Appearance instead of setting the observable NativeWind reads: at
 * module scope, before the appearance listener is live, the call is lost and
 * the OS scheme wins. Driving it from the store means it lands the moment the
 * theme actually changes, with no frame of the old palette left on screen.
 */
function applyColorScheme(theme: ThemeName) {
  colorScheme.set(theme);
}

/**
 * Which palette the app renders in. Device-local on purpose: the schema has
 * no theme column — `user.interface_language` is the only preference the
 * platform stores — so this cannot follow a person between devices.
 *
 * Light and dark only. There is no "follow the system" option, so the OS
 * setting is never consulted.
 */
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'light',
      hasHydrated: false,
      setTheme: (theme) => {
        applyColorScheme(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        applyColorScheme(next);
        set({ theme: next });
      },
    }),
    {
      name: 'mise.theme',
      storage: createJSONStorage(() => AsyncStorage),
      // `hasHydrated` describes this run, not the stored preference.
      partialize: ({ theme }) => ({ theme }),
      onRehydrateStorage: () => (state) => {
        // Runs whether or not anything was stored, so it also covers the
        // first launch, where the default above stands. Read back off the
        // store rather than `state`, which is undefined if hydration failed.
        const { theme } = useThemeStore.getState();
        applyColorScheme(state?.theme ?? theme);
        useThemeStore.setState({ hasHydrated: true });
      },
    },
  ),
);
