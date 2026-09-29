import {
  DarkTheme,
  DefaultTheme,
  type Theme,
} from 'expo-router/react-navigation';

/**
 * Mirrors global.css's :root / .dark:root tokens as literal values.
 * React Navigation's theme consumes plain colors, not CSS variables,
 * so these are duplicated here rather than referenced via var().
 */
export const THEME = {
  light: {
    background: 'hsl(48 33% 97%)',
    foreground: 'hsl(240 6% 10%)',
    card: 'hsl(0 0% 100%)',
    cardForeground: 'hsl(240 6% 10%)',
    popover: 'hsl(0 0% 100%)',
    popoverForeground: 'hsl(240 6% 10%)',
    primary: 'hsl(240 6% 10%)',
    primaryForeground: 'hsl(48 33% 97%)',
    secondary: 'hsl(48 25% 92%)',
    secondaryForeground: 'hsl(240 6% 10%)',
    muted: 'hsl(47 27% 94%)',
    mutedForeground: 'hsl(240 4% 45%)',
    accent: 'hsl(46 28% 91%)',
    accentForeground: 'hsl(240 6% 10%)',
    destructive: 'hsl(0 54% 47%)',
    border: 'hsl(48 17% 88%)',
    input: 'hsl(48 17% 88%)',
    ring: 'hsl(240 6% 10%)',
    radius: '1rem',
  },
  dark: {
    background: 'hsl(240 6% 7%)',
    foreground: 'hsl(240 5% 96%)',
    card: 'hsl(240 7% 11%)',
    cardForeground: 'hsl(240 5% 96%)',
    popover: 'hsl(240 7% 11%)',
    popoverForeground: 'hsl(240 5% 96%)',
    primary: 'hsl(240 5% 96%)',
    primaryForeground: 'hsl(240 6% 7%)',
    secondary: 'hsl(240 6% 15%)',
    secondaryForeground: 'hsl(240 5% 96%)',
    muted: 'hsl(240 7% 14%)',
    mutedForeground: 'hsl(240 5% 65%)',
    accent: 'hsl(240 8% 17%)',
    accentForeground: 'hsl(240 5% 96%)',
    destructive: 'hsl(0 49% 41%)',
    border: 'hsl(240 8% 17%)',
    input: 'hsl(240 8% 17%)',
    ring: 'hsl(240 5% 84%)',
    radius: '1rem',
  },
};

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};
