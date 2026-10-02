import { ApiProvider } from '@/shared/api/query-client';
import { NAV_THEME, WASH } from '@/shared/lib/theme';
import { useLanguageStore } from '@/shared/stores/language-store';
import { useThemeStore } from '@/shared/stores/theme-store';
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import { NotoSansDevanagari_400Regular } from '@expo-google-fonts/noto-sans-devanagari';
import { NotoSansKannada_400Regular } from '@expo-google-fonts/noto-sans-kannada';
import { NotoSansMalayalam_400Regular } from '@expo-google-fonts/noto-sans-malayalam';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import { PortalHost } from '@rn-primitives/portal';
import { colorScheme } from 'nativewind';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';

export default function RootLayout() {
  // NativeWind's `dark:` variants are driven from the store itself, so there
  // is nothing to apply here — just read the resolved theme.
  const theme = useThemeStore((state) => state.theme);
  const hasHydrated = useThemeStore((state) => state.hasHydrated);
  // Point NativeWind at the stored theme once the layout is mounted.
  // Calling `colorScheme.set` from the store's hydration callback can land
  // before NativeWind's appearance listener is live, in which case the OS
  // scheme wins and `dark:` tokens render dark under a light wash until the
  // first manual toggle. A layout effect runs after mount and before paint,
  // so there is no frame of the wrong palette either.
  React.useLayoutEffect(() => {
    if (hasHydrated) colorScheme.set(theme);
  }, [theme, hasHydrated]);
  // The interface language hydrates with the same treatment: rendering
  // before AsyncStorage answers would show English for a frame to someone
  // whose stored language is not English.
  const languageHydrated = useLanguageStore((state) => state.hasHydrated);

  // Montserrat for body, Playfair Display for headings and the wordmark —
  // the split the mockup's stylesheet makes between `body` and `h1..h6`.
  // The Noto faces cover the three non-Latin interface scripts (FE Spec §9);
  // they load with everything else so the first frame of any language is
  // never a fallback-font flash.
  // Each weight is its own family: RN can't pick a weight out of a family
  // the way CSS does, so the weights are named in tailwind.config.js.
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    PlayfairDisplay_600SemiBold,
    NotoSansDevanagari_400Regular,
    NotoSansMalayalam_400Regular,
    NotoSansKannada_400Regular,
  });

  // Waiting on the stored theme as well as the fonts: rendering before
  // AsyncStorage has answered would show light for a frame to someone who
  // chose dark. The ApiProvider wraps both branches, so the persisted query
  // cache restores while the fonts load instead of after them.
  return (
    <ApiProvider>
      {!fontsLoaded || !hasHydrated || !languageHydrated ? (
        <View
          style={{
            flex: 1,
            backgroundColor: WASH[theme].backgroundColor,
            experimental_backgroundImage: WASH[theme].backgroundImage,
          }}
        />
      ) : (
        <SafeAreaProvider>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          <View
            style={{
              flex: 1,
              backgroundColor: WASH[theme].backgroundColor,
              experimental_backgroundImage: WASH[theme].backgroundImage,
            }}
          >
            {/* NAV_THEME and contentStyle are both transparent so nothing paints
            over the wash behind them. */}
            <ThemeProvider value={NAV_THEME[theme]}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
            </ThemeProvider>
          </View>
          <PortalHost />
        </SafeAreaProvider>
      )}
    </ApiProvider>
  );
}
