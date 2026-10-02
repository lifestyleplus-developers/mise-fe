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
 * How long a theme change waits before NativeWind is told. The screen-wide
 * veil in `theme-transition.tsx` fades in over `THEME_FADE_IN_MS`; the
 * palette must not flip until it is opaque, or the swap shows through as a
 * flash of mixed colours. The gap is a little longer than the fade so the
 * veil has finished by the time the cards turn over.
 */
export const THEME_FADE_IN_MS = 160;
const APPLY_DELAY_MS = THEME_FADE_IN_MS + 20;

let applyTimer: ReturnType<typeof setTimeout> | undefined;

/** A user's change: applied once the veil covers the screen. The latest wins. */
function applyColorSchemeBehindVeil(theme: ThemeName) {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(() => applyColorScheme(theme), APPLY_DELAY_MS);
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

/**
 * The palette NativeWind is rendering right now — what everything that is not
 * a `dark:` class (the wash, the status bar, the navigation theme) must follow.
 *
 * Not `useThemeStore().theme`: that flips the instant a theme is picked, but
 * `colorScheme.set` reaches NativeWind through the OS appearance setting and
 * lands a beat later. Painting the wash from the store in that gap puts a
 * light backdrop behind still-dark cards for a few frames. Reading the
 * scheme NativeWind itself reports makes the two flip together. The stored
 * theme is only the fallback for before NativeWind has said anything.
 */
export function useAppliedTheme(): ThemeName {
  const { colorScheme: applied } = useColorScheme();
  const stored = useThemeStore((state) => state.theme);
  return applied ?? stored;
}
