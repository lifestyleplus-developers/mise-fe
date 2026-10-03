import '@/shared/lib/icons';
import { ApiProvider } from '@/shared/api/query-client';
import { NAV_THEME, THEME, WASH } from '@/shared/lib/theme';
import { useLanguageStore } from '@/shared/stores/language-store';
import { useAppliedTheme, useThemeStore } from '@/shared/stores/theme-store';
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
import { ThemeTransition } from '@/shared/components/theme-transition';
import { PortalHost } from '@rn-primitives/portal';
import { LucideProvider } from 'lucide-react-native';
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
  const theme = useThemeStore((state) => state.theme);
  const hasHydrated = useThemeStore((state) => state.hasHydrated);
  React.useLayoutEffect(() => {
    if (hasHydrated) colorScheme.set(useThemeStore.getState().theme);
  }, [hasHydrated]);
  const applied = useAppliedTheme();
  const [syncGaveUp, setSyncGaveUp] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setSyncGaveUp(true), 600);
    return () => clearTimeout(timer);
  }, []);
  const [schemeReady, setSchemeReady] = React.useState(false);
  if (!schemeReady && (applied === theme || syncGaveUp)) setSchemeReady(true);
  const languageHydrated = useLanguageStore((state) => state.hasHydrated);

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

  return (
    <ApiProvider>
      {!fontsLoaded || !hasHydrated || !languageHydrated || !schemeReady ? (
        <View
          style={{
            flex: 1,
            backgroundColor: WASH[theme].backgroundColor,
            experimental_backgroundImage: WASH[theme].backgroundImage,
          }}
        />
      ) : (
        <SafeAreaProvider>
          <LucideProvider color={THEME[applied].foreground}>
            <StatusBar style={applied === 'dark' ? 'light' : 'dark'} />
            <View
              style={{
                flex: 1,
                backgroundColor: WASH[applied].backgroundColor,
                experimental_backgroundImage: WASH[applied].backgroundImage,
              }}
            >
              <ThemeProvider value={NAV_THEME[applied]}>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: 'transparent' },
                  }}
                />
              </ThemeProvider>
            </View>
            <ThemeTransition />
            <PortalHost />
          </LucideProvider>
        </SafeAreaProvider>
      )}
    </ApiProvider>
  );
}
